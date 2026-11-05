// Models for everything the Skarn field: troopers, drones, mechs, turrets, pylons and the five bosses.
// Each model is a group plus a tick(dt, e, ctx) that animates it from the sim entity. All procedural.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LegRig, metal, glow } from './walker.js';
import { BOSSES } from '../sim/data.js';

const V = THREE.Vector3;
const rb = (w, h, d, r = 0.1) => new RoundedBoxGeometry(w, h, d, 2, r);
const SK = { carapace: 0x4a1d2a, plate: 0x6a2a38, dark: 0x1c1418, glowR: 0xff5a30, glowG: 0x9cff5a, steel: 0x6d7480, olive: 0x4b5240 };

class Model {
    constructor() { this.group = new THREE.Group(); this.flashMats = []; this.height = 3; this.mix = 0; this.base = new Map(); }
    add(geo, mat, x = 0, y = 0, z = 0, p = this.group, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; p.add(m); return m; }
    body(color, rough = 0.4, metalness = 0.6, o = {}) { const m = metal(color, rough, metalness, o); this.flashMats.push(m); this.base.set(m, m.emissive.clone()); return m; }
    flash(v) {
        for (const m of this.flashMats) { const b = this.base.get(m); m.emissive.copy(b).lerp(_w, Math.min(1, v * 6)); m.emissiveIntensity = v > 0 ? 1 + v * 8 : 1; }
    }
    dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of this.flashMats) m.dispose(); }
}
const _w = new THREE.Color(1, 0.85, 0.6);

/** Drives a rigged body: places it on its feet, tilts it to the ground, steps the legs. */
export function poseRigged(M, e, dt, ctx, s, H, air = false) {
    const root = M.root, rig = M.rig, st = M.pose || (M.pose = { y: null, n: new V(0, 1, 0), vx: 0, vz: 0, fp: { x: 0, y: 0, z: 0, n: null } });
    root.scale.setScalar(s);
    const fp = rig.footPlane(st.fp);
    const targetY = air ? e.y + H * s : fp.y + H * s;
    st.y = st.y === null ? targetY : st.y + (targetY - st.y) * Math.min(1, dt * 9);
    st.n.lerp(fp.n, Math.min(1, dt * 6)).normalize();
    const yaw = e.yaw;
    const f = new V(Math.sin(yaw), 0, -Math.cos(yaw));
    f.addScaledVector(st.n, -f.dot(st.n)).normalize();
    const back = f.clone().negate(), x = new V().crossVectors(st.n, back).normalize();
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, st.n, back));
    root.position.set(e.x, st.y, e.z);
    st.vx += (e.vx - st.vx) * Math.min(1, dt * 8); st.vz += (e.vz - st.vz) * Math.min(1, dt * 8);
    rig.update(dt, ctx.h, { x: st.vx, z: st.vz }, s, air);
}

const legCfg = (M, root, o) => {
    const mats = { leg: M.body(o.leg ?? 0x2a2326, 0.45, 0.8), joint: metal(o.joint ?? 0x4a5058, 0.5, 0.7), foot: metal(0x222226, 0.6, 0.7) };
    return new LegRig(root, { H: o.H, thick: o.thick, step: o.step, lift: o.lift, mats, claw: o.claw ?? 0.6, groups: o.groups, legs: o.legs, pistons: !!o.pistons, kneeGlow: o.knee || null });
};

