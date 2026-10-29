// Procedural models. Everything is built from boxes, spheres and cones merged into one geometry
// with vertex colours; no files. A vertex with aPaint = 1 takes the per-instance tint (a car's body,
// a person's shirt); the rest keep their own colour (wheels, windows, skin).

import * as THREE from 'three';
import { FLOOR_H, DECK_H } from '../config.js';

// ---------------------------------------------------------------- the kit

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
    constructor() { this.p = []; this.n = []; this.c = []; this.k = []; }

    /** Add a THREE geometry placed by { p, r, s }, in colour c (hex) or cf(x, y, z) → hex. paint: 0 or 1. */
    add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], c = 0xffffff, cf = null, paint = 0 } = {}) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); _v.set(p[0], p[1], p[2]); _s.set(s[0], s[1], s[2]);
        _m.compose(_v, _q, _s);
        g.applyMatrix4(_m);
        const pos = g.attributes.position.array, nor = g.attributes.normal.array;
        const base = _c.set(c);
        for (let i = 0; i < pos.length; i += 3) {
            this.p.push(pos[i], pos[i + 1], pos[i + 2]);
            this.n.push(nor[i], nor[i + 1], nor[i + 2]);
            if (cf) { _c.set(cf(pos[i], pos[i + 1], pos[i + 2])); this.c.push(_c.r, _c.g, _c.b); }
            else this.c.push(base.r, base.g, base.b);
            this.k.push(paint);
        }
        g.dispose();
        return this;
    }
    box(w, h, d, x, y, z, c, paint = 0, ry = 0, rz = 0) { return this.add(BOX, { p: [x, y, z], s: [w, h, d], r: [0, ry, rz], c, paint }); }
    sph(r, x, y, z, c, paint = 0, sx = 1, sy = 1, sz = 1) { return this.add(SPH, { p: [x, y, z], s: [r * sx, r * sy, r * sz], c, paint }); }
    cyl(rt, rb, h, x, y, z, c, paint = 0, rx = 0, rz = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), { p: [x, y, z], r: [rx, 0, rz], c, paint }); }
    cone(r, h, x, y, z, c, paint = 0, seg = 10, rx = 0, rz = 0) { return this.add(new THREE.ConeGeometry(r, h, seg), { p: [x, y, z], r: [rx, 0, rz], c, paint }); }
    tor(R, t, x, y, z, c, paint = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, seg = 24) { return this.add(new THREE.TorusGeometry(R, t, 8, seg, arc), { p: [x, y, z], r: [rx, ry, rz], c, paint }); }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
        g.setAttribute('aPaint', new THREE.Float32BufferAttribute(this.k, 1));
        g.computeBoundingSphere();
        return g;
    }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 12, 8);

/** Lambert material for kit geometry; instance colours tint only the vertices flagged aPaint. */
export function kitMaterial(instanced = true) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float aPaint;\n' + sh.vertexShader;
        if (instanced) {
            sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
    vColor.xyz = mix(color.xyz, color.xyz * instanceColor.xyz, aPaint);
#endif`);
        }
    };
    return m;
}

// ---------------------------------------------------------------- things

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const PAINT = [0xff6b81, 0x4dabf7, 0xffd43b, 0x69db7c, 0xb197fc, 0xff922b, 0xf8f9fa, 0x38d9a9];

export function personModel() {
    const k = new Kit();
    k.cyl(0.07, 0.09, 0.22, 0, 0.13, 0, 0xffffff, 1, 0, 0, 6);
    k.sph(0.075, 0, 0.3, 0, 0xffd7b0);
    k.box(0.04, 0.12, 0.04, 0, 0.0, 0.05, 0x445, 0);
    k.box(0.04, 0.12, 0.04, 0, 0.0, -0.05, 0x445, 0);
    return k.build();
}

export function carModel() {
    const k = new Kit();
    k.box(1.3, 0.3, 0.64, 0, 0.28, 0, 0xffffff, 1);
    k.box(0.62, 0.26, 0.56, -0.1, 0.56, 0, 0xcfeeff, 0);
    k.box(0.64, 0.05, 0.58, -0.1, 0.7, 0, 0xffffff, 1);
    for (const x of [-0.42, 0.42]) for (const z of [-0.3, 0.3]) k.cyl(0.14, 0.14, 0.1, x, 0.14, z, 0x22252b, 0, Math.PI / 2, 0, 8);
    for (const z of [-0.2, 0.2]) k.box(0.05, 0.08, 0.1, 0.66, 0.3, z, 0xfff3a0);
    return k.build();
}

