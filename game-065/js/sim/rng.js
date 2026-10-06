/**
 * rng.js — seeded PRNG. The simulation never calls Math.random: its state is
 * one 32-bit integer kept in the save, so a save replays identically.
 */

/** mulberry32 step. Returns [value in [0,1), next state]. */
export function step(a) {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Draw from an object holding `rng` (the integer state), advancing it. */
export function rand(holder) {
    const [v, next] = step(holder.rng);
    holder.rng = next;
    return v;
}

export function randRange(holder, lo, hi) { return lo + rand(holder) * (hi - lo); }

/** Weighted pick from [{w, ...}] */
export function pickWeighted(holder, list) {
    let total = 0;
    for (const e of list) total += e.w;
    let r = rand(holder) * total;
    for (const e of list) { r -= e.w; if (r <= 0) return e; }
    return list[list.length - 1];
}
