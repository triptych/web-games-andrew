// Painterly canvas helpers shared by every sprite in the game. Everything is drawn in code, at high
// resolution, with smooth bezier outlines and dry-brush strokes laid over each shape, so nothing is pixelated.

import { hash3 } from '../rng.js';

export const INK = '#3b2417';                    // the warm dark brown every outline uses

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}
export const ctx2 = (c) => c.getContext('2d');
export const rnd = (seed) => { let n = 0; return () => hash3(seed | 0, ++n, 91); };

// ------------------------------------------------------------ colour
export function hex(c) {
    if (Array.isArray(c)) return c;
    if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const h = c.replace('#', '');
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
export function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}
export const lighten = (c, t) => mix(c, '#fff4dc', t);
export const darken = (c, t) => mix(c, '#2a1424', t);
export const alpha = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
export const warm = (c, t) => mix(c, '#ffb070', t);
export const cool = (c, t) => mix(c, '#6a7ad0', t);

// ------------------------------------------------------------ path constructors: { draw(ctx), bb: [x, y, w, h] }
export const P = {
    ellipse: (cx, cy, rx, ry, rot = 0) => ({ bb: [cx - rx, cy - ry, rx * 2, ry * 2], draw: (c) => { c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); } }),
    rrect: (x, y, w, h, r) => ({ bb: [x, y, w, h], draw: (c) => { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); } }),
    poly: (pts) => {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        return { bb: [x, y, Math.max(...xs) - x, Math.max(...ys) - y], draw: (c) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); } };
    },
    /** A smooth closed blob through points (Catmull-Rom to bezier). */
    smooth: (pts, tension = 0.5) => {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        return {
            bb: [x, y, Math.max(...xs) - x, Math.max(...ys) - y],
            draw: (c) => {
                const n = pts.length;
                c.beginPath();
                c.moveTo(pts[0][0], pts[0][1]);
                for (let i = 0; i < n; i++) {
                    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
                    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * tension / 3 * 2, p1[1] + (p2[1] - p0[1]) * tension / 3 * 2, p2[0] - (p3[0] - p1[0]) * tension / 3 * 2, p2[1] - (p3[1] - p1[1]) * tension / 3 * 2, p2[0], p2[1]);
                }
                c.closePath();
            },
        };
    },
    /** Capsule from (x1,y1) to (x2,y2) with radius r. */
    capsule: (x1, y1, x2, y2, r) => {
        const a = Math.atan2(y2 - y1, x2 - x1);
        return { bb: [Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.abs(x2 - x1) + r * 2, Math.abs(y2 - y1) + r * 2], draw: (c) => { c.beginPath(); c.arc(x1, y1, r, a + Math.PI / 2, a + Math.PI * 1.5); c.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2); c.closePath(); } };
    },
    /** Free-form: pass a function that builds the path and the bounding box. */
    custom: (bb, draw) => ({ bb, draw }),
};

/** Dry-brush strokes inside a bounding box (call with a clip already set). */
export function brush(c, bb, color, amount = 1, seed = 1) {
    const [x, y, w, h] = bb;
    const r = rnd(seed * 7 + 3);
    const n = Math.min(900, Math.round((w * h) / 130 * amount));
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h;
        const len = 8 + r() * 26, ang = -0.85 + (r() - 0.5) * 0.7;
        const tone = r();
        c.strokeStyle = tone < 0.5 ? alpha(lighten(color, 0.18 + r() * 0.25), 0.07 + r() * 0.09) : alpha(darken(color, 0.12 + r() * 0.22), 0.06 + r() * 0.08);
        c.lineWidth = 2 + r() * 5;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
        c.stroke();
    }
}

/**
 * Paint a shape: flat fill, a soft light-to-shadow wash, dry-brush texture, inner edge shading, then a smooth outline.
 * o = { tex: brush amount (0 = none), shade: wash strength, line: false | width, ink, seed, light: 'tl'|'t'|'l' }
 */
export function paint(c, shape, fill, o = {}) {
    const lw = o.line === false ? 0 : (o.line ?? 4);
    const col = typeof fill === 'string' ? fill : o.base || '#999999';
    c.save();
    shape.draw(c);
    c.fillStyle = fill;
    c.fill();
    c.save();
    shape.draw(c);
    c.clip();
    const [x, y, w, h] = shape.bb;
    const sh = o.shade ?? 0.28;
    if (sh > 0) {
        const g = c.createLinearGradient(x, y, x + w * 0.7, y + h);
        g.addColorStop(0, alpha('#fff2d0', sh * 0.75));
        g.addColorStop(0.45, 'rgba(255,255,255,0)');
        g.addColorStop(1, alpha('#2a1030', sh));
        c.fillStyle = g;
        c.fillRect(x - 2, y - 2, w + 4, h + 4);
    }
    if ((o.tex ?? 1) > 0) brush(c, shape.bb, col, o.tex ?? 1, o.seed ?? 1);
    if (lw) {
        shape.draw(c);
        c.lineWidth = lw * 3.2;
        c.strokeStyle = alpha(darken(col, 0.55), 0.16);
        c.lineJoin = 'round';
        c.stroke();
    }
    c.restore();
    if (lw) {
        shape.draw(c);
        c.lineWidth = lw;
        c.strokeStyle = o.ink || INK;
        c.lineJoin = 'round'; c.lineCap = 'round';
        c.stroke();
    }
    c.restore();
}
/** Shorthand: paint a shape at the given place. */
export const ink = (c, w = 4, col = INK) => { c.lineWidth = w; c.strokeStyle = col; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };

export function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
}
export function rad(c, x, y, r0, r1, stops) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
}
export function softShadow(c, cx, cy, rx, ry, a = 0.32) {
    c.save();
    c.translate(cx, cy); c.scale(1, ry / rx);
    c.fillStyle = rad(c, 0, 0, 0, rx, [[0, `rgba(40,20,30,${a})`], [0.55, `rgba(40,20,30,${a * 0.65})`], [1, 'rgba(40,20,30,0)']]);
    c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
    c.restore();
}
export function glow(c, x, y, r, color, a = 1) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y, 0, r, [[0, alpha(color, a)], [0.4, alpha(color, a * 0.45)], [1, alpha(color, 0)]]);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.restore();
}
export function stroke(c, pts, color, lw = 3) {
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
export function line(c, x0, y0, x1, y1, color, lw = 3) { stroke(c, [[x0, y0], [x1, y1]], color, lw); }
export function curve(c, x0, y0, cx, cy, x1, y1, color, lw = 3) {
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1);
    c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
}
/** A glossy highlight dab. */
export function dab(c, x, y, rx, ry, a = 0.85, rot = -0.5) {
    c.save();
    c.fillStyle = `rgba(255,250,235,${a})`;
    c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill();
    c.restore();
}

const memo = new Map();
/** Paint something once per key (sprites are expensive to draw, cheap to reuse). */
export const cached = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };
