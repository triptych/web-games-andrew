// Props: every kind of scenery as one merged, vertex-coloured geometry, drawn with one
// InstancedMesh per kind, so a whole floor of decoration is a couple of dozen draw calls.

import * as THREE from 'three';
import { K, merge } from './toon.js';

const PI = Math.PI;
const ring = (n, r, f) => Array.from({ length: n }, (_, i) => f(Math.cos((i / n) * PI * 2) * r, Math.sin((i / n) * PI * 2) * r, i));

/** tag → { geo, glow?: {y, color} lamp position for lights, h: height } */
export const PROPS = {
    pillar: () => merge([K.box(0.7, 0.3, 0.7, { c: '#6a7870' }), K.box(0.5, 2.6, 0.5, { c: '#8a9a90', g: '#6a786e', p: [0, 1.6, 0] }), K.box(0.8, 0.25, 0.8, { c: '#6a7870', p: [0, 3.0, 0] })]),
    pipe: () => merge([K.cyl(0.14, 0.14, 3, { c: '#8a6a4a', p: [0.6, 1.5, 0.6] }), K.cyl(0.14, 0.14, 1.4, { c: '#8a6a4a', p: [0, 2.8, 0.6], r: [0, 0, PI / 2] }), K.tor(0.17, 0.04, { c: '#c8a870', p: [0.6, 0.8, 0.6], r: [PI / 2, 0, 0] })]),
    crate: () => merge([K.box(0.85, 0.85, 0.85, { c: '#8a6a3a', g: '#6a4a2a', p: [0, 0.42, 0] }), K.box(0.9, 0.08, 0.9, { c: '#c8a860', p: [0, 0.85, 0] }), K.box(0.7, 0.6, 0.7, { c: '#7a5a30', p: [0.15, 1.15, 0.05], r: [0, 0.4, 0] })]),
    puddle: () => merge([K.cyl(0.9, 0.9, 0.04, { c: '#2a5a7a', p: [0, 0.02, 0] }, 12)]),
    planter: () => merge([K.box(1.1, 0.5, 0.6, { c: '#a89a8a', p: [0, 0.25, 0] }), K.sph(0.4, { c: '#3a8a3a', g: '#6ac04a', p: [-0.2, 0.8, 0] }), K.sph(0.35, { c: '#4aa040', p: [0.25, 0.75, 0.05] }), K.sph(0.1, { c: '#ff8ac8', p: [0.1, 1.05, 0.2] })]),
    bench: () => merge([K.box(1.4, 0.1, 0.5, { c: '#8a6a3a', p: [0, 0.5, 0] }), K.box(1.4, 0.5, 0.08, { c: '#7a5a30', p: [0, 0.85, -0.22] }), K.box(0.1, 0.5, 0.45, { c: '#3a3a42', p: [-0.6, 0.25, 0] }), K.box(0.1, 0.5, 0.45, { c: '#3a3a42', p: [0.6, 0.25, 0] })]),
    shopfront: () => merge([K.box(1.9, 2.2, 0.4, { c: '#a8a090', g: '#8a8070', p: [0, 1.1, 0] }), K.box(1.5, 1.1, 0.1, { c: '#4a8a9a', p: [0, 1.0, 0.22] }), K.box(1.95, 0.25, 0.7, { c: '#c8483a', p: [0, 1.95, 0.25], r: [0.35, 0, 0] })]),
    tree: () => merge([K.cyl(0.18, 0.28, 2.0, { c: '#5a4030', p: [0, 1.0, 0] }), K.sph(0.9, { c: '#3a8a3a', g: '#5ab04a', p: [0, 2.5, 0] }), K.sph(0.65, { c: '#3a8a3a', g: '#5ab04a', p: [0.55, 2.1, 0.2] }), K.sph(0.6, { c: '#2f7a30', g: '#4aa040', p: [-0.5, 2.2, -0.2] })]),
    appletree: () => merge([K.cyl(0.15, 0.24, 1.6, { c: '#5a4030', p: [0, 0.8, 0] }), K.sph(0.8, { c: '#3a8a3a', g: '#5ab04a', p: [0, 2.0, 0] }), K.sph(0.55, { c: '#3a8a3a', p: [0.5, 1.8, 0.2] }), ...ring(6, 0.7, (x, z, i) => K.sph(0.1, { c: '#e0382a', p: [x, 1.7 + (i % 2) * 0.5, z] }))]),
    lamp: () => merge([K.cyl(0.06, 0.1, 2.4, { c: '#3a3a44', p: [0, 1.2, 0] }), K.sph(0.2, { c: '#fff4c0', p: [0, 2.5, 0] }), K.cyl(0.25, 0.1, 0.1, { c: '#2a2a32', p: [0, 2.72, 0] })]),
    rack: () => merge([K.box(0.9, 2.5, 0.8, { c: '#2a3042', g: '#1a2030', p: [0, 1.25, 0] }), ...Array.from({ length: 9 }, (_, i) => K.box(0.7, 0.05, 0.02, { c: i % 3 ? '#5af0ff' : '#7aff9a', p: [0, 0.35 + i * 0.25, 0.41] })), K.box(0.1, 2.4, 0.1, { c: '#1a1e2a', p: [0.5, 1.2, -0.3] })]),
    cable: () => merge([K.cyl(0.07, 0.07, 1.6, { c: '#1a1e28', p: [0, 0.07, 0], r: [0, 0, PI / 2] }), K.cyl(0.05, 0.05, 1.2, { c: '#5af0ff', p: [0.1, 0.05, 0.12], r: [0, 0.3, PI / 2] }), K.cyl(0.05, 0.05, 1.0, { c: '#7aff9a', p: [-0.1, 0.05, -0.12], r: [0, -0.3, PI / 2] })]),
    pew: () => merge([K.box(1.8, 0.12, 0.5, { c: '#5a3a2a', p: [0, 0.45, 0] }), K.box(1.8, 0.7, 0.08, { c: '#4a2a22', p: [0, 0.8, -0.22] }), K.box(0.12, 0.45, 0.5, { c: '#3a2218', p: [-0.84, 0.22, 0] }), K.box(0.12, 0.45, 0.5, { c: '#3a2218', p: [0.84, 0.22, 0] })]),
    column: () => merge([K.cyl(0.55, 0.65, 0.3, { c: '#8a86a0', p: [0, 0.15, 0] }, 8), K.cyl(0.38, 0.42, 3.0, { c: '#a8a4c0', g: '#8a86a8', p: [0, 1.8, 0] }, 8), K.cyl(0.6, 0.45, 0.35, { c: '#8a86a0', p: [0, 3.5, 0] }, 8)]),
    candle: () => merge([K.cyl(0.12, 0.16, 0.9, { c: '#3a3248', p: [0, 0.45, 0] }, 6), K.cyl(0.05, 0.05, 0.25, { c: '#f4ecd0', p: [0, 1.02, 0] }), K.sph(0.07, { c: '#ffd070', p: [0, 1.2, 0] })]),
    banner: () => merge([K.cyl(0.04, 0.04, 3.4, { c: '#3a2a48', p: [0, 1.7, 0] }), K.box(0.8, 1.8, 0.04, { c: '#6a3aa8', g: '#8a5ad0', p: [0.42, 2.4, 0] }), K.box(0.8, 0.12, 0.05, { c: '#d8b848', p: [0.42, 3.25, 0] })]),
    rail: () => merge([K.box(0.12, 0.14, 2, { c: '#8a8a94', p: [-0.55, 0.12, 0] }), K.box(0.12, 0.14, 2, { c: '#8a8a94', p: [0.55, 0.12, 0] }), ...[-0.7, 0, 0.7].map((z) => K.box(1.5, 0.08, 0.22, { c: '#5a4030', p: [0, 0.04, z] }))]),
    antenna: () => merge([K.cyl(0.03, 0.06, 3.6, { c: '#c8ccd8', p: [0, 1.8, 0] }), K.box(0.6, 0.04, 0.04, { c: '#c8ccd8', p: [0, 3.0, 0] }), K.box(0.4, 0.04, 0.04, { c: '#c8ccd8', p: [0, 2.5, 0] }), K.sph(0.07, { c: '#ff4a4a', p: [0, 3.65, 0] })]),
    hexpillar: () => merge([K.cyl(0.5, 0.55, 3.4, { c: '#1c1228', g: '#2a1a3c', p: [0, 1.7, 0] }, 6), K.box(0.08, 3.0, 0.08, { c: '#ff4ad8', p: [0, 1.7, 0.5] }), K.cyl(0.6, 0.6, 0.12, { c: '#ff4ad8', p: [0, 0.08, 0] }, 6)]),
    terminal: () => merge([K.box(0.9, 0.9, 0.5, { c: '#2a2438', p: [0, 0.45, 0] }), K.box(0.7, 0.5, 0.05, { c: '#ff8af0', p: [0, 0.95, 0.12], r: [-0.3, 0, 0] }), K.box(0.8, 0.06, 0.3, { c: '#3a3248', p: [0, 0.9, 0.2] })]),
    spike: () => merge([K.cone(0.28, 1.6, { c: '#c040ff', g: '#ff8af0', p: [0, 0.8, 0] }, 5), K.cone(0.2, 1.1, { c: '#a030e0', p: [0.35, 0.55, 0.1], r: [0, 0, -0.3] }, 5), K.cone(0.18, 0.9, { c: '#d060ff', p: [-0.3, 0.45, -0.1], r: [0, 0, 0.3] }, 5)]),
};
/** Props that hold a light: the view gives the nearest few a point light. */
export const LIT = new Set(['lamp', 'candle', 'terminal', 'spike', 'rack', 'hexpillar']);
export const PROP_GLOW = { lamp: [0, 2.5, 0], candle: [0, 1.25, 0], terminal: [0, 1.1, 0.3], spike: [0, 1.0, 0], rack: [0, 1.2, 0.6], hexpillar: [0, 1.7, 0.7] };

const cache = new Map();
export function propGeometry(tag) {
    if (!cache.has(tag)) { const g = (PROPS[tag] || PROPS.crate)(); g.userData.shared = true; cache.set(tag, g); }
    return cache.get(tag);
}
