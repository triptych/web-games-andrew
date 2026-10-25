// Procedural models: dragons of four body plans (wyvern, drake, serpent, wyrm) built from a species'
// `look`, tamers and soldiers of the Chain, horses, hounds, ballistas, pylons and eggs. Toon shaded
// with ink outlines; big flash-cartoon eyes. Everything faces +z with its feet on y = 0.
//
// Each model is a Group with userData: rig (the part to turn), anim(t, k) for idle life and attack
// poses, jaw, wings, mats (the materials to grey out when spent), hpAt (where the HP badge sits).

import * as THREE from 'three';
import { SPECIES } from '../sim/data.js';
import { toonOwn, inked, ink, shade, ramp } from './paint.js';

const SPHERE = new THREE.SphereGeometry(1, 18, 14);
const SPHERE_LO = new THREE.SphereGeometry(1, 10, 8);
const CONE = new THREE.ConeGeometry(1, 1, 10, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TORUS = new THREE.TorusGeometry(1, 0.28, 6, 14);
const OCTA = new THREE.OctahedronGeometry(1, 0);

export const TEAM_COLORS = { p: 0x3a8cff, e: 0xe8423a, chained: 0x9a5aff };

/** A builder that remembers every material it hands out, so the whole model can be tinted. */
class Kit {
    constructor() { this.mats = []; this.cache = new Map(); }
    m(color, o = {}) {
        const key = color + JSON.stringify(o);
        if (this.cache.has(key)) return this.cache.get(key);
        const mat = toonOwn(color, o);
        mat.userData.base = mat.color.clone();
        mat.userData.baseE = mat.emissive.clone();
        mat.userData.baseEI = mat.emissiveIntensity;
        this.mats.push(mat);
        this.cache.set(key, mat);
        return mat;
    }
    ell(parent, rx, ry, rz, mat, pos = [0, 0, 0], w = 0.022, lo = false) {
        const s = (rx + ry + rz) / 3;
        const mesh = inked(lo ? SPHERE_LO : SPHERE, mat, w > 0 ? w / s : 0);
        mesh.scale.set(rx, ry, rz);
        mesh.position.set(...pos);
        parent.add(mesh);
        return mesh;
    }
    cone(parent, r, h, mat, pos = [0, 0, 0], rot = [0, 0, 0], w = 0.015) {
        const mesh = inked(CONE, mat, w > 0 ? w / Math.max(r, 0.02) * 0.5 : 0);
        mesh.scale.set(r, h, r);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        parent.add(mesh);
        return mesh;
    }
    cyl(parent, r, h, mat, pos = [0, 0, 0], rot = [0, 0, 0], w = 0.012) {
        const mesh = inked(CYL, mat, w > 0 ? w / Math.max(r, 0.02) * 0.5 : 0);
        mesh.scale.set(r, h, r);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        parent.add(mesh);
        return mesh;
    }
    box(parent, x, y, z, mat, pos = [0, 0, 0], rot = [0, 0, 0], w = 0.012) {
        const mesh = inked(BOX, mat, w > 0 ? w / Math.min(x, y, z) * 0.6 : 0);
        mesh.scale.set(x, y, z);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        parent.add(mesh);
        return mesh;
    }
}

function hueShift(hex, h) { return h ? shade(hex, 0, 0, h) : new THREE.Color(hex).getHex(); }

// ------------------------------------------------------------------ wings
function wingShape(L) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.45 * L, -0.22 * L, L, -0.06 * L);
    s.quadraticCurveTo(0.9 * L, 0.18 * L, 0.84 * L, 0.32 * L);
    s.quadraticCurveTo(0.74 * L, 0.2 * L, 0.62 * L, 0.2 * L);
    s.quadraticCurveTo(0.56 * L, 0.38 * L, 0.48 * L, 0.48 * L);
    s.quadraticCurveTo(0.4 * L, 0.3 * L, 0.3 * L, 0.3 * L);
    s.quadraticCurveTo(0.22 * L, 0.5 * L, 0.12 * L, 0.52 * L);
    s.quadraticCurveTo(0.05 * L, 0.3 * L, 0, 0.28 * L);
    s.closePath();
    return s;
}
const WING_GEO = new Map();
function wingGeo(L, feathers) {
    const key = L.toFixed(2) + feathers;
    if (!WING_GEO.has(key)) {
        const g = new THREE.ShapeGeometry(wingShape(L), 8);
        g.rotateX(-Math.PI / 2);
        WING_GEO.set(key, g);
    }
    return WING_GEO.get(key);
}

function addWings(K, parent, L, at, mats, feathers = false) {
    const wings = [];
    for (const side of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set(at[0] * side, at[1], at[2]);
        parent.add(pivot);
        const holder = new THREE.Group();
        holder.scale.x = side;
        pivot.add(holder);
        const mem = new THREE.Mesh(wingGeo(L, feathers), mats.membrane);
        mem.rotation.z = 0.08;
        holder.add(mem);
        // the leading edge: an arm bone with a claw
        const arm = K.cyl(holder, 0.022, L * 1.0, mats.body, [L * 0.5, 0.01, -0.03], [0, 0, Math.PI / 2], 0.012);
        arm.rotation.y = 0.12;
        K.cone(holder, 0.025, 0.07, mats.horn, [L * 1.0, 0.02, -0.06], [0, 0, -Math.PI / 2], 0);
        if (feathers) for (let i = 0; i < 5; i++) K.ell(holder, 0.05, 0.012, 0.13, mats.accent, [L * (0.2 + i * 0.17), 0.01, 0.4 * L - i * 0.03], 0, true);
        pivot.userData.side = side;
        wings.push(pivot);
    }
    return wings;
}

