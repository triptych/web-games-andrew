/**
 * vegetation.js — procedural trees, bushes, rocks, flowers, grave markers
 * as reusable local-space meshes. Each `build*` function takes a seeded
 * rng so callers get per-instance variation while still being deterministic
 * for a given seed (chunk regeneration always looks the same).
 */

import { makeMesh, addVert, addTri, mergeMesh, buildCylinder, buildCone, buildBlob, buildBox } from '../engine/mesh.js';

const TRUNK_COLOR = [92, 66, 44];
const CANOPY_COLORS = [
    [46, 92, 42], [58, 108, 48], [40, 80, 38], [70, 116, 54],
];
const PINE_COLOR = [36, 78, 52];

/**
 * @param detail canopy subdivision level. Trees are by far the most numerous
 *   prop, so this is the main lever on scene triangle count: detail 1 gives a
 *   32-triangle canopy blob, detail 0 gives 8. Distant chunks pass 0 (see
 *   world/chunk.js) — at range the silhouette is all that survives anyway.
 */
export function buildDeciduousTree(rng, heightScale = 1, detail = 1) {
    const m = makeMesh();
    const trunkH = (2.6 + rng() * 1.6) * heightScale;
    const trunkR = 0.16 + rng() * 0.08;
    const trunkSegs = detail > 0 ? 6 : 4;
    const trunk = buildCylinder(trunkR, trunkH, trunkSegs, TRUNK_COLOR, false, true, trunkR * 0.6);
    mergeMesh(m, trunk, 0, trunkH / 2, 0);

    const canopyColor = CANOPY_COLORS[Math.floor(rng() * CANOPY_COLORS.length)];
    const blobCount = detail > 0 ? 2 + Math.floor(rng() * 2) : 1;
    for (let i = 0; i < blobCount; i++) {
        const r = (1.1 + rng() * 0.7) * heightScale;
        const blob = buildBlob(r, detail, canopyColor, 0.22, rng);
        const ox = (rng() - 0.5) * 0.8;
        const oz = (rng() - 0.5) * 0.8;
        const oy = trunkH + r * 0.55 + (rng() - 0.5) * 0.5;
        mergeMesh(m, blob, ox, oy, oz);
    }
    return m;
}

export function buildPineTree(rng, heightScale = 1) {
    const m = makeMesh();
    const trunkH = (1.2 + rng() * 0.5) * heightScale;
    const trunk = buildCylinder(0.14, trunkH, 6, TRUNK_COLOR, false, true, 0.1);
    mergeMesh(m, trunk, 0, trunkH / 2, 0);

    const tiers = 3;
    let y = trunkH * 0.7;
    for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const r = (1.3 - t * 0.75) * heightScale;
        const h = (1.6 - t * 0.4) * heightScale;
        const cone = buildCone(r, h, 7, PINE_COLOR);
        mergeMesh(m, cone, 0, y + h / 2, 0);
        y += h * 0.62;
    }
    return m;
}

export function buildBush(rng) {
    const color = [50 + rng() * 20, 96 + rng() * 20, 44 + rng() * 16];
    return buildBlob(0.5 + rng() * 0.35, 1, color, 0.28, rng);
}

export function buildRock(rng, scale = 1) {
    const g = 90 + rng() * 30;
    const color = [g, g - 6, g - 14];
    const m = buildBlob((0.4 + rng() * 0.6) * scale, 0, color, 0.35, rng);
    return m;
}

export function buildFlowerPatch(rng) {
    const m = makeMesh();
    const petalColors = [[224, 90, 120], [232, 200, 70], [220, 220, 230], [170, 90, 200]];
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        const color = petalColors[Math.floor(rng() * petalColors.length)];
        const stem = buildCylinder(0.02, 0.3, 4, [58, 100, 50], false, true, 0.02);
        const ox = (rng() - 0.5) * 0.5, oz = (rng() - 0.5) * 0.5;
        mergeMesh(m, stem, ox, 0.15, oz);
        const bloom = buildBlob(0.09, 0, color, 0.2, rng);
        mergeMesh(m, bloom, ox, 0.32, oz);
    }
    return m;
}

export function buildGraveMarker(rng) {
    const stoneColor = [128, 128, 122];
    const type = rng();
    if (type < 0.5) {
        // Rounded headstone
        const m = buildBox(0.55, 0.8, 0.12, stoneColor);
        const cap = buildBlob(0.28, 0, stoneColor, 0.1, rng);
        mergeMesh(m, cap, 0, 0.4, 0);
        return m;
    }
    // Cross marker
    const m = buildBox(0.12, 0.9, 0.1, stoneColor);
    const arm = buildBox(0.5, 0.12, 0.1, stoneColor);
    mergeMesh(m, arm, 0, 0.2, 0);
    return m;
}

export function buildHedge(len, rng) {
    const color = [44, 88, 40];
    const m = makeMesh();
    const box = buildBox(len, 0.9, 0.5, color);
    mergeMesh(m, box);
    const topBlob = buildBlob(0.4, 0, color, 0.15, rng);
    for (let x = -len / 2 + 0.3; x <= len / 2 - 0.3; x += 0.55) {
        mergeMesh(m, topBlob, x, 0.55, 0);
    }
    return m;
}

export function buildReed(rng) {
    const color = [86, 122, 58];
    return buildCylinder(0.03, 0.9 + rng() * 0.6, 4, color, true, true, 0.005);
}
