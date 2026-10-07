/**
 * models.js — every aid station at its three levels, and the three bosses, built from primitives.
 *
 * A station is one merged mesh (with a little attendant standing by it) plus a few parts that move:
 * flames that flicker, a bell that swings, a halo that breathes. Each level adds something you can
 * see: a pennant at level 2, a gold finial and more kit at level 3.
 */

import * as THREE from 'three';
import { Builder } from './builder.js';
import { toyMat } from './materials.js';
import { STATIONS } from '../sim/data.js';

const K = {
    white: 0xf4f1ea, canvas: 0xe8dcc0, red: 0xd8382e, wood: 0x9a6a3e, wood2: 0x6e4a2c, plank: 0xb98a58, iron: 0x4a4a52,
    gold: 0xf2c14e, skin: 0xe8c4a0, dark: 0x2a2a30, stone: 0x9a968e, green: 0x5fcf7a, glass: 0xbfe6f2, flame: 0xff9a3a,
    soup: 0xd88a3a, bread: 0xd8a860, blanket: 0x8a4a6a, blanket2: 0x4a6a9a, lamp: 0xffd98a, purple: 0xb48af2,
};

/** A little standing figure (an attendant) at (x, z), facing +z. */
function figure(b, x, z, coat, hat = null, ry = 0) {
    const f = new Builder();
    f.cyl(0.05, 0.14, 0x3a3a4a, 0, 0, 0, { rt: 0.045, seg: 6 });
    f.cyl(0.065, 0.16, coat, 0, 0.14, 0, { rt: 0.05, seg: 7 });
    f.sphere(0.055, K.skin, 0, 0.36, 0, { seg: 8, rings: 6 });
    if (hat) f.cyl(0.05, 0.05, hat, 0, 0.4, 0, { seg: 7 });
    b.merge(f, x, 0, z, ry);
}

function pennant(b, x, y, z, col) {
    b.cyl(0.012, 0.4, K.wood2, x, y, z, { seg: 4 });
    b.box(0.02, 0.1, 0.16, col, x, y + 0.28, z + 0.08);
}

function base(b, type, lv) {
    const col = STATIONS[type].color;
    b.cyl(0.42, 0.035, 0x8a7a5e, 0, 0, 0, { seg: 18 });
    b.torus(0.4, 0.022, col, 0, 0.035, 0, { rx: Math.PI / 2, glow: 0.25, tseg: 28 });
    for (let i = 0; i <= lv; i++) b.sphere(0.03, K.gold, -0.3 + i * 0.08, 0.06, 0.28, { seg: 6, rings: 4, glow: 0.6 });
}

const glowMat = (col, op = 0.35) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });

/**
 * Build a station. Returns { group, parts } where parts are { mesh, kind } the view animates.
 */
