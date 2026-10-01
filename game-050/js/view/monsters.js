/**
 * monsters.js — procedural monsters, rigged like characters so the same
 * animator drives them. view = { plan, el, size, seed, boss }.
 */

import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { part, toonMesh, glowMat, merge, paint, paintGradient, shade, mix } from './toon.js';
import { faceTexture, faceCap } from './face.js';
import { buildCharacter, taper, sph, caps, cyl, cone, box, tor } from './chars.js';
import { generateLook } from '../sim/heroes.js';

const PI = Math.PI;
export const EL_BODY = { fire: '#ff7a4a', water: '#4aa8ff', wind: '#62d36a', light: '#ffd86a', dark: '#9a6aff' };
export const EL_DARK = { fire: '#a8321a', water: '#1f5aa8', wind: '#2a8a3a', light: '#c89a2a', dark: '#4a2a8a' };

function faceMesh(look, r) {
    const mat = new THREE.MeshBasicMaterial({ map: faceTexture(look), transparent: true, alphaTest: 0.35, depthWrite: false });
    const m = new THREE.Mesh(faceCap(r), mat);
    m.renderOrder = 2;
    m.userData.look = look;
    return m;
}

function glowEyes(color, pts, r = 0.035) {
    return new THREE.Mesh(merge(pts.map((p) => part(sph(r, 10, 8), color, p))), glowMat());
}

function baseRig(kind, plan) {
    const flash = { value: 0 }, flashColor = { value: new THREE.Color('#ffffff') };
    const root = new THREE.Group();
    const holder = new THREE.Group();
    root.add(holder);
    return { root, holder, flash, flashColor, kind, plan, legs: [], expr: 'normal', setExpression() {} };
}

function attachFace(rig, look, r, parent, pos, scale = 1) {
    const f = faceMesh(look, r);
    f.position.set(...pos);
    f.scale.setScalar(scale);
    parent.add(f);
    rig.face = f;
    rig.setExpression = (expr) => {
        if (rig.expr === expr) return;
        rig.expr = expr;
        f.material.map = faceTexture(look, expr);
        f.material.needsUpdate = true;
    };
}

