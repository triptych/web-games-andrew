// Seeded randomness. The city is a pure function of (seed, position), so a
// chunk rebuilt after being dropped comes back identical.

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hash2(a, b) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
}

/** A small helper object around an rng function. */
export function makeRand(seed) {
    const r = mulberry32(seed);
    return {
        next: r,
        range: (a, b) => a + (b - a) * r(),
        int: (a, b) => a + Math.floor(r() * (b - a + 1)),
        pick: (arr) => arr[Math.floor(r() * arr.length)],
        chance: (p) => r() < p,
    };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
