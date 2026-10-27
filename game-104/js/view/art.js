// The pictures. Everything is drawn at 320×136 with a handful of primitives and ordered-dither
// patterns, then thresholded to strict one-bit black and white (the one trick that makes
// canvas's anti-aliased edges look like a 1990 graphics card). No image files.

import { VIRT } from '../config.js';
import { hash3 } from '../rng.js';

const { w: W, h: H } = VIRT;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const WHITE = '#f0f0f0';
const BLACK = '#000';

const cache = new Map();
function ditherPattern(ctx, level) {
    const key = Math.max(0, Math.min(16, Math.round(level)));
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const g = c.getContext('2d');
    const im = g.createImageData(4, 4);
    for (let i = 0; i < 16; i++) {
        const on = BAYER[i] < key;
        im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = on ? 240 : 0;
        im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const p = ctx.createPattern(c, 'repeat');
    cache.set(key, p);
    return p;
}

/** The painter: a thin wrapper that knows our palette (W, B and 0–16 dither levels). */
function makePainter(ctx) {
    const d = {
        c: ctx,
        fill(v) { ctx.fillStyle = v === 'W' ? WHITE : v === 'B' ? BLACK : ditherPattern(ctx, v); },
        stroke(v) { ctx.strokeStyle = v === 'W' ? WHITE : v === 'B' ? BLACK : ditherPattern(ctx, v); },
        rect(x, y, w, h, f = 'W') { d.fill(f); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
        frame(x, y, w, h, f = 'B', s = 'W') {
            d.rect(x, y, w, h, f);
            d.stroke(s); ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
        },
        line(x1, y1, x2, y2, col = 'W', lw = 1) {
            d.stroke(col); ctx.lineWidth = lw;
            ctx.beginPath(); ctx.moveTo(x1 + 0.5, y1 + 0.5); ctx.lineTo(x2 + 0.5, y2 + 0.5); ctx.stroke();
        },
        poly(pts, f = 'B', s = 'W') {
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + 0.5, y + 0.5) : ctx.moveTo(x + 0.5, y + 0.5)));
            ctx.closePath();
            if (f != null) { d.fill(f); ctx.fill(); }
            if (s != null) { d.stroke(s); ctx.lineWidth = 1; ctx.stroke(); }
        },
        circle(x, y, r, f = 'W', s = null) {
            ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
            if (f != null) { d.fill(f); ctx.fill(); }
            if (s != null) { d.stroke(s); ctx.lineWidth = 1; ctx.stroke(); }
        },
        ellipse(x, y, rx, ry, f = 'W', s = null, rot = 0) {
            ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, rx, ry, rot, 0, Math.PI * 2);
            if (f != null) { d.fill(f); ctx.fill(); }
            if (s != null) { d.stroke(s); ctx.lineWidth = 1; ctx.stroke(); }
        },
        /** A vertical dithered gradient from level a (top) to b (bottom), in 3px bands. */
        grad(x, y, w, h, a, b) {
            for (let i = 0; i < h; i += 3) d.rect(x, y + i, w, Math.min(3, h - i), a + (b - a) * (i / Math.max(1, h)));
        },
        text(str, x, y, size = 8, col = 'W', align = 'left') {
            ctx.font = `${size}px 'Courier New', monospace`;
            ctx.textAlign = align; ctx.textBaseline = 'top';
            d.fill(col); ctx.fillText(str, x, y);
        },
    };
    return d;
}

