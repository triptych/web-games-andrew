// Procedural miniatures: every creature and foe built from spheres, cones, boxes and lathes, then
// merged into one mesh per material so a whole stack is a handful of draw calls. All of them face +z
// and stand on y = 0, a man about 1 unit tall; the view turns and scales them.
//
// Each stands on a round pewter base with a coloured rim, like a painted tabletop miniature: the rim
// says whose it is (cerulean yours, burnt orange the foe's).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inkMaterial, PALETTE } from './ink.js';

// pigments for parts; density is how much colour the wash lays on the paper
const P = {
    steel: [0xd8d4c8, 0.12], iron: [0x6f6a62, 0.5], wood: [0xa07a48, 0.55], leather: [0x8a5a3a, 0.55],
    skin: [0xd9a47c, 0.45], goblin: [0x8aa04e, 0.6], orc: [0x6d8a46, 0.6], bone: [0xeee2bc, 0.25],
    fur: [0x8c8474, 0.5], darkfur: [0x5a5248, 0.6], gold: [PALETTE.gold, 0.65], white: [0xf6f0e0, 0.08],
    fire: [0xe2702c, 0.75], ember: [0xb5532d, 0.7], stone: [0x9a958a, 0.5], purple: [0x7a5a8a, 0.55],
    green: [0x6b8a4a, 0.55], moss: [0x5e7a3a, 0.65], bark: [0x7a5a3a, 0.65], leaf: [0x6f9a46, 0.6],
    copper: [0xc4743a, 0.65], red: [0xa83a2a, 0.65], bog: [0x6a7a5a, 0.6], shadow: [0x3a3438, 0.75],
    cloth: [0xc9b48a, 0.4], cream: [0xeadbb0, 0.3], blue: [0x4f7f99, 0.55], rope: [0xb89a6a, 0.45],
    eye: [0xf4e6a0, 0.9], pale: [0xb8c4c0, 0.4], bronze: [0xb88a3a, 0.6],
};
const mat = (k) => (typeof k === 'object' ? k : inkMaterial(P[k][0], P[k][1]));
const TEAM = { p: () => inkMaterial(PALETTE.you, 0.55), e: () => inkMaterial(PALETTE.foe, 0.55) };

// ------------------------------------------------------------------ a little modelling kit
class Kit {
    constructor(team) { this.parts = []; this.team = team; }
    add(geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        const mm = m === 'team' ? TEAM[this.team]() : mat(m);
        const o = new THREE.Object3D();
        o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz);
        o.updateMatrix();
        const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(o.matrix);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        this.parts.push({ g, m: mm });
        return this;
    }
    sph(r, m, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.66 | 0)), m, x, y, z, 0, 0, 0, sx, sy, sz); }
    box(w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz); }
    cyl(rt, rb, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, ry, rz); }
    cone(r, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 10) { return this.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, rx, ry, rz); }
    tor(r, t, m, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) { return this.add(new THREE.TorusGeometry(r, t, 6, 16, arc), m, x, y, z, rx, ry, rz); }
    /** A limb from a to b: a cylinder stretched between two points. */
    limb(a, b, r, m, r2 = r) {
        const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
        const len = A.distanceTo(Bv);
        const geo = new THREE.CylinderGeometry(r2, r, len, 8);
        const mid = A.clone().add(Bv).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
        const e = new THREE.Euler().setFromQuaternion(q);
        return this.add(geo, m, mid.x, mid.y, mid.z, e.x, e.y, e.z);
    }
    lathe(pts, m, x = 0, y = 0, z = 0, seg = 14) { return this.add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), m, x, y, z); }
    /** A flat shape (a wing, a banner) extruded thin. */
    shape(pts, m, x, y, z, rx = 0, ry = 0, rz = 0, depth = 0.02) {
        const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
        g.translate(0, 0, -depth / 2);
        return this.add(g, m, x, y, z, rx, ry, rz);
    }
    base(r = 0.42) {
        this.cyl(r, r * 1.04, 0.07, 'iron', 0, 0.035, 0, 0, 0, 0, 20);
        this.cyl(r * 1.06, r * 1.08, 0.04, 'team', 0, 0.02, 0, 0, 0, 0, 20);
        return this;
    }
    build() {
        const byMat = new Map();
        for (const p of this.parts) { if (!byMat.has(p.m)) byMat.set(p.m, []); byMat.get(p.m).push(p.g); }
        const grp = new THREE.Group();
        for (const [m, gs] of byMat) {
            const g = mergeGeometries(gs, false);
            for (const x of gs) x.dispose();
            const mesh = new THREE.Mesh(g, m);
            grp.add(mesh);
        }
        return grp;
    }
}

// ------------------------------------------------------------------ body plans
/** A standing figure. o: torso (material), skin, legs, h (height scale), w (width), robe, hunch. */
function humanoid(k, o = {}) {
    const h = o.h ?? 1, w = o.w ?? 1;
    const skin = o.skin || 'skin', body = o.body || 'team', legs = o.legs || 'leather';
    const hy = (y) => y * h;
    if (o.robe) {
        k.lathe([[0.001, 0], [0.24 * w, 0], [0.2 * w, hy(0.35)], [0.15 * w, hy(0.62)], [0.08 * w, hy(0.72)], [0.001, hy(0.74)]], o.robe, 0, 0.05, 0);
    } else {
        k.limb([-0.08 * w, 0.06, 0], [-0.07 * w, hy(0.45), 0], 0.055 * w, legs);
        k.limb([0.08 * w, 0.06, 0], [0.07 * w, hy(0.45), 0], 0.055 * w, legs);
        k.box(0.09 * w, 0.06, 0.15, 'leather', -0.08 * w, 0.06, 0.03);
        k.box(0.09 * w, 0.06, 0.15, 'leather', 0.08 * w, 0.06, 0.03);
        k.lathe([[0.001, hy(0.42)], [0.17 * w, hy(0.42)], [0.2 * w, hy(0.5)], [0.17 * w, hy(0.72)], [0.1 * w, hy(0.8)], [0.001, hy(0.81)]], body, 0, 0, 0);
    }
    const hunch = o.hunch || 0;
    const headY = hy(0.9) - hunch * 0.15, headZ = hunch * 0.18;
    k.sph(0.11 * (o.head ?? 1), skin, 0, headY, headZ);
    // arms
    const sh = hy(0.74);
    const ax = 0.2 * w;
    const handL = o.handL || [-ax - 0.04, hy(0.46), 0.12];
    const handR = o.handR || [ax + 0.04, hy(0.46), 0.12];
    k.limb([-ax, sh, 0], handL, 0.045 * w, o.arms || body);
    k.limb([ax, sh, 0], handR, 0.045 * w, o.arms || body);
    k.sph(0.05 * w, skin, ...handL);
    k.sph(0.05 * w, skin, ...handR);
    return { headY, headZ, handL, handR, sh };
}

