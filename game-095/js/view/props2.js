// Procedural furniture for the library, kitchen, attic and ballroom.

import * as THREE from 'three';
import {
    M, box, cyl, sph, cone, torus, plane, mesh, group, add, hsl, hex, canvasTex, labelTex,
    glowSprite, blob, glowMat,
} from './kit.js';
import { WOOD, WOOD_D, WOOD_L, BRASS, PAPER, CREAM, IRON, STONE, GLASS, NOTE_COLORS } from './props.js';

// ------------------------------------------------------------------ library
/** A tall shelf. Five of its books are the pullable ones, with their titles on the spines. */
export function bookshelf({ titles, w = 5.2, h = 5.0 }) {
    const g = group(), books = [];
    add(g, box(w, h, 0.14, WOOD_D, 0, h / 2, -0.3));
    for (const s of [-1, 1]) add(g, box(0.22, h, 0.8, WOOD, s * (w / 2 - 0.11), h / 2, 0));
    add(g, box(w + 0.2, 0.28, 0.9, WOOD, 0, h + 0.1, 0));
    const rows = 4, rowH = (h - 0.3) / rows;
    for (let r = 0; r <= rows; r++) add(g, box(w - 0.2, 0.12, 0.8, WOOD, 0, 0.14 + r * rowH, 0));
    const pal = [0x8b2e3c, 0x2f5d8a, 0x3f7a4f, 0xb8892f, 0x5b3a82, 0x9a4a2a, 0x2d6b6b];
    let seed = 3;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let r = 0; r < rows; r++) {
        let x = -w / 2 + 0.3;
        const y0 = 0.2 + r * rowH;
        while (x < w / 2 - 0.45) {
            const bw = 0.16 + rand() * 0.14, bh = rowH * (0.62 + rand() * 0.3);
            // the middle shelf keeps five gaps for the titled books
            if (r === 2 && Math.abs(x - (-w / 2 + 0.3)) < 0.01) { /* start */ }
            add(g, box(bw, bh, 0.55, M(pal[Math.floor(rand() * pal.length)], { rough: 0.8 }), x + bw / 2, y0 + bh / 2 + 0.04, 0.02 + (rand() - 0.5) * 0.04));
            x += bw + 0.015;
        }
    }
    // the five titled books, in a row on the shelf above the middle
    const y0 = 0.2 + 2 * rowH + rowH * 0.0;
    const cols = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd68910, 0x8e44ad];
    for (let i = 0; i < 5; i++) {
        const bw = 0.5, bh = rowH * 0.82, bx = -1.4 + i * 0.7;
        const b = group();
        add(b, box(bw, bh, 0.6, M(cols[i], { rough: 0.7 }), 0, 0, 0));
        add(b, plane(bw - 0.04, bh - 0.12, new THREE.MeshStandardMaterial({ map: labelTex(titles[i], 64, 200, { bg: hex(new THREE.Color(cols[i]).multiplyScalar(0.55)), fg: '#fff0c8', vertical: true, pad: 0.07 }), roughness: 0.7 }), 0, 0, 0.31));
        b.position.set(bx, 0.2 + 2 * rowH + bh / 2 + 0.06, 0.06);
        b.userData.baseZ = b.position.z;
        add(g, b); books.push(b);
    }
    // the secret compartment lives in the bottom row, behind a panel that slides up
    const panel = box(1.5, rowH * 0.7, 0.1, WOOD_L, 1.5, 0.2 + rowH * 0.4, 0.38);
    const cavity = group(box(1.5, rowH * 0.7, 0.5, M(0x120d0a), 1.5, 0.2 + rowH * 0.4, 0.1));
    add(g, cavity, panel);
    g.userData.books = books; g.userData.panel = panel; g.userData.cavity = cavity; g.userData.rowH = rowH;
    return g;
}

export function desk() {
    const g = group();
    add(g, box(3.0, 0.16, 1.3, WOOD, 0, 1.45, 0), box(0.12, 1.4, 1.1, WOOD_D, -1.35, 0.7, 0), box(0.12, 1.4, 1.1, WOOD_D, 1.35, 0.7, 0), box(2.6, 1.0, 0.1, WOOD_D, 0, 0.8, -0.5));
    for (const x of [-0.7, 0.7]) add(g, box(1.0, 0.45, 0.06, WOOD_L, x, 1.15, 0.55), sph(0.05, BRASS, x, 1.15, 0.6));
    add(g, box(3.2, 0.06, 1.5, M(0x1e4a3a, { rough: 1 }), 0, 1.55, 0));
    add(g, blob(3.8, 2.2, 0, 0));
    return g;
}

