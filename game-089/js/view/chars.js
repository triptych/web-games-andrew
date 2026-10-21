// Chibi adventurers built from merged, vertex-coloured primitives with toon shading, ink outlines
// and painted faces. The rig is adapted from game-063's golfers, with armour, hats and weapons.
//
//   outer ─ pivot (hops, bobs) ─ legs
//                              └ hips ─ body ─ head (hair, hat, face)
//                                          ├ arms[0] (right, −x) ─ weapon
//                                          ├ arms[1] (left) ─ shield or bow
//                                          └ cape
// rig.setExpr(expr) swaps the painted face; rig.flash.value flashes the character white.
// Characters face +z.

import * as THREE from 'three';
import { part, toonMesh, toonMat, withOutline, paintGrad, sph, cyl, cone, box, caps, tor, lathe, ico, shade, glowMat } from './toon.js';
import { faceTexture, faceCap } from './face.js';
import { CLASSES, COMPANIONS, RIVALS } from '../sim/data.js';

const PI = Math.PI;

export function lookFor(id, cls) {
    if (id === 'hero') return { ...CLASSES[cls].look, eyes: '#3a6ad8', weapon: CLASSES[cls].weapons[0], shield: cls === 'knight' };
    if (COMPANIONS[id]) return { ...COMPANIONS[id].look, eyes: { pip: '#3a8a3a', sylva: '#8a3ad8', bram: '#5a3a20', grumli: '#2a5ab0' }[id], weapon: COMPANIONS[id].weapons[0] };
    const r = RIVALS.find((x) => x.id === id);
    if (r) return { ...r.look, eyes: r.id === 'baron' ? '#5a3a20' : '#c040a0', weapon: r.id === 'baron' ? 'blade' : 'blade' };
    return { skin: '#ffd9b8', hair: '#5a3a24', outfit: '#888888', trim: '#ffffff' };
}

// ================================================================== geometry bits

function hairGeos(L, R) {
    const c = L.hair, out = [];
    const capH = (len = 0.55, sc = 1.06, back = 0.2) => out.push(part(new THREE.SphereGeometry(R * sc, 24, 14, 0, PI * 2, 0, PI * len), c, [0, 0.03, -R * back], [-0.12, 0, 0]));
    const fringe = (n = 5, len = 0.13, spread = 1.0) => {
        for (let i = 0; i < n; i++) {
            const a = -spread / 2 + spread * (i / (n - 1));
            out.push(part(cone(0.075, len + (i % 2) * 0.04, 7), c, [Math.sin(a) * R * 0.9, R * 0.5, Math.cos(a) * R * 0.78], [PI + 0.55, a, 0]));
        }
    };
    if (L.hood || L.helm || L.wizardHat) { capH(0.45); return out; }
    capH(0.58);
    fringe(L.curls ? 7 : 5, L.curls ? 0.1 : 0.13, 1.2);
    if (L.curls) for (let i = 0; i < 9; i++) { const a = PI * 0.5 + (i / 8) * PI; out.push(part(sph(0.1, 8, 6), c, [Math.sin(a) * R * 0.95, R * 0.2 + (i % 3) * 0.12, Math.cos(a) * R * 0.95])); }
    if (L.longHair) out.push(part(caps(R * 0.72, R * 1.4, 12), c, [0, -R * 0.65, -R * 0.42], [0.12, 0, 0], [1.25, 1, 0.55]));
    else if (!L.curls) for (const s of [-1, 1]) out.push(part(sph(R * 0.3, 10, 8), c, [s * R * 0.9, -R * 0.15, -R * 0.15], [0, 0, 0], [0.6, 1.1, 0.9]));
    return out;
}

