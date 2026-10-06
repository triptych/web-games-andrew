// toon.js — cel-shading materials and every procedural texture in the game.
// Nothing is loaded from disk: wood grain, hull paint, sail cloth, emblems,
// flags and lighthouse stripes are all drawn into canvases here.

import * as THREE from 'three';

export const PALETTE = {
    skyTop: 0x58b8f5, skyHorizon: 0xe9f8ff,
    oceanDeep: 0x1b86c0, oceanMid: 0x34b0dc, oceanShallow: 0x8ae6ea,
    boardLight: 0x9ff1e4, boardDark: 0x2c9ccc,
    wood: 0xc38b55, woodDark: 0x8a5a33, rope: 0xd9b77a,
    navy: { hull: '#f3ead6', band: '#2c5ea8', trim: '#f2c14e', bottom: '#c0563f', sail: '#fffaf0', ink: '#2f68cf', flag: '#2c5ea8', stripe: '#2c5ea8', tower: '#fbfbf6' },
    pirate: { hull: '#3c302d', band: '#c23b2e', trim: '#e2b453', bottom: '#2b3a33', sail: '#2a2830', ink: '#f4f0e6', flag: '#1d1b20', stripe: '#c23b2e', tower: '#4a4248' },
};
export const teamOf = (color) => (color > 0 ? PALETTE.navy : PALETTE.pirate);

// Three tone steps, nearest-filtered, so light falls off in hard bands.
function gradient(steps) {
    const data = new Uint8Array(steps.length);
    steps.forEach((v, i) => { data[i] = v; });
    const t = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
}
export const GRAD = gradient([110, 190, 255]);
export const GRAD_SOFT = gradient([150, 210, 255]);

const matCache = new Map();
/** Cached MeshToonMaterial. opts: map, side, emissive, transparent, opacity, vertexColors, soft, outline. */
export function toon(color, opts = {}) {
    const key = JSON.stringify([color, opts.map?.uuid, opts.side, opts.emissive, opts.emissiveIntensity, opts.transparent, opts.opacity, opts.vertexColors, opts.soft, opts.outline, opts.name]);
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshToonMaterial({
        color, gradientMap: opts.soft ? GRAD_SOFT : GRAD,
        map: opts.map || null,
        side: opts.side ?? THREE.FrontSide,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        vertexColors: !!opts.vertexColors,
    });
    m.userData.outlineParameters = opts.outline || { thickness: 0.0045, color: [0.12, 0.1, 0.14] };
    matCache.set(key, m);
    return m;
}
export const NO_OUTLINE = { visible: false };

let maxAniso = 4;
export function setMaxAnisotropy(n) { maxAniso = n; }

export function canvasTex(w, h, draw, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
}

// Deterministic jitter for texture detail (textures look the same every load).
function prng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shade(hex, f) {
    const c = new THREE.Color(hex);
    c.multiplyScalar(f);
    return '#' + c.getHexString();
}

/** Wood planks running along u. */
function drawPlanks(g, w, h, base, rows, seed, opts = {}) {
    const r = prng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const rowH = h / rows;
    for (let i = 0; i < rows; i++) {
        const y = i * rowH;
        g.fillStyle = shade(base, 0.9 + r() * 0.2);
        g.fillRect(0, y, w, rowH);
        // grain
        g.globalAlpha = 0.18;
        for (let k = 0; k < 7; k++) {
            g.strokeStyle = shade(base, 0.7);
            g.lineWidth = 1 + r() * 1.5;
            g.beginPath();
            const gy = y + r() * rowH;
            g.moveTo(0, gy);
            for (let x = 0; x <= w; x += w / 8) g.lineTo(x, gy + Math.sin(x * 0.03 + k) * rowH * 0.12);
            g.stroke();
        }
        g.globalAlpha = 1;
        // seam
        g.fillStyle = shade(base, 0.55);
        g.fillRect(0, y, w, Math.max(1.5, rowH * 0.07));
        // butt joints
        const joints = opts.joints ?? 2;
        for (let j = 0; j < joints; j++) {
            const x = ((i * 0.37 + j / joints + r() * 0.1) % 1) * w;
            g.fillRect(x, y, Math.max(1.5, w * 0.004), rowH);
            if (opts.nails) {
                g.fillStyle = shade(base, 0.4);
                g.beginPath(); g.arc(x + 5, y + rowH * 0.3, 1.6, 0, 7); g.arc(x + 5, y + rowH * 0.7, 1.6, 0, 7); g.fill();
                g.fillStyle = shade(base, 0.55);
            }
        }
    }
}

const texCache = new Map();
const cached = (key, make) => { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); };

