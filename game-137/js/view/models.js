// The cel-shaded voxel model kit. Everything is built from boxes in code: the mech, the four
// Cubeborn, the three kaiju, hives and cages. Each model is merged geometry with vertex colours,
// plus a matching "inverted hull" outline geometry (each box grown about its own centre) drawn
// back-faced in black: the bold ink line of a 1990s anime cel.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ materials
let gradient = null;
/** A three-step ramp: lit, shade, deep shade. Hard edges, like painted cels. */
export function toonGradient() {
    if (gradient) return gradient;
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
    return gradient;
}
export const toon = (opts = {}) => new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...opts });
export const INK = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide });

// ------------------------------------------------------------------ the box kit
const unit = new THREE.BoxGeometry(1, 1, 1);
const col = new THREE.Color();

/**
 * Merge boxes into one geometry with vertex colours, and its outline twin.
 * parts: [x, y, z, sx, sy, sz, colour] in model units (y is up).
 */
export function boxModel(parts, ink = 0.07) {
    const geos = [], outs = [];
    for (const [x, y, z, sx, sy, sz, c, ry = 0] of parts) {
        const g = unit.clone();
        g.scale(sx, sy, sz);
        if (ry) g.rotateY(ry);
        g.translate(x, y, z);
        col.set(c);
        const n = g.attributes.position.count, cols = new Float32Array(n * 3);
        // a little top light baked in: upward faces a touch brighter
        const nor = g.attributes.normal;
        for (let i = 0; i < n; i++) {
            const k = nor.getY(i) > 0.5 ? 1.08 : 1;
            cols[i * 3] = col.r * k; cols[i * 3 + 1] = col.g * k; cols[i * 3 + 2] = col.b * k;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        geos.push(g);
        const o = unit.clone();
        o.scale(sx + ink * 2, sy + ink * 2, sz + ink * 2);
        if (ry) o.rotateY(ry);
        o.translate(x, y, z);
        outs.push(o);
    }
    return { geo: mergeGeometries(geos), ink: mergeGeometries(outs) };
}

/** A mesh with its ink outline as a child. */
export function inked(model, mat) {
    const m = new THREE.Mesh(model.geo, mat || toon({ vertexColors: true }));
    const o = new THREE.Mesh(model.ink, INK);
    m.add(o);
    return m;
}

// ------------------------------------------------------------------ palette
export const PAL = {
    orange: 0xff7a1a, orange2: 0xd85a10, char: 0x3a3d4a, char2: 0x262833, teal: 0x2ff0d0, white: 0xf2efe6,
    red: 0xff3b5c, blue: 0x3ba8ff, green: 0x3bff8a, gold: 0xffd23b,
    stone: 0x8b8fa8, crystal: 0x7de8ff, rust: 0xc0623a, neon: 0x7a6cff, hive: 0xd23bff, edge: 0x2a2440,
};
export const VOXEL_COLORS = ['red', 'blue', 'green', 'gold', 'stone', 'crystal', 'rust', 'neon', 'hive'].map((k) => new THREE.Color(PAL[k]));

// ------------------------------------------------------------------ the mech: Shardframe Unit-07
// Sunset-orange and charcoal, a dome head with one teal visor slit, backward-bending bird legs.
// Built as a hierarchy so the legs walk, the torso turns to aim and the weapons follow the loadout.
export function buildMech(loadout) {
    const O = PAL.orange, O2 = PAL.orange2, K = PAL.char, K2 = PAL.char2, T = PAL.teal;
    const root = new THREE.Group();
    const hips = new THREE.Group(); hips.position.y = 1.15; root.add(hips);
    hips.add(inked(boxModel([[0, 0, 0, 0.9, 0.3, 0.6, K]])));
    const legs = [];
    for (const s of [-1, 1]) {
        const hip = new THREE.Group(); hip.position.set(0.38 * s, -0.05, 0); hips.add(hip);
        hip.add(inked(boxModel([[0, -0.3, 0.08, 0.32, 0.65, 0.4, O], [0, -0.05, 0, 0.36, 0.25, 0.44, K]])));
        const knee = new THREE.Group(); knee.position.set(0, -0.6, 0.18); hip.add(knee);
        // the shin slopes back: a bird's reversed knee
        knee.add(inked(boxModel([[0, -0.25, -0.12, 0.26, 0.6, 0.26, K], [0, -0.05, -0.02, 0.3, 0.18, 0.3, T]])));
        const foot = new THREE.Group(); foot.position.set(0, -0.52, -0.22); knee.add(foot);
        foot.add(inked(boxModel([[0, -0.03, 0.12, 0.38, 0.14, 0.6, O2], [0, 0.04, -0.12, 0.2, 0.12, 0.2, K2]])));
        legs.push({ hip, knee, foot, s });
    }
    const torso = new THREE.Group(); torso.position.y = 0.2; hips.add(torso);
    torso.add(inked(boxModel([
        [0, 0.45, 0, 1.15, 0.75, 0.8, O], [0, 0.45, 0.41, 0.5, 0.35, 0.05, T], [0, 0.1, 0, 0.9, 0.2, 0.7, K],
        [0, 0.87, -0.05, 0.6, 0.12, 0.55, K],
    ])));
    // dome head with one visor slit
    const head = new THREE.Group(); head.position.set(0, 1.05, 0.05); torso.add(head);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: O }));
    const domeInk = new THREE.Mesh(new THREE.SphereGeometry(0.37, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), INK);
    dome.add(domeInk);
    head.add(dome);
    head.add(inked(boxModel([[0, 0.02, 0, 0.66, 0.1, 0.66, K]])));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.06), new THREE.MeshBasicMaterial({ color: T }));
    visor.position.set(0, 0.16, 0.29); head.add(visor);

    const arms = {};
    for (const [slot, s] of [['armL', -1], ['armR', 1]]) {
        const sh = new THREE.Group(); sh.position.set(0.72 * s, 0.62, 0); torso.add(sh);
        sh.add(inked(boxModel([[0.05 * s, 0.05, 0, 0.36, 0.36, 0.42, K], [0.06 * s, -0.3, 0.05, 0.26, 0.5, 0.3, O]])));
        const w = weaponModel(loadout[slot]);
        if (w) { w.position.set(0.06 * s, -0.55, 0.25); sh.add(w); }
        arms[slot] = sh;
    }
    // shoulder pod on the right
    const pod = shoulderModel(loadout.shoulder);
    if (pod) { pod.position.set(0.42, 1.0, -0.2); torso.add(pod); }
    // core glow
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: loadout.core === 'barrier' ? 0x58b8ff : loadout.core === 'reactor' ? 0xff5030 : T }));
    core.position.set(0, 0.45, 0.44); torso.add(core);
    // stomper legs get heavy plates
    if (loadout.legs === 'stomper') for (const L of legs) L.foot.add(inked(boxModel([[0, 0.02, 0.1, 0.5, 0.1, 0.72, K]])));
    if (loadout.legs === 'sprinter') for (const L of legs) L.knee.add(inked(boxModel([[0, -0.2, -0.32, 0.12, 0.4, 0.14, T]])));
    root.userData = { hips, legs, torso, head, arms, visor, core };
    return root;
}

