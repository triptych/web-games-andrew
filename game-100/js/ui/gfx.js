// Drawing helpers for the UI canvas: pixel text with a shadow or an outline, neon panels,
// rainbow stripes, the wavy 70s logo, little pixel icons for the six tokens and the specials.
// Everything is integer-aligned, because the canvas is tiny and gets scaled up by the tube.

import { drawRaw, textWidth, CW, CH } from './font.js';
import { KINDS } from '../config.js';

export const PAL = {
    white: '#ffffff', cream: '#fff2d0', black: '#000000', ink: '#0b0618', panel: '#160a2c', panel2: '#241044',
    orange: '#ff8a1f', yellow: '#ffd21f', magenta: '#ff2fa8', purple: '#9b5cff', cyan: '#2de2ff', lime: '#9dff3a',
    red: '#ff3355', dim: '#8a78b8', gold: '#ffc92a',
};
export const RAINBOW = [PAL.magenta, PAL.orange, PAL.yellow, PAL.lime, PAL.cyan, PAL.purple];
export const STRIPES = [PAL.yellow, PAL.orange, PAL.red, PAL.magenta];

export const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export class Gfx {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.icons = new Map();
    }

    get w() { return this.canvas.width; }
    get h() { return this.canvas.height; }

    clear() { this.ctx.clearRect(0, 0, this.w, this.h); this.ctx.globalAlpha = 1; }
    rect(x, y, w, h, color) { const c = this.ctx; c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    alpha(a) { this.ctx.globalAlpha = a; }

    /** Text. opts: align left|center|right, scale, shadow (colour), outline (colour). Returns the width. */
    text(str, x, y, color = PAL.white, opts = {}) {
        str = String(str).toUpperCase();
        const s = opts.scale || 1;
        const w = textWidth(str, s);
        if (opts.align === 'center') x -= w / 2; else if (opts.align === 'right') x -= w;
        x = Math.round(x); y = Math.round(y);
        const c = this.ctx;
        if (opts.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) drawRaw(c, str, x + dx * s, y + dy * s, opts.outline, s);
        if (opts.shadow) drawRaw(c, str, x + s, y + s, opts.shadow, s);
        if (Array.isArray(color)) { for (let i = 0; i < str.length; i++) drawRaw(c, str[i], x + i * CW * s, y, color[i % color.length], s); }
        else drawRaw(c, str, x, y, color, s);
        return w;
    }
    width(str, scale = 1) { return textWidth(String(str), scale); }

    /** A neon-edged panel: a dark fill, a one-pixel border in `color`, a notch of highlight. */
    panel(x, y, w, h, color = PAL.magenta, fill = 'rgba(14,6,30,0.82)') {
        x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        const c = this.ctx;
        c.fillStyle = fill; c.fillRect(x, y, w, h);
        c.fillStyle = color;
        c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
        c.fillStyle = 'rgba(255,255,255,0.14)';
        c.fillRect(x + 1, y + 1, w - 2, 1);
        // cut the corners
        c.clearRect(x, y, 1, 1); c.clearRect(x + w - 1, y, 1, 1); c.clearRect(x, y + h - 1, 1, 1); c.clearRect(x + w - 1, y + h - 1, 1, 1);
    }

    /** Four 70s stripes, side by side (horizontal band) at a pixel thickness each. */
    stripes(x, y, w, t = 1, colors = STRIPES, vertical = false) {
        colors.forEach((col, i) => { if (vertical) this.rect(x + i * t, y, t, w, col); else this.rect(x, y + i * t, w, t, col); });
    }

    bar(x, y, w, h, frac, color, back = 'rgba(255,255,255,0.12)') {
        this.rect(x, y, w, h, back);
        this.rect(x, y, Math.max(0, Math.min(w, Math.round(w * frac))), h, color);
    }

    /** A segmented groove meter: cold lime to hot magenta. */
    segs(x, y, w, h, frac, count, vertical = false, flash = false) {
        const gap = 1;
        const cell = vertical ? Math.floor((h - gap * (count - 1)) / count) : Math.floor((w - gap * (count - 1)) / count);
        const on = Math.round(frac * count);
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const col = t < 0.4 ? PAL.lime : t < 0.65 ? PAL.yellow : t < 0.85 ? PAL.orange : PAL.magenta;
            const lit = i < on;
            const px = vertical ? x : x + i * (cell + gap);
            const py = vertical ? y + h - (i + 1) * cell - i * gap : y;
            this.rect(px, py, vertical ? w : cell, vertical ? cell : h, lit ? (flash ? PAL.white : col) : 'rgba(255,255,255,0.1)');
        }
    }

    /** Letters that bob on a sine and cycle through the rainbow: the 70s title look. */
    wavy(str, cx, y, scale, t, { amp = 2, speed = 3, colors = RAINBOW, shadow = PAL.ink, step = 0.5, calm = false } = {}) {
        str = String(str).toUpperCase();
        const w = textWidth(str, scale);
        let x = Math.round(cx - w / 2);
        for (let i = 0; i < str.length; i++) {
            const dy = Math.round(Math.sin(t * speed + i * step) * (calm ? amp * 0.4 : amp));
            const col = colors[(i + (calm ? 0 : Math.floor(t * 2))) % colors.length];      // two colour steps a second at most, none in calm mode
            if (str[i] !== ' ') {
                // a stepped, extruded shadow gives the chunky 3D lettering
                for (let k = 3; k >= 1; k--) drawRaw(this.ctx, str[i], x + k, y + dy + k, k > 1 ? PAL.ink : '#3a1860', scale);
                drawRaw(this.ctx, str[i], x, y + dy, col, scale);
                drawRaw(this.ctx, str[i], x - 0, y + dy - 0, col, scale);
            }
            x += CW * scale;
        }
        void shadow;
        return w;
    }

    /** A four-point sparkle. */
    sparkle(x, y, r, color = PAL.white) {
        x = Math.round(x); y = Math.round(y);
        this.rect(x, y, 1, 1, color);
        for (let i = 1; i <= r; i++) { this.rect(x - i, y, 1, 1, color); this.rect(x + i, y, 1, 1, color); this.rect(x, y - i, 1, 1, color); this.rect(x, y + i, 1, 1, color); }
    }

    /** A pixel icon (cached): kind 0-5, or 'beamh' | 'beamv' | 'bomb' | 'mirror'. Drawn centred. */
    icon(kind, cx, cy, size = 12) {
        const key = kind + ':' + size;
        let img = this.icons.get(key);
        if (!img) { img = drawIcon(kind, size); this.icons.set(key, img); }
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(img, Math.round(cx - size / 2), Math.round(cy - size / 2));
    }
}

