// ============================================================
// gen/item.js - item instances, names, identification (GDD §15.1-15.6)
// PURE.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { itemUid } from '../core/ids.js';
import { clamp } from '../core/util.js';
import { DOMAINS } from '../data/constants.js';
import {
  BASE_ITEMS, MATERIALS, QUALITY_NAMES, QUALITY_DMG, QUALITY_ARMOUR, AFFIXES,
  WEAPON_PREFIXES, ARMOUR_PREFIXES, ALL_SUFFIXES, WEAPON_KEYS, BODY_KEYS, HEAD_KEYS, OFFHAND_KEYS,
  TONIC_APPEARANCES, TRINKET_APPEARANCES, TONIC_EFFECTS, TRINKET_EFFECTS,
} from '../data/items.js';

/** @pure Per-world appearance mapping. Learning one `cloudy` teaches them all. */
export function buildIdentityMap(master) {
  const rng = deriveRNG(master, DOMAINS.ITEM_IDENTIFY);
  const tonicLooks = rng.shuffle(TONIC_APPEARANCES.slice());
  const trinketLooks = rng.shuffle(TRINKET_APPEARANCES.slice());
  const tonicMap = {}, trinketMap = {}, tonicByLook = {}, trinketByLook = {};
  TONIC_EFFECTS.forEach((e, i) => {
    tonicMap[e.key] = tonicLooks[i % tonicLooks.length];
    tonicByLook[tonicLooks[i % tonicLooks.length]] = e.key;
  });
  TRINKET_EFFECTS.forEach((e, i) => {
    trinketMap[e.key] = trinketLooks[i % trinketLooks.length];
    trinketByLook[trinketLooks[i % trinketLooks.length]] = e.key;
  });
  return { tonicMap, trinketMap, tonicByLook, trinketByLook };
}

function baseTableFor(category, ilvl) {
  const pools = {
    weapon: WEAPON_KEYS, body: BODY_KEYS, head: HEAD_KEYS, offhand: OFFHAND_KEYS,
  };
  const pool = pools[category] || WEAPON_KEYS;
  const table = {};
  for (const k of pool) {
    const req = BASE_ITEMS[k].ilvl || 1;
    table[k] = req <= ilvl + 2 ? Math.max(1, 10 - Math.abs(req - ilvl)) : 1;
  }
  return table;
}

function materialTableFor(ilvl) {
  const table = {};
  for (const k of Object.keys(MATERIALS)) {
    const [lo, hi] = MATERIALS[k].band;
    table[k] = (ilvl >= lo - 2 && ilvl <= hi + 4) ? Math.max(1, 8 - Math.abs((lo + hi) / 2 - ilvl) / 2) : 0.2;
  }
  return table;
}

const qualityWeights = l => [
  Math.max(2, 30 - l * 1.5), 40, 18 + l * 0.6, 6 + l * 0.5, Math.max(0, l * 0.25 - 1),
];

function affixCountWeights(l, q) {
  const w = [55, 30, 12, 3];
  for (let s = 0; s < q; s++) {
    for (let i = w.length - 2; i >= 0; i--) { const move = Math.min(8, w[i]); w[i] -= move; w[i + 1] += move; }
  }
  const shift = Math.min(20, l / 10 * 6);
  w[0] = Math.max(1, w[0] - shift); w[1] += shift * 0.6; w[2] += shift * 0.4;
  return w;
}

/** @pure One item instance. The uid makes its roll stable across reloads. */
export function generateItem(master, originId, k, { ilvl = 1, tierBias = 0, category = 'weapon' } = {}) {
  const rng = deriveRNG(master, DOMAINS.ITEM_INSTANCE, hashStr(originId), k);
  const uid = itemUid(originId, k);
  const L = Math.max(1, ilvl);

  if (category === 'trinket') {
    const effect = rng.pick(TRINKET_EFFECTS);
    return {
      uid, base: 'trinket', material: null, quality: 2, affixes: [], ilvl: L,
      condition: 100, charges: null, identified: false, stack: 1, bound: false,
      trinket: effect.key, name: 'a trinket', weight: 0.2, slot: 'trinket', kind: 'trinket',
    };
  }
  if (category === 'tonic') {
    const effect = rng.pick(TONIC_EFFECTS);
    return {
      uid, base: 'tonic', material: null, quality: 2, affixes: [], ilvl: L,
      condition: 100, charges: null, identified: false, stack: 1, bound: false,
      tonic: effect.key, name: 'a tonic', weight: 0.3, kind: 'tonic',
    };
  }

  const base = rng.weightedKey(baseTableFor(category, L));
  const def = BASE_ITEMS[base];
  const mat = def.usesMaterial ? rng.weightedKey(materialTableFor(L + tierBias)) : null;
  const quality = rng.weighted([0, 1, 2, 3, 4], qualityWeights(L + tierBias));
  const nAffix = rng.weighted([0, 1, 2, 3], affixCountWeights(L, quality));
  const affixes = pickAffixes(rng, def, L, nAffix);

  const item = {
    uid, base, material: mat, quality, affixes, ilvl: L,
    condition: 100, charges: def.charges || null, identified: affixes.length === 0,
    stack: 1, bound: false, name: '', weight: 0, slot: def.slot, kind: def.kind,
  };
  item.weight = +(def.weight * (mat ? MATERIALS[mat].weight : 1)).toFixed(1);
  item.name = itemDisplayName(item);
  return item;
}

