// The Foundry's robot: its parts, its skeleton and how it moves. A robot is
// sixteen bones (pelvis, chest, head, and three bones in each arm and leg) and
// some forty parts, each a piece of geometry fixed to one bone. The parts are
// drawn as instances (foundry-line.js), so a robot is never a scene object:
// every frame its pose is worked out from the time, its bones are composed,
// and each part it has been given so far is written into its mesh's next slot.
//
// The robot's own frame: +y up, +z the way it faces, +x its left. Its origin is
// on the floor between its feet when it stands; lengths are in metres before
// SCALE shrinks the whole robot to a little over three metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep } from './util.js';

export const SCALE = 0.8;
export const HEAD_TOP = 3.82;    // the lifting eye on the crown, robot metres above the origin
export const PELVIS_Y = 1.71;    // standing
const THIGH = 0.72, SHIN = 0.72, ANKLE_H = 0.27, HIP_DROP = 0.05;
export const STRIDE = 1.7;       // one full walking cycle, robot metres

// bones
export const B = { ROOT: 0, PELVIS: 1, CHEST: 2, HEAD: 3, SH_L: 4, EL_L: 5, HA_L: 6, SH_R: 7, EL_R: 8, HA_R: 9, HIP_L: 10, KN_L: 11, AN_L: 12, HIP_R: 13, KN_R: 14, AN_R: 15 };
export const NBONES = 16;

// ---------------------------------------------------------------- geometry

const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);
/** Faceted: one normal per face (for prisms that would otherwise shade round). */
const flat = (g) => {
    g = nonIndexed(g);
    g.computeVertexNormals();
    return g;
};
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    return g.applyMatrix4(m);
};
const merge = (...gs) => {
    const list = gs.map((g) => {
        g = nonIndexed(g);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g;
    });
    return mergeGeometries(list, false);
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** A square prism, wider at the top: a torso, a pelvis. */
const prism = (wTop, wBot, h, depth) => {
    const g = new THREE.CylinderGeometry(wTop / Math.SQRT2, wBot / Math.SQRT2, h, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(1, 1, depth / wTop);
    return flat(g);
};

/** Geometry for every robot part, keyed by mesh name, each in its bone's frame. */
export function robotGeometries() {
    const g = {};
    // the head
    g.cranium = new THREE.LatheGeometry([[0, 0.02], [0.25, 0.02], [0.3, 0.1], [0.315, 0.3], [0.3, 0.44], [0.24, 0.54], [0.13, 0.6], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
    g.cranium.scale(1, 1, 0.94);
    g.liftEye = at(new THREE.TorusGeometry(0.075, 0.025, 6, 14), 0, 0.68, 0);
    g.face = merge(
        at(box(0.46, 0.26, 0.1), 0, 0.3, 0.27, -0.08),
        at(box(0.3, 0.13, 0.1), 0, 0.1, 0.265),
        at(box(0.06, 0.4, 0.06), 0, 0.47, 0.27),
    );
    g.eyes = merge(at(new THREE.SphereGeometry(0.06, 10, 8), 0.115, 0.31, 0.325), at(new THREE.SphereGeometry(0.06, 10, 8), -0.115, 0.31, 0.325));
    g.ear = merge(at(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), 0, 0.3, 0, 0, 0, Math.PI / 2), at(new THREE.ConeGeometry(0.05, 0.1, 8), 0, 0.3, 0, 0, 0, Math.PI / 2));
    g.antenna = merge(at(new THREE.CylinderGeometry(0.016, 0.022, 0.34, 6), 0.13, 0.72, -0.07), at(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), 0.13, 0.56, -0.07));
    g.antTip = at(new THREE.SphereGeometry(0.045, 8, 6), 0.13, 0.91, -0.07);
    // the body
    g.neck = at(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 10), 0, 1.0, 0);
    g.chest = at(prism(1.12, 0.8, 0.92, 0.66), 0, 0.48, 0);
    g.yoke = at(box(1.52, 0.2, 0.42), 0, 0.84, 0);
    g.core = at(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 16), 0, 0.58, 0.33, Math.PI / 2);
    g.coreRing = at(new THREE.TorusGeometry(0.17, 0.035, 6, 18), 0, 0.58, 0.345);
    g.pecs = merge(at(box(0.34, 0.38, 0.08), 0.33, 0.58, 0.33, 0, 0.22), at(box(0.34, 0.38, 0.08), -0.33, 0.58, 0.33, 0, -0.22), at(box(0.62, 0.12, 0.08), 0, 0.2, 0.3, 0.2));
    g.pack = merge(at(box(0.72, 0.62, 0.3), 0, 0.5, -0.46), at(box(0.5, 0.08, 0.34), 0, 0.3, -0.46), at(box(0.5, 0.08, 0.34), 0, 0.45, -0.46));
    g.exhaust = merge(at(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 8), 0.2, 0.95, -0.52), at(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 8), -0.2, 0.95, -0.52));
    g.abdomen = at(new THREE.CylinderGeometry(0.24, 0.27, 0.42, 12), 0, 0.26, 0);
    g.pelvis = at(prism(0.78, 0.5, 0.32, 0.46), 0, -0.02, 0);
    // arms (one geometry serves both sides)
    g.shBall = new THREE.SphereGeometry(0.2, 12, 10);
    g.pauldron = at(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.02, 0, 0, 0, 0, 1, 0.85, 1);
    g.upper = at(flat(new THREE.CylinderGeometry(0.15, 0.13, 0.54, 6)), 0, -0.36, 0);
    g.elbow = at(new THREE.SphereGeometry(0.14, 10, 8), 0, 0, 0);
    g.fore = at(flat(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 8)), 0, -0.3, 0);
    g.hand = merge(
        at(box(0.2, 0.22, 0.17), 0, -0.13, 0),
        at(box(0.05, 0.16, 0.06), 0.06, -0.31, 0.03, 0.15),
        at(box(0.05, 0.16, 0.06), 0, -0.32, 0.03, 0.15),
        at(box(0.05, 0.16, 0.06), -0.06, -0.31, 0.03, 0.15),
        at(box(0.05, 0.14, 0.06), 0, -0.2, 0.1, 0.6),
    );
    // legs
    g.hipBall = new THREE.SphereGeometry(0.17, 10, 8);
    g.thigh = at(flat(new THREE.CylinderGeometry(0.19, 0.15, 0.6, 6)), 0, -0.36, 0);
    g.knee = new THREE.SphereGeometry(0.15, 10, 8);
    g.shin = at(new THREE.CylinderGeometry(0.15, 0.12, 0.62, 10), 0, -0.38, 0);
    g.armor = merge(at(box(0.25, 0.44, 0.1), 0, -0.34, 0.15, -0.06), at(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0.1, Math.PI / 2, 0, 0, 1, 1, 0.6));
    g.ankle = new THREE.SphereGeometry(0.11, 8, 6);
    g.foot = merge(at(flat(box(0.34, 0.16, 0.56)), 0, -0.19, 0.08), at(flat(box(0.3, 0.1, 0.18)), 0, -0.22, 0.4, -0.3));
    return g;
}

