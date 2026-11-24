// Level generation. Every level is built from its number by a seeded generator, then proved solvable by the
// solver with the game's own pour rule. A layout the solver can't finish is thrown away and the next attempt
// tried, so the same number always gives the same proven level. Pure.

import { CAP, CUP_CAP, LEVELS_PER_CHAPTER, SOLVER_BUDGET, WISPS } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { solve, tighten, isHidden } from './rules.js';

// Colours per level in each chapter (index = level within the chapter).
const COLOURS = [
    [3, 3, 4, 4, 5, 5, 5, 6, 6, 7],    // meadow: plain sorting
    [4, 5, 5, 6, 6, 6, 7, 7, 7, 8],    // hollow: mist
    [5, 5, 6, 6, 7, 7, 7, 8, 8, 8],    // moonpond: brambles
    [5, 6, 6, 7, 7, 7, 8, 8, 8, 9],    // grotto: acorn cups
    [6, 7, 7, 8, 8, 8, 9, 9, 9, 9],    // canopy: everything
];

/** What a level is made of. n is 0-based. */
export function levelSpec(n) {
    const ch = Math.min(4, Math.floor(n / LEVELS_PER_CHAPTER));
    const i = n % LEVELS_PER_CHAPTER;
    const spec = { n, ch, colours: COLOURS[ch][i], empties: 2, cups: 0, mist: 0, locks: [], seed: Math.floor(hash3(n, 148, 7) * 1e9) };
    if (ch === 1) spec.mist = i < 3 ? 1 : i < 7 ? 2 : 3;
    if (ch === 2) {
        // early: an empty blossom wrapped in brambles; later the brambles hold a mixed blossom shut
        if (i < 3) spec.locks = [{ full: false, need: 1 + (i > 0 ? 1 : 0) }];
        else if (i < 8) spec.locks = [{ full: true, need: 1 + (i % 3) }];
        else spec.locks = [{ full: true, need: 2 }, { full: false, need: 3 }];
    }
    if (ch === 3) { spec.empties = 1; spec.cups = i < 5 ? 2 : 1; if (i >= 5) spec.empties = 2; }
    if (ch === 4) {
        spec.mist = i < 4 ? 1 : 2;
        if (i % 2 === 0) spec.locks = [{ full: true, need: 1 + (i % 3) }];
        if (i % 3 === 1) spec.cups = 1;
    }
    return spec;
}

/** A free-play puzzle (the daily dewdrop and the endless dreams) from any seed. */
export function freeSpec(seed) {
    const r = makeRng(seed);
    const spec = { n: -1, ch: r.int(0, 4), colours: r.int(6, 8), empties: 2, cups: 0, mist: 0, locks: [], seed };
    const twist = r.int(0, 3);
    if (twist === 1) spec.mist = r.int(1, 2);
    if (twist === 2) spec.locks = [{ full: true, need: r.int(1, 2) }];
    if (twist === 3) spec.cups = 1;
    return spec;
}

function shuffle(rng, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

/** One random layout for a spec. */
function layout(spec, rng) {
    const k = spec.colours;
    const letters = [];
    for (let c = 0; c < k; c++) for (let j = 0; j < CAP; j++) letters.push(String.fromCharCode(97 + c));
    shuffle(rng, letters);
    const full = [];
    for (let i = 0; i < k; i++) full.push(letters.slice(i * CAP, i * CAP + CAP).join(''));
    // too tidy to start: a blossom already sorted, or three of a kind on top
    for (const s of full) {
        if (s === s[0].repeat(CAP)) return null;
        if (s[CAP - 1] === s[CAP - 2] && s[CAP - 2] === s[CAP - 3]) return null;
    }
    const tubes = full.map((s) => ({ s, cap: CAP, kind: 'bloom', lock: 0, done: false }));
    if (spec.mist) {
        for (const t of tubes) {
            const depth = Math.min(CAP - 1, spec.mist + (rng() < 0.35 ? 1 : 0) - (rng() < 0.25 ? 1 : 0));
            let s = '';
            for (let j = 0; j < t.s.length; j++) s += j < depth ? t.s[j].toUpperCase() : t.s[j];
            t.s = s;
        }
    }
    let lockIx = tubes.length - 1;
    for (const L of spec.locks) {
        if (L.full) { tubes[lockIx].lock = L.need; lockIx--; } else tubes.push({ s: '', cap: CAP, kind: 'bloom', lock: L.need, done: false });
    }
    for (let i = 0; i < spec.empties; i++) tubes.push({ s: '', cap: CAP, kind: 'bloom', lock: 0, done: false });
    for (let i = 0; i < spec.cups; i++) tubes.push({ s: '', cap: CUP_CAP, kind: 'cup', lock: 0, done: false });
    // shuffle the order a little so the empty blossoms are not always on the right
    const order = shuffle(rng, tubes.map((_, i) => i));
    return order.map((i) => tubes[i]);
}

const cache = new Map();

/**
 * Build and prove a puzzle for a spec. Returns { tubes, par, colours, spec, attempts }.
 * Deterministic: attempt a uses seed + a, and the spec is relaxed (one more empty blossom) if 40 attempts fail.
 */
export function buildPuzzle(spec) {
    const ck = JSON.stringify(spec);
    if (cache.has(ck)) return structuredCopy(cache.get(ck));
    let s = { ...spec, locks: spec.locks.map((l) => ({ ...l })) };
    for (let round = 0; round < 4; round++) {
        for (let a = 0; a < 40; a++) {
            const rng = makeRng((s.seed + a * 7919 + round * 104729) >>> 0);
            const tubes = layout(s, rng);
            if (!tubes) continue;
            // a locked blossom must not be needed before it can open: the solver checks that too
            const res = solve(tubes, 0, SOLVER_BUDGET);
            if (!res.path) continue;
            const path = tighten(tubes, 0, res.path);
            const min = Math.max(4, s.colours * 2 - 1);
            if (path.length < min) continue;
            const out = { tubes, par: path.length, solution: path, colours: s.colours, spec: s, attempts: a + 1 + round * 40 };
            cache.set(ck, out);
            return structuredCopy(out);
        }
        s = { ...s, empties: s.empties + 1 };      // relax and try again
    }
    throw new Error('no solvable layout for ' + ck);
}

function structuredCopy(o) { return JSON.parse(JSON.stringify(o)); }

/** Which wisp colours (indexes into WISPS) a level uses, and which it is the first to show. */
export function coloursOf(n) { return levelSpec(n).colours; }
export const WISP_COUNT = WISPS.length;
export { isHidden };
