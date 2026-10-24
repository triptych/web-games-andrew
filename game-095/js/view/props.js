// Procedural furniture and fittings for the foyer and the parlor, plus the room shell every room
// uses. Everything faces +z (towards the camera) and stands on y = 0, centred on x and z.

import * as THREE from 'three';
import {
    M, box, cyl, sph, cone, torus, plane, mesh, group, at, add, hsl, hex, canvasTex, labelTex,
    glowSprite, blob, wallpaperTex, planksTex, glowMat,
} from './kit.js';

export const ROOM = { W: 12, H: 6.2, D: 8 };
export const WOOD = M(0x6b4630), WOOD_D = M(0x432a1d), WOOD_L = M(0x93683f), BRASS = M(0xdcb14f, { rough: 0.3, metal: 0.8 });
export const PAPER = M(0xf1e4c4), CREAM = M(0xe8dcc0), IRON = M(0x2b2a33, { rough: 0.5, metal: 0.4 }), STONE = M(0x7d7a86, { rough: 1 });
export const GLASS = M(0x9fd6ff, { rough: 0.1, opacity: 0.45 });
const rn = (a, b, s) => a + ((Math.sin(s * 12.9898) * 43758.5453) % 1 + 1) % 1 * (b - a);

// ------------------------------------------------------------------ the shell: walls, floor and a cut-away edge
export function shell({ wall, floor, trim = 0x4a2f20, wain = 0x5d3d2a, cut = 0xcdbfa2, wainH = 1.35, floorSlab = 0x2a1d17 }) {
    const { W, H, D } = ROOM;
    const g = group();
    const wallM = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 });
    const back = plane(W, H, wallM(wall), 0, H / 2, -D / 2);
    const left = plane(D, H, wallM(wall), -W / 2, H / 2, 0); left.rotation.y = Math.PI / 2;
    const right = plane(D, H, wallM(wall), W / 2, H / 2, 0); right.rotation.y = -Math.PI / 2;
    const fl = plane(W, D, new THREE.MeshStandardMaterial({ map: floor, roughness: 0.7, emissive: 0xffffff, emissiveMap: floor, emissiveIntensity: 0.12 }), 0, 0, 0); fl.rotation.x = -Math.PI / 2;
    add(g, back, left, right, fl);
    // the cut-away edges: wall slabs and a floor slab, so the room reads as a diorama
    add(g, box(W + 1.2, H, 0.5, M(cut), 0, H / 2, -D / 2 - 0.27));
    add(g, box(0.6, H, D + 0.5, M(cut), -W / 2 - 0.32, H / 2, 0.0));
    add(g, box(0.6, H, D + 0.5, M(cut), W / 2 + 0.32, H / 2, 0.0));
    add(g, box(W + 1.2, 0.7, D + 0.7, M(floorSlab), 0, -0.36, 0));
    add(g, box(W + 1.4, 0.16, 0.5, M(trim), 0, 0.08, D / 2 + 0.3)); // front sill
    // wainscot and rails
    const wm = M(wain, { rough: 0.8 }), tm = M(trim, { rough: 0.7 });
    add(g, box(W, wainH, 0.1, wm, 0, wainH / 2, -D / 2 + 0.05), box(W, 0.14, 0.18, tm, 0, wainH + 0.04, -D / 2 + 0.09), box(W, 0.3, 0.14, tm, 0, 0.15, -D / 2 + 0.07));
    for (const s of [-1, 1]) {
        const x = s * (W / 2 - 0.05);
        add(g, box(0.1, wainH, D, wm, x, wainH / 2, 0), box(0.18, 0.14, D, tm, x - s * 0.04, wainH + 0.04, 0), box(0.14, 0.3, D, tm, x - s * 0.02, 0.15, 0));
        add(g, box(0.2, 0.22, D, tm, x - s * 0.04, H - 0.11, 0));
    }
    add(g, box(W, 0.22, 0.2, tm, 0, H - 0.11, -D / 2 + 0.1));
    return g;
}