// material: 'paint' takes the robot's colour, 'steel' and 'dark' don't, 'glow' is lit from within
export const MESHES = {
    cranium: 'paint', liftEye: 'steel', face: 'dark', eyes: 'glow', ear: 'steel', antenna: 'steel', antTip: 'glow',
    neck: 'dark', chest: 'paint', yoke: 'steel', core: 'glow', coreRing: 'steel', pecs: 'paint', pack: 'steel', exhaust: 'dark', abdomen: 'dark', pelvis: 'paint',
    shBall: 'dark', pauldron: 'paint', upper: 'steel', elbow: 'dark', fore: 'paint', hand: 'steel',
    hipBall: 'dark', thigh: 'paint', knee: 'dark', shin: 'steel', armor: 'paint', ankle: 'dark', foot: 'steel',
};

/** Every part a robot is given: its mesh, its bone, and the station (slot) that fits it. */
export const PARTS = [];
const part = (name, mesh, bone, slot) => PARTS.push({ name, mesh, bone, slot, id: PARTS.length });
part('cranium', 'cranium', B.HEAD, 0);
part('liftEye', 'liftEye', B.HEAD, 0);
part('face', 'face', B.HEAD, 1);
part('eyes', 'eyes', B.HEAD, 2);
part('earL', 'ear', B.HEAD, 3);
part('earR', 'ear', B.HEAD, 3);
part('antenna', 'antenna', B.HEAD, 4);
part('antTip', 'antTip', B.HEAD, 4);
part('chest', 'chest', B.CHEST, 6);
part('yoke', 'yoke', B.CHEST, 6);
part('neck', 'neck', B.CHEST, 6);
part('pelvis', 'pelvis', B.PELVIS, 7);
part('abdomen', 'abdomen', B.PELVIS, 7);
part('core', 'core', B.CHEST, 8);
part('coreRing', 'coreRing', B.CHEST, 8);
part('pecs', 'pecs', B.CHEST, 9);
part('pack', 'pack', B.CHEST, 10);
part('exhaust', 'exhaust', B.CHEST, 10);
for (const [s, sh, el, ha, hip, kn, an] of [['L', B.SH_L, B.EL_L, B.HA_L, B.HIP_L, B.KN_L, B.AN_L], ['R', B.SH_R, B.EL_R, B.HA_R, B.HIP_R, B.KN_R, B.AN_R]]) {
    part('shBall' + s, 'shBall', sh, 12);
    part('pauldron' + s, 'pauldron', sh, 12);
    part('upper' + s, 'upper', sh, 13);
    part('elbow' + s, 'elbow', el, 14);
    part('fore' + s, 'fore', el, 14);
    part('hand' + s, 'hand', ha, 15);
    part('hipBall' + s, 'hipBall', hip, 18);
    part('thigh' + s, 'thigh', hip, 18);
    part('knee' + s, 'knee', kn, 19);
    part('shin' + s, 'shin', kn, 20);
    part('ankle' + s, 'ankle', an, 21);
    part('foot' + s, 'foot', an, 21);
    part('armor' + s, 'armor', kn, 22);
}
export const PART = Object.fromEntries(PARTS.map((p) => [p.name, p]));
// the ears sit on the sides of the head, one geometry turned for each side
export const PART_OFFSET = {
    earL: new THREE.Matrix4().makeTranslation(0.33, 0, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI)),
    earR: new THREE.Matrix4().makeTranslation(-0.33, 0, 0),
};

