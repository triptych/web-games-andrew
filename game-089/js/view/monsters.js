// Monster models: each archetype is built from painted primitives with toon shading, ink
// outlines and a painted face. buildMonster(model) takes the `model` record from data.js
// ({ type, color, color2, scale, crown, ... }) and returns a rig:
//   { root, body, parts, flash, kind, height, setExpr(e), faces }
// animateMonster(rig, t, dt) adds the idle motion each archetype needs (wings, tentacles...).
// Monsters face +z; the battle view turns them toward the party.

import * as THREE from 'three';
import { part, merge, toonMesh, toonMat, withOutline, paintGrad, smoothed, sph, cyl, cone, box, caps, tor, lathe, ico, dodec, shade, glowMat } from './toon.js';
import { faceTexture, faceCap } from './face.js';

const PI = Math.PI;

function faceOn(group, R, spec, y = 0, z = 0, sx = 1, sy = 1) {
    const faceMat = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture(spec, 'normal'), depthWrite: false });
    const f = new THREE.Mesh(faceCap(R, sx, sy), faceMat);
    f.position.set(0, y, z);
    f.renderOrder = 2;
    group.add(f);
    return { f, faceMat, spec };
}

function legGeos(color, positions, len = 0.35, r = 0.07, foot = null) {
    const g = [];
    for (const [x, z] of positions) {
        g.push(part(caps(r, len, 6), color, [x, len / 2 + r, z]));
        if (foot) g.push(part(sph(r * 1.25, 8, 6), foot, [x, r * 0.8, z + r * 0.4], [0, 0, 0], [1, 0.6, 1.3]));
    }
    return g;
}

