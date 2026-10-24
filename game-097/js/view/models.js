// Procedural pieces: a gothic chess set built from lathes and boxes, no asset files. Each unit's
// `model` picks a silhouette, its colours pick the stone and the glow, and its element is a gem that
// floats over its head. Player pieces stand on a gold ring, the dead on a crimson one.
// The piece faces -z (up the board); the rig is turned for the enemy.

import * as THREE from 'three';
import { UNITS, ELEMENTS } from '../sim/data.js';

const V = (r, y) => new THREE.Vector2(r, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), seg);

/** The height of the crown of each model, for the gem and the health bar. */
const HEIGHT = {
    pawn: 0.85, rook: 1.1, bishop: 1.2, knight: 1.15, king: 1.4, queen: 1.3, wazir: 1.0, alfil: 1.0, rider: 1.35,
    cannon: 1.0, dancer: 1.15, hopper: 0.85, witch: 1.3, archbishop: 1.55, empress: 1.3, champion: 1.4, wraith: 1.15, gargoyle: 1.0,
};

export function makeMaterials(def) {
    const [c1, c2] = def.colors;
    return {
        body: new THREE.MeshStandardMaterial({ color: new THREE.Color(c1).multiplyScalar(1.5), roughness: 0.55, metalness: 0.2 }),
        dark: new THREE.MeshStandardMaterial({ color: new THREE.Color(c1).multiplyScalar(0.55), roughness: 0.8, metalness: 0.1 }),
        trim: new THREE.MeshStandardMaterial({ color: new THREE.Color(c2).multiplyScalar(0.6), roughness: 0.35, metalness: 0.7 }),
        glow: new THREE.MeshStandardMaterial({ color: c2, emissive: c2, emissiveIntensity: 1.1, roughness: 0.4 }),
    };
}

const add = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

function crown(g, m, y, r, n, h) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = add(g, cone(0.045, h, 5), m.trim, Math.cos(a) * r, y, Math.sin(a) * r);
        c.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    }
}

function horseHead(g, m, y = 0.6) {
    const neck = add(g, box(0.2, 0.55, 0.26), m.body, 0, y + 0.05, 0.04); neck.rotation.x = -0.35;
    add(g, box(0.22, 0.22, 0.4), m.body, 0, y + 0.42, -0.14).rotation.x = 0.3;
    add(g, box(0.17, 0.15, 0.2), m.dark, 0, y + 0.34, -0.38);
    add(g, cone(0.045, 0.14, 4), m.body, -0.07, y + 0.62, -0.02);
    add(g, cone(0.045, 0.14, 4), m.body, 0.07, y + 0.62, -0.02);
    add(g, box(0.05, 0.4, 0.16), m.trim, 0, y + 0.25, 0.14).rotation.x = -0.35;
    add(g, sph(0.035, 8, 6), m.glow, -0.115, y + 0.46, -0.2);
    add(g, sph(0.035, 8, 6), m.glow, 0.115, y + 0.46, -0.2);
}