// ------------------------------------------------------------------ shared pieces
function stars(d, seed, n, ymax, t = 0) {
    for (let i = 0; i < n; i++) {
        const x = Math.floor(hash3(seed, i, 1) * W), y = Math.floor(hash3(seed, i, 2) * ymax);
        const tw = (Math.sin(t * 2 + i * 7) > 0.92) ? 0 : 1;
        if (tw) d.rect(x, y, 1, 1, 'W');
        if (i % 9 === 0 && tw) { d.rect(x - 1, y, 3, 1, 'W'); d.rect(x, y - 1, 1, 3, 'W'); }
    }
}
function moon(d, x, y, r, phase = 0) {
    d.circle(x, y, r + 14, 3); d.circle(x, y, r + 8, 5); d.circle(x, y, r + 3, 8);
    d.circle(x, y, r, 'W');
    d.circle(x - r * 0.35, y - r * 0.2, r * 0.22, 10);
    d.circle(x + r * 0.3, y + r * 0.35, r * 0.15, 11);
    if (phase) d.circle(x + r * 0.45, y - r * 0.1, r * 0.95, 'B');
}
function clouds(d, t, y = 30) {
    for (let i = 0; i < 4; i++) {
        const x = ((i * 97 + t * 4) % (W + 80)) - 40;
        d.ellipse(x, y + i * 7, 34, 3, 2); d.ellipse(x + 10, y + i * 7 - 2, 22, 2, 3);
    }
}
function fog(d, t, y, h, lvl = 4) {
    for (let i = 0; i < 3; i++) {
        const o = Math.sin(t * 0.3 + i * 2) * 14;
        d.ellipse(60 + i * 100 + o, y + i * 3, 70, h / 2, lvl); d.ellipse(40 + i * 110 - o, y + 6, 50, h / 3, lvl + 1);
    }
}
function ground(d, y, lvl = 2) {
    d.rect(0, y, W, H - y, 'B');
    d.grad(0, y, W, H - y, lvl + 2, lvl);
    d.line(0, y, W, y, 'W');
}
function hills(d, pts, lvl = 3) { d.poly([[0, H], ...pts, [W, H]], lvl, null); }
function tree(d, x, y, h, seed = 1, lean = 0) {
    const branch = (bx, by, len, ang, depth) => {
        const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
        d.line(bx, by, ex, ey, 'W', depth > 3 ? 3 : depth > 1 ? 2 : 1);
        if (depth <= 0 || len < 4) return;
        const j = hash3(seed, Math.round(bx), Math.round(by));
        branch(ex, ey, len * (0.68 + j * 0.1), ang - 0.55 - j * 0.35, depth - 1);
        branch(ex, ey, len * (0.62 + j * 0.12), ang + 0.5 + j * 0.4, depth - 1);
        if (depth > 2 && j > 0.45) branch(ex, ey, len * 0.5, ang + (j - 0.5), depth - 2);
    };
    d.line(x, y, x + lean, y - h * 0.35, 'W', 4);
    d.line(x + 1, y, x + lean + 1, y - h * 0.35, 'B', 1);
    branch(x + lean, y - h * 0.33, h * 0.36, -Math.PI / 2 + lean * 0.03, 5);
}
function lampLight(d, x, y, r, t = 0) {
    const f = r + Math.sin(t * 9 + x) * 1.2;
    d.circle(x, y, f * 1.8, 2); d.circle(x, y, f * 1.3, 4); d.circle(x, y, f * 0.8, 8);
}
function window_(d, x, y, w, h, lit = true, t = 0, cross = true) {
    d.frame(x, y, w, h, lit ? (Math.sin(t * 8 + x) > 0.9 ? 12 : 14) : 'B', 'W');
    if (cross) { d.line(x + w / 2, y, x + w / 2, y + h, 'B'); d.line(x, y + h / 2, x + w, y + h / 2, 'B'); }
}
function door_(d, x, y, w, h, open = false) {
    d.frame(x, y, w, h, open ? 'B' : 4, 'W');
    if (!open) { for (let i = 2; i < w - 2; i += 4) d.line(x + i, y + 1, x + i, y + h - 1, 'B'); d.rect(x + w - 5, y + h / 2, 2, 2, 'W'); }
}
function arch(d, x, y, w, h, fillv = 'B') {
    d.c.beginPath(); d.c.moveTo(x, y + h); d.c.lineTo(x, y + w / 2);
    d.c.quadraticCurveTo(x, y, x + w / 2, y - 0); d.c.quadraticCurveTo(x + w, y, x + w, y + w / 2); d.c.lineTo(x + w, y + h); d.c.closePath();
    d.fill(fillv); d.c.fill(); d.stroke('W'); d.c.lineWidth = 1; d.c.stroke();
}
function gothic(d, x, y, w, h, fillv = 'B') {
    d.poly([[x, y + h], [x, y + h * 0.4], [x + w / 2, y], [x + w, y + h * 0.4], [x + w, y + h]], fillv, 'W');
}
function bricks(d, x, y, w, h, lvl = 4) {
    d.rect(x, y, w, h, lvl);
    for (let r = 0; r * 6 < h; r++) {
        d.line(x, y + r * 6, x + w, y + r * 6, 'B');
        for (let c = 0; c * 12 < w + 12; c++) d.line(x + c * 12 + (r % 2) * 6, y + r * 6, x + c * 12 + (r % 2) * 6, y + r * 6 + 6, 'B');
    }
}
function stones(d, x, y, w, h, lvl = 3) { bricks(d, x, y, w, h, lvl); }
function planks(d, x, y, w, h, lvl = 3) {
    d.rect(x, y, w, h, lvl);
    for (let i = 0; i < w; i += 14) d.line(x + i, y, x + i, y + h, 'B');
}
function crate(d, x, y, w, h) {
    d.frame(x, y, w, h, 3, 'W'); d.line(x, y, x + w - 1, y + h - 1, 'W'); d.line(x + w - 1, y, x, y + h - 1, 'W');
}
function barrel(d, x, y, w, h) {
    d.c.beginPath(); d.c.moveTo(x + 1, y); d.c.quadraticCurveTo(x - 3, y + h / 2, x + 1, y + h);
    d.c.lineTo(x + w - 1, y + h); d.c.quadraticCurveTo(x + w + 3, y + h / 2, x + w - 1, y); d.c.closePath();
    d.fill(5); d.c.fill(); d.stroke('W'); d.c.lineWidth = 1; d.c.stroke();
    d.line(x, y + h * 0.3, x + w, y + h * 0.3, 'B'); d.line(x, y + h * 0.7, x + w, y + h * 0.7, 'B');
}
function column(d, x, y, w, h) {
    d.rect(x, y, w, h, 'B'); d.rect(x + 1, y, w - 2, h, 9); d.rect(x + w / 2, y, w / 2 - 1, h, 4);
    d.line(x, y, x, y + h, 'W'); d.line(x + w - 1, y, x + w - 1, y + h, 'W');
    d.rect(x - 2, y, w + 4, 3, 'W'); d.rect(x - 2, y + h - 3, w + 4, 3, 'W');
}
function bars(d, x, y, w, h, gap = 5) {
    for (let i = 0; i <= w; i += gap) d.line(x + i, y, x + i, y + h, 'W');
    d.line(x, y + 3, x + w, y + 3, 'W'); d.line(x, y + h - 3, x + w, y + h - 3, 'W');
}
function flame(d, x, y, s, t, seed = 0) {
    const f1 = Math.sin(t * 13 + seed) * 1.5, f2 = Math.sin(t * 17 + seed * 2) * 1.2;
    d.poly([[x - s, y], [x - s * 0.6 + f1, y - s * 1.5], [x + f2, y - s * 2.6 - Math.abs(f1)], [x + s * 0.6 - f1, y - s * 1.4], [x + s, y]], 'W', null);
    d.poly([[x - s * 0.5, y], [x + f1 * 0.5, y - s * 1.4], [x + s * 0.5, y]], 'B', null);
}
function candle(d, x, y, t) {
    d.rect(x, y - 6, 3, 6, 'W'); flame(d, x + 1, y - 7, 1.5, t, x);
}
function lantern(d, x, y, t, big = false) {
    d.rect(x - 2, y - 2, 5, 7, 'B'); d.frame(x - 2, y - 2, 5, 7, 12, 'W'); d.line(x - 2, y - 3, x + 2, y - 3, 'W');
    lampLight(d, x, y + 1, big ? 12 : 8, t);
}
function crow(d, x, y, t, flip = 1) {
    const f = Math.sin(t * 2 + x) > 0.97;
    d.poly([[x - 4 * flip, y - 3], [x, y - 5], [x + 4 * flip, y - 3], [x + 5 * flip, y], [x + 2 * flip, y + 3], [x - 4 * flip, y + 1]], 'B', 'W');
    d.poly([[x + 4 * flip, y - 3], [x + 8 * flip, y - 2], [x + 4 * flip, y - 1]], 'W', null);
    d.rect(x + 2 * flip, y - 3, 1, 1, f ? 'B' : 'W');
    d.line(x - 3 * flip, y + 1, x - 8 * flip, y + 3, 'W');
}
function hemlock(d, x, y, h, seed) {
    d.line(x, y, x, y - h, 'W');
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55, ex = x + Math.cos(a) * 8, ey = y - h + Math.sin(a) * 8;
        d.line(x, y - h + 2, ex, ey, 'W');
        d.rect(ex - 1, ey - 1, 3, 2, 'W'); d.rect(ex - 2, ey, 1, 1, 'W'); d.rect(ex + 2, ey, 1, 1, 'W');
    }
}
function sprig(d, x, y, h) {
    d.line(x, y, x, y - h, 'W');
    for (let i = 1; i < 4; i++) { d.line(x, y - i * h / 4, x - 3, y - i * h / 4 - 2, 'W'); d.line(x, y - i * h / 4, x + 3, y - i * h / 4 - 2, 'W'); }
}
function vignette(d, amt) {
    if (amt <= 0) return;
    const l = Math.min(14, 2 + amt * 12);
    d.c.save();
    for (let i = 0; i < 6; i++) {
        d.rect(0, i * 4, W, 4, 'B'); // placeholder replaced below
    }
    d.c.restore();
}