const PLANS = {
    slime(rig, v, rng) {
        const c = EL_BODY[v.el];
        const body = new THREE.Group();
        rig.holder.add(body);
        const g = paintGradient(sph(0.42, 28, 20), shade(c, -0.25), shade(c, 0.35), 1);
        g.scale(1, 0.78, 1); g.translate(0, 0.33, 0);
        const hi = part(sph(0.09, 10, 8), '#ffffff', [-0.16, 0.55, 0.22], [0, 0, 0], [1, 0.6, 0.5]);
        body.add(toonMesh([g, hi], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.02 }));
        const head = new THREE.Group(); head.position.y = 0.33; body.add(head);
        attachFace(rig, { eyes: rng.pick([0, 3, 7]), eyeColor: '#2a1a3a', brows: 0, mouth: rng.pick([0, 1, 7]), blush: true, marks: 0 }, 0.34, head, [0, -0.04, 0.12], 1);
        if (v.boss) head.add(toonMesh([part(cyl(0.16, 0.14, 0.12, 12, true), '#ffd24a', [0, 0.36, 0])], { flash: rig.flash }));
        Object.assign(rig, { body, head, height: 0.68, headY: 0.4 });
    },
    wolf(rig, v, rng) {
        const fur = mix(v.boss ? '#e8f0ff' : '#8a8a96', EL_BODY[v.el], 0.35), belly = shade(fur, 0.35), dark = shade(fur, -0.35);
        const body = new THREE.Group(); body.position.y = 0.42; rig.holder.add(body);
        body.add(toonMesh([
            part(caps(0.17, 0.42, 12), fur, [0, 0, -0.05], [PI / 2, 0, 0], [1, 1, 0.95]),
            part(sph(0.15, 12, 10), belly, [0, -0.06, 0.12], [0, 0, 0], [1, 0.8, 1.2]),
            part(sph(0.2, 12, 10), fur, [0, 0.06, 0.2], [0, 0, 0], [1.05, 1, 1]),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        const neck = new THREE.Group(); neck.position.set(0, 0.12, 0.3); body.add(neck);
        const head = new THREE.Group(); head.position.set(0, 0.08, 0.08); neck.add(head);
        head.add(toonMesh([
            part(sph(0.16, 14, 12), fur, [0, 0, 0]),
            part(cone(0.09, 0.2, 10), fur, [0, -0.03, 0.18], [PI / 2, 0, 0], [1, 1, 0.75]),
            part(sph(0.03, 8, 6), '#1a1020', [0, -0.01, 0.28]),
            part(cone(0.06, 0.15, 4), fur, [0.09, 0.15, -0.02], [0, PI / 4, -0.25], [1, 1, 0.5]),
            part(cone(0.06, 0.15, 4), fur, [-0.09, 0.15, -0.02], [0, PI / 4, 0.25], [1, 1, 0.5]),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        head.add(glowEyes(v.boss ? '#7af0ff' : '#ffe14a', [[0.07, 0.04, 0.12], [-0.07, 0.04, 0.12]], 0.03));
        for (const [x, z] of [[0.1, 0.2], [-0.1, 0.2], [0.1, -0.24], [-0.1, -0.24]]) {
            const leg = new THREE.Group(); leg.position.set(x, -0.05, z); body.add(leg);
            leg.add(toonMesh([part(caps(0.055, 0.26, 8), fur, [0, -0.17, 0]), part(sph(0.065, 8, 6), dark, [0, -0.34, 0.02], [0, 0, 0], [1, 0.7, 1.3])], { flash: rig.flash }));
            rig.legs.push(leg);
        }
        const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.32); body.add(tail);
        const t = taper([[0, 0, 0], [0, 0.08, -0.15], [0, 0.18, -0.28]], 0.07, 0.03, 10, 8); paintGradient(t, fur, belly, 2, null, null);
        tail.add(toonMesh(t, { flash: rig.flash }));
        if (v.boss) body.add(toonMesh(Array.from({ length: 6 }, (_, i) => part(cone(0.04, 0.16, 6), '#c8e8ff', [0, 0.18, 0.15 - i * 0.08], [-0.3, 0, 0])), { flash: rig.flash }));
        Object.assign(rig, { body, neck, head, tail, legL: rig.legs[0], legR: rig.legs[1], height: 0.78, headY: 0.62 });
    },
    mushroom(rig, v, rng) {
        const cap = EL_BODY[v.el], stem = '#f4e8d0';
        const body = new THREE.Group(); rig.holder.add(body);
        body.add(toonMesh([
            part(cyl(0.16, 0.2, 0.36, 16), stem, [0, 0.24, 0]),
            part(sph(0.09, 8, 6), shade(stem, -0.1), [0.1, 0.04, 0.05], [0, 0, 0], [1, 0.6, 1.3]),
            part(sph(0.09, 8, 6), shade(stem, -0.1), [-0.1, 0.04, 0.05], [0, 0, 0], [1, 0.6, 1.3]),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        const head = new THREE.Group(); head.position.y = 0.42; body.add(head);
        const capG = paintGradient(new THREE.SphereGeometry(0.36, 24, 14, 0, PI * 2, 0, PI * 0.55), shade(cap, -0.2), shade(cap, 0.15), 1);
        capG.scale(1, 0.75, 1);
        const spots = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * PI * 2, b = 0.5 + (i % 2) * 0.35; return part(sph(0.05, 8, 6), '#fffaf0', [Math.sin(a) * Math.sin(b) * 0.36, Math.cos(b) * 0.27, Math.cos(a) * Math.sin(b) * 0.36], [0, 0, 0], [1, 0.4, 1]); });
        head.add(toonMesh([capG, ...spots], { flash: rig.flash, flashColor: rig.flashColor }));
        attachFace(rig, { eyes: rng.pick([0, 2, 3]), eyeColor: '#2a1a1a', brows: rng.pick([0, 2]), mouth: rng.pick([0, 4, 5]), blush: true, marks: 0 }, 0.2, body, [0, 0.24, 0.0], 1);
        rig.face.scale.set(0.95, 1, 0.95);
        Object.assign(rig, { body, head, height: 0.74, headY: 0.42 });
    },
    golem(rig, v, rng) {
        const stone = v.el === 'light' ? '#e8d8b0' : v.el === 'dark' ? '#4a4458' : v.el === 'water' ? '#a8c0d8' : v.el === 'fire' ? '#6a4a40' : '#8a9a7a';
        const crystal = EL_BODY[v.el];
        const body = new THREE.Group(); body.position.y = 0.55; rig.holder.add(body);
        body.add(toonMesh([
            part(new THREE.DodecahedronGeometry(0.3, 0), stone, [0, 0.05, 0], [0.2, 0.3, 0], [1.15, 1, 0.85]),
            part(new THREE.IcosahedronGeometry(0.16, 0), shade(stone, -0.1), [0, -0.22, 0]),
        ], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.02 }));
        body.add(new THREE.Mesh(merge([
            part(new THREE.OctahedronGeometry(0.08), crystal, [0.12, 0.32, -0.1], [0.3, 0, 0.4], [0.7, 1.6, 0.7]),
            part(new THREE.OctahedronGeometry(0.06), crystal, [-0.15, 0.3, -0.05], [-0.3, 0, -0.5], [0.7, 1.5, 0.7]),
            part(new THREE.OctahedronGeometry(0.05), crystal, [0, 0.08, 0.27], [0, 0, 0], [1, 1, 0.4]),
        ]), glowMat()));
        const neck = new THREE.Group(); neck.position.y = 0.3; body.add(neck);
        const head = new THREE.Group(); head.position.y = 0.08; neck.add(head);
        head.add(toonMesh([part(new THREE.IcosahedronGeometry(0.15, 0), stone, [0, 0, 0.04], [0, 0, 0], [1.1, 0.9, 1])], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.016 }));
        head.add(glowEyes(crystal, [[0.06, 0.02, 0.17], [-0.06, 0.02, 0.17]], 0.03));
        const arm = (k) => {
            const a = new THREE.Group(); a.position.set(k * 0.36, 0.15, 0); a.rotation.z = k * 0.15;
            a.add(toonMesh([
                part(new THREE.IcosahedronGeometry(0.12, 0), stone, [0, -0.05, 0]),
                part(new THREE.IcosahedronGeometry(0.11, 0), shade(stone, -0.05), [0, -0.25, 0.02]),
                part(new THREE.DodecahedronGeometry(0.15, 0), shade(stone, 0.05), [0, -0.46, 0.04]),
            ], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.016 }));
            body.add(a); return a;
        };
        const leg = (k) => {
            const l = new THREE.Group(); l.position.set(k * 0.15, 0.32, 0);
            l.add(toonMesh([part(new THREE.IcosahedronGeometry(0.13, 0), shade(stone, -0.1), [0, -0.18, 0], [0, 0, 0], [1, 1.3, 1])], { flash: rig.flash, outline: 0.016 }));
            rig.holder.add(l); return l;
        };
        Object.assign(rig, { body, neck, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1), height: 1.15, headY: 0.95 });
    },
    whelp(rig, v, rng, big = false) {
        const c = EL_BODY[v.el], belly = shade(c, 0.45), dk = EL_DARK[v.el];
        const body = new THREE.Group(); body.position.y = 0.4; rig.holder.add(body);
        body.add(toonMesh([
            part(caps(0.17, 0.3, 12), c, [0, 0.02, -0.02], [PI / 2 - 0.5, 0, 0]),
            part(sph(0.13, 12, 10), belly, [0, -0.02, 0.1], [0.5, 0, 0], [1, 1.3, 0.7]),
            ...Array.from({ length: 4 }, (_, i) => part(cone(0.035, 0.1, 5), dk, [0, 0.17 - i * 0.02, 0.05 - i * 0.1], [-0.4, 0, 0])),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        const neck = new THREE.Group(); neck.position.set(0, 0.2, 0.15); body.add(neck);
        const head = new THREE.Group(); head.position.set(0, 0.1, 0.05); neck.add(head);
        head.add(toonMesh([
            part(sph(0.16, 16, 12), c, [0, 0, 0]),
            part(sph(0.1, 12, 10), c, [0, -0.04, 0.15], [0, 0, 0], [1, 0.75, 1.2]),
            part(sph(0.015, 6, 4), '#1a1020', [0.04, 0.0, 0.27]), part(sph(0.015, 6, 4), '#1a1020', [-0.04, 0.0, 0.27]),
            part(cone(0.035, 0.18, 6), '#f4ead0', [0.08, 0.13, -0.07], [-0.7, 0, -0.2]),
            part(cone(0.035, 0.18, 6), '#f4ead0', [-0.08, 0.13, -0.07], [-0.7, 0, 0.2]),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        attachFace(rig, { eyes: big ? 4 : rng.pick([0, 1, 6]), eyeColor: big ? '#ffd84a' : '#ffb02a', brows: big ? 2 : 0, mouth: big ? 5 : 7, blush: !big, marks: 0 }, 0.16, head, [0, 0.02, 0], 1);
        const wing = (k) => {
            const w = new THREE.Group(); w.position.set(k * 0.08, 0.16, -0.05);
            const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.35, 0.25); s.lineTo(0.5, 0.1); s.lineTo(0.38, 0.02); s.lineTo(0.3, -0.08); s.lineTo(0.15, -0.02); s.lineTo(0, -0.06);
            const mem = new THREE.ShapeGeometry(s); paint(mem, shade(c, -0.15));
            const bone = taper([[0, 0, 0], [0.2, 0.15, 0.005], [0.35, 0.25, 0.01]], 0.022, 0.008, 8, 5); paint(bone, dk);
            const m = toonMesh([mem, bone], { side: THREE.DoubleSide, flash: rig.flash, outline: 0.006 });
            m.scale.x = k; m.rotation.y = -k * 0.3;
            w.add(m); body.add(w); return w;
        };
        const tail = new THREE.Group(); tail.position.set(0, -0.08, -0.2); body.add(tail);
        const t = taper([[0, 0, 0], [0, -0.1, -0.2], [0, -0.15, -0.4], [0.06, -0.12, -0.55]], 0.08, 0.012, 14, 8); paintGradient(t, c, dk, 2);
        tail.add(toonMesh([t, part(cone(0.06, 0.1, 4), dk, [0.07, -0.11, -0.58], [-1.2, 0, 0], [1, 1, 0.3])], { flash: rig.flash }));
        for (const [x, z] of [[0.11, 0.08], [-0.11, 0.08], [0.11, -0.15], [-0.11, -0.15]]) {
            const leg = new THREE.Group(); leg.position.set(x, -0.12, z); body.add(leg);
            leg.add(toonMesh([part(caps(0.05, 0.12, 8), c, [0, -0.1, 0]), part(sph(0.06, 8, 6), dk, [0, -0.19, 0.03], [0, 0, 0], [1, 0.6, 1.3])], { flash: rig.flash }));
            rig.legs.push(leg);
        }
        Object.assign(rig, { body, neck, head, tail, wingL: wing(1), wingR: wing(-1), legL: rig.legs[0], legR: rig.legs[1], height: 0.85, headY: 0.7 });
    },
    dragon(rig, v, rng) { PLANS.whelp(rig, v, rng, true); },
    wisp(rig, v, rng) {
        const c = EL_BODY[v.el];
        const body = new THREE.Group(); body.position.y = 0.6; rig.holder.add(body);
        const core = paintGradient(sph(0.2, 20, 16), shade(c, 0.6), c, 1);
        body.add(new THREE.Mesh(core, glowMat()));
        const shell = new THREE.Mesh(paint(sph(0.3, 20, 16), c), glowMat({ transparent: true, opacity: 0.32, additive: true }));
        body.add(shell);
        const flame = taper([[0, 0.12, 0], [0.02, 0.3, -0.04], [-0.03, 0.48, -0.08]], 0.16, 0.01, 12, 10);
        paintGradient(flame, c, shade(c, 0.7), 1);
        body.add(new THREE.Mesh(flame, glowMat({ transparent: true, opacity: 0.75, additive: true })));
        const head = new THREE.Group(); body.add(head);
        attachFace(rig, { eyes: 3, eyeColor: '#1a1a2a', brows: 0, mouth: 3, blush: false, marks: 0 }, 0.2, head, [0, -0.02, 0.02], 1);
        Object.assign(rig, { body, head, height: 1.0, headY: 0.6, floats: true });
    },
    spider(rig, v, rng) {
        const c = v.el === 'light' ? '#e8f0ff' : mix('#3a3040', EL_BODY[v.el], 0.3), mark = EL_BODY[v.el];
        const body = new THREE.Group(); body.position.y = 0.32; rig.holder.add(body);
        body.add(toonMesh([
            part(sph(0.25, 18, 14), c, [0, 0.08, -0.25], [0, 0, 0], [1, 0.85, 1.15]),
            part(sph(0.08, 10, 8), mark, [0, 0.27, -0.28], [0.3, 0, 0], [1.2, 0.3, 1]),
            part(sph(0.15, 14, 12), shade(c, 0.1), [0, 0.02, 0.05]),
        ], { flash: rig.flash, flashColor: rig.flashColor }));
        const head = new THREE.Group(); head.position.set(0, 0.04, 0.17); body.add(head);
        head.add(toonMesh([part(sph(0.1, 12, 10), shade(c, 0.15), [0, 0, 0]), part(cone(0.02, 0.08, 5), '#f0e8e0', [0.04, -0.07, 0.07], [2.6, 0, 0]), part(cone(0.02, 0.08, 5), '#f0e8e0', [-0.04, -0.07, 0.07], [2.6, 0, 0])], { flash: rig.flash }));
        head.add(glowEyes(v.boss ? '#ffffff' : '#ff3a4a', [[0.035, 0.04, 0.085], [-0.035, 0.04, 0.085], [0.06, 0.07, 0.06], [-0.06, 0.07, 0.06]], 0.018));
        for (let i = 0; i < 8; i++) {
            const k = i < 4 ? 1 : -1, j = i % 4;
            const leg = new THREE.Group(); leg.position.set(k * 0.1, 0.02, 0.1 - j * 0.07); leg.rotation.y = k * (0.5 - j * 0.35); body.add(leg);
            const t = taper([[0, 0, 0], [k * 0.22, 0.18, 0], [k * 0.38, -0.3, 0]], 0.03, 0.012, 10, 6); paint(t, shade(c, -0.1));
            leg.add(toonMesh(t, { flash: rig.flash, outline: 0.008 }));
            rig.legs.push(leg);
        }
        if (v.boss) body.add(new THREE.Mesh(merge(Array.from({ length: 6 }, (_, i) => part(new THREE.OctahedronGeometry(0.06), '#c8f0ff', [Math.cos(i) * 0.15, 0.3, -0.25 + Math.sin(i) * 0.15], [0, 0, 0], [0.6, 1.8, 0.6]))), glowMat()));
        Object.assign(rig, { body, head, height: 0.7, headY: 0.4 });
    },
    crab(rig, v, rng) {
        const c = v.el === 'water' ? '#ff6a4a' : EL_BODY[v.el], dk = shade(c, -0.3);
        const body = new THREE.Group(); body.position.y = 0.3; rig.holder.add(body);
        body.add(toonMesh([part(sph(0.28, 18, 14), c, [0, 0, 0], [0, 0, 0], [1.25, 0.6, 1]), part(sph(0.18, 12, 10), shade(c, 0.35), [0, -0.06, 0.08], [0, 0, 0], [1.2, 0.5, 0.9])], { flash: rig.flash, flashColor: rig.flashColor }));
        const head = new THREE.Group(); head.position.set(0, 0.12, 0.18); body.add(head);
        head.add(toonMesh([part(cyl(0.015, 0.02, 0.14, 6), dk, [0.07, 0.06, 0]), part(cyl(0.015, 0.02, 0.14, 6), dk, [-0.07, 0.06, 0])], { flash: rig.flash, outline: 0.006 }));
        head.add(toonMesh([part(sph(0.04, 10, 8), '#ffffff', [0.07, 0.14, 0]), part(sph(0.04, 10, 8), '#ffffff', [-0.07, 0.14, 0]), part(sph(0.02, 8, 6), '#1a1020', [0.07, 0.14, 0.03]), part(sph(0.02, 8, 6), '#1a1020', [-0.07, 0.14, 0.03])], { flash: rig.flash, outline: 0.006 }));
        const claw = (k) => {
            const a = new THREE.Group(); a.position.set(k * 0.3, 0.02, 0.15); body.add(a);
            a.add(toonMesh([part(caps(0.04, 0.14, 8), c, [k * 0.06, 0, 0.06], [0, k * 0.8, PI / 2]), part(sph(0.1, 12, 10), c, [k * 0.12, 0.04, 0.18], [0, 0, 0], [1, 0.8, 1.2]), part(cone(0.05, 0.14, 6), dk, [k * 0.1, 0.08, 0.3], [PI / 2 - 0.3, 0, 0])], { flash: rig.flash, flashColor: rig.flashColor }));
            return a;
        };
        for (let i = 0; i < 6; i++) {
            const k = i < 3 ? 1 : -1, j = i % 3;
            const leg = new THREE.Group(); leg.position.set(k * 0.25, -0.02, 0.02 - j * 0.1); body.add(leg);
            const t = taper([[0, 0, 0], [k * 0.12, 0.06, 0], [k * 0.2, -0.26, 0]], 0.025, 0.012, 8, 5); paint(t, dk);
            leg.add(toonMesh(t, { flash: rig.flash, outline: 0.006 }));
            rig.legs.push(leg);
        }
        Object.assign(rig, { body, head, armL: claw(1), armR: claw(-1), height: 0.6, headY: 0.42 });
    },
    treant(rig, v, rng) {
        const bark = '#6a4a32', leaf = v.el === 'wind' ? '#4fae3a' : mix('#4fae3a', EL_BODY[v.el], 0.5);
        const body = new THREE.Group(); body.position.y = 0.2; rig.holder.add(body);
        const trunk = paintGradient(cyl(0.22, 0.3, 0.9, 14), shade(bark, -0.2), bark, 1);
        trunk.translate(0, 0.45, 0);
        body.add(toonMesh([trunk, ...Array.from({ length: 5 }, (_, i) => part(cone(0.06, 0.4, 6), shade(bark, -0.15), [Math.sin(i * 1.3) * 0.25, 0.1, Math.cos(i * 1.3) * 0.25], [Math.cos(i * 1.3) * 1.9, 0, -Math.sin(i * 1.3) * 1.9]))], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.02 }));
        const head = new THREE.Group(); head.position.y = 1.0; body.add(head);
        const leaves = [];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; leaves.push(part(new THREE.IcosahedronGeometry(0.28, 1), i % 2 ? leaf : shade(leaf, 0.15), [Math.sin(a) * 0.32, 0.15 + (i % 3) * 0.12, Math.cos(a) * 0.28])); }
        leaves.push(part(new THREE.IcosahedronGeometry(0.35, 1), shade(leaf, 0.1), [0, 0.45, 0]));
        head.add(toonMesh(leaves, { flash: rig.flash, flashColor: rig.flashColor, outline: 0.02 }));
        body.add(glowEyes('#b8ff6a', [[0.09, 0.62, 0.24], [-0.09, 0.62, 0.24]], 0.045));
        body.add(toonMesh([part(sph(0.07, 10, 8), '#2a1a10', [0, 0.45, 0.24], [0, 0, 0], [1.6, 0.7, 0.5])], { outline: false }));
        const arm = (k) => {
            const a = new THREE.Group(); a.position.set(k * 0.24, 0.7, 0); body.add(a);
            const t = taper([[0, 0, 0], [k * 0.25, -0.1, 0.05], [k * 0.35, -0.4, 0.1], [k * 0.3, -0.55, 0.15]], 0.07, 0.025, 12, 8); paint(t, bark);
            a.add(toonMesh([t, part(new THREE.IcosahedronGeometry(0.14, 1), leaf, [k * 0.3, -0.58, 0.15])], { flash: rig.flash, flashColor: rig.flashColor }));
            return a;
        };
        Object.assign(rig, { body, head, armL: arm(1), armR: arm(-1), height: 1.7, headY: 1.3 });
    },
    kraken(rig, v, rng) {
        const c = '#c84a8a', spot = shade(c, 0.35);
        const body = new THREE.Group(); body.position.y = 0.45; rig.holder.add(body);
        body.add(toonMesh([part(paintGradient(sph(0.36, 22, 18), shade(c, -0.15), shade(c, 0.2), 1), null, [0, 0.35, -0.05], [-0.25, 0, 0], [1, 1.35, 1]), ...Array.from({ length: 6 }, (_, i) => part(sph(0.05, 8, 6), spot, [Math.sin(i * 1.1) * 0.3, 0.45 + (i % 3) * 0.12, -0.2 + Math.cos(i * 1.1) * 0.15]))], { flash: rig.flash, flashColor: rig.flashColor, outline: 0.02 }));
        const head = new THREE.Group(); head.position.y = 0.22; body.add(head);
        attachFace(rig, { eyes: 1, eyeColor: '#ffd84a', brows: 2, mouth: 6, blush: false, marks: 0 }, 0.34, head, [0, 0.0, 0.0], 1);
        if (v.boss) head.add(toonMesh([part(cyl(0.2, 0.17, 0.12, 14, true), '#ffd24a', [0, 0.62, -0.08], [-0.25, 0, 0]), ...Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * PI * 2; return part(cone(0.035, 0.12, 6), '#ffd24a', [Math.sin(a) * 0.19, 0.72, -0.08 + Math.cos(a) * 0.19]); })], { flash: rig.flash }));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * PI * 2;
            const leg = new THREE.Group(); leg.position.set(Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.2); leg.rotation.y = a; body.add(leg);
            const t = taper([[0, 0, 0], [0, -0.25, 0.2], [0, -0.38, 0.45], [0, -0.25, 0.62]], 0.08, 0.015, 14, 8); paintGradient(t, c, spot, 2);
            leg.add(toonMesh(t, { flash: rig.flash, outline: 0.01 }));
            rig.legs.push(leg);
        }
        Object.assign(rig, { body, head, height: 1.3, headY: 0.8 });
    },
};

// humanoid monsters reuse the character builder with a fitting look
const HUMANOID = {
    goblin: (rng, el) => ({ race: 'orc', skin: rng.pick(['#7ab84a', '#8ac85a', '#6aa84a']), ears: 'elf', height: 0.78, head: 1.12, hair: 15, outfit: 'leather', weapon: rng.pick(['daggers', 'axe']), headwear: rng.pick(['none', 'band', 'cap']), mouth: 5, eyes: 1, brows: 2, tusks: false, cape: 0 }),
    imp: (rng, el) => ({ race: 'demonkin', skin: el === 'fire' ? '#e85a4a' : el === 'dark' ? '#8a5ad6' : '#e86a8a', height: 0.75, head: 1.15, horns: 2, wings: 1, tail: 4, outfit: 'tunic', weapon: 'wand', hair: 15, mouth: 5, eyes: 6, brows: 2, headwear: 'none', cape: 0 }),
    skeleton: (rng, el) => ({ race: 'undead', skin: '#ece4d4', eyes: 9, eyeColor: '#7af0ff', hair: 15, mouth: 1, brows: 0, blush: false, outfit: rng.pick(['plate', 'tunic']), c1: '#7a7a86', c2: '#4a4a52', metal: '#8a8a96', weapon: rng.pick(['sword', 'axe', 'spear']), shield: rng.chance(0.5), headwear: rng.pick(['helm', 'none']), cape: rng.chance(0.3) ? 3 : 0, marks: 0 }),
    harpy: (rng, el) => ({ race: 'beastkin', ears: 'none', wings: 2, height: 0.95, outfit: 'leather', weapon: 'bow', hair: rng.pick([3, 8, 13]), headwear: 'none', eyes: 1, mouth: 4 }),
    lich: (rng, el) => ({ race: 'undead', skin: '#d8dcd4', eyes: 9, eyeColor: '#a05aff', hair: 15, outfit: 'necro', headwear: 'crown', weapon: 'staff', glow: '#a05aff', cape: 3, aura: 4, c1: '#2a2038', c2: '#14101a', c3: '#a05aff', mouth: 1, marks: 6, markColor: '#a05aff', blush: false }),
};

/** Builds a rig for a monster view { plan, el, size, seed, boss }. */
export function buildMonster(v) {
    const rng = new Rng(v.seed || 1);
    if (HUMANOID[v.plan]) {
        const base = generateLook(rng, 'human', 'knight', v.el || 'dark', 3);
        const look = { ...base, ...HUMANOID[v.plan](rng, v.el), radiant: false };
        if (v.plan !== 'lich') { look.glow = EL_BODY[v.el]; if (v.plan !== 'skeleton') { look.c1 = EL_BODY[v.el]; } }
        const rig = buildCharacter(look);
        rig.plan = v.plan;
        rig.root.scale.setScalar(v.size || 1);
        rig.height *= v.size || 1;
        rig.headY *= v.size || 1;
        return rig;
    }
    const rig = baseRig('monster', v.plan);
    (PLANS[v.plan] || PLANS.slime)(rig, v, rng);
    const s = v.size || 1;
    rig.root.scale.setScalar(s);
    rig.height *= s;
    rig.headY *= s;
    rig.root.userData.rig = rig;
    return rig;
}

export const MONSTER_PLANS = [...Object.keys(PLANS), ...Object.keys(HUMANOID)];
