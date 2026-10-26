// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.

/** mulberry32 with a saveable state. */
export function makeRng(seed) {
    let a = seed >>> 0;
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
    rng.weighted = (arr, fn) => {
        let tot = 0;
        for (const x of arr) tot += Math.max(0, fn(x));
        if (tot <= 0) return arr[Math.floor(rng() * arr.length)];
        let r = rng() * tot;
        for (const x of arr) { r -= Math.max(0, fn(x)); if (r < 0) return x; }
        return arr[arr.length - 1];
    };
    rng.shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
        return arr;
    };
    rng.state = () => a;
    rng.setState = (s) => { a = s | 0; };
    return rng;
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** A seeded rng that depends only on its inputs (floor layouts, item names, sprites). */
export const seeded = (a, b = 0, c = 0) => makeRng(Math.floor(hash3(a, b, c) * 4294967296));
