// Procedural models: the angels (Cael, Vesper, the fallen), the Halo, the
// Echoes, pick-ups and every regular enemy. Each factory returns
//   { root, mats, update(src, t, dt) }
// where `src` is the sim object it mirrors. Enemies face −x (toward the
// player); angels face +x.

import * as THREE from 'three';
import {
    Builder, litMat, glowMat, sphere, cyl, cone, box, torus, octa, ico, lathe, dsphere,
    taperTube, featherGeo, membraneGeo, displace,
} from './lib.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** A cylinder from A to B (in the xy plane plus z), radius r, added to builder b. */
export function limb(b, A, B, r, o = {}) {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = (B[2] ?? 0) - (A[2] ?? 0);
    const L = Math.hypot(dx, dy, dz);
    const m = new THREE.Matrix4();
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.compose(new THREE.Vector3((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, ((A[2] ?? 0) + (B[2] ?? 0)) / 2), q, new THREE.Vector3(r, L, r));
    b.add(cyl(1, 1, 10), { ...o, m });
    b.add(sphere(10, 8), { ...o, p: A, s: r });
    b.add(sphere(10, 8), { ...o, p: B, s: r });
}

export function group(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }

export function finish(root, mats, update) {
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    return { root, mats, update };
}

export function setFlash(model, v) { for (const m of model.mats) if (m.userData.flash) m.userData.flash.value = v; }
export function setFade(model, v) { for (const m of model.mats) if (m.userData.fade) m.userData.fade.value = v; }

// =========================================================================== angels
/**
 * An angel: robed body, hair, a small halo, and one or two pairs of feathered
 * wings that flap about the body axis. Used for Cael, Vesper, Sammael and the
 * fallen seraphlings.
 */
export function buildAngel(o = {}) {
    const P = {
        robe: 0xf4ecdc, robe2: 0xd8ccb8, trim: 0xe8b84a, skin: 0xf2d0b4, hair: 0xfff0c8, hair2: 0xffd88a, hairGlow: 0.18,
        wing: 0xfbf8ff, wingTip: 0xffe0a0, wingGlow: 0.35, eyes: 0xffd060, halo: true, haloCol: 0xffd070,
        tattered: false, pairs: 1, crown: null, wingScale: 1, long: false, ...o,
    };
    const mats = [];
    const bodyMat = litMat({ rough: 0.55, glowMul: 1.8 }); mats.push(bodyMat);
    const wingMat = litMat({ rough: 0.5, side: THREE.DoubleSide, glowMul: 1.6, rimMul: 1.4 }); mats.push(wingMat);

    // ---- body
    const b = new Builder();
    const trimAt = (lo, hi) => (x, y, z, t) => new THREE.Color(y > lo && y < hi ? P.trim : P.robe).lerp(new THREE.Color(P.robe2), t * 0.5);
    b.add(lathe([[0, -0.3], [0.1, -0.27], [0.15, -0.18], [0.17, -0.02], [0.165, 0.1], [0.13, 0.2], [0.07, 0.26], [0, 0.27]], 18),
        { p: [0.12, 0.02, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.85], tint: trimAt(-0.07, -0.02), grad: 'y' });
    // collar and sash
    b.add(torus(0.25, 8, 20), { p: [0.33, 0.04, 0], r: [0, Math.PI / 2, 0], s: [0.12, 0.13, 0.12], color: P.trim, glow: 0.15 });
    b.add(sphere(), { p: [0.47, 0.13, 0], s: [0.135, 0.13, 0.12], color: P.skin });              // head
    b.add(sphere(), { p: [0.535, 0.075, 0], s: [0.06, 0.05, 0.08], color: P.skin });             // chin
    b.add(sphere(10, 8), { p: [0.585, 0.15, 0.062], s: 0.02, color: P.eyes, glow: 3 });           // eyes
    b.add(sphere(10, 8), { p: [0.585, 0.15, -0.062], s: 0.02, color: P.eyes, glow: 3 });
    b.add(sphere(10, 8), { p: [0.12, 0.02, 0.15], s: 0.03, color: 0xfff2c0, glow: 2.4 });          // the heart-light
    // hair: tapered strands swept back from the crown
    for (let i = 0; i < 9; i++) {
        const z = (i - 4) * 0.028, len = (P.long ? 0.55 : 0.32) + (i % 3) * 0.05;
        const g = taperTube([V(0.5, 0.25, z), V(0.4, 0.29, z * 1.3), V(0.38 - len * 0.5, 0.25 - (i % 2) * 0.03, z * 1.6), V(0.42 - len, 0.17 - (P.long ? 0.12 : 0), z * 1.9)], 0.05, 0.006, 7, 10);
        b.add(g, { color: P.hair, color2: P.hair2, grad: 'x', glow: P.hairGlow * 1.4, glow2: P.hairGlow * 0.4 });
    }
    b.add(sphere(), { p: [0.46, 0.2, 0], s: [0.13, 0.08, 0.12], color: P.hair, glow: P.hairGlow });
    // arms reaching forward
    limb(b, [0.3, 0.06, 0.13], [0.5, -0.04, 0.16], 0.038, { color: P.robe });
    limb(b, [0.5, -0.04, 0.16], [0.68, -0.02, 0.12], 0.03, { color: P.skin });
    b.add(sphere(10, 8), { p: [0.7, -0.02, 0.12], s: 0.04, color: P.skin, glow: 0.2 });
    limb(b, [0.3, 0.06, -0.13], [0.48, -0.08, -0.14], 0.036, { color: P.robe2 });
    limb(b, [0.48, -0.08, -0.14], [0.62, -0.06, -0.1], 0.028, { color: P.skin });
    if (P.crown) {
        for (let i = 0; i < 7; i++) {
            const a = -0.9 + i * 0.3;
            b.add(cone(6), { p: [0.46 + Math.cos(a + 1.57) * 0.1, 0.27 + Math.sin(a + 1.57) * 0.04, (i - 3) * 0.04], r: [0, 0, a * 0.5], s: [0.025, 0.16 + (i % 2) * 0.08, 0.025], color: P.crown, glow: 1.2 });
        }
    }
    const body = new THREE.Mesh(b.build(), bodyMat);

    // ---- the small halo above the head
    let halo = null;
    if (P.halo) {
        const arc = P.halo === 'broken' ? Math.PI * 1.3 : TAU;
        const hb = new Builder();
        hb.add(torus(0.12, 8, 32, arc), { s: 0.11, color: P.haloCol, glow: 2.6 });
        halo = new THREE.Mesh(hb.build(), bodyMat);
        halo.position.set(0.42, 0.36, 0);
        halo.rotation.set(Math.PI / 2 - 0.55, 0.25, 0);
    }

    // ---- robe tail (sways)
    const tb = new Builder();
    tb.add(lathe([[0.16, 0], [0.2, -0.18], [0.19, -0.38], [0.14, -0.58], [0.07, -0.76], [0.0, -0.86]], 18),
        { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.8], tint: (x, y) => new THREE.Color(y < -0.7 ? P.trim : P.robe).lerp(new THREE.Color(P.robe2), Math.min(1, -y)), glow: 0, });
    for (let i = 0; i < 4; i++) tb.add(featherGeo(0.3, 0.05, 0.02), { p: [-0.6, -0.05 + i * 0.02, (i - 1.5) * 0.06], r: [0, 0, Math.PI + 0.25 - i * 0.12], color: P.robe, color2: P.trim, grad: 'x', glow: 0, glow2: 0.3 });
    const tail = new THREE.Mesh(tb.build(), wingMat);
    const tailPivot = group(tail);
    tailPivot.position.set(-0.12, -0.01, 0);

    // ---- wings
    function wingGeo(outer, far) {
        const w = new Builder();
        const tip = far ? 0.75 : 1;
        const fcol = { color: P.wing, color2: P.wingTip, grad: 'x', glow: 0.0, glow2: P.wingGlow * tip };
        const skip = (i) => P.tattered && (i * 7 + (outer ? 3 : 0)) % 5 === 1;
        if (!outer) {
            limb(w, [0, 0, 0], [-0.08, 0.5, 0], 0.032, { color: P.wing });
            for (let i = 0; i < 9; i++) {
                if (skip(i)) continue;
                const t = i / 8;
                w.add(featherGeo(0.42 + t * 0.14, 0.075, 0.06), { p: [-0.02 - t * 0.06, 0.04 + t * 0.46, -0.01], r: [0, 0, Math.PI + 0.25 - t * 0.12], ...fcol });
            }
            for (let i = 0; i < 8; i++) {
                const t = i / 7;
                w.add(featherGeo(0.24, 0.07, 0.03), { p: [-0.0 - t * 0.07, 0.06 + t * 0.44, 0.012], r: [0, 0, Math.PI + 0.12], color: P.wing, glow: 0 });
            }
        } else {
            limb(w, [0, 0, 0], [0.05, 0.38, 0], 0.026, { color: P.wing });
            for (let i = 0; i < 9; i++) {
                if (skip(i)) continue;
                const t = i / 8;
                const len = (0.82 - t * 0.28) * (P.tattered && i % 3 === 0 ? 0.7 : 1);
                w.add(featherGeo(len, 0.085, 0.12), { p: [0.04 - t * 0.04, 0.38 - t * 0.36, -0.01], r: [0, 0, 2.0 + t * 0.95], ...fcol });
            }
            for (let i = 0; i < 6; i++) {
                const t = i / 5;
                w.add(featherGeo(0.26, 0.07, 0.03), { p: [0.02, 0.34 - t * 0.3, 0.012], r: [0, 0, 2.3 + t * 0.6], color: P.wing, glow: 0 });
            }
        }
        return w.build();
    }
    const wings = [];
    const pairs = [];
    for (let k = 0; k < P.pairs; k++) {
        for (const side of [1, -1]) {
            const far = side < 0;
            const inner = new THREE.Mesh(wingGeo(false, far), wingMat);
            const outer = new THREE.Mesh(wingGeo(true, far), wingMat);
            const outerPivot = group(outer); outerPivot.position.set(-0.08, 0.5, 0);
            const flap = group(inner, outerPivot);
            const tilt = group(flap);
            const s = P.wingScale * (k ? 0.8 : 1);
            tilt.scale.setScalar(s);
            tilt.position.set(0.2 - k * 0.12, 0.14 - k * 0.04, side * 0.11);
            tilt.rotation.z = 0.45 + k * 0.5;
            if (k) tilt.rotation.z = 1.9;          // a lower pair, pointing back-down
            wings.push({ tilt, flap, outerPivot, side, k });
        }
    }

    const root = new THREE.Group();
    const lean = new THREE.Group();
    lean.add(body, tailPivot);
    if (halo) lean.add(halo);
    for (const w of wings) lean.add(w.tilt);
    root.add(lean);

    const st = { phase: 0 };
    function flapTo(t, speed = 1, open = 0.5) {
        st.phase += speed;
        const ph = t * 6.2 * speed + st.phase * 0;
        for (const w of wings) {
            const s = Math.sin(ph + w.k * 1.4);
            const ang = 0.35 + open * 0.4 + s * 0.55;
            w.flap.rotation.x = w.side * ang;
            w.flap.rotation.z = s * 0.08;
            w.outerPivot.rotation.z = -0.25 + Math.max(0, -s) * 0.55;
        }
        tailPivot.rotation.z = Math.sin(t * 3.1) * 0.08;
        tailPivot.rotation.y = Math.sin(t * 2.3) * 0.12;
    }
    flapTo(0);
    const model = finish(root, mats, () => {});
    model.lean = lean;
    model.flap = flapTo;
    model.halo = halo;
    model.body = body;
    return model;
}

