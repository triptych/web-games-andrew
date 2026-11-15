// SHARDFRAME — tuning and constants. Shared by the sim, the view and the tests.
// World units: one map cell is one unit; the sim is 2D (x, y) plus a height z for voxels.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'shardframe.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const MAP = { w: 48, h: 48, maxH: 3 };

export const MECH = {
    radius: 0.62,
    baseHp: 100,
    speed: 6.0,             // legs override
    pickup: 1.1,            // walking over voxels collects them within this radius
    magnet: 4.5,            // holding MAGNET pulls voxels from this far
    magnetPull: 16,         // speed voxels fly to the mech
    magnetSlow: 0.55,       // movement while the magnet is held
    magnetFire: 0.6,        // fire-rate while the magnet is held
    debrisSlow: 0.8,        // wading through settled voxels
    hitIframes: 0.35,
    shieldDelay: 2.0,       // seconds without damage before the shield recharges
};

export const XP = { first: 10, grow: 7 };        // red voxels for level n: first + grow*(n-1)

export const OVERDRIVE = { perKill: 0.018, perHive: 0.2, time: 5, fire: 2, dmg: 1.5 };

export const VOXEL = {
    size: 0.38,             // a voxel is this big; settled ones stack this high
    gravity: 26,
    bounce: 0.32,
    friction: 0.55,
    settleSpeed: 1.2,
    life: 14,               // a settled voxel fades after this long
    maxStack: 3,            // per cell
    cap: 900,               // voxels alive at once; the oldest settled ones go first
    // what each colour gives
    red: 1,                 // xp
    blue: 5,                // shield
    green: 4,               // hp
    gold: 1,                // credits (scaled by mission tier)
};
export const COLORS = ['red', 'blue', 'green', 'gold', 'stone', 'crystal', 'rust', 'neon', 'hive'];
export const COLLECTIBLE = { red: true, blue: true, green: true, gold: true };

export const RESCUE = { radius: 2.2, time: 3.5, guards: 5 };
export const EVAC = 30;                   // seconds to hold out after the objectives, until the lift arrives (not after a boss)
export const ENEMY_CAP = 220;
export const FLOW_EVERY = 0.25;           // seconds between flow-field rebuilds
export const CHEW = 0.45;                 // an enemy pushing into debris eats one voxel this often
export const FINISH_DELAY = 2.6;          // seconds of "MISSION COMPLETE" before the debrief
export const IDLE_CAP = 8 * 3600;         // offline time counted for crew gifts
export const GIFT_CAP = 3;                // gifts a crew member keeps waiting
export const LOSS_KEEP = 0.5;             // share of collected credits kept on a failed sortie
