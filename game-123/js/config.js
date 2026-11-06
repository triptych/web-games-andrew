// Atlas of Ink — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'atlas-of-ink.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const WORLD = { w: 72, h: 44 };   // cells

/** Terrain codes. 0 is blank parchment: nothing charted there yet. */
export const T = {
    BLANK: 0, DEEP: 1, SEA: 2, SHOAL: 3, SAND: 4, PLAINS: 5, FOREST: 6,
    HILLS: 7, MOUNTAIN: 8, SWAMP: 9, DESERT: 10, RIVER: 11, LAKE: 12,
};
export const TERRAIN_NAMES = [
    'blank parchment', 'deep sea', 'sea', 'shoals', 'beach', 'plains', 'forest',
    'hills', 'mountains', 'swamp', 'desert', 'river', 'lake',
];

/** The quill that carries the spell across the sheet. */
export const QUILL = { speed: 15, channelSpeed: 0.55 };

/**
 * The scrying spell. Hold to focus, release to cast. Standing still builds focus (full in focusTime);
 * moving bleeds it. Focus sets the radius and how true the ink is: a rushed cast is wide of the mark.
 */
export const SCRY = {
    minR: 2.2, maxR: 5.6,
    focusTime: 1.0,
    errMax: 0.6, errMin: 0.01,           // chance a cell is inked as the wrong terrain: errMin + errMax·(1−focus)^1.5
    featureFocus: 0.35,                  // below this the spell cannot resolve a town, ore vein or reef
    bleed: 1.6,                          // focus lost per second at full stick
    still: 0.15,                         // stick magnitude that still counts as holding still
    preInkR: 2.5,                        // the client's own starting place is already on the sheet
};

/** Cost of entering a cell, by terrain. Infinity = cannot be crossed. Index = terrain code. */
export const COST = {
    foot: [6, Infinity, Infinity, Infinity, 1.2, 1, 2, 3, 9, 6, 3, 4, Infinity],
    ship: [6, 1, 1, 4, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity],
};
/** Terrain that hurts whoever crosses it, as opposed to merely slowing them. */
export const HAZARD = {
    foot: [T.SWAMP, T.MOUNTAIN],
    ship: [T.SHOAL],
};

export const POINTS = { star: 100, perSecond: 2 };
export const RANKS = [
    { min: 16, name: 'Royal Cartographer' },
    { min: 12, name: 'Guildmaster of the Compass' },
    { min: 8, name: 'Journeyman Mapmaker' },
    { min: 0, name: 'Apprentice Scribe' },
];
