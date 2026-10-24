// Pinch, his shells, the baddies and the bosses. Everything is built from primitives with an ink outline,
// so the cast reads as a cartoon. Each factory returns { root, update(...) }.

import { THREE, G, toon, inked, mesh, shade, glowSprite, clamp, damp, lerp, smooth, angleDamp } from './kit.js';

const TAU = Math.PI * 2;
const part = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o = {}) => {
    const m = o.ink === false ? mesh(geo, toon(color, o.mat), { cast: true }) : inked(geo, toon(color, o.mat), o.ink ?? 0.03);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
};

/** A pair-of-eyes helper: white, pupil, glint. */
export function eye(r = 0.12, look = [0, 0, -1], pupil = 0x2a1a2e) {
    const g = new THREE.Group();
    g.add(part(G.sphere(r, 12, 10), 0xffffff, 0, 0, 0, 1, 1, 1, { ink: false }));
    const p = mesh(G.sphere(r * 0.55, 10, 8), toon(pupil), { cast: false });
    p.position.set(look[0] * r * 0.55, look[1] * r * 0.55, look[2] * r * 0.62);
    g.add(p);
    const gl = mesh(G.sphere(r * 0.18, 6, 5), toon(0xffffff, {}), { cast: false });
    gl.position.set(p.position.x + r * 0.2, p.position.y + r * 0.22, p.position.z - r * 0.12);
    g.add(gl);
    g.userData.pupil = p;
    return g;
}

// ================================================================ the shells
export const SHELL_LOOKS = [
    { id: 'spiral', base: 0xf2a56b, stripe: 0xfff0d8 },
    { id: 'coconut', base: 0x6b4426, stripe: 0xe8d5b0 },
    { id: 'anchor', base: 0xc9d2da, stripe: 0xff8a4c },
    { id: 'sail', base: 0xf0c27a, stripe: 0xff6b6b },
    { id: 'spring', base: 0x7ad7ff, stripe: 0xc8f0ff },
];