// ------------------------------------------------------------------ dragons
const PLANS = {
    wyvern:  { body: [0.2, 0.19, 0.3], y: 0.48, neck: 3, neckLen: 0.24, head: 0.9, legs: 2, legLen: 0.3, tail: 7, tailR: 0.12, wingL: 0.62 },
    drake:   { body: [0.3, 0.25, 0.38], y: 0.38, neck: 2, neckLen: 0.16, head: 1.05, legs: 4, legLen: 0.26, tail: 6, tailR: 0.16, wingL: 0.4 },
    wyrm:    { body: [0.3, 0.27, 0.44], y: 0.48, neck: 4, neckLen: 0.34, head: 1.05, legs: 4, legLen: 0.32, tail: 8, tailR: 0.16, wingL: 0.72 },
    serpent: { body: [0.17, 0.17, 0.17], y: 0.2, neck: 3, neckLen: 0.3, head: 0.95, legs: 0, legLen: 0, tail: 7, tailR: 0.16, wingL: 0.3 },
};

/**
 * Build a dragon. look = a species look; o: { cls, hue, gilded, chained, team, size }.
 */
export function makeDragon(look, o = {}) {
    const K = new Kit();
    const cls = o.cls || 'drake';
    const P = PLANS[cls] || PLANS.drake;
    const hue = o.hue || 0;
    const gild = !!o.gilded;
    const bodyC = hueShift(look.body, hue);
    const mats = {
        body: K.m(bodyC),
        belly: K.m(hueShift(look.belly, hue * 0.5)),
        accent: K.m(gild ? 0xffcc33 : hueShift(look.accent, hue), gild ? { emissive: 0xff9a00, ei: 0.35 } : {}),
        horn: K.m(gild ? 0xffe27a : 0xf2e6c8),
        eye: K.m(0xffffff),
        pupil: K.m(o.chained ? 0x9a3aff : 0x1a1020, o.chained ? { emissive: 0x8a2aff, ei: 0.8 } : {}),
        membrane: K.m(shade(look.accent === '#ffffff' ? look.body : look.accent, 0.08, -0.1), { side: THREE.DoubleSide }),
        glow: K.m(hueShift(look.accent, hue), { emissive: hueShift(look.accent, hue), ei: 0.9 }),
        iron: K.m(0x4a4a58),
    };
    mats.membrane.transparent = true; mats.membrane.opacity = 0.92;
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const bodyG = new THREE.Group();
    bodyG.position.y = P.y;
    rig.add(bodyG);

    let neckBase, chestZ;
    const tailSegs = [];
    if (cls === 'serpent') {
        // a coiled body: a chain of spheres winding back
        for (let i = 0; i < 6; i++) {
            const r = 0.17 - i * 0.012;
            const z = 0.2 - i * 0.17, x = Math.sin(i * 1.3) * 0.12;
            K.ell(bodyG, r, r * 0.95, r * 1.1, mats.body, [x, -0.02 + (i === 0 ? 0.08 : 0), z]);
            K.ell(bodyG, r * 0.8, r * 0.6, r * 0.9, mats.belly, [x, -0.07, z + 0.02], 0);
            if (look.frill && i < 5) K.cone(bodyG, 0.05, 0.16, mats.accent, [x, r + 0.03, z], [-0.5, 0, 0], 0.01);
        }
        neckBase = [0, 0.12, 0.26];
        chestZ = 0.26;
    } else {
        const [bx, by, bz] = P.body;
        K.ell(bodyG, bx, by, bz, mats.body, [0, 0, 0], 0.025);
        K.ell(bodyG, bx * 0.82, by * 0.72, bz * 0.86, mats.belly, [0, -by * 0.3, bz * 0.12], 0);
        neckBase = [0, by * 0.55, bz * 0.75];
        chestZ = bz;
        // back features along the spine
        const spine = (n, f) => { for (let i = 0; i < n; i++) { const t = i / (n - 1); f(-bz * 0.7 + t * bz * 1.3, by * (0.92 - Math.abs(t - 0.5) * 0.3), i, t); } };
        if (look.plates) spine(5, (z, y, i) => K.cone(bodyG, 0.07, 0.16, look.glow ? mats.glow : mats.accent, [0, y, z], [-0.3, 0, 0], 0.012));
        if (look.spikes) spine(6, (z, y, i) => { for (const s of [-1, 1]) K.cone(bodyG, 0.035, 0.14, mats.accent, [s * bx * 0.5, y * 0.85, z], [-0.4, 0, s * 0.6], 0.01); });
        if (look.crystals) spine(4, (z, y, i) => { const c = inked(OCTA, mats.glow, 0.15); c.scale.set(0.06, 0.13, 0.06); c.position.set((i % 2 ? 1 : -1) * 0.06, y + 0.04, z); c.rotation.z = (i % 2 ? 1 : -1) * 0.3; bodyG.add(c); });
        if (look.leaves) spine(5, (z, y, i) => { K.ell(bodyG, 0.08, 0.025, 0.12, mats.belly, [0, y + 0.01, z], 0.01, true).rotation.z = i * 0.7; if (i % 2 === 0) K.ell(bodyG, 0.045, 0.045, 0.045, mats.accent, [0.05, y + 0.04, z], 0.01, true); });
        if (!look.plates && !look.spikes && !look.crystals && !look.leaves) spine(4, (z, y) => K.cone(bodyG, 0.035, 0.09, mats.accent, [0, y, z], [-0.5, 0, 0], 0.01));
        if (look.feathers) for (const s of [-1, 1]) K.ell(bodyG, 0.05, 0.03, 0.14, mats.accent, [s * bx * 0.6, by * 0.4, -bz * 0.2], 0.01, true);
        if (look.glow) for (const s of [-1, 1]) K.ell(bodyG, 0.03, 0.03, 0.03, mats.glow, [s * bx * 0.9, 0, 0.05], 0, true);
    }

    // neck
    const neck = new THREE.Group();
    neck.position.set(...neckBase);
    bodyG.add(neck);
    const nr = cls === 'serpent' ? 0.13 : P.body[0] * 0.5;
    for (let i = 0; i < P.neck; i++) {
        const t = (i + 1) / (P.neck + 1);
        K.ell(neck, nr * (1 - t * 0.35), nr * (1 - t * 0.3), nr * 1.1, mats.body, [0, t * P.neckLen * 1.1, t * P.neckLen * 0.6]);
    }
    if (o.chained) {
        const collar = inked(TORUS, mats.iron, 0.1);
        collar.scale.setScalar(nr * 1.05);
        collar.position.set(0, P.neckLen * 0.25, P.neckLen * 0.15);
        collar.rotation.x = Math.PI / 2 - 0.5;
        neck.add(collar);
        for (let i = 0; i < 4; i++) {
            const link = new THREE.Mesh(TORUS, mats.iron);
            link.scale.setScalar(0.035);
            link.position.set(nr * 0.9, P.neckLen * 0.2 - 0.05 - i * 0.055, P.neckLen * 0.1);
            link.rotation.y = i % 2 ? Math.PI / 2 : 0;
            neck.add(link);
        }
    }

    // head
    const head = new THREE.Group();
    const hs = 0.15 * P.head;
    head.position.set(0, P.neckLen * 1.12, P.neckLen * 0.7 + 0.02);
    neck.add(head);
    K.ell(head, hs * 1.0, hs * 0.88, hs * 1.0, mats.body, [0, 0, 0], 0.024);
    K.ell(head, hs * 0.72, hs * 0.52, hs * 0.9, mats.body, [0, -hs * 0.18, hs * 0.85], 0.02);
    K.ell(head, hs * 0.2, hs * 0.14, hs * 0.14, mats.belly, [hs * 0.35, -hs * 0.05, hs * 1.6], 0, true);
    K.ell(head, hs * 0.2, hs * 0.14, hs * 0.14, mats.belly, [-hs * 0.35, -hs * 0.05, hs * 1.6], 0, true);
    const jaw = new THREE.Group();
    jaw.position.set(0, -hs * 0.42, hs * 0.2);
    head.add(jaw);
    K.ell(jaw, hs * 0.6, hs * 0.22, hs * 0.85, mats.belly, [0, -hs * 0.05, hs * 0.6], 0.018);
    // big friendly eyes
    for (const s of [-1, 1]) {
        K.ell(head, hs * 0.38, hs * 0.42, hs * 0.3, mats.eye, [s * hs * 0.52, hs * 0.22, hs * 0.55], 0.014);
        K.ell(head, hs * 0.18, hs * 0.24, hs * 0.12, mats.pupil, [s * hs * 0.6, hs * 0.22, hs * 0.78], 0, true);
        K.ell(head, hs * 0.07, hs * 0.07, hs * 0.04, mats.eye, [s * hs * 0.55, hs * 0.32, hs * 0.86], 0, true);
    }
    // horns
    const nh = look.bighorn ? 0 : look.horns || 0;
    for (let i = 0; i < nh; i++) {
        const pair = Math.floor(i / 2), s = i % 2 ? -1 : 1;
        if (nh % 2 === 1 && i === nh - 1) { K.cone(head, hs * 0.16, hs * 0.9, mats.horn, [0, hs * 0.9, -hs * 0.1], [-0.6, 0, 0]); continue; }
        K.cone(head, hs * (0.17 - pair * 0.03), hs * (1.0 - pair * 0.25), mats.horn, [s * hs * (0.45 + pair * 0.2), hs * (0.7 - pair * 0.25), -hs * (0.35 + pair * 0.25)], [-1.0 - pair * 0.2, 0, s * (0.35 + pair * 0.25)]);
    }
    if (look.bighorn) K.cone(head, hs * 0.2, hs * 1.4, mats.accent, [0, hs * 0.75, hs * 0.55], [0.45, 0, 0]);
    if (look.frill) for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 2.2;
        K.cone(head, hs * 0.16, hs * 0.75, mats.accent, [Math.sin(a) * hs * 0.75, hs * 0.2 + Math.cos(a) * hs * 0.45, -hs * 0.6], [-1.3, 0, -a * 0.9], 0.01);
    }
    if (look.leaves) K.ell(head, hs * 0.22, hs * 0.22, hs * 0.22, mats.accent, [hs * 0.4, hs * 0.85, -hs * 0.1], 0.01, true);

    // legs
    const legs = [];
    if (P.legs) {
        const [bx, , bz] = P.body;
        const spots = P.legs === 4 ? [[1, 0.55], [-1, 0.55], [1, -0.55], [-1, -0.55]] : [[1, -0.25], [-1, -0.25]];
        for (const [s, zf] of spots) {
            const leg = new THREE.Group();
            leg.position.set(s * bx * 0.72, P.y - 0.04, zf * bz);
            rig.add(leg);
            K.ell(leg, 0.075, 0.12, 0.09, mats.body, [0, -0.04, 0], 0.016);
            K.ell(leg, 0.05, P.y * 0.42, 0.05, mats.body, [0, -P.y * 0.5, 0.01], 0.012);
            K.ell(leg, 0.07, 0.04, 0.1, mats.body, [0, -P.y + 0.035, 0.04], 0.012);
            for (const c of [-1, 0, 1]) K.cone(leg, 0.014, 0.04, mats.horn, [c * 0.035, -P.y + 0.02, 0.13], [Math.PI / 2, 0, 0], 0);
            legs.push(leg);
        }
    }

    // tail: a chain of segments, each parented to the one before, so it sways like a whip
    let prev = bodyG, tz = -(cls === 'serpent' ? 0.82 : P.body[2] * 0.85);
    const tl = (look.tail || 1);
    for (let i = 0; i < P.tail; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, i === 0 ? (cls === 'serpent' ? -0.02 : -0.02) : 0, i === 0 ? tz : -0.1 * tl);
        prev.add(seg);
        const r = P.tailR * (1 - i / (P.tail + 1)) * 0.9;
        K.ell(seg, r, r * 0.9, 0.08 * tl + r * 0.4, mats.body, [0, 0, -0.04 * tl], 0.016);
        if (i % 2 === 0 && i < P.tail - 1) K.cone(seg, r * 0.35, r * 0.9, mats.accent, [0, r * 0.8, -0.04], [-0.5, 0, 0], 0.01);
        tailSegs.push(seg);
        prev = seg;
    }
    // tail tip
    if (look.frill || cls === 'serpent') {
        const fin = K.ell(prev, 0.015, 0.11, 0.12, mats.accent, [0, 0.04, -0.14], 0.012);
        fin.rotation.x = -0.4;
    } else {
        K.cone(prev, 0.07, 0.14, mats.accent, [0, 0, -0.16], [-Math.PI / 2, 0, 0], 0.014).scale.x = 0.11;
    }

    // wings
    let wings = [];
    if ((look.wing || 0) > 0) {
        const L = P.wingL * look.wing;
        wings = addWings(K, bodyG, L, [P.body[0] * 0.55, P.body[1] * 0.7, P.body[2] * 0.3], mats, !!look.feathers);
    }

    const shoulderY = P.y;
    const fold = cls === 'drake' ? 0.5 : 0.25;
    root.userData = {
        rig, head, jaw, neck, wings, tailSegs, legs, mats: K.mats, body: bodyG,
        hpAt: new THREE.Vector3(0.32, 0.05, 0.32), height: P.y + P.neckLen + 0.4, kind: 'dragon', cls,
        anim(t, k = {}) {
            const flap = k.flap ?? 0;
            const speed = 1 + flap * 5;
            const fly = cls === 'wyvern' || (cls === 'wyrm' && wings.length);
            for (const w of wings) {
                const s = w.userData.side;
                const a = fly ? Math.sin(t * 2.2 * speed) * (0.18 + flap * 0.6) + 0.15 : Math.sin(t * 1.4) * 0.05 + fold;
                w.rotation.z = s * a;
                w.rotation.y = s * (fly ? 0.1 : 0.55);
            }
            bodyG.position.y = shoulderY + (fly ? Math.sin(t * 2.2 * speed) * 0.025 + 0.02 : Math.sin(t * 1.6) * 0.008);
            tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.7 - i * 0.6) * (cls === 'serpent' ? 0.32 : 0.16); s.rotation.x = cls === 'serpent' ? 0 : 0.05; });
            head.rotation.x = (k.lunge || 0) * 0.3 + Math.sin(t * 0.9) * 0.05;
            head.rotation.y = Math.sin(t * 0.6) * 0.12;
            jaw.rotation.x = (k.roar || 0) * 0.7 + (Math.sin(t * 0.7) > 0.96 ? 0.15 : 0);
            neck.rotation.x = (k.lunge || 0) * 0.35;
            legs.forEach((l, i) => { l.rotation.x = (k.walk || 0) * Math.sin(t * 9 + i * Math.PI) * 0.45; });
        },
    };
    return root;
}

