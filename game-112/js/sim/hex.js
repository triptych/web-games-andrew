// Hex grid helpers: odd-r offset coordinates (odd rows are pushed half a hex right). Pure.
//
// Direction indices are the same on every row: 0 E, 1 NE, 2 NW, 3 W, 4 SW, 5 SE.

const NB = [
    [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],    // even rows
    [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],      // odd rows
];

export const key = (c, r) => c * 16 + r;
export const unkey = (k) => [k >> 4, k & 15];

export function inBounds(B, c, r) { return c >= 0 && r >= 0 && c < B.cols && r < B.rows; }

export function neighbor(c, r, d) {
    const o = NB[r & 1][d];
    return [c + o[0], r + o[1]];
}

export function neighbors(B, c, r) {
    const out = [];
    for (let d = 0; d < 6; d++) {
        const [x, y] = neighbor(c, r, d);
        if (inBounds(B, x, y)) out.push([x, y]);
    }
    return out;
}

function cube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; }

export function dist(c1, r1, c2, r2) {
    const a = cube(c1, r1), b = cube(c2, r2);
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** The direction from one hex to an adjacent one, or -1. */
export function dirTo(c1, r1, c2, r2) {
    for (let d = 0; d < 6; d++) { const [x, y] = neighbor(c1, r1, d); if (x === c2 && y === r2) return d; }
    return -1;
}

/** World position of a hex centre (unit hex radius): x across, z down the rows. */
export function hexWorld(c, r) { return [Math.sqrt(3) * (c + 0.5 * (r & 1)), 1.5 * r]; }

/**
 * Breadth-first reach from (c, r). `free(x, y)` says whether a hex can be entered. Walkers go around
 * anything not free; flyers (fly = true) pass over everything and only need a free hex to land on.
 * Returns a Map key → { d, prev } for every hex reachable within `max` steps (the start has d 0).
 */
export function reach(B, c, r, max, free, fly = false) {
    const out = new Map([[key(c, r), { d: 0, prev: -1 }]]);
    if (fly) {
        for (let x = 0; x < B.cols; x++) for (let y = 0; y < B.rows; y++) {
            const d = dist(c, r, x, y);
            if (d > 0 && d <= max && free(x, y)) out.set(key(x, y), { d, prev: key(c, r) });
        }
        return out;
    }
    let front = [[c, r]];
    for (let step = 1; step <= max && front.length; step++) {
        const next = [];
        for (const [x, y] of front) {
            for (const [nx, ny] of neighbors(B, x, y)) {
                const k = key(nx, ny);
                if (out.has(k) || !free(nx, ny)) continue;
                out.set(k, { d: step, prev: key(x, y) });
                next.push([nx, ny]);
            }
        }
        front = next;
    }
    return out;
}

/** The path (list of [c, r], start first) to a hex in a reach map. */
export function pathTo(map, k) {
    const path = [];
    let cur = k;
    while (cur !== -1 && cur !== undefined) {
        path.push(unkey(cur));
        const n = map.get(cur);
        if (!n) break;
        cur = n.prev;
    }
    return path.reverse();
}

/** Walking distance from every hex to the nearest goal hex, through hexes `free` allows (goals count as free). */
export function distField(B, goals, free) {
    const out = new Map();
    let front = [];
    for (const [c, r] of goals) { const k = key(c, r); if (!out.has(k)) { out.set(k, 0); front.push([c, r]); } }
    for (let step = 1; front.length; step++) {
        const next = [];
        for (const [x, y] of front) {
            for (const [nx, ny] of neighbors(B, x, y)) {
                const k = key(nx, ny);
                if (out.has(k) || !free(nx, ny)) continue;
                out.set(k, step);
                next.push([nx, ny]);
            }
        }
        front = next;
    }
    return out;
}
