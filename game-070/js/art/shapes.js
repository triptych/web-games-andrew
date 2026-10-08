// Every shape in the game, as vector outlines. Flat shapes are arrays of
// polylines ([x0,y0,x1,y1,...] in logical units, facing +x, centred on the
// origin). Wireframes are { v: [[x,y,z],...], e: [[i,j],...] } and are drawn in
// true 3D. Nothing here touches three.js: the view pushes these through Beams.

import { hash01 } from '../rng.js';

const close = (p) => [...p, p[0], p[1]];

export const SHAPES = {
    ship: [
        close([-9, 4, -5, 4, -2, 2, 7, 1.2, 11, -0.8, -3, -2.4, -9, -3]),
        [0, 2.2, 4, 1.6],
    ],
    shipTrim: [[-7, 0.6, 3, 0.2], [-9, 4, -11, 5.5, -6, 4]],
    snatcher: [
        close([-6, 1, -3, 6, 3, 6, 6, 1, 6, -1, -6, -1]),
        [-5, -1, -7.5, -6], [0, -1, 0, -6.5], [5, -1, 7.5, -6],
        [-6, 1, 6, 1],
    ],
    ravager: [
        close([-7, 0, -4, 3, -5, 7, -1, 4, 0, 8, 1, 4, 5, 7, 4, 3, 7, 0, 4, -3, 5, -7, 1, -4, 0, -8, -1, -4, -5, -7, -4, -3]),
    ],
    minelayer: [
        close([-10, 0, -5, 4, 5, 4, 10, 0, 5, -3, -5, -3]),
        [-5, 4, -3, 0, 3, 0, 5, 4],
        [-10, 0, 10, 0],
    ],
    stinger: [
        close([-5, 0, 0, 3, 5, 0, 0, -3]),
        [-3, 1.8, -6, 4.5], [3, 1.8, 6, 4.5], [-3, -1.8, -6, -4.5], [3, -1.8, 6, -4.5],
    ],
    hunter: [
        close([-10, 0, -7, 2.4, -3, 3.2, 3, 3.2, 7, 2.4, 10, 0, 6, -2.4, -6, -2.4]),
        [-10, 0, 10, 0],
        [-3, 3.2, -2, 5.6, 2, 5.6, 3, 3.2],
    ],
    dart: [
        close([8, 0, -5, 5, -2, 0, -5, -5]),
    ],
    dartWing: [[-5, 5, -7, 6.5], [-5, -5, -7, -6.5], [1, 0, 4, 0]],
    colonist: [
        [0, 5.5, 0, 2.2], [0, 2.2, -1.6, 0], [0, 2.2, 1.6, 0], [-1.8, 4, 1.8, 4],
    ],
};

// ------------------------------------------------------------------ wireframes
function icosahedron() {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
        .map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); });
    const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    return { v, f, e: edgesOf(f) };
}
function edgesOf(faces) {
    const seen = new Set(), e = [];
    for (const f of faces) for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length];
        const k = a < b ? a * 1000 + b : b * 1000 + a;
        if (!seen.has(k)) { seen.add(k); e.push([a, b]); }
    }
    return e;
}

export const ICO = icosahedron();

export const OCTA = {
    v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]],
};

/** The hive: an octahedron inside a jagged cage. */
export const HIVE = (() => {
    const v = [], e = [];
    for (const p of OCTA.v) v.push(p.map((c) => c * 0.55));
    for (const [a, b] of OCTA.e) e.push([a, b]);
    const base = v.length;
    ICO.v.forEach((p) => v.push(p.map((c) => c * 1.0)));
    ICO.e.forEach(([a, b]) => e.push([a + base, b + base]));
    for (let i = 0; i < 6; i++) e.push([i, base + i * 2]);
    return { v, e };
})();

const rockCache = new Map();
/** A meteor: an icosahedron with its vertices pushed in and out by a seed. */
export function rock(seed) {
    let m = rockCache.get(seed);
    if (m) return m;
    const v = ICO.v.map((p, i) => { const k = 0.72 + hash01(seed * 31 + i) * 0.5; return p.map((c) => c * k); });
    m = { v, e: ICO.e };
    if (rockCache.size > 400) rockCache.clear();
    rockCache.set(seed, m);
    return m;
}

/** A ring of n points (for saucers and the boss rims). */
export function ringWire(n, r, y = 0) {
    const v = [], e = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * r, y, Math.sin(a) * r]); e.push([i, (i + 1) % n]); }
    return { v, e };
}

// ------------------------------------------------------------------ drawing
/** Draw flat polylines at (x,y), scaled by (sx, sy), rotated by rot. */
export function drawShape(beams, polys, x, y, sx = 1, sy = 1, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const p of polys) {
        let px = 0, py = 0;
        for (let k = 0; k < p.length; k += 2) {
            const lx = p[k] * sx, ly = p[k + 1] * sy;
            const qx = x + lx * c - ly * s, qy = y + lx * s + ly * c;
            if (k > 0) beams.seg(px, py, qx, qy);
            px = qx; py = qy;
        }
    }
}

const M = new Float32Array(9);
function rotMat(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Rz * Ry * Rx
    M[0] = cz * cy; M[1] = cz * sy * sx - sz * cx; M[2] = cz * sy * cx + sz * sx;
    M[3] = sz * cy; M[4] = sz * sy * sx + cz * cx; M[5] = sz * sy * cx - cz * sx;
    M[6] = -sy; M[7] = cy * sx; M[8] = cy * cx;
    return M;
}

const tmp = [];
/** Draw a wireframe at (x, y, z) with uniform scale and Euler rotation. `sy` squashes y. */
export function drawWire(beams, wire, x, y, z, scale, rx = 0, ry = 0, rz = 0, sy = 1) {
    const m = rotMat(rx, ry, rz);
    const v = wire.v;
    for (let i = 0; i < v.length; i++) {
        const p = v[i];
        const X = (m[0] * p[0] + m[1] * p[1] + m[2] * p[2]) * scale;
        const Y = (m[3] * p[0] + m[4] * p[1] + m[5] * p[2]) * scale * sy;
        const Z = (m[6] * p[0] + m[7] * p[1] + m[8] * p[2]) * scale;
        tmp[i * 3] = x + X; tmp[i * 3 + 1] = y + Y; tmp[i * 3 + 2] = z + Z;
    }
    for (const [a, b] of wire.e) beams.seg3(tmp[a * 3], tmp[a * 3 + 1], tmp[a * 3 + 2], tmp[b * 3], tmp[b * 3 + 1], tmp[b * 3 + 2]);
}

/** Every segment of a flat shape as [ax, ay, bx, by] in local space (for explosions). */
export function segmentsOf(polys) {
    const out = [];
    for (const p of polys) for (let k = 0; k + 3 < p.length; k += 2) out.push([p[k], p[k + 1], p[k + 2], p[k + 3]]);
    return out;
}
