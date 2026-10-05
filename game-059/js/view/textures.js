/**
 * textures.js — procedural pixel-art textures for the stages, drawn texel by
 * texel with the same Pix buffer the sprites use, then uploaded with nearest
 * filtering. Every texture is seeded, so a stage looks the same every visit.
 */

import * as THREE from 'three';
import { Pix } from '../art/objects.js';

// ---------------------------------------------------------------- utils
export function rng(seed) {
    let a = seed >>> 0 || 1;
    const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
    r.pick = (a2) => a2[Math.floor(r() * a2.length)];
    return r;
}

const cache = new Map();
export function toTexture(pix, { repeat = false, key } = {}) {
    if (key && cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = pix.w; c.height = pix.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(pix.w, pix.h);
    img.data.set(pix.d);
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
    t.colorSpace = THREE.NoColorSpace;
    if (key) cache.set(key, t);
    return t;
}

export function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
    return '#' + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// 3x5 pixel font for signs
const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110',
    '-': '000000111000000', ' ': '000000000000000', '!': '010010010000010', '.': '000000000000010', '/': '001001010100100', '&': '010101010101011',
};
export function text(p, str, x, y, c, scale = 1) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
        const g = FONT[ch] || FONT[' '];
        for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') p.rect(cx + i * scale, y + j * scale, scale, scale, c);
        cx += 4 * scale;
    }
    return cx - x;
}
export const textW = (str, scale = 1) => str.length * 4 * scale - scale;

/** A pseudo-kanji glyph: random strokes on a 7x7 grid. */
export function glyph(p, x, y, c, r, s = 7) {
    const h = Math.floor(s / 2);
    p.hline(x + 1, x + s - 2, y + r.int(0, 1), c);
    if (r() < 0.7) p.vline(x + h, y, y + s - 1, c);
    if (r() < 0.6) p.hline(x, x + s - 1, y + h, c);
    if (r() < 0.5) p.vline(x + r.int(0, 1), y + 2, y + s - 1, c);
    if (r() < 0.5) p.vline(x + s - 1 - r.int(0, 1), y + 1, y + s - 2, c);
    if (r() < 0.6) p.hline(x + 1, x + s - 2, y + s - 1, c);
    if (r() < 0.4) p.line(x + h, y + h, x, y + s - 1, c);
    if (r() < 0.4) p.line(x + h, y + h, x + s - 1, y + s - 1, c);
    if (r() < 0.3) p.rect(x + h - 1, y + 2, 3, 2, c);
}

/** Neon tube text/glyph block: bright core + coloured halo texels. */
function neonGlyphs(p, x, y, n, color, r, vertical = false) {
    const core = mix(color, '#ffffff', 0.55);
    for (let k = 0; k < n; k++) {
        const gx = vertical ? x : x + k * 9, gy = vertical ? y + k * 9 : y;
        glyph(p, gx, gy, color, rng(r.int(1, 1e6)));
        glyph(p, gx, gy, core, rng(r.int(1, 1e6)));
    }
}

// ---------------------------------------------------------------- sky & skyline
export function skyTex({ top, mid, bottom, stars = 0, seed = 1, moon = null, clouds = null }) {
    const p = new Pix(64, 256), r = rng(seed);
    for (let y = 0; y < 256; y++) {
        const t = y / 255;
        const c = t < 0.6 ? mix(top, mid, t / 0.6) : mix(mid, bottom, (t - 0.6) / 0.4);
        const c2 = t < 0.6 ? mix(top, mid, Math.min(1, t / 0.6 + 0.06)) : mix(mid, bottom, Math.min(1, (t - 0.6) / 0.4 + 0.08));
        for (let x = 0; x < 64; x++) p.set(x, y, ((x + y) & 1) && (y % 8 < 4) ? c2 : c);
    }
    for (let k = 0; k < stars; k++) { const y = r.int(0, 150); p.set(r.int(0, 63), y, r() < 0.2 ? '#ffffff' : mix(top, '#ffffff', 0.5)); }
    return p;
}

