// Randomness that lives inside the game state: G.rs is a plain number, so a whole game is a
// JSON object that can be saved, copied and replayed. Pure.

import { rngNext } from '../rng.js';

export function rand(G) {
    const [v, s] = rngNext(G.rs);
    G.rs = s;
    return v;
}
export const rint = (G, lo, hi) => lo + Math.floor(rand(G) * (hi - lo + 1));
export const pick = (G, arr) => arr[Math.floor(rand(G) * arr.length)];
/** Weighted pick from [[value, weight], ...]. */
export function wpick(G, pairs) {
    const tot = pairs.reduce((a, p) => a + p[1], 0);
    let r = rand(G) * tot;
    for (const p of pairs) { r -= p[1]; if (r < 0) return p[0]; }
    return pairs[pairs.length - 1][0];
}