// ---------------------------------------------------------------- poses

/** A fresh pose: every joint angle a robot has, standing straight. */
export function newPose() {
    return {
        pelvisY: PELVIS_Y, lean: 0, twist: 0, neckP: 0, neckY: 0,
        shF: [0.05, 0.05], shR: [0.08, 0.08], el: [0.15, 0.15], wr: [0, 0],
        hip: [0, 0], knee: [0, 0], toe: [0, 0], spread: [0, 0],
    };
}

export function copyPose(a, b) {
    a.pelvisY = b.pelvisY; a.lean = b.lean; a.twist = b.twist; a.neckP = b.neckP; a.neckY = b.neckY;
    for (const k of ['shF', 'shR', 'el', 'wr', 'hip', 'knee', 'toe', 'spread']) {
        a[k][0] = b[k][0];
        a[k][1] = b[k][1];
    }
    return a;
}

export function mixPose(out, a, b, t) {
    out.pelvisY = lerp(a.pelvisY, b.pelvisY, t); out.lean = lerp(a.lean, b.lean, t); out.twist = lerp(a.twist, b.twist, t);
    out.neckP = lerp(a.neckP, b.neckP, t); out.neckY = lerp(a.neckY, b.neckY, t);
    for (const k of ['shF', 'shR', 'el', 'wr', 'hip', 'knee', 'toe', 'spread']) {
        out[k][0] = lerp(a[k][0], b[k][0], t);
        out[k][1] = lerp(a[k][1], b[k][1], t);
    }
    return out;
}

/** How high a leg holds the pelvis, for a hip angle (forward) and a knee bend. */
export const legReach = (h, k) => HIP_DROP + THIGH * Math.cos(h) + SHIN * Math.cos(h - k) + ANKLE_H;
/** Stand the pelvis on whichever leg is the straighter. */
export function plant(p) {
    p.pelvisY = Math.max(legReach(p.hip[0], p.knee[0]), legReach(p.hip[1], p.knee[1]));
    return p;
}

/** Hanging from the hook by its head, switched off: everything droops a little. */
export function hangPose(p, sway = 0) {
    copyPose(p, STAND);
    p.shF[0] = p.shF[1] = 0.04 - sway * 0.6;
    p.shR[0] = p.shR[1] = 0.1;
    p.el[0] = p.el[1] = 0.22;
    p.wr[0] = p.wr[1] = 0.1;
    p.hip[0] = p.hip[1] = 0.12;
    p.knee[0] = p.knee[1] = 0.32;
    p.toe[0] = p.toe[1] = 0.55;
    p.spread[0] = p.spread[1] = 0.03;
    p.neckP = 0;
    p.pelvisY = PELVIS_Y;
    return p;
}

