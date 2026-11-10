// The Foundry's assembly lines. Each line is a rail of hooks that moves in
// steps: the hooks all slide one station along (MOVE seconds), then stop while
// every station does its job (DWELL). A unit starts as a bare cranium on a hook
// at station 0 and is given its face, eyes, ears and antenna (the head shop),
// its chest, pelvis, core, plates and backpack (the body shop), shoulders, arms
// and hands (the arm line) and hips, knees, shins, feet and armour (the leg
// line); it is scanned, flexed, shocked and painted, set down on its feet and
// let go. Then it stands up, looks about, turns, and sets off for the way out in
// the far wall: the three lines' units cross the apron in their own lanes and
// file on to one walkway over the lava pit, timed to interleave, and the
// quartermaster beside it hands each a laser rifle. Just short of the exit a
// stretch of the walkway rusted through and fell into the pit long ago, and
// nobody mended it. Each unit steps into the gap.
//
// Nothing here is stored per robot: everything a unit is and does is worked
// out from the line's clock and the unit's serial number, every frame. The
// unit at station k is serial n = cycle - k. That makes the whole hall exactly
// repeatable (handy for the tests) and lets the parts go straight into
// instanced meshes: one mesh per kind of part for every robot in the hall.

import * as THREE from 'three';
import {
    robotGeometries, MESHES, PARTS, PART, PART_OFFSET, B, newBones, bones, newPose, copyPose, mixPose, hangPose, walkPose, plant,
    CROUCH, STAND, SCALE, HEAD_TOP, STRIDE, PRIMER, paintOf, rifleGeometries, sargeGeometries,
} from './foundry-robot.js';
import { clamp, lerp, smoothstep, angleDiff, TAU } from './util.js';

export const PITCH = 7, LAST = 26;
export const MOVE = 1.6, DWELL = 4.4, CYCLE = MOVE + DWELL;
export const ATTACH_U = 0.55, RELEASE_U = 0.3;
export const Z0 = 6, RAIL_Y = 7.4;
export const LEDGE_Z = -200, LAVA_Y = -14, FAR_Z = -252;
// the one walkway over the pit to the exit, and the stretch of it that broke away just short of the door
export const HOLE_Z0 = -244.5, HOLE_Z1 = -249.5, GANGWAY_END = FAR_Z + 0.5;
export const LINE_HALF = 4.6;           // half the width of each line's fenced strip
export const STRIP_END = -182;          // where the fenced strips stop and the open apron begins
export const WALK_V = 1.05;
export const slotZ = (k) => Z0 - PITCH * k;
export const RELEASE_Z = slotZ(LAST);
// let go, a unit is carried off the release plate on a short belt while it wakes, so the next can come down behind it
export const CARRY = 4, T_CARRY = 2.2, WAKE_Z = RELEASE_Z - CARRY;
export const STEP_Z = HOLE_Z0 - 0.35;
// the lines' paths meet here and go on as one walkway; the quartermaster stands beside it
export const MERGE = { x: 0, z: -195 };
export const HAND_Z = -236;
export const SARGE = { x: 2.95, z: HAND_Z };
export const SERIAL0 = 14000;
// after the release: slump, boot, stand, look about, turn, walk
export const T_SLUMP = 0.7, T_BOOT = 1.9, T_STAND = 3.6, T_LOOK = 4.6, T_TURN = 5.6;
const GRAV = 9.8;
export const T_FALL = Math.sqrt((2 * -LAVA_Y) / GRAV);
export const T_BURN = 6;
const REL_AT = LAST * CYCLE + MOVE + RELEASE_U * DWELL;   // a unit's release, after it reached station 0
const SPACING = CYCLE / 3;                               // seconds between units on the shared walkway

/**
 * The three lines. Robots face `face` along x: the main line and the one beyond the walkway face it.
 * Each line's units walk their own path across the apron to MERGE, then down the walkway; the lines'
 * clocks are offset so the units arrive at MERGE exactly SPACING apart and file on to it in turn.
 */
export const LINES = [
    { id: 0, x: 0, face: 1, path: [[0, WAKE_Z], [MERGE.x, MERGE.z]] },
    { id: 1, x: 38, face: -1, path: [[38, WAKE_Z], [36.5, -185], [7, -189.5], [MERGE.x, MERGE.z]] },
    { id: 2, x: -34, face: 1, path: [[-34, WAKE_Z], [-32.5, -185], [-7, -189.5], [MERGE.x, MERGE.z]] },
];
for (const l of LINES) {
    l.path.push([MERGE.x, STEP_Z]);
    l.seg = [];
    let d = 0;
    for (let i = 1; i < l.path.length; i++) {
        const [ax, az] = l.path[i - 1], [bx, bz] = l.path[i];
        const len = Math.hypot(bx - ax, bz - az);
        l.seg.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, d0: d, len });
        d += len;
    }
    l.walkLen = d;
    l.mergeAt = l.seg[l.seg.length - 1].d0;
    l.handAt = l.mergeAt + (MERGE.z - HAND_Z);
    l.tWalk = d / WALK_V;
    l.tHit = T_TURN + l.tWalk + T_FALL;
    l.life = l.tHit + T_BURN;
}
for (const l of LINES) l.phase = ((((l.mergeAt - LINES[0].mergeAt) / WALK_V - l.id * SPACING) % CYCLE) + CYCLE) % CYCLE;
const K_MAX = LAST + Math.ceil((Math.max(...LINES.map((l) => l.life)) + MOVE + RELEASE_U * DWELL) / CYCLE) + 1;

/** Where a unit `d` metres along its line's path is, and which way it faces. */
export function pathAt(line, d, out) {
    const at = (dd) => {
        const sg = line.seg;
        let i = 0;
        while (i < sg.length - 1 && dd > sg[i].d0 + sg[i].len) i++;
        const g = sg[i], u = dd - g.d0;
        return [g.ax + g.dx * u, g.az + g.dz * u];
    };
    const [x, z] = at(d);
    const [x0, z0] = at(Math.max(0, d - 0.9)), [x1, z1] = at(d + 0.9);
    out.x = x;
    out.z = z;
    out.yaw = Math.atan2(x1 - x0, z1 - z0);
    return out;
}

// where a station's arms stand, in the robot's frame (x its left, z its front)
const AT = { front: [0, 2.9], back: [0, -3.0], left: [2.3, -2.4], right: [-2.3, -2.4], fleft: [2.3, 2.4], fright: [-2.3, 2.4] };
const place = (at, ...parts) => ({ kind: 'place', at, parts });
const weld = (at, bone, x, y, z) => ({ kind: 'weld', at, bone, p: [x, y, z] });
const torque = (at, bone, x, y, z) => ({ kind: 'torque', at, bone, p: [x, y, z] });
const probe = (at, bone, x, y, z) => ({ kind: 'probe', at, bone, p: [x, y, z] });

