/**
 * rng.js — seeded deterministic RNG (mulberry32).
 * The whole simulation draws from one of these so a run can be replayed
 * bit-for-bit in a Node harness. Never call Math.random() inside js/sim/.
 */

export function hashSeed(str) {
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < String(str).length; i++) {
        h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
}

export function makeRng(seed) {
    let a = typeof seed === 'number' ? (seed >>> 0) || 1 : hashSeed(seed);
    const rng = () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range  = (lo, hi) => lo + rng() * (hi - lo);
    rng.int    = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
    rng.pick   = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
    rng.chance = (p) => rng() < p;
    rng.sign   = () => (rng() < 0.5 ? -1 : 1);
    rng.state  = () => a >>> 0;
    return rng;
}
