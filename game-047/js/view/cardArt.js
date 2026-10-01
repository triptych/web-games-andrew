/**
 * cardArt.js — every card face is painted in code at 512×720.
 *
 * Each face is drawn into three canvases at once:
 *   col — the colour map
 *   hgt — a heightmap (frames, pips and lettering raised) → normal map
 *   orm — roughness (G) and metalness (B): gold foil shines, parchment does not
 * Faces are cached by a key built from rank/suit/enchant/arcana/upgrade.
 *
 * Face cards get a generated portrait (J/Q/K differ in headwear, hair and
 * beard; the suit sets robe colours and the emblem they hold). Arcana get a
 * generated sigil around an icon.
 */

import * as THREE from 'three';
import { canvas, colorTex, dataTex, normalFromHeight, makeNoise, roundRectPath } from './textures.js';
import { makeRng, hashStr } from '../sim/rng.js';
import { ARCANA, ENCHANTS, cardText, arcanaCost } from '../sim/cards.js';
import { rankLabel, RANK_LONG, SUIT_INFO } from '../sim/rules.js';

export const CW = 512, CH = 720, CR = 38;
const SERIF = '"Palatino Linotype", "Book Antiqua", Palatino, "Georgia", "DejaVu Serif", serif';

export const SUIT_THEME = {
    S: { ink: '#1c2a44', mid: '#4a6a9a', light: '#c8d8f0', robe: ['#2a3a5a', '#101a2e'], band: '#9ab0d0' },
    C: { ink: '#2e1448', mid: '#6a3a9a', light: '#d8c0f0', robe: ['#4a2a6a', '#1e0e30'], band: '#b89ad8' },
    D: { ink: '#5a3406', mid: '#b07a18', light: '#fff0b0', robe: ['#8a5a10', '#3a2006'], band: '#e0c070' },
    H: { ink: '#6a0818', mid: '#c0283c', light: '#ffc8d0', robe: ['#8a1024', '#3a0610'], band: '#e89aa4' },
};

let parchment = null;
function parchmentTile() {
    if (parchment) return parchment;
    const N = makeNoise(4242);
    const s = 256;
    parchment = canvas(s, s);
    const g = parchment.getContext('2d');
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            const n = N.tfbm(x / 32, y / 32, 8, 5);
            const f = N.tfbm(x / 4, y / 64, 64, 2);
            const v = 0.78 + n * 0.3 + (f - 0.5) * 0.06;
            const i = (y * s + x) * 4;
            img.data[i] = 255 * Math.min(1, v * 1.0);
            img.data[i + 1] = 255 * Math.min(1, v * 0.93);
            img.data[i + 2] = 255 * Math.min(1, v * 0.8);
            img.data[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    return parchment;
}

// ------------------------------------------------------------------ layered drawing

function makeLayers() {
    const col = canvas(CW, CH), hgt = canvas(CW, CH), orm = canvas(CW, CH);
    const L = { col, hgt, orm, c: col.getContext('2d'), h: hgt.getContext('2d'), m: orm.getContext('2d') };
    L.h.fillStyle = '#000'; L.h.fillRect(0, 0, CW, CH);
    L.m.fillStyle = 'rgb(0,215,0)'; L.m.fillRect(0, 0, CW, CH);      // rough, non-metal
    return L;
}
const ORM = { gold: 'rgb(0,80,255)', silver: 'rgb(0,60,230)', gloss: 'rgb(0,110,0)', paper: 'rgb(0,215,0)', gem: 'rgb(0,40,90)' };

/** Run a path-building function in all three layers with per-layer styles. */
function shape(L, pathFn, { fill = null, stroke = null, lw = 0, height = 0, orm = null, hStroke = null } = {}) {
    for (const [ctx, kind] of [[L.c, 'c'], [L.h, 'h'], [L.m, 'm']]) {
        ctx.save();
        pathFn(ctx);
        if (kind === 'c') {
            if (fill) { ctx.fillStyle = typeof fill === 'function' ? fill(ctx) : fill; ctx.fill(); }
            if (stroke) { ctx.strokeStyle = typeof stroke === 'function' ? stroke(ctx) : stroke; ctx.lineWidth = lw; ctx.stroke(); }
        } else if (kind === 'h') {
            const v = Math.round(height * 255);
            if (height) {
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.strokeStyle = `rgb(${v},${v},${v})`;
                if (fill) ctx.fill();
                if (stroke || hStroke) { ctx.lineWidth = hStroke ?? lw; ctx.stroke(); }
            }
        } else if (orm) {
            ctx.fillStyle = orm; ctx.strokeStyle = orm;
            if (fill) ctx.fill();
            if (stroke) { ctx.lineWidth = lw; ctx.stroke(); }
        }
        ctx.restore();
    }
}

const goldGrad = (g, y0 = 0, y1 = CH) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#fff4c0'); gr.addColorStop(0.3, '#e8b848'); gr.addColorStop(0.55, '#a8701c'); gr.addColorStop(0.8, '#f0c860'); gr.addColorStop(1, '#8a5412');
    return gr;
};

// ------------------------------------------------------------------ suit glyphs

export function suitPath(g, suit, x, y, s) {
    g.beginPath();
    const P = (px, py) => [x + px * s, y + py * s];
    const M = (a, b) => g.moveTo(...P(a, b));
    const Lt = (a, b) => g.lineTo(...P(a, b));
    const B = (a, b, c, d, e, f) => g.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
    const Q = (a, b, c, d) => g.quadraticCurveTo(...P(a, b), ...P(c, d));
    if (suit === 'H') {
        M(0, 0.48); B(-0.16, 0.3, -0.5, 0.1, -0.5, -0.14); B(-0.5, -0.42, -0.18, -0.52, 0, -0.28); B(0.18, -0.52, 0.5, -0.42, 0.5, -0.14); B(0.5, 0.1, 0.16, 0.3, 0, 0.48);
    } else if (suit === 'S') {
        M(0, -0.5); B(0.16, -0.3, 0.5, -0.1, 0.5, 0.12); B(0.5, 0.36, 0.22, 0.42, 0.06, 0.24); Lt(0.15, 0.5); Lt(-0.15, 0.5); Lt(-0.06, 0.24); B(-0.22, 0.42, -0.5, 0.36, -0.5, 0.12); B(-0.5, -0.1, -0.16, -0.3, 0, -0.5);
    } else if (suit === 'D') {
        M(0, -0.5); Q(0.14, -0.16, 0.38, 0); Q(0.14, 0.16, 0, 0.5); Q(-0.14, 0.16, -0.38, 0); Q(-0.14, -0.16, 0, -0.5);
    } else {
        const circ = (cx, cy, r) => { g.moveTo(...P(cx + r, cy)); g.arc(x + cx * s, y + cy * s, r * s, 0, Math.PI * 2); };
        circ(0, -0.25, 0.21); circ(-0.24, 0.07, 0.21); circ(0.24, 0.07, 0.21);
        M(-0.08, 0); Lt(0.08, 0); Lt(0.07, 0.12); Lt(-0.07, 0.12); g.closePath();
        M(-0.05, 0.1); Lt(0.05, 0.1); Lt(0.15, 0.5); Lt(-0.15, 0.5); g.closePath();
    }
    g.closePath();
}

