// ============================================================
// data/constants.js - every tunable number (GDD §33)
// Nothing in this table may be duplicated inline elsewhere.
// ============================================================

export const WORLD_GEN_VERSION = 1;
export const SAVE_VERSION = 1;
export const DEV_ALLOW_SAVE_BREAK = true;   // pre-1.0

export const DOMAINS = Object.freeze({
  REGIONS: 'world/regions', TERRAIN: 'world/terrain', RIVERS: 'world/rivers',
  ROADS: 'world/roads', SECRETS: 'world/secrets', SHARDPICK: 'world/shardpick',
  PROPS: 'world/props', SPAWN: 'world/spawn', WEATHER: 'world/weather',
  START: 'world/start', LONGTHREAD: 'world/longthread',
  REGION_PROFILE: 'region/profile', REGION_THREAD: 'region/thread',
  SETTLE_SITE: 'settle/site', SETTLE_LAYOUT: 'settle/layout',
  SETTLE_ROSTER: 'settle/roster', SETTLE_INTERIOR: 'settle/interior',
  NPC_IDENTITY: 'npc/identity', NPC_NEEDS: 'npc/needs', NPC_STOCK: 'npc/stock',
  HOLLOW_SITE: 'hollow/site', HOLLOW_IDENTITY: 'hollow/identity',
  HOLLOW_FLOOR: 'hollow/floor', HOLLOW_MISSION: 'hollow/mission',
  HOLLOW_POP: 'hollow/pop', HOLLOW_BOSS: 'hollow/boss',
  QUEST_BUILD: 'quest/build', ITEM_INSTANCE: 'item/instance',
  ITEM_IDENTIFY: 'item/identify', MONSTER_INSTANCE: 'monster/instance',
  MONSTER_DROP: 'monster/drop', SPRITES: 'cosmetic/sprites', WAKE: 'wake',
  RT_COMBAT: 'runtime/combat', RT_COSMETIC: 'runtime/cosmetic',
});

export const NOISE_SALTS = Object.freeze({
  elevation: 1013, mountains: 2027, elevDetail: 3041, moisture: 4051,
  tempWobble: 5059, vegetation: 6073, quiet: 7079, regionWarp: 8089,
  caves: 9103, saltcrust: 10111,
});

export const WORLD_W = 1536, WORLD_H = 1536, CHUNK = 32;
export const CHUNKS_X = WORLD_W / CHUNK, CHUNKS_Y = WORLD_H / CHUNK;
export const REGION_GRID = 6, REGION_CELL = 256;
export const STREAM_RADIUS = 2, EVICT_RADIUS = 4;

export const SEA = 0.30, SHORE = 0.34, LOWLAND = 0.50, HILL = 0.66, MOUNTAIN = 0.80, PEAK = 0.90;
export const RIVER_COUNT = 28;
export const MIN_SETTLE_DIST = 70;
export const SETTLEMENT_SIZES = Object.freeze({ hamlet: [4, 7], village: [8, 16], town: [17, 30] });

export const TICKS_PER_HOUR = 120, TICKS_PER_DAY = 2400, DAYS_PER_SEASON = 30;
// You wake at a cold hearth in the morning, not at midnight (GDD §4.7).
export const START_TICK = 9 * 120;
export const ENERGY_STEP = 100, ENERGY_CAP = 300, DIAGONAL_COST = 140;

export const QUIET_DRIFT = 0.004, QUIET_LIT_RECOVER = 0.01;
export const QUIET_LIGHT_DROP = 0.18, QUIET_THREAD_DROP = 0.35;
export const QUIET_VISIBLE = 0.20;

export const LANTERN_BURN_TURNS = 30;
export const OIL_PER_FLASK = 60, LANTERN_CAPACITY = 120;
export const GREEN_FLAME_COST = 3;

export const VIGOR_START = 3, VIGOR_MAX = 15;
export const SHARDS_PER_VIGOR = 4, VIGOR_SHARDS_IN_WORLD = 48;
export const HP_PER_VIGOR = 8, HP_BASE = 20, HP_PER_BODY = 3;
export const REGEN_TURNS = 12;
export const HUNGRY_AT = 3000, STARVING_AT = 4800;

export const CRIT_MULT = 1.75;
export const DMG_VARIANCE = Object.freeze([0.88, 1.12]);
export const MORALE_FLEE_HP = 0.25;

export const WAKE_TIME_HOURS = Object.freeze([6, 14]);
export const WAKE_DROP_FRACTION = 0.40, WAKE_COIN_LOSS = 0.15;
export const WAKE_OIL_FLASK_LOSS = 0.50, WAKE_PACK_TTL_DAYS = 3;

export const XP_CURVE = (lvl) => Math.round(40 * Math.pow(lvl, 1.45));
export const MAX_ACTIVE_QUESTS = 12;
export const NPC_MEMORY_CAP = 8, LEDGER_CAP = 200, LOG_CAP = 200;

export const THREAT_TARGET = (tier, depth) => 18 + tier * 9 + depth * 7;
export const LOOT_VALUE = (tier, depth) => 30 + tier * 25 + depth * 18;
export const FLOOR_SIZE = (tier, depth) => Math.min(96, Math.max(40, 40 + depth * 4 + tier * 3));

export const DIFFICULTY = Object.freeze({
  wanderer: { label: 'Wanderer', wakeCost: 0.5, monsterDmg: 0.8, quietDrift: 0.5, elite: 0.0 },
  keeper: { label: 'Keeper', wakeCost: 1.0, monsterDmg: 1.0, quietDrift: 1.0, elite: 0.0 },
  longNight: { label: 'Long Night', wakeCost: 1.5, monsterDmg: 1.25, quietDrift: 1.6, elite: 0.10 },
  noWake: { label: 'No Wake', wakeCost: 1.0, monsterDmg: 1.0, quietDrift: 1.0, elite: 0.0, permadeath: true },
});

// Movement / action energy (GDD §16.4)
export const ACTION_ENERGY = Object.freeze({
  move: 100, moveDiagonal: 140, useTool: 100, useItem: 100, swap: 50,
  pickup: 50, door: 100, talk: 0, examine: 0, wait: 100, search: 200, stairs: 100,
  shove: 50,
});

// Combat
export const REGEN_QUIET_DIVISOR = 4;
export const UNAWARE_MULT = 2.0, UNAWARE_KNIFE_MULT = 2.5;
export const BEHIND_MULT = 1.25, FLANK_MULT = 1.15;

// Starting state (GDD §20.9)
export const START = Object.freeze({
  vigor: 3, level: 1, xp: 0, coin: 18,
  attrs: { body: 4, hand: 4, wit: 4, heart: 4 },
  lanternOil: 45,
});

// Rendering
export const TILE = 16;
export const TARGET_TILES_ACROSS = 17;
export const AMBIENT = Object.freeze({ day: 0.0, dusk: 0.25, night: 0.62, hollow: 0.88 });
export const QUIET_VARIANTS = Object.freeze([0, 0.35, 0.6, 0.9]);
export const ANIM_BUDGET_MS = 180;

// Hollow floor cache
export const FLOOR_CACHE_CAP = 4;

// Overworld encounters
export const SPAWN_CAP_PER_CHUNK = 8;
export const SPAWN_MIN_DIST = 12;
