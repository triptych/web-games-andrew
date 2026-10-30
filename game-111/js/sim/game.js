// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// A turn-based puzzle: everything happens in act(G, cmd), which validates a command, resolves it
// at once and pushes events. The view, the UI, the bot and the tests all go through act().

import { N, HAND, SCORE, SPARKS, goalFor, mercyFor, CREEP_EVERY } from '../config.js';
import { makeRng } from '../rng.js';
import { SHAPES, poolFor, rotateCells, sizeOf, COLORS } from './pieces.js';
import { ARCANA, POWERS, omensFor, powersFrom } from './arcana.js';

export const BLIGHT = 8;                  // the colour index of a blight stone
export const LAST = ARCANA.length - 1;    // 21, The World
const idx = (x, y) => y * N + x;

/**
 * mode 'quest': the Restoration. Starts at arcanum `arc` (the first one not yet rekindled) with
 *   the powers of `restored` (arcana rekindled in earlier readings).
 *   `embers` is the light an earlier reading gathered toward that arcanum: it is never lost.
 * mode 'endless': a Free Reading for score. The omens still climb, nothing is rekindled for good.
 */
export function newGame(seed = 1, { mode = 'quest', arc = 0, restored = [], embers = 0 } = {}) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        mode,
        t: 0,
        cells: new Array(N * N).fill(0),  // 0 empty, 1..7 glyph colour, 8 blight
        hp: new Array(N * N).fill(0),     // blight hit points
        sigils: new Array(N * N).fill(0), // floor marks, consumed by a clear through them
        hand: new Array(HAND).fill(null),
        uid: 0,
        arc: Math.min(arc, LAST),
        light: 0,                         // toward the current arcanum
        goal: goalFor(Math.min(arc, LAST)),
        score: 0,
        sparks: SPARKS.start,
        resonance: 0,
        misses: 0,                        // placements in a row that cleared nothing
        moves: 0,
        lines: 0,
        bestResonance: 0,
        priorRestored: [...restored],
        restored: [],                     // rekindled in this reading
        owned: powersFrom(restored),
        stuck: false,                     // no glyph fits, but a power could help
        over: false,
        won: false,
        events: [],
    };
    arrive(G, G.arc, true);
    if (mode === 'quest' && embers > 0) G.light = Math.min(G.goal - 1, Math.floor(embers));
    deal(G);
    checkStuck(G);
    return G;
}

/** The fixed step only counts play time; the puzzle itself moves in act(). */
export function step(G, inp, dt) {
    if (!G.over) G.t += dt;
}

// ------------------------------------------------------------------ queries

export function canPlace(G, cells, x, y) {
    for (const [cx, cy] of cells) {
        const px = x + cx, py = y + cy;
        if (px < 0 || py < 0 || px >= N || py >= N) return false;
        if (G.cells[idx(px, py)]) return false;
    }
    return true;
}

/** Every legal anchor for a glyph. */
export function placements(G, cells) {
    const out = [];
    const { w, h } = sizeOf(cells);
    for (let y = 0; y + h <= N; y++) for (let x = 0; x + w <= N; x++) if (canPlace(G, cells, x, y)) out.push([x, y]);
    return out;
}

export function fitsAnywhere(G, cells) {
    const { w, h } = sizeOf(cells);
    for (let y = 0; y + h <= N; y++) for (let x = 0; x + w <= N; x++) if (canPlace(G, cells, x, y)) return true;
    return false;
}

/** The rows and columns a placement would complete (for the preview). */
export function wouldClear(G, cells, x, y) {
    const filled = new Set(cells.map(([cx, cy]) => idx(x + cx, y + cy)));
    const full = (i) => G.cells[i] || filled.has(i);
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = full(idx(c, r)); if (ok) rows.push(r); }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = full(idx(c, r)); if (ok) cols.push(c); }
    return { rows, cols };
}

export function omens(G) { return omensFor(Math.min(G.arc, LAST)); }

/** Can this power be used now, and would it do anything? */
export function powerUsable(G, p) {
    const P = POWERS[p];
    if (!P || G.over || !G.owned.includes(p) || G.sparks < P.cost) return false;
    if (p === 'transmute') return true;
    if (p === 'lantern') return G.cells.some((c) => !c);
    if (p === 'strike') return G.cells.some((c) => c);
    if (p === 'starfall') return G.cells.some((c) => c === BLIGHT);
    if (p === 'turn') return G.hand.some((h) => h);
    return false;
}

function anyFits(G) { return G.hand.some((h) => h && fitsAnywhere(G, h.cells)); }

/** Would some power get a stuck hand moving again? (Turn only counts if a turned glyph fits.) */
function rescueAvailable(G) {
    for (const p of G.owned) {
        if (!powerUsable(G, p)) continue;
        if (p !== 'turn') return true;
        for (const h of G.hand) {
            if (!h) continue;
            let c = h.cells;
            for (let k = 0; k < 3; k++) { c = rotateCells(c); if (fitsAnywhere(G, c)) return true; }
        }
    }
    return false;
}

// ------------------------------------------------------------------ commands

/**
 * cmd: { t: 'place', i, x, y }   place hand glyph i with its top-left cell at (x, y)
 *      { t: 'power', p: 'transmute' | 'starfall' }
 *      { t: 'power', p: 'turn', i }
 *      { t: 'power', p: 'lantern' | 'strike', x, y }
 * Returns true if the command did something. An illegal command changes nothing.
 */
export function act(G, cmd) {
    if (G.over || !cmd) return false;
    let ok = false;
    if (cmd.t === 'place') ok = place(G, cmd);
    else if (cmd.t === 'power') ok = power(G, cmd);
    if (!ok) { G.events.push({ type: 'invalid', cmd: cmd.t }); return false; }
    if (G.hand.every((h) => !h)) deal(G);
    checkStuck(G);
    return true;
}

function place(G, { i, x, y }) {
    const piece = G.hand[i];
    if (!piece || !canPlace(G, piece.cells, x, y)) return false;
    const cells = piece.cells.map(([cx, cy]) => idx(x + cx, y + cy));
    for (const c of cells) G.cells[c] = piece.color;
    G.hand[i] = null;
    G.moves++;
    G.events.push({ type: 'place', slot: i, x, y, cells, color: piece.color, shape: piece.id });
    addLight(G, cells.length * SCORE.cell, false);
    resolve(G, cells);
    return true;
}

function power(G, cmd) {
    const p = cmd.p;
    const P = POWERS[p];
    if (!P || !G.owned.includes(p) || G.sparks < P.cost) return false;
    if (p === 'transmute') {
        G.sparks -= P.cost;
        G.events.push({ type: 'power', p });
        G.hand.fill(null);
        deal(G);
        return true;
    }
    if (p === 'turn') {
        const h = G.hand[cmd.i];
        if (!h) return false;
        G.sparks -= P.cost;
        h.cells = rotateCells(h.cells);
        G.events.push({ type: 'power', p, slot: cmd.i });
        return true;
    }
    if (p === 'lantern') {
        const { x, y } = cmd;
        if (!(x >= 0 && y >= 0 && x < N && y < N) || G.cells[idx(x, y)]) return false;
        G.sparks -= P.cost;
        const c = idx(x, y);
        G.cells[c] = 7;
        G.moves++;
        G.events.push({ type: 'power', p, x, y });
        G.events.push({ type: 'place', slot: -1, x, y, cells: [c], color: 7, shape: 'dot' });
        addLight(G, SCORE.cell, false);
        resolve(G, [c]);
        return true;
    }
    if (p === 'strike') {
        const { x, y } = cmd;
        if (!(x >= 0 && y >= 0 && x < N && y < N)) return false;
        const hit = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= N || py >= N) continue;
            const c = idx(px, py);
            if (G.cells[c]) hit.push({ c, color: G.cells[c] });
        }
        if (!hit.length) return false;
        G.sparks -= P.cost;
        for (const h of hit) { G.cells[h.c] = 0; G.hp[h.c] = 0; }
        G.events.push({ type: 'power', p, x, y, hit });
        addLight(G, hit.length * 5, false);
        return true;
    }
    if (p === 'starfall') {
        const hit = [];
        for (let c = 0; c < N * N; c++) if (G.cells[c] === BLIGHT) hit.push(c);
        if (!hit.length) return false;
        G.sparks -= P.cost;
        for (const c of hit) { G.cells[c] = 0; G.hp[c] = 0; }
        G.events.push({ type: 'power', p, hit });
        addLight(G, hit.length * 20, false);
        return true;
    }
    return false;
}

