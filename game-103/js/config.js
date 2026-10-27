// Crown & Crumpet — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.4';
export const SAVE_KEY = 'crown-and-crumpet.v1';

export const STEP = 1 / 120;              // fixed step for the view's animation clock (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much time

export const CT_READY = 100;              // charge a unit needs before it takes a turn
export const MAX_TURNS = 500;             // a battle that drags past this many turns is lost (stall guard)

export const RULES = {
    heightBonus: 0.08,                    // per level of height advantage, either way, up to ±2 levels
    cover: 0.85,                          // damage taken on forest
    cheer: 1.25,                          // damage dealt while cheered
    guard: 0.65,                          // damage taken while guarded
    teamwork: 0.1,                        // per other ally standing next to the target, up to 2
    regen: 3,                             // hp per turn, plus level
    mpPerTurn: 1,
    yieldAt: 0.35,                        // the Dread Lord gives up at this fraction of his hp
};
