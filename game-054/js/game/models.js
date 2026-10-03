/**
 * models.js — builds monster meshes from a species genome.
 *
 * A model is a small rig of bones (THREE.Group pivots). Each bone carries
 * one mesh whose geometry is every rigid part attached to it, merged, with
 * vertex colours and a glow attribute (eyes, fire, runes) — so a monster is
 * 6–14 draw calls however many horns it has. Geometry is cached per species
 * and shared by every instance; materials are per instance (hit flash,
 * dissolve, elite tint).
 *
 * Local space: feet at y = 0, facing +Z.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARCHETYPES } from './bestiary.js';
import { actorMaterial } from '../render/materials.js';

// ------------------------------------------------------------------ primitives

function hash3(x, y, z, s) {
    let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
    return h - Math.floor(h);
}
function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    let r = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const k = hash3(xi + dx, yi + dy, zi + dz, s);
        r += k * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    }
    return r;
}

function finish(geo, color, glow = 0) {
    geo.deleteAttribute('uv');
    const n = geo.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = color[0]; c[i * 3 + 1] = color[1]; c[i * 3 + 2] = color[2]; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
    return geo.index ? geo.toNonIndexed() : geo;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function T(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    _e.set(r[0], r[1], r[2], 'XYZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
    geo.applyMatrix4(_m);
    return geo;
}

/** Lumpy organic ellipsoid. */
function blob(rx, ry, rz, color, lump = 0.08, seed = 0, glow = 0, w = 14, h = 10) {
    const g = new THREE.SphereGeometry(1, w, h);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = vnoise(x * 2.3 + 5, y * 2.3, z * 2.3, seed) - 0.5;
        const k = 1 + n * lump * 2;
        p.setXYZ(i, x * rx * k, y * ry * k, z * rz * k);
    }
    g.computeVertexNormals();
    return finish(g, color, glow);
}
const sphere = (r, color, glow = 0, seg = 10) => finish(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)), color, glow);
const box = (w, h, d, color, glow = 0) => finish(new THREE.BoxGeometry(w, h, d), color, glow);
const cyl = (rt, rb, h, color, glow = 0, seg = 10) => finish(new THREE.CylinderGeometry(rt, rb, h, seg), color, glow);
const cone = (r, h, color, glow = 0, seg = 8) => finish(new THREE.ConeGeometry(r, h, seg), color, glow);
const torus = (r, t, color, glow = 0, arc = Math.PI * 2) => finish(new THREE.TorusGeometry(r, t, 6, 18, arc), color, glow);
/** A limb hanging down from its pivot: capsule from 0 to -len. */
const limb = (r, len, color, r2 = r) => T(finish(new THREE.CylinderGeometry(r, r2, len, 8, 1), color), [0, -len / 2, 0]);
const joint = (r, color) => sphere(r, color, 0, 8);

/** A curved horn: stacked tapering cones along an arc, base at origin pointing +Y. */
function horn(len, r, curl, color, glow = 0) {
    const parts = [];
    const seg = 4;
    let x = 0, y = 0, a = 0;
    for (let i = 0; i < seg; i++) {
        const l = len / seg;
        const rr = r * (1 - i / seg);
        const g = new THREE.CylinderGeometry(rr * 0.65, rr, l * 1.05, 7);
        T(g, [0, l / 2, 0]);
        T(g, [x, y, 0], [0, 0, -a]);
        parts.push(finish(g, color, glow));
        x += Math.sin(a) * l; y += Math.cos(a) * l;
        a += curl * 0.45;
    }
    const tip = new THREE.ConeGeometry(r * 0.3, len / seg, 6);
    T(tip, [0, len / seg / 2, 0]);
    T(tip, [x, y, 0], [0, 0, -a]);
    parts.push(finish(tip, color, glow));
    return mergeGeometries(parts);
}

function merge(list) {
    const ok = list.filter(Boolean);
    if (!ok.length) return null;
    const g = mergeGeometries(ok);
    g.computeBoundingSphere();
    g.userData.shared = true;
    return g;
}

// ------------------------------------------------------------------ rig description

class Rig {
    constructor() { this.bones = []; this.muzzles = {}; }
    /** name, parent, pivot position (relative to parent), parts list */
    bone(name, parent, pivot, parts, rot = [0, 0, 0]) { this.bones.push({ name, parent, pivot, parts, rot }); return this; }
    muzzle(name, bone, off) { this.muzzles[name] = { bone, off }; return this; }
}

// head with eyes, horns, jaw-ish details; returns parts list
function headParts(g, r, opts = {}) {
    const C = g.colors;
    const parts = [blob(r, r * 1.05, r * 1.1, opts.skin ?? C.skin, g.lump, g.seed + 1)];
    const ne = opts.eyes ?? g.eyes;
    const eyeR = r * (opts.eyeScale ?? 0.18);
    for (let k = 0; k < ne; k++) {
        const t = ne === 1 ? 0 : (k / (ne - 1)) * 2 - 1;
        const row = ne > 3 && k % 2 ? 0.25 : 0;
        parts.push(T(sphere(eyeR, hexToRgb(C.eye), 1, 8), [t * r * 0.48, r * (0.15 + row), r * 0.88]));
    }
    if (opts.horns !== false) {
        for (let k = 0; k < g.horns; k++) {
            const side = k % 2 ? -1 : 1;
            const pair = Math.floor(k / 2);
            const h = horn(r * 1.2 * g.hornLen * (1 - pair * 0.3), r * 0.22, g.hornCurl, C.bone);
            T(h, [0, 0, 0], [-0.3 - pair * 0.4, 0, side * (0.5 + pair * 0.5)]);
            T(h, [side * r * 0.55, r * 0.55, -pair * r * 0.3]);
            parts.push(h);
        }
    }
    if (opts.mouth !== false) {
        parts.push(T(box(r * 0.9, r * 0.12, r * 0.2, [0.08, 0.02, 0.02]), [0, -r * 0.35, r * 0.88]));
        for (let k = 0; k < 6; k++) parts.push(T(cone(r * 0.06, r * 0.2, C.bone, 0, 5), [(k / 5 - 0.5) * r * 0.75, -r * 0.3, r * 0.92], [Math.PI, 0, 0]));
        if (g.tusks) for (const s of [-1, 1]) parts.push(T(horn(r * 0.6, r * 0.12, -0.6, C.bone), [s * r * 0.45, -r * 0.45, r * 0.7], [0.6, 0, s * 0.3]));
    }
    return parts;
}

function backSpikes(g, n, len, z0, y0, y1, color) {
    const out = [];
    for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0.5 : k / (n - 1);
        out.push(T(cone(len * 0.18, len * (0.6 + 0.4 * Math.sin(t * Math.PI)), color, 0, 6), [0, y0 + (y1 - y0) * t, z0], [-1.2, 0, 0]));
    }
    return out;
}

// ------------------------------------------------------------------ plans

