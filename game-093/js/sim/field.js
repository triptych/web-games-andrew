// Free movement: walking, collision, villagers, wandering monsters, encounters, map exits and everything the confirm button does.

import { WALKABLE } from './world/tiles.js';
import { LOCS, ZONE_KEYS } from './world/locations.js';
import { anchorPos, refreshActors, getMap } from './world/maps.js';
import { BEATS, BOSSES, ACTORS } from './data/story.js';
import { ARCS, TALK, THEME_TALK } from './data/npcdata.js';
import { ITEMS, shopStock } from './data/items.js';
import { CHARS } from './data/classes.js';
import { WALK, PLAYER_R, ENCOUNTER } from '../config.js';
import { curMap, enterMap, party } from './state.js';
import { startScene, beginBattle } from './scene.js';
import { makeFormation } from './battle.js';
import { addItem, removeItem, count, avgLevel, fullHeal, memberStats } from './party.js';
import * as Q from './quests.js';
import { townNpcs } from './npcs.js';

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LOCK_ENTRY = { spire: 'spire_open', maw: 'open_maw' };
const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));

// ------------------------------------------------------------------ collision
export function walkableAt(G, map, tx, ty, fromH) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return false;
    const i = ty * map.w + tx;
    if (!WALKABLE[map.tile[i]] || map.blk[i]) return false;
    if (map.lockIdx && map.lockIdx[i]) { const lk = map.locks[map.lockIdx[i]]; if (!G.flags[lk.flag]) return false; }
    if (Math.abs(map.hgt[i] - fromH) > 1) return false;
    return true;
}
/** A standing sprite leans back and its head overlaps whatever is behind it, so keep a little further from the foot of a cliff
 *  (walkable ground that is too high to step up to) than from a wall. */
const CLIFF_MARGIN = 0.2;     // PLAYER_R + this stays under half a tile, so the middle of every tile is still standable
function nearCliff(map, x, y, fromH) {
    if (map.kind !== 'town') return false;
    const m = PLAYER_R + CLIFF_MARGIN;
    for (const [dx, dy] of [[-m, -m], [m, -m], [-m, m], [m, m]]) {
        const tx = Math.floor(x + dx), ty = Math.floor(y + dy);
        if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
        const i = ty * map.w + tx;
        if (WALKABLE[map.tile[i]] && !map.blk[i] && map.hgt[i] - fromH > 1) return true;
    }
    return false;
}
function canStand(G, map, x, y, fromH, r = PLAYER_R) {
    return !nearCliff(map, x, y, fromH) && walkableAt(G, map, Math.floor(x - r), Math.floor(y - r), fromH) && walkableAt(G, map, Math.floor(x + r), Math.floor(y - r), fromH)
        && walkableAt(G, map, Math.floor(x - r), Math.floor(y + r), fromH) && walkableAt(G, map, Math.floor(x + r), Math.floor(y + r), fromH);
}
const hAt = (map, x, y) => map.hgt[Math.max(0, Math.min(map.h - 1, Math.floor(y))) * map.w + Math.max(0, Math.min(map.w - 1, Math.floor(x)))];

function npcBlocks(map, x, y, self, fx = null, fy = null) {
    for (const n of map.npcs) {
        if (n === self || n.kind === 'pet') continue;
        const r = n.kind === 'boss' ? 0.9 * Math.min(1.6, n.scale || 1) : 0.42;
        const d = Math.hypot(n.x - x, n.y - y);
        // already overlapping? stepping away is always allowed
        if (d < r && !(fx !== null && d >= Math.hypot(n.x - fx, n.y - fy))) return true;
    }
    return false;
}