export function busModel() {
    const k = new Kit();
    k.box(2.0, 0.7, 0.8, 0, 0.5, 0, 0xffffff, 1);
    k.box(1.9, 0.22, 0.82, 0, 0.62, 0, 0xcfeeff);
    k.box(2.02, 0.06, 0.82, 0, 0.88, 0, 0xf4f4f4);
    for (const x of [-0.65, 0.65]) for (const z of [-0.38, 0.38]) k.cyl(0.16, 0.16, 0.1, x, 0.16, z, 0x22252b, 0, Math.PI / 2, 0, 8);
    k.box(0.04, 0.1, 0.4, 1.0, 0.35, 0, 0xfff3a0);
    return k.build();
}

export function cartModel() {
    const k = new Kit();
    k.box(0.7, 0.3, 0.45, 0, 0.25, 0, 0xffffff, 1);
    k.cyl(0.02, 0.02, 0.5, -0.25, 0.65, 0.18, 0xdddddd);
    k.cyl(0.02, 0.02, 0.5, 0.25, 0.65, 0.18, 0xdddddd);
    k.cone(0.5, 0.2, 0, 0.98, 0, 0xff6b81, 0, 4);
    k.tor(0.13, 0.06, 0, 0.5, 0, 0xff9ecd, 0, Math.PI / 2);
    for (const x of [-0.25, 0.25]) k.cyl(0.1, 0.1, 0.06, x, 0.1, 0.25, 0x22252b, 0, Math.PI / 2, 0, 8);
    return k.build();
}

export function pizzaModel() {
    const k = new Kit();
    k.box(1.0, 0.6, 0.64, -0.15, 0.5, 0, 0xffffff, 1);
    k.box(0.4, 0.4, 0.62, 0.62, 0.4, 0, 0xffffff, 1);
    k.box(0.05, 0.2, 0.5, 0.83, 0.5, 0, 0xcfeeff);
    k.cyl(0.32, 0.32, 0.08, -0.15, 0.85, 0, 0xffc857, 0, 0, 0, 14);
    for (const [x, z] of [[-0.25, 0.1], [-0.05, -0.1], [-0.2, -0.15]]) k.cyl(0.06, 0.06, 0.1, x, 0.88, z, 0xe63946, 0, 0, 0, 8);
    for (const x of [-0.45, 0.55]) for (const z of [-0.3, 0.3]) k.cyl(0.14, 0.14, 0.1, x, 0.14, z, 0x22252b, 0, Math.PI / 2, 0, 8);
    return k.build();
}

export function treeModel(leaf = 0x6bd16b) {
    const k = new Kit();
    k.cyl(0.07, 0.1, 0.5, 0, 0.25, 0, 0x8a5a3c, 0, 0, 0, 6);
    k.sph(0.5, 0, 0.95, 0, leaf, 1, 1, 0.95, 1);
    k.sph(0.3, 0.2, 1.2, 0.1, leaf, 1);
    return k.build();
}

export function pineModel() {
    const k = new Kit();
    k.cyl(0.08, 0.1, 0.4, 0, 0.2, 0, 0x7a4e32, 0, 0, 0, 6);
    k.cone(0.55, 0.6, 0, 0.7, 0, 0xffffff, 1, 8);
    k.cone(0.42, 0.55, 0, 1.1, 0, 0xffffff, 1, 8);
    k.cone(0.28, 0.5, 0, 1.45, 0, 0xffffff, 1, 8);
    return k.build();
}

export function oakModel() {
    const k = new Kit();
    k.cyl(0.14, 0.2, 0.9, 0, 0.45, 0, 0x7a4e32, 0, 0, 0, 7);
    k.sph(0.8, 0, 1.5, 0, 0xffffff, 1);
    k.sph(0.55, 0.5, 1.2, 0.3, 0xffffff, 1);
    k.sph(0.5, -0.5, 1.3, -0.2, 0xffffff, 1);
    return k.build();
}