export function buildMonster(model = {}) {
    const type = model.type || 'slime';
    const c1 = model.color || '#6ae86a', c2 = model.color2 || '#ffffff';
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const mk = (geos, ol = 0.025, extra = {}) => toonMesh(geos, { mat: extra.mat ?? mat, outline: ol, ...extra });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const parts = {};
    const faces = [];
    const face = (...a) => { const f = faceOn(...a); faces.push(f); return f; };
    let height = 1.2;

    switch (type) {
        case 'slime': {
            const g = smoothed(paintGrad(new THREE.SphereGeometry(0.6, 22, 16), shade(c1, -0.25), c2, 1));
            g.scale(1, 0.82, 1);
            g.translate(0, 0.49, 0);
            const m = new THREE.Mesh(g, toonMat({ vertexColors: true, flash, emissive: shade(c1, -0.7) }));
            withOutline(m, 0.025);
            m.castShadow = true;
            body.add(m);
            body.add(mk([part(sph(0.12, 8, 6), '#ffffff', [-0.22, 0.82, 0.32], [0, 0, 0], [1, 0.7, 0.6]), part(cone(0.06, 0.25, 6), '#3a8a2a', [0.05, 1.05, 0], [0, 0, 0.3]), part(sph(0.12, 8, 6), '#5ad04a', [0.16, 1.12, 0], [0, 0, -0.8], [1, 0.35, 0.6])], 0.015));
            face(body, 0.6, { skin: c1, eyes: '#1a3a1a', mouth: 'cat', blush: 'rgba(255,140,160,0.6)', brows: false, eyeW: 18, eyeH: 24 }, 0.42, 0, 1, 0.82);
            height = 1.0;
            break;
        }
        case 'goblin': {
            const legs = new THREE.Group(); body.add(legs);
            legs.add(mk(legGeos(shade(c1, -0.2), [[-0.12, 0], [0.12, 0]], 0.22, 0.07, '#5a3a24')));
            body.add(mk([
                part(lathe([[0.001, 0.3], [0.26, 0.32], [0.3, 0.5], [0.22, 0.75], [0.001, 0.8]], 14), c2, [0, 0, 0]),
                part(tor(0.27, 0.035, 5, 14), '#3a2a1a', [0, 0.42, 0], [PI / 2, 0, 0]),
                part(sph(0.36, 18, 14), c1, [0, 1.05, 0], [0, 0, 0], [1.1, 0.95, 1]),
                ...[-1, 1].map((s) => part(cone(0.1, 0.5, 6), c1, [s * 0.45, 1.12, -0.02], [0, 0, s * -1.3], [1, 1, 0.5])),
                part(sph(0.1, 8, 6), shade(c1, -0.15), [0, 1.0, 0.36], [0, 0, 0], [1, 0.9, 1.3]),
            ]));
            const arm = new THREE.Group(); arm.position.set(-0.3, 0.68, 0); body.add(arm); parts.arm = arm;
            const wg = model.weapon === 'club' ? [part(cyl(0.07, 0.13, 0.7, 8), '#8a5a34', [0, -0.35, 0.05]), ...[0, 1, 2].map((i) => part(cone(0.04, 0.1, 4), '#d8d0c0', [Math.cos(i * 2) * 0.12, -0.55 - i * 0.05, Math.sin(i * 2) * 0.12 + 0.05], [0, 0, PI / 2 * (i - 1)]))] : [part(box(0.05, 0.36, 0.02), '#b8b8c0', [0, -0.35, 0.08]), part(box(0.14, 0.03, 0.04), '#8a5a34', [0, -0.16, 0.08])];
            arm.add(mk([part(caps(0.06, 0.18, 6), c1, [0, -0.12, 0]), ...wg], 0.015));
            const arm2 = new THREE.Group(); arm2.position.set(0.3, 0.68, 0); body.add(arm2); parts.arm2 = arm2;
            arm2.add(mk([part(caps(0.06, 0.18, 6), c1, [0, -0.12, 0])], 0.015));
            if (model.crown) {
                body.add(mk([
                    part(cyl(0.2, 0.24, 0.16, 10), '#ffd040', [0, 1.38, 0]),
                    ...[0, 1, 2, 3, 4].map((i) => part(cone(0.05, 0.12, 5), '#ffd040', [Math.sin(i * 1.26) * 0.2, 1.5, Math.cos(i * 1.26) * 0.2])),
                    part(sph(0.33, 14, 10), c2, [0, 0.55, 0.12], [0, 0, 0], [1.1, 1, 1]),
                ], 0.015));
                const capeG = new THREE.PlaneGeometry(0.6, 0.7, 3, 4); capeG.translate(0, -0.35, 0);
                const cape = new THREE.Mesh(capeG, toonMat({ color: '#8a3ad8', side: THREE.DoubleSide, flash }));
                cape.position.set(0, 0.85, -0.28); cape.rotation.x = 0.15; body.add(cape);
            }
            face(body, 0.36, { skin: c1, eyes: '#ffd23a', mouth: 'teeth', blush: false, eyeW: 20, eyeH: 22, eyeGap: 48 }, 1.05, 0, 1.1, 0.95);
            height = 1.4;
            break;
        }
        case 'boar': {
            const g = [
                part(sph(0.6, 18, 14), c1, [0, 0.62, -0.1], [0, 0, 0], [0.9, 0.8, 1.25]),
                part(sph(0.38, 14, 10), c1, [0, 0.6, 0.62]),
                part(cyl(0.15, 0.18, 0.2, 10), '#ffb0a0', [0, 0.55, 0.95], [PI / 2, 0, 0]),
                ...[-1, 1].map((s) => part(cone(0.04, 0.3, 6), '#fff8e8', [s * 0.17, 0.47, 0.92], [-0.6, 0, s * -0.4])),
                ...[-1, 1].map((s) => part(cone(0.1, 0.2, 5), shade(c1, -0.2), [s * 0.25, 0.93, 0.58], [0, 0, s * -0.4])),
                ...legGeos(c2, [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.45], [0.3, -0.45]], 0.2, 0.09, '#2a2a2a'),
                part(cone(0.04, 0.25, 4), c2, [0, 0.7, -0.85], [-1.2, 0, 0]),
            ];
            for (let i = 0; i < 9; i++) g.push(part(cone(0.07, 0.32, 5), '#4a7a3a', [((i % 3) - 1) * 0.15, 1.05 - Math.abs((i % 3) - 1) * 0.05, -0.55 + Math.floor(i / 3) * 0.3], [-0.3, 0, ((i % 3) - 1) * 0.5]));
            body.add(mk(g));
            face(body, 0.38, { skin: c1, eyes: '#2a1a1a', mouth: 'small', blush: false, eyeW: 14, eyeH: 16, eyeGap: 56, eyeY: 108, mouthY: 300 }, 0.6, 0.62);
            height = 1.1;
            break;
        }
        case 'bee': {
            const bz = new THREE.Group(); bz.position.y = 0.9; body.add(bz); parts.hover = bz;
            bz.add(mk([
                part(sph(0.45, 18, 14), c1, [0, 0, 0], [0, 0, 0], [1, 0.95, 1.1]),
                part(tor(0.4, 0.07, 6, 18), c2, [0, 0, -0.12], [0, 0, 0], [1.05, 1.05, 1]),
                part(tor(0.32, 0.07, 6, 18), c2, [0, 0, -0.32], [0, 0, 0], [1.05, 1.05, 1]),
                part(cone(0.07, 0.25, 6), c2, [0, -0.05, -0.55], [-PI / 2 - 0.3, 0, 0]),
                ...[-1, 1].map((s) => part(cyl(0.012, 0.012, 0.3, 4), c2, [s * 0.15, 0.48, 0.2], [0.3, 0, s * 0.4])),
                ...[-1, 1].map((s) => part(sph(0.05, 6, 5), c2, [s * 0.22, 0.62, 0.25])),
            ]));
            for (const s of [-1, 1]) {
                const w = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
                w.scale.set(0.55, 1, 1);
                const piv = new THREE.Group(); piv.position.set(s * 0.15, 0.35, -0.05); piv.add(w); w.position.set(s * 0.3, 0.1, 0); w.rotation.set(-PI / 2 + 0.3, 0, 0);
                bz.add(piv); (parts.wings ||= []).push(piv);
            }
            face(bz, 0.45, { skin: c1, eyes: '#1a1a1a', mouth: 'cat', blush: 'rgba(255,120,120,0.55)', brows: false, eyeW: 20, eyeH: 24 }, 0, 0.02, 1, 0.95);
            height = 1.5;
            break;
        }
        case 'shroom': {
            body.add(mk([
                part(cyl(0.3, 0.38, 0.65, 14), c2, [0, 0.45, 0]),
                part(new THREE.SphereGeometry(0.62, 18, 10, 0, PI * 2, 0, PI * 0.55), c1, [0, 0.72, 0], [0, 0, 0], [1, 0.8, 1]),
                part(cyl(0.6, 0.3, 0.08, 16), shade(c2, -0.05), [0, 0.73, 0]),
                ...[0, 1, 2, 3, 4, 5, 6].map((i) => part(sph(0.1, 8, 6), '#ffffff', [Math.cos(i * 0.9) * 0.38, 1.0 + (i % 2) * 0.08, Math.sin(i * 0.9) * 0.38], [0, 0, 0], [1, 0.5, 1])),
                ...[-1, 1].map((s) => part(sph(0.11, 8, 6), shade(c2, -0.2), [s * 0.17, 0.1, 0.06], [0, 0, 0], [1, 0.6, 1.3])),
                ...[-1, 1].map((s) => part(caps(0.05, 0.15, 6), c2, [s * 0.36, 0.45, 0.05], [0, 0, s * 0.8])),
            ]));
            face(body, 0.32, { skin: c2, eyes: '#5a2a1a', mouth: 'cat', blush: 'rgba(255,120,140,0.6)', brows: false, eyeW: 18, eyeH: 22, eyeGap: 46 }, 0.4, 0.04, 1, 0.9);
            height = 1.2;
            break;
        }
        case 'wisp': {
            const hv = new THREE.Group(); hv.position.y = 0.9; body.add(hv); parts.hover = hv;
            const g = smoothed(paintGrad(lathe([[0.001, -0.48], [0.3, -0.42], [0.47, -0.18], [0.5, 0.08], [0.42, 0.34], [0.26, 0.55], [0.1, 0.78], [0.001, 0.98]], 20), shade(c1, -0.3), c2, 1));
            const m = new THREE.Mesh(g, toonMat({ vertexColors: true, flash, emissive: shade(c1, -0.4), emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
            withOutline(m, 0.02, '#0a3040');
            hv.add(m);
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowMat(c2, 1.6));
            core.position.y = -0.15; hv.add(core);
            face(hv, 0.47, { skin: c1, eyes: '#ffffff', mouth: 'small', blush: false, brows: false, eyeW: 16, eyeH: 24, ink: '#03303a' }, 0.0, 0.02);
            const tails = [];
            for (let i = 0; i < 3; i++) tails.push(part(cone(0.14, 0.45, 8), shade(c1, -0.1), [(i - 1) * 0.22, -0.55, -0.05], [PI, 0, (i - 1) * 0.5]));
            hv.add(new THREE.Mesh(merge2(tails), toonMat({ vertexColors: true, flash, emissive: shade(c1, -0.4), transparent: true, opacity: 0.85 })));
            height = 1.6;
            break;
        }
        case 'spider': {
            body.add(mk([
                part(sph(0.5, 16, 12), c1, [0, 0.62, -0.45], [0, 0, 0], [1, 0.85, 1.1]),
                part(sph(0.18, 10, 8), c2, [0, 0.95, -0.45], [0, 0, 0], [1, 0.3, 1.6]),
                part(sph(0.32, 14, 10), shade(c1, 0.1), [0, 0.6, 0.2]),
                ...[-1, 1].map((s) => part(cone(0.04, 0.18, 5), '#2a1a2a', [s * 0.1, 0.42, 0.45], [-0.8, 0, 0])),
            ]));
            const legs = [];
            for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
                const leg = new THREE.Group();
                leg.position.set(s * 0.25, 0.62, 0.15 - i * 0.18);
                leg.rotation.y = s * (0.6 - i * 0.4);
                leg.add(mk([
                    part(cyl(0.04, 0.04, 0.5, 5), shade(c1, -0.2), [s * 0.22, 0.12, 0], [0, 0, s * -1.1]),
                    part(cyl(0.035, 0.02, 0.62, 5), shade(c1, -0.3), [s * 0.55, -0.15, 0], [0, 0, s * 0.45]),
                ], 0.012));
                body.add(leg);
                legs.push(leg);
            }
            parts.legs = legs;
            face(body, 0.32, { skin: shade(c1, 0.1), eyes: '#ff3a8a', mouth: 'small', blush: false, brows: false, eyeW: 15, eyeH: 18, eyeGap: 34, eyeY: 115, mouthY: 220 }, 0.6, 0.2);
            height = 1.1;
            break;
        }
        case 'treant': {
            const elder = !!model.elder;
            const g = [
                part(cyl(0.38, 0.55, 1.4, 10), c1, [0, 0.7, 0]),
                ...[0, 1, 2, 3].map((i) => part(caps(0.12, 0.45, 6), shade(c1, -0.15), [Math.cos(i * 1.6) * 0.5, 0.1, Math.sin(i * 1.6) * 0.5], [PI / 2 - 0.4, i * 1.6, 0])),
                part(ico(0.75, 1), c2, [0, 1.75, 0], [0, 0, 0], [1.1, 0.85, 1]),
                part(ico(0.45, 1), shade(c2, 0.15), [0.5, 1.95, 0.1]),
                part(ico(0.45, 1), shade(c2, -0.1), [-0.5, 1.9, -0.1]),
                part(sph(0.1, 8, 6), '#3a2a1a', [0.18, 0.55, 0.42], [0, 0, 0], [1, 1.4, 0.5]),
            ];
            if (elder) for (let i = 0; i < 10; i++) g.push(part(sph(0.08, 6, 5), i % 2 ? '#ffffff' : '#ffb0d8', [Math.cos(i * 2.2) * 0.75, 1.75 + Math.sin(i) * 0.4, Math.sin(i * 2.2) * 0.75]));
            body.add(mk(g));
            for (const s of [-1, 1]) {
                const a = new THREE.Group(); a.position.set(s * 0.42, 1.05, 0); body.add(a); (parts.arms ||= []).push(a);
                a.add(mk([part(cyl(0.08, 0.12, 0.7, 6), c1, [s * 0.25, -0.2, 0], [0, 0, s * 1.0]), part(cyl(0.04, 0.06, 0.35, 5), c1, [s * 0.6, -0.15, 0.05], [0, 0, s * 0.3]), part(ico(0.2, 0), c2, [s * 0.65, 0.05, 0.05])], 0.015));
            }
            face(body, 0.42, { skin: c1, eyes: elder ? '#ff8ad8' : '#ffd23a', mouth: 'teeth', blush: false, eyeW: 16, eyeH: 15, eyeGap: 46, eyeY: 120, brows: true, browColor: '#3a2412', bushy: true }, 0.95, 0.03);
            height = 2.3;
            break;
        }
        case 'crab': {
            body.add(mk([
                part(sph(0.55, 18, 12), c1, [0, 0.45, 0], [0, 0, 0], [1.25, 0.6, 1]),
                part(sph(0.45, 14, 10), c2, [0, 0.36, 0.08], [0, 0, 0], [1.15, 0.45, 0.95]),
                ...[-1, 1].map((s) => part(cyl(0.03, 0.03, 0.3, 5), c1, [s * 0.18, 0.75, 0.3])),
                ...[-1, 1].map((s) => part(sph(0.08, 8, 6), '#ffffff', [s * 0.18, 0.93, 0.3])),
                ...[-1, 1].map((s) => part(sph(0.04, 6, 5), '#1a1a1a', [s * 0.18, 0.95, 0.37])),
                ...[-1, 1].flatMap((s) => [0, 1, 2].map((i) => part(cyl(0.035, 0.025, 0.45, 5), shade(c1, -0.15), [s * (0.62 + i * 0.03), 0.22, -0.25 + i * 0.22], [0, 0, s * 1.0]))),
            ]));
            for (const s of [-1, 1]) {
                const cl = new THREE.Group(); cl.position.set(s * 0.6, 0.5, 0.35); body.add(cl); (parts.claws ||= []).push(cl);
                cl.add(mk([part(caps(0.08, 0.3, 6), c1, [s * 0.1, 0, 0.1], [0.9, 0, s * -0.5]), part(sph(0.22, 12, 10), c1, [s * 0.15, 0.1, 0.38], [0, 0, 0], [0.8, 1, 1.2]), part(cone(0.1, 0.28, 6), shade(c1, 0.15), [s * 0.12, 0.15, 0.62], [PI / 2, 0, 0], [1, 1, 0.6]), part(cone(0.08, 0.22, 6), shade(c1, 0.15), [s * 0.2, 0.0, 0.58], [PI / 2 + 0.3, 0, 0], [1, 1, 0.6])], 0.02));
            }
            height = 1.0;
            break;
        }
        case 'skeleton': {
            const bone = c1;
            body.add(mk([
                ...legGeos(bone, [[-0.12, 0], [0.12, 0]], 0.42, 0.04, '#2a2a2a'),
                part(box(0.32, 0.08, 0.12), bone, [0, 0.55, 0]),
                part(cyl(0.035, 0.035, 0.45, 5), bone, [0, 0.8, -0.02]),
                ...[0, 1, 2].map((i) => part(tor(0.15 - i * 0.015, 0.025, 4, 12, PI * 1.6), bone, [0, 0.72 + i * 0.1, 0.02], [PI / 2, 0, -PI * 0.3])),
                part(sph(0.28, 16, 12), bone, [0, 1.25, 0], [0, 0, 0], [1, 0.95, 1]),
                part(box(0.22, 0.12, 0.15), bone, [0, 1.05, 0.08]),
                part(tor(0.35, 0.03, 4, 16), c2, [0, 0.62, 0], [PI / 2, 0, 0]),
                part(box(0.32, 0.2, 0.2), c2, [0, 0.6, 0]),
            ], 0.018));
            if (model.hat) body.add(mk([part(sph(0.33, 16, 8), '#2a2a3a', [0, 1.45, 0], [0, 0, 0], [1.35, 0.35, 1.1]), part(sph(0.22, 12, 8), '#2a2a3a', [0, 1.55, 0], [0, 0, 0], [1, 0.6, 1]), part(box(0.1, 0.08, 0.02), '#ffffff', [0, 1.55, 0.21])], 0.015));
            const arm = new THREE.Group(); arm.position.set(-0.22, 0.98, 0); body.add(arm); parts.arm = arm;
            arm.add(mk([part(cyl(0.03, 0.03, 0.45, 5), bone, [0, -0.22, 0]), part(box(0.05, 0.5, 0.015), '#c8d0d8', [0, -0.6, 0.06]), part(tor(0.07, 0.015, 4, 10, PI), '#ffd25a', [0, -0.42, 0.06])], 0.012));
            const arm2 = new THREE.Group(); arm2.position.set(0.22, 0.98, 0); body.add(arm2); parts.arm2 = arm2;
            arm2.add(mk([part(cyl(0.03, 0.03, 0.45, 5), bone, [0, -0.22, 0])], 0.012));
            face(body, 0.28, { skin: bone, eyes: '#000000', ink: '#000000', mouth: 'teeth', blush: false, brows: false, eyeW: 24, eyeH: 26, eyeGap: 50, eyeY: 120 }, 1.25, 0.01);
            height = 1.6;
            break;
        }
        case 'harpy': {
            const hv = new THREE.Group(); hv.position.y = 0.55; body.add(hv); parts.hover = hv;
            hv.add(mk([
                part(lathe([[0.001, 0], [0.22, 0.05], [0.25, 0.3], [0.16, 0.55], [0.001, 0.6]], 12), c1, [0, 0, 0]),
                part(sph(0.26, 16, 12), c2, [0, 0.82, 0]),
                part(new THREE.SphereGeometry(0.29, 16, 10, 0, PI * 2, 0, PI * 0.6), '#4a3aa8', [0, 0.85, -0.04], [-0.3, 0, 0]),
                part(caps(0.12, 0.4, 8), '#4a3aa8', [0, 0.65, -0.28], [0.5, 0, 0]),
                ...[-1, 1].map((s) => part(cyl(0.025, 0.02, 0.4, 5), '#ffb04a', [s * 0.1, -0.15, 0])),
                ...[-1, 1].map((s) => part(cone(0.06, 0.12, 4), '#ffb04a', [s * 0.1, -0.36, 0.05], [PI / 2, 0, 0])),
            ]));
            for (const s of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(s * 0.2, 0.45, 0); hv.add(w); (parts.wings ||= []).push(w);
                const fe = [];
                for (let i = 0; i < 5; i++) fe.push(part(caps(0.06, 0.5 - i * 0.05, 5), i % 2 ? c1 : shade(c1, 0.2), [s * (0.25 + i * 0.12), -0.05 - i * 0.07, 0], [0, 0, s * (1.2 + i * 0.12)]));
                w.add(mk(fe, 0.012));
            }
            face(hv, 0.26, { skin: c2, eyes: '#6a2ad8', mouth: 'small', blush: 'rgba(255,120,150,0.6)', eyeW: 18, eyeH: 22, eyeGap: 48 }, 0.82, 0.01);
            height = 1.6;
            break;
        }
        case 'eel': {
            const pts = [];
            for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(Math.sin(t * PI * 1.6) * 0.35 * (1 - t), t * 1.5, Math.cos(t * PI * 1.6) * 0.25 * (1 - t) - 0.1)); }
            const curve = new THREE.CatmullRomCurve3(pts);
            const tube = new THREE.TubeGeometry(curve, 30, 0.2, 10, false);
            paintGrad(tube, shade(c1, -0.3), c1, 1);
            const tm = new THREE.Mesh(tube, toonMat({ vertexColors: true, flash }));
            withOutline(tm, 0.02); tm.castShadow = true; body.add(tm);
            const spots = [];
            for (let i = 1; i < 10; i++) { const p = curve.getPoint(i / 11); spots.push(part(sph(0.05, 6, 5), c2, [p.x, p.y, p.z + 0.18])); }
            body.add(mk([
                part(sph(0.32, 14, 12), c1, [0, 1.6, 0.05], [0, 0, 0], [1, 0.85, 1.25]),
                part(cone(0.18, 0.4, 3), c2, [0, 1.9, -0.15], [-0.4, 0, 0], [0.2, 1, 1]),
                part(tor(0.55, 0.12, 6, 16), shade(c1, -0.35), [0, 0.06, 0], [PI / 2, 0, 0]),
            ]));
            body.add(new THREE.Mesh(merge2(spots), glowMat(c2, 1.4)));
            face(body, 0.32, { skin: c1, eyes: '#ffe84a', mouth: 'teeth', blush: false, brows: false, eyeW: 16, eyeH: 16, eyeGap: 46 }, 1.6, 0.1, 1, 0.85);
            height = 2.0;
            break;
        }
        case 'imp': {
            const hv = new THREE.Group(); hv.position.y = 0.75; body.add(hv); parts.hover = hv;
            hv.add(mk([
                part(sph(0.42, 18, 14), c1, [0, 0, 0]),
                ...[-1, 1].map((s) => part(cone(0.08, 0.32, 8), c2, [s * 0.25, 0.42, 0], [0, 0, s * -0.45])),
                part(cyl(0.03, 0.05, 0.5, 6), c1, [0, -0.3, -0.42], [1.0, 0, 0]),
                part(cone(0.08, 0.14, 4), c2, [0, -0.45, -0.65], [1.8, 0, 0]),
                ...[-1, 1].map((s) => part(sph(0.08, 8, 6), c1, [s * 0.18, -0.42, 0.05])),
                ...[-1, 1].map((s) => part(new THREE.OctahedronGeometry(0.1, 0), '#bfefff', [s * 0.32, -0.05, 0.25])),
            ]));
            for (const s of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(s * 0.3, 0.15, -0.15); hv.add(w); (parts.wings ||= []).push(w);
                const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.6, 0.4); sh.lineTo(0.5, 0.05); sh.lineTo(0.35, -0.1); sh.lineTo(0.2, -0.05); sh.lineTo(0, 0);
                const wg = new THREE.ShapeGeometry(sh); if (s < 0) wg.scale(-1, 1, 1);
                const wm = new THREE.Mesh(wg, toonMat({ color: shade(c1, -0.2), side: THREE.DoubleSide, flash })); w.add(wm);
            }
            face(hv, 0.42, { skin: c1, eyes: '#2a4aff', mouth: 'teeth', blush: false, eyeW: 18, eyeH: 20 }, 0, 0);
            height = 1.5;
            break;
        }
        case 'wolf': {
            body.add(mk([
                part(sph(0.45, 16, 12), c1, [0, 0.62, -0.1], [0, 0, 0], [0.85, 0.8, 1.4]),
                part(sph(0.38, 14, 10), c2, [0, 0.72, 0.38], [0, 0, 0], [1, 0.95, 0.9]),
                part(sph(0.28, 14, 10), c1, [0, 0.92, 0.62]),
                part(cone(0.14, 0.32, 8), c1, [0, 0.86, 0.9], [PI / 2, 0, 0]),
                part(sph(0.05, 6, 5), '#1a1a1a', [0, 0.88, 1.06]),
                ...[-1, 1].map((s) => part(cone(0.09, 0.22, 4), c1, [s * 0.15, 1.18, 0.55], [0, 0, s * -0.3])),
                ...legGeos(shade(c1, -0.05), [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.45], [0.2, -0.45]], 0.22, 0.07, shade(c1, -0.2)),
            ]));
            const tail = new THREE.Group(); tail.position.set(0, 0.75, -0.65); body.add(tail); parts.tail = tail;
            tail.add(mk([part(caps(0.14, 0.32, 8), c2, [0, 0.05, -0.22], [-1.25, 0, 0]), part(sph(0.13, 8, 6), '#ffffff', [0, 0.14, -0.48])], 0.015));
            face(body, 0.28, { skin: c1, eyes: '#4ab0ff', mouth: 'small', blush: false, eyeW: 15, eyeH: 15, eyeGap: 40, eyeY: 110, mouthY: 300 }, 0.92, 0.62);
            height = 1.3;
            break;
        }
        case 'yeti': {
            const fur = [part(sph(0.75, 20, 16), c1, [0, 1.0, 0], [0, 0, 0], [1, 1.1, 0.9])];
            for (let i = 0; i < 18; i++) { const a = i * 2.4, y = 0.45 + (i % 6) * 0.22; const r = Math.sqrt(Math.max(0.1, 1 - ((y - 1.0) / 0.85) ** 2)) * 0.72; fur.push(part(cone(0.12, 0.25, 5), shade(c1, -0.04), [Math.sin(a) * r, y, Math.cos(a) * r], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2])); }
            fur.push(part(sph(0.42, 16, 12), c2, [0, 1.15, 0.45], [0, 0, 0], [1, 0.95, 0.55]));
            for (const s of [-1, 1]) {
                fur.push(part(cone(0.1, 0.38, 6), '#e8dcc0', [s * 0.45, 1.8, -0.05], [0, 0, s * -0.6]));
                fur.push(part(caps(0.2, 0.5, 8), c1, [s * 0.78, 0.8, 0.15], [0.3, 0, s * 0.35]));
                fur.push(part(sph(0.2, 10, 8), c2, [s * 0.92, 0.4, 0.3]));
                fur.push(part(caps(0.18, 0.2, 8), c1, [s * 0.32, 0.18, 0]));
            }
            body.add(mk(fur, 0.03));
            face(body, 0.42, { skin: c2, eyes: '#1a2a4a', mouth: 'teeth', blush: 'rgba(255,150,200,0.5)', eyeW: 20, eyeH: 22, eyeGap: 52, eyeY: 108 }, 1.15, 0.34, 1, 0.95);
            height = 2.0;
            break;
        }
        case 'golem': {
            const g = [
                part(dodec(0.6, 0), c1, [0, 1.0, 0], [0.3, 0.5, 0], [1.2, 1, 0.9]),
                part(dodec(0.38, 0), shade(c1, 0.1), [0, 1.75, 0.05], [0.2, 0.2, 0]),
                ...[-1, 1].flatMap((s) => [
                    part(dodec(0.3, 0), shade(c1, -0.08), [s * 0.78, 1.25, 0], [s, 0, 0]),
                    part(dodec(0.28, 0), c1, [s * 0.9, 0.75, 0.1], [0, s, 0]),
                    part(dodec(0.32, 0), shade(c1, 0.12), [s * 0.95, 0.35, 0.18], [s * 2, 0, 1]),
                    part(dodec(0.3, 0), shade(c1, -0.1), [s * 0.32, 0.25, 0], [0, s * 2, 0]),
                ]),
                part(crystalShard(), c2, [0.25, 1.35, -0.4], [-0.5, 0, 0.3]),
                part(crystalShard(), c2, [-0.3, 1.45, -0.35], [-0.4, 0, -0.4]),
            ];
            if (model.crown) for (let i = 0; i < 5; i++) g.push(part(cone(0.07, 0.35, 5), '#e8faff', [Math.cos(i * 1.26) * 0.28, 2.1, Math.sin(i * 1.26) * 0.28]));
            body.add(mk(g, 0.03));
            const eyes = new THREE.Mesh(merge2([part(sph(0.06, 8, 6), '#fff', [-0.12, 1.8, 0.36]), part(sph(0.06, 8, 6), '#fff', [0.12, 1.8, 0.36])]), glowMat(c2 === '#4a7ab0' ? '#7ae0ff' : '#5ad0ff', 2.0));
            body.add(eyes);
            height = 2.3;
            break;
        }
        case 'mimic': {
            body.add(mk([
                part(box(0.9, 0.5, 0.65), c1, [0, 0.3, 0]),
                part(box(0.94, 0.08, 0.69), c2, [0, 0.3, 0]),
                ...[-1, 1].map((s) => part(box(0.08, 0.52, 0.69), c2, [s * 0.4, 0.3, 0])),
                ...[0, 1, 2, 3, 4].map((i) => part(cone(0.05, 0.12, 4), '#ffffff', [-0.32 + i * 0.16, 0.6, 0.3], [PI, 0, 0])),
            ]));
            const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.32); body.add(lid); parts.lid = lid;
            lid.add(mk([
                part(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 12, 1, false, 0, PI), c1, [0, 0, 0.32], [0, 0, PI / 2]),
                ...[0, 1, 2, 3, 4].map((i) => part(cone(0.05, 0.12, 4), '#ffffff', [-0.32 + i * 0.16, -0.05, 0.62])),
                part(box(0.14, 0.18, 0.05), c2, [0, 0.1, 0.66]),
            ]));
            const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), toonMat({ color: '#ff5a8a', flash }));
            tongue.position.set(0, 0.6, 0.4); tongue.rotation.x = 1.0; body.add(tongue);
            face(lid, 0.3, { skin: c1, eyes: '#ff3a3a', mouth: 'small', blush: false, brows: true, eyeW: 16, eyeH: 14, eyeGap: 48, eyeY: 120, mouthY: 320 }, 0.15, 0.4);
            height = 1.1;
            break;
        }
        case 'kraken': {
            const g = [
                part(sph(0.7, 20, 16), c1, [0, 1.25, -0.1], [0, 0, 0], [1, 1.25, 1]),
                part(cone(0.55, 0.8, 14), c1, [0, 2.2, -0.25], [-0.3, 0, 0]),
                part(sph(0.5, 16, 12), c2, [0, 0.95, 0.38], [0, 0, 0], [1.1, 0.8, 0.6]),
                part(cyl(0.32, 0.38, 0.22, 10), '#ffd040', [0, 2.15, -0.2], [-0.3, 0, 0]),
                ...[0, 1, 2, 3, 4].map((i) => part(cone(0.05, 0.16, 5), '#ffd040', [Math.sin(i * 1.26) * 0.32, 2.35 + Math.cos(i * 1.26) * 0.06, -0.25 + Math.cos(i * 1.26) * 0.32 - 0.07])),
                part(sph(0.07, 6, 5), '#3ae0ff', [0, 2.18, 0.15]),
            ];
            body.add(mk(g, 0.03));
            parts.tentacles = [];
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * PI * 2 + 0.3;
                const tg = new THREE.Group(); tg.position.set(Math.cos(a) * 0.45, 0.65, Math.sin(a) * 0.45); tg.rotation.y = -a + PI / 2; body.add(tg);
                const segs = [];
                for (let k = 0; k < 5; k++) {
                    const s = new THREE.Group();
                    s.add(mk([part(sph(0.15 - k * 0.022, 10, 8), k % 2 ? c1 : shade(c1, 0.1), [0, 0, 0]), part(sph(0.05, 6, 4), c2, [0, -0.08, 0.06])], 0.015));
                    tg.add(s); segs.push(s);
                }
                parts.tentacles.push(segs);
            }
            face(body, 0.7, { skin: c1, eyes: '#ffd040', mouth: 'small', blush: 'rgba(255,100,180,0.5)', eyeW: 18, eyeH: 20, eyeGap: 50, eyeY: 120, mouthY: 300 }, 1.3, -0.08, 1, 1.25);
            height = 2.7;
            break;
        }
        case 'whelp': {
            const d = buildDragon({ scale: 0.32, whelp: true, color: c1, belly: c2 });
            body.add(d.root);
            Object.assign(parts, d.parts);
            parts.dragon = d;
            faces.push(...d.faces);
            height = 1.3;
            break;
        }
        case 'dragon': {
            const d = buildDragon({});
            body.add(d.root);
            Object.assign(parts, d.parts);
            parts.dragon = d;
            faces.push(...d.faces);
            height = 5.5;
            break;
        }
    }
    if (model.scale && type !== 'dragon') root.scale.setScalar(model.scale);
    root.traverse((o) => { if (o.isMesh && !o.userData.outline && o.material?.type !== 'MeshBasicMaterial') o.castShadow = true; });
    const rig = { root, body, parts, flash, kind: type, faces, expr: 'normal', height: height * (model.scale && type !== 'dragon' ? model.scale : 1), phase: Math.random() * 6 };
    rig.setExpr = (e) => {
        if (rig.expr === e) return;
        rig.expr = e;
        for (const f of faces) { const m = faceTexture(f.spec, e); if (f.faceMat.map !== m) { f.faceMat.map = m; f.faceMat.needsUpdate = true; } }
    };
    root.userData.rig = rig;
    return rig;
}

