// The sprites: a moss slime, a flower, fae, and the trees.

import { THREE, loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp, glow, hexShade, PI, has, wrap, skin, P, shadeGeo, wobble, eye, beadEye, halo, insectWing, motes } from './kit.js';
import { toonMat } from '../toon.js';

const dark = (c) => hexShade(c, 0.45);

export const NATURE = {
    blob(d) {
        const [c1, c2, gl] = d.c;
        const root = new THREE.Group();
        const bodyG = new THREE.Group(); root.add(bodyG);
        const slime = skin('slime', c1, c2);
        const lumpy = wobble(1.7, 0.035);
        const shell = ball(0.52, 0.44, 0.5, { seg: 28, rings: 20 }, (x, y, z, o) => {
            const ny = y / 0.44;
            const yy = ny < -0.55 ? -0.55 * 0.44 + (y + 0.55 * 0.44) * 0.22 : y;
            const bulge = 1 + 0.13 * smooth(-0.35, -0.85, ny) + lumpy(Math.atan2(x, z) + y * 4);
            o[0] = x * bulge; o[1] = yy + 0.29; o[2] = z * bulge;
        });
        bodyG.add(P(shadeGeo(shell, { top: '#ffffff', ao: 0.4 }), slime, 0.016));
        // glints of wet light and a pair of beady eyes with a small smile
        const parts = [];
        const mossM = skin('leaf', '#3f8a35', '#8ae05a');
        const mp = [[-0.22, 0.66, 0.0, 0.15], [0.08, 0.7, -0.12, 0.17], [0.26, 0.6, 0.08, 0.12], [-0.05, 0.62, 0.2, 0.1], [-0.3, 0.52, -0.15, 0.1]];
        for (const [x, y, z, r] of mp) parts.push(xform(tint(ball(r, r * 0.7, r, { seg: 10, rings: 8 }), '#ffffff', { ao: 0.25 }), { p: [x, y, z] }));
        bodyG.add(P(bake(parts), mossM, 0.01));
        for (const sd of [-1, 1]) { const e = beadEye(0.07); e.position.set(sd * 0.17, 0.4, 0.43); e.rotation.y = sd * 0.35; bodyG.add(e); }
        bodyG.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.07, 0.27, 0.465), new THREE.Vector3(0, 0.245, 0.48), new THREE.Vector3(0.07, 0.27, 0.465)]), 8, 0.007, 4), '#241410'));
        const sprout = new THREE.Group(); sprout.position.set(0, 0.7, 0); bodyG.add(sprout);
        sprout.add(P(bake([tint(tube([[0, 0, 0], [0.02, 0.1, 0], [0, 0.2, 0.02]], [0.02, 0.016, 0.014], { seg: 6, n: 8 }), '#4a8a3a', { ao: 0.2 }), ...[-1, 1].map((sd) => tint(tube([[0, 0.19, 0.01], [sd * 0.08, 0.27, 0.01], [sd * 0.17, 0.25, 0.0]], [0.005, 0.045, 0.004], { seg: 6, n: 8, flat: 0.2 }), '#7ac84a', { ao: 0.1 }))]), toonMat({ vertexColors: true }), 0.007));
        return wrap(root, 0.9, 0.62, (st, t) => {
            const sq = 1 + Math.sin(t * 3) * 0.045;
            bodyG.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
            sprout.rotation.z = Math.sin(t * 2.2) * 0.2; sprout.rotation.x = Math.sin(t * 1.7) * 0.12;
            if (st.atk) { bodyG.scale.set(1.12, 0.78, 1.2); bodyG.position.z = 0.25 * Math.sin(st.atk * PI); } else bodyG.position.z = 0;
            if (st.down) { root.rotation.z = st.down * 1.2; }
        });
    },

    bud(d) {
        const [c1, c2, gl] = d.c;
        const root = new THREE.Group();
        const green = toonMat({ vertexColors: true, map: skin('leaf', '#2f6a30', '#7ac84a').map, color: '#ffffff' });
        const stem = tube([[0, 0, 0], [0.04, 0.18, 0.01], [-0.03, 0.4, 0.02], [0, 0.58, 0]], [0.062, 0.042, 0.04, 0.05], { seg: 10, n: 14 });
        const leaf = (sd) => tube([[0, 0.1, 0], [sd * 0.16, 0.2, 0.0], [sd * 0.34, 0.14, 0.05]], [0.012, 0.075, 0.004], { seg: 6, n: 10, flat: 0.16 });
        const ground = ball(0.2, 0.05, 0.2, { seg: 12, rings: 6 });
        root.add(P(bake([tint(stem, '#ffffff', { ao: 0.3 }), tint(leaf(-1), '#ffffff', { ao: 0.2 }), tint(leaf(1), '#ffffff', { ao: 0.2 }), tint(ground, '#ffffff', { ao: 0.2 })]), green, 0.012));
        const head = new THREE.Group(); head.position.y = 0.68; root.add(head);
        const petalM = skin('leaf', c2, c1), coreM = skin('slime', c1, c2);
        const petals = [];
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            petals.push(tint(tube([[ca * 0.15, sa * 0.15, -0.04], [ca * 0.29, sa * 0.29, -0.06], [ca * 0.47, sa * 0.47, -0.02]], [0.02, 0.09, 0.012], { seg: 6, n: 10, flat: 0.2 }), '#ffffff', { ao: 0.2 }));
        }
        head.add(P(bake(petals), petalM, 0.009));
        head.add(P(shadeGeo(ball(0.22, 0.22, 0.17, { seg: 18, rings: 14 }), { ao: 0.2 }), coreM, 0.012));
        for (const sd of [-1, 1]) { const e = beadEye(0.045); e.position.set(sd * 0.085, 0.03, 0.15); head.add(e); }
        head.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.045, -0.06, 0.158), new THREE.Vector3(0, -0.085, 0.165), new THREE.Vector3(0.045, -0.06, 0.158)]), 8, 0.006, 4), '#2a1410'));
        const spores = motes(root, 7, gl, 0.03);
        return wrap(root, 1.2, 0.45, (st, t) => {
            head.rotation.z = Math.sin(t * 1.6) * 0.14; head.rotation.x = Math.sin(t * 1.1) * 0.07;
            spores.forEach((m, i) => { const a = t * 0.8 + i * 0.9; m.position.set(Math.cos(a) * 0.55, 0.75 + Math.sin(a * 1.7 + i) * 0.32, Math.sin(a) * 0.55); });
            if (st.down) root.rotation.z = st.down * 1.3;
            if (st.atk) head.rotation.x = 0.55 * Math.sin(st.atk * PI);
        });
    },

    fae(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bodyG = new THREE.Group(); bodyG.position.y = 0.6; root.add(bodyG);
        const peach = '#f1d4bd';
        const flat = toonMat({ vertexColors: true });
        const dressM = skin('cloth', c1, c2);
        // head, neck, small body in a bell dress, thin arms and legs
        const head = ball(0.125, 0.135, 0.12, { seg: 18, rings: 14 }, (px, py, pz, o) => { const jt = smooth(0.1, -1, py / 0.135); o[0] = px * (1 - 0.18 * jt); o[1] = py; o[2] = pz * (1 - 0.06 * jt); });
        xform(tint(head, peach, { ao: 0.3 }), { p: [0, 0.3, 0] });
        const dress = tint(loft([{ y: -0.4, rx: 0.2, rz: 0.19, wob: (a) => 0.08 * Math.cos(a * 5) }, { y: -0.28, rx: 0.15, rz: 0.14 }, { y: -0.1, rx: 0.075, rz: 0.07 }, { y: 0.02, rx: 0.075, rz: 0.065 }, { y: 0.1, rx: 0.045, rz: 0.045 }], { seg: 14 }), '#ffffff', { ao: 0.35 });
        const limbs = [];
        for (const sd of [-1, 1]) {
            limbs.push(tint(tube([[sd * 0.07, 0.02, 0], [sd * 0.14, -0.1, 0.03], [sd * 0.17, -0.22, 0.09]], [0.022, 0.018, 0.015], { seg: 6, n: 8 }), peach, { ao: 0.2 }));
            limbs.push(tint(tube([[sd * 0.04, -0.34, 0], [sd * 0.05, -0.5, 0.02], [sd * 0.05, -0.62, 0.0]], [0.022, 0.018, 0.014], { seg: 6, n: 8 }), peach, { ao: 0.2 }));
            limbs.push(xform(tint(ball(0.032, 0.02, 0.05, { seg: 8, rings: 6 }), '#6a4a2a', { ao: 0.2 }), { p: [sd * 0.05, -0.64, 0.03] }));
        }
        bodyG.add(P(shadeGeo(dress, {}), dressM, 0.01), P(bake([head, ...limbs]), flat, 0.009));
        for (const sd of [-1, 1]) { const e = beadEye(0.034); e.position.set(sd * 0.05, 0.31, 0.108); e.rotation.y = sd * 0.25; bodyG.add(e); }
        bodyG.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.02, 0.24, 0.118), new THREE.Vector3(0, 0.232, 0.122), new THREE.Vector3(0.02, 0.24, 0.118)]), 6, 0.0035, 4), '#8a3a3a'));
        // hair: bangs and a bob
        const hair = [xform(ball(0.138, 0.12, 0.135, { seg: 16, rings: 10 }, (px, py, pz, o) => { o[0] = px; o[1] = Math.max(py, -0.04 - 0.08 * Math.max(0, -pz / 0.135)); o[2] = pz; }), { p: [0, 0.34, -0.012] })];
        for (let k = 0; k < 4; k++) { const t = k / 3 - 0.5; hair.push(tube([[t * 0.12, 0.44, 0.06], [t * 0.16, 0.41, 0.115], [t * 0.17, 0.36, 0.125]], [0.01, 0.028, 0.004], { seg: 6, n: 8, flat: 0.4 })); }
        for (const g of hair) tint(g, hexShade(c2, 0.9), { ao: 0.25 });
        bodyG.add(P(bake(hair), flat, 0.008));
        if (has(x, 'leafhat')) {
            const hat = tint(loft([{ y: 0, rx: 0.2, rz: 0.2, sq: 2 }, { y: 0.03, rx: 0.17, rz: 0.17 }, { y: 0.14, rx: 0.1, rz: 0.1 }, { y: 0.27, rx: 0.02, rz: 0.02 }], { seg: 14 }), '#ffffff', { ao: 0.3 });
            xform(hat, { p: [0, 0.43, -0.01], r: [0.12, 0, 0.14] });
            bodyG.add(P(hat, skin('leaf', '#3a8a3a', '#8ae05a'), 0.01));
        }
        if (has(x, 'crown')) {
            const spikes = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * PI * 2; return tint(tube([[Math.cos(a) * 0.11, 0.43, Math.sin(a) * 0.11], [Math.cos(a) * 0.125, 0.5, Math.sin(a) * 0.125], [Math.cos(a) * 0.12, 0.56, Math.sin(a) * 0.12]], [0.014, 0.012, 0.002], { seg: 5, n: 5 }), gl, { ao: 0 }); });
            bodyG.add(P(bake([...spikes, tint(loft([{ y: 0.42, rx: 0.115, rz: 0.115 }, { y: 0.45, rx: 0.118, rz: 0.118 }], { seg: 14 }), gl, { ao: 0 })]), flat, 0.006));
        }
        if (has(x, 'veil')) {
            const vm = toonMat({ vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
            bodyG.add(P(tint(loft([{ y: -0.55, rx: 0.34, rz: 0.3, wob: (a) => 0.1 * Math.cos(a * 7) }, { y: -0.3, rx: 0.22, rz: 0.2 }, { y: 0.28, rx: 0.15, rz: 0.15 }, { y: 0.34, rx: 0.1, rz: 0.1 }], { seg: 16 }), c2, { ao: 0.1 }), vm, 0.0001));
        }
        const wings = [];
        for (const sd of [-1, 1]) for (const k of [0, 1]) {
            const piv = new THREE.Group(); piv.position.set(sd * 0.03, 0.04 - k * 0.12, -0.07);
            const w = insectWing(gl, k ? 0.3 : 0.42, k ? 0.38 : 0.55); w.scale.x = sd; w.rotation.x = -0.3 + k * 0.5;
            piv.add(w); bodyG.add(piv); wings.push({ piv, sd, k });
        }
        return wrap(root, 1.0, 0.35, (st, t) => {
            bodyG.position.y = 0.62 + Math.sin(t * 2.4) * 0.07;
            wings.forEach(({ piv, sd, k }) => { piv.rotation.y = sd * (0.55 + Math.sin(t * 26 + k) * 0.5); });
            bodyG.rotation.x = st.atk ? 0.5 * Math.sin(st.atk * PI) : 0.05;
            if (st.cast) bodyG.position.y += 0.2 * Math.sin(st.cast * PI);
            if (st.down) { root.rotation.z = st.down * 1.4; bodyG.position.y = 0.4 - st.down * 0.35; }
        });
    },

    tree(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const barkM = skin('bark', c1, hexShade(c1, 0.6));
        const bark = wobble(2.4, 0.07);
        const rings = [
            { y: 0.0, rx: 0.64, rz: 0.6, wob: wobble(0.3, 0.18) }, { y: 0.14, rx: 0.46, rz: 0.43, wob: bark }, { y: 0.5, rx: 0.37, rz: 0.35, x: 0.02, wob: bark },
            { y: 0.95, rx: 0.34, rz: 0.33, x: -0.03, z: 0.02, wob: bark }, { y: 1.35, rx: 0.3, rz: 0.29, x: 0.02, wob: bark }, { y: 1.62, rx: 0.2, rz: 0.2 },
        ];
        const trunk = tint(loft(rings, { seg: 22 }), '#ffffff', { ao: 0.4, front: 0.3 });
        const rootsG = [-1, 0.3, 1.9, 3.5, 5.1].map((a) => tint(tube([[Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.28], [Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.52], [Math.cos(a) * 0.8, 0.0, Math.sin(a) * 0.76]], [0.11, 0.08, 0.02], { seg: 7, n: 8 }), '#ffffff', { ao: 0.3 }));
        root.add(P(bake([trunk, ...rootsG]), barkM, 0.022));
        // the carved face: dark hollows, glowing eyes and a grin
        const face = new THREE.Group(); face.position.set(0, 0.86, 0.3); root.add(face);
        for (const sd of [-1, 1]) {
            const hol = ball(0.1, 0.08, 0.05, { seg: 10, rings: 8 }); xform(tint(hol, '#1a0c06', { ao: 0 }), { p: [sd * 0.13, 0.04, 0.0], r: [0, 0, sd * -0.2] });
            face.add(P(hol, toonMat({ vertexColors: true }), 0.004));
            const e = eye(0.055, gl, { slit: 0.45 }); e.position.set(sd * 0.13, 0.04, 0.045); e.rotation.z = sd * -0.25; face.add(e);
        }
        const grin = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, -0.12, 0.03), new THREE.Vector3(-0.06, -0.19, 0.045), new THREE.Vector3(0.06, -0.19, 0.045), new THREE.Vector3(0.15, -0.12, 0.03)]), 12, 0.014, 5);
        face.add(glow(grin, gl));
        // crown of limbs, canopy lobes, blossoms and thorns sway together
        const crown = new THREE.Group(); crown.position.y = 1.3; root.add(crown);
        const limbs = [];
        for (const sd of [-1, 1]) limbs.push(tint(tube([[sd * 0.2, 0.0, 0], [sd * 0.5, 0.18, 0.05], [sd * 0.78, 0.5, 0.0], [sd * 0.92, 0.78, -0.05]], [0.13, 0.09, 0.055, 0.03], { seg: 8, n: 12 }), '#ffffff', { ao: 0.3 }), tint(tube([[sd * 0.62, 0.34, 0.03], [sd * 0.85, 0.34, 0.1], [sd * 1.0, 0.24, 0.12]], [0.04, 0.03, 0.008], { seg: 6, n: 8 }), '#ffffff', { ao: 0.3 }));
        limbs.push(tint(tube([[0, 0.2, 0], [0.04, 0.5, -0.02], [-0.02, 0.8, 0]], [0.17, 0.12, 0.07], { seg: 8, n: 8 }), '#ffffff', { ao: 0.3 }));
        crown.add(P(bake(limbs), barkM, 0.016));
        const leafM = skin('leaf', has(x, 'blossoms') ? c2 : '#3a8a3a', '#6ac04a');
        const lobes = [];
        const lump = wobble(5.1, 0.12);
        const spots = [[0, 0.95, 0, 0.5], [-0.5, 0.85, 0.1, 0.38], [0.5, 0.8, -0.05, 0.4], [-0.25, 1.15, -0.3, 0.34], [0.3, 1.2, 0.25, 0.34], [-0.95, 0.75, 0, 0.26], [0.95, 0.9, -0.05, 0.28], [0.0, 1.35, 0.0, 0.3]];
        spots.forEach(([lx, ly, lz, r], i) => lobes.push(xform(tint(ball(r, r * 0.85, r, { seg: 14, rings: 10 }, (px, py, pz, o) => { const k = 1 + lump(Math.atan2(px, pz) * 2 + py * 6); o[0] = px * k; o[1] = py * k; o[2] = pz * k; }), '#ffffff', { top: '#ffffff', ao: 0.4 }), { p: [lx, ly, lz] })));
        crown.add(P(bake(lobes), leafM, 0.02));
        if (has(x, 'blossoms')) {
            const fl = [];
            for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = 0.35 + (i % 4) * 0.12; fl.push(xform(tint(ball(0.07, 0.05, 0.07, { seg: 8, rings: 6 }), i % 3 ? '#ff8ac8' : '#fff0f4', { ao: 0.1 }), { p: [Math.cos(a) * rr, 0.85 + (i % 5) * 0.12, Math.sin(a) * rr + 0.12] })); }
            crown.add(P(bake(fl), toonMat({ vertexColors: true }), 0.008));
        }
        if (has(x, 'thorns')) {
            const th = Array.from({ length: 9 }, (_, i) => { const a = i * 0.7, y = 0.3 + (i % 3) * 0.32; return tint(tube([[Math.cos(a) * 0.35, y, Math.sin(a) * 0.33], [Math.cos(a) * 0.5, y + 0.06, Math.sin(a) * 0.48], [Math.cos(a) * 0.64, y + 0.02, Math.sin(a) * 0.6]], [0.04, 0.03, 0.002], { seg: 6, n: 6 }), c2, { ao: 0.2 }); });
            root.add(P(bake(th), toonMat({ vertexColors: true }), 0.01));
        }
        if (has(x, 'crown')) {
            const tw = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * PI * 2; return tint(tube([[Math.cos(a) * 0.25, 1.3, Math.sin(a) * 0.25], [Math.cos(a) * 0.32, 1.52, Math.sin(a) * 0.32], [Math.cos(a) * 0.3, 1.74, Math.sin(a) * 0.3]], [0.03, 0.02, 0.003], { seg: 5, n: 6 }), c2, { ao: 0.1 }); });
            crown.add(P(bake(tw), toonMat({ vertexColors: true }), 0.008));
            for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; const m = glow(new THREE.SphereGeometry(0.035, 6, 5), gl); m.position.set(Math.cos(a) * 0.3, 1.78, Math.sin(a) * 0.3); crown.add(m); }
        }
        return wrap(root, 3.0, 1.0, (st, t) => {
            crown.rotation.z = Math.sin(t * 0.9) * 0.025; crown.rotation.x = st.atk ? 0.3 * Math.sin(st.atk * PI) : Math.sin(t * 0.7) * 0.012;
            face.rotation.z = Math.sin(t * 0.9) * 0.01;
            if (st.down) root.rotation.z = st.down * 0.9;
            if (st.cast) crown.scale.setScalar(1 + 0.05 * Math.sin(st.cast * PI * 2));
        });
    },
};
