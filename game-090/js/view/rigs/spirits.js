// The wisps, archons and husks: spectral shapes, armoured sentinels and corrupted human shells.

import { THREE, loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp, glow, hexShade, PI, has, wrap, skin, P, shadeGeo, wobble, eye, beadEye, halo, insectWing, featherWing, motes, flame, slab, rod } from './kit.js';
import { toonMat } from '../toon.js';

const flatM = () => toonMat({ vertexColors: true });
const shade = (g, o) => shadeGeo(g, { ao: 0.35, ...o });
const zig = (n, len, amp, seed) => { const p = []; for (let i = 0; i <= n; i++) p.push(new THREE.Vector3((Math.sin(seed + i * 2.3) * amp), (i / n) * len, (Math.cos(seed * 1.7 + i * 1.9) * amp))); return p; };

export const SPIRITS = {
    wisp(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 0.95; root.add(core);
        const ghostM = (op = 0.78) => toonMat({ vertexColors: true, map: skin('ghost', c1, c2).map, color: '#ffffff', transparent: true, opacity: op, side: THREE.DoubleSide, steps: 3 });
        const hooded = has(x, 'hood');
        const gnat = has(x, 'lamp');
        const flick = [];
        if (gnat) {
            // a glow-gnat: a tiny body, long legs, veined wings and a lamp for an abdomen
            core.add(P(bake([shade(ball(0.1, 0.09, 0.13, { seg: 12, rings: 9 })), xform(shade(ball(0.15, 0.14, 0.18, { seg: 12, rings: 9 })), { p: [0, -0.04, -0.26] }), ...[-1, 1].flatMap((sd) => [0, 1, 2].map((k) => tint(tube([[sd * 0.05, -0.05, 0.02 - k * 0.07], [sd * 0.2, -0.22, 0.06 - k * 0.07], [sd * 0.26, -0.5, 0.1 - k * 0.08]], [0.012, 0.01, 0.004], { seg: 4, n: 6 }), '#2a2e38', { ao: 0.2 })))]), flatM(), 0.01));
            core.add(glow(new THREE.SphereGeometry(0.13, 12, 10), gl, { p: [0, -0.04, -0.3] })); core.add(glow(new THREE.SphereGeometry(0.24, 12, 10), gl, { p: [0, -0.04, -0.3], opacity: 0.25 }));
            for (const sd of [-1, 1]) { const e = eye(0.035, '#fff0a0'); e.position.set(sd * 0.055, 0.02, 0.1); e.rotation.y = sd * 0.5; core.add(e); }
            const ws = [];
            for (const sd of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sd * 0.04, 0.07, -0.05); const w = insectWing(gl, 0.4, 0.28); w.scale.x = sd; w.rotation.x = -PI / 2 + 0.3; piv.add(w); core.add(piv); ws.push({ piv, sd }); }
            flick.push((t) => ws.forEach(({ piv, sd }) => { piv.rotation.z = sd * (0.3 + Math.sin(t * 40) * 0.5); }));
        } else {
            // the robe: a swaying cone that frays into tendrils
            const wav = wobble(2.2, 0.1);
            const robe = loft([
                { y: -0.92, rx: 0.4, rz: 0.36, wob: (a) => 0.16 * Math.sin(a * 7) + wav(a) }, { y: -0.7, rx: 0.37, rz: 0.33, wob: (a) => 0.08 * Math.sin(a * 7 + 1) + wav(a) }, { y: -0.35, rx: 0.3, rz: 0.27, wob: wav },
                { y: -0.05, rx: 0.25, rz: 0.22 }, { y: 0.12, rx: 0.22, rz: 0.2 },
            ], { seg: 24 });
            core.add(P(tint(robe, '#ffffff', { ao: 0.15 }), ghostM(0.8), 0.01));
            const tend = [];
            for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.6; tend.push(tint(tube([[Math.cos(a) * 0.34, -0.85, Math.sin(a) * 0.3], [Math.cos(a) * 0.42, -1.05, Math.sin(a) * 0.38], [Math.cos(a) * 0.3 + 0.12, -1.25, Math.sin(a) * 0.28]], [0.05, 0.03, 0.002], { seg: 5, n: 8 }), '#ffffff', { ao: 0.1 })); }
            core.add(P(bake(tend), ghostM(0.55), 0.004));
            if (hooded) {
                const hood = loft([{ y: 0.0, rx: 0.22, rz: 0.2 }, { y: 0.14, rx: 0.25, rz: 0.23 }, { y: 0.3, rx: 0.24, rz: 0.22 }, { y: 0.43, rx: 0.19, rz: 0.18 }, { y: 0.52, rx: 0.1, rz: 0.1 }, { y: 0.56, rx: 0.003, rz: 0.003 }], { seg: 18 });
                    core.add(P(tint(hood, '#ffffff', { ao: 0.2 }), ghostM(0.95), 0.012));
                core.add(P(sock(ball(0.165, 0.19, 0.1, { seg: 14, rings: 10 }), '#07080e'), flatM(), 0.004)).position.set(0, 0.24, 0.15);
                const show = has(x, 'face');
                if (show) { core.add(P(sock(ball(0.12, 0.15, 0.07, { seg: 14, rings: 10 }, (px, py, pz, o) => { const jt = smooth(0.1, -1, py / 0.15); o[0] = px * (1 - 0.3 * jt); o[1] = py; o[2] = pz; }), '#e8e4f0'), flatM(), 0.006)).position.set(0, 0.23, 0.2); }
                for (const sd of [-1, 1]) { const e = eye(show ? 0.026 : 0.05, show ? '#10141c' : '#ffffff', { slit: 0.7, rim: show ? '#10141c' : '#07080e', pupil: show ? '#10141c' : '#07080e', tall: 1.1 }); e.position.set(sd * 0.075, 0.26, show ? 0.275 : 0.255); core.add(e); }
                if (show) core.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.03, 0.15, 0.272), new THREE.Vector3(0, 0.135, 0.276), new THREE.Vector3(0.03, 0.15, 0.272)]), 6, 0.005, 4), '#2a1a30'));
                if (has(x, 'tears')) for (const sd of [-1, 1]) core.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 0.075, 0.24, 0.275), new THREE.Vector3(sd * 0.08, 0.1, 0.275), new THREE.Vector3(sd * 0.075, -0.1, 0.26)]), 8, 0.006, 4), gl, { opacity: 0.8 }));
            } else {
                core.add(glow(new THREE.SphereGeometry(0.2, 14, 12), gl, { p: [0, 0.18, 0] })); core.add(glow(new THREE.SphereGeometry(0.34, 14, 12), gl, { p: [0, 0.18, 0], opacity: 0.25 }));
                for (const sd of [-1, 1]) { const e = eye(0.04, '#ffffff'); e.position.set(sd * 0.07, 0.22, 0.19); core.add(e); }
            }
            if (has(x, 'flames')) { for (let i = 0; i < 4; i++) { const f = flame(i ? gl : c2, 0.5 + (i % 2) * 0.2, 0.12); f.position.set(Math.cos(i * 1.6) * 0.2, 0.34, Math.sin(i * 1.6) * 0.2); core.add(f); flick.push((t) => f.userData.flick(t + i)); } }
            if (has(x, 'crackle')) { for (let i = 0; i < 5; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(zig(6, 0.7, 0.12, i)), new THREE.LineBasicMaterial({ color: '#fff7a0', toneMapped: false })); l.rotation.set(0, i * 1.3, 0.5 * Math.sin(i)); l.position.y = 0.0; core.add(l); flick.push((t) => { l.visible = Math.sin(t * 20 + i * 3) > -0.4; l.rotation.y += 0.04; }); } }
        }
        const sparks = motes(root, gnat ? 2 : has(x, 'flames') ? 8 : 5, c2, 0.035);
        return wrap(root, gnat ? 0.9 : 1.6, gnat ? 0.4 : 0.5, (st, t) => {
            core.position.y = 0.95 + Math.sin(t * 1.9) * 0.1;
            core.scale.setScalar(1 + Math.sin(t * 5) * 0.02);
            if (!gnat) core.rotation.y = Math.sin(t * 0.8) * 0.15;
            flick.forEach((f) => f(t));
            sparks.forEach((s, i) => { const a = t * 1.1 + i * 1.3; s.position.set(Math.cos(a) * 0.5, 0.2 + ((t * 0.5 + i * 0.37) % 1) * 1.2, Math.sin(a) * 0.5); });
            core.rotation.x = st.atk ? 0.5 * Math.sin(st.atk * PI) : 0;
            if (st.down) { core.position.y = 0.4; core.scale.setScalar(1 - st.down * 0.35); }
        });
    },

    archon(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const core = new THREE.Group(); core.position.y = 1.05; root.add(core);
        const armor = skin('plate', c1, c2), cloth = skin('cloth', c2, c1), gold = skin('metal', '#e8d8a0', '#a88838');
        // a floating armoured torso, a long tabard, shoulders, a helm with a glowing slit
        const chest = loft([{ y: -0.1, rx: 0.15, rz: 0.1, sq: 3 }, { y: 0.1, rx: 0.22, rz: 0.14, sq: 3 }, { y: 0.3, rx: 0.25, rz: 0.15, sq: 3 }, { y: 0.45, rx: 0.12, rz: 0.1 }], { seg: 18 });
        const tabard = loft([{ y: -1.05, rx: 0.2, rz: 0.12, wob: (a) => 0.2 * Math.sin(a * 4) }, { y: -0.6, rx: 0.2, rz: 0.12, wob: (a) => 0.08 * Math.sin(a * 4) }, { y: -0.12, rx: 0.14, rz: 0.1 }], { seg: 14 });
        carve(tabard, (px, py, pz) => true);
        const helm = loft([{ y: 0.4, rx: 0.12, rz: 0.12 }, { y: 0.5, rx: 0.18, rz: 0.19, sq: 2.6 }, { y: 0.68, rx: 0.18, rz: 0.19, sq: 2.6 }, { y: 0.85, rx: 0.11, rz: 0.12 }, { y: 0.92, rx: 0.01, rz: 0.01 }], { seg: 18 });
        const body = [shade(chest, { top: '#ffffff' }), shade(helm)];
        for (const sd of [-1, 1]) body.push(shade(xform(ball(0.14, 0.09, 0.13, { seg: 12, rings: 8 }, (px, py, pz, o) => { o[0] = px; o[1] = Math.max(py, -0.03); o[2] = pz; }), { p: [sd * 0.3, 0.38, 0], r: [0, 0, sd * -0.3] })));
        if (has(x, 'plates')) body.push(xform(shade(slab(0.56, 0.1, 0.36, { sq: 3.4 })), { p: [0, 0.22, 0] }));
        core.add(P(bake(body), armor, 0.014), P(shade(tabard, { ao: 0.25 }), cloth, 0.01));
        core.add(glow(new THREE.BoxGeometry(0.22, 0.034, 0.02), gl, { p: [0, 0.62, 0.188] }));
        core.add(glow(new THREE.BoxGeometry(0.024, 0.22, 0.02), hexShade(gl, 0.8), { p: [0, 0.58, 0.188] }));
        if (has(x, 'crown')) core.add(P(bake(Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * PI * 2; return tint(tube([[Math.cos(a) * 0.14, 0.88, Math.sin(a) * 0.14], [Math.cos(a) * 0.17, 1.0, Math.sin(a) * 0.17], [Math.cos(a) * 0.16, 1.1, Math.sin(a) * 0.16]], [0.025, 0.02, 0.003], { seg: 5, n: 5 }), '#ffffff', { ao: 0.1 }); })), gold, 0.008));
        const arms = [-1, 1].map((sd) => {
            const p = new THREE.Group(); p.position.set(sd * 0.32, 0.36, 0);
            p.add(P(bake([shade(tube([[0, 0, 0], [sd * 0.04, -0.2, 0.02], [sd * 0.02, -0.42, 0.1]], [0.07, 0.055, 0.05], { seg: 8, n: 8 })), shade(xform(ball(0.07, 0.07, 0.08, { seg: 10, rings: 8 }), { p: [sd * 0.02, -0.46, 0.12] }))]), armor, 0.012));
            core.add(p); return p;
        });
        if (has(x, 'spear')) { const sp = new THREE.Group(); sp.position.set(0.34, -0.1, 0.12); sp.add(P(bake([tint(tube([[0, -0.9, 0], [0, 0.2, 0], [0, 1.1, 0]], 0.022, { seg: 6, n: 6 }), '#ffffff', { ao: 0.1 }), tint(tube([[0, 1.1, 0], [0, 1.3, 0], [0, 1.52, 0]], [0.01, 0.065, 0.004], { seg: 6, n: 8, flat: 0.25 }), '#ffffff', { ao: 0.1 })]), gold, 0.01)); sp.add(glow(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 5), gl, { p: [0, 1.34, 0] })); core.add(sp); }
        if (has(x, 'scroll')) { const sc = new THREE.Group(); sc.position.set(-0.36, -0.04, 0.2); sc.add(P(bake([shade(rod(0.065, 0.065, 0.46, { seg: 10 }))]), toonMat({ vertexColors: true }), 0.008)); sc.children[0].rotation.z = PI / 2; core.add(sc); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 5, 12), new THREE.MeshBasicMaterial({ color: gl })); ring.rotation.y = PI / 2; sc.add(ring); }
        const wings = [];
        if (has(x, 'wings')) for (const sd of [-1, 1]) { const p = new THREE.Group(); p.position.set(sd * 0.12, 0.28, -0.14); p.add(featherWing(c1, c2, 1.15, [5, 4, 3], sd)); core.add(p); wings.push({ p, sd }); }
        if (has(x, 'halo')) core.add(halo(gl, 0.34, 1.16));
        const rings = [];
        if (has(x, 'rings')) for (let i = 0; i < 2; i++) { const r = halo(i ? c2 : gl, 0.62 + i * 0.22, 0.2, 0, 0.04); core.add(r); rings.push(r); }
        if (has(x, 'scales')) { const sc = []; for (let i = 0; i < 4; i++) { const t = i / 3; sc.push(xform(shade(slab(0.2, 0.012, 0.16, { sq: 3 })), { p: [0.58, 0.1 + i * 0.01, 0.1], r: [0, 0, 0] })); } }
        return wrap(root, 2.1, 0.75, (st, t) => {
            core.position.y = 1.05 + Math.sin(t * 1.8) * 0.1;
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * (0.12 + Math.sin(t * 2.2) * 0.12); p.rotation.y = sd * 0.25; });
            rings.forEach((r, i) => { r.rotation.x = PI / 2 + Math.sin(t * (0.8 + i * 0.4)) * 0.5; r.rotation.y = t * (0.6 + i * 0.3) * (i ? -1 : 1); });
            arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.5 + i) * 0.08; });
            core.rotation.x = st.atk ? 0.4 * Math.sin(st.atk * PI) : 0;
            if (st.atk) arms[1].rotation.x = -1.6 * Math.sin(st.atk * PI);
            if (st.cast) { core.position.y += 0.2 * Math.sin(st.cast * PI); arms.forEach((a) => { a.rotation.x = -2.0 * Math.sin(st.cast * PI); }); }
            if (st.down) { core.position.y = 0.4; core.rotation.z = st.down * 1.1; }
        });
    },

    husk(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const robeM = skin('cloth', c1, c2), steel = skin('metal', '#8a929e', '#3a4048');
        const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
        const rag = wobble(1.9, 0.06);
        const robe = loft([
            { y: -0.92, rx: 0.3, rz: 0.26, wob: (a) => 0.2 * Math.sin(a * 6) + rag(a) }, { y: -0.5, rx: 0.26, rz: 0.22, wob: rag }, { y: -0.1, rx: 0.19, rz: 0.15 }, { y: 0.15, rx: 0.2, rz: 0.15 },
            { y: 0.45, rx: 0.25, rz: 0.17 }, { y: 0.72, rx: 0.26, rz: 0.17 }, { y: 0.85, rx: 0.14, rz: 0.12 },
        ], { seg: 20 });
        const torso = [shade(robe, { top: '#ffffff', ao: 0.4 })];
        if (has(x, 'plates')) torso.push(xform(shade(slab(0.62, 0.12, 0.42, { sq: 3.3 })), { p: [0, 0.76, 0] }));
        if (has(x, 'pack')) torso.push(xform(shade(slab(0.4, 0.46, 0.22, { sq: 3.4 })), { p: [0, 0.4, -0.3] }));
        for (const sd of [-1, 1]) torso.push(shade(xform(ball(0.12, 0.09, 0.12, { seg: 10, rings: 8 }), { p: [sd * 0.29, 0.72, 0] })));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; torso.push(tint(tube([[Math.cos(a) * 0.3, -0.7, Math.sin(a) * 0.26], [Math.cos(a) * 0.36, -0.95, Math.sin(a) * 0.32], [Math.cos(a) * 0.3 + 0.05, -1.12, Math.sin(a) * 0.26]], [0.05, 0.035, 0.002], { seg: 4, n: 6, flat: 0.2 }), '#ffffff', { ao: 0.2 })); }
        hips.add(P(bake(torso), has(x, 'plates') ? skin('plate', c1, c2) : robeM, 0.016));
        const head = new THREE.Group(); head.position.y = 0.9; hips.add(head);
        const hood = loft([{ y: 0.0, rx: 0.2, rz: 0.2 }, { y: 0.16, rx: 0.21, rz: 0.21 }, { y: 0.34, rx: 0.16, rz: 0.18 }, { y: 0.52, rx: 0.05, rz: 0.08 }, { y: 0.6, rx: 0.004, rz: 0.004 }], { seg: 16 });
        const visor = has(x, 'visor');
        if (visor) {
            const helm = loft([{ y: 0.0, rx: 0.15, rz: 0.15, sq: 2.6 }, { y: 0.1, rx: 0.17, rz: 0.17, sq: 2.6 }, { y: 0.26, rx: 0.15, rz: 0.16, sq: 2.6 }, { y: 0.34, rx: 0.07, rz: 0.08 }, { y: 0.36, rx: 0.004, rz: 0.004 }], { seg: 16 });
            head.add(P(shade(helm), skin('plate', c1, c2), 0.014));
            head.add(glow(new THREE.BoxGeometry(0.26, 0.04, 0.02), gl, { p: [0, 0.16, 0.16] }));
        } else {
            carve(hood, (px, py, pz) => !(pz > 0.05 && py < 0.42 && Math.abs(px) < 0.14));
            head.add(P(shade(hood), robeM, 0.014));
            head.add(P(shade(xform(ball(0.15, 0.17, 0.13, { seg: 12, rings: 9 }), { p: [0, 0.2, 0.03] }), { base: '#0a0a10' }), flatM(), 0.004));
            for (const sd of [-1, 1]) { const e = eye(0.046, gl, { slit: 0.45, tall: 1.05 }); e.position.set(sd * 0.075, 0.25, 0.17); head.add(e); }
        }
        if (has(x, 'halo')) head.add(halo(gl, 0.3, 0.62, 0.1));
        const arm = (sd) => {
            const p = new THREE.Group(); p.position.set(sd * 0.3, 0.72, 0);
            const a = tube([[0, 0, 0], [sd * 0.03, -0.3, 0.02], [sd * 0.02, -0.62, 0.06], [sd * 0.01, -0.84, 0.08]], [0.07, 0.05, 0.04, 0.035], { seg: 8, n: 12 });
            const claws = [-1, 0, 1].map((k) => tint(tube([[sd * 0.01, -0.84, 0.08 + k * 0.02], [sd * 0.02 + k * 0.03, -0.95, 0.1 + k * 0.03], [sd * 0.03 + k * 0.05, -1.06, 0.1 + k * 0.04]], [0.016, 0.012, 0.002], { seg: 4, n: 5 }), '#b0a8c0', { ao: 0.2 }));
            p.add(P(bake([shade(a), ...claws]), robeM, 0.011)); hips.add(p); return p;
        };
        const armL = arm(-1), armR = arm(1);
        if (has(x, 'shears')) { const sh = new THREE.Group(); sh.position.set(0.02, -0.9, 0.12); sh.add(P(bake([tint(tube([[0, -0.7, 0], [0, 0.3, 0], [0, 0.7, 0]], 0.02, { seg: 6, n: 6 }), '#c8ccd8', { ao: 0.2 }), ...[-1, 1].map((sd) => tint(tube([[sd * 0.02, 0.7, 0], [sd * 0.1, 1.0, 0], [sd * 0.05, 1.35, 0]], [0.02, 0.05, 0.004], { seg: 6, n: 10, flat: 0.12 }), '#eef2f8', { ao: 0.1 }))]), steel, 0.01)); armR.add(sh); }
        if (has(x, 'wires')) for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; hips.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.16 + 0.04), new THREE.Vector3(Math.cos(a) * 0.32, -0.3, Math.sin(a) * 0.26 + 0.04), new THREE.Vector3(Math.cos(a) * 0.36 + 0.06, -0.88, Math.sin(a) * 0.3)]), 12, 0.012, 4), gl)); }
        if (has(x, 'veil')) hips.add(P(shade(loft([{ y: -0.95, rx: 0.42, rz: 0.36, wob: (a) => 0.15 * Math.sin(a * 5) }, { y: 0.1, rx: 0.14, rz: 0.12 }], { seg: 18 })), toonMat({ vertexColors: true, map: skin('ghost', c2, c1).map, color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0.002));
        return wrap(root, 1.9, 0.55, (st, t) => {
            const w = st.move || 0;
            hips.position.y = 0.92 + Math.sin(t * 1.5) * 0.04;
            armL.rotation.x = Math.sin(t * 1.5) * 0.12 + (w ? Math.sin(t * 7) * 0.5 : 0); armR.rotation.x = -armL.rotation.x;
            head.rotation.z = Math.sin(t * 0.9) * 0.08;
            if (st.atk) { armR.rotation.x = -2.4 + st.atk * 3.2; hips.rotation.x = 0.25 * Math.sin(st.atk * PI); }
            if (st.cast) { armL.rotation.x = armR.rotation.x = -2.2; hips.position.y += 0.15 * Math.sin(st.cast * PI); }
            if (st.down) { root.rotation.x = -st.down * 1.35; root.position.y = st.down * 0.4; }
        });
    },
};
function sock(g, c) { return tint(g, c, { ao: 0.3 }); }
