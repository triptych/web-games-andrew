// Dawnshard Saga — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'dawnshard-saga.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const MAX_LEVEL = 50;
export const MAX_ACTIVE = 4;              // party members in battle
export const MAX_BP = 5;
export const MAX_BOOST = 3;
export const MAX_ITEMS = 99;

// World geometry: 1 tile = 1 world unit; heights are in half-tile levels.
export const LEVEL_H = 0.5;
export const OVER_W = 96;
export const OVER_H = 72;

// Walking speeds (tiles / s)
export const WALK = { over: 5.2, town: 4.2, dungeon: 4.4 };
export const PLAYER_R = 0.28;

// Random encounters on the overmap: tiles walked between fights
export const ENCOUNTER = { min: 26, max: 56, dungeonChase: 5.2, dungeonNotice: 4.4 };

// Day length on the overmap (s of game time per full day)
export const DAY_SECONDS = 540;

export const WORLD_SEED = 0x5ea5d0;       // the geography is authored; towns, dungeons and quests vary with the game seed
