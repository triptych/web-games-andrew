/**
 * islands.js — the islands you can choose, and the seeded generator that shapes them.
 *
 * Each preset is a shape function over normalised coordinates (u, v ∈ [−1, 1]) plus a season that
 * decides the ground, the trees and the palette. The generator cleans the result up (no specks of
 * land, no one-tile puddles, a beach ring, hills kept off the coast), scatters nature, and can lay a
 * starter town: a loop of track round the biggest clear rectangle near the middle, with a station,
 * homes, shops and a train already running.
 */

import { N, T } from '../config.js';
import { RNG, Noise2 } from '../rng.js';
import { DX, DZ, idx, inb } from './grid.js';
import { World } from './world.js';
import { DEFAULT_SETS } from './trainsets.js';

export const PRESETS = [
    { id: 'sunny', name: 'Sunny Cove', emoji: '🌞', season: 'summer', desc: 'A round, friendly island with sandy beaches and a sheltered bay.' },
    { id: 'pine', name: 'Pine Peaks', emoji: '🌲', season: 'summer', desc: 'Pine woods and rocky hills to tunnel right through.' },
    { id: 'twin', name: 'Twin Isles', emoji: '🏝️', season: 'summer', desc: 'Two islands side by side. Build a bridge between them!' },
    { id: 'atoll', name: 'Coral Ring', emoji: '🐠', season: 'tropical', desc: 'Palm-fringed land in a ring round a blue lagoon.' },
    { id: 'blossom', name: 'Blossom Bay', emoji: '🌸', season: 'spring', desc: 'Pink blossom trees and flower meadows round a crescent bay.' },
    { id: 'maple', name: 'Maple Hollow', emoji: '🍁', season: 'autumn', desc: 'Golden woods, pumpkin farms and a winding river.' },
    { id: 'snow', name: 'Snowdrop Isle', emoji: '❄️', season: 'winter', desc: 'Snowy fields, frosty pines and a snow-capped mountain.' },
    { id: 'plate', name: 'Big Baseplate', emoji: '🧱', season: 'summer', desc: 'A huge flat square of grass with nothing on it. Build anything!' },
];
export const PRESET = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

const len = (u, v) => Math.hypot(u, v);

/** Shape functions: return 'land' | 'water' | 'rock' for normalised (u, v). n = noise sampler. */
const SHAPES = {
    sunny(u, v, n) {
        const a = Math.atan2(v, u);
        const bay = Math.max(0, Math.cos(a - 0.9)) ** 6 * 0.42;
        const r = 0.7 + (n(u * 2.2, v * 2.2) - 0.5) * 0.28 - bay;
        if (len(u, v) > r) return 'water';
        if (len(u + 0.28, v + 0.22) < 0.1 + n(u * 5, v * 5) * 0.05) return 'water';   // a little lake
        return 'land';
    },
    pine(u, v, n) {
        const r = 0.8 + (n(u * 2, v * 2) - 0.5) * 0.3;
        if (len(u * 0.92, v) > r) return 'water';
        const ridge = n(u * 3 + 7, v * 3 + 3);
        if (v < 0.05 && len(u, v + 0.35) < 0.5 && ridge > 0.42) return 'rock';
        if (len(u - 0.42, v - 0.35) < 0.14) return 'rock';
        return 'land';
    },
    twin(u, v, n) {
        const w = (n(u * 2.5, v * 2.5) - 0.5) * 0.18;
        const a = len((u + 0.42) / 1.0, (v + 0.12) / 1.25) < 0.42 + w;
        const b = len((u - 0.46) / 1.1, (v - 0.18) / 1.0) < 0.38 + w;
        if (!a && !b) return 'water';
        if (a && len(u + 0.5, v + 0.42) < 0.11) return 'rock';
        return 'land';
    },
    atoll(u, v, n) {
        const r = len(u, v) + (n(u * 2.6, v * 2.6) - 0.5) * 0.2;
        const wide = 0.08 * Math.max(0, Math.cos(Math.atan2(v, u) + 2.2));
        if (r > 0.8 + wide) return 'water';
        if (r < 0.36 - wide) return len(u, v) < 0.08 ? 'land' : 'water';
        return 'land';
    },
    blossom(u, v, n) {
        const w = (n(u * 2.2, v * 2.2) - 0.5) * 0.22;
        if (len(u, v) > 0.8 + w) return 'water';
        if (len(u - 0.55, v - 0.05) < 0.36 + w * 0.5) return 'water';
        return 'land';
    },
    maple(u, v, n) {
        const r = 0.76 + (n(u * 1.8, v * 1.8) - 0.5) * 0.4;
        if (len(u, v * 1.08) > r) return 'water';
        const river = v - 0.28 * Math.sin(u * 3.2 + 0.6) - 0.12;
        if (Math.abs(river) < 0.035 && u > -0.75) return 'water';
        if (len(u + 0.3, v + 0.48) < 0.12 || len(u - 0.4, v + 0.38) < 0.1) return 'rock';
        return 'land';
    },
    snow(u, v, n) {
        const r = 0.74 + (n(u * 2.4, v * 2.4) - 0.5) * 0.3;
        if (len(u, v) > r) return 'water';
        if (len(u - 0.05, v + 0.35) < 0.2 + (n(u * 4, v * 4) - 0.5) * 0.12) return 'rock';
        return 'land';
    },
    plate(u, v) {
        return Math.abs(u) < 0.8 && Math.abs(v) < 0.8 ? 'land' : 'water';
    },
};

