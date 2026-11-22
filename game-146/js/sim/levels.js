// Builds a level's board from its entry in data/levels.js: a shape, a paint scheme and a sprinkling of specials,
// all from the level's own seed, so a level is the same board every time it is played. Pure.

import { COLS, ROWS, R, ROW_H, FIELD } from '../config.js';
import { makeRng } from '../rng.js';
import { rowLen, cellX, neighbors } from './hex.js';

const CX = FIELD.w / 2;

// shape(x, y, rows): is there an ornament at this cell? x, y in world units with the ceiling at y = 0.
const BAND = 1.5;                         // the top two rows: every shape hangs from a full garland, so one lucky
                                          // shot at a thin stalk can't drop the whole board
const SHAPES = {
    full: () => true,
    // a tree hanging upside down from the garland, trunk at the bottom
    tree: (x, y, rows) => y < BAND || Math.abs(x - CX) <= Math.max(0.8, 5.6 - 4.9 * (y / (rows * ROW_H))),
    v: (x, y, rows) => Math.abs(x - CX) <= 5.6 - 3.9 * (y / (rows * ROW_H)),
    stripes: (x, y) => y < BAND || Math.floor(x / 2.2) % 2 === 0,
    columns: (x, y) => y < BAND || (x % 2.75) < 1.7,
    zigzag: (x, y, rows) => y < BAND || Math.abs(x - (CX + 3.2 * Math.sin((y / (rows * ROW_H)) * Math.PI * 2.2))) < 2.4,
    arch: (x, y, rows) => y < rows * ROW_H * 0.38 || Math.abs(x - CX) > 2.4,
    diamond: (x, y, rows) => y < BAND || Math.abs(x - CX) / 5.6 + Math.abs(y - rows * ROW_H * 0.55) / (rows * ROW_H * 0.5) <= 1.02,
    heart: (x, y, rows) => {
        const s = rows * ROW_H;
        const X = (x - CX) / 4.6, Y = (s * 0.42 - y) / (s * 0.55);
        const a = X * X + Y * Y - 1;
        return a * a * a - X * X * Y * Y * Y <= 0 || y < BAND;
    },
    wreath: (x, y, rows) => {
        const cy = rows * ROW_H * 0.58, d = Math.hypot(x - CX, (y - cy) * 1.05);
        const ring = Math.min(5.4, rows * ROW_H * 0.46);
        return y < BAND || (d <= ring && d >= ring - 2.2) || (Math.abs(x - CX) < 1.6 && y < cy);
    },
    star: (x, y, rows) => {
        const cy = rows * ROW_H * 0.56, dx = x - CX, dy = y - cy;
        const ang = Math.atan2(dy, dx) + Math.PI / 2;
        const rad = Math.min(5.5, rows * ROW_H * 0.5) * (0.55 + 0.45 * Math.abs(Math.cos(2.5 * ang)));
        return y < BAND || Math.hypot(dx, dy) <= rad || (Math.abs(x - CX) < 1.6 && y < cy);
    },
    snowman: (x, y, rows) => {
        const s = rows * ROW_H;
        return y < BAND || [[0.2, 0.2], [0.48, 0.27], [0.8, 0.32]].some(([cy, r]) => Math.hypot(x - CX, y - s * cy) <= s * r);
    },
    bells: (x, y, rows) => {
        const s = rows * ROW_H;
        return y < BAND || [3, 8].some((bx) => Math.hypot((x - bx) * 1.1, y - s * 0.55) <= s * 0.48);
    },
};

// paint(r, c, x, y, rng, n, grid): a colour index 0..n-1
const noisy = (rng, n, c) => (rng() < 0.15 ? rng.int(0, n - 1) : c % n);
const PAINTS = {
    random: (r, c, x, y, rng, n) => rng.int(0, n - 1),
    clusters: (r, c, x, y, rng, n, near) => (near.length && rng() < 0.62 ? rng.pick(near) : rng.int(0, n - 1)),
    rows: (r, c, x, y, rng, n) => noisy(rng, n, Math.floor(r / 2)),
    cols: (r, c, x, y, rng, n) => noisy(rng, n, Math.floor(x / (FIELD.w / n))),
    diag: (r, c, x, y, rng, n) => noisy(rng, n, Math.floor((x + y) / 2.1)),
    rings: (r, c, x, y, rng, n) => noisy(rng, n, Math.floor(Math.hypot(x - CX, y - 3.5) / 1.6)),
    halves: (r, c, x, y, rng, n) => noisy(rng, n, (x < CX ? 0 : 1) + 2 * (Math.floor(r / 3) % 2)),
};

export const SHAPE_NAMES = Object.keys(SHAPES);
export const PAINT_NAMES = Object.keys(PAINTS);

/** Remove every ball that isn't connected to the ceiling. Returns the removed [r, c, ball] list. */
export function pruneFloating(G) {
    const seen = new Set();
    const q = [];
    for (let c = 0; c < COLS; c++) if (G.grid[0][c]) { seen.add(c); q.push([0, c]); }
    while (q.length) {
        const [r, c] = q.pop();
        for (const [a, b] of neighbors(G, r, c)) {
            const k = a * 64 + b;
            if (G.grid[a][b] && !seen.has(k)) { seen.add(k); q.push([a, b]); }
        }
    }
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (G.grid[r][c] && !seen.has(r * 64 + c)) { out.push([r, c, G.grid[r][c]]); G.grid[r][c] = null; }
    }
    return out;
}