export function lampModel() {
    const k = new Kit();
    k.cyl(0.04, 0.05, 0.9, 0, 0.45, 0, 0x4a4e5a, 0, 0, 0, 6);
    k.sph(0.13, 0, 0.95, 0, 0xfff0a8);
    return k.build();
}

export function tankHullModel() {
    const k = new Kit();
    k.box(1.7, 0.28, 0.5, 0, 0.18, 0.5, 0x2a2d33);
    k.box(1.7, 0.28, 0.5, 0, 0.18, -0.5, 0x2a2d33);
    k.box(1.5, 0.3, 1.0, 0, 0.36, 0, 0xffffff, 1);
    k.box(1.3, 0.12, 0.9, 0, 0.55, 0, 0xffffff, 1);
    for (const x of [-0.7, 0, 0.7]) for (const z of [-0.5, 0.5]) k.cyl(0.14, 0.14, 0.52, x, 0.16, z, 0x555a66, 0, Math.PI / 2, 0, 8);
    return k.build();
}

export function tankTurretModel() {
    const k = new Kit();
    k.sph(0.42, 0, 0.7, 0, 0xffffff, 1, 1.15, 0.7, 1);
    k.cyl(0.07, 0.07, 1.2, 0.95, 0.74, 0, 0x30343c, 0, 0, Math.PI / 2, 8);
    k.cyl(0.1, 0.1, 0.12, 1.5, 0.74, 0, 0x20232a, 0, 0, Math.PI / 2, 8);
    k.sph(0.1, -0.1, 1.0, 0, 0xffe066);
    return k.build();
}

export function heliModel() {
    const k = new Kit();
    k.sph(0.6, 0, 0, 0, 0xffffff, 1, 1.15, 0.8, 0.8);
    k.sph(0.34, 0.35, 0.1, 0, 0xcfeeff, 0, 1, 0.8, 0.8);
    k.cyl(0.07, 0.04, 1.5, -1.1, 0.05, 0, 0xffffff, 1, 0, Math.PI / 2, 6);
    k.box(0.04, 0.4, 0.04, -1.8, 0.25, 0, 0xffffff, 1);
    k.box(0.05, 0.05, 0.9, -1.8, 0.4, 0, 0x30343c);
    k.cyl(0.05, 0.05, 0.14, 0, 0.52, 0, 0x30343c, 0, 0, 0, 6);
    for (const z of [-0.3, 0.3]) k.box(1.0, 0.05, 0.05, 0.05, -0.55, z, 0x30343c);
    return k.build();
}

export function rotorModel() {
    const k = new Kit();
    k.box(2.6, 0.03, 0.14, 0, 0, 0, 0x30343c);
    k.box(0.14, 0.03, 2.6, 0, 0, 0, 0x30343c);
    return k.build();
}

export function jetModel() {
    const k = new Kit();
    k.cyl(0.18, 0.18, 2.4, 0, 0, 0, 0xffffff, 1, 0, Math.PI / 2, 8);
    k.cone(0.18, 0.7, 1.5, 0, 0, 0xffffff, 1, 8, 0, -Math.PI / 2);
    k.box(0.9, 0.05, 3.2, -0.2, 0, 0, 0xffffff, 1);
    k.box(0.5, 0.05, 1.3, -1.0, 0.05, 0, 0xffffff, 1);
    k.box(0.5, 0.5, 0.05, -1.0, 0.3, 0, 0xffffff, 1);
    k.sph(0.16, 0.6, 0.15, 0, 0x9fdcff);
    return k.build();
}

