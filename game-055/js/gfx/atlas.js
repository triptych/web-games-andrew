// Every sprite in the game, drawn in code into a canvas atlas at startup.
// Sprites face UP (nose towards -y) and are drawn around their centre in
// world units; the packer scales by PX texels per unit. Light comes from the
// upper left. Bullet sprites are channel-encoded (R core, G body, B rim) so
// one shader can colour any bullet with any palette entry.

import { vnoise, fbm } from '../sim/noise.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- packing

export function buildAtlas(jobs, size, PX) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sprites = {};
    const pad = 4;
    const sorted = [...jobs].sort((a, b) => b.h - a.h);
    let x = pad, y = pad, rowH = 0;
    for (const j of sorted) {
        const pw = Math.ceil(j.w * PX), ph = Math.ceil(j.h * PX);
        if (x + pw + pad > size) { x = pad; y += rowH + pad; rowH = 0; }
        if (y + ph + pad > size) { console.warn('atlas full at', j.name); break; }
        ctx.save();
        ctx.translate(x + pw / 2, y + ph / 2);
        ctx.scale(PX, PX);
        ctx.beginPath(); ctx.rect(-j.w / 2, -j.h / 2, j.w, j.h); ctx.clip();
        if (j.pixels) { ctx.restore(); j.pixels(ctx, x, y, pw, ph); }
        else { j.draw(ctx, j.w, j.h); ctx.restore(); }
        sprites[j.name] = { u0: x / size, v0: y / size, u1: (x + pw) / size, v1: (y + ph) / size, w: j.w, h: j.h };
        x += pw + pad;
        rowH = Math.max(rowH, ph);
    }
    return { canvas, sprites };
}

// ---------------------------------------------------------------- helpers

function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
}
function rad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) {
    const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
}
/** Fill the current path with a top-left-lit metal gradient and outline it. */
function metal(ctx, light, mid, dark, sz, line = 'rgba(8,10,14,0.9)', lw = 0.7) {
    ctx.fillStyle = lin(ctx, -sz, -sz, sz, sz, [[0, light], [0.45, mid], [1, dark]]);
    ctx.fill();
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}
function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
function poly(ctx, pts, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (close) ctx.closePath();
}
/** Mirror a half-outline (x ≥ 0 points, top to bottom) into a symmetric polygon. */
function sym(ctx, half) {
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(half[i], half[i + 1]);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(-half[i], half[i + 1]);
    poly(ctx, pts);
}
function glass(ctx, x, y, rx, ry, tint = '#5fd0ff') {
    ellipse(ctx, x, y, rx, ry);
    ctx.fillStyle = lin(ctx, x - rx, y - ry, x + rx, y + ry, [[0, '#d8f6ff'], [0.25, tint], [1, '#06202c']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
    ellipse(ctx, x - rx * 0.35, y - ry * 0.4, rx * 0.25, ry * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
}
function light(ctx, x, y, r, color) {
    circle(ctx, x, y, r * 2.4);
    ctx.fillStyle = rad(ctx, x, y, 0, r * 2.4, [[0, color], [1, 'rgba(0,0,0,0)']]);
    ctx.fill();
    circle(ctx, x, y, r);
    ctx.fillStyle = '#fff'; ctx.fill();
}
function panelLines(ctx, lines, color = 'rgba(0,0,0,0.35)', lw = 0.4) {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    for (const l of lines) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }
}
function rivets(ctx, pts, r = 0.45) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < pts.length; i += 2) { circle(ctx, pts[i], pts[i + 1], r); ctx.fill(); }
}
function noisy(ctx, w, h, seed, alpha, scale = 0.25) { // grime
    for (let i = 0; i < 160; i++) {
        const x = (vnoise(i * 3.1, seed, 7) - 0.5) * w, y = (vnoise(seed, i * 2.7, 9) - 0.5) * h;
        circle(ctx, x, y, 0.3 + vnoise(i, i, seed) * 1.2 * scale * 4);
        ctx.fillStyle = `rgba(0,0,0,${alpha * vnoise(i, 3, seed)})`;
        ctx.fill();
    }
}

// Faction colours
const KES = { l: '#b4c29a', m: '#73835f', d: '#2f3a27', accent: '#ff8a2a' };       // player: olive drab, hazard orange
const MER = { l: '#6d7480', m: '#3a3f49', d: '#15181d', accent: '#e0273c', eye: 'rgba(255,40,70,0.9)' };  // MERIDIAN: gunmetal, crimson

// ---------------------------------------------------------------- player

function drawHeli(ctx) {
    // tail boom
    sym(ctx, [2.6, 2, 2.2, 22, 1.4, 29]);
    metal(ctx, KES.l, KES.m, KES.d, 20);
    ctx.fillStyle = KES.accent; ctx.fillRect(-2.4, 12, 4.8, 3); ctx.fillStyle = '#111'; ctx.fillRect(-2.3, 15, 4.6, 1);
    // horizontal stabiliser
    sym(ctx, [1.5, 21, 9, 22.5, 9, 25, 1.5, 25]);
    metal(ctx, KES.l, KES.m, KES.d, 10);
    // tail fin (seen edge-on) + rotor hub
    rrect(ctx, -0.9, 25, 1.8, 7, 0.8); ctx.fillStyle = KES.d; ctx.fill();
    // stub wings
    sym(ctx, [5, -5, 17, -3.5, 17, 1.5, 5, 2.5]);
    metal(ctx, KES.l, KES.m, KES.d, 18);
    panelLines(ctx, [[-16, -1, -6, -0.5], [6, -0.5, 16, -1]]);
    for (const s of [-1, 1]) { rrect(ctx, s * 13.5 - 1.2, -6, 2.4, 8.5, 1); ctx.fillStyle = '#1a1f16'; ctx.fill(); }
    // fuselage
    sym(ctx, [0, -27, 3.5, -25, 6.5, -18, 7.5, -8, 7, 2, 5, 8, 3, 11]);
    metal(ctx, KES.l, KES.m, KES.d, 26);
    // engine nacelles
    for (const s of [-1, 1]) {
        rrect(ctx, s * 5 - 2.6, -4, 5.2, 13, 2.2);
        metal(ctx, '#8d9b7c', KES.m, KES.d, 10);
        ellipse(ctx, s * 5, 8.2, 1.8, 1.2); ctx.fillStyle = '#0b0d0a'; ctx.fill();
        panelLines(ctx, [[s * 5 - 1.6, 0, s * 5 + 1.6, 0], [s * 5 - 1.6, 3, s * 5 + 1.6, 3]], 'rgba(0,0,0,0.45)');
    }
    // canopy (tandem)
    glass(ctx, 0, -18.5, 3.6, 4.6);
    glass(ctx, 0, -10.5, 4.3, 4.2);
    // chin gun
    circle(ctx, 0, -23.5, 2.1); ctx.fillStyle = '#16190f'; ctx.fill();
    ctx.fillStyle = '#2a2d26'; ctx.fillRect(-0.6, -30, 1.2, 6.5);
    // markings
    ctx.fillStyle = KES.accent;
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 11, -1); ctx.fillRect(-1.3, -2.8, 2.6, 0.9); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 2.4px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('77', 0, 5.2);
    rivets(ctx, [-6, -6, 6, -6, -6.5, -1, 6.5, -1, -5, 6, 5, 6]);
    // nav lights
    light(ctx, -17, -1, 0.6, 'rgba(255,40,40,0.8)');
    light(ctx, 17, -1, 0.6, 'rgba(40,255,90,0.8)');
}

