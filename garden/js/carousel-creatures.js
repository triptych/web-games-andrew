// The eight creatures of the Starlight Carousel, modelled from primitives in the
// old carved-and-gilded style: Cinder the ember dragon, Zephyr the pegasus,
// Nyx the unicorn whose hide is the night sky, Aurum the griffin, Marina the
// hippocampus, Ashling the phoenix, Kohaku the nine-tailed fox and Selene the
// moon moth. Each is built nose along +z with the saddle at the origin, where
// the carousel's pole runs through it, and merged into one mesh per material.

import * as THREE from 'three';
import { Batch } from './materials.js';
import { canvas, toTexture } from './textures.js';
import { TAU } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const V = (p) => new THREE.Vector3(p[0], p[1], p[2]);
const _o = new THREE.Object3D();

/** A transform from a position, YXZ rotation and scale. */
function M(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    _o.position.set(p[0], p[1], p[2]);
    _o.rotation.set(r[0], r[1], r[2], 'YXZ');
    _o.scale.set(s[0], s[1], s[2]);
    _o.updateMatrix();
    return _o.matrix.clone();
}

const spheres = new Map();
const sphere = (n) => {
    if (!spheres.has(n)) spheres.set(n, new THREE.SphereGeometry(1, n, Math.max(6, Math.round(n * 0.7))));
    return spheres.get(n);
};

/** A tube along a smooth curve whose radius follows `r(u)` from 0 to 1 along it. */
function taperTube(points, r, tubular = 24, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
    const pos = g.attributes.position;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
        const u = i / tubular;
        curve.getPointAt(u, c);
        const rad = typeof r === 'function' ? r(u) : r;
        for (let j = 0; j <= radial; j++) {
            const k = i * (radial + 1) + j;
            v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rad).add(c);
            pos.setXYZ(k, v.x, v.y, v.z);
        }
    }
    g.computeVertexNormals();
    return g;
}

/** A flat shape lying in the xz plane (shape x → x, shape y → z), its uvs spread over its bounds. */
function flatShape(shape, segs = 12) {
    const g = new THREE.ShapeGeometry(shape, segs);
    g.rotateX(Math.PI / 2);
    g.computeBoundingBox();
    const b = g.boundingBox, uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x || 1), (p.getZ(i) - b.min.z) / (b.max.z - b.min.z || 1));
    return g;
}

/** Collects parts under a stack of transforms, then merges them into one mesh per material. */
class Kit {
    constructor() {
        this.batch = new Batch();
        this.base = new THREE.Matrix4();
        this.stack = [];
    }
    push(m) {
        this.stack.push(this.base);
        this.base = this.base.clone().multiply(m);
        return this;
    }
    pop() {
        this.base = this.stack.pop();
        return this;
    }
    add(key, geo, m = new THREE.Matrix4()) {
        this.batch.add(key, geo, this.base.clone().multiply(m));
        return this;
    }
    /** An ellipsoid at p with radii s, turned by r. */
    ell(key, p, s, r = [0, 0, 0], n = 16) {
        return this.add(key, sphere(n), M(p, r, s));
    }
    /** A tapered limb from a to b with rounded joints. */
    limb(key, a, b, r0, r1 = r0, n = 10, joints = true) {
        const A = V(a), B = V(b), d = B.clone().sub(A);
        const len = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
        const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
        this.add(key, new THREE.CylinderGeometry(r1, r0, len, n, 1, true), m);
        if (joints) {
            this.ell(key, a, [r0, r0, r0], [0, 0, 0], n);
            this.ell(key, b, [r1, r1, r1], [0, 0, 0], n);
        }
        return this;
    }
    /** A cone with its base at a and its tip at b. */
    cone(key, a, b, r, n = 10) {
        const A = V(a), B = V(b), d = B.clone().sub(A);
        const len = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
        return this.add(key, new THREE.ConeGeometry(r, len, n), new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    }
    tube(key, pts, r, tubular = 24, radial = 8) {
        return this.add(key, taperTube(pts, r, tubular, radial));
    }
    build(mats) {
        return this.batch.build(mats);
    }
}

// ------------------------------------------------------------------ materials

const std = (o) => new THREE.MeshStandardMaterial(o);

function sharedMaterials() {
    return {
        gold: std({ color: 0xf0c060, roughness: 0.22, metalness: 1 }),
        silver: std({ color: 0xe8eef8, roughness: 0.2, metalness: 1 }),
        ruby: std({ color: 0xc0103a, emissive: 0xff2050, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3 }),
        sapphire: std({ color: 0x1a40d0, emissive: 0x3a6aff, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3 }),
        emerald: std({ color: 0x10a050, emissive: 0x20ff80, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3 }),
        pearl: std({ color: 0xfff6ee, roughness: 0.25, metalness: 0.35 }),
        eye: std({ color: 0x0c0a10, roughness: 0.1, metalness: 0.2 }),
        hoof: std({ color: 0x2a2026, roughness: 0.4, metalness: 0.2 }),
    };
}

/** A painted saddle with a cloth, gilded edging, a pommel and stirrups. */
function saddle(kit, cloth, y = 0.3, w = 0.27, len = 0.3) {
    kit.ell(cloth, [0, y - 0.05, -0.02], [w + 0.07, 0.06, len + 0.1]);
    kit.ell('gold', [0, y - 0.07, -0.02], [w + 0.09, 0.035, len + 0.12]);
    kit.ell(cloth, [0, y + 0.02, -0.02], [w * 0.8, 0.07, len * 0.85]);
    kit.ell('gold', [0, y + 0.07, len * 0.6], [0.07, 0.07, 0.06]);
    kit.ell(cloth, [0, y + 0.07, -len * 0.75], [w * 0.75, 0.08, 0.05]);
    kit.ell('ruby', [0, y + 0.13, len * 0.6], [0.035, 0.035, 0.035]);
    for (const sd of [-1, 1]) {
        kit.limb('gold', [sd * (w + 0.02), y - 0.02, 0.0], [sd * (w + 0.08), y - 0.42, 0.02], 0.012, 0.012, 5, false);
        kit.add('gold', new THREE.TorusGeometry(0.055, 0.012, 5, 12), M([sd * (w + 0.08), y - 0.47, 0.02], [0, Math.PI / 2, 0]));
        // a jewelled medallion on the cloth
        kit.ell('gold', [sd * (w + 0.06), y - 0.12, -0.05], [0.015, 0.06, 0.06]);
        kit.ell('sapphire', [sd * (w + 0.075), y - 0.12, -0.05], [0.012, 0.035, 0.035]);
    }
}

// --------------------------------------------------------------------- wings

/**
 * A feathered wing on side `sd` (+1 left, -1 right), rooted at `root`,
 * raised by `raise` and swept back by `sweep`.
 */
function featherWing(kit, sd, root, { span = 1.3, raise = 0.7, sweep = 0.25, n = 9, chord = 0.5, key = 'feather', tip = key, cover = key }) {
    kit.push(M(root, [0, sd * sweep, sd * raise]));
    // the leading edge: shoulder, elbow, wrist
    const elbow = [sd * span * 0.38, 0.06, 0.08], wrist = [sd * span * 0.72, 0.1, 0.02], end = [sd * span, 0.06, -0.12];
    kit.limb(cover, [0, 0, 0], elbow, 0.07, 0.05, 8);
    kit.limb(cover, elbow, wrist, 0.05, 0.04, 8);
    kit.limb(cover, wrist, end, 0.04, 0.02, 8);
    // primaries and secondaries: long flat feathers fanning back and out
    // a feather from (ax, ay, az) pointing back and out by `phi`
    const feather = (k, ax, ay, az, L, phi, w, th) => {
        kit.ell(k, [ax + (sd * Math.sin(phi) * L) / 2, ay, az - (Math.cos(phi) * L) / 2], [w, th, L / 2], [0.05, -sd * phi, 0], 10);
    };
    for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        feather(i > n * 0.55 ? tip : key, sd * span * (0.12 + 0.86 * u), 0.03 + Math.sin(u * Math.PI) * 0.05, 0.04, chord * (0.75 + 0.8 * u * u), 0.1 + 0.95 * u * u, 0.075, 0.016);
    }
    // coverts: a shorter row on top
    for (let i = 0; i < n - 2; i++) {
        const u = i / (n - 3);
        feather(cover, sd * span * (0.06 + 0.66 * u), 0.07 + Math.sin(u * Math.PI) * 0.04, 0.08, chord * (0.5 + 0.3 * u), 0.05 + 0.6 * u * u, 0.085, 0.022);
    }
    kit.pop();
}

