// The match-3 board. Pure: plain data in, plain data and events out.
//
// A board is one JSON-able object. Its random state `rs` lives inside it, so the bot can copy a
// board, try a swap on the copy and throw it away, and a save is just the object.
//
// A move resolves completely and at once: swap, every wave of clears and specials, gravity,
// relics reaching the floor, cascades, the shuffle when no move is left. Each step is pushed to
// B.ev in order, and the view plays that script back with animation. The board never waits for
// the view.
//
// Cells: { t: tile | null, soil: layers of dirt under the tile, fossil: a fossil waits under the
// dirt, rock: hit points of a boulder filling the cell }. Tiles: { id, k: 'gem' | 'sun' | 'relic',
// c: colour, s: special (null, 'h', 'v', 'bomb', 'scarab'), crust: a sand crust that holds the
// tile in place, item: the relic's artifact }.

import { rngNext } from '../rng.js';
import { SCORE } from '../config.js';

const NB4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ------------------------------------------------------------------ random
function rand(B) { const [v, s] = rngNext(B.rs); B.rs = s; return v; }
function rint(B, n) { return Math.floor(rand(B) * n); }

// ------------------------------------------------------------------ geometry
export const at = (B, r, c) => (r >= 0 && c >= 0 && r < B.R && c < B.C && B.mask[r * B.C + c] ? B.cells[r * B.C + c] : null);
const rc = (B, i) => [Math.floor(i / B.C), i % B.C];
const isGem = (t) => t && t.k === 'gem';
const movable = (cell) => !!(cell && cell.t && !(cell.t.crust > 0));
const emptyCell = (cell) => cell && !cell.rock && !cell.t;
const specialish = (t) => t && (t.k === 'sun' || (t.k === 'gem' && t.s));

function newTile(B, k, c, s = null) {
    return { id: B.nextId++, k, c, s, crust: 0 };
}

function spawnColor(B) { return B.colors[rint(B, B.colors.length)]; }

// ------------------------------------------------------------------ creation
/**
 * Build a board from a level spec: { R, C, rows: [string], colors, moves, goals, relics }.
 * Row characters: '.' no cell, 'o' plain, '1' '2' dirt layers, 'f' 'F' dirt (1, 2) over a fossil,
 * 'r' 'R' boulder (1, 2 hp), 'x' a crusted find, 'y' a crusted find on dirt, 'S' sunstone,
 * 'H' 'V' 'B' 'Q' a trowel, pickaxe or scarab (tutorials).
 */
export function makeBoard(spec, seed) {
    const R = spec.rows.length, C = spec.rows[0].length;
    const B = {
        R, C, rs: (seed >>> 0) || 1, nextId: 1,
        mask: [], cells: [],
        colors: spec.colors.slice(),
        moves: spec.moves, movesUsed: 0, score: 0,
        goals: spec.goals.map((g) => ({ ...g, got: 0 })),
        relic: spec.relics ? { total: spec.relics.total, max: spec.relics.max, spawned: 0, out: 0 } : null,
        state: 'play',                    // play | won | lost
        chainBest: 0, specialsMade: 0,
        ev: [],
    };
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            const ch = spec.rows[r][c] || '.';
            B.mask.push(ch === '.' ? 0 : 1);
            const cell = { t: null, soil: 0, fossil: false, rock: 0 };
            if (ch === '1' || ch === 'y') cell.soil = 1;
            if (ch === '2') cell.soil = 2;
            if (ch === 'f') { cell.soil = 1; cell.fossil = true; }
            if (ch === 'F') { cell.soil = 2; cell.fossil = true; }
            if (ch === 'r') cell.rock = 1;
            if (ch === 'R') cell.rock = 2;
            B.cells.push(cell);
        }
    }
    fillFresh(B, spec);
    return B;
}

function fillFresh(B, spec) {
    for (let tries = 0; tries < 60; tries++) {
        for (let r = 0; r < B.R; r++) {
            for (let c = 0; c < B.C; c++) {
                const cell = at(B, r, c);
                if (!cell || cell.rock) continue;
                const ch = spec.rows[r][c];
                if (ch === 'S') { cell.t = newTile(B, 'sun', -1); continue; }
                let col = pickSafe(B, r, c);
                cell.t = newTile(B, 'gem', col);
                if (ch === 'x' || ch === 'y') cell.t.crust = 1;
                if (ch === 'H') cell.t.s = 'h';
                if (ch === 'V') cell.t.s = 'v';
                if (ch === 'B') cell.t.s = 'bomb';
                if (ch === 'Q') cell.t.s = 'scarab';
            }
        }
        // relics start in the top rows
        if (B.relic) {
            const want = Math.min(B.relic.max, B.relic.total);
            const tops = [];
            for (let c = 0; c < B.C; c++) {
                for (let r = 0; r < B.R; r++) {
                    const cell = at(B, r, c);
                    if (!cell) continue;
                    if (!cell.rock && cell.t && cell.t.k === 'gem' && !cell.t.crust && !cell.t.s) tops.push([r, c]);
                    break;
                }
            }
            for (let k = 0; k < want && tops.length; k++) {
                const [r, c] = tops.splice(rint(B, tops.length), 1)[0];
                at(B, r, c).t = { ...newTile(B, 'relic', -1), item: B.relic.spawned };
                B.relic.spawned++;
            }
        }
        if (findMoves(B, 1).length) return;
        // no move: try again with fresh colours
        if (B.relic) B.relic.spawned = 0;
        for (const cell of B.cells) cell.t = null;
    }
}