function planBiped(g, A, variant) {
    const C = g.colors;
    const H = A.height * g.scale;
    const legLen = H * 0.46 * g.legLen;
    const torsoH = H * 0.3;
    const tw = H * 0.16 * g.torsoW * (variant === 'brute' ? 1.35 : variant === 'jug' ? 1.45 : 1);
    const headR = H * 0.075 * g.headSize * (variant === 'brute' || variant === 'jug' ? 0.85 : 1);
    const upper = H * 0.2 * g.armLen, fore = H * 0.19 * g.armLen;
    const thigh = legLen * 0.5, shin = legLen * 0.5;
    const R = new Rig();
    const armR = H * 0.045 * (variant === 'husk' ? 1 : 1.5);
    const skin = C.skin, cloth = C.cloth;
    const husk = variant === 'husk';

    R.bone('hips', 'body', [0, legLen, 0], [blob(tw * 0.75, H * 0.07, tw * 0.55, husk ? cloth : skin, g.lump, g.seed + 2)]);
    const chest = [
        T(blob(tw, torsoH * 0.55, tw * 0.7, husk ? cloth : skin, g.lump, g.seed + 3), [0, torsoH * 0.55, 0]),
        T(blob(tw * 0.7, torsoH * 0.35, tw * 0.5, husk ? cloth : C.belly, g.lump, g.seed + 4), [0, torsoH * 0.25, tw * 0.2]),
    ];
    if (husk) {
        chest.push(T(box(tw * 1.5, torsoH * 0.5, tw * 1.05, C.metal), [0, torsoH * 0.6, 0]));
        chest.push(T(box(tw * 0.5, torsoH * 0.12, tw * 0.1, [0.6, 0.1, 0.08], 0.3), [0, torsoH * 0.75, tw * 0.55]));
    }
    if (g.plates || variant === 'jug') for (const s of [-1, 1]) chest.push(T(blob(tw * 0.45, tw * 0.25, tw * 0.45, variant === 'jug' ? C.metal : C.bone, 0.05, g.seed + 5 + s), [s * tw * 0.95, torsoH * 0.95, 0], [0, 0, s * 0.4]));
    if (!husk) chest.push(...backSpikes(g, g.spikes, H * 0.12, -tw * 0.6, torsoH * 0.3, torsoH * 1.0, C.bone));
    if (variant === 'jug') {
        // heart reactor
        chest.push(T(sphere(tw * 0.22, hexToRgb(C.eye), 1, 10), [0, torsoH * 0.6, tw * 0.62]));
        chest.push(T(torus(tw * 0.25, tw * 0.05, C.metal), [0, torsoH * 0.6, tw * 0.62]));
    }
    R.bone('torso', 'hips', [0, H * 0.03, 0], chest, [variant === 'brute' ? 0.15 : g.hunch * 0.2, 0, 0]);

    let head;
    if (husk) {
        head = [blob(headR, headR * 1.1, headR, skin, 0.1, g.seed + 6)];
        head.push(T(sphere(headR * 1.12, C.metal, 0, 10), [0, headR * 0.25, -headR * 0.05], [0, 0, 0], [1, 0.75, 1.05]));
        for (const s of [-1, 1]) head.push(T(sphere(headR * 0.16, hexToRgb(C.eye), 1, 6), [s * headR * 0.38, headR * 0.05, headR * 0.86]));
        head.push(T(box(headR * 1.0, headR * 0.25, headR * 0.3, [0.05, 0.05, 0.05]), [0, -headR * 0.45, headR * 0.75]));
    } else {
        head = headParts(g, headR);
    }
    R.bone('head', 'torso', [0, torsoH * 1.08, tw * 0.15], head);

    const shoulderX = tw * 1.02;
    for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        const uparts = [joint(armR * 1.35, husk ? cloth : skin), limb(armR, upper, husk ? cloth : skin, armR * 0.85)];
        R.bone('arm' + S, 'torso', [side * shoulderX, torsoH * 0.88, 0], uparts, [0, 0, side * 0.12]);
        const fparts = [joint(armR * 1.0, skin), limb(armR * 0.85, fore, skin, armR * 0.7)];
        if (husk && side > 0) {
            // rifle
            fparts.push(T(box(armR * 1.2, armR * 1.8, fore * 1.6, C.metal), [0, -fore, fore * 0.45]));
            fparts.push(T(cyl(armR * 0.35, armR * 0.35, fore * 0.8, [0.15, 0.15, 0.16]), [0, -fore + armR * 0.4, fore * 1.5], [Math.PI / 2, 0, 0]));
        } else if (variant === 'jug' && side > 0) {
            fparts.push(T(cyl(armR * 1.6, armR * 1.9, fore * 1.4, C.metal, 0, 10), [0, -fore * 0.9, fore * 0.2], [Math.PI / 2.4, 0, 0]));
            fparts.push(T(torus(armR * 1.5, armR * 0.3, [0.2, 0.2, 0.22]), [0, -fore * 1.25, fore * 0.75], [Math.PI / 2.4, 0, 0]));
            fparts.push(T(sphere(armR * 0.9, hexToRgb(C.eye), 1, 8), [0, -fore * 1.3, fore * 0.85]));
        } else {
            // claws
            for (let k = 0; k < 3; k++) fparts.push(T(cone(armR * 0.28, armR * 2.2, C.bone, 0, 5), [(k - 1) * armR * 0.6, -fore - armR * 0.9, armR * 0.3], [Math.PI - 0.3, 0, 0]));
            fparts.push(T(blob(armR * 1.2, armR * 1.0, armR * 1.1, C.belly, 0.1, g.seed + 8 + side), [0, -fore, 0]));
        }
        R.bone('fore' + S, 'arm' + S, [0, -upper, 0], fparts, [-0.35, 0, 0]);
    }
    for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        const legCol = husk ? cloth : (variant === 'jug' && side < 0 ? C.metal : skin);
        R.bone('leg' + S, 'hips', [side * tw * 0.5, 0, 0], [joint(armR * 1.4, legCol), limb(armR * 1.35, thigh, legCol, armR * 1.1)]);
        const foot = husk ? box(armR * 2.2, armR * 1.2, armR * 3.6, [0.12, 0.1, 0.08]) : cone(armR * 1.5, armR * 2.5, C.bone, 0, 6);
        R.bone('shin' + S, 'leg' + S, [0, -thigh, 0], [joint(armR * 1.1, legCol), limb(armR * 1.1, shin, legCol, armR * 0.9), T(foot, [0, -shin + armR * 0.5, armR * 0.9], husk ? [0, 0, 0] : [Math.PI / 2, 0, 0])]);
    }
    if (g.tail && !husk && variant !== 'jug') {
        const tl = [];
        for (let k = 0; k < 4; k++) tl.push(T(cone(armR * (1.2 - k * 0.25), H * 0.14, skin, 0, 6), [0, -H * 0.06 - k * H * 0.11, -H * 0.03 * k], [-0.4 - k * 0.15, 0, 0]));
        R.bone('tail', 'hips', [0, 0, -tw * 0.5], tl, [-0.7, 0, 0]);
    }
    if (husk) R.muzzle('gun', 'foreR', [0, -fore + armR * 0.4, fore * 1.9]);
    else if (variant === 'jug') R.muzzle('gun', 'foreR', [0, -fore * 1.35, fore * 0.95]);
    else R.muzzle('gun', 'foreR', [0, -fore, armR]);
    R.muzzle('hand', 'foreL', [0, -fore, armR]);
    R.muzzle('eye', 'head', [0, 0, headR]);
    R.height = H;
    return R;
}