export function makeShell(id) {
    const g = new THREE.Group();
    const inner = new THREE.Group();   // what animates
    g.add(inner);
    g.userData.inner = inner;
    if (id === 'spiral') {
        const stripe = 0xfff0d8, base = 0xf2a56b;
        for (let i = 0; i < 5; i++) {
            const r = 0.46 - i * 0.07, y = 0.1 + i * 0.16;
            inner.add(part(G.torus(r, 0.1 - i * 0.008, 8, 18), i % 2 ? stripe : base, 0, y, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: 0.025 }));
        }
        inner.add(part(G.sphere(0.2, 10, 8), base, 0, 0.18, 0, 1.55, 1, 1.55, { ink: 0.03 }));
        inner.add(part(G.cone(0.14, 0.3, 10), 0xffd9a0, 0, 0.9, 0, 1, 1, 1, { ink: 0.02 }));
        inner.position.y = 0.05;
    } else if (id === 'coconut') {
        const half = new THREE.SphereGeometry(0.5, 18, 12, 0, TAU, 0, Math.PI * 0.62);
        const shellM = part(half, 0x6b4426, 0, 0.3, 0, 1, 1, 1, { ink: 0.03, rot: [0, 0, 0] });
        shellM.material = toon(0x6b4426, { side: THREE.DoubleSide });
        inner.add(shellM);
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + 0.4;
            inner.add(part(G.sphere(0.055, 6, 5), 0x2a1810, Math.cos(a) * 0.2, 0.74, Math.sin(a) * 0.2, 1, 0.6, 1, { ink: false }));
        }
        for (let i = 0; i < 9; i++) {   // hairy fibres
            const a = (i / 9) * TAU;
            inner.add(part(G.cone(0.03, 0.14, 4), 0x8a5a36, Math.cos(a) * 0.46, 0.34, Math.sin(a) * 0.46, 1, 1, 1, { ink: false, rot: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2] }));
        }
        inner.add(part(G.torus(0.46, 0.04, 6, 20), 0xf0e0c0, 0, 0.12, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
        inner.position.y = 0.0;
    } else if (id === 'anchor') {
        inner.add(part(G.cyl(0.4, 0.4, 0.78, 20), 0xc9d2da, 0, 0.45, 0, 1, 1, 1, { ink: 0.03 }));
        inner.add(part(G.cyl(0.41, 0.41, 0.3, 20), 0xff9a52, 0, 0.45, 0, 1, 1, 1, { ink: false }));
        inner.add(part(G.torus(0.4, 0.04, 6, 20), 0xe8eef2, 0, 0.84, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
        inner.add(part(G.torus(0.4, 0.04, 6, 20), 0xe8eef2, 0, 0.06, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
        inner.add(part(G.torus(0.09, 0.025, 6, 12), 0xe8eef2, 0.1, 0.9, 0, 1, 1, 1, { rot: [0.4, 0, 0], ink: false }));
        // a peach on the label
        inner.add(part(G.sphere(0.1, 8, 6), 0xffc27a, 0, 0.47, -0.41, 1, 1, 0.4, { ink: false }));
        inner.add(part(G.cone(0.04, 0.08, 4), 0x6bcb5c, 0.03, 0.58, -0.41, 1, 1, 0.5, { ink: false }));
        inner.position.y = -0.02;
    } else if (id === 'sail') {
        for (let i = 0; i < 3; i++) inner.add(part(G.torus(0.4 - i * 0.07, 0.1 - i * 0.012, 8, 16), i % 2 ? 0xfff0d8 : 0xf0c27a, 0, 0.1 + i * 0.15, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: 0.025 }));
        inner.add(part(G.sphere(0.2, 10, 8), 0xf0c27a, 0, 0.14, 0, 1.4, 0.9, 1.4, { ink: 0.03 }));
        const mast = part(G.cyl(0.025, 0.025, 1.5, 6), 0xd8b080, 0, 0.9, 0, 1, 1, 1, { ink: false });
        inner.add(mast);
        // the beach-towel sail: a striped triangle that unfurls when gliding
        const sail = new THREE.Group();
        sail.position.set(0, 0.9, 0);
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 1.2); sh.lineTo(0.95, 0.1); sh.closePath();
        const sg = new THREE.ShapeGeometry(sh);
        const sm = mesh(sg, toon(0xff6b6b, { side: THREE.DoubleSide }), { cast: true });
        sail.add(sm);
        const sg2 = new THREE.ShapeGeometry((() => { const s2 = new THREE.Shape(); s2.moveTo(0, 0.55); s2.lineTo(0, 0.9); s2.lineTo(0.52, 0.42); s2.lineTo(0.62, 0.28); s2.closePath(); return s2; })());
        const sm2 = mesh(sg2, toon(0xfff4d6, { side: THREE.DoubleSide }), { cast: false });
        sm2.position.z = 0.005; sail.add(sm2);
        for (const y of [0.35, 0.8]) sail.add(part(G.box(0.07, 0.07, 0.07), 0x4d96ff, 0, y, 0, 1, 1, 1, { ink: false }));
        inner.add(sail);
        g.userData.sail = sail;
    } else if (id === 'spring') {
        const coil = new THREE.Group();
        for (let i = 0; i < 6; i++) coil.add(part(G.torus(0.36 - Math.abs(i - 2.5) * 0.015, 0.06, 8, 18), i % 2 ? 0xc8f0ff : 0x7ad7ff, 0, 0.1 + i * 0.12, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: 0.02 }));
        coil.add(part(G.cyl(0.4, 0.4, 0.06, 16), 0x5ab4e0, 0, 0.02, 0, 1, 1, 1, { ink: false }));
        coil.add(part(G.cyl(0.36, 0.36, 0.06, 16), 0x5ab4e0, 0, 0.82, 0, 1, 1, 1, { ink: false }));
        inner.add(coil);
        g.userData.coil = coil;
    }
    return g;
}

// ================================================================ Pinch
export function makePinch(o = {}) {
    const root = new THREE.Group();
    root.scale.setScalar(o.scale ?? 1);
    const spin = new THREE.Group(); root.add(spin);        // the attack spin turns this
    const body = new THREE.Group(); spin.add(body);        // squash and stretch
    const SHELLED = o.body ?? 0xff6b45, BELLY = o.belly ?? 0xffb48a, DARK = o.dark ?? 0xd44a2c;

    const torso = part(G.sphere(0.5, 20, 14), SHELLED, 0, 0.42, 0, 1.0, 0.62, 0.84, { ink: 0.035 });
    body.add(torso);
    body.add(part(G.sphere(0.4, 14, 10), BELLY, 0, 0.36, -0.12, 0.9, 0.5, 0.7, { ink: false }));
    for (let i = 0; i < 3; i++) body.add(part(G.sphere(0.05, 6, 5), DARK, (i - 1) * 0.2, 0.69 - Math.abs(i - 1) * 0.02, 0.1, 1, 0.6, 1, { ink: false }));

    // eye stalks
    const stalks = [];
    for (const s of [-1, 1]) {
        const st = new THREE.Group();
        st.position.set(s * 0.16, 0.62, -0.24);
        st.add(part(G.cyl(0.045, 0.055, 0.3, 8), BELLY, 0, 0.15, 0, 1, 1, 1, { ink: 0.02 }));
        const e = eye(0.13, [0, 0, -1]);
        e.position.set(0, 0.34, -0.02);
        st.add(e);
        st.rotation.z = -s * 0.2;
        body.add(st);
        stalks.push({ st, e });
    }
    // goggles pushed up on the forehead: the inventor's badge
    const gog = new THREE.Group(); gog.position.set(0, 0.75, -0.42); gog.rotation.x = -0.35;
    for (const s of [-1, 1]) {
        gog.add(part(G.torus(0.085, 0.024, 6, 14), 0xc98a2a, s * 0.1, 0, 0, 1, 1, 1, { ink: false }));
        const lens = mesh(G.cyl(0.075, 0.075, 0.01, 12), toon(0x9be8ff, { opacity: 0.8, emissive: 0x145060 }), { cast: false });
        lens.rotation.x = Math.PI / 2; lens.position.set(s * 0.1, 0, 0); gog.add(lens);
    }
    gog.add(part(G.box(0.1, 0.03, 0.03), 0x7a4a22, 0, 0, 0, 1, 1, 1, { ink: false }));
    if (o.goggles !== false) body.add(gog);

    // smile and cheeks
    const smile = mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 12, Math.PI), toon(0x7a2a1a), { cast: false });
    smile.position.set(0, 0.4, -0.445); smile.rotation.z = Math.PI;
    body.add(smile);
    for (const s of [-1, 1]) body.add(part(G.sphere(0.05, 6, 5), 0xff8aa8, s * 0.2, 0.42, -0.4, 1, 0.8, 0.5, { ink: false }));

    // claws
    const claws = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.46, 0.46, -0.22);
        arm.add(part(G.cyl(0.05, 0.06, 0.3, 8), SHELLED, s * 0.12, 0.0, -0.06, 1, 1, 1, { rot: [0, 0, -s * 1.2], ink: 0.02 }));
        const hand = new THREE.Group(); hand.position.set(s * 0.27, 0.04, -0.12);
        hand.add(part(G.sphere(0.15, 12, 9), SHELLED, 0, 0, 0, 1, 0.85, 1.15, { ink: 0.03 }));
        const up = part(G.cone(0.075, 0.26, 7), SHELLED, 0, 0.05, -0.2, 1, 1, 1, { rot: [-Math.PI / 2, 0, 0], ink: 0.02 });
        const dn = part(G.cone(0.065, 0.22, 7), DARK, 0, -0.04, -0.17, 1, 1, 1, { rot: [-Math.PI / 2, 0, 0], ink: 0.02 });
        hand.add(up); hand.add(dn);
        arm.add(hand);
        body.add(arm);
        claws.push({ arm, hand, up, dn, s });
    }

    // legs, three a side
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const leg = new THREE.Group();
        leg.position.set(s * 0.38, 0.3, -0.18 + i * 0.2);
        leg.add(part(G.cyl(0.03, 0.04, 0.3, 6), DARK, s * 0.13, -0.08, 0, 1, 1, 1, { rot: [0, 0, -s * 1.0], ink: 0.015 }));
        leg.add(part(G.cyl(0.025, 0.03, 0.22, 6), DARK, s * 0.27, -0.2, 0, 1, 1, 1, { rot: [0, 0, s * 0.35], ink: 0.015 }));
        body.add(leg);
        legs.push({ leg, s, i });
    }

    // the shells ride on the back
    const mount = new THREE.Group(); mount.position.set(0, 0.46, 0.34);
    body.add(mount);
    const shells = SHELL_LOOKS.map((s) => { const m = makeShell(s.id); m.visible = false; mount.add(m); return m; });
    shells[0].visible = true;

    // inventions he has made show on him
    const gear = new THREE.Group(); body.add(gear);
    function setGear(ids = []) {
        while (gear.children.length) gear.remove(gear.children[0]);
        for (const s of stalks) { const old = s.st.getObjectByName('specs'); if (old) s.st.remove(old); }
        for (const c of claws) { for (const n of ['spoon', 'watch', 'spark']) { const o = c.arm.getObjectByName(n) || c.hand.getObjectByName(n); if (o) o.parent.remove(o); } }
        for (const l of legs) { const o = l.leg.getObjectByName('band'); if (o) l.leg.remove(...l.leg.children.filter((k) => k.name === 'band')); }
        const has = (id) => ids.includes(id);
        if (has('boater')) {
            const h = new THREE.Group(); h.position.set(0, 0.9, -0.2); h.rotation.x = -0.25;
            h.add(part(G.cyl(0.3, 0.3, 0.035, 18), 0xf0d48a, 0, 0, 0, 1, 1, 1, { ink: 0.02 }));
            h.add(part(G.cyl(0.18, 0.2, 0.2, 14), 0xf6e0a0, 0, 0.11, 0, 1, 1, 1, { ink: 0.02 }));
            h.add(part(G.cyl(0.205, 0.205, 0.05, 14), 0xe94b4b, 0, 0.05, 0, 1, 1, 1, { ink: false }));
            h.add(part(G.cyl(0.07, 0.07, 0.03, 10), 0xc0c8d0, 0.1, 0.17, -0.12, 1, 1, 1, { ink: false, rot: [Math.PI / 2 - 0.3, 0, 0] }));   // a bottle cap on the band
            gear.add(h);
        }
        if (has('magnet')) {
            const g = new THREE.Group(); g.position.set(-0.4, 0.62, 0.18); g.rotation.set(0, 0.5, 0.5);
            g.add(part(new THREE.TorusGeometry(0.13, 0.05, 6, 14, Math.PI), 0xe94b4b, 0, 0.1, 0, 1, 1, 1, { ink: 0.02 }));
            for (const s of [-1, 1]) { g.add(part(G.cyl(0.05, 0.05, 0.14, 6), 0xe94b4b, s * 0.13, 0.03, 0, 1, 1, 1, { ink: false })); g.add(part(G.cyl(0.052, 0.052, 0.05, 6), 0xdde6ee, s * 0.13, -0.06, 0, 1, 1, 1, { ink: false })); }
            gear.add(g);
        }
        if (has('boots')) for (const l of legs) for (const dy of [-0.16, -0.24]) { const b = part(G.torus(0.04, 0.02, 5, 10), 0x4d96ff, l.s * 0.27 + l.s * (-dy - 0.16) * 0.8, dy - 0.02, 0, 1, 1, 1, { ink: false, rot: [Math.PI / 2, 0, l.s * 0.35] }); b.name = 'band'; l.leg.add(b); }
        if (has('buoy')) {
            const r = new THREE.Group(); r.position.set(0, 0.38, -0.02); r.rotation.x = 0.1;
            r.add(part(G.torus(0.56, 0.1, 8, 24), 0xffffff, 0, 0, 0, 1, 0.8, 1, { rot: [Math.PI / 2, 0, 0], ink: 0.025 }));
            for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; r.add(part(G.box(0.2, 0.14, 0.2), 0xe94b4b, Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56, 1, 1, 1, { ink: false, rot: [0, -a, 0] })); }
            gear.add(r);
        }
        if (has('spinner')) {
            const c = claws[1], sp = new THREE.Group(); sp.name = 'spoon'; sp.position.set(0.05, 0.12, -0.05); sp.rotation.set(0.3, 0, -0.5);
            sp.add(part(G.cyl(0.018, 0.024, 0.44, 5), 0xdde6ee, 0, 0.22, 0, 1, 1, 1, { ink: false }));
            sp.add(part(G.sphere(0.1, 8, 6), 0xdde6ee, 0, 0.5, 0, 1, 1.3, 0.35, { ink: 0.02 }));
            c.hand.add(sp);
        }
        if (has('specs')) for (const s of stalks) {
            const sg = new THREE.Group(); sg.name = 'specs'; sg.position.set(0, 0.34, -0.1);
            sg.add(part(G.torus(0.16, 0.026, 6, 16), 0xc98a2a, 0, 0, 0, 1, 1, 1, { ink: false }));
            const lens = mesh(G.cyl(0.15, 0.15, 0.01, 14), toon(0x9be8ff, { opacity: 0.55, emissive: 0x145060 }), { cast: false });
            lens.rotation.x = Math.PI / 2; lens.position.z = -0.01; sg.add(lens);
            s.st.add(sg);
        }
        if (has('watch')) {
            const c = claws[0], w = new THREE.Group(); w.name = 'watch'; w.position.set(-0.2, 0.01, -0.07);
            w.add(part(G.torus(0.065, 0.02, 5, 12), 0xc99a4a, 0, 0, 0, 1, 1, 1, { rot: [0, Math.PI / 2, 0.5], ink: false }));
            w.add(part(G.cyl(0.04, 0.04, 0.02, 10), 0xfff6e0, 0, 0.055, 0, 1, 1, 1, { ink: false }));
            c.arm.add(w);
        }
        if (has('parasol')) {
            const u = new THREE.Group(); u.position.set(0.3, 1.0, 0.45);
            u.add(part(G.cyl(0.014, 0.014, 0.4, 4), 0xf6f0e0, 0, 0.15, 0, 1, 1, 1, { ink: false }));
            for (let i = 0; i < 6; i++) u.add(part(G.cone(0.26, 0.14, 4), i % 2 ? 0xff6b6b : 0xfff4d6, 0, 0.4, 0, 0.5, 1, 0.5, { ink: false, rot: [0, (i / 6) * TAU, 0] }));
            u.add(part(G.cone(0.3, 0.16, 8), 0xff6b6b, 0, 0.38, 0, 1, 1, 1, { ink: false }));
            gear.add(u);
        }
        if (has('boing')) for (const s of [-1, 1]) {
            const c = new THREE.Group(); c.position.set(s * 0.22, 0.02, 0.08);
            for (let i = 0; i < 4; i++) c.add(part(G.torus(0.07, 0.022, 5, 10), i % 2 ? 0xdde6ee : 0xb4c2d0, 0, i * 0.06, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false }));
            gear.add(c);
        }
        if (has('sparkler')) {
            const c = claws[0], sp = new THREE.Group(); sp.name = 'spark'; sp.position.set(-0.05, 0.1, -0.05); sp.rotation.set(0.2, 0, 0.3);
            sp.add(part(G.cyl(0.012, 0.012, 0.5, 4), 0x9a8460, 0, 0.25, 0, 1, 1, 1, { ink: false }));
            const gl = glowSprite(0xffe36b, 0.5, 0.9); gl.position.y = 0.52; sp.add(gl);
            sp.userData.glow = gl;
            c.hand.add(sp);
            gear.userData.spark = sp;
        } else gear.userData.spark = null;
    }
    setGear([]);

    const st = {
        phase: 0, squash: 0, stretch: 0, blink: 0, blinkT: 2, spinA: 0, curl: 0, shell: 0, glideK: 0, braceK: 0, swapPop: 0,
        roll: 0, hurtFlash: 0, lastGrounded: true, lastVy: 0, chargeK: 0, deadK: 0,
    };

    function update(p, dt, t, G0) {
        // placement
        root.position.set(p.x, p.y, p.z);
        root.rotation.y = p.yaw;
        // shell swap
        if (p.shell !== st.shell) {
            shells[st.shell].visible = false; shells[p.shell].visible = true;
            st.shell = p.shell; st.swapPop = 1;
        }
        st.swapPop = Math.max(0, st.swapPop - dt * 4);
        const sp = Math.hypot(p.vx, p.vz);
        const moving = clamp(sp / 7, 0, 1.4);
        const air = !p.grounded;
        // squash and stretch from landing and take-off
        if (p.grounded && !st.lastGrounded) st.squash = clamp(-st.lastVy / 18, 0.25, 0.8);
        if (!p.grounded && st.lastGrounded && p.vy > 4) st.stretch = 0.6;
        st.lastGrounded = p.grounded; st.lastVy = p.vy;
        // idle for a while: wave hello
        st.idleT = (p.grounded && sp < 0.3 && !p.brace && !p.charge && !p.spinT) ? (st.idleT || 0) + dt : 0;
        const waving = st.idleT > 5 && Math.sin(t * 0.8) > -0.2;
        st.squash = Math.max(0, st.squash - dt * 4.5); st.stretch = Math.max(0, st.stretch - dt * 3.2);
        const breathe = Math.sin(t * 2.6) * 0.015;
        let sy = 1 - st.squash * 0.38 + st.stretch * 0.22 + breathe + st.swapPop * 0.18;
        let sxz = 1 + st.squash * 0.25 - st.stretch * 0.12 - breathe * 0.5 - st.swapPop * 0.08;
        // charge crouch
        st.chargeK = damp(st.chargeK, p.charge > 0 ? p.charge / 0.75 : 0, 18, dt);
        sy *= 1 - st.chargeK * 0.34; sxz *= 1 + st.chargeK * 0.18;
        body.scale.set(sxz, sy, sxz);
        body.position.y = Math.sin(st.phase * 2) * 0.03 * moving * (air ? 0 : 1);
        // walk cycle
        st.phase += dt * (3 + sp * 1.7) * (air ? 0.3 : 1);
        for (const l of legs) {
            const ph = st.phase + l.i * 1.7 + (l.s > 0 ? Math.PI : 0);
            const swing = Math.sin(ph) * 0.7 * moving;
            l.leg.rotation.x = air ? -0.5 : swing * 0.8;
            l.leg.rotation.z = air ? l.s * 0.5 : Math.max(0, Math.cos(ph)) * 0.35 * l.s * moving;
        }
        // claws: wave when idle, swing when running, up when airborne
        for (const c of claws) {
            const open = p.spinT > 0 || p.slam ? 0.7 : 0.15 + Math.max(0, Math.sin(t * 5 + c.s)) * 0.12;
            c.up.rotation.x = -Math.PI / 2 - open; c.dn.rotation.x = -Math.PI / 2 + open * 0.7;
            let raise = air ? 0.7 : 0.1 + Math.sin(st.phase + (c.s > 0 ? 0 : Math.PI)) * 0.25 * moving;
            if (p.brace) raise = 0.55;
            if (p.glide) raise = 1.1;
            if (waving && c.s > 0) raise = 1.3 + Math.sin(t * 9) * 0.3;
            c.arm.rotation.z = c.s * raise * 0.8; c.arm.rotation.x = -(p.brace ? 0.5 : 0.1);
            c.hand.rotation.y = c.s * (p.brace ? -0.5 : 0);
        }
        // eyes: blink, look at the way you run
        st.blinkT -= dt;
        if (st.blinkT <= 0) { st.blink = 0.12; st.blinkT = 2 + (Math.sin(t * 7.3) + 1.2) * 1.6; }
        st.blink = Math.max(0, st.blink - dt);
        for (const s of stalks) {
            s.e.scale.y = st.blink > 0 ? 0.12 : 1;
            s.st.rotation.x = Math.sin(t * 3 + s.st.position.x * 9) * 0.06 - (air ? 0.2 : 0) + (p.hurtT > 0.6 ? 0.4 : 0);
        }
        // spinning
        if (p.spinT > 0) { st.spinA += dt * 26; } else st.spinA = Math.round(st.spinA / TAU) * TAU;
        spin.rotation.y = p.spinT > 0 ? st.spinA : 0;
        // rolling: curl into the shell
        const rolling = p.rollT > 0;
        st.curl = damp(st.curl, rolling ? 1 : 0, 22, dt);
        if (rolling) st.roll += dt * 16;
        spin.rotation.x = rolling ? -st.roll : damp(spin.rotation.x, 0, 12, dt);
        if (!rolling) st.roll = 0;
        spin.position.y = st.curl * 0.42;
        mount.position.set(0, lerp(0.46, 0.52, st.curl), lerp(0.34, 0.0, st.curl));
        const curlS = lerp(1, 0.55, st.curl);
        torso.scale.set(curlS, 0.62 * curlS, 0.84 * curlS);
        for (const c of claws) c.arm.visible = st.curl < 0.5;
        for (const l of legs) l.leg.visible = st.curl < 0.5;
        // the shells' own tricks
        const cur = shells[p.shell], id = SHELL_LOOKS[p.shell].id;
        st.braceK = damp(st.braceK, p.brace ? 1 : 0, 20, dt);
        st.glideK = damp(st.glideK, p.glide ? 1 : 0, 10, dt);
        mount.rotation.set(0, 0, 0);
        if (id === 'coconut') {
            // raised in front like a shield
            mount.position.z = lerp(mount.position.z, -0.62, st.braceK);
            mount.position.y = lerp(mount.position.y, 0.55, st.braceK);
            mount.rotation.x = -st.braceK * 1.35;
            cur.scale.setScalar(1 + st.braceK * 0.5);
        } else cur.scale.setScalar(1);
        if (id === 'sail') {
            const sail = cur.userData.sail;
            sail.rotation.set(-st.glideK * 1.45, 0, 0);
            sail.scale.setScalar(1 + st.glideK * 1.25);
            sail.position.y = 0.9 + st.glideK * 0.3;
            sail.position.z = -st.glideK * 0.35;
            if (!p.glide) sail.rotation.z = Math.sin(t * 3) * 0.04;
        }
        if (id === 'spring') {
            const coil = cur.userData.coil;
            coil.scale.y = 1 - st.chargeK * 0.5 + (p.vy > 4 ? 0.12 : 0);
        }
        if (id === 'anchor' && p.slam === 2) { body.scale.y *= 1.2; }
        // hurt and defeat
        root.visible = !(p.hurtT > 0 && p.dead <= 0 && Math.floor(t * 16) % 2 === 0);
        if (p.dead > 0) { st.deadK = Math.min(1, st.deadK + dt * 1.4); root.visible = true; spin.rotation.y += dt * 14; body.scale.multiplyScalar(1 - st.deadK * 0.45); body.position.y += st.deadK * 0.6; }
        else st.deadK = 0;
        if (p.launch && p.launch.t < p.launch.pre) root.visible = false;
        else if (p.launch) { spin.rotation.x = -t * 12; }
        mount.visible = true;
        const sk = gear.userData.spark;
        if (sk) sk.userData.glow.material.opacity = 0.6 + Math.sin(t * 40) * 0.3;
    }

    function setShell(i) { shells.forEach((s, k) => { s.visible = k === i; }); st.shell = i; }

    return { root, update, setShell, setGear, state: st, body };
}

