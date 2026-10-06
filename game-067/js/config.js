// ============================================================
// Tootle Isles — configuration shared by the simulation, the view and the UI
// ============================================================

export const SAVE_KEY = 'tootle-isles.v1';

/** The world is an N×N grid of tiles, one world unit each, centred on the origin. */
export const N = 48;

/** Height of the land's top surface above the water line. Track, objects and people stand on it. */
export const LAND_H = 0.2;

/** Terrain types, stored one byte per tile. */
export const T = { WATER: 0, SAND: 1, GRASS: 2, PATH: 3, MEADOW: 4, SNOW: 5, ROCK: 6 };

export const TERRAIN = [
    { id: T.WATER, key: 'water', name: 'Water', emoji: '🌊' },
    { id: T.SAND, key: 'sand', name: 'Sand', emoji: '🏖️' },
    { id: T.GRASS, key: 'grass', name: 'Grass', emoji: '🌱' },
    { id: T.PATH, key: 'path', name: 'Path', emoji: '🧱' },
    { id: T.MEADOW, key: 'meadow', name: 'Meadow', emoji: '🌼' },
    { id: T.SNOW, key: 'snow', name: 'Snow', emoji: '❄️' },
    { id: T.ROCK, key: 'rock', name: 'Hill', emoji: '⛰️' },
];

/** Train speeds in tiles per second for the three speed settings (tortoise, rabbit, rocket). */
export const SPEEDS = [1.0, 1.9, 3.0];
export const ACCEL = 1.1;      // tiles/s²
export const BRAKE = 1.8;      // tiles/s² — comfortable braking for stations and buffers
export const DWELL = 3.6;      // seconds at a station

export const MAX_TRAINS = 12;
export const MAX_CARS = 10;
export const MAX_PEOPLE = 72;

/** The toy-brick palette. Train colours and tints are indices into this list. */
export const PALETTE = [
    { name: 'Brick Red', hex: 0xd8352a },
    { name: 'Sunny Yellow', hex: 0xf6c21c },
    { name: 'Bright Blue', hex: 0x1f6fd1 },
    { name: 'Leaf Green', hex: 0x35a548 },
    { name: 'Orange', hex: 0xf57d1f },
    { name: 'Bubblegum', hex: 0xf27bb2 },
    { name: 'Lilac', hex: 0x9a77d6 },
    { name: 'Teal', hex: 0x18a8a2 },
    { name: 'Snow White', hex: 0xf4f1ea },
    { name: 'Charcoal', hex: 0x34363d },
    { name: 'Navy', hex: 0x223a73 },
    { name: 'Forest', hex: 0x1d6b3a },
    { name: 'Tan', hex: 0xd9b77e },
    { name: 'Sky', hex: 0x7cc6f2 },
    { name: 'Maroon', hex: 0x8a1f2c },
    { name: 'Lime', hex: 0xa6d63a },
];

export const PALETTE_CSS = PALETTE.map((p) => '#' + p.hex.toString(16).padStart(6, '0'));
