// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.
// The state is a plain number stored on the object it belongs to, so saves are plain JSON.

/** Advance o[key] (a mulberry32 state) and return a number in [0, 1). */
export function rnd(o, key = 'rs') {
    let a = (o[key] = (o[key] + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (o, lo, hi) => lo + Math.floor(rnd(o) * (hi - lo + 1));
export const rpick = (o, arr) => arr[Math.floor(rnd(o) * arr.length)];
export function rshuffle(o, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(o) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
/** Pick a key of `weights` ({ key: weight }) at random. */
export function rweighted(o, weights) {
    let total = 0;
    for (const k in weights) total += Math.max(0, weights[k]);
    let r = rnd(o) * total;
    for (const k in weights) { r -= Math.max(0, weights[k]); if (r < 0) return k; }
    return Object.keys(weights)[0];
}
/** Mix a few numbers into a fresh 32-bit seed. */
export function mix(...xs) {
    let h = 0x9E3779B9;
    for (const x of xs) { h = Math.imul(h ^ (x | 0), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; }
    return h | 0;
}
