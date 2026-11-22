// JINGLE POP — the simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// A shot is traced the moment it is fired (hex.traceShot) and then flown along that path, so the landing spot is
// known in advance and the aim guide, the bot and the real flight always agree.

import {
    ROWS, COLS, R, ROW_H, DEAD_Y, SHOT_SPEED, TURN_SPEED, COOLDOWN, SCORE, SPIRIT_MAX, SACK_MAX, STAR_GRACE, ENDLESS,
} from '../config.js';
import { makeRng } from '../rng.js';
import * as H from './hex.js';
import { buildLevel, endlessRow, pruneFloating } from './levels.js';
import { LEVELS, POWERS, unlockedPowers } from './data/levels.js';
import { PAR } from './data/par.js';

export const PRESSURE_MISS = 2;                                  // a shot that pops nothing brings the ceiling closer twice as fast
export const CANDY_MAX = 9;                                      // ornaments a candy cane smashes before it shatters
export const TARGET_KINDS = new Set(['orn', 'ice', 'prism']);   // what has to be cleared to win a level
const COLORED = new Set(['orn', 'ice']);

export function newGame({ mode = 'level', level = 1, seed = 1 } = {}) {
    const G = {
        v: 1,
        mode,                       // 'level' | 'endless'
        level: mode === 'level' ? level : 0,
        seed,
        rng: makeRng(seed * 2654435761 + level),
        t: 0,
        score: 0,
        shots: 0,
        over: false,
        result: null,               // 'won' | 'lost'
        phase: 'aim',               // 'aim' | 'fly'
        cool: 0,
        grid: H.emptyGrid(),
        par: 0,                     // row parity offset (endless pushes rows in at the top)
        ceil: 0,                    // rows the ceiling has come down
        miss: 0,                    // shots in a row that popped nothing
        pressure: 0,                // shots since the ceiling last came down (levels) or a row was pushed in (endless);
                                    // a shot that pops nothing counts twice
        pushed: 0,                  // endless: rows pushed in
        dropEvery: 8,
        colors: 4,
        slots: 1,
        aim: Math.PI / 2,
        tray: [],
        next: 0,
        loaded: null,               // a power-up waiting in the launcher
        sack: [],                   // power-ups carried (up to SACK_MAX)
        spirit: 0,
        guide: 0,                   // shots left with the North Star's full guide
        streak: 0,
        bestStreak: 0,
        mult: 1,
        popped: 0,
        dropped: 0,
        parShots: 0,
        stars: 0,
        nextId: 1,
        shot: null,
        warned: { almost: false, danger: -1 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    if (mode === 'level') {
        const def = LEVELS[Math.max(1, Math.min(LEVELS.length, level)) - 1];
        G.level = def.id;
        G.colors = def.colors;
        G.slots = def.slots;
        G.dropEvery = def.drop + 3;
        buildLevel(G, def);
        G.parShots = PAR[def.id - 1] || Math.ceil(targets(G) * 0.36) + 2;
    } else {
        G.colors = 4;
        G.slots = 3;
        G.dropEvery = ENDLESS.pressure;
        for (let i = 0; i < ENDLESS.startRows; i++) pushRow(G, true);
        G.pushed = 0;
    }
    G.next = drawColor(G);
    for (let i = 0; i < G.slots; i++) { G.tray.push(G.next); G.next = drawColor(G); }
    return G;
}

// ------------------------------------------------------------------ queries
export function targets(G) {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const b = G.grid[r][c]; if (b && TARGET_KINDS.has(b.k)) n++; }
    return n;
}

/** Colours of the ornaments (frozen ones too) still on the board. */
export function boardColors(G) {
    const s = new Set();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const b = G.grid[r][c]; if (b && COLORED.has(b.k)) s.add(b.c); }
    return [...s].sort((a, b) => a - b);
}

function drawColor(G) {
    const cols = boardColors(G);
    return cols.length ? G.rng.pick(cols) : G.rng.int(0, G.colors - 1);
}

/** The lowest ball centre on the board (y), or -Infinity when it is empty. */
export function lowestY(G) {
    for (let r = ROWS - 1; r >= 0; r--) if (G.grid[r].some(Boolean)) return H.cellY(G, r);
    return -Infinity;
}

