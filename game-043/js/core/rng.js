// ============================================================
// Seeded randomness and noise. Nothing in the simulation or the
// generators calls Math.random: a seed reproduces a world exactly.
// ============================================================

export function hash32(...parts) {
    let h = 0x811c9dc5;
    for (const p of parts) {
        const s = String(p);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        h ^= 0x9e3779b9;
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    }
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
}

/** Turn whatever the player typed into a 32-bit seed. Numbers stay numbers. */
export function seedFromText(t) {
    const s = String(t ?? '').trim();
    if (/^\d{1,10}$/.test(s)) return (Number(s) >>> 0) || 1;
    return hash32('glimmerglen', s) || 1;
}

export class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x6d2b79f5; }
    next() {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }   // inclusive
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    weighted(table) {        // [[item, weight], ...]
        let total = 0;
        for (const [, w] of table) total += w;
        let r = this.next() * total;
        for (const [item, w] of table) { if ((r -= w) < 0) return item; }
        return table[table.length - 1][0];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    fork(...tag) { return new RNG(hash32(this.s, ...tag)); }
}

export const rngFor = (...parts) => new RNG(hash32(...parts));

/** A true modulo: JavaScript's % is a remainder and goes negative. */
export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------ value noise
/** Smooth 2D value noise in [0,1], lattice hashed from the seed. */
export function makeNoise(seed) {
    const lat = (x, y) => hash32(seed, x, y) / 4294967296;
    const sm = t => t * t * (3 - 2 * t);
    function n2(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
        const u = sm(xf), v = sm(yf);
        return lerp(lerp(a, b, u), lerp(c, d, u), v);
    }
    return function fbm(x, y, oct = 4) {
        let amp = 1, freq = 1, sum = 0, norm = 0;
        for (let o = 0; o < oct; o++) {
            sum += amp * n2(x * freq + o * 17.3, y * freq - o * 9.1);
            norm += amp; amp *= 0.5; freq *= 2;
        }
        return sum / norm;
    };
}
