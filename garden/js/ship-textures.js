// Canvas textures for the Black Nocturne, the gothic galleon: tattered sails
// with their emblems, the flag, stained glass for the stern windows and the
// name plate. No image files; everything is drawn here.

import * as THREE from 'three';
import { rng, TAU } from './util.js';

const canvas = (w, h = w) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

function tex(c, { repeat = false } = {}) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
}

/** A skull with crossed bones, white on whatever is behind. (cx, cy) is its centre, r its size. */
function skull(ctx, cx, cy, r, bone = '#e4dcc4', dark = '#120a0e') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    // crossed bones
    ctx.strokeStyle = bone;
    ctx.fillStyle = bone;
    ctx.lineWidth = r * 0.22;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-s * r * 1.15, r * 0.95);
        ctx.lineTo(s * r * 1.15, r * 1.75);
        ctx.stroke();
        for (const e of [-1, 1]) {
            for (const k of [-1, 1]) {
                ctx.beginPath();
                ctx.arc(s * e * r * 1.15 + (e < 0 ? 0 : 0), r * (e * s > 0 ? 1.75 : 0.95) + k * r * 0.14, r * 0.16, 0, TAU);
                ctx.fill();
            }
        }
    }
    // cranium and jaw
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-r * 0.5, r * 0.42, r, r * 0.7, r * 0.12);
    ctx.fill();
    // eyes, nose, teeth
    ctx.fillStyle = dark;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.36, -r * 0.05, r * 0.24, r * 0.27, s * 0.2, 0, TAU);
        ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, r * 0.12);
    ctx.lineTo(-r * 0.12, r * 0.4);
    ctx.lineTo(r * 0.12, r * 0.4);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.05;
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.17, r * 0.62);
        ctx.lineTo(i * r * 0.17, r * 1.08);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.8);
    ctx.lineTo(r * 0.5, r * 0.8);
    ctx.stroke();
    ctx.restore();
}

/** A pointed (ogive) arch outline from (x0, yBase) to (x1, yBase) rising to yApex. */
function ogive(ctx, x0, x1, yBase, yApex) {
    const mx = (x0 + x1) / 2, sh = yBase - (yBase - yApex) * 0.45;
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(x0, sh);
    ctx.bezierCurveTo(x0, sh - (sh - yApex) * 0.55, mx - (mx - x0) * 0.25, yApex + (sh - yApex) * 0.25, mx, yApex);
    ctx.bezierCurveTo(mx + (x1 - mx) * 0.25, yApex + (sh - yApex) * 0.25, x1, sh - (sh - yApex) * 0.55, x1, sh);
    ctx.lineTo(x1, yBase);
}

/** Rose window: petals, rings and spokes. */
function rose(ctx, cx, cy, r, c1 = '#a3162a', c2 = '#d9b25a') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = c2;
    ctx.fillStyle = c1;
    for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((i / 12) * TAU);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.62, r * 0.14, r * 0.3, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    for (const k of [1, 0.82, 0.34]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, TAU);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, TAU);
    ctx.fillStyle = c2;
    ctx.fill();
    ctx.restore();
}

/**
 * A tattered sail, cloth on a transparent ground (the edges are torn away so
 * the sails read as ragged, and alphaTest cuts them out).
 * kind: 'skull' | 'rose' | 'cross' | 'plain'. Drawn upright, 0,0 at the head.
 */