/** Cael, the player. */
export function buildCael() {
    const m = buildAngel({});
    m.root.scale.setScalar(1.5);
    m.update = (p, t, dt, extra) => {
        const bank = p.bank ?? 0;
        m.lean.rotation.z = bank * 0.32 + Math.sin(t * 1.7) * 0.03;
        m.lean.rotation.x = -bank * 0.25;
        const spd = 1 + Math.abs(bank) * 0.4 + (extra?.moving ?? 0) * 0.25;
        m.flap(t, spd, 0.4 + bank * 0.3);
        if (m.halo) m.halo.rotation.z = t * 0.6;
    };
    return m;
}

/** Vesper, the chained star (or freed, in the ending). */
export function buildVesper(free = false) {
    const m = buildAngel(free ? {
        robe: 0x6a58b8, robe2: 0x3a2e78, trim: 0xe8eaff, skin: 0xf4dce6, hair: 0x2a2050, hair2: 0x8070d0, hairGlow: 0.5,
        wing: 0xe8e4f4, wingTip: 0xc8b8ff, wingGlow: 0.45, eyes: 0xe0d8ff, halo: true, haloCol: 0xe8e0ff, long: true,
    } : {
        robe: 0x2a2240, robe2: 0x16122a, trim: 0x9aa0c8, skin: 0xe0c4cc, hair: 0x18122a, hair2: 0x4a3a7a, hairGlow: 0.25,
        wing: 0x7c7c94, wingTip: 0x4a4a64, wingGlow: 0.15, eyes: 0xc8b8ff, halo: 'broken', haloCol: 0xa898e8, tattered: true, long: true,
    });
    m.root.scale.setScalar(1.45);
    if (!free) {
        // chains from the wrists down into the dark
        const cb = new Builder();
        for (const [hx, hy, hz] of [[0.7, -0.02, 0.12], [0.62, -0.06, -0.1]]) {
            for (let i = 0; i < 18; i++) {
                cb.add(torus(0.28, 6, 12), { p: [hx - i * 0.02, hy - 0.06 - i * 0.075, hz], r: [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], s: [0.04, 0.05, 0.04], color: 0x6a6070 });
            }
        }
        const cm = litMat({ rough: 0.35, metal: 0.8 });
        m.mats.push(cm);
        m.lean.add(new THREE.Mesh(cb.build(), cm));
    }
    m.update = (p, t) => { m.flap(t, free ? 0.6 : 0.25, free ? 0.6 : -0.3); m.lean.rotation.z = Math.sin(t * 0.8) * 0.05; if (m.halo) m.halo.rotation.z = t * 0.3; };
    return m;
}

// =========================================================================== the Halo (Force)
export const HALO_COLORS = { red: 0xff5a28, blue: 0x46b8ff, gold: 0xffd050, dawn: 0xfff4d8, none: 0xffe8b0 };

export function buildHalo() {
    const mats = [];
    const core = new THREE.Mesh(sphere(24, 18), glowMat(0xffe8b0, 0.7)); core.scale.setScalar(0.3); mats.push(core.material);
    const shell = new THREE.Mesh(sphere(24, 18), glowMat(0xffd070, 0.16)); shell.scale.setScalar(0.62); mats.push(shell.material);
    const rb = new Builder();
    rb.add(torus(0.07, 8, 48), { s: 0.62, color: 0xffd070, glow: 2.8 });
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        rb.add(featherGeo(0.26, 0.06, 0.04), { p: [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0], r: [0, 0, a + 0.6], color: 0xfff4d0, color2: 0xffd070, grad: 'x', glow: 1.2, glow2: 2.2 });
    }
    const ringMat = litMat({ side: THREE.DoubleSide, glowMul: 1.5 }); mats.push(ringMat);
    const ring = new THREE.Mesh(rb.build(), ringMat);
    const ring2 = new THREE.Mesh(torus(0.05, 6, 40), glowMat(0xffd070, 0.8)); ring2.scale.setScalar(0.46); mats.push(ring2.material);
    const root = group(shell, core, ring, ring2);
    const c = new THREE.Color();
    const model = finish(root, mats, (h, t, dt, colorKey) => {
        c.set(HALO_COLORS[colorKey] ?? HALO_COLORS.none);
        shell.material.color.copy(c);
        ring2.material.color.copy(c);
        core.material.color.copy(c).lerp(new THREE.Color(0xffffff), 0.55);
        ring.rotation.z = t * (h.st === 'launch' ? 9 : 2.2);
        ring.rotation.y = Math.sin(t * 1.3) * 0.5;
        ring2.rotation.x = t * 1.7; ring2.rotation.y = t * 2.3;
        const pulse = 1 + Math.sin(t * 9) * 0.06;
        shell.scale.setScalar(0.62 * pulse);
    });
    return model;
}

