/**
 * fruit.js — every fruit is built in code. Each kind+colour becomes one
 * merged, vertex-coloured geometry, so the whole blanket shares a single
 * material. Faces (eyes, cheeks, mouth) are separate small meshes so they can
 * blink and change expression.
 *
 * Model space: body centred on the origin, radius ~0.42, front facing +z.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLOURS } from '../config.js';

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

const BROWN = 0x7a4a22;
const LEAF = 0x4caf38;
const LEAF_DARK = 0x2f8a2a;

export const fruitMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0 });
export const goldMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.35, emissive: 0xffb000, emissiveIntensity: 0.28 });
export const faceMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

function hex(id) { return COLOURS[id]?.hex ?? 0xffffff; }
function mix(a, b, t) { return _c.setHex(a).lerp(_c2.setHex(b), t).getHex(); }
function shade(a, f) { _c.setHex(a); _c.r *= f; _c.g *= f; _c.b *= f; return _c.getHex(); }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function hash3(x, y, z) {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Prepare one part: non-indexed, no uvs, transformed, vertex-coloured.
 * colour may be a hex or (x, y, z) => hex using the transformed position.
 */
function part(geo, colour, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g === geo) g = geo.clone();
    geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m.compose(_v.set(pos[0], pos[1], pos[2]), _q, new THREE.Vector3(scale[0], scale[1], scale[2]));
    g.applyMatrix4(_m);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const fn = typeof colour === 'function' ? colour : null;
    if (!fn) _c.setHex(colour);
    for (let i = 0; i < p.count; i++) {
        if (fn) _c.setHex(fn(p.getX(i), p.getY(i), p.getZ(i)));
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

const sphere = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const lathe = (pts, segs = 22) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);

function stem(y = 0.32, tilt = 0.25, len = 0.17) {
    return part(new THREE.CylinderGeometry(0.022, 0.03, len, 6), BROWN, { pos: [Math.sin(tilt) * len * 0.5, y + len * 0.42, 0], rot: [0, 0, -tilt] });
}
function leaf(x, y, z, rz = -0.6, s = 1, colour = LEAF) {
    return part(sphere(0.12, 10, 6), (px, py) => mix(colour, LEAF_DARK, clamp01(0.5 - (py - y) * 6)), { pos: [x, y, z], rot: [0.3, 0, rz], scale: [1 * s, 0.22 * s, 0.55 * s] });
}

// ------------------------------------------------------------
// Kind builders: (bodyHex, colourId) => [parts]
// ------------------------------------------------------------

