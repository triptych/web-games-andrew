// Starbase Spooky — the four repair puzzles (and the song at the end). Pure: built from the game's rng, driven by
// `pick` commands, timed by `tick`. Every puzzle can always be finished: a wrong move never locks anything.
//
//   wires    — connect each coloured wire on the left to the plug of the same colour on the right (colour matching)
//   battery  — pick batteries whose numbers add up to exactly the power the screen asks for (adding)
//   planets  — put the eight planets back in order from the Sun (science)
//   sequence — watch the fuse lights blink, then tap them in the same order; three rounds, 3, 4 and 5 long (memory)
//   song     — the same with Wisp's mama's song on five stars

import { NOTE_TIME } from '../config.js';

export const WIRE_COLORS = ['red', 'blue', 'yellow', 'green'];
export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const PLANET_NAMES = { mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' };
export const FUSE_COLORS = ['red', 'blue', 'yellow', 'green'];
export const ROUNDS = [3, 4, 5];

export function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function makePuzzle(kind, rng) {
    if (kind === 'wires') {
        let right = shuffle(rng, WIRE_COLORS);
        // never hand over a board that is already solved straight across
        while (right.every((c, i) => c === WIRE_COLORS[i])) right = shuffle(rng, WIRE_COLORS);
        return { kind, left: WIRE_COLORS.slice(), right, links: [null, null, null, null], sel: null, solved: false };
    }
    if (kind === 'battery') {
        const target = rng.int(6, 10);
        // a solution of two or three cells, then decoys, so the board always has an answer
        const n = rng.chance(0.5) ? 2 : 3;
        const sol = [];
        let left = target;
        for (let i = 0; i < n - 1; i++) {
            const v = rng.int(1, Math.min(5, left - (n - 1 - i)));
            sol.push(v); left -= v;
        }
        if (left > 5) { sol.push(5); left -= 5; sol.push(left); } else sol.push(left);
        const cells = sol.slice();
        while (cells.length < 6) cells.push(rng.int(1, 5));
        return { kind, target, cells: shuffle(rng, cells), on: [false, false, false, false, false, false], solved: false };
    }
    if (kind === 'planets') {
        return { kind, tray: shuffle(rng, PLANETS), placed: 0, misses: 0, solved: false };
    }
    if (kind === 'sequence' || kind === 'song') {
        const colors = kind === 'song' ? 5 : 4;
        const seq = [];
        for (let i = 0; i < ROUNDS[ROUNDS.length - 1]; i++) {
            let c = rng.int(0, colors - 1);
            if (i > 0 && c === seq[i - 1]) c = (c + 1 + rng.int(0, colors - 2)) % colors;   // no repeats in a row
            seq.push(c);
        }
        return { kind, colors, seq, round: 0, input: [], show: { i: 0, t: -0.6 }, lit: -1, solved: false };
    }
    throw new Error('unknown puzzle ' + kind);
}

/** The battery total so far. */
export const batterySum = (p) => p.cells.reduce((s, v, i) => s + (p.on[i] ? v : 0), 0);

/** Apply one tap. Returns a list of events ({ type, ... }). */
export function pickPuzzle(p, cmd) {
    const ev = [];
    if (p.solved) return ev;
    if (p.kind === 'wires') {
        if (cmd.side === 'l') {
            if (p.links[cmd.i] === null) { p.sel = cmd.i; ev.push({ type: 'pz', what: 'select' }); }
        } else if (cmd.side === 'r' && p.sel !== null) {
            if (p.links.includes(cmd.i)) return ev;
            if (p.left[p.sel] === p.right[cmd.i]) {
                p.links[p.sel] = cmd.i;
                ev.push({ type: 'pz', what: 'link' });
                if (p.links.every((l) => l !== null)) p.solved = true;
            } else ev.push({ type: 'pz', what: 'zap' });
            p.sel = null;
        }
    } else if (p.kind === 'battery') {
        if (cmd.i < 0 || cmd.i >= p.cells.length) return ev;
        p.on[cmd.i] = !p.on[cmd.i];
        const s = batterySum(p);
        ev.push({ type: 'pz', what: p.on[cmd.i] ? 'in' : 'out', sum: s });
        if (s === p.target) p.solved = true;
        else if (s > p.target) ev.push({ type: 'pz', what: 'toomuch' });
    } else if (p.kind === 'planets') {
        const id = p.tray[cmd.i];
        if (!id) return ev;
        if (id === PLANETS[p.placed]) {
            p.placed++;
            p.tray[cmd.i] = null;
            ev.push({ type: 'pz', what: 'place', planet: id });
            if (p.placed === PLANETS.length) p.solved = true;
        } else {
            p.misses++;
            ev.push({ type: 'pz', what: 'nope', first: p.misses === 1 });
        }
    } else {
        if (p.show || cmd.i < 0 || cmd.i >= p.colors) return ev;     // no taps while the lights are playing
        const len = ROUNDS[p.round];
        if (cmd.i === p.seq[p.input.length]) {
            p.input.push(cmd.i);
            ev.push({ type: 'pz', what: 'note', i: cmd.i });
            if (p.input.length === len) {
                p.round++;
                p.input = [];
                if (p.round >= ROUNDS.length) p.solved = true;
                else { p.show = { i: 0, t: -0.9 }; ev.push({ type: 'pz', what: 'round' }); }
            }
        } else {
            p.input = [];
            p.show = { i: 0, t: -0.9 };
            ev.push({ type: 'pz', what: 'oops' });
        }
    }
    return ev;
}

/** Advance the light show of a memory puzzle. Returns events for each light that comes on. */
export function tickPuzzle(p, dt) {
    const ev = [];
    if (!p.show) return ev;
    const len = ROUNDS[p.round];
    const s = p.show;
    s.t += dt;
    const before = p.lit;
    if (s.t < 0) p.lit = -1;
    else {
        const i = Math.floor(s.t / NOTE_TIME);
        if (i >= len) { p.show = null; p.lit = -1; return ev; }
        p.lit = (s.t - i * NOTE_TIME) < NOTE_TIME * 0.66 ? p.seq[i] : -1;
        if (p.lit !== -1 && (before !== p.lit || i !== s.i)) ev.push({ type: 'pz', what: 'show', i: p.lit });
        s.i = i;
    }
    return ev;
}

/** A correct next tap, for the bot and the tests (null while the lights are playing). */
export function solveMove(p) {
    if (p.solved) return null;
    if (p.kind === 'wires') {
        if (p.sel === null) return { side: 'l', i: p.links.findIndex((l) => l === null) };
        return { side: 'r', i: p.right.indexOf(p.left[p.sel]) };
    }
    if (p.kind === 'battery') {
        // switch everything off, then find a subset that adds up (6 cells: 64 subsets)
        const on = p.on.findIndex((o) => o);
        if (on >= 0 && batterySum(p) !== p.target) {
            // keep cells that are part of some solution containing every cell that is on
            const best = subsetFor(p);
            for (let i = 0; i < p.on.length; i++) if (p.on[i] && !best.includes(i)) return { i };
            for (const i of best) if (!p.on[i]) return { i };
        }
        const best = subsetFor(p);
        for (const i of best) if (!p.on[i]) return { i };
        return null;
    }
    if (p.kind === 'planets') return { i: p.tray.indexOf(PLANETS[p.placed]) };
    if (p.show) return null;
    return { i: p.seq[p.input.length] };
}

/** Indices of a subset of cells that adds up to the target (prefers keeping cells already on). */
export function subsetFor(p) {
    let best = null, bestKeep = -1;
    for (let m = 1; m < 1 << p.cells.length; m++) {
        let s = 0, keep = 0;
        for (let i = 0; i < p.cells.length; i++) if (m & (1 << i)) { s += p.cells[i]; if (p.on[i]) keep++; }
        if (s === p.target && keep > bestKeep) { best = m; bestKeep = keep; }
    }
    const out = [];
    for (let i = 0; i < p.cells.length; i++) if (best & (1 << i)) out.push(i);
    return out;
}
