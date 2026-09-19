// ============================================================
// game/adventure.js - the loop between battles (GDD 12)
// Travel, explore, forage, rest, shop, forge, roost runs, and the battle
// lifecycle (start -> rewards -> capture -> level -> eggs). The UI calls
// these and listens; none of it knows how any of it works.
// ============================================================
import { bus } from '../core/bus.js';
import { state, worldRng, liveRng, visit, addItem, removeItem, addCoin, spendCoin, itemCount,
         hasItem, addDragon, dragonById, partyDragons, livingParty, restParty, setFlag, flag,
         recordBroodex, wardenRank, addEgg, tickEggs, removeEgg, setAct } from './state.js';
import { NODES, REGIONS, node as nodeOf, region as regionOf, neighbours, levelBand, FORAGE } from '../data/world.js';
import { ITEMS, item, RECIPES, byKind } from '../data/items.js';
import { rollEncounter, makeBoss, buildRoost, forage as forageAt } from '../gen/encounters.js';
import { makeDragon, gainXp, addBond, fullHeal, statsOf, maxHp, clampPools, checkStage, hasTrait } from '../gen/dragon.js';
import { Battle, SIDE, leaveBattle } from './battle.js';
import { hatch, breed as breedPair, breedingPreview } from './breeding.js';
import { VIGNETTES, vignettesFor } from '../data/events.js';
import { generateBoard } from '../gen/questgen.js';
import { BOSSES } from '../data/bosses.js';
import { BOND, ECONOMY, XP, PARTY_SIZE } from '../data/constants.js';
import { noteDefeat, noteCapture, noteHatch, noteBreed, noteCleanse, noteBoss, checkQuests, questFor, activeEntries } from './quests.js';
export { breedingPreview };
import { clamp } from '../core/util.js';

// ------------------------------------------------------------------ travel --
export function canTravel(toId) {
  const from = state.node;
  if (toId === from) return { ok: false, why: 'You are already here.' };
  if (!neighbours(from).includes(toId)) return { ok: false, why: 'No road from here.' };
  const n = nodeOf(toId);
  if ((n.act || 1) > state.act) return { ok: false, why: 'Not yet. There is something else to do first.' };
  return { ok: true };
}

export function travelTo(toId) {
  const check = canTravel(toId);
  if (!check.ok) return check;
  visit(toId);
  bus.emit('travel', { to: toId, node: nodeOf(toId) });
  return { ok: true, node: nodeOf(toId) };
}

export const partyLevel = () => {
  const p = partyDragons();
  return p.length ? Math.round(p.reduce((n, d) => n + d.level, 0) / p.length) : 1;
};

// ----------------------------------------------------------------- explore --
/**
 * One action at a wild node. Weighted toward a fight, but a place you have
 * walked over a dozen times should sometimes just be a place.
 */
export function explore(nodeId = state.node) {
  const n = nodeOf(nodeId);
  const rng = liveRng('explore');
  const roll = rng.next();

  if (n.kind === 'town' || n.kind === 'home') {
    return { kind: 'nothing', text: 'The streets are quiet. Nothing out here to find.' };
  }
  if (roll < 0.58) {
    const enc = rollEncounter(nodeId, partyLevel(), rng, worldRng('tables', nodeId.length), state.act,
                              { partySize: livingParty().length });
    return { kind: 'battle', encounter: enc };
  }
  if (roll < 0.78) {
    const found = forageAt(nodeId, rng, livingParty().some(d => hasTrait(d, 'scavenger')) ? 1 : 0);
    for (const f of found) addItem(f, 1);
    return { kind: 'forage', items: found,
             text: found.length > 1 ? 'Two useful things, in a place that owed you nothing.' : 'Something worth bending down for.' };
  }
  const pool = vignettesFor(n.region);
  const v = rng.weightedList(pool.length ? pool : VIGNETTES);
  return { kind: 'vignette', vignette: v };
}