export const TEX = {
    deckPlanks: () => cached('deck', () => canvasTex(512, 512, (g, w, h) => drawPlanks(g, w, h, '#d9b484', 10, 11, { nails: true }), { repeat: true })),
    dockPlanks: () => cached('dock', () => canvasTex(1024, 256, (g, w, h) => drawPlanks(g, w, h, '#c99258', 5, 21, { joints: 3, nails: true }), { repeat: true })),
    crate: () => cached('crate', () => canvasTex(256, 256, (g, w, h) => {
        drawPlanks(g, w, h, '#b98049', 4, 5, { joints: 0 });
        g.strokeStyle = '#6e4423'; g.lineWidth = 18;
        g.strokeRect(9, 9, w - 18, h - 18);
        g.beginPath(); g.moveTo(18, 18); g.lineTo(w - 18, h - 18); g.stroke();
    })),

    /** Hull paint: copper/tar below the waterline, painted planks, a trim band, optional gunports. */
    hull: (color, guns = 0) => cached(`hull${color}${guns}`, () => canvasTex(1024, 256, (g, w, h) => {
        const t = teamOf(color);
        drawPlanks(g, w, h, t.hull, 9, color > 0 ? 3 : 4, { joints: 4 });
        const water = h * 0.70;              // v < 0.3 is under water
        g.fillStyle = t.bottom;
        g.fillRect(0, water, w, h - water);
        g.fillStyle = shade(t.bottom, 0.75);
        for (let x = 0; x < w; x += 22) g.fillRect(x, water, 2, h - water);
        g.fillStyle = '#ffffff'; g.globalAlpha = 0.85;
        g.fillRect(0, water - 5, w, 5);
        g.globalAlpha = 1;
        // trim bands
        g.fillStyle = t.band;
        g.fillRect(0, h * 0.06, w, h * (guns >= 2 ? 0.44 : 0.2));
        g.fillStyle = t.trim;
        g.fillRect(0, h * 0.02, w, h * 0.045);
        g.fillRect(0, h * (guns >= 2 ? 0.5 : 0.26), w, h * 0.03);
        if (guns) {
            const rows = guns >= 2 ? [0.15, 0.33] : [0.1];
            for (const ry of rows) {
                for (let x = w * 0.18; x < w * 0.86; x += w * 0.075) {
                    g.fillStyle = t.trim;
                    g.fillRect(x - 3, h * ry - 3, 34, h * 0.11 + 6);
                    g.fillStyle = '#17121a';
                    g.fillRect(x, h * ry, 28, h * 0.11);
                }
            }
        }
    })),

    /** Sail cloth. kind: 'emblem' | 'stripes' | 'plain' | 'triangle'. */
    sail: (color, kind) => cached(`sail${color}${kind}`, () => canvasTex(512, 512, (g, w, h) => {
        const t = teamOf(color);
        g.fillStyle = t.sail;
        g.fillRect(0, 0, w, h);
        if (kind === 'stripes') {
            g.fillStyle = color > 0 ? '#2c5ea8' : '#b8322a';
            for (let i = 0; i < 7; i += 2) g.fillRect((i / 7) * w, 0, w / 7, h);
        }
        // panel seams + weathering
        g.globalAlpha = 0.14;
        g.strokeStyle = color > 0 ? '#6a5a40' : '#000';
        g.lineWidth = 3;
        for (let x = w / 8; x < w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        const r = prng(color > 0 ? 7 : 9);
        for (let i = 0; i < 40; i++) {
            g.fillStyle = color > 0 ? '#c9b88f' : '#000';
            g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 30, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
        // hems
        g.strokeStyle = color > 0 ? '#d9cfb4' : '#141218';
        g.lineWidth = 16;
        g.strokeRect(0, 0, w, h);
        if (kind === 'emblem') {
            if (color > 0) drawAnchor(g, w / 2, h / 2, w * 0.36, t.ink);
            else drawSkull(g, w / 2, h / 2 - 10, w * 0.3, t.ink);
        }
    })),

    flag: (color, crown = false) => cached(`flag${color}${crown}`, () => canvasTex(256, 160, (g, w, h) => {
        const t = teamOf(color);
        g.fillStyle = t.flag;
        g.fillRect(0, 0, w, h);
        if (color > 0) {
            g.fillStyle = '#ffffff';
            g.fillRect(0, h * 0.42, w, h * 0.16);
            g.fillRect(w * 0.36, 0, w * 0.13, h);
            g.fillStyle = '#d6343a';
            g.fillRect(0, h * 0.46, w, h * 0.08);
            g.fillRect(w * 0.385, 0, w * 0.08, h);
            if (crown) drawCrown(g, w * 0.72, h * 0.25, 40, '#f2c14e');
        } else {
            drawSkull(g, w * 0.5, h * 0.45, h * 0.5, '#f4f0e6');
            if (crown) drawCrown(g, w * 0.5, h * 0.1, 34, '#e2b453');
        }
    })),

    tower: (color) => cached(`tower${color}`, () => canvasTex(256, 512, (g, w, h) => {
        const t = teamOf(color);
        g.fillStyle = t.tower;
        g.fillRect(0, 0, w, h);
        g.fillStyle = t.stripe;
        for (let i = 0; i < 4; i++) {
            const y = h * (0.08 + i * 0.25);
            g.fillRect(0, y, w, h * 0.11);
        }
        // masonry courses
        g.globalAlpha = 0.12;
        g.fillStyle = '#000';
        for (let y = 0; y < h; y += 16) {
            g.fillRect(0, y, w, 2);
            for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) g.fillRect(x, y, 2, 16);
        }
        g.globalAlpha = 1;
        // windows
        g.fillStyle = '#1e2433';
        for (const y of [0.3, 0.55, 0.8]) {
            g.fillRect(w * 0.45, h * (1 - y) - 14, 22, 30);
            g.fillStyle = '#ffdd88'; g.fillRect(w * 0.45 + 3, h * (1 - y) - 11, 16, 12); g.fillStyle = '#1e2433';
        }
    })),

    shield: (color) => cached(`shield${color}`, () => canvasTex(128, 128, (g, w, h) => {
        const t = teamOf(color);
        g.fillStyle = t.band; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
        g.fillStyle = color > 0 ? '#fffaf0' : '#1d1b20';
        g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, w / 2, 0, Math.PI / 2); g.fill();
        g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, w / 2, Math.PI, Math.PI * 1.5); g.fill();
        g.fillStyle = t.trim; g.beginPath(); g.arc(w / 2, h / 2, w * 0.13, 0, 7); g.fill();
        g.strokeStyle = t.trim; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.stroke();
    })),

    rock: () => cached('rock', () => canvasTex(256, 256, (g, w, h) => {
        const r = prng(31);
        g.fillStyle = '#8f949c'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 160; i++) {
            g.fillStyle = r() < 0.5 ? '#7a7f88' : '#a7abb2';
            g.globalAlpha = 0.5;
            g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 14, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
    }, { repeat: true })),

    sand: () => cached('sand', () => canvasTex(256, 256, (g, w, h) => {
        const r = prng(41);
        g.fillStyle = '#f3dca2'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
            g.fillStyle = r() < 0.5 ? '#e5c98a' : '#fff0c4';
            g.fillRect(r() * w, r() * h, 2, 2);
        }
    }, { repeat: true })),

    label: (text, color = '#fff8e6') => cached(`label${text}${color}`, () => canvasTex(128, 128, (g, w, h) => {
        g.font = 'bold 84px "Pirata One", Georgia, serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = 'rgba(70,40,20,0.9)';
        g.strokeText(text, w / 2, h / 2 + 4);
        g.fillStyle = color;
        g.fillText(text, w / 2, h / 2 + 4);
    })),

    /** Round soft sprite textures for particles. */
    sprite: (kind) => cached(`sprite${kind}`, () => canvasTex(128, 128, (g, w, h) => {
        const c = w / 2;
        if (kind === 'smoke') {
            g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(c, c, 52, 0, 7); g.fill();
            g.fillStyle = '#d4d6dc'; g.beginPath(); g.arc(c + 10, c + 12, 38, 0, 7); g.fill();
            g.lineWidth = 6; g.strokeStyle = '#4a4a55'; g.beginPath(); g.arc(c, c, 54, 0, 7); g.stroke();
        } else if (kind === 'drop') {
            g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c + 8, 36, 0, Math.PI); g.lineTo(c, c - 50); g.closePath(); g.fill();
            g.lineWidth = 6; g.strokeStyle = '#2a7fb0'; g.stroke();
        } else if (kind === 'bubble') {
            g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(c, c, 46, 0, 7); g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(c, c, 42, 0, 7); g.fill();
            g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c - 16, c - 16, 10, 0, 7); g.fill();
        } else if (kind === 'spark') {
            g.fillStyle = '#fff7b0';
            g.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 18 : 58;
                g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
            }
            g.closePath(); g.fill();
            g.lineWidth = 5; g.strokeStyle = '#e09b20'; g.stroke();
        } else if (kind === 'note') {
            g.font = 'bold 100px Georgia, serif';
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineWidth = 10; g.strokeStyle = '#5b2a6e'; g.strokeText('♪', c, c);
            g.fillStyle = '#ffd6f5'; g.fillText('♪', c, c);
        } else if (kind === 'foam') {
            const grd = g.createRadialGradient(c, c, 10, c, c, 60);
            grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd; g.beginPath(); g.arc(c, c, 60, 0, 7); g.fill();
        } else if (kind === 'flash') {
            const grd = g.createRadialGradient(c, c, 4, c, c, 62);
            grd.addColorStop(0, 'rgba(255,255,230,1)'); grd.addColorStop(0.4, 'rgba(255,200,80,0.9)'); grd.addColorStop(1, 'rgba(255,120,40,0)');
            g.fillStyle = grd; g.beginPath(); g.arc(c, c, 62, 0, 7); g.fill();
        } else if (kind === 'mist') {
            const grd = g.createRadialGradient(c, c, 4, c, c, 62);
            grd.addColorStop(0, 'rgba(200,255,225,0.9)'); grd.addColorStop(1, 'rgba(200,255,225,0)');
            g.fillStyle = grd; g.beginPath(); g.arc(c, c, 62, 0, 7); g.fill();
        } else if (kind === 'streak') {
            const grd = g.createLinearGradient(0, 0, w, 0);
            grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd; g.fillRect(0, c - 5, w, 10);
        }
    })),

    /** A soft white ring of foam drawn around each ship at the waterline. */
    wakeRing: () => cached('wakeRing', () => canvasTex(256, 256, (g, w, h) => {
        const c = w / 2, r = prng(77);
        for (let i = 0; i < 70; i++) {
            const a = r() * Math.PI * 2, rr = 78 + r() * 34;
            g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
            g.beginPath(); g.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 5 + r() * 12, 0, 7); g.fill();
        }
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 7;
        g.beginPath(); g.arc(c, c, 92, 0, 7); g.stroke();
    })),
};

