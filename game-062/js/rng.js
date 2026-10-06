// Seeded randomness. The simulation never calls Math.random, so a world is a pure function of its
// inputs and a bot can replay any shot exactly.

export function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

// Integer hash of two ints → [0, 1).
export function hash2(x, z, seed = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);

// Smooth value noise in [-1, 1].
export function vnoise(x, z, seed = 0) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const fx = fade(x - xi), fz = fade(z - zi);
    const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
    const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
    return ((a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz) * 2 - 1;
}

export function fbm(x, z, seed = 0, oct = 3) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
}

// A small seedable generator whose whole state is one number, so it clones with the world.
export class Rng {
    constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
    next() {
        let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(n) { return Math.floor(this.next() * n); }
    pick(arr) { return arr[this.int(arr.length)]; }
}