/** Walk into a villager and they shuffle aside (never a boss), so nobody can wall a street off. True if the way is now clear. */
function shove(G, map, x, y, dx, dy) {
    const fh = hAt(map, G.px, G.py);
    for (const n of map.npcs) {
        if (n.kind === 'pet' || n.kind === 'boss') continue;
        if (Math.hypot(n.x - x, n.y - y) >= 0.42) continue;
        const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        let moved = false;
        // shuffle ahead of the walker, or failing that to either side
        for (const [ax, ay] of [[ux, uy], [-uy, ux], [uy, -ux]]) {
            const nx = n.x + ax * 0.12, ny = n.y + ay * 0.12;
            if (!walkableAt(G, map, Math.floor(nx), Math.floor(ny), fh) || npcBlocks(map, nx, ny, n)) continue;
            n.x = nx; n.y = ny; moved = true; break;
        }
        if (!moved) return false;
        n.hx = n.x; n.hy = n.y; n.state = 'idle'; n.timer = 1.2; n.moving = false;
    }
    return !npcBlocks(map, x, y);
}

export function movePlayer(G, inp, dt) {
    const map = curMap(G);
    let vx = inp.x, vy = inp.y;
    const len = Math.hypot(vx, vy);
    if (len < 0.05) { G.moving = false; return 0; }
    if (len > 1) { vx /= len; vy /= len; }
    const speed = WALK[map.kind] * (inp.run ? 1.35 : 1);
    const fromH = hAt(map, G.px, G.py);
    let moved = 0;
    const nx = G.px + vx * speed * dt, ny = G.py + vy * speed * dt;
    if (canStand(G, map, nx, G.py, fromH) && (!npcBlocks(map, nx, G.py, null, G.px, G.py) || shove(G, map, nx, G.py, nx - G.px, 0))) { moved += Math.abs(nx - G.px); G.px = nx; }
    else if (map.lockIdx) lockTouch(G, map, nx, G.py);
    if (canStand(G, map, G.px, ny, fromH) && (!npcBlocks(map, G.px, ny, null, G.px, G.py) || shove(G, map, G.px, ny, 0, ny - G.py))) { moved += Math.abs(ny - G.py); G.py = ny; }
    else if (map.lockIdx) lockTouch(G, map, G.px, ny);
    G.dir = dirOf(vx, vy);
    G.moving = moved > 0;
    if (moved > 0) {
        G.anim += moved;
        const t = G.trail[0];
        if (!t || Math.hypot(t[0] - G.px, t[1] - G.py) > 0.1) { G.trail.unshift([G.px, G.py, G.dir]); if (G.trail.length > 200) G.trail.length = 200; }
    }
    return moved;
}

function lockTouch(G, map, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
    const li = map.lockIdx[ty * map.w + tx];
    if (li && !G.flags[map.locks[li].flag] && G.t - G.lockHint > 3) { G.lockHint = G.t; G.events.push({ type: 'toast', text: map.locks[li].label }); }
}

// ------------------------------------------------------------------ villagers and monsters
export function updateNpcs(G, dt) {
    const map = curMap(G);
    for (const n of map.npcs) {
        if (n.freeze > 0) { n.freeze -= dt; n.moving = false; continue; }
        if (!n.wander) { n.moving = false; continue; }
        n.timer -= dt;
        if (n.state === 'idle' && n.timer <= 0) {
            const a = ((G.t * 7.3 + n.hx * 13.1 + n.hy * 5.7) % 1 + 1) % 1 * Math.PI * 2, r = n.wander * (((G.t * 3.1 + n.hy * 1.7) % 1 + 1) % 1);
            n.tx = n.hx + Math.cos(a) * r; n.ty = n.hy + Math.sin(a) * r;
            const fh = hAt(map, n.x, n.y);
            if (walkableAt(G, map, Math.floor(n.tx), Math.floor(n.ty), fh) && Math.hypot(n.tx - G.px, n.ty - G.py) > 1.0) n.state = 'walk';
            else n.timer = 0.5;
        } else if (n.state === 'walk') {
            const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
            if (d < 0.1) { n.state = 'idle'; n.timer = 1 + (((G.t * 5.3 + n.hx) % 1 + 1) % 1) * 3; n.moving = false; continue; }
            const sp = 1.15 * n.speed * dt, nx = n.x + dx / d * sp, ny = n.y + dy / d * sp;
            const fh = hAt(map, n.x, n.y);
            if (walkableAt(G, map, Math.floor(nx), Math.floor(ny), fh) && Math.hypot(nx - G.px, ny - G.py) > 0.7) { n.x = nx; n.y = ny; n.dir = dirOf(dx, dy); n.moving = true; }
            else { n.state = 'idle'; n.timer = 0.6; n.moving = false; }
        }
    }
}