export function quill() {
    const g = group();
    add(g, cyl(0.012, 0.016, 0.9, M(0xf5f0e6), 0, 0, 0, 6));
    const f = plane(0.26, 0.7, M(0xf5f0e6, { side: THREE.DoubleSide }), 0.08, 0.15, 0); f.rotation.z = -0.15; add(g, f);
    g.rotation.z = Math.PI / 2 - 0.3; g.rotation.y = 0.3;
    return g;
}

export function inkwell() {
    const g = group();
    add(g, cyl(0.2, 0.24, 0.32, M(0x1c2a5a, { rough: 0.15, opacity: 0.9 }), 0, 0.16, 0, 14), cyl(0.12, 0.12, 0.05, BRASS, 0, 0.33, 0, 10));
    add(g, glowSprite('#4a7aff', 0.9, 0.35)); g.children[2].position.y = 0.2;
    return g;
}

export function diary() {
    const g = group();
    add(g, box(1.05, 0.08, 0.75, M(0x7a2d3c), 0, 0.04, 0));
    for (const s of [-1, 1]) { const p = plane(0.5, 0.7, M(0xf3e8c8, { side: THREE.DoubleSide }), s * 0.26, 0.11, 0); p.rotation.x = -Math.PI / 2; p.rotation.z = s * 0.04; add(g, p); }
    const lines = canvasTex('diarylines', 64, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.strokeStyle = '#5a4a38'; c.lineWidth = 1.5; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(8, 12 + i * 7); c.lineTo(10 + 40 + (i % 3) * 6, 12 + i * 7 + (i % 2)); c.stroke(); } });
    const t = plane(0.42, 0.5, new THREE.MeshBasicMaterial({ map: lines, transparent: true }), 0.26, 0.115, 0); t.rotation.x = -Math.PI / 2; add(g, t);
    return g;
}

export function framedRhyme() {
    const g = group();
    const tex = canvasTex('rhymepaper', 128, 160, (c, w, h) => {
        c.fillStyle = '#efe0b8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#5a4430'; c.font = 'italic bold 14px Georgia'; c.textAlign = 'center'; c.fillText('A Rhyme for', 64, 24); c.fillText('the Shelf', 64, 42);
        for (let i = 0; i < 6; i++) { c.fillStyle = '#6b5640'; c.fillRect(24 + (i % 2) * 6, 62 + i * 14, 60 + (i % 3) * 10, 3); }
        c.fillStyle = '#b8412e'; c.beginPath(); c.arc(100, 140, 7, 0, 7); c.fill();
    });
    add(g, box(1.5, 1.8, 0.1, BRASS, 0, 0.9, 0), plane(1.28, 1.58, new THREE.MeshBasicMaterial({ map: tex }), 0, 0.9, 0.06));
    return g;
}

export function globe() {
    const g = group();
    const tex = canvasTex('globe', 128, 64, (c, w, h) => {
        c.fillStyle = '#2a6fb5'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#4c9a58';
        for (const [x, y, r] of [[22, 24, 14], [34, 36, 9], [66, 22, 16], [74, 40, 10], [100, 30, 12], [46, 12, 7]]) { c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0.4, 0, 7); c.fill(); }
    });
    add(g, cyl(0.35, 0.4, 0.12, WOOD_D, 0, 0.06, 0, 14), cyl(0.04, 0.04, 0.6, BRASS, 0, 0.4, 0, 6));
    const s = sph(0.55, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), 0, 1.0, 0); s.rotation.z = 0.4; add(g, s);
    add(g, torus(0.62, 0.025, BRASS, 0, 1.0, 0)).rotation.set(0.4, 0, 1.2);
    g.userData.ball = s;
    add(g, blob(1.3, 1.3, 0, 0));
    return g;
}

