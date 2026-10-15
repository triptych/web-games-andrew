// Seeded level generator. Pure: same (seed, level, difficulty) → same level, so saves only keep the seed.
//
// A level is a W×H grid of CELL-metre cells. Each open cell has a floor, a ceiling (SKY outdoors),
// materials and flags. See game-plan.md § Levels for the steps; validate() proves the keys and the
// exit can be reached by walking (no jumps, no jetpack).

import { CELL, SKY, STEP_UP } from '../config.js';
import { makeRng, seedOf } from '../rng.js';
import { LEVELS, ENEMIES } from './data.js';
import { genWeapon, legendary } from './weapons.js';

export const MAT = {
    asphalt: 0, sidewalk: 1, facade: 2, crate: 3, malltile: 4, mallwall: 5, shopfront: 6, ceilpanel: 7,
    sewerfloor: 8, brick: 9, flesh: 10, hexfloor: 11, chrome: 12, metal: 13, toxic: 14, slime: 15,
    plasma: 16, concrete: 18, neonpanel: 19,
};

const THEME = {
    city: { floorRoom: MAT.sidewalk, floorCorr: MAT.asphalt, wall: MAT.facade, ceil: MAT.concrete, alt: MAT.facade, heights: 3, lamp: [1.0, 0.62, 0.3] },
    mall: { floorRoom: MAT.malltile, floorCorr: MAT.malltile, wall: MAT.mallwall, ceil: MAT.ceilpanel, alt: MAT.shopfront, heights: 5, lamp: [1.0, 0.92, 0.8] },
    sewer: { floorRoom: MAT.sewerfloor, floorCorr: MAT.sewerfloor, wall: MAT.brick, ceil: MAT.brick, alt: MAT.flesh, heights: 4, lamp: [0.55, 1.0, 0.45] },
    ship: { floorRoom: MAT.hexfloor, floorCorr: MAT.hexfloor, wall: MAT.chrome, ceil: MAT.chrome, alt: MAT.neonpanel, heights: 6, lamp: [0.75, 0.45, 1.0] },
    core: { floorRoom: MAT.hexfloor, floorCorr: MAT.hexfloor, wall: MAT.flesh, ceil: MAT.flesh, alt: MAT.chrome, heights: 4, lamp: [1.0, 0.3, 0.55] },
};
const LIQUID_MAT = { toxic: MAT.toxic, slime: MAT.slime, plasma: MAT.plasma };
const LIQUID_LIGHT = { toxic: [0.5, 1.0, 0.2], slime: [0.4, 1.0, 0.3], plasma: [0.9, 0.3, 1.0] };
const NEON = [[1, 0.2, 0.7], [0.2, 0.9, 1], [0.6, 1, 0.3], [1, 0.55, 0.1], [0.75, 0.3, 1]];
const SIGNS = {
    city: ['MOTEL', 'ARCADE', 'VIDEO', 'DINER', 'PIZZA', 'LIQUOR', 'DISCO', 'LASER TAG', 'TATTOO', 'BURGERS', 'RADIO', 'CASINO', 'GYM', 'DONUTS'],
    mall: ['SALE', 'RECORDS', 'ARCADE', 'SHOES', 'PRETZELS', 'VIDEO', 'TOYS', 'MALL', 'FOOD COURT', 'JEANS', 'PERFUME', 'CINEMA'],
    sewer: ['DANGER', 'NO ENTRY', 'DRAIN 9', 'EXIT'],
    ship: ['◆◇◆', '⟁', '◈', '⊗', '⟡'],
    core: ['⟁', '◈', '⊗'],
};
export const KEY_NAMES = ['', 'RED', 'BLUE', 'GOLD'];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function levelSeed(seed, level, attempt = 0) { return seedOf(seed, level * 7919 + 13, attempt); }

/** Generate level `index` (0-based) of the campaign for `seed`. */
export function generateLevel(seed, index, difficulty = 1) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const L = tryGenerate(seed, index, difficulty, attempt);
        if (L && validate(L).ok) { L.attempt = attempt; return L; }
    }
    throw new Error(`level ${index} seed ${seed}: no valid layout in 40 attempts`);
}

