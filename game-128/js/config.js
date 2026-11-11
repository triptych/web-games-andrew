// Gemheart Saga — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.4.0';
export const SAVE_KEY = 'gemheart-saga.v1';

export const STEP = 1 / 60;               // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ---------------------------------------------------------------- the board
export const BOARD = { w: 8, h: 8 };
// Gem kinds. 0..5 are matchable; STONE never matches (breaks when a match lands next to it); DOOM matches like
// nothing but is cleared by any match touching it, or bursts when its count reaches zero.
export const GEM = { SWORD: 0, HEART: 1, RUBY: 2, SAPPHIRE: 3, EMERALD: 4, AMETHYST: 5, STONE: 6, DOOM: 7 };
export const KINDS = 6;
export const GEM_NAMES = ['Sword', 'Heart', 'Ruby', 'Sapphire', 'Emerald', 'Amethyst', 'Stone', 'Doom'];
export const MANA_OF = { 2: 'r', 3: 's', 4: 'e', 5: 'a' };      // gem kind -> mana pool
export const GEM_OF = { r: 2, s: 3, e: 4, a: 5 };
export const MANA = ['r', 's', 'e', 'a'];
export const MANA_NAMES = { r: 'Ruby', s: 'Sapphire', e: 'Emerald', a: 'Amethyst' };
// Special gems: made by matching 4 in a line (line), an L or T (bomb), 5 in a line (prism).
export const SPECIAL = { NONE: 0, LINE_H: 1, LINE_V: 2, BOMB: 3, PRISM: 4 };

export const FALL = { g: 60, vmax: 26 };  // rows/s^2 gravity and terminal speed for falling gems
export const SWAP_TIME = 0.14;            // seconds a swap takes (and the swap back when it makes no match)
export const CLEAR_TIME = 0.2;            // seconds a matched gem takes to vanish
export const HINT_AFTER = 6;              // seconds of no move before the board hints one

// ---------------------------------------------------------------- the battle
export const BATTLE = {
    manaCap: 24,              // per colour
    swordPerGem: 0.5,         // × attack per sword gem
    manaPerGem: 1,            // mana per coloured gem
    chipPerGem: 0.18,         // × attack per coloured gem (doubled against the foe's weakness)
    heartPerGem: 0.03,        // × max health per heart gem
    chainBonus: 0.25,         // damage and healing per cascade step past the first
    weakMult: 2,              // coloured chip against the weakness
    weakSkill: 1.5,           // a skill whose cost includes the weakness colour
    critMult: 1.5,
    stonePerHit: 3,           // stone ability: gems turned per attack
    lockPerHit: 3,
    lockMax: 8,               // chained gems on the board at most (v1.3.1: they piled up to a dozen and more)
    doomSecs: 12,             // a doom gem bursts this many seconds after it is planted (v1.3.1: was 9)
    doomMult: 1.5,            // a burst doom gem hits for this × attack (v1.3.1: was 2)
    drain: 6,
    poisonSecs: 5, poisonPct: 0.012,   // per second, × max health
    healPct: 0.08,            // v1.3.1: bosses were walls for a casual player (was 0.12; enrage was 0.7)
    shieldPct: 0.1,           // × the foe's max health (v1.3.1: 0.15 soaked most of a slow player's damage)
    enrageAt: 0.5, enrageMult: 0.8,
    hasteMult: 0.8,
    freezeMax: 8,
    itemCooldown: 2.5,
    defK: 100,                // damage taken × defK / (defK + def)
    introSecs: 1.0,           // a foe waits this long before its timer runs
};

// Foe scaling (see data/world.js).
// every: the data's attack intervals are stretched by this (v1.1.0: 1.6, from players finding attacks too quick; each
// blow hits a little harder to keep the pressure: atk 18 -> 22).
export const FOE = { hp: 320, hpGrow: 0.25, atk: 22, atkGrow: 0.2, every: 1.6, rankHp: { normal: 1, elite: 0.75, boss: 0.5 } }; // boss 0.62 before v1.3.1
// v1.1.1: a player lost chapter 1's Bandit Captain every time. The first two chapters of a tale are where the board is
// learned: their foes have less health and hit softer ([chapter] = { hp, atk } factors). A chapter's finale only fights
// a level up when it is a real boss, and between the fights of a quest the hero catches their breath (× max health).
export const STORY_EASE = [{ hp: 0.65, atk: 0.75 }, { hp: 0.85, atk: 0.9 }];
export const QUEST_REST = 0.25;
// v1.3.1: a patrol's elite (the surprise last fight) is eased too. It met heroes with no story discount, after a fight,
// and a player at level 5 lost the Bandit Captain over and over in the Meadows.
export const PATROL_ELITE = { hp: 0.8, atk: 0.85 };

// Hero growth per level.
export const HERO_GROW = { hp: 0.11, atk: 0.09 };
export const XP_CURVE = (lv) => Math.round(30 * Math.pow(lv, 1.35));     // xp to go from lv to lv+1
export const MAX_LEVEL = 30;

// Rewards per foe defeated (× level, see sim/battle.js).
export const REWARD = { share: { wood: 0.7, ore: 0.5, grain: 0.2 }, gold: 9, goldLv: 4, xp: 12, xpLv: 7, res: 4, resLv: 2, dropNormal: 0.07, dropElite: 0.35, consumable: 0.18 };

// ---------------------------------------------------------------- the village
export const START_GOLD = 150;
export const DAILY = { gold: 80, goldStreak: 40, res: 30, crystal: 4, streakMax: 7 };
export const HOUR = 3600 * 1000;
export const MARKET_DISCOUNT = 0.04;      // per Market level
export const SELL_RATE = 0.35;            // equipment sells for this × its price
export const UPGRADE_COST = (tier, plus) => ({ gold: 40 * tier * (plus + 1), ore: 12 * tier * (plus + 1) });
export const UPGRADE_STEP = 0.15;         // each +1 adds this × the base stats
export const PATROL_FIGHTS = 2;
