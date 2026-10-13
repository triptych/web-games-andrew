// A 5 × 7 pixel font, drawn as baked glyph strips per colour. Text is laid out
// in native screen pixels (the 320 × 240 monitor); the renderer's transform
// scales it up, so letters glow and scanline like everything else.

const G = {
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
    C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
    E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
    I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
    K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 11001 10101 10011 10011 10001',
    O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
    Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
    U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
    W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10011 10101 10101 10101 11001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
    2: '01110 10001 00001 00110 01000 10000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
    4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
    8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
    '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
    ':': '00000 01100 01100 00000 01100 01100 00000', ';': '00000 01100 01100 00000 01100 00100 01000',
    '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100',
    '-': '00000 00000 00000 11111 00000 00000 00000', '+': '00000 00100 00100 11111 00100 00100 00000',
    '/': '00001 00010 00010 00100 01000 01000 10000', "'": '00100 00100 01000 00000 00000 00000 00000',
    '"': '01010 01010 00000 00000 00000 00000 00000', '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000', '%': '11001 11010 00010 00100 01000 01011 10011',
    '&': '01100 10010 10100 01000 10101 10010 01101', '*': '00000 10101 01110 11111 01110 10101 00000',
    '#': '01010 11111 01010 01010 01010 11111 01010', '=': '00000 00000 11111 00000 11111 00000 00000',
    '<': '00010 00100 01000 10000 01000 00100 00010', '>': '01000 00100 00010 00001 00010 00100 01000',
    _: '00000 00000 00000 00000 00000 00000 11111', '©': '01110 10001 10111 10101 10111 10001 01110',
    '×': '00000 10001 01010 00100 01010 10001 00000', '▼': '00000 11111 11111 01110 01110 00100 00000',
    '▲': '00000 00100 01110 01110 11111 11111 00000', '►': '01000 01100 01110 01111 01110 01100 01000',
    '◄': '00010 00110 01110 11110 01110 00110 00010', '♥': '00000 01010 11111 11111 01110 00100 00000',
    '¢': '00100 01111 10100 10100 10100 01111 00100', '·': '00000 00000 00000 01100 01100 00000 00000',
    ' ': '00000 00000 00000 00000 00000 00000 00000',
};
const GLYPHS = {};
for (const [ch, rows] of Object.entries(G)) GLYPHS[ch] = rows.split(' ').map((r) => [...r].map((c) => c === '1'));

export const CW = 6;   // advance per character, native px
export const CH = 7;

const cache = new Map();
/** A baked strip of the whole glyph set in one colour, one native pixel per font pixel. */
function strip(color) {
    let c = cache.get(color);
    if (c) return c;
    const chars = Object.keys(GLYPHS);
    c = document.createElement('canvas');
    c.width = chars.length * 6; c.height = 7;
    const g = c.getContext('2d');
    g.fillStyle = color;
    chars.forEach((ch, i) => {
        GLYPHS[ch].forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect(i * 6 + x, y, 1, 1); }));
    });
    c.index = Object.fromEntries(chars.map((ch, i) => [ch, i]));
    cache.set(color, c);
    return c;
}

export function textWidth(str, scale = 1) { return String(str).length * CW * scale - scale; }

/**
 * Draw text at native (x, y). opts: { align: 'left'|'center'|'right', scale, shadow, glow }
 * `glow` draws a soft halo in that colour under the letters.
 */
export function drawText(ctx, str, x, y, color = '#fff', opts = {}) {
    str = String(str).toUpperCase();
    const scale = opts.scale || 1;
    const w = textWidth(str, scale);
    if (opts.align === 'center') x -= w / 2;
    else if (opts.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    if (opts.shadow) drawRaw(ctx, str, x + scale, y + scale, opts.shadow, scale);
    if (opts.glow) {
        // the halo is blurred once per string and colour, then reused
        const halo = glowOf(str, opts.glow, scale);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.85;
        ctx.drawImage(halo, x - halo.pad, y - halo.pad, halo.width / 3, halo.height / 3);
        ctx.restore();
    }
    drawRaw(ctx, str, x, y, color, scale);
    return w;
}

const glowCache = new Map();
function glowOf(str, color, scale) {
    const key = `${str}|${color}|${scale}`;
    let c = glowCache.get(key);
    if (c) return c;
    const pad = 4 * scale + 2, S = 3;
    c = document.createElement('canvas');
    c.width = (textWidth(str, scale) + pad * 2) * S; c.height = (7 * scale + pad * 2) * S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.shadowColor = color; g.shadowBlur = 4 * scale * S; g.shadowOffsetX = 10000;
    g.setTransform(S, 0, 0, S, -10000, 0);
    drawRaw(g, str, pad, pad, color, scale);
    c.pad = pad;
    if (glowCache.size > 80) glowCache.delete(glowCache.keys().next().value);
    glowCache.set(key, c);
    return c;
}

function drawRaw(ctx, str, x, y, color, scale) {
    const s = strip(color);
    for (let i = 0; i < str.length; i++) {
        const k = s.index[str[i]];
        if (k === undefined || str[i] === ' ') continue;
        ctx.drawImage(s, k * 6, 0, 5, 7, x + i * CW * scale, y, 5 * scale, 7 * scale);
    }
}

/** Glyph bitmaps, for the chrome logo. */
export function glyph(ch) { return GLYPHS[ch] || GLYPHS[' ']; }
