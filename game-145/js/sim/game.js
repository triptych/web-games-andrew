// VACANCY — the simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// G holds only what changes and the seed. The city and the story are rebuilt from the seed on load (attach()),
// so a save is a few hundred bytes.

import { TILE, PLAYER, ITEMS, LOCKS, DIARIES, ENDING_SECONDS } from '../config.js';
import { makeCity } from './city.js';
import { makeStory } from './story.js';
import { tileAt, tryMove, groundAt, overHole, surfaceAt, edgeLockAt, lockKind, outdoorFree } from './world.js';
import { interiorOf } from './interior.js';
import { CITIZENS, MARROW, FRAGMENTS, VENDING } from './data/citizens.js';
import { DIRS } from './city.js';

export const SAVE_V = 1;
const WHO = Object.fromEntries([...CITIZENS, MARROW].map((c) => [c.id, c]));
export function citizen(id) { return WHO[id]; }

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed: seed >>> 0, t: 0,
        p: { x: 0, z: 0, y: 0, L: 0, yaw: 0, vy: 0, air: false, dist: 0, stepAcc: 0 },
        got: [], items: ['flashlight', 'compass'], open: [], visited: [], read: [],
        dials: [0, 0, 0], levers: [], power: false, portal: 0, won: false, cans: 0, falls: 0,
        events: [],
    };
    attach(G);
    const s = G.story.start;
    Object.assign(G.p, { x: s.x, z: s.z, L: s.L, yaw: s.yaw });
    G.p.y = groundAt(G.city, s.L, s.x, s.z);
    visit(G);
    G.events.push({ type: 'wake' });
    return G;
}

/** Rebuild everything derived from the seed and the saved state. */
function attach(G) {
    Object.defineProperty(G, 'city', { value: makeCity(G.seed), enumerable: false, writable: true, configurable: true });
    Object.defineProperty(G, 'story', { value: makeStory(G.city, G.seed), enumerable: false, writable: true, configurable: true });
    const derived = {
        openSet: new Set(G.open), gotSet: new Set(G.got), visitedSet: new Set(G.visited),
        thingById: new Map(G.story.things.map((t) => [t.id, t])),
        outdoor: G.city.props.filter((p) => p.id),
        diaryIndex: new Map(G.story.diaries.map((d) => [d.k, d])),
    };
    for (const [k, v] of Object.entries(derived)) Object.defineProperty(G, k, { value: v, enumerable: false, writable: true, configurable: true });
    // the hall's console and breaker are things too
    const hall = G.city.buildings[G.city.lab.hall];
    for (const t of interiorOf(G.city, hall).things) G.thingById.set(t.id, t);
}

// ------------------------------------------------------------------ step

/** Advance one fixed step. inp = { x, y (move, y -1 forward), turn, dyaw, run, a (interact pressed) }. */
export function step(G, inp, dt) {
    if (G.won) return;
    G.t += dt;
    if (G.portal > 0) {
        G.portal += dt;
        if (G.portal >= ENDING_SECONDS) { G.won = true; G.events.push({ type: 'won' }); }
    }
    const p = G.p, C = G.city;
    p.yaw += (inp.dyaw || 0) + (inp.turn || 0) * PLAYER.turn * dt;
    if (p.yaw > Math.PI) p.yaw -= Math.PI * 2; else if (p.yaw < -Math.PI) p.yaw += Math.PI * 2;

    // walking
    let mx = inp.x || 0, mz = inp.y || 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    if (len > 0.01) {
        const speed = (inp.run ? PLAYER.run : PLAYER.walk) * (p.air ? 0.4 : 1);
        const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);        // forward
        const rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);         // right
        const dx = (rx * mx - fx * mz) * speed * dt, dz = (rz * mx - fz * mz) * speed * dt;
        const x0 = p.x, z0 = p.z, L0 = p.L;
        tryMove(C, G, p, p.x + dx, p.z);
        tryMove(C, G, p, p.x, p.z + dz);
        const moved = Math.hypot(p.x - x0, p.z - z0);
        p.dist += moved;
        if (!p.air) {
            p.stepAcc += moved;
            if (p.stepAcc > (inp.run ? 0.95 : 0.72)) {
                p.stepAcc = 0;
                G.events.push({ type: 'step', surf: surfaceAt(C, p.L, p.x, p.z), run: !!inp.run });
            }
        }
        if (p.L !== L0) G.events.push({ type: 'level', L: p.L, from: L0 });
        visit(G);
    }

    // standing, stairs, falling through a rotten floor
    if (!p.air) {
        if (overHole(C, p)) {
            p.air = true; p.vy = 0; p.L -= 1; G.falls++;
            G.events.push({ type: 'fall' });
        } else {
            p.y = groundAt(C, p.L, p.x, p.z);
        }
    }
    if (p.air) {
        p.vy -= PLAYER.gravity * dt;
        p.y += p.vy * dt;
        const g = groundAt(C, p.L, p.x, p.z);
        if (p.y <= g) { p.y = g; p.air = false; G.events.push({ type: 'land', v: -p.vy }); p.vy = 0; }
    }

    if (inp.a) interact(G);
}

