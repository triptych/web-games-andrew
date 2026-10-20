// Dinosaur skeletons, built bone by bone. Each of the six parts (js/sim/data.js BONE_PARTS) is
// its own group in two versions: real bone, and a faint blue ghost that shows where a missing
// part will go. Side view: +X is the head end, +Y up, Z across the body.

import * as THREE from 'three';
import { Kit, sphere, cyl, cone, torus, tube, shade } from './kit.js';

const PI = Math.PI;
const BONE = '#e9dcc0';
const tone = (k) => (x, y, z) => shade(BONE, k + Math.sin(x * 9 + z * 5) * 0.04 - y * 0.02);

const SPECIES = {
    trike: {
        hip: [0, 1.5], shoulder: [1.5, 1.38], depth: 0.62, width: 0.48, spineR: 0.07,
        neck: [[1.5, 1.38], [1.85, 1.3], [2.1, 1.22]],
        tail: [[0, 1.5], [-1.0, 1.4], [-2.0, 1.0], [-2.8, 0.55]],
        fore: [[1.42, 1.2], [1.6, 0.68], [1.5, 0.16], [1.68, 0.03]], foreR: 0.09,
        hind: [[0.1, 1.38], [-0.12, 0.74], [0.04, 0.16], [0.26, 0.03]], hindR: 0.11,
        skull: 'trike', skullAt: [2.55, 1.15],
    },
    plesio: {
        hip: [-0.7, 1.35], shoulder: [0.7, 1.4], depth: 0.48, width: 0.55, spineR: 0.06,
        neck: [[0.7, 1.4], [1.5, 1.75], [2.1, 2.3], [2.5, 2.75], [2.75, 2.95]],
        tail: [[-0.7, 1.35], [-1.5, 1.2], [-2.3, 1.05]],
        fore: [[0.55, 1.1], [0.95, 0.88], [1.45, 0.72], [1.85, 0.66]], foreR: 0.09, flipper: true,
        hind: [[-0.65, 1.1], [-1.0, 0.9], [-1.4, 0.76], [-1.75, 0.7]], hindR: 0.08,
        skull: 'plesio', skullAt: [3.02, 3.02],
    },
    trex: {
        hip: [0, 2.3], shoulder: [1.35, 2.42], depth: 0.62, width: 0.42, spineR: 0.08,
        neck: [[1.35, 2.42], [1.75, 2.78], [2.05, 2.86]],
        tail: [[0, 2.3], [-1.4, 2.22], [-2.8, 1.98], [-4.0, 1.6]],
        fore: [[1.38, 2.08], [1.55, 1.86], [1.74, 1.9]], foreR: 0.04,
        hind: [[0.12, 2.12], [0.45, 1.25], [0.0, 0.48], [0.38, 0.04]], hindR: 0.15,
        skull: 'trex', skullAt: [2.62, 2.78],
    },
};

const v3 = ([x, y], z = 0) => [x, y, z];

function vertebrae(k, pts, r0, r1, every = 0.16) {
    k.add(tube(pts.map((p) => v3(p)), [r0, (r0 + r1) / 2, r1], 8), tone(0), 'bone');
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...v3(p))));
    const n = Math.max(3, Math.round(curve.getLength() / every));
    for (let i = 0; i <= n; i++) {
        const t = i / n, p = curve.getPointAt(t);
        const r = r0 + (r1 - r0) * t;
        k.add(sphere(r * 1.45, 10, 8), tone(0.04), 'bone', { p: [p.x, p.y, p.z], s: [0.7, 1, 1] });
        k.add(cone(r * 0.6, r * 2.4, 5), tone(0.02), 'bone', { p: [p.x, p.y + r * 1.8, p.z] });
    }
}

function limb(k, pts, r, width, flipper = false) {
    for (const s of [-1, 1]) {
        const pp = pts.map((p) => v3(p, s * width));
        k.add(tube(pp, pts.map((_, i) => r * (1 - i * 0.18)), 8), tone(-0.02), 'bone', flipper ? { s: [1, 0.55, 1] } : {});
        for (let i = 1; i < pp.length - 1; i++) k.add(sphere(r * 1.25, 10, 8), tone(0.03), 'bone', { p: pp[i] });
        const end = pp[pp.length - 1];
        if (flipper) k.add(sphere(r * 2.2, 12, 8), tone(0), 'bone', { p: end, s: [1.6, 0.35, 0.8] });
        else for (let t = -1; t <= 1; t++) k.add(cone(r * 0.45, r * 2.2, 5), tone(0.05), 'bone', { p: [end[0] + r * 1.2, end[1], end[2] + t * r * 0.9], r: [0, 0, -PI / 2] });
    }
}

function ribs(k, sp) {
    const [hx, hy] = sp.hip, [sx, sy] = sp.shoulder;
    vertebrae(k, [[hx - 0.1, hy], [(hx + sx) / 2, Math.max(hy, sy) + 0.08], [sx, sy]], sp.spineR * 1.2, sp.spineR * 1.2);
    const n = 9;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = hx + (sx - hx) * t, y = hy + (sy - hy) * t + Math.sin(t * PI) * 0.08;
        const r = sp.depth * (0.55 + 0.45 * Math.sin(t * PI)) * 0.5 + sp.width * 0.25;
        const arc = 1.7 * PI;
        k.add(torus(r, 0.022 + sp.spineR * 0.18, 5, 18, arc), tone(-0.03), 'bone', { p: [x, y - r * 0.92, 0], r: [0, PI / 2, PI / 2 + (2 * PI - arc) / 2], s: [1, 1, sp.width / r * 0.9 > 1 ? 1 : 1] });
    }
    // pelvis and shoulder blades
    k.add(sphere(0.2, 12, 8), tone(0), 'bone', { p: [hx, hy - 0.08, 0], s: [1.5, 0.9, sp.width * 2.2] });
    for (const s of [-1, 1]) k.add(sphere(0.16, 10, 8), tone(0.02), 'bone', { p: [sx - 0.08, sy - 0.18, s * sp.width * 0.8], s: [1.3, 1.6, 0.25], r: [0, 0, 0.4] });
}

