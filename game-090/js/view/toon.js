// The look: stepped toon shading with a coloured rim light, inverted-hull ink outlines, vertex
// colours, and helpers to merge many primitives into one geometry per part. PS2-era in spirit:
// few triangles, hand-painted low-res textures, hard shadow steps, fog doing a lot of the work.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const grads = new Map();
export function gradientMap(steps = 3) {
    if (grads.has(steps)) return grads.get(steps);
    const vals = steps === 4 ? [70, 140, 205, 255] : steps === 2 ? [120, 255] : [85, 170, 255];
    const data = new Uint8Array(vals.length * 4);
    vals.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
    const t = new THREE.DataTexture(data, vals.length, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    grads.set(steps, t);
    return t;
}

/** Shared by every toon material: the rim colour and strength (each scene sets these) and time. */
export const TOON = {
    uRim: { value: new THREE.Color('#7affd0') },
    uRimK: { value: 0.4 },
    uTime: { value: 0 },
};

const mats = new Map();
/**
 * opts: color, vertexColors, emissive, emissiveIntensity, map, transparent, opacity, side,
 *       flash: a {value} uniform object (per unit), steps, glitch: a {value} uniform for corruption
 */
export function toonMat(opts = {}) {
    const key = opts.flash || opts.glitch ? null : JSON.stringify({ ...opts, map: opts.map?.uuid ?? null, emissiveMap: opts.emissiveMap?.uuid ?? null });
    if (key && mats.has(key)) return mats.get(key);
    const m = new THREE.MeshToonMaterial({
        color: opts.color ?? 0xffffff,
        vertexColors: !!opts.vertexColors,
        gradientMap: gradientMap(opts.steps ?? 3),
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        map: opts.map ?? null,
        emissiveMap: opts.emissiveMap ?? null,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
        alphaTest: opts.alphaTest ?? 0,
        fog: opts.fog ?? true,
    });
    const flash = opts.flash ?? { value: 0 };
    const glitch = opts.glitch ?? { value: 0 };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uRim = TOON.uRim;
        sh.uniforms.uRimK = TOON.uRimK;
        sh.uniforms.uFlash = flash;
        sh.uniforms.uGlitch = glitch;
        sh.uniforms.uTime = TOON.uTime;
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimK;\nuniform float uFlash;\nuniform float uGlitch;\nuniform float uTime;')
            .replace('#include <opaque_fragment>', `
                {
                    float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
                    rim = smoothstep(0.55, 0.92, rim);
                    outgoingLight += uRim * rim * uRimK;
                    outgoingLight = mix(outgoingLight, vec3(1.0, 0.97, 0.92), uFlash);
                    if (uGlitch > 0.0) {
                        float band = step(0.5, fract(vViewPosition.y * 6.0 - uTime * 3.0));
                        outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.3, 0.55, 1.5) + vec3(0.12, 0.0, 0.16) * band, uGlitch);
                    }
                }
                #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'toonRimV2';
    if (key) { m.userData.shared = true; mats.set(key, m); }
    return m;
}

const outlines = new Map();
export function outlineMat(width = 0.03, color = '#05060c') {
    const key = width + color;
    if (outlines.has(key)) return outlines.get(key);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true });
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

// ---------------------------------------------------------------- the part kit
// Every builder returns a painted, transformed BufferGeometry ready to merge.
//   o: { c: colour, p: [x,y,z], r: [rx,ry,rz], s: [sx,sy,sz], g: [colour2] gradient bottom→top }
function finish(geo, o) {
    geo.deleteAttribute('uv');
    if (o.g) paintGrad(geo, o.c, o.g); else paint(geo, o.c ?? '#888888');
    if (o.s) geo.scale(...o.s);
    if (o.r) { geo.rotateX(o.r[0] || 0); geo.rotateY(o.r[1] || 0); geo.rotateZ(o.r[2] || 0); }
    if (o.p) geo.translate(...o.p);
    return geo;
}
export const K = {
    box: (w, h, d, o = {}) => finish(new THREE.BoxGeometry(w, h, d), o),
    sph: (r, o = {}, ws = 12, hs = 8) => finish(new THREE.SphereGeometry(r, ws, hs), o),
    cyl: (rt, rb, h, o = {}, seg = 10) => finish(new THREE.CylinderGeometry(rt, rb, h, seg), o),
    cone: (r, h, o = {}, seg = 8) => finish(new THREE.ConeGeometry(r, h, seg), o),
    tor: (r, t, o = {}, rs = 6, ts = 16) => finish(new THREE.TorusGeometry(r, t, rs, ts), o),
    cap: (r, l, o = {}, cs = 4, rs = 8) => finish(new THREE.CapsuleGeometry(r, l, cs, rs), o),
    oct: (r, o = {}) => finish(new THREE.OctahedronGeometry(r, 0), o),
    ico: (r, o = {}, d = 0) => finish(new THREE.IcosahedronGeometry(r, d), o),
    pln: (w, h, o = {}) => finish(new THREE.PlaneGeometry(w, h), o),
};
/** Merge painted geometries into one (non-indexed, so every part keeps flat normals). */
export function merge(list) {
    const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
    return mergeGeometries(flat, false);
}

/** A mesh with the shared vertex-colour toon material, an outline, and shadows. */
export function part(geo, o = {}) {
    const m = new THREE.Mesh(geo, o.mat || toonMat({ vertexColors: true, emissive: o.emissive, emissiveIntensity: o.ei }));
    m.castShadow = o.shadow ?? true;
    m.receiveShadow = false;
    if (o.outline !== false) withOutline(m, o.outline ?? 0.022, o.outlineColor);
    if (o.p) m.position.set(...o.p);
    if (o.r) m.rotation.set(...o.r);
    return m;
}

/** A glowing, unlit part: eyes, cores, runes. Blooms. */
export function glow(geo, color = '#ffffff', o = {}) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, fog: false }));
    if (o.p) m.position.set(...o.p);
    return m;
}

export function disposeTree(obj) {
    obj.traverse((c) => {
        if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
        if (c.material && !c.material.userData?.shared) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (!m.userData?.keepMaps) { m.map?.dispose?.(); m.emissiveMap?.dispose?.(); } m.dispose(); });
    });
}
