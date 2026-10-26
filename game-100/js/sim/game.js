// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// This is a real-time match-3, not a turn-based one: tokens fall, slide and clear on the fixed
// step, and the player can swap any two settled neighbours while the rest of the board is still
// busy. A token sits in one grid cell; while it is moving it carries a visual offset (ox, oy, in
// cells) that shrinks to zero. A token only counts for matching once it is *settled*: idle and
// at rest in its cell.
//
// Tokens: { id, col, sp, r, c, ox, oy, vy, st, t, ... }
//   col  colour index 0-5, or WILD for a Glitterball
//   sp   0 plain, 1 beam across the row, 2 beam down the column, 3 bomb, 4 Glitterball
//   st   IDLE | SWAP | FALL | CLEAR | BOUNCE (see config.ST)

import { W, H, SP, ST, WILD, TIMING, SCORE, FEVER, MODES, SHOUTS, levelFor, colorsFor } from '../config.js';
import { makeRng } from '../rng.js';

const N = W * H;
export const idx = (r, c) => r * W + c;
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];                          // directions: up, right, down, left
export const DIRS = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };

export const isSettled = (t) => !!t && t.st === ST.IDLE && t.ox === 0 && t.oy === 0;

export function newGame(seed = 1, modeId = 'dance') {
    const mode = MODES[modeId] || MODES.dance;
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        mode: mode.id,
        state: 'play',                  // play | finishing | over
        t: 0,
        nextId: 1,
        grid: new Array(N).fill(null),
        score: 0,
        level: 1,
        time: mode.time,                // seconds left (Dance-Off)
        moves: mode.moves,              // moves left (Slow Jam)
        combo: 0,
        comboT: 0,
        meter: 0,                       // groove meter, 0-100
        fever: 0,                       // seconds of Fever left
        feverDrop: 0,
        idleT: 0,                       // s since the last swap
        queued: null,                   // a swap asked for before its tokens settled
        jobs: [],                       // swaps whose special effect fires when the slide ends
        lastSwap: [],                   // ids of the last swapped pair: where a new special appears
        settleT: 0,
        finishT: 0,
        stats: { swaps: 0, bad: 0, waves: 0, cleared: 0, beams: 0, bombs: 0, mirrors: 0, combos: 0, bestCombo: 0, fevers: 0, shuffles: 0, specialsMade: 0, bestWave: 0 },
        events: [],                     // { type, ... } since the last drain; never saved
    };
    fillBoard(G);
    return G;
}

const rnd = (G) => G.rng();
const modeOf = (G) => MODES[G.mode];
const emit = (G, e) => { G.events.push(e); };

function randomColor(G) { return Math.floor(rnd(G) * colorsFor(G.level)); }

function makeToken(G, col, r, c) {
    return { id: G.nextId++, col, sp: SP.NONE, r, c, ox: 0, oy: 0, vy: 0, st: ST.IDLE, t: 0 };
}

// ------------------------------------------------------------------ the first board
function fillBoard(G) {
    for (let tries = 0; tries < 200; tries++) {
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                let col;
                for (let k = 0; k < 30; k++) {
                    col = randomColor(G);
                    const h = c >= 2 && G.grid[idx(r, c - 1)]?.col === col && G.grid[idx(r, c - 2)]?.col === col;
                    const v = r >= 2 && G.grid[idx(r - 1, c)]?.col === col && G.grid[idx(r - 2, c)]?.col === col;
                    if (!h && !v) break;
                }
                G.grid[idx(r, c)] = makeToken(G, col, r, c);
            }
        }
        if (findMoves(G, 1).length) return;
    }
}

// ------------------------------------------------------------------ colours on the board
/** Colour per cell for matching: settled, non-wild tokens only; everything else is -1. */
function colorGrid(G) {
    const cols = new Array(N);
    for (let i = 0; i < N; i++) {
        const t = G.grid[i];
        cols[i] = t && isSettled(t) && t.sp !== SP.MIRROR ? t.col : -1;
    }
    return cols;
}

