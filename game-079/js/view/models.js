// Enemy and boss models, all procedural: lathe profiles, tubes, displaced spheres, capsules.
// Every model faces -z, stands on y = 0, and has its own uniform bag (hit flash, freeze, burn,
// wind-up glow, dissolve) shared by all of its materials. animate() poses it from the sim enemy.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchActor, actorUniforms } from './shaderlib.js';

const V = (x, y) => new THREE.Vector2(x, y);
const GEO = new Map();
const geo = (key, make) => { if (!GEO.has(key)) GEO.set(key, make()); return GEO.get(key); };

function mat(U, color, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.1, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, envMapIntensity: o.env ?? 0.6, flatShading: !!o.flat });
    return patchActor(m, U, o.key || 'actor');
}
function glowMat(color, k = 2.5) {
    const c = new THREE.Color(color).multiplyScalar(k);
    return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
}
function add(parent, g, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const o = new THREE.Mesh(g, m);
    o.position.set(...p); o.rotation.set(...r); o.scale.set(...s);
    parent.add(o);
    return o;
}
function pivot(parent, p = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; }

/** A noisy, smooth-shaded blob: an icosahedron with merged vertices, displaced along its normal. */
function blob(r, detail, amp, freq, seed = 1, fold = 0) {
    let g = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = v.clone().normalize();
        const w = Math.sin(n.x * freq + seed) * Math.sin(n.y * freq * 1.3 + seed * 2) * Math.sin(n.z * freq * 0.9 + seed * 3);
        const gyri = fold ? Math.abs(Math.sin(n.x * fold + Math.sin(n.y * fold * 0.7) * 2 + n.z * fold * 0.5)) : 0;
        v.addScaledVector(n, amp * w - gyri * amp * 0.8);
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

/** A ring of cone teeth around a circle (radius r, at height y), pointing `dir` (1 up, -1 down). */
function teethRing(r, n, len, y, dir, tilt = 0.4) {
    const parts = [];
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const c = new THREE.ConeGeometry(len * 0.28, len * (0.7 + 0.3 * Math.abs(Math.sin(k * 2.7))), 6);
        c.rotateX(dir > 0 ? 0 : Math.PI);
        c.rotateX(-tilt * dir);
        c.rotateY(-a + Math.PI / 2);
        c.translate(Math.cos(a) * r, y + dir * len * 0.4, Math.sin(a) * r);
        parts.push(c);
    }
    return mergeGeometries(parts);
}

function tube(points, r, seg = 24, rad = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, seg, r, rad, false);
}

// ==================================================================== Snarl Trooper
function trooper(U) {
    const root = new THREE.Group();
    const armor = mat(U, 0x1f3442, { metal: 0.7, rough: 0.3 });
    const skin = mat(U, 0x6a4a78, { rough: 0.6 });
    const dark = mat(U, 0x16161e, { metal: 0.5, rough: 0.4 });
    const gum = mat(U, 0x9a1830, { rough: 0.3, emissive: 0x300008 });
    const tooth = mat(U, 0xf2ecd8, { rough: 0.25 });
    const eye = glowMat(0xff2a10, 3);
    const body = pivot(root, [0, 1.0, 0]);
    // digitigrade legs
    const legs = [];
    for (const s of [-1, 1]) {
        const hip = pivot(body, [0.2 * s, 0, 0]);
        add(hip, geo('tr_thigh', () => new THREE.CapsuleGeometry(0.11, 0.32, 6, 12)), skin, [0, -0.2, -0.06], [0.35, 0, 0]);
        const knee = pivot(hip, [0, -0.42, -0.14]);
        add(knee, geo('tr_shin', () => new THREE.CapsuleGeometry(0.08, 0.34, 6, 12)), armor, [0, -0.2, 0.08], [-0.45, 0, 0]);
        add(knee, geo('tr_foot', () => new THREE.BoxGeometry(0.16, 0.08, 0.3)), dark, [0, -0.5, -0.02]);
        legs.push({ hip, knee });
    }
    // barrel chest with the grinning mouth
    const torso = pivot(body, [0, 0.1, 0]);
    add(torso, geo('tr_chest', () => new THREE.LatheGeometry([V(0.0, -0.05), V(0.24, 0.0), V(0.34, 0.2), V(0.36, 0.45), V(0.3, 0.68), V(0.16, 0.8), V(0, 0.82)], 24)), armor);
    const mouth = pivot(torso, [0, 0.38, -0.31]);
    add(mouth, geo('tr_lips', () => new THREE.TorusGeometry(0.17, 0.05, 10, 24)), gum, [0, 0, 0], [0, 0, 0], [1.2, 0.75, 1]);
    add(mouth, geo('tr_gullet', () => new THREE.CircleGeometry(0.16, 20)), glowMat(0x700010, 1.4), [0, 0, 0.02], [0, Math.PI, 0], [1.15, 0.7, 1]);
    const teeth = add(mouth, geo('tr_teeth', () => { const g = teethRing(0.16, 14, 0.1, 0, 1, 1.5); g.rotateX(Math.PI / 2); return g; }), tooth, [0, 0, 0.01], [0, 0, 0], [1.15, 0.7, 1]);
    void teeth;
    // shoulder pads
    for (const s of [-1, 1]) add(torso, geo('tr_pad', () => new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), armor, [0.34 * s, 0.66, 0], [0, 0, -0.5 * s], [1.2, 0.8, 1.1]);
    // head: helmet, three eyes, a fin
    const head = pivot(torso, [0, 0.86, -0.02]);
    add(head, geo('tr_head', () => new THREE.SphereGeometry(0.17, 20, 14)), skin, [0, 0.08, 0], [0, 0, 0], [1, 1.1, 1.1]);
    add(head, geo('tr_helm', () => new THREE.SphereGeometry(0.19, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), armor, [0, 0.1, 0.02]);
    add(head, geo('tr_fin', () => new THREE.BoxGeometry(0.03, 0.14, 0.3)), dark, [0, 0.3, 0.04]);
    for (const [x, y] of [[-0.08, 0.1], [0.08, 0.1], [0, 0.16]]) add(head, geo('tr_eye', () => new THREE.SphereGeometry(0.035, 10, 8)), eye, [x, y, -0.16]);
    // arms: the right holds a plasma rifle
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = pivot(torso, [0.42 * s, 0.6, 0]);
        add(sh, geo('tr_upper', () => new THREE.CapsuleGeometry(0.075, 0.3, 6, 10)), skin, [0, -0.2, 0]);
        const el = pivot(sh, [0, -0.4, 0]);
        add(el, geo('tr_fore', () => new THREE.CapsuleGeometry(0.07, 0.26, 6, 10)), armor, [0, -0.18, 0]);
        add(el, geo('tr_hand', () => new THREE.SphereGeometry(0.065, 10, 8)), skin, [0, -0.36, 0]);
        arms.push({ sh, el });
    }
    // the rifle is built along -z; its holder turns that into -y, down the forearm
    const holder = pivot(arms[1].el, [0, -0.36, 0.02]);
    holder.rotation.x = -Math.PI / 2;
    const gun = pivot(holder, [0, 0.0, -0.18]);
    add(gun, geo('tr_gun', () => new THREE.BoxGeometry(0.1, 0.14, 0.5)), dark);
    add(gun, geo('tr_barrel', () => new THREE.CylinderGeometry(0.035, 0.035, 0.35, 10).rotateX(Math.PI / 2)), dark, [0, 0.02, -0.4]);
    add(gun, geo('tr_coil', () => new THREE.TorusGeometry(0.06, 0.018, 8, 16)), glowMat(0x40ffd0, 2.2), [0, 0.02, -0.3]);
    add(gun, geo('tr_coil', null), glowMat(0x40ffd0, 2.2), [0, 0.02, -0.42]);
    arms[0].sh.rotation.x = 0.2; arms[1].sh.rotation.x = 1.25; arms[1].el.rotation.x = 0.3; arms[1].sh.rotation.z = -0.12;
    return { root, body, torso, head, legs, arms, mouth, gun, height: 1.9 };
}

