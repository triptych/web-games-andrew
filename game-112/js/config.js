// Quill & Legion — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'quill-legion.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const AI_DELAY = 0.3;              // sim seconds between enemy actions (the view also holds the sim while it animates)

/** The battlefield: an odd-r offset hex grid. Columns 0-1 are yours to deploy on, the last two the foe's. */
export const FIELD = { cols: 9, rows: 6, deploy: 2 };

export const HAND = { draw: 5, ink: 3, max: 10 };
export const ARMY_MAX = 5;                // stacks in the legion

/** HoMM-style attack against defence: +5% a point above, -2.5% a point below. */
export const COMBAT = {
    atkStep: 0.05, atkCap: 3,
    defStep: 0.025, defFloor: 0.3,
    flank: 0.2,                           // +20% per other friendly stack touching the target
    flankCap: 0.6,
    rangedInMelee: 0.5,                   // an archer with a foe at its elbow shoots at half
    weak: 0.75, vuln: 1.5,
    recover: 0.3,                         // share of a battle's fallen who rejoin after a victory
};

export const MAP = { floors: 8, lanes: 5, paths: 4 };   // floors 0..7, then the boss
export const ACTS = 3;

export const START = {
    gold: 120,
    army: [['pikemen', 22], ['bowmen', 12], ['wolves', 5]],
    deck: ['strike', 'strike', 'strike', 'strike', 'strike', 'holdfast', 'holdfast', 'holdfast', 'onslaught', 'firebolt'],
    hero: { atk: 0, def: 0, lore: 1 },
};

export const XP = { base: 100, step: 30 };     // level n costs base + step·(n-1)
export const GOLD = { skirmish: [100, 140], elite: [170, 220], boss: [280, 340], act: 1.8 };
export const SHOP = { remove: 60, removeStep: 25 };