export function stationModel(type, lv) {
    const b = new Builder();
    base(b, type, lv);
    const parts = [];
    const group = new THREE.Group();
    const addPart = (mesh, kind, extra = {}) => { group.add(mesh); parts.push({ mesh, kind, ...extra }); return mesh; };
    switch (type) {
        case 'medic': {
            const s = 1 + lv * 0.12;
            b.pyramid(0.62 * s, 0.46 * s, 0.56 * s, K.white, -0.04, 0.04, -0.04);
            b.box(0.05, 0.16, 0.012, K.red, -0.04, 0.16 * s, 0.24 * s);
            b.box(0.16, 0.05, 0.012, K.red, -0.04, 0.215 * s, 0.24 * s);
            b.box(0.18, 0.14, 0.012, 0x3a2a20, -0.04, 0.04, 0.27 * s);
            figure(b, 0.26, 0.12, K.white, K.red);
            if (lv >= 1) { b.box(0.14, 0.1, 0.1, K.wood, 0.24, 0.04, -0.22); b.box(0.04, 0.07, 0.01, K.red, 0.24, 0.07, -0.165); pennant(b, -0.3, 0.04, -0.28, K.red); }
            if (lv >= 2) { b.pyramid(0.36, 0.3, 0.34, K.white, 0.22, 0.04, -0.18); b.sphere(0.04, K.gold, -0.04, 0.5 * s + 0.04, -0.04, { glow: 0.8 }); b.box(0.06, 0.08, 0.06, K.lamp, 0.3, 0.04, 0.26, { glow: 1.5 }); }
            break;
        }
        case 'lantern': {
            const posts = lv === 0 ? [[0, 0]] : lv === 1 ? [[-0.12, 0], [0.12, 0]] : [[-0.16, -0.08], [0.16, -0.08], [0, 0.16]];
            const h = 0.62 + lv * 0.08;
            for (const [x, z] of posts) {
                b.cyl(0.025, h, K.iron, x, 0.04, z, { seg: 6 });
                b.box(0.12, 0.03, 0.12, K.iron, x, h + 0.04, z);
                b.box(0.1, 0.14, 0.1, K.lamp, x, h + 0.07, z, { glow: 2.4 });
                b.pyramid(0.14, 0.08, 0.14, K.iron, x, h + 0.21, z);
                const halo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), glowMat(0xffc860, 0.22));
                halo.position.set(x, h + 0.14, z);
                addPart(halo, 'halo');
            }
            if (lv >= 1) pennant(b, 0.3, 0.04, -0.25, K.gold);
            if (lv >= 2) { b.cyl(0.06, 0.18, K.iron, 0.28, 0.04, 0.2, { rt: 0.04, seg: 8, rz: 0.3 }); b.sphere(0.04, 0xff6a3a, 0.31, 0.24, 0.2, { glow: 1.6 }); }
            break;
        }
        case 'remedy': {
            b.box(0.5, 0.04, 0.3, K.wood, 0, 0.26, -0.02);
            for (const [x, z] of [[-0.22, -0.13], [0.22, -0.13], [-0.22, 0.09], [0.22, 0.09]]) b.box(0.03, 0.24, 0.03, K.wood2, x, 0.04, z);
            const cols = [K.green, 0x6ac8f2, 0xf2a6d8, 0xf2d86a];
            for (let i = 0; i < 3 + lv; i++) {
                const x = -0.18 + i * (0.36 / (2 + lv)), c = cols[i % cols.length];
                b.cyl(0.03, 0.08, K.glass, x, 0.3, -0.05, { seg: 6 });
                b.cyl(0.026, 0.05, c, x, 0.3, -0.05, { seg: 6, glow: 1.4 });
            }
            figure(b, 0.12, 0.24, 0x3a8a5a, null, Math.PI);
            const flask = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat(0x7cf28a, 0.6));
            flask.position.set(-0.16, 0.44, -0.08);
            addPart(flask, 'bubble');
            if (lv >= 1) { b.cyl(0.07, 0.2, 0xb87a3a, -0.16, 0.3, -0.08, { rt: 0.03, seg: 8 }); pennant(b, 0.3, 0.04, -0.28, K.green); }
            if (lv >= 2) { b.box(0.36, 0.36, 0.24, K.glass, -0.05, 0.04, -0.28, { glow: 0.2 }); b.pyramid(0.4, 0.14, 0.28, 0x5f9a6a, -0.05, 0.4, -0.28); b.sphere(0.035, K.gold, -0.05, 0.56, -0.28, { glow: 0.8 }); }
            break;
        }
        case 'kitchen': {
            for (const a of [0, 2.1, 4.2]) b.cyl(0.015, 0.42, K.iron, Math.cos(a) * 0.16, 0.04, Math.sin(a) * 0.16 - 0.05, { seg: 4, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 });
            b.cyl(0.13, 0.13, K.iron, 0, 0.12, -0.05, { rt: 0.15, seg: 12 });
            b.cyl(0.13, 0.01, K.soup, 0, 0.245, -0.05, { seg: 12, glow: 0.4 });
            for (let i = 0; i < 4; i++) b.cone(0.03, 0.08, K.flame, -0.04 + (i % 2) * 0.08, 0.04, -0.05 + (i > 1 ? 0.05 : -0.03), { glow: 2 });
            b.box(0.3, 0.03, 0.16, K.plank, 0.18, 0.2, 0.22);
            b.box(0.03, 0.16, 0.14, K.wood2, 0.05, 0.04, 0.22); b.box(0.03, 0.16, 0.14, K.wood2, 0.31, 0.04, 0.22);
            for (let i = 0; i < 3; i++) b.sphere(0.035, K.bread, 0.1 + i * 0.08, 0.24, 0.22, { seg: 6, rings: 4, sy: 0.7 });
            figure(b, -0.26, 0.16, K.white, K.white);
            const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 7), glowMat(0xffa040, 0.7));
            fl.position.set(0, 0.11, -0.05);
            addPart(fl, 'flame');
            if (lv >= 1) { b.box(0.03, 0.5, 0.03, K.wood2, -0.32, 0.04, -0.3); b.box(0.03, 0.5, 0.03, K.wood2, 0.32, 0.04, -0.3); b.box(0.7, 0.03, 0.36, 0xd8582e, 0, 0.54, -0.18, { rx: 0.25 }); }
            if (lv >= 2) { b.cyl(0.1, 0.12, K.iron, 0.26, 0.04, -0.2, { seg: 10 }); b.sphere(0.04, K.gold, 0, 0.62, -0.32, { glow: 0.8 }); pennant(b, 0.34, 0.04, 0.3, 0xd8582e); }
            break;
        }
        case 'fire': {
            for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.ico(0.06, K.stone, Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17); }
            for (const a of [0.4, 1.9, 3.3]) b.cyl(0.025, 0.24, K.wood2, Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05, { rz: Math.PI / 2 - 0.2, ry: a, centre: true, seg: 5 });
            b.box(0.36, 0.08, 0.1, K.wood, 0, 0.04, 0.33);
            b.box(0.36, 0.08, 0.1, K.wood, 0, 0.04, -0.33);
            b.box(0.18, 0.06, 0.14, K.blanket, 0.3, 0.04, 0.1); b.box(0.16, 0.05, 0.12, K.blanket2, 0.3, 0.1, 0.1);
            const flames = lv + 2;
            for (let i = 0; i < flames; i++) {
                const fl = new THREE.Mesh(new THREE.ConeGeometry(0.07 + (i === 0 ? 0.03 : 0), 0.26 + (i === 0 ? 0.08 : 0), 7), glowMat(i === 0 ? 0xffb050 : 0xff6a2a, 0.75));
                fl.position.set(i === 0 ? 0 : Math.cos(i * 2.2) * 0.06, 0.2, i === 0 ? 0 : Math.sin(i * 2.2) * 0.06);
                addPart(fl, 'flame', { phase: i * 1.7 });
            }
            const halo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), glowMat(0xff8a30, 0.12));
            halo.position.set(0, 0.2, 0);
            addPart(halo, 'halo');
            if (lv >= 1) { b.box(0.16, 0.05, 0.12, K.blanket, -0.3, 0.04, -0.12); pennant(b, -0.34, 0.04, 0.2, 0xff7a2a); }
            if (lv >= 2) { b.sphere(0.035, K.gold, -0.34, 0.5, 0.2, { glow: 0.8 }); b.box(0.12, 0.16, 0.12, K.plank, 0.3, 0.04, -0.25); }
            break;
        }
        case 'stretcher': {
            b.pyramid(0.5, 0.4, 0.4, K.white, -0.12, 0.04, -0.14);
            b.box(0.1, 0.03, 0.01, K.red, -0.12, 0.18, 0.065); b.box(0.03, 0.1, 0.01, K.red, -0.12, 0.145, 0.065);
            b.box(0.44, 0.03, 0.14, K.canvas, 0.08, 0.12, 0.22);
            b.box(0.5, 0.02, 0.02, K.wood2, 0.08, 0.12, 0.15); b.box(0.5, 0.02, 0.02, K.wood2, 0.08, 0.12, 0.29);
            figure(b, 0.32, 0.0, 0xf2f2f2, K.red, -0.6);
            figure(b, -0.32, 0.22, 0xf2f2f2, K.red, 0.6);
            if (lv >= 1) pennant(b, 0.32, 0.04, -0.3, K.red);
            if (lv >= 2) { b.box(0.3, 0.18, 0.2, K.white, 0.18, 0.06, -0.24); b.cyl(0.05, 0.03, K.dark, 0.08, 0.06, -0.13, { rx: Math.PI / 2, centre: true, seg: 8 }); b.cyl(0.05, 0.03, K.dark, 0.28, 0.06, -0.13, { rx: Math.PI / 2, centre: true, seg: 8 }); b.sphere(0.035, 0x5aa0ff, 0.18, 0.28, -0.24, { glow: 1.5 }); }
            break;
        }
        case 'splint': {
            b.box(0.46, 0.04, 0.24, K.plank, 0, 0.24, -0.08);
            b.box(0.04, 0.2, 0.2, K.wood2, -0.2, 0.04, -0.08); b.box(0.04, 0.2, 0.2, K.wood2, 0.2, 0.04, -0.08);
            for (let i = 0; i < 3; i++) b.box(0.03, 0.04, 0.2, 0xd8c8a8, -0.12 + i * 0.1, 0.28, -0.08);
            for (const x of [0.28, 0.33]) { b.cyl(0.012, 0.42, K.wood, x, 0.04, 0.2, { seg: 4, rz: 0.12 }); b.box(0.08, 0.02, 0.03, K.wood, x + 0.02, 0.4, 0.2); }
            figure(b, -0.2, 0.22, 0x9ad0e8, null, 0.4);
            if (lv >= 1) { pennant(b, -0.33, 0.04, -0.3, 0x9ad0e8); b.box(0.1, 0.08, 0.08, 0xf4f1ea, 0.1, 0.28, -0.12); }
            if (lv >= 2) { b.sphere(0.035, K.gold, -0.33, 0.5, -0.3, { glow: 0.8 }); for (const x of [0.38, 0.42]) b.cyl(0.012, 0.42, K.wood, x, 0.04, 0.1, { seg: 4, rz: 0.12 }); }
            break;
        }
        case 'song': {
            b.cyl(0.32, 0.08, K.plank, 0, 0.04, -0.02, { seg: 14 });
            b.cyl(0.015, 0.22, K.iron, 0.18, 0.12, 0.14, { seg: 4 });
            b.box(0.12, 0.08, 0.01, K.white, 0.18, 0.34, 0.14, { rx: -0.4 });
            const fig = new Builder();
            figure(fig, 0, 0, K.purple, 0x2a2a3a);
            fig.box(0.12, 0.03, 0.05, 0x8a4a2a, 0.04, 0.3, 0.07, { rz: 0.5 });
            const musician = new THREE.Mesh(fig.geometry(), toyMat);
            musician.position.set(-0.05, 0.12, -0.04);
            musician.castShadow = true;
            addPart(musician, 'sway');
            if (lv >= 1) { figure(b, 0.2, -0.2, 0xd88ab8, null, -0.4); pennant(b, -0.32, 0.04, 0.26, K.purple); }
            if (lv >= 2) {
                for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.sphere(0.025, [0xffd86a, 0xff8ad8, 0x8ad8ff][i % 3], Math.cos(a) * 0.38, 0.5 + Math.sin(i * 1.3) * 0.03, Math.sin(a) * 0.38, { glow: 2, seg: 6, rings: 4 }); }
                for (const a of [0.3, 3.4]) b.cyl(0.012, 0.48, K.iron, Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38, { seg: 4 });
            }
            break;
        }
        case 'bell': {
            const h = 0.62 + lv * 0.06;
            b.box(0.05, h, 0.05, K.wood2, -0.2, 0.04, 0); b.box(0.05, h, 0.05, K.wood2, 0.2, 0.04, 0);
            b.box(0.5, 0.05, 0.08, K.wood2, 0, h + 0.04, 0);
            b.gable(0.56, 0.14, 0.24, 0x8a3a2e, 0, h + 0.09, 0);
            b.cyl(0.015, 0.36, 0xd8c8a8, 0.12, 0.04, 0.12, { seg: 4, rz: -0.25 });
            const bell = new Builder();
            bell.cyl(0.13, 0.18, 0xd9b45a, 0, -0.2, 0, { rt: 0.07, seg: 12, glow: 0.2 });
            bell.sphere(0.035, 0x8a6a2a, 0, -0.22, 0, { seg: 6 });
            bell.box(0.02, 0.04, 0.02, K.iron, 0, -0.02, 0);
            const bm = new THREE.Mesh(bell.geometry(), toyMat);
            bm.position.set(0, h + 0.04, 0);
            bm.castShadow = true;
            addPart(bm, 'bell');
            if (lv >= 1) pennant(b, 0.3, 0.04, -0.25, K.gold);
            if (lv >= 2) { b.sphere(0.04, K.gold, 0, h + 0.3, 0, { glow: 1 }); b.box(0.05, h, 0.05, K.wood2, 0, 0.04, -0.2); }
            break;
        }
        default: break;
    }
    const mesh = new THREE.Mesh(b.geometry(), toyMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    group.userData.base = mesh;
    return { group, parts };
}

