// Vehicle models, built from a few vertex-coloured solids. Local frame: +z is
// forward, +y up. Light positions are returned separately so they can be
// drawn as glow points that also show up in the wet-road reflection.

import { Geo } from './geo.js';

const GLASS = [0.05, 0.06, 0.09];
const TYRE = [0.025, 0.025, 0.03];

const cache = new Map();

function wheels(g, x, zf, zr, r = 0.36, w = 0.15) {
    for (const sx of [-1, 1]) for (const z of [zf, zr]) {
        g.box(sx * x, z, 0, r * 2, 0, 1, r, w, TYRE);
    }
}

function strip(g, z, y0, y1, half, color) {
    g.box(0, z, y0, y1, 0, 1, 0.025, half, color, null, { flat: true });
}

/** Player's wedge coupe. */
function coupe(color, accent) {
    const g = new Geo();
    const yAt = (z) => 0.88 + (0.55 - 0.88) * (z + 2.3) / 4.65;
    g.hexa(
        [[-0.95, 0.28, -2.3], [0.95, 0.28, -2.3], [0.95, 0.28, 2.35], [-0.95, 0.28, 2.35]],
        [[-0.93, 0.88, -2.3], [0.93, 0.88, -2.3], [0.9, 0.55, 2.35], [-0.9, 0.55, 2.35]],
        color, { topColor: color.map((v) => v * 1.25 + 0.03) });
    g.hexa(
        [[-0.82, yAt(-1.6), -1.6], [0.82, yAt(-1.6), -1.6], [0.8, yAt(0.9), 0.9], [-0.8, yAt(0.9), 0.9]],
        [[-0.66, 1.27, -1.25], [0.66, 1.27, -1.25], [0.62, 1.25, -0.05], [-0.62, 1.25, -0.05]],
        GLASS, { topColor: color.map((v) => v * 1.1), sideColors: [[0.1, 0.08, 0.16], [0.07, 0.07, 0.12], [0.16, 0.12, 0.24], [0.07, 0.07, 0.12]] });
    wheels(g, 0.86, 1.45, -1.45);
    strip(g, -2.32, 0.6, 0.72, 0.86, [1, 0.08, 0.12]);
    strip(g, 2.37, 0.4, 0.47, 0.74, [1, 0.95, 0.85]);
    for (const sx of [-1, 1]) g.box(sx * 0.955, 0, 0.44, 0.48, 0, 1, 2.0, 0.015, accent, null, { flat: true });
    // a ducktail spoiler
    g.box(0, -2.15, 0.88, 0.96, 0, 1, 0.18, 0.9, color.map((v) => v * 0.8));
    return { g, head: [[-0.62, 0.45, 2.42], [0.62, 0.45, 2.42]], tail: [[-0.7, 0.66, -2.36], [0.7, 0.66, -2.36]] };
}

function sedan(color, taxi = false) {
    const g = new Geo();
    g.box(0, 0, 0.3, 0.86, 0, 1, 2.25, 0.9, color);
    g.hexa(
        [[-0.84, 0.86, -1.25], [0.84, 0.86, -1.25], [0.84, 0.86, 0.95], [-0.84, 0.86, 0.95]],
        [[-0.72, 1.36, -0.9], [0.72, 1.36, -0.9], [0.72, 1.36, 0.45], [-0.72, 1.36, 0.45]],
        GLASS, { topColor: color.map((v) => v * 0.9) });
    wheels(g, 0.82, 1.4, -1.4);
    strip(g, -2.27, 0.62, 0.74, 0.8, [0.9, 0.06, 0.08]);
    strip(g, 2.27, 0.52, 0.6, 0.7, [0.95, 0.9, 0.75]);
    if (taxi) g.box(0, -0.2, 1.36, 1.6, 0, 1, 0.3, 0.42, [1, 0.6, 0.15], null, { flat: true });
    return { g, head: [[-0.62, 0.56, 2.32], [0.62, 0.56, 2.32]], tail: [[-0.66, 0.68, -2.3], [0.66, 0.68, -2.3]] };
}

function van(color) {
    const g = new Geo();
    g.hexa(
        [[-1.0, 0.34, -2.5], [1.0, 0.34, -2.5], [1.0, 0.34, 2.5], [-1.0, 0.34, 2.5]],
        [[-0.98, 2.15, -2.5], [0.98, 2.15, -2.5], [0.95, 2.15, 1.5], [-0.95, 2.15, 1.5]],
        color, { sideColors: [null, null, GLASS, null] });
    wheels(g, 0.9, 1.7, -1.7, 0.38, 0.17);
    strip(g, -2.52, 0.75, 0.95, 0.85, [0.9, 0.06, 0.08]);
    strip(g, 2.52, 0.6, 0.72, 0.8, [0.95, 0.9, 0.75]);
    return { g, head: [[-0.72, 0.66, 2.56], [0.72, 0.66, 2.56]], tail: [[-0.82, 0.85, -2.55], [0.82, 0.85, -2.55]] };
}

