// Seeded PRNG (mulberry32). The sim draws every random number from one of these,
// so a seed replays the same run exactly.

export function makeRng(seed) {
    let a = seed >>> 0;
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    return rng;
}

/** Stateless hash of an integer → [0, 1). Used for terrain and for view-side jitter. */
export function hash01(n, seed = 0) {
    let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x27D4EB2D) ^ 0x9E3779B9, 0x85EBCA6B);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