const merge2 = (geos) => merge(geos);

function crystalShard() {
    const c = new THREE.CylinderGeometry(0, 0.16, 0.7, 5);
    c.translate(0, 0.35, 0);
    return c;
}

// ================================================================== Pyrrhax

/**
 * The Ember Wyrm: a crimson body with a gold belly, a long neck and tail of segments, horns, a
 * jaw that opens, and bat wings. parts.pose(rig, t, mode) arranges the neck, tail and wings for
 * 'sleep' (curled round the crater), 'idle' and 'fly'.
 */
export function buildDragon(opts = {}) {
    const S = opts.scale ?? 1;
    const red = opts.color ?? '#d8382a', belly = opts.belly ?? '#ffc84a', dark = shade(red, -0.45), wingC = opts.whelp ? '#ff9a3a' : '#7a1a3a';
    const flash = { value: 0 };
    const mat = toonMat({ vertexColors: true, flash });
    const mk = (geos, ol = 0.04) => toonMesh(geos, { mat, outline: ol * (opts.whelp ? 0.6 : 1) });
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(S);
    root.add(inner);
    const parts = { flash };
    // torso
    const torso = new THREE.Group(); torso.position.y = 1.9; inner.add(torso); parts.torso = torso;
    const tg = [
        part(sph(1.3, 22, 16), red, [0, 0, 0], [0, 0, 0], [1, 0.9, 1.45]),
        part(sph(1.0, 18, 12), belly, [0, -0.35, 0.55], [0, 0, 0], [0.95, 0.75, 1.05]),
    ];
    for (let i = 0; i < 6; i++) tg.push(part(cone(0.18 - i * 0.012, 0.45, 5), '#ffd25a', [0, 1.05 - Math.abs(i - 2) * 0.05, -1.1 + i * 0.4], [-0.25, 0, 0]));
    torso.add(mk(tg));
    // legs
    for (const [x, z] of [[-0.8, 0.8], [0.8, 0.8], [-0.85, -0.8], [0.85, -0.8]]) {
        const l = new THREE.Group(); l.position.set(x, 1.2, z); inner.add(l);
        l.add(mk([part(caps(0.32, 0.5, 8), red, [0, -0.35, 0]), part(sph(0.33, 10, 8), dark, [0, -0.95, 0.15], [0, 0, 0], [1, 0.5, 1.4]), ...[-1, 0, 1].map((k) => part(cone(0.06, 0.2, 5), '#f4ecd8', [k * 0.16, -1.0, 0.55], [PI / 2, 0, 0]))]));
        (parts.legs ||= []).push(l);
    }
    // neck and head
    const neck = [];
    for (let i = 0; i < 6; i++) {
        const s = new THREE.Group();
        s.add(mk([part(sph(0.44 - i * 0.03, 14, 10), i % 2 ? red : shade(red, 0.06)), part(sph(0.3 - i * 0.018, 10, 8), belly, [0, -0.1, 0.18], [0, 0, 0], [1, 0.8, 0.8]), part(cone(0.09, 0.26, 5), '#ffd25a', [0, 0.4 - i * 0.03, -0.05], [-0.3, 0, 0])], 0.03));
        inner.add(s); neck.push(s);
    }
    parts.neck = neck;
    const head = new THREE.Group(); head.scale.setScalar(opts.whelp ? 1.15 : 1.35); inner.add(head); parts.head = head;
    head.add(mk([
        part(sph(0.58, 18, 14), red, [0, 0.02, -0.05], [0, 0, 0], [1, 0.85, 1.05]),
        part(sph(0.42, 16, 12), red, [0, -0.04, 0.55], [0.12, 0, 0], [0.82, 0.62, 1.25]),
        part(sph(0.22, 12, 10), shade(red, 0.08), [0, 0.04, 1.02], [0, 0, 0], [1.1, 0.7, 0.9]),
        ...[-1, 1].map((s) => part(sph(0.055, 6, 5), '#3a0a0a', [s * 0.11, 0.12, 1.18])),
        ...[-1, 1].map((s) => part(sph(0.2, 10, 8), shade(red, -0.15), [s * 0.3, 0.3, 0.12], [0, 0, 0], [1, 0.45, 1.4])),
        ...[-1, 1].map((s) => part(cone(0.13, 0.95, 8), '#f4ecd8', [s * 0.3, 0.55, -0.42], [-1.15, 0, s * 0.3])),
        ...[-1, 1].map((s) => part(cone(0.07, 0.42, 6), '#f4ecd8', [s * 0.5, 0.12, -0.25], [-1.5, 0, s * 0.95])),
        ...[-1, 1].map((s) => part(cone(0.04, 0.13, 4), '#ffffff', [s * 0.2, -0.2, 0.9], [PI, 0, 0])),
        ...[0, 1, 2].map((i) => part(cone(0.07, 0.22, 5), '#ffd25a', [0, 0.5 - i * 0.04, -0.15 - i * 0.22], [-0.6, 0, 0])),
    ], 0.03));
    const jaw = new THREE.Group(); jaw.position.set(0, -0.22, 0.2); head.add(jaw); parts.jaw = jaw;
    jaw.add(mk([part(sph(0.34, 14, 10), belly, [0, -0.04, 0.38], [0, 0, 0], [0.85, 0.35, 1.35]), ...[-1, 1].map((s) => part(cone(0.04, 0.12, 4), '#ffffff', [s * 0.18, 0.08, 0.72]))], 0.025));
    const mouthGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat('#ffb03a', 2.2));
    mouthGlow.position.set(0, -0.2, 0.85); mouthGlow.visible = false; head.add(mouthGlow); parts.mouthGlow = mouthGlow;
    // eyes: painted on a cap either side of the brow
    const faces = [];
    for (const s of [-1, 1]) {
        const spec = { skin: red, eyes: '#ffe03a', ink: '#2a0505', mouth: 'none', blush: false, brows: true, browColor: '#3a0a0a', bushy: true, eyeW: 30, eyeH: 26, eyeGap: 0, eyeY: 128 };
        const fm = new THREE.MeshBasicMaterial({ transparent: true, map: faceTexture(spec, 'normal'), depthWrite: false });
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.63 * 1.02, 16, 12, PI / 2 - 0.55, 1.1, PI * 0.25, PI * 0.35), fm);
        f.scale.set(1, 0.85, 1.1);
        f.rotation.y = s * 0.85;
        f.renderOrder = 2;
        head.add(f);
        faces.push({ f, faceMat: fm, spec });
    }
    // tail
    const tail = [];
    for (let i = 0; i < 9; i++) {
        const s = new THREE.Group();
        const r = 0.55 - i * 0.05;
        const g = [part(sph(r, 12, 10), i % 2 ? red : shade(red, 0.06)), part(cone(0.08, 0.25, 5), '#ffd25a', [0, r * 0.95, 0], [-0.4, 0, 0])];
        if (i === 8) g.push(part(new THREE.OctahedronGeometry(0.35, 0), '#ffd25a', [0, 0, -0.3], [0, 0, 0], [0.3, 1, 1.4]));
        s.add(mk(g, 0.03));
        inner.add(s); tail.push(s);
    }
    parts.tail = tail;
    // wings
    const wings = [];
    for (const sgn of [-1, 1]) {
        const piv = new THREE.Group(); piv.position.set(sgn * 0.7, 2.6, -0.3); inner.add(piv);
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(1.2, 1.6); sh.lineTo(3.8, 2.4); sh.lineTo(3.4, 0.9); sh.quadraticCurveTo(2.9, 0.4, 2.5, -0.2); sh.quadraticCurveTo(1.9, -0.1, 1.5, -0.8); sh.quadraticCurveTo(0.8, -0.5, 0, 0);
        const wg = new THREE.ShapeGeometry(sh, 8);
        if (sgn < 0) wg.scale(-1, 1, 1);
        paintGrad(wg, shade(wingC, -0.3), shade(wingC, 0.25), 0);
        const wing = new THREE.Mesh(wg, toonMat({ vertexColors: true, side: THREE.DoubleSide, flash }));
        wing.rotation.x = -PI / 2 + 0.5;
        withOutline(wing, 0.03);
        piv.add(wing);
        // bones along the leading edge and the fingers, in the membrane's own plane
        const bone = (a, b, r) => {
            const dx = (b[0] - a[0]) * sgn, dy = b[1] - a[1], len = Math.hypot(dx, dy);
            return part(cyl(r * 0.7, r, len, 6), dark, [(a[0] + b[0]) / 2 * sgn, (a[1] + b[1]) / 2, 0.02], [0, 0, -Math.atan2(dx, dy)]);
        };
        const knuckle = [1.2, 1.6];
        const bm = mk([bone([0, 0], knuckle, 0.1), bone(knuckle, [3.8, 2.4], 0.07), bone(knuckle, [3.4, 0.9], 0.05), bone(knuckle, [2.5, -0.2], 0.05), bone(knuckle, [1.5, -0.8], 0.05), part(cone(0.08, 0.3, 5), '#f4ecd8', [knuckle[0] * sgn, knuckle[1] + 0.15, 0.02])], 0.02);
        wing.add(bm);
        wings.push(piv);
    }
    parts.wings = wings;
    parts.wingSign = [-1, 1];
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    const rig = { root, inner, parts, faces, flash, kind: 'dragon', S };
    poseDragon(rig, 0, 'idle', 0);
    return rig;
}