function planQuad(g, A) {
    const C = g.colors;
    const H = A.height * g.scale;
    const legH = H * 0.42 * g.legLen;
    const bl = H * 0.55, bw = H * 0.3 * g.torsoW, bh = H * 0.28;
    const R = new Rig();
    const torso = [
        blob(bw, bh, bl, C.skin, g.lump * 1.3, g.seed + 1),
        T(blob(bw * 0.8, bh * 0.6, bl * 0.75, C.belly, g.lump, g.seed + 2), [0, -bh * 0.35, 0]),
        ...backSpikes(g, Math.max(2, g.spikes), H * 0.25, 0, 0, 0, C.bone).map((s, k) => T(s, [0, bh * 0.85, bl * (0.5 - k / Math.max(2, g.spikes))])),
    ];
    if (g.plates) for (let k = 0; k < 3; k++) torso.push(T(blob(bw * 0.7, bh * 0.25, bl * 0.18, C.bone, 0.05, g.seed + 3 + k), [0, bh * 0.85, bl * (0.4 - k * 0.4)]));
    R.bone('torso', 'body', [0, legH + bh * 0.5, 0], torso);
    const hr = H * 0.32 * g.headSize;
    const head = headParts(g, hr * 0.8, { mouth: false, eyeScale: 0.12 });
    head.push(T(blob(hr * 0.75, hr * 0.35, hr * 0.7, C.skin, g.lump, g.seed + 9), [0, hr * 0.1, hr * 0.35]));
    for (let k = 0; k < 8; k++) head.push(T(cone(hr * 0.07, hr * 0.3, C.bone, 0, 5), [((k % 4) / 3 - 0.5) * hr * 0.9, -hr * 0.22, hr * (0.55 + (k > 3 ? 0.18 : 0))], [Math.PI, 0, 0]));
    R.bone('head', 'torso', [0, bh * 0.35, bl * 0.9], head);
    const jaw = [T(blob(hr * 0.7, hr * 0.22, hr * 0.7, C.skin, g.lump, g.seed + 10), [0, -hr * 0.1, hr * 0.35])];
    for (let k = 0; k < 8; k++) jaw.push(T(cone(hr * 0.07, hr * 0.3, C.bone, 0, 5), [((k % 4) / 3 - 0.5) * hr * 0.85, hr * 0.1, hr * (0.55 + (k > 3 ? 0.12 : 0))]));
    R.bone('jaw', 'head', [0, -hr * 0.25, 0], jaw);
    const lr = H * 0.07;
    for (const [nm, x, z] of [['FL', -1, 1], ['FR', 1, 1], ['BL', -1, -1], ['BR', 1, -1]]) {
        R.bone('leg' + nm, 'torso', [x * bw * 0.75, -bh * 0.3, z * bl * 0.62], [joint(lr * 1.5, C.skin), limb(lr * 1.4, legH * 0.55, C.skin, lr)]);
        R.bone('shin' + nm, 'leg' + nm, [0, -legH * 0.55, 0], [joint(lr, C.skin), limb(lr, legH * 0.5, C.skin, lr * 0.8), T(cone(lr * 1.2, lr * 2, C.bone, 0, 6), [0, -legH * 0.5, lr], [Math.PI / 2, 0, 0])]);
    }
    if (g.tail) {
        const tl = [];
        for (let k = 0; k < 5; k++) tl.push(T(cone(lr * (1.2 - k * 0.2), H * 0.2, C.skin, 0, 6), [0, 0, -k * H * 0.16], [-Math.PI / 2, 0, 0]));
        R.bone('tail', 'torso', [0, bh * 0.2, -bl * 0.95], tl, [0.4, 0, 0]);
    }
    R.muzzle('mouth', 'head', [0, -hr * 0.2, hr * 0.8]);
    R.height = H;
    return R;
}

function planSkull(g, A) {
    const C = g.colors;
    const r = 0.36 * g.scale;
    const R = new Rig();
    const parts = [blob(r, r * 0.95, r * 1.05, C.skin, 0.05, g.seed)];
    for (const s of [-1, 1]) {
        parts.push(T(sphere(r * 0.28, [0.02, 0.01, 0.01], 0, 8), [s * r * 0.38, r * 0.12, r * 0.82]));
        parts.push(T(sphere(r * 0.16, hexToRgb(C.eye), 1, 8), [s * r * 0.38, r * 0.12, r * 0.92]));
    }
    parts.push(T(cone(r * 0.12, r * 0.25, [0.02, 0.01, 0.01], 0, 3), [0, -r * 0.15, r * 0.95], [Math.PI, 0, 0]));
    for (let k = 0; k < g.horns; k++) {
        const s = k % 2 ? -1 : 1;
        parts.push(T(horn(r * 0.9 * g.hornLen, r * 0.16, g.hornCurl, C.bone), [s * r * 0.5, r * 0.5, -r * 0.1 * (k >> 1)], [-0.3, 0, s * 0.7]));
    }
    // flame crown
    for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        parts.push(T(cone(r * 0.2, r * (0.6 + 0.4 * ((k * 37) % 5) / 5), hexToRgb(C.eye), 1, 5), [Math.cos(a) * r * 0.5, r * 0.75, Math.sin(a) * r * 0.5 - r * 0.25], [-0.5, 0, 0]));
    }
    R.bone('head', 'body', [0, 0, 0], parts);
    const jaw = [T(blob(r * 0.75, r * 0.25, r * 0.7, C.skin, 0.05, g.seed + 2), [0, -r * 0.15, r * 0.25])];
    for (let k = 0; k < 6; k++) jaw.push(T(cone(r * 0.06, r * 0.18, C.bone, 0, 4), [(k / 5 - 0.5) * r * 0.9, r * 0.05, r * 0.75]));
    R.bone('jaw', 'head', [0, -r * 0.5, 0], jaw);
    R.muzzle('mouth', 'head', [0, -r * 0.3, r]);
    R.height = r * 2;
    return R;
}