export function rockingChair() {
    const g = group(), rock = group();
    add(rock, box(1.1, 0.14, 0.9, WOOD_L, 0, 0.8, 0), box(1.1, 1.5, 0.12, WOOD_L, 0, 1.55, -0.4));
    for (let i = -2; i <= 2; i++) add(rock, box(0.08, 1.2, 0.06, WOOD, i * 0.22, 1.5, -0.36));
    for (const s of [-1, 1]) {
        add(rock, box(0.1, 0.6, 0.1, WOOD, s * 0.5, 0.5, 0.3), box(0.1, 0.6, 0.1, WOOD, s * 0.5, 0.5, -0.3));
        const run = mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 20, Math.PI * 0.5), WOOD, s * 0.5, 0.95, 0); run.rotation.set(0, Math.PI / 2, Math.PI * 1.25); add(rock, run);
        add(rock, box(0.12, 0.08, 0.7, WOOD_D, s * 0.7, 0.2, 0));
        add(rock, box(0.14, 0.12, 0.7, WOOD, s * 0.55, 0.9, 0));
    }
    add(rock, box(1.0, 0.1, 0.8, M(0x8a3b4c, { rough: 1 }), 0, 0.92, 0.0));
    rock.position.y = 0;
    g.userData.rock = rock;
    add(g, rock, blob(1.6, 1.6, 0, 0));
    return g;
}

// ------------------------------------------------------------------ kitchen
export function oven() {
    const g = group();
    add(g, box(2.6, 2.4, 1.4, IRON, 0, 1.2, 0), box(2.8, 0.14, 1.5, M(0x1c1b22, { rough: 0.4, metal: 0.4 }), 0, 2.45, 0));
    const winM = new THREE.MeshStandardMaterial({ color: 0x2a1308, emissive: 0xff6a1a, emissiveIntensity: 0, roughness: 0.4 });
    add(g, box(1.7, 1.2, 0.08, M(0x3a3946, { metal: 0.4, rough: 0.5 }), 0, 1.15, 0.72), mesh(new THREE.PlaneGeometry(1.4, 0.85), winM, 0, 1.2, 0.77));
    add(g, cyl(0.04, 0.04, 1.7, BRASS, 0, 1.95, 0.85, 8)).rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) add(g, cyl(0.07, 0.07, 0.14, BRASS, -0.9 + i * 0.6, 2.1, 0.74, 8)).rotation.x = Math.PI / 2;
    for (const [x, z] of [[-0.6, -0.15], [0.6, -0.15], [-0.6, 0.3], [0.6, 0.3]]) add(g, torus(0.28, 0.04, M(0x111116), x, 2.55, z)).rotation.x = Math.PI / 2;
    add(g, cyl(0.2, 0.2, 3, IRON, 0.9, 4.0, -0.4, 10));
    const glow = glowSprite('#ff8a3a', 2.4, 0); glow.position.set(0, 1.2, 0.9); add(g, glow);
    g.userData.win = winM; g.userData.glow = glow;
    add(g, blob(3.2, 2.2, 0, 0));
    return g;
}

export function pantry() {
    const g = group();
    add(g, box(2.4, 4.0, 1.0, WOOD, 0, 2.0, 0), box(2.55, 0.2, 1.1, WOOD_D, 0, 4.1, 0));
    // what is inside, visible once the doors swing open
    const inside = group(box(2.1, 3.6, 0.2, M(0x1a110c), 0, 2.0, 0.42));
    for (const y of [1.0, 2.0, 3.0]) add(inside, box(2.1, 0.07, 0.5, WOOD_L, 0, y, 0.6));
    const jars = [[-0.6, 1.2, 0xe8738f], [0.0, 1.2, 0xe2b34a], [0.6, 1.2, 0x7ac7a0], [-0.5, 2.2, 0xf4efe2], [0.4, 2.2, 0xb98ad9], [0.7, 3.2, 0xff9a52], [-0.4, 3.2, 0x69b6e0]];
    for (const [x, y, c] of jars) add(inside, cyl(0.2, 0.2, 0.34, M(c, { rough: 0.3 }), x, y + 0.2, 0.62, 10));
    add(g, inside);
    const doors = group();
    for (const s of [-1, 1]) {
        const pivot = group();
        pivot.position.set(s * 1.17, 2.0, 0.52);
        add(pivot, box(1.12, 3.6, 0.1, WOOD_L, -s * 0.58, 0, 0), box(0.8, 1.3, 0.04, WOOD, -s * 0.58, 0.85, 0.06), box(0.8, 1.3, 0.04, WOOD, -s * 0.58, -0.85, 0.06), sph(0.06, BRASS, -s * 0.15, 0, 0.1));
        pivot.userData.s = s;
        add(doors, pivot);
    }
    add(g, doors);
    const lock = group(box(0.5, 0.7, 0.07, BRASS, 0, 0, 0));
    for (let i = 0; i < 3; i++) add(lock, cyl(0.08, 0.08, 0.1, M(0x2a2420, { rough: 0.5, metal: 0.4 }), -0.15 + i * 0.15, 0.05, 0.07, 12)).rotation.x = Math.PI / 2;
    lock.position.set(0, 2.0, 0.66);
    add(g, lock);
    g.userData.doors = doors; g.userData.lock = lock;
    add(g, blob(3, 2, 0, 0));
    return g;
}