/** A four-footed beast: wolf, horse, lion. o: len, hgt, body mat, neck, head. */
function quadruped(k, o = {}) {
    const len = o.len ?? 0.9, hgt = o.hgt ?? 0.5, m = o.m || 'fur', r = o.r ?? 0.16;
    k.sph(r, m, 0, hgt, 0, 1, 0.95, len / (r * 2) * 0.9);
    for (const [x, z] of [[-0.09, len * 0.32], [0.09, len * 0.32], [-0.09, -len * 0.32], [0.09, -len * 0.32]]) {
        k.limb([x, hgt - 0.05, z], [x * 1.1, 0.07, z + 0.02], 0.04 * (o.leg ?? 1), o.legM || m, 0.03 * (o.leg ?? 1));
    }
    const nz = len * 0.45, ny = hgt + (o.neck ?? 0.18);
    k.limb([0, hgt + 0.05, len * 0.36], [0, ny, nz + 0.05], r * 0.55, m);
    return { headPos: [0, ny + 0.03, nz + 0.12], tail: [0, hgt + 0.04, -len * 0.45], hgt };
}

function wolfHead(k, [x, y, z], m = 'fur', s = 1) {
    k.box(0.16 * s, 0.14 * s, 0.18 * s, m, x, y, z);
    k.box(0.09 * s, 0.08 * s, 0.14 * s, m, x, y - 0.02 * s, z + 0.14 * s);
    k.sph(0.025 * s, 'shadow', x, y, z + 0.215 * s);
    k.cone(0.04 * s, 0.1 * s, m, x - 0.05 * s, y + 0.11 * s, z - 0.03 * s);
    k.cone(0.04 * s, 0.1 * s, m, x + 0.05 * s, y + 0.11 * s, z - 0.03 * s);
}

function horseHead(k, [x, y, z], m = 'leather') {
    k.box(0.12, 0.14, 0.32, m, x, y + 0.02, z + 0.06, 0.5);
    k.cone(0.03, 0.08, m, x - 0.04, y + 0.15, z - 0.04);
    k.cone(0.03, 0.08, m, x + 0.04, y + 0.15, z - 0.04);
}

function wings(k, m, y, span = 0.7, z = -0.05, up = 0.5, feather = true) {
    const pts = feather
        ? [[0, 0], [span * 0.4, 0.18], [span, 0.28], [span * 0.92, 0.12], [span * 0.8, 0.04], [span * 0.62, -0.08], [span * 0.4, -0.12], [span * 0.18, -0.1]]
        : [[0, 0], [span * 0.35, 0.26], [span, 0.36], [span * 0.82, 0.1], [span * 0.7, -0.08], [span * 0.5, 0.02], [span * 0.36, -0.14], [span * 0.2, -0.02]];
    k.shape(pts, m, 0.05, y, z, 0, 0, up);
    k.shape(pts.map(([a, b]) => [-a, b]), m, -0.05, y, z, 0, 0, -up);
}

function dragon(k, o = {}) {
    const m = o.m || 'copper', s = o.s ?? 1, wingM = o.wing || m;
    k.sph(0.28 * s, m, 0, 0.5 * s, 0, 1, 0.85, 1.6);
    for (const [x, z] of [[-0.16, 0.25], [0.16, 0.25], [-0.16, -0.28], [0.16, -0.28]]) k.limb([x * s, 0.42 * s, z * s], [x * 1.2 * s, 0.06, (z + 0.06) * s], 0.07 * s, m, 0.05 * s);
    // neck: a curve of spheres
    for (let i = 0; i < 5; i++) { const t = i / 4; k.sph((0.12 - t * 0.03) * s, m, 0, (0.6 + t * 0.42) * s, (0.32 + t * 0.22 - t * t * 0.1) * s); }
    const hy = 1.04 * s, hz = 0.5 * s;
    k.box(0.2 * s, 0.16 * s, 0.32 * s, m, 0, hy, hz + 0.08 * s, 0.15);
    k.box(0.16 * s, 0.06 * s, 0.24 * s, m, 0, hy - 0.09 * s, hz + 0.12 * s, 0.3);
    k.sph(0.035 * s, 'eye', -0.08 * s, hy + 0.05 * s, hz + 0.14 * s);
    k.sph(0.035 * s, 'eye', 0.08 * s, hy + 0.05 * s, hz + 0.14 * s);
    k.cone(0.03 * s, 0.22 * s, o.horn || 'bone', -0.07 * s, hy + 0.12 * s, hz - 0.05 * s, -0.9);
    k.cone(0.03 * s, 0.22 * s, o.horn || 'bone', 0.07 * s, hy + 0.12 * s, hz - 0.05 * s, -0.9);
    // tail
    for (let i = 0; i < 6; i++) { const t = i / 5; k.sph((0.12 - t * 0.08) * s, m, Math.sin(t * 2) * 0.12 * s, (0.45 - t * 0.3) * s, (-0.38 - t * 0.55) * s); }
    k.cone(0.06 * s, 0.14 * s, m, Math.sin(2) * 0.12 * s, 0.12 * s, -1.0 * s, -1.6);
    // spines
    for (let i = 0; i < 5; i++) k.cone(0.03 * s, 0.1 * s, o.horn || 'bone', 0, (0.72 - i * 0.03) * s, (0.3 - i * 0.15) * s, -0.4);
    wings(k, wingM, 0.62 * s, 0.95 * s, -0.05 * s, 0.45, false);
}