/** After cells are filled: clear every full row and column, score it, and run the omens. */
function resolve(G, placed) {
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = !!G.cells[idx(c, r)]; if (ok) rows.push(r); }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = !!G.cells[idx(c, r)]; if (ok) cols.push(c); }
    const L = rows.length + cols.length;
    if (!L) {
        G.resonance = Math.max(0, G.resonance - 1);
        G.misses++;
        if (omens(G).creep && G.misses % CREEP_EVERY === 0) creep(G);
        return;
    }
    const set = new Set();
    for (const r of rows) for (let c = 0; c < N; c++) set.add(idx(c, r));
    for (const c of cols) for (let r = 0; r < N; r++) set.add(idx(c, r));
    const cleared = [], cracked = [], broken = [], sigils = [];
    for (const c of set) {
        if (G.cells[c] === BLIGHT) {
            G.hp[c]--;
            if (G.hp[c] > 0) { cracked.push({ c, hp: G.hp[c] }); continue; }
            broken.push(c);
        }
        cleared.push({ c, color: G.cells[c] });
        G.cells[c] = 0;
        G.hp[c] = 0;
        if (G.sigils[c]) { G.sigils[c] = 0; sigils.push(c); }
    }
    const mult = 1 + SCORE.resonanceStep * G.resonance;
    const harmony = omens(G).harmony ? Math.min(rows.length, cols.length) * 100 : 0;
    const base = SCORE.line * L + SCORE.combo * L * (L - 1) + sigils.length * SCORE.sigil + harmony;
    let points = Math.round(base * mult);
    const empty = G.cells.every((c) => !c);
    if (empty) points += SCORE.clearAll;
    G.resonance = Math.min(SCORE.resonanceMax, G.resonance + 1);
    G.bestResonance = Math.max(G.bestResonance, G.resonance);
    G.misses = 0;
    G.lines += L;
    let sparks = 0;
    if (L >= SPARKS.bigClear) sparks++;
    if (empty) sparks++;
    G.events.push({ type: 'clear', rows, cols, cleared, cracked, broken, sigils, placed, points, mult, harmony, empty, resonance: G.resonance });
    if (sparks) gainSparks(G, sparks, 'clear');
    addLight(G, points, true);
}

function gainSparks(G, n, why) {
    const before = G.sparks;
    G.sparks = Math.min(SPARKS.max, G.sparks + n);
    if (G.sparks > before) G.events.push({ type: 'spark', n: G.sparks - before, why });
}

/** Light fills the current arcanum; enough of it rekindles the card and moves on to the next. */
function addLight(G, n, fromClear) {
    G.score += n;
    G.light += n;
    while (G.light >= G.goal) {
        G.light -= G.goal;
        const arc = G.arc;
        if (G.mode === 'quest' && !G.won) {
            G.restored.push(arc);
            const p = ARCANA[arc].power;
            if (p && !G.owned.includes(p)) G.owned.push(p);
            G.events.push({ type: 'restore', arc, power: p || null });
            gainSparks(G, SPARKS.perRestore, 'restore');
            if (arc === LAST) {
                G.won = true;
                G.events.push({ type: 'ending' });
            } else {
                G.arc = arc + 1;
                arrive(G, G.arc, false);
            }
        } else {
            // a free reading (or the afterglow past The World): the omens climb, a spark each time
            G.events.push({ type: 'ascend', arc });
            gainSparks(G, SPARKS.perRestore, 'ascend');
            if (G.arc < LAST) { G.arc++; arrive(G, G.arc, false); }
        }
        G.goal = goalFor(Math.min(G.arc, LAST));
    }
}

// ------------------------------------------------------------------ omens and dealing

