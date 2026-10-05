/**
 * spritesheet.mjs — bake every character in Node and write PNG sheets, so the
 * art can be reviewed without a browser.
 *
 *   node game-059/dev/spritesheet.mjs [juno,punk,...]   -> game-059/dev/shots/sheet-*.png
 *   SCALE=3 to upscale (nearest).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeChar, renderRGBA, PAL_W } from '../js/art/bake.js';
import { CHARS } from '../js/art/chars.js';
import { encodePNG } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const SCALE = +(process.env.SCALE ?? 2);
fs.mkdirSync(OUT, { recursive: true });
const keys = process.argv[2] ? process.argv[2].split(',') : Object.keys(CHARS);

function upscale(w, h, rgba, s, bg) {
    const W = w * s, H = h * s, out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const si = ((y / s | 0) * w + (x / s | 0)) * 4, di = (y * W + x) * 4;
        if (rgba[si + 3]) { out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; }
        else { out[di] = bg[0]; out[di + 1] = bg[1]; out[di + 2] = bg[2]; }
        out[di + 3] = 255;
    }
    return { W, H, out };
}

for (const key of keys) {
    const t0 = performance.now();
    const b = bakeChar(key);
    const ms = performance.now() - t0;
    const rows = Object.keys(b.paletteRows);
    for (const row of rows.slice(0, process.env.ALLROWS ? 99 : 1)) {
        const r = b.paletteRows[row];
        const rgba = new Uint8Array(b.W * b.H * 4);
        for (let i = 0; i < b.W * b.H; i++) {
            if (!b.data[i * 4 + 3]) continue;
            const v = b.data[i * 4], o = (r * PAL_W + v) * 4;
            rgba[i * 4] = b.palette[o]; rgba[i * 4 + 1] = b.palette[o + 1]; rgba[i * 4 + 2] = b.palette[o + 2]; rgba[i * 4 + 3] = 255;
        }
        // grid lines between cells
        const { W, H, out } = upscale(b.W, b.H, rgba, SCALE, [70, 74, 92]);
        for (let c = 0; c <= b.cols; c++) for (let y = 0; y < H; y++) { const x = Math.min(W - 1, c * b.cw * SCALE); const i = (y * W + x) * 4; out[i] = 30; out[i + 1] = 30; out[i + 2] = 40; }
        for (let rr = 0; rr <= b.rows; rr++) for (let x = 0; x < W; x++) { const y = Math.min(H - 1, rr * b.ch * SCALE); const i = (y * W + x) * 4; out[i] = 30; out[i + 1] = 30; out[i + 2] = 40; }
        fs.writeFileSync(path.join(OUT, `sheet-${key}${row === 'base' ? '' : '-' + row}.png`), encodePNG(W, H, out));
    }
    const p = renderRGBA(key, { scale: CHARS[key].portraitScale });
    const up = upscale(p.w, p.h, p.data, 2, [40, 30, 60]);
    fs.writeFileSync(path.join(OUT, `portrait-${key}.png`), encodePNG(up.W, up.H, up.out));
    console.log(`${key}: ${Object.keys(b.anims).length} anims, ${b.frames.length} frames, atlas ${b.W}x${b.H}, ${ms.toFixed(0)} ms`);
}