function losClear(G, map, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 1; i < n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (!WALKABLE[map.tile[ty * map.w + tx]]) return false;
    }
    return true;
}

export function updateMobs(G, dt) {
    const map = curMap(G);
    if (!map.mobs.length || G.pending) return null;
    let hit = null;
    for (const m of map.mobs) {
        if (m.stun > 0) { m.stun -= dt; continue; }
        const dx = G.px - m.x, dy = G.py - m.y, d = Math.hypot(dx, dy);
        if (m.state !== 'chase' && d < ENCOUNTER.dungeonNotice && losClear(G, map, m.x, m.y, G.px, G.py)) { m.state = 'chase'; m.alert = 0.35; G.events.push({ type: 'alert', id: m.id }); }
        let tx = null, ty = null, sp = 0;
        if (m.alert > 0) { m.alert -= dt; continue; }
        if (m.state === 'chase') {
            if (d > 9.5) m.state = 'return';
            tx = G.px; ty = G.py; sp = ENCOUNTER.dungeonChase * 0.78;
        } else if (m.state === 'return') {
            tx = m.hx; ty = m.hy; sp = 2.2;
            if (Math.hypot(m.hx - m.x, m.hy - m.y) < 0.3) m.state = 'wander';
        } else {
            m.t -= dt;
            if (m.t <= 0) { const a = ((G.t * 3.7 + m.hx * 7.1) % 1) * Math.PI * 2; m.tx = m.hx + Math.cos(a) * 2.2; m.ty = m.hy + Math.sin(a) * 2.2; m.t = 2 + ((G.t * 1.3 + m.hy) % 1) * 2; m.walking = true; }
            if (m.walking) { tx = m.tx; ty = m.ty; sp = m.speed; if (Math.hypot(m.tx - m.x, m.ty - m.y) < 0.2) m.walking = false; }
        }
        if (tx !== null) {
            const ddx = tx - m.x, ddy = ty - m.y, dd = Math.hypot(ddx, ddy) || 1;
            const nx = m.x + ddx / dd * sp * dt, ny = m.y + ddy / dd * sp * dt, fh = hAt(map, m.x, m.y);
            if (walkableAt(G, map, Math.floor(nx), Math.floor(m.y), fh) && !map.blk[Math.floor(m.y) * map.w + Math.floor(nx)]) m.x = nx;
            if (walkableAt(G, map, Math.floor(m.x), Math.floor(ny), fh) && !map.blk[Math.floor(ny) * map.w + Math.floor(m.x)]) m.y = ny;
            m.dir = dirOf(ddx, ddy); m.moving = true;
        } else m.moving = false;
        if (d < 0.78 && !hit) hit = m;
    }
    return hit;
}

