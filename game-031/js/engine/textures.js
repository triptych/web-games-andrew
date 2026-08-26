/**
 * Procedural wall textures.
 *
 * The game ships no binary assets: every 64x64 wall surface is generated
 * here from a seeded RNG at startup, which means the whole dungeon theme
 * for a floor can be produced by handing a different colour set to the
 * same generators.
 */

import * as P from './palette.js';

export const TEX_SIZE = 64;

/** Deterministic 32-bit RNG so a seed always rebuilds the same textures. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

class Tex {
    constructor(size = TEX_SIZE) {
        this.w = size;
        this.h = size;
        this.data = new Uint8Array(size * size);
    }
    // Coordinates are floored and wrapped: generators work in floats and
    // every texture tiles, so this is the only place that has to care.
    set(x, y, c) {
        x = Math.floor(x); y = Math.floor(y);
        x = ((x % this.w) + this.w) % this.w;
        y = ((y % this.h) + this.h) % this.h;
        this.data[y * this.w + x] = c;
    }
    get(x, y) {
        x = Math.floor(x); y = Math.floor(y);
        x = ((x % this.w) + this.w) % this.w;
        y = ((y % this.h) + this.h) % this.h;
        return this.data[y * this.w + x];
    }
    fill(c) { this.data.fill(c); }
    rect(x0, y0, w, h, c) {
        x0 = Math.floor(x0); y0 = Math.floor(y0);
        w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
        for (let y = y0; y < y0 + h; y++)
            for (let x = x0; x < x0 + w; x++) this.set(x, y, c);
    }
    hline(x0, x1, y, c) { for (let x = Math.floor(x0); x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = Math.floor(y0); y <= y1; y++) this.set(x, y, c); }
}

/** Sprinkle random pixels of `c` across the whole texture. */
function speckle(tex, rng, c, amount) {
    const n = (tex.w * tex.h * amount) | 0;
    for (let i = 0; i < n; i++) tex.set((rng() * tex.w) | 0, (rng() * tex.h) | 0, c);
}

/** Organic blobs — moss, rust, scorch marks. */
function patches(tex, rng, c, count, radius) {
    for (let i = 0; i < count; i++) {
        const cx = rng() * tex.w, cy = rng() * tex.h;
        const r = radius * (0.5 + rng());
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                const d = Math.sqrt(x * x + y * y) / r;
                if (d < 1 && rng() > d * d) tex.set(cx + x, cy + y, c);
            }
        }
    }
}

/**
 * Offset brick courses. `tones` runs dark -> light: tones[0] is the
 * shadow/crack colour and the last entry is the top-lit highlight.
 */
export function brickTexture(seed, { tones, mortar, moss = null, mossAmount = 0 }) {
    const rng = mulberry32(seed);
    const tex = new Tex();
    tex.fill(mortar);
    const bh = 16, bw = 32;
    for (let row = 0; row < TEX_SIZE / bh; row++) {
        const offset = (row & 1) ? bw / 2 : 0;
        for (let col = -1; col < TEX_SIZE / bw + 1; col++) {
            const x0 = col * bw + offset, y0 = row * bh;
            const base = rng() < 0.35 ? tones[2] : tones[1];
            tex.rect(x0 + 1, y0 + 1, bw - 2, bh - 2, base);
            // top-lit: highlight along the top and left, shadow below right
            tex.hline(x0 + 1, x0 + bw - 2, y0 + 1, tones[tones.length - 1]);
            tex.vline(x0 + 1, y0 + 1, y0 + bh - 3, tones[tones.length - 1]);
            tex.hline(x0 + 1, x0 + bw - 2, y0 + bh - 2, tones[0]);
            tex.vline(x0 + bw - 2, y0 + 2, y0 + bh - 2, tones[0]);
            // a crack or a chipped corner, sparingly
            if (rng() < 0.5) {
                let cx = x0 + 4 + rng() * (bw - 10), cy = y0 + 3 + rng() * (bh - 7);
                const len = 3 + rng() * 6, dir = rng() < 0.5 ? 1 : -1;
                for (let i = 0; i < len; i++) tex.set(cx + i, cy + ((i * dir * 0.5) | 0), tones[0]);
            }
        }
    }
    if (moss !== null && mossAmount > 0) patches(tex, rng, moss, Math.ceil(mossAmount * 3), 4);
    return tex;
}

