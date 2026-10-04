/**
 * portraits.js — procedural radio portraits (drawn chunky at 36×36 and
 * scaled up, with scanlines and a talking mouth) and weapon silhouettes for
 * the HUD.
 */

import { WEAPONS } from '../config.js';

const LO = 36;
const lo = document.createElement('canvas');
lo.width = lo.height = LO;
const g = lo.getContext('2d');

function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function circ(x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function ell(x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

function face(skin, shade, eyes, mouth, mouthOpen, blink) {
    ell(18, 17, 8, 10, skin);
    px(10, 18, 2, 6, shade); px(24, 18, 2, 6, shade);
    if (!blink) { px(13, 16, 3, 2, eyes); px(20, 16, 3, 2, eyes); px(14, 16, 1, 1, '#fff'); px(21, 16, 1, 1, '#fff'); }
    else { px(13, 17, 3, 1, shade); px(20, 17, 3, 1, shade); }
    px(17, 18, 2, 4, shade);
    px(15, 24, 6, mouthOpen ? 2 : 1, mouth);
}

const DRAW = {
    okoye(open, blink) {
        px(0, 0, LO, LO, '#06222a');
        px(6, 27, 24, 9, '#2a3a3a'); px(15, 27, 6, 4, '#1a2626'); px(9, 28, 3, 2, '#ffd23a'); // uniform & rank
        face('#6a4430', '#4a2e20', '#1a0c06', '#2a1008', open, blink);
        ell(18, 9, 8, 4, '#120a08'); px(10, 8, 16, 3, '#120a08'); // close-cropped hair
        px(8, 13, 3, 8, '#1a1e22'); px(9, 20, 2, 5, '#1a1e22'); px(10, 24, 6, 1, '#1a1e22'); circ(16, 24, 1, '#ff3a2a'); // headset
        px(26, 13, 2, 7, '#1a1e22');
    },
    ellie(open, blink) {
        px(0, 0, LO, LO, '#2a1a08');
        px(6, 27, 24, 9, '#e8ecec'); px(16, 27, 4, 9, '#cfd6d6'); px(22, 30, 3, 4, '#46c8ff');
        ell(18, 13, 11, 10, '#c4521e'); // hair back
        face('#f0c8a8', '#c89a7a', '#2a5a2a', '#8a3a2a', open, blink);
        px(9, 7, 18, 5, '#d8642a'); px(8, 10, 4, 12, '#d8642a'); px(24, 10, 4, 10, '#d8642a'); px(12, 9, 6, 3, '#e8823a');
        px(12, 21, 2, 1, '#c89a7a'); px(13, 14, 4, 1, '#8a3a1a'); px(20, 14, 4, 1, '#8a3a1a'); // worried brows
        px(25, 20, 2, 1, '#b04a2a'); // a scratch
    },
    harrow(open, blink) {
        px(0, 0, LO, LO, '#0a2208');
        px(6, 27, 24, 9, '#e0e4e0'); px(16, 27, 4, 9, '#3a2a4a');
        face('#d8b8a0', '#a88a70', '#3a4a5a', '#5a2a2a', open, blink);
        px(10, 7, 16, 4, '#a8acb0'); px(9, 9, 3, 6, '#a8acb0'); px(24, 9, 3, 5, '#a8acb0');
        g.strokeStyle = '#2a2a2a'; g.lineWidth = 1; g.strokeRect(12.5, 15.5, 5, 3); g.strokeRect(19.5, 15.5, 5, 3); px(17, 16, 2, 1, '#2a2a2a');
        px(14, 22, 8, 1, '#a88a70');
    },
    warden(open, blink) {
        px(0, 0, LO, LO, '#0a1018');
        px(5, 26, 26, 10, '#3e4a3a'); px(3, 25, 8, 6, '#2c3529'); px(25, 25, 8, 6, '#2c3529');
        ell(18, 16, 11, 12, '#3e4a3a'); px(8, 15, 20, 7, '#1a1e1c');
        px(9, 16, 18, 4, '#46e0ff'); px(9, 16, 18, 1, '#c8f8ff');
        px(16, 5, 4, 3, '#2c3529');
        void open; void blink;
    },
    system(open) {
        px(0, 0, LO, LO, '#220404');
        g.fillStyle = open ? '#ff3a2a' : '#c02010';
        g.beginPath(); g.moveTo(18, 6); g.lineTo(31, 29); g.lineTo(5, 29); g.closePath(); g.fill();
        px(17, 13, 2, 9, '#220404'); px(17, 24, 2, 2, '#220404');
    },
};

/** Draw speaker into a 72×72 canvas. */
export function drawPortrait(canvas, speaker, open = false, t = 0) {
    const blink = (t % 3.7) < 0.12;
    g.clearRect(0, 0, LO, LO);
    (DRAW[speaker] ?? DRAW.system)(open, blink);
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(lo, 0, 0, canvas.width, canvas.height);
    // Scanlines, static and a tint flicker.
    c.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < canvas.height; y += 3) c.fillRect(0, y, canvas.width, 1);
    if (Math.random() < 0.08) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, Math.random() * canvas.height, canvas.width, 3); }
    const grd = c.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = grd; c.fillRect(0, 0, canvas.width, canvas.height);
}

