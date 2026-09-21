/**
 * Procedural sprite generation.
 *
 * Every sprite in the game is a bitmask generated from the run seed and then
 * baked into a small offscreen canvas, once, at load. Nothing is loaded from
 * disk. The generator mirrors each sprite horizontally, which is both how the
 * 2600 drew its playfield and the reason hand-drawn 2600 sprites read as
 * symmetrical creatures.
 */

import { polColor } from './palette.js';

/**
 * Generate a left-half bitmask and mirror it, giving a symmetric w x h sprite.
 * `density` biases how filled the shape is; `core` forces the centre column on
 * so the sprite always has a solid spine and never generates as scattered dust.
 */
function symmetricMask(rng, w, h, density, core) {
    const half = Math.ceil(w / 2);
    const mask = [];
    for (let y = 0; y < h; y++) {
        const row = new Array(w).fill(0);
        // Taper the top and bottom rows so shapes read as rounded, not blocky.
        const edge = Math.min(y, h - 1 - y) / (h / 2);
        const p = density * (0.35 + edge * 0.85);
        for (let x = 0; x < half; x++) {
            // Columns nearer the spine are likelier to be filled.
            const spine = 1 - x / half;
            const on = rng() < p * (0.45 + spine * 0.95) ? 1 : 0;
            row[x] = on;
            row[w - 1 - x] = on;
        }
        if (core) {
            const mid = Math.floor(w / 2);
            row[mid] = 1;
            if (w % 2 === 0) row[mid - 1] = 1;
        }
        mask.push(row);
    }
    return mask;
}

/** Paint a mask into a fresh offscreen canvas at 1 buffer-pixel per cell. */
function bake(mask, colors) {
    const h = mask.length;
    const w = mask[0].length;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const v = mask[y][x];
            if (!v) continue;
            g.fillStyle = colors[Math.min(v - 1, colors.length - 1)];
            g.fillRect(x, y, 1, 1);
        }
    }
    return cv;
}

/** Add a highlight value (2) along the upper-left lit edge of a mask. */
function shade(mask) {
    const h = mask.length;
    const w = mask[0].length;
    const out = mask.map((r) => r.slice());
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask[y][x]) continue;
            const above = y > 0 ? mask[y - 1][x] : 0;
            const left = x > 0 ? mask[y][x - 1] : 0;
            if (!above || !left) out[y][x] = 2;
        }
    }
    return out;
}

/**
 * Build every sprite this run needs. Returns an object of canvases, each keyed
 * by what it draws, with polarity variants where polarity matters.
 */
export function buildSprites(rng, pal) {
    const sprites = {};

    // --- the probe: a small symmetric craft, one variant per polarity ---
    const probeMask = shade(symmetricMask(rng, 7, 7, 0.62, true));
    sprites.probePos = bake(probeMask, [polColor(pal, 1), pal.white]);
    sprites.probeNeg = bake(probeMask, [polColor(pal, -1), pal.white]);
    // Flash frame shown for a moment after inverting.
    sprites.probeFlash = bake(probeMask, [pal.white, pal.white]);
    sprites.probeW = probeMask[0].length;
    sprites.probeH = probeMask.length;

    // --- motes: one generated silhouette per class, per polarity ---
    const kinds = {
        drifter: { size: 5, density: 0.7 },
        splitter: { size: 6, density: 0.8 },
        inverter: { size: 5, density: 0.85 },
        leech: { size: 6, density: 0.62 },
        anchor: { size: 7, density: 0.9 }
    };
    sprites.mote = {};
    for (const [kind, cfg] of Object.entries(kinds)) {
        const mask = shade(symmetricMask(rng, cfg.size, cfg.size, cfg.density, true));
        sprites.mote[kind] = {
            pos: bake(mask, [polColor(pal, 1), pal.white]),
            neg: bake(mask, [polColor(pal, -1), pal.white]),
            // Anchors are field-immune, so they get a neutral grey body.
            neutral: bake(mask, [pal.hud, pal.white]),
            w: cfg.size,
            h: cfg.size
        };
    }

    // --- the core: a pulsing generated blob, several frames ---
    sprites.coreFrames = [];
    for (let f = 0; f < 4; f++) {
        const m = shade(symmetricMask(rng, 19, 19, 0.74 + f * 0.04, true));
        sprites.coreFrames.push(bake(m, [pal.core, pal.coreHot]));
    }
    sprites.coreW = 19;
    sprites.coreH = 19;

    return sprites;
}

/**
 * The blocky digit font. Generated as 3x5 bitmaps rather than loaded, so there
 * is no web font dependency and the numerals match the chunky 2600 idiom.
 */
const DIGITS = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    'x': ['000', '101', '010', '101', '000'],
    '-': ['000', '000', '111', '000', '000'],
    ' ': ['000', '000', '000', '000', '000']
};

const LETTERS = {
    A: ['111', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
    C: ['111', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
    G: ['111', '100', '101', '101', '111'], H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'], J: ['001', '001', '001', '101', '111'],
    K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
    O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
    Q: ['111', '101', '101', '111', '011'], R: ['111', '101', '110', '101', '101'],
    S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
    W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
    '.': ['000', '000', '000', '000', '010'], ':': ['000', '010', '000', '010', '000'],
    '!': ['010', '010', '010', '000', '010'], '/': ['001', '001', '010', '100', '100'],
    '+': ['000', '010', '111', '010', '000']
};

export function glyphFor(ch) {
    const up = ch.toUpperCase();
    if (DIGITS[ch]) return DIGITS[ch];
    if (DIGITS[up]) return DIGITS[up];
    if (LETTERS[up]) return LETTERS[up];
    return null;
}

/** Width in buffer pixels of a string drawn at the given scale. */
export function textWidth(str, scale = 1, spacing = 1) {
    return str.length * (3 * scale + spacing) - spacing;
}

/** Draw a string of the generated blocky font into a 2D context. */
export function drawText(g, str, x, y, color, scale = 1, spacing = 1) {
    g.fillStyle = color;
    let cx = x;
    for (const ch of str) {
        const glyph = glyphFor(ch);
        if (glyph) {
            for (let ry = 0; ry < 5; ry++) {
                const row = glyph[ry];
                for (let rx = 0; rx < 3; rx++) {
                    if (row[rx] === '1') {
                        g.fillRect(cx + rx * scale, y + ry * scale, scale, scale);
                    }
                }
            }
        }
        cx += 3 * scale + spacing;
    }
    return cx - spacing;
}