// ------------------------------------------------------------------------------------------ infantry
function humanoid(type) {
    const M = new Model();
    const rocket = type === 'rocketeer';
    const skin = M.body(SK.carapace, 0.5, 0.4), plate = M.body(SK.plate, 0.4, 0.6), dark = metal(SK.dark, 0.5, 0.7), eye = glow(SK.glowR, 3.5);
    const hips = new THREE.Group(); hips.position.y = 0.95; M.group.add(hips); M.hips = hips;
    const legs = [];
    for (const sx of [-1, 1]) {
        const p = new THREE.Group(); p.position.set(sx * 0.2, 0, 0); hips.add(p);
        M.add(new THREE.CapsuleGeometry(0.11, 0.55, 3, 8), skin, 0, -0.38, 0, p); M.add(new THREE.CapsuleGeometry(0.1, 0.45, 3, 8), plate, 0, -0.85, 0.05, p);
        legs.push(p);
    }
    M.legs = legs;
    const torso = new THREE.Group(); torso.position.y = 0.2; hips.add(torso); M.torso = torso;
    M.add(rb(0.62, 0.7, 0.4, 0.14), plate, 0, 0.35, 0, torso); M.add(rb(0.5, 0.2, 0.45, 0.06), dark, 0, 0.7, 0, torso);
    const head = M.add(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 0.9, -0.03, torso); head.scale.set(0.9, 1.1, 1.3);
    M.add(new THREE.SphereGeometry(0.06, 6, 5), eye, 0.09, 0.93, -0.22, torso); M.add(new THREE.SphereGeometry(0.06, 6, 5), eye, -0.09, 0.93, -0.22, torso);
    for (let i = 0; i < 3; i++) M.add(new THREE.ConeGeometry(0.04, 0.3, 4), skin, 0, 1.08, 0.1 + i * 0.07, torso).rotation.x = 0.9 + i * 0.1;
    const gun = new THREE.Group(); gun.position.set(0.38, 0.4, -0.2); torso.add(gun); M.gun = gun;
    M.add(rb(0.12, 0.16, 0.9, 0.03), dark, 0, 0, -0.3, gun); M.add(new THREE.SphereGeometry(0.05, 6, 5), glow(SK.glowR, 3), 0, 0, -0.78, gun);
    M.add(new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), skin, -0.38, 0.4, 0, torso);
    if (rocket) { const tube = M.add(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 10), dark, -0.3, 0.85, 0.15, torso); tube.rotation.x = Math.PI / 2 - 0.2; M.add(new THREE.CircleGeometry(0.12, 8), glow(0xffaa30, 3), -0.3, 0.9, -0.38, torso); }
    M.height = 1.9; M.phase = 0;
    M.tick = (dt, e, ctx) => {
        const sp = Math.hypot(e.vx, e.vz);
        M.phase += dt * (3 + sp * 1.6);
        const sw = Math.sin(M.phase) * Math.min(1, sp * 0.4);
        legs[0].rotation.x = sw * 0.7; legs[1].rotation.x = -sw * 0.7;
        hips.position.y = 0.95 + Math.abs(Math.cos(M.phase)) * 0.06 * Math.min(1, sp);
        torso.rotation.y = Math.sin(ctx.time * 1.7 + e.id) * 0.05; torso.rotation.x = -0.06 * Math.min(1, sp * 0.3);
        M.group.position.set(e.x, e.y, e.z); M.group.rotation.y = -e.yaw;
        if (e.kd > 0) { M.group.rotation.x = -0.9; M.group.position.y += 0.2; } else M.group.rotation.x = 0;
        M.flash(e.flash);
    };
    return M;
}

function wasp() {
    const M = new Model();
    const shell = M.body(0x2a2018, 0.3, 0.5), band = M.body(0xe8b020, 0.4, 0.4), eye = glow(SK.glowG, 3.5), wingM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide, emissive: 0x2a5a30, emissiveIntensity: 0.4 });
    M.add(new THREE.SphereGeometry(0.55, 14, 10), shell).scale.set(0.9, 0.8, 1.3);
    for (let i = 0; i < 3; i++) M.add(new THREE.TorusGeometry(0.46 - i * 0.04, 0.07, 6, 14), band, 0, 0, 0.1 + i * 0.28).rotation.y = 0;
    M.add(new THREE.SphereGeometry(0.34, 10, 8), shell, 0, 0.05, -0.75); M.add(new THREE.SphereGeometry(0.14, 8, 6), eye, 0.14, 0.12, -1.0); M.add(new THREE.SphereGeometry(0.14, 8, 6), eye, -0.14, 0.12, -1.0);
    M.add(new THREE.ConeGeometry(0.22, 0.9, 8), band, 0, -0.05, 1.15).rotation.x = Math.PI / 2;
    M.wings = [];
    for (const sx of [-1, 1]) for (const z of [-0.2, 0.3]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), wingM); const p = new THREE.Group(); p.position.set(sx * 0.3, 0.4, z); w.position.x = sx * 0.75; w.rotation.x = -Math.PI / 2; p.add(w); M.group.add(p); p.userData.sx = sx; M.wings.push(p); }
    for (const sx of [-1, 1]) M.add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), M.body(0x444, 0.4, 0.8), sx * 0.4, -0.35, -0.5).rotation.x = Math.PI / 2;
    M.height = 1.4;
    M.tick = (dt, e, ctx) => {
        for (const w of M.wings) w.rotation.z = w.userData.sx * Math.sin(ctx.time * 50 + w.position.z * 5) * 0.7;
        M.group.position.set(e.x, e.y + Math.sin(ctx.time * 3 + e.id) * 0.15, e.z); M.group.rotation.y = -e.yaw;
        M.group.rotation.z = -Math.sin(e.st) * 0.2 * e.dir; M.group.rotation.x = 0.1;
        M.flash(e.flash);
    };
    return M;
}

