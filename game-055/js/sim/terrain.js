// Terrain classification for the six biomes. Each function here has a twin
// in gfx/terrainGLSL.js that colours the same shapes; keep them in step.
//
// Coordinates: x is the field's x (0..540 is the play field, the terrain runs
// on beyond it on wide screens), y is distance north along the flight path
// (it grows as the camera scrolls). Everything is a pure function of (x, y,
// seed), so ground units can be placed on land, boats on water, and a crater
// can tell whether it should splash.

import { fbm, ridged, vnoise } from './noise.js';

export const LAND = 0, WATER = 1, LAVA = 2;

export const BIOME_IDS = ['coast', 'jungle', 'desert', 'arctic', 'city', 'volcano'];

/** Phase for sin() terms: reduced on the CPU so the GPU never sees a huge argument. */
export function seedPhase(seed) {
    return Math.fround(((seed % 997) * 0.37) % (Math.PI * 2));
}

export function makeTerrain(biome, seed, opts = {}) {
    const S = seed % 100000;
    const phase = seedPhase(S);
    const platformY = opts.platformY ?? Infinity;
    const bi = BIOME_IDS.indexOf(biome);

    const coastH = (x, y) => fbm(x / 380, y / 380, S, 5) + 0.35 * (vnoise(x / 1500, y / 1500, S + 101) - 0.5);
    const riverCX = (y) => 270 + 150 * Math.sin(y / 520 + phase) + 120 * (vnoise(1.5, y / 600, S + 31) - 0.5);
    const roadX = (y) => 270 + 380 * (vnoise(7.5, y / 900, S + 51) - 0.5);
    const arcticH = (x, y) => fbm(x / 360, y / 360, S, 5) + 0.3 * (vnoise(x / 1400, y / 1400, S + 101) - 0.5);
    const canalX = (y) => 270 + 130 * Math.sin(y / 900 + phase);

    function kind(x, y) {
        switch (bi) {
            case 0: return coastH(x, y) - (y > platformY ? Math.min(0.5, (y - platformY) / 500) : 0) < 0.5 ? WATER : LAND;
            case 1: {
                const cx = riverCX(y);
                const rw = 48 + 26 * vnoise(3.5, y / 350, S + 37);
                const d = Math.abs(x - cx) + (fbm(x / 90, y / 90, S + 41, 3) - 0.5) * 40;
                if (d < rw) return WATER;
                return fbm(x / 300, y / 300, S, 4) < 0.28 ? WATER : LAND;
            }
            case 2: return fbm(x / 420, y / 420, S, 5) < 0.26 ? WATER : LAND;
            case 3: return arcticH(x, y) < 0.41 ? WATER : LAND;
            case 4: {
                const m = y - 150 * Math.floor(y / 150);
                if (Math.abs(x - canalX(y)) < 30 && m >= 24) return WATER;
                return LAND;
            }
            case 5: {
                if (y >= platformY) return LAND;
                if (fbm(x / 340, y / 340, S, 4) < 0.27) return LAVA;
                return ridged(x / 260, y / 260, S + 61, 4) > 0.86 ? LAVA : LAND;
            }
        }
        return LAND;
    }

    /** 0..1, CPU-only: where decor (trees, huts, rocks) grows. */
    function moisture(x, y) { return fbm(x / 170, y / 170, S + 200, 3); }

    /** Distance from the desert highway's centre line (Infinity elsewhere). */
    function roadDist(x, y) { return bi === 2 ? Math.abs(x - roadX(y)) : Infinity; }

    /** Land "height" 0..1 used for decor choices (rocky highlands, beaches). */
    function height(x, y) {
        switch (bi) {
            case 0: return coastH(x, y) - (y > platformY ? Math.min(0.5, (y - platformY) / 500) : 0);
            case 3: return arcticH(x, y);
            case 2: return fbm(x / 420, y / 420, S, 5);
            default: return fbm(x / 300, y / 300, S, 4);
        }
    }

    /** City only: is (x, y) on a street (vs a rooftop)? */
    function street(x, y) {
        if (bi !== 4) return false;
        const mx = (x + 2000) - 150 * Math.floor((x + 2000) / 150);
        const my = y - 150 * Math.floor(y / 150);
        return mx < 24 || my < 24;
    }

    return { biome, bi, seed: S, phase, platformY, kind, moisture, roadDist, roadX, height, street, riverCX, canalX };
}

/** Find a spot near (x, y) whose kind is `want`; scans outwards along x. */
export function findSpot(terrain, x, y, want, minX = 30, maxX = 510, step = 18) {
    for (let i = 0; i < 40; i++) {
        const dx = (i >> 1) * step * (i & 1 ? 1 : -1);
        const px = x + dx;
        if (px < minX || px > maxX) continue;
        if (terrain.kind(px, y) === want) {
            // keep away from the edge of a region: neighbours must match too
            if (terrain.kind(px - 14, y) === want && terrain.kind(px + 14, y) === want &&
                terrain.kind(px, y - 14) === want && terrain.kind(px, y + 14) === want) return px;
        }
    }
    return null;
}
