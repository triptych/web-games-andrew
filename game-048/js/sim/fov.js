/**
 * fov.js — recursive shadowcasting and the static light map.
 *
 * A tile is VISIBLE to the hero if it is in line of sight AND either inside the
 * lantern radius or lit by a static light (brazier, torch, lava, glowing decor).
 * That is what lets a lit hall be seen from across the dark.
 */

import { TP } from './tiles.js';

const MULT = [
    [1, 0, 0, -1, -1, 0, 0, 1],
    [0, 1, -1, 0, 0, -1, 1, 0],
    [0, 1, 1, 0, 0, -1, -1, 0],
    [1, 0, 0, 1, -1, 0, 0, -1],
];

/**
 * Call visit(x, y) for every tile in line of sight of (ox, oy) within radius.
 * blocks(x, y) says whether a tile stops sight (out-of-bounds must return true).
 */
export function shadowcast(ox, oy, radius, blocks, visit) {
    visit(ox, oy);
    for (let oct = 0; oct < 8; oct++) {
        castLight(ox, oy, 1, 1.0, 0.0, radius, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct], blocks, visit);
    }
}

function castLight(cx, cy, row, start, end, radius, xx, xy, yx, yy, blocks, visit) {
    if (start < end) return;
    const r2 = radius * radius + radius;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
        let dx = -j - 1;
        const dy = -j;
        let blocked = false;
        while (dx <= 0) {
            dx++;
            const X = cx + dx * xx + dy * xy;
            const Y = cy + dx * yx + dy * yy;
            const lSlope = (dx - 0.5) / (dy + 0.5);
            const rSlope = (dx + 0.5) / (dy - 0.5);
            if (start < rSlope) continue;
            if (end > lSlope) break;
            if (dx * dx + dy * dy < r2) visit(X, Y);
            const b = blocks(X, Y);
            if (blocked) {
                if (b) { newStart = rSlope; continue; }
                blocked = false;
                start = newStart;
            } else if (b && j < radius) {
                blocked = true;
                castLight(cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, blocks, visit);
                newStart = rSlope;
            }
        }
        if (blocked) break;
    }
}

export const blocksSight = (lv) => (x, y) => x < 0 || y < 0 || x >= lv.w || y >= lv.h || TP[lv.tiles[y * lv.w + x]].opaque;

/**
 * Static light: an array of 0..1 per tile. Sources come from level.lights
 * ({ x, y, r, on }) plus every lava tile (radius 2, no line of sight needed).
 */
export function computeLightMap(lv) {
    const n = lv.w * lv.h;
    const L = new Array(n).fill(0);
    const blocks = blocksSight(lv);
    for (const s of lv.lights) {
        if (!s.on) continue;
        shadowcast(s.x, s.y, s.r, blocks, (x, y) => {
            if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return;
            const d = Math.hypot(x - s.x, y - s.y);
            const v = Math.max(0, 1 - d / (s.r + 0.8));
            const i = y * lv.w + x;
            if (v > L[i]) L[i] = v;
        });
    }
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        if (lv.tiles[y * lv.w + x] !== 8) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= lv.w || Y >= lv.h) continue;
            const v = 0.75 - Math.max(Math.abs(dx), Math.abs(dy)) * 0.2;
            const i = Y * lv.w + X;
            if (v > L[i]) L[i] = v;
        }
    }
    return L;
}
