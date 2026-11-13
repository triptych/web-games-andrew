// Painted backdrops, one per theme, in parallax layers. All procedural: every hill, barn and
// cactus comes from a stateless hash of its slot, so the scenery never shifts between frames.

import { hash3 } from '../rng.js';
import { INK, ell, rr, star, shape } from './sprites.js';
import { GROUND } from '../config.js';

export const THEME = {
    farm:   { sky: ['#4fb8ff', '#bdeeff'], hill: ['#8fdc5a', '#5fbf3f'], ground: '#59b336', dirt: '#8a5a2b', sun: 'sun' },
    night:  { sky: ['#0d1544', '#3a2a7a'], hill: ['#245a57', '#173f3d'], ground: '#1f5236', dirt: '#3b2a1c', sun: 'moon' },
    corn:   { sky: ['#ff7e5f', '#ffd27a'], hill: ['#c99a3a', '#9b7a2c'], ground: '#a68a2e', dirt: '#6e4a22', sun: 'sunset' },
    town:   { sky: ['#6cc6ff', '#e0f7ff'], hill: ['#a6d97b', '#7cbf55'], ground: '#7a8a7a', dirt: '#59533f', sun: 'sun' },
    base:   { sky: ['#8fc4d9', '#f4ecd0'], hill: ['#b6a77a', '#998b5e'], ground: '#8c8a5a', dirt: '#5e5534', sun: 'sun' },
    desert: { sky: ['#3d2a7a', '#ff9a5a'], hill: ['#c7633a', '#9c4728'], ground: '#d39a5c', dirt: '#8a5532', sun: 'sunset' },
    finale: { sky: ['#1b0a2e', '#8a1f3d'], hill: ['#3d1f3f', '#2a1430'], ground: '#4a3550', dirt: '#2a1c2e', sun: 'moon' },
};

const h = (i, k) => hash3(i, k, 77);

// ------------------------------------------------------------------ painted backdrops (fal)
const BG_H = 19;          // world units tall; its ground row sits on GROUND (above it, its own sky colour)
const BG_PAR = 0.35;      // parallax: it scrolls at a third of the camera's speed
const swatches = new Map();

/** The sky colour at the top of a painting and the ground colour under its ground line (sampled once). */
function swatch(img, g) {
    if (swatches.has(img)) return swatches.get(img);
    const c = document.createElement('canvas');
    c.width = 32; c.height = 64;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 32, 64);
    const avg = (y) => {
        const d = x.getImageData(0, y, 32, 1).data;
        let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        return `rgb(${r / 32 | 0},${gg / 32 | 0},${b / 32 | 0})`;
    };
    const s = { sky: avg(0), ground: avg(Math.min(63, Math.round(g * 64) + 3)) };
    swatches.set(img, s);
    return s;
}

/** Draw a painted backdrop if it has loaded. Returns the ground colour, or null to fall back to code. */
export function drawPainted(ctx, img, g, v) {
    if (!img) return null;
    const { w, h: H, s, cx, oy } = v;
    const sw = swatch(img, g);
    const top = GROUND - g * BG_H;                       // world y of the painting's top edge
    const ph = BG_H * s, pw = ph * img.width / img.height;
    const py = oy + top * s;
    ctx.fillStyle = sw.sky;
    ctx.fillRect(0, 0, w, Math.ceil(py) + 1);
    const off = cx * s * BG_PAR;
    const first = Math.floor(off / pw);
    for (let k = first; k * pw - off < w; k++) {
        const x = k * pw - off;
        ctx.save();
        if (k & 1) { ctx.translate(x + pw, py); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, pw + 1, ph); }   // mirrored: seamless joins
        else { ctx.translate(x, py); ctx.drawImage(img, 0, 0, pw + 1, ph); }
        ctx.restore();
    }
    return sw.ground;
}

/**
 * Draw the backdrop. ctx is in screen px; v gives scale (px per unit), camera left (cx) and
 * the screen y of world y = 0 (oy), plus the view size.
 */