function drawGlyph(L, suit, x, y, s, { flip = false, height = 0.55, emblem = false } = {}) {
    const th = SUIT_THEME[suit];
    const path = (g) => {
        if (flip) { g.translate(x, y); g.rotate(Math.PI); g.translate(-x, -y); }
        suitPath(g, suit, x, y, s);
    };
    // drop shadow
    L.c.save();
    L.c.shadowColor = 'rgba(0,0,0,0.35)'; L.c.shadowBlur = s * 0.08; L.c.shadowOffsetY = s * 0.03;
    path(L.c);
    L.c.fillStyle = th.ink;
    L.c.fill();
    L.c.restore();
    shape(L, path, {
        fill: (g) => {
            const gr = g.createLinearGradient(x - s * 0.5, y - s * 0.5, x + s * 0.4, y + s * 0.5);
            gr.addColorStop(0, th.light); gr.addColorStop(0.35, th.mid); gr.addColorStop(1, th.ink);
            return gr;
        },
        stroke: th.ink, lw: Math.max(1.5, s * 0.035), height, orm: ORM.gloss,
    });
    // specular highlight
    L.c.save();
    path(L.c);
    L.c.clip();
    const hg = L.c.createRadialGradient(x - s * 0.18, y - s * 0.2, 0, x - s * 0.18, y - s * 0.2, s * 0.35);
    hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    L.c.fillStyle = hg;
    L.c.fillRect(x - s, y - s, s * 2, s * 2);
    L.c.restore();
    if (emblem) drawEmblem(L, suit, x, y, s * 0.45);
}