/** Resolve a vignette choice. Effects are deliberately small. */
export function resolveVignette(vignette, choiceIndex) {
  const choice = vignette.choices[choiceIndex];
  if (!choice) return { ok: false };
  const req = choice.requires || {};
  if (req.item && !hasItem(req.item)) return { ok: false, why: `You have no ${item(req.item).name}.` };
  if (req.coin && state.coin < req.coin) return { ok: false, why: 'Not enough coin.' };

  const e = choice.effects || {};
  const lines = [];
  if (e.coin) { addCoin(e.coin); lines.push(e.coin > 0 ? `+${e.coin} coin.` : `${e.coin} coin.`); }
  for (const [id, n] of Object.entries(e.take || {})) { removeItem(id, n); lines.push(`You hand over the ${item(id).name.toLowerCase()}.`); }
  for (const [id, n] of Object.entries(e.items || {})) { addItem(id, n); lines.push(`${item(id).name} ×${n}.`); }
  if (e.bond) for (const d of partyDragons()) { const g = addBond(d, e.bond); if (g) lines.push(`${d.name}: ${g > 0 ? '+' : ''}${g} bond.`); }
  if (e.healPct) for (const d of partyDragons()) { d.hp = clamp(d.hp + Math.round(maxHp(d) * e.healPct), 0, maxHp(d)); }
  if (e.hpPct) for (const d of partyDragons()) { d.hp = clamp(d.hp + Math.round(maxHp(d) * e.hpPct), 1, maxHp(d)); }
  if (e.mpPct) for (const d of partyDragons()) { d.mp = clamp(d.mp + Math.round(statsOf(d).mp * e.mpPct), 0, statsOf(d).mp); }
  if (e.flag) setFlag(e.flag);
  if (e.mystery) {
    const rng = liveRng('mystery');
    const pool = [...byKind('relic'), ...byKind('breeding'), ...byKind('training')]
      .filter(id => ITEMS[id].rarity <= state.act + 1);
    const got = rng.pick(pool.length ? pool : ['ember_salve']);
    addItem(got, 1);
    lines.push(`The crate holds a ${ITEMS[got].name}. He seems as surprised as you are.`);
  }
  bus.emit('roster:changed');
  return { ok: true, lines };
}

// -------------------------------------------------------------------- rest --
export function rest() {
  const n = nodeOf(state.node);
  const cost = n.home ? 0 : Math.round(20 + partyLevel() * 4);
  if (cost > 0 && !spendCoin(cost)) return { ok: false, why: `That costs ${cost} coin, and you do not have it.` };
  restParty({ atHome: !!n.home });
  return { ok: true, cost, atHome: !!n.home };
}

// ------------------------------------------------------------------- shops --
/** Stock is stable per node per act, so a shop is a place, not a slot machine. */
export function shopStock(nodeId = state.node) {
  const n = nodeOf(nodeId);
  if (!n.services || !n.services.includes('shop')) return [];
  const rng = worldRng('shop', nodeId.length * 31 + state.act);
  const act = state.act;
  const always = ['ember_salve', 'ley_tonic', 'rune_cord', 'ashwash', 'frostroot', 'hearth_bread'];
  const byAct = {
    1: ['sunmelon', 'char_root', 'braveleaf', 'cinder_flask'],
    2: ['greater_salve', 'bind_chain', 'salt_cod', 'venomdraw', 'smoke_veil', 'warmth_stone', 'frost_shard'],
    3: ['greater_salve', 'deep_ley', 'sigil_snare', 'clearwater', 'clearmind', 'shock_vial', 'ash_pear', 'binding_powder'],
    4: ['wardens_salve', 'soulglass', 'panacea', 'phoenix_cinder', 'skyberry', 'stone_bolus', 'brood_incense'],
    5: ['full_salve', 'line_draught', 'hearth_ember', 'surge_horn', 'moonlit_snare', 'prism_dust'],
  };
  const list = new Set(always);
  for (let a = 1; a <= act; a++) for (const id of byAct[a] || []) list.add(id);
  if (n.services.includes('relics')) {
    const relics = byKind('relic').filter(id => ITEMS[id].rarity <= act + 1);
    for (const id of rng.sample(relics, 4)) list.add(id);
    for (const id of byKind('training')) if (act >= 3) list.add(id);
  }
  return [...list].filter(id => ITEMS[id]).map(id => ({ id, def: ITEMS[id], price: priceOf(id) }));
}

