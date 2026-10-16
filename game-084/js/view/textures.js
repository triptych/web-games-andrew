// Textures painted in code: the view from the lab window, the cartridge labels, wood grain,
// the console badge and the floor grid. No image files.

import * as THREE from 'three';
import { V } from '../runtime/index.js';

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
// a little seeded random so the skyline is the same every visit
function rng(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Tycho Station at night: the lunar horizon, domes, towers and the Earth hanging overhead. */
export function windowTexture() {
    const [c, g] = canvas(1024, 512);
    const r = rng(7);
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#02030a'); sky.addColorStop(0.55, '#0a0820'); sky.addColorStop(1, '#2a1240');
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 420; i++) {
        const b = r();
        g.fillStyle = `rgba(${200 + b * 55},${200 + b * 55},255,${0.3 + b * 0.7})`;
        g.fillRect(r() * 1024, r() * 330, b > 0.92 ? 2 : 1, b > 0.92 ? 2 : 1);
    }
    // the Earth
    const ex = 760, ey = 120, er = 70;
    const glow = g.createRadialGradient(ex, ey, er * 0.8, ex, ey, er * 1.6);
    glow.addColorStop(0, 'rgba(90,160,255,0.45)'); glow.addColorStop(1, 'rgba(90,160,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(ex, ey, er * 1.6, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(ex, ey, er, 0, 7); g.clip();
    g.fillStyle = '#1d4f9c'; g.fillRect(ex - er, ey - er, er * 2, er * 2);
    g.fillStyle = '#3f8f5a';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(ex - 40 + r() * 80, ey - 40 + r() * 80, 10 + r() * 22, 6 + r() * 14, r() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(ex - 50 + r() * 100, ey - 50 + r() * 100, 14 + r() * 26, 3 + r() * 5, r() * 3, 0, 7); g.fill(); }
    const sh = g.createLinearGradient(ex - er, 0, ex + er, 0);
    sh.addColorStop(0, 'rgba(0,0,10,0)'); sh.addColorStop(0.55, 'rgba(0,0,10,0.1)'); sh.addColorStop(1, 'rgba(0,0,10,0.85)');
    g.fillStyle = sh; g.fillRect(ex - er, ey - er, er * 2, er * 2);
    g.restore();
    // far ridges
    for (const [y0, col] of [[360, '#1b1630'], [395, '#141024']]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, 512);
        for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.011 + y0) * 18 + r() * 8);
        g.lineTo(1024, 512); g.fill();
    }
    // the station: domes and towers with lit windows and a few neon signs
    for (let i = 0; i < 26; i++) {
        const x = r() * 1024, w = 14 + r() * 40, h = 30 + r() * 150;
        g.fillStyle = '#0c0a1a'; g.fillRect(x, 430 - h, w, h + 90);
        for (let y = 430 - h + 6; y < 470; y += 8) for (let xx = x + 3; xx < x + w - 3; xx += 6) {
            if (r() < 0.35) { g.fillStyle = r() < 0.7 ? 'rgba(255,200,120,0.85)' : 'rgba(120,230,255,0.85)'; g.fillRect(xx, y, 2, 3); }
        }
        if (r() < 0.25) { g.fillStyle = r() < 0.5 ? '#ff4fd8' : '#5ff0ff'; g.fillRect(x + 2, 430 - h - 4, w - 4, 3); }
    }
    for (let i = 0; i < 7; i++) {
        const x = r() * 1024, rr = 30 + r() * 60;
        const dg = g.createRadialGradient(x, 470, rr * 0.2, x, 470, rr);
        dg.addColorStop(0, 'rgba(120,220,255,0.35)'); dg.addColorStop(1, 'rgba(60,90,160,0.15)');
        g.fillStyle = dg; g.beginPath(); g.arc(x, 470, rr, Math.PI, 0); g.fill();
        g.strokeStyle = 'rgba(160,240,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    }
    g.fillStyle = '#07060f'; g.fillRect(0, 468, 1024, 44);
    return tex(c);
}