/** Cells of the colour group a ball of colour `col` at (r, c) belongs to (prisms join any colour). */
export function group(G, r, c, col) {
    const out = [[r, c]];
    const seen = new Set([r * 64 + c]);
    for (let i = 0; i < out.length; i++) {
        const [a, b] = out[i];
        for (const [x, y] of H.neighbors(G, a, b)) {
            const k = x * 64 + y;
            if (seen.has(k)) continue;
            const n = G.grid[x][y];
            if (n && ((n.k === 'orn' && n.c === col) || n.k === 'prism')) { seen.add(k); out.push([x, y]); }
        }
    }
    return out;
}

// ------------------------------------------------------------------ step
/**
 * Advance one fixed step. inp = { aim, turn, fire, swap, cycle, use }:
 *   aim   absolute angle (radians from +x, upward) or null;  turn  -1..1 rotate (keys, stick)
 *   fire  shoot (edge);  swap  tray slot to bring into the launcher, or -1;  cycle  rotate the tray (edge)
 *   use   sack slot to use, or -1
 * Returns { fired } so the caller can keep a fire press latched until a step has actually fired it.
 */
export function step(G, inp, dt) {
    const out = { fired: false };
    if (G.over) return out;
    G.t += dt;
    if (G.cool > 0) G.cool = Math.max(0, G.cool - dt);
    if (inp.use >= 0) usePower(G, inp.use);
    if (inp.swap >= 0) swapTray(G, inp.swap);
    if (inp.cycle) cycleTray(G);
    if (inp.aim != null && Number.isFinite(inp.aim)) G.aim = H.clampAim(inp.aim);
    if (inp.turn) G.aim = H.clampAim(G.aim - inp.turn * TURN_SPEED * dt);
    if (G.phase === 'aim') {
        if (inp.fire && G.cool <= 0) { fire(G); out.fired = true; }
    } else if (G.phase === 'fly') fly(G, dt);
    return out;
}

function swapTray(G, i) {
    if (G.loaded) {                                       // tapping the tray puts a loaded power-up back
        if (G.sack.length < SACK_MAX) { G.sack.push(G.loaded); G.loaded = null; G.events.push({ type: 'unload' }); }
        return;
    }
    if (i <= 0 || i >= G.tray.length) return;
    [G.tray[0], G.tray[i]] = [G.tray[i], G.tray[0]];
    G.events.push({ type: 'swap', slot: i });
}

function cycleTray(G) {
    if (G.loaded) return swapTray(G, 1);
    if (G.tray.length < 2) return;
    G.tray.push(G.tray.shift());
    G.events.push({ type: 'swap', slot: 1 });
}

function usePower(G, i) {
    const p = G.sack[i];
    if (!p) return;
    const def = POWERS[p];
    if (def.shot) {
        if (G.phase !== 'aim') return;
        if (G.loaded) G.sack[i] = G.loaded; else G.sack.splice(i, 1);
        G.loaded = p;
        G.events.push({ type: 'load', p });
        return;
    }
    G.sack.splice(i, 1);
    if (p === 'north') G.guide = 8;
    if (p === 'cookie') {
        if (G.mode === 'level') G.ceil = Math.max(0, G.ceil - 1);
        G.pressure = 0;
    }
    G.events.push({ type: 'use', p });
}

function fire(G) {
    let kind = 'orn', c = -1;
    if (G.loaded) { kind = G.loaded; G.loaded = null; } else {
        c = G.tray.shift();
        G.tray.push(G.next);
        G.next = drawColor(G);
    }
    const tr = H.traceShot(G, G.aim, kind === 'candy');
    G.shot = { kind, c, pts: tr.pts, len: tr.dist, s: 0, seg: 0, cell: tr.cell, hit: tr.hit || null, hits: tr.hits || [], hi: 0 };
    G.phase = 'fly';
    G.shots++;
    if (G.guide > 0) G.guide--;
    G.mult = 1 + 0.25 * Math.min(8, G.streak);
    G.events.push({ type: 'shoot', kind, c });
}

function fly(G, dt) {
    const s = G.shot;
    s.s = Math.min(s.len, s.s + SHOT_SPEED * dt);
    const p = H.pathPos(s.pts, s.s);
    while (s.seg < p.seg) { s.seg++; G.events.push({ type: 'bounce', x: s.pts[s.seg].x, y: s.pts[s.seg].y }); }
    if (s.kind === 'candy') {
        const list = [];
        while (s.hi < s.hits.length && s.hits[s.hi].d <= s.s && s.hi < CANDY_MAX) {
            const h = s.hits[s.hi++];
            const b = G.grid[h.r][h.c];
            if (b && b.id === h.id) list.push([h.r, h.c]);
        }
        if (list.length) { const n = popCells(G, list, 'blast'); s.popped = (s.popped || 0) + n; }
        // the cane shatters after CANDY_MAX ornaments
        if (s.hi >= CANDY_MAX && s.hits.length > CANDY_MAX) { s.len = s.s; G.events.push({ type: 'shatter', x: p.x, y: p.y }); }
    }
    if (s.s >= s.len) land(G);
}

