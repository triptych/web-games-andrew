// Island and museum props, all procedural. Each returns a THREE.Group standing on y = 0.

import * as THREE from 'three';
import { Kit, sphere, box, cyl, cone, torus, capsule, tube, bumpy, extrude, shade, ribbon } from './kit.js';

const PI = Math.PI;

export function palm(seed = 0, h = 4.5) {
    const k = new Kit();
    const lean = 0.25 + (seed % 3) * 0.12, dir = seed * 2.1;
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.cos(dir) * Math.sin(t * lean * 2) * h * 0.4, t * h, Math.sin(dir) * Math.sin(t * lean * 2) * h * 0.4]); }
    k.add(tube(pts, [0.2, 0.16, 0.13], 8), (x, y) => (Math.sin(y * 9) > 0.2 ? '#8a6a46' : '#a07c52'), 'flat');
    const top = pts[pts.length - 1];
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2 + seed;
        const leaf = [];
        for (let j = 0; j <= 5; j++) { const t = j / 5; leaf.push([top[0] + Math.cos(a) * t * 2.2, top[1] + Math.sin(t * PI * 0.8) * 0.6 - t * t * 1.1, top[2] + Math.sin(a) * t * 2.2]); }
        k.add(ribbon(leaf, [0.05, 0.5, 0.55, 0.42, 0.25, 0.02]), (x, y) => shade('#3f9a3a', (y - top[1]) * 0.25 + (i % 2) * 0.06), 'flat');
    }
    for (let i = 0; i < 3; i++) k.add(sphere(0.16, 8, 6), '#6b4a2a', 'flat', { p: [top[0] + Math.cos(i * 2) * 0.18, top[1] - 0.2, top[2] + Math.sin(i * 2) * 0.18] });
    return k.build();
}

export function lighthouse(painted) {
    const k = new Kit();
    const stripe = painted ? '#d9433a' : '#a88a7a', base = painted ? '#f6f2ea' : '#cfc6b8';
    k.add(new THREE.CylinderGeometry(1.0, 1.5, 7, 20, 7), (x, y) => (Math.floor((y + 3.5) / 1.4) % 2 ? stripe : base), 'gloss', { p: [0, 3.5, 0] });
    k.add(cyl(1.25, 1.25, 0.2, 20), '#3a3a40', 'metal', { p: [0, 7.1, 0] });
    k.add(cyl(0.8, 0.8, 1.2, 12), '#ffe9a8', 'glow', { p: [0, 7.8, 0] });
    for (let i = 0; i < 8; i++) k.add(box(0.06, 1.2, 0.06), '#2f3238', 'metal', { p: [Math.cos(i * PI / 4) * 0.82, 7.8, Math.sin(i * PI / 4) * 0.82] });
    k.add(cone(1.0, 0.9, 12), stripe, 'gloss', { p: [0, 8.85, 0] });
    k.add(torus(1.25, 0.04, 4, 24), '#2f3238', 'metal', { p: [0, 7.5, 0], r: [PI / 2, 0, 0] });
    k.add(box(0.5, 0.9, 0.1), '#5a3e2a', 'flat', { p: [0, 0.45, 1.42] });
    return k.build();
}

export function ferry() {
    const k = new Kit();
    k.add(lathe2(), '#f2efe6', 'gloss', { s: [1, 1, 2.2] });
    k.add(box(1.7, 0.18, 3.6), '#c23a3a', 'gloss', { p: [0, 0.5, 0] });
    k.add(box(1.2, 0.9, 1.4), '#f6f2ea', 'gloss', { p: [0, 1.0, -0.4] });
    k.add(box(1.3, 0.12, 1.5), '#2f5a8a', 'gloss', { p: [0, 1.5, -0.4] });
    for (const s of [-1, 1]) k.add(box(0.04, 0.3, 0.5), '#8fd0ff', 'glass', { p: [s * 0.61, 1.1, -0.4] });
    k.add(cyl(0.12, 0.14, 0.7, 10), '#d9433a', 'gloss', { p: [0, 1.9, -0.6] });
    k.add(torus(0.22, 0.07, 6, 14), '#f28a2e', 'gloss', { p: [0.86, 0.85, 0.6], r: [0, PI / 2, 0] });
    return k.build();
}
function lathe2() {
    const pts = [[0, 0], [0.6, 0.05], [0.85, 0.3], [0.9, 0.6], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 16);
}

