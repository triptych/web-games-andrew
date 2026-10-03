/**
 * rng.js — seeded PRNG (mulberry32) and a small hash for deriving sub-seeds.
 * The simulation never calls Math.random, so a run replays exactly from its seed.
 */

export function makeRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const next = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        range: (a, b) => a + (b - a) * next(),
        int: (a, b) => a + Math.floor(next() * (b - a + 1)),
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        chance: (p) => next() < p,
        weighted(map) {
            let total = 0;
            for (const k in map) total += map[k];
            let r = next() * total;
            for (const k in map) { r -= map[k]; if (r <= 0) return k; }
            return Object.keys(map)[0];
        },
        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },
    };
}

/** FNV-style hash of a list of integers → 32-bit seed. */
export function hashSeed(...parts) {
    let h = 2166136261 >>> 0;
    for (const p of parts) {
        h ^= (p | 0);
        h = Math.imul(h, 16777619) >>> 0;
        h ^= h >>> 13;
        h = Math.imul(h, 0x5bd1e995) >>> 0;
    }
    return h >>> 0;
}

/** Hash a string to a 32-bit seed. */
export function strSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
}