function weaponModel(id) {
    const K = PAL.char, K2 = PAL.char2, T = PAL.teal, O = PAL.orange;
    if (id === 'vulcan') {
        const g = new THREE.Group();
        g.add(inked(boxModel([[0, 0, 0, 0.3, 0.3, 0.4, K], [0, 0, 0.35, 0.22, 0.22, 0.4, K2]])));
        const barrels = new THREE.Group(); barrels.position.z = 0.6;
        for (let k = 0; k < 4; k++) {
            const a = k / 4 * Math.PI * 2;
            barrels.add(inked(boxModel([[Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.1, 0.06, 0.06, 0.45, 0x555a66]], 0.03)));
        }
        g.add(barrels);
        g.userData.spin = barrels;
        return g;
    }
    if (id === 'scatter') return inked(boxModel([[0, 0, 0.1, 0.42, 0.3, 0.55, K], [0, 0, 0.45, 0.5, 0.18, 0.18, O], [0, 0.18, 0, 0.2, 0.1, 0.3, K2]]));
    if (id === 'laser') return inked(boxModel([[0, 0, 0.1, 0.24, 0.24, 0.5, K], [0, 0, 0.55, 0.1, 0.1, 0.65, 0xdde6ff], [0, 0, 0.88, 0.16, 0.16, 0.08, T]]));
    return null;
}

function shoulderModel(id) {
    const K = PAL.char, O = PAL.orange, T = PAL.teal;
    if (id === 'rockets') {
        const parts = [[0, 0, 0, 0.5, 0.42, 0.55, K], [0, 0, 0.28, 0.46, 0.38, 0.04, O]];
        for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) parts.push([(x - 1) * 0.13, (y - 0.5) * 0.16, 0.31, 0.08, 0.08, 0.03, 0x222222]);
        return inked(boxModel(parts));
    }
    if (id === 'mortar') return inked(boxModel([[0, 0, 0, 0.4, 0.3, 0.45, K], [0, 0.3, 0.1, 0.22, 0.5, 0.22, 0x6b6f80], [0, 0.56, 0.1, 0.26, 0.06, 0.26, T]]));
    if (id === 'drone') return inked(boxModel([[0, 0, 0, 0.44, 0.24, 0.44, K], [0, 0.16, 0, 0.3, 0.08, 0.3, O]]));
    return null;
}