function drawIcon(kind, S) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const m = (S - 1) / 2;
    const each = (fn) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fn(x, y, (x - m) / (S / 2), (y - m) / (S / 2)); };
    const hex = (i) => KINDS[i].css;
    if (kind === 0) {
        each((x, y, u, v) => { const d = Math.hypot(u, v); if (d <= 1) px(x, y, d > 0.86 ? hex(0) : d < 0.14 ? '#fff' : d < 0.42 ? hex(0) : (d > 0.62 && d < 0.68 ? '#3a2d52' : '#1a1228')); });
    } else if (kind === 1) {
        each((x, y, u, v) => { const d = Math.hypot(u, v); if (d <= 1) px(x, y, (((x >> 1) + (y >> 1)) & 1) ? '#c8fbff' : hex(1)); });
        px(Math.round(m), 0, '#ddd');
    } else if (kind === 2) {
        const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.42 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        each((x, y, u, v) => {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > v) !== (pts[j][1] > v) && u < ((pts[j][0] - pts[i][0]) * (v - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0]) inside = !inside;
            if (inside) px(x, y, (u + v < -0.2) ? '#fff1a8' : hex(2));
        });
    } else if (kind === 3) {
        each((x, y, u, v) => { const X = u * 1.15, Y = -v * 1.2 + 0.1; const f = (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3; if (f <= 0) px(x, y, (X < -0.15 && Y > 0.25) ? '#ffd0a0' : hex(3)); });
    } else if (kind === 4) {
        each((x, y, u, v) => {
            const d = Math.hypot(u, v);
            if (d < 0.3) { px(x, y, '#ffd24a'); return; }
            const a = Math.atan2(v, u), pet = Math.cos(a * 4);
            if (d <= 0.55 + 0.45 * Math.max(0, pet) * 0.9 + 0.1) px(x, y, hex(4));
        });
    } else if (kind === 5) {
        each((x, y, u, v) => { if (Math.abs(u) / 0.85 + Math.abs(v) / 1.0 <= 1) px(x, y, (v < -0.1 && u < 0.2) ? '#d9bfff' : (u > 0.2 && v > 0.1) ? '#6a35c8' : hex(5)); });
    } else if (kind === 'mirror') {
        each((x, y, u, v) => { const d = Math.hypot(u, v); if (d <= 1) { const k = (((x >> 1) + (y >> 1)) & 3); px(x, y, ['#ff2fa8', '#ffd21f', '#2de2ff', '#9dff3a'][k]); } });
    } else if (kind === 'bomb') {
        each((x, y, u, v) => { const d = Math.hypot(u, v); if (d <= 0.62) px(x, y, '#ff8a1f'); else if (d <= 1 && ((Math.round(Math.atan2(v, u) / (Math.PI / 4)) & 1) === 0 || d < 0.78)) px(x, y, '#fff'); });
    } else if (kind === 'beamh' || kind === 'beamv') {
        const h = kind === 'beamh';
        each((x, y, u, v) => {
            const a = h ? u : v, b = h ? v : u;
            if (Math.abs(b) < 0.13) px(x, y, '#fff');
            else if (Math.abs(a) > 0.45 && Math.abs(b) < (Math.abs(a) - 0.4) * 1.1 + 0.1 && Math.abs(a) <= 1) px(x, y, '#fff');
        });
    }
    return c;
}

export { CW, CH, textWidth };
