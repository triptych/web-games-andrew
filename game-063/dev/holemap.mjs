// Renders every hole's surface grid to dev/shots/maps/<id>.png: surfaces coloured, shaded by slope,
// with tee, cup, colliders, pickups and monsters marked. A quick way to see a layout while authoring.
//   node game-063/dev/holemap.mjs [ids...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLES } from '../js/sim/holes.js';
import { buildCourse } from '../js/sim/course.js';
import { encodePNG } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'maps');
fs.mkdirSync(OUT, { recursive: true });
const COL = [[70, 120, 50], [110, 190, 80], [140, 230, 110], [180, 230, 140], [235, 215, 150], [60, 130, 220], [255, 90, 20], [200, 240, 255], [245, 245, 250], [160, 120, 60], [90, 80, 80], [255, 255, 255], [190, 180, 160], [40, 50, 40], [10, 10, 30], [220, 190, 120]];
const ids = process.argv.slice(2);
for (const hole of HOLES) {
    if (ids.length && !ids.includes(hole.id)) continue;
    const t0 = performance.now();
    const c = buildCourse(hole);
    const ms = performance.now() - t0;
    const step = 2; // grid cells per pixel (1 px = 1 yd)
    const W = Math.floor(c.nx / step), Hh = Math.floor(c.nz / step);
    const img = new Uint8Array(W * Hh * 4);
    const put = (px, py, r, g, b) => { if (px < 0 || py < 0 || px >= W || py >= Hh) return; const k = ((Hh - 1 - py) * W + px) * 4; img[k] = r; img[k + 1] = g; img[k + 2] = b; img[k + 3] = 255; };
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
        const i = px * step, j = py * step, k = j * c.nx + i;
        const s = c.S[k];
        const h = c.H[k], hx = c.H[Math.min(k + 1, c.H.length - 1)] - h;
        const sh = Math.max(0.55, Math.min(1.3, 1 + hx * 1.5 + h * 0.01));
        const col = COL[s] || [255, 0, 255];
        put(px, py, col[0] * sh, col[1] * sh, col[2] * sh);
    }
    const toPx = (x, z) => [Math.round((x - c.x0) / c.cell / step), Math.round((z - c.z0) / c.cell / step)];
    const dot = (x, z, r, col) => { const [px, py] = toPx(x, z); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) put(px + dx, py + dy, ...col); };
    for (const C of c.statics) dot(C.kind === 'sphere' ? C.x : C.bx, C.kind === 'sphere' ? C.z : C.bz, Math.max(1, Math.round(C.kind === 'box' ? 1 : C.r)), C.soft ? [20, 70, 20] : [60, 40, 20]);
    for (const p of c.pickups) dot(p.x, p.z, 1, p.kind === 'coin' ? [255, 220, 0] : p.kind === 'orb' ? [80, 160, 255] : [255, 80, 255]);
    for (const m of c.monsters) dot(m.x, m.z, 2, [255, 60, 60]);
    for (const g of c.geysers) dot(g.x, g.z, 2, [255, 255, 255]);
    dot(c.tee.x, c.tee.z, 2, [255, 255, 255]);
    dot(c.cup.x, c.cup.z, 2, [255, 0, 0]);
    if (hole.boss) dot(hole.boss.x, hole.boss.z, 3, [160, 0, 200]);
    fs.writeFileSync(path.join(OUT, `${hole.id}.png`), encodePNG(W, Hh, img));
    console.log(`${hole.id} ${hole.name.padEnd(18)} grid ${c.nx}x${c.nz} built in ${ms.toFixed(0)} ms  tee y=${c.tee.y.toFixed(1)} cup y=${c.cup.y.toFixed(1)} surf@cup=${c.surfAt(c.cup.x, c.cup.z)} surf@tee=${c.surfAt(c.tee.x, c.tee.z)}`);
}