/** A colour that makes no run of three and no 2×2 square with the cells already filled (left, up). */
function pickSafe(B, r, c) {
    const bad = new Set();
    const col = (rr, cc) => { const x = at(B, rr, cc); return x && isGem(x.t) ? x.t.c : -9; };
    if (col(r, c - 1) === col(r, c - 2) && col(r, c - 1) >= 0) bad.add(col(r, c - 1));
    if (col(r - 1, c) === col(r - 2, c) && col(r - 1, c) >= 0) bad.add(col(r - 1, c));
    const a = col(r - 1, c - 1);
    if (a >= 0 && a === col(r - 1, c) && a === col(r, c - 1)) bad.add(a);
    const opts = B.colors.filter((x) => !bad.has(x));
    const list = opts.length ? opts : B.colors;
    return list[rint(B, list.length)];
}

// ------------------------------------------------------------------ matching
/**
 * Every match on the board: runs of 3+ grouped where they touch, and 2×2 squares.
 * Returns [{ cells: [i], color, kind: 'line3' | 'line4' | 'line5' | 'bomb' | 'square', runs }].
 */
export function findGroups(B) {
    const { R, C } = B;
    const colorAt = (r, c) => { const x = at(B, r, c); return x && isGem(x.t) ? x.t.c : -1; };
    const runs = [];
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C;) {
            const k = colorAt(r, c);
            let e = c + 1;
            if (k >= 0) while (e < C && colorAt(r, e) === k) e++;
            if (k >= 0 && e - c >= 3) runs.push({ dir: 'h', color: k, cells: range(c, e).map((x) => r * C + x) });
            c = e;
        }
    }
    for (let c = 0; c < C; c++) {
        for (let r = 0; r < R;) {
            const k = colorAt(r, c);
            let e = r + 1;
            if (k >= 0) while (e < R && colorAt(e, c) === k) e++;
            if (k >= 0 && e - r >= 3) runs.push({ dir: 'v', color: k, cells: range(r, e).map((x) => x * C + c) });
            r = e;
        }
    }
    // union runs that share a cell
    const groups = [];
    const owner = new Map();
    for (const run of runs) {
        const hit = new Set();
        for (const i of run.cells) if (owner.has(i)) hit.add(owner.get(i));
        let g;
        if (!hit.size) { g = { cells: new Set(), color: run.color, runs: [] }; groups.push(g); }
        else {
            const list = [...hit];
            g = list[0];
            for (const o of list.slice(1)) {
                for (const i of o.cells) { g.cells.add(i); owner.set(i, g); }
                g.runs.push(...o.runs);
                groups.splice(groups.indexOf(o), 1);
            }
        }
        for (const i of run.cells) { g.cells.add(i); owner.set(i, g); }
        g.runs.push(run);
    }
    for (const g of groups) {
        const longest = Math.max(...g.runs.map((r) => r.cells.length));
        const dirs = new Set(g.runs.map((r) => r.dir));
        g.kind = longest >= 5 ? 'line5' : dirs.size > 1 ? 'bomb' : longest === 4 ? 'line4' : 'line3';
    }
    // 2×2 squares
    for (let r = 0; r + 1 < R; r++) {
        for (let c = 0; c + 1 < C; c++) {
            const k = colorAt(r, c);
            if (k < 0 || colorAt(r, c + 1) !== k || colorAt(r + 1, c) !== k || colorAt(r + 1, c + 1) !== k) continue;
            const sq = [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1];
            const owners = new Set(sq.filter((i) => owner.has(i)).map((i) => owner.get(i)));
            if (!owners.size) {
                const g = { cells: new Set(sq), color: k, runs: [], kind: 'square' };
                groups.push(g);
                for (const i of sq) owner.set(i, g);
            } else if (owners.size === 1) {
                const g = [...owners][0];
                if (g.kind === 'line3' || g.kind === 'square') {
                    for (const i of sq) { g.cells.add(i); owner.set(i, g); }
                    g.kind = 'square';
                }
            }
        }
    }
    return groups.map((g) => ({ ...g, cells: [...g.cells].sort((a, b) => a - b) }));
}

function range(a, b) { const out = []; for (let i = a; i < b; i++) out.push(i); return out; }

