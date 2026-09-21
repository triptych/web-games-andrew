/**
 * Seeded palette drawn from the real Atari 2600 NTSC colour ramp.
 *
 * The 2600 had 128 colours arranged as 16 hues x 8 luminances, and a game could
 * realistically show only a handful at once. We generate the run palette by
 * picking a hue family from the ramp and sampling luminances out of it, so every
 * run looks like a different 2600 cartridge but never leaves the hardware gamut.
 */

/**
 * The NTSC TIA hue table: base RGB at mid luminance for each of the 16 hues.
 * Luminance is applied as a scale toward white, matching how the TIA stepped
 * brightness within a hue column.
 */
const TIA_HUES = [
    [0x00, 0x00, 0x00], // 0  grey
    [0x44, 0x44, 0x00], // 1  gold
    [0x70, 0x28, 0x00], // 2  orange
    [0x84, 0x18, 0x00], // 3  bright orange
    [0x88, 0x00, 0x00], // 4  red
    [0x78, 0x00, 0x5c], // 5  purple
    [0x48, 0x00, 0x78], // 6  violet
    [0x28, 0x00, 0x84], // 7  blue-violet
    [0x00, 0x00, 0x88], // 8  blue
    [0x00, 0x18, 0x7c], // 9  blue-cyan
    [0x00, 0x2c, 0x5c], // 10 cyan
    [0x00, 0x3c, 0x2c], // 11 cyan-green
    [0x00, 0x3c, 0x00], // 12 green
    [0x14, 0x38, 0x00], // 13 green-yellow
    [0x2c, 0x30, 0x00], // 14 yellow-green
    [0x44, 0x28, 0x00]  // 15 orange-green
];

/** TIA luminance step: 0..7 brightens a hue toward white. */
function tia(hue, lum) {
    const base = TIA_HUES[hue % 16];
    const t = lum / 7;
    const r = Math.round(base[0] + (255 - base[0]) * t * 0.82);
    const g = Math.round(base[1] + (255 - base[1]) * t * 0.82);
    const b = Math.round(base[2] + (255 - base[2]) * t * 0.82);
    return `rgb(${r},${g},${b})`;
}

/**
 * Build a run palette. Positive and negative polarity get hues far apart on the
 * wheel so they stay distinguishable — that legibility is load-bearing, since
 * reading polarity at a glance is the entire skill of the game.
 */
export function makePalette(rng) {
    // Pick two hue families at least 5 steps apart on the 16-hue wheel.
    const hotHue = rng.pick([2, 3, 4, 5, 1]);
    const coldHues = [8, 9, 10, 11, 7].filter((h) => Math.abs(h - hotHue) >= 5);
    const coldHue = rng.pick(coldHues.length ? coldHues : [8]);
    const wallHue = rng.pick([6, 7, 8, 9, 10, 12]);

    return {
        hotHue,
        coldHue,
        // Background is near-black; the 2600 almost always used a black field.
        bg: tia(0, 0),
        // The playfield pattern behind everything.
        field: tia(wallHue, 1),
        fieldLit: tia(wallHue, 2),
        // Containment ring wall.
        wall: tia(wallHue, 3),
        wallHot: tia(wallHue, 5),
        // Positive polarity family (bright end).
        pos: tia(hotHue, 6),
        posDim: tia(hotHue, 3),
        posFaint: tia(hotHue, 1),
        // Negative polarity family.
        neg: tia(coldHue, 6),
        negDim: tia(coldHue, 3),
        negFaint: tia(coldHue, 1),
        // Core and HUD.
        core: tia(1, 5),
        coreHot: tia(3, 7),
        hud: tia(0, 5),
        hudDim: tia(0, 3),
        warn: tia(4, 6),
        good: tia(12, 6),
        white: tia(0, 7)
    };
}

/** Polarity-aware colour lookup used all over the renderer. */
export function polColor(pal, pol, tone) {
    const key = pol > 0 ? 'pos' : 'neg';
    if (tone === 'dim') return pal[key + 'Dim'];
    if (tone === 'faint') return pal[key + 'Faint'];
    return pal[key];
}
