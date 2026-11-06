// Textures drawn in code: wood, stone, thatch, paper, glow sprites, and glyph carvings.

import * as THREE from 'three';
import { drawGlyph } from '../glyphart.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function tex(c, rx = 1, ry = 1, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

const memo = new Map();
const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };

export const planks = (tint = '#7a5634') => once('planks' + tint, () => {
    const [c, x] = canvas(256, 256); const r = rnd(3);
    x.fillStyle = tint; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
        const y = i * 32;
        x.fillStyle = `rgba(${r() * 40 | 0},${r() * 25 | 0},0,${0.12 + r() * 0.15})`; x.fillRect(0, y, 256, 32);
        x.fillStyle = 'rgba(30,18,8,0.55)'; x.fillRect(0, y, 256, 2);
        for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(40,25,10,${r() * 0.18})`; x.fillRect(r() * 256, y + 3 + r() * 27, 30 + r() * 80, 1); }
        const off = r() * 256; x.fillStyle = 'rgba(30,18,8,0.5)'; x.fillRect(off, y, 2, 32);
        x.beginPath(); x.fillStyle = 'rgba(40,24,10,0.5)'; x.ellipse(r() * 256, y + 16, 4, 2.5, 0, 0, 6.3); x.fill();
    }
    return tex(c);
});

export const stone = (base = '#7a756c', mortar = '#4a4640', key = 'a') => once('stone' + base + key, () => {
    const [c, x] = canvas(256, 256); const r = rnd(base.length * 7 + key.charCodeAt(0));
    x.fillStyle = mortar; x.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
        let px = row % 2 ? -16 : 0;
        while (px < 256) {
            const w = 26 + r() * 22;
            const v = 0.82 + r() * 0.3;
            const b = parseInt(base.slice(1), 16);
            x.fillStyle = `rgb(${((b >> 16) & 255) * v | 0},${((b >> 8) & 255) * v | 0},${(b & 255) * v | 0})`;
            x.beginPath(); x.roundRect(px + 1.5, row * 32 + 1.5, w - 3, 29, 4); x.fill();
            for (let k = 0; k < 10; k++) { x.fillStyle = `rgba(0,0,0,${r() * 0.12})`; x.fillRect(px + r() * w, row * 32 + r() * 30, 3, 2); }
            px += w;
        }
    }
    return tex(c);
});

export const thatch = () => once('thatch', () => {
    const [c, x] = canvas(256, 256); const r = rnd(9);
    x.fillStyle = '#9c7d44'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
        const px = r() * 256, py = r() * 256, l = 10 + r() * 24;
        x.strokeStyle = `rgba(${150 + r() * 70 | 0},${115 + r() * 50 | 0},${50 + r() * 30 | 0},0.7)`;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py + l); x.stroke();
    }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(60,40,15,0.35)'; x.fillRect(0, i * 43, 256, 3); }
    return tex(c);
});

export const bark = (tint = '#5b4330') => once('bark' + tint, () => {
    const [c, x] = canvas(64, 128); const r = rnd(5);
    x.fillStyle = tint; x.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(20,12,6,${r() * 0.35})`; x.fillRect(r() * 64, r() * 128, 2, 8 + r() * 20); }
    return tex(c);
});