/** Would the tile now at (r, c) be part of a match? Checks lines and squares through that cell only. */
function matchesAt(B, r, c) {
    const x = at(B, r, c);
    if (!x || !isGem(x.t)) return false;
    const k = x.t.c;
    const same = (rr, cc) => { const y = at(B, rr, cc); return !!(y && isGem(y.t) && y.t.c === k); };
    let n = 1;
    for (let d = 1; same(r, c - d); d++) n++;
    for (let d = 1; same(r, c + d); d++) n++;
    if (n >= 3) return true;
    n = 1;
    for (let d = 1; same(r - d, c); d++) n++;
    for (let d = 1; same(r + d, c); d++) n++;
    if (n >= 3) return true;
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        if (same(r + dr, c) && same(r, c + dc) && same(r + dr, c + dc)) return true;
    }
    return false;
}

function canMove(B, r, c) { return movable(at(B, r, c)); }

/** Valid swaps as [[r1, c1], [r2, c2]]. Stops early once `limit` are found. */
export function findMoves(B, limit = Infinity) {
    const out = [];
    for (let r = 0; r < B.R; r++) {
        for (let c = 0; c < B.C; c++) {
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const r2 = r + dr, c2 = c + dc;
                if (!canMove(B, r, c) || !canMove(B, r2, c2)) continue;
                if (swapWorks(B, r, c, r2, c2)) { out.push([[r, c], [r2, c2]]); if (out.length >= limit) return out; }
            }
        }
    }
    return out;
}

function swapWorks(B, r, c, r2, c2) {
    const a = at(B, r, c), b = at(B, r2, c2);
    const ta = a.t, tb = b.t;
    if (specialish(ta) && specialish(tb)) return true;
    if (ta.k === 'sun' && isGem(tb)) return true;
    if (tb.k === 'sun' && isGem(ta)) return true;
    a.t = tb; b.t = ta;
    const ok = matchesAt(B, r, c) || matchesAt(B, r2, c2);
    a.t = ta; b.t = tb;
    return ok;
}

// ------------------------------------------------------------------ goals
function goal(B, kind, c, n = 1) {
    B.goals.forEach((g, idx) => {
        if (g.kind !== kind || (kind === 'color' && g.c !== c) || g.got >= g.n) return;
        g.got = Math.min(g.n, g.got + n);
        B.ev.push({ type: 'goal', idx, got: g.got, n: g.n, kind, c });
    });
}
export const goalsDone = (B) => B.goals.every((g) => g.got >= g.n);

// ------------------------------------------------------------------ waves
function newWave() {
    return { removed: new Set(), cleared: [], crustHit: new Set(), rockHit: new Set(), soilHit: new Set(), queue: [], creates: [] };
}

/**
 * Hit one cell. by = 'match' (part of a match), 'blast' (a special), 'tool' (the hammer).
 * Boulders only take blast and tool hits (matches next to them chip them separately).
 */
function hitCell(B, W, i, d, by) {
    const cell = B.cells[i];
    if (!B.mask[i]) return;
    const [r, c] = rc(B, i);
    if (cell.rock > 0) {
        if (by === 'match' || W.rockHit.has(i)) return;
        W.rockHit.add(i);
        cell.rock--;
        B.score += SCORE.rock;
        B.ev.push({ type: 'rock', d, r, c, left: cell.rock });
        if (!cell.rock) goal(B, 'rock');
        return;
    }
    const t = cell.t;
    let removedNow = false;
    if (t) {
        if (W.removed.has(t.id) || t.k === 'relic') return;
        if (t.crust > 0) {
            if (W.crustHit.has(i)) return;
            W.crustHit.add(i);
            t.crust--;
            B.score += SCORE.crust;
            B.ev.push({ type: 'crust', d, r, c, id: t.id, left: t.crust });
            if (!t.crust) goal(B, 'crust');
            return;
        }
        W.removed.add(t.id);
        W.cleared.push(i);
        removedNow = true;
        const pts = by === 'match' ? 0 : SCORE.blast;
        B.score += pts;
        B.ev.push({ type: 'clear', d, r, c, id: t.id, k: t.k, color: t.c, s: t.s, by, pts });
        if (t.k === 'gem') goal(B, 'color', t.c);
        if (t.s || t.k === 'sun') W.queue.push({ i, t, d: d + 1 });
    }
    if (cell.soil > 0 && !W.soilHit.has(i) && (removedNow || (!t && by !== 'match'))) {
        W.soilHit.add(i);
        cell.soil--;
        B.score += SCORE.soil;
        B.ev.push({ type: 'soil', d, r, c, left: cell.soil });
        if (!cell.soil) {
            goal(B, 'soil');
            if (cell.fossil) {
                cell.fossil = false;
                B.score += SCORE.fossil;
                B.ev.push({ type: 'fossil', d, r, c });
                goal(B, 'fossil');
            }
        }
    }
}