// ------------------------------------------------------------------ landing and resolution
function land(G) {
    const s = G.shot;
    G.shot = null;
    G.phase = 'aim';
    G.cool = COOLDOWN;
    let n = 0;
    const cell = s.cell;
    const pos = cell ? { x: H.cellX(G, cell[0], cell[1]), y: H.cellY(G, cell[0]) } : null;
    if (s.kind === 'orn' || s.kind === 'star') {
        if (!cell) return afterShot(G, 0);
        const [r, c] = cell;
        let col = s.c, need = 3;
        if (s.kind === 'star') { col = bestColorAt(G, r, c, s.hit); need = 2; }
        const b = { id: G.nextId++, k: 'orn', c: col };
        G.grid[r][c] = b;
        G.events.push({ type: 'stick', id: b.id, r, c, x: pos.x, y: pos.y, kind: s.kind, col });
        const g = group(G, r, c, col);
        if (g.length >= need) n += popCells(G, g, 'match');
    } else if (s.kind === 'bomb' && cell) {
        G.events.push({ type: 'blast', x: pos.x, y: pos.y });
        const list = H.balls(G).filter((b) => Math.hypot(b.x - pos.x, b.y - pos.y) <= 1.75).map((b) => [b.r, b.c]);
        n += popCells(G, list, 'blast');
    } else if (s.kind === 'bell' && cell) {
        const col = bestColorAt(G, cell[0], cell[1], s.hit, true);
        G.events.push({ type: 'chime', x: pos.x, y: pos.y, col });
        if (col >= 0) {
            const list = H.balls(G).filter((b) => COLORED.has(b.b.k) && b.b.c === col).map((b) => [b.r, b.c]);
            n += popCells(G, list, 'blast');
        }
    } else if (s.kind === 'tinsel' && cell) {
        const rows = [cell[0], cell[0] - 1];
        G.events.push({ type: 'tinsel', rows: rows.filter((r) => r >= 0).map((r) => H.cellY(G, r)) });
        const list = H.balls(G).filter((b) => rows.includes(b.r)).map((b) => [b.r, b.c]);
        n += popCells(G, list, 'blast');
    } else if (s.kind === 'cocoa' && cell) {
        G.events.push({ type: 'cocoa', x: pos.x, y: pos.y });
        for (const b of H.balls(G)) {
            if (b.b.k === 'ice') { b.b.k = 'orn'; G.events.push({ type: 'thaw', id: b.b.id, x: b.x, y: b.y }); }
        }
        const coal = H.balls(G).filter((b) => b.b.k === 'coal' && Math.hypot(b.x - pos.x, b.y - pos.y) <= 2.6).map((b) => [b.r, b.c]);
        n += popCells(G, coal, 'blast') + 1;              // cocoa always counts as a useful shot
    } else if (s.kind === 'candy') {
        n += (s.popped || 0);
    }
    n += dropFloating(G);
    afterShot(G, n);
}

/** For the rainbow star and the jingle bell: the colour that makes the biggest group at (r, c). */
function bestColorAt(G, r, c, hit, includeIce = false) {
    const ok = (b) => b && (b.k === 'orn' || (includeIce && b.k === 'ice'));
    if (hit) { const hb = G.grid[hit.r]?.[hit.c]; if (includeIce && ok(hb)) return hb.c; }
    let best = -1, bn = 0;
    for (const [a, b] of H.neighbors(G, r, c)) {
        const nb = G.grid[a][b];
        if (!ok(nb)) continue;
        const saved = G.grid[r][c];
        G.grid[r][c] = { k: 'orn', c: nb.c };
        const size = group(G, r, c, nb.c).length;
        G.grid[r][c] = saved;
        if (size > bn) { bn = size; best = nb.c; }
    }
    if (best >= 0) return best;
    if (includeIce) return -1;
    const cols = boardColors(G);
    return cols.length ? cols[0] : 0;
}