// ------------------------------------------------------------------ doors and windows
export function door({ w = 1.7, h = 3.2, color = 0x6b3f2a, knob = true, plate = false }) {
    const g = group();
    const lm = M(color, { rough: 0.7 }), fm = M(0x3b2418);
    add(g, box(w + 0.34, h + 0.2, 0.18, fm, 0, h / 2 + 0.1, 0));
    add(g, box(w, h, 0.14, lm, 0, h / 2, 0.06));
    for (const [px, py, pw, ph] of [[-w * 0.22, h * 0.7, w * 0.36, h * 0.34], [w * 0.22, h * 0.7, w * 0.36, h * 0.34], [-w * 0.22, h * 0.27, w * 0.36, h * 0.38], [w * 0.22, h * 0.27, w * 0.36, h * 0.38]]) {
        add(g, box(pw, ph, 0.05, M(color, { rough: 0.6 }), px, py, 0.14), box(pw - 0.14, ph - 0.14, 0.05, lm, px, py, 0.17));
    }
    if (knob) add(g, sph(0.08, BRASS, w * 0.36, h * 0.48, 0.2));
    if (plate) {
        const lock = group(box(0.22, 0.36, 0.04, BRASS, w * 0.36, h * 0.54, 0.2), cyl(0.045, 0.045, 0.06, M(0x111111), w * 0.36, h * 0.55, 0.23, 8));
        lock.children[1].rotation.x = Math.PI / 2;
        g.userData.lock = lock;
        add(g, lock);
    }
    return g;
}

export function doubleDoor({ w = 3.3, h = 4.0 }) {
    const g = group();
    const lm = M(0x6a3a4a, { rough: 0.6 }), fm = M(0xc79a45, { rough: 0.4, metal: 0.5 });
    add(g, box(w + 0.5, h + 0.4, 0.22, M(0x3b2418), 0, h / 2 + 0.2, 0));
    for (const s of [-1, 1]) {
        add(g, box(w / 2 - 0.04, h, 0.14, lm, s * w / 4, h / 2, 0.08));
        for (const py of [h * 0.28, h * 0.72]) add(g, box(w / 2 - 0.5, h * 0.3, 0.05, fm, s * w / 4, py, 0.18), box(w / 2 - 0.62, h * 0.3 - 0.12, 0.05, lm, s * w / 4, py, 0.21));
        add(g, sph(0.1, BRASS, s * 0.22, h * 0.45, 0.2));
    }
    // a ribbon of light seals the seam until the case is solved
    const seal = group();
    seal.add(plane(0.22, h, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 0, h / 2, 0.26));
    seal.add(glowSprite('#ffd9a0', 2.2, 0.55)); seal.children[1].position.set(0, h / 2, 0.3);
    g.userData.seal = seal;
    add(g, seal);
    return g;
}

const skyTex = (seed) => canvasTex('sky' + seed, 128, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0e0c2e'); gr.addColorStop(1, '#3a2a68');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,220,${0.3 + (i % 5) * 0.12})`; g.fillRect(((i * 53 + seed * 7) % w), ((i * 37) % (h * 0.8)), 1.5, 1.5); }
    const mg = g.createRadialGradient(w * 0.68, h * 0.3, 2, w * 0.68, h * 0.3, 30);
    mg.addColorStop(0, '#fffbe0'); mg.addColorStop(0.45, '#fff2b0'); mg.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = mg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(w * 0.68, h * 0.3, 15, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,30,80,0.8)';
    for (const [cx, cy, r] of [[30, 105, 22], [58, 112, 26], [90, 108, 20]]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
    // hills and a crooked tree
    g.fillStyle = '#120f26'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, 138); g.quadraticCurveTo(50, 118, 90, 140); g.lineTo(w, 130); g.lineTo(w, h); g.fill();
});

export function windowMoon({ w = 2.2, h = 3.0, curtains = true, seed = 1, arch = false }) {
    const g = group();
    add(g, box(w + 0.3, h + 0.3, 0.14, M(0x3f2a1e), 0, h / 2, 0));
    add(g, plane(w, h, new THREE.MeshBasicMaterial({ map: skyTex(seed) }), 0, h / 2, 0.08));
    add(g, box(0.07, h, 0.1, WOOD_D, 0, h / 2, 0.12), box(w, 0.07, 0.1, WOOD_D, 0, h * 0.55, 0.12));
    add(g, box(w + 0.5, 0.12, 0.34, WOOD, 0, -0.04, 0.12));
    if (curtains) {
        for (const s of [-1, 1]) {
            const c = group();
            for (let i = 0; i < 4; i++) add(c, box(0.17, h + 0.5, 0.1 + (i % 2) * 0.05, M(0x7a2a46, { rough: 1 }), s * (w / 2 + 0.1 + i * 0.14) - s * 0.0, h / 2 + 0.2, 0.18));
            add(g, c);
        }
        add(g, cyl(0.05, 0.05, w + 1.2, BRASS, 0, h + 0.5, 0.2, 8)).rotation.z = Math.PI / 2;
    }
    return g;
}