// ------------------------------------------------------------------ people
/**
 * A person, cartoon proportions (big head). o: { skin, hair, cloth, trim, armor, helm, weapon,
 * shield, cape, beard, hood, crown }.
 */
export function makeHuman(o = {}) {
    const K = new Kit();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const skin = K.m(o.skin || 0xf0c8a0), cloth = K.m(o.cloth || 0x4a8a4a), trim = K.m(o.trim || 0xe8c060);
    const armor = o.armor ? K.m(o.armor) : null, dark = K.m(0x2a2030), eye = K.m(0x1a1020), white = K.m(0xffffff);
    const body = new THREE.Group();
    rig.add(body);
    // legs
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(s * 0.06, 0.2, 0);
        body.add(leg);
        K.ell(leg, 0.045, 0.11, 0.05, armor || dark, [0, -0.09, 0], 0.012);
        K.ell(leg, 0.05, 0.03, 0.07, dark, [0, -0.19, 0.02], 0.01, true);
        legs.push(leg);
    }
    // torso and skirt
    K.ell(body, 0.12, 0.15, 0.09, armor || cloth, [0, 0.33, 0], 0.016);
    K.cone(body, 0.13, 0.16, cloth, [0, 0.21, 0], [0, 0, 0], 0.012);
    K.box(body, 0.2, 0.03, 0.12, trim, [0, 0.25, 0], [0, 0, 0], 0);
    if (o.cape) { const c = K.m(o.cape, { side: THREE.DoubleSide }); const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), c); cape.position.set(0, 0.28, -0.1); cape.rotation.x = 0.18; body.add(cape); root.userData.cape = cape; }
    // arms
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.14, 0.42, 0);
        body.add(arm);
        K.ell(arm, 0.04, 0.1, 0.04, armor || cloth, [0, -0.08, 0], 0.012);
        K.ell(arm, 0.035, 0.035, 0.035, skin, [0, -0.18, 0.01], 0.01, true);
        arms.push(arm);
    }
    // head
    const head = new THREE.Group();
    head.position.set(0, 0.56, 0);
    body.add(head);
    K.ell(head, 0.12, 0.12, 0.11, skin, [0, 0, 0], 0.018);
    for (const s of [-1, 1]) { K.ell(head, 0.028, 0.036, 0.015, white, [s * 0.045, 0.01, 0.1], 0, true); K.ell(head, 0.016, 0.022, 0.01, eye, [s * 0.045, 0.005, 0.11], 0, true); }
    if (o.beard) K.ell(head, 0.1, 0.09, 0.07, K.m(o.beard), [0, -0.08, 0.06], 0.012);
    const hair = o.hair ? K.m(o.hair) : null;
    if (o.helm === 'spike') { K.ell(head, 0.13, 0.08, 0.12, armor || dark, [0, 0.05, -0.01], 0.014); K.cone(head, 0.03, 0.12, armor || dark, [0, 0.15, 0]); K.box(head, 0.2, 0.03, 0.04, dark, [0, 0.0, 0.1], [0, 0, 0], 0); }
    else if (o.helm === 'skull') { K.ell(head, 0.14, 0.1, 0.13, K.m(0xf0e8d0), [0, 0.05, 0.01], 0.016); for (const s of [-1, 1]) K.cone(head, 0.03, 0.14, K.m(0xf0e8d0), [s * 0.1, 0.13, -0.02], [0, 0, -s * 0.6]); }
    else if (o.helm === 'knight') { K.ell(head, 0.135, 0.12, 0.13, armor || dark, [0, 0.02, 0], 0.016); K.box(head, 0.03, 0.12, 0.03, trim, [0, 0.12, 0], [0, 0, 0], 0); if (o.plume) K.ell(head, 0.03, 0.08, 0.1, K.m(o.plume), [0, 0.18, -0.03], 0.01); }
    else if (o.hood) { const h = K.m(o.hood); K.ell(head, 0.145, 0.15, 0.14, h, [0, 0.03, -0.02], 0.016); K.cone(head, 0.07, 0.2, h, [0, 0.12, -0.12], [-0.9, 0, 0]); }
    else if (hair) { K.ell(head, 0.13, 0.08, 0.12, hair, [0, 0.06, -0.015], 0.014); K.ell(head, 0.1, 0.08, 0.06, hair, [0, 0.0, -0.08], 0.012); if (o.tuft) K.cone(head, 0.04, 0.1, hair, [0.03, 0.14, 0.02], [0.4, 0, -0.4]); }
    if (o.witch) { const h = K.m(o.witch); K.cyl(head, 0.2, 0.02, h, [0, 0.08, 0]); K.cone(head, 0.1, 0.3, h, [0, 0.24, -0.02], [-0.25, 0, 0]); }
    if (o.crown) { const c = K.m(0xffd040, { emissive: 0xff9a00, ei: 0.3 }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.cone(head, 0.02, 0.07, c, [Math.sin(a) * 0.1, 0.12, Math.cos(a) * 0.1], [0, 0, 0], 0); } K.cyl(head, 0.11, 0.03, c, [0, 0.09, 0], [0, 0, 0], 0); }
    if (o.scarf) { K.cyl(head, 0.09, 0.05, K.m(o.scarf), [0, -0.12, 0], [0, 0, 0], 0.01); K.box(head, 0.05, 0.14, 0.02, K.m(o.scarf), [0.06, -0.2, -0.08], [0.3, 0, 0.2], 0); }
    // weapon in the right hand
    const hand = new THREE.Group();
    hand.position.set(0, -0.18, 0.02);
    arms[1].add(hand);
    const wood = K.m(0x8a5a30), steel = K.m(0xd8dce8);
    if (o.weapon === 'sword') { K.box(hand, 0.025, 0.28, 0.012, steel, [0, 0.14, 0.04], [0.3, 0, 0], 0.006); K.box(hand, 0.09, 0.02, 0.02, trim, [0, 0.0, 0.0], [0.3, 0, 0], 0); }
    else if (o.weapon === 'axe') { K.cyl(hand, 0.012, 0.36, wood, [0, 0.1, 0.03], [0.3, 0, 0], 0.006); K.box(hand, 0.02, 0.12, 0.12, steel, [0, 0.24, 0.09], [0.3, 0, 0], 0.008); }
    else if (o.weapon === 'lance') { K.cyl(hand, 0.016, 0.8, wood, [0, 0.1, 0.25], [1.2, 0, 0], 0.006); K.cone(hand, 0.03, 0.14, steel, [0, 0.27, 0.62], [1.2, 0, 0], 0.008); }
    else if (o.weapon === 'staff' || o.weapon === 'crook') {
        K.cyl(hand, 0.013, 0.6, wood, [0, 0.12, 0.02], [0.1, 0, 0], 0.006);
        if (o.weapon === 'crook') { const c = inked(TORUS, wood, 0.02); c.scale.setScalar(0.05); c.position.set(0, 0.44, 0.06); c.rotation.y = Math.PI / 2; hand.add(c); }
        if (o.orb) K.ell(hand, 0.05, 0.05, 0.05, K.m(o.orb, { emissive: o.orb, ei: 1.0 }), [0, 0.44, 0.05], 0.01);
    }
    if (o.shield) { const sh = K.cyl(arms[0], 0.11, 0.025, K.m(o.shield), [-0.04, -0.12, 0.06], [Math.PI / 2, 0, Math.PI / 2], 0.012); sh.rotation.order = 'YXZ'; K.cyl(arms[0], 0.04, 0.03, trim, [-0.055, -0.12, 0.06], [0, 0, Math.PI / 2], 0); }
    if (o.chains) { const ir = K.m(0x5a5a68); for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(TORUS, ir); l.scale.setScalar(0.025); const a = i / 6 * Math.PI * 2; l.position.set(Math.sin(a) * 0.13, 0.25, Math.cos(a) * 0.1); l.rotation.y = a; body.add(l); } }
    root.userData = {
        rig, head, arms, legs, body, mats: K.mats, hpAt: new THREE.Vector3(0.22, 0.05, 0.22), height: 0.75, kind: 'human',
        anim(t, k = {}) {
            body.position.y = Math.abs(Math.sin(t * 2)) * 0.008 + (k.hop || 0) * 0.08;
            arms[1].rotation.x = -(k.lunge || 0) * 1.6 + Math.sin(t * 1.5) * 0.05;
            arms[0].rotation.x = Math.sin(t * 1.5 + 1) * 0.05;
            legs.forEach((l, i) => { l.rotation.x = (k.walk || 0) * Math.sin(t * 10 + i * Math.PI) * 0.6; });
            head.rotation.y = Math.sin(t * 0.7) * 0.15;
            if (root.userData.cape) root.userData.cape.rotation.x = 0.18 + Math.sin(t * 2) * 0.05 + (k.walk || 0) * 0.3;
        },
    };
    return root;
}