// ------------------------------------------------------------------ the bestiary
const B = {
    pikemen(k) {
        const h = humanoid(k, { body: 'team', handR: [0.18, 0.55, 0.16], handL: [-0.15, 0.62, 0.18] });
        k.sph(0.13, 'steel', 0, h.headY + 0.04, 0, 1, 0.6, 1);
        k.cyl(0.2, 0.2, 0.015, 'steel', 0, h.headY + 0.02, 0, 0, 0, 0, 16);
        k.limb([0.18, 0.1, -0.35], [0.12, 1.75, 0.55], 0.018, 'wood');
        k.cone(0.035, 0.16, 'steel', 0.115, 1.8, 0.6, 0.45);
        k.cyl(0.14, 0.14, 0.03, 'team', -0.24, 0.52, 0.1, 0, 0, Math.PI / 2, 14);
        k.sph(0.03, 'steel', -0.26, 0.52, 0.1);
    },
    bowmen(k) {
        const h = humanoid(k, { body: 'green', handL: [-0.12, 0.75, 0.26], handR: [0.1, 0.72, 0.02] });
        k.cone(0.14, 0.24, 'green', 0, h.headY + 0.06, -0.02);
        k.tor(0.42, 0.012, 'wood', -0.14, 0.75, 0.26, 0, Math.PI / 2, Math.PI / 2, Math.PI * 0.85);
        k.limb([-0.14, 0.36, 0.3], [-0.14, 1.14, 0.3], 0.004, 'rope');
        k.cyl(0.05, 0.05, 0.4, 'leather', 0.1, 0.75, -0.16, 0.3);
        for (let i = 0; i < 3; i++) k.cone(0.02, 0.06, 'cream', 0.07 + i * 0.03, 1.0, -0.22, 0.3);
    },
    wolves(k) {
        const q = quadruped(k, { len: 0.85, hgt: 0.42, m: 'darkfur', r: 0.15 });
        wolfHead(k, q.headPos, 'darkfur');
        k.limb(q.tail, [0, q.hgt - 0.12, -0.6], 0.05, 'darkfur', 0.02);
        k.cyl(0.12, 0.12, 0.05, 'team', 0, q.hgt + 0.16, 0.25, 0.4, 0, 0, 12);
    },
    dwarves(k) {
        const h = humanoid(k, { h: 0.75, w: 1.35, body: 'team', handL: [-0.25, 0.42, 0.24], handR: [0.28, 0.55, 0.12] });
        k.cone(0.12, 0.32, 'bronze', 0, h.headY - 0.16, 0.08, Math.PI);
        k.sph(0.13, 'steel', 0, h.headY + 0.03, 0, 1, 0.7, 1);
        k.cone(0.03, 0.16, 'bone', -0.13, h.headY + 0.1, 0, 0, 0, 0.9);
        k.cone(0.03, 0.16, 'bone', 0.13, h.headY + 0.1, 0, 0, 0, -0.9);
        k.box(0.42, 0.56, 0.05, 'team', -0.08, 0.42, 0.3);
        k.box(0.08, 0.5, 0.06, 'steel', -0.08, 0.42, 0.32);
        k.limb([0.28, 0.45, 0.12], [0.3, 1.0, 0.2], 0.02, 'wood');
        k.box(0.04, 0.18, 0.16, 'steel', 0.3, 0.95, 0.26);
    },
    mages(k) {
        const h = humanoid(k, { robe: 'purple', handR: [0.22, 0.6, 0.14], arms: 'purple' });
        k.cone(0.1, 0.3, 'cream', 0, h.headY - 0.18, 0.08, Math.PI);
        k.cyl(0.24, 0.24, 0.02, 'purple', 0, h.headY + 0.08, 0, 0, 0, 0, 16);
        k.cone(0.13, 0.42, 'purple', 0, h.headY + 0.3, -0.03, -0.2);
        k.limb([0.22, 0.05, 0.14], [0.22, 1.3, 0.14], 0.02, 'wood');
        k.sph(0.07, 'eye', 0.22, 1.36, 0.14);
    },
    griffins(k) {
        const q = quadruped(k, { len: 0.9, hgt: 0.48, m: 'gold', r: 0.17, neck: 0.25 });
        const [x, y, z] = q.headPos;
        k.sph(0.13, 'white', x, y, z - 0.02);
        k.cone(0.05, 0.16, 'gold', x, y - 0.03, z + 0.14, Math.PI / 2 + 0.4);
        k.sph(0.025, 'shadow', x - 0.07, y + 0.03, z + 0.06);
        k.sph(0.025, 'shadow', x + 0.07, y + 0.03, z + 0.06);
        wings(k, 'cream', q.hgt + 0.12, 0.85, 0, 0.55, true);
        k.limb(q.tail, [0, q.hgt + 0.1, -0.75], 0.03, 'gold', 0.02);
        k.sph(0.05, 'gold', 0, q.hgt + 0.12, -0.76);
    },
    knights(k) {
        const q = quadruped(k, { len: 1.1, hgt: 0.62, m: 'cream', r: 0.2, neck: 0.32, leg: 1.3 });
        horseHead(k, q.headPos, 'cream');
        k.box(0.46, 0.28, 0.8, 'team', 0, q.hgt - 0.04, 0, 0, 0, 0);       // barding
        k.limb(q.tail, [0, q.hgt - 0.3, -0.7], 0.05, 'cream', 0.03);
        // rider
        k.lathe([[0.001, 0], [0.15, 0], [0.18, 0.12], [0.15, 0.34], [0.08, 0.4], [0.001, 0.41]], 'steel', 0, q.hgt + 0.14, -0.05);
        k.cyl(0.1, 0.1, 0.16, 'steel', 0, q.hgt + 0.66, -0.05, 0, 0, 0, 10);
        k.box(0.14, 0.02, 0.02, 'shadow', 0, q.hgt + 0.68, 0.05);
        k.cone(0.03, 0.14, 'red', 0, q.hgt + 0.8, -0.08);
        k.limb([0.18, q.hgt + 0.3, -0.4], [0.2, q.hgt + 0.55, 1.2], 0.025, 'wood', 0.012);
        k.shape([[0, 0], [0.24, -0.05], [0, -0.12]], 'team', 0.2, q.hgt + 0.5, 0.9, 0, -Math.PI / 2, 0);
        k.box(0.04, 0.34, 0.24, 'team', -0.2, q.hgt + 0.32, 0.02);
    },
    ogres(k) {
        const h = humanoid(k, { h: 1.25, w: 1.7, body: 'leather', skin: 'goblin', head: 0.9, handR: [0.4, 0.55, 0.2] });
        k.sph(0.3, 'goblin', 0, 0.68, 0.06, 1, 0.9, 0.95);
        k.box(0.5, 0.12, 0.36, 'team', 0, 0.45, 0);
        k.limb([0.4, 0.5, 0.2], [0.45, 1.3, 0.35], 0.04, 'wood', 0.1);
        k.cone(0.03, 0.06, 'bone', -0.04, h.headY - 0.04, 0.1, Math.PI);
        k.cone(0.03, 0.06, 'bone', 0.04, h.headY - 0.04, 0.1, Math.PI);
    },
    oaks(k) {
        k.cyl(0.16, 0.3, 1.1, 'bark', 0, 0.55, 0, 0, 0, 0, 9);
        for (const [x, z, a] of [[-0.2, 0.1, 0.6], [0.22, -0.05, -0.7], [0.05, -0.2, 0.2]]) k.limb([x * 0.5, 0.05, z * 0.5], [x * 1.8, 0.02, z * 1.8 + 0.1], 0.08, 'bark', 0.03);
        k.limb([-0.1, 0.9, 0], [-0.55, 1.25, 0.2], 0.07, 'bark', 0.03);
        k.limb([0.1, 0.95, 0], [0.5, 1.3, 0.15], 0.07, 'bark', 0.03);
        for (const [x, y, z, r] of [[0, 1.55, 0, 0.42], [-0.45, 1.35, 0.1, 0.3], [0.45, 1.4, 0.05, 0.3], [0.1, 1.3, 0.3, 0.26], [-0.1, 1.35, -0.3, 0.28]]) k.sph(r, 'leaf', x, y, z, 1, 0.85, 1, 10);
        k.sph(0.05, 'eye', -0.08, 0.85, 0.2); k.sph(0.05, 'eye', 0.08, 0.85, 0.2);
        k.box(0.14, 0.03, 0.03, 'shadow', 0, 0.68, 0.24);
        k.cyl(0.32, 0.32, 0.04, 'team', 0, 0.5, 0, 0, 0, 0, 12);
    },
    moonhorns(k) {
        const q = quadruped(k, { len: 1.05, hgt: 0.6, m: 'white', r: 0.19, neck: 0.32, leg: 1.2 });
        horseHead(k, q.headPos, 'white');
        const [x, y, z] = q.headPos;
        k.cone(0.03, 0.34, 'gold', x, y + 0.2, z + 0.12, 0.9);
        for (let i = 0; i < 4; i++) k.cone(0.05, 0.16, 'pale', 0, q.hgt + 0.28 - i * 0.04, 0.38 - i * 0.1, -0.9);
        k.limb(q.tail, [0, q.hgt - 0.3, -0.72], 0.06, 'pale', 0.02);
        k.box(0.36, 0.06, 0.4, 'team', 0, q.hgt + 0.17, 0);
    },
    drakes(k) { dragon(k, { m: 'copper', s: 0.8, wing: 'bronze' }); },
    wyrm(k) { dragon(k, { m: 'gold', s: 1.15, wing: 'cream', horn: 'white' }); },

    // ---- foes
    goblins(k) {
        const h = humanoid(k, { h: 0.7, w: 0.9, body: 'leather', skin: 'goblin', head: 1.25, handR: [0.16, 0.42, 0.18] });
        k.cone(0.04, 0.22, 'goblin', -0.16, h.headY + 0.03, 0, 0, 0, 1.2);
        k.cone(0.04, 0.22, 'goblin', 0.16, h.headY + 0.03, 0, 0, 0, -1.2);
        k.cone(0.03, 0.09, 'goblin', 0, h.headY - 0.01, 0.15, Math.PI / 2);
        k.sph(0.022, 'eye', -0.05, h.headY + 0.04, 0.11); k.sph(0.022, 'eye', 0.05, h.headY + 0.04, 0.11);
        k.limb([0.16, 0.1, -0.2], [0.14, 1.05, 0.4], 0.014, 'wood');
        k.cone(0.03, 0.1, 'iron', 0.14, 1.1, 0.43, 0.4);
    },
    slingers(k) {
        const h = humanoid(k, { h: 0.7, w: 0.9, body: 'cloth', skin: 'goblin', head: 1.25, handR: [0.18, 0.95, 0.0] });
        k.cone(0.04, 0.22, 'goblin', -0.16, h.headY + 0.03, 0, 0, 0, 1.2);
        k.cone(0.04, 0.22, 'goblin', 0.16, h.headY + 0.03, 0, 0, 0, -1.2);
        k.limb([0.18, 0.95, 0], [0.24, 1.15, -0.1], 0.006, 'rope');
        k.sph(0.04, 'stone', 0.24, 1.15, -0.1);
        k.box(0.16, 0.1, 0.1, 'leather', -0.12, 0.35, 0.05);
    },
    skeletons(k) {
        k.limb([-0.07, 0.06, 0], [-0.07, 0.45, 0], 0.025, 'bone'); k.limb([0.07, 0.06, 0], [0.07, 0.45, 0], 0.025, 'bone');
        k.box(0.22, 0.05, 0.1, 'bone', 0, 0.46, 0);
        k.cyl(0.02, 0.02, 0.32, 'bone', 0, 0.62, -0.03);
        for (let i = 0; i < 3; i++) k.tor(0.1 - i * 0.012, 0.012, 'bone', 0, 0.58 + i * 0.07, 0.01, Math.PI / 2);
        k.sph(0.1, 'bone', 0, 0.9, 0, 1, 1.05, 1.05);
        k.sph(0.025, 'shadow', -0.04, 0.91, 0.08); k.sph(0.025, 'shadow', 0.04, 0.91, 0.08);
        k.limb([-0.14, 0.76, 0], [-0.2, 0.5, 0.12], 0.018, 'bone'); k.limb([0.14, 0.76, 0], [0.2, 0.5, 0.14], 0.018, 'bone');
        k.box(0.03, 0.5, 0.06, 'iron', 0.2, 0.62, 0.3, 0.9);
        k.cyl(0.15, 0.15, 0.03, 'team', -0.24, 0.55, 0.12, 0, 0, Math.PI / 2, 12);
    },
    worgs(k) {
        const q = quadruped(k, { len: 0.95, hgt: 0.45, m: 'fur', r: 0.16 });
        wolfHead(k, q.headPos, 'fur', 1.1);
        k.limb(q.tail, [0, q.hgt - 0.1, -0.62], 0.05, 'fur', 0.02);
        const y = q.hgt + 0.12;
        k.lathe([[0.001, 0], [0.11, 0], [0.13, 0.08], [0.1, 0.22], [0.001, 0.24]], 'team', 0, y, -0.05);
        k.sph(0.1, 'goblin', 0, y + 0.32, -0.04);
        k.cone(0.03, 0.16, 'goblin', -0.12, y + 0.34, -0.04, 0, 0, 1.2);
        k.cone(0.03, 0.16, 'goblin', 0.12, y + 0.34, -0.04, 0, 0, -1.2);
        k.limb([0.12, y + 0.18, 0], [0.16, y + 0.5, 0.3], 0.012, 'wood');
    },
    bandits(k) {
        const h = humanoid(k, { body: 'leather', handR: [0.24, 0.55, 0.2] });
        k.cone(0.15, 0.26, 'team', 0, h.headY + 0.04, -0.03);
        k.box(0.12, 0.04, 0.02, 'shadow', 0, h.headY - 0.02, 0.1);
        k.shape([[-0.2, 0], [0.2, 0], [0.25, -0.62], [-0.25, -0.62]], 'team', 0, h.sh + 0.02, -0.12, 0.1);
        k.box(0.03, 0.03, 0.46, 'steel', 0.24, 0.6, 0.42, 0.4);
    },
    orcs(k) {
        const h = humanoid(k, { w: 1.3, body: 'leather', skin: 'orc', head: 1.1, handR: [0.3, 0.6, 0.2] });
        k.cone(0.02, 0.06, 'bone', -0.04, h.headY - 0.04, 0.1, -0.3); k.cone(0.02, 0.06, 'bone', 0.04, h.headY - 0.04, 0.1, -0.3);
        k.sph(0.09, 'iron', -0.26, h.sh + 0.03, 0, 1, 0.7, 1); k.sph(0.09, 'iron', 0.26, h.sh + 0.03, 0, 1, 0.7, 1);
        k.cone(0.02, 0.1, 'bone', -0.28, h.sh + 0.1, 0); k.cone(0.02, 0.1, 'bone', 0.28, h.sh + 0.1, 0);
        k.limb([0.3, 0.5, 0.2], [0.32, 1.05, 0.3], 0.02, 'wood');
        k.shape([[0, 0], [0.18, 0.08], [0.2, -0.16], [0, -0.1]], 'iron', 0.33, 1.0, 0.3, 0, -Math.PI / 2);
        k.box(0.36, 0.1, 0.24, 'team', 0, 0.44, 0);
    },
    shamans(k) {
        const h = humanoid(k, { robe: 'team', skin: 'orc', handR: [0.22, 0.65, 0.14], arms: 'leather' });
        k.limb([0.22, 0.05, 0.14], [0.22, 1.25, 0.14], 0.02, 'wood');
        k.sph(0.07, 'bone', 0.22, 1.3, 0.14, 1, 1.1, 1);
        for (let i = 0; i < 3; i++) k.cone(0.02, 0.18, 'red', -0.06 + i * 0.06, h.headY + 0.15, -0.05, -0.3 + i * 0.3);
        k.cone(0.02, 0.06, 'bone', -0.04, h.headY - 0.04, 0.1, -0.3); k.cone(0.02, 0.06, 'bone', 0.04, h.headY - 0.04, 0.1, -0.3);
    },
    brutes(k) {
        const h = humanoid(k, { h: 1.3, w: 1.8, body: 'leather', skin: 'stone', head: 0.85, handR: [0.42, 0.6, 0.2] });
        k.sph(0.32, 'stone', 0, 0.72, 0.06, 1, 0.9, 0.95);
        k.box(0.52, 0.12, 0.38, 'team', 0, 0.47, 0);
        k.limb([0.42, 0.55, 0.2], [0.5, 1.4, 0.35], 0.04, 'wood', 0.11);
        for (let i = 0; i < 5; i++) k.cone(0.025, 0.08, 'iron', 0.5 + Math.cos(i) * 0.1, 1.25 + i * 0.03, 0.35 + Math.sin(i) * 0.1, Math.cos(i), 0, Math.sin(i));
        void h;
    },
    grubnak(k) {
        const h = humanoid(k, { h: 1.3, w: 1.6, body: 'team', skin: 'goblin', head: 1.5, handR: [0.38, 0.7, 0.2] });
        k.cone(0.07, 0.4, 'goblin', -0.3, h.headY + 0.05, 0, 0, 0, 1.2);
        k.cone(0.07, 0.4, 'goblin', 0.3, h.headY + 0.05, 0, 0, 0, -1.2);
        k.cone(0.05, 0.14, 'goblin', 0, h.headY - 0.02, 0.22, Math.PI / 2);
        k.cyl(0.14, 0.15, 0.1, 'gold', 0, h.headY + 0.2, 0, 0, 0, 0, 12);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.cone(0.03, 0.12, 'gold', Math.cos(a) * 0.13, h.headY + 0.3, Math.sin(a) * 0.13); }
        k.sph(0.03, 'eye', -0.07, h.headY + 0.05, 0.15); k.sph(0.03, 'eye', 0.07, h.headY + 0.05, 0.15);
        k.shape([[-0.32, 0], [0.32, 0], [0.42, -0.95], [-0.42, -0.95]], 'red', 0, h.sh + 0.05, -0.18, 0.12);
        k.box(0.06, 0.7, 0.24, 'iron', 0.42, 1.0, 0.32, 0.3);
        k.box(0.04, 0.14, 0.04, 'wood', 0.38, 0.66, 0.22, 0.3);
    },
    zombies(k) {
        const h = humanoid(k, { body: 'bog', skin: 'pale', hunch: 0.6, handL: [-0.12, 0.72, 0.45], handR: [0.12, 0.7, 0.45], legs: 'bog' });
        k.sph(0.025, 'eye', -0.04, h.headY + 0.02, h.headZ + 0.1); k.sph(0.025, 'eye', 0.04, h.headY, h.headZ + 0.1);
    },
    ghouls(k) {
        const h = humanoid(k, { h: 0.85, w: 0.85, body: 'pale', skin: 'pale', hunch: 1, legs: 'pale', handL: [-0.2, 0.35, 0.35], handR: [0.2, 0.32, 0.38] });
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.cone(0.012, 0.09, 'bone', s * (0.18 + i * 0.02), 0.28, 0.42, Math.PI / 2 + 0.6);
        k.sph(0.025, 'eye', -0.04, h.headY + 0.02, h.headZ + 0.1); k.sph(0.025, 'eye', 0.04, h.headY + 0.02, h.headZ + 0.1);
    },
    cultists(k) {
        const h = humanoid(k, { robe: 'team', arms: 'team', handR: [0.16, 0.58, 0.2], handL: [-0.14, 0.56, 0.2] });
        k.cone(0.16, 0.34, 'team', 0, h.headY + 0.04, -0.02);
        k.sph(0.09, 'shadow', 0, h.headY - 0.02, 0.05);
        k.sph(0.018, 'eye', -0.03, h.headY, 0.12); k.sph(0.018, 'eye', 0.03, h.headY, 0.12);
        k.cyl(0.03, 0.03, 0.12, 'cream', 0.16, 0.66, 0.2);
        k.cone(0.015, 0.05, 'fire', 0.16, 0.75, 0.2);
    },
    lizards(k) {
        const h = humanoid(k, { body: 'moss', skin: 'moss', legs: 'moss', head: 0.9, handR: [0.2, 0.55, 0.2] });
        k.box(0.1, 0.08, 0.2, 'moss', 0, h.headY - 0.02, 0.12);
        for (let i = 0; i < 4; i++) k.cone(0.02, 0.06, 'ember', 0, h.headY + 0.08 - i * 0.05, -0.05 - i * 0.04, -0.8);
        k.limb([0, 0.45, -0.1], [0, 0.08, -0.6], 0.07, 'moss', 0.02);
        k.limb([0.2, 0.1, -0.2], [0.18, 1.2, 0.35], 0.015, 'wood');
        k.cone(0.035, 0.12, 'bone', 0.18, 1.27, 0.38, 0.4);
        k.cyl(0.16, 0.16, 0.03, 'team', -0.26, 0.55, 0.12, 0, 0, Math.PI / 2, 10);
    },
    spiders(k) {
        k.sph(0.22, 'shadow', 0, 0.35, -0.22, 1, 0.85, 1.15);
        k.sph(0.14, 'shadow', 0, 0.3, 0.1);
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
            const z = 0.15 - i * 0.12;
            k.limb([s * 0.08, 0.32, z], [s * 0.36, 0.52, z + (1.5 - i) * 0.05], 0.022, 'shadow');
            k.limb([s * 0.36, 0.52, z + (1.5 - i) * 0.05], [s * 0.5, 0.04, z + (1.5 - i) * 0.12], 0.018, 'shadow', 0.01);
        }
        for (const x of [-0.05, -0.02, 0.02, 0.05]) k.sph(0.02, 'eye', x, 0.36, 0.22);
        k.box(0.14, 0.04, 0.14, 'team', 0, 0.43, -0.2);
    },
    wraiths(k) {
        k.lathe([[0.001, 0.15], [0.28, 0.1], [0.22, 0.4], [0.16, 0.75], [0.12, 0.95], [0.001, 1.0]], 'shadow', 0, 0.1, 0);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.cone(0.06, 0.2, 'shadow', Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22, Math.PI); }
        k.cone(0.16, 0.3, 'shadow', 0, 1.05, -0.02);
        k.sph(0.025, 'eye', -0.04, 1.0, 0.11); k.sph(0.025, 'eye', 0.04, 1.0, 0.11);
        k.limb([-0.14, 0.82, 0], [-0.25, 0.6, 0.3], 0.04, 'shadow', 0.015); k.limb([0.14, 0.82, 0], [0.25, 0.62, 0.3], 0.04, 'shadow', 0.015);
        k.cyl(0.18, 0.18, 0.03, 'team', 0, 0.5, 0, 0, 0, 0, 12);
    },
    trolls(k) {
        const h = humanoid(k, { h: 1.35, w: 1.3, body: 'team', skin: 'moss', legs: 'moss', hunch: 0.6, arms: 'moss', head: 1.1, handL: [-0.34, 0.12, 0.3], handR: [0.34, 0.12, 0.3] });
        k.cone(0.04, 0.18, 'moss', 0, h.headY - 0.02, h.headZ + 0.16, Math.PI / 2 + 0.3);
        k.sph(0.025, 'eye', -0.05, h.headY + 0.04, h.headZ + 0.1); k.sph(0.025, 'eye', 0.05, h.headY + 0.04, h.headZ + 0.1);
        for (let i = 0; i < 4; i++) k.cone(0.04, 0.12, 'leaf', -0.1 + i * 0.07, h.headY + 0.1, h.headZ - 0.06, -0.4);
    },
    basilisks(k) {
        k.sph(0.22, 'moss', 0, 0.3, 0, 1, 0.75, 2.4);
        for (const z of [0.3, 0, -0.3]) for (const s of [-1, 1]) k.limb([s * 0.15, 0.28, z], [s * 0.34, 0.04, z + 0.05], 0.045, 'moss', 0.03);
        k.box(0.22, 0.14, 0.28, 'moss', 0, 0.36, 0.62);
        k.sph(0.05, 'eye', -0.08, 0.42, 0.72); k.sph(0.05, 'eye', 0.08, 0.42, 0.72);
        for (let i = 0; i < 6; i++) k.cone(0.04, 0.16, 'team', 0, 0.48, 0.45 - i * 0.18, -0.3);
        k.limb([0, 0.28, -0.5], [0.1, 0.1, -1.0], 0.1, 'moss', 0.02);
    },
    murkwater(k) {
        const h = humanoid(k, { h: 1.25, robe: 'bog', skin: 'moss', hunch: 0.7, arms: 'bog', handR: [0.3, 0.75, 0.25], head: 1.2 });
        k.cone(0.04, 0.2, 'moss', 0, h.headY - 0.04, h.headZ + 0.2, Math.PI / 2 + 0.6);
        k.cyl(0.3, 0.3, 0.02, 'team', 0, h.headY + 0.1, h.headZ, 0.2, 0, 0, 16);
        k.cone(0.15, 0.5, 'team', 0, h.headY + 0.34, h.headZ - 0.08, -0.5);
        k.limb([0.3, 0.05, 0.25], [0.3, 1.5, 0.25], 0.025, 'bark');
        k.sph(0.08, 'eye', 0.3, 1.55, 0.25);
        k.lathe([[0.001, 0], [0.22, 0.02], [0.27, 0.15], [0.22, 0.3], [0.2, 0.31]], 'iron', -0.45, 0, 0.35);
        k.sph(0.18, 'leaf', -0.45, 0.28, 0.35, 1, 0.3, 1);
    },
    hellhounds(k) {
        const q = quadruped(k, { len: 0.9, hgt: 0.45, m: 'shadow', r: 0.16 });
        wolfHead(k, q.headPos, 'shadow', 1.05);
        k.sph(0.025, 'fire', q.headPos[0] - 0.05, q.headPos[1] + 0.03, q.headPos[2] + 0.1); k.sph(0.025, 'fire', q.headPos[0] + 0.05, q.headPos[1] + 0.03, q.headPos[2] + 0.1);
        for (let i = 0; i < 5; i++) k.cone(0.05, 0.2, 'fire', 0, q.hgt + 0.18, 0.3 - i * 0.14, -0.4);
        k.limb(q.tail, [0, q.hgt + 0.15, -0.65], 0.04, 'fire', 0.02);
    },
    gargoyles(k) {
        const h = humanoid(k, { h: 0.9, w: 1.2, body: 'stone', skin: 'stone', legs: 'stone', arms: 'stone', hunch: 0.8, handL: [-0.22, 0.3, 0.3], handR: [0.22, 0.3, 0.3] });
        k.cone(0.03, 0.16, 'stone', -0.07, h.headY + 0.12, h.headZ - 0.02, -0.5); k.cone(0.03, 0.16, 'stone', 0.07, h.headY + 0.12, h.headZ - 0.02, -0.5);
        wings(k, 'stone', 0.75, 0.6, -0.12, 0.7, false);
        k.limb([0, 0.42, -0.1], [0, 0.1, -0.45], 0.04, 'stone', 0.02);
        k.sph(0.022, 'fire', -0.04, h.headY + 0.02, h.headZ + 0.1); k.sph(0.022, 'fire', 0.04, h.headY + 0.02, h.headZ + 0.1);
    },
    minotaurs(k) {
        const h = humanoid(k, { h: 1.3, w: 1.5, body: 'team', skin: 'darkfur', legs: 'darkfur', arms: 'darkfur', head: 0.01, handR: [0.38, 0.75, 0.2], handL: [-0.3, 0.75, 0.25] });
        k.box(0.22, 0.24, 0.26, 'darkfur', 0, h.headY, 0.04);
        k.box(0.14, 0.12, 0.12, 'darkfur', 0, h.headY - 0.06, 0.18);
        k.limb([-0.1, h.headY + 0.08, 0], [-0.32, h.headY + 0.22, 0.05], 0.035, 'bone', 0.012);
        k.limb([0.1, h.headY + 0.08, 0], [0.32, h.headY + 0.22, 0.05], 0.035, 'bone', 0.012);
        k.tor(0.04, 0.012, 'gold', 0, h.headY - 0.1, 0.25, 0, 0, 0);
        k.limb([-0.3, 0.75, 0.25], [0.45, 1.5, 0.15], 0.025, 'wood');
        k.shape([[0, 0], [0.26, 0.12], [0.26, -0.22], [0, -0.1]], 'iron', 0.43, 1.45, 0.16, 0, -Math.PI / 2 + 0.4);
        k.shape([[0, 0], [-0.26, 0.12], [-0.26, -0.22], [0, -0.1]], 'iron', 0.43, 1.45, 0.16, 0, -Math.PI / 2 + 0.4);
    },
    salamanders(k) {
        for (let i = 0; i < 7; i++) { const a = i * 0.7; k.sph(0.13 - i * 0.012, 'fire', Math.sin(a) * 0.25, 0.12 + i * 0.01, -0.1 - Math.cos(a) * 0.2 + i * 0.02); }
        k.lathe([[0.001, 0], [0.13, 0], [0.15, 0.2], [0.11, 0.42], [0.001, 0.44]], 'ember', 0, 0.15, 0.1);
        k.box(0.12, 0.1, 0.2, 'fire', 0, 0.7, 0.18);
        k.sph(0.022, 'eye', -0.04, 0.73, 0.27); k.sph(0.022, 'eye', 0.04, 0.73, 0.27);
        for (let i = 0; i < 4; i++) k.cone(0.03, 0.14, 'gold', 0, 0.78 - i * 0.04, 0.1 - i * 0.07, -0.6);
        k.limb([0.15, 0.4, 0.15], [0.2, 1.1, 0.4], 0.015, 'iron');
        k.cone(0.04, 0.12, 'gold', 0.2, 1.15, 0.43, 0.4);
    },
    giants(k) {
        const h = humanoid(k, { h: 1.5, w: 1.8, body: 'team', skin: 'ember', legs: 'iron', arms: 'ember', handR: [0.45, 0.8, 0.25] });
        for (let i = 0; i < 6; i++) k.cone(0.06, 0.3, 'fire', -0.12 + i * 0.05, h.headY - 0.22, 0.1, Math.PI + (i - 2.5) * 0.15);
        for (let i = 0; i < 5; i++) k.cone(0.05, 0.22, 'fire', -0.1 + i * 0.05, h.headY + 0.14, -0.02, -0.2);
        k.box(0.05, 1.0, 0.12, 'iron', 0.46, 1.3, 0.3, 0.2);
        k.box(0.28, 0.04, 0.06, 'gold', 0.46, 0.8, 0.22, 0.2);
        k.sph(0.13, 'iron', -0.3, h.sh + 0.03, 0, 1, 0.7, 1); k.sph(0.13, 'iron', 0.3, h.sh + 0.03, 0, 1, 0.7, 1);
    },
    gloomeye(k) {
        k.sph(0.45, 'purple', 0, 1.0, 0, 1, 1, 1, 16);
        k.sph(0.2, 'white', 0, 1.05, 0.32, 1, 1, 0.6);
        k.sph(0.09, 'shadow', 0, 1.05, 0.44, 1, 1, 0.5);
        k.box(0.42, 0.06, 0.1, 'shadow', 0, 0.78, 0.36);
        for (let i = 0; i < 6; i++) k.cone(0.025, 0.06, 'bone', -0.16 + i * 0.064, 0.82, 0.4, Math.PI);
        for (let i = 0; i < 7; i++) {
            const a = -1.2 + i * 0.4;
            const top = [Math.sin(a) * 0.55, 1.65 + Math.cos(i) * 0.1, -0.1 + Math.cos(a) * 0.1];
            k.limb([Math.sin(a) * 0.2, 1.38, -0.05], top, 0.025, 'purple', 0.015);
            k.sph(0.05, 'eye', ...top);
        }
        k.cyl(0.25, 0.3, 0.03, 'team', 0, 0.05, 0, 0, 0, 0, 14);
    },
    ashmaw(k) { dragon(k, { m: 'red', s: 1.25, wing: 'ember', horn: 'bone' }); },
};