export const priceOf = id => Math.max(1, Math.round((ITEMS[id]?.price || 10)));
export const sellPrice = id => Math.max(1, Math.round((ITEMS[id]?.price || 10) * ECONOMY.sellRatio));

export function buy(id, n = 1) {
  const cost = priceOf(id) * n;
  if (!spendCoin(cost)) return { ok: false, why: 'Not enough coin.' };
  addItem(id, n);
  bus.emit('shop:bought', { id, n, cost });
  return { ok: true, cost };
}

export function sell(id, n = 1) {
  if (ITEMS[id]?.kind === 'key') return { ok: false, why: 'Not that.' };
  if (!removeItem(id, n)) return { ok: false, why: 'You have none.' };
  const gain = sellPrice(id) * n;
  addCoin(gain);
  bus.emit('shop:sold', { id, n, gain });
  return { ok: true, gain };
}

// ------------------------------------------------------------------- forge --
export function canForge(recipe) {
  if (state.coin < recipe.cost) return { ok: false, why: 'Not enough coin.' };
  for (const [part, n] of Object.entries(recipe.parts)) {
    if (itemCount(part) < n) return { ok: false, why: `Short of ${ITEMS[part].name}.` };
  }
  return { ok: true };
}

export function forge(recipe) {
  const check = canForge(recipe);
  if (!check.ok) return check;
  spendCoin(recipe.cost);
  for (const [part, n] of Object.entries(recipe.parts)) removeItem(part, n);
  addItem(recipe.out, 1);
  bus.emit('forge:made', recipe);
  return { ok: true, made: recipe.out };
}

// ------------------------------------------------------------------ board --
export function boardFor(nodeId = state.node) {
  const key = `${nodeId}:${state.act}`;
  if (!state.quests.board[key]) {
    state.quests.board[key] = generateBoard(nodeId, state.act, partyLevel(), worldRng('board', nodeId.length, state.act));
  }
  return state.quests.board[key].filter(q =>
    !state.quests.done.includes(q.id) && !state.quests.active.some(e => e.id === q.id));
}

// ------------------------------------------------------------------ roost --
export function enterRoost(nodeId = state.node) {
  const n = nodeOf(nodeId);
  if (n.kind !== 'roost' && n.kind !== 'spire') return { ok: false, why: 'There is nothing to go down into here.' };
  const run = buildRoost(nodeId, partyLevel(), liveRng('roost'), worldRng('tables', nodeId.length), state.act,
                         { partySize: livingParty().length });
  state.roost = run;
  bus.emit('roost:started', run);
  return { ok: true, run };
}

export function roostRoom() {
  const run = state.roost;
  if (!run) return null;
  return run.rooms[run.index] || null;
}

export function roostAdvance() {
  const run = state.roost;
  if (!run) return null;
  run.index++;
  if (run.index >= run.rooms.length) {
    state.roost = null;
    bus.emit('roost:cleared', run);
    return null;
  }
  bus.emit('roost:room', run.rooms[run.index]);
  return run.rooms[run.index];
}

export function leaveRoost() {
  state.roost = null;
  bus.emit('roost:left');
}

/** A roost treasure room: one good thing, scaled to the act. */
export function openTreasure() {
  const rng = liveRng('treasure');
  const pool = [...byKind('relic'), ...byKind('breeding'), ...byKind('binding'), ...byKind('training')]
    .filter(id => ITEMS[id].rarity <= state.act + 1 && ITEMS[id].price > 0);
  const got = rng.pick(pool.length ? pool : ['greater_salve']);
  addItem(got, 1);
  const coin = Math.round(60 * state.act * rng.float(0.8, 1.6));
  addCoin(coin);
  return { item: got, coin };
}

