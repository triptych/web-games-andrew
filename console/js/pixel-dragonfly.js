// The dragonfly as an 8-bit pet: a side view, facing right, drawn in code on
// a 36×24 pixel grid in its own colours from the Garden (body, wings, eyes and
// what it wears, from garden.companion). Shapes are rasterised a pixel at a
// time, then the body gets a dark outline. Three wing frames for the flap and
// a few faces: open, happy, sleepy, sad and eating. Also the pixel snacks, a
// heart, a "z" and a "!".
//
// On the Pocket LCD screen tint everything is quantised to its four greens.
// Each sprite is drawn once and kept (sprite() caches by its options).

import { BODIES, WINGS, ACCESSORIES } from '../../garden/js/dragonfly-talk.js';

export const W = 36;
export const H = 24;
const OUTLINE = [14, 16, 22, 255];
const PAPER = [
    [212, 226, 180],
    [143, 160, 112],
    [74, 91, 53],
    [31, 44, 23],
];

function hex(h, a = 255) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** The look from the companion's memory: { body, wings, acc } entries from dragonfly-talk.js. */
export function lookOf(mem) {
    const L = mem?.look || {};
    const acc = ACCESSORIES.find((a) => a.id === L.acc && (!a.unlock || a.unlock({ games: {}, places: {}, visits: 0, ...mem })));
    return {
        body: BODIES.find((b) => b.id === L.body) || BODIES[0],
        wings: WINGS.find((w) => w.id === L.wings) || WINGS[0],
        acc: acc?.id || 'none',
    };
}

class Grid {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.px = new Uint8ClampedArray(w * h * 4);
        this.mask = new Uint8Array(w * h); // 1: body (gets the outline)
    }
    set(x, y, c, body = false) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 4;
        const a = c[3] / 255;
        if (a >= 1 || this.px[i + 3] === 0) {
            this.px.set(c, i);
        } else {
            // over something already there: blend
            for (let k = 0; k < 3; k++) this.px[i + k] = this.px[i + k] * (1 - a) + c[k] * a;
            this.px[i + 3] = Math.max(this.px[i + 3], c[3]);
        }
        if (body) this.mask[y * this.w + x] = 1;
    }
    /** A filled ellipse at (cx, cy), radii rx × ry, turned by `rot`; `paint(x, y, u, v)` picks each pixel's colour. */
    ellipse(cx, cy, rx, ry, rot, paint, body = false) {
        const c = Math.cos(rot), s = Math.sin(rot);
        const r = Math.ceil(Math.max(rx, ry)) + 1;
        for (let y = Math.floor(cy - r); y <= cy + r; y++) {
            for (let x = Math.floor(cx - r); x <= cx + r; x++) {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
                if (u * u + v * v <= 1) {
                    const col = paint(x, y, u, v);
                    if (col) this.set(x, y, col, body);
                }
            }
        }
    }
    outline() {
        const { w, h, mask } = this;
        const add = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (mask[y * w + x]) continue;
                if ((x > 0 && mask[y * w + x - 1]) || (x < w - 1 && mask[y * w + x + 1]) || (y > 0 && mask[(y - 1) * w + x]) || (y < h - 1 && mask[(y + 1) * w + x])) add.push([x, y]);
            }
        }
        for (const [x, y] of add) this.set(x, y, OUTLINE);
    }
    canvas(paper) {
        const cv = document.createElement('canvas');
        cv.width = this.w;
        cv.height = this.h;
        const px = this.px;
        if (paper) {
            for (let i = 0; i < px.length; i += 4) {
                if (!px[i + 3]) continue;
                const l = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
                const c = PAPER[Math.min(3, Math.max(0, Math.round((1 - l) * 3.3 - 0.2)))];
                px[i] = c[0];
                px[i + 1] = c[1];
                px[i + 2] = c[2];
                px[i + 3] = px[i + 3] < 200 ? 170 : 255;
            }
        }
        cv.getContext('2d').putImageData(new ImageData(px, this.w, this.h), 0, 0);
        return cv;
    }
}

// wing angles (radians from pointing forward; negative is up) for the three frames of a beat
const BEAT = [
    [-1.75, -2.05],
    [-2.45, -2.7],
    [-2.95, 3.0],
];

/**
 * The pet. opts: { look ({ body, wings, acc }), frame (0..2 wings up to down), face ('open' | 'happy' |
 * 'sleep' | 'sad' | 'eat'), paper (the Pocket LCD greens) }. Returns a 36×24 canvas.
 */
