// The town of Hard Hat Harbor: roads, the river, buildings and trees, as plain rectangles in metres (x east, y south).
// Pure data. The sim collides with it, the view draws it, the bot plans over it.

import { hash3 } from '../../rng.js';

export const ROADS = [
    { x: 0, y: 44, w: 128, h: 8, name: 'Main Street' },
    { x: 0, y: 12, w: 84, h: 8, name: 'Hill Road' },
    { x: 0, y: 76, w: 84, h: 8, name: 'Dock Road' },
    { x: 28, y: 12, w: 8, h: 72, name: 'North Avenue' },
    { x: 60, y: 12, w: 8, h: 72, name: 'Harbor Road' },
    { x: 106, y: 16, w: 8, h: 68, name: 'East Road' },
];

export const RIVER = { x: 84, y: 0, w: 10, h: 96 };
/** The bridge deck: the part of the river that can be driven over once the bridge job is done. */
export const BRIDGE = { x: 84, y: 44, w: 10, h: 8 };

/** Places with a name: where the dump truck loads, where things get tipped. */
export const ZONES = {
    quarry: { x: 12, y: 31, r: 4.5, name: 'the Quarry' },
    yard: { x: 20, y: 66, r: 5, name: 'the Yard' },
};

export const SPAWN = { x: 20, y: 66, a: 0 };

/**
 * Buildings. `from: job` exists once that job is done; `until: [job, step]` exists until that step of the job is done.
 * `tall` is the height the view draws, `f` the way the front door faces (0 south, 1 east, 2 north, 3 west), and kind
 * picks the look (and the Meshy model, when there is one).
 */
export const BUILDINGS = [
    { id: 'townhall', kind: 'townhall', x: 40, y: 23, w: 16, h: 13, tall: 11 },
    { id: 'school', kind: 'school', x: 70, y: 23, w: 12, h: 11, tall: 8 },
    { id: 'garage', kind: 'garage', f: 1, x: 6, y: 54, w: 10, h: 7, tall: 5 },
    { id: 'cannery', kind: 'cannery', f: 2, x: 40, y: 55, w: 16, h: 13, tall: 10, until: ['cannery', 0] },
    { id: 'bakery', kind: 'shop', f: 3, x: 70, y: 55, w: 12, h: 8, tall: 6 },
    { id: 'store', kind: 'shop', f: 3, x: 70, y: 66, w: 12, h: 8, tall: 6, hue: 1 },
    { id: 'cliff', kind: 'rock', x: 5, y: 21, w: 22, h: 4, tall: 6 },
    { id: 'barn', kind: 'barn', f: 3, x: 116, y: 22, w: 9, h: 9, tall: 8 },
    { id: 'statue', kind: 'statue', x: 47, y: 39, w: 2, h: 2, tall: 5, from: 'square' },
    { id: 'gazebo', kind: 'gazebo', x: 40, y: 66, w: 5, h: 5, tall: 4, from: 'park' },
    { id: 'home1', kind: 'house', f: 1, x: 96.5, y: 20.5, w: 7, h: 7, tall: 6, from: 'homes', hue: 0 },
    { id: 'home2', kind: 'house', f: 1, x: 96.5, y: 30.5, w: 7, h: 7, tall: 6, from: 'homes', hue: 1 },
    { id: 'home3', kind: 'house', f: 1, x: 96.5, y: 60.5, w: 7, h: 7, tall: 6, from: 'homes', hue: 2 },
    // rows of houses along the north and south edges
    ...[8, 19, 40, 51, 70].map((x, i) => ({ id: 'hn' + i, kind: 'house', x, y: 3, w: 8, h: 6, tall: 6, hue: i })),
    ...[8, 19, 40, 51, 70].map((x, i) => ({ id: 'hs' + i, kind: 'house', f: 2, x, y: 87, w: 8, h: 6, tall: 6, hue: i + 2 })),
];

export const rectHas = (r, x, y, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

/** Trees: small square obstacles on the grass, placed by hash so the town is the same every game. */
export const TREES = (() => {
    const out = [];
    // keep the work sites and the lots clear
    const keepOut = [
        { x: 4, y: 20, w: 24, h: 24 }, { x: 4, y: 52, w: 24, h: 24 }, { x: 36, y: 52, w: 24, h: 24 },
        { x: 68, y: 36, w: 16, h: 8 }, { x: 94, y: 16, w: 12, h: 60 }, { x: 114, y: 50, w: 14, h: 26 }, { x: 104, y: 20, w: 12, h: 16 },
        { x: 76, y: 40, w: 8, h: 16 },
    ];
    for (let i = 0; i < 3000 && out.length < 46; i++) {
        const x = 3 + hash3(i, 11, 5) * 122, y = 3 + hash3(i, 23, 7) * 90;
        if (ROADS.some((r) => rectHas(r, x, y, 2.5)) || rectHas(RIVER, x, y, 2)) continue;
        if (BUILDINGS.some((b) => rectHas(b, x, y, 3))) continue;
        if (keepOut.some((r) => rectHas(r, x, y, 1))) continue;
        if (out.some((t) => Math.hypot(t.x - x, t.y - y) < 5.5)) continue;
        out.push({ x: +x.toFixed(1), y: +y.toFixed(1), s: 0.8 + hash3(i, 3, 9) * 0.6 });
    }
    return out;
})();
export const TREE_HALF = 0.5;
