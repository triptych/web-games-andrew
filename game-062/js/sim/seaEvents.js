// seaEvents.js — what the sea does between moves. Pure and seeded.
//
// After every move there is a chance (set by the Sea State) that something
// happens: the Kraken steals a piece, a mermaid lures a ship away, a storm
// drives every ship a square downwind, and so on.
//
// The sea is chaotic but never cheats the rules:
//   - kings are never taken, lighthouses (rooks) are buildings and never drift;
//   - no pawn is left on the first or last rank (dolphins promote instead);
//   - the side that just moved is never left in check (that position would be illegal);
//   - an event never ends the game by itself (no checkmate, stalemate or dead draw).
// Every candidate outcome is tried on a copy and thrown away if it breaks one.

import {
    WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, ALL_SQUARES,
    sq, fileOf, rankOf, onBoard, sqName, KING_OFF,
} from './chess.js';

export const PIECE_NAMES = ['', 'Dinghy', 'Longship', 'Schooner', 'Lighthouse', "Man-o'-War", 'Flagship'];
export const SIDE_NAMES = { [WHITE]: 'Navy', [-WHITE]: 'Pirates' };

export const SEA_STATES = {
    off: { name: 'Mirror Calm', chance: 0, desc: 'No sea events: plain chess.' },
    calm: { name: 'Calm', chance: 0.12, desc: 'An event after about one move in eight.' },
    choppy: { name: 'Choppy', chance: 0.22, desc: 'An event after about one move in five.' },
    tempest: { name: 'Tempest', chance: 0.38, desc: 'An event after more than one move in three.' },
};

export const SEA_EVENTS = {
    kraken: { name: 'The Kraken', icon: '🐙', weight: 3, good: false, desc: 'A tentacle drags a ship (or a lighthouse!) to the depths. Never a Flagship.' },
    mermaid: { name: "Mermaid's Song", icon: '🧜', weight: 3, good: null, desc: 'A mermaid lures one ship to a neighbouring square.' },
    storm: { name: 'Storm', icon: '⛈️', weight: 2, good: null, desc: 'A gale drives every ship one square downwind. Lighthouses stand firm.' },
    whirlpool: { name: 'Whirlpool', icon: '🌀', weight: 1.5, good: null, desc: 'The eight ships around a square spin one place clockwise.' },
    dolphins: { name: 'Dolphins', icon: '🐬', weight: 2, good: true, desc: 'A pod pushes a Dinghy one square forward, and promotes it if it reaches the far shore.' },
    ghost: { name: 'Ghost Ship', icon: '👻', weight: 1.5, good: null, desc: 'A phantom sails along a rank; the ships on it flee one square homeward.' },
    salvage: { name: 'Salvage', icon: '⚓', weight: 1.5, good: true, desc: 'Divers raise a sunken piece back to its home waters.' },
    serpent: { name: 'Sea Serpent', icon: '🐉', weight: 2, good: null, desc: 'A serpent coils between two ships of one fleet and swaps them.' },
};
export const EVENT_IDS = Object.keys(SEA_EVENTS);

const isShip = (v) => v && Math.abs(v) !== ROOK;
const side = (v) => (v > 0 ? WHITE : -WHITE);
const pieceLabel = (v) => `${SIDE_NAMES[side(v)]}' ${PIECE_NAMES[Math.abs(v)]}`.replace("Navy'", "Navy's");

// Board directions in 0x88 steps. "North" is towards rank 8, the Pirates' shore.
export const WINDS = [
    { id: 'north', step: 16, from: 'south', label: 'north, towards the Pirates' },
    { id: 'south', step: -16, from: 'north', label: 'south, towards the Navy' },
    { id: 'east', step: 1, from: 'west', label: 'east, towards the h-file' },
    { id: 'west', step: -1, from: 'east', label: 'west, towards the a-file' },
];

function piecesWhere(pos, pred) {
    const out = [];
    for (const s of ALL_SQUARES) if (pos.b[s] && pred(pos.b[s], s)) out.push(s);
    return out;
}

/** Apply an event's changes to a position (in order) and refresh derived state. */
export function applyChanges(pos, changes) {
    const b = pos.b;
    // Moves inside one change list are simultaneous: lift everything, then drop.
    const lifted = [];
    for (const c of changes) {
        if (c.k === 'remove') b[c.sq] = 0;
        else if (c.k === 'move') { lifted.push(c); b[c.from] = 0; }
    }
    for (const c of lifted) b[c.to] = c.piece;
    for (const c of changes) {
        if (c.k === 'add') b[c.sq] = c.piece;
        else if (c.k === 'promote') b[c.sq] = c.to;
    }
    pos.refresh();
}

/** Is the position after an event one the game may continue from? */
export function eventProblem(pos) {
    if (pos.wk < 0 || pos.bk < 0) return 'king missing';
    for (const s of ALL_SQUARES) {
        if (Math.abs(pos.b[s]) === PAWN && (rankOf(s) === 0 || rankOf(s) === 7)) return 'pawn on back rank';
    }
    if (pos.attacked(pos.kingSq(-pos.turn), pos.turn)) return 'mover left in check';
    if (!pos.hasLegalMove()) return 'no legal move';
    if (pos.insufficientMaterial()) return 'dead draw';
    return null;
}