export function sailTexture(kind, size = 256, seed = kind) {
    const w = size, h = size;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng('sail-' + seed);
    // cloth: a bruised black-violet with lighter seams
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2c2530');
    g.addColorStop(1, '#17121a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(160,140,170,0.22)';
    ctx.lineWidth = 1.5;
    for (let x = w / 7; x < w; x += w / 7) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + r.range(-1, 1), h);
        ctx.stroke();
    }
    for (let i = 0; i < 700; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(r() * w, r() * h, r.range(1, 6), 1);
    }
    // a gold-thread border, stitched
    ctx.strokeStyle = '#a58545';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 5]);
    ctx.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.88);
    ctx.setLineDash([]);
    // reefing bands
    ctx.fillStyle = 'rgba(70,55,60,0.5)';
    for (const y of [0.0, 0.34, 0.68]) ctx.fillRect(0, h * y, w, h * 0.035);

    // the emblem
    const cx = w / 2, cy = h * 0.46;
    if (kind === 'skull') {
        ctx.strokeStyle = '#9d1a2c';
        ctx.lineWidth = w * 0.035;
        ogive(ctx, w * 0.12, w * 0.88, h * 0.84, h * 0.04);
        ctx.stroke();
        ctx.strokeStyle = '#a58545';
        ctx.lineWidth = w * 0.01;
        ogive(ctx, w * 0.17, w * 0.83, h * 0.8, h * 0.1);
        ctx.stroke();
        skull(ctx, cx, cy - h * 0.04, w * 0.19);
    } else if (kind === 'rose') {
        rose(ctx, cx, cy, w * 0.34);
    } else if (kind === 'cross') {
        ctx.fillStyle = '#8e1426';
        ctx.fillRect(cx - w * 0.045, h * 0.1, w * 0.09, h * 0.7);
        ctx.fillRect(cx - w * 0.2, h * 0.5, w * 0.4, h * 0.075);
        ctx.strokeStyle = '#c8a455';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - w * 0.045, h * 0.1, w * 0.09, h * 0.7);
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(cx + s * w * 0.27, h * 0.3, w * 0.07, 0, TAU);
            ctx.fillStyle = '#d9d0b8';
            ctx.fill();
        }
    } else {
        ctx.fillStyle = 'rgba(140,22,40,0.7)';
        for (const y of [0.18, 0.5, 0.72]) ctx.fillRect(w * 0.1, h * y, w * 0.8, h * 0.05);
    }

    // weather stains
    for (let i = 0; i < 9; i++) {
        const gr = ctx.createRadialGradient(r() * w, r() * h, 2, r() * w, r() * h, w * r.range(0.1, 0.25));
        gr.addColorStop(0, 'rgba(0,0,0,0.18)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
    }

    // torn away: a ragged foot, scalloped sides and some holes
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, h);
    let x = 0;
    ctx.lineTo(0, h * 0.9);
    while (x < w) {
        x += r.range(8, 26);
        ctx.lineTo(x, h * (r() < 0.35 ? r.range(0.76, 0.88) : r.range(0.9, 0.97)));
    }
    ctx.lineTo(w, h);
    ctx.fill();
    for (const side of [0, 1]) {
        ctx.beginPath();
        let y = 0;
        ctx.moveTo(side ? w : 0, 0);
        while (y < h) {
            y += r.range(10, 28);
            const dx = r() < 0.3 ? r.range(6, 14) : r.range(0, 4);
            ctx.lineTo(side ? w - dx : dx, y);
        }
        ctx.lineTo(side ? w : 0, h);
        ctx.fill();
    }
    const holes = kind === 'plain' ? 5 : 4;
    for (let i = 0; i < holes; i++) {
        const hx = r.range(0.12, 0.88) * w, hy = r.range(0.22, 0.78) * h, hr = r.range(5, 14);
        ctx.beginPath();
        for (let a = 0; a < 9; a++) {
            const rr = hr * r.range(0.5, 1.4);
            ctx[a ? 'lineTo' : 'moveTo'](hx + Math.cos((a / 9) * TAU) * rr, hy + Math.sin((a / 9) * TAU) * rr);
        }
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    return tex(c);
}