const BUILD = {
    apple(b) {
        const body = lathe([[0, -0.36], [0.13, -0.38], [0.27, -0.33], [0.39, -0.19], [0.43, -0.02], [0.41, 0.15], [0.34, 0.28], [0.21, 0.35], [0.1, 0.32], [0.0, 0.25]]);
        return [
            part(body, (x, y) => mix(shade(b, 0.78), mix(b, 0xffffff, 0.08), clamp01((y + 0.36) / 0.62))),
            stem(0.25, 0.22),
            leaf(0.11, 0.37, 0.0, -0.5),
        ];
    },
    pear(b) {
        const body = lathe([[0, -0.38], [0.17, -0.38], [0.31, -0.3], [0.37, -0.14], [0.34, 0.01], [0.25, 0.13], [0.19, 0.24], [0.15, 0.33], [0.08, 0.39], [0, 0.39]]);
        return [
            part(body, (x, y, z) => mix(mix(b, 0xffd060, 0.12 * clamp01(x * 3)), shade(b, 0.8), clamp01(-(y + 0.1) * 1.6))),
            stem(0.36, 0.3, 0.14),
            leaf(0.1, 0.46, 0.02, -0.7, 0.8),
        ];
    },
    peach(b, id) {
        const blush = id === 'pink' ? 0xff3a6a : 0xff4a2a;
        return [
            part(sphere(0.4, 22, 16), (x, y) => mix(b, blush, clamp01((x + y) * 0.9 + 0.1) * 0.55), { scale: [1, 0.96, 0.95] }),
            part(new THREE.TorusGeometry(0.39, 0.012, 4, 24, Math.PI), shade(b, 0.85), { pos: [0, 0, 0], rot: [0, Math.PI / 2, 0], scale: [1, 0.96, 0.95] }),
            stem(0.34, 0.1, 0.08),
            leaf(0.12, 0.42, 0.04, -0.4, 1.0),
        ];
    },
    cherry(b) {
        const parts = [];
        const tops = [[-0.15, -0.12, 0.06, 0.21], [0.16, -0.17, -0.06, 0.19]];
        for (const [x, y, z, r] of tops) {
            parts.push(part(sphere(r, 18, 12), (px, py) => mix(shade(b, 0.75), mix(b, 0xffffff, 0.1), clamp01((py - y + r) / (2 * r))), { pos: [x, y, z] }));
            const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y + r * 0.8, z), new THREE.Vector3(x * 0.4, 0.25, z * 0.5), new THREE.Vector3(0.02, 0.4, 0));
            parts.push(part(new THREE.TubeGeometry(curve, 8, 0.016, 5, false), 0x6a8a2a));
        }
        parts.push(leaf(0.12, 0.42, 0.0, -0.5, 0.9));
        return parts;
    },
    strawberry(b) {
        const prof = [[0, -0.4], [0.1, -0.35], [0.22, -0.21], [0.32, -0.03], [0.36, 0.12], [0.33, 0.24], [0.2, 0.3], [0, 0.31]];
        const parts = [part(lathe(prof, 20), (x, y) => mix(shade(b, 0.82), mix(b, 0xffffff, 0.06), clamp01((y + 0.4) / 0.7)))];
        // Seeds sit on the surface: radius from the profile at each height.
        const radiusAt = (y) => {
            for (let i = 1; i < prof.length; i++) {
                if (y <= prof[i][1]) { const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t; }
            }
            return 0;
        };
        for (let i = 0; i < 16; i++) {
            const y = -0.3 + (i % 4) * 0.13 + 0.03;
            const a = i * 2.4 + (i % 2) * 0.4;
            const r = radiusAt(y) + 0.005;
            parts.push(part(sphere(0.022, 5, 4), 0xffe36a, { pos: [Math.sin(a) * r, y, Math.cos(a) * r], scale: [1, 1.4, 1] }));
        }
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            parts.push(part(new THREE.ConeGeometry(0.06, 0.2, 4), LEAF, { pos: [Math.sin(a) * 0.1, 0.31, Math.cos(a) * 0.1], rot: [Math.cos(a) * 1.7, 0, -Math.sin(a) * 1.7], scale: [1, 1, 0.35] }));
        }
        parts.push(part(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 5), 0x5a9a2a, { pos: [0, 0.37, 0] }));
        return parts;
    },
    blueberry(b) {
        const parts = [];
        const berries = [[0, -0.03, 0.08, 0.24], [-0.25, -0.12, -0.05, 0.18], [0.25, -0.12, -0.05, 0.18], [0, 0.12, -0.16, 0.17]];
        for (const [x, y, z, r] of berries) {
            parts.push(part(sphere(r, 16, 12), (px, py) => mix(shade(b, 0.7), mix(b, 0xc8d4ff, 0.35), clamp01((py - y + r) / (2 * r))), { pos: [x, y, z] }));
            parts.push(part(new THREE.CylinderGeometry(r * 0.3, r * 0.22, 0.03, 6), shade(b, 0.45), { pos: [x, y + r * 0.96, z] }));
        }
        return parts;
    },
    grape(b) {
        const parts = [];
        const rows = [[0.24, 4], [0.08, 3], [-0.08, 3], [-0.23, 2], [-0.36, 1]];
        for (const [y, n] of rows) {
            for (let i = 0; i < n; i++) {
                const x = (i - (n - 1) / 2) * 0.17;
                const z = 0.08 + (i % 2) * 0.03;
                parts.push(part(sphere(0.115, 12, 9), (px, py) => mix(shade(b, 0.72), mix(b, 0xffffff, 0.15), clamp01((py - y + 0.11) / 0.22)), { pos: [x, y, z] }));
                if (n > 1) parts.push(part(sphere(0.11, 10, 8), shade(b, 0.8), { pos: [x * 0.8, y + 0.04, -0.1] }));
            }
        }
        parts.push(part(new THREE.CylinderGeometry(0.02, 0.025, 0.16, 5), 0x6a5a2a, { pos: [0, 0.4, 0], rot: [0, 0, 0.2] }));
        parts.push(part(sphere(0.17, 10, 6), LEAF, { pos: [0.14, 0.4, 0], rot: [0.2, 0, -0.5], scale: [1, 0.2, 0.75] }));
        return parts;
    },
    raspberry(b) {
        const parts = [part(sphere(0.3, 14, 10), shade(b, 0.75), { scale: [1, 1.05, 1] })];
        const ico = new THREE.IcosahedronGeometry(0.31, 1);
        const p = ico.attributes.position;
        const seen = new Set();
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
            if (seen.has(k) || y < -0.25) continue;
            seen.add(k);
            parts.push(part(sphere(0.085, 7, 5), (px, py) => mix(shade(b, 0.82), mix(b, 0xffffff, 0.18), clamp01((py + 0.3) / 0.6)), { pos: [x, y * 1.05, z] }));
        }
        ico.dispose();
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            parts.push(part(new THREE.ConeGeometry(0.05, 0.16, 4), LEAF, { pos: [Math.sin(a) * 0.07, 0.34, Math.cos(a) * 0.07], rot: [Math.cos(a) * 1.6, 0, -Math.sin(a) * 1.6], scale: [1, 1, 0.35] }));
        }
        return parts;
    },
    orange(b) {
        const g = sphere(0.41, 26, 18);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const d = 1 + (hash3(x * 9, y * 9, z * 9) - 0.5) * 0.025;
            p.setXYZ(i, x * d, y * d * 0.96, z * d);
        }
        return [
            part(g, (x, y, z) => mix(mix(shade(b, 0.82), mix(b, 0xffffff, 0.08), clamp01((y + 0.4) / 0.8)), shade(b, 0.9), hash3(x * 30, y * 30, z * 30) > 0.8 ? 0.6 : 0)),
            part(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6), 0x5a8a2a, { pos: [0, 0.395, 0] }),
            leaf(0.12, 0.41, 0.02, -0.4, 1.1),
        ];
    },
    lemon(b) {
        const body = lathe([[0, -0.46], [0.05, -0.42], [0.18, -0.33], [0.28, -0.18], [0.31, 0], [0.28, 0.18], [0.18, 0.33], [0.05, 0.42], [0, 0.46]], 22);
        return [
            part(body, (x, y) => mix(shade(b, 0.82), mix(b, 0xffffff, 0.12), clamp01((y + 0.3) / 0.6)), { rot: [0, 0, Math.PI / 2 - 0.12] }),
            leaf(0.32, 0.17, 0.02, -0.9, 0.85),
        ];
    },
    lime(b) {
        return [
            part(sphere(0.35, 22, 16), (x, y, z) => mix(mix(shade(b, 0.62), shade(b, 0.92), clamp01((y + 0.35) / 0.7)), shade(b, 0.55), hash3(x * 30, y * 30, z * 30) > 0.82 ? 0.5 : 0), { scale: [1.08, 1, 1] }),
            part(new THREE.CylinderGeometry(0.035, 0.05, 0.05, 6), shade(b, 0.5), { pos: [0.37, 0.02, 0], rot: [0, 0, Math.PI / 2] }),
        ];
    },
    grapefruit(b, id) {
        const flesh = id === 'pink' ? [0xff6a8e, 0xff9ab4] : [0xffd84a, 0xfff09a];
        const rind = id === 'pink' ? 0xffb08a : 0xffe680;
        const parts = [
            part(new THREE.SphereGeometry(0.4, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => mix(rind, shade(rind, 0.82), clamp01(-z * 1.5)), { rot: [-Math.PI / 2, 0, 0] }),
            part(new THREE.RingGeometry(0.33, 0.4, 32, 1), 0xfff8e8, { pos: [0, 0, 0.002] }),
        ];
        const n = 10;
        for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2 + 0.03, len = (Math.PI * 2) / n - 0.06;
            parts.push(part(new THREE.CircleGeometry(0.315, 4, a0, len), i % 2 ? flesh[0] : flesh[1], { pos: [0, 0, 0.004] }));
        }
        parts.push(part(new THREE.CircleGeometry(0.04, 10), 0xfff8e8, { pos: [0, 0, 0.006] }));
        return parts;
    },
    banana(b) {
        const N = 22, S = 9, R = 0.6;
        const pos = [], col = [], idx = [];
        const tip = 0x5a3a1a;
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const a = -0.85 + 1.7 * t;
            const cx = R * Math.sin(a), cy = R * (1 - Math.cos(a)) - 0.16;
            const nx = -Math.sin(a), ny = Math.cos(a);
            const r = 0.17 * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.025;
            for (let j = 0; j <= S; j++) {
                const th = (j / S) * Math.PI * 2;
                const ridge = 1 + 0.06 * Math.cos(th * 5);
                const ox = Math.cos(th) * r * ridge, oz = Math.sin(th) * r * ridge * 1.05;
                pos.push(cx + nx * ox, cy + ny * ox, oz);
                const edge = Math.min(t, 1 - t);
                _c.setHex(edge < 0.05 ? tip : mix(b, shade(b, 0.82), clamp01(-Math.cos(th) * 0.8)));
                col.push(_c.r, _c.g, _c.b);
            }
        }
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < S; j++) {
                const a = i * (S + 1) + j, b2 = a + S + 1;
                idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const body = g.toNonIndexed();
        g.dispose();
        const a1 = 0.85;
        return [
            body,
            part(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6), 0x7a6a2a, { pos: [R * Math.sin(a1) + 0.03, R * (1 - Math.cos(a1)) - 0.12, 0], rot: [0, 0, -0.6] }),
        ];
    },
    pineapple(b) {
        const g = sphere(0.32, 28, 20);
        return [
            part(g, (x, y, z) => {
                const u = (Math.atan2(z, x) / (Math.PI * 2)) * 9, v = y * 7;
                const f1 = (u + v) - Math.floor(u + v), f2 = (u - v) - Math.floor(u - v);
                const line = f1 < 0.14 || f2 < 0.14;
                const base = mix(shade(b, 0.78), mix(b, 0xffffff, 0.05), clamp01((y + 0.35) / 0.7));
                return line ? mix(base, 0x9a6a1a, 0.55) : base;
            }, { pos: [0, -0.06, 0], scale: [1, 1.18, 1] }),
            ...[0, 1, 2, 3, 4, 5, 6].map(i => {
                const a = (i / 7) * Math.PI * 2;
                const lean = i === 0 ? 0 : 0.5;
                return part(new THREE.ConeGeometry(0.055, 0.3, 4), (x, y) => mix(LEAF_DARK, 0x7ad04a, clamp01((y - 0.3) * 4)), { pos: [Math.sin(a) * 0.05 * (i ? 1 : 0), 0.43, Math.cos(a) * 0.05 * (i ? 1 : 0)], rot: [Math.cos(a) * lean, 0, -Math.sin(a) * lean], scale: [1, 1, 0.4] });
            }),
        ];
    },
    mango(b, id) {
        const blush = id === 'red' ? 0xffb030 : 0xff4a3a;
        return [
            part(sphere(0.38, 22, 16), (x, y) => mix(b, blush, clamp01(y * 1.5 + x * 0.6) * 0.5), { rot: [0, 0, 0.35], scale: [1.12, 0.9, 0.82] }),
            stem(0.3, 0.5, 0.08),
            leaf(0.2, 0.35, 0.02, -0.3, 1.0),
        ];
    },
    dragonfruit(b) {
        const parts = [part(sphere(0.33, 20, 16), (x, y) => mix(shade(b, 0.8), mix(b, 0xffffff, 0.08), clamp01((y + 0.35) / 0.7)), { scale: [0.98, 1.15, 0.98] })];
        const tipCol = 0x6acd3a;
        for (let i = 0; i < 12; i++) {
            const a = i * 2.39996;
            const y = -0.22 + (i % 4) * 0.13;
            const rr = Math.sqrt(Math.max(0, 1 - (y / 0.38) ** 2)) * 0.32;
            parts.push(part(new THREE.ConeGeometry(0.075, 0.22, 4), (x, py) => mix(b, tipCol, clamp01((py - y) * 7)),
                { pos: [Math.sin(a) * rr, y + 0.05, Math.cos(a) * rr], rot: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], scale: [1, 1, 0.35] }));
        }
        parts.push(part(new THREE.ConeGeometry(0.07, 0.18, 4), tipCol, { pos: [0, 0.43, 0], scale: [1, 1, 0.5] }));
        return parts;
    },
};