function visit(G) {
    const p = G.p;
    const t = tileAt(G.city, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE));
    const b = t?.b;
    if (b && !G.visitedSet.has(b.id)) {
        G.visitedSet.add(b.id); G.visited.push(b.id);
        G.events.push({ type: 'enter', b: b.id, name: b.name, kind: b.type });
    }
}

// ------------------------------------------------------------------ interaction

/** Everything you could reach out and use right now, best first: [{ kind, id, x, z, score, ... }]. */
export function reachable(G) {
    const p = G.p, C = G.city, out = [];
    const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const consider = (o) => {
        const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
        if (d > PLAYER.reach) return;
        const cos = d < 0.35 ? 1 : (dx * fx + dz * fz) / d;
        if (cos < PLAYER.reachCos) return;
        out.push({ ...o, score: cos * 1.5 - d * 0.6 });
    };
    const tx = Math.floor(p.x / TILE), tz = Math.floor(p.z / TILE);
    const here = tileAt(C, p.L, tx, tz);
    // things in this building on this level (and the story's)
    const bids = new Set();
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const t = tileAt(C, p.L, tx + dx, tz + dz);
        if (t?.b) bids.add(t.b.id);
    }
    if (here?.b) bids.add(here.b.id);
    for (const id of bids) {
        const I = interiorOf(C, C.buildings[id]);
        for (const t of I.things) if (t.L === p.L && !G.gotSet.has(t.id)) consider(t);
    }
    for (const t of G.story.things) if (t.L === p.L && bids.has(t.b) && !G.gotSet.has(t.id)) consider(t);
    if (p.L === 0 && !here?.b) for (const o of G.outdoor) if (Math.abs(o.x - p.x) < 3 && Math.abs(o.z - p.z) < 3) consider({ kind: o.k, id: o.id, x: o.x, z: o.z });
    // locked doors and gates around you
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dir = 0; dir < 4; dir++) {
        const lk = edgeLockAt(C, p.L, tx + dx, tz + dz, dir);
        if (!lk || G.openSet.has(lk)) continue;
        const ex = (tx + dx + 0.5 + DIRS[dir][0] * 0.5) * TILE, ez = (tz + dz + 0.5 + DIRS[dir][1] * 0.5) * TILE;
        consider({ kind: 'door', id: `door:${lk}:${tx + dx},${tz + dz},${dir}`, lock: lk, x: ex, z: ez });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
}

function say(G, text, extra = {}) { G.events.push({ type: 'msg', text, ...extra }); }

function collect(G, id) { if (!G.gotSet.has(id)) { G.gotSet.add(id); G.got.push(id); } }

