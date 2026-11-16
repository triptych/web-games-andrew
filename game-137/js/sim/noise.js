// Seeded value noise for the terrain. Stateless: the same seed and point always give the same value,
// so the sim (map shapes) and the view (surface detail) can share it. Pure.

import { hash3 } from '../rng.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function makeNoise(seed) {
    const s = seed | 0;
    /** Smooth value noise in [0, 1], one feature per unit. */
    const n2 = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
        const a = hash3(ix, iy, s), b = hash3(ix + 1, iy, s), c = hash3(ix, iy + 1, s), d = hash3(ix + 1, iy + 1, s);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    /** Fractal noise: oct octaves of n2, each twice as fine and half as strong, in [0, 1]. */
    const fbm = (x, y, oct = 4) => {
        let t = 0, amp = 0.5, f = 1, norm = 0;
        for (let k = 0; k < oct; k++) {
            t += amp * n2(x * f + k * 17.31, y * f - k * 9.17);
            norm += amp; amp *= 0.5; f *= 2.03;
        }
        return t / norm;
    };
    return { n2, fbm };
}
