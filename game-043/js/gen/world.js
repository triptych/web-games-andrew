// ============================================================
// The overworld: the Glen in the middle, a ring of ancient thicket,
// and five biome sectors around it, each reached through one gate.
// Pure and deterministic: same seed → same arrays.
// ============================================================

import { rngFor, makeNoise, mod } from '../core/rng.js';
import { astar, flood } from '../core/grid.js';
import { G, O, G_BLOCK } from '../data/tiles.js';
import { BIOMES } from '../data/monsters.js';
import { LOT_W, LOT_H } from '../data/buildings.js';
import { regionName, siteName, glenName } from './names.js';

export const WW = 160, WH = 160;
export const GLEN_R = 26, RING_R = 30, OUTER_R = 76;
const TAU = Math.PI * 2, SECTOR = TAU / 5;

// objects that are permanent walls regardless of tools
export const PERMA_BLOCK = new Set([O.OLDTREE, O.FACADE, O.HEART, O.RUIN, O.SIGN, O.LOTSIGN, O.BOARD, O.BIN]);

export function generateWorld(seed) {
    const W = WW, H = WH, N = W * H;
    const cx = W >> 1, cy = H >> 1;
    const rng = rngFor(seed, 'world');
    const ground = new Uint8Array(N), obj = new Uint8Array(N), ov = new Uint8Array(N), region = new Uint8Array(N);
    const road = new Uint8Array(N);          // 1 = road, 2 = reserved (glen furniture)
    const gateMask = new Uint8Array(N);      // gate and pocket obstacles: never paved over
    const nWob = makeNoise(rngFor(seed, 'wob').next() * 1e9 | 0);
    const nElev = makeNoise(rngFor(seed, 'elev').next() * 1e9 | 0);
    const nMoist = makeNoise(rngFor(seed, 'moist').next() * 1e9 | 0);
    const nDet = makeNoise(rngFor(seed, 'det').next() * 1e9 | 0);
    const idx = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    // ---------------------------------------------------------------- sectors
    const a0 = rng.range(0, TAU);
    const perm = rng.shuffle([0, 1, 2, 3, 4]);           // biome k → sector perm[k]
    const sectorBiome = [];
    perm.forEach((s, k) => { sectorBiome[s] = k; });
    const regions = BIOMES.map((b, k) => {
        const rr = rngFor(seed, 'region', k);
        return {
            idx: k + 1, biome: b, elem: b.elem, angle: a0 + perm[k] * SECTOR,
            name: regionName(rr, b), hue: rr.range(-14, 14), sat: rr.range(0.9, 1.1),
            hub: null, sites: [], gate: null,
        };
    });
    const glen = { name: glenName(rngFor(seed, 'glenname')), hue: rngFor(seed, 'glenhue').range(-10, 10) };

    const angDiff = (a, b) => { const d = mod(a - b + Math.PI, TAU) - Math.PI; return d; };

    // ---------------------------------------------------------------- region map
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const wob = (nWob(x / 9, y / 9, 3) - 0.5) * 4;
        if (r < GLEN_R + wob * 0.3) { region[i] = 0; continue; }
        if (r < RING_R + wob * 0.5) { region[i] = 255; ground[i] = G.GRASS2; obj[i] = O.OLDTREE; continue; }
        const rel = mod(a - a0 + SECTOR / 2, TAU);
        const s = Math.floor(rel / SECTOR) % 5;
        const off = rel - s * SECTOR;                      // 0..SECTOR, boundary at 0 and SECTOR
        const tang = Math.min(off, SECTOR - off) * r;
        const edge = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
        const k = sectorBiome[s];
        if (edge || r > OUTER_R + wob * 1.5) {
            region[i] = 255;
            const b = BIOMES[k].id;
            if (b === 'lake') ground[i] = G.WATER;
            else if (b === 'forest') { ground[i] = G.GRASS2; obj[i] = O.OLDTREE; }
            else ground[i] = G.CLIFF;
            continue;
        }
        if (tang < 1.7 + wob * 0.35) { region[i] = 255; ground[i] = G.CLIFF; continue; }
        region[i] = k + 1;
    }

    function terrainGlen(i, x, y, e, m, d, h) {
        ground[i] = m > 0.55 ? G.GRASS2 : G.GRASS;
        if (h < 0.05) obj[i] = O.FLOWER, ov[i] = (h * 1000) | 0;
        else if (h < 0.075) obj[i] = O.TUFT;
        else if (h < 0.085) obj[i] = O.WEED;
    }
    const terrain = {
        forest(i, e, m, d, h) {
            ground[i] = m > 0.5 ? G.GRASS2 : G.GRASS;
            if (e < 0.26) { ground[i] = G.WATER; return; }
            if (e < 0.29) { ground[i] = G.SAND; return; }
            if (d > 0.56 && h < 0.8) obj[i] = h < 0.12 ? O.PINE : O.TREE;
            else if (h < 0.05) obj[i] = O.BUSH;
            else if (h < 0.08) obj[i] = O.TUFT;
            else if (h < 0.1) obj[i] = O.FLOWER, ov[i] = (h * 997) | 0;
            else if (h < 0.11) obj[i] = O.ROCK;
            else if (h < 0.115) obj[i] = O.STUMP;
        },
        downs(i, e, m, d, h) {
            ground[i] = m > 0.62 ? G.GRASS2 : G.GRASS;
            if (e < 0.2) { ground[i] = G.WATER; return; }
            if (d > 0.72 && h < 0.6) obj[i] = O.TREE;
            else if (h < 0.1) obj[i] = O.FLOWER, ov[i] = (h * 997) | 0;
            else if (h < 0.16) obj[i] = O.TUFT;
            else if (h < 0.185) obj[i] = O.ROCK;
            else if (h < 0.195) obj[i] = O.BIGROCK;
            else if (h < 0.21) obj[i] = O.BUSH;
        },
        lake(i, e, m, d, h) {
            ground[i] = m > 0.5 ? G.MARSH : G.GRASS;
            if (e < 0.34) { ground[i] = G.WATER; return; }
            if (e < 0.38) { ground[i] = G.SHALLOW; if (h < 0.15) obj[i] = O.LILY; return; }
            if (e < 0.41) { ground[i] = G.SAND; if (h < 0.1) obj[i] = O.REED; return; }
            if (d > 0.66 && h < 0.5) obj[i] = O.TREE;
            else if (h < 0.1) obj[i] = O.REED;
            else if (h < 0.14) obj[i] = O.TUFT;
            else if (h < 0.16) obj[i] = O.FLOWER, ov[i] = (h * 997) | 0;
            else if (h < 0.175) obj[i] = O.ROCK;
        },
        crags(i, e, m, d, h) {
            ground[i] = m > 0.55 ? G.ASH : G.ROCKY;
            if (e < 0.22) { ground[i] = G.LAVA; return; }
            if (e > 0.78) { ground[i] = G.CLIFF; return; }
            if (d > 0.7 && h < 0.35) obj[i] = O.DEADTREE;
            else if (h < 0.07) obj[i] = O.ROCK;
            else if (h < 0.085) obj[i] = O.BIGROCK;
            else if (h < 0.1) obj[i] = O.CRYSTAL;
            else if (h < 0.104) obj[i] = O.ORE, ov[i] = 2;
        },
        heights(i, e, m, d, h) {
            ground[i] = G.SNOW;
            if (e < 0.25) { ground[i] = G.ICE; return; }
            if (e > 0.8) { ground[i] = G.CLIFF; return; }
            if (d > 0.58 && h < 0.75) obj[i] = O.PINE;
            else if (h < 0.06) obj[i] = O.ROCK;
            else if (h < 0.075) obj[i] = O.CRYSTAL;
            else if (h < 0.08) obj[i] = O.ORE, ov[i] = 3;
            else if (h < 0.09) obj[i] = O.BUSH;
        },
    };

    // ---------------------------------------------------------------- biome terrain
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y), rg = region[i];
        if (rg === 255) continue;
        const e = nElev(x / 16, y / 16), m = nMoist(x / 11, y / 11), d = nDet(x / 4.3, y / 4.3);
        const h = rngFor(seed, 't', i).next();
        if (rg === 0) { terrainGlen(i, x, y, e, m, d, h); continue; }
        const b = BIOMES[rg - 1].id;
        terrain[b](i, e, m, d, h);
    }

    // ---------------------------------------------------------------- the Glen
    const clearRect = (x0, y0, w, h, g = null) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
            const i = idx(x, y); obj[i] = O.NONE; ov[i] = 0; if (g !== null) ground[i] = g;
        }
    };
    const reserve = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) road[idx(x, y)] = 2; };

    // plaza
    for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (r <= 6.2) { const i = idx(x, y); obj[i] = O.NONE; ground[i] = r <= 5.5 ? G.PLAZA : G.PATH; road[i] = 2; }
    }
    // heartwood (4x4, top-left at cx-2, cy-2)
    const heart = { x: cx - 2, y: cy - 2, w: 4, h: 4 };
    for (let y = heart.y; y < heart.y + 4; y++) for (let x = heart.x; x < heart.x + 4; x++) { obj[idx(x, y)] = O.HEART; ground[idx(x, y)] = G.GRASS2; }
    // mayor's hall (building entity) north of plaza
    const hall = { id: 'hall', x: cx - 2, y: cy - 11, w: 4, h: 3 };
    clearRect(hall.x - 1, hall.y - 1, 6, 6, G.GRASS); reserve(hall.x - 1, hall.y - 1, 6, 6);
    for (let y = hall.y + 3; y < cy - 5; y++) { ground[idx(cx, y)] = G.PATH; ground[idx(cx - 1, y)] = G.PATH; }
    // job board site
    const board = { x: cx + 3, y: cy - 7 };
    clearRect(board.x - 1, board.y - 1, 3, 3); reserve(board.x - 1, board.y - 1, 3, 3);
    obj[idx(board.x, board.y)] = O.BOARD;
    // cabin + farm + pond, south-west
    const cabin = { id: 'cabin', x: cx - 12, y: cy + 5, w: 4, h: 3 };
    const bin = { x: cx - 7, y: cy + 7 };
    const farm = { x: cx - 13, y: cy + 10, w: 12, h: 7 };
    const pond = { x: cx + 0, y: cy + 11, w: 3, h: 3 };
    clearRect(cabin.x - 1, cabin.y - 1, 7, 5, G.GRASS); reserve(cabin.x - 2, cabin.y - 2, 9, 6);
    obj[idx(bin.x, bin.y)] = O.BIN;
    for (let y = farm.y; y < farm.y + farm.h; y++) for (let x = farm.x; x < farm.x + farm.w; x++) {
        const i = idx(x, y); ground[i] = G.FARM; road[i] = 2;
        const h = rngFor(seed, 'farm', i).next();
        obj[i] = h < 0.22 ? O.WEED : h < 0.3 ? O.ROCK : h < 0.36 ? O.TUFT : h < 0.39 ? O.STUMP : O.NONE;
    }
    reserve(farm.x - 1, farm.y - 1, farm.w + 2, farm.h + 2);
    for (let y = pond.y; y < pond.y + pond.h; y++) for (let x = pond.x; x < pond.x + pond.w; x++) { ground[idx(x, y)] = G.WATER; obj[idx(x, y)] = O.NONE; }
    ground[idx(pond.x, pond.y)] = G.SHALLOW; ground[idx(pond.x + 2, pond.y + 2)] = G.SHALLOW;
    reserve(pond.x - 1, pond.y - 1, pond.w + 2, pond.h + 2);
    // path from plaza to cabin
    for (let x = cabin.x + 2; x <= cx - 5; x++) ground[idx(x, cabin.y + 3)] = G.PATH;
    for (let y = cabin.y + 3; y >= cy + 4; y--) ground[idx(cx - 5, y)] = G.PATH;

    // ---------------------------------------------------------------- gates and roads
    const glenStart = idx(cx, cy + 6);
    const roadCost = (allowRegion) => i => {
        const x = i % W, y = (i / W) | 0;
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return Infinity;
        const rg = region[i];
        if (!allowRegion(rg, i)) return Infinity;
        if (road[i] === 2) return Infinity;
        if (obj[i] === O.HEART || obj[i] === O.OLDTREE || obj[i] === O.FACADE) return Infinity;
        const g = ground[i];
        if (g === G.VOID || (g === G.CLIFF && rg === 255)) return Infinity;
        let c = road[i] === 1 ? 0.4 : 1;
        if (g === G.CLIFF) c += 7;
        if (g === G.WATER || g === G.LAVA) c += 6;
        else if (g === G.SHALLOW) c += 4;
        if (obj[i] && obj[i] !== O.FLOWER && obj[i] !== O.TUFT) c += 1.5;
        return c;
    };
    function paveTile(i, keepGate = false) {
        const g = ground[i];
        if (g === G.WATER || g === G.LAVA || (g === G.SHALLOW && !gateMask[i])) ground[i] = G.BRIDGE;
        else if (g !== G.PLAZA && g !== G.FARM && g !== G.BRIDGE && (g !== G.SHALLOW || !gateMask[i])) ground[i] = G.PATH;
        if (!gateMask[i] && obj[i] !== O.HEART) { obj[i] = O.NONE; ov[i] = 0; }
        road[i] = road[i] || 1;
    }
    const isGateObj = o => o === O.THORN || o === O.BOULDER || o === O.DARK;
    function carve(path, { width = 1, pave = true } = {}) {
        if (!path) return false;
        for (const i of path) {
            if (pave) paveTile(i, true);
            else trailTile(i);
            if (width > 1) {
                const x = i % W, y = (i / W) | 0;
                for (const [dx, dy] of [[1, 0], [0, 1]]) {
                    const j = idx(x + dx, y + dy);
                    if (inb(x + dx, y + dy) && region[j] === region[i] && road[j] !== 2 && !gateMask[j] && !G_BLOCK.has(ground[j]) && obj[j] !== O.OLDTREE && !isGateObj(obj[j])) {
                        if (obj[j] !== O.HEART && obj[j] !== O.FACADE) { obj[j] = O.NONE; }
                    }
                }
            }
        }
        return true;
    }
    function trailTile(i) {
        const g = ground[i];
        if (gateMask[i]) return;
        if (g === G.WATER || g === G.LAVA || g === G.SHALLOW) ground[i] = G.BRIDGE;
        else if (g === G.CLIFF && region[i] !== 255) ground[i] = G.PATH;
        if (obj[i] !== O.HEART && obj[i] !== O.FACADE) { obj[i] = O.NONE; ov[i] = 0; }
    }

    for (const R of regions) {
        // corridor through the thicket ring along the region's centre angle
        const ang = R.angle, ux = Math.cos(ang), uy = Math.sin(ang);
        const gateTiles = [];
        for (let r = GLEN_R - 3; r <= RING_R + 4; r += 0.35) {
            for (let w = -1.2; w <= 1.2; w += 0.4) {
                const x = Math.floor(cx + ux * r - uy * w), y = Math.floor(cy + uy * r + ux * w);
                const i = idx(x, y);
                if (road[i] === 2) continue;
                if (region[i] === 255) region[i] = R.idx;
                if (region[i] !== 0 && region[i] !== R.idx) continue;
                obj[i] = O.NONE; ov[i] = 0;
                ground[i] = G.PATH; road[i] = 1;
                if (r >= RING_R - 1.6 && r <= RING_R + 0.6) gateTiles.push(i);
            }
        }
        const gk = R.biome.gate;
        const uniq = [...new Set(gateTiles)];
        for (const i of uniq) {
            if (gk) gateMask[i] = 1;
            if (gk === 'thorn') obj[i] = O.THORN;
            else if (gk === 'boulder') obj[i] = O.BOULDER;
            else if (gk === 'shallows') { ground[i] = G.SHALLOW; obj[i] = O.LILY; }
            else if (gk === 'dark') obj[i] = O.DARK;
        }
        R.gate = { kind: gk, tiles: uniq };
        const outer = idx(Math.floor(cx + ux * (RING_R + 4)), Math.floor(cy + uy * (RING_R + 4)));
        const inner = idx(Math.floor(cx + ux * (GLEN_R - 3)), Math.floor(cy + uy * (GLEN_R - 3)));
        R.gate.inner = inner; R.gate.outer = outer;
        // Glen road: plaza → corridor inner end
        const p1 = astar(W, H, nearestPlazaEdge(inner), inner, roadCost(rg => rg === 0));
        carve(p1);
        // hub
        const hubR = 41;
        let hx = Math.floor(cx + ux * hubR), hy = Math.floor(cy + uy * hubR);
        R.hub = { x: hx, y: hy };
        clearArea(hx, hy, 2, R.idx, true);
        const p2 = astar(W, H, outer, idx(hx, hy), roadCost(rg => rg === R.idx));
        carve(p2, { width: 2 });
        for (const [sx, sy] of [[2, -2], [-2, -2], [2, 2], [-2, 2], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
            const si = idx(hx + sx, hy + sy);
            if (road[si] || G_BLOCK.has(ground[si]) || ground[si] === G.SHALLOW || ground[si] === G.BRIDGE || region[si] !== R.idx) continue;
            obj[si] = O.SIGN; ov[si] = R.idx; break;
        }
    }
    function nearestPlazaEdge(target) {
        const tx = target % W, ty = (target / W) | 0;
        const a = Math.atan2(ty - cy, tx - cx);
        return idx(Math.floor(cx + Math.cos(a) * 6.5), Math.floor(cy + Math.sin(a) * 6.5));
    }
    function clearArea(x0, y0, rad, rg, pave = false) {
        for (let y = y0 - rad; y <= y0 + rad; y++) for (let x = x0 - rad; x <= x0 + rad; x++) {
            if (!inb(x, y)) continue;
            const i = idx(x, y);
            if (region[i] !== rg) continue;
            if (G_BLOCK.has(ground[i]) || ground[i] === G.SHALLOW) ground[i] = pave ? G.PATH : grassFor(rg);
            obj[i] = O.NONE; ov[i] = 0;
            if (pave) ground[i] = G.PATH;
        }
    }
    function grassFor(rg) {
        if (rg === 0) return G.GRASS;
        const b = BIOMES[rg - 1].id;
        return b === 'crags' ? G.ROCKY : b === 'heights' ? G.SNOW : b === 'lake' ? G.MARSH : G.GRASS;
    }

    // ---------------------------------------------------------------- lots
    const lots = [];
    {
        for (let relax = 0; relax < 3 && lots.length < 18; relax++) {
        lots.length = 0;
        const cands = [];
        for (let y = cy - GLEN_R; y <= cy + GLEN_R; y++) for (let x = cx - GLEN_R; x <= cx + GLEN_R; x++) {
            let ok = true;
            for (let yy = y; yy < y + LOT_H && ok; yy++) for (let xx = x; xx < x + LOT_W && ok; xx++) {
                const i = idx(xx, yy);
                if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) > GLEN_R - 1.5 + relax * 0.6) ok = false;
                else if (region[i] !== 0 || road[i] || obj[i] === O.HEART || ground[i] === G.WATER) ok = false;
            }
            if (ok) cands.push({ x, y, d: Math.hypot(x + LOT_W / 2 - cx, y + LOT_H / 2 - cy) + rngFor(seed, 'lotj', x, y).next() * 1.5 });
        }
        cands.sort((a, b) => a.d - b.d);
        const taken = new Uint8Array(N);
        for (const c of cands) {
            if (lots.length >= 18) break;
            let ok = true;
            for (let yy = c.y - 1; yy < c.y + LOT_H + 1 && ok; yy++) for (let xx = c.x - 1; xx < c.x + LOT_W + 1 && ok; xx++) if (taken[idx(xx, yy)]) ok = false;
            if (!ok) continue;
            for (let yy = c.y; yy < c.y + LOT_H; yy++) for (let xx = c.x; xx < c.x + LOT_W; xx++) taken[idx(xx, yy)] = 1;
            lots.push({ id: lots.length, x: c.x, y: c.y });
        }
        }
        for (const L of lots) {
            for (let yy = L.y; yy < L.y + LOT_H; yy++) for (let xx = L.x; xx < L.x + LOT_W; xx++) {
                const i = idx(xx, yy);
                const h = rngFor(seed, 'lot', i).next();
                ground[i] = G.GRASS;
                obj[i] = h < 0.14 ? O.TREE : h < 0.26 ? O.BUSH : h < 0.36 ? O.ROCK : h < 0.5 ? O.WEED : h < 0.56 ? O.STUMP : h < 0.62 ? O.TUFT : O.NONE;
                road[i] = 2;
            }
            L.door = { x: L.x + 3, y: L.y + 3 };
            L.sign = { x: L.x + 3, y: L.y + 4 };
            const si = idx(L.sign.x, L.sign.y);
            obj[si] = O.LOTSIGN; ov[si] = L.id;
            // a short path from the sign towards the plaza so lots read as a street
            const p = astar(W, H, si, nearestPlazaEdge(si), i => (region[i] !== 0 || road[i] === 2 && i !== si) ? Infinity : obj[i] === O.HEART ? Infinity : (ground[i] === G.PATH || ground[i] === G.PLAZA ? 0.3 : 1));
            if (p) for (const i of p.slice(1)) if (ground[i] !== G.PLAZA && ground[i] !== G.FARM && ground[i] !== G.WATER) { ground[i] = G.PATH; if (obj[i] !== O.HEART && obj[i] !== O.BOARD && obj[i] !== O.BIN && obj[i] !== O.LOTSIGN) obj[i] = O.NONE; }
        }
    }

    // ---------------------------------------------------------------- sites (dungeons, caves)
    const sites = [];
    for (const R of regions) {
        const rr = rngFor(seed, 'sites', R.idx);
        const place = (rMin, rMax, angOff) => {
            for (let t = 0; t < 400; t++) {
                const r = rr.range(rMin, rMax);
                const maxOff = (SECTOR / 2) - 6 / r;
                const a = R.angle + (angOff !== undefined ? angOff * maxOff : rr.range(-maxOff, maxOff)) + rr.range(-0.05, 0.05);
                const x = Math.floor(cx + Math.cos(a) * r), y = Math.floor(cy + Math.sin(a) * r);
                if (!inb(x - 3, y - 3) || !inb(x + 3, y + 3)) continue;
                let ok = true;
                for (let yy = y - 2; yy <= y + 2 && ok; yy++) for (let xx = x - 2; xx <= x + 2 && ok; xx++) if (region[idx(xx, yy)] !== R.idx || road[idx(xx, yy)]) ok = false;
                if (ok) return { x, y };
            }
            return null;
        };
        const side = rr.chance(0.5) ? 1 : -1;
        const dpos = place(60, 70, side * rr.range(0.1, 0.7));
        const cpos = place(46, 56, -side * rr.range(0.2, 0.8));
        for (const [kind, pos] of [['dungeon', dpos], ['cave', cpos]]) {
            if (!pos) continue;
            const site = {
                id: (kind === 'dungeon' ? 'd' : 'c') + R.idx, kind, region: R.idx, tier: R.idx, x: pos.x, y: pos.y,
                name: kind === 'dungeon' ? siteName(rr, R.biome.dungeon) : `${R.name.split(' ')[0]} ${rr.pick(R.biome.cave)}`,
                floors: kind === 'dungeon' ? 5 : 6,
            };
            // facade: 3 wide, 2 tall with the door at the bottom middle
            clearArea(pos.x, pos.y + 1, 2, R.idx);
            for (let yy = pos.y - 1; yy <= pos.y; yy++) for (let xx = pos.x - 1; xx <= pos.x + 1; xx++) { obj[idx(xx, yy)] = O.FACADE; ground[idx(xx, yy)] = grassFor(R.idx); }
            obj[idx(pos.x, pos.y)] = kind === 'dungeon' ? O.DUNGEON : O.CAVE;
            ov[idx(pos.x, pos.y)] = R.idx;
            const p = astar(W, H, idx(R.hub.x, R.hub.y), idx(pos.x, pos.y + 1), roadCost((rg, i) => rg === R.idx && obj[i] !== O.FACADE));
            carve(p, { width: kind === 'dungeon' ? 2 : 1 });
            sites.push(site); R.sites.push(site.id);
        }
    }

    // ---------------------------------------------------------------- glimmers (faded magic)
    const glimmers = [];
    const gIdx = new Map();
    function putGlimmer(x, y, kind, tier, rg, pocket = null) {
        const i = idx(x, y);
        obj[i] = O.GLIMMER; ov[i] = glimmers.length & 255;
        const gl = { id: glimmers.length, x, y, kind, tier, region: rg, pocket };
        glimmers.push(gl); gIdx.set(i, gl);
        return gl;
    }
    function freeSpot(rr, rg, rMin, rMax, avoidRoad = true) {
        for (let t = 0; t < 600; t++) {
            let x, y;
            if (rg === 0) { const a = rr.range(0, TAU), r = rr.range(rMin, rMax); x = Math.floor(cx + Math.cos(a) * r); y = Math.floor(cy + Math.sin(a) * r); }
            else { const R = regions[rg - 1]; const r = rr.range(rMin, rMax); const maxOff = SECTOR / 2 - 4 / r; const a = R.angle + rr.range(-maxOff, maxOff); x = Math.floor(cx + Math.cos(a) * r); y = Math.floor(cy + Math.sin(a) * r); }
            if (!inb(x - 3, y - 3) || !inb(x + 3, y + 3)) continue;
            const i = idx(x, y);
            if (region[i] !== rg || G_BLOCK.has(ground[i]) || ground[i] === G.SHALLOW) continue;
            if (avoidRoad && road[i]) continue;
            if (obj[i] === O.GLIMMER || obj[i] === O.FACADE || obj[i] === O.DUNGEON || obj[i] === O.CAVE || obj[i] === O.SIGN || obj[i] === O.LOTSIGN || obj[i] === O.HEART) continue;
            let near = false;
            for (const g of glimmers) if (Math.abs(g.x - x) + Math.abs(g.y - y) < 7) { near = true; break; }
            if (near) continue;
            return { x, y };
        }
        return null;
    }
    // the Glen: a visible recipe scroll, a fairy ring, and a couple of sleeping ones
    {
        const rr = rngFor(seed, 'glen-glim');
        const spec = [['ring', 0], ['scroll', 0], ['acorn', 1], ['starfruit', 2], ['cache', 3]];
        for (const [kind, tier] of spec) {
            const p = freeSpot(rr, 0, 9, GLEN_R - 2);
            if (p) { const i = idx(p.x, p.y); if (road[i] === 0 || road[i] === 1) { putGlimmer(p.x, p.y, kind, tier, 0); } }
        }
    }
    const POCKET_FOR = ['boulder', 'shallows', 'dark', 'thorn'];
    for (const R of regions) {
        const rr = rngFor(seed, 'glim', R.idx);
        const k = R.idx;
        const kinds = ['ring', 'acorn', 'starfruit', 'scroll', 'scroll', 'cache', 'cache', 'shrine'];
        if (k === 2 || k === 4) kinds.push('moonwell');
        for (const kind of kinds) {
            const tier = kind === 'ring' ? Math.max(0, k - 1) : Math.min(5, Math.max(0, k - 2 + rr.int(0, 2)));
            const p = kind === 'ring' ? freeSpot(rr, k, 38, 48) : freeSpot(rr, k, 36, 72);
            if (!p) continue;
            putGlimmer(p.x, p.y, kind, tier, k);
        }
        // a Zelda-style pocket: treasure enclosed by an obstacle you can only pass with a later relic
        const pk = POCKET_FOR[(k - 1) % 4];
        for (let attempt = 0; attempt < 12 && k <= 4; attempt++) {
            const p = freeSpot(rr, k, 42, 70);
            if (p && inb(p.x - 3, p.y - 3) && inb(p.x + 3, p.y + 3)) {
                let ok = true;
                for (let yy = p.y - 2; yy <= p.y + 2; yy++) for (let xx = p.x - 2; xx <= p.x + 2; xx++) { const q = idx(xx, yy); if (region[q] !== k || road[q] || obj[q] === O.GLIMMER || obj[q] === O.FACADE || obj[q] === O.DUNGEON || obj[q] === O.CAVE || obj[q] === O.SIGN) ok = false; }
                if (ok) {
                    for (let yy = p.y - 2; yy <= p.y + 2; yy++) for (let xx = p.x - 2; xx <= p.x + 2; xx++) {
                        const i = idx(xx, yy);
                        const ring = Math.max(Math.abs(xx - p.x), Math.abs(yy - p.y)) === 2;
                        ground[i] = grassFor(k); obj[i] = O.NONE; ov[i] = 0;
                        if (ring) {
                            if (pk === 'thorn') obj[i] = O.THORN;
                            else if (pk === 'boulder') obj[i] = O.BOULDER;
                            else if (pk === 'dark') obj[i] = O.DARK;
                            else ground[i] = G.SHALLOW;
                        }
                    }
                    for (let yy = p.y - 2; yy <= p.y + 2; yy++) for (let xx = p.x - 2; xx <= p.x + 2; xx++) gateMask[idx(xx, yy)] = 1;
                    putGlimmer(p.x, p.y, rr.pick(['cache', 'acorn', 'scroll']), Math.max(0, k - 1), k, pk);
                    break;
                }
            }
        }
    }

    // ---------------------------------------------------------------- forage spots
    const forage = [];
    for (let rg = 0; rg <= 5; rg++) {
        const rr = rngFor(seed, 'forage', rg);
        const want = rg === 0 ? 8 : 34;
        for (let t = 0; t < want; t++) {
            const p = rg === 0 ? freeSpot(rr, 0, 7, GLEN_R - 1) : freeSpot(rr, rg, 33, 74);
            if (!p) continue;
            const i = idx(p.x, p.y);
            if (obj[i] === O.GLIMMER) continue;
            obj[i] = O.FORAGE; ov[i] = forage.length & 255;
            forage.push({ id: forage.length, x: p.x, y: p.y, region: rg });
        }
    }

    // ---------------------------------------------------------------- reachability repair
    // Anything important that the Glen can't reach (with every relic) gets a trail.
    const passAll = i => {
        const g = ground[i];
        if (G_BLOCK.has(g) && g !== G.BRIDGE) return false;
        const o = obj[i];
        if (PERMA_BLOCK.has(o)) return false;
        if (o === O.DUNGEON || o === O.CAVE || o === O.GLIMMER) return true;
        return true;   // natural objects are choppable; gate objects need relics (all assumed)
    };
    const targets = [
        ...sites.map(s => ({ x: s.x, y: s.y + 1, rg: s.region })),
        ...glimmers.map(g => ({ x: g.x, y: g.y, rg: g.region, pocket: g.pocket })),
        ...forage.map(f => ({ x: f.x, y: f.y, rg: f.region })),
        ...lots.map(L => ({ x: L.sign.x, y: L.sign.y + 1, rg: 0 })),
    ];
    for (let pass = 0; pass < 3; pass++) {
        const reach = flood(W, H, [glenStart], passAll);
        let fixed = 0;
        for (const t of targets) {
            const ti = idx(t.x, t.y);
            const adj = [ti, ti - 1, ti + 1, ti - W, ti + W];
            if (adj.some(a => reach[a])) continue;
            // walk from the region hub (or plaza) to the target, clearing a trail
            const from = t.rg === 0 ? glenStart : idx(regions[t.rg - 1].hub.x, regions[t.rg - 1].hub.y);
            const p = astar(W, H, from, ti, i => {
                if (region[i] !== t.rg) return Infinity;
                if (PERMA_BLOCK.has(obj[i]) && i !== ti) return Infinity;
                if (ground[i] === G.VOID) return Infinity;
                if (ground[i] === G.CLIFF) return 7;
                if (obj[i] === O.HEART || road[i] === 2 && t.rg === 0 && ground[i] !== G.PATH && ground[i] !== G.PLAZA) return 8;
                return (G_BLOCK.has(ground[i]) ? 5 : 1) + (obj[i] ? 1 : 0);
            });
            if (p) { for (const i of p) if (i !== ti && !(road[i] === 2 && t.rg === 0)) trailTile(i); fixed++; }
        }
        if (!fixed) break;
    }

    // precompute a quick lookup of sign text regions
    return {
        seed, W, H, cx, cy, ground, obj, ov, region, road,
        glen: { ...glen, heart, hall, cabin, bin, farm, pond, board, start: { x: cabin.x + 2, y: cabin.y + 3 } },
        regions, sites, lots, glimmers, forage,
        siteById: Object.fromEntries(sites.map(s => [s.id, s])),
    };
}

/** A hash of everything generated — used by tests to prove determinism. */
export function worldHash(w) {
    let h = 0x811c9dc5;
    for (const arr of [w.ground, w.obj, w.ov, w.region]) for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
}