// ------------------------------------------------------------------ people
/** A small figure standing with its feet at (x, y). 'kind' picks the silhouette. */
function person(d, x, y, kind, t, opt = {}) {
    const bob = Math.round(Math.sin(t * 2.4 + x) * 0.6);
    const fl = opt.flip ? -1 : 1;
    y += bob * 0;
    const head = (cx, cy, r = 3.4, skin = 'W') => d.circle(cx, cy, r, skin, 'W');
    switch (kind) {
        case 'hero': {
            // Elspeth: pointed hat, long skirt, a shawl
            d.poly([[x - 6, y], [x - 5, y - 15], [x + 5, y - 15], [x + 7, y]], 'B', 'W');
            d.poly([[x - 5, y - 15], [x + 5, y - 15], [x + 1, y - 9]], 6, null);
            d.line(x - 5, y - 14, x + 4, y - 9, 'W');
            head(x, y - 19, 3.6);
            d.rect(x - 4, y - 21, 3, 6, 'B'); d.rect(x + 2, y - 21, 2, 6, 'B');
            d.poly([[x - 9, y - 22], [x + 9, y - 22], [x + 3, y - 24], [x + 1, y - 34], [x - 3, y - 24]], 'B', 'W');
            d.line(x - 3, y - 25, x + 3, y - 25, 'W');
            d.rect(x + 1 * fl, y - 18, 1, 1, 'B');
            break;
        }
        case 'witch': { // Bryony and other young witches: hood and cloak, crossbow
            d.poly([[x - 7, y], [x - 4, y - 16], [x + 4, y - 16], [x + 7, y]], 'B', 'W');
            d.line(x, y - 16, x, y, 'W');
            head(x, y - 20, 3.4);
            d.poly([[x - 5, y - 17], [x - 4, y - 25], [x, y - 27], [x + 4, y - 25], [x + 5, y - 17], [x + 2, y - 18], [x - 2, y - 18]], 'B', 'W');
            d.line(x + 5 * fl, y - 12, x + 12 * fl, y - 14, 'W'); d.line(x + 8 * fl, y - 16, x + 8 * fl, y - 11, 'W');
            break;
        }
        case 'bailiff': {
            d.poly([[x - 7, y], [x - 6, y - 17], [x + 6, y - 17], [x + 7, y]], 'B', 'W');
            d.line(x, y - 17, x, y, 'W');
            d.rect(x - 2, y - 14, 3, 3, 'W'); // the brass crow
            head(x, y - 21, 3.4);
            d.poly([[x - 6, y - 22], [x + 6, y - 22], [x + 4, y - 28], [x - 4, y - 28]], 'B', 'W');
            d.line(x - 7, y - 22, x + 7, y - 22, 'W');
            d.rect(x - 5, y - 15, 2, 2, 'W'); d.rect(x + 3, y - 15, 2, 2, 'W');
            break;
        }
        case 'child': {
            d.poly([[x - 4, y], [x - 3, y - 9], [x + 3, y - 9], [x + 4, y]], 'B', 'W');
            head(x, y - 12, 3);
            break;
        }
        case 'man': {
            d.poly([[x - 8, y], [x - 7, y - 16], [x + 7, y - 16], [x + 8, y]], 'B', 'W');
            d.rect(x - 5, y - 12, 10, 3, 'W');
            head(x, y - 20, 3.6);
            d.rect(x - 4, y - 25, 8, 3, 'B');
            break;
        }
        case 'crone': case 'sexton': {
            d.poly([[x - 7, y], [x - 5, y - 14], [x, y - 17], [x + 5, y - 14], [x + 7, y]], 'B', 'W');
            head(x + 1 * fl, y - 19, 3.2);
            d.poly([[x - 5, y - 16], [x - 3, y - 24], [x + 4, y - 24], [x + 6, y - 16], [x + 3, y - 18], [x - 2, y - 18]], 'B', 'W');
            d.line(x + 8 * fl, y - 17, x + 8 * fl, y, 'W');
            break;
        }
        case 'matron': {
            d.poly([[x - 7, y], [x - 6, y - 16], [x + 6, y - 16], [x + 7, y]], 8, 'W');
            d.rect(x - 4, y - 16, 8, 6, 'W');
            head(x, y - 20, 3.4);
            d.poly([[x - 5, y - 22], [x + 5, y - 22], [x + 3, y - 27], [x - 3, y - 27]], 'W', 'W');
            break;
        }
        case 'doctor': {
            d.poly([[x - 8, y], [x - 6, y - 20], [x + 6, y - 20], [x + 8, y]], 14, 'W');
            d.line(x, y - 20, x, y, 'B');
            head(x, y - 23, 3.4);
            d.poly([[x - 4, y - 26], [x + 4, y - 26], [x + 12 * fl, y - 21], [x + 3 * fl, y - 21]], 'B', 'W'); // the beak
            d.poly([[x - 5, y - 27], [x + 5, y - 27], [x + 3, y - 33], [x - 3, y - 33]], 'B', 'W');
            break;
        }
        case 'twins': {
            person(d, x - 8, y, 'crone', t); person(d, x + 8, y, 'crone', t, { flip: true });
            break;
        }
        case 'ghost': {
            const s = 6 + Math.sin(t * 2) * 1;
            d.poly([[x - 8, y + 2], [x - 6, y - 14], [x - 3 + 0, y - s - 14], [x + 3, y - s - 14], [x + 6, y - 14], [x + 8, y + 2], [x + 4, y - 1], [x, y + 3], [x - 4, y - 1]], 7, null);
            d.circle(x, y - 20, 4, 12, null);
            d.rect(x - 2, y - 21, 1, 2, 'B'); d.rect(x + 1, y - 21, 1, 2, 'B');
            d.line(x - 3, y - 15, x + 3, y - 15, 'W');
            break;
        }
        case 'crow': crow(d, x, y - 4, t); break;
        default: head(x, y - 10, 4);
    }
}

function elspeth(d, x, y, t, S) {
    if (S.veil) { // a shimmer: half of her is not there
        d.c.save(); d.c.beginPath(); d.c.rect(x - 14, y - 40, 28, 42); d.c.clip();
        person(d, x, y, 'hero', t);
        for (let i = 0; i < 42; i += 2) d.rect(x - 14, y - 40 + i + ((t * 20 | 0) % 2), 28, 1, 'B');
        d.c.restore();
        return;
    }
    if (S.hidden) { // crouched behind something: only the hat shows
        d.poly([[x - 6, y - 8], [x + 6, y - 8], [x + 2, y - 10], [x, y - 17], [x - 2, y - 10]], 'B', 'W');
        return;
    }
    person(d, x, y, 'hero', t);
}

// ------------------------------------------------------------------ scenes
// Each takes (d, t, S): the painter, seconds, and { lantern, hidden, veil, dread, ... }.
const HZ = 96; // horizon, for outdoor scenes
const night = (d, t, top = 0, bot = 5) => { d.grad(0, 0, W, HZ, top, bot); };