function tryGenerate(seed, index, difficulty, attempt) {
    const spec = LEVELS[index];
    const rng = makeRng(levelSeed(seed, index, attempt));
    const th = THEME[spec.theme];
    const W = spec.W, H = spec.H, N = W * H;
    const L = {
        index, id: spec.id, theme: spec.theme, outdoor: spec.outdoor, W, H, N, seed,
        solid: new Uint8Array(N).fill(1),
        floor: new Float32Array(N),
        ceil: new Float32Array(N),
        top: new Float32Array(N),          // solid cells: wall/building height for the view
        fmat: new Uint8Array(N), wmat: new Uint8Array(N), cmat: new Uint8Array(N),
        liquid: new Uint8Array(N),
        room: new Int16Array(N).fill(-1),
        door: new Int16Array(N).fill(-1),
        crate: new Uint8Array(N),
        rooms: [], doors: [], lights: [], signs: [],
        enemies: [], pickups: [], barrels: [],
        start: 0, startYaw: 0, exitRoom: -1, exitCell: -1, bossRoom: -1, boss: spec.boss,
    };

    // ---------------------------------------------------------------- rooms
    const want = rng.int(spec.rooms[0], spec.rooms[1]);
    const rooms = L.rooms;
    if (spec.boss) {
        const s = spec.boss === 'rourke' ? 16 : 14;
        const x = spec.boss === 'rourke' ? Math.floor((W - s) / 2) : (rng() < 0.5 ? 3 : W - s - 3);
        const y = spec.boss === 'rourke' ? 3 : (rng() < 0.5 ? 3 : H - s - 3);
        rooms.push({ x, y, w: s, h: s, arena: true });
    }
    for (let tries = 0; tries < 3000 && rooms.length < want; tries++) {
        const big = rng() < 0.18;
        const w = rng.int(spec.roomSize[0], spec.roomSize[1] + (big ? 4 : 0));
        const h = rng.int(spec.roomSize[0], spec.roomSize[1] + (big ? 4 : 0));
        const x = rng.int(2, W - w - 2), y = rng.int(2, H - h - 2);
        let ok = true;
        for (const r of rooms) {
            if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
        }
        if (ok) rooms.push({ x, y, w, h });
    }
    if (rooms.length < 6) return null;
    rooms.forEach((r, k) => { r.id = k; r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; r.area = r.w * r.h; });
    for (const r of rooms) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const i = y * W + x;
            L.solid[i] = 0; L.room[i] = r.id;
        }
    }

    // ---------------------------------------------------------------- corridors: MST + loops
    const n = rooms.length;
    const inTree = new Uint8Array(n); inTree[0] = 1;
    const edges = [];
    const d2 = (a, b) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
    for (let k = 1; k < n; k++) {
        let best = null, bd = Infinity;
        for (let a = 0; a < n; a++) if (inTree[a]) for (let b = 0; b < n; b++) if (!inTree[b]) {
            const d = d2(rooms[a], rooms[b]);
            if (d < bd) { bd = d; best = [a, b]; }
        }
        inTree[best[1]] = 1;
        edges.push(best);
    }
    for (let a = 0; a < n; a++) {
        if (rng() > 0.28) continue;
        let best = -1, bd = Infinity;
        for (let b = 0; b < n; b++) {
            if (b === a || edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) continue;
            const d = d2(rooms[a], rooms[b]);
            if (d < bd) { bd = d; best = b; }
        }
        if (best >= 0 && bd < 26 * 26) edges.push([a, best]);
    }
    for (const [a, b] of edges) carveCorridor(L, rooms[a], rooms[b], rng.int(spec.corridor[0], spec.corridor[1]), rng);

    // ---------------------------------------------------------------- start and exit
    const roomDist = (from) => bfsDist(L, rooms[from].cx | 0, rooms[from].cy | 0);
    let startRoom, exitRoom;
    if (spec.boss) {
        exitRoom = 0;
        const d = roomDist(0);
        startRoom = farthestRoom(L, d, [0]);
    } else {
        const d0 = roomDist(rng.int(0, n - 1));
        startRoom = farthestRoom(L, d0, []);
        exitRoom = farthestRoom(L, roomDist(startRoom), [startRoom]);
    }
    if (startRoom < 0 || exitRoom < 0) return null;
    L.startRoom = startRoom; L.exitRoom = exitRoom;
    if (spec.boss) L.bossRoom = exitRoom;
    rooms[startRoom].start = true; rooms[exitRoom].exit = true;

    // ---------------------------------------------------------------- heights
    assignHeights(L, rng, th.heights, spec);
    for (let i = 0; i < N; i++) {
        if (L.solid[i]) continue;
        const r = L.room[i];
        L.fmat[i] = r >= 0 ? th.floorRoom : th.floorCorr;
        L.cmat[i] = th.ceil;
        if (spec.outdoor) L.ceil[i] = SKY;
        else if (r >= 0) L.ceil[i] = L.floor[i] + rooms[r].ceilH;
        else L.ceil[i] = L.floor[i] + 3.6;
    }
    // indoors a corridor's ceiling never sits below a neighbouring room's floor + headroom
    // (stairs): smooth ceilings so every open cell has ≥ 3 m of headroom.
    if (!spec.outdoor) for (let i = 0; i < N; i++) if (!L.solid[i] && L.ceil[i] - L.floor[i] < 3.2) L.ceil[i] = L.floor[i] + 3.2;
    // solid cells: wall materials and building heights
    for (let i = 0; i < N; i++) {
        if (!L.solid[i]) continue;
        const x = i % W, y = (i / W) | 0;
        const block = seedOf(seed, index, (x >> 2) * 131 + (y >> 2));
        L.wmat[i] = (block % 7 === 0) ? th.alt : th.wall;
        L.top[i] = spec.outdoor ? 10 + (block % 997) / 997 * 34 : 0;
    }

    // ---------------------------------------------------------------- features
    for (const r of rooms) {
        if (r.start || r.arena) continue;
        const roll = rng();
        if (r.w >= 7 && r.h >= 7 && roll < 0.35) addPillars(L, r, rng);
        else if (r.w >= 6 && r.h >= 6 && roll < 0.6) addPit(L, r, rng, LIQUID_MAT[spec.liquid]);
        if (r.w >= 5 && r.h >= 5 && rng() < 0.45) addPlatform(L, r, rng);
        if (rng() < 0.6) addCrates(L, r, rng, rng.int(1, 3));
    }
    if (spec.boss === 'vrask') {
        // cover in the arena
        const r = rooms[exitRoom];
        for (const [fx, fy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
            const x = Math.floor(r.x + r.w * fx), y = Math.floor(r.y + r.h * fy);
            setCrate(L, y * W + x, 1.5);
        }
    }

    // a walkable cell near each room's centre (the centre itself may be a pillar or a pit)
    for (const r of rooms) r.c = freeCellNear(L, r, Math.floor(r.cx), Math.floor(r.cy));

    // ---------------------------------------------------------------- doors and keys
    if (!placeKeys(L, rng, spec)) return null;

    // ---------------------------------------------------------------- exit
    const er = rooms[exitRoom];
    L.exitCell = freeCellNear(L, er, Math.floor(er.cx), Math.floor(er.cy));
    if (L.exitCell < 0) return null;

    // ---------------------------------------------------------------- start
    const sr = rooms[startRoom];
    L.start = freeCellNear(L, sr, Math.floor(sr.cx), Math.floor(sr.cy));
    if (L.start < 0) return null;
    {
        // face the most open direction
        const sx = L.start % W, sy = (L.start / W) | 0;
        let best = 0, bl = -1;
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, dx = Math.sin(a), dy = -Math.cos(a);
            let len = 0;
            for (let s = 1; s < 20; s++) {
                const x = Math.floor(sx + 0.5 + dx * s), y = Math.floor(sy + 0.5 + dy * s);
                if (x < 0 || y < 0 || x >= W || y >= H || L.solid[y * W + x]) break;
                len = s;
            }
            if (len > bl) { bl = len; best = a; }
        }
        L.startYaw = best;
    }

    // ---------------------------------------------------------------- lights and signs
    placeLights(L, rng, spec, th);

    // ---------------------------------------------------------------- content
    placeContent(L, rng, spec, difficulty);
    return L;
}

