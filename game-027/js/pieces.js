/**
 * pieces.js — Polyomino shape definitions (game-plan §2 / pieces.js).
 *
 * Shapes are clusters of 1–4 connected cells (mono, domino, tromino,
 * tetromino). FIXED ORIENTATIONS — no rotation in v1 (§2, resolved open
 * question). Each shape is a list of {x, y} cell offsets normalized so the
 * top-left of the bounding box is at (0, 0).
 */

// Raw offset lists, grouped by family. Kept as plain coordinate arrays.
const RAW = {
    // 1-cell
    mono:   [[0, 0]],

    // 2-cell
    dominoH: [[0, 0], [1, 0]],
    dominoV: [[0, 0], [0, 1]],

    // 3-cell
    triI_H:  [[0, 0], [1, 0], [2, 0]],
    triI_V:  [[0, 0], [0, 1], [0, 2]],
    triL_a:  [[0, 0], [0, 1], [1, 1]],
    triL_b:  [[0, 0], [1, 0], [0, 1]],
    triL_c:  [[1, 0], [0, 1], [1, 1]],
    triL_d:  [[0, 0], [1, 0], [1, 1]],

    // 4-cell
    square:  [[0, 0], [1, 0], [0, 1], [1, 1]],
    tetI_H:  [[0, 0], [1, 0], [2, 0], [3, 0]],
    tetI_V:  [[0, 0], [0, 1], [0, 2], [0, 3]],
    tetT:    [[0, 0], [1, 0], [2, 0], [1, 1]],
    tetL:    [[0, 0], [0, 1], [0, 2], [1, 2]],
    tetJ:    [[1, 0], [1, 1], [1, 2], [0, 2]],
    tetS:    [[1, 0], [2, 0], [0, 1], [1, 1]],
    tetZ:    [[0, 0], [1, 0], [1, 1], [2, 1]],
};

function normalize(cells) {
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    return cells.map(([x, y]) => ({ x: x - minX, y: y - minY }));
}

function makeShape(id, raw) {
    const cells = normalize(raw);
    const w = Math.max(...cells.map(c => c.x)) + 1;
    const h = Math.max(...cells.map(c => c.y)) + 1;
    return { id, cells, w, h, size: cells.length };
}

// All shapes, keyed by id.
export const SHAPES = {};
for (const [id, raw] of Object.entries(RAW)) {
    SHAPES[id] = makeShape(id, raw);
}

// Convenience groupings used by the supply seeder (§4 floors/weights, Phase 1
// keeps the mix simple).
export const SHAPE_IDS  = Object.keys(SHAPES);
export const SMALL_IDS  = SHAPE_IDS.filter(id => SHAPES[id].size <= 2); // mono/domino "filler"
export const MONO_ID    = 'mono';

export function getShape(id) {
    return SHAPES[id];
}
