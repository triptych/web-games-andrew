/**
 * textures.js — every texture is painted into a canvas at load: the road, the ground detail, surface
 * patches (mud, water, ice, gravel, sand, planks, snow), particle sprites, clouds, glows, banners and
 * the checkered flag. Nothing is downloaded.
 */

import * as THREE from 'three';
import { Rng } from '../rng.js';

const cache = new Map();

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, g: c.getContext('2d') };
}

const hex = (n, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
const mix = (a, b, t) => {
    const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
    const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
    const bl = (a & 255) * (1 - t) + (b & 255) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
export { hex as cssHex, mix as mixHex };

function tex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
}

function speckle(g, w, h, n, cols, rmin, rmax, rng, alpha = 1) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = hex(cols[rng.int(cols.length)], alpha * (0.4 + rng.next() * 0.6));
        const r = rmin + rng.next() * (rmax - rmin);
        g.beginPath();
        g.ellipse(rng.next() * w, rng.next() * h, r, r * (0.6 + rng.next() * 0.5), rng.next() * 3, 0, Math.PI * 2);
        g.fill();
    }
}

/** The road: dirt with two dark wheel ruts, a raised crown, tyre tracks and pebbles. u is across. */
export function roadTexture(look) {
    const key = 'road' + look.road + look.rut + look.edge;
    if (cache.has(key)) return cache.get(key);
    const W = 256, H = 512;
    const { c, g } = canvas(W, H);
    const rng = new Rng(look.road);
    // Across-profile: edge → rut → crown → rut → edge.
    for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const rut = Math.exp(-Math.pow((u - 0.3) / 0.07, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.07, 2));
        const edge = Math.max(0, 1 - Math.min(u, 1 - u) / 0.07);
        let col = mix(look.road, look.rut, rut * 0.6);
        col = mix(col, look.edge, edge * 0.85);
        g.fillStyle = hex(col);
        g.fillRect(x, 0, 1, H);
    }
    speckle(g, W, H, 2400, [mix(look.road, 0x000000, 0.25), mix(look.road, 0xffffff, 0.2), look.rut], 0.5, 2.2, rng, 0.5);
    // Tyre tread prints along the ruts.
    for (const cx of [0.27, 0.33, 0.67, 0.73]) {
        for (let y = 0; y < H; y += 7) {
            g.fillStyle = hex(look.rut, 0.25 + rng.next() * 0.15);
            g.fillRect(cx * W - 5 + rng.next() * 2, y, 10, 3);
        }
    }
    // Pebbles.
    speckle(g, W, H, 160, [mix(look.edge, 0xffffff, 0.3), mix(look.road, 0x000000, 0.4)], 1.5, 3.6, rng, 0.8);
    // Soft blotches so the tiling doesn't show.
    for (let i = 0; i < 40; i++) {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        const col = rng.next() < 0.5 ? mix(look.road, 0x000000, 0.2) : mix(look.road, 0xffffff, 0.15);
        gr.addColorStop(0, hex(col, 0.22)); gr.addColorStop(1, hex(col, 0));
        g.save();
        g.translate(rng.next() * W, rng.next() * H);
        g.scale(20 + rng.next() * 50, 20 + rng.next() * 60);
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    const t = tex(c, { repeat: true, aniso: 8 });
    cache.set(key, t);
    return t;
}

