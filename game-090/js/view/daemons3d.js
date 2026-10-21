// Daemons in 3D: sixteen procedural rigs, each dressed by the species' recipe (colours, scale
// and extra parts such as horns, halos and flames). Everything is merged primitives with ink
// outlines; glowing parts are unlit so they bloom. Faces +z, stands on y = 0.

import * as THREE from 'three';
import { K, merge, part, glow, toonMat, outlineMat, TOON } from './toon.js';
import { DAEMONS } from '../sim/data/daemons.js';

const has = (x, t) => x.includes(t);
const PI = Math.PI;

// ---------------------------------------------------------------- shared bits
function eyes(root, y, z, spread, size, color, n = 2) {
    const list = [];
    for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread;
        const e = glow(new THREE.SphereGeometry(size, 8, 6), color, { p: [x, y, z] });
        root.add(e); list.push(e);
    }
    return list;
}
function horns(c, y, z, s, spread = 0.2, curve = 0.5) {
    return [-1, 1].map((sd) => K.cone(0.06 * s, 0.4 * s, { c, p: [sd * spread, y, z], r: [-0.3, 0, -sd * curve] }));
}
function halo(color, r, y, tilt = 0) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 6, 28), new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false }));
    g.position.y = y; g.rotation.x = Math.PI / 2 + tilt;
    return g;
}

/** A group whose children animate by name. rig = { root, h, r, anim(s, t) }. */
function wrap(root, h, r, anim) { return { root, h, r, anim }; }