/** How big each stands, and how many figures make a full stack. */
export const FIGURE = {
    pikemen: [0.65, 3], bowmen: [0.65, 3], wolves: [0.74, 3], dwarves: [0.71, 3], mages: [0.68, 3], griffins: [0.81, 2],
    knights: [0.78, 2], ogres: [0.85, 2], oaks: [0.96, 1], moonhorns: [0.85, 2], drakes: [1.08, 1], wyrm: [1.24, 1],
    goblins: [0.65, 3], slingers: [0.65, 3], skeletons: [0.65, 3], worgs: [0.74, 3], bandits: [0.65, 3], orcs: [0.68, 3],
    shamans: [0.68, 2], brutes: [0.9, 2], grubnak: [1.32, 1], zombies: [0.65, 3], ghouls: [0.68, 3], cultists: [0.65, 3],
    lizards: [0.68, 3], spiders: [0.74, 2], wraiths: [0.71, 2], trolls: [0.87, 2], basilisks: [0.9, 1], murkwater: [1.24, 1],
    hellhounds: [0.74, 3], gargoyles: [0.74, 2], minotaurs: [0.87, 2], salamanders: [0.78, 2], giants: [1.05, 1], gloomeye: [1.08, 1],
    ashmaw: [1.47, 1],
};

const cache = new Map();
/** One miniature (cached by key and team; clone the result to place it). */
export function figure(key, team) {
    const k = `${key}:${team}`;
    if (!cache.has(k)) {
        const kit = new Kit(team);
        (B[key] || B.goblins)(kit);
        kit.base(FIGURE[key]?.[1] === 1 ? 0.5 : 0.42);
        cache.set(k, kit.build());
    }
    return cache.get(k).clone();
}

