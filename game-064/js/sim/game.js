// game.js — one match: moves, sea events, captures, the log, undo and the result.
// Pure and serialisable. The view replays what play() returns; it never edits
// the position itself.

import { RNG, hashStr } from './rng.js';
import {
    Position, WHITE, BLACK, PAWN, KING, ROOK, F_EP, F_CASTLE,
    mFrom, mTo, mPromo, mFlag, toSAN, uci, sqName,
} from './chess.js';
import { rollSeaEvent, applyChanges, SEA_STATES, EVENT_IDS, PIECE_NAMES, SIDE_NAMES } from './seaEvents.js';

export const SAVE_VERSION = 1;
// No events until each side has moved once: the fleets leave harbour in peace.
export const CALM_PLIES = 2;

export const DEFAULT_OPTS = {
    mode: 'ai',            // 'ai' | 'pvp'
    human: WHITE,          // the human's colour in 'ai' mode
    level: 3,              // 1..5
    sea: 'choppy',         // key of SEA_STATES
    events: [...EVENT_IDS],
    seed: 'harbour',
};

const colorKey = (c) => (c === WHITE ? 'w' : 'b');

export class Match {
    constructor(opts = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        this.pos = Position.start();
        this.rng = new RNG(hashStr(this.opts.seed));
        this.captured = { w: [], b: [] };   // types each side has lost
        this.log = [];                      // { ply, color, san, uci, event? }
        this.keys = [this.pos.key()];       // positions seen, for repetition
        this.snaps = [];                    // one per ply, for undo
        this.result = null;                 // { winner: 1 | -1 | 0, reason }
        this.ply = 0;
        this.lastMove = null;               // { from, to } for the board highlight
        this.forceNext = null;              // debug: force the next event's type
    }

    get turn() { return this.pos.turn; }
    isHumanTurn() { return !this.result && (this.opts.mode === 'pvp' || this.pos.turn === this.opts.human); }
    seaChance() { return SEA_STATES[this.opts.sea]?.chance ?? 0; }

    /** Legal moves with everything the UI needs. */
    legal() {
        const ms = this.pos.legalMoves();
        return ms.map((m) => ({ m, from: mFrom(m), to: mTo(m), promo: mPromo(m), flag: mFlag(m), san: toSAN(this.pos, m, ms) }));
    }

    _snapshot() {
        return {
            fen: this.pos.toFEN(),
            captured: { w: [...this.captured.w], b: [...this.captured.b] },
            logLen: this.log.length,
            keysLen: this.keys.length,
            rng: this.rng.s,
            ply: this.ply,
            lastMove: this.lastMove,
            result: this.result,
        };
    }

    /**
     * Play a legal move (int). Returns a record for the view:
     * { move: {...}, event: null | {...}, result, check }
     */
    play(m) {
        if (this.result) throw new Error('game is over');
        const pos = this.pos;
        const legal = pos.legalMoves();
        if (!legal.includes(m)) throw new Error(`illegal move ${uci(m)}`);
        this.snaps.push(this._snapshot());

        const color = pos.turn;
        const from = mFrom(m), to = mTo(m), flag = mFlag(m), promo = mPromo(m);
        const piece = pos.b[from];
        const capSq = flag & F_EP ? to - 16 * color : to;
        const captured = pos.b[capSq];
        const san = toSAN(pos, m, legal);
        const move = { m, uci: uci(m), san, color, from, to, piece, captured, capSq, promo, flag };
        if (flag & F_CASTLE) {
            move.rookFrom = to > from ? from + 3 : from - 4;
            move.rookTo = to > from ? from + 1 : from - 1;
        }
        pos.make(m);
        pos.stack.length = 0;
        if (captured) this.captured[colorKey(-color)].push(Math.abs(captured));
        this.ply++;
        this.lastMove = { from, to };
        const entry = { ply: this.ply, color, san, uci: move.uci };
        this.log.push(entry);

        // The sea takes its turn.
        let event = null;
        const chance = this.seaChance();
        if (((chance > 0 && this.ply >= CALM_PLIES) || this.forceNext) && !this._endsNow()) {
            event = rollSeaEvent(pos, this.rng, {
                chance, enabled: this.opts.events, captured: this.captured,
                force: this.forceNext,
            });
            this.forceNext = null;
            if (event) {
                applyChanges(pos, event.changes);
                for (const c of event.changes) {
                    if (c.k === 'remove') this.captured[colorKey(Math.sign(c.piece))].push(Math.abs(c.piece));
                    if (c.k === 'add') {
                        const list = this.captured[colorKey(Math.sign(c.piece))];
                        const i = list.indexOf(Math.abs(c.piece));
                        if (i >= 0) list.splice(i, 1);
                    }
                }
                entry.event = { type: event.type, name: event.name, icon: event.icon, text: event.text };
                // An event that moves pieces resets the fifty-move count, as a capture would.
                pos.half = 0;
            }
        }
        this.keys.push(pos.key());
        this.result = this._endsNow(true);
        return { move, event, result: this.result, check: pos.inCheck() };
    }