/** The Jolly Roger: skull and bones in bone-white on black, gold-edged, torn at the fly. */
export function flagTexture() {
    const w = 256, h = 160;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a070c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8944a';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.strokeStyle = '#7e1424';
    ctx.lineWidth = 2;
    ctx.strokeRect(11, 11, w - 22, h - 22);
    skull(ctx, w * 0.5, h * 0.4, h * 0.22);
    const r = rng('flag');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(w, 0);
    let y = 0;
    ctx.lineTo(w - 3, 0);
    while (y < h) {
        y += r.range(8, 20);
        ctx.lineTo(w - r.range(2, 22), y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
    return tex(c);
}

/** A long crimson pennant with a gold stripe, cut to a swallowtail. */
export function pennantTexture() {
    const w = 256, h = 48;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#5a0d1a');
    g.addColorStop(1, '#9d1a2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8a455';
    ctx.fillRect(0, h * 0.44, w, h * 0.12);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - w * 0.28, h / 2);
    ctx.lineTo(w, h);
    ctx.fill();
    return tex(c);
}

/**
 * Stained glass. 'lancet': a tall pointed window; 'rose': a round one. The
 * outside of the shape is transparent; the colours double as the glow.
 */
export function glassTexture(kind = 'lancet', size = 256) {
    const w = kind === 'lancet' ? size / 2 : size, h = size;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng('glass-' + kind);
    const pal = ['#d9892b', '#a3162a', '#2b7f86', '#e6c25a', '#6b2a8a', '#c8501f'];
    ctx.save();
    if (kind === 'lancet') ogive(ctx, 3, w - 3, h - 3, 3);
    else ctx.arc(w / 2, h / 2, w / 2 - 3, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(0, 0, w, h);
    // panes in a lattice, each its own colour with a glow at the centre
    const nx = kind === 'lancet' ? 3 : 8, ny = kind === 'lancet' ? 9 : 8;
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const x0 = (i * w) / nx, y0 = (j * h) / ny;
            const col = pal[Math.floor(r() * pal.length)];
            const gr = ctx.createRadialGradient(x0 + w / nx / 2, y0 + h / ny / 2, 1, x0 + w / nx / 2, y0 + h / ny / 2, w / nx);
            gr.addColorStop(0, '#fff2c8');
            gr.addColorStop(0.35, col);
            gr.addColorStop(1, col);
            ctx.fillStyle = gr;
            ctx.fillRect(x0, y0, w / nx + 1, h / ny + 1);
        }
    }
    if (kind === 'rose') {
        ctx.globalAlpha = 0.9;
        rose(ctx, w / 2, h / 2, w * 0.46, '#a3162a', '#e6c25a');
        ctx.globalAlpha = 1;
    }
    // leading
    ctx.strokeStyle = '#120a08';
    ctx.lineWidth = 3;
    for (let i = 1; i < nx; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / nx, 0);
        ctx.lineTo((i * w) / nx, h);
        ctx.stroke();
    }
    for (let j = 1; j < ny; j++) {
        ctx.beginPath();
        ctx.moveTo(0, (j * h) / ny);
        ctx.lineTo(w, (j * h) / ny);
        ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#120a08';
    ctx.lineWidth = 6;
    if (kind === 'lancet') ogive(ctx, 3, w - 3, h - 3, 3);
    else {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 3, 0, TAU);
    }
    ctx.stroke();
    return tex(c);
}

/** A gilt name plate for the stern. */
export function namePlate(text, sub) {
    const w = 1024, h = 192;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1a14');
    g.addColorStop(1, '#150d0a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8a455';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = '#e2c26c';
    ctx.shadowColor = '#8c6a20';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${sub ? 84 : 100}px Georgia, "Times New Roman", serif`;
    ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w - 140);
    if (sub) {
        ctx.font = `italic 40px Georgia, serif`;
        ctx.fillStyle = '#c9b27a';
        ctx.fillText(sub, w / 2, h * 0.76, w - 140);
    }
    return tex(c);
}

/** A soft round sprite for spray, foam and glows. */
export function softDot() {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** A glowing rune ring for the deck at the helm. */
export function runeRing() {
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = '#8ff6ff';
    ctx.fillStyle = '#8ff6ff';
    ctx.lineWidth = 5;
    for (const rr of [118, 96]) {
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((i / 12) * TAU);
        ctx.beginPath();
        ctx.moveTo(0, -100);
        ctx.lineTo(8, -108);
        ctx.lineTo(0, -116);
        ctx.lineTo(-8, -108);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    // an anchor in the middle
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(0, 44);
    ctx.moveTo(-18, -24);
    ctx.lineTo(18, -24);
    ctx.arc(0, 8, 40, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -56, 9, 0, TAU);
    ctx.stroke();
    return tex(c);
}
