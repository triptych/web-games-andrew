// Painted textures and props for the inside of the Silver Comet: cream and
// mint wall panels with rivets and a teal band (grimier aft), diamond-plate
// floors, ceiling panels, crate stencils, a travel poster, a pinned note, the
// dirt pressed against the cockpit glass, and the little CRT screens that
// still work. All drawn on canvases at load.

import * as THREE from 'three';
import { canvas, toTexture } from './textures.js';
import { rng, TAU, fbm2, clamp } from './util.js';

const tex = (c, opts) => toTexture(c, opts);

/** A wall panel, one metre wide and the room's height: rivets, a band at the waist, grime at the foot. */
export function wallTexture({ base = '#d8d2bc', band = '#3a8a86', stripe = '#b8231b', grime = 0.3, seed = 'wall' } = {}) {
    const W = 256, H = 740;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // brushed streaks
    for (let i = 0; i < 300; i++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,50,40'},${r() * 0.05})`;
        g.fillRect(r() * W, r() * H, 1 + r() * 2, 20 + r() * 80);
    }
    // the panel's edges: a raised frame
    g.strokeStyle = 'rgba(60, 54, 44, 0.55)';
    g.lineWidth = 6;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.strokeStyle = 'rgba(255, 255, 250, 0.35)';
    g.lineWidth = 2;
    g.strokeRect(12, 12, W - 24, H - 24);
    // the band round the room at waist height, and a red pinstripe over it
    const by = H * (1 - 1.25 / 2.9), bh = H * (0.32 / 2.9);
    g.fillStyle = band;
    g.fillRect(0, by, W, bh);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, by + bh - 4, W, 4);
    g.fillStyle = stripe;
    g.fillRect(0, by - 10, W, 4);
    // a kick plate at the foot
    g.fillStyle = 'rgba(70, 72, 78, 0.9)';
    g.fillRect(0, H - H * (0.22 / 2.9), W, H * (0.22 / 2.9));
    // rivets
    g.fillStyle = 'rgba(70, 64, 54, 0.7)';
    for (let y = 22; y < H - 20; y += 34) {
        g.beginPath();
        g.arc(18, y, 3, 0, TAU);
        g.arc(W - 18, y, 3, 0, TAU);
        g.fill();
    }
    // grime from the floor, and stains
    const gr = g.createLinearGradient(0, H, 0, H * 0.5);
    gr.addColorStop(0, `rgba(30, 24, 18, ${0.55 * grime})`);
    gr.addColorStop(1, 'rgba(30, 24, 18, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6 * grime; i++) {
        const x = r() * W, y = r() * H * 0.6;
        const st = g.createLinearGradient(0, y, 0, y + 200);
        st.addColorStop(0, `rgba(60, 40, 20, ${0.25 * grime})`);
        st.addColorStop(1, 'rgba(60, 40, 20, 0)');
        g.fillStyle = st;
        g.fillRect(x, y, 4 + r() * 8, 200);
    }
    return tex(c);
}

/** Diamond plate. */
export function floorTexture(tint = '#7a7e86') {
    const n = 256;
    const c = canvas(n);
    const g = c.getContext('2d');
    g.fillStyle = tint;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
        g.fillRect(Math.random() * n, Math.random() * n, 3, 3);
    }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const cx = x * 32 + (y % 2) * 16 + 8, cy = y * 32 + 16;
        g.save();
        g.translate(cx, cy);
        g.rotate(y % 2 ? 0.7 : -0.7);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(-9, -2, 18, 3);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(-9, 1, 18, 2);
        g.restore();
    }
    g.strokeStyle = 'rgba(20, 20, 24, 0.6)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, n, n);
    return tex(c);
}

/** A ceiling panel with a vent grille. */
export function ceilingTexture() {
    const n = 256;
    const c = canvas(n);
    const g = c.getContext('2d');
    g.fillStyle = '#3a3c42';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 6;
    g.strokeRect(3, 3, n - 6, n - 6);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (let k = 0; k < 7; k++) g.fillRect(70, 80 + k * 14, 116, 6);
    g.fillStyle = 'rgba(200,200,210,0.2)';
    for (const [x, y] of [[14, 14], [n - 14, 14], [14, n - 14], [n - 14, n - 14]]) {
        g.beginPath();
        g.arc(x, y, 4, 0, TAU);
        g.fill();
    }
    return tex(c);
}