function truck(color) {
    const g = new Geo();
    g.box(0, 3.0, 0.4, 2.9, 0, 1, 1.0, 1.15, color);
    g.box(0, 3.95, 1.5, 2.5, 0, 1, 0.06, 1.0, GLASS, null, { top: false });
    g.box(0, -1.7, 0.5, 3.9, 0, 1, 3.3, 1.22, [0.36, 0.36, 0.4]);
    g.box(0, -1.7, 1.2, 1.4, 0, 1, 3.32, 1.24, color.map((v) => v * 1.5), null, { top: false });
    wheels(g, 1.05, 3.2, -0.3, 0.45, 0.2);
    wheels(g, 1.05, -3.6, -4.4, 0.45, 0.2);
    strip(g, -5.02, 0.7, 0.9, 1.0, [0.9, 0.06, 0.08]);
    for (let x = -1.1; x <= 1.1; x += 0.55) g.box(x, -1.7, 3.9, 4.0, 0, 1, 3.2, 0.04, [1, 0.6, 0.2], null, { flat: true, top: false });
    return { g, head: [[-0.8, 0.8, 4.18], [0.8, 0.8, 4.18]], tail: [[-1.0, 0.8, -5.05], [1.0, 0.8, -5.05]] };
}

/** Flying car. Lights: nose (white), tail (red), two side pods. */
function spinner(color, police) {
    const g = new Geo();
    g.hexa(
        [[-0.8, 0, -2.6], [0.8, 0, -2.6], [0.6, 0, 2.6], [-0.6, 0, 2.6]],
        [[-0.75, 0.75, -2.4], [0.75, 0.75, -2.4], [0.4, 0.45, 2.5], [-0.4, 0.45, 2.5]],
        color);
    g.hexa(
        [[-0.6, 0.75, -1.4], [0.6, 0.75, -1.4], [0.5, 0.6, 1.0], [-0.5, 0.6, 1.0]],
        [[-0.45, 1.25, -1.0], [0.45, 1.25, -1.0], [0.4, 1.2, 0.2], [-0.4, 1.2, 0.2]],
        GLASS, { sideColors: [[0.1, 0.12, 0.2], [0.08, 0.08, 0.12], [0.15, 0.15, 0.25], [0.08, 0.08, 0.12]] });
    for (const sx of [-1, 1]) g.box(sx * 1.1, -0.4, 0.05, 0.55, 0, 1, 1.3, 0.3, color.map((v) => v * 0.7));
    if (police) {
        g.box(0, -0.4, 1.25, 1.4, 0, 1, 0.2, 0.4, [0.9, 0.9, 1], null, { flat: true });
        g.box(0, 0, 0.3, 0.42, 0, 1, 2.0, 0.81, [0.85, 0.85, 0.9], null, { flat: true, top: false });
    }
    return { g, nose: [0, 0.35, 2.7], tail: [0, 0.5, -2.7], pods: [[-1.1, 0.3, -1.6], [1.1, 0.3, -1.6]], bar: [0, 1.5, -0.4] };
}

export function buildModel(kind, color, accent = [1, 0.2, 0.7]) {
    const key = kind + color.join(',') + accent.join(',');
    if (cache.has(key)) return cache.get(key);
    let m;
    switch (kind) {
    case 'coupe': m = coupe(color, accent); break;
    case 'taxi': m = sedan([0.85, 0.62, 0.08], true); break;
    case 'van': m = van(color); break;
    case 'truck': m = truck(color); break;
    case 'spinner': m = spinner(color, false); break;
    case 'police': m = spinner([0.08, 0.1, 0.2], true); break;
    default: m = sedan(color);
    }
    m.geometry = m.g.build();
    delete m.g;
    cache.set(key, m);
    return m;
}

export const BODY_COLORS = [
    [0.22, 0.22, 0.26], [0.36, 0.08, 0.1], [0.1, 0.16, 0.3], [0.32, 0.32, 0.34],
    [0.07, 0.07, 0.08], [0.26, 0.2, 0.12], [0.12, 0.24, 0.22],
];