const SCENES = {
    title(d, t) {
        night(d, t, 0, 6); stars(d, 11, 60, 70, t); moon(d, 214, 52, 30);
        hills(d, [[0, 104], [50, 92], [110, 100], [180, 88], [250, 98], [320, 90]], 3);
        d.rect(0, 104, W, 32, 'B');
        // a witch on the hill, her hat against the moon
        d.poly([[198, 104], [205, 62], [222, 62], [232, 104]], 'B', null);
        d.circle(213, 56, 5, 'B'); d.poly([[200, 52], [226, 52], [216, 48], [211, 24], [207, 48]], 'B', null);
        d.poly([[225, 70], [250, 96], [246, 100], [222, 82]], 'B', null);
        for (let i = 0; i < 18; i++) hemlock(d, 8 + i * 18 + (i % 3) * 3, 136, 22 + (i * 7 % 13), i);
        fog(d, t, 112, 14, 3);
        crow(d, 60 + Math.sin(t * 0.4) * 10, 40 + Math.cos(t * 0.5) * 3, t);
    },
    cottage(d, t, S) {
        bricks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); planks(d, 0, 100, W, 36, 2); d.line(0, 100, W, 100, 'W');
        // beams and hanging herbs
        for (let i = 0; i < 4; i++) d.rect(i * 96 - 8, 0, 8, 100, 'B');
        d.rect(0, 0, W, 8, 'B'); d.line(0, 8, W, 8, 'W');
        for (let i = 0; i < 7; i++) { sprig(d, 20 + i * 44, 24 + (i % 2) * 4, 12); }
        // hearth
        d.frame(8, 40, 74, 60, 'B', 'W'); d.rect(14, 50, 62, 50, 'B');
        flame(d, 30, 98, 6, t, 1); flame(d, 46, 98, 8, t, 2); flame(d, 62, 98, 6, t, 3);
        lampLight(d, 46, 86, 22, t);
        d.rect(8, 42, 74, 4, 'W'); d.rect(12, 34, 6, 6, 'W'); // mantel, kettle hook
        // window and the moonbeam
        window_(d, 140, 28, 38, 44, false, t, true); d.rect(142, 30, 34, 40, 11);
        d.poly([[142, 70], [176, 70], [238, 124], [150, 124]], 5, null);
        // table, cup, stool on its side
        d.frame(176, 84, 46, 6, 'B'); d.line(180, 90, 178, 112, 'W'); d.line(218, 90, 220, 112, 'W');
        d.rect(196, 78, 6, 6, 'W'); d.rect(197, 79, 4, 3, 'B');
        d.poly([[116, 112], [132, 106], [136, 110], [120, 118]], 'B', 'W'); d.line(120, 118, 114, 124, 'W'); d.line(132, 108, 140, 112, 'W');
        // the broken door to the right, with night behind it
        d.rect(262, 34, 40, 72, 'B'); d.grad(262, 34, 40, 72, 0, 3); d.poly([[262, 34], [262, 106], [278, 100], [276, 40]], 'B', 'W'); stars(d, 5, 5, 40, t);
        // trapdoor
        d.frame(236, 108, 28, 12, 'B'); d.rect(248, 112, 3, 3, 'W');
        if (S && S.lantern) lampLight(d, 90, 70, 10, t);
    },
    stillroom(d, t, S) {
        d.rect(0, 0, W, H, 'B'); stones(d, 0, 0, W, 106, 2); d.rect(0, 106, W, 30, 'B'); d.line(0, 106, W, 106, 'W');
        for (let i = 0; i < 12; i++) d.line(i * 28, 0, i * 28 + 8, 12, 'W');
        for (let i = 0; i < 12; i++) { sprig(d, 8 + i * 27, 8, 14 + (i * 5) % 8); }
        for (let r = 0; r < 3; r++) {
            d.rect(0, 40 + r * 22, 110, 3, 'W'); d.rect(210, 40 + r * 22, 110, 3, 'W');
            for (let i = 0; i < 9; i++) { d.frame(4 + i * 12, 28 + r * 22, 9, 12, 'B'); d.rect(6 + i * 12, 30 + r * 22, 5, 4, 8); }
            for (let i = 0; i < 9; i++) { d.frame(212 + i * 12, 28 + r * 22, 9, 12, 'B'); d.rect(214 + i * 12, 30 + r * 22, 5, 4, 8); }
        }
        d.frame(120, 94, 80, 8, 'B'); d.frame(138, 82, 16, 12, 'B'); // bench, mortar
        d.line(250, 106, 250, 78, 'W'); d.frame(236, 66, 28, 14, 'W', 'W'); d.rect(238, 68, 11, 10, 'B'); d.rect(251, 68, 11, 10, 'B');
        if (S && S.lantern) lampLight(d, 98, 80, 26, t);
    },
    garden(d, t, S) {
        night(d, t, 0, 4); stars(d, 3, 50, 70, t); moon(d, 262, 30, 14);
        hills(d, [[0, 90], [70, 84], [140, 92], [210, 86], [320, 94]], 3);
        // the cottage silhouette on the left, a lit window
        d.poly([[10, HZ], [10, 56], [40, 40], [70, 56], [70, HZ]], 'B', 'W'); window_(d, 24, 64, 12, 14, true, t); d.rect(50, 60, 10, 6, 'B'); d.rect(52, 40, 6, 12, 'B');
        d.rect(54, 32, 3, 8, 3);
        ground(d, HZ, 3);
        // herb rows, receding
        for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { const x = 20 + i * 24 + r * 8, y = 104 + r * 9; sprig(d, x, y, 5 + r * 2); }
        d.poly([[0, 134], [120, 134], [150, 120], [150, 100], [138, 100]], 2, null);
        // the well
        d.frame(258, 92, 28, 14, 'B'); d.line(262, 92, 262, 70, 'W'); d.line(282, 92, 282, 70, 'W'); d.line(260, 70, 284, 70, 'W'); d.line(272, 70, 272, 86, 'W');
        // fence
        for (let i = 0; i < 10; i++) { d.line(150 + i * 12, 92, 150 + i * 12, 110, 'W'); } d.line(150, 96, 260, 96, 'W'); d.line(150, 104, 260, 104, 'W');
        fog(d, t, 118, 12, 3);
    },
    lane(d, t, S) {
        night(d, t, 0, 4); stars(d, 9, 40, 60, t); moon(d, 240, 26, 12);
        // hedges: thick dark banks to the left and right with thorns
        d.poly([[0, 20], [60, 30], [120, 62], [150, 96], [0, 136]], 'B', null);
        d.poly([[W, 16], [260, 34], [200, 64], [172, 96], [W, 136]], 'B', null);
        for (let i = 0; i < 40; i++) { const a = hash3(2, i, 0) * 6.28, rr = 30 + hash3(2, i, 1) * 60; const x = 40 + Math.cos(a) * rr * 0.9, y = 70 + Math.sin(a) * rr * 0.9; if (x < 130) d.line(x, y, x + 4, y - 4, 'W'); }
        for (let i = 0; i < 40; i++) { const a = hash3(3, i, 0) * 6.28, rr = 30 + hash3(3, i, 1) * 60; const x = 280 + Math.cos(a) * rr * 0.9, y = 70 + Math.sin(a) * rr * 0.9; if (x > 190) d.line(x, y, x - 4, y - 4, 'W'); }
        d.poly([[150, 96], [172, 96], [W, 136], [0, 136]], 3, null);
        d.line(150, 96, 0, 136, 'W'); d.line(172, 96, W, 136, 'W');
        d.line(158, 98, 120, 136, 'W'); d.line(166, 98, 200, 136, 'W'); // ruts
        // a gatepost and a crow
        d.rect(28, 66, 14, 50, 'B'); d.frame(26, 62, 18, 6, 'B'); d.rect(28, 68, 2, 48, 'W');
        crow(d, 36, 56, t);
        fog(d, t, 112, 12, 3);
    },
    wood(d, t, S) {
        night(d, t, 0, 3); stars(d, 13, 30, 40, t); moon(d, 160, 20, 10);
        for (let i = 0; i < 6; i++) tree(d, 20 + i * 62, 104 + (i % 2) * 8, 80 + (i * 13) % 30, i + 1, (i % 3 - 1) * 4);
        ground(d, 104, 2);
        // the bog: a green, level, too-smooth carpet
        d.poly([[200, 108], [320, 106], [320, 136], [170, 136]], 11, 'W');
        for (let i = 0; i < 14; i++) d.line(210 + i * 8, 112 + (i % 3) * 6, 214 + i * 8, 112 + (i % 3) * 6, 'B');
        d.line(260, 110, 260, 94, 'W'); d.line(260, 94, 256, 92, 'W'); // the heron
        // mushroom ring
        for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, x = 80 + Math.cos(a) * 26, y = 122 + Math.sin(a) * 5; d.line(x, y, x, y - 4, 'W'); d.ellipse(x, y - 5, 3, 2, 'W'); }
        fog(d, t, 104, 14, 4);
    },
    crossroads(d, t, S) {
        night(d, t, 0, 4); stars(d, 17, 44, 60, t); moon(d, 56, 28, 12);
        hills(d, [[0, 94], [90, 88], [180, 94], [260, 86], [320, 92]], 3);
        // lights of the town to the north
        for (let i = 0; i < 12; i++) d.rect(140 + i * 6, 80 + (i * 3) % 5, 2, 2, 'W');
        d.poly([[120, 90], [128, 80], [140, 80], [150, 90]], 'B', null);
        ground(d, 92, 2);
        // five roads: fan from the centre
        const cx = 160, cy = 108;
        for (const [ex, ey] of [[0, 128], [320, 128], [90, 94], [230, 94], [160, 94], [20, 100]]) d.poly([[cx - 4, cy], [cx + 4, cy], [ex + 10, ey], [ex - 10, ey]], 4, null);
        d.line(150, 94, 112, 135, 'W'); d.line(170, 94, 208, 135, 'W');
        // the signpost and the chain across the hill road
        d.line(cx, cy, cx, 64, 'W', 2); d.poly([[cx, 70], [cx + 28, 70], [cx + 34, 74], [cx + 28, 78], [cx, 78]], 'B', 'W'); d.poly([[cx, 82], [cx - 26, 82], [cx - 32, 86], [cx - 26, 90], [cx, 90]], 'B', 'W');
        d.poly([[cx, 58], [cx + 24, 58], [cx + 30, 62], [cx + 24, 66], [cx, 66]], 'B', 'W');
        for (let i = 0; i < 6; i++) d.circle(236 + i * 4, 98 - i, 1.4, null, 'W');
        // the oak, far off, and the mill
        tree(d, 290, 94, 56, 4); d.poly([[24, 94], [24, 66], [36, 60], [48, 66], [48, 94]], 'B', 'W');
        fog(d, t, 106, 10, 3);
    },
    millyard(d, t, S) {
        night(d, t, 0, 4); stars(d, 21, 40, 50, t); moon(d, 270, 24, 11);
        // the mill: tall tapering tower with four still sails
        d.poly([[116, HZ], [128, 20], [172, 20], [186, HZ]], 'B', 'W'); d.poly([[122, 20], [150, 2], [178, 20]], 'B', 'W');
        for (let i = 0; i < 6; i++) d.line(125 + i, 28 + i * 12, 176 - i, 28 + i * 12, 3);
        for (const a of [0.78, 2.35, 3.92, 5.5]) { const ex = 150 + Math.cos(a) * 62, ey = 34 + Math.sin(a) * 62; d.line(150, 34, ex, ey, 'W', 2); d.poly([[150 + Math.cos(a) * 14, 34 + Math.sin(a) * 14], [ex, ey], [ex + Math.cos(a + 1.57) * 10, ey + Math.sin(a + 1.57) * 10], [150 + Math.cos(a) * 14 + Math.cos(a + 1.57) * 10, 34 + Math.sin(a) * 14 + Math.sin(a + 1.57) * 10]], 3, 'W'); }
        d.circle(150, 34, 4, 'W');
        window_(d, 142, 50, 14, 16, S.millOpen, t); door_(d, 140, 76, 20, 20, !!S.millOpen);
        ground(d, HZ, 2);
        // millpond reflecting the moon
        d.ellipse(230, 118, 80, 12, 4); d.ellipse(246, 118, 30, 4, 8); d.ellipse(246, 118, 12, 2, 'W');
        for (let i = 0; i < 6; i++) d.line(200 + i * 14 + Math.sin(t + i) * 2, 114 + (i % 3) * 5, 210 + i * 14 + Math.sin(t + i) * 2, 114 + (i % 3) * 5, 'B');
        // the willow, and comfrey at the foot of the wall
        d.line(40, 110, 46, 50, 'W', 3);
        for (let i = 0; i < 14; i++) d.line(46, 52, 20 + i * 4, 110 + Math.sin(t + i) * 2, 'W');
        for (let i = 0; i < 6; i++) sprig(d, 100 + i * 7, 112, 6);
        fog(d, t, 118, 10, 3);
    },
    mill(d, t, S) {
        stones(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); stones(d, 0, 100, W, 36, 3); d.line(0, 100, W, 100, 'W');
        for (let i = 0; i < 3; i++) d.rect(i * 120 + 10, 0, 10, 100, 'B');
        // the slit, a thin beam of moon through the flour
        d.rect(270, 16, 4, 30, 'W'); d.poly([[272, 46], [276, 46], [220, 124], [150, 124]], 6, null);
        for (let i = 0; i < 40; i++) { const x = 150 + hash3(1, i, 0) * 120 + Math.sin(t * 0.5 + i) * 4, y = 20 + ((hash3(1, i, 1) * 110 + t * 6) % 100); d.rect(x, y, 1, 1, 'W'); }
        // sacks, slashed; a ladder to the loft; the cold hearth
        for (let i = 0; i < 4; i++) { d.poly([[40 + i * 22, 112], [44 + i * 22, 88], [58 + i * 22, 88], [62 + i * 22, 112]], 'B', 'W'); d.line(48 + i * 22, 92, 56 + i * 22, 108, 'W'); }
        d.line(238, 100, 238, 20, 'W', 2); d.line(252, 100, 252, 20, 'W', 2); for (let i = 0; i < 9; i++) d.line(238, 26 + i * 8, 252, 26 + i * 8, 'W');
        d.frame(12, 56, 40, 40, 'B'); d.rect(16, 62, 32, 34, 'B');
    },
    oak(d, t, S) {
        night(d, t, 0, 3); stars(d, 25, 60, 70, t); moon(d, 238, 34, 22);
        hills(d, [[0, 104], [90, 96], [180, 104], [320, 98]], 3);
        // the great oak, wide as a house, with ropes
        d.poly([[128, 112], [140, 70], [152, 20], [172, 20], [186, 70], [200, 112]], 'B', 'W');
        const sway = Math.sin(t * 1.2) * 1.5;
        tree(d, 164, 108, 150, 7, 0);
        for (const [rx, ry] of [[100, 54], [214, 48], [80, 70], [236, 70]]) { d.line(rx, ry, rx + sway, ry + 28, 'W'); d.ellipse(rx + sway, ry + 31, 3, 4, null, 'W'); }
        ground(d, 108, 2);
        for (let i = 0; i < 9; i++) sprig(d, 132 + i * 9, 118, 8 + (i % 3) * 2);
        fog(d, t, 112, 12, 3);
    },
    gate(d, t, S) {
        night(d, t, 0, 4); stars(d, 29, 40, 40, t); moon(d, 60, 24, 11);
        // the town through the arch: roofs and lights
        d.rect(100, 24, 120, 90, 3);
        for (let i = 0; i < 8; i++) { const x = 104 + i * 14, h = 26 + (i * 17) % 24; d.poly([[x, 100], [x, 100 - h], [x + 7, 100 - h - 8], [x + 14, 100 - h], [x + 14, 100]], 'B', 'W'); window_(d, x + 3, 100 - h + 6, 4, 5, true, t, false); }
        // the black toothy gate and wall
        d.rect(0, 40, 90, 80, 'B'); stones(d, 0, 52, 90, 68, 2); d.rect(230, 40, 90, 80, 'B'); stones(d, 230, 52, 90, 68, 2);
        for (let i = 0; i < 7; i++) { d.rect(i * 14, 40, 8, 12, 'B'); d.line(i * 14, 40, i * 14 + 8, 40, 'W'); d.rect(232 + i * 14, 40, 8, 12, 'B'); }
        arch(d, 84, 24, 152, 96, null);
        d.rect(84, 22, 152, 4, 'W');
        // the banner
        d.poly([[158, 26], [180, 26], [180, 60], [169, 52], [158, 60]], 'B', 'W'); crow(d, 169, 40, 0);
        ground(d, 114, 3); d.rect(0, 114, W, 22, 'B'); d.grad(0, 114, W, 22, 3, 1);
        // the brazier
        d.poly([[44, 118], [60, 118], [56, 106], [48, 106]], 'B', 'W'); flame(d, 52, 106, 5, t, 4); flame(d, 48, 106, 4, t, 6); lampLight(d, 52, 104, 22, t);
        // the barrel and the flask on its hook
        barrel(d, 236, 100, 22, 22); d.line(266, 84, 266, 92, 'W'); d.frame(263, 92, 6, 10, 4);
        // Dray
        if (S.gateOpen) { d.text('z', 246, 76 + Math.sin(t * 2) * 2, 8, 'W'); d.text('Z', 252, 66 + Math.sin(t * 2 + 1) * 2, 8, 'W'); }
    },
    square(d, t, S) {
        night(d, t, 0, 3); stars(d, 33, 50, 50, t); moon(d, 40, 20, 10);
        // the infirmary on the hill, windows burning
        d.poly([[0, 76], [60, 56], [150, 50], [260, 56], [320, 76], [320, 100], [0, 100]], 3, null);
        d.rect(100, 34, 120, 56, 'B'); d.line(100, 34, 220, 34, 'W'); d.poly([[96, 34], [160, 14], [224, 34]], 'B', 'W');
        for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) window_(d, 108 + i * 22, 42 + r * 22, 10, 14, true, t, false);
        d.rect(150, 70, 20, 20, 'B'); d.frame(150, 70, 20, 20, 'B'); // the door
        // the chapel tower on the left
        d.rect(14, 52, 28, 50, 'B'); d.line(14, 52, 42, 52, 'W'); d.poly([[12, 52], [28, 30], [44, 52]], 'B', 'W'); d.rect(25, 58, 6, 14, 'B'); d.frame(25, 58, 6, 14, 'B');
        // the cobbles and the statue
        ground(d, 100, 3);
        for (let r = 0; r < 4; r++) for (let i = 0; i < 18; i++) d.line(i * 20 + (r % 2) * 10, 104 + r * 9, i * 20 + (r % 2) * 10 + 12, 104 + r * 9, 3);
        d.poly([[146, 112], [174, 112], [170, 96], [150, 96]], 'B', 'W');
        d.rect(154, 70, 12, 26, 'B'); d.circle(160, 64, 4, 'B', 'W'); d.line(166, 74, 180, 62, 'W'); d.line(154, 74, 146, 84, 'W');
        // stalls with awnings, a fish-crate stack
        for (const x of [196, 244]) { d.poly([[x, 90], [x + 40, 90], [x + 46, 78], [x - 6, 78]], 'B', 'W'); for (let i = 0; i < 5; i++) d.line(x - 4 + i * 11, 78, x + i * 10, 90, 'W'); d.rect(x + 2, 90, 36, 14, 'B'); d.line(x + 2, 90, x + 2, 104, 'W'); d.line(x + 38, 90, x + 38, 104, 'W'); }
        crate(d, 222, 110, 14, 12); crate(d, 236, 110, 14, 12); crate(d, 228, 100, 14, 10);
        // lamp posts
        for (const x of [100, 290]) { d.line(x, 108, x, 74, 'W'); d.rect(x - 3, 68, 7, 8, 'B'); d.frame(x - 3, 68, 7, 8, 'B'); }
        fog(d, t, 116, 10, 3);
    },
    inn(d, t, S) {
        planks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); planks(d, 0, 100, W, 36, 3); d.line(0, 100, W, 100, 'W');
        for (let i = 0; i < 4; i++) d.rect(i * 92, 0, 10, 100, 'B'); d.rect(0, 0, W, 10, 'B'); d.line(0, 10, W, 10, 'W');
        // the fire on the right, and the corner by it
        d.frame(236, 44, 70, 58, 'B'); d.rect(244, 54, 54, 48, 'B'); flame(d, 258, 100, 7, t, 1); flame(d, 272, 100, 9, t, 2); flame(d, 286, 100, 6, t, 3); lampLight(d, 272, 90, 26, t);
        // the bar
        d.frame(20, 82, 130, 22, 'B'); d.line(20, 82, 150, 82, 'W', 2);
        for (let i = 0; i < 5; i++) { d.rect(30 + i * 22, 70, 5, 12, 'W'); d.rect(31 + i * 22, 72, 3, 8, 'B'); }
        d.rect(30, 30, 90, 3, 'W'); for (let i = 0; i < 6; i++) { d.frame(34 + i * 14, 18, 8, 12, 'B'); }
        window_(d, 180, 28, 36, 36, false, t);
        d.line(176, 66, 176, 100, 'W');
        // stair
        for (let i = 0; i < 7; i++) d.rect(190 + i * 5, 100 - i * 8, 46 - i * 5, 3, 'W');
    },
    apothecary(d, t, S) {
        bricks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); planks(d, 0, 100, W, 36, 2); d.line(0, 100, W, 100, 'W');
        // identical bottles, row on row
        for (let r = 0; r < 4; r++) { d.rect(10, 20 + r * 20, 300, 2, 'W'); for (let i = 0; i < 30; i++) { d.rect(12 + i * 10, 8 + r * 20, 6, 12, 'B'); d.rect(12 + i * 10, 8 + r * 20, 6, 12, 7); d.rect(14 + i * 10, 6 + r * 20, 2, 3, 'W'); } }
        d.rect(100, 20, 90, 70, 'B'); d.frame(100, 20, 90, 70, 'B'); // the glass case
        for (let i = 0; i < 8; i++) sprig(d, 108 + i * 10, 80, 20);
        // the counter and the till
        d.frame(0, 88, 320, 24, 'B'); d.line(0, 88, 320, 88, 'W', 2); d.frame(240, 78, 30, 10, 'W'); d.rect(244, 80, 22, 6, 'B'); d.line(256, 78, 256, 72, 'W'); d.circle(256, 70, 3, 'W');
        d.line(60, 88, 60, 66, 'W'); d.line(40, 66, 80, 66, 'W'); d.line(40, 66, 38, 74, 'W'); d.line(80, 66, 82, 74, 'W');
    },
    row(d, t, S) {
        night(d, t, 0, 3); stars(d, 37, 40, 40, t); moon(d, 270, 20, 9);
        // crooked houses leaning in
        d.poly([[0, 120], [0, 40], [30, 26], [76, 36], [76, 120]], 'B', 'W');
        d.poly([[200, 120], [204, 34], [250, 24], [320, 40], [320, 120]], 'B', 'W');
        d.poly([[80, 120], [84, 52], [112, 36], [150, 50], [152, 120]], 'B', 'W');
        window_(d, 14, 50, 14, 16, false, t); window_(d, 44, 50, 14, 16, true, t); window_(d, 96, 62, 14, 16, false, t); window_(d, 214, 46, 14, 16, false, t); window_(d, 270, 46, 14, 16, true, t);
        // the tanner's door and step, a window box of feverfew
        door_(d, 160, 76, 18, 44); d.frame(138, 70, 22, 18, 'B'); d.rect(136, 90, 26, 5, 'W'); for (let i = 0; i < 5; i++) { d.rect(138 + i * 5, 84, 3, 5, 'W'); }
        // washing across the lane
        d.line(30, 20, 130, 40, 'W'); for (let i = 0; i < 5; i++) d.poly([[44 + i * 18, 24 + i * 3], [54 + i * 18, 25 + i * 3], [54 + i * 18, 37 + i * 3], [44 + i * 18, 36 + i * 3]], 8, 'W');
        ground(d, 112, 2);
        d.rect(250, 98, 22, 22, 'B'); d.frame(250, 98, 22, 22, 'B'); // the back door of Pell's
        fog(d, t, 118, 8, 3);
    },
    store(d, t, S) {
        planks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); planks(d, 0, 100, W, 36, 3); d.line(0, 100, W, 100, 'W');
        for (let i = 0; i < 3; i++) d.rect(i * 110 + 10, 0, 10, 100, 'B');
        for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) crate(d, 16 + i * 26 + r * 12, 80 - r * 24, 24, 22);
        for (let i = 0; i < 4; i++) barrel(d, 200 + i * 28, 78 + (i % 2) * 12, 22, 30);
        d.line(184, 100, 160, 40, 'W', 2); for (let i = 0; i < 6; i++) d.line(182 - i * 3, 94 - i * 11, 164 - i * 3 + 14, 90 - i * 11, 'W');
        lantern(d, 120, 22, t, true);
    },
    chapel(d, t, S) {
        stones(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); d.rect(0, 100, W, 36, 3); d.line(0, 100, W, 100, 'W');
        for (let i = 0; i < 10; i++) d.line(0, 104 + i * 4, W, 104 + i * 4, 'B');
        // tall gothic window, tracery
        gothic(d, 120, 4, 80, 90, 'B'); gothic(d, 126, 10, 68, 80, 7);
        for (const x of [146, 160, 174]) d.line(x, 20, x, 90, 'B'); d.line(126, 60, 194, 60, 'B'); d.circle(160, 36, 12, null, 'B'); d.line(160, 24, 160, 48, 'B'); d.line(148, 36, 172, 36, 'B');
        d.poly([[128, 94], [192, 94], [230, 124], [90, 124]], 5, null);
        // altar and candle
        d.frame(138, 84, 44, 16, 'B'); candle(d, 160, 84, t); lampLight(d, 161, 76, 12, t);
        // pews in perspective
        for (let i = 0; i < 4; i++) { const y = 106 + i * 8, w = 60 + i * 20; d.frame(160 - 100 - i * 18, y, 80 + i * 14, 5 + i, 'B'); d.frame(160 + 20 + i * 4 + (i * 14 - i * 4) , y, 80 + i * 14, 5 + i, 'B'); }
        // the bell rope
        d.line(250, 0, 250, 78, 'W', 2); d.rect(246, 76, 8, 6, 'W');
    },
    crypt(d, t, S) {
        d.rect(0, 0, W, H, 'B'); stones(d, 0, 0, W, 104, 2); d.rect(0, 104, W, 32, 'B'); d.line(0, 104, W, 104, 'W');
        for (const x of [0, 80, 160, 240]) { arch(d, x + 8, 20, 62, 84, 'B'); d.rect(x + 12, 40, 54, 3, 'W'); d.rect(x + 12, 62, 54, 3, 'W'); d.rect(x + 12, 84, 54, 3, 'W'); for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) d.frame(x + 14 + i * 13, 28 + k * 22, 11, 12, 'B'); }
        // the salters' door
        d.frame(262, 44, 42, 60, 'B'); for (let i = 0; i < 4; i++) d.line(262, 52 + i * 14, 304, 52 + i * 14, 'W'); d.circle(296, 76, 2, 'W'); d.rect(270, 62, 10, 6, 'W');
        const dr = (t * 40 | 0) % 60; d.rect(100 + 0, 30 + dr, 1, 3, 'W');
        if (S && S.lantern) lampLight(d, 90, 92, 28, t);
    },
    infirmary(d, t, S) {
        d.rect(0, 0, W, 136, 'B'); d.rect(0, 0, W, 94, 7); d.rect(0, 94, W, 42, 'B');
        // checker floor in perspective
        for (let r = 0; r < 6; r++) for (let i = -6; i < 14; i++) { const y = 96 + r * 7, x = 160 + (i - 4) * (14 + r * 3); if ((i + r) % 2) d.poly([[x, y], [x + 14 + r * 3, y], [x + 17 + r * 3, y + 7], [x + 3, y + 7]], 'W', null); }
        for (const x of [20, 110, 200, 290]) column(d, x, 14, 14, 82);
        // the chandelier
        d.line(160, 0, 160, 14, 'W'); d.ellipse(160, 20, 28, 5, null, 'W'); for (let i = 0; i < 6; i++) { d.rect(134 + i * 10, 14, 2, 6, 'W'); flame(d, 135 + i * 10, 14, 1.4, t, i); } lampLight(d, 160, 22, 14, t);
        // banner, and the desk
        d.poly([[44, 20], [82, 20], [82, 62], [63, 52], [44, 62]], 'B', 'W'); d.text('H', 59, 30, 12, 'W');
        d.frame(196, 80, 60, 18, 'B'); d.line(196, 80, 256, 80, 'W', 2); d.rect(206, 74, 10, 6, 'W');
        // the doors to the ward
        d.frame(130, 32, 40, 64, 'B'); d.line(150, 32, 150, 96, 'W'); d.rect(138, 24, 24, 6, 'W');
        // folding screen and palms
        for (let i = 0; i < 3; i++) d.frame(34 + i * 12, 78, 12, 24, 4);
    },
    ward(d, t, S) {
        d.rect(0, 0, W, 136, 'B'); d.rect(0, 0, W, 96, 6); d.rect(0, 96, W, 40, 'B');
        // tall windows down the far wall, and beds receding
        for (let i = 0; i < 4; i++) { gothic(d, 40 + i * 62, 14, 28, 52, 'B'); d.rect(40 + i * 62 + 4, 40, 20, 18, 12); }
        for (let side = 0; side < 2; side++) for (let i = 0; i < 5; i++) { const s = 0.5 + i * 0.28, x = side ? 190 + i * 24 : 130 - i * 24 - 60 * s + 60, y = 100 + i * 7; d.frame(x - 20 * s, y - 14 * s, 50 * s, 14 * s, 'B'); d.rect(x - 18 * s, y - 20 * s, 14 * s, 8 * s, 'W'); d.rect(x + 20 * s, y - 6 * s, 6 * s, 6 * s, 'W'); }
        d.poly([[130, 96], [190, 96], [260, 136], [60, 136]], 2, null);
        d.line(130, 96, 60, 136, 'W'); d.line(190, 96, 260, 136, 'W');
        lantern(d, 160, 12, t, true);
    },
    dispensary(d, t, S) {
        d.rect(0, 0, W, 136, 'B'); bricks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); d.line(0, 100, W, 100, 'W');
        for (let r = 0; r < 5; r++) { d.rect(0, 16 + r * 18, 130, 2, 'W'); d.rect(190, 16 + r * 18, 130, 2, 'W'); for (let i = 0; i < 12; i++) { d.frame(4 + i * 10, 4 + r * 18, 8, 12, 'B'); d.rect(6 + i * 10, 6 + r * 18, 4, 5, 9); d.frame(194 + i * 10, 4 + r * 18, 8, 12, 'B'); d.rect(196 + i * 10, 6 + r * 18, 4, 5, 9); } }
        d.poly([[136, 100], [136, 82], [186, 74], [186, 100]], 'B', 'W'); d.rect(140, 74, 40, 6, 'W'); // the slanted desk, the book
        d.frame(144, 68, 32, 8, 8);
        d.frame(132, 24, 56, 50, 'B'); d.rect(150, 34, 20, 8, 'W'); d.text('DR C VESPER', 136, 46, 6, 'W');
        d.frame(100, 104, 40, 24, 'B'); // stairs down
    },
    office(d, t, S) {
        d.rect(0, 0, W, 136, 'B'); planks(d, 0, 0, W, 100, 2); d.rect(0, 100, W, 36, 'B'); d.line(0, 100, W, 100, 'W');
        // anatomy plates, a portrait glowing a little
        for (let i = 0; i < 3; i++) { d.frame(20 + i * 30, 20, 24, 32, 7); d.line(32 + i * 30, 26, 32 + i * 30, 46, 'B'); d.circle(32 + i * 30, 26, 3, null, 'B'); }
        d.frame(200, 20, 36, 44, 'B'); d.frame(204, 24, 28, 36, 5 + (Math.sin(t * 2) > 0 ? 1 : 0)); d.circle(214, 40, 4, 'W'); d.circle(226, 42, 3, 'W'); d.poly([[208, 60], [216, 48], [222, 60]], 'W', null);
        // desk with a green-shaded lamp, a cabinet
        d.frame(100, 82, 90, 8, 'B'); d.line(100, 82, 190, 82, 'W', 2); d.rect(104, 90, 6, 14, 'W'); d.rect(180, 90, 6, 14, 'W'); d.rect(130, 86, 24, 4, 'B'); d.line(142, 86, 142, 90, 'W');
        d.poly([[148, 66], [166, 66], [160, 78], [152, 78]], 10, 'W'); d.line(156, 78, 156, 82, 'W'); lampLight(d, 157, 80, 16, t);
        d.frame(260, 40, 40, 64, 'B'); d.line(280, 40, 280, 104, 'W'); for (let i = 0; i < 4; i++) d.line(266, 54 + i * 12, 276, 54 + i * 12, 'W');
        sprig(d, 80, 104, 14);
    },
    cellar(d, t, S) {
        d.rect(0, 0, W, H, 'B');
        bricks(d, 0, 0, W, 106, 2);
        for (const x of [0, 108, 216]) { d.poly([[x, 0], [x + 12, 0], [x + 54, 40], [x + 96, 0], [x + 108, 0], [x + 108, 106], [x, 106]], 'B', null); d.line(x + 12, 0, x + 54, 40, 'W'); d.line(x + 96, 0, x + 54, 40, 'W'); }
        d.rect(0, 106, W, 30, 'B'); d.line(0, 106, W, 106, 'W');
        for (let i = 0; i < 5; i++) { barrel(d, 8 + i * 26, 78, 22, 28); }
        for (let i = 0; i < 3; i++) crate(d, 160 + i * 20, 90, 18, 16);
        // the rails, running to the iron door
        d.line(0, 128, 260, 112, 'W'); d.line(0, 136, 262, 118, 'W'); for (let i = 0; i < 8; i++) d.line(20 + i * 30, 130 - i * 2, 14 + i * 30, 138 - i * 2, 'W');
        d.frame(262, 56, 44, 56, 'B'); d.poly([[262, 56], [284, 40], [306, 56]], 'B', 'W');
        for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) d.rect(268 + i * 8, 64 + j * 16, 2, 2, 'W'); d.circle(278, 88, 3, null, 'W');
        if (S && S.lantern) lampLight(d, 90, 84, 32, t);
    },
    tunnel(d, t, S) {
        d.rect(0, 0, W, H, 'B');
        // a perspective tunnel: nested arches shrinking to the vault door, salt crystals sparkling
        for (let i = 0; i < 7; i++) {
            const k = i / 7, w = 320 - k * 270, h = 136 - k * 100, x = (W - w) / 2, y = 4 + k * 38;
            d.poly([[x, y + h], [x, y + 20], [x + w * 0.2, y], [x + w * 0.8, y], [x + w, y + 20], [x + w, y + h]], 'B', 'W');
            d.line(x + w * 0.2, y, x + w * 0.2 + 2, y + 6, 'W');
        }
        d.rect(148, 52, 24, 50, 'B'); d.frame(148, 52, 24, 50, 'B'); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) d.rect(152 + i * 8, 58 + j * 10, 2, 2, 'W'); d.rect(166, 78, 4, 6, 'W');
        for (let i = 0; i < 24; i++) { const x = hash3(5, i, 0) * W, y = hash3(5, i, 1) * 110; if (Math.sin(t * 3 + i * 5) > 0.3) { d.rect(x, y, 1, 1, 'W'); if (i % 5 === 0) { d.rect(x - 1, y, 3, 1, 'W'); d.rect(x, y - 1, 1, 3, 'W'); } } }
        d.line(60, 136, 150, 100, 'W'); d.line(260, 136, 170, 100, 'W'); d.line(90, 136, 154, 100, 'W'); d.line(230, 136, 166, 100, 'W');
        d.rect(0, 112, W, 24, 'B'); // keeps the near floor dark
        if (S && S.lantern) lampLight(d, 120, 80, 30, t);
    },
    vaults(d, t, S) {
        d.rect(0, 0, W, H, 'B');
        d.grad(0, 0, W, 100, 1, 5);
        for (let i = 0; i < 6; i++) { const x = 18 + i * 56, k = i % 2; column(d, x, 6, 16 + k * 2, 100); d.line(x + 8, 6, x + 8, 100, 4); }
        for (let i = 0; i < 7; i++) d.line(8 + i * 52, 0, 40 + i * 52, 14, 'W');
        d.rect(0, 100, W, 36, 'B'); d.grad(0, 100, W, 36, 3, 1); d.line(0, 100, W, 100, 'W');
        for (let i = 0; i < 16; i++) { const x = 6 + i * 20, y = 108 + (i * 7) % 20; d.line(x, y, x + 12 + Math.sin(t + i) * 2, y, 6); }
        // the cell gate to the left, the red arch to the right
        bars(d, 6, 40, 50, 60, 5); d.line(6, 40, 56, 40, 'W');
        arch(d, 258, 30, 54, 70, 'B'); d.rect(262, 44, 46, 56, 13); lampLight(d, 285, 70, 26, t); flame(d, 280, 100, 8, t, 1); flame(d, 294, 100, 6, t, 2);
        d.line(144, 20, 144, 34, 'W'); d.rect(140, 34, 8, 2, 'W'); d.circle(144, 38, 3, null, 'W'); // the keys on the pillar hook
        for (const x of [90, 210]) { d.line(x, 14, x, 24, 'W'); d.poly([[x - 4, 24], [x + 4, 24], [x + 2, 32], [x - 2, 32]], 'B', 'W'); flame(d, x, 24, 2, t, x); lampLight(d, x, 28, 10, t); }
    },
    cells(d, t, S) {
        d.rect(0, 0, W, H, 'B'); stones(d, 0, 0, W, 106, 2); d.rect(0, 106, W, 30, 'B'); d.line(0, 106, W, 106, 'W');
        for (let i = 0; i < 4; i++) {
            const x = 4 + i * 78; d.frame(x, 22, 72, 84, 'B'); d.rect(x + 3, 26, 66, 78, 'B'); d.rect(x + 3, 96, 66, 8, 4);
            bars(d, x + 3, 26, 66, 78, 6); d.line(x + 3, 26, x + 69, 26, 'W');
        }
        // the four cells: Marga lying, Dunmore upright with a ladle, Harrow flushed, the twins in collars
        d.poly([[14, 100], [20, 92], [60, 92], [66, 100]], 8, 'W'); d.circle(18, 92, 4, 'W'); d.poly([[20, 90], [64, 90], [64, 94], [20, 94]], 'B', 'W');
        d.poly([[100, 104], [102, 76], [126, 76], [128, 104]], 'B', 'W'); d.circle(114, 70, 4, 'W'); d.rect(112, 69, 2, 2, 'B'); d.rect(116, 69, 2, 2, 'B'); d.line(130, 98, 140, 84, 'W');
        d.poly([[176, 104], [178, 80], [204, 80], [206, 104]], 'B', 'W'); d.circle(191, 74, 4, 'W'); for (let i = 0; i < 4; i++) d.rect(180 + i * 6, 88 + (i % 2) * 4, 2, 2, 'W');
        for (const x of [252, 280]) { d.poly([[x - 7, 104], [x - 5, 78], [x + 5, 78], [x + 7, 104]], 'B', 'W'); d.circle(x, 72, 3.5, 'W'); d.rect(x - 4, 76, 8, 3, 'B'); d.rect(x - 4, 76, 8, 1, 'W'); }
        lantern(d, 160, 14, t);
    },
    works(d, t, S) {
        d.rect(0, 0, W, H, 'B'); d.grad(0, 0, W, 100, 2, 8);
        for (let i = 0; i < 6; i++) d.line(i * 70 - 20, 0, i * 70 + 40, 40, 'W');
        d.rect(0, 100, W, 36, 'B'); d.grad(0, 100, W, 36, 6, 2); d.line(0, 100, W, 100, 'W');
        // the furnaces and pans
        for (const x of [10, 238]) { d.frame(x, 62, 72, 38, 'B'); d.rect(x + 8, 74, 56, 26, 'B'); flame(d, x + 22, 100, 6, t, x); flame(d, x + 40, 100, 8, t, x + 1); flame(d, x + 56, 100, 5, t, x + 2); d.ellipse(x + 36, 62, 36, 6, 6, 'W'); for (let i = 0; i < 4; i++) d.circle(x + 20 + i * 10, 54 - ((t * 20 + i * 9) % 22), 2 + i % 2, 5, null); }
        // the ward-stone, ringed in iron, pulsing grey
        const g = 6 + Math.sin(t * 2) * 2; d.circle(160, 66, 40, 3); d.circle(160, 66, 30, g);
        d.poly([[146, 104], [150, 30], [160, 14], [170, 30], [174, 104]], 'W', 'B'); d.line(152, 40, 158, 100, 'B'); d.line(166, 30, 170, 100, 'B');
        for (const y of [44, 64, 84]) { d.rect(144, y, 32, 4, 'B'); d.line(144, y, 176, y, 'W'); d.rect(158, y, 4, 4, 'W'); }
        // the long table, the teapot, Vesper's ledger
        d.frame(104, 100, 112, 6, 'B'); d.line(104, 100, 216, 100, 'W', 2); d.rect(130, 94, 10, 6, 'W'); d.rect(140, 96, 4, 2, 'W'); d.rect(176, 94, 8, 6, 'W');
    },
};