// ------------------------------------------------------------------------------------------ mechs
function stalker() {
    const M = new Model();
    const root = new THREE.Group(); M.group.add(root); M.root = root;
    const hull = M.body(0x353a44, 0.4, 0.8), red = M.body(0x6a1f24, 0.4, 0.7), dark = metal(0x15171c, 0.5, 0.8), lamp = glow(SK.glowR, 3);
    M.add(rb(1.5, 0.9, 1.9, 0.2), hull, 0, 0.2, 0, root); M.add(rb(1.2, 0.5, 1.3, 0.12), red, 0, 0.8, 0.1, root);
    M.add(new THREE.SphereGeometry(0.4, 10, 8), lamp, 0, 0.55, -0.95).scale.set(1.4, 0.5, 0.6);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(sx * 1.0, 0.3, -0.2); root.add(arm);
        M.add(rb(0.35, 0.4, 0.5, 0.08), dark, 0, 0, 0, arm); M.add(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8), hull, 0, -0.05, -0.8, arm).rotation.x = Math.PI / 2;
        M.add(new THREE.SphereGeometry(0.1, 6, 5), lamp, 0, -0.05, -1.45, arm);
    }
    M.rig = legCfg(M, root, { H: 2.5, thick: 0.17, step: 1.0, lift: 0.7, groups: [[0], [1]], legs: [{ hip: [-0.65, -0.1, 0], foot: [-1.3, 0], L1: 1.9, L2: 2.5 }, { hip: [0.65, -0.1, 0], foot: [1.3, 0], L1: 1.9, L2: 2.5 }], pistons: true, claw: 0.8 });
    M.height = 4.4;
    M.tick = (dt, e, ctx) => { poseRigged(M, e, dt, ctx, 1, 2.5); M.flash(e.flash); };
    return M;
}

function bulwark() {
    const M = new Model();
    const root = new THREE.Group(); M.group.add(root); M.root = root;
    const hull = M.body(SK.olive, 0.5, 0.6), dark = metal(0x1e2118, 0.5, 0.8), lamp = glow(0xff9a30, 3), plate = M.body(0x6a6a50, 0.45, 0.6);
    M.add(rb(3.6, 1.2, 4.4, 0.3), hull, 0, 0.3, 0, root); M.add(rb(3.0, 0.4, 3.6, 0.1), plate, 0, 1.0, 0.2, root);
    const tur = new THREE.Group(); tur.position.set(0, 1.35, 0); root.add(tur); M.turret = tur;
    M.add(rb(1.9, 0.9, 2.2, 0.25), plate, 0, 0.3, 0, tur);
    const cannon = M.add(new THREE.CylinderGeometry(0.2, 0.27, 3.2, 10), dark, 0, 0.35, -2.2, tur); cannon.rotation.x = Math.PI / 2; M.cannon = cannon;
    M.add(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 10), dark, 0, 0.35, -3.6, tur).rotation.x = Math.PI / 2;
    M.add(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), dark, 0.9, 0.5, -1.3, tur).rotation.x = Math.PI / 2;
    M.add(new THREE.SphereGeometry(0.18, 8, 6), lamp, 0, 0.75, -0.9, tur);
    M.rig = legCfg(M, root, { H: 2.1, thick: 0.28, step: 1.3, lift: 0.8, groups: [[0, 3], [1, 2]], legs: [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, z], i) => ({ hip: [sx * 1.7, -0.2, z * 1.7], foot: [sx * 3.3, z * 2.2], L1: 2.2, L2: 3.0 })), claw: 0.8 });
    M.rig.legs.forEach((l, i) => { l.id = i; });
    M.height = 3.6;
    M.tick = (dt, e, ctx) => { poseRigged(M, e, dt, ctx, 1, 2.0); M.flash(e.flash); };
    return M;
}