export function shellModel() { const k = new Kit(); k.sph(0.2, 0, 0, 0, 0xffd166); k.sph(0.12, 0, 0, 0, 0xfff3b0); return k.build(); }
export function missileModel() {
    const k = new Kit();
    k.cyl(0.1, 0.1, 0.7, 0, 0, 0, 0xf4f4f4, 0, 0, Math.PI / 2, 6);
    k.cone(0.1, 0.25, 0.46, 0, 0, 0xe63946, 0, 6, 0, -Math.PI / 2);
    k.sph(0.13, -0.4, 0, 0, 0xffb347);
    return k.build();
}
export function bombModel() {
    const k = new Kit();
    k.sph(0.36, 0, 0, 0, 0x2b2d35, 0, 1, 1.2, 1);
    k.box(0.4, 0.04, 0.04, 0, 0.5, 0, 0x2b2d35);
    k.box(0.04, 0.04, 0.4, 0, 0.5, 0, 0x2b2d35);
    k.sph(0.09, 0, 0.5, 0, 0xff5a36);
    return k.build();
}
export function rubbleModel() {
    const k = new Kit();
    k.add(new THREE.IcosahedronGeometry(0.5, 0), { s: [1, 0.85, 0.95], c: 0xffffff, paint: 1 });
    return k.build();
}
export function gemModel() {
    const k = new Kit();
    k.add(new THREE.OctahedronGeometry(0.5, 0), { c: 0xffffff, paint: 1, s: [1, 1.3, 1] });
    k.tor(0.75, 0.05, 0, 0, 0, 0xffffff, 1, Math.PI / 2);
    return k.build();
}

// ---------------------------------------------------------------- the kaiju

/** The curled-up monster, radius 1: green scaly ball, face at +z, spiky back, tail wrapped round. */
export function buildKaiju() {
    const k = new Kit();
    const GREEN = new THREE.Color(0x73d98a), DARK = new THREE.Color(0x4aa866), BELLY = new THREE.Color(0xfff0b8);
    k.add(new THREE.SphereGeometry(0.98, 28, 20), {
        cf: (x, y, z) => {
            const belly = (-y * 0.9 + z * 0.35);
            if (belly > 0.55) return BELLY.getHex();
            const band = Math.sin(x * 7 + y * 4 + z * 2) > 0.62 ? DARK : GREEN;
            return band.getHex();
        },
    });
    // back spikes along a great circle over the top and down the far side
    for (let i = 0; i < 15; i++) {
        const a = -0.1 + (i / 14) * 3.2;               // from the crown, over the back
        const x = 0, y = Math.cos(a) * 0.95, z = -Math.sin(a) * 0.95;
        const nx = 0, ny = Math.cos(a), nz = -Math.sin(a);
        const big = 0.18 + 0.2 * Math.sin((i / 14) * Math.PI);
        const ang = Math.atan2(nz, ny);
        k.add(new THREE.ConeGeometry(big * 0.7, big * 2.2, 6), { p: [x + nx * 0.18, y + ny * 0.18, z + nz * 0.18], r: [ang, 0, 0], c: i % 2 ? 0xffb347 : 0xff8c42 });
    }
    // little side plates
    for (let i = 0; i < 10; i++) {
        const a = rnd(i) * 6.28, b = (rnd(i + 20) - 0.5) * 2;
        const s = Math.sqrt(1 - b * b);
        const dx = Math.cos(a) * s, dy = b, dz = Math.sin(a) * s;
        if (dz > 0.3) continue;
        k.add(new THREE.ConeGeometry(0.1, 0.24, 5), { p: [dx * 0.97, dy * 0.97, dz * 0.97], r: [Math.atan2(dz, dy) * 0 + (dy < 0 ? Math.PI : 0), 0, -dx * 1.2], c: 0xffd27a });
    }
    // face on +z: eyes, snout, nostrils, teeth, horns
    k.sph(0.24, 0.3, 0.38, 0.8, 0xffffff, 0, 1, 1.15, 0.7);
    k.sph(0.24, -0.3, 0.38, 0.8, 0xffffff, 0, 1, 1.15, 0.7);
    k.sph(0.11, 0.33, 0.38, 0.95, 0x1c1c2b, 0, 1, 1.2, 0.6);
    k.sph(0.11, -0.27, 0.38, 0.95, 0x1c1c2b, 0, 1, 1.2, 0.6);
    k.sph(0.035, 0.36, 0.43, 1.0, 0xffffff);
    k.sph(0.035, -0.24, 0.43, 1.0, 0xffffff);
    k.sph(0.34, 0, -0.08, 0.86, 0x8fe6a0, 0, 1.2, 0.8, 0.7);
    k.sph(0.05, 0.12, 0.05, 1.1, 0x2a6b47);
    k.sph(0.05, -0.12, 0.05, 1.1, 0x2a6b47);
    for (let i = -3; i <= 3; i++) k.cone(0.04, 0.12, i * 0.1, -0.2, 1.08 - Math.abs(i) * 0.035, 0xffffff, 0, 5, Math.PI);
    k.cone(0.1, 0.38, 0.52, 0.8, 0.5, 0xfff2cc, 0, 6, 0.4, -0.5);
    k.cone(0.1, 0.38, -0.52, 0.8, 0.5, 0xfff2cc, 0, 6, 0.4, 0.5);
    // tiny arms hugging the ball and two feet
    k.sph(0.13, 0.78, -0.25, 0.55, 0x73d98a, 0, 1, 1, 1.4);
    k.sph(0.13, -0.78, -0.25, 0.55, 0x73d98a, 0, 1, 1, 1.4);
    k.sph(0.16, 0.4, -0.88, 0.35, 0x4aa866, 0, 1.2, 0.8, 1.3);
    k.sph(0.16, -0.4, -0.88, 0.35, 0x4aa866, 0, 1.2, 0.8, 1.3);
    // tail: a fat arc round the back and sides at belly height, never across the face (+z), ending in a tip
    k.tor(0.99, 0.17, 0, -0.25, 0, 0x4aa866, 0, Math.PI / 2, 0, Math.PI, Math.PI + 0.4, 28);
    k.cone(0.2, 0.6, 0.98, -0.25, 0.42, 0xffb347, 0, 6, Math.PI / 2, 0.35);
    return k.build();
}