/** A horse for lancers and generals. Returns the horse; the rider sits on userData.saddle. */
function makeHorse(K, color, barding) {
    const g = new THREE.Group();
    const c = K.m(color), dark = K.m(0x2a2030), bard = barding ? K.m(barding) : c;
    K.ell(g, 0.13, 0.13, 0.26, bard, [0, 0.36, 0], 0.016);
    const neck = new THREE.Group(); neck.position.set(0, 0.42, 0.2); g.add(neck);
    K.ell(neck, 0.07, 0.13, 0.08, c, [0, 0.08, 0.04], 0.014).rotation.x = 0.5;
    K.ell(neck, 0.06, 0.07, 0.13, c, [0, 0.2, 0.12], 0.014);
    K.ell(neck, 0.03, 0.08, 0.1, dark, [0, 0.2, 0.0], 0.01);
    for (const s of [-1, 1]) K.cone(neck, 0.02, 0.05, c, [s * 0.035, 0.29, 0.1], [0, 0, 0], 0.008);
    const legs = [];
    for (const [s, z] of [[1, 0.17], [-1, 0.17], [1, -0.17], [-1, -0.17]]) {
        const l = new THREE.Group(); l.position.set(s * 0.08, 0.3, z); g.add(l);
        K.ell(l, 0.035, 0.15, 0.04, c, [0, -0.13, 0], 0.01);
        K.ell(l, 0.04, 0.025, 0.045, dark, [0, -0.28, 0.01], 0.008, true);
        legs.push(l);
    }
    K.ell(g, 0.03, 0.12, 0.04, dark, [0, 0.36, -0.28], 0.01).rotation.x = -0.6;
    g.userData.legs = legs;
    g.userData.neck = neck;
    return g;
}