function lineLen(cols, r, c, dr, dc) {
    const col = cols[idx(r, c)];
    if (col < 0) return 0;
    let n = 1;
    for (let rr = r - dr, cc = c - dc; rr >= 0 && cc >= 0 && rr < H && cc < W && cols[idx(rr, cc)] === col; rr -= dr, cc -= dc) n++;
    for (let rr = r + dr, cc = c + dc; rr >= 0 && cc >= 0 && rr < H && cc < W && cols[idx(rr, cc)] === col; rr += dr, cc += dc) n++;
    return n;
}
const inMatch = (cols, r, c) => lineLen(cols, r, c, 0, 1) >= 3 || lineLen(cols, r, c, 1, 0) >= 3;

/** Runs of three or more, grouped into connected shapes. */
function findShapes(cols) {
    const runs = [];
    for (let r = 0; r < H; r++) {
        for (let c = 0; c < W;) {
            const col = cols[idx(r, c)];
            if (col < 0) { c++; continue; }
            let e = c + 1;
            while (e < W && cols[idx(r, e)] === col) e++;
            if (e - c >= 3) runs.push({ d: 0, r, c, len: e - c, col });
            c = e;
        }
    }
    for (let c = 0; c < W; c++) {
        for (let r = 0; r < H;) {
            const col = cols[idx(r, c)];
            if (col < 0) { r++; continue; }
            let e = r + 1;
            while (e < H && cols[idx(e, c)] === col) e++;
            if (e - r >= 3) runs.push({ d: 1, r, c, len: e - r, col });
            r = e;
        }
    }
    if (!runs.length) return [];
    const cellsOf = (run) => {
        const out = [];
        for (let k = 0; k < run.len; k++) out.push(run.d === 0 ? idx(run.r, run.c + k) : idx(run.r + k, run.c));
        return out;
    };
    const parent = runs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((run, i) => {
        for (const cell of cellsOf(run)) {
            if (owner.has(cell)) parent[find(i)] = find(owner.get(cell)); else owner.set(cell, i);
        }
    });
    const shapes = new Map();
    runs.forEach((run, i) => {
        const root = find(i);
        if (!shapes.has(root)) shapes.set(root, { col: run.col, cells: new Set(), runs: [], maxLen: 0, hasH: false, hasV: false });
        const s = shapes.get(root);
        s.runs.push(run);
        for (const cell of cellsOf(run)) s.cells.add(cell);
        s.maxLen = Math.max(s.maxLen, run.len);
        if (run.d === 0) s.hasH = true; else s.hasV = true;
    });
    return [...shapes.values()];
}

/** What a shape makes: 'mirror' (five or more in a line), 'bomb' (an L, T or +), 'beam' (four), or null. */
function shapeSpecial(s) {
    if (s.maxLen >= 5) return 'mirror';
    if (s.hasH && s.hasV) return 'bomb';
    if (s.maxLen === 4) return 'beam';
    return null;
}

// ------------------------------------------------------------------ moves
/** Would swapping these two settled neighbours make a match, or fire a special? */
export function swapWorks(G, r, c, r2, c2, cols = colorGrid(G)) {
    const a = G.grid[idx(r, c)], b = G.grid[idx(r2, c2)];
    if (!isSettled(a) || !isSettled(b)) return false;
    if (a.sp === SP.MIRROR || b.sp === SP.MIRROR) return true;
    if (a.sp && b.sp) return true;
    const i = idx(r, c), j = idx(r2, c2);
    [cols[i], cols[j]] = [cols[j], cols[i]];
    const ok = inMatch(cols, r, c) || inMatch(cols, r2, c2);
    [cols[i], cols[j]] = [cols[j], cols[i]];
    return ok;
}

/** Every swap that would work right now: [{ r, c, dir }], going right and down from each cell. */
export function findMoves(G, limit = Infinity) {
    const cols = colorGrid(G);
    const out = [];
    for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
            if (c + 1 < W && swapWorks(G, r, c, r, c + 1, cols)) { out.push({ r, c, dir: DIRS.RIGHT }); if (out.length >= limit) return out; }
            if (r + 1 < H && swapWorks(G, r, c, r + 1, c, cols)) { out.push({ r, c, dir: DIRS.DOWN }); if (out.length >= limit) return out; }
        }
    }
    return out;
}

