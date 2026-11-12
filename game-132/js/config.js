// TITAN'S VAULT: tuning and constants. Shared by the sim, the view and the tests.
// Every curve the balance table in game-plan.md was tuned against lives here.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'titans-vault.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const LEVEL_CAP = 40;
export const SECOND_MASTERY_AT = 6;       // Titan Quest gives the second mastery at 8; our acts are shorter
export const SKILL_POINTS_PER_LEVEL = 2;
export const ATTR_POINTS_PER_LEVEL = 3;
/** Experience to go from level L to L+1. */
export const xpToNext = (L) => Math.round(70 * Math.pow(L, 1.7) + 40);

export const PLAYER = {
    radius: 0.42, speed: 5.4,
    life: 70, lifePerLevel: 13, lifePerVit: 4,
    mana: 80, manaPerSpirit: 1, manaRegen: 7,    // a second
    rage: 100, rageDecay: 7, rageDecayDelay: 3,  // Rage leaks this much a second once out of combat for the delay
    essence: 100, essenceRegen: 1.5, essencePerKill: 4,
    critBase: 5, critDmgBase: 50,
    pickup: 1.3,                 // reach for items and globes (m)
    respawn: 3,                  // seconds on the death screen
    deathGoldLoss: 0.1,          // of carried gold
};

/** Potion: charges refill from kills and in town; a cooldown stops it being spammed (Diablo IV's rule). */
export const POTION = { charges: 4, heal: 0.4, overTime: 1.0, cd: 2.5, killsPerCharge: 9 };
/** Health globes drop from kills; touching one heals at once (Diablo III's pacing tool). */
export const GLOBE = { chance: 0.07, eliteChance: 0.6, heal: 0.2, life: 25 };

/** Town portal: a short channel that damage interrupts, then a door in both places. */
export const PORTAL = { cast: 1.2, radius: 1.0 };

export const MON = {
    hp: (L) => 20 * Math.pow(1.135, L - 1),
    dmg: (L) => 4 * Math.pow(1.105, L - 1),
    armor: (L) => 6 * L,
    aggro: 11, leash: 26,
    eliteHp: 3.2, eliteDmg: 1.4, champions: [3, 4], rareMinions: [2, 3],
    eliteChance: 0.12,
    staggerTime: 0.45, stunMax: 2,
    telegraph: 0.6,              // seconds of red ring before a big monster attack lands
    corpse: 6,                   // seconds a corpse lies (for the view and for Harvest)
};

/** Damage reduction from armour against a monster of level L: armor / (armor + 50 L). Resist caps at 75%. */
export const ARMOR_K = 50;
export const RES_CAP = 75;

/** Weapon damage grows with item level; armour too. Affix rolls multiply by the tier of their item level. */
export const ITEM = {
    weaponScale: (ilvl) => 1 + 0.12 * (ilvl - 1),
    armorScale: (ilvl) => 1 + 0.15 * (ilvl - 1),
    tier: (ilvl) => 1 + (ilvl - 1) / 12,
    dropChance: 0.13, eliteDrops: [2, 3], bossDrops: [5, 7],
    goldChance: 0.35, gold: (L) => 3 + L * 2,
    legendaryPity: 260,          // kills without a legendary before one is forced (a guard against bad streaks)
    sellFrac: 0.25,
    price: { common: 8, magic: 20, rare: 60, set: 150, legendary: 220, mythic: 600 },
    mythicMinTier: 5,            // rift tier from which mythics can drop
    gemChance: 0.025,
};

export const INVENTORY = { size: 40 };

/** The companion: follows, fights, carries 16 things and runs to town to sell them. */
export const PET = {
    radius: 0.5, speed: 6.6, life: 0.6, dmg: 0.55, atk: 1.1, reach: 1.5,
    bag: 16, townTrip: 22, downTime: 8,
    howlCd: 16, mendCd: 20, mendAt: 0.5, mend: 0.25, pounceCd: 9,
    mendLevel: 8, pounceLevel: 14,
};

/** Rifts: the endgame. Fill the bar by killing, then the guardian comes. Tiers never end. */
export const RIFT = {
    baseLevel: 26, levelPerTier: 1, hpPerTier: 1.16, dmgPerTier: 1.08,
    progress: { normal: 1, elite: 6, champion: 3 }, need: 120,
    timer: 600, deathPenalty: 15,
};

export const LOOT_FILTER = ['all', 'magic', 'rare', 'legendary'];