const MIXES = {
    summer: [['tree_round', 6], ['tree_pine', 2], ['tree_fruit', 1], ['bush', 2], ['rock', 0.6]],
    pine: [['tree_pine', 8], ['tree_round', 1], ['bush', 1], ['rock', 1]],
    tropical: [['tree_palm', 6], ['bush', 2], ['rock', 0.5]],
    spring: [['tree_blossom', 6], ['tree_round', 2], ['bush', 1], ['flowers', 0.3]],
    autumn: [['tree_autumn', 7], ['tree_pine', 1], ['pumpkins', 0.7], ['bush', 1], ['mushroom', 0.6]],
    winter: [['tree_snowy', 7], ['tree_pine', 1], ['rock', 0.8], ['snowman', 0.3]],
};

function pickWeighted(R, list) {
    let tot = 0;
    for (const e of list) tot += e[1];
    let r = R.next() * tot;
    for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
    return list[0][0];
}

/** Flood-fill regions of one class; returns arrays of tile indices. */
function regions(tiles, test) {
    const seen = new Uint8Array(N * N), out = [];
    for (let i = 0; i < N * N; i++) {
        if (seen[i] || !test(tiles[i])) continue;
        const reg = [i], st = [i];
        seen[i] = 1;
        while (st.length) {
            const j = st.pop(), x = j % N, z = (j / N) | 0;
            for (let e = 0; e < 4; e++) {
                const nx = x + DX[e], nz = z + DZ[e];
                if (!inb(nx, nz)) continue;
                const k = idx(nx, nz);
                if (!seen[k] && test(tiles[k])) { seen[k] = 1; reg.push(k); st.push(k); }
            }
        }
        out.push(reg);
    }
    return out;
}

/** Build a new island. opts: { preset, seed, name, starter } */
export function generateIsland(opts) {
    const P = PRESET[opts.preset] || PRESETS[0];
    const seed = opts.seed >>> 0;
    const W = new World();
    W.name = opts.name || P.name;
    W.preset = P.id;
    W.season = P.id === 'pine' ? 'pine' : P.season;
    W.seed = seed;
    W.created = opts.created || 0;
    W.rngState.s = (seed ^ 0x51ed27) >>> 0;
    const R = new RNG(seed);
    const noise = new Noise2(seed);
    const n = (x, y) => noise.fbm(x + 11, y + 5, 3);
    const shape = SHAPES[P.id];
    const ground = P.season === 'winter' ? T.SNOW : T.GRASS;
    const tiles = W.tiles;

    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const u = ((x + 0.5) / N) * 2 - 1, v = ((z + 0.5) / N) * 2 - 1;
        const edge = x < 2 || z < 2 || x >= N - 2 || z >= N - 2;
        const s = edge ? 'water' : shape(u, v, n);
        tiles[idx(x, z)] = s === 'water' ? T.WATER : s === 'rock' ? T.ROCK : ground;
    }
    // Tidy: drop specks of land, fill one- and two-tile puddles that don't reach the sea.
    for (const reg of regions(tiles, (t) => t !== T.WATER)) if (reg.length < 8) for (const i of reg) tiles[i] = T.WATER;
    for (const reg of regions(tiles, (t) => t === T.WATER)) if (reg.length < 4) for (const i of reg) tiles[i] = ground;
    // Hills stay a tile back from the water so their slopes never fall into the sea.
    const nearWater = (i, r) => {
        const x = i % N, z = (i / N) | 0;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, z + dz) && tiles[idx(x + dx, z + dz)] === T.WATER) return true;
        return false;
    };
    for (let i = 0; i < N * N; i++) if (tiles[i] === T.ROCK && nearWater(i, 1)) tiles[i] = ground;
    for (const reg of regions(tiles, (t) => t === T.ROCK)) if (reg.length < 3) for (const i of reg) tiles[i] = ground;
    // Beaches: land touching the sea becomes sand (the baseplate keeps a clean edge).
    if (P.id !== 'plate') {
        const sand = [];
        for (let i = 0; i < N * N; i++) {
            if (tiles[i] !== ground) continue;
            const x = i % N, z = (i / N) | 0;
            const beachy = n(x * 0.21, z * 0.21) > 0.42;
            let touch = false, touch2 = false;
            for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
                if (!inb(x + dx, z + dz) || tiles[idx(x + dx, z + dz)] !== T.WATER) continue;
                if (Math.abs(dx) + Math.abs(dz) <= 1) touch = true; else touch2 = true;
            }
            if (touch || (touch2 && beachy)) sand.push(i);
        }
        for (const i of sand) tiles[i] = T.SAND;
        // Flower meadows in patches.
        if (P.season !== 'winter') for (let i = 0; i < N * N; i++) {
            if (tiles[i] !== T.GRASS) continue;
            const x = i % N, z = (i / N) | 0;
            if (n(x * 0.17 + 40, z * 0.17 + 40) > (P.season === 'spring' ? 0.6 : 0.67)) tiles[i] = T.MEADOW;
        }
    }
    W.terrainV++;

    let town = null;
    if (opts.starter) town = buildStarterTown(W, R, P);

    if (P.id !== 'plate') scatterNature(W, R, n, P, town);
    return W;
}

