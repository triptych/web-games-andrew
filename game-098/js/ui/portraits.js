// Painted portraits for the story: cartoon faces drawn in Canvas 2D with thick ink lines, flat
// colour and a few brush highlights, like the talking heads of an old Flash adventure. Dragons get
// a head-and-shoulders portrait drawn from their species colours.

import { SPECIES } from '../sim/data.js';

const INK = '#1a1020';

const PEOPLE = {
    kestrel:    { skin: '#f2c49a', hair: '#6a3a1a', hairStyle: 'tuft', eyes: '#3a6a2a', cloth: '#3a9a5a', trim: '#e8b040', scarf: '#e83a3a', bg: ['#ffd88a', '#ff9a5a'] },
    brannoc:    { skin: '#e8b890', hair: '#f0f0f0', hairStyle: 'bald', beard: '#f4f4f4', brows: '#e8e8e8', eyes: '#3a4a8a', cloth: '#8a5a30', trim: '#d8a040', bg: ['#ffe8b0', '#c8904a'], wrinkles: true },
    pip:        { kobold: true, skin: '#e88a3a', belly: '#ffd8a0', eyes: '#2a1a10', cloth: '#5a8ad8', bg: ['#fff0c0', '#ffc070'] },
    rowan:      { skin: '#d8a880', hair: '#9a9a9a', hairStyle: 'long', beard: '#b0b0b0', eyes: '#4a3a2a', cloth: '#6a7a3a', trim: '#c8b070', bg: ['#e8f0c0', '#a8b870'], wrinkles: true },
    sera:       { skin: '#f2d0b0', hair: '#ffe08a', hairStyle: 'pony', eyes: '#2a7ad8', cloth: '#3a6ad8', trim: '#ffffff', armor: '#c8d8f0', bg: ['#c8e8ff', '#5a9ae8'] },
    grisk:      { skin: '#d8a080', helm: 'skull', beard: '#6a3a1a', eyes: '#8a1a1a', cloth: '#7a2a1a', trim: '#3a2a20', armor: '#6a5a4a', bg: ['#e8a880', '#8a3a2a'], scar: true, grin: true },
    varek:      { skin: '#d8b090', hair: '#2a2a30', hairStyle: 'swept', eyes: '#8a8a9a', cloth: '#1a1a24', trim: '#c8a040', armor: '#3a3a48', bg: ['#a8a8b8', '#3a3a4a'], scar: true, stern: true },
    varekally:  { skin: '#d8b090', hair: '#2a2a30', hairStyle: 'swept', eyes: '#8a8a9a', cloth: '#1a1a24', trim: '#c8a040', armor: '#3a3a48', bg: ['#c8d8f0', '#3a5a9a'], scar: true },
    sablethorn: { skin: '#a8c8a0', hair: '#8a8a8a', hairStyle: 'wild', eyes: '#c8ff3a', cloth: '#3a5a3a', trim: '#a0ff60', hat: '#2a3a2a', bg: ['#a8c890', '#2a3a2a'], wrinkles: true, grin: true },
    nyxara:     { skin: '#e8d8f0', hair: '#1a1020', hairStyle: 'long', eyes: '#ff3a8a', cloth: '#2a1a3a', trim: '#ff3a8a', crown: true, bg: ['#7a3a8a', '#1a0a2a'], stern: true, lips: '#8a1a4a' },
};

const DRAGON_PORTRAITS = { thornheart: 'sylvara', vorthax: 'vorthax' };

function outline(g, w = 5) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function blob(g, x, y, rx, ry, fill, w = 5, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (w) outline(g, w); }
function shine(g, x, y, r) { g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, r, r * 0.6, -0.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }

function background(g, S, [a, b]) {
    const gr = g.createRadialGradient(S * 0.5, S * 0.4, S * 0.1, S * 0.5, S * 0.5, S * 0.75);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // brush strokes
    let seed = a.charCodeAt(1) * 31 + b.charCodeAt(2);
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 40; i++) {
        g.globalAlpha = 0.12; g.fillStyle = r() < 0.5 ? '#fff' : '#000';
        g.beginPath(); g.ellipse(r() * S, r() * S, 20 + r() * 30, 5 + r() * 6, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
}

function person(g, S, P) {
    const cx = S / 2, cy = S * 0.48;
    // shoulders
    g.beginPath(); g.moveTo(S * 0.08, S); g.quadraticCurveTo(S * 0.12, S * 0.72, cx, S * 0.7); g.quadraticCurveTo(S * 0.88, S * 0.72, S * 0.92, S); g.closePath();
    g.fillStyle = P.armor || P.cloth; g.fill(); outline(g);
    if (P.armor) { g.beginPath(); g.moveTo(S * 0.3, S); g.lineTo(cx, S * 0.78); g.lineTo(S * 0.7, S); g.fillStyle = P.cloth; g.fill(); outline(g, 4); }
    g.beginPath(); g.moveTo(S * 0.36, S * 0.76); g.quadraticCurveTo(cx, S * 0.86, S * 0.64, S * 0.76); g.strokeStyle = P.trim; g.lineWidth = 8; g.stroke();
    if (P.scarf) { blob(g, cx, S * 0.73, S * 0.17, S * 0.06, P.scarf, 4); g.beginPath(); g.moveTo(S * 0.58, S * 0.74); g.quadraticCurveTo(S * 0.68, S * 0.86, S * 0.62, S * 0.98); g.lineWidth = 16; g.strokeStyle = P.scarf; g.stroke(); }
    // neck
    g.fillStyle = P.skin; g.fillRect(cx - S * 0.06, S * 0.6, S * 0.12, S * 0.12);
    // back hair
    if (P.hairStyle === 'long' || P.hairStyle === 'wild') { blob(g, cx, cy + S * 0.08, S * 0.27, S * 0.3, P.hair, 5); }
    if (P.hairStyle === 'pony') { g.beginPath(); g.moveTo(cx + S * 0.18, cy - S * 0.12); g.quadraticCurveTo(cx + S * 0.42, cy, cx + S * 0.3, cy + S * 0.28); g.lineWidth = 26; g.strokeStyle = P.hair; g.stroke(); }
    // head
    blob(g, cx, cy, S * 0.2, S * 0.23, P.skin, 5);
    blob(g, cx - S * 0.2, cy + S * 0.02, S * 0.04, S * 0.06, P.skin, 4);
    blob(g, cx + S * 0.2, cy + S * 0.02, S * 0.04, S * 0.06, P.skin, 4);
    blob(g, cx, cy, S * 0.19, S * 0.22, P.skin, 0);
    // cheeks
    g.globalAlpha = 0.25; blob(g, cx - S * 0.11, cy + S * 0.08, S * 0.04, S * 0.025, '#ff6a6a', 0); blob(g, cx + S * 0.11, cy + S * 0.08, S * 0.04, S * 0.025, '#ff6a6a', 0); g.globalAlpha = 1;
    // eyes
    for (const s of [-1, 1]) {
        const ex = cx + s * S * 0.075, ey = cy - S * 0.01;
        blob(g, ex, ey, S * 0.04, P.stern ? S * 0.03 : S * 0.045, '#fff', 3.5);
        blob(g, ex + s * 0.003 * S, ey + S * 0.005, S * 0.022, S * 0.028, P.eyes, 0);
        blob(g, ex, ey + S * 0.006, S * 0.011, S * 0.014, INK, 0);
        blob(g, ex - S * 0.008, ey - S * 0.008, S * 0.007, S * 0.007, '#fff', 0);
        // brows
        g.beginPath();
        const by = ey - S * (P.stern ? 0.045 : 0.06);
        g.moveTo(ex - S * 0.04, by + (P.stern ? -s * 0 : 0)); g.lineTo(ex + S * 0.04, by + (P.stern ? (s > 0 ? -1 : 1) * -S * 0.015 : -S * 0.005));
        g.lineWidth = P.brows ? 8 : 5; g.strokeStyle = P.brows || P.hair || INK; g.stroke();
    }
    // nose and mouth
    g.beginPath(); g.moveTo(cx, cy + S * 0.02); g.quadraticCurveTo(cx + S * 0.025, cy + S * 0.06, cx - S * 0.005, cy + S * 0.07); outline(g, 3);
    g.beginPath();
    if (P.grin) { g.moveTo(cx - S * 0.07, cy + S * 0.11); g.quadraticCurveTo(cx, cy + S * 0.17, cx + S * 0.08, cy + S * 0.1); g.closePath(); g.fillStyle = '#fff'; g.fill(); outline(g, 3.5); }
    else if (P.stern) { g.moveTo(cx - S * 0.045, cy + S * 0.125); g.lineTo(cx + S * 0.045, cy + S * 0.12); g.lineWidth = 4; g.strokeStyle = P.lips || INK; g.stroke(); }
    else { g.moveTo(cx - S * 0.05, cy + S * 0.11); g.quadraticCurveTo(cx, cy + S * 0.145, cx + S * 0.05, cy + S * 0.11); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
    if (P.wrinkles) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * S * 0.13, cy - S * 0.02); g.lineTo(cx + s * S * 0.16, cy - S * 0.01); outline(g, 2); } }
    if (P.scar) { g.beginPath(); g.moveTo(cx + S * 0.1, cy - S * 0.09); g.lineTo(cx + S * 0.05, cy + S * 0.04); g.lineWidth = 3; g.strokeStyle = '#a85050'; g.stroke(); }
    if (P.beard) { g.beginPath(); g.moveTo(cx - S * 0.19, cy + S * 0.02); g.quadraticCurveTo(cx - S * 0.18, cy + S * 0.3, cx, cy + S * 0.33); g.quadraticCurveTo(cx + S * 0.18, cy + S * 0.3, cx + S * 0.19, cy + S * 0.02); g.quadraticCurveTo(cx, cy + S * 0.16, cx - S * 0.19, cy + S * 0.02); g.fillStyle = P.beard; g.fill(); outline(g, 4); g.beginPath(); g.moveTo(cx - S * 0.06, cy + S * 0.1); g.quadraticCurveTo(cx, cy + S * 0.13, cx + S * 0.06, cy + S * 0.1); outline(g, 3); }
    // hair, hats, helms
    if (P.helm === 'skull') {
        g.beginPath(); g.ellipse(cx, cy - S * 0.1, S * 0.23, S * 0.17, 0, Math.PI, 0); g.fillStyle = '#f0e8d0'; g.fill(); outline(g);
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * S * 0.16, cy - S * 0.18); g.quadraticCurveTo(cx + s * S * 0.3, cy - S * 0.32, cx + s * S * 0.26, cy - S * 0.42); g.quadraticCurveTo(cx + s * S * 0.22, cy - S * 0.28, cx + s * S * 0.1, cy - S * 0.22); g.fillStyle = '#f0e8d0'; g.fill(); outline(g, 4); }
        for (const s of [-1, 1]) blob(g, cx + s * S * 0.07, cy - S * 0.16, S * 0.03, S * 0.025, INK, 0);
    } else if (P.hairStyle === 'bald') {
        shine(g, cx - S * 0.06, cy - S * 0.16, S * 0.05);
        for (const s of [-1, 1]) blob(g, cx + s * S * 0.18, cy - S * 0.06, S * 0.05, S * 0.07, P.hair, 4);
    } else if (P.hair) {
        g.beginPath();
        g.moveTo(cx - S * 0.21, cy);
        g.quadraticCurveTo(cx - S * 0.24, cy - S * 0.3, cx, cy - S * 0.27);
        g.quadraticCurveTo(cx + S * 0.25, cy - S * 0.3, cx + S * 0.21, cy);
        g.quadraticCurveTo(cx + S * 0.16, cy - S * 0.12, cx + S * 0.02, cy - S * 0.14);
        g.quadraticCurveTo(cx - S * 0.1, cy - S * 0.08, cx - S * 0.21, cy);
        g.fillStyle = P.hair; g.fill(); outline(g);
        if (P.hairStyle === 'tuft') { g.beginPath(); g.moveTo(cx - S * 0.02, cy - S * 0.26); g.quadraticCurveTo(cx + S * 0.05, cy - S * 0.38, cx + S * 0.12, cy - S * 0.34); g.quadraticCurveTo(cx + S * 0.06, cy - S * 0.3, cx + S * 0.06, cy - S * 0.25); g.fillStyle = P.hair; g.fill(); outline(g, 4); }
        if (P.hairStyle === 'swept') { g.beginPath(); g.moveTo(cx - S * 0.2, cy - S * 0.1); g.quadraticCurveTo(cx - S * 0.1, cy - S * 0.24, cx + S * 0.18, cy - S * 0.16); outline(g, 3); }
        if (P.hairStyle === 'wild') for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(cx - S * 0.2 + i * S * 0.1, cy - S * 0.22); g.lineTo(cx - S * 0.26 + i * S * 0.12, cy - S * 0.34); outline(g, 5); }
        shine(g, cx - S * 0.08, cy - S * 0.2, S * 0.05);
    }
    if (P.hat) {
        g.beginPath(); g.ellipse(cx, cy - S * 0.18, S * 0.34, S * 0.07, 0.05, 0, Math.PI * 2); g.fillStyle = P.hat; g.fill(); outline(g);
        g.beginPath(); g.moveTo(cx - S * 0.17, cy - S * 0.2); g.quadraticCurveTo(cx - S * 0.05, cy - S * 0.55, cx + S * 0.2, cy - S * 0.52); g.quadraticCurveTo(cx + S * 0.08, cy - S * 0.42, cx + S * 0.16, cy - S * 0.2); g.closePath(); g.fillStyle = P.hat; g.fill(); outline(g);
        g.fillStyle = P.trim; g.fillRect(cx - S * 0.16, cy - S * 0.27, S * 0.32, S * 0.04);
    }
    if (P.crown) {
        g.beginPath(); g.moveTo(cx - S * 0.16, cy - S * 0.2);
        for (let i = 0; i <= 4; i++) { g.lineTo(cx - S * 0.16 + i * S * 0.08, cy - S * (i % 2 ? 0.27 : 0.38)); }
        g.lineTo(cx + S * 0.16, cy - S * 0.2); g.closePath(); g.fillStyle = '#ffd040'; g.fill(); outline(g, 4);
        blob(g, cx, cy - S * 0.27, S * 0.025, S * 0.025, '#ff3a8a', 2);
    }
}

