// ============================================================
// gen/monster.js - monster instances (GDD §15.7, §15.9)
// PURE. A monster's uid fixes its drop, so re-killing it gives the same thing.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { clamp } from '../core/util.js';
import { DOMAINS } from '../data/constants.js';
import { MONSTERS, ELITE_MODS, LOOT_TABLES } from '../data/monsters.js';
import { makeSimpleItem, generateItem } from './item.js';

/** @pure One monster, scaled to tier and depth, possibly elite or Forgotten. */
export function generateMonster(master, archetypeKey, uid, { tier = 0, depth = 1, quiet = 0, eliteChance = 0 } = {}) {
  const A = MONSTERS[archetypeKey];
  if (!A) return null;
  const rng = deriveRNG(master, DOMAINS.MONSTER_INSTANCE, hashStr(uid));

  const level = clamp(tier * 2 + depth + rng.int(-1, 1), 1, 40);
  let hp = Math.round(A.base.hp * (1 + 0.16 * (level - 1)) * rng.float(0.92, 1.08));
  let atk = Math.round(A.base.atk * (1 + 0.12 * (level - 1)) * rng.float(0.94, 1.06));
  let def = Math.round(A.base.def * (1 + 0.10 * (level - 1)));
  let speed = A.base.speed;
  let size = A.sprite.size;
  let name = A.name;
  let elite = null;
  let forgotten = false;
  const mods = {};

  // Elite: 15% at depth>=2, 25% at depth>=4, plus the difficulty's own bump.
  const eliteP = (depth >= 4 ? 0.25 : depth >= 2 ? 0.15 : 0) + eliteChance;
  if (A.family !== 'warden' && rng.chance(eliteP)) {
    const key = rng.pick(Object.keys(ELITE_MODS));
    const E = ELITE_MODS[key];
    elite = key;
    if (E.speed) speed += E.speed;
    if (E.def) def += E.def;
    if (E.hpMult) hp = Math.round(hp * E.hpMult);
    if (E.atkMult) atk = Math.round(atk * E.atkMult);
    if (E.size) size += E.size;
    if (E.status) mods.onHitStatus = E.status;
    if (E.twin) mods.twin = true;
    if (E.calls) mods.calls = true;
    name = E.name + ' ' + name;
  }

  // The theme, made into a monster type. Rare on purpose.
  if (quiet >= 0.50 && A.family !== 'warden' && rng.chance(0.40)) {
    forgotten = true;
    hp = Math.round(hp * 1.25);
    atk = Math.round(atk * 0.80);
    name = `a ——— that was ${A.name}`;
  }

  return {
    uid, archetype: archetypeKey, name, level, elite, forgotten,
    hp, maxHp: hp, atk, def, speed, size,
    behavior: forgotten ? 'erratic' : A.behavior,
    family: forgotten ? 'forgotten' : A.family,
    sight: A.base.sight, hearing: A.base.hearing,
    resist: A.resist, weak: A.weak, dmgType: A.dmgType,
    ability: A.ability, tells: A.tells, xp: Math.round(A.xp * (1 + level * 0.08) * (elite ? 1.5 : 1)),
    hostile: A.hostile, threat: A.threat, mods,
    initiative: (hashStr(uid) % 1000),
    // runtime fields, so a monster is a complete actor wherever it is spawned
    id: uid, x: 0, y: 0, energy: 0, facing: 4, statuses: [],
    abilityCooldown: 0, phase: 1, awareness: 'unaware', asleep: false, fleeing: false,
  };
}

/** @pure The drop, seeded by the monster's uid so save-scumming buys nothing. */
export function rollDrop(master, monster, { tier = 0, depth = 1, extraReagent = 0 } = {}) {
  const A = MONSTERS[monster.archetype];
  if (!A) return [];
  const rng = deriveRNG(master, DOMAINS.MONSTER_DROP, hashStr(monster.uid));
  const out = [];

  if (monster.forgotten) {
    out.push(makeSimpleItem('name_shard', 1));
    return out;
  }

  const table = LOOT_TABLES[A.loot] || {};
  const keys = Object.keys(table).filter(k => table[k] > 0);
  if (keys.length) {
    const rolls = 1 + (monster.elite ? 1 : 0) + extraReagent + (A.family === 'warden' ? 2 : 0);
    for (let i = 0; i < rolls; i++) {
      if (!rng.chance(A.family === 'warden' ? 1 : 0.55)) continue;
      out.push(makeSimpleItem(rng.weightedKey(table), 1));
    }
  }
  const coin = Math.round(rng.int(0, 6) + monster.level * (A.family === 'warden' ? 12 : 1.6));
  if (coin > 0) out.push({ coin });

  if (A.family === 'warden' || (monster.elite && rng.chance(0.5))) {
    out.push(generateItem(master, monster.uid, 90, {
      ilvl: tier * 2 + depth + 2, category: rng.weightedKey({ weapon: 4, body: 3, head: 2, offhand: 2, trinket: 2 }),
    }));
  }
  return out.filter(Boolean);
}