/** The shapes a swap would make, without doing it: for the bot and for hints. */
export function previewSwap(G, r, c, r2, c2) {
    const a = G.grid[idx(r, c)], b = G.grid[idx(r2, c2)];
    if (!isSettled(a) || !isSettled(b)) return null;
    const cols = colorGrid(G);
    if (a.sp === SP.MIRROR || b.sp === SP.MIRROR) return { n: 12, special: 'mirror', combo: true };
    if (a.sp && b.sp) return { n: 14, special: 'combo', combo: true };
    const i = idx(r, c), j = idx(r2, c2);
    [cols[i], cols[j]] = [cols[j], cols[i]];
    const shapes = findShapes(cols);
    if (!shapes.length) return null;
    let n = 0, best = null;
    for (const s of shapes) {
        n += s.cells.size;
        const sp = shapeSpecial(s);
        if (sp && (!best || ['beam', 'bomb', 'mirror'].indexOf(sp) > ['beam', 'bomb', 'mirror'].indexOf(best))) best = sp;
    }
    return { n, special: best, combo: false };
}

export function isCalm(G) {
    if (G.jobs.length) return false;
    for (let i = 0; i < N; i++) {
        const t = G.grid[i];
        if (t && !isSettled(t)) return false;
    }
    return true;
}

function holes(G) {
    for (let i = 0; i < N; i++) if (!G.grid[i]) return true;
    return false;
}

// ------------------------------------------------------------------ commands
function command(G, cmd) {
    if (cmd.t === 'swap') {
        const res = doSwap(G, cmd.r, cmd.c, cmd.d);
        if (res === 'busy' && G.state === 'play') G.queued = { r: cmd.r, c: cmd.c, d: cmd.d, ttl: TIMING.queueTtl };
        else if (res === 'ok' || res === 'bad') G.queued = null;
    }
}

function doSwap(G, r, c, dir) {
    if (G.state !== 'play') return 'closed';
    const r2 = r + DR[dir], c2 = c + DC[dir];
    if (r < 0 || c < 0 || r >= H || c >= W || r2 < 0 || c2 < 0 || r2 >= H || c2 >= W) return 'invalid';
    const a = G.grid[idx(r, c)], b = G.grid[idx(r2, c2)];
    if (!a || !b) return 'busy';
    if (!isSettled(a) || !isSettled(b)) return 'busy';
    if (modeOf(G).moves && G.moves <= 0) return 'closed';

    let combo = null;
    if (a.sp === SP.MIRROR || b.sp === SP.MIRROR) combo = 'mirror';
    else if (a.sp && b.sp) combo = 'double';
    if (!combo && !swapWorks(G, r, c, r2, c2)) {
        // refused: both tokens nudge towards each other and come back
        a.st = b.st = ST.BOUNCE;
        a.t = b.t = TIMING.bounce;
        a.bx = c2 - c; a.by = r2 - r; b.bx = c - c2; b.by = r - r2;
        G.stats.bad++;
        G.idleT = 0;
        emit(G, { type: 'badswap', r, c, r2, c2 });
        return 'bad';
    }
    G.grid[idx(r, c)] = b; G.grid[idx(r2, c2)] = a;
    a.r = r2; a.c = c2; b.r = r; b.c = c;
    a.ox = c - c2; a.oy = r - r2; b.ox = c2 - c; b.oy = r2 - r;
    a.sox = a.ox; a.soy = a.oy; b.sox = b.ox; b.soy = b.oy;
    a.st = b.st = ST.SWAP;
    a.t = b.t = a.dur = b.dur = TIMING.swap;
    G.jobs.push({ a: a.id, b: b.id, combo, t: TIMING.swap });
    G.lastSwap = [a.id, b.id];
    G.idleT = 0;
    G.stats.swaps++;
    if (modeOf(G).moves) G.moves--;
    emit(G, { type: 'swap', r, c, r2, c2 });
    return 'ok';
}

// ------------------------------------------------------------------ one step
/** Advance one fixed step. inp = { cmds: [{ t: 'swap', r, c, d }] }. */
export function step(G, inp, dt) {
    if (G.state === 'over') return;
    G.t += dt;
    if (inp?.cmds) for (const cmd of inp.cmds) command(G, cmd);
    if (G.queued) {
        G.queued.ttl -= dt;
        if (G.queued.ttl <= 0) G.queued = null;
        else {
            const q = G.queued;
            const res = doSwap(G, q.r, q.c, q.d);
            if (res !== 'busy') G.queued = null;
        }
    }
    clock(G, dt);
    animate(G, dt);
    gravity(G, dt);
    spawn(G);
    runJobs(G, dt);
    detect(G);
    feverTick(G, dt);
    upkeep(G, dt);
}