// ==================================================================== Chomper
function chomper(U, scale = 1) {
    const root = new THREE.Group();
    const hide = mat(U, 0x6b8a1c, { rough: 0.5 });
    const belly = mat(U, 0xc9b27a, { rough: 0.6 });
    const gum = mat(U, 0xb0203a, { rough: 0.3, emissive: 0x200008 });
    const tooth = mat(U, 0xfff6e0, { rough: 0.2 });
    const body = pivot(root, [0, 0.42, 0]);
    // upper jaw (dome) and lower jaw (bowl), hinged at the back
    const hinge = pivot(body, [0, 0, 0.22]);
    const upper = pivot(hinge, [0, 0, -0.22]);
    add(upper, geo('ch_up', () => new THREE.SphereGeometry(0.42, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), hide);
    add(upper, geo('ch_upTeeth', () => teethRing(0.36, 16, 0.14, 0, -1, 0.1)), tooth);
    add(upper, geo('ch_palate', () => new THREE.CircleGeometry(0.38, 24).rotateX(Math.PI / 2)), gum, [0, -0.005, 0]);
    // spikes on the back
    for (let k = 0; k < 5; k++) add(upper, geo('ch_spike', () => new THREE.ConeGeometry(0.05, 0.22, 6)), belly, [0, 0.35 - k * 0.02, 0.05 + k * 0.08], [0.9 + k * 0.15, 0, 0]);
    const lower = pivot(hinge, [0, 0, -0.22]);
    add(lower, geo('ch_lo', () => new THREE.SphereGeometry(0.4, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), belly);
    add(lower, geo('ch_loTeeth', () => teethRing(0.34, 14, 0.12, 0, 1, 0.1)), tooth);
    add(lower, geo('ch_tongue', () => new THREE.CapsuleGeometry(0.08, 0.3, 6, 10).rotateX(Math.PI / 2)), gum, [0, 0.0, -0.05], [0, 0, 0], [1.4, 0.4, 1]);
    // one stalk eye
    const stalk = pivot(upper, [0, 0.36, -0.1]);
    add(stalk, geo('ch_stalk', () => tube([[0, 0, 0], [0, 0.12, -0.04], [0, 0.22, 0.02]], 0.03, 10, 6)), hide);
    add(stalk, geo('ch_eyeball', () => new THREE.SphereGeometry(0.07, 14, 10)), belly, [0, 0.24, 0.02]);
    add(stalk, geo('ch_pupil', () => new THREE.SphereGeometry(0.035, 10, 8)), glowMat(0xffe020, 2.5), [0, 0.25, -0.04]);
    // four stubby legs
    const legs = [];
    for (const [x, z] of [[-0.28, -0.18], [0.28, -0.18], [-0.28, 0.2], [0.28, 0.2]]) {
        const hip = pivot(body, [x, -0.1, z]);
        add(hip, geo('ch_leg', () => new THREE.CapsuleGeometry(0.06, 0.2, 4, 8)), hide, [0, -0.17, 0]);
        add(hip, geo('ch_claw', () => new THREE.ConeGeometry(0.05, 0.12, 6).rotateX(-Math.PI / 2)), tooth, [0, -0.3, -0.06]);
        legs.push({ hip });
    }
    root.scale.setScalar(scale);
    return { root, body, upper, lower, legs, stalk, height: 0.8 * scale };
}

// ==================================================================== Skull Drone
function drone(U) {
    const root = new THREE.Group();
    const chrome = mat(U, 0xcfd3e0, { metal: 1.0, rough: 0.18, env: 1.4 });
    const dark = mat(U, 0x0d0d12, { metal: 0.6, rough: 0.4 });
    const body = pivot(root, [0, 0.4, 0]);
    // the skull: cranium, cheekbones, jaw
    const skull = pivot(body, [0, 0, 0]);
    add(skull, geo('dr_cran', () => blob(0.3, 10, 0.012, 7, 3)), chrome, [0, 0.06, 0.02], [0, 0, 0], [1, 1.05, 1.15]);
    add(skull, geo('dr_cheek', () => new THREE.SphereGeometry(0.13, 16, 10)), chrome, [-0.13, -0.08, -0.16]);
    add(skull, geo('dr_cheek', null), chrome, [0.13, -0.08, -0.16]);
    for (const s of [-1, 1]) {
        add(skull, geo('dr_socket', () => new THREE.SphereGeometry(0.085, 14, 10)), dark, [0.1 * s, 0.02, -0.25]);
        add(skull, geo('dr_eye', () => new THREE.SphereGeometry(0.045, 12, 8)), glowMat(0xff1010, 4), [0.1 * s, 0.02, -0.29]);
    }
    add(skull, geo('dr_nose', () => new THREE.ConeGeometry(0.04, 0.08, 3).rotateX(Math.PI)), dark, [0, -0.08, -0.28]);
    const jaw = pivot(skull, [0, -0.14, -0.05]);
    add(jaw, geo('dr_jaw', () => new THREE.CylinderGeometry(0.16, 0.12, 0.1, 18, 1, false, -Math.PI * 0.9, Math.PI * 1.8)), chrome, [0, -0.04, -0.06]);
    add(jaw, geo('dr_teeth', () => { const parts = []; for (let k = 0; k < 8; k++) parts.push(new THREE.BoxGeometry(0.03, 0.05, 0.03).translate(-0.105 + k * 0.03, 0.02, -0.18)); return mergeGeometries(parts); }), chrome);
    // jet pods
    const jets = [];
    for (const s of [-1, 1]) {
        const pod = pivot(body, [0.36 * s, -0.02, 0.05]);
        add(pod, geo('dr_pod', () => new THREE.CylinderGeometry(0.08, 0.1, 0.3, 14)), dark);
        add(pod, geo('dr_ring', () => new THREE.TorusGeometry(0.095, 0.02, 8, 16).rotateX(Math.PI / 2)), chrome, [0, 0.08, 0]);
        const flame = add(pod, geo('dr_flame', () => new THREE.ConeGeometry(0.07, 0.35, 10).rotateX(Math.PI)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 3.0), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [0, -0.32, 0]);
        add(body, geo('dr_strut', () => new THREE.BoxGeometry(0.2, 0.04, 0.06)), dark, [0.24 * s, -0.02, 0.05]);
        jets.push(flame);
    }
    add(body, geo('dr_ant', () => new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4)), dark, [0.12, 0.38, 0.1], [0.3, 0, 0.3]);
    add(body, geo('dr_antTip', () => new THREE.SphereGeometry(0.02, 8, 6)), glowMat(0xff3030, 3), [0.17, 0.52, 0.15]);
    return { root, body, skull, jaw, jets, height: 0.8 };
}

// ==================================================================== Meatbeast
function brute(U) {
    const root = new THREE.Group();
    const flesh = mat(U, 0x9a3a32, { rough: 0.45, emissive: 0x200404 });
    const plate = mat(U, 0x4d4f58, { metal: 0.8, rough: 0.35 });
    const bone = mat(U, 0xe8dcc0, { rough: 0.4 });
    const body = pivot(root, [0, 1.15, 0]);
    const legs = [];
    for (const s of [-1, 1]) {
        const hip = pivot(body, [0.38 * s, 0, 0.1]);
        add(hip, geo('br_thigh', () => new THREE.CapsuleGeometry(0.2, 0.42, 6, 14)), flesh, [0, -0.3, 0]);
        const knee = pivot(hip, [0, -0.62, 0]);
        add(knee, geo('br_shin', () => new THREE.CapsuleGeometry(0.17, 0.32, 6, 12)), plate, [0, -0.25, 0]);
        add(knee, geo('br_foot', () => new THREE.BoxGeometry(0.34, 0.14, 0.5)), plate, [0, -0.5, -0.08]);
        legs.push({ hip, knee });
    }
    const torso = pivot(body, [0, 0.05, 0]);
    add(torso, geo('br_torso', () => { const g = new THREE.LatheGeometry([V(0, -0.1), V(0.45, 0.0), V(0.62, 0.35), V(0.72, 0.75), V(0.6, 1.05), V(0.3, 1.15), V(0, 1.16)], 28); g.scale(1, 1, 0.8); return g; }), flesh, [0, 0, 0], [0.35, 0, 0]);
    // front armour plates bolted on
    for (let k = 0; k < 3; k++) add(torso, geo('br_plate', () => new THREE.BoxGeometry(0.75, 0.26, 0.12)), plate, [0, 0.3 + k * 0.27, -0.5 + k * 0.06], [0.35 - k * 0.12, 0, 0]);
    // the hump's spine
    for (let k = 0; k < 6; k++) add(torso, geo('br_spine', () => new THREE.ConeGeometry(0.07, 0.3, 6)), bone, [0, 0.95 - k * 0.08, 0.35 + k * 0.07], [0.6 + k * 0.1, 0, 0]);
    // the head, low between the shoulders, with tusks
    const head = pivot(torso, [0, 0.95, -0.55]);
    add(head, geo('br_head', () => blob(0.24, 8, 0.02, 5, 7)), flesh, [0, 0, 0], [0, 0, 0], [1.1, 0.9, 1.1]);
    for (const s of [-1, 1]) {
        add(head, geo('br_tusk', () => tube([[0, 0, 0], [0.04, 0.1, -0.12], [0.02, 0.25, -0.18]], 0.035, 8, 6)), bone, [0.12 * s, -0.1, -0.14], [0, 0, 0], [s, 1, 1]);
        add(head, geo('br_eye', () => new THREE.SphereGeometry(0.04, 8, 6)), glowMat(0xffa020, 3), [0.09 * s, 0.07, -0.21]);
    }
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = pivot(torso, [0.75 * s, 0.85, -0.15]);
        add(sh, geo('br_pad', () => new THREE.SphereGeometry(0.3, 18, 12)), plate, [0, 0.05, 0], [0, 0, 0], [1.1, 0.8, 1]);
        add(sh, geo('br_upper', () => new THREE.CapsuleGeometry(0.2, 0.4, 6, 12)), flesh, [0.05 * s, -0.4, 0]);
        const el = pivot(sh, [0.06 * s, -0.75, 0]);
        add(el, geo('br_fore', () => new THREE.CapsuleGeometry(0.22, 0.4, 6, 12)), flesh, [0, -0.3, -0.05]);
        add(el, geo('br_fist', () => blob(0.27, 6, 0.03, 6, 2)), flesh, [0, -0.72, -0.06]);
        for (let k = 0; k < 3; k++) add(el, geo('br_knuckle', () => new THREE.ConeGeometry(0.05, 0.18, 6).rotateX(-Math.PI / 2)), bone, [(k - 1) * 0.12, -0.75, -0.3]);
        arms.push({ sh, el });
    }
    return { root, body, torso, head, legs, arms, height: 2.6 };
}