// ==================================================================== helpers

function carveCorridor(L, a, b, w, rng) {
    const W = L.W;
    let x0 = Math.floor(a.cx), y0 = Math.floor(a.cy);
    const x1 = Math.floor(b.cx), y1 = Math.floor(b.cy);
    const lo = -Math.floor((w - 1) / 2), hi = lo + w - 1;
    const open = (x, y) => {
        for (let o = lo; o <= hi; o++) {
            for (const [cx, cy] of [[x + o, y], [x, y + o]]) {
                if (cx < 1 || cy < 1 || cx >= W - 1 || cy >= L.H - 1) continue;
                const i = cy * W + cx;
                if (L.solid[i]) { L.solid[i] = 0; L.room[i] = -1; }
            }
        }
    };
    const horizFirst = rng() < 0.5;
    const legX = () => { const s = Math.sign(x1 - x0); while (x0 !== x1) { open(x0, y0); x0 += s; } open(x0, y0); };
    const legY = () => { const s = Math.sign(y1 - y0); while (y0 !== y1) { open(x0, y0); y0 += s; } open(x0, y0); };
    if (horizFirst) { legX(); legY(); } else { legY(); legX(); }
}

function bfsDist(L, sx, sy, passable = (i) => !L.solid[i]) {
    const { W, H } = L;
    const d = new Int32Array(L.N).fill(-1);
    const q = [sy * W + sx];
    d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (d[j] >= 0 || !passable(j)) continue;
            d[j] = d[i] + 1;
            q.push(j);
        }
    }
    return d;
}

