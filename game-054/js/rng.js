/**
 * rng.js — seeded randomness. Everything procedural (levels, monster species,
 * names) draws from here so a seed always rebuilds the same thing. Combat
 * jitter uses the same generator family but its own stream.
 */

/** mulberry32 — small, fast, good enough for games. */
export function makeRng(seed) {
    let a = seed >>> 0;
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };
    /** Pick from [{w, ...}] by weight. */
    rng.weighted = (list, key = 'w') => {
        let total = 0;
        for (const it of list) total += it[key];
        let r = rng() * total;
        for (const it of list) { r -= it[key]; if (r <= 0) return it; }
        return list[list.length - 1];
    };
    rng.state = () => a;
    return rng;
}

export function hashStr(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

/** Derive a sub-seed from a seed and any number of labels. */
export function subSeed(seed, ...labels) {
    return hashStr(`${seed}|${labels.join('|')}`);
}