export function woodTexture() {
    const [c, g] = canvas(256, 64);
    const r = rng(3);
    g.fillStyle = '#5b3920'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(${30 + r() * 40},${15 + r() * 20},5,${0.25 + r() * 0.35})`;
        g.lineWidth = 0.5 + r() * 2;
        g.beginPath();
        const y = r() * 64;
        g.moveTo(0, y);
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
        g.stroke();
    }
    return tex(c);
}

/** A faint cyan grid for the lab floor. */
export function gridTexture() {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#07090f'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(95,240,255,0.18)'; g.lineWidth = 2;
    g.strokeRect(1, 1, 254, 254);
    g.strokeStyle = 'rgba(95,240,255,0.06)'; g.lineWidth = 1;
    for (let i = 32; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    return t;
}

/** The console's front badge. */
export function badgeTexture() {
    const [c, g] = canvas(512, 64);
    g.fillStyle = '#111'; g.fillRect(0, 0, 512, 64);
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, '#f6f0d8'); grd.addColorStop(1, '#b9a777');
    g.fillStyle = grd;
    g.font = 'italic 900 40px Orbitron, Arial Black, sans-serif';
    g.fillText('VESTA-8', 16, 46);
    g.fillStyle = '#ff8a2a'; g.fillRect(260, 20, 230, 6);
    g.fillStyle = '#ffd23f'; g.fillRect(260, 30, 230, 6);
    g.fillStyle = '#e8394d'; g.fillRect(260, 40, 230, 6);
    g.font = '12px monospace'; g.fillStyle = '#9a9a9a'; g.fillText('HALCYON ELECTRONICS  ·  8-BIT VIDEO COMPUTER SYSTEM', 16, 60);
    return tex(c);
}

/** A cartridge label: the cart's colour, its title, its year and its own label sprite, pixel-perfect. */
export function labelTexture(mission, state, cart) {
    const [c, g] = canvas(128, 160);
    g.imageSmoothingEnabled = false;
    const locked = state === 'locked';
    g.fillStyle = locked ? '#1a1c24' : '#0e0e14'; g.fillRect(0, 0, 128, 160);
    g.fillStyle = locked ? '#333744' : mission.color; g.fillRect(0, 0, 128, 30);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 26, 128, 4);
    g.fillStyle = '#0b0b14';
    g.font = 'bold 14px Orbitron, Arial, sans-serif';
    g.fillText(locked ? 'CORRUPTED' : 'VESTA-8', 8, 20);
    if (!locked && cart) {
        // the label sprite, from the cart's own sprite sheet
        const sheet = V.decodeSheet(cart.sprites);
        const n = cart.label | 0, ox = (n % 8) * 8, oy = Math.floor(n / 8) * 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const v = sheet[(oy + y) * 64 + ox + x];
            if (!v) continue;
            g.fillStyle = V.PALETTE[v];
            g.fillRect(32 + x * 8, 40 + y * 8, 8, 8);
        }
    } else {
        const r = rng(mission.n * 31);
        for (let i = 0; i < 80; i++) { g.fillStyle = V.PALETTE[1 + Math.floor(r() * 15)]; g.globalAlpha = 0.5; g.fillRect(24 + Math.floor(r() * 10) * 8, 40 + Math.floor(r() * 8) * 8, 8, 8); }
        g.globalAlpha = 1;
    }
    g.fillStyle = locked ? '#666b7a' : '#f4f1e1';
    g.font = 'bold 13px Orbitron, Arial, sans-serif';
    const title = mission.final && state !== 'locked' && cart && cart.title !== 'UNTITLED' ? cart.title : mission.final ? 'MY GAME' : mission.title;
    g.fillText(title.slice(0, 13), 8, 124);
    g.fillStyle = locked ? '#4b5060' : '#9fb4d8';
    g.font = '11px monospace';
    g.fillText(mission.final ? 'HANDWRITTEN' : `${mission.year}  ${state === 'done' ? '✓ RESTORED' : ''}`, 8, 144);
    return tex(c);
}
