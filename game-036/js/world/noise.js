/**
 * noise.js — seeded PRNG + 2D value noise (fractal sum of octaves).
 * Everything procedural in this game derives from one root seed via
 * this module, so the same seed always regenerates the same island.
 */

/** mulberry32 — small, fast, decent-quality seeded PRNG. Returns a function ()=>[0,1). */
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeedFromString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
}

/**
 * ValueNoise2D — grid-based value noise with smooth (smoothstep) interpolation.
 * Deterministic per (seed, gridSize). Call .get(x, y) with any real x,y.
 */
export class ValueNoise2D {
    constructor(seed, gridSize = 256) {
        this.gridSize = gridSize;
        const rng = makeRng(seed);
        this.grid = new Float32Array(gridSize * gridSize);
        for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng();
    }

    _sample(ix, iy) {
        const g = this.gridSize;
        const xi = ((ix % g) + g) % g;
        const yi = ((iy % g) + g) % g;
        return this.grid[yi * g + xi];
    }

    get(x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = x - x0, ty = y - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const v00 = this._sample(x0, y0);
        const v10 = this._sample(x0 + 1, y0);
        const v01 = this._sample(x0, y0 + 1);
        const v11 = this._sample(x0 + 1, y0 + 1);
        const a = v00 + (v10 - v00) * sx;
        const b = v01 + (v11 - v01) * sx;
        return a + (b - a) * sy;
    }

    /** Fractal Brownian motion sum of octaves at world scale `scale`. Returns roughly [0,1]. */
    fbm(x, y, octaves = 4, scale = 0.02, persistence = 0.5) {
        let amp = 1, freq = scale, sum = 0, norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += this.get(x * freq, y * freq) * amp;
            norm += amp;
            amp *= persistence;
            freq *= 2;
        }
        return sum / norm;
    }
}