/** What each station does. */
export const STATIONS = [
    { arms: [place('back', 'cranium', 'liftEye')] },
    { arms: [place('front', 'face'), weld('fleft', B.HEAD, 0.24, 0.3, 0.2)] },
    { arms: [place('front', 'eyes'), weld('fright', B.HEAD, -0.22, 0.4, 0.22)] },
    { arms: [place('left', 'earL'), place('right', 'earR')] },
    { arms: [place('back', 'antenna', 'antTip'), weld('front', B.HEAD, 0, 0.5, 0.24)] },
    { special: 'scan', arms: [] },
    { arms: [place('back', 'chest', 'yoke', 'neck'), weld('fleft', B.CHEST, 0.35, 0.95, 0.24), weld('fright', B.CHEST, -0.35, 0.95, 0.24)] },
    { arms: [place('back', 'pelvis', 'abdomen'), weld('front', B.PELVIS, 0, 0.05, 0.24)] },
    { arms: [place('front', 'core', 'coreRing'), weld('left', B.CHEST, 0.5, 0.45, 0)] },
    { arms: [place('front', 'pecs'), weld('left', B.CHEST, 0.5, 0.65, 0.1), weld('right', B.CHEST, -0.5, 0.65, 0.1)] },
    { arms: [place('back', 'pack', 'exhaust'), weld('fleft', B.CHEST, 0.45, 0.85, 0.1)] },
    { arms: [torque('left', B.CHEST, 0.45, 0.25, -0.15), torque('right', B.CHEST, -0.45, 0.25, -0.15), torque('front', B.PELVIS, 0, 0.0, 0.26)] },
    { arms: [place('left', 'shBallL', 'pauldronL'), place('right', 'shBallR', 'pauldronR'), weld('front', B.CHEST, 0, 0.78, 0.3)] },
    { arms: [place('left', 'upperL'), place('right', 'upperR'), weld('fleft', B.SH_L, 0, -0.42, 0.14), weld('fright', B.SH_R, 0, -0.42, 0.14)] },
    { arms: [place('left', 'elbowL', 'foreL'), place('right', 'elbowR', 'foreR')] },
    { arms: [place('left', 'handL'), place('right', 'handR'), weld('fleft', B.EL_L, 0, -0.52, 0.12), weld('fright', B.EL_R, 0, -0.52, 0.12)] },
    { special: 'test', arms: [probe('fleft', B.HA_L, 0, -0.2, 0.1), probe('fright', B.HA_R, 0, -0.2, 0.1)] },
    { special: 'flex', arms: [] },
    { arms: [place('left', 'hipBallL', 'thighL'), place('right', 'hipBallR', 'thighR'), weld('front', B.PELVIS, 0, -0.05, 0.25)] },
    { arms: [place('left', 'kneeL'), place('right', 'kneeR')] },
    { arms: [place('left', 'shinL'), place('right', 'shinR'), weld('fleft', B.KN_L, 0, -0.3, 0.14), weld('fright', B.KN_R, 0, -0.3, 0.14)] },
    { arms: [place('left', 'ankleL', 'footL'), place('right', 'ankleR', 'footR')] },
    { arms: [place('left', 'armorL'), place('right', 'armorR'), weld('fleft', B.KN_L, 0, -0.2, 0.22), weld('fright', B.KN_R, 0, -0.2, 0.22)] },
    { arms: [torque('left', B.AN_L, 0.1, -0.1, 0.1), torque('right', B.AN_R, -0.1, -0.1, 0.1), torque('fleft', B.HIP_L, 0.1, -0.3, 0.12), torque('fright', B.HIP_R, -0.1, -0.3, 0.12)] },
    { special: 'tesla', arms: [] },
    { special: 'paint', arms: [] },
    { special: 'release', arms: [] },
];

/** The shops, for signs and the HUD: the stations each covers. */
export const SHOPS = [
    { id: 'heads', name: 'The Head Shop', sub: 'Craniums, faces, eyes, ears', from: 0, to: 5, accent: '#ffc46a' },
    { id: 'bodies', name: 'The Body Shop', sub: 'Chests, cores and backpacks', from: 6, to: 11, accent: '#ff9a52' },
    { id: 'arms', name: 'The Arm Line', sub: 'Shoulders, arms and hands', from: 12, to: 17, accent: '#7fd0ff' },
    { id: 'legs', name: 'The Leg Line', sub: 'Hips, knees, shins and feet', from: 18, to: 23, accent: '#9dff9a' },
    { id: 'finish', name: 'Test & Paint', sub: 'Shocked, painted and set down', from: 24, to: 26, accent: '#e2a6ff' },
];
export const shopAt = (k) => SHOPS.find((s) => k >= s.from && k <= s.to) ?? null;

const hangY = (k) => (k <= 5 ? -0.95 : k <= 17 ? -0.38 : 0.3);
const ease = (t) => t * t * (3 - 2 * t);

// the industrial arms
const SH_Y = 1.4, A1 = 1.9, A2 = 1.7;
const TOOL = { place: 0.5, weld: 0.48, torque: 0.42, probe: 0.5 };
export const PED_H = 0.9;

// ---------------------------------------------------------------- materials

/** Robot parts glow and char as they burn: a per-instance heat. */
function heatable(mat) {
    mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aHeat;\nvarying float vHeat;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeat = aHeat;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vHeat;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ndiffuseColor.rgb *= 1.0 - 0.8 * clamp(vHeat * 1.6, 0.0, 1.0);\ntotalEmissiveRadiance += vec3(1.0, 0.22, 0.03) * vHeat * vHeat * 1.4;');
    };
    mat.customProgramCacheKey = () => 'foundry-heat';
    return mat;
}

export function robotMaterials() {
    return {
        paint: heatable(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35 })),
        steel: heatable(new THREE.MeshStandardMaterial({ color: 0xa8aeb5, roughness: 0.32, metalness: 0.88 })),
        dark: heatable(new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.55, metalness: 0.6 })),
        glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        armPaint: new THREE.MeshStandardMaterial({ color: 0xe0761c, roughness: 0.45, metalness: 0.25 }),
        armDark: new THREE.MeshStandardMaterial({ color: 0x33353a, roughness: 0.5, metalness: 0.6 }),
        armSteel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.28, metalness: 0.9 }),
        chain: new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.5, metalness: 0.8 }),
    };
}

// ---------------------------------------------------------------- instances

class Inst {
    constructor(scene, geo, mat, cap, { color = false, heat = false } = {}) {
        this.cap = cap;
        geo = geo.clone();
        if (heat) {
            this.heat = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
            this.heat.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('aHeat', this.heat);
        }
        this.mesh = new THREE.InstancedMesh(geo, mat, cap);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        if (color) {
            this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
            this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        }
        this.mesh.count = 0;
        this.n = 0;
        scene.add(this.mesh);
    }
    push(m, c, heat = 0) {
        if (this.n >= this.cap) return;
        m.toArray(this.mesh.instanceMatrix.array, this.n * 16);
        if (c && this.mesh.instanceColor) c.toArray(this.mesh.instanceColor.array, this.n * 3);
        if (this.heat) this.heat.array[this.n] = heat;
        this.n++;
    }
    end() {
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        if (this.heat) this.heat.needsUpdate = true;
        this.n = 0;
    }
}