function turret() {
    const M = new Model();
    const base = metal(0x30343c, 0.5, 0.8), head = M.body(0x4a4f5a, 0.4, 0.8), lamp = glow(0xff4488, 3.2), dark = metal(0x14161a, 0.5, 0.8);
    M.add(new THREE.CylinderGeometry(1.4, 1.7, 0.7, 12), base, 0, 0.35); M.add(new THREE.CylinderGeometry(0.7, 0.9, 0.9, 10), dark, 0, 0.9);
    const h = new THREE.Group(); h.position.y = 1.5; M.group.add(h); M.head = h;
    M.add(rb(1.5, 0.9, 1.5, 0.22), head, 0, 0, 0, h);
    for (const sx of [-1, 1]) { M.add(new THREE.CylinderGeometry(0.11, 0.15, 2.0, 8), dark, sx * 0.4, 0.05, -1.3, h).rotation.x = Math.PI / 2; M.add(new THREE.SphereGeometry(0.09, 6, 5), lamp, sx * 0.4, 0.05, -2.3, h); }
    M.add(new THREE.SphereGeometry(0.22, 8, 6), lamp, 0, 0.5, -0.5, h);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; M.add(new THREE.ConeGeometry(0.14, 0.6, 5), base, Math.cos(a) * 1.6, 0.3, Math.sin(a) * 1.6).rotation.z = Math.cos(a) * 0.4; }
    M.height = 2.6;
    M.tick = (dt, e, ctx) => { M.group.position.set(e.x, e.y, e.z); h.rotation.y = -e.yaw; M.flash(e.flash); };
    return M;
}

function pylon() {
    const M = new Model();
    const crys = M.body(0x8a5af0, 0.15, 0.3, { emissive: new THREE.Color(0x4a20c0), emissiveIntensity: 1 }), ring = glow(0x7ae8ff, 3), base = metal(0x2a2a38, 0.5, 0.8);
    M.add(new THREE.CylinderGeometry(1.2, 1.6, 0.9, 8), base, 0, 0.45);
    const c = M.add(new THREE.OctahedronGeometry(1, 0), crys, 0, 3.6, 0); c.scale.set(0.9, 2.2, 0.9);
    M.ring1 = M.add(new THREE.TorusGeometry(1.5, 0.08, 6, 24), ring, 0, 3.6, 0); M.ring2 = M.add(new THREE.TorusGeometry(1.2, 0.06, 6, 24), ring, 0, 3.6, 0);
    M.crys = c; M.height = 6.5;
    M.tick = (dt, e, ctx) => {
        M.group.position.set(e.x, e.y, e.z); c.rotation.y += dt * 0.8; M.ring1.rotation.x = ctx.time * 1.3; M.ring2.rotation.z = ctx.time * 1.8; c.position.y = 3.6 + Math.sin(ctx.time * 2 + e.id) * 0.2;
        M.flash(e.flash);
    };
    return M;
}

// ------------------------------------------------------------------------------------------ bosses
function bossCommon(M, e, ctx) {
    const b = e.b;
    // phase transition shimmer and shield bubble
    if (!M.shield) {
        M.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
        M.shield.userData.keep = true; M.group.add(M.shield);
    }
    const want = b.shield ? 0.28 + Math.sin(ctx.time * 6) * 0.06 : (b.trans > 0 ? 0.16 + Math.sin(ctx.time * 22) * 0.1 : 0);
    M.shield.material.opacity += (want - M.shield.material.opacity) * 0.2;
    M.shield.visible = M.shield.material.opacity > 0.01;
    M.shield.position.set(e.x, e.y + e.h * 0.5, e.z); M.shield.scale.setScalar(e.r * 1.7);
    if (b.dying > 0) { M.group.position.y += Math.sin(ctx.time * 60) * 0.06; }
}
const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const actPose = (e) => {
    const a = e.b.act; if (!a) return { raise: 0, charge: 0 };
    const w = a.k === 'stomp' ? 0.8 : a.k === 'flamering' ? 0.8 : a.k === 'beam' ? 0.9 : a.k === 'charge' || a.k === 'lance' ? a.wind : 0.5;
    return { raise: smooth01(a.t / w) * (a.k === 'stomp' && a.t > w ? Math.max(0, 1 - (a.t - w) * 5) : 1), charge: a.k === 'charge' || a.k === 'lance' ? smooth01(a.t / a.wind) : 0, beam: a.k === 'beam' && a.on ? 1 : 0, k: a.k };
};

