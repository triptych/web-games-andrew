/**
 * models.js — procedural toy models for every catalog item, built from js/view/builder.js.
 *
 * A model faces +z (its front door looks south), sits on y = 0 (the land's top) and is centred on its
 * footprint, so a 2×1 item spans x ∈ [−1, 1]. buildItem(id) returns:
 *   { geo, spin?: { geo, pivot: [x,y,z], axis: 'x'|'y'|'z', speed }, bob?: amplitude }
 * Geometry is cached per id.
 */

import * as THREE from 'three';
import { Builder } from './builder.js';

export const C = {
    white: 0xf4f1ea, cream: 0xf3e3c3, red: 0xd8352a, dkred: 0xa3261f, yellow: 0xf6c21c, blue: 0x1f6fd1, ltblue: 0x7cc6f2,
    green: 0x35a548, dkgreen: 0x1d6b3a, leaf: 0x4fb548, brown: 0x7a4a26, dkbrown: 0x4f2f17, tan: 0xd9b77e, grey: 0x9aa1a8,
    ltgrey: 0xc4c9ce, dkgrey: 0x5b6067, black: 0x2a2b30, orange: 0xf57d1f, pink: 0xf27bb2, lilac: 0x9a77d6, teal: 0x18a8a2,
    win: 0xfff0b8, glass: 0xbfe6f7, plate: 0xb9bec4, gold: 0xe8b830, sand: 0xe9cf94, water: 0x5cc2e8, skin: 0xf7d046,
};

/** The little grey baseplate every building stands on, with studs peeking out along the front. */
function plate(b, w = 0.92, d = 0.92, front = true, color = C.plate) {
    b.box(w, 0.05, d, color);
    if (front) b.studs(0, 0.05, d / 2 - 0.06, Math.round(w / 0.16), 1, 0.16, color, 0.03);
}

function windows(b, xs, y, z, w = 0.12, h = 0.12) {
    for (const x of xs) {
        b.box(w + 0.03, h + 0.03, 0.015, C.white, x, y - 0.015, z);
        b.box(w, h, 0.02, C.win, x, y, z + 0.004, { glow: 1 });
    }
}

function house(b, wall, roof, door) {
    plate(b);
    b.box(0.7, 0.4, 0.56, wall, 0, 0.05, 0);
    b.gable(0.8, 0.27, 0.68, roof, 0, 0.45, 0);
    b.box(0.14, 0.24, 0.03, door, 0, 0.05, 0.285);
    b.sphere(0.012, C.gold, 0.04, 0.17, 0.305);
    windows(b, [-0.21, 0.21], 0.2, 0.285);
    b.box(0.09, 0.22, 0.09, C.dkred, 0.22, 0.52, -0.12);
    b.box(0.2, 0.04, 0.12, C.ltgrey, 0, 0.05, 0.36);
    b.sphere(0.06, C.leaf, -0.36, 0.11, 0.33);
}

function awning(b, w, y, z, c1, c2, n = 6) {
    for (let i = 0; i < n; i++) b.box(w / n, 0.025, 0.2, i % 2 ? c2 : c1, -w / 2 + (i + 0.5) * (w / n), y, z + 0.08, { rx: 0.45 });
}

function shop(b, wall, trim, c1, c2) {
    plate(b);
    b.box(0.74, 0.46, 0.58, wall, 0, 0.05, 0);
    b.box(0.8, 0.06, 0.64, trim, 0, 0.51, 0);
    b.studs(0, 0.57, 0, 4, 3, 0.17, trim);
    b.box(0.5, 0.2, 0.02, C.glass, 0, 0.12, 0.295, { glow: 0.6 });
    b.box(0.12, 0.26, 0.03, C.dkbrown, 0.28, 0.05, 0.29);
    awning(b, 0.72, 0.36, 0.28, c1, c2);
}

const TREE_TRUNK = (b, h = 0.3, r = 0.05) => b.cyl(r, h, C.brown, 0, 0, 0, { rt: r * 0.75, seg: 7 });

