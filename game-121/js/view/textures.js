// Canvas textures for the wagon: wallpaper, floorboards, rug, the embroidered tablecloth, the striped canopy,
// a tapestry, and the sky seen through the window and the door. All drawn in code.

import * as THREE from 'three';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { repeat = false, aniso = 4, srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
};
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const noise = (x, w, h, n, a = 0.05) => { for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
function starP(x, px, py, r, n, k) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * k : r; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.closePath(); }

export function wallTexture() {
    const c = mk(256, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#2e1658'); g.addColorStop(1, '#1b0c3a');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = rgba('#e8c14a', 0.22); x.lineWidth = 2;
    for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) {
        const cx = i * 128 + (j & 1 ? 64 : 0), cy = j * 64;
        x.beginPath(); x.moveTo(cx, cy - 64); x.lineTo(cx + 64, cy); x.lineTo(cx, cy + 64); x.lineTo(cx - 64, cy); x.closePath(); x.stroke();
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
        const cx = i * 128 + (j & 1 ? 64 : 0), cy = j * 64;
        starP(x, cx, cy, 10, 8, 0.4); x.fillStyle = rgba('#e8c14a', 0.5); x.fill();
        x.fillStyle = rgba('#ff5aa0', 0.28); x.beginPath(); x.ellipse(cx, cy + 32, 5, 14, 0, 0, TAU); x.fill();
        x.beginPath(); x.ellipse(cx, cy - 32, 5, 14, 0, 0, TAU); x.fill();
    }
    noise(x, 256, 256, 600);
    return tex(c, { repeat: true });
}

export function floorTexture() {
    const c = mk(512, 512), x = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
        const v = 26 + Math.random() * 18;
        x.fillStyle = `rgb(${v + 22},${v + 4},${v - 4})`; x.fillRect(i * 64, 0, 64, 512);
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke();
        for (let k = 0; k < 24; k++) { x.strokeStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.08})`; x.lineWidth = 1; x.beginPath(); const px = i * 64 + 4 + Math.random() * 56; x.moveTo(px, 0); x.bezierCurveTo(px + 6, 170, px - 6, 340, px, 512); x.stroke(); }
        const cut = Math.floor(Math.random() * 400) + 40; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i * 64, cut, 64, 2);
    }
    return tex(c, { repeat: true });
}

export function woodTexture(base = '#4a2a18') {
    const c = mk(256, 256), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,210,150'},${0.05 + Math.random() * 0.1})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const py = Math.random() * 256; x.moveTo(0, py); x.bezierCurveTo(80, py + (Math.random() - 0.5) * 18, 170, py + (Math.random() - 0.5) * 18, 256, py); x.stroke(); }
    return tex(c, { repeat: true });
}

export function rugTexture() {
    const S = 512, c = mk(S, S), x = c.getContext('2d'), m = S / 2;
    const ring = (r0, r1, col) => { x.beginPath(); x.arc(m, m, r1, 0, TAU); x.arc(m, m, r0, 0, TAU, true); x.fillStyle = col; x.fill('evenodd'); };
    x.beginPath(); x.arc(m, m, m - 2, 0, TAU); x.fillStyle = '#5a1030'; x.fill();
    ring(m - 30, m - 2, '#2a0a4a'); ring(m - 36, m - 30, '#e8c14a'); ring(m - 70, m - 40, '#0f5a64'); ring(m - 76, m - 70, '#e8c14a');
    for (let i = 0; i < 48; i++) { const a = i * TAU / 48; starP(x, m + Math.cos(a) * (m - 55), m + Math.sin(a) * (m - 55), 7, 4, 0.4); x.fillStyle = '#ffd25a'; x.fill(); }
    x.strokeStyle = rgba('#e8c14a', 0.8); x.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; x.beginPath(); x.moveTo(m + Math.cos(a) * 40, m + Math.sin(a) * 40); x.lineTo(m + Math.cos(a) * (m - 90), m + Math.sin(a) * (m - 90)); x.stroke(); }
    starP(x, m, m, m - 100, 8, 0.5); x.fillStyle = rgba('#e8c14a', 0.22); x.fill(); x.stroke();
    x.beginPath(); x.arc(m, m, 44, 0, TAU); x.fillStyle = '#e8c14a'; x.fill();
    x.beginPath(); x.arc(m, m, 32, 0, TAU); x.fillStyle = '#2a0a4a'; x.fill();
    noise(x, S, S, 1500, 0.06);
    return tex(c);
}

// The tablecloth is the top of the table seen from above. `slots` are the three card places as fractions of the
// disc (0..1), so the 3D cards can be laid exactly on their sigils.
export const SLOT_FRAC = [[0.5 - 0.215, 0.76], [0.5, 0.78], [0.5 + 0.215, 0.76]];
export function clothTexture() {
    const S = 1024, c = mk(S, S), x = c.getContext('2d'), m = S / 2;
    const g = x.createRadialGradient(m, m, 20, m, m, m); g.addColorStop(0, '#3a1a78'); g.addColorStop(1, '#1a0a48');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.lineWidth = 3;
    for (const [r, a] of [[m - 8, 0.9], [m - 30, 0.5], [m * 0.62, 0.35], [m * 0.4, 0.35]]) { x.strokeStyle = rgba('#e8c14a', a); x.beginPath(); x.arc(m, m, r, 0, TAU); x.stroke(); }
    // twelve small emblems around the rim
    for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, px = m + Math.cos(a) * (m - 62), py = m + Math.sin(a) * (m - 62);
        x.save(); x.translate(px, py); x.rotate(a + Math.PI / 2); x.strokeStyle = '#ffd25a'; x.fillStyle = rgba('#ffd25a', 0.35); x.lineWidth = 2.5;
        if (i % 3 === 0) { x.beginPath(); x.arc(0, 0, 14, 0, TAU); x.stroke(); x.beginPath(); x.arc(5, -2, 12, 0, TAU); x.fillStyle = '#1a0a48'; x.fill(); }
        else if (i % 3 === 1) { starP(x, 0, 0, 16, 5, 0.45); x.fill(); x.stroke(); }
        else { x.beginPath(); x.moveTo(0, -16); x.lineTo(14, 12); x.lineTo(-14, 12); x.closePath(); x.stroke(); }
        x.restore();
    }
    // a compass star in the middle, under the ball
    starP(x, m, m, 160, 8, 0.4); x.fillStyle = rgba('#e8c14a', 0.16); x.fill(); x.strokeStyle = rgba('#e8c14a', 0.6); x.stroke();
    // the three sigils where the cards go
    const labels = ['PAST', 'PRESENT', 'FUTURE'];
    SLOT_FRAC.forEach(([fx, fy], i) => {
        const px = fx * S, py = fy * S, w = 0.17 * 692 * 1.1, h = 0.29 * 692 * 1.08;
        x.strokeStyle = rgba('#ffd25a', 0.85); x.lineWidth = 3; x.setLineDash([14, 9]);
        x.beginPath(); x.roundRect(px - w / 2, py - h / 2, w, h, 10); x.stroke(); x.setLineDash([]);
        x.fillStyle = rgba('#ffd25a', 0.1); x.fill();
        starP(x, px, py, 24, 4, 0.35); x.fillStyle = rgba('#ffd25a', 0.45); x.fill();
        x.font = '700 22px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = rgba('#ffd25a', 0.8); x.fillText(labels[i], px, py + h / 2 + 30);
    });
    noise(x, S, S, 2500, 0.05);
    return tex(c, { aniso: 8 });
}

export function skirtTexture() {
    const c = mk(256, 128), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#7a0f3e'); g.addColorStop(1, '#3a0620');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 8; i++) { x.strokeStyle = rgba('#e8c14a', 0.6); x.lineWidth = 3; x.beginPath(); x.arc(i * 32 + 16, 0, 28, 0.1, Math.PI - 0.1); x.stroke(); }
    for (let i = 0; i < 8; i++) { starP(x, i * 32 + 16, 70, 7, 4, 0.4); x.fillStyle = rgba('#ffd25a', 0.7); x.fill(); }
    return tex(c, { repeat: true });
}

export function canopyTexture() {
    const c = mk(512, 64), x = c.getContext('2d');
    const cols = ['#a31f5a', '#17737c', '#d9a62e', '#5a2a9a', '#a31f5a', '#17737c', '#c8501e', '#5a2a9a'];
    cols.forEach((col, i) => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = col; x.fillRect(i * 64, 0, 64, 64); x.fillStyle = g; x.fillRect(i * 64, 0, 64, 64); });
    x.strokeStyle = rgba('#ffe9a0', 0.55); x.lineWidth = 2; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 64); x.stroke(); }
    noise(x, 512, 64, 500, 0.06);
    return tex(c, { repeat: true });
}

export function tapestryTexture() {
    const S = 512, c = mk(S, S), x = c.getContext('2d'), m = S / 2;
    x.fillStyle = '#12082e'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#e8c14a'; x.lineWidth = 6; x.strokeRect(10, 10, S - 20, S - 20);
    x.lineWidth = 2; x.strokeRect(22, 22, S - 44, S - 44);
    for (const r of [200, 160, 110, 60]) { x.strokeStyle = rgba('#e8c14a', 0.7); x.lineWidth = r === 200 ? 4 : 2; x.beginPath(); x.arc(m, m, r, 0, TAU); x.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; x.beginPath(); x.moveTo(m + Math.cos(a) * 110, m + Math.sin(a) * 110); x.lineTo(m + Math.cos(a) * 200, m + Math.sin(a) * 200); x.strokeStyle = rgba('#e8c14a', 0.6); x.stroke(); starP(x, m + Math.cos(a + 0.26) * 180, m + Math.sin(a + 0.26) * 180, 13, 5, 0.45); x.fillStyle = '#ffd25a'; x.fill(); }
    x.beginPath(); x.arc(m, m, 44, 0, TAU); x.fillStyle = '#ffd25a'; x.fill(); x.beginPath(); x.arc(m + 14, m - 6, 36, 0, TAU); x.fillStyle = '#12082e'; x.fill();
    starP(x, m + 20, m + 4, 16, 5, 0.4); x.fillStyle = '#fff0a0'; x.fill();
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(255,240,170,0.6)'; x.fillRect(30 + Math.random() * 450, 30 + Math.random() * 450, 2, 2); }
    return tex(c);
}

export function journalTexture() {
    const c = mk(256, 256), x = c.getContext('2d');
    x.fillStyle = '#efe0b8'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(80,50,20,0.55)'; x.lineWidth = 2;
    for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(24, 30 + i * 15); for (let k = 24; k < 230; k += 14) x.lineTo(k + 7, 30 + i * 15 + (Math.random() - 0.5) * 5); x.stroke(); }
    x.fillStyle = 'rgba(160,40,70,0.7)'; x.beginPath(); x.arc(200, 40, 12, 0, TAU); x.fill();
    return tex(c);
}

// ------------------------------------------------------------------------------------------- the sky
const SKY = {
    dawn:  { top: '#3a2a7a', mid: '#e8708a', bot: '#ffcf8a', sun: [0.28, 0.62, '#fff0b0'], stars: 0.15, hill: '#2a1840', win: 0.1 },
    day:   { top: '#3a8ae8', mid: '#8ac8ff', bot: '#e8f4ff', sun: [0.72, 0.28, '#fffbe0'], stars: 0, hill: '#2a5a3a', win: 0 },
    dusk:  { top: '#241060', mid: '#c0356a', bot: '#ff9a4a', sun: [0.75, 0.66, '#ffcf80'], stars: 0.3, hill: '#1a0c30', win: 0.5 },
    night: { top: '#050520', mid: '#14104a', bot: '#2a1a6a', sun: [0.25, 0.22, '#f1ecff'], stars: 1, hill: '#0a0818', win: 1 },
};
export const TOD_LIGHT = {
    dawn:  { sun: '#ffb070', hemi: '#a08ad0', int: 0.55, exp: 1.05 },
    day:   { sun: '#fff0d0', hemi: '#c0d8ff', int: 0.75, exp: 1.12 },
    dusk:  { sun: '#ff7a8a', hemi: '#8a6ac0', int: 0.5, exp: 1.02 },
    night: { sun: '#7a8aff', hemi: '#5a4ab0', int: 0.42, exp: 1.0 },
};

export function drawSky(canvas, tod, festival = false) {
    const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height, s = SKY[tod] || SKY.night;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.top); g.addColorStop(0.55, s.mid); g.addColorStop(1, s.bot);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (s.stars) for (let i = 0; i < 160; i++) { const px = (i * 7919) % W, py = ((i * 104729) % (H * 0.7)); x.fillStyle = `rgba(255,255,230,${s.stars * (0.3 + ((i * 31) % 7) / 10)})`; x.fillRect(px, py, 1 + (i % 3 === 0), 1 + (i % 3 === 0)); }
    const [sx, sy, sc] = s.sun;
    const R = tod === 'night' ? 34 : 46;
    const sg = x.createRadialGradient(sx * W, sy * H, 0, sx * W, sy * H, R * 4); sg.addColorStop(0, sc); sg.addColorStop(0.25, sc.replace('#', '#') + 'cc'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    x.beginPath(); x.arc(sx * W, sy * H, R, 0, TAU); x.fillStyle = sc; x.fill();
    if (tod === 'night') { x.beginPath(); x.arc(sx * W + 14, sy * H - 6, R * 0.9, 0, TAU); x.fillStyle = '#14104a'; x.globalCompositeOperation = 'source-atop'; x.fill(); x.globalCompositeOperation = 'source-over'; }
    // soft clouds
    for (let i = 0; i < 9; i++) { x.fillStyle = tod === 'night' ? 'rgba(80,70,160,0.18)' : 'rgba(255,255,255,0.28)'; const cx = (i * 211) % W, cy = 40 + (i * 67) % (H * 0.4); for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx + k * 30, cy + (k % 2) * 6, 46, 14, 0, 0, TAU); x.fill(); } }
    // rolling hills with the village on them
    x.fillStyle = s.hill; x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= 64; i++) { const t = i / 64; x.lineTo(t * W, H * 0.8 - Math.sin(t * 7 + 1) * 22 - Math.sin(t * 19) * 7); }
    x.lineTo(W, H); x.fill();
    const win = s.win;
    for (let i = 0; i < 14; i++) {
        const px = 40 + i * (W / 14) + (i % 3) * 8, py = H * 0.8 - Math.sin((px / W) * 7 + 1) * 22 - Math.sin((px / W) * 19) * 7;
        const w = 22 + (i % 3) * 8, h = 18 + (i % 4) * 6;
        x.fillStyle = '#0a0618'; x.fillRect(px, py - h + 4, w, h);
        x.beginPath(); x.moveTo(px - 3, py - h + 4); x.lineTo(px + w / 2, py - h - 14); x.lineTo(px + w + 3, py - h + 4); x.fill();
        x.fillStyle = `rgba(255,200,100,${0.25 + win * 0.75})`; x.fillRect(px + 5, py - h + 10, 5, 6); x.fillRect(px + w - 10, py - h + 10, 5, 6);
    }
    x.fillStyle = '#0a0618'; x.fillRect(W * 0.5, H * 0.8 - 64, 16, 66); x.beginPath(); x.moveTo(W * 0.5 - 3, H * 0.8 - 64); x.lineTo(W * 0.5 + 8, H * 0.8 - 100); x.lineTo(W * 0.5 + 19, H * 0.8 - 64); x.fill();
    if (festival || tod === 'dusk') {                             // strings of paper lanterns
        for (let r = 0; r < 3; r++) {
            x.strokeStyle = 'rgba(40,20,60,0.8)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, H * (0.5 + r * 0.09)); x.quadraticCurveTo(W / 2, H * (0.62 + r * 0.09), W, H * (0.5 + r * 0.09)); x.stroke();
            for (let i = 1; i < 16; i++) { const t = i / 16, px = t * W, y0 = H * (0.5 + r * 0.09), y1 = H * (0.62 + r * 0.09), py = y0 * ((1 - t) * (1 - t) + t * t) + y1 * 2 * t * (1 - t); const gc = ['#ff5a6a', '#ffcf4a', '#6ad0ff', '#c46aff'][(i + r) % 4]; const lg = x.createRadialGradient(px, py + 7, 0, px, py + 7, 20); lg.addColorStop(0, gc); lg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = lg; x.fillRect(px - 20, py - 14, 40, 40); x.fillStyle = gc; x.beginPath(); x.ellipse(px, py + 7, 5, 7, 0, 0, TAU); x.fill(); }
        }
    }
}

export function skyTexture() {
    const c = mk(1024, 512);
    drawSky(c, 'dusk');
    const t = tex(c, { aniso: 1 });
    t.userData = { canvas: c };
    return t;
}
