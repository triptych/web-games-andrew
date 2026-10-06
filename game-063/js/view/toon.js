// The storybook look: stepped toon shading with a soft rim light, inverted-hull ink outlines, and
// helpers to paint vertex colours and merge many primitives into one mesh per part.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const grads = new Map();
export function gradientMap(steps = 3) {
    if (grads.has(steps)) return grads.get(steps);
    const vals = steps === 4 ? [80, 150, 215, 255] : steps === 2 ? [150, 255] : [105, 190, 255];
    const data = new Uint8Array(vals.length * 4);
    vals.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
    const t = new THREE.DataTexture(data, vals.length, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    grads.set(steps, t);
    return t;
}

// Shared by every toon material: rim colour/strength (the realm sets these), and time.
export const TOON = {
    uRim: { value: new THREE.Color('#fff6e0') },
    uRimK: { value: 0.35 },
    uTime: { value: 0 },
};

const mats = new Map();
/**
 * opts: color, vertexColors, emissive, emissiveIntensity, map, transparent, opacity, side,
 *       flash: a {value} uniform object (per character), steps
 */
export function toonMat(opts = {}) {
    const key = opts.flash ? null : JSON.stringify({ ...opts, map: opts.map?.uuid ?? null });
    if (key && mats.has(key)) return mats.get(key);
    const m = new THREE.MeshToonMaterial({
        color: opts.color ?? 0xffffff,
        vertexColors: !!opts.vertexColors,
        gradientMap: gradientMap(opts.steps ?? 3),
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        map: opts.map ?? null,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
        alphaTest: opts.alphaTest ?? 0,
    });
    const flash = opts.flash ?? { value: 0 };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uRim = TOON.uRim;
        sh.uniforms.uRimK = TOON.uRimK;
        sh.uniforms.uFlash = flash;
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimK;\nuniform float uFlash;')
            .replace('#include <opaque_fragment>', `
                {
                    float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
                    rim = smoothstep(0.62, 0.92, rim);
                    outgoingLight += uRim * rim * uRimK;
                    outgoingLight = mix(outgoingLight, vec3(1.0, 0.95, 0.9), uFlash);
                }
                #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'toonRim';
    if (key) { m.userData.shared = true; mats.set(key, m); }
    return m;
}

const outlines = new Map();
export function outlineMat(width = 0.03, color = '#2a1a22') {
    const key = width + color;
    if (outlines.has(key)) return outlines.get(key);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => 'outline' + key;
    m.userData.shared = true;
    outlines.set(key, m);
    return m;
}

/** An inverted-hull ink outline sharing the mesh's geometry. */
export function withOutline(mesh, width = 0.03, color) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat(width, color));
    o.raycast = () => {};
    o.castShadow = false;
    o.userData.outline = true;
    mesh.add(o);
    return mesh;
}

// ---------------------------------------------------------------- vertex painting
const _a = new THREE.Color(), _b = new THREE.Color();
export function paint(geo, color) {
    _a.set(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _a.r; arr[i * 3 + 1] = _a.g; arr[i * 3 + 2] = _a.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}
export function paintGrad(geo, ca, cb, axis = 1, curve = 1) {
    _a.set(ca); _b.set(cb);
    const p = geo.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) { const v = p.getComponent(i, axis); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const arr = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const t = Math.pow((p.getComponent(i, axis) - lo) / Math.max(1e-6, hi - lo), curve);
        arr[i * 3] = _a.r + (_b.r - _a.r) * t; arr[i * 3 + 1] = _a.g + (_b.g - _a.g) * t; arr[i * 3 + 2] = _a.b + (_b.b - _a.b) * t;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}
export function jitter(geo, amt = 0.08, seed = 1) {
    const c = geo.attributes.color;
    let s = seed * 9301 + 49297;
    for (let i = 0; i < c.count; i++) {
        s = (s * 16807) % 2147483647;
        const k = 1 + ((s / 2147483647) - 0.5) * 2 * amt;
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
    return geo;
}

/** Drops everything but position/normal/color/uv so mixed primitives merge. */
export function prep(geo) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) paint(g, '#ffffff');
    return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Bakes a painted geometry at a transform: part(geo, color|null, pos, rot, scale). */
export function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
    if (color) paint(geo, color);
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _p.set(pos[0], pos[1], pos[2]);
    if (Array.isArray(scale)) _s.set(scale[0], scale[1], scale[2]); else _s.set(scale, scale, scale);
    _m.compose(_p, _q, _s);
    const g = prep(geo);
    g.applyMatrix4(_m);
    return g;
}

export function merge(geos) {
    const g = mergeGeometries(geos.map(prep), false);
    return g;
}

/** Merge parts into one toon mesh with an outline. */
export function toonMesh(geos, opts = {}) {
    const g = Array.isArray(geos) ? merge(geos) : prep(geos);
    const mesh = new THREE.Mesh(g, opts.mat ?? toonMat({ vertexColors: true, flash: opts.flash, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity }));
    mesh.castShadow = opts.shadow ?? true;
    mesh.receiveShadow = !!opts.receive;
    if (opts.outline !== false) withOutline(mesh, opts.outline ?? 0.03, opts.ink);
    return mesh;
}

/** Smooth-normal version of a geometry (for lathes and blobs merged from parts). */
export function smoothed(geo) {
    const g = geo.clone();
    g.deleteAttribute('normal');
    const m = mergeVertices(g, 1e-4);
    m.computeVertexNormals();
    return m;
}

// Common primitive shortcuts
export const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
export const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const caps = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
export const tor = (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
export const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
export const dodec = (r, d = 0) => new THREE.DodecahedronGeometry(r, d);