// ================================================================ baddies
export function makeFlea() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    body.add(part(G.sphere(0.4, 14, 10), 0x9bdc5a, 0, 0.42, 0, 1, 0.9, 1, { ink: 0.035 }));
    body.add(part(G.sphere(0.28, 10, 8), 0xd8f5a0, 0, 0.32, -0.12, 1, 0.8, 0.9, { ink: false }));
    for (const s of [-1, 1]) {
        const e = eye(0.12, [s * 0.15, 0.1, -1]); e.position.set(s * 0.17, 0.66, -0.2); body.add(e);
        body.add(part(G.cyl(0.02, 0.03, 0.3, 5), 0x4a7a2a, s * 0.12, 0.28, -0.34, 1, 1, 1, { rot: [0.3, 0, -s * 0.7], ink: false }));
    }
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
        const l = part(G.cyl(0.03, 0.04, 0.34, 5), 0x4a7a2a, s * 0.3, 0.14, -0.1 + i * 0.28, 1, 1, 1, { rot: [0, 0, -s * 0.9], ink: false });
        body.add(l); legs.push(l);
    }
    return {
        root, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            root.rotation.y = e.face;
            const h = e.hop || 0;
            body.position.y = h;
            const k = h / 0.55;
            body.scale.set(1 + (1 - k) * 0.12, 1 - (1 - k) * 0.18, 1 + (1 - k) * 0.12);
            legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 10 + i) * 0.4 * (h > 0.05 ? 1 : 0.3); });
        },
    };
}

