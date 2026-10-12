// World generation and tile queries. Pure: no DOM, no Math.random.

import { W, H, T, STRATA, ORES, RELICS, ARTIFACTS, WAYSTONES, GATE_ROW, ARENA_TOP, ARENA_BOTTOM } from '../config.js';
import { makeRng, fbm, hash3 } from '../rng.js';

export const idx = (c, r) => r * W + c;
export const inBounds = (c, r) => c >= 0 && c < W && r >= 0 && r < H;

/** The four heart-shards of the Gloamwyrm, in arena coordinates. */
export const SHARDS = [
    { c: 1,     r: ARENA_TOP + 6 },
    { c: W - 2, r: ARENA_TOP + 6 },
    { c: 7,     r: ARENA_TOP + 20 },
    { c: W - 8, r: ARENA_TOP + 20 },
];
export const HEART_POS = { c: Math.floor(W / 2), r: ARENA_BOTTOM };

export function stratumAtRow(r) {
    for (let s = STRATA.length - 1; s >= 0; s--) if (r >= STRATA[s].top) return s;
    return 0;
}

export function generateWorld(seed) {
    const rng = makeRng(seed ^ 0x9E3779B9);
    const n = W * H;
    const world = {
        seed,
        tiles: new Uint8Array(n),
        aux: new Uint8Array(n),
        strat: new Uint8Array(n),
        seen: new Uint8Array(n),
        relicPos: [],
        artifactPos: [],
        waystonePos: [],
        wreckPos: null,
    };
    const { tiles, aux, strat } = world;
    const set = (c, r, t, a = 0) => { if (inBounds(c, r)) { tiles[idx(c, r)] = t; aux[idx(c, r)] = a; } };
    const get = (c, r) => (inBounds(c, r) ? tiles[idx(c, r)] : T.BEDROCK);

    // 1. Strata with wavy boundaries.
    const bound = STRATA.map((s, i) => {
        const arr = new Int16Array(W);
        for (let c = 0; c < W; c++) {
            arr[c] = (i === 0 || i === 6) ? s.top : s.top + Math.round((fbm(c * 0.16, i * 3.1, seed + 11) - 0.5) * 9);
        }
        return arr;
    });
    for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
            let s = 0;
            for (let i = STRATA.length - 1; i >= 0; i--) if (r >= bound[i][c]) { s = i; break; }
            strat[idx(c, r)] = s;
            tiles[idx(c, r)] = T.SOIL;
        }
    }

    // 2. Caverns from noise; more open in the Glimmerdeep.
    const caveT = [0.80, 0.745, 0.67, 0.73, 0.715, 0.70];
    for (let r = 7; r < GATE_ROW - 2; r++) {
        for (let c = 0; c < W; c++) {
            const s = strat[idx(c, r)];
            const v = fbm(c * 0.17, r * 0.19, seed + 101, 3);
            const stretch = fbm(c * 0.06, r * 0.32, seed + 202, 2);   // horizontal galleries
            if (v > caveT[s] || (s >= 1 && stretch > 0.76)) tiles[idx(c, r)] = T.EMPTY;
        }
    }

    // 3. Ores: chance rises with depth; vein noise clusters them.
    for (let r = 0; r < GATE_ROW - 1; r++) {
        for (let c = 0; c < W; c++) {
            const i = idx(c, r);
            if (tiles[i] !== T.SOIL) continue;
            const vein = fbm(c * 0.35, r * 0.35, seed + 303, 2);
            const p = (0.07 + Math.min(r, 300) * 0.00015) * (vein > 0.62 ? 2.4 : vein < 0.38 ? 0.4 : 1);
            if (rng() >= p) continue;
            let total = 0;
            const w = ORES.map((o) => {
                if (r < o.min || r > o.max) return 0;
                const t = r < o.peak ? (r - o.min) / Math.max(1, o.peak - o.min) : (o.max - r) / Math.max(1, o.max - o.peak);
                const val = (0.15 + 0.85 * t) / Math.sqrt(1 + o.id * 0.35);
                total += val;
                return val;
            });
            if (total <= 0) continue;
            let x = rng() * total;
            for (let k = 0; k < w.length; k++) { x -= w[k]; if (x <= 0) { tiles[i] = T.ORE; aux[i] = k; break; } }
        }
    }

    // 4. Hazards.
    for (let r = 3; r < GATE_ROW - 1; r++) {
        for (let c = 0; c < W; c++) {
            const i = idx(c, r);
            if (tiles[i] !== T.SOIL) continue;
            const s = strat[i];
            const x = rng();
            const gasP = r < 22 ? 0 : 0.010 + Math.min(r, 340) * 0.00006;
            const lavaP = s === 4 ? 0.045 : s === 5 ? 0.018 : 0;
            const boulderP = r < 10 ? 0 : s === 0 ? 0.006 : 0.013;
            const runeP = r < 30 ? 0 : 0.008 + (fbm(c * 0.3, r * 0.3, seed + 404, 2) > 0.66 ? 0.12 : 0);
            if (x < gasP) tiles[i] = T.GAS;
            else if (x < gasP + lavaP) tiles[i] = T.LAVA;
            else if (x < gasP + lavaP + boulderP) tiles[i] = T.BOULDER;
            else if (x < gasP + lavaP + boulderP + runeP) tiles[i] = T.RUNESTONE;
            else if (r > 20 && x < gasP + lavaP + boulderP + runeP + 0.0028) { tiles[i] = T.CACHE; aux[i] = 0; }
        }
    }
    // Magma pools: the floors of Emberdeep caverns run with lava.
    for (let r = 222; r < 300; r++) {
        for (let c = 0; c < W; c++) {
            if (tiles[idx(c, r)] === T.EMPTY && get(c, r + 1) !== T.EMPTY && rng() < 0.35) tiles[idx(c, r + 1)] = T.LAVA;
        }
    }

    // 5. Ruins of Kharadun: brick halls with coffers inside.
    for (let k = 0; k < 9; k++) {
        const rw = rng.int(6, 12), rh = rng.int(4, 6);
        const c0 = rng.int(1, W - rw - 2), r0 = rng.int(156, 212 - rh);
        for (let r = r0; r <= r0 + rh; r++) {
            for (let c = c0; c <= c0 + rw; c++) {
                const edge = r === r0 || r === r0 + rh || c === c0 || c === c0 + rw;
                set(c, r, edge ? T.BRICK : T.EMPTY);
            }
        }
        // a doorway, pillars, and a coffer on the floor
        set(c0 + rw, r0 + rh - 1, T.EMPTY);
        if (rw > 8) for (let r = r0 + 1; r < r0 + rh; r++) set(c0 + (rw >> 1), r, T.BRICK);
        set(c0 + 1 + rng.int(0, rw - 3), r0 + rh - 1, T.CACHE);
    }
    // Watch-halls of the Greystone: smaller, with arched brick roofs.
    for (let k = 0; k < 5; k++) {
        const rw = rng.int(5, 8), r0 = rng.int(48, 84), c0 = rng.int(1, W - rw - 2);
        for (let c = c0; c <= c0 + rw; c++) { set(c, r0, T.BRICK); set(c, r0 + 3, T.BRICK); }
        for (let c = c0 + 1; c < c0 + rw; c++) { set(c, r0 + 1, T.EMPTY); set(c, r0 + 2, T.EMPTY); }
        set(c0, r0 + 1, T.BRICK); set(c0, r0 + 2, T.BRICK);
    }

    // 6. Relic vaults: a brick ring with the relic inside, never sealed by wards.
    for (const rel of RELICS) {
        const r = rel.depth;
        const c = rng.int(4, W - 5);
        for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
                const t = get(c + dc, r + dr);
                if (t === T.RUNESTONE || t === T.GAS || t === T.LAVA || t === T.BOULDER) set(c + dc, r + dr, T.SOIL);
            }
        }
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) set(c + dc, r + dr, T.BRICK);
        set(c, r, T.RELIC, rel.id);
        world.relicPos.push({ id: rel.id, c, r });
    }

    // 7. Waystone chambers.
    for (const ws of WAYSTONES) {
        const r = ws.depth;
        const c = rng.int(5, W - 6);
        for (let dr = -4; dr <= 1; dr++) {
            for (let dc = -4; dc <= 4; dc++) {
                const wall = dr === -4 || dr === 1 || Math.abs(dc) === 4;
                set(c + dc, r + dr, wall ? T.BRICK : T.EMPTY);
            }
        }
        set(c - 4, r - 1, T.EMPTY); set(c - 4, r - 2, T.EMPTY);   // doors both sides
        set(c + 4, r - 1, T.EMPTY); set(c + 4, r - 2, T.EMPTY);
        set(c, r - 4, T.EMPTY);                                    // and a shaft in the roof
        set(c, r, T.WAYSTONE, ws.id);
        world.waystonePos.push({ id: ws.id, c, r });
    }

    // 8. Corvin's wreck in a small hollow in the Emberdeep.
    {
        const r = 246, c = rng.int(4, W - 5);
        for (let dr = -2; dr <= 0; dr++) for (let dc = -2; dc <= 2; dc++) set(c + dc, r + dr, T.EMPTY);
        for (let dc = -2; dc <= 2; dc++) set(c + dc, r + 1, T.BRICK);
        set(c, r, T.WRECK);
        world.wreckPos = { c, r };
    }

    // 9. Artifacts, after the structures so none is overwritten.
    for (const a of ARTIFACTS) {
        let r = 0, c = 0;
        for (let tries = 0; tries < 60; tries++) {
            r = rng.int(a.depth[0], a.depth[1]);
            c = rng.int(1, W - 2);
            const t = get(c, r);
            if (t === T.SOIL || t === T.ORE) break;
        }
        set(c, r, T.ARTIFACT, a.id);
        world.artifactPos.push({ id: a.id, c, r });
    }

    // 10. Keep the shallows friendly: nothing nasty in the first rows, solid under the town.
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < W; c++) {
            const t = get(c, r);
            if (t !== T.ORE && t !== T.ARTIFACT) set(c, r, T.SOIL);
        }
    }

    // 11. The Rune Gate and the Wyrmheart chamber.
    for (let r = GATE_ROW - 3; r < GATE_ROW; r++) for (let c = 0; c < W; c++) {
        const t = get(c, r);
        if (t === T.EMPTY || t === T.LAVA || t === T.GAS) set(c, r, T.SOIL);
    }
    for (let c = 0; c < W; c++) set(c, GATE_ROW, T.GATE);
    for (let r = ARENA_TOP; r <= ARENA_BOTTOM; r++) for (let c = 0; c < W; c++) set(c, r, T.EMPTY);
    for (let r = ARENA_BOTTOM + 1; r < H; r++) for (let c = 0; c < W; c++) set(c, r, T.BEDROCK);
    // ledges to rest on, and pillars holding the shards
    const ledge = (c0, c1, r) => { for (let c = c0; c <= c1; c++) set(c, r, T.BRICK); };
    ledge(0, 4, ARENA_TOP + 7);  ledge(W - 5, W - 1, ARENA_TOP + 7);
    ledge(12, 15, ARENA_TOP + 12); ledge(W - 16, W - 13, ARENA_TOP + 12);
    ledge(4, 9, ARENA_TOP + 21);  ledge(W - 10, W - 5, ARENA_TOP + 21);
    ledge(15, 20, ARENA_TOP + 17);
    for (const s of SHARDS) set(s.c, s.r, T.SHARD);
    for (let r = ARENA_TOP; r <= ARENA_BOTTOM; r++) for (let c = 0; c < W; c++) strat[idx(c, r)] = 6;
    for (let c = 0; c < W; c++) strat[idx(c, GATE_ROW)] = 6;

    // 12. Let boulders settle so nothing is hanging at the start.
    for (let r = H - 2; r >= 0; r--) {
        for (let c = 0; c < W; c++) {
            if (tiles[idx(c, r)] !== T.BOULDER) continue;
            let rr = r;
            while (rr + 1 < H && tiles[idx(c, rr + 1)] === T.EMPTY) rr++;
            if (rr !== r) { tiles[idx(c, r)] = T.EMPTY; tiles[idx(c, rr)] = T.BOULDER; }
        }
    }
    // Ore variants for texture choice (stable, no rng drift).
    world.variant = (c, r) => Math.floor(hash3(c, r, seed) * 4);
    return world;
}