function hatGeos(L, R) {
    const out = [];
    const c = L.outfit;
    if (L.helm) {
        out.push(part(new THREE.SphereGeometry(R * 1.1, 22, 12, 0, PI * 2, 0, PI * 0.52), '#c8d0e0', [0, 0.02, -0.02], [-0.08, 0, 0]));
        out.push(part(tor(R * 1.08, 0.03, 6, 22), '#ffd25a', [0, 0.05, -0.02], [PI / 2 - 0.08, 0, 0]));
        out.push(part(box(0.05, 0.22, 0.32), '#e83a3a', [0, R * 1.1, -0.04], [0, 0, 0]));
        for (let i = 0; i < 5; i++) out.push(part(sph(0.06, 6, 5), '#ff5a4a', [0, R * 1.18 - i * 0.02, -0.14 + i * 0.06]));
    }
    if (L.hood) {
        // open at the front: the sphere's phi = π/2 is +z, so leave a gap round it
        out.push(part(new THREE.SphereGeometry(R * 1.16, 22, 14, PI / 2 + 0.95, PI * 2 - 1.9, 0, PI * 0.7), L.cape ?? c, [0, 0.02, -R * 0.06], [-0.15, 0, 0]));
        out.push(part(tor(R * 0.98, 0.04, 5, 18, PI * 1.1), shade(L.cape ?? c, -0.2), [0, R * 0.05, R * 0.38], [-0.25, 0, -PI * 0.05]));
        out.push(part(cone(R * 0.5, R * 0.9, 10), L.cape ?? c, [0, R * 0.2, -R * 1.05], [-1.9, 0, 0]));
    }
    if (L.wizardHat) {
        out.push(part(cyl(R * 1.35, R * 1.35, 0.05, 22), L.cape, [0, R * 0.6, 0], [0.06, 0, 0]));
        out.push(part(cone(R * 0.8, 0.85, 14), L.cape, [0.04, R * 0.6 + 0.42, -0.04], [0.15, 0, -0.14]));
        out.push(part(cone(R * 0.32, 0.3, 10), L.cape, [0.24, R * 0.6 + 0.88, -0.02], [0.25, 0, -0.9]));
        out.push(part(cyl(R * 0.82, R * 0.84, 0.07, 14), '#ffd25a', [0, R * 0.66, 0]));
        out.push(part(new THREE.OctahedronGeometry(0.07, 0), '#ffd25a', [0.0, R * 0.95, R * 0.72], [0, 0, 0], [1, 1, 0.4]));
    }
    if (L.pirateHat) {
        out.push(part(sph(R * 1.05, 20, 10), '#2a2a3a', [0, R * 0.5, -0.02], [0, 0, 0], [1.35, 0.35, 1.1]));
        out.push(part(sph(R * 0.75, 18, 10), '#2a2a3a', [0, R * 0.78, -0.02], [0, 0, 0], [1, 0.6, 1]));
        out.push(part(box(0.12, 0.1, 0.02), '#ffffff', [0, R * 0.78, R * 0.75]));
        out.push(part(tor(R * 1.0, 0.025, 5, 22), '#ffd25a', [0, R * 0.52, -0.02], [PI / 2, 0, 0], [1.35, 1.1, 1]));
    }
    if (L.crownHat) {
        out.push(part(cyl(R * 0.62, R * 0.68, 0.2, 12), '#ffd040', [0, R * 0.92, -0.02]));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; out.push(part(cone(0.07, 0.18, 6), '#ffd040', [Math.sin(a) * R * 0.62, R * 0.92 + 0.17, Math.cos(a) * R * 0.62 - 0.02])); out.push(part(sph(0.04, 6, 5), i % 2 ? '#ff3a5a' : '#4ad0ff', [Math.sin(a) * R * 0.67, R * 0.92, Math.cos(a) * R * 0.67 - 0.02])); }
    }
    if (L.horns) {
        out.push(part(new THREE.SphereGeometry(R * 1.08, 20, 12, 0, PI * 2, 0, PI * 0.36), '#8a8a9a', [0, 0.06, -0.04], [-0.18, 0, 0]));
        out.push(part(tor(R * 0.92, 0.035, 6, 20), '#c8a040', [0, R * 0.5, -0.08], [PI / 2 - 0.18, 0, 0]));
        for (const s of [-1, 1]) out.push(part(cone(0.07, 0.34, 8), '#f4ecd8', [s * R * 1.0, R * 0.55, -0.02], [0, 0, s * -0.9]));
    }
    if (L.elf) for (const s of [-1, 1]) out.push(part(cone(0.06, 0.28, 6), L.skin, [s * R * 1.02, R * 0.05, -0.02], [0, 0, s * -1.25], [1, 1, 0.5]));
    if (L.eyepatch) {
        out.push(part(tor(R * 1.0, 0.012, 4, 20), '#1a1a1a', [0, R * 0.1, 0], [0.3, 0, 0.25]));
        out.push(part(sph(0.07, 8, 6), '#1a1a1a', [-R * 0.38, R * 0.0, R * 0.9], [0, 0, 0], [1, 1, 0.4]));
    }
    return out;
}

/** A held weapon, built along −y from the hand (the arm points down at rest). */
export function weaponGeos(kind, color) {
    switch (kind) {
        case 'blade': return [
            part(cyl(0.02, 0.02, 0.14, 6), '#5a3a24', [0, 0, 0]),
            part(box(0.2, 0.035, 0.05), '#ffd25a', [0, -0.08, 0]),
            part(box(0.06, 0.62, 0.02), color ?? '#e0e8f4', [0, -0.4, 0]),
            part(cone(0.03, 0.08, 4), color ?? '#e0e8f4', [0, -0.75, 0], [PI, PI / 4, 0], [1, 1, 0.35]),
        ];
        case 'hammer': return [
            part(cyl(0.025, 0.025, 0.65, 6), '#6a4a2a', [0, -0.25, 0]),
            part(box(0.3, 0.17, 0.17), color ?? '#8a8a9a', [0, -0.6, 0]),
            part(box(0.05, 0.2, 0.2), '#ffd25a', [0.13, -0.6, 0]),
        ];
        case 'staff': return [
            part(cyl(0.022, 0.026, 1.25, 6), '#7a5434', [0, -0.25, 0]),
            part(tor(0.08, 0.02, 5, 10), '#ffd25a', [0, 0.38, 0]),
        ];
        case 'bow': return [];
    }
    return [];
}

