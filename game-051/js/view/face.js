/**
 * face.js — painted anime faces. A face is a transparent canvas texture
 * (eyes, brows, mouth, blush, markings) wrapped on a cap in front of the head.
 * Expressions: normal | hurt | ko | happy | angry | blink.
 */

import * as THREE from 'three';

const cache = new Map();
const SIZE = 256;

function shadeHex(hex, k) {
    const c = new THREE.Color(hex);
    if (k > 0) c.lerp(new THREE.Color('#ffffff'), k); else c.multiplyScalar(1 + k);
    return '#' + c.getHexString();
}

function eye(g, cx, cy, style, color, flip, expr, skin) {
    const L = flip ? -1 : 1;
    g.save();
    g.translate(cx, cy);
    g.scale(flip ? -1.55 : 1.55, 1.55);
    const ink = '#1a1020';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (expr === 'hurt') {
        g.strokeStyle = ink; g.lineWidth = 7;
        g.beginPath(); g.moveTo(-16, -12); g.lineTo(10, 0); g.lineTo(-16, 12); g.stroke();
        g.restore(); return;
    }
    if (expr === 'ko') {
        g.strokeStyle = ink; g.lineWidth = 7;
        g.beginPath(); g.moveTo(-13, -13); g.lineTo(13, 13); g.moveTo(13, -13); g.lineTo(-13, 13); g.stroke();
        g.restore(); return;
    }
    if (expr === 'happy' || style === 8 || expr === 'blink') {
        g.strokeStyle = ink; g.lineWidth = 7;
        g.beginPath();
        if (expr === 'blink' && style !== 8) { g.moveTo(-18, 4); g.quadraticCurveTo(0, 10, 18, 4); }
        else { g.moveTo(-17, 6); g.quadraticCurveTo(0, -14, 17, 6); }
        g.stroke();
        g.restore(); return;
    }
    if (style === 9) {
        // hollow: dark sockets with glowing points
        g.fillStyle = '#140c1c';
        g.beginPath(); g.ellipse(0, 0, 18, 21, 0, 0, Math.PI * 2); g.fill();
        const gr = g.createRadialGradient(0, 2, 1, 0, 2, 12);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 2, 12, 0, Math.PI * 2); g.fill();
        g.restore(); return;
    }
    const shapes = {
        0: { w: 19, h: 24, tilt: 0, iris: 15 },  // bright
        1: { w: 20, h: 17, tilt: -0.18, iris: 12 }, // sharp
        2: { w: 19, h: 22, tilt: 0, iris: 14, lid: 0.45 }, // sleepy
        3: { w: 19, h: 20, tilt: 0, iris: 13 }, // round
        4: { w: 21, h: 17, tilt: -0.28, iris: 11 }, // fierce
        5: { w: 18, h: 20, tilt: 0.1, iris: 12 }, // gentle
        6: { w: 19, h: 22, tilt: -0.12, iris: 14, slit: true }, // cat
        7: { w: 19, h: 24, tilt: 0, iris: 15, star: true }, // starry
    };
    const s = shapes[style] || shapes[0];
    g.rotate(s.tilt);
    // white
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, 0, s.w, s.h, 0, 0, Math.PI * 2); g.fill();
    // iris
    const ig = g.createLinearGradient(0, -s.iris, 0, s.iris);
    ig.addColorStop(0, shadeHex(color, -0.45));
    ig.addColorStop(0.55, color);
    ig.addColorStop(1, shadeHex(color, 0.45));
    g.fillStyle = ig;
    g.beginPath(); g.ellipse(1, 2, s.iris * 0.92, s.iris * 1.18, 0, 0, Math.PI * 2); g.fill();
    // pupil
    g.fillStyle = '#140a18';
    if (s.slit) { g.beginPath(); g.ellipse(1, 2, 3, s.iris, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.ellipse(1, 3, s.iris * 0.42, s.iris * 0.55, 0, 0, Math.PI * 2); g.fill(); }
    // highlights
    g.fillStyle = '#ffffff';
    if (s.star) {
        g.save(); g.translate(-4, -6); g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.6 : 7; const a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.fill(); g.restore();
    } else {
        g.beginPath(); g.ellipse(-5, -7, 5.5, 6.5, -0.3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.85;
    g.beginPath(); g.arc(6, 9, 2.6, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    // lid line
    g.strokeStyle = ink; g.lineWidth = 6;
    g.beginPath(); g.ellipse(0, 0, s.w, s.h, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(0, 0, s.w, s.h, 0, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    // lash flick
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(s.w * 0.85, -s.h * 0.45); g.lineTo(s.w + 6, -s.h * 0.75); g.stroke();
    if (s.lid) {
        g.fillStyle = skin;
        g.beginPath(); g.rect(-s.w - 4, -s.h - 4, s.w * 2 + 8, s.h * 2 * s.lid); g.fill();
        g.strokeStyle = ink; g.lineWidth = 5;
        g.beginPath(); g.moveTo(-s.w, -s.h + s.h * 2 * s.lid); g.lineTo(s.w, -s.h + s.h * 2 * s.lid); g.stroke();
    }
    g.restore();
}

function brow(g, cx, cy, style, color, flip, expr) {
    g.save();
    g.translate(cx, cy);
    if (flip) g.scale(-1, 1);
    g.strokeStyle = color; g.lineCap = 'round';
    g.lineWidth = style === 4 ? 9 : 5.5;
    let ang = [0.08, 0, 0.32, -0.3, 0.05][style] || 0;
    if (expr === 'angry') ang = 0.4;
    if (expr === 'hurt') ang = -0.35;
    g.rotate(ang);
    g.beginPath();
    if (style === 0) { g.moveTo(-15, 2); g.quadraticCurveTo(0, -6, 15, 0); }
    else { g.moveTo(-15, 0); g.lineTo(15, 0); }
    g.stroke();
    g.restore();
}

function mouth(g, cx, cy, style, expr) {
    const ink = '#1a1020';
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    if (expr === 'hurt' || expr === 'ko') {
        g.fillStyle = '#5a1a2a';
        g.beginPath(); g.ellipse(0, 3, 9, expr === 'ko' ? 5 : 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.restore(); return;
    }
    if (expr === 'happy') style = 1;
    if (expr === 'angry') style = 6;
    switch (style) {
        case 0: g.beginPath(); g.moveTo(-11, -2); g.quadraticCurveTo(0, 9, 11, -2); g.stroke(); break;
        case 1:
            g.fillStyle = '#7a1a2a';
            g.beginPath(); g.moveTo(-13, -3); g.quadraticCurveTo(0, 18, 13, -3); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = '#ff8a9a'; g.beginPath(); g.ellipse(0, 7, 6, 3, 0, 0, Math.PI * 2); g.fill();
            break;
        case 2: g.beginPath(); g.moveTo(-7, 1); g.lineTo(7, 1); g.stroke(); break;
        case 3: g.fillStyle = '#7a1a2a'; g.beginPath(); g.ellipse(0, 2, 6, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
        case 4: g.beginPath(); g.moveTo(-9, 2); g.quadraticCurveTo(4, 4, 11, -4); g.stroke(); break;
        case 5:
            g.beginPath(); g.moveTo(-10, -1); g.quadraticCurveTo(0, 7, 10, -1); g.stroke();
            g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(3, 2); g.lineTo(7, 1); g.lineTo(5, 8); g.closePath(); g.fill();
            break;
        case 6: g.beginPath(); g.moveTo(-10, 5); g.quadraticCurveTo(0, -4, 10, 5); g.stroke(); break;
        case 7: g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(-6, 6, 0, 0); g.quadraticCurveTo(6, 6, 12, -2); g.stroke(); break;
        default: break;
    }
    g.restore();
}

function marks(g, style, color, W) {
    g.save();
    g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round';
    const cheeks = [[W * 0.24, 168], [W * 0.76, 168]];
    switch (style) {
        case 1: for (const [x, y] of cheeks) for (let i = 0; i < 5; i++) { g.globalAlpha = 0.7; g.beginPath(); g.arc(x - 10 + (i * 7) % 20, y - 4 + (i * 5) % 9, 2.2, 0, Math.PI * 2); g.fill(); } break;
        case 2: g.lineWidth = 6; for (const [x, y] of cheeks) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(x - 12, y - 8 + i * 10); g.lineTo(x + 12, y - 8 + i * 10); g.stroke(); } break;
        case 3: g.lineWidth = 4; for (const [x, y] of cheeks) { g.beginPath(); g.moveTo(x - 12, y - 10); g.lineTo(x, y); g.lineTo(x + 12, y - 10); g.moveTo(x - 10, y); g.lineTo(x, y + 9); g.lineTo(x + 10, y); g.stroke(); } break;
        case 4: { const [x, y] = cheeks[1]; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 10; const a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); break; }
        case 5: g.lineWidth = 4; for (const [x] of cheeks) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x - 2, 178); g.stroke(); } break;
        case 6: g.lineWidth = 3; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(W / 2 - 12, 60); g.lineTo(W / 2, 48); g.lineTo(W / 2 + 12, 60); g.moveTo(W / 2, 48); g.lineTo(W / 2, 72); g.moveTo(W / 2 - 8, 66); g.lineTo(W / 2 + 8, 66); g.stroke(); break;
        case 7: g.lineWidth = 5; for (const [x, y] of cheeks) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 14 + i * 9, y - 10); g.lineTo(x - 6 + i * 9, y + 8); g.stroke(); } break;
        default: break;
    }
    g.restore();
}

/** look: a hero look (data/looks.js); expr: expression; returns a cached CanvasTexture. */
export function faceTexture(look, expr = 'normal') {
    const key = [look.eyes, look.eyeColor, look.brows, look.mouth, look.blush, look.marks, look.markColor, look.scar, look.hairColor, look.skin, look.beard, expr].join('|');
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const W = SIZE;
    const ey = 128, ex = 66;
    if (look.blush || expr === 'happy') {
        for (const x of [W / 2 - ex - 4, W / 2 + ex + 4]) {
            const gr = g.createRadialGradient(x, 166, 2, x, 166, 22);
            gr.addColorStop(0, 'rgba(255,110,140,0.55)');
            gr.addColorStop(1, 'rgba(255,110,140,0)');
            g.fillStyle = gr;
            g.beginPath(); g.ellipse(x, 166, 24, 14, 0, 0, Math.PI * 2); g.fill();
        }
    }
    if (look.marks) marks(g, look.marks, look.markColor || '#c03030', W);
    if (look.beard === 1) {
        g.fillStyle = 'rgba(40,30,40,0.35)';
        for (let i = 0; i < 60; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 60)); g.beginPath(); g.arc(W / 2 + Math.cos(a) * 52, 150 + Math.sin(a) * 52, 1.6, 0, Math.PI * 2); g.fill(); }
    }
    const browCol = shadeHex(look.hairColor || '#3a2a2a', -0.25);
    const ebrow = expr === 'normal' && look.eyes !== 9;
    const skinC = look.skin || '#e8d0c0';
    eye(g, W / 2 - ex, ey, look.eyes, look.eyeColor, false, expr, skinC);
    eye(g, W / 2 + ex, ey, look.eyes, look.eyeColor, true, expr, skinC);
    if (look.eyes !== 9) {
        brow(g, W / 2 - ex, ey - 50, look.brows, browCol, false, expr);
        brow(g, W / 2 + ex, ey - 50, look.brows, browCol, true, expr);
    }
    if (look.scar === 1) { g.strokeStyle = '#a04050'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 + ex - 10, 160); g.lineTo(W / 2 + ex + 18, 178); g.moveTo(W / 2 + ex - 2, 162); g.lineTo(W / 2 + ex - 8, 174); g.moveTo(W / 2 + ex + 8, 166); g.lineTo(W / 2 + ex + 2, 178); g.stroke(); }
    if (look.scar === 2) { g.strokeStyle = '#a04050'; g.lineWidth = 5; g.beginPath(); g.moveTo(W / 2 - ex - 4, ey - 40); g.lineTo(W / 2 - ex + 8, ey + 40); g.stroke(); }
    mouth(g, W / 2, 202, look.mouth, expr);
    if (!ebrow && expr === 'normal') { /* hollow eyes skip brows */ }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
}

/** Face-cap geometry: the front of a head sphere of radius r. */
const capCache = new Map();
export function faceCap(r) {
    const k = r.toFixed(3);
    if (capCache.has(k)) return capCache.get(k);
    // a narrow cap: the canvas maps onto ~70° × 70° of the head, so features read big (chibi)
    const g = new THREE.SphereGeometry(r * 1.012, 28, 20, Math.PI / 2 - 0.62, 1.24, Math.PI * 0.3, Math.PI * 0.4);
    g.userData.shared = true;
    capCache.set(k, g);
    return g;
}