// ==================================================================== Brainstalker
function psy(U) {
    const root = new THREE.Group();
    const brainMat = mat(U, 0xe08aa8, { rough: 0.35, emissive: 0x3a0830 });
    const shell = mat(U, 0x2a2440, { metal: 0.5, rough: 0.3 });
    const leg = mat(U, 0x5a4a7a, { rough: 0.5 });
    const body = pivot(root, [0, 1.6, 0]);
    const legs = [];
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
        const hip = pivot(body, [Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2]);
        hip.rotation.y = -a;
        add(hip, geo('ps_upper', () => tube([[0, 0, 0], [0.4, 0.15, 0], [0.62, -0.4, 0], [0.68, -1.55, 0]], 0.04, 20, 6)), leg);
        add(hip, geo('ps_foot', () => new THREE.ConeGeometry(0.05, 0.12, 6).rotateX(Math.PI)), shell, [0.68, -1.56, 0]);
        legs.push({ hip, a });
    }
    // the pod with one huge eye, the brain on top
    add(body, geo('ps_pod', () => new THREE.LatheGeometry([V(0, -0.3), V(0.22, -0.25), V(0.3, -0.05), V(0.28, 0.12), V(0.18, 0.2), V(0, 0.2)], 24)), shell);
    add(body, geo('ps_eyeball', () => new THREE.SphereGeometry(0.15, 20, 14)), mat(U, 0xf0f0e8, { rough: 0.15 }), [0, -0.05, -0.22]);
    add(body, geo('ps_iris', () => new THREE.SphereGeometry(0.07, 14, 10)), glowMat(0xb040ff, 3.5), [0, -0.05, -0.34]);
    const brain = pivot(body, [0, 0.42, 0]);
    add(brain, geo('ps_brain', () => blob(0.36, 16, 0.04, 9, 5, 14)), brainMat, [0, 0, 0], [0, 0, 0], [1, 0.8, 1.15]);
    add(brain, geo('ps_fissure', () => new THREE.BoxGeometry(0.01, 0.3, 0.8)), mat(U, 0x5a1030, {}), [0, 0.12, 0]);
    // dangling feelers
    const feelers = [];
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const f = pivot(body, [Math.cos(a) * 0.18, -0.28, Math.sin(a) * 0.18]);
        add(f, geo('ps_feeler', () => tube([[0, 0, 0], [0.03, -0.25, 0], [-0.02, -0.5, 0.03], [0.02, -0.75, 0]], 0.018, 14, 5)), brainMat);
        feelers.push(f);
    }
    return { root, body, brain, legs, feelers, height: 2.4 };
}

