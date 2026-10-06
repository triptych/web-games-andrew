// Deterministic randomness. The simulation never calls Math.random (dev/simtest.mjs greps for it):
// every floor, pack and drop comes from an RNG whose whole state is one integer in a plain object,
// so it can be saved and a reload resumes the same sequence.

export function hashStr(s) {
    let h = 0x811c9dc5;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Mix a base hash with any number of keys (numbers or strings) into a new 32-bit seed. */
export function sub(base, ...keys) {
    let h = base >>> 0;
    for (const k of keys) {
        const kh = typeof k === 'number' ? Math.imul(k | 0, 2654435761) >>> 0 : hashStr(k);
        h = Math.imul(h ^ kh, 0x85ebca6b) >>> 0;
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35) >>> 0;
        h ^= h >>> 16;
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
    /** Pick a key from { key: weight } or an item from [[item, weight], ...]. */
    weighted(table) {
        const entries = Array.isArray(table) ? table : Object.entries(table);
        let total = 0;
        for (const e of entries) total += e[1];
        let r = this.next() * total;
        for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
        return entries[entries.length - 1][0];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

/** UI-only randomness (names in the creator, cosmetic jitter). Never use from js/sim. */
export function randomSeedText() {
    const a = ['PIP', 'ZEST', 'RIND', 'PULP', 'JAM', 'CORE', 'SEED', 'PEEL'];
    return a[Math.floor(Math.random() * a.length)] + '-' + Math.floor(Math.random() * 9000 + 1000);
}
