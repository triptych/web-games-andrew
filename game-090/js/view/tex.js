// Hand-painted, low-resolution textures made in code and filtered with NEAREST, so every texel
// stays a crisp square: the PS2 look at HD resolution. No image files.

import * as THREE from 'three';
import { hash3 } from '../rng.js';

const cache = new Map();
/** '#rrggbb' or a number → [r, g, b] in 0..255, straight from the hex (no colour-space conversion). */
function rgb(c) {
    const v = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function shade(c, k) {
    const [r, g, b] = rgb(c);
    return `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;
}

function make(key, size, draw, repeat = [1, 1]) {
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    draw(g, size);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = 4;
    cache.set(key, t);
    return t;
}

/** Speckled noise in a colour range: the base of everything. */
function speckle(g, n, base, seed, amt = 0.25) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const k = 1 + (hash3(x, y, seed) - 0.5) * amt * 2;
        g.fillStyle = shade(base, k);
        g.fillRect(x, y, 1, 1);
    }
}

export const TEX = {
    noise: (base, seed = 1, n = 32) => make(`noise${base}${seed}`, n, (g) => speckle(g, n, base, seed, 0.22)),
    bricks: (base, mortar = '#201814', seed = 2) => make(`brick${base}${mortar}${seed}`, 32, (g, n) => {
        g.fillStyle = mortar; g.fillRect(0, 0, n, n);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
            const off = r % 2 ? 8 : 0;
            const k = 0.82 + hash3(r, c, seed) * 0.34;
            g.fillStyle = shade(base, k);
            g.fillRect(((c * 16 + off) % n), r * 8 + 1, 15, 6);
            if (off) g.fillRect(0, r * 8 + 1, 7, 6);
        }
    }),
    tiles: (base, line = '#0a0a10', seed = 3, n = 32) => make(`tiles${base}${line}${seed}`, n, (g) => {
        speckle(g, n, base, seed, 0.12);
        g.fillStyle = line;
        g.fillRect(0, 0, n, 1); g.fillRect(0, 0, 1, n); g.fillRect(n / 2, 0, 1, n); g.fillRect(0, n / 2, n, 1);
    }),
    metal: (base, seed = 4) => make(`metal${base}${seed}`, 32, (g, n) => {
        speckle(g, n, base, seed, 0.1);
        g.fillStyle = shade(base, 0.6);
        for (let y = 4; y < n; y += 8) g.fillRect(0, y, n, 1);
        g.fillStyle = shade(base, 1.35);
        for (let y = 5; y < n; y += 8) g.fillRect(0, y, n, 1);
        g.fillStyle = shade(base, 0.5);
        for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.fillRect(x, y, 2, 2);
    }),
    grass: (base, tip, seed = 5) => make(`grass${base}${tip}${seed}`, 32, (g, n) => {
        speckle(g, n, base, seed, 0.18);
        for (let i = 0; i < 70; i++) {
            const x = (hash3(i, 1, seed) * n) | 0, y = (hash3(i, 2, seed) * n) | 0;
            g.fillStyle = shade(tip, 0.8 + hash3(i, 3, seed) * 0.5);
            g.fillRect(x, y, 1, 2);
        }
    }),
    hex: (base, glowc, seed = 6) => make(`hex${base}${glowc}${seed}`, 64, (g, n) => {
        speckle(g, n, base, seed, 0.08);
        g.strokeStyle = glowc; g.lineWidth = 1; g.globalAlpha = 0.75;
        const r = 9;
        for (let row = -1; row < 5; row++) for (let col = -1; col < 5; col++) {
            const cx = col * r * 1.5 + 4, cy = row * r * 1.732 + (col % 2 ? r * 0.866 : 0) + 4;
            g.beginPath();
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
            g.closePath(); g.stroke();
        }
        g.globalAlpha = 1;
    }),
    wood: (base, seed = 7) => make(`wood${base}${seed}`, 32, (g, n) => {
        speckle(g, n, base, seed, 0.06);
        for (let x = 0; x < n; x += 6) { g.fillStyle = shade(base, 0.7); g.fillRect(x, 0, 1, n); g.fillStyle = shade(base, 1.2); g.fillRect(x + 3, 0, 1, n); }
    }),
    water: (base, hi, seed = 8) => make(`water${base}${hi}${seed}`, 32, (g, n) => {
        speckle(g, n, base, seed, 0.07);
        g.fillStyle = hi; g.globalAlpha = 0.45;
        for (let i = 0; i < 14; i++) g.fillRect((hash3(i, 4, seed) * n) | 0, (hash3(i, 5, seed) * n) | 0, 4 + ((hash3(i, 6, seed) * 5) | 0), 1);
        g.globalAlpha = 1;
    }),
    glass: (base, seed = 9) => make(`glass${base}${seed}`, 32, (g, n) => {
        speckle(g, n, base, seed, 0.05);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 6; i++) g.fillRect(i * 6, 0, 2, n);
    }),
    circuit: (base, trace, seed = 10) => make(`circuit${base}${trace}${seed}`, 64, (g, n) => {
        speckle(g, n, base, seed, 0.07);
        g.strokeStyle = trace; g.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
            let x = (hash3(i, 1, seed) * n) | 0, y = (hash3(i, 2, seed) * n) | 0;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 4; k++) { if (hash3(i, k, seed) > 0.5) x += ((hash3(k, i, 3) * 20) | 0) - 6; else y += ((hash3(k, i, 5) * 20) | 0) - 6; g.lineTo(x, y); }
            g.stroke();
            g.fillStyle = trace; g.fillRect(x - 1, y - 1, 3, 3);
        }
    }),
};

/** A soft round sprite for particles and glows. */
let dot = null;
export function dotTexture() {
    if (dot) return dot;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    dot = new THREE.CanvasTexture(cv);
    dot.colorSpace = THREE.SRGBColorSpace;
    return dot;
}

/** A text label painted to a texture; the text is measured and shrunk to fit. */
export function labelTexture(text, { w = 256, h = 64, color = '#fff', bg = null, font = 'bold 40px system-ui, sans-serif' } = {}) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    let size = 40;
    g.font = font.replace(/\d+px/, size + 'px');
    while (g.measureText(text).width > w - 16 && size > 10) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
