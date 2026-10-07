/**
 * mapgen.js — a seeded stretch of road from the woods to the Haven.
 *
 * The main road is a chain of waypoints with strictly increasing x, joined by L-shaped legs. A
 * candidate is kept only if it's a simple path, no road tile touches another road tile except its
 * neighbours along the road, and it's long enough. An optional second road comes in from the top or
 * bottom edge, jogs once and joins the main road at a T, under the same no-touching rule. Then the
 * scenery goes down by theme, never on the road and never crowding the roadside.
 *
 * Tile kinds: 0 grass (buildable), 1 road, 2 Haven, 3 scenery (blocked).
 */

import { W, H, HAVEN_COLS } from '../config.js';
import { RNG, Noise2, hashStr } from '../rng.js';

export const GRASS = 0, ROAD = 1, HAVEN = 2, BLOCK = 3;
export const GATE_X = W - HAVEN_COLS - 1;      // last road column, just outside the Haven
export const MIN_ROAD = 34;

export const idx = (x, z) => z * W + x;
export const inside = (x, z) => x >= 0 && z >= 0 && x < W && z < H;

// ------------------------------------------------------------------ the main road
function legTiles(out, x0, z0, x1, z1, hFirst) {
    const push = (x, z) => { const l = out[out.length - 1]; if (!l || l[0] !== x || l[1] !== z) out.push([x, z]); };
    const walkH = (z, xa, xb) => { const s = Math.sign(xb - xa) || 1; for (let x = xa; ; x += s) { push(x, z); if (x === xb) break; } };
    const walkV = (x, za, zb) => { const s = Math.sign(zb - za) || 1; for (let z = za; ; z += s) { push(x, z); if (z === zb) break; } };
    if (hFirst) { walkH(z0, x0, x1); walkV(x1, z0, z1); } else { walkV(x0, z0, z1); walkH(z1, x0, x1); }
}

/** True if `tiles` is a simple path whose tiles touch only their neighbours along it. */
export function pathIsClean(tiles, extra = null) {
    const at = new Map();
    tiles.forEach(([x, z], i) => at.set(idx(x, z), i));
    if (at.size !== tiles.length) return false;
    for (let i = 0; i < tiles.length; i++) {
        const [x, z] = tiles[i];
        if (!inside(x, z)) return false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = at.get(idx(x + dx, z + dz));
            if (j !== undefined && Math.abs(j - i) !== 1) return false;
            if (extra && extra(x + dx, z + dz, i)) return false;
        }
    }
    return true;
}

function mainRoad(rng) {
    for (let attempt = 0; attempt < 400; attempt++) {
        const z0 = rng.int(2, H - 3);
        const pts = [[0, z0]];
        let x = 0, z = z0;
        while (x < GATE_X - 4) {
            const nx = Math.min(GATE_X - 3, x + rng.int(2, 5));
            let nz;
            do { nz = rng.int(1, H - 2); } while (Math.abs(nz - z) === 1);
            pts.push([nx, nz]);
            x = nx; z = nz;
        }
        const gz = rng.chance(0.5) ? z : rng.int(2, H - 3);
        pts.push([GATE_X, gz]);
        const tiles = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
            const hFirst = i === 0 ? true : i === pts.length - 2 ? false : rng.chance(0.5);
            legTiles(tiles, ax, az, bx, bz, hFirst);
        }
        // The road must leave the west edge heading east and meet the gate heading east.
        if (tiles[1][1] !== tiles[0][1]) continue;
        const n = tiles.length;
        if (tiles[n - 1][0] !== GATE_X || tiles[n - 2][1] !== tiles[n - 1][1]) continue;
        if (n < MIN_ROAD || n > 64) continue;
        if (!pathIsClean(tiles)) continue;
        return tiles;
    }
    return null;
}