/** A dragon's wing: finger bones with a scalloped membrane between them. */
function batWing(kit, sd, root, { span = 1.3, raise = 0.9, sweep = 0.35, bone = 'scale', skin = 'membrane', claw = 'horn' }) {
    kit.push(M(root, [0, sd * sweep, sd * raise]));
    const wrist = [span * 0.48, 0.08, 0.22];
    const tips = [[span * 1.0, 0.02, 0.05], [span * 0.92, 0, -0.35], [span * 0.7, -0.02, -0.62], [span * 0.4, -0.02, -0.72]];
    const s = new THREE.Shape();
    s.moveTo(0, 0.14);
    s.lineTo(wrist[0], wrist[2]);
    let prev = [wrist[0], wrist[2]];
    s.lineTo(tips[0][0], tips[0][2]);
    prev = [tips[0][0], tips[0][2]];
    for (let i = 1; i < tips.length; i++) {
        const t = tips[i];
        // the membrane sags inward between fingers
        const mx = (prev[0] + t[0]) / 2, mz = (prev[1] + t[2]) / 2;
        const cx = mx + (wrist[0] - mx) * 0.32, cz = mz + (wrist[2] - mz) * 0.32;
        s.quadraticCurveTo(cx, cz, t[0], t[2]);
        prev = [t[0], t[2]];
    }
    s.quadraticCurveTo(span * 0.18, -0.36, 0, -0.42);
    s.lineTo(0, 0.14);
    const g = flatShape(s, 10);
    if (sd < 0) g.scale(-1, 1, 1);
    kit.add(skin, g);
    const X = (p) => [sd * p[0], p[1], p[2]];
    kit.limb(bone, [0, 0, 0.1], X(wrist), 0.06, 0.04, 8);
    for (const t of tips) kit.limb(bone, X(wrist), X(t), 0.026, 0.01, 6);
    kit.cone(claw, X(wrist), X([wrist[0] + 0.02, wrist[1] + 0.12, wrist[2] + 0.06]), 0.03, 6);
    kit.pop();
}

// --------------------------------------------------------------------- horses

/**
 * A carousel horse: barrel, chest and rump, an arched neck, the head tucked,
 * the forelegs folded and the hind legs stretched out behind (a "jumper").
 * `k` names the materials; `hind: false` leaves the hind legs to a tail.
 */
function horse(kit, k, { hind = true, mane = true, tail = true, ears = true } = {}) {
    const B = k.body;
    kit.ell(B, [0, 0.02, -0.02], [0.29, 0.32, 0.6]);
    kit.ell(B, [0, 0.06, 0.4], [0.28, 0.33, 0.32]);
    if (hind) kit.ell(B, [0, 0.07, -0.44], [0.3, 0.32, 0.32]);
    // neck and head
    kit.limb(B, [0, 0.2, 0.5], [0, 0.74, 0.8], 0.2, 0.12, 14);
    kit.ell(B, [0, 0.46, 0.64], [0.15, 0.3, 0.2], [-0.55, 0, 0]);
    kit.ell(B, [0, 0.84, 0.92], [0.12, 0.13, 0.2], [0.5, 0, 0]);
    kit.ell(B, [0, 0.71, 1.08], [0.095, 0.1, 0.13], [0.65, 0, 0]);
    for (const sd of [-1, 1]) {
        kit.ell('eye', [sd * 0.095, 0.87, 0.97], [0.03, 0.034, 0.03]);
        kit.ell('eye', [sd * 0.045, 0.64, 1.16], [0.018, 0.014, 0.02]);
        if (ears) kit.cone(B, [sd * 0.06, 0.93, 0.84], [sd * 0.085, 1.08, 0.8], 0.035, 8);
    }
    // forelegs folded, one higher than the other
    for (const sd of [-1, 1]) {
        const lift = sd > 0 ? 0.08 : 0;
        const sh = [sd * 0.15, -0.04, 0.45], knee = [sd * 0.15, -0.3 + lift, 0.73 + lift * 0.4], foot = [sd * 0.15, -0.55 + lift * 1.5, 0.6 + lift];
        kit.limb(B, sh, knee, 0.085, 0.06, 10);
        kit.limb(B, knee, foot, 0.05, 0.042, 10);
        kit.limb(k.hoof || 'hoof', foot, [foot[0], foot[1] - 0.04, foot[2] - 0.05], 0.05, 0.055, 10);
    }
    if (hind) {
        for (const sd of [-1, 1]) {
            const hip = [sd * 0.16, -0.02, -0.5], hock = [sd * 0.16, -0.38, -0.74], foot = [sd * 0.16, -0.66, -0.96];
            kit.ell(B, [sd * 0.13, -0.08, -0.52], [0.13, 0.24, 0.2]);
            kit.limb(B, hip, hock, 0.09, 0.055, 10);
            kit.limb(B, hock, foot, 0.05, 0.042, 10);
            kit.limb(k.hoof || 'hoof', foot, [foot[0], foot[1] - 0.05, foot[2] - 0.02], 0.05, 0.055, 10);
        }
    }
    if (mane) {
        for (let i = 0; i < 8; i++) {
            const u = i / 7;
            const p = [0, 0.98 - u * 0.66, 0.82 - u * 0.44];
            kit.ell(k.mane, [0.02 * (i % 2 ? 1 : -1), p[1], p[2] - 0.08], [0.05, 0.13, 0.09], [-0.5 + u * 0.3, 0, (i % 2 ? 1 : -1) * 0.25]);
        }
        kit.ell(k.mane, [0, 0.98, 0.96], [0.05, 0.07, 0.09], [0.6, 0, 0]);
    }
    if (tail) {
        kit.tube(k.mane, [[0, 0.12, -0.7], [0, 0.08, -0.92], [0.04, -0.12, -1.05], [0.02, -0.4, -1.02], [-0.04, -0.58, -0.92]], (u) => 0.07 + Math.sin(u * Math.PI) * 0.07, 20, 8);
    }
    // bridle, reins and a jewel on the brow and the breast strap
    kit.add('gold', new THREE.TorusGeometry(0.1, 0.012, 6, 18), M([0, 0.72, 1.06], [0.65, 0, 0], [1, 1.05, 1]));
    kit.add('gold', new THREE.TorusGeometry(0.125, 0.012, 6, 18), M([0, 0.85, 0.89], [0.5, 0, 0], [1, 1.08, 1]));
    kit.ell(k.jewel || 'ruby', [0, 0.93, 1.0], [0.03, 0.03, 0.02], [0.5, 0, 0]);
    for (const sd of [-1, 1]) kit.tube('gold', [[sd * 0.1, 0.72, 1.03], [sd * 0.16, 0.5, 0.7], [sd * 0.12, 0.42, 0.25]], 0.01, 10, 4);
    kit.add('gold', new THREE.TorusGeometry(0.3, 0.018, 6, 24, Math.PI), M([0, 0.0, 0.4], [Math.PI / 2, 0, 0], [1, 1.17, 1]));
    kit.ell(k.jewel || 'ruby', [0, 0.0, 0.755], [0.045, 0.045, 0.03]);
}