export function portrait({ w = 2.1, h = 2.7, age = 7, seed = 1 }) {
    const g = group();
    const tex = canvasTex('portrait' + age + '|' + seed, 160, 200, (c, cw, ch) => {
        const gr = c.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#5a4430'); gr.addColorStop(1, '#2c2118');
        c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
        const person = (x, y, s, coat, hair) => {
            c.fillStyle = coat; c.beginPath(); c.moveTo(x - 24 * s, y + 80 * s); c.quadraticCurveTo(x, y + 20 * s, x + 24 * s, y + 80 * s); c.fill();
            c.fillStyle = '#e7c9a4'; c.beginPath(); c.arc(x, y + 6 * s, 14 * s, 0, 7); c.fill();
            c.fillStyle = hair; c.beginPath(); c.arc(x, y + 1 * s, 14 * s, Math.PI, 0); c.fill();
            c.fillStyle = '#2a1a10'; c.fillRect(x - 6 * s, y + 4 * s, 2 * s, 3 * s); c.fillRect(x + 4 * s, y + 4 * s, 2 * s, 3 * s);
            c.fillRect(x - 3 * s, y + 12 * s, 6 * s, 1.5 * s);
        };
        person(52, 48, 1.15, '#31465e', '#2a2018'); person(108, 52, 1.1, '#6a2e48', '#7a4a2a');
        person(80, 100, 0.8, '#d7a8c8', '#caa045');
        // the child's bow, and a small sneeze waiting to happen
        c.fillStyle = '#ff7fa8'; c.beginPath(); c.moveTo(80, 94); c.lineTo(68, 88); c.lineTo(68, 100); c.fill(); c.beginPath(); c.moveTo(80, 94); c.lineTo(92, 88); c.lineTo(92, 100); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, cw, ch);
    });
    add(g, box(w + 0.4, h + 0.4, 0.14, M(0xc5973f, { rough: 0.35, metal: 0.6 }), 0, h / 2, 0), plane(w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, h / 2, 0.09));
    add(g, box(w * 0.7, 0.34, 0.05, M(0xc5973f, { metal: 0.6, rough: 0.35 }), 0, -0.4, 0.04), plane(w * 0.64, 0.26, new THREE.MeshBasicMaterial({ map: labelTex(`WINIFRED, AGED ${age}`, 256, 40, { bg: '#d8b25a', fg: '#3a2a10', pad: 0.06 }) }), 0, -0.4, 0.07));
    return g;
}

// ------------------------------------------------------------------ foyer
export function clock() {
    const g = group();
    const face = canvasTex('clockface', 128, 128, (c, w, h) => {
        c.fillStyle = '#efe6cc'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.stroke();
        c.fillStyle = '#3a2a1a'; c.font = 'bold 15px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; c.fillText(i, 64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); }
        c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(-Math.PI / 2 - 0.05) * 44, 64 + Math.sin(-Math.PI / 2 - 0.05) * 44); c.stroke();
        c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(-Math.PI / 2 - 0.5) * 28, 64 + Math.sin(-Math.PI / 2 - 0.5) * 28); c.stroke();
    });
    add(g, box(1.4, 0.5, 1.0, WOOD_D, 0, 0.25, 0), box(1.1, 3.2, 0.82, WOOD, 0, 2.1, 0), box(1.5, 0.3, 0.95, WOOD_D, 0, 3.85, 0), box(1.2, 0.6, 0.85, WOOD, 0, 4.2, 0));
    add(g, cone(0.7, 0.5, WOOD_D, 0, 4.7, 0, 4)).rotation.y = Math.PI / 4;
    add(g, cyl(0.52, 0.52, 0.06, M(0xefe6cc), 0, 4.15, 0.45, 24)).rotation.x = Math.PI / 2;
    const faceMesh = mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ map: face }), 0, 4.15, 0.49);
    add(g, faceMesh);
    add(g, box(0.62, 1.6, 0.05, M(0x1c1410), 0, 2.2, 0.42));
    const pend = group(cyl(0.02, 0.02, 1.3, BRASS, 0, -0.65, 0, 6), cyl(0.2, 0.2, 0.05, BRASS, 0, -1.3, 0, 20));
    pend.children[1].rotation.x = Math.PI / 2; pend.position.set(0, 3.0, 0.46);
    g.userData.pendulum = pend;
    add(g, pend, blob(2, 1.6, 0, 0));
    return g;
}

