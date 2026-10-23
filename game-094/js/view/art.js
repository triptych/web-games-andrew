// The pictures. Each scene is a function from a point to a brightness, drawn once per scene into
// a 1-bit bitmap with an ordered dither, exactly the way a Hercules card would have shown it: a
// pixel is lit or it isn't. Pure maths, seeded by hash3, so a scene always looks the same.

import { hash3 } from '../rng.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sm = (t) => t * t * (3 - 2 * t);
const line = (d, w) => clamp(1 - Math.abs(d) / w);
const glow = (x, y, cx, cy, r) => { const k = clamp(1 - Math.hypot(x - cx, y - cy) / r); return k * k; };
const disc = (x, y, cx, cy, r) => clamp((r - Math.hypot(x - cx, y - cy)) / (r * 0.12));
const stars = (x, y, d = 0.994) => (hash3(Math.floor(x * 140), Math.floor(y * 140), 7) > d ? 1 : 0);

function vnoise(x, y, s = 0) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = sm(x - x0), fy = sm(y - y0);
    const a = hash3(x0, y0, s), b = hash3(x0 + 1, y0, s), c = hash3(x0, y0 + 1, s), d = hash3(x0 + 1, y0 + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2, y * 2, s + 1) * 0.3 + vnoise(x * 4, y * 4, s + 2) * 0.15;

