// Procedural dungeon floors. One generator, three looks:
//   cellar — rectangular rooms, 2-wide corridors, pillar halls
//   jam    — rounded rooms, sticky jam pools (walkable, slow), wider halls
//   core   — blobby caves with lakes of boiling fruit punch (impassable)
// Every floor is flood-filled from the entrance and regenerated (next attempt seed) unless every
// room is reachable. Stairs down go in the room farthest from the entrance; boss floors put the
// boss in a big arena at the far end instead.

import { RNG, sub } from '../rng.js';
import { T, walkable, makeGrid, DIRS8, DIRS4 } from './tiles.js';
import { ACTS, actOf, isBossFloor } from './data/story.js';
import { MONSTERS } from './data/monsters.js';

export function generateFloor(seed, floor) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const map = tryGenerate(sub(seed, 'floor', floor, attempt), floor);
        if (map) { map.attempt = attempt; return map; }
    }
    throw new Error(`floor ${floor}: generator failed 40 times`);
}

function tryGenerate(seed, floor) {
    const rng = new RNG(seed);
    const act = actOf(floor);
    const theme = act.theme;
    const boss = isBossFloor(floor);
    const inAct = (floor - 1) % 4;
    const W = 54 + inAct * 4 + (theme === 'core' ? 6 : 0), H = W - 4;
    const g = makeGrid(W, H);
    const rooms = [];

    const overlaps = (r) => rooms.some((o) => r.x - 3 < o.x + o.w && r.x + r.w + 3 > o.x && r.y - 3 < o.y + o.h && r.y + r.h + 3 > o.y);
    // Boss arena first, in a corner, so it can be the far end of the floor.
    if (boss) {
        const bw = 18, bh = 16;
        const corner = rng.int(0, 3);
        const r = { x: corner & 1 ? W - bw - 3 : 3, y: corner & 2 ? H - bh - 3 : 3, w: bw, h: bh, boss: true };
        rooms.push(r);
    }
    const target = 11 + inAct + (theme === 'core' ? 2 : 0);
    for (let i = 0; i < 400 && rooms.length < target; i++) {
        const w = rng.int(6, theme === 'core' ? 14 : 12), h = rng.int(6, theme === 'core' ? 13 : 11);
        const r = { x: rng.int(2, W - w - 3), y: rng.int(2, H - h - 3), w, h };
        if (!overlaps(r)) rooms.push(r);
    }
    if (rooms.length < 7) return null;

    // Start room: farthest from the boss arena (or simply the first non-boss room).
    const cx = (r) => r.x + (r.w >> 1), cy = (r) => r.y + (r.h >> 1);
    let startIdx = boss ? 1 : 0;
    if (boss) {
        let best = -1;
        for (let i = 1; i < rooms.length; i++) {
            const d = Math.hypot(cx(rooms[i]) - cx(rooms[0]), cy(rooms[i]) - cy(rooms[0]));
            if (d > best) { best = d; startIdx = i; }
        }
    }

    // Carve rooms.
    for (const r of rooms) carveRoom(g, r, theme, rng);

    // Connect: Prim's MST over room centres, then a few extra loops. The boss arena gets exactly one door.
    const n = rooms.length;
    const inTree = new Array(n).fill(false);
    inTree[startIdx] = true;
    const edges = [];
    for (let k = 1; k < n; k++) {
        let best = null;
        for (let i = 0; i < n; i++) if (inTree[i]) for (let j = 0; j < n; j++) {
            if (inTree[j]) continue;
            if (boss && i === 0) continue;          // nothing hangs off the arena
            const d = Math.hypot(cx(rooms[i]) - cx(rooms[j]), cy(rooms[i]) - cy(rooms[j]));
            if (!best || d < best.d) best = { i, j, d };
        }
        if (!best) return null;
        inTree[best.j] = true;
        edges.push(best);
    }
    for (let e = 0; e < Math.floor(n * 0.25); e++) {
        const i = rng.int(boss ? 1 : 0, n - 1), j = rng.int(boss ? 1 : 0, n - 1);
        if (i !== j) edges.push({ i, j });
    }
    const cw = theme === 'cellar' ? 2 : 3;
    for (const { i, j } of edges) carveCorridor(g, cx(rooms[i]), cy(rooms[i]), cx(rooms[j]), cy(rooms[j]), cw, theme, rng);

    // Re-assert room features that corridors may have cut through (pillars stay where corridors aren't).
    for (const r of rooms) decorateRoom(g, r, theme, rng, r === rooms[startIdx]);

    // Flood fill from the entrance.
    const start = { x: cx(rooms[startIdx]), y: cy(rooms[startIdx]) };
    if (!walkable(g.at(start.x, start.y))) { g.set(start.x, start.y, T.FLOOR); }
    const dist = bfs(g, start.x, start.y);
    for (const r of rooms) {
        const c = findWalkableNear(g, cx(r), cy(r));
        if (!c || dist[c.y * W + c.x] < 0) return null;
        r.cx = c.x; r.cy = c.y; r.dist = dist[c.y * W + c.x];
    }
    // Fill unreachable pockets so the view and the automap never show islands.
    for (let i = 0; i < W * H; i++) if (walkable(g.t[i]) && dist[i] < 0) g.t[i] = T.SOLID;

    const map = {
        seed, floor, theme, act: act.id, w: W, h: H, t: g.t, at: g.at, rooms, boss,
        start: { x: start.x + 0.5, y: start.y + 0.5 }, startRoom: startIdx,
        objs: [], packs: [], exit: null,
    };
    for (const r of rooms) r.start = r === rooms[startIdx];

    // Stairs up at the entrance (next to the start point).
    const upSpot = findWalkableNear(g, start.x, start.y - 2) || start;
    map.objs.push({ type: 'up', x: upSpot.x + 0.5, y: upSpot.y + 0.5 });
    map.start = { x: start.x + 0.5, y: start.y + 1.5 };
    if (!walkable(g.at(start.x, start.y + 1))) map.start = { x: start.x + 0.5, y: start.y + 0.5 };

    // Stairs down: the farthest room (not on boss floors — those open after the boss dies).
    const farthest = rooms.filter((r) => !r.start && !r.boss).sort((a, b) => b.dist - a.dist)[0];
    if (!boss) {
        map.exit = { x: farthest.cx + 0.5, y: farthest.cy + 0.5 };
        map.objs.push({ type: 'down', x: map.exit.x, y: map.exit.y });
        farthest.exit = true;
    } else {
        const ar = rooms[0];
        map.arena = { x: ar.x, y: ar.y, w: ar.w, h: ar.h, cx: ar.cx + 0.5, cy: ar.cy + 0.5 };
    }

    populate(map, g, rng, dist);
    return map;
}