export function counter({ w = 3.4 } = {}) {
    const g = group();
    add(g, box(w, 1.35, 1.2, WOOD, 0, 0.68, 0), box(w + 0.1, 0.16, 1.3, M(0xd7d0c0, { rough: 0.4 }), 0, 1.42, 0));
    for (let i = 0; i < 3; i++) add(g, box(w / 3 - 0.14, 1.0, 0.04, WOOD_L, (i - 1) * w / 3, 0.66, 0.62), sph(0.04, BRASS, (i - 1) * w / 3 + 0.2, 0.7, 0.66));
    add(g, blob(w + 0.6, 2, 0, 0));
    return g;
}

export function closet() {
    const g = group();
    add(g, box(1.5, 3.4, 0.3, M(0x3b2418), 0, 1.7, 0));
    const d = box(1.3, 3.2, 0.1, M(0x8aa38e, { rough: 0.8 }), 0, 1.6, 0.16);
    add(g, d, sph(0.07, BRASS, 0.45, 1.6, 0.25), box(0.9, 1.3, 0.04, M(0x7a9480), 0, 2.2, 0.22), box(0.9, 1.1, 0.04, M(0x7a9480), 0, 0.85, 0.22));
    add(g, box(0.9, 0.16, 0.05, M(0xf1e4c4), 0, 3.0, 0.22));
    return g;
}

export function icebox() {
    const g = group();
    const m = M(0xbfd7e4, { rough: 0.35 });
    add(g, box(1.8, 3.4, 1.3, m, 0, 1.7, 0));
    for (const y of [2.4, 0.95]) add(g, box(1.55, y > 2 ? 1.3 : 1.7, 0.06, M(0xd6e6ee, { rough: 0.3 }), 0, y > 2 ? 2.4 : 0.95, 0.67), box(0.07, 0.5, 0.1, BRASS, 0.7, y > 2 ? 2.2 : 1.2, 0.74));
    add(g, blob(2.6, 2, 0, 0));
    return g;
}

export function calendar({ day = 5 } = {}) {
    const g = group();
    const tex = canvasTex('cal' + day, 128, 160, (c, w, h) => {
        c.fillStyle = '#f4ead0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#c0572a'; c.fillRect(0, 0, w, 24);
        c.fillStyle = '#fff'; c.font = 'bold 15px Georgia'; c.textAlign = 'center'; c.fillText('OCTOBER', 64, 17);
        c.fillStyle = '#4a3a2a'; c.font = '10px Georgia';
        for (let i = 0; i < 31; i++) {
            const x = 12 + (i % 7) * 17, y = 42 + Math.floor(i / 7) * 20;
            c.fillText(i + 1, x, y);
            if (i + 1 === day) {
                c.strokeStyle = '#d02828'; c.lineWidth = 2;
                for (const k of [0, 1, 2]) { c.beginPath(); c.ellipse(x, y - 3, 9 + k, 8 + k * 0.6, k * 0.3, 0, 7); c.stroke(); }
            }
        }
        c.fillStyle = '#d02828'; c.font = 'bold 9px Georgia'; c.fillText('MY PARTY!!!', 64, 146);
        c.fillStyle = '#e8a1c0'; c.fillRect(100, 125, 16, 10); c.fillStyle = '#fff'; c.fillRect(106, 118, 2, 7);
    });
    add(g, box(1.3, 1.65, 0.06, M(0x6a5a48), 0, 0.82, 0), plane(1.18, 1.5, new THREE.MeshBasicMaterial({ map: tex }), 0, 0.82, 0.04));
    return g;
}