// ------------------------------------------------------------------ exits, encounters, triggers
export function checkExits(G) {
    const map = curMap(G);
    const tx = Math.floor(G.px), ty = Math.floor(G.py);
    for (const e of map.exits) {
        const w = e.w || 1, h = e.h || 1;
        if (tx < e.x || tx >= e.x + w || ty < e.y || ty >= e.y + h) continue;
        if (map.kind === 'over') {
            const L = LOCS[e.to];
            const need = LOCK_ENTRY[e.to];
            if (need && !G.flags[need]) {
                G.py += 1.4; G.events.push({ type: 'toast', text: e.to === 'spire' ? 'The Spire is sealed. It will open when the six shards are together.' : 'The crater is sealed by ancient flame. It will open when the world is saved.' });
                return;
            }
            const dest = getMap(G, e.to);
            G.warp = { to: e.to, x: dest.spawn[0], y: dest.spawn[1], dir: 'up', t: 0 };
        } else {
            const L = LOCS[map.id];
            G.warp = { to: 'over', x: L.x + 0.5, y: L.y + 2.5, dir: 'down', t: 0 };
        }
        G.events.push({ type: 'fade', dir: 'out', t: 0.35 });
        return;
    }
}

export function checkEncounter(G, moved) {
    const map = curMap(G);
    if (map.kind !== 'over' || moved <= 0) return;
    const i = Math.floor(G.py) * map.w + Math.floor(G.px);
    G.encDist += moved * (map.road[i] ? 0.45 : 1);
    if (G.encDist < G.encNext) return;
    G.encDist = 0; G.encNext = G.rng.range(ENCOUNTER.min, ENCOUNTER.max);
    if (Object.values(LOCS).some((L) => Math.hypot(L.x - G.px, L.y - G.py) < 4.5)) return;
    const zone = ZONE_KEYS[map.zone[i]];
    const spec = { enemies: makeFormation(G, zone), bg: zone, zone };
    G.pending = { spec, t: 0.9, kind: 'random' };
    G.events.push({ type: 'encounter', boss: false });
}

export function checkBeat(G) {
    const b = BEATS[G.story.i];
    if (!b || G.scene || G.pending || G.warp) return;
    const t = b.trig, map = curMap(G);
    let fire = false;
    if (t.t === 'start') fire = true;
    else if (t.t === 'enter') fire = G.map === t.map;
    else if (t.t === 'flag') fire = !!G.flags[t.flag];
    else if (t.t === 'near' && G.map === t.map) { const p = anchorPos(map, t.anchor); fire = !!p && Math.hypot(p[0] - G.px, p[1] - G.py) < t.r; }
    if (fire) startScene(G, b.scene, { beat: b.id });
}

const OPTIONAL = {
    maw: { anchor: 'boss', r: 3.6, flag: 'boss_maw', scene: [
        { look: 'boss' }, { shake: 0.8 }, { music: 'silence' },
        'Ignaroth: A SPARK. IN MY HOUSE. HOW... PRECIOUS.',
        { battle: { enemies: [{ kind: 'pyrelord', lvl: 50 }], boss: true, bg: 'maw', music: 'boss' } },
        { flag: 'boss_maw' }, { flash: 'white' }, { music: 'victory' },
        '*: The Pyrelord gutters out like a snuffed candle. In the ash glows a single, perfect ember.',
        { give: 'c_dawn' }, { give: 'elixir', n: 2 },
        'Kael: That is everything. I think we can go home.',
    ] },
};
export function checkOptional(G) {
    const o = OPTIONAL[G.map];
    if (!o || G.flags[o.flag] || G.scene || G.pending || !G.flags.game_complete) return;
    const p = anchorPos(curMap(G), o.anchor);
    if (p && Math.hypot(p[0] - G.px, p[1] - G.py) < o.r) startScene(G, o.scene);
}

