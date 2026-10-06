/**
 * textures.js — every texture in Worldroot is drawn here on a canvas at boot.
 * No image files.
 */

import * as THREE from 'three';

function canvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}

function tex(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return t;
}

// A tiny seeded rng so textures look the same every load.
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Soft radial glow, white. Tint it in the material. */
export function glowTexture() {
    const [c, g] = canvas(128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return tex(c, false);
}

/**
 * A cluster of leaves on a transparent background, in greyscale-ish green so a
 * season tint can recolour it. Alpha-tested in the leaf shader.
 * Four variants packed in a 2×2 atlas.
 */
export function leafAtlas() {
    const S = 256;
    const [c, g] = canvas(S * 2);
    const r = rng(77);
    for (let v = 0; v < 4; v++) {
        const ox = (v % 2) * S, oy = Math.floor(v / 2) * S;
        const n = 14 + Math.floor(r() * 6);
        for (let i = 0; i < n; i++) {
            const a = r() * Math.PI * 2;
            const d = Math.pow(r(), 0.7) * S * 0.33;
            const x = ox + S / 2 + Math.cos(a) * d;
            const y = oy + S / 2 + Math.sin(a) * d;
            const len = S * (0.13 + r() * 0.09);
            const wid = len * (0.42 + r() * 0.15);
            const rot = a + (r() - 0.5) * 1.2;
            g.save();
            g.translate(x, y);
            g.rotate(rot);
            // leaf body: brightness encodes depth so the shader can shade it
            const b = 120 + Math.floor(r() * 135);
            const grd = g.createLinearGradient(-len / 2, 0, len / 2, 0);
            grd.addColorStop(0, `rgb(${b * 0.55 | 0},${b * 0.8 | 0},${b * 0.55 | 0})`);
            grd.addColorStop(1, `rgb(${b},${b},${b * 0.85 | 0})`);
            g.fillStyle = grd;
            g.beginPath();
            g.moveTo(-len / 2, 0);
            g.quadraticCurveTo(0, -wid, len / 2, 0);
            g.quadraticCurveTo(0, wid, -len / 2, 0);
            g.fill();
            // midrib
            g.strokeStyle = `rgba(255,255,230,0.55)`;
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(-len / 2, 0);
            g.lineTo(len / 2 * 0.9, 0);
            g.stroke();
            g.restore();
        }
    }
    const t = tex(c);
    return t;
}

/** Bark: vertical ridges with knots, greyscale; tiled around branches. */
export function barkTexture() {
    const W = 256, H = 512;
    const [c, g] = canvas(W, H);
    const r = rng(11);
    g.fillStyle = '#6a5a4c';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
        const x = r() * W;
        const w = 3 + r() * 10;
        const shade = 40 + r() * 70;
        g.strokeStyle = `rgba(${shade * 0.7 | 0},${shade * 0.6 | 0},${shade * 0.5 | 0},0.65)`;
        g.lineWidth = w;
        g.beginPath();
        let px = x;
        g.moveTo(px, -10);
        for (let y = 0; y <= H + 20; y += 24) {
            px += (r() - 0.5) * 9;
            g.lineTo(px, y);
        }
        g.stroke();
        // repeat at the seam so it tiles horizontally
        if (x < 20 || x > W - 20) {
            g.save(); g.translate(x < 20 ? W : -W, 0); g.stroke(); g.restore();
        }
    }
    for (let i = 0; i < 14; i++) {
        const x = r() * W, y = r() * H, rr = 6 + r() * 14;
        const grd = g.createRadialGradient(x, y, 0, x, y, rr);
        grd.addColorStop(0, 'rgba(40,30,22,0.9)');
        grd.addColorStop(0.6, 'rgba(70,56,44,0.6)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(x, y, rr * 0.7, rr, 0, 0, Math.PI * 2); g.fill();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/** Glowing rune strokes on black: the light veins in the bark and the standing stones. */
export function runeTexture() {
    const W = 256, H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const r = rng(5);
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    // flowing veins
    for (let i = 0; i < 7; i++) {
        let x = r() * W;
        g.lineWidth = 2 + r() * 3;
        g.beginPath();
        g.moveTo(x, 0);
        for (let y = 0; y <= H; y += 16) {
            x += Math.sin(y * 0.03 + i) * 4 + (r() - 0.5) * 6;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    // small runes
    for (let i = 0; i < 16; i++) {
        const x = 20 + r() * (W - 40), y = 20 + r() * (H - 40), s = 8 + r() * 8;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y - s); g.lineTo(x, y + s);
        const k = Math.floor(r() * 4);
        if (k === 0) { g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y - s * 0.3); }
        if (k === 1) { g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y - s * 0.6); }
        if (k === 2) { g.moveTo(x, y); g.lineTo(x + s * 0.7, y + s * 0.5); g.moveTo(x, y); g.lineTo(x - s * 0.7, y + s * 0.5); }
        if (k === 3) { g.moveTo(x, y - s * 0.4); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 0.4); }
        g.stroke();
    }
    const t = tex(c, false);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/** Winged sprite / moth sheet: 0 = dew sprite, 1 = lantern moth, 2 = foxfire, 3 = petal. */
export function critterAtlas() {
    const S = 128;
    const [c, g] = canvas(S * 2);
    // dew sprite: orb with dragonfly wings
    {
        const ox = 0, oy = 0;
        g.save(); g.translate(ox + S / 2, oy + S / 2);
        g.fillStyle = 'rgba(200,240,255,0.55)';
        for (const s of [-1, 1]) {
            g.beginPath(); g.ellipse(s * 26, -10, 26, 11, s * -0.5, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(s * 22, 10, 20, 8, s * 0.5, 0, Math.PI * 2); g.fill();
        }
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, 22);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.4, '#bff4ff'); grd.addColorStop(1, 'rgba(120,220,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    // moth: wide soft wings with eye spots
    {
        g.save(); g.translate(S + S / 2, S / 2);
        for (const s of [-1, 1]) {
            const grd = g.createRadialGradient(s * 24, -4, 2, s * 24, -4, 34);
            grd.addColorStop(0, '#fff7d0'); grd.addColorStop(0.5, '#ffd27a'); grd.addColorStop(1, 'rgba(255,170,80,0)');
            g.fillStyle = grd;
            g.beginPath(); g.ellipse(s * 24, -6, 32, 24, s * -0.35, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(s * 18, 18, 18, 14, s * 0.4, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.9)';
            g.beginPath(); g.arc(s * 26, -6, 5, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#fff3c4';
        g.beginPath(); g.ellipse(0, 4, 4, 18, 0, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    // foxfire: a teardrop flame
    {
        g.save(); g.translate(S / 2, S + S / 2);
        const grd = g.createRadialGradient(0, 10, 2, 0, 4, 46);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, '#9ff0ff'); grd.addColorStop(0.7, 'rgba(60,140,255,0.5)'); grd.addColorStop(1, 'rgba(40,80,255,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, -50);
        g.bezierCurveTo(26, -10, 30, 30, 0, 40);
        g.bezierCurveTo(-30, 30, -26, -10, 0, -50);
        g.fill();
        g.restore();
    }
    // petal
    {
        g.save(); g.translate(S + S / 2, S + S / 2);
        const grd = g.createLinearGradient(0, -40, 0, 40);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#d8d8d8');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, -42);
        g.bezierCurveTo(34, -20, 30, 30, 0, 42);
        g.bezierCurveTo(-30, 30, -34, -20, 0, -42);
        g.fill();
        g.restore();
    }
    return tex(c);
}

/** Fern frond for ground cover (alpha-tested). */
export function fernTexture() {
    const S = 256;
    const [c, g] = canvas(S);
    g.translate(S / 2, S);
    g.strokeStyle = '#d8ecc8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -S * 0.5, 0, -S * 0.95); g.stroke();
    for (let i = 1; i < 18; i++) {
        const t = i / 18;
        const y = -S * 0.95 * t;
        const x = Math.sin(t * Math.PI) * 6;
        const len = (1 - t) * 70 + 12;
        for (const s of [-1, 1]) {
            g.fillStyle = `rgb(${150 + t * 80 | 0},${200 + t * 40 | 0},${140 + t * 60 | 0})`;
            g.beginPath();
            g.ellipse(x + s * len * 0.5, y + len * 0.12, len * 0.5, len * 0.12, s * -0.25, 0, Math.PI * 2);
            g.fill();
        }
    }
    return tex(c);
}

/** Four-pointed star flare for the golden wisp. */
export function starTexture() {
    const S = 128;
    const [c, g] = canvas(S);
    g.translate(S / 2, S / 2);
    for (const [len, w, a] of [[62, 5, 0], [62, 5, Math.PI / 2], [34, 3, Math.PI / 4], [34, 3, -Math.PI / 4]]) {
        g.save();
        g.rotate(a);
        const grd = g.createLinearGradient(-len, 0, len, 0);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.5, 'rgba(255,255,255,1)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(-len, 0); g.quadraticCurveTo(0, -w, len, 0); g.quadraticCurveTo(0, w, -len, 0);
        g.fill();
        g.restore();
    }
    return tex(c, false);
}