export function cookieJar() {
    const g = group();
    add(g, cyl(0.36, 0.3, 0.7, M(0xd88e3a, { rough: 0.3 }), 0, 0.35, 0, 14), cyl(0.3, 0.3, 0.1, M(0xb86e1f), 0, 0.75, 0, 14), sph(0.09, M(0xb86e1f), 0, 0.88, 0, 8, 6));
    add(g, plane(0.34, 0.28, new THREE.MeshBasicMaterial({ map: labelTex('COOKIES', 128, 64, { bg: '#f1e4c4', fg: '#8a3a1e', pad: 0.08 }) }), 0, 0.38, 0.33));
    return g;
}

export function hangingPots() {
    const g = group();
    add(g, box(2.6, 0.1, 0.1, IRON, 0, 0, 0));
    for (const [x, r, hh] of [[-0.9, 0.34, 0.5], [-0.3, 0.28, 0.4], [0.35, 0.36, 0.55], [0.95, 0.24, 0.35]]) {
        add(g, cyl(0.015, 0.015, 0.5, IRON, x, -0.25, 0, 4), cyl(r, r * 0.85, hh, M(0xb87333, { rough: 0.3, metal: 0.7 }), x, -0.5 - hh / 2, 0, 14));
    }
    return g;
}

export function kitchenTable() {
    const g = group();
    add(g, box(2.4, 0.14, 1.5, WOOD_L, 0, 1.3, 0), add(group(), box(2.3, 0.02, 1.4, M(0xd9534a, { rough: 1 }), 0, 1.38, 0)));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.12, 1.3, 0.12, WOOD, x * 1.05, 0.65, z * 0.62));
    for (const x of [-0.8, 0.8]) { add(g, box(0.7, 0.1, 0.7, WOOD, x, 0.8, 1.35), box(0.7, 0.8, 0.08, WOOD, x, 1.25, 1.65)); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.07, 0.8, 0.07, WOOD, x + dx * 0.3, 0.4, 1.35 + dz * 0.3)); }
    add(g, blob(3.2, 3.4, 0, 0.5));
    return g;
}

/** A patch of spilled flour with tiny bare footprints in it, drawn on the floor. */
export function flourPrints() {
    const tex = canvasTex('flourprints', 256, 128, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        const gr = c.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, 110);
        gr.addColorStop(0, 'rgba(245,240,230,0.95)'); gr.addColorStop(0.7, 'rgba(240,235,225,0.7)'); gr.addColorStop(1, 'rgba(240,235,225,0)');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(90,70,50,0.55)';
        for (let i = 0; i < 6; i++) {
            const x = 50 + i * 32, y = 64 + (i % 2 ? 9 : -9);
            c.beginPath(); c.ellipse(x, y, 7, 11, 0.2, 0, 7); c.fill();
            for (let t = 0; t < 4; t++) { c.beginPath(); c.arc(x - 6 + t * 4, y - 14 + (t === 0 || t === 3 ? 2 : 0), 2.3, 0, 7); c.fill(); }
        }
    });
    const m = mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1;
    return m;
}

// ------------------------------------------------------------------ attic
export function musicStand({ melody }) {
    const g = group();
    add(g, cyl(0.04, 0.04, 2.1, IRON, 0, 1.05, 0, 6), cyl(0.5, 0.55, 0.06, IRON, 0, 0.03, 0, 3), box(1.1, 0.8, 0.05, WOOD_D, 0, 2.2, 0));
    const tex = canvasTex('sheet' + melody.join(''), 160, 110, (c, w, h) => {
        c.fillStyle = '#f2e7c9'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#6a5a48'; c.lineWidth = 1;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(8, 34 + i * 8); c.lineTo(w - 8, 34 + i * 8); c.stroke(); }
        const cols = ['#ff6b8b', '#ffb43a', '#4fd6a0', '#56b8ff', '#a57bff'];
        melody.forEach((n, i) => { c.fillStyle = cols[n]; c.beginPath(); c.arc(28 + i * 34, 30 + (4 - n) * 4, 8, 0, 7); c.fill(); c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(35 + i * 34, 30 + (4 - n) * 4); c.lineTo(35 + i * 34, 8); c.stroke(); });
        c.fillStyle = '#6a3a1e'; c.font = 'italic 12px Georgia'; c.textAlign = 'center'; c.fillText("Mama's lullaby", w / 2, 98);
    });
    add(g, plane(1.0, 0.7, new THREE.MeshBasicMaterial({ map: tex }), 0, 2.2, 0.04));
    g.rotation.x = -0.1;
    add(g, blob(1.6, 1.6, 0, 0));
    return g;
}

