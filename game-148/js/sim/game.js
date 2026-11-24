// The game state and its commands. Pure: no DOM, no clock, no Math.random.
//
// Everything the player can do is a command passed to act(G, cmd):
//   { t: 'pour', from, to }   tip the top run of one blossom into another
//   { t: 'undo' }             take back the last pour (a bloom is forever: undo stops there)
//   { t: 'hint' }             a firefly shows a pour from a winning line (three per level)
//   { t: 'sprout' }           grow one extra empty blossom (once per level; caps the stars at two)
//   { t: 'restart' }          back to the start of the level (hints already used stay used)
// act() validates, changes G and pushes events for the view, the sound and the HUD. step() only keeps time.

import { CAP, HINTS_PER_LEVEL, SOLVER_BUDGET } from '../config.js';
import { levelSpec, freeSpec, buildPuzzle } from './levels.js';
import { pour, pourBlock, isWon, legalMoves, solve, isOpen } from './rules.js';

const copy = (o) => JSON.parse(JSON.stringify(o));

/** kind: 'level' (n = 0-based level), 'daily' or 'dream' (n = seed). */
export function newGame(kind = 'level', n = 0) {
    const spec = kind === 'level' ? levelSpec(n) : freeSpec(n >>> 0);
    const P = buildPuzzle(spec);
    return {
        v: 1,
        kind,
        n,
        ch: spec.ch,
        colours: P.colours,
        par: P.par,
        start: copy(P.tubes),
        tubes: copy(P.tubes),
        blooms: 0,
        moves: 0,
        hints: HINTS_PER_LEVEL,
        sprout: false,
        hist: [],               // { tubes, moves } before each pour since the last bloom
        won: false,
        stars: 0,
        bloomed: [],            // colour indexes in the order they bloomed this level
        t: 0,
        events: [],
    };
}

export function starsFor(G) {
    let s = G.moves <= G.par ? 3 : G.moves <= Math.ceil(G.par * 1.35) + 2 ? 2 : 1;
    if (G.sprout) s = Math.min(s, 2);
    return s;
}

export function act(G, cmd) {
    if (!cmd || G.won) return false;
    const ev = (e) => G.events.push(e);
    switch (cmd.t) {
        case 'pour': {
            const { from, to } = cmd;
            const why = pourBlock(G.tubes, G.blooms, from, to);
            if (why) { ev({ type: 'nope', from, to, why }); return false; }
            const before = { tubes: G.tubes, moves: G.moves };
            const r = pour(G.tubes, G.blooms, from, to);
            G.tubes = r.tubes;
            G.moves++;
            G.hist.push(before);
            ev({ type: 'pour', from, to, n: r.n, colour: r.color });
            if (r.revealed) ev({ type: 'reveal', tube: from, colour: G.tubes[from].s.length ? (G.tubes[from].s.charCodeAt(G.tubes[from].s.length - 1) - 97) : -1 });
            if (r.bloomed) {
                G.blooms = r.blooms;
                G.bloomed.push(r.color);
                G.hist = [];                         // a bloom is forever
                ev({ type: 'bloom', tube: to, colour: r.color, count: G.blooms });
                for (const u of r.unlocked) ev({ type: 'unlock', tube: u });
            }
            if (isWon(G.tubes)) {
                G.won = true;
                G.stars = starsFor(G);
                ev({ type: 'win', stars: G.stars, moves: G.moves, par: G.par });
            } else if (!legalMoves(G.tubes, G.blooms).length) {
                ev({ type: 'stuck' });
            }
            return true;
        }
        case 'undo': {
            const h = G.hist.pop();
            if (!h) { ev({ type: 'nope', why: 'undo' }); return false; }
            G.tubes = h.tubes;
            G.moves = h.moves;
            ev({ type: 'undo' });
            return true;
        }
        case 'hint': {
            if (G.hints <= 0) { ev({ type: 'nope', why: 'hints' }); return false; }
            const m = hintMove(G);
            if (!m) { ev({ type: 'hint', from: -1, to: -1 }); return false; }      // lost: suggest undo or restart
            G.hints--;
            ev({ type: 'hint', from: m[0], to: m[1] });
            return true;
        }
        case 'sprout': {
            if (G.sprout) { ev({ type: 'nope', why: 'sprout' }); return false; }
            G.sprout = true;
            G.tubes = G.tubes.concat([{ s: '', cap: CAP, kind: 'bloom', lock: 0, done: false }]);
            G.hist = [];
            ev({ type: 'sprout', tube: G.tubes.length - 1 });
            return true;
        }
        case 'restart': {
            G.tubes = copy(G.start);
            G.blooms = 0; G.moves = 0; G.hist = []; G.sprout = false; G.bloomed = [];
            ev({ type: 'restart' });
            return true;
        }
    }
    return false;
}

/** The first pour of a winning line from here, or null if the position can't be won. */
export function hintMove(G) {
    const r = solve(G.tubes, G.blooms, SOLVER_BUDGET);
    return r.path && r.path.length ? r.path[0] : null;
}

/** Blossoms the player can pick up from right now (for the keyboard cursor and the bot). */
export function openTubes(G) { return G.tubes.map((t, i) => (isOpen(t, G.blooms) ? i : -1)).filter((i) => i >= 0); }

export function step(G, dt) { G.t += dt; }

export function serialize(G) {
    const { events, ...rest } = G;
    return copy(rest);
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!Array.isArray(d.tubes) || !Array.isArray(d.start)) throw new Error('bad save');
    return { ...copy(d), events: [] };
}
