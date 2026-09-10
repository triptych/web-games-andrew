/**
 * sky.js — procedural sky dome (drawn as a screen-space gradient, cheap)
 * plus billboard cloud sprites rendered as flat quads facing the camera.
 * Sky gradient is drawn directly on the 2D context before the 3D pass
 * (it's the "clear" color gradient); clouds are real world-space geometry
 * so they parallax correctly and get culled/fogged like everything else.
 */

import { makeMesh, addVert, addTri, mergeMesh } from '../engine/mesh.js';

export function drawSkyGradient(ctx, width, height, topColor, bottomColor) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, `rgb(${topColor.join(',')})`);
    g.addColorStop(1, `rgb(${bottomColor.join(',')})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
}

/** A single flat-ish cloud "blob" built from overlapping horizontal quads at varying height (cheap volumetric look). */
export function buildCloud(rng) {
    const m = makeMesh();
    const color = [250, 250, 252];
    const puffs = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < puffs; i++) {
        const w = 6 + rng() * 6, d = 4 + rng() * 4, h = 1.5 + rng() * 1.5;
        const ox = (rng() - 0.5) * 8, oz = (rng() - 0.5) * 4, oy = rng() * 1.5;
        addQuadBox(m, ox, oy, oz, w, h, d, color);
    }
    return m;
}

function addQuadBox(m, cx, cy, cz, w, h, d, color) {
    const x = w / 2, y = h / 2, z = d / 2;
    const base = m.verts.length;
    addVert(m, cx - x, cy - y, cz - z);
    addVert(m, cx + x, cy - y, cz - z);
    addVert(m, cx + x, cy + y, cz + z);
    addVert(m, cx - x, cy + y, cz + z);
    addVert(m, cx - x, cy + y, cz - z);
    addVert(m, cx + x, cy + y, cz - z);
    // top + a couple side faces are enough to sell a puffy shape at distance
    addTri(m, base, base + 1, base + 5, color);
    addTri(m, base, base + 5, base + 4, color);
    addTri(m, base + 4, base + 5, base + 2, color);
    addTri(m, base + 4, base + 2, base + 3, color);
}