/** Cells a special hits when it goes off at i. */
function pattern(B, s, i) {
    const [r, c] = rc(B, i);
    const out = [];
    const add = (rr, cc) => { if (at(B, rr, cc)) out.push(rr * B.C + cc); };
    if (s === 'h' || s === 'cross') for (let x = 0; x < B.C; x++) add(r, x);
    if (s === 'v' || s === 'cross') for (let y = 0; y < B.R; y++) if (!(s === 'cross' && y === r)) add(y, c);
    if (s === 'bomb') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
        add(r - 2, c); add(r + 2, c); add(r, c - 2); add(r, c + 2);
    }
    if (s === 'bigbomb') for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(r + dr, c + dc);
    if (s === 'wide') {
        for (let dr = -1; dr <= 1; dr++) for (let x = 0; x < B.C; x++) add(r + dr, x);
        for (let dc = -1; dc <= 1; dc++) for (let y = 0; y < B.R; y++) if (Math.abs(y - r) > 1) add(y, c + dc);
    }
    if (s === 'scarab') { add(r, c); for (const [dr, dc] of NB4) add(r + dr, c + dc); }
    return out;
}

/** Where a scarab flies: the cell that does the most for the goals still open. */
function scarabTarget(B, W, from) {
    const open = (kind) => B.goals.some((g) => g.kind === kind && g.got < g.n);
    const colorsOpen = new Set(B.goals.filter((g) => g.kind === 'color' && g.got < g.n).map((g) => g.c));
    let best = -1, bestScore = -1;
    for (let i = 0; i < B.cells.length; i++) {
        if (!B.mask[i] || i === from) continue;
        const cell = B.cells[i];
        if (cell.t && (W.removed.has(cell.t.id) || cell.t.k === 'relic')) continue;
        let s = 0.5;
        if (cell.rock) s = open('rock') ? 6 : 1.5;
        else if (cell.t && cell.t.crust) s = open('crust') ? 5 : 1.5;
        if (cell.soil) s = Math.max(s, (open('soil') || open('fossil') ? 4 : 1) + (cell.fossil ? 2 : 0) + cell.soil * 0.3);
        if (cell.t && isGem(cell.t) && colorsOpen.has(cell.t.c)) s = Math.max(s, 2.5);
        // a relic one cell above the floor is freed by clearing under it
        const below = at(B, rc(B, i)[0] - 1, rc(B, i)[1]);
        if (below && below.t && below.t.k === 'relic' && open('relic')) s = Math.max(s, 3.5);
        s += rand(B) * 0.4;
        if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
}

function mostCommonColor(B, W) {
    const n = new Map();
    for (const cell of B.cells) if (cell.t && isGem(cell.t) && !W.removed.has(cell.t.id)) n.set(cell.t.c, (n.get(cell.t.c) || 0) + 1);
    let best = B.colors[0], bn = -1;
    for (const [k, v] of n) if (v > bn) { bn = v; best = k; }
    return best;
}

/** A special tile that was hit goes off. */
function fire(B, W, f) {
    const { i, t, d } = f;
    const [r, c] = rc(B, i);
    if (t.k === 'sun') {
        const col = f.color ?? mostCommonColor(B, W);
        const cells = [];
        B.cells.forEach((cell, j) => { if (cell.t && isGem(cell.t) && cell.t.c === col && !W.removed.has(cell.t.id)) cells.push(j); });
        B.ev.push({ type: 'fire', d, r, c, s: 'sun', color: col, cells: cells.map((j) => rc(B, j)) });
        for (const j of cells) hitCell(B, W, j, d + 0.25 + dist(B, i, j) * 0.06, 'blast');
        return;
    }
    if (t.s === 'scarab') {
        const near = pattern(B, 'scarab', i);
        B.ev.push({ type: 'fire', d, r, c, s: 'scarab', color: t.c, cells: near.map((j) => rc(B, j)) });
        for (const j of near) hitCell(B, W, j, d, 'blast');
        const n = f.flock || 1;
        for (let k = 0; k < n; k++) {
            const tgt = scarabTarget(B, W, i);
            if (tgt < 0) break;
            const [tr, tc] = rc(B, tgt);
            const carry = f.carry || null;
            B.ev.push({ type: 'fly', d: d + 0.2, r, c, tr, tc, color: t.c, carry });
            if (carry) {
                const cells = pattern(B, carry, tgt);
                B.ev.push({ type: 'fire', d: d + 4, r: tr, c: tc, s: carry, color: t.c, cells: cells.map((j) => rc(B, j)) });
                for (const j of cells) hitCell(B, W, j, d + 4, 'blast');
            } else hitCell(B, W, tgt, d + 4, 'blast');
        }
        return;
    }
    const cells = pattern(B, t.s, i);
    B.ev.push({ type: 'fire', d, r, c, s: t.s, color: t.c, cells: cells.map((j) => rc(B, j)) });
    for (const j of cells) hitCell(B, W, j, d + (t.s === 'bomb' ? 0 : dist(B, i, j) * 0.05), 'blast');
}

function dist(B, i, j) { const [a, b] = rc(B, i), [x, y] = rc(B, j); return Math.abs(a - x) + Math.abs(b - y); }

function drain(B, W) {
    let guard = 0;
    while (W.queue.length && guard++ < 500) fire(B, W, W.queue.shift());
}

/** Clear match groups, chip boulders beside them, and mark where specials are born. */
function clearGroups(B, W, groups, chain, swapCells) {
    for (const g of groups) {
        const kind = g.kind;
        const base = kind === 'line5' ? SCORE.match5 : kind === 'bomb' ? SCORE.bomb : kind === 'line4' ? SCORE.match4 : kind === 'square' ? SCORE.square : SCORE.match3;
        const pts = Math.round((base + Math.max(0, g.cells.length - 3) * 20) * (1 + 0.5 * (chain - 1)));
        B.score += pts;
        const s = kind === 'line5' ? 'sun' : kind === 'bomb' ? 'bomb' : kind === 'line4' ? (g.runs[0].dir === 'h' ? 'h' : 'v') : kind === 'square' ? 'scarab' : null;
        let birth = -1;
        if (s) {
            const free = g.cells.filter((i) => !(B.cells[i].t.crust > 0));
            const swapped = free.filter((i) => swapCells.includes(i));
            if (swapped.length) birth = swapped[0];
            else if (kind === 'bomb') {
                // where the lines cross
                const counts = new Map();
                for (const run of g.runs) for (const i of run.cells) counts.set(i, (counts.get(i) || 0) + 1);
                birth = free.find((i) => counts.get(i) > 1) ?? free[0] ?? -1;
            } else birth = free[Math.floor(free.length / 2)] ?? -1;
        }
        B.ev.push({ type: 'match', r: rc(B, g.cells[0])[0], c: rc(B, g.cells[0])[1], color: g.color, kind, size: g.cells.length, chain, pts, cells: g.cells.map((i) => rc(B, i)), birth: birth >= 0 ? rc(B, birth) : null });
        for (const i of g.cells) hitCell(B, W, i, 0, 'match');
        // boulders next to a match crack
        for (const i of g.cells) {
            const [r, c] = rc(B, i);
            for (const [dr, dc] of NB4) {
                const n = at(B, r + dr, c + dc);
                if (n && n.rock) hitCell(B, W, (r + dr) * B.C + c + dc, 0, 'blast');
            }
        }
        if (s && birth >= 0) {
            const tile = s === 'sun' ? newTile(B, 'sun', -1) : newTile(B, 'gem', g.color, s);
            W.creates.push({ i: birth, tile, from: g.cells.map((i) => rc(B, i)) });
            B.specialsMade++;
        }
    }
}

function commitWave(B, W) {
    for (const i of W.cleared) {
        const cell = B.cells[i];
        if (cell.t && W.removed.has(cell.t.id)) cell.t = null;
    }
    for (const cr of W.creates) {
        const cell = B.cells[cr.i];
        if (cell.t) continue;               // a tile already landed here (should not happen)
        cell.t = cr.tile;
        const [r, c] = rc(B, cr.i);
        B.ev.push({ type: 'create', r, c, tile: { ...cr.tile }, from: cr.from });
    }
}

// ------------------------------------------------------------------ gravity
function aboveRow(B, r, c) { for (let y = r - 1; y >= 0; y--) if (B.mask[y * B.C + c]) return y; return -1; }

/** Can this empty cell be fed from straight above (a tile or the spawner, with nothing stuck between)? */
function fedFromAbove(B, r, c) {
    for (let y = aboveRow(B, r, c); ; y = aboveRow(B, y, c)) {
        if (y < 0) return true;
        const cell = B.cells[y * B.C + c];
        if (cell.rock || (cell.t && cell.t.crust)) return false;
        if (cell.t) return true;
    }
}

function spawnTile(B) {
    const rl = B.relic;
    if (rl && rl.spawned < rl.total) {
        let onBoard = 0;
        for (const cell of B.cells) if (cell.t && cell.t.k === 'relic') onBoard++;
        if (onBoard < rl.max && (onBoard === 0 || rand(B) < 0.25)) {
            const t = { ...newTile(B, 'relic', -1), item: rl.spawned };
            rl.spawned++;
            return t;
        }
    }
    return newTile(B, 'gem', spawnColor(B));
}

/** Let everything fall, slide diagonally past blockers, and refill from the top. */
function settle(B) {
    const paths = new Map();          // id -> { tile, path: [[r, c]...], spawn }
    const spawned = new Array(B.C).fill(0);
    const note = (t, r, c) => { paths.get(t.id).path.push([r, c]); };
    const start = (t, r, c, spawn) => { if (!paths.has(t.id)) paths.set(t.id, { tile: t, path: [[r, c]], spawn }); };
    let guard = 0;
    for (;;) {
        if (guard++ > 4000) break;
        let moved = false;
        for (let c = 0; c < B.C; c++) {
            for (let r = B.R - 1; r >= 0; r--) {
                const cell = at(B, r, c);
                if (!emptyCell(cell)) continue;
                const ra = aboveRow(B, r, c);
                if (ra < 0) {
                    const t = spawnTile(B);
                    start(t, r - 1 - spawned[c], c, true);
                    spawned[c]++;
                    cell.t = t; note(t, r, c); moved = true;
                    continue;
                }
                const src = B.cells[ra * B.C + c];
                if (movable(src)) {
                    start(src.t, ra, c, false);
                    cell.t = src.t; src.t = null; note(cell.t, r, c); moved = true;
                }
            }
        }
        if (moved) continue;
        // one diagonal slide, then straight falls again
        let slid = false;
        for (let r = B.R - 1; r >= 0 && !slid; r--) {
            for (let c = 0; c < B.C && !slid; c++) {
                const cell = at(B, r, c);
                if (!emptyCell(cell) || fedFromAbove(B, r, c)) continue;
                for (const dc of (r + c) % 2 ? [-1, 1] : [1, -1]) {
                    const src = at(B, r - 1, c + dc);
                    if (!movable(src)) continue;
                    start(src.t, r - 1, c + dc, false);
                    cell.t = src.t; src.t = null; note(cell.t, r, c);
                    slid = true; break;
                }
            }
        }
        if (!slid) break;
    }
    const moves = [], spawns = [];
    for (const { tile, path, spawn } of paths.values()) {
        if (path.length < 2) continue;
        if (spawn) spawns.push({ tile: { ...tile }, path });
        else moves.push({ id: tile.id, path });
    }
    if (moves.length || spawns.length) B.ev.push({ type: 'fall', moves, spawns });
}

/** Relics that reached the lowest cell of their column leave the board. Returns how many did. */
function collectRelics(B) {
    let n = 0;
    for (let c = 0; c < B.C; c++) {
        let low = -1;
        for (let r = B.R - 1; r >= 0; r--) if (B.mask[r * B.C + c]) { low = r; break; }
        if (low < 0) continue;
        const cell = B.cells[low * B.C + c];
        if (cell.t && cell.t.k === 'relic') {
            B.ev.push({ type: 'relic', r: low, c, id: cell.t.id, item: cell.t.item });
            cell.t = null;
            B.score += SCORE.relic;
            B.relic.out++;
            goal(B, 'relic');
            n++;
        }
    }
    return n;
}

/** Fall, collect relics, then clear whatever matched, until the board is still. */
function cascade(B, chain0, swapCells = []) {
    let chain = chain0;
    let swap = swapCells;
    for (let guard = 0; guard < 80; guard++) {
        settle(B);
        if (B.relic && collectRelics(B)) continue;
        const groups = findGroups(B);
        if (!groups.length) break;
        chain++;
        B.chainBest = Math.max(B.chainBest, chain);
        const W = newWave();
        B.ev.push({ type: 'wave', chain });
        clearGroups(B, W, groups, chain, swap);
        drain(B, W);
        commitWave(B, W);
        swap = [];
    }
    return chain;
}

// ------------------------------------------------------------------ the player's actions
/** Swap two neighbouring cells. Returns true when it was a real move (one is spent). */
export function trySwap(B, r1, c1, r2, c2) {
    if (B.state !== 'play' || B.moves <= 0) return false;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    const a = at(B, r1, c1), b = at(B, r2, c2);
    if (!movable(a) || !movable(b)) {
        B.ev.push({ type: 'swap', a: [r1, c1], b: [r2, c2], ok: false, stuck: true });
        return false;
    }
    const ta = a.t, tb = b.t;
    const ia = r1 * B.C + c1, ib = r2 * B.C + c2;
    a.t = tb; b.t = ta;           // ta now sits at b, tb at a
    const combo = specialish(ta) && specialish(tb);
    const sun = !combo && ((ta.k === 'sun' && isGem(tb)) || (tb.k === 'sun' && isGem(ta)));
    if (!combo && !sun && !matchesAt(B, r1, c1) && !matchesAt(B, r2, c2)) {
        a.t = ta; b.t = tb;
        B.ev.push({ type: 'swap', a: [r1, c1], b: [r2, c2], ok: false, ids: [ta.id, tb.id] });
        return false;
    }
    B.moves--; B.movesUsed++;
    B.ev.push({ type: 'swap', a: [r1, c1], b: [r2, c2], ok: true, ids: [ta.id, tb.id] });
    B.ev.push({ type: 'moves', left: B.moves });
    let chain = 0;
    if (combo || sun) {
        chain = 1;
        const W = newWave();
        B.ev.push({ type: 'wave', chain: 1 });
        comboFire(B, W, ib, ta, ia, tb);
        drain(B, W);
        commitWave(B, W);
    }
    cascade(B, chain, [ia, ib]);
    afterMove(B);
    return true;
}

/** Two specials swapped together, or a sunstone swapped with a find. `ta` moved to ib, `tb` to ia. */
function comboFire(B, W, ib, ta, ia, tb) {
    const consume = (i, t) => {
        W.removed.add(t.id); W.cleared.push(i);
        const [r, c] = rc(B, i);
        B.ev.push({ type: 'clear', d: 0, r, c, id: t.id, k: t.k, color: t.c, s: t.s, by: 'combo', pts: 0 });
        if (t.k === 'gem') goal(B, 'color', t.c);
        const cell = B.cells[i];
        if (cell.soil > 0 && !W.soilHit.has(i)) { W.soilHit.add(i); hitSoilOnly(B, W, i); }
    };
    const sunA = ta.k === 'sun', sunB = tb.k === 'sun';
    const [r, c] = rc(B, ib);
    B.ev.push({ type: 'combo', r, c, a: kindOf(ta), b: kindOf(tb) });
    if (sunA && sunB) {
        consume(ib, ta); consume(ia, tb);
        B.ev.push({ type: 'fire', d: 0.5, r, c, s: 'nova', color: -1, cells: [] });
        B.cells.forEach((cell, j) => { if (B.mask[j]) hitCell(B, W, j, 0.8 + dist(B, ib, j) * 0.12, 'blast'); });
        B.score += 2000;
        return;
    }
    if (sunA || sunB) {
        const sunI = sunA ? ib : ia, sunT = sunA ? ta : tb;
        const other = sunA ? tb : ta, otherI = sunA ? ia : ib;
        consume(sunI, sunT);
        const col = other.c;
        if (!other.s) {
            W.queue.push({ i: sunI, t: sunT, d: 1, color: col });
            return;
        }
        // every find of that colour becomes the same special, and they all go off
        const cells = [];
        B.cells.forEach((cell, j) => { if (cell.t && isGem(cell.t) && cell.t.c === col && !cell.t.crust) cells.push(j); });
        const [sr, sc] = rc(B, sunI);
        B.ev.push({ type: 'fire', d: 0.3, r: sr, c: sc, s: 'sun', color: col, cells: cells.map((j) => rc(B, j)) });
        for (const j of cells) {
            const t = B.cells[j].t;
            if (j !== otherI) t.s = other.s === 'h' || other.s === 'v' ? (rand(B) < 0.5 ? 'h' : 'v') : other.s;
            const [jr, jc] = rc(B, j);
            B.ev.push({ type: 'convert', d: 0.6 + dist(B, sunI, j) * 0.05, r: jr, c: jc, id: t.id, s: t.s });
        }
        for (const j of cells) hitCell(B, W, j, 1.4 + dist(B, sunI, j) * 0.05, 'blast');
        return;
    }
    // two specials
    consume(ib, ta); consume(ia, tb);
    const ks = [ta.s, tb.s].sort().join('+');
    const line = (s) => s === 'h' || s === 'v';
    let shape;
    if (line(ta.s) && line(tb.s)) shape = 'cross';
    else if (ks === 'bomb+bomb') shape = 'bigbomb';
    else if ((ta.s === 'bomb' && line(tb.s)) || (tb.s === 'bomb' && line(ta.s))) shape = 'wide';
    if (shape) {
        const cells = pattern(B, shape, ib);
        B.ev.push({ type: 'fire', d: 0.2, r, c, s: shape, color: ta.c, cells: cells.map((j) => rc(B, j)) });
        for (const j of cells) hitCell(B, W, j, 0.3 + dist(B, ib, j) * 0.04, 'blast');
        return;
    }
    // a scarab with something: the scarab carries the other special, or three scarabs fly
    const other = ta.s === 'scarab' ? tb : ta;
    W.queue.push({ i: ib, t: { ...ta, s: 'scarab' }, d: 1, carry: other.s === 'scarab' ? null : other.s, flock: other.s === 'scarab' ? 3 : 1 });
}

function hitSoilOnly(B, W, i) {
    const cell = B.cells[i];
    const [r, c] = rc(B, i);
    cell.soil--;
    B.score += SCORE.soil;
    B.ev.push({ type: 'soil', d: 0, r, c, left: cell.soil });
    if (!cell.soil) {
        goal(B, 'soil');
        if (cell.fossil) { cell.fossil = false; B.score += SCORE.fossil; B.ev.push({ type: 'fossil', d: 0, r, c }); goal(B, 'fossil'); }
    }
}

const kindOf = (t) => (t.k === 'sun' ? 'sun' : t.s || 'gem');

/** The hammer: break one cell as if a special had hit it. */
export function useHammer(B, r, c) {
    if (B.state !== 'play') return false;
    const cell = at(B, r, c);
    if (!cell || (!cell.t && !cell.rock && !cell.soil) || (cell.t && cell.t.k === 'relic')) return false;
    const W = newWave();
    B.ev.push({ type: 'hammer', r, c });
    B.ev.push({ type: 'wave', chain: 1 });
    hitCell(B, W, r * B.C + c, 0.3, 'tool');
    drain(B, W);
    commitWave(B, W);
    cascade(B, 1);
    afterMove(B, true);
    return true;
}

/** Mix the finds up (also done for free when no move is left). */
export function shuffle(B, free = false) {
    const slots = [];
    B.cells.forEach((cell, i) => { if (B.mask[i] && cell.t && movable(cell) && cell.t.k === 'gem') slots.push(i); });
    const tiles = slots.map((i) => B.cells[i].t);
    for (let attempt = 0; attempt < 80; attempt++) {
        for (let k = tiles.length - 1; k > 0; k--) { const j = rint(B, k + 1); [tiles[k], tiles[j]] = [tiles[j], tiles[k]]; }
        if (attempt > 40) for (const t of tiles) if (!t.s) t.c = spawnColor(B);
        slots.forEach((i, k) => { B.cells[i].t = tiles[k]; });
        if (!findGroups(B).length && findMoves(B, 1).length) break;
    }
    B.ev.push({ type: 'shuffle', free, moves: slots.map((i) => ({ id: B.cells[i].t.id, to: rc(B, i), c: B.cells[i].t.c })) });
}

function afterMove(B, tool = false) {
    if (goalsDone(B)) { B.state = 'won'; rush(B); return; }
    if (!findMoves(B, 1).length) shuffle(B, true);
    if (B.moves <= 0) { B.state = 'lost'; B.ev.push({ type: 'outofmoves', tool }); }
}

/** Five more moves after running out. */
export function addMoves(B, n) {
    if (B.state !== 'lost') return false;
    B.moves += n;
    B.state = 'play';
    B.ev.push({ type: 'moves', left: B.moves, added: n });
    return true;
}

/**
 * Treasure Rush: every move left turns a find into a trowel, then every special on the board
 * goes off, cascades and all. It only adds score and spectacle.
 */
function rush(B) {
    B.ev.push({ type: 'rushstart', moves: B.moves });
    const left = B.moves;
    for (let k = 0; k < left; k++) {
        const opts = [];
        B.cells.forEach((cell, i) => { if (cell.t && isGem(cell.t) && !cell.t.s && !cell.t.crust) opts.push(i); });
        if (!opts.length) break;
        const i = opts[rint(B, opts.length)];
        const t = B.cells[i].t;
        t.s = rand(B) < 0.5 ? 'h' : 'v';
        B.moves--;
        B.score += SCORE.rushMove;
        const [r, c] = rc(B, i);
        B.ev.push({ type: 'convert', d: k * 0.15, r, c, id: t.id, s: t.s, rush: true });
        B.ev.push({ type: 'moves', left: B.moves });
    }
    for (let guard = 0; guard < 60; guard++) {
        let i = -1;
        B.cells.forEach((cell, j) => { if (i < 0 && cell.t && specialish(cell.t) && !cell.t.crust) i = j; });
        if (i < 0) break;
        const W = newWave();
        B.ev.push({ type: 'wave', chain: 1, rush: true });
        hitCell(B, W, i, 0, 'blast');
        drain(B, W);
        commitWave(B, W);
        cascade(B, 1);
    }
    B.ev.push({ type: 'rushend', score: B.score });
}

/** A JSON copy, for the bot's look-ahead. */
export function cloneBoard(B) {
    return JSON.parse(JSON.stringify({ ...B, ev: [] }));
}

/**
 * An empty cell nothing can reach: capped from above by a boulder or a crusted find, with no
 * find beside it to slide down diagonally. It stays empty until its blocker breaks.
 */
export function pocket(B, r, c) {
    if (fedFromAbove(B, r, c)) return false;
    return ![-1, 1].some((dc) => movable(at(B, r - 1, c + dc)));
}

/** Debug and test check: every playable cell is a boulder, a tile or a pocket, and ids are unique. */
export function checkBoard(B) {
    const ids = new Set();
    for (let i = 0; i < B.cells.length; i++) {
        const cell = B.cells[i];
        if (!B.mask[i]) { if (cell.t) return `tile in a hole at ${i}`; continue; }
        if (cell.rock && cell.t) return `tile inside a boulder at ${i}`;
        if (!cell.rock && !cell.t && !pocket(B, Math.floor(i / B.C), i % B.C)) return `empty cell at ${i}`;
        if (cell.t) { if (ids.has(cell.t.id)) return `duplicate id ${cell.t.id}`; ids.add(cell.t.id); }
        if (cell.soil < 0 || cell.rock < 0) return `negative counter at ${i}`;
    }
    return null;
}
