// SHARDFRAME — tuning and constants. Shared by the sim, the view and the tests.
// World units: one map cell is one unit; the sim is 2D (x, y) plus a height z for voxels.

export const VERSION = '1.3.0';
export const SAVE_KEY = 'shardframe.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const MAP = { w: 152, h: 152, maxH: 3 };   // 10x the area of v1.1's 48x48
/** The big map stays fast and fair: the monsters' flow field reaches this far (in cells) from the
 *  mech, hives only breed while the mech is within `wake`, and ordinary monsters left further
 *  behind than `cull` quietly go. Objectives sit between `near` and `far` from the landing zone. */
export const FIELD = { flow: 40, wake: 44, cull: 64, near: 16, far: 34, boss: 24 };

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

/** The Shard Beam: charged by collecting voxels, fired by hand, then a cooldown. It cuts through rock. */
export const SHARD_BEAM = { perVoxel: 0.025, cooldown: 9, time: 0.8, tick: 0.1, dmg: 26, width: 1.1, range: 18, terrain: 14, turn: 2.5, hive: 0.25 };  // hive: hives are armoured against it (balance: at 1 or 0.5 hive sorties got 20-25% shorter)
/** Tap (or click) the field to focus fire on a monster or hive near the tap; auto-aim resumes when it's gone. */
export const FOCUS = { pick: 2.6, hive: 2.8, range: 1.25 };
/** Below this share of HP (shield not counted) the klaxon sounds and the screen edge burns red. */
export const DANGER = 0.25;

export const VOXEL = {
    size: 0.3,              // a voxel is this big; settled ones stack this high
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