/** A person on a horse. */
function makeRider(humanOpts, horseColor, barding) {
    const K = new Kit();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const horse = makeHorse(K, horseColor, barding);
    rig.add(horse);
    const rider = makeHuman(humanOpts);
    rider.position.set(0, 0.32, -0.02);
    rider.scale.setScalar(0.85);
    rider.userData.legs.forEach((l) => { l.rotation.x = -1.2; l.position.x *= 1.8; });
    rig.add(rider);
    const mats = K.mats.concat(rider.userData.mats);
    root.userData = {
        rig, mats, hpAt: new THREE.Vector3(0.24, 0.05, 0.24), height: 0.95, kind: 'rider', head: rider.userData.head,
        anim(t, k = {}) {
            rider.userData.anim(t, { lunge: k.lunge });
            rider.userData.legs.forEach((l) => { l.rotation.x = -1.2; });
            horse.userData.legs.forEach((l, i) => { l.rotation.x = (k.walk || 0) * Math.sin(t * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.5 : 0)) * 0.6; });
            horse.userData.neck.rotation.x = Math.sin(t * 1.3) * 0.05 - (k.lunge || 0) * 0.2;
            horse.position.y = Math.abs(Math.sin(t * 11)) * 0.03 * (k.walk || 0);
        },
    };
    return root;
}

