// All the pictures, drawn in code: the 24 glyphs that float in the crystal ball, and the 22 tarot cards.
// Pure canvas; the view uses the canvases as textures and the UI draws them into the DOM.

import { CARDS, NUMERALS, COLOURS } from '../sim/data/lexicon.js';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const m = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return `rgb(${m(16)},${m(8)},${m(0)})`; };

// ------------------------------------------------------------------------------------------- glyphs
// Each glyph is drawn in a unit box -1..1 with its own line weight; `c` is the glow colour.
const G = {
    heart(x) { x.beginPath(); x.moveTo(0, .78); x.bezierCurveTo(-1.1, .1, -.8, -.85, 0, -.35); x.bezierCurveTo(.8, -.85, 1.1, .1, 0, .78); x.closePath(); },
    rings(x) { x.beginPath(); x.arc(-.34, 0, .52, 0, TAU); x.moveTo(.86, 0); x.arc(.34, 0, .52, 0, TAU); },
    tear(x) { x.beginPath(); x.moveTo(0, -.9); x.bezierCurveTo(.2, -.4, .62, .05, .62, .38); x.arc(0, .38, .62, 0, Math.PI); x.bezierCurveTo(-.62, .05, -.2, -.4, 0, -.9); x.closePath(); },
    wilt(x) { x.beginPath(); x.moveTo(-.2, .98); x.bezierCurveTo(-.2, .3, -.1, -.3, .3, -.5); x.bezierCurveTo(.5, -.58, .62, -.4, .6, -.15); x.moveTo(.6, -.15); for (let k = 0; k < 5; k++) { const a = 0.5 + k * 1.15; x.moveTo(.6 + Math.cos(a) * .32 + .16, -.0 + Math.sin(a) * .32); x.arc(.6 + Math.cos(a) * .32, -.0 + Math.sin(a) * .32, .16, 0, TAU); } x.moveTo(-.18, .5); x.quadraticCurveTo(-.7, .35, -.6, .05); x.quadraticCurveTo(-.3, .15, -.18, .5); x.moveTo(-.6, .95); x.arc(-.6, .86, .08, 0, TAU); },
    coin(x) { x.beginPath(); x.arc(0, 0, .82, 0, TAU); x.moveTo(.58, 0); x.arc(0, 0, .58, 0, TAU); x.moveTo(0, -.34); x.lineTo(.1, -.1); x.lineTo(.34, 0); x.lineTo(.1, .1); x.lineTo(0, .34); x.lineTo(-.1, .1); x.lineTo(-.34, 0); x.lineTo(-.1, -.1); x.closePath(); },
    gem(x) { x.beginPath(); x.moveTo(-.55, -.55); x.lineTo(.55, -.55); x.lineTo(.9, -.1); x.lineTo(0, .9); x.lineTo(-.9, -.1); x.closePath(); x.moveTo(-.9, -.1); x.lineTo(.9, -.1); x.moveTo(-.55, -.55); x.lineTo(-.3, -.1); x.lineTo(0, .9); x.moveTo(.55, -.55); x.lineTo(.3, -.1); x.lineTo(0, .9); x.moveTo(-.3, -.1); x.lineTo(0, -.55); x.lineTo(.3, -.1); },
    dagger(x) { x.beginPath(); x.moveTo(0, .95); x.lineTo(-.16, -.15); x.lineTo(.16, -.15); x.closePath(); x.moveTo(-.5, -.2); x.lineTo(.5, -.2); x.lineTo(.5, -.34); x.lineTo(-.5, -.34); x.closePath(); x.moveTo(-.08, -.34); x.lineTo(-.08, -.78); x.lineTo(.08, -.78); x.lineTo(.08, -.34); x.moveTo(0, -.9); x.arc(0, -.88, .1, 0, TAU); },
    mask(x) { x.beginPath(); x.moveTo(-.7, -.7); x.bezierCurveTo(-.7, .6, -.3, .95, 0, .95); x.bezierCurveTo(.3, .95, .7, .6, .7, -.7); x.bezierCurveTo(.3, -.9, -.3, -.9, -.7, -.7); x.moveTo(0, -.85); x.lineTo(0, .93); x.moveTo(-.5, -.25); x.quadraticCurveTo(-.32, -.4, -.12, -.25); x.moveTo(.12, -.25); x.quadraticCurveTo(.32, -.4, .5, -.25); x.moveTo(-.4, .38); x.quadraticCurveTo(-.2, .6, -.04, .38); x.moveTo(.04, .6); x.quadraticCurveTo(.2, .38, .4, .6); },
    ship(x) { x.beginPath(); x.moveTo(-.85, .2); x.lineTo(.85, .2); x.lineTo(.55, .62); x.lineTo(-.55, .62); x.closePath(); x.moveTo(0, .2); x.lineTo(0, -.95); x.moveTo(0, -.9); x.lineTo(.7, .05); x.lineTo(0, .05); x.moveTo(-.06, -.7); x.lineTo(-.6, .05); x.lineTo(-.06, .05); x.moveTo(-.9, .82); x.quadraticCurveTo(-.45, .65, 0, .82); x.quadraticCurveTo(.45, .98, .9, .82); },
    compass(x) { x.beginPath(); x.arc(0, 0, .85, 0, TAU); x.moveTo(0, -.85); x.lineTo(.18, 0); x.lineTo(0, .85); x.lineTo(-.18, 0); x.closePath(); x.moveTo(-.85, 0); x.lineTo(0, .18); x.lineTo(.85, 0); x.lineTo(0, -.18); x.closePath(); },
    leaf(x) { x.beginPath(); x.moveTo(-.2, .95); x.bezierCurveTo(-.95, .2, -.7, -.7, .8, -.9); x.bezierCurveTo(.95, -.1, .5, .75, -.2, .95); x.closePath(); x.moveTo(-.2, .95); x.quadraticCurveTo(.1, .1, .8, -.9); x.moveTo(-.1, .55); x.lineTo(-.55, .3); x.moveTo(.05, .2); x.lineTo(-.4, -.2); x.moveTo(.2, .35); x.lineTo(.62, .1); x.moveTo(.35, -.05); x.lineTo(.62, -.4); },
    staff(x) { x.beginPath(); x.moveTo(0, -.95); x.lineTo(0, .95); x.moveTo(0, -.55); x.bezierCurveTo(.65, -.55, .65, -.15, 0, -.15); x.bezierCurveTo(-.65, -.15, -.65, .25, 0, .25); x.bezierCurveTo(.55, .25, .55, .6, .05, .6); x.moveTo(.1, -.62); x.arc(0, -.66, .1, 0, TAU); },
    house(x) { x.beginPath(); x.moveTo(-.85, -.05); x.lineTo(0, -.85); x.lineTo(.85, -.05); x.moveTo(-.65, -.05); x.lineTo(-.65, .85); x.lineTo(.65, .85); x.lineTo(.65, -.05); x.moveTo(.4, -.55); x.lineTo(.4, -.85); x.lineTo(.62, -.85); x.lineTo(.62, -.4); x.moveTo(-.18, .85); x.lineTo(-.18, .35); x.lineTo(.18, .35); x.lineTo(.18, .85); x.moveTo(-.5, .15); x.rect(-.5, .15, .22, .22); },
    tree(x) { x.beginPath(); x.arc(-.38, -.28, .4, 0, TAU); x.moveTo(.78, -.28); x.arc(.38, -.28, .4, 0, TAU); x.moveTo(.42, -.62); x.arc(0, -.62, .42, 0, TAU); x.moveTo(-.1, .12); x.lineTo(-.1, .55); x.moveTo(.1, .12); x.lineTo(.1, .55); x.moveTo(-.1, .55); x.quadraticCurveTo(-.4, .62, -.75, .95); x.moveTo(.1, .55); x.quadraticCurveTo(.4, .62, .75, .95); x.moveTo(0, .55); x.lineTo(0, .98); },
    crown(x) { x.beginPath(); x.moveTo(-.85, .55); x.lineTo(-.85, -.4); x.lineTo(-.4, .05); x.lineTo(0, -.7); x.lineTo(.4, .05); x.lineTo(.85, -.4); x.lineTo(.85, .55); x.closePath(); x.moveTo(-.85, .3); x.lineTo(.85, .3); x.moveTo(.1, -.8); x.arc(0, -.84, .1, 0, TAU); x.moveTo(-.75, -.5); x.arc(-.85, -.5, .1, 0, TAU); x.moveTo(.95, -.5); x.arc(.85, -.5, .1, 0, TAU); },
    peak(x) { x.beginPath(); x.moveTo(-.95, .7); x.lineTo(-.3, -.35); x.lineTo(.1, .15); x.lineTo(.4, -.2); x.lineTo(.95, .7); x.closePath(); x.moveTo(-.5, -.0); x.lineTo(-.3, -.15); x.lineTo(-.1, .05); x.moveTo(-.3, -.35); x.lineTo(-.3, -.88); x.lineTo(-.02, -.76); x.lineTo(-.3, -.64); },
    key(x) { x.beginPath(); x.arc(-.5, -.5, .38, 0, TAU); x.moveTo(-.28, -.28); x.lineTo(.8, .8); x.moveTo(.45, .45); x.lineTo(.75, .15); x.moveTo(.62, .62); x.lineTo(.92, .32); x.moveTo(-.5, -.6); x.arc(-.5, -.5, .14, 0, TAU); },
    eye(x) { x.beginPath(); x.moveTo(-.95, 0); x.quadraticCurveTo(0, -.95, .95, 0); x.quadraticCurveTo(0, .95, -.95, 0); x.closePath(); x.moveTo(.36, 0); x.arc(0, 0, .36, 0, TAU); x.moveTo(.14, 0); x.arc(0, 0, .14, 0, TAU); x.moveTo(0, -.75); x.lineTo(0, -.98); x.moveTo(-.55, -.55); x.lineTo(-.7, -.78); x.moveTo(.55, -.55); x.lineTo(.7, -.78); },
    bolt(x) { x.beginPath(); x.moveTo(.2, -.98); x.lineTo(-.65, .1); x.lineTo(-.05, .1); x.lineTo(-.25, .98); x.lineTo(.7, -.2); x.lineTo(.1, -.2); x.closePath(); },
    flame(x) { x.beginPath(); x.moveTo(0, -.98); x.bezierCurveTo(.25, -.5, .85, -.2, .7, .4); x.bezierCurveTo(.6, .85, -.6, .85, -.7, .4); x.bezierCurveTo(-.8, -.05, -.3, -.2, 0, -.98); x.closePath(); x.moveTo(0, .1); x.bezierCurveTo(.2, .3, .35, .45, .22, .65); x.bezierCurveTo(.1, .78, -.22, .75, -.25, .55); x.bezierCurveTo(-.28, .4, -.1, .3, 0, .1); },
    hourglass(x) { x.beginPath(); x.moveTo(-.6, -.9); x.lineTo(.6, -.9); x.lineTo(.6, -.6); x.lineTo(.08, 0); x.lineTo(.6, .6); x.lineTo(.6, .9); x.lineTo(-.6, .9); x.lineTo(-.6, .6); x.lineTo(-.08, 0); x.lineTo(-.6, -.6); x.closePath(); x.moveTo(-.3, -.6); x.lineTo(.3, -.6); x.moveTo(-.4, .75); x.lineTo(0, .3); x.lineTo(.4, .75); },
    moth(x) { x.beginPath(); x.moveTo(-.04, -.4); x.lineTo(-.04, .6); x.lineTo(.04, .6); x.lineTo(.04, -.4); x.closePath(); x.moveTo(0, -.4); x.lineTo(-.28, -.88); x.moveTo(0, -.4); x.lineTo(.28, -.88); x.moveTo(-.05, -.3); x.bezierCurveTo(-.5, -.95, -1.05, -.5, -.9, .0); x.bezierCurveTo(-.8, .3, -.3, .2, -.05, .05); x.moveTo(.05, -.3); x.bezierCurveTo(.5, -.95, 1.05, -.5, .9, .0); x.bezierCurveTo(.8, .3, .3, .2, .05, .05); x.moveTo(-.05, .1); x.bezierCurveTo(-.7, .3, -.7, .85, -.3, .78); x.bezierCurveTo(-.15, .72, -.05, .4, -.05, .1); x.moveTo(.05, .1); x.bezierCurveTo(.7, .3, .7, .85, .3, .78); x.bezierCurveTo(.15, .72, .05, .4, .05, .1); },
    star(x) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .38 : .98; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); },
    rainbow(x) { x.beginPath(); for (const r of [.9, .68, .46]) { x.moveTo(-r, .55); x.arc(0, .55, r, Math.PI, TAU); } x.moveTo(-.95, .7); x.quadraticCurveTo(-.7, .45, -.5, .7); x.moveTo(.5, .7); x.quadraticCurveTo(.7, .45, .95, .7); },
};

