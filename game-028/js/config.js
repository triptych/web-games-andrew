// Echoes of Aethermoor — version, save key and tuning. Shared by the sim, the view and the tests.

export const VERSION = '2.0.1';
export const SAVE_KEY = 'echoes-of-aethermoor.v2';

// Party and growth. One shared level for the whole party (late recruits arrive at the party's level).
export const MAX_LEVEL = 20;
export const xpToNext = (lv) => Math.round(40 + 30 * lv + 6 * lv * lv);
export const GROWTH = { hp: 0.11, mp: 0.07, atk: 0.075, def: 0.07, spd: 0.035 };

// Battle
export const CRIT_CHANCE = 0.06;
export const CRIT_MULT = 1.5;
export const PHYS_DEF = 0.6;       // physical damage = atk × power − def × PHYS_DEF
export const MAGIC_DEF = 0.3;      // magic ignores most armour
export const VARIANCE = 0.1;       // ±10%
export const POISON_FRAC = 0.07;   // of max HP each turn
export const GUARD_MULT = 0.5;
export const MARK_MULT = 1.3;
export const WEAK_MULT = 0.7;
export const ATKUP_MULT = 1.3;
export const SLOW_MULT = 0.5;
export const DEFEND_MP = 0.08;     // Defend restores this much of max MP
export const FLEE_BASE = 0.55;

// Exploration
export const ENCOUNTER_GRACE = 6;  // steps after a map change or a battle with no random battle
export const INN_COST = 30;
export const DEFEAT_GOLD = 0.5;    // waking at the inn after a wipe costs this share of the gold

// Presentation (view only)
export const TILE = 48;            // map tile in CSS px at zoom 1
export const STEP_TIME = 0.16;     // seconds a walk step takes on screen
export const TYPE_CPS = 48;        // typewriter characters a second