export function skylineTex({ seed = 1, w = 512, h = 256, body = '#120a24', edge = '#2a1a4a', win = ['#ffd27a', '#7af4ff', '#ff6ad0'], density = 0.25, minH = 60, maxH = 240, neon = 0.3, spire = false }) {
    const p = new Pix(w, h), r = rng(seed);
    let x = 0;
    while (x < w) {
        const bw = r.int(18, 46), bh = r.int(minH, maxH);
        const top = h - bh;
        p.rect(x, top, bw, bh, body);
        p.vline(x, top, h - 1, edge);
        // roof details
        if (r() < 0.4) { p.rect(x + r.int(2, bw - 6), top - r.int(4, 10), r.int(2, 4), 12, body); }
        if (r() < 0.3) { const ax = x + (bw >> 1); p.vline(ax, top - r.int(10, 30), top, edge); p.set(ax, top - 30, '#ff3a3a'); }
        if (r() < 0.25) { p.poly([[x, top], [x + (bw >> 1), top - r.int(8, 20)], [x + bw, top]], body); }
        // windows
        const wc = r.pick(win);
        for (let wy = top + 4; wy < h - 2; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (r() < density) p.set(wx, wy, r() < 0.85 ? wc : r.pick(win));
        // neon band
        if (r() < neon) { const ny = top + r.int(6, 20); const nc = r.pick(['#ff3fa4', '#3af4ff', '#ffd23a', '#9a6aff']); p.hline(x + 2, x + bw - 3, ny, nc); p.hline(x + 2, x + bw - 3, ny + 1, shade(nc, 0.6)); }
        x += bw + r.int(0, 3);
    }
    if (spire) {
        // the Aurex Spire: always on the horizon
        const sx = Math.floor(w * 0.62), sw = 26;
        p.poly([[sx, h], [sx + 4, 30], [sx + sw / 2, 4], [sx + sw - 4, 30], [sx + sw, h]], '#0a0614');
        for (let y = 36; y < h; y += 3) p.hline(sx + 7, sx + sw - 8, y, (y % 12 === 0) ? '#ff2d55' : '#2a1a3a');
        p.vline(sx + sw / 2, 0, 4, '#ff2d55'); p.set(sx + sw / 2, 0, '#ffffff');
        p.rect(sx + 6, 60, sw - 12, 3, '#ff2d55');
    }
    return p;
}

export function towerTex({ seed = 1, w = 64, h = 256, body = '#1a1430', win = ['#ffd27a', '#7af4ff'], density = 0.4, sign = null }) {
    const p = new Pix(w, h), r = rng(seed);
    p.rect(0, 0, w, h, body);
    const wc = r.pick(win);
    for (let y = 4; y < h - 4; y += 6) {
        for (let x = 3; x < w - 3; x += 5) {
            const lit = r() < density;
            p.rect(x, y, 3, 3, lit ? wc : shade(body, 1.4));
            if (lit && r() < 0.2) p.set(x, y, '#ffffff');
        }
        if (r() < 0.08) p.hline(0, w - 1, y + 4, shade(body, 0.7));
    }
    p.vline(0, 0, h - 1, shade(body, 1.6));
    if (sign) { const sy = r.int(10, 60); p.rect(4, sy, w - 8, 14, '#0a0a12'); neonGlyphs(p, 6, sy + 3, Math.floor((w - 12) / 9), sign, r); }
    return p;
}

// ---------------------------------------------------------------- street pieces
const SHOP_WORDS = ['RAMEN', 'BAR', 'HOTEL', 'CLINIC', 'NOODLE', 'PACHINKO', 'ARCADE', 'SUSHI', 'CYBER', 'TATTOO', 'KARAOKE', 'REPAIR', 'MODS', 'DRUGS', 'LIVE', 'OPEN 24', 'BAO', 'GAMES', 'VR DEN', 'IMPLANT'];
export function storefront({ seed = 1, wall = '#2a2238', neon = ['#ff3fa4', '#3af4ff', '#ffd23a'], w = 128, h = 128, kind = 'shop' }) {
    const p = new Pix(w, h), r = rng(seed);
    const wl = wall, wd = shade(wall, 0.7), wlt = shade(wall, 1.3);
    p.rect(0, 0, w, h, wl);
    // brick / panel texture
    for (let y = 0; y < h; y += 6) { p.hline(0, w - 1, y, wd); for (let x = (y / 6) % 2 ? 0 : 6; x < w; x += 12) p.vline(x, y, y + 5, wd); }
    for (let x = 0; x < w; x += 23) if (r() < 0.5) p.vline(x, 0, h - 1, shade(wall, 0.85));
    const nc = r.pick(neon);
    const base = h - 2;
    if (kind === 'shop') {
        // sign band
        const sy = h - 92;
        p.rect(6, sy, w - 12, 16, '#0c0a14'); p.rect(6, sy, w - 12, 1, wlt);
        const word = r.pick(SHOP_WORDS);
        const sc = textW(word, 2) < w - 30 ? 2 : 1;
        const tw = textW(word, sc);
        const tx = Math.floor((w - tw) / 2);
        text(p, word, tx + 1, sy + 4, shade(nc, 0.5), sc); text(p, word, tx, sy + 3, nc, sc);
        if (sc === 1) neonGlyphs(p, 10, sy + 5, 2, r.pick(neon), r);
        // window & door
        const lit = r() < 0.8;
        const glass = lit ? r.pick(['#ffe0a0', '#a0f0ff', '#ffb0e0', '#c0ffb0']) : '#1a2030';
        p.rect(8, base - 64, 70, 54, '#0a0810'); p.rect(10, base - 62, 66, 50, glass);
        if (lit) { for (let k = 0; k < 4; k++) p.rect(14 + k * 16, base - 30, 10, 18, shade(glass, 0.7)); p.rect(12, base - 60, 62, 3, mix(glass, '#ffffff', 0.5)); }
        p.vline(43, base - 62, base - 13, '#0a0810');
        p.rect(86, base - 70, 32, 68, '#100c18'); p.rect(88, base - 68, 28, 66, lit ? shade(glass, 0.5) : '#181420'); p.rect(108, base - 38, 3, 3, '#c0c8d0');
        // awning
        if (r() < 0.6) { const ac = r.pick(['#a02a3a', '#2a5a8a', '#3a7a3a', '#8a6a2a']); for (let x = 4; x < 82; x += 6) { p.rect(x, base - 74, 6, 8, (x / 6) % 2 ? ac : shade(ac, 1.5)); } p.hline(4, 81, base - 66, shade(ac, 0.6)); }
        p.rect(0, base - 8, w, 10, shade(wall, 0.55));
    } else if (kind === 'shutter') {
        p.rect(10, base - 76, w - 20, 74, '#4a4e5a');
        for (let y = base - 76; y < base; y += 4) { p.hline(10, w - 11, y, '#2a2e38'); p.hline(10, w - 11, y + 1, '#6a7080'); }
        // graffiti tag
        const gc = r.pick(neon);
        const gx = r.int(18, 50), gy = base - r.int(30, 60);
        text(p, r.pick(['KINGS', 'RUST', 'NO GODS', 'FREE MIKA', 'AUREX LIES', 'GLITCH']), gx, gy, gc, 2);
        p.rect(0, base - 8, w, 10, shade(wall, 0.55));
        p.rect(14, base - 84, w - 28, 6, '#0c0a14'); text(p, r.pick(['STORAGE', 'GARAGE', 'NO PARKING', 'DOCK 4']), 18, base - 83, shade(nc, 0.9));
    } else if (kind === 'alley') {
        // fire escape + door + pipes
        p.rect(30, base - 56, 26, 54, '#18121e'); p.rect(32, base - 54, 22, 52, '#2a2232'); p.rect(50, base - 30, 2, 3, '#8a8a8a');
        p.rect(31, base - 62, 24, 5, nc); p.rect(33, base - 61, 20, 3, mix(nc, '#ffffff', 0.5));
        p.vline(12, 0, base, '#5a5a66'); p.vline(13, 0, base, '#3a3a44'); p.vline(96, 0, base, '#5a5a66');
        for (let y = 10; y < base; y += 22) p.rect(10, y, 6, 3, '#6a6a76');
        p.rect(70, base - 100, 50, 3, '#3a3440'); for (let x = 70; x < 120; x += 5) p.vline(x, base - 100, base - 86, '#3a3440'); p.rect(70, base - 86, 50, 2, '#3a3440');
        if (r() < 0.6) { const gc = r.pick(neon); text(p, r.pick(['RUST', 'KINGS', '2089', 'RUN']), 64, base - 40, gc, 2); }
        p.rect(0, base - 6, w, 8, shade(wall, 0.5));
    }
    // AC unit & cables
    if (r() < 0.5) { const ax = r.int(10, w - 30); p.rect(ax, 4, 20, 14, '#8a8e9a'); p.rect(ax + 2, 6, 16, 10, '#5a5e6a'); for (let k = 0; k < 4; k++) p.hline(ax + 3, ax + 16, 7 + k * 2, '#3a3e48'); }
    // posters
    if (r() < 0.5) { const px = r.int(4, w - 20), py = r.int(10, 30); const pc = r.pick(neon); p.rect(px, py, 14, 20, '#e8e0d0'); p.rect(px + 2, py + 2, 10, 10, pc); p.hline(px + 2, px + 11, py + 15, '#2a2a2a'); p.hline(px + 2, px + 9, py + 17, '#2a2a2a'); }
    return p;
}

export function verticalSign({ seed = 1, color = '#ff3fa4', n = 4 }) {
    const p = new Pix(16, 12 + n * 9), r = rng(seed);
    p.rect(0, 0, 16, p.h, '#0c0a14'); p.rect(0, 0, 16, 1, '#3a3448'); p.rect(0, p.h - 1, 16, 1, '#3a3448');
    p.vline(0, 0, p.h - 1, color); p.vline(15, 0, p.h - 1, color);
    neonGlyphs(p, 4, 6, n, color, r, true);
    return p;
}

export function hSign({ word = 'AUREX', color = '#ff2d55', bg = '#0c0a14', scale = 2 }) {
    const tw = textW(word, scale);
    const p = new Pix(tw + 8, 5 * scale + 8);
    p.rect(0, 0, p.w, p.h, bg); p.rect(0, 0, p.w, 1, color); p.rect(0, p.h - 1, p.w, 1, color);
    text(p, word, 5, 5, shade(color, 0.45), scale); text(p, word, 4, 4, color, scale);
    return p;
}

// ---------------------------------------------------------------- floors
export function floorTex(kind, seed = 1) {
    const p = new Pix(128, 128), r = rng(seed);
    const fill = (c) => p.rect(0, 0, 128, 128, c);
    const noise = (c, n) => { for (let k = 0; k < n; k++) p.set(r.int(0, 127), r.int(0, 127), c); };
    switch (kind) {
        case 'street': {
            // back: sidewalk tiles (rows 0..44), curb, road with lane marks
            p.rect(0, 0, 128, 46, '#3a3448');
            for (let y = 0; y < 46; y += 11) p.hline(0, 127, y, '#2a2436');
            for (let x = 0; x < 128; x += 16) p.vline(x, 0, 45, '#2a2436');
            p.rect(0, 46, 128, 4, '#6a6478'); p.rect(0, 50, 128, 2, '#1a1622');
            p.rect(0, 52, 128, 76, '#1e1a28'); noise('#262232', 400); noise('#16121e', 300);
            for (let x = 0; x < 128; x += 32) p.rect(x, 94, 18, 3, '#c8b860');
            // neon reflections in puddles
            for (let k = 0; k < 5; k++) { const px = r.int(0, 110), py = r.int(56, 122), pw = r.int(10, 22); const c = r.pick(['#5a2a6a', '#2a4a6a', '#6a2a4a']); p.rect(px, py, pw, 3, c); p.hline(px + 2, px + pw - 3, py + 1, shade(c, 1.6)); }
            break;
        }
        case 'alley': {
            fill('#24202c'); noise('#2c2836', 600); noise('#18141e', 400);
            for (let y = 0; y < 128; y += 32) p.hline(0, 127, y, '#18141e');
            p.rect(56, 0, 16, 128, '#1c1822'); p.vline(63, 0, 127, '#3a3446');
            for (let k = 0; k < 4; k++) { const px = r.int(0, 110), py = r.int(0, 120); p.rect(px, py, r.int(8, 18), 3, '#3a2a5a'); }
            break;
        }
        case 'garage': {
            fill('#3a3a40'); noise('#44444c', 500); noise('#2c2c32', 500);
            for (let k = 0; k < 3; k++) p.ellipse(r.int(10, 118), r.int(10, 118), r.int(6, 12), r.int(3, 5), '#202024');
            for (let x = 0; x < 128; x += 64) for (let y = 0; y < 8; y++) for (let i = 0; i < 64; i += 8) p.rect(x + i + ((y >> 2) % 2) * 4, 120 + (y % 4), 4, 1, (y >> 2) % 2 ? '#e0b020' : '#1a1a1a');
            break;
        }
        case 'car': {
            fill('#4a4e5a'); for (let y = 0; y < 128; y += 4) p.hline(0, 127, y, '#3e424c');
            p.rect(0, 0, 128, 10, '#2a2e38'); p.rect(0, 116, 128, 12, '#2a2e38'); p.rect(0, 112, 128, 3, '#e0b020');
            for (let x = 0; x < 128; x += 8) p.rect(x, 113, 4, 1, '#1a1a1a');
            break;
        }
        case 'roof': {
            fill('#6a707e'); for (let x = 0; x < 128; x += 16) { p.vline(x, 0, 127, '#4a505c'); p.vline(x + 1, 0, 127, '#8a90a0'); }
            for (let y = 0; y < 128; y += 32) for (let x = 4; x < 128; x += 16) p.set(x, y + 8, '#2a2e38');
            p.rect(0, 0, 128, 6, '#3a3e48'); p.rect(0, 122, 128, 6, '#3a3e48');
            break;
        }
        case 'market': {
            fill('#3a2e2a'); for (let y = 0; y < 128; y += 8) for (let x = ((y / 8) % 2) * 6; x < 128; x += 12) { p.rect(x, y, 11, 7, r() < 0.5 ? '#4a3a32' : '#42342e'); p.set(x, y, '#5a4a40'); }
            for (let k = 0; k < 6; k++) { const px = r.int(0, 110), py = r.int(0, 120); p.rect(px, py, r.int(8, 18), 2, r.pick(['#8a3a2a', '#8a6a2a'])); }
            break;
        }
        case 'rooftop': {
            fill('#2e2a36'); for (let y = 0; y < 128; y += 16) p.hline(0, 127, y, '#22202a'); for (let x = 0; x < 128; x += 32) p.vline(x, 0, 127, '#22202a');
            noise('#3a3644', 300); p.rect(0, 120, 128, 8, '#4a4458'); p.hline(0, 127, 120, '#6a6478');
            break;
        }
        case 'docks': {
            fill('#5a5a5e'); noise('#666670', 700); noise('#4a4a50', 600);
            for (let x = 0; x < 128; x += 64) p.vline(x, 0, 127, '#3a3a40');
            p.rect(0, 70, 128, 3, '#e0c020'); for (let x = 0; x < 128; x += 16) p.rect(x, 70, 8, 3, '#2a2a2a');
            for (let k = 0; k < 3; k++) p.ellipse(r.int(10, 118), r.int(10, 118), r.int(5, 10), r.int(2, 4), '#3e3e44');
            break;
        }
        case 'warehouse': {
            fill('#4a4a52'); for (let y = 0; y < 128; y += 32) p.hline(0, 127, y, '#3a3a42'); for (let x = 0; x < 128; x += 32) p.vline(x, 0, 127, '#3a3a42');
            noise('#56565e', 400); p.rect(0, 60, 128, 2, '#e0c020');
            break;
        }
        case 'lab': {
            fill('#7c8894'); for (let y = 0; y < 128; y += 16) p.hline(0, 127, y, '#5e6a76'); for (let x = 0; x < 128; x += 16) p.vline(x, 0, 127, '#5e6a76');
            for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) p.set(x + 1, y + 1, '#9eaab6');
            p.rect(0, 100, 128, 4, '#2aa86a');
            break;
        }
        case 'vault': {
            fill('#262a30'); for (let y = 0; y < 128; y += 16) p.hline(0, 127, y, '#1a1e24'); for (let x = 0; x < 128; x += 16) p.vline(x, 0, 127, '#1a1e24');
            for (let x = 0; x < 128; x += 8) p.rect(x, 64, 4, 2, (x / 8) % 2 ? '#e0b020' : '#1a1a1a');
            noise('#30343c', 200);
            break;
        }
        case 'lobby': case 'penthouse': {
            const a = kind === 'lobby' ? '#8a8696' : '#2a2632', b = kind === 'lobby' ? '#6e6a7c' : '#3a3444';
            for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) p.rect(x, y, 32, 32, ((x + y) / 32) % 2 ? a : b);
            for (let k = 0; k < 40; k++) { let x = r.int(0, 127), y = r.int(0, 127); for (let s = 0; s < 6; s++) { p.set(x, y, kind === 'lobby' ? '#9a96a8' : '#4a4456'); x += r.int(-1, 1); y++; } }
            for (let y = 0; y < 128; y += 32) p.hline(0, 127, y, kind === 'lobby' ? '#d8b860' : '#8a6a2a');
            break;
        }
        case 'elevator': {
            fill('#3a3e48'); for (let y = 0; y < 128; y += 4) for (let x = (y % 8) ? 2 : 0; x < 128; x += 4) p.rect(x, y, 2, 2, '#2a2e36');
            p.rect(0, 0, 128, 6, '#e0b020'); for (let x = 0; x < 128; x += 8) p.rect(x, 0, 4, 6, '#1a1a1a');
            break;
        }
        case 'helipad': {
            fill('#34343c'); noise('#3e3e46', 500); noise('#2a2a30', 400);
            p.rect(0, 30, 128, 3, '#e8e8f0'); p.rect(0, 100, 128, 3, '#e8e8f0');
            break;
        }
        default: fill('#333');
    }
    return p;
}

