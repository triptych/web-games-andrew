// Chibi characters built from merged, vertex-coloured primitives with toon shading and ink outlines.
//
// Humanoid rig (≈1.6 units tall, head ≈ 45% of it):
//   root ─ hips ─ body ─ head (hair, hat, face)
//        │            └ swing (shoulder pivot) ─ armL, armR, club
//        ├ legL, legR
//        └ cape
// rig.setExpr(expr) swaps the painted face; rig.flash.value flashes the whole character white.

import * as THREE from 'three';
import { part, toonMesh, toonMat, withOutline, paint, paintGrad, sph, cyl, cone, box, caps, tor, lathe, ico, merge, smoothed } from './toon.js';
import { faceTexture, faceCap } from './face.js';

const PI = Math.PI;

// ================================================================== looks
export const CAST = {
    queen: { skin: '#ffe0cc', hair: '#ffd25a', hairStyle: 4, eyes: '#3a6ad8', outfit: '#4a7ae8', outfit2: '#ffffff', hat: 'crown', cape: '#7ab0ff', skirt: true, mouth: 'cat' },
    eagle: { skin: '#f5c9a6', hair: '#f4f4f4', hairStyle: -1, eyes: '#5a4030', outfit: '#c84040', outfit2: '#2a6a3a', hat: 'cap', beard: '#ffffff', bushy: true, tartan: true, browColor: '#ffffff' },
    bogey: { skin: '#cfe3b8', hair: '#3a2a4a', hairStyle: 5, eyes: '#c040ff', outfit: '#6a3aa8', outfit2: '#2a1a40', hat: 'wizard', hatColor: '#4a2a7a', skirt: true, cape: '#2a1a40', mouth: 'teeth', prop: 'staff' },
    fescue: { skin: '#ffe6d0', hair: '#c8743a', hairStyle: 1, eyes: '#3a8a3a', outfit: '#8ac8f0', outfit2: '#ffffff', hat: 'bonnet', hatColor: '#fff2c0', skirt: true, prop: 'crook' },
    zeph: { skin: '#d9a070', hair: '#2a1a14', hairStyle: 3, eyes: '#8a5a20', outfit: '#e8843a', outfit2: '#3a9aa8', hat: 'turban', hatColor: '#3a9aa8', cape: '#e8c070' },
    yodel: { skin: '#f5c9a6', hair: '#e8e8e8', hairStyle: -1, eyes: '#4a6a8a', outfit: '#3a7a4a', outfit2: '#8a5a30', hat: 'alpine', hatColor: '#3a6a3a', beard: '#f0f0f0', bushy: true, browColor: '#f0f0f0' },
    cinder: { skin: '#a8704a', hair: '#e04a2a', hairStyle: 0, eyes: '#e0a020', outfit: '#5a4a44', outfit2: '#3a2a24', hat: 'bandana', hatColor: '#e03030', apron: true, prop: 'hammer' },
    albatross: { skin: '#ffe6d6', hair: '#f0f4ff', hairStyle: 4, eyes: '#3a9ad8', outfit: '#e8eef8', outfit2: '#7ab0e0', hat: 'helmet', cape: '#ffffff', prop: 'spear' },
};

export function heroLook(look, outfit) {
    return { skin: look.skin, hair: look.hair, hairStyle: look.hairStyle, eyes: look.eyes, outfit, outfit2: '#f4ecd0', hat: 'beret', hatColor: outfit, cape: '#c83a3a', argyle: true, hero: true };
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
    switch (L.hairStyle) {
        case -1: // bald with side tufts
            for (const s of [-1, 1]) out.push(part(sph(R * 0.32, 10, 8), c, [s * R * 0.88, -R * 0.05, -R * 0.15], [0, 0, 0], [0.6, 1, 1]));
            break;
        case 0: capH(0.52); fringe(5, 0.12, 1.1);
            for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; out.push(part(cone(0.08, 0.2, 6), c, [Math.sin(a) * R * 0.5, R * 0.85, Math.cos(a) * R * 0.5 - 0.05], [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7])); }
            break;
        case 1: capH(0.58); fringe(6, 0.14, 1.2);
            for (const s of [-1, 1]) out.push(part(sph(R * 0.36, 12, 10), c, [s * R * 0.92, -R * 0.35, -R * 0.1], [0, 0, 0], [0.7, 1.2, 0.9]));
            out.push(part(sph(R * 0.25, 10, 8), c, [0, R * 0.2, -R * 1.0]));
            break;
        case 2: capH(0.6, 1.08); fringe(7, 0.11, 1.4);
            for (let i = 0; i < 8; i++) { const a = PI * 0.6 + (i / 7) * PI * 0.8; out.push(part(cone(0.1, 0.26, 6), c, [Math.sin(a) * R * 0.9, R * 0.1 + (i % 2) * 0.1, Math.cos(a) * R * 0.9], [Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4])); }
            break;
        case 3: capH(0.55); fringe(5, 0.12, 1.0);
            for (const s of [-1, 1]) {
                out.push(part(sph(0.08, 8, 6), L.outfit2 ?? c, [s * R * 0.9, R * 0.15, -R * 0.35]));
                out.push(part(caps(0.075, R * 0.9, 8), c, [s * R * 1.0, -R * 0.45, -R * 0.4], [0.15, 0, s * 0.15]));
            }
            break;
        case 4: capH(0.6, 1.08, 0.18); fringe(5, 0.12, 1.0);
            out.push(part(caps(R * 0.75, R * 1.2, 12), c, [0, -R * 0.55, -R * 0.45], [0.12, 0, 0], [1.2, 1, 0.55]));
            break;
        case 5: capH(0.5); fringe(3, 0.1, 0.6); break;
        default: capH();
    }
    return out;
}