function draw({ look, frame = 0, face = 'open', paper = false }) {
    const g = new Grid(W, H);
    const A = hex(look.body.a), B = hex(look.body.b), EYE = hex(look.body.eye);
    const WT = hex(look.wings.tint, 140), WE = hex(look.wings.tip, 235);
    const rainbow = look.wings.iri > 0.9;
    const RAIN = ['#ff6b8a', '#ffb347', '#fff26b', '#6bff9e', '#6bd6ff', '#b28bff'].map((h) => hex(h, 150));

    // wings: the far pair first, then the near pair (each a long ellipse from the shoulder)
    const sx = 19.5, sy = 9.5;
    const [fa, ha] = BEAT[frame % 3];
    const wing = (ang, len, wid, far) => {
        const cx = sx + Math.cos(ang) * len * 0.5, cy = sy + Math.sin(ang) * len * 0.5;
        g.ellipse(cx, cy, len * 0.5, wid, ang, (x, y, u, v) => {
            const edge = u * u + v * v > 0.6 || u > 0.7;
            let c = edge ? WE : WT;
            if (rainbow) c = RAIN[Math.min(5, Math.max(0, Math.floor((u + 1) * 3)))];
            return far ? [c[0], c[1], c[2], Math.round(c[3] * 0.65)] : c;
        });
    };
    wing(fa + 0.2, 13, 2.9, true);
    wing(ha + 0.22, 12, 2.8, true);

    // the abdomen: banded, tapering, its tip curling up a little
    for (let x = 4; x <= 18; x++) {
        const k = (18 - x) / 14;
        const y = 13 - k * k * 3;
        const band = Math.floor(x / 3) % 2 ? A : B;
        g.ellipse(x, y + 0.5, 0.8, 1.75 - k * 0.75, 0, () => band, true);
    }
    // thorax and head (a big head: it is a pet)
    g.ellipse(20.2, 12.7, 3.8, 3.4, 0, (x, y, u, v) => (v > 0.4 ? B : A), true);
    g.ellipse(26.6, 11, 4.7, 4.5, 0, (x, y, u, v) => (v > 0.45 ? A : B), true);
    // legs
    for (const [x, y] of [[19, 16], [18, 17], [21, 16], [21, 17], [23, 16], [24, 17]]) g.set(x, y, OUTLINE, true);
    g.outline();

    // the near wings, over the body's outline
    wing(fa, 14, 3.1, false);
    wing(ha, 13, 3.0, false);

    // the face: one big eye (it is seen from the side)
    const ex = 28.2, ey = 9.8;
    if (face === 'sleep') {
        for (const [x, y] of [[25, 10], [26, 11], [27, 11], [28, 11], [29, 11], [30, 10]]) g.set(x, y, OUTLINE);
    } else if (face === 'happy') {
        for (const [x, y] of [[25, 11], [26, 10], [26, 9], [27, 8], [28, 8], [29, 8], [30, 9], [30, 10], [31, 11]]) g.set(x, y, OUTLINE);
        for (const [x, y] of [[27, 9], [28, 9], [29, 9]]) g.set(x, y, EYE);
    } else {
        g.ellipse(ex, ey, 3.3, 3.2, 0, () => EYE);
        for (const [x, y] of [[27, 8], [28, 8], [27, 9]]) g.set(x, y, [255, 255, 255, 255]);
        g.set(29, 11, [255, 255, 255, 140]);
        if (face === 'sad') {
            for (const [x, y] of [[25, 6], [26, 6], [27, 5], [28, 5]]) g.set(x, y, OUTLINE);
            g.set(29, 14, [130, 210, 255, 255]);
            g.set(29, 15, [130, 210, 255, 190]);
        }
    }
    // mouth (and a blush)
    if (face === 'eat') {
        for (const [x, y] of [[29, 13], [30, 13], [31, 13], [30, 14], [31, 14]]) g.set(x, y, [70, 12, 24, 255]);
    } else {
        g.set(30, 14, OUTLINE);
        g.set(31, 13, OUTLINE);
    }
    if (face === 'happy' || face === 'eat') {
        g.set(25, 13, [255, 120, 150, 230]);
        g.set(26, 13, [255, 120, 150, 160]);
    }

    // what it wears
    const acc = look.acc;
    const K = [22, 22, 28, 255];
    if (acc === 'tophat') {
        for (let x = 22; x <= 30; x++) g.set(x, 6, K);
        for (let y = 0; y <= 5; y++) for (let x = 23; x <= 29; x++) g.set(x, y, y === 4 ? B : K);
    } else if (acc === 'crown') {
        [['#ff8fc8', 22, 7], ['#fff27a', 24, 6], ['#ffffff', 26, 5], ['#b79bff', 28, 5], ['#ff9a5a', 30, 6]].forEach(([c, x, y]) => {
            g.set(x, y, hex(c));
            g.set(x + 1, y, hex(c));
            g.set(x, y + 1, hex(c));
            g.set(x + 1, y + 1, hex(c));
        });
    } else if (acc === 'scarf') {
        for (let y = 9; y <= 16; y++) g.set(23, y, hex('#d8344a'));
        for (let y = 10; y <= 15; y++) g.set(22, y, hex('#e04a5e'));
        for (const [x, y] of [[21, 16], [20, 17], [19, 18]]) g.set(x, y, hex('#b02238'));
    } else if (acc === 'bowtie') {
        for (const [x, y] of [[22, 12], [22, 13], [22, 14], [22, 15], [23, 13], [23, 14], [24, 14], [25, 13], [25, 14], [26, 12], [26, 13], [26, 14], [26, 15], [25, 15]]) g.set(x, y, hex('#c8203a'));
        g.set(24, 14, hex('#8a1024'));
    } else if (acc === 'glasses') {
        for (let a = 0; a < 28; a++) {
            const t = (a / 28) * Math.PI * 2;
            g.set(ex + Math.cos(t) * 3.9 - 0.5, ey + Math.sin(t) * 3.8 - 0.5, hex('#2a1a0a'));
        }
        g.set(24, 9, hex('#2a1a0a'));
        g.set(23, 9, hex('#2a1a0a'));
    } else if (acc === 'lantern') {
        g.set(21, 17, hex('#555555'));
        g.set(21, 18, hex('#555555'));
        for (const [x, y] of [[20, 19], [21, 19], [22, 19], [20, 20], [21, 20], [22, 20]]) g.set(x, y, hex('#ffd48a'));
        g.set(21, 21, hex('#c08030'));
    }
    return g.canvas(paper);
}