/** Small thematic emblem inside big glyphs: sword, stave, coin, flame. */
function drawEmblem(L, suit, x, y, s) {
    const g = L.c;
    g.save();
    g.translate(x, y);
    g.strokeStyle = 'rgba(255,248,220,0.9)';
    g.fillStyle = 'rgba(255,248,220,0.9)';
    g.lineWidth = s * 0.08;
    g.lineCap = 'round';
    if (suit === 'S') {
        g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(s * 0.12, -s * 0.7); g.lineTo(s * 0.1, s * 0.3); g.lineTo(-s * 0.1, s * 0.3); g.lineTo(-s * 0.12, -s * 0.7); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-s * 0.4, s * 0.32); g.lineTo(s * 0.4, s * 0.32); g.stroke();
        g.beginPath(); g.moveTo(0, s * 0.35); g.lineTo(0, s * 0.7); g.stroke();
    } else if (suit === 'C') {
        g.beginPath(); g.moveTo(-s * 0.5, s * 0.8); g.lineTo(s * 0.4, -s * 0.6); g.stroke();
        g.beginPath(); g.arc(s * 0.45, -s * 0.68, s * 0.18, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(s * (0.1 - i * 0.2), s * (-0.1 + i * 0.3), s * 0.08, 0, Math.PI * 2); g.fill(); }
    } else if (suit === 'D') {
        g.beginPath(); g.arc(0, 0, s * 0.55, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(0, 0, s * 0.35, 0, Math.PI * 2); g.stroke();
        g.font = `bold ${s * 0.5}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', 0, s * 0.02);
    } else {
        g.beginPath(); g.moveTo(0, s * 0.6);
        g.bezierCurveTo(-s * 0.5, s * 0.3, -s * 0.3, -s * 0.3, 0, -s * 0.8);
        g.bezierCurveTo(s * 0.05, -s * 0.3, s * 0.4, -s * 0.2, s * 0.35, s * 0.15);
        g.bezierCurveTo(s * 0.3, s * 0.45, s * 0.1, s * 0.6, 0, s * 0.6); g.fill();
    }
    g.restore();
}

// ------------------------------------------------------------------ frame

function drawBase(L, tint, dark = false) {
    const clip = (g) => roundRectPath(g, 0, 0, CW, CH, CR);
    for (const g of [L.c, L.h, L.m]) { g.save(); clip(g); g.clip(); }
    if (dark) {
        const bg = L.c.createLinearGradient(0, 0, 0, CH);
        bg.addColorStop(0, '#2a2030'); bg.addColorStop(1, '#0e0a12');
        L.c.fillStyle = bg; L.c.fillRect(0, 0, CW, CH);
    } else {
        L.c.fillStyle = L.c.createPattern(parchmentTile(), 'repeat');
        L.c.fillRect(0, 0, CW, CH);
        const vg = L.c.createRadialGradient(CW / 2, CH / 2, CW * 0.2, CW / 2, CH / 2, CW * 0.85);
        vg.addColorStop(0, 'rgba(255,250,235,0.25)'); vg.addColorStop(1, 'rgba(90,60,20,0.35)');
        L.c.fillStyle = vg; L.c.fillRect(0, 0, CW, CH);
        L.h.fillStyle = 'rgb(40,40,40)'; L.h.fillRect(0, 0, CW, CH);
    }
    // tinted band inside the gold frame
    for (const [g, style] of [[L.c, tint], [L.h, 'rgb(70,70,70)']]) {
        g.save();
        const p = new Path2D();
        const tmp = { moveTo: p.moveTo.bind(p), arcTo: p.arcTo.bind(p), closePath: p.closePath.bind(p), beginPath() {} };
        roundRectPath(tmp, 10, 10, CW - 20, CH - 20, CR - 8);
        roundRectPath(tmp, 30, 30, CW - 60, CH - 60, CR - 20);
        g.fillStyle = style;
        g.fill(p, 'evenodd');
        g.restore();
    }
    // gold frame: outer and inner rules
    shape(L, (g) => roundRectPath(g, 12, 12, CW - 24, CH - 24, CR - 9), { stroke: (g) => goldGrad(g), lw: 7, height: 0.8, orm: ORM.gold });
    shape(L, (g) => roundRectPath(g, 30, 30, CW - 60, CH - 60, CR - 20), { stroke: (g) => goldGrad(g), lw: 3.5, height: 0.7, orm: ORM.gold });
    // corner flourishes
    for (const [cx, cy, sx, sy] of [[30, 30, 1, 1], [CW - 30, 30, -1, 1], [30, CH - 30, 1, -1], [CW - 30, CH - 30, -1, -1]]) {
        shape(L, (g) => {
            g.beginPath();
            g.moveTo(cx, cy + sy * 70);
            g.bezierCurveTo(cx + sx * 10, cy + sy * 30, cx + sx * 30, cy + sy * 10, cx + sx * 70, cy);
            g.moveTo(cx + sx * 16, cy + sy * 52);
            g.bezierCurveTo(cx + sx * 20, cy + sy * 30, cx + sx * 40, cy + sy * 22, cx + sx * 36, cy + sy * 36);
            g.bezierCurveTo(cx + sx * 32, cy + sy * 46, cx + sx * 22, cy + sy * 40, cx + sx * 26, cy + sy * 32);
        }, { stroke: (g) => goldGrad(g), lw: 3, height: 0.75, orm: ORM.gold });
    }
}

function finishBase(L) { for (const g of [L.c, L.h, L.m]) g.restore(); }

function text(L, str, x, y, { size = 60, color = '#222', align = 'center', weight = 'bold', height = 0.6, font = SERIF, stroke = null, rot = 0, orm = ORM.gloss, maxW = 0 } = {}) {
    for (const [g, k] of [[L.c, 'c'], [L.h, 'h'], [L.m, 'm']]) {
        g.save();
        g.translate(x, y); g.rotate(rot);
        g.font = `${weight} ${size}px ${font}`;
        g.textAlign = align; g.textBaseline = 'middle';
        const args = maxW ? [str, 0, 0, maxW] : [str, 0, 0];
        if (k === 'c') {
            if (stroke) { g.strokeStyle = stroke; g.lineWidth = size * 0.08; g.strokeText(...args); }
            g.fillStyle = color; g.fillText(...args);
        } else if (k === 'h') { const v = Math.round(height * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillText(...args); } else { g.fillStyle = orm; g.fillText(...args); }
        g.restore();
    }
}

function drawIndex(L, rankStr, suit, color) {
    for (const flip of [false, true]) {
        for (const g of [L.c, L.h, L.m]) { g.save(); if (flip) { g.translate(CW, CH); g.rotate(Math.PI); } }
        text(L, rankStr, 70, 96, { size: rankStr.length > 1 ? 82 : 100, color, height: 0.75, stroke: 'rgba(255,245,220,0.7)', font: '"Georgia", "DejaVu Serif", serif', maxW: 96 });
        if (suit) drawGlyph(L, suit, 70, 176, 62, { height: 0.6 });
        for (const g of [L.c, L.h, L.m]) g.restore();
    }
}

// ------------------------------------------------------------------ pips

const PIPS = {
    2: [[0, -1], [0, 1]], 3: [[0, -1], [0, 0], [0, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    7: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    8: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
    9: [[-1, -1], [1, -1], [-1, -0.33], [1, -0.33], [0, 0], [-1, 0.33], [1, 0.33], [-1, 1], [1, 1]],
    10: [[-1, -1], [1, -1], [0, -0.66], [-1, -0.33], [1, -0.33], [-1, 0.33], [1, 0.33], [0, 0.66], [-1, 1], [1, 1]],
};

function drawPips(L, rank, suit) {
    const cx = CW / 2, cy = CH / 2 + 4;
    const sx = 80, sy = 200;
    const size = rank <= 3 ? 100 : rank <= 6 ? 86 : 72;
    // faint medallion behind the pips
    const th = SUIT_THEME[suit];
    L.c.save();
    const rg = L.c.createRadialGradient(cx, cy, 20, cx, cy, 250);
    rg.addColorStop(0, th.light + '66'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    L.c.fillStyle = rg; L.c.fillRect(0, 0, CW, CH);
    L.c.restore();
    for (const [px, py] of PIPS[rank]) drawGlyph(L, suit, cx + px * sx, cy + py * sy, size, { flip: py > 0.01 });
}

// ------------------------------------------------------------------ ace

function drawAce(L, suit) {
    const cx = CW / 2, cy = CH / 2;
    const th = SUIT_THEME[suit];
    // spirograph halo
    const g = L.c;
    g.save();
    g.translate(cx, cy);
    for (let k = 0; k < 3; k++) {
        g.beginPath();
        const R = 150 - k * 28, r = 37 + k * 9, d = 60 - k * 10;
        for (let t = 0; t <= Math.PI * 2 * 12; t += 0.02) {
            const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
            const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
            if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = k === 0 ? 'rgba(200,150,40,0.55)' : th.mid + '55';
        g.lineWidth = 1.4;
        g.stroke();
    }
    g.restore();
    // rays
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        shape(L, (c) => { c.beginPath(); c.moveTo(cx + Math.cos(a) * 118, cy + Math.sin(a) * 118); c.lineTo(cx + Math.cos(a) * (i % 2 ? 170 : 200), cy + Math.sin(a) * (i % 2 ? 170 : 200)); },
            { stroke: (c) => goldGrad(c, cy - 200, cy + 200), lw: i % 2 ? 2 : 4, height: 0.5, orm: ORM.gold });
    }
    shape(L, (c) => { c.beginPath(); c.arc(cx, cy, 116, 0, Math.PI * 2); }, { stroke: (c) => goldGrad(c, cy - 120, cy + 120), lw: 6, height: 0.8, orm: ORM.gold });
    drawGlyph(L, suit, cx, cy, 170, { height: 0.75, emblem: true });
    text(L, `ACE OF ${SUIT_INFO[suit].name.toUpperCase()}`, cx, CH - 78, { size: 24, color: th.ink, height: 0.45, weight: 'bold' });
}

// ------------------------------------------------------------------ face portraits

function drawPortrait(L, rank, suit) {
    const rng = makeRng(hashStr(`face${rank}${suit}`));
    const th = SUIT_THEME[suit];
    const g = L.c;
    const x0 = 128, y0 = 118, x1 = CW - 128, y1 = CH - 128;
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    const arch = (c) => {
        c.beginPath();
        c.moveTo(x0, y1);
        c.lineTo(x0, y0 + w / 2);
        c.arc(cx, y0 + w / 2, w / 2, Math.PI, 0);
        c.lineTo(x1, y1);
        c.closePath();
    };
    g.save();
    arch(g);
    g.clip();
    // background: suit gradient with rays
    const bg = g.createLinearGradient(0, y0, 0, y1);
    bg.addColorStop(0, th.light); bg.addColorStop(0.6, th.band); bg.addColorStop(1, th.mid);
    g.fillStyle = bg; g.fillRect(x0, y0, w, h);
    g.save(); g.globalAlpha = 0.18;
    for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (i - 9) * 0.16;
        g.beginPath(); g.moveTo(cx, y0 + h * 0.4); g.lineTo(cx + Math.cos(a - 0.04) * 600, y0 + h * 0.4 + Math.sin(a - 0.04) * 600); g.lineTo(cx + Math.cos(a + 0.04) * 600, y0 + h * 0.4 + Math.sin(a + 0.04) * 600);
        g.fillStyle = '#fff'; g.fill();
    }
    g.restore();

    const skinTones = ['#f0c8a0', '#d8a078', '#b07850', '#8a5a3a', '#f4d8bc', '#6a4028'];
    const skin = rng.pick(skinTones);
    const hairCols = ['#2a1a10', '#5a3418', '#a8702a', '#d8c070', '#c8c8c8', '#7a2a18', '#1a1a2a'];
    const hair = rank === 13 && rng.chance(0.5) ? '#d0d0d0' : rng.pick(hairCols);
    const headY = y0 + h * 0.38, headR = 62;

    // mantle / shoulders
    const robe = g.createLinearGradient(0, headY + 60, 0, y1);
    robe.addColorStop(0, th.robe[0]); robe.addColorStop(1, th.robe[1]);
    g.fillStyle = robe;
    g.beginPath();
    g.moveTo(x0 - 10, y1);
    g.bezierCurveTo(x0 + 10, headY + 110, cx - 70, headY + 70, cx, headY + 75);
    g.bezierCurveTo(cx + 70, headY + 70, x1 - 10, headY + 110, x1 + 10, y1);
    g.fill();
    // pattern on the robe
    g.save();
    g.clip();
    g.globalAlpha = 0.25;
    for (let yy = headY + 90; yy < y1; yy += 30) for (let xx = x0 + ((yy / 30) % 2) * 15; xx < x1; xx += 30) {
        g.fillStyle = th.light;
        g.beginPath(); suitPath(g, suit, xx, yy, 12); g.fill();
    }
    g.restore();
    // gold trim collar
    shape(L, (c) => { c.beginPath(); c.moveTo(cx - 95, headY + 115); c.quadraticCurveTo(cx, headY + 160, cx + 95, headY + 115); }, { stroke: (c) => goldGrad(c, headY + 100, headY + 170), lw: 12, height: 0.6, orm: ORM.gold });
    // neck
    g.fillStyle = skin;
    g.fillRect(cx - 22, headY + 40, 44, 45);
    // hair behind (queen: long)
    g.fillStyle = hair;
    if (rank === 12) {
        g.beginPath(); g.ellipse(cx, headY + 40, headR + 22, headR + 70, 0, 0, Math.PI * 2); g.fill();
    } else if (rank === 13) {
        g.beginPath(); g.ellipse(cx, headY + 10, headR + 12, headR + 25, 0, 0, Math.PI * 2); g.fill();
    }
    // head
    const hg = g.createRadialGradient(cx - 18, headY - 20, 10, cx, headY, headR * 1.2);
    hg.addColorStop(0, lighten(skin, 0.18)); hg.addColorStop(1, darken(skin, 0.25));
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(cx, headY, headR * 0.86, headR, 0, 0, Math.PI * 2); g.fill();
    // eyes
    const eyeY = headY - 6;
    for (const sx of [-1, 1]) {
        g.fillStyle = '#fff8f0';
        g.beginPath(); g.ellipse(cx + sx * 22, eyeY, 11, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rng.pick(['#3a6a9a', '#4a2a10', '#2a6a3a', '#6a4a2a']);
        g.beginPath(); g.arc(cx + sx * 22, eyeY, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(cx + sx * 22, eyeY, 2.4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = darken(skin, 0.5); g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx + sx * 10, eyeY - 14 - (rank === 11 ? 2 : 0)); g.quadraticCurveTo(cx + sx * 22, eyeY - 20, cx + sx * 34, eyeY - 13); g.stroke();
    }
    // nose & mouth
    g.strokeStyle = darken(skin, 0.35); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx, eyeY + 4); g.quadraticCurveTo(cx - 8, eyeY + 26, cx + 2, eyeY + 30); g.stroke();
    g.strokeStyle = rank === 12 ? '#a02030' : darken(skin, 0.45); g.lineWidth = rank === 12 ? 5 : 3;
    g.beginPath(); g.moveTo(cx - 14, eyeY + 44); g.quadraticCurveTo(cx, eyeY + 49, cx + 14, eyeY + 44); g.stroke();
    // hair on top
    g.fillStyle = hair;
    g.beginPath(); g.ellipse(cx, headY - headR * 0.62, headR * 0.9, headR * 0.45, 0, Math.PI, 0); g.fill();
    // king's beard
    if (rank === 13) {
        g.beginPath();
        g.moveTo(cx - 52, headY + 12);
        g.quadraticCurveTo(cx - 50, headY + 110, cx, headY + 125);
        g.quadraticCurveTo(cx + 50, headY + 110, cx + 52, headY + 12);
        g.quadraticCurveTo(cx + 30, headY + 40, cx, headY + 38);
        g.quadraticCurveTo(cx - 30, headY + 40, cx - 52, headY + 12);
        g.fill();
        g.strokeStyle = lighten(hair, 0.2); g.lineWidth = 1.5;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * 10, headY + 45); g.quadraticCurveTo(cx + i * 12, headY + 90, cx + i * 6, headY + 115); g.stroke(); }
    }
    // headwear
    if (rank === 13 || rank === 12) {
        const crownY = headY - headR * 0.85;
        const pts = rank === 13 ? 5 : 3;
        const cw = rank === 13 ? 120 : 96, chh = rank === 13 ? 58 : 34;
        shape(L, (c) => {
            c.beginPath();
            c.moveTo(cx - cw / 2, crownY + 16);
            for (let i = 0; i <= pts * 2; i++) {
                const xx = cx - cw / 2 + (i / (pts * 2)) * cw;
                const yy = i % 2 === 0 ? crownY - chh : crownY - chh * 0.35;
                c.lineTo(xx, yy);
            }
            c.lineTo(cx + cw / 2, crownY + 16);
            c.closePath();
        }, { fill: (c) => goldGrad(c, crownY - chh, crownY + 16), stroke: '#6a4010', lw: 2.5, height: 0.9, orm: ORM.gold });
        for (let i = 0; i <= pts; i++) {
            const xx = cx - cw / 2 + (i / pts) * cw;
            shape(L, (c) => { c.beginPath(); c.arc(xx, crownY - chh - 4, 7, 0, Math.PI * 2); }, { fill: th.mid, stroke: '#fff', lw: 1.5, height: 1, orm: ORM.gem });
        }
        shape(L, (c) => { c.beginPath(); c.arc(cx, crownY - 4, 10, 0, Math.PI * 2); }, { fill: '#e02040', stroke: '#fff4', lw: 2, height: 1, orm: ORM.gem });
    } else {
        // jack: feathered cap
        const capY = headY - headR * 0.7;
        g.fillStyle = th.robe[0];
        g.beginPath(); g.ellipse(cx + 6, capY, headR * 1.05, 30, -0.12, 0, Math.PI * 2); g.fill();
        g.fillStyle = darken(th.robe[0], 0.2);
        g.beginPath(); g.ellipse(cx + 6, capY - 18, headR * 0.7, 28, -0.12, Math.PI, 0); g.fill();
        g.strokeStyle = th.light; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx + 40, capY - 20); g.quadraticCurveTo(cx + 110, capY - 70, cx + 120, capY - 130); g.stroke();
        g.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const t = i / 14; const px = cx + 40 + t * 80, py = capY - 20 - t * 110; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 18, py + 6); g.stroke(); }
        shape(L, (c) => { c.beginPath(); c.moveTo(cx - headR, capY + 12); c.lineTo(cx + headR + 10, capY + 4); }, { stroke: (c) => goldGrad(c, capY, capY + 20), lw: 7, height: 0.7, orm: ORM.gold });
    }
    g.restore();
    // held emblem, lower right
    drawGlyph(L, suit, x0 + 50, y1 - 60, 64, { height: 0.7, emblem: true });
    // arch frame
    shape(L, arch, { stroke: (c) => goldGrad(c, y0, y1), lw: 7, height: 0.85, orm: ORM.gold });
    text(L, `${RANK_LONG[rank].toUpperCase()} OF ${SUIT_INFO[suit].name.toUpperCase()}`, CW / 2, CH - 78, { size: 23, color: th.ink, height: 0.45 });
}

function lighten(hex, t) { return adjust(hex, t); }
function darken(hex, t) { return adjust(hex, -t); }
function adjust(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (t > 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; } else { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ------------------------------------------------------------------ joker, ash, arcana

function drawJoker(L) {
    const g = L.c;
    g.save();
    roundRectPath(g, 40, 40, CW - 80, CH - 80, 20);
    g.clip();
    const cols = ['#d02040', '#2040c0', '#20a060', '#e0a020'];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = cols[(x + y) % 4];
        g.globalAlpha = 0.35;
        g.beginPath();
        const cx = 40 + x * 62 + (y % 2) * 31, cy = 40 + y * 62;
        g.moveTo(cx, cy - 31); g.lineTo(cx + 31, cy); g.lineTo(cx, cy + 31); g.lineTo(cx - 31, cy); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
    const cx = CW / 2, cy = CH / 2 + 10;
    // hat with three bells
    const hatCols = ['#d02040', '#2040c0', '#e0a020'];
    for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.9;
        g.fillStyle = hatCols[i];
        g.beginPath();
        g.moveTo(cx - 40 + i * 40, cy - 60);
        g.quadraticCurveTo(cx + Math.cos(a) * 150, cy - 90 + Math.sin(a) * 110, cx + Math.cos(a) * 170, cy - 60 + Math.sin(a) * 150);
        g.quadraticCurveTo(cx + Math.cos(a) * 80, cy - 70 + Math.sin(a) * 40, cx - 20 + i * 40, cy - 60);
        g.fill();
        shape(L, (c) => { c.beginPath(); c.arc(cx + Math.cos(a) * 170, cy - 60 + Math.sin(a) * 150, 16, 0, Math.PI * 2); }, { fill: (c) => goldGrad(c, cy - 250, cy), stroke: '#6a4010', lw: 2, height: 1, orm: ORM.gold });
    }
    // face (mask)
    g.fillStyle = '#f6efe6';
    g.beginPath(); g.ellipse(cx, cy + 20, 90, 110, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 34, cy, 18, 11, s * 0.3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#d02040';
    g.beginPath(); g.arc(cx, cy + 34, 12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 50, cy + 60); g.quadraticCurveTo(cx, cy + 110, cx + 50, cy + 60); g.stroke();
    g.fillStyle = '#2040c0';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 34, cy + 14); g.lineTo(cx + s * 30, cy + 44); g.lineTo(cx + s * 38, cy + 44); g.fill(); }
    // ruff
    for (let i = 0; i < 9; i++) {
        g.fillStyle = i % 2 ? '#fff' : '#e0d8f0';
        g.beginPath(); g.arc(cx - 120 + i * 30, cy + 150, 24, 0, Math.PI * 2); g.fill();
    }
    text(L, 'J O K E R', 70, CH / 2, { size: 44, color: '#d02040', rot: -Math.PI / 2, height: 0.7, stroke: '#fff' });
    text(L, 'WILD', CW / 2, CH - 78, { size: 30, color: '#2040c0', height: 0.5 });
}

function drawAsh(L) {
    const g = L.c;
    const N = makeNoise(99);
    g.save();
    roundRectPath(g, 0, 0, CW, CH, CR);
    g.clip();
    const off = canvas(CW, CH);
    const og = off.getContext('2d');
    const img = og.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const n = N.fbm(x / 60, y / 60, 4);
        const e = Math.min(x, y, CW - x, CH - y) / 90;
        const v = (0.25 + n * 0.35) * Math.min(1, 0.4 + e * 0.6);
        const i = (y * CW + x) * 4;
        const ember = e < 0.3 ? Math.max(0, n - 0.55) * 3 * (1 - e / 0.3) : 0;
        img.data[i] = v * 190 + ember * 220; img.data[i + 1] = v * 180 + ember * 80; img.data[i + 2] = v * 170; img.data[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    g.drawImage(off, 0, 0);
    g.strokeStyle = 'rgba(20,15,12,0.8)'; g.lineWidth = 3;
    const rng = makeRng(7);
    for (let k = 0; k < 7; k++) {
        let x = rng.range(100, 400), y = rng.range(150, 550);
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 6; s++) { x += rng.range(-40, 40); y += rng.range(-40, 40); g.lineTo(x, y); }
        g.stroke();
    }
    g.restore();
    text(L, 'ASH', CW / 2, CH / 2, { size: 120, color: 'rgba(40,34,30,0.85)', height: 0.3, stroke: 'rgba(160,150,140,0.4)' });
    text(L, 'no suit · no chips', CW / 2, CH / 2 + 90, { size: 28, color: 'rgba(210,200,190,0.8)', weight: 'italic', height: 0.2 });
}

const ARC_ICON = {
    fireball: 'flame', kindle: 'flame', barrier: 'shield', bulwark: 'shield', transmute: 'suits', swap: 'arrows', ascend: 'up',
    sweep: 'wind', foresight: 'eye', conjure: 'star', secondWind: 'wind', gamble: 'die', hex: 'skull', salvo: 'arrows',
    thunder: 'bolt', purify: 'drop', favour: 'crown', mirror: 'mirror', mend: 'leaf', harvest: 'moon', rally: 'star', reap: 'moon',
};

function drawIcon(g, kind, x, y, s, col) {
    g.save();
    g.translate(x, y);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.08; g.lineCap = 'round'; g.lineJoin = 'round';
    const P = new Path2D();
    switch (kind) {
        case 'flame':
            P.moveTo(0, s * 0.55); P.bezierCurveTo(-s * 0.5, s * 0.4, -s * 0.45, -s * 0.1, -s * 0.1, -s * 0.6);
            P.bezierCurveTo(-s * 0.05, -s * 0.2, s * 0.15, -s * 0.1, s * 0.15, -s * 0.4);
            P.bezierCurveTo(s * 0.5, -s * 0.1, s * 0.5, s * 0.4, 0, s * 0.55); g.fill(P); break;
        case 'shield':
            P.moveTo(0, -s * 0.55); P.lineTo(s * 0.45, -s * 0.38); P.quadraticCurveTo(s * 0.45, s * 0.3, 0, s * 0.58); P.quadraticCurveTo(-s * 0.45, s * 0.3, -s * 0.45, -s * 0.38); P.closePath(); g.fill(P); break;
        case 'bolt':
            P.moveTo(s * 0.1, -s * 0.6); P.lineTo(-s * 0.3, s * 0.08); P.lineTo(0, s * 0.08); P.lineTo(-s * 0.12, s * 0.6); P.lineTo(s * 0.32, -s * 0.1); P.lineTo(s * 0.02, -s * 0.1); P.closePath(); g.fill(P); break;
        case 'eye':
            P.moveTo(-s * 0.55, 0); P.quadraticCurveTo(0, -s * 0.5, s * 0.55, 0); P.quadraticCurveTo(0, s * 0.5, -s * 0.55, 0); g.stroke(P);
            g.beginPath(); g.arc(0, 0, s * 0.17, 0, Math.PI * 2); g.fill(); break;
        case 'crown':
            P.moveTo(-s * 0.5, s * 0.3); P.lineTo(-s * 0.5, -s * 0.3); P.lineTo(-s * 0.25, 0); P.lineTo(0, -s * 0.45); P.lineTo(s * 0.25, 0); P.lineTo(s * 0.5, -s * 0.3); P.lineTo(s * 0.5, s * 0.3); P.closePath(); g.fill(P); break;
        case 'star':
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? s * 0.22 : s * 0.55; if (i) P.lineTo(Math.cos(a) * r, Math.sin(a) * r); else P.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
            P.closePath(); g.fill(P); break;
        case 'drop':
            P.moveTo(0, -s * 0.6); P.bezierCurveTo(s * 0.2, -s * 0.2, s * 0.42, 0, s * 0.42, s * 0.2); P.arc(0, s * 0.2, s * 0.42, 0, Math.PI); P.bezierCurveTo(-s * 0.42, 0, -s * 0.2, -s * 0.2, 0, -s * 0.6); g.fill(P); break;
        case 'wind':
            for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-s * 0.55, (i - 1) * s * 0.3); g.bezierCurveTo(0, (i - 1) * s * 0.3 - s * 0.15, s * 0.3, (i - 1) * s * 0.3, s * 0.35 - i * s * 0.1, (i - 1) * s * 0.3 - s * 0.18); g.stroke(); } break;
        case 'arrows':
            for (const d of [-1, 1]) { g.beginPath(); g.moveTo(-s * 0.5 * d, d * s * 0.15); g.lineTo(s * 0.5 * d, d * s * 0.15); g.lineTo(s * 0.3 * d, d * s * 0.15 - s * 0.18); g.stroke(); } break;
        case 'up':
            g.beginPath(); g.moveTo(0, s * 0.55); g.lineTo(0, -s * 0.45); g.moveTo(-s * 0.35, -s * 0.1); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.35, -s * 0.1); g.stroke(); break;
        case 'die':
            P.rect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84); g.stroke(P);
            for (const [a, b] of [[-0.2, -0.2], [0.2, 0.2], [0, 0], [0.2, -0.2], [-0.2, 0.2]]) { g.beginPath(); g.arc(a * s, b * s, s * 0.07, 0, Math.PI * 2); g.fill(); } break;
        case 'skull':
            g.beginPath(); g.arc(0, -s * 0.1, s * 0.4, 0, Math.PI * 2); g.fill();
            g.fillRect(-s * 0.22, s * 0.2, s * 0.44, s * 0.3);
            g.fillStyle = '#10061a';
            for (const d of [-1, 1]) { g.beginPath(); g.arc(d * s * 0.15, -s * 0.1, s * 0.1, 0, Math.PI * 2); g.fill(); } break;
        case 'mirror':
            g.beginPath(); g.ellipse(0, -s * 0.1, s * 0.3, s * 0.42, 0, 0, Math.PI * 2); g.stroke();
            g.beginPath(); g.moveTo(0, s * 0.32); g.lineTo(0, s * 0.6); g.stroke(); break;
        case 'leaf':
            P.moveTo(0, s * 0.55); P.quadraticCurveTo(-s * 0.6, 0, 0, -s * 0.55); P.quadraticCurveTo(s * 0.6, 0, 0, s * 0.55); g.fill(P); break;
        case 'moon':
            g.beginPath(); g.arc(0, 0, s * 0.5, Math.PI * 0.3, Math.PI * 1.7); g.arc(s * 0.2, 0, s * 0.38, Math.PI * 1.6, Math.PI * 0.4, true); g.fill(); break;
        case 'suits':
            for (const [k, dx, dy] of [['S', -0.25, -0.25], ['H', 0.25, -0.25], ['C', -0.25, 0.25], ['D', 0.25, 0.25]]) { suitPath(g, k, dx * s, dy * s, s * 0.4); g.fill(); } break;
        default: break;
    }
    g.restore();
}

function wrapText(g, str, maxW) {
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
}

function drawArcana(L, c) {
    const a = ARCANA[c.id];
    const g = L.c;
    const rng = makeRng(hashStr(c.id));
    // deep night base
    g.save();
    roundRectPath(g, 0, 0, CW, CH, CR);
    g.clip();
    const bg = g.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, c.up ? '#16302a' : '#1a1438'); bg.addColorStop(1, c.up ? '#06140e' : '#07061a');
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${rng.range(0.1, 0.6)})`; g.beginPath(); g.arc(rng.range(0, CW), rng.range(0, CH), rng.range(0.5, 1.8), 0, Math.PI * 2); g.fill(); }
    g.restore();
    L.h.fillStyle = 'rgb(20,20,20)'; L.h.fillRect(0, 0, CW, CH);
    L.m.fillStyle = ORM.gloss; L.m.fillRect(0, 0, CW, CH);

    const accent = c.up ? '#7dffb0' : '#b8a0ff';
    // sigil
    const cx = CW / 2, cy = 290;
    const ring = (r, lw, alpha = 1) => shape(L, (x) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); }, { stroke: (x) => { x.globalAlpha = alpha; return goldGrad(x, cy - r, cy + r); }, lw, height: 0.7, orm: ORM.gold });
    ring(150, 5); ring(136, 2); ring(80, 3);
    const n = rng.int(5, 9);
    shape(L, (x) => {
        x.beginPath();
        for (let i = 0; i <= n; i++) {
            const k = (i * Math.floor(n / 2)) % n;
            const ang = -Math.PI / 2 + (k / n) * Math.PI * 2;
            if (i === 0) x.moveTo(cx + Math.cos(ang) * 136, cy + Math.sin(ang) * 136); else x.lineTo(cx + Math.cos(ang) * 136, cy + Math.sin(ang) * 136);
        }
    }, { stroke: accent, lw: 2.5, height: 0.5, orm: ORM.silver });
    g.save();
    g.font = `20px ${SERIF}`; g.fillStyle = 'rgba(255,230,160,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        g.save(); g.translate(cx + Math.cos(ang) * 143, cy + Math.sin(ang) * 143); g.rotate(ang + Math.PI / 2);
        g.fillText(runes[rng.int(0, runes.length - 1)], 0, 0); g.restore();
    }
    g.restore();
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 80);
    glow.addColorStop(0, accent + 'aa'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 80, 0, Math.PI * 2); g.fill();
    drawIcon(g, ARC_ICON[c.id] ?? 'star', cx, cy, 110, '#fff4d8');
    L.h.save(); drawIcon(L.h, ARC_ICON[c.id] ?? 'star', cx, cy, 110, 'rgb(200,200,200)'); L.h.restore();

    // frame
    shape(L, (x) => roundRectPath(x, 12, 12, CW - 24, CH - 24, CR - 9), { stroke: (x) => goldGrad(x), lw: 8, height: 0.8, orm: ORM.gold });
    shape(L, (x) => roundRectPath(x, 30, 30, CW - 60, CH - 60, CR - 20), { stroke: (x) => goldGrad(x), lw: 3, height: 0.7, orm: ORM.gold });
    // title ribbon
    shape(L, (x) => { x.beginPath(); x.moveTo(60, 470); x.lineTo(CW - 60, 470); x.lineTo(CW - 40, 500); x.lineTo(CW - 60, 530); x.lineTo(60, 530); x.lineTo(40, 500); x.closePath(); },
        { fill: (x) => { const gr = x.createLinearGradient(0, 470, 0, 530); gr.addColorStop(0, '#5a2a0a'); gr.addColorStop(1, '#2a1004'); return gr; }, stroke: (x) => goldGrad(x, 470, 530), lw: 3, height: 0.6, orm: ORM.gloss });
    text(L, a.name + (c.up ? '+' : ''), CW / 2, 501, { size: 38, color: c.up ? '#b8ffd0' : '#ffe8b0', height: 0.8, maxW: CW - 130 });
    // description
    const n2 = c.up ? a.un : a.n;
    const desc = a.text(n2);
    g.save();
    g.font = `30px ${SERIF}`;
    const lines = wrapText(g, desc, CW - 120);
    g.restore();
    lines.slice(0, 4).forEach((ln, i) => text(L, ln, CW / 2, 575 + i * 36 - (lines.length - 1) * 8, { size: 30, weight: 'normal', color: '#f0e6d0', height: 0.25 }));
    // cost gem
    const cost = arcanaCost(c);
    shape(L, (x) => { x.beginPath(); x.arc(78, 78, 42, 0, Math.PI * 2); }, { fill: (x) => { const gr = x.createRadialGradient(66, 64, 4, 78, 78, 42); gr.addColorStop(0, '#9ae8ff'); gr.addColorStop(1, '#10407a'); return gr; }, stroke: (x) => goldGrad(x, 36, 120), lw: 5, height: 1, orm: ORM.gem });
    text(L, String(cost), 78, 80, { size: 52, color: '#fff', height: 1, stroke: '#0a2040' });
    text(L, 'ARCANA', CW - 96, 70, { size: 22, color: accent, height: 0.3 });
}

