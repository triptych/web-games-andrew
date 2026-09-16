// ============================================================
// game/quests.js - the runtime quest state machine (GDD §14.8)
// Quests are generated from needs, validated, and then advanced by what the
// player actually does.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { dist8 } from '../core/util.js';
import { MAX_ACTIVE_QUESTS, LEDGER_CAP, TICKS_PER_DAY } from '../data/constants.js';
import { generateNeeds, needEpochOf } from '../gen/needs.js';
import { buildQuest } from '../gen/quest.js';
import { State, logLine } from './state.js';
import { rosterOf, patchNpc } from '../world/entities.js';
import { grantXP, addShard, recomputePlayer } from './player.js';
import { addItem, countOf, takeOf, displayName } from './inventory.js';
import { generateItem, makeSimpleItem } from '../gen/item.js';
import { adjustDisposition } from './dialogue.js';

/** Everything a need or quest generator needs to know about a real place. */
export function questContext(state, settleId) {
  const settle = state.W.settlements.get(settleId);
  if (!settle) return null;
  const region = state.W.regions.get(settle.regionId);
  const layout = state.W.layoutOf(settleId);
  const roster = rosterOf(state, settleId);
  const hollows = region.hollows.map(id => state.W.hollows.get(id)).filter(Boolean);
  const neighbourSettlements = [];
  for (const s of state.W.settlements.values()) {
    if (s.id === settleId) continue;
    if (Math.hypot(s.x - settle.x, s.y - settle.y) <= 160) neighbourSettlements.push(s);
  }
  const mendables = [];
  for (const b of layout.buildings) {
    if (b.fn === 'craft') mendables.push({ id: `${b.id}:in0`, kind: 'loom', name: 'the loom' });
  }
  mendables.push({ id: `${settleId}:well`, kind: 'well', name: 'the well' });
  return {
    settlement: settle, settlementName: settle.name, region, regionBiome: region.dominantBiome,
    tier: region.tier, roster, hollows, neighbourSettlements, mendables,
    forage: (region.dominantBiome && ['nettle', 'berries', 'bell_cap']) || ['nettle'],
    plaza: { x: layout.plaza.x + 2, y: layout.plaza.y + 2 }, plazaName: 'hearth',
    festival: region.culture, x: settle.x, y: settle.y,
  };
}

/**
 * Refresh an NPC's needs for the current epoch and make sure a quest exists
 * for each one. Needs are saved; quests are re-derived from them, so this also
 * rebuilds the journal after a reload.
 */
export function refreshNeeds(state, npc) {
  const epoch = needEpochOf(state.tick);
  const ctx = questContext(state, npc.settlementId);
  if (!ctx) return [];
  const region = ctx.region;

  let needs = npc.needs || [];
  if (npc.needsEpoch !== epoch) {
    // At Quiet 0.65 people stop wanting new things; what is already asked for
    // can still be finished.
    needs = region.quiet >= 0.65 ? [] : generateNeeds(state.W, npc, epoch, ctx).slice(0, 2);
    patchNpc(state, npc, { needsEpoch: epoch, needs });
  }

  const kept = [];
  for (const need of needs) {
    const q = buildQuest(state.W, need, npc, ctx);
    if (!q) continue;                          // discarded, not faked
    kept.push(need);
    const existing = state.quests.get(q.id);
    if (existing) continue;                    // keep its progress
    q.needKind = need.kind;                    // set before the Q5 check reads it
    if (duplicateOf(state, q)) continue;       // Q5: one live quest per (kind, target)
    q.settlementId = npc.settlementId;
    q.regionId = region.id;
    state.quests.set(q.id, q);
  }
  if (kept.length !== needs.length) patchNpc(state, npc, { needs: kept });
  return kept;
}

/** Q5: two people wanting the same well mended is one quest, not two. */
function duplicateOf(state, q) {
  const sig = questSignature(q);
  if (!sig) return false;
  for (const other of state.quests.values()) {
    if (other.id === q.id) continue;
    if (other.state === 'complete' || other.state === 'failed') continue;
    if (questSignature(other) === sig) return true;
  }
  return false;
}

function questSignature(q) {
  const beat = q.beats.find(b => b.target &&
    (b.target.prop || b.target.item || b.target.monster || b.target.npc || b.target.tile));
  if (!beat) return null;
  const t = beat.target;
  const what = t.prop || t.item || t.monster || t.npc || (t.tile && `${t.tile.x},${t.tile.y}`);
  return [q.needKind || beat.kind, what].join('|');
}

export function questsOf(state, npcId) {
  return [...state.quests.values()].filter(q => q.giver === npcId && q.state !== 'complete' && q.state !== 'failed');
}