function kobold(g, S, P) {
    const cx = S / 2, cy = S * 0.5;
    blob(g, cx, S * 0.95, S * 0.3, S * 0.25, P.cloth, 5);
    // ears/frills
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * S * 0.18, cy - S * 0.08); g.lineTo(cx + s * S * 0.4, cy - S * 0.26); g.lineTo(cx + s * S * 0.22, cy + S * 0.06); g.closePath(); g.fillStyle = P.skin; g.fill(); outline(g); }
    blob(g, cx, cy, S * 0.24, S * 0.22, P.skin, 5);
    blob(g, cx, cy + S * 0.1, S * 0.17, S * 0.1, P.belly, 4);
    for (const s of [-1, 1]) { blob(g, cx + s * S * 0.1, cy - S * 0.04, S * 0.065, S * 0.075, '#fff', 4); blob(g, cx + s * S * 0.11, cy - S * 0.03, S * 0.04, S * 0.05, P.eyes, 0); blob(g, cx + s * S * 0.095, cy - S * 0.055, S * 0.015, S * 0.015, '#fff', 0); }
    g.beginPath(); g.moveTo(cx - S * 0.08, cy + S * 0.1); g.quadraticCurveTo(cx, cy + S * 0.16, cx + S * 0.08, cy + S * 0.1); outline(g, 4);
    for (const s of [-1, 1]) blob(g, cx + s * S * 0.04, cy + S * 0.06, S * 0.012, S * 0.01, INK, 0);
    g.beginPath(); g.moveTo(cx - S * 0.05, cy - S * 0.2); g.lineTo(cx, cy - S * 0.32); g.lineTo(cx + S * 0.05, cy - S * 0.2); g.fillStyle = '#ffd040'; g.fill(); outline(g, 3);
}