function farthestRoom(L, d, exclude) {
    let best = -1, bd = -1;
    for (const r of L.rooms) {
        if (exclude.includes(r.id)) continue;
        const v = d[Math.floor(r.cy) * L.W + Math.floor(r.cx)];
        if (v > bd) { bd = v; best = r.id; }
    }
    return best;
}

/** Room targets from a smooth field, then a 0.5-per-cell Lipschitz relaxation: rooms stay flat,
 *  corridors become stairs, and no step anywhere is more than 0.5 m. */
function assignHeights(L, rng, levels, spec) {
    const { W, N, rooms } = L;
    const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
    const field = (x, y) => 0.5 + 0.25 * Math.sin(x * 0.11 + ph[0]) * Math.cos(y * 0.09 + ph[1]) + 0.25 * Math.sin((x + y) * 0.05 + ph[2]) * Math.cos((x - y) * 0.07 + ph[3]);
    for (const r of rooms) {
        r.floor = r.start || r.arena ? 0 : Math.round(field(r.cx, r.cy) * levels) * 0.5;
        const [c0, c1] = spec.ceil;
        r.ceilH = c0 + rng() * (c1 - c0) + (r.area > 80 ? 3 : 0);
        if (r.arena) r.ceilH = spec.boss === 'rourke' ? 16 : 11;
    }
    const val = new Float32Array(N).fill(1e9);
    // a heap would be faster; a bucket queue on 0.5 steps is exact and simple
    const buckets = new Map();
    const push = (i, v) => {
        const k = Math.round(v * 2);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(i);
    };
    for (let i = 0; i < N; i++) if (!L.solid[i] && L.room[i] >= 0) { val[i] = rooms[L.room[i]].floor; push(i, val[i]); }
    // rooms not reachable from anything still get their own values; corridors pick up from rooms
    const keys = () => [...buckets.keys()].sort((a, b) => a - b);
    let guard = 0;
    while (buckets.size && guard++ < 1e6) {
        const k = keys()[0];
        const list = buckets.get(k);
        buckets.delete(k);
        for (const i of list) {
            const v = k / 2;
            if (val[i] < v - 1e-6) continue;   // stale
            const x = i % W, y = (i / W) | 0;
            for (const [dx, dy] of DIRS) {
                const j = (y + dy) * W + (x + dx);
                if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= L.H || L.solid[j]) continue;
                const cand = v + 0.5;
                if (cand >= val[j] - 1e-6) continue;
                const rj = L.room[j];
                if (rj >= 0) {
                    // a room is too high for its neighbour: lower the whole room, keeping it flat
                    rooms[rj].floor = cand;
                    for (let yy = rooms[rj].y; yy < rooms[rj].y + rooms[rj].h; yy++) for (let xx = rooms[rj].x; xx < rooms[rj].x + rooms[rj].w; xx++) {
                        const c = yy * W + xx;
                        if (L.room[c] === rj && val[c] > cand) { val[c] = cand; push(c, cand); }
                    }
                } else { val[j] = cand; push(j, cand); }
            }
        }
    }
    for (let i = 0; i < N; i++) L.floor[i] = L.solid[i] ? 0 : (val[i] < 1e8 ? val[i] : 0);
}

function roomCells(L, r, inset = 0) {
    const out = [];
    for (let y = r.y + inset; y < r.y + r.h - inset; y++) for (let x = r.x + inset; x < r.x + r.w - inset; x++) {
        const i = y * L.W + x;
        if (L.room[i] === r.id && !L.solid[i]) out.push(i);
    }
    return out;
}

