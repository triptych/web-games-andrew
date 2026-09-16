// ============================================================
// core/noise.js - hash-based value noise (GDD §6.7)
// No gradient tables, no state: a value at any coordinate, forever.
// ============================================================
import { hashInts } from './rand.js';

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** @pure Deterministic value at an integer lattice point. [0,1) */
function latticeValue(master, salt, xi, yi) {
  return hashInts(master.words, salt, xi, yi) / 4294967296;
}

/** @pure Smooth value noise at real coordinates. [0,1] */
export function valueNoise2D(master, salt, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = fade(x - xi), yf = fade(y - yi);
  const v00 = latticeValue(master, salt, xi, yi);
  const v10 = latticeValue(master, salt, xi + 1, yi);
  const v01 = latticeValue(master, salt, xi, yi + 1);
  const v11 = latticeValue(master, salt, xi + 1, yi + 1);
  return lerp(lerp(v00, v10, xf), lerp(v01, v11, xf), yf);
}

/** @pure Fractal Brownian motion, 1-8 octaves. [0,1] */
export function fbm2D(master, salt, x, y, { octaves = 4, freq = 1, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 1, sum = 0, norm = 0, f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(master, salt + o * 7919, x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** @pure Ridged noise - mountain spines and river valleys. */
export function ridged2D(master, salt, x, y, opts) {
  const n = fbm2D(master, salt, x, y, opts);
  return 1 - Math.abs(n * 2 - 1);
}

/** @pure Domain-warped fbm - breaks up the grid look. */
export function warpedFbm2D(master, salt, x, y, opts, warpAmt = 8) {
  const wx = fbm2D(master, salt + 1013, x * 0.5, y * 0.5, { octaves: 2 });
  const wy = fbm2D(master, salt + 2027, x * 0.5, y * 0.5, { octaves: 2 });
  return fbm2D(master, salt, x + (wx - 0.5) * warpAmt, y + (wy - 0.5) * warpAmt, opts);
}
