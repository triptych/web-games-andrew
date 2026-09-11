/**
 * sky.js — procedural sky dome (drawn as a screen-space gradient, cheap)
 * plus billboard cloud sprites rendered as flat quads facing the camera.
 * Sky gradient is drawn directly on the 2D context before the 3D pass
 * (it's the "clear" color gradient); clouds are real world-space geometry
 * so they parallax correctly and get culled/fogged like everything else.
 */

import { makeMesh, mergeMesh, buildBlob } from '../engine/mesh.js';

export function drawSkyGradient(ctx, width, height, topColor, bottomColor) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, `rgb(${topColor.join(',')})`);
    g.addColorStop(1, `rgb(${bottomColor.join(',')})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
}

/**
 * A cloud: a few overlapping low-poly blobs.
 *
 * Clouds float 30-50 units up while the player walks at ground level, so the
 * face you actually see is the UNDERSIDE. An earlier version built each puff
 * from a top face and two sides only — cheap, but it meant looking up at a
 * cloud showed either nothing or its unlit back faces, which rendered as dark
 * grey shards against the sky. Closed blobs cost a few more triangles and are
 * lit correctly from every angle.
 *
 * They're also deliberately bright and low-contrast: `noFogFade` exempts them
 * from distance haze, so a strongly shaded cloud would keep its dark side at
 * any range and read as a storm rather than fair weather. Near-white base
 * colours mean even the least-lit face stays pale.
 */
export function buildCloud(rng) {
    const m = makeMesh();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < puffs; i++) {
        // Slight per-puff tint variation keeps a cloud from reading as one
        // smooth mass without ever going grey.
        const tint = 246 + rng() * 9;
        const color = [tint, tint, Math.min(255, tint + 3)];
        const r = 2.6 + rng() * 2.4;
        const ox = (rng() - 0.5) * 9, oz = (rng() - 0.5) * 5, oy = (rng() - 0.5) * 1.6;
        const puff = buildBlob(r, 0, color, 0.3, rng);
        // Squash vertically — cumulus are wider than they are tall.
        for (const v of puff.verts) { v[1] *= 0.55; v[0] *= 1.25; v[2] *= 1.1; }
        mergeMesh(m, puff, ox, oy, oz);
    }
    return m;
}