function carveRoom(g, r, theme, rng) {
    if (theme === 'core' && !r.boss) {
        const rx = r.w / 2, ry = r.h / 2, ox = r.x + rx, oy = r.y + ry;
        const ph = rng.range(0, 6.28), ph2 = rng.range(0, 6.28);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const dx = (x + 0.5 - ox) / rx, dy = (y + 0.5 - oy) / ry;
            const a = Math.atan2(dy, dx);
            const wob = 0.82 + 0.12 * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 5 + ph2);
            if (dx * dx + dy * dy < wob * wob) g.set(x, y, T.FLOOR);
        }
    } else if (theme === 'jam' && !r.boss) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const cxp = Math.min(x - r.x, r.x + r.w - 1 - x), cyp = Math.min(y - r.y, r.y + r.h - 1 - y);
            if (cxp + cyp >= 1) g.set(x, y, T.FLOOR);   // clipped corners
        }
    } else {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g.set(x, y, T.FLOOR);
    }
}

function decorateRoom(g, r, theme, rng, isStart) {
    if (isStart) return;
    const big = r.w >= 9 && r.h >= 9;
    if (r.boss) {
        // Arena: four pillars and, below the core, a moat of punch around the edge.
        const px = [r.x + 4, r.x + r.w - 5], py = [r.y + 4, r.y + r.h - 5];
        for (const x of px) for (const y of py) { g.set(x, y, T.BLOCK); }
        if (theme === 'core') {
            for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
                const e = Math.min(x - r.x, r.x + r.w - 1 - x, y - r.y, r.y + r.h - 1 - y);
                if (e === 1 && (x + y) % 5 < 2) g.set(x, y, T.PUNCH);
            }
        }
        if (theme === 'jam') {
            for (let y = r.y + 6; y < r.y + r.h - 6; y++) for (let x = r.x + 7; x < r.x + r.w - 7; x++) g.set(x, y, T.JAM);
        }
        return;
    }
    if (theme === 'cellar' && big && rng.chance(0.55)) {
        for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) {
            if (g.at(x, y) === T.FLOOR && interiorClear(g, x, y)) g.set(x, y, T.BLOCK);
        }
    }
    if (theme === 'jam' && r.w >= 8 && r.h >= 8 && rng.chance(0.6)) {
        const ox = r.x + r.w / 2, oy = r.y + r.h / 2, rx = r.w / 2 - 2, ry = r.h / 2 - 2;
        for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
            const dx = (x + 0.5 - ox) / rx, dy = (y + 0.5 - oy) / ry;
            if (dx * dx + dy * dy < 0.8 && g.at(x, y) === T.FLOOR) g.set(x, y, T.JAM);
        }
    }
    if (theme === 'core' && r.w >= 9 && r.h >= 9 && rng.chance(0.55)) {
        const ox = r.x + r.w / 2 + rng.range(-1, 1), oy = r.y + r.h / 2 + rng.range(-1, 1), rx = r.w / 2 - 3.2, ry = r.h / 2 - 3.2;
        for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
            const dx = (x + 0.5 - ox) / rx, dy = (y + 0.5 - oy) / ry;
            if (dx * dx + dy * dy < 1 && g.at(x, y) === T.FLOOR && interiorClear(g, x, y)) g.set(x, y, T.PUNCH);
        }
    }
    if (theme === 'core' && rng.chance(0.4)) {
        for (let k = 0; k < 3; k++) {
            const x = rng.int(r.x + 2, r.x + r.w - 3), y = rng.int(r.y + 2, r.y + r.h - 3);
            if (g.at(x, y) === T.FLOOR && interiorClear(g, x, y)) g.set(x, y, T.BLOCK);
        }
    }
}

