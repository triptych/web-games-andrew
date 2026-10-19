/**
 * pixelart.js — a tiny pixel-art drawing language.
 *
 * Every mosaic is drawn in code on a grid of palette keys, sampled at pixel centres, so the
 * same definition gives the colouring numbers, the thumbnails and the exported PNG.
 * Pure: no DOM, no clock, no Math.random (scatter takes a seed).
 *
 *   defineArt({ id, w, h, colors: { n: ['#1d2150', 'Midnight'], ... }, draw(P) { P.fill('n'); ... } })
 *
 * The order of `colors` is the order of the numbers (first key is number 1).
 */

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makePainter(w, h, colors) {
    const grid = new Array(w * h).fill(null);
    let mask = null;
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const check = (c) => {
        if (!(c in colors)) throw new Error(`unknown colour key "${c}"`);
    };
    const set = (c, x, y) => {
        x = Math.floor(x); y = Math.floor(y);
        if (!inb(x, y)) return;
        const i = y * w + x;
        if (mask && !mask[i]) return;
        grid[i] = c;
    };
    const each = (fn) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x, y, x + 0.5, y + 0.5);
    };
    const snapshot = () => grid.slice();
    const asSet = (keys) => new Set(Array.isArray(keys) ? keys : [...keys]);

    const P = {
        w, h, grid,
        get: (x, y) => (inb(x, y) ? grid[y * w + x] : undefined),
        fill(c) { check(c); each((x, y) => set(c, x, y)); return P; },
        rect(c, x0, y0, rw, rh) {
            check(c);
            for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) set(c, x, y);
            return P;
        },
        ellipse(c, cx, cy, rx, ry) {
            check(c);
            each((x, y, px, py) => {
                const dx = (px - cx) / rx, dy = (py - cy) / ry;
                if (dx * dx + dy * dy <= 1) set(c, x, y);
            });
            return P;
        },
        circle(c, cx, cy, r) { return P.ellipse(c, cx, cy, r, r); },
        /** A ring between radius r0 and r1 (optionally squashed vertically by sy). */
        ring(c, cx, cy, r0, r1, sy = 1) {
            check(c);
            each((x, y, px, py) => {
                const d = Math.hypot(px - cx, (py - cy) / sy);
                if (d >= r0 && d <= r1) set(c, x, y);
            });
            return P;
        },
        poly(c, pts) {
            check(c);
            each((x, y, px, py) => {
                let inside = false;
                for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                    const [xi, yi] = pts[i], [xj, yj] = pts[j];
                    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
                }
                if (inside) set(c, x, y);
            });
            return P;
        },
        line(c, x0, y0, x1, y1) {
            check(c);
            let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
            let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
            let err = dx + dy;
            for (;;) {
                set(c, x0, y0);
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
            return P;
        },
        dots(c, pts) { check(c); for (const [x, y] of pts) set(c, x, y); return P; },
        /** ASCII stamp: each character is a colour key; '.' and ' ' are left alone. */
        stamp(x0, y0, rows, map = {}) {
            rows.forEach((row, dy) => {
                [...row].forEach((ch, dx) => {
                    if (ch === '.' || ch === ' ') return;
                    const c = map[ch] ?? ch;
                    check(c);
                    set(c, x0 + dx, y0 + dy);
                });
            });
            return P;
        },
        /** Pixels that are not `keys` but touch one become `c` (a 1-pixel outline or halo). */
        outline(c, keys, diag = false) {
            check(c);
            const ks = asSet(keys), snap = snapshot();
            const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const n8 = [...n4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
            each((x, y) => {
                if (ks.has(snap[y * w + x])) return;
                for (const [dx, dy] of diag ? n8 : n4) {
                    const nx = x + dx, ny = y + dy;
                    if (inb(nx, ny) && ks.has(snap[ny * w + nx])) { set(c, x, y); return; }
                }
            });
            return P;
        },
        /** Pixels of `key` whose neighbour at (dx, dy) is something else become `c` (rim shading). */
        edge(c, key, dx, dy, depth = 1) {
            check(c);
            const snap = snapshot();
            each((x, y) => {
                if (snap[y * w + x] !== key) return;
                for (let d = 1; d <= depth; d++) {
                    const nx = x + dx * d, ny = y + dy * d;
                    if (inb(nx, ny) && snap[ny * w + nx] !== key) { set(c, x, y); return; }
                }
            });
            return P;
        },
        /** Copy the left half onto the right half. */
        mirror() {
            for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) grid[y * w + (w - 1 - x)] = grid[y * w + x];
            return P;
        },
        swap(from, to) { check(to); each((x, y) => { if (grid[y * w + x] === from) set(to, x, y); }); return P; },
        /** Draw only over pixels that are currently one of `keys`. */
        clip(keys, fn) {
            const ks = asSet(keys), prev = mask;
            mask = grid.map((g, i) => ks.has(g) && (!prev || prev[i]));
            fn(P);
            mask = prev;
            return P;
        },
        /** Draw only inside the rectangle x0,y0,w,h. */
        within(x0, y0, rw, rh, fn) {
            const prev = mask;
            mask = grid.map((g, i) => {
                const x = i % w, y = Math.floor(i / w);
                return x >= x0 && y >= y0 && x < x0 + rw && y < y0 + rh && (!prev || prev[i]);
            });
            fn(P);
            mask = prev;
            return P;
        },
        /** Scatter `n` single pixels of `c` over `on` keys, never touching each other. */
        scatter(c, n, seed, on) {
            check(c);
            const rnd = mulberry32(seed), ons = asSet(on);
            let placed = 0;
            for (let tries = 0; tries < n * 40 && placed < n; tries++) {
                const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
                let ok = ons.has(grid[y * w + x]);
                for (let dy = -1; ok && dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (P.get(x + dx, y + dy) === c) ok = false;
                if (ok) { set(c, x, y); placed++; }
            }
            return P;
        },
        /** A four-point twinkle: centre plus arms of `len`. */
        twinkle(c, x, y, len = 1) {
            check(c);
            set(c, x, y);
            for (let d = 1; d <= len; d++) { set(c, x + d, y); set(c, x - d, y); set(c, x, y + d); set(c, x, y - d); }
            return P;
        },
    };
    return P;
}

/**
 * Rasterise an art definition into { id, w, h, palette:[{key,hex,name}], cells:Uint8Array, counts }.
 * cells[i] is the 0-based palette index of pixel i (the number shown is index + 1).
 */
export function defineArt(def) {
    const { id, w, h, colors } = def;
    const P = makePainter(w, h, colors);
    def.draw(P);
    const keys = Object.keys(colors);
    const index = new Map(keys.map((k, i) => [k, i]));
    const cells = new Uint8Array(w * h);
    const counts = new Array(keys.length).fill(0);
    P.grid.forEach((k, i) => {
        if (k === null) throw new Error(`${id}: pixel ${i % w},${Math.floor(i / w)} was never drawn`);
        cells[i] = index.get(k);
        counts[index.get(k)]++;
    });
    const palette = keys.map((k) => ({ key: k, hex: colors[k][0], name: colors[k][1] }));
    return { ...def, draw: undefined, palette, cells, counts, total: w * h };
}

export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Perceived lightness 0..1. */
export function luma(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** "Redmean" colour distance, a cheap perceptual approximation (0..~765). */
export function colorDistance(a, b) {
    const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
    const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