// --------------------------------------------------------------- battles --
let active = null;
export const activeBattle = () => active;

export function startBattle(encounter, opts = {}) {
  const party = partyDragons().filter(d => !d.fainted);
  if (!party.length) return { ok: false, why: 'Every dragon you have is out cold.' };
  for (const e of encounter.enemies) recordBroodex(e, 'seen');
  active = new Battle({
    allies: party,
    enemies: encounter.enemies,
    rng: liveRng('battle'),
    wardenRank: wardenRank().rank,
    context: {
      wild: opts.wild !== false && !encounter.boss,
      boss: !!encounter.boss,
      underground: !!encounter.underground,
      node: state.node,
    },
  });
  state.stats.battles++;
  bus.emit('battle:started', { battle: active, encounter });
  return { ok: true, battle: active };
}

export function startBossBattle(bossId) {
  const boss = makeBoss(bossId, liveRng('boss'));
  if (!boss) return { ok: false, why: 'No such fight.' };
  // Having met something is worth remembering: the next attempt gets told
  // what it is made of, so a bad matchup is a lesson rather than a wall.
  setFlag(`met_${bossId}`);
  return startBattle({ enemies: [boss], boss: bossId, underground: true, intro: BOSSES[bossId].intro },
                     { wild: boss.bindable });
}

/** A generated champion from a board quest. */
export function startChampionBattle(quest) {
  const spec = quest.champion;
  const rng = liveRng('champion');
  const d = makeDragon(rng, { lineageId: spec.lineageId, level: spec.level, wild: true, essenceQuality: 4 });
  d.name = spec.name;
  d.champion = true;
  d.championQuestId = quest.id;
  d.essence.hp = Math.min(15, d.essence.hp + 5);
  d.essence.atk = Math.min(15, d.essence.atk + 4);
  fullHeal(d);
  return startBattle({ enemies: [d], intro: `${spec.name} has been waiting for somebody to come.` });
}

/**
 * Wrap up a finished battle: rewards, experience, capture, bond, eggs.
 * Returns a report the UI narrates; nothing is applied twice because the
 * battle's own `finish()` is idempotent and this clears `active`.
 */
export function finishBattle() {
  if (!active) return null;
  const b = active;
  const rewards = b.finish();
  const report = { ...rewards, levels: [], captured: null, hatched: [], coin: 0, drops: [] };
  const rng = liveRng('rewards');

  if (rewards.won) {
    for (const e of b.enemies) {
      if (e === b.captured) continue;
      if (!e.fainted) continue;
      noteDefeat(e);
      bus.emit('battle:defeated', e);
      if (e.bossId) { noteBoss(e.bossId); bus.emit('boss:defeated', e.bossId); }
    }
    report.coin = rewards.coin;
    addCoin(rewards.coin);
    for (const d of rewards.drops) { addItem(d, 1); report.drops.push(d); }

    // Experience: split across everyone who took a turn, the whole party gets
    // a share, and nobody who fainted is punished twice.
    const share = rewards.participants.length ? rewards.xp / rewards.participants.length : 0;
    for (const d of b.allies) {
      const amount = Math.round((rewards.participants.includes(d) ? share : share * 0.5)
                                * (hasTrait(d, 'tempered') ? 1.15 : 1));
      if (amount <= 0) continue;
      const rep = gainXp(d, amount, rng);
      if (rep.levels.length || rep.stage) report.levels.push(rep);
      if (rep.levels.length) bus.emit('dragon:levelled', rep);
    }
    // Bond: fighting alongside you is most of how a dragon comes to trust you.
    for (const d of b.allies) {
      if (d.fainted) { addBond(d, BOND.faint); state.stats.faints++; }
      else addBond(d, BOND.perWin + (d.hp < maxHp(d) * 0.25 ? BOND.lowHpWin : 0));
    }
  }

  if (b.captured) {
    const caught = b.captured;
    leaveBattle(caught);
    caught.fainted = false;
    caught.hp = Math.max(1, Math.round(maxHp(caught) * 0.35));
    caught.bond = caught.wasAshbound ? BOND.capturedCleansed : BOND.captured;
    caught.caughtAt = state.node;
    caught.champion = false;
    const res = addDragon(caught, { toParty: state.party.length < PARTY_SIZE });
    report.captured = res.ok ? caught : null;
    report.rosterFull = !res.ok;
    if (res.ok) {
      state.stats.captures++;
      noteCapture(caught);
      bus.emit('dragon:captured', caught);
    }
  }

  // Cleansing an ashbound dragon counts even if it then got away.
  for (const id of b.cleansedIds) {
    const d = b.enemies.find(e => e.id === id) || dragonById(id);
    if (d) { noteCleanse(); bus.emit('dragon:cleansed', d); }
  }

  // Eggs incubate over battles, won or lost.
  const ready = tickEggs(1);
  report.eggsReady = ready.length;

  for (const d of b.allies) { leaveBattle(d); clampPools(d); checkStage(d); }
  for (const e of b.enemies) if (e !== b.captured) leaveBattle(e);

  active = null;
  state.stats.wins += rewards.won ? 1 : 0;
  bus.emit('battle:ended', report);
  checkQuests();
  return report;
}