function planOrb(g, A, boss = false) {
    const C = g.colors;
    const r = (boss ? 1.6 : 0.82) * g.scale * (A.radius / 0.85);
    const R = new Rig();
    const eyeC = hexToRgb(C.eye);
    const body = [blob(r, r * 0.95, r, C.skin, g.lump, g.seed)];
    if (g.eyes === 1) {
        body.push(T(sphere(r * 0.42, [0.95, 0.92, 0.85], 0, 14), [0, r * 0.18, r * 0.72]));
        body.push(T(sphere(r * 0.24, eyeC, 1, 12), [0, r * 0.18, r * 0.98]));
        body.push(T(sphere(r * 0.1, [0, 0, 0], 0, 8), [0, r * 0.18, r * 1.15]));
    } else {
        for (let k = 0; k < g.eyes; k++) {
            const a = (k / g.eyes) * Math.PI * 1.2 - Math.PI * 0.6;
            body.push(T(sphere(r * 0.2, [0.95, 0.92, 0.85], 0, 10), [Math.sin(a) * r * 0.7, r * 0.35 + Math.cos(a * 2) * r * 0.1, Math.cos(a) * r * 0.75]));
            body.push(T(sphere(r * 0.11, eyeC, 1, 8), [Math.sin(a) * r * 0.82, r * 0.35 + Math.cos(a * 2) * r * 0.1, Math.cos(a) * r * 0.86]));
        }
    }
    // mouth: dark slit with teeth
    body.push(T(blob(r * 0.6, r * 0.14, r * 0.3, [0.15, 0.0, 0.02], 0.05, g.seed + 3, 0.3), [0, -r * 0.42, r * 0.72]));
    for (let k = 0; k < 9; k++) {
        const t = k / 8 - 0.5;
        body.push(T(cone(r * 0.05, r * 0.18, C.bone, 0, 5), [t * r * 1.05, -r * 0.32, r * (0.86 - Math.abs(t) * 0.3)], [Math.PI, 0, 0]));
        body.push(T(cone(r * 0.05, r * 0.15, C.bone, 0, 5), [t * r * 1.0, -r * 0.54, r * (0.84 - Math.abs(t) * 0.3)]));
    }
    for (let k = 0; k < Math.max(2, g.horns); k++) {
        const s = k % 2 ? -1 : 1;
        body.push(T(horn(r * 0.7 * g.hornLen, r * 0.12, g.hornCurl, C.bone), [s * r * 0.45, r * 0.75, -r * 0.2 * (k >> 1)], [-0.2, 0, s * 0.55]));
    }
    for (let k = 0; k < g.spikes; k++) {
        const a = (k / Math.max(1, g.spikes)) * Math.PI * 2;
        body.push(T(cone(r * 0.08, r * 0.35, C.bone, 0, 5), [Math.cos(a) * r * 0.9, Math.sin(k) * r * 0.3, Math.sin(a) * r * 0.9 - r * 0.1], [0, -a, Math.PI / 2]));
    }
    R.bone('torso', 'body', [0, 0, 0], body);
    const nt = boss ? 8 : g.tentacles;
    for (let k = 0; k < nt; k++) {
        const a = (k / nt) * Math.PI * 2;
        const parent = 'torso';
        const segL = r * 0.45;
        let prev = parent;
        for (let s = 0; s < 3; s++) {
            const nm = `tent${k}_${s}`;
            const rr = r * 0.12 * (1 - s * 0.25);
            R.bone(nm, prev, s === 0 ? [Math.cos(a) * r * 0.55, -r * 0.7, Math.sin(a) * r * 0.55] : [0, -segL, 0], [joint(rr, C.skin), limb(rr, segL, C.skin, rr * 0.7)], s === 0 ? [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4] : [0, 0, 0]);
            prev = nm;
        }
    }
    R.muzzle('mouth', 'torso', [0, -r * 0.4, r * 1.0]);
    R.muzzle('eye', 'torso', [0, r * 0.2, r * 1.1]);
    R.height = r * 2;
    R.radius = r;
    return R;
}

function planSpider(g, A, boss = false) {
    const C = g.colors;
    const H = A.height * g.scale;
    const R = new Rig();
    const br = boss ? H * 0.42 : H * 0.42;
    const legs = boss ? 8 : g.legs;
    const body = [blob(br * 1.1, br * 0.7, br * 1.2, C.skin, g.lump, g.seed)];
    if (boss) {
        // the brood sac: huge, glowing through the skin
        body.push(T(blob(br * 1.5, br * 1.25, br * 1.6, [0.75, 0.32, 0.1], 0.12, g.seed + 1, 0.12), [0, br * 0.55, -br * 1.6]));
        for (let k = 0; k < 10; k++) body.push(T(sphere(br * 0.18, [1, 0.6, 0.15], 0.6, 8), [Math.sin(k * 2.1) * br * 1.2, br * (0.4 + Math.cos(k * 1.3) * 0.6), -br * 1.6 + Math.cos(k * 2.1) * br * 1.2]));
    } else {
        body.push(T(blob(br * 0.9, br * 0.7, br * 1.1, C.belly, g.lump, g.seed + 1), [0, br * 0.2, -br * 1.2]));
    }
    if (g.plates) for (let k = 0; k < 3; k++) body.push(T(blob(br * 0.8, br * 0.15, br * 0.35, C.bone, 0.05, g.seed + 2 + k), [0, br * 0.65, br * (0.5 - k * 0.5)]));
    R.bone('torso', 'body', [0, H * 0.55, 0], body);
    // head + gun turret
    const head = headParts(g, br * 0.55, { mouth: !boss, eyes: boss ? 6 : g.eyes + 2, eyeScale: 0.14 });
    if (!boss) {
        head.push(T(box(br * 0.5, br * 0.35, br * 0.9, C.cloth), [0, -br * 0.35, br * 0.5]));
        for (const s of [-1, 1]) head.push(T(cyl(br * 0.08, br * 0.08, br * 0.9, [0.12, 0.12, 0.14]), [s * br * 0.12, -br * 0.35, br * 1.0], [Math.PI / 2, 0, 0]));
    } else {
        head.push(T(blob(br * 0.5, br * 0.25, br * 0.4, [0.3, 0.02, 0.0], 0.05, g.seed + 9, 0.8), [0, -br * 0.3, br * 0.4]));
    }
    R.bone('head', 'torso', [0, br * 0.1, br * 1.1], head);
    const lr = H * (boss ? 0.05 : 0.055);
    for (let k = 0; k < legs; k++) {
        const side = k % 2 ? -1 : 1;
        const idx = k >> 1;
        const n2 = legs / 2;
        const z = (idx / (n2 - 1) - 0.5) * br * 1.6;
        const nm = 'leg' + k;
        const L1 = H * 0.55, L2 = H * 0.75;
        R.bone(nm, 'torso', [side * br * 0.85, 0, z], [joint(lr * 1.4, C.skin), T(limb(lr * 1.2, L1, C.skin, lr), [0, 0, 0])], [0, 0, side * 1.9]);
        R.bone('shin' + k, nm, [0, -L1, 0], [joint(lr * 1.1, C.skin), limb(lr, L2, C.skin, lr * 0.4)], [0, 0, -side * 1.9]);
    }
    R.muzzle('gun', 'head', boss ? [0, -br * 0.3, br * 0.8] : [0, -br * 0.35, br * 1.5]);
    R.muzzle('mouth', 'head', [0, -br * 0.3, br * 0.6]);
    R.height = H;
    return R;
}

