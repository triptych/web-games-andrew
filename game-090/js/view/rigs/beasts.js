// The beasts and wyrms: four-legged animals with fur, snakes and dragons with scales.

import { THREE, loft, tube, ball, deform, tint, bake, xform, carve, smooth, lerp, glow, hexShade, PI, has, wrap, skin, P, shadeGeo, wobble, eye, beadEye, halo, batWing, motes, flame } from './kit.js';
import { toonMat } from '../toon.js';

const flatM = () => toonMat({ vertexColors: true });
/** A loft built along +z (rings given as {z, rx, ry}): bodies, snouts. */
function loftZ(rings, o = {}) {
    const g = loft(rings.map((r) => ({ y: r.z, rx: r.rx, rz: r.ry, x: r.x, z: r.y, sq: r.sq })), o);
    g.rotateX(PI / 2);
    // rotateX(+90deg) sends original y → +z and z → -y; flip so ry is up
    return g;
}

export const BEASTS = {
    quad(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const bulk = has(x, 'bulk') ? 1.22 : 1;
        const fur = skin('fur', c1, c2);
        const body = new THREE.Group(); body.position.y = 0.62; root.add(body);
        const lump = wobble(3.1, 0.03);
        const torso = loftZ([
            { z: -0.55, rx: 0.17 * bulk, ry: 0.19 * bulk }, { z: -0.38, rx: 0.24 * bulk, ry: 0.26 * bulk }, { z: -0.1, rx: 0.22 * bulk, ry: 0.23 * bulk, wob: lump },
            { z: 0.2, rx: 0.26 * bulk, ry: 0.29 * bulk }, { z: 0.44, rx: 0.23 * bulk, ry: 0.25 * bulk }, { z: 0.6, rx: 0.14 * bulk, ry: 0.15 * bulk },
        ], { seg: 18 });
        body.add(P(shadeGeo(torso, { ao: 0.45 }), fur, 0.018));
        // head: skull, a tapering muzzle, a nose, a jaw, ears
        const head = new THREE.Group(); head.position.set(0, 0.12 * bulk, 0.58); body.add(head);
        const skull = loftZ([{ z: -0.1, rx: 0.12 * bulk, ry: 0.12 * bulk }, { z: 0.02, rx: 0.17 * bulk, ry: 0.16 * bulk }, { z: 0.16, rx: 0.14 * bulk, ry: 0.13 * bulk }, { z: 0.32, rx: 0.075 * bulk, ry: 0.07 * bulk }, { z: 0.4, rx: 0.06 * bulk, ry: 0.055 * bulk }, { z: 0.42, rx: 0.01, ry: 0.01 }], { seg: 14 });
        const nose = xform(tint(ball(0.04, 0.03, 0.035, { seg: 8, rings: 6 }), '#1c1416', { ao: 0 }), { p: [0, 0.015, 0.41] });
        const jaw = loftZ([{ z: -0.02, rx: 0.1, ry: 0.04 }, { z: 0.14, rx: 0.075, ry: 0.035 }, { z: 0.3, rx: 0.045, ry: 0.025 }, { z: 0.34, rx: 0.01, ry: 0.01 }], { seg: 10 }); jaw.translate(0, -0.095 * bulk, 0);
        const earLen = has(x, 'longears') ? 0.5 : has(x, 'ears') ? 0.22 : 0.0;
        const ears = earLen ? [-1, 1].map((sd) => tint(tube([[sd * 0.1, 0.1, -0.02], [sd * 0.15, 0.1 + earLen * 0.55, -0.04], [sd * (0.15 + earLen * 0.1), 0.1 + earLen, -0.06]], [0.05, 0.045, 0.006], { seg: 6, n: 8, flat: 0.3 }), '#ffffff', { ao: 0.2 })) : [];
        head.add(P(bake([shadeGeo(skull, { ao: 0.4 }), shadeGeo(jaw, { ao: 0.4 }), ...ears]), fur, 0.014), P(bake([nose]), flatM(), 0.006));
        for (const sd of [-1, 1]) { const e = eye(0.032, gl, { slit: 0.4 }); e.position.set(sd * 0.152 * bulk, 0.06, 0.1); e.rotation.y = sd * 1.25; head.add(e); }
        if (has(x, 'tusks')) head.add(P(bake([-1, 1].map((sd) => tint(tube([[sd * 0.06, -0.06, 0.28], [sd * 0.1, -0.1, 0.4], [sd * 0.09, 0.02, 0.5]], [0.028, 0.02, 0.003], { seg: 6, n: 8 }), '#efe6c8', { ao: 0.1 }))), flatM(), 0.008));
        if (has(x, 'antlers')) {
            const bone = skin('bone', '#d8c8a0', '#a89870');
            const ant = [];
            for (const sd of [-1, 1]) {
                ant.push(tint(tube([[sd * 0.07, 0.1, -0.04], [sd * 0.14, 0.3, -0.08], [sd * 0.3, 0.52, -0.12], [sd * 0.36, 0.76, -0.1]], [0.035, 0.028, 0.02, 0.006], { seg: 6, n: 12 }), '#ffffff', { ao: 0.2 }));
                ant.push(tint(tube([[sd * 0.15, 0.32, -0.08], [sd * 0.3, 0.38, -0.02], [sd * 0.42, 0.5, 0.0]], [0.02, 0.014, 0.004], { seg: 5, n: 8 }), '#ffffff', { ao: 0.2 }));
                ant.push(tint(tube([[sd * 0.26, 0.5, -0.12], [sd * 0.14, 0.62, -0.18], [sd * 0.08, 0.78, -0.2]], [0.02, 0.014, 0.004], { seg: 5, n: 8 }), '#ffffff', { ao: 0.2 }));
            }
            head.add(P(bake(ant), bone, 0.01));
        }
        // legs: hip and knee pivots, a thigh, a lean lower leg and a paw
        const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
            const hip = new THREE.Group(); hip.position.set(sx * 0.17 * bulk, -0.1, sz * 0.36);
            const thigh = loft([{ y: 0.14, rx: 0.1 * bulk, rz: 0.12 * bulk }, { y: -0.02, rx: 0.09 * bulk, rz: 0.1 * bulk }, { y: -0.26, rx: 0.052 * bulk, rz: 0.055 * bulk }], { seg: 10 });
            const knee = new THREE.Group(); knee.position.y = -0.26; hip.add(knee);
            const shin = loft([{ y: 0, rx: 0.05 * bulk, rz: 0.054 * bulk }, { y: -0.12, rx: 0.04 * bulk, rz: 0.04 * bulk }, { y: -0.3, rx: 0.034 * bulk, rz: 0.036 * bulk }], { seg: 10 });
            const paw = xform(ball(0.058 * bulk, 0.04, 0.085 * bulk, { seg: 10, rings: 8 }), { p: [0, -0.31, 0.03] });
            hip.add(P(shadeGeo(thigh, { ao: 0.4 }), fur, 0.014));
            knee.add(P(bake([shadeGeo(shin, { ao: 0.4 }), tint(paw, '#ffffff', { ao: 0.5 })]), fur, 0.013));
            body.add(hip); return { p: hip, k: knee, ph: sx * sz > 0 ? 0 : PI };
        });
        // the tail and the species' dressings
        const tail = new THREE.Group(); tail.position.set(0, 0.08, -0.5); body.add(tail);
        const tailLen = has(x, 'tail') ? 0.7 : 0.25;
        tail.add(P(shadeGeo(tube([[0, 0, 0], [0, 0.1, -tailLen * 0.4], [0, 0.22, -tailLen * 0.8], [0, 0.18, -tailLen]], [0.06, 0.055, 0.045, 0.012], { seg: 8, n: 12 }), { ao: 0.3 }), fur, 0.014));
        let tailFlame = null;
        if (has(x, 'flames')) { tailFlame = flame(gl, 0.6, 0.2); tailFlame.position.set(0, 0.2, -tailLen - 0.05); tailFlame.rotation.x = -0.5; tail.add(tailFlame); }
        if (has(x, 'moss')) body.add(P(bake([[0.0, 0.3, 0.0, 0.17], [0.12, 0.28, -0.25, 0.14], [-0.12, 0.3, 0.22, 0.13], [0.05, 0.26, -0.45, 0.12]].map(([px, py, pz, r]) => xform(tint(ball(r, r * 0.6, r, { seg: 8, rings: 6 }), '#ffffff', { ao: 0.2 }), { p: [px * bulk, py * bulk, pz] }))), skin('leaf', '#3f8a35', '#8ae05a'), 0.01));
        if (has(x, 'thorns')) body.add(P(bake(Array.from({ length: 6 }, (_, i) => tint(tube([[0, 0.24 * bulk, -0.4 + i * 0.16], [0, 0.34 * bulk, -0.4 + i * 0.16 - 0.04], [0, 0.46 * bulk, -0.4 + i * 0.16 - 0.1]], [0.035, 0.02, 0.002], { seg: 5, n: 5 }), c2, { ao: 0.15 }))), flatM(), 0.008));
        if (has(x, 'scrap')) body.add(P(bake([xform(tint(loft([{ y: -0.02, rx: 0.12, rz: 0.1, sq: 4 }, { y: 0.02, rx: 0.12, rz: 0.1, sq: 4 }], { seg: 8 }), '#ffffff', { ao: 0.2 }), { p: [0.17, 0.25, 0.05], r: [0.2, 0, -0.5] }), xform(tint(loft([{ y: -0.02, rx: 0.09, rz: 0.08, sq: 4 }, { y: 0.02, rx: 0.09, rz: 0.08, sq: 4 }], { seg: 8 }), '#ffffff', { ao: 0.2 }), { p: [-0.16, 0.3, -0.2], r: [-0.3, 0, 0.5] })]), skin('metal', '#9aa0a8', '#c8a850'), 0.01));
        if (has(x, 'sparks')) for (let i = 0; i < 5; i++) { const s = glow(new THREE.BoxGeometry(0.02, 0.2, 0.02), gl); s.position.set((i - 2) * 0.1, 0.55 + (i % 2) * 0.12, -0.1 + (i % 3) * 0.1); s.rotation.set(0, 0, (i - 2) * 0.35); body.add(s); }
        return wrap(root, 1.0 * bulk + (has(x, 'antlers') ? 0.5 : 0), 0.75, (st, t) => {
            const w = st.move || 0;
            legs.forEach(({ p, k, ph }) => { p.rotation.x = Math.sin(t * 10 + ph) * 0.7 * w; k.rotation.x = Math.max(0, -Math.sin(t * 10 + ph + 0.5)) * 0.8 * w; });
            body.position.y = 0.62 + Math.abs(Math.sin(t * 10)) * 0.05 * w + Math.sin(t * 1.8) * 0.012;
            tail.rotation.y = Math.sin(t * 3) * 0.4; tail.rotation.x = Math.sin(t * 2) * 0.1;
            if (tailFlame) tailFlame.userData.flick(t);
            head.rotation.x = Math.sin(t * 1.3) * 0.04;
            body.rotation.x = st.atk ? -0.35 * Math.sin(st.atk * PI) : 0;
            if (st.down) { root.rotation.z = st.down * 1.45; root.position.y = st.down * 0.18; }
        });
    },

    serpent(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const root = new THREE.Group();
        const N = 13;
        const scales = skin('scale', c1, c2);
        const segs = [];
        for (let i = 0; i < N; i++) {
            const r = 0.26 * (1 - i / (N + 3)) * (i === 0 ? 1.0 : i === 1 ? 0.78 : i === 2 ? 0.86 : 1);
            const parts = [shadeGeo(ball(r, r * 0.94, r * 1.35, { seg: 14, rings: 10 }), { ao: 0.4 })];
            if (has(x, 'fins') && i % 2 === 0 && i > 0) parts.push(tint(tube([[0, r * 0.8, 0.12], [0, r * 1.5, 0.02], [0, r * 1.2, -0.14]], [0.02, 0.07, 0.004], { seg: 4, n: 6, flat: 0.15 }), c2, { ao: 0.1 }));
            const m = P(bake(parts), scales, 0.016);
            if (has(x, 'cables') && i % 3 === 0) m.add(glow(new THREE.TorusGeometry(r * 1.02, 0.026, 6, 20), gl));
            root.add(m); segs.push(m);
        }
        const head = new THREE.Group(); segs[0].add(head);
        const hr = 0.36;
        const skull = loftZ([{ z: -0.18, rx: hr * 0.8, ry: hr * 0.7 }, { z: 0.0, rx: hr, ry: hr * 0.78 }, { z: 0.18, rx: hr * 0.8, ry: hr * 0.6 }, { z: 0.38, rx: hr * 0.46, ry: hr * 0.4 }, { z: 0.5, rx: hr * 0.3, ry: hr * 0.3 }, { z: 0.54, rx: 0.01, ry: 0.01 }], { seg: 14 });
        const jaw = loftZ([{ z: -0.05, rx: hr * 0.72, ry: hr * 0.18 }, { z: 0.2, rx: hr * 0.5, ry: hr * 0.14 }, { z: 0.42, rx: hr * 0.22, ry: hr * 0.1 }, { z: 0.46, rx: 0.01, ry: 0.01 }], { seg: 10 }); jaw.translate(0, -hr * 0.58, 0.02);
        const hp = [shadeGeo(skull, { ao: 0.4 }), shadeGeo(jaw, { ao: 0.4 })];
        if (has(x, 'horns')) for (const sd of [-1, 1]) hp.push(tint(tube([[sd * 0.14, 0.2, -0.1], [sd * 0.26, 0.36, -0.22], [sd * 0.24, 0.5, -0.46]], [0.06, 0.042, 0.004], { seg: 6, n: 8 }), c2, { ao: 0.2 }));
        head.add(P(bake(hp), scales, 0.014));
        for (const sd of [-1, 1]) { const e = eye(0.04, gl, { slit: 0.35 }); e.position.set(sd * hr * 0.78, 0.07, 0.1); e.rotation.y = sd * 1.0; head.add(e); }
        const fangs = [-1, 1].map((sd) => tint(tube([[sd * 0.06, -0.12, 0.38], [sd * 0.065, -0.2, 0.4], [sd * 0.06, -0.26, 0.4]], [0.014, 0.01, 0.002], { seg: 4, n: 4 }), '#f4efe0', { ao: 0 }));
        head.add(P(bake(fangs), flatM(), 0.004));
        return wrap(root, 1.0 * d.s, 1.7, (st, t) => {
            const lift = st.down ? 0 : 1;
            segs.forEach((s, i) => { s.position.set(Math.sin(t * 2 + i * 0.55) * 0.18 * (i / N + 0.3), 0.28 + (i === 0 ? 0.55 : Math.max(0, 0.55 - i * 0.09)) * lift, -i * 0.3); s.rotation.y = Math.cos(t * 2 + i * 0.55) * 0.3 * (i / N + 0.3); });
            head.rotation.x = st.atk ? 0.6 * Math.sin(st.atk * PI) : Math.sin(t * 1.4) * 0.05;
            if (st.down) root.position.y = 0;
        });
    },

    wyrm(d) {
        const [c1, c2, gl] = d.c, x = d.x;
        const base = BEASTS.serpent({ ...d, x: x.filter((t) => t !== 'wings') });
        const root = base.root;
        const wings = [];
        if (has(x, 'wings')) for (const sd of [-1, 1]) {
            const p = new THREE.Group(); p.position.set(sd * 0.18, 0.95, -0.55);
            const w = batWing(c2, hexShade(c2, 0.55), 1.25, sd); p.add(w); root.add(p); wings.push({ p, sd });
        }
        let wFlame = null;
        if (has(x, 'flames')) { wFlame = flame(gl, 0.8, 0.26); wFlame.position.set(0, 0.45, -3.8); wFlame.rotation.x = -0.6; root.add(wFlame); }
        if (has(x, 'frost')) for (let i = 0; i < 6; i++) { const s = glow(new THREE.OctahedronGeometry(0.08, 0), '#dff4ff', { p: [(i % 2 ? 1 : -1) * 0.3, 0.7 + (i % 3) * 0.15, -0.6 - i * 0.4] }); root.add(s); }
        if (has(x, 'crown')) root.add(halo(gl, 0.34, 1.2));
        return wrap(root, 1.5 * d.s, 2.1, (st, t) => {
            base.anim(st, t);
            if (wFlame) wFlame.userData.flick(t);
            wings.forEach(({ p, sd }) => { p.rotation.z = sd * (0.15 + Math.sin(t * 3.2) * 0.4); });
        });
    },
};
