// Echoheart Academy — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'echoheart-academy.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The campus overmap, in world units (x east, z south). The island is a disc of this radius.
export const MAP = { radius: 46, speed: 9, near: 3.2, charmR: 1.4 };

export const DAYS = 11;                   // day 11's night is the Starfall Festival and the Hollow Moon
export const SLOTS = ['morning', 'afternoon', 'evening', 'night'];

export const BOND = {
    perHeart: 15, maxHearts: 10,
    talk: 3, play: [2, 3, 4, 5],         // C, B, A, S
    gift: { love: 6, like: 3, meh: 1 },
    events: [2, 5, 8],                   // heart levels that unlock the three heart events
    danceHearts: 3,                      // who can be asked to the Starfall dance
};

export const BATTLE = {
    wait: 0.9,                           // seconds the view gets to animate each action
    ctFull: 100,
    lvCap: 15,
    xpFor: (lv) => 24 * lv,
    guard: 0.5, shield: 0.5,
    weak: 1.5, resist: 0.5,
    echoBoss: 1.5,                       // Kai's echo against the Hollow Choir's master
    xpMul: 1.6,                          // battle XP
    miniXp: [3, 4, 6, 8],                  // XP for everyone who has joined, by mini-game grade (C..S)
    retryEase: 0.9, retryFloor: 0.6,     // each retry of a story battle shrinks the foes' HP this much
};

export const CLIMAX = {
    time: 360,                           // seconds of the Hollow Moon's rise (map time)
    battleCost: 40,                      // each rescue battle burns this much moon time
    perUnrescued: 0.15,                  // the boss is this much stronger for each student not freed
    lateBonus: 0.25,                     // and this much more if the moon rose before you got there
};

export const START = { lumens: 60, inv: { healing: 2, mana: 1, candy: 1 } };