// ==================================================================== Octotank
function tank(U) {
    const root = new THREE.Group();
    const hull = mat(U, 0x3a2d5a, { metal: 0.7, rough: 0.3 });
    const tread = mat(U, 0x15151a, { metal: 0.3, rough: 0.8 });
    const flesh = mat(U, 0x8a3a8a, { rough: 0.4, emissive: 0x200620 });
    const body = pivot(root, [0, 0, 0]);
    const wheels = [];
    for (const s of [-1, 1]) {
        add(body, geo('tk_tread', () => new THREE.CapsuleGeometry(0.32, 1.4, 6, 16).rotateX(Math.PI / 2)), tread, [0.8 * s, 0.34, 0], [0, 0, 0], [0.55, 1, 1]);
        for (let k = 0; k < 4; k++) wheels.push(add(body, geo('tk_wheel', () => new THREE.CylinderGeometry(0.22, 0.22, 0.38, 14).rotateZ(Math.PI / 2)), hull, [0.8 * s, 0.34, -0.66 + k * 0.44]));
    }
    add(body, geo('tk_base', () => new THREE.BoxGeometry(1.4, 0.4, 1.8)), hull, [0, 0.62, 0]);
    const turret = pivot(body, [0, 0.8, 0]);
    add(turret, geo('tk_dome', () => new THREE.LatheGeometry([V(0, 0), V(0.85, 0), V(0.82, 0.35), V(0.6, 0.85), V(0.3, 1.1), V(0, 1.15)], 32)), hull);
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI - Math.PI / 2 - Math.PI / 2;
        add(turret, geo('tk_port', () => new THREE.SphereGeometry(0.09, 12, 8)), glowMat(0x50ff90, 2.6), [Math.cos(a) * 0.72, 0.42, Math.sin(a) * 0.72]);
    }
    // rocket pods
    for (const s of [-1, 1]) {
        const pod = pivot(turret, [0.95 * s, 0.6, -0.1]);
        add(pod, geo('tk_pod', () => new THREE.BoxGeometry(0.34, 0.4, 0.7)), hull);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) add(pod, geo('tk_tube', () => new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10).rotateX(Math.PI / 2)), tread, [(c - 0.5) * 0.15, (r - 0.5) * 0.17, -0.36]);
    }
    // tentacles: chains of segments, each animated
    const tentacles = [];
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const segs = [];
        let parent = pivot(turret, [Math.cos(a) * 0.55, 0.9, Math.sin(a) * 0.55]);
        parent.rotation.set(0, -a, 0);
        const base = parent;
        for (let s = 0; s < 5; s++) {
            const r = 0.1 * (1 - s * 0.15);
            add(parent, geo('tk_seg' + s, () => new THREE.CapsuleGeometry(r, 0.22, 4, 10).translate(0, 0.15, 0)), flesh);
            const next = pivot(parent, [0, 0.3, 0]);
            segs.push(parent);
            parent = next;
        }
        add(parent, geo('tk_tip', () => new THREE.ConeGeometry(0.05, 0.18, 8)), flesh, [0, 0.05, 0]);
        tentacles.push({ base, segs, a });
    }
    return { root, body, turret, wheels, tentacles, height: 2.5 };
}

