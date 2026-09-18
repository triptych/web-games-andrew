// ============================================================
// game/quests.js - the predicate engine (GDD 11)
// Goals are data; this is the only thing that evaluates them. Counting
// goals ("defeat 5 tide dragons") are measured against a baseline taken
// when the quest was accepted, so accepting a quest never back-fills.
//
// The hard-won rule from game-036: the ACTIVE step is re-tested on every
// event, whatever fired, or an ordered chain can deadlock on a step that
// was satisfied by something it never subscribed to.
// ============================================================
import { bus } from '../core/bus.js';
import { state, addItem, removeItem, addCoin, hasItem, itemCount, setFlag, flag, dragonById } from './state.js';
import { MAIN_CHAIN, SIDE_QUESTS, questById } from '../data/quests.js';
import { LINEAGES, ELDER_LINEAGES } from '../data/lineages.js';
import { stageRank } from '../data/constants.js';
import { itemName } from '../data/items.js';

/** Running totals, kept here so quests never have to poll the world. */
function counters() {
  if (!state.quests.counters) {
    state.quests.counters = {
      defeats: { total: 0, element: {}, lineage: {} },
      captures: { total: 0, ashbound: 0, element: {}, lineage: {} },
      champions: {},
      hatched: 0, bred: 0, cleansed: 0, bosses: {},
    };
  }
  return state.quests.counters;
}

export function noteDefeat(d) {
  const c = counters();
  c.defeats.total++;
  for (const el of d.elements) if (el) c.defeats.element[el] = (c.defeats.element[el] || 0) + 1;
  c.defeats.lineage[d.lineageId] = (c.defeats.lineage[d.lineageId] || 0) + 1;
  if (d.championQuestId) c.champions[d.championQuestId] = (c.champions[d.championQuestId] || 0) + 1;
  if (d.bossId) c.bosses[d.bossId] = (c.bosses[d.bossId] || 0) + 1;
}

export function noteCapture(d) {
  const c = counters();
  c.captures.total++;
  if (d.ashbound || d.wasAshbound) c.captures.ashbound++;
  for (const el of d.elements) if (el) c.captures.element[el] = (c.captures.element[el] || 0) + 1;
  c.captures.lineage[d.lineageId] = (c.captures.lineage[d.lineageId] || 0) + 1;
}

export function noteHatch() { counters().hatched++; }
export function noteBreed() { counters().bred++; }
export function noteCleanse() { counters().cleansed++; setFlag('cleansed_one'); }
export function noteBoss(bossId) { counters().bosses[bossId] = (counters().bosses[bossId] || 0) + 1; }

/** A flat snapshot of every counter, used as a quest's starting baseline. */
function snapshot() {
  return JSON.parse(JSON.stringify(counters()));
}

function since(base, path, key = null) {
  const now = counters();
  const get = (obj) => {
    let v = obj;
    for (const p of path) v = (v || {})[p];
    if (key !== null) v = (v || {})[key];
    return typeof v === 'number' ? v : 0;
  };
  return Math.max(0, get(now) - get(base || {}));
}

// ------------------------------------------------------------- evaluation --
/**
 * Evaluate one goal. Returns { have, need, done } so the journal can show
 * progress for everything, not just the goals that happen to be countable.
 */
export function evaluateGoal(goal, entry = {}) {
  const base = entry.baseline || {};
  const g = goal || {};
  switch (g.kind) {
    case 'reach':
      return bool(state.visited.includes(g.node) || state.node === g.node);

    case 'boss':
      return bool((counters().bosses[g.bossId] || 0) > 0);

    case 'flag':
      return bool(flag(g.key));

    case 'defeat': {
      const have = g.element ? since(base, ['defeats', 'element'], g.element)
                 : g.lineage ? since(base, ['defeats', 'lineage'], g.lineage)
                 : since(base, ['defeats', 'total']);
      return count(have, g.count || 1);
    }

    case 'champion':
      return count(counters().champions[g.championId] || 0, g.count || 1);

    case 'capture': {
      const have = g.ashbound ? since(base, ['captures', 'ashbound'])
                 : g.element ? since(base, ['captures', 'element'], g.element)
                 : g.lineage ? since(base, ['captures', 'lineage'], g.lineage)
                 : since(base, ['captures', 'total']);
      return count(have, g.count || 1);
    }

    case 'hatch':  return count(since(base, ['hatched']), g.count || 1);
    case 'breed':  return count(since(base, ['bred']), g.count || 1);

    case 'item': {
      const entries = Object.entries(g.items || {});
      const have = entries.reduce((n, [id, want]) => n + Math.min(itemCount(id), want), 0);
      const need = entries.reduce((n, [, want]) => n + want, 0);
      return { have, need, done: entries.every(([id, want]) => itemCount(id) >= want),
               detail: entries.map(([id, want]) => `${itemName(id)} ${Math.min(itemCount(id), want)}/${want}`).join(', ') };
    }

    case 'own': {
      if (g.elderSpread) {
        const held = new Set(state.roster.filter(d => d.stage !== 'egg').map(d => d.lineageId));
        const have = ELDER_LINEAGES.filter(l => held.has(l)).length;
        return count(have, g.count || ELDER_LINEAGES.length);
      }
      const matches = state.roster.filter(d =>
        (!g.lineage || d.lineageId === g.lineage) &&
        (!g.element || d.elements.includes(g.element)) &&
        (!g.stage || stageRank(d.stage) >= stageRank(g.stage)) &&
        (!g.generation || (d.generation || 0) >= g.generation));
      return count(matches.length, g.count || 1);
    }

    case 'bond': {
      const best = state.roster.reduce((n, d) => Math.max(n, d.bond || 0), 0);
      return count(best, g.n || 50);
    }

    case 'level': {
      const best = state.roster.reduce((n, d) => Math.max(n, d.level || 0), 0);
      return count(best, g.n || 10);
    }

    case 'broodex': {
      const have = Object.values(state.broodex).filter(e => e.caught > 0).length;
      return count(have, g.count || 1);
    }

    default:
      return { have: 0, need: 1, done: false };
  }
}