// x runs 0..A (A is the aspect ratio), y runs 0..1 downward.
const SCENES = {
    // a double helix across the whole screen
    title(x, y, A) {
        let l = 0.05 + 0.1 * glow(x, y, A / 2, 0.5, 1.1) + stars(x, y, 0.996) * 0.7;
        const ph = x * 7.5;
        const s1 = 0.5 + 0.3 * Math.sin(ph), s2 = 0.5 - 0.3 * Math.sin(ph);
        const front = Math.cos(ph);
        l = Math.max(l, line(y - s1, 0.03 + 0.012 * front) * (front > 0 ? 1 : 0.6));
        l = Math.max(l, line(y - s2, 0.03 - 0.012 * front) * (front < 0 ? 1 : 0.6));
        const rung = line(((x * 7.5 / Math.PI) % 0.5) - 0.25, 0.035) * (y > Math.min(s1, s2) && y < Math.max(s1, s2) ? 0.85 : 0);
        return Math.max(l, rung);
    },
    // the ring of domes at dusk
    station(x, y, A) {
        const hor = 0.72;
        if (y >= hor) return 0.07 + 0.2 * fbm(x * 10, y * 12, 1) + 0.5 * line(y - hor, 0.012);
        let l = 0.06 + 0.45 * glow(x, y, A * 0.78, hor, 0.85) + stars(x, y) * 0.8;
        for (const [cx, r] of [[A * 0.28, 0.2], [A * 0.5, 0.28], [A * 0.72, 0.17]]) {
            const d = Math.hypot(x - cx, y - hor);
            if (d < r) l = 0.42 + 0.35 * clamp((hor - y) / r) + (d > r - 0.014 ? 0.35 : 0) + (hash3(Math.floor(x * 60), Math.floor(y * 40), 3) > 0.93 ? 0.4 : 0);
        }
        if (Math.abs(x - A * 0.5) < 0.004 && y > hor - 0.52 && y < hor - 0.28) l = 0.95;
        return l;
    },
    lab(x, y, A) {
        let l = 0.1 + 0.05 * fbm(x * 8, y * 8, 2);
        if (y > 0.68) l = 0.28 + 0.6 * line(y - 0.68, 0.015);                           // bench top
        for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {                         // racks of plates
            const cx = 0.14 + i * 0.12, cy = 0.14 + j * 0.16;
            if (Math.abs(x - cx) < 0.045 && Math.abs(y - cy) < 0.055) l = 0.6;
        }
        if (x > A * 0.6 && x < A * 0.92 && y > 0.1 && y < 0.5) l = 0.1 + 0.3 * (1 - y) + (x < A * 0.605 || x > A * 0.915 || y < 0.11 || y > 0.495 ? 0.6 : 0); // window
        if (x > A * 0.28 && x < A * 0.5 && y > 0.48 && y < 0.68) l = 0.5 + (x > A * 0.3 && x < A * 0.48 && y > 0.5 && y < 0.62 ? 0.5 * (0.6 + 0.4 * Math.sin(y * 90)) : 0); // sequencer
        return l;
    },
    flats(x, y, A) {
        const hor = 0.46;
        if (y < hor) {
            let l = 0.06 + 0.5 * Math.pow(y / hor, 2) * 0.6 + stars(x, y, 0.997) * 0.7;
            l = Math.max(l, disc(x, y, A * 0.72, 0.18, 0.07) * 0.95, disc(x, y, A * 0.22, 0.28, 0.035) * 0.8);
            return l;
        }
        const d = (y - hor) / (1 - hor);
        const fronds = fbm(x * (30 + d * 40), y * (14 + d * 18), 4);
        return 0.12 + 0.35 * d + 0.5 * (fronds > 0.62 ? 1 : fronds * 0.4) * (0.4 + d) + (hash3(Math.floor(x * 90), Math.floor(y * 90), 9) > 0.985 ? 0.5 : 0);
    },
    sump(x, y, A) {
        const cx = A / 2, cy = 0.62;
        const e = Math.hypot((x - cx) / 0.62, (y - cy) / 0.24);
        if (e < 1) return 0.25 + 0.7 * glow(x, y, cx, cy, 0.5) + 0.12 * Math.sin(e * 40 + y * 30);
        if (y < cy) { const band = 0.3 + 0.25 * Math.sin(y * 70 + fbm(x * 6, y * 6) * 6); return clamp(band * (0.4 + 0.6 * clamp((y - 0.1) * 1.6)) + (y < 0.1 ? stars(x, y) : 0)); }
        return 0.1 + 0.2 * fbm(x * 12, y * 12, 5) + 0.25 * clamp(1 - (e - 1) * 2);
    },
    ridge(x, y, A) {
        const rid = 0.62 + 0.09 * Math.sin(x * 3.1) + 0.06 * fbm(x * 5, 0, 3);
        if (y > rid) return 0.02 + (y - rid < 0.012 ? 0.5 : 0);
        return 0.1 + 0.55 * Math.pow(clamp(y / rid), 3) + disc(x, y, A * 0.3, rid - 0.02, 0.1) * 0.9 + disc(x, y, A * 0.78, 0.2, 0.04) * 0.9 + stars(x, y, 0.995) * 0.7 * (1 - y / rid);
    },
    // the whole valley beating as one
    chorus(x, y, A) {
        const rid = 0.3 + 0.07 * Math.sin(x * 2.7) + 0.05 * fbm(x * 4, 1, 3);
        if (y < rid) return 0.04 + stars(x, y, 0.994) * 0.8 + disc(x, y, A * 0.8, 0.12, 0.05) * 0.8;
        const d = Math.hypot((x - A / 2) * 0.9, (y - 0.85) * 1.9);
        const ring = Math.sin(d * 34) * 0.5 + 0.5;
        return 0.08 + 0.85 * Math.pow(ring, 3) * clamp(1.15 - d * 0.9) + (hash3(Math.floor(x * 80), Math.floor(y * 80), 2) > 0.97 ? 0.5 : 0);
    },
    spire(x, y, A) {
        let l = 0.06 + 0.4 * Math.pow(y, 2.4) + stars(x, y, 0.997) * 0.7;
        for (let i = 0; i < 5; i++) {
            const cx = A * (0.18 + i * 0.16) + (hash3(i, 1) - 0.5) * 0.05;
            const top = 0.02 + hash3(i, 2) * 0.1;
            const w = 0.04 + 0.03 * (y - top) - (i % 2) * 0.006;
            if (y > top && Math.abs(x - cx) < w) l = 0.3 + 0.35 * Math.sin((x - cx) * 160) * 0.5 + 0.3 * (1 - Math.abs(x - cx) / w);
            const cd = Math.hypot((x - cx) / (w * 1.9), (y - top - 0.04) / 0.07);
            if (cd < 1) l = 0.55 + 0.35 * (1 - cd);
        }
        return y > 0.88 ? Math.max(l, 0.35 * fbm(x * 10, y * 30, 3)) : l;
    },
    cathedral(x, y, A) {
        let l = 0.08 + 0.1 * fbm(x * 6, y * 6, 4);
        const per = A / 4;
        const u = ((x % per) / per) * 2 - 1;                                   // -1..1 across each bay
        const arch = 0.08 + 0.78 * (1 - u * u);                                 // rib height in this bay
        l = Math.max(l, line(y - (1 - arch), 0.025) * 0.95, line(Math.abs(u) - 0.97, 0.05) * 0.8 * (y > 1 - arch ? 1 : 0));
        l = Math.max(l, 0.55 * glow(x, y, A / 2, 0.15, 0.55) * (y < 0.8 ? 1 : 0.2));
        if (y > 0.85) l = Math.max(l, 0.25 + 0.3 * fbm(x * 20, y * 30, 8));
        if (x > A * 0.4 && x < A * 0.6 && y > 0.74 && y < 0.88) l = 0.7 * (y > 0.8 ? 0.6 : 1);   // the rover
        return l;
    },
    lattice(x, y) {
        const g = 0.11;
        const gx = Math.floor(x / g), gy = Math.floor(y / g);
        let d1 = 9, d2 = 9;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const px = (gx + i + hash3(gx + i, gy + j, 1)) * g, py = (gy + j + hash3(gx + i, gy + j, 2)) * g;
            const d = Math.hypot(x - px, y - py);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return 0.05 + 0.85 * clamp(1 - (d2 - d1) / 0.012) * (0.5 + 0.5 * fbm(x * 5, y * 5, 6)) + (d1 < 0.011 ? 0.9 : 0);
    },
    cradle(x, y, A) {
        const cx = A / 2, cy = 0.48;
        const e = Math.hypot((x - cx) / 0.26, (y - cy) / 0.44);
        let l = 0.05 + 0.15 * fbm(x * 6, y * 6, 2);
        if (e < 1) {
            const a = Math.atan2(y - cy, x - cx);
            l = 0.3 + 0.45 * Math.abs(Math.sin(a * 9 + e * 6)) * (0.4 + e * 0.6) + 0.3 * (1 - e);
            if (e > 0.96) l = 0.95;
        }
        l = Math.max(l, line(Math.abs(x - cx) - 0.42 + (y) * 0.3, 0.012) * 0.5 * (y < 0.6 ? 1 : 0));   // roots
        for (let i = 0; i < 4; i++) { const px = cx + (i - 1.5) * 0.17; if (Math.hypot((x - px) / 0.07, (y - 0.9) / 0.04) < 1) l = 0.75; }  // cocoons
        return l;
    },
    camp(x, y, A) {
        const hor = 0.7;
        if (y < hor) {
            let l = 0.05 + stars(x, y, 0.993) * 0.8 + 0.3 * glow(x, y, A * 0.66, hor, 0.5);
            const tx = A * 0.35;
            if (y > hor - 0.2 && Math.abs(x - tx) < (y - (hor - 0.2)) * 0.9) l = 0.5 + 0.3 * (x < tx ? 1 : 0.3);
            return l;
        }
        return Math.max(0.08 + 0.2 * fbm(x * 14, y * 14, 5), 0.95 * glow(x, y, A * 0.66, 0.84, 0.09));
    },
    launch(x, y, A) {
        const hor = 0.82;
        if (y >= hor) return 0.04 + (y - hor < 0.01 ? 0.5 : 0);
        let l = 0.05 + stars(x, y, 0.99) * 0.9;
        for (let i = 0; i < 19; i++) {
            const px = A * (i + 0.5) / 19;
            const h = 0.25 + hash3(i, 5) * 0.5;
            l = Math.max(l, line(x - px, 0.018 - 0.01 * clamp((hor - y) / h)) * clamp(1.15 - (hor - y) / h) * 0.95);
            if (y > hor - 0.04) l = Math.max(l, glow(x, y, px, hor, 0.05));
        }
        return l;
    },
    fire(x, y, A) {
        const flame = fbm(x * 12, y * 6 - 3, 4) + (1 - y) * -0.1;
        let l = 0.04 + 0.9 * clamp((flame - 0.38) * 3) * clamp((y - 0.25) * 1.8);
        l += (hash3(Math.floor(x * 70), Math.floor(y * 70), 6) > 0.992 ? 0.8 : 0);
        return Math.max(l, 0.35 * glow(x, y, A / 2, 1, 0.8));
    },
};

/** The scene as a Uint8Array of 0/1 pixels, w*h, row by row. */
export function renderArt(key, w, h) {
    const fn = SCENES[key] || SCENES.station;
    const A = w / h;
    const bits = new Uint8Array(w * h);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            // a little contrast, so the darks are really dark (the dither would speckle them otherwise)
            const lum = clamp((fn((px + 0.5) / h, (py + 0.5) / h, A) - 0.09) * 1.18, 0, 1);
            bits[py * w + px] = lum > BAYER[(px & 3) + (py & 3) * 4] ? 1 : 0;
        }
    }
    return bits;
}

/** Paint the first `rows` rows of a bitmap onto a canvas in an [r, g, b] phosphor. */
export function paintArt(canvas, bits, rows, rgb) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const n = Math.min(h, Math.floor(rows)) * w;
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (bits[i]) { img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
}

export const SCENE_KEYS = Object.keys(SCENES);