const MODELS = {
    // ---------------------------------------------------------------- homes
    house_red: (b) => house(b, C.cream, C.red, C.blue),
    house_blue: (b) => house(b, C.ltblue, C.blue, C.yellow),
    house_yellow: (b) => house(b, C.yellow, C.dkred, C.green),
    house_green: (b) => house(b, 0xa6d68a, C.dkgreen, C.red),
    cottage(b) {
        plate(b);
        b.box(0.66, 0.36, 0.52, C.white, 0, 0.05, 0);
        b.gable(0.84, 0.36, 0.74, C.tan, 0, 0.38, 0);
        b.box(0.86, 0.04, 0.12, 0xc9a35f, 0, 0.72, 0);
        b.box(0.14, 0.22, 0.03, C.dkred, 0, 0.05, 0.26);
        windows(b, [-0.2, 0.2], 0.18, 0.26, 0.1, 0.1);
        b.sphere(0.07, C.pink, -0.33, 0.1, 0.33);
        b.sphere(0.06, C.yellow, 0.34, 0.1, 0.34);
    },
    townhouse(b) {
        plate(b);
        b.box(0.62, 0.78, 0.56, 0xe08d6a, 0, 0.05, 0);
        b.gable(0.68, 0.24, 0.62, C.dkgrey, 0, 0.83, 0);
        b.box(0.14, 0.24, 0.03, C.navy || 0x223a73, 0, 0.05, 0.285);
        windows(b, [-0.17, 0.17], 0.2, 0.285, 0.11, 0.13);
        windows(b, [-0.17, 0.17], 0.52, 0.285, 0.11, 0.13);
        b.box(0.66, 0.03, 0.08, C.white, 0, 0.43, 0.3);
        b.box(0.08, 0.22, 0.08, C.dkred, -0.2, 0.92, 0.1);
    },
    flats(b) {
        plate(b);
        b.box(0.72, 1.05, 0.62, 0xd9d2c3, 0, 0.05, 0);
        for (let f = 0; f < 3; f++) windows(b, [-0.22, 0, 0.22], 0.2 + f * 0.3, 0.315, 0.12, 0.14);
        b.box(0.78, 0.06, 0.68, C.teal, 0, 1.1, 0);
        b.studs(0, 1.16, 0, 4, 4, 0.16, C.teal);
        b.box(0.16, 0.18, 0.03, C.teal, 0, 0.05, 0.315);
    },
    beach_hut(b) {
        b.box(0.7, 0.05, 0.7, C.tan);
        const cols = [C.white, C.blue];
        for (let i = 0; i < 6; i++) b.box(0.08, 0.42, 0.46, cols[i % 2], -0.2 + i * 0.08, 0.05, 0);
        b.gable(0.56, 0.18, 0.56, C.red, 0, 0.47, 0);
        b.box(0.14, 0.26, 0.02, C.yellow, 0, 0.05, 0.235);
        b.box(0.4, 0.03, 0.18, 0xc9a35f, 0, 0.05, 0.3);
    },
    igloo(b) {
        b.sphere(0.36, 0xf2f8ff, 0, 0, 0, { half: true, seg: 14, rings: 6 });
        b.cyl(0.13, 0.26, 0xe4f0fb, 0, 0.0, 0.3, { rx: Math.PI / 2, centre: true, seg: 10, ts: -Math.PI / 2, tl: Math.PI });
        b.box(0.16, 0.14, 0.02, 0x30436b, 0, 0.0, 0.44);
        for (let i = 0; i < 3; i++) b.torus(0.36 * Math.cos(0.35 * (i + 1)), 0.008, 0xd7e6f5, 0, 0.36 * Math.sin(0.35 * (i + 1)), 0, { rx: Math.PI / 2 });
    },
    treehouse(b) {
        b.cyl(0.09, 0.62, C.brown, 0, 0, 0, { rt: 0.07, seg: 8 });
        b.sphere(0.32, C.leaf, 0, 0.92, -0.05, { seg: 10 });
        b.sphere(0.22, C.green, 0.22, 0.8, 0.1, { seg: 10 });
        b.box(0.42, 0.04, 0.42, 0xb07a40, 0, 0.5, 0.06);
        b.box(0.32, 0.26, 0.3, 0xd49a55, 0, 0.54, 0.06);
        b.gable(0.4, 0.14, 0.38, C.red, 0, 0.8, 0.06);
        b.box(0.08, 0.1, 0.02, C.win, 0, 0.64, 0.215, { glow: 1 });
        for (let i = 0; i < 5; i++) b.box(0.12, 0.02, 0.02, C.tan, 0.14, 0.08 + i * 0.09, 0.3);
        b.box(0.02, 0.5, 0.02, C.tan, 0.09, 0.02, 0.3); b.box(0.02, 0.5, 0.02, C.tan, 0.19, 0.02, 0.3);
    },
    // ---------------------------------------------------------------- town
    bakery(b) {
        shop(b, C.cream, C.dkbrown, C.red, C.white);
        b.sphere(0.12, 0xd8913c, 0, 0.7, 0.05, { sx: 1.6, sy: 0.8 });
        b.box(0.04, 0.08, 0.04, C.dkbrown, 0, 0.57, 0.05);
    },
    cafe(b) {
        shop(b, C.teal, C.white, C.white, C.teal);
        b.cyl(0.07, 0.06, C.white, 0, 0.57, 0.05);
        b.cyl(0.05, 0.12, C.white, 0, 0.62, 0.05, { rt: 0.06 });
        b.torus(0.04, 0.012, C.white, 0.07, 0.68, 0.05);
        for (const x of [-0.25, 0.25]) { b.cyl(0.06, 0.012, C.white, x, 0.14, 0.4); b.cyl(0.01, 0.13, C.dkgrey, x, 0.0, 0.4); }
    },
    toyshop(b) {
        shop(b, C.yellow, C.red, C.blue, C.yellow);
        b.sphere(0.1, 0xb27142, 0, 0.7, 0.05);
        b.sphere(0.065, 0xb27142, 0, 0.84, 0.05);
        b.sphere(0.028, 0xb27142, -0.05, 0.9, 0.05); b.sphere(0.028, 0xb27142, 0.05, 0.9, 0.05);
        b.sphere(0.014, C.black, -0.02, 0.85, 0.11); b.sphere(0.014, C.black, 0.02, 0.85, 0.11);
    },
    icecream(b) {
        shop(b, C.pink, C.white, C.pink, C.white);
        b.cone(0.09, 0.26, 0xe0a85c, 0, 0.57, 0.05, { rx: Math.PI });
        b.sphere(0.1, 0xfff3e0, 0, 0.88, 0.05);
        b.sphere(0.085, C.pink, 0, 1.0, 0.05);
        b.sphere(0.03, C.red, 0, 1.1, 0.05);
    },
    postoffice(b) {
        plate(b);
        b.box(0.74, 0.5, 0.58, C.red, 0, 0.05, 0);
        b.box(0.8, 0.07, 0.64, C.white, 0, 0.55, 0);
        b.studs(0, 0.62, 0, 4, 3, 0.17, C.white);
        b.box(0.16, 0.26, 0.03, C.dkbrown, 0, 0.05, 0.29);
        windows(b, [-0.24, 0.24], 0.2, 0.29);
        b.box(0.3, 0.18, 0.04, C.white, 0, 0.64, 0.1);
        b.box(0.06, 0.06, 0.045, C.red, 0.09, 0.7, 0.1);
        b.cyl(0.05, 0.22, C.red, 0.36, 0.05, 0.36);
        b.sphere(0.05, C.red, 0.36, 0.27, 0.36, { half: true });
    },
    library(b) {
        plate(b);
        b.box(0.76, 0.5, 0.56, 0xe6dccb, 0, 0.05, -0.04);
        for (const x of [-0.3, -0.1, 0.1, 0.3]) b.cyl(0.035, 0.42, C.white, x, 0.08, 0.28, { seg: 8 });
        b.box(0.8, 0.04, 0.24, C.white, 0, 0.5, 0.18);
        b.gable(0.82, 0.16, 0.7, 0xe6dccb, 0, 0.55, 0.0);
        b.box(0.7, 0.03, 0.2, C.ltgrey, 0, 0.05, 0.34);
        b.box(0.16, 0.26, 0.02, C.dkbrown, 0, 0.08, 0.245);
        b.box(0.12, 0.08, 0.02, C.blue, -0.18, 0.62, 0.36);
    },
    clinic(b) {
        plate(b);
        b.box(0.76, 0.5, 0.58, C.white, 0, 0.05, 0);
        b.box(0.8, 0.06, 0.62, C.ltblue, 0, 0.55, 0);
        b.box(0.22, 0.06, 0.03, C.red, 0, 0.66, 0.06); b.box(0.06, 0.22, 0.03, C.red, 0, 0.58, 0.06);
        b.box(0.04, 0.12, 0.04, C.white, 0, 0.6, 0.02);
        b.box(0.18, 0.26, 0.03, C.glass, 0, 0.05, 0.295, { glow: 0.5 });
        windows(b, [-0.25, 0.25], 0.22, 0.29);
    },
    firestation(b) {
        plate(b, 1.9, 0.92);
        b.box(1.6, 0.55, 0.62, C.red, -0.1, 0.05, 0);
        b.box(1.66, 0.06, 0.68, C.white, -0.1, 0.6, 0);
        for (const x of [-0.5, 0.1]) { b.box(0.44, 0.38, 0.03, C.white, x, 0.05, 0.31); b.box(0.38, 0.33, 0.03, 0x8a1f2c, x, 0.05, 0.32); for (let k = 1; k < 4; k++) b.box(0.38, 0.015, 0.035, C.white, x, 0.05 + k * 0.08, 0.32); }
        b.box(0.26, 1.0, 0.26, C.red, 0.78, 0.05, -0.12);
        b.box(0.32, 0.06, 0.32, C.white, 0.78, 1.05, -0.12);
        b.cone(0.18, 0.2, C.dkgrey, 0.78, 1.11, -0.12, { seg: 4, ry: Math.PI / 4 });
        windows(b, [0.78], 0.75, 0.015, 0.1, 0.12);
        b.sphere(0.06, C.gold, 0.32, 0.7, 0.2);
    },
    school(b) {
        plate(b, 1.9, 0.92);
        b.box(1.7, 0.56, 0.6, 0xe07a4a, 0, 0.05, 0);
        b.gable(1.8, 0.26, 0.7, C.dkgrey, 0, 0.61, 0);
        windows(b, [-0.6, -0.3, 0.3, 0.6], 0.25, 0.3, 0.14, 0.16);
        b.box(0.2, 0.3, 0.03, C.blue, 0, 0.05, 0.3);
        b.box(0.24, 0.32, 0.24, C.white, 0, 0.75, 0);
        b.cyl(0.07, 0.02, C.white, 0, 0.88, 0.125, { rx: Math.PI / 2, centre: true });
        b.cyl(0.06, 0.03, C.gold, 0, 0.9, 0.12, { rx: Math.PI / 2, centre: true });
        b.cone(0.2, 0.24, C.red, 0, 1.07, 0, { seg: 4, ry: Math.PI / 4 });
        b.box(0.02, 0.36, 0.02, C.grey, -0.75, 0.05, 0.42); b.box(0.16, 0.1, 0.01, C.yellow, -0.67, 0.31, 0.42);
    },
    townhall(b) {
        b.box(1.88, 0.05, 1.88, C.plate);
        b.studs(0, 0.05, 0.85, 11, 1, 0.16, C.plate, 0.03);
        b.box(1.4, 0.7, 1.1, 0xf0e6d2, 0, 0.05, -0.15);
        for (let i = 0; i < 6; i++) b.cyl(0.05, 0.62, C.white, -0.6 + i * 0.24, 0.12, 0.48, { seg: 10 });
        b.box(1.5, 0.06, 0.4, C.white, 0, 0.74, 0.32);
        b.gable(1.5, 0.22, 0.4, 0xf0e6d2, 0, 0.8, 0.32, { ry: 0 });
        b.box(1.5, 0.07, 1.2, C.white, 0, 0.75, -0.15);
        b.cyl(0.32, 0.26, 0xf0e6d2, 0, 0.82, -0.2, { seg: 16 });
        b.sphere(0.34, 0x5bb3a8, 0, 1.08, -0.2, { half: true, seg: 16 });
        b.cyl(0.015, 0.36, C.grey, 0, 1.4, -0.2); b.box(0.2, 0.12, 0.01, C.red, 0.1, 1.62, -0.2);
        for (let k = 0; k < 3; k++) b.box(1.3 - k * 0.12, 0.04, 0.12, C.ltgrey, 0, 0.05 + k * 0.04, 0.62 - k * 0.06);
        b.box(0.26, 0.4, 0.03, C.dkbrown, 0, 0.17, 0.41);
        windows(b, [-0.5, -0.25, 0.25, 0.5], 0.3, 0.41, 0.1, 0.18);
        b.cyl(0.1, 0.03, C.white, 0, 1.0, 0.53, { rx: Math.PI / 2, centre: true }); b.cyl(0.085, 0.035, C.gold, 0, 1.0, 0.53, { rx: Math.PI / 2, centre: true });
        for (const x of [-0.85, 0.85]) { b.sphere(0.13, C.leaf, x, 0.18, 0.75); b.sphere(0.04, C.pink, x + 0.05, 0.28, 0.82); }
    },
    market(b) {
        b.box(0.8, 0.04, 0.8, C.tan);
        for (const [x, z] of [[-0.32, -0.25], [0.32, -0.25], [-0.32, 0.25], [0.32, 0.25]]) b.box(0.04, 0.55, 0.04, C.white, x, 0.04, z);
        b.box(0.7, 0.18, 0.4, 0xb07a40, 0, 0.04, 0.05);
        for (let i = 0; i < 6; i++) b.box(0.12, 0.03, 0.72, i % 2 ? C.white : C.green, -0.3 + i * 0.12, 0.59, 0, { rx: 0 });
        const fr = [C.red, C.orange, C.yellow, C.green, C.red, C.lilac];
        for (let i = 0; i < 12; i++) b.sphere(0.04, fr[i % 6], -0.26 + (i % 6) * 0.1, 0.25, -0.05 + Math.floor(i / 6) * 0.15, { seg: 6, rings: 4 });
    },
    clocktower(b) {
        plate(b, 0.7, 0.7, false);
        b.box(0.42, 1.3, 0.42, 0xd8c9a8, 0, 0.05, 0);
        b.box(0.5, 0.06, 0.5, C.white, 0, 0.5, 0); b.box(0.5, 0.06, 0.5, C.white, 0, 1.35, 0);
        for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2, x = Math.sin(a) * 0.215, z = Math.cos(a) * 0.215;
            b.cyl(0.14, 0.02, C.white, x, 1.12, z, { rx: Math.PI / 2, ry: a, order: 'YXZ', centre: true, seg: 16 });
            b.box(0.015, 0.1, 0.02, C.black, x * 1.06, 1.12, z * 1.06, { ry: a });
            b.box(0.075, 0.015, 0.02, C.black, x * 1.06 + Math.cos(a) * 0.03, 1.12, z * 1.06 - Math.sin(a) * 0.03, { ry: a });
        }
        b.cone(0.34, 0.5, 0x2f6f8f, 0, 1.41, 0, { seg: 4, ry: Math.PI / 4 });
        b.sphere(0.04, C.gold, 0, 1.94, 0);
        b.box(0.16, 0.26, 0.03, C.dkbrown, 0, 0.05, 0.21);
    },
    fountain(b) {
        b.cyl(0.42, 0.12, C.ltgrey, 0, 0, 0, { seg: 16 });
        b.cyl(0.36, 0.13, C.water, 0, 0, 0, { seg: 16, glow: 0.2 });
        b.cyl(0.07, 0.34, C.ltgrey, 0, 0, 0, { seg: 8 });
        b.cyl(0.16, 0.04, C.ltgrey, 0, 0.34, 0, { seg: 12 });
        b.cyl(0.13, 0.045, C.water, 0, 0.34, 0, { seg: 12, glow: 0.2 });
        b.sphere(0.06, 0xd8f2ff, 0, 0.46, 0, { glow: 0.3 });
        for (let k = 0; k < 6; k++) { const a = k * 1.047; b.sphere(0.03, 0xd8f2ff, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, { seg: 6, rings: 4 }); }
    },
    // ---------------------------------------------------------------- railway
    engineshed(b) {
        plate(b, 1.9, 0.92, false);
        b.box(1.7, 0.62, 0.66, 0xb5533c, 0, 0.05, -0.05);
        b.gable(1.82, 0.3, 0.78, C.dkgrey, 0, 0.67, -0.05);
        for (const x of [-0.42, 0.42]) {
            b.box(0.5, 0.48, 0.03, 0x2c2a2e, x, 0.05, 0.29);
            b.cyl(0.25, 0.03, 0x2c2a2e, x, 0.53, 0.29, { rx: Math.PI / 2, centre: true, ts: -Math.PI / 2, tl: Math.PI, seg: 12 });
            b.box(0.5, 0.012, 0.36, 0x5a5149, x, 0.05, 0.42);
            for (const s of [-0.1, 0.1]) b.box(0.02, 0.02, 0.36, C.grey, x + s, 0.062, 0.42);
        }
        for (let i = 0; i < 4; i++) b.box(0.18, 0.08, 0.12, C.glass, -0.6 + i * 0.4, 0.86, -0.05, { glow: 0.6 });
        b.cyl(0.05, 0.3, C.dkgrey, 0.6, 0.85, -0.25);
    },
    watertower(b) {
        for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.box(0.05, 0.62, 0.05, C.dkbrown, x, 0, z);
        b.box(0.4, 0.03, 0.03, C.brown, 0, 0.3, 0.18); b.box(0.4, 0.03, 0.03, C.brown, 0, 0.3, -0.18);
        b.cyl(0.28, 0.36, 0x4a7fb0, 0, 0.62, 0, { seg: 14 });
        for (const y of [0.7, 0.86]) b.torus(0.285, 0.012, C.dkgrey, 0, y, 0, { rx: Math.PI / 2 });
        b.cone(0.32, 0.18, C.dkgrey, 0, 0.98, 0, { seg: 14 });
        b.cyl(0.03, 0.3, C.dkgrey, 0.3, 0.68, 0, { rz: -1.2, centre: true });
    },
    signalbox(b) {
        plate(b, 0.8, 0.8, false);
        b.box(0.56, 0.36, 0.46, 0xb5533c, 0, 0.05, 0);
        b.box(0.6, 0.3, 0.5, 0xf0e2c0, 0, 0.41, 0);
        for (const z of [-0.255, 0.255]) b.box(0.5, 0.18, 0.01, C.win, 0, 0.47, z, { glow: 1 });
        for (const x of [-0.305, 0.305]) b.box(0.01, 0.18, 0.4, C.win, x, 0.47, 0, { glow: 1 });
        b.gable(0.68, 0.18, 0.58, C.dkgreen, 0, 0.71, 0);
        for (let i = 0; i < 4; i++) b.box(0.14, 0.03, 0.08, C.dkbrown, 0.36, 0.05 + i * 0.09, 0.12 - i * 0.07);
        b.box(0.34, 0.07, 0.04, C.white, 0, 0.33, 0.25);
    },
    signal(b) {
        b.cyl(0.08, 0.04, C.dkgrey, 0, 0, 0);
        b.cyl(0.022, 0.62, C.ltgrey, 0, 0.04, 0);
        b.box(0.1, 0.22, 0.06, C.black, 0, 0.5, 0.03);
        b.sphere(0.03, 0xff4030, 0, 0.66, 0.065, { glow: 1.2 });
        b.sphere(0.03, 0x40e060, 0, 0.56, 0.065, { glow: 1.2 });
    },
    crates(b) {
        const cols = [C.orange, C.blue, C.red, C.green, C.yellow];
        b.box(0.28, 0.24, 0.28, cols[0], -0.15, 0, -0.1);
        b.box(0.28, 0.24, 0.28, cols[1], 0.17, 0, -0.08, { ry: 0.2 });
        b.box(0.24, 0.22, 0.24, cols[2], 0.0, 0.24, -0.1, { ry: -0.15 });
        b.box(0.22, 0.2, 0.22, cols[3], 0.05, 0, 0.22, { ry: 0.5 });
        b.box(0.5, 0.04, 0.5, 0xb07a40, 0, 0, 0, { sy: 0.5 });
    },
    barrels(b) {
        const cols = [C.blue, C.red, C.green, C.blue];
        const pos = [[-0.14, -0.1], [0.14, -0.1], [0, 0.14], [0.22, 0.2]];
        pos.forEach(([x, z], i) => { b.cyl(0.11, 0.3, cols[i], x, 0, z, { seg: 10 }); b.torus(0.112, 0.01, C.dkgrey, x, 0.08, z, { rx: Math.PI / 2 }); b.torus(0.112, 0.01, C.dkgrey, x, 0.22, z, { rx: Math.PI / 2 }); });
        b.cyl(0.11, 0.3, C.yellow, 0, 0.3, -0.1, { seg: 10 });
    },
    // ---------------------------------------------------------------- fun
    windmill(b) {
        plate(b, 0.8, 0.8, false, C.tan);
        b.cyl(0.3, 0.95, C.white, 0, 0.04, 0, { rt: 0.2, seg: 8 });
        b.box(0.14, 0.24, 0.03, C.blue, 0, 0.04, 0.29, { rx: -0.1 });
        windows(b, [0], 0.55, 0.235, 0.08, 0.1);
        b.cone(0.27, 0.3, C.red, 0, 0.99, 0, { seg: 8 });
        b.cyl(0.04, 0.12, C.dkgrey, 0, 1.12, 0.22, { rx: Math.PI / 2, centre: true });
    },
    lighthouse(b) {
        b.cyl(0.36, 0.08, C.ltgrey, 0, 0, 0, { seg: 14 });
        const segs = 5;
        for (let i = 0; i < segs; i++) {
            const r0 = 0.26 - i * 0.025, r1 = 0.26 - (i + 1) * 0.025;
            b.cyl(r0, 0.26, i % 2 ? C.white : C.red, 0, 0.08 + i * 0.26, 0, { rt: r1, seg: 14 });
        }
        const top = 0.08 + segs * 0.26;
        b.cyl(0.2, 0.04, C.dkgrey, 0, top, 0, { seg: 14 });
        b.cyl(0.12, 0.22, 0xfff3b0, 0, top + 0.04, 0, { seg: 10, glow: 1.6 });
        b.cone(0.17, 0.18, C.red, 0, top + 0.26, 0, { seg: 10 });
        b.sphere(0.03, C.gold, 0, top + 0.46, 0);
        b.box(0.12, 0.2, 0.03, C.dkbrown, 0, 0.08, 0.255);
    },
    ferris(b) {
        b.box(1.86, 0.05, 1.86, C.plate);
        b.cyl(0.6, 0.06, C.ltgrey, 0, 0.05, 0.1, { seg: 20 });
        for (const z of [-0.25, 0.25]) {
            b.box(0.05, 1.45, 0.05, C.white, -0.35, 0.05, z, { rz: -0.24 });
            b.box(0.05, 1.45, 0.05, C.white, 0.35, 0.05, z, { rz: 0.24 });
        }
        b.cyl(0.04, 0.6, C.dkgrey, 0, 1.45, 0, { rx: Math.PI / 2, centre: true });
        b.box(0.5, 0.25, 0.3, C.red, 0.55, 0.05, 0.6);
        b.box(0.12, 0.12, 0.02, C.win, 0.55, 0.13, 0.75, { glow: 1 });
    },
    carousel(b) {
        b.box(1.86, 0.05, 1.86, C.plate);
        b.cyl(0.8, 0.1, C.white, 0, 0.05, 0, { seg: 20 });
        b.cyl(0.78, 0.02, C.pink, 0, 0.15, 0, { seg: 20 });
    },
    castle(b) {
        b.box(1.9, 0.05, 1.9, 0x8fbf6a);
        const W = 0xb8bcc4, D = 0x8c919a;
        b.box(1.3, 0.6, 1.3, W, 0, 0.05, 0);
        for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { b.box(0.12, 0.1, 0.12, W, -0.6 + i * 0.24, 0.65, s * 0.6); b.box(0.12, 0.1, 0.12, W, s * 0.6, 0.65, -0.6 + i * 0.24); }
        for (const [x, z] of [[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]]) {
            b.cyl(0.22, 0.95, D, x, 0.05, z, { seg: 12 });
            b.cone(0.28, 0.4, (x > 0) === (z > 0) ? C.blue : C.red, x, 1.0, z, { seg: 12 });
            b.cyl(0.01, 0.2, C.grey, x, 1.38, z); b.box(0.12, 0.07, 0.01, C.yellow, x + 0.06, 1.5, z);
        }
        b.box(0.62, 1.0, 0.62, W, 0, 0.05, -0.1);
        for (const [x, z] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.18], [0.25, 0.18], [0, -0.38], [0, 0.18]]) b.box(0.1, 0.1, 0.1, W, x, 1.05, z);
        b.box(0.36, 0.42, 0.04, 0x3a2a20, 0, 0.05, 0.64);
        b.cyl(0.18, 0.04, 0x3a2a20, 0, 0.47, 0.64, { rx: Math.PI / 2, centre: true, ts: -Math.PI / 2, tl: Math.PI });
        for (const x of [-0.4, 0.4]) b.box(0.1, 0.14, 0.02, C.win, x, 0.35, 0.655, { glow: 1 });
        b.box(0.4, 0.02, 0.5, 0x8a6a40, 0, 0.05, 0.85);
    },
    balloon(b) {
        b.cyl(0.2, 0.02, C.tan, 0, 0, 0, { seg: 10 });
    },
    playground(b) {
        b.box(0.92, 0.04, 0.92, 0xe9cf94);
        b.box(0.04, 0.4, 0.04, C.red, -0.3, 0.04, -0.3); b.box(0.04, 0.4, 0.04, C.red, -0.3, 0.04, -0.1);
        b.box(0.22, 0.03, 0.26, C.yellow, -0.3, 0.42, -0.2);
        b.box(0.16, 0.02, 0.5, C.blue, -0.3, 0.24, 0.15, { rx: 0.65 });
        for (const x of [0.12, 0.42]) { b.box(0.03, 0.5, 0.03, C.green, x, 0.04, -0.2, { rz: x < 0.3 ? 0.12 : -0.12 }); b.box(0.03, 0.5, 0.03, C.green, x, 0.04, 0.2, { rz: x < 0.3 ? 0.12 : -0.12 }); }
        b.box(0.36, 0.03, 0.44, C.green, 0.27, 0.52, 0);
        for (const z of [-0.08, 0.08]) { b.box(0.008, 0.3, 0.008, C.dkgrey, 0.27, 0.22, z); b.box(0.1, 0.02, 0.06, C.red, 0.27, 0.2, z); }
    },
    bandstand(b) {
        b.cyl(0.45, 0.1, C.white, 0, 0, 0, { seg: 8 });
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; b.cyl(0.018, 0.4, C.white, Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4, { seg: 6 }); }
        b.cone(0.52, 0.3, C.dkgreen, 0, 0.5, 0, { seg: 8, ry: Math.PI / 8 });
        b.sphere(0.04, C.gold, 0, 0.82, 0);
        b.cyl(0.05, 0.12, C.gold, 0, 0.1, 0, { rt: 0.02 });
    },
    sandcastle(b) {
        const S = C.sand;
        b.box(0.5, 0.14, 0.5, S);
        for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { b.cyl(0.08, 0.2, S, x, 0.1, z, { seg: 8 }); b.cone(0.08, 0.1, S, x, 0.3, z, { seg: 8 }); }
        b.cyl(0.11, 0.26, S, 0, 0.14, 0, { seg: 8 });
        b.cyl(0.005, 0.14, C.dkgrey, 0, 0.4, 0); b.box(0.07, 0.04, 0.005, C.red, 0.035, 0.5, 0);
        b.cyl(0.04, 0.06, C.red, 0.32, 0, 0.3, { rt: 0.05 });
    },
    snowman(b) {
        b.sphere(0.18, C.white, 0, 0.16, 0);
        b.sphere(0.13, C.white, 0, 0.4, 0);
        b.sphere(0.095, C.white, 0, 0.58, 0);
        b.cone(0.02, 0.09, C.orange, 0, 0.58, 0.09, { rx: Math.PI / 2 });
        b.sphere(0.012, C.black, -0.035, 0.61, 0.085); b.sphere(0.012, C.black, 0.035, 0.61, 0.085);
        b.cyl(0.09, 0.015, C.black, 0, 0.65, 0); b.cyl(0.06, 0.09, C.black, 0, 0.66, 0);
        b.torus(0.1, 0.02, C.red, 0, 0.5, 0, { rx: Math.PI / 2 });
        for (const y of [0.36, 0.43]) b.sphere(0.012, C.black, 0, y, 0.128);
    },
    // ---------------------------------------------------------------- farm
    barn(b) {
        plate(b, 1.9, 0.92, false, 0x8fbf6a);
        b.box(1.5, 0.52, 0.66, C.red, 0, 0.05, 0);
        b.gable(1.6, 0.36, 0.78, C.dkgrey, 0, 0.57, 0);
        b.box(0.44, 0.4, 0.03, C.white, 0, 0.05, 0.33);
        b.box(0.38, 0.35, 0.03, C.dkred, 0, 0.05, 0.34);
        b.box(0.5, 0.03, 0.035, C.white, 0, 0.21, 0.35, { rz: 0.72 }); b.box(0.5, 0.03, 0.035, C.white, 0, 0.21, 0.35, { rz: -0.72 });
        b.box(0.14, 0.12, 0.02, C.white, 0, 0.62, 0.3);
        b.box(0.1, 0.08, 0.02, 0x3a2a20, 0, 0.64, 0.31);
        b.box(0.32, 0.12, 0.2, 0xf2d26b, -0.55, 0.05, 0.5);
    },
    silo(b) {
        b.cyl(0.26, 0.04, C.ltgrey, 0, 0, 0, { seg: 14 });
        b.cyl(0.22, 1.1, 0xe0e4e8, 0, 0.04, 0, { seg: 14 });
        for (let i = 1; i < 5; i++) b.torus(0.222, 0.008, C.grey, 0, 0.04 + i * 0.22, 0, { rx: Math.PI / 2 });
        b.sphere(0.22, C.red, 0, 1.14, 0, { half: true, seg: 14 });
        b.box(0.03, 1.0, 0.03, C.dkgrey, 0.2, 0.04, 0.1);
    },
    greenhouse(b) {
        b.box(0.84, 0.06, 0.64, C.white);
        b.box(0.8, 0.34, 0.6, 0xcff1e6, 0, 0.06, 0, { glow: 0.25 });
        b.gable(0.82, 0.2, 0.62, 0xcff1e6, 0, 0.4, 0, { glow: 0.25 });
        for (let i = 0; i < 5; i++) b.box(0.02, 0.36, 0.62, C.white, -0.4 + i * 0.2, 0.06, 0);
        b.box(0.82, 0.02, 0.02, C.white, 0, 0.6, 0);
        for (let i = 0; i < 6; i++) b.sphere(0.06, i % 2 ? C.leaf : C.green, -0.3 + i * 0.12, 0.14, 0.12, { seg: 6, rings: 4 });
        for (let i = 0; i < 6; i++) b.sphere(0.03, [C.red, C.pink, C.yellow][i % 3], -0.3 + i * 0.12, 0.2, 0.14, { seg: 6, rings: 4 });
    },
    haystack(b) {
        b.cyl(0.3, 0.22, 0xf2d26b, 0, 0, 0, { seg: 12 });
        b.sphere(0.3, 0xf2d26b, 0, 0.22, 0, { half: true, seg: 12, sy: 0.6 });
        b.cyl(0.2, 0.22, 0xe8c255, 0.32, 0, 0.25, { rx: Math.PI / 2, centre: true, seg: 12 });
    },
    pumpkins(b) {
        b.box(0.84, 0.03, 0.84, 0x7a5a3a);
        const pos = [[-0.25, -0.2, 0.12], [0.2, -0.25, 0.09], [0.0, 0.1, 0.14], [-0.28, 0.26, 0.08], [0.28, 0.22, 0.1]];
        for (const [x, z, r] of pos) { b.sphere(r, C.orange, x, r * 0.75, z, { sy: 0.75, seg: 10 }); b.cyl(0.015, 0.05, C.dkgreen, x, r * 1.4, z); }
        for (let i = 0; i < 6; i++) b.box(0.12, 0.01, 0.05, C.green, -0.3 + i * 0.12, 0.03, -0.38 + (i % 2) * 0.76, { ry: i });
    },
    veggies(b) {
        b.box(0.84, 0.06, 0.84, 0x6b4a2e);
        for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) {
            const x = -0.3 + i * 0.15, z = -0.3 + r * 0.2;
            if (r % 2) { b.cone(0.025, 0.06, C.orange, x, 0.04, z, { rx: Math.PI }); b.cone(0.04, 0.1, C.leaf, x, 0.06, z, { seg: 5 }); }
            else b.sphere(0.06, r === 0 ? C.green : 0x9be05a, x, 0.1, z, { seg: 8, rings: 5 });
        }
    },
    sheep(b) {
        for (const [x, z, s] of [[-0.15, -0.1, 1], [0.2, 0.15, 0.8]]) {
            b.sphere(0.13 * s, C.white, x, 0.18 * s, z, { sx: 1.3, seg: 10 });
            for (const [lx, lz] of [[-0.08, -0.06], [0.08, -0.06], [-0.08, 0.06], [0.08, 0.06]]) b.box(0.03 * s, 0.1 * s, 0.03 * s, C.black, x + lx * s, 0, z + lz * s);
            b.sphere(0.065 * s, C.black, x + 0.17 * s, 0.22 * s, z, { sx: 1.2 });
            b.sphere(0.012 * s, C.white, x + 0.23 * s, 0.24 * s, z - 0.03 * s); b.sphere(0.012 * s, C.white, x + 0.23 * s, 0.24 * s, z + 0.03 * s);
        }
    },
    cow(b) {
        b.box(0.42, 0.2, 0.2, C.white, 0, 0.14, 0);
        b.box(0.14, 0.12, 0.205, C.black, -0.06, 0.2, 0); b.box(0.08, 0.1, 0.205, C.black, 0.12, 0.15, 0);
        for (const [x, z] of [[-0.16, -0.07], [0.16, -0.07], [-0.16, 0.07], [0.16, 0.07]]) b.box(0.05, 0.14, 0.05, C.white, x, 0, z);
        b.box(0.14, 0.14, 0.14, C.white, 0.26, 0.24, 0);
        b.box(0.08, 0.08, 0.15, 0xf2a6b8, 0.33, 0.21, 0);
        for (const z of [-0.06, 0.06]) { b.cone(0.015, 0.06, C.cream, 0.24, 0.38, z); b.sphere(0.013, C.black, 0.33, 0.3, z * 0.7); }
        b.box(0.02, 0.14, 0.02, C.black, -0.22, 0.12, 0, { rz: 0.3 });
    },
    tractor(b) {
        b.box(0.34, 0.14, 0.2, C.green, 0.05, 0.12, 0);
        b.box(0.18, 0.2, 0.22, C.green, -0.1, 0.18, 0);
        b.box(0.16, 0.12, 0.2, C.glass, -0.1, 0.38, 0, { glow: 0.4 });
        b.box(0.22, 0.03, 0.26, C.yellow, -0.1, 0.5, 0);
        for (const z of [-0.14, 0.14]) { b.cyl(0.13, 0.07, C.black, -0.12, 0.13, z, { rx: Math.PI / 2, centre: true, seg: 12 }); b.cyl(0.06, 0.075, C.yellow, -0.12, 0.13, z, { rx: Math.PI / 2, centre: true, seg: 8 }); }
        for (const z of [-0.12, 0.12]) b.cyl(0.07, 0.05, C.black, 0.18, 0.07, z, { rx: Math.PI / 2, centre: true, seg: 10 });
        b.cyl(0.015, 0.18, C.dkgrey, 0.12, 0.26, 0.05);
    },
    // ---------------------------------------------------------------- nature
    tree_round(b) { TREE_TRUNK(b, 0.32); b.sphere(0.26, C.leaf, 0, 0.48, 0, { seg: 10 }); b.sphere(0.18, C.green, 0.12, 0.62, 0.06, { seg: 8 }); b.sphere(0.16, 0x5fc24f, -0.12, 0.4, 0.12, { seg: 8 }); },
    tree_pine(b) { TREE_TRUNK(b, 0.2, 0.05); for (let i = 0; i < 3; i++) b.cone(0.3 - i * 0.07, 0.34, C.dkgreen, 0, 0.14 + i * 0.2, 0, { seg: 8 }); },
    tree_palm(b) {
        let x = 0, y = 0;
        for (let i = 0; i < 6; i++) { b.cyl(0.05 - i * 0.004, 0.13, i % 2 ? 0xa57844 : 0x8f6436, x, y, 0, { rz: -0.08 * i, seg: 7 }); x += Math.sin(0.08 * i) * 0.13; y += 0.125; }
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.box(0.36, 0.02, 0.1, k % 2 ? C.leaf : C.green, x + Math.cos(a) * 0.16, y - 0.04, Math.sin(a) * 0.16, { ry: -a, rz: -0.35 }); }
        b.sphere(0.04, C.brown, x + 0.04, y - 0.03, 0.03); b.sphere(0.04, C.brown, x - 0.03, y - 0.04, -0.03);
    },
    tree_blossom(b) { TREE_TRUNK(b, 0.3); b.sphere(0.27, 0xf6a8cc, 0, 0.5, 0, { seg: 10 }); b.sphere(0.18, 0xffc6df, 0.13, 0.64, 0.06, { seg: 8 }); b.sphere(0.16, C.pink, -0.12, 0.42, 0.12, { seg: 8 }); for (let k = 0; k < 6; k++) b.sphere(0.025, C.white, Math.cos(k) * 0.24, 0.5 + Math.sin(k * 3) * 0.12, Math.sin(k) * 0.24, { seg: 5, rings: 3 }); },
    tree_fruit(b) { TREE_TRUNK(b, 0.3); b.sphere(0.27, C.green, 0, 0.5, 0, { seg: 10 }); b.sphere(0.17, C.leaf, 0.12, 0.64, 0.05, { seg: 8 }); for (let k = 0; k < 8; k++) { const a = k * 0.8; b.sphere(0.035, C.red, Math.cos(a) * 0.26, 0.42 + (k % 3) * 0.08, Math.sin(a) * 0.26, { seg: 6, rings: 4 }); } },
    tree_autumn(b) { TREE_TRUNK(b, 0.3); b.sphere(0.26, C.orange, 0, 0.48, 0, { seg: 10 }); b.sphere(0.18, 0xe8b830, 0.13, 0.62, 0.06, { seg: 8 }); b.sphere(0.16, 0xc8401f, -0.12, 0.42, 0.12, { seg: 8 }); },
    tree_snowy(b) { TREE_TRUNK(b, 0.18, 0.05); for (let i = 0; i < 3; i++) { b.cone(0.3 - i * 0.07, 0.32, 0x1f5a3c, 0, 0.12 + i * 0.2, 0, { seg: 8 }); b.cone(0.17 - i * 0.04, 0.14, C.white, 0, 0.32 + i * 0.2, 0, { seg: 8 }); } },
    bush(b) { b.sphere(0.18, C.green, -0.08, 0.12, 0, { seg: 8 }); b.sphere(0.15, C.leaf, 0.12, 0.1, 0.06, { seg: 8 }); b.sphere(0.12, 0x5fc24f, 0, 0.1, -0.14, { seg: 8 }); },
    flowers(b) {
        b.box(0.7, 0.06, 0.7, 0xb5533c);
        b.box(0.62, 0.065, 0.62, 0x5a3a22);
        const cols = [C.red, C.yellow, C.pink, C.lilac, C.white, C.orange];
        for (let i = 0; i < 16; i++) { const x = -0.22 + (i % 4) * 0.147, z = -0.22 + Math.floor(i / 4) * 0.147; b.sphere(0.055, 0x4fa83c, x, 0.1, z, { seg: 6, rings: 4 }); b.sphere(0.05, cols[(i * 7) % 6], x, 0.17, z, { seg: 6, rings: 4 }); }
    },
    sunflowers(b) {
        for (let i = 0; i < 5; i++) {
            const x = -0.22 + (i % 3) * 0.22, z = i < 3 ? -0.12 : 0.15, h = 0.42 + (i % 2) * 0.1;
            b.cyl(0.012, h, C.green, x, 0, z, { seg: 5 });
            b.cyl(0.07, 0.02, C.yellow, x, h, z + 0.01, { rx: 1.2, centre: true, seg: 10 });
            b.cyl(0.035, 0.025, C.dkbrown, x, h, z + 0.02, { rx: 1.2, centre: true, seg: 8 });
            b.box(0.08, 0.01, 0.03, C.leaf, x + 0.04, h * 0.5, z);
        }
    },
    mushroom(b) {
        b.cyl(0.08, 0.3, C.cream, 0, 0, 0, { rt: 0.06, seg: 10 });
        b.sphere(0.25, C.red, 0, 0.28, 0, { half: true, seg: 14, sy: 0.7 });
        for (let k = 0; k < 7; k++) { const a = k * 0.9, r = k ? 0.15 : 0; b.sphere(0.035, C.white, Math.cos(a) * r, 0.28 + 0.17 - r * 0.5, Math.sin(a) * r, { seg: 6, rings: 4 }); }
        b.sphere(0.07, 0xd84a3a, 0.28, 0.06, 0.2, { half: true, seg: 8 }); b.cyl(0.02, 0.06, C.cream, 0.28, 0, 0.2);
    },
    rock(b) { b.ico(0.22, 0x9aa1a8, -0.05, 0.1, 0, { sy: 0.7 }); b.ico(0.13, 0x868d95, 0.18, 0.06, 0.1, { sy: 0.7 }); b.ico(0.08, 0xadb3b9, -0.2, 0.04, 0.18); },
    // ---------------------------------------------------------------- decor
    lamp(b) {
        b.cyl(0.06, 0.04, C.black, 0, 0, 0, { seg: 8 });
        b.cyl(0.022, 0.62, C.black, 0, 0.04, 0, { seg: 6 });
        b.cyl(0.07, 0.1, 0xfff1b8, 0, 0.64, 0, { rt: 0.05, seg: 6, glow: 2.2 });
        b.cone(0.08, 0.06, C.black, 0, 0.74, 0, { seg: 6 });
        b.sphere(0.02, C.black, 0, 0.82, 0);
    },
    bench(b) {
        b.box(0.5, 0.03, 0.14, 0xb07a40, 0, 0.14, 0);
        b.box(0.5, 0.12, 0.025, 0xb07a40, 0, 0.18, -0.07, { rx: -0.15 });
        for (const x of [-0.2, 0.2]) { b.box(0.03, 0.14, 0.12, C.black, x, 0, 0); b.box(0.03, 0.16, 0.025, C.black, x, 0.14, -0.075); }
    },
    fence(b) {
        for (let i = 0; i < 5; i++) b.box(0.05, 0.26, 0.05, C.white, -0.44 + i * 0.22, 0, 0);
        for (let i = 0; i < 5; i++) b.cone(0.036, 0.05, C.white, -0.44 + i * 0.22, 0.26, 0, { seg: 4, ry: Math.PI / 4 });
        for (const y of [0.08, 0.18]) b.box(0.98, 0.035, 0.025, C.white, 0, y, 0);
    },
    hedge(b) { b.box(0.94, 0.32, 0.36, C.dkgreen, 0, 0, 0); b.box(0.9, 0.06, 0.3, 0x2b8a4c, 0, 0.32, 0); b.studs(0, 0.38, 0, 5, 2, 0.16, 0x2b8a4c, 0.03); },
    picnic(b) {
        for (let i = 0; i < 5; i++) b.box(0.1, 0.03, 0.26, i % 2 ? C.white : C.red, -0.2 + i * 0.1, 0.2, 0);
        for (const x of [-0.18, 0.18]) b.box(0.03, 0.2, 0.2, 0xb07a40, x, 0, 0);
        for (const z of [-0.24, 0.24]) b.box(0.5, 0.03, 0.09, 0xb07a40, 0, 0.11, z);
        b.box(0.1, 0.06, 0.08, 0xc8a060, 0.1, 0.23, 0.02);
    },
    mailbox(b) { b.cyl(0.08, 0.3, C.red, 0, 0, 0, { seg: 10 }); b.sphere(0.08, C.red, 0, 0.3, 0, { half: true, seg: 10 }); b.box(0.08, 0.015, 0.02, C.black, 0, 0.24, 0.075); b.cyl(0.1, 0.03, C.black, 0, 0, 0, { seg: 10 }); },
    statue(b) {
        b.box(0.32, 0.22, 0.32, C.ltgrey); b.box(0.36, 0.04, 0.36, C.white, 0, 0.22, 0);
        const G = C.gold;
        b.box(0.05, 0.12, 0.06, G, -0.03, 0.26, 0); b.box(0.05, 0.12, 0.06, G, 0.03, 0.26, 0);
        b.box(0.13, 0.13, 0.08, G, 0, 0.38, 0); b.cyl(0.04, 0.08, G, 0, 0.51, 0, { seg: 10 });
        b.box(0.03, 0.14, 0.03, G, 0.08, 0.42, 0, { rz: -2.6 }); b.cone(0.035, 0.07, G, 0.13, 0.55, 0);
        b.cone(0.025, 0.05, 0xffc040, 0.13, 0.61, 0, { glow: 1.2 });
    },
    flag(b) { b.cyl(0.05, 0.04, C.ltgrey, 0, 0, 0, { seg: 8 }); b.cyl(0.012, 0.9, C.ltgrey, 0, 0.04, 0, { seg: 6 }); b.sphere(0.022, C.gold, 0, 0.95, 0); b.box(0.3, 0.18, 0.01, C.red, 0.16, 0.72, 0); b.box(0.3, 0.06, 0.012, C.white, 0.16, 0.78, 0); },
    umbrella(b) {
        b.cyl(0.012, 0.5, C.white, 0, 0, 0, { seg: 5 });
        b.cone(0.34, 0.12, C.pink, 0, 0.44, 0, { seg: 8 });
        b.cone(0.17, 0.06, C.white, 0, 0.5, 0, { seg: 8 });
        b.box(0.34, 0.012, 0.16, C.lilac, 0.12, 0.0, 0.18, { ry: 0.4 });
    },
    tent(b) { b.gable(0.6, 0.38, 0.5, C.orange, 0, 0, 0); b.box(0.02, 0.24, 0.14, 0x7a3a10, 0.301, 0, 0); b.box(0.66, 0.012, 0.56, 0x3d6b2f); },
    // ---------------------------------------------------------------- water (sits at the water line, y ≈ −0.17 below the land top)
    sailboat(b) {
        b.box(0.5, 0.1, 0.2, C.white, 0, -0.18, 0); b.box(0.14, 0.1, 0.14, C.white, 0.25, -0.18, 0, { ry: Math.PI / 4 });
        b.box(0.5, 0.025, 0.21, C.blue, 0, -0.1, 0);
        b.cyl(0.012, 0.6, C.brown, 0.0, -0.08, 0, { seg: 5 });
        b.gable(0.01, 0.46, 0.36, C.white, 0.0, -0.07, 0, { ry: Math.PI / 2 });
    },
    rowboat(b) { b.box(0.42, 0.08, 0.18, 0xb07a40, 0, -0.17, 0); b.box(0.36, 0.02, 0.14, 0x8a5a2a, 0, -0.09, 0); b.box(0.04, 0.025, 0.18, 0x8a5a2a, 0, -0.08, 0); b.box(0.3, 0.012, 0.02, C.tan, 0, -0.07, 0.14, { ry: 0.3 }); b.box(0.3, 0.012, 0.02, C.tan, 0, -0.07, -0.14, { ry: -0.3 }); },
    ducks(b) {
        const duck = (x, z, s, col) => { b.sphere(0.09 * s, col, x, -0.15, z, { sx: 1.4, sy: 0.7, seg: 8 }); b.sphere(0.055 * s, col, x + 0.09 * s, -0.08, z, { seg: 8 }); b.cone(0.02 * s, 0.05 * s, C.orange, x + 0.15 * s, -0.09, z, { rz: -Math.PI / 2 }); };
        duck(0, 0, 1.2, C.white);
        for (let i = 0; i < 3; i++) duck(-0.2 - i * 0.12, 0.05 * (i % 2 ? 1 : -1), 0.6, C.yellow);
    },
    lilypads(b) {
        for (const [x, z, r] of [[-0.15, -0.1, 0.13], [0.15, 0.05, 0.11], [-0.05, 0.2, 0.09], [0.22, -0.2, 0.08]]) b.cyl(r, 0.015, C.leaf, x, -0.17, z, { seg: 12, ts: 0.3, tl: Math.PI * 1.85 });
        b.sphere(0.05, C.pink, -0.15, -0.13, -0.1, { seg: 8, sy: 0.7 }); b.sphere(0.025, C.yellow, -0.15, -0.11, -0.1);
    },
    buoy(b) { b.cyl(0.1, 0.12, C.red, 0, -0.2, 0, { seg: 10 }); b.cyl(0.07, 0.12, C.white, 0, -0.08, 0, { rt: 0.04, seg: 10 }); b.cyl(0.02, 0.08, C.dkgrey, 0, 0.04, 0); b.sphere(0.03, 0xffe060, 0, 0.13, 0, { glow: 2 }); },
    pier(b) {
        b.box(0.98, 0.04, 0.5, 0xb07a40, 0, -0.02, 0);
        for (let i = 0; i < 6; i++) b.box(0.01, 0.041, 0.5, 0x8a5a2a, -0.4 + i * 0.16, -0.02, 0);
        for (const x of [-0.42, 0.42]) for (const z of [-0.22, 0.22]) b.cyl(0.035, 0.42, 0x6b4a2e, x, -0.38, z, { seg: 6 });
        b.cyl(0.03, 0.1, 0x6b4a2e, 0.42, 0.02, 0.22, { seg: 6 });
    },
    whale(b) {
        b.sphere(0.36, 0x3b6fb6, 0, -0.17, 0, { sx: 1.5, sy: 0.55, seg: 14 });
        b.sphere(0.3, 0xd2e2f2, 0.06, -0.24, 0, { sx: 1.35, sy: 0.35, seg: 12 });
        b.box(0.26, 0.03, 0.34, 0x3b6fb6, -0.6, -0.12, 0, { rz: 0.4 });
        b.sphere(0.03, C.black, 0.36, -0.06, 0.18); b.sphere(0.03, C.black, 0.36, -0.06, -0.18);
        b.cyl(0.02, 0.18, 0xd8f2ff, 0.1, 0.0, 0, { rt: 0.05, glow: 0.3 });
        for (let k = 0; k < 4; k++) b.sphere(0.04, 0xd8f2ff, 0.1 + Math.cos(k * 1.6) * 0.07, 0.2, Math.sin(k * 1.6) * 0.07, { seg: 6, rings: 4, glow: 0.3 });
    },
};

