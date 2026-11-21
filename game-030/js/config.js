// Coppergate Lane: version, save key and tuning. Shared by the sim, the view and the tests.

export const VERSION = '2.0.0';
export const SAVE_KEY = 'coppergate-lane.v2';

// Party and growth. One shared level for the whole party (late recruits arrive at the party's level).
export const MAX_LEVEL = 12;
export const xpToNext = (lv) => Math.round(24 + 16 * lv + 5 * lv * lv);
export const GROWTH = { hp: 0.13, mp: 0.08, atk: 0.08, def: 0.075, spd: 0.03 };

// Battle
export const CRIT_CHANCE = 0.06;
export const CRIT_MULT = 1.5;
export const PHYS_DEF = 0.6;       // physical damage = atk × power − def × PHYS_DEF
export const MAGIC_DEF = 0.3;      // gadgets and sparks ignore most armour
export const VARIANCE = 0.1;       // ±10%
export const GUARD_MULT = 0.5;
export const ATKUP_MULT = 1.3;
export const RUST_MULT = 0.7;      // rusted armour: defence ×0.7
export const WEAK_MULT = 0.7;
export const DEFEND_MP = 0.08;     // Defend restores this much of max MP
export const FLEE_BASE = 0.55;

// Exploration
export const ENCOUNTER_GRACE = 6;  // steps after a map change or a battle with no random battle
export const REST_COST = 20;       // a bed above Bertram's shop
export const DEFEAT_GOLD = 0.25;   // being dragged home after a wipe costs this share of the gold

// Presentation (view only)
export const STEP_TIME = 0.16;     // seconds a walk step takes on screen
export const TYPE_CPS = 48;        // typewriter characters a second