function clock(G, dt) {
    G.idleT += dt;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.comboT = 0; } }
    const mode = modeOf(G);
    if (G.state === 'play') {
        if (mode.time) {
            G.time = Math.max(0, G.time - dt);
            if (G.time === 0) { G.state = 'finishing'; G.finishT = 0; emit(G, { type: 'timeup' }); }
        } else if (G.moves <= 0 && !G.jobs.length) {
            G.state = 'finishing'; G.finishT = 0; emit(G, { type: 'timeup' });
        }
    }
}

// swap, bounce and clear timers
function animate(G, dt) {
    for (let i = 0; i < N; i++) {
        const t = G.grid[i];
        if (!t) continue;
        if (t.st === ST.SWAP) {
            t.t -= dt;
            if (t.t <= 0) { t.ox = t.oy = 0; t.st = ST.IDLE; }
            else {
                const p = 1 - t.t / t.dur, e = p * p * (3 - 2 * p);
                t.ox = t.sox * (1 - e); t.oy = t.soy * (1 - e);
            }
        } else if (t.st === ST.BOUNCE) {
            t.t -= dt;
            if (t.t <= 0) { t.ox = t.oy = 0; t.st = ST.IDLE; }
            else {
                const k = Math.sin((1 - t.t / TIMING.bounce) * Math.PI) * 0.28;
                t.ox = t.bx * k; t.oy = t.by * k;
            }
        } else if (t.st === ST.CLEAR) {
            if (G.t >= t.clearAt) G.grid[i] = null;
        }
    }
}

function gravity(G, dt) {
    for (let c = 0; c < W; c++) {
        for (let r = H - 1; r >= 0; r--) {
            const t = G.grid[idx(r, c)];
            if (!t || (t.st !== ST.IDLE && t.st !== ST.FALL)) continue;
            const freeBelow = (rr) => rr + 1 < H && !G.grid[idx(rr + 1, c)];
            if (t.st === ST.IDLE) {
                if (!freeBelow(t.r)) continue;
                moveDown(G, t); t.oy -= 1; t.st = ST.FALL; t.vy = TIMING.spawnV;
            }
            t.vy = Math.min(TIMING.maxFall, t.vy + TIMING.gravity * dt);
            t.oy += t.vy * dt;
            for (let guard = 0; guard < 6 && t.oy >= 0; guard++) {
                if (freeBelow(t.r)) { moveDown(G, t); t.oy -= 1; }
                else {
                    const speed = t.vy;
                    t.oy = 0; t.vy = 0; t.st = ST.IDLE;
                    emit(G, { type: 'land', id: t.id, r: t.r, c: t.c, v: speed });
                    break;
                }
            }
        }
    }
}
function moveDown(G, t) {
    G.grid[idx(t.r, t.c)] = null;
    t.r++;
    G.grid[idx(t.r, t.c)] = t;
}

function spawn(G) {
    for (let c = 0; c < W; c++) {
        if (G.grid[idx(0, c)]) continue;
        const t = makeToken(G, randomColor(G), 0, c);
        t.oy = -1; t.vy = TIMING.spawnV; t.st = ST.FALL;
        G.grid[idx(0, c)] = t;
    }
}

function tokenById(G, id) {
    for (let i = 0; i < N; i++) if (G.grid[i]?.id === id) return G.grid[i];
    return null;
}
export function findToken(G, id) { return tokenById(G, id); }

// ------------------------------------------------------------------ clearing
function newCtx() { return { n: 0, bonus: 0, shape: 0, r: 0, c: 0 }; }

/** Flag a token to pop `delay` seconds from now, and set off whatever it is. */
function clearToken(G, i, delay, ctx) {
    const t = G.grid[i];
    if (!t || t.st === ST.CLEAR) return false;
    t.st = ST.CLEAR;
    t.ox = t.oy = 0;
    t.clearFrom = G.t + delay;
    t.clearAt = G.t + delay + TIMING.clear;
    ctx.n++;
    ctx.r += t.r; ctx.c += t.c;
    G.stats.cleared++;
    emit(G, { type: 'clear', id: t.id, r: t.r, c: t.c, col: t.col, sp: t.sp, delay });
    if (t.sp !== SP.NONE) fire(G, t, delay, ctx);
    return true;
}