function drawRotor(ctx, w, h, tint = 'rgba(20,22,24,') {
    const R = w / 2 - 0.5;
    circle(ctx, 0, 0, R);
    ctx.fillStyle = rad(ctx, 0, 0, R * 0.2, R, [[0, tint + '0.10)'], [0.85, tint + '0.16)'], [0.97, tint + '0.28)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fill();
    for (let b = 0; b < 4; b++) {
        ctx.save();
        ctx.rotate(b * TAU / 4);
        for (let k = 0; k < 8; k++) { // smeared blade
            ctx.save();
            ctx.rotate(-k * 0.05);
            ctx.beginPath();
            ctx.moveTo(-0.9, 0); ctx.lineTo(-0.7, -R); ctx.lineTo(0.9, -R); ctx.lineTo(1.1, 0); ctx.closePath();
            ctx.fillStyle = tint + (0.55 - k * 0.065) + ')';
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
    circle(ctx, 0, 0, 2.6); ctx.fillStyle = '#2d302a'; ctx.fill();
    circle(ctx, 0, 0, 1.2); ctx.fillStyle = '#777'; ctx.fill();
}

function drawPodMsl(ctx) {
    for (const x of [-1.6, 1.6]) {
        rrect(ctx, x - 1.2, -7, 2.4, 13, 1.2); metal(ctx, '#d9d3c0', '#9a9583', '#4b483f', 8, 'rgba(0,0,0,0.7)', 0.4);
        ctx.fillStyle = '#c33'; ctx.fillRect(x - 1.1, -6.9, 2.2, 1.8);
    }
}
function drawPodRkt(ctx) {
    rrect(ctx, -3, -7, 6, 14, 2.5); metal(ctx, '#5a6150', '#383e31', '#181b14', 8);
    ctx.fillStyle = '#0b0b0b';
    for (const [x, y] of [[-1.3, -5], [1.3, -5], [0, -3.2], [-1.3, -1.4], [1.3, -1.4]]) { circle(ctx, x, y, 0.8); ctx.fill(); }
}
function drawDrone(ctx) {
    for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
        circle(ctx, x, y, 3.4); ctx.fillStyle = 'rgba(20,20,20,0.35)'; ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.strokeStyle = '#2b3227'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
    sym(ctx, [0, -5, 2.6, -3, 2.6, 3, 0, 4.5]); metal(ctx, KES.l, KES.m, KES.d, 6);
    light(ctx, 0, -3, 0.6, 'rgba(255,160,40,0.9)');
}

// ---------------------------------------------------------------- enemies

function drawHornet(ctx) {
    for (const s of [-1, 1]) { rrect(ctx, s * 9 - 2.2, -5, 4.4, 11, 2); metal(ctx, MER.l, MER.m, MER.d, 10); }
    ctx.fillStyle = MER.d; ctx.fillRect(-9, -1, 18, 2.4);
    sym(ctx, [0, -11, 4, -8, 5.2, -1, 4, 6, 1.6, 11]);
    metal(ctx, MER.l, MER.m, MER.d, 12);
    ctx.fillStyle = MER.accent; ctx.fillRect(-4, 2, 8, 1.4);
    light(ctx, 0, -7.5, 1.2, MER.eye);
    rivets(ctx, [-3, -3, 3, -3, -3, 3, 3, 3], 0.35);
}
function drawJet(ctx) {
    sym(ctx, [0, -21, 2.5, -14, 4, -2, 18, 12, 18, 15, 5, 13, 5, 18, 8.5, 21, 3, 21]);
    metal(ctx, MER.l, MER.m, MER.d, 22);
    panelLines(ctx, [[-14, 11, -4, 3], [14, 11, 4, 3], [0, -12, 0, 18]], 'rgba(0,0,0,0.4)');
    ctx.fillStyle = MER.accent;
    for (const s of [-1, 1]) { poly(ctx, [s * 13, 9, s * 17, 12, s * 17, 13.5, s * 12, 10.5]); ctx.fill(); }
    glass(ctx, 0, -9, 1.8, 4, '#ff5a6a');
    for (const s of [-1, 1]) { rrect(ctx, s * 3 - 1.5, 17, 3, 3.2, 1); ctx.fillStyle = '#0a0a0c'; ctx.fill(); }
}
function drawGunship(ctx) {
    sym(ctx, [2.8, 4, 2.2, 28, 1.5, 34]); metal(ctx, MER.l, MER.m, MER.d, 24);
    sym(ctx, [1.5, 27, 10, 28.5, 10, 31, 1.5, 31]); metal(ctx, MER.l, MER.m, MER.d, 12);
    sym(ctx, [6, -6, 23, -4, 23, 3, 6, 4]); metal(ctx, MER.l, MER.m, MER.d, 24);
    for (const s of [-1, 1]) for (const k of [0, 1]) { rrect(ctx, s * (14 + k * 6) - 2, -8, 4, 12, 1.6); metal(ctx, '#55585e', '#2a2c31', '#0c0d10', 8, 'rgba(0,0,0,0.8)', 0.4); ctx.fillStyle = MER.accent; ctx.fillRect(s * (14 + k * 6) - 1.8, -7.8, 3.6, 1.2); }
    sym(ctx, [0, -30, 4.5, -27, 8.5, -18, 9.5, -6, 9, 4, 6.5, 10, 3.5, 14]);
    metal(ctx, MER.l, MER.m, MER.d, 28);
    for (const s of [-1, 1]) { rrect(ctx, s * 6 - 3, -3, 6, 15, 2.5); metal(ctx, '#7b818b', MER.m, MER.d, 12); }
    glass(ctx, 0, -20, 3.8, 5.5, '#ff4a5a');
    ctx.fillStyle = MER.accent; ctx.fillRect(-9, -1, 18, 2);
    circle(ctx, 0, -26.5, 2.4); ctx.fillStyle = '#111'; ctx.fill();
    rivets(ctx, [-7, -12, 7, -12, -8, 0, 8, 0, -6, 8, 6, 8]);
}
function drawBomber(ctx) {
    sym(ctx, [0, -38, 10, -30, 64, 10, 64, 18, 44, 22, 30, 16, 16, 26, 0, 22]);
    metal(ctx, '#5e646e', '#343842', '#121419', 60);
    panelLines(ctx, [[-56, 12, -12, -18], [56, 12, 12, -18], [-40, 18, -8, 4], [40, 18, 8, 4], [0, -34, 0, 20]], 'rgba(0,0,0,0.35)', 0.6);
    for (const s of [-1, 1]) for (const x of [16, 30]) {
        rrect(ctx, s * x - 3.5, 2, 7, 18, 3); metal(ctx, '#6d737d', '#3a3f49', '#101216', 12);
        ellipse(ctx, s * x, 20, 2.6, 1.6); ctx.fillStyle = '#0a0a0a'; ctx.fill();
    }
    ctx.fillStyle = MER.accent;
    for (const s of [-1, 1]) { poly(ctx, [s * 50, 10, s * 63, 11, s * 63, 14, s * 48, 13]); ctx.fill(); }
    glass(ctx, 0, -24, 4, 7, '#ff4a5a');
    light(ctx, -62, 14, 1, 'rgba(255,40,40,0.9)'); light(ctx, 62, 14, 1, 'rgba(255,40,40,0.9)');
    noisy(ctx, 120, 50, 3, 0.25);
}
function drawCarrier(ctx) {
    rrect(ctx, -40, -56, 80, 112, 30);
    metal(ctx, '#666d78', '#363b45', '#111318', 70);
    rrect(ctx, -14, -50, 28, 100, 6); ctx.fillStyle = '#20232a'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,40,0.7)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.stroke(); ctx.setLineDash([]);
    for (const y of [-30, 0, 30]) { rrect(ctx, -10, y - 6, 20, 12, 2); ctx.fillStyle = '#0d0e11'; ctx.fill(); ctx.strokeStyle = MER.accent; ctx.lineWidth = 0.6; ctx.stroke(); }
    for (const [x, y] of [[-52, -34], [52, -34], [-52, 34], [52, 34]]) {
        circle(ctx, x, y, 17); metal(ctx, '#575d67', '#2c3038', '#0c0d10', 18);
        circle(ctx, x, y, 13.5); ctx.fillStyle = '#08090b'; ctx.fill();
        ctx.strokeStyle = '#3a3f49'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 52 * Math.sign(x) / 4, y); ctx.lineTo(x - 30 * Math.sign(x) / 1.2, y); ctx.stroke();
    }
    for (const s of [-1, 1]) { ctx.fillStyle = '#3a3f49'; ctx.fillRect(s > 0 ? 36 : -42, -36, 6, 4); ctx.fillRect(s > 0 ? 36 : -42, 32, 6, 4); }
    for (const [x, y] of [[-30, -48], [30, -48], [-30, 48], [30, 48]]) light(ctx, x, y, 1.1, MER.eye);
    noisy(ctx, 70, 100, 5, 0.25);
}
function drawFan(ctx, w) {
    const R = w / 2 - 0.5;
    for (let b = 0; b < 6; b++) {
        ctx.save(); ctx.rotate(b * TAU / 6);
        poly(ctx, [-1.2, 0, -2.5, -R, 2.5, -R, 1.2, 0]); ctx.fillStyle = 'rgba(40,44,50,0.75)'; ctx.fill();
        ctx.restore();
    }
    circle(ctx, 0, 0, 3); ctx.fillStyle = '#555'; ctx.fill();
}
function drawMine(ctx) {
    for (let i = 0; i < 8; i++) {
        ctx.save(); ctx.rotate(i * TAU / 8);
        poly(ctx, [-1.4, -6, 0, -10.5, 1.4, -6]); ctx.fillStyle = '#2a2d33'; ctx.fill();
        ctx.restore();
    }
    circle(ctx, 0, 0, 7); metal(ctx, '#7b818b', '#41454e', '#121418', 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; circle(ctx, 0, 0, 4.5); ctx.stroke();
    light(ctx, 0, 0, 1.6, 'rgba(255,200,40,0.9)');
}
function drawEMissile(ctx) {
    rrect(ctx, -1.6, -9, 3.2, 17, 1.6); metal(ctx, '#c9c6bd', '#8d8a81', '#3f3d38', 8, 'rgba(0,0,0,0.7)', 0.4);
    ctx.fillStyle = MER.accent; poly(ctx, [-1.6, -7, 0, -10.5, 1.6, -7]); ctx.fill();
    for (const s of [-1, 1]) { poly(ctx, [s * 1.5, 4, s * 4, 8, s * 1.5, 8]); ctx.fillStyle = '#555'; ctx.fill(); }
}
function treads(ctx, w, h) {
    for (const s of [-1, 1]) {
        rrect(ctx, s * (w / 2 - 3) - 3, -h / 2, 6, h, 1.5); ctx.fillStyle = '#1b1c1a'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let y = -h / 2 + 1; y < h / 2; y += 2.2) ctx.fillRect(s * (w / 2 - 3) - 2.6, y, 5.2, 0.8);
    }
}
function drawTankBody(ctx) {
    treads(ctx, 30, 36);
    rrect(ctx, -10, -15, 20, 30, 3); metal(ctx, '#6a6f62', '#43473c', '#1a1c16', 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) ctx.fillRect(-7, 7 + i * 1.8, 14, 0.8);
    ctx.fillStyle = MER.accent; ctx.fillRect(-10, -15, 20, 1.6);
    noisy(ctx, 24, 30, 11, 0.2);
}
function drawTankTurret(ctx) {
    ctx.fillStyle = '#25271f'; rrect(ctx, -1.4, -19, 2.8, 16, 0.6); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-1.8, -20, 3.6, 2);
    rrect(ctx, -7, -6, 14, 14, 5); metal(ctx, '#7c8172', '#4b4f43', '#1c1e18', 10);
    circle(ctx, 3, 3, 2); ctx.fillStyle = '#2b2d26'; ctx.fill();
    light(ctx, -3, -2, 0.7, MER.eye);
}
function drawPad(ctx, r, sides = 8) {
    const pts = [];
    for (let i = 0; i < sides; i++) { const a = i * TAU / sides + Math.PI / sides; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(ctx, pts); metal(ctx, '#8a8a80', '#5d5d55', '#2a2a26', r);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6;
    poly(ctx, pts.map((v) => v * 0.78)); ctx.stroke();
}
function drawAABase(ctx) {
    drawPad(ctx, 14);
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ellipse(ctx, Math.cos(a) * 11.5, Math.sin(a) * 11.5, 2.4, 1.6, a + Math.PI / 2); ctx.fillStyle = '#9b8f6a'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.4; ctx.stroke(); }
}
function drawAAGun(ctx) {
    for (const x of [-2.4, 2.4]) { ctx.fillStyle = '#1d1e1b'; ctx.fillRect(x - 0.8, -17, 1.6, 14); ctx.fillStyle = '#000'; ctx.fillRect(x - 1, -17.5, 2, 1.4); }
    rrect(ctx, -6, -5, 12, 11, 3); metal(ctx, '#777c6f', '#4a4e43', '#1b1d17', 8);
    light(ctx, 0, 1, 0.7, MER.eye);
}
function drawSamBase(ctx) {
    drawPad(ctx, 16, 6);
    ctx.strokeStyle = 'rgba(255,200,0,0.5)'; ctx.lineWidth = 1; circle(ctx, 0, 0, 12); ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
}
function drawSamRack(ctx) {
    rrect(ctx, -9, -10, 18, 20, 2); metal(ctx, '#6e7366', '#454a3e', '#191b15', 10);
    for (const x of [-5, -1.7, 1.7, 5]) { rrect(ctx, x - 1.3, -12, 2.6, 14, 1.3); metal(ctx, '#e3e0d6', '#a29f95', '#4b4943', 6, 'rgba(0,0,0,0.6)', 0.3); ctx.fillStyle = MER.accent; ctx.fillRect(x - 1.2, -12, 2.4, 1.6); }
}
function drawBunker(ctx) {
    circle(ctx, 0, 0, 22); metal(ctx, '#8d8c84', '#5c5b55', '#24241f', 22);
    circle(ctx, 0, 0, 16); ctx.fillStyle = rad(ctx, -5, -5, 2, 18, [[0, '#a3a299'], [1, '#4a4943']]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.save(); ctx.rotate(a); ctx.fillStyle = '#0c0c0b'; ctx.fillRect(-2.5, -19.5, 5, 2.2); ctx.restore(); }
    circle(ctx, 0, 0, 6); metal(ctx, '#666', '#333', '#111', 6);
    light(ctx, 0, 0, 1.6, 'rgba(80,255,120,0.9)');
    noisy(ctx, 40, 40, 13, 0.25);
}
function drawBoat(ctx) {
    sym(ctx, [0, -27, 5, -18, 9, -4, 9, 20, 7, 26]); metal(ctx, '#6d747e', '#3d434c', '#14171b', 26);
    sym(ctx, [0, -24, 3.8, -16, 7, -4, 7, 19, 5.5, 23]); ctx.fillStyle = '#4e5459'; ctx.fill();
    rrect(ctx, -5, 2, 10, 12, 1.6); metal(ctx, '#899099', '#555b63', '#202429', 8);
    glass(ctx, 0, 4.5, 3.5, 1.5, '#ff4a5a');
    ctx.fillStyle = MER.accent; ctx.fillRect(-7, 18, 14, 1.5);
    rivets(ctx, [-6, -6, 6, -6, -6, 16, 6, 16]);
}
function drawBoatTurret(ctx) {
    ctx.fillStyle = '#1b1c1f'; ctx.fillRect(-0.9, -13, 1.8, 10);
    circle(ctx, 0, 0, 4.5); metal(ctx, '#868c95', '#50555d', '#1c1e22', 5);
}
function drawIcebreaker(ctx) {
    sym(ctx, [0, -55, 8, -46, 18, -28, 21, -5, 21, 46, 17, 54]); metal(ctx, '#7b8189', '#4a5058', '#1a1d21', 55);
    sym(ctx, [0, -53, 7, -45, 15.5, -28, 18, -5, 18, 45, 14, 51]); ctx.fillStyle = '#4c535a'; ctx.fill();
    sym(ctx, [0, -55, 8, -46, 13, -36, 0, -40]); ctx.fillStyle = MER.accent; ctx.fill();
    rrect(ctx, -12, 8, 24, 26, 3); metal(ctx, '#e0e2e4', '#9da1a6', '#4a4d51', 20);
    glass(ctx, 0, 11, 9, 2, '#ff5060');
    circle(ctx, 0, 40, 5); ctx.fillStyle = '#26292d'; ctx.fill();
    for (const y of [-26, -12]) { circle(ctx, 0, y, 6); ctx.fillStyle = '#2d3136'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.6; circle(ctx, 0, 46, 6); ctx.stroke();
    noisy(ctx, 36, 100, 19, 0.3);
}
function drawTruck(ctx) {
    rrect(ctx, -6, -15, 12, 9, 2); metal(ctx, '#d65e2a', '#9b3f18', '#3f1a0a', 10);
    glass(ctx, 0, -12.5, 4, 1.4, '#8fd9ff');
    rrect(ctx, -6.5, -5, 13, 21, 5); metal(ctx, '#e8e6df', '#aaa79d', '#4f4d47', 14);
    ctx.fillStyle = MER.accent; ctx.fillRect(-6.5, 4, 13, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-0.4, -4, 0.8, 19);
}
function drawFuelTank(ctx) {
    circle(ctx, 0, 0, 18); metal(ctx, '#e6e3da', '#b2aea3', '#5a574f', 18);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5;
    for (const r of [14, 9]) { circle(ctx, 0, 0, r); ctx.stroke(); }
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.stroke(); }
    ctx.fillStyle = '#d93'; ctx.fillRect(-18, -1.6, 36, 3.2);
    ctx.fillStyle = '#222'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FUEL', 0, 7);
    circle(ctx, 0, 0, 3); ctx.fillStyle = '#777'; ctx.fill();
}
function drawRadarBase(ctx) { drawPad(ctx, 13, 6); circle(ctx, 0, 0, 5); metal(ctx, '#888', '#555', '#222', 5); }
function drawRadarDish(ctx) {
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, Math.PI, TAU); ctx.lineTo(16, 2); ctx.ellipse(0, 2, 16, 4, 0, 0, Math.PI, false); ctx.closePath();
    metal(ctx, '#d6dade', '#9aa0a6', '#4a4e53', 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.4;
    for (let x = -12; x <= 12; x += 4) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x * 0.9, 3); ctx.stroke(); }
    light(ctx, 0, -1, 0.9, MER.eye);
}
function drawDepot(ctx) {
    rrect(ctx, -25, -21, 50, 42, 2); metal(ctx, '#6f6b5d', '#4c493e', '#1f1e19', 30);
    const crates = [[-18, -14, 12, 10], [-4, -15, 10, 12], [9, -13, 13, 11], [-17, 0, 14, 12], [1, 1, 11, 11], [14, 2, 9, 13], [-10, 14, 10, 5]];
    for (const [x, y, w, h] of crates) {
        rrect(ctx, x, y, w, h, 0.8); metal(ctx, '#b48a4e', '#86642f', '#3e2c13', 10, 'rgba(0,0,0,0.7)', 0.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
    }
    ctx.fillStyle = '#ffc840'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚙', 18, -15);
}
function drawTurretBase(ctx) { drawPad(ctx, 13, 4); }
function drawTurretGun(ctx) {
    for (const a of [-0.25, 0, 0.25]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = '#18191b'; ctx.fillRect(-0.8, -15, 1.6, 12); ctx.restore(); }
    for (const a of [Math.PI - 0.25, Math.PI, Math.PI + 0.25]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = '#18191b'; ctx.fillRect(-0.8, -15, 1.6, 12); ctx.restore(); }
    circle(ctx, 0, 0, 6.5); metal(ctx, '#8b8f97', '#555960', '#1e2023', 7);
    light(ctx, 0, 0, 1, 'rgba(255,60,200,0.9)');
}
function drawWalker(ctx) {
    sym(ctx, [0, -15, 8, -12, 13, -2, 12, 8, 6, 14]); metal(ctx, '#5f6870', '#363d44', '#121518', 16);
    ctx.fillStyle = '#1a1d20'; ctx.fillRect(-3, -17, 6, 5);
    for (const s of [-1, 1]) { ctx.fillStyle = '#121314'; ctx.fillRect(s * 9 - 1, -18, 2, 9); }
    glass(ctx, 0, -6, 4, 2.4, '#ff4a5a');
    ctx.fillStyle = MER.accent; ctx.fillRect(-9, 4, 18, 1.4);
}
function drawWalkerLeg(ctx) {
    rrect(ctx, -2, -10, 4, 20, 2); metal(ctx, '#4d545b', '#2c3136', '#101214', 8);
    ellipse(ctx, 0, 9, 4, 3); ctx.fillStyle = '#1b1d20'; ctx.fill();
}
function drawWarhawk(ctx) {
    sym(ctx, [0, -48, 8, -42, 14, -24, 15, 30, 10, 46, 0, 50]);
    metal(ctx, '#666c76', '#3a3f48', '#121418', 50);
    sym(ctx, [12, -6, 38, -2, 38, 8, 12, 10]); metal(ctx, '#5d636d', '#353a43', '#101215', 30);
    for (const s of [-1, 1]) for (const k of [0, 1]) { rrect(ctx, s * (22 + k * 10) - 3, -10, 6, 18, 2); metal(ctx, '#4e525a', '#2a2d33', '#0b0c0e', 10); ctx.fillStyle = MER.accent; ctx.fillRect(s * (22 + k * 10) - 2.6, -9.8, 5.2, 1.6); }
    for (const y of [-26, 26]) { circle(ctx, 0, y, 9); metal(ctx, '#7c838d', '#454b54', '#16181c', 10); }
    glass(ctx, 0, -38, 5, 6, '#ff4a5a');
    ctx.fillStyle = MER.accent; ctx.fillRect(-15, 6, 30, 2.4);
    panelLines(ctx, [[-12, -14, 12, -14], [-14, 14, 14, 14], [-13, 36, 13, 36]], 'rgba(0,0,0,0.4)', 0.6);
    rivets(ctx, [-10, -18, 10, -18, -12, 0, 12, 0, -11, 18, 11, 18, -8, 40, 8, 40]);
    noisy(ctx, 30, 90, 23, 0.3);
}
function drawBeaconPad(ctx) {
    circle(ctx, 0, 0, 13); ctx.fillStyle = 'rgba(30,30,30,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,0.95)'; ctx.lineWidth = 1.4; circle(ctx, 0, 0, 11); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,180,0.95)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, 1);
}
function drawPerson(ctx) {
    circle(ctx, 0, 1, 1.8); ctx.fillStyle = '#3b5a8a'; ctx.fill();
    circle(ctx, 0, -0.6, 1.1); ctx.fillStyle = '#e6c29a'; ctx.fill();
}