// ---------------------------------------------------------------- misc surfaces
export function containerTex(color, seed) {
    const p = new Pix(64, 48), r = rng(seed);
    p.rect(0, 0, 64, 48, color);
    for (let x = 2; x < 64; x += 4) { p.vline(x, 2, 45, shade(color, 0.7)); p.vline(x + 1, 2, 45, shade(color, 1.2)); }
    p.rect(0, 0, 64, 2, shade(color, 1.4)); p.rect(0, 46, 64, 2, shade(color, 0.5));
    p.rect(4, 8, 20, 7, shade(color, 0.55)); text(p, r.pick(['AUREX', 'KAIJU', 'MAERO', 'ZEN-CO', 'HALCYN']), 5, 9, '#f0f0f0');
    return p;
}

export function trainWall({ seed = 1 }) {
    // window band is transparent so the background city shows through
    const p = new Pix(128, 128);
    p.rect(0, 0, 128, 128, '#6e7686');
    p.rect(0, 0, 128, 14, '#4a5060'); for (let x = 8; x < 128; x += 32) { p.rect(x, 4, 16, 6, '#e8e0c0'); p.rect(x + 1, 5, 14, 4, '#fff8e0'); }
    for (let k = 0; k < 2; k++) { const x = 6 + k * 62; p.rect(x, 22, 54, 40, '#3a3e4a'); for (let y = 24; y < 60; y++) for (let xx = x + 2; xx < x + 52; xx++) p.set(xx, y, '#000000', 0); }
    p.rect(0, 64, 128, 4, '#e0b020'); p.rect(0, 68, 128, 4, '#2a6ac8');
    p.rect(0, 80, 128, 26, '#2a3a6a'); for (let x = 0; x < 128; x += 16) p.vline(x, 80, 105, '#1a2a4a');
    p.rect(0, 80, 128, 3, '#4a5a9a'); p.rect(0, 106, 128, 22, '#3a3e4a');
    text(p, 'LINE 9', 94, 110, '#e0e0e8'); p.rect(4, 108, 40, 10, '#1a1a22'); text(p, 'AUREX', 6, 110, '#ff2d55');
    return p;
}

