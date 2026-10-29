// Procedural models: the four gem cuts, chibi hero figures for every class, and six monster
// bodies with variants. Everything is built from three.js primitives; no files.

import * as THREE from 'three';
import { COLORS } from '../sim/data.js';
import { hash3 } from '../rng.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ materials
const matCache = new Map();
/** A shared standard material. Lit, slightly glossy; emissive for glowing bits. */
export function mat(color, { rough = 0.55, metal = 0, emissive = 0, ei = 1, flat = false, side, transparent = false, opacity = 1 } = {}) {
    const key = [color, rough, metal, emissive, ei, flat, side, transparent, opacity].join('|');
    let m = matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, flatShading: flat, transparent, opacity, envMapIntensity: metal > 0.5 ? 0.8 : 0.35 });
        if (side) m.side = side;
        matCache.set(key, m);
    }
    return m;
}

function put(parent, geo, material, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(p[0], p[1], p[2]);
    m.rotation.set(r[0], r[1], r[2]);
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]); else m.scale.setScalar(s);
    m.castShadow = true;
    parent.add(m);
    return m;
}

const G = {
    sphere: (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h),
    cap: (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 4, s),
    cyl: (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s),
    cone: (r, h, s = 16) => new THREE.ConeGeometry(r, h, s),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    torus: (r, t, rs = 8, ts = 24, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc),
};

// ------------------------------------------------------------------ gems
/**
 * A cut gem lofted through rings of one outline: a pavilion narrowing to a point below the girdle,
 * crown facets above it and a small table on top. Flat shaded, so every facet catches the light.
 * outline: [x, z] points around the axis; rings: [scale, y, half] from the bottom up, where half
 * turns the ring half a step (its points sit on the outline's edge midpoints) for triangular facets.
 */