export function makeStarfish() {
    const root = new THREE.Group();
    const spin = new THREE.Group(); root.add(spin);
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.34 : 0.78;
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.08, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const star = inked(geo, toon(0xff8a3c), 0.03);
    star.position.y = 0.08;
    spin.add(star);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        for (const r of [0.28, 0.5]) spin.add(part(G.cone(0.05, 0.14, 5), 0xd2432c, Math.cos(a) * r, 0.44, Math.sin(a) * r, 1, 1, 1, { ink: false }));
    }
    const face = new THREE.Group(); face.position.set(0, 0.42, 0); root.add(face);
    for (const s of [-1, 1]) { const e = eye(0.1, [0, 0, -1]); e.position.set(s * 0.14, 0.05, -0.1); face.add(e); face.add(part(G.box(0.17, 0.035, 0.04), 0x4a1a14, s * 0.14, 0.2, -0.12, 1, 1, 1, { ink: false, rot: [0, 0, s * -0.5] })); }
    return { root, update(e, dt, t) { root.position.set(e.x, e.y, e.z); spin.rotation.y = e.spin || 0; face.rotation.y = e.face; } };
}

export function makeJelly() {
    const root = new THREE.Group();
    const bell = mesh(new THREE.SphereGeometry(0.55, 16, 10, 0, TAU, 0, Math.PI * 0.6), toon(0xff9ad5, { opacity: 0.82, emissive: 0x6a1a4a, side: THREE.DoubleSide }), { cast: false });
    bell.position.y = 0.6; root.add(bell);
    const tent = [];
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const t = mesh(G.cyl(0.035, 0.015, 0.8, 5), toon(0xffc0e6, { opacity: 0.8 }), { cast: false });
        t.position.set(Math.cos(a) * 0.32, 0.18, Math.sin(a) * 0.32);
        root.add(t); tent.push(t);
    }
    for (const s of [-1, 1]) { const e = eye(0.09, [0, 0, -1]); e.position.set(s * 0.17, 0.62, -0.42); root.add(e); }
    root.add(glowSprite(0xff7ac8, 2.3, 0.35));
    // sparks
    const zap = mesh(G.torus(0.62, 0.02, 4, 18), toon(0xfff49a, { emissive: 0xfff49a }), { cast: false });
    zap.rotation.x = Math.PI / 2; zap.position.y = 0.55; root.add(zap);
    return {
        root, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            const pulse = 1 + Math.sin(t * 5 + e.id) * 0.08;
            bell.scale.set(pulse, 1 / pulse, pulse);
            tent.forEach((m, i) => { m.rotation.z = Math.sin(t * 4 + i) * 0.25; m.rotation.x = Math.cos(t * 3.4 + i * 1.7) * 0.25; });
            zap.visible = Math.sin(t * 9 + e.id) > 0.2;
            zap.scale.setScalar(0.85 + Math.sin(t * 14) * 0.1);
        },
    };
}