function skull(k, kind, [x, y]) {
    const eye = '#3a2a1a';
    if (kind === 'trike') {
        k.add(sphere(0.3, 16, 12), tone(0), 'bone', { p: [x, y, 0], s: [1.6, 0.95, 0.85] });
        k.add(cone(0.16, 0.36, 10), tone(-0.04), 'bone', { p: [x + 0.55, y - 0.1, 0], r: [0, 0, -PI / 2 - 0.3] });
        k.add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20, 1, false, 0, PI), (px, py) => shade(BONE, -0.04 + Math.sin(py * 20) * 0.03), 'bone', { p: [x - 0.32, y + 0.18, 0], r: [0, 0, 0.62 + PI / 2], s: [1, 1, 1] });
        for (const s of [-1, 1]) {
            k.add(cone(0.065, 0.7, 10), tone(0.06), 'bone', { p: [x + 0.1, y + 0.45, s * 0.18], r: [0, 0, -0.75] });
            k.add(sphere(0.07, 8, 6), eye, 'matte', { p: [x + 0.05, y + 0.12, s * 0.22] });
        }
        k.add(cone(0.06, 0.24, 8), tone(0.06), 'bone', { p: [x + 0.48, y + 0.18, 0], r: [0, 0, -0.4] });
    } else if (kind === 'plesio') {
        k.add(sphere(0.16, 14, 10), tone(0), 'bone', { p: [x, y, 0], s: [1.9, 0.85, 0.9] });
        for (const s of [-1, 1]) k.add(sphere(0.045, 8, 6), eye, 'matte', { p: [x + 0.02, y + 0.05, s * 0.11] });
        for (let i = 0; i < 6; i++) k.add(cone(0.014, 0.07, 4), '#fff8e6', 'bone', { p: [x + 0.08 + i * 0.035, y - 0.12, 0], r: [PI, 0, 0] });
    } else {
        k.add(sphere(0.4, 18, 12), tone(0), 'bone', { p: [x + 0.1, y + 0.02, 0], s: [2.0, 0.78, 0.62], r: [0, 0, -0.1] });
        k.add(sphere(0.3, 14, 10), tone(0.03), 'bone', { p: [x - 0.32, y + 0.12, 0], s: [1.0, 1.0, 0.85] });
        k.add(sphere(0.32, 16, 10), tone(-0.05), 'bone', { p: [x + 0.18, y - 0.34, 0], s: [1.9, 0.38, 0.6], r: [0, 0, -0.14] });
        for (const s of [-1, 1]) {
            k.add(sphere(0.09, 8, 6), eye, 'matte', { p: [x - 0.18, y + 0.2, s * 0.24] });
            k.add(sphere(0.06, 8, 6), eye, 'matte', { p: [x + 0.48, y + 0.04, s * 0.2] });
        }
        for (let i = 0; i < 9; i++) for (const s of [-1, 1]) k.add(cone(0.025, 0.13, 5), '#fff8e6', 'bone', { p: [x - 0.05 + i * 0.09, y - 0.22 - i * 0.012, s * 0.15], r: [PI, 0, 0] });
    }
}

let ghostMat = null;
function ghost() {
    if (!ghostMat) ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return ghostMat;
}

const cache = new Map();
/** Geometries of one part, cached. */
function partGeos(dino, part) {
    const key = dino + part;
    if (cache.has(key)) return cache.get(key);
    const sp = SPECIES[dino];
    const k = new Kit();
    if (part === 'skull') skull(k, sp.skull, sp.skullAt);
    if (part === 'neck') vertebrae(k, sp.neck, sp.spineR * 1.1, sp.spineR * 0.85, 0.13);
    if (part === 'ribs') ribs(k, sp);
    if (part === 'fore') limb(k, sp.fore, sp.foreR, sp.width * 0.9, !!sp.flipper);
    if (part === 'hind') limb(k, sp.hind, sp.hindR, sp.width * 0.85, !!sp.flipper);
    if (part === 'tail') vertebrae(k, sp.tail, sp.spineR * 1.1, sp.spineR * 0.35, 0.15);
    const g = k.geometries();
    cache.set(key, g);
    return g;
}

/**
 * A skeleton with every part in place. setParts(owned) shows owned parts as bone and the rest as
 * ghosts. The group stands on y = 0 and is about 6 units long.
 */
export function buildSkeleton(dino) {
    const group = new THREE.Group();
    const parts = {};
    for (const part of ['skull', 'neck', 'ribs', 'fore', 'hind', 'tail']) {
        const geos = partGeos(dino, part);
        const real = new THREE.Group(), gh = new THREE.Group();
        for (const { geo, mat } of geos) {
            const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; real.add(m);
            gh.add(new THREE.Mesh(geo, ghost()));
        }
        group.add(real, gh);
        parts[part] = { real, ghost: gh };
    }
    const setParts = (owned) => {
        for (const [p, o] of Object.entries(parts)) { o.real.visible = owned.includes(p); o.ghost.visible = !o.real.visible; }
    };
    setParts([]);
    return { group, parts, setParts };
}

/** One bone part on its own, centred, for the journal and the reward card. */
export function buildBonePart(dino, part) {
    const g = new THREE.Group();
    for (const { geo, mat } of partGeos(dino, part)) g.add(new THREE.Mesh(geo, mat));
    return g;
}
