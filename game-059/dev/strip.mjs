/** strip.mjs — a few frames of one character, big: node strip.mjs juno 0,20,40 [row] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeChar, PAL_W } from '../js/art/bake.js';
import { encodePNG } from './png.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [key, list, rowName = 'base'] = process.argv.slice(2);
const b = bakeChar(key);
const S = +(process.env.SCALE ?? 5);
let idx = list === 'all' ? b.frames.map((_, i) => i) : list.split(',').map((s) => isNaN(+s) ? b.anims[s].start : +s);
if (process.env.ANIMS) idx = process.env.ANIMS.split(',').flatMap((a) => { const an = b.anims[a]; return Array.from({ length: an.count }, (_, i) => an.start + i); });
const r = b.paletteRows[rowName] ?? 0;
const W = idx.length * b.cw * S, H = b.ch * S, out = new Uint8Array(W * H * 4);
idx.forEach((fi, k) => {
    const fx = (fi % b.cols) * b.cw, fy = Math.floor(fi / b.cols) * b.ch;
    for (let y = 0; y < H; y++) for (let x = 0; x < b.cw * S; x++) {
        const sx = fx + (x / S | 0), sy = fy + (y / S | 0), si = (sy * b.W + sx) * 4;
        const di = (y * W + k * b.cw * S + x) * 4;
        let c = [58, 62, 84];
        if (sy === fy + b.ay) c = [90, 60, 60];
        if (b.data[si + 3]) { const o = (r * PAL_W + b.data[si]) * 4; c = [b.palette[o], b.palette[o + 1], b.palette[o + 2]]; }
        out[di] = c[0]; out[di + 1] = c[1]; out[di + 2] = c[2]; out[di + 3] = 255;
    }
});
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'shots', `strip-${key}.png`), encodePNG(W, H, out));