export function coatRack() {
    const g = group();
    add(g, cyl(0.07, 0.09, 3.6, WOOD_D, 0, 1.8, 0, 10), cyl(0.5, 0.58, 0.14, WOOD_D, 0, 0.07, 0, 14));
    for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.4;
        add(g, cyl(0.035, 0.035, 0.55, BRASS, Math.cos(a) * 0.25, 3.35, Math.sin(a) * 0.25, 6)).rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    for (const [dx, col, hh] of [[-0.3, 0xf2c230, 1.0], [0.3, 0x4aa3d9, 0.9]]) {
        const c = group(cone(0.42, hh, M(col, { rough: 0.9 }), 0, -hh / 2, 0, 12), sph(0.16, M(col), 0, 0.05, 0.0));
        c.position.set(dx * 1.1, 3.15, dx > 0 ? 0.3 : -0.28);
        add(g, c);
    }
    add(g, blob(1.6, 1.6, 0, 0));
    return g;
}

export function chandelier({ r = 1.1, candles = 6, drop = 1 }) {
    const g = group(), flames = [];
    add(g, cyl(0.03, 0.03, 4, M(0x222222, { metal: 0.6 }), 0, 2 + drop, 0, 6), sph(0.2, BRASS, 0, drop, 0));
    add(g, torus(r, 0.06, BRASS, 0, drop, 0)).rotation.x = Math.PI / 2;
    for (let i = 0; i < candles; i++) {
        const a = i / candles * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        add(g, cyl(0.07, 0.07, 0.38, M(0xfff1d0), x, drop + 0.24, z, 8), cyl(0.1, 0.06, 0.1, BRASS, x, drop + 0.04, z, 8));
        const f = mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMat(0xffc860), x, drop + 0.52, z); f.scale.set(0.8, 1.5, 0.8);
        const gl = glowSprite('#ffc060', 0.9, 0.8); gl.position.set(x, drop + 0.52, z);
        add(g, f, gl); flames.push(gl);
        add(g, mesh(new THREE.OctahedronGeometry(0.06), M(0xcfeaff, { rough: 0.1, metal: 0.2 }), x * 0.7, drop - 0.2, z * 0.7));
    }
    g.userData.flames = flames;
    return g;
}

export function lamp({ color = 0xffd27a } = {}) {
    const g = group();
    add(g, cyl(0.28, 0.34, 0.14, BRASS, 0, 0.07, 0, 14), cyl(0.05, 0.05, 0.8, BRASS, 0, 0.5, 0, 8));
    const shade = cyl(0.26, 0.46, 0.55, new THREE.MeshStandardMaterial({ color: 0xf3d99a, emissive: color, emissiveIntensity: 0.9, roughness: 1 }), 0, 1.15, 0, 16);
    add(g, shade, glowSprite('#ffcf80', 2.4, 0.5));
    g.children[g.children.length - 1].position.set(0, 1.15, 0.1);
    return g;
}

export function hatch() {
    const g = group();
    const closed = group(box(1.5, 1.5, 0.12, WOOD, 0, 0, 0), box(1.3, 1.3, 0.06, WOOD_L, 0, 0, 0.07), cyl(0.012, 0.012, 1.7, M(0xbfae8a), 0.35, -1.0, 0.12, 6), sph(0.07, M(0xaa2d2d), 0.35, -1.9, 0.12));
    const open = group(box(1.5, 1.5, 0.12, M(0x1b1410), 0, 0, 0));
    const lad = group();
    for (const s of [-1, 1]) add(lad, box(0.09, 3.6, 0.09, WOOD_L, s * 0.32, -1.8, 0.16));
    for (let i = 0; i < 7; i++) add(lad, box(0.64, 0.07, 0.09, WOOD_L, 0, -0.35 - i * 0.5, 0.16));
    add(open, lad, mesh(new THREE.PlaneGeometry(1.3, 1.3), glowMat(0x2a1e14), 0, 0, 0.07));
    g.userData.closed = closed; g.userData.open = open;
    add(g, closed, open);
    return g;
}

