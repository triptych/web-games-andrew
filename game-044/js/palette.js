/**
 * palette.js — the fixed palette every scene is reduced to, and the ordered
 * dither that does the reducing.
 *
 * Scenes are painted freely with gradients, arcs and radial glows, then
 * quantize() snaps every pixel to this palette through a 4×4 Bayer matrix.
 * That one pass is what gives the game its late-80s adventure-game look: the
 * gradients come out as dithered bands, and canvas anti-aliasing (which would
 * otherwise leave blurry half-pixels once the 320×200 buffer is scaled up)
 * is rounded away to solid colour.
 */

export const PAL_HEX = [
    '#0d0b14', '#1b1f3b', '#2b3a67', '#3f5f9a', '#6d93c9', '#a8c8e8',   // night → sky
    '#2a1a3a', '#4a2f5a', '#7d4a78', '#c86f8f', '#f0a878',              // dusk
    '#e0782c', '#f4c542', '#fbe7a1', '#f4ecd8', '#ffffff',              // fire → light
    '#3a2418', '#6b4226', '#a0703c', '#cfa168',                         // wood / earth
    '#16301f', '#255b33', '#3f8a3a', '#74b94a', '#b6d97a',              // greens
    '#1c2029', '#2e3440', '#555c6a', '#8a90a0', '#c3c7d0',              // stone
    '#6e1f24', '#b8332f',                                               // red
    '#1e4a50', '#2f8a8a', '#6fc7c0',                                    // teal
    '#e8b89a', '#b07a5a',                                               // skin
];

export const PAL = PAL_HEX.map(h => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
]);

// 4×4 Bayer matrix, normalised to -0.5..0.5.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

// 5-bit-per-channel lookup: 32k entries, built once, makes quantize() cheap.
let LUT = null;
function buildLut() {
    LUT = new Uint8Array(32 * 32 * 32);
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
        const R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4;
        let best = 0, bd = Infinity;
        for (let i = 0; i < PAL.length; i++) {
            const p = PAL[i];
            // Weighted RGB distance: the eye is most sensitive to green.
            const dr = R - p[0], dg = G - p[1], db = B - p[2];
            const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
            if (d < bd) { bd = d; best = i; }
        }
        LUT[(r << 10) | (g << 5) | b] = best;
    }
}

/**
 * Snap a canvas to the palette in place. `spread` is the dither strength in
 * RGB units — higher gives smoother gradients but grainier flats.
 * Alpha is thresholded, so transparent layers (foregrounds, NPCs) stay crisp.
 */
export function quantize(canvas, spread = 26) {
    if (!LUT) buildLut();
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data, w = canvas.width;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
        // Pixels already (nearly) on the palette stay put, so flat shapes
        // painted in palette colours come out crisp; only blends dither.
        const k = LUT[(clamp5(d[i]) << 10) | (clamp5(d[i + 1]) << 5) | clamp5(d[i + 2])];
        const q = PAL[k];
        if (Math.abs(q[0] - d[i]) + Math.abs(q[1] - d[i + 1]) + Math.abs(q[2] - d[i + 2]) < 12) {
            d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
            continue;
        }
        const x = p % w, y = (p / w) | 0;
        const o = BAYER[(y & 3) * 4 + (x & 3)] * spread;
        const r = clamp5(d[i] + o), g = clamp5(d[i + 1] + o), b = clamp5(d[i + 2] + o);
        const c = PAL[LUT[(r << 10) | (g << 5) | b]];
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

function clamp5(v) {
    v = v | 0;
    return v < 0 ? 0 : v > 255 ? 31 : v >> 3;
}

/** Nearest palette colour for a hex string — for crisp per-frame sprites. */
export function snap(hex) {
    if (!LUT) buildLut();
    const r = parseInt(hex.slice(1, 3), 16) >> 3;
    const g = parseInt(hex.slice(3, 5), 16) >> 3;
    const b = parseInt(hex.slice(5, 7), 16) >> 3;
    return PAL_HEX[LUT[(r << 10) | (g << 5) | b]];
}