// ---------------------------------------------------------------- pickups & ui

function drawGear(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; const r = i % 2 ? 4.6 : 6.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); metal(ctx, '#ffe9a8', '#e0a73a', '#7a4e10', 6, 'rgba(60,30,0,0.9)', 0.5);
    circle(ctx, 0, 0, 1.8); ctx.fillStyle = '#5a3a08'; ctx.fill();
}
function pickupFrame(ctx, color) {
    rrect(ctx, -8, -8, 16, 16, 4); ctx.fillStyle = 'rgba(10,14,18,0.85)'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
}
function drawRepair(ctx) {
    pickupFrame(ctx, '#5dff9a');
    ctx.fillStyle = '#5dff9a'; ctx.fillRect(-1.6, -5, 3.2, 10); ctx.fillRect(-5, -1.6, 10, 3.2);
}
function drawBombPick(ctx) {
    pickupFrame(ctx, '#7fd3ff');
    ctx.fillStyle = '#7fd3ff'; poly(ctx, [1, -6, -4, 1, -0.5, 1, -1.5, 6, 4, -1, 0.5, -1]); ctx.fill();
}
function drawOdCell(ctx) {
    pickupFrame(ctx, '#ffcf3a');
    ctx.fillStyle = '#ffcf3a'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OD', 0, 0.5);
}
function drawHitbox(ctx) {
    circle(ctx, 0, 0, 6.5); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.2; ctx.stroke();
    circle(ctx, 0, 0, 4.4); ctx.fillStyle = '#ff2e4a'; ctx.fill();
    circle(ctx, 0, 0, 2.2); ctx.fillStyle = '#fff'; ctx.fill();
}
function drawLock(ctx) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(i * TAU / 4);
        ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-18, -18); ctx.lineTo(-18, -14); ctx.stroke();
        ctx.restore();
    }
}