// ------------------------------------------------------------------ textures

function nightSkyMaterial() {
    const uniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
    const m = std({ color: 0x140f3a, roughness: 0.32, metalness: 0.25, emissive: 0xffffff });
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSky;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSky = position;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', /* glsl */ `#include <common>
varying vec3 vSky;
uniform float uTime, uNight;
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h33(i).x, h33(i + vec3(1,0,0)).x, f.x), mix(h33(i + vec3(0,1,0)).x, h33(i + vec3(1,1,0)).x, f.x), f.y),
             mix(mix(h33(i + vec3(0,0,1)).x, h33(i + vec3(1,0,1)).x, f.x), mix(h33(i + vec3(0,1,1)).x, h33(i + vec3(1,1,1)).x, f.x), f.y), f.z); }
float fbm3(vec3 p) { return vn(p) * 0.55 + vn(p * 2.1) * 0.3 + vn(p * 4.3) * 0.15; }
float stars(vec3 p, float th, float t) {
  vec3 c = floor(p), f = fract(p) - 0.5, h = h33(c);
  float d = length(f - (h - 0.5) * 0.6);
  float s = smoothstep(0.06 + h.z * 0.07, 0.0, d) * step(th, h.x);
  return s * (0.55 + 0.45 * sin(t * (1.5 + h.y * 4.0) + h.z * 40.0));
}`)
            .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
{
  vec3 q = vSky * 2.4 + vec3(0.0, uTime * 0.02, uTime * 0.035);
  float n1 = fbm3(q), n2 = fbm3(q * 1.7 + 9.0);
  vec3 sky = mix(vec3(0.015, 0.012, 0.06), vec3(0.09, 0.03, 0.22), smoothstep(0.35, 0.8, n1));
  sky = mix(sky, vec3(0.03, 0.12, 0.3), smoothstep(0.55, 0.85, n2) * 0.8);
  diffuseColor.rgb = sky * 1.6;
  float st = stars(vSky * 26.0, 0.62, uTime) + stars(vSky * 58.0 + 3.0, 0.7, uTime * 1.3) * 0.7;
  float neb = smoothstep(0.62, 0.9, n1) * 0.6 + smoothstep(0.65, 0.9, n2) * 0.4;
  totalEmissiveRadiance = sky * (0.5 + 1.2 * uNight) + vec3(0.55, 0.3, 1.0) * neb * (0.15 + 0.6 * uNight)
    + vec3(1.0, 0.96, 0.88) * st * (1.4 + 3.5 * uNight);
}`);
    };
    m.customProgramCacheKey = () => 'carousel-nightsky';
    return m;
}

/** The luna moth's wing: pale green shading to white, a lilac leading edge and an eyespot. */
function mothWingTexture(hind) {
    const n = 256;
    const c = canvas(n);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(n * 0.15, n * 0.5, 4, n * 0.4, n * 0.5, n * 0.95);
    g.addColorStop(0, '#e6ffe0');
    g.addColorStop(0.3, '#a6f2b4');
    g.addColorStop(1, '#3fc48c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    // veins
    ctx.strokeStyle = 'rgba(80, 150, 110, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(0, n * 0.5);
        ctx.quadraticCurveTo(n * 0.5, n * (0.15 + i * 0.12), n, n * (0.05 + i * 0.15));
        ctx.stroke();
    }
    // the leading edge
    ctx.fillStyle = 'rgba(170, 120, 200, 0.85)';
    ctx.fillRect(0, hind ? n - 14 : n - 18, n, 18);
    // the eyespot
    const ex = n * 0.55, ey = n * 0.55;
    for (const [r, col] of [[34, '#ffd36a'], [26, '#b04a7a'], [18, '#2a1840'], [9, '#bfefff']]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(ex, ey, r * (hind ? 0.7 : 1), r * (hind ? 0.7 : 1.15), 0, 0, TAU);
        ctx.fill();
    }
    return toTexture(c);
}

// ------------------------------------------------------------------ creatures