/** Seed the omens of an arcanum: top up the sigils, plant its blight. */
function arrive(G, arc, fresh) {
    const o = omensFor(arc);
    const have = G.sigils.reduce((a, s) => a + s, 0);
    const sig = [];
    for (let k = have; k < o.sigils; k++) {
        const c = randomCell(G, (i) => !G.sigils[i] && G.cells[i] !== BLIGHT);
        if (c < 0) break;
        G.sigils[c] = 1;
        sig.push(c);
    }
    const blight = [];
    const onBoard = G.cells.filter((c) => c === BLIGHT).length;
    const n = Math.min(o.blight, Math.max(0, 8 - onBoard));
    for (let k = 0; k < n; k++) {
        const c = plantBlight(G, o.blightHp);
        if (c < 0) break;
        blight.push(c);
    }
    G.events.push({ type: 'arrive', arc, fresh, sigils: sig, blight });
}

function randomCell(G, ok) {
    const free = [];
    for (let i = 0; i < N * N; i++) if (ok(i)) free.push(i);
    return free.length ? free[Math.floor(G.rng() * free.length)] : -1;
}

/** A blight stone on an empty cell that doesn't complete a line by itself. */
function plantBlight(G, hp) {
    const c = randomCell(G, (i) => {
        if (G.cells[i] || G.sigils[i]) return false;
        const x = i % N, y = Math.floor(i / N);
        let row = 0, col = 0;
        for (let k = 0; k < N; k++) { if (G.cells[idx(k, y)]) row++; if (G.cells[idx(x, k)]) col++; }
        return row < N - 1 && col < N - 1;
    });
    if (c < 0) return -1;
    G.cells[c] = BLIGHT;
    G.hp[c] = hp;
    return c;
}

function creep(G) {
    const c = plantBlight(G, omens(G).blightHp);
    if (c >= 0) G.events.push({ type: 'creep', c });
}

function weightedPick(G, pool) {
    let total = 0;
    for (const s of pool) total += s.weight;
    let r = G.rng() * total;
    for (const s of pool) { r -= s.weight; if (r < 0) return s; }
    return pool[pool.length - 1];
}

/** Deal a fresh hand of three. Mercy redraws a few times looking for a hand where every glyph fits. */
function deal(G) {
    const pool = poolFor(Math.min(G.arc, LAST));
    const tries = mercyFor(Math.min(G.arc, LAST));
    let best = null, bestFit = -1;
    for (let k = 0; k < tries; k++) {
        const hand = [];
        for (let j = 0; j < HAND; j++) {
            let s = weightedPick(G, pool);
            if (j === 2 && hand[0].id === s.id && hand[1].id === s.id) s = weightedPick(G, pool);
            hand.push(s);
        }
        const fit = hand.filter((s) => fitsAnywhere(G, s.cells)).length;
        if (fit > bestFit) { best = hand; bestFit = fit; }
        if (fit === HAND) break;
    }
    G.hand = best.map((s) => ({ id: s.id, cells: s.cells.map((c) => [...c]), color: 1 + Math.floor(G.rng() * COLORS), uid: ++G.uid }));
    G.events.push({ type: 'deal', hand: G.hand.map((h) => h.uid) });
}

function checkStuck(G) {
    if (G.over) return;
    if (anyFits(G)) { G.stuck = false; return; }
    if (rescueAvailable(G)) {
        if (!G.stuck) G.events.push({ type: 'stuck' });
        G.stuck = true;
        return;
    }
    G.stuck = false;
    G.over = true;
    G.events.push({ type: 'over', score: G.score, arc: G.arc, restored: [...G.restored] });
}

/** Give up a stuck reading (the player chose not to spend their sparks). */
export function concede(G) {
    if (G.over) return false;
    G.over = true;
    G.stuck = false;
    G.events.push({ type: 'over', score: G.score, arc: G.arc, restored: [...G.restored] });
    return true;
}

// ------------------------------------------------------------------ saves

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!Array.isArray(d.cells) || d.cells.length !== N * N || !Array.isArray(d.hand)) throw new Error('corrupt save');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { SHAPES };