function pickAffixes(rng, def, ilvl, n) {
  if (!n) return [];
  const isWeapon = def.kind === 'weapon';
  const prefixPool = isWeapon ? WEAPON_PREFIXES : ARMOUR_PREFIXES;
  const pool = rng.shuffle(prefixPool.concat(ALL_SUFFIXES));
  const out = [];
  const tags = new Set();
  let budget = 2 + Math.floor(ilvl / 6);
  for (const key of pool) {
    if (out.length >= n) break;
    const a = AFFIXES[key];
    if (!a) continue;
    if (a.tags.some(t => tags.has(t))) continue;          // no conflicting pairs
    let tier = clamp(1 + Math.floor(ilvl / 12) + rng.int(-1, 1), 1, 3);
    while (tier > 1 && budget - tier < 0) tier--;         // re-roll the last one down
    if (budget - tier < 0) break;
    budget -= tier;
    for (const t of a.tags) tags.add(t);
    out.push({ key, tier });
  }
  return out;
}

/** @pure Name assembly: [quality] [material] [base] [of-affix]. Capped at 40. */
export function itemDisplayName(item) {
  const def = BASE_ITEMS[item.base];
  if (!def) return 'something';
  if (item.kind === 'tonic') return item.identified ? tonicName(item) : 'a tonic';
  if (item.kind === 'trinket') return item.identified ? trinketName(item) : 'a trinket';

  const prefix = item.affixes.find(a => AFFIXES[a.key] && AFFIXES[a.key].kind === 'prefix');
  const suffix = item.affixes.find(a => AFFIXES[a.key] && AFFIXES[a.key].kind === 'suffix');
  const parts = [];
  const qName = QUALITY_NAMES[item.quality];
  if (prefix && item.identified) parts.push(AFFIXES[prefix.key].name);
  else if (qName && qName !== 'plain') parts.push(qName);
  if (item.material) parts.push(MATERIALS[item.material].name);
  parts.push(def.name);
  let name = parts.join(' ');
  if (suffix && item.identified) name += ' ' + AFFIXES[suffix.key].name;
  if (name.length > 40) {
    name = (item.material ? [MATERIALS[item.material].name, def.name].join(' ') : def.name);
    if (suffix && item.identified) name += ' ' + AFFIXES[suffix.key].name;
  }
  if (name.length > 40) name = def.name;
  return name;
}

function tonicName(item) {
  const e = TONIC_EFFECTS.find(t => t.key === item.tonic);
  return e ? e.name : 'a tonic';
}
function trinketName(item) {
  const e = TRINKET_EFFECTS.find(t => t.key === item.trinket);
  return e ? e.name : 'a trinket';
}

/** @pure How an unidentified item looks, from the world's appearance mapping. */
export function appearanceOf(idMap, item) {
  if (item.kind === 'tonic') return (idMap.tonicMap[item.tonic] || 'cloudy') + ' tonic';
  if (item.kind === 'trinket') return idMap.trinketMap[item.trinket] || 'a trinket';
  return null;
}

/** @pure Rough coin value, for prices, reward bands and the Wake's drop order. */
export function itemValue(item) {
  const def = BASE_ITEMS[item.base];
  if (!def) return 1;
  let v = def.value || 4;
  if (item.material) v += (MATERIALS[item.material].dmg + MATERIALS[item.material].armour) * 6;
  v += item.quality * 8;
  for (const a of item.affixes) v += a.tier * 12;
  v = Math.round(v * (0.4 + item.condition / 160));
  return Math.max(1, v);
}

/** @pure Damage and armour after material, quality and affixes. */
export function itemStats(item) {
  const def = BASE_ITEMS[item.base] || {};
  const mat = item.material ? MATERIALS[item.material] : null;
  const out = {
    damage: (def.damage || 0) + (mat ? mat.dmg : 0) + (QUALITY_DMG[item.quality] || 0),
    armour: (def.armour || 0) + (mat ? mat.armour : 0) + (QUALITY_ARMOUR[item.quality] || 0),
    energy: def.energy || 100, dmgType: (mat && mat.dmgType) || def.dmgType || 'blunt',
    pattern: def.pattern, range: def.range || 1, mods: {},
  };
  if (mat && mat.energy) out.energy += mat.energy;
  if (def.evasion) out.mods.evasion = def.evasion;
  for (const a of item.affixes) {
    const A = AFFIXES[a.key];
    if (!A) continue;
    for (const [k, v] of Object.entries(A.effect)) {
      if (Array.isArray(v)) out.mods[k] = (out.mods[k] || 0) + v[a.tier - 1];
      else out.mods[k] = v;
    }
  }
  if (out.mods.dmg) out.damage += out.mods.dmg;
  if (out.mods.armour) out.armour += out.mods.armour;
  if (out.mods.energy) out.energy += out.mods.energy;
  if (item.condition < 40) { out.damage = Math.max(1, Math.round(out.damage * 0.6)); out.armour = Math.round(out.armour * 0.6); }
  return out;
}

/** @pure A plain stack of a known item, for shops, forage and rewards. */
export function makeSimpleItem(key, count = 1) {
  const def = BASE_ITEMS[key];
  if (!def) return null;
  return {
    uid: 'S:' + key + ':' + count + ':' + Math.round(count * 7919 + key.length),
    base: key, material: null, quality: 1, affixes: [], ilvl: def.ilvl || 1,
    condition: 100, charges: null, identified: true, stack: count, bound: !!def.quest,
    name: def.name, weight: def.weight, slot: def.slot || null, kind: def.kind,
  };
}
