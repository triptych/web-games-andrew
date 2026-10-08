/**
 * rng.js — the only source of randomness in the simulation.
 *
 * mulberry32 streams, integer hashes for position-keyed randomness, and 2D simplex
 * noise with fbm/ridged helpers. Pure: no Math.random, no DOM, no three.
 */

export function mulberry32(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return next;
}

/** A stream with helpers. `state()`/`setState()` let saves capture it. */
export class Rng {
    constructor(seed = 1) { this.s = seed >>> 0; }
    next() {
        this.s = (this.s + 0x6D2B79F5) | 0;
        let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    /** weighted pick from [[item, weight], ...] */
    weighted(list) {
        let total = 0;
        for (const [, w] of list) total += w;
        let r = this.next() * total;
        for (const [it, w] of list) { r -= w; if (r <= 0) return it; }
        return list[list.length - 1][0];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    fork(salt) { return new Rng(hash2(this.s, salt | 0, 0x9e37)); }
}

export function hashStr(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

/** Integer hash of two ints and a seed → uint32. */
export function hash2(x, y, seed = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return h >>> 0;
}

/** Hash → [0,1). */
export function hash01(x, y, seed = 0) { return hash2(x, y, seed) / 4294967296; }

// ------------------------------------------------------------------ simplex noise
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export class Simplex2 {
    constructor(seed = 1) {
        const r = mulberry32(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
        this.perm = new Uint8Array(512);
        this.permMod8 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.permMod8[i] = this.perm[i] & 7; }
    }
    /** ~[-1, 1] */
    noise(xin, yin) {
        const perm = this.perm, pm = this.permMod8;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s), j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const x0 = xin - (i - t), y0 = yin - (j - t);
        const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 > 0) { const g = GRAD[pm[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 > 0) { const g = GRAD[pm[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 > 0) { const g = GRAD[pm[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
        return 70 * (n0 + n1 + n2);
    }
    /** fractal sum, ~[-1, 1] */
    fbm(x, y, oct = 5, lac = 2.0, gain = 0.5) {
        let a = 1, f = 1, s = 0, n = 0;
        for (let o = 0; o < oct; o++) { s += a * this.noise(x * f, y * f); n += a; a *= gain; f *= lac; }
        return s / n;
    }
    /** ridged multifractal, [0, 1] with sharp crests */
    ridged(x, y, oct = 5, lac = 2.0, gain = 0.5) {
        let a = 1, f = 1, s = 0, n = 0, prev = 1;
        for (let o = 0; o < oct; o++) {
            let v = 1 - Math.abs(this.noise(x * f, y * f));
            v *= v;
            s += v * a * prev;
            n += a;
            prev = v;
            a *= gain; f *= lac;
        }
        return s / n;
    }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** shortest signed angle a → b */
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