// ------------------------------------------------------------------ Weapon icons

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function drawWeaponIcon(canvas, id) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const col = hex(WEAPONS[id]?.color ?? 0xffffff);
    c.save();
    c.scale(W / 132, H / 44);
    c.fillStyle = '#c8d4dc';
    c.shadowColor = col; c.shadowBlur = 6;
    const R = (x, y, w, h) => c.fillRect(x, y, w, h);
    switch (id) {
    case 'pulse': R(20, 16, 80, 9); R(10, 18, 16, 12); R(40, 25, 7, 12); R(60, 25, 10, 8); R(100, 19, 18, 3); c.fillStyle = col; R(62, 12, 30, 3); break;
    case 'scatter': R(40, 15, 76, 5); R(40, 21, 76, 5); R(12, 18, 32, 9); R(28, 26, 8, 11); c.fillStyle = col; R(70, 26, 20, 4); break;
    case 'flame': R(20, 16, 70, 10); R(90, 18, 26, 6); c.beginPath(); c.arc(42, 32, 8, 0, 7); c.fill(); R(14, 18, 10, 12); c.fillStyle = col; c.beginPath(); c.arc(120, 21, 3, 0, 7); c.fill(); break;
    case 'smart': R(14, 14, 86, 14); R(100, 18, 18, 5); R(40, 6, 30, 8); R(30, 28, 9, 10); c.fillStyle = col; R(44, 9, 4, 4); R(20, 30, 50, 3); break;
    case 'arc': R(16, 15, 60, 13); R(30, 28, 8, 10); c.fillStyle = col; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(84 + i * 12, 21, 6, 0, 7); c.fill(); } c.fillStyle = '#fff'; R(112, 20, 12, 2); break;
    case 'rail': R(10, 17, 112, 6); R(18, 23, 22, 12); c.fillStyle = col; R(40, 13, 80, 3); R(40, 24, 80, 3); break;
    case 'gl': c.beginPath(); c.arc(42, 21, 12, 0, 7); c.fill(); R(42, 15, 70, 12); R(16, 18, 20, 8); R(30, 30, 8, 9); c.fillStyle = col; R(70, 10, 22, 3); break;
    case 'minigun': for (let i = 0; i < 3; i++) R(40, 13 + i * 6, 82, 3); R(10, 12, 34, 20); c.fillStyle = col; R(118, 11, 4, 22); break;
    case 'plasma': R(14, 13, 70, 18); c.fillStyle = col; c.beginPath(); c.arc(70, 22, 8, 0, 7); c.fill(); c.fillStyle = '#c8d4dc'; R(84, 16, 34, 12); c.fillStyle = col; R(20, 31, 50, 3); break;
    default: R(20, 16, 80, 10);
    }
    c.restore();
}

export const WEAPON_HEX = (id) => hex(WEAPONS[id]?.color ?? 0xffffff);