export function makeMonkey() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const FUR = 0x8a5a36, FACE = 0xf0c9a0;
    body.add(part(G.sphere(0.42, 14, 10), FUR, 0, 0.55, 0.05, 1, 1.05, 0.95, { ink: 0.035 }));
    body.add(part(G.sphere(0.28, 10, 8), FACE, 0, 0.5, -0.14, 1, 1, 0.8, { ink: false }));
    const head = new THREE.Group(); head.position.set(0, 1.12, -0.04); body.add(head);
    head.add(part(G.sphere(0.34, 14, 10), FUR, 0, 0, 0, 1, 0.95, 1, { ink: 0.035 }));
    head.add(part(G.sphere(0.24, 10, 8), FACE, 0, -0.04, -0.14, 1, 0.9, 0.8, { ink: false }));
    for (const s of [-1, 1]) {
        head.add(part(G.sphere(0.13, 8, 6), FUR, s * 0.36, 0.04, 0, 1, 1, 0.5, { ink: 0.02 }));
        head.add(part(G.sphere(0.08, 6, 5), FACE, s * 0.37, 0.04, -0.03, 1, 1, 0.4, { ink: false }));
        const e = eye(0.085, [0, 0, -1]); e.position.set(s * 0.12, 0.08, -0.29); head.add(e);
    }
    head.add(part(G.sphere(0.05, 6, 5), 0x2a1810, 0, -0.02, -0.34, 1, 0.7, 0.7, { ink: false }));
    const arms = [];
    for (const s of [-1, 1]) {
        const a = new THREE.Group(); a.position.set(s * 0.4, 0.78, 0);
        a.add(part(G.cap(0.08, 0.34), FUR, s * 0.06, -0.18, -0.04, 1, 1, 1, { ink: 0.02 }));
        body.add(a); arms.push(a);
    }
    const nut = part(G.sphere(0.2, 12, 9), 0x6b4426, 0, 1.75, 0, 1, 1, 1, { ink: 0.03 });
    nut.visible = false; body.add(nut);
    const tail = part(G.cap(0.05, 0.55), FUR, 0.0, 0.45, 0.5, 1, 1, 1, { ink: 0.02, rot: [0.8, 0, 0] });
    body.add(tail);
    // a tiny stump to sit on
    return {
        root, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            root.rotation.y = e.face;
            const wind = e.state === 1;
            body.position.y = Math.abs(Math.sin(t * 3 + e.id)) * 0.04;
            arms[0].rotation.z = wind ? 2.8 : 0.1 + Math.sin(t * 2 + e.id) * 0.1;
            arms[1].rotation.z = wind ? -2.8 : -0.1 - Math.sin(t * 2.2 + e.id) * 0.1;
            nut.visible = wind;
            head.rotation.z = Math.sin(t * 1.7 + e.id) * 0.06;
            tail.rotation.x = 0.8 + Math.sin(t * 3 + e.id) * 0.3;
            body.scale.y = wind ? 1 + Math.sin(t * 24) * 0.02 : 1;
        },
    };
}