// ---------------------------------------------------------------- generators
// Each returns a candidate { changes, ...detail } or null. `ctx` = { captured }.

const GEN = {
    kraken(pos, rng) {
        const targets = piecesWhere(pos, (v) => Math.abs(v) !== KING);
        if (!targets.length) return null;
        const w = { [PAWN]: 4, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 2, [QUEEN]: 1.2 };
        const s = rng.weighted(targets, (t) => w[Math.abs(pos.b[t])]);
        const piece = pos.b[s];
        return {
            sq: s, piece,
            changes: [{ k: 'remove', sq: s, piece }],
            text: `The Kraken rises! A tentacle drags the ${pieceLabel(piece)} on ${sqName(s)} down to Davy Jones' Locker.`,
        };
    },

    mermaid(pos, rng) {
        const ships = rng.shuffle(piecesWhere(pos, (v) => isShip(v)));
        for (const from of ships) {
            const to = rng.shuffle(KING_OFF.map((o) => from + o)).find((t) => onBoard(t) && !pos.b[t]);
            if (to === undefined) continue;
            const piece = pos.b[from];
            return {
                from, to, piece,
                changes: [{ k: 'move', from, to, piece }],
                text: `A mermaid sings, and the ${pieceLabel(piece)} drifts after her from ${sqName(from)} to ${sqName(to)}.`,
            };
        }
        return null;
    },

    storm(pos, rng) {
        const wind = rng.pick(WINDS);
        const step = wind.step;
        // Sweep from the downwind edge so a column of ships moves as one.
        const order = [...ALL_SQUARES].sort((a, c) => {
            const ka = step === 16 ? -rankOf(a) : step === -16 ? rankOf(a) : step === 1 ? -fileOf(a) : fileOf(a);
            const kc = step === 16 ? -rankOf(c) : step === -16 ? rankOf(c) : step === 1 ? -fileOf(c) : fileOf(c);
            return ka - kc;
        });
        const b = new Int8Array(pos.b);
        const changes = [];
        for (const s of order) {
            const v = b[s];
            if (!isShip(v)) continue;
            const t = s + step;
            if (!onBoard(t) || b[t]) continue;
            if (Math.abs(v) === PAWN && (rankOf(t) === 0 || rankOf(t) === 7)) continue; // runs aground
            b[t] = v; b[s] = 0;
            changes.push({ k: 'move', from: s, to: t, piece: v });
        }
        if (!changes.length) return null;
        return {
            wind: wind.id, step,
            changes,
            text: `A storm blows in from the ${wind.from}! ${changes.length} ship${changes.length > 1 ? 's are' : ' is'} driven one square ${wind.label}. Lighthouses stand firm.`,
        };
    },

    whirlpool(pos, rng) {
        const centres = [];
        for (let r = 1; r <= 6; r++) for (let f = 1; f <= 6; f++) centres.push(sq(f, r));
        rng.shuffle(centres);
        // Clockwise seen from above with White at the bottom: N, NE, E, SE, S, SW, W, NW.
        const RING = [16, 17, 1, -15, -16, -17, -1, 15];
        for (const c of centres) {
            const ring = RING.map((o) => c + o);
            if (ring.some((s) => Math.abs(pos.b[s]) === ROOK)) continue;
            const occupied = ring.filter((s) => pos.b[s]).length;
            if (occupied < 2) continue;
            const changes = [];
            for (let i = 0; i < 8; i++) {
                const v = pos.b[ring[i]];
                if (v) changes.push({ k: 'move', from: ring[i], to: ring[(i + 1) % 8], piece: v });
            }
            return {
                centre: c, ring,
                changes,
                text: `A whirlpool opens at ${sqName(c)} and spins ${changes.length} ships one place around it.`,
            };
        }
        return null;
    },

    dolphins(pos, rng) {
        const pawns = rng.shuffle(piecesWhere(pos, (v, s) => Math.abs(v) === PAWN && !pos.b[s + 16 * side(v)]));
        for (const from of pawns) {
            const piece = pos.b[from];
            const to = from + 16 * side(piece);
            if (!onBoard(to)) continue;
            const changes = [{ k: 'move', from, to, piece }];
            const last = side(piece) === WHITE ? 7 : 0;
            let text = `A pod of dolphins pushes the ${pieceLabel(piece)} forward from ${sqName(from)} to ${sqName(to)}.`;
            if (rankOf(to) === last) {
                changes.push({ k: 'promote', sq: to, from: piece, to: QUEEN * side(piece) });
                text = `A pod of dolphins carries the ${pieceLabel(piece)} all the way to ${sqName(to)}. It is refitted as a Man-o'-War!`;
            }
            return { from, to, piece, changes, text };
        }
        return null;
    },

    ghost(pos, rng) {
        const ranks = rng.shuffle([2, 3, 4, 5]);
        for (const r of ranks) {
            const b = new Int8Array(pos.b);
            const changes = [];
            for (let f = 0; f < 8; f++) {
                const s = sq(f, r), v = b[s];
                if (!isShip(v)) continue;
                const t = s - 16 * side(v);
                if (b[t]) continue;
                if (Math.abs(v) === PAWN && (rankOf(t) === 0 || rankOf(t) === 7)) continue;
                b[t] = v; b[s] = 0;
                changes.push({ k: 'move', from: s, to: t, piece: v });
            }
            if (!changes.length) continue;
            const dir = rng.chance(0.5) ? 1 : -1;
            return {
                rank: r, dir,
                changes,
                text: `A ghost ship glides along rank ${r + 1}! ${changes.length} terrified ship${changes.length > 1 ? 's flee' : ' flees'} one square homeward.`,
            };
        }
        return null;
    },

    salvage(pos, rng, ctx) {
        const options = [];
        for (const color of [WHITE, -WHITE]) {
            const lost = ctx.captured[color === WHITE ? 'w' : 'b'];
            lost.forEach((t, i) => { if (t !== KING) options.push({ color, t, i }); });
        }
        if (!options.length) return null;
        const w = { [PAWN]: 3, [KNIGHT]: 2, [BISHOP]: 2, [ROOK]: 1.5, [QUEEN]: 0.8 };
        const pick = rng.weighted(options, (o) => w[o.t]);
        const homeRanks = pick.t === PAWN
            ? [pick.color === WHITE ? 1 : 6]
            : (pick.color === WHITE ? [0, 1] : [7, 6]);
        const spots = [];
        for (const r of homeRanks) for (let f = 0; f < 8; f++) if (!pos.b[sq(f, r)]) spots.push(sq(f, r));
        if (!spots.length) return null;
        const s = rng.pick(spots);
        const piece = pick.t * pick.color;
        return {
            sq: s, piece, color: pick.color,
            changes: [{ k: 'add', sq: s, piece }],
            text: `Salvage divers raise the ${pieceLabel(piece)} from the depths and float it on ${sqName(s)}.`,
        };
    },

    serpent(pos, rng) {
        for (const color of rng.shuffle([WHITE, -WHITE])) {
            const mine = piecesWhere(pos, (v) => side(v) === color && Math.abs(v) !== KING);
            const pairs = [];
            for (let i = 0; i < mine.length; i++) {
                for (let j = i + 1; j < mine.length; j++) {
                    const a = mine[i], c = mine[j];
                    if (pos.b[a] === pos.b[c]) continue;
                    const d = Math.max(Math.abs(fileOf(a) - fileOf(c)), Math.abs(rankOf(a) - rankOf(c)));
                    if (d > 3) continue;
                    const pa = Math.abs(pos.b[a]) === PAWN, pc = Math.abs(pos.b[c]) === PAWN;
                    if (pa && (rankOf(c) === 0 || rankOf(c) === 7)) continue;
                    if (pc && (rankOf(a) === 0 || rankOf(a) === 7)) continue;
                    pairs.push([a, c]);
                }
            }
            if (!pairs.length) continue;
            const [a, c] = rng.pick(pairs);
            const va = pos.b[a], vc = pos.b[c];
            return {
                a, c,
                changes: [{ k: 'move', from: a, to: c, piece: va }, { k: 'move', from: c, to: a, piece: vc }],
                text: `A sea serpent coils between the ${SIDE_NAMES[color]} ships and swaps the ${PIECE_NAMES[Math.abs(va)]} on ${sqName(a)} with the ${PIECE_NAMES[Math.abs(vc)]} on ${sqName(c)}.`,
            };
        }
        return null;
    },
};

