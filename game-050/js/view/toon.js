/**
 * toon.js — the look: stepped toon shading with a fresnel rim, inverted-hull
 * outlines, vertex-colour painting and geometry merging helpers.
 */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const gradCache = new Map();
export function gradientMap(steps = 3) {
    if (gradCache.has(steps)) return gradCache.get(steps);
    const data = new Uint8Array(steps * 4);
    const vals = steps === 3 ? [110, 190, 255] : steps === 4 ? [90, 150, 210, 255] : [140, 255];
    for (let i = 0; i < steps; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = vals[i]; data[i * 4 + 3] = 255; }
    const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    gradCache.set(steps, tex);
    return tex;
}

/** Shared uniforms: rim strength/colour and a global flash used for hit reactions. */
export const toonUniforms = {
    uRimColor: { value: new THREE.Color('#ffffff') },
    uRimStrength: { value: 0.32 },
};

function injectRim(mat, extra = {}) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uRimColor = toonUniforms.uRimColor;
        shader.uniforms.uRimStrength = toonUniforms.uRimStrength;
        shader.uniforms.uFlash = extra.flash || { value: 0 };
        shader.uniforms.uFlashColor = extra.flashColor || { value: new THREE.Color('#ffffff') };
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uFlash;\nuniform vec3 uFlashColor;')
            .replace('#include <opaque_fragment>', `
                {
                    vec3 vdir = normalize(vViewPosition);
                    float rim = 1.0 - max(dot(normal, vdir), 0.0);
                    rim = smoothstep(0.55, 0.95, rim);
                    outgoingLight += uRimColor * rim * uRimStrength;
                    outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
                }
                #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'toonRim';
}

const matCache = new Map();
/**
 * opts: { color, vertexColors, side, transparent, opacity, emissive, map, flash (uniform), steps }
 * Materials without a per-object flash uniform are cached and shared.
 */
export function toonMat(opts = {}) {
    const key = opts.flash ? null : JSON.stringify({ ...opts, map: opts.map ? opts.map.uuid : null });
    if (key && matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshToonMaterial({
        color: opts.color ?? 0xffffff,
        vertexColors: !!opts.vertexColors,
        gradientMap: gradientMap(opts.steps || 3),
        side: opts.side ?? THREE.FrontSide,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        map: opts.map || null,
    });
    injectRim(m, { flash: opts.flash, flashColor: opts.flashColor });
    if (key) matCache.set(key, m);
    return m;
}

const outlineCache = new Map();
export function outlineMat(width = 0.018, color = '#1a1220') {
    const key = width + color;
    if (outlineCache.has(key)) return outlineCache.get(key);
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => 'outline' + key;
    outlineCache.set(key, m);
    return m;
}

/** Adds an inverted-hull outline as a child sharing the geometry. */
export function withOutline(mesh, width = 0.018, color) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat(width, color));
    o.name = 'outline';
    o.raycast = () => {};
    o.renderOrder = -1;
    mesh.add(o);
    return mesh;
}

// ---------------------------------------------------------------- geometry painting

const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Sets a solid vertex colour on a geometry (adds a color attribute). */
export function paint(geo, color) {
    _c.set(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

/** Vertical (or any axis) gradient from colour a at min to b at max, in the geometry's own space. */
export function paintGradient(geo, a, b, axis = 1, min = null, max = null, curve = 1) {
    _c.set(a); _c2.set(b);
    const pos = geo.attributes.position;
    let lo = min, hi = max;
    if (lo === null || hi === null) {
        lo = Infinity; hi = -Infinity;
        for (let i = 0; i < pos.count; i++) { const v = pos.getComponent(i, axis); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        let t = (pos.getComponent(i, axis) - lo) / Math.max(1e-6, hi - lo);
        t = Math.pow(Math.min(1, Math.max(0, t)), curve);
        arr[i * 3] = _c.r + (_c2.r - _c.r) * t;
        arr[i * 3 + 1] = _c.g + (_c2.g - _c.g) * t;
        arr[i * 3 + 2] = _c.b + (_c2.b - _c.b) * t;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

/** Random per-vertex brightness jitter, for rocks and ground. */
export function jitterColor(geo, amount = 0.08, seed = 1) {
    const col = geo.attributes.color;
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < col.count; i++) {
        const k = 1 + (rnd() - 0.5) * 2 * amount;
        col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    return geo;
}

/** Normalises attributes so heterogeneous primitives can be merged. */
export function prep(geo) {
    let g = geo.index ? geo : mergeVertices(geo);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) paint(g, '#ffffff');
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
}

/** Merges painted geometries (each already transformed) into one. */
export function merge(geos) {
    const list = geos.filter(Boolean).map(prep);
    if (!list.length) return null;
    return mergeGeometries(list, false);
}

/** Helper: create a geometry, apply a transform, paint it. */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _s.set(scale[0], scale[1], scale[2]);
    _p.set(pos[0], pos[1], pos[2]);
    _m.compose(_p, _q, _s);
    geo.applyMatrix4(_m);
    if (color) paint(geo, color);
    return geo;
}

/** A mesh from merged painted parts, with an outline. */
export function toonMesh(geos, opts = {}) {
    const geo = Array.isArray(geos) ? merge(geos) : prep(geos);
    if (!geo) return null;
    const mat = opts.material || toonMat({ vertexColors: true, flash: opts.flash, flashColor: opts.flashColor, side: opts.side, transparent: opts.transparent, opacity: opts.opacity });
    const mesh = new THREE.Mesh(geo, mat);
    if (opts.outline !== false) withOutline(mesh, opts.outline || 0.018, opts.outlineColor);
    return mesh;
}

/** Unlit glowing parts (orbs, gems, runes). */
const glowCache = new Map();
export function glowMat(opts = {}) {
    const key = JSON.stringify(opts);
    if (glowCache.has(key)) return glowCache.get(key);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive, side: opts.side ?? THREE.FrontSide, toneMapped: false });
    glowCache.set(key, m);
    return m;
}

export function shade(hex, k) {
    _c.set(hex);
    if (k >= 0) _c.lerp(_c2.set('#ffffff'), k);
    else _c.multiplyScalar(1 + k);
    return '#' + _c.getHexString();
}

export function mix(a, b, t) {
    _c.set(a).lerp(_c2.set(b), t);
    return '#' + _c.getHexString();
}

export { THREE };