export function makeCannon() {
    const root = new THREE.Group();
    const wheels = [];
    const barrel = new THREE.Group(); barrel.position.set(0, 0.6, 0); root.add(barrel);
    const tube = part(G.cyl(0.3, 0.38, 1.4, 14), 0x4b5563, 0, 0, 0, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: 0.035 });
    tube.position.z = -0.1; barrel.add(tube);
    barrel.add(part(G.torus(0.33, 0.06, 6, 16), 0xc9a24a, 0, 0, -0.6, 1, 1, 1, { ink: false }));
    barrel.add(part(G.sphere(0.3, 10, 8), 0x3a4350, 0, 0, 0.62, 1, 1, 1, { ink: false }));
    const mouth = part(G.cyl(0.22, 0.22, 0.1, 12), 0x14161c, 0, 0, -0.84, 1, 1, 1, { rot: [Math.PI / 2, 0, 0], ink: false });
    barrel.add(mouth);
    root.add(part(G.box(0.9, 0.3, 1.1), 0x8a5a36, 0, 0.3, 0.05, 1, 1, 1, { ink: 0.03 }));
    for (const s of [-1, 1]) {
        const w = part(G.cyl(0.36, 0.36, 0.16, 14), 0x6b4426, s * 0.52, 0.36, 0.1, 1, 1, 1, { rot: [0, 0, Math.PI / 2], ink: 0.03 });
        root.add(w); wheels.push(w);
        root.add(part(G.cyl(0.08, 0.08, 0.2, 8), 0xc9a24a, s * 0.52, 0.36, 0.1, 1, 1, 1, { rot: [0, 0, Math.PI / 2], ink: false }));
    }
    const fuse = glowSprite(0xffb347, 0.9, 0.0); fuse.position.set(0, 0.95, 0.5); root.add(fuse);
    return {
        root, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            root.rotation.y = Math.atan2(-e.fx, -e.fz);
            const wind = e.state === 1;
            fuse.material.opacity = wind ? 0.6 + Math.sin(t * 40) * 0.3 : 0;
            barrel.scale.set(1, 1, wind ? 1.04 + Math.sin(t * 40) * 0.02 : 1);
        },
    };
}

export function makeGull(big = 1) {
    const root = new THREE.Group();
    const body = new THREE.Group(); body.scale.setScalar(big); root.add(body);
    body.add(part(G.sphere(0.45, 14, 10), 0xffffff, 0, 0.5, 0.05, 0.9, 0.8, 1.35, { ink: 0.035 }));
    body.add(part(G.sphere(0.3, 12, 9), 0xf3f6ff, 0, 0.82, -0.5, 1, 1, 1, { ink: 0.03 }));
    body.add(part(G.cone(0.1, 0.38, 6), 0xffa940, 0, 0.78, -0.88, 1, 1, 1, { ink: 0.02, rot: [-Math.PI / 2, 0, 0] }));
    for (const s of [-1, 1]) {
        const e = eye(0.075, [0, 0, -1]); e.position.set(s * 0.15, 0.92, -0.66); body.add(e);
        body.add(part(G.box(0.14, 0.03, 0.03), 0x30343c, s * 0.15, 1.02, -0.7, 1, 1, 1, { ink: false, rot: [0, 0, s * -0.5] }));
    }
    body.add(part(G.cone(0.18, 0.5, 5), 0x9aa6bc, 0, 0.52, 0.7, 1, 1, 1, { ink: 0.025, rot: [Math.PI / 2 + 0.2, 0, 0] }));
    const wings = [];
    for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(s * 0.28, 0.62, 0.0);
        const sh = new THREE.Shape(); sh.moveTo(0, 0.3); sh.quadraticCurveTo(1.0, 0.7, 1.6, 0.05); sh.quadraticCurveTo(1.0, 0.1, 0.6, -0.4); sh.lineTo(0, -0.3); sh.closePath();
        const wm = mesh(new THREE.ShapeGeometry(sh), toon(0xe8edf8, { side: THREE.DoubleSide }), { cast: true });
        wm.rotation.x = -Math.PI / 2; wm.scale.x = s;
        const tip = mesh(new THREE.ShapeGeometry((() => { const q = new THREE.Shape(); q.moveTo(1.05, 0.3); q.lineTo(1.6, 0.05); q.lineTo(1.2, -0.2); q.closePath(); return q; })()), toon(0x4a5468, { side: THREE.DoubleSide }), { cast: false });
        tip.position.z = 0.01; wm.add(tip);
        w.add(wm); body.add(w); wings.push({ w, s });
    }
    for (const s of [-1, 1]) body.add(part(G.cyl(0.025, 0.025, 0.3, 4), 0xffa940, s * 0.14, 0.12, 0.1, 1, 1, 1, { ink: false }));
    return {
        root, body, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            root.rotation.y = e.face;
            const flap = Math.sin(t * (e.state === 2 ? 22 : 11) + e.id) * (e.state === 2 ? 0.4 : 0.7);
            wings.forEach((w) => { w.w.rotation.z = w.s * flap; });
            body.rotation.x = e.state === 2 ? -0.7 : e.state === 1 ? 0.3 : 0;
            body.position.y = e.state === 1 ? Math.sin(t * 30) * 0.03 : 0;
        },
    };
}