/** Where the face sits on each kind: [x, y, z, scale]. */
export const FACE = {
    apple: [0, -0.01, 0.42, 1], pear: [0, -0.13, 0.36, 0.95], peach: [0, -0.01, 0.38, 1],
    cherry: [-0.15, -0.12, 0.26, 0.55], strawberry: [0, 0.03, 0.34, 0.9], blueberry: [0, -0.03, 0.31, 0.65],
    grape: [0, 0.02, 0.21, 0.85], raspberry: [0, 0.0, 0.38, 0.85], orange: [0, -0.01, 0.41, 1],
    lemon: [0, 0, 0.31, 0.9], lime: [0, 0, 0.35, 0.92], grapefruit: [0, 0, 0.012, 0.95],
    banana: [0, -0.15, 0.17, 0.7], pineapple: [0, -0.07, 0.33, 0.85], mango: [0, -0.02, 0.31, 0.95],
    dragonfruit: [0, -0.01, 0.34, 0.9],
};

const geoCache = new Map();

function goldify(parts) {
    for (const g of parts) {
        const c = g.attributes.color;
        for (let i = 0; i < c.count; i++) {
            const l = 0.3 * c.getX(i) + 0.59 * c.getY(i) + 0.11 * c.getZ(i);
            _c.setHex(0xffc928);
            const k = 0.7 + l * 0.6;
            c.setXYZ(i, _c.r * k, _c.g * k, _c.b * k);
        }
    }
    return parts;
}