function gatekeeper() {
    const M = new Model();
    const root = new THREE.Group(); M.group.add(root); M.root = root;
    const hull = M.body(0x434a3a, 0.5, 0.7), plate = M.body(0x5c6650, 0.45, 0.6), dark = metal(0x14160f, 0.5, 0.8), lamp = glow(0xff4a20, 3.2), core = M.body(0x3a1410, 0.5, 0.6, { emissive: new THREE.Color(0xff3a10), emissiveIntensity: 0.6 });
    M.add(rb(5.4, 2.0, 6.8, 0.4), hull, 0, 0.3, 0, root);
    M.plates = new THREE.Group(); root.add(M.plates);
    for (const sx of [-1, 1]) { M.add(rb(0.7, 1.9, 6.2, 0.15), plate, sx * 3.0, 0.5, 0, M.plates); M.add(rb(4.6, 0.5, 1.2, 0.1), plate, 0, 1.55, -3.0, M.plates).rotation.x = -0.3; }
    M.add(rb(4.8, 0.5, 5.6, 0.12), plate, 0, 1.55, 0.3, M.plates);
    M.add(rb(3.6, 1.0, 1.0, 0.2), core, 0, 0.0, 3.3, root);                       // exposed frame at the back
    const tur = new THREE.Group(); tur.position.set(0, 2.1, -0.4); root.add(tur); M.turret = tur;
    M.add(rb(3.0, 1.3, 3.4, 0.35), plate, 0, 0.4, 0, tur);
    const cannon = new THREE.Group(); cannon.position.set(0, 0.5, -1.6); tur.add(cannon); M.cannon = cannon;
    M.add(new THREE.CylinderGeometry(0.34, 0.45, 5.0, 12), dark, 0, 0, -2.4, cannon).rotation.x = Math.PI / 2;
    M.add(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12), dark, 0, 0, -5.0, cannon).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) { M.add(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), dark, sx * 1.3, 0.4, -2.4, tur).rotation.x = Math.PI / 2; M.add(new THREE.SphereGeometry(0.16, 6, 5), lamp, sx * 1.3, 0.4, -3.65, tur); }
    M.add(new THREE.SphereGeometry(0.3, 10, 8), lamp, 0, 1.15, -0.4, tur);
    M.rig = legCfg(M, root, { H: 3.2, thick: 0.5, step: 2.0, lift: 1.2, groups: [[0, 3], [1, 2]], claw: 1.2, pistons: true, legs: [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, z]) => ({ hip: [sx * 2.7, -0.5, z * 2.4], foot: [sx * 5.4, z * 3.6], L1: 3.6, L2: 4.6 })) });
    M.height = 7;
    M.tick = (dt, e, ctx) => {
        const s = e.r / 3.4, k = actPose(e);
        poseRigged(M, e, dt, ctx, s, 3.2 + k.charge * -0.5);
        M.plates.visible = e.b.ph < 1;
        core.emissiveIntensity = e.b.ph >= 1 ? 2.2 + Math.sin(ctx.time * 8) * 0.8 : 0.6;
        M.cannon.position.z = -1.6 + (k.k === 'shells' && e.b.act.t > 0.5 ? Math.max(0, 0.6 - (e.b.act.t - 0.5)) : 0);
        M.flash(e.flash); bossCommon(M, e, ctx);
    };
    return M;
}