/** True if any cell of the list touches an open cell outside room r (a corridor mouth). */
function touchesOutside(L, r, cells) {
    for (const i of cells) {
        const x = i % L.W, y = (i / L.W) | 0;
        for (const [dx, dy] of [...DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const j = (y + dy) * L.W + (x + dx);
            if (!L.solid[j] && L.room[j] !== r.id) return true;
        }
    }
    return false;
}

function isPlain(L, i) { return !L.solid[i] && !L.liquid[i] && !L.crate[i] && L.door[i] < 0 && !L.platform?.[i]; }

function addPillars(L, r, rng) {
    const step = rng.pick([2, 3]);
    for (let y = r.y + 2; y < r.y + r.h - 2; y += step) for (let x = r.x + 2; x < r.x + r.w - 2; x += step) {
        const i = y * L.W + x;
        if (touchesOutside(L, r, [i])) continue;
        L.solid[i] = 1; L.room[i] = r.id; L.wmat[i] = THEME[L.theme].alt === MAT.shopfront ? MAT.concrete : THEME[L.theme].alt;
        L.top[i] = L.outdoor ? 3.5 + rng() * 3 : 0;
        r.pillars = true;
    }
}

function addPit(L, r, rng, mat) {
    const x0 = r.x + 2, y0 = r.y + 2, x1 = r.x + r.w - 2, y1 = r.y + r.h - 2;
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    const depth = L.outdoor ? 0.5 : 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * L.W + x;
        L.floor[i] -= depth; L.liquid[i] = 1; L.fmat[i] = mat;
    }
    r.pit = true;
}

function addPlatform(L, r, rng) {
    const corners = [[r.x, r.y], [r.x + r.w - 2, r.y], [r.x, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]];
    const [px, py] = rng.pick(corners);
    const cells = [];
    for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) cells.push(y * L.W + x);
    if (cells.some((i) => !isPlain(L, i) || L.room[i] !== r.id) || touchesOutside(L, r, cells)) return;
    const h = L.floor[cells[0]] + rng.pick([2, 2.5, 3]);
    L.platform ??= new Uint8Array(L.N);
    for (const i of cells) { L.floor[i] = h; L.fmat[i] = MAT.metal; L.platform[i] = 1; if (!L.outdoor) L.ceil[i] = Math.max(L.ceil[i], h + 2.6); }
    r.platform = cells;
}

function setCrate(L, i, h = 1.2) {
    L.floor[i] += h; L.crate[i] = 1; L.fmat[i] = MAT.crate;
    if (!L.outdoor) L.ceil[i] = Math.max(L.ceil[i], L.floor[i] + 2.4);
}

function addCrates(L, r, rng, count) {
    for (let k = 0; k < count; k++) {
        const x = rng.int(r.x + 1, r.x + r.w - 2), y = rng.int(r.y + 1, r.y + r.h - 2);
        const i = y * L.W + x;
        if (!isPlain(L, i) || L.room[i] !== r.id || touchesOutside(L, r, [i])) continue;
        setCrate(L, i);
    }
}

/** A free walkable cell in room r nearest (x, y). */
function freeCellNear(L, r, x, y) {
    let best = -1, bd = Infinity;
    for (const i of roomCells(L, r)) {
        if (!isPlain(L, i)) continue;
        const d = (i % L.W - x) ** 2 + (((i / L.W) | 0) - y) ** 2;
        if (d < bd) { bd = d; best = i; }
    }
    return best;
}

/** Can a walker step from cell a to neighbour b? Doors pass if `keys` has their colour. */
export function canStep(L, a, b, keys = 0b1110) {
    if (L.solid[b]) return false;
    const d = L.door[b];
    if (d >= 0 && !(keys & (1 << L.doors[d].key))) return false;
    return L.floor[b] - L.floor[a] <= STEP_UP + 1e-4 && L.ceil[b] - Math.max(L.floor[a], L.floor[b]) >= 2;
}

/** Flood fill from the start with the step rule, picking up keys and opening doors as found. */
export function reachable(L, startKeys = 0, collect = true) {
    let keys = startKeys;
    let seen;
    for (let pass = 0; pass < (collect ? 5 : 1); pass++) {
        seen = new Uint8Array(L.N);
        const q = [L.start];
        seen[L.start] = 1;
        for (let h = 0; h < q.length; h++) {
            const i = q[h], x = i % L.W, y = (i / L.W) | 0;
            for (const [dx, dy] of DIRS) {
                const j = (y + dy) * L.W + (x + dx);
                if (seen[j] || !canStep(L, i, j, keys)) continue;
                seen[j] = 1; q.push(j);
            }
        }
        let got = keys;
        for (const p of L.pickups) if (p.kind === 'key' && seen[p.cell]) got |= 1 << p.key;
        if (got === keys) break;
        keys = got;
    }
    return { seen, keys };
}

/** Lenient fill for optional loot: jetpack climbs up to 3.5 m, every door open. */
export function reachableLoose(L) {
    const seen = new Uint8Array(L.N);
    const q = [L.start]; seen[L.start] = 1;
    for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % L.W, y = (i / L.W) | 0;
        for (const [dx, dy] of DIRS) {
            const j = (y + dy) * L.W + (x + dx);
            if (seen[j] || L.solid[j] || L.floor[j] - L.floor[i] > 3.5) continue;
            seen[j] = 1; q.push(j);
        }
    }
    return seen;
}