function dragonHead(g, S, look) {
    const cx = S * 0.48, cy = S * 0.5;
    // neck
    g.beginPath(); g.moveTo(S * 0.25, S); g.quadraticCurveTo(S * 0.3, S * 0.6, cx, cy); g.quadraticCurveTo(S * 0.75, S * 0.65, S * 0.8, S); g.closePath(); g.fillStyle = look.body; g.fill(); outline(g);
    g.beginPath(); g.moveTo(S * 0.42, S); g.quadraticCurveTo(S * 0.46, S * 0.75, S * 0.55, S * 0.66); g.quadraticCurveTo(S * 0.65, S * 0.8, S * 0.66, S); g.fillStyle = look.belly; g.fill(); outline(g, 4);
    // horns
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * S * 0.12, cy - S * 0.15); g.quadraticCurveTo(cx + s * S * 0.25, cy - S * 0.38, cx + s * S * 0.32, cy - S * 0.42); g.quadraticCurveTo(cx + s * S * 0.2, cy - S * 0.26, cx + s * S * 0.2, cy - S * 0.08); g.fillStyle = '#f2e6c8'; g.fill(); outline(g, 4); }
    if (look.frill) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45; g.beginPath(); g.moveTo(cx, cy - S * 0.05); g.lineTo(cx + Math.cos(a - 0.15) * S * 0.36, cy + Math.sin(a - 0.15) * S * 0.36); g.lineTo(cx + Math.cos(a + 0.15) * S * 0.36, cy + Math.sin(a + 0.15) * S * 0.36); g.closePath(); g.fillStyle = look.accent; g.fill(); outline(g, 3); }
    // head and snout
    blob(g, cx, cy, S * 0.22, S * 0.19, look.body, 5);
    blob(g, cx + S * 0.12, cy + S * 0.09, S * 0.18, S * 0.11, look.body, 5);
    blob(g, cx + S * 0.13, cy + S * 0.15, S * 0.14, S * 0.05, look.belly, 3.5);
    blob(g, cx + S * 0.25, cy + S * 0.05, S * 0.015, S * 0.012, INK, 0);
    for (const s of [-1, 1]) { const ex = cx + s * S * 0.08 - S * 0.02, ey = cy - S * 0.04; blob(g, ex, ey, S * 0.06, S * 0.07, '#fff', 4); blob(g, ex + S * 0.01, ey + S * 0.005, S * 0.032, S * 0.05, look.accent === '#ffffff' ? '#2a2a6a' : INK, 0); blob(g, ex - S * 0.005, ey - S * 0.025, S * 0.014, S * 0.014, '#fff', 0); }
    shine(g, cx - S * 0.08, cy - S * 0.12, S * 0.06);
}