/** Merged geometry for a kind+colour (golden = every part gilded). */
export function fruitGeometry(kind, colour, golden = false) {
    const key = `${kind}|${colour}|${golden ? 'g' : ''}`;
    let g = geoCache.get(key);
    if (g) return g;
    let parts = BUILD[kind](hex(colour), colour);
    if (golden) parts = goldify(parts);
    g = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    g.computeBoundingSphere();
    geoCache.set(key, g);
    return g;
}

// ------------------------------------------------------------
// Faces
// ------------------------------------------------------------

let _eyes = null;
const _mouths = {};

function eyesGeometry() {
    if (_eyes) return _eyes;
    const parts = [];
    for (const s of [-1, 1]) {
        parts.push(part(sphere(0.05, 10, 8), 0x2a1a10, { pos: [s * 0.1, 0.05, 0], scale: [1, 1.15, 0.7] }));
        parts.push(part(sphere(0.017, 6, 4), 0xffffff, { pos: [s * 0.1 + 0.017, 0.075, 0.035] }));
        parts.push(part(sphere(0.045, 8, 6), 0xff8aa8, { pos: [s * 0.175, -0.035, -0.012], scale: [1.2, 0.7, 0.4] }));
    }
    _eyes = mergeGeometries(parts, false);
    return _eyes;
}