export function buildEcho() {
    const core = new THREE.Mesh(sphere(16, 12), glowMat(0xfff0c8, 0.95)); core.scale.setScalar(0.2);
    const shell = new THREE.Mesh(sphere(16, 12), glowMat(0xffc860, 0.3)); shell.scale.setScalar(0.36);
    const fb = new Builder();
    for (let i = 0; i < 3; i++) fb.add(featherGeo(0.32, 0.07, 0.05), { r: [0, 0, Math.PI + (i - 1) * 0.5], color: 0xffffff, color2: 0xffd080, grad: 'x', glow: 0.6, glow2: 1.6 });
    const fm = litMat({ side: THREE.DoubleSide });
    const feathers = new THREE.Mesh(fb.build(), fm);
    const root = group(shell, core, feathers);
    return finish(root, [core.material, shell.material, fm], (e, t) => {
        feathers.rotation.z = Math.sin(t * 5) * 0.25;
        shell.scale.setScalar(0.36 + Math.sin(t * 7) * 0.03);
    });
}

// =========================================================================== items
export const ITEM_COLORS = { red: 0xff4a20, blue: 0x3aa8ff, gold: 0xffc830, wing: 0xffffff, echo: 0xffe0a0, seeker: 0xffffff, aegis: 0x88ffd8, life: 0xffb0d0, shard: 0xc070ff };

export function buildItem(kind) {
    const c = ITEM_COLORS[kind] ?? 0xffffff;
    const b = new Builder();
    const mat = litMat({ rough: 0.2, metal: 0.1, side: THREE.DoubleSide, glowMul: 1.5 });
    switch (kind) {
        case 'red': case 'blue': case 'gold':
            b.add(octa(0), { s: [0.3, 0.52, 0.3], color: c, glow: 1.2 });
            b.add(octa(0), { s: [0.16, 0.28, 0.16], p: [0, 0, 0.18], color: 0xffffff, glow: 2 });
            break;
        case 'wing':
            for (let i = 0; i < 5; i++) b.add(featherGeo(0.6, 0.12, 0.08), { p: [-0.2, -0.2 + i * 0.05, 0], r: [0, 0, 0.6 + i * 0.22], color: 0xffffff, color2: 0xffe8a0, grad: 'x', glow: 0.5, glow2: 1.5 });
            break;
        case 'echo':
            b.add(sphere(), { s: 0.22, color: c, glow: 2.5 });
            b.add(torus(0.1, 8, 32), { s: 0.4, color: 0xffd070, glow: 2 });
            break;
        case 'seeker':
            for (const s of [-1, 1]) b.add(featherGeo(0.55, 0.1, 0.05), { p: [-0.25, s * 0.12, 0], r: [0, 0, s * 0.25], color: 0xffffff, color2: 0x9ad8ff, grad: 'x', glow: 0.8, glow2: 2 });
            break;
        case 'aegis':
            b.add(cyl(1, 1, 24), { r: [Math.PI / 2, 0, 0], s: [0.4, 0.06, 0.4], color: 0x2a6a5a, glow: 0.3 });
            b.add(torus(0.12, 8, 32), { s: 0.42, color: c, glow: 2.2 });
            b.add(octa(0), { s: [0.1, 0.2, 0.1], p: [0, 0, 0.1], color: c, glow: 2.5 });
            break;
        case 'life':
            b.add(torus(0.12, 8, 32), { s: 0.3, p: [0, 0.32, 0], r: [1.2, 0, 0], color: 0xffd070, glow: 2.5 });
            for (const s of [-1, 1]) b.add(featherGeo(0.5, 0.14, 0.05), { r: [0, 0, Math.PI / 2 + s * 0.7], color: 0xffffff, color2: c, grad: 'x', glow: 0.6, glow2: 1.6 });
            b.add(sphere(), { s: 0.12, color: 0xfff0d0, glow: 2.5 });
            break;
        default: // shard
            b.add(octa(0), { s: [0.16, 0.26, 0.16], color: c, glow: 1.8 });
    }
    const mesh = new THREE.Mesh(b.build(), mat);
    const glow = new THREE.Mesh(sphere(12, 10), glowMat(c, kind === 'shard' ? 0.18 : 0.28));
    glow.scale.setScalar(kind === 'shard' ? 0.35 : 0.62);
    const root = group(glow, mesh);
    return finish(root, [mat, glow.material], (it, t) => {
        mesh.rotation.y = t * 2.2;
        mesh.rotation.z = kind === 'wing' || kind === 'seeker' ? Math.sin(t * 2) * 0.3 : 0;
        glow.scale.setScalar((kind === 'shard' ? 0.35 : 0.62) * (1 + Math.sin(t * 6) * 0.1));
    });
}

// =========================================================================== enemies
const DEMON = 0x7a1c14, DEMON2 = 0x3a0c0a, EYE = 0xffc828, BONE = 0xe6dcc4, BONE2 = 0xa89a80, IRON = 0x3a3836, FLESH = 0xb04050, ICE = 0x9ad8ff;

function batWing(b, side, len = 0.6, col = 0x4a0e14) {
    const root = V(0, 0, 0);
    const tips = [V(-0.1, len, side * 0.05), V(-len * 0.5, len * 0.9, side * 0.08), V(-len * 0.85, len * 0.55, side * 0.06), V(-len, len * 0.15, side * 0.04)];
    b.add(membraneGeo(root, tips, 0.3), { color: col, color2: 0x9a2a1a, grad: 'y', glow: 0.0, glow2: 0.25 });
    for (const t of tips) limb(b, [0, 0, 0], [t.x, t.y, t.z], 0.018, { color: 0x2a0806 });
}

function makeWingPair(len, col) {
    const mats = [];
    const m = litMat({ side: THREE.DoubleSide, rough: 0.7, glowMul: 1.4 }); mats.push(m);
    const pivots = [1, -1].map((side) => {
        const b = new Builder(); batWing(b, side, len, col);
        const mesh = new THREE.Mesh(b.build(), m);
        const pv = group(mesh);
        return { pv, side };
    });
    return { pivots, mats, flap(t, f = 12, a = 0.7) { for (const p of pivots) p.pv.rotation.x = p.side * (0.4 + Math.sin(t * f) * a); } };
}