/** Grey detail noise multiplied over the terrain's vertex colours. */
export function detailTexture() {
    if (cache.has('detail')) return cache.get('detail');
    const W = 256;
    const { c, g } = canvas(W, W);
    const img = g.createImageData(W, W);
    const rng = new Rng(77);
    const base = new Float32Array(W * W);
    for (let i = 0; i < W * W; i++) base[i] = rng.next();
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        // Two scales of tileable noise: a box blur of white noise plus fine grain.
        let s = 0;
        for (let k = -2; k <= 2; k++) s += base[((y + k + W) % W) * W + x] + base[y * W + ((x + k + W) % W)];
        const v = 0.8 + (s / 10 - 0.5) * 0.35 + (base[y * W + x] - 0.5) * 0.12;
        const o = (y * W + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.max(0, Math.min(255, v * 255));
        img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = tex(c, { repeat: true, srgb: false, aniso: 8 });
    cache.set('detail', t);
    return t;
}

/** A surface patch with soft edges all round. */
export function patchTexture(type) {
    const key = 'patch' + type;
    if (cache.has(key)) return cache.get(key);
    const W = 128, H = 256;
    const { c, g } = canvas(W, H);
    const rng = new Rng(type.length * 997);
    const C = {
        mud: [0x3a2616, 0x25180c, 0x4e3420], water: [0x5f7f7a, 0x3e5e5c, 0x86a6a0], ice: [0xd8eefc, 0xb6d6ee, 0xf2fbff],
        gravel: [0x8a8478, 0x6e685e, 0xaaa496], sand: [0xe2c08a, 0xcda46c, 0xf0d6a4], plank: [0x8a6038, 0x6e4a2a, 0xa07448],
        snow: [0xf6f9fc, 0xe2eaf2, 0xffffff], oil: [0x0c0c10, 0x18181e, 0x2a2a34],
    }[type] || [0x808080, 0x606060, 0xa0a0a0];
    g.fillStyle = hex(C[0]);
    g.fillRect(0, 0, W, H);
    if (type === 'plank') {
        for (let y = 0; y < H; y += 16) {
            g.fillStyle = hex(rng.next() < 0.5 ? C[1] : C[2], 0.7);
            g.fillRect(0, y, W, 14);
            g.fillStyle = hex(0x2a1a0a, 0.8);
            g.fillRect(0, y + 14, W, 2);
            for (const nx of [8, W - 10]) { g.fillStyle = '#3a3a3a'; g.fillRect(nx, y + 5, 3, 3); }
        }
    } else if (type === 'ice') {
        speckle(g, W, H, 60, [C[1], C[2]], 6, 22, rng, 0.5);
        g.strokeStyle = hex(0xffffff, 0.6);
        for (let i = 0; i < 26; i++) {
            g.lineWidth = 0.6 + rng.next();
            g.beginPath();
            let x = rng.next() * W, y = rng.next() * H;
            g.moveTo(x, y);
            for (let k = 0; k < 4; k++) { x += (rng.next() - 0.5) * 40; y += (rng.next() - 0.5) * 40; g.lineTo(x, y); }
            g.stroke();
        }
    } else if (type === 'oil') {
        // A black slick with a rainbow sheen.
        for (let i = 0; i < 26; i++) {
            const x = rng.next() * W, y = rng.next() * H, r = 10 + rng.next() * 26;
            const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r);
            gr.addColorStop(0, 'rgba(0,0,0,0)');
            gr.addColorStop(0.55, `hsla(${Math.floor(rng.next() * 360)},90%,60%,0.35)`);
            gr.addColorStop(0.75, `hsla(${Math.floor(rng.next() * 360)},90%,55%,0.3)`);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(x - r, y - r, r * 2, r * 2);
        }
    } else if (type === 'water') {
        speckle(g, W, H, 80, [C[1], C[2]], 4, 14, rng, 0.45);
        g.strokeStyle = hex(0xffffff, 0.35);
        for (let i = 0; i < 30; i++) { g.lineWidth = 1; g.beginPath(); g.ellipse(rng.next() * W, rng.next() * H, 6 + rng.next() * 14, 3 + rng.next() * 5, 0, 0, Math.PI * 2); g.stroke(); }
    } else {
        speckle(g, W, H, type === 'gravel' ? 1800 : 600, [C[1], C[2]], 0.8, type === 'gravel' ? 2.6 : 5, rng, 0.8);
    }
    // Soft edge mask.
    const img = g.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = x / (W - 1), v = y / (H - 1);
        const eu = Math.min(1, Math.min(u, 1 - u) / 0.22), ev = Math.min(1, Math.min(v, 1 - v) / 0.18);
        const n = 0.85 + 0.15 * Math.sin(x * 0.3 + y * 0.17) * Math.sin(y * 0.11);
        img.data[(y * W + x) * 4 + 3] = Math.max(0, Math.min(255, eu * ev * n * 255 * (type === 'water' ? 0.85 : 1)));
    }
    g.putImageData(img, 0, 0);
    const t = tex(c);
    cache.set(key, t);
    return t;
}

/** Soft round sprite for dust, smoke, spray and glows. */
export function softDot() {
    if (cache.has('dot')) return cache.get('dot');
    const { c, g } = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = tex(c, { srgb: false });
    cache.set('dot', t);
    return t;
}

export function cloudTexture() {
    if (cache.has('cloud')) return cache.get('cloud');
    const { c, g } = canvas(256, 128);
    const rng = new Rng(5);
    for (let i = 0; i < 26; i++) {
        const x = 40 + rng.next() * 176, y = 50 + rng.next() * 40 - Math.abs(x - 128) * 0.12, r = 18 + rng.next() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.75)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = tex(c);
    cache.set('cloud', t);
    return t;
}

export function checkerTexture(n = 8) {
    const key = 'checker' + n;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(256, 64);
    const s = 256 / n / 2;
    for (let y = 0; y < 64 / s; y++) for (let x = 0; x < 256 / s; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
        g.fillRect(x * s, y * s, s, s);
    }
    const t = tex(c, { repeat: true });
    cache.set(key, t);
    return t;
}

/** A painted banner with text, for gantries, billboards and grandstands. */
export function bannerTexture(text, bg = 0x1a1a1a, fg = 0xffd23a, w = 512, h = 128, sub = '') {
    const key = `banner|${text}|${bg}|${fg}|${w}|${h}|${sub}`;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(w, h);
    g.fillStyle = hex(bg);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = hex(fg);
    g.lineWidth = h * 0.05;
    g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    g.fillStyle = hex(fg);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = sub ? h * 0.42 : h * 0.55;
    g.font = `900 ${fs}px "Bungee", "Arial Black", Impact, sans-serif`;
    let tw = g.measureText(text).width;
    const maxW = w * 0.88;
    if (tw > maxW) g.font = `900 ${fs * maxW / tw}px "Bungee", "Arial Black", Impact, sans-serif`;
    g.fillText(text, w / 2, sub ? h * 0.4 : h * 0.54);
    if (sub) {
        g.font = `700 ${h * 0.2}px "Rubik", Arial, sans-serif`;
        g.fillText(sub, w / 2, h * 0.76);
    }
    const t = tex(c);
    cache.set(key, t);
    return t;
}

/** Barrier tyre: black rubber with a painted band. */
export function tireTexture(band = 0xffffff) {
    const key = 'tire' + band;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(64, 64);
    g.fillStyle = '#1b1b1d';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = hex(band);
    g.fillRect(0, 26, 64, 12);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < 64; x += 6) g.fillRect(x, 0, 2, 64);
    const t = tex(c, { repeat: true });
    cache.set(key, t);
    return t;
}

/** Car tyre tread (on the cylinder's side). */
export function treadTexture(knobby) {
    const key = 'tread' + knobby;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(128, 32);
    g.fillStyle = '#202022';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#121214';
    const step = knobby ? 8 : 6;
    for (let x = 0; x < 128; x += step) {
        if (knobby) { g.fillRect(x, 2, 4, 12); g.fillRect(x + 3, 18, 4, 12); }
        else g.fillRect(x, 4, 2, 24);
    }
    const t = tex(c, { repeat: true });
    cache.set(key, t);
    return t;
}
