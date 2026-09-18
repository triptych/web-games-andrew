// ============================================================
// game/state.js - the single source of truth (GDD 14)
// Everything the player has done lives here. Systems mutate it through
// these functions and emit on the bus; the UI only ever reads.
// ============================================================
import { bus } from '../core/bus.js';
import { clamp } from '../core/util.js';
import { RNG, rngFrom, hashStr } from '../core/rand.js';
import { ITEMS, item } from '../data/items.js';
import { PARTY_SIZE, ROSTER_MAX, ECONOMY, RANKS, BOND, ESSENCE_CAP, SAVE_VERSION } from '../data/constants.js';
import { statsOf, fullHeal, clampPools, addBond, checkStage, geneKey } from '../gen/dragon.js';

export const state = {
  version: SAVE_VERSION,
  seed: 'emberbrood',
  wardenName: 'Warden',
  act: 1,
  coin: ECONOMY.startingCoin,
  node: 'broodwell',
  visited: ['broodwell'],
  roster: [],          // every dragon you own, party included
  party: [],           // up to 3 dragon ids, in order
  eggs: [],            // { id, genes, lineageId, elements, essence, moves, parents, generation, battlesLeft, broodRole, temperament }
  inventory: {},       // itemId -> count
  flags: {},           // story and world booleans
  quests: { active: [], done: [], board: {}, mainStep: 0 },
  broodex: {},         // lineageId -> { seen, caught, bred }
  stats: { battles: 0, wins: 0, captures: 0, hatched: 0, bred: 0, faints: 0, steps: 0, playtimeMs: 0 },
  settings: { sound: true, music: true, volume: 0.6, reducedMotion: false, fastText: false },
  startedAt: Date.now(),
  ending: null,
};

/** Reset to a fresh game on a seed. */
export function newGame(seed, wardenName = 'Warden') {
  state.version = SAVE_VERSION;
  state.seed = String(seed || 'emberbrood');
  state.wardenName = wardenName || 'Warden';
  state.act = 1;
  state.coin = ECONOMY.startingCoin;
  state.node = 'broodwell';
  state.visited = ['broodwell'];
  state.roster = [];
  state.party = [];
  state.eggs = [];
  state.inventory = {};
  state.flags = {};
  state.quests = { active: [], done: [], board: {}, mainStep: 0 };
  state.broodex = {};
  state.stats = { battles: 0, wins: 0, captures: 0, hatched: 0, bred: 0, faints: 0, steps: 0, playtimeMs: 0 };
  state.startedAt = Date.now();
  state.ending = null;
  bus.emit('state:new');
}

/** A deterministic stream for anything that must survive a reload. */
export function worldRng(domain, ...coords) {
  return rngFrom(state.seed, domain, ...coords);
}

/** A stream that may differ between sessions (battle variance, flavour). */
export function liveRng(domain) {
  return rngFrom(state.seed + ':' + Date.now() + ':' + Math.random(), domain);
}

// ---------------------------------------------------------------- roster --
export const dragonById = id => state.roster.find(d => d.id === id) || null;
export const partyDragons = () => state.party.map(dragonById).filter(Boolean);
export const livingParty = () => partyDragons().filter(d => !d.fainted && d.hp > 0);
export const reserveDragons = () => state.roster.filter(d => !state.party.includes(d.id));

export function addDragon(d, { toParty = false } = {}) {
  if (state.roster.length >= ROSTER_MAX) return { ok: false, why: 'The Broodwell is full.' };
  state.roster.push(d);
  recordBroodex(d, 'caught');
  if (toParty && state.party.length < PARTY_SIZE) state.party.push(d.id);
  bus.emit('roster:changed');
  bus.emit('dragon:added', d);
  return { ok: true, dragon: d };
}

export function releaseDragon(id) {
  const i = state.roster.findIndex(d => d.id === id);
  if (i < 0) return false;
  const [d] = state.roster.splice(i, 1);
  state.party = state.party.filter(p => p !== id);
  bus.emit('roster:changed');
  bus.emit('dragon:released', d);
  return true;
}

export function setParty(ids) {
  const valid = ids.filter(id => dragonById(id)).slice(0, PARTY_SIZE);
  state.party = valid;
  bus.emit('party:changed');
}

export function togglePartyMember(id) {
  const d = dragonById(id);
  if (!d) return false;
  if (state.party.includes(id)) {
    state.party = state.party.filter(p => p !== id);
  } else {
    if (state.party.length >= PARTY_SIZE) return false;
    state.party.push(id);
  }
  bus.emit('party:changed');
  return true;
}

export function restParty({ atHome = false } = {}) {
  for (const d of state.roster) {
    fullHeal(d);
    d.meal = null;
    if (state.party.includes(d.id)) addBond(d, BOND.perRest);
    else if (atHome) addBond(d, BOND.perRestBoxed);
    checkStage(d);
  }
  bus.emit('roster:changed');
  bus.emit('party:rested');
}

// -------------------------------------------------------------- inventory --
export function itemCount(id) { return state.inventory[id] || 0; }

export function addItem(id, n = 1) {
  if (!ITEMS[id]) return 0;
  const max = ITEMS[id].stack ?? 99;
  const before = state.inventory[id] || 0;
  const after = clamp(before + n, 0, max);
  state.inventory[id] = after;
  if (after === 0) delete state.inventory[id];
  bus.emit('inventory:changed', { id, delta: after - before });
  return after - before;
}

export function removeItem(id, n = 1) {
  const have = state.inventory[id] || 0;
  if (have < n) return false;
  const left = have - n;
  if (left <= 0) delete state.inventory[id]; else state.inventory[id] = left;
  bus.emit('inventory:changed', { id, delta: -n });
  return true;
}

export const hasItem = (id, n = 1) => (state.inventory[id] || 0) >= n;