// True if every 8-neighbour is open floor (so a feature placed here can't plug a corridor).
function interiorClear(g, x, y) {
    for (const [dx, dy] of DIRS8) if (!walkable(g.at(x + dx, y + dy))) return false;
    return true;
}

function carveCorridor(g, x0, y0, x1, y1, w, theme, rng) {
    const put = (x, y) => {
        for (let oy = 0; oy < w; oy++) for (let ox = 0; ox < w; ox++) {
            const tx = x + ox - (w >> 1), ty = y + oy - (w >> 1);
            if (tx < 1 || ty < 1 || tx >= g.w - 1 || ty >= g.h - 1) continue;
            const t = g.at(tx, ty);
            if (t === T.SOLID || t === T.BLOCK || t === T.PUNCH) g.set(tx, ty, T.FLOOR);
        }
    };
    if (theme === 'core') {
        // Wiggly cave tunnel: step toward the target with a sideways wander.
        let x = x0, y = y0, guard = 0;
        while ((x !== x1 || y !== y1) && guard++ < 600) {
            put(x, y);
            const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
            if (rng.chance(0.18)) { const s = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); x = clampI(x + s[0], 2, g.w - 3); y = clampI(y + s[1], 2, g.h - 3); }
            else if (dx && (!dy || rng.chance(Math.abs(x1 - x) / (Math.abs(x1 - x) + Math.abs(y1 - y))))) x += dx;
            else y += dy;
        }
        put(x1, y1);
        return;
    }
    const horizFirst = rng.chance(0.5);
    if (horizFirst) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, y0); for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) put(x1, y); }
    else { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) put(x0, y); for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, y1); }
}
const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);

export function bfs(g, sx, sy) {
    const { w, h } = g;
    const dist = new Int32Array(w * h).fill(-1);
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    dist[sy * w + sx] = 0; q[qt++] = sy * w + sx;
    while (qh < qt) {
        const i = q[qh++], x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of DIRS4) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (dist[j] >= 0 || !walkable(g.t[j])) continue;
            dist[j] = dist[i] + 1; q[qt++] = j;
        }
    }
    return dist;
}

export function findWalkableNear(g, x, y, maxR = 6) {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(g.at(x + dx, y + dy)) && g.at(x + dx, y + dy) !== T.JAM) return { x: x + dx, y: y + dy };
    }
    return null;
}