export function validate(L) {
    const errs = [];
    const { seen, keys } = reachable(L);
    if (!seen[L.exitCell]) errs.push('exit unreachable');
    for (const p of L.pickups) if (p.kind === 'key' && !seen[p.cell]) errs.push(`key ${p.key} unreachable`);
    const loose = reachableLoose(L);
    for (const p of L.pickups) if (!loose[p.cell]) errs.push(`${p.kind} unreachable even with the jetpack`);
    for (const e of L.enemies) if (L.room[e.cell] === L.startRoom) errs.push('enemy in the start room');
    const needKeys = L.doors.reduce((m, d) => m | (1 << d.key), 0);
    if ((keys & needKeys) !== needKeys) errs.push('a door has no reachable key');
    return { ok: errs.length === 0, errs };
}

/** Lock a room's mouths with a door of colour `key`. Returns the door or null. */
function lockRoom(L, r, key) {
    const cells = [];
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
        const i = y * L.W + x;
        if (L.solid[i] || L.room[i] === r.id) continue;
        // a corridor cell touching the room orthogonally
        const touches = DIRS.some(([dx, dy]) => L.room[(y + dy) * L.W + (x + dx)] === r.id && !L.solid[(y + dy) * L.W + (x + dx)]);
        if (touches) cells.push(i);
    }
    if (!cells.length || cells.length > 14 || cells.some((i) => L.liquid[i] || L.door[i] >= 0)) return null;
    const door = { id: L.doors.length, key, cells, room: r.id };
    for (const i of cells) L.door[i] = door.id;
    L.doors.push(door);
    return door;
}

function placeKeys(L, rng, spec) {
    const rooms = L.rooms;
    const keyColours = spec.keys === 2 ? [1, 2] : [rng.pick([1, 2, 3])];
    const finalKey = keyColours[keyColours.length - 1];
    if (!lockRoom(L, rooms[L.exitRoom], finalKey)) return false;
    const reach = (k) => reachable(L, k).seen;
    const pickRoom = (seen, exclude) => {
        const cands = rooms.filter((r) => !r.start && !exclude.includes(r.id) && r.c >= 0 && seen[r.c]);
        if (!cands.length) return null;
        // prefer far from the start
        const ds = bfsDist(L, L.start % L.W, (L.start / L.W) | 0);
        cands.sort((a, b) => ds[b.c] - ds[a.c]);
        return cands[Math.min(cands.length - 1, rng.int(0, 2))];
    };
    const keyAt = (r, key) => {
        const c = freeCellNear(L, r, Math.floor(r.cx), Math.floor(r.cy));
        if (c < 0) return false;
        L.pickups.push({ kind: 'key', key, cell: c });
        r.keyRoom = true;
        return true;
    };
    // we need the start cell for reach(); a provisional start is the start room's centre
    L.start = freeCellNear(L, rooms[L.startRoom], Math.floor(rooms[L.startRoom].cx), Math.floor(rooms[L.startRoom].cy));
    if (L.start < 0) return false;
    if (keyColours.length === 2) {
        // the vault: a room locked with key 1 that holds key 2
        const seen0 = reach(0);
        const vaultCands = rooms.filter((r) => !r.start && !r.exit && !r.arena && r.c >= 0 && seen0[r.c]);
        let vault = null;
        for (const r of vaultCands.sort((a, b) => b.area - a.area).slice(0, 8)) {
            const before = L.doors.length;
            const d = lockRoom(L, r, keyColours[0]);
            if (!d) continue;
            const seen = reach(0);
            const placeable = rooms.some((q) => q !== r && !q.start && !q.exit && q.c >= 0 && seen[q.c]);
            if (placeable && !seen[r.c]) { vault = r; break; }
            for (const i of d.cells) L.door[i] = -1;
            L.doors.length = before;
        }
        if (!vault) return false;
        if (!keyAt(vault, keyColours[1])) return false;
        const r1 = pickRoom(reach(0), [vault.id, L.exitRoom]);
        if (!r1 || !keyAt(r1, keyColours[0])) return false;
    } else {
        const r1 = pickRoom(reach(0), [L.exitRoom]);
        if (!r1 || !keyAt(r1, keyColours[0])) return false;
    }
    return true;
}