// ---------------------------------------------------------------- arm geometry

function armGeometries() {
    const cyl = (r0, r1, h, s = 12) => new THREE.CylinderGeometry(r0, r1, h, s);
    const g = {};
    g.turret = new THREE.CylinderGeometry(0.42, 0.5, 0.5, 16).translate(0, 0.25, 0);
    g.motor = cyl(0.27, 0.27, 0.62, 14).rotateZ(Math.PI / 2);
    g.upper = new THREE.BoxGeometry(0.32, 0.34, A1 + 0.1).translate(0, 0, A1 / 2);
    g.elbow = cyl(0.2, 0.2, 0.44, 12).rotateZ(Math.PI / 2);
    g.fore = new THREE.BoxGeometry(0.24, 0.24, A2).translate(0, 0, A2 / 2);
    g.wrist = cyl(0.15, 0.17, 0.16, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06);
    g.palm = new THREE.BoxGeometry(0.34, 0.2, 0.16).translate(0, 0, 0.18);
    g.finger = new THREE.BoxGeometry(0.05, 0.12, 0.26).translate(0, 0, 0.36);
    g.torch = cyl(0.05, 0.07, 0.4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.24);
    g.nozzle = new THREE.ConeGeometry(0.06, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0, 0.47);
    const hex = cyl(0.1, 0.1, 0.34, 6).rotateX(Math.PI / 2).translate(0, 0, 0.24);
    g.driver = hex;
    g.probe = cyl(0.025, 0.025, 0.42, 6).rotateX(Math.PI / 2).translate(0, 0, 0.26);
    g.probeTip = new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0, 0.5);
    // the hook and its chain
    g.trolley = new THREE.BoxGeometry(0.5, 0.36, 0.8).translate(0, 0.08, 0);
    g.wheels = new THREE.CylinderGeometry(0.13, 0.13, 0.66, 10).rotateZ(Math.PI / 2).translate(0, 0.32, 0);
    g.chain = new THREE.CylinderGeometry(0.035, 0.035, 1, 5).translate(0, 0.5, 0);
    g.hook = new THREE.TorusGeometry(0.11, 0.03, 6, 12, Math.PI * 1.4).rotateZ(-Math.PI * 0.2).translate(0, -0.06, 0);
    // the head scanner
    g.scanRing = new THREE.TorusGeometry(0.72, 0.05, 6, 40).rotateX(Math.PI / 2);
    return g;
}

// ---------------------------------------------------------------- the lines

const V3 = THREE.Vector3;
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _r = new THREE.Matrix4();
const _v = new V3(), _v2 = new V3(), _v3 = new V3();
const _c = new THREE.Color(), _paint = new THREE.Color();
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
const sc = (m, s) => m.multiply(_r.makeScale(s, s, s));

const EYE_OFF = new THREE.Color(0.03, 0.04, 0.05), EYE_ON = new THREE.Color(0.5, 2.3, 3.4), EYE_FLASH = new THREE.Color(2.6, 3.0, 3.6);
const CORE_DIM = new THREE.Color(0.12, 0.3, 0.4), CORE_ON = new THREE.Color(0.7, 2.4, 3.6);
const TIP_OFF = new THREE.Color(0.1, 0.03, 0.03), TIP_ON = new THREE.Color(3.2, 0.35, 0.2);
const HOT = new THREE.Color(3.0, 0.9, 0.2);
const WHITE = new THREE.Color(1, 1, 1);
const RIFLE_ON = new THREE.Color(0.4, 2.2, 3.2);
const OLIVE = new THREE.Color('#556236'), SARGE_EYES = new THREE.Color(3.2, 0.35, 0.15), SARGE_CORE = new THREE.Color(2.4, 0.5, 0.2);
const SARGE_SCALE = 1.15;
// a rifle held across the chest (on the chest bone), and one held out by its middle (on a hand bone)
const RIFLE_CARRY = new THREE.Matrix4().compose(new THREE.Vector3(-0.08, 0.32, 0.52), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, -0.25, 0.15, 'YXZ')), new THREE.Vector3(1, 1, 1));
const RIFLE_HAND = new THREE.Matrix4().compose(new THREE.Vector3(0, -0.34, 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));

/** Where a station frame (robot-local metres, unscaled) lands in the world. */
function stationPoint(line, k, lx, lz, out) {
    // yaw +π/2: the robot's front (+z) points to +x and its left (+x) to -z
    return out.set(line.x + line.face * lz, 0, slotZ(k) - line.face * lx);
}

export class Lines {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this.scene = scene;
        this.mats = robotMaterials();
        const geos = robotGeometries();
        // the centre of each part, in its bone's frame, for the arms to aim at
        this.centre = PARTS.map((p) => {
            const g = geos[p.mesh];
            g.computeBoundingBox();
            const c = g.boundingBox.getCenter(new V3());
            if (PART_OFFSET[p.name]) c.applyMatrix4(PART_OFFSET[p.name]);
            return c;
        });
        this.lines = LINES.map((l) => ({ ...l, yaw: l.face > 0 ? Math.PI / 2 : -Math.PI / 2, startYaw: pathAt(l, 0, {}).yaw, slotBones: Array.from({ length: LAST + 1 }, () => newBones()), arms: [], prevT: null }));
        this.postBones = newBones();

        // every arm in the hall
        for (const line of this.lines) {
            STATIONS.forEach((st, k) => {
                for (const a of st.arms) {
                    const [lx, lz] = AT[a.at];
                    const base = stationPoint(line, k, lx, lz, new V3());
                    const centre = stationPoint(line, k, 0, 0, new V3());
                    const out = base.clone().sub(centre).setY(0).normalize();
                    const arm = { ...a, line, slot: k, base, out, feeder: base.clone().addScaledVector(out, 1.5).setY(1.05), tip: new V3(), wrist: new V3(), holding: false, grip: 1, spin: 0 };
                    arm.parts = a.parts?.map((n) => PART[n]);
                    arm.weldP = a.p ? new V3(...a.p) : null;
                    line.arms.push(arm);
                }
            });
        }
        this.arms = this.lines.flatMap((l) => l.arms);