export function rowboat() {
    const k = new Kit();
    k.add(new THREE.SphereGeometry(0.6, 12, 8, 0, PI * 2, PI / 2, PI / 2), '#8a5a33', 'flat', { s: [0.8, 0.5, 1.8] });
    k.add(box(0.9, 0.05, 0.25), '#a07040', 'flat', { p: [0, -0.05, 0] });
    return k.build();
}

export function tent() {
    const k = new Kit();
    k.add(new THREE.ConeGeometry(1.8, 2.0, 4, 1), (x, y) => (y > 0.6 ? '#f2e2bc' : '#e8d29e'), 'fur', { p: [0, 1.0, 0], r: [0, PI / 4, 0], s: [1, 1, 1.3] });
    k.add(box(0.7, 1.0, 0.05), '#6b4a2a', 'matte', { p: [0, 0.5, 1.68] });
    k.add(cyl(0.04, 0.04, 1.2, 6), '#7a5a3a', 'flat', { p: [0, 2.4, 0] });
    k.add(box(0.5, 0.3, 0.02), '#e2503a', 'gloss', { p: [0.25, 2.8, 0] });
    for (const [x, z] of [[2.2, 0.5], [-2.2, 0.8], [1.6, -1.6]]) {
        k.add(cyl(0.05, 0.06, 0.8, 6), '#b88a5a', 'flat', { p: [x, 0.4, z] });
        k.add(box(0.14, 0.05, 0.02), '#e2503a', 'gloss', { p: [x, 0.75, z] });
    }
    k.add(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 14, 1, true), '#3a8ac4', 'gloss', { p: [1.4, 0.25, 1.4] });
    k.add(box(0.8, 0.12, 0.5), '#8a5a33', 'flat', { p: [-1.5, 0.4, 1.6] });
    k.add(cyl(0.03, 0.03, 0.8, 6), '#7a5a3a', 'flat', { p: [-1.5, 0.3, 1.6], r: [0, 0, 0.5] });
    return k.build();
}

export function booth(fixed) {
    const k = new Kit();
    const wood = fixed ? '#c88a52' : '#8f7a62';
    k.add(box(1.6, 1.1, 1.2), wood, 'flat', { p: [0, 0.55, 0], r: fixed ? [0, 0, 0] : [0, 0, 0.06] });
    k.add(box(1.2, 0.5, 0.05), fixed ? '#3a2a1a' : '#2a2a2a', 'matte', { p: [0, 1.3, 0.58] });
    k.add(box(0.06, 1.2, 0.06), wood, 'flat', { p: [-0.75, 1.6, 0.55] });
    k.add(box(0.06, 1.2, 0.06), wood, 'flat', { p: [0.75, 1.6, 0.55] });
    if (fixed) {
        const seg = 6;
        for (let i = 0; i < seg; i++) k.add(box(1.9 / seg, 0.05, 0.9), i % 2 ? '#f6f2ea' : '#e2503a', 'fur', { p: [-0.95 + (i + 0.5) * (1.9 / seg), 2.3, 0.3], r: [0.35, 0, 0] });
        k.add(box(1.0, 0.3, 0.04), '#f6e7c0', 'matte', { p: [0, 2.0, 0.62] });
        k.add(box(1.5, 0.08, 0.5), '#a06a3a', 'flat', { p: [0, 1.12, 0.75] });
    } else {
        k.add(box(1.4, 0.12, 0.08), '#7a6a52', 'flat', { p: [0, 1.4, 0.62], r: [0, 0, 0.5] });
        k.add(box(1.4, 0.12, 0.08), '#7a6a52', 'flat', { p: [0, 1.4, 0.63], r: [0, 0, -0.5] });
        // Clement the crab
        k.add(sphere(0.16, 10, 8), '#e2603a', 'gloss', { p: [0.4, 0.12, 0.8], s: [1.3, 0.6, 1] });
        for (const s of [-1, 1]) k.add(sphere(0.07, 8, 6), '#e2603a', 'gloss', { p: [0.4 + s * 0.24, 0.18, 0.9] });
        for (const s of [-1, 1]) k.add(sphere(0.03, 6, 4), '#111', 'gloss', { p: [0.4 + s * 0.06, 0.24, 0.92] });
    }
    return k.build();
}

