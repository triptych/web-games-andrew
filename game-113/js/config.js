// Crystal Crescendo — tuning and constants. Shared by the sim, the view, the audio and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'crystal-crescendo.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ---------------------------------------------------------------- field
export const PLAYER = { speed: 3.6, radius: 0.3 };
export const ENEMY_FIELD = { speed: 1.25, chase: 2.3, sight: 3.6, radius: 0.36, wander: 2.2 };
export const TALK_RANGE = 1.25;

// ---------------------------------------------------------------- battle
export const LANES = 4;
export const BEATS_PER_BAR = 4;
export const PHRASE_BARS = 2;             // a call or a response is two bars
export const COUNT_IN_BEATS = 4;

/** Timing windows (s) by difficulty. A press farther than `good` from every note is ignored. */
export const WINDOWS = {
    easy:   { perfect: 0.060, great: 0.110, good: 0.165 },
    normal: { perfect: 0.045, great: 0.085, good: 0.130 },
    hard:   { perfect: 0.035, great: 0.065, good: 0.100 },
};
/** Note density and enemy power by difficulty. */
export const DIFF = {
    easy:   { density: 0, enemyAtk: 0.6, enemyHp: 0.85 },
    normal: { density: 1, enemyAtk: 1.0, enemyHp: 1.0 },
    hard:   { density: 2, enemyAtk: 1.3, enemyHp: 1.15 },
};
export const JUDGE = {
    perfect: { dmg: 1.0, cres: 2.2, label: 'PERFECT' },
    great:   { dmg: 0.75, cres: 1.2, label: 'GREAT' },
    good:    { dmg: 0.45, cres: 0.4, label: 'GOOD' },
};
/** Each princess's lane does something different. */
export const ROLE = {
    beat:    { dmg: 1.0 },                       // Lyra: plain damage, the strongest taps
    melody:  { dmg: 0.8, heal: 0.06 },           // Seraphine: damage + heals the most hurt princess (share of her max HP)
    lyrics:  { dmg: 0.7, ward: 2.4 },            // Marigold: damage + a ward that soaks enemy hits
    harmony: { dmg: 2.4, reso: 0.08 },           // Ingrid: holds; finishing one hits hard and raises resonance
};
export const WARD_MAX = 60;
export const RESO_MAX = 1.6;
export const COMBO_CAP = 60;                     // combo bonus grows to ×2 at this combo
export const CRES = { gain: 1, mult: 2, revive: 0.35 };
export const BLOCK = { good: 0.5 };              // a GOOD block still lets half through
export const HOLD_RELEASE_GRACE = 0.14;          // releasing this close to a hold's end still completes it

export const MAX_LEVEL = 30;
export const xpToNext = (lv) => Math.round(24 * Math.pow(lv, 1.45));