export function trunk() {
    const g = group();
    add(g, box(2.2, 0.95, 1.3, M(0x6e4a2a, { rough: 0.8 }), 0, 0.5, 0));
    // a domed lid that swings up about its back edge
    const lid = group(sph(1, M(0x7a5232, { rough: 0.8 }), 0, 0, 0.6));
    lid.children[0].scale.set(1.12, 0.42, 0.68);
    lid.position.set(0, 0.98, -0.6);
    for (const x of [-0.75, 0.75]) { add(g, box(0.14, 1.0, 1.35, BRASS, x, 0.5, 0)); }
    const star = mesh(new THREE.CircleGeometry(0.2, 5), BRASS, 0, 0.82, 0.67);
    const lockM = group(star, glowSprite('#ffe28a', 0.7, 0.4)); lockM.children[1].position.set(0, 0.82, 0.7);
    add(g, lid, lockM);
    g.userData.lid = lid; g.userData.lockM = lockM;
    // faded streamers poking out once it is open
    const stuff = group();
    for (let i = 0; i < 5; i++) add(stuff, cyl(0.03, 0.03, 0.8, M([0xff6b8b, 0xffb43a, 0x4fd6a0, 0x56b8ff, 0xa57bff][i]), -0.7 + i * 0.35, 1.1, 0, 5)).rotation.z = (i - 2) * 0.2;
    stuff.visible = false; add(g, stuff);
    g.userData.stuff = stuff;
    add(g, blob(2.8, 2, 0, 0));
    return g;
}

export function rockingHorse() {
    const g = group(), body = group();
    const m = M(0xb4784a, { rough: 0.7 });
    add(body, sph(0.55, m, 0, 1.15, 0)).scale.set(1.4, 0.8, 0.7);
    add(body, cyl(0.15, 0.2, 0.9, m, 0.55, 1.6, 0, 8)).rotation.z = -0.5;
    add(body, sph(0.24, m, 0.85, 1.95, 0), box(0.42, 0.22, 0.28, m, 1.1, 1.85, 0));
    add(body, box(0.1, 0.5, 0.06, M(0x3a2a1a), 0.45, 1.85, 0)).rotation.z = 0.3;
    add(body, sph(0.045, M(0x111111), 0.95, 2.02, 0.2, 6, 5), sph(0.045, M(0x111111), 0.95, 2.02, -0.2, 6, 5));
    for (const [x, z] of [[-0.45, -0.22], [-0.45, 0.22], [0.5, -0.22], [0.5, 0.22]]) add(body, cyl(0.07, 0.06, 0.8, m, x, 0.65, z, 6));
    for (const s of [-1, 1]) {
        const r = mesh(new THREE.TorusGeometry(1.2, 0.05, 6, 20, Math.PI * 0.55), WOOD_D, 0, 1.15, s * 0.3); r.rotation.z = Math.PI * 1.22; add(body, r);
    }
    g.userData.rock = body;
    add(g, body, blob(2.4, 1.4, 0, 0));
    return g;
}