const bool = b => ({ have: b ? 1 : 0, need: 1, done: !!b });
const count = (have, need) => ({ have: Math.min(have, need), need, done: have >= need });

// ------------------------------------------------------------ quest log --
export const activeEntries = () => state.quests.active;
export const isDone = id => state.quests.done.includes(id);
export const isActive = id => state.quests.active.some(e => e.id === id);

export function acceptQuest(quest) {
  if (!quest || isActive(quest.id) || isDone(quest.id)) return false;
  state.quests.active.push({
    id: quest.id,
    kind: quest.kind || (MAIN_CHAIN.some(q => q.id === quest.id) ? 'main' : 'side'),
    baseline: snapshot(),
    data: quest.kind === 'board' ? quest : null,
    acceptedAt: Date.now(),
  });
  bus.emit('quest:accepted', quest);
  checkQuests();
  return true;
}

export function abandonQuest(id) {
  const i = state.quests.active.findIndex(e => e.id === id);
  if (i < 0) return false;
  const [entry] = state.quests.active.splice(i, 1);
  bus.emit('quest:abandoned', entry);
  return true;
}

/** The full quest record for an entry, authored or generated. */
export function questFor(entry) {
  return entry.data || questById(entry.id) || null;
}

export const progressOf = entry => evaluateGoal((questFor(entry) || {}).goal, entry);

/** The main chain is ordered; this is the step the player is on. */
export function currentMainQuest() {
  const step = state.quests.mainStep || 0;
  return MAIN_CHAIN[step] || null;
}

/**
 * Re-test everything. Cheap, and immune to the game-036 deadlock: the active
 * main step is always folded into the pass, whatever event fired.
 */
export function checkQuests() {
  let changed = true, guard = 0;
  const completed = [];
  while (changed && guard++ < 20) {
    changed = false;

    // --- main chain ---
    const main = currentMainQuest();
    if (main && !isActive(main.id) && !isDone(main.id) && main.act <= state.act) {
      acceptMain(main);
      changed = true;
    }
    // Side quests are not auto-accepted; the player takes those from an NPC.
    for (const entry of [...state.quests.active]) {
      const quest = questFor(entry);
      if (!quest) { abandonQuest(entry.id); continue; }
      let res;
      try { res = evaluateGoal(quest.goal, entry); }
      catch (err) { console.error('[quests] goal failed', quest.id, err); continue; }
      if (res.done) {
        completeQuest(entry, quest);
        completed.push(quest);
        changed = true;
      }
    }
  }
  if (completed.length) bus.emit('quests:completed', completed);
  bus.emit('quests:changed');
  return completed;
}

function acceptMain(quest) {
  state.quests.active.push({ id: quest.id, kind: 'main', baseline: snapshot(), data: null, acceptedAt: Date.now() });
  bus.emit('quest:accepted', quest);
  if (quest.scene) bus.emit('scene:request', { id: quest.scene, questId: quest.id });
}

function completeQuest(entry, quest) {
  state.quests.active = state.quests.active.filter(e => e !== entry);
  if (!state.quests.done.includes(quest.id)) state.quests.done.push(quest.id);

  // Material quests take the materials.
  if (quest.consumes && quest.goal.kind === 'item') {
    for (const [id, n] of Object.entries(quest.goal.items)) removeItem(id, n);
  }

  const reward = quest.reward || {};
  if (reward.coin) addCoin(reward.coin);
  for (const it of reward.items || []) addItem(it, 1);

  if (entry.kind === 'main') {
    state.quests.mainStep = Math.min(MAIN_CHAIN.length, (state.quests.mainStep || 0) + 1);
    if (quest.after) bus.emit('scene:request', { id: quest.after, questId: quest.id, after: true });
  }
  bus.emit('quest:completed', { quest, reward });
}

/** Side quests an NPC at this node can offer right now. */
export function availableSideQuests(nodeId) {
  return SIDE_QUESTS.filter(q =>
    q.node === nodeId && q.act <= state.act && !isActive(q.id) && !isDone(q.id));
}

/** Wire the counters to the rest of the game exactly once. */
let wired = false;
export function wireQuests() {
  if (wired) return;
  wired = true;
  bus.on('battle:defeated', d => { noteDefeat(d); });
  bus.on('dragon:captured', d => { noteCapture(d); checkQuests(); });
  bus.on('egg:hatched', () => { noteHatch(); checkQuests(); });
  bus.on('egg:laid', () => { noteBreed(); checkQuests(); });
  bus.on('dragon:cleansed', () => { noteCleanse(); checkQuests(); });
  bus.on('boss:defeated', id => { noteBoss(id); checkQuests(); });
  for (const ev of ['battle:ended', 'node:changed', 'inventory:changed', 'roster:changed',
                    'act:changed', 'flag:changed', 'broodex:changed', 'party:rested']) {
    bus.on(ev, () => checkQuests());
  }
}
