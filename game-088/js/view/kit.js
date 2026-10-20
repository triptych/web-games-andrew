// Geometry helpers for the procedural models: a part kit that merges by material, lathes,
// variable-radius tubes, noise displacement and a few cached materials.
//
// Every model is built front-facing: +Y up, +Z toward the viewer. A Kit collects parts with a
// colour and a material kind; build() merges each material's parts into one mesh with vertex
// colours, so a whole artifact is one to three draw calls.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash3 } from '../rng.js';

const MATS = new Map();
/** Shared materials by kind. All use vertex colours; the environment map comes from scene.environment. */
export function material(kind = 'matte') {
    if (MATS.has(kind)) return MATS.get(kind);
    let m;
    const base = { vertexColors: true };
    switch (kind) {
        case 'metal': m = new THREE.MeshStandardMaterial({ ...base, metalness: 1, roughness: 0.28 }); break;
        case 'gold': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.2 }); break;
        case 'gloss': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }); break;
        case 'gem': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.05, roughness: 0.06, clearcoat: 1, iridescence: 0.5, iridescenceIOR: 1.6, flatShading: true, emissive: 0x1a0830, emissiveIntensity: 1 }); break;
        case 'pearl': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.1, roughness: 0.25, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, sheen: 1, sheenColor: new THREE.Color(0xbfe8ff) }); break;
        case 'jade': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(0xd8ffd0) }); break;
        case 'amber': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.1, clearcoat: 1, emissive: 0x6a2a00, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }); break;
        case 'glass': m = new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }); break;
        case 'glow': m = new THREE.MeshBasicMaterial({ ...base, toneMapped: false }); break;
        case 'bone': m = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 0.62 }); break;
        case 'fur': m = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 0.85 }); break;
        case 'flat': m = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 0.9, flatShading: true }); break;
        default: m = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 0.6 }); break;
    }
    MATS.set(kind, m);
    return m;
}

const tmpC = new THREE.Color();
function paint(geo, color) {
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    if (typeof color === 'function') {
        const p = geo.attributes.position;
        for (let i = 0; i < n; i++) { tmpC.set(color(p.getX(i), p.getY(i), p.getZ(i))); arr[i * 3] = tmpC.r; arr[i * 3 + 1] = tmpC.g; arr[i * 3 + 2] = tmpC.b; }
    } else {
        tmpC.set(color);
        for (let i = 0; i < n; i++) { arr[i * 3] = tmpC.r; arr[i * 3 + 1] = tmpC.g; arr[i * 3 + 2] = tmpC.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

function clean(geo) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class Kit {
    constructor() { this.parts = new Map(); }
    /**
     * Add a geometry. t = { p: [x, y, z], r: [rx, ry, rz], s: number | [sx, sy, sz] }.
     * color is a CSS colour or a function (x, y, z) → colour of the untransformed vertex.
     */
    add(geo, color, mat = 'matte', t = {}) {
        const g = clean(geo.clone());
        paint(g, color);
        const s = t.s ?? 1;
        _s.set(...(Array.isArray(s) ? s : [s, s, s]));
        _e.set(...(t.r || [0, 0, 0]));
        _q.setFromEuler(_e);
        _v.set(...(t.p || [0, 0, 0]));
        _m.compose(_v, _q, _s);
        g.applyMatrix4(_m);
        if (!this.parts.has(mat)) this.parts.set(mat, []);
        this.parts.get(mat).push(g);
        return this;
    }
    /** One mesh per material, in a group. */
    build({ shadow = true } = {}) {
        const group = new THREE.Group();
        for (const [mat, list] of this.parts) {
            const geo = mergeGeometries(list, false);
            const mesh = new THREE.Mesh(geo, material(mat));
            mesh.castShadow = shadow && mat !== 'glow' && mat !== 'glass';
            mesh.receiveShadow = shadow;
            group.add(mesh);
        }
        return group;
    }
    /** Merged geometries per material, for building once and instancing many times. */
    geometries() {
        const out = [];
        for (const [mat, list] of this.parts) out.push({ geo: mergeGeometries(list, false), mat: material(mat), kind: mat });
        return out;
    }
}

/** Instantiate cached geometries as a new group. */
export function instance(geos, shadow = true) {
    const g = new THREE.Group();
    for (const { geo, mat, kind } of geos) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = shadow && kind !== 'glow' && kind !== 'glass';
        m.receiveShadow = shadow;
        g.add(m);
    }
    return g;
}

/** Scale and centre a group so its largest side is `size`; its base sits at -size/2 * (h/max). */
export function normalize(group, size = 1) {
    const box = new THREE.Box3().setFromObject(group);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z, 1e-6);
    const c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    group.position.set(-c.x * k, -c.y * k, -c.z * k);
    group.scale.setScalar(k);
    holder.add(group);
    holder.userData.h = dim.y * k;
    holder.userData.w = dim.x * k;
    return holder;
}

// ------------------------------------------------------------------ shapes
export const lathe = (pts, segs = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)), segs);
export const sphere = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
export const box = (x, y, z, ...segs) => new THREE.BoxGeometry(x, y, z, ...segs);
export const cyl = (rt, rb, h, s = 16, ...rest) => new THREE.CylinderGeometry(rt, rb, h, s, ...rest);
export const cone = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const capsule = (r, l, cs = 6, rs = 12) => new THREE.CapsuleGeometry(r, l, cs, rs);