// ==================================================================== Queen Chompra
function chompra(U) {
    const m = chomper(U, 4.2);
    const crownMat = mat(U, 0xffc531, { metal: 1, rough: 0.2, env: 1.5 });
    for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI - Math.PI;
        add(m.upper, geo('cq_crown', () => new THREE.ConeGeometry(0.04, 0.2, 6)), crownMat, [Math.cos(a) * 0.18, 0.38, -0.05 + Math.sin(a) * 0.1], [0, 0, -Math.cos(a) * 0.4]);
    }
    const sac = mat(U, 0xb8e04a, { rough: 0.2, emissive: 0x2a4a00 });
    add(m.body, geo('cq_sac', () => blob(0.34, 10, 0.03, 8, 4)), sac, [0, 0.05, 0.5], [0, 0, 0], [1, 0.9, 1.3]);
    for (let k = 0; k < 6; k++) add(m.body, geo('cq_egg', () => new THREE.SphereGeometry(0.06, 10, 8)), glowMat(0xd0ff50, 1.6), [Math.sin(k * 2.1) * 0.18, 0.05 + Math.cos(k * 1.3) * 0.12, 0.55 + Math.cos(k * 1.7) * 0.15]);
    m.height = 3.4;
    return m;
}

// ==================================================================== Warlord Vrask
function vrask(U) {
    const root = new THREE.Group();
    const armor = mat(U, 0x2a1c3a, { metal: 0.8, rough: 0.3 });
    const gold = mat(U, 0xffb52e, { metal: 1, rough: 0.18, env: 1.6 });
    const skin = mat(U, 0x5a7a4a, { rough: 0.5 });
    const cape = mat(U, 0x6a0a1a, { rough: 0.7 });
    const body = pivot(root, [0, 1.35, 0]);
    const legs = [];
    for (const s of [-1, 1]) {
        const hip = pivot(body, [0.25 * s, 0, 0]);
        add(hip, geo('vr_thigh', () => new THREE.CapsuleGeometry(0.15, 0.45, 6, 12)), armor, [0, -0.32, 0]);
        const knee = pivot(hip, [0, -0.66, 0]);
        add(knee, geo('vr_shin', () => new THREE.CapsuleGeometry(0.13, 0.42, 6, 12)), armor, [0, -0.3, 0]);
        add(knee, geo('vr_kneecap', () => new THREE.SphereGeometry(0.13, 12, 8)), gold, [0, 0, -0.08]);
        add(knee, geo('vr_boot', () => new THREE.BoxGeometry(0.24, 0.14, 0.42)), armor, [0, -0.62, -0.06]);
        legs.push({ hip, knee });
    }
    const torso = pivot(body, [0, 0.05, 0]);
    add(torso, geo('vr_torso', () => new THREE.LatheGeometry([V(0, 0), V(0.32, 0.02), V(0.42, 0.35), V(0.5, 0.75), V(0.36, 0.95), V(0, 0.98)], 24).scale(1, 1, 0.75)), armor);
    add(torso, geo('vr_chest', () => new THREE.SphereGeometry(0.4, 24, 12, -Math.PI * 0.5, Math.PI, 0.3, 1.2)), gold, [0, 0.55, -0.05], [0, Math.PI, 0], [1, 1, 0.65]);
    add(torso, geo('vr_belt', () => new THREE.TorusGeometry(0.36, 0.05, 8, 24).rotateX(Math.PI / 2)), gold, [0, 0.12, 0], [0, 0, 0], [1, 1, 0.8]);
    const head = pivot(torso, [0, 1.05, 0]);
    add(head, geo('vr_head', () => blob(0.2, 10, 0.015, 6, 9)), skin, [0, 0.05, 0], [0, 0, 0], [0.95, 1.15, 1]);
    add(head, geo('vr_helm', () => new THREE.SphereGeometry(0.23, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), gold, [0, 0.1, 0.02]);
    for (const s of [-1, 1]) {
        add(head, geo('vr_horn', () => tube([[0, 0, 0], [0.12, 0.1, 0.05], [0.18, 0.3, 0.15], [0.12, 0.45, 0.3]], 0.035, 14, 6)), gold, [0.16 * s, 0.18, 0], [0, 0, 0], [s, 1, 1]);
        add(head, geo('vr_eye', () => new THREE.SphereGeometry(0.03, 8, 6)), glowMat(0xffee30, 4), [0.075 * s, 0.06, -0.18]);
    }
    add(head, geo('vr_jaw', () => new THREE.BoxGeometry(0.22, 0.08, 0.14)), armor, [0, -0.11, -0.08]);
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = pivot(torso, [0.56 * s, 0.82, 0]);
        add(sh, geo('vr_pad', () => new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), gold, [0, 0.03, 0], [0, 0, -0.4 * s]);
        add(sh, geo('vr_upper', () => new THREE.CapsuleGeometry(0.11, 0.38, 6, 10)), armor, [0, -0.28, 0]);
        const el = pivot(sh, [0, -0.55, 0]);
        arms.push({ sh, el });
    }
    // the golden arm cannon (right) and the claw (left)
    const can = pivot(arms[1].el, [0, 0, 0]);
    can.rotation.x = -Math.PI / 2;            // built along -z, pointing down the arm
    add(can, geo('vr_cannon', () => new THREE.CylinderGeometry(0.17, 0.2, 0.75, 18).rotateX(Math.PI / 2)), gold, [0, 0, -0.32]);
    add(can, geo('vr_muzzle', () => new THREE.TorusGeometry(0.15, 0.04, 8, 18)), gold, [0, 0, -0.72]);
    add(can, geo('vr_bore', () => new THREE.CircleGeometry(0.12, 16)), glowMat(0xff8020, 3), [0, 0, -0.705], [0, Math.PI, 0]);
    for (let k = 0; k < 3; k++) add(can, geo('vr_vent', () => new THREE.TorusGeometry(0.2, 0.02, 6, 18)), armor, [0, 0, -0.15 - k * 0.12]);
    add(arms[0].el, geo('vr_fore', () => new THREE.CapsuleGeometry(0.1, 0.34, 6, 10)), armor, [0, -0.2, 0]);
    for (let k = 0; k < 3; k++) add(arms[0].el, geo('vr_claw', () => tube([[0, 0, 0], [0, -0.12, -0.05], [0, -0.22, 0.03]], 0.025, 8, 5)), gold, [(k - 1) * 0.06, -0.4, 0]);
    arms[1].sh.rotation.x = 1.4;
    // jetpack and cape
    const pack = pivot(torso, [0, 0.62, 0.32]);
    add(pack, geo('vr_pack', () => new THREE.BoxGeometry(0.5, 0.55, 0.25)), armor);
    const flames = [];
    for (const s of [-1, 1]) {
        add(pack, geo('vr_nozzle', () => new THREE.CylinderGeometry(0.08, 0.11, 0.18, 12)), gold, [0.15 * s, -0.36, 0]);
        flames.push(add(pack, geo('vr_flame', () => new THREE.ConeGeometry(0.1, 0.7, 10).rotateX(Math.PI)), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [0.15 * s, -0.8, 0]));
    }
    const capeP = pivot(torso, [0, 0.95, 0.3]);
    const capeMesh = add(capeP, geo('vr_cape', () => { const g = new THREE.PlaneGeometry(0.9, 1.6, 6, 10); g.translate(0, -0.8, 0); return g; }), cape);
    capeMesh.material.side = THREE.DoubleSide;
    return { root, body, torso, head, legs, arms, flames, cape: capeMesh, capeP, height: 3.0 };
}