/**
 * Pop a set of cells. A 'match' pops ornaments and leaves its neighbours to react: frozen ones thaw, presents open,
 * golden bells ring (and pop everything around them). A 'blast' pops whatever is there, coal and ice included.
 * Returns how many ornaments were popped.
 */
function popCells(G, cells, how) {
    const queue = cells.map(([r, c]) => [r, c, how]);
    const inSet = new Set(cells.map(([r, c]) => r * 64 + c));
    const popped = [];
    let n = 0;
    while (queue.length) {
        const [r, c, why] = queue.shift();
        const b = G.grid[r][c];
        if (!b) continue;
        const x = H.cellX(G, r, c), y = H.cellY(G, r);
        if (b.k === 'gift') { openGift(G, r, c); continue; }
        G.grid[r][c] = null;
        popped.push({ id: b.id, x, y, c: b.c, k: b.k });
        if (TARGET_KINDS.has(b.k)) n++;
        G.score += Math.round(SCORE.pop * G.mult);
        if (b.k === 'bell') {
            G.events.push({ type: 'ring', x, y });
            for (const [a, d] of H.neighbors(G, r, c)) {
                const k = a * 64 + d;
                if (G.grid[a][d] && !inSet.has(k)) { inSet.add(k); queue.push([a, d, 'blast']); }
            }
        }
        if (why === 'match' || b.k === 'bell') {
            for (const [a, d] of H.neighbors(G, r, c)) {
                const nb = G.grid[a][d];
                if (!nb || inSet.has(a * 64 + d)) continue;
                if (nb.k === 'ice') { nb.k = 'orn'; G.events.push({ type: 'thaw', id: nb.id, x: H.cellX(G, a, d), y: H.cellY(G, a) }); }
                else if (nb.k === 'gift') openGift(G, a, d);
                else if (nb.k === 'bell') { inSet.add(a * 64 + d); queue.push([a, d, 'blast']); }
            }
        }
    }
    if (popped.length) {
        G.popped += n;
        G.events.push({ type: 'pop', list: popped, mult: G.mult, how });
    }
    return n;
}

function openGift(G, r, c) {
    const b = G.grid[r][c];
    G.grid[r][c] = null;
    const pool = unlockedPowers(G.mode === 'level' ? G.level : 0);
    const p = G.rng.pick(pool.length ? pool : ['bomb']);
    G.score += SCORE.gift;
    const x = H.cellX(G, r, c), y = H.cellY(G, r);
    G.events.push({ type: 'gift', id: b.id, x, y, p });
    givePower(G, p, 'gift');
}

function givePower(G, p, from) {
    if (G.sack.length < SACK_MAX) { G.sack.push(p); G.events.push({ type: 'power', p, from }); }
    else { G.score += 200; G.events.push({ type: 'power', p, from, full: true }); }
}

/** Drop everything no longer hanging from the ceiling. Returns how many ornaments fell. */
function dropFloating(G) {
    const gone = pruneFloating(G);
    if (!gone.length) return 0;
    let n = 0;
    const list = [];
    for (const [r, c, b] of gone) {
        const x = H.cellX(G, r, c), y = H.cellY(G, r);
        if (b.k === 'gift') { G.grid[r][c] = b; openGift(G, r, c); continue; }
        list.push({ id: b.id, x, y, c: b.c, k: b.k });
        if (TARGET_KINDS.has(b.k)) n++;
    }
    const bonus = 1 + Math.floor(list.length / 5);
    G.score += Math.round(SCORE.drop * list.length * bonus * G.mult);
    G.dropped += n;
    if (list.length) G.events.push({ type: 'drop', list, bonus });
    return n;
}

