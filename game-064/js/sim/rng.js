// Deterministic randomness for the simulation. Never use Math.random in js/sim:
// dev/simtest.mjs greps for it, so a seed always replays the same sea.

export function hashStr(s) {
    let h = 0x811c9dc5;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// mulberry32 with its state exposed, so a match can save and restore it.
export class RNG {
    constructor(seed = 1) { this.s = seed >>> 0; }
    next() {
        this.s = (this.s + 0x6D2B79F5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    pick(arr) { return arr[this.int(arr.length)]; }
    chance(p) { return this.next() < p; }
    weighted(items, weightOf) {
        let total = 0;
        for (const it of items) total += weightOf(it);
        let r = this.next() * total;
        for (const it of items) { r -= weightOf(it); if (r < 0) return it; }
        return items[items.length - 1];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
