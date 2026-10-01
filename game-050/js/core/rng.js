/**
 * rng.js — seeded randomness. The persistent stream lives in the save, so a
 * reload never re-rolls a pull; battles and generators get their own seeds.
 */

export function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export class Rng {
    constructor(seed = 1) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** float in [a, b) */
    range(a, b) { return a + (b - a) * this.next(); }
    /** integer in [a, b] */
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    /** entries: [[value, weight], ...] */
    weighted(entries) {
        let total = 0;
        for (const e of entries) total += e[1];
        let r = this.next() * total;
        for (const e of entries) { r -= e[1]; if (r < 0) return e[0]; }
        return entries[entries.length - 1][0];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    /** n distinct picks */
    sample(arr, n) { return this.shuffle(arr.slice()).slice(0, n); }
    seed() { return Math.floor(this.next() * 4294967296) >>> 0; }
    fork(salt = 0) { return new Rng((this.seed() ^ hashStr(String(salt))) >>> 0); }
}

/** A stream whose state is read from / written back to an object (the save). */
export function streamRng(holder, key = 'rng') {
    const r = new Rng(holder[key] || 12345);
    const next = r.next.bind(r);
    r.next = () => { const v = next(); holder[key] = r.s; return v; };
    return r;
}