export function windowCity({ seed = 1 }) {
    const p = skylineTex({ seed, w: 256, h: 64, minH: 16, maxH: 60, density: 0.35, body: '#0a0818', edge: '#1a1030' });
    for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) if (!p.get(x, y)) p.set(x, y, y < 30 ? '#1a1030' : '#2a1438');
    return p;
}

export function labWall({ seed = 1, dark = false }) {
    const p = new Pix(128, 128), r = rng(seed);
    const a = dark ? '#2a2e36' : '#8e9aa8', b = dark ? '#1e2228' : '#6e7a88';
    p.rect(0, 0, 128, 128, a);
    for (let x = 0; x < 128; x += 32) { p.vline(x, 0, 127, b); p.vline(x + 1, 0, 127, dark ? '#3a3e46' : '#aab6c4'); }
    p.rect(0, 100, 128, 28, dark ? '#1a1e24' : '#5a6672'); p.rect(0, 100, 128, 3, '#2aa86a');
    for (let x = 0; x < 128; x += 16) p.rect(x, 108, 8, 4, (x / 16) % 2 ? '#e0b020' : '#1a1a1a');
    if (r() < 0.7) { const mx = r.int(10, 80); p.rect(mx, 30, 36, 24, '#1a1e24'); p.rect(mx + 2, 32, 32, 20, '#0a2a1a'); for (let k = 0; k < 5; k++) p.hline(mx + 4, mx + 4 + r.int(6, 26), 35 + k * 3, '#3aff8a'); }
    if (r() < 0.6) { p.rect(r.int(6, 100), 66, 20, 10, '#ff3a3a'); }
    text(p, r.pick(['SUBLEVEL 4', 'BIOHAZARD', 'VANTA LAB', 'G-SERIES', 'NO ENTRY']), 6, 88, dark ? '#ff3a3a' : '#2a6a5a');
    return p;
}

