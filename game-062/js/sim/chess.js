// chess.js — the rules of chess on a 0x88 board. Pure: no DOM, no three.js,
// no Math.random, no clock. Shared by the game, the AI worker and the tests.
//
// Board: Int8Array(128), square = rank * 16 + file (rank 0 is White's back rank).
// Pieces are signed: + for White (the Royal Navy), - for Black (the Pirates).
// Moves are ints: from | to << 7 | promo << 14 | flag << 17.

import { RNG } from './rng.js';

export const WHITE = 1, BLACK = -1;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const F_DOUBLE = 1, F_EP = 2, F_CASTLE = 4;

export const PIECE_LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
const LETTER_TYPE = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };

export const sq = (file, rank) => rank * 16 + file;
export const fileOf = (s) => s & 7;
export const rankOf = (s) => s >> 4;
export const onBoard = (s) => (s & 0x88) === 0;
export const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
export function parseSq(name) {
    const f = 'abcdefgh'.indexOf(name[0]), r = +name[1] - 1;
    return f < 0 || !(r >= 0 && r < 8) ? -1 : sq(f, r);
}
export const ALL_SQUARES = [];
for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) ALL_SQUARES.push(sq(f, r));

export const mFrom = (m) => m & 127;
export const mTo = (m) => (m >> 7) & 127;
export const mPromo = (m) => (m >> 14) & 7;
export const mFlag = (m) => (m >> 17) & 7;
export const mk = (from, to, promo = 0, flag = 0) => from | (to << 7) | (promo << 14) | (flag << 17);

export const KNIGHT_OFF = [14, 18, 31, 33, -14, -18, -31, -33];
export const KING_OFF = [1, 15, 16, 17, -1, -15, -16, -17];
export const DIAG = [15, 17, -15, -17];
export const ORTHO = [1, 16, -1, -16];

// Castling rights: 1 White short, 2 White long, 4 Black short, 8 Black long.
// Any move touching a king or rook home square clears the matching rights.
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[sq(4, 0)] = 15 & ~3; CASTLE_MASK[sq(7, 0)] = 15 & ~1; CASTLE_MASK[sq(0, 0)] = 15 & ~2;
CASTLE_MASK[sq(4, 7)] = 15 & ~12; CASTLE_MASK[sq(7, 7)] = 15 & ~4; CASTLE_MASK[sq(0, 7)] = 15 & ~8;

