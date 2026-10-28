// Procedural textures, all drawn on 2D canvases at load. No image files.

import * as THREE from 'three';
import { makeRng } from '../rng.js';

const cache = new Map();
function memo(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
}

export function canvasTex(w, h, draw, { srgb = true, repeat = null, aniso = 4 } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
}

function speckle(g, w, h, rng, n, colors, maxR = 1.6) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[Math.floor(rng() * colors.length)];
        g.globalAlpha = 0.15 + rng() * 0.5;
        const r = 0.3 + rng() * maxR;
        g.fillRect(rng() * w, rng() * h, r, r);
    }
    g.globalAlpha = 1;
}

/** A grey bump/roughness field: brushed, scratched, worn. */
export function noiseTex(seed = 1, size = 256, style = 'brushed') {
    return memo(`noise${seed}${size}${style}`, () => canvasTex(size, size, (g, w, h) => {
        const rng = makeRng(seed);
        g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
        if (style === 'brushed') {
            for (let i = 0; i < 900; i++) {
                const v = 100 + rng() * 80;
                g.strokeStyle = `rgb(${v},${v},${v})`; g.globalAlpha = 0.25;
                const y = rng() * h;
                g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (rng() - 0.5) * 2); g.stroke();
            }
        } else {
            for (let i = 0; i < 2500; i++) {
                const v = 90 + rng() * 100;
                g.fillStyle = `rgb(${v},${v},${v})`; g.globalAlpha = 0.35;
                const r = 1 + rng() * 3;
                g.fillRect(rng() * w, rng() * h, r, r);
            }
        }
        g.globalAlpha = 1;
        for (let i = 0; i < 14; i++) {              // scratches
            g.strokeStyle = rng() < 0.5 ? '#c8c8c8' : '#4a4a4a'; g.globalAlpha = 0.4; g.lineWidth = 0.6;
            const x = rng() * w, y = rng() * h, a = rng() * 6.28, l = 12 + rng() * 40;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
    }, { srgb: false, repeat: [1, 1] }));
}

/** A circuit board top: traces, pads, vias, silkscreen. */
export function pcbTex(base = 'green', seed = 1) {
    const colors = {
        green: ['#1e5a3a', '#2e7a52', '#d8d4b0'], blue: ['#1c3a68', '#2c5aa0', '#c8d6e8'], black: ['#16181e', '#2a2e38', '#a0a8b8'], red: ['#6a1d24', '#962a34', '#e8d0c0'],
    }[base];
    return memo(`pcb${base}${seed}`, () => canvasTex(256, 256, (g, w, h) => {
        const rng = makeRng(seed * 7 + 3);
        g.fillStyle = colors[0]; g.fillRect(0, 0, w, h);
        g.strokeStyle = colors[1]; g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 0; i < 46; i++) {
            g.lineWidth = 1.2 + rng() * 1.6; g.beginPath();
            let x = Math.floor(rng() * 16) * 16 + 8, y = Math.floor(rng() * 16) * 16 + 8;
            g.moveTo(x, y);
            for (let k = 0; k < 4; k++) {
                if (rng() < 0.5) x += (rng() < 0.5 ? -1 : 1) * (16 + Math.floor(rng() * 3) * 16); else y += (rng() < 0.5 ? -1 : 1) * (16 + Math.floor(rng() * 3) * 16);
                g.lineTo(x, y);
            }
            g.stroke();
            g.fillStyle = '#c9a86a'; g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fill();
        }
        for (let i = 0; i < 30; i++) {
            g.fillStyle = '#c9a86a'; g.globalAlpha = 0.9; g.beginPath(); g.arc(rng() * w, rng() * h, 1.6, 0, 6.3); g.fill();
        }
        g.globalAlpha = 1;
        g.strokeStyle = colors[2]; g.lineWidth = 1; g.globalAlpha = 0.55;
        for (let i = 0; i < 9; i++) { g.strokeRect(rng() * 220, rng() * 220, 14 + rng() * 26, 10 + rng() * 18); }
        g.globalAlpha = 1;
        speckle(g, w, h, rng, 700, ['#000', '#fff', colors[1]], 1.2);
    }, { repeat: [1, 1] }));
}

/** Rubber work mat: dark, gridded, stained. */
export function matTex() {
    return memo('mat', () => canvasTex(512, 512, (g, w, h) => {
        const rng = makeRng(99);
        g.fillStyle = '#16221f'; g.fillRect(0, 0, w, h);
        speckle(g, w, h, rng, 6000, ['#0b1412', '#22332f', '#2a4038'], 1.6);
        g.strokeStyle = 'rgba(120,190,170,0.16)'; g.lineWidth = 1;
        for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); }
        g.strokeStyle = 'rgba(120,190,170,0.07)';
        for (let i = 0; i <= 40; i++) { g.beginPath(); g.moveTo((i * w) / 40, 0); g.lineTo((i * w) / 40, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 40); g.lineTo(w, (i * h) / 40); g.stroke(); }
        for (let i = 0; i < 9; i++) {                       // oil and coffee stains
            const x = rng() * w, y = rng() * h, r = 14 + rng() * 40;
            const grd = g.createRadialGradient(x, y, 2, x, y, r);
            grd.addColorStop(0, rng() < 0.5 ? 'rgba(10,10,6,0.55)' : 'rgba(60,40,24,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.fillStyle = 'rgba(255,200,70,0.5)';               // painted work zones
        g.font = 'bold 22px monospace'; g.fillText('SCREWS', 20, 40);
        g.fillText('SCRAP', w - 120, 40);
    }, { repeat: [1, 1] }));
}