/** A tube along points with a radius per point. Wound so its normals face out (checked). */
export function tube(points, radii, radial = 10, closeEnds = true) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const n = Math.max(8, points.length * 6);
    const frames = curve.computeFrenetFrames(n, false);
    const pos = [], idx = [];
    const rAt = (t) => {
        const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f));
        return radii[i] + (radii[i + 1] - radii[i]) * (f - i);
    };
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = curve.getPointAt(t);
        const N = frames.normals[i], B = frames.binormals[i];
        const r = typeof radii === 'function' ? radii(t) : rAt(t);
        for (let j = 0; j < radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            pos.push(p.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z));
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
            idx.push(a, c, b, b, c, d);
        }
    }
    if (closeEnds) {
        for (const [ring, flip] of [[0, true], [n, false]]) {
            const p = curve.getPointAt(ring / n);
            const ci = pos.length / 3;
            pos.push(p.x, p.y, p.z);
            for (let j = 0; j < radial; j++) {
                const a = ring * radial + j, b = ring * radial + ((j + 1) % radial);
                if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // check the winding: the first ring's normal must point away from the curve
    const p0 = curve.getPointAt(0.5 * (1 / n));
    const v = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, radial);
    const nn = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, radial);
    if (nn.dot(v.sub(p0)) < 0) {
        const ix = geo.index.array;
        for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
        geo.computeVertexNormals();
    }
    return geo;
}

/** Push vertices along their normals by smooth hash noise. */
export function bumpy(geo, amt = 0.08, freq = 3, seed = 1) {
    const g0 = geo.clone();
    for (const k of Object.keys(g0.attributes)) if (k !== 'position') g0.deleteAttribute(k);
    const g = mergeVertices(g0, 1e-4);
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = noise3(x * freq, y * freq, z * freq, seed) * 2 - 1;
        p.setXYZ(i, x + n.getX(i) * k * amt, y + n.getY(i) * k * amt, z + n.getZ(i) * k * amt);
    }
    g.computeVertexNormals();
    return g;
}

export function noise3(x, y, z, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const s = (t) => t * t * (3 - 2 * t);
    const u = s(xf), v = s(yf), w = s(zf);
    const h = (a, b, c) => hash3(a + seed * 131, b, c);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
        l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
        l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

/** An extruded 2D outline. pts: [[x, y]...]. */
export function extrude(pts, depth = 0.1, bevel = 0.02, curveSegs = 6) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: curveSegs });
    g.translate(0, 0, -depth / 2);
    return g;
}

export function starShape(n = 5, r1 = 0.2, r2 = 0.09) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
        const r = i % 2 ? r2 : r1;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
}

/** A soft round glow texture (white), for additive halos. */
let glowTex = null;
export function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}

export function shade(hex, k) {
    const c = new THREE.Color(hex);
    if (k > 0) c.lerp(new THREE.Color(0xffffff), k); else c.lerp(new THREE.Color(0x000000), -k);
    return '#' + c.getHexString();
}

/** A flat strip along points (in XZ, width across the path), visible from both sides: palm fronds, leaves. */
export function ribbon(points, widths) {
    const pos = [], idx = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[2] - a[2];
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const w = (Array.isArray(widths) ? widths[i] : widths) / 2;
        const p = points[i];
        pos.push(p[0] - dz * w, p[1], p[2] + dx * w, p[0] + dz * w, p[1], p[2] - dx * w);
    }
    // a second copy of the vertices for the back, so each side gets its own normals
    const front = pos.length / 3;
    pos.push(...pos.slice());
    for (let i = 0; i + 1 < n; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
        idx.push(front + a, front + c, front + b, front + b, front + c, front + d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