/** Big cut-stone blocks with deep mortar joints. */
export function blockTexture(seed, { tones, mortar, moss = null, mossAmount = 0 }) {
    const rng = mulberry32(seed);
    const tex = new Tex();
    tex.fill(mortar);
    const bs = 32;
    for (let ry = 0; ry < TEX_SIZE / bs; ry++) {
        for (let rx = -1; rx <= TEX_SIZE / bs; rx++) {
            const x0 = rx * bs + ((ry & 1) ? bs / 2 : 0), y0 = ry * bs;
            const base = rng() < 0.3 ? tones[2] : tones[1];
            tex.rect(x0 + 2, y0 + 2, bs - 4, bs - 4, base);
            // weathering: a handful of soft blotches, not per-pixel static
            for (let i = 0; i < 5; i++) {
                const px = x0 + 4 + rng() * (bs - 10), py = y0 + 4 + rng() * (bs - 10);
                const r = 1 + rng() * 3, c = rng() < 0.5 ? tones[0] : tones[tones.length - 1];
                for (let y = -r; y <= r; y++)
                    for (let x = -r; x <= r; x++)
                        if (x * x + y * y <= r * r && rng() < 0.5) tex.set(px + x, py + y, c);
            }
            tex.hline(x0 + 2, x0 + bs - 3, y0 + 2, tones[tones.length - 1]);
            tex.vline(x0 + 2, y0 + 2, y0 + bs - 3, tones[tones.length - 1]);
            tex.hline(x0 + 2, x0 + bs - 3, y0 + bs - 3, tones[0]);
            tex.hline(x0 + 2, x0 + bs - 3, y0 + bs - 4, tones[0]);
            tex.vline(x0 + bs - 3, y0 + 3, y0 + bs - 3, tones[0]);
            tex.vline(x0 + bs - 4, y0 + 4, y0 + bs - 4, tones[0]);
        }
    }
    if (moss !== null && mossAmount > 0) patches(tex, rng, moss, Math.ceil(mossAmount * 3), 4);
    return tex;
}

/** Irregular rubble — used for cave-ish floors of the abyss. */
export function roughTexture(seed, { tones, mortar }) {
    const rng = mulberry32(seed);
    const tex = new Tex();
    tex.fill(tones[1]);
    for (let i = 0; i < 90; i++) {
        const cx = rng() * TEX_SIZE, cy = rng() * TEX_SIZE;
        const r = 2 + rng() * 6;
        const c = tones[(rng() * tones.length) | 0];
        for (let y = -r; y <= r; y++)
            for (let x = -r; x <= r; x++)
                if (x * x + y * y < r * r) tex.set(cx + x, cy + y, c);
    }
    speckle(tex, rng, tones[0], 0.03);
    return tex;
}

/** Planked wooden door with iron bands and a ring handle. */
export function doorTexture(seed, { wood = P.BROWN, dark = P.RED, iron = P.DKGRAY, trim = P.LTGRAY }) {
    const rng = mulberry32(seed);
    const tex = new Tex();
    tex.fill(dark);
    tex.rect(4, 2, 56, 60, wood);
    for (let x = 4; x < 60; x += 9) tex.vline(x, 2, 61, dark);           // plank seams
    for (let i = 0; i < 260; i++) tex.set(4 + rng() * 56, 2 + rng() * 60, rng() < 0.5 ? dark : trim);
    tex.rect(4, 10, 56, 5, iron);                                        // bands
    tex.rect(4, 48, 56, 5, iron);
    tex.hline(4, 59, 10, trim);
    tex.hline(4, 59, 48, trim);
    for (let x = 7; x < 60; x += 10) { tex.set(x, 12, trim); tex.set(x, 50, trim); }  // rivets
    // ring handle
    for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        tex.set(46 + Math.cos(t) * 5, 32 + Math.sin(t) * 5, trim);
        tex.set(46 + Math.cos(t) * 4, 32 + Math.sin(t) * 4, iron);
    }
    for (let y = 0; y < TEX_SIZE; y++) { tex.set(0, y, iron); tex.set(1, y, iron); tex.set(62, y, iron); tex.set(63, y, iron); }
    return tex;
}

/** Portcullis: iron bars over blackness. Used for locked gates. */
export function gateTexture(seed, { iron = P.DKGRAY, trim = P.LTGRAY, back = P.BLACK }) {
    const tex = new Tex();
    tex.fill(back);
    for (let x = 4; x < 64; x += 10) { tex.rect(x, 0, 4, 64, iron); tex.vline(x, 0, 63, trim); }
    for (let y = 6; y < 64; y += 18) { tex.rect(0, y, 64, 3, iron); tex.hline(0, 63, y, trim); }
    return tex;
}

/** Stone slab carved with a glyph — marks stairs and shrines. */
export function runeTexture(seed, base, glyphColor) {
    const tex = blockTexture(seed, base);
    const cx = 32, cy = 32;
    for (let a = 0; a < 128; a++) {
        const t = (a / 128) * Math.PI * 2;
        tex.set(cx + Math.cos(t) * 18, cy + Math.sin(t) * 18, glyphColor);
        tex.set(cx + Math.cos(t) * 17, cy + Math.sin(t) * 17, glyphColor);
    }
    for (let i = -12; i <= 12; i++) {
        tex.set(cx + i, cy, glyphColor);
        tex.set(cx, cy + i, glyphColor);
        tex.set(cx + i, cy + i, glyphColor);
        tex.set(cx + i, cy - i, glyphColor);
    }
    return tex;
}
