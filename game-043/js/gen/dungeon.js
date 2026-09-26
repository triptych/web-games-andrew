// ============================================================
// Dungeon and cave floors, generated from seed + site + floor.
// Dungeons: BSP rooms and corridors, a key-locked stair on some
// floors, a boss arena on the last. Caves: cellular automata with
// ore; the stair down is sometimes hidden under a rock.
// ============================================================

import { rngFor } from '../core/rng.js';
import { flood } from '../core/grid.js';
import { G, O } from '../data/tiles.js';
import { BIOMES } from '../data/monsters.js';

const ORE_VAR = { copper_ore: 1, iron_ore: 2, gold_ore: 3, glim_ore: 4, coal: 5 };
export const ORE_BY_VAR = [null, 'copper_ore', 'iron_ore', 'gold_ore', 'glim_ore', 'coal'];

export function generateFloor(seed, site, floor) {
    const rng = rngFor(seed, 'floor', site.id, floor);
    const f = site.kind === 'dungeon' ? genDungeon(rng, site, floor) : genCave(rng, site, floor);
    f.site = site.id; f.floor = floor; f.kind = site.kind; f.region = site.region;
    return f;
}

function blank(W, H, fill) {
    return { W, H, ground: new Uint8Array(W * H).fill(fill), obj: new Uint8Array(W * H), ov: new Uint8Array(W * H), monsters: [], chests: [] };
}

// ---------------------------------------------------------------- dungeon
function genDungeon(rng, site, floor) {
    const boss = floor === site.floors;
    const W = 34, H = 28;
    const f = blank(W, H, G.WALL);
    const idx = (x, y) => y * W + x;
    const carveRect = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) f.ground[idx(x, y)] = G.FLOOR; };

    if (boss) {
        // an arena: antechamber at the bottom, big hall at the top
        carveRect(8, 3, 18, 13);
        carveRect(15, 16, 4, 6);
        carveRect(11, 21, 12, 5);
        for (const [x, y] of [[10, 5], [23, 5], [10, 13], [23, 13]]) f.obj[idx(x, y)] = O.TORCH;
        for (const [x, y] of [[12, 22], [21, 22]]) f.obj[idx(x, y)] = O.TORCH;
        f.up = { x: 17, y: 24 }; f.obj[idx(17, 24)] = O.UP;
        f.boss = { x: 17, y: 7 };
        f.pedestal = { x: 17, y: 5 };
        f.start = { x: 17, y: 23 };
        f.rooms = [{ x: 8, y: 3, w: 18, h: 13 }];
        return f;
    }

    // BSP
    const leaves = [];
    (function split(x, y, w, h, depth) {
        if (depth > 4 || (w < 14 && h < 12)) { leaves.push({ x, y, w, h }); return; }
        const vert = w > h ? true : h > w ? false : rng.chance(0.5);
        if (vert && w >= 14) { const s = rng.int(6, w - 7); split(x, y, s, h, depth + 1); split(x + s, y, w - s, h, depth + 1); }
        else if (!vert && h >= 12) { const s = rng.int(5, h - 6); split(x, y, w, s, depth + 1); split(x, y + s, w, h - s, depth + 1); }
        else leaves.push({ x, y, w, h });
    })(1, 1, W - 2, H - 2, 0);
    const rooms = leaves.map(L => {
        const w = rng.int(Math.min(4, L.w - 2), Math.max(4, L.w - 2)), h = rng.int(Math.min(4, L.h - 2), Math.max(4, L.h - 2));
        const x = L.x + rng.int(1, Math.max(1, L.w - w - 1)), y = L.y + rng.int(1, Math.max(1, L.h - h - 1));
        return { x, y, w: Math.max(3, Math.min(w, W - x - 1)), h: Math.max(3, Math.min(h, H - y - 1)) };
    });
    for (const r of rooms) carveRect(r.x, r.y, r.w, r.h);
    const ctr = r => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
    // connect rooms in a chain sorted by position, plus a couple of extra loops
    const order = rooms.map((r, i) => i).sort((a, b) => (ctr(rooms[a]).x + ctr(rooms[a]).y * 0.6) - (ctr(rooms[b]).x + ctr(rooms[b]).y * 0.6));
    const corridor = (a, b) => {
        let { x, y } = a;
        const horizFirst = rng.chance(0.5);
        const stepX = () => { while (x !== b.x) { f.ground[idx(x, y)] = G.FLOOR; x += Math.sign(b.x - x); } };
        const stepY = () => { while (y !== b.y) { f.ground[idx(x, y)] = G.FLOOR; y += Math.sign(b.y - y); } };
        if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
        f.ground[idx(x, y)] = G.FLOOR;
    };
    for (let i = 1; i < order.length; i++) corridor(ctr(rooms[order[i - 1]]), ctr(rooms[order[i]]));
    for (let k = 0; k < 2 && rooms.length > 3; k++) corridor(ctr(rng.pick(rooms)), ctr(rng.pick(rooms)));

    // water features in some rooms (never blocking a corridor: only inner tiles)
    for (const r of rooms) if (r.w >= 7 && r.h >= 6 && rng.chance(0.25)) {
        for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (rng.chance(0.7)) f.ground[idx(x, y)] = G.WATER;
    }
    ensureConnected(f, rooms.map(ctr));

    // stairs: up in the first room, down in the room farthest by walking distance
    const first = rooms[order[0]];
    const up = findFree(f, first, rng) ?? ctr(first);
    f.up = up; f.obj[idx(up.x, up.y)] = O.UP; f.start = up;
    const dist = bfsDist(f, up);
    let best = null, bd = -1;
    for (const r of rooms) { const c = ctr(r); const d = dist[idx(c.x, c.y)]; if (d > bd && f.ground[idx(c.x, c.y)] === G.FLOOR && !f.obj[idx(c.x, c.y)]) { bd = d; best = c; } }
    f.down = best; f.obj[idx(best.x, best.y)] = O.DOWN;
    const locked = floor >= 2 && rng.chance(0.6);
    if (locked) f.obj[idx(best.x, best.y)] = O.LOCKED;

    // torches along room walls
    for (const r of rooms) for (let t = 0; t < 2; t++) {
        const x = r.x + rng.int(0, r.w - 1), y = r.y - 1;
        if (y > 0 && f.ground[idx(x, y)] === G.WALL && f.ground[idx(x, y + 1)] === G.FLOOR) f.obj[idx(x, y)] = O.TORCH;
    }
    // chests: 1-2, one holds the key if locked
    const chestRooms = rng.shuffle(rooms.filter(r => r !== first)).slice(0, rng.int(1, 2) + (locked ? 1 : 0));
    chestRooms.forEach((r, k) => {
        const p = findFree(f, r, rng);
        if (!p) return;
        f.obj[idx(p.x, p.y)] = O.CHEST; f.ov[idx(p.x, p.y)] = f.chests.length;
        f.chests.push({ x: p.x, y: p.y, key: locked && k === 0, n: f.chests.length });
    });
    if (locked && !f.chests.some(c => c.key)) f.obj[idx(best.x, best.y)] = O.DOWN;
    // monsters
    const nMon = 3 + Math.min(4, floor) + rng.int(0, 2);
    placeMonsters(f, rooms.filter(r => r !== first), nMon, rng);
    f.rooms = rooms;
    return f;
}