export function makeKnight() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    body.add(part(G.sphere(0.55, 14, 10), 0xe2b97c, 0, 0.5, 0.05, 1, 0.7, 0.9, { ink: 0.035 }));
    const helm = part(new THREE.SphereGeometry(0.5, 14, 10, 0, TAU, 0, Math.PI * 0.55), 0xaab4c0, 0, 0.62, -0.08, 1, 1, 1, { ink: 0.03 });
    body.add(helm);
    body.add(part(G.box(0.12, 0.3, 0.1), 0xff6b6b, 0, 1.18, -0.08, 1, 1, 1, { ink: false }));
    body.add(part(G.box(0.8, 0.08, 0.08), 0x6a7482, 0, 0.7, -0.5, 1, 1, 1, { ink: false }));
    for (const s of [-1, 1]) { const e = eye(0.09, [0, 0, -1]); e.position.set(s * 0.2, 0.55, -0.45); body.add(e); }
    const shield = part(G.cyl(0.4, 0.4, 0.08, 10), 0xc9d2da, 0.6, 0.55, -0.3, 1, 1, 1, { rot: [0, 0, Math.PI / 2], ink: 0.03 });
    body.add(shield);
    body.add(part(G.cyl(0.14, 0.14, 0.1, 8), 0xff6b6b, 0.66, 0.55, -0.3, 1, 1, 1, { rot: [0, 0, Math.PI / 2], ink: false }));
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
        const l = part(G.cyl(0.04, 0.05, 0.4, 5), 0x9a8460, s * 0.4, 0.15, -0.1 + i * 0.3, 1, 1, 1, { rot: [0, 0, -s * 0.9], ink: false });
        body.add(l); legs.push(l);
    }
    return {
        root, update(e, dt, t) {
            root.position.set(e.x, e.y, e.z);
            root.rotation.y = e.face;
            body.position.y = Math.abs(Math.sin(t * 5 + e.id)) * 0.03;
            body.rotation.z = e.clink > 0 ? Math.sin(t * 60) * 0.08 : 0;
            legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i) * 0.3; });
        },
    };
}

// ================================================================ bosses
export function makeCoco() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const tex = null;
    body.add(part(G.sphere(1.25, 22, 16), 0x5a3a22, 0, 1.45, 0, 1.1, 0.9, 1, { ink: 0.05 }));
    body.add(part(G.sphere(0.95, 16, 12), 0x8a5a36, 0, 1.4, -0.45, 1, 0.8, 0.8, { ink: false }));
    // blue crab legs and claws: a coconut crab
    const BLUE = 0x4a6fd0;
    const legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const l = new THREE.Group(); l.position.set(s * 1.1, 1.0, -0.4 + i * 0.5);
        l.add(part(G.cyl(0.09, 0.12, 1.0, 6), BLUE, s * 0.45, -0.25, 0, 1, 1, 1, { rot: [0, 0, -s * 1.0], ink: 0.03 }));
        body.add(l); legs.push({ l, s, i });
    }
    const claws = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(s * 1.3, 1.5, -0.7);
        arm.add(part(G.cyl(0.18, 0.22, 0.9, 8), BLUE, s * 0.35, 0, -0.1, 1, 1, 1, { rot: [0, 0, -s * 1.1], ink: 0.04 }));
        const hand = new THREE.Group(); hand.position.set(s * 0.8, 0.2, -0.35);
        hand.add(part(G.sphere(0.45, 14, 10), 0x6a8ff0, 0, 0, 0, 1, 0.9, 1.2, { ink: 0.04 }));
        const up = part(G.cone(0.2, 0.7, 8), 0x6a8ff0, 0, 0.12, -0.65, 1, 1, 1, { rot: [-Math.PI / 2, 0, 0], ink: 0.03 });
        const dn = part(G.cone(0.18, 0.6, 8), 0x4a6fd0, 0, -0.12, -0.6, 1, 1, 1, { rot: [-Math.PI / 2, 0, 0], ink: 0.03 });
        hand.add(up); hand.add(dn); arm.add(hand);
        body.add(arm); claws.push({ arm, hand, up, dn, s });
    }
    const stalks = [];
    for (const s of [-1, 1]) {
        const st = new THREE.Group(); st.position.set(s * 0.4, 2.05, -0.65);
        st.add(part(G.cyl(0.07, 0.09, 0.6, 6), 0x8a5a36, 0, 0.3, 0, 1, 1, 1, { ink: 0.02 }));
        const e = eye(0.26, [0, 0, -1]); e.position.y = 0.7; st.add(e);
        body.add(st); stalks.push({ st, e });
    }
    // an angry tuft of leaves and a scarf of coconuts: a bully with a soft heart
    const crown = part(G.cone(0.3, 0.6, 5), 0x4caf50, 0, 2.55, 0.1, 1, 1, 1, { ink: 0.02 });
    body.add(crown);
    const stars = new THREE.Group(); stars.position.y = 3.4; root.add(stars);
    for (let i = 0; i < 4; i++) stars.add(part(G.cone(0.14, 0.28, 4), 0xffe36b, Math.cos(i * 1.57) * 0.8, 0, Math.sin(i * 1.57) * 0.8, 1, 1, 1, { ink: false }));
    const warn = glowSprite(0xffb347, 3.6, 0); warn.position.set(0, 2.0, -1); root.add(warn);
    return {
        root, update(B, dt, t) {
            root.position.set(B.x, B.y, B.z);
            root.rotation.y = B.face;
            const wind = B.state === 'wind' || B.state === 'stompwind';
            const dizzy = B.state === 'dizzy', dead = B.state === 'defeated';
            const sc = (dead ? Math.max(0.01, 1 - B.t * 0.18) : 1) * 1.2;
            body.scale.set(sc, sc * (dizzy ? 0.92 : 1), sc);
            body.rotation.z = dizzy ? Math.sin(t * 7) * 0.18 : dead ? Math.min(1.4, B.t * 1.5) : 0;
            body.position.y = Math.abs(Math.sin(t * 4)) * 0.06;
            claws.forEach((c) => {
                const raise = wind ? 1.3 : 0.2 + Math.sin(t * 3 + c.s) * 0.1;
                c.arm.rotation.z = c.s * raise; c.up.rotation.x = -Math.PI / 2 - (wind ? 0.5 : 0.15); c.dn.rotation.x = -Math.PI / 2 + (wind ? 0.4 : 0.1);
            });
            legs.forEach((l) => { l.l.rotation.x = Math.sin(t * 6 + l.i + l.s * 2) * 0.18; });
            stalks.forEach((s) => { s.e.scale.y = dizzy ? 0.3 : 1; s.st.rotation.z = dizzy ? Math.sin(t * 9 + s.st.position.x) * 0.5 : 0; });
            stars.visible = dizzy; stars.rotation.y = t * 4;
            warn.material.opacity = wind ? 0.5 + Math.sin(t * 30) * 0.3 : 0;
            crown.rotation.z = Math.sin(t * 2) * 0.1;
        },
    };
}

