// Canvas-generated textures: wood, plaster-and-timber, the shield's painted
// wyrm, the ground map, glow and flame sprites. No image files.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = [1, 1], srgb = true } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 4;
    return t;
}

/** Oak planks with grain and knots. Returns { map, bump }. */
export function woodTexture({ w = 512, h = 512, planks = 4, base = [92, 58, 32], seed = 7, vertical = false } = {}) {
    const rnd = mulberry32(seed);
    const [c, g] = canvas(w, h);
    const [bc, bg] = canvas(w, h);
    const ph = h / planks;
    for (let i = 0; i < planks; i++) {
        const tint = 0.8 + rnd() * 0.35;
        const y0 = i * ph;
        g.fillStyle = `rgb(${base[0] * tint | 0},${base[1] * tint | 0},${base[2] * tint | 0})`;
        g.fillRect(0, y0, w, ph);
        bg.fillStyle = '#888'; bg.fillRect(0, y0, w, ph);
        // grain
        for (let k = 0; k < 70; k++) {
            const yy = y0 + rnd() * ph;
            const a = 0.05 + rnd() * 0.12;
            g.strokeStyle = rnd() < 0.5 ? `rgba(30,15,5,${a})` : `rgba(255,220,170,${a * 0.6})`;
            g.lineWidth = 0.6 + rnd() * 1.6;
            g.beginPath();
            const amp = 1 + rnd() * 3, fr = 0.005 + rnd() * 0.02, ph0 = rnd() * 6;
            for (let x = 0; x <= w; x += 8) { const y = yy + Math.sin(x * fr + ph0) * amp; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
            g.stroke();
            bg.strokeStyle = `rgba(0,0,0,${a * 1.5})`; bg.lineWidth = g.lineWidth; bg.stroke();
        }
        // knots
        for (let k = 0; k < 2; k++) if (rnd() < 0.6) {
            const kx = rnd() * w, ky = y0 + ph * (0.3 + rnd() * 0.4), r = 4 + rnd() * 8;
            for (let j = 5; j > 0; j--) { g.strokeStyle = `rgba(40,20,8,${0.15 + j * 0.05})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * j * 0.5, r * j * 0.25, 0, 0, Math.PI * 2); g.stroke(); }
            g.fillStyle = 'rgba(30,14,4,0.7)'; g.beginPath(); g.ellipse(kx, ky, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); g.fill();
        }
        // seams
        g.fillStyle = 'rgba(10,5,2,0.85)'; g.fillRect(0, y0, w, 2);
        bg.fillStyle = '#000'; bg.fillRect(0, y0, w, 3);
        // end joints
        const jx = rnd() * w;
        g.fillRect(jx, y0, 2, ph); bg.fillRect(jx, y0, 3, ph);
    }
    if (vertical) { for (const cc of [c, bc]) { const [r, rg] = canvas(h, w); rg.translate(h, 0); rg.rotate(Math.PI / 2); rg.drawImage(cc, 0, 0); cc.width = h; cc.height = w; cc.getContext('2d').drawImage(r, 0, 0); } }
    return { map: tex(c), bump: tex(bc, { srgb: false }) };
}

/** Wrapped leather for sword grips. */
export function leatherTexture() {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#3a2214'; g.fillRect(0, 0, 128, 128);
    for (let i = -128; i < 256; i += 16) {
        g.strokeStyle = '#1a0e06'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, i); g.lineTo(128, i + 40); g.stroke();
        g.strokeStyle = 'rgba(255,200,150,0.12)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, i + 4); g.lineTo(128, i + 44); g.stroke();
    }
    return tex(c, { repeat: [1, 3] });
}

/** The painted shield face: jade field, gold wyrm. */
export function shieldTexture() {
    const S = 512;
    const [c, g] = canvas(S, S);
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#1d6b47'); grad.addColorStop(0.5, '#0f4a30'); grad.addColorStop(1, '#0a3020');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    // quartering
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(S / 2, 0, S / 2, S / 2); g.fillRect(0, S / 2, S / 2, S / 2);
    // weathering
    const rnd = mulberry32(11);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,200'},${rnd() * 0.05})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 6, 1 + rnd() * 2); }
    // the wyrm: a coiled S with wings, in gold
    g.save(); g.translate(S / 2, S / 2 - 10);
    const gold = g.createLinearGradient(-150, -150, 150, 150);
    gold.addColorStop(0, '#fff0b0'); gold.addColorStop(0.45, '#e2b54e'); gold.addColorStop(1, '#8a5f17');
    g.fillStyle = gold; g.strokeStyle = '#3a2508'; g.lineWidth = 6; g.lineJoin = 'round';
    // wings
    for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, -40);
        g.quadraticCurveTo(s * 70, -150, s * 175, -120);
        g.lineTo(s * 150, -90); g.lineTo(s * 165, -60); g.lineTo(s * 130, -45); g.lineTo(s * 140, -15); g.lineTo(s * 95, -10);
        g.quadraticCurveTo(s * 50, -20, 0, 10);
        g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(58,37,8,0.6)'; g.lineWidth = 3;
        for (const [ex, ey] of [[150, -90], [130, -45], [95, -10]]) { g.beginPath(); g.moveTo(s * 20, -30); g.lineTo(s * ex, ey); g.stroke(); }
        g.strokeStyle = '#3a2508'; g.lineWidth = 6;
    }
    // body: S-curve
    g.beginPath();
    g.moveTo(-20, -95);
    g.bezierCurveTo(60, -95, 70, -20, 10, 0);
    g.bezierCurveTo(-60, 25, -70, 100, 0, 120);
    g.bezierCurveTo(50, 135, 90, 110, 100, 80);
    g.lineTo(80, 78);
    g.bezierCurveTo(70, 100, 40, 108, 5, 98);
    g.bezierCurveTo(-35, 85, -30, 40, 25, 18);
    g.bezierCurveTo(95, -10, 75, -120, -15, -118);
    g.closePath(); g.fill(); g.stroke();
    // head
    g.beginPath();
    g.moveTo(-15, -118); g.lineTo(-70, -128); g.lineTo(-88, -112); g.lineTo(-60, -100); g.lineTo(-20, -95); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-30, -122); g.lineTo(-20, -150); g.lineTo(-10, -118); g.fill(); g.stroke();
    g.fillStyle = '#39d98f'; g.beginPath(); g.arc(-48, -114, 6, 0, Math.PI * 2); g.fill();
    // flame from mouth
    g.fillStyle = 'rgba(57,217,143,0.85)';
    g.beginPath(); g.moveTo(-88, -112); g.quadraticCurveTo(-130, -130, -150, -100); g.quadraticCurveTo(-125, -112, -110, -95); g.quadraticCurveTo(-120, -80, -140, -70); g.quadraticCurveTo(-100, -80, -85, -105); g.fill();
    g.restore();
    return tex(c);
}

/** Tudor plaster with timber beams. */
export function plasterTexture(seed = 3) {
    const rnd = mulberry32(seed);
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#d9cdb2'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '90,70,40' : '255,250,235'},${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 5, 2 + rnd() * 5); }
    g.fillStyle = '#3a2414';
    g.fillRect(0, 0, 256, 14); g.fillRect(0, 242, 256, 14); g.fillRect(0, 0, 14, 256); g.fillRect(242, 0, 14, 256);
    g.fillRect(121, 0, 14, 256);
    g.save(); g.translate(128, 128);
    g.lineWidth = 12; g.strokeStyle = '#3a2414';
    g.beginPath(); g.moveTo(-120, 120); g.lineTo(-8, -120); g.moveTo(120, 120); g.lineTo(8, -120); g.stroke();
    g.restore();
    return tex(c);
}

export function stoneTexture(seed = 5) {
    const rnd = mulberry32(seed);
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#4a4540'; g.fillRect(0, 0, 256, 256);
    const rows = 8, rh = 256 / rows;
    for (let r = 0; r < rows; r++) {
        let x = r % 2 ? -20 : 0;
        while (x < 256) {
            const bw = 30 + rnd() * 30; const v = 90 + rnd() * 50;
            g.fillStyle = `rgb(${v},${v * 0.95 | 0},${v * 0.88 | 0})`;
            g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
            g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, r * rh + 2, bw - 4, 3);
            x += bw;
        }
    }
    return tex(c);
}

export function thatchTexture(seed = 9) {
    const rnd = mulberry32(seed);
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#7a5a2a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
        const x = rnd() * 256, y = rnd() * 256, l = 8 + rnd() * 16;
        g.strokeStyle = `rgba(${rnd() < 0.5 ? '40,25,8' : '220,180,100'},${0.15 + rnd() * 0.3})`;
        g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + l); g.stroke();
    }
    for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(0, y, 256, 3); }
    return tex(c);
}

/** Ground map for the whole world disc. f(x, z) -> paint. size = metres covered. */
export function groundTexture(size, features) {
    const N = 1024;
    const [c, g] = canvas(N, N);
    const rnd = mulberry32(21);
    const toPx = (x, z) => [(x / size + 0.5) * N, (z / size + 0.5) * N];
    const m = N / size;
    // grass base with variation
    g.fillStyle = '#3d5a26'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) {
        const v = rnd();
        g.fillStyle = v < 0.33 ? 'rgba(80,110,40,0.25)' : v < 0.66 ? 'rgba(40,60,22,0.3)' : 'rgba(110,120,50,0.18)';
        const r = 2 + rnd() * 10;
        g.beginPath(); g.arc(rnd() * N, rnd() * N, r, 0, Math.PI * 2); g.fill();
    }
    // forest floor darkening outside radius
    const grad = g.createRadialGradient(N / 2, N / 2, features.forestR * m * 0.9, N / 2, N / 2, features.forestR * m * 1.3);
    grad.addColorStop(0, 'rgba(20,28,12,0)'); grad.addColorStop(1, 'rgba(26,30,14,0.75)');
    g.fillStyle = grad; g.fillRect(0, 0, N, N);
    // paths
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of features.paths) {
        g.strokeStyle = p.color || '#7a6243'; g.lineWidth = p.w * m;
        g.beginPath(); p.pts.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        g.strokeStyle = 'rgba(60,45,25,0.5)'; g.lineWidth = p.w * m * 0.5; g.stroke();
    }
    // patches (square, fields, graveyard)
    for (const pt of features.patches) {
        const [px, py] = toPx(pt.x, pt.z);
        g.fillStyle = pt.color;
        g.beginPath(); if (pt.rect) g.rect(px - pt.rect[0] * m / 2, py - pt.rect[1] * m / 2, pt.rect[0] * m, pt.rect[1] * m); else g.arc(px, py, pt.r * m, 0, Math.PI * 2); g.fill();
        if (pt.cobble) {
            for (let i = 0; i < 1400; i++) {
                const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * pt.r * m;
                const v = 100 + rnd() * 60;
                g.fillStyle = `rgb(${v},${v * 0.92 | 0},${v * 0.82 | 0})`;
                g.fillRect(px + Math.cos(a) * rr, py + Math.sin(a) * rr, 2 + rnd() * 2, 2 + rnd() * 2);
            }
        }
        if (pt.rows) {
            g.strokeStyle = 'rgba(60,45,20,0.5)'; g.lineWidth = 2;
            for (let i = -pt.rect[1] / 2; i < pt.rect[1] / 2; i += 1.6) { g.beginPath(); g.moveTo(px - pt.rect[0] * m / 2, py + i * m); g.lineTo(px + pt.rect[0] * m / 2, py + i * m); g.stroke(); }
        }
    }
    return tex(c);
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return tex(c);
}

export function smokeTexture() {
    const [c, g] = canvas(64, 64);
    const rnd = mulberry32(4);
    for (let i = 0; i < 14; i++) {
        const x = 20 + rnd() * 24, y = 20 + rnd() * 24, r = 8 + rnd() * 14;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    return tex(c);
}

/** A painted signboard with text. */
export function signTexture(text, { w = 256, h = 96, bg = '#3a2414', fg = '#e8c870', font = 'bold 34px Cinzel, Georgia, serif' } = {}) {
    const [c, g] = canvas(w, h);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1a0e06'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 34));
    return tex(c);
}

export function noticeTexture() {
    const [c, g] = canvas(256, 192);
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 256, 192);
    const rnd = mulberry32(8);
    for (let i = 0; i < 9; i++) {
        const x = 12 + rnd() * 180, y = 10 + rnd() * 120, w = 50 + rnd() * 40, h = 40 + rnd() * 30;
        g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((rnd() - 0.5) * 0.2);
        g.fillStyle = `hsl(40, 45%, ${70 + rnd() * 15}%)`; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = 'rgba(40,25,10,0.55)';
        for (let l = 0; l < 5; l++) g.fillRect(-w / 2 + 5, -h / 2 + 7 + l * 7, w * (0.4 + rnd() * 0.45), 2);
        g.fillStyle = '#a02a1a'; g.beginPath(); g.arc(0, -h / 2 + 3, 3, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    return tex(c);
}