/** Arrange the dragon's chains for a mode: sleep, idle, fly, roar, breathe (open jaw). */
export function poseDragon(d, t, mode = 'idle', openJaw = 0) {
    const P = d.parts;
    const breath = Math.sin(t * (mode === 'sleep' ? 1.1 : 2.2));
    P.torso.scale.set(1 + breath * 0.02, 1 + breath * 0.03, 1);
    const fly = mode === 'fly';
    P.torso.position.y = fly ? 2.6 + Math.sin(t * 3) * 0.25 : 1.9;
    for (const l of P.legs) { l.position.y = P.torso.position.y - 0.7; l.rotation.x = fly ? 0.6 : 0; }
    // neck: a curve from the shoulders to the head
    const n = P.neck.length;
    const base = new THREE.Vector3(0, P.torso.position.y + 0.5, 1.2);
    let dir;
    if (mode === 'sleep') dir = (i) => new THREE.Vector3(Math.sin(i * 0.45) * 0.6 + i * 0.12, -i * 0.18, 0.55 - i * 0.05);
    else dir = (i) => new THREE.Vector3(Math.sin(t * 0.9 + i * 0.4) * 0.05, 0.5 - i * 0.07 + (mode === 'roar' ? 0.06 : 0), 0.22 + i * 0.07);
    const p = base.clone();
    for (let i = 0; i < n; i++) { p.add(dir(i)); P.neck[i].position.copy(p); }
    const hp = p.clone().add(mode === 'sleep' ? new THREE.Vector3(0.6, -0.3, 0.2) : new THREE.Vector3(0, 0.2, 0.5));
    P.head.position.copy(hp);
    P.head.rotation.set(mode === 'sleep' ? 0.35 : mode === 'roar' ? -0.55 : -0.1 + Math.sin(t * 1.3) * 0.06, mode === 'sleep' ? 1.1 : Math.sin(t * 0.7) * 0.15, mode === 'sleep' ? 0.25 : 0);
    P.jaw.rotation.x = 0.1 + openJaw * 0.65;
    // tail: curls round to the front when asleep, sways otherwise
    const tb = new THREE.Vector3(0, P.torso.position.y - 0.2, -1.6);
    const q = tb.clone();
    for (let i = 0; i < P.tail.length; i++) {
        const k = i / P.tail.length;
        const step = mode === 'sleep'
            ? new THREE.Vector3(-Math.sin(k * 2.6) * 0.55, -0.12 + k * 0.02, -Math.cos(k * 2.6) * 0.55)
            : new THREE.Vector3(Math.sin(t * 1.6 + i * 0.5) * 0.18, -0.13 + (fly ? 0.05 : 0), -0.55);
        q.add(step);
        P.tail[i].position.copy(q);
    }
    // wings: folded asleep, flap in flight
    const flap = fly ? Math.sin(t * 6) * 0.7 : mode === 'roar' ? -0.4 + Math.sin(t * 10) * 0.08 : mode === 'sleep' ? 0.85 : 0.3 + Math.sin(t * 1.5) * 0.12;
    P.wings.forEach((w, i) => {
        const s = i === 0 ? -1 : 1;
        w.position.y = P.torso.position.y + 0.7;
        w.rotation.set(mode === 'sleep' ? 0.2 : 0, s * (mode === 'sleep' ? 1.1 : 0.35), s * -flap);
    });
}

