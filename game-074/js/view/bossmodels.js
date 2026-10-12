// The seven bosses as procedural models. Each factory returns
//   { root, mats, update(b, t, dt, view) }
// The root is placed at the boss's (x, y); parts that move freely in the sim
// (wyrm vertebrae, Malphas's hands) are positioned from the sim each frame.
// A destroyed part is hidden; the view throws the explosion.

import * as THREE from 'three';
import { Builder, litMat, glowMat, sphere, cyl, cone, box, torus, octa, lathe, dsphere, taperTube, displace } from './lib.js';
import { buildAngel, limb, group, finish } from './models.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const partOf = (b, n) => b.parts.find((p) => p.name === n);

function cracks(base, glow, scale = 9, thr = 0.9) {
    const a = new THREE.Color(base), g = new THREE.Color(glow);
    return (x, y, z) => (Math.abs(Math.sin(x * scale + z * 4.1) * Math.sin(y * scale * 0.8 - z * 2.3)) > thr ? g : a);
}

/** Show/hide a mesh with the part's life; returns whether it is alive. */
function live(mesh, part) { mesh.visible = !!part && part.alive; return mesh.visible; }

// ============================================================================ 1. Gorrmaw
function gorrmaw() {
    const mat = litMat({ rough: 0.7, glowMul: 2.2, pulse: 1.5 });
    const b = new Builder();
    const crk = cracks(0x4a140c, 0xff6a14, 3.2, 0.93);
    b.add(dsphere(0.1, 1.2, 31, 36, 26), { p: [0.6, 1.0, 0], s: [2.6, 2.3, 2.2], tint: crk, glow: 0.0 });
    b.add(dsphere(0.08, 1.6, 32), { p: [-1.25, 1.85, 0], s: [1.2, 0.55, 1.75], color: 0x3a0e08 });
    b.add(dsphere(0.08, 1.4, 33), { p: [-1.5, 0.05, 0], s: [1.55, 0.9, 1.35], tint: crk });
    for (const s of [1, -1]) {
        b.add(sphere(), { p: [-1.85, 1.35, s * 0.75], s: [0.42, 0.36, 0.36], color: 0x0a0202 });
        b.add(sphere(14, 10), { p: [-2.05, 1.38, s * 0.8], s: 0.28, color: 0xffb020, glow: 4.5 });
        b.add(sphere(10, 8), { p: [-2.95, 0.3, s * 0.3], s: 0.12, color: 0xff5010, glow: 3 });     // nostrils
    }
    for (let i = 0; i < 7; i++) for (const s of [1, -1]) {
        b.add(cone(6), { p: [-2.9 + i * 0.32, -0.75, s * (0.95 - i * 0.03)], r: [Math.PI, 0, 0], s: [0.11, 0.5 - Math.abs(i - 2) * 0.05, 0.11], color: 0xf0e0c0 });
    }
    // spines down the back of the skull
    for (let i = 0; i < 6; i++) b.add(cone(6), { p: [1.8 + i * 0.25, 2.6 - i * 0.55, 0], r: [0, 0, -0.8 - i * 0.15], s: [0.18, 0.9, 0.18], color: 0x2a0806, color2: 0xff5010, grad: 'y', glow: 0, glow2: 1.5 });
    const skull = new THREE.Mesh(b.build(), mat);

    const nb = new Builder();
    nb.add(dsphere(0.14, 1, 34), { p: [1.9, -4.6, 0], s: [2.1, 3.8, 1.9], tint: crk });
    for (let i = 0; i < 5; i++) nb.add(cone(6), { p: [3.6, -2 - i * 1.1, 0], r: [0, 0, -1.3], s: [0.2, 0.9, 0.2], color: 0x2a0806 });
    const neck = new THREE.Mesh(nb.build(), mat);

    const jb = new Builder();
    jb.add(dsphere(0.08, 1.5, 35), { s: [1.55, 0.55, 1.3], p: [-1.1, -0.2, 0], tint: crk });
    for (let i = 0; i < 7; i++) for (const s of [1, -1]) jb.add(cone(6), { p: [-2.4 + i * 0.3, 0.32, s * (0.9 - i * 0.03)], s: [0.1, 0.42, 0.1], color: 0xf0e0c0 });
    const jaw = new THREE.Mesh(jb.build(), mat);
    const jawPivot = group(jaw); jawPivot.position.set(0.3, -1.5, 0);

    const mouth = new THREE.Mesh(sphere(20, 14), glowMat(0xffa030, 0.95));
    const mouthGlow = new THREE.Mesh(sphere(16, 12), glowMat(0xff5010, 0.35));

    const horns = {};
    for (const [name, pts] of [
        ['hornL', [V(-0.6, 2.6, 0.9), V(-1.0, 3.6, 1.3), V(-1.8, 4.2, 1.2), V(-2.3, 3.8, 0.9)]],
        ['hornR', [V(0.6, 3.0, -0.9), V(1.0, 4.2, -1.2), V(1.9, 4.8, -1.1), V(2.8, 4.4, -0.8)]],
    ]) {
        const hb = new Builder();
        hb.add(taperTube(pts, 0.42, 0.04, 12, 20), { color: 0x1a0806, color2: 0xffd0a0, grad: 'y', glow: 0, glow2: 0.4 });
        horns[name] = new THREE.Mesh(hb.build(), mat);
    }
    const root = group(neck, skull, jawPivot, mouth, mouthGlow, horns.hornL, horns.hornR);
    return finish(root, [mat, mouth.material, mouthGlow.material], (bs, t) => {
        jawPivot.rotation.z = (bs.open ?? 0) * 0.55;
        const c = partOf(bs, 'core');
        mouth.position.set(c.ox + 0.3, c.oy - 0.2, 0);
        const k = 0.35 + (bs.open ?? 0) * 0.55 + Math.sin(t * 20) * 0.03;
        mouth.scale.set(k * 1.1, k * 0.9, k);
        mouthGlow.position.copy(mouth.position); mouthGlow.scale.setScalar(k * 2.2);
        live(horns.hornL, partOf(bs, 'hornL'));
        live(horns.hornR, partOf(bs, 'hornR'));
        skull.rotation.z = Math.sin(t * 0.9) * 0.03;
    });
}