/** A dragon with someone on its back (Sera on Skyla, Nyxara on her night-wyvern). */
function makeDragonRider(look, cls, humanOpts, extra = {}) {
    const d = makeDragon(look, { cls, ...extra });
    const h = makeHuman(humanOpts);
    h.scale.setScalar(0.62);
    // sit astride the shoulders: the body group's origin is the middle of the body
    h.position.set(0, (PLANS[cls] || PLANS.drake).body[1] * 0.8 - 0.1, -0.02);
    h.userData.legs.forEach((l) => { l.rotation.x = -1.3; l.position.x *= 2; });
    d.userData.body.add(h);
    d.userData.mats = d.userData.mats.concat(h.userData.mats);
    const a = d.userData.anim;
    d.userData.anim = (t, k = {}) => { a(t, k); h.userData.anim(t, { lunge: k.lunge }); h.userData.legs.forEach((l) => { l.rotation.x = -1.3; }); };
    return d;
}

function makeHound() {
    const look = { body: '#3a3048', belly: '#6a5a78', accent: '#ff4a6a', horns: 0, wing: 0, tail: 0.8, spikes: true };
    const d = makeDragon(look, { cls: 'drake', chained: true });
    // ears instead of horns, a lean body
    const head = d.userData.head;
    const K = new Kit();
    const ear = K.m(0x3a3048);
    for (const s of [-1, 1]) K.cone(head, 0.04, 0.12, ear, [s * 0.08, 0.14, -0.02], [-0.2, 0, -s * 0.3]);
    d.userData.mats = d.userData.mats.concat(K.mats);
    d.userData.body.scale.set(0.8, 0.85, 1.05);
    return d;
}