// Zobrist keys: two independent 32-bit halves. Fixed seed so every module,
// worker and test agrees on the hash of a position.
const Z_A = new Int32Array(13 * 128), Z_B = new Int32Array(13 * 128);
const ZC_A = new Int32Array(16), ZC_B = new Int32Array(16);
const ZE_A = new Int32Array(8), ZE_B = new Int32Array(8);
let ZS_A, ZS_B;
{
    const r = new RNG(0xC0FFEE);
    const r32 = () => (r.next() * 4294967296) | 0;
    for (let i = 0; i < Z_A.length; i++) { Z_A[i] = r32(); Z_B[i] = r32(); }
    for (let i = 0; i < 16; i++) { ZC_A[i] = r32(); ZC_B[i] = r32(); }
    for (let i = 0; i < 8; i++) { ZE_A[i] = r32(); ZE_B[i] = r32(); }
    ZS_A = r32(); ZS_B = r32();
}
const zi = (piece, s) => (piece + 6) * 128 + s;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class Position {
    constructor() {
        this.b = new Int8Array(128);
        this.turn = WHITE;
        this.castle = 0;
        this.ep = -1;
        this.half = 0;
        this.full = 1;
        this.wk = -1;
        this.bk = -1;
        this.h1 = 0;
        this.h2 = 0;
        this.stack = [];
    }

    static start() { return Position.fromFEN(START_FEN); }

    static fromFEN(fen) {
        const p = new Position();
        const [placement, side, castling, ep, half, full] = fen.trim().split(/\s+/);
        const rows = placement.split('/');
        for (let i = 0; i < 8; i++) {
            let f = 0;
            for (const ch of rows[i]) {
                if (/\d/.test(ch)) { f += +ch; continue; }
                const t = LETTER_TYPE[ch.toLowerCase()];
                p.b[sq(f, 7 - i)] = ch === ch.toUpperCase() ? t : -t;
                f++;
            }
        }
        p.turn = side === 'b' ? BLACK : WHITE;
        p.castle = 0;
        if (castling && castling !== '-') {
            if (castling.includes('K')) p.castle |= 1;
            if (castling.includes('Q')) p.castle |= 2;
            if (castling.includes('k')) p.castle |= 4;
            if (castling.includes('q')) p.castle |= 8;
        }
        p.ep = ep && ep !== '-' ? parseSq(ep) : -1;
        p.half = +(half ?? 0) || 0;
        p.full = +(full ?? 1) || 1;
        p.refresh();
        return p;
    }

    toFEN() {
        let out = '';
        for (let r = 7; r >= 0; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const v = this.b[sq(f, r)];
                if (!v) { empty++; continue; }
                if (empty) { out += empty; empty = 0; }
                const l = PIECE_LETTER[Math.abs(v)];
                out += v > 0 ? l : l.toLowerCase();
            }
            if (empty) out += empty;
            if (r) out += '/';
        }
        let c = '';
        if (this.castle & 1) c += 'K';
        if (this.castle & 2) c += 'Q';
        if (this.castle & 4) c += 'k';
        if (this.castle & 8) c += 'q';
        return `${out} ${this.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }

    clone() {
        const p = new Position();
        p.b.set(this.b);
        p.turn = this.turn; p.castle = this.castle; p.ep = this.ep;
        p.half = this.half; p.full = this.full;
        p.wk = this.wk; p.bk = this.bk; p.h1 = this.h1; p.h2 = this.h2;
        return p;
    }

    /**
     * Recompute everything derived from the board: king squares, castling
     * rights that no longer make sense, a stale en-passant square, the hash.
     * Sea events edit the board directly and call this afterwards.
     */
    refresh() {
        const b = this.b;
        this.wk = this.bk = -1;
        for (const s of ALL_SQUARES) {
            if (b[s] === KING) this.wk = s;
            else if (b[s] === -KING) this.bk = s;
        }
        if (b[sq(4, 0)] !== KING) this.castle &= ~3;
        if (b[sq(7, 0)] !== ROOK) this.castle &= ~1;
        if (b[sq(0, 0)] !== ROOK) this.castle &= ~2;
        if (b[sq(4, 7)] !== -KING) this.castle &= ~12;
        if (b[sq(7, 7)] !== -ROOK) this.castle &= ~4;
        if (b[sq(0, 7)] !== -ROOK) this.castle &= ~8;
        if (this.ep >= 0) {
            // The pawn that just double-stepped must still be behind the ep square.
            const pawnSq = this.ep - 16 * this.turn;
            if (!onBoard(pawnSq) || b[pawnSq] !== -this.turn * PAWN || b[this.ep]) this.ep = -1;
        }
        let h1 = 0, h2 = 0;
        for (const s of ALL_SQUARES) if (b[s]) { h1 ^= Z_A[zi(b[s], s)]; h2 ^= Z_B[zi(b[s], s)]; }
        h1 ^= ZC_A[this.castle]; h2 ^= ZC_B[this.castle];
        if (this.ep >= 0) { h1 ^= ZE_A[this.ep & 7]; h2 ^= ZE_B[this.ep & 7]; }
        if (this.turn === BLACK) { h1 ^= ZS_A; h2 ^= ZS_B; }
        this.h1 = h1; this.h2 = h2;
    }

    key() { return `${this.h1 >>> 0}:${this.h2 >>> 0}`; }
    kingSq(color) { return color === WHITE ? this.wk : this.bk; }

    attacked(s, by) {
        const b = this.b;
        if (by === WHITE) {
            if (onBoard(s - 15) && b[s - 15] === PAWN) return true;
            if (onBoard(s - 17) && b[s - 17] === PAWN) return true;
        } else {
            if (onBoard(s + 15) && b[s + 15] === -PAWN) return true;
            if (onBoard(s + 17) && b[s + 17] === -PAWN) return true;
        }
        const n = KNIGHT * by, k = KING * by;
        for (const o of KNIGHT_OFF) { const t = s + o; if (onBoard(t) && b[t] === n) return true; }
        for (const o of KING_OFF) { const t = s + o; if (onBoard(t) && b[t] === k) return true; }
        const bq = BISHOP * by, rq = ROOK * by, q = QUEEN * by;
        for (const o of DIAG) {
            for (let t = s + o; onBoard(t); t += o) {
                const v = b[t];
                if (v) { if (v === bq || v === q) return true; break; }
            }
        }
        for (const o of ORTHO) {
            for (let t = s + o; onBoard(t); t += o) {
                const v = b[t];
                if (v) { if (v === rq || v === q) return true; break; }
            }
        }
        return false;
    }

    inCheck(color = this.turn) {
        const k = this.kingSq(color);
        return k >= 0 && this.attacked(k, -color);
    }

    /** Pseudo-legal moves into `out`. capturesOnly also keeps promotions. */
    genMoves(out = [], capturesOnly = false) {
        const b = this.b, us = this.turn;
        for (const from of ALL_SQUARES) {
            const v = b[from];
            if (!v || (v > 0) !== (us > 0)) continue;
            const t = v * us;
            if (t === PAWN) {
                const fwd = 16 * us;
                const startRank = us === WHITE ? 1 : 6, lastRank = us === WHITE ? 7 : 0;
                const one = from + fwd;
                if (onBoard(one) && !b[one]) {
                    if (rankOf(one) === lastRank) {
                        for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(mk(from, one, pr));
                    } else if (!capturesOnly) {
                        out.push(mk(from, one));
                        const two = one + fwd;
                        if (rankOf(from) === startRank && !b[two]) out.push(mk(from, two, 0, F_DOUBLE));
                    }
                }
                for (const side of [fwd - 1, fwd + 1]) {
                    const to = from + side;
                    if (!onBoard(to)) continue;
                    if (b[to] && (b[to] > 0) !== (us > 0)) {
                        if (rankOf(to) === lastRank) {
                            for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(mk(from, to, pr));
                        } else out.push(mk(from, to));
                    } else if (to === this.ep) out.push(mk(from, to, 0, F_EP));
                }
            } else if (t === KNIGHT || t === KING) {
                for (const o of (t === KNIGHT ? KNIGHT_OFF : KING_OFF)) {
                    const to = from + o;
                    if (!onBoard(to)) continue;
                    const w = b[to];
                    if (w && (w > 0) === (us > 0)) continue;
                    if (capturesOnly && !w) continue;
                    out.push(mk(from, to));
                }
                if (t === KING && !capturesOnly) this._genCastles(from, out);
            } else {
                const dirs = t === BISHOP ? DIAG : t === ROOK ? ORTHO : KING_OFF;
                for (const o of dirs) {
                    for (let to = from + o; onBoard(to); to += o) {
                        const w = b[to];
                        if (w) {
                            if ((w > 0) !== (us > 0)) out.push(mk(from, to));
                            break;
                        }
                        if (!capturesOnly) out.push(mk(from, to));
                    }
                }
            }
        }
        return out;
    }

    _genCastles(from, out) {
        const us = this.turn, b = this.b, them = -us;
        const home = us === WHITE ? 0 : 7;
        if (from !== sq(4, home)) return;
        const shortBit = us === WHITE ? 1 : 4, longBit = us === WHITE ? 2 : 8;
        if (!(this.castle & (shortBit | longBit))) return;
        if (this.attacked(from, them)) return;
        if ((this.castle & shortBit) && b[sq(7, home)] === ROOK * us &&
            !b[from + 1] && !b[from + 2] && !this.attacked(from + 1, them) && !this.attacked(from + 2, them)) {
            out.push(mk(from, from + 2, 0, F_CASTLE));
        }
        if ((this.castle & longBit) && b[sq(0, home)] === ROOK * us &&
            !b[from - 1] && !b[from - 2] && !b[from - 3] && !this.attacked(from - 1, them) && !this.attacked(from - 2, them)) {
            out.push(mk(from, from - 2, 0, F_CASTLE));
        }
    }

    make(m) {
        const b = this.b, us = this.turn;
        const from = mFrom(m), to = mTo(m), promo = mPromo(m), flag = mFlag(m);
        const piece = b[from];
        let capSq = to, cap = b[to];
        if (flag & F_EP) { capSq = to - 16 * us; cap = b[capSq]; }
        this.stack.push({ m, cap, capSq, castle: this.castle, ep: this.ep, half: this.half, h1: this.h1, h2: this.h2 });

        let h1 = this.h1, h2 = this.h2;
        if (cap) { b[capSq] = 0; h1 ^= Z_A[zi(cap, capSq)]; h2 ^= Z_B[zi(cap, capSq)]; }
        b[from] = 0;
        h1 ^= Z_A[zi(piece, from)]; h2 ^= Z_B[zi(piece, from)];
        const placed = promo ? promo * us : piece;
        b[to] = placed;
        h1 ^= Z_A[zi(placed, to)]; h2 ^= Z_B[zi(placed, to)];
        if (flag & F_CASTLE) {
            const rFrom = to > from ? from + 3 : from - 4, rTo = to > from ? from + 1 : from - 1;
            const rook = b[rFrom];
            b[rFrom] = 0; b[rTo] = rook;
            h1 ^= Z_A[zi(rook, rFrom)] ^ Z_A[zi(rook, rTo)];
            h2 ^= Z_B[zi(rook, rFrom)] ^ Z_B[zi(rook, rTo)];
        }
        if (piece === KING) this.wk = to; else if (piece === -KING) this.bk = to;

        const nc = this.castle & CASTLE_MASK[from] & CASTLE_MASK[to];
        h1 ^= ZC_A[this.castle] ^ ZC_A[nc]; h2 ^= ZC_B[this.castle] ^ ZC_B[nc];
        this.castle = nc;
        if (this.ep >= 0) { h1 ^= ZE_A[this.ep & 7]; h2 ^= ZE_B[this.ep & 7]; }
        this.ep = (flag & F_DOUBLE) ? from + 16 * us : -1;
        if (this.ep >= 0) { h1 ^= ZE_A[this.ep & 7]; h2 ^= ZE_B[this.ep & 7]; }
        this.half = (cap || piece * us === PAWN) ? 0 : this.half + 1;
        if (us === BLACK) this.full++;
        this.turn = -us;
        h1 ^= ZS_A; h2 ^= ZS_B;
        this.h1 = h1; this.h2 = h2;
    }

    unmake() {
        const u = this.stack.pop();
        const b = this.b, m = u.m;
        this.turn = -this.turn;
        const us = this.turn;
        const from = mFrom(m), to = mTo(m), promo = mPromo(m), flag = mFlag(m);
        const moved = b[to];
        b[from] = promo ? PAWN * us : moved;
        b[to] = 0;
        if (u.cap) b[u.capSq] = u.cap;
        if (flag & F_CASTLE) {
            const rFrom = to > from ? from + 3 : from - 4, rTo = to > from ? from + 1 : from - 1;
            b[rFrom] = b[rTo]; b[rTo] = 0;
        }
        if (b[from] === KING) this.wk = from; else if (b[from] === -KING) this.bk = from;
        if (us === BLACK) this.full--;
        this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.h1 = u.h1; this.h2 = u.h2;
    }

    /** Make m if it doesn't leave the mover's own king attacked. */
    tryMake(m) {
        this.make(m);
        if (this.attacked(this.kingSq(-this.turn), this.turn)) { this.unmake(); return false; }
        return true;
    }

    legalMoves() {
        const out = [];
        for (const m of this.genMoves()) if (this.tryMake(m)) { this.unmake(); out.push(m); }
        return out;
    }

    hasLegalMove() {
        for (const m of this.genMoves()) if (this.tryMake(m)) { this.unmake(); return true; }
        return false;
    }

    /** K v K, K+minor v K, or K+B v K+B with same-coloured bishops. */
    insufficientMaterial() {
        const minors = [];
        for (const s of ALL_SQUARES) {
            const t = Math.abs(this.b[s]);
            if (!t || t === KING) continue;
            if (t === PAWN || t === ROOK || t === QUEEN) return false;
            minors.push({ t, s, c: Math.sign(this.b[s]) });
        }
        if (minors.length <= 1) return true;
        if (minors.length === 2 && minors.every((x) => x.t === BISHOP) && minors[0].c !== minors[1].c) {
            const shade = (s) => (fileOf(s) + rankOf(s)) & 1;
            return shade(minors[0].s) === shade(minors[1].s);
        }
        return false;
    }

    pieceCount() {
        let n = 0;
        for (const s of ALL_SQUARES) if (this.b[s]) n++;
        return n;
    }
}

export function uci(m) {
    const p = mPromo(m);
    return sqName(mFrom(m)) + sqName(mTo(m)) + (p ? PIECE_LETTER[p].toLowerCase() : '');
}

/** Standard algebraic notation for a legal move in `pos` (pos is left unchanged). */
export function toSAN(pos, m, legal = pos.legalMoves()) {
    const from = mFrom(m), to = mTo(m), flag = mFlag(m), promo = mPromo(m);
    const t = Math.abs(pos.b[from]);
    const isCap = !!pos.b[to] || !!(flag & F_EP);
    let s;
    if (flag & F_CASTLE) s = to > from ? 'O-O' : 'O-O-O';
    else if (t === PAWN) {
        s = (isCap ? 'abcdefgh'[fileOf(from)] + 'x' : '') + sqName(to);
        if (promo) s += '=' + PIECE_LETTER[promo];
    } else {
        const rivals = legal.filter((o) => o !== m && mTo(o) === to && Math.abs(pos.b[mFrom(o)]) === t && mFrom(o) !== from);
        let dis = '';
        if (rivals.length) {
            const sameFile = rivals.some((o) => fileOf(mFrom(o)) === fileOf(from));
            const sameRank = rivals.some((o) => rankOf(mFrom(o)) === rankOf(from));
            if (!sameFile) dis = 'abcdefgh'[fileOf(from)];
            else if (!sameRank) dis = String(rankOf(from) + 1);
            else dis = sqName(from);
        }
        s = PIECE_LETTER[t] + dis + (isCap ? 'x' : '') + sqName(to);
    }
    pos.make(m);
    if (pos.inCheck()) s += pos.hasLegalMove() ? '+' : '#';
    pos.unmake();
    return s;
}

/** Find the legal move matching a UCI string ("e2e4", "e7e8q"), or 0. */
export function parseUci(pos, str) {
    for (const m of pos.legalMoves()) if (uci(m) === str) return m;
    return 0;
}

/** Count leaf nodes — the standard move-generator correctness test. */
export function perft(pos, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of pos.genMoves()) {
        if (!pos.tryMake(m)) continue;
        n += depth === 1 ? 1 : perft(pos, depth - 1);
        pos.unmake();
    }
    return n;
}