// ============================================================================ 2. the Ossuary Wyrm
function wyrm() {
    const mat = litMat({ rough: 0.55, glowMul: 1.9 });
    const hb = new Builder();
    hb.add(dsphere(0.06, 2, 41, 32, 22), { s: [1.2, 0.72, 0.72], color: 0xe8dcc0, color2: 0x9a8a6a, grad: 'x' });
    hb.add(dsphere(0.05, 2.5, 42), { p: [-0.9, -0.2, 0], s: [0.7, 0.36, 0.55], color: 0xd8ccb0 });
    for (const s of [1, -1]) {
        hb.add(sphere(), { p: [-0.55, 0.22, s * 0.42], s: [0.26, 0.22, 0.16], color: 0x050803 });
        hb.add(sphere(12, 10), { p: [-0.65, 0.24, s * 0.46], s: 0.13, color: 0x90ff60, glow: 4 });
        hb.add(taperTube([V(-0.9, -0.4, s * 0.45), V(-1.5, -0.35, s * 0.7), V(-2.0, -0.05, s * 0.5), V(-2.1, 0.25, s * 0.25)], 0.12, 0.015, 8, 14), { color: 0xc8bca0, color2: 0xfff8e8, grad: 'x' });
        hb.add(taperTube([V(0.3, 0.55, s * 0.3), V(0.9, 1.1, s * 0.6), V(1.7, 1.2, s * 0.6), V(2.3, 0.8, s * 0.4)], 0.16, 0.02, 8, 14), { color: 0x6a5a40, color2: 0xf0e4c8, grad: 'x' });
    }
    for (let i = 0; i < 8; i++) hb.add(cone(5), { p: [-1.2 + i * 0.15, -0.5, (i - 3.5) * 0.11], r: [Math.PI, 0, 0], s: [0.04, 0.22, 0.04], color: 0xffffff });
    const head = new THREE.Mesh(hb.build(), mat);
    const headPivot = group(head);

    const sb = new Builder();
    sb.add(torus(0.4, 12, 24), { s: 0.62, r: [0, Math.PI / 2, 0], color: 0xe8dcc0, color2: 0x8a7a5a, grad: 'y' });
    sb.add(dsphere(0.05, 3, 43), { s: [0.32, 0.5, 0.5], color: 0x6a5a40 });
    sb.add(cone(6), { p: [0, 0.8, 0], s: [0.12, 0.6, 0.12], color: 0xf0e4c8 });
    for (const s of [1, -1]) sb.add(taperTube([V(0, 0.2, s * 0.5), V(0.1, -0.3, s * 0.95), V(0.25, -0.9, s * 0.75), V(0.35, -1.1, s * 0.4)], 0.07, 0.015, 6, 10), { color: 0xd8ccb0 });
    sb.add(sphere(10, 8), { p: [-0.3, 0, 0], s: 0.1, color: 0x90ff60, glow: 2.5 });
    const segGeo = sb.build();
    const segs = [];
    const holder = new THREE.Group();
    for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(segGeo, mat);
        m.scale.setScalar(1 - i * 0.03);
        segs.push(m); holder.add(m);
    }
    const root = group(headPivot);
    const model = finish(root, [mat], (bs, t) => {
        // root follows the head; vertebrae are placed in root-local space
        headPivot.rotation.z = (bs.ang ?? Math.PI) + Math.PI;
        const head0 = bs.parts[0];
        for (let i = 0; i < segs.length; i++) {
            const p = bs.parts[i + 1], prev = bs.parts[i];
            const m = segs[i];
            m.visible = p.alive;
            m.position.set(p.x - head0.x, p.y - head0.y, -0.1 - i * 0.01);
            m.rotation.z = Math.atan2(prev.y - p.y, prev.x - p.x) + Math.PI;
            m.rotation.x = t * 0.6 + i * 0.4;
        }
    });
    root.add(holder);
    return model;
}