function strider() {
    const M = new Model();
    const root = new THREE.Group(); M.group.add(root); M.root = root;
    const chit = M.body(0x40283a, 0.35, 0.55), plate = M.body(0x6a3a50, 0.35, 0.6), dark = metal(0x120c10, 0.5, 0.8), lamp = glow(SK.glowR, 3.5);
    const coreMat = M.body(0x401020, 0.3, 0.3, { emissive: new THREE.Color(0xff3060), emissiveIntensity: 0.5 });
    const bodyM = M.add(new THREE.SphereGeometry(2.2, 20, 14), chit, 0, 0.3, 0, root); bodyM.scale.set(1.1, 0.75, 1.5);
    for (let i = 0; i < 5; i++) M.add(new THREE.TorusGeometry(2.0 - Math.abs(i - 2) * 0.25, 0.14, 6, 24), plate, 0, 0.3, (i - 2) * 0.9, root).rotation.x = Math.PI / 2 - 0.0;
    M.mortars = new THREE.Group(); M.mortars.position.set(0, 1.5, 0.6); root.add(M.mortars);
    for (const sx of [-1, 1]) { const t = M.add(new THREE.CylinderGeometry(0.4, 0.55, 3.6, 10), dark, sx * 0.9, 1.3, 0, M.mortars); t.rotation.x = -0.5; M.add(new THREE.TorusGeometry(0.5, 0.08, 6, 14), lamp, sx * 0.9, 2.9, -1.4, M.mortars).rotation.x = -0.5 + Math.PI / 2; }
    M.core = M.add(new THREE.SphereGeometry(0.9, 16, 12), coreMat, 0, -0.1, -2.1, root);
    M.shell1 = M.add(new THREE.SphereGeometry(1.15, 14, 10, 0, 6.3, 0, 1.4), plate, 0, -0.05, -2.1, root); M.shell1.rotation.x = -0.4;
    for (const sx of [-1, 1]) { M.add(new THREE.SphereGeometry(0.28, 8, 6), lamp, sx * 0.6, 0.9, -2.4, root); }
    M.rig = legCfg(M, root, { H: 4.2, thick: 0.4, step: 2.4, lift: 1.6, groups: [[0, 2, 4], [1, 3, 5]], claw: 1.4, leg: 0x2c1a26, pistons: false, knee: lamp,
        legs: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]].map(([sx, z]) => ({ hip: [sx * 1.9, -0.2, z * 1.8], foot: [sx * 6.0, z * 3.8], L1: 4.4, L2: 5.6 })) });
    M.height = 9;
    M.tick = (dt, e, ctx) => {
        const s = e.r / 3.6, k = actPose(e);
        poseRigged(M, e, dt, ctx, s, 4.2 - k.raise * 0.6);
        const open = e.b.ph >= 2 ? 1 : 0;
        M.openT = (M.openT || 0) + (open - (M.openT || 0)) * Math.min(1, dt * 3);
        M.shell1.rotation.x = -0.4 - M.openT * 1.3; M.shell1.position.y = -0.05 + M.openT * 1.1;
        coreMat.emissiveIntensity = 0.5 + M.openT * (2.6 + Math.sin(ctx.time * 9) * 0.8);
        M.mortars.rotation.x = k.k === 'shells' ? -0.15 : 0;
        M.flash(e.flash); bossCommon(M, e, ctx);
    };
    return M;
}

