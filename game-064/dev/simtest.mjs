/**
 * simtest.mjs — headless checks against the real simulation (no browser).
 *
 *   node game-064/dev/simtest.mjs            everything below
 *   GAMES=400 node game-064/dev/simtest.mjs  more chaotic games in section 4
 *
 * 1. Purity: js/sim never imports three.js, touches the DOM, calls Math.random or reads the clock.
 * 2. Move generator: perft on five standard positions (start, Kiwipete, and three tricky ones).
 * 3. AI: finds mates in one at every level that searches, only ever returns legal moves,
 *    and the stronger captains beat the Cabin Boy.
 * 4. Sea events: hundreds of random games in a Tempest with every event forced in turn.
 *    After every ply: both kings on the board, no pawn on rank 1 or 8, the side that just
 *    moved not in check, no piece created or lost (board + Davy Jones' Locker = 16 per side),
 *    and replaying each move and event onto a mirror of piece ids (exactly what the 3D view
 *    does) reproduces the board square for square.
 * 5. Every event type happens, and no event ever ends a game on its own.
 * 6. Determinism, undo and save/load: same seed same game; undo restores the exact FEN;
 *    a JSON round trip mid-game plays on identically.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Position, perft, WHITE, BLACK, PAWN, KING, ALL_SQUARES, rankOf, toSAN } from '../js/sim/chess.js';
import { chooseMove } from '../js/sim/ai.js';
import { EVENT_IDS } from '../js/sim/seaEvents.js';
import { Match, applyRecord } from '../js/sim/game.js';
import { RNG } from '../js/sim/rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const fail = (m) => { fails++; if (fails < 40) console.log('  FAIL', m); };
const ok = (c, m) => { if (!c) fail(m); };
const now = () => performance.now();

// ------------------------------------------------------------------ 1. Purity
for (const f of readdirSync(join(HERE, '../js/sim'))) {
    const code = readFileSync(join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
    if (/Date\.now\(|new Date\(|performance\.now/.test(code)) fail(`${f} reads the clock`);
}
console.log('1. purity checked');

// ------------------------------------------------------------------ 2. Perft
const PERFT = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
for (const [fen, exp] of PERFT) {
    const p = Position.fromFEN(fen);
    exp.forEach((e, i) => { const n = perft(p, i + 1); ok(n === e, `perft ${fen} d${i + 1}: ${n} != ${e}`); });
    ok(p.toFEN() === Position.fromFEN(fen).toFEN(), `perft left ${fen} changed`);
}
console.log('2. perft checked');

// ------------------------------------------------------------------ 3. AI
const MATES = [
    ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'Rd8#'],
    ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'Qxf7#'],
    ['k7/8/1K6/8/8/8/8/7R w - - 0 1', 'Rh8#'],
];
for (const lvl of [2, 3, 4, 5]) {
    for (const [fen, want] of MATES) {
        const p = Position.fromFEN(fen);
        const r = chooseMove(p, { level: lvl, seed: 3, now, override: { noise: 0, blunder: 0 } });
        ok(toSAN(p, r.move) === want, `level ${lvl} missed ${want} in ${fen} (played ${toSAN(p, r.move)})`);
    }
}
function playOut(levelW, levelB, seed, sea = 'off') {
    const g = new Match({ mode: 'pvp', sea, seed: `duel${seed}` });
    const rng = new RNG(seed);
    while (!g.result && g.ply < 240) {
        const lvl = g.turn === WHITE ? levelW : levelB;
        const r = lvl === 0
            ? { move: rng.pick(g.pos.legalMoves()) }
            : chooseMove(g.pos.clone(), { level: lvl, seed: rng.int(1e9), now, history: g.keys, override: { time: 150 } });
        ok(g.pos.legalMoves().includes(r.move), `AI level ${lvl} returned an illegal move`);
        g.play(r.move);
    }
    return g.result ? g.result.winner : 0;
}
let strongWins = 0, games = 6;
for (let i = 0; i < games; i++) {
    const strongWhite = i % 2 === 0;
    const w = playOut(strongWhite ? 4 : 1, strongWhite ? 1 : 4, 100 + i);
    if (w === (strongWhite ? WHITE : BLACK)) strongWins++;
}
ok(strongWins >= 5, `First Mate beat the Cabin Boy only ${strongWins}/${games}`);
console.log(`3. AI checked (First Mate beat Cabin Boy ${strongWins}/${games})`);

// ------------------------------------------------------------------ 4/5. Sea events
const GAMES = +(process.env.GAMES || 250);
const seen = Object.fromEntries(EVENT_IDS.map((k) => [k, 0]));
let plies = 0, eventCount = 0;
for (let gi = 0; gi < GAMES; gi++) {
    const g = new Match({ mode: 'pvp', sea: 'tempest', seed: `chaos${gi}` });
    const rng = new RNG(gi * 7919 + 1);
    // Mirror of piece ids, maintained only from play() records, the way the view does it.
    let nextId = 1;
    const mirror = new Map();   // square -> { id, piece }
    for (const s of ALL_SQUARES) if (g.pos.b[s]) mirror.set(s, { id: nextId++, piece: g.pos.b[s] });
    while (!g.result && g.ply < 160) {
        const legal = g.pos.legalMoves();
        // Mostly random, sometimes greedy, so games reach endgames and promotions.
        let m = rng.pick(legal);
        if (rng.chance(0.3)) {
            const caps = legal.filter((x) => g.pos.b[(x >> 7) & 127]);
            if (caps.length) m = rng.pick(caps);
        }
        if (gi % 3 === 0) g.forceNext = EVENT_IDS[(g.ply + gi) % EVENT_IDS.length];
        const before = g.pos.clone();
        let rec;
        try { rec = g.play(m); } catch (e) { fail(`game ${gi} ply ${g.ply}: ${e.message}`); break; }
        plies++;
        if (rec.event) { eventCount++; seen[rec.event.type]++; }
        const p = g.pos;
        ok(p.wk >= 0 && p.bk >= 0 && p.b[p.wk] === KING && p.b[p.bk] === -KING, `game ${gi}: a king is missing`);
        for (const s of ALL_SQUARES) {
            if (Math.abs(p.b[s]) === PAWN && (rankOf(s) === 0 || rankOf(s) === 7)) fail(`game ${gi}: pawn on back rank`);
        }
        ok(!p.attacked(p.kingSq(-p.turn), p.turn), `game ${gi} ply ${g.ply}: side that moved is in check`);
        for (const c of [WHITE, BLACK]) {
            let n = 0;
            for (const s of ALL_SQUARES) if (Math.sign(p.b[s]) === c) n++;
            const lost = g.captured[c === WHITE ? 'w' : 'b'].length;
            ok(n + lost === 16, `game ${gi}: ${c === WHITE ? 'Navy' : 'Pirates'} count ${n} + ${lost} != 16`);
        }
        if (rec.event && g.result && ['checkmate', 'stalemate', 'insufficient material'].includes(g.result.reason)) {
            // Only allowed if the move alone already ended it (events are rejected otherwise).
            const t = before.clone(); t.make(m);
            const moveEnded = !t.hasLegalMove() || t.insufficientMaterial();
            ok(moveEnded, `game ${gi}: the ${rec.event.type} event ended the game (${g.result.reason})`);
        }
        applyRecord(mirror, rec, () => nextId++);
        for (const s of ALL_SQUARES) {
            const want = p.b[s], got = mirror.get(s)?.piece || 0;
            if (want !== got) { fail(`game ${gi} ply ${g.ply}: mirror ${got} != board ${want} on ${s} after ${rec.move.san} ${rec.event?.type || ''}`); break; }
        }
        ok(mirror.size === p.pieceCount(), `game ${gi}: mirror has ${mirror.size} pieces, board ${p.pieceCount()}`);
    }
}
for (const k of EVENT_IDS) ok(seen[k] > 0, `event ${k} never happened`);
console.log(`4. ${GAMES} tempest games, ${plies} plies, ${eventCount} events checked`);
console.log('5. events seen:', Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(', '));

// ------------------------------------------------------------------ 6. Determinism, undo, save
function scripted(seed, n, roundTripAt = -1) {
    let g = new Match({ mode: 'pvp', sea: 'tempest', seed });
    const rng = new RNG(99);
    const fens = [];
    for (let i = 0; i < n && !g.result; i++) {
        if (i === roundTripAt) g = Match.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
        g.play(rng.pick(g.pos.legalMoves()));
        fens.push(g.pos.toFEN());
    }
    return { g, fens };
}
const A = scripted('det', 60), B = scripted('det', 60), C = scripted('det', 60, 25);
ok(A.fens.join() === B.fens.join(), 'same seed played differently');
ok(A.fens.join() === C.fens.join(), 'save/load round trip changed the game');
{
    const g = new Match({ mode: 'ai', human: WHITE, sea: 'tempest', seed: 'undo' });
    const rng = new RNG(5);
    const history = [];
    for (let i = 0; i < 30 && !g.result; i++) {
        if (g.turn === WHITE) history.push({ fen: g.pos.toFEN(), log: g.log.length, cap: JSON.stringify(g.captured) });
        g.play(rng.pick(g.pos.legalMoves()));
    }
    while (history.length && g.canUndo()) {
        const h = history.pop();
        g.undo();
        ok(g.pos.toFEN() === h.fen, `undo restored ${g.pos.toFEN()} not ${h.fen}`);
        ok(g.log.length === h.log && JSON.stringify(g.captured) === h.cap, 'undo did not restore log/captures');
    }
}
console.log('6. determinism, undo and save/load checked');

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL OK');
process.exit(fails ? 1 : 0);