export function tileAt(world, c, r) {
    if (c < 0 || c >= W) return T.BEDROCK;
    if (r < 0) return T.EMPTY;
    if (r >= H) return T.BEDROCK;
    return world.tiles[idx(c, r)];
}

export function auxAt(world, c, r) { return inBounds(c, r) ? world.aux[idx(c, r)] : 0; }
export function stratAt(world, c, r) { return inBounds(c, r) ? world.strat[idx(c, r)] : (r < 0 ? 0 : 6); }

export function setTile(world, c, r, t, a = 0) {
    if (!inBounds(c, r)) return;
    world.tiles[idx(c, r)] = t;
    world.aux[idx(c, r)] = a;
    world.rev = (world.rev | 0) + 1;
}

/** Hardness of a tile for drilling; Infinity if it can't be drilled at all. */
export function hardnessAt(world, c, r) {
    const t = tileAt(world, c, r);
    const s = STRATA[stratAt(world, c, r)].hard;
    switch (t) {
        case T.EMPTY: return 0;
        case T.SOIL: case T.ORE: case T.GAS: case T.ARTIFACT: case T.CACHE: case T.RELIC: return s;
        case T.LAVA: return s;
        case T.BRICK: return Math.max(1, s);
        case T.WRECK: return 1;
        case T.GATE: case T.SHARD: return 7;
        case T.HEART: return 1;
        default: return Infinity;   // boulder, runestone, bedrock, waystone
    }
}

export function isSolid(t) { return t !== T.EMPTY; }
