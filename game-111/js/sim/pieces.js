// The glyphs: every polyomino the hand can deal, with weights, and the arcanum each unlocks at.
// Pure data plus a few pure helpers. A glyph never rotates unless the Wheel of Fortune turns it.

/** Shapes as rows of '#'. Each entry is one fixed orientation. */
const DEFS = [
    // id, rows, weight, from (arcanum index it first appears at)
    ['dot', ['#'], 3, 0],
    ['duo-h', ['##'], 5, 0],
    ['duo-v', ['#', '#'], 5, 0],
    ['tri-h', ['###'], 6, 0],
    ['tri-v', ['#', '#', '#'], 6, 0],
    ['bend-a', ['##', '#.'], 4, 0],
    ['bend-b', ['##', '.#'], 4, 0],
    ['bend-c', ['#.', '##'], 4, 0],
    ['bend-d', ['.#', '##'], 4, 0],
    ['quad', ['##', '##'], 7, 0],
    ['line4-h', ['####'], 5, 0],
    ['line4-v', ['#', '#', '#', '#'], 5, 0],
    ['tee-u', ['###', '.#.'], 3, 0],
    ['tee-d', ['.#.', '###'], 3, 0],
    ['tee-l', ['#.', '##', '#.'], 3, 0],
    ['tee-r', ['.#', '##', '.#'], 3, 0],
    ['ell-a', ['#.', '#.', '##'], 3, 0],
    ['ell-b', ['.#', '.#', '##'], 3, 0],
    ['ell-c', ['##', '#.', '#.'], 3, 0],
    ['ell-d', ['##', '.#', '.#'], 3, 0],
    ['ell-e', ['###', '#..'], 3, 0],
    ['ell-f', ['###', '..#'], 3, 0],
    ['ell-g', ['#..', '###'], 3, 0],
    ['ell-h', ['..#', '###'], 3, 0],
    ['ess-h', ['.##', '##.'], 2, 1],
    ['zed-h', ['##.', '.##'], 2, 1],
    ['ess-v', ['#.', '##', '.#'], 2, 1],
    ['zed-v', ['.#', '##', '#.'], 2, 1],
    ['line5-h', ['#####'], 3, 3],
    ['line5-v', ['#', '#', '#', '#', '#'], 3, 3],
    ['crown-a', ['###', '#..', '#..'], 2, 3],
    ['crown-b', ['###', '..#', '..#'], 2, 3],
    ['crown-c', ['#..', '#..', '###'], 2, 3],
    ['crown-d', ['..#', '..#', '###'], 2, 3],
    ['slab-h', ['###', '###'], 3, 7],
    ['slab-v', ['##', '##', '##'], 3, 7],
    ['block', ['###', '###', '###'], 3, 7],
    ['diag-a', ['#.', '.#'], 2, 11],
    ['diag-b', ['.#', '#.'], 2, 11],
];

export const SHAPES = {};
for (const [id, rows, weight, from] of DEFS) SHAPES[id] = { id, cells: cellsOf(rows), weight, from };

function cellsOf(rows) {
    const out = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') out.push([x, y]); }));
    return out;
}

/** Bounding size of a cell list. */
export function sizeOf(cells) {
    let w = 0, h = 0;
    for (const [x, y] of cells) { if (x + 1 > w) w = x + 1; if (y + 1 > h) h = y + 1; }
    return { w, h };
}

/** Rotate a cell list 90° clockwise and shift it back to the origin. */
export function rotateCells(cells) {
    const { h } = sizeOf(cells);
    return cells.map(([x, y]) => [h - 1 - y, x]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Every shape that can be dealt at arcanum `arc`, with its weight. */
export function poolFor(arc) {
    return Object.values(SHAPES).filter((s) => s.from <= arc);
}

/** The Hermit's lantern: a single cell. */
export const LANTERN = 'dot';

export const COLORS = 7;                 // glyph colours 1..7; 8 is blight (see game.js)