// ---------------------------------------------------------------- cave
function genCave(rng, site, floor) {
    const W = 36, H = 28;
    const idx = (x, y) => y * W + x;
    let f;
    for (let attempt = 0; attempt < 12; attempt++) {
        f = blank(W, H, G.WALL);
        let cells = new Uint8Array(W * H);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) cells[idx(x, y)] = rng.chance(0.44) ? 1 : 0;
        for (let it = 0; it < 4; it++) {
            const n2 = new Uint8Array(W * H);
            for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
                let c = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && cells[idx(x + dx, y + dy)]) c++;
                n2[idx(x, y)] = c >= 5 || (c === 0 && it < 2) ? 1 : 0;
            }
            for (let x = 0; x < W; x++) { n2[x] = 1; n2[idx(x, H - 1)] = 1; }
            for (let y = 0; y < H; y++) { n2[idx(0, y)] = 1; n2[idx(W - 1, y)] = 1; }
            cells = n2;
        }
        for (let i = 0; i < W * H; i++) f.ground[i] = cells[i] ? G.WALL : G.FLOOR;
        // keep the largest open region
        const seen = new Uint8Array(W * H); let bestSet = null;
        for (let i = 0; i < W * H; i++) {
            if (seen[i] || f.ground[i] !== G.FLOOR) continue;
            const set = flood(W, H, [i], j => f.ground[j] === G.FLOOR);
            let n = 0; const list = [];
            for (let j = 0; j < W * H; j++) if (set[j]) { seen[j] = 1; n++; list.push(j); }
            if (!bestSet || n > bestSet.length) bestSet = list;
        }
        if (bestSet && bestSet.length > 260) {
            const keep = new Set(bestSet);
            for (let i = 0; i < W * H; i++) if (f.ground[i] === G.FLOOR && !keep.has(i)) f.ground[i] = G.WALL;
            break;
        }
    }
    const floors = [];
    for (let i = 0; i < W * H; i++) if (f.ground[i] === G.FLOOR) floors.push(i);
    const up = floors[rng.int(0, floors.length - 1)];
    f.up = { x: up % W, y: (up / W) | 0 }; f.start = f.up; f.obj[up] = O.UP;
    const dist = bfsDist(f, f.up);
    // down stair: far away
    const far = floors.filter(i => dist[i] > 18 && !f.obj[i]);
    const dn = far.length ? rng.pick(far) : floors[floors.length - 1];
    f.down = { x: dn % W, y: (dn / W) | 0 };
    const last = floor === site.floors;
    if (!last) {
        f.obj[dn] = O.DOWN;
        if (rng.chance(0.5)) { f.obj[dn] = O.ROCK; f.hiddenDown = true; }
    } else { f.down = null; }
    // ore and rocks
    const biome = BIOMES[site.region - 1];
    const tierOres = [...biome.ore];
    if (floor >= 4 && site.region < 5) tierOres.push(BIOMES[Math.min(4, site.region)].ore[0]);
    for (const i of rng.shuffle(floors.slice())) {
        if (f.obj[i] || dist[i] < 3) continue;
        const r = rng.next();
        if (r < 0.1) f.obj[i] = O.ROCK;
        else if (r < 0.15 + floor * 0.006) { f.obj[i] = O.ORE; f.ov[i] = ORE_VAR[rng.pick(tierOres)] ?? 1; }
        else if (r < 0.16 + floor * 0.003) { f.obj[i] = O.GEM; f.ov[i] = biome.gem.indexOf(rng.pick(biome.gem)); }
    }
    // a treasure chest on the last floor, sometimes on others
    if (last || rng.chance(0.35)) {
        const cand = floors.filter(i => !f.obj[i] && dist[i] > 10);
        if (cand.length) { const c = rng.pick(cand); f.obj[c] = O.CHEST; f.ov[c] = 0; f.chests.push({ x: c % W, y: (c / W) | 0, key: false, n: 0 }); }
    }
    // monsters: fewer than dungeons
    const monFloors = floors.filter(i => dist[i] > 8 && !f.obj[i]);
    const n = 2 + Math.floor(floor / 2) + rng.int(0, 1);
    for (let k = 0; k < n && monFloors.length; k++) {
        const i = monFloors.splice(rng.int(0, monFloors.length - 1), 1)[0];
        f.monsters.push({ x: i % W, y: (i / W) | 0 });
    }
    return f;
}