export function sidebar({ w = 2.6 } = {}) {
    const g = group();
    add(g, box(w, 0.2, 0.9, WOOD, 0, 1.3, 0), box(w - 0.2, 1.15, 0.8, WOOD_D, 0, 0.6, 0));
    for (const x of [-0.5, 0.5]) add(g, box(0.9, 0.9, 0.04, WOOD, x * 1.0, 0.62, 0.42), sph(0.05, BRASS, x * 1.0, 0.62, 0.46));
    add(g, blob(w + 0.6, 1.6, 0, 0));
    return g;
}

export function plant({ s = 1 } = {}) {
    const g = group();
    add(g, cyl(0.38 * s, 0.28 * s, 0.6 * s, M(0xb86a3c), 0, 0.3 * s, 0, 12), cyl(0.4 * s, 0.4 * s, 0.07 * s, M(0x8f4f2c), 0, 0.62 * s, 0, 12));
    for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, c = cone(0.17 * s, (1.1 + (i % 3) * 0.3) * s, M(hsl(130 + i * 6, 0.45, 0.22 + (i % 2) * 0.05)), Math.cos(a) * 0.26 * s, (1.2 + (i % 3) * 0.12) * s, Math.sin(a) * 0.26 * s, 6);
        c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); add(g, c);
    }
    add(g, blob(1.2 * s, 1.2 * s, 0, 0));
    return g;
}

// ------------------------------------------------------------------ parlor
export function sofa({ w = 3.6, color = 0x7d3a58 } = {}) {
    const g = group(), m = M(color, { rough: 0.95 }), md = M(new THREE.Color(color).multiplyScalar(0.75).getHex(), { rough: 0.95 });
    add(g, box(w, 0.5, 1.3, md, 0, 0.5, 0), box(w, 1.3, 0.38, m, 0, 1.15, -0.5));
    for (const s of [-1, 1]) add(g, box(0.4, 0.95, 1.3, m, s * (w / 2 - 0.2), 0.78, 0.0), sph(0.2, m, s * (w / 2 - 0.2), 1.25, 0.0));
    for (let i = -1; i <= 1; i++) add(g, box(w / 3 - 0.2, 0.28, 1.0, M(new THREE.Color(color).multiplyScalar(1.1).getHex(), { rough: 0.95 }), i * (w - 0.8) / 3, 0.88, 0.1));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, cyl(0.07, 0.05, 0.28, WOOD_D, x * (w / 2 - 0.15), 0.14, z * 0.5, 6));
    add(g, box(0.5, 0.4, 0.14, M(0xf2c230), -0.9, 1.15, -0.2)).rotation.set(0.1, 0.4, 0.2);
    add(g, blob(w + 0.8, 2.4, 0, 0));
    return g;
}

export function teaTable() {
    const g = group();
    add(g, cyl(0.85, 0.85, 0.12, WOOD_L, 0, 1.3, 0, 24), cyl(0.12, 0.2, 1.2, WOOD, 0, 0.7, 0, 10), cyl(0.5, 0.55, 0.1, WOOD, 0, 0.05, 0, 16));
    add(g, cyl(0.84, 0.84, 0.03, M(0xf2e8d0), 0, 1.38, 0, 24));
    const pot = group();
    const pm = M(0x6fb3c9, { rough: 0.25 });
    add(pot, sph(0.3, pm, 0, 0.3, 0)).scale.set(1, 0.85, 1);
    add(pot, cyl(0.05, 0.1, 0.32, pm, 0.34, 0.38, 0, 8)).rotation.z = -0.9;
    add(pot, torus(0.14, 0.035, pm, -0.33, 0.3, 0)); add(pot, cyl(0.17, 0.2, 0.06, pm, 0, 0.55, 0, 12), sph(0.05, M(0xf2e8d0), 0, 0.62, 0));
    pot.position.set(0.1, 1.4, 0.05);
    g.userData.pot = pot;
    add(g, pot);
    for (const x of [-0.5, 0.45]) add(g, cyl(0.14, 0.09, 0.14, M(0xf4f4f4, { rough: 0.3 }), x, 1.47, 0.4, 12));
    add(g, blob(2.2, 2.2, 0, 0));
    return g;
}

