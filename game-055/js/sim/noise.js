// Value noise shared by the simulation (here, in doubles) and the terrain
// baker (gfx/terrainGLSL.js, in float32 on the GPU). The integer hash, the
// interpolation and the octave rotation are written identically in both, so
// "is this point water?" has the same answer for a spawning gunboat and for
// the pixels under it. dev/browsertest.mjs reads a baked chunk back and checks.

// Integers are shifted by 2^30 before hashing so they're always positive:
// converting a negative int to uint is the one step GLSL and JS might disagree on.
const OFF = 1073741824;

export function hash2(ix, iy, s) {
    let h = (Math.imul((ix + OFF) | 0, 374761393) + Math.imul((iy + OFF) | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
}

export function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
    const c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal value noise in 0..1. Each octave is rotated and doubled. */
export function fbm(x, y, s, oct) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < oct; i++) {
        sum += amp * vnoise(x, y, s + i * 17);
        norm += amp;
        const nx = 1.6 * x - 1.2 * y;
        const ny = 1.2 * x + 1.6 * y;
        x = nx; y = ny;
        amp *= 0.5;
    }
    return sum / norm;
}

/** Ridged noise in 0..1: high along the lines where the noise crosses 0.5. */
export function ridged(x, y, s, oct) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < oct; i++) {
        sum += amp * (1 - Math.abs(2 * vnoise(x, y, s + i * 17) - 1));
        norm += amp;
        const nx = 1.6 * x - 1.2 * y;
        const ny = 1.2 * x + 1.6 * y;
        x = nx; y = ny;
        amp *= 0.5;
    }
    return sum / norm;
}
