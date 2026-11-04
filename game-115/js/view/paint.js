// Small canvas helpers shared by the sprite painters. Everything in this game is drawn in code.

import { hash3 } from '../rng.js';

export const INK = '#3a2418';                  // the dark brown every outline uses
export const PX = 72;                          // pixels per tile for painted buildings and scenery

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}
export function ctx2(c) { return c.getContext('2d'); }

export const rnd = (seed) => { let n = 0; return () => hash3(seed, ++n, 91); };

/** Mix two hex colours. */
export function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t), g = Math.round(pa[1] + (pb[1] - pa[1]) * t), bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${bl})`;
}
export function hex(c) {
    if (Array.isArray(c)) return c;
    if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number);
    const h = c.replace('#', '');
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
/** rgba() string from any colour and an alpha. */
export function alpha(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#1a0f08', t);

export function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
}
export function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
}

export function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
/** Fill (and optionally outline) a rounded rect. */
export function box(ctx, x, y, w, h, fill, r = 2, line = INK, lw = 2) {
    rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}
export function poly(ctx, pts, fill, line = INK, lw = 2) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function circle(ctx, x, y, r, fill, line = null, lw = 2) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}
export function ellipse(ctx, x, y, rx, ry, fill, line = null, lw = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}
export function line(ctx, x0, y0, x1, y1, color, lw = 2, cap = 'round') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = cap; ctx.stroke();
}
/** A soft contact shadow baked under a sprite. */
export function softShadow(ctx, cx, cy, rx, ry, a = 0.28) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    ctx.fillStyle = rad(ctx, 0, 0, 0, rx, [[0, `rgba(30,18,8,${a})`], [0.6, `rgba(30,18,8,${a * 0.7})`], [1, 'rgba(30,18,8,0)']]);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}
/** Add a glow blob to an emissive layer. */
export function glow(ec, x, y, r, color, a = 1) {
    ec.save();
    ec.globalCompositeOperation = 'lighter';
    ec.fillStyle = rad(ec, x, y, 0, r, [[0, color.replace(')', `,${a})`).replace('rgb', 'rgba')], [1, color.replace(')', ',0)').replace('rgb', 'rgba')]]);
    ec.beginPath(); ec.arc(x, y, r, 0, Math.PI * 2); ec.fill();
    ec.restore();
}

/** Texture upload settings that work for a painted sprite. */
export function finish(c) { return c; }
