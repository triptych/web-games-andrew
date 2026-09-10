/**
 * mesh.js — mesh data format + procedural primitive builders.
 *
 * A mesh is a plain object:
 *   { verts: [[x,y,z], ...], tris: [[i0,i1,i2,color], ...] }
 * `color` on a triangle is a base [r,g,b] that the renderer shades
 * by face-normal · light-dir (flat shading, PS1-style).
 *
 * Meshes are defined in local space; instances place them via a
 * simple {mesh, pos, rotY, scale} transform — see engine/renderer.js.
 */

export function makeMesh() { return { verts: [], tris: [] }; }

export function addVert(mesh, x, y, z) {
    mesh.verts.push([x, y, z]);
    return mesh.verts.length - 1;
}

export function addTri(mesh, a, b, c, color) {
    mesh.tris.push([a, b, c, color]);
}

/** Merge src mesh into dst mesh (used to bake props into chunk-static geometry). Optionally offset/rotate/scale. */
export function mergeMesh(dst, src, ox = 0, oy = 0, oz = 0, rotY = 0, scale = 1) {
    const base = dst.verts.length;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    for (const [x, y, z] of src.verts) {
        const rx = x * cy + z * sy;
        const rz = -x * sy + z * cy;
        dst.verts.push([rx * scale + ox, y * scale + oy, rz * scale + oz]);
    }
    for (const [a, b, c, color] of src.tris) {
        dst.tris.push([a + base, b + base, c + base, color]);
    }
}

// ---------- Primitive builders ----------

/** Axis-aligned box centered at origin, size = full width/height/depth. */
export function buildBox(w, h, d, color) {
    const m = makeMesh();
    const x = w / 2, y = h / 2, z = d / 2;
    const p = [
        [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], // back face 0-3
        [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],     // front face 4-7
    ];
    const idx = p.map(v => addVert(m, ...v));
    const faces = [
        [0, 1, 2, 3], // back
        [5, 4, 7, 6], // front
        [4, 0, 3, 7], // left
        [1, 5, 6, 2], // right
        [3, 2, 6, 7], // top
        [4, 5, 1, 0], // bottom
    ];
    for (const [a, b, c, d2] of faces) {
        addTri(m, idx[a], idx[b], idx[c], color);
        addTri(m, idx[a], idx[c], idx[d2], color);
    }
    return m;
}

/** Cylinder along Y axis, centered at origin, given radius/height and radial segment count. */
export function buildCylinder(radius, height, segs, color, capTop = true, capBottom = true, topRadius = radius) {
    const m = makeMesh();
    const y0 = -height / 2, y1 = height / 2;
    const bottom = [], top = [];
    for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        bottom.push(addVert(m, Math.cos(a) * radius, y0, Math.sin(a) * radius));
        top.push(addVert(m, Math.cos(a) * topRadius, y1, Math.sin(a) * topRadius));
    }
    for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        addTri(m, bottom[i], top[i], top[j], color);
        addTri(m, bottom[i], top[j], bottom[j], color);
    }
    if (capBottom) {
        const c = addVert(m, 0, y0, 0);
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % segs;
            addTri(m, c, bottom[j], bottom[i], color);
        }
    }
    if (capTop) {
        const c = addVert(m, 0, y1, 0);
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % segs;
            addTri(m, c, top[i], top[j], color);
        }
    }
    return m;
}

/** Cone along Y axis (apex up), base at y=-height/2, apex at y=height/2. */
export function buildCone(radius, height, segs, color) {
    return buildCylinder(radius, height, segs, color, false, true, 0.001);
}

/** Low-poly "blob" sphere-ish shape built from an octahedron subdivided `detail` times, then jittered. Used for tree canopies / rocks. */
export function buildBlob(radius, detail, color, jitter = 0.15, rng = Math.random) {
    // Start with octahedron
    let verts = [
        [0, 1, 0], [0, -1, 0],
        [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    ];
    let faces = [
        [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
        [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
    ];
    for (let d = 0; d < detail; d++) {
        const midCache = new Map();
        const newFaces = [];
        const mid = (i, j) => {
            const key = i < j ? `${i}_${j}` : `${j}_${i}`;
            if (midCache.has(key)) return midCache.get(key);
            const a = verts[i], b = verts[j];
            let v = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
            v = [v[0] / len, v[1] / len, v[2] / len];
            const idx = verts.length;
            verts.push(v);
            midCache.set(key, idx);
            return idx;
        };
        for (const [a, b, c] of faces) {
            const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
            newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        }
        faces = newFaces;
    }
    // Jitter + scale to radius
    const m = makeMesh();
    const jittered = verts.map(v => {
        const j = 1 + (rng() * 2 - 1) * jitter;
        return [v[0] * radius * j, v[1] * radius * j, v[2] * radius * j];
    });
    const idx = jittered.map(v => addVert(m, ...v));
    for (const [a, b, c] of faces) addTri(m, idx[a], idx[b], idx[c], color);
    return m;
}

/** Flat horizontal quad (two triangles), centered at origin in XZ plane. */
export function buildPlane(w, d, color) {
    const m = makeMesh();
    const x = w / 2, z = d / 2;
    const a = addVert(m, -x, 0, -z);
    const b = addVert(m, x, 0, -z);
    const c = addVert(m, x, 0, z);
    const d2 = addVert(m, -x, 0, z);
    addTri(m, a, b, c, color);
    addTri(m, a, c, d2, color);
    return m;
}

/** Compute the geometric center (average vert) — used for simple bounding-sphere culling. */
export function meshBounds(mesh) {
    let cx = 0, cy = 0, cz = 0;
    for (const v of mesh.verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
    const n = mesh.verts.length || 1;
    cx /= n; cy /= n; cz /= n;
    let r = 0;
    for (const v of mesh.verts) {
        const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r) r = d2;
    }
    return { center: [cx, cy, cz], radius: Math.sqrt(r) };
}