/** Draw one frame of a scene into ctx (320×136). */
export function drawScene(ctx, S, t) {
    const d = makePainter(ctx);
    ctx.imageSmoothingEnabled = false;
    d.rect(0, 0, W, H, 'B');
    const fn = SCENES[S.art] || SCENES.cottage;
    fn(d, t, S);
    return d;
}

/** The people on top of the picture. */
export function drawActors(ctx, S, t) {
    const d = makePainter(ctx);
    const floorY = ['inn', 'apothecary', 'store', 'cottage', 'stillroom', 'chapel', 'crypt', 'cellar', 'dispensary', 'office', 'infirmary', 'ward', 'tunnel', 'vaults', 'cells', 'works', 'mill'].includes(S.art) ? 126 : 124;
    // the folk of the place, behind the player
    for (const n of S.npcs) {
        if (S.art === 'works' && n.id === 'vesper') { person(d, n.x, floorY - 18, 'doctor', t); continue; }
        if (S.art === 'cells' && ['marga', 'dunmore', 'harrow', 'twins'].includes(n.id)) continue; // drawn into the cells
        if (n.kind === 'ghost') { person(d, n.x, floorY - 4, 'ghost', t); continue; }
        if (n.kind === 'crow') { crow(d, 36, 56, t); continue; }
        if (n.party) continue;
        const sleeping = n.id === 'dray' && S.gateOpen;
        person(d, n.x, floorY - (n.kind === 'child' ? -2 : 0), sleeping ? 'bailiff' : n.kind, t, { flip: true });
    }
    // the player and the company she keeps
    let px = 74;
    const party = S.npcs.filter((n) => n.party);
    elspeth(d, px, floorY, t, S);
    party.slice(0, 5).forEach((n, i) => person(d, px - 22 - i * 16, floorY - 2 + (i % 2) * 1, n.kind, t));
}

