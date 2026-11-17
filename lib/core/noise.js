// lib/core/noise.js — seeded, stateless 2D value noise and fBm. Pure.
//
// The version games 063–125 copy into rng.js: same hash, same octave seeds, so terrain
// generated with it matches theirs value for value.
//
//   import { vnoise, fbm } from '../../lib/core/noise.js';

import { hash3 } from './rng.js';

/** Smooth 2D value noise. Returns [0, 1). */
export function vnoise(seed, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash3(x0, y0, seed), b = hash3(x0 + 1, y0, seed);
    const c = hash3(x0, y0 + 1, seed), d = hash3(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal sum of `oct` octaves of vnoise, normalised back to [0, 1). */
export function fbm(seed, x, y, oct = 4) {
    let s = 0, amp = 1, f = 1, n = 0;
    for (let o = 0; o < oct; o++) { s += vnoise(seed + o * 101, x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
}

/** Ridged fBm (sharp crests, for mountains and veins). [0, 1]. */
export function ridged(seed, x, y, oct = 4) {
    let s = 0, amp = 1, f = 1, n = 0;
    for (let o = 0; o < oct; o++) {
        const v = 1 - Math.abs(vnoise(seed + o * 101, x * f, y * f) * 2 - 1);
        s += v * v * amp; n += amp; amp *= 0.5; f *= 2.03;
    }
    return s / n;
}
