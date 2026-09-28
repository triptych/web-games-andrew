/**
 * art.js — illustrations that aren't scenes: the title painting and the
 * tombstone on the death page.
 */

import { makeCanvas, rng, grad, stars, ridge, pine, glow, rect, poly, circle, ellipse, mountain } from './paint.js';
import { quantize } from './palette.js';

/** Greymantle at night, the tower lit, Brackenford asleep below. */
export function paintTitle() {
    const c = makeCanvas(320, 200);
    const g = c.getContext('2d');
    const R = rng(4404);
    grad(g, 0, 0, 320, 200, [[0, '#0d0b14'], [0.45, '#1b1f3b'], [0.75, '#4a2f5a'], [1, '#7d4a78']]);
    stars(g, R, 160, 0, 0, 320, 110);
    glow(g, 262, 34, 30, '#a8c8e8', 0.15);
    circle(g, 262, 34, 11, '#f4ecd8');
    circle(g, 258, 31, 9, '#fbe7a1');
    circle(g, 266, 38, 2, '#c3c7d0');
    ridge(g, R, 150, 20, '#2b3a67', 0.5, 0, 320, 200);
    // Greymantle, with the tower on its peak
    const [px0, py0] = mountain(g, R, 160, 70, 150, 190, '#1b1f3b', '#0d0b14', '#8a90a0', '#555c6a');
    // the tower
    const ty = py0 + 2;
    rect(g, 156, ty - 22, 8, 22, '#0d0b14');
    poly(g, [[154, ty - 22], [166, ty - 22], [160, ty - 32]], '#0d0b14');
    glow(g, 160, ty - 16, 9, '#f0a878', 0.35);
    rect(g, 158, ty - 18, 4, 5, '#fbe7a1');
    // foothills + pines
    const hill = ridge(g, R, 168, 10, '#16301f', 0.55, 0, 320, 200);
    for (let i = 0; i < 26; i++) {
        const x = R() * 320;
        pine(g, x, hill(x) + 6, 16 + R() * 14, 9 + R() * 5, '#16301f', '#0d0b14');
    }
    // village lights
    rect(g, 0, 186, 320, 14, '#0d0b14');
    for (let i = 0; i < 9; i++) {
        const x = 30 + i * 30 + R() * 10;
        poly(g, [[x - 8, 190], [x + 8, 190], [x + 8, 182], [x, 175], [x - 8, 182]], '#0d0b14');
        glow(g, x, 185, 8, '#f4c542', 0.5);
        rect(g, x - 2, 183, 3, 3, '#f4c542');
    }
    quantize(c, 28);
    return c;
}

/** A small mossy headstone for the death page. */
export function tombstone() {
    const c = makeCanvas(96, 64);
    const g = c.getContext('2d');
    grad(g, 0, 0, 96, 64, [[0, '#1b1f3b'], [1, '#2b3a67']]);
    const R = rng(13);
    stars(g, R, 30, 0, 0, 96, 30);
    ellipse(g, 48, 62, 60, 12, '#16301f');
    poly(g, [[34, 56], [34, 26], [40, 18], [56, 18], [62, 26], [62, 56]], '#8a90a0');
    poly(g, [[56, 18], [62, 26], [62, 56], [58, 56]], '#555c6a');
    rect(g, 40, 30, 16, 2, '#555c6a');
    rect(g, 47, 25, 2, 12, '#555c6a');
    rect(g, 40, 42, 16, 1, '#555c6a');
    rect(g, 42, 46, 12, 1, '#555c6a');
    ellipse(g, 38, 55, 6, 3, '#3f8a3a');
    ellipse(g, 60, 56, 5, 2, '#255b33');
    for (let i = 0; i < 14; i++) rect(g, 28 + R() * 40, 54 + R() * 6, 1, 2, '#74b94a');
    quantize(c, 20);
    return c;
}
