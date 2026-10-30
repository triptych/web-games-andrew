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

// Shadows drift toward a cool violet and lights toward a warm cream: the hue shift that keeps shading from looking muddy.
export const SHADOW_HUE = [44, 26, 78], LIGHT_HUE = [255, 246, 214];
const lum = (c) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
/** A five-step ramp, darkest first, with the given colour in the middle. */
export function ramp(base, hi = 1, lo = 1, light, dark) {
    const b = hex(base), L = lum(b);
    // dark colours need more lift to show a highlight; pale colours need deeper shadows to show form
    const up = (0.2 + (1 - L) * 0.12) * hi, down = (0.26 + L * 0.14) * lo;
    // multiply the colour by itself to darken it: shadows get deeper and richer instead of grey, then lean a little violet
    const sq = b.map((v) => (v * v) / 255);
    const sh = (t) => mix(mix(mix(b, sq, Math.min(1, t * 2.4)), SHADOW_HUE, t * 0.45), '#000000', t * 0.22);
    const li = (t) => mix(b, LIGHT_HUE, t);
    return [dark ? hex(dark) : sh(down * 1.9), sh(down), b, li(up), light ? hex(light) : li(Math.min(0.85, up * 2.1))];
}

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
    /**
     * Paint the mask. Shading is volumetric: every pixel is lit by how far it sits from the shape's top-left edges against its
     * bottom-right ones, then banded into a five-step hue-shifted ramp (shadows cool, highlights warm). Where the new shape lies
     * over a different, earlier one, the pixels around it get a soft contact line, so overlapping parts read apart without an
     * outline pass. o: flat, hi/lo (ramp strength), tex(x, y) -> ramp offset (fur, scales, folds), noline, soft (no highlight band).
     */
    paint(base, o = {}) {
        const b = toHex(base);
        const { w, h, m } = this;
        if (!this.g) { this.g = new Int32Array(w * h).fill(-1); this.ln = new Uint8Array(w * h); }
        const gid = parseInt(b.slice(1), 16) | 0;
        if (o.flat) {
            const c = rgbOf(b);
            for (let i = 0; i < w * h; i++) if (m[i]) { this.set(i % w, (i / w) | 0, c); this.g[i] = gid; this.ln[i] = 0; }
            m.fill(0); return this;
        }
        const R = ramp(b, o.hi ?? 1, o.lo ?? 1, o.light, o.dark);
        // run lengths to the edge in four directions
        const up = new Uint8Array(w * h), dn = new Uint8Array(w * h), lf = new Uint8Array(w * h), rt = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!m[i]) continue; up[i] = y && m[i - w] ? Math.min(up[i - w] + 1, 250) : 0; lf[i] = x && m[i - 1] ? Math.min(lf[i - 1] + 1, 250) : 0; }
        for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!m[i]) continue; dn[i] = y < h - 1 && m[i + w] ? Math.min(dn[i + w] + 1, 250) : 0; rt[i] = x < w - 1 && m[i + 1] ? Math.min(rt[i + 1] + 1, 250) : 0; }
        const old = this.d.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (!m[i]) continue;
            const tv = (up[i] + 0.5) / (up[i] + dn[i] + 1), th = (lf[i] + 0.5) / (lf[i] + rt[i] + 1);
            let s = 1 - (0.68 * tv + 0.32 * th);
            // a rounded core: pixels deep inside lean toward the base tone, the rims carry the extremes
            const core = Math.min(up[i], dn[i], lf[i], rt[i]);
            if (core >= 2) s = 0.5 + (s - 0.5) * 0.86;
            let k = s > 0.84 ? 4 : s > 0.64 ? 3 : s > 0.3 ? 2 : s > 0.12 ? 1 : 0;
            if (k === 4 && (o.soft || (up[i] > 1 && lf[i] > 1))) k = 3;      // the brightest band stays a rim
            if (o.tex) k += o.tex(x, y) | 0;
            k = Math.max(0, Math.min(4, k));
            this.set(x, y, R[k]); this.g[i] = gid; this.ln[i] = 0;
        }
        // contact lines on the earlier, different parts around the new shape
        if (!o.noline) {
            const dirs = [[0, -1, 0.2], [-1, 0, 0.2], [1, 0, 0.34], [0, 1, 0.38]];
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (m[i] || !old[i * 4 + 3] || this.g[i] === gid || this.ln[i]) continue;
                let amt = 0;
                for (const [dx, dy, a] of dirs) { const xx = x - dx, yy = y - dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) amt = Math.max(amt, a); }
                if (!amt) continue;
                const c = [old[i * 4], old[i * 4 + 1], old[i * 4 + 2]];
                this.set(x, y, mix(mix(c, SHADOW_HUE, 0.35), '#000000', amt)); this.ln[i] = 1;
            }
        }
        m.fill(0);
        return this;
    }
    fill(c) { this.paint(c, { flat: true }); return this; }
    /** Recolour already-painted pixels inside the mask with fn(rgb, x, y) -> rgb. For glints, rim light and stains. */
    tint(fn) {
        const { w, h, m } = this;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!m[y * w + x]) continue; const c = this.get(x, y); if (c) this.set(x, y, fn(c, x, y)); }
        m.fill(0); return this;
    }
    // ---- finishing
    /**
     * A selective outline: each outline pixel is a deep, hue-shifted shade of the sprite pixel it touches, a little lighter
     * where the light falls (top, left) and darkest underneath, so the silhouette reads without a flat black line.
     */
    outline(col = '#1a1420', strength = 0.8) {
        const { w, h, d } = this, src = new Uint8ClampedArray(d);
        const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
        const oc = hex(col);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (A(x, y)) continue;
            let n = null, lit = 0;
            // the neighbour below means this pixel is above the sprite: on the lit side
            for (const [dx, dy, l] of [[0, 1, 1], [1, 0, 1], [-1, 0, 0], [0, -1, 0]]) if (A(x + dx, y + dy)) { const i = ((y + dy) * w + x + dx) * 4; n = [src[i], src[i + 1], src[i + 2]]; lit = l; break; }
            if (!n) continue;
            const keep = lit ? 0.3 : 0.16;
            const t = mix(mix(n, SHADOW_HUE, 0.5), oc, strength);
            this.set(x, y, mix(t, n, keep * (1 - strength * 0.4)));
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