export function concreteTex() {
    return memo('concrete', () => canvasTex(512, 512, (g, w, h) => {
        const rng = makeRng(31);
        g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h);
        speckle(g, w, h, rng, 9000, ['#15171c', '#30343e', '#3a3f4b', '#101216'], 2.2);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(rng() * w, rng() * h); for (let k = 0; k < 5; k++) g.lineTo(rng() * w, rng() * h); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke(); }
    }, { repeat: [4, 4] }));
}

export function panelTex(baseHex = 0x8b8f99, accentHex = 0xff7a3d, seed = 1, text = '') {
    return memo(`panel${baseHex}${accentHex}${seed}${text}`, () => canvasTex(256, 256, (g, w, h) => {
        const rng = makeRng(seed + 17);
        const c = new THREE.Color(baseHex), a = new THREE.Color(accentHex);
        g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
        speckle(g, w, h, rng, 2600, ['#00000040', '#ffffff30', '#00000030'], 1.4);
        for (let i = 0; i < 40; i++) {                         // scuffs
            g.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.3)'; g.lineWidth = 0.7;
            const x = rng() * w, y = rng() * h, ang = rng() * 6.3, l = 6 + rng() * 22;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
        }
        g.fillStyle = `#${a.getHexString()}`; g.globalAlpha = 0.9;
        g.fillRect(0, h * 0.44, w, 12);                          // accent stripe
        g.globalAlpha = 0.55;
        for (let i = 0; i < 12; i++) { g.save(); g.translate(i * 24, h * 0.44); g.transform(1, 0, -0.6, 1, 0, 0); g.fillStyle = '#10121a'; g.fillRect(0, 0, 10, 12); g.restore(); }
        g.globalAlpha = 0.8; g.fillStyle = '#10121a'; g.font = 'bold 20px monospace'; g.fillText(text || 'SERVICE', 14, h * 0.44 + 38);
        g.globalAlpha = 1;
    }));
}

export function labelTex(text, { fg = '#e8e8d8', bg = '#1a1c22', w = 128, h = 48, size = 26, border = null } = {}) {
    return memo(`label${text}${fg}${bg}${size}`, () => canvasTex(w, h, (g) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        if (border) { g.strokeStyle = border; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4); }
        g.fillStyle = fg; g.font = `bold ${size}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        let s = size;
        while (g.measureText(text).width > w - 10 && s > 8) { s -= 1; g.font = `bold ${s}px monospace`; }
        g.fillText(text, w / 2, h / 2 + 1);
    }));
}

export function tagTex(letter, hex) {
    return memo(`tag${letter}${hex}`, () => canvasTex(64, 64, (g) => {
        const c = new THREE.Color(hex);
        g.fillStyle = `#${c.getHexString()}`; g.beginPath(); g.arc(32, 32, 28, 0, 6.3); g.fill();
        g.lineWidth = 4; g.strokeStyle = '#0a0a0e'; g.stroke();
        g.fillStyle = (c.r + c.g + c.b) / 3 > 0.55 ? '#10121a' : '#ffffff'; g.font = 'bold 36px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(letter, 32, 35);
    }));
}

export function glyphTex(kind) {
    return memo(`glyph${kind}`, () => canvasTex(64, 64, (g) => {
        g.clearRect(0, 0, 64, 64);
        g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
        if (kind === 'ok') { g.strokeStyle = '#46e08a'; g.beginPath(); g.moveTo(14, 34); g.lineTo(27, 47); g.lineTo(51, 17); g.stroke(); }
        else { g.strokeStyle = '#ff4d5e'; g.beginPath(); g.moveTo(16, 16); g.lineTo(48, 48); g.moveTo(48, 16); g.lineTo(16, 48); g.stroke(); }
    }));
}

/** Soft dust / fuzz: transparent with clumps. */
export function dustTex() {
    return memo('dust', () => canvasTex(128, 128, (g, w, h) => {
        const rng = makeRng(5);
        g.clearRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
            const x = rng() * w, y = rng() * h, r = 1 + rng() * 5;
            const grd = g.createRadialGradient(x, y, 0, x, y, r);
            grd.addColorStop(0, `rgba(160,155,145,${0.15 + rng() * 0.3})`); grd.addColorStop(1, 'rgba(160,155,145,0)');
            g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
    }));
}

