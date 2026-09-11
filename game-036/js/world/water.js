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
/**
 * @param heightmap optional. When supplied, quads whose whole footprint sits
 *   under dry land are skipped — see the note on buried water below.
 */
export function buildOceanMesh(islandRadius, outerRadius, segs = 96, heightmap = null) {
    const m = makeMesh();
    // The shelf band sits just off the coastline, giving the beach a turquoise
    // fringe with proper dark ocean beyond it.
    const shelfInner = islandRadius * 0.82;
    const shelfOuter = islandRadius * 1.06;

    // --- radial ring positions ---
    //
    // The disc is tessellated into many concentric rings rather than the three
    // it needs to show its two colours, and this is a correctness fix, not a
    // detail one. The renderer sorts by a triangle's AVERAGE depth, so a single
    // huge triangle gets one depth for its whole area. The old mesh filled the
    // island's interior with wedges running from the origin out to r=143; a
    // wedge like that is mostly buried inside terrain that rises 10-20 units
    // above sea level, but its average depth could still sort it in front of
    // the hillside, and it then painted over the terrain as a long teal spike
    // reaching up from the coast.
    //
    // Splitting the same area into small quads keeps each triangle's depth
    // close to its actual extent, so buried water sorts behind the ground that
    // covers it. Rings are spaced geometrically: fine near the viewer where
    // sorting errors are visible, coarse out at the horizon where they are not.
    const radii = [0];
    let r = 4;
    while (r < shelfInner) { radii.push(r); r *= 1.35; }
    radii.push(shelfInner, shelfOuter);
    r = shelfOuter * 1.3;
    while (r < outerRadius) { radii.push(r); r *= 1.35; }
    radii.push(outerRadius);

    // Ring 0 is the origin; build the rest as vertex loops.
    const center = addVert(m, 0, SEA_LEVEL, 0);
    const loops = [];
    for (let ri = 1; ri < radii.length; ri++) {
        const loop = [];
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            loop.push(addVert(m, Math.cos(a) * radii[ri], SEA_LEVEL, Math.sin(a) * radii[ri]));
        }
        loops.push(loop);
    }

    const colorFor = (rOuter) => (rOuter <= shelfOuter ? SHALLOW_COLOR : WATER_COLOR);

    /**
     * True when a patch of sea surface is buried under dry land and should not
     * be built at all.
     *
     * Tessellation alone is not enough to fix buried water. The renderer has no
     * depth buffer, so a water triangle sitting *inside* a hill is not hidden by
     * that hill — it is merely sorted against it, and any sorting error paints
     * sea over the hillside. Since the island rises tens of units above sea
     * level across its whole interior, the only robust answer is to omit the
     * surface wherever the ground is comfortably above it.
     *
     * The margin is generous and the test samples the patch's corners and
     * midpoints rather than one point: a quad is dropped only when ALL samples
     * are well inland, so coastlines, lagoons and the shore shelf keep their
     * water and only the deeply buried interior is removed.
     */
    const BURIED_MARGIN = 2.5;
    const buried = (r0, r1, a0, a1) => {
        if (!heightmap) return false;
        for (const rr of [r0, (r0 + r1) / 2, r1]) {
            for (const aa of [a0, (a0 + a1) / 2, a1]) {
                if (heightmap.heightAt(Math.cos(aa) * rr, Math.sin(aa) * rr) <= BURIED_MARGIN) return false;
            }
        }
        return true;
    };

    // Inner fan from the centre to the first ring. Counter-clockwise viewed from
    // above, matching the terrain grid in chunk.js, so the surface normal points
    // up and survives the renderer's backface cull.
    const first = loops[0];
    for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
        if (buried(0, radii[1], a0, a1)) continue;
        addTri(m, center, first[i], first[j], colorFor(radii[1]));
    }

    // Quad bands between successive rings.
    for (let ri = 0; ri < loops.length - 1; ri++) {
        const a = loops[ri], b = loops[ri + 1];
        const color = colorFor(radii[ri + 2]);
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % segs;
            const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
            if (buried(radii[ri + 1], radii[ri + 2], a0, a1)) continue;
            addTri(m, a[i], b[i], b[j], color);
            addTri(m, a[i], b[j], a[j], color);
        }
    }
    return m;
}

/**
 * Build a stream mesh following a polyline of {x,z,y} points.
 *
 * Two things here are dictated by the renderer having no depth buffer, only a
 * painter's sort on each triangle's AVERAGE view depth (renderer.js):
 *
 *  1. Segments are RESAMPLED to `maxSeg` (~1 terrain quad at full detail)
 *     before being ribboned. A traced path steps 4 units at a time, so a raw
 *     segment spans several ground quads; one averaged depth for that whole
 *     span sorts the quad wholly in front of or wholly behind ground it
 *     actually interpenetrates, and the ribbon gets bitten into the jagged
 *     zig-zag of teal wedges you see on a hillside. Short segments keep each
 *     triangle's depth close to its real extent, so it sorts per-quad.
 *
 *  2. Each rib's y is re-sampled from the heightmap at the rib's OWN offset
 *     position rather than inherited from the centreline. A wide ribbon across
 *     a slope has banks at quite different ground heights; using the centre
 *     height for both buries the uphill edge (overpainted, ribbon looks eaten)
 *     and floats the downhill one. Sampling per-vertex makes the ribbon drape
 *     over the terrain instead of cutting through it.
 */
export function buildStreamMesh(points, width = 1.6, heightmap = null, maxSeg = 2) {
    const m = makeMesh();
    if (points.length < 2) return m;

    // --- resample the centreline so no segment is longer than maxSeg ---
    const path = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const n = Math.max(1, Math.ceil(len / maxSeg));
        for (let k = 1; k <= n; k++) {
            const t = k / n;
            path.push({ x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t });
        }
    }

    // Ribbon the resampled path. The offset height matches traceStream's: just
    // above the ground so the painter's sort puts water over dirt, not under it.
    const LIFT = 0.12;
    let prevL = null, prevR = null;
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        // Use a centred difference for the tangent where possible: a one-sided
        // difference makes the normal swing abruptly at direction changes, which
        // pinches or crosses the ribbon over itself on the traced path's corners.
        const prev = path[i - 1] || path[i];
        const next = path[i + 1] || path[i];
        const dx = next.x - prev.x, dz = next.z - prev.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len, nz = dx / len;
        const lx = p.x + nx * width / 2, lz = p.z + nz * width / 2;
        const rx = p.x - nx * width / 2, rz = p.z - nz * width / 2;
        const ly = heightmap ? heightmap.heightAt(lx, lz) + LIFT : p.y;
        const ry = heightmap ? heightmap.heightAt(rx, rz) + LIFT : p.y;
        const L = addVert(m, lx, ly, lz);
        const R = addVert(m, rx, ry, rz);
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
