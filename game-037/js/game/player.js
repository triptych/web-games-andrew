// ============================================================
// game/player.js - the Wick: stats, capabilities, level-ups (GDD §17.2, §20)
// ============================================================
import { clamp } from '../core/util.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import {
  START, HP_BASE, HP_PER_VIGOR, HP_PER_BODY, VIGOR_MAX, SHARDS_PER_VIGOR,
  XP_CURVE, LANTERN_CAPACITY, CRIT_MULT,
} from '../data/constants.js';
import { KNACKS, KNACK_KEYS } from '../data/knacks.js';
import { TRINKET_EFFECTS } from '../data/items.js';
import { itemStats, generateItem, makeSimpleItem } from '../gen/item.js';
import { State, logLine } from './state.js';

/** The fixed new-game loadout, so the first ten minutes are reliable. */
export function makePlayer(master, start) {
  const knife = generateItem(master, 'START', 0, { ilvl: 1, category: 'weapon' });
  knife.base = 'knife'; knife.material = 'wood'; knife.quality = 1; knife.affixes = [];
  knife.identified = true; knife.name = 'wooden knife'; knife.weight = 1;
  const lantern = makeSimpleItem('lantern', 1);
  const coat = makeSimpleItem('coat', 1);

  return {
    id: 'player', isPlayer: true, name: 'the keeper',
    x: start.x, y: start.y, facing: 4,
    level: START.level, xp: START.xp, coin: START.coin,
    attrs: { ...START.attrs }, attrPoints: 0,
    vigor: START.vigor, shards: 0,
    hp: 0, maxHp: 0,
    energy: 0, speed: 100, initiative: 1,
    equipment: { hand: knife, offhand: lantern, body: coat, head: null, trinket1: null, trinket2: null },
    inventory: [makeSimpleItem('bread', 2), makeSimpleItem('oil_flask', 1), makeSimpleItem('bandage', 2)],
    lanternOil: START.lanternOil, lanternLit: true, greenFlame: false,
    caps: new Set(), toolCharges: {}, knacks: [], mods: {},
    statuses: [], nutrition: 2400,
    wakePoint: { x: start.x, y: start.y, kind: 'hearth', name: 'the hearth' },
    awareness: 'aware', stance: 'normal', secondWindUsed: false,
    sneaking: false, restedTick: 0,
  };
}

/** Recompute every derived stat. Called after any equipment or level change. */
export function recomputePlayer(p) {
  const mods = {};
  const addMods = src => { for (const [k, v] of Object.entries(src || {})) mods[k] = (mods[k] || 0) + v; };

  for (const slot of ['hand', 'offhand', 'body', 'head', 'trinket1', 'trinket2']) {
    const it = p.equipment[slot];
    if (!it) continue;
    if (it.kind === 'trinket') {
      if (it.identified) addMods(trinketMods(it));
      continue;
    }
    addMods(itemStats(it).mods);
  }
  for (const k of p.knacks) addMods(KNACKS[k] ? KNACKS[k].mods : {});

  p.mods = mods;
  p.maxHp = HP_BASE + p.vigor * HP_PER_VIGOR + p.attrs.body * HP_PER_BODY +
    (p.level - 1) * (4 + (mods.hpPerLevel || 0));
  if (p.hp <= 0) p.hp = p.maxHp;
  p.hp = Math.min(p.hp, p.maxHp);
  p.carry = 20 + p.attrs.body * 3 + (mods.carry || 0);
  p.critChance = 0.04 + p.attrs.hand * 0.012 + (mods.crit || 0);
  p.critMult = CRIT_MULT;
  p.armour = armourOf(p);
  p.evasion = clamp(p.attrs.hand * 0.6 + (mods.evasion || 0) - encumbrancePenalty(p), 0, 12);
  p.lightRadius = lightRadiusOf(p);
  p.stealth = 4 + p.attrs.hand * 0.3 + (mods.stealth || 0) - p.lightRadius * 0.8 - encumbrancePenalty(p);
  if (p.sneaking) p.stealth += 3;
  return p;
}

function trinketMods(it) {
  const e = TRINKET_EFFECTS.find(t => t.key === it.trinket);
  return e ? e.mods : {};
}

export function armourOf(p) {
  let a = 0;
  for (const slot of ['body', 'head', 'offhand']) {
    const it = p.equipment[slot];
    if (!it || it.kind !== 'armour') continue;
    a += itemStats(it).armour;
  }
  return Math.max(0, a + (p.mods.armour || 0));
}

