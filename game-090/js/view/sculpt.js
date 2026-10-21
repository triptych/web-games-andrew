// Modelling kit: real meshes instead of stacked primitives. Everything here returns an indexed
// BufferGeometry with positions, smooth normals, UVs and vertex colours, ready to merge and skin.
//
//   loft(rings)      cross-sections stacked along y (bodies, limbs, boots, cones, hems)
//   tube(pts, radii) a round or flat tube swept along a curve (hair locks, horns, tails, vines)
//   ball(r…, fn)     an ellipsoid whose vertices are pushed around by fn (heads, blobs, shells)
//   deform / tint    reshape or paint an existing geometry
//   bake(list)       merge parts into one mesh geometry
//
// Rings run bottom to top; angle 0 faces +z and increases toward +x, so u = 0.5 is the back and
// u = 0 / 1 the front, and a texture's centre lands behind the model: draw fronts at the edges
// or use the planar projection helpers.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const V = THREE.Vector3;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function sgnPow(v, e) { return Math.sign(v) * Math.pow(Math.abs(v), e); }

/** Smooth the normals across the seam column and collapse the pole rings. */
function finish(geo, seg, rings) {
    geo.computeVertexNormals();
    const n = geo.attributes.normal, p = geo.attributes.position;
    const w = seg + 1;
    const avg = (ids) => {
        let x = 0, y = 0, z = 0;
        for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
        const l = Math.hypot(x, y, z) || 1;
        for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
    };
    for (let r = 0; r < rings; r++) {
        const a = r * w;
        // a ring whose points all coincide is a pole: one shared normal
        const dx = Math.abs(p.getX(a) - p.getX(a + 1)) + Math.abs(p.getZ(a) - p.getZ(a + 1));
        if (dx < 1e-5) avg(Array.from({ length: w }, (_, j) => a + j));
        else avg([a, a + seg]);
    }
    geo.userData.seg = seg; geo.userData.rings = rings;
    return geo;
}

/**
 * rings: [{ y, rx, rz, x, z, sq, wob }] bottom to top. sq is the superellipse squareness (2 is an
 * ellipse, 4 a soft box); wob(angle) → radial scale offset for ruffled hems.
 */
export function loft(rings, o = {}) {
    const seg = o.seg ?? 16;
    const pos = [], uv = [], idx = [];
    if (rings.length > 1 && rings[0].y > rings[rings.length - 1].y) rings = rings.slice().reverse();   // always bottom to top
    const n = rings.length;
    for (let i = 0; i < n; i++) {
        const R = rings[i];
        const e = R.sq ? 2 / R.sq : 1;
        for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * TAU;
            const sx = sgnPow(Math.sin(a), e), cz = sgnPow(Math.cos(a), e);
            const rad = 1 + (R.wob ? R.wob(a) : 0);
            pos.push((R.x || 0) + sx * R.rx * rad, R.y, (R.z || 0) + cz * R.rz * rad);
            uv.push(j / seg, i / (n - 1));
        }
    }
    const w = seg + 1;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
        const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
        idx.push(a, b, d, a, d, c);
    }
    if (o.caps) {
        // flat end caps on their own vertices so the edge stays crisp
        for (const [ri, up] of [[0, false], [n - 1, true]]) {
            const R = rings[ri], base = pos.length / 3;
            pos.push(R.x || 0, R.y, R.z || 0); uv.push(0.5, up ? 1 : 0);
            for (let j = 0; j <= seg; j++) { const k = (ri * w + j) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); uv.push(j / seg, up ? 1 : 0); }
            for (let j = 0; j < seg; j++) idx.push(...(up ? [base, base + 1 + j, base + 2 + j] : [base, base + 2 + j, base + 1 + j]));
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return finish(g, seg, n);
}

/** Interpolate a list of numbers (or [x,y,z]-free scalars) at t in 0..1. */
function sample(list, t) {
    if (!Array.isArray(list)) return list;
    const f = clamp(t, 0, 1) * (list.length - 1), i = Math.min(list.length - 2, Math.floor(f));
    return lerp(list[i], list[i + 1], list.length === 1 ? 0 : f - i);
}

/** A tube along a Catmull-Rom path; radii is a number or a list sampled along it; flat squashes it. */
export function tube(pts, radii, o = {}) {
    const seg = o.seg ?? 8, steps = o.n ?? 16, flat = o.flat ?? 1;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V(...p)), false, 'catmullrom', o.tension ?? 0.5);
    const fr = curve.computeFrenetFrames(steps, false);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, P = curve.getPoint(t);
        let N = fr.normals[i], B = fr.binormals[i];
        if (o.thin) {
            // a ribbon: keep the thin axis along o.thin so flat tubes face the right way on straight paths
            const T = fr.tangents[i], tv = new V(...o.thin);
            B = tv.clone().addScaledVector(T, -tv.dot(T)).normalize();
            N = new V().crossVectors(B, T);
        }
        const r = sample(radii, t);
        for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r * flat;
            pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s);
            uv.push(j / seg, t);
        }
    }
    const w = seg + 1;
    for (let i = 0; i < steps; i++) for (let j = 0; j < seg; j++) {
        const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
        idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return finish(g, seg, steps + 1);
}