function drawEnchantSeal(L, ench) {
    const e = ENCHANTS[ench];
    const x = CW - 78, y = 80;
    // coloured edge glow
    L.c.save();
    roundRectPath(L.c, 16, 16, CW - 32, CH - 32, CR - 10);
    L.c.strokeStyle = e.color; L.c.lineWidth = 6; L.c.shadowColor = e.color; L.c.shadowBlur = 24;
    L.c.globalAlpha = 0.9; L.c.stroke();
    L.c.restore();
    shape(L, (g) => {
        g.beginPath();
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const r = i % 2 ? 38 : 44; if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.closePath();
    }, { fill: (g) => { const gr = g.createRadialGradient(x - 10, y - 10, 2, x, y, 44); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, e.color); gr.addColorStop(1, '#222'); return gr; }, stroke: '#2228', lw: 2, height: 0.9, orm: ORM.gem });
    text(L, e.name[0], x, y + 2, { size: 40, color: '#1a1020', height: 1 });
}

// ------------------------------------------------------------------ public

const cache = new Map();

export function cardKey(c) {
    if (c.kind === 'ash') return 'ash';
    if (c.kind === 'arcana') return `arc:${c.id}:${c.up ? 1 : 0}`;
    if (c.joker) return 'joker';
    return `p:${c.rank}:${c.suit}:${c.ench ?? ''}`;
}