/** Darkness, dread, and the final one-bit pass. */
export function finish(ctx, S, t) {
    const d = makePainter(ctx);
    // darkness: only the lantern's circle shows
    if (S.dark) {
        const lit = S.lantern;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        if (!lit) { d.rect(0, 0, W, H, 'B'); }
        ctx.restore();
    }
    // dread: the black creeps in from the edges, and something watches from it
    if (S.dread > 30) {
        const k = (S.dread - 30) / 70;
        const w = 6 + k * 40;
        for (let i = 0; i < w; i += 3) { const lv = 16 - (i / w) * 16; d.rect(0, 0, 3 + w - i, H, 'B'); }
    }
    // threshold to strict one-bit
    const im = ctx.getImageData(0, 0, W, H), p = im.data;
    for (let i = 0; i < p.length; i += 4) {
        const v = (p[i] + p[i + 1] + p[i + 2]) / 3 > 110 ? 240 : 0;
        p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    // the eyes in the dark: drawn after the threshold, two pale dots, blinking
    if (S.dread > 60) {
        const bl = Math.sin(t * 0.7) > 0.93;
        const ex = 20 + (Math.floor(t / 6) % 2) * 250, ey = 38 + (Math.floor(t / 6) % 3) * 12;
        if (!bl) { ctx.fillStyle = WHITE; ctx.fillRect(ex, ey, 2, 1); ctx.fillRect(ex + 6, ey, 2, 1); }
    }
}

export const SCENE_IDS = Object.keys(SCENES);
export const SCENE_SIZE = { w: W, h: H };