function hatGeos(L, R) {
    const c = L.hatColor ?? L.outfit, out = [];
    switch (L.hat) {
        case 'beret':
            out.push(part(sph(R * 0.95, 20, 10), c, [-R * 0.1, R * 0.7, -R * 0.05], [0.1, 0, 0.25], [1, 0.32, 1]));
            out.push(part(sph(0.05, 8, 6), c, [-R * 0.1, R * 1.0, -R * 0.05]));
            out.push(part(cone(0.05, 0.55, 6), '#ffd84a', [R * 0.55, R * 0.95, -R * 0.35], [0.4, 0, -0.9]));
            break;
        case 'crown':
            out.push(part(cyl(R * 0.5, R * 0.55, 0.16, 12), '#ffd040', [0, R * 0.95, -0.02]));
            for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; out.push(part(cone(0.06, 0.16, 6), '#ffd040', [Math.sin(a) * R * 0.5, R * 0.95 + 0.14, Math.cos(a) * R * 0.5 - 0.02])); out.push(part(sph(0.035, 6, 5), i % 2 ? '#ff4a6a' : '#4ad0ff', [Math.sin(a) * R * 0.54, R * 0.95, Math.cos(a) * R * 0.54 - 0.02])); }
            break;
        case 'wizard':
            out.push(part(cyl(R * 1.25, R * 1.25, 0.05, 20), c, [0, R * 0.62, 0], [0.08, 0, 0]));
            out.push(part(cone(R * 0.75, 0.8, 14), c, [0.06, R * 0.62 + 0.4, -0.04], [0.15, 0, -0.18]));
            out.push(part(cone(R * 0.3, 0.28, 10), c, [0.27, R * 0.62 + 0.86, -0.02], [0.2, 0, -0.9]));
            out.push(part(cyl(R * 0.76, R * 0.78, 0.07, 14), '#ffd040', [0, R * 0.68, 0]));
            break;
        case 'cap':
            out.push(part(sph(R * 1.02, 20, 10, ), c, [0, R * 0.25, -0.02], [0, 0, 0], [1, 0.75, 1]));
            out.push(part(cyl(R * 0.8, R * 0.8, 0.03, 16), shadeHex(c, -0.2), [0, R * 0.45, R * 0.55], [0.25, 0, 0], [1, 1, 0.6]));
            out.push(part(cone(0.04, 0.4, 6), '#8a5a30', [R * 0.7, R * 0.9, -R * 0.3], [0.5, 0, -0.7]));
            break;
        case 'bonnet':
            out.push(part(new THREE.SphereGeometry(R * 1.12, 20, 12, 0, PI * 2, 0, PI * 0.6), c, [0, 0.02, -R * 0.12], [-0.35, 0, 0]));
            out.push(part(tor(R * 0.9, 0.03, 6, 20, PI), '#ff8aa0', [0, -R * 0.1, R * 0.15], [0, 0, PI]));
            break;
        case 'turban':
            out.push(part(sph(R * 1.08, 20, 12), c, [0, R * 0.45, -0.02], [0, 0, 0], [1, 0.62, 1]));
            out.push(part(tor(R * 0.95, 0.07, 8, 20), shadeHex(c, 0.2), [0, R * 0.32, -0.02], [PI / 2, 0, 0]));
            out.push(part(sph(0.06, 8, 6), '#ff3a5a', [0, R * 0.45, R * 0.98]));
            break;
        case 'alpine':
            out.push(part(cyl(R * 0.62, R * 0.72, 0.28, 14), c, [0, R * 0.92, 0]));
            out.push(part(cyl(R * 1.05, R * 1.05, 0.04, 18), c, [0, R * 0.78, 0]));
            out.push(part(cone(0.05, 0.45, 6), '#ff4a4a', [R * 0.5, R * 1.15, -R * 0.2], [0.3, 0, -0.6]));
            break;
        case 'bandana':
            out.push(part(new THREE.SphereGeometry(R * 1.05, 20, 10, 0, PI * 2, 0, PI * 0.42), c, [0, 0.03, -0.02], [-0.15, 0, 0]));
            out.push(part(cone(0.07, 0.22, 6), c, [0, R * 0.2, -R * 1.02], [-2.2, 0, 0]));
            break;
        case 'helmet':
            out.push(part(new THREE.SphereGeometry(R * 1.1, 20, 12, 0, PI * 2, 0, PI * 0.5), '#dfe6f0', [0, 0.02, -0.02], [-0.1, 0, 0]));
            for (const s of [-1, 1]) out.push(part(cone(0.12, 0.4, 4), '#ffffff', [s * R * 1.0, R * 0.55, -R * 0.2], [0.3, 0, s * -1.0], [0.4, 1, 1]));
            break;
    }
    return out;
}