export function mouthGeometry(kind) {
    if (_mouths[kind]) return _mouths[kind];
    let g;
    if (kind === 'happy') {
        g = mergeGeometries([
            part(new THREE.CircleGeometry(0.075, 14, Math.PI, Math.PI), 0x6a1a1a, { pos: [0, -0.02, 0.01] }),
            part(new THREE.CircleGeometry(0.04, 10, Math.PI, Math.PI), 0xff7a8a, { pos: [0, -0.065, 0.014], scale: [1, 0.6, 1] }),
        ], false);
    } else if (kind === 'worried') {
        g = part(new THREE.TorusGeometry(0.045, 0.014, 5, 10, Math.PI), 0x3a1a10, { pos: [0, -0.085, 0.01] });
    } else if (kind === 'oh') {
        g = part(new THREE.TorusGeometry(0.03, 0.014, 5, 12), 0x3a1a10, { pos: [0, -0.05, 0.01] });
    } else {
        g = part(new THREE.TorusGeometry(0.055, 0.015, 5, 12, Math.PI), 0x3a1a10, { pos: [0, -0.025, 0.01], rot: [0, 0, Math.PI] });
    }
    _mouths[kind] = g;
    return g;
}

/**
 * A complete fruit: returns { root, model, body, eyes, mouth }.
 * root = position on the board, model = lean/scale/bob, body = merged mesh.
 */
export function makeFruitMesh(fruit, sizeScale) {
    const root = new THREE.Group();
    const model = new THREE.Group();
    root.add(model);
    const body = new THREE.Mesh(fruitGeometry(fruit.kind, fruit.colour, fruit.golden), fruit.golden ? goldMaterial : fruitMaterial);
    body.castShadow = true;
    model.add(body);
    const face = new THREE.Group();
    const [fx, fy, fz, fs] = FACE[fruit.kind];
    face.position.set(fx, fy, fz);
    face.scale.setScalar(fs);
    const eyes = new THREE.Mesh(eyesGeometry(), faceMaterial);
    const mouth = new THREE.Mesh(mouthGeometry('smile'), faceMaterial);
    face.add(eyes, mouth);
    model.add(face);
    model.scale.setScalar(sizeScale);
    return { root, model, body, face, eyes, mouth };
}

export function setFruitLook(fv, fruit) {
    fv.body.geometry = fruitGeometry(fruit.kind, fruit.colour, fruit.golden);
    fv.body.material = fruit.golden ? goldMaterial : fruitMaterial;
}
