// Inn Over My Head — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.3.2';
export const SAVE_KEY = 'inn-over-my-head.v1';

export const STEP = 1 / 30;               // fixed simulation step (s); the hotel is slow and the battle turn-based
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const DAY_LEN = 180;               // seconds of hotel clock per in-game day
export const DAY_START = 0.25;            // the clock reads 6:00 at the start of a day (fraction of 24 h)

export const HOTEL = {
    dustOccupied: 0.4,                    // dust per second in an occupied room (0..100)
    dustEmpty: 0.1,
    bunnyDust: 20,                        // one dust bunny per 20 dust
    bunnyGrace: 6,                        // ...once there is more than this much (v1.1.0: any dust at all was a bunny)
    arriveBase: 48,                       // seconds between walk-in guests at reputation 0
    queueMax: 3,
    tipRate: 0.004,                       // tip per second = nightly rate × tipRate × sparkle / 5
    herbEvery: 40, herbCap: 10,           // the courtyard grows a herb every 40 s (a gardener halves it)
    forageEvery: 90,                      // a gardener forages a wild ingredient every 90 s
    staffSweepEvery: 7,                   // a housekeeper pops a dust bunny every 7 s
    idleCapDays: 2,                       // time away pays out at most two days
    pantryMax: 12,
};

export const COOK = {
    needleSpeed: 0.8,                     // stir needle sweeps 0 → 1 → 0 at this many cycles per second
    perfect: 0.07, good: 0.18,            // half-widths of the zones around 0.5
};

export const BATTLE = {
    aiDelay: 0.75,                        // seconds an enemy (or the auto-battle) waits before acting
    chainMax: 100,
    staggerTaken: 1.3,
    weak: 1.5, resist: 0.5, crit: 1.5, defend: 0.5,
    comboBonus: 0.5,
    fleeBase: 0.6,
};

export const BOND_LEVELS = [0, 40, 100, 180, 280];   // affinity points for bond levels 1..5