/** Idle motion per archetype. */
export function animateMonster(rig, t, dt = 0.016, mode = 'idle') {
    const P = rig.parts;
    const ph = t + rig.phase;
    switch (rig.kind) {
        case 'slime': { const sq = 1 + Math.sin(ph * 6.8) * 0.07; rig.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); break; }
        case 'bee': case 'harpy': case 'imp': case 'wisp':
            if (P.hover) P.hover.position.y = (rig.kind === 'harpy' ? 0.55 : rig.kind === 'imp' ? 0.75 : 0.9) + Math.sin(ph * 3) * 0.12;
            if (P.wings) P.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * ((rig.kind === 'harpy' ? 0.45 : 0) + Math.sin(ph * (rig.kind === 'bee' ? 40 : 9)) * (rig.kind === 'bee' ? 0.4 : 0.35)); });
            if (rig.kind === 'wisp') rig.body.rotation.z = Math.sin(ph * 2) * 0.1;
            break;
        case 'spider': P.legs?.forEach((l, i) => { l.rotation.x = Math.sin(ph * 8 + i) * 0.12; }); break;
        case 'treant': P.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * Math.sin(ph * 1.5) * 0.15; }); rig.body.rotation.z = Math.sin(ph * 1.2) * 0.03; break;
        case 'crab': P.claws?.forEach((c, i) => { c.rotation.x = Math.sin(ph * 4 + i * 2) * 0.2; }); rig.body.position.x = Math.sin(ph * 2) * 0.05; break;
        case 'wolf': if (P.tail) P.tail.rotation.y = Math.sin(ph * 8) * 0.4; break;
        case 'goblin': case 'skeleton': rig.body.position.y = Math.abs(Math.sin(ph * 4)) * 0.04; if (P.arm) P.arm.rotation.x = -0.3 + Math.sin(ph * 2) * 0.1; break;
        case 'boar': rig.body.rotation.x = Math.sin(ph * 5) * 0.03; break;
        case 'eel': rig.body.rotation.y = Math.sin(ph * 1.5) * 0.3; break;
        case 'yeti': case 'golem': rig.body.rotation.z = Math.sin(ph * 1.8) * 0.03; rig.body.position.y = Math.abs(Math.sin(ph * 1.8)) * 0.03; break;
        case 'mimic': if (P.lid) P.lid.rotation.x = -0.35 - Math.abs(Math.sin(ph * 3)) * 0.35; break;
        case 'kraken':
            P.tentacles?.forEach((segs, i) => {
                let x = 0, y = 0, z = 0;
                segs.forEach((s, k) => {
                    const a = Math.sin(ph * 2 + i + k * 0.7) * 0.4;
                    z += 0.24; y += -0.08 + Math.sin(a) * 0.1; x += Math.sin(a + i) * 0.06;
                    s.position.set(x, y, z);
                });
            });
            rig.body.position.y = Math.sin(ph * 1.5) * 0.08;
            break;
        case 'whelp': case 'dragon': {
            const d = P.dragon;
            poseDragon(d, ph, mode === 'idle' ? (rig.kind === 'whelp' ? 'fly' : 'idle') : mode, rig.jaw ?? 0);
            break;
        }
    }
}