export function mirror() {
    const g = group();
    const tex = canvasTex('mirrortex', 128, 192, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#6a7ea8'); gr.addColorStop(0.5, '#46557c'); gr.addColorStop(1, '#2c3558');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        // five reflections: four kids and one small sheet
        const kid = (x, col) => { c.fillStyle = col; c.fillRect(x - 9, 110, 18, 44); c.fillStyle = '#dcb894'; c.beginPath(); c.arc(x, 98, 11, 0, 7); c.fill(); };
        kid(30, '#2fa7a0'); kid(55, '#f08a3a'); kid(80, '#8f5fd1'); kid(105, '#d9423a');
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(68, 62, 11, Math.PI, 0); c.lineTo(80, 84); c.lineTo(56, 84); c.fill();
        c.fillStyle = '#222'; c.fillRect(63, 60, 3, 5); c.fillRect(70, 60, 3, 5);
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 14; c.beginPath(); c.moveTo(-10, 120); c.lineTo(80, -10); c.stroke();
        c.fillStyle = 'rgba(210,220,235,0.14)'; for (let i = 0; i < 80; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });
    add(g, mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.16, 24), M(0xc29a4a, { rough: 0.4, metal: 0.6 }), 0, 2.1, 0)).rotation.x = Math.PI / 2;
    g.children[0].scale.set(0.82, 1, 1.35);
    const face = plane(1.25, 2.4, new THREE.MeshBasicMaterial({ map: tex }), 0, 2.1, 0.09);
    face.geometry = new THREE.CircleGeometry(1, 28); face.scale.set(0.74, 1.24, 1);
    add(g, face);
    add(g, box(0.1, 0.7, 0.3, WOOD_D, -0.5, 0.35, -0.1), box(0.1, 0.7, 0.3, WOOD_D, 0.5, 0.35, -0.1));
    add(g, blob(1.8, 1.0, 0, 0));
    return g;
}

export function dustDolls() {
    const g = group();
    for (const [x, s] of [[-0.6, 1], [0, 1.25], [0.6, 0.9]]) {
        const d = group(cone(0.38 * s, 0.9 * s, M(0xf1eee6, { rough: 1 }), 0, 0.45 * s, 0, 14), sph(0.22 * s, M(0xf1eee6, { rough: 1 }), 0, 1.0 * s, 0));
        add(d, sph(0.025, M(0x222222), -0.07 * s, 1.02 * s, 0.2 * s, 5, 4), sph(0.025, M(0x222222), 0.07 * s, 1.02 * s, 0.2 * s, 5, 4));
        d.position.x = x; add(g, d);
    }
    add(g, blob(2.0, 1.0, 0, 0));
    return g;
}

export function crates() {
    const g = group();
    add(g, box(1.2, 1.0, 1.0, M(0x8a6a3e), 0, 0.5, 0), box(1.0, 0.8, 0.9, M(0x7a5a30), 0.1, 1.4, 0.05).rotateY(0.3), box(0.9, 0.7, 0.8, M(0x9a7a4a), -0.9, 0.35, 0.2));
    add(g, blob(2.6, 1.6, 0, 0));
    return g;
}

export function rafters() {
    const g = group();
    for (let x = -5; x <= 5; x += 2.5) {
        add(g, box(0.28, 1.2, 0.28, WOOD_D, x, 5.6, -3.8));
        const d = box(0.28, 2.5, 0.28, WOOD_D, x - 0.4, 5.3, -3.7); d.rotation.z = 0.55; add(g, d);
        const e = box(0.28, 2.5, 0.28, WOOD_D, x + 0.4, 5.3, -3.7); e.rotation.z = -0.55; add(g, e);
    }
    add(g, box(12, 0.3, 0.3, WOOD_D, 0, 5.95, -3.7));
    return g;
}

// ------------------------------------------------------------------ ballroom
export function longTable() {
    const g = group();
    add(g, box(4.4, 0.14, 1.5, WOOD_L, 0, 1.3, 0), box(4.5, 0.08, 1.6, M(0xf6f1e4, { rough: 1 }), 0, 1.39, 0));
    for (const s of [-1, 1]) add(g, box(4.5, 0.9, 0.04, M(0xf6f1e4, { rough: 1 }), 0, 0.9, s * 0.78));
    for (const x of [-1.9, 1.9]) add(g, box(0.16, 1.3, 0.16, WOOD, x, 0.65, 0));
    add(g, blob(5.2, 2.6, 0, 0));
    return g;
}