// ================================================================ the rigs
const RIGS = {
    blob(d) {
        const [c1, c2, gl] = d.c, s = d.s, x = d.x;
        const root = new THREE.Group();
        const body = part(merge([K.sph(0.5, { c: c1, g: c2, p: [0, 0.38, 0], s: [1.1, 0.85, 1.1] }, 14, 10), ...(has(x, 'scrap') ? [K.box(0.2, 0.05, 0.2, { c: '#8a8a90', p: [0.1, 0.78, 0.1] })] : [])]));
        const tuft = part(merge([K.cone(0.07, 0.3, { c: c2, p: [0, 0.82, 0], r: [0, 0, 0.3] }), K.cone(0.06, 0.24, { c: c2, p: [0.1, 0.8, 0.04], r: [0, 0, -0.4] })]), { outline: 0.012 });
        root.add(body, tuft);
        if (has(x, 'eyes')) { root.add(...eyes(root, 0.45, 0.46, 0.18, 0.09, '#10141c')); root.children.slice(-2).forEach((e) => e.material.color.set('#10141c')); root.add(...[-0.18, 0.18].map((px) => glow(new THREE.SphereGeometry(0.035, 6, 5), '#ffffff', { p: [px + 0.02, 0.49, 0.53] }))); }
        return wrap(root, 0.9, 0.5, (st, t) => {
            const sq = 1 + Math.sin(t * 3) * 0.04;
            body.scale.set(1 / sq, sq, 1 / sq);
            tuft.rotation.z = Math.sin(t * 2.2) * 0.15;
            if (st.atk) { body.scale.set(1.1, 0.8, 1.2); }
            if (st.down) root.rotation.z = st.down * 1.2;
        });
    },
    bud(d) {
        const [c1, c2, gl] = d.c;
        const root = new THREE.Group();
        const stem = part(merge([K.cyl(0.07, 0.12, 0.5, { c: '#3a7a3a', p: [0, 0.25, 0] }), K.sph(0.12, { c: '#2a5a2a', p: [-0.12, 0.05, 0.05], s: [1.4, 0.5, 1] }), K.sph(0.12, { c: '#2a5a2a', p: [0.14, 0.05, -0.05], s: [1.4, 0.5, 1] })]), { outline: 0.012 });
        const head = new THREE.Group(); head.position.y = 0.62;
        head.add(part(merge([K.sph(0.3, { c: c1, p: [0, 0, 0], s: [1, 0.9, 1] }), ...Array.from({ length: 7 }, (_, i) => K.cone(0.1, 0.38, { c: c2, p: [Math.cos(i * 0.898) * 0.27, 0.12, Math.sin(i * 0.898) * 0.27], r: [Math.sin(i * 0.898) * 0.9, 0, -Math.cos(i * 0.898) * 0.9] }))]), { outline: 0.014 }));
        head.add(...eyes(head, 0.02, 0.28, 0.1, 0.05, '#10141c'));
        head.children.slice(-2).forEach((e) => e.material.color.set('#2a1a10'));
        root.add(stem, head);
        const motes = [];
        for (let i = 0; i < 6; i++) { const m = glow(new THREE.SphereGeometry(0.03, 6, 5), gl); root.add(m); motes.push(m); }
        return wrap(root, 1.1, 0.4, (st, t) => {
            head.rotation.z = Math.sin(t * 1.6) * 0.12; head.rotation.x = Math.sin(t * 1.1) * 0.06;
            motes.forEach((m, i) => { const a = t * 0.8 + i * 1.05; m.position.set(Math.cos(a) * 0.5, 0.7 + Math.sin(a * 1.7 + i) * 0.3, Math.sin(a) * 0.5); });
            if (st.down) root.rotation.z = st.down * 1.3;
            if (st.atk) head.rotation.x = 0.5 * Math.sin(st.atk * PI);
        });
    },
    fae(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bodyG = new THREE.Group(); bodyG.position.y = 0.5; root.add(bodyG);
        bodyG.add(part(merge([K.cap(0.12, 0.28, { c: c1, p: [0, 0, 0] }), K.sph(0.18, { c: '#e8d0b8', p: [0, 0.3, 0] }), ...(has(x, 'leafhat') ? [K.cone(0.22, 0.28, { c: c2, p: [0, 0.5, 0], r: [0.15, 0, 0.1] })] : []), ...(has(x, 'crown') ? Array.from({ length: 5 }, (_, i) => K.cone(0.04, 0.16, { c: gl, p: [Math.cos(i * 1.256) * 0.14, 0.52, Math.sin(i * 1.256) * 0.14] })) : [])]), { outline: 0.014 }));
        bodyG.add(...eyes(bodyG, 0.32, 0.15, 0.07, 0.035, '#10141c'));
        bodyG.children.slice(-2).forEach((e) => e.material.color.set('#101820'));
        if (has(x, 'veil')) bodyG.add(part(K.cone(0.28, 0.7, { c: c2, p: [0, -0.2, 0] }, 10), { outline: 0.01 }));
        const wingMat = new THREE.MeshBasicMaterial({ color: gl, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false, fog: false });
        const wings = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.08, 0.15, -0.1); const w = new THREE.Mesh(new THREE.CircleGeometry(0.3, 6), wingMat); w.scale.set(1, 1.5, 1); w.position.set(sd * 0.28, 0.1, 0); w.rotation.y = sd * 0.5; p.add(w); bodyG.add(p); return { p, sd }; });
        return wrap(root, 1.0, 0.35, (st, t) => {
            bodyG.position.y = 0.6 + Math.sin(t * 2.4) * 0.07;
            wings.forEach(({ p, sd }) => { p.rotation.y = sd * (0.5 + Math.sin(t * 24) * 0.45); });
            bodyG.rotation.x = st.atk ? 0.5 * Math.sin(st.atk * PI) : 0;
            if (st.cast) bodyG.position.y += 0.2 * Math.sin(st.cast * PI);
            if (st.down) { root.rotation.z = st.down * 1.4; bodyG.position.y = 0.4 - st.down * 0.35; }
        });
    },
    tree(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const trunk = part(merge([K.cyl(0.3, 0.5, 1.2, { c: c1, g: c1, p: [0, 0.6, 0] }, 7), K.cyl(0.1, 0.18, 0.7, { c: c1, p: [-0.4, 1.1, 0], r: [0, 0, 0.8] }), K.cyl(0.1, 0.18, 0.7, { c: c1, p: [0.4, 1.1, 0], r: [0, 0, -0.8] }),
            ...Array.from({ length: 6 }, (_, i) => K.sph(0.38, { c: has(x, 'blossoms') ? c2 : '#3a8a3a', g: '#6ac04a', p: [Math.cos(i * 1.05) * 0.5, 1.6 + (i % 2) * 0.25, Math.sin(i * 1.05) * 0.5] })),
            K.sph(0.5, { c: '#3a8a3a', g: '#6ac04a', p: [0, 1.85, 0] }), ...(has(x, 'thorns') ? Array.from({ length: 8 }, (_, i) => K.cone(0.05, 0.3, { c: c2, p: [Math.cos(i * 0.78) * 0.45, 0.4 + (i % 3) * 0.3, Math.sin(i * 0.78) * 0.45], r: [Math.sin(i * 0.78) * 1.4, 0, -Math.cos(i * 0.78) * 1.4] })) : []),
            ...(has(x, 'crown') ? Array.from({ length: 7 }, (_, i) => K.cone(0.05, 0.28, { c: c2, p: [Math.cos(i * 0.9) * 0.3, 2.35, Math.sin(i * 0.9) * 0.3] })) : [])]), { outline: 0.02 });
        const face = new THREE.Group(); face.position.set(0, 0.85, 0.36);
        face.add(...eyes(face, 0, 0, 0.14, 0.06, gl));
        face.add(glow(new THREE.BoxGeometry(0.2, 0.04, 0.02), gl, { p: [0, -0.16, 0] }));
        root.add(trunk, face);
        return wrap(root, 2.4, 0.8, (st, t) => {
            trunk.rotation.z = Math.sin(t * 0.9) * 0.025; trunk.rotation.x = st.atk ? 0.3 * Math.sin(st.atk * PI) : 0;
            face.rotation.z = trunk.rotation.z;
            if (st.down) root.rotation.z = st.down * 0.9;
            if (st.cast) trunk.scale.setScalar(1 + 0.05 * Math.sin(st.cast * PI * 2));
        });
    },
    quad(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bulk = has(x, 'bulk') ? 1.25 : 1;
        const body = new THREE.Group(); body.position.y = 0.58; root.add(body);
        body.add(part(merge([K.cap(0.26 * bulk, 0.5, { c: c1, g: c2, p: [0, 0, 0], r: [PI / 2, 0, 0] }), K.sph(0.22 * bulk, { c: c1, p: [0, 0.1, 0.42], s: [1, 1, 1.1] }), K.cone(0.14, 0.26, { c: c1, p: [0, 0.05, 0.64], r: [PI / 2, 0, 0] }),
            ...(has(x, 'ears') || has(x, 'longears') ? [-1, 1].map((sd) => K.cone(0.07, has(x, 'longears') ? 0.55 : 0.22, { c: c1, p: [sd * 0.12, 0.38, 0.38], r: [0, 0, -sd * 0.2] })) : []),
            ...(has(x, 'antlers') ? [-1, 1].flatMap((sd) => [K.cyl(0.02, 0.03, 0.5, { c: c2, p: [sd * 0.1, 0.45, 0.34], r: [0, 0, -sd * 0.5] }), K.cyl(0.015, 0.02, 0.25, { c: c2, p: [sd * 0.3, 0.6, 0.34], r: [0, 0, sd * 0.3] })]) : []),
            ...(has(x, 'tusks') ? [-1, 1].map((sd) => K.cone(0.035, 0.26, { c: '#e8e0c8', p: [sd * 0.12, -0.02, 0.62], r: [-0.4, 0, sd * 0.2] })) : []),
            ...(has(x, 'moss') ? Array.from({ length: 6 }, (_, i) => K.sph(0.12, { c: '#5aa040', p: [(i % 3 - 1) * 0.15, 0.27 * bulk, -0.2 + Math.floor(i / 3) * 0.3] })) : []),
            ...(has(x, 'thorns') ? Array.from({ length: 4 }, (_, i) => K.cone(0.04, 0.2, { c: c2, p: [0, 0.27, -0.2 + i * 0.15] })) : []),
            ...(has(x, 'scrap') ? [K.box(0.14, 0.04, 0.14, { c: '#9aa0a8', p: [0.2, 0.15, 0.0] }), K.box(0.1, 0.04, 0.1, { c: '#c8a850', p: [-0.2, 0.2, -0.2] })] : [])]), { outline: 0.022 }));
        body.add(...eyes(body, 0.17, 0.58, 0.11, 0.04, gl));
        const tail = part(merge([K.cap(0.07, 0.4, { c: c1, p: [0, 0.2, 0], r: [0.6, 0, 0] })]), { outline: 0.014 });
        tail.position.set(0, 0.05, -0.5); body.add(tail);
        const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
            const p = new THREE.Group(); p.position.set(sx * 0.17 * bulk, -0.05, sz * 0.3);
            p.add(part(merge([K.cap(0.07 * bulk, 0.4, { c: c1, p: [0, -0.28, 0] }), K.box(0.13, 0.06, 0.2, { c: c2, p: [0, -0.5, 0.04] })]), { outline: 0.014 }));
            body.add(p); return { p, ph: (sx * sz > 0 ? 0 : PI) };
        });
        if (has(x, 'flames')) { const f = glow(new THREE.ConeGeometry(0.18, 0.6, 6), gl, { p: [0, 0.4, -0.55], opacity: 0.8 }); f.rotation.x = -0.5; tail.add(f); }
        return wrap(root, 1.0 * bulk, 0.7, (st, t) => {
            const w = st.move || 0;
            legs.forEach(({ p, ph }) => { p.rotation.x = Math.sin(t * 10 + ph) * 0.7 * w; });
            body.position.y = 0.58 + Math.abs(Math.sin(t * 10)) * 0.05 * w + Math.sin(t * 1.8) * 0.012;
            tail.rotation.y = Math.sin(t * 3) * 0.4; tail.rotation.x = Math.sin(t * 2) * 0.1;
            body.rotation.x = st.atk ? -0.35 * Math.sin(st.atk * PI) : 0;
            if (st.down) { root.rotation.z = st.down * 1.45; root.position.y = st.down * 0.18; }
        });
    },
    robot(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bulk = has(x, 'bulk') ? 1.3 : 1;
        const hips = new THREE.Group(); hips.position.y = 0.75 * bulk; root.add(hips);
        const torso = part(merge([K.box(0.62 * bulk, 0.6 * bulk, 0.4 * bulk, { c: c1, g: c2, p: [0, 0.4 * bulk, 0] }), K.box(0.3, 0.3, 0.05, { c: c2, p: [0, 0.4 * bulk, 0.22 * bulk] }),
            ...(has(x, 'plates') ? [K.box(0.72 * bulk, 0.14, 0.5 * bulk, { c: c2, p: [0, 0.72 * bulk, 0] })] : []),
            ...(has(x, 'lamp') ? [K.cyl(0.07, 0.07, 0.12, { c: gl, p: [0, 0.95 * bulk, 0.1] })] : []), ...(has(x, 'shield') ? [K.box(0.06, 0.6, 0.45, { c: c2, p: [-0.55, 0.45, 0.15] })] : [])]), { outline: 0.02 });
        hips.add(torso);
        const head = new THREE.Group(); head.position.y = 1.05 * bulk; hips.add(head);
        head.add(part(merge([K.box(0.34, 0.28, 0.32, { c: c1, p: [0, 0.14, 0] }), ...(has(x, 'antenna') ? [K.cyl(0.015, 0.015, 0.3, { c: c2, p: [0.1, 0.4, 0] }), K.sph(0.04, { c: '#ff6a4a', p: [0.1, 0.56, 0] })] : [])]), { outline: 0.016 }));
        head.add(glow(new THREE.BoxGeometry(0.28, 0.07, 0.02), gl, { p: [0, 0.16, 0.17] }));
        if (has(x, 'halo')) { const hl = halo(gl, 0.28, 0.5, 0); head.add(hl); }
        const arm = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.42 * bulk, 0.6 * bulk, 0); p.add(part(merge([K.cap(0.08 * bulk, 0.38, { c: c2, p: [0, -0.28, 0] }), K.box(0.16, 0.16, 0.16, { c: c1, p: [0, -0.58, 0] })]), { outline: 0.016 })); hips.add(p); return p; };
        const armL = arm(-1), armR = arm(1);
        const leg = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.17, 0.0, 0); p.add(part(merge([K.cap(0.09 * bulk, 0.4, { c: c1, p: [0, -0.3, 0] }), K.box(0.2, 0.1, 0.3, { c: c2, p: [0, -0.72, 0.05] })]), { outline: 0.016 })); hips.add(p); return p; };
        const legL = leg(-1), legR = leg(1);
        return wrap(root, 1.6 * bulk, 0.5, (st, t) => {
            const w = st.move || 0, sw = Math.sin(t * 8) * 0.7 * w;
            legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
            hips.position.y = 0.75 * bulk + Math.sin(t * 1.6) * 0.012;
            head.rotation.y = Math.sin(t * 0.8) * 0.2;
            if (st.atk) { armR.rotation.x = -2.2 + st.atk * 3; hips.rotation.x = 0.2 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.2; }
            if (st.down) { root.rotation.x = -st.down * 1.45; root.position.y = st.down * 0.35; }
        });
    },
    drone(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 0.9; root.add(core);
        core.add(part(merge([K.sph(0.3, { c: c1, g: c2, s: [1, 0.95, 1] }, 12, 10), K.tor(0.34, 0.04, { c: c2, r: [PI / 2, 0, 0] })]), { outline: 0.02 }));
        core.add(glow(new THREE.SphereGeometry(0.13, 10, 8), gl, { p: [0, 0.02, 0.26] }));
        let rotors = null, wings = [];
        if (has(x, 'rotors')) { rotors = new THREE.Group(); rotors.position.y = 0.34; for (let i = 0; i < 2; i++) rotors.add(glow(new THREE.BoxGeometry(0.9, 0.012, 0.07), '#cfe8ff', { opacity: 0.6, p: [0, 0, 0] })); rotors.children[1].rotation.y = PI / 2; core.add(rotors); }
        if (has(x, 'wings')) wings = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.3, 0.05, 0); const w = part(merge([K.box(0.6, 0.04, 0.3, { c: c1, p: [sd * 0.3, 0, 0], r: [0, 0, sd * 0.2] }), K.box(0.4, 0.03, 0.22, { c: c2, p: [sd * 0.3, 0.02, -0.08] })]), { outline: 0.01 }); p.add(w); core.add(p); return { p, sd }; });
        if (has(x, 'halo')) core.add(halo(gl, 0.28, 0.5, 0));
        if (has(x, 'eye')) core.children[0].scale.set(1, 1, 1);
        return wrap(root, 1.3, 0.5, (st, t) => {
            core.position.y = 0.95 + Math.sin(t * 2.3) * 0.08;
            if (rotors) rotors.rotation.y = t * 30;
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * Math.sin(t * 7) * 0.25; });
            core.rotation.x = st.atk ? 0.6 * Math.sin(st.atk * PI) : 0;
            if (st.down) { root.position.y = -st.down * 0.55; core.rotation.z = st.down * 1.2; }
        });
    },
    spider(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const sz = d.s;
        const body = new THREE.Group(); body.position.y = 0.55; root.add(body);
        const mantis = has(x, 'mantis');
        body.add(part(merge([K.sph(0.3, { c: c1, g: c2, s: [1, 0.8, 1.3], p: [0, 0, -0.1] }), K.sph(0.2, { c: c1, p: [0, 0.05, 0.3] }), ...(has(x, 'dish') ? [K.cone(0.28, 0.2, { c: c2, p: [0, 0.35, -0.2], r: [PI, 0, 0] }, 10), K.cyl(0.02, 0.02, 0.25, { c: c2, p: [0, 0.25, -0.2] })] : [])]), { outline: 0.02 }));
        body.add(...eyes(body, 0.12, 0.46, 0.1, 0.045, gl, mantis ? 2 : 4));
        const legs = [];
        const n = mantis ? 4 : 6;
        for (let i = 0; i < n; i++) {
            const sd = i % 2 ? 1 : -1, row = Math.floor(i / 2);
            const p = new THREE.Group(); p.position.set(sd * 0.22, 0, -0.15 + row * 0.25 - (n === 4 ? 0 : 0.1));
            p.add(part(merge([K.cyl(0.03, 0.04, 0.5, { c: c2, p: [sd * 0.22, 0.1, 0], r: [0, 0, sd * 1.1] }), K.cyl(0.02, 0.03, 0.6, { c: c1, p: [sd * 0.55, -0.12, 0], r: [0, 0, -sd * 0.3] })]), { outline: 0.01 }));
            body.add(p); legs.push({ p, ph: i * 1.1 });
        }
        let blades = [];
        if (mantis || has(x, 'blades')) blades = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.2, 0.05, 0.3); p.add(part(merge([K.cyl(0.04, 0.05, 0.4, { c: c2, p: [0, 0, 0.2], r: [PI / 2, 0, 0] }), K.box(0.03, 0.04, 0.5, { c: '#e8eef4', p: [0, 0.0, 0.6] })]), { outline: 0.01 })); body.add(p); return { p, sd }; });
        return wrap(root, 1.0 * (mantis ? 1.2 : 1), 0.7, (st, t) => {
            const w = st.move || 0;
            legs.forEach(({ p, ph }, i) => { p.rotation.z = Math.sin(t * 9 + ph) * 0.25 * (0.2 + w); p.rotation.y = Math.sin(t * 9 + ph + 1) * 0.2 * w; });
            body.position.y = 0.55 + Math.sin(t * 1.9) * 0.012;
            blades.forEach(({ p, sd }) => { p.rotation.x = st.atk ? -0.8 + st.atk * 1.8 : Math.sin(t * 1.5) * 0.08; p.rotation.y = sd * (st.atk ? 0.3 * (1 - st.atk) : 0.0); });
            if (st.down) { root.rotation.z = st.down * PI; root.position.y = st.down * 0.9; }
        });
    },
    turret(d) {
        const [c1, c2, gl] = d.c;
        const root = new THREE.Group();
        root.add(part(merge([K.cyl(0.45, 0.55, 0.3, { c: c2, p: [0, 0.15, 0] }, 8), K.cyl(0.18, 0.28, 0.5, { c: c1, p: [0, 0.55, 0] }, 8)]), { outline: 0.02 }));
        const head = new THREE.Group(); head.position.y = 0.95; root.add(head);
        head.add(part(merge([K.box(0.55, 0.38, 0.5, { c: c1, g: c2 }), K.cyl(0.05, 0.05, 0.6, { c: '#20242c', p: [-0.14, 0, 0.5], r: [PI / 2, 0, 0] }), K.cyl(0.05, 0.05, 0.6, { c: '#20242c', p: [0.14, 0, 0.5], r: [PI / 2, 0, 0] })]), { outline: 0.02 }));
        head.add(glow(new THREE.BoxGeometry(0.4, 0.06, 0.02), gl, { p: [0, 0.1, 0.26] }));
        return wrap(root, 1.3, 0.55, (st, t) => {
            head.rotation.y = Math.sin(t * 0.7) * 0.6 + (st.atk ? 0.3 : 0);
            head.position.z = st.atk ? -0.1 * Math.sin(st.atk * PI) : 0;
            if (st.down) { head.rotation.x = st.down * 0.6; head.position.y = 0.95 - st.down * 0.2; }
        });
    },
    wisp(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 0.85; root.add(core);
        core.add(glow(new THREE.SphereGeometry(0.2, 12, 10), gl));
        core.add(glow(new THREE.SphereGeometry(0.34, 12, 10), gl, { opacity: 0.25 }));
        const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 10, 1, true), new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false }));
        cloth.position.set(0, -0.35, 0); cloth.rotation.x = PI; core.add(cloth);
        if (has(x, 'hood')) core.add(part(K.cone(0.3, 0.5, { c: c1, p: [0, 0.3, -0.02] }, 8), { outline: 0.012 }));
        const eyesL = [];
        if (has(x, 'face') || has(x, 'hood')) { eyesL.push(...eyes(core, 0.05, 0.19, 0.08, 0.035, '#ffffff')); }
        const sparks = [];
        const n = has(x, 'flames') ? 8 : 5;
        for (let i = 0; i < n; i++) { const s = glow(new THREE.SphereGeometry(0.035, 5, 4), c2); root.add(s); sparks.push(s); }
        return wrap(root, 1.4, 0.45, (st, t) => {
            core.position.y = 0.85 + Math.sin(t * 1.9) * 0.1;
            core.scale.setScalar(1 + Math.sin(t * 5) * 0.03);
            cloth.rotation.y = t * 0.8; cloth.scale.set(1 + Math.sin(t * 3) * 0.06, 1, 1 + Math.sin(t * 3 + 1) * 0.06);
            sparks.forEach((s, i) => { const a = t * 1.1 + i * 1.3; s.position.set(Math.cos(a) * 0.42, 0.2 + ((t * 0.5 + i * 0.37) % 1) * 1.1, Math.sin(a) * 0.42); s.material.opacity = 1; });
            core.rotation.x = st.atk ? 0.5 * Math.sin(st.atk * PI) : 0;
            if (st.down) { core.position.y = 0.4; core.scale.setScalar(1 - st.down * 0.35); }
        });
    },
    serpent(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const N = 12;
        const segs = [];
        for (let i = 0; i < N; i++) {
            const r = 0.26 * (1 - i / (N + 4)) * (i === 0 ? 1.15 : 1);
            const m = part(merge([K.sph(r, { c: i % 2 ? c2 : c1, g: c1 }, 10, 8), ...(has(x, 'fins') && i % 2 === 0 ? [K.cone(0.05, 0.3, { c: c2, p: [0, r + 0.1, 0] })] : []), ...(has(x, 'cables') && i % 3 === 0 ? [K.tor(r * 1.1, 0.03, { c: gl, r: [0, PI / 2, 0] })] : [])]), { outline: 0.016 });
            root.add(m); segs.push(m);
        }
        const head = new THREE.Group(); head.position.y = 0; segs[0].add(head);
        head.add(...eyes(head, 0.07, 0.2, 0.1, 0.04, gl));
        head.add(part(merge([K.cone(0.14, 0.3, { c: c1, p: [0, -0.02, 0.28], r: [PI / 2, 0, 0] }), ...(has(x, 'horns') ? horns(c2, 0.2, -0.02, 1.2, 0.12) : [])]), { outline: 0.014 }));
        return wrap(root, 1.0 * d.s, 0.7, (st, t) => {
            const lift = st.down ? 0 : 1;
            segs.forEach((s, i) => { s.position.set(Math.sin(t * 2 + i * 0.55) * 0.18 * (i / N + 0.3), 0.28 + (i === 0 ? 0.5 : Math.max(0, 0.5 - i * 0.08)) * lift, -i * 0.3); });
            head.rotation.x = st.atk ? 0.6 * Math.sin(st.atk * PI) : Math.sin(t * 1.4) * 0.05;
            if (st.down) root.position.y = 0;
        });
    },
    wyrm(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const base = RIGS.serpent({ ...d, x: x.filter((t) => t !== 'wings') });
        const root = base.root;
        let wings = [];
        if (has(x, 'wings')) wings = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.2, 0.9, -0.5); const w = part(merge([K.box(1.1, 0.04, 0.5, { c: c1, p: [sd * 0.55, 0, 0], r: [0, 0, sd * 0.25] }), K.box(0.8, 0.03, 0.3, { c: c2, p: [sd * 0.55, 0.0, -0.25], r: [0, 0, sd * 0.2] })]), { outline: 0.012 }); p.add(w); root.add(p); return { p, sd }; });
        if (has(x, 'flames')) root.add(glow(new THREE.ConeGeometry(0.2, 0.7, 6), gl, { p: [0, 0.6, -3.3], opacity: 0.8 }));
        if (has(x, 'crown')) root.add(halo(gl, 0.3, 1.1));
        return wrap(root, 1.4 * d.s, 1.0, (st, t) => {
            base.anim(st, t);
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * (0.2 + Math.sin(t * 3.2) * 0.45); });
            root.children.filter((c) => c.userData.f).forEach(() => {});
        });
    },
    golem(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const hips = new THREE.Group(); hips.position.y = 0.7; root.add(hips);
        const brick = (w, h, dd, p, c = c1) => K.box(w, h, dd, { c, g: c2, p });
        hips.add(part(merge([brick(0.9, 0.85, 0.6, [0, 0.7, 0]), brick(1.2, 0.35, 0.7, [0, 1.25, 0], c2), brick(0.5, 0.4, 0.45, [0, 1.62, 0.05]),
            ...(has(x, 'moss') ? Array.from({ length: 6 }, (_, i) => K.sph(0.17, { c: '#58a03e', p: [(i % 3 - 1) * 0.35, 1.45 + (i % 2) * 0.1, (Math.floor(i / 3) - 0.5) * 0.4] })) : []),
            ...(has(x, 'flowers') ? [K.sph(0.07, { c: '#ff8ac8', p: [0.3, 1.58, 0.3] }), K.sph(0.07, { c: '#ffe84a', p: [-0.3, 1.55, 0.25] })] : []),
            ...(has(x, 'wings') ? [-1, 1].map((sd) => K.box(0.8, 0.1, 0.5, { c: c2, p: [sd * 0.9, 1.4, -0.35], r: [0, 0, sd * 0.5] })) : []),
            ...(has(x, 'horns') ? horns(c2, 1.9, 0.0, 1.2, 0.18) : []),
            ...(has(x, 'pylon') ? [K.cyl(0.04, 0.12, 1.2, { c: c2, p: [0, 2.3, 0] }), K.box(0.6, 0.06, 0.06, { c: c2, p: [0, 2.6, 0] }), K.box(0.4, 0.06, 0.06, { c: c2, p: [0, 2.3, 0] })] : []),
            ...(has(x, 'turbine') ? Array.from({ length: 3 }, (_, i) => K.box(0.14, 1.8, 0.04, { c: '#f4f8ff', p: [0, 0, 0] }).rotateZ(i * 2.094).translate(0, 1.6, -0.45)) : []),
            ...(has(x, 'plates') ? [brick(1.3, 0.12, 0.8, [0, 1.45, 0], c2)] : []),
            ...(has(x, 'core') ? [K.sph(0.2, { c: gl, p: [0, 0.75, 0.32] })] : [])]), { outline: 0.03 }));
        if (has(x, 'core')) hips.add(glow(new THREE.SphereGeometry(0.17, 10, 8), gl, { p: [0, 0.75, 0.34] }));
        hips.add(...eyes(hips, 1.64, 0.28, 0.12, 0.055, gl));
        const arm = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.75, 1.3, 0); p.add(part(merge([brick(0.34, 0.9, 0.34, [0, -0.45, 0]), brick(0.46, 0.4, 0.46, [0, -1.0, 0], c2)]), { outline: 0.028 })); hips.add(p); return p; };
        const armL = arm(-1), armR = arm(1);
        const leg = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.28, 0.3, 0); p.add(part(merge([brick(0.36, 0.7, 0.4, [0, -0.1, 0]), brick(0.44, 0.2, 0.6, [0, -0.5, 0.08], c2)]), { outline: 0.028 })); hips.add(p); return p; };
        const legL = leg(-1), legR = leg(1);
        const turbine = has(x, 'turbine') ? hips.children[0].children[0] : null;
        return wrap(root, 2.2, 0.8, (st, t) => {
            const w = st.move || 0, sw = Math.sin(t * 5) * 0.5 * w;
            legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
            hips.position.y = 0.7 + Math.sin(t * 1.3) * 0.015;
            if (st.atk) { armL.rotation.x = armR.rotation.x = -2.5 + st.atk * 3.2; hips.rotation.x = 0.3 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.6; }
            if (st.down) { root.rotation.x = -st.down * 1.2; root.position.y = st.down * 0.5; }
        });
    },
    archon(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 1.0; root.add(core);
        core.add(part(merge([K.cyl(0.22, 0.12, 0.8, { c: c1, g: c2, p: [0, 0, 0] }, 8), K.sph(0.2, { c: '#f0e8e0', p: [0, 0.6, 0] }), K.box(0.08, 0.5, 0.5, { c: c2, p: [0, -0.1, 0] }).rotateY(PI / 2),
            ...(has(x, 'crown') ? Array.from({ length: 6 }, (_, i) => K.cone(0.035, 0.2, { c: gl, p: [Math.cos(i * 1.05) * 0.18, 0.88, Math.sin(i * 1.05) * 0.18] })) : []),
            ...(has(x, 'plates') ? [K.box(0.5, 0.1, 0.35, { c: c2, p: [0, 0.25, 0] })] : []), ...(has(x, 'spear') ? [K.cyl(0.02, 0.02, 1.8, { c: c2, p: [0.5, 0.0, 0.15] }), K.cone(0.06, 0.3, { c: gl, p: [0.5, 0.98, 0.15] })] : []),
            ...(has(x, 'scroll') ? [K.cyl(0.07, 0.07, 0.45, { c: '#f4ecd0', p: [-0.4, 0.1, 0.2], r: [0, 0, PI / 2] })] : [])]), { outline: 0.02 }));
        core.add(...eyes(core, 0.62, 0.17, 0.07, 0.03, gl));
        let wings = [];
        if (has(x, 'wings')) wings = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.15, 0.3, -0.12); const w = part(merge([0, 1, 2, 3].map((i) => K.box(0.7 - i * 0.1, 0.07, 0.14, { c: i % 2 ? c1 : c2, p: [sd * (0.4 - i * 0.03), i * 0.12 - 0.1, -i * 0.02], r: [0, 0, sd * (0.5 - i * 0.12)] }))), { outline: 0.012 }); p.add(w); core.add(p); return { p, sd }; });
        if (has(x, 'halo')) core.add(halo(gl, 0.3, 1.0));
        const rings = [];
        if (has(x, 'rings')) for (let i = 0; i < 2; i++) { const r = halo(i ? c2 : gl, 0.55 + i * 0.2, 0.2, 0); r.userData.i = i; core.add(r); rings.push(r); }
        return wrap(root, 2.0, 0.7, (st, t) => {
            core.position.y = 1.0 + Math.sin(t * 1.8) * 0.1;
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * (0.1 + Math.sin(t * 2.2) * 0.12); p.rotation.y = sd * 0.2; });
            rings.forEach((r, i) => { r.rotation.x = PI / 2 + Math.sin(t * (0.8 + i * 0.4)) * 0.5; r.rotation.y = t * (0.6 + i * 0.3) * (i ? -1 : 1); });
            core.rotation.x = st.atk ? 0.4 * Math.sin(st.atk * PI) : 0;
            if (st.cast) core.position.y += 0.2 * Math.sin(st.cast * PI);
            if (st.down) { core.position.y = 0.4; core.rotation.z = st.down * 1.1; }
        });
    },
    husk(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const sz = 1;
        const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
        hips.add(part(merge([K.cyl(0.26, 0.4, 0.95, { c: c1, g: c2, p: [0, 0.3, 0] }, 8), ...(has(x, 'pack') ? [K.box(0.4, 0.45, 0.25, { c: '#8a5a2a', p: [0, 0.45, -0.3] })] : []), ...(has(x, 'plates') ? [K.box(0.62, 0.12, 0.42, { c: c2, p: [0, 0.72, 0] })] : []),
            ...(has(x, 'shears') ? [K.cyl(0.02, 0.02, 1.6, { c: '#c8ccd8', p: [0.5, 0.15, 0.2] }), K.box(0.04, 0.5, 0.01, { c: '#e8ecf4', p: [0.58, 0.95, 0.2], r: [0, 0, 0.18] }), K.box(0.04, 0.5, 0.01, { c: '#e8ecf4', p: [0.42, 0.95, 0.2], r: [0, 0, -0.18] })] : []),
            ...(has(x, 'wires') ? Array.from({ length: 5 }, (_, i) => K.cyl(0.015, 0.015, 0.6, { c: gl, p: [(i - 2) * 0.12, -0.05, 0.3], r: [0.2, 0, (i - 2) * 0.12] })) : [])]), { outline: 0.02 }));
        const head = new THREE.Group(); head.position.y = 0.95; hips.add(head);
        head.add(part(K.cone(0.3, 0.7, { c: c1, g: c2, p: [0, 0.15, -0.03] }, 8), { outline: 0.018 }));
        head.add(part(K.sph(0.16, { c: '#06060a', p: [0, 0.08, 0.1] }), { outline: 0.01 }));
        head.add(...eyes(head, 0.1, 0.22, 0.07, 0.035, gl));
        if (has(x, 'visor')) head.add(glow(new THREE.BoxGeometry(0.3, 0.05, 0.02), gl, { p: [0, 0.1, 0.24] }));
        if (has(x, 'halo')) head.add(halo(gl, 0.28, 0.55, 0.1));
        const arm = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.36, 0.78, 0); p.add(part(merge([K.cap(0.07, 0.6, { c: c1, p: [0, -0.4, 0] }), K.sph(0.07, { c: '#b0a8c0', p: [0, -0.8, 0] })]), { outline: 0.014 })); hips.add(p); return p; };
        const armL = arm(-1), armR = arm(1);
        const veil = has(x, 'veil') ? hips.add(part(K.cone(0.55, 1.2, { c: c1, g: c2, p: [0, 0.1, 0], s: [1, 1, 0.5] }, 10), { outline: 0.01 })) : null;
        return wrap(root, 1.9, 0.5, (st, t) => {
            const w = st.move || 0;
            hips.position.y = 0.9 + Math.sin(t * 1.5) * 0.04;
            armL.rotation.x = Math.sin(t * 1.5) * 0.12 + (w ? Math.sin(t * 7) * 0.5 : 0); armR.rotation.x = -armL.rotation.x;
            head.rotation.z = Math.sin(t * 0.9) * 0.08;
            if (st.atk) { armR.rotation.x = -2.4 + st.atk * 3.2; hips.rotation.x = 0.25 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.2; hips.position.y += 0.15 * Math.sin(st.cast * PI); }
            if (st.down) { root.rotation.x = -st.down * 1.35; root.position.y = st.down * 0.4; }
        });
    },
    orb(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 1.4; root.add(core);
        core.add(glow(new THREE.SphereGeometry(0.5, 16, 12), gl));
        core.add(glow(new THREE.SphereGeometry(0.75, 16, 12), c2, { opacity: 0.22 }));
        const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 + i * 0.35, 0.03 + i * 0.01, 6, 40), new THREE.MeshBasicMaterial({ color: i % 2 ? c2 : '#ffffff', toneMapped: false, fog: false })); core.add(r); return r; });
        const spokes = [];
        if (has(x, 'cables')) for (let i = 0; i < 6; i++) { const c = glow(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4), c2, { opacity: 0.6, p: [Math.cos(i * 1.047) * 0.9, -0.9, Math.sin(i * 1.047) * 0.9] }); c.rotation.z = Math.cos(i * 1.047) * 0.25; core.add(c); spokes.push(c); }
        if (has(x, 'halo')) core.add(halo('#ffffff', 1.9, 0, 0));
        return wrap(root, 3.2, 1.2, (st, t) => {
            core.position.y = 1.5 + Math.sin(t * 1.2) * 0.12;
            rings.forEach((r, i) => { r.rotation.x = t * (0.5 + i * 0.25) * (i % 2 ? -1 : 1); r.rotation.y = t * (0.35 + i * 0.2); });
            core.scale.setScalar(1 + (st.cast ? 0.2 * Math.sin(st.cast * PI) : 0) + (st.atk ? 0.15 * Math.sin(st.atk * PI) : 0));
            if (st.down) core.scale.setScalar(1 - st.down * 0.3);
        });
    },
};
RIGS.bud = RIGS.bud;