/** A sign plate on a wall: an arrow and a word, stencilled. */
export function signTexture(text, arrow = '', col = '#f2c84a') {
    const c = canvas(512, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#20262a';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = col;
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = col;
    g.font = 'bold 54px "Trebuchet MS", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(arrow ? `${arrow === '<' ? '◄ ' : ''}${text}${arrow === '>' ? ' ►' : ''}${arrow === 'v' ? ' ▼' : ''}` : text, 256, 66, 470);
    return tex(c);
}

/** A crate's side: a stencil and a number. */
export function crateTexture(label) {
    const c = canvas(256);
    const g = c.getContext('2d');
    g.fillStyle = '#6a7a52';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#4a5638';
    g.lineWidth = 16;
    g.strokeRect(8, 8, 240, 240);
    g.beginPath();
    g.moveTo(8, 8);
    g.lineTo(248, 248);
    g.stroke();
    g.fillStyle = 'rgba(240, 230, 200, 0.85)';
    g.font = 'bold 36px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText(label, 128, 120);
    g.font = 'bold 22px "Courier New", monospace';
    g.fillText('SC-7 · THIS SIDE UP', 128, 160);
    return tex(c);
}

/** A travel poster from the golden age of rocketry. */
export function posterTexture() {
    const c = canvas(256, 360);
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, '#1a2a5a');
    sky.addColorStop(1, '#e88a4a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#e8c070';
    g.beginPath();
    g.arc(150, 130, 62, 0, TAU);
    g.fill();
    g.strokeStyle = '#f4e6c4';
    g.lineWidth = 7;
    g.beginPath();
    g.ellipse(150, 130, 110, 26, -0.25, 0, TAU);
    g.stroke();
    g.fillStyle = '#c8c8d0';
    g.beginPath();
    g.moveTo(60, 300);
    g.lineTo(78, 220);
    g.lineTo(96, 300);
    g.fill();
    g.fillStyle = '#b8231b';
    g.fillRect(64, 290, 28, 18);
    g.fillStyle = '#f4e6c4';
    g.font = 'italic bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('SEE THE RINGS!', 128, 46);
    g.font = '16px Georgia, serif';
    g.fillText('Comet Lines · Weekly Departures', 128, 340);
    return tex(c);
}

/** A note pinned to the wall, in a hurried hand. */
export function noteTexture(lines) {
    const c = canvas(256, 200);
    const g = c.getContext('2d');
    g.fillStyle = '#efe6cc';
    g.fillRect(0, 0, 256, 200);
    g.fillStyle = 'rgba(120, 90, 40, 0.15)';
    g.fillRect(0, 0, 256, 18);
    g.fillStyle = '#c8231b';
    g.beginPath();
    g.arc(128, 12, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#2a2a4a';
    g.font = 'italic 24px "Comic Sans MS", "Segoe Print", cursive';
    lines.forEach((l, i) => g.fillText(l, 18, 58 + i * 34));
    return tex(c);
}

/** Earth pressed against the cockpit glass, with a crack across it. */
export function dirtGlassTexture() {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = fbm2(x * 0.02, y * 0.02, 4) * 0.5 + 0.5, s = fbm2(x * 0.15, y * 0.15, 2) * 0.5 + 0.5;
        const k = (y * n + x) * 4;
        // a little daylight at the top, where the earth has not quite reached
        const lightK = clamp(1 - y / (n * 0.22), 0, 1) * (0.6 + v * 0.4);
        img.data[k] = 60 + v * 40 + s * 20 + lightK * 120;
        img.data[k + 1] = 42 + v * 28 + s * 14 + lightK * 130;
        img.data[k + 2] = 26 + v * 16 + s * 8 + lightK * 110;
        img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // roots and stones
    for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(${120 + Math.random() * 40},${110 + Math.random() * 30},${100},0.7)`;
        g.beginPath();
        g.ellipse(Math.random() * n, n * 0.25 + Math.random() * n * 0.75, 4 + Math.random() * 14, 3 + Math.random() * 9, Math.random() * 3, 0, TAU);
        g.fill();
    }
    g.strokeStyle = 'rgba(30, 20, 10, 0.7)';
    for (let i = 0; i < 8; i++) {
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        let x = Math.random() * n, y = n * 0.2;
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) g.lineTo((x += (Math.random() - 0.5) * 60), (y += 40 + Math.random() * 30));
        g.stroke();
    }
    // the crack
    g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    g.lineWidth = 2;
    const cx = n * 0.62, cy = n * 0.4;
    for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.moveTo(cx, cy);
        let x = cx, y = cy;
        const a = (i / 9) * TAU + Math.random() * 0.4;
        for (let k = 0; k < 5; k++) g.lineTo((x += Math.cos(a + (Math.random() - 0.5) * 0.6) * 30), (y += Math.sin(a + (Math.random() - 0.5) * 0.6) * 30));
        g.stroke();
    }
    g.beginPath();
    g.arc(cx, cy, 18, 0, TAU);
    g.stroke();
    return tex(c);
}

/** Dials and buttons on a console's face. */
export function consoleTexture(seed = 'console', accent = '#3ad8c8') {
    const W = 512, H = 256;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = '#4a5a5e';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a474a';
    g.fillRect(10, 10, W - 20, H - 20);
    for (let i = 0; i < 6; i++) {
        const x = 60 + i * 78, y = 80;
        g.fillStyle = '#f0ead6';
        g.beginPath();
        g.arc(x, y, 30, 0, TAU);
        g.fill();
        g.strokeStyle = '#2a2a2a';
        g.lineWidth = 2;
        for (let k = 0; k <= 8; k++) {
            const a = Math.PI * 0.8 + (k / 8) * Math.PI * 1.4;
            g.beginPath();
            g.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
            g.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28);
            g.stroke();
        }
        const a = Math.PI * 0.8 + r() * Math.PI * 1.4;
        g.strokeStyle = '#c8231b';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24);
        g.stroke();
    }
    const cols = ['#c8231b', '#f2c84a', accent, '#f0ead6', '#3a8a3a'];
    for (let i = 0; i < 14; i++) {
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.fillRect(40 + i * 31, 160, 20, 26);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(40 + i * 31, 182, 20, 4);
    }
    for (let i = 0; i < 6; i++) {
        g.fillStyle = '#1a1a1a';
        g.fillRect(60 + i * 78 - 4, 205, 8, 30);
        g.fillStyle = '#c8c8d0';
        g.beginPath();
        g.arc(60 + i * 78, 210 + r() * 20, 9, 0, TAU);
        g.fill();
    }
    return tex(c);
}

/** A little CRT: redrawn by the caller each time it changes. */
export function crtScreen(w = 320, h = 240) {
    const c = canvas(w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const g = c.getContext('2d');
    const draw = (fn) => {
        g.fillStyle = '#031a12';
        g.fillRect(0, 0, w, h);
        g.save();
        fn(g, w, h);
        g.restore();
        // scanlines and a vignette
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
        const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = v;
        g.fillRect(0, 0, w, h);
        t.needsUpdate = true;
    };
    return { tex: t, draw };
}

/** A wire hanging from the ceiling in a sagging loop, its broken end dangling: returns the geometry and the end. */
export function hangingWire(x, z, len, seed) {
    const r = rng(seed);
    const pts = [];
    const a = r() * TAU, sx = Math.cos(a), sz = Math.sin(a);
    for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push(new THREE.Vector3(x + sx * u * 0.5 + Math.sin(u * 5) * 0.05, 2.9 - u * len, z + sz * u * 0.5));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return { geo: new THREE.TubeGeometry(curve, 20, 0.022, 5, false), end: pts[10].clone() };
}
