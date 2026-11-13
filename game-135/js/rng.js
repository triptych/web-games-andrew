// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.

/** mulberry32 with a saveable state. The seed is hashed first, so seeds 1, 2, 3 don't start alike. */
export function makeRng(seed) {
    let a = hashSeed(seed);
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.chance = (p) => rng() < p;
    rng.state = () => a;
    rng.setState = (s) => { a = s | 0; };
    return rng;
}

export function hashSeed(seed) {
    let h = (seed | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) | 0;
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** A child seed from a parent seed and a few integers (an area's seed from the game seed, its id and the visit). */
export const childSeed = (seed, a = 0, b = 0) => (hash3(seed, a, b) * 2147483647) | 0;

/** Pick a key from { key: weight }. */
export function weighted(rng, table) {
    let total = 0;
    for (const k in table) total += table[k];
    let r = rng() * total;
    for (const k in table) { r -= table[k]; if (r < 0) return k; }
    return Object.keys(table).pop();
}