/** Each creature: its card, where the rider's eyes are, and a builder. */
export const CREATURES = [
    {
        id: 'dragon', name: 'Cinder', kind: 'the Ember Dragon', icon: '\u{1F409}', accent: '#ff6a3a',
        desc: 'Scales like banked coals and wings that never quite cooled. After dark his eyes and throat glow.',
        build(kit, mats) {
            mats.scale = std({ color: 0xb8242c, roughness: 0.35, metalness: 0.45 });
            mats.belly = std({ color: 0xf2b04a, roughness: 0.3, metalness: 0.6 });
            mats.membrane = std({ color: 0xe0501e, emissive: 0xff3a00, emissiveIntensity: 0.12, roughness: 0.55, side: THREE.DoubleSide });
            mats.horn = std({ color: 0xf6e6c0, roughness: 0.35, metalness: 0.2 });
            mats.ember = std({ color: 0xff7a20, emissive: 0xff5a10, emissiveIntensity: 1.2, roughness: 0.3 });
            mats.cloth = std({ color: 0x1e2a6a, roughness: 0.6 });
            kit.night = [{ mat: mats.ember, day: 1.2, night: 4 }, { mat: mats.membrane, day: 0.15, night: 0.7 }];
            kit.ell('scale', [0, 0.02, -0.05], [0.29, 0.3, 0.66]);
            kit.ell('scale', [0, 0.1, 0.38], [0.27, 0.3, 0.3]);
            kit.ell('belly', [0, -0.08, 0.02], [0.24, 0.25, 0.62]);
            kit.ell('belly', [0, -0.02, 0.44], [0.22, 0.26, 0.24]);
            // the neck curls up in an S to a long head
            kit.tube('scale', [[0, 0.15, 0.46], [0, 0.42, 0.66], [0, 0.76, 0.7], [0, 0.98, 0.88]], (u) => 0.15 - u * 0.065, 20, 10);
            kit.tube('belly', [[0, 0.1, 0.54], [0, 0.4, 0.76], [0, 0.74, 0.8], [0, 0.92, 0.96]], (u) => 0.1 - u * 0.04, 20, 8);
            // a big horned head with the jaw open on a glow of embers
            kit.ell('scale', [0, 1.05, 1.03], [0.16, 0.15, 0.2]);
            kit.ell('scale', [0, 1.03, 1.28], [0.11, 0.08, 0.19], [0.05, 0, 0]);
            kit.ell('scale', [0, 0.92, 1.22], [0.09, 0.045, 0.17], [0.38, 0, 0]);
            kit.ell('ember', [0, 0.975, 1.22], [0.08, 0.035, 0.14], [0.2, 0, 0]);
            for (const sd of [-1, 1]) {
                kit.ell('ember', [sd * 0.125, 1.1, 1.12], [0.03, 0.024, 0.036]);
                kit.ell('scale', [sd * 0.09, 1.15, 1.1], [0.06, 0.03, 0.1], [0.2, 0, 0]);
                kit.ell('ember', [sd * 0.04, 1.06, 1.46], [0.016, 0.014, 0.016]);
                for (let i = 0; i < 4; i++) kit.cone('horn', [sd * 0.08, 0.99, 1.18 + i * 0.065], [sd * 0.075, 0.95, 1.19 + i * 0.065], 0.012, 4);
                kit.tube('belly', [[sd * 0.08, 1.15, 0.98], [sd * 0.14, 1.28, 0.88], [sd * 0.17, 1.36, 0.7], [sd * 0.12, 1.4, 0.54]], (u) => 0.055 * (1 - u) + 0.004, 14, 6);
                // a fin behind each cheek
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.quadraticCurveTo(0.08, -0.05, 0.2, -0.12);
                s.lineTo(0.1, 0.02);
                s.lineTo(0.18, 0.06);
                s.lineTo(0, 0.1);
                const fin = flatShape(s, 4);
                if (sd < 0) fin.scale(-1, 1, 1);
                kit.add('membrane', fin, M([sd * 0.1, 1.04, 0.98], [Math.PI / 2 - 0.2, 0, sd * 0.4]));
                // legs: the forelegs reach, the hind legs push off
                kit.limb('scale', [sd * 0.17, -0.02, 0.4], [sd * 0.2, -0.24, 0.66], 0.09, 0.065, 10);
                kit.limb('scale', [sd * 0.2, -0.24, 0.66], [sd * 0.2, -0.46, 0.6], 0.06, 0.05, 10);
                kit.limb('scale', [sd * 0.18, 0.0, -0.5], [sd * 0.2, -0.36, -0.7], 0.11, 0.07, 10);
                kit.limb('scale', [sd * 0.2, -0.36, -0.7], [sd * 0.2, -0.62, -0.88], 0.06, 0.05, 10);
                for (const [fx, fy, fz] of [[0.2, -0.5, 0.6], [0.2, -0.66, -0.88]]) {
                    for (const c of [-1, 0, 1]) kit.cone('horn', [sd * fx + c * 0.03, fy, fz], [sd * fx + c * 0.04, fy - 0.07, fz + 0.06], 0.017, 5);
                }
            }
            batWing(kit, 1, [0.2, 0.3, 0.28], { span: 1.35, raise: 0.85, sweep: 0.4, bone: 'belly' });
            batWing(kit, -1, [-0.2, 0.3, 0.28], { span: 1.35, raise: 0.85, sweep: 0.4, bone: 'belly' });
            // a long tail with a spade at the end
            const tail = [[0, 0.06, -0.62], [0, -0.02, -0.98], [0.18, -0.22, -1.26], [0.38, -0.18, -1.44], [0.46, 0.08, -1.52]];
            kit.tube('scale', tail, (u) => 0.17 * (1 - u) + 0.025, 28, 10);
            const sp = new THREE.Shape();
            sp.moveTo(0, -0.04);
            sp.quadraticCurveTo(0.16, 0.0, 0, 0.2);
            sp.quadraticCurveTo(-0.16, 0.0, 0, -0.04);
            const spade = flatShape(sp, 6);
            kit.add('membrane', spade, M([0.46, 0.1, -1.52], [-Math.PI / 2 + 0.3, 0.4, 0]));
            // spines down the back and tail
            const back = new THREE.CatmullRomCurve3([[0, 1.1, 0.95], [0, 0.88, 0.76], [0, 0.55, 0.62], [0, 0.32, 0.3], [0, 0.33, -0.3], [0, 0.22, -0.66], [0, 0.1, -1.0], [0.18, -0.08, -1.28], [0.38, -0.06, -1.44]].map(V));
            for (let i = 0; i < 16; i++) {
                const u = i / 15;
                if (u > 0.36 && u < 0.5) continue; // not under the saddle
                const p = back.getPointAt(u);
                const r = 0.065 * (1 - Math.abs(u - 0.45)) + 0.018;
                kit.cone('belly', [p.x, p.y - 0.02, p.z], [p.x, p.y + r * 2.8, p.z - r * 1.4], r, 5);
            }
            saddle(kit, 'cloth', 0.31);
        },
    },
    {
        id: 'pegasus', name: 'Zephyr', kind: 'the Pegasus', icon: '\u{1FAB6}', accent: '#9fd8ff',
        desc: 'White as the top of a cloud, with gold in her mane. She holds her wings up for balance, she says, not to show off.',
        build(kit, mats) {
            mats.coat = std({ color: 0xf6f4ff, roughness: 0.45 });
            mats.mane = std({ color: 0xf2c25a, roughness: 0.35, metalness: 0.5 });
            mats.feather = std({ color: 0xffffff, roughness: 0.5 });
            mats.tip = std({ color: 0xcfe6ff, roughness: 0.45, emissive: 0x8fc8ff, emissiveIntensity: 0.05 });
            mats.cloth = std({ color: 0x3a8fd8, roughness: 0.6 });
            kit.night = [{ mat: mats.tip, day: 0.05, night: 0.6 }];
            horse(kit, { body: 'coat', mane: 'mane', hoof: 'gold', jewel: 'sapphire' });
            featherWing(kit, 1, [0.18, 0.3, 0.28], { span: 1.35, raise: 0.75, sweep: 0.3, key: 'feather', tip: 'tip', cover: 'coat' });
            featherWing(kit, -1, [-0.18, 0.3, 0.28], { span: 1.35, raise: 0.75, sweep: 0.3, key: 'feather', tip: 'tip', cover: 'coat' });
            saddle(kit, 'cloth');
        },
    },
    {
        id: 'unicorn', name: 'Nyx', kind: 'the Night-Sky Unicorn', icon: '\u{1F984}', accent: '#a98bff',
        desc: 'Her hide is the sky after midnight, with its own stars and nebulae drifting through it, and her horn gives off starlight. She likes the fireworks best.',
        build(kit, mats) {
            mats.sky = nightSkyMaterial();
            mats.ribbon = std({ color: 0x4a2a9a, emissive: 0x8a5aff, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.88 });
            mats.horn = std({ color: 0xdfe8ff, emissive: 0xbfd0ff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.6 });
            mats.cloth = std({ color: 0x14102a, roughness: 0.5, metalness: 0.3 });
            kit.night = [{ mat: mats.ribbon, day: 0.5, night: 2.2 }, { mat: mats.horn, day: 0.6, night: 3.2 }];
            kit.sky = mats.sky;
            horse(kit, { body: 'sky', mane: 'ribbon', hoof: 'silver', jewel: 'sapphire' });
            // a spiral horn
            const g = new THREE.ConeGeometry(0.045, 0.42, 12, 12);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i) + 0.21, a = Math.atan2(p.getZ(i), p.getX(i));
                const k = 1 + 0.22 * Math.sin(a * 2 + y * 48);
                p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
            }
            g.computeVertexNormals();
            kit.add('horn', g, M([0, 1.08, 1.06], [0.95, 0, 0]));
            // flowing ribbons of mane and a long tail of them
            for (let i = 0; i < 5; i++) {
                const sd = i % 2 ? 1 : -1;
                kit.tube('ribbon', [[0, 0.98 - i * 0.12, 0.8 - i * 0.08], [sd * 0.14, 0.86 - i * 0.12, 0.62 - i * 0.08], [sd * 0.2, 0.62 - i * 0.1, 0.46 - i * 0.06], [sd * 0.16, 0.42 - i * 0.08, 0.3]], (u) => 0.035 * (1 - u) + 0.008, 14, 5);
            }
            for (let i = 0; i < 4; i++) {
                const sd = (i - 1.5) * 0.06;
                kit.tube('ribbon', [[sd, 0.12, -0.7], [sd * 2, 0.1, -0.95], [sd * 3, -0.12, -1.12], [sd * 4 + 0.05, -0.42, -1.1], [sd * 3, -0.6, -0.98]], (u) => 0.05 * (1 - u * 0.7), 18, 6);
            }
            saddle(kit, 'cloth');
            // little silver stars on the saddle cloth
            for (const sd of [-1, 1]) kit.add('silver', new THREE.OctahedronGeometry(0.05, 0), M([sd * 0.36, 0.22, -0.15], [0, 0, 0.6], [0.4, 1, 1]));
        },
    },
    {
        id: 'griffin', name: 'Aurum', kind: 'the Griffin', icon: '\u{1F985}', accent: '#ffcf5a',
        desc: 'Eagle before and lion behind, and proud of both halves. Griffins guard gold; he guards the brass ring.',
        build(kit, mats) {
            mats.fur = std({ color: 0xc8904a, roughness: 0.6 });
            mats.plume = std({ color: 0xfff6e6, roughness: 0.5 });
            mats.feather = std({ color: 0xa0602a, roughness: 0.5 });
            mats.tip = std({ color: 0x5a3418, roughness: 0.5 });
            mats.beak = std({ color: 0xffc23a, roughness: 0.3, metalness: 0.4 });
            mats.cloth = std({ color: 0x8a1838, roughness: 0.6 });
            kit.ell('fur', [0, 0.02, -0.12], [0.29, 0.3, 0.58]);
            kit.ell('fur', [0, 0.05, -0.46], [0.3, 0.31, 0.3]);
            kit.ell('plume', [0, 0.08, 0.36], [0.28, 0.33, 0.32]);
            kit.ell('plume', [0, 0.02, 0.16], [0.3, 0.3, 0.2]);
            // a feathered neck and an eagle's head
            kit.tube('plume', [[0, 0.18, 0.46], [0, 0.48, 0.64], [0, 0.76, 0.8], [0, 0.9, 0.88]], (u) => 0.19 - u * 0.08, 18, 12);
            // a ruff of feathers where the eagle meets the lion
            for (let i = 0; i < 9; i++) {
                const a = (i / 8 - 0.5) * 2.6;
                kit.ell('plume', [Math.sin(a) * 0.27, 0.06 + Math.cos(a) * 0.2, 0.12], [0.07, 0.15, 0.05], [0.5, 0, -a]);
            }
            kit.ell('plume', [0, 0.9, 0.9], [0.13, 0.13, 0.16]);
            kit.tube('beak', [[0, 0.9, 1.0], [0, 0.89, 1.12], [0, 0.84, 1.2], [0, 0.76, 1.19]], (u) => 0.055 * (1 - u) + 0.008, 12, 8);
            kit.ell('beak', [0, 0.85, 1.07], [0.05, 0.03, 0.06]);
            for (const sd of [-1, 1]) {
                kit.ell('eye', [sd * 0.085, 0.94, 0.98], [0.025, 0.025, 0.025]);
                kit.ell('beak', [sd * 0.09, 0.95, 0.975], [0.02, 0.008, 0.03]);
                kit.cone('plume', [sd * 0.07, 0.98, 0.84], [sd * 0.12, 1.12, 0.72], 0.04, 6);
                // eagle's forelegs with talons, lion's hind legs with paws
                kit.limb('plume', [sd * 0.15, 0.0, 0.4], [sd * 0.16, -0.24, 0.66], 0.09, 0.06, 10);
                kit.limb('beak', [sd * 0.16, -0.24, 0.66], [sd * 0.16, -0.48, 0.58], 0.04, 0.035, 8);
                for (const c of [-1, 0, 1]) kit.cone('eye', [sd * 0.16 + c * 0.03, -0.5, 0.6], [sd * 0.16 + c * 0.04, -0.56, 0.68], 0.016, 5);
                kit.ell('fur', [sd * 0.14, -0.08, -0.5], [0.13, 0.24, 0.2]);
                kit.limb('fur', [sd * 0.16, -0.04, -0.52], [sd * 0.16, -0.38, -0.74], 0.09, 0.055, 10);
                kit.limb('fur', [sd * 0.16, -0.38, -0.74], [sd * 0.16, -0.64, -0.94], 0.05, 0.045, 10);
                kit.ell('fur', [sd * 0.16, -0.68, -0.96], [0.06, 0.04, 0.08]);
            }
            featherWing(kit, 1, [0.18, 0.3, 0.26], { span: 1.3, raise: 0.85, sweep: 0.35, key: 'feather', tip: 'tip', cover: 'plume' });
            featherWing(kit, -1, [-0.18, 0.3, 0.26], { span: 1.3, raise: 0.85, sweep: 0.35, key: 'feather', tip: 'tip', cover: 'plume' });
            kit.tube('fur', [[0, 0.1, -0.7], [0, 0.0, -0.95], [0, -0.3, -1.05], [0.05, -0.5, -0.98]], 0.035, 16, 6);
            kit.ell('tip', [0.05, -0.55, -0.96], [0.07, 0.1, 0.07]);
            kit.add('gold', new THREE.TorusGeometry(0.15, 0.02, 6, 20), M([0, 0.42, 0.62], [-0.9, 0, 0]));
            kit.ell('emerald', [0, 0.36, 0.76], [0.04, 0.04, 0.03], [-0.9, 0, 0]);
            saddle(kit, 'cloth');
        },
    },
    {
        id: 'hippocampus', name: 'Marina', kind: 'the Hippocampus', icon: '\u{1F30A}', accent: '#4ae0d0',
        desc: 'A sea-horse in the old sense: a horse in front and a fish behind. Fins for a mane, pearls on her bridle, and salt in her laugh.',
        build(kit, mats) {
            mats.coat = std({ color: 0x3ab8a8, roughness: 0.3, metalness: 0.45 });
            mats.fin = std({ color: 0x9ff6ff, emissive: 0x3ad8ff, emissiveIntensity: 0.1, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
            mats.scaleT = std({ color: 0x2a7ac0, roughness: 0.25, metalness: 0.7 });
            mats.cloth = std({ color: 0xf0a8c8, roughness: 0.6 });
            kit.night = [{ mat: mats.fin, day: 0.1, night: 1.4 }];
            horse(kit, { body: 'coat', mane: 'fin', hoof: 'pearl', jewel: 'pearl' }, { hind: false, tail: false, mane: false });
            // the fish tail, curling down and up behind
            const tail = [[0, 0.05, -0.35], [0, -0.06, -0.72], [0, -0.32, -0.98], [0, -0.36, -1.3], [0, -0.12, -1.5], [0, 0.18, -1.48]];
            kit.tube('scaleT', tail, (u) => 0.31 * (1 - u) ** 0.9 + 0.04, 30, 12);
            for (let i = 0; i < 5; i++) kit.add('pearl', new THREE.TorusGeometry(0.28 - i * 0.045, 0.012, 5, 18), M([0, -0.06 - i * 0.07, -0.66 - i * 0.12], [Math.PI / 2 - 0.5 - i * 0.25, 0, 0]));
            // the fluke
            for (const sd of [-1, 1]) {
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.quadraticCurveTo(0.3, 0.05, 0.42, 0.3);
                s.quadraticCurveTo(0.22, 0.18, 0.1, 0.22);
                s.lineTo(0, 0);
                const f = flatShape(s, 8);
                if (sd < 0) f.scale(-1, 1, 1);
                kit.add('fin', f, M([0, 0.18, -1.48], [-Math.PI / 2 + 0.6, 0, 0], [1, 1, 1.1]));
                // fins in place of hooves, and at the cheek
                const s2 = new THREE.Shape();
                s2.moveTo(0, 0);
                s2.quadraticCurveTo(0.14, -0.04, 0.2, -0.16);
                s2.quadraticCurveTo(0.08, -0.12, 0, -0.1);
                const f2 = flatShape(s2, 6);
                kit.add('fin', f2, M([sd * 0.17, -0.45, 0.62], [0.3, sd > 0 ? -0.2 : Math.PI + 0.2, 0]));
                kit.add('fin', f2.clone(), M([sd * 0.11, 0.84, 0.86], [Math.PI / 2, sd > 0 ? 0.5 : Math.PI - 0.5, 0], [0.8, 0.8, 0.8]));
            }
            // a fin crest down the neck
            const crest = new THREE.Shape();
            crest.moveTo(0, 0);
            for (let i = 0; i <= 6; i++) crest.quadraticCurveTo(i * 0.11 + 0.05, 0.2 + (i % 2) * 0.04, i * 0.11 + 0.1, 0.02);
            crest.lineTo(0.75, 0);
            crest.lineTo(0, 0);
            const cg = flatShape(crest, 6);
            kit.add('fin', cg, M([0, 1.0, 0.86], [Math.PI / 2, -Math.PI / 2, 0.95], [1, 1, 1]));
            kit.add('fin', cg.clone(), M([0, 0.1, -0.5], [Math.PI / 2, -Math.PI / 2, 0.2], [0.9, 1, 1]));
            for (let i = 0; i < 7; i++) kit.ell('pearl', [0, 0.82 - i * 0.05, 1.05 - i * 0.05], [0.022, 0.022, 0.022]);
            saddle(kit, 'cloth');
        },
    },
    {
        id: 'phoenix', name: 'Ashling', kind: 'the Phoenix', icon: '\u{1F525}', accent: '#ffa030',
        desc: 'Every five hundred years she burns down to a glowing egg and hatches again. Until then she rides the carousel. Her feathers are warm to the touch.',
        build(kit, mats) {
            mats.red = std({ color: 0xd8301a, emissive: 0xff3a10, emissiveIntensity: 0.2, roughness: 0.45 });
            mats.flame = std({ color: 0xffa020, emissive: 0xff7a10, emissiveIntensity: 0.6, roughness: 0.35 });
            mats.blaze = std({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 0.9, roughness: 0.3 });
            mats.cloth = std({ color: 0x5a1a6a, roughness: 0.6 });
            kit.night = [{ mat: mats.red, day: 0.2, night: 0.9 }, { mat: mats.flame, day: 0.6, night: 2.6 }, { mat: mats.blaze, day: 0.9, night: 3.6 }];
            kit.ell('red', [0, 0.04, -0.05], [0.27, 0.28, 0.56]);
            kit.ell('flame', [0, 0.02, 0.32], [0.24, 0.3, 0.28]);
            for (let i = 0; i < 9; i++) {
                const a = (i / 8 - 0.5) * 2.8;
                kit.ell(i % 2 ? 'blaze' : 'flame', [Math.sin(a) * 0.2, 0.22 + Math.cos(a) * 0.12, 0.48], [0.05, 0.13, 0.04], [0.7, 0, -a]);
            }
            kit.tube('red', [[0, 0.2, 0.4], [0, 0.5, 0.62], [0, 0.78, 0.66], [0, 0.9, 0.78]], (u) => 0.16 - u * 0.06, 16, 10);
            kit.ell('red', [0, 0.94, 0.84], [0.12, 0.12, 0.15]);
            kit.tube('gold', [[0, 0.94, 0.96], [0, 0.92, 1.08], [0, 0.86, 1.13], [0, 0.8, 1.11]], (u) => 0.045 * (1 - u) + 0.006, 12, 6);
            for (const sd of [-1, 1]) {
                kit.ell('eye', [sd * 0.08, 0.98, 0.92], [0.024, 0.024, 0.024]);
                kit.ell('blaze', [sd * 0.085, 0.985, 0.915], [0.012, 0.012, 0.012]);
                // tucked legs and talons
                kit.limb('gold', [sd * 0.12, -0.2, 0.1], [sd * 0.14, -0.45, 0.24], 0.04, 0.03, 6);
                for (const c of [-1, 0, 1]) kit.cone('gold', [sd * 0.14, -0.45, 0.24], [sd * 0.14 + c * 0.05, -0.5, 0.33], 0.014, 5);
            }
            // a crest of flame plumes
            for (let i = 0; i < 5; i++) {
                const a = (i - 2) * 0.22;
                kit.tube(i % 2 ? 'blaze' : 'flame', [[0, 1.02, 0.84], [Math.sin(a) * 0.08, 1.16, 0.76], [Math.sin(a) * 0.14, 1.26, 0.6], [Math.sin(a) * 0.12, 1.24, 0.46]], (u) => 0.03 * (1 - u) + 0.006, 12, 5);
            }
            featherWing(kit, 1, [0.18, 0.28, 0.24], { span: 1.4, raise: 1.0, sweep: 0.3, key: 'flame', tip: 'blaze', cover: 'red' });
            featherWing(kit, -1, [-0.18, 0.28, 0.24], { span: 1.4, raise: 1.0, sweep: 0.3, key: 'flame', tip: 'blaze', cover: 'red' });
            // long trailing tail plumes with an eye at each end
            for (let i = 0; i < 7; i++) {
                const a = (i - 3) * 0.17;
                const L = 1.0 + (3 - Math.abs(i - 3)) * 0.12;
                const end = [Math.sin(a) * 0.5, -0.5 + Math.cos(a * 2) * 0.1, -0.45 - L];
                kit.tube(i % 2 ? 'flame' : 'red', [[Math.sin(a) * 0.05, 0.05, -0.5], [Math.sin(a) * 0.22, 0.02, -0.5 - L * 0.4], [Math.sin(a) * 0.38, -0.2, -0.45 - L * 0.75], end], (u) => 0.035 + Math.sin(u * Math.PI) * 0.03, 16, 5);
                kit.ell('blaze', end, [0.06, 0.02, 0.09], [0, a, 0]);
                kit.ell('ruby', [end[0], end[1] + 0.012, end[2]], [0.025, 0.012, 0.035], [0, a, 0]);
            }
            saddle(kit, 'cloth');
        },
    },
    {
        id: 'kitsune', name: 'Kohaku', kind: 'the Nine-Tailed Fox', icon: '\u{1F98A}', accent: '#ff9a7a',
        desc: 'A kitsune grows a tail for every hundred years. Kohaku has nine, and a cousin who wanders over from Worldroot. At night her foxfire comes out to play.',
        build(kit, mats) {
            mats.fur = std({ color: 0xfff8f0, roughness: 0.65 });
            mats.mark = std({ color: 0xe0303a, roughness: 0.5 });
            mats.foxfire = std({ color: 0x9fe8ff, emissive: 0x6fd8ff, emissiveIntensity: 0.4, roughness: 0.2, transparent: true, opacity: 0.9 });
            mats.cloth = std({ color: 0x2a1a4a, roughness: 0.55 });
            kit.night = [{ mat: mats.foxfire, day: 0.4, night: 3.2 }];
            kit.ell('fur', [0, 0.0, -0.05], [0.26, 0.28, 0.58]);
            kit.ell('fur', [0, 0.06, 0.38], [0.26, 0.31, 0.28]);
            kit.ell('fur', [0, 0.12, 0.56], [0.2, 0.24, 0.16]);
            kit.ell('fur', [0, 0.04, -0.42], [0.27, 0.28, 0.28]);
            kit.limb('fur', [0, 0.25, 0.5], [0, 0.58, 0.68], 0.16, 0.13, 12);
            // a broad fox's head: fluffed cheeks, a long pointed muzzle and tall ears
            kit.ell('fur', [0, 0.68, 0.74], [0.17, 0.15, 0.16]);
            kit.tube('fur', [[0, 0.65, 0.8], [0, 0.62, 0.92], [0, 0.6, 1.04]], (u) => 0.085 * (1 - u) + 0.022, 12, 10);
            kit.ell('eye', [0, 0.6, 1.045], [0.028, 0.022, 0.022]);
            for (const sd of [-1, 1]) {
                kit.ell('fur', [sd * 0.13, 0.6, 0.72], [0.1, 0.08, 0.1], [0, 0, sd * 0.5]);
                kit.cone('fur', [sd * 0.1, 0.76, 0.7], [sd * 0.17, 1.06, 0.64], 0.09, 8);
                kit.cone('mark', [sd * 0.1, 0.77, 0.735], [sd * 0.16, 1.0, 0.675], 0.052, 6);
                kit.ell('eye', [sd * 0.085, 0.71, 0.865], [0.028, 0.014, 0.02], [0, 0, sd * 0.35]);
                kit.ell('mark', [sd * 0.1, 0.735, 0.85], [0.045, 0.012, 0.03], [0, 0, sd * 0.4]);
                kit.ell('mark', [sd * 0.115, 0.64, 0.86], [0.012, 0.035, 0.045]);
                // slender legs, black stockings
                kit.limb('fur', [sd * 0.13, -0.02, 0.4], [sd * 0.14, -0.26, 0.62], 0.07, 0.05, 10);
                kit.limb('eye', [sd * 0.14, -0.26, 0.62], [sd * 0.14, -0.46, 0.54], 0.04, 0.035, 8);
                kit.limb('fur', [sd * 0.14, 0.0, -0.44], [sd * 0.14, -0.32, -0.64], 0.08, 0.05, 10);
                kit.limb('eye', [sd * 0.14, -0.32, -0.64], [sd * 0.14, -0.56, -0.86], 0.04, 0.035, 8);
            }
            kit.ell('mark', [0, 0.79, 0.84], [0.03, 0.012, 0.05], [0.6, 0, 0]);
            // nine tails, fanned out behind like a peacock's
            for (let i = 0; i < 9; i++) {
                const a = (i - 4) * 0.3;
                const lift = 0.4 + Math.cos(a) * 0.35;
                const pts = [[0, 0.08, -0.6], [Math.sin(a) * 0.3, 0.12 + lift * 0.3, -0.9], [Math.sin(a) * 0.6, 0.3 + lift * 0.6, -1.0], [Math.sin(a) * 0.72, 0.55 + lift * 0.7, -0.88]];
                kit.tube('fur', pts, (u) => 0.06 + Math.sin(Math.min(1, u * 1.1) * Math.PI) * 0.09, 18, 8);
                const tip = pts[3];
                kit.ell('mark', [tip[0], tip[1], tip[2]], [0.07, 0.07, 0.07]);
                kit.ell('foxfire', [tip[0] * 1.08, tip[1] + 0.14, tip[2] + 0.02], [0.045, 0.07, 0.045]);
            }
            kit.add('mark', new THREE.TorusGeometry(0.15, 0.025, 6, 18), M([0, 0.42, 0.6], [-0.9, 0, 0]));
            kit.add('gold', new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), M([0, 0.3, 0.74], [-0.9 + Math.PI / 2, 0, 0]));
            saddle(kit, 'cloth', 0.3, 0.25);
        },
    },
    {
        id: 'moth', name: 'Selene', kind: 'the Moon Moth', icon: '\u{1F319}', accent: '#9ff0c0',
        desc: 'A luna moth as big as a pony, soft as a cushion and pale as the moon she is named for. Her wings glow after dark.',
        build(kit, mats) {
            mats.fluff = std({ color: 0xf6fff4, roughness: 0.9 });
            mats.band = std({ color: 0xbfa0e0, roughness: 0.7 });
            const wing = (hind) => {
                const t = mothWingTexture(hind);
                return std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05, roughness: 0.7, side: THREE.DoubleSide });
            };
            mats.fore = wing(false);
            mats.hind = wing(true);
            mats.cloth = std({ color: 0x6a4aa0, roughness: 0.6 });
            kit.night = [{ mat: mats.fore, day: 0.05, night: 0.65 }, { mat: mats.hind, day: 0.05, night: 0.65 }];
            kit.ell('fluff', [0, 0.04, 0.1], [0.26, 0.27, 0.36]);
            kit.ell('fluff', [0, -0.02, -0.46], [0.22, 0.22, 0.46]);
            for (let i = 0; i < 4; i++) kit.add('band', new THREE.TorusGeometry(0.2 - i * 0.03, 0.025, 6, 18), M([0, -0.02, -0.3 - i * 0.14]));
            kit.ell('fluff', [0, 0.12, 0.5], [0.16, 0.16, 0.14]);
            for (const sd of [-1, 1]) {
                kit.ell('eye', [sd * 0.11, 0.15, 0.58], [0.06, 0.07, 0.06]);
                // feathery antennae
                const ant = [[sd * 0.05, 0.24, 0.58], [sd * 0.14, 0.44, 0.66], [sd * 0.24, 0.58, 0.6]];
                kit.tube('band', ant, 0.012, 10, 4);
                const curve = new THREE.CatmullRomCurve3(ant.map(V));
                for (let i = 1; i < 8; i++) {
                    const p = curve.getPointAt(i / 8);
                    kit.ell('band', [p.x, p.y, p.z], [0.012, 0.05, 0.02], [0, 0, sd * 0.5]);
                }
                // six thin legs, folded
                for (const [z, f] of [[0.3, 0.2], [0.12, 0.05], [-0.06, -0.12]]) {
                    kit.limb('band', [sd * 0.18, -0.14, z], [sd * 0.3, -0.36, z + 0.06], 0.02, 0.016, 5);
                    kit.limb('band', [sd * 0.3, -0.36, z + 0.06], [sd * 0.24, -0.52, f + 0.1], 0.016, 0.012, 5);
                }
                // the wings: a broad forewing and a hindwing with a long tail
                const fw = new THREE.Shape();
                fw.moveTo(0, 0.22);
                fw.quadraticCurveTo(0.6, 0.55, 1.15, 0.42);
                fw.quadraticCurveTo(1.1, -0.05, 0.8, -0.2);
                fw.quadraticCurveTo(0.4, -0.25, 0, -0.08);
                fw.lineTo(0, 0.22);
                const fg = flatShape(fw, 14);
                if (sd < 0) fg.scale(-1, 1, 1);
                kit.add('fore', fg, M([sd * 0.18, 0.22, 0.12], [0, sd * 0.1, sd * 0.75]));
                const hw = new THREE.Shape();
                hw.moveTo(0, 0.0);
                hw.quadraticCurveTo(0.55, 0.05, 0.75, -0.2);
                hw.quadraticCurveTo(0.6, -0.45, 0.5, -0.65);
                hw.quadraticCurveTo(0.55, -0.95, 0.42, -1.12);
                hw.quadraticCurveTo(0.3, -0.85, 0.25, -0.55);
                hw.quadraticCurveTo(0.08, -0.4, 0, -0.25);
                hw.lineTo(0, 0);
                const hg = flatShape(hw, 14);
                if (sd < 0) hg.scale(-1, 1, 1);
                kit.add('hind', hg, M([sd * 0.18, 0.12, -0.1], [0, -sd * 0.15, sd * 0.45]));
            }
            saddle(kit, 'cloth', 0.32, 0.24, 0.26);
        },
    },
];

/** Builds a creature: { group, info, night: [{ mat, day, night }], sky?: the night-sky material }. */
export function buildCreature(info, shared = sharedMaterials()) {
    const kit = new Kit();
    const mats = { ...shared };
    kit.night = [];
    info.build(kit, mats);
    const group = kit.build(mats);
    return { group, info, night: kit.night, sky: kit.sky ?? null };
}

export { sharedMaterials, Kit, M, taperTube, flatShape };
