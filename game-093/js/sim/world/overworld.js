// The overmap: an authored continent grown from noise. Same for every game, so the story has a fixed geography.
//
// Regions are Voronoi cells around anchors (warped by noise), ridges cut the world into chapters, A* roads join the places
// and every place is flattened and stamped onto the terrain.

import { makeNoise } from '../../rng.js';
import { OVER_W as W, OVER_H as H, WORLD_SEED } from '../../config.js';
import { T } from './tiles.js';
import { LOCS, ROADS, RIDGES, ZONE_KEYS } from './locations.js';
import { astar } from './nav.js';

const ANCHORS = [
    ['grass', 22, 50], ['forest', 19, 30], ['plains', 46, 42], ['mountain', 64, 28], ['coast', 76, 46], ['desert', 46, 65], ['desert', 28, 66],
    ['snow', 80, 12], ['snow', 90, 20], ['ash', 46, 10], ['volcano', 8, 10], ['plains', 36, 36], ['mountain', 56, 24], ['coast', 86, 52],
];

let cache = null;
export function overworld() {
    if (cache) return cache;
    const noise = makeNoise(WORLD_SEED), n2 = makeNoise(WORLD_SEED + 11), n3 = makeNoise(WORLD_SEED + 23);
    const tile = new Uint8Array(W * H), hgt = new Int8Array(W * H), zone = new Uint8Array(W * H), blk = new Uint8Array(W * H);
    const ridge = new Uint8Array(W * H), road = new Uint8Array(W * H), lockIdx = new Uint8Array(W * H);
    const land = new Float32Array(W * H);

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const nx = Math.abs(x - 48) / 47, ny = Math.abs(y - 36) / 35;
        const d = nx * nx * nx + ny * ny * ny;
        land[i] = (1 - d) + (noise.fbm(x, y, 4, 0.07) - 0.5) * 0.7;
        // biome: nearest anchor in a noise-warped plane
        const wx = x + (n2.fbm(x, y, 3, 0.08) - 0.5) * 14, wy = y + (n2.fbm(x + 99, y + 17, 3, 0.08) - 0.5) * 14;
        let best = 1e9, bz = 0;
        for (const [k, ax, ay] of ANCHORS) { const dd = (wx - ax) ** 2 + (wy - ay) ** 2; if (dd < best) { best = dd; bz = ZONE_KEYS.indexOf(k); } }
        zone[i] = bz;
    }
    // terrain per biome
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, z = ZONE_KEYS[zone[i]];
        const e = land[i];
        if (e < 0.06) { tile[i] = T.DEEP; hgt[i] = 0; continue; }
        if (e < 0.14) { tile[i] = T.SHALLOW; hgt[i] = 0; continue; }
        const r = noise.fbm(x + 40, y + 40, 4, 0.12), r2 = n3.fbm(x, y, 3, 0.25);
        let h = 1, t = T.GRASS;
        switch (z) {
            case 'grass': h = 1 + (r > 0.55 ? 1 : 0); t = r2 > 0.78 ? T.FLOWERS : T.GRASS; break;
            case 'forest': h = 1 + Math.round(r * 2); t = r2 > 0.6 ? T.FOREST : r2 > 0.35 ? T.WOODS : T.GRASS; break;
            case 'plains': h = 1 + (r > 0.6 ? 1 : 0); t = r2 > 0.8 ? T.FLOWERS : T.GRASS; break;
            case 'mountain': h = 2 + Math.round(r * 8); t = h >= 7 ? T.ROCK : (r2 > 0.55 ? T.DIRT : T.GRASS); if (h >= 6 && r2 > 0.5) t = T.ROCK; break;
            case 'coast': h = e < 0.3 ? 1 : 1 + (r > 0.65 ? 1 : 0); t = e < 0.24 ? T.SAND : (r2 > 0.82 ? T.SWAMP : T.GRASS); break;
            case 'desert': h = 1 + Math.round(r * 3); t = r2 > 0.86 ? T.DIRT : T.SAND; break;
            case 'snow': h = 2 + Math.round(r * 5); t = h >= 6 && r2 > 0.55 ? T.ROCK : (r2 > 0.9 ? T.ICE : T.SNOW); break;
            case 'ash': h = 2 + Math.round(r * 3); t = r2 > 0.82 ? T.LAVA : (r2 > 0.7 ? T.ROCK : T.ASH); break;
            case 'volcano': { const dc = Math.hypot(x - 8, y - 10); h = Math.max(2, Math.round(9 - dc * 0.35 + r * 2)); t = r2 > 0.75 ? T.LAVA : (h >= 7 ? T.ROCK : T.ASH); break; }
        }
        if (e < 0.2 && t !== T.ROCK) t = z === 'snow' ? T.SNOW : (z === 'ash' || z === 'volcano' ? T.ASH : T.SAND);
        tile[i] = t; hgt[i] = Math.min(10, h);
    }
    // ridges: solid rock across the whole land, except the pass
    const locks = [{ flag: null, tiles: [] }];
    for (const R of RIDGES) {
        const lk = { flag: R.flag, kind: R.kind, label: R.label, tiles: [], id: R.id };
        locks.push(lk);
        for (let y = R.y0; y <= R.y1; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (tile[i] === T.DEEP) continue;
            ridge[i] = 1;
            const wob = Math.round((noise.fbm(x, y, 3, 0.2) - 0.5) * 3);
            tile[i] = T.ROCK; hgt[i] = Math.min(10, 6 + wob + (y === R.y0 || y === R.y1 ? -2 : 0));
        }
    }
    // stamp places
    for (const L of Object.values(LOCS)) {
        const lvl = 1 + (L.kind === 'dungeon' ? 1 : 0);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const x = L.x + dx, y = L.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = y * W + x, dd = Math.hypot(dx, dy);
            if (dd > 3.2) continue;
            const z = ZONE_KEYS[zone[i]];
            ridge[i] = 0; hgt[i] = lvl;
            tile[i] = dd < 2 ? (L.kind === 'town' ? T.DIRT : T.STONE) : (z === 'desert' ? T.SAND : z === 'snow' ? T.SNOW : z === 'ash' || z === 'volcano' ? T.ASH : T.GRASS);
            if (L.id === 'temple' && dd >= 2) tile[i] = T.SAND;
        }
    }
    // roads
    const foot = (x, y) => Object.values(LOCS).some((L) => Math.abs(x - L.x) <= 1 && Math.abs(y - L.y) <= 1 && !(x === L.x && y === L.y + 1));
    const cost = (x, y) => {
        const i = y * W + x;
        if (foot(x, y)) return Infinity;
        if (ridge[i]) { const R = RIDGES.find((r) => y >= r.y0 && y <= r.y1); return Math.abs(x - R.passX) <= 1 ? 1 : Infinity; }
        const t = tile[i];
        let c = 1;
        if (t === T.DEEP) c = 14; else if (t === T.SHALLOW) c = 6; else if (t === T.ROCK) c = 16; else if (t === T.LAVA) c = 30; else if (t === T.FOREST) c = 9;
        if (road[i]) c = 0.4;
        return c;
    };
    const paths = {};
    for (const [a, b] of ROADS) {
        const A = LOCS[a], B = LOCS[b];
        // roads must pass through the gap: route via the pass when they cross a ridge
        const stops = [[A.x, A.y + 2]];
        for (const R of RIDGES) {
            const cross = (A.y < R.y0 && B.y > R.y1) || (B.y < R.y0 && A.y > R.y1);
            if (cross) stops.push([R.passX, A.y < R.y0 ? R.y0 - 1 : R.y1 + 1], [R.passX, A.y < R.y0 ? R.y1 + 1 : R.y0 - 1]);
        }
        stops.push([B.x, B.y + 2]);
        const full = [];
        for (let s = 0; s + 1 < stops.length; s++) {
            const p = astar(W, H, stops[s][0], stops[s][1], stops[s + 1][0], stops[s + 1][1], cost, { four: true });
            if (p) full.push(...p);
        }
        paths[a + '-' + b] = full;
        // the road itself: dirt, or a bridge over water; heights eased to climbable steps
        const hs = full.map(([x, y]) => hgt[y * W + x]);
        for (let k = 1; k < hs.length; k++) hs[k] = Math.max(hs[k - 1] - 1, Math.min(hs[k - 1] + 1, hs[k]));
        for (let k = hs.length - 2; k >= 0; k--) hs[k] = Math.max(hs[k + 1] - 1, Math.min(hs[k + 1] + 1, hs[k]));
        full.forEach(([x, y], k) => {
            const i = y * W + x;
            const wasWater = tile[i] === T.DEEP || tile[i] === T.SHALLOW;
            tile[i] = wasWater ? T.BRIDGE : T.DIRT; hgt[i] = wasWater ? Math.max(1, hs[k]) : hs[k]; road[i] = 1;
            if (!wasWater) { const z = ZONE_KEYS[zone[i]]; if (z === 'snow') tile[i] = T.SNOW; }
        });
    }
    // cliffs next to roads: lower any neighbour that would make a wall the road can't climb beside, so the shoulders read as slopes
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!road[i]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = (y + dy) * W + (x + dx);
            if (road[j] || tile[j] === T.DEEP || tile[j] === T.SHALLOW || ridge[j]) continue;
            if (hgt[j] > hgt[i] + 1 && tile[j] !== T.ROCK) hgt[j] = hgt[i] + 1;
        }
    }
    // passes: the gap tiles are the locks
    for (const [k, R] of RIDGES.entries()) {
        for (let y = R.y0; y <= R.y1; y++) for (let x = R.passX - 1; x <= R.passX + 1; x++) {
            const i = y * W + x;
            if (!ridge[i] && tile[i] !== T.DIRT && tile[i] !== T.SNOW && tile[i] !== T.SAND) continue;
            ridge[i] = 0;
            if (tile[i] === T.ROCK) { tile[i] = R.id === 'ice' ? T.SNOW : T.SAND; }
            lockIdx[i] = k + 1; locks[k + 1].tiles.push(i);
        }
        // a flat floor through the gap
        const ys = []; for (let y = R.y0; y <= R.y1; y++) ys.push(y);
        const hh = hgt[(R.y0 - 1) * W + R.passX];
        for (const y of ys) for (let x = R.passX - 1; x <= R.passX + 1; x++) { const i = y * W + x; if (lockIdx[i]) hgt[i] = hh; }
    }
    // props: the places
    const props = [], exits = [];
    for (const L of Object.values(LOCS)) {
        props.push({ type: 'loc', loc: L.id, kind: L.kind, x: L.x, y: L.y, optional: !!L.optional });
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 1) continue;
            blk[(L.y + dy) * W + L.x + dx] = 1;
        }
        exits.push({ x: L.x, y: L.y + 1, to: L.id });
    }
    // roads keep a clear shoulder of rock out of their way
    for (let i = 0; i < W * H; i++) if (road[i] && tile[i] === T.ROCK) tile[i] = T.DIRT;
    cache = { id: 'over', kind: 'over', name: 'The Overmap', w: W, h: H, tile, hgt, blk, zone, road, lockIdx, locks, props, exits, npcs: [], mobs: [], lights: [], paths };
    return cache;
}

/** ASCII dump for debugging the shape of the world. */
export function dumpOverworld() {
    const m = overworld();
    const ch = { [T.DEEP]: '~', [T.SHALLOW]: '-', [T.GRASS]: '.', [T.WOODS]: 'f', [T.FOREST]: 'F', [T.SAND]: ',', [T.SNOW]: '*', [T.ROCK]: '^', [T.DIRT]: '=', [T.STONE]: 'o', [T.LAVA]: '%', [T.ICE]: 'i', [T.BRIDGE]: '#', [T.SWAMP]: 's', [T.FLOWERS]: ':', [T.ASH]: 'a' };
    const rows = [];
    for (let y = 0; y < m.h; y++) { let s = ''; for (let x = 0; x < m.w; x++) s += ch[m.tile[y * m.w + x]] || '?'; rows.push(s); }
    for (const L of Object.values(LOCS)) { const r = rows[L.y].split(''); r[L.x] = L.kind === 'town' ? 'T' : 'D'; rows[L.y] = r.join(''); }
    return rows.join('\n');
}