// ------------------------------------------------------------------ the second road
function branchRoad(rng, main) {
    const onMain = new Map();
    main.forEach(([x, z], i) => onMain.set(idx(x, z), i));
    for (let attempt = 0; attempt < 300; attempt++) {
        const fromTop = rng.chance(0.5);
        const sz = fromTop ? 1 : -1;
        let x = rng.int(3, 13), z = fromTop ? 0 : H - 1;
        const jogAt = rng.int(2, 4), jog = rng.pick([-3, -2, 2, 3]);
        const tiles = [];
        let ok = true, join = -1;
        for (let step = 0; step < 40 && ok; step++) {
            tiles.push([x, z]);
            if (onMain.has(idx(x, z))) { ok = false; break; }
            // reached a tile beside the main road, straight ahead?
            const ahead = onMain.get(idx(x, z + sz));
            if (ahead !== undefined) { join = ahead; break; }
            if (step === jogAt) {
                const tx = x + jog, s = Math.sign(jog);
                while (x !== tx) { x += s; tiles.push([x, z]); if (onMain.has(idx(x, z))) { ok = false; break; } }
                tiles.pop();
                continue;
            }
            z += sz;
            if (!inside(x, z)) { ok = false; break; }
        }
        if (!ok || join < 0 || tiles.length < 5) continue;
        if (main.length - join < 14 || join < 6) continue;
        // No branch tile may touch the main road except the last one, which touches only the join tile.
        const last = tiles.length - 1;
        const clean = pathIsClean(tiles, (nx, nz, i) => {
            const m = onMain.get(idx(nx, nz));
            if (m === undefined) return false;
            return !(i === last && m === join);
        });
        if (!clean) continue;
        // ...and nothing beside the last tile other than the join tile on the main road.
        const [lx, lz] = tiles[last];
        let touches = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (onMain.has(idx(lx + dx, lz + dz))) touches++;
        if (touches !== 1) continue;
        return { tiles, join, fromTop };
    }
    return null;
}

// ------------------------------------------------------------------ routes
/** A polyline in tile units with cumulative lengths; corners are chamfered so walkers round them. */
export class Route {
    constructor(pts) {
        // chamfer every corner
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const a = pts[i - 1], b = pts[i], c = pts[i + 1];
            const d1x = Math.sign(b.x - a.x), d1z = Math.sign(b.z - a.z), d2x = Math.sign(c.x - b.x), d2z = Math.sign(c.z - b.z);
            if (d1x === d2x && d1z === d2z) continue;
            const r = 0.36;
            out.push({ x: b.x - d1x * r, z: b.z - d1z * r });
            out.push({ x: b.x - d1x * r * 0.3 + d2x * r * 0.3, z: b.z - d1z * r * 0.3 + d2z * r * 0.3 });
            out.push({ x: b.x + d2x * r, z: b.z + d2z * r });
        }
        out.push(pts[pts.length - 1]);
        this.pts = out;
        this.cum = [0];
        for (let i = 1; i < out.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z));
        this.length = this.cum[this.cum.length - 1];
        this._seg = 0;
    }
    /** Position and heading at distance d. Writes into `o` to avoid garbage. */
    at(d, o = {}) {
        d = Math.max(0, Math.min(this.length, d));
        let lo = 0, hi = this.cum.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= d) lo = m; else hi = m; }
        const a = this.pts[lo], b = this.pts[hi];
        const L = this.cum[hi] - this.cum[lo] || 1;
        const t = (d - this.cum[lo]) / L;
        o.x = a.x + (b.x - a.x) * t;
        o.z = a.z + (b.z - a.z) * t;
        o.dx = (b.x - a.x) / L;
        o.dz = (b.z - a.z) / L;
        return o;
    }
    /** Distance along the route of the point nearest (x, z). */
    nearest(x, z) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < this.pts.length - 1; i++) {
            const a = this.pts[i], b = this.pts[i + 1];
            const L = this.cum[i + 1] - this.cum[i] || 1;
            const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (L * L)));
            const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
            const dd = (px - x) ** 2 + (pz - z) ** 2;
            if (dd < bd) { bd = dd; best = this.cum[i] + t * L; }
        }
        return best;
    }
}

function routeFrom(tiles, start, gz) {
    const pts = [start, ...tiles.map(([x, z]) => ({ x: x + 0.5, z: z + 0.5 }))];
    pts.push({ x: W - HAVEN_COLS + 0.4, z: gz + 0.5 });
    pts.push({ x: W - 1.2, z: gz + 0.5 });
    return new Route(pts);
}

// ------------------------------------------------------------------ scenery
// Blocking scenery per theme: [type, weight]. Sizes are in tiles.
const SCENERY = {
    autumn: [['grove', 5], ['house', 3], ['barn', 1], ['hay', 2], ['orchard', 2], ['well', 1], ['car', 1], ['pond', 1]],
    winter: [['pines', 6], ['cabin', 3], ['mill', 1], ['pond', 1], ['woodpile', 2], ['car', 1], ['snowman', 1]],
    city:   [['terrace', 4], ['shop', 3], ['car', 3], ['bus', 1], ['park', 2], ['kiosk', 1], ['fountain', 1]],
};
const SIZE = { barn: [2, 2], pond: [2, 2], mill: [2, 2], bus: [2, 1], fountain: [2, 2], terrace: [1, 1] };

