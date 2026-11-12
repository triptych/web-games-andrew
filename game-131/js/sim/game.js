// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input: { x, y, turn, dyaw, a, run, cmd }. x strafes, y is forward/back (-1 forward), turn is a rate in [-1, 1],
// dyaw is radians already turned by a mouse or a finger, a is "interact/continue" pressed since the last step,
// cmd is one command object: { t: 'go', d: 'n'|'e'|'s'|'w' } | { t: 'feel' } | { t: 'back' } | { t: 'hint' }.

import { PLAYER, FRAY, PICKUPS_PER_ZONE, BARK_GAP } from '../config.js';
import { makeRng, hashSeed } from '../rng.js';
import { GEMS, KINDS, LINES, BAUBLES, OTHERS, ITEMS } from './data/story.js';
import { zone, zoneIds, canStand, move, lattice, distField, ALL_OPEN, tunnel, tunnelOpen, findThing } from './world.js';
import { heightAt } from './terrain.js';

const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

export function newGame(seed = 1) {
    const start = zone('isle').def.spawn;
    const G = {
        v: 1, seed, rng: makeRng(hashSeed(seed)), t: 0,
        zone: 'isle',
        player: { x: start.x, z: start.z, yaw: start.yaw, moved: 0 },
        fray: { state: 'hurt', x: 0, z: 0, crumbs: [] },
        gems: [], items: {}, flags: {}, taken: {}, lore: [], seen: { isle: 1 },
        pickups: {}, counts: {}, keepsakes: [],
        cards: [{ k: 'card', id: 'intro1' }, { k: 'card', id: 'intro2' }],
        tun: null,                  // { id, x, y, seen: [], done } while Fray is in a tunnel
        seq: {},                    // progress through each zone's chime order
        lineN: {},                  // which variant of each line comes next
        barkT: 0, pendingBark: null, prompt: null, done: false,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    const th = zone('isle').byId.fray;
    G.fray.x = th.x; G.fray.z = th.z;
    for (const id of zoneIds()) G.pickups[id] = scatter(G, id);
    return G;
}

/** Twelve of each small thing, on ground you can reach, away from everything else. */
function scatter(G, zoneId) {
    const Z = zone(zoneId), L = lattice(zoneId), out = [];
    for (const s of Z.def.scatter || []) {
        const from = s.from ? Z.byId[s.from] || Z.def.spawn : Z.things.find((t) => t.type === 'portal');
        const dist = fieldFrom(zoneId, from);
        const cand = [];
        for (let i = 0; i < L.n; i++) {
            if (dist[i] < 3) continue;
            const [x, z] = L.at(i);
            if (Z.kind === 'field') { const h = heightAt(x, z); if ((s.maxH && h > s.maxH) || (s.minH && h < s.minH)) continue; }
            cand.push(i);
        }
        let placed = 0;
        for (let tries = 0; placed < (s.n || PICKUPS_PER_ZONE) && tries < 4000; tries++) {
            const [x, z] = L.at(cand[Math.floor(G.rng() * cand.length)]);
            if (Z.things.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
            if (out.some((p) => Math.hypot(p.x - x, p.z - z) < (Z.kind === 'field' ? 9 : 2.5))) continue;
            out.push({ k: s.kind, x, z, g: 0 });
            placed++;
        }
    }
    return out;
}

const fieldCache = {};
function fieldFrom(zoneId, t) {
    const k = zoneId + '|' + t.x + ',' + t.z;
    if (!fieldCache[k]) {
        const starts = [];
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) starts.push([t.x + dx, t.z + dz]);
        fieldCache[k] = distField(zoneId, ALL_OPEN, starts);
    }
    return fieldCache[k];
}

// ------------------------------------------------------------------ small helpers
const ev = (G, e) => { if (G.events.length < 400) G.events.push(e); };
export const has = (G, gem) => G.gems.includes(gem);
const count = (G, item) => G.items[item] || 0;

/** Fray says a line aloud (a subtitle and a voice clip in the view). Lists rotate. */
function say(G, line, extra) {
    const v = LINES[line];
    let n = 0;
    if (Array.isArray(v)) { n = (G.lineN[line] || 0) % v.length; G.lineN[line] = n + 1; }
    ev(G, { type: 'say', line, n, text: extra || (Array.isArray(v) ? v[n] : v) });
    G.barkT = BARK_GAP;
}

function grantGem(G, gem) {
    if (has(G, gem)) return;
    G.gems.push(gem);
    ev(G, { type: 'gem', gem, n: G.gems.length });
    G.cards.push({ k: 'card', id: gem });
    if (LINES['gem-' + gem]) G.pendingBark = 'gem-' + gem;
}

function note(G, title, text, who) { G.cards.push({ k: 'note', title, text, who }); ev(G, { type: 'note' }); }

/** A free spot beside a thing, for arriving through a portal. */
function arriveAt(G, zoneId, t) {
    for (let r = 0; r < 5; r += 0.5) for (let a = 0; a < 8; a++) {
        const x = t.x + Math.cos((a * Math.PI) / 4) * r, z = t.z + Math.sin((a * Math.PI) / 4) * r;
        if (canStand(zoneId, G.flags, x, z, PLAYER.radius + 0.1)) return { x, z };
    }
    return { x: t.x, z: t.z };
}

// ------------------------------------------------------------------ what can be used right now
function usable(G, t) {
    switch (t.type) {
        case 'lore': case 'portal': case 'chime': case 'offer': case 'hearth': return true;
        case 'npc': return t.npc !== 'fray' || G.fray.state === 'hurt';
        case 'tunnel': return true;
        case 'pedestal': return !has(G, t.gem);
        default: return false;
    }
}

function labelOf(G, t) {
    if (t.label) return t.label;
    if (t.type === 'lore') return 'Read: ' + t.title;
    if (t.type === 'tunnel') return 'Send Fray in';
    if (t.type === 'pedestal') return 'Look closer';
    if (t.type === 'hearth') return 'The Hearth';
    if (t.npc === 'fray') return 'Kneel beside her';
    if (t.npc === 'elder') return 'Speak with Elder Grusk';
    return 'Look';
}

function findPrompt(G) {
    const p = G.player, fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bd = Infinity;
    for (const t of zone(G.zone).things) {
        if (!usable(G, t)) continue;
        const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        if (d > PLAYER.reach + (t.solid || 0)) continue;
        if (d > 0.8 && (dx * fx + dz * fz) / d < 0.15) continue;      // roughly in front
        if (d < bd) { bd = d; best = t; }
    }
    return best ? { id: best.id, label: labelOf(G, best) } : null;
}

// ------------------------------------------------------------------ using things
function interact(G, t) {
    ev(G, { type: 'use', id: t.id, kind: t.type });
    if (t.type === 'lore') {
        const fresh = !G.lore.includes(t.id);
        if (fresh) { G.lore.push(t.id); ev(G, { type: 'lore', id: t.id, n: G.lore.length }); }
        G.cards.push({ k: 'lore', id: t.id });
    } else if (t.type === 'npc' && t.npc === 'fray') {
        if (!G.flags.met) { G.flags.met = true; G.cards.push({ k: 'card', id: 'met' }); }
        else if (count(G, 'moonmint') < 3) note(G, 'Fray', `"Moonmint," she whispers. "Three." You have ${count(G, 'moonmint')}.`);
        else {
            G.items.moonmint = 0; G.flags.healed = true;
            G.fray.state = 'follow';
            G.cards.push({ k: 'card', id: 'healed' });
            G.pendingBark = 'zone-isle';
            ev(G, { type: 'healed' });
        }
    } else if (t.type === 'npc' && t.npc === 'elder') {
        const id = G.done ? 'elder3' : G.flags.hearthSet ? 'elder2' : 'elder1';
        G.flags.elderMet = true;
        note(G, OTHERS[id].who, OTHERS[id].text, id);
    } else if (t.type === 'portal') {
        if (t.needs && !has(G, t.needs)) { if (t.deny) note(G, labelOf(G, t), t.deny); return; }
        travel(G, t);
    } else if (t.type === 'tunnel') {
        if (G.fray.state !== 'follow') note(G, 'A small way in', 'A burrow, far too small for you. Something goblin-sized could manage it.');
        else if (t.needsFlag && !G.flags[t.needsFlag]) note(G, 'A small way in', t.deny);
        else enterTunnel(G, t.tunnel);
    } else if (t.type === 'offer') {
        if (G.flags[t.flag]) note(G, OTHERS[t.done].who, OTHERS[t.done].text, t.done);
        else if (count(G, t.item) >= t.count) {
            G.items[t.item] -= t.count; G.flags[t.flag] = true;
            ev(G, { type: 'offered', id: t.id });
            note(G, OTHERS[t.done].who, OTHERS[t.done].text, t.done);
            grantGem(G, t.gem);
        } else {
            G.flags[t.id + 'Asked'] = true;
            note(G, OTHERS[t.ask].who, OTHERS[t.ask].text + ` (${count(G, t.item)} of ${t.count} ${ITEMS[t.item].plural}.)`, t.ask);
        }
    } else if (t.type === 'chime') {
        const s = zone(G.zone).def.seq;
        ev(G, { type: 'chime', id: t.id, note: t.note });
        if (G.flags[s.flag]) return;
        const at = G.seq[G.zone] || 0;
        if (s.order[at] === t.id) {
            G.seq[G.zone] = at + 1;
            if (at + 1 === s.order.length) { G.flags[s.flag] = true; ev(G, { type: 'seqDone', zone: G.zone }); }
        } else { G.seq[G.zone] = s.order[0] === t.id ? 1 : 0; if (at > 0) ev(G, { type: 'seqReset', zone: G.zone }); }
    } else if (t.type === 'pedestal') {
        const need = (t.needs || []).filter((f) => !G.flags[f]);
        if (need.length) note(G, 'Not yet', need.length < (t.needs || []).length && t.half ? t.half : t.wait);
        else grantGem(G, t.gem);
    } else if (t.type === 'hearth') {
        if (count(G, 'heart') > 0) {
            G.items.heart = 0;
            grantGem(G, 'heart');
            G.cards.push({ k: 'card', id: 'end' });
            G.done = true;
            ev(G, { type: 'ending' });
        } else if (G.flags.hearthSet) note(G, 'The Hearth', 'Six gems glow in the hearthstone. The seventh hollow, in the middle, is the shape of a heart.');
        else if (G.gems.length >= 6) { G.flags.hearthSet = true; G.cards.push({ k: 'card', id: 'hearth' }); ev(G, { type: 'hearthSet' }); }
        else note(G, 'The Hearth', 'A great round hearthstone, cut with a spiral of seven hollows. The embers are grey.');
    }
}

function travel(G, portal) {
    const from = G.zone, dest = zone(portal.to), target = dest.byId[portal.at];
    G.zone = portal.to;
    const p = arriveAt(G, portal.to, target);
    G.player.x = p.x; G.player.z = p.z;
    if (portal.to !== from) G.player.yaw = Math.atan2((dest.kind === 'grid' ? (dest.w * dest.cell) / 2 : 0) - p.x, -((dest.kind === 'grid' ? (dest.h * dest.cell) / 2 : 0) - p.z));
    G.fray.crumbs.length = 0;
    G.fray.x = p.x; G.fray.z = p.z;
    ev(G, { type: 'travel', from, to: portal.to, via: portal.id });
    const key = portal.id === 'vineFoot' ? 'high' : portal.to;
    if (!G.seen[key] && LINES['zone-' + key]) { G.seen[key] = 1; G.pendingBark = 'zone-' + key; }
}

// ------------------------------------------------------------------ Fray in the tunnels
function enterTunnel(G, id) {
    const T = tunnel(id);
    G.tun = { id, x: T.start.x, y: T.start.y, seen: [T.start.x + ',' + T.start.y], hum: T.hum[T.start.x + ',' + T.start.y] };
    G.fray.state = 'tunnel';
    ev(G, { type: 'tunnelIn', id });
    say(G, 'tun-enter');
}

function tunnelDone(G, T) { return T.def.flag ? !!G.flags[T.def.flag] : !!G.taken['tunnel:' + T.id]; }

function tunnelCmd(G, cmd) {
    const T = tunnel(G.tun.id), s = G.tun;
    if (cmd.t === 'back') return leaveTunnel(G);
    if (cmd.t === 'go' && DIRS[cmd.d]) {
        const [dx, dy] = DIRS[cmd.d], x = s.x + dx, y = s.y + dy;
        if (y >= T.h && s.x === T.start.x) return leaveTunnel(G);            // back out of the mouth
        if (!tunnelOpen(T, x, y)) { ev(G, { type: 'tunBump', d: cmd.d }); return say(G, 'tun-bump'); }
        s.x = x; s.y = y;
        const k = x + ',' + y;
        if (!s.seen.includes(k)) s.seen.push(k);
        ev(G, { type: 'tunStep', x, y });
        const ch = T.rows[y][x], bk = `bauble:${T.id}:${k}`;
        if (ch === 'b' && !G.taken[bk]) {
            G.taken[bk] = 1;
            const n = (G.counts.bauble = (G.counts.bauble || 0) + 1);
            ev(G, { type: 'pickup', kind: 'bauble', n, of: BAUBLES.length, what: BAUBLES[(n - 1) % BAUBLES.length] });
            say(G, 'tun-bauble');
            if (n === BAUBLES.length) keepsake(G, 'bauble');
        } else if (T.goal.x === x && T.goal.y === y && !tunnelDone(G, T)) ev(G, { type: 'say', line: `tun-${T.id}-found`, n: 0, text: T.def.found });
        else if (!tunnelDone(G, T)) { const h = T.hum[k]; say(G, h < s.hum ? 'tun-warm' : h > s.hum ? 'tun-cold' : 'tun-step'); }
        else say(G, 'tun-step');
        s.hum = T.hum[k];
    } else if (cmd.t === 'feel') {
        if (T.goal.x === s.x && T.goal.y === s.y && !tunnelDone(G, T)) {
            if (T.def.flag) G.flags[T.def.flag] = true;
            else { G.taken['tunnel:' + T.id] = 1; G.items[T.def.item] = count(G, T.def.item) + 1; ev(G, { type: 'item', item: T.def.item, n: G.items[T.def.item] }); }
            ev(G, { type: 'tunDone', id: T.id, thing: T.def.thing });
            ev(G, { type: 'say', line: `tun-${T.id}-used`, n: 0, text: T.def.used });
        } else say(G, 'tun-nothing');
    }
}

function leaveTunnel(G) {
    ev(G, { type: 'tunnelOut', id: G.tun.id });
    G.tun = null;
    G.fray.state = 'follow';
    G.fray.x = G.player.x; G.fray.z = G.player.z;
    G.fray.crumbs.length = 0;
    say(G, 'tun-out');
}

function keepsake(G, kind) {
    if (G.keepsakes.includes(kind)) return;
    G.keepsakes.push(kind);
    ev(G, { type: 'keepsake', kind, name: KINDS[kind].keepsake });
    if (G.fray.state !== 'hurt') G.pendingBark = KINDS[kind].line;
}

// ------------------------------------------------------------------ one step
export function step(G, inp, dt) {
    G.t += dt;
    // 1. a card on screen: nothing moves until it is closed
    if (G.cards.length) {
        if (inp.a) { const c = G.cards.shift(); ev(G, { type: 'cardClose', k: c.k, id: c.id }); }
        G.prompt = null;
        return;
    }
    // 2. Fray in a tunnel: you stand at the mouth and call directions
    if (G.tun) {
        if (inp.cmd) tunnelCmd(G, inp.cmd);
        else if (inp.a) tunnelCmd(G, { t: 'feel' });
        G.prompt = null;
        return;
    }
    if (G.pendingBark) { say(G, G.pendingBark); G.pendingBark = null; }
    if (inp.cmd && inp.cmd.t === 'hint') ev(G, { type: 'hint', id: nextGoal(G).hint });

    // 3. walking
    const p = G.player;
    p.yaw += (inp.turn || 0) * PLAYER.turn * dt + (inp.dyaw || 0);
    if (p.yaw > Math.PI) p.yaw -= Math.PI * 2; else if (p.yaw < -Math.PI) p.yaw += Math.PI * 2;
    let mx = inp.x || 0, my = inp.y || 0;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    if (len > 0.01) {
        const sp = (inp.run ? PLAYER.run : PLAYER.walk) * dt;
        const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        const dx = (fx * -my + -fz * mx) * sp, dz = (fz * -my + fx * mx) * sp;
        const q = move(G.zone, G.flags, p.x, p.z, dx, dz);
        p.moved += Math.hypot(q.x - p.x, q.z - p.z);
        p.x = q.x; p.z = q.z;
        if (p.moved > 2.1) { p.moved = 0; ev(G, { type: 'footstep', run: !!inp.run }); }
    }

    // 4. things you walk over
    const Z = zone(G.zone);
    for (const t of Z.things) {
        if (t.type !== 'item' || G.taken[t.id]) continue;
        if (Math.hypot(t.x - p.x, t.z - p.z) < PLAYER.touch + 0.3) {
            G.taken[t.id] = 1;
            G.items[t.item] = count(G, t.item) + 1;
            ev(G, { type: 'item', item: t.item, n: G.items[t.item], id: t.id });
        }
    }
    for (const c of G.pickups[G.zone]) {
        if (c.g || Math.hypot(c.x - p.x, c.z - p.z) > PLAYER.touch) continue;
        c.g = 1;
        const n = (G.counts[c.k] = (G.counts[c.k] || 0) + 1);
        const of = G.pickups[G.zone].filter((o) => o.k === c.k).length;
        ev(G, { type: 'pickup', kind: c.k, n, of, x: c.x, z: c.z });
        if (n === of) keepsake(G, c.k);
    }

    // 5. Fray follows your trail
    const th = G.fray;
    if (th.state === 'follow') {
        const last = th.crumbs[th.crumbs.length - 1];
        if (!last || Math.hypot(last[0] - p.x, last[1] - p.z) > FRAY.crumb) th.crumbs.push([p.x, p.z]);
        const d = Math.hypot(th.x - p.x, th.z - p.z);
        if (d > FRAY.catchUp || th.crumbs.length > FRAY.crumbs) { th.x = p.x; th.z = p.z; th.crumbs.length = 0; }
        else if (d > FRAY.follow && th.crumbs.length) {
            const c = th.crumbs[0], cx = c[0] - th.x, cz = c[1] - th.z, cd = Math.hypot(cx, cz);
            const sp = FRAY.speed * dt;
            if (cd <= sp) { th.x = c[0]; th.z = c[1]; th.crumbs.shift(); }
            else { th.x += (cx / cd) * sp; th.z += (cz / cd) * sp; }
        }
        G.barkT -= dt;
        if (G.barkT < -75) say(G, 'idle');
    }

    // 6. what is in front of you, and using it
    G.prompt = findPrompt(G);
    if (inp.a && G.prompt) interact(G, Z.byId[G.prompt.id]);
}

// ------------------------------------------------------------------ what comes next (the Hint button and the bot)
/** The next thing the story wants: { hint, thing } where thing is an id somewhere on the Isle, or null when done. */
export function nextGoal(G) {
    const g = (hint, thing) => ({ hint, thing });
    const f = G.flags, n = (i) => count(G, i);
    const firstItem = (ids) => ids.find((id) => !G.taken[id]);
    if (!f.met) return g('meet', 'fray');
    if (!f.healed) { const m = firstItem(['mint2', 'mint3', 'mint1']); return n('moonmint') >= 3 || !m ? g('healGive', 'fray') : g('mint', m); }
    if (!has(G, 'leaf')) return f.rootDoor ? g('leafGem', 'leafPedestal') : g('rootTunnel', 'rootTunnel');
    if (!has(G, 'stone')) {
        if (n('rune') >= 3) return g('runesGive', 'grandfather');
        const r = firstItem(['rune1', 'rune2']);
        if (r) return g('runes', r);
        return G.taken['tunnel:golem'] ? g('runesGive', 'grandfather') : g('runes', 'golemTunnel');
    }
    if (!has(G, 'light')) {
        if (!f.crystalGate) return g(G.zone === 'caves' ? 'caveGate' : 'cave', 'cavesTunnel');
        if (!f.cavesSung) return g('caveSing', zone('caves').def.seq.order[G.seq.caves || 0]);
        return g('lightGem', 'lightPedestal');
    }
    if (!has(G, 'wind')) {
        if (!f.underGate) return g(G.zone === 'under' ? 'underGate' : 'under', 'underTunnel');
        if (n('pipe') >= 3) return g('pipesGive', 'organ');
        const pp = firstItem(['pipe1', 'pipe2', 'pipe3']);
        return pp ? g('pipes', pp) : g('pipesGive', 'organ');
    }
    if (!has(G, 'water')) {
        if (!f.skyValve) return g(G.zone === 'sky' ? 'skyValve' : 'sky', 'skyTunnel');
        if (!f.skySung) return g('skyVanes', zone('sky').def.seq.order[G.seq.sky || 0]);
        return g('waterGem', 'waterPedestal');
    }
    if (!has(G, 'moon')) {
        if (n('pearl') >= 3) return g('pearlsGive', 'tideMother');
        const pe = firstItem(['pearl1', 'pearl2']);
        if (pe) return g(G.zone === 'sea' ? 'pearls' : 'sea', pe);
        return G.taken['tunnel:sea'] ? g('pearlsGive', 'tideMother') : g('pearls', 'seaTunnel');
    }
    if (!G.done) {
        if (n('heart') > 0) return g('heartGive', 'hearth');
        if (!f.elderMet) return g(G.zone === 'warren' ? 'elder' : 'moonDoor', 'elder');
        if (!f.hearthSet) return g('hearthSet', 'hearth');
        return g('dark', 'hearthTunnel');
    }
    return g('done', null);
}

export { findThing };

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