/** A plain unit sphere used for the silhouette seen through buildings. */
export function silhouetteGeometry() { return new THREE.SphereGeometry(1, 20, 14); }

// ---------------------------------------------------------------- windowed buildings

/** Textures for the walls: a window per cell, in four styles, lit or dark. Drawn once into canvases. */
export function makeWindowTextures(night) {
    const texs = [];
    for (let st = 0; st < 4; st++) {
        const pair = [];
        for (let lit = 0; lit < 2; lit++) {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 64;
            const g = cv.getContext('2d');
            g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
            g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, 60, 64, 4);
            const glass = lit ? (night ? '#ffe9a8' : '#ffd98a') : (night ? '#6a7ca8' : '#7fa8c9');
            const frame = '#5b6475';
            const win = (x, y, w, h) => {
                g.fillStyle = frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
                g.fillStyle = glass; g.fillRect(x, y, w, h);
                g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, w * 0.4, h * 0.3);
            };
            if (st === 0) win(16, 14, 32, 34);
            else if (st === 1) { win(10, 12, 18, 40); win(36, 12, 18, 40); }
            else if (st === 2) win(4, 22, 56, 20);
            else { g.fillStyle = frame; g.beginPath(); g.arc(32, 32, 20, 0, 6.3); g.fill(); g.fillStyle = glass; g.beginPath(); g.arc(32, 32, 17, 0, 6.3); g.fill(); g.fillStyle = frame; g.fillRect(30, 15, 4, 34); g.fillRect(15, 30, 34, 4); }
            const t = new THREE.CanvasTexture(cv);
            t.colorSpace = THREE.SRGBColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 4;
            pair.push(t);
        }
        texs.push(pair);
    }
    return texs;
}

const wob = (b, y, Ht) => {
    if (!b.lean) return [0, 0];
    const A = 0.3 * b.lean * Math.min(1, y / 3);
    return [Math.sin(y * 0.55 + b.id) * A, Math.sin(y * 0.43 + b.id * 1.7) * A];
};
export const taperOf = (b) => (b.t === 'spire' ? 0.35 : b.t === 'sky' ? 0.14 : b.t === 'tower' ? 0.08 : 0);

/** Where the roof sits for a building with `floors` floors left: offset and scale of the top ring. */
export function roofPose(b, floors) {
    const Ht = b.fl0 * FLOOR_H, y = floors * FLOOR_H;
    const [ox, oz] = wob(b, y, Ht);
    return { y, ox, oz, s: 1 - taperOf(b) * (y / Ht) };
}