// ==================================================================== Rourke, fused to the brain
function rourke(U) {
    const root = new THREE.Group();
    const brainMat = mat(U, 0xd47aa0, { rough: 0.3, emissive: 0x40102a, key: 'actor' });
    const skin = mat(U, 0xc89a80, { rough: 0.55 });
    const uniform = mat(U, 0x3a4a2a, { rough: 0.7 });
    const metal = mat(U, 0x2a2a34, { metal: 0.9, rough: 0.25 });
    const body = pivot(root, [0, 0, 0]);
    const brain = pivot(body, [0, 3.0, 0]);
    add(brain, geo('rk_brain', () => blob(2.1, 28, 0.12, 8, 3, 11)), brainMat, [0, 0, 0], [0, 0, 0], [1.1, 0.85, 1.2]);
    // Dell Rourke's upper body growing out of the front, arms spread
    const man = pivot(body, [0, 0.35, -2.55]);
    man.scale.setScalar(2.1);
    add(man, geo('rk_chest', () => new THREE.LatheGeometry([V(0, -0.5), V(0.3, -0.45), V(0.4, -0.1), V(0.45, 0.3), V(0.3, 0.5), V(0, 0.52)], 20).scale(1, 1, 0.7)), uniform);
    const headP = pivot(man, [0, 0.72, 0]);
    add(headP, geo('rk_head', () => new THREE.SphereGeometry(0.22, 24, 16).scale(0.9, 1.1, 1)), skin);
    add(headP, geo('rk_hair', () => new THREE.SphereGeometry(0.23, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)), metal, [0, 0.04, 0.02]);
    for (const s of [-1, 1]) add(headP, geo('rk_eye', () => new THREE.SphereGeometry(0.03, 10, 8)), glowMat(0xff40ff, 4), [0.08 * s, 0.05, -0.2]);
    add(headP, geo('rk_mouth', () => new THREE.BoxGeometry(0.1, 0.02, 0.02)), metal, [0, -0.1, -0.2]);
    // dog tags
    add(man, geo('rk_tags', () => new THREE.BoxGeometry(0.06, 0.09, 0.01)), mat(U, 0xd0d4dc, { metal: 1, rough: 0.2, env: 1.5 }), [0, 0.15, -0.33]);
    const arms = [];
    for (const s of [-1, 1]) {
        const sh = pivot(man, [0.45 * s, 0.35, 0]);
        add(sh, geo('rk_arm', () => tube([[0, 0, 0], [0.4, 0.1, -0.1], [0.75, 0.3, -0.1], [0.95, 0.55, 0.1]], 0.08, 16, 8)), uniform, [0, 0, 0], [0, 0, 0], [s, 1, 1]);
        add(sh, geo('rk_hand', () => new THREE.SphereGeometry(0.1, 12, 10)), skin, [0.95 * s, 0.55, 0.1]);
        arms.push(sh);
    }
    // cables and tentacles hanging from the brain
    const cables = [];
    for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const c = pivot(brain, [Math.cos(a) * 1.4, -1.2, Math.sin(a) * 1.4]);
        const len = 1.8 + (k % 3) * 0.6;
        add(c, geo('rk_cable' + (k % 3), () => tube([[0, 0, 0], [0.1, -len * 0.3, 0.05], [-0.1, -len * 0.65, -0.05], [0.05, -len, 0]], 0.07 - (k % 3) * 0.012, 18, 6)), k % 2 ? metal : brainMat);
        cables.push(c);
    }
    // halo of light
    const halo = add(body, geo('rk_halo', () => new THREE.TorusGeometry(2.7, 0.06, 8, 64).rotateX(Math.PI / 2)), glowMat(0xff3ccf, 3), [0, 3.4, 0]);
    // the shield bubble (shown during the pylon phase)
    const shield = add(body, geo('rk_shield', () => new THREE.IcosahedronGeometry(3.4, 3)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.3, 1.6), transparent: true, opacity: 0.25, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [0, 2.7, 0]);
    shield.visible = false;
    return { root, body, brain, man, headP, arms, cables, halo, shield, height: 5 };
}