export function marbleWall({ seed = 1, dark = false }) {
    const p = new Pix(128, 128), r = rng(seed);
    const a = dark ? '#1e1a26' : '#8a8698', b = dark ? '#2a2434' : '#9c98aa';
    p.rect(0, 0, 128, 128, a);
    for (let k = 0; k < 60; k++) { let x = r.int(0, 127), y = r.int(0, 127); for (let s = 0; s < 10; s++) { p.set(x, y, b); x += r.int(-1, 1); y++; } }
    for (let x = 0; x < 128; x += 64) { p.rect(x, 0, 6, 128, dark ? '#6a5222' : '#8a7038'); p.vline(x + 1, 0, 127, '#c8a860'); }
    p.rect(0, 118, 128, 10, dark ? '#0e0c14' : '#4a4658');
    return p;
}

export function glassWall({ seed = 1 }) {
    // big penthouse windows: transparent panes with frames
    const p = new Pix(128, 128);
    p.rect(0, 0, 128, 128, '#141018');
    for (let x = 0; x < 128; x += 64) for (let y = 8; y < 110; y++) for (let xx = x + 4; xx < x + 60; xx++) p.set(xx, y, '#000000', 0);
    for (let x = 0; x < 128; x += 64) { p.rect(x, 0, 4, 128, '#2a2434'); p.vline(x + 1, 0, 127, '#d8b860'); }
    p.rect(0, 110, 128, 18, '#1e1a26'); p.hline(0, 127, 110, '#d8b860');
    return p;
}

