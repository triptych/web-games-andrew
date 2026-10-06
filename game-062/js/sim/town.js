// Tristrawberry: a fixed, hand-laid town (no RNG). Grass, a cross of paths, five houses,
// the cellar door (stairs to the Root Cellar), the Wishing Well (waypoints) and the stash.

import { T, makeGrid } from './tiles.js';
import { NPCS } from './data/story.js';

export const TOWN_W = 40, TOWN_H = 34;

export const BUILDINGS = [
    { id: 'granny', x: 10, y: 22, w: 6, h: 5, roof: '#c94b4b', wall: '#f3e2c4' },
    { id: 'smithy', x: 25, y: 22, w: 6, h: 5, roof: '#5b6d8a', wall: '#d8c3a0', forge: true },
    { id: 'olivia', x: 28, y: 7, w: 6, h: 5, roof: '#6f4ea0', wall: '#e6d8f0' },
    { id: 'kiwirt', x: 6, y: 7, w: 5, h: 4, roof: '#7a5a34', wall: '#cdb48a', shack: true },
    { id: 'tavern', x: 4, y: 15, w: 6, h: 5, roof: '#3f8a5a', wall: '#efe1c1' },
];

export function buildTown() {
    const g = makeGrid(TOWN_W, TOWN_H, T.GRASS);
    // Hedge / tree border.
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
        const edge = Math.min(x, y, TOWN_W - 1 - x, TOWN_H - 1 - y);
        if (edge < 2) g.set(x, y, T.SOLID);
    }
    // Ragged tree line so the edge isn't a ruler.
    const bumps = [[2, 9], [2, 10], [37, 20], [37, 21], [12, 2], [13, 2], [27, 31], [28, 31], [2, 28], [37, 6]];
    for (const [x, y] of bumps) g.set(x, y, T.SOLID);
    // Paths: a cross through the plaza, and spurs to each door.
    for (let x = 3; x <= 36; x++) for (let y = 17; y <= 18; y++) g.set(x, y, T.PATH);
    for (let y = 4; y <= 30; y++) for (let x = 19; x <= 20; x++) g.set(x, y, T.PATH);
    const spur = (x0, y0, x1, y1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.set(x, y0, T.PATH); for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.set(x1, y, T.PATH); };
    spur(19, 20, 13, 21); spur(20, 20, 27, 21); spur(20, 14, 30, 13); spur(19, 14, 9, 12); spur(10, 17, 7, 20);
    // Plaza ring.
    for (let y = 14; y <= 21; y++) for (let x = 16; x <= 23; x++) {
        const d = Math.hypot(x - 19.5, y - 17.5);
        if (d < 4.1) g.set(x, y, T.PATH);
    }
    for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g.set(x, y, T.BLOCK);

    const objs = [
        { type: 'cellar', x: 20, y: 5.2 },
        { type: 'well', x: 19.98, y: 17.5 },
        { type: 'stash', x: 23.5, y: 14.2 },
    ];
    const npcs = Object.entries(NPCS).map(([id, n]) => ({ id, x: n.pos[0] + 0.5, y: n.pos[1] + 0.5 }));
    return {
        seed: 7, floor: 0, theme: 'town', act: 0, w: TOWN_W, h: TOWN_H, t: g.t, at: g.at, rooms: [], boss: false,
        start: { x: 20, y: 7.6 }, wellSpot: { x: 18, y: 20.5 },
        objs, packs: [], npcs, buildings: BUILDINGS, exit: null,
    };
}