export const hasModel = (key) => !!B[key];

// ------------------------------------------------------------------ scenery
export function tree(rng, kind = 0) {
    const k = new Kit('p');
    if (kind === 0) {           // a pine
        k.cyl(0.05, 0.08, 0.5, 'bark', 0, 0.25, 0);
        for (let i = 0; i < 3; i++) k.cone(0.42 - i * 0.1, 0.55, 'leaf', 0, 0.55 + i * 0.32, 0, 0, rng() * 2, 0, 7);
    } else {                    // a round oak
        k.cyl(0.07, 0.11, 0.7, 'bark', 0, 0.35, 0, 0, 0, 0, 7);
        k.sph(0.45, 'leaf', 0, 1.0, 0, 1, 0.8, 1, 9);
        k.sph(0.3, 'leaf', 0.25, 0.85, 0.1, 1, 0.8, 1, 8);
    }
    return k.build();
}

export function rock(rng, big = 1) {
    const k = new Kit('p');
    const g = new THREE.DodecahedronGeometry(0.35 * big, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + rng() * 0.4), pos.getY(i) * (0.6 + rng() * 0.3), pos.getZ(i) * (0.8 + rng() * 0.4));
    g.computeVertexNormals();
    k.add(g, 'stone', 0, 0.16 * big, 0, 0, rng() * 3);
    if (rng() < 0.6) k.add(new THREE.DodecahedronGeometry(0.16 * big, 0), 'stone', 0.28 * big, 0.08, 0.1, rng(), rng());
    return k.build();
}

