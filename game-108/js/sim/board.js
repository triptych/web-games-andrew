// The board's rules: which lines a token may join, what clears, finding moves. Pure.
//
// A token is { id, c, s, o, h?, wake?, fz?, rb? }: colour index, shape index, the oath it swears,
// the hero it carries (heroes are tokens too), a Vigil's wake count, frozen, rubble.
// The grid is a flat array, index y * w + x; row 0 is the far edge where new stones fall in.

import { BOARD } from '../config.js';

export const W = BOARD.w, Hh = BOARD.h;
export const idx = (x, y) => y * W + x;
export const xy = (i) => [i % W, (i / W) | 0];
export const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh;

/** May this token stand in a line at all? Rubble, Ring and a sleeping Vigil may not. */
export const lineable = (t) => !!t && !t.rb && t.o !== 'ring' && t.o !== 'vigil';
export const isStone = (t) => !!t && !t.h && !t.rb;

/** Does token t's oath accept the line `win` (an array of tokens that includes t)? */
export function fits(t, win) {
    const o = t.o;
    if (o === 'wild') return true;
    let cm = 0, sm = 0;
    for (const u of win) {
        if (u.o === 'wild') continue;
        if (u !== t) {
            if ((o === 'hue' || o === 'host' || o === 'chain' || o === 'cross' || o === 'motley' || o === 'twin') && u.c !== t.c) return false;
            if ((o === 'form' || o === 'prism' || o === 'twin') && u.s !== t.s) return false;
        }
        if (o === 'prism') { if (cm & (1 << u.c)) return false; cm |= 1 << u.c; }
        if (o === 'motley') { if (sm & (1 << u.s)) return false; sm |= 1 << u.s; }
    }
    if (o === 'host' && win.length < 4) return false;
    return true;
}

/** A line is valid when every token in it is content with every other. */
export function lineValid(win) {
    for (const t of win) if (!fits(t, win)) return false;
    return true;
}

function scanLine(g, cells, mark) {
    const n = cells.length;
    for (let a = 0; a < n; a++) {
        if (!lineable(g[cells[a]])) continue;
        const win = [g[cells[a]]];
        for (let b = a + 1; b < n; b++) {
            const t = g[cells[b]];
            if (!lineable(t)) break;
            win.push(t);
            if (win.length >= 3 && lineValid(win)) for (let k = a; k <= b; k++) mark.add(cells[k]);
        }
    }
}

const ROWS = [], COLS = [];
for (let y = 0; y < Hh; y++) ROWS.push(Array.from({ length: W }, (_, x) => idx(x, y)));
for (let x = 0; x < W; x++) COLS.push(Array.from({ length: Hh }, (_, y) => idx(x, y)));

export const neighbours4 = (i) => {
    const [x, y] = xy(i), out = [];
    if (x > 0) out.push(i - 1);
    if (x < W - 1) out.push(i + 1);
    if (y > 0) out.push(i - W);
    if (y < Hh - 1) out.push(i + W);
    return out;
};
export const neighbours8 = (i) => {
    const [x, y] = xy(i), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && inside(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
    }
    return out;
};

/** A Ring token leaves when every neighbour (at least two) is a token sharing one colour. */
export function ringDone(g, i) {
    const ns = neighbours4(i);
    let col = -1;
    for (const j of ns) {
        const u = g[j];
        if (!u || u.rb) return false;
        if (u.o === 'wild') continue;
        if (col < 0) col = u.c; else if (u.c !== col) return false;
    }
    return ns.length >= 2;
}

/**
 * What clears now. combo is 1 for the matches your own swap made and 2+ for cascades.
 * Returns { clear: [indices], matched: Set } — matched includes tokens that joined a line but
 * stay (Crossroads without its cross, Cascade on your own swap).
 */
export function findClears(g, combo) {
    const inH = new Set(), inV = new Set();
    for (const r of ROWS) scanLine(g, r, inH);
    for (const c of COLS) scanLine(g, c, inV);
    const matched = new Set([...inH, ...inV]);
    const clear = [];
    for (const i of matched) {
        const t = g[i];
        if (t.o === 'cross' && !(inH.has(i) && inV.has(i))) continue;
        if (t.o === 'chain' && combo < 2) continue;
        clear.push(i);
    }
    for (let i = 0; i < g.length; i++) if (g[i]?.o === 'ring' && ringDone(g, i)) clear.push(i);
    return { clear, matched };
}

/** Can the token at i be picked up and swapped? */
export const movable = (t) => !!t && !t.rb && !t.fz;

/** Every swap that clears something, as [i, j] pairs. */
export function findMoves(g, limit = Infinity) {
    const out = [];
    for (let i = 0; i < g.length; i++) {
        const [x, y] = xy(i);
        for (const j of [x < W - 1 ? i + 1 : -1, y < Hh - 1 ? i + W : -1]) {
            if (j < 0 || !movable(g[i]) || !movable(g[j])) continue;
            [g[i], g[j]] = [g[j], g[i]];
            const ok = findClears(g, 1).clear.length > 0;
            [g[i], g[j]] = [g[j], g[i]];
            if (ok) { out.push([i, j]); if (out.length >= limit) return out; }
        }
    }
    return out;
}

export const adjacent = (i, j) => {
    const [ax, ay] = xy(i), [bx, by] = xy(j);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/** Cells of an effect's area around origin i. */
export function areaCells(area, i) {
    const all = Array.from({ length: W * Hh }, (_, k) => k);
    if (area === 'ring') return neighbours8(i);
    if (i == null || i < 0) return all;
    const [x, y] = xy(i);
    if (area === 'row') return ROWS[y].filter((k) => k !== i);
    if (area === 'col') return COLS[x].filter((k) => k !== i);
    return all;
}
export { ROWS, COLS };