export function activeQuests(state) {
  return [...state.quests.values()].filter(q => q.state === 'active');
}

export function acceptQuest(state, q) {
  if (activeQuests(state).length >= MAX_ACTIVE_QUESTS) {
    logLine('You have as much on as you can keep straight. Drop something first.', 'warn');
    return false;
  }
  q.state = 'active';
  bus.emit(EV.QUEST_ACCEPTED, { questId: q.id });
  logLine(`${q.title}. ${q.beats[0] ? q.beats[0].hint : ''}`, 'good');
  return true;
}

export function dropQuest(state, q) {
  q.state = 'offered';
  q.current = 0;
  for (const b of q.beats) b.done = false;
  return true;
}

/** Every player action gets a look-in; beats advance in order. */
export function onPlayerAction(state, event) {
  for (const q of activeQuests(state)) {
    const beat = q.beats[q.current];
    if (!beat || beat.done) continue;
    if (matches(state, q, beat, event)) advanceBeat(state, q);
  }
  checkThreadBeats(state, event);
}

function matches(state, q, beat, event) {
  const p = state.player;
  const t = beat.target || {};
  switch (beat.kind) {
    case 'goto':
      if (t.hollow) return state.mode === 'hollow' && state.hollow.id === t.hollow && (!t.depth || state.hollow.depth >= t.depth);
      if (t.tile) return dist8(p.x, p.y, t.tile.x, t.tile.y) <= 2;
      if (t.settlement) { const s = state.W.settlements.get(t.settlement); return s && dist8(p.x, p.y, s.x, s.y) <= 12; }
      if (t.region) { const r = state.W.regions.get(t.region); return r && dist8(p.x, p.y, r.x, r.y) <= 80; }
      return false;
    case 'get': {
      if (!t.item) return false;
      const need = beat.count || 1;
      return countOf(p, t.item) >= need;
    }
    case 'kill':
      return event.kind === 'kill' && event.archetype === t.monster;
    case 'talk':
      return event.kind === 'talk' && event.npcId === t.npc;
    case 'give':
      return event.kind === 'give' && event.npcId === t.npc;
    case 'use':
      return event.kind === 'use' && event.prop && event.prop.id === t.prop;
    case 'survive':
      return event.kind === 'turn' && (beat.progress = (beat.progress || 0) + 1) >= (beat.count || 20);
    case 'escort':
      if (!t.settlement) return false;
      { const s = state.W.settlements.get(t.settlement); return s && dist8(p.x, p.y, s.x, s.y) <= 10; }
    case 'choose':
      return event.kind === 'choose' && event.questId === q.id;
    case 'descend':
      return state.mode === 'hollow' && state.hollow.id === t.hollow && state.hollow.depth >= (t.depth || 1);
    default:
      return false;
  }
}

function advanceBeat(state, q) {
  const beat = q.beats[q.current];
  beat.done = true;
  bus.emit(EV.QUEST_BEAT, { questId: q.id, index: q.current });
  // `kill` beats need a count
  if (beat.kind === 'kill' && (beat.count || 1) > 1) {
    beat.killed = (beat.killed || 0) + 1;
    if (beat.killed < beat.count) { beat.done = false; return; }
  }
  q.current++;
  if (q.current >= q.beats.length) { completeQuest(state, q); return; }
  const next = q.beats[q.current];
  if (next) logLine(next.hint, 'plain');
}

export function completeQuest(state, q) {
  const p = state.player;
  q.state = 'complete';
  state.stats.quests += 3;

  // hand over what the quest actually asked for
  for (const beat of q.beats) {
    if (beat.kind === 'get' && beat.target.item && !BASE_ITEM_IS_QUEST(beat.target.item)) {
      takeOf(p, beat.target.item, beat.count || 1);
    }
  }

  const payMult = p.mods.questPay || 1;
  for (const r of q.rewards) {
    if (r.kind === 'coin') { const c = Math.round(r.value * payMult); p.coin += c; logLine(`${c} coin.`, 'good'); }
    else if (r.kind === 'xp') grantXP(p, Math.round(r.value * payMult));
    else if (r.kind === 'item' && r.key) addItem(p, makeSimpleItem(r.key, 1));
    else if (r.kind === 'item') addItem(p, generateItem(state.master, q.id, 0, { ilvl: r.ilvl || 4, category: 'weapon' }));
    else if (r.kind === 'disposition') {
      const npc = findNpc(state, q.giver);
      if (npc) adjustDisposition(state, npc, r.value, 'helped');
    }
    else if (r.kind === 'vigor_shard') addShard(p, r.value || 1);
  }
  recomputePlayer(p);

  state.ledger.push({ tick: state.tick, text: `${q.title} — done. ${q.summary}` });
  if (state.ledger.length > LEDGER_CAP) state.ledger.shift();
  logLine(`${q.title}. That is done.`, 'good');
  bus.emit(EV.QUEST_COMPLETED, { questId: q.id, rewards: q.rewards });
}