const BUILDERS = {
    imp() {
        const b = new Builder();
        b.add(dsphere(0.12, 2.2, 1), { s: [0.3, 0.33, 0.26], color: DEMON, color2: DEMON2, grad: 'y' });
        b.add(sphere(), { p: [-0.04, -0.08, 0.1], s: [0.18, 0.2, 0.14], color: 0xb84a2a });     // belly
        b.add(dsphere(0.08, 3, 2), { p: [-0.28, 0.24, 0], s: [0.2, 0.19, 0.18], color: DEMON });
        b.add(sphere(10, 8), { p: [-0.44, 0.28, 0.08], s: 0.045, color: EYE, glow: 3 });
        b.add(sphere(10, 8), { p: [-0.44, 0.28, -0.08], s: 0.045, color: EYE, glow: 3 });
        b.add(box(), { p: [-0.45, 0.17, 0], s: [0.06, 0.03, 0.12], color: 0xff6020, glow: 1.5 });         // mouth glow
        for (const s of [1, -1]) {
            b.add(taperTube([V(-0.3, 0.38, s * 0.1), V(-0.22, 0.55, s * 0.15), V(-0.05, 0.62, s * 0.16)], 0.045, 0.005, 8, 8), { color: 0x2a1410, color2: 0xd8c8a0, grad: 'x' });
            limb(b, [-0.18, 0.02, s * 0.2], [-0.36, -0.2, s * 0.22], 0.035, { color: DEMON });
            b.add(cone(6), { p: [-0.4, -0.25, s * 0.22], r: [0, 0, 2.5], s: [0.03, 0.09, 0.03], color: 0xd8c8a0 });
            limb(b, [0.08, -0.22, s * 0.1], [0.1, -0.42, s * 0.12], 0.04, { color: DEMON2 });
        }
        b.add(taperTube([V(0.2, -0.1, 0), V(0.42, -0.2, 0), V(0.55, -0.05, 0), V(0.62, 0.12, 0)], 0.04, 0.012, 6, 12), { color: DEMON2 });
        b.add(cone(4), { p: [0.64, 0.17, 0], r: [0, 0, -0.4], s: [0.06, 0.12, 0.02], color: 0x2a0806 });
        const mat = litMat({ rough: 0.7, glowMul: 1.6 });
        const body = new THREE.Mesh(b.build(), mat);
        const wings = makeWingPair(0.55);
        for (const p of wings.pivots) { p.pv.position.set(0.02, 0.2, p.side * 0.12); body.add(p.pv); }
        const root = group(body);
        return finish(root, [mat, ...wings.mats], (e, t) => {
            wings.flap(t + e.id, 14, 0.75);
            body.rotation.z = Math.max(-0.5, Math.min(0.5, (e.vy || 0) * 0.05));
            body.position.y = Math.sin(t * 14 + e.id) * 0.04;
        });
    },

    fly() {
        const b = new Builder();
        b.add(sphere(), { s: [0.14, 0.11, 0.11], p: [-0.08, 0, 0], color: 0x1a0c08 });
        b.add(sphere(), { s: [0.2, 0.13, 0.13], p: [0.14, -0.02, 0], color: 0xff7a20, color2: 0xffd060, grad: 'x', glow: 1.5, glow2: 2.6 });
        b.add(sphere(8, 6), { s: 0.035, p: [-0.2, 0.04, 0.06], color: 0xff2010, glow: 3 });
        b.add(sphere(8, 6), { s: 0.035, p: [-0.2, 0.04, -0.06], color: 0xff2010, glow: 3 });
        const mat = litMat({ glowMul: 1.8, pulse: 6 });
        const body = new THREE.Mesh(b.build(), mat);
        const wb = new Builder();
        wb.add(sphere(10, 6), { s: [0.18, 0.02, 0.08], p: [0.05, 0, 0], color: 0xffc080, glow: 0.4 });
        const wm = litMat({ transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const w1 = new THREE.Mesh(wb.build(), wm), w2 = new THREE.Mesh(w1.geometry, wm);
        const p1 = group(w1), p2 = group(w2);
        p1.position.set(-0.04, 0.08, 0.05); p2.position.set(-0.04, 0.08, -0.05);
        const root = group(body, p1, p2);
        return finish(root, [mat, wm], (e, t) => { const a = Math.sin(t * 40 + e.id) * 0.9; p1.rotation.x = 0.6 + a; p2.rotation.x = -0.6 - a; });
    },

    skull() {
        const b = new Builder();
        b.add(dsphere(0.05, 3, 3), { s: [0.42, 0.4, 0.38], p: [0.05, 0.08, 0], color: BONE, color2: BONE2, grad: 'x' });
        b.add(sphere(), { p: [-0.18, -0.12, 0], s: [0.26, 0.2, 0.3], color: BONE });
        for (const s of [1, -1]) {
            b.add(sphere(), { p: [-0.32, 0.05, s * 0.14], s: [0.09, 0.11, 0.1], color: 0x1a0a06 });
            b.add(sphere(10, 8), { p: [-0.38, 0.05, s * 0.15], s: 0.05, color: 0xff7a18, glow: 3.5 });
            b.add(taperTube([V(0.0, 0.38, s * 0.22), V(0.18, 0.52, s * 0.3), V(0.38, 0.5, s * 0.32), V(0.5, 0.36, s * 0.3)], 0.07, 0.008, 8, 10), { color: 0x3a2418, color2: 0xe0d0b0, grad: 'x' });
        }
        b.add(cone(4), { p: [-0.42, -0.06, 0], r: [0, 0, Math.PI / 2], s: [0.05, 0.08, 0.03], color: 0x1a0a06 });
        const mat = litMat({ rough: 0.6, glowMul: 1.7 });
        const head = new THREE.Mesh(b.build(), mat);
        const jb = new Builder();
        jb.add(sphere(), { s: [0.24, 0.1, 0.26], color: BONE2 });
        for (let i = 0; i < 6; i++) jb.add(cone(4), { p: [-0.18 + (i % 2) * 0.03, 0.08, (i - 2.5) * 0.07], s: [0.025, 0.08, 0.025], color: 0xfff4e0 });
        const jaw = new THREE.Mesh(jb.build(), mat);
        const jp = group(jaw); jp.position.set(-0.12, -0.24, 0);
        const root = group(head, jp);
        return finish(root, [mat], (e, t) => { jp.rotation.z = -0.15 - Math.abs(Math.sin(t * 6 + e.id)) * 0.25; root.rotation.y = Math.sin(t * 2) * 0.2; });
    },

    eye() {
        const b = new Builder();
        const iris = new THREE.Color(0xff3a1a), pupil = new THREE.Color(0x050000), white = new THREE.Color(0xf0e0d0), vein = new THREE.Color(0xa01818);
        b.add(sphere(40, 30), {
            s: 1.0, tint: (x, y, z) => {
                const d = -x;
                if (d > 0.93) return pupil;
                if (d > 0.78) return iris.clone().lerp(new THREE.Color(0xffd030), (d - 0.78) / 0.15);
                const v = Math.abs(Math.sin(y * 9 + z * 7) * Math.cos(z * 11 - y * 3));
                return white.clone().lerp(vein, v > 0.92 ? 0.8 : 0);
            },
        });
        const eyeMat = litMat({ rough: 0.15, glowMul: 0.8 });
        // iris glow: a second shell with glow only on the iris
        const gb = new Builder();
        gb.add(sphere(32, 24), { s: 1.005, tint: (x) => (-x > 0.78 && -x < 0.93 ? new THREE.Color(0xff5020) : new THREE.Color(0x000000)), glow: 2.2 });
        const ball = new THREE.Mesh(b.build(), eyeMat);
        const glowShell = new THREE.Mesh(gb.build(), litMat({ transparent: true, opacity: 0.6, glowMul: 1.4 }));
        glowShell.material.blending = THREE.AdditiveBlending; glowShell.material.depthWrite = false;
        const look = group(ball, glowShell);
        // fleshy lids and tendrils
        const lb = new Builder();
        const lidGeo = new THREE.SphereGeometry(1.08, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
        displace(lidGeo, 0.04, 3, 4);
        lb.add(lidGeo, { color: 0x6a1a24, color2: 0x3a0810, grad: 'y' });
        const lidMat = litMat({ rough: 0.5, side: THREE.DoubleSide });
        const lidT = new THREE.Mesh(lb.build(), lidMat), lidB = new THREE.Mesh(lidT.geometry, lidMat);
        lidB.rotation.z = Math.PI;
        const tb = new Builder();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const z = Math.sin(a) * 0.6, y = Math.cos(a) * 0.6;
            tb.add(taperTube([V(0.6, y, z), V(1.2, y * 1.4, z * 1.4), V(1.7, y * 1.1 + 0.3 * Math.sin(i), z * 1.5), V(2.2, y * 1.5, z * 1.2)], 0.13, 0.02, 8, 12), { color: 0x6a1a24, color2: 0x2a0408, grad: 'x' });
        }
        const tent = new THREE.Mesh(tb.build(), lidMat);
        const root = group(look, lidT, lidB, tent);
        root.scale.setScalar(1.1);
        return finish(root, [eyeMat, lidMat, glowShell.material], (e, t) => {
            const a = e.look ?? Math.PI;
            look.rotation.z = a - Math.PI;
            look.rotation.y = Math.sin(t * 0.7) * 0.15;
            const blink = Math.max(0, Math.sin(t * 0.9 + e.id) - 0.96) * 25;
            lidT.rotation.z = -0.25 + blink * 0.5;
            lidB.rotation.z = Math.PI + 0.25 - blink * 0.5;
            tent.rotation.x = Math.sin(t * 1.4) * 0.2;
        });
    },

    turret() {
        const b = new Builder();
        b.add(dsphere(0.18, 2, 5), { s: [0.7, 0.4, 0.55], p: [0, -0.15, 0], color: 0x3a2a24, color2: 0x1a100c, grad: 'y' });
        for (let i = 0; i < 5; i++) b.add(cone(5), { p: [-0.5 + i * 0.25, 0.05, -0.3 + (i % 2) * 0.6], r: [0, 0, (i - 2) * 0.3], s: [0.06, 0.3, 0.06], color: 0xd8c8a0 });
        const mat = litMat({ rough: 0.8, glowMul: 1.8 });
        const base = new THREE.Mesh(b.build(), mat);
        const cb = new Builder();
        cb.add(dsphere(0.05, 3, 6), { s: [0.3, 0.28, 0.28], color: BONE, color2: BONE2, grad: 'x' });
        cb.add(cyl(0.7, 1, 12), { p: [0.4, 0, 0], r: [0, 0, -Math.PI / 2], s: [0.13, 0.5, 0.13], color: 0x2a2220 });
        cb.add(torus(0.3, 8, 16), { p: [0.65, 0, 0], r: [0, Math.PI / 2, 0], s: 0.11, color: 0xff6a20, glow: 2.5 });
        for (const s of [1, -1]) cb.add(sphere(8, 6), { p: [0.18, 0.1, s * 0.12], s: 0.04, color: 0xff4010, glow: 3 });
        const cannon = new THREE.Mesh(cb.build(), mat);
        const pivot = group(cannon); pivot.position.set(0, 0.18, 0);
        const root = group(base, pivot);
        return finish(root, [mat], (e) => {
            const flip = e.side === 'ceil';
            root.rotation.z = flip ? Math.PI : 0;
            const a = (e.look ?? Math.PI) - root.rotation.z;
            pivot.rotation.z = a;
        });
    },

    hound() {
        const mat = litMat({ rough: 0.75, glowMul: 1.8, pulse: 2.5 });
        const b = new Builder();
        const crack = (x, y, z) => new THREE.Color(Math.abs(Math.sin(x * 23 + z * 9) * Math.sin(y * 17)) > 0.93 ? 0xff5a10 : 0x1c1412);
        b.add(dsphere(0.1, 3, 7), { s: [0.55, 0.26, 0.24], color: 0x1c1412, tint: crack });
        b.add(dsphere(0.08, 3, 8), { p: [-0.55, 0.12, 0], s: [0.24, 0.18, 0.17], color: 0x221814 });
        b.add(sphere(), { p: [-0.74, 0.06, 0], s: [0.16, 0.08, 0.1], color: 0x2a1c18 });
        for (const s of [1, -1]) {
            b.add(sphere(8, 6), { p: [-0.7, 0.18, s * 0.08], s: 0.04, color: 0xff3a10, glow: 3.5 });
            b.add(cone(5), { p: [-0.5, 0.32, s * 0.09], r: [0, 0, 0.5], s: [0.05, 0.18, 0.05], color: 0x100806 });
        }
        for (let i = 0; i < 6; i++) b.add(cone(5), { p: [-0.3 + i * 0.12, 0.24, 0], r: [0, 0, 0.3], s: [0.04, 0.16 - i * 0.01, 0.04], color: 0xff5010, glow: 1.2 });
        b.add(taperTube([V(0.5, 0.05, 0), V(0.75, 0.2, 0), V(0.9, 0.35, 0)], 0.05, 0.01, 6, 8), { color: 0x1c1412, color2: 0xff6020, grad: 'x', glow: 0, glow2: 2 });
        const body = new THREE.Mesh(b.build(), mat);
        const legs = [];
        const lg = new Builder();
        limb(lg, [0, 0, 0], [0.05, -0.3, 0], 0.05, { color: 0x1c1412 });
        limb(lg, [0.05, -0.3, 0], [-0.04, -0.48, 0], 0.04, { color: 0x1c1412 });
        const legGeo = lg.build();
        for (const [x, z] of [[-0.35, 0.14], [-0.35, -0.14], [0.35, 0.14], [0.35, -0.14]]) {
            const l = new THREE.Mesh(legGeo, mat); const p = group(l); p.position.set(x, -0.1, z); legs.push(p); body.add(p);
        }
        const root = group(body);
        return finish(root, [mat], (e, t) => {
            const run = t * 14 + e.id;
            legs.forEach((p, i) => { p.rotation.z = Math.sin(run + (i % 2) * Math.PI + (i > 1 ? 0.6 : 0)) * 0.7; });
            body.rotation.z = (e.vh ?? 0) * -0.03;
        });
    },

    worm() {   // the head; segments are 'wormseg'
        const mat = litMat({ rough: 0.55, glowMul: 1.8 });
        const b = new Builder();
        b.add(dsphere(0.06, 3, 9), { s: [0.55, 0.36, 0.36], color: BONE, color2: BONE2, grad: 'x' });
        for (const s of [1, -1]) {
            b.add(sphere(10, 8), { p: [-0.3, 0.12, s * 0.2], s: 0.07, color: 0x80ff60, glow: 3 });
            b.add(taperTube([V(-0.4, -0.1, s * 0.18), V(-0.7, -0.05, s * 0.26), V(-0.9, 0.06, s * 0.14)], 0.06, 0.01, 6, 10), { color: BONE2 });
        }
        for (let i = 0; i < 5; i++) b.add(cone(5), { p: [0.1 - i * 0.1, 0.34, 0], r: [0, 0, 0.4], s: [0.05, 0.2, 0.05], color: 0xf0e4c8 });
        const head = new THREE.Mesh(b.build(), mat);
        const root = group(head);
        return finish(root, [mat], (e, t) => { root.rotation.z = Math.atan2(-(e.vy || 0), -(e.vx || -1)); });
    },

    wormseg() {
        const mat = litMat({ rough: 0.55, glowMul: 1.6 });
        const b = new Builder();
        b.add(torus(0.42, 10, 20), { s: 0.36, r: [0, Math.PI / 2, 0], color: BONE, color2: BONE2, grad: 'y' });
        b.add(sphere(), { s: [0.18, 0.3, 0.3], color: 0x7a6a52 });
        b.add(cone(5), { p: [0, 0.42, 0], s: [0.07, 0.3, 0.07], color: 0xf0e4c8 });
        b.add(cone(5), { p: [0, -0.42, 0], r: [Math.PI, 0, 0], s: [0.06, 0.22, 0.06], color: 0xf0e4c8 });
        for (const s of [1, -1]) b.add(taperTube([V(0, 0.1, s * 0.3), V(0.05, -0.2, s * 0.5), V(0.1, -0.5, s * 0.4)], 0.04, 0.01, 6, 8), { color: BONE2 });
        b.add(sphere(8, 6), { s: 0.06, p: [-0.2, 0, 0], color: 0x80ff60, glow: 2 });
        const root = new THREE.Mesh(b.build(), mat);
        return finish(group(root), [mat], (p, t) => { root.rotation.x = t * 0.5 + (p.k ?? 0); });
    },

    wraith() {
        const mat = litMat({ rough: 0.9, transparent: true, opacity: 0.9, side: THREE.DoubleSide, glowMul: 2, rimMul: 2.5 });
        const b = new Builder();
        const robe = lathe([[0.0, 0.62], [0.18, 0.55], [0.26, 0.35], [0.3, 0.05], [0.34, -0.3], [0.42, -0.6], [0.5, -0.8]], 20);
        displace(robe, 0.07, 4, 3);
        b.add(robe, { r: [0, 0, 0.5], color: 0x1a2a2a, color2: 0x0a1212, grad: 'y', glow: 0.25, glow2: 0 });
        b.add(sphere(), { p: [-0.12, 0.4, 0], s: [0.16, 0.18, 0.15], color: 0x000000 });
        for (const s of [1, -1]) b.add(sphere(8, 6), { p: [-0.24, 0.44, s * 0.06], s: 0.035, color: 0x80fff0, glow: 4 });
        for (const s of [1, -1]) b.add(taperTube([V(-0.15, 0.2, s * 0.2), V(-0.45, 0.1, s * 0.3), V(-0.7, 0.18, s * 0.2)], 0.06, 0.01, 6, 10), { color: 0x1a2a2a, color2: 0x60e0d0, grad: 'x', glow: 0, glow2: 1.5 });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e, t) => {
            const ph = e.phase ?? 1;
            mat.opacity = 0.25 + ph * 0.7;
            body.rotation.x = Math.sin(t * 2 + e.id) * 0.2;
            body.position.y = Math.sin(t * 2.4) * 0.1;
        });
    },

    carrier() {
        const mat = litMat({ rough: 0.7, glowMul: 1.6 });
        const b = new Builder();
        b.add(dsphere(0.1, 2.5, 11), { s: [0.5, 0.42, 0.38], p: [0.1, 0.25, 0], color: 0x3a2a3a, color2: 0x1a1018, grad: 'y' });
        b.add(sphere(), { p: [-0.32, 0.45, 0], s: [0.18, 0.16, 0.16], color: 0x4a3040 });
        for (const s of [1, -1]) {
            b.add(sphere(8, 6), { p: [-0.46, 0.48, s * 0.07], s: 0.035, color: 0xff60ff, glow: 3 });
            limb(b, [-0.1, 0.15, s * 0.3], [-0.3, -0.25, s * 0.3], 0.05, { color: 0x3a2a3a });
            b.add(cone(5), { p: [-0.32, 0.6, s * 0.1], r: [0, 0, 0.5], s: [0.04, 0.22, 0.04], color: 0xd8c8a0 });
        }
        // the reliquary cage
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            b.add(cyl(1, 1, 6), { p: [-0.3 + Math.cos(a) * 0.26, -0.55, Math.sin(a) * 0.26], s: [0.018, 0.5, 0.018], color: 0xc8a040, glow: 0.3 });
        }
        b.add(cyl(1, 1, 16), { p: [-0.3, -0.3, 0], s: [0.3, 0.05, 0.3], color: 0xa88030 });
        b.add(cyl(1, 1, 16), { p: [-0.3, -0.8, 0], s: [0.3, 0.05, 0.3], color: 0xa88030 });
        const body = new THREE.Mesh(b.build(), mat);
        const inside = new THREE.Mesh(octa(0), glowMat(0xffffff, 0.95));
        inside.scale.set(0.13, 0.2, 0.13); inside.position.set(-0.3, -0.55, 0);
        const wings = makeWingPair(0.7, 0x2a1a2a);
        for (const p of wings.pivots) { p.pv.position.set(0.2, 0.5, p.side * 0.18); body.add(p.pv); }
        const root = group(body, inside);
        return finish(root, [mat, ...wings.mats, inside.material], (e, t) => {
            inside.material.color.setHex(ITEM_COLORS[e.item] ?? 0xffffff);
            inside.rotation.y = t * 3;
            wings.flap(t, 8, 0.5);
        });
    },

    mine() {
        const mat = litMat({ rough: 0.4, metal: 0.7, glowMul: 2, pulse: 4 });
        const b = new Builder();
        b.add(sphere(20, 14), { s: 0.36, color: 0x2a2624, tint: (x, y, z) => new THREE.Color(Math.abs(y) < 0.12 ? 0xff3010 : 0x2a2624) , glow: 0 });
        b.add(torus(0.1, 8, 24), { s: 0.37, r: [Math.PI / 2, 0, 0], color: 0xff3a10, glow: 2.5 });
        const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0], [0, 0.7, 0.7], [0, -0.7, -0.7]];
        for (const [x, y, z] of dirs) {
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
            const m = new THREE.Matrix4().compose(new THREE.Vector3(x * 0.42, y * 0.42, z * 0.42), q, new THREE.Vector3(0.07, 0.24, 0.07));
            b.add(cone(6), { m, color: 0x4a4440 });
        }
        const body = new THREE.Mesh(b.build(), mat);
        const chain = new THREE.Mesh(cyl(1, 1, 6), litMat({ rough: 0.4, metal: 0.8 }));
        chain.visible = false;
        const root = group(body);
        const model = finish(root, [mat, chain.material], (e, t) => {
            body.rotation.y = t * 0.8; body.rotation.z = t * 0.5;
            if (e.o?.hang && e.anchorX !== undefined) {
                chain.visible = true;
                const dx = e.anchorX - e.x, dy = e.anchorY - e.y, L = Math.hypot(dx, dy);
                chain.position.set(dx / 2, dy / 2, 0);
                chain.scale.set(0.04, L, 0.04);
                chain.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
            } else chain.visible = false;
        });
        root.add(chain);
        return model;
    },

    bull() {
        const mat = litMat({ rough: 0.6, metal: 0.25, glowMul: 1.8 });
        const b = new Builder();
        b.add(dsphere(0.1, 2, 12), { s: [0.95, 0.62, 0.55], p: [0.3, 0, 0], color: 0x3a1610, color2: 0x1a0806, grad: 'y' });
        b.add(dsphere(0.06, 3, 13), { s: [0.5, 0.42, 0.42], p: [-0.65, 0.05, 0], color: 0x2a1410 });
        for (let i = 0; i < 4; i++) b.add(box(), { p: [0.3 - i * 0.3, 0.55, 0], r: [0, 0, 0.2], s: [0.32, 0.12, 0.6], color: 0x5a5450 });     // armor plates
        for (const s of [1, -1]) {
            b.add(taperTube([V(-0.75, 0.32, s * 0.3), V(-1.0, 0.55, s * 0.6), V(-1.35, 0.5, s * 0.55), V(-1.55, 0.25, s * 0.35)], 0.13, 0.015, 10, 14), { color: 0x2a1a10, color2: 0xf0e0c0, grad: 'x' });
            b.add(sphere(8, 6), { p: [-1.05, 0.12, s * 0.2], s: 0.06, color: 0xff3a10, glow: 4 });
            b.add(sphere(8, 6), { p: [-1.12, -0.12, s * 0.09], s: 0.05, color: 0xff7020, glow: 2 });
        }
        b.add(torus(0.25, 8, 16), { p: [-1.12, -0.22, 0], r: [0, Math.PI / 2, 0], s: 0.1, color: 0xc8a040, metal: 1 });
        const body = new THREE.Mesh(b.build(), mat);
        const lg = new Builder();
        limb(lg, [0, 0, 0], [0, -0.45, 0], 0.11, { color: 0x2a1410 });
        lg.add(box(), { p: [0, -0.5, 0], s: [0.2, 0.08, 0.2], color: 0x101010 });
        const lgeo = lg.build();
        const legs = [];
        for (const [x, z] of [[-0.35, 0.3], [-0.35, -0.3], [0.7, 0.3], [0.7, -0.3]]) { const l = new THREE.Mesh(lgeo, mat); const p = group(l); p.position.set(x, -0.45, z); legs.push(p); body.add(p); }
        const root = group(body);
        return finish(root, [mat], (e, t) => {
            const run = e.t > (e.warn ?? 1) ? t * 16 : t * 3;
            legs.forEach((p, i) => { p.rotation.z = Math.sin(run + i * 1.6) * (e.t > (e.warn ?? 1) ? 0.8 : 0.15); });
            root.rotation.y = e.from === 'left' ? Math.PI : 0;
            body.position.y = Math.abs(Math.sin(run)) * 0.08;
        });
    },

    lancer() {
        const mat = litMat({ rough: 0.65, glowMul: 1.8 });
        const b = new Builder();
        b.add(lathe([[0, 0.55], [0.15, 0.45], [0.22, 0.2], [0.28, -0.2], [0.36, -0.55], [0.0, -0.6]], 16), { color: 0x5a1010, color2: 0x200606, grad: 'y' });
        b.add(sphere(), { p: [-0.05, 0.58, 0], s: [0.17, 0.2, 0.17], color: 0xd0c0a0 });      // mask
        b.add(sphere(12, 10), { p: [-0.18, 0.6, 0], s: 0.07, color: 0xff2020, glow: 4 });
        for (const s of [1, -1]) b.add(taperTube([V(0, 0.72, s * 0.08), V(0.1, 0.95, s * 0.15), V(0.3, 1.05, s * 0.1)], 0.04, 0.005, 6, 8), { color: 0x1a0606 });
        limb(b, [-0.1, 0.25, 0.2], [-0.45, 0.05, 0.22], 0.05, { color: 0x5a1010 });
        b.add(cyl(1, 1, 8), { p: [-0.5, 0.0, 0.22], s: [0.03, 1.4, 0.03], color: 0x3a2a1a });
        b.add(octa(0), { p: [-0.5, 0.78, 0.22], s: [0.08, 0.18, 0.08], color: 0xff4040, glow: 3 });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e, t) => { body.position.y = Math.sin(t * 2.2 + e.id) * 0.08; });
    },

    pod() {
        const mat = litMat({ rough: 0.35, glowMul: 1.8, pulse: 3 });
        const b = new Builder();
        const veins = (x, y, z) => new THREE.Color(Math.abs(Math.sin(x * 12 + y * 5) * Math.cos(z * 9 - y * 8)) > 0.9 ? 0xff7080 : FLESH);
        b.add(dsphere(0.12, 2.5, 14), { s: [0.65, 0.75, 0.6], p: [0, 0.3, 0], tint: veins, glow: 0.15 });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            b.add(cone(6), { p: [Math.cos(a) * 0.25, 1.0, Math.sin(a) * 0.25], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], s: [0.12, 0.4, 0.06], color: 0x8a2030 });
        }
        b.add(sphere(), { p: [0, 0.85, 0], s: [0.22, 0.12, 0.22], color: 0xffa060, glow: 2.5 });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e, t) => {
            root.rotation.z = e.side === 'ceil' ? Math.PI : 0;
            const s = 1 + Math.sin(t * 5 + e.id) * 0.05;
            body.scale.set(s, 2 - s, s);
        });
    },

    lantern() {
        const mat = litMat({ rough: 0.4, metal: 0.6, glowMul: 1.6 });
        const b = new Builder();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.add(cyl(1, 1, 6), { p: [Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28], s: [0.025, 0.7, 0.025], color: 0x3a4a48 }); }
        b.add(cone(6), { p: [0, 0.5, 0], s: [0.38, 0.32, 0.38], color: 0x2a3432 });
        b.add(cyl(1, 1, 6), { p: [0, -0.38, 0], s: [0.32, 0.06, 0.32], color: 0x2a3432 });
        b.add(torus(0.2, 6, 14), { p: [0, 0.75, 0], s: 0.1, color: 0x3a4a48 });
        const cage = new THREE.Mesh(b.build(), mat);
        const flame = new THREE.Mesh(sphere(16, 12), glowMat(0x60ffd8, 0.95));
        flame.scale.set(0.16, 0.22, 0.16);
        const halo = new THREE.Mesh(sphere(12, 10), glowMat(0x40c0b0, 0.25));
        halo.scale.setScalar(0.45);
        const root = group(cage, flame, halo);
        return finish(root, [mat, flame.material, halo.material], (e, t) => {
            root.rotation.z = Math.sin(t * 1.5 + e.id) * 0.15;
            flame.scale.set(0.16, 0.22 + Math.sin(t * 13) * 0.04, 0.16);
        });
    },

    crystal() {
        const mat = litMat({ rough: 0.08, metal: 0.1, glowMul: 1.4, transparent: true, opacity: 0.92, rimMul: 2.2 });
        const b = new Builder();
        const pts = [[0, 0, 0, 0.62, 0], [0.2, 0.15, 0.1, 0.42, 0.6], [-0.18, 0.1, -0.12, 0.36, -0.7], [0.05, -0.2, 0.15, 0.34, 2.4], [-0.1, -0.15, -0.1, 0.3, -2.2]];
        for (const [x, y, z, s, r] of pts) b.add(octa(0), { p: [x, y, z], r: [0.3, r, r * 0.5], s: [s * 0.4, s, s * 0.4], color: 0xbfe8ff, color2: ICE, grad: 'y', glow: 0.35, glow2: 0.9 });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e, t) => { body.rotation.z = e.spin ?? t; body.rotation.y = t * 0.7; });
    },

    tentacle() {  // the tip; the joints are 'tentseg'
        const mat = litMat({ rough: 0.35, glowMul: 1.8, pulse: 3 });
        const b = new Builder();
        b.add(dsphere(0.1, 3, 15), { s: [0.5, 0.42, 0.42], color: FLESH, color2: 0x5a1020, grad: 'x' });
        b.add(sphere(), { p: [-0.32, 0, 0], s: [0.18, 0.2, 0.2], color: 0xffd040, glow: 2.4 });
        b.add(sphere(), { p: [-0.42, 0, 0], s: [0.06, 0.12, 0.06], color: 0x100000 });
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.add(cone(5), { p: [-0.2, Math.cos(a) * 0.3, Math.sin(a) * 0.3], r: [a, 0, Math.PI / 2], s: [0.06, 0.25, 0.06], color: 0xf0d8d0 }); }
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e) => { root.rotation.z = Math.atan2(e.y - (e.baseY ?? e.y - 1), e.x - (e.baseX ?? e.x)) - Math.PI; });
    },

    tentseg() {
        const mat = litMat({ rough: 0.35, glowMul: 1.6 });
        const b = new Builder();
        const veins = (x, y, z) => new THREE.Color(Math.abs(Math.sin(x * 14 + z * 7) * Math.cos(y * 11)) > 0.9 ? 0xff8090 : 0x9a3040);
        b.add(dsphere(0.1, 3, 16), { s: [0.5, 0.5, 0.5], tint: veins, glow: 0.12 });
        const root = new THREE.Mesh(b.build(), mat);
        return finish(group(root), [mat], (p, t) => { root.scale.setScalar((p.r ?? 0.4) * 2.2 * (1 + Math.sin(t * 4 + (p.k ?? 0)) * 0.05)); });
    },

    gargoyle() {
        const mat = litMat({ rough: 0.95, glowMul: 2 });
        const b = new Builder();
        b.add(dsphere(0.1, 2, 17), { s: [0.42, 0.45, 0.36], color: 0x6a6670, color2: 0x3a3840, grad: 'y' });
        b.add(dsphere(0.08, 3, 18), { p: [-0.3, 0.42, 0], s: [0.2, 0.2, 0.2], color: 0x6a6670 });
        for (const s of [1, -1]) {
            b.add(sphere(8, 6), { p: [-0.46, 0.46, s * 0.08], s: 0.04, color: 0xffb030, glow: 3.5 });
            b.add(taperTube([V(-0.28, 0.58, s * 0.1), V(-0.2, 0.8, s * 0.16), V(0.0, 0.88, s * 0.12)], 0.05, 0.005, 6, 8), { color: 0x4a4650 });
            limb(b, [-0.15, 0.0, s * 0.25], [-0.32, -0.35, s * 0.28], 0.06, { color: 0x5a5660 });
            limb(b, [0.15, -0.2, s * 0.2], [0.05, -0.45, s * 0.25], 0.07, { color: 0x5a5660 });
        }
        const body = new THREE.Mesh(b.build(), mat);
        const wings = makeWingPair(0.85, 0x4a4650);
        for (const p of wings.pivots) { p.pv.position.set(0.1, 0.35, p.side * 0.2); body.add(p.pv); }
        const root = group(body);
        return finish(root, [mat, ...wings.mats], (e, t) => {
            const flip = e.side === 'ceil' && e.stone;
            root.rotation.z = flip ? Math.PI : 0;
            mat.userData.glowMul.value = e.stone ? 0.15 : 2;
            if (e.stone) for (const p of wings.pivots) p.pv.rotation.x = p.side * 0.15;
            else wings.flap(t, 11, 0.7);
        });
    },

    seraphling() {
        const m = buildAngel({
            robe: 0x2a2a34, robe2: 0x101018, trim: 0x8a2030, skin: 0xb8b0c0, hair: 0x202028, hair2: 0x504858, hairGlow: 0.05,
            wing: 0x3a3a48, wingTip: 0x8a2030, wingGlow: 0.6, eyes: 0xff3030, halo: 'broken', haloCol: 0xff4040, tattered: true,
        });
        m.root.scale.setScalar(0.85);
        m.root.rotation.y = Math.PI;
        m.update = (e, t) => { m.flap(t + e.id, 1.3, 0.5); m.lean.rotation.z = -(e.vy || 0) * 0.04; };
        return m;
    },

    hand() {
        const mat = litMat({ rough: 0.6, glowMul: 1.8, transparent: false });
        const b = new Builder();
        const pale = 0x8ab0b0, pale2 = 0x3a5a60;
        limb(b, [0, -2.6, 0], [0, -0.4, 0], 0.2, { color: pale2 });
        b.add(dsphere(0.05, 3, 19), { s: [0.32, 0.3, 0.14], color: pale });
        for (let i = 0; i < 4; i++) {
            const x = -0.22 + i * 0.15;
            b.add(taperTube([V(x, 0.2, 0), V(x * 1.1, 0.5, 0.05), V(x * 1.15 - 0.05, 0.8, 0.1), V(x * 1.1 - 0.12, 0.98, 0.14)], 0.065, 0.025, 6, 10), { color: pale, color2: 0xd0f0f0, grad: 'y', glow: 0, glow2: 0.6 });
        }
        b.add(taperTube([V(0.3, 0, 0), V(0.45, 0.25, 0.05), V(0.5, 0.5, 0.1)], 0.07, 0.03, 6, 8), { color: pale });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e, t) => {
            body.rotation.z = Math.sin(t * 3 + e.id) * 0.12;
            root.visible = (e.rise ?? 1) > 0.02;
        });
    },

    wheel() {
        const mat = litMat({ rough: 0.35, metal: 0.8, glowMul: 1.8 });
        const b = new Builder();
        b.add(torus(0.16, 10, 32), { s: 0.65, color: 0x4a4440 });
        b.add(cyl(1, 1, 16), { r: [Math.PI / 2, 0, 0], s: [0.2, 0.3, 0.2], color: 0x2a2624 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.add(box(), { p: [Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0], r: [0, 0, a], s: [0.62, 0.07, 0.07], color: 0x3a3634 }); }
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.add(cone(6), { p: [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0], r: [0, 0, a - Math.PI / 2], s: [0.08, 0.3, 0.08], color: 0x8a8480 }); }
        b.add(sphere(), { s: 0.12, color: 0xff4010, glow: 3 });
        const body = new THREE.Mesh(b.build(), mat);
        const root = group(body);
        return finish(root, [mat], (e) => { body.rotation.z = e.spin ?? 0; });
    },

    crusher() {
        const mat = litMat({ rough: 0.45, metal: 0.75, glowMul: 1.8 });
        const b = new Builder();
        b.add(box(), { p: [0, -0.45, 0], s: [2.0, 0.9, 1.4], color: 0x4a4440, color2: 0x2a2624, grad: 'y' });
        for (let i = 0; i < 6; i++) b.add(cone(6), { p: [-0.85 + i * 0.34, -1.05, 0], r: [Math.PI, 0, 0], s: [0.13, 0.32, 0.13], color: 0x9a948c });
        b.add(box(), { p: [0, -0.2, 0.71], s: [1.6, 0.2, 0.02], color: 0xff5a10, glow: 1.8 });
        const head = new THREE.Mesh(b.build(), mat);
        const shaft = new THREE.Mesh(cyl(1, 1, 12), mat);
        const sb = new Builder(); sb.add(cyl(1, 1, 12), { color: 0x6a645c });
        shaft.geometry = sb.build();
        const root = group(head, shaft);
        return finish(root, [mat], (e) => {
            // root sits at the head's bottom (e.y); shaft runs up to the ceiling
            head.position.y = 0;
            const ext = e.ext ?? 1;
            shaft.position.y = ext / 2;
            shaft.scale.set(0.3, ext + 1, 0.3);
        });
    },
};