/**
 * Roll for a sea event after a move. Returns null (calm water) or an event
 * { type, name, icon, text, changes, ...detail } that has already been checked
 * on a copy. The caller applies it with applyChanges().
 *
 * opts: { chance, enabled: [ids], captured: { w: [types], b: [types] }, force: id }
 */
export function rollSeaEvent(pos, rng, opts) {
    const enabled = (opts.enabled || EVENT_IDS).filter((id) => SEA_EVENTS[id]);
    if (!enabled.length) return null;
    if (!opts.force && !rng.chance(opts.chance || 0)) return null;
    const order = [];
    const pool = opts.force ? [opts.force] : [...enabled];
    // Weighted order without replacement: try the favourite first, fall back to the rest.
    while (pool.length) {
        const id = rng.weighted(pool, (x) => SEA_EVENTS[x].weight);
        order.push(id);
        pool.splice(pool.indexOf(id), 1);
    }
    const ctx = { captured: opts.captured || { w: [], b: [] } };
    for (const type of order) {
        for (let attempt = 0; attempt < 10; attempt++) {
            const ev = GEN[type](pos, rng, ctx);
            if (!ev) break;
            const test = pos.clone();
            applyChanges(test, ev.changes);
            if (eventProblem(test)) continue;
            const def = SEA_EVENTS[type];
            return { ...ev, type, name: def.name, icon: def.icon };
        }
    }
    return null;
}