/** An ellipsoid as rings (pole to pole), then reshaped by fn(x, y, z, out) in place. */
export function ball(rx, ry, rz, o = {}, fn = null) {
    const seg = o.seg ?? 20, rings = o.rings ?? 14;
    const list = [];
    for (let i = 0; i < rings; i++) {
        const th = (i / (rings - 1)) * Math.PI;
        const s = Math.sin(th), c = Math.cos(th);
        list.push({ y: -ry * c, rx: Math.max(1e-4, rx * s), rz: Math.max(1e-4, rz * s) });
    }
    const g = loft(list, { seg });
    if (fn) deform(g, fn);
    return g;
}

/** Move every vertex: fn(x, y, z, out) writes the new position into out = [x, y, z]. */
export function deform(g, fn) {
    const p = g.attributes.position, out = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
        out[0] = p.getX(i); out[1] = p.getY(i); out[2] = p.getZ(i);
        fn(out[0], out[1], out[2], out, i);
        p.setXYZ(i, out[0], out[1], out[2]);
    }
    p.needsUpdate = true;
    return finish(g, g.userData.seg, g.userData.rings);
}

export const move = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
export function xform(g, { p, r, s } = {}) {
    if (s) g.scale(...s);
    if (r) { g.rotateX(r[0] || 0); g.rotateY(r[1] || 0); g.rotateZ(r[2] || 0); }
    if (p) g.translate(...p);
    return g;
}

const _c = new THREE.Color(), _d = new THREE.Color();
/**
 * Paint vertex colours: a base colour, optionally blended to `top` up the model, shaded darker where
 * the surface faces down (a baked occlusion), with a little noise.
 */
export function tint(g, base, o = {}) {
    _c.set(base); if (o.top) _d.set(o.top);
    const p = g.attributes.position, nrm = g.attributes.normal;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < lo) lo = y; if (y > hi) hi = y; }
    const arr = new Float32Array(p.count * 3), ao = o.ao ?? 0.3;
    for (let i = 0; i < p.count; i++) {
        let r = _c.r, gg = _c.g, b = _c.b;
        if (o.top) { const t = Math.pow((p.getY(i) - lo) / Math.max(1e-6, hi - lo), o.curve ?? 1); r = lerp(r, _d.r, t); gg = lerp(gg, _d.g, t); b = lerp(b, _d.b, t); }
        const k = 1 - ao * (0.5 - nrm.getY(i) * 0.5) - (o.front ? o.front * (0.5 - nrm.getZ(i) * 0.5) * 0.5 : 0);
        const nz = o.noise ? 1 + (Math.sin(p.getX(i) * 91 + p.getY(i) * 57 + p.getZ(i) * 33) * 0.5) * o.noise : 1;
        arr[i * 3] = r * k * nz; arr[i * 3 + 1] = gg * k * nz; arr[i * 3 + 2] = b * k * nz;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
}

/** Remove triangles whose centre fails keep(x, y, z): hairlines, open sleeves. */
export function carve(g, keep) {
    const idx = g.index.array, p = g.attributes.position, out = [];
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, y = (p.getY(a) + p.getY(b) + p.getY(c)) / 3, z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
        if (keep(x, y, z)) out.push(a, b, c);
    }
    g.setIndex(out);
    return g;
}

/** Planar projection UVs: u,v from x,y over a box (for faces). */
export function planarUV(g, cx, cy, w, h) {
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - cx) / w + 0.5; uv[i * 2 + 1] = (p.getY(i) - cy) / h + 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
}

/** Merge parts into one geometry (every part gets the same attribute set). */
export function bake(list) {
    const parts = list.filter(Boolean).map((g) => {
        const q = g.index ? g.toNonIndexed() : g.clone();
        const n = q.attributes.position.count;
        if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        if (!q.attributes.color) q.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        if (!q.attributes.normal) q.computeVertexNormals();
        for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
        return q;
    });
    return mergeGeometries(parts, false);
}

/** A point on an ellipsoid shell: azimuth from +z toward +x, elevation up from the equator. */
export function onShell(rx, ry, rz, az, el, out = 1) {
    const ce = Math.cos(el);
    return [Math.sin(az) * ce * rx * out, Math.sin(el) * ry * out, Math.cos(az) * ce * rz * out];
}

/**
 * A lock of hair hugging the skull from (az0, el0) to (az1, el1), standing off the surface by a
 * rising and falling distance. Returns a flat tube.
 */
export function lock(rx, ry, rz, az0, el0, az1, el1, o = {}) {
    const n = o.pts ?? 6, pts = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const out = (o.out0 ?? 1.04) + ((o.out1 ?? 1.04) - (o.out0 ?? 1.04)) * t + (o.bump ?? 0.06) * Math.sin(t * Math.PI);
        pts.push(onShell(rx, ry, rz, lerp(az0, az1, t) + (o.swirl ?? 0) * Math.sin(t * Math.PI), lerp(el0, el1, t), out));
    }
    const w = o.w ?? 0.03;
    return tube(pts, [w * 0.55, w, w * 0.9, w * 0.55, w * 0.12], { seg: 8, n: o.n ?? 14, flat: o.flat ?? 0.5 });
}
