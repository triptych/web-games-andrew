// Painted character portraits for the dialogue box, dossiers and squad cards:
// flat-shaded 80s TV-credits busts over a sunset, all drawn on a canvas.

import { CREW } from './sim/data.js';

const EXTRA = {
    dana: { jacket: '#f4a8c8', shirt: '#ffffff', skin: '#8a5a40', hair: '#1a0e0a', hairStyle: 'bob', glasses: null, earrings: true, headset: true, bg: ['#2a1a4a', '#ff8ac8'] },
    briggs: { jacket: '#5a5a68', shirt: '#d8e0f0', skin: '#e0b090', hair: '#c8c8d0', hairStyle: 'side', glasses: null, tie: '#8a1a2a', bg: ['#1a1a2a', '#6a7a9a'], moustache: true },
    benny: { jacket: '#c8a878', shirt: '#2a8ac8', skin: '#c88a5a', hair: '#2a1a10', hairStyle: 'curly', glasses: null, moustache: true, bg: ['#3a2a1a', '#ffb06a'] },
    nico: { jacket: '#ffe45c', shirt: '#ff3fa4', skin: '#d09870', hair: '#2a1408', hairStyle: 'slick', glasses: 'shades', chain: true, bg: ['#2a0a2a', '#ff3fa4'] },
    eddie: { jacket: '#c8e0ff', shirt: '#c8e0ff', skin: '#e8b898', hair: '#8a7a6a', hairStyle: 'side', glasses: 'round', bg: ['#1a3a4a', '#8af0e0'] },
    shark: { jacket: '#8a94a8', shirt: '#101820', skin: '#e0b090', hair: '#d8d8e0', hairStyle: 'side', glasses: 'shades', moustache: true, bg: ['#2a0008', '#ff2e3e'] },
};
const BGS = { rico: ['#0a2a3a', '#2ff2e0'], lola: ['#3a0a2a', '#ff4fa8'], doc: ['#0a2a1a', '#8dff8a'], dex: ['#3a1a0a', '#ff8a3a'], jinx: ['#1a0a3a', '#b44cff'], tito: ['#0a1a3a', '#4fd8ff'], roxy: ['#3a2a0a', '#ffe45c'] };

const cache = new Map();