function worm() {
    const M = new Model();
    const ice = M.body(0x5a7a9a, 0.2, 0.4), frost = M.body(0xbfe0ff, 0.15, 0.3), mouth = glow(0x66e8ff, 3.5), dark = metal(0x1a2434, 0.4, 0.7);
    const head = new THREE.Group(); M.group.add(head); M.head = head;
    const skull = M.add(new THREE.SphereGeometry(2.6, 18, 14), ice, 0, 0, 0, head); skull.scale.set(1, 0.85, 1.35);
    for (const sy of [1, -1]) for (const sx of [-1, 1]) { const j = M.add(new THREE.ConeGeometry(0.8, 3.0, 6), frost, sx * 1.4, sy * 0.4, -2.7, head); j.rotation.x = -Math.PI / 2 + sy * 0.2; j.rotation.z = sx * 0.3; }
    M.jawT = M.add(new THREE.SphereGeometry(1.6, 12, 8), mouth, 0, 0, -2.4, head); M.jawT.scale.set(1, 0.6, 0.5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; M.add(new THREE.ConeGeometry(0.35, 1.6, 5), frost, Math.cos(a) * 1.4, Math.sin(a) * 1.1 + 0.2, 1.6, head).rotation.x = Math.PI / 2 + 0.3; }
    for (const sx of [-1, 1]) M.add(new THREE.SphereGeometry(0.3, 8, 6), glow(0xffffff, 4), sx * 1.5, 0.9, -1.7, head);
    M.segs = [];
    for (let i = 0; i < 9; i++) {
        const g = new THREE.Group(); const r = 2.3 - i * 0.16;
        M.add(new THREE.SphereGeometry(r, 14, 10), ice, 0, 0, 0, g);
        for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.6; M.add(new THREE.ConeGeometry(r * 0.25, r * 0.9, 5), frost, Math.sin(a) * r * 0.9, Math.cos(a) * r * 0.9, 0, g).rotation.z = -a; }
        M.group.add(g); M.segs.push(g);
    }
    M.height = 6;
    M.tick = (dt, e, ctx) => {
        const b = e.b, y = e.y + 1.8, hide = b.under;
        const vis = !hide;
        M.group.visible = true;
        head.visible = vis; M.segs.forEach((s) => { s.visible = vis; });
        // dive/erupt animation: sink below the surface
        const sink = b.act && b.act.k === 'burrow' && b.act.s === 0 ? smooth01(b.act.t / 0.8) : 0;
        head.position.set(e.x, y - sink * 5 + (b.stun > 0 ? Math.sin(ctx.time * 5) * 0.2 : 0), e.z);
        head.rotation.set(-0.15 - (b.act && b.act.k === 'shards' ? 0.3 : 0), -e.yaw, 0);
        let px = e.x, pz = e.z;
        M.segs.forEach((s, i) => { const sg = b.segs[i] || { x: px, z: pz }; const h = ctx.h(sg.x, sg.z); s.position.set(sg.x, h + 1.2 + Math.sin(ctx.time * 2 + i) * 0.4 - sink * 5, sg.z); px = sg.x; pz = sg.z; });
        M.jawT.scale.x = 1 + Math.max(0, Math.sin(ctx.time * 4)) * 0.3; M.jawT.material.emissiveIntensity = 3 + Math.sin(ctx.time * 8);
        M.flash(e.flash); M.hidden = hide;
        bossCommon(M, e, ctx);
    };
    return M;
}

