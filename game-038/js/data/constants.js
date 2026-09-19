// ============================================================
// data/constants.js - every tunable number in one place (GDD 16)
// If a balance change needs a code edit somewhere else, it belongs here.
// ============================================================

export const VERSION = '1.0.0';
export const SAVE_KEY = 'emberbrood.save.v1';
export const SAVE_VERSION = 4;

export const PARTY_SIZE = 3;
export const ROSTER_MAX = 40;
export const MOVE_SLOTS = { hatchling: 2, drake: 4, wyrm: 6, elder: 6, egg: 0 };
export const ESSENCE_CAP = 15;
export const BOND_MAX = 100;

/** Stage thresholds, in the order they are tested. */
export const STAGES = [
  { id: 'elder',     level: 45, bond: 75, generation: 2, mult: 1.45, name: 'Elder' },
  { id: 'wyrm',      level: 28, bond: 40, generation: 0, mult: 1.25, name: 'Wyrm' },
  { id: 'drake',     level: 12, bond: 0,  generation: 0, mult: 1.00, name: 'Drake' },
  { id: 'hatchling', level: 1,  bond: 0,  generation: 0, mult: 0.75, name: 'Hatchling' },
];
export const stageMult = id => (STAGES.find(s => s.id === id) || STAGES[3]).mult;
export const stageName = id => id === 'egg' ? 'Egg' : (STAGES.find(s => s.id === id) || STAGES[3]).name;
export const stageRank = id => id === 'egg' ? -1 : STAGES.length - 1 - STAGES.findIndex(s => s.id === id);

/** Stat curve (GDD 4.1). HP and MP get their own shape - they are pools. */
export const STATS = ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd'];
export const STAT_LABEL = { hp: 'Health', mp: 'Ley', atk: 'Attack', mag: 'Magic', def: 'Defence', res: 'Ward', spd: 'Speed' };
export const STAT_SHORT = { hp: 'HP', mp: 'LEY', atk: 'ATK', mag: 'MAG', def: 'DEF', res: 'WRD', spd: 'SPD' };
export const CURVE = {
  hpScale: 3.5, hpEssence: 2.2, mpScale: 1.9, mpEssence: 1.1, poolDivisor: 16,
  statEssence: 0.6, statDivisor: 22,
  generationBonus: 0.02, generationCap: 0.10,
};

/** XP (GDD 8). */
export const XP = {
  toNext: level => Math.floor(12 * Math.pow(level, 1.8) + 20 * level),
  fromKill: (enemyLevel, baseXP) => Math.floor(baseXP * Math.pow(enemyLevel, 1.45) / 4),
  lastHitBonus: 1.25,
  maxLevel: 60,
};

/** Damage (GDD 6.2). */
export const DAMAGE = {
  defConstant: 140,
  variance: [0.92, 1.08],
  critChance: 0.05, critSpdDivisor: 500, critMult: 1.75,
  stab: 1.20,             // same-element bonus
  bondDivisor: 400,
  guardMult: 0.5,
  surgePerDamage: 0.06,   // % of meter per % max-HP of damage dealt
  surgePerTaken: 0.04,
  surgeGuard: 6,
};

/** Binding (GDD 7). */
export const BIND = {
  hpExponent: 1.3,
  levelSpread: 0.35,
  rarityFactor: { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.5, 5: 0.3 },
  ashboundPenalty: 0.45,
  rankBonus: 0.06,        // per Warden rank
  floor: 0.02, ceiling: 0.95,
};

/** Breeding (GDD 9). */
export const BREED = {
  minLevel: 10, minBond: 30,
  geneParentChance: 0.45,      // each parent; the remainder is mutation
  primaryFromA: 0.65,
  secondaryInherit: 0.5,
  fusionChance: 0.12,
  maxEssenceStats: 3,
  essenceDrift: 2,
  eggMoves: 2,
  lineageFromA: 0.7,
  throwbackChance: 0.03,
  incubateBattles: 12, incubateMin: 4,
};

/** Bond gains (GDD 4.5). */
export const BOND = {
  perBattle: 2, perWin: 3, lowHpWin: 4, killingBlowBoss: 8,
  perRest: 3, perRestBoxed: 1, faint: -4, boxedDecayPerAct: -2,
  captured: 8, capturedCleansed: 20,
};

/** Economy. */
export const ECONOMY = {
  sellRatio: 0.45,
  coinPerLevel: 5,
  bossCoinMult: 5,
  startingCoin: 220,
  boardRewardBase: 120,
};

/** Encounters. */
export const ENCOUNTER = {
  groupWeights: { 1: 0.45, 2: 0.35, 3: 0.20 },
  ashboundChance: { 1: 0.18, 2: 0.22, 3: 0.35, 4: 0.28, 5: 0.40 },
  championChance: 0.06,
  championMult: { hp: 1.6, atk: 1.2, level: 3 },
  fleeBase: 0.55,
};

/** Warden ranks, earned from Broodex progress and story beats. */
export const RANKS = [
  { rank: 0, name: 'Sworn',        needed: 0 },
  { rank: 1, name: 'Keeper',       needed: 6 },
  { rank: 2, name: 'Broodwarden',  needed: 14 },
  { rank: 3, name: 'Linewalker',   needed: 24 },
  { rank: 4, name: 'Elder Warden', needed: 36 },
  { rank: 5, name: 'Emberwright',  needed: 50 },
];

export const TEMPERAMENTS = {
  bold:     { id: 'bold',     name: 'Bold',     up: 'atk', down: 'def', bond: 1.0,  surge: 1.1, blurb: 'Goes first, asks later.' },
  wary:     { id: 'wary',     name: 'Wary',     up: 'def', down: 'atk', bond: 0.9,  surge: 0.9, blurb: 'Watches the door.' },
  fond:     { id: 'fond',     name: 'Fond',     up: 'hp',  down: 'mag', bond: 1.5,  surge: 1.0, blurb: 'Leans on you. All of it, at once.' },
  sullen:   { id: 'sullen',   name: 'Sullen',   up: 'mag', down: 'spd', bond: 0.7,  surge: 1.0, blurb: 'Warms up eventually. Probably.' },
  bright:   { id: 'bright',   name: 'Bright',   up: 'mag', down: 'hp',  bond: 1.2,  surge: 1.2, blurb: 'Curious about everything, including fire.' },
  ravenous: { id: 'ravenous', name: 'Ravenous', up: 'hp',  down: 'res', bond: 1.1,  surge: 1.0, blurb: 'Food first. Then food.' },
  patient:  { id: 'patient',  name: 'Patient',  up: 'res', down: 'spd', bond: 1.0,  surge: 0.9, blurb: 'Will wait out the weather, the enemy, and you.' },
  skittish: { id: 'skittish', name: 'Skittish', up: 'spd', down: 'def', bond: 0.8,  surge: 1.1, blurb: 'Bolts at nothing, returns sheepishly.' },
  proud:    { id: 'proud',    name: 'Proud',    up: 'atk', down: 'res', bond: 0.85, surge: 1.15,blurb: 'Would like that noted in the ledger.' },
  hollow:   { id: 'hollow',   name: 'Hollow',   up: 'atk', down: 'mp',  bond: 0.5,  surge: 1.0, blurb: 'Has forgotten what it was for. That is fixable.' },
};
export const TEMPERAMENT_IDS = Object.keys(TEMPERAMENTS).filter(t => t !== 'hollow');

/** Animation and UI timing, all in ms. */
export const TIMING = { log: 260, hit: 220, surge: 800, toast: 2600, autosaveMs: 15000 };