function planSkeleton(g, A) {
    const C = g.colors;
    const H = A.height * g.scale;
    const bone = C.skin;
    const legLen = H * 0.48, torsoH = H * 0.28, tw = H * 0.1;
    const R = new Rig();
    const lr = H * 0.022;
    R.bone('hips', 'body', [0, legLen, 0], [blob(tw * 1.2, H * 0.04, tw * 0.7, bone, 0.05, g.seed)]);
    const chest = [T(cyl(lr * 1.2, lr * 1.2, torsoH, bone), [0, torsoH * 0.5, -tw * 0.3])];
    for (let k = 0; k < 5; k++) chest.push(T(torus(tw * (0.9 - k * 0.08), lr * 0.7, bone, 0, Math.PI * 1.6), [0, torsoH * (0.35 + k * 0.13), 0], [Math.PI / 2, 0, Math.PI * 0.7]));
    // armour and shoulder launchers
    chest.push(T(box(tw * 2.4, torsoH * 0.3, tw * 1.2, C.cloth), [0, torsoH * 0.95, -tw * 0.1]));
    for (const s of [-1, 1]) {
        chest.push(T(box(tw * 0.8, tw * 0.6, tw * 1.6, C.cloth), [s * tw * 1.1, torsoH * 1.15, -tw * 0.2]));
        chest.push(T(cyl(tw * 0.2, tw * 0.2, tw * 0.4, hexToRgb(C.eye), 1, 8), [s * tw * 1.1, torsoH * 1.15, tw * 0.62], [Math.PI / 2, 0, 0]));
    }
    R.bone('torso', 'hips', [0, H * 0.02, 0], chest);
    const hr = H * 0.06;
    const head = [blob(hr, hr * 1.1, hr * 1.05, bone, 0.04, g.seed + 1)];
    for (const s of [-1, 1]) { head.push(T(sphere(hr * 0.26, [0.02, 0.01, 0.01], 0, 8), [s * hr * 0.4, hr * 0.1, hr * 0.8])); head.push(T(sphere(hr * 0.13, hexToRgb(C.eye), 1, 6), [s * hr * 0.4, hr * 0.1, hr * 0.92])); }
    for (let k = 0; k < 6; k++) head.push(T(box(hr * 0.12, hr * 0.25, hr * 0.1, bone), [(k / 5 - 0.5) * hr * 0.8, -hr * 0.55, hr * 0.85]));
    for (let k = 0; k < g.horns; k++) { const s = k % 2 ? -1 : 1; head.push(T(horn(hr * 1.4 * g.hornLen, hr * 0.2, g.hornCurl, C.bone), [s * hr * 0.5, hr * 0.6, -hr * 0.2 * (k >> 1)], [-0.4, 0, s * 0.6])); }
    R.bone('head', 'torso', [0, torsoH * 1.25, 0], head);
    const upper = H * 0.19, fore = H * 0.18;
    for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        R.bone('arm' + S, 'torso', [side * tw * 1.25, torsoH * 0.95, 0], [joint(lr * 2, bone), limb(lr, upper, bone)], [0, 0, side * 0.15]);
        const f = [joint(lr * 1.6, bone), limb(lr, fore, bone)];
        for (let k = 0; k < 3; k++) f.push(T(cone(lr * 0.6, lr * 5, bone, 0, 4), [(k - 1) * lr * 1.5, -fore - lr * 2, 0], [Math.PI, 0, 0]));
        R.bone('fore' + S, 'arm' + S, [0, -upper, 0], f, [-0.4, 0, 0]);
        R.bone('leg' + S, 'hips', [side * tw * 0.7, 0, 0], [joint(lr * 2, bone), limb(lr * 1.2, legLen * 0.5, bone)]);
        R.bone('shin' + S, 'leg' + S, [0, -legLen * 0.5, 0], [joint(lr * 1.6, bone), limb(lr * 1.1, legLen * 0.5, bone), T(box(lr * 4, lr * 2, lr * 7, C.cloth), [0, -legLen * 0.5 + lr, lr * 2])]);
    }
    R.muzzle('launchL', 'torso', [-tw * 1.1, torsoH * 1.15, tw * 0.9]);
    R.muzzle('launchR', 'torso', [tw * 1.1, torsoH * 1.15, tw * 0.9]);
    R.muzzle('gun', 'torso', [0, torsoH * 1.15, tw]);
    R.height = H;
    return R;
}

function planRobed(g, A) {
    const C = g.colors;
    const H = A.height * g.scale;
    const R = new Rig();
    const waist = H * 0.45;
    R.bone('hips', 'body', [0, waist, 0], [
        T(cyl(H * 0.1, H * 0.24, waist, C.cloth, 0, 12), [0, -waist / 2, 0]),
        T(torus(H * 0.24, H * 0.02, hexToRgb(C.eye), 0.8), [0, -waist + 0.05, 0], [Math.PI / 2, 0, 0]),
    ]);
    const tw = H * 0.1;
    const torso = [T(blob(tw, H * 0.16, tw * 0.75, C.skin, g.lump, g.seed), [0, H * 0.14, 0]), T(cyl(tw * 1.25, tw * 1.05, H * 0.2, C.cloth, 0, 10), [0, H * 0.08, 0])];
    torso.push(T(torus(tw * 0.6, tw * 0.08, hexToRgb(C.eye), 1), [0, H * 0.16, tw * 0.6]));
    R.bone('torso', 'hips', [0, 0, 0], torso);
    const hr = H * 0.06;
    const head = [blob(hr * 0.85, hr * 1.4, hr, C.skin, g.lump, g.seed + 1)];
    for (let k = 0; k < 3; k++) head.push(T(sphere(hr * 0.15, hexToRgb(C.eye), 1, 6), [(k - 1) * hr * 0.4, hr * 0.3 + (k === 1 ? hr * 0.25 : 0), hr * 0.85]));
    const nh = Math.max(5, g.horns + 5);
    for (let k = 0; k < nh; k++) {
        const a = (k / (nh - 1) - 0.5) * 2.4;
        head.push(T(horn(hr * 1.4 * (1 - Math.abs(a) * 0.25), hr * 0.12, 0.15, C.bone), [Math.sin(a) * hr * 0.7, hr * 1.0, -Math.cos(a) * hr * 0.3], [-0.2, 0, -a * 0.6]));
    }
    R.bone('head', 'torso', [0, H * 0.31, 0], head);
    const upper = H * 0.21, fore = H * 0.21;
    for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        R.bone('arm' + S, 'torso', [side * tw * 1.15, H * 0.24, 0], [joint(tw * 0.35, C.cloth), limb(tw * 0.28, upper, C.cloth, tw * 0.22)], [0, 0, side * 0.2]);
        const f = [limb(tw * 0.18, fore, C.skin, tw * 0.14), T(sphere(tw * 0.32, hexToRgb(C.eye), 1, 8), [0, -fore - tw * 0.2, 0])];
        for (let k = 0; k < 4; k++) f.push(T(cone(tw * 0.05, tw * 0.6, C.skin, 0, 4), [(k - 1.5) * tw * 0.12, -fore - tw * 0.35, tw * 0.15], [Math.PI - 0.4, 0, 0]));
        R.bone('fore' + S, 'arm' + S, [0, -upper, 0], f, [-0.4, 0, 0]);
    }
    R.muzzle('hand', 'foreR', [0, -fore - tw * 0.2, 0]);
    R.muzzle('handL', 'foreL', [0, -fore - tw * 0.2, 0]);
    R.height = H;
    return R;
}