function pylon(U) {
    const root = new THREE.Group();
    const base = mat(U, 0x22202c, { metal: 0.8, rough: 0.3 });
    add(root, geo('py_base', () => new THREE.CylinderGeometry(0.75, 0.9, 0.5, 8)), base, [0, 0.25, 0]);
    const crystal = add(root, geo('py_crystal', () => new THREE.OctahedronGeometry(0.55, 0).scale(1, 2.6, 1)), new THREE.MeshStandardMaterial({ color: 0x8a40ff, emissive: new THREE.Color(0.6, 0.15, 1.2), roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }), [0, 1.9, 0]);
    for (let k = 0; k < 3; k++) add(root, geo('py_ring', () => new THREE.TorusGeometry(0.8, 0.03, 6, 32).rotateX(Math.PI / 2)), glowMat(0xc080ff, 2.5), [0, 1.2 + k * 0.6, 0]);
    return { root, crystal, height: 3.2 };
}

const BUILD = { trooper, chomper: (U) => chomper(U, 1), drone, brute, psy, tank, chompra, vrask, rourke, pylon };
const TINT = { trooper: 0x40e0ff, chomper: 0xb0ff40, drone: 0xff4040, brute: 0xff8040, psy: 0xc060ff, tank: 0x60ff90, chompra: 0xd0ff40, vrask: 0xffc030, rourke: 0xff40e0, pylon: 0xa060ff };

export function buildModel(type) {
    const U = actorUniforms(TINT[type] || 0x6a5aff);
    const m = BUILD[type](U);
    m.U = U;
    m.type = type;
    m.phase = Math.random() * 6;
    m.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.actor = true; } });
    return m;
}

// ==================================================================== animation

const lerp = (a, b, k) => a + (b - a) * k;

