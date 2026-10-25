// The battle grid: parsing maps, terrain lookups, movement ranges (Dijkstra over move costs), and the
// generator behind Wild Hunts. Pure.

import { TERRAIN, TILE_CHARS, CLASSES } from './data.js';
import { hash3 } from '../rng.js';

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const idx = (B, x, y) => y * B.w + x;
export const inside = (B, x, y) => x >= 0 && y >= 0 && x < B.w && y < B.h;

/** Map strings → { w, h, tiles, own }. */
export function parseMap(rows) {
    const h = rows.length, w = rows[0].length;
    const tiles = [], own = [];
    for (let y = 0; y < h; y++) {
        if (rows[y].length !== w) throw new Error(`map row ${y} is ${rows[y].length} wide, not ${w}`);
        for (let x = 0; x < w; x++) {
            const t = TILE_CHARS[rows[y][x]];
            if (!t) throw new Error(`unknown map char "${rows[y][x]}" at ${x},${y}`);
            tiles.push(t[0]);
            own.push(t[1]);
        }
    }
    return { w, h, tiles, own };
}

export const terrainAt = (B, x, y) => TERRAIN[B.tiles[idx(B, x, y)]];
export const tileId = (B, x, y) => B.tiles[idx(B, x, y)];
export const unitAt = (B, x, y) => B.units.find((u) => u.x === x && u.y === y && u.hp > 0) || null;
export const isFlier = (u) => u.mt === 'fly' || !!CLASSES[u.cls]?.flier;

/** Move cost of one tile for a unit, or null where it cannot go. */
export function moveCost(B, u, x, y) {
    const id = tileId(B, x, y);
    if (u.mt === 'walk') {
        if (id === 'lava' && u.traits.includes('lavaborn')) return 1;
        if ((id === 'mount' || id === 'hills') && u.traits.includes('mountainlord')) return 1;
    }
    return TERRAIN[id].cost[u.mt] ?? null;
}

/** Can the unit stand on this tile at all? */
export const canStand = (B, u, x, y) => inside(B, x, y) && moveCost(B, u, x, y) != null;

/**
 * Every tile the unit can reach this turn: Map(index → { x, y, cost, prev }). Allies can be passed
 * through, enemies block. Occupied tiles are included (for passing) but flagged `occ`.
 */
export function reach(B, u, mv = u.mvNow ?? u.mv) {
    const out = new Map();
    const start = idx(B, u.x, u.y);
    out.set(start, { x: u.x, y: u.y, cost: 0, prev: -1, occ: false });
    if (mv <= 0) return out;
    const occ = new Map();
    for (const o of B.units) if (o.hp > 0) occ.set(idx(B, o.x, o.y), o);
    // small grids: a simple array-scan Dijkstra is plenty
    const open = [start];
    while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (out.get(open[i]).cost < out.get(open[bi]).cost) bi = i;
        const cur = open.splice(bi, 1)[0];
        const c = out.get(cur);
        for (const [dx, dy] of DIRS) {
            const nx = c.x + dx, ny = c.y + dy;
            if (!inside(B, nx, ny)) continue;
            const k = moveCost(B, u, nx, ny);
            if (k == null) continue;
            const o = occ.get(idx(B, nx, ny));
            if (o && o.team !== u.team) continue;
            const nc = c.cost + k;
            if (nc > mv) continue;
            const ni = idx(B, nx, ny);
            const prev = out.get(ni);
            if (prev && prev.cost <= nc) continue;
            out.set(ni, { x: nx, y: ny, cost: nc, prev: cur, occ: !!o && o !== u });
            if (!open.includes(ni)) open.push(ni);
        }
    }
    return out;
}

/** Tiles the unit may end its move on. */
export function destinations(B, u, R = reach(B, u)) {
    const out = [];
    for (const [i, r] of R) if (!r.occ) out.push([r.x, r.y, i]);
    return out;
}

/** The path (list of [x, y], start included) to a reached tile. */
export function pathTo(B, R, x, y) {
    const path = [];
    let i = idx(B, x, y);
    while (i >= 0 && R.has(i)) { const r = R.get(i); path.unshift([r.x, r.y]); i = r.prev; }
    return path;
}

/** Tiles at range [lo, hi] (Manhattan) from (x, y). */
export function ring(B, x, y, lo, hi) {
    const out = [];
    for (let dy = -hi; dy <= hi; dy++) for (let dx = -hi; dx <= hi; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < lo || d > hi) continue;
        if (inside(B, x + dx, y + dy)) out.push([x + dx, y + dy]);
    }
    return out;
}

/**
 * Walking distance field to (tx, ty) for a move type, ignoring units: how many move points it takes
 * to get there. Used by the AI to approach round crags and seas, not through them.
 */