function planMech(g, A) {
    const C = g.colors;
    const H = A.height;
    const R = new Rig();
    const legLen = H * 0.42;
    const tw = H * 0.22;
    const metal = C.skin, hazard = C.cloth, dark = [0.12, 0.12, 0.13];
    R.bone('hips', 'body', [0, legLen, 0], [box(tw * 1.4, H * 0.08, tw * 0.9, metal)]);
    const torso = [T(box(tw * 1.8, H * 0.3, tw * 1.3, metal), [0, H * 0.18, 0]), T(box(tw * 1.85, H * 0.04, tw * 1.35, hazard), [0, H * 0.06, 0]), T(box(tw * 0.9, H * 0.08, tw * 0.1, hexToRgb(C.eye), 1), [0, H * 0.27, tw * 0.66])];
    for (const s of [-1, 1]) {
        torso.push(T(box(tw * 0.7, H * 0.16, tw * 1.1, dark), [s * tw * 1.2, H * 0.4, -tw * 0.2]));
        for (let k = 0; k < 4; k++) torso.push(T(cyl(tw * 0.09, tw * 0.09, tw * 0.1, [0.9, 0.3, 0.1], 0.6, 8), [s * tw * 1.2 + ((k % 2) - 0.5) * tw * 0.3, H * 0.4 + ((k >> 1) - 0.5) * H * 0.07, tw * 0.37], [Math.PI / 2, 0, 0]));
    }
    torso.push(...backSpikes(g, 3, H * 0.1, -tw * 0.7, H * 0.1, H * 0.3, dark));
    R.bone('torso', 'hips', [0, H * 0.04, 0], torso);
    R.bone('head', 'torso', [0, H * 0.35, tw * 0.3], [box(tw * 0.7, tw * 0.45, tw * 0.6, metal), T(box(tw * 0.6, tw * 0.12, tw * 0.05, hexToRgb(C.eye), 1), [0, tw * 0.05, tw * 0.31])]);
    const upper = H * 0.18, fore = H * 0.2;
    for (const side of [-1, 1]) {
        const S = side < 0 ? 'L' : 'R';
        R.bone('arm' + S, 'torso', [side * tw * 1.15, H * 0.28, 0], [box(tw * 0.55, tw * 0.55, tw * 0.55, hazard), T(box(tw * 0.35, upper, tw * 0.35, metal), [0, -upper / 2, 0])], [0, 0, side * 0.1]);
        const f = [T(box(tw * 0.45, fore, tw * 0.45, metal), [0, -fore / 2, 0])];
        if (side > 0) {
            f.push(T(cyl(tw * 0.3, tw * 0.3, fore * 0.6, dark, 0, 10), [0, -fore, tw * 0.2], [Math.PI / 2, 0, 0]));
        } else {
            f.push(T(box(tw * 0.5, tw * 0.3, tw * 0.5, dark), [0, -fore, 0]));
        }
        R.bone('fore' + S, 'arm' + S, [0, -upper, 0], f, [-0.5, 0, 0]);
        R.bone('leg' + S, 'hips', [side * tw * 0.55, 0, 0], [T(box(tw * 0.45, legLen * 0.5, tw * 0.5, metal), [0, -legLen * 0.25, 0])]);
        R.bone('shin' + S, 'leg' + S, [0, -legLen * 0.5, 0], [T(box(tw * 0.4, legLen * 0.5, tw * 0.45, dark), [0, -legLen * 0.25, 0]), T(box(tw * 0.7, tw * 0.15, tw * 1.0, metal), [0, -legLen * 0.48, tw * 0.15])]);
    }
    // rotary barrel cluster
    const barrel = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; barrel.push(T(cyl(tw * 0.05, tw * 0.05, fore * 0.9, [0.2, 0.2, 0.22], 0, 6), [Math.cos(a) * tw * 0.14, Math.sin(a) * tw * 0.14, 0], [Math.PI / 2, 0, 0])); }
    R.bone('barrel', 'foreR', [0, -fore, tw * 0.7], barrel);
    R.muzzle('gun', 'foreR', [0, -fore, tw * 1.2]);
    R.muzzle('launchL', 'torso', [-tw * 1.2, H * 0.4, tw * 0.5]);
    R.muzzle('launchR', 'torso', [tw * 1.2, H * 0.4, tw * 0.5]);
    R.height = H;
    return R;
}

function planArchon(g, A) {
    const C = g.colors;
    const H = A.height;
    const R = new Rig();
    const pale = C.skin, gold = C.cloth, eye = hexToRgb(C.eye);
    const body = [
        T(blob(H * 0.16, H * 0.22, H * 0.12, pale, 0.06, g.seed), [0, H * 0.05, 0]),
        T(cone(H * 0.2, H * 0.5, pale, 0, 14), [0, -H * 0.3, 0], [Math.PI, 0, 0]),
        T(torus(H * 0.17, H * 0.012, gold, 0.4), [0, -H * 0.05, 0], [Math.PI / 2, 0, 0]),
        T(torus(H * 0.12, H * 0.012, gold, 0.4), [0, -H * 0.25, 0], [Math.PI / 2, 0, 0]),
    ];
    for (let k = 0; k < 10; k++) body.push(T(sphere(H * 0.012, eye, 1, 6), [Math.sin(k * 0.63) * H * 0.12, H * (0.12 - k * 0.025), H * 0.11]));
    R.bone('torso', 'body', [0, H * 0.55, 0], body);
    const hr = H * 0.1;
    const face = [blob(hr * 0.9, hr * 1.25, hr * 0.8, pale, 0.03, g.seed + 1)];
    face.push(T(box(hr * 1.4, hr * 0.08, hr * 0.1, gold, 0.5), [0, hr * 0.35, hr * 0.75]));
    for (let k = 0; k < 6; k++) { const a = (k / 5 - 0.5) * 1.6; face.push(T(sphere(hr * 0.11, eye, 1, 8), [Math.sin(a) * hr * 0.6, hr * (0.05 + Math.cos(a * 2) * 0.12), Math.cos(a) * hr * 0.78])); }
    face.push(T(box(hr * 0.06, hr * 0.5, hr * 0.06, [0.05, 0.0, 0.08], 0.5), [0, -hr * 0.45, hr * 0.78]));
    for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.2; face.push(T(horn(hr * 1.6 * (1 - Math.abs(a) * 0.3), hr * 0.08, 0.1, gold, 0.3), [Math.sin(a) * hr * 0.6, hr * 1.0, -Math.cos(a) * hr * 0.2], [0, 0, -a * 0.5])); }
    R.bone('head', 'torso', [0, H * 0.3, 0], face);
    R.bone('halo', 'head', [0, hr * 0.4, -hr * 0.6], [torus(hr * 2.2, hr * 0.05, gold, 1), T(torus(hr * 2.6, hr * 0.025, eye, 1), [0, 0, -hr * 0.1])]);
    R.bone('halo2', 'torso', [0, 0, 0], [T(torus(H * 0.42, H * 0.008, eye, 1), [0, 0, 0], [Math.PI / 2, 0, 0]), T(torus(H * 0.36, H * 0.006, gold, 0.8), [0, 0, 0], [Math.PI / 2, 0, 0])]);
    for (let k = 0; k < 4; k++) {
        const side = k % 2 ? -1 : 1, row = k >> 1;
        const nm = 'arm' + k;
        const L1 = H * 0.25, L2 = H * 0.3;
        R.bone(nm, 'torso', [side * H * 0.14, H * (0.15 - row * 0.15), 0], [joint(H * 0.025, pale), limb(H * 0.02, L1, pale)], [0.3, 0, side * (0.9 + row * 0.5)]);
        R.bone('fore' + k, nm, [0, -L1, 0], [joint(H * 0.02, gold), limb(H * 0.016, L2, pale, H * 0.008), T(sphere(H * 0.03, eye, 1, 8), [0, -L2, 0])], [-0.6, 0, 0]);
    }
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        let prev = 'torso';
        for (let s = 0; s < 3; s++) {
            const nm = `tent${k}_${s}`;
            const rr = H * 0.02 * (1 - s * 0.25);
            R.bone(nm, prev, s === 0 ? [Math.cos(a) * H * 0.12, -H * 0.5, Math.sin(a) * H * 0.12] : [0, -H * 0.12, 0], [joint(rr, pale), limb(rr, H * 0.12, s === 2 ? gold : pale, rr * 0.7)], s === 0 ? [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] : [0, 0, 0]);
            prev = nm;
        }
    }
    R.muzzle('eye', 'head', [0, 0, hr]);
    R.muzzle('hand', 'fore0', [0, -H * 0.3, 0]);
    R.muzzle('handL', 'fore1', [0, -H * 0.3, 0]);
    R.height = H;
    return R;
}