/** Pose a model from its sim enemy. */
export function animate(m, e, dt, t) {
    const U = m.U;
    m.root.position.set(e.x, e.y, e.z);
    if (e.boss !== 'rourke' && !e.pylon) m.root.rotation.y = -e.yaw;
    const sp = Math.hypot(e.vx, e.vz);
    const frozen = e.frozen > 0;
    if (!frozen) m.phase += dt * (2 + sp * 1.3);
    const ph = m.phase;
    U.uFrozen.value = lerp(U.uFrozen.value, frozen ? 1 : 0, Math.min(1, dt * 8));
    U.uBurn.value = lerp(U.uBurn.value, e.burn > 0 || e.acidT > 0 ? 1 : 0, Math.min(1, dt * 6));
    U.uGlow.value = lerp(U.uGlow.value, e.windupT > 0 || (e.patT !== undefined && e.pat !== 'stalk' && e.pat !== 'strafe' && e.pat !== 'intro' && e.patT > 0 && e.pat !== 'air') ? 1 : 0, Math.min(1, dt * 12));
    U.uHit.value = Math.max(0, U.uHit.value - dt * 7);
    if (frozen) return;
    const walk = Math.min(1, sp / 4);
    const swing = Math.sin(ph) * 0.6 * walk;
    switch (m.type) {
        case 'trooper': {
            m.legs[0].hip.rotation.x = swing; m.legs[1].hip.rotation.x = -swing;
            m.legs[0].knee.rotation.x = Math.max(0, -swing) * 0.8; m.legs[1].knee.rotation.x = Math.max(0, swing) * 0.8;
            m.body.position.y = 1.0 + Math.abs(Math.sin(ph)) * 0.05 * walk;
            m.arms[0].sh.rotation.x = 0.2 - swing * 0.5;
            m.mouth.scale.y = 1 + (e.windupT > 0 ? 0.4 : 0) + Math.sin(t * 5) * 0.05;
            m.head.rotation.y = Math.sin(t * 0.7 + ph * 0.1) * 0.2;
            m.gun.position.z = -0.18 + (e.burstN > 0 ? Math.max(0, Math.sin(t * 50)) * 0.06 : 0);
            break;
        }
        case 'chomper': case 'chompra': {
            const open = e.state === 'leap' || e.pat === 'air' ? 0.95 : e.windupT > 0 || (e.pat && e.pat !== 'stalk' && e.pat !== 'intro') ? 0.7 : 0.32 + 0.25 * Math.max(0, Math.sin(t * 7 + ph));
            m.upper.rotation.x = lerp(m.upper.rotation.x, open, Math.min(1, dt * 14));
            m.lower.rotation.x = lerp(m.lower.rotation.x, -open * 0.35, Math.min(1, dt * 14));
            m.legs.forEach((l, k) => { l.hip.rotation.x = Math.sin(ph * 1.6 + k * Math.PI * 0.5) * 0.7 * walk; });
            m.body.position.y = 0.42 + Math.abs(Math.sin(ph * 1.6)) * 0.08 * walk;
            m.stalk.rotation.z = Math.sin(t * 2 + ph) * 0.3;
            break;
        }
        case 'drone': {
            m.body.rotation.x = lerp(m.body.rotation.x, -Math.max(-0.4, Math.min(0.4, sp * 0.05)), Math.min(1, dt * 4));
            m.body.rotation.z = Math.sin(t * 1.3 + ph) * 0.08;
            m.jaw.rotation.x = e.windupT > 0 || e.burstN > 0 ? 0.5 : Math.max(0, Math.sin(t * 3)) * 0.12;
            for (const f of m.jets) f.scale.set(1, 0.7 + Math.random() * 0.5, 1);
            break;
        }
        case 'brute': {
            const charge = e.state === 'charge';
            const s2 = charge ? Math.sin(ph * 2) * 0.9 : swing;
            m.legs[0].hip.rotation.x = s2; m.legs[1].hip.rotation.x = -s2;
            m.legs[0].knee.rotation.x = Math.max(0, -s2); m.legs[1].knee.rotation.x = Math.max(0, s2);
            m.torso.rotation.x = lerp(m.torso.rotation.x, charge ? 0.45 : e.windupT > 0 ? -0.25 : 0.05, Math.min(1, dt * 6));
            m.arms[0].sh.rotation.x = charge ? -0.6 : -s2 * 0.6 + (e.windupT > 0 ? 2.0 : 0.15);
            m.arms[1].sh.rotation.x = charge ? -0.6 : s2 * 0.6 + (e.windupT > 0 ? 2.0 : 0.15);
            m.body.position.y = 1.15 + Math.abs(Math.sin(ph)) * 0.1 * walk;
            break;
        }
        case 'psy': {
            m.legs.forEach((l, k) => { l.hip.rotation.z = Math.sin(ph * 1.2 + k * 2.1) * 0.25 * walk; });
            m.body.position.y = 1.6 + Math.sin(t * 1.5 + ph) * 0.06;
            m.brain.scale.setScalar(1 + Math.sin(t * 4) * 0.03 + (e.windupT > 0 ? 0.12 : 0));
            m.feelers.forEach((f, k) => { f.rotation.x = Math.sin(t * 2 + k) * 0.3; f.rotation.z = Math.cos(t * 1.7 + k) * 0.3; });
            break;
        }
        case 'tank': {
            for (const w of m.wheels) w.rotation.x -= sp * dt * 4;
            m.tentacles.forEach((tt, k) => tt.segs.forEach((s, j) => {
                s.rotation.z = Math.sin(t * 2 + k * 1.3 + j * 0.8) * 0.35;
                s.rotation.x = Math.cos(t * 1.6 + k + j * 0.6) * 0.3 + (j === 0 ? 0.6 : 0);
            }));
            m.turret.rotation.y = Math.sin(t * 0.5) * 0.2;
            break;
        }
        case 'vrask': {
            const air = e.pat === 'air';
            m.legs[0].hip.rotation.x = air ? -0.6 : swing; m.legs[1].hip.rotation.x = air ? 0.3 : -swing;
            m.legs[0].knee.rotation.x = air ? 0.9 : Math.max(0, -swing); m.legs[1].knee.rotation.x = air ? 0.4 : Math.max(0, swing);
            for (const f of m.flames) { f.visible = air || e.pat === 'hop'; f.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
            m.capeP.rotation.x = 0.15 + walk * 0.4 + (air ? 0.8 : 0) + Math.sin(t * 3) * 0.05;
            m.arms[1].sh.rotation.x = 1.4 + (e.burstN > 0 ? Math.sin(t * 40) * 0.05 : 0);
            m.arms[0].sh.rotation.x = e.pat === 'pound' ? 2.8 : -swing * 0.5;
            m.torso.rotation.x = e.pat === 'barrage' ? -0.3 : 0;
            break;
        }
        case 'rourke': {
            m.root.rotation.y = -e.yaw;
            m.root.position.y = e.y - 1.0;
            m.brain.scale.set(1 + Math.sin(t * 2.2) * 0.03, 1 + Math.sin(t * 2.2 + 1) * 0.03, 1);
            m.halo.rotation.z = Math.sin(t * 0.7) * 0.15;
            m.halo.rotation.x = Math.cos(t * 0.5) * 0.15;
            m.cables.forEach((c, k) => { c.rotation.x = Math.sin(t * 1.3 + k) * 0.25; c.rotation.z = Math.cos(t * 1.1 + k * 0.7) * 0.25; });
            m.arms.forEach((a, k) => { a.rotation.z = Math.sin(t * 1.5 + k * 3) * 0.2; });
            m.headP.rotation.y = Math.sin(t * 0.9) * 0.3;
            m.shield.visible = !!e.invuln;
            m.shield.rotation.y = t * 0.5;
            break;
        }
        case 'pylon': {
            m.crystal.rotation.y = t * 1.5;
            m.crystal.position.y = 1.9 + Math.sin(t * 2) * 0.1;
            break;
        }
    }
}

/** A short topple for a death without gibs, then the caller dissolves it. */
export function animateDeath(m, k) {
    m.root.rotation.x = -Math.min(1, k * 2.5) * Math.PI / 2 * 0.95;
    m.root.position.y -= 0.002;
    m.U.uDissolve.value = Math.max(0, (k - 0.35) / 0.65);
}

export const MODEL_TYPES = Object.keys(BUILD);