function afterShot(G, n) {
    if (n > 0) { G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.miss = 0; } else { G.streak = 0; G.miss++; }
    if (n >= 8) G.events.push({ type: 'big', n });
    G.spirit += n;
    while (G.spirit >= SPIRIT_MAX) {
        G.spirit -= SPIRIT_MAX;
        const pool = unlockedPowers(G.mode === 'level' ? G.level : 0);
        givePower(G, G.rng.pick(pool), 'spirit');
    }
    if (G.mode === 'level') {
        const left = targets(G);
        if (left === 0) return win(G);
        if (left <= 5 && !G.warned.almost) { G.warned.almost = true; G.events.push({ type: 'almost', left }); }
        G.pressure += n > 0 ? 1 : PRESSURE_MISS;
        if (G.pressure >= G.dropEvery) {
            G.pressure = 0;
            G.ceil++;
            G.events.push({ type: 'lower', ceil: G.ceil });
        }
    } else {
        G.pressure += n > 0 ? 1 : PRESSURE_MISS;
        G.dropEvery = Math.max(ENDLESS.minPressure, ENDLESS.pressure - Math.floor(G.pushed / ENDLESS.every));
        if (G.pressure >= G.dropEvery) { G.pressure = 0; pushRow(G); }
        if (!boardColors(G).length && !H.balls(G).length) pushRow(G);     // a cleared blizzard board refills
    }
    // keep the tray to colours still on the board
    const cols = boardColors(G);
    if (cols.length) {
        G.tray = G.tray.map((c) => (cols.includes(c) ? c : G.rng.pick(cols)));
        if (!cols.includes(G.next)) G.next = G.rng.pick(cols);
    }
    const low = lowestY(G);
    if (low > DEAD_Y) return lose(G);
    if (low > DEAD_Y - 2.1 * ROW_H && G.warned.danger !== G.ceil + G.pushed * 100) {
        G.warned.danger = G.ceil + G.pushed * 100;
        G.events.push({ type: 'danger' });
    }
}

/** Endless: a new row of ornaments pushes in from the top. */
function pushRow(G, quiet = false) {
    G.grid.pop();
    G.par ^= 1;
    G.grid.unshift(Array(COLS).fill(null));
    G.colors = 4 + ENDLESS.colorsAt.filter((s) => G.score >= s).length - 1;
    const late = Math.min(1, G.pushed / 20);
    const chances = quiet ? [['gift', 0.02]] : [
        ['ice', 0.05 + 0.07 * late], ['coal', 0.04 + 0.06 * late], ['gift', 0.025], ['bell', 0.01 + 0.01 * late], ['prism', 0.01],
    ];
    G.grid[0] = endlessRow(G, G.colors, chances);
    G.pushed++;
    if (!quiet) G.events.push({ type: 'push', n: G.pushed });
}

function win(G) {
    G.over = true;
    G.result = 'won';
    const rest = H.balls(G).map((b) => ({ id: b.b.id, x: b.x, y: b.y, c: b.b.c, k: b.b.k }));
    G.grid = H.emptyGrid();
    if (rest.length) { G.score += SCORE.drop * rest.length; G.events.push({ type: 'drop', list: rest, bonus: 1 }); }
    G.stars = G.shots <= G.parShots ? 3 : G.shots <= Math.ceil(G.parShots * STAR_GRACE) ? 2 : 1;
    G.score += SCORE.clear + G.stars * SCORE.star;
    G.events.push({ type: 'won', score: G.score, stars: G.stars, shots: G.shots, par: G.parShots });
}

function lose(G) {
    G.over = true;
    G.result = 'lost';
    G.events.push({ type: 'lost', score: G.score });
}

/**
 * What would happen if this shot were fired: runs the real landing rules on a copy of the board.
 * Used by the bot (and so by the balance tests). Returns { n, lost, won, sack }.
 */
export function preview(G, kind, c, tr) {
    const P = {
        ...G,
        grid: G.grid.map((row) => row.map((b) => b && { ...b })),
        rng: makeRng(0), events: [], sack: G.sack.slice(), tray: G.tray.slice(), warned: { ...G.warned },
    };
    P.rng.setState(G.rng.state());
    const before = P.popped + P.dropped;
    P.shot = { kind, c, pts: tr.pts, len: tr.dist, s: tr.dist, seg: 0, cell: tr.cell, hit: tr.hit || null, hits: tr.hits || [], hi: 0 };
    if (kind === 'candy') {
        const list = (tr.hits || []).slice(0, CANDY_MAX).map((h) => [h.r, h.c]);
        P.shot.popped = popCells(P, list, 'blast');
    }
    land(P);
    return { n: P.popped + P.dropped - before, lost: P.result === 'lost', won: P.result === 'won', sack: P.sack.length - G.sack.length, ceil: P.ceil - G.ceil, low: lowestY(P) };
}

/** Where the launcher's ball sits, and where the shot in flight is (for the view). */
export function shotPos(G) {
    return G.shot ? H.pathPos(G.shot.pts, G.shot.s) : null;
}

// ------------------------------------------------------------------ save
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    if (!Array.isArray(G.grid) || G.grid.length !== ROWS) throw new Error('bad grid');
    G.rng.setState(rngState);
    return G;
}

export { H as hex };