// ------------------------------------------------------------------ interaction
export function nearestInteractable(G) {
    const map = curMap(G), f = DIRV[G.dir] || [0, 1];
    let best = null, bs = 1e9;
    const consider = (kind, ref, x, y, reach = 1.35) => {
        const dx = x - G.px, dy = y - G.py, d = Math.hypot(dx, dy);
        if (d > reach) return;
        const front = d < 0.001 ? 1 : (dx * f[0] + dy * f[1]) / d;
        if (front < -0.35 && d > 0.8) return;
        const score = d - front * 0.35;
        if (score < bs) { bs = score; best = { kind, ref }; }
    };
    for (const n of map.npcs) consider('npc', n, n.x, n.y, n.kind === 'boss' ? 2.6 : 1.4);
    for (const p of map.props) {
        if (p.type === 'chest' && !p.open) consider('chest', p, p.x + 0.5, p.y + 0.5);
        else if (p.type === 'save') consider('save', p, p.x + 0.5, p.y + 0.5, 1.6);
        else if (p.type === 'crack' && !p.broken) consider('crack', p, p.x + 0.5, p.y + 0.5, 1.5);
        else if (p.type === 'spark' && !p.taken) consider('spark', p, p.x + 0.5, p.y + 0.5, 1.4);
        else if (p.type === 'board') consider('board', p, p.x + 0.5, p.y + 0.5, 1.6);
        else if (p.type === 'shrine') consider('shrine', p, p.x + 2, p.y + 3.4, 2.2);
    }
    for (const b of map.buildings || []) consider('door', b, b.door[0] + 0.5, b.door[1] - 0.2, 1.3);
    return best;
}

export function interact(G) {
    if (G.scene || G.pending || G.warp) return false;
    const t = nearestInteractable(G);
    if (!t) return false;
    const map = curMap(G);
    switch (t.kind) {
        case 'npc': talk(G, t.ref); return true;
        case 'chest': openChest(G, t.ref); return true;
        case 'save': startScene(G, [{ heal: true }, { fn: (g) => g.events.push({ type: 'save_point' }) }, '*: The crystal washes over the party. Wounds close; the light remembers where you stand.']); return true;
        case 'crack': breakCrack(G, t.ref); return true;
        case 'spark': { const p = t.ref; p.taken = true; addItem(G, p.item, 1); G.events.push({ type: 'get', item: p.item, n: 1, key: true }); return true; }
        case 'board': G.mode = 'board'; G.board = { town: G.map }; G.events.push({ type: 'board', town: G.map }); Q.ensureBoard(G, G.map); return true;
        case 'shrine': startScene(G, ['*: The Dawn Shrine stands cold and silent, its crystal pedestal split down the middle.', ...(G.flags.game_complete ? ['*: A small new flame burns in the pedestal. Nine hearts\' worth of warmth.'] : [])]); return true;
        case 'door': enterDoor(G, t.ref); return true;
    }
    return false;
}

function enterDoor(G, b) {
    const town = LOCS[G.map];
    if (b.kind === 'inn') {
        const cost = Math.round(10 + avgLevel(G) * 5);
        startScene(G, [`Innkeeper: Welcome! A bed for the night is ${cost} gold. Hot bath, hot soup, no questions asked.`, { choice: [
            { text: `Rest (${cost} gold)`, do: [{ fn: (g) => { if (g.gold >= cost) { g.gold -= cost; g.events.push({ type: 'rest' }); } else g.events.push({ type: 'toast', text: 'Not enough gold.' }); } }] },
            { text: 'Not now', do: ['Innkeeper: Come back when you\'re tired.'] },
        ] }]);
    } else if (b.kind === 'shop' || b.kind === 'gear') {
        const stock = shopStock(b.kind === 'shop' ? 'item' : 'gear', town.tier, G.party.active, CHARS);
        G.mode = 'shop'; G.shop = { kind: b.kind, town: G.map, stock, name: b.kind === 'shop' ? 'General Store' : 'Smithy & Armoury' };
        G.events.push({ type: 'shop', kind: b.kind });
    } else if (b.kind === 'guild') {
        startScene(G, ['Guildmaster: The Guild keeps the notice board outside. Take a job, bring back proof, and we pay on the spot. Mind you, it\'s only fair work.', ...(G.flags.game_complete ? ['Guildmaster: And we have never been busier than since the sun came back.'] : [])]);
    } else {
        startScene(G, houseLines(G, b));
    }
}