export function corrTex() {
    return memo('corr', () => canvasTex(128, 128, (g, w, h) => {
        const rng = makeRng(8);
        g.fillStyle = '#2a8f78'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 700; i++) {
            const x = rng() * w, y = rng() * h, r = 1 + rng() * 6;
            g.fillStyle = ['#46c9a8', '#1c6a5a', '#7fe0c4', '#3aa68c'][Math.floor(rng() * 4)]; g.globalAlpha = 0.6;
            g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
        }
        g.globalAlpha = 1;
    }));
}

export function crackTex() {
    return memo('crack', () => canvasTex(128, 128, (g) => {
        g.clearRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; g.lineCap = 'round';
        const rng = makeRng(2);
        for (let k = 0; k < 5; k++) {
            let x = 64, y = 64, a = rng() * 6.3;
            g.beginPath(); g.moveTo(x, y);
            for (let i = 0; i < 6; i++) { a += (rng() - 0.5) * 1.1; x += Math.cos(a) * (8 + rng() * 14); y += Math.sin(a) * (8 + rng() * 14); g.lineTo(x, y); }
            g.stroke();
        }
    }));
}

export function sootTex() {
    return memo('soot', () => canvasTex(128, 128, (g, w, h) => {
        const rng = makeRng(12);
        g.clearRect(0, 0, w, h);
        const grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
        grd.addColorStop(0, 'rgba(0,0,0,0.95)'); grd.addColorStop(0.6, 'rgba(10,6,4,0.7)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + rng() * 0.4})`; g.fillRect(rng() * w, rng() * h, 2 + rng() * 6, 2 + rng() * 6); }
    }));
}

/** A neon sign face (drawn mirrored by the caller if it hangs behind glass). */
export function neonTex(text, color = '#ff3d8b', { w = 512, h = 160, size = 96, font = 'bold', frame = true } = {}) {
    return memo(`neon${text}${color}${w}${size}`, () => canvasTex(w, h, (g) => {
        g.clearRect(0, 0, w, h);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `${font} ${size}px "Arial Black", Impact, sans-serif`;
        let s = size;
        while (g.measureText(text).width > w - 40 && s > 12) { s -= 2; g.font = `${font} ${s}px "Arial Black", Impact, sans-serif`; }
        g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color;
        g.fillText(text, w / 2, h / 2);
        g.shadowBlur = 6; g.fillStyle = '#ffffff'; g.globalAlpha = 0.85;
        g.fillText(text, w / 2, h / 2);
        g.globalAlpha = 1;
        if (frame) { g.shadowBlur = 14; g.shadowColor = color; g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); }
    }));
}

/** The city beyond the window: layered skyline with lit windows. */
export function skylineTex(layer = 0) {
    return memo(`sky${layer}`, () => canvasTex(1024, 512, (g, w, h) => {
        const rng = makeRng(40 + layer);
        const grd = g.createLinearGradient(0, 0, 0, h);
        if (layer === 0) { grd.addColorStop(0, '#0a0818'); grd.addColorStop(0.55, '#321a4a'); grd.addColorStop(1, '#6a2a58'); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
        else g.clearRect(0, 0, w, h);
        const neon = ['#ff3d8b', '#35e0ff', '#ffb13d', '#8c5cff', '#4dff9a'];
        let x = 0;
        while (x < w) {
            const bw = 30 + rng() * 90, bh = (layer === 0 ? 120 : 200) + rng() * (layer === 0 ? 200 : 260);
            g.fillStyle = layer === 0 ? '#0d0b18' : '#07060d';
            g.fillRect(x, h - bh, bw, bh);
            for (let wy = h - bh + 8; wy < h - 8; wy += 9) {
                for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
                    if (rng() < 0.22) { g.fillStyle = rng() < 0.2 ? neon[Math.floor(rng() * neon.length)] : '#ffd58a'; g.globalAlpha = 0.35 + rng() * 0.6; g.fillRect(wx, wy, 4, 5); }
                }
            }
            g.globalAlpha = 1;
            if (rng() < 0.3) { g.fillStyle = neon[Math.floor(rng() * neon.length)]; g.shadowColor = g.fillStyle; g.shadowBlur = 12; g.fillRect(x + 4, h - bh - 4, bw - 8, 3); g.shadowBlur = 0; }
            if (rng() < 0.25) { g.fillStyle = '#07060d'; g.fillRect(x + bw / 2 - 1, h - bh - 30, 2, 30); g.fillStyle = '#ff2a40'; g.fillRect(x + bw / 2 - 2, h - bh - 32, 4, 4); }
            x += bw + 2 + rng() * 6;
        }
    }, { aniso: 2 }));
}

export function spriteTex(kind) {
    return memo(`sprite${kind}`, () => canvasTex(64, 64, (g) => {
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        if (kind === 'spark') { grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,200,90,0.9)'); grd.addColorStop(1, 'rgba(255,120,20,0)'); }
        else if (kind === 'smoke') { grd.addColorStop(0, 'rgba(180,180,190,0.55)'); grd.addColorStop(0.6, 'rgba(110,110,120,0.25)'); grd.addColorStop(1, 'rgba(80,80,90,0)'); }
        else { grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); }
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    }));
}