export function carriedWeight(p) {
  let w = 0;
  for (const it of p.inventory) w += (it.weight || 0) * (it.stack || 1);
  for (const slot of Object.keys(p.equipment)) {
    const it = p.equipment[slot];
    if (it) w += it.weight || 0;
  }
  return +w.toFixed(1);
}

export function encumbrancePenalty(p) {
  const w = carriedWeight(p), c = p.carry || 32;
  if (w <= c) return 0;
  return Math.min(6, (w - c) / 4);
}

/** Lantern radius: 5 base, 7 fine, 3 guttering below 10% oil, 0 if out. */
export function lightRadiusOf(p) {
  if (!p.lanternLit || p.lanternOil <= 0) return 0;
  const lantern = p.equipment.offhand;
  if (!lantern || lantern.kind !== 'lantern') return 0;
  let r = lantern.quality >= 3 ? 7 : 5;
  if (p.lanternOil < LANTERN_CAPACITY * 0.10) r = 3;
  r += p.mods.light || 0;
  return Math.max(0, r);
}

// --- progression ---------------------------------------------------------

export function grantXP(p, amount) {
  if (amount <= 0) return;
  p.xp += amount;
  let leveled = false;
  while (p.xp >= XP_CURVE(p.level)) {
    p.xp -= XP_CURVE(p.level);
    p.level++;
    p.attrPoints++;
    leveled = true;
    recomputePlayer(p);
    p.hp = Math.min(p.maxHp, p.hp + 4);
    logLine(`You are steadier than you were. Level ${p.level}.`, 'good');
    if (p.level % 3 === 0) State.pendingLevelChoice = { kind: 'knack', options: knackOptions(p) };
    bus.emit(EV.PLAYER_LEVELED, { level: p.level });
  }
  return leveled;
}

/** Knacks are drawn weighted by how the player actually plays. */
export function knackOptions(p) {
  const s = State.stats;
  const total = Math.max(1, s.kills + s.quests + s.forage + s.stealth + s.tools + s.explore + s.social + s.quiet);
  const bias = {
    kills: s.kills / total, quests: s.quests / total, forage: s.forage / total,
    stealth: s.stealth / total, tools: s.tools / total, explore: s.explore / total,
    social: s.social / total, quiet: s.quiet / total,
  };
  const pool = KNACK_KEYS.filter(k => !p.knacks.includes(k));
  const scored = pool.map(k => ({ k, w: 1 + (bias[KNACKS[k].weightBy] || 0) * 6 }));
  const rng = State.rngStreams.combat;
  const out = [];
  for (let i = 0; i < 3 && scored.length; i++) {
    const total2 = scored.reduce((a, b) => a + b.w, 0);
    let r = rng.next() * total2;
    let idx = 0;
    for (; idx < scored.length; idx++) { r -= scored[idx].w; if (r < 0) break; }
    out.push(scored.splice(Math.min(idx, scored.length - 1), 1)[0].k);
  }
  return out;
}

export function takeKnack(p, key) {
  if (!KNACKS[key] || p.knacks.includes(key)) return false;
  p.knacks.push(key);
  if (KNACKS[key].mods.startDisposition) {
    for (const st of State.world.npcState.values()) st.disposition = (st.disposition || 0) + 10;
  }
  recomputePlayer(p);
  logLine(`${KNACKS[key].name}. ${KNACKS[key].blurb}`, 'good');
  return true;
}

export function spendAttribute(p, key) {
  if (!p.attrPoints || !(key in p.attrs)) return false;
  p.attrs[key] = Math.min(20, p.attrs[key] + 1);
  p.attrPoints--;
  recomputePlayer(p);
  return true;
}

export function addShard(p, n = 1) {
  p.shards += n;
  while (p.shards >= SHARDS_PER_VIGOR && p.vigor < VIGOR_MAX) {
    p.shards -= SHARDS_PER_VIGOR;
    p.vigor++;
    const before = p.maxHp;
    recomputePlayer(p);
    p.hp += p.maxHp - before;
    logLine('Something in you has more room in it than it had. Vigor ' + p.vigor + '.', 'good');
    bus.emit(EV.PLAYER_VIGOR, { vigor: p.vigor, shards: p.shards });
  }
  bus.emit(EV.PLAYER_VIGOR, { vigor: p.vigor, shards: p.shards });
}

export function grantCapability(p, key) {
  if (p.caps.has(key)) return false;
  p.caps.add(key);
  p.toolCharges[key] = 3;
  bus.emit(EV.PLAYER_CAPABILITY, { key });
  return true;
}