function scatterNature(W, R, n, P, town) {
    const mix = MIXES[W.season] || MIXES.summer;
    const tiles = W.tiles;
    const reserved = (x, z) => town && x >= town.x - 2 && z >= town.z - 2 && x <= town.x + town.w + 1 && z <= town.z + town.h + 1;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const i = idx(x, z), t = tiles[i];
        if (reserved(x, z) || W.objAt[i] >= 0 || W.track[i]) continue;
        const forest = n(x * 0.13 + 70, z * 0.13 + 9);
        if (t === T.GRASS || t === T.SNOW || t === T.MEADOW) {
            const p = forest > 0.58 ? 0.55 : 0.06;
            if (R.chance(t === T.MEADOW ? p * 0.5 : p)) W.place(pickWeighted(R, t === T.MEADOW ? [['sunflowers', 1], ['bush', 2], [mix[0][0], 2]] : mix), x, z, R.int(0, 3));
        } else if (t === T.SAND) {
            if (R.chance(W.season === 'tropical' ? 0.12 : 0.025)) W.place(W.season === 'winter' ? 'rock' : R.chance(0.6) ? 'tree_palm' : 'rock', x, z, R.int(0, 3));
            else if (R.chance(0.01) && W.season !== 'winter') W.place(R.chance(0.5) ? 'umbrella' : 'sandcastle', x, z, R.int(0, 3));
        } else if (t === T.WATER) {
            let shore = false;
            for (let e = 0; e < 4; e++) { const nx = x + DX[e], nz = z + DZ[e]; if (inb(nx, nz) && tiles[idx(nx, nz)] !== T.WATER) shore = true; }
            if (shore && R.chance(0.025)) W.place(R.pick(W.season === 'winter' ? ['buoy', 'rowboat'] : ['ducks', 'lilypads', 'buoy', 'rowboat', 'sailboat']), x, z, R.int(0, 3));
        }
    }
    // One friendly whale somewhere out at sea.
    for (let k = 0; k < 40; k++) {
        const x = R.int(3, N - 4), z = R.int(3, N - 4);
        let open = true;
        for (let dz = -2; dz <= 2 && open; dz++) for (let dx = -2; dx <= 2; dx++) if (W.tile(x + dx, z + dz) !== T.WATER) { open = false; break; }
        if (open && W.place('whale', x, z, R.int(0, 3)) >= 0) break;
    }
}

