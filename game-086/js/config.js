/** config.js — tunable numbers. Pure. */
export const VERSION = '2.1.0';
export const SAVE_KEY = 'colorverse.save.v2';
export const SAVE_VERSION = 2;

export const VIEW = {
    maxCell: 72,        // CSS px per pixel at full zoom
    numbersAt: 15,      // cell size (CSS px) from which numbers are drawn
    gridAt: 7,          // cell size from which grid lines are drawn
    fitMargin: 0.92,    // the picture fills this much of the stage when fitted
    pinchCancelMs: 260, // a second finger this soon after the first undoes the first finger's stroke
};

export const GLIMMER = {
    perPixel: 1,
    completeBonus: 0.25,  // × pixels, on finishing a mosaic
    flawlessBonus: 0.2,   // × pixels, if no mistakes were made
    chapterBonus: 120,
    catcherBonus: 0.25,   // Glimmer Catcher skill
    streakCap: 120,       // Streak Spark: multiplier rises to 1 + streakMax over this many correct pixels
    streakMax: 0.5,
};

export const STARBURST = { pixelsPerCharge: 120, maxCharges: 3, radius: 5 };
export const SUPERNOVA = { maxCharges: 5, radius: 7 };  // Supernova skill upgrades Starburst
export const FLOURISH_AT = 0.9;   // Final Flourish appears at this much done
export const LANTERN_AT = 12;     // Lantern Light marks a colour's pixels once this few remain
export const MOONLIT_AT = 40;     // ...or this few with Moonlit Lanterns
export const GILDED = 2;          // Gilded Frame multiplies the complete and flawless bonuses

// Slips: painting a wrong pixel with a colour is a slip against that colour. Too many and the colour
// smudges: all of its paint is wiped (and its Glimmer taken back) and it starts over.
// The limit scales with how many pixels the colour has: one per `per`, between `min` and `max`.
export const SLIPS = { min: 5, max: 15, per: 10, warnAt: 2 };