export function interact(G) {
    const o = reachable(G)[0];
    if (!o) return false;
    const C = G.city, S = G.story;
    switch (o.kind) {
        case 'diary': {
            collect(G, o.id);
            G.read.push(o.k);
            const c = WHO[o.who];
            G.events.push({ type: 'diary', k: o.k, who: o.who, name: c.name, clue: S.clues[o.k] ?? null, last: o.k === DIARIES - 1 });
            break;
        }
        case 'item': {
            collect(G, o.id);
            G.items.push(o.item);
            G.events.push({ type: 'item', item: o.item, name: ITEMS[o.item].name, text: ITEMS[o.item].text });
            break;
        }
        case 'fragment': case 'newsbox': case 'phone': case 'radio': {
            const first = !G.gotSet.has(o.id);
            if (o.kind !== 'radio') collect(G, o.id);
            const n = hashId(o.id) % FRAGMENTS.length;
            G.events.push({ type: o.kind === 'radio' ? 'radio' : 'fragment', id: o.id, text: FRAGMENTS[n], first, via: o.kind });
            if (o.kind === 'radio') collect(G, o.id);
            break;
        }
        case 'vending': {
            G.cans++;
            G.events.push({ type: 'vend', id: o.id, text: VENDING[(G.cans + hashId(o.id)) % VENDING.length] });
            break;
        }
        case 'door': {
            const kind = lockKind(C, o.lock), L = LOCKS[kind];
            if (G.items.includes(L.item)) {
                G.openSet.add(o.lock); G.open.push(o.lock);
                G.events.push({ type: 'unlock', lock: o.lock, kind, text: L.done });
            } else G.events.push({ type: 'locked', lock: o.lock, kind, text: L.need });
            break;
        }
        case 'breaker': {
            if (G.power) say(G, 'The breaker hums under your hand. Hall C has power.');
            else if (G.items.includes('fuse')) {
                G.power = true;
                G.events.push({ type: 'power', text: 'You seat the ceramic fuse and throw the breaker. Somewhere above, enormous relays slam closed, one after another, and the hall floods with light.' });
            } else say(G, 'A main breaker with an empty fuse cradle. It wants a big ceramic fuse.');
            break;
        }
        case 'dial': {
            if (!G.power) { say(G, 'The dial turns, loose and dead. The console has no power.'); break; }
            G.dials[o.i] = (G.dials[o.i] % 9) + 1;
            G.events.push({ type: 'dial', i: o.i, v: G.dials[o.i] });
            break;
        }
        case 'lever': {
            if (!G.power) { say(G, 'The conduit lever will not move. The console has no power.'); break; }
            const color = S.leverColors[o.i];
            if (G.levers.includes(color)) { say(G, `The ${color} conduit is already live.`); break; }
            G.levers.push(color);
            const ok = G.levers.every((c, i) => c === S.order[i]);
            if (!ok) { G.levers = []; G.events.push({ type: 'leverReset', color, text: `The ${color} conduit spits blue sparks and every lever slams back up. Wrong order.` }); }
            else G.events.push({ type: 'lever', i: o.i, color, n: G.levers.length });
            break;
        }
        case 'master': {
            if (G.portal > 0) break;
            if (!G.power) { say(G, 'The master switch is dead. Hall C has no power.'); break; }
            const dialsOk = G.dials.every((v, i) => v === S.dials[i]);
            const leversOk = G.levers.length === 4;
            if (dialsOk && leversOk) { G.portal = 1e-6; G.events.push({ type: 'portal' }); }
            else G.events.push({ type: 'fail', text: !leversOk ? 'The ring groans and goes dark again. The conduits are not all live.' : 'The ring howls, a long wrong note, and dies. The dials are not right.' });
            break;
        }
        default: return false;
    }
    return true;
}

function hashId(id) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; }

// ------------------------------------------------------------------ what next (the compass)

/** The compass's target: the next thing the story wants you to find. { id, kind, x, z, L, b, label } */
export function objective(G) {
    const S = G.story, C = G.city;
    for (const id of S.sequence) {
        if (G.gotSet.has(id)) continue;
        const t = G.thingById.get(id);
        const who = t.kind === 'diary' ? WHO[t.who] : null;
        return { id, kind: t.kind, x: t.x, z: t.z, L: t.L, b: t.b, label: who ? `${who.name}'s diary` : ITEMS[t.item].name };
    }
    const lab = C.lab;
    if (!G.openSet.has('gate')) {
        const g = lab.gate, d = DIRS[g.dir];
        return { id: 'gate', kind: 'gate', x: (g.x + 1 + d[0] * 0.5) * TILE, z: (g.z + 1 + d[1] * 0.5) * TILE, L: 0, b: -1, label: 'The Threshold Laboratory gate' };
    }
    const hall = C.buildings[lab.hall];
    if (!G.openSet.has(`b${hall.id}`)) {
        const e = hall.entrances[0];
        return { id: 'hall', kind: 'door', x: (hall.x0 + e.x + 0.5 + DIRS[e.dir][0] * 0.5) * TILE, z: (hall.z0 + e.z + 0.5 + DIRS[e.dir][1] * 0.5) * TILE, L: 0, b: -1, label: 'Hall C' };
    }
    if (!G.power) { const t = G.thingById.get(interiorOf(C, hall).things.find((t) => t.kind === 'breaker').id); return { ...t, label: 'The main breaker' }; }
    const m = G.thingById.get('master');
    return { ...m, label: 'The resonance console' };
}

// ------------------------------------------------------------------ save

export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const G = { ...JSON.parse(JSON.stringify(d)), events: [] };
    attach(G);
    return G;
}

/** Progress numbers for the journal and the title screen. */
export function progress(G) {
    const B = G.city.buildings;
    return {
        diaries: G.story.things.filter((t) => t.kind === 'diary' && G.gotSet.has(t.id)).length,
        buildings: G.visited.length, total: B.length,
        fragments: G.got.filter((id) => /^f\d|^nb|^ph|^r\d/.test(id)).length,
        cans: G.cans, km: G.p.dist / 1000,
    };
}

export { outdoorFree };