function shadeHex(hex, k) {
    const c = new THREE.Color(hex);
    if (k > 0) c.lerp(new THREE.Color('#ffffff'), k); else c.multiplyScalar(1 + k);
    return '#' + c.getHexString();
}

// A clubhead and shaft (the golfer's club, or Wedgewick himself).
export function clubGeos(color = '#c8ccd8', len = 0.95) {
    return [
        part(cyl(0.016, 0.02, len, 6), '#9aa0b0', [0, -len / 2, 0]),
        part(cyl(0.03, 0.03, 0.22, 8), '#3a2a20', [0, -0.08, 0]),
        part(box(0.2, 0.09, 0.04), color, [0.07, -len - 0.02, 0], [0, 0, -0.15]),
    ];
}

// ================================================================== humanoid
export function buildHumanoid(L, opts = {}) {
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const mk = (geos, ol = 0.022) => { const m = toonMesh(geos, { mat, outline: ol }); return m; };
    const outer = new THREE.Group();
    const root = new THREE.Group();   // the animation pivot (bobs and hops); outer is placed in the world
    outer.add(root);
    const R = 0.34;
    // ---- legs
    const legs = [];
    for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * 0.09, 0.34, 0);
        g.add(mk([part(caps(0.062, 0.16, 8), L.pants ?? shadeHex(L.outfit, -0.35), [0, -0.14, 0]), part(sph(0.085, 10, 8), L.boots ?? '#5a3a24', [0, -0.29, 0.03], [0, 0, 0], [0.9, 0.7, 1.3])]));
        root.add(g);
        legs.push(g);
    }
    // ---- body
    const hips = new THREE.Group();
    hips.position.y = 0.34;
    root.add(hips);
    const body = new THREE.Group();
    hips.add(body);
    const tunic = [];
    if (L.skirt) {
        tunic.push(part(paintGrad(lathe([[0.001, -0.36], [0.3, -0.34], [0.24, -0.1], [0.17, 0.12], [0.15, 0.36], [0.001, 0.4]], 20), shadeHex(L.outfit, -0.2), L.outfit), null));
    } else {
        tunic.push(part(paintGrad(lathe([[0.001, -0.06], [0.2, -0.05], [0.18, 0.1], [0.15, 0.36], [0.001, 0.4]], 18), shadeHex(L.outfit, -0.15), L.outfit), null));
    }
    tunic.push(part(tor(0.17, 0.025, 6, 18), L.outfit2 ?? '#5a3a24', [0, 0.06, 0], [PI / 2, 0, 0]));
    tunic.push(part(box(0.05, 0.04, 0.02), '#ffd040', [0, 0.06, 0.18]));
    if (L.argyle) {
        for (let i = 0; i < 3; i++) tunic.push(part(box(0.06, 0.06, 0.01), i % 2 ? '#f4ecd0' : shadeHex(L.outfit, -0.3), [-0.06 + i * 0.06, 0.2, 0.158], [0, 0, PI / 4]));
    }
    if (L.tartan) {
        for (let i = 0; i < 3; i++) tunic.push(part(box(0.34, 0.015, 0.01), '#2a6a3a', [0, 0.12 + i * 0.08, 0.16]));
    }
    if (L.apron) tunic.push(part(box(0.24, 0.34, 0.02), '#7a5a3a', [0, 0.04, 0.17]));
    body.add(mk(tunic));
    // ---- head
    const head = new THREE.Group();
    head.position.y = 0.36;
    body.add(head);
    const headGeos = [part(sph(R, 24, 18), L.skin, [0, R * 0.92, 0], [0, 0, 0], [1.05, 0.96, 1])];
    for (const s of [-1, 1]) headGeos.push(part(sph(0.06, 8, 6), L.skin, [s * R * 1.0, R * 0.85, 0], [0, 0, 0], [0.6, 1, 0.8]));
    headGeos.push(...hairGeos(L, R).map((g) => { g.translate(0, R * 0.92, 0); return g; }));
    headGeos.push(...hatGeos(L, R).map((g) => { g.translate(0, R * 0.92, 0); return g; }));
    head.add(mk(headGeos, 0.02));
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture(faceSpec(L), 'normal'), depthWrite: false });
    const face = new THREE.Mesh(faceCap(R, 1.05, 0.96), faceMat);
    face.position.y = R * 0.92;
    face.renderOrder = 2;
    head.add(face);
    // ---- arms + club on a swing pivot at the shoulders
    const swing = new THREE.Group();
    swing.position.set(0, 0.3, 0);
    body.add(swing);
    const arms = [];
    for (const s of [-1, 1]) {
        const a = new THREE.Group();
        a.position.set(s * 0.17, 0, 0);
        a.add(mk([part(caps(0.05, 0.14, 8), L.outfit, [0, -0.1, 0]), part(sph(0.06, 10, 8), L.skin, [0, -0.22, 0])]));
        swing.add(a);
        arms.push(a);
    }
    const club = toonMesh(clubGeos('#c8ccd8', 0.62), { outline: 0.012 });
    club.position.set(0, -0.24, 0.1);
    club.rotation.x = -0.5;
    club.visible = false;
    swing.add(club);
    // ---- cape
    let cape = null;
    if (L.cape) {
        const cg = new THREE.PlaneGeometry(0.36, 0.48, 4, 6);
        cg.translate(0, -0.24, 0);
        paintGrad(cg, shadeHex(L.cape, -0.25), L.cape, 1);
        cape = new THREE.Mesh(cg, toonMat({ vertexColors: true, side: THREE.DoubleSide, flash }));
        cape.position.set(0, 0.34, -0.16);
        cape.rotation.x = 0.12;
        cape.castShadow = true;
        body.add(cape);
    }
    // ---- props
    let prop = null;
    if (L.prop) {
        const pg = [];
        if (L.prop === 'staff') { pg.push(part(cyl(0.025, 0.03, 1.4, 6), '#4a3a2a', [0, 0.1, 0]), part(ico(0.1, 0), '#c060ff', [0, 0.85, 0])); }
        if (L.prop === 'crook') { pg.push(part(cyl(0.022, 0.022, 1.2, 6), '#8a5a30', [0, 0.1, 0]), part(tor(0.1, 0.022, 6, 12, PI * 1.3), '#8a5a30', [0.1, 0.7, 0], [0, 0, 0])); }
        if (L.prop === 'hammer') { pg.push(part(cyl(0.025, 0.025, 0.6, 6), '#6a4a2a', [0, -0.05, 0]), part(box(0.22, 0.12, 0.12), '#6a6a78', [0, 0.25, 0])); }
        if (L.prop === 'spear') { pg.push(part(cyl(0.02, 0.02, 1.5, 6), '#c0c8d8', [0, 0.2, 0]), part(cone(0.06, 0.2, 6), '#ffd040', [0, 1.05, 0])); }
        prop = toonMesh(pg, { mat, outline: 0.012 });
        prop.position.set(0, -0.22, 0.04);
        arms[0].add(prop);
    }
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    const rig = { root: outer, pivot: root, hips, body, head, swing, arms, legs, club, cape, face, faceMat, look: L, flash, expr: 'normal', kind: 'humanoid', blinkT: 2 + Math.random() * 3 };
    rig.setExpr = (e) => { if (rig.expr === e) return; rig.expr = e; faceMat.map = faceTexture(faceSpec(L), e); faceMat.needsUpdate = true; };
    outer.userData.rig = rig;
    if (opts.scale) outer.scale.setScalar(opts.scale);
    return rig;
}

