/** cast.mjs — one row per character showing a few key frames: node cast.mjs [anim1,anim2] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeChar, frameFor, PAL_W } from '../js/art/bake.js';
import { CHARS } from '../js/art/chars.js';
import { encodePNG } from './png.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const anims = (process.argv[2] || 'idle,walk,hurt,down').split(',');
const keys = (process.env.KEYS || Object.keys(CHARS).join(',')).split(',');
const S = +(process.env.SCALE ?? 2);
const baked = keys.map((k) => bakeChar(k));
const cellW = Math.max(...baked.map((b) => b.cw)), cellH = Math.max(...baked.map((b) => b.ch));
const W = anims.length * cellW * S, H = baked.length * cellH * S;
const out = new Uint8Array(W * H * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 58; out[i + 1] = 62; out[i + 2] = 84; out[i + 3] = 255; }
baked.forEach((b, row) => {
    anims.forEach((an, col) => {
        const [a, ph] = an.split(':');
        const fi = frameFor(b, a, 0.3, ph || (b.anims[a]?.phases ? 'ac' : null), 0.5);
        const fx = (fi % b.cols) * b.cw, fy = Math.floor(fi / b.cols) * b.ch;
        const ox = col * cellW * S + ((cellW - b.cw) / 2 | 0) * S, oy = row * cellH * S + (cellH - b.ch) * S;
        for (let y = 0; y < b.ch * S; y++) for (let x = 0; x < b.cw * S; x++) {
            const si = ((fy + (y / S | 0)) * b.W + fx + (x / S | 0)) * 4;
            if (!b.data[si + 3]) continue;
            const o = b.data[si] * 4, di = ((oy + y) * W + ox + x) * 4;
            out[di] = b.palette[o]; out[di + 1] = b.palette[o + 1]; out[di + 2] = b.palette[o + 2];
        }
    });
});
fs.writeFileSync(path.join(HERE, 'shots', 'cast.png'), encodePNG(W, H, out));
console.log('cast', W, H);