export function brickWall({ seed = 1, color = '#4a2a2a' }) {
    const p = new Pix(64, 64), r = rng(seed);
    p.rect(0, 0, 64, 64, color);
    for (let y = 0; y < 64; y += 5) { p.hline(0, 63, y, shade(color, 0.6)); for (let x = (y / 5) % 2 ? 0 : 5; x < 64; x += 10) p.vline(x, y, y + 4, shade(color, 0.6)); }
    for (let k = 0; k < 40; k++) p.set(r.int(0, 63), r.int(0, 63), shade(color, 1.3));
    return p;
}

export function fenceTex() {
    const p = new Pix(32, 32);
    for (let i = 0; i < 64; i++) { p.set(i % 32, (i + 0) % 32, '#7a8090'); p.set(31 - (i % 32), i % 32, '#7a8090'); }
    p.rect(0, 0, 32, 2, '#5a6070');
    return p;
}

export function lanternRow({ seed = 1 }) {
    const p = new Pix(128, 24), r = rng(seed);
    for (let x = 0; x < 128; x++) { const y = Math.round(4 + Math.sin((x / 128) * Math.PI) * 8); p.set(x, y, '#2a1a1a'); }
    for (let x = 8; x < 128; x += 20) {
        const y = Math.round(4 + Math.sin((x / 128) * Math.PI) * 8) + 2;
        const c = r.pick(['#ff3a2a', '#ff6a2a', '#ffb02a', '#ff3a6a']);
        p.ellipse(x, y + 5, 4, 5, c); p.ellipse(x - 1, y + 4, 2, 3, mix(c, '#ffffff', 0.5)); p.set(x, y, '#1a1a1a'); p.set(x, y + 10, '#ffd23a');
    }
    return p;
}