const BUILD = {
    pawn(g, m) {
        add(g, lathe([[0.3, 0.1], [0.3, 0.14], [0.2, 0.2], [0.12, 0.4], [0.12, 0.5], [0.22, 0.55], [0.1, 0.6], [0, 0.6]]), m.body);
        add(g, sph(0.17), m.body, 0, 0.72, 0);
        add(g, new THREE.TorusGeometry(0.14, 0.025, 6, 16), m.trim, 0, 0.58, 0).rotation.x = Math.PI / 2;
    },
    rook(g, m) {
        add(g, lathe([[0.34, 0.1], [0.3, 0.2], [0.24, 0.35], [0.22, 0.75], [0.31, 0.8], [0.31, 0.96], [0.2, 0.96], [0.2, 0.9], [0, 0.9]]), m.body);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = add(g, box(0.12, 0.14, 0.12), m.body, Math.cos(a) * 0.25, 1.02, Math.sin(a) * 0.25); b.rotation.y = -a; }
        add(g, box(0.05, 0.22, 0.04), m.glow, 0, 0.55, -0.235);
    },
    bishop(g, m) {
        add(g, lathe([[0.32, 0.1], [0.24, 0.2], [0.14, 0.45], [0.13, 0.62], [0.22, 0.68], [0.1, 0.75], [0, 0.75]]), m.body);
        const h = add(g, sph(0.17, 14, 12), m.body, 0, 0.92, 0); h.scale.set(1, 1.4, 1);
        add(g, sph(0.05), m.trim, 0, 1.2, 0);
        const slit = add(g, box(0.04, 0.26, 0.22), m.glow, 0.0, 0.98, -0.05); slit.rotation.z = 0.7;
    },
    knight(g, m) {
        add(g, lathe([[0.32, 0.1], [0.26, 0.2], [0.18, 0.4], [0.2, 0.55], [0, 0.55]]), m.body);
        horseHead(g, m);
    },
    king(g, m) {
        add(g, lathe([[0.34, 0.1], [0.28, 0.22], [0.2, 0.5], [0.18, 0.85], [0.28, 0.92], [0.26, 1.06], [0.12, 1.1], [0, 1.1]]), m.body);
        add(g, box(0.07, 0.3, 0.07), m.trim, 0, 1.3, 0);
        add(g, box(0.22, 0.07, 0.07), m.trim, 0, 1.33, 0);
        add(g, new THREE.TorusGeometry(0.2, 0.03, 6, 20), m.trim, 0, 1.08, 0).rotation.x = Math.PI / 2;
    },
    queen(g, m) {
        add(g, lathe([[0.32, 0.1], [0.24, 0.25], [0.13, 0.7], [0.27, 0.85], [0.2, 1.0], [0.16, 1.02], [0, 1.0]]), m.body);
        crown(g, m, 1.05, 0.2, 7, 0.22);
        add(g, sph(0.06, 10, 8), m.glow, 0, 1.12, 0);
    },
    wazir(g, m) {
        BUILD.pawn(g, m);
        add(g, cone(0.2, 0.34, 7), m.dark, 0, 0.98, 0);
        const t = add(g, new THREE.TorusGeometry(0.17, 0.03, 6, 14, Math.PI * 1.2), m.trim, 0, 0.3, 0.18); t.rotation.set(0.4, 0.6, 0);
    },
    alfil(g, m) {
        BUILD.pawn(g, m);
        const w1 = add(g, box(0.55, 0.04, 0.26), m.dark, -0.3, 0.7, 0.04); w1.rotation.set(0, 0, 0.5);
        const w2 = add(g, box(0.55, 0.04, 0.26), m.dark, 0.3, 0.7, 0.04); w2.rotation.set(0, 0, -0.5);
        add(g, cone(0.05, 0.2, 5), m.trim, 0, 0.72, -0.2).rotation.x = -Math.PI / 2;
        add(g, sph(0.03, 6, 6), m.glow, -0.07, 0.76, -0.14);
        add(g, sph(0.03, 6, 6), m.glow, 0.07, 0.76, -0.14);
    },
    rider(g, m) {
        g.scale.setScalar(1.08);
        add(g, lathe([[0.32, 0.1], [0.26, 0.2], [0.2, 0.5], [0.22, 0.65], [0, 0.65]]), m.body);
        horseHead(g, m, 0.7);
        const c = add(g, new THREE.TorusGeometry(0.2, 0.03, 8, 24, Math.PI * 1.3), m.glow, 0, 1.3, 0.1); c.rotation.set(0, 0, 0.9);
        add(g, box(0.5, 0.5, 0.02), m.dark, 0, 0.55, 0.3).rotation.x = 0.4;
    },
    cannon(g, m) {
        add(g, lathe([[0.36, 0.1], [0.3, 0.2], [0.28, 0.4], [0.2, 0.45], [0, 0.45]]), m.body);
        add(g, cyl(0.18, 0.18, 0.1, 12), m.trim, 0, 0.1, 0.12).rotation.z = Math.PI / 2;
        const h = new THREE.Group(); h.position.set(0, 0.55, 0); h.rotation.x = -0.7; g.add(h);
        add(h, cyl(0.15, 0.2, 0.75, 14), m.dark, 0, 0.2, 0);
        add(h, new THREE.TorusGeometry(0.16, 0.03, 6, 14), m.trim, 0, 0.5, 0).rotation.x = Math.PI / 2;
        add(h, cyl(0.1, 0.1, 0.04, 12), m.glow, 0, 0.58, 0);
    },
    dancer(g, m) {
        add(g, lathe([[0.1, 0.1], [0.12, 0.3], [0.1, 0.6], [0.15, 0.7], [0.08, 0.76], [0, 0.76]]), m.body);
        add(g, cone(0.34, 0.4, 14), m.body, 0, 0.32, 0).material = m.dark;
        add(g, sph(0.12), m.body, 0, 0.9, 0);
        const a1 = add(g, box(0.04, 0.4, 0.04), m.body, -0.2, 0.9, 0); a1.rotation.z = -0.7;
        const a2 = add(g, box(0.04, 0.4, 0.04), m.body, 0.2, 0.9, 0); a2.rotation.z = 0.7;
        add(g, new THREE.TorusGeometry(0.28, 0.02, 6, 24), m.glow, 0, 0.6, 0).rotation.x = Math.PI / 2.4;
    },
    hopper(g, m) {
        const b = add(g, sph(0.3, 16, 12), m.body, 0, 0.45, 0); b.scale.set(1, 0.85, 1.1);
        for (const [x, z] of [[-0.24, -0.14], [0.24, -0.14], [-0.24, 0.16], [0.24, 0.16]]) {
            const l = add(g, cyl(0.04, 0.05, 0.45, 6), m.dark, x, 0.25, z); l.rotation.z = x < 0 ? 0.5 : -0.5;
        }
        add(g, sph(0.07, 8, 8), m.glow, -0.1, 0.6, -0.24);
        add(g, sph(0.07, 8, 8), m.glow, 0.1, 0.6, -0.24);
        add(g, cone(0.06, 0.18, 5), m.trim, -0.14, 0.78, -0.06);
        add(g, cone(0.06, 0.18, 5), m.trim, 0.14, 0.78, -0.06);
    },
    witch(g, m) {
        add(g, lathe([[0.3, 0.1], [0.2, 0.25], [0.12, 0.55], [0.17, 0.7], [0.1, 0.78], [0, 0.78]]), m.body);
        add(g, cyl(0.38, 0.38, 0.03, 16), m.dark, 0, 0.9, 0);
        add(g, cone(0.2, 0.5, 10), m.dark, 0, 1.15, 0).rotation.z = 0.12;
        add(g, new THREE.TorusGeometry(0.2, 0.025, 6, 16), m.glow, 0, 0.95, 0).rotation.x = Math.PI / 2;
        add(g, cyl(0.02, 0.02, 1.1, 5), m.trim, 0.34, 0.55, 0);
        add(g, sph(0.06, 8, 8), m.glow, 0.34, 1.12, 0);
    },
    archbishop(g, m) {
        g.scale.set(1, 1.15, 1);
        BUILD.bishop(g, m);
        add(g, cone(0.12, 0.3, 4), m.trim, 0, 1.3, 0);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(g, sph(0.04, 6, 6), m.glow, Math.cos(a) * 0.32, 0.5 + i * 0.12, Math.sin(a) * 0.32); }
    },
    empress(g, m) {
        BUILD.rook(g, m);
        crown(g, m, 1.12, 0.2, 5, 0.2);
        add(g, sph(0.07, 10, 8), m.glow, 0, 1.2, 0);
    },
    champion(g, m) {
        BUILD.king(g, m);
        add(g, box(0.06, 0.5, 0.36), m.trim, -0.36, 0.6, -0.05);
        add(g, box(0.04, 0.8, 0.07), m.glow, 0.34, 0.8, -0.1).rotation.z = 0.15;
    },
    wraith(g, m) {
        const cloak = add(g, new THREE.ConeGeometry(0.4, 1.1, 14, 1, true), new THREE.MeshStandardMaterial({ color: m.body.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.6, 0);
        cloak.scale.set(1, 1, 0.9);
        add(g, sph(0.17, 12, 10), m.dark, 0, 1.05, 0);
        add(g, sph(0.04, 6, 6), m.glow, -0.07, 1.07, -0.14);
        add(g, sph(0.04, 6, 6), m.glow, 0.07, 1.07, -0.14);
    },
    gargoyle(g, m) {
        add(g, lathe([[0.32, 0.1], [0.28, 0.22], [0.22, 0.5], [0.16, 0.6], [0, 0.6]]), m.body);
        add(g, sph(0.17), m.body, 0, 0.75, 0);
        const w1 = add(g, box(0.5, 0.04, 0.32), m.dark, -0.34, 0.58, 0.1); w1.rotation.set(0.2, 0, 0.7);
        const w2 = add(g, box(0.5, 0.04, 0.32), m.dark, 0.34, 0.58, 0.1); w2.rotation.set(0.2, 0, -0.7);
        add(g, cone(0.045, 0.2, 5), m.trim, -0.1, 0.95, 0);
        add(g, cone(0.045, 0.2, 5), m.trim, 0.1, 0.95, 0);
        add(g, sph(0.035, 6, 6), m.glow, -0.06, 0.78, -0.14);
        add(g, sph(0.035, 6, 6), m.glow, 0.06, 0.78, -0.14);
    },
};

/** A piece: root (positioned by the view) → rig (turned to face) → parts, plus a gem and a health bar. */
export function makePiece(key, team, { bar = true } = {}) {
    const def = UNITS[key];
    const m = makeMaterials(def);
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const body = new THREE.Group();
    rig.add(body);
    (BUILD[def.model] || BUILD.pawn)(body, m);
    rig.rotation.y = team === 'e' ? Math.PI : 0;

    // base disc and the team ring
    const ring = team === 'e' ? 0xc2203a : 0xe8c46a;
    add(rig, cyl(0.4, 0.44, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x1a1720, roughness: 0.7, metalness: 0.3 }), 0, 0.05, 0);
    const rmat = new THREE.MeshStandardMaterial({ color: ring, emissive: ring, emissiveIntensity: 0.7, roughness: 0.4 });
    add(rig, new THREE.TorusGeometry(0.4, 0.025, 6, 32), rmat, 0, 0.1, 0).rotation.x = Math.PI / 2;

    const top = HEIGHT[def.model] ?? 1.1;
    const el = ELEMENTS[def.el];
    const gemMat = new THREE.MeshStandardMaterial({ color: el.color, emissive: el.color, emissiveIntensity: 1.6, roughness: 0.2, transparent: true, opacity: 0.95 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), gemMat);
    gem.scale.y = 1.4;
    gem.position.y = top + 0.22;
    root.add(gem);

    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: team === 'e' ? 0xd23a4a : 0x58d07a, depthTest: false, transparent: true }));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.12), new THREE.MeshBasicMaterial({ color: 0x08060a, depthTest: false, transparent: true, opacity: 0.85 }));
    const hp = new THREE.Group();
    hp.add(back, fill);
    hp.position.y = top + 0.52;
    back.renderOrder = 10; fill.renderOrder = 11;
    fill.position.z = 0.001;
    hp.visible = bar;
    root.add(hp);

    const mats = [];
    root.traverse((o) => { if (o.isMesh && o !== gem && o.parent !== hp) mats.push(o.material); });
    for (const mt of new Set(mats)) mt.userData.c0 = mt.color.clone();
    root.userData = { gem, gemMat, hp, fill, rig, body, top, mats: [...new Set(mats)], key, team, hpFrac: 1 };
    setHp(root, 1);
    return root;
}

export function setHp(root, frac) {
    const { fill } = root.userData;
    const f = Math.max(0.001, Math.min(1, frac));
    fill.scale.set(0.68 * f, 0.07, 1);
    fill.position.x = -0.34 * (1 - f);
    fill.material.color.setHex(f > 0.5 ? (root.userData.team === 'e' ? 0xd23a4a : 0x58d07a) : f > 0.25 ? 0xe0b040 : 0xe03030);
    root.userData.hpFrac = f;
}

/** Grey a piece that has acted. */
export function setSpent(root, spent) {
    for (const mt of root.userData.mats) {
        if (!mt.userData.c0) continue;
        mt.color.copy(mt.userData.c0);
        if (spent) mt.color.multiplyScalar(0.45);
    }
    root.userData.gemMat.opacity = spent ? 0.35 : 0.95;
}

export function disposeTree(o) {
    o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((mt) => mt.dispose());
    });
}