/** Draw a glyph centred at (cx, cy), half-size s, glowing `colour`. */
export function drawGlyph(ctx, id, cx, cy, s, colour) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = 0.11;
    ctx.shadowColor = colour;
    ctx.shadowBlur = s * 0.35;
    ctx.strokeStyle = colour;
    ctx.fillStyle = rgba(colour, 0.2);
    G[id](ctx);
    ctx.fill('evenodd');
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.035;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    G[id](ctx);
    ctx.stroke();
    ctx.restore();
}

const glyphCache = new Map();
/** A square canvas with the glyph and a soft halo behind it. */
export function glyphCanvas(id, colour, size = 192) {
    const key = id + colour + size;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const c = mk(size, size), x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(colour, 0.5)); g.addColorStop(0.55, rgba(colour, 0.14)); g.addColorStop(1, rgba(colour, 0));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    drawGlyph(x, id, size / 2, size / 2, size * 0.3, colour);
    glyphCache.set(key, c);
    return c;
}

/** A clouded vision: only the colour, swirling, with a question mark nobody can read. */
export function cloudCanvas(colour, size = 192) {
    const key = 'cloud' + colour + size;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const c = mk(size, size), x = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
        const a = i * 2.4, r = size * (0.05 + (i % 7) * 0.045);
        const px = size / 2 + Math.cos(a) * r, py = size / 2 + Math.sin(a) * r;
        const g = x.createRadialGradient(px, py, 0, px, py, size * 0.2);
        g.addColorStop(0, rgba(colour, 0.32)); g.addColorStop(1, rgba(colour, 0));
        x.fillStyle = g; x.fillRect(0, 0, size, size);
    }
    x.font = `700 ${size * 0.34}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.shadowColor = colour; x.shadowBlur = size * 0.1;
    x.fillText('?', size / 2, size / 2 + size * 0.02);
    glyphCache.set(key, c);
    return c;
}

// ------------------------------------------------------------------------------------------- cards
export const CARD_W = 360, CARD_H = 620;
const WIN = { x: 30, y: 70, w: 300, h: 420 };           // the picture window

const glow = (x, px, py, r, col, a = 0.6) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
const poly = (x, pts, fill, stroke, lw = 2) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); } };
const circ = (x, px, py, r, fill, stroke, lw = 2) => { x.beginPath(); x.arc(px, py, r, 0, TAU); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); } };
const rays = (x, px, py, r0, r1, n, col, lw = 3, rot = 0) => { x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; x.beginPath(); x.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); x.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); x.stroke(); } };
const starPath = (x, px, py, r, n = 5, k = 0.45, rot = -Math.PI / 2) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r * k : r; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.closePath(); };
const star = (x, px, py, r, fill, n = 5, k = 0.45) => { starPath(x, px, py, r, n, k); x.fillStyle = fill; x.fill(); };
const moonCres = (x, px, py, r, col) => { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fillStyle = col; x.fill(); x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(px + r * 0.45, py - r * 0.1, r * 0.85, 0, TAU); x.fill(); x.restore(); };
// A robed figure: head, body, optional hood/hair. Origin at the feet.
function person(x, px, py, h, robe, skin = '#f1d0b0', opts = {}) {
    const w = h * 0.34;
    poly(x, [[px - w * 0.5, py - h * 0.68], [px + w * 0.5, py - h * 0.68], [px + w * (opts.wide || 0.85), py], [px - w * (opts.wide || 0.85), py]], robe, 'rgba(0,0,0,0.35)', 2);
    circ(x, px, py - h * 0.78, h * 0.1, skin, 'rgba(0,0,0,0.3)', 1.5);
    if (opts.hair) { x.beginPath(); x.arc(px, py - h * 0.8, h * 0.105, Math.PI, TAU); x.fillStyle = opts.hair; x.fill(); }
    if (opts.hat) { poly(x, [[px - h * 0.13, py - h * 0.84], [px + h * 0.13, py - h * 0.84], [px, py - h * 1.0]], opts.hat); }
    if (opts.belt) { x.fillStyle = opts.belt; x.fillRect(px - w * 0.5, py - h * 0.4, w, h * 0.04); }
}
const arm = (x, x0, y0, x1, y1, col, lw = 9) => { x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
const pillar = (x, px, py, w, h, col) => { const g = x.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, mix(col, '#000000', 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000000', 0.45)); x.fillStyle = g; x.fillRect(px, py, w, h); x.fillStyle = mix(col, '#ffffff', 0.25); x.fillRect(px - 4, py, w + 8, 8); x.fillRect(px - 4, py + h - 8, w + 8, 8); };
const hills = (x, y, col, amp = 24, n = 3, seed = 1) => { x.beginPath(); x.moveTo(0, WIN.h); for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo(t * WIN.w, y - Math.sin(t * Math.PI * n + seed) * amp - Math.sin(t * 17 + seed) * amp * 0.2); } x.lineTo(WIN.w, WIN.h); x.closePath(); x.fillStyle = col; x.fill(); };
const cup = (x, px, py, s, col) => { x.beginPath(); x.moveTo(px - s, py - s); x.quadraticCurveTo(px - s, py + s * 0.4, px, py + s * 0.5); x.quadraticCurveTo(px + s, py + s * 0.4, px + s, py - s); x.closePath(); x.fillStyle = col; x.fill(); x.fillRect(px - s * 0.12, py + s * 0.4, s * 0.24, s * 0.7); x.fillRect(px - s * 0.5, py + s * 1.05, s, s * 0.14); };
const sword = (x, px, py, len, col) => { x.fillStyle = col; poly(x, [[px - 5, py], [px + 5, py], [px, py - len]], col); x.fillRect(px - 14, py, 28, 5); x.fillRect(px - 3, py + 5, 6, 18); };
const wand = (x, px, py, len, col) => { arm(x, px, py, px, py - len, col, 6); star(x, px, py - len, 9, '#ffe9a0', 4, 0.4); };
const pent = (x, px, py, r, col) => { circ(x, px, py, r, rgba(col, 0.25), col, 3); starPath(x, px, py, r * 0.85, 5, 0.38); x.strokeStyle = col; x.lineWidth = 2; x.stroke(); };
const tower = (x, px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px - w / 2, py - h, w, h); poly(x, [[px - w * 0.62, py - h], [px + w * 0.62, py - h], [px + w * 0.4, py - h - 36], [px - w * 0.4, py - h - 36]], mix(col, '#ffffff', 0.18)); for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(255,214,120,0.9)'; x.fillRect(px - 8, py - h + 22 + i * 40, 16, 22); } };

// One scene per card, drawn in the window's own coordinates (0..300, 0..420).
const SCENES = [
    // 0 The Fool
    (x, [a, b]) => { circ(x, 235, 70, 40, '#fff0a0'); glow(x, 235, 70, 120, b, 0.6); rays(x, 235, 48, 70, 4, b); hills(x, 330, '#e8f0ff', 30, 2, 2); hills(x, 370, '#7a6ac8', 24, 3, 1); poly(x, [[0, 420], [0, 300], [190, 300], [210, 330], [210, 420]], '#5a4a2a'); x.fillStyle = '#6ab04a'; x.fillRect(0, 292, 190, 12); person(x, 150, 292, 150, '#ffd25a', '#f1d0b0', { hair: '#7a4a1a', hat: '#e84a6a' }); arm(x, 138, 220, 90, 200, '#ffd25a', 7); arm(x, 90, 200, 74, 260, '#7a4a1a', 4); poly(x, [[60, 200], [96, 200], [90, 224], [66, 224]], '#e84a6a'); circ(x, 215, 322, 11, '#fff', '#444', 2); circ(x, 230, 312, 8, '#fff', '#444', 2); },
    // 1 The Magician
    (x, [a, b]) => { glow(x, 150, 120, 150, b, 0.45); x.strokeStyle = b; x.lineWidth = 5; x.beginPath(); x.moveTo(150, 60); x.bezierCurveTo(110, 20, 100, 90, 150, 60); x.bezierCurveTo(200, 30, 190, 100, 150, 60); x.stroke(); person(x, 150, 340, 230, '#f4f0ff', '#f1d0b0', { hair: '#3a2a1a', belt: '#ffd25a' }); poly(x, [[100, 230], [200, 230], [215, 340], [85, 340]], '#c8283c'); arm(x, 168, 215, 205, 110, '#f4f0ff', 8); wand(x, 205, 110, 55, '#f4f0ff'); arm(x, 132, 215, 105, 280, '#f4f0ff', 8); x.fillStyle = '#4a2a1a'; x.fillRect(60, 360, 180, 14); x.fillRect(70, 372, 10, 48); x.fillRect(220, 372, 10, 48); cup(x, 90, 345, 11, '#ffd25a'); sword(x, 130, 358, 34, '#dfe8ff'); wand(x, 175, 358, 34, '#ffd25a'); pent(x, 215, 345, 12, '#ffd25a'); for (let i = 0; i < 10; i++) circ(x, 20 + i * 28, 410, 7, i % 2 ? '#ff4a6a' : '#fff', null); },
    // 2 The High Priestess
    (x, [a, b]) => { x.fillStyle = mix(a, '#000000', 0.2); x.fillRect(0, 0, 300, 420); for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) circ(x, 20 + i * 30, 40 + j * 70, 7, rgba('#ff5a8a', 0.5), null); pillar(x, 22, 30, 38, 380, '#0c1230'); pillar(x, 240, 30, 38, 380, '#f1ecff'); person(x, 150, 400, 300, '#2c4aa8', '#f1d0b0', { wide: 1.3 }); poly(x, [[110, 130], [190, 130], [205, 400], [95, 400]], rgba('#cfe0ff', 0.45)); moonCres(x, 150, 70, 30, '#f1ecff'); moonCres(x, 210, 360, 26, '#f1ecff'); x.fillStyle = '#f1ecff'; x.fillRect(125, 255, 50, 36); x.fillStyle = '#2a2a5a'; x.font = 'bold 12px serif'; x.textAlign = 'center'; x.fillText('TORA', 150, 278); circ(x, 150, 215, 25, '#f1ecff'); circ(x, 150, 215, 8, '#ffd25a'); },
    // 3 The Empress
    (x, [a, b]) => { x.fillStyle = '#ffe9a0'; x.fillRect(0, 280, 300, 140); for (let i = 0; i < 30; i++) { arm(x, 10 + i * 10, 420, 14 + i * 10, 300 - (i % 5) * 8, '#e8b848', 4); } hills(x, 270, '#3d9a4a', 30, 2, 3); glow(x, 150, 140, 140, '#ff9ec4', 0.35); for (let i = 0; i < 12; i++) { const ang = -Math.PI + i * (Math.PI / 11); star(x, 150 + Math.cos(ang) * 58, 112 + Math.sin(ang) * 40, 8, '#fff0a0'); } person(x, 150, 360, 250, '#ff9ec4', '#f1d0b0', { hair: '#c8883a', wide: 1.15 }); poly(x, [[110, 200], [190, 200], [230, 360], [70, 360]], rgba('#fff', 0.2)); x.save(); x.translate(100, 290); x.scale(1, 1); x.beginPath(); x.moveTo(0, 14); x.bezierCurveTo(-26, -6, -14, -26, 0, -12); x.bezierCurveTo(14, -26, 26, -6, 0, 14); x.fillStyle = '#ff4a6a'; x.fill(); x.restore(); for (let i = 0; i < 5; i++) circ(x, 40 + i * 52, 395, 9, '#fff', null); },
    // 4 The Emperor
    (x, [a, b]) => { hills(x, 300, '#8a2418', 40, 2, 5); poly(x, [[0, 300], [60, 180], [120, 300]], '#6a1810'); poly(x, [[180, 300], [240, 150], [300, 300]], '#6a1810'); glow(x, 150, 130, 140, b, 0.4); x.fillStyle = '#5a3a1a'; x.fillRect(80, 120, 140, 290); x.fillStyle = '#3a2410'; x.fillRect(60, 110, 30, 300); x.fillRect(210, 110, 30, 300); circ(x, 75, 100, 16, '#c88a3a'); circ(x, 225, 100, 16, '#c88a3a'); person(x, 150, 370, 270, '#c8283c', '#f1d0b0', { hair: '#cfcfd6', belt: '#ffd25a', wide: 1.1 }); x.fillStyle = '#cfcfd6'; x.beginPath(); x.moveTo(135, 205); x.quadraticCurveTo(150, 255, 165, 205); x.fill(); poly(x, [[122, 160], [178, 160], [170, 140], [150, 150], [130, 140]], '#ffd25a'); arm(x, 175, 250, 215, 230, '#c8283c', 8); circ(x, 215, 225, 14, '#ffd25a', '#a07010', 2); arm(x, 125, 250, 85, 230, '#c8283c', 8); arm(x, 85, 230, 85, 150, '#ffd25a', 5); x.beginPath(); x.arc(85, 150, 9, 0, TAU); x.stroke(); },
    // 5 The Hierophant
    (x, [a, b]) => { pillar(x, 20, 20, 36, 400, '#cfa86a'); pillar(x, 244, 20, 36, 400, '#cfa86a'); glow(x, 150, 120, 120, b, 0.5); person(x, 150, 330, 240, '#c8283c', '#f1d0b0', { hair: '#cfcfd6', wide: 1.2 }); for (let i = 0; i < 3; i++) poly(x, [[122 + i * 4, 130 - i * 18], [178 - i * 4, 130 - i * 18], [170 - i * 4, 112 - i * 18], [130 + i * 4, 112 - i * 18]], '#ffd25a', '#a07010', 2); arm(x, 175, 215, 210, 160, '#c8283c', 9); arm(x, 125, 215, 100, 250, '#c8283c', 9); arm(x, 100, 250, 100, 120, '#ffd25a', 5); x.strokeStyle = '#ffd25a'; x.lineWidth = 4; for (const yy of [120, 134, 148]) { x.beginPath(); x.moveTo(90, yy); x.lineTo(110, yy); x.stroke(); } person(x, 90, 410, 90, '#f1ecff', '#f1d0b0', { hair: '#c8883a' }); person(x, 210, 410, 90, '#c8283c', '#f1d0b0', { hair: '#3a2a1a' }); x.strokeStyle = '#ffd25a'; x.lineWidth = 6; x.beginPath(); x.moveTo(120, 340); x.lineTo(180, 370); x.moveTo(180, 340); x.lineTo(120, 370); x.stroke(); },
    // 6 The Lovers
    (x, [a, b]) => { glow(x, 150, 70, 160, b, 0.7); circ(x, 150, 70, 44, '#fff0a0'); rays(x, 150, 70, 50, 78, 16, '#ffe9a0', 3); poly(x, [[110, 100], [190, 100], [200, 190], [100, 190]], '#c8283c'); circ(x, 150, 95, 18, '#f1d0b0'); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(150 + s * 20, 130); x.quadraticCurveTo(150 + s * 100, 90, 150 + s * 90, 200); x.quadraticCurveTo(150 + s * 50, 160, 150 + s * 20, 160); x.fillStyle = rgba('#ffffff', 0.8); x.fill(); } hills(x, 360, '#3a8a5a', 40, 2, 4); poly(x, [[120, 420], [150, 300], [180, 420]], '#7a5a8a'); person(x, 85, 400, 190, '#f1d0b0', '#f1d0b0', { hair: '#7a4a1a', wide: 0.5 }); person(x, 215, 400, 190, '#2c7ad8', '#f1d0b0', { hair: '#c8a050' }); x.fillStyle = '#4a7a3a'; x.fillRect(250, 280, 8, 140); circ(x, 254, 270, 34, '#3a8a4a'); for (let i = 0; i < 5; i++) circ(x, 240 + (i % 3) * 14, 262 + i * 5, 5, '#ff4a2a'); },
    // 7 The Chariot
    (x, [a, b]) => { x.fillStyle = '#16507a'; for (let i = 0; i < 7; i++) x.fillRect(10 + i * 42, 220 + (i % 3) * 14, 28, 120); hills(x, 340, '#2a3a6a', 20, 3, 2); poly(x, [[60, 120], [240, 120], [250, 110], [50, 110]], '#2c4aa8'); for (let i = 0; i < 9; i++) star(x, 70 + i * 20, 118, 6, '#fff0a0', 5); for (const px of [70, 230]) arm(x, px, 120, px, 250, '#ffd25a', 5); x.fillStyle = '#e8e8f4'; x.fillRect(65, 250, 170, 100); x.fillStyle = '#2c4aa8'; x.fillRect(65, 250, 170, 24); person(x, 150, 270, 150, '#cfd4e8', '#f1d0b0', { hair: '#7a4a1a' }); poly(x, [[132, 138], [168, 138], [150, 112]], '#ffd25a'); circ(x, 80, 360, 30, '#4a3a2a', '#ffd25a', 4); rays(x, 80, 360, 6, 28, 8, '#ffd25a', 2); circ(x, 220, 360, 30, '#4a3a2a', '#ffd25a', 4); rays(x, 220, 360, 6, 28, 8, '#ffd25a', 2); circ(x, 60, 400, 28, '#101018', '#9aa4c8', 2); circ(x, 240, 400, 28, '#f4f0ff', '#444', 2); },
    // 8 Strength
    (x, [a, b]) => { hills(x, 260, '#6a8a3a', 40, 2, 1); poly(x, [[0, 260], [70, 160], [140, 260]], '#8a5a2a'); poly(x, [[200, 260], [260, 190], [300, 260]], '#8a5a2a'); glow(x, 150, 140, 110, b, 0.4); x.strokeStyle = '#ffd25a'; x.lineWidth = 5; x.beginPath(); x.moveTo(150, 100); x.bezierCurveTo(115, 66, 105, 128, 150, 100); x.bezierCurveTo(185, 72, 195, 132, 150, 100); x.stroke(); person(x, 120, 300, 210, '#f4f0ff', '#f1d0b0', { hair: '#c8883a', wide: 1.25 }); for (let i = 0; i < 9; i++) circ(x, 100 + i * 5, 200 + Math.sin(i) * 6, 6, i % 2 ? '#ff4a6a' : '#6ab04a'); arm(x, 135, 190, 190, 270, '#f4f0ff', 9); circ(x, 205, 290, 46, '#e89a2a', '#7a4a10', 3); for (let i = 0; i < 14; i++) { const a2 = i * TAU / 14; circ(x, 205 + Math.cos(a2) * 52, 290 + Math.sin(a2) * 52, 12, '#b86a10'); } circ(x, 205, 290, 36, '#ffd25a'); circ(x, 193, 284, 4, '#222'); circ(x, 217, 284, 4, '#222'); poly(x, [[200, 292], [210, 292], [205, 302]], '#7a3a10'); x.strokeStyle = '#222'; x.lineWidth = 2; x.beginPath(); x.arc(205, 304, 8, 0.2, Math.PI - 0.2); x.stroke(); poly(x, [[100, 420], [100, 380], [260, 380], [260, 420]], '#3a6a2a'); },
    // 9 The Hermit
    (x, [a, b]) => { hills(x, 300, '#e8f0ff', 50, 2, 3); poly(x, [[0, 320], [80, 190], [160, 320]], '#cfd8f0'); poly(x, [[120, 320], [210, 150], [300, 320]], '#e8f0ff'); for (let i = 0; i < 40; i++) circ(x, (i * 73) % 300, (i * 41) % 420, 2, '#fff'); person(x, 140, 380, 240, '#7a8aa8', '#f1d0b0', { hair: '#cfcfd6', wide: 1.2 }); poly(x, [[110, 168], [170, 168], [150, 130], [125, 130]], '#5a6a88'); x.fillStyle = '#cfcfd6'; x.beginPath(); x.moveTo(130, 190); x.quadraticCurveTo(140, 260, 150, 190); x.fill(); arm(x, 160, 235, 200, 215, '#7a8aa8', 8); arm(x, 200, 215, 200, 170, '#4a3a2a', 4); glow(x, 200, 195, 70, '#fff0a0', 0.9); x.fillStyle = '#ffe9a0'; poly(x, [[190, 180], [210, 180], [214, 212], [186, 212]], 'rgba(255,240,170,0.9)', '#ffd25a'); star(x, 200, 196, 9, '#fff', 6, 0.4); arm(x, 118, 230, 100, 400, '#5a4a2a', 5); },
    // 10 Wheel of Fortune
    (x, [a, b]) => { glow(x, 150, 210, 170, b, 0.55); x.save(); x.translate(150, 210); for (const [r, c, lw] of [[118, '#ffd25a', 8], [92, '#fff0a0', 4], [48, '#ffd25a', 6]]) circ(x, 0, 0, r, null, c, lw); rays(x, 0, 0, 48, 118, 8, '#ffd25a', 5, 0.2); for (let i = 0; i < 8; i++) { const a2 = 0.2 + i * TAU / 8; circ(x, Math.cos(a2) * 105, Math.sin(a2) * 105, 8, '#fff0a0', '#a07010', 2); } x.font = 'bold 26px serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; ['T', 'A', 'R', 'O'].forEach((t, i) => { const a2 = i * Math.PI / 2 - Math.PI / 2; x.fillText(t, Math.cos(a2) * 70, Math.sin(a2) * 70); }); circ(x, 0, 0, 18, '#c8283c', '#ffd25a', 3); x.restore(); poly(x, [[120, 70], [180, 70], [150, 28]], '#4a3a2a'); circ(x, 150, 40, 12, '#e0b070'); x.strokeStyle = '#2c8a4a'; x.lineWidth = 8; x.beginPath(); x.moveTo(40, 280); x.bezierCurveTo(10, 240, 70, 230, 40, 200); x.stroke(); poly(x, [[240, 300], [262, 340], [220, 340]], '#e89a2a'); for (const [px, py] of [[30, 50], [270, 50], [30, 380], [270, 380]]) { circ(x, px, py, 18, '#f4f0ff', '#ffd25a', 3); x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - 28, py - 6); x.quadraticCurveTo(px - 12, py - 20, px - 4, py); x.moveTo(px + 28, py - 6); x.quadraticCurveTo(px + 12, py - 20, px + 4, py); x.stroke(); } },
    // 11 Justice
    (x, [a, b]) => { x.fillStyle = mix(a, '#000000', 0.25); x.fillRect(0, 0, 300, 420); pillar(x, 30, 30, 34, 390, '#cfa86a'); pillar(x, 236, 30, 34, 390, '#cfa86a'); x.fillStyle = '#7a3a8a'; x.fillRect(64, 60, 172, 340); x.fillStyle = '#ffd25a'; x.fillRect(100, 340, 100, 70); person(x, 150, 360, 270, '#c8283c', '#f1d0b0', { hair: '#7a4a1a', wide: 1.15 }); poly(x, [[120, 125], [180, 125], [180, 105], [165, 115], [150, 100], [135, 115], [120, 105]], '#ffd25a'); arm(x, 175, 250, 200, 230, '#c8283c', 9); sword(x, 200, 225, 140, '#dfe8ff'); arm(x, 125, 250, 90, 260, '#c8283c', 9); arm(x, 90, 260, 90, 232, '#ffd25a', 3); x.strokeStyle = '#ffd25a'; x.lineWidth = 3; x.beginPath(); x.moveTo(60, 232); x.lineTo(120, 232); x.stroke(); for (const px of [64, 116]) { x.beginPath(); x.moveTo(px, 232); x.lineTo(px - 14, 258); x.lineTo(px + 14, 258); x.closePath(); x.fillStyle = '#ffd25a'; x.fill(); } },
    // 12 The Hanged Man
    (x, [a, b]) => { glow(x, 150, 270, 130, '#fff0a0', 0.5); x.fillStyle = '#4a3a2a'; x.fillRect(30, 20, 240, 20); x.fillRect(40, 20, 16, 400); x.fillRect(244, 20, 16, 400); x.strokeStyle = '#c8b090'; x.lineWidth = 4; x.beginPath(); x.moveTo(150, 40); x.lineTo(150, 100); x.stroke(); arm(x, 150, 100, 150, 150, '#c8283c', 14); poly(x, [[122, 150], [178, 150], [168, 270], [132, 270]], '#2c7ad8'); circ(x, 150, 295, 25, '#f1d0b0'); x.beginPath(); x.arc(150, 296, 26, 0, Math.PI, true); x.fillStyle = '#e8a840'; x.fill(); circ(x, 150, 295, 38, null, rgba('#fff0a0', 0.9), 4); arm(x, 130, 200, 175, 240, '#2c7ad8', 8); arm(x, 175, 240, 130, 240, '#2c7ad8', 8); arm(x, 138, 150, 105, 130, '#c8283c', 10); },
    // 13 Death
    (x, [a, b]) => { glow(x, 150, 260, 160, '#ffd25a', 0.6); circ(x, 150, 270, 40, '#ffe9a0'); hills(x, 330, '#1a1030', 20, 2, 2); tower(x, 40, 320, 40, 120, '#3a2a58'); tower(x, 260, 320, 40, 120, '#3a2a58'); x.fillStyle = '#f4f0ff'; x.beginPath(); x.ellipse(150, 330, 70, 36, 0, 0, TAU); x.fill(); x.fillRect(190, 270, 22, 64); circ(x, 212, 268, 18, '#f4f0ff'); for (const px of [100, 140, 170, 200]) x.fillRect(px - 4, 350, 9, 60); x.fillStyle = '#101018'; x.beginPath(); x.moveTo(120, 310); x.lineTo(120, 190); x.lineTo(176, 190); x.lineTo(176, 310); x.fill(); circ(x, 148, 176, 20, '#f4f0ff'); circ(x, 142, 174, 4, '#101018'); circ(x, 154, 174, 4, '#101018'); arm(x, 176, 215, 220, 150, '#101018', 8); x.fillStyle = '#101018'; x.fillRect(216, 80, 4, 76); poly(x, [[220, 80], [270, 90], [220, 130]], '#101018'); circ(x, 240, 100, 6, '#f4f0ff'); person(x, 40, 420, 110, '#c8283c', '#f1d0b0'); },
    // 14 Temperance
    (x, [a, b]) => { glow(x, 150, 120, 140, b, 0.5); hills(x, 330, '#4a8a5a', 30, 2, 1); x.fillStyle = rgba('#4ad8f0', 0.6); x.fillRect(0, 360, 300, 60); x.strokeStyle = '#ffe9a0'; x.lineWidth = 6; x.beginPath(); x.moveTo(150, 340); x.bezierCurveTo(130, 300, 200, 270, 150, 230); x.stroke(); poly(x, [[140, 232], [160, 232], [150, 190]], '#c8e8ff'); x.fillStyle = '#f1ecff'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(150, 170); x.quadraticCurveTo(150 + s * 120, 100, 150 + s * 100, 230); x.quadraticCurveTo(150 + s * 60, 190, 150, 220); x.fill(); } person(x, 150, 370, 220, '#f4f0ff', '#f1d0b0', { hair: '#e8a840' }); circ(x, 150, 195, 12, '#ffd25a'); cup(x, 85, 270, 14, '#ffd25a'); cup(x, 215, 310, 14, '#ffd25a'); x.strokeStyle = rgba('#8ae8ff', 0.9); x.lineWidth = 5; x.beginPath(); x.moveTo(100, 270); x.bezierCurveTo(130, 270, 170, 280, 200, 305); x.stroke(); for (let i = 0; i < 5; i++) { star(x, 40 + i * 55, 60 + (i % 2) * 30, 8, '#fff0a0', 4, 0.4); } },
    // 15 The Devil
    (x, [a, b]) => { x.fillStyle = '#0c0610'; x.fillRect(0, 0, 300, 420); glow(x, 150, 140, 160, '#ff3a1a', 0.5); x.fillStyle = '#1a0a18'; x.fillRect(80, 290, 140, 130); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(150, 150); x.quadraticCurveTo(150 + s * 130, 80, 150 + s * 120, 220); x.quadraticCurveTo(150 + s * 70, 190, 150, 230); x.fillStyle = '#3a1a3a'; x.fill(); } poly(x, [[115, 220], [185, 220], [195, 290], [105, 290]], '#5a2a3a'); circ(x, 150, 175, 36, '#7a3a4a'); poly(x, [[116, 160], [100, 110], [132, 148]], '#2a1018'); poly(x, [[184, 160], [200, 110], [168, 148]], '#2a1018'); circ(x, 138, 172, 6, '#ffd25a'); circ(x, 162, 172, 6, '#ffd25a'); starPath(x, 150, 142, 14, 5, 0.38, Math.PI / 2); x.strokeStyle = '#ffd25a'; x.lineWidth = 2; x.stroke(); arm(x, 185, 235, 220, 195, '#5a2a3a', 10); arm(x, 220, 195, 220, 140, '#ff6a1a', 5); person(x, 80, 410, 100, '#f1d0b0', '#e8b894'); person(x, 220, 410, 100, '#c8a8d0', '#e8b894'); x.strokeStyle = '#8a8a9a'; x.lineWidth = 3; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(110, 320); x.lineTo(84, 350); x.moveTo(190, 320); x.lineTo(216, 350); x.stroke(); x.setLineDash([]); },
    // 16 The Tower
    (x, [a, b]) => { x.fillStyle = '#07040f'; x.fillRect(0, 0, 300, 420); glow(x, 150, 80, 170, '#ffb02a', 0.45); x.strokeStyle = '#fff0a0'; x.lineWidth = 6; x.beginPath(); x.moveTo(250, 0); x.lineTo(200, 60); x.lineTo(228, 70); x.lineTo(170, 140); x.stroke(); poly(x, [[100, 420], [105, 130], [195, 130], [200, 420]], '#4a3a68'); poly(x, [[88, 130], [212, 130], [185, 80], [115, 80]], '#6a5a88'); for (const [px, py] of [[132, 180], [168, 240], [132, 300]]) { circ(x, px, py, 12, '#ffd25a'); glow(x, px, py, 40, '#ff6a1a', 0.9); } for (let i = 0; i < 14; i++) { const t = i / 14; poly(x, [[80 + t * 140, 130 - (i % 3) * 8], [90 + t * 140, 100], [70 + t * 140, 110]], rgba('#ff6a1a', 0.85)); } poly(x, [[150, 40], [180, 20], [168, 62]], '#ffd25a'); person(x, 60, 280, 70, '#2c7ad8', '#f1d0b0'); person(x, 245, 340, 70, '#c8283c', '#f1d0b0'); for (let i = 0; i < 18; i++) circ(x, 20 + (i * 83) % 260, 20 + (i * 47) % 380, 3, '#ffd25a'); },
    // 17 The Star
    (x, [a, b]) => { glow(x, 150, 90, 140, '#bfe6ff', 0.6); star(x, 150, 90, 50, '#fff0a0', 8, 0.4); for (const [px, py] of [[50, 50], [250, 50], [40, 150], [260, 150], [90, 20], [210, 20], [150, 170]]) star(x, px, py, 12, '#fff', 8, 0.4); hills(x, 340, '#2a6a8a', 20, 3, 2); x.fillStyle = rgba('#7fd8ff', 0.65); x.beginPath(); x.ellipse(150, 370, 120, 40, 0, 0, TAU); x.fill(); person(x, 150, 360, 150, '#f1d0b0', '#f1d0b0', { hair: '#e8a840', wide: 0.8 }); x.fillStyle = '#e8a840'; x.beginPath(); x.moveTo(145, 258); x.quadraticCurveTo(100, 330, 120, 380); x.lineTo(140, 340); x.fill(); cup(x, 75, 300, 13, '#cfa86a'); cup(x, 225, 310, 13, '#cfa86a'); x.strokeStyle = rgba('#8ae8ff', 0.9); x.lineWidth = 4; x.beginPath(); x.moveTo(92, 310); x.bezierCurveTo(100, 335, 112, 350, 120, 362); x.moveTo(208, 320); x.bezierCurveTo(190, 340, 170, 352, 160, 362); x.stroke(); },
    // 18 The Moon
    (x, [a, b]) => { glow(x, 150, 120, 160, b, 0.55); circ(x, 150, 120, 62, '#f1ecff'); moonCres(x, 150, 120, 60, '#e0d8ff'); circ(x, 150, 120, 62, null, '#ffd25a', 2); circ(x, 138, 115, 4, '#4a3a8a'); circ(x, 164, 115, 4, '#4a3a8a'); x.strokeStyle = '#4a3a8a'; x.lineWidth = 2; x.beginPath(); x.arc(150, 130, 10, 0.2, Math.PI - 0.2); x.stroke(); rays(x, 150, 120, 72, 100, 24, rgba('#ffe9a0', 0.8), 2); tower(x, 40, 330, 44, 150, '#3a2a68'); tower(x, 260, 330, 44, 150, '#3a2a68'); poly(x, [[120, 420], [140, 330], [160, 330], [180, 420]], '#6a5a98'); poly(x, [[130, 330], [146, 290], [158, 330]], '#5a4a88'); x.fillStyle = rgba('#4ad8f0', 0.6); x.beginPath(); x.ellipse(150, 400, 100, 22, 0, 0, TAU); x.fill(); x.fillStyle = '#c8cadc'; poly(x, [[70, 400], [80, 350], [95, 372], [100, 360], [105, 400]], '#cfd4e8'); poly(x, [[200, 400], [210, 354], [226, 372], [232, 360], [236, 400]], '#8a8aa8'); circ(x, 150, 392, 12, '#e84a3a'); },
    // 19 The Sun
    (x, [a, b]) => { glow(x, 150, 110, 190, b, 0.7); circ(x, 150, 110, 58, '#ffe070'); rays(x, 150, 110, 66, 106, 20, '#ffe070', 5); rays(x, 150, 110, 70, 90, 20, '#ff9a2a', 3, 0.15); circ(x, 135, 105, 5, '#a05a10'); circ(x, 165, 105, 5, '#a05a10'); x.strokeStyle = '#a05a10'; x.lineWidth = 3; x.beginPath(); x.arc(150, 118, 16, 0.2, Math.PI - 0.2); x.stroke(); x.fillStyle = '#c87a1a'; x.fillRect(0, 270, 300, 150); for (let i = 0; i < 6; i++) { const px = 25 + i * 50; arm(x, px, 270, px, 400, '#3a7a2a', 5); circ(x, px, 262, 20, '#ffd25a', '#8a5a10', 2); circ(x, px, 262, 8, '#7a4a1a'); } x.fillStyle = '#f4f0ff'; x.beginPath(); x.ellipse(150, 355, 62, 32, 0, 0, TAU); x.fill(); x.fillRect(200, 315, 20, 50); circ(x, 218, 315, 14, '#f4f0ff'); for (const px of [112, 140, 170, 195]) x.fillRect(px - 4, 375, 8, 45); person(x, 150, 340, 90, '#f1d0b0', '#f1d0b0', { hair: '#e8a840', wide: 0.5 }); arm(x, 160, 295, 195, 255, '#f1d0b0', 6); arm(x, 195, 255, 195, 200, '#4a3a2a', 3); poly(x, [[196, 200], [250, 210], [196, 230]], '#c8283c'); },
    // 20 Judgement
    (x, [a, b]) => { glow(x, 150, 60, 160, '#ffe9a0', 0.7); for (let i = 0; i < 7; i++) circ(x, 20 + i * 42, 30 + (i % 2) * 24, 34, 'rgba(255,255,255,0.8)'); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(150, 110); x.quadraticCurveTo(150 + s * 130, 40, 150 + s * 115, 160); x.quadraticCurveTo(150 + s * 60, 130, 150, 150); x.fillStyle = 'rgba(255,255,255,0.9)'; x.fill(); } person(x, 150, 190, 110, '#f4f0ff', '#f1d0b0', { hair: '#e8a840' }); arm(x, 168, 145, 215, 120, '#f4f0ff', 8); poly(x, [[212, 112], [262, 90], [262, 150], [212, 128]], '#ffd25a'); poly(x, [[262, 90], [280, 82], [280, 158], [262, 150]], '#e0a820'); poly(x, [[250, 150], [275, 150], [275, 180], [250, 180]], '#c8283c'); hills(x, 330, '#4a5a8a', 36, 3, 1); for (let i = 0; i < 5; i++) { const px = 35 + i * 58; x.fillStyle = '#cfd4e8'; x.fillRect(px - 22, 372, 44, 36); person(x, px, 375, 92, '#d8d8e8', '#cfcfd6', { wide: 0.45 }); arm(x, px - 4, 320, px - 20, 290, '#cfcfd6', 6); arm(x, px + 4, 320, px + 20, 290, '#cfcfd6', 6); } },
    // 21 The World
    (x, [a, b]) => { glow(x, 150, 210, 180, b, 0.55); x.strokeStyle = '#4ac870'; x.lineWidth = 16; x.beginPath(); x.ellipse(150, 210, 88, 150, 0, 0, TAU); x.stroke(); x.strokeStyle = '#b8f0a0'; x.lineWidth = 4; x.setLineDash([10, 8]); x.beginPath(); x.ellipse(150, 210, 88, 150, 0, 0, TAU); x.stroke(); x.setLineDash([]); for (const [px, py] of [[150, 60], [150, 360]]) circ(x, px, py, 14, '#c8283c', '#ffd25a', 3); person(x, 150, 330, 190, '#cf7aff', '#f1d0b0', { hair: '#3a2a1a', wide: 0.6 }); x.fillStyle = '#ff7acf'; x.beginPath(); x.moveTo(150, 205); x.bezierCurveTo(210, 220, 200, 270, 130, 300); x.bezierCurveTo(170, 270, 160, 240, 150, 205); x.fill(); wand(x, 105, 250, 60, '#ffd25a'); wand(x, 195, 280, 60, '#ffd25a'); for (const [px, py, t] of [[35, 40, 'a'], [265, 40, 'e'], [35, 380, 'b'], [265, 380, 'l']]) { circ(x, px, py, 22, '#f4f0ff', '#ffd25a', 3); x.fillStyle = '#4a2a8a'; x.font = 'bold 20px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.toUpperCase(), px, py + 1); } },
];

function border(x, pal) {
    const w = CARD_W, h = CARD_H;
    const gold = '#e8c14a', deep = mix(pal[0], '#000000', 0.55);
    // body
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, mix(pal[0], '#000000', 0.5)); g.addColorStop(0.5, deep); g.addColorStop(1, mix(pal[0], '#000000', 0.7));
    x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 26); x.fill();
    x.strokeStyle = gold; x.lineWidth = 6; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, 20); x.stroke();
    x.strokeStyle = rgba(gold, 0.55); x.lineWidth = 1.5; x.beginPath(); x.roundRect(18, 18, w - 36, h - 36, 14); x.stroke();
    // corner ornaments
    for (const [cx, cy, sx, sy] of [[26, 26, 1, 1], [w - 26, 26, -1, 1], [26, h - 26, 1, -1], [w - 26, h - 26, -1, -1]]) {
        x.save(); x.translate(cx, cy); x.scale(sx, sy); x.strokeStyle = gold; x.lineWidth = 2.5;
        x.beginPath(); x.arc(0, 0, 14, 0, Math.PI / 2); x.moveTo(0, 22); x.lineTo(22, 0); x.stroke(); star(x, 0, 0, 7, gold, 4, 0.35); x.restore();
    }
    // picture frame
    x.strokeStyle = gold; x.lineWidth = 4; x.strokeRect(WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12);
    x.strokeStyle = rgba(gold, 0.5); x.lineWidth = 1.5; x.strokeRect(WIN.x - 12, WIN.y - 12, WIN.w + 24, WIN.h + 24);
}

const faceCache = new Map();
/** The face of card `id` (0..21), 360x620. Cached. */
export function cardFace(id) {
    if (faceCache.has(id)) return faceCache.get(id);
    const card = CARDS[id], pal = card.pal;
    const c = mk(CARD_W, CARD_H), x = c.getContext('2d');
    border(x, pal);
    // the picture
    x.save();
    x.translate(WIN.x, WIN.y);
    x.beginPath(); x.rect(0, 0, WIN.w, WIN.h); x.clip();
    const sky = x.createLinearGradient(0, 0, 0, WIN.h);
    sky.addColorStop(0, mix(pal[0], '#ffffff', 0.12)); sky.addColorStop(0.55, pal[0]); sky.addColorStop(1, mix(pal[0], '#000000', 0.45));
    x.fillStyle = sky; x.fillRect(0, 0, WIN.w, WIN.h);
    for (let i = 0; i < 26; i++) { const sx = (i * 97 + id * 31) % WIN.w, sy = (i * 53 + id * 17) % (WIN.h * 0.5); circ(x, sx, sy, 1.2 + (i % 3) * 0.5, 'rgba(255,255,255,0.55)'); }
    SCENES[id](x, pal);
    // a soft vignette inside the window keeps every picture inside its frame
    const v = x.createRadialGradient(WIN.w / 2, WIN.h / 2, WIN.h * 0.35, WIN.w / 2, WIN.h / 2, WIN.h * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = v; x.fillRect(0, 0, WIN.w, WIN.h);
    x.restore();
    // numeral and name
    x.fillStyle = '#e8c14a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 30px Georgia, "Times New Roman", serif';
    x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 4;
    x.fillText(NUMERALS[id], CARD_W / 2, 44);
    let size = 30;
    x.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    while (x.measureText(card.name.toUpperCase()).width > CARD_W - 70 && size > 14) { size -= 1; x.font = `700 ${size}px Georgia, "Times New Roman", serif`; }
    x.fillText(card.name.toUpperCase(), CARD_W / 2, 540);
    x.shadowBlur = 0;
    // theme motes under the name
    x.font = '600 15px Georgia, serif'; x.fillStyle = rgba('#ffe9a8', 0.85);
    x.fillText('✦  ' + card.themes.map((t) => t[0].toUpperCase() + t.slice(1)).join('  ✦  ') + '  ✦', CARD_W / 2, 580);
    faceCache.set(id, c);
    return c;
}

let backCache = null;
export function cardBack() {
    if (backCache) return backCache;
    const c = mk(CARD_W, CARD_H), x = c.getContext('2d');
    border(x, ['#3a1a6a', '#e8c14a']);
    x.save(); x.beginPath(); x.roundRect(20, 20, CARD_W - 40, CARD_H - 40, 12); x.clip();
    const g = x.createLinearGradient(0, 0, CARD_W, CARD_H); g.addColorStop(0, '#2a1060'); g.addColorStop(1, '#8a1a58');
    x.fillStyle = g; x.fillRect(0, 0, CARD_W, CARD_H);
    x.strokeStyle = rgba('#e8c14a', 0.8); x.lineWidth = 2;
    const cx = CARD_W / 2, cy = CARD_H / 2;
    for (let r = 40; r <= 190; r += 30) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
    rays(x, cx, cy, 20, 190, 24, rgba('#e8c14a', 0.7), 1.5);
    starPath(x, cx, cy, 120, 8, 0.5); x.fillStyle = rgba('#e8c14a', 0.28); x.fill(); x.stroke();
    moonCres(x, cx, cy, 44, '#e8c14a'); star(x, cx + 22, cy - 4, 14, '#fff0a0', 5);
    for (let i = 0; i < 40; i++) circ(x, (i * 89) % CARD_W, (i * 131) % CARD_H, 1.6, 'rgba(255,240,170,0.7)');
    x.restore();
    backCache = c;
    return c;
}

/** An <img>-like DOM canvas copy of a card face, for the hand, the Codex and the result. */
export function cardElement(id, rev = false, width = 120) {
    const el = mk(CARD_W / 2, CARD_H / 2);
    el.getContext('2d').drawImage(cardFace(id), 0, 0, el.width, el.height);
    el.className = 'cardimg' + (rev ? ' rev' : '');
    el.style.width = width + 'px';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', CARDS[id].name + (rev ? ', reversed' : ', upright'));
    return el;
}

export function glyphElement(id, colour, size = 72) {
    const el = mk(128, 128);
    el.getContext('2d').drawImage(glyphCanvas(id, colour, 128), 0, 0);
    el.className = 'glyphimg';
    el.style.width = size + 'px'; el.style.height = size + 'px';
    return el;
}
export function cloudElement(colour, size = 72) {
    const el = mk(128, 128);
    el.getContext('2d').drawImage(cloudCanvas(colour, 128), 0, 0);
    el.className = 'glyphimg cloud';
    el.style.width = size + 'px'; el.style.height = size + 'px';
    return el;
}
export const colourHex = (id) => COLOURS[id].hex;