export function inventoryList(filter = null) {
  return Object.entries(state.inventory)
    .filter(([id]) => ITEMS[id])
    .map(([id, count]) => ({ id, count, def: ITEMS[id] }))
    .filter(e => !filter || filter(e.def, e))
    .sort((a, b) => a.def.kind === b.def.kind
      ? a.def.name.localeCompare(b.def.name)
      : a.def.kind.localeCompare(b.def.kind));
}

// ----------------------------------------------------------------- money --
export function addCoin(n) {
  state.coin = Math.max(0, state.coin + Math.round(n));
  bus.emit('coin:changed', state.coin);
  return state.coin;
}
export const canAfford = n => state.coin >= n;
export function spendCoin(n) {
  if (state.coin < n) return false;
  addCoin(-n);
  return true;
}

// ----------------------------------------------------------------- flags --
export const flag = k => !!state.flags[k];
export function setFlag(k, v = true) {
  const before = state.flags[k];
  state.flags[k] = v;
  if (before !== v) bus.emit('flag:changed', { key: k, value: v });
}

export function visit(nodeId) {
  if (!state.visited.includes(nodeId)) {
    state.visited.push(nodeId);
    bus.emit('node:discovered', nodeId);
  }
  state.node = nodeId;
  state.stats.steps++;
  bus.emit('node:changed', nodeId);
}

export function setAct(n) {
  if (n <= state.act) return;
  state.act = n;
  bus.emit('act:changed', n);
}

// --------------------------------------------------------------- broodex --
export function recordBroodex(d, how = 'seen') {
  const e = state.broodex[d.lineageId] || (state.broodex[d.lineageId] = { seen: 0, caught: 0, bred: 0, genes: [] });
  if (how === 'seen') e.seen++;
  else if (how === 'caught') { e.caught++; e.seen++; }
  else if (how === 'bred') { e.bred++; e.caught++; e.seen++; }
  const key = geneKey(d);
  if (!e.genes.includes(key) && e.genes.length < 60) e.genes.push(key);
  bus.emit('broodex:changed', d.lineageId);
}

export const broodexCaught = () => Object.values(state.broodex).reduce((n, e) => n + (e.caught > 0 ? 1 : 0), 0);

/** Warden rank is earned from distinct lineages held plus story beats. */
export function wardenRank() {
  const score = broodexCaught() * 3 + state.stats.captures + (state.act - 1) * 4 + state.stats.bred * 2;
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r.needed) rank = r;
  return { ...rank, score };
}

// ----------------------------------------------------------------- equip --
export function equipItem(dragonId, itemId) {
  const d = dragonById(dragonId);
  const def = item(itemId);
  if (!d || !def || def.kind !== 'relic') return { ok: false, why: 'That is not equipment.' };
  if (!hasItem(itemId)) return { ok: false, why: 'You do not have one.' };
  const slot = def.slot || 'relic';
  const previous = d.equip[slot];
  removeItem(itemId, 1);
  if (previous) addItem(previous.id, 1);
  d.equip[slot] = { ...def };
  clampPools(d);
  bus.emit('roster:changed');
  return { ok: true, slot, replaced: previous };
}

export function unequip(dragonId, slot) {
  const d = dragonById(dragonId);
  if (!d || !d.equip[slot]) return false;
  addItem(d.equip[slot].id, 1);
  d.equip[slot] = null;
  clampPools(d);
  bus.emit('roster:changed');
  return true;
}

// ------------------------------------------------------------------ eggs --
export function addEgg(egg) {
  state.eggs.push(egg);
  bus.emit('eggs:changed');
  return egg;
}

export function tickEggs(n = 1) {
  const ready = [];
  for (const egg of state.eggs) {
    egg.battlesLeft = Math.max(0, egg.battlesLeft - n);
    if (egg.battlesLeft === 0) ready.push(egg);
  }
  if (ready.length) bus.emit('eggs:ready', ready);
  bus.emit('eggs:changed');
  return ready;
}

export function removeEgg(id) {
  const i = state.eggs.findIndex(e => e.id === id);
  if (i >= 0) { state.eggs.splice(i, 1); bus.emit('eggs:changed'); return true; }
  return false;
}

// ------------------------------------------------------------- serialise --
/** Dragons and eggs are already plain data; nothing derived is stored. */
export function serialize() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    seed: state.seed,
    wardenName: state.wardenName,
    act: state.act,
    coin: state.coin,
    node: state.node,
    visited: state.visited,
    roster: state.roster,
    party: state.party,
    eggs: state.eggs,
    inventory: state.inventory,
    flags: state.flags,
    quests: state.quests,
    broodex: state.broodex,
    stats: state.stats,
    settings: state.settings,
    startedAt: state.startedAt,
    ending: state.ending,
  };
}

export function deserialize(data) {
  if (!data || data.version !== SAVE_VERSION) return false;
  Object.assign(state, {
    seed: data.seed, wardenName: data.wardenName || 'Warden', act: data.act || 1,
    coin: data.coin || 0, node: data.node || 'broodwell', visited: data.visited || ['broodwell'],
    roster: data.roster || [], party: data.party || [], eggs: data.eggs || [],
    inventory: data.inventory || {}, flags: data.flags || {},
    quests: data.quests || { active: [], done: [], board: {}, mainStep: 0 },
    broodex: data.broodex || {}, stats: data.stats || state.stats,
    settings: { ...state.settings, ...(data.settings || {}) },
    startedAt: data.startedAt || Date.now(), ending: data.ending || null,
  });
  // Pools can be out of range if the balance numbers changed under a save.
  for (const d of state.roster) { checkStage(d); clampPools(d); }
  state.party = state.party.filter(id => dragonById(id));
  bus.emit('state:loaded');
  return true;
}
