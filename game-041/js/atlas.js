// Builds the single RGBA texture atlas every quad samples from.
// Pure data — no canvas, no DOM — so it can be built and inspected in Node.
//
// Each sprite is packed with a 2px border whose pixels are copied from the
// sprite's own edge ("extrusion"). The renderer samples with a sharp-bilinear
// filter, and without extrusion the opaque dirt tiles would pick up a faint
// transparent seam where they meet.

import { PAL, SPRITES, DERIVED, SPRITE_PAL } from './sprites.js';
import { FONT, GLYPH_W, GLYPH_H } from './font.js';

const PAD = 2;

function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function bitmap(w, h) {
    return { w, h, d: new Uint8ClampedArray(w * h * 4) };
}

function put(b, x, y, rgb, a = 255) {
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    const i = (y * b.w + x) * 4;
    b.d[i] = rgb[0]; b.d[i + 1] = rgb[1]; b.d[i + 2] = rgb[2]; b.d[i + 3] = a;
}

function fromRows(rows, pal) {
    const b = bitmap(rows[0].length, rows.length);
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            const hex = pal[ch];
            if (!hex) throw new Error(`atlas: no colour for '${ch}'`);
            put(b, x, y, hexRgb(hex));
        }
    });
    return b;
}

function blit(dst, src, dx, dy, scale = 1) {
    for (let y = 0; y < src.h * scale; y++) {
        for (let x = 0; x < src.w * scale; x++) {
            const si = (((y / scale) | 0) * src.w + ((x / scale) | 0)) * 4;
            if (src.d[si + 3] === 0) continue;
            put(dst, dx + x, dy + y, [src.d[si], src.d[si + 1], src.d[si + 2]], src.d[si + 3]);
        }
    }
}

// Tiny deterministic PRNG so the dirt looks the same every load.
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Four strata, top to bottom — muted so they don't feed the bloom pass.
const STRATA = [
    { base: '#b87a28', dark: '#8a5518', light: '#d89c48', pebble: '#6a4a2a' },
    { base: '#a8501c', dark: '#7a3410', light: '#c86c30', pebble: '#5a3020' },
    { base: '#883028', dark: '#5c1c18', light: '#a84838', pebble: '#40201c' },
    { base: '#5a2448', dark: '#3a1430', light: '#7a3864', pebble: '#2a1026' },
];

function dirtTile(s, v) {
    const st = STRATA[s];
    const b = bitmap(16, 16);
    const base = hexRgb(st.base), dark = hexRgb(st.dark), light = hexRgb(st.light), peb = hexRgb(st.pebble);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(b, x, y, base);
    const r = rng(1000 + s * 17 + v * 131);
    // Speckle in a loose 2x2 lattice so it reads as 8-bit dither, not noise.
    for (let i = 0; i < 26; i++) put(b, (r() * 8 | 0) * 2 + (r() < 0.5 ? 0 : 1), (r() * 16) | 0, dark);
    for (let i = 0; i < 12; i++) put(b, (r() * 16) | 0, (r() * 8 | 0) * 2, light);
    // A pebble or two with a highlight.
    const pebbles = 1 + ((r() * 2) | 0);
    for (let i = 0; i < pebbles; i++) {
        const px = 1 + ((r() * 12) | 0), py = 1 + ((r() * 12) | 0);
        put(b, px, py, peb); put(b, px + 1, py, peb); put(b, px, py + 1, peb); put(b, px + 1, py + 1, peb);
        put(b, px + 2, py + 1, peb); put(b, px, py, light);
    }
    return b;
}

function towerBase() {
    const b = bitmap(16, 16);
    const edge = hexRgb('#1c1c28'), face = hexRgb('#545470'), hi = hexRgb('#8a8aac'),
          lo = hexRgb('#32324a'), rivet = hexRgb('#d0d0e8'), well = hexRgb('#101018');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c = face;
        if (x === 0 || y === 0 || x === 15 || y === 15) c = edge;
        else if (x === 1 || y === 1) c = hi;
        else if (x === 14 || y === 14) c = lo;
        put(b, x, y, c);
    }
    for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) put(b, x, y, rivet);
    // Recessed socket the head sits in.
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        if (dx * dx + dy * dy < 15) put(b, x, y, well);
    }
    return b;
}

// Chunky pixel circles for the touch controls.
function circle(size, thick, filled) {
    const b = bitmap(size, size);
    const c = (size - 1) / 2, R = size / 2 - 0.5;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= R && (filled || d > R - thick)) put(b, x, y, [255, 255, 255]);
    }
    return b;
}

function king() {
    // The boss: a grub at 2x with a crown on top. 32 x 40.
    const b = bitmap(32, 40);
    blit(b, fromRows(SPRITES.grub0, PAL), 0, 8, 2);
    blit(b, fromRows(SPRITES.crown, PAL), 0, 0, 2);
    return b;
}

function king1() {
    const b = bitmap(32, 40);
    blit(b, fromRows(SPRITES.grub1, PAL), 0, 8, 2);
    blit(b, fromRows(SPRITES.crown, PAL), 0, 0, 2);
    return b;
}

function derive(def) {
    let rows = SPRITES[def.from];
    if (def.swap) rows = rows.map(r => r.replace(/./g, ch => def.swap[ch] ?? ch));
    if (def.flipX) rows = rows.map(r => r.split('').reverse().join(''));
    return rows;
}

export function collectBitmaps() {
    const list = [];
    const add = (name, b) => list.push({ name, b });

    add('white', (() => { const b = bitmap(4, 4); b.d.fill(255); return b; })());
    for (const [name, rows] of Object.entries(SPRITES)) {
        add(name, fromRows(rows, { ...PAL, ...(SPRITE_PAL[name] || {}) }));
    }
    for (const [name, def] of Object.entries(DERIVED)) add(name, fromRows(derive(def), PAL));
    for (let s = 0; s < 4; s++) for (let v = 0; v < 3; v++) add(`dirt${s}_${v}`, dirtTile(s, v));
    add('towerBase', towerBase());
    add('ring', circle(48, 4, false));
    add('disc', circle(48, 0, true));
    add('king0', king());
    add('king1', king1());
    for (const [ch, rows] of Object.entries(FONT)) {
        const b = bitmap(GLYPH_W, GLYPH_H);
        rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') put(b, x, y, [255, 255, 255]); });
        add('g_' + ch, b);
    }
    return list;
}

export function buildAtlas(size = 512) {
    const atlas = bitmap(size, size);
    const frames = {};
    const list = collectBitmaps().sort((a, b) => b.b.h - a.b.h);
    let x = 0, y = 0, shelf = 0;
    for (const { name, b } of list) {
        const w = b.w + PAD * 2, h = b.h + PAD * 2;
        if (x + w > size) { x = 0; y += shelf; shelf = 0; }
        if (y + h > size) throw new Error('atlas: out of space');
        // Extrude: every destination pixel copies the nearest source pixel.
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
            const sx = Math.min(b.w - 1, Math.max(0, xx - PAD));
            const sy = Math.min(b.h - 1, Math.max(0, yy - PAD));
            const si = (sy * b.w + sx) * 4, di = ((y + yy) * size + (x + xx)) * 4;
            atlas.d[di] = b.d[si]; atlas.d[di + 1] = b.d[si + 1]; atlas.d[di + 2] = b.d[si + 2]; atlas.d[di + 3] = b.d[si + 3];
        }
        frames[name] = { x: x + PAD, y: y + PAD, w: b.w, h: b.h };
        x += w; shelf = Math.max(shelf, h);
    }
    return { size, pixels: new Uint8Array(atlas.d.buffer), frames };
}
