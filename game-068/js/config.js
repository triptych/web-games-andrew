// Shared constants: the grid, timing, save key and the colour themes of the three acts.

export const W = 24;            // map columns (x)
export const H = 15;            // map rows (z)
export const HAVEN_COLS = 3;    // the Haven fills the right-hand three columns
export const STEP = 1 / 30;     // fixed simulation step, seconds
export const SAVE_KEY = 'haven-road.v1';
export const VERSION = '1.0.0';

export const MAX_ACTORS = 220;  // people + volunteers + dead drawn at once
export const MAX_FX = 1600;     // particles

// Ground, road and scenery colours per act (0xRRGGBB).
export const THEMES = {
    autumn: {
        name: 'Maple Hollow',
        grass: [0x7f9a45, 0x93a64c, 0x6f8a3c, 0xa8a04a], road: 0xa98b62, roadEdge: 0x7e6644, rut: 0x8f7450,
        haven: 0xb59a6a, fog: 0xe9d7b8, skyTop: 0x7fb1dc, skyHor: 0xf5dcb4, sun: 0xffe2b8, sunI: 2.4,
        hemiSky: 0xfff0d8, hemiGround: 0x6a5a3a, hemiI: 1.05, night: 0.05, weather: 'leaves',
        leaves: [0xd9622b, 0xe8a33a, 0xc4432a, 0xf0c64a, 0x9c6b2f],
    },
    winter: {
        name: 'Frostford',
        grass: [0xe8eef4, 0xdce6ee, 0xf4f7fa, 0xcfdbe6], road: 0x9a948c, roadEdge: 0x6f6a64, rut: 0x857f78,
        haven: 0xc9c2b4, fog: 0xd8e2ee, skyTop: 0x8aa6c8, skyHor: 0xe4ecf4, sun: 0xfff2e4, sunI: 2.0,
        hemiSky: 0xe8f0ff, hemiGround: 0x8a96a8, hemiI: 1.15, night: 0.12, weather: 'snow',
        leaves: [0xffffff],
    },
    city: {
        name: 'Lantern City',
        grass: [0x4f6a46, 0x5a6e4a, 0x465e40, 0x63745a], road: 0x55575e, roadEdge: 0x3c3e44, rut: 0x4a4c52,
        haven: 0x7d7468, fog: 0x2a3150, skyTop: 0x0f1a3a, skyHor: 0x3b3f66, sun: 0x9fb4ff, sunI: 0.7,
        hemiSky: 0x7f8fc8, hemiGround: 0x2a2a38, hemiI: 0.85, night: 0.85, weather: 'rain',
        leaves: [0x9fb6d8],
    },
};

// Act II's chapel level and Open Road's evenings use a dusk variant of a theme.
export const DUSK = { skyTop: 0x3a3f7a, skyHor: 0xf2a07a, sun: 0xffb37a, sunI: 1.2, hemiI: 0.85, fog: 0x8a6f8a, night: 0.55 };