function fire(G, t, delay, ctx) {
    const { r, c } = t;
    G.meter = Math.min(100, G.meter + FEVER.perSpecial);
    if (t.sp === SP.BEAM_H) {
        G.stats.beams++; ctx.bonus += SCORE.beam;
        emit(G, { type: 'beam', r, c, dir: 'h', delay });
        for (let cc = 0; cc < W; cc++) hit(G, idx(r, cc), delay + Math.abs(cc - c) * TIMING.beamStep, ctx);
    } else if (t.sp === SP.BEAM_V) {
        G.stats.beams++; ctx.bonus += SCORE.beam;
        emit(G, { type: 'beam', r, c, dir: 'v', delay });
        for (let rr = 0; rr < H; rr++) hit(G, idx(rr, c), delay + Math.abs(rr - r) * TIMING.beamStep, ctx);
    } else if (t.sp === SP.BOMB) {
        G.stats.bombs++; ctx.bonus += SCORE.bomb;
        emit(G, { type: 'blast', r, c, radius: 1, delay });
        blast(G, r, c, 1, delay, ctx);
    } else if (t.sp === SP.MIRROR) {
        G.stats.mirrors++; ctx.bonus += SCORE.mirror;
        const target = ctx.target ?? mostCommon(G);
        mirrorSweep(G, t, target, delay, ctx);
    }
}

function hit(G, i, delay, ctx) {
    const t = G.grid[i];
    if (!t) return;
    clearToken(G, i, delay + (t.sp !== SP.NONE ? TIMING.chainLag : 0), ctx);
}

function blast(G, r, c, radius, delay, ctx) {
    for (let rr = r - radius; rr <= r + radius; rr++) {
        for (let cc = c - radius; cc <= c + radius; cc++) {
            if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
            hit(G, idx(rr, cc), delay + Math.max(Math.abs(rr - r), Math.abs(cc - c)) * 0.04, ctx);
        }
    }
}

function mostCommon(G) {
    const n = new Array(6).fill(0);
    for (let i = 0; i < N; i++) { const t = G.grid[i]; if (t && t.col < 6 && t.st !== ST.CLEAR) n[t.col]++; }
    let best = 0;
    for (let k = 1; k < 6; k++) if (n[k] > n[best]) best = k;
    return best;
}

function mirrorSweep(G, mirror, target, delay, ctx) {
    const hits = [];
    for (let i = 0; i < N; i++) {
        const t = G.grid[i];
        if (t && t !== mirror && t.col === target && t.st !== ST.CLEAR) hits.push(i);
    }
    hits.sort((p, q) => dist2(G, mirror, p) - dist2(G, mirror, q));
    emit(G, { type: 'mirror', id: mirror.id, r: mirror.r, c: mirror.c, col: target, delay, targets: hits.map((i) => [G.grid[i].r, G.grid[i].c]) });
    hits.forEach((i, k) => hit(G, i, delay + 0.1 + k * 0.03, ctx));
}
const dist2 = (G, t, i) => (G.grid[i].r - t.r) ** 2 + (G.grid[i].c - t.c) ** 2;

// ------------------------------------------------------------------ the swap job: specials that need a swap
function runJobs(G, dt) {
    for (let k = G.jobs.length - 1; k >= 0; k--) {
        const job = G.jobs[k];
        job.t -= dt;
        if (job.t > 0) continue;
        const a = tokenById(G, job.a), b = tokenById(G, job.b);
        G.jobs.splice(k, 1);
        if (!job.combo || !a || !b || a.st === ST.CLEAR || b.st === ST.CLEAR) continue;
        specialSwap(G, a, b, job.combo);
    }
}