function cutGem(outline, rings) {
    const n = outline.length, pos = [];
    const R = rings.map(([k, y, half]) => outline.map(([x, z], i) => {
        if (!half) return [x * k, y, z * k];
        const [x2, z2] = outline[(i + 1) % n];
        return [((x + x2) / 2) * k, y, ((z + z2) / 2) * k];
    }));
    const tri = (a, b, c) => {
        // every facet counter-clockwise seen from outside: flip any whose normal points inward
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
        const out = nx * cx + nz * cz + ny * (cy - 0.16) * 0.6;
        if (out >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
    };
    for (let r = 0; r < R.length - 1; r++) {
        const A = R[r], B = R[r + 1];
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            if (rings[r + 1][2]) { tri(A[i], A[j], B[i]); tri(B[i], A[j], B[j]); }
            else if (rings[r][2]) { tri(A[i], B[j], B[i]); tri(A[i], A[j], B[j]); }
            else { tri(A[i], A[j], B[j]); tri(A[i], B[j], B[i]); }
        }
    }
    // the culet (a point below) and the table (flat on top)
    const bot = [0, 0, 0], top = R[R.length - 1], ty = rings[rings.length - 1][1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(R[0][i], R[0][j], bot); tri(top[i], top[j], [0, ty, 0]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}
/** n points around the axis, the first at angle rot (π/2 points north, away from the camera). */
const poly = (n, r, rot = 0, radii = null) => Array.from({ length: n }, (_, k) => {
    const a = rot + (k * TAU) / n, q = radii ? radii[k % radii.length] : 1;
    return [Math.cos(a) * r * q, -Math.sin(a) * r * q];
});
/** Cut off each corner of a polygon: a trillion from a triangle, an emerald cut from a square. */
const chamfer = (pts, f) => pts.flatMap((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    return [[p[0] + (a[0] - p[0]) * f, p[1] + (a[1] - p[1]) * f], [p[0] + (b[0] - p[0]) * f, p[1] + (b[1] - p[1]) * f]];
});

/** The four cuts, each about 0.74 across, sitting on y = 0. */
export function gemGeometries() {
    const rings = [[0.35, 0.05], [1, 0.14], [1, 0.18], [0.78, 0.28, 1], [0.52, 0.33]];
    const orb = cutGem(poly(16, 0.36), [[0.3, 0.05], [1, 0.15], [1, 0.19], [0.8, 0.3, 1], [0.55, 0.36]]);
    const spire = cutGem(chamfer(poly(3, 0.46, Math.PI / 2), 0.14), rings);
    const keep = cutGem(chamfer(poly(4, 0.42, Math.PI / 4), 0.11), rings);
    const star = cutGem(poly(10, 0.43, Math.PI / 2, [1, 0.46]), [[0.3, 0.05], [1, 0.13], [1, 0.16], [0.72, 0.26], [0.45, 0.31]]);
    return [orb, spire, keep, star];
}

/** A rough rock for rubble. */
export function rubbleGeometry() {
    const g = new THREE.DodecahedronGeometry(0.3, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const k = 0.8 + hash3(Math.round(p.getX(i) * 100), Math.round(p.getY(i) * 100), Math.round(p.getZ(i) * 100)) * 0.4;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    g.translate(0, 0.2, 0);
    g.computeVertexNormals();
    return g;
}

// ------------------------------------------------------------------ hero figures
const SKINS = [0xffdcc0, 0xf2c39d, 0xd99b73, 0xa86b48, 0x7a4a30, 0xe8b894];
const HAIRS = [0x2b1d14, 0x5a3420, 0xc9873a, 0xe8d08a, 0xb43a2a, 0xeeeeee, 0x2c2c44, 0x6b4a8a];

function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k).getHex(); }

/**
 * A chibi figure about 1.05 tall standing on y = 0, facing +z (toward the camera).
 * hero: an entry from HEROES.
 */
export function heroFigure(hero) {
    const root = new THREE.Group();
    const body = new THREE.Group();       // everything that bobs and turns
    root.add(body);
    const hseed = [...hero.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const pick = (arr, k) => arr[Math.floor(hash3(hseed, k) * arr.length)];
    const col = COLORS[hero.c].hex;
    const cloth = mat(shade(col, 0.5), { rough: 0.8 });
    const clothDark = mat(shade(col, 0.3), { rough: 0.8 });
    const skin = mat(pick(SKINS, 1), { rough: 0.6 });
    const hair = mat(pick(HAIRS, 2), { rough: 0.5 });
    const gold = mat(0xffcf5a, { rough: 0.3, metal: 0.85 });
    const steel = mat(0xc7d0e0, { rough: 0.28, metal: 0.9 });
    const wood = mat(0x7a5232, { rough: 0.8 });
    const dark = mat(0x1a1420, { rough: 0.6 });
    const glow = mat(col, { emissive: col, ei: 2.2, rough: 0.3 });
    const robed = ['cleric', 'mage', 'warlock', 'druid', 'monk'].includes(hero.cls);
    const armored = hero.cls === 'knight' || hero.cls === 'paladin';

    // legs and torso
    if (robed) {
        put(body, G.cyl(0.13, 0.25, 0.42, 18), cloth, [0, 0.21, 0]);
        put(body, G.torus(0.14, 0.025, 6, 20), hero.cls === 'monk' ? dark : gold, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
    } else {
        put(body, G.cap(0.055, 0.12), clothDark, [-0.07, 0.11, 0]);
        put(body, G.cap(0.055, 0.12), clothDark, [0.07, 0.11, 0]);
        put(body, G.cyl(0.14, 0.16, 0.26, 16), armored ? steel : cloth, [0, 0.33, 0]);
        put(body, G.torus(0.15, 0.022, 6, 20), armored ? gold : clothDark, [0, 0.24, 0], [Math.PI / 2, 0, 0]);
    }
    if (armored) {
        put(body, G.sphere(0.075, 12, 8), steel, [-0.17, 0.44, 0]);
        put(body, G.sphere(0.075, 12, 8), steel, [0.17, 0.44, 0]);
    }
    // arms
    const armMat = armored ? steel : cloth;
    const armL = put(body, G.cap(0.045, 0.15), armMat, [-0.17, 0.33, 0.02], [0, 0, 0.35]);
    const armR = put(body, G.cap(0.045, 0.15), armMat, [0.17, 0.33, 0.02], [0, 0, -0.35]);
    put(body, G.sphere(0.045, 10, 8), skin, [-0.21, 0.23, 0.03]);
    put(body, G.sphere(0.045, 10, 8), skin, [0.21, 0.23, 0.03]);

    // head
    const head = new THREE.Group();
    head.position.set(0, 0.64, 0);
    body.add(head);
    put(head, G.sphere(0.2, 24, 18), skin, [0, 0, 0]);
    put(head, G.sphere(0.028, 10, 8), dark, [-0.07, 0.0, 0.18], [0, 0, 0], [1, 1.3, 0.6]);
    put(head, G.sphere(0.028, 10, 8), dark, [0.07, 0.0, 0.18], [0, 0, 0], [1, 1.3, 0.6]);
    put(head, G.sphere(0.01, 6, 4), mat(0xffffff, { emissive: 0xffffff, ei: 0.6 }), [-0.062, 0.016, 0.197]);
    put(head, G.sphere(0.01, 6, 4), mat(0xffffff, { emissive: 0xffffff, ei: 0.6 }), [0.078, 0.016, 0.197]);
    put(head, G.sphere(0.03, 8, 6), mat(0xff8f8f, { rough: 0.9, transparent: true, opacity: 0.45 }), [-0.12, -0.06, 0.15], [0, 0, 0], [1, 0.6, 0.4]);
    put(head, G.sphere(0.03, 8, 6), mat(0xff8f8f, { rough: 0.9, transparent: true, opacity: 0.45 }), [0.12, -0.06, 0.15], [0, 0, 0], [1, 0.6, 0.4]);
    put(head, G.torus(0.025, 0.007, 4, 10, Math.PI), dark, [0, -0.075, 0.18], [0, 0, Math.PI]);

    const hairCap = (k = 1.08, theta = 1.5) => {
        const g = new THREE.SphereGeometry(0.2 * k, 22, 14, 0, TAU, 0, theta);
        return put(head, g, hair, [0, 0.01, -0.015], [-0.35, 0, 0]);
    };
    const hood = (m) => {
        const g = new THREE.SphereGeometry(0.235, 22, 14, 0, TAU, 0, 1.75);
        put(head, g, m, [0, 0.02, -0.03], [-0.55, 0, 0]);
    };

    // class gear (in the right hand unless noted)
    const handR = new THREE.Group(); handR.position.set(0.22, 0.24, 0.05); body.add(handR);
    const handL = new THREE.Group(); handL.position.set(-0.22, 0.24, 0.05); body.add(handL);
    switch (hero.cls) {
        case 'knight': {
            const helm = new THREE.SphereGeometry(0.215, 22, 14, 0, TAU, 0, 1.45);
            put(head, helm, steel, [0, 0.0, 0]);
            put(head, G.box(0.2, 0.025, 0.02), dark, [0, 0.07, 0.205]);
            put(head, G.cone(0.04, 0.2, 8), cloth, [0, 0.26, -0.04], [-0.4, 0, 0]);
            put(handR, G.box(0.04, 0.42, 0.015), steel, [0, 0.2, 0]);
            put(handR, G.box(0.14, 0.03, 0.04), gold, [0, 0.0, 0]);
            put(handL, G.cyl(0.15, 0.15, 0.04, 20), cloth, [-0.02, 0.06, 0.06], [Math.PI / 2, 0, 0]);
            put(handL, G.torus(0.15, 0.018, 6, 24), gold, [-0.02, 0.06, 0.085]);
            put(handL, G.sphere(0.045, 10, 8), glow, [-0.02, 0.06, 0.09]);
            break;
        }
        case 'paladin': {
            hairCap(1.06, 1.3);
            for (let k = 0; k < 5; k++) put(head, G.cone(0.03, 0.12, 6), gold, [Math.sin((k - 2) * 0.45) * 0.17, 0.19, Math.cos((k - 2) * 0.45) * 0.08], [0, 0, -(k - 2) * 0.3]);
            put(head, G.torus(0.17, 0.02, 6, 24), gold, [0, 0.14, 0], [Math.PI / 2, 0, 0]);
            put(handR, G.cyl(0.018, 0.018, 0.5, 8), wood, [0, 0.12, 0]);
            put(handR, G.box(0.18, 0.1, 0.1), steel, [0, 0.38, 0]);
            put(handR, G.sphere(0.04, 10, 8), glow, [0, 0.38, 0.055]);
            const cape = new THREE.PlaneGeometry(0.36, 0.45, 1, 4);
            put(body, cape, mat(shade(col, 0.6), { rough: 0.8, side: THREE.DoubleSide }), [0, 0.27, -0.16], [0.12, 0, 0]);
            break;
        }
        case 'cleric': {
            hairCap(1.07, 1.6);
            put(head, G.cone(0.12, 0.26, 4), mat(0xf4f0e6, { rough: 0.6 }), [0, 0.22, -0.02], [-0.15, Math.PI / 4, 0], [1, 1, 0.6]);
            put(head, G.torus(0.2, 0.014, 6, 32), gold, [0, 0.27, -0.12], [Math.PI / 2 - 0.4, 0, 0]);
            put(handR, G.cyl(0.016, 0.016, 0.62, 8), gold, [0, 0.12, 0]);
            put(handR, G.sphere(0.06, 14, 10), glow, [0, 0.45, 0]);
            put(handR, G.torus(0.07, 0.012, 6, 18), gold, [0, 0.45, 0]);
            break;
        }
        case 'mage': {
            hairCap(1.08, 1.7);
            put(head, G.cyl(0.33, 0.33, 0.025, 28), cloth, [0, 0.12, 0], [-0.12, 0, 0]);
            const hat = put(head, G.cone(0.2, 0.46, 20), cloth, [0, 0.36, -0.06], [-0.35, 0, 0.12]);
            put(hat, G.sphere(0.03, 8, 6), glow, [0, 0.24, 0]);
            put(head, G.torus(0.2, 0.025, 6, 24), gold, [0, 0.15, -0.01], [Math.PI / 2 - 0.12, 0, 0]);
            put(handR, G.cyl(0.018, 0.022, 0.7, 8), wood, [0, 0.14, 0]);
            put(handR, new THREE.OctahedronGeometry(0.08), glow, [0, 0.53, 0]);
            break;
        }
        case 'warlock': {
            hood(clothDark);
            put(head, G.cone(0.035, 0.16, 8), mat(0x2a2030, { rough: 0.4 }), [-0.12, 0.2, 0], [0, 0, 0.5]);
            put(head, G.cone(0.035, 0.16, 8), mat(0x2a2030, { rough: 0.4 }), [0.12, 0.2, 0], [0, 0, -0.5]);
            const book = new THREE.Group(); book.position.set(-0.05, 0.12, 0.08); handL.add(book);
            put(book, G.box(0.16, 0.2, 0.05), mat(0x3a1e3a, { rough: 0.6 }), [0, 0, 0], [0.2, 0.4, 0.1]);
            put(book, G.box(0.06, 0.06, 0.06), glow, [0, 0, 0.03], [0.2, 0.4, 0.1]);
            put(handR, G.sphere(0.055, 12, 10), glow, [0.02, 0.12, 0.04]);
            break;
        }
        case 'ranger': {
            hood(mat(shade(col, 0.55), { rough: 0.8 }));
            const bow = put(handL, G.torus(0.26, 0.014, 6, 24, Math.PI * 0.9), wood, [-0.02, 0.12, 0.04], [0, Math.PI / 2, Math.PI / 2 + 0.15]);
            bow.rotation.order = 'YXZ';
            put(handL, G.cyl(0.003, 0.003, 0.5, 4), mat(0xeeeeee), [-0.02, 0.12, -0.04]);
            put(body, G.cyl(0.05, 0.05, 0.32, 10), mat(0x6a4024, { rough: 0.8 }), [0.1, 0.42, -0.16], [0.3, 0, -0.4]);
            for (let k = 0; k < 3; k++) put(body, G.cone(0.02, 0.06, 6), mat(0xeeeeee), [0.15 + k * 0.02, 0.6, -0.2 + k * 0.01], [0.3, 0, -0.4]);
            break;
        }
        case 'rogue': {
            hairCap(1.08, 1.5);
            put(head, G.torus(0.2, 0.035, 6, 24), clothDark, [0, 0.06, 0], [Math.PI / 2 - 0.2, 0, 0]);
            put(handR, G.cone(0.025, 0.2, 6), steel, [0, 0.1, 0.02]);
            put(handL, G.cone(0.025, 0.2, 6), steel, [0, 0.1, 0.02]);
            put(body, G.torus(0.13, 0.045, 8, 20), mat(shade(col, 0.5), { rough: 0.8 }), [0, 0.47, 0.01], [Math.PI / 2 - 0.2, 0, 0]);
            put(body, G.box(0.08, 0.16, 0.03), mat(shade(col, 0.5), { rough: 0.8 }), [0.06, 0.4, 0.13], [0.2, 0, 0.3]);
            break;
        }
        case 'druid': {
            hairCap(1.1, 1.9);
            const ant = (sx) => {
                const a = put(head, G.cyl(0.012, 0.016, 0.22, 6), wood, [sx * 0.1, 0.24, -0.02], [0, 0, -sx * 0.5]);
                put(a, G.cyl(0.008, 0.012, 0.1, 6), wood, [sx * 0.03, 0.06, 0], [0, 0, -sx * 0.9]);
            };
            ant(1); ant(-1);
            for (let k = 0; k < 7; k++) {
                const a = (k / 7) * TAU;
                put(head, G.sphere(0.04, 8, 6), mat(0x4fbf5a, { rough: 0.7, flat: true }), [Math.sin(a) * 0.19, 0.12, Math.cos(a) * 0.19], [0, 0, 0], [1, 0.5, 1.4]);
            }
            put(handR, G.cyl(0.02, 0.026, 0.72, 7), wood, [0, 0.14, 0], [0, 0, 0.05]);
            put(handR, G.sphere(0.07, 10, 8), mat(0x56d070, { rough: 0.7, flat: true }), [0.02, 0.5, 0]);
            put(handR, G.sphere(0.035, 10, 8), glow, [0.02, 0.52, 0.03]);
            break;
        }
        case 'bard': {
            const flop = (sx) => {
                const c = put(head, G.cone(0.08, 0.3, 12), sx > 0 ? cloth : mat(0xf4f0e6, { rough: 0.7 }), [sx * 0.14, 0.2, -0.02], [0, 0, -sx * 1.1]);
                put(c, G.sphere(0.035, 10, 8), gold, [0, 0.16, 0]);
            };
            put(head, new THREE.SphereGeometry(0.215, 22, 14, 0, TAU, 0, 1.3), cloth, [0, 0.01, 0]);
            flop(1); flop(-1);
            const lute = new THREE.Group(); lute.position.set(-0.05, 0.08, 0.12); lute.rotation.set(0.3, 0, -0.9); handL.add(lute);
            put(lute, G.sphere(0.1, 14, 10), wood, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.45]);
            put(lute, G.box(0.035, 0.26, 0.025), mat(0x4a3018), [0, 0.2, 0]);
            put(lute, G.cyl(0.03, 0.03, 0.01, 10), dark, [0, 0, 0.045], [Math.PI / 2, 0, 0]);
            break;
        }
        case 'monk': {
            put(head, G.torus(0.2, 0.025, 6, 24), mat(shade(col, 1), { rough: 0.6 }), [0, 0.07, 0], [Math.PI / 2 - 0.15, 0, 0]);
            for (let k = 0; k < 10; k++) {
                const a = (k / 10) * Math.PI + Math.PI;
                put(body, G.sphere(0.024, 8, 6), wood, [Math.cos(a) * 0.12, 0.47 + Math.sin(a) * 0.1, 0.12]);
            }
            armL.rotation.set(-1.0, 0, 0.6); armR.rotation.set(-1.0, 0, -0.6);
            break;
        }
    }

    // one hero, one look: details that tell two heroes of a class apart
    const beard = (len, m) => {
        const b = put(head, G.cone(0.13, len, 14), m, [0, -0.16 - len * 0.35, 0.1], [Math.PI + 0.25, 0, 0]);
        put(head, G.sphere(0.13, 14, 10), m, [0, -0.1, 0.09], [0, 0, 0], [1.05, 0.7, 0.7]);
        return b;
    };
    const longHair = (m, len = 0.32) => put(head, G.cap(0.13, len, 10), m, [0, -0.12, -0.12], [0.18, 0, 0], [1.15, 1, 0.7]);
    const wings = (m) => {
        for (const sx of [-1, 1]) {
            const w = new THREE.Group(); w.position.set(sx * 0.08, 0.42, -0.14); body.add(w);
            const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(sx * 0.2, 0.25, sx * 0.45, 0.35, sx * 0.55, 0.2);
            sh.lineTo(sx * 0.42, 0.08); sh.lineTo(sx * 0.48, -0.04); sh.lineTo(sx * 0.32, -0.06); sh.lineTo(sx * 0.34, -0.18); sh.closePath();
            put(w, new THREE.ShapeGeometry(sh), m, [0, 0, 0], [0, sx * 0.35, 0]);
        }
    };
    switch (hero.id) {
        case 'vesper': {
            for (const sx of [-1, 1]) put(head, G.cone(0.035, 0.22, 8), mat(0x2a1a14, { rough: 0.4 }), [sx * 0.15, 0.2, -0.05], [-0.5, 0, sx * -0.7]);
            put(body, new THREE.PlaneGeometry(0.34, 0.42, 1, 3), mat(0x8a1a12, { rough: 0.8, side: THREE.DoubleSide }), [0, 0.27, -0.16], [0.15, 0, 0]);
            break;
        }
        case 'gorm': {
            beard(0.22, mat(0xc0662a, { rough: 0.7 }));
            body.scale.set(1.15, 0.9, 1.1);
            break;
        }
        case 'lyra': longHair(hair, 0.36); break;
        case 'ilse': {
            handR.clear();
            put(handR, G.cyl(0.012, 0.012, 0.18, 6), gold, [0, 0.12, 0]);
            put(handR, G.box(0.1, 0.12, 0.1), mat(0xffe9a0, { emissive: 0xffc040, ei: 2.4 }), [0, -0.0, 0.02]);
            put(handR, G.cone(0.08, 0.06, 4), gold, [0, 0.09, 0.02], [0, Math.PI / 4, 0]);
            longHair(hair, 0.2);
            break;
        }
        case 'seraphine': longHair(mat(0xf0d070, { rough: 0.5 }), 0.3); break;
        case 'aurelia': {
            wings(mat(0xfff6dc, { rough: 0.6, emissive: 0xffd27a, ei: 0.35, side: THREE.DoubleSide }));
            put(head, G.torus(0.3, 0.02, 6, 40), mat(0xffe39a, { emissive: 0xffc040, ei: 2.4 }), [0, 0.06, -0.16]);
            longHair(mat(0xf6e08a, { rough: 0.5 }), 0.34);
            break;
        }
        case 'nyx': longHair(mat(0x6b3aa0, { rough: 0.5 }), 0.26); break;
        case 'morrigan': {
            for (let k = 0; k < 7; k++) put(head, G.cone(0.025, 0.2, 5), mat(0x15101c, { rough: 0.4 }), [(k - 3) * 0.05, 0.22, -0.02 - Math.abs(k - 3) * 0.02], [0, 0, -(k - 3) * 0.22]);
            const crow = new THREE.Group(); crow.position.set(-0.19, 0.5, -0.02); body.add(crow);
            put(crow, G.sphere(0.06, 12, 8), mat(0x15101c, { rough: 0.5 }), [0, 0, 0], [0, 0, 0], [1, 0.9, 1.3]);
            put(crow, G.sphere(0.04, 10, 8), mat(0x15101c, { rough: 0.5 }), [0, 0.06, 0.04]);
            put(crow, G.cone(0.015, 0.05, 6), mat(0xffc040), [0, 0.06, 0.09], [Math.PI / 2, 0, 0]);
            put(crow, G.sphere(0.008, 6, 4), mat(0xffe080, { emissive: 0xffe080, ei: 2 }), [0.02, 0.075, 0.07]);
            longHair(mat(0x1a1420, { rough: 0.5 }), 0.34);
            break;
        }
        case 'ysolde': {
            const rim = mat(0xd8d8e8, { rough: 0.3, metal: 0.8 });
            put(head, G.torus(0.045, 0.008, 6, 16), rim, [-0.07, 0.0, 0.2]);
            put(head, G.torus(0.045, 0.008, 6, 16), rim, [0.07, 0.0, 0.2]);
            put(head, G.box(0.05, 0.008, 0.008), rim, [0, 0.0, 0.205]);
            put(head, G.cap(0.04, 0.22, 8), hair, [0.13, -0.18, -0.04], [0.2, 0, 0.15]);
            break;
        }
        case 'thalos': {
            beard(0.3, mat(0xf2f2f2, { rough: 0.7 }));
            put(head, G.box(0.08, 0.02, 0.02), mat(0xf2f2f2), [-0.07, 0.07, 0.19], [0, 0, 0.2]);
            put(head, G.box(0.08, 0.02, 0.02), mat(0xf2f2f2), [0.07, 0.07, 0.19], [0, 0, -0.2]);
            break;
        }
        case 'tess': put(body, G.sphere(0.06, 10, 8), mat(0xd8a838, { rough: 0.4, metal: 0.6 }), [0.12, 0.25, 0.12]); break;
        case 'wren': {
            hood(mat(0x4a4448, { rough: 0.8 }));
            handR.clear();
            put(handR, G.box(0.035, 0.4, 0.012), mat(0x2a2428, { rough: 0.3, metal: 0.8 }), [0, 0.2, 0], [0, 0, -0.2]);
            put(handR, G.box(0.11, 0.025, 0.035), mat(0xff6a46, { emissive: 0xff4a20, ei: 1.5 }), [0, 0.01, 0]);
            break;
        }
        case 'corin': {
            head.children.filter((c) => Math.abs((c.geometry?.parameters?.thetaLength ?? 0) - 1.75) < 0.01).forEach((c) => head.remove(c));
            hairCap(1.06, 1.4);
            put(head, G.cone(0.2, 0.16, 16), cloth, [0, 0.2, -0.02], [-0.2, 0, 0], [1, 1, 0.9]);
            put(head, G.cone(0.025, 0.3, 6), mat(0xffffff, { rough: 0.6 }), [0.14, 0.3, -0.06], [-0.4, 0, -0.6]);
            break;
        }
        case 'fennick': {
            head.children.filter((c) => c.geometry?.type === 'ConeGeometry').forEach((c) => head.remove(c));
            for (const sx of [-1, 1]) put(head, G.cone(0.07, 0.16, 4), mat(0xc87a3a, { rough: 0.6 }), [sx * 0.13, 0.2, -0.02], [0, 0, sx * -0.35]);
            put(head, G.cyl(0.28, 0.28, 0.02, 24), clothDark, [0, 0.13, 0], [-0.1, 0, 0]);
            put(head, G.cone(0.03, 0.32, 6), mat(0xff6a46), [-0.16, 0.24, -0.08], [-0.3, 0, 0.7]);
            break;
        }
        case 'mara': for (let k = 0; k < 6; k++) put(head, G.sphere(0.03, 8, 6), mat(0xff9ad8, { rough: 0.6 }), [Math.sin((k / 6) * TAU) * 0.2, 0.13, Math.cos((k / 6) * TAU) * 0.2]); break;
        case 'elowen': {
            for (let k = 0; k < 5; k++) put(head, G.sphere(0.03, 8, 6), mat(0xfff0a0, { emissive: 0xffe060, ei: 2 }), [Math.sin((k / 5) * TAU + 0.3) * 0.21, 0.16, Math.cos((k / 5) * TAU + 0.3) * 0.21]);
            longHair(mat(0xe8e0c8, { rough: 0.5 }), 0.36);
            break;
        }
        case 'kel': put(handL, G.sphere(0.045, 10, 8), glow, [0, 0.12, 0.05]); break;
    }
    if (hero.r === 5) {
        const aura = put(root, G.torus(0.34, 0.012, 6, 40), mat(0xffe08a, { emissive: 0xffd060, ei: 2.5 }), [0, 0.02, 0], [Math.PI / 2, 0, 0]);
        root.userData.aura = aura;
    }
    root.userData.body = body;
    root.userData.head = head;
    return root;
}

// ------------------------------------------------------------------ monsters
/** A wing of overlapping feather blades fanned out sideways, flat toward the camera. */
function featherWing(parent, sx, pos, size, m1, m2) {
    const w = new THREE.Group();
    w.position.set(pos[0], pos[1], pos[2]);
    parent.add(w);
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.07); blade.quadraticCurveTo(0.5, -0.09, 1, 0); blade.quadraticCurveTo(0.5, 0.11, 0, 0.07); blade.closePath();
    const g = new THREE.ShapeGeometry(blade, 6);
    for (let k = 0; k < 7; k++) {
        const len = size * (1 - k * 0.09), a = 0.95 - k * 0.24;
        const f = new THREE.Mesh(g, k % 2 ? m2 : m1);
        f.scale.set(len * sx, size * 1.4, 1);
        f.rotation.z = sx * a;
        f.position.set(sx * k * 0.03, 0, k * 0.004);
        f.castShadow = true;
        w.add(f);
    }
    return w;
}

/** A monster about 2.4 tall (before its table scale) facing +z. Returns { root, parts }. */
export function monster(def) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const col = COLORS[def.c].hex;
    const P = { body, eyes: [], arms: [], wings: [], jaw: null, float: false, mats: [] };
    const M = (c, o) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o }); P.mats.push(m); return m; };
    const hide = M(shade(col, 0.55), { roughness: 0.75 });
    const hide2 = M(shade(col, 0.32), { roughness: 0.8 });
    const glowM = M(col, { emissive: new THREE.Color(col), emissiveIntensity: 3, roughness: 0.3 });
    const eyeM = M(0xfff2c0, { emissive: new THREE.Color(0xffe080), emissiveIntensity: 3.5 });
    const horn = M(0xe9dcc4, { roughness: 0.5 });
    const eye = (parent, x, y, z, r = 0.07) => P.eyes.push(put(parent, G.sphere(r, 12, 8), eyeM, [x, y, z]));

    switch (def.body) {
        case 'imp': {
            P.float = true;
            put(body, G.sphere(0.55, 24, 18), hide, [0, 1.2, 0], [0, 0, 0], [1, 1.05, 0.95]);
            put(body, G.sphere(0.35, 18, 12), hide2, [0, 1.0, 0.32], [0, 0, 0], [1, 0.8, 0.5]);
            eye(body, -0.2, 1.38, 0.47, 0.09); eye(body, 0.2, 1.38, 0.47, 0.09);
            put(body, G.cone(0.1, 0.45, 10), horn, [-0.3, 1.75, 0], [0, 0, 0.45]);
            put(body, G.cone(0.1, 0.45, 10), horn, [0.3, 1.75, 0], [0, 0, -0.45]);
            put(body, G.torus(0.12, 0.03, 6, 16, Math.PI), M(0x220a0a), [0, 1.08, 0.52], [0, 0, Math.PI]);
            for (const sx of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(sx * 0.45, 1.35, -0.15); body.add(w);
                const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(sx * 0.9, 0.5); sh.lineTo(sx * 0.75, 0.05); sh.lineTo(sx * 0.95, -0.25); sh.lineTo(sx * 0.5, -0.15); sh.lineTo(sx * 0.4, -0.4); sh.closePath();
                put(w, new THREE.ShapeGeometry(sh), M(shade(col, 0.4), { side: THREE.DoubleSide, roughness: 0.7 }));
                P.wings.push(w);
            }
            for (const sx of [-1, 1]) P.arms.push(put(body, G.cap(0.08, 0.3), hide, [sx * 0.55, 0.95, 0.15], [0.4, 0, sx * 0.6]));
            put(body, G.cap(0.07, 0.25), hide, [-0.2, 0.55, 0.05]); put(body, G.cap(0.07, 0.25), hide, [0.2, 0.55, 0.05]);
            const tail = put(body, G.cyl(0.03, 0.06, 0.8, 8), hide2, [0, 0.9, -0.55], [-0.9, 0, 0]);
            put(tail, G.cone(0.1, 0.2, 4), glowM, [0, -0.45, 0], [Math.PI, 0, 0]);
            if (def.c === 2) for (let k = 0; k < 8; k++) put(body, G.cone(0.05, 0.25, 6), M(0x2f7a34), [Math.cos(k) * 0.5, 1.2 + Math.sin(k * 2) * 0.35, Math.sin(k) * 0.4], [Math.sin(k) * 1.2, 0, Math.cos(k) * 1.2]);
            break;
        }
        case 'beast': {
            const crab = def.id === 'crab', bird = def.id === 'griffin';
            if (crab) {
                put(body, G.sphere(0.8, 24, 16), hide, [0, 0.75, 0], [0, 0, 0], [1.25, 0.55, 0.95]);
                for (let k = 0; k < 6; k++) {
                    const sx = k < 3 ? -1 : 1, z = ((k % 3) - 1) * 0.35;
                    put(body, G.cap(0.06, 0.6), hide2, [sx * 0.95, 0.45, z], [0, 0, sx * 0.9]);
                }
                for (const sx of [-1, 1]) {
                    const a = new THREE.Group(); a.position.set(sx * 0.75, 0.85, 0.55); body.add(a); P.arms.push(a);
                    put(a, G.cap(0.1, 0.35), hide, [0, 0, 0.2], [1.2, 0, 0]);
                    put(a, G.sphere(0.28, 16, 12), hide, [0, 0.1, 0.55], [0, 0, 0], [0.8, 0.6, 1]);
                    put(a, G.cone(0.12, 0.35, 8), hide2, [sx * 0.05, 0.25, 0.75], [-0.6, 0, 0]);
                }
                for (const sx of [-1, 1]) { put(body, G.cyl(0.03, 0.03, 0.35, 6), hide2, [sx * 0.25, 1.2, 0.55]); eye(body, sx * 0.25, 1.4, 0.55, 0.08); }
                for (let k = 0; k < 5; k++) put(body, G.sphere(0.12, 10, 8), M(0xdfe8ef, { roughness: 0.3 }), [Math.cos(k * 1.3) * 0.6, 1.1, Math.sin(k * 1.3) * 0.4 - 0.1], [0, 0, 0], [1, 0.6, 1]);
                break;
            }
            put(body, G.cap(0.5, 0.9, 12), hide, [0, 0.95, -0.15], [Math.PI / 2, 0, 0]);
            put(body, G.sphere(0.5, 16, 12), hide2, [0, 1.12, 0.25], [0, 0, 0], [1, 0.8, 0.8]);
            const head = new THREE.Group(); head.position.set(0, 1.3, 0.75); body.add(head); P.head = head;
            put(head, G.sphere(0.42, 20, 14), hide, [0, 0, 0], [0, 0, 0], [1, 0.9, 1]);
            if (bird) {
                put(head, G.cone(0.16, 0.45, 10), M(0xffc040, { roughness: 0.4 }), [0, -0.05, 0.45], [Math.PI / 2 + 0.3, 0, 0]);
                for (let k = 0; k < 5; k++) put(head, G.cone(0.06, 0.4, 6), M(0xf6f0e0), [(k - 2) * 0.1, 0.35, -0.2], [-0.7, 0, (k - 2) * 0.2]);
                for (const sx of [-1, 1]) P.wings.push(featherWing(body, sx, [sx * 0.35, 1.45, -0.35], 1.1, M(0xf6f0e0, { roughness: 0.7, side: THREE.DoubleSide }), M(shade(col, 0.75), { roughness: 0.7, side: THREE.DoubleSide })));
            } else {
                put(head, G.cone(0.22, 0.5, 12), hide, [0, -0.08, 0.42], [Math.PI / 2, 0, 0]);
                put(head, G.sphere(0.07, 8, 6), M(0x111111), [0, -0.05, 0.68]);
                P.jaw = put(head, G.box(0.28, 0.06, 0.38), hide2, [0, -0.28, 0.3]);
                for (const sx of [-1, 1]) put(head, G.cone(0.1, 0.32, 8), hide2, [sx * 0.22, 0.38, -0.1], [-0.3, 0, sx * -0.4]);
                for (let k = 0; k < 4; k++) put(head, G.cone(0.025, 0.09, 4), horn, [(k - 1.5) * 0.06, -0.2, 0.55], [Math.PI, 0, 0]);
                if (def.id === 'hound') for (let k = 0; k < 6; k++) put(body, G.cone(0.08, 0.4, 6), glowM, [0, 1.45 - k * 0.05, 0.25 - k * 0.22], [-0.5, 0, 0]);
            }
            eye(head, -0.17, 0.08, 0.34); eye(head, 0.17, 0.08, 0.34);
            for (const [sx, z] of [[-1, 0.35], [1, 0.35], [-1, -0.6], [1, -0.6]]) {
                const l = put(body, G.cap(0.15, 0.42), hide, [sx * 0.32, 0.38, z]);
                put(l, G.sphere(0.14, 10, 8), hide2, [0, -0.38, 0.06], [0, 0, 0], [1, 0.6, 1.3]);
                P.arms.push(l);
            }
            const tail = put(body, G.cone(0.14, 0.9, 10), hide2, [0, 1.15, -1.0], [-2.0, 0, 0]);
            P.tail = tail;
            break;
        }
        case 'golem': {
            const gilded = def.c === 3, mossy = def.c === 2;
            const stone = gilded ? M(0xd8b25a, { roughness: 0.3, metalness: 0.85 }) : M(shade(mossy ? 0x7d8a72 : 0x8a7e76, 0.9), { roughness: 0.85, flatShading: true });
            const stone2 = gilded ? M(0xf0e0a8, { roughness: 0.25, metalness: 0.9 }) : M(shade(mossy ? 0x5d6a52 : 0x5e544e, 1), { roughness: 0.9, flatShading: true });
            put(body, new THREE.DodecahedronGeometry(0.7, 0), stone, [0, 1.35, 0], [0.2, 0.3, 0], [1.2, 1, 0.9]);
            put(body, G.box(0.55, 0.45, 0.5), stone2, [0, 2.05, 0.1], [0.1, 0.1, 0]);
            eye(body, -0.13, 2.08, 0.36, 0.07); eye(body, 0.13, 2.08, 0.36, 0.07);
            put(body, new THREE.OctahedronGeometry(0.22), glowM, [0, 1.4, 0.62]);
            for (const sx of [-1, 1]) {
                const a = new THREE.Group(); a.position.set(sx * 0.95, 1.65, 0); body.add(a); P.arms.push(a);
                put(a, new THREE.DodecahedronGeometry(0.3, 0), stone2, [0, 0, 0]);
                put(a, G.box(0.36, 0.7, 0.36), stone, [sx * 0.08, -0.5, 0.05], [0, 0, sx * 0.15]);
                put(a, new THREE.DodecahedronGeometry(0.32, 0), stone2, [sx * 0.12, -1.0, 0.1]);
            }
            put(body, G.box(0.38, 0.55, 0.38), stone2, [-0.35, 0.35, 0]);
            put(body, G.box(0.38, 0.55, 0.38), stone2, [0.35, 0.35, 0]);
            if (gilded) {
                for (let k = 0; k < 5; k++) put(body, G.cone(0.06, 0.3, 6), M(0xffe9a0, { emissive: new THREE.Color(0xffc040), emissiveIntensity: 1.6 }), [(k - 2) * 0.13, 2.4, 0.1], [0, 0, -(k - 2) * 0.2]);
            }
            if (def.id === 'colossus') {
                const sunM = M(0xffe9a0, { emissive: new THREE.Color(0xffb030), emissiveIntensity: 2.2 });
                put(body, G.torus(0.62, 0.05, 8, 40), sunM, [0, 2.1, -0.35]);
                for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; put(body, G.cone(0.06, 0.4, 5), sunM, [Math.cos(a) * 0.85, 2.1 + Math.sin(a) * 0.85, -0.38], [0, 0, a - Math.PI / 2]); }
                for (const sx of [-1, 1]) put(body, G.box(0.5, 0.18, 0.5), stone2, [sx * 0.62, 1.95, 0], [0, 0, sx * 0.3]);
            }
            if (mossy) for (let k = 0; k < 9; k++) put(body, G.sphere(0.16, 8, 6), M(0x3e8a3a, { roughness: 0.9, flatShading: true }), [Math.cos(k * 2.1) * 0.6, 1.5 + Math.sin(k * 1.7) * 0.5, Math.sin(k * 2.1) * 0.5], [0, 0, 0], [1, 0.6, 1]);
            for (let k = 0; k < 6; k++) put(body, G.box(0.04, 0.3, 0.02), glowM, [Math.cos(k) * 0.55, 1.2 + (k % 3) * 0.25, 0.55 + Math.sin(k) * 0.05], [0, 0, k]);
            break;
        }
        case 'wraith': {
            P.float = true;
            const robe = new THREE.ConeGeometry(0.8, 2.0, 28, 6, true);
            const p = robe.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
                if (y < -0.9) p.setY(i, y + Math.sin(a * 7) * 0.12);
            }
            robe.computeVertexNormals();
            const robeM = def.id === 'seraph' ? M(0xc9bc9c, { roughness: 0.8, side: THREE.DoubleSide }) : M(shade(col, 0.32), { roughness: 0.8, side: THREE.DoubleSide });
            put(body, robe, robeM, [0, 1.2, 0]);
            const head = new THREE.Group(); head.position.set(0, 2.25, 0.05); body.add(head); P.head = head;
            put(head, new THREE.SphereGeometry(0.42, 22, 14, 0, TAU, 0, 1.9), robeM, [0, 0, -0.05], [-0.4, 0, 0]);
            put(head, G.sphere(0.32, 18, 12), M(0x0a0610, { roughness: 1 }), [0, -0.05, 0.08]);
            eye(head, -0.12, 0.0, 0.33, 0.06); eye(head, 0.12, 0.0, 0.33, 0.06);
            for (const sx of [-1, 1]) {
                const a = new THREE.Group(); a.position.set(sx * 0.42, 1.85, 0.15); body.add(a); P.arms.push(a);
                put(a, new THREE.ConeGeometry(0.18, 0.85, 12, 1, true), robeM, [sx * 0.15, -0.35, 0.1], [0.3, 0, sx * 0.5]);
                put(a, G.sphere(0.1, 10, 8), glowM, [sx * 0.35, -0.75, 0.25]);
            }
            if (def.id === 'dknight') {
                put(head, new THREE.SphereGeometry(0.44, 22, 14, 0, TAU, 0, 1.4), M(0x5d7a8a, { metalness: 0.8, roughness: 0.35 }), [0, 0.02, 0]);
                put(body, G.box(0.08, 1.4, 0.03), M(0x9ab0bd, { metalness: 0.9, roughness: 0.3 }), [0.75, 1.3, 0.45], [0, 0, 0.2]);
                put(body, G.box(0.35, 0.05, 0.08), M(0x5d7a8a, { metalness: 0.8 }), [0.62, 1.95, 0.45], [0, 0, 0.2]);
            }
            if (def.id === 'siren') {
                for (let k = 0; k < 9; k++) put(head, G.cap(0.05, 0.9), M(0x40e0c8, { roughness: 0.5 }), [Math.cos(k * 0.7 + 3.6) * 0.38, -0.4, Math.sin(k * 0.7 + 3.6) * 0.3 - 0.05], [0.2, 0, Math.cos(k * 0.7) * 0.3]);
            }
            if (def.id === 'hag') {
                put(head, G.cone(0.08, 0.35, 8), M(0x6a8a50), [0, -0.05, 0.42], [Math.PI / 2 + 0.4, 0, 0]);
                put(head, G.cone(0.42, 0.7, 16), M(0x1f2a18), [0, 0.45, -0.05], [-0.25, 0, 0.1]);
                put(head, G.cyl(0.6, 0.6, 0.04, 24), M(0x1f2a18), [0, 0.18, 0]);
            }
            if (def.id === 'seraph') {
                for (const sx of [-1, 1]) P.wings.push(featherWing(body, sx, [sx * 0.3, 1.95, -0.3], 1.3, M(0xfff6dc, { roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color(0xffd27a), emissiveIntensity: 0.3 }), M(0xe8d6a8, { roughness: 0.6, side: THREE.DoubleSide })));
                put(head, G.torus(0.34, 0.03, 6, 30, Math.PI * 1.6), M(0xffe39a, { emissive: new THREE.Color(0xffc040), emissiveIntensity: 2 }), [0, 0.55, -0.1], [Math.PI / 2 - 0.3, 0, 0.6]);
            }
            if (def.id === 'oathbreaker') {
                for (let k = 0; k < 7; k++) put(head, G.cone(0.06, 0.55, 6), M(0x2c1840, { metalness: 0.6, roughness: 0.4 }), [(k - 3) * 0.12, 0.5, -0.05], [0, 0, -(k - 3) * 0.2]);
                const seals = new THREE.Group(); seals.position.set(0, 1.6, 0); body.add(seals); P.seals = seals;
                for (let k = 0; k < 5; k++) {
                    const s = put(seals, G.torus(0.22, 0.03, 6, 20, Math.PI * 1.5), M(COLORS[k].hex, { emissive: new THREE.Color(COLORS[k].hex), emissiveIntensity: 2.5 }), [Math.cos((k / 5) * TAU) * 1.3, 0, Math.sin((k / 5) * TAU) * 1.3]);
                    s.rotation.set(0.5, k, 0.3);
                }
            }
            break;
        }
        case 'drake': {
            const sea = def.c === 1;
            const scale = M(shade(col, 0.6), { roughness: 0.45, metalness: 0.2 });
            const belly = M(sea ? 0xd8f0f0 : 0xf2c890, { roughness: 0.7 });
            // a curving neck of spheres up to the head
            const pts = [];
            for (let k = 0; k <= 8; k++) {
                const t = k / 8;
                pts.push(new THREE.Vector3(Math.sin(t * 2.6) * 0.45, 0.5 + t * 1.9, -0.6 + Math.sin(t * Math.PI) * 0.4 + t * 0.6));
            }
            pts.forEach((p, k) => put(body, G.sphere(0.5 - k * 0.032, 16, 12), scale, [p.x, p.y, p.z]));
            pts.forEach((p, k) => { if (k < 7) put(body, G.sphere(0.36 - k * 0.025, 12, 10), belly, [p.x, p.y - 0.05, p.z + 0.25]); });
            for (let k = 1; k < 8; k++) put(body, G.cone(0.08, 0.3, 6), sea ? M(0x60e0d0, { roughness: 0.4 }) : hide2, [pts[k].x, pts[k].y + 0.3, pts[k].z - 0.35], [-0.6, 0, 0]);
            const top = pts[8];
            const head = new THREE.Group(); head.position.set(top.x, top.y + 0.15, top.z + 0.2); body.add(head); P.head = head;
            put(head, G.sphere(0.42, 20, 14), scale, [0, 0, 0], [0, 0, 0], [0.9, 0.75, 1.15]);
            put(head, G.box(0.42, 0.22, 0.55), scale, [0, -0.05, 0.42]);
            P.jaw = put(head, G.box(0.36, 0.1, 0.5), belly, [0, -0.22, 0.38]);
            for (let k = 0; k < 5; k++) put(head, G.cone(0.03, 0.1, 4), horn, [(k - 2) * 0.07, -0.13, 0.66], [Math.PI, 0, 0]);
            eye(head, -0.2, 0.08, 0.35); eye(head, 0.2, 0.08, 0.35);
            for (const sx of [-1, 1]) put(head, G.cone(0.08, 0.55, 8), horn, [sx * 0.22, 0.3, -0.25], [-1.0, 0, sx * -0.3]);
            if (sea) for (const sx of [-1, 1]) put(head, new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(sx * 0.6, 0.3); s.lineTo(sx * 0.5, -0.2); s.closePath(); return s; })()), M(0x60e0d0, { side: THREE.DoubleSide }), [sx * 0.3, 0.05, -0.1], [0, sx * -0.4, 0]);
            if (!sea) for (const sx of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(sx * 0.45, 1.4, -0.7); body.add(w); P.wings.push(w);
                const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(sx * 1.6, 1.1); sh.lineTo(sx * 1.4, 0.2); sh.lineTo(sx * 1.7, -0.3); sh.lineTo(sx * 1.0, -0.2); sh.lineTo(sx * 0.9, -0.6); sh.lineTo(sx * 0.4, -0.3); sh.closePath();
                put(w, new THREE.ShapeGeometry(sh), M(shade(col, 0.35), { side: THREE.DoubleSide, roughness: 0.7, emissive: new THREE.Color(col), emissiveIntensity: 0.15 }));
                put(w, G.cyl(0.03, 0.05, 1.9, 6), hide2, [sx * 0.8, 0.55, 0], [0, 0, sx * -0.97]);
            }
            const coils = sea ? 4 : 2;
            for (let k = 0; k < coils; k++) put(body, G.torus(0.55 - k * 0.06, 0.24 - k * 0.03, 10, 20, Math.PI), scale, [(k % 2 ? 1 : -1) * 0.5, 0.3, -0.4 - k * 0.4], [0, Math.PI / 2, 0]);
            if (sea) for (let k = 0; k < 10; k++) put(body, G.sphere(0.12, 8, 6), M(0xe8fbff, { transparent: true, opacity: 0.55, roughness: 0.1 }), [Math.cos(k * 2.4) * 1.3, 0.15, Math.sin(k * 2.4) * 0.6], [0, 0, 0], [1.6, 0.4, 1]);
            P.mouthGlow = put(head, G.sphere(0.14, 10, 8), glowM, [0, -0.13, 0.5]);
            break;
        }
        case 'treant': {
            const bark = M(0x5a3d26, { roughness: 0.95, flatShading: true });
            const bark2 = M(0x3d2818, { roughness: 0.95, flatShading: true });
            const leaf = M(0x3fa04a, { roughness: 0.8, flatShading: true });
            const leaf2 = M(0x2f7a38, { roughness: 0.8, flatShading: true });
            put(body, G.cyl(0.45, 0.7, 2.2, 9), bark, [0, 1.1, 0]);
            for (let k = 0; k < 5; k++) put(body, G.cone(0.2, 0.7, 6), bark2, [Math.cos(k * 1.26) * 0.6, 0.15, Math.sin(k * 1.26) * 0.6], [Math.sin(k * 1.26) * 1.3, 0, -Math.cos(k * 1.26) * 1.3]);
            put(body, G.sphere(0.22, 12, 8), M(0x120a06, { roughness: 1 }), [0, 1.7, 0.38], [0, 0, 0], [1.4, 0.8, 0.5]);
            eye(body, -0.16, 1.72, 0.5, 0.06); eye(body, 0.16, 1.72, 0.5, 0.06);
            put(body, G.sphere(0.18, 12, 8), M(0x120a06, { roughness: 1 }), [0, 1.25, 0.45], [0, 0, 0], [1.3, 0.5, 0.4]);
            for (const sx of [-1, 1]) {
                const a = new THREE.Group(); a.position.set(sx * 0.45, 1.65, 0); body.add(a); P.arms.push(a);
                put(a, G.cyl(0.1, 0.18, 1.1, 7), bark, [sx * 0.45, -0.1, 0.1], [0, 0, sx * 1.0]);
                for (let k = 0; k < 3; k++) put(a, G.cyl(0.03, 0.06, 0.4, 5), bark2, [sx * (0.9 + k * 0.05), -0.4 + k * 0.1, 0.1 + (k - 1) * 0.12], [0, 0, sx * (0.3 + k * 0.4)]);
                put(a, G.sphere(0.32, 10, 8), leaf2, [sx * 0.75, 0.15, 0.05]);
            }
            for (let k = 0; k < 9; k++) {
                const a = (k / 9) * TAU;
                put(body, new THREE.IcosahedronGeometry(0.55 - (k % 3) * 0.08, 0), k % 2 ? leaf : leaf2, [Math.cos(a) * 0.65, 2.45 + Math.sin(k * 1.9) * 0.2, Math.sin(a) * 0.5 - 0.1]);
            }
            put(body, new THREE.IcosahedronGeometry(0.75, 0), leaf, [0, 2.85, -0.1]);
            for (let k = 0; k < 7; k++) put(body, G.sphere(0.06, 8, 6), glowM, [Math.cos(k * 2.2) * 0.8, 2.3 + Math.sin(k * 1.3) * 0.5, Math.sin(k * 2.2) * 0.55 + 0.2]);
            break;
        }
    }
    root.userData.parts = P;
    return root;
}
