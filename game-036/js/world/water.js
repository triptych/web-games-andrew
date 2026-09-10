/**
 * water.js — ocean shell around the island + procedural streams.
 * Water is drawn as flat tinted triangles at a fixed sea level with a
 * gentle per-frame color/height pulse (cheap "shimmer", no real waves —
 * a hand-rolled CPU rasterizer can't afford per-vertex wave sim at scale).
 */

import { makeMesh, addVert, addTri } from '../engine/mesh.js';

export const SEA_LEVEL = 0;
const WATER_COLOR = [28, 78, 118];
const SHALLOW_COLOR = [72, 146, 162];

/**
 * Build the ocean as a filled disc at sea level spanning the whole world, out
 * to `outerRadius`. It's a solid disc rather than a ring around the coast for
 * two reasons: the island's own terrain simply occludes the water it sits above
 * (so the covered triangles cost nothing visually), and a ring would leave the
 * sky showing through wherever terrain dips below sea level inland — lagoons,
 * the shoreline shelf, and the low ground under the lighthouse cliff.
 *
 * The disc is banded: a shallow inner region around the coast, deep water
 * beyond, so the shoreline still reads as a beach shelf.
 */
export function buildOceanMesh(islandRadius, outerRadius, segs = 48) {
    const m = makeMesh();
    // The shelf band sits just off the coastline. It has to be a narrow ring, not
    // a wide disc: standing on the island you're *inside* whatever radius the
    // shallow colour covers, so a wide shelf means every sea view is pale teal
    // and the deep water never appears. Keeping it close to shore gives the
    // beach a turquoise fringe with proper dark ocean beyond it.
    const shelfInner = islandRadius * 0.55;
    const shelfOuter = islandRadius * 1.06;

    // Filled centre so terrain dipping below sea level inland (lagoons, the
    // shoreline shelf) shows water rather than empty background.
    const center = addVert(m, 0, SEA_LEVEL, 0);
    const inner = [];
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        inner.push(addVert(m, Math.cos(a) * shelfInner, SEA_LEVEL, Math.sin(a) * shelfInner));
    }
    // Counter-clockwise viewed from above, matching the terrain grid in chunk.js,
    // so the surface normal points up and survives the renderer's backface cull.
    for (let i = 0; i < segs; i++) {
        addTri(m, center, inner[i], inner[i + 1], SHALLOW_COLOR);
    }

    const shelf = [];
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        shelf.push(addVert(m, Math.cos(a) * shelfOuter, SEA_LEVEL, Math.sin(a) * shelfOuter));
    }
    for (let i = 0; i < segs; i++) {
        addTri(m, inner[i], shelf[i], shelf[i + 1], SHALLOW_COLOR);
        addTri(m, inner[i], shelf[i + 1], inner[i + 1], SHALLOW_COLOR);
    }

    // Deep water from the shelf edge out to the horizon.
    const deep = [];
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        deep.push(addVert(m, Math.cos(a) * outerRadius, SEA_LEVEL, Math.sin(a) * outerRadius));
    }
    for (let i = 0; i < segs; i++) {
        addTri(m, shelf[i], deep[i], deep[i + 1], WATER_COLOR);
        addTri(m, shelf[i], deep[i + 1], shelf[i + 1], WATER_COLOR);
    }
    return m;
}

/**
 * Build a stream mesh following a polyline of {x,z} points, at a height
 * slightly below surrounding terrain (caller supplies y per point, usually
 * heightmap.heightAt - small offset).
 */
export function buildStreamMesh(points, width = 1.6) {
    const m = makeMesh();
    if (points.length < 2) return m;
    let prevL = null, prevR = null;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const next = points[i + 1] || points[i - 1];
        const dx = next.x - p.x, dz = next.z - p.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len, nz = dx / len;
        const L = addVert(m, p.x + nx * width / 2, p.y, p.z + nz * width / 2);
        const R = addVert(m, p.x - nx * width / 2, p.y, p.z - nz * width / 2);
        // Streams are submitted as double-sided (world.js), since a traced path can
        // head any direction and its winding isn't known ahead of time.
        if (prevL !== null) {
            addTri(m, prevL, R, L, SHALLOW_COLOR);
            addTri(m, prevL, prevR, R, SHALLOW_COLOR);
        }
        prevL = L; prevR = R;
    }
    return m;
}

/** Simple deterministic wandering polyline generator for a stream from a highland point down toward the sea. */
export function traceStream(heightmap, startX, startZ, rng, steps = 40, step = 4) {
    const pts = [];
    let x = startX, z = startZ;
    for (let i = 0; i < steps; i++) {
        const h = heightmap.heightAt(x, z);
        // Sit slightly ABOVE the terrain, not below it. There's no depth buffer —
        // triangles are painted back-to-front by average depth — so a stream tucked
        // under the ground surface is simply overpainted by it and never appears.
        pts.push({ x, z, y: h + 0.12 });
        if (h < 0.2) break; // reached sea
        // descend toward lower neighbor (steepest descent) + a little noise
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
        let best = null, bestH = h;
        for (const [dx, dz] of dirs) {
            const hh = heightmap.heightAt(x + dx * step, z + dz * step);
            if (hh < bestH) { bestH = hh; best = [dx, dz]; }
        }
        if (!best) break;
        x += best[0] * step + (rng() - 0.5) * step * 0.4;
        z += best[1] * step + (rng() - 0.5) * step * 0.4;
    }
    return pts;
}