function faceSpec(L) {
    return { skin: L.skin, eyes: L.eyes, mouth: L.mouth ?? 'small', beard: L.beard, bushy: L.bushy, browColor: L.browColor ?? shadeHex(L.hair, -0.3) };
}

// ================================================================== Wedgewick, the talking wedge
export function buildWedgewick() {
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const root = new THREE.Group();
    const inner = new THREE.Group();
    root.add(inner);
    const g = [
        part(cyl(0.025, 0.03, 0.9, 8), '#b8bccc', [0, 0.1, 0]),
        part(cyl(0.045, 0.04, 0.28, 10), '#4a2a5a', [0, 0.62, 0]),
        part(box(0.36, 0.22, 0.07), '#d8dce8', [0.08, -0.42, 0], [0, 0, -0.2]),
        // wizard hat on the grip
        part(cyl(0.16, 0.16, 0.02, 14), '#3a4ab0', [0, 0.78, 0]),
        part(cone(0.1, 0.36, 12), '#3a4ab0', [0.02, 0.96, 0], [0, 0, -0.25]),
        part(sph(0.035, 6, 5), '#ffd84a', [0.08, 1.13, 0]),
        // beard wisp under the head
        part(cone(0.07, 0.2, 8), '#f4f4ff', [0.1, -0.6, 0.02], [PI, 0, 0.2]),
    ];
    const m = toonMesh(g, { mat, outline: 0.015 });
    inner.add(m);
    // eyes painted on the clubface
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture({ skin: '#d8dce8', eyes: '#4a7aff', mouth: 'small', blush: false, browColor: '#f4f4ff', bushy: true, eyeW: 18, eyeH: 22, eyeGap: 44, eyeY: 110, mouthY: 180 }, 'normal'), depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), faceMat);
    face.position.set(0.08, -0.42, 0.04);
    face.rotation.z = -0.2;
    face.renderOrder = 2;
    inner.add(face);
    const spec = { skin: '#d8dce8', eyes: '#4a7aff', mouth: 'small', blush: false, browColor: '#f4f4ff', bushy: true, eyeW: 18, eyeH: 22, eyeGap: 44, eyeY: 110, mouthY: 180 };
    // a little glow
    const rig = { root, inner, face, faceMat, flash, expr: 'normal', kind: 'wedge' };
    rig.setExpr = (e) => { if (rig.expr === e) return; rig.expr = e; faceMat.map = faceTexture(spec, e); faceMat.needsUpdate = true; };
    root.userData.rig = rig;
    return rig;
}

