/**
 * cave.js — procedural cave tunnel: an extruded circular cross-section
 * following a randomized 3D spline, carved into a hillside. Interior is
 * dressed with crystal clusters and rock spurs.
 */

import { makeMesh, addVert, addTri, mergeMesh, buildBlob } from '../engine/mesh.js';

const ROCK_COLOR = [72, 68, 66];
const CRYSTAL_COLORS = [[120, 200, 220], [180, 120, 220], [120, 220, 160]];

/**
 * Build a tunnel mesh. `path` is an array of {x,y,z} centerline points.
 * Cross-section radius can vary per point (array of same length) for a
 * organic, non-uniform tube. Triangles face inward (we want the *inside*
 * visible), so winding is intentionally flipped vs. buildCylinder.
 */
export function buildCaveTunnel(path, radii, segs = 8) {
    const m = makeMesh();
    const rings = [];
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const prev = path[i - 1] || p;
        const next = path[i + 1] || p;
        // tangent for ring orientation
        const tx = next.x - prev.x, ty = next.y - prev.y, tz = next.z - prev.z;
        const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        const fwd = [tx / tlen, ty / tlen, tz / tlen];
        // build an orthonormal basis (up-ish, right)
        let up = [0, 1, 0];
        if (Math.abs(fwd[1]) > 0.95) up = [1, 0, 0];
        const right = norm(cross(fwd, up));
        const realUp = cross(right, fwd);

        const ring = [];
        const r = radii[i];
        for (let s = 0; s < segs; s++) {
            const a = (s / segs) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            const x = p.x + (right[0] * ca + realUp[0] * sa) * r;
            const y = p.y + (right[1] * ca + realUp[1] * sa) * r;
            const z = p.z + (right[2] * ca + realUp[2] * sa) * r;
            ring.push(addVert(m, x, y, z));
        }
        rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) {
        const a = rings[i], b = rings[i + 1];
        for (let s = 0; s < segs; s++) {
            const s2 = (s + 1) % segs;
            // flipped winding so normals point inward (into the tunnel, toward camera inside)
            addTri(m, a[s], b[s2], b[s], ROCK_COLOR);
            addTri(m, a[s], a[s2], b[s2], ROCK_COLOR);
        }
    }
    return m;
}

function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function norm(a) { const l = Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }

/** Generate a randomized entry-to-chamber tunnel path from an entrance point going into the hill. */
export function generateCavePath(rng, entrance, entranceDir, length = 45, steps = 22) {
    const path = [];
    const radii = [];
    let x = entrance.x, y = entrance.y, z = entrance.z;
    let dirX = entranceDir[0], dirZ = entranceDir[1];
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        path.push({ x, y, z });
        // radius: wide mouth, narrows, then opens into a chamber near the end
        const chamberBoost = t > 0.75 ? (t - 0.75) * 4 : 0;
        radii.push(2.2 - t * 0.8 + chamberBoost * 2.5 + rng() * 0.3);
        const step = length / steps;
        x += dirX * step;
        z += dirZ * step;
        y -= step * 0.12 + rng() * 0.05; // gently descend
        // wander direction a bit
        const wander = (rng() - 0.5) * 0.5;
        const nx = dirX * Math.cos(wander) - dirZ * Math.sin(wander);
        const nz = dirX * Math.sin(wander) + dirZ * Math.cos(wander);
        const len = Math.sqrt(nx * nx + nz * nz) || 1;
        dirX = nx / len; dirZ = nz / len;
    }
    return { path, radii };
}

export function buildCrystalCluster(rng) {
    const m = makeMesh();
    const color = CRYSTAL_COLORS[Math.floor(rng() * CRYSTAL_COLORS.length)];
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
        const h = 0.3 + rng() * 0.7;
        const blob = buildBlob(h * 0.4, 0, color, 0.1, rng);
        mergeMesh(m, blob, (rng() - 0.5) * 0.6, h * 0.5, (rng() - 0.5) * 0.6);
    }
    return m;
}