// ---------------------------------------------------------------- helpers
function findFree(f, r, rng) {
    for (let t = 0; t < 40; t++) {
        const x = r.x + rng.int(0, r.w - 1), y = r.y + rng.int(0, r.h - 1);
        const i = y * f.W + x;
        if (f.ground[i] === G.FLOOR && !f.obj[i]) return { x, y };
    }
    return null;
}
function bfsDist(f, s) {
    const d = new Int32Array(f.W * f.H).fill(-1);
    const q = [s.y * f.W + s.x]; d[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], x = c % f.W, y = (c / f.W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= f.W || ny >= f.H) continue;
            const n = ny * f.W + nx;
            if (d[n] >= 0 || f.ground[n] !== G.FLOOR) continue;
            d[n] = d[c] + 1; q.push(n);
        }
    }
    return d;
}
/** Dig an L-corridor to any room centre the first can't reach. */
function ensureConnected(f, centres) {
    const W = f.W;
    for (let pass = 0; pass < 3; pass++) {
        const reach = flood(f.W, f.H, [centres[0].y * W + centres[0].x], i => f.ground[i] === G.FLOOR);
        let ok = true;
        for (const c of centres) {
            if (reach[c.y * W + c.x]) continue;
            ok = false;
            let x = c.x, y = c.y; const t = centres[0];
            while (x !== t.x) { f.ground[y * W + x] = G.FLOOR; x += Math.sign(t.x - x); }
            while (y !== t.y) { f.ground[y * W + x] = G.FLOOR; y += Math.sign(t.y - y); }
        }
        if (ok) return;
    }
}
function placeMonsters(f, rooms, n, rng) {
    for (let k = 0; k < n && rooms.length; k++) {
        const r = rooms[k % rooms.length];
        const p = findFree(f, r, rng);
        if (p && !f.monsters.some(m => m.x === p.x && m.y === p.y)) f.monsters.push({ x: p.x, y: p.y });
    }
}

/** Verify a floor: stairs reachable from the start (with doors/rocks passable). */
export function floorConnected(f) {
    const reach = flood(f.W, f.H, [f.start.y * f.W + f.start.x], i => f.ground[i] === G.FLOOR);
    const need = [];
    if (f.down) need.push(f.down);
    for (const c of f.chests) need.push(c);
    if (f.boss) need.push(f.boss);
    return need.every(p => reach[p.y * f.W + p.x]);
}