/** Pose the mech: walking phase, facing, aim, and an Overdrive glow. */
export function poseMech(m, { t, walk, face, aim, od, hurt, crouch = 0 }) {
    const U = m.userData;
    m.rotation.y = -face + Math.PI / 2;
    const ph = walk * 9;
    const amp = Math.min(1, walk ? 1 : 0);
    U.hips.position.y = 1.15 - crouch * 0.25 + Math.abs(Math.sin(ph)) * 0.06 * amp;
    for (const L of U.legs) {
        const p = ph + (L.s > 0 ? Math.PI : 0);
        L.hip.rotation.x = Math.sin(p) * 0.6 * amp - crouch * 0.4;
        L.knee.rotation.x = (Math.max(0, -Math.cos(p)) * 0.7) * amp + crouch * 0.7;
        L.foot.rotation.x = -Math.sin(p) * 0.3 * amp - crouch * 0.3;
    }
    // the torso turns towards the aim, within reason
    let d = (-aim + Math.PI / 2) - m.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    U.torso.rotation.y = Math.max(-1.3, Math.min(1.3, d));
    U.torso.rotation.z = Math.sin(ph) * 0.03 * amp;
    for (const k of ['armL', 'armR']) {
        const a = U.arms[k];
        a.rotation.x = -1.35;                 // guns forward
        const sp = a.children.find((c) => c.userData && c.userData.spin);
        if (sp) sp.userData.spin.rotation.z = t * 30;
    }
    U.visor.material.color.setHex(od ? 0xff3060 : hurt ? 0xffffff : PAL.teal);
}

// ------------------------------------------------------------------ the Cubeborn
// Little voxel sculptures. Each faces +z; the view turns them to their heading.
export function enemyModel(kind, color) {
    const c = color, d = new THREE.Color(color).multiplyScalar(0.6).getHex(), w = 0xffffff, k = 0x1a1020;
    if (kind === 'mite') return boxModel([
        [0, 0.32, 0, 0.5, 0.4, 0.55, c], [0, 0.42, 0.28, 0.3, 0.2, 0.08, d],
        [-0.12, 0.45, 0.31, 0.08, 0.08, 0.04, w], [0.12, 0.45, 0.31, 0.08, 0.08, 0.04, w],
        [-0.25, 0.1, 0.15, 0.1, 0.2, 0.1, d], [0.25, 0.1, 0.15, 0.1, 0.2, 0.1, d], [-0.25, 0.1, -0.15, 0.1, 0.2, 0.1, d], [0.25, 0.1, -0.15, 0.1, 0.2, 0.1, d],
    ]);
    if (kind === 'brute') return boxModel([
        [0, 0.9, 0, 1.3, 0.95, 1.0, c], [0, 0.55, 0, 1.0, 0.3, 0.8, d], [0, 1.45, 0.1, 0.7, 0.3, 0.6, d],
        [-0.85, 0.75, 0.2, 0.4, 0.9, 0.45, c], [0.85, 0.75, 0.2, 0.4, 0.9, 0.45, c],
        [-0.35, 0.2, 0, 0.35, 0.45, 0.4, d], [0.35, 0.2, 0, 0.35, 0.45, 0.4, d],
        [-0.22, 1.05, 0.52, 0.15, 0.12, 0.04, 0xffe060], [0.22, 1.05, 0.52, 0.15, 0.12, 0.04, 0xffe060],
    ]);
    if (kind === 'spitter') return boxModel([
        [0, 0.55, 0, 0.6, 0.7, 0.6, c], [0, 0.95, 0.15, 0.4, 0.3, 0.5, d], [0, 0.95, 0.45, 0.24, 0.24, 0.2, k],
        [0, 1.25, -0.1, 0.12, 0.3, 0.12, w],
        [-0.25, 0.12, 0, 0.12, 0.25, 0.12, d], [0.25, 0.12, 0, 0.12, 0.25, 0.12, d], [0, 0.12, -0.25, 0.12, 0.25, 0.12, d],
    ]);
    if (kind === 'boomer') return boxModel([
        [0, 0.5, 0, 0.75, 0.75, 0.75, c], [0, 0.5, 0, 0.82, 0.25, 0.82, d], [0, 0.95, 0, 0.2, 0.2, 0.2, 0xff3020],
        [-0.15, 0.6, 0.38, 0.1, 0.1, 0.04, w], [0.15, 0.6, 0.38, 0.1, 0.1, 0.04, w],
        [-0.22, 0.08, 0, 0.14, 0.18, 0.14, d], [0.22, 0.08, 0, 0.14, 0.18, 0.14, d],
    ]);
    return boxModel([[0, 0.4, 0, 0.6, 0.6, 0.6, c]]);
}