export function drawBackdrop(ctx, theme, v, t, painted = null) {
    const T = THEME[theme] || THEME.farm;
    const { w, h: H, s, cx, oy } = v;
    const gy = oy + GROUND * s;                                  // the ground line in px
    const groundCol = painted && drawPainted(ctx, painted.img, painted.g, v);
    if (groundCol) { drawGround(ctx, theme, v, groundCol, T.dirt); return; }
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, gy + 2);
    // sun-burst rays: a Saturday-morning signature
    const sunX = w * 0.78 - (cx * s * 0.03) % (w * 0.2), sunY = oy + 3.2 * s;
    if (T.sun === 'sun' || T.sun === 'sunset') {
        ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(t * 0.05);
        ctx.fillStyle = T.sun === 'sun' ? 'rgba(255,255,255,0.13)' : 'rgba(255,240,180,0.16)';
        for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(w, H), (i * Math.PI) / 6, (i * Math.PI) / 6 + 0.13); ctx.fill(); }
        ctx.restore();
    }
    if (T.sun === 'moon' || theme === 'night' || theme === 'finale' || theme === 'desert') {
        for (let i = 0; i < 70; i++) {
            const x = h(i, 1) * w, y = h(i, 2) * gy * 0.75;
            const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
            ctx.fillStyle = `rgba(255,255,230,${0.35 + tw * 0.5})`;
            ctx.fillRect(x, y, 2, 2);
        }
    }
    // the sun or moon, with a face
    ctx.save(); ctx.translate(sunX, sunY); ctx.scale(s, s);
    if (T.sun === 'moon') {
        ell(ctx, 0, 0, 1.6, 1.6, '#fff7c2', 0.08);
        ell(ctx, -0.5, -0.4, 0.3, 0.25, '#e8dc9a', 0); ell(ctx, 0.5, 0.6, 0.22, 0.18, '#e8dc9a', 0);
        ctx.beginPath(); ctx.arc(0.2, 0.2, 0.5, 0.2, Math.PI - 0.2); ctx.lineWidth = 0.07; ctx.strokeStyle = INK; ctx.stroke();
        ell(ctx, -0.1, -0.2, 0.08, 0.12, INK, 0); ell(ctx, 0.5, -0.2, 0.08, 0.12, INK, 0);
    } else {
        ell(ctx, 0, 0, 1.6, 1.6, T.sun === 'sunset' ? '#ffde6b' : '#ffe94d', 0.08);
        rr(ctx, -0.95, -0.45, 0.8, 0.42, 0.15, INK, 0); rr(ctx, 0.15, -0.45, 0.8, 0.42, 0.15, INK, 0);   // sunglasses
        ctx.fillStyle = '#7fd7ff'; ctx.fillRect(-0.75, -0.38, 0.25, 0.08); ctx.fillRect(0.35, -0.38, 0.25, 0.08);
        ctx.beginPath(); ctx.arc(0, 0.25, 0.55, 0.3, Math.PI - 0.3); ctx.lineWidth = 0.08; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
    // clouds (slow drift)
    if (theme !== 'finale') {
        for (let i = 0; i < 8; i++) {
            const span = w + 400;
            const x = ((h(i, 3) * span - cx * s * 0.15 - t * 6 * (0.5 + h(i, 4))) % span + span) % span - 200;
            const y = oy + (1.5 + h(i, 5) * 6) * s;
            const k = s * (0.7 + h(i, 6) * 0.6);
            const col = theme === 'night' ? 'rgba(120,130,200,0.5)' : theme === 'corn' || theme === 'desert' ? 'rgba(255,220,200,0.85)' : '#ffffff';
            ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
            ell(ctx, 0, 0, 1.6, 0.6, col, 0.07); ell(ctx, -0.7, -0.3, 0.8, 0.6, col, 0.07); ell(ctx, 0.5, -0.45, 1.0, 0.75, col, 0.07);
            ell(ctx, 0, 0.05, 1.5, 0.5, col, 0);
            ctx.restore();
        }
    } else {
        // searchlights sweep the sky
        for (let i = 0; i < 3; i++) {
            const bx = w * (0.2 + i * 0.3);
            const a = -Math.PI / 2 + Math.sin(t * 0.7 + i * 2) * 0.6;
            ctx.save(); ctx.translate(bx, gy); ctx.rotate(a);
            const lg = ctx.createLinearGradient(0, 0, H, 0);
            lg.addColorStop(0, 'rgba(255,255,200,0.35)'); lg.addColorStop(1, 'rgba(255,255,200,0)');
            ctx.fillStyle = lg;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(H * 1.2, -H * 0.12); ctx.lineTo(H * 1.2, H * 0.12); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
    // far hills (0.25 parallax), then mid hills
    hills(ctx, v, 0.25, 4.5, T.hill[0], 3);
    midLayer(ctx, theme, v, t);
    hills(ctx, v, 0.5, 2.2, T.hill[1], 5);
    drawGround(ctx, theme, v, T.ground, T.dirt);
}

/** The strip the walkers stand on, at full parallax, with dirt, pebbles and grass tufts. */
function drawGround(ctx, theme, v, groundCol, dirtCol) {
    const T = { ground: groundCol, dirt: dirtCol };
    const { w, h: H, s, cx, oy } = v;
    const gy = oy + GROUND * s;
    // the ground and the dirt under it
    ctx.fillStyle = T.ground;
    ctx.fillRect(0, gy, w, H - gy);
    ctx.fillStyle = T.dirt;
    ctx.fillRect(0, gy + 0.55 * s, w, H - gy);
    ctx.fillStyle = INK;
    ctx.fillRect(0, gy - 1, w, Math.max(2, s * 0.08));
    ctx.fillRect(0, gy + 0.55 * s, w, Math.max(1.5, s * 0.05));
    // pebbles and buried things in the dirt
    for (let i = Math.floor(cx / 3) - 1; i < (cx + w / s) / 3 + 1; i++) {
        const x = (i * 3 + h(i, 8) * 3 - cx) * s, y = gy + (0.9 + h(i, 9) * 3) * s;
        if (y > H) continue;
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        if (h(i, 10) < 0.08) {           // a fossil bone, for the kids at home
            rr(ctx, -0.4, -0.06, 0.8, 0.12, 0.06, '#efe6cf', 0.04);
            for (const sx of [-0.4, 0.4]) { ell(ctx, sx, -0.08, 0.09, 0.09, '#efe6cf', 0.04); ell(ctx, sx, 0.08, 0.09, 0.09, '#efe6cf', 0.04); }
        } else ell(ctx, 0, 0, 0.18 + h(i, 11) * 0.15, 0.1, 'rgba(0,0,0,0.18)', 0);
        ctx.restore();
    }
    // tufts on the grass line
    for (let i = Math.floor(cx) - 1; i < cx + w / s + 1; i++) {
        if (h(i, 12) < 0.5) continue;
        const x = (i + h(i, 13) - cx) * s;
        ctx.fillStyle = theme === 'desert' || theme === 'base' ? '#7b6a3a' : '#2f8a2a';
        ctx.beginPath(); ctx.moveTo(x - 0.15 * s, gy); ctx.lineTo(x, gy - 0.3 * s); ctx.lineTo(x + 0.15 * s, gy); ctx.fill();
    }
}

function hills(ctx, v, par, height, col, seed) {
    const { w, s, cx, oy } = v;
    const gy = oy + GROUND * s;
    const off = cx * par;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let px = 0; px <= w + 8; px += 8) {
        const x = px / s + off;
        const y = height * (0.55 + 0.25 * Math.sin(x * 0.11 + seed) + 0.2 * Math.sin(x * 0.27 + seed * 2));
        ctx.lineTo(px, gy - y * s);
    }
    ctx.lineTo(w, gy); ctx.closePath();
    shape(ctx, col, Math.max(1.5, s * 0.07));
}

/** Buildings and props on the 0.4 layer, every 7 units, chosen per theme. */
function midLayer(ctx, theme, v, t) {
    const { w, s, cx, oy } = v;
    const par = 0.4, step = 7;
    const gy = oy + GROUND * s;
    const lx = cx * par;
    for (let i = Math.floor(lx / step) - 2; i < (lx + w / s) / step + 2; i++) {
        const r = h(i, 20 + theme.length);
        if (r < 0.35) continue;
        const x = (i * step + h(i, 21) * 3 - lx) * s;
        const y = gy - 2.0 * s;
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        prop(ctx, theme, r, i, t);
        ctx.restore();
    }
}

function prop(ctx, theme, r, i, t) {
    const lit = theme === 'night' || theme === 'finale';
    if (theme === 'farm' || theme === 'night') {
        if (r < 0.6) {          // red barn
            const red = lit ? '#7a2632' : '#d6413a';
            ctx.beginPath(); ctx.moveTo(-1.8, 0); ctx.lineTo(-1.8, -2); ctx.lineTo(-1.2, -3.1); ctx.lineTo(1.2, -3.1); ctx.lineTo(1.8, -2); ctx.lineTo(1.8, 0); ctx.closePath(); shape(ctx, red);
            rr(ctx, -0.65, -1.6, 1.3, 1.6, 0.05, '#fff2e0');
            ctx.beginPath(); ctx.moveTo(-0.65, -1.6); ctx.lineTo(0.65, 0); ctx.moveTo(0.65, -1.6); ctx.lineTo(-0.65, 0); ctx.lineWidth = 0.08; ctx.strokeStyle = red; ctx.stroke();
            rr(ctx, -0.35, -2.65, 0.7, 0.5, 0.05, lit ? '#ffe46b' : '#fff2e0');
        } else if (r < 0.8) {   // silo
            rr(ctx, -0.6, -3.8, 1.2, 3.8, 0.1, lit ? '#5b6c7d' : '#b9c8d6');
            ell(ctx, 0, -3.8, 0.6, 0.45, lit ? '#3e4d5c' : '#8fa3b6');
        } else {                // windmill
            rr(ctx, -0.12, -3.5, 0.24, 3.5, 0.05, '#8a8a8a');
            ctx.save(); ctx.translate(0, -3.5); ctx.rotate(t * 1.2 + i);
            for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); rr(ctx, 0, -0.12, 1.2, 0.24, 0.05, '#e9e9e9', 0.05); }
            ctx.restore();
        }
    } else if (theme === 'corn') {
        for (let k = -2; k <= 2; k++) {
            ctx.save(); ctx.translate(k * 0.7, 0); ctx.rotate(Math.sin(t + k + i) * 0.04);
            rr(ctx, -0.08, -2.6, 0.16, 2.6, 0.05, '#5f9e35', 0.05);
            ell(ctx, 0.2, -1.7, 0.16, 0.4, '#ffd23f', 0.05, 0.3);
            ell(ctx, -0.25, -2.1, 0.35, 0.1, '#7cc04a', 0.04, -0.5);
            ctx.restore();
        }
        if (r > 0.85) {         // scarecrow
            rr(ctx, -0.06, -3.4, 0.12, 3.4, 0.03, '#7a5230', 0.05);
            rr(ctx, -0.9, -2.6, 1.8, 0.14, 0.03, '#7a5230', 0.05);
            rr(ctx, -0.45, -2.75, 0.9, 1.0, 0.1, '#5b8bd6');
            ell(ctx, 0, -3.15, 0.33, 0.33, '#f5deb3');
            ell(ctx, 0, -3.45, 0.55, 0.1, '#f4d35e'); rr(ctx, -0.25, -3.75, 0.5, 0.3, 0.08, '#f4d35e');
        }
    } else if (theme === 'town') {
        const cols = ['#ffb4a2', '#9ad1d4', '#f7d488', '#c3b1e1'];
        if (r > 0.9) {          // water tower
            for (const sx of [-0.7, 0.7]) rr(ctx, sx - 0.06, -3.2, 0.12, 3.2, 0.03, '#8a8a8a', 0.04);
            ell(ctx, 0, -3.8, 1.4, 0.9, '#a7c7e7');
            ctx.fillStyle = INK; ctx.font = 'bold 0.42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PODUNK', 0, -3.7);
        } else {
            const c = cols[i & 3];
            rr(ctx, -1.5, -2.4, 3, 2.4, 0.05, c);
            ctx.beginPath(); ctx.moveTo(-1.8, -2.4); ctx.lineTo(0, -3.6); ctx.lineTo(1.8, -2.4); ctx.closePath(); shape(ctx, '#8a4a3a');
            rr(ctx, -1.05, -1.9, 0.7, 0.6, 0.05, lit ? '#ffe46b' : '#cfefff');
            rr(ctx, 0.35, -1.9, 0.7, 0.6, 0.05, '#cfefff');
            rr(ctx, -0.3, -1.1, 0.6, 1.1, 0.05, '#7a4a2a');
        }
    } else if (theme === 'base') {
        if (r < 0.65) {         // quonset hangar
            ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 2.4, 0, Math.PI, 0); ctx.closePath(); shape(ctx, '#9aa59a');
            for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k) * 0.5 + 0.01, 2.4, 0, Math.PI, 0); ctx.lineWidth = 0.04; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke(); }
            rr(ctx, -0.8, -1.3, 1.6, 1.3, 0.05, '#4a524a');
        } else {                // radar dish
            rr(ctx, -0.1, -2.4, 0.2, 2.4, 0.04, '#6a6a6a');
            ctx.save(); ctx.translate(0, -2.6); ctx.scale(Math.cos(t * 1.5 + i), 1);
            ell(ctx, 0, 0, 1.0, 0.6, '#d9dde3');
            ctx.restore();
        }
    } else {                    // desert and finale: mesas and cacti
        if (r < 0.7) {
            ctx.beginPath(); ctx.moveTo(-2.4, 0); ctx.lineTo(-1.8, -3); ctx.lineTo(1.6, -3); ctx.lineTo(2.3, 0); ctx.closePath();
            shape(ctx, theme === 'finale' ? '#4b2445' : '#b65a34');
            rr(ctx, -1.9, -3.05, 3.6, 0.3, 0.05, theme === 'finale' ? '#5e2c55' : '#d07a46', 0.05);
        } else {
            const c = theme === 'finale' ? '#2f5a3a' : '#3fa34d';
            rr(ctx, -0.25, -2.6, 0.5, 2.6, 0.25, c);
            rr(ctx, -0.95, -1.9, 0.4, 1.0, 0.2, c); rr(ctx, -0.95, -1.1, 0.8, 0.35, 0.17, c);
            rr(ctx, 0.55, -2.2, 0.4, 0.9, 0.2, c); rr(ctx, 0.15, -1.45, 0.8, 0.35, 0.17, c);
        }
        if (theme === 'desert' && r > 0.93) {
            rr(ctx, -2, -2.4, 4, 2.4, 0.1, '#7d8a8a');
            ctx.fillStyle = INK; ctx.font = 'bold 1.6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('0', 0, -0.6);
        }
    }
    if (lit && r > 0.92) star(ctx, 0, -4.3, 0.15, '#fff6a8', 0.03);
}

/** A fence along the ground at full parallax: it tells you how fast you are moving. */
export function drawFence(ctx, theme, v) {
    if (theme === 'desert' || theme === 'finale') return;
    const { w, s, cx, oy } = v;
    const gy = oy + GROUND * s;
    const col = theme === 'base' ? '#9aa0a6' : theme === 'town' ? '#ffffff' : '#c08a4a';
    for (let i = Math.floor(cx / 2.5) - 1; i < (cx + w / s) / 2.5 + 1; i++) {
        const x = (i * 2.5 - cx) * s;
        ctx.fillStyle = INK;
        ctx.fillRect(x - s * 0.1, gy - s * 1.0, s * 0.2, s * 1.0);
        ctx.fillStyle = col;
        ctx.fillRect(x - s * 0.06, gy - s * 0.96, s * 0.12, s * 0.96);
    }
    for (const yy of [0.75, 0.4]) {
        ctx.fillStyle = INK; ctx.fillRect(0, gy - yy * s - s * 0.07, w, s * 0.14);
        ctx.fillStyle = col; ctx.fillRect(0, gy - yy * s - s * 0.04, w, s * 0.08);
    }
}