/** Moving parts: built separately and spun or swung by the object view. */
const SPINS = {
    windmill: () => {
        const b = new Builder();
        b.cyl(0.05, 0.05, C.dkgrey, 0, 0, 0, { rx: Math.PI / 2, centre: true });
        for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2, sn = Math.sin(a), cs = Math.cos(a);
            b.box(0.035, 0.52, 0.02, C.brown, sn * 0.27, cs * 0.27, 0, { rz: -a, centre: true });
            b.box(0.13, 0.42, 0.012, C.white, sn * 0.32 + cs * 0.075, cs * 0.32 - sn * 0.075, 0.016, { rz: -a, centre: true });
        }
        return { geo: b.geometry(), pivot: [0, 1.12, 0.3], axis: 'z', speed: 1.2 };
    },
    ferris: () => {
        const b = new Builder();
        const R = 0.62;
        b.torus(R, 0.025, C.white, 0, 0, 0.1, { tseg: 32 }); b.torus(R, 0.025, C.white, 0, 0, -0.1, { tseg: 32 });
        b.torus(0.12, 0.02, C.red, 0, 0, 0.12); b.torus(0.12, 0.02, C.red, 0, 0, -0.12);
        const cols = [C.red, C.yellow, C.blue, C.green, C.orange, C.pink, C.teal, C.lilac];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            for (const z of [-0.1, 0.1]) b.box(0.02, R, 0.02, C.white, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, z, { rz: a - Math.PI / 2, centre: true });
            b.box(0.16, 0.13, 0.16, cols[k], Math.cos(a) * R, Math.sin(a) * R - 0.1, 0, { glow: 0.3, centre: true });
            b.box(0.18, 0.02, 0.18, C.white, Math.cos(a) * R, Math.sin(a) * R - 0.02, 0, { centre: true });
        }
        return { geo: b.geometry(), pivot: [0, 1.45, 0], axis: 'z', speed: 0.25 };
    },
    carousel: () => {
        const b = new Builder();
        b.cyl(0.05, 0.62, C.gold, 0, 0, 0);
        b.cone(0.86, 0.3, C.red, 0, 0.62, 0, { seg: 16 });
        for (let k = 0; k < 16; k++) b.box(0.08, 0.05, 0.01, k % 2 ? C.white : C.yellow, Math.cos((k / 16) * Math.PI * 2) * 0.84, 0.57, Math.sin((k / 16) * Math.PI * 2) * 0.84, { ry: -(k / 16) * Math.PI * 2 + Math.PI / 2, glow: k % 2 ? 0 : 0.8 });
        b.sphere(0.06, C.gold, 0, 0.94, 0);
        const cols = [C.white, C.pink, C.ltblue, C.yellow, C.lilac, C.orange];
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2, x = Math.cos(a) * 0.55, z = Math.sin(a) * 0.55, y = 0.12 + (k % 2) * 0.08;
            b.cyl(0.012, 0.5, C.gold, x, 0.02, z, { seg: 5 });
            b.box(0.22, 0.09, 0.07, cols[k], x, y, z, { ry: -a });
            b.box(0.07, 0.12, 0.05, cols[k], x - Math.sin(a) * 0.1, y + 0.06, z + Math.cos(a) * 0.1, { ry: -a });
        }
        return { geo: b.geometry(), pivot: [0, 0.15, 0], axis: 'y', speed: 0.7 };
    },
    balloon: () => {
        const b = new Builder();
        b.box(0.16, 0.1, 0.16, 0x8a5a2a, 0, 0, 0);
        for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) b.box(0.008, 0.22, 0.008, C.dkgrey, x, 0.1, z);
        const cols = [C.red, C.yellow, C.blue, C.yellow, C.red, C.green, C.orange, C.lilac];
        for (let k = 0; k < 8; k++) b.add(new THREE.SphereGeometry(0.34, 3, 10, (k / 8) * Math.PI * 2, Math.PI / 4), cols[k], { y: 0.62, sy: 1.2 });
        b.cone(0.12, 0.12, C.red, 0, 0.28, 0, { rx: Math.PI, seg: 8 });
        b.sphere(0.04, 0xffb040, 0, 0.3, 0, { glow: 2 });
        return { geo: b.geometry(), pivot: [0, 0.7, 0], axis: 'bob', speed: 1 };
    },
};

/** Items that rock on the waves (amplitude). */
export const BOBS = { sailboat: 0.02, rowboat: 0.015, ducks: 0.012, buoy: 0.025, whale: 0.03, lilypads: 0.004 };

const cache = new Map();
export function buildItem(id) {
    if (cache.has(id)) return cache.get(id);
    const b = new Builder();
    (MODELS[id] || MODELS.rock)(b);
    const out = { geo: b.geometry() };
    if (SPINS[id]) out.spin = SPINS[id]();
    if (BOBS[id]) out.bob = BOBS[id];
    cache.set(id, out);
    return out;
}

export const MODEL_IDS = Object.keys(MODELS);
