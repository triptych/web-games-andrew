// Doom & Doilies — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'doom-and-doilies.v1';

// An idle game needs no physics: a 30 Hz step is plenty, and a long frame may run up to a tenth of a second
// so a slow phone still keeps real time. Gaps longer than that (a hidden tab, a closed browser) go through
// the 'idle' command and the offline rules instead.
export const STEP = 1 / 30;
export const MAX_FRAME = 0.1;

export const COST_GROWTH = 1.15;           // each minion of a kind costs this much more than the last

export const CLICK = { base: 1 };
export const FLOW = { gain: 6, decay: 26, max: 100, window: 0.6, bonus: 1 };   // flow: rapid crafting, up to ×(1 + bonus)

export const DREAD = {
    start: 50,
    decay: 0.22,             // per second, before minions
    perMinion: 0.0012,       // every minion makes the castle a little cosier, and the rumours spread a little faster
    cackle: 14,
    cackleCd: 5,
    // [floor, production multiplier, tribute] — Suspected, Unsettling, Feared, Dreaded
    tiers: [
        { id: 'suspected', name: 'Suspected', from: 0, mul: 0.8, tribute: 0 },
        { id: 'unsettling', name: 'Unsettling', from: 20, mul: 1, tribute: 0 },
        { id: 'feared', name: 'Feared', from: 50, mul: 1.15, tribute: 1 },
        { id: 'dreaded', name: 'Dreaded', from: 80, mul: 1.3, tribute: 2 },
    ],
};
export const TRIBUTE = { base: 0.1 };      // gold per second at Feared, before scaling

export const VISITOR = { min: 70, max: 190, life: 14 };
export const OFFLINE = { rate: 0.5, cap: 8 * 3600, chunk: 10 };
export const LEGEND = { base: 1e12, bonus: 0.02 };  // legend = floor(cbrt(lifetime charm / base)); +2% each
export const ACH_BONUS = 0.01;
export const HENCH = { base: 8, growth: 1.5, max: 10 };
export const BOARD_SLOTS = 3;
export const MASTERY = { first: 100, growth: 5, bonus: 0.03 };
