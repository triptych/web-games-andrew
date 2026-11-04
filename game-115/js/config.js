// Hearthwick — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hearthwick.v1';

export const STEP = 0.1;                  // fixed simulation step (s). The town is an economy, not a physics body.
export const MAX_FRAME = 0.25;            // a long frame never runs more than this much real time

export const DAY_LEN = 240;               // seconds per game day at 1× speed
export const DAWN_HOUR = 6;               // day 1 starts at 6:00
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SEASON_DAYS = 6;

export const MAP = { w: 40, h: 28 };
export const HALL_POS = { x: 16, y: 11 };           // top-left tile of the 3×3 Hearth Hut
/** Owned land, by Hall level (index 0 is level 1). Everything outside is wild forest. */
export const BOUNDS = [
    { x0: 11, y0: 8, x1: 26, y1: 19 },
    { x0: 9, y0: 7, x1: 28, y1: 20 },
    { x0: 7, y0: 5, x1: 30, y1: 22 },
    { x0: 5, y0: 4, x1: 33, y1: 24 },
    { x0: 3, y0: 2, x1: 36, y1: 26 },
    { x0: 1, y0: 1, x1: 38, y1: 27 },
];

export const START = { gold: 40, wood: 8, stone: 4, villagers: 1 };

export const WALK_SPEED = 2.2;            // tiles per second, for travel times
export const HARVEST = { regrowTree: 150, regrowRock: 200, regrowBush: 90 };

/** Offline progress: the time away is scaled by `eff` and capped at `capHours`, then simulated. */
export const OFFLINE = { capHours: 6, eff: 0.25, step: 1, minAway: 60 };

export const HERO_SHARE = 0.7;            // the fraction of quest gold a hero keeps
export const QUEST_REFRESH_DAYS = 1;
export const RAID_FIRST_DAY = 5;