// ============================================================================ 3. the Iron Penitent
function penitent() {
    const iron = litMat({ rough: 0.38, metal: 0.82, glowMul: 2, pulse: 2 });
    const b = new Builder();
    const rust = (x, y, z) => new THREE.Color(0x4a4440).lerp(new THREE.Color(0x6a3a1a), Math.abs(Math.sin(x * 3 + y * 2.3 + z)) * 0.6);
    b.add(cyl(1, 1, 28), { p: [1.3, 0, 0], r: [Math.PI / 2, 0, 0], s: [2.7, 2.2, 2.7], tint: rust });
    b.add(cyl(1, 1, 28), { p: [1.3, 0, 1.15], r: [Math.PI / 2, 0, 0], s: [2.2, 0.2, 2.2], color: 0x2a2624 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.add(sphere(8, 6), { p: [1.3 + Math.cos(a) * 2.45, Math.sin(a) * 2.45, 1.12], s: 0.09, color: 0x8a7a5a }); }
    // the furnace mouth behind the plates
    b.add(cyl(1, 1, 24), { p: [-0.6, 0, 0], r: [0, 0, Math.PI / 2], s: [1.25, 1.0, 1.25], color: 0x1a1412 });
    // helmet / head
    b.add(box(), { p: [1.0, 3.9, 0], s: [1.9, 1.6, 1.6], tint: rust });
    b.add(box(), { p: [0.1, 3.8, 0], s: [0.1, 0.25, 1.2], color: 0xff4010, glow: 3 });
    for (const s of [1, -1]) b.add(taperTube([V(1.2, 4.6, s * 0.6), V(1.4, 5.4, s * 1.0), V(2.2, 5.9, s * 1.1)], 0.18, 0.02, 8, 10), { color: 0x2a2624, color2: 0xc8a050, grad: 'x' });
    b.add(box(), { p: [1.4, -3.9, 0], s: [2.2, 1.8, 1.8], tint: rust });
    for (let i = 0; i < 5; i++) b.add(cyl(1, 1, 10), { p: [0.6 + i * 0.4, -5.2, 0], s: [0.12, 1.4, 0.12], color: 0x6a645c });
    // chains of the penitent
    for (const [cx, cz] of [[2.5, 0.8], [3.3, -0.6]]) for (let i = 0; i < 14; i++) b.add(torus(0.28, 6, 12), { p: [cx + Math.sin(i * 0.3) * 0.1, 2.2 - i * 0.42, cz], r: [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], s: [0.13, 0.17, 0.13], color: 0x5a524a });
    const hull = new THREE.Mesh(b.build(), iron);

    const gearB = new Builder();
    gearB.add(torus(0.22, 8, 30), { s: 1.0, color: 0x8a6a3a });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; gearB.add(box(), { p: [Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0], r: [0, 0, a], s: [0.3, 0.2, 0.25], color: 0x8a6a3a }); }
    gearB.add(cyl(1, 1, 12), { r: [Math.PI / 2, 0, 0], s: [0.3, 0.3, 0.3], color: 0xff6a10, glow: 2 });
    const gear = new THREE.Mesh(gearB.build(), iron);
    gear.position.set(2.2, 0.6, 1.4);

    const plate = (sgn) => {
        const pb = new Builder();
        const g = new THREE.SphereGeometry(1.35, 24, 12, Math.PI * 0.5, Math.PI, 0, Math.PI / 2);
        pb.add(g, { r: [0, 0, sgn > 0 ? 0 : Math.PI], s: [0.9, 1, 1.1], tint: rust });
        for (let i = 0; i < 6; i++) pb.add(sphere(8, 6), { p: [-0.9, sgn * (0.2 + i * 0.18), (i - 2.5) * 0.3], s: 0.08, color: 0xa08a5a });
        pb.add(box(), { p: [-1.15, sgn * 0.55, 0], s: [0.06, 0.12, 1.6], color: 0xff5010, glow: 2 });
        const m = new THREE.Mesh(pb.build(), iron);
        return m;
    };
    const plateT = plate(1), plateB = plate(-1);
    const arm = () => {
        const ab = new Builder();
        ab.add(cyl(0.8, 1, 16), { r: [0, 0, Math.PI / 2], s: [0.55, 1.8, 0.55], tint: rust });
        ab.add(torus(0.3, 8, 20), { p: [-0.95, 0, 0], r: [0, Math.PI / 2, 0], s: 0.5, color: 0x2a2624 });
        ab.add(cyl(1, 1, 16), { p: [-0.95, 0, 0], r: [0, 0, Math.PI / 2], s: [0.3, 0.1, 0.3], color: 0xff7020, glow: 3 });
        ab.add(box(), { p: [0.9, 0, 0], s: [0.8, 0.9, 0.9], color: 0x3a3634 });
        return new THREE.Mesh(ab.build(), iron);
    };
    const armT = arm(), armB = arm();
    const strutT = new THREE.Mesh(cyl(1, 1, 10), iron), strutB = new THREE.Mesh(cyl(1, 1, 10), iron);
    const core = new THREE.Mesh(sphere(24, 18), glowMat(0xff8a30, 0.95));
    const coreGlow = new THREE.Mesh(sphere(16, 12), glowMat(0xff4010, 0.3));
    const root = group(hull, gear, core, coreGlow, plateT, plateB, armT, armB, strutT, strutB);
    const place = (m, p) => m.position.set(p.ox, p.oy, 0.2);
    return finish(root, [iron, core.material, coreGlow.material], (bs, t) => {
        const c = partOf(bs, 'core');
        core.position.set(c.ox, c.oy, 0.5);
        const exposed = !partOf(bs, 'plateT').alive && !partOf(bs, 'plateB').alive;
        const k = (exposed ? 1.0 : 0.7) + Math.sin(t * 8) * 0.05;
        core.scale.setScalar(k); coreGlow.position.copy(core.position); coreGlow.scale.setScalar(k * 2.2);
        place(plateT, partOf(bs, 'plateT')); place(plateB, partOf(bs, 'plateB'));
        live(plateT, partOf(bs, 'plateT')); live(plateB, partOf(bs, 'plateB'));
        for (const [m, s, name] of [[armT, strutT, 'armT'], [armB, strutB, 'armB']]) {
            const p = partOf(bs, name);
            const fist = bs.fist?.[name];
            let ext = 0;
            if (fist) ext = fist.t < 0.85 ? -0.4 * (fist.t / 0.85) : Math.max(0, 1 - (fist.t - 0.85) * 1.6) * 1.5;
            m.position.set(p.ox - ext, p.oy, 0.4);
            m.rotation.z = fist ? fist.a - Math.PI : Math.sin(t * 1.2 + p.oy) * 0.15;
            live(m, p);
            const sx = 0.6, sy = p.oy * 0.55;
            s.position.set((p.ox + sx) / 2, (p.oy + sy) / 2, 0.2);
            s.scale.set(0.22, Math.hypot(p.ox - sx, p.oy - sy), 0.22);
            s.rotation.z = Math.atan2(p.oy - sy, p.ox - sx) - Math.PI / 2;
            s.visible = p.alive;
        }
        gear.rotation.z = t * 0.8;
    });
}

