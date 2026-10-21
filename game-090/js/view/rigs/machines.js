// The constructs and colossi: armoured robots, drones, spiders, turrets, golems and the AI cores.

import { THREE, loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp, glow, hexShade, PI, has, wrap, skin, P, shadeGeo, wobble, eye, halo, insectWing, featherWing, batWing, motes, flame, slab, rod } from './kit.js';
import { toonMat } from '../toon.js';

const flatM = () => toonMat({ vertexColors: true });
const shade = (g, o) => shadeGeo(g, { ao: 0.4, ...o });
const sock = (g, c) => tint(g, c, { ao: 0.3 });

export const MACHINES = {
    robot(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bulk = has(x, 'bulk') ? 1.28 : 1;
        const plate = skin('plate', c1, c2), steel = skin('metal', '#7a828e', '#4a5058');
        const hips = new THREE.Group(); hips.position.y = 0.78 * bulk; root.add(hips);
        const pelvis = slab(0.36 * bulk, 0.2, 0.26 * bulk, { sq: 3.5, taper: 0.92 }); pelvis.translate(0, 0.02, 0);
        const chest = loft([{ y: 0.1, rx: 0.2 * bulk, rz: 0.14 * bulk, sq: 3.5 }, { y: 0.3, rx: 0.3 * bulk, rz: 0.2 * bulk, sq: 3.4 }, { y: 0.56, rx: 0.34 * bulk, rz: 0.22 * bulk, sq: 3.4 }, { y: 0.7, rx: 0.26 * bulk, rz: 0.17 * bulk, sq: 3 }], { seg: 18, caps: true });
        const tparts = [shade(pelvis), shade(chest)];
        if (has(x, 'plates')) tparts.push(xform(shade(slab(0.78 * bulk, 0.1, 0.5 * bulk, { sq: 3.5 })), { p: [0, 0.72 * bulk, 0] }));
        hips.add(P(bake(tparts), plate, 0.018));
        // the chest panel: a vent grille and a lamp
        hips.add(P(shade(xform(slab(0.22, 0.2, 0.04, { sq: 4 }), { p: [0, 0.42 * bulk, 0.2 * bulk] })), steel, 0.008));
        for (let i = 0; i < 4; i++) hips.add(glow(new THREE.BoxGeometry(0.16, 0.012, 0.01), hexShade(gl, 0.6), { p: [0, 0.35 * bulk + i * 0.045, 0.225 * bulk] }));
        if (has(x, 'lamp')) { const l = glow(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), gl, { p: [0, 0.82 * bulk, 0.1] }); hips.add(l); }
        const neck = P(shade(rod(0.07, 0.08, 0.12)), steel, 0.01); neck.position.y = 0.74 * bulk; hips.add(neck);
        const head = new THREE.Group(); head.position.y = (0.8 * bulk); hips.add(head);
        head.add(P(shade(loft([{ y: 0.0, rx: 0.14, rz: 0.13, sq: 3.2 }, { y: 0.14, rx: 0.18, rz: 0.16, sq: 3.4 }, { y: 0.28, rx: 0.15, rz: 0.14, sq: 3.2 }], { seg: 16, caps: true })), plate, 0.014));
        head.add(P(shade(xform(slab(0.27, 0.07, 0.05, { sq: 3 }), { p: [0, 0.16, 0.14] })), steel, 0.006));
        head.add(glow(new THREE.BoxGeometry(0.23, 0.04, 0.02), gl, { p: [0, 0.16, 0.168] }));
        if (has(x, 'antenna')) head.add(P(bake([tint(tube([[0.1, 0.27, 0], [0.12, 0.42, 0], [0.1, 0.56, 0]], [0.012, 0.01, 0.008], { seg: 5, n: 6 }), '#8a8a90', { ao: 0.2 }), xform(tint(ball(0.04, 0.04, 0.04, { seg: 8, rings: 6 }), '#ff6a4a', { ao: 0 }), { p: [0.1, 0.57, 0] })]), flatM(), 0.006));
        if (has(x, 'halo')) head.add(halo(gl, 0.26, 0.5, 0));
        const arm = (sd) => {
            const p = new THREE.Group(); p.position.set(sd * 0.4 * bulk, 0.62 * bulk, 0);
            const upper = loft([{ y: 0.07, rx: 0.1 * bulk, rz: 0.1 * bulk }, { y: -0.1, rx: 0.075 * bulk, rz: 0.075 * bulk }, { y: -0.3, rx: 0.065 * bulk, rz: 0.065 * bulk }], { seg: 10 });
            const sh = ball(0.13 * bulk, 0.1 * bulk, 0.13 * bulk, { seg: 12, rings: 8 }, (px, py, pz, o) => { o[0] = px; o[1] = Math.max(py, -0.03); o[2] = pz; });
            const el = new THREE.Group(); el.position.y = -0.3; p.add(el);
            const fore = loft([{ y: 0, rx: 0.07 * bulk, rz: 0.07 * bulk }, { y: -0.12, rx: 0.085 * bulk, rz: 0.085 * bulk }, { y: -0.34, rx: 0.07 * bulk, rz: 0.07 * bulk }], { seg: 10, caps: true });
            const fist = xform(slab(0.15 * bulk, 0.15, 0.14 * bulk, { sq: 3.5 }), { p: [0, -0.43, 0] });
            p.add(P(bake([shade(upper), shade(sh, { top: '#ffffff' })]), plate, 0.014));
            el.add(P(bake([sock(ball(0.065 * bulk, 0.065 * bulk, 0.065 * bulk, { seg: 8, rings: 6 }), '#555a62'), shade(fore), shade(fist)]), plate, 0.014));
            hips.add(p);
            if (sd === -1 && has(x, 'shield')) el.add(P(shade(xform(slab(0.06, 0.62, 0.46, { sq: 3.5, taperZ: 0.9 }), { p: [-0.13, -0.15, 0.14] })), plate, 0.016));
            return p;
        };
        const armL = arm(-1), armR = arm(1);
        const leg = (sd) => {
            const p = new THREE.Group(); p.position.set(sd * 0.16 * bulk, 0.0, 0);
            const thigh = loft([{ y: 0.04, rx: 0.1 * bulk, rz: 0.1 * bulk }, { y: -0.2, rx: 0.08 * bulk, rz: 0.08 * bulk }, { y: -0.4, rx: 0.07 * bulk, rz: 0.075 * bulk }], { seg: 10 });
            const shin = loft([{ y: -0.4, rx: 0.075 * bulk, rz: 0.08 * bulk, sq: 3 }, { y: -0.55, rx: 0.09 * bulk, rz: 0.09 * bulk, sq: 3 }, { y: -0.74, rx: 0.065 * bulk, rz: 0.07 * bulk, sq: 3 }], { seg: 10, caps: true });
            const foot = xform(slab(0.17 * bulk, 0.08, 0.34 * bulk, { sq: 3.5, taperZ: 0.8 }), { p: [0, -0.78, 0.06] });
            p.add(P(bake([shade(thigh), sock(ball(0.075 * bulk, 0.075 * bulk, 0.075 * bulk, { seg: 8, rings: 6 }), '#555a62', {}), shade(shin), shade(foot)]), plate, 0.014));
            hips.add(p); return p;
        };
        const legL = leg(-1), legR = leg(1);
        return wrap(root, 1.7 * bulk, 0.55, (st, t) => {
            const w = st.move || 0, sw = Math.sin(t * 8) * 0.7 * w;
            legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
            hips.position.y = 0.78 * bulk + Math.sin(t * 1.6) * 0.012;
            head.rotation.y = Math.sin(t * 0.8) * 0.25;
            if (st.atk) { armR.rotation.x = -2.2 + st.atk * 3; hips.rotation.x = 0.2 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.2; }
            if (st.down) { root.rotation.x = -st.down * 1.45; root.position.y = st.down * 0.35; }
        });
    },

    drone(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 0.95; root.add(core);
        const plate = skin('plate', c1, c2), steel = skin('metal', '#8a929e', '#4a5058');
        const shell = ball(0.3, 0.28, 0.3, { seg: 22, rings: 16 });
        const belt = loft([{ y: -0.04, rx: 0.335, rz: 0.335 }, { y: 0.04, rx: 0.335, rz: 0.335 }], { seg: 24, caps: true });
        const nodes = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * PI * 2; return xform(sock(ball(0.04, 0.04, 0.04, { seg: 8, rings: 6 }), '#3a3e46'), { p: [Math.sin(a) * 0.34, 0, Math.cos(a) * 0.34] }); });
        core.add(P(bake([shade(shell, { top: '#ffffff' }), ...nodes]), plate, 0.016), P(shade(belt), steel, 0.01));
        // the great lens: a dark socket, a glowing iris, a pupil and a highlight
        const lens = new THREE.Group(); lens.position.set(0, 0.02, 0.27); core.add(lens);
        lens.add(P(sock(loft([{ y: -0.02, rx: 0.14, rz: 0.14 }, { y: 0.04, rx: 0.15, rz: 0.15 }], { seg: 16, caps: true }), '#14161c'), flatM(), 0.006)); lens.children[0].rotation.x = PI / 2;
        const e = eye(0.115, gl, { slit: 0.5 }); e.position.z = 0.06; lens.add(e);
        let rotors = null; const wings = [];
        if (has(x, 'rotors')) {
            rotors = new THREE.Group(); rotors.position.y = 0.37; core.add(rotors);
            rotors.add(P(shade(rod(0.03, 0.03, 0.12)), steel, 0.006));
            for (let i = 0; i < 3; i++) { const b = glow(new THREE.BoxGeometry(0.9, 0.012, 0.08), '#cfe8ff', { opacity: 0.55 }); b.rotation.y = (i / 3) * PI; b.position.y = 0.06; rotors.add(b); }
        }
        if (has(x, 'wings')) for (const sd of [-1, 1]) { const p = new THREE.Group(); p.position.set(sd * 0.3, 0.05, -0.06); p.add(featherWing(c2, c1, 0.75, [5, 4], sd)); core.add(p); wings.push({ p, sd }); }
        if (has(x, 'halo')) core.add(halo(gl, 0.28, 0.5, 0));
        core.add(P(shade(rod(0.1, 0.04, 0.12)), steel, 0.008)).position.y = 0; core.children.at(-1).position.set(0, -0.3, 0);
        return wrap(root, 1.4, 0.55, (st, t) => {
            core.position.y = 0.98 + Math.sin(t * 2.3) * 0.08;
            if (rotors) rotors.rotation.y = t * 30;
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * (0.1 + Math.sin(t * 5) * 0.2); });
            core.rotation.x = st.atk ? 0.6 * Math.sin(st.atk * PI) : 0;
            if (st.down) { root.position.y = -st.down * 0.55; core.rotation.z = st.down * 1.2; }
        });
    },

    spider(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const mantis = has(x, 'mantis');
        const chit = skin('plate', c1, c2), steel = skin('metal', '#8a929e', '#4a5058');
        const body = new THREE.Group(); body.position.y = 0.58; root.add(body);
        const abd = ball(0.3, 0.26, 0.4, { seg: 20, rings: 14 }, (px, py, pz, o) => { o[0] = px; o[1] = py + 0.02 * Math.max(0, pz / 0.4); o[2] = pz; }); abd.translate(0, 0.04, -0.28);
        const thorax = ball(0.2, 0.17, 0.24, { seg: 16, rings: 12 }); thorax.translate(0, 0.0, 0.18);
        const head = ball(0.14, 0.13, 0.15, { seg: 14, rings: 10 }); head.translate(0, 0.02, 0.42);
        const bp = [shade(abd, { top: '#ffffff' }), shade(thorax), shade(head)];
        body.add(P(bake(bp), chit, 0.016));
        for (let i = 0; i < 5; i++) body.add(glow(new THREE.BoxGeometry(0.38 - i * 0.04, 0.012, 0.012), hexShade(gl, 0.6), { p: [0, 0.27 - i * 0.012, -0.4 + i * 0.12] }));
        const nE = mantis ? 2 : 4;
        for (let i = 0; i < nE; i++) { const e = eye(i < 2 ? 0.04 : 0.026, gl, { slit: 0.5 }); e.position.set((i % 2 ? 1 : -1) * (i < 2 ? 0.065 : 0.11), 0.06 + (i < 2 ? 0 : 0.04), 0.545 - (i < 2 ? 0 : 0.03)); e.rotation.y = (i % 2 ? 1 : -1) * (i < 2 ? 0.25 : 0.7); body.add(e); }
        if (has(x, 'dish')) {
            const dish = loft([{ y: 0, rx: 0.01, rz: 0.01 }, { y: 0.06, rx: 0.28, rz: 0.28 }, { y: 0.1, rx: 0.34, rz: 0.34 }], { seg: 20 });
            const mast = tube([[0, 0, 0], [0, 0.18, 0.02], [0, 0.34, 0.08]], [0.03, 0.02, 0.016], { seg: 6, n: 6 });
            const feed = xform(sock(ball(0.035, 0.035, 0.035, { seg: 8, rings: 6 }), '#c8ccd4'), { p: [0, 0.32, 0.2] });
            body.add(P(bake([xform(shade(dish), { p: [0, 0.4, -0.22], r: [-0.7, 0, 0] }), xform(shade(mast), { p: [0, 0.26, -0.22] }), xform(feed, { p: [0, 0.28, -0.1] })]), steel, 0.012));
        }
        const legs = [];
        const n = mantis ? 4 : 6;
        for (let i = 0; i < n; i++) {
            const sd = i % 2 ? 1 : -1, row = Math.floor(i / 2);
            const p = new THREE.Group(); p.position.set(sd * 0.15, 0.02, 0.28 - row * 0.2 - (n === 4 ? 0.06 : 0.02));
            const spread = 0.62 + row * 0.1;
            const leg = tube([[0, 0, 0], [sd * 0.2, 0.22, 0.02 * (1 - row)], [sd * 0.42, 0.12, 0.0], [sd * spread, -0.18, 0.0], [sd * (spread + 0.08), -0.58, 0.0]], [0.04, 0.034, 0.03, 0.024, 0.008], { seg: 6, n: 18 });
            p.add(P(shade(leg), steel, 0.01));
            p.add(P(sock(ball(0.05, 0.05, 0.05, { seg: 8, rings: 6 }), '#4a4e58'), flatM(), 0.006)).position.set(sd * 0.2, 0.22, 0);
            body.add(p); legs.push({ p, ph: i * 1.1 });
        }
        const blades = [];
        if (mantis || has(x, 'blades')) for (const sd of [-1, 1]) {
            const p = new THREE.Group(); p.position.set(sd * 0.2, 0.08, 0.34);
            const arm = tube([[0, 0, 0], [sd * 0.12, 0.1, 0.15], [sd * 0.18, 0.05, 0.4], [sd * 0.12, -0.15, 0.62]], [0.045, 0.036, 0.03, 0.012], { seg: 6, n: 12 });
            const blade = tube([[sd * 0.12, -0.12, 0.45], [sd * 0.1, 0.02, 0.62], [sd * 0.04, 0.18, 0.72]], [0.012, 0.045, 0.004], { seg: 6, n: 10, flat: 0.12 });
            p.add(P(bake([shade(arm), tint(blade, '#ffffff', { ao: 0.1 })]), steel, 0.01));
            p.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 0.12, -0.12, 0.47), new THREE.Vector3(sd * 0.1, 0.03, 0.63), new THREE.Vector3(sd * 0.045, 0.17, 0.72)]), 8, 0.004, 4), gl));
            body.add(p); blades.push({ p, sd });
        }
        return wrap(root, 1.0 * (mantis ? 1.2 : 1), 0.8, (st, t) => {
            const w = st.move || 0;
            legs.forEach(({ p, ph }, i) => { const sd = i % 2 ? 1 : -1; p.rotation.y = Math.sin(t * 9 + ph) * 0.3 * w * sd; p.rotation.z = Math.max(0, Math.sin(t * 9 + ph)) * 0.18 * w * sd; });
            body.position.y = 0.58 + Math.sin(t * 2) * 0.012;
            blades.forEach(({ p, sd }) => { p.rotation.x = st.atk ? -0.9 * Math.sin(st.atk * PI) : Math.sin(t * 1.5) * 0.06; });
            body.rotation.x = st.atk ? -0.2 * Math.sin(st.atk * PI) : 0;
            if (st.down) { root.rotation.z = st.down * 0.9; root.position.y = -st.down * 0.2; }
        });
    },

    turret(d) {
        const [c1, c2, gl] = d.c;
        const root = new THREE.Group();
        const plate = skin('plate', c1, c2), steel = skin('metal', '#8a929e', '#4a5058');
        root.add(P(bake([shade(loft([{ y: 0, rx: 0.52, rz: 0.52 }, { y: 0.2, rx: 0.46, rz: 0.46 }, { y: 0.32, rx: 0.32, rz: 0.32 }], { seg: 16, caps: true })), shade(loft([{ y: 0.3, rx: 0.2, rz: 0.2 }, { y: 0.7, rx: 0.16, rz: 0.16 }, { y: 0.84, rx: 0.22, rz: 0.22 }], { seg: 14 }))]), plate, 0.02));
        for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; root.add(P(shade(xform(rod(0.04, 0.04, 0.12), { p: [Math.sin(a) * 0.45, 0.2, Math.cos(a) * 0.45] })), steel, 0.006)); }
        const head = new THREE.Group(); head.position.y = 1.02; root.add(head);
        head.add(P(bake([shade(slab(0.6, 0.4, 0.52, { sq: 3.4, taper: 0.9 })), xform(shade(slab(0.5, 0.1, 0.4, { sq: 3.4 })), { p: [0, 0.24, 0] })]), plate, 0.018));
        for (const sx of [-0.15, 0.15]) head.add(P(bake([shade(xform(rod(0.06, 0.055, 0.6), { r: [PI / 2, 0, 0], p: [sx, 0, 0.5] })), xform(shade(rod(0.08, 0.08, 0.1)), { r: [PI / 2, 0, 0], p: [sx, 0, 0.78] })]), steel, 0.01));
        const e = eye(0.1, gl, { slit: 0.4 }); e.position.set(0, 0.04, 0.27); head.add(e);
        head.add(glow(new THREE.BoxGeometry(0.42, 0.02, 0.01), hexShade(gl, 0.7), { p: [0, -0.12, 0.265] }));
        return wrap(root, 1.5, 0.6, (st, t) => {
            head.rotation.y = Math.sin(t * 0.7) * 0.6 + (st.atk ? 0.3 : 0);
            head.position.z = st.atk ? -0.1 * Math.sin(st.atk * PI) : 0;
            if (st.down) { head.rotation.x = st.down * 0.6; head.position.y = 1.02 - st.down * 0.2; }
        });
    },

    golem(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bricky = has(x, 'bricks') || has(x, 'plates');
        const rock = skin(has(x, 'bricks') ? 'plate' : has(x, 'moss') ? 'stone' : 'stone', c1, c2, { size: 128 });
        const steel = skin('metal', '#8a929e', '#4a5058');
        const hips = new THREE.Group(); hips.position.y = 0.7; root.add(hips);
        const chunk = wobble(4.2, 0.07);
        const torso = loft([
            { y: 0.28, rx: 0.4, rz: 0.3, sq: 3.2, wob: chunk }, { y: 0.55, rx: 0.5, rz: 0.36, sq: 3.2, wob: chunk }, { y: 0.95, rx: 0.56, rz: 0.4, sq: 3.1, wob: chunk }, { y: 1.3, rx: 0.62, rz: 0.4, sq: 3.1, wob: chunk }, { y: 1.5, rx: 0.4, rz: 0.3, sq: 3, wob: chunk },
        ], { seg: 20, caps: true });
        const headG = loft([{ y: 1.5, rx: 0.22, rz: 0.2, sq: 3.2 }, { y: 1.68, rx: 0.3, rz: 0.26, sq: 3.3, wob: chunk }, { y: 1.88, rx: 0.26, rz: 0.22, sq: 3.1 }], { seg: 14, caps: true });
        const body = [shade(torso, { top: '#ffffff' }), shade(headG)];
        for (const sd of [-1, 1]) body.push(shade(xform(ball(0.27, 0.22, 0.26, { seg: 12, rings: 9 }, (px, py, pz, o) => { const k = 1 + chunk(Math.atan2(px, pz) * 2 + py * 5); o[0] = px * k; o[1] = py * k; o[2] = pz * k; }), { p: [sd * 0.74, 1.28, 0] })));
        if (has(x, 'plates')) body.push(shade(xform(slab(1.3, 0.12, 0.84, { sq: 3.4 }), { p: [0, 1.45, 0] })));
        hips.add(P(bake(body), rock, 0.03));
        hips.add(P(bake([shade(xform(slab(0.6, 0.16, 0.5, { sq: 3.4 }), { p: [0, 0.18, 0] }))]), rock, 0.03));
        const eyeY = 1.69;
        for (const sd of [-1, 1]) { const e = eye(0.06, gl, { slit: 0.35 }); e.position.set(sd * 0.12, eyeY, 0.255); e.rotation.z = sd * -0.25; hips.add(e); }
        if (has(x, 'moss')) hips.add(P(bake(Array.from({ length: 8 }, (_, i) => xform(tint(ball(0.17, 0.1, 0.17, { seg: 8, rings: 6 }), '#ffffff', { ao: 0.2 }), { p: [(i % 4 - 1.5) * 0.3, 1.46 + (i % 2) * 0.08, (Math.floor(i / 4) - 0.5) * 0.4] }))), skin('leaf', '#3f8a35', '#8ae05a'), 0.012));
        if (has(x, 'flowers')) for (const [px, pz, c] of [[0.3, 0.3, '#ff8ac8'], [-0.3, 0.25, '#ffe84a'], [0.0, -0.3, '#fff0f4']]) hips.add(P(bake(Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * PI * 2; return xform(tint(ball(0.05, 0.018, 0.034, { seg: 6, rings: 4 }), c, { ao: 0.1 }), { p: [Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055], r: [0, -a, 0] }); })), flatM(), 0.004)).position.set(px, 1.55, pz);
        if (has(x, 'horns')) hips.add(P(bake([-1, 1].map((sd) => tint(tube([[sd * 0.15, 1.82, 0], [sd * 0.3, 2.0, -0.04], [sd * 0.28, 2.2, -0.1]], [0.07, 0.05, 0.005], { seg: 6, n: 8 }), c2, { ao: 0.2 }))), flatM(), 0.012));
        if (has(x, 'wings')) for (const sd of [-1, 1]) { const w = batWing(c2, hexShade(c1, 0.6), 1.1, sd); w.position.set(sd * 0.3, 1.2, -0.38); w.rotation.y = sd * 0.2; hips.add(w); }
        if (has(x, 'pylon')) {
            hips.add(P(bake([tint(tube([[0, 1.5, 0], [0, 2.1, 0], [0, 2.7, 0]], [0.1, 0.05, 0.035], { seg: 8, n: 8 }), '#ffffff', { ao: 0.2 }), ...[2.5, 2.2, 1.9].map((y, i) => xform(shade(slab(0.9 - i * 0.2, 0.05, 0.06, { sq: 3 })), { p: [0, y, 0] }))]), steel, 0.01));
            for (const [px, py] of [[0.42, 2.5], [-0.42, 2.5], [0.3, 2.2], [-0.3, 2.2]]) hips.add(glow(new THREE.SphereGeometry(0.04, 6, 5), gl, { p: [px, py + 0.05, 0] }));
        }
        let turbine = null;
        if (has(x, 'turbine')) {
            turbine = new THREE.Group(); turbine.position.set(0, 1.55, -0.5); hips.add(turbine);
            turbine.add(P(shade(rod(0.14, 0.14, 0.2, { rz0: 0.14 })), steel, 0.01)).rotation.x = PI / 2;
            for (let i = 0; i < 3; i++) { const bl = loft([{ y: 0.1, rx: 0.07, rz: 0.012 }, { y: 0.6, rx: 0.1, rz: 0.01 }, { y: 1.5, rx: 0.07, rz: 0.008 }, { y: 1.6, rx: 0.004, rz: 0.004 }], { seg: 6 }); bl.rotateZ((i * PI * 2) / 3); turbine.add(P(tint(bl, '#f4f8ff', { ao: 0.2 }), flatM(), 0.012)); }
        }
        if (has(x, 'core')) {
            const cage = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.014, 5, 22), new THREE.MeshBasicMaterial({ color: '#2a2e36' })); r.rotation.set(i * 1.0, i * 0.6, 0); return r; });
            const cg = new THREE.Group(); cg.position.set(0, 0.8, 0.32); cg.add(...cage, glow(new THREE.SphereGeometry(0.17, 12, 10), gl)); hips.add(cg);
        }
        if (has(x, 'cables')) for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; hips.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3 + 0.1), new THREE.Vector3(Math.cos(a) * 0.55, 0.8, Math.sin(a) * 0.5 + 0.1), new THREE.Vector3(Math.cos(a) * 0.52, 1.2, Math.sin(a) * 0.45)]), 10, 0.014, 4), gl)); }
        const arm = (sd) => {
            const p = new THREE.Group(); p.position.set(sd * 0.76, 1.28, 0);
            const g = [shade(loft([{ y: 0.1, rx: 0.2, rz: 0.2, sq: 3, wob: chunk }, { y: -0.4, rx: 0.17, rz: 0.17, sq: 3, wob: chunk }, { y: -0.85, rx: 0.2, rz: 0.2, sq: 3, wob: chunk }], { seg: 12 })), shade(xform(ball(0.26, 0.22, 0.26, { seg: 12, rings: 9 }, (px, py, pz, o) => { const k = 1 + chunk(Math.atan2(px, pz) * 2 + py * 5); o[0] = px * k; o[1] = py * k; o[2] = pz * k; }), { p: [0, -1.02, 0] }))];
            p.add(P(bake(g), rock, 0.028)); hips.add(p); return p;
        };
        const armL = arm(-1), armR = arm(1);
        const leg = (sd) => { const p = new THREE.Group(); p.position.set(sd * 0.26, 0.28, 0); p.add(P(bake([shade(loft([{ y: 0.0, rx: 0.2, rz: 0.2, sq: 3, wob: chunk }, { y: -0.35, rx: 0.17, rz: 0.17, sq: 3, wob: chunk }], { seg: 12 })), shade(xform(slab(0.4, 0.2, 0.6, { sq: 3.4 }), { p: [0, -0.5, 0.08] }))]), rock, 0.028)); hips.add(p); return p; };
        const legL = leg(-1), legR = leg(1);
        return wrap(root, 2.4, 0.9, (st, t) => {
            const w = st.move || 0, sw = Math.sin(t * 5) * 0.5 * w;
            legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
            hips.position.y = 0.7 + Math.sin(t * 1.3) * 0.015;
            if (turbine) turbine.rotation.z = t * 2.4;
            if (st.atk) { armL.rotation.x = armR.rotation.x = -2.5 + st.atk * 3.2; hips.rotation.x = 0.3 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.6; }
            if (st.down) { root.rotation.x = -st.down * 1.2; root.position.y = st.down * 0.5; }
        });
    },

    orb(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 1.5; root.add(core);
        const steel = skin('metal', '#8a929e', '#3a4048'), plate = skin('plate', c1, c2);
        core.add(glow(new THREE.SphereGeometry(0.46, 20, 16), gl));
        core.add(glow(new THREE.SphereGeometry(0.72, 20, 16), c2, { opacity: 0.2 }));
        // a cage of facets with glowing seams around the core
        const ico = new THREE.IcosahedronGeometry(0.62, 1);
        core.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico), new THREE.LineBasicMaterial({ color: gl, toneMapped: false })));
        const rings = [0, 1, 2].map((i) => {
            const rg = new THREE.Group();
            const rr = 0.92 + i * 0.36;
            const torus = tint(new THREE.TorusGeometry(rr, 0.045 + i * 0.01, 8, 48), '#ffffff', { ao: 0.3 });
            const ticks = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * PI * 2; return xform(shade(slab(0.04, 0.1, 0.05, { sq: 3 }), {}), { p: [Math.cos(a) * rr, Math.sin(a) * rr, 0], r: [0, 0, a] }); });
            rg.add(P(bake([torus, ...ticks]), i % 2 ? plate : steel, 0.012));
            rg.add(glow(new THREE.TorusGeometry(rr, 0.012, 4, 64), i % 2 ? c2 : '#ffffff'));
            core.add(rg); return rg;
        });
        const plates = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * PI * 2; const pg = P(shade(xform(slab(0.3, 0.5, 0.06, { sq: 3 }), {})), plate, 0.012); pg.position.set(Math.cos(a) * 1.1, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.1); pg.rotation.y = -a; core.add(pg); return pg; });
        if (has(x, 'cables')) for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; core.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.5, -0.4, Math.sin(a) * 0.5), new THREE.Vector3(Math.cos(a) * 0.8, -0.9, Math.sin(a) * 0.8), new THREE.Vector3(Math.cos(a) * 0.7, -1.5, Math.sin(a) * 0.7)]), 12, 0.02, 4), c2, { opacity: 0.7 })); }
        if (has(x, 'blossoms')) {
            const petals = [];
            for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2, ca = Math.cos(a), sa = Math.sin(a); petals.push(tint(tube([[ca * 0.5, sa * 0.5, 0.0], [ca * 1.0, sa * 1.0, 0.1], [ca * 1.5, sa * 1.5, 0.0]], [0.04, 0.17, 0.01], { seg: 6, n: 10, flat: 0.15 }), i % 2 ? '#ffd0e8' : '#ffffff', { ao: 0.1 })); }
            const fl = P(bake(petals), toonMat({ vertexColors: true }), 0.012); fl.position.z = -0.3; core.add(fl);
        }
        if (has(x, 'halo')) core.add(halo('#ffffff', 2.0, 0, 0));
        return wrap(root, 3.4, 1.4, (st, t) => {
            core.position.y = 1.6 + Math.sin(t * 1.2) * 0.12;
            rings.forEach((r, i) => { r.rotation.x = t * (0.5 + i * 0.25) * (i % 2 ? -1 : 1); r.rotation.y = t * (0.35 + i * 0.2); });
            plates.forEach((p, i) => { const a = t * 0.4 + (i / 6) * PI * 2; p.position.set(Math.cos(a) * 1.1, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.1); p.rotation.y = -a; });
            core.scale.setScalar(1 + (st.cast ? 0.2 * Math.sin(st.cast * PI) : 0) + (st.atk ? 0.15 * Math.sin(st.atk * PI) : 0));
            if (st.down) core.scale.setScalar(1 - st.down * 0.3);
        });
    },
};