export function buildEnemy(kind) {
    const f = BUILDERS[kind];
    if (!f) return null;
    return f();
}

// =========================================================================== blocks (terrain obstacles)
export function buildBlock(b) {
    const h = b.y1 - b.y0, w = b.w;
    const bl = new Builder();
    let matOpts = { rough: 0.8, glowMul: 1.6 };
    switch (b.kind) {
        case 'bone':
        case 'bonegate': {
            const n = Math.ceil(h / 0.55);
            for (let i = 0; i < n; i++) {
                const y = b.y0 + (i + 0.5) * (h / n);
                bl.add(dsphere(0.08, 3, 20 + (i % 4)), { p: [0, y, 0], s: [w * 0.5, h / n * 0.55, 0.7], color: BONE, color2: BONE2, grad: 'y' });
                if (b.kind === 'bonegate') bl.add(cone(5), { p: [-w * 0.5, y, 0], r: [0, 0, Math.PI / 2], s: [0.08, 0.35, 0.08], color: 0xfff0e0 });
            }
            if (b.kind === 'bonegate') bl.add(box(), { p: [0, b.y0 + h / 2, 0], s: [w * 0.4, h, 0.4], color: 0x5a4a38 });
            break;
        }
        case 'pipe': {
            bl.add(cyl(1, 1, 20), { p: [0, b.y0 + h / 2, 0], s: [w * 0.5, h, w * 0.5], color: 0x5a4a3a, color2: 0x2a2018, grad: 'y' });
            for (let y = b.y0 + 0.5; y < b.y1; y += 1.2) bl.add(torus(0.18, 8, 20), { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: w * 0.52, color: 0x8a6a3a, metal: 1 });
            bl.add(box(), { p: [-w * 0.5, b.y0 + h / 2, 0.2], s: [0.05, h * 0.8, 0.12], color: 0xff6a10, glow: 1.5 });
            matOpts = { rough: 0.4, metal: 0.7, glowMul: 1.6 };
            break;
        }
        case 'membrane': {
            const g = new THREE.PlaneGeometry(w, h, 6, Math.ceil(h * 2));
            displace(g, 0.25, 1.2, b.id % 9);
            bl.add(g, { p: [0, b.y0 + h / 2, 0], tint: (x, y, z) => new THREE.Color(Math.abs(Math.sin(x * 6 + y * 3)) > 0.93 ? 0xff9090 : 0xa83040), glow: 0.35 });
            bl.add(box(), { p: [0, b.y0 + h / 2, -0.1], s: [w * 0.6, h, 0.5], color: 0x6a1828, glow: 0.1 });
            matOpts = { rough: 0.3, glowMul: 1.4, side: THREE.DoubleSide, pulse: 2 };
            break;
        }
        case 'ice': {
            const n = Math.ceil(h / 1.2);
            for (let i = 0; i < n; i++) {
                const y = b.y0 + (i + 0.5) * (h / n);
                bl.add(octa(1), { p: [((i * 37) % 7 - 3) * 0.05, y, 0], r: [0.2, i, 0.1], s: [w * 0.55, h / n * 0.75, 0.9], color: 0xcaf0ff, color2: 0x6ab8e8, grad: 'y', glow: 0.25 });
            }
            matOpts = { rough: 0.06, glowMul: 1.4, transparent: true, opacity: 0.9, rimMul: 2 };
            break;
        }
        default: { // stone column
            bl.add(cyl(1, 1, 16), { p: [0, b.y0 + h / 2, 0], s: [w * 0.45, h, w * 0.45], color: 0x3a4a4a, color2: 0x1a2424, grad: 'y' });
            bl.add(box(), { p: [0, b.y1 - 0.2, 0], s: [w * 1.2, 0.4, w * 1.2], color: 0x4a5a58 });
            for (let y = b.y0 + 0.6; y < b.y1 - 0.5; y += 1.5) bl.add(torus(0.12, 6, 16), { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: w * 0.47, color: 0x2a6a60, glow: 0.4 });
        }
    }
    const mat = litMat(matOpts);
    const mesh = new THREE.Mesh(bl.build(), mat);
    return finish(group(mesh), [mat], () => {});
}
