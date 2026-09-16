// ============================================================
// core/grid.js - grid algorithms: shadowcast FOV, A*, flood fill
// All take callbacks so they work on chunked overworld and flat floors alike.
// ============================================================
import { DIRS8 } from './coords.js';

// ---- symmetric shadowcasting FOV -----------------------------------------
// Four quadrants, slope-bounded scans. Symmetric by construction: if you can
// see a tile, something standing on it can see you. That property is what the
// whole stealth layer rests on.

const roundTiesUp = n => Math.floor(n + 0.5);
const roundTiesDown = n => Math.ceil(n - 0.5);
const slopeOf = (row, col) => (2 * col - 1) / (2 * row);

/**
 * @pure Compute visible tiles from (ox,oy) out to `radius`.
 * `isOpaque(x,y)` -> bool; `mark(x,y)` is called once per visible tile.
 */
export function computeFOV(ox, oy, radius, isOpaque, mark) {
  mark(ox, oy);
  const r2 = radius * radius;

  for (let q = 0; q < 4; q++) {
    const tf = (row, col) => (
      q === 0 ? [ox + col, oy - row] :
      q === 1 ? [ox + col, oy + row] :
      q === 2 ? [ox + row, oy + col] :
                [ox - row, oy + col]
    );

    const scan = (row, startSlope, endSlope) => {
      if (row > radius || startSlope >= endSlope) return;
      let prevWall = null;
      let start = startSlope;
      const minCol = roundTiesUp(row * start);
      const maxCol = roundTiesDown(row * endSlope);
      for (let col = minCol; col <= maxCol; col++) {
        const [x, y] = tf(row, col);
        const wall = isOpaque(x, y);
        const symmetric = col >= row * start && col <= row * endSlope;
        if ((wall || symmetric) && row * row + col * col <= r2) mark(x, y);
        if (prevWall === true && wall === false) start = slopeOf(row, col);
        if (prevWall === false && wall === true) scan(row + 1, start, slopeOf(row, col));
        prevWall = wall;
      }
      if (prevWall === false) scan(row + 1, start, endSlope);
    };

    scan(1, -1, 1);
  }
}

// ---- Bresenham line, for line-of-sight checks ---------------------------

/** @pure Walk a line; `visit(x,y)` returning false stops it. Returns true if it ran to the end. */
export function line(x0, y0, x1, y1, visit) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (visit(x0, y0) === false) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/** @pure True if nothing opaque sits strictly between the two tiles. */
export function hasLOS(x0, y0, x1, y1, isOpaque) {
  let ok = true;
  line(x0, y0, x1, y1, (x, y) => {
    if (x === x0 && y === y0) return true;
    if (x === x1 && y === y1) return true;
    if (isOpaque(x, y)) { ok = false; return false; }
    return true;
  });
  return ok;
}

// ---- A* -----------------------------------------------------------------

/** A tiny binary heap keyed by f-score. */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node) {
    const a = this.a; a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/**
 * @pure 8-way A* with corner-cutting prohibited.
 * opts: { cost(x,y) -> number|null (null = impassable), maxNodes, allowDiagonal }
 * Returns an array of [x,y] from the first step to the goal, or null.
 */
export function astar(sx, sy, gx, gy, opts) {
  const { cost, maxNodes = 2000, allowDiagonal = true, passableGoal = true } = opts;
  if (sx === gx && sy === gy) return [];
  const open = new Heap();
  const gScore = new Map(), came = new Map();
  const key = (x, y) => x * 4096 + y;
  const h = (x, y) => Math.max(Math.abs(x - gx), Math.abs(y - gy)) * 100;

  gScore.set(key(sx, sy), 0);
  open.push({ x: sx, y: sy, f: h(sx, sy) });
  let expanded = 0;

  while (open.size && expanded < maxNodes) {
    const cur = open.pop();
    const ck = key(cur.x, cur.y);
    if (cur.x === gx && cur.y === gy) {
      const path = [];
      let k = ck, x = cur.x, y = cur.y;
      while (k !== key(sx, sy)) {
        path.push([x, y]);
        const prev = came.get(k);
        if (!prev) break;
        x = prev[0]; y = prev[1]; k = key(x, y);
      }
      return path.reverse();
    }
    expanded++;
    const g = gScore.get(ck);
    const nDirs = allowDiagonal ? 8 : 4;
    for (let i = 0; i < nDirs; i++) {
      const [dx, dy] = allowDiagonal ? DIRS8[i] : DIRS8[i * 2];
      const nx = cur.x + dx, ny = cur.y + dy;
      const isGoal = nx === gx && ny === gy;
      let c = cost(nx, ny);
      if (c === null || c === undefined) { if (!(isGoal && passableGoal)) continue; c = 100; }
      if (dx !== 0 && dy !== 0) {
        // no corner-cutting
        if (cost(cur.x + dx, cur.y) === null && cost(cur.x, cur.y + dy) === null) continue;
        c = Math.round(c * 1.4);
      }
      const nk = key(nx, ny);
      const ng = g + c;
      if (gScore.has(nk) && gScore.get(nk) <= ng) continue;
      gScore.set(nk, ng);
      came.set(nk, [cur.x, cur.y]);
      open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
    }
  }
  return null;
}

// ---- flood fill ---------------------------------------------------------

/**
 * @pure 4- or 8-way flood fill. `passable(x,y)` -> bool.
 * Returns a Set of packed keys and calls `visit(x,y)` for each tile.
 */
export function floodFill(sx, sy, passable, { diagonal = true, limit = 100000, visit = null } = {}) {
  const seen = new Set();
  const key = (x, y) => x * 4096 + y;
  if (!passable(sx, sy)) return seen;
  const stack = [[sx, sy]];
  seen.add(key(sx, sy));
  const dirs = diagonal ? DIRS8 : [[0, -1], [1, 0], [0, 1], [-1, 0]];
  while (stack.length && seen.size < limit) {
    const [x, y] = stack.pop();
    if (visit) visit(x, y);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (seen.has(k)) continue;
      if (!passable(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

/** Label connected regions of a boolean grid. Returns { labels: Int32Array, sizes: [] }. */
export function labelRegions(w, h, isOpen) {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (labels[i] !== -1 || !isOpen(x, y)) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [i];
    labels[i] = id;
    while (stack.length) {
      const j = stack.pop(); n++;
      const jx = j % w, jy = (j / w) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = jx + dx, ny = jy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nj = ny * w + nx;
        if (labels[nj] !== -1 || !isOpen(nx, ny)) continue;
        labels[nj] = id; stack.push(nj);
      }
    }
    sizes.push(n);
  }
  return { labels, sizes };
}
