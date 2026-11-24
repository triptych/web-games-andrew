// The pouring rules and the solver. Pure: no DOM, no clock, no Math.random.
//
// A blossom (tube) is { s, cap, kind, lock, done }:
//   s     the wisps from bottom to top, one letter each: 'a'..'i' a visible wisp of colour 0..8,
//         'A'..'I' the same colour hidden under mist (the top wisp is never hidden)
//   cap   how many it holds (4 for a blossom, 2 for an acorn cup)
//   kind  'bloom' (can bloom) or 'cup' (holds, never blooms)
//   lock  brambles: it opens once this many blossoms have bloomed (0 = open from the start)
//   done  bloomed: four of one colour, sealed for good
//
// One rule set serves the game, the hint, the bot and the level generator, so a level the generator proves
// solvable is solvable by exactly the moves a player can make.

import { CAP } from '../config.js';

export const colorOf = (ch) => (ch.charCodeAt(0) | 32) - 97;
export const isHidden = (ch) => ch >= 'A' && ch <= 'Z';
export const reveal = (ch) => ch.toLowerCase();

export function isOpen(t, blooms) { return !t.done && t.lock <= blooms; }

/** How many wisps of one colour sit visibly together at the top. */
export function topRun(s) {
    const L = s.length;
    if (!L) return 0;
    const c = s[L - 1];
    if (isHidden(c)) return 0;
    let n = 1;
    while (n < L && s[L - 1 - n] === c) n++;
    return n;
}

/** The reason a pour can't happen, or '' when it can. */
export function pourBlock(tubes, blooms, from, to) {
    if (from === to) return 'same';
    const A = tubes[from], B = tubes[to];
    if (!A || !B) return 'none';
    if (A.done || B.done) return 'done';
    if (A.lock > blooms || B.lock > blooms) return 'locked';
    if (!A.s.length) return 'empty';
    if (B.s.length >= B.cap) return 'full';
    if (B.s.length && B.s[B.s.length - 1] !== A.s[A.s.length - 1]) return 'colour';
    return '';
}

export const canPour = (tubes, blooms, from, to) => !pourBlock(tubes, blooms, from, to);

/** Pour the top run of `from` into `to`. Returns null when it can't, else the new tube list (changed tubes are
 *  copies; the input is never touched) and what happened. */
export function pour(tubes, blooms, from, to) {
    if (pourBlock(tubes, blooms, from, to)) return null;
    const A = tubes[from], B = tubes[to];
    const ch = A.s[A.s.length - 1];
    const n = Math.min(topRun(A.s), B.cap - B.s.length);
    let as = A.s.slice(0, A.s.length - n);
    let revealed = false;
    if (as.length && isHidden(as[as.length - 1])) { as = as.slice(0, -1) + reveal(as[as.length - 1]); revealed = true; }
    const bs = B.s + ch.repeat(n);
    const nb = { ...B, s: bs };
    let bloomed = false;
    if (nb.kind === 'bloom' && bs.length === CAP && nb.cap === CAP && bs === ch.repeat(CAP)) { nb.done = true; bloomed = true; }
    const out = tubes.slice();
    out[from] = { ...A, s: as };
    out[to] = nb;
    const nblooms = blooms + (bloomed ? 1 : 0);
    const unlocked = [];
    if (bloomed) out.forEach((t, i) => { if (t.lock > blooms && t.lock <= nblooms) unlocked.push(i); });
    return { tubes: out, blooms: nblooms, n, color: colorOf(ch), revealed, bloomed, unlocked };
}

export function isWon(tubes) { return tubes.every((t) => t.done || !t.s.length); }

/** Every legal pour. */
export function legalMoves(tubes, blooms) {
    const out = [];
    for (let f = 0; f < tubes.length; f++) {
        for (let t = 0; t < tubes.length; t++) if (canPour(tubes, blooms, f, t)) out.push([f, t]);
    }
    return out;
}

/** Pours that could ever help: never tip a pure blossom into an empty one of the same kind, and try only the
 *  first of several identical empty blossoms. */
export function usefulMoves(tubes, blooms) {
    const out = [];
    for (let f = 0; f < tubes.length; f++) {
        const A = tubes[f];
        if (!isOpen(A, blooms) || !A.s.length) continue;
        const run = topRun(A.s);
        const pure = run === A.s.length;
        const emptySeen = new Set();
        for (let t = 0; t < tubes.length; t++) {
            if (!canPour(tubes, blooms, f, t)) continue;
            const B = tubes[t];
            if (!B.s.length) {
                const sig = B.kind + B.cap;
                if (emptySeen.has(sig)) continue;
                emptySeen.add(sig);
                if (pure && A.kind === B.kind) continue;
                if (pure && B.kind === 'cup') continue;            // a whole set into a cup helps nobody
            }
            let score = 0;
            if (B.s.length) score += 10 + topRun(B.s);
            if (B.kind === 'bloom' && B.s.length + run >= B.cap && B.s.length && !B.s.split('').some(isHidden)) score += 40;
            if (run === A.s.length || (A.s.length > run && isHidden(A.s[A.s.length - 1 - run]))) score += 4;
            if (B.kind === 'cup') score -= 3;
            out.push([f, t, score]);
        }
    }
    out.sort((a, b) => b[2] - a[2]);
    return out;
}

function key(tubes, blooms) {
    const parts = [];
    for (const t of tubes) {
        if (t.done) continue;
        parts.push((t.lock > blooms ? 'L' + t.lock : '') + (t.kind === 'cup' ? 'c' : 'b') + t.s);
    }
    parts.sort();
    return blooms + '|' + parts.join(',');
}

/**
 * Depth-first search with a memo of seen positions (tube order doesn't matter). Returns the list of pours that
 * wins, or null if there is none within `budget` positions (then `.exhausted` says whether it gave up).
 */
export function solve(tubes, blooms = 0, budget = 60000) {
    const seen = new Set();
    const path = [];
    let visits = 0, gaveUp = false;
    const dfs = (ts, b) => {
        if (isWon(ts)) return true;
        const k = key(ts, b);
        if (seen.has(k)) return false;
        seen.add(k);
        if (++visits > budget) { gaveUp = true; return false; }
        for (const [f, t] of usefulMoves(ts, b)) {
            const r = pour(ts, b, f, t);
            path.push([f, t]);
            if (dfs(r.tubes, r.blooms)) return true;
            path.pop();
            if (gaveUp) return false;
        }
        return false;
    };
    const ok = dfs(tubes, blooms);
    const res = ok ? path : null;
    return { path: res, visits, gaveUp };
}

/** Shorten a found solution: drop any pour whose removal still leaves a winning line (cheap local search). */
export function tighten(tubes, blooms, path) {
    let best = path.slice();
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 0; i < best.length; i++) {
            const trial = best.slice(0, i).concat(best.slice(i + 1));
            let ts = tubes, b = blooms, ok = true;
            for (const [f, t] of trial) {
                const r = pour(ts, b, f, t);
                if (!r) { ok = false; break; }
                ts = r.tubes; b = r.blooms;
            }
            if (ok && isWon(ts)) { best = trial; improved = true; break; }
        }
    }
    return best;
}
