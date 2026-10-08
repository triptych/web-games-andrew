// Deterministic randomness. The simulation never calls Math.random (dev/simtest.mjs greps for it):
// maps, waves and people all draw from an RNG whose whole state is one integer in a plain
// object, so a level plays out the same every time.

export function hashStr(s) {
    let h = 0x811c9dc5;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32 over a `{ s }` state object (or a numeric seed). */
export class RNG {
    constructor(seed = 1) {
        this.st = typeof seed === 'object' ? seed : { s: (seed >>> 0) || 0x9e3779b9 };
    }
    next() {
        const st = this.st;
        st.s = (st.s + 0x6d2b79f5) >>> 0;
        let t = st.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

/** 2D value noise on a seeded lattice; `fbm` sums octaves into roughly [0, 1]. */
export class Noise2 {
    constructor(seed) {
        const r = new RNG(seed);
        this.g = new Float32Array(256 * 256);
        for (let i = 0; i < this.g.length; i++) this.g[i] = r.next();
    }
    s(ix, iy) { return this.g[(iy & 255) * 256 + (ix & 255)]; }
    get(x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = x - x0, ty = y - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = this.s(x0, y0) + (this.s(x0 + 1, y0) - this.s(x0, y0)) * sx;
        const b = this.s(x0, y0 + 1) + (this.s(x0 + 1, y0 + 1) - this.s(x0, y0 + 1)) * sx;
        return a + (b - a) * sy;
    }
    fbm(x, y, oct = 3) {
        let amp = 1, f = 1, sum = 0, norm = 0;
        for (let o = 0; o < oct; o++) { sum += this.get(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
        return sum / norm;
    }
}