        // instanced meshes: one per kind of robot part, sized for every robot plus the parts in the arms' hands and on their feeders
        const NROB = this.lines.length * (K_MAX + 1) + 1;
        const perMesh = {};
        for (const p of PARTS) perMesh[p.mesh] = (perMesh[p.mesh] || 0) + 1;
        const held = {};
        for (const a of this.arms) if (a.parts) for (const p of a.parts) held[p.mesh] = (held[p.mesh] || 0) + 2;
        this.inst = {};
        for (const [name, matKey] of Object.entries(MESHES)) {
            const cap = NROB * perMesh[name] + (held[name] || 0);
            this.inst[name] = new Inst(scene, geos[name], this.mats[matKey], cap, { color: matKey === 'paint' || matKey === 'glow', heat: matKey !== 'glow' });
        }
        // the laser rifles: one for every walking unit, two in the quartermaster's hands
        const rg = rifleGeometries();
        this.rifleBody = new Inst(scene, rg.body, this.mats.dark, NROB, { heat: true });
        this.rifleGlow = new Inst(scene, rg.glow, this.mats.glow, NROB, { color: true });
        // the quartermaster's own kit: helmet, visor, armour, webbing
        const kitMat = new THREE.MeshStandardMaterial({ color: 0x46512c, roughness: 0.6, metalness: 0.4 });
        const kitDark = new THREE.MeshStandardMaterial({ color: 0x23261c, roughness: 0.7, metalness: 0.3 });
        const kitGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.4, 0.15) });
        this.sargeKit = sargeGeometries().map(([geo, kind, bone]) => {
            const m = new THREE.Mesh(geo, kind === 'glow' ? kitGlow : kind === 'dark' ? kitDark : kitMat);
            m.matrixAutoUpdate = false;
            m.frustumCulled = false;
            scene.add(m);
            return [m, bone];
        });
        const ag = armGeometries();
        const NA = this.arms.length, NL = this.lines.length * (LAST + 3);
        const count = (kind) => this.arms.filter((a) => a.kind === kind).length;
        const m = this.mats;
        this.armInst = {
            turret: new Inst(scene, ag.turret, m.armDark, NA),
            motor: new Inst(scene, ag.motor, m.armPaint, NA),
            upper: new Inst(scene, ag.upper, m.armPaint, NA),
            elbow: new Inst(scene, ag.elbow, m.armDark, NA),
            fore: new Inst(scene, ag.fore, m.armPaint, NA),
            wrist: new Inst(scene, ag.wrist, m.armDark, NA),
            palm: new Inst(scene, ag.palm, m.armSteel, count('place')),
            finger: new Inst(scene, ag.finger, m.armSteel, count('place') * 2),
            torch: new Inst(scene, ag.torch, m.armSteel, count('weld')),
            nozzle: new Inst(scene, ag.nozzle, m.armDark, count('weld')),
            driver: new Inst(scene, ag.driver, m.armSteel, count('torque')),
            probe: new Inst(scene, ag.probe, m.armSteel, count('probe')),
            probeTip: new Inst(scene, ag.probeTip, m.glow, count('probe'), { color: true }),
            trolley: new Inst(scene, ag.trolley, m.armDark, NL),
            wheels: new Inst(scene, ag.wheels, m.chain, NL),
            chain: new Inst(scene, ag.chain, m.chain, NL),
            hook: new Inst(scene, ag.hook, m.armSteel, NL),
        };
        // the scanners over the last of the head shop
        this.scanners = this.lines.map((line) => {
            const ring = new THREE.Mesh(ag.scanRing, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 1.2) }));
            const sheet = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.9, 0.35), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            const g = new THREE.Group();
            g.add(ring, sheet);
            g.position.set(line.x, 3, slotZ(5));
            scene.add(g);
            return g;
        });

        this.events = { welds: [], arcs: [], mist: [], puffs: [], splashes: [], steps: [], index: [], stops: [], servos: [], boots: [], falls: [] };
        this.robots = [];   // what update() drew: { line, serial, k, post, x, y, z, stage }
        this.time = 0;
    }

    /** Where a unit is, for the HUD and the hover card: its centre, scaled. */
    robotCentre(r, out) {
        return out.set(r.x, r.y, r.z);
    }

    /** The robots' clock for a line. */
    lineT(line, time) {
        return time + line.phase + SERIAL0 * CYCLE;
    }

    /** How many units the lines have finished (and lost in the gap), by `time`. */
    despatched(time) {
        let n = 0;
        for (const l of this.lines) n += Math.max(0, Math.floor((this.lineT(l, time) - REL_AT - l.tHit) / CYCLE) + 1);
        return n;
    }

    // ---------------------------------------------------------- the frame

    /**
     * Pose and draw every robot, arm and hook for `time`.
     * @param {number} time the Foundry's clock, seconds
     * @param {THREE.Vector3} cam where the camera is (events far away are dropped)
     */
    update(time, cam) {
        const ev = this.events;
        for (const k in ev) ev[k].length = 0;
        this.robots.length = 0;
        this.cam = cam;
        for (const line of this.lines) this._line(line, time);
        this._sarge(time);
        this.rifleBody.end();
        this.rifleGlow.end();
        for (const i of Object.values(this.inst)) i.end();
        for (const i of Object.values(this.armInst)) i.end();
        this.time = time;
        return ev;
    }

    _line(line, time) {
        const T = this.lineT(line, time);
        const Tp = line.prevT ?? T;
        line.prevT = T;
        const c = Math.floor(T / CYCLE), p = T - c * CYCLE;
        const moving = p < MOVE;
        const s = moving ? p / MOVE : 1, u = moving ? 0 : (p - MOVE) / DWELL;
        // the line's own events
        const cp = Math.floor(Tp / CYCLE), pp = Tp - cp * CYCLE;
        const up = pp < MOVE ? -1 : (pp - MOVE) / DWELL;
        if (c !== cp) ev(this, 'index', line);
        if (!moving && (pp < MOVE || c !== cp)) ev(this, 'stops', line);
        if (!moving && up < ATTACH_U && u >= ATTACH_U) ev(this, 'servos', line);
        if (!moving && up < RELEASE_U && u >= RELEASE_U) this.events.puffs.push({ line, x: line.x, y: 3.2, z: RELEASE_Z, big: true });
        if (!moving && u > 0.15 && u < 0.85) this.events.mist.push({ line, x: line.x, y: 1.7, z: slotZ(25), color: paintOf(c - 25, new THREE.Color()) });
        line.state = { c, p, moving, s, u };
        // how far the belt off the release plate has run: a unit's length each time one is let go
        const nr = !moving && u >= RELEASE_U ? c - LAST : c - LAST - 1;
        line.belt = nr * CARRY + CARRY * smoothstep(0, T_CARRY, T - (nr * CYCLE + REL_AT));

        for (let n = c - K_MAX; n <= c; n++) {
            const k = c - n;
            const tp = T - (n * CYCLE + REL_AT);
            if (tp >= 0) {
                if (tp < line.life) this._post(line, n, tp, tp - (T - Tp));
            } else this._onLine(line, n, k, moving, s, u, T);
            this._hook(line, n, k, moving, s, u, tp);
        }
        this._arms(line, moving, s, u, T);
        this._scanner(line, moving, u);
        if (STATIONS[24].special === 'tesla' && !moving && u > 0.15 && u < 0.85) this._tesla(line, T);
    }

    /** A unit still on the line, hanging from its hook at station k (or sliding there). */
    _onLine(line, n, k, moving, s, u, T) {
        if (k < 0) return;
        const from = Math.max(0, k - 1);
        const e = ease(s);
        const z = moving ? lerp(slotZ(k - 1), slotZ(k), e) : slotZ(k);
        let y = moving ? lerp(hangY(from), hangY(k), e) : hangY(k);
        const td = u * DWELL;
        let sway = moving ? -0.045 * Math.sin(Math.PI * s) : 0.05 * Math.sin(td * 4.4) * Math.exp(-1.7 * td);
        const pose = this._pose ??= newPose();
        hangPose(pose, sway);
        if (k === LAST) {
            // lowered on to its feet: the legs take the weight
            const d = smoothstep(0, 0.22, u);
            y = lerp(hangY(LAST), 0, d);
            const t = smoothstep(0.12, 0.26, u);
            for (let i = 0; i < 2; i++) {
                pose.hip[i] = lerp(pose.hip[i], 0, t);
                pose.knee[i] = lerp(pose.knee[i], 0, t);
                pose.toe[i] = lerp(pose.toe[i], 0, t);
            }
            sway *= 1 - t;
        }
        if (k === 17 && !moving) {
            // the arm line's last stop flexes the new arms
            const f = Math.sin(clamp((u - 0.1) / 0.75, 0, 1) * Math.PI);
            const f2 = Math.sin(clamp((u - 0.1) / 0.75, 0, 1) * Math.PI * 2);
            pose.shF[0] = 0.04 + 1.5 * f;
            pose.shF[1] = 0.04 + 1.5 * Math.max(0, f2) + 0.4 * f;
            pose.el[0] = 0.22 + 1.3 * f;
            pose.el[1] = 0.22 + 1.6 * Math.abs(f2);
            pose.wr[0] = pose.wr[1] = 0.4 * f;
        }
        if (k === 24 && !moving && u > 0.15 && u < 0.85) {
            // the test rig: jolts
            const j = (Math.sin(T * 31) * Math.sin(T * 17.3)) * 0.18;
            pose.neckY = j;
            pose.neckP = -0.1 * Math.abs(j);
            pose.shF[0] += j * 1.3;
            pose.shF[1] -= j * 1.1;
            pose.el[0] += Math.abs(j) * 2;
            pose.knee[1] += Math.abs(j);
        }
        const root = _m.makeTranslation(line.x, y + HEAD_TOP * SCALE, z);
        rx(root, sway);
        tr(root, 0, -HEAD_TOP * SCALE, 0);
        ry(root, line.yaw);
        sc(root, SCALE);
        const bn = line.slotBones[k];
        bones(pose, root, bn);
        // what it has been given so far
        const glow = { eyes: EYE_OFF, core: CORE_DIM, tip: TIP_OFF };
        if (k === 24 && !moving && u > 0.15 && u < 0.85 && Math.sin(T * 23) > 0.2) glow.eyes = glow.core = EYE_FLASH;
        if (k >= 25) glow.eyes = _c.copy(EYE_OFF).lerp(EYE_ON, 0.15);
        const pf = k < 25 ? 0 : k === 25 ? (moving ? 0 : smoothstep(0.15, 0.85, u)) : 1;
        _paint.copy(PRIMER).lerp(paintOf(n, _v3color), pf);
        for (const pt of PARTS) {
            if (pt.slot > k || (pt.slot === k && (moving || u < ATTACH_U))) continue;
            this._part(pt, bn, glow, 0);
        }
        if (k > 0 || !moving) {
            _v.setFromMatrixPosition(bn[k <= 5 ? B.HEAD : B.CHEST]);
            this.robots.push({ line, serial: n, k, post: false, x: _v.x, y: _v.y + (k <= 5 ? 0.25 : 0.3), z: _v.z, r: k <= 5 ? 0.6 : k < 18 ? 1.3 : 1.7 });
        }
    }

    /** A finished unit, on its own feet. */
    _post(line, n, tp, tpPrev) {
        const pose = this._pose ??= newPose();
        let x = line.x, y = 0, z = WAKE_Z + CARRY * (1 - smoothstep(0, T_CARRY, tp)), yaw = line.yaw, tumble = 0, heat = 0, hide = false, rifle = false;
        const glow = { eyes: EYE_ON, core: CORE_ON, tip: TIP_ON };
        const cross = (a) => tpPrev < a && tp >= a;
        const near = this._near(line.x, WAKE_Z, 60);
        if (tp < T_SLUMP) {
            // let go: it sags
            const t = (tp / T_SLUMP) ** 2;
            hangPose(pose);
            for (let i = 0; i < 2; i++) pose.hip[i] = pose.knee[i] = pose.toe[i] = 0;
            plant(pose);
            mixPose(pose, pose, CROUCH, t);
            plant(pose);
            glow.eyes = EYE_OFF;
            glow.core = CORE_DIM;
            glow.tip = TIP_OFF;
        } else if (tp < T_BOOT) {
            // and wakes up
            copyPose(pose, CROUCH);
            const b = (tp - T_SLUMP) / (T_BOOT - T_SLUMP);
            const on = b > 0.75 || (Math.sin(tp * 37) > 0.3 && b > 0.25);
            glow.eyes = on ? EYE_ON : EYE_OFF;
            glow.core = b > 0.5 ? CORE_ON : CORE_DIM;
            glow.tip = b > 0.8 ? TIP_ON : TIP_OFF;
            if (b > 0.8) pose.neckP = lerp(CROUCH.neckP, 0.1, (b - 0.8) / 0.2);
            if (cross(T_SLUMP + 0.4) && near) this.events.boots.push({ line, x, y: 2, z });
        } else if (tp < T_STAND) {
            const t = ease((tp - T_BOOT) / (T_STAND - T_BOOT));
            mixPose(pose, CROUCH, STAND, t);
            pose.neckP = lerp(0.1, 0, t);
            plant(pose);
            if (cross(T_BOOT) && near) this.events.servos.push({ line, x, y: 2, z, big: true });
        } else if (tp < T_LOOK) {
            // looks about
            const q = (tp - T_STAND) / (T_LOOK - T_STAND);
            copyPose(pose, STAND);
            pose.neckY = 0.6 * Math.sin(q * TAU) * Math.sin(q * Math.PI);
            pose.shF[0] = 0.05 + 0.9 * Math.sin(q * Math.PI) ** 2;
            pose.el[0] = 0.15 + 1.2 * Math.sin(q * Math.PI) ** 2;
            plant(pose);
        } else if (tp < T_TURN) {
            // turns to set off, marking time
            const q = (tp - T_LOOK) / (T_TURN - T_LOOK);
            yaw = line.yaw + angleDiff(line.yaw, line.startYaw) * ease(q);
            walkPose(pose, q * TAU * 2, 0.4 * Math.sin(q * Math.PI));
            if (near) this._stepEvents(q * 4, ((tpPrev - T_LOOK) / (T_TURN - T_LOOK)) * 4, line, x, z);
        } else if (tp < T_TURN + line.tWalk) {
            // walks: across the apron, on to the walkway, out over the pit for the exit
            const d = (tp - T_TURN) * WALK_V;
            const at = pathAt(line, d, this._at ??= {});
            yaw = at.yaw;
            const ph = (d / (STRIDE * SCALE)) * TAU;
            walkPose(pose, ph, Math.min(1, d / 1.2));
            x = at.x + 0.04 * Math.sin(ph) * Math.cos(yaw);
            z = at.z - 0.04 * Math.sin(ph) * Math.sin(yaw);
            rifle = this._armed(pose, d - line.handAt);
            const dPrev = Math.max(0, tpPrev - T_TURN) * WALK_V;
            if (this._near(x, z, 40)) this._stepEvents(d / (STRIDE * SCALE * 0.5), dPrev / (STRIDE * SCALE * 0.5), line, x, z);
        } else {
            // into the gap
            const tf = tp - T_TURN - line.tWalk;
            x = MERGE.x;
            yaw = Math.PI;
            copyPose(pose, STAND);
            const flail = Math.min(1, tf * 2.5);
            rifle = this._armed(pose, 99);
            pose.shF[0] = lerp(pose.shF[0], 2.4 + 0.3 * Math.sin(tp * 9), flail * 0.7);
            pose.shF[1] = lerp(pose.shF[1], 2.2 + 0.3 * Math.sin(tp * 8 + 1), flail * 0.7);
            pose.shR[0] = pose.shR[1] = 0.35 * flail;
            pose.hip[0] = 0.5 * flail * (0.6 + 0.4 * Math.sin(tp * 7));
            pose.hip[1] = 0.3 * flail;
            pose.knee[0] = pose.knee[1] = 0.6 * flail;
            pose.neckP = -0.4 * flail;
            pose.pelvisY = 1.71;
            if (cross(T_TURN + line.tWalk) && this._near(x, STEP_Z, 120)) this.events.falls.push({ line, x, y: 0, z: STEP_Z });
            if (tf < T_FALL) {
                y = -0.5 * GRAV * tf * tf;
                z = STEP_Z - WALK_V * 0.75 * tf;
                tumble = 0.35 * tf + 0.28 * tf * tf;
            } else {
                const tb = tf - T_FALL;
                if (cross(line.tHit) && this._near(x, STEP_Z, 220)) this.events.splashes.push({ line, x, y: LAVA_Y, z: STEP_Z - WALK_V * 0.75 * T_FALL });
                z = STEP_Z - WALK_V * 0.75 * T_FALL - 0.3 * tb;
                const bob = 0.15 * Math.sin(tb * 2.2) * Math.exp(-tb * 0.6);
                y = LAVA_Y - (0.22 * tb + 0.1 * tb * tb) + bob;
                tumble = 0.35 * T_FALL + 0.28 * T_FALL * T_FALL + 0.2 * Math.min(tb, 1.5);
                heat = clamp(tb * 0.7, 0, 1);
                pose.shF[0] = lerp(pose.shF[0], 1.2, Math.min(1, tb));
                pose.shF[1] = lerp(pose.shF[1], 1.0, Math.min(1, tb));
                const out = tb > 2.6 ? true : tb > 1.2 && Math.sin(tb * 40) > 0;
                glow.eyes = out ? EYE_OFF : EYE_ON;
                glow.core = tb > 2 ? HOT : CORE_ON;
                glow.tip = tb > 1 ? TIP_OFF : TIP_ON;
                if (tb > T_BURN - 0.05) hide = true;
            }
            tumble = Math.min(tumble, 1.75);
        }
        if (hide) return;
        const root = _m.makeTranslation(x, y, z);
        ry(root, yaw);
        if (tumble) {
            tr(root, 0, 1.3, 0);
            rx(root, tumble);
            tr(root, 0, -1.3, 0);
        }
        sc(root, SCALE);
        const bn = this.postBones;
        bones(pose, root, bn);
        paintOf(n, _paint);
        if (heat > 0) {
            _paint.lerp(HOT, heat * 0.2);
            if (glow.eyes === EYE_ON) glow.eyes = _c.copy(EYE_ON).lerp(HOT, heat);
        }
        for (const pt of PARTS) this._part(pt, bn, glow, heat);
        if (rifle) this._rifle(_m2.copy(bn[B.CHEST]).multiply(RIFLE_CARRY), heat);
        _v.setFromMatrixPosition(bn[B.CHEST]);
        this.robots.push({ line, serial: n, k: LAST + 1, post: true, x: _v.x, y: _v.y, z: _v.z, r: 1.7, tp, rifle, feetY: y });
    }

    /**
     * Arms for a unit `past` metres beyond the quartermaster: before it, the right arm reaches out for
     * the rifle; after, both hold it across the chest. Returns whether it has one.
     */
    _armed(pose, past) {
        if (past < -1.4) return false;
        if (past < 0) {
            const k = Math.sin(clamp((past + 1.4) / 1.4, 0, 1) * Math.PI * 0.5);
            pose.shF[1] = lerp(pose.shF[1], 0.55, k);
            pose.shR[1] = lerp(pose.shR[1], 0.75, k);
            pose.el[1] = lerp(pose.el[1], 0.25, k);
            return false;
        }
        const k = smoothstep(0, 0.6, past);
        pose.shF[1] = lerp(0.55, 0.42, k);
        pose.shR[1] = lerp(0.75, -0.12, k);
        pose.el[1] = lerp(0.25, 1.5, k);
        pose.shF[0] = lerp(pose.shF[0], 0.95, k);
        pose.shR[0] = lerp(pose.shR[0], -0.3, k);
        pose.el[0] = lerp(pose.el[0], 0.75, k);
        pose.wr[0] = pose.wr[1] = 0.2 * k;
        return true;
    }

    _rifle(m, heat) {
        this.rifleBody.push(m, null, heat);
        this.rifleGlow.push(m, heat > 0.5 ? HOT : RIFLE_ON);
    }

    /**
     * The quartermaster: a big olive-drab unit beside the walkway, just short of the gap, with a crate
     * of laser rifles behind it. It hands one to each unit as it passes, its two arms taking turns:
     * one reaches back into the crate while the other holds a rifle out.
     */
    _sarge(time) {
        const l0 = this.lines[0];
        const off = this.lineT(l0, time) - (REL_AT + T_TURN + l0.handAt / WALK_V);
        const pose = this._sargePose ??= newPose();
        copyPose(pose, STAND);
        const crate = [0, 0], hold = [false, false];
        for (let s = 0; s < 2; s++) {
            const a = ((((off - s * SPACING) % (2 * SPACING)) + 2 * SPACING) % (2 * SPACING)) / (2 * SPACING);
            const c = a < 0.08 ? 0 : a < 0.35 ? ease((a - 0.08) / 0.27) : a < 0.5 ? 1 : a < 0.85 ? 1 - ease((a - 0.5) / 0.35) : 0;
            crate[s] = c;
            hold[s] = a < 0.04 || a > 0.42;
            pose.shF[s] = lerp(1.25, -0.55, c);
            pose.shR[s] = lerp(0.1, 0.55, c);
            pose.el[s] = lerp(0.2, 0.75, c);
            pose.wr[s] = lerp(0.1, 0.4, c);
        }
        const q = (((off % SPACING) + SPACING) % SPACING) / SPACING;
        pose.twist = 0.3 * (crate[1] - crate[0]);
        pose.lean = 0.12 + 0.08 * Math.max(crate[0], crate[1]);
        pose.neckY = 0.45 * (1 - q) - 0.1;
        pose.neckP = 0.12;
        pose.hip[0] = pose.hip[1] = 0.05;
        pose.spread[0] = pose.spread[1] = 0.12;
        plant(pose);
        pose.pelvisY += 0.02 * Math.sin(time * 1.3);
        const root = _m.makeTranslation(SARGE.x, 0, SARGE.z);
        ry(root, -Math.PI / 2);
        sc(root, SARGE_SCALE);
        const bn = this.sargeBones ??= newBones();
        bones(pose, root, bn);
        _paint.copy(OLIVE);
        const glow = { eyes: SARGE_EYES, core: SARGE_CORE, tip: TIP_ON };
        for (const pt of PARTS) this._part(pt, bn, glow, 0);
        for (const [mesh, bone] of this.sargeKit) {
            mesh.matrix.copy(bn[bone]);
            mesh.matrixWorldNeedsUpdate = true;
        }
        for (let s = 0; s < 2; s++) if (hold[s]) this._rifle(_m2.copy(bn[s === 0 ? B.HA_L : B.HA_R]).multiply(RIFLE_HAND), 0);
        _v.setFromMatrixPosition(bn[B.CHEST]);
        this.sarge = { x: _v.x, y: _v.y, z: _v.z, r: 2.0 };
    }

    _stepEvents(steps, stepsPrev, line, x, z) {
        if (Math.floor(steps) !== Math.floor(stepsPrev) && steps > 0.5) this.events.steps.push({ line, x, y: 0, z });
    }

    _near(x, z, d) {
        const c = this.cam;
        return !c || (c.x - x) ** 2 + (c.z - z) ** 2 < d * d;
    }

    /** Write one part of one robot into its mesh. */
    _part(pt, bn, glow, heat) {
        const mesh = this.inst[pt.mesh];
        const m = _m2.copy(bn[pt.bone]);
        if (PART_OFFSET[pt.name]) m.multiply(PART_OFFSET[pt.name]);
        const kind = MESHES[pt.mesh];
        const col = kind === 'paint' ? _paint : kind === 'glow' ? (pt.mesh === 'eyes' ? glow.eyes : pt.mesh === 'core' ? glow.core : glow.tip) : null;
        mesh.push(m, col, heat);
    }

    /** The trolley, chain and hook for unit n. */
    _hook(line, n, k, moving, s, u, tp) {
        if (k < 0 || k > LAST) return;
        const ai = this.armInst;
        let z, yT = RAIL_Y, hookY;
        const e = ease(s);
        if (k === 0 && moving) {
            // a fresh hook comes down out of the housing at the start of the rail
            z = lerp(slotZ(-1), slotZ(0), e);
            yT = RAIL_Y + 3 * (1 - smoothstep(0, 0.7, s));
            hookY = hangY(0) + HEAD_TOP * SCALE;
        } else {
            z = moving ? lerp(slotZ(k - 1), slotZ(k), e) : slotZ(k);
            let y = moving ? lerp(hangY(Math.max(0, k - 1)), hangY(k), e) : hangY(k);
            if (k === LAST && !moving) y = lerp(hangY(LAST), 0, smoothstep(0, 0.22, u));
            hookY = y + HEAD_TOP * SCALE;
            if (k === LAST && !moving && u >= RELEASE_U) {
                hookY = lerp(hookY, RAIL_Y - 0.6, smoothstep(RELEASE_U, 0.6, u));
                yT = RAIL_Y + 3 * smoothstep(0.65, 1, u);
            }
        }
        hookY = Math.min(hookY, yT - 0.6);
        _m.makeTranslation(line.x, yT, z);
        ai.trolley.push(_m);
        ai.wheels.push(_m);
        const L = Math.max(0.05, yT - 0.32 - (hookY + 0.08));
        _m.makeTranslation(line.x, hookY + 0.08, z);
        _m.multiply(_r.makeScale(1, L, 1));
        ai.chain.push(_m);
        _m.makeTranslation(line.x, hookY + 0.12, z);
        ry(_m, line.yaw);
        ai.hook.push(_m);
    }

    // ---------------------------------------------------------- arms

    _arms(line, moving, s, u, T) {
        const ai = this.armInst;
        for (const a of line.arms) {
            const bn = line.slotBones[a.slot];
            const toward = _v2.copy(a.out).negate();
            const P = _v.copy(a.base).setY(SH_Y);
            const tool = TOOL[a.kind];
            let holding = false;
            const tip = a.tip;
            if (a.kind === 'place') {
                const p0 = a.parts[0];
                const attach = _v3.copy(this.centre[p0.id]).applyMatrix4(bn[p0.bone]);
                const approach = attach.clone().addScaledVector(a.out, 0.55);
                const feedTop = a.feeder.clone().setY(a.feeder.y + 0.35);
                const above = feedTop.clone().setY(feedTop.y + 0.7);
                if (moving) {
                    // down to the feeder for the next part, and up again
                    const q = s < 0.5 ? s / 0.5 : (1 - s) / 0.5;
                    tip.copy(above).lerp(feedTop, ease(q));
                    holding = s >= 0.5;
                } else if (u < 0.4) {
                    arc(tip, above, approach, ease(u / 0.4), 0.6);
                    holding = true;
                } else if (u < ATTACH_U) {
                    tip.copy(approach).lerp(attach, ease((u - 0.4) / (ATTACH_U - 0.4)));
                    holding = true;
                } else if (u < 0.7) {
                    tip.copy(attach).lerp(approach, ease((u - ATTACH_U) / (0.7 - ATTACH_U)));
                } else {
                    arc(tip, approach, above, ease((u - 0.7) / 0.3), 0.6);
                }
                // the part in its fingers, and the next one coming up through the feeder
                if (holding) this._held(a, bn, attach, tip, _m2.identity());
                const rise = !moving && u >= 0.5 ? smoothstep(0.5, 0.8, u) : moving && s < 0.5 ? 1 : -1;
                if (rise >= 0) this._held(a, bn, attach, _v3color2.copy(feedTop).setY(feedTop.y - 0.9 * (1 - rise)), null);
                a.grip = damp1(a.grip, holding ? 0.1 : 1, 0.25);
            } else {
                const target = _v3.copy(a.weldP).applyMatrix4(bn[a.bone]);
                const near = target.clone().addScaledVector(a.out, 0.05);
                const rest = P.clone().addScaledVector(toward, 1.4).setY(SH_Y + 1.6);
                const approach = near.clone().addScaledVector(a.out, 0.5);
                const t0 = a.kind === 'probe' ? 0.22 : 0.18, t1 = a.kind === 'probe' ? 0.78 : 0.82;
                if (moving) tip.copy(rest);
                else if (u < t0) arc(tip, rest, approach, ease(u / t0), 0.2);
                else if (u < t0 + 0.06) tip.copy(approach).lerp(near, ease((u - t0) / 0.06));
                else if (u < t1) {
                    tip.copy(near);
                    if (a.kind === 'weld') {
                        // trace the seam
                        const w = (u - t0) * 40;
                        tip.x += Math.cos(w) * 0.05 * Math.abs(a.out.z);
                        tip.z += Math.cos(w) * 0.05 * Math.abs(a.out.x);
                        tip.y += Math.sin(w * 0.5) * 0.05;
                        this.events.welds.push({ line, x: tip.x, y: tip.y, z: tip.z, nx: a.out.x, nz: a.out.z });
                    } else if (a.kind === 'torque') a.spin += 0.6;
                    else if (a.kind === 'probe') this.events.arcs.push({ line, a: tip.clone(), b: target.clone(), probe: true });
                } else if (u < t1 + 0.06) tip.copy(near).lerp(approach, ease((u - t1) / 0.06));
                else arc(tip, approach, rest, ease((u - t1 - 0.06) / (1 - t1 - 0.06)), 0.2);
            }
            this._armPose(a, P, tip, tool);
        }
    }

    /** Draw the parts an arm carries (or that wait on its feeder) at `at`. */
    _held(a, bn, attach, at, _) {
        const dx = at.x - attach.x, dy = at.y - attach.y, dz = at.z - attach.z;
        for (const p of a.parts) {
            const m = _m2.copy(bn[p.bone]);
            if (PART_OFFSET[p.name]) m.multiply(PART_OFFSET[p.name]);
            m.elements[12] += dx;
            m.elements[13] += dy;
            m.elements[14] += dz;
            const kind = MESHES[p.mesh];
            this.inst[p.mesh].push(m, kind === 'paint' ? PRIMER : kind === 'glow' ? (p.mesh === 'core' ? CORE_DIM : EYE_OFF) : null, 0);
        }
    }

    /** Two-bone IK from the shoulder to the wrist; the tool held level, pointing at the tip. */
    _armPose(a, P, tip, tool) {
        const ai = this.armInst;
        let dx = tip.x - P.x, dz = tip.z - P.z;
        const dh = Math.hypot(dx, dz) || 1e-3;
        dx /= dh;
        dz /= dh;
        const yaw = Math.atan2(dx, dz);
        const W = a.wrist.set(tip.x - dx * tool, tip.y, tip.z - dz * tool);
        const d = Math.hypot(W.x - P.x, W.z - P.z) * Math.sign((W.x - P.x) * dx + (W.z - P.z) * dz || 1);
        const h = W.y - P.y;
        const L = clamp(Math.hypot(d, h), Math.abs(A1 - A2) + 0.05, A1 + A2 - 0.01);
        const th1 = Math.atan2(h, d) + Math.acos(clamp((A1 * A1 + L * L - A2 * A2) / (2 * A1 * L), -1, 1));
        const ex = Math.cos(th1) * A1, ey = Math.sin(th1) * A1;
        const th2 = Math.atan2(h - ey, d - ex);
        _m.makeTranslation(a.base.x, PED_H, a.base.z);
        ry(_m, yaw);
        ai.turret.push(_m);
        _m.makeTranslation(P.x, P.y, P.z);
        ry(_m, yaw);
        ai.motor.push(_m);
        rx(_m, -th1);
        ai.upper.push(_m);
        _m.makeTranslation(P.x + dx * ex, P.y + ey, P.z + dz * ex);
        ry(_m, yaw);
        ai.elbow.push(_m);
        rx(_m, -th2);
        ai.fore.push(_m);
        _m.makeTranslation(W.x, W.y, W.z);
        ry(_m, yaw);
        ai.wrist.push(_m);
        if (a.kind === 'place') {
            ai.palm.push(_m);
            for (const side of [-1, 1]) {
                _m2.copy(_m);
                tr(_m2, side * (0.05 + 0.1 * a.grip), 0, 0);
                ai.finger.push(_m2);
            }
        } else if (a.kind === 'weld') {
            ai.torch.push(_m);
            ai.nozzle.push(_m);
        } else if (a.kind === 'torque') {
            rz(_m, a.spin);
            ai.driver.push(_m);
        } else {
            ai.probe.push(_m);
            ai.probeTip.push(_m, _c.setRGB(0.5, 1.6, 3.2));
        }
    }

    // ---------------------------------------------------------- stations

    _scanner(line, moving, u) {
        const g = this.scanners[line.id];
        const bn = line.slotBones[5];
        const head = _v3.set(0, 0.3, 0).applyMatrix4(bn[B.HEAD]);
        const q = moving ? 0 : smoothstep(0.08, 0.2, u) * (1 - smoothstep(0.85, 0.97, u));
        const sweep = Math.cos(clamp((u - 0.15) / 0.7, 0, 1) * TAU * 1.5);
        g.position.set(line.x, lerp(head.y + 1.2, head.y + sweep * 0.42, q), slotZ(5));
        g.children[1].material.opacity = 0.08 + 0.32 * q;
        g.children[0].material.color.setRGB(0.4, 1 + 2 * q, 0.5 + 0.8 * q);
    }

    /** The test rig's coils, where the arcs leap from. */
    coils(line) {
        return [-1, 1].map((sd) => stationPoint(line, 24, sd * 2.7, -0.6, new V3()).setY(5.6));
    }

    _tesla(line, T) {
        const bn = line.slotBones[24];
        const pts = [_v3.set(0, 0.35, 0).applyMatrix4(bn[B.HEAD]).clone(), _v3.set(0, 0.6, 0.2).applyMatrix4(bn[B.CHEST]).clone(), _v3.set(0, -0.2, 0).applyMatrix4(bn[B.HA_L]).clone(), _v3.set(0, -0.2, 0).applyMatrix4(bn[B.HA_R]).clone()];
        line.coilPts ??= this.coils(line);
        line.coilPts.forEach((c, i) => {
            const k = Math.floor(T * 9 + i * 3.7);
            if ((k * 2654435761) % 7 < 4) this.events.arcs.push({ line, a: c, b: pts[(k + i) % pts.length], big: true });
        });
    }
}

function ev(self, kind, line) {
    self.events[kind].push({ line, x: line.x, y: 3, z: slotZ(13) });
}

/** A lerp that lifts in the middle, for an arm swinging over. */
function arc(out, a, b, t, lift) {
    out.copy(a).lerp(b, t);
    out.y += Math.sin(Math.PI * t) * lift;
    return out;
}

const damp1 = (a, b, k) => a + (b - a) * k;
const _v3color = new THREE.Color();
const _v3color2 = new THREE.Vector3();

export { K_MAX, REL_AT };