/** A text sign: a board on two posts. */
export function sign(text, w = 4, h = 0.9, color = '#2f5a6a', ink = '#f6e7c0') {
    const g = new THREE.Group();
    const k = new Kit();
    for (const s of [-1, 1]) k.add(cyl(0.07, 0.08, 2.2, 8), '#7a5a3a', 'flat', { p: [s * (w / 2 - 0.2), 1.1, 0] });
    k.add(box(w, h, 0.12), color, 'gloss', { p: [0, 2.0, 0] });
    g.add(k.build());
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round((1024 * h) / w);
    const x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = ink; x.lineWidth = 10; x.strokeRect(16, 16, c.width - 32, c.height - 32);
    x.fillStyle = ink;
    x.font = `bold ${Math.round(c.height * 0.48)}px Georgia, 'Times New Roman', serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, c.width / 2, c.height / 2 + 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.94), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    face.position.set(0, 2.0, 0.065);
    g.add(face);
    // the same words on the back, so a sign reads from any side
    const back = face.clone();
    back.position.z = -0.065;
    back.rotation.y = Math.PI;
    g.add(back);
    return g;
}

export function bench() {
    const k = new Kit();
    for (let i = 0; i < 3; i++) k.add(box(1.6, 0.06, 0.14), '#b07a48', 'flat', { p: [0, 0.45, -0.18 + i * 0.18] });
    for (let i = 0; i < 2; i++) k.add(box(1.6, 0.14, 0.05), '#b07a48', 'flat', { p: [0, 0.7 + i * 0.2, -0.3], r: [-0.15, 0, 0] });
    for (const s of [-1, 1]) k.add(box(0.06, 0.45, 0.5), '#3a3a40', 'metal', { p: [s * 0.7, 0.22, -0.05] });
    return k.build();
}

export function flowerBed(w = 2, d = 1, seed = 1) {
    const k = new Kit();
    k.add(box(w, 0.2, d), '#6b4a2a', 'flat', { p: [0, 0.1, 0] });
    const cols = ['#ff6b8a', '#ffd93b', '#c77dff', '#ffffff', '#ff8a3a'];
    for (let i = 0; i < Math.round(w * d * 8); i++) {
        const x = ((i * 0.618 + seed) % 1 - 0.5) * (w - 0.2), z = ((i * 0.381 + seed * 0.3) % 1 - 0.5) * (d - 0.2);
        k.add(cyl(0.015, 0.015, 0.3, 4), '#3f8a3a', 'flat', { p: [x, 0.35, z] });
        k.add(sphere(0.07, 6, 5), cols[(i + seed) % cols.length], 'fur', { p: [x, 0.52, z] });
        if (i % 2) k.add(sphere(0.09, 6, 4), '#4f9a3e', 'flat', { p: [x + 0.06, 0.25, z], s: [1.4, 0.6, 1] });
    }
    return k.build();
}

export function lampPost(on = true) {
    const k = new Kit();
    k.add(cyl(0.06, 0.09, 2.6, 8), '#2f3a44', 'metal', { p: [0, 1.3, 0] });
    k.add(sphere(0.22, 12, 10), on ? '#ffe2a0' : '#d8d8d8', on ? 'glow' : 'glass', { p: [0, 2.75, 0] });
    k.add(cone(0.26, 0.2, 8), '#2f3a44', 'metal', { p: [0, 3.0, 0] });
    return k.build();
}

export function fountain() {
    const k = new Kit();
    k.add(lathe3([[0, 0], [1.4, 0], [1.5, 0.45], [1.3, 0.5], [1.25, 0.2], [0, 0.2]]), '#cfc6b8', 'flat');
    k.add(cyl(1.25, 1.25, 0.05, 24), '#5fb8d8', 'gloss', { p: [0, 0.35, 0] });
    k.add(cyl(0.18, 0.25, 1.0, 10), '#cfc6b8', 'flat', { p: [0, 0.7, 0] });
    k.add(lathe3([[0, 0], [0.6, 0], [0.65, 0.18], [0, 0.12]]), '#cfc6b8', 'flat', { p: [0, 1.15, 0] });
    // the puffin on top
    k.add(sphere(0.2, 12, 10), '#2a2a32', 'gloss', { p: [0, 1.55, 0], s: [1, 1.2, 1] });
    k.add(sphere(0.13, 10, 8), '#f6f4ee', 'gloss', { p: [0, 1.52, 0.1], s: [1, 1.2, 0.6] });
    k.add(cone(0.06, 0.16, 6), '#f27a2a', 'gloss', { p: [0, 1.7, 0.2], r: [PI / 2, 0, 0] });
    return k.build();
}
function lathe3(pts) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 24); }

export function iceCream() {
    const k = new Kit();
    k.add(box(1.4, 0.8, 0.8), '#f6f2ea', 'gloss', { p: [0, 0.8, 0] });
    for (const s of [-1, 1]) k.add(torus(0.3, 0.07, 6, 14), '#3a3a40', 'flat', { p: [s * 0.5, 0.35, 0.42] });
    k.add(cyl(0.03, 0.03, 1.4, 6), '#d8d8d8', 'metal', { p: [0, 1.9, 0] });
    for (let i = 0; i < 8; i++) {
        const g = new THREE.ConeGeometry(0.9, 0.35, 8, 1, true, (i / 8) * PI * 2, PI / 4);
        k.add(g, i % 2 ? '#ffb3c8' : '#9fe0ff', 'fur', { p: [0, 2.6, 0] });
    }
    k.add(cone(0.1, 0.3, 8), '#e0b070', 'flat', { p: [0.45, 1.35, 0], r: [PI, 0, 0] });
    k.add(sphere(0.12, 8, 6), '#ffb3c8', 'gloss', { p: [0.45, 1.55, 0] });
    return k.build();
}

export function bandstand() {
    const k = new Kit();
    k.add(cyl(2, 2.1, 0.4, 8), '#f2efe6', 'flat', { p: [0, 0.2, 0] });
    for (let i = 0; i < 8; i++) k.add(cyl(0.06, 0.06, 2.2, 6), '#f2efe6', 'gloss', { p: [Math.cos(i * PI / 4) * 1.8, 1.5, Math.sin(i * PI / 4) * 1.8] });
    k.add(cone(2.4, 1.2, 8), (x, y, z) => (Math.atan2(z, x) % (PI / 4) > PI / 8 ? '#2f7a5a' : '#f2efe6'), 'fur', { p: [0, 3.2, 0] });
    k.add(sphere(0.15, 8, 6), '#e7c04a', 'gold', { p: [0, 3.9, 0] });
    return k.build();
}

export function balloon() {
    const k = new Kit();
    k.add(sphere(1.4, 20, 16), (x, y) => (Math.floor((Math.atan2(x, 0.001 + y * 0) + PI) / (PI / 4)) % 2 ? '#e2503a' : '#ffd93b'), 'gloss', { p: [0, 6, 0], s: [1, 1.15, 1] });
    k.add(box(0.7, 0.5, 0.7), '#8a5a33', 'flat', { p: [0, 3.8, 0] });
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) k.add(cyl(0.01, 0.01, 1.4, 4), '#3a2a1a', 'matte', { p: [x, 4.6, z] });
    return k.build();
}

export function gull() {
    const g = new THREE.Group();
    const k = new Kit();
    k.add(sphere(0.12, 8, 6), '#f4f4f4', 'gloss', { s: [0.8, 0.8, 1.8] });
    k.add(cone(0.03, 0.1, 5), '#f2a03a', 'gloss', { p: [0, 0, 0.26], r: [PI / 2, 0, 0] });
    g.add(k.build());
    const wing = (s) => {
        const w = new Kit();
        w.add(box(0.5, 0.02, 0.16), '#e8e8e8', 'gloss', { p: [s * 0.25, 0, 0] });
        w.add(box(0.16, 0.021, 0.12), '#3a3a40', 'gloss', { p: [s * 0.45, 0, -0.02] });
        const m = w.build();
        const holder = new THREE.Group(); holder.add(m); g.add(holder);
        return holder;
    };
    g.userData.wings = [wing(-1), wing(1)];
    return g;
}

export function crate(c = '#a07a4a') {
    const k = new Kit();
    k.add(box(0.8, 0.8, 0.8), c, 'flat', { p: [0, 0.4, 0] });
    for (const s of [-1, 1]) k.add(box(0.84, 0.1, 0.1), shade(c, -0.2), 'flat', { p: [0, 0.4 + s * 0.3, 0.41] });
    k.add(box(0.1, 0.84, 0.1), shade(c, -0.2), 'flat', { p: [0, 0.4, 0.41], r: [0, 0, 0.8] });
    return k.build();
}

export function cobweb() {
    const k = new Kit();
    for (let i = 0; i < 5; i++) k.add(box(0.012, 0.012, 1.0), '#f4f4f4', 'glass', { r: [0, (i / 5) * PI / 2, 0], p: [Math.sin((i / 5) * PI / 2) * 0.5, 0, Math.cos((i / 5) * PI / 2) * 0.5] });
    for (let j = 1; j < 4; j++) k.add(torus(j * 0.25, 0.006, 3, 10, PI / 2), '#f4f4f4', 'glass', { r: [PI / 2, 0, 0] });
    return k.build();
}

export function plinth(h = 0.9, color = '#e8e0d0', glass = false) {
    const k = new Kit();
    k.add(box(0.8, h, 0.8), color, 'gloss', { p: [0, h / 2, 0] });
    k.add(box(0.9, 0.08, 0.9), shade(color, -0.08), 'gloss', { p: [0, h, 0] });
    k.add(box(0.9, 0.08, 0.9), shade(color, -0.08), 'gloss', { p: [0, 0.04, 0] });
    if (glass) k.add(box(0.8, 0.9, 0.8), '#bfe6ff', 'glass', { p: [0, h + 0.5, 0] });
    return k.build();
}

export function cabinet(color = '#8a5a33') {
    const k = new Kit();
    k.add(box(2.2, 1.0, 0.7), color, 'gloss', { p: [0, 0.5, 0] });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        k.add(box(0.46, 0.38, 0.04), shade(color, 0.12), 'gloss', { p: [-0.79 + i * 0.53, 0.28 + j * 0.44, 0.36] });
        k.add(sphere(0.03, 6, 4), '#e7c04a', 'gold', { p: [-0.79 + i * 0.53, 0.28 + j * 0.44, 0.39] });
    }
    return k.build();
}

export function aquarium() {
    const k = new Kit();
    k.add(box(2.4, 0.4, 1.0), '#3a3a40', 'flat', { p: [0, 0.2, 0] });
    k.add(box(2.3, 1.2, 0.9), '#4fb0d8', 'glass', { p: [0, 1.0, 0] });
    for (let i = 0; i < 5; i++) {
        k.add(sphere(0.08, 8, 6), ['#ff8a3a', '#ffd93b', '#ff6b8a', '#9fe0ff', '#ff8a3a'][i], 'gloss', { p: [-0.8 + i * 0.4, 0.8 + (i % 3) * 0.25, (i % 2) * 0.2 - 0.1], s: [1.6, 1, 0.6] });
    }
    for (let i = 0; i < 6; i++) k.add(cone(0.05, 0.4 + (i % 3) * 0.2, 4), '#3f9a5a', 'flat', { p: [-1 + i * 0.4, 0.6, -0.2 + (i % 2) * 0.3] });
    k.add(box(2.4, 0.08, 1.0), '#3a3a40', 'flat', { p: [0, 1.64, 0] });
    return k.build();
}

export function stand(w = 6, d = 2.4) {
    const k = new Kit();
    k.add(box(w, 0.3, d), '#8a6a4a', 'flat', { p: [0, 0.15, 0] });
    k.add(box(w + 0.2, 0.06, d + 0.2), '#6a4a32', 'flat', { p: [0, 0.32, 0] });
    for (const s of [-1, 1]) k.add(cyl(0.04, 0.04, 1.6, 6), '#9aa4aa', 'metal', { p: [s * w * 0.25, 1.1, 0] });
    return k.build();
}

export function rubble(seed = 0) {
    const k = new Kit();
    for (let i = 0; i < 9; i++) k.add(bumpy(new THREE.IcosahedronGeometry(0.25 + (i % 3) * 0.12, 0), 0.05, 3, i + seed), i % 2 ? '#a89a86' : '#8f8676', 'flat', { p: [Math.cos(i * 2.4 + seed) * (0.3 + i * 0.12), 0.15, Math.sin(i * 2.4 + seed) * (0.3 + i * 0.1)] });
    k.add(box(1.8, 0.12, 0.2), '#7a5a3a', 'flat', { p: [0.2, 0.3, 0.1], r: [0, 0.6, 0.3] });
    return k.build();
}

export function boards(w = 1.6) {
    const k = new Kit();
    k.add(box(w, 0.18, 0.06), '#8f7a62', 'flat', { p: [0, 0.5, 0], r: [0, 0, 0.35] });
    k.add(box(w, 0.18, 0.06), '#7a6a52', 'flat', { p: [0, 0.9, 0.02], r: [0, 0, -0.3] });
    return k.build();
}

export function vines(w = 3, h = 1.4) {
    const k = new Kit();
    for (let i = 0; i < 9; i++) {
        const x = (i / 8 - 0.5) * w;
        const pts = [[x, h, 0], [x + 0.2, h * 0.6, 0.05], [x - 0.1, h * 0.25, 0.08], [x + 0.1, 0, 0.1]];
        k.add(tube(pts, [0.03, 0.03, 0.025, 0.02], 4), '#3f6a2a', 'flat');
        for (let j = 0; j < 4; j++) k.add(sphere(0.1, 6, 4), j % 2 ? '#4f8a3a' : '#5fa24a', 'flat', { p: [pts[j][0] + 0.06, pts[j][1], pts[j][2] + 0.05], s: [1.2, 0.6, 0.4] });
    }
    return k.build();
}

export function sandPile(c = '#e3c48a') {
    const k = new Kit();
    k.add(bumpy(new THREE.SphereGeometry(0.7, 12, 8, 0, PI * 2, 0, PI / 2), 0.08, 2, 3), c, 'flat', { s: [1, 0.45, 1] });
    k.add(tube([[-0.5, 0.05, 0.4], [0, 0.12, 0.6], [0.6, 0.05, 0.5]], [0.05, 0.06, 0.04], 5), '#2f6a3a', 'flat');
    return k.build();
}

export function scaffold(w = 3, h = 2.4) {
    const k = new Kit();
    for (const x of [-w / 2, w / 2]) for (const z of [-0.4, 0.4]) k.add(cyl(0.04, 0.04, h, 6), '#9aa4aa', 'metal', { p: [x, h / 2, z] });
    for (const y of [h * 0.5, h]) k.add(box(w, 0.06, 0.9), '#b07a48', 'flat', { p: [0, y, 0] });
    k.add(box(w * 0.9, 0.04, 1.4), '#3a7ac4', 'fur', { p: [0, h + 0.3, 0], r: [0.2, 0, 0] });
    return k.build();
}

export function paperLantern(color = '#ff8a5a') {
    const k = new Kit();
    k.add(sphere(0.22, 12, 10), color, 'glow', { s: [1, 1.2, 1] });
    k.add(cyl(0.12, 0.12, 0.05, 10), '#3a2a1a', 'matte', { p: [0, 0.28, 0] });
    k.add(cyl(0.005, 0.005, 0.8, 3), '#3a2a1a', 'matte', { p: [0, 0.7, 0] });
    return k.build();
}

/** A string of glowing bulbs hanging between points (each [x, y, z]). */
export function stringLights(points, sag = 0.6, color = '#ffd27a') {
    const k = new Kit();
    for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1];
        const n = 10;
        const pts = [];
        for (let j = 0; j <= n; j++) {
            const t = j / n;
            pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t]);
        }
        k.add(tube(pts, [0.015, 0.015], 3, false), '#2a2a2a', 'matte');
        for (let j = 1; j < n; j += 1) k.add(sphere(0.07, 6, 5), j % 3 === 0 ? '#ff8a8a' : j % 3 === 1 ? color : '#9fe0ff', 'glow', { p: pts[j] });
    }
    return k.build({ shadow: false });
}

export function bunting(points, sag = 0.4) {
    const k = new Kit();
    const cols = ['#e2503a', '#ffd93b', '#3a9ae0', '#5fbf4a', '#f2f0ea'];
    for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1];
        const n = 9;
        for (let j = 0; j <= n; j++) {
            const t = j / n;
            const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t];
            const ang = Math.atan2(b[2] - a[2], b[0] - a[0]);
            k.add(extrude([[-0.14, 0], [0.14, 0], [0, -0.3]], 0.01, 0, 1), cols[(i * n + j) % cols.length], 'fur', { p, r: [0, -ang, 0] });
        }
    }
    return k.build({ shadow: false });
}

export function desk() {
    const k = new Kit();
    k.add(box(1.6, 0.08, 0.8), '#9a6a3a', 'gloss', { p: [0, 0.75, 0] });
    for (const x of [-0.7, 0.7]) for (const z of [-0.32, 0.32]) k.add(box(0.07, 0.75, 0.07), '#7a4a2a', 'gloss', { p: [x, 0.375, z] });
    for (let i = 0; i < 4; i++) k.add(box(0.32, 0.12 + i * 0.05, 0.42), '#fbf7ee', 'matte', { p: [-0.5 + i * 0.3, 0.85 + (0.12 + i * 0.05) / 2, 0] });
    k.add(cyl(0.05, 0.06, 0.12, 8), '#c23a3a', 'gloss', { p: [0.6, 0.85, 0.2] });
    return k.build();
}

export function skylight() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.y = 3;
    const g = new THREE.Group(); g.add(m);
    return g;
}

/** A painted wall panel from a canvas: 'jungle' or 'waves'. */
export function mural(kind, w = 6, h = 1.3) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round((1024 * h) / w);
    const x = c.getContext('2d');
    if (kind === 'jungle') {
        const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#bfe8c8'); g.addColorStop(1, '#6fae6a');
        x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < 40; i++) {
            x.fillStyle = ['#3f8a3a', '#2f7a32', '#5fa24a'][i % 3];
            x.beginPath(); const px = (i * 97) % c.width, py = c.height - 10 - (i % 5) * 18;
            x.ellipse(px, py, 50, 16, (i % 7) * 0.4, 0, PI * 2); x.fill();
        }
        x.fillStyle = '#7a8a4a';
        x.beginPath(); x.ellipse(c.width * 0.6, c.height * 0.55, 120, 40, 0, 0, PI * 2); x.fill();
        x.fillRect(c.width * 0.6 + 80, c.height * 0.3, 18, 70);
        x.beginPath(); x.arc(c.width * 0.6 + 92, c.height * 0.28, 26, 0, PI * 2); x.fill();
    } else {
        x.fillStyle = '#8fd0e8'; x.fillRect(0, 0, c.width, c.height);
        for (let r = 0; r < 6; r++) {
            x.strokeStyle = r % 2 ? '#f2fbff' : '#3a8ac4'; x.lineWidth = 10;
            x.beginPath();
            for (let px = 0; px <= c.width; px += 8) x.lineTo(px, c.height * (0.2 + r * 0.13) + Math.sin(px * 0.03 + r) * 12);
            x.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    const g = new THREE.Group(); g.add(m);
    return g;
}

export function banner(color = '#2f5a8a', h = 2.2) {
    const k = new Kit();
    k.add(cyl(0.04, 0.04, 0.9, 6), '#7a5a3a', 'flat', { p: [0, h, 0], r: [0, 0, PI / 2] });
    k.add(extrude([[-0.4, 0], [0.4, 0], [0.4, -1.4], [0, -1.15], [-0.4, -1.4]], 0.02, 0, 1), color, 'fur', { p: [0, h, 0.03] });
    k.add(sphere(0.18, 10, 8), '#e7c04a', 'gold', { p: [0, h - 0.6, 0.06], s: [1, 1, 0.3] });
    return k.build();
}

export function rock(s = 1, seed = 1) {
    const k = new Kit();
    k.add(bumpy(new THREE.IcosahedronGeometry(0.8, 1), 0.18, 1.6, seed), (x, y) => (y > 0.3 ? '#9a958b' : '#7d786e'), 'flat', { s: [1.2, 0.8, 1] });
    const g = k.build();
    g.scale.setScalar(s);
    return g;
}

export function bush(seed = 1) {
    const k = new Kit();
    for (let i = 0; i < 4; i++) k.add(bumpy(new THREE.IcosahedronGeometry(0.45 - i * 0.05, 1), 0.08, 2, seed + i), i % 2 ? '#4f9a3e' : '#3f8a32', 'flat', { p: [Math.cos(i * 2 + seed) * 0.35, 0.35, Math.sin(i * 2 + seed) * 0.35] });
    return k.build();
}

export { capsule };
