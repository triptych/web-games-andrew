// Sticker sprites and scene backgrounds, baked once into small canvases. Everything the console
// draws comes from palette indices; there are no image files.

import { PAL, CELL, COLS, ROWS, ART, HEX } from '../config.js';
import { hash3 } from '../rng.js';

const cache = new Map();

/** A sticker is its art plus a one-pixel die-cut border. Returns { c, white, size } (size = ART + 2). */
export function bake(def) {
    const key = def.id + ':' + def.art.join('');
    let s = cache.get(key);
    if (s) return s;
    const N = ART + 2;
    const mk = () => { const c = document.createElement('canvas'); c.width = N; c.height = N; return c; };
    const c = mk(), w = mk();
    const x = c.getContext('2d'), wx = w.getContext('2d');
    const on = (r, q) => r >= 0 && q >= 0 && r < ART && q < ART && def.art[r][q] !== '.';
    x.fillStyle = '#f4f4f4';
    for (let r = 0; r < ART; r++) {
        for (let q = 0; q < ART; q++) {
            if (!on(r, q)) continue;
            // the border: every neighbour of a painted pixel
            x.fillRect(q + 1 - 1, r + 1 - 1, 3, 3);
        }
    }
    for (let r = 0; r < ART; r++) {
        for (let q = 0; q < ART; q++) {
            const ch = def.art[r][q];
            if (ch === '.') continue;
            x.fillStyle = PAL[HEX.indexOf(ch)];
            x.fillRect(q + 1, r + 1, 1, 1);
        }
    }
    // silhouette for hurt flashes: same shape, all white
    wx.drawImage(c, 0, 0);
    wx.globalCompositeOperation = 'source-in';
    wx.fillStyle = '#ffffff';
    wx.fillRect(0, 0, N, N);
    s = { c, white: w, size: N };
    cache.set(key, s);
    return s;
}

/** A canvas for a palette button or a list row. */
export function iconCanvas(def, px = 36) {
    const s = bake(def);
    const c = document.createElement('canvas');
    c.width = c.height = s.size;
    c.className = 'icon';
    c.style.width = c.style.height = px + 'px';
    c.getContext('2d').drawImage(s.c, 0, 0);
    return c;
}

// ------------------------------------------------------------------ backgrounds

const bgCache = new Map();

function px(x, c, fx, fy, w = 1, h = 1) { x.fillStyle = c; x.fillRect(fx, fy, w, h); }

const BG = {
    meadow(x, W, H) {
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                const h = hash3(cx, cy, 1);
                px(x, (cx + cy) % 2 ? PAL[6] : '#34ad60', cx * CELL, cy * CELL, CELL, CELL);
                const tx = cx * CELL + Math.floor(hash3(cx, cy, 2) * 8) + 2, ty = cy * CELL + Math.floor(hash3(cx, cy, 3) * 8) + 2;
                if (h < 0.28) { px(x, PAL[5], tx, ty, 1, 3); px(x, PAL[5], tx + 2, ty + 1, 1, 2); }
                else if (h < 0.34) { px(x, PAL[12], tx, ty, 2, 2); px(x, PAL[4], tx, ty, 1, 1); }
                else if (h < 0.38) { px(x, PAL[2], tx, ty, 2, 2); px(x, PAL[4], tx, ty, 1, 1); }
            }
        }
    },
    forest(x, W, H) {
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                const h = hash3(cx, cy, 5);
                px(x, (cx + cy) % 2 ? PAL[7] : '#226a73', cx * CELL, cy * CELL, CELL, CELL);
                const tx = cx * CELL + Math.floor(hash3(cx, cy, 6) * 8) + 2, ty = cy * CELL + Math.floor(hash3(cx, cy, 7) * 8) + 2;
                if (h < 0.3) { px(x, PAL[6], tx, ty, 1, 3); px(x, PAL[6], tx + 2, ty + 1, 1, 2); }
                else if (h < 0.4) { px(x, '#1d5a62', tx, ty, 3, 2); }
                else if (h < 0.43) { px(x, PAL[4], tx, ty, 1, 1); }
            }
        }
    },
    cave(x, W, H) {
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                const h = hash3(cx, cy, 9);
                px(x, (cx + cy) % 2 ? PAL[15] : '#2d354d', cx * CELL, cy * CELL, CELL, CELL);
                const tx = cx * CELL + Math.floor(hash3(cx, cy, 10) * 8) + 2, ty = cy * CELL + Math.floor(hash3(cx, cy, 11) * 8) + 2;
                if (h < 0.25) { px(x, PAL[14], tx, ty, 2, 1); px(x, PAL[14], tx + 1, ty + 1, 1, 1); }
                else if (h < 0.3) { px(x, PAL[1], tx, ty, 1, 1); }
            }
        }
        // a vignette of dark rock round the edge
        x.fillStyle = 'rgba(26,28,44,0.45)';
        x.fillRect(0, 0, W, 5); x.fillRect(0, H - 5, W, 5); x.fillRect(0, 0, 5, H); x.fillRect(W - 5, 0, 5, H);
    },
    snow(x, W, H) {
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                const h = hash3(cx, cy, 13);
                px(x, (cx + cy) % 2 ? PAL[12] : '#e3eaf0', cx * CELL, cy * CELL, CELL, CELL);
                const tx = cx * CELL + Math.floor(hash3(cx, cy, 14) * 8) + 2, ty = cy * CELL + Math.floor(hash3(cx, cy, 15) * 8) + 2;
                if (h < 0.25) { px(x, PAL[13], tx, ty, 3, 1); }
                else if (h < 0.32) { px(x, PAL[11], tx, ty, 1, 1); px(x, PAL[10], tx + 1, ty + 1, 1, 1); }
            }
        }
    },
    workshop(x, W, H) {
        // night wall of blue brick, a plum floor of planks, a red rug
        px(x, PAL[8], 0, 0, W, 4 * CELL);
        for (let r = 0; r < 8; r++) {
            for (let q = 0; q < 14; q++) {
                const off = r % 2 ? 10 : 0;
                px(x, PAL[9], q * 21 + off - 10, r * 6, 1, 6);
            }
            px(x, PAL[9], 0, r * 6, W, 1);
        }
        px(x, PAL[15], 0, 4 * CELL - 4, W, 4);
        px(x, PAL[14], 0, 4 * CELL - 4, W, 1);
        for (let cy = 4; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                px(x, (cx + cy) % 2 ? PAL[1] : '#552356', cx * CELL, cy * CELL, CELL, CELL);
            }
        }
        for (let y = 4 * CELL; y < H; y += 6) px(x, '#3c1840', 0, y, W, 1);
        // rug
        px(x, PAL[2], 6 * CELL, 7 * CELL, 12 * CELL, 5 * CELL);
        px(x, PAL[4], 6 * CELL, 7 * CELL, 12 * CELL, 1);
        px(x, PAL[4], 6 * CELL, 12 * CELL - 1, 12 * CELL, 1);
        px(x, PAL[4], 6 * CELL, 7 * CELL, 1, 5 * CELL);
        px(x, PAL[4], 18 * CELL - 1, 7 * CELL, 1, 5 * CELL);
        for (let i = 0; i < 6; i++) px(x, PAL[3], 7 * CELL + i * 20 + 8, 9 * CELL + 6, 4, 4);
    },
};

/** The scene's background as a COLS*CELL × ROWS*CELL canvas. */
export function background(theme) {
    let c = bgCache.get(theme);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = COLS * CELL; c.height = ROWS * CELL;
    (BG[theme] || BG.meadow)(c.getContext('2d'), c.width, c.height);
    bgCache.set(theme, c);
    return c;
}