export function portrait(key, size = 256) {
    const k = `${key}|${size}`;
    if (cache.has(k)) return cache.get(k);
    const look = CREW[key]?.look ?? EXTRA[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(size / 256, size / 256);
    if (!look) { g.fillStyle = '#111'; g.fillRect(0, 0, 256, 256); }
    else paint(g, look, BGS[key] ?? look.bg ?? ['#1a0a2a', '#ff3fa4'], key);
    const url = c.toDataURL();
    cache.set(k, url);
    return url;
}

function paint(g, L, bg, key) {
    // sunset backdrop with a striped sun and a palm silhouette
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, bg[0]); grd.addColorStop(0.75, bg[1]); grd.addColorStop(1, bg[0]);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.save();
    g.globalAlpha = 0.55;
    const sg = g.createLinearGradient(0, 70, 0, 200);
    sg.addColorStop(0, '#fff07a'); sg.addColorStop(1, '#ff3fa4');
    g.fillStyle = sg;
    g.beginPath(); g.arc(186, 140, 62, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let y = 140; y < 210; y += 11) g.fillRect(100, y, 200, 3 + (y - 140) * 0.06);
    g.restore();
    g.fillStyle = 'rgba(10,0,20,0.55)';
    g.fillRect(30, 70, 7, 190);
    for (let k = 0; k < 6; k++) {
        g.save(); g.translate(33, 72); g.rotate(-1.2 + k * 0.5);
        g.beginPath(); g.ellipse(26, 0, 30, 7, 0.25, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 256, 1.5);

    const ink = 'rgba(20,6,20,0.85)';
    g.lineWidth = 3; g.strokeStyle = ink; g.lineJoin = 'round';
    // shoulders / jacket
    const big = key === 'tito';
    g.fillStyle = L.jacket;
    g.beginPath();
    g.moveTo(big ? 8 : 26, 256); g.quadraticCurveTo(big ? 18 : 34, 196, 98, 188); g.lineTo(158, 188); g.quadraticCurveTo(big ? 238 : 222, 196, big ? 248 : 230, 256); g.closePath();
    g.fill(); g.stroke();
    // shirt
    g.fillStyle = L.shirt;
    g.beginPath(); g.moveTo(104, 190); g.lineTo(152, 190); g.lineTo(128, 256); g.closePath(); g.fill(); g.stroke();
    if (L.tie) { g.fillStyle = L.tie; g.beginPath(); g.moveTo(122, 196); g.lineTo(134, 196); g.lineTo(138, 250); g.lineTo(128, 256); g.lineTo(118, 250); g.closePath(); g.fill(); }
    // lapels
    g.fillStyle = shade(L.jacket, 0.8);
    g.beginPath(); g.moveTo(98, 190); g.lineTo(110, 190); g.lineTo(126, 248); g.lineTo(104, 220); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(158, 190); g.lineTo(146, 190); g.lineTo(130, 248); g.lineTo(152, 220); g.closePath(); g.fill(); g.stroke();
    if (L.chain) { g.strokeStyle = '#ffd040'; g.lineWidth = 4; g.beginPath(); g.arc(128, 196, 26, 0.3, Math.PI - 0.3); g.stroke(); g.lineWidth = 3; g.strokeStyle = ink; }
    if (L.headset) { g.strokeStyle = '#202028'; g.lineWidth = 5; g.beginPath(); g.arc(128, 112, 58, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = '#202028'; g.fillRect(64, 108, 12, 26); g.beginPath(); g.moveTo(70, 132); g.quadraticCurveTo(80, 170, 112, 162); g.stroke(); g.lineWidth = 3; g.strokeStyle = ink; }
    // neck
    g.fillStyle = shade(L.skin, 0.85);
    g.fillRect(112, 160, 32, 32); g.strokeRect(112, 160, 32, 32);
    // back hair (long styles)
    g.fillStyle = L.hair;
    if (L.hairStyle === 'big') { g.beginPath(); g.ellipse(128, 120, 86, 82, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (L.hairStyle === 'pony' || L.hairStyle === 'bob') { g.beginPath(); g.ellipse(128, 118, 60, 66, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (L.hairStyle === 'bob') { g.fillRect(70, 110, 116, 52); g.strokeRect(70, 110, 116, 52); }
    // head
    const headW = big ? 58 : 50, headH = 60;
    g.fillStyle = L.skin;
    g.beginPath(); g.ellipse(128, 118, headW, headH, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // ears
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * (headW + 2), 122, 8, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    if (L.earrings) { g.fillStyle = '#ffe45c'; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * (headW + 2), 142, 7, 0, 7); g.fill(); g.stroke(); } }
    // stubble / beard
    if (L.stubble) { g.fillStyle = 'rgba(40,20,10,0.22)'; g.beginPath(); g.ellipse(128, 150, 40, 24, 0, 0, Math.PI); g.fill(); }
    if (L.beard) { g.fillStyle = L.hair; g.beginPath(); g.ellipse(128, 148, headW - 2, 34, 0, 0.05, Math.PI - 0.05); g.fill(); g.stroke(); g.fillStyle = L.skin; g.beginPath(); g.ellipse(128, 152, 18, 8, 0, 0, Math.PI * 2); g.fill(); }
    // eyes / glasses
    const ey = 114;
    if (!L.glasses || L.glasses === 'round') {
        for (const s of [-1, 1]) {
            g.fillStyle = '#fff'; g.beginPath(); g.ellipse(128 + s * 20, ey, 10, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
            g.fillStyle = '#1a1420'; g.beginPath(); g.arc(128 + s * 20 + 2, ey + 1, 4.5, 0, 7); g.fill();
            g.strokeStyle = shade(L.hair, 0.7); g.lineWidth = 5; g.beginPath(); g.moveTo(128 + s * 10, ey - 15); g.lineTo(128 + s * 32, ey - 16 + (key === 'briggs' || key === 'shark' ? s * 0 - 4 : 0)); g.stroke();
            g.lineWidth = 3; g.strokeStyle = ink;
        }
        if (L.glasses === 'round') { g.strokeStyle = '#3a2a20'; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 20, ey, 15, 0, 7); g.stroke(); } g.strokeStyle = ink; }
    } else {
        g.save();
        for (const s of [-1, 1]) {
            const gg = g.createLinearGradient(0, ey - 14, 0, ey + 14);
            gg.addColorStop(0, '#2a1a3a'); gg.addColorStop(0.55, '#08040c'); gg.addColorStop(1, L.glasses === 'visor' ? '#ff8a3a' : '#ff3fa4');
            g.fillStyle = gg;
            g.beginPath();
            if (L.glasses === 'aviator') g.ellipse(128 + s * 21, ey + 2, 18, 14, s * 0.15, 0, Math.PI * 2);
            else if (L.glasses === 'star') starPath(g, 128 + s * 21, ey, 18);
            else if (L.glasses === 'visor') g.rect(s < 0 ? 72 : 128, ey - 10, 56, 22);
            else g.rect(128 + s * 21 - 19, ey - 10, 38, 20);
            g.fill(); g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(128 + s * 21 - 10, ey - 6, 8, 3);
        }
        g.restore();
    }
    // nose & mouth
    g.strokeStyle = shade(L.skin, 0.6); g.lineWidth = 3;
    g.beginPath(); g.moveTo(128, ey + 8); g.quadraticCurveTo(122, ey + 26, 132, ey + 28); g.stroke();
    if (L.moustache) { g.fillStyle = L.hair; g.beginPath(); g.ellipse(128, ey + 37, 18, 6, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#6a2a2a'; g.lineWidth = 3.5;
    g.beginPath();
    if (key === 'briggs' || key === 'shark' || key === 'nico') { g.moveTo(114, ey + 46); g.quadraticCurveTo(130, ey + 42, 142, ey + 47); }
    else g.arc(128, ey + 34, 16, 0.4, Math.PI - 0.4);
    g.stroke();
    if (key === 'roxy' || key === 'lola') { g.fillStyle = '#d0205a'; g.beginPath(); g.ellipse(128, ey + 44, 10, 4, 0, 0, Math.PI * 2); g.fill(); }
    // hair on top
    g.fillStyle = L.hair; g.strokeStyle = ink; g.lineWidth = 3;
    switch (L.hairStyle) {
        case 'swept': g.beginPath(); g.moveTo(74, 112); g.quadraticCurveTo(70, 50, 130, 52); g.quadraticCurveTo(190, 50, 182, 104); g.quadraticCurveTo(160, 70, 120, 82); g.quadraticCurveTo(92, 86, 74, 112); g.fill(); g.stroke(); break;
        case 'pony': g.beginPath(); g.moveTo(76, 110); g.quadraticCurveTo(78, 52, 128, 54); g.quadraticCurveTo(180, 52, 180, 110); g.quadraticCurveTo(150, 72, 76, 110); g.fill(); g.stroke(); g.fillStyle = '#ff3fa4'; g.beginPath(); g.arc(172, 70, 9, 0, 7); g.fill(); g.stroke(); break;
        case 'bun': g.beginPath(); g.arc(128, 52, 22, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(76, 110); g.quadraticCurveTo(80, 56, 128, 58); g.quadraticCurveTo(176, 56, 180, 110); g.quadraticCurveTo(128, 78, 76, 110); g.fill(); g.stroke(); break;
        case 'flat': g.fillRect(80, 40, 96, 40); g.strokeRect(80, 40, 96, 40); g.fillStyle = '#ff8a3a'; g.fillRect(76, 80, 104, 12); g.strokeRect(76, 80, 104, 12); break;
        case 'mohawk': for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(108 + k * 6, 72); g.lineTo(104 + k * 8, 18 + Math.abs(3 - k) * 8); g.lineTo(118 + k * 6, 74); g.fill(); g.stroke(); } g.fillStyle = shade(L.skin, 0.8); g.fillRect(84, 70, 20, 6); g.fillRect(152, 70, 20, 6); break;
        case 'cap': g.fillStyle = '#2a3a6a'; g.beginPath(); g.ellipse(128, 76, 60, 30, 0, Math.PI, 0); g.fill(); g.stroke(); g.fillRect(66, 74, 124, 12); g.strokeRect(66, 74, 124, 12); g.beginPath(); g.ellipse(150, 86, 46, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
        case 'big': for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(70 + k * 15, 66 + Math.sin(k * 1.7) * 10, 22, 0, 7); g.fill(); } break;
        case 'bob': g.beginPath(); g.moveTo(72, 120); g.quadraticCurveTo(70, 52, 128, 54); g.quadraticCurveTo(186, 52, 184, 120); g.lineTo(170, 90); g.quadraticCurveTo(128, 70, 86, 90); g.closePath(); g.fill(); g.stroke(); break;
        case 'side': g.beginPath(); g.moveTo(76, 104); g.quadraticCurveTo(80, 52, 140, 56); g.quadraticCurveTo(184, 62, 180, 100); g.lineTo(160, 78); g.lineTo(96, 80); g.closePath(); g.fill(); g.stroke(); break;
        case 'curly': for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(82 + k * 13, 66 + (k % 2) * 6, 13, 0, 7); g.fill(); } break;
        default: g.beginPath(); g.moveTo(76, 104); g.quadraticCurveTo(80, 50, 128, 52); g.quadraticCurveTo(178, 50, 180, 104); g.quadraticCurveTo(150, 70, 76, 104); g.fill(); g.stroke();
    }
    if (key === 'shark') { g.fillStyle = '#6a7488'; g.beginPath(); g.moveTo(110, 58); g.quadraticCurveTo(140, 40, 150, 4); g.quadraticCurveTo(156, 40, 160, 60); g.closePath(); g.fill(); g.stroke(); }
    if (key === 'doc') { g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(160, 64, 14, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#c0d8e0'; g.beginPath(); g.arc(160, 64, 8, 0, 7); g.fill(); g.strokeStyle = '#8a8a90'; g.beginPath(); g.moveTo(98, 196); g.quadraticCurveTo(128, 230, 158, 196); g.stroke(); }
    // border glow
    g.strokeStyle = bg[1]; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
}

function starPath(g, x, y, r) {
    for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
        if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
}

function shade(hex, k) {
    const v = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((v >> 16) & 255) * k) | 0, gg = Math.min(255, ((v >> 8) & 255) * k) | 0, b = Math.min(255, (v & 255) * k) | 0;
    return `rgb(${r},${gg},${b})`;
}