export function fireplace() {
    const g = group();
    add(g, box(3.6, 3.0, 1.0, STONE, 0, 1.5, 0));
    add(g, box(2.0, 1.5, 0.3, M(0x15100e), 0, 0.9, 0.42));
    add(g, box(4.2, 0.28, 1.3, WOOD_D, 0, 3.1, 0.1), box(2.6, 2.4, 0.9, STONE, 0, 4.4, -0.05));
    for (const x of [-0.5, 0.2]) add(g, cyl(0.18, 0.18, 1.2, WOOD, x, 0.3, 0.5, 8)).rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) add(g, sph(0.16, M(0xff6a2a, { emissive: 0xff5a1a, ei: 1.2 }), -0.5 + i * 0.35, 0.28, 0.52, 8, 6));
    const gl = glowSprite('#ff8a3a', 2.6, 0.55); gl.position.set(0, 0.75, 0.7); add(g, gl);
    g.userData.glow = gl;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) add(g, box(0.6, 0.32, 0.02, M(0x6b6874), -1.5 + c * 0.6 + (r % 2) * 0.3, 0.2 + r * 0.7, 0.52));
    return g;
}

export const NOTE_COLORS = [0xff6b8b, 0xffb43a, 0x4fd6a0, 0x56b8ff, 0xa57bff];
export function musicBox() {
    const g = group();
    add(g, box(1.3, 0.55, 0.8, M(0x8a2d4a, { rough: 0.4 }), 0, 0.28, 0), box(1.36, 0.14, 0.86, BRASS, 0, 0.62, 0));
    add(g, box(1.2, 0.16, 0.7, M(0xa0405c, { rough: 0.4 }), 0, 0.77, 0));
    for (let i = 0; i < 5; i++) {
        const k = cyl(0.075, 0.075, 0.07, M(NOTE_COLORS[i], { emissive: NOTE_COLORS[i], ei: 0.5, rough: 0.3 }), -0.44 + i * 0.22, 0.89, 0.12, 12);
        add(g, k);
    }
    add(g, cyl(0.03, 0.03, 0.3, BRASS, 0.74, 0.4, 0, 6)).rotation.z = Math.PI / 2;
    add(g, sph(0.07, BRASS, 0.92, 0.4, 0));
    const glow = glowSprite('#ffd27a', 1.6, 0); glow.position.set(0, 0.9, 0.1); add(g, glow); g.userData.glow = glow;
    return g;
}

export function sideTable({ w = 1.5, h = 1.3 } = {}) {
    const g = group();
    add(g, box(w, 0.12, w * 0.7, WOOD_L, 0, h, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.1, h, 0.1, WOOD, x * (w / 2 - 0.1), h / 2, z * (w * 0.35 - 0.1)));
    add(g, blob(w + 0.6, w + 0.2, 0, 0));
    return g;
}

export function stuffedCat() {
    const g = group();
    const m = M(0x232029, { rough: 1 });
    add(g, sph(0.4, m, 0, 0.4, 0)).scale.set(1, 0.9, 1.2);
    add(g, sph(0.3, m, 0, 0.88, 0.25));
    for (const s of [-1, 1]) {
        add(g, cone(0.1, 0.22, m, s * 0.17, 1.15, 0.22, 4));
        add(g, sph(0.065, glowMat(0xb9ff6a), s * 0.12, 0.92, 0.5, 8, 6));
    }
    add(g, cyl(0.06, 0.04, 0.8, m, -0.38, 0.55, -0.2, 6)).rotation.z = 0.7;
    add(g, blob(1.2, 1.2, 0, 0));
    return g;
}

export function guestNote({ guests = 5 } = {}) {
    const g = group();
    const tex = canvasTex('guests' + guests, 128, 160, (c, w, h) => {
        c.fillStyle = '#f2e6c6'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#4a3322'; c.font = 'bold 13px Georgia'; c.textAlign = 'center'; c.fillText("Winnie's Party", 64, 22);
        for (let i = 0; i < guests; i++) {
            c.fillStyle = '#7a6a58'; c.fillRect(22, 42 + i * 14, 74, 3);
            c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 44 + i * 14); c.lineTo(102, 44 + i * 14); c.stroke();
        }
    });
    add(g, box(0.9, 1.12, 0.04, WOOD_D, 0, 0.56, 0), plane(0.82, 1.02, new THREE.MeshBasicMaterial({ map: tex }), 0, 0.56, 0.03));
    g.rotation.x = -0.95; g.position.y = 0;
    return g;
}