/**
 * No colour group bigger than MAX_GROUP (smaller in the top garland rows): one lucky pop near the ceiling must not
 * drop half the board. Recolours cells of an oversized group, preferring a colour none of their neighbours has.
 */
const MAX_GROUP = 6, MAX_TOP = 4;
function sizeOf(G, r, c) {
    const col = G.grid[r][c].c;
    const out = [[r, c]], seen = new Set([r * 64 + c]);
    for (let i = 0; i < out.length; i++) {
        for (const [a, b] of neighbors(G, out[i][0], out[i][1])) {
            const n = G.grid[a][b], k = a * 64 + b;
            if (n && n.c === col && !seen.has(k)) { seen.add(k); out.push([a, b]); }
        }
    }
    return out;
}
function breakBigGroups(G, rng, n) {
    for (let pass = 0; pass < 12; pass++) {
        let changed = false;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (!G.grid[r][c]) continue;
            const g = sizeOf(G, r, c);
            const limit = g.some(([a]) => a < 2) ? MAX_TOP : MAX_GROUP;
            if (g.length <= limit) continue;
            // recolour a cell in the middle of the group
            const [a, b] = g[Math.floor(g.length / 2)];
            const near = new Set(neighbors(G, a, b).map(([x, y]) => G.grid[x][y]?.c));
            const free = [...Array(n).keys()].filter((k) => !near.has(k));
            G.grid[a][b].c = free.length ? free[Math.floor(rng() * free.length)] : (G.grid[a][b].c + 1 + Math.floor(rng() * (n - 1))) % n;
            changed = true;
        }
        if (!changed) break;
    }
}

/** Fill G.grid for a level. G must already have par = 0 and ceil = 0. */
export function buildLevel(G, def) {
    const rng = makeRng(def.seed);
    const paint = PAINTS[def.paint] || PAINTS.random;
    const shape = SHAPES[def.shape] || SHAPES.full;
    for (let r = 0; r < def.rows; r++) {
        for (let c = 0; c < rowLen(G, r); c++) {
            const x = cellX(G, r, c), y = R + r * ROW_H;
            if (!shape(x, y, def.rows)) continue;
            const near = neighbors(G, r, c).map(([a, b]) => G.grid[a][b]).filter(Boolean).map((b) => b.c);
            G.grid[r][c] = { id: G.nextId++, k: 'orn', c: paint(r, c, x, y, rng, def.colors, near) };
        }
    }
    pruneFloating(G);
    breakBigGroups(G, rng, def.colors);
    // Specials replace ornaments at random cells. Presents and bells sit in the lower half where shots reach them.
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G.grid[r][c]) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const deep = (r) => r >= Math.floor(def.rows / 2);
    // Coal never walls an ornament in: an ornament needs two neighbours that aren't coal, or nothing can ever be
    // matched against it (game-146's perfect bot lost Treasure Heaps to a corner ornament boxed in by two coals).
    const freeAround = (r, c) => neighbors(G, r, c).filter(([a, b]) => G.grid[a][b]?.k !== 'coal').length;
    const coalOk = (r, c) => {
        if (r < 2) return false;
        const saved = G.grid[r][c];
        G.grid[r][c] = { k: 'coal' };
        const ok = neighbors(G, r, c).every(([a, b]) => !G.grid[a][b] || G.grid[a][b].k === 'coal' || freeAround(a, b) >= 2);
        G.grid[r][c] = saved;
        return ok;
    };
    const take = (pred) => {
        const i = cells.findIndex(([r, c]) => G.grid[r][c].k === 'orn' && pred(r, c));
        return i < 0 ? null : cells.splice(i, 1)[0];
    };
    const order = ['gift', 'bell', 'ice', 'coal', 'prism'];
    for (const kind of order) {
        for (let n = 0; n < (def.specials[kind] || 0); n++) {
            const cell = kind === 'coal' ? take(coalOk)
                : take((r) => (kind === 'gift' || kind === 'bell' ? deep(r) : true)) || take(() => true);
            if (!cell) break;
            const [r, c] = cell, b = G.grid[r][c];
            if (kind === 'ice') G.grid[r][c] = { id: b.id, k: 'ice', c: b.c };
            else G.grid[r][c] = { id: b.id, k: kind, c: -1 };
        }
    }
}

/** A fresh top row for endless mode, from the game's own rng. */
export function endlessRow(G, n, chances) {
    const row = Array(COLS).fill(null);
    const len = rowLen(G, 0);
    for (let c = 0; c < len; c++) {
        const left = c > 0 ? row[c - 1] : null;
        const col = left && left.c >= 0 && G.rng() < 0.45 ? left.c : G.rng.int(0, n - 1);
        let k = 'orn';
        const roll = G.rng();
        let acc = 0;
        for (const [kind, p] of chances) { acc += p; if (roll < acc) { k = kind; break; } }
        row[c] = { id: G.nextId++, k, c: k === 'orn' || k === 'ice' ? col : -1 };
    }
    return row;
}
