// The resonance board: a 7×7 match-3 grid. Pure. Cells hold tiles { id, k, sp } (kind, special) or null.
// Index i = r * cols + c, row 0 at the top. Everything random comes from the rng passed in.

import { BOARD, KINDS, STATIC, SP } from '../config.js';

const NK = KINDS.length;

export const idx = (r, c) => r * BOARD.cols + c;
export const rowOf = (i) => Math.floor(i / BOARD.cols);
export const colOf = (i) => i % BOARD.cols;
export const adjacent = (a, b) => {
    const dr = Math.abs(rowOf(a) - rowOf(b)), dc = Math.abs(colOf(a) - colOf(b));
    return dr + dc === 1;
};

/** A fresh board with no matches on it and at least one move. */
export function newBoard(rng) {
    const b = { cells: [], nextId: 1, phase: 'idle', t: 0, depth: 0, swap: null, pending: null };
    fill(b, rng);
    return b;
}

function fill(b, rng) {
    for (let tries = 0; tries < 200; tries++) {
        b.cells = [];
        for (let r = 0; r < BOARD.rows; r++) {
            for (let c = 0; c < BOARD.cols; c++) {
                let k;
                do { k = Math.floor(rng() * NK); } while (makesRun(b.cells, r, c, k));
                b.cells.push({ id: b.nextId++, k, sp: SP.none });
            }
        }
        if (hasMove(b.cells)) return;
    }
}

/** Would kind k at (r, c) complete a run with the two already placed to its left or above? */
function makesRun(cells, r, c, k) {
    const at = (rr, cc) => cells[idx(rr, cc)]?.k;
    return (c >= 2 && at(r, c - 1) === k && at(r, c - 2) === k) || (r >= 2 && at(r - 1, c) === k && at(r - 2, c) === k);
}

const kindAt = (cells, r, c) => {
    if (r < 0 || c < 0 || r >= BOARD.rows || c >= BOARD.cols) return -1;
    const t = cells[idx(r, c)];
    return t && t.k !== STATIC ? t.k : -1;
};

/** Every run of three or more: { cells: [i...], k, dir }. */
export function findRuns(cells) {
    const runs = [];
    for (let r = 0; r < BOARD.rows; r++) {
        for (let c = 0; c < BOARD.cols;) {
            const k = kindAt(cells, r, c);
            let e = c + 1;
            while (k >= 0 && kindAt(cells, r, e) === k) e++;
            if (k >= 0 && e - c >= 3) runs.push({ cells: range(c, e).map((cc) => idx(r, cc)), k, dir: 'h' });
            c = e;
        }
    }
    for (let c = 0; c < BOARD.cols; c++) {
        for (let r = 0; r < BOARD.rows;) {
            const k = kindAt(cells, r, c);
            let e = r + 1;
            while (k >= 0 && kindAt(cells, e, c) === k) e++;
            if (k >= 0 && e - r >= 3) runs.push({ cells: range(r, e).map((rr) => idx(rr, c)), k, dir: 'v' });
            r = e;
        }
    }
    return runs;
}
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

/** The cells a swap of a and b would put into runs right away (no cascades). */
export function swapGain(cells, a, b) {
    if (!adjacent(a, b) || !cells[a] || !cells[b] || cells[a].k === STATIC || cells[b].k === STATIC) return null;
    const c2 = cells.slice();
    c2[a] = cells[b]; c2[b] = cells[a];
    const runs = findRuns(c2);
    if (!runs.length) return null;
    const set = new Set();
    let longest = 0;
    for (const run of runs) { for (const i of run.cells) set.add(i); longest = Math.max(longest, run.cells.length); }
    return { cells: [...set].map((i) => c2[i]), runs, longest };
}

/** Every legal swap: { a, b }. */
export function listMoves(cells) {
    const out = [];
    for (let i = 0; i < cells.length; i++) {
        const r = rowOf(i), c = colOf(i);
        if (c + 1 < BOARD.cols && swapGain(cells, i, i + 1)) out.push({ a: i, b: i + 1 });
        if (r + 1 < BOARD.rows && swapGain(cells, i, i + BOARD.cols)) out.push({ a: i, b: i + BOARD.cols });
    }
    return out;
}
export const hasMove = (cells) => listMoves(cells).length > 0;

/**
 * Clear every run on the board. Long runs leave a special behind (4 → a line, 5 → a nova, an L or T → a cross),
 * at the swapped cell when it is part of the run. Specials caught in a clear go off; static next to a clear shatters.
 * Returns { cleared: [{ id, i, k, sp }], created: [{ id, i, k, sp }], blasts: [{ i, sp }], runs }.
 */