export const paper = () => once('paper', () => {
    const [c, x] = canvas(128, 160); const r = rnd(11);
    x.fillStyle = '#efe2c2'; x.fillRect(0, 0, 128, 160);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,90,40,${r() * 0.08})`; x.fillRect(r() * 128, r() * 160, 3, 3); }
    x.strokeStyle = 'rgba(60,40,20,0.55)'; x.lineWidth = 1.4;
    for (let y = 22; y < 150; y += 10) { x.beginPath(); x.moveTo(14, y); let px = 14; while (px < 112) { const w = 6 + r() * 16; x.lineTo(px + w, y + (r() - 0.5)); px += w + 4; x.moveTo(px, y); } x.stroke(); }
    return tex(c, 1, 1);
});

/** A soft round glow for sprites and particles. */
export const glow = () => once('glow', () => {
    const [c, x] = canvas(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return tex(c, 1, 1, false);
});

/** A grass or fern tuft with a transparent background. */
export const tuft = (kind) => once('tuft' + kind, () => {
    const [c, x] = canvas(128, 128); const r = rnd(kind.length * 13);
    x.clearRect(0, 0, 128, 128);
    if (kind === 'fern') {
        for (let f = 0; f < 7; f++) {
            const a = -Math.PI / 2 + (f - 3) * 0.32;
            x.strokeStyle = `rgb(${50 + r() * 30 | 0},${100 + r() * 50 | 0},${40 + r() * 20 | 0})`; x.lineWidth = 2;
            const L = 50 + r() * 14;
            x.beginPath(); x.moveTo(64, 126); x.quadraticCurveTo(64 + Math.cos(a) * L * 0.6, 126 + Math.sin(a) * L * 0.5, 64 + Math.cos(a) * L, 126 + Math.sin(a) * L * 1.6); x.stroke();
            for (let k = 0; k < 9; k++) {
                const t = k / 9, px = 64 + Math.cos(a) * L * t, py = 126 + Math.sin(a) * L * 1.6 * t;
                x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 9 * (1 - t), py - 3); x.moveTo(px, py); x.lineTo(px - 9 * (1 - t), py - 3); x.stroke();
            }
        }
    } else if (kind === 'heather') {
        for (let i = 0; i < 26; i++) { const px = 20 + r() * 88; x.strokeStyle = '#5a5034'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(64, 127); x.lineTo(px, 60 + r() * 40); x.stroke(); }
        for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.8 ? `rgb(${150 + r() * 50 | 0},${80 + r() * 30 | 0},${150 + r() * 50 | 0})` : '#e6d4ff'; x.beginPath(); x.arc(20 + r() * 88, 50 + r() * 50, 2.4, 0, 6.3); x.fill(); }
    } else {
        for (let i = 0; i < 34; i++) {
            const bx = 30 + r() * 68, h = 50 + r() * 70, lean = (r() - 0.5) * 40;
            x.strokeStyle = `rgb(${70 + r() * 50 | 0},${120 + r() * 50 | 0},${40 + r() * 25 | 0})`; x.lineWidth = 2 + r() * 2;
            x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.stroke();
        }
        if (kind === 'flowers') for (let i = 0; i < 9; i++) { x.fillStyle = ['#fff6d0', '#ffd34d', '#c9a6ff', '#ff9fbf'][i % 4]; x.beginPath(); x.arc(28 + r() * 72, 30 + r() * 50, 4, 0, 6.3); x.fill(); }
    }
    return tex(c, 1, 1);
});

/** A glyph carved into stone (or painted in light), as a texture. */
export function glyphTex(glyph, { color = '#20160c', bg = null, glow: gl = null, size = 256 } = {}) {
    const [c, x] = canvas(size, size);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); } else x.clearRect(0, 0, size, size);
    drawGlyph(x, glyph, size / 2, size / 2, size * 0.86, { color, glow: gl, width: size * 0.07 });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A magic circle drawn on the ground under a seal. */
export const sigilRing = () => once('sigil', () => {
    const [c, x] = canvas(256, 256);
    x.translate(128, 128); x.strokeStyle = '#fff'; x.fillStyle = '#fff';
    x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 118, 0, 6.3); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 104, 0, 6.3); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 60, 0, 6.3); x.stroke();
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        x.beginPath(); x.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); x.lineTo(Math.cos(a + Math.PI * 2 / 3) * 60, Math.sin(a + Math.PI * 2 / 3) * 60); x.stroke();
        x.beginPath(); x.arc(Math.cos(a) * 111, Math.sin(a) * 111, 6, 0, 6.3); x.fill();
    }
    for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; x.fillRect(Math.cos(a) * 82 - 2, Math.sin(a) * 82 - 6, 4, 12); }
    return tex(c, 1, 1, false);
});

/** A face for a character's head: drawn once per character. */
export function faceTex(kind) {
    return once('face' + kind, () => {
        const [c, x] = canvas(256, 256);
        if (kind === 'nib') {
            x.fillStyle = '#7f9a6a'; x.fillRect(0, 0, 256, 256);
            for (const sx of [86, 170]) {
                x.fillStyle = '#fff3c4'; x.beginPath(); x.ellipse(sx, 118, 30, 34, 0, 0, 6.3); x.fill();
                x.fillStyle = '#e8a920'; x.beginPath(); x.arc(sx + 3, 122, 19, 0, 6.3); x.fill();
                x.fillStyle = '#1a1208'; x.beginPath(); x.ellipse(sx + 4, 123, 7, 11, 0, 0, 6.3); x.fill();
                x.fillStyle = '#fff'; x.beginPath(); x.arc(sx - 4, 112, 6, 0, 6.3); x.fill();
                x.strokeStyle = '#4c6040'; x.lineWidth = 6; x.beginPath(); x.arc(sx, 112, 36, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
            }
            x.fillStyle = '#6b8558'; x.beginPath(); x.ellipse(128, 156, 13, 9, 0, 0, 6.3); x.fill();
            x.strokeStyle = '#2c2418'; x.lineWidth = 5; x.beginPath(); x.arc(128, 172, 30, 0.2, Math.PI - 0.2); x.stroke();
            x.fillStyle = '#fff'; x.fillRect(110, 182, 8, 9); x.fillRect(138, 182, 8, 9);
        } else {
            // Elowen: freckles, grey-green eyes, a small hopeful smile
            x.fillStyle = '#f2c9a8'; x.fillRect(0, 0, 256, 256);
            const g = x.createRadialGradient(128, 150, 20, 128, 140, 140);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(160,90,70,0.25)');
            x.fillStyle = g; x.fillRect(0, 0, 256, 256);
            for (const sx of [94, 162]) {
                x.fillStyle = '#fff'; x.beginPath(); x.ellipse(sx, 124, 17, 11, 0, 0, 6.3); x.fill();
                x.fillStyle = '#5f7f6a'; x.beginPath(); x.arc(sx, 125, 9.5, 0, 6.3); x.fill();
                x.fillStyle = '#1b1612'; x.beginPath(); x.arc(sx, 125, 4.5, 0, 6.3); x.fill();
                x.fillStyle = '#fff'; x.beginPath(); x.arc(sx - 3, 121, 2.5, 0, 6.3); x.fill();
                x.strokeStyle = '#3b2216'; x.lineWidth = 3.5; x.beginPath(); x.ellipse(sx, 124, 18, 12, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
                x.strokeStyle = '#8a4a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx - 18, 98); x.quadraticCurveTo(sx, 90, sx + 17, 99); x.stroke();
            }
            x.fillStyle = 'rgba(230,120,110,0.35)'; for (const sx of [80, 176]) { x.beginPath(); x.ellipse(sx, 156, 18, 10, 0, 0, 6.3); x.fill(); }
            x.fillStyle = 'rgba(150,80,50,0.55)';
            const r = rnd(42);
            for (let i = 0; i < 40; i++) { const a = r() * 6.3, d = r() * 34; x.beginPath(); x.arc(128 + Math.cos(a) * d * 1.5, 148 + Math.sin(a) * d * 0.5, 1.4, 0, 6.3); x.fill(); }
            x.strokeStyle = '#c99a80'; x.lineWidth = 3; x.beginPath(); x.moveTo(126, 128); x.quadraticCurveTo(122, 150, 130, 152); x.stroke();
            x.strokeStyle = '#a5524a'; x.lineWidth = 4; x.beginPath(); x.moveTo(110, 172); x.quadraticCurveTo(128, 182, 146, 170); x.stroke();
        }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
}