function placeLights(L, rng, spec, th) {
    const { W, H } = L;
    const add = (x, y, z, c, range, kind = 'lamp') => L.lights.push({ x, y, z, r: c[0], g: c[1], b: c[2], range, kind });
    const cx = (i) => (i % W + 0.5) * CELL, cz = (i) => (((i / W) | 0) + 0.5) * CELL;
    // room lights
    for (const r of L.rooms) {
        const cells = roomCells(L, r);
        if (!cells.length) continue;
        const nx = Math.max(1, Math.round(r.w / 5)), ny = Math.max(1, Math.round(r.h / 5));
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
            const x = Math.floor(r.x + (a + 0.5) * r.w / nx), y = Math.floor(r.y + (b + 0.5) * r.h / ny);
            const i = y * W + x;
            const f = L.floor[i], c = L.ceil[i];
            const col = spec.theme === 'city' ? rng.pick(NEON) : (rng() < 0.2 ? rng.pick(NEON) : th.lamp);
            add((x + 0.5) * CELL, Math.min(c - 0.4, f + 5), (y + 0.5) * CELL, col, spec.outdoor ? 13 : 12, 'lamp');
        }
        if (r.pit) {
            const i = Math.floor(r.cy) * W + Math.floor(r.cx);
            add(cx(i), L.floor[i] + 0.5, cz(i), LIQUID_LIGHT[spec.liquid], 10, 'liquid');
        }
    }
    // corridor lights: street lamps outdoors, sparse strips indoors
    let k = 0;
    for (let i = 0; i < L.N; i++) {
        if (L.solid[i] || L.room[i] >= 0) continue;
        const x = i % W, y = (i / W) | 0;
        if ((x * 7 + y * 13 + k) % (spec.outdoor ? 23 : 17) !== 0) continue;
        k++;
        const wallNear = DIRS.some(([dx, dy]) => L.solid[(y + dy) * W + (x + dx)]);
        if (!wallNear) continue;
        add(cx(i), L.floor[i] + (spec.outdoor ? 6 : 3), cz(i), spec.outdoor ? [1.0, 0.6, 0.25] : th.lamp, spec.outdoor ? 14 : 9, spec.outdoor ? 'street' : 'strip');
    }
    for (const p of L.doors) {
        const i = p.cells[(p.cells.length / 2) | 0];
        const c = [[0, 0, 0], [1, 0.15, 0.1], [0.2, 0.45, 1], [1, 0.8, 0.2]][p.key];
        add(cx(i), L.floor[i] + 2.6, cz(i), c, 7, 'door');
    }
    {
        const i = L.exitCell;
        add(cx(i), L.floor[i] + 1.5, cz(i), [0.3, 1, 0.4], 9, 'exit');
    }
    // neon signs on walls facing open cells
    const words = SIGNS[spec.theme];
    const want = spec.outdoor ? 60 : 26;
    for (let t = 0; t < 4000 && L.signs.length < want; t++) {
        const i = rng.int(0, L.N - 1);
        if (!L.solid[i]) continue;
        const x = i % W, y = (i / W) | 0;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        const dirs = DIRS.filter(([dx, dy]) => !L.solid[(y + dy) * W + (x + dx)]);
        if (!dirs.length) continue;
        const [dx, dy] = rng.pick(dirs);
        const o = (y + dy) * W + (x + dx);
        if (L.door[o] >= 0) continue;
        if (L.signs.some((s) => Math.abs(s.cell - i) < 1 || (Math.abs(s.x - (x + 0.5 + dx * 0.5) * CELL) < 7 && Math.abs(s.z - (y + 0.5 + dy * 0.5) * CELL) < 7))) continue;
        const col = rng.pick(NEON);
        const base = L.floor[o];
        const sy = spec.outdoor ? base + 3.5 + rng() * 3.5 : Math.min(L.ceil[o] - 0.8, base + 2.6);
        const s = { cell: i, x: (x + 0.5 + dx * 0.5) * CELL, z: (y + 0.5 + dy * 0.5) * CELL, nx: dx, nz: dy, y: sy, text: rng.pick(words), r: col[0], g: col[1], b: col[2] };
        L.signs.push(s);
        add(s.x + dx * 0.6, sy, s.z + dy * 0.6, col, spec.outdoor ? 9 : 7, 'neon');
    }
}

function rollEnemyType(rng, roster) {
    const ids = Object.keys(roster);
    let sum = 0;
    for (const k of ids) sum += roster[k];
    let x = rng() * sum;
    for (const k of ids) { x -= roster[k]; if (x <= 0) return k; }
    return ids[0];
}