export function disposeGroup(g) {
    g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== toyMat) o.material.dispose();
    });
}

// ------------------------------------------------------------------ bosses
/**
 * A boss, built standing at the origin facing +z. Returns { group, rig } where rig holds the parts
 * the actor view animates: arms, legs, body, head, glow.
 */
export function bossModel(kind) {
    const group = new THREE.Group();
    const rig = { kind };
    const mk = (b) => { const m = new THREE.Mesh(b.geometry(), toyMat); m.castShadow = true; return m; };
    const pivot = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); return p; };
    if (kind === 'giant') {
        const skin = 0x7a8a72, rag = 0x5a5048, vein = 0xb06af2;
        const body = pivot(0, 0.62, 0);
        const t = new Builder();
        t.box(0.62, 0.62, 0.4, rag, 0, 0, 0, { rx: 0.25 });
        t.box(0.5, 0.2, 0.36, skin, 0, 0.5, 0.06, { rx: 0.3 });
        for (let i = 0; i < 5; i++) t.box(0.025, 0.4, 0.02, vein, -0.2 + i * 0.1, 0.12, 0.22 + (i % 2) * 0.01, { glow: 2.2, rz: (i - 2) * 0.2 });
        t.sphere(0.17, skin, 0, 0.82, 0.2, { seg: 10 });
        t.sphere(0.035, 0xd8f0ff, -0.06, 0.85, 0.35, { glow: 3, seg: 6 }); t.sphere(0.035, 0xd8f0ff, 0.06, 0.85, 0.35, { glow: 3, seg: 6 });
        t.box(0.7, 0.12, 0.46, skin, 0, 0.6, 0, { rx: 0.25 });
        body.add(mk(t));
        group.add(body);
        rig.body = body;
        rig.arms = [];
        for (const s of [-1, 1]) {
            const p = pivot(s * 0.4, 0.62 + 0.6, 0.06);
            const a = new Builder();
            a.box(0.16, 0.7, 0.16, skin, 0, -0.7, 0);
            a.box(0.2, 0.18, 0.2, skin, 0, -0.86, 0.02);
            a.box(0.02, 0.4, 0.02, vein, 0, -0.55, 0.085, { glow: 2.2 });
            p.add(mk(a));
            group.add(p);
            rig.arms.push(p);
        }
        rig.legs = [];
        for (const s of [-1, 1]) {
            const p = pivot(s * 0.17, 0.66, 0);
            const l = new Builder();
            l.box(0.2, 0.66, 0.22, rag, 0, -0.66, 0);
            l.box(0.22, 0.08, 0.3, 0x3a3430, 0, -0.66, 0.04);
            p.add(mk(l));
            group.add(p);
            rig.legs.push(p);
        }
    } else if (kind === 'wailer') {
        const robe = 0xbcd2e8, dark = 0x5a6a8a, ice = 0xbff0ff;
        const body = pivot(0, 0.2, 0);
        const t = new Builder();
        t.cone(0.42, 1.2, robe, 0, 0, 0, { seg: 10 });
        t.cyl(0.42, 0.06, dark, 0, 0, 0, { seg: 10 });
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; t.cone(0.05, 0.22, ice, Math.cos(a) * 0.36, -0.18, Math.sin(a) * 0.36, { rx: Math.PI, glow: 0.8 }); }
        t.sphere(0.2, 0xe8f2fa, 0, 1.25, 0, { seg: 10 });
        t.box(0.44, 0.6, 0.1, 0x2a3a5a, 0, 0.82, -0.14);
        t.sphere(0.045, 0x9ff0ff, -0.07, 1.27, 0.17, { glow: 4, seg: 6 }); t.sphere(0.045, 0x9ff0ff, 0.07, 1.27, 0.17, { glow: 4, seg: 6 });
        t.cyl(0.05, 0.06, 0x1a2a3a, 0, 1.13, 0.18, { rx: Math.PI / 2, centre: true, seg: 8 });
        for (let i = 0; i < 5; i++) t.cone(0.03, 0.18, ice, -0.16 + i * 0.08, 1.4, 0, { glow: 1.2 });
        body.add(mk(t));
        group.add(body);
        rig.body = body;
        rig.arms = [];
        for (const s of [-1, 1]) {
            const p = pivot(s * 0.24, 1.1, 0);
            const a = new Builder();
            a.cyl(0.04, 0.9, robe, 0, -0.9, 0, { rt: 0.06, seg: 6 });
            for (let k = 0; k < 3; k++) a.cone(0.012, 0.14, ice, (k - 1) * 0.03, -1.02, 0, { rx: Math.PI, glow: 1 });
            p.add(mk(a));
            group.add(p);
            rig.arms.push(p);
        }
        rig.legs = [];
        rig.float = true;
    } else {
        // the Blight Heart: a pulsing mass on tendrils
        const flesh = 0x5a3a6a, glow = 0x9af27a, dark = 0x2a1a32;
        const body = pivot(0, 0.9, 0);
        const t = new Builder();
        t.ico(0.62, flesh, 0, 0, 0, { detail: 1 });
        t.ico(0.48, dark, 0.2, 0.25, 0.18, { detail: 1 });
        for (let i = 0; i < 14; i++) {
            const a = i * 2.39, e = Math.sin(i * 1.7) * 0.8;
            const x = Math.cos(a) * Math.cos(e), y = Math.sin(e), z = Math.sin(a) * Math.cos(e);
            t.sphere(0.07 + (i % 3) * 0.02, glow, x * 0.6, y * 0.6, z * 0.6, { glow: 1.1, seg: 6, rings: 4 });
            if (i % 2) t.cone(0.05, 0.26, dark, x * 0.62, y * 0.62, z * 0.62, { rx: Math.acos(Math.max(-1, Math.min(1, y))), ry: -a + Math.PI / 2, seg: 5 });
        }
        t.sphere(0.12, 0xf2ff9a, 0, 0.1, 0.55, { glow: 1.6, seg: 8 });
        body.add(mk(t));
        group.add(body);
        rig.body = body;
        rig.legs = [];
        rig.arms = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const p = pivot(Math.cos(a) * 0.4, 0.75, Math.sin(a) * 0.4);
            p.rotation.y = -a;
            const l = new Builder();
            l.cyl(0.07, 0.7, flesh, 0.25, -0.7, 0, { rt: 0.04, seg: 6, rz: -0.6 });
            l.sphere(0.04, glow, 0.38, -0.5, 0, { glow: 1, seg: 5 });
            p.add(mk(l));
            group.add(p);
            rig.legs.push(p);
        }
        rig.pulse = true;
    }
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), glowMat(kind === 'wailer' ? 0x8ad8ff : kind === 'heart' ? 0x7ab85a : 0xb06af2, 0.06));
    aura.scale.setScalar(kind === 'heart' ? 1.3 : 0.9);
    aura.position.y = 0.9;
    group.add(aura);
    rig.aura = aura;
    return { group, rig };
}
