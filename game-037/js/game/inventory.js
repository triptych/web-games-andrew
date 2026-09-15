// ============================================================
// game/inventory.js - carrying, equipping, using (GDD §20.4, §15.5, §18.6)
// Weight-based, grid-free. One stash, globally, because hunting for which inn
// you left the thing in is not fun.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { BASE_ITEMS, TONIC_EFFECTS, TRINKET_EFFECTS, MATERIALS } from '../data/items.js';
import { OIL_PER_FLASK, LANTERN_CAPACITY } from '../data/constants.js';
import { itemDisplayName, appearanceOf, itemValue, makeSimpleItem } from '../gen/item.js';
import { State, logLine } from './state.js';
import { recomputePlayer } from './player.js';
import { addStatus, cure } from './status.js';

/** What the player sees this item called, given what they know. */
export function displayName(item) {
  if (!item) return 'nothing';
  if (item.coin) return `${item.coin} coin`;
  if (!item.identified) {
    if (item.kind === 'tonic' && State.knowledge.tonics.has(item.tonic)) { item.identified = true; }
    else if (item.kind === 'trinket' && State.knowledge.trinkets.has(item.trinket)) { item.identified = true; }
  }
  if (!item.identified) {
    const look = appearanceOf(State.idMap, item);
    if (look) return look;
    return itemDisplayName(item) + ' (unknown)';
  }
  return itemDisplayName(item);
}

export function addItem(p, item, quiet = false) {
  if (!item) return false;
  if (item.coin) { p.coin += item.coin; if (!quiet) logLine(`${item.coin} coin.`, 'good'); return true; }
  const def = BASE_ITEMS[item.base];
  if (def && def.stack) {
    const existing = p.inventory.find(i => i.base === item.base && i.identified === item.identified);
    if (existing) { existing.stack += item.stack || 1; if (!quiet) logLine(`${displayName(item)}. (${existing.stack})`, 'good'); bus.emit(EV.ITEM_ACQUIRED, { uid: item.uid, base: item.base }); return true; }
  }
  p.inventory.push(item);
  if (!quiet) logLine(`${displayName(item)}.`, 'good');
  bus.emit(EV.ITEM_ACQUIRED, { uid: item.uid, base: item.base });
  return true;
}

export function removeItem(p, item, count = 1) {
  const i = p.inventory.indexOf(item);
  if (i < 0) return false;
  if ((item.stack || 1) > count) { item.stack -= count; return true; }
  p.inventory.splice(i, 1);
  return true;
}

export function countOf(p, baseKey) {
  let n = 0;
  for (const it of p.inventory) if (it.base === baseKey) n += it.stack || 1;
  return n;
}

export function takeOf(p, baseKey, count) {
  let need = count;
  for (let i = p.inventory.length - 1; i >= 0 && need > 0; i--) {
    const it = p.inventory[i];
    if (it.base !== baseKey) continue;
    const take = Math.min(need, it.stack || 1);
    need -= take;
    if ((it.stack || 1) <= take) p.inventory.splice(i, 1); else it.stack -= take;
  }
  return need === 0;
}

const SLOT_FOR = { weapon: 'hand', armour: null, lantern: 'offhand', trinket: 'trinket' };

export function equip(p, item) {
  const def = BASE_ITEMS[item.base];
  if (!def || !def.slot) { logLine('That is not something you wear.', 'plain'); return false; }
  let slot = def.slot;
  if (slot === 'trinket') slot = p.equipment.trinket1 ? 'trinket2' : 'trinket1';
  const old = p.equipment[slot];
  removeItem(p, item, item.stack || 1);
  p.equipment[slot] = item;
  if (old) p.inventory.push(old);
  recomputePlayer(p);
  logLine(`${displayName(item)}, ${slot === 'hand' ? 'in hand' : 'on'}.`, 'plain');
  bus.emit(EV.ITEM_EQUIPPED, { uid: item.uid, slot });
  return true;
}

export function unequip(p, slot) {
  const it = p.equipment[slot];
  if (!it) return false;
  p.equipment[slot] = null;
  p.inventory.push(it);
  recomputePlayer(p);
  return true;
}