function placeContent(L, rng, spec, difficulty) {
    const { W } = L;
    const used = new Uint8Array(L.N);
    for (const p of L.pickups) used[p.cell] = 1;
    used[L.start] = used[L.exitCell] = 1;
    const free = (r, plat = false) => {
        const cells = plat ? (r.platform || []) : roomCells(L, r).filter((i) => isPlain(L, i));
        const c = cells.filter((i) => !used[i]);
        if (!c.length) return -1;
        const i = rng.pick(c);
        used[i] = 1;
        return i;
    };
    const lvl = L.index;
    const ds = bfsDist(L, L.start % W, (L.start / W) | 0, (i) => !L.solid[i]);
    const dead = L.rooms.filter((r) => !r.start && !r.exit && !r.arena);

    // tapes: platforms and far rooms first
    const far = (r) => (r.platform ? 1000 : 0) + (r.c >= 0 ? ds[r.c] : 0);
    const tapeRooms = [...dead].sort((a, b) => far(b) - far(a));
    let tapes = 0;
    for (const r of tapeRooms) {
        if (tapes >= 3) break;
        if (r.tape) continue;
        const c = r.platform ? free(r, true) : free(r);
        if (c < 0) continue;
        r.tape = true;
        L.pickups.push({ kind: 'tape', tape: tapes++, cell: c });
    }

    // guns: crates around the level; platforms get one rarity up
    const gunRooms = [...dead].sort(() => rng() - 0.5).slice(0, 5 + Math.floor(L.rooms.length / 6));
    let gi = 0;
    for (const r of gunRooms) {
        const onPlat = r.platform && !r.platform.every((i) => used[i]);
        const c = onPlat ? free(r, true) : free(r);
        if (c < 0) continue;
        const gun = genWeapon(seedOf(L.seed, lvl, 500 + gi++), { level: lvl, bonus: onPlat ? 1 : 0 });
        L.pickups.push({ kind: 'gun', cell: c, gun });
    }
    if (spec.legendary) {
        const c = free(L.rooms[L.exitRoom]);
        if (c >= 0) L.pickups.push({ kind: 'gun', cell: c, gun: legendary(spec.legendary, lvl) });
    }

    // supplies
    const kinds = [['cola', 3], ['burger', 1.2], ['vest', 1.2], ['bullet', 2.4], ['shell', 2], ['cell', 2.4], ['rocket', 1.2], ['bomb', 0.7]];
    const total = kinds.reduce((a, k) => a + k[1], 0);
    for (const r of L.rooms) {
        const n = Math.max(1, Math.round(r.area / 22)) + (r.arena ? 4 : 0);
        for (let k = 0; k < n; k++) {
            let x = rng() * total, kind = kinds[0][0];
            for (const [kk, w] of kinds) { x -= w; if (x <= 0) { kind = kk; break; } }
            const c = free(r);
            if (c >= 0) L.pickups.push({ kind, cell: c });
        }
        if (r.platform) {
            const c = free(r, true);
            if (c >= 0) L.pickups.push({ kind: rng.pick(['burger', 'vest', 'rocket', 'bomb']), cell: c });
        }
    }

    // barrels
    for (const r of L.rooms) {
        if (r.start || rng() > 0.45) continue;
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
            const c = free(r);
            if (c >= 0) L.barrels.push({ cell: c });
        }
    }

    // enemies
    const count = (1 + lvl * 0.12) * spec.budget * difficulty.count;
    for (const r of L.rooms) {
        if (r.start || r.arena || (r.exit && spec.ambush)) continue;
        const d = r.c >= 0 ? ds[r.c] : -1;
        if (d < 9) continue;    // a breather at the start (and nothing in unreachable rooms)
        let budget = (r.area / 24) * count;
        while (budget > 0) {
            const type = rollEnemyType(rng, spec.roster);
            const c = free(r);
            if (c < 0) break;
            L.enemies.push({ type, cell: c });
            budget -= ENEMIES[type].weight;
        }
    }
    // corridor patrols
    const corr = [];
    for (let i = 0; i < L.N; i++) if (!L.solid[i] && L.room[i] < 0 && L.door[i] < 0 && !used[i] && ds[i] > 11) corr.push(i);
    const patrols = Math.round(corr.length / 75 * count);
    for (let k = 0; k < patrols && corr.length; k++) {
        const c = corr.splice(rng.int(0, corr.length - 1), 1)[0];
        used[c] = 1;
        L.enemies.push({ type: rollEnemyType(rng, spec.roster), cell: c });
    }
    if (spec.ambush) {
        L.ambush = spec.ambush.map((type) => ({ type, n: Math.max(1, Math.round(difficulty.count + (lvl >= 2 ? 0.3 : 0))) }));
    }
    for (const p of L.pickups) { p.x = (p.cell % W + 0.5) * CELL; p.z = (((p.cell / W) | 0) + 0.5) * CELL; p.y = L.floor[p.cell]; }
}