export function clearRuns(b, pivots = []) {
    const cells = b.cells;
    const runs = findRuns(cells);
    if (!runs.length) return null;
    const clear = new Set();
    const create = new Map();          // i → sp
    const inH = new Map(), inV = new Map();
    for (const run of runs) for (const i of run.cells) { clear.add(i); (run.dir === 'h' ? inH : inV).set(i, run); }
    const pivotOf = (run) => run.cells.find((i) => pivots.includes(i)) ?? run.cells[Math.floor(run.cells.length / 2)];
    for (const [i, run] of inH) {
        const v = inV.get(i);
        if (v && v.k === run.k) create.set(i, SP.cross);
    }
    for (const run of runs) {
        if (run.cells.some((i) => create.has(i))) continue;
        const n = run.cells.length;
        if (n >= 5) create.set(pivotOf(run), SP.nova);
        else if (n === 4) create.set(pivotOf(run), run.dir === 'h' ? SP.lineH : SP.lineV);
    }

    // specials caught in the clear go off, and can set off others
    const blasts = [];
    const queue = [...clear].filter((i) => cells[i].sp && !create.has(i));
    const fired = new Set();
    while (queue.length) {
        const i = queue.shift();
        if (fired.has(i)) continue;
        fired.add(i);
        const t = cells[i];
        blasts.push({ i, sp: t.sp, k: t.k });
        const hit = [];
        const r = rowOf(i), c = colOf(i);
        if (t.sp === SP.lineH || t.sp === SP.cross) for (let cc = 0; cc < BOARD.cols; cc++) hit.push(idx(r, cc));
        if (t.sp === SP.lineV || t.sp === SP.cross) for (let rr = 0; rr < BOARD.rows; rr++) hit.push(idx(rr, c));
        if (t.sp === SP.nova) cells.forEach((u, j) => { if (u && u.k === t.k) hit.push(j); });
        for (const j of hit) {
            if (!cells[j]) continue;
            if (create.has(j) && j !== i) create.delete(j);
            clear.add(j);
            if (cells[j].sp && !fired.has(j)) queue.push(j);
        }
    }
    // static touching a cleared tile shatters
    for (const i of [...clear]) {
        for (const j of neighbours(i)) if (cells[j]?.k === STATIC) clear.add(j);
    }

    const cleared = [], created = [];
    for (const i of clear) {
        const t = cells[i];
        if (!t) continue;
        if (create.has(i)) {
            const sp = create.get(i);
            cleared.push({ id: t.id, i, k: t.k, sp: t.sp, into: true });
            const nt = { id: b.nextId++, k: t.k, sp };
            cells[i] = nt;
            created.push({ id: nt.id, i, k: nt.k, sp });
        } else {
            cleared.push({ id: t.id, i, k: t.k, sp: t.sp });
            cells[i] = null;
        }
    }
    return { cleared, created, blasts, runs };
}

function neighbours(i) {
    const r = rowOf(i), c = colOf(i), out = [];
    if (r > 0) out.push(i - BOARD.cols);
    if (r < BOARD.rows - 1) out.push(i + BOARD.cols);
    if (c > 0) out.push(i - 1);
    if (c < BOARD.cols - 1) out.push(i + 1);
    return out;
}

/** Drop tiles into the gaps and refill from above. Returns { moves: [{ id, from, to }], spawns: [{ id, i, k, drop }] }. */
export function gravity(b, rng) {
    const moves = [], spawns = [];
    for (let c = 0; c < BOARD.cols; c++) {
        let write = BOARD.rows - 1;
        for (let r = BOARD.rows - 1; r >= 0; r--) {
            const t = b.cells[idx(r, c)];
            if (!t) continue;
            if (write !== r) {
                b.cells[idx(write, c)] = t;
                b.cells[idx(r, c)] = null;
                moves.push({ id: t.id, from: idx(r, c), to: idx(write, c) });
            }
            write--;
        }
        const gap = write + 1;
        for (let r = write; r >= 0; r--) {
            const t = { id: b.nextId++, k: Math.floor(rng() * NK), sp: SP.none };
            b.cells[idx(r, c)] = t;
            spawns.push({ id: t.id, i: idx(r, c), k: t.k, drop: gap });
        }
    }
    return { moves, spawns };
}

/** Re-deal the kinds (keeping ids, specials and static) until the board has a move and no runs. */
export function shuffle(b, rng) {
    const free = b.cells.map((t, i) => (t && t.k !== STATIC ? i : -1)).filter((i) => i >= 0);
    for (let tries = 0; tries < 300; tries++) {
        for (const i of free) b.cells[i].k = Math.floor(rng() * NK);
        if (!findRuns(b.cells).length && hasMove(b.cells)) return true;
    }
    // a jammed-solid board: clear the static so there is room to move
    for (const t of b.cells) if (t && t.k === STATIC) t.k = Math.floor(rng() * NK);
    return shuffle(b, rng);
}

export const countStatic = (cells) => cells.reduce((n, t) => n + (t && t.k === STATIC ? 1 : 0), 0);
