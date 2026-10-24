// Small building blocks for the view: toon materials, geometry merging, canvas textures, outlines.
// Everything is made in code; there are no image or model files.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

// ---------------------------------------------------------------- toon ramp
let ramp = null;
export function toonRamp() {
    if (ramp) return ramp;
    const data = new Uint8Array([120, 120, 120, 255, 175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
    ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    return ramp;
}

const mats = new Map();
/** A cached toon material for a colour. opts: emissive, transparent, opacity, side, flat. */
export function toon(color, opts = {}) {
    const key = `${color}|${opts.emissive || 0}|${opts.opacity ?? 1}|${opts.side || 0}|${opts.vc ? 1 : 0}|${opts.map ? opts.map.uuid : ''}`;
    let m = mats.get(key);
    if (!m) {
        m = new THREE.MeshToonMaterial({
            color, gradientMap: toonRamp(), emissive: opts.emissive || 0x000000,
            transparent: opts.opacity != null && opts.opacity < 1, opacity: opts.opacity ?? 1,
            side: opts.side ?? THREE.FrontSide, vertexColors: !!opts.vc, map: opts.map || null,
        });
        mats.set(key, m);
    }
    return m;
}
export const vcMat = () => toon(0xffffff, { vc: true });
export function basic(color, opts = {}) {
    return new THREE.MeshBasicMaterial({ color, transparent: opts.opacity != null, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, depthWrite: opts.depthWrite ?? true, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: opts.fog ?? true });
}

// ---------------------------------------------------------------- colours
const _c = new THREE.Color();
export function shade(hex, k) { _c.set(hex); _c.multiplyScalar(k); return _c.getHex(); }
export function mix(a, b, t) { const ca = new THREE.Color(a), cb = new THREE.Color(b); return ca.lerp(cb, t).getHex(); }

// ---------------------------------------------------------------- geometry
const geoCache = new Map();
function cached(key, make) { let g = geoCache.get(key); if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); } return g; }
export const G = {
    box: (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    sphere: (r, ws = 16, hs = 12) => cached(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
    cyl: (rt, rb, h, seg = 12) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
    cone: (r, h, seg = 12) => cached(`n${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
    torus: (r, t, rs = 8, ts = 16) => cached(`t${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)),
    cap: (r, l, cs = 4, rs = 10) => cached(`k${r},${l}`, () => new THREE.CapsuleGeometry(r, l, cs, rs)),
};

/** Collects many shapes, each with its own colour, into one geometry and one draw call. */
export class Merger {
    constructor() { this.parts = []; }
    add(geo, color, matrix) {
        let g = geo.index ? geo.toNonIndexed() : geo.clone();
        if (matrix) g.applyMatrix4(matrix);
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        _c.set(color);
        for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (g.attributes.uv) g.deleteAttribute('uv');
        if (!g.attributes.normal) g.computeVertexNormals();
        this.parts.push(g);
        return this;
    }
    /** add with position / rotation / scale given directly */
    put(geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
        return this.add(geo, color, m);
    }
    build() {
        if (!this.parts.length) return null;
        const g = mergeGeometries(this.parts, false);
        this.parts.length = 0;
        return g;
    }
}

export function mesh(geo, material, { cast = true, receive = false } = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
}

/** A copy of a smooth geometry pushed out along its normals, drawn inside-out for an outline. */
export function outlineGeo(geo, t) {
    const g = geo.clone();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
    return g;
}
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2b1a2e, side: THREE.BackSide });
/** Mesh with an ink outline as a child. */
export function inked(geo, material, t = 0.035, opts) {
    const m = mesh(geo, material, opts);
    const o = new THREE.Mesh(cached(`o${geo.uuid}|${t}`, () => outlineGeo(geo, t)), outlineMat);
    m.add(o);
    return m;
}

// ---------------------------------------------------------------- canvas textures
export function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.userData.own = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
}

/** A soft round glow sprite texture. */
let glowTex = null;
export function glowTexture() {
    if (glowTex) return glowTex;
    glowTex = canvasTex(64, 64, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    glowTex.userData.keep = true;
    return glowTex;
}
export function glowSprite(color, size, opacity = 0.8) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1);
    return s;
}

/** Text on a small canvas texture, shrunk to fit its width. */
export function textTexture(text, { w = 256, h = 128, bg = '#f6e2b4', fg = '#4a2c14', size = 34, border = '#7a4a22' } = {}) {
    return canvasTex(w, h, (c) => {
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        c.strokeStyle = border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
        c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
        let s = size; c.font = `700 ${s}px "Fredoka", "Trebuchet MS", sans-serif`;
        const words = text.split(' '), lines = [];
        let line = '';
        for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 40 && line) { lines.push(line); line = wd; } else line = t; }
        lines.push(line);
        while (lines.length * s * 1.1 > h - 24 && s > 14) { s -= 2; c.font = `700 ${s}px "Fredoka", "Trebuchet MS", sans-serif`; }
        lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * s * 1.12));
    });
}

// ---------------------------------------------------------------- small helpers
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = (t) => t * t * (3 - 2 * t);
export function angleDamp(a, b, k, dt) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    return a + d * (1 - Math.exp(-k * dt));
}

/** Free the GPU memory behind an object tree (but not shared cached materials or geometries). */
export function disposeTree(obj, keep = new Set()) {
    obj.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isSprite) {
            if (o.geometry && !keep.has(o.geometry) && !o.geometry.userData.shared) o.geometry.dispose?.();
        }
    });
}
