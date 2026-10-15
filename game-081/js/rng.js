// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.

/** One mulberry32 step on a state number; returns [value in [0,1), next state]. */
export function mulberry(a) {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/**
 * A generator whose state lives on a plain object (obj[key]), so whatever owns it stays a JSON
 * round trip: save the object, load it, and the next number is the same.
 */
export function objRng(obj, key = 'rs') {
    const rng = () => { const [v, a] = mulberry(obj[key] | 0); obj[key] = a; return v; };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };
    return rng;
}

/** A free-standing generator (tests, the bot). */
export function makeRng(seed) {
    const o = { rs: seed | 0 };
    return objRng(o);
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** A string → 32-bit seed. */
export function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