export function cake() {
    const g = group(), flames = [];
    add(g, cyl(0.62, 0.66, 0.14, M(0xe9e2d3, { rough: 0.3, metal: 0.2 }), 0, 0.07, 0, 24), cyl(0.5, 0.52, 0.42, M(0xf6a8c4, { rough: 0.5 }), 0, 0.34, 0, 24), cyl(0.5, 0.5, 0.06, M(0xffffff, { rough: 0.4 }), 0, 0.57, 0, 24), cyl(0.34, 0.36, 0.34, M(0xf8bcd2, { rough: 0.5 }), 0, 0.77, 0, 20), cyl(0.34, 0.34, 0.05, M(0xffffff), 0, 0.95, 0, 20));
    const cols = [0xff6b8b, 0xffb43a, 0x4fd6a0, 0x56b8ff, 0xa57bff, 0xffe066];
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22;
        add(g, cyl(0.025, 0.025, 0.26, M(cols[i]), x, 1.1, z, 6));
        const gl = glowSprite('#ffcf70', 0.5, 0.9); gl.position.set(x, 1.32, z); add(g, gl, sph(0.03, glowMat(0xffd070), x, 1.28, z, 6, 4)); flames.push(gl);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(g, sph(0.05, M(i % 2 ? 0xff6b8b : 0xffffff), Math.cos(a) * 0.5, 0.58, Math.sin(a) * 0.5, 6, 4)); }
    g.userData.flames = flames;
    return g;
}

export function pedestal() {
    const g = group();
    add(g, cyl(0.55, 0.65, 0.2, STONE, 0, 0.1, 0, 14), cyl(0.3, 0.38, 1.4, M(0xcfc9d8, { rough: 0.5 }), 0, 0.9, 0, 14), cyl(0.58, 0.45, 0.18, STONE, 0, 1.69, 0, 14));
    add(g, blob(1.8, 1.8, 0, 0));
    return g;
}

export function easel() {
    const g = group();
    for (const [x, rz] of [[-0.55, 0.14], [0.55, -0.14]]) add(g, box(0.09, 3.2, 0.09, WOOD, x, 1.6, 0)).rotation.z = rz;
    add(g, box(0.09, 3.0, 0.09, WOOD, 0, 1.5, -0.45)).rotation.x = 0.3;
    add(g, box(1.5, 0.08, 0.14, WOOD, 0, 1.2, 0.1), box(1.6, 1.15, 0.05, M(0xf8f1de), 0, 1.9, 0.1));
    const inv = plane(1.4, 1.0, new THREE.MeshBasicMaterial({ map: labelTex('Welcome to the party!', 256, 160, { bg: '#fdf6e0', fg: '#b4376a', pad: 0.06 }) }), 0, 1.9, 0.14);
    inv.visible = false; add(g, inv);
    g.userData.sign = inv;
    add(g, blob(2.0, 1.4, 0, 0));
    return g;
}

/** Streamers and balloons strung across the back wall; hidden until the player hangs them. */
export function banner() {
    const g = group();
    const cols = [0xff6b8b, 0xffb43a, 0x4fd6a0, 0x56b8ff, 0xa57bff];
    for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(-4.2 + t * 8.4, 5.2 - 0.2 * k - Math.sin(t * Math.PI) * (0.7 + k * 0.25), 0.2)); }
        const curve = new THREE.CatmullRomCurve3(pts);
        add(g, mesh(new THREE.TubeGeometry(curve, 24, 0.045, 6, false), M(cols[k * 2 % 5], { rough: 0.8 })));
    }
    for (let i = 0; i < 9; i++) {
        const x = -4 + i * 1.0, y = 3.7 + Math.sin(i * 1.7) * 0.5;
        const b = group(sph(0.34, M(cols[i % 5], { rough: 0.25 }), 0, 0, 0, 14, 10), cone(0.06, 0.1, M(cols[i % 5]), 0, -0.36, 0, 5), cyl(0.008, 0.008, 1.3, M(0xdddddd), 0, -1.0, 0, 3));
        b.children[0].scale.set(1, 1.18, 1); b.children[1].rotation.x = Math.PI;
        b.position.set(x, y, 0.4); b.userData.phase = i; add(g, b);
    }
    g.visible = false;
    return g;
}

export function column({ h = 6 } = {}) {
    const g = group();
    add(g, cyl(0.5, 0.6, 0.3, STONE, 0, 0.15, 0, 16), cyl(0.38, 0.42, h - 0.6, M(0xdcd5e8, { rough: 0.6 }), 0, h / 2, 0, 16), cyl(0.55, 0.4, 0.3, STONE, 0, h - 0.15, 0, 16));
    return g;
}