export function standingStone(rng) {
    const k = new Kit('p');
    k.box(0.3, 1.1 + rng() * 0.4, 0.2, 'stone', 0, 0.6, 0, (rng() - 0.5) * 0.15, rng() * 3, (rng() - 0.5) * 0.15);
    return k.build();
}

export function ruin(rng) {
    const k = new Kit('p');
    for (let i = 0; i < 4; i++) k.box(0.36, 0.22, 0.24, 'stone', i * 0.38 - 0.6, 0.11 + (i % 2) * 0.0, 0, 0, (rng() - 0.5) * 0.1);
    for (let i = 0; i < 2; i++) k.box(0.36, 0.22, 0.24, 'stone', i * 0.38 - 0.4, 0.33, 0);
    k.box(0.36, 0.22, 0.24, 'stone', -0.2, 0.55, 0);
    return k.build();
}

export function tent(teamColor = 'team') {
    const k = new Kit('p');
    k.cone(0.7, 0.9, teamColor, 0, 0.45, 0, 0, 0, 0, 6);
    k.limb([0, 0.85, 0], [0, 1.3, 0], 0.02, 'wood');
    k.shape([[0, 0], [0.3, -0.07], [0, -0.16]], 'gold', 0, 1.28, 0, 0, 0, 0);
    return k.build();
}

export function disposeTree(o) {
    o.traverse((c) => { if (c.isMesh && c.geometry && !c.userData.shared) c.geometry.dispose?.(); });
}