function makeBallista() {
    const K = new Kit();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const wood = K.m(0x9a6a3a), dark = K.m(0x5a3a20), iron = K.m(0x4a4a58), rope = K.m(0xe8d8b0), red = K.m(0xc83a3a);
    K.box(rig, 0.46, 0.08, 0.6, wood, [0, 0.16, 0], [0, 0, 0], 0.012);
    for (const [x, z] of [[0.25, 0.2], [-0.25, 0.2], [0.25, -0.2], [-0.25, -0.2]]) K.cyl(rig, 0.1, 0.05, dark, [x, 0.1, z], [0, 0, Math.PI / 2], 0.012);
    const top = new THREE.Group(); top.position.set(0, 0.26, 0); rig.add(top);
    K.box(top, 0.08, 0.08, 0.7, wood, [0, 0.05, 0.05], [0.25, 0, 0], 0.01);
    for (const s of [-1, 1]) {
        const arm = K.box(top, 0.4, 0.05, 0.05, dark, [s * 0.2, 0.1, 0.3], [0, s * 0.35, 0], 0.008);
        void arm;
    }
    K.box(top, 0.8, 0.008, 0.008, rope, [0, 0.1, 0.18], [0, 0, 0], 0);
    const bolt = K.cyl(top, 0.015, 0.6, iron, [0, 0.13, 0.15], [Math.PI / 2 - 0.25, 0, 0], 0.006);
    K.cone(top, 0.035, 0.1, iron, [0, 0.21, 0.46], [Math.PI / 2 - 0.25, 0, 0], 0.008);
    K.box(rig, 0.02, 0.36, 0.02, dark, [0.2, 0.4, -0.25], [0, 0, 0], 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), K.m(0xc83a3a, { side: THREE.DoubleSide }));
    flag.position.set(0.28, 0.52, -0.25); rig.add(flag);
    void red;
    root.userData = {
        rig, mats: K.mats, hpAt: new THREE.Vector3(0.26, 0.05, 0.26), height: 0.6, kind: 'siege', bolt,
        anim(t, k = {}) { top.rotation.x = -(k.lunge || 0) * 0.1; flag.rotation.y = Math.sin(t * 3) * 0.3; bolt.visible = !(k.fired); },
    };
    return root;
}

function makePylon() {
    const K = new Kit();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const obs = K.m(0x2a1a3a), glow = K.m(0xb060ff, { emissive: 0xa040ff, ei: 1.2 }), iron = K.m(0x4a4a58);
    K.cyl(rig, 0.3, 0.12, obs, [0, 0.06, 0], [0, 0, 0], 0.012);
    const spike = inked(OCTA, obs, 0.04);
    spike.scale.set(0.2, 0.7, 0.2);
    spike.position.y = 0.7;
    rig.add(spike);
    const core = new THREE.Mesh(OCTA, glow);
    core.scale.set(0.09, 0.34, 0.09);
    core.position.y = 0.72;
    rig.add(core);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(TORUS, iron); r.scale.setScalar(0.18 - i * 0.03); r.position.y = 0.4 + i * 0.25; r.rotation.x = Math.PI / 2; rig.add(r); }
    root.userData = {
        rig, mats: K.mats, hpAt: new THREE.Vector3(0.3, 0.05, 0.3), height: 1.4, kind: 'structure',
        anim(t) { core.rotation.y = t; core.material.emissiveIntensity = 1 + Math.sin(t * 3) * 0.3; spike.rotation.y = t * 0.2; },
    };
    return root;
}

const PEOPLE = {
    tamer:      { skin: 0xf2c49a, hair: 0x6a3a1a, cloth: 0x3a9a5a, trim: 0xe8b040, weapon: 'crook', scarf: 0xe83a3a, tuft: true },
    brannoc:    { skin: 0xe8b890, hair: 0xe8e8e8, beard: 0xf0f0f0, cloth: 0x8a5a30, trim: 0xd8a040, weapon: 'staff', orb: 0xffb040, cape: 0x6a3a1a },
    chainknight:{ skin: 0xe8c0a0, armor: 0x8a8f9a, cloth: 0x5a2a2a, trim: 0x3a3a42, helm: 'spike', weapon: 'sword', shield: 0xb83a3a, chains: true },
    hexer:      { skin: 0xc8b8d0, cloth: 0x4a2a6a, trim: 0xa060ff, hood: 0x3a1a4a, weapon: 'staff', orb: 0xb060ff, chains: true },
    grisk:      { skin: 0xd8a080, armor: 0x6a5a4a, cloth: 0x7a2a1a, trim: 0x3a2a20, helm: 'skull', weapon: 'axe', shield: 0x8a2a1a, cape: 0x5a1a10, chains: true },
    sablethorn: { skin: 0xa8c8a0, cloth: 0x3a5a3a, trim: 0xa0ff60, witch: 0x2a3a2a, hair: 0x8a8a8a, weapon: 'staff', orb: 0x8aff5a, cape: 0x2a4a2a },
};