    /** Game-over test. With `final`, also counts repetition (needs the new key pushed). */
    _endsNow(final = false) {
        const pos = this.pos;
        if (!pos.hasLegalMove()) {
            return pos.inCheck()
                ? { winner: -pos.turn, reason: 'checkmate' }
                : { winner: 0, reason: 'stalemate' };
        }
        if (!final) return null;
        if (pos.insufficientMaterial()) return { winner: 0, reason: 'insufficient material' };
        if (pos.half >= 100) return { winner: 0, reason: 'fifty-move rule' };
        const k = this.keys[this.keys.length - 1];
        if (this.keys.filter((x) => x === k).length >= 3) return { winner: 0, reason: 'threefold repetition' };
        return null;
    }

    resign(color) {
        if (this.result) return this.result;
        this.snaps.push(this._snapshot());
        this.result = { winner: -color, reason: 'resignation' };
        return this.result;
    }

    canUndo() { return this.snaps.length > 0; }

    /**
     * Take back. Against the computer this rewinds to the human's previous turn
     * (two plies, or one if the computer moved first and hasn't since).
     */
    undo() {
        if (!this.snaps.length) return false;
        let target = this.snaps.length - 1;
        if (this.opts.mode === 'ai') {
            while (target >= 0) {
                const fenTurn = this.snaps[target].fen.split(' ')[1] === 'w' ? WHITE : BLACK;
                if (fenTurn === this.opts.human) break;
                target--;
            }
            if (target < 0) return false;
        }
        const s = this.snaps[target];
        this.snaps.length = target;
        this.pos = Position.fromFEN(s.fen);
        this.captured = { w: [...s.captured.w], b: [...s.captured.b] };
        this.log.length = s.logLen;
        this.keys.length = s.keysLen;
        this.rng.s = s.rng;
        this.ply = s.ply;
        this.lastMove = s.lastMove;
        this.result = s.result;
        return true;
    }

    toJSON() {
        return {
            v: SAVE_VERSION,
            opts: this.opts,
            fen: this.pos.toFEN(),
            captured: this.captured,
            log: this.log,
            keys: this.keys,
            snaps: this.snaps,
            rng: this.rng.s,
            result: this.result,
            ply: this.ply,
            lastMove: this.lastMove,
        };
    }

    static fromJSON(o) {
        if (!o || o.v !== SAVE_VERSION) return null;
        const g = new Match(o.opts);
        g.pos = Position.fromFEN(o.fen);
        g.captured = o.captured;
        g.log = o.log;
        g.keys = o.keys;
        g.snaps = o.snaps;
        g.rng.s = o.rng;
        g.result = o.result;
        g.ply = o.ply;
        g.lastMove = o.lastMove;
        return g;
    }
}

/**
 * Replay a play() record onto a map of square -> { id, piece, ... }. The 3D view
 * keeps its ship meshes in exactly this kind of map and calls this to know which
 * mesh went where; the sim test runs the same function against the real board.
 * Returns { removed: [items], added: [items], moved: [{ item, from, to }] }.
 */
export function applyRecord(map, rec, newId) {
    const out = { removed: [], added: [], moved: [], promoted: [] };
    const mv = rec.move;
    if (mv.captured) { out.removed.push(map.get(mv.capSq)); map.delete(mv.capSq); }
    const item = map.get(mv.from);
    map.delete(mv.from);
    map.set(mv.to, item);
    out.moved.push({ item, from: mv.from, to: mv.to });
    if (mv.promo) { item.piece = mv.promo * mv.color; out.promoted.push(item); }
    if (mv.rookFrom !== undefined) {
        const rook = map.get(mv.rookFrom);
        map.delete(mv.rookFrom);
        map.set(mv.rookTo, rook);
        out.moved.push({ item: rook, from: mv.rookFrom, to: mv.rookTo });
    }
    if (rec.event) {
        const lifted = [];
        for (const c of rec.event.changes) {
            if (c.k === 'remove') { out.removed.push(map.get(c.sq)); map.delete(c.sq); }
            else if (c.k === 'move') { lifted.push([map.get(c.from), c]); map.delete(c.from); }
        }
        for (const [it, c] of lifted) { map.set(c.to, it); out.moved.push({ item: it, from: c.from, to: c.to }); }
        for (const c of rec.event.changes) {
            if (c.k === 'add') { const it = { id: newId(), piece: c.piece }; map.set(c.sq, it); out.added.push(it); }
            else if (c.k === 'promote') { const it = map.get(c.sq); it.piece = c.to; out.promoted.push(it); }
        }
    }
    return out;
}

export function describeResult(r, opts) {
    if (!r) return '';
    if (r.winner === 0) return `A draw by ${r.reason}.`;
    const who = SIDE_NAMES[r.winner];
    return `The ${who} win by ${r.reason}!`;
}

export { PIECE_NAMES, SIDE_NAMES, sqName, PAWN, KING, ROOK };