export function awningTex(color) {
    const p = new Pix(32, 16);
    for (let x = 0; x < 32; x += 8) { p.rect(x, 0, 4, 14, color); p.rect(x + 4, 0, 4, 14, '#f4f0e0'); }
    for (let x = 0; x < 32; x += 4) p.ellipse(x + 2, 14, 2, 2, (x / 4) % 2 ? '#f4f0e0' : color);
    return p;
}

export function roofTiles({ seed = 1 }) {
    const p = new Pix(64, 32);
    p.rect(0, 0, 64, 32, '#3a2a3a');
    for (let y = 0; y < 32; y += 6) for (let x = (y / 6) % 2 ? 0 : 4; x < 64; x += 8) { p.ellipse(x + 4, y + 4, 4, 3, '#4a3448'); p.hline(x + 1, x + 6, y + 2, '#6a4a64'); }
    return p;
}

export function seaTex({ seed = 1 }) {
    const p = new Pix(64, 64), r = rng(seed);
    p.rect(0, 0, 64, 64, '#1a2a48');
    for (let k = 0; k < 90; k++) { const y = r.int(0, 63); const x = r.int(0, 60); p.hline(x, x + r.int(1, 4), y, r() < 0.3 ? '#ffb07a' : '#2a4a6a'); }
    return p;
}

export function stripesTex(a = '#e0b020', b = '#1a1a1a') {
    const p = new Pix(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ((x + y) >> 2) % 2 ? a : b);
    return p;
}

export function gridGlow(color = '#3af4ff') {
    const p = new Pix(32, 32);
    for (let i = 0; i < 32; i++) { p.set(i, 0, color); p.set(0, i, color); }
    return p;
}

export function hologramTex({ seed = 1, color = '#3af4ff', word = 'AUREX' }) {
    const p = new Pix(96, 48), r = rng(seed);
    for (let y = 0; y < 48; y += 2) p.hline(0, 95, y, shade(color, 0.18));
    // woman's face silhouette in profile (advert)
    p.ellipse(30, 22, 12, 15, shade(color, 0.6)); p.ellipse(26, 20, 8, 10, shade(color, 0.9)); p.rect(24, 34, 10, 14, shade(color, 0.6));
    p.set(34, 19, '#ffffff'); p.hline(36, 40, 26, '#ffffff');
    text(p, word, 52, 10, color, 2); text(p, r.pick(['BE MORE', 'ASCEND', 'TRUST US', 'UPGRADE']), 52, 28, mix(color, '#ffffff', 0.4));
    return p;
}
