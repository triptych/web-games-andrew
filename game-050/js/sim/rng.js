/**
 * rng.js — seeded PRNG (mulberry32) with a serialisable state.
 * Everything random in js/sim goes through one of these; the simulation never
 * calls Math.random, so a seed always replays the same battle, map or loot.
 */

export function makeRng(seed) {
    let a = seed >>> 0;
    const r = {
        get state() { return a >>> 0; },
        set state(v) { a = v >>> 0; },
        next() {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
        range(lo, hi) { return lo + (hi - lo) * r.next(); },
        /** Integer in [lo, hi] inclusive. */
        int(lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },
        chance(p) { return r.next() < p; },
        pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
        /** Pick from [[item, weight], ...] or an object {item: weight}. */
        weighted(list) {
            const entries = Array.isArray(list) ? list : Object.entries(list);
            let total = 0;
            for (const [, w] of entries) total += w;
            let x = r.next() * total;
            for (const [item, w] of entries) { x -= w; if (x < 0) return item; }
            return entries[entries.length - 1][0];
        },
        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(r.next() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },
    };
    return r;
}

/** Hash any mix of numbers/strings into a 32-bit seed. */
export function hashSeed(...parts) {
    let h = 2166136261 >>> 0;
    for (const p of parts) {
        const s = String(p);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        h ^= 0x9e3779b9;
        h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    }
    return (h ^ (h >>> 15)) >>> 0;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