/** Build the 3D model for a species. Returns { root, h, r, pose(state, t), glowColor }. */
export function buildDaemon(spId) {
    const sp = DAEMONS[spId];
    const m = sp.model;
    const rig = (RIGS[m.rig] || RIGS.blob)({ c: m.c, s: m.s, x: m.x });
    const holder = new THREE.Group();
    holder.add(rig.root);
    holder.scale.setScalar(m.s);
    return {
        root: holder, inner: rig.root, h: rig.h * m.s, r: rig.r * m.s, glowColor: m.c[2], race: sp.race,
        pose: (st, t) => rig.anim(st || {}, t),
    };
}

let shellMat = null;
function hexShellMaterial() {
    if (shellMat) return shellMat;
    shellMat = new THREE.MeshBasicMaterial({ color: '#d24bff', side: THREE.BackSide, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, fog: false });
    shellMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = TOON.uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * (0.045 + 0.025 * sin(uTime * 7.0 + position.y * 9.0));');
    };
    shellMat.customProgramCacheKey = () => 'hexshell';
    shellMat.userData.shared = true;
    return shellMat;
}

/** Make a built model read as corrupted: a pulsing magenta shell that crawls over its surface. */
export function hexify(model) {
    const add = [];
    model.root.traverse((o) => {
        if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.userData.outline && !o.userData.hexshell) add.push(o);
    });
    for (const o of add) {
        const s = new THREE.Mesh(o.geometry, hexShellMaterial());
        s.raycast = () => {};
        s.userData.hexshell = true;
        o.add(s);
    }
    model.hexified = true;
    return model;
}