const CACHE = new Map();
/** A portrait as a data URL. `key` is a speaker id or a species key. */
export function portrait(key, size = 160, extra = null) {
    const ck = key + '|' + size + '|' + (extra || '');
    if (CACHE.has(ck)) return CACHE.get(ck);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const P = PEOPLE[key];
    const sp = extra || DRAGON_PORTRAITS[key] || (SPECIES[key] ? key : null);
    if (P) { background(g, size, P.bg); if (P.kobold) kobold(g, size, P); else person(g, size, P); }
    else if (sp) {
        const look = sp === 'vorthax' ? { body: '#2a2238', belly: '#6a3a5a', accent: '#ff5a3a', frill: true } : SPECIES[sp].look;
        background(g, size, [look.belly, look.body]);
        dragonHead(g, size, look);
    } else background(g, size, ['#e8e0d0', '#8a7a6a']);
    // a painted frame
    g.lineWidth = 6; g.strokeStyle = INK; g.strokeRect(3, 3, size - 6, size - 6);
    const url = c.toDataURL();
    CACHE.set(ck, url);
    return url;
}

/** A small painted egg in a species' colours. */
export function eggIcon(sp, size = 64, { gilded = false } = {}) {
    const ck = 'egg|' + sp + size + gilded;
    if (CACHE.has(ck)) return CACHE.get(ck);
    const S = SPECIES[sp];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const cx = size / 2, cy = size * 0.54;
    g.save();
    g.beginPath(); g.ellipse(cx, cy, size * 0.3, size * 0.4, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = gilded ? '#ffd860' : S.look.belly; g.fillRect(0, 0, size, size);
    let seed = sp.length * 977;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = S.look.body;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(r() * size, r() * size, 2 + r() * size * 0.08, 2 + r() * size * 0.05, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = S.look.accent; g.fillRect(0, cy - size * 0.04, size, size * 0.07);
    g.globalAlpha = 0.4; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - size * 0.1, cy - size * 0.15, size * 0.07, size * 0.11, -0.4, 0, Math.PI * 2); g.fill();
    g.restore();
    g.beginPath(); g.ellipse(cx, cy, size * 0.3, size * 0.4, 0, 0, Math.PI * 2); g.lineWidth = Math.max(2, size / 22); g.strokeStyle = INK; g.stroke();
    const url = c.toDataURL();
    CACHE.set(ck, url);
    return url;
}
