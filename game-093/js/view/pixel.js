// A tiny pixel-art painter. Shapes are drawn into a mask and then painted with automatic light and shade, so every part gets
// a highlight on its top-left edge and a shadow on its bottom-right: the quick way to the look of hand-drawn sprites.

export const hex = (c) => {
    if (Array.isArray(c)) return c;
    if (typeof c === 'number') return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    const s = c.replace('#', '');
    const v = s.length === 3 ? s.split('').map((x) => x + x).join('') : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
const rgbOf = (c) => (Array.isArray(c) ? c : hex(c));
export const toCss = (c) => { const [r, g, b] = rgbOf(c); return `rgb(${r},${g},${b})`; };
export const shade = (c, t) => (t >= 0 ? mix(rgbOf(c).length ? toHex(c) : c, '#ffffff', t) : mix(toHex(c), '#000000', -t));
const toHex = (c) => { if (typeof c === 'string') return c; const [r, g, b] = rgbOf(c); return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''); };

export class Px {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.d = new Uint8ClampedArray(w * h * 4);
        this.m = new Uint8Array(w * h);
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c, a = 255) {
        x |= 0; y |= 0; if (!this.inb(x, y)) return;
        const [r, g, b] = rgbOf(c); const i = (y * this.w + x) * 4;
        this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = a;
    }
    get(x, y) { if (!this.inb(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2]] : null; }
    // ---- mask shapes
    mp(x, y) { x |= 0; y |= 0; if (this.inb(x, y)) this.m[y * this.w + x] = 1; return this; }
    mrect(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.mp(x + i, y + j); return this; }
    mell(cx, cy, rx, ry) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) this.mp(x, y);
        }
        return this;
    }
    mline(x0, y0, x1, y1, t = 1) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) {
            const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
            for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.mp(x + a - (t >> 1), y + b - (t >> 1));
        }
        return this;
    }
    mpoly(pts) {
        let minY = 1e9, maxY = -1e9;
        for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const xs = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                const yy = y + 0.5;
                if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.mp(x, y);
        }
        return this;
    }
    msub(fn) { // remove an area from the mask
        const save = this.m; this.m = new Uint8Array(this.w * this.h); fn(this); const cut = this.m; this.m = save;
        for (let i = 0; i < cut.length; i++) if (cut[i]) this.m[i] = 0;
        return this;
    }
    mclear() { this.m.fill(0); return this; }
    // ---- painting
    paint(base, o = {}) {
        const b = toHex(base);
        const light = o.light || mix(b, '#ffffff', o.hi ?? 0.28), dark = o.dark || mix(b, '#000000', o.lo ?? 0.32);
        const { w, h, m } = this;
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!m[y * w + x]) continue;
            let c = rgbOf(b);
            if (!o.flat) {
                const top = !at(x, y - 1), left = !at(x - 1, y), bot = !at(x, y + 1), right = !at(x + 1, y);
                if ((top && !bot) || (left && !right && !(bot))) c = light;
                if ((bot && !top) || (right && !left && !top)) c = dark;
                if (top && bot) c = b;
            }
            this.set(x, y, c);
        }
        this.m.fill(0);
        return this;
    }
    fill(c) { this.paint(c, { flat: true }); return this; }
    // ---- finishing
    outline(col = '#1a1420', strength = 0.8) {
        const { w, h, d } = this, src = new Uint8ClampedArray(d);
        const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (A(x, y)) continue;
            let n = null;
            for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (A(x + dx, y + dy)) { const i = ((y + dy) * w + x + dx) * 4; n = [src[i], src[i + 1], src[i + 2]]; break; }
            if (!n) continue;
            const [oc0, oc1, oc2] = hex(col);
            this.set(x, y, [Math.round(oc0 * strength + n[0] * 0.18 * (1 - strength) + n[0] * 0.08), Math.round(oc1 * strength + n[1] * 0.12), Math.round(oc2 * strength + n[2] * 0.12)]);
        }
        return this;
    }
    /** Flip horizontally in place. */
    flipX() {
        const { w, h, d } = this;
        for (let y = 0; y < h; y++) for (let x = 0; x < w >> 1; x++) for (let k = 0; k < 4; k++) { const a = (y * w + x) * 4 + k, b = (y * w + (w - 1 - x)) * 4 + k; const t = d[a]; d[a] = d[b]; d[b] = t; }
        return this;
    }
    blit(src, ox, oy) {
        for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
            const i = (y * src.w + x) * 4;
            if (!src.d[i + 3]) continue;
            this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2]], src.d[i + 3]);
        }
        return this;
    }
    toCanvas() {
        const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
        const ctx = c.getContext('2d');
        ctx.putImageData(new ImageData(new Uint8ClampedArray(this.d), this.w, this.h), 0, 0);
        return c;
    }
}
