/**
 * rng.js — seeded PRNG (mulberry32). The simulation never calls Math.random,
 * so a bot run with a given seed replays identically in Node and the browser.
 */

export function makeRng(seed = 1) {
    let s = (seed >>> 0) || 1;
    const next = () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        range: (a, b) => a + (b - a) * next(),
        int:   (a, b) => a + Math.floor(next() * (b - a + 1)),
        pick:  (arr) => arr[Math.floor(next() * arr.length)],
        chance: (p) => next() < p,
    };
}
