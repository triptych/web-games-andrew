/**
 * EGA palette, darkening ramps and dithering.
 *
 * EGA has no notion of "half brightness" — you cannot scale a colour, you
 * can only pick another one of the 16. So each colour gets an explicit
 * hand-authored chain from full brightness down to black, exactly the way
 * DOS-era artists shaded their tiles. Distance shading then becomes a
 * lookup into these chains, with a Bayer matrix dithering the fractional
 * step so the bands do not look like hard rings on the floor.
 */

export const EGA = [
    0x000000, // 0  black
    0x0000aa, // 1  blue
    0x00aa00, // 2  green
    0x00aaaa, // 3  cyan
    0xaa0000, // 4  red
    0xaa00aa, // 5  magenta
    0xaa5500, // 6  brown
    0xaaaaaa, // 7  light gray
    0x555555, // 8  dark gray
    0x5555ff, // 9  light blue
    0x55ff55, // 10 light green
    0x55ffff, // 11 light cyan
    0xff5555, // 12 light red
    0xff55ff, // 13 light magenta
    0xffff55, // 14 yellow
    0xffffff  // 15 white
];

export const BLACK = 0, BLUE = 1, GREEN = 2, CYAN = 3, RED = 4, MAGENTA = 5,
    BROWN = 6, LTGRAY = 7, DKGRAY = 8, LTBLUE = 9, LTGREEN = 10, LTCYAN = 11,
    LTRED = 12, LTMAGENTA = 13, YELLOW = 14, WHITE = 15;

/**
 * Darkening chains, brightest first, one entry per shade level.
 *
 * EGA cannot scale a colour, so distance shading is a walk down a chain of
 * real palette entries. Repeats in a chain are deliberate: they control
 * how *fast* a colour falls off, which is the only lighting curve control
 * a 16-colour renderer has. Dark colours (blue, red, green) hold their
 * value for longer because there is nothing between them and black.
 */
const CHAINS = [
    [0, 0, 0, 0, 0, 0, 0, 0],           // black
    [1, 1, 1, 1, 1, 0, 0, 0],           // blue
    [2, 2, 2, 2, 2, 0, 0, 0],           // green
    [3, 3, 3, 1, 1, 1, 0, 0],           // cyan
    [4, 4, 4, 4, 4, 0, 0, 0],           // red
    [5, 5, 5, 1, 1, 1, 0, 0],           // magenta
    [6, 6, 6, 4, 4, 4, 0, 0],           // brown
    [7, 7, 8, 8, 8, 0, 0, 0],           // light gray
    [8, 8, 8, 8, 8, 0, 0, 0],           // dark gray
    [9, 9, 9, 1, 1, 1, 0, 0],           // light blue
    [10, 10, 10, 2, 2, 2, 0, 0],        // light green
    [11, 11, 3, 3, 1, 1, 0, 0],         // light cyan
    [12, 12, 12, 4, 4, 4, 0, 0],        // light red
    [13, 13, 5, 5, 1, 1, 0, 0],         // light magenta
    [14, 14, 6, 6, 4, 4, 0, 0],         // yellow
    [15, 15, 7, 7, 8, 8, 0, 0]          // white
];

/** Number of distinct shade steps the renderer may ask for. */
export const SHADES = 8;

/**
 * shadeTable[level * 16 + color] -> palette index.
 * Levels past the end of a chain clamp to its last entry.
 */
export const shadeTable = (() => {
    const t = new Uint8Array(SHADES * 16);
    for (let level = 0; level < SHADES; level++) {
        for (let c = 0; c < 16; c++) {
            const chain = CHAINS[c];
            t[level * 16 + c] = chain[Math.min(level, chain.length - 1)];
        }
    }
    return t;
})();

/** Classic 4x4 ordered dither, normalised to 0..15. */
export const BAYER = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
];

/**
 * Pick a shade level for a fractional depth, dithering between the two
 * neighbouring levels using the screen position so adjacent pixels
 * alternate instead of banding.
 */
export function ditherLevel(fLevel, x, y) {
    const base = fLevel | 0;
    const frac = fLevel - base;
    const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    return frac > threshold ? base + 1 : base;
}

/** Packed little-endian ABGR values for direct ImageData writes. */
export function paletteLUT(brightness = 1, tint = null) {
    const lut = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
        let r = (EGA[i] >> 16) & 0xff;
        let g = (EGA[i] >> 8) & 0xff;
        let b = EGA[i] & 0xff;
        if (tint) {
            r = r + (tint.r - r) * tint.amount;
            g = g + (tint.g - g) * tint.amount;
            b = b + (tint.b - b) * tint.amount;
        }
        r = Math.max(0, Math.min(255, r * brightness)) | 0;
        g = Math.max(0, Math.min(255, g * brightness)) | 0;
        b = Math.max(0, Math.min(255, b * brightness)) | 0;
        lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
    return lut;
}