function specialSwap(G, a, b, kind) {
    const ctx = newCtx();
    ctx.shape = 1;
    const ia = idx(a.r, a.c), ib = idx(b.r, b.c);
    G.stats.waves++;
    if (kind === 'mirror') {
        const m = a.sp === SP.MIRROR ? a : b;
        const o = m === a ? b : a;
        if (o.sp === SP.MIRROR) {
            // two Glitterballs: the whole board goes
            emit(G, { type: 'combo', kind: 'all', r: m.r, c: m.c });
            ctx.bonus += 300;
            const order = [];
            for (let i = 0; i < N; i++) if (G.grid[i]) order.push(i);
            order.sort((p, q) => dist2(G, m, p) - dist2(G, m, q));
            const mi = idx(m.r, m.c);
            m.sp = o.sp = SP.NONE;
            clearToken(G, mi, 0, ctx);
            order.forEach((i, k) => clearToken(G, i, 0.1 + k * 0.012, ctx));
        } else if (o.sp !== SP.NONE) {
            // a Glitterball and a beam or bomb: every token of that colour becomes one, then they all go off
            emit(G, { type: 'combo', kind: 'convert', r: m.r, c: m.c, col: o.col, sp: o.sp });
            ctx.bonus += 150;
            const list = [];
            for (let i = 0; i < N; i++) { const t = G.grid[i]; if (t && t.col === o.col && t.st !== ST.CLEAR && t !== m) list.push(i); }
            list.sort((p, q) => dist2(G, m, p) - dist2(G, m, q));
            m.sp = SP.NONE;
            clearToken(G, idx(m.r, m.c), 0, ctx);
            list.forEach((i, k) => {
                const t = G.grid[i];
                t.sp = o.sp === SP.BOMB ? SP.BOMB : (k % 2 ? SP.BEAM_V : SP.BEAM_H);
                emit(G, { type: 'morph', id: t.id, r: t.r, c: t.c, sp: t.sp, delay: 0.1 + k * 0.05 });
            });
            list.forEach((i, k) => clearToken(G, i, 0.35 + k * 0.09, ctx));
        } else {
            ctx.target = o.col;
            m.sp = SP.MIRROR;
            clearToken(G, idx(m.r, m.c), 0, ctx);
        }
    } else {
        // two specials swapped together
        const sa = a.sp, sb = b.sp;
        const beams = (s) => s === SP.BEAM_H || s === SP.BEAM_V;
        const r = b.r, c = b.c;
        if (beams(sa) && beams(sb)) {
            emit(G, { type: 'combo', kind: 'cross', r, c });
            ctx.bonus += 100;
            a.sp = SP.BEAM_H; b.sp = SP.BEAM_V;      // one along the row, one down the column
            clearToken(G, ia, 0, ctx); clearToken(G, ib, 0, ctx);
        } else if (sa === SP.BOMB && sb === SP.BOMB) {
            emit(G, { type: 'combo', kind: 'mega', r, c });
            ctx.bonus += 120;
            a.sp = b.sp = SP.NONE;
            emit(G, { type: 'blast', r, c, radius: 2, delay: 0 });
            blast(G, r, c, 2, 0, ctx);
        } else {
            emit(G, { type: 'combo', kind: 'fat', r, c });
            ctx.bonus += 140;
            a.sp = b.sp = SP.NONE;
            for (let k = -1; k <= 1; k++) {
                for (let cc = 0; cc < W; cc++) if (r + k >= 0 && r + k < H) hit(G, idx(r + k, cc), Math.abs(cc - c) * TIMING.beamStep, ctx);
                for (let rr = 0; rr < H; rr++) if (c + k >= 0 && c + k < W) hit(G, idx(rr, c + k), Math.abs(rr - r) * TIMING.beamStep, ctx);
            }
            emit(G, { type: 'beam', r, c, dir: 'h', delay: 0, fat: true });
            emit(G, { type: 'beam', r, c, dir: 'v', delay: 0, fat: true });
        }
    }
    award(G, ctx);
}