/** Textures for a card face: { map, normalMap, ormMap }. */
export function faceTextures(c) {
    const key = cardKey(c);
    if (cache.has(key)) return cache.get(key);
    const L = makeLayers();
    if (c.kind === 'arcana') {
        drawArcana(L, c);
    } else if (c.kind === 'ash') {
        drawAsh(L);
    } else if (c.joker) {
        drawBase(L, 'rgba(120,40,160,0.35)');
        drawJoker(L);
        finishBase(L);
    } else {
        const th = SUIT_THEME[c.suit];
        drawBase(L, th.band + '88');
        if (c.rank === 14) drawAce(L, c.suit);
        else if (c.rank >= 11) drawPortrait(L, c.rank, c.suit);
        else drawPips(L, c.rank, c.suit);
        drawIndex(L, rankLabel(c.rank), c.suit, th.ink);
        if (c.ench) drawEnchantSeal(L, c.ench);
        finishBase(L);
    }
    const out = {
        map: colorTex(L.col),
        normalMap: dataTex(normalFromHeight(L.hgt, 3)),
        ormMap: dataTex(L.orm),
    };
    cache.set(key, out);
    return out;
}

let backTex = null;
export function backTextures() {
    if (backTex) return backTex;
    const L = makeLayers();
    const g = L.c;
    g.save();
    roundRectPath(g, 0, 0, CW, CH, CR);
    g.clip();
    const bg = g.createRadialGradient(CW / 2, CH / 2, 30, CW / 2, CH / 2, 460);
    bg.addColorStop(0, '#5a1020'); bg.addColorStop(1, '#1a0408');
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    g.restore();
    L.h.fillStyle = 'rgb(30,30,30)'; L.h.fillRect(0, 0, CW, CH);
    L.m.fillStyle = 'rgb(0,150,0)'; L.m.fillRect(0, 0, CW, CH);
    // diamond lattice
    for (let y = 60; y < CH - 40; y += 36) for (let x = 60; x < CW - 40; x += 36) {
        shape(L, (c) => { c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y); c.lineTo(x, y + 8); c.lineTo(x - 8, y); c.closePath(); }, { fill: 'rgba(200,140,60,0.25)', height: 0.25 });
    }
    // mandala
    const cx = CW / 2, cy = CH / 2;
    for (let k = 0; k < 4; k++) {
        const R = 190 - k * 38, r = 23 + k * 11, d = 70 - k * 12;
        shape(L, (c) => {
            c.beginPath();
            for (let t = 0; t <= Math.PI * 2 * 12; t += 0.015) {
                const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
                const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
                if (t === 0) c.moveTo(x, y); else c.lineTo(x, y);
            }
        }, { stroke: (c) => goldGrad(c, cy - R, cy + R), lw: 1.6, height: 0.6, orm: ORM.gold });
    }
    shape(L, (c) => { c.beginPath(); c.arc(cx, cy, 56, 0, Math.PI * 2); }, { fill: (c) => goldGrad(c, cy - 56, cy + 56), height: 0.9, orm: ORM.gold });
    drawGlyph(L, 'H', cx, cy, 70, { height: 1 });
    shape(L, (c) => roundRectPath(c, 12, 12, CW - 24, CH - 24, CR - 9), { stroke: (c) => goldGrad(c), lw: 8, height: 0.8, orm: ORM.gold });
    shape(L, (c) => roundRectPath(c, 30, 30, CW - 60, CH - 60, CR - 20), { stroke: (c) => goldGrad(c), lw: 3, height: 0.7, orm: ORM.gold });
    backTex = { map: colorTex(L.col), normalMap: dataTex(normalFromHeight(L.hgt, 3)), ormMap: dataTex(L.orm) };
    return backTex;
}

/** A plain 2D canvas of a card face, for DOM thumbnails (rewards, shop, deck view). */
export function faceCanvas(c) {
    return faceTextures(c).map.image;
}

export { cardText, THREE };