const cache = new Map();

/** The pet's sprite (cached). See draw() for the options. */
export function sprite(opts) {
    const L = opts.look;
    const key = [L.body.id, L.wings.id, L.acc, opts.frame || 0, opts.face || 'open', opts.paper ? 1 : 0].join('|');
    let cv = cache.get(key);
    if (!cv) {
        cv = draw(opts);
        cache.set(key, cv);
        if (cache.size > 120) cache.delete(cache.keys().next().value);
    }
    return cv;
}

/** A data: URL of the sprite, for <img> (the menu, the launch screen, the hint page). */
export function spriteURL(opts) {
    return sprite(opts).toDataURL();
}

// ---------------------------------------------------------------- little pixel things

const ICON_ART = {
    midge: ['........', '.w...w..', '..w.w...', '...kk...', '..kkkk..', '...kk...', '..k..k..', '........'],
    dew: ['...b....', '...b....', '..bbb...', '.bwbbb..', '.bbbbb..', '.bbbbb..', '..bbb...', '........'],
    pollen: ['..y.y...', '.yyyyy..', 'yyyoyyy.', '.yyyyyy.', 'yyyyyyy.', '.yyoyy..', '..y.y...', '........'],
    honey: ['...k....', '..ooo...', '.oyyoo..', '.oywoo..', '.ooooo..', '..ooo...', '........', '........'],
    moonberry: ['....g...', '...gg...', '..pppp..', '.ppwppp.', '.pppppp.', '.pppppp.', '..pppp..', '........'],
    heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    z: ['zzzz', '..z.', '.z..', 'zzzz'],
    bang: ['x', 'x', 'x', '.', 'x'],
    spark: ['.s.', 'sss', '.s.'],
};
const ICON_COLOURS = {
    w: '#cfe8ff', k: '#2a2a2a', b: '#5ab8ff', y: '#ffe14a', o: '#e89a1a', p: '#8b5bd6', g: '#3fbf5a', r: '#ff5a8a', s: '#fff6b0',
};
const ICON_OVER = { honey: { y: '#ffc84a', w: '#fff3c0', k: '#7a4a10' }, pollen: { o: '#ffb020' }, moonberry: { w: '#e0d0ff' }, dew: { w: '#ffffff' } };

/** A pixel icon: a snack (by its id in dragonfly-talk.js), 'heart', 'z', 'bang' or 'spark'. `ink` paints it all one colour. */
export function icon(id, { paper = false, ink = null } = {}) {
    const key = `icon|${id}|${paper ? 1 : 0}|${ink || ''}`;
    let cv = cache.get(key);
    if (cv) return cv;
    const art = ICON_ART[id] || ICON_ART.spark;
    const g = new Grid(art[0].length, art.length);
    art.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = ink || ICON_OVER[id]?.[ch] || ICON_COLOURS[ch] || '#ffffff';
        g.set(x, y, hex(c));
    }));
    cv = g.canvas(paper && !ink);
    cache.set(key, cv);
    return cv;
}