/**
 * Pair two dragons at the Broodwell. Consumes any breeding items passed in
 * `use` ({ lineage_charm: 'a', prism_dust: true, ... }).
 */
export function layEgg(aId, bId, use = {}) {
  const a = dragonById(aId), b = dragonById(bId);
  if (!a || !b) return { ok: false, why: 'Pick two dragons.' };
  const modifiers = {};
  const spend = [];
  if (use.lineage_charm && hasItem('lineage_charm')) { modifiers.forceLineage = use.lineage_charm; spend.push('lineage_charm'); }
  if (use.prism_dust && hasItem('prism_dust')) { modifiers.mutate = 3; spend.push('prism_dust'); }
  if (use.ember_yolk && hasItem('ember_yolk')) { modifiers.perfectEssence = true; spend.push('ember_yolk'); }
  if (use.brood_tithe && hasItem('brood_tithe')) { modifiers.forceThrowback = true; spend.push('brood_tithe'); }
  if (use.warmth_stone && hasItem('warmth_stone')) { modifiers.warmth = 3; spend.push('warmth_stone'); }

  const res = breedPair(a, b, liveRng('breed'), modifiers);
  if (!res.ok) return res;
  for (const id of spend) removeItem(id, 1);
  addEgg(res.egg);
  state.stats.bred++;
  // Brooding is work: both parents lose a little edge and gain a little bond.
  addBond(a, 2); addBond(b, 2);
  noteBreed();
  bus.emit('egg:laid', res.egg);
  checkQuests();
  return { ok: true, egg: res.egg };
}

/** Hatch a ready egg into the roster. */
export function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg) return { ok: false, why: 'No such egg.' };
  if (egg.battlesLeft > 0) return { ok: false, why: `Not yet — ${egg.battlesLeft} more battles.` };
  const d = hatch(egg, liveRng('hatch'));
  const res = addDragon(d, { toParty: state.party.length < PARTY_SIZE });
  if (!res.ok) return res;
  removeEgg(eggId);
  state.stats.hatched++;
  recordBroodex(d, 'bred');
  noteHatch();
  bus.emit('egg:hatched', d);
  checkQuests();
  return { ok: true, dragon: d, egg };
}

/** A defeat is not a game over: you wake up at the Broodwell, lighter. */
export function handleDefeat() {
  const lost = Math.round(state.coin * 0.15);
  addCoin(-lost);
  restParty();
  visit('broodwell');
  bus.emit('defeat:recovered', { lost });
  return { lost };
}
