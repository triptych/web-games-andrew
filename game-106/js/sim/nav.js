// Robot navigation. Pure. A breadth-first flood from the player over a half-unit grid gives every
// free cell its walking distance to the player, so a robot behind a wall follows the gradient round
// it (through the doors and the gaps between posts) instead of pushing into the wall and frying.
// The grid of cells a robot's body can stand in is built once per maze and cached on the walls array.

import { FIELD } from '../config.js';
import { circleRect, segRect } from './maze.js';

const G_SIZE = 0.5;
const COLS = Math.ceil(FIELD.w / G_SIZE), ROWS = Math.ceil(FIELD.h / G_SIZE);
const CLEAR = 0.42;                     // how far from a wall a cell centre must be
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const freeCache = new WeakMap();        // walls array → Uint8Array of walkable cells

function freeCells(walls) {
    let free = freeCache.get(walls);
    if (free) return free;
    free = new Uint8Array(COLS * ROWS);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const x = (i + 0.5) * G_SIZE, y = (j + 0.5) * G_SIZE;
        free[j * COLS + i] = walls.some((w) => circleRect(x, y, CLEAR, w)) ? 0 : 1;
    }
    freeCache.set(walls, free);
    return free;
}

const cellOf = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v / G_SIZE)));

/** Walking distance (in cells) from (px, py) to every cell; -1 where it can't be reached.
 *  Returns null when the target is boxed in against a wall with no free cell nearby. */
export function flowField(walls, px, py) {
    const free = freeCells(walls);
    const ci = cellOf(px, COLS), cj = cellOf(py, ROWS);
    // the player can stand closer to a wall than a robot's clearance: start from the nearest free cell
    let start = -1;
    for (let r = 0; r <= 3 && start < 0; r++) {
        let bd = Infinity;
        for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
            if (i < 0 || j < 0 || i >= COLS || j >= ROWS || !free[j * COLS + i]) continue;
            const d = (i - ci) ** 2 + (j - cj) ** 2;
            if (d < bd) { bd = d; start = j * COLS + i; }
        }
    }
    if (start < 0) return null;
    const dist = new Int16Array(COLS * ROWS).fill(-1);
    const queue = new Int32Array(COLS * ROWS);
    let head = 0, tail = 0;
    dist[start] = 0; queue[tail++] = start;
    while (head < tail) {
        const c = queue[head++], i = c % COLS, j = (c - i) / COLS;
        for (let k = 0; k < 4; k++) {
            const ni = i + NEIGHBOURS[k][0], nj = j + NEIGHBOURS[k][1], n = nj * COLS + ni;
            if (ni < 0 || nj < 0 || ni >= COLS || nj >= ROWS || dist[n] >= 0 || !free[n]) continue;
            dist[n] = dist[c] + 1; queue[tail++] = n;
        }
    }
    return { dist, free };
}

/** Can a body of radius r go straight from a to b without touching a wall (and with a little room)? */
export function clearPath(walls, ax, ay, bx, by, r) {
    const m = r + 0.15;
    for (const w of walls) {
        if (segRect(ax, ay, bx, by, { x: w.x - m, y: w.y - m, w: w.w + 2 * m, h: w.h + 2 * m })) return false;
    }
    return true;
}

/** The unit direction a robot at (x, y) should walk to get round the walls toward the field's target,
 *  or null when it has no route (it then just heads straight for the player). */
export function flowDir(field, x, y) {
    if (!field) return null;
    const { dist, free } = field;
    const ci = cellOf(x, COLS), cj = cellOf(y, ROWS);
    let here = dist[cj * COLS + ci];
    if (here < 0) {
        // standing in a wall-hugging cell (a spawn, a knock-back): borrow the best free cell next door
        let bd = Infinity, bx = 0, by = 0;
        for (const [a, b] of NEIGHBOURS) {
            const i = ci + a, j = cj + b;
            if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
            const d = dist[j * COLS + i];
            if (d >= 0 && d < bd) { bd = d; bx = a; by = b; }
        }
        if (bd === Infinity) return null;
        const l = Math.hypot(bx, by);
        return { x: bx / l, y: by / l };
    }
    let best = here, bx = 0, by = 0;
    for (const [a, b] of NEIGHBOURS) {
        const i = ci + a, j = cj + b;
        if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
        // no cutting a corner: a diagonal step needs both cells beside it to be open
        if (a && b && !(free[cj * COLS + i] && free[j * COLS + ci])) continue;
        const d = dist[j * COLS + i];
        // diagonals count a little less than two orthogonal steps
        const score = d < 0 ? Infinity : (a && b ? d + 0.5 : d);
        if (score < best) { best = score; bx = a; by = b; }
    }
    if (!bx && !by) return null;
    // aim at the middle of the chosen cell so a robot slides along the corridor, not along its edge
    const tx = (ci + bx + 0.5) * G_SIZE, ty = (cj + by + 0.5) * G_SIZE;
    const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
}