// ================================================================== humanoid

export function buildHumanoid(L, opts = {}) {
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const mk = (geos, ol = 0.022) => toonMesh(geos, { mat, outline: ol });
    const outer = new THREE.Group();
    const root = new THREE.Group();
    outer.add(root);
    const R = 0.34;
    const legLen = L.small ? 0.7 : 1;
    const wide = L.wide ? 1.2 : 1;
    const hipY = 0.34 * legLen;
    // legs
    const legs = [];
    for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * 0.09 * wide, hipY, 0);
        g.add(mk([
            part(caps(0.065, 0.16 * legLen, 8), shade(L.outfit, -0.4), [0, -0.14 * legLen, 0]),
            part(sph(0.09, 10, 8), L.boots ?? '#5a3a24', [0, -0.29 * legLen, 0.03], [0, 0, 0], [0.9, 0.7, 1.3]),
        ]));
        root.add(g);
        legs.push(g);
    }
    const hips = new THREE.Group();
    hips.position.y = hipY;
    root.add(hips);
    const body = new THREE.Group();
    hips.add(body);
    const tunic = [part(paintGrad(lathe([[0.001, -0.08], [0.21 * wide, -0.06], [0.2 * wide, 0.1], [0.16 * wide, 0.34], [0.001, 0.38]], 18), shade(L.outfit, -0.15), L.outfit), null)];
    tunic.push(part(tor(0.18 * wide, 0.028, 6, 18), L.belt ?? '#5a3a24', [0, 0.04, 0], [PI / 2, 0, 0]));
    tunic.push(part(box(0.06, 0.05, 0.02), '#ffd25a', [0, 0.04, 0.2 * wide]));
    tunic.push(part(box(0.05, 0.3, 0.012), L.trim, [0, 0.22, 0.165 * wide]));
    if (L.helm || L.horns) for (const s of [-1, 1]) tunic.push(part(sph(0.1, 10, 8), '#c8d0e0', [s * 0.18 * wide, 0.32, 0], [0, 0, 0], [1, 0.7, 1]));
    if (L.wide) tunic.push(part(sph(0.2, 12, 10), L.outfit, [0, 0.12, 0.08], [0, 0, 0], [1.1, 1, 1]));
    body.add(mk(tunic));
    // head
    const head = new THREE.Group();
    head.position.y = 0.36;
    body.add(head);
    const headGeos = [part(sph(R, 24, 18), L.skin, [0, R * 0.92, 0], [0, 0, 0], [1.05, 0.96, 1])];
    if (!L.elf) for (const s of [-1, 1]) headGeos.push(part(sph(0.06, 8, 6), L.skin, [s * R * 1.0, R * 0.85, 0], [0, 0, 0], [0.6, 1, 0.8]));
    if (L.beard) {
        headGeos.push(part(sph(R * 0.62, 14, 10), L.beard, [0, R * 0.42, R * 0.4], [0, 0, 0], [1.1, 1.0, 0.75]));
        headGeos.push(part(cone(R * 0.45, R * 0.8, 10), L.beard, [0, R * 0.0, R * 0.42], [PI + 0.25, 0, 0]));
    }
    headGeos.push(...hairGeos(L, R).map((g) => { g.translate(0, R * 0.92, 0); return g; }));
    headGeos.push(...hatGeos(L, R).map((g) => { g.translate(0, R * 0.92, 0); return g; }));
    head.add(mk(headGeos, 0.02));
    const spec = { skin: L.skin, eyes: L.eyes ?? '#3a6ad8', mouth: L.mouth ?? 'small', beard: L.beard, bushy: !!L.beard, browColor: shade(L.hair, -0.3), mouthY: L.beard ? 175 : 192 };
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture(spec, 'normal'), depthWrite: false });
    const face = new THREE.Mesh(faceCap(R, 1.05, 0.96), faceMat);
    face.position.y = R * 0.92;
    face.renderOrder = 2;
    head.add(face);
    // arms
    const arms = [];
    for (const s of [-1, 1]) {
        const a = new THREE.Group();
        a.position.set(s * 0.19 * wide, 0.3, 0);
        a.add(mk([part(caps(0.055, 0.14, 8), L.outfit, [0, -0.1, 0]), part(sph(0.065, 10, 8), L.gloves ?? L.skin, [0, -0.22, 0])]));
        body.add(a);
        arms.push(a);
    }
    // weapon in the right hand
    const hand = new THREE.Group();
    hand.position.set(0, -0.22, 0.02);
    arms[0].add(hand);
    let weapon = null, orb = null;
    const setWeapon = (kind, color) => {
        if (weapon) { hand.remove(weapon); weapon = null; }
        if (orb) { hand.remove(orb); orb = null; }
        const geos = weaponGeos(kind, color);
        if (!geos.length) return;
        weapon = toonMesh(geos, { mat, outline: 0.012 });
        hand.add(weapon);
        if (kind === 'staff') {
            orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), glowMat(color ?? '#8ad8ff', 1.5));
            orb.position.y = 0.42;
            hand.add(orb);
        }
    };
    // a bow in the left hand, or a shield on the left arm
    let bow = null, shield = null;
    if (L.weapon === 'bow') {
        const bg = [part(tor(0.34, 0.02, 5, 16, PI * 0.9), '#8a5a2a', [0, 0, 0], [0, 0, PI / 2 - PI * 0.45])];
        bg.push(part(cyl(0.004, 0.004, 0.66, 3), '#f4f4f4', [-0.17, 0, 0]));
        bow = toonMesh(bg, { mat, outline: 0.01 });
        bow.position.set(0, -0.22, 0.1);
        bow.rotation.y = PI / 2;
        arms[1].add(bow);
    } else setWeapon(L.weapon ?? 'blade');
    if (L.shield) {
        shield = toonMesh([
            part(cyl(0.2, 0.2, 0.05, 16), '#3a6fd8', [0, 0, 0], [PI / 2, 0, 0]),
            part(tor(0.2, 0.025, 5, 16), '#ffd25a', [0, 0, 0.02]),
            part(box(0.06, 0.24, 0.02), '#ffd25a', [0, 0, 0.035]), part(box(0.2, 0.06, 0.02), '#ffd25a', [0, 0.04, 0.035]),
        ], { mat, outline: 0.012 });
        shield.position.set(0.06, -0.14, 0.08);
        shield.rotation.y = 0.5;
        arms[1].add(shield);
    }
    // cape
    let cape = null;
    if (L.cape && !L.hood) {
        const cg = new THREE.PlaneGeometry(0.38 * wide, 0.5 * legLen + 0.05, 4, 6);
        cg.translate(0, -0.24, 0);
        paintGrad(cg, shade(L.cape, -0.25), L.cape, 1);
        cape = new THREE.Mesh(cg, toonMat({ vertexColors: true, side: THREE.DoubleSide, flash }));
        cape.position.set(0, 0.34, -0.17 * wide);
        cape.rotation.x = 0.12;
        cape.castShadow = true;
        body.add(cape);
    } else if (L.hood && L.cape) {
        const cg = new THREE.PlaneGeometry(0.36, 0.45, 3, 5);
        cg.translate(0, -0.22, 0);
        cape = new THREE.Mesh(cg, toonMat({ color: L.cape, side: THREE.DoubleSide, flash }));
        cape.position.set(0, 0.34, -0.17);
        cape.rotation.x = 0.1;
        body.add(cape);
    }
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    const rig = { root: outer, pivot: root, hips, body, head, arms, legs, hand, cape, face, faceMat, look: L, flash, expr: 'normal', kind: 'humanoid', hipY, blinkT: 2 + Math.random() * 3, phase: Math.random() * 6, setWeapon, bow, shield, height: 1.55 * (L.small ? 0.85 : 1) };
    rig.weaponObj = () => weapon;
    rig.setExpr = (e) => { if (rig.expr === e) return; rig.expr = e; faceMat.map = faceTexture(spec, e); faceMat.needsUpdate = true; };
    outer.userData.rig = rig;
    if (opts.scale) outer.scale.setScalar(opts.scale);
    return rig;
}

/** A board-game pedestal for a token: a coloured disc with a gold rim. */
export function pedestal(color) {
    return toonMesh([
        part(cyl(0.42, 0.48, 0.14, 24), color, [0, 0.07, 0]),
        part(tor(0.45, 0.035, 6, 24), '#ffd25a', [0, 0.13, 0], [PI / 2, 0, 0]),
        part(cyl(0.3, 0.3, 0.02, 20), shade(color, 0.3), [0, 0.15, 0]),
    ], { outline: 0.025 });
}

/** A token: a chibi on a pedestal, for the board. */
export function buildToken(id, cls, color) {
    const rig = buildHumanoid(lookFor(id, cls));
    const grp = new THREE.Group();
    grp.add(pedestal(color));
    rig.root.position.y = 0.15;
    grp.add(rig.root);
    grp.userData.rig = rig;
    return { group: grp, rig };
}

export { withOutline, ico };
