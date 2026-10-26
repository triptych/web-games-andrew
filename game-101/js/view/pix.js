// A tiny pixel canvas: everything PixelCrypt draws (sprites, textures, icons) is made with EGA colour
// indices on small canvases, so the art is code and the palette is exact.

import { EGA } from '../config.js';
import { makeRng } from '../rng.js';

export class Pix {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.canvas = document.createElement('canvas');
        this.canvas.width = w; this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    }
    px(x, y, c) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        this.ctx.fillStyle = EGA[c];
        this.ctx.fillRect(x, y, 1, 1);
    }
    rect(x, y, w, h, c) { this.ctx.fillStyle = EGA[c]; this.ctx.fillRect(Math.round(x), Math.round(y), w, h); }
    /** A filled ellipse, pixel-exact. */
    ell(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x - cx) / rx, dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) this.px(x, y, c);
        }
    }
    line(x0, y0, x1, y1, c) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.px(x0, y0, c);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    /** A filled polygon (even-odd scanline). */
    poly(pts, c) {
        let minY = Infinity, maxY = -Infinity;
        for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const xs = [];
            for (let i = 0; i < pts.length; i++) {
                const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
                if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
            }
            xs.sort((a, b) => a - b);
            for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.px(x, y, c);
        }
    }
    /** Mirror the left half onto the right (for symmetrical creatures). */
    mirror() {
        const d = this.ctx.getImageData(0, 0, this.w, this.h);
        const half = this.w >> 1;
        const o = this.ctx.createImageData(this.w, this.h);
        o.data.set(d.data);
        for (let y = 0; y < this.h; y++) for (let x = 0; x < half; x++) {
            const a = (y * this.w + x) * 4, b = (y * this.w + (this.w - 1 - x)) * 4;
            if (d.data[a + 3]) for (let k = 0; k < 4; k++) o.data[b + k] = d.data[a + k];
        }
        this.ctx.putImageData(o, 0, 0);
    }
    /** Hard-edged text (no antialiasing, so every pixel is an EGA colour). */
    text(str, x, y, c, size = 9, bold = true) {
        const t = document.createElement('canvas');
        t.width = this.w; t.height = this.h;
        const g = t.getContext('2d');
        g.font = `${bold ? 'bold ' : ''}${size}px "Courier New", monospace`;
        g.textBaseline = 'top';
        g.fillStyle = '#fff';
        g.fillText(str, x, y);
        const d = g.getImageData(0, 0, this.w, this.h).data;
        this.ctx.fillStyle = EGA[c];
        for (let i = 0; i < this.w * this.h; i++) if (d[i * 4 + 3] > 120) this.ctx.fillRect(i % this.w, (i / this.w) | 0, 1, 1);
    }
    /** Black outline around every opaque pixel. */
    outline(c = 0) {
        const d = this.ctx.getImageData(0, 0, this.w, this.h);
        const A = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : d.data[(y * this.w + x) * 4 + 3]);
        const rgb = EGA[c];
        this.ctx.fillStyle = rgb;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            if (A(x, y)) continue;
            if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) this.ctx.fillRect(x, y, 1, 1);
        }
    }
    /** Dither-shade: draw colour c over pixels where (x+y) is even, inside a mask of opaque pixels. */
    shadeBottom(c, from) {
        const d = this.ctx.getImageData(0, 0, this.w, this.h);
        this.ctx.fillStyle = EGA[c];
        for (let y = from; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            if (d.data[(y * this.w + x) * 4 + 3] && ((x + y) & 1) === 0) this.ctx.fillRect(x, y, 1, 1);
        }
    }
}

export const rngFor = (seed) => makeRng(seed >>> 0);
export const cache = new Map();
export function memo(key, fn) {
    let v = cache.get(key);
    if (!v) { v = fn(); cache.set(key, v); }
    return v;
}