// ---------------------------------------------------------------- projectiles & fx (white, tinted at runtime)

function drawTrace(ctx, w, h) {
    ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    rrect(ctx, -w / 2 + 0.5, -h / 2, w - 1, h, (w - 1) / 2); ctx.fill();
}
function drawPMissile(ctx) {
    rrect(ctx, -1.5, -7, 3, 13, 1.4); metal(ctx, '#f4f0e6', '#c4bfb3', '#6b675e', 7, 'rgba(0,0,0,0.6)', 0.3);
    ctx.fillStyle = '#ff8a2a'; poly(ctx, [-1.5, -5.5, 0, -8, 1.5, -5.5]); ctx.fill();
    for (const s of [-1, 1]) { poly(ctx, [s * 1.4, 3, s * 3.5, 6.5, s * 1.4, 6.5]); ctx.fillStyle = '#6d6a62'; ctx.fill(); }
}
function drawPRocket(ctx) {
    rrect(ctx, -1.2, -6, 2.4, 11, 1.1); metal(ctx, '#c8c4b8', '#8d897e', '#45423b', 6, 'rgba(0,0,0,0.6)', 0.3);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(-1.1, -6, 2.2, 1.6);
}
function drawGlow(ctx, w) {
    circle(ctx, 0, 0, w / 2);
    ctx.fillStyle = rad(ctx, 0, 0, 0, w / 2, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.75)'], [0.45, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fill();
}
function drawSoft(ctx, w) {
    circle(ctx, 0, 0, w / 2);
    ctx.fillStyle = rad(ctx, 0, 0, 0, w / 2, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fill();
}
function puffPixels(seed, kind) {
    return (ctx, x0, y0, pw, ph) => {
        const img = ctx.getImageData(x0, y0, pw, ph);
        const d = img.data;
        for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
            const u = (i + 0.5) / pw * 2 - 1, v = (j + 0.5) / ph * 2 - 1;
            const r = Math.sqrt(u * u + v * v);
            const a = Math.atan2(v, u);
            const n = fbm(Math.cos(a) * 1.6 + seed * 7, Math.sin(a) * 1.6 + r * 1.2, seed + 3, 4);
            const n2 = fbm(u * 3 + seed, v * 3 - seed, seed + 9, 4);
            let edge = 0.62 + (n - 0.5) * 0.7;
            let alpha = Math.max(0, Math.min(1, (edge - r) / 0.22));
            let lum;
            if (kind === 'fire') { lum = 0.55 + n2 * 0.6 - r * 0.25; alpha *= 0.85 + n2 * 0.3; }
            else { lum = 0.65 + (n2 - 0.5) * 0.9 - r * 0.15; alpha *= 0.55 + n2 * 0.6; }
            const k = (j * pw + i) * 4;
            const L = Math.max(0, Math.min(1, lum)) * 255;
            d[k] = L; d[k + 1] = L; d[k + 2] = L; d[k + 3] = Math.max(0, Math.min(1, alpha)) * 255;
        }
        ctx.putImageData(img, x0, y0);
    };
}
function drawSpark(ctx, w, h) {
    ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, [[0, 'rgba(255,255,255,0)'], [0.35, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    ellipse(ctx, 0, 0, w / 2, h / 2); ctx.fill();
}
function drawRing(ctx, w) {
    const R = w / 2;
    circle(ctx, 0, 0, R);
    ctx.fillStyle = rad(ctx, 0, 0, 0, R, [[0, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,0)'], [0.88, 'rgba(255,255,255,0.9)'], [0.94, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fill();
}
function drawFlare(ctx, w) {
    const R = w / 2;
    drawSoft(ctx, w * 0.3);
    for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 4);
        const len = i % 2 ? R * 0.55 : R;
        ctx.fillStyle = lin(ctx, 0, -len, 0, len, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
        ellipse(ctx, 0, 0, i % 2 ? 0.8 : 1.4, len); ctx.fill();
        ctx.restore();
    }
}
function drawDebris(seed) {
    return (ctx, w) => {
        const pts = [];
        const n = 5 + (seed % 3);
        for (let i = 0; i < n; i++) { const a = i * TAU / n + vnoise(i, seed, 1) * 0.8; const r = w / 2 * (0.55 + vnoise(seed, i, 2) * 0.45); pts.push(Math.cos(a) * r, Math.sin(a) * r); }
        poly(ctx, pts); metal(ctx, '#7a7a74', '#3d3d39', '#141413', w / 2, 'rgba(0,0,0,0.8)', 0.4);
    };
}
function scorchPixels(seed, crater) {
    return (ctx, x0, y0, pw, ph) => {
        const img = ctx.getImageData(x0, y0, pw, ph);
        const d = img.data;
        for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
            const u = (i + 0.5) / pw * 2 - 1, v = (j + 0.5) / ph * 2 - 1;
            const r = Math.sqrt(u * u + v * v);
            const a = Math.atan2(v, u);
            const n = fbm(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, seed, 4);
            const n2 = fbm(u * 6, v * 6, seed + 5, 3);
            const edge = 0.55 + (n - 0.5) * 0.8;
            let alpha = Math.max(0, Math.min(1, (edge - r) / 0.35)) * (0.55 + n2 * 0.5);
            // radial streaks
            alpha += Math.max(0, (vnoise(a * 9 + seed, 1, seed) - 0.6) * 1.4) * Math.max(0, 1 - r) * 0.6;
            let L = 18 + n2 * 22;
            if (crater && r < 0.35) { L = 10 + (0.35 - r) * 60 * (v < 0 ? 0.5 : 1.4); alpha = Math.max(alpha, 0.95); }
            const k = (j * pw + i) * 4;
            d[k] = L * 1.1; d[k + 1] = L; d[k + 2] = L * 0.9; d[k + 3] = Math.max(0, Math.min(1, alpha)) * 235;
        }
        ctx.putImageData(img, x0, y0);
    };
}
function drawSplash(ctx, w) {
    const R = w / 2;
    drawRing(ctx, w);
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; const r = R * (0.5 + vnoise(i, 2, 4) * 0.35); circle(ctx, Math.cos(a) * r, Math.sin(a) * r, 1 + vnoise(i, 5, 6)); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); }
}
function drawTread(ctx, w, h) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-w / 2, -h / 2, w * 0.3, h); ctx.fillRect(w / 2 - w * 0.3, -h / 2, w * 0.3, h); }
function drawShell(ctx, w, h) { rrect(ctx, -w / 2, -h / 2, w, h, w / 3); metal(ctx, '#ffe39a', '#d1a542', '#6e4f10', 3, null); }
function drawBeam(ctx, w, h) {
    // horizontal beam: core along x, falling off in y
    ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.35)'], [0.45, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.95)'], [0.7, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(-w / 2, -h / 2, w, h);
}
function drawDigit(ch) {
    return (ctx, w, h) => {
        ctx.font = `900 ${h * 0.95}px "Arial Black", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(ch, 0, 0.5);
        ctx.fillStyle = '#fff'; ctx.fillText(ch, 0, 0.5);
    };
}
function drawCloud(seed) {
    return (ctx, x0, y0, pw, ph) => {
        const img = ctx.getImageData(x0, y0, pw, ph);
        const d = img.data;
        for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
            const u = (i + 0.5) / pw * 2 - 1, v = (j + 0.5) / ph * 2 - 1;
            const r = Math.sqrt(u * u + v * v);
            const n = fbm(u * 2.2 + seed * 3, v * 2.2 - seed, seed + 31, 5);
            const a = Math.max(0, Math.min(1, (n * 1.4 - 0.35 - r * 0.85) * 2.2));
            const L = 200 + n * 55 - Math.max(0, v) * 40;
            const k = (j * pw + i) * 4;
            d[k] = L; d[k + 1] = L; d[k + 2] = Math.min(255, L * 1.04); d[k + 3] = a * 255;
        }
        ctx.putImageData(img, x0, y0);
    };
}

// ---------------------------------------------------------------- bullets (channel encoded)

/** sdf(u, v) in sprite units (u, v ∈ [-w/2, w/2]), negative inside. core/rim widths in units. */
function bulletPixels(sdf, w, h, coreIn, rimW) {
    return (ctx, x0, y0, pw, ph) => {
        const img = ctx.getImageData(x0, y0, pw, ph);
        const d = img.data;
        const ss = 3;
        for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
            let core = 0, body = 0, rim = 0;
            for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
                const u = ((i + (sx + 0.5) / ss) / pw - 0.5) * w;
                const v = ((j + (sy + 0.5) / ss) / ph - 0.5) * h;
                const s = sdf(u, v);
                if (s < -coreIn) core++;
                else if (s < 0) body++;
                else if (s < rimW) rim += 1 - s / rimW * 0.3;
            }
            const n = ss * ss;
            const k = (j * pw + i) * 4;
            d[k] = core / n * 255; d[k + 1] = body / n * 255; d[k + 2] = Math.min(1, rim / n) * 255; d[k + 3] = 255;
        }
        ctx.putImageData(img, x0, y0);
    };
}
const sdCircle = (r) => (u, v) => Math.sqrt(u * u + v * v) - r;
const sdEllipse = (a, b) => (u, v) => { const k = Math.sqrt((u / a) ** 2 + (v / b) ** 2); return (k - 1) * Math.min(a, b); };
const sdStar = (r, n = 5) => (u, v) => {
    const a = Math.atan2(v, u), d = Math.sqrt(u * u + v * v);
    const k = Math.cos(n * a) * 0.28 + 0.72;
    return d - r * k;
};
const sdArrow = (w, h) => (u, v) => {
    // arrowhead pointing up
    const t = (v + h / 2) / h;
    const half = w / 2 * Math.min(1, t * 1.6) * (t < 0.85 ? 1 : (1 - t) / 0.15 * 0.6 + 0.4);
    const out = Math.abs(u) - half;
    return Math.max(out, Math.abs(v) - h / 2);
};
const sdRingB = (r, t) => (u, v) => Math.abs(Math.sqrt(u * u + v * v) - r) - t;

// ---------------------------------------------------------------- main atlas

export function mainJobs() {
    const J = [];
    const add = (name, w, h, draw) => J.push({ name, w, h, draw });
    const pix = (name, w, h, pixels) => J.push({ name, w, h, pixels });
    add('heli', 40, 64, drawHeli);
    add('rotor', 66, 66, (c, w) => drawRotor(c, w));
    add('rotor_gold', 66, 66, (c, w) => drawRotor(c, w, 'rgba(70,52,10,'));
    add('rotor_e', 66, 66, (c, w) => drawRotor(c, w, 'rgba(30,8,10,'));
    add('tailrotor', 12, 12, (c, w) => drawRotor(c, w));
    add('pod_msl', 7, 15, drawPodMsl);
    add('pod_rkt', 7, 15, drawPodRkt);
    add('drone', 18, 18, drawDrone);
    add('hornet', 26, 26, drawHornet);
    add('jet', 40, 44, drawJet);
    add('gunship', 50, 72, drawGunship);
    add('bomber', 132, 80, drawBomber);
    add('carrier', 144, 118, drawCarrier);
    add('fan', 30, 30, drawFan);
    add('mine', 22, 22, drawMine);
    add('emissile', 9, 22, drawEMissile);
    add('tank', 30, 38, drawTankBody);
    add('tank_t', 16, 42, drawTankTurret);
    add('aa', 32, 32, drawAABase);
    add('aa_t', 14, 38, drawAAGun);
    add('sam', 34, 34, drawSamBase);
    add('sam_t', 20, 26, drawSamRack);
    add('bunker', 46, 46, drawBunker);
    add('boat', 20, 56, drawBoat);
    add('boat_t', 10, 28, drawBoatTurret);
    add('icebreaker', 44, 112, drawIcebreaker);
    add('truck', 14, 32, drawTruck);
    add('fueltank', 38, 38, drawFuelTank);
    add('radar', 28, 28, drawRadarBase);
    add('radar_t', 34, 20, drawRadarDish);
    add('depot', 52, 44, drawDepot);
    add('turret', 28, 28, drawTurretBase);
    add('turret_t', 14, 32, drawTurretGun);
    add('walker', 28, 36, drawWalker);
    add('walker_leg', 9, 22, drawWalkerLeg);
    add('warhawk', 80, 102, drawWarhawk);
    add('beacon', 28, 28, drawBeaconPad);
    add('person', 5, 5, drawPerson);
    add('gear', 14, 14, drawGear);
    add('repair', 18, 18, drawRepair);
    add('bombpick', 18, 18, drawBombPick);
    add('odcell', 18, 18, drawOdCell);
    add('hitbox', 15, 15, drawHitbox);
    add('lock', 40, 40, drawLock);
    add('trace', 4, 24, drawTrace);
    add('pmsl', 8, 17, drawPMissile);
    add('prkt', 5, 13, drawPRocket);
    add('glow', 64, 64, drawGlow);
    add('soft', 32, 32, drawSoft);
    for (let i = 0; i < 4; i++) pix('fire' + i, 48, 48, puffPixels(i + 1, 'fire'));
    for (let i = 0; i < 4; i++) pix('smoke' + i, 48, 48, puffPixels(i + 11, 'smoke'));
    add('spark', 6, 40, drawSpark);
    add('ring', 128, 128, drawRing);
    add('flare', 96, 96, drawFlare);
    for (let i = 0; i < 4; i++) add('debris' + i, 10, 10, drawDebris(i + 3));
    for (let i = 0; i < 3; i++) pix('scorch' + i, 96, 96, scorchPixels(i + 21, false));
    pix('crater', 80, 80, scorchPixels(29, true));
    add('splash', 64, 64, drawSplash);
    add('tread', 14, 5, drawTread);
    add('shell', 2.4, 5, drawShell);
    add('beam', 64, 24, drawBeam);
    for (let i = 0; i < 3; i++) pix('cloud' + i, 220, 160, drawCloud(i + 1));
    for (const ch of '0123456789x+') add('d_' + ch, 10, 14, drawDigit(ch));
    // bullets
    pix('b_pellet', 10, 10, bulletPixels(sdCircle(3.2), 10, 10, 1.3, 1.6));
    pix('b_orb', 16, 16, bulletPixels(sdCircle(5.4), 16, 16, 2.6, 2));
    pix('b_rice', 10, 18, bulletPixels(sdEllipse(3, 7.4), 10, 18, 1.2, 1.4));
    pix('b_star', 18, 18, bulletPixels(sdStar(7.2), 18, 18, 2.4, 1.8));
    pix('b_big', 34, 34, bulletPixels(sdCircle(12.5), 34, 34, 6, 3));
    pix('b_arrow', 12, 16, bulletPixels(sdArrow(8, 13), 12, 16, 1.4, 1.4));
    pix('b_ring', 18, 18, bulletPixels(sdRingB(5.6, 1.6), 18, 18, 0.6, 1.6));
    pix('b_bubble', 26, 26, bulletPixels(sdRingB(9.5, 2), 26, 26, 0.8, 2));
    pix('b_needle', 8, 20, bulletPixels(sdEllipse(1.8, 8.6), 8, 20, 0.8, 1.2));
    J.push(...decorJobs());
    return J;
}


// ---------------------------------------------------------------- decor (baked into terrain)

function drawTree(seed, dark, light) {
    return (ctx, w) => {
        const R = w / 2 - 1;
        for (let i = 0; i < 7; i++) {
            const a = i * TAU / 7 + seed;
            const r = R * (0.42 + vnoise(i, seed, 3) * 0.12);
            const x = Math.cos(a) * R * 0.42, y = Math.sin(a) * R * 0.42;
            circle(ctx, x, y, r);
            ctx.fillStyle = rad(ctx, x - r * 0.35, y - r * 0.4, r * 0.1, r, [[0, light], [0.7, dark], [1, '#0c1a08']]);
            ctx.fill();
        }
        circle(ctx, -R * 0.15, -R * 0.15, R * 0.45);
        ctx.fillStyle = rad(ctx, -R * 0.3, -R * 0.3, 0, R * 0.5, [[0, light], [1, 'rgba(0,0,0,0)']]);
        ctx.fill();
    };
}
function drawPalm(ctx, w) {
    const R = w / 2 - 0.5;
    for (let i = 0; i < 7; i++) {
        ctx.save(); ctx.rotate(i * TAU / 7 + 0.3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 0.5, -R * 0.35, R, -R * 0.1); ctx.quadraticCurveTo(R * 0.5, R * 0.05, 0, 0);
        ctx.fillStyle = i % 2 ? '#3e7a24' : '#5a9a34'; ctx.fill();
        ctx.strokeStyle = 'rgba(10,30,5,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
        ctx.restore();
    }
    circle(ctx, 0, 0, 1.4); ctx.fillStyle = '#6b4a22'; ctx.fill();
}
function drawPine(snow) {
    return (ctx, w) => {
        const R = w / 2 - 0.5;
        for (let k = 0; k < 3; k++) {
            const r = R * (1 - k * 0.28);
            ctx.beginPath();
            for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + k * 0.2; const rr = i % 2 ? r : r * 0.72; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath();
            ctx.fillStyle = rad(ctx, -r * 0.3, -r * 0.3, 0, r, snow ? [[0, '#f4f8ff'], [0.5, '#bcd0dd'], [1, '#2a4a3a']] : [[0, '#3f7a3a'], [1, '#0f2a14']]);
            ctx.fill();
        }
    };
}
function drawCactus(ctx) {
    rrect(ctx, -1.8, -6, 3.6, 12, 1.8); ctx.fillStyle = '#4b7a34'; ctx.fill();
    rrect(ctx, -5.5, -3, 3, 5, 1.5); ctx.fill(); rrect(ctx, 2.5, -1, 3, 5, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-1, -5, 0.6, 10);
}
function drawRock(seed, col) {
    return (ctx, w) => {
        const pts = [];
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; const r = w / 2 * (0.6 + vnoise(i, seed, 4) * 0.38); pts.push(Math.cos(a) * r, Math.sin(a) * r); }
        poly(ctx, pts); metal(ctx, col[0], col[1], col[2], w / 2, 'rgba(0,0,0,0.5)', 0.4);
    };
}
function drawHut(ctx, w, h) {
    rrect(ctx, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 1);
    ctx.fillStyle = lin(ctx, -w / 2, 0, w / 2, 0, [[0, '#c9a46a'], [0.5, '#a8834c'], [0.5, '#7a5a30'], [1, '#5d4423']]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -h / 2 + 1); ctx.lineTo(0, h / 2 - 1); ctx.stroke();
}
function drawHouse(ctx, w, h) {
    rrect(ctx, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 0.6);
    ctx.fillStyle = lin(ctx, -w / 2, 0, w / 2, 0, [[0, '#d0644a'], [0.5, '#b04a33'], [0.5, '#7d3020'], [1, '#5e2418']]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let y = -h / 2 + 3; y < h / 2 - 1; y += 2) { ctx.beginPath(); ctx.moveTo(-w / 2 + 1, y); ctx.lineTo(w / 2 - 1, y); ctx.stroke(); }
}
function drawTent(ctx, w, h) {
    poly(ctx, [0, -h / 2 + 1, w / 2 - 1, h / 2 - 1, -w / 2 + 1, h / 2 - 1]);
    ctx.fillStyle = lin(ctx, -w / 2, 0, w / 2, 0, [[0, '#e8dcc0'], [0.5, '#c8b890'], [0.5, '#9a8a64'], [1, '#7a6c4a']]); ctx.fill();
}
function drawDeadTree(ctx, w) {
    ctx.strokeStyle = '#1a1412'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + 0.4;
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); const x = Math.cos(a) * w * 0.42, y = Math.sin(a) * w * 0.42; ctx.lineTo(x, y); ctx.stroke();
        ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x * 0.6, y * 0.6); ctx.lineTo(x * 0.6 + Math.cos(a + 0.8) * 3, y * 0.6 + Math.sin(a + 0.8) * 3); ctx.stroke();
    }
}
function drawWreck(ctx, w, h) {
    rrect(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 2); metal(ctx, '#4a4038', '#2e2620', '#120e0b', w / 2, 'rgba(0,0,0,0.6)', 0.4);
    circle(ctx, 0, -2, 4); ctx.fillStyle = '#1a1512'; ctx.fill();
    ctx.fillStyle = '#1a1512'; ctx.fillRect(-0.8, -h / 2 + 1, 1.6, 8);
}

export function decorJobs() {
    const J = [];
    const add = (name, w, h, draw) => J.push({ name, w, h, draw });
    add('tree0', 20, 20, drawTree(0.3, '#2c5a1e', '#6aa63a'));
    add('tree1', 26, 26, drawTree(1.1, '#24501a', '#5c9a30'));
    add('tree2', 16, 16, drawTree(2.2, '#38652a', '#86b84a'));
    add('jtree', 32, 32, drawTree(0.7, '#183e12', '#4c8a26'));
    add('palm', 18, 18, drawPalm);
    add('pine', 16, 16, drawPine(false));
    add('snowpine', 18, 18, drawPine(true));
    add('cactus', 12, 12, drawCactus);
    add('rock0', 12, 12, drawRock(3, ['#9a968c', '#66625a', '#2a2824']));
    add('rock1', 18, 18, drawRock(7, ['#8a7a66', '#5d4f40', '#241d16']));
    add('rockd', 14, 14, drawRock(11, ['#3a3436', '#221e20', '#0a0809']));
    add('hut', 12, 10, drawHut);
    add('house', 14, 18, drawHouse);
    add('tent', 12, 12, drawTent);
    add('deadtree', 16, 16, drawDeadTree);
    add('wreck', 18, 24, drawWreck);
    add('bush', 9, 9, drawTree(4.4, '#3b5e22', '#7aa848'));
    return J;
}

// ---------------------------------------------------------------- bosses

const B = {
    lev: { l: '#8a929c', m: '#555c66', d: '#1b1f25', deck: '#6d6a5e' },
    man: { l: '#6b7a5c', m: '#3a4632', d: '#131910', glow: 'rgba(120,255,90,0.95)' },
    wyrm: { l: '#c59a5a', m: '#7d5a2e', d: '#2d1d0b', glow: 'rgba(255,140,40,0.95)' },
    bas: { l: '#b9c4cf', m: '#6f7d8a', d: '#25303a', glow: 'rgba(110,200,255,0.95)' },
    ser: { l: '#fffaf0', m: '#d8c9a4', d: '#6b5a33', gold: '#ffcf5a' },
};

function levHull(ctx) {
    sym(ctx, [0, -218, 22, -190, 60, -120, 96, -20, 100, 80, 94, 170, 80, 206, 60, 218]);
    metal(ctx, B.lev.l, B.lev.m, B.lev.d, 220, 'rgba(0,0,0,0.9)', 1.2);
    sym(ctx, [0, -208, 20, -184, 54, -118, 86, -20, 90, 78, 85, 164, 72, 198, 54, 208]);
    ctx.fillStyle = lin(ctx, -80, -200, 80, 200, [[0, '#8a8676'], [1, '#4d4a40']]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.6;
    for (let y = -190; y < 200; y += 7) { ctx.beginPath(); ctx.moveTo(-90, y); ctx.lineTo(90, y); ctx.stroke(); }
    // superstructure
    rrect(ctx, -34, -40, 68, 90, 8); metal(ctx, '#a6adb6', '#666d77', '#2a2e35', 60);
    rrect(ctx, -24, -30, 48, 50, 6); metal(ctx, '#c2c8cf', '#7d848d', '#353a41', 40);
    for (const y of [32, 44]) { ellipse(ctx, 0, y, 10, 5); ctx.fillStyle = '#1c1d20'; ctx.fill(); }
    // turret rings & silo pad
    for (const [x, y] of [[-52, -64], [52, -64], [-52, 74], [52, 74]]) { circle(ctx, x, y, 26); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); circle(ctx, x, y, 24); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke(); }
    rrect(ctx, -22, -172, 44, 44, 4); ctx.fillStyle = '#3a3c40'; ctx.fill();
    // helipad at stern
    circle(ctx, 0, 150, 30); ctx.fillStyle = '#3a3b3e'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; circle(ctx, 0, 150, 24); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, 151);
    // crimson stripes & hull number
    ctx.fillStyle = MER.accent; ctx.fillRect(-100, 100, 6, 40); ctx.fillRect(94, 100, 6, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('M-01', 0, -100);
    for (let i = 0; i < 10; i++) light(ctx, (i % 2 ? 1 : -1) * 92, -10 + (i >> 1) * 36, 1.4, 'rgba(255,60,60,0.7)');
    noisy(ctx, 180, 400, 41, 0.35, 0.6);
}
function levTurret(ctx) {
    for (const x of [-5, 5]) { ctx.fillStyle = '#1b1c1f'; ctx.fillRect(x - 2, -38, 4, 30); ctx.fillStyle = '#000'; ctx.fillRect(x - 2.4, -39, 4.8, 3); }
    rrect(ctx, -16, -14, 32, 30, 10); metal(ctx, '#9aa1aa', '#5b626c', '#21252b', 24);
    ctx.fillStyle = MER.accent; ctx.fillRect(-16, 8, 32, 3);
    light(ctx, 0, 0, 1.6, MER.eye);
}
function levSilo(ctx) {
    rrect(ctx, -18, -18, 36, 36, 3); metal(ctx, '#6d737c', '#43484f', '#16181b', 20);
    for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 11, y = (Math.floor(i / 3) - 1) * 11; rrect(ctx, x - 4.5, y - 4.5, 9, 9, 1); ctx.fillStyle = '#25282c'; ctx.fill(); ctx.strokeStyle = MER.accent; ctx.lineWidth = 0.6; ctx.stroke(); }
}
function levCore(ctx) {
    rrect(ctx, -26, -26, 52, 52, 10); metal(ctx, '#c8ced5', '#848b94', '#2e3238', 30);
    glass(ctx, 0, -10, 18, 6, '#ff3b4f');
    circle(ctx, 0, 10, 10); ctx.fillStyle = '#16181b'; ctx.fill();
}
function manBody(ctx) {
    sym(ctx, [0, -60, 26, -52, 54, -30, 70, 0, 66, 28, 46, 52, 18, 64]);
    metal(ctx, B.man.l, B.man.m, B.man.d, 70, 'rgba(0,0,0,0.9)', 1);
    for (let i = 0; i < 5; i++) { const y = -36 + i * 18; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-50 + Math.abs(i - 2) * 6, y); ctx.quadraticCurveTo(0, y + 10, 50 - Math.abs(i - 2) * 6, y); ctx.stroke(); }
    for (const s of [-1, 1]) { ellipse(ctx, s * 40, 8, 12, 18, s * 0.3); metal(ctx, '#7f8f6b', '#4a5a3d', '#161d11', 20); }
    for (let i = 0; i < 6; i++) light(ctx, (i % 2 ? 1 : -1) * (20 + (i >> 1) * 12), 30 + (i >> 1) * 6, 1.2, B.man.glow);
    noisy(ctx, 120, 110, 51, 0.3, 0.6);
}
function manArm(ctx) {
    // pivot at top centre, blade pointing down
    rrect(ctx, -9, -50, 18, 46, 8); metal(ctx, B.man.l, B.man.m, B.man.d, 30);
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-26, 26, -4, 54); ctx.lineTo(4, 50); ctx.quadraticCurveTo(-8, 22, 8, -6); ctx.closePath();
    metal(ctx, '#e8f0e0', '#9fb08f', '#3a4532', 30);
    ctx.strokeStyle = 'rgba(160,255,120,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-22, 26, -3, 50); ctx.stroke();
    circle(ctx, 0, -44, 7); ctx.fillStyle = '#1c2316'; ctx.fill();
}
function manLeg(ctx) {
    rrect(ctx, -5, -38, 10, 70, 5); metal(ctx, '#5c6a4e', '#36412d', '#11160d', 20);
    ellipse(ctx, 0, 32, 9, 6); ctx.fillStyle = '#1a2014'; ctx.fill();
}
function manHead(ctx) {
    sym(ctx, [0, -34, 18, -28, 30, -8, 28, 14, 16, 30, 0, 34]);
    metal(ctx, '#8ea07a', '#566848', '#1c2516', 34);
    for (const s of [-1, 1]) { ellipse(ctx, s * 12, -10, 7, 9, s * 0.4); ctx.fillStyle = '#0b1008'; ctx.fill(); }
    for (const s of [-1, 1]) { ctx.strokeStyle = '#2a3322'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s * 8, -30); ctx.quadraticCurveTo(s * 22, -50, s * 30, -46); ctx.stroke(); }
}
function wyrmHead(ctx) {
    sym(ctx, [0, -30, 22, -24, 40, -4, 42, 26, 34, 48, 16, 56]);
    metal(ctx, B.wyrm.l, B.wyrm.m, B.wyrm.d, 50, 'rgba(0,0,0,0.9)', 1);
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-36, i * 12); ctx.lineTo(36, i * 12); ctx.stroke(); }
    for (const s of [-1, 1]) light(ctx, s * 20, 6, 2, B.wyrm.glow);
    ctx.fillStyle = MER.accent; ctx.fillRect(-30, 30, 60, 4);
}
function wyrmDrill(ctx) {
    circle(ctx, 0, 0, 30); metal(ctx, '#e0d7c4', '#9c907a', '#3d3528', 30);
    ctx.strokeStyle = 'rgba(40,30,20,0.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = i * TAU / 5 + t * 4; const r = t * 30; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
    circle(ctx, 0, 0, 4); ctx.fillStyle = '#ffd36a'; ctx.fill();
}
function wyrmSeg(ctx, w, h, husk) {
    rrect(ctx, -30, -26, 60, 52, 16); metal(ctx, husk ? '#55493a' : B.wyrm.l, husk ? '#2c241b' : B.wyrm.m, '#120c06', 40, 'rgba(0,0,0,0.9)', 1);
    for (const s of [-1, 1]) { rrect(ctx, s * 30 - 5, -18, 10, 36, 4); ctx.fillStyle = '#231a10'; ctx.fill(); }
    if (!husk) {
        circle(ctx, 0, 0, 10); metal(ctx, '#7a6a52', '#4a3d2c', '#1a140c', 10);
        light(ctx, 0, 0, 2.2, B.wyrm.glow);
    } else { noisy(ctx, 60, 50, 71, 0.6, 0.8); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-28, 20, 56, 3);
}
function wyrmTail(ctx) {
    sym(ctx, [0, -26, 22, -22, 18, 6, 8, 26, 0, 30]); metal(ctx, B.wyrm.l, B.wyrm.m, B.wyrm.d, 30);
    light(ctx, 0, 14, 1.6, 'rgba(255,60,40,0.9)');
}
function basBase(ctx) {
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; pts.push(Math.cos(a) * 140, Math.sin(a) * 140); }
    poly(ctx, pts); metal(ctx, '#d6dee6', '#8a97a4', '#2d3742', 150, 'rgba(0,0,0,0.9)', 1.4);
    poly(ctx, pts.map((v) => v * 0.86)); ctx.fillStyle = lin(ctx, -100, -100, 100, 100, [[0, '#a8b4c0'], [1, '#4b5763']]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let r = 40; r < 120; r += 20) { circle(ctx, 0, 0, r); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; ctx.save(); ctx.translate(Math.cos(a) * 140, Math.sin(a) * 140); circle(ctx, 0, 0, 16); metal(ctx, '#e6edf3', '#99a6b3', '#36414c', 16); ctx.restore(); }
    // snow drifts
    for (let i = 0; i < 40; i++) { const a = vnoise(i, 1, 3) * TAU; const r = 60 + vnoise(i, 2, 3) * 70; ellipse(ctx, Math.cos(a) * r, Math.sin(a) * r, 6 + vnoise(i, 5, 3) * 10, 3 + vnoise(i, 6, 3) * 5, a); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; light(ctx, Math.cos(a) * 88, Math.sin(a) * 88, 1.6, B.bas.glow); }
}
function basCore(ctx) {
    circle(ctx, 0, 0, 44); metal(ctx, '#eef3f7', '#a3b0bc', '#3b4652', 44, 'rgba(0,0,0,0.9)', 1);
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6); poly(ctx, [-8, -40, 8, -40, 5, -18, -5, -18]); ctx.fillStyle = 'rgba(30,50,70,0.8)'; ctx.fill(); ctx.restore(); }
    circle(ctx, 0, 0, 18); ctx.fillStyle = rad(ctx, 0, 0, 2, 18, [[0, '#ffffff'], [0.3, '#9ee6ff'], [1, '#0b3a5a']]); ctx.fill();
}
function basPlate(ctx) {
    ctx.beginPath(); ctx.arc(0, 60, 74, -Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3); ctx.arc(0, 60, 60, -Math.PI / 2 + 0.3, -Math.PI / 2 - 0.3, true); ctx.closePath();
    metal(ctx, '#dde8f2', '#8fa3b6', '#33475a', 30, 'rgba(0,0,0,0.9)', 0.8);
    ctx.strokeStyle = 'rgba(140,220,255,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 60, 67, -Math.PI / 2 - 0.25, -Math.PI / 2 + 0.25); ctx.stroke();
}
function basCannon(ctx) {
    for (const x of [-5, 5]) { ctx.fillStyle = '#20262c'; ctx.fillRect(x - 2.5, -34, 5, 26); }
    rrect(ctx, -18, -14, 36, 34, 8); metal(ctx, '#c7d1db', '#7a8896', '#28323c', 26);
    light(ctx, 0, 2, 2, B.bas.glow);
}
function serBody(ctx) {
    sym(ctx, [2.4, 4, 2, 34, 1.2, 42]); metal(ctx, B.ser.l, B.ser.m, B.ser.d, 30);
    sym(ctx, [1.5, 34, 12, 36, 12, 39, 1.5, 39]); metal(ctx, B.ser.l, B.ser.m, B.ser.d, 12);
    // swept energy wings
    for (const s of [-1, 1]) {
        poly(ctx, [s * 7, -8, s * 38, 6, s * 42, 14, s * 8, 6]);
        metal(ctx, '#fff8e2', '#e2c98a', '#7a6430', 40);
        ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s * 10, -6); ctx.lineTo(s * 40, 8); ctx.stroke();
    }
    sym(ctx, [0, -42, 5, -38, 9.5, -26, 10.5, -10, 9.5, 4, 6.5, 12, 3, 16]);
    metal(ctx, B.ser.l, B.ser.m, B.ser.d, 40);
    glass(ctx, 0, -27, 4.6, 7, '#ffcf5a');
    ctx.fillStyle = B.ser.gold; ctx.fillRect(-9.6, -4, 19.2, 2.2);
    for (const s of [-1, 1]) light(ctx, s * 40, 11, 1.2, 'rgba(255,210,90,0.9)');
}
function serCrown(ctx) {
    circle(ctx, 0, 0, 10); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2.4; ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6); poly(ctx, [-2, -9, 0, -14, 2, -9]); ctx.fillStyle = '#ff3b5c'; ctx.fill(); ctx.restore(); }
    circle(ctx, 0, 0, 4); ctx.fillStyle = '#ffd0d8'; ctx.fill();
}
function merCore(ctx) {
    circle(ctx, 0, 0, 66); metal(ctx, '#7c8490', '#383e48', '#0b0d10', 70, 'rgba(0,0,0,0.9)', 1.4);
    for (let i = 0; i < 12; i++) {
        ctx.save(); ctx.rotate(i * TAU / 12);
        poly(ctx, [-9, -64, 9, -64, 6, -36, -6, -36]); metal(ctx, '#9aa3ae', '#525a65', '#15181c', 30, 'rgba(0,0,0,0.8)', 0.6);
        ctx.restore();
    }
    circle(ctx, 0, 0, 34); ctx.fillStyle = '#07080a'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,40,70,0.8)'; ctx.lineWidth = 1.4; circle(ctx, 0, 0, 34); ctx.stroke();
}
function merRing(r, segs, thick) {
    return (ctx) => {
        for (let i = 0; i < segs; i++) {
            const a0 = i * TAU / segs + 0.04, a1 = (i + 1) * TAU / segs - 0.04;
            ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.arc(0, 0, r - thick, a1, a0, true); ctx.closePath();
            metal(ctx, '#8e96a1', '#4a515b', '#14171b', r, 'rgba(0,0,0,0.85)', 0.6);
            const am = (a0 + a1) / 2;
            light(ctx, Math.cos(am) * (r - thick / 2), Math.sin(am) * (r - thick / 2), 1.2, 'rgba(255,50,80,0.85)');
        }
    };
}
function merNode(ctx) {
    poly(ctx, [0, -22, 14, 0, 0, 22, -14, 0]); metal(ctx, '#c9cfd8', '#6d7581', '#1d2128', 22, 'rgba(0,0,0,0.9)', 0.8);
    poly(ctx, [0, -12, 7, 0, 0, 12, -7, 0]); ctx.fillStyle = rad(ctx, 0, 0, 1, 12, [[0, '#fff'], [0.3, '#ff5d7a'], [1, '#5a0a1a']]); ctx.fill();
}
function merEye(ctx) {
    circle(ctx, 0, 0, 30); ctx.fillStyle = rad(ctx, 0, 0, 0, 30, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,120,140,1)'], [0.6, 'rgba(255,30,70,0.8)'], [1, 'rgba(255,0,40,0)']]); ctx.fill();
    ellipse(ctx, 0, 0, 3, 14); ctx.fillStyle = '#100006'; ctx.fill();
}

export function bossJobs(id) {
    const J = [];
    const add = (name, w, h, draw) => J.push({ name, w, h, draw });
    switch (id) {
        case 'leviathan':
            add('lev_hull', 204, 440, levHull); add('lev_turret', 34, 80, levTurret); add('lev_silo', 38, 38, levSilo); add('lev_core', 56, 56, levCore);
            break;
        case 'mantis':
            add('man_body', 144, 130, manBody); add('man_arm', 40, 112, manArm); add('man_leg', 22, 80, manLeg); add('man_head', 64, 100, manHead);
            break;
        case 'sandwyrm':
            add('wyrm_head', 88, 92, wyrmHead); add('wyrm_drill', 62, 62, wyrmDrill); add('wyrm_seg', 70, 56, (c, w, h) => wyrmSeg(c, w, h, false));
            add('wyrm_husk', 70, 56, (c, w, h) => wyrmSeg(c, w, h, true)); add('wyrm_tail', 46, 62, wyrmTail);
            break;
        case 'bastion':
            add('bas_base', 300, 300, basBase); add('bas_core', 92, 92, basCore); add('bas_plate', 50, 26, (c) => { c.translate(0, 0); basPlate(c); }); add('bas_cannon', 38, 72, basCannon);
            break;
        case 'seraph': case 'meridian':
            add('ser_body', 88, 88, serBody); add('ser_crown', 30, 30, serCrown);
            if (id === 'meridian') {
                add('mer_core', 136, 136, merCore); add('mer_ring1', 340, 340, merRing(168, 18, 12)); add('mer_ring2', 260, 260, merRing(128, 12, 16));
                add('mer_node', 30, 46, merNode); add('mer_eye', 62, 62, merEye);
            }
            break;
    }
    return J;
}
