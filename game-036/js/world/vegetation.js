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
 * @param detail LOD level, 0..2. Trees are by far the most numerous prop, so
 *   this is the main lever on scene triangle count: a whole tree costs roughly
 *   180 triangles at detail 2, 100 at detail 1 and 20 at detail 0. Chunks pick
 *   a level from their distance to the player (see world/world.js) — at range
 *   the silhouette is all that survives, so the extra faces buy nothing.
 *
 * Canopies are built from several overlapping blobs of slightly different
 * greens rather than one solid mass: with flat shading a single blob reads as a
 * smooth ball, while clustered blobs of varied tone break the outline up into
 * something that passes for foliage.
 */
export function buildDeciduousTree(rng, heightScale = 1, detail = 2) {
    const m = makeMesh();
    const trunkH = (2.6 + rng() * 1.6) * heightScale;
    const trunkR = 0.16 + rng() * 0.08;
    const trunkSegs = detail >= 2 ? 8 : (detail === 1 ? 6 : 4);
    const trunk = buildCylinder(trunkR, trunkH, trunkSegs, TRUNK_COLOR, false, true, trunkR * 0.6);
    mergeMesh(m, trunk, 0, trunkH / 2, 0);

    // A few angled limbs where the trunk meets the canopy. They are only worth
    // their triangles up close, which is exactly where the join between a bare
    // cylinder and a floating blob would otherwise be obvious.
    if (detail >= 2) {
        const branches = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < branches; i++) {
            const a = (i / branches) * Math.PI * 2 + rng() * 0.6;
            const len = (0.7 + rng() * 0.5) * heightScale;
            const limb = buildCylinder(trunkR * 0.45, len, 4, TRUNK_COLOR, false, false, trunkR * 0.22);
            const lean = 0.55 + rng() * 0.25;
            mergeMesh(m, limb,
                Math.cos(a) * len * lean * 0.5,
                trunkH * (0.72 + rng() * 0.12) + len * 0.3,
                Math.sin(a) * len * lean * 0.5,
                a);
        }
    }

    const baseColor = CANOPY_COLORS[Math.floor(rng() * CANOPY_COLORS.length)];
    const blobCount = detail >= 2 ? 3 + Math.floor(rng() * 3) : (detail === 1 ? 2 + Math.floor(rng() * 2) : 1);
    // Canopy blobs stay at subdivision 1 (32 triangles) even at full detail.
    // Subdividing to 2 quadruples that to 128 per blob, and with 3-6 blobs a
    // single tree then costs more than the entire terrain grid of the chunk it
    // stands in — for a rounder silhouette that flat shading largely hides
    // anyway. Several small jittered blobs read as foliage far better than one
    // smooth high-poly ball, so the budget goes to blob count, not tessellation.
    const blobDetail = Math.min(detail, 1);
    // Dropping blobs for LOD also drops canopy volume, which reads as the tree
    // shrinking rather than simplifying -- distant trees looked like saplings
    // next to their near-band neighbours. Grow the survivors to refill the
    // silhouette the missing blobs used to occupy, so only the outline's
    // raggedness changes with distance, not the tree's apparent size.
    // These factors are smaller than the blob-count ratio suggests because the
    // dropped blobs are offset outward: each contributed more to crown width
    // than its own radius. Solved against detail 2's mean width over 400 seeds
    // -- raising them further makes distant trees read as oversized instead.
    const crownFill = detail >= 2 ? 1 : (detail === 1 ? 1.085 : 1.26);
    for (let i = 0; i < blobCount; i++) {
        const r = (1.1 + rng() * 0.7) * heightScale * crownFill * (i === 0 ? 1 : 0.72 + rng() * 0.4);
        // Per-blob tint jitter around the tree's base green.
        const shift = (rng() - 0.5) * 18;
        const color = [
            clampByte(baseColor[0] + shift),
            clampByte(baseColor[1] + shift * 1.3),
            clampByte(baseColor[2] + shift * 0.6),
        ];
        const blob = buildBlob(r, blobDetail, color, 0.22, rng);
        const spread = i === 0 ? 0.5 : 1.5;
        const ox = (rng() - 0.5) * spread;
        const oz = (rng() - 0.5) * spread;
        const oy = trunkH + r * 0.55 + (rng() - 0.5) * 0.7;
        mergeMesh(m, blob, ox, oy, oz);
    }
    return m;
}

function clampByte(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

export function buildPineTree(rng, heightScale = 1, detail = 2) {
    const m = makeMesh();
    const trunkH = (1.2 + rng() * 0.5) * heightScale;
    const trunkSegs = detail >= 2 ? 7 : 5;
    const trunk = buildCylinder(0.14, trunkH, trunkSegs, TRUNK_COLOR, false, true, 0.1);
    mergeMesh(m, trunk, 0, trunkH / 2, 0);

    // More tiers up close gives the layered conifer profile; at distance the
    // outline of three cones is indistinguishable from five.
    const tiers = detail >= 2 ? 5 : (detail === 1 ? 4 : 3);
    const coneSegs = detail >= 2 ? 9 : (detail === 1 ? 7 : 5);
    let y = trunkH * 0.7;
    for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const r = (1.3 - t * 0.75) * heightScale;
        const h = (1.6 - t * 0.4) * heightScale;
        // Alternate tiers shade slightly differently so the stack doesn't read
        // as one smooth cone under flat shading.
        const tint = i % 2 ? 8 : -6;
        const color = [
            clampByte(PINE_COLOR[0] + tint),
            clampByte(PINE_COLOR[1] + tint),
            clampByte(PINE_COLOR[2] + tint),
        ];
        const cone = buildCone(r, h, coneSegs, color);
        mergeMesh(m, cone, 0, y + h / 2, 0);
        y += h * 0.62;
    }
    return m;
}

/**
 * A few crossed blades of grass. Individually trivial, but scattered densely
 * these are what stop the ground from reading as bare coloured triangles when
 * you look down — the single cheapest fidelity gain per triangle in the scene.
 */
export function buildGrassTuft(rng) {
    const m = makeMesh();
    const g = 70 + rng() * 40;
    const color = [g * 0.62, g + 26, g * 0.5];
    const blades = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < blades; i++) {
        const h = 0.22 + rng() * 0.34;
        const w = 0.045 + rng() * 0.035;
        const a = rng() * Math.PI * 2;
        const ox = (rng() - 0.5) * 0.34, oz = (rng() - 0.5) * 0.34;
        // Each blade is a single triangle: a wide base tapering to a point,
        // leaning off vertical. Two-sided lighting isn't available, so the lean
        // is what keeps them from disappearing edge-on.
        const base = m.verts.length;
        const lean = (rng() - 0.5) * 0.3;
        addVert(m, ox - Math.cos(a) * w, 0, oz - Math.sin(a) * w);
        addVert(m, ox + Math.cos(a) * w, 0, oz + Math.sin(a) * w);
        addVert(m, ox + lean, h, oz + lean);
        addTri(m, base, base + 1, base + 2, color);
        addTri(m, base, base + 2, base + 1, color); // reverse face so it's visible from behind
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
        // 3-sided stem with no caps: at this scale the silhouette is a line.
        const stem = buildCylinder(0.02, 0.3, 3, [58, 100, 50], false, false, 0.02);
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