// ============================================================================ 4. the Ferryman
function ferryman() {
    const mat = litMat({ rough: 0.75, glowMul: 2 });
    const b = new Builder();
    const hull = lathe([[0, -0.9], [0.6, -0.8], [0.95, -0.4], [1.05, 0.1], [0.9, 0.5]], 24);
    b.add(hull, { r: [0, 0, Math.PI / 2], s: [1, 4.2, 1.0], color: 0x2a2018, color2: 0x4a3a28, grad: 'x' });
    b.add(taperTube([V(-4.0, 0.3, 0), V(-4.8, 1.2, 0), V(-4.7, 2.2, 0), V(-4.2, 2.6, 0)], 0.22, 0.05, 8, 12), { color: 0x2a2018 });
    b.add(sphere(), { p: [-4.25, 2.65, 0], s: [0.3, 0.32, 0.3], color: 0xd8ccb0 });                       // carved skull prow
    b.add(sphere(10, 8), { p: [-4.45, 2.7, 0.1], s: 0.06, color: 0x60ffd8, glow: 4 });
    for (let i = 0; i < 6; i++) b.add(sphere(10, 8), { p: [-3 + i * 1.2, 0.35, 0.95], s: 0.08, color: 0x60ffd8, glow: 3 });  // little soul-lamps along the gunwale
    // the figure
    b.add(lathe([[0.0, 2.4], [0.5, 2.1], [0.75, 1.0], [0.95, -0.2], [1.1, -0.5]], 20), { p: [0.5, 1.6, 0], color: 0x10201e, color2: 0x050a0a, grad: 'y', glow: 0.05 });
    b.add(dsphere(0.04, 3, 51), { p: [0.3, 6.15, 0], s: [0.55, 0.62, 0.52], color: 0xd8ccb0 });
    b.add(lathe([[0.0, 0.95], [0.62, 0.7], [0.78, 0.0], [0.7, -0.5]], 20), { p: [0.4, 6.0, 0], s: [1, 1, 1], color: 0x0a1414 });  // hood
    for (const s of [1, -1]) b.add(sphere(10, 8), { p: [-0.1, 6.2, s * 0.18], s: 0.09, color: 0x80fff0, glow: 5 });
    limb(b, [0.1, 4.6, 0.6], [-1.2, 4.6, 0.7], 0.12, { color: 0x10201e });
    limb(b, [-1.2, 4.6, 0.7], [-2.2, 5.0, 0.6], 0.07, { color: 0xc8bca0 });
    limb(b, [0.4, 4.4, -0.6], [-0.3, 3.4, -0.7], 0.11, { color: 0x10201e });
    // scythe
    b.add(cyl(1, 1, 8), { p: [-0.4, 4.4, -0.75], r: [0, 0, 0.18], s: [0.07, 7.2, 0.07], color: 0x2a2018 });
    const blade = taperTube([V(0.3, 7.8, -0.75), V(-0.8, 8.4, -0.75), V(-2.4, 8.0, -0.75), V(-3.4, 6.9, -0.75)], 0.22, 0.01, 6, 18);
    b.add(blade, { s: [1, 1, 0.3], color: 0x9ab8b8, color2: 0xd8ffff, grad: 'x', glow: 0.2, glow2: 1.5 });
    const body = new THREE.Mesh(b.build(), mat);
    // the lantern (the weak point)
    const lb = new Builder();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; lb.add(cyl(1, 1, 6), { p: [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], s: [0.035, 1.1, 0.035], color: 0x3a4a48 }); }
    lb.add(cone(6), { p: [0, 0.75, 0], s: [0.6, 0.45, 0.6], color: 0x2a3432 });
    lb.add(cyl(1, 1, 6), { p: [0, -0.6, 0], s: [0.5, 0.08, 0.5], color: 0x2a3432 });
    const cage = new THREE.Mesh(lb.build(), mat);
    const soul = new THREE.Mesh(sphere(20, 14), glowMat(0x70ffe0, 0.95));
    const soulGlow = new THREE.Mesh(sphere(16, 12), glowMat(0x30c0b0, 0.3));
    const lantern = group(cage, soul, soulGlow);
    const root = group(body, lantern);
    return finish(root, [mat, soul.material, soulGlow.material], (bs, t) => {
        const l = partOf(bs, 'lantern');
        lantern.position.set(l.ox, l.oy, 0.7);
        lantern.rotation.z = Math.sin(t * 1.6) * 0.12;
        const hurt = 1 - l.hp / l.max;
        soul.scale.set(0.3, 0.4 + Math.sin(t * 11) * 0.04, 0.3);
        soulGlow.scale.setScalar(0.9 + hurt * 0.3 + Math.sin(t * 7) * 0.08);
        body.rotation.z = Math.sin(t * 1.1) * 0.02;
    });
}