const STAND = newPose();
export const CROUCH = (() => {
    const p = newPose();
    p.hip[0] = p.hip[1] = 1.05;
    p.knee[0] = p.knee[1] = 2.05;
    p.lean = 0.5;
    p.neckP = 0.45;
    p.shF[0] = p.shF[1] = 0.62;
    p.shR[0] = p.shR[1] = 0.12;
    p.el[0] = p.el[1] = 0.25;
    p.wr[0] = p.wr[1] = 0.2;
    p.spread[0] = p.spread[1] = 0.08;
    return plant(p);
})();
export { STAND };

/** One moment of a heavy walk; `phase` in radians, a full stride per 2π. */
export function walkPose(p, phase, amp = 1) {
    copyPose(p, STAND);
    for (let s = 0; s < 2; s++) {
        const f = phase + s * Math.PI;
        p.hip[s] = 0.36 * Math.sin(f) * amp;
        p.knee[s] = (0.1 + 0.72 * Math.max(0, Math.cos(f))) * amp;
        p.toe[s] = -0.12 * Math.max(0, -Math.cos(f)) * amp;
        p.shF[s] = -0.3 * Math.sin(f) * amp;
        p.el[s] = 0.35 + 0.2 * Math.max(0, -Math.sin(f)) * amp;
        p.shR[s] = 0.1;
    }
    p.lean = 0.07 * amp;
    p.twist = -0.07 * Math.sin(phase) * amp;
    p.neckP = -0.03;
    return plant(p);
}

// ---------------------------------------------------------------- bones

const _r = new THREE.Matrix4();
/** m = m · translate(x, y, z), without a matrix multiply. */
function tr(m, x, y, z) {
    const e = m.elements;
    e[12] += e[0] * x + e[4] * y + e[8] * z;
    e[13] += e[1] * x + e[5] * y + e[9] * z;
    e[14] += e[2] * x + e[6] * y + e[10] * z;
    return m;
}
const rx = (m, a) => (a ? m.multiply(_r.makeRotationX(a)) : m);
const ry = (m, a) => (a ? m.multiply(_r.makeRotationY(a)) : m);
const rz = (m, a) => (a ? m.multiply(_r.makeRotationZ(a)) : m);

export const newBones = () => Array.from({ length: NBONES }, () => new THREE.Matrix4());

/** Compose every bone's world matrix from the root's and the pose. */
export function bones(p, root, out) {
    out[0].copy(root);
    const pel = out[1].copy(root);
    tr(pel, 0, p.pelvisY, 0);
    const ch = out[2].copy(pel);
    tr(ch, 0, 0.45, 0);
    rx(ch, p.lean);
    ry(ch, p.twist);
    const hd = out[3].copy(ch);
    tr(hd, 0, 1.08, 0);
    ry(hd, p.neckY);
    rx(hd, p.neckP);
    for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1, i = s === 0 ? 4 : 7;
        const sh = out[i].copy(ch);
        tr(sh, side * 0.68, 0.8, 0);
        rx(sh, -p.shF[s]);
        rz(sh, side * p.shR[s]);
        const el = out[i + 1].copy(sh);
        tr(el, 0, -0.66, 0);
        rx(el, -p.el[s]);
        const ha = out[i + 2].copy(el);
        tr(ha, 0, -0.6, 0);
        rx(ha, -p.wr[s]);
        const j = s === 0 ? 10 : 13;
        const hip = out[j].copy(pel);
        tr(hip, side * 0.27, -HIP_DROP, 0);
        rx(hip, -p.hip[s]);
        rz(hip, side * p.spread[s]);
        const kn = out[j + 1].copy(hip);
        tr(kn, 0, -THIGH, 0);
        rx(kn, p.knee[s]);
        const an = out[j + 2].copy(kn);
        tr(an, 0, -SHIN, 0);
        rx(an, p.hip[s] - p.knee[s] + p.toe[s]);
    }
    return out;
}

// ---------------------------------------------------------------- colours

export const PRIMER = new THREE.Color('#8f9499');
const PAINTS = ['#c8372b', '#e3a21f', '#2d74c0', '#3b9d63', '#e6e0cf', '#7a4fb0', '#1f9fa3', '#d6602a', '#4a5560', '#b8b23a'].map((c) => new THREE.Color(c));
/** Each unit's own paint, from its serial number. */
export function paintOf(serial, out) {
    let h = Math.imul(serial ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return out.copy(PAINTS[(h >>> 0) % PAINTS.length]);
}

export { clamp, smoothstep };
