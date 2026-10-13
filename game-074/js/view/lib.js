// Procedural modelling toolkit. Every model in the game is built here from
// primitives at load: no model or texture files.
//
// A Builder merges many primitives into ONE BufferGeometry with per-vertex
// colour and a per-vertex `glow` (self-illumination) attribute, so a whole
// rigid part — a skull with its horns, teeth and burning eyes — is one draw
// call. `litMat()` is a MeshStandardMaterial taught to read that glow, to rim
// light toward the camera, and to flash white when hit.

import * as THREE from 'three';

// ---------------------------------------------------------------- noise
function h3(x, y, z) {
    let h = Math.imul(x | 0, 0x27D4EB2D) ^ Math.imul(y | 0, 0x165667B1) ^ Math.imul(z | 0, 0x9E3779B9);
    h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
    h ^= h >>> 13;
    return ((h >>> 0) / 4294967296) * 2 - 1;
}
export function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
        l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
        l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
        w,
    );
}
export function fbm3(x, y, z, oct = 3) {
    let a = 0.5, f = 1, s = 0;
    for (let i = 0; i < oct; i++) { s += noise3(x * f, y * f, z * f) * a; a *= 0.5; f *= 2.03; }
    return s;
}

// ---------------------------------------------------------------- geometry helpers
const _c = new THREE.Color();
export const col = (hex) => _c.set(hex).clone();

/** Push vertices along their normals by noise (on an indexed geometry, so seams stay shut). */
export function displace(geo, amp, freq = 2, seed = 0, oct = 3) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    if (!n) geo.computeVertexNormals();
    const nn = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const d = fbm3(x * freq + seed, y * freq + seed * 1.7, z * freq - seed, oct) * amp;
        p.setXYZ(i, x + nn.getX(i) * d, y + nn.getY(i) * d, z + nn.getZ(i) * d);
    }
    geo.computeVertexNormals();
    return geo;
}

