/** portraits.mjs — all dialogue portraits in one sheet (x4) -> dev/shots/portraits.png */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { renderPortrait, PORTRAIT_KEYS } from '../js/art/portraits.js';
import { encodePNG } from './png.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = 3, cols = 7, cw = 72, rows = Math.ceil(PORTRAIT_KEYS.length / cols);
const W = cols * cw * S, H = rows * cw * S, out = new Uint8Array(W * H * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 40; out[i + 1] = 30; out[i + 2] = 60; out[i + 3] = 255; }
PORTRAIT_KEYS.forEach((k, n) => {
    const p = renderPortrait(k); const ox = (n % cols) * cw * S, oy = Math.floor(n / cols) * cw * S;
    for (let y = 0; y < cw * S; y++) for (let x = 0; x < cw * S; x++) { const si = ((y / S | 0) * cw + (x / S | 0)) * 4; if (!p.data[si + 3]) continue; const di = ((oy + y) * W + ox + x) * 4; out[di] = p.data[si]; out[di + 1] = p.data[si + 1]; out[di + 2] = p.data[si + 2]; }
});
fs.writeFileSync(path.join(HERE, 'shots', 'portraits.png'), encodePNG(W, H, out));
console.log(PORTRAIT_KEYS.join(' '));