export function makeSandy() {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const SAND = 0xe9c77e, SAND2 = 0xf6dc9c, DARK = 0xb98f4a;
    const legL = part(G.box(1.1, 1.4, 1.2), SAND, -0.8, 0.7, 0, 1, 1, 1, { ink: 0.04 });
    const legR = part(G.box(1.1, 1.4, 1.2), SAND, 0.8, 0.7, 0, 1, 1, 1, { ink: 0.04 });
    body.add(legL); body.add(legR);
    const torso = new THREE.Group(); torso.position.y = 1.4; body.add(torso);
    torso.add(part(G.box(2.6, 1.8, 1.8), SAND2, 0, 0.9, 0, 1, 1, 1, { ink: 0.04 }));
    for (let i = 0; i < 5; i++) torso.add(part(G.box(0.4, 0.32, 0.4), SAND2, -1.0 + i * 0.5, 2.0, 0.8, 1, 1, 1, { ink: false })); // battlements
    const head = new THREE.Group(); head.position.set(0, 2.3, 0); torso.add(head);
    head.add(part(G.box(1.5, 1.2, 1.4), SAND, 0, 0.6, 0, 1, 1, 1, { ink: 0.04 }));
    for (const s of [-1, 1]) {
        const e = eye(0.2, [0, 0, -1], 0x3a2a14); e.position.set(s * 0.36, 0.7, -0.66); head.add(e);
        head.add(part(G.box(0.4, 0.07, 0.05), DARK, s * 0.36, 0.98, -0.7, 1, 1, 1, { ink: false, rot: [0, 0, s * -0.4] }));
    }
    head.add(part(G.box(0.7, 0.12, 0.05), DARK, 0, 0.32, -0.72, 1, 1, 1, { ink: false }));
    // the crown: the thing to hit
    const crown = new THREE.Group(); crown.position.y = 1.3; head.add(crown);
    crown.add(part(G.cyl(0.6, 0.7, 0.3, 8), 0xffd34d, 0, 0, 0, 1, 1, 1, { ink: 0.03 }));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; crown.add(part(G.cone(0.14, 0.4, 5), 0xffd34d, Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5, 1, 1, 1, { ink: false })); crown.add(part(G.sphere(0.08, 6, 5), 0xff5b6b, Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5, 1, 1, 1, { ink: false })); }
    const armL = new THREE.Group(); armL.position.set(-1.6, 1.5, 0); torso.add(armL);
    armL.add(part(G.box(0.9, 1.9, 0.9), SAND, 0, -0.9, 0, 1, 1, 1, { ink: 0.04 }));
    armL.add(part(G.box(1.2, 1.2, 1.2), SAND2, 0, -2.1, 0, 1, 1, 1, { ink: 0.04 }));
    const armR = new THREE.Group(); armR.position.set(1.6, 1.5, 0); torso.add(armR);
    armR.add(part(G.box(0.9, 1.9, 0.9), SAND, 0, -0.9, 0, 1, 1, 1, { ink: 0.04 }));
    const shield = part(G.cyl(1.0, 1.0, 0.25, 10), 0xc9d2da, 0.35, -1.7, -0.8, 1, 1, 1, { ink: 0.04, rot: [Math.PI / 2, 0, 0] });
    armR.add(shield);
    armR.add(part(G.cyl(0.35, 0.35, 0.3, 8), 0xff6b6b, 0.35, -1.7, -0.94, 1, 1, 1, { ink: false, rot: [Math.PI / 2, 0, 0] }));
    const stars = new THREE.Group(); stars.position.y = 6.2; root.add(stars);
    for (let i = 0; i < 4; i++) stars.add(part(G.cone(0.2, 0.4, 4), 0xffe36b, Math.cos(i * 1.57) * 1.0, 0, Math.sin(i * 1.57) * 1.0, 1, 1, 1, { ink: false }));
    return {
        root, update(B, dt, t) {
            root.position.set(B.x, B.y, B.z);
            root.rotation.y = B.face;
            const dazed = B.state === 'dazed', wind = B.state === 'wind', dead = B.state === 'defeated';
            const walk = B.state === 'walk';
            body.position.y = walk ? Math.abs(Math.sin(t * 4)) * 0.12 : 0;
            body.scale.y = dazed ? 0.72 : dead ? Math.max(0.05, 1 - B.t * 0.3) : 1;
            torso.rotation.x = dazed ? 0.35 : 0;
            armL.rotation.x = wind ? -2.6 + Math.sin(B.t * 6) * 0.05 : B.state === 'recover' ? -0.2 : Math.sin(t * 3) * 0.1;
            armR.rotation.z = wind ? -0.2 : 0;
            crown.position.y = 1.3 + (dazed ? 0.1 + Math.sin(t * 8) * 0.05 : 0);
            crown.rotation.y = t * (dazed ? 4 : 1);
            stars.visible = dazed; stars.rotation.y = t * 4;
            legL.rotation.x = walk ? Math.sin(t * 4) * 0.2 : 0; legR.rotation.x = walk ? -Math.sin(t * 4) * 0.2 : 0;
        },
    };
}

export function makeSquawk() {
    const g = makeGull(2.4);
    const hat = new THREE.Group(); hat.position.set(0, 1.12, -0.48); hat.rotation.x = -0.15;
    hat.add(part(G.cyl(0.55, 0.65, 0.2, 14), 0x1f2a44, 0, 0, 0, 1, 1, 1, { ink: 0.03 }));
    hat.add(part(G.cone(0.45, 0.5, 14), 0x2a3a64, 0, 0.3, 0, 1, 1, 1, { ink: 0.03 }));
    hat.add(part(G.sphere(0.12, 8, 6), 0xffd34d, 0, 0.1, -0.5, 1, 1, 1, { ink: false }));
    hat.scale.setScalar(0.5);
    g.body.add(hat);
    const patch = part(G.sphere(0.1, 8, 6), 0x14161c, -0.15, 0.93, -0.74, 1, 1, 0.4, { ink: false });
    g.body.add(patch);
    g.body.add(part(G.cyl(0.012, 0.012, 0.4, 4), 0x14161c, -0.02, 1.0, -0.7, 1, 1, 1, { ink: false, rot: [0, 0, 1.1] }));
    const glow = glowSprite(0xffe36b, 4, 0); glow.position.set(0, 1.4, 0); g.root.add(glow);
    const stars = new THREE.Group(); stars.position.y = 3.6; g.root.add(stars);
    for (let i = 0; i < 4; i++) stars.add(part(G.cone(0.16, 0.32, 4), 0xffe36b, Math.cos(i * 1.57) * 0.9, 0, Math.sin(i * 1.57) * 0.9, 1, 1, 1, { ink: false }));
    const baseUpdate = g.update;
    return {
        root: g.root, update(B, dt, t) {
            const e = { x: B.x, y: B.y, z: B.z, face: B.face, id: 0, state: B.state === 'dive' ? 2 : B.state === 'mark' ? 1 : 0 };
            baseUpdate(e, dt, t);
            const stuck = B.state === 'stuck' || B.state === 'falling';
            g.body.rotation.x = B.state === 'dive' ? -1.1 : stuck ? 0.5 : 0;
            if (stuck) g.body.rotation.z = Math.sin(t * 20) * 0.08;
            else g.body.rotation.z = Math.sin(t * 2) * 0.05;
            stars.visible = B.state === 'stuck'; stars.rotation.y = t * 4;
            glow.material.opacity = B.state === 'mark' ? 0.4 + Math.sin(t * 28) * 0.25 : 0;
            g.root.scale.setScalar(B.state === 'defeated' ? Math.max(0.01, 1 - B.t * 0.3) : 1);
            if (B.state === 'defeated') g.root.rotation.z = B.t * 3;
        },
    };
}