function colossus(kind) {
    const M = new Model();
    const warlord = kind === 'warlord';
    const root = new THREE.Group(); M.group.add(root); M.root = root;
    const hull = M.body(warlord ? 0x3a2048 : 0x2a2420, 0.4, 0.7), plate = M.body(warlord ? 0x6a3a80 : 0x4a3a32, 0.35, 0.7), dark = metal(0x0e0c10, 0.5, 0.8);
    const fire = warlord ? 0xff4adf : 0xff6a10;
    const lamp = glow(fire, 3.6), gold = metal(0xd8a830, 0.25, 0.95);
    const coreMat = M.body(0x301008, 0.4, 0.3, { emissive: new THREE.Color(fire), emissiveIntensity: 1 });
    M.add(rb(3.4, 2.6, 2.4, 0.4), hull, 0, 2.2, 0, root);
    M.add(rb(4.4, 1.2, 2.6, 0.3), plate, 0, 3.7, 0, root);                               // shoulders
    M.core = M.add(new THREE.SphereGeometry(0.85, 16, 12), coreMat, 0, 2.3, -1.25, root);
    M.coreCover = M.add(rb(1.5, 1.7, 0.3, 0.1), plate, 0, 2.3, -1.45, root);
    const head = M.add(rb(1.3, 1.1, 1.3, 0.3), plate, 0, 4.9, -0.1, root); head.name = 'head';
    for (const sx of [-1, 1]) M.add(new THREE.SphereGeometry(0.15, 6, 5), lamp, sx * 0.38, 4.95, -0.75, root);
    if (warlord) {
        for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.6; M.add(new THREE.ConeGeometry(0.17, 1.4, 5), gold, Math.sin(a) * 0.9, 5.7 + Math.cos(a) * 0.1, 0.1, root).rotation.z = -a; }
        M.cape = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.2), new THREE.MeshStandardMaterial({ color: 0x4a1a60, emissive: 0x3a0a60, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.7 })); M.cape.position.set(0, 2.8, 1.35); M.cape.rotation.x = 0.1; root.add(M.cape);
    } else {
        for (const sx of [-1, 1]) { M.add(new THREE.CylinderGeometry(0.34, 0.5, 3.0, 10), dark, sx * 1.4, 5.0, 0.8, root); }
        M.add(new THREE.CylinderGeometry(1.0, 1.5, 0.5, 10), dark, 0, 3.4, 0.9, root);
    }
    // arms: right carries the weapon, left the fist / shield
    M.armR = new THREE.Group(); M.armR.position.set(2.6, 3.6, -0.2); root.add(M.armR);
    M.add(rb(0.9, 2.8, 0.9, 0.2), hull, 0, -1.3, 0, M.armR);
    if (warlord) { M.add(new THREE.BoxGeometry(0.3, 4.4, 0.9), glow(0xff8aff, 3), 0, -3.4, -0.2, M.armR).rotation.x = 0.1; M.add(rb(1.4, 0.35, 1.2, 0.1), gold, 0, -2.5, 0, M.armR); }
    else { M.add(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 10), dark, 0, -3.2, -0.6, M.armR).rotation.x = Math.PI / 2 - 0.1; M.add(new THREE.SphereGeometry(0.3, 8, 6), lamp, 0, -3.2, -1.9, M.armR); }
    M.armL = new THREE.Group(); M.armL.position.set(-2.6, 3.6, -0.2); root.add(M.armL);
    M.add(rb(0.9, 2.8, 0.9, 0.2), hull, 0, -1.3, 0, M.armL);
    M.add(rb(1.5, 1.4, 1.4, 0.3), plate, 0, -3.0, -0.1, M.armL);
    M.rig = legCfg(M, root, { H: 4.0, thick: 0.62, step: 2.4, lift: 1.7, groups: [[0], [1]], claw: 1.4, pistons: true, knee: lamp, leg: warlord ? 0x20142a : 0x1c1816,
        legs: [{ hip: [-1.2, 0.6, 0], foot: [-2.0, 0], L1: 3.0, L2: 4.1 }, { hip: [1.2, 0.6, 0], foot: [2.0, 0], L1: 3.0, L2: 4.1 }] });
    M.height = 9;
    M.tick = (dt, e, ctx) => {
        const s = e.r / 4.0, k = actPose(e), b = e.b;
        poseRigged(M, e, dt, ctx, s, 4.2 - k.raise * 0.9 - (k.charge ? 0.5 : 0));
        M.armR.rotation.x = -k.raise * 2.2 * (k.k === 'stomp' ? 0 : 1) + (k.beam ? -1.35 : 0) + (k.k === 'fireballs' || k.k === 'fan' ? -0.8 : 0) + Math.sin(ctx.time * 1.5) * 0.04;
        M.armL.rotation.x = k.k === 'stomp' ? -k.raise * 2.4 : Math.sin(ctx.time * 1.3 + 1) * 0.05;
        const vuln = BOSSES[e.type].phases[b.ph].vuln;
        M.coverOpen = (M.coverOpen || 0) + ((vuln ? 1 : 0) - (M.coverOpen || 0)) * Math.min(1, dt * 3);
        M.coreCover.position.x = M.coverOpen * 1.6; M.coreCover.rotation.y = M.coverOpen * 0.6;
        coreMat.emissiveIntensity = 1.2 + (vuln ? 2.4 : 0) + Math.sin(ctx.time * (vuln ? 10 : 4)) * 0.6;
        if (M.cape) M.cape.rotation.x = 0.15 + Math.sin(ctx.time * 3) * 0.08 + Math.hypot(e.vx, e.vz) * 0.03;
        M.flash(e.flash); bossCommon(M, e, ctx);
    };
    return M;
}

export function buildEnemyModel(type) {
    switch (type) {
        case 'trooper': case 'rocketeer': return humanoid(type);
        case 'wasp': return wasp();
        case 'stalker': return stalker();
        case 'bulwark': return bulwark();
        case 'turret': return turret();
        case 'pylon': return pylon();
        case 'gatekeeper': return gatekeeper();
        case 'strider': return strider();
        case 'leviathan': return worm();
        case 'titan': return colossus('titan');
        case 'warlord': return colossus('warlord');
        default: return humanoid('trooper');
    }
}