/** The body: floors × 4 quads, floor by floor so a draw range can drop the top floors. */
export function windowBody(b) {
    const n = b.fl0, w = b.w, d = b.d, Ht = n * FLOOR_H;
    const taper = taperOf(b);
    const pos = [], nor = [], uv = [], idx = [];
    const cellsX = Math.max(1, Math.round(w / 1.5)), cellsZ = Math.max(1, Math.round(d / 1.5));
    const ring = (y) => {
        const s = 1 - taper * (y / Ht), [ox, oz] = wob(b, y, Ht);
        return { hx: (w / 2) * s, hz: (d / 2) * s, ox, oz };
    };
    let vi = 0;
    const quad = (a, bq, c, dq, cells) => {
        const e1 = [bq[0] - a[0], bq[1] - a[1], bq[2] - a[2]], e2 = [dq[0] - a[0], dq[1] - a[1], dq[2] - a[2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        for (const v of [a, bq, c, dq]) { pos.push(v[0], v[1], v[2]); nor.push(nx, ny, nz); }
        uv.push(0, 0, cells, 0, cells, 1, 0, 1);
        idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
    };
    for (let f = 0; f < n; f++) {
        const y0 = f * FLOOR_H, y1 = y0 + FLOOR_H;
        const r0 = ring(y0), r1 = ring(y1);
        const P = (r, sx, sz, y) => [r.ox + sx * r.hx, y, r.oz + sz * r.hz];
        quad(P(r0, -1, 1, y0), P(r0, 1, 1, y0), P(r1, 1, 1, y1), P(r1, -1, 1, y1), cellsX);      // south
        quad(P(r0, 1, 1, y0), P(r0, 1, -1, y0), P(r1, 1, -1, y1), P(r1, 1, 1, y1), cellsZ);      // east
        quad(P(r0, 1, -1, y0), P(r0, -1, -1, y0), P(r1, -1, -1, y1), P(r1, 1, -1, y1), cellsX);  // north
        quad(P(r0, -1, -1, y0), P(r0, -1, 1, y0), P(r1, -1, 1, y1), P(r1, -1, -1, y1), cellsZ);  // west
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}
export const INDICES_PER_FLOOR = 24;

// ---------------------------------------------------------------- roofs

/** A roof / rooftop prop for a building. Origin: the centre of the roof's underside; y up. */
export function buildRoof(b, th) {
    const k = new Kit();
    const w = b.w * (1 - taperOf(b)), d = b.d * (1 - taperOf(b));
    const rc = th.roofs[(b.col + b.id) % th.roofs.length];
    const acc = th.accents[(b.id * 3) % th.accents.length];
    switch (b.roof) {
        case 'pitched': {
            const h = Math.min(w, d) * 0.55;
            k.add(new THREE.ConeGeometry(0.5, 1, 4), { p: [0, h / 2, 0], r: [0, Math.PI / 4, 0], s: [w * 1.45, h, d * 1.45], c: rc });
            k.box(w * 0.12, h * 0.6, w * 0.12, w * 0.25, h * 0.7, d * 0.1, 0xb85c38);
            break;
        }
        case 'cone': {
            const h = Math.min(w, d) * 0.9;
            k.cone(Math.min(w, d) * 0.62, h, 0, h / 2, 0, rc, 0, 10);
            k.sph(0.12, 0, h + 0.05, 0, 0xffe066);
            break;
        }
        case 'dome': {
            const r = Math.min(w, d) * 0.5;
            k.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0, 0], s: [r, r * 0.9, r], c: rc });
            k.cyl(0.05, 0.05, 0.6, 0, r * 0.9 + 0.2, 0, 0xdddddd);
            k.sph(0.14, 0, r * 0.9 + 0.55, 0, 0xffe066);
            break;
        }
        case 'spire': {
            const h = 1.6 + Math.min(w, d) * 1.6;
            k.box(w * 0.7, 0.3, d * 0.7, 0, 0.15, 0, rc);
            k.cone(Math.min(w, d) * 0.22, h, 0, 0.3 + h / 2, 0, acc, 0, 8);
            k.sph(0.14, 0, 0.3 + h, 0, 0xff5a5a);
            break;
        }
        case 'balloon': {
            k.box(w * 0.9, 0.18, d * 0.9, 0, 0.09, 0, rc);
            const cols = [0xff6b81, 0x4dabf7, 0xffd43b, 0x69db7c];
            for (let i = 0; i < 4; i++) {
                const a = i * 1.57 + b.id, rr = Math.min(w, d) * 0.25;
                const x = Math.cos(a) * rr, z = Math.sin(a) * rr, hgt = 1.4 + (i % 2) * 0.5;
                k.cyl(0.012, 0.012, hgt, x, 0.18 + hgt / 2, z, 0xdddddd, 0, 0, 0, 3);
                k.sph(0.36, x, 0.18 + hgt + 0.3, z, cols[i], 0, 1, 1.2, 1);
            }
            break;
        }
        case 'donut': {
            k.box(w * 0.9, 0.18, d * 0.9, 0, 0.09, 0, rc);
            k.cyl(0.1, 0.14, 0.7, 0, 0.55, 0, 0xdddddd, 0, 0, 0, 6);
            k.tor(0.55, 0.28, 0, 1.25, 0, 0xf7a8c8, 0, Math.PI / 2 - 0.35, 0, 0, Math.PI * 2, 18);
            k.tor(0.55, 0.12, 0, 1.4, 0, 0xfff1f6, 0, Math.PI / 2 - 0.35, 0, 0, Math.PI * 2, 18);
            break;
        }
        case 'teapot': {
            k.box(w * 0.9, 0.18, d * 0.9, 0, 0.09, 0, 0x6b7280);
            for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) k.cyl(0.05, 0.05, 0.9, x, 0.6, z, 0x8a5a3c, 0, 0, 0, 5);
            k.sph(0.62, 0, 1.4, 0, rc, 0, 1, 0.85, 1);
            k.cone(0.14, 0.5, 0.7, 1.55, 0, rc, 0, 6, 0, -1.0);
            k.tor(0.28, 0.06, -0.62, 1.4, 0, rc, 0, 0, 0, 0, Math.PI * 2, 10);
            k.sph(0.16, 0, 2.05, 0, 0xffe066);
            break;
        }
        case 'awning': {
            k.box(w, 0.2, d, 0, 0.1, 0, rc);
            for (let i = 0; i < 6; i++) k.box(w / 6, 0.12, 0.7, -w / 2 + (i + 0.5) * (w / 6), 0.25, d / 2 + 0.2, i % 2 ? 0xffffff : acc);
            k.box(0.5, 0.5, 0.5, -w * 0.25, 0.45, -d * 0.2, 0x9aa0ad);
            break;
        }
        case 'cap': {
            k.box(0.9, 0.4, 0.9, 0, 0.2, 0, acc);
            k.cone(0.3, 0.8, 0, 0.8, 0, acc, 0, 6);
            break;
        }
        case 'none': break;
        default: {                              // flat: a parapet, air conditioners and an antenna
            k.box(w, 0.16, d, 0, 0.08, 0, rc);
            k.box(w * 0.28, 0.45, d * 0.3, -w * 0.2, 0.38, d * 0.15, 0xa3a9b8);
            k.box(w * 0.2, 0.3, d * 0.2, w * 0.22, 0.31, -d * 0.2, 0xb8bdca);
            if (b.id % 3 === 0) { k.cyl(0.03, 0.03, 1.1, w * 0.3, 0.7, d * 0.25, 0x666b78, 0, 0, 0, 4); k.sph(0.07, w * 0.3, 1.28, d * 0.25, 0xff5a5a); }
        }
    }
    return k.build();
}