// ============================================================================ 5. the Brood Mother
function brood() {
    const flesh = litMat({ rough: 0.32, glowMul: 2, pulse: 2.5 });
    const veins = (x, y, z) => new THREE.Color(Math.abs(Math.sin(x * 5 + y * 2.2) * Math.cos(z * 4 - y * 3.1)) > 0.9 ? 0xff6a7a : 0x9a2838);
    const b = new Builder();
    b.add(dsphere(0.16, 1.1, 61, 40, 30), { p: [0.7, 0, 0], s: [3.0, 3.2, 2.6], tint: veins, glow: 0.1 });
    for (const s of [1, -1]) {
        b.add(taperTube([V(1.0, s * 2.6, 0), V(1.4, s * 4.4, 0.3), V(1.8, s * 6.6, 0), V(1.5, s * 9.5, -0.2)], 1.0, 1.4, 12, 16), { tint: veins, glow: 0.05 });
        b.add(taperTube([V(2.6, s * 1.6, 0), V(3.6, s * 3.6, -0.6), V(4.4, s * 7, -0.4), V(4.0, s * 10, -0.8)], 0.6, 0.9, 10, 14), { color: 0x5a1020 });
    }
    // the socket around the eye
    b.add(torus(0.35, 12, 28), { p: [-2.0, 0, 0], r: [0, Math.PI / 2, 0], s: [1.25, 1.25, 1.0], color: 0x6a1828 });
    const heart = new THREE.Mesh(b.build(), flesh);
    // eye
    const eb = new Builder();
    const iris = new THREE.Color(0xffc020), pupil = new THREE.Color(0x100000), white = new THREE.Color(0xf0dcd0);
    eb.add(sphere(36, 26), { tint: (x) => (-x > 0.9 ? pupil : -x > 0.68 ? iris : white), glow: 0 });
    const eyeMat = litMat({ rough: 0.12, glowMul: 1.2 });
    const ball = new THREE.Mesh(eb.build(), eyeMat);
    const irisGlow = new THREE.Mesh(sphere(16, 12), glowMat(0xffa020, 0.5));
    irisGlow.position.set(-0.85, 0, 0); irisGlow.scale.set(0.15, 0.5, 0.5);
    const look = group(ball, irisGlow);
    const lidGeo = new THREE.SphereGeometry(1.12, 30, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    displace(lidGeo, 0.05, 2.5, 7);
    const lb = new Builder(); lb.add(lidGeo, { tint: veins });
    const lidMat = litMat({ rough: 0.4, side: THREE.DoubleSide });
    const lidT = new THREE.Mesh(lb.build(), lidMat), lidB = new THREE.Mesh(lidT.geometry, lidMat);
    const eye = group(look, lidT, lidB);
    eye.scale.setScalar(1.05);
    // tentacles: joint chains to each tip
    const tb = new Builder(); tb.add(dsphere(0.1, 3, 62), { tint: veins });
    const jointGeo = tb.build();
    const tipB = new Builder();
    tipB.add(dsphere(0.1, 3, 63), { s: [0.75, 0.62, 0.62], color: 0x9a2838 });
    tipB.add(sphere(), { p: [-0.45, 0, 0], s: [0.22, 0.3, 0.3], color: 0xffd040, glow: 3 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; tipB.add(cone(5), { p: [-0.35, Math.cos(a) * 0.4, Math.sin(a) * 0.4], r: [a, 0, Math.PI / 2], s: [0.06, 0.32, 0.06], color: 0xf0d8d0 }); }
    const tipGeo = tipB.build();
    const tents = [0, 1, 2, 3].map(() => {
        const joints = []; const g = new THREE.Group();
        for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(jointGeo, flesh); joints.push(m); g.add(m); }
        const tip = new THREE.Mesh(tipGeo, flesh); g.add(tip);
        return { g, joints, tip };
    });
    const root = group(heart, eye, ...tents.map((x) => x.g));
    const base = [[-0.8, 2.2], [-0.8, -2.2], [0.2, 2.8], [0.2, -2.8]];
    return finish(root, [flesh, eyeMat, lidMat, irisGlow.material], (bs, t, dt, view) => {
        const s = 1 + (bs.pulse ?? 0) * 0.06;
        heart.scale.set(s, s, s);
        const e = partOf(bs, 'eye');
        eye.position.set(e.ox, e.oy, 0.4);
        const open = bs.open ?? 0;
        lidT.rotation.z = -0.15 - open * 1.0; lidB.rotation.z = Math.PI + 0.15 + open * 1.0;
        if (view) look.rotation.z = Math.atan2(view.py - (bs.y + e.oy), view.px - (bs.x + e.ox)) - Math.PI;
        irisGlow.material.opacity = 0.2 + open * 0.6;
        tents.forEach((tn, i) => {
            const p = partOf(bs, 'tent' + i);
            tn.g.visible = p.alive;
            const [bx, by] = base[i];
            for (let k = 0; k < tn.joints.length; k++) {
                const f = (k + 1) / (tn.joints.length + 1);
                const sway = Math.sin(t * 2 + i + k * 0.7) * 0.25 * Math.sin(f * Math.PI);
                tn.joints[k].position.set(bx + (p.ox - bx) * f, by + (p.oy - by) * f + sway, 0.2);
                tn.joints[k].scale.setScalar(0.5 - f * 0.18);
            }
            tn.tip.position.set(p.ox, p.oy, 0.3);
            tn.tip.rotation.z = Math.atan2(p.oy - by, p.ox - bx) + Math.PI;
        });
    });
}

// ============================================================================ 6. Sammael
function sammael() {
    const m = buildAngel({
        robe: 0xc8dcf0, robe2: 0x6a8ab8, trim: 0x9ae8ff, skin: 0xd8e4f0, hair: 0xe8f4ff, hair2: 0x8ab8e8, hairGlow: 0.5,
        wing: 0xc8e8ff, wingTip: 0x5ab8ff, wingGlow: 1.0, eyes: 0x60d0ff, halo: false, tattered: false, pairs: 2,
        crown: 0x9ae8ff, wingScale: 1.25, long: true,
    });
    const sb = new Builder();
    sb.add(octa(0), { p: [1.2, -0.05, 0.14], s: [0.9, 0.07, 0.03], color: 0xd8f4ff, glow: 1.6 });
    sb.add(box(), { p: [0.66, -0.05, 0.14], s: [0.05, 0.24, 0.06], color: 0x6a8ab8 });
    const sm = litMat({ rough: 0.05, glowMul: 1.6 });
    const sword = new THREE.Mesh(sb.build(), sm);
    m.lean.add(sword);
    m.mats.push(sm);
    const aura = new THREE.Mesh(sphere(16, 12), glowMat(0x60b8ff, 0.12));
    aura.scale.setScalar(1.3);
    const inner = group(m.root, aura);
    m.root.scale.setScalar(1.7);
    m.root.rotation.y = Math.PI;
    const root = group(inner);
    return finish(root, [...m.mats, aura.material], (bs, t) => {
        const dash = bs.mode === 'dash' && bs.mt > 0.75;
        m.flap(t, dash ? 2.2 : 1.1, dash ? 0.1 : 0.6);
        m.lean.rotation.z = dash ? -0.25 : Math.sin(t * 1.3) * 0.06;
        aura.scale.setScalar(1.3 + Math.sin(t * 5) * 0.1);
    });
}

// ============================================================================ 7. Malphas
function malphas() {
    const mat = litMat({ rough: 0.6, metal: 0.15, glowMul: 2.2, pulse: 1.8 });
    const crk = cracks(0x1a0606, 0xff3a10, 2.4, 0.9);
    const b = new Builder();
    // torso and the dark below
    b.add(dsphere(0.12, 1, 71, 40, 30), { p: [1.3, -0.4, 0], s: [3.2, 3.6, 2.7], tint: crk });
    b.add(lathe([[2.6, 0], [3.0, -2.5], [3.8, -5.5], [4.8, -8.5]], 24), { p: [1.6, -2.6, 0], s: [1, 1, 0.8], color: 0x120404, color2: 0x000000, grad: 'y' });
    for (const s of [1, -1]) {
        b.add(dsphere(0.1, 1.5, 72), { p: [0.9, s * 3.1, 0], s: [1.4, 1.2, 1.3], tint: crk });
        for (let i = 0; i < 4; i++) b.add(cone(6), { p: [1.2 + i * 0.3, s * (3.9 + i * 0.25), 0], r: [0, 0, s * (0.3 - i * 0.25)], s: [0.2, 1.1, 0.2], color: 0x0a0202, color2: 0xff4010, grad: 'y', glow: 0, glow2: 1.5 });
    }
    // ribs around the heart cavity
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) b.add(taperTube([V(0.8, -0.2 - i * 0.45, s * 1.6), V(-0.5, -0.4 - i * 0.45, s * 1.2), V(-1.2, -0.6 - i * 0.4, s * 0.5)], 0.16, 0.06, 6, 10), { color: 0x3a1a14 });
    const torso = new THREE.Mesh(b.build(), mat);
    // head
    const hb = new Builder();
    hb.add(dsphere(0.08, 2, 73), { s: [1.5, 1.6, 1.4], tint: crk });
    hb.add(dsphere(0.06, 2, 74), { p: [-0.9, -0.7, 0], s: [0.9, 0.6, 1.0], color: 0x1a0606 });
    for (const s of [1, -1]) {
        hb.add(sphere(14, 10), { p: [-1.25, 0.25, s * 0.5], s: [0.2, 0.14, 0.18], color: 0xff6020, glow: 5 });
        hb.add(taperTube([V(0.0, 1.0, s * 0.8), V(0.6, 2.2, s * 1.5), V(1.9, 2.9, s * 1.6), V(3.2, 2.4, s * 1.2)], 0.4, 0.05, 12, 20), { color: 0x0a0202, color2: 0x6a4030, grad: 'x' });
    }
    for (let i = 0; i < 9; i++) for (const s of [1, -1]) hb.add(cone(5), { p: [-1.55 + i * 0.1, -0.9, s * (0.3 + i * 0.05)], r: [Math.PI, 0, 0], s: [0.06, 0.3, 0.06], color: 0xfff0d0, glow: 0.4 });
    const head = new THREE.Mesh(hb.build(), mat);
    const crownB = new Builder();
    for (let i = 0; i < 11; i++) {
        const a = (i / 10) * Math.PI - Math.PI / 2;
        crownB.add(cone(6), { p: [Math.sin(a) * 0.9, 0.2 + Math.cos(a) * 0.6, Math.sin(a * 2) * 0.3], r: [0, 0, -a * 0.6], s: [0.16, 1.0 + (i % 2) * 0.6, 0.16], color: 0x050101, color2: 0xff3010, grad: 'y', glow: 0, glow2: 3 });
    }
    const crown = new THREE.Mesh(crownB.build(), mat);
    const headG = group(head, crown);
    crown.position.set(1.0, 2.4, 0);
    // chest plates over the heart, and the heart
    const plateGeo = new THREE.SphereGeometry(1.7, 24, 12, Math.PI * 0.5, Math.PI, 0, Math.PI / 2);
    const pb = new Builder(); pb.add(plateGeo, { tint: crk });
    const plateT = new THREE.Mesh(pb.build(), mat), plateB = new THREE.Mesh(plateT.geometry, mat);
    plateB.rotation.z = Math.PI;
    const heart = new THREE.Mesh(dsphere(0.15, 2, 75), glowMat(0xff4020, 0.95));
    const heartGlow = new THREE.Mesh(sphere(16, 12), glowMat(0xff2000, 0.35));
    const chest = group(heart, heartGlow, plateT, plateB);
    // arms and hands
    const hand = () => {
        const hbb = new Builder();
        hbb.add(dsphere(0.08, 2, 76), { s: [0.95, 0.75, 0.6], tint: crk });
        for (let i = 0; i < 5; i++) {
            const y = -0.6 + i * 0.3;
            hbb.add(taperTube([V(-0.6, y, 0), V(-1.4, y * 1.3, 0.2), V(-2.0, y * 1.5 - 0.3, 0.3), V(-2.3, y * 1.4 - 0.6, 0.2)], 0.17, 0.02, 8, 12), { color: 0x1a0606, color2: 0xffd0a0, grad: 'x', glow: 0, glow2: 0.8 });
        }
        return new THREE.Mesh(hbb.build(), mat);
    };
    const hands = { handT: hand(), handB: hand() };
    const ub = new Builder(); ub.add(cyl(1, 0.7, 14), { tint: crk });
    const arms = { handT: new THREE.Mesh(ub.build(), mat), handB: null };
    arms.handB = new THREE.Mesh(arms.handT.geometry, mat);
    const root = group(torso, headG, chest, hands.handT, hands.handB, arms.handT, arms.handB);
    return finish(root, [mat, heart.material, heartGlow.material], (bs, t) => {
        const hp = partOf(bs, 'head'), hr = partOf(bs, 'heart');
        headG.position.set(hp.ox, hp.oy, 0.6);
        headG.rotation.z = Math.sin(t * 0.7) * 0.05;
        if (!hp.alive) { head.scale.set(1, 0.92, 1); crown.visible = false; } else { head.scale.setScalar(1); crown.visible = true; }
        chest.position.set(hr.ox, hr.oy, 0.9);
        const open = bs.phase >= 3 ? 1 : 0;
        bs._open = (bs._open ?? 0) + (open - (bs._open ?? 0)) * 0.03;
        plateT.rotation.z = -bs._open * 1.2; plateB.rotation.z = Math.PI + bs._open * 1.2;
        const beat = 0.8 + Math.max(0, Math.sin(t * (bs.phase >= 3 ? 9 : 4))) * 0.2;
        heart.scale.setScalar(0.9 * beat); heartGlow.scale.setScalar(2 * beat * (0.4 + bs._open * 0.8));
        for (const n of ['handT', 'handB']) {
            const p = partOf(bs, n), h = hands[n], a = arms[n];
            const lx = p.x - bs.x, ly = p.y - bs.y;
            h.position.set(lx, ly, 1.0);
            h.rotation.z = Math.atan2(ly - (n === 'handT' ? 3 : -3), lx - 0.5) - Math.PI + (n === 'handT' ? 0.3 : -0.3);
            h.visible = p.alive; a.visible = p.alive;
            const sx = 0.9, sy = n === 'handT' ? 3.1 : -3.1;
            const dx = lx - sx, dy = ly - sy, L = Math.hypot(dx, dy);
            a.position.set(sx + dx / 2, sy + dy / 2, 0.6);
            a.scale.set(0.55, L, 0.55);
            a.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        }
    });
}

const FACTORIES = { gorrmaw, wyrm, penitent, ferryman, brood, sammael, malphas };

export function buildBoss(kind) { return FACTORIES[kind](); }

/** A model of a boss for the story scenes (posed, no sim). */
export function buildBossPortrait(kind) {
    const m = FACTORIES[kind]();
    return m;
}
