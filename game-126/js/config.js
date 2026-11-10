// EMBERSPIRE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.2';
export const SAVE_KEY = 'emberspire.v1';

export const STEP = 1 / 60;               // fixed step for pacing the battle (s)
export const MAX_FRAME = 0.05;

export const PARTY_MAX = 4;
export const EVOLVE_LV = 15;              // choose an evolution at the Temple
export const ASCEND_LV = 40;              // the evolution ascends (third tier)
export const TIER_MULT = [1, 1, 1.12, 1.3];   // stat multiplier by class tier (index = tier)

// How long the AI waits before acting (game seconds at 1x): enough for the view to play the last action.
export const AI_DELAY = 0.55;

export const START = { gold: 150, potion: 3, ether: 1, phoenix: 1 };

// between floors the party catches its breath
export const REST = { floor: 0.12, mini: 0.4, boss: 0.6, mpFloor: 0.10, mpMini: 0.35, mpBoss: 0.5 };
export const FLEE_CHANCE = 0.65;          // running from a normal fight (never from a mini boss or boss)
export const DEFEAT_GOLD_LOSS = 0.3;      // share of the gold earned this run that is lost on defeat

// Idle: Hearthmere pays a tithe for every floor you've cleared, and benched heroes run errands.
export const IDLE = { capHours: 8, titheFloors: 0.08, errandXp: 0.12, errandGold: 0.04, errandOre: 1 / 60 };

// Combat
export const CRIT_BASE = 5;               // %
export const CRIT_MUL = 1.75;
export const WEAK_MUL = 1.5;
export const RESIST_MUL = 0.5;
export const BUFF_MUL = 1.35;             // atkup/defup/magup
export const DEBUFF_MUL = 0.72;           // atkdown/defdown
export const CT_FULL = 1000;              // charge time: a unit acts when its gauge fills
export const MAX_ROUNDS = 80;             // a stalemate ends as a defeat (a bot safety net more than a rule)

export const SHOP_GEAR = 6;

// With auto battle on, the victory screen climbs on by itself after this many seconds (never into a mini boss or boss).
export const AUTO_NEXT_SECONDS = 10;               // gear pieces on Zephyrine's shelf each day
