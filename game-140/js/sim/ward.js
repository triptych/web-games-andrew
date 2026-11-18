// The ward-locks. Pure.
//
// A ward is a stack of concentric rings, `slots` runes each (null is a blank stone). Ring r is turned `off[r]`
// steps clockwise; the rune at the top of ring r is ring[r][(slots - off[r]) % slots]. The ward opens when every
// ring shows its `key` rune at the top. Turning ring i by d also turns each coupled ring j by f·d.
//
// Every start state is made by scrambling the solved state with real moves, so it is always reachable, and is kept
// only if the shortest solution (by breadth-first search over every state) lies in the ward's `moves` band.

import { RUNES, WARDS } from './data/chapters.js';
import { makeRng } from '../rng.js';

const mod = (a, n) => ((a % n) + n) % n;

export function topIndex(w, r) { return mod(-w.off[r], w.slots); }
export function topRune(w, r) { return w.rings[r][topIndex(w, r)]; }
export function isSolved(w) { return w.key.every((k, r) => topRune(w, r) === k); }

/** Turn ring i by d (±1), with its couplings. Mutates w. */
export function turn(w, i, d) {
    w.off[i] = mod(w.off[i] + d, w.slots);
    for (const [j, f] of w.couple[i]) w.off[j] = mod(w.off[j] + f * d, w.slots);
}

const enc = (off, n) => off.reduce((a, v) => a * n + v, 0);
function goalOffsets(w) {
    return w.key.map((k, r) => mod(-w.rings[r].indexOf(k), w.slots));
}

/** Distances to the goal from every reachable state, by BFS (moves are invertible, so search from the goal). */
function distances(w) {
    const n = w.slots, K = w.rings.length;
    const goal = goalOffsets(w);
    const dist = new Map([[enc(goal, n), 0]]);
    let frontier = [goal];
    while (frontier.length) {
        const next = [];
        for (const off of frontier) {
            const d0 = dist.get(enc(off, n));
            for (let i = 0; i < K; i++) for (const d of [1, -1]) {
                const t = { off: off.slice(), slots: n, couple: w.couple };
                turn(t, i, d);
                const k = enc(t.off, n);
                if (!dist.has(k)) { dist.set(k, d0 + 1); next.push(t.off); }
            }
        }
        frontier = next;
    }
    return dist;
}

/** The fewest turns that open the ward from its current state. */
export function solveLength(w) { return distances(w).get(enc(w.off, w.slots)) ?? Infinity; }

/** The next turn on a shortest path to the goal: { ring, dir }, or null if solved. */
export function hint(w) {
    if (isSolved(w)) return null;
    const dist = distances(w);
    const here = dist.get(enc(w.off, w.slots));
    for (let i = 0; i < w.rings.length; i++) for (const d of [1, -1]) {
        const t = { off: w.off.slice(), slots: w.slots, couple: w.couple };
        turn(t, i, d);
        if (dist.get(enc(t.off, w.slots)) === here - 1) return { ring: i, dir: d };
    }
    return null;
}

/** Build ward `id` for a game seed. Deterministic. */
export function makeWard(id, seed) {
    const W = WARDS[id];
    if (!W) throw new Error('unknown ward ' + id);
    const rng = makeRng((seed ^ Math.imul(hashStr(id), 2654435761)) >>> 0);
    for (let attempt = 0; attempt < 400; attempt++) {
        const rings = W.key.map((k) => {
            const ring = [];
            const others = RUNES.filter((r) => r !== k);
            for (let s = 0; s < W.slots; s++) ring.push(rng() < 0.35 ? null : rng.pick(others));
            ring[rng.int(0, W.slots - 1)] = k;
            return ring;
        });
        const w = { id, slots: W.slots, rings, couple: W.couple, key: W.key.slice(), off: [], moves: 0, hints: 0 };
        w.off = goalOffsets(w);
        // scramble with real moves, so the start can always be solved
        for (let s = 0; s < 6 + W.moves[1] * 2; s++) turn(w, rng.int(0, rings.length - 1), rng() < 0.5 ? 1 : -1);
        const len = solveLength(w);
        if (len >= W.moves[0] && len <= W.moves[1]) { w.par = len; return w; }
    }
    throw new Error('could not make ward ' + id);
}

function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
}