/** A tapered, curved horn/tube from `pts` (array of Vector3) with radius r(t). */
export function taperTube(pts, r0, r1, radial = 10, smooth = 24) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const frames = curve.computeFrenetFrames(smooth, false);
    const pos = [], idx = [];
    for (let i = 0; i <= smooth; i++) {
        const t = i / smooth;
        const c = curve.getPointAt(t);
        const r = r0 + (r1 - r0) * t;
        const N = frames.normals[i], B = frames.binormals[i];
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const cx = Math.cos(a), sx = Math.sin(a);
            pos.push(c.x + r * (cx * N.x + sx * B.x), c.y + r * (cx * N.y + sx * B.y), c.z + r * (cx * N.z + sx * B.z));
        }
    }
    for (let i = 0; i < smooth; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // cap the base
    const base = pos.length / 3;
    const c0 = curve.getPointAt(0);
    pos.push(c0.x, c0.y, c0.z);
    for (let j = 0; j < radial; j++) idx.push(base, j + 1, j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/**
 * A feather: a blade along +x, `len` long and `wid` wide, with a raised shaft,
 * curling by `curl` toward +z at the tip. Two-sided (render with DoubleSide).
 */
export function featherGeo(len, wid, curl = 0.1, segs = 7) {
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = t * len;
        // width profile: narrow at the quill, fullest at 35%, pointed tip
        const w = wid * (t < 0.35 ? 0.35 + 0.65 * Math.sin((t / 0.35) * Math.PI / 2) : Math.cos(((t - 0.35) / 0.65) * Math.PI / 2) ** 0.8);
        const z = curl * t * t;
        pos.push(x, w * 0.55, z - w * 0.05, x, 0, z + wid * 0.08, x, -w * 0.45, z - w * 0.05);
    }
    for (let i = 0; i < segs; i++) {
        const a = i * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** A membrane between bone tips (bat wing): fan from p0 through pts, scalloped. */
export function membraneGeo(root, tips, sag = 0.25) {
    const pos = [root.x, root.y, root.z], idx = [];
    for (let i = 0; i < tips.length; i++) {
        pos.push(tips[i].x, tips[i].y, tips[i].z);
        if (i < tips.length - 1) {
            const a = tips[i], b = tips[i + 1];
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
            // pull the edge midpoint toward the root: scalloped trailing edge
            pos.push(mx + (root.x - mx) * sag, my + (root.y - my) * sag, mz + (root.z - mz) * sag);
        }
    }
    for (let i = 0; i < tips.length - 1; i++) {
        const a = 1 + i * 2, m = a + 1, b = a + 2;
        idx.push(0, a, m, 0, m, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

// ---------------------------------------------------------------- builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _nm = new THREE.Matrix3(), _v = new THREE.Vector3();

export class Builder {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.glow = []; }

    /**
     * Add a geometry. o: { p:[x,y,z], r:[rx,ry,rz], s:number|[sx,sy,sz], color, color2, grad:'x'|'y'|'z', glow, glow2, tint(x,y,z)->Color }
     * color2/glow2 with `grad` blend along that local axis (−1..1 of the geometry's bounds).
     */
    add(geo, o = {}) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        if (!g.attributes.normal) g.computeVertexNormals();
        const s = o.s ?? 1;
        _s.set(...(Array.isArray(s) ? s : [s, s, s]));
        _e.set(...(o.r ?? [0, 0, 0]));
        _q.setFromEuler(_e);
        _p.set(...(o.p ?? [0, 0, 0]));
        _m.compose(_p, _q, _s);
        if (o.m) _m.premultiply(o.m);
        _nm.getNormalMatrix(_m);
        const P = g.attributes.position, N = g.attributes.normal;
        const c1 = new THREE.Color(o.color ?? 0xffffff), c2 = new THREE.Color(o.color2 ?? o.color ?? 0xffffff);
        const g1 = o.glow ?? 0, g2 = o.glow2 ?? g1;
        let lo = 0, hi = 1, ax = -1;
        if (o.grad) {
            ax = { x: 0, y: 1, z: 2 }[o.grad];
            g.computeBoundingBox();
            lo = g.boundingBox.min.getComponent(ax); hi = g.boundingBox.max.getComponent(ax);
        }
        const tc = new THREE.Color();
        for (let i = 0; i < P.count; i++) {
            _v.set(P.getX(i), P.getY(i), P.getZ(i));
            let t = 0;
            if (ax >= 0) t = (_v.getComponent(ax) - lo) / Math.max(1e-6, hi - lo);
            if (o.tint) tc.copy(o.tint(_v.x, _v.y, _v.z, t)); else tc.copy(c1).lerp(c2, t);
            const gl = g1 + (g2 - g1) * t;
            _v.applyMatrix4(_m);
            this.pos.push(_v.x, _v.y, _v.z);
            _v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(_nm).normalize();
            this.nor.push(_v.x, _v.y, _v.z);
            this.col.push(tc.r, tc.g, tc.b);
            this.glow.push(gl);
        }
        return this;
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('glow', new THREE.Float32BufferAttribute(this.glow, 1));
        g.computeBoundingSphere();
        return g;
    }
}

// ---------------------------------------------------------------- primitives (cached)
const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }
export const sphere = (ws = 20, hs = 14) => cached(`s${ws},${hs}`, () => new THREE.SphereGeometry(1, ws, hs));
export const cyl = (rt = 1, rb = 1, segs = 16, open = false) => cached(`c${rt},${rb},${segs},${open}`, () => new THREE.CylinderGeometry(rt, rb, 1, segs, 1, open));
export const cone = (segs = 14) => cached(`k${segs}`, () => new THREE.ConeGeometry(1, 1, segs));
export const box = () => cached('b', () => new THREE.BoxGeometry(1, 1, 1));
export const torus = (tube = 0.15, rs = 10, ts = 28, arc = Math.PI * 2) => cached(`t${tube},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(1, tube, rs, ts, arc));
export const capsule = (len = 1, segs = 10) => cached(`p${len},${segs}`, () => new THREE.CapsuleGeometry(1, len, 6, segs));
export const octa = (d = 0) => cached(`o${d}`, () => new THREE.OctahedronGeometry(1, d));
export const ico = (d = 1) => cached(`i${d}`, () => new THREE.IcosahedronGeometry(1, d));
export const lathe = (pts, segs = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
export const dsphere = (amp, freq, seed, ws = 28, hs = 20) => cached(`ds${amp},${freq},${seed},${ws}`, () => displace(new THREE.SphereGeometry(1, ws, hs), amp, freq, seed));

// ---------------------------------------------------------------- materials
const NOISE_GLSL = `
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
`;
export { NOISE_GLSL };

/** Shared uniforms every lit material reads (stage rim colour, time). */
export const shared = {
    uRim: { value: new THREE.Color(0xff6a30) },
    uRimAmt: { value: 0.55 },
    uTime: { value: 0 },
};

/**
 * MeshStandardMaterial + vertex glow + rim light + hit flash + optional
 * molten "pulse" on glowing parts. Each call returns a fresh material whose
 * `userData.flash` uniform can be driven per model.
 */
export function litMat({ rough = 0.6, metal = 0.0, side = THREE.FrontSide, transparent = false, opacity = 1, glowMul = 1.6, pulse = 0, rimMul = 1, flat = false } = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, side, transparent, opacity, flatShading: flat });
    const flash = { value: 0 };
    const gmul = { value: glowMul };
    const fade = { value: 1 };
    m.userData.flash = flash;
    m.userData.glowMul = gmul;
    m.userData.fade = fade;
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uFlash = flash;
        sh.uniforms.uGlowMul = gmul;
        sh.uniforms.uFade = fade;
        sh.uniforms.uRim = shared.uRim;
        sh.uniforms.uRimAmt = shared.uRimAmt;
        sh.uniforms.uTime = shared.uTime;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;\nvarying vec3 vObjPos;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;\nvObjPos = position;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying float vGlow;\nvarying vec3 vObjPos;\nuniform float uFlash, uGlowMul, uRimAmt, uTime, uFade;\nuniform vec3 uRim;\n${pulse ? NOISE_GLSL : ''}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float g = vGlow;
    ${pulse ? `g *= 0.75 + 0.5 * vn3(vObjPos * 3.0 + vec3(0.0, uTime * ${pulse.toFixed(2)}, 0.0));` : ''}
    totalEmissiveRadiance += vColor.rgb * g * uGlowMul;
    float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
    totalEmissiveRadiance += uRim * rim * uRimAmt * ${rimMul.toFixed(2)};
    totalEmissiveRadiance += vec3(uFlash);
  }`)
            .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uFade;');
    };
    m.customProgramCacheKey = () => `lit${pulse}${rimMul}`;
    return m;
}

/** Unlit additive glow material for halos, soul-lights and cores. */
export function glowMat(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true });
}

/** A mesh from a Builder with a fresh lit material. */
export function meshOf(builder, matOpts) {
    const mat = litMat(matOpts);
    const mesh = new THREE.Mesh(builder.build(), mat);
    return mesh;
}