// ---------------------------------------------------------------- solid landmarks

export function buildSolid(b, th) {
    const k = new Kit();
    const acc = th.accents[(b.id * 3) % th.accents.length];
    if (b.t === 'deck') {
        k.box(b.w + 0.9, DECK_H * 0.5, b.d, 0, DECK_H * 0.25, 0, 0x777c88);
        k.box(0.12, 0.4, b.d, -b.w / 2 - 0.25, 0.4, 0, 0xe9edf3);
        k.box(0.12, 0.4, b.d, b.w / 2 + 0.25, 0.4, 0, 0xe9edf3);
        k.box(0.1, 0.02, b.d * 0.5, 0, DECK_H * 0.5 + 0.01, 0, 0xf4e285);
    } else if (b.t === 'pylon') {
        const H = b.fl0 * FLOOR_H;
        k.box(0.7, H, 0.7, 0, H / 2, 0, 0xe4572e);
        k.box(0.9, 0.3, 0.9, 0, H - 0.2, 0, 0xc23b1e);
        k.box(0.9, 0.3, 0.9, 0, H * 0.55, 0, 0xc23b1e);
        k.cone(0.4, 0.7, 0, H + 0.35, 0, 0xc23b1e, 0, 4);
    } else if (b.t === 'gas') {
        const H = b.fl0 * FLOOR_H;
        k.cyl(b.r, b.r, H, 0, H / 2, 0, 0xe63946, 0, 0, 0, 16);
        k.cyl(b.r + 0.05, b.r + 0.05, 0.3, 0, H * 0.35, 0, 0xffffff, 0, 0, 0, 16);
        k.cyl(b.r + 0.05, b.r + 0.05, 0.3, 0, H * 0.75, 0, 0xffffff, 0, 0, 0, 16);
        k.add(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, H, 0], s: [b.r, b.r * 0.6, b.r], c: 0xdfe3ea });
        k.cone(0.45, 1.1, 0, H + b.r * 0.6 + 0.7, 0, 0xff8c42, 0, 6);
        k.cyl(0.08, 0.08, 0.7, 0, H + b.r * 0.6 + 0.3, 0, 0x888888, 0, 0, 0, 5);
    } else if (b.t === 'ferris') {
        const R = 2.6, cy = R + 0.9, TAU = Math.PI * 2;
        const lean = Math.atan2(1.5, cy), L = Math.hypot(1.5, cy);
        for (const z of [-1.1, 1.1]) {
            k.tor(R, 0.07, 0, cy, z, 0xff6b81, 0, 0, 0, 0, TAU, 28);
            k.tor(R * 0.5, 0.05, 0, cy, z, 0xffd43b, 0, 0, 0, 0, TAU, 20);
            k.box(0.2, L, 0.2, -0.75, cy / 2, z, 0xe9edf3, 0, 0, -lean);
            k.box(0.2, L, 0.2, 0.75, cy / 2, z, 0xe9edf3, 0, 0, lean);
            for (let i = 0; i < 4; i++) k.box(R * 2, 0.05, 0.05, 0, cy, z, 0xf4f6fa, 0, 0, (i / 4) * Math.PI);
        }
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU, x = Math.cos(a) * R, y = cy + Math.sin(a) * R;
            k.box(0.9, 0.7, 1.3, x, y - 0.45, 0, [0xff6b81, 0x4dabf7, 0xffd43b, 0x69db7c][i % 4]);
            k.box(1.0, 0.06, 1.4, x, y - 0.05, 0, 0xffffff);
        }
        k.cyl(0.25, 0.25, 2.6, 0, cy, 0, 0xe9edf3, 0, Math.PI / 2, 0, 8);
        k.box(3.2, 0.3, 3.2, 0, 0.15, 0, 0x9aa3b5);
    } else if (b.t === 'statue') {
        const H = b.fl0 * FLOOR_H;
        k.cyl(0.95, 1.05, 1.2, 0, 0.6, 0, 0xcfd3dc, 0, 0, 0, 10);
        k.sph(0.8, 0, 2.1, 0, acc, 0, 1, 1.2, 1);          // a chubby monster-cat
        k.sph(0.5, 0, 3.2, 0, acc);
        k.cone(0.16, 0.4, -0.3, 3.65, 0, acc, 0, 4);
        k.cone(0.16, 0.4, 0.3, 3.65, 0, acc, 0, 4);
        k.sph(0.08, -0.2, 3.25, 0.44, 0x222222);
        k.sph(0.08, 0.2, 3.25, 0.44, 0x222222);
        void H;
    }
    return k.build();
}

// ---------------------------------------------------------------- small things for the world

export function sailboatModel() {
    const k = new Kit();
    k.box(1.8, 0.3, 0.7, 0, 0.15, 0, 0xffffff, 1);
    k.cyl(0.04, 0.04, 2.2, 0, 1.3, 0, 0x8a5a3c);
    k.add(new THREE.ConeGeometry(0.9, 1.8, 3), { p: [0.05, 1.3, 0], r: [0, 0, 0], s: [1, 1, 0.06], c: 0xffffff });
    return k.build();
}
