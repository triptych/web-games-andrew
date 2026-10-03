// Seeded randomness. The simulation never calls Math.random (dev/simtest.mjs
// greps for it), so a seed reproduces a whole mission exactly.

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export class RNG {
    constructor(seed) {
        this.seed = seed >>> 0;
        this.next = mulberry32(this.seed);
    }
    float() { return this.next(); }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    /** items: [{w, ...}] → one item, by weight */
    weighted(items, key = 'w') {
        let total = 0;
        for (const it of items) total += it[key];
        let r = this.next() * total;
        for (const it of items) {
            r -= it[key];
            if (r <= 0) return it;
        }
        return items[items.length - 1];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    fork(salt) { return new RNG((this.seed ^ Math.imul(salt + 1, 0x9E3779B1)) >>> 0); }
}
