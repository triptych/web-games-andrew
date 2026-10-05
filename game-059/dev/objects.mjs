/** objects.mjs — dump the object/fx atlas to dev/shots/objects.png (x3). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildObjectAtlas } from '../js/art/objects.js';
import { encodePNG } from './png.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = buildObjectAtlas(); const S = 3;
const out = new Uint8Array(a.W * S * a.H * S * 4);
for (let y = 0; y < a.H * S; y++) for (let x = 0; x < a.W * S; x++) {
    const si = ((y / S | 0) * a.W + (x / S | 0)) * 4, di = (y * a.W * S + x) * 4;
    const al = a.data[si + 3] / 255;
    for (let c = 0; c < 3; c++) out[di + c] = a.data[si + c] * al + 60 * (1 - al);
    out[di + 3] = 255;
}
fs.writeFileSync(path.join(HERE, 'shots', 'objects.png'), encodePNG(a.W * S, a.H * S, out));
console.log(a.W, a.H, Object.keys(a.frames).length);