function placeScenery(rng, grid, theme, noise) {
    const items = [];
    const nearRoad = (x, z) => {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, nz = z + dz;
            if (inside(nx, nz) && grid[idx(nx, nz)] === ROAD) return true;
        }
        return false;
    };
    let near = 0;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (grid[idx(x, z)] === GRASS && nearRoad(x, z)) near++;
    let nearBlocked = 0;
    const table = SCENERY[theme];
    const total = table.reduce((s, [, w]) => s + w, 0);
    const pickType = () => { let r = rng.next() * total; for (const [t, w] of table) { r -= w; if (r <= 0) return t; } return table[0][0]; };
    const order = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < GATE_X + 1; x++) order.push([x, z]);
    rng.shuffle(order);
    for (const [x, z] of order) {
        if (grid[idx(x, z)] !== GRASS) continue;
        const n = noise.fbm(x * 0.22, z * 0.22, 3);
        const edge = (z === 0 || z === H - 1 || x === 0) ? 0.18 : 0;
        const isNear = nearRoad(x, z);
        const p = (n - 0.42) * 1.6 + edge - (isNear ? 0.25 : 0);
        if (rng.next() > p) continue;
        const type = pickType();
        const [sw, sh] = SIZE[type] || [1, 1];
        const rot = rng.int(0, 3);
        const [fw, fh] = rot % 2 ? [sh, sw] : [sw, sh];
        let fits = true, nearCount = 0;
        for (let dz = 0; dz < fh && fits; dz++) for (let dx = 0; dx < fw; dx++) {
            const tx = x + dx, tz = z + dz;
            if (!inside(tx, tz) || tx > GATE_X || grid[idx(tx, tz)] !== GRASS) { fits = false; break; }
            if (nearRoad(tx, tz)) nearCount++;
        }
        if (!fits) continue;
        if (nearCount && (nearBlocked + nearCount) > near * 0.2) continue;
        nearBlocked += nearCount;
        for (let dz = 0; dz < fh; dz++) for (let dx = 0; dx < fw; dx++) grid[idx(x + dx, z + dz)] = BLOCK;
        items.push({ type, x, z, w: fw, h: fh, rot, v: rng.int(0, 1000) });
    }
    return items;
}

/** Small things scattered on open grass (flowers, tufts, stones, leaves): drawn only, never blocking. */
function clutter(rng, grid) {
    const out = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (grid[idx(x, z)] !== GRASS) continue;
        const n = rng.int(0, 3);
        for (let i = 0; i < n; i++) out.push({ x: x + rng.range(0.1, 0.9), z: z + rng.range(0.1, 0.9), k: rng.int(0, 3), s: rng.range(0.6, 1.2), r: rng.range(0, 6.283) });
    }
    return out;
}

// ------------------------------------------------------------------ public
/**
 * Generate a map. `opts`: { seed, theme, branch (bool) }. Deterministic in its options.
 * Returns { grid, road, branch, routes, scenery, clutter, gateZ, seed, theme }.
 */
export function generateMap({ seed, theme = 'autumn', branch = false }) {
    const base = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
    for (let sub = 0; sub < 200; sub++) {
        const rng = new RNG((base + sub * 0x9e3779b1) >>> 0);
        const road = mainRoad(rng);
        if (!road) continue;
        let br = null;
        if (branch) { br = branchRoad(rng, road); if (!br) continue; }
        const grid = new Uint8Array(W * H);
        for (let z = 0; z < H; z++) for (let x = GATE_X + 1; x < W; x++) grid[idx(x, z)] = HAVEN;
        for (const [x, z] of road) grid[idx(x, z)] = ROAD;
        if (br) for (const [x, z] of br.tiles) grid[idx(x, z)] = ROAD;
        const gateZ = road[road.length - 1][1];
        const routes = [routeFrom(road, { x: -1.2, z: road[0][1] + 0.5 }, gateZ)];
        if (br) {
            const t = [...br.tiles, ...road.slice(br.join)];
            const [bx, bz] = br.tiles[0];
            routes.push(routeFrom(t, { x: bx + 0.5, z: br.fromTop ? -1.2 : H + 1.2 }, gateZ));
        }
        const noise = new Noise2((base ^ 0x51ed) + sub);
        const scenery = placeScenery(rng, grid, theme, noise);
        return { grid, road, branch: br, routes, scenery, clutter: clutter(rng, grid), gateZ, seed: base, sub, theme };
    }
    throw new Error(`no map for seed ${seed}`);
}

/** Tiles a station may stand on. */
export const buildable = (map, x, z) => inside(x, z) && map.grid[idx(x, z)] === GRASS;

/** Shortest distance (in tiles) from a tile centre to the road centre line of any route. */
export function distToRoad(map, x, z) {
    let best = Infinity;
    for (const [rx, rz] of map.road) best = Math.min(best, Math.hypot(rx - x, rz - z));
    if (map.branch) for (const [rx, rz] of map.branch.tiles) best = Math.min(best, Math.hypot(rx - x, rz - z));
    return best;
}