const BASE_ITEM_IS_QUEST = key => key === 'vigor_shard' || key === 'ledger_fragment' || key === 'floor_key';

export function findNpc(state, npcId) {
  const settleId = npcId.slice(2, npcId.lastIndexOf(':'));
  const roster = rosterOf(state, settleId);
  return roster.find(n => n.id === npcId) || null;
}

// --- region Threads -------------------------------------------------------

export function threadOf(state, regionId) {
  const r = state.W.regions.get(regionId);
  if (!r || !r.threadId) return null;
  return state.W.threads.get(r.threadId) || null;
}

function checkThreadBeats(state, event) {
  for (const th of state.W.threads.values()) {
    if (th.state === 'done' || th.state === 'unknown') continue;
    const beat = th.beats[th.current];
    if (!beat || beat.done) continue;
    let hit = false;
    const t = beat.target || {};
    if (beat.kind === 'talk' && event.kind === 'talk' && event.npcId === t.npc) hit = true;
    if (beat.kind === 'goto' && t.region) {
      const r = state.W.regions.get(t.region);
      hit = r && dist8(state.player.x, state.player.y, r.x, r.y) <= 90;
    }
    if (beat.kind === 'descend' && state.mode === 'hollow' && state.hollow.id === t.hollow && state.hollow.depth >= (t.depth || 1)) hit = true;
    if (beat.kind === 'choose' && event.kind === 'threadChoice' && event.threadId === th.id) hit = true;
    if (!hit) continue;
    beat.done = true;
    th.current++;
    if (th.current >= th.beats.length) completeThread(state, th);
    else logLine(th.beats[th.current].hint, 'plain');
  }
}

export function startThread(state, th) {
  if (th.state !== 'unknown') return;
  th.state = 'active';
  logLine(`${th.premise}`, 'flavour');
  if (th.beats[0]) logLine(th.beats[0].hint, 'plain');
}

export function completeThread(state, th) {
  const p = state.player;
  th.state = 'done';
  const region = state.W.regions.get(th.regionId);
  if (region) {
    region.quiet = Math.max(th.quietFloor, region.quiet - th.quietDrop);
    region.quietFloor = th.quietFloor;
    region.threadState = 'done';
    bus.emit(EV.WORLD_QUIET, { regionId: region.id, value: region.quiet, delta: -th.quietDrop });
  }
  if (th.reward.kind === 'vigor_shard') addShard(p, th.reward.value || 2);
  else if (th.reward.kind === 'capability') {
    p.caps.add(th.reward.value);
    p.toolCharges[th.reward.value] = 3;
    bus.emit(EV.PLAYER_CAPABILITY, { key: th.reward.value });
  } else addItem(p, generateItem(state.master, th.id, 0, { ilvl: th.reward.ilvl || 8, category: 'weapon' }));

  // A Thread completed is a Ledger fragment found (GDD §14.5 step 2).
  const lt = state.longThread;
  if (lt) {
    const frag = lt.fragments.find(f => !f.found);
    if (frag) {
      frag.found = true;
      lt.fragmentsFound.push(frag.i);
      logLine(`A page, in the same hand as the others. "${frag.text}"`, 'flavour');
    }
  }
  grantXP(p, 150 + (region ? region.tier : 0) * 60);
  state.ledger.push({ tick: state.tick, text: `${region ? region.name : 'A region'} — ${th.shape.replace(/-/g, ' ')}. ${th.chosen === 'a' ? th.choicePoint.a : th.choicePoint.b}.` });
  logLine(`It is settled, in ${region ? region.name : 'the region'}. The air is different.`, 'good');
  state.stats.quiet += 4;
}

export function chooseThread(state, th, which) {
  th.chosen = which;
  const cost = which === 'a' ? th.choicePoint.aCost : th.choicePoint.bCost;
  logLine(cost, 'flavour');
  // the consequence is visible and permanent: somebody leaves
  const loserId = which === 'a' ? th.antagonist : th.anchor;
  const loser = loserId ? findNpc(state, loserId) : null;
  if (loser && state.rngStreams.combat.chance(0.5)) {
    patchNpc(state, loser, { state: 'departed' });
    logLine(`${loser.shortName} is not going to stay.`, 'plain');
    bus.emit(EV.NPC_DEPARTED, { npcId: loser.id, settlementId: loser.settlementId });
  }
  onPlayerAction(state, { kind: 'threadChoice', threadId: th.id });
}