/**
 * The model for a battle unit (or a snapshot of one): { key, sp, team, chained, hue, gilded }.
 */
export function makeUnitModel(u) {
    let m;
    const key = u.key;
    if (SPECIES[key]) m = makeDragon(SPECIES[key].look, { cls: SPECIES[key].cls, hue: u.hue, gilded: u.gilded, chained: u.chained });
    else if (key === 'sera') m = makeDragonRider(SPECIES.tempestra.look, 'wyrm', { skin: 0xf2d0b0, hair: 0xffe08a, cloth: 0x3a6ad8, trim: 0xffffff, weapon: 'lance', cape: 0x9ad0ff });
    else if (key === 'nyxara') m = makeDragonRider({ body: '#1a1028', belly: '#4a2a6a', accent: '#ff3a8a', horns: 4, wing: 1.3, tail: 1.3, frill: true, glow: true }, 'wyvern', { skin: 0xe8d8f0, hair: 0x1a1020, cloth: 0x2a1a3a, trim: 0xff3a8a, crown: true, weapon: 'staff', orb: 0xff3a8a, cape: 0x4a0a2a });
    else if (key === 'vorthax') { m = makeDragon({ body: '#2a2238', belly: '#6a3a5a', accent: '#ff5a3a', horns: 6, wing: 1.2, tail: 1.6, frill: true, plates: true, glow: true }, { cls: 'wyrm', chained: u.team === 'e' }); m.userData.big = 1.9; }
    else if (key === 'chainhound') m = makeHound();
    else if (key === 'lancer') m = makeRider({ skin: 0xe8c0a0, armor: 0x8a8f9a, cloth: 0x5a2a2a, trim: 0x3a3a42, helm: 'knight', weapon: 'lance', plume: 0xc83a3a }, 0x6a4a3a, 0x8a2a2a);
    else if (key === 'varek' || key === 'varekally') m = makeRider({ skin: 0xd8b090, armor: 0x2a2a38, cloth: 0x1a1a24, trim: 0xc8a040, helm: 'knight', weapon: 'sword', shield: key === 'varek' ? 0x8a1a1a : 0x2a5ab8, cape: key === 'varek' ? 0x8a1a1a : 0x2a5ab8, plume: 0xe8e8e8 }, 0x1a1a1a, 0x3a3a48);
    else if (key === 'ballista') m = makeBallista();
    else if (key === 'pylon') m = makePylon();
    else m = makeHuman(PEOPLE[key] || PEOPLE.chainknight);
    if (key === 'grisk') m.scale.setScalar(1.2);
    return m;
}

/** Grey a model out (spent this turn) or bring it back. */
export function setSpent(m, on) {
    if (m.userData.spent === on) return;
    m.userData.spent = on;
    const grey = new THREE.Color(0x8a8a90);
    for (const mat of m.userData.mats) {
        if (!mat.userData.base) continue;
        mat.color.copy(mat.userData.base);
        if (on) mat.color.lerp(grey, 0.55).multiplyScalar(0.8);
        if (mat.userData.baseE) mat.emissive.copy(mat.userData.baseE).multiplyScalar(on ? 0.3 : 1);
    }
}

/** Flash a model white (hit) by k in 0..1. */
const WHITE = new THREE.Color(0xffffff);
export function setFlash(m, k) {
    for (const mat of m.userData.mats) {
        if (!mat.userData.baseE) continue;
        const b = mat.userData.baseEI ?? 0;
        mat.emissive.copy(mat.userData.baseE).lerp(WHITE, k);
        mat.emissiveIntensity = b + (1 - b) * k * 0.8;
    }
}

export function disposeTree(o) {
    o.traverse((c) => {
        if (c.material && !c.userData.ink && c.material.userData?.base) c.material.dispose?.();
    });
}

// ------------------------------------------------------------------ eggs
const EGG_GEO = (() => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16, a = t * Math.PI;
        const r = Math.sin(a) * (1 - 0.25 * Math.cos(a) * 0.6) * 0.5;
        pts.push(new THREE.Vector2(Math.max(0.0001, r), -Math.cos(a) * 0.62 - 0.0));
    }
    return new THREE.LatheGeometry(pts, 20);
})();

/** An egg in a species' colours, speckled. */
export function makeEgg(sp, { gilded = false, hue = 0 } = {}) {
    const S = SPECIES[sp];
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(hueShift(gilded ? '#ffd860' : S.look.belly, hue)).getHexString();
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#' + new THREE.Color(hueShift(S.look.body, hue)).getHexString();
    let seed = sp.length * 977;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(rnd() * 128, rnd() * 64, 2 + rnd() * 6, 2 + rnd() * 4, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#' + new THREE.Color(S.look.accent).getHexString();
    g.fillRect(0, 28, 128, 5);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp(), emissive: new THREE.Color(S.look.accent), emissiveIntensity: 0 });
    const egg = inked(EGG_GEO, mat, 0.04);
    egg.position.y = 0.62;
    const root = new THREE.Group();
    root.add(egg);
    root.userData = { egg, mat };
    return root;
}

void ink;