// ------------------------------------------------------------------ matches
function detect(G) {
    const shapes = findShapes(colorGrid(G));
    if (!shapes.length) return;
    G.combo++;
    G.comboT = SCORE.comboWindow;
    G.stats.waves++;
    if (G.combo > G.stats.bestCombo) G.stats.bestCombo = G.combo;
    const ctx = newCtx();
    const makes = [];
    for (const s of shapes) {
        const sp = shapeSpecial(s);
        let keeper = -1;
        if (sp) {
            const cells = [...s.cells].sort((p, q) => p - q);
            const plain = cells.filter((i) => G.grid[i].sp === SP.NONE);
            keeper = plain.find((i) => G.lastSwap.includes(G.grid[i].id)) ?? -1;
            if (keeper < 0 && plain.length) {
                if (sp === 'bomb') {
                    const h = s.runs.filter((x) => x.d === 0).flatMap((x) => cellList(x));
                    const v = new Set(s.runs.filter((x) => x.d === 1).flatMap((x) => cellList(x)));
                    keeper = h.find((i) => v.has(i) && G.grid[i].sp === SP.NONE) ?? plain[0];
                } else {
                    const run = s.runs.reduce((best, x) => (x.len > best.len ? x : best), s.runs[0]);
                    const list = cellList(run);
                    keeper = list[Math.floor((list.length - 1) / 2)];
                    if (G.grid[keeper].sp !== SP.NONE) keeper = plain[0];
                }
            }
        }
        for (const i of s.cells) if (i !== keeper) clearToken(G, i, 0, ctx);
        if (keeper >= 0) makes.push({ i: keeper, sp, run: s.runs[0], shape: s });
        ctx.shape += sp === 'mirror' ? SCORE.five : sp === 'bomb' ? SCORE.shape : sp === 'beam' ? SCORE.four : 0;
    }
    for (const m of makes) {
        const t = G.grid[m.i];
        if (!t || t.st === ST.CLEAR) continue;
        t.sp = m.sp === 'mirror' ? SP.MIRROR : m.sp === 'bomb' ? SP.BOMB : (m.run.d === 0 ? SP.BEAM_H : SP.BEAM_V);
        if (m.sp === 'mirror') t.col = WILD;
        G.stats.specialsMade++;
        emit(G, { type: 'make', id: t.id, r: t.r, c: t.c, sp: t.sp });
        const b = modeOf(G).bonus;
        gain(G, m.sp === 'mirror' ? b.mirror : m.sp === 'bomb' ? b.bomb : b.beam, t.r, t.c);
    }
    award(G, ctx);
    const b = modeOf(G).bonus;
    if (b.chain4 && G.combo % 4 === 0) gain(G, b.chain4, 0, 0);
}
function cellList(run) {
    const out = [];
    for (let k = 0; k < run.len; k++) out.push(run.d === 0 ? idx(run.r, run.c + k) : idx(run.r + k, run.c));
    return out;
}

/** Time (Dance-Off) or moves (Slow Jam) handed out for something good. */
function gain(G, amount, r, c) {
    if (!amount) return;
    const mode = modeOf(G);
    const scaled = Math.max(mode.time ? 1 : 0, Math.round(amount * (mode.time ? Math.max(0.3, 1 - 0.1 * (G.level - 1)) : 1)));
    if (mode.time) G.time = Math.min(mode.cap, G.time + scaled);
    else G.moves = Math.min(mode.cap, G.moves + scaled);
    emit(G, { type: 'bonus', amount: scaled, time: !!mode.time, r, c });
}

function award(G, ctx) {
    if (!ctx.n) return;
    const mult = 1 + SCORE.comboStep * (Math.min(G.combo, SCORE.comboMax) - 1);
    const fever = G.fever > 0 ? SCORE.feverMult : 1;
    const pts = Math.round(((ctx.n * SCORE.token + ctx.bonus + ctx.shape) * mult * fever) / 5) * 5;
    G.score += pts;
    if (pts > G.stats.bestWave) G.stats.bestWave = pts;
    G.meter = Math.min(100, G.meter + (G.fever > 0 ? 0 : ctx.n * FEVER.perToken + (G.combo >= 3 ? FEVER.perComboWave : 0)));
    const r = ctx.r / ctx.n, c = ctx.c / ctx.n;
    emit(G, { type: 'wave', pts, n: ctx.n, combo: G.combo, r, c, shout: SHOUTS[Math.min(G.combo, SHOUTS.length - 1)], fever: G.fever > 0 });
    if (G.combo >= 2) G.stats.combos++;
}