// ================================================================== monsters
function faceOn(group, R, spec, y = 0, z = 0, sx = 1, sy = 1) {
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture(spec, 'normal'), depthWrite: false });
    const f = new THREE.Mesh(faceCap(R, sx, sy), faceMat);
    f.position.set(0, y, z);
    f.renderOrder = 2;
    group.add(f);
    return { f, faceMat, spec };
}

export function buildMonster(kind) {
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    let face;
    if (kind === 'slime') {
        const g = smoothed(paintGrad(new THREE.SphereGeometry(0.6, 20, 14), '#3aa84a', '#9af07a', 1));
        g.scale(1, 0.8, 1);
        const m = new THREE.Mesh(g, mat); withOutline(m, 0.025); m.castShadow = true; m.position.y = -0.05;
        body.add(m);
        body.add(toonMesh([part(sph(0.12, 8, 6), '#e8ffe0', [-0.22, 0.3, 0.3])], { mat, outline: false }));
        face = faceOn(body, 0.6, { skin: '#6ad060', eyes: '#1a3a1a', mouth: 'cat', blush: 'rgba(255,140,160,0.6)', brows: false, eyeW: 18, eyeH: 24 }, -0.08, 0, 1, 0.8);
    } else if (kind === 'scarab') {
        body.add(toonMesh([
            part(new THREE.SphereGeometry(0.55, 18, 12, 0, PI * 2, 0, PI * 0.55), '#1a8a8a', [0, -0.05, 0], [0, 0, 0], [1, 0.8, 1.2]),
            part(box(0.02, 0.4, 1.1), '#ffd040', [0, 0.18, 0]),
            part(sph(0.3, 12, 10), '#14605a', [0, 0.02, 0.55]),
            ...[-1, 1].flatMap((s) => [0, 1, 2].map((i) => part(caps(0.03, 0.25, 4), '#0a3a3a', [s * 0.45, -0.18, -0.25 + i * 0.25], [0, 0, s * 1.1]))),
            part(cone(0.05, 0.25, 6), '#ffd040', [0, 0.25, 0.75], [0.6, 0, 0]),
        ], { mat, outline: 0.02 }));
        face = faceOn(body, 0.3, { skin: '#14605a', eyes: '#ffd040', mouth: 'small', blush: false, brows: false, eyeW: 22, eyeH: 26 }, 0.02, 0.55);
    } else if (kind === 'penguin') {
        body.add(toonMesh([
            part(sph(0.5, 18, 14), '#22283a', [0, 0, 0], [0, 0, 0], [1, 1.15, 0.95]),
            part(sph(0.4, 16, 12), '#f8f8ff', [0, -0.05, 0.16], [0, 0, 0], [1, 1.15, 0.85]),
            part(new THREE.SphereGeometry(0.53, 16, 10, 0, PI * 2, 0, PI * 0.38), '#b8c0d8', [0, 0.05, 0]),
            part(cone(0.05, 0.25, 6), '#ff5a5a', [0, 0.62, -0.05]),
            ...[-1, 1].map((s) => part(sph(0.22, 10, 8), '#22283a', [s * 0.48, -0.05, 0], [0, 0, s * 0.4], [0.35, 1, 0.6])),
            ...[-1, 1].map((s) => part(sph(0.13, 8, 6), '#ff9a2a', [s * 0.18, -0.55, 0.12], [0, 0, 0], [1, 0.4, 1.4])),
        ], { mat, outline: 0.02 }));
        face = faceOn(body, 0.5, { skin: '#f8f8ff', eyes: '#1a1a2a', mouth: 'beak', blush: 'rgba(255,150,170,0.6)', brows: false, eyeW: 16, eyeH: 20, eyeGap: 40, eyeY: 120, mouthY: 168 }, 0.05, 0, 1, 1.1);
    } else if (kind === 'imp') {
        body.add(toonMesh([
            part(sph(0.5, 18, 14), '#e8402a', [0, 0, 0]),
            ...[-1, 1].map((s) => part(cone(0.1, 0.3, 8), '#3a1a1a', [s * 0.28, 0.48, 0], [0, 0, s * -0.4])),
            ...[-1, 1].map((s) => part(new THREE.CircleGeometry(0.4, 3), '#7a1a1a', [s * 0.55, 0.15, -0.2], [0, s * 0.8, s * 0.3])),
            part(cyl(0.03, 0.05, 0.5, 6), '#e8402a', [0, -0.3, -0.5], [1.0, 0, 0]),
            part(cone(0.08, 0.15, 3), '#3a1a1a', [0, -0.45, -0.75], [1.8, 0, 0]),
        ], { mat, outline: 0.02, emissive: '#401000' }));
        face = faceOn(body, 0.5, { skin: '#e8402a', eyes: '#ffe040', mouth: 'teeth', blush: false, eyeW: 18, eyeH: 20 }, 0, 0);
    } else if (kind === 'wisp') {
        const g = paintGrad(lathe([[0.001, -0.7], [0.18, -0.55], [0.42, -0.2], [0.5, 0.1], [0.42, 0.38], [0.001, 0.55]], 18), '#5a2a8a', '#c8a0ff', 1);
        const m = new THREE.Mesh(smoothed(g), toonMat({ vertexColors: true, flash, emissive: '#3a1060', transparent: true, opacity: 0.88 }));
        withOutline(m, 0.02, '#2a1040');
        body.add(m);
        face = faceOn(body, 0.48, { skin: '#c8a0ff', eyes: '#ffffff', mouth: 'small', blush: false, brows: false, eyeW: 16, eyeH: 24, ink: '#2a0a40' }, 0.05, 0);
    }
    const rig = { root, body, flash, kind, face: face?.f, faceMat: face?.faceMat, expr: 'normal' };
    rig.setExpr = (e) => { if (!face || rig.expr === e) return; rig.expr = e; face.faceMat.map = faceTexture(face.spec, e); face.faceMat.needsUpdate = true; };
    root.userData.rig = rig;
    return rig;
}

