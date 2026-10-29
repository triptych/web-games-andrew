// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.
// The state is a plain number kept on the game object, so a structuredClone of the game is a
// complete copy (the bot and the tests clone games freely).

/** mulberry32 step on holder.r; returns [0, 1). */
export function rnd(holder) {
    let a = (holder.r = (holder.r + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (h, lo, hi) => lo + Math.floor(rnd(h) * (hi - lo + 1));
export const rpick = (h, arr) => arr[Math.floor(rnd(h) * arr.length)];
export function rshuffle(h, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd(h) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** A self-contained generator for the view (sparkles, idle motion). Never used by the sim. */
export function makeRng(seed) {
    const h = { r: seed | 0 };
    const f = () => rnd(h);
    f.range = (lo, hi) => lo + rnd(h) * (hi - lo);
    return f;
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
