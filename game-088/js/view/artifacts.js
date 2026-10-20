// Procedural models of every artifact in the collection, by kind (js/sim/data.js). Each is a
// few lathed, extruded or primitive parts with two colours, merged by material and scaled to a
// unit box, standing on y = -h/2 and facing +Z.

import * as THREE from 'three';
import { Kit, normalize, lathe, sphere, box, cyl, cone, torus, tube, bumpy, extrude, starShape, shade, capsule } from './kit.js';

const PI = Math.PI;

const KINDS = {
    vase(k, a, b) {
        k.add(lathe([[0, 0], [0.18, 0], [0.2, 0.04], [0.15, 0.1], [0.3, 0.3], [0.34, 0.48], [0.28, 0.66], [0.15, 0.78], [0.12, 0.86], [0.18, 0.92], [0.17, 0.96], [0.1, 0.96]], 28),
            (x, y) => (y > 0.42 && y < 0.5) || (y > 0.6 && y < 0.63) ? b : y > 0.9 ? shade(a, -0.2) : a, 'gloss');
        for (const s of [-1, 1]) k.add(torus(0.11, 0.025, 6, 14, PI), shade(a, -0.1), 'gloss', { p: [s * 0.24, 0.76, 0], r: [0, 0, s > 0 ? -PI / 2 : PI / 2] });
    },
    vase2(k, a, b) {
        k.add(lathe([[0, 0], [0.2, 0], [0.22, 0.05], [0.36, 0.3], [0.38, 0.45], [0.3, 0.62], [0.16, 0.72], [0.14, 0.8], [0.22, 0.86], [0.12, 0.86]], 32),
            (x, y, z) => (Math.sin(Math.atan2(z, x) * 8 + y * 10) > 0.6 && y > 0.25 && y < 0.6) ? b : a, 'gloss');
    },
    lamp(k, a, b) {
        k.add(lathe([[0, 0], [0.12, 0], [0.14, 0.03], [0.28, 0.08], [0.3, 0.14], [0.22, 0.2], [0.06, 0.22], [0.0, 0.22]], 24), a, 'gloss', { s: [1, 1, 0.75] });
        k.add(cyl(0.05, 0.07, 0.12, 10), a, 'gloss', { p: [0.32, 0.14, 0], r: [0, 0, -1.2] });
        k.add(torus(0.08, 0.02, 6, 12, PI), shade(a, -0.15), 'gloss', { p: [-0.3, 0.16, 0], r: [0, 0, PI / 2] });
        k.add(cone(0.05, 0.16, 10), b, 'glow', { p: [0.4, 0.26, 0] });
    },
    coin(k, a, b) {
        k.add(cyl(0.4, 0.4, 0.08, 36), a, 'gold', { r: [PI / 2, 0, 0], p: [0, 0.42, 0] });
        k.add(torus(0.39, 0.03, 6, 36), b, 'gold', { p: [0, 0.42, 0] });
        k.add(extrude([[-0.1, -0.12], [0.12, -0.1], [0.14, 0.04], [0.06, 0.14], [-0.04, 0.12], [-0.14, 0.02]], 0.03, 0.01, 2), b, 'gold', { p: [0, 0.42, 0.05] });
        k.add(box(0.5, 0.06, 0.2), '#6b4a2a', 'matte', { p: [0, 0, 0] });
    },
    bowl(k, a, b) {
        k.add(lathe([[0, 0], [0.12, 0], [0.13, 0.03], [0.3, 0.12], [0.4, 0.26], [0.41, 0.3], [0.38, 0.3], [0.28, 0.16], [0.0, 0.08]], 32), (x, y) => (y > 0.22 && y < 0.27 ? b : a), 'gloss');
    },
    bell(k, a, b) {
        k.add(lathe([[0.36, 0], [0.34, 0.05], [0.26, 0.15], [0.22, 0.4], [0.16, 0.55], [0.06, 0.6], [0, 0.6]], 28), a, 'gold');
        k.add(torus(0.07, 0.025, 6, 14), b, 'metal', { p: [0, 0.67, 0] });
        k.add(sphere(0.07), b, 'metal', { p: [0, 0.04, 0] });
        k.add(torus(0.33, 0.02, 6, 30), shade(a, -0.2), 'gold', { p: [0, 0.06, 0], r: [PI / 2, 0, 0] });
    },
    compass(k, a, b) {
        k.add(cyl(0.38, 0.38, 0.1, 32), a, 'gold', { r: [PI / 2, 0, 0], p: [0, 0.4, 0] });
        k.add(cyl(0.32, 0.32, 0.02, 32), b, 'matte', { r: [PI / 2, 0, 0], p: [0, 0.4, 0.05] });
        k.add(extrude([[0, 0.26], [0.05, 0], [0, -0.26], [-0.05, 0]], 0.01, 0.004, 1), '#c23b3b', 'gloss', { p: [0, 0.4, 0.07], r: [0, 0, 0.4] });
        k.add(torus(0.07, 0.025, 6, 12), a, 'gold', { p: [0, 0.85, 0] });
    },
    compass2(k, a, b) {
        for (let i = 0; i < 3; i++) k.add(torus(0.36 - i * 0.07, 0.02, 6, 36), a, 'gold', { p: [0, 0.42, 0], r: [i * 0.5, i * 0.7, 0] });
        k.add(sphere(0.08), b, 'gloss', { p: [0, 0.42, 0] });
        k.add(cyl(0.03, 0.05, 0.12, 8), a, 'gold', { p: [0, 0.03, 0] });
        k.add(cyl(0.16, 0.18, 0.04, 16), a, 'gold', { p: [0, -0.02, 0] });
    },
    bird(k, a, b) {
        k.add(sphere(0.25, 18, 14), a, 'gloss', { p: [0, 0.3, 0], s: [1, 1.1, 0.9] });
        k.add(sphere(0.17, 16, 12), '#f3efe6', 'gloss', { p: [0, 0.28, 0.12], s: [0.9, 1.1, 0.6] });
        k.add(sphere(0.17, 16, 12), a, 'gloss', { p: [0, 0.62, 0] });
        k.add(sphere(0.1, 12, 10), '#f3efe6', 'gloss', { p: [0, 0.6, 0.1], s: [1.1, 0.9, 0.6] });
        k.add(cone(0.08, 0.2, 10), b, 'gloss', { p: [0, 0.6, 0.22], r: [PI / 2, 0, 0], s: [1, 1, 0.8] });
        for (const s of [-1, 1]) k.add(sphere(0.025), '#111', 'gloss', { p: [s * 0.07, 0.66, 0.14] });
        for (const s of [-1, 1]) k.add(box(0.06, 0.04, 0.14), b, 'gloss', { p: [s * 0.08, 0.03, 0.04] });
    },
    tablet(k, a, b) {
        k.add(bumpy(box(0.6, 0.8, 0.1, 6, 8, 1), 0.012, 6, 4), a, 'flat', { p: [0, 0.4, 0] });
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) if ((r * 7 + c * 3) % 5 !== 0) k.add(box(0.07, 0.025, 0.02), b, 'matte', { p: [-0.18 + c * 0.12, 0.68 - r * 0.11, 0.055], r: [0, 0, (r + c) % 2 ? 0.5 : -0.3] });
    },
    bottle(k, a, b) {
        k.add(lathe([[0, 0], [0.18, 0], [0.2, 0.04], [0.2, 0.48], [0.12, 0.6], [0.07, 0.66], [0.07, 0.78], [0.0, 0.78]], 24), a, 'glass');
        k.add(cyl(0.06, 0.055, 0.1, 10), '#8a5a33', 'matte', { p: [0, 0.82, 0] });
        k.add(capsule(0.06, 0.24), b, 'matte', { p: [0, 0.24, 0], r: [0, 0, 0.3] });
    },
    anchor(k, a, b) {
        k.add(cyl(0.04, 0.04, 0.7, 10), a, 'metal', { p: [0, 0.45, 0] });
        k.add(torus(0.3, 0.04, 8, 24, PI), a, 'metal', { p: [0, 0.32, 0], r: [0, 0, PI] });
        k.add(box(0.36, 0.06, 0.06), b, 'metal', { p: [0, 0.68, 0] });
        k.add(torus(0.07, 0.025, 6, 12), a, 'metal', { p: [0, 0.86, 0] });
        for (const s of [-1, 1]) k.add(cone(0.06, 0.12, 6), a, 'metal', { p: [s * 0.3, 0.36, 0] });
    },
    kettle(k, a, b) {
        k.add(lathe([[0, 0], [0.26, 0], [0.32, 0.12], [0.3, 0.3], [0.18, 0.42], [0.06, 0.44], [0, 0.44]], 24), a, 'metal');
        k.add(cyl(0.04, 0.06, 0.28, 8), a, 'metal', { p: [0.34, 0.24, 0], r: [0, 0, -0.9] });
        k.add(torus(0.18, 0.025, 6, 16, PI), b, 'gloss', { p: [0, 0.46, 0] });
        k.add(sphere(0.05), b, 'gloss', { p: [0, 0.47, 0] });
    },
    lantern(k, a, b) {
        k.add(cyl(0.2, 0.22, 0.06, 8), a, 'metal', { p: [0, 0.03, 0] });
        k.add(cyl(0.17, 0.17, 0.42, 8), b, 'glow', { p: [0, 0.3, 0] });
        for (let i = 0; i < 4; i++) k.add(box(0.025, 0.44, 0.025), a, 'metal', { p: [Math.cos(i * PI / 2 + PI / 4) * 0.19, 0.3, Math.sin(i * PI / 2 + PI / 4) * 0.19] });
        k.add(cone(0.23, 0.18, 8), a, 'metal', { p: [0, 0.6, 0] });
        k.add(torus(0.06, 0.018, 6, 12), a, 'metal', { p: [0, 0.74, 0] });
    },
    mask(k, a, b) {
        const g = new THREE.SphereGeometry(0.42, 28, 20, 0, PI, 0, PI);
        k.add(g, a, 'gold', { p: [0, 0.45, 0], s: [0.85, 1.1, 0.5] });
        for (const s of [-1, 1]) {
            k.add(sphere(0.06, 12, 8), b, 'gloss', { p: [s * 0.13, 0.55, 0.19], s: [1.4, 0.8, 0.5] });
            k.add(box(0.14, 0.02, 0.02), '#2a1a0a', 'matte', { p: [s * 0.13, 0.64, 0.19], r: [0, 0, s * -0.15] });
        }
        k.add(cone(0.05, 0.14, 8), shade(a, -0.1), 'gold', { p: [0, 0.43, 0.22], r: [0.3, 0, 0] });
        k.add(box(0.14, 0.025, 0.02), '#8a3a2a', 'gloss', { p: [0, 0.3, 0.2] });
        k.add(box(0.12, 0.16, 0.06), b, 'gloss', { p: [0, 0.06, 0.12] });
    },
    helmet(k, a, b) {
        k.add(new THREE.SphereGeometry(0.34, 26, 16, 0, PI * 2, 0, PI * 0.55), a, 'metal', { p: [0, 0.3, 0] });
        k.add(box(0.08, 0.3, 0.1), a, 'metal', { p: [0, 0.18, 0.31] });
        for (const s of [-1, 1]) k.add(box(0.14, 0.26, 0.04), a, 'metal', { p: [s * 0.24, 0.12, 0.2], r: [0, s * 0.6, 0] });
        k.add(box(0.06, 0.24, 0.6), b, 'fur', { p: [0, 0.74, -0.04] });
    },
    beetle(k, a, b) {
        k.add(sphere(0.3, 20, 14), a, 'jade', { p: [0, 0.18, 0], s: [0.85, 0.45, 1.1] });
        k.add(sphere(0.16, 16, 12), shade(a, -0.15), 'jade', { p: [0, 0.16, 0.34], s: [1.1, 0.6, 0.8] });
        k.add(box(0.02, 0.04, 0.6), b, 'gold', { p: [0, 0.32, -0.02] });
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.add(cyl(0.02, 0.02, 0.24, 5), shade(a, -0.3), 'jade', { p: [s * 0.3, 0.08, 0.15 - i * 0.18], r: [0, 0, s * 1.3] });
    },
    idol(k, a, b) {
        k.add(box(0.36, 0.7, 0.32), a, 'flat', { p: [0, 0.35, 0] });
        k.add(box(0.42, 0.1, 0.36), shade(a, -0.15), 'flat', { p: [0, 0.74, 0] });
        k.add(box(0.12, 0.26, 0.08), shade(a, 0.1), 'flat', { p: [0, 0.42, 0.18] });
        for (const s of [-1, 1]) k.add(box(0.1, 0.04, 0.03), b, 'gloss', { p: [s * 0.1, 0.56, 0.17] });
        k.add(box(0.16, 0.03, 0.03), b, 'gloss', { p: [0, 0.22, 0.17] });
    },
    idol2(k, a, b) {
        k.add(capsule(0.16, 0.4), a, 'gloss', { p: [0, 0.4, 0] });
        k.add(sphere(0.15), b, 'gloss', { p: [0, 0.82, 0.02] });
        k.add(cone(0.2, 0.3, 12), shade(a, 0.1), 'gloss', { p: [0, 0.08, -0.1], r: [-0.6, 0, 0] });
        for (const s of [-1, 1]) k.add(capsule(0.04, 0.24), b, 'gloss', { p: [s * 0.2, 0.5, 0.05], r: [0, 0, s * 0.4] });
        k.add(box(0.36, 0.08, 0.1), '#6b4a2a', 'matte', { p: [0, 0.82, -0.12] });
    },
    sundial(k, a, b) {
        k.add(cyl(0.4, 0.42, 0.08, 28), a, 'flat', { p: [0, 0.04, 0] });
        k.add(extrude([[0, 0], [0.34, 0], [0, 0.3]], 0.03, 0.005, 1), b, 'metal', { p: [-0.16, 0.08, 0], r: [0, PI / 2, 0] });
        for (let i = 0; i < 12; i++) k.add(box(0.02, 0.012, 0.08), b, 'matte', { p: [Math.cos(i * PI / 6) * 0.32, 0.085, Math.sin(i * PI / 6) * 0.32], r: [0, -i * PI / 6, 0] });
    },
    mirror(k, a, b) {
        k.add(cyl(0.3, 0.3, 0.04, 32), a, 'gold', { r: [PI / 2, 0, 0], p: [0, 0.55, 0] });
        k.add(cyl(0.26, 0.26, 0.02, 32), '#e8e2d2', 'metal', { r: [PI / 2, 0, 0], p: [0, 0.55, 0.02] });
        k.add(cyl(0.035, 0.045, 0.3, 8), b, 'gloss', { p: [0, 0.15, 0] });
        k.add(torus(0.28, 0.02, 6, 30), b, 'gold', { p: [0, 0.55, 0.02] });
    },
    cat(k, a, b) {
        k.add(capsule(0.17, 0.32), a, 'gloss', { p: [0, 0.32, 0], s: [1, 1, 0.9] });
        k.add(sphere(0.15), a, 'gloss', { p: [0, 0.76, 0.03] });
        for (const s of [-1, 1]) {
            k.add(cone(0.06, 0.14, 4), a, 'gloss', { p: [s * 0.08, 0.92, 0.02] });
            k.add(sphere(0.022), b, 'glow', { p: [s * 0.055, 0.78, 0.15] });
        }
        k.add(torus(0.03, 0.01, 6, 10), b, 'gold', { p: [0.14, 0.72, 0.03], r: [0, PI / 2, 0] });
        k.add(tube([[0.12, 0.05, -0.08], [0.24, 0.1, -0.05], [0.22, 0.3, 0.04]], [0.03, 0.03, 0.02], 6), a, 'gloss');
    },
    abacus(k, a, b) {
        k.add(box(0.7, 0.06, 0.08), a, 'gloss', { p: [0, 0.03, 0] });
        k.add(box(0.7, 0.06, 0.08), a, 'gloss', { p: [0, 0.6, 0] });
        for (const s of [-1, 1]) k.add(box(0.06, 0.6, 0.08), a, 'gloss', { p: [s * 0.34, 0.31, 0] });
        for (let r = 0; r < 4; r++) {
            k.add(cyl(0.008, 0.008, 0.62, 4), '#c9c2b0', 'metal', { p: [0, 0.14 + r * 0.12, 0], r: [0, 0, PI / 2] });
            for (let i = 0; i < 5; i++) k.add(sphere(0.04, 10, 8), i % 2 ? b : shade(b, 0.3), 'gloss', { p: [-0.22 + i * 0.08 + (r % 2) * 0.12, 0.14 + r * 0.12, 0], s: [1, 0.8, 1] });
        }
    },
    laurel(k, a, b) {
        for (let i = 0; i < 14; i++) {
            const t = (i / 13) * PI * 1.6 + PI * 0.7;
            k.add(sphere(0.07, 8, 6), i % 2 ? a : b, 'gold', { p: [Math.cos(t) * 0.32, 0.36 + Math.sin(t) * 0.32, 0], s: [0.5, 1.2, 0.3], r: [0, 0, t] });
        }
        k.add(torus(0.32, 0.015, 6, 30, PI * 1.6), a, 'gold', { p: [0, 0.36, 0], r: [0, 0, PI * 0.7] });
    },
    crown(k, a, b) {
        k.add(cyl(0.3, 0.28, 0.2, 24, 1, true), a, 'gold', { p: [0, 0.1, 0] });
        for (let i = 0; i < 6; i++) {
            const t = (i / 6) * PI * 2;
            k.add(cone(0.07, 0.2, 6), a, 'gold', { p: [Math.cos(t) * 0.29, 0.3, Math.sin(t) * 0.29] });
            k.add(sphere(0.04), b, 'gem', { p: [Math.cos(t) * 0.3, 0.1, Math.sin(t) * 0.3] });
        }
    },
    chest(k, a, b) {
        k.add(box(0.7, 0.36, 0.44), a, 'gloss', { p: [0, 0.18, 0] });
        k.add(cyl(0.22, 0.22, 0.7, 16, 1, false, 0, PI), shade(a, 0.1), 'gloss', { p: [0, 0.36, 0], r: [0, 0, PI / 2] });
        for (const x of [-0.25, 0.25]) k.add(box(0.06, 0.58, 0.46), b, 'gold', { p: [x, 0.3, 0] });
        k.add(box(0.12, 0.14, 0.05), b, 'gold', { p: [0, 0.36, 0.23] });
    },
    trilobite(k, a, b) {
        for (let i = 0; i < 9; i++) {
            const y = 0.1 + i * 0.075, w = 0.3 * Math.sin(((i + 1) / 10) * PI) + 0.06;
            k.add(capsule(0.035, w * 2), i % 2 ? a : shade(a, 0.12), 'gloss', { p: [0, y, 0.05], r: [0, 0, PI / 2] });
        }
        k.add(sphere(0.2, 16, 10), shade(a, 0.05), 'gloss', { p: [0, 0.82, 0.03], s: [1.3, 0.6, 0.4] });
        k.add(capsule(0.04, 0.6), b, 'gloss', { p: [0, 0.45, 0.09] });
        k.add(bumpy(box(0.9, 1.0, 0.1, 4, 4, 1), 0.02, 3, 9), '#bdb2a0', 'flat', { p: [0, 0.48, -0.06] });
    },
    shell(k, a, b) {
        const pts = [], radii = [];
        for (let i = 0; i <= 60; i++) {
            const t = (i / 60) * 2.6 * PI * 2;
            const r = 0.04 * Math.exp(0.128 * t);
            pts.push([Math.cos(t) * r, 0.42 + Math.sin(t) * r, 0]);
            radii.push(r * 0.5 * (1 + 0.08 * Math.sin(t * 7)));
        }
        k.add(tube(pts, radii, 12), (x, y, z) => (Math.sin(Math.atan2(y - 0.42, x) * 9) > 0.3 ? b : a), 'pearl');
    },
    amber(k, a, b) {
        k.add(bumpy(sphere(0.3, 20, 14), 0.04, 3, 5), a, 'amber', { p: [0, 0.35, 0], s: [0.9, 1.2, 0.7] });
        k.add(capsule(0.03, 0.08), b, 'matte', { p: [0, 0.37, 0] });
        for (const s of [-1, 1]) k.add(sphere(0.05, 8, 6), b, 'matte', { p: [s * 0.05, 0.42, 0], s: [1.3, 0.4, 0.2], r: [0, 0, s * 0.5] });
    },
    slab(k, a, b) {
        k.add(bumpy(box(0.7, 0.9, 0.12, 6, 6, 1), 0.02, 4, 2), a, 'flat', { p: [0, 0.45, 0] });
        k.add(box(0.02, 0.7, 0.02), b, 'matte', { p: [0, 0.45, 0.07] });
        for (let i = 0; i < 7; i++) for (const s of [-1, 1]) k.add(sphere(0.06, 8, 6), b, 'matte', { p: [s * 0.1, 0.18 + i * 0.09, 0.07], s: [1.6, 0.5, 0.2], r: [0, 0, s * 0.5] });
    },
    tooth(k, a, b) {
        k.add(extrude([[-0.32, 0.25], [0.32, 0.25], [0.26, 0.15], [0, -0.55], [-0.26, 0.15]], 0.14, 0.04, 4), (x, y) => (y > 0.15 ? b : a), 'gloss', { p: [0, 0.55, 0] });
    },
    egg(k, a, b) {
        k.add(bumpy(sphere(0.3, 22, 16), 0.015, 6, 8), (x, y, z) => (Math.sin(x * 30) * Math.sin(y * 24 + z * 10) > 0.5 ? b : a), 'flat', { p: [0, 0.38, 0], s: [1, 1.3, 1] });
        k.add(lathe([[0, 0], [0.3, 0], [0.32, 0.1], [0.22, 0.14], [0, 0.14]], 20), '#8a6a4a', 'flat', { p: [0, -0.02, 0] });
    },
    coral(k, a, b) {
        const branch = (p, dir, len, r, depth) => {
            const end = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
            k.add(tube([p, [(p[0] + end[0]) / 2 + dir[2] * 0.05, (p[1] + end[1]) / 2, (p[2] + end[2]) / 2], end], [r, r * 0.8, r * 0.6], 6), a, 'gloss');
            k.add(sphere(r * 0.7, 8, 6), b, 'gloss', { p: end });
            if (depth > 0) for (const s of [-1, 1]) branch(end, [dir[0] + s * 0.5, dir[1], dir[2] + s * 0.2], len * 0.7, r * 0.7, depth - 1);
        };
        branch([0, 0, 0], [0, 1, 0], 0.35, 0.06, 2);
        k.add(cyl(0.18, 0.2, 0.06, 12), '#d8cfc0', 'flat', { p: [0, 0, 0] });
    },
    pearl(k, a, b) {
        const g = new THREE.SphereGeometry(0.36, 24, 12, 0, PI * 2, PI / 2, PI / 2);
        k.add(g, '#7a6a8a', 'gloss', { p: [0, 0.2, -0.05], s: [1, 0.5, 1] });
        k.add(new THREE.SphereGeometry(0.36, 24, 12, 0, PI * 2, 0, PI / 2), shade(b, -0.3), 'gloss', { p: [0, 0.24, -0.25], s: [1, 0.5, 1], r: [-1.1, 0, 0] });
        k.add(sphere(0.17, 24, 18), a, 'pearl', { p: [0, 0.32, 0.02] });
    },
    urchin(k, a, b) {
        k.add(sphere(0.34, 24, 14), a, 'flat', { p: [0, 0.2, 0], s: [1, 0.6, 1] });
        for (let i = 0; i < 5; i++) {
            const t = (i / 5) * PI * 2;
            for (let j = 1; j < 5; j++) k.add(sphere(0.022, 6, 4), b, 'matte', { p: [Math.cos(t) * j * 0.065, 0.2 + 0.2 * Math.sqrt(1 - (j * 0.065 / 0.34) ** 2), Math.sin(t) * j * 0.065] });
        }
    },
    throne(k, a, b) {
        k.add(box(0.6, 0.1, 0.5), a, 'gloss', { p: [0, 0.35, 0] });
        k.add(box(0.6, 0.6, 0.08), a, 'gloss', { p: [0, 0.7, -0.22] });
        for (const x of [-0.26, 0.26]) for (const z of [-0.2, 0.2]) k.add(cyl(0.04, 0.05, 0.35, 8), shade(a, -0.15), 'gloss', { p: [x, 0.17, z] });
        k.add(box(0.5, 0.06, 0.42), b, 'fur', { p: [0, 0.42, 0] });
        k.add(sphere(0.08), b, 'gem', { p: [0, 1.0, -0.22] });
    },
    gong(k, a, b) {
        k.add(cyl(0.3, 0.3, 0.04, 32), a, 'gold', { r: [PI / 2, 0, 0], p: [0, 0.5, 0] });
        k.add(sphere(0.08), shade(a, 0.1), 'gold', { p: [0, 0.5, 0.02], s: [1, 1, 0.4] });
        for (const s of [-1, 1]) k.add(cyl(0.035, 0.035, 0.9, 8), b, 'gloss', { p: [s * 0.4, 0.45, 0] });
        k.add(box(0.9, 0.06, 0.06), b, 'gloss', { p: [0, 0.9, 0] });
    },
    globe(k, a, b) {
        k.add(sphere(0.3, 28, 20), (x, y, z) => (Math.sin(x * 9) + Math.sin(y * 7 + z * 8) > 0.6 ? b : a), 'gloss', { p: [0, 0.5, 0] });
        k.add(torus(0.34, 0.015, 6, 32, PI), '#c9973f', 'gold', { p: [0, 0.5, 0], r: [0, 0, 0.4] });
        k.add(cyl(0.03, 0.06, 0.14, 8), '#c9973f', 'gold', { p: [0, 0.12, 0] });
        k.add(cyl(0.18, 0.2, 0.05, 16), '#6b4a2a', 'gloss', { p: [0, 0.03, 0] });
    },
    telescope(k, a, b) {
        k.add(cyl(0.06, 0.1, 0.8, 16), a, 'gold', { p: [0, 0.65, 0], r: [0, 0, 1.0] });
        k.add(torus(0.1, 0.02, 6, 16), shade(a, -0.15), 'gold', { p: [0.33, 0.87, 0], r: [0, PI / 2, -0.55] });
        for (const s of [-1, 0, 1]) k.add(cyl(0.015, 0.015, 0.62, 6), b, 'gloss', { p: [s * 0.14, 0.27, s === 0 ? -0.14 : 0.07], r: [s * 0.25, 0, -s * 0.25] });
    },
    gem(k, a, b) {
        k.add(new THREE.OctahedronGeometry(0.32, 1), a, 'gem', { p: [0, 0.45, 0], s: [1, 1.2, 1] });
        k.add(cyl(0.22, 0.26, 0.12, 6), '#d9b345', 'gold', { p: [0, 0.03, 0] });
        k.add(extrude(starShape(6, 0.12, 0.03), 0.01, 0.004, 1), b, 'glow', { p: [0, 0.48, 0.3] });
    },
    harp(k, a, b) {
        k.add(tube([[-0.2, 0, 0], [-0.25, 0.4, 0], [-0.1, 0.85, 0], [0.25, 0.8, 0], [0.3, 0.6, 0]], [0.04, 0.05, 0.04, 0.04, 0.035], 8), a, 'gloss');
        k.add(cyl(0.03, 0.04, 0.62, 8), a, 'gloss', { p: [0.27, 0.3, 0] });
        for (let i = 0; i < 7; i++) {
            const x = -0.16 + i * 0.065;
            const top = 0.82 - Math.abs(x - 0.05) * 0.4;
            k.add(cyl(0.005, 0.005, top - 0.06, 4), b, 'metal', { p: [x, 0.05 + (top - 0.06) / 2, 0] });
        }
        k.add(box(0.6, 0.06, 0.1), shade(a, -0.15), 'gloss', { p: [0.05, 0.02, 0] });
    },
};

/** A finished artifact: a group whose largest side is `size`, centred on the origin. */
export function buildArtifact(item, size = 1) {
    const k = new Kit();
    (KINDS[item.kind] || KINDS.vase)(k, item.a || '#c87a4a', item.b || '#f1e3c2');
    return normalize(k.build(), size);
}

export const ARTIFACT_KINDS = Object.keys(KINDS);
