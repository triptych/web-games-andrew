// ai.js — the computer captain. Negamax alpha-beta with iterative deepening,
// a transposition table, quiescence on captures, MVV-LVA + killer ordering and
// a check extension. Pure: the clock is injected (`now`), randomness is seeded.
//
// It plays plain chess: it does not anticipate sea events (nobody can).

import { RNG } from './rng.js';
import {
    WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, ALL_SQUARES,
    mFrom, mTo, mPromo, mFlag, F_EP, fileOf, rankOf,
} from './chess.js';

export const LEVELS = [
    null,
    { name: 'Cabin Boy', depth: 1, noise: 140, blunder: 0.22 },
    { name: 'Deckhand', depth: 2, noise: 60, blunder: 0.05 },
    { name: 'Bosun', depth: 3, noise: 20, blunder: 0 },
    { name: 'First Mate', depth: 5, time: 900, noise: 0, blunder: 0 },
    { name: 'Captain', depth: 9, time: 2200, noise: 0, blunder: 0 },
];

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const MATE = 100000, INF = 1000000;

// Piece-square tables from White's side, a8 first (classic simplified tables).
const PST = {
    [PAWN]: [
        0, 0, 0, 0, 0, 0, 0, 0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0],
    [KNIGHT]: [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50],
    [BISHOP]: [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -20, -10, -10, -10, -10, -10, -10, -20],
    [ROOK]: [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        0, 0, 0, 5, 5, 0, 0, 0],
    [QUEEN]: [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5,
        -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20],
    [KING]: [
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20,
        20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50];

const pstIndex = (s, color) => color === WHITE ? (7 - rankOf(s)) * 8 + fileOf(s) : rankOf(s) * 8 + fileOf(s);

/** Static evaluation from the side to move's point of view, in centipawns. */
export function evaluate(pos) {
    const b = pos.b;
    let mg = 0, phase = 0, wk = -1, bk = -1;
    let wBishops = 0, bBishops = 0;
    for (const s of ALL_SQUARES) {
        const v = b[s];
        if (!v) continue;
        const t = v > 0 ? v : -v, c = v > 0 ? 1 : -1;
        if (t === KING) { if (c > 0) wk = s; else bk = s; continue; }
        if (t === BISHOP) { if (c > 0) wBishops++; else bBishops++; }
        if (t === KNIGHT || t === BISHOP) phase += 1;
        else if (t === ROOK) phase += 2;
        else if (t === QUEEN) phase += 4;
        mg += c * (VALUE[t] + PST[t][pstIndex(s, c)]);
    }
    if (wBishops >= 2) mg += 30;
    if (bBishops >= 2) mg -= 30;
    // Blend the king tables: middlegame shelter vs endgame centralisation.
    const p = Math.min(phase, 24) / 24;
    if (wk >= 0) mg += PST[KING][pstIndex(wk, 1)] * p + KING_END[pstIndex(wk, 1)] * (1 - p);
    if (bk >= 0) mg -= PST[KING][pstIndex(bk, -1)] * p + KING_END[pstIndex(bk, -1)] * (1 - p);
    return Math.round(mg) * pos.turn;
}

/** Material only, from White's side — for the HUD's balance bar. */
export function material(pos) {
    let m = 0;
    for (const s of ALL_SQUARES) { const v = pos.b[s]; if (v) m += Math.sign(v) * VALUE[Math.abs(v)]; }
    return m;
}

const TT_SIZE = 1 << 18, TT_MASK = TT_SIZE - 1;
const EXACT = 0, LOWER = 1, UPPER = 2;

class Searcher {
    constructor(pos, opts) {
        this.pos = pos;
        this.now = opts.now || (() => 0);
        this.deadline = Infinity;
        this.nodes = 0;
        this.stopped = false;
        this.seen = new Set(opts.history || []);
        this.path = [];
        this.ttKey = new Int32Array(TT_SIZE);
        this.ttMove = new Int32Array(TT_SIZE);
        this.ttScore = new Int32Array(TT_SIZE);
        this.ttDepth = new Int8Array(TT_SIZE).fill(-1);
        this.ttFlag = new Int8Array(TT_SIZE);
        this.killers = [];
        this.hist = new Int32Array(128 * 128);
    }

    orderScore(m, ttm, ply) {
        if (m === ttm) return 1e7;
        const b = this.pos.b;
        const victim = mFlag(m) & F_EP ? PAWN : Math.abs(b[mTo(m)]);
        const promo = mPromo(m);
        if (victim || promo) return 1e6 + VALUE[victim] * 10 - VALUE[Math.abs(b[mFrom(m)])] / 10 + VALUE[promo];
        const k = this.killers[ply];
        if (k && (k[0] === m || k[1] === m)) return 9e5;
        return this.hist[mFrom(m) * 128 + mTo(m)];
    }

    sorted(moves, ttm, ply) {
        const scored = moves.map((m) => [this.orderScore(m, ttm, ply), m]);
        scored.sort((a, b) => b[0] - a[0]);
        return scored.map((x) => x[1]);
    }

    checkTime() {
        if ((++this.nodes & 2047) === 0 && this.now() > this.deadline) this.stopped = true;
        return this.stopped;
    }

    quiesce(alpha, beta, ply) {
        if (this.checkTime()) return 0;
        const pos = this.pos;
        const stand = evaluate(pos);
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;
        if (ply > 40) return stand;
        for (const m of this.sorted(pos.genMoves([], true), 0, ply)) {
            if (!pos.tryMake(m)) continue;
            const sc = -this.quiesce(-beta, -alpha, ply + 1);
            pos.unmake();
            if (this.stopped) return 0;
            if (sc >= beta) return sc;
            if (sc > alpha) alpha = sc;
        }
        return alpha;
    }

    search(depth, alpha, beta, ply) {
        const pos = this.pos;
        if (ply > 0) {
            if (pos.half >= 100) return 0;
            const key = pos.key();
            if (this.seen.has(key) || this.path.includes(key)) return 0;
        }
        const inCheck = pos.inCheck();
        if (inCheck) depth++;
        if (depth <= 0) return this.quiesce(alpha, beta, ply);
        if (this.checkTime()) return 0;

        const idx = pos.h1 & TT_MASK;
        let ttm = 0;
        if (this.ttKey[idx] === pos.h2) {
            ttm = this.ttMove[idx];
            if (ply > 0 && this.ttDepth[idx] >= depth) {
                const s = this.ttScore[idx], f = this.ttFlag[idx];
                if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
            }
        }

        const a0 = alpha;
        let best = -INF, bestMove = 0, legal = 0;
        this.path.push(pos.key());
        for (const m of this.sorted(pos.genMoves(), ttm, ply)) {
            if (!pos.tryMake(m)) continue;
            legal++;
            const sc = -this.search(depth - 1, -beta, -alpha, ply + 1);
            pos.unmake();
            if (this.stopped) { this.path.pop(); return 0; }
            if (sc > best) { best = sc; bestMove = m; }
            if (sc > alpha) alpha = sc;
            if (alpha >= beta) {
                if (!pos.b[mTo(m)] && !mPromo(m)) {
                    const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
                    if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
                    this.hist[mFrom(m) * 128 + mTo(m)] += depth * depth;
                }
                break;
            }
        }
        this.path.pop();
        if (!legal) return inCheck ? -MATE + ply : 0;

        this.ttKey[idx] = pos.h2;
        this.ttMove[idx] = bestMove;
        this.ttScore[idx] = best;
        this.ttDepth[idx] = depth;
        this.ttFlag[idx] = best <= a0 ? UPPER : best >= beta ? LOWER : EXACT;
        return best;
    }

    /** Score every root move at `depth` with a full window (for noisy levels). */
    rootScores(moves, depth) {
        const pos = this.pos, out = [];
        for (const m of moves) {
            pos.make(m);
            out.push([m, -this.search(depth - 1, -INF, INF, 1)]);
            pos.unmake();
        }
        return out;
    }
}

/**
 * Choose a move. opts: { level 1..5, seed, now: () => ms, history: [keys] }.
 * Returns { move, score, depth, nodes } — move is 0 only if there are no legal moves.
 */
export function chooseMove(pos, opts = {}) {
    const cfg = { ...LEVELS[opts.level || 3], ...(opts.override || {}) };
    const rng = new RNG(opts.seed ?? 1);
    const legal = pos.legalMoves();
    if (!legal.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 0, nodes: 0 };

    const s = new Searcher(pos, opts);
    if (cfg.blunder && rng.chance(cfg.blunder)) {
        return { move: rng.pick(legal), score: 0, depth: 0, nodes: 0 };
    }
    if (cfg.noise) {
        // Low levels: every root move gets a real score, plus seeded noise.
        const scored = s.rootScores(legal, cfg.depth);
        let best = null, bestV = -Infinity;
        for (const [m, sc] of scored) {
            const v = sc + (rng.next() * 2 - 1) * cfg.noise;
            if (v > bestV) { bestV = v; best = [m, sc]; }
        }
        return { move: best[0], score: best[1], depth: cfg.depth, nodes: s.nodes };
    }

    const start = s.now();
    s.deadline = cfg.time ? start + cfg.time : Infinity;
    let bestMove = legal[0], bestScore = 0, reached = 0;
    for (let d = 1; d <= cfg.depth; d++) {
        let alpha = -INF, localBest = 0, localScore = -INF;
        const ttm = d > 1 ? bestMove : 0;
        s.path = [];
        for (const m of s.sorted(legal, ttm, 0)) {
            pos.make(m);
            const sc = -s.search(d - 1, -INF, -alpha, 1);
            pos.unmake();
            if (s.stopped) break;
            if (sc > localScore) { localScore = sc; localBest = m; }
            if (sc > alpha) alpha = sc;
        }
        if (s.stopped && !localBest) break;
        if (localBest) { bestMove = localBest; bestScore = localScore; reached = d; }
        if (s.stopped) break;
        if (Math.abs(bestScore) > MATE - 100) break;
        // Don't start a depth we can't plausibly finish.
        if (cfg.time && s.now() - start > cfg.time * 0.45) break;
    }
    return { move: bestMove, score: bestScore, depth: reached, nodes: s.nodes };
}