/** A kaiju: a blob of cubes with legs, spines and glowing seams, made from a seed so it's always the same. */
export function bossModel(kind, color) {
    let seed = [...kind].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const c = new THREE.Color(color), dark = c.clone().multiplyScalar(0.55).getHex(), glow = c.clone().lerp(new THREE.Color(0xffffff), 0.5).getHex();
    const parts = [];
    // body: a squashed ellipsoid of cubes
    for (let y = 0; y < 4; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
        const r = (x * x) / 6 + ((y - 1.5) ** 2) / 3 + (z * z) / 6;
        if (r > 1.25) continue;
        parts.push([x * 0.55, 1.2 + y * 0.5, z * 0.55, 0.55, 0.5, 0.55, rnd() < 0.18 ? glow : rnd() < 0.5 ? color : dark]);
    }
    // head
    for (let y = 0; y < 2; y++) for (let x = -1; x <= 1; x++) parts.push([x * 0.45, 2.4 + y * 0.45, 1.5, 0.45, 0.45, 0.6, y ? color : dark]);
    parts.push([-0.35, 2.55, 1.85, 0.2, 0.12, 0.05, 0xffffff], [0.35, 2.55, 1.85, 0.2, 0.12, 0.05, 0xffffff]);
    // spines
    for (let k = 0; k < 5; k++) parts.push([0, 3.2 + (k % 2) * 0.15, -1 + k * 0.5, 0.25, 0.5 + rnd() * 0.5, 0.25, glow]);
    if (kind === 'queen') for (const s of [-1, 1]) parts.push([s * 1.2, 3.4, 0.8, 0.3, 1.2, 0.3, glow], [s * 1.5, 4.0, 0.6, 0.25, 0.6, 0.25, glow]);
    if (kind === 'centipede') for (let k = 0; k < 4; k++) parts.push([0, 0.9, -1.6 - k * 0.55, 1.6 - k * 0.25, 0.7, 0.5, k % 2 ? color : dark]);
    // legs
    for (const [x, z] of [[-1.1, 0.8], [1.1, 0.8], [-1.1, -0.8], [1.1, -0.8]]) parts.push([x, 0.5, z, 0.5, 1.0, 0.5, dark], [x * 1.1, 0.1, z + 0.15, 0.6, 0.2, 0.75, dark]);
    return boxModel(parts, 0.06);
}

// ------------------------------------------------------------------ hives, cages
export function hiveSpire() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), toon({ color: PAL.hive, emissive: 0x60107a }));
    m.scale.set(1, 1.6, 1);
    m.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.98, 0), INK));
    m.position.y = 3.3;
    g.add(m);
    g.userData.crystal = m;
    return g;
}

export function cageModel() {
    const g = new THREE.Group();
    const bars = [];
    for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        bars.push([Math.cos(a) * 0.8, 1.0, Math.sin(a) * 0.8, 0.1, 2.0, 0.1, 0x4a3a66]);
    }
    bars.push([0, 0.05, 0, 1.9, 0.1, 1.9, 0x2a2440], [0, 2.05, 0, 1.9, 0.12, 1.9, PAL.hive]);
    const cage = inked(boxModel(bars));
    g.add(cage);
    // the prisoner: a little waving figure
    const person = inked(boxModel([[0, 0.45, 0, 0.32, 0.5, 0.22, 0x3a6fd8], [0, 0.85, 0, 0.26, 0.26, 0.26, 0xffd8b0], [0, 1.0, 0, 0.3, 0.08, 0.3, 0x3a2a1a], [0.25, 0.75, 0, 0.1, 0.4, 0.1, 0x3a6fd8]]));
    g.add(person);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.2, 40), new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    g.add(ring);
    const prog = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.0, 40, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    prog.rotation.x = -Math.PI / 2; prog.position.y = 0.06;
    g.add(prog);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, opacity: 0.18, depthWrite: false }));
    beacon.position.y = 7;
    g.add(beacon);
    g.userData = { person, ring, prog, beacon, cage };
    return g;
}