// ================================================================== bosses
export function buildBoss(kind) {
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const root = new THREE.Group();
    const parts = {};
    const faces = [];
    const addFace = (group, R, spec, y, z = 0, sx = 1, sy = 1) => { const f = faceOn(group, R, spec, y, z, sx, sy); faces.push(f); return f; };
    if (kind === 'gopher') {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        body.add(toonMesh([
            part(sph(1.0, 22, 16), '#a86a3a', [0, 0.9, 0], [0, 0, 0], [1, 1.1, 0.95]),
            part(sph(0.7, 18, 12), '#f0d8b0', [0, 0.75, 0.38], [0, 0, 0], [1, 1.1, 0.7]),
            ...[-1, 1].map((s) => part(sph(0.24, 10, 8), '#a86a3a', [s * 0.72, 1.85, -0.1], [0, 0, 0], [1, 1, 0.5])),
            ...[-1, 1].map((s) => part(sph(0.14, 8, 6), '#ffb0b0', [s * 0.72, 1.85, -0.04], [0, 0, 0], [1, 1, 0.4])),
            part(box(0.26, 0.22, 0.06), '#ffffff', [0, 0.95, 0.95]),
            part(sph(0.13, 10, 8), '#5a2a2a', [0, 1.22, 0.92]),
            ...[-1, 1].map((s) => part(caps(0.14, 0.35, 8), '#a86a3a', [s * 0.75, 0.75, 0.45], [0.6, 0, s * 0.6])),
            part(cyl(0.42, 0.48, 0.3, 12), '#ffd040', [0, 2.0, -0.05]),
            ...[0, 1, 2, 3, 4].map((i) => part(cone(0.1, 0.25, 6), '#ffd040', [Math.sin((i / 5) * PI * 2) * 0.42, 2.25, Math.cos((i / 5) * PI * 2) * 0.42 - 0.05])),
            part(sph(0.08, 6, 5), '#ff3a5a', [0, 2.0, 0.42]),
        ], { mat, outline: 0.035 }));
        addFace(body, 1.0, { skin: '#a86a3a', eyes: '#1a0a0a', mouth: 'small', blush: 'rgba(255,130,130,0.6)', eyeW: 15, eyeH: 19, eyeGap: 36, eyeY: 100, mouthY: 230 }, 0.9, 0, 1, 1.1);
        // molehill dirt ring (placed by the view at each hill)
    } else if (kind === 'worm') {
        // the head; the view builds and places the body segments
        const head = new THREE.Group(); root.add(head); parts.head = head;
        head.add(toonMesh([
            part(sph(1.25, 22, 16), '#d8a860', [0, 0, 0], [0, 0, 0], [1, 1, 1.1]),
            part(tor(1.2, 0.12, 8, 24), '#a87a3a', [0, 0, -0.5], [0, 0, 0]),
            ...[-1, 1].map((s) => part(cone(0.22, 0.8, 8), '#f8f0e0', [s * 0.55, -0.35, 1.0], [1.3, 0, s * 0.4])),
            part(ico(0.32, 0), '#ff3a8a', [0, 0.85, 0.6]),
        ], { mat, outline: 0.04, emissive: '#100800' }));
        addFace(head, 1.25, { skin: '#d8a860', eyes: '#ff2a6a', mouth: 'teeth', blush: false, eyeW: 16, eyeH: 16, eyeGap: 48 }, 0, 0.05, 1, 1);
    } else if (kind === 'yeti') {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        const fur = [part(sph(1.6, 24, 18), '#f4f8ff', [0, 1.7, 0], [0, 0, 0], [1, 1.05, 0.95])];
        for (let i = 0; i < 26; i++) { const a = i * 2.4, y = 0.6 + (i % 7) * 0.4; const r = Math.sqrt(Math.max(0.1, 1 - ((y - 1.7) / 1.7) ** 2)) * 1.55; fur.push(part(cone(0.22, 0.45, 6), '#e8f0ff', [Math.sin(a) * r, y, Math.cos(a) * r], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2])); }
        fur.push(part(sph(0.9, 18, 14), '#7ab0e8', [0, 1.95, 0.85], [0, 0, 0], [1, 0.95, 0.6]));
        for (const s of [-1, 1]) {
            fur.push(part(cone(0.22, 0.8, 8), '#e8dcc0', [s * 1.0, 3.3, -0.1], [0, 0, s * -0.6]));
            fur.push(part(caps(0.4, 1.0, 10), '#f4f8ff', [s * 1.6, 1.4, 0.3], [0.3, 0, s * 0.4]));
            fur.push(part(sph(0.4, 10, 8), '#7ab0e8', [s * 1.9, 0.75, 0.55]));
        }
        body.add(toonMesh(fur, { mat, outline: 0.035 }));
        addFace(body, 0.9, { skin: '#7ab0e8', eyes: '#1a2a4a', mouth: 'teeth', blush: 'rgba(255,150,200,0.5)', eyeW: 20, eyeH: 22, eyeGap: 52, eyeY: 108 }, 1.95, 0.85 - 0.2, 1, 0.95);
    } else if (kind === 'ogre') {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        body.add(toonMesh([
            part(sph(2.0, 24, 18), '#c84a3a', [0, 2.3, 0], [0, 0, 0], [1.15, 1.0, 0.9]),
            part(sph(1.4, 18, 12), '#e8a07a', [0, 2.0, 0.75], [0, 0, 0], [1, 1, 0.6]),
            ...[-1, 1].map((s) => part(cyl(0.55, 0.7, 1.0, 10), '#b83a2a', [s * 1.6, 4.0, -0.3], [0, 0, s * 0.35])),
            part(cyl(1.7, 1.9, 0.9, 16), '#5a3a24', [0, 1.0, 0]),
            ...[-1, 1].map((s) => part(caps(0.55, 1.2, 10), '#c84a3a', [s * 2.2, 2.3, 0.3], [0.4, 0, s * 0.5])),
            ...[-1, 1].map((s) => part(caps(0.6, 0.6, 10), '#c84a3a', [s * 0.9, 0.5, 0])),
            ...[-1, 1].map((s) => part(cyl(0.05, 0.05, 1.6, 6), '#3a2a20', [s * 0.8, 4.4, 0], [0, 0, s * 0.3])),
        ], { mat, outline: 0.04, emissive: '#200800' }));
        for (let i = 0; i < 2; i++) {
            const h = new THREE.Group(); root.add(h); parts['head' + i] = h;
            h.add(toonMesh([
                part(sph(1.15, 20, 16), i ? '#d85a3a' : '#b83a2a', [0, 0, 0]),
                part(cone(0.25, 0.7, 8), '#f0e0c0', [i ? 0.55 : -0.55, 1.0, 0], [0, 0, i ? -0.5 : 0.5]),
                part(sph(0.35, 10, 8), '#a83a2a', [0, -0.15, 1.0]),
            ], { mat, outline: 0.035, emissive: '#200800' }));
            addFace(h, 1.15, { skin: i ? '#d85a3a' : '#b83a2a', eyes: '#ffe040', mouth: 'teeth', blush: false, eyeW: 18, eyeH: 20, eyeGap: 48 }, 0, 0);
        }
    } else if (kind === 'dragon') {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        body.add(toonMesh([
            part(sph(2.6, 24, 18), '#6a3aa8', [0, 2.4, 0], [0, 0, 0], [1.4, 1, 1]),
            part(sph(2.0, 18, 12), '#d8b0ff', [0, 2.0, 1.0], [0, 0, 0], [1.2, 0.9, 0.6]),
            ...[-1, 1].map((s) => part(new THREE.CircleGeometry(3.2, 5), '#4a2a7a', [s * 3.2, 4.4, -1.0], [0.3, s * 0.6, s * 0.4])),
            part(cone(1.0, 4, 10), '#6a3aa8', [0, 1.4, -3.8], [-1.3, 0, 0]),
            ...[-1, 1].map((s) => part(caps(0.7, 0.8, 10), '#6a3aa8', [s * 2.0, 0.7, 0.6])),
        ], { mat, outline: 0.045 }));
        const cols = ['#e04a2a', '#4ab0f0', '#4ad070'];
        for (let i = 0; i < 3; i++) {
            const neck = new THREE.Group(); root.add(neck); parts['neck' + i] = neck;
            const h = new THREE.Group(); root.add(h); parts['head' + i] = h;
            h.add(toonMesh([
                part(sph(1.1, 18, 14), cols[i], [0, 0, 0], [0, 0, 0], [1, 0.95, 1.2]),
                part(sph(0.6, 12, 10), shadeHex(cols[i], 0.3), [0, -0.3, 0.95], [0, 0, 0], [1.1, 0.7, 1]),
                ...[-1, 1].map((s) => part(cone(0.2, 0.9, 8), '#f8f0d0', [s * 0.5, 0.95, -0.3], [-0.5, 0, s * -0.3])),
            ], { mat, outline: 0.035, emissive: shadeHex(cols[i], -0.8) }));
            addFace(h, 1.1, { skin: cols[i], eyes: '#ffee40', mouth: 'teeth', blush: false, eyeW: 16, eyeH: 18, eyeGap: 46, eyeY: 108 }, 0, 0.1, 1, 0.95);
        }
    }
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    const rig = { root, parts, faces, flash, kind, expr: 'normal' };
    rig.setExpr = (e, i) => {
        faces.forEach((f, k) => { if (i !== undefined && i !== k) return; const m = faceTexture(f.spec, e); if (f.faceMat.map !== m) { f.faceMat.map = m; f.faceMat.needsUpdate = true; } });
        rig.expr = e;
    };
    root.userData.rig = rig;
    return rig;
}

// A sandworm body segment (shared geometry, instanced per segment by the view).
export function wormSegment(i) {
    const r = 0.95 - i * 0.05;
    return toonMesh([part(sph(r, 16, 12), i % 2 ? '#c8984a' : '#d8a860'), part(tor(r * 0.95, 0.08, 6, 18), '#a87a3a', [0, 0, 0], [0, 0, 0])], { outline: 0.03 });
}

// A dragon neck segment.
export function neckSegment(color) { return toonMesh([part(sph(0.55, 12, 10), color)], { outline: 0.025 }); }

export { paint, merge };