// --------------------------------------------------------------------------- population
function populate(map, g, rng, dist) {
    const { floor } = map;
    const act = actOf(floor);
    const inAct = (floor - 1) % 4;
    const occupied = new Set();
    const key = (x, y) => y * map.w + x;
    for (const o of map.objs) occupied.add(key(Math.floor(o.x), Math.floor(o.y)));
    const freeTile = (r, needWall = false) => {
        for (let k = 0; k < 40; k++) {
            const x = rng.int(r.x + 1, r.x + r.w - 2), y = rng.int(r.y + 1, r.y + r.h - 2);
            if (g.at(x, y) !== T.FLOOR || occupied.has(key(x, y))) continue;
            if (needWall) {
                let walls = 0;
                for (const [dx, dy] of DIRS4) if (!walkable(g.at(x + dx, y + dy))) walls++;
                if (walls !== 1) continue;
            }
            // Never in a doorway: a blocking object needs ≥ 5 walkable 8-neighbours.
            let open = 0;
            for (const [dx, dy] of DIRS8) if (walkable(g.at(x + dx, y + dy)) && !occupied.has(key(x + dx, y + dy))) open++;
            if (open < 5) continue;
            occupied.add(key(x, y));
            return { x, y };
        }
        return null;
    };

    // Breakables along walls, chests, a shrine.
    const breakTypes = act.id === 1 ? ['crate', 'crate', 'jar', 'barrel', 'keg'] : act.id === 2 ? ['jar', 'jar', 'crate', 'keg', 'barrel'] : ['jar', 'barrel', 'keg', 'keg', 'crate'];
    let chests = 0, shrine = false;
    for (const r of map.rooms) {
        if (r.boss) continue;
        const nb = rng.int(1, 3) + (r.w * r.h > 90 ? 2 : 0);
        for (let i = 0; i < nb; i++) {
            const p = freeTile(r, true);
            if (!p) continue;
            const type = rng.pick(breakTypes);
            map.objs.push({ type, x: p.x + 0.5, y: p.y + 0.5 });
            // Little clusters: sometimes add a neighbour of the same type.
            if (rng.chance(0.45)) {
                for (const [dx, dy] of DIRS4) {
                    const nx = p.x + dx, ny = p.y + dy;
                    if (g.at(nx, ny) === T.FLOOR && !occupied.has(key(nx, ny))) {
                        let walls = 0;
                        for (const [ex, ey] of DIRS4) if (!walkable(g.at(nx + ex, ny + ey))) walls++;
                        if (walls === 1) { occupied.add(key(nx, ny)); map.objs.push({ type: rng.pick(breakTypes), x: nx + 0.5, y: ny + 0.5 }); break; }
                    }
                }
            }
        }
        if (!r.start && chests < 3 && rng.chance(0.28)) {
            const p = freeTile(r, true);
            if (p) { chests++; map.objs.push({ type: rng.chance(0.12) ? 'bigchest' : 'chest', x: p.x + 0.5, y: p.y + 0.5 }); }
        }
        if (!r.start && !shrine && rng.chance(0.14)) {
            const p = freeTile(r);
            if (p) { shrine = true; map.objs.push({ type: 'shrine', x: p.x + 0.5, y: p.y + 0.5, shrine: rng.pick(['ripe', 'crunchy', 'zippy', 'fresh', 'sweet', 'fizzy']) }); }
        }
    }

    // Quest objects.
    const midRoom = () => map.rooms.filter((r) => !r.start && !r.boss && !r.exit).sort((a, b) => Math.abs(a.dist - 40) - Math.abs(b.dist - 40))[0];
    if (floor === 2) { const r = midRoom(); const p = freeTile(r) || { x: r.cx, y: r.cy }; map.objs.push({ type: 'lectern', x: p.x + 0.5, y: p.y + 0.5 }); }
    if (floor === 6) { const r = midRoom(); const p = freeTile(r) || { x: r.cx, y: r.cy }; map.objs.push({ type: 'anvil', x: p.x + 0.5, y: p.y + 0.5 }); }

    // Monster packs. Weights come from the act; some types only show up deeper.
    const table = {};
    for (const [k, w] of Object.entries(act.monsters)) {
        if (k === 'eggplant' && floor < 3) continue;
        if (k === 'mimic') continue;           // mimics hide among chests (below)
        if (k === 'worm' && floor < 2) continue;
        table[k] = w;
    }
    let champions = 0, uniques = 0;
    const wantUnique = rng.chance(0.65) || floor === 7;
    for (const r of map.rooms) {
        if (r.start || r.boss) continue;
        const area = r.w * r.h;
        const packs = Math.max(1, Math.min(3, Math.round(area / 45 + rng.range(-0.4, 0.6))));
        for (let p = 0; p < packs; p++) {
            const type = rng.weighted(table);
            const def = MONSTERS[type];
            const pos = freeTile(r);
            if (!pos) continue;
            let elite = null;
            if (champions < 1 + (inAct >> 1) && rng.chance(0.12)) { elite = 'champion'; champions++; }
            else if (wantUnique && uniques < 1 && r.dist > 20 && rng.chance(0.25)) { elite = 'unique'; uniques++; }
            const [a, b] = def.pack;
            map.packs.push({ type, x: pos.x + 0.5, y: pos.y + 0.5, count: elite === 'unique' ? Math.max(2, a) : rng.int(a, b) + (inAct >= 2 ? 1 : 0), elite });
        }
    }
    // Corridor stragglers.
    let strays = 0;
    for (let k = 0; k < 200 && strays < 4 + inAct; k++) {
        const x = rng.int(1, map.w - 2), y = rng.int(1, map.h - 2);
        if (g.at(x, y) !== T.FLOOR || dist[key(x, y)] < 14) continue;
        if (map.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
        strays++;
        map.packs.push({ type: rng.weighted(table), x: x + 0.5, y: y + 0.5, count: 1 });
    }
    // Mimics: deeper chests sometimes bite.
    if (floor >= 6) {
        const r = map.rooms.find((rr) => !rr.start && !rr.boss && rr.dist > 18);
        const p = r && freeTile(r, true);
        if (p && rng.chance(0.6)) map.packs.push({ type: 'mimic', x: p.x + 0.5, y: p.y + 0.5, count: 1 });
    }
    // The Toothpick Thief (Kiwirt's quest) on floor 7.
    if (floor === 7) {
        const r = map.rooms.filter((rr) => !rr.start && !rr.boss).sort((a, b) => b.dist - a.dist)[1] || map.rooms[map.rooms.length - 1];
        const p = freeTile(r) || { x: r.cx, y: r.cy };
        map.packs.push({ type: 'thief', x: p.x + 0.5, y: p.y + 0.5, count: 1, elite: 'quest', minions: 'peelton' });
    }
    if (map.boss) {
        const a = map.arena;
        map.packs.push({ type: act.boss, x: a.cx, y: a.cy - 1, count: 1, elite: 'boss' });
    }
    unblock(map, g);
    // Keep the entrance calm: nothing within 9 tiles of the start.
    map.packs = map.packs.filter((p) => Math.hypot(p.x - map.start.x, p.y - map.start.y) > 9);
}

// Solid objects (crates, chests, shrines…) must never seal off floor. Treat them as walls, flood
// fill from the entrance, and drop any object that borders a cut-off tile; repeat until clean.
const PASSABLE_OBJS = new Set(['up', 'down']);
function unblock(map, g) {
    const sx = Math.floor(map.start.x), sy = Math.floor(map.start.y);
    for (let pass = 0; pass < 12; pass++) {
        const t2 = Uint8Array.from(g.t);
        const solid = map.objs.filter((o) => !PASSABLE_OBJS.has(o.type));
        for (const o of solid) t2[Math.floor(o.y) * map.w + Math.floor(o.x)] = T.SOLID;
        const g2 = { w: map.w, h: map.h, t: t2 };
        const d = bfs(g2, sx, sy);
        const cut = new Set();
        for (let i = 0; i < t2.length; i++) if (walkable(t2[i]) && d[i] < 0) cut.add(i);
        if (!cut.size) return;
        const before = map.objs.length;
        map.objs = map.objs.filter((o) => {
            if (PASSABLE_OBJS.has(o.type) || o.type === 'lectern' || o.type === 'anvil') return true;
            const ox = Math.floor(o.x), oy = Math.floor(o.y);
            for (const [dx, dy] of DIRS8) if (cut.has((oy + dy) * map.w + ox + dx)) return false;
            return true;
        });
        if (map.objs.length === before) return;
    }
}

export const ACT_LIST = ACTS;
