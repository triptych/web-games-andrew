/**
 * biomes.js — the look of each chapter: palettes, floor-painter recipes,
 * obstacle and pit styles, lighting, fog, ambient particles, props and the
 * hue enemies are tinted toward. Colours are 0xRRGGBB.
 *
 * Everything visual is generated from these recipes at runtime — there are
 * no image or model files in the game.
 */

export const BIOMES = {
    glade: {
        bg: 0x1d3a24, fog: 0x2b4f30, hemiSky: 0xd8f0ff, hemiGround: 0x3a5a2a, sun: 0xfff1d0, sunI: 2.3, hemiI: 1.1,
        floor: { base: 0x5c9a3c, alt: 0x4f8a33, checker: 0.07, blades: 0x7cc44a, specks: [0x8fcf55, 0x3d7429, 0xe6d27a], splotch: 0x7a6a3a, speckN: 1400 },
        wall: { base: 0x6b7a5a, mortar: 0x3c4632, top: 0x5b8f3a },
        rock: 'boulder', rockColor: 0x8a8f7c, rockAlt: 0x6f7a5e, moss: 0x5c9a3c,
        pit: 'water', pitA: 0x2a7fa8, pitB: 0x6fd3e8,
        particles: 'fireflies', pColor: 0xd8ff7a,
        props: ['tree', 'tree', 'bush', 'flower'], outer: 0x2f5a2a,
        tint: 0.0,
    },
    crypt: {
        bg: 0x15141f, fog: 0x1d1b2b, hemiSky: 0xb9b6ff, hemiGround: 0x2a2433, sun: 0xc9d4ff, sunI: 1.7, hemiI: 0.9,
        floor: { base: 0x5a5866, alt: 0x4d4b59, checker: 0.05, grout: 0x2a2833, groutW: 6, bevel: true, cracks: 8, specks: [0x6f6d7c, 0x3b3946], speckN: 900, moss: 0x4b6b3f },
        wall: { base: 0x4f4c5c, mortar: 0x24222c, top: 0x3d3a48 },
        rock: 'tomb', rockColor: 0x75727f, rockAlt: 0x5b5866, moss: 0x4b6b3f,
        pit: 'chasm', pitA: 0x07060d, pitB: 0x3b2f6b,
        particles: 'dust', pColor: 0xbfb8ff,
        props: ['grave', 'grave', 'candle', 'deadtree'], outer: 0x1c1a26,
        tint: 0.62,
    },
    ember: {
        bg: 0x2a130c, fog: 0x3b1a10, hemiSky: 0xffd2a8, hemiGround: 0x4a2412, sun: 0xffc48a, sunI: 2.4, hemiI: 0.9,
        floor: { base: 0x9a6a44, alt: 0x8a5c3a, checker: 0.06, cracks: 22, crackColor: 0x5a3521, specks: [0xb58656, 0x6a4128], speckN: 1500, splotch: 0x6d3a22 },
        wall: { base: 0x7a4a30, mortar: 0x3a1f12, top: 0x9a6a44 },
        rock: 'mesa', rockColor: 0x9c5a38, rockAlt: 0x7a3f24, moss: 0xc98a4a,
        pit: 'lava', pitA: 0xff4a0a, pitB: 0xffd04a,
        particles: 'embers', pColor: 0xff9a3a,
        props: ['cactus', 'cactus', 'bones', 'mesa'], outer: 0x5a2c16,
        tint: 0.05,
    },
    frost: {
        bg: 0x16263a, fog: 0x2c4a66, hemiSky: 0xe8f6ff, hemiGround: 0x6a86a8, sun: 0xeaf4ff, sunI: 2.2, hemiI: 1.2,
        floor: { base: 0xcfe2f0, alt: 0xbad2e6, checker: 0.05, grout: 0x9bb8d2, groutW: 3, cracks: 10, crackColor: 0x8fb0cf, specks: [0xffffff, 0xa6c4de], speckN: 1600 },
        wall: { base: 0x8fa8c4, mortar: 0x5a7390, top: 0xf2f8ff },
        rock: 'ice', rockColor: 0x9fd6ff, rockAlt: 0x6ab4ef, moss: 0xffffff,
        pit: 'icewater', pitA: 0x1a4a7a, pitB: 0x7ac8ff,
        particles: 'snow', pColor: 0xffffff,
        props: ['pine', 'pine', 'iceshard', 'snowrock'], outer: 0xdfeaf5,
        tint: 0.55,
    },
    fungal: {
        bg: 0x1a1226, fog: 0x2a1a3a, hemiSky: 0xe0b8ff, hemiGround: 0x2e2040, sun: 0xd6b0ff, sunI: 1.6, hemiI: 1.0,
        floor: { base: 0x4a3d5c, alt: 0x40344f, checker: 0.06, specks: [0x6f5a8a, 0x2f2640, 0x9ae07a], speckN: 1800, splotch: 0x5a7a3a, moss: 0x5a8a3a },
        wall: { base: 0x4d3f60, mortar: 0x221a2c, top: 0x6a8a3a },
        rock: 'mushroom', rockColor: 0xc05a8a, rockAlt: 0xe8d8c8, moss: 0x9ae07a,
        pit: 'acid', pitA: 0x3a8a1a, pitB: 0xc8ff5a,
        particles: 'spores', pColor: 0xb8ff8a,
        props: ['bigshroom', 'bigshroom', 'glowshroom', 'root'], outer: 0x2a2038,
        tint: 0.8,
    },
    tidal: {
        bg: 0x0c2a33, fog: 0x154552, hemiSky: 0xc8fff4, hemiGround: 0x1f4a4a, sun: 0xd8fff4, sunI: 2.0, hemiI: 1.1,
        floor: { base: 0x6f8a80, alt: 0x637d74, checker: 0.06, grout: 0x3f5550, groutW: 5, bevel: true, cracks: 6, specks: [0x8fb0a0, 0x4f6a60, 0xe8e0c0], speckN: 1100, moss: 0x3f7a5a },
        wall: { base: 0x5f7a72, mortar: 0x2f403c, top: 0x3f7a5a },
        rock: 'ruin', rockColor: 0xa8b8a8, rockAlt: 0x7a9488, moss: 0x3f7a5a,
        pit: 'water', pitA: 0x0f5a6a, pitB: 0x5ae0d0,
        particles: 'bubbles', pColor: 0xaaffff,
        props: ['coral', 'column', 'kelp', 'coral'], outer: 0x19424a,
        tint: 0.45,
    },
    forge: {
        bg: 0x120c0c, fog: 0x1f1210, hemiSky: 0xffb08a, hemiGround: 0x2a1410, sun: 0xffa060, sunI: 1.9, hemiI: 0.8,
        floor: { base: 0x3a3438, alt: 0x322c30, checker: 0.05, grout: 0x1a1618, groutW: 5, bevel: true, glowCracks: 0xff6a1a, cracks: 7, specks: [0x4a4448, 0x241e20], speckN: 800 },
        wall: { base: 0x3a3236, mortar: 0x120e10, top: 0x5a4a48 },
        rock: 'obsidian', rockColor: 0x2a2230, rockAlt: 0x46384c, moss: 0xff6a1a,
        pit: 'lava', pitA: 0xff3a00, pitB: 0xffc03a,
        particles: 'sparks', pColor: 0xffb04a,
        props: ['anvil', 'chimney', 'chain', 'chimney'], outer: 0x1c1414,
        tint: 0.95,
    },
    crystal: {
        bg: 0x140f2e, fog: 0x21184a, hemiSky: 0xc8d0ff, hemiGround: 0x2a2060, sun: 0xd0c8ff, sunI: 1.8, hemiI: 1.1,
        floor: { base: 0x4a4478, alt: 0x423c6c, checker: 0.07, grout: 0x2a2450, groutW: 4, bevel: true, specks: [0x8a7ae0, 0x2e2858, 0x7af0ff], speckN: 1000, cracks: 5, glowCracks: 0x7ae0ff },
        wall: { base: 0x4a4278, mortar: 0x1e1840, top: 0x6a5ab0 },
        rock: 'crystal', rockColor: 0x9a7aff, rockAlt: 0x5ae0ff, moss: 0x7ae0ff,
        pit: 'chasm', pitA: 0x05031a, pitB: 0x6a3aff,
        particles: 'glints', pColor: 0xa8f0ff,
        props: ['crystal', 'crystal', 'geode', 'crystal'], outer: 0x1c1640,
        tint: 0.7,
    },
    sky: {
        bg: 0x6aa8e0, fog: 0x9cc8f0, hemiSky: 0xffffff, hemiGround: 0x8aa0c8, sun: 0xfff4dc, sunI: 2.5, hemiI: 1.25,
        floor: { base: 0xe8e2d4, alt: 0xddd6c6, checker: 0.05, grout: 0xc9a85a, groutW: 4, bevel: true, specks: [0xf6f2ea, 0xc8c0b0], speckN: 900, cracks: 3 },
        wall: { base: 0xe0d8c8, mortar: 0xb8a078, top: 0xd8b860 },
        rock: 'pillar', rockColor: 0xf2ede2, rockAlt: 0xd8b860, moss: 0xd8b860,
        pit: 'sky', pitA: 0x7ab8f0, pitB: 0xffffff,
        particles: 'clouds', pColor: 0xffffff,
        props: ['cloud', 'column', 'statue', 'cloud'], outer: 0x9cc8f0,
        tint: 0.12,
    },
    void: {
        bg: 0x07040f, fog: 0x10081e, hemiSky: 0xd08aff, hemiGround: 0x1a0a2a, sun: 0xe0a0ff, sunI: 1.6, hemiI: 0.85,
        floor: { base: 0x241a36, alt: 0x1e152e, checker: 0.08, grout: 0x0c0816, groutW: 5, bevel: true, runes: 0xb05aff, specks: [0x3a2a54, 0x0e0a18], speckN: 700 },
        wall: { base: 0x2a1e40, mortar: 0x0a0612, top: 0x4a2a7a },
        rock: 'voidshard', rockColor: 0x1a1028, rockAlt: 0xb05aff, moss: 0xb05aff,
        pit: 'void', pitA: 0x000000, pitB: 0xb05aff,
        particles: 'motes', pColor: 0xd08aff,
        props: ['voidspire', 'voidspire', 'eyestalk', 'voidspire'], outer: 0x0c0718,
        tint: 0.78,
    },
};

export const getBiome = (id) => BIOMES[id] ?? BIOMES.glade;
