// ============================================================
// Pixel-painting primitives shared by every sprite painter.
// A Pix is a small RGBA buffer you paint into with hex or [r,g,b]
// colours; toCanvas() turns it into a cached canvas.
// ============================================================

export function makeCanvas(w, h) {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return { width: w, height: h, getContext: () => null };   // Node: never drawn
}

export function hsl(h, s, l, a = 1) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), Math.round(a * 255)];
}
export function hex(s) {
    s = s.replace('#', '');
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), 255];
}
const col = c => (typeof c === 'string' ? hex(c) : c.length === 3 ? [...c, 255] : c);
export const css = c => { const [r, g, b, a = 255] = col(c); return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`; };
export function shade(c, k) { const [r, g, b, a] = col(c); const f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return [f(r), f(g), f(b), a]; }
/** Four-step ramp from a hue: [dark, mid, light, highlight] */
export const ramp = (h, s = 0.55, l = 0.5) => [hsl(h, s, l - 0.22), hsl(h, s, l), hsl(h, s * 0.95, l + 0.14), hsl(h, s * 0.8, l + 0.27)];

export class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, c) {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
        const [r, g, b, a = 255] = col(c);
        const i = (y * this.w + x) * 4;
        if (a >= 255) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255; return; }
        const t = a / 255, da = this.d[i + 3] / 255;
        const oa = t + da * (1 - t);
        if (oa <= 0) return;
        this.d[i] = (r * t + this.d[i] * da * (1 - t)) / oa; this.d[i + 1] = (g * t + this.d[i + 1] * da * (1 - t)) / oa;
        this.d[i + 2] = (b * t + this.d[i + 2] * da * (1 - t)) / oa; this.d[i + 3] = oa * 255;
    }
    get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; }
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx + dy;
        for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    circle(cx, cy, r, c, shadeFn) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r * r) this.set(x, y, shadeFn ? shadeFn(dx / r, dy / r) : c);
        }
    }
    ellipse(cx, cy, rx, ry, c, shadeFn) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) this.set(x, y, shadeFn ? shadeFn(dx, dy) : c);
        }
    }
    /** 1px outline around every opaque pixel. */
    outline(c = [30, 22, 34, 255], diag = false) {
        const w = this.w, h = this.h, a = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) a[i] = this.d[i * 4 + 3] > 40 ? 1 : 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (a[y * w + x]) continue;
            let n = (x > 0 && a[y * w + x - 1]) || (x < w - 1 && a[y * w + x + 1]) || (y > 0 && a[(y - 1) * w + x]) || (y < h - 1 && a[(y + 1) * w + x]);
            if (!n && diag) n = (x > 0 && y > 0 && a[(y - 1) * w + x - 1]) || (x < w - 1 && y > 0 && a[(y - 1) * w + x + 1]) || (x > 0 && y < h - 1 && a[(y + 1) * w + x - 1]) || (x < w - 1 && y < h - 1 && a[(y + 1) * w + x + 1]);
            if (n) this.set(x, y, c);
        }
        return this;
    }
    mirrorX() { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w >> 1; x++) { const a = (y * this.w + x) * 4, b = (y * this.w + this.w - 1 - x) * 4; for (let k = 0; k < 4; k++) this.d[b + k] = this.d[a + k]; } return this; }
    flipped() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const a = (y * this.w + x) * 4, b = (y * this.w + this.w - 1 - x) * 4; for (let k = 0; k < 4; k++) p.d[b + k] = this.d[a + k]; } return p; }
    toCanvas() {
        const c = makeCanvas(this.w, this.h);
        const g = c.getContext && c.getContext('2d');
        if (g) { const im = g.createImageData(this.w, this.h); im.data.set(this.d); g.putImageData(im, 0, 0); }
        return c;
    }
}

/** Deterministic small hash for per-pixel texture noise. */
export function h2(a, b, c = 0) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const OUTLINE = [34, 24, 38, 255];