function houseLines(G, b) {
    const k = b.seed % 6;
    const key = 'house:' + b.id;
    const rumor = BEATS[G.story.i]?.hint || 'The world is quiet. For now.';
    const L = [
        ['*: You knock. A stove is crackling inside, but nobody answers.'],
        [`Resident: Oh! A traveller. I've little to offer but a rumour. ${rumor}`],
        ['Resident: We keep to ourselves these days. Safe travels.'],
        ['*: A cat watches you through the window and yawns pointedly.'],
        [`Resident: You look like you could use this.`, ...(G.talk[key] ? ['Resident: ...that was the last one, I promise.'] : [{ give: 'potion' }, { fn: (g) => { g.talk[key] = 1; } }])],
        [`Resident: ${rumor}`],
    ][k];
    return L;
}

function openChest(G, c) {
    const st = G.mapState[G.map] || (G.mapState[G.map] = {});
    if (c.locked) {
        if (!G.party.active.includes(c.locked)) { startScene(G, ['*: The lock is a delicate, many-pinned thing. Someone nimble-fingered could pick it... perhaps Mira.']); return; }
        startScene(G, ['Mira: Pfft. Child\'s play. Give me ten seconds and a hairpin.', { fn: (g) => finishChest(g, c, st) }]);
        return;
    }
    finishChest(G, c, st);
}
function finishChest(G, c, st) {
    c.open = true;
    (st.opened || (st.opened = {}))[c.id] = 1;
    G.stats.chests++;
    G.events.push({ type: 'chest', id: c.id });
    if (c.loot.gold) { G.gold += c.loot.gold; G.events.push({ type: 'get', gold: c.loot.gold }); }
    else { addItem(G, c.loot.item, c.loot.n || 1); G.events.push({ type: 'get', item: c.loot.item, n: c.loot.n || 1 }); }
}
function breakCrack(G, p) {
    if (!G.party.active.includes('brom')) { startScene(G, ['*: The wall here is cracked and hollow-sounding. Something with a very big axe could break through.']); return; }
    startScene(G, ['Brom: Stand back, lads. I do my best work on walls.', { shake: 1 }, { flash: 'white' }, { fn: (g) => {
        const map = curMap(g); p.broken = true; map.blk[p.y * map.w + p.x] = 0;
        (g.mapState[g.map] || (g.mapState[g.map] = {})).cracked = { ...(g.mapState[g.map]?.cracked || {}), [p.id]: 1 };
        g.events.push({ type: 'crack', id: p.id });
    } }]);
}

// ------------------------------------------------------------------ talking
const DEFAULT_STORY = {
    aldric: ['Elder Aldric: The festival can wait. The sky will not. Find Thorne in the Whispering Woods, north of the village.'],
    lyra: ['Lyra: Come on, slowpoke!'],
    thorne: ['Thorne: Not now. The woods are listening.'],
    elara: ['Sister Elara: Please — help us first.'], brom: ['Brom: Not now, lad!'], mira: ['Mira: Catch me if you can.'],
    zephyr: ['Zephyr: One moment; I appear to have mislaid the present.'], garrick: ['Garrick: Halt. State your business.'],
};

function talk(G, n) {
    const map = curMap(G);
    const b = BEATS[G.story.i];
    n.freeze = 2; // villagers face you and stand still while you speak
    const dx = G.px - n.x, dy = G.py - n.y; n.dir = dirOf(dx, dy);
    G.events.push({ type: 'talk_start', id: n.id });
    if (n.kind === 'story') {
        if (b && b.trig.t === 'talk' && b.trig.npc === n.id) { startScene(G, b.scene, { beat: b.id }); return; }
        const lines = DEFAULT_STORY[n.id];
        if (n.id === 'aldric' && G.flags.game_complete) { startScene(G, ['Elder Aldric: Look at that sky. Every morning, I still cannot believe it.']); return; }
        startScene(G, lines || ['...']);
        return;
    }
    if (n.kind === 'boss') { startScene(G, ['*: It regards you with something that is not quite hatred, and not quite sleep.']); return; }
    villagerScene(G, n);
}

function courierTarget(G, n) {
    return G.quests.active.find((q) => q.p.type === 'courier' && q.p.npcId === n.id && !q.delivered);
}

function villagerScene(G, n) {
    const rumor = BEATS[G.story.i]?.hint || 'the world is quiet';
    const cmds = [];
    const c = courierTarget(G, n);
    if (c) {
        cmds.push(`${n.name}: A letter, for me? From ${LOCS[c.town].name}? ...Oh. Oh, thank you.`);
        cmds.push({ fn: (g) => {
            removeItem(g, c.p.item, 1); c.delivered = true;
            g.events.push({ type: 'toast', text: 'Letter delivered.' });
            if (!c.arc) Q.complete(g, c);
        } });
        if (!c.arc) cmds.push(`${n.name}: Here — for the trouble of the road.`);
        else cmds.push(`${n.name}: Tell them I said thank you.`);
        startScene(G, cmds); return;
    }
    if (n.arc) {
        const arc = ARCS.find((a) => a.id === n.arc);
        const q = Q.arcQuest(G, n, G.map);
        if (!q) {
            cmds.push(`${n.name}: You've done more for me than anyone. ${arc.title} will be a story I tell for years.`);
        } else if (q.state === 'avail') {
            const stage = arc.stages[q.arcStage];
            if (q.arcStage === 0) cmds.push(`${n.name}: Excuse me — you look like someone who helps people. I'm ${arc.who}.`);
            for (const l of stage.say) cmds.push(Q.fillArcText(G, l, n, q, G.map));
            cmds.push({ choice: [
                { text: `Accept: ${q.text}`, do: [{ fn: (g) => Q.accept(g, q) }, `${n.name}: Thank you. I'll be here.`] },
                { text: 'Not right now', do: [`${n.name}: Of course. Another time.`] },
            ] });
        } else {
            const st = Q.status(G, q);
            if (st.ready) {
                const stage = arc.stages[q.arcStage];
                for (const l of stage.done) cmds.push(Q.fillArcText(G, l, n, q, G.map));
                cmds.push({ fn: (g) => { if (Q.complete(g, q)) { g.quests.arcStage[n.id] = q.arcStage + 1; if (q.arcStage === 2) g.quests.arcDone[n.id] = 1; } } });
            } else cmds.push(`${n.name}: ${st.need > 1 ? `How goes it? ${st.have}/${st.need} so far.` : `Any luck? ${q.text}`}`);
        }
        startScene(G, cmds); return;
    }
    // idle chatter
    G.talk[n.id] = (G.talk[n.id] || 0) + 1;
    const L = LOCS[G.map];
    const bank = [...TALK[n.personality], ...(THEME_TALK[L.theme] || [])];
    const pick = bank[(G.talk[n.id] + (n.id.length * 7)) % bank.length];
    cmds.push(`${n.name}: ${pick.replace(/\{town\}/g, L.name).replace(/\{rumor\}/g, rumor)}`);
    startScene(G, cmds);
}

// ------------------------------------------------------------------ shops, boards, inns (called from act)
export function rest(G) {
    for (const id of G.party.active.concat(G.party.reserve)) fullHeal(G.party.members[id]);
    G.clock = (G.clock + 0.35) % 1;
}

export function buy(G, id, n = 1) {
    const it = ITEMS[id];
    if (!it || !G.shop || !G.shop.stock.includes(id)) return false;
    const cost = it.price * n;
    if (G.gold < cost) return false;
    G.gold -= cost; addItem(G, id, n);
    return true;
}
export function sell(G, id, n = 1) {
    const it = ITEMS[id];
    if (!it || it.type === 'key' || !(it.price > 0) || count(G, id) < n) return false;
    G.gold += Math.floor(it.price / 2) * n; removeItem(G, id, n);
    return true;
}
export { talk, DIRV };