export function distField(B, u, targets) {
    const D = new Float32Array(B.w * B.h).fill(Infinity);
    const open = [];
    for (const [x, y] of targets) { const i = idx(B, x, y); D[i] = 0; open.push(i); }
    while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (D[open[i]] < D[open[bi]]) bi = i;
        const cur = open.splice(bi, 1)[0];
        const cx = cur % B.w, cy = (cur / B.w) | 0;
        // cost to step FROM a neighbour INTO cur is the cost of cur; we walk backwards, so use the
        // neighbour's own cost when moving into it from cur
        for (const [dx, dy] of DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (!inside(B, nx, ny)) continue;
            const k = moveCost(B, u, cx, cy);
            if (k == null && D[cur] > 0) continue;
            const kk = moveCost(B, u, nx, ny);
            if (kk == null) continue;
            const nd = D[cur] + (k ?? 1);
            const ni = idx(B, nx, ny);
            if (nd < D[ni]) { D[ni] = nd; if (!open.includes(ni)) open.push(ni); }
        }
    }
    return D;
}

// ------------------------------------------------------------------ Wild Hunt maps
const THEME_MIX = {
    meadow:  { base: 'plains', a: 'forest', b: 'hills', c: 'mount', water: 'shoal', sea: false },
    hills:   { base: 'plains', a: 'hills', b: 'mount', c: 'forest', water: 'shoal', sea: false },
    coast:   { base: 'plains', a: 'forest', b: 'hills', c: 'mount', water: 'shoal', sea: true },
    forest:  { base: 'forest', a: 'plains', b: 'hills', c: 'forest', water: 'shoal', sea: false },
    swamp:   { base: 'plains', a: 'swamp', b: 'forest', c: 'swamp', water: 'swamp', sea: false },
    frost:   { base: 'snow', a: 'plains', b: 'mount', c: 'hills', water: 'shoal', sea: false },
    volcano: { base: 'plains', a: 'lava', b: 'hills', c: 'mount', water: 'lava', sea: false },
};

function noise(seed, x, y, s) {
    const fx = x / s, fy = y / s;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (i, j) => hash3(x0 + i, y0 + j, seed);
    const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx, b = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
    return a + (b - a) * sy;
}

/**
 * A Wild Hunt map. Returns { w, h, tiles, own, tamer, deploy, spawns } or null if the seed made a
 * map where the two sides can't reach each other on foot (the caller tries the next seed).
 */
export function wildMap(seed, theme, w = 14, h = 10) {
    const T = THEME_MIX[theme] || THEME_MIX.meadow;
    const tiles = [], own = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = noise(seed, x, y, 3.2) * 0.65 + noise(seed + 7, x, y, 1.6) * 0.35;
        let t = T.base;
        if (n > 0.72) t = T.c; else if (n > 0.6) t = T.b; else if (n > 0.48) t = T.a;
        const wv = noise(seed + 31, x, y, 4);
        if (wv < 0.16) t = T.water;
        if (T.sea && x + y * 0.4 > w + h * 0.15 + noise(seed + 3, x, y, 3) * 3) t = 'sea';
        tiles.push(t);
        own.push(null);
    }
    const B = { w, h, tiles, own };
    const set = (x, y, t, o = null) => { tiles[y * w + x] = t; own[y * w + x] = o; };
    // the player's corner is open ground with a roost; the far side has the Chain's camp
    for (let y = h - 3; y < h; y++) for (let x = 0; x < 3; x++) set(x, y, 'plains');
    set(1, h - 2, 'roost', 'p');
    for (let y = 0; y < 3; y++) for (let x = w - 4; x < w; x++) if (tiles[y * w + x] === 'sea' || tiles[y * w + x] === 'lava') set(x, y, 'plains');
    // villages
    let placed = 0;
    for (let i = 0; i < 40 && placed < 4; i++) {
        const x = 2 + Math.floor(hash3(i, 1, seed) * (w - 4)), y = 1 + Math.floor(hash3(i, 2, seed) * (h - 2));
        const t = tiles[y * w + x];
        if (t === 'plains' || t === 'forest' || t === 'snow' || t === 'hills') { set(x, y, 'village', null); placed++; }
    }
    // a shrine or ruin, sometimes with treasure
    for (let i = 0; i < 20; i++) {
        const x = 3 + Math.floor(hash3(i, 5, seed) * (w - 6)), y = 1 + Math.floor(hash3(i, 6, seed) * (h - 2));
        if (tiles[y * w + x] !== 'sea' && tiles[y * w + x] !== 'lava') { set(x, y, hash3(i, 7, seed) < 0.5 ? 'ruins' : 'crystal'); break; }
    }
    const tamer = [0, h - 1];
    const deploy = [[1, h - 1], [0, h - 2], [2, h - 1], [0, h - 3], [2, h - 2], [1, h - 3]];
    // enemy spawn points on walkable ground on the right half
    const spawns = [];
    const walker = { mt: 'walk', traits: [] };
    for (let y = 0; y < h; y++) for (let x = Math.floor(w * 0.55); x < w; x++) {
        if (moveCost(B, walker, x, y) != null && tiles[y * w + x] !== 'village') spawns.push([x, y]);
    }
    if (spawns.length < 10) return null;
    // every spawn must be reachable from the tamer on foot
    const D = distField(B, walker, [tamer]);
    const ok = spawns.filter(([x, y]) => D[y * w + x] < Infinity);
    if (ok.length < 10) return null;
    return { w, h, tiles, own, tamer, deploy, spawns: ok };
}