/** Largest clear rectangle near the middle, from 12×9 down to 6×5. */
function findTownSite(W) {
    const ok = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) ok[i] = W.tiles[i] !== T.WATER && W.tiles[i] !== T.ROCK ? 1 : 0;
    // Summed-area table for O(1) rectangle checks.
    const S = new Int32Array((N + 1) * (N + 1));
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) S[(z + 1) * (N + 1) + x + 1] = ok[idx(x, z)] + S[z * (N + 1) + x + 1] + S[(z + 1) * (N + 1) + x] - S[z * (N + 1) + x];
    const sum = (x, z, w, h) => S[(z + h) * (N + 1) + x + w] - S[z * (N + 1) + x + w] - S[(z + h) * (N + 1) + x] + S[z * (N + 1) + x];
    const sizes = [[12, 9], [11, 8], [10, 8], [10, 7], [9, 7], [8, 6], [7, 6], [7, 5], [6, 5]];
    for (const [w, h] of sizes) {
        let best = null, bd = 1e9;
        for (const [ww, hh] of [[w, h], [h, w]]) {
            for (let z = 1; z + hh < N - 1; z++) for (let x = 1; x + ww < N - 1; x++) {
                if (sum(x, z, ww, hh) !== ww * hh) continue;
                const d = Math.hypot(x + ww / 2 - N / 2, z + hh / 2 - N / 2);
                if (d < bd) { bd = d; best = { x, z, w: ww, h: hh }; }
            }
        }
        if (best) return best;
    }
    return null;
}

function buildStarterTown(W, R, P) {
    const site = findTownSite(W);
    if (!site) return null;
    const { x, z, w, h } = site;
    // The loop runs round the rectangle's border, starting mid-way along the top so both ends are straight.
    const ring = [];
    for (let i = x; i < x + w; i++) ring.push([i, z]);
    for (let j = z + 1; j < z + h; j++) ring.push([x + w - 1, j]);
    for (let i = x + w - 2; i >= x; i--) ring.push([i, z + h - 1]);
    for (let j = z + h - 2; j > z; j--) ring.push([x, j]);
    const start = Math.floor(w / 2);
    const loop = ring.slice(start).concat(ring.slice(0, start));
    W.layTrack(loop.concat([loop[0], loop[1]]));
    // A two-tile station in the middle of the bottom side.
    const sx = x + Math.floor(w / 2) - 1;
    W.setStation(sx, z + h - 1, true);
    W.setStation(sx + 1, z + h - 1, true);

    const ground = P.season === 'winter' ? T.SNOW : T.GRASS;
    // Inside: a path across the middle with homes and shops either side.
    const mid = z + Math.floor(h / 2);
    for (let i = x + 1; i < x + w - 1; i++) W.paintTerrain(i, mid, T.PATH);
    for (let j = z + 1; j < z + h - 1; j++) for (let i = x + 1; i < x + w - 1; i++) if (W.tile(i, j) === T.SAND || W.tile(i, j) === T.MEADOW) W.paintTerrain(i, j, ground);
    const homes = P.season === 'winter' ? ['house_red', 'igloo', 'house_blue', 'cottage', 'house_yellow', 'igloo']
        : P.season === 'tropical' ? ['beach_hut', 'house_yellow', 'house_blue', 'beach_hut', 'cottage', 'house_green']
        : ['house_red', 'house_blue', 'house_yellow', 'cottage', 'house_green', 'townhouse'];
    const shops = ['bakery', 'cafe', 'icecream', 'toyshop', 'postoffice', 'library'];
    const rows = [[mid - 1, 0], [mid + 1, 2]];
    let k = 0, s = 0;
    for (const [row, rot] of rows) {
        if (row <= z || row >= z + h - 1) continue;
        for (let i = x + 1; i < x + w - 1; i++) {
            const pick = (i - x) % 3 === 2 ? shops[s++ % shops.length] : homes[k++ % homes.length];
            W.place(pick, i, row, rot);
        }
    }
    const cx = x + Math.floor(w / 2);
    if (W.objectAt(cx, mid)) W.removeObject(W.objectAt(cx, mid).id);
    // Fill the rest of the inside with gardens, and dress the platform.
    for (let j = z + 1; j < z + h - 1; j++) for (let i = x + 1; i < x + w - 1; i++) {
        if (W.objAt[idx(i, j)] >= 0 || W.tile(i, j) === T.PATH) continue;
        const garden = { winter: ['tree_snowy', 'tree_snowy', 'snowman', 'rock'], tropical: ['tree_palm', 'bush', 'tree_palm', 'flowers'], spring: ['tree_blossom', 'tree_blossom', 'flowers', 'bush'], autumn: ['tree_autumn', 'tree_autumn', 'pumpkins', 'bush'] }[P.season] || ['tree_round', 'tree_round', 'flowers', 'bush', 'tree_fruit', 'bush'];
        if (R.chance(0.55)) W.place(R.pick(garden), i, j, R.int(0, 3));
    }
    for (const [i, j] of [[sx - 1, z + h], [sx + 2, z + h]]) W.place('lamp', i, j, 0);
    W.place('bench', sx, z + h, 0);
    W.place('signalbox', x + w, z + h - 2, 3);
    W.place('watertower', x - 1, z + 1, 1);
    W.trains.place(DEFAULT_SETS[0], x + 1, z, 1);
    return site;
}