function planCrystal(g, A) {
    const C = g.colors;
    const H = A.height;
    const R = new Rig();
    const eye = hexToRgb(C.eye);
    const parts = [T(cyl(0.7, 0.85, 0.4, C.skin, 0, 8), [0, 0.2, 0]), T(torus(0.75, 0.06, eye, 1), [0, 0.42, 0], [Math.PI / 2, 0, 0])];
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        parts.push(T(cone(0.16, H * (0.35 + 0.1 * (k % 2)), eye, 0.6, 5), [Math.cos(a) * 0.4, H * 0.2, Math.sin(a) * 0.4], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]));
    }
    R.bone('torso', 'body', [0, 0, 0], parts);
    R.bone('head', 'torso', [0, H * 0.6, 0], [T(finish(new THREE.OctahedronGeometry(0.45, 0), eye, 1), [0, 0, 0], [0, 0, 0], [1, 1.8, 1])]);
    R.muzzle('eye', 'head', [0, 0, 0]);
    R.height = H;
    return R;
}

function hexToRgb(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
export { hexToRgb };

// ------------------------------------------------------------------ templates + instances

const templates = new Map();

export function getTemplate(g) {
    const key = g.arch + ':' + g.name;
    if (templates.has(key)) return templates.get(key);
    const A = ARCHETYPES[g.arch];
    let R;
    switch (g.arch) {
        case 'husk': R = planBiped(g, A, 'husk'); break;
        case 'imp': R = planBiped({ ...g, hunch: 0.9, armLen: g.armLen * 1.2 }, A, 'imp'); break;
        case 'brute': R = planBiped(g, A, 'brute'); break;
        case 'juggernaut': R = planBiped(g, A, 'jug'); break;
        case 'hound': R = planQuad(g, A); break;
        case 'wisp': R = planSkull(g, A); break;
        case 'gazer': R = planOrb(g, A); break;
        case 'skitter': R = planSpider(g, A); break;
        case 'revenant': R = planSkeleton(g, A); break;
        case 'hierophant': R = planRobed(g, A); break;
        case 'overseer': R = planMech(g, A); break;
        case 'mother': R = planSpider({ ...g, colors: { ...g.colors, skin: [0.45, 0.18, 0.1] } }, A, true); break;
        case 'archon': R = planArchon(g, A); break;
        case 'pylon': R = planCrystal(g, A); break;
        default: R = planBiped(g, A, 'husk');
    }
    const tpl = {
        bones: R.bones.map((b) => ({ ...b, geo: merge(b.parts) })),
        muzzles: R.muzzles,
        height: R.height ?? A.height,
        plan: g.arch === 'imp' ? 'hunch' : A.plan,
    };
    for (const b of tpl.bones) delete b.parts;
    templates.set(key, tpl);
    return tpl;
}

export function clearTemplates() {
    for (const t of templates.values()) for (const b of t.bones) b.geo?.dispose();
    templates.clear();
}

/** Create a live model: { root, bones, mat, tpl } */
export function instantiate(g, opts = {}) {
    const tpl = getTemplate(g);
    const mat = actorMaterial({ glow: g.colors.eye, tint: opts.tint ?? 0xffffff, noise: 3.5, seed: g.seed, rim: 0.4 });
    if (opts.tintVec) mat.uniforms.uTint.value.setRGB(...opts.tintVec);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const bones = { body };
    for (const b of tpl.bones) {
        const grp = new THREE.Group();
        grp.position.set(b.pivot[0], b.pivot[1], b.pivot[2]);
        grp.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
        grp.userData.rest = [b.rot[0], b.rot[1], b.rot[2]];
        if (b.geo) {
            const m = new THREE.Mesh(b.geo, mat);
            grp.add(m);
        }
        bones[b.name] = grp;
        (bones[b.parent] ?? body).add(grp);
    }
    return { root, body, bones, mat, tpl };
}

const _v = new THREE.Vector3();
export function muzzleWorld(model, name, out = new THREE.Vector3()) {
    const mz = model.tpl.muzzles[name] ?? Object.values(model.tpl.muzzles)[0];
    if (!mz) return model.root.getWorldPosition(out);
    const b = model.bones[mz.bone] ?? model.body;
    b.updateWorldMatrix(true, false);
    return out.copy(_v.set(mz.off[0], mz.off[1], mz.off[2])).applyMatrix4(b.matrixWorld);
}

// ------------------------------------------------------------------ animation

const rest = (b) => b.userData.rest;
function setRot(b, x, y, z) { if (!b) return; const r = rest(b); b.rotation.set(r[0] + x, r[1] + y, r[2] + z); }

/**
 * s = { t, walk (phase radians), move (0..1), attack (0..1 pose), pain (0..1), dead (0..1), fly }
 */
export function animate(model, s) {
    const B = model.bones;
    const plan = model.tpl.plan;
    const sw = Math.sin(s.walk), cw = Math.cos(s.walk);
    const m = s.move;
    const breathe = Math.sin(s.t * 2.2) * 0.03;
    const atk = s.attack, pain = s.pain;
    switch (plan) {
        case 'biped': case 'hunch': case 'skeleton': case 'mech': {
            setRot(B.legL, sw * 0.7 * m, 0, 0);
            setRot(B.legR, -sw * 0.7 * m, 0, 0);
            setRot(B.shinL, Math.max(0, -cw) * 0.9 * m, 0, 0);
            setRot(B.shinR, Math.max(0, cw) * 0.9 * m, 0, 0);
            const armSwing = plan === 'mech' ? 0.2 : 0.55;
            setRot(B.armL, -sw * armSwing * m - atk * 1.2 + pain * 0.6, 0, -atk * 0.2);
            setRot(B.armR, sw * armSwing * m - atk * (plan === 'hunch' ? 2.2 : 1.3) + pain * 0.6, 0, 0);
            setRot(B.foreL, -atk * 0.3, 0, 0);
            setRot(B.foreR, -atk * 0.5, 0, 0);
            setRot(B.torso, breathe + pain * -0.35 + atk * 0.12 + m * 0.08, Math.sin(s.walk) * 0.08 * m, 0);
            setRot(B.head, -pain * 0.4 + Math.sin(s.t * 0.7) * 0.06, Math.sin(s.t * 0.5) * 0.2 * (1 - m), 0);
            if (B.hips) B.hips.position.y = B.hips.userData.y0 ?? (B.hips.userData.y0 = B.hips.position.y);
            if (B.hips) B.hips.position.y = B.hips.userData.y0 + Math.abs(cw) * 0.06 * m * model.tpl.height;
            if (B.tail) setRot(B.tail, Math.sin(s.t * 3) * 0.2, Math.sin(s.t * 2.1) * 0.5, 0);
            if (B.barrel) B.barrel.rotation.z += s.spin ?? 0;
            break;
        }
        case 'robed': {
            setRot(B.armL, -0.4 - atk * 1.6 + Math.sin(s.t * 1.3) * 0.1, 0, -atk * 0.5);
            setRot(B.armR, -0.4 - atk * 1.6 + Math.sin(s.t * 1.1) * 0.1, 0, atk * 0.5);
            setRot(B.torso, breathe + pain * -0.3, 0, Math.sin(s.walk) * 0.05 * m);
            setRot(B.head, -atk * 0.3 - pain * 0.4, Math.sin(s.t * 0.6) * 0.2, 0);
            if (B.hips) setRot(B.hips, 0, 0, Math.sin(s.walk) * 0.06 * m);
            break;
        }
        case 'quad': {
            setRot(B.legFL, sw * 0.8 * m, 0, 0); setRot(B.legBR, sw * 0.8 * m, 0, 0);
            setRot(B.legFR, -sw * 0.8 * m, 0, 0); setRot(B.legBL, -sw * 0.8 * m, 0, 0);
            setRot(B.shinFL, Math.max(0, cw) * 0.8 * m, 0, 0); setRot(B.shinBR, Math.max(0, cw) * 0.8 * m, 0, 0);
            setRot(B.shinFR, Math.max(0, -cw) * 0.8 * m, 0, 0); setRot(B.shinBL, Math.max(0, -cw) * 0.8 * m, 0, 0);
            setRot(B.torso, Math.sin(s.walk * 2) * 0.06 * m + pain * -0.2 + atk * 0.15, 0, 0);
            setRot(B.head, -atk * 0.25 + pain * 0.3, Math.sin(s.t * 0.8) * 0.15 * (1 - m), 0);
            setRot(B.jaw, 0.15 + atk * 0.9 + Math.max(0, Math.sin(s.t * 6)) * 0.08, 0, 0);
            if (B.tail) setRot(B.tail, Math.sin(s.t * 4) * 0.3, Math.sin(s.t * 6) * 0.6 * (0.3 + m), 0);
            break;
        }
        case 'skull': {
            setRot(B.jaw, 0.2 + atk * 0.8 + Math.max(0, Math.sin(s.t * 9)) * 0.3, 0, 0);
            setRot(B.head, Math.sin(s.t * 1.7) * 0.1 - pain * 0.5, 0, Math.sin(s.t * 1.3) * 0.15);
            break;
        }
        case 'orb': {
            setRot(B.torso, Math.sin(s.t * 0.9) * 0.08 - pain * 0.3 - atk * 0.2, 0, Math.sin(s.t * 0.7) * 0.06);
            for (const [name, b] of Object.entries(B)) {
                if (!name.startsWith('tent')) continue;
                const seg = +name.split('_')[1];
                const k = +name.slice(4).split('_')[0];
                setRot(b, Math.sin(s.t * 2 + k + seg) * 0.25, 0, Math.cos(s.t * 1.7 + k * 1.3 + seg) * 0.25);
            }
            break;
        }
        case 'spider': case 'mother': {
            const nLegs = Object.keys(B).filter((k) => /^leg\d+$/.test(k)).length;
            for (let k = 0; k < nLegs; k++) {
                const side = k % 2 ? -1 : 1;
                const ph = s.walk * 1.5 + (k * Math.PI) / 2 + (side < 0 ? Math.PI : 0);
                setRot(B['leg' + k], Math.sin(ph) * 0.45 * m, 0, Math.max(0, Math.cos(ph)) * 0.35 * m * side);
                setRot(B['shin' + k], 0, 0, Math.sin(ph) * 0.15 * m * side);
            }
            setRot(B.torso, breathe - pain * 0.2, 0, Math.sin(s.walk * 3) * 0.04 * m);
            setRot(B.head, -atk * 0.3, Math.sin(s.t * 0.7) * 0.25, 0);
            break;
        }
        case 'crystal': {
            if (B.head) { B.head.rotation.y = s.t * 1.5; B.head.position.y = model.tpl.height * 0.6 + Math.sin(s.t * 2) * 0.15; }
            break;
        }
        case 'archon': {
            setRot(B.torso, Math.sin(s.t * 0.5) * 0.05 - pain * 0.15, 0, 0);
            setRot(B.head, -atk * 0.3 + Math.sin(s.t * 0.4) * 0.08, Math.sin(s.t * 0.3) * 0.15, 0);
            if (B.halo) B.halo.rotation.z = s.t * 0.6;
            if (B.halo2) { B.halo2.rotation.y = s.t * 0.4; B.halo2.rotation.x = Math.sin(s.t * 0.3) * 0.4; }
            for (let k = 0; k < 4; k++) setRot(B['arm' + k], Math.sin(s.t * 1.1 + k) * 0.25 - atk * 0.8, 0, 0);
            for (const [name, b] of Object.entries(B)) {
                if (!name.startsWith('tent')) continue;
                const seg = +name.split('_')[1];
                const k = +name.slice(4).split('_')[0];
                setRot(b, Math.sin(s.t * 1.5 + k + seg) * 0.3, 0, Math.cos(s.t * 1.2 + k * 1.3 + seg) * 0.3);
            }
            break;
        }
    }
    // death: topple (walkers) or drop (fliers)
    if (s.dead > 0) {
        const d = Math.min(1, s.dead);
        const e = 1 - Math.pow(1 - d, 3);
        if (s.fly) {
            model.body.rotation.x = e * 0.8;
        } else if (plan === 'quad' || plan === 'spider' || plan === 'mother') {
            model.body.rotation.z = e * 1.4 * (s.fallSide ?? 1);
            model.body.position.y = -e * model.tpl.height * 0.15;
        } else {
            model.body.rotation.x = -e * 1.45 * (s.fallBack ? -1 : 1);
            model.body.position.y = -e * 0.05;
            setRot(B.legL, -e * 0.4, 0, 0); setRot(B.legR, -e * 0.2, 0, 0);
            setRot(B.armL, -e * 2.4, 0, -e * 0.6); setRot(B.armR, -e * 2.0, 0, e * 0.6);
        }
    } else {
        model.body.rotation.set(0, 0, 0);
        model.body.position.y = 0;
    }
}

export const prim = { finish, T, blob, sphere, box, cyl, cone, torus, horn, merge, limb };