export function drawAnchor(g, x, y, s, col) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = s * 0.11; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -s * 0.62, s * 0.13, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(0, -s * 0.48); g.lineTo(0, s * 0.62); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.32, -s * 0.28); g.lineTo(s * 0.32, -s * 0.28); g.stroke();
    g.beginPath(); g.arc(0, s * 0.12, s * 0.55, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
    for (const sx of [-1, 1]) {
        g.beginPath();
        const px = Math.cos(Math.PI * (sx > 0 ? 0.12 : 0.88)) * s * 0.55, py = s * 0.12 + Math.sin(Math.PI * 0.12) * s * 0.55;
        g.moveTo(px + sx * s * 0.1, py - s * 0.14); g.lineTo(px - sx * s * 0.05, py + s * 0.02); g.lineTo(px + sx * s * 0.16, py + s * 0.04);
        g.closePath(); g.fill();
    }
    g.restore();
}

export function drawSkull(g, x, y, s, col) {
    g.save();
    g.translate(x, y);
    // crossbones
    g.strokeStyle = col; g.lineWidth = s * 0.14; g.lineCap = 'round';
    for (const d of [1, -1]) {
        g.beginPath(); g.moveTo(-s * 0.7, s * 0.25 * d + s * 0.35); g.lineTo(s * 0.7, -s * 0.25 * d + s * 0.35); g.stroke();
        for (const e of [-1, 1]) {
            g.fillStyle = col;
            g.beginPath(); g.arc(e * s * 0.72, (-e * d) * s * 0.25 + s * 0.35 - s * 0.08, s * 0.09, 0, 7); g.fill();
            g.beginPath(); g.arc(e * s * 0.72, (-e * d) * s * 0.25 + s * 0.35 + s * 0.08, s * 0.09, 0, 7); g.fill();
        }
    }
    // skull
    g.fillStyle = col;
    g.beginPath(); g.ellipse(0, -s * 0.12, s * 0.42, s * 0.38, 0, 0, 7); g.fill();
    g.fillRect(-s * 0.24, s * 0.12, s * 0.48, s * 0.2);
    const bg = col === '#f4f0e6' ? '#1d1b20' : '#ffffff';
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(-s * 0.16, -s * 0.1, s * 0.11, s * 0.13, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(s * 0.16, -s * 0.1, s * 0.11, s * 0.13, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(0, s * 0.02); g.lineTo(-s * 0.05, s * 0.1); g.lineTo(s * 0.05, s * 0.1); g.closePath(); g.fill();
    for (let i = -2; i <= 2; i++) g.fillRect(i * s * 0.09 - s * 0.012, s * 0.17, s * 0.025, s * 0.15);
    g.restore();
}

export function drawCrown(g, x, y, s, col) {
    g.save();
    g.translate(x, y);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-s, s * 0.6); g.lineTo(-s, -s * 0.2); g.lineTo(-s * 0.5, s * 0.15); g.lineTo(0, -s * 0.5);
    g.lineTo(s * 0.5, s * 0.15); g.lineTo(s, -s * 0.2); g.lineTo(s, s * 0.6); g.closePath(); g.fill();
    g.restore();
}
