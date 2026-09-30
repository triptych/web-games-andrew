/**
 * textures.js — canvas helpers: value noise, fbm, normal maps from heightmaps,
 * and CanvasTexture wrappers with the right colour space.
 */

import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

export let maxAniso = 4;
export function setMaxAniso(n) { maxAniso = n; }

export function colorTex(cv, { repeat = null, mips = true } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.generateMipmaps = mips;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
}
export function dataTex(cv, { repeat = null } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
}

// ------------------------------------------------------------------ noise

export function makeNoise(seed) {
    const rng = makeRng(seed);
    const P = 256;
    const perm = new Uint8Array(P * 2);
    const vals = new Float32Array(P);
    for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rng.next(); }
    for (let i = P - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < P; i++) perm[P + i] = perm[i];
    const v = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
    const s = (t) => t * t * (3 - 2 * t);
    function n2(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = s(x - xi), yf = s(y - yi);
        const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
        return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    }
    function fbm(x, y, oct = 5) {
        let sum = 0, amp = 0.5, f = 1, norm = 0;
        for (let i = 0; i < oct; i++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
        return sum / norm;
    }
    /** tileable fbm over period p (integer lattice units) */
    function tfbm(x, y, p, oct = 5) {
        let sum = 0, amp = 0.5, f = 1, norm = 0;
        for (let i = 0; i < oct; i++) {
            const per = p * f;
            const X = x * f, Y = y * f;
            const xi = Math.floor(X), yi = Math.floor(Y);
            const xf = s(X - xi), yf = s(Y - yi);
            const m = (q) => ((q % per) + per) % per;
            const a = v(m(xi), m(yi)), b = v(m(xi + 1), m(yi)), c = v(m(xi), m(yi + 1)), d = v(m(xi + 1), m(yi + 1));
            sum += (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) * amp;
            norm += amp; amp *= 0.5; f *= 2;
        }
        return sum / norm;
    }
    return { n2, fbm, tfbm };
}

// ------------------------------------------------------------------ normal maps

/** Sobel normal map from the luminance of a height canvas. */
export function normalFromHeight(hc, strength = 2.5) {
    const w = hc.width, h = hc.height;
    const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const octx = out.getContext('2d');
    const img = octx.createImageData(w, h);
    const d = img.data;
    const H = (x, y) => {
        x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y));
        return src[(y * w + x) * 4] / 255;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
            const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
            let nx = -dx * strength, ny = dy * strength, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            nx /= l; ny /= l; nz /= l;
            const i = (y * w + x) * 4;
            d[i] = (nx * 0.5 + 0.5) * 255;
            d[i + 1] = (ny * 0.5 + 0.5) * 255;
            d[i + 2] = (nz * 0.5 + 0.5) * 255;
            d[i + 3] = 255;
        }
    }
    octx.putImageData(img, 0, 0);
    return out;
}

// ------------------------------------------------------------------ colour helpers

export function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
export function mixHex(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export function rgba(c, a) { return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`; }

/** Soft radial gradient sprite (for particles, glows, blob shadows). */
export function radialTex(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', stop = 0) {
    const c = canvas(size, size);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, size * 0.5 * stop, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function roundRectPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}