/** Use an item. Returns true if a turn was spent. */
export function useItem(p, item) {
  const def = BASE_ITEMS[item.base];
  if (!def) return false;

  if (def.kind === 'oil') {
    const before = p.lanternOil;
    p.lanternOil = Math.min(LANTERN_CAPACITY, p.lanternOil + OIL_PER_FLASK);
    removeItem(p, item, 1);
    if (!p.lanternLit && p.lanternOil > 0) { p.lanternLit = true; }
    recomputePlayer(p);
    logLine(`Oil in. The light steadies. (${p.lanternOil})`, 'good');
    return true;
  }

  if (def.kind === 'food') {
    p.nutrition = Math.min(4800, p.nutrition + Math.round((def.nutrition || 600) * (p.mods.nutrition || 1)));
    removeItem(p, item, 1);
    if (def.buff) addStatus(p, def.buff, 60);
    logLine(`You eat ${def.name}. That is better.`, 'good');
    return true;
  }

  if (def.kind === 'consumable') {
    if (def.effect === 'heal') { p.hp = Math.min(p.maxHp, p.hp + def.power); logLine(`Bound up. +${def.power}.`, 'good'); }
    if (def.cures) cure(p, def.cures);
    if (def.effect === 'repair') return repairBest(p) && removeItem(p, item, 1);
    removeItem(p, item, 1);
    return true;
  }

  if (def.kind === 'tonic') {
    const e = TONIC_EFFECTS.find(t => t.key === item.tonic);
    removeItem(p, item, 1);
    if (!e) return true;
    applyTonic(p, e);
    // Using it identifies it, per-world, forever.
    State.knowledge.tonics.add(e.key);
    State.knowledge.identified.add(e.key);
    bus.emit(EV.ITEM_IDENTIFIED, { key: e.key, name: e.name });
    logLine(`That was ${e.name}.`, 'plain');
    return true;
  }

  if (def.kind === 'trinket') { return equip(p, item); }
  if (def.slot) return equip(p, item);
  logLine('Nothing happens.', 'plain');
  return false;
}

function applyTonic(p, e) {
  if (e.effect === 'heal') { p.hp = Math.min(p.maxHp, p.hp + e.power); logLine(`+${e.power}.`, 'good'); }
  if (e.effect === 'status' && e.status) addStatus(p, e.status, e.turns);
  if (e.effect === 'cure') cure(p, e.cures || []);
  if (e.effect === 'oil') { p.lanternOil = Math.min(LANTERN_CAPACITY, p.lanternOil + e.power); }
  if (e.effect === 'light') { p.tonicLightUntil = State.tick + (e.turns || 80); }
  if (e.effect === 'reveal') { p.revealUntil = State.tick + 4; p.revealRadius = e.radius || 12; }
  if (e.status && e.effect === 'heal') addStatus(p, e.status, e.turns || 30);
  recomputePlayer(p);
}

function repairBest(p) {
  let worst = null;
  for (const slot of ['hand', 'body', 'head', 'offhand']) {
    const it = p.equipment[slot];
    if (it && it.condition < 100 && (!worst || it.condition < worst.condition)) worst = it;
  }
  if (!worst) { logLine('Nothing needs mending.', 'plain'); return false; }
  worst.condition = Math.min(100, worst.condition + 50);
  logLine(`You put your ${worst.name} back together. (${worst.condition})`, 'good');
  return true;
}

/** Identification route 2: the mortar, 25 coin and 20 turns, always works. */
export function identifyItem(p, item) {
  if (item.identified) return false;
  item.identified = true;
  item.name = itemDisplayName(item);
  if (item.kind === 'tonic') State.knowledge.tonics.add(item.tonic);
  if (item.kind === 'trinket') State.knowledge.trinkets.add(item.trinket);
  recomputePlayer(p);
  bus.emit(EV.ITEM_IDENTIFIED, { key: item.tonic || item.trinket || item.base, name: item.name });
  logLine(`It is ${item.name}.`, 'good');
  return true;
}

/** Route 5, the mercy path: carrying an unknown trinket teaches you what it is. */
export function tickAttunement(p) {
  for (const slot of ['trinket1', 'trinket2']) {
    const it = p.equipment[slot];
    if (!it || it.identified) continue;
    it.carried = (it.carried || 0) + 1;
    if (it.carried >= 400) identifyItem(p, it);
  }
}

/** Brewing: player-brewed tonics come pre-identified. A reward for learning. */
export function brew(p, reagentKey) {
  const def = BASE_ITEMS[reagentKey];
  if (!def || !def.tonic) { logLine('That does not brew into anything.', 'plain'); return false; }
  if (!takeOf(p, reagentKey, 1)) return false;
  const e = TONIC_EFFECTS.find(t => t.key === def.tonic);
  if (!e) return false;
  const item = {
    uid: 'B:' + def.tonic + ':' + State.tick, base: 'tonic', material: null, quality: 2,
    affixes: [], ilvl: 4, condition: 100, charges: null, identified: true, stack: 1,
    bound: false, tonic: e.key, name: e.name, weight: 0.3, kind: 'tonic',
  };
  State.knowledge.tonics.add(e.key);
  addItem(p, item);
  return true;
}

/** Cooking: two reagents make a dish, named from what went into it. */
export function cook(p, aKey, bKey) {
  const A = BASE_ITEMS[aKey], B = BASE_ITEMS[bKey];
  if (!A || !B) return false;
  if (!takeOf(p, aKey, 1)) return false;
  if (!takeOf(p, bKey, 1)) { addItem(p, makeSimpleItem(aKey, 1), true); return false; }
  const dish = makeSimpleItem('pottage', 1);
  dish.name = `${A.name}-and-${B.name} pottage`;
  dish.uid = 'C:' + aKey + bKey + State.tick;
  addItem(p, dish);
  logLine(`${dish.name}. It will keep the cold off.`, 'good');
  return true;
}

export { itemValue };