// ------------------------------------------------------------------ Fever, levels, shuffles, the end
function feverTick(G, dt) {
    if (G.fever > 0) {
        G.fever -= dt;
        G.meter = Math.max(0, (G.fever / FEVER.seconds) * 100);
        G.feverDrop -= dt;
        if (G.feverDrop <= 0 && G.state === 'play') { G.feverDrop = FEVER.dropEvery; dropSpecial(G); }
        if (G.fever <= 0) { G.fever = 0; G.meter = 0; emit(G, { type: 'feverEnd' }); }
    } else if (G.meter >= 100 && G.state === 'play') {
        G.fever = FEVER.seconds;
        G.feverDrop = 0.5;
        G.stats.fevers++;
        emit(G, { type: 'fever' });
        gain(G, modeOf(G).bonus.fever, 0, 0);
    }
}

function dropSpecial(G) {
    const pool = [];
    for (let i = 0; i < N; i++) { const t = G.grid[i]; if (t && isSettled(t) && t.sp === SP.NONE) pool.push(t); }
    if (!pool.length) return;
    const t = pool[Math.floor(rnd(G) * pool.length)];
    const roll = rnd(G);
    t.sp = roll < 0.12 ? SP.MIRROR : roll < 0.45 ? SP.BOMB : roll < 0.73 ? SP.BEAM_H : SP.BEAM_V;
    if (t.sp === SP.MIRROR) t.col = WILD;
    emit(G, { type: 'morph', id: t.id, r: t.r, c: t.c, sp: t.sp, delay: 0 });
}

function upkeep(G, dt) {
    const lv = levelFor(G.score);
    if (lv > G.level && G.state === 'play') {
        G.level = lv;
        emit(G, { type: 'level', level: lv });
        gain(G, modeOf(G).bonus.level, 0, 0);
    }
    const calm = isCalm(G);
    if (G.state === 'play') {
        if (calm) {
            G.settleT += dt;
            if (G.settleT >= TIMING.settleCheck) {
                G.settleT = 0;
                if (!holes(G) && !findMoves(G, 1).length) shuffle(G);
            }
        } else G.settleT = 0;
    } else if (G.state === 'finishing') {
        G.finishT += dt;
        if ((calm && G.finishT > 0.6) || G.finishT > 9) {
            G.state = 'over';
            emit(G, { type: 'over', score: G.score });
        }
    }
}

/** No moves left: deal the colours again (specials stay where they are) until there is one and no match. */
function shuffle(G) {
    const tokens = [];
    for (let i = 0; i < N; i++) if (G.grid[i]) tokens.push(G.grid[i]);
    const colors = tokens.map((t) => t.col);
    for (let tries = 0; tries < 80; tries++) {
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(rnd(G) * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        tokens.forEach((t, k) => { t._col = colors[k]; });
        const cols = new Array(N);
        tokens.forEach((t) => { cols[idx(t.r, t.c)] = t.sp === SP.MIRROR ? -1 : t._col; });
        let clean = true;
        for (let r = 0; r < H && clean; r++) for (let c = 0; c < W; c++) if (cols[idx(r, c)] >= 0 && inMatch(cols, r, c)) { clean = false; break; }
        if (!clean) continue;
        // a legal move: some neighbour swap that matches, or any special on the board
        let any = tokens.some((t) => t.sp !== SP.NONE);
        for (let r = 0; r < H && !any; r++) {
            for (let c = 0; c < W && !any; c++) {
                for (const [dr, dc] of [[0, 1], [1, 0]]) {
                    const r2 = r + dr, c2 = c + dc;
                    if (r2 >= H || c2 >= W) continue;
                    const i = idx(r, c), j = idx(r2, c2);
                    [cols[i], cols[j]] = [cols[j], cols[i]];
                    if ((cols[i] >= 0 && inMatch(cols, r, c)) || (cols[j] >= 0 && inMatch(cols, r2, c2))) any = true;
                    [cols[i], cols[j]] = [cols[j], cols[i]];
                    if (any) break;
                }
            }
        }
        if (any) break;
    }
    // the colours are dealt in place; the view sees a spin
    for (const t of tokens) {
        t.col = t.sp === SP.MIRROR ? WILD : t._col;
        delete t._col;
        t.st = ST.SWAP; t.t = t.dur = 0.35; t.ox = t.oy = t.sox = t.soy = 0;
    }
    G.stats.shuffles++;
    emit(G, { type: 'shuffle' });
}

// ------------------------------------------------------------------ save / load
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
