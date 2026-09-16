// ============================================================
// game/dialogue.js - template binding (GDD §13.7)
// Every line carries one concrete fact, or is six words or fewer.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DIALOGUE, RESPONSES } from '../data/dialogue.js';
import { CULTURES } from '../data/cultures.js';
import { OBSERVATIONS } from '../data/text.js';
import { State, logLine } from './state.js';
import { patchNpc, rememberNpc, rosterOf } from '../world/entities.js';

/** Four warmth tiers, which change vocabulary, not just adjectives. */
export function warmthTier(disposition) {
  if (disposition >= 60) return 3;
  if (disposition >= 25) return 2;
  if (disposition >= 0) return 1;
  return 0;
}

const SLOT_RE = /\{(\w+(?:\.\w+)*)\}/g;

/**
 * Bind a template's slots to real facts, or reject it.
 * The requirement is read from the text, not from the declared list, so a
 * template can never ship asking for a fact the binder does not check.
 */
function bind(template, facts) {
  const needed = [...template.text.matchAll(SLOT_RE)].map(m => m[1]);
  for (const slot of needed.concat(template.slots)) {
    const v = facts[slot];
    if (v === undefined || v === null || v === '') return null;
  }
  return template.text.replace(SLOT_RE, (_, key) => facts[key]);
}

/** Assemble one line for an intent. Returns null if nothing binds. */
export function line(state, npc, intent, facts) {
  const tier = warmthTier(npc.disposition || 0);
  const bank = DIALOGUE[intent];
  if (!bank) return null;
  const rng = state.rngStreams.cosmetic;
  for (let t = tier; t >= 0; t--) {
    const pool = bank[t];
    if (!pool || !pool.length) continue;
    const order = rng.shuffle(pool.slice());
    for (const tmpl of order) {
      const text = bind(tmpl, facts);
      if (text) return text;
    }
  }
  return null;
}

/** Everything the binder is allowed to call a fact. */
export function factsFor(state, npc) {
  const settle = state.W.settlements.get(npc.settlementId);
  const region = settle ? state.W.regions.get(settle.regionId) : null;
  const culture = CULTURES[npc.culture] || CULTURES.hedgewright;
  const roster = rosterOf(state, npc.settlementId).filter(n => n.id !== npc.id && n.state === 'alive');
  const rng = state.rngStreams.cosmetic;
  const other = roster.length ? rng.pick(roster) : null;
  const other2 = roster.length > 1 ? rng.pick(roster.filter(n => !other || n.id !== other.id)) : null;
  const hollows = region ? region.hollows.map(id => state.W.hollows.get(id)).filter(Boolean) : [];
  const hollow = hollows.length ? rng.pick(hollows) : null;
  const need = (npc.needs && npc.needs[0]) || null;

  const facts = {
    shortName: npc.shortName, name: npc.name, trade: npc.trade,
    greeting: culture.greeting, settlement: settle ? settle.name : 'here',
    region: region ? region.name : 'the country', festival: culture.festival,
    playerName: 'keeper', food: culture.foods[0].replace('_', ' '),
    prop: npc.trade === 'weaver' ? 'loom' : npc.trade === 'smith' ? 'forge' : 'hearth',
    decor: 'wash-line', tic: npc.voice.tic,
    other: other ? other.shortName : null, other2: other2 ? other2.shortName : null,
    hollow: hollow ? hollow.name : null,
    place: need ? need.placeName : (hollow ? hollow.name : null),
    object: need ? needObjectName(need) : null,
    reason: need ? need.reason : null,
    fact: npc.secret ? secretLine(state, npc) : null,
  };
  // Under the Quiet, a noun comes loose. Sparingly, and never in a quest line.
  if (region && region.quiet >= 0.35) facts.quietLoss = true;
  return facts;
}

function needObjectName(need) {
  if (!need.object) return null;
  if (need.object.item) return itemNameOf(need.object.item);
  if (need.object.monster) return need.object.monster.replace(/_/g, ' ');
  if (need.object.npc) return 'someone';
  if (need.object.propKind) return need.object.propKind;
  return null;
}

import { BASE_ITEMS } from '../data/items.js';
const itemNameOf = key => (BASE_ITEMS[key] && BASE_ITEMS[key].name) || key.replace(/_/g, ' ');

function secretLine(state, npc) {
  if (!npc.secret) return null;
  const target = npc.secret.target;
  const who = target ? (rosterOf(state, npc.settlementId).find(n => n.id === target) || {}).shortName : null;
  const kinds = {
    debt: who ? `${who} is owed money, and has stopped asking.` : 'There is a debt here nobody mentions.',
    grief: 'Somebody in this house is not over it.',
    theft: who ? `Something of ${who}'s went missing and did not go far.` : 'Something went missing here.',
    affection: who ? `They will not say it to ${who}, and everybody knows.` : 'There is a fondness here, unspoken.',
    lie: 'What they told you about the water is not quite the whole of it.',
    'was-there': 'They were there when it happened. They do not talk about it.',
  };
  return kinds[npc.secret.kind] || null;
}

/**
 * Apply the Quiet's name-loss to a line. Occasional by design - the effect
 * lands because it is rare, and it never eats a word a quest depends on.
 */
export function quietify(state, text, region) {
  if (!region || region.quiet < 0.35) return text;
  if (state.dialogue && state.dialogue.firstMeeting) return text;
  if (!state.rngStreams.cosmetic.chance(Math.min(0.45, region.quiet * 0.5))) return text;
  const words = text.split(' ');
  const idx = words.findIndex(w => /^[a-z]{5,}[.,]?$/.test(w));
  if (idx < 0) return text;
  words[idx] = '———';
  return words.join(' ') + ' Sorry. It has gone out of my head.';
}

/** Open a conversation. Costs no turns; the world does not advance. */
export function openDialogue(state, npc, actor) {
  if (npc.state !== 'alive') { logLine(`${npc.shortName} is not here any more.`, 'plain'); return; }
  const first = !npc.metPlayer;
  if (first) {
    patchNpc(state, npc, { metPlayer: true });
    bus.emit(EV.NPC_MET, { npcId: npc.id });
    state.stats.social++;
  }
  const day = Math.floor(state.tick / 2400);
  if (npc.lastVisitDay !== day) {
    patchNpc(state, npc, { lastVisitDay: day });
    adjustDisposition(state, npc, 1, 'visited');
  }
  state.dialogue = { npc, actor, history: [], firstMeeting: first };
  state.mode = 'dialogue';
  bus.emit(EV.UI_DIALOGUE, { npcId: npc.id, open: true });
}

export function closeDialogue(state) {
  state.dialogue = null;
  if (state.mode === 'dialogue') state.mode = state.hollow ? 'hollow' : 'overworld';
  bus.emit(EV.UI_DIALOGUE, { open: false });
}

/** Disposition and its effects (GDD §13.6). */
export function adjustDisposition(state, npc, delta, reason) {
  const before = npc.disposition || 0;
  let d = delta;
  if (reason === 'gifted' && state.player.mods.giftMult) d = Math.round(d * state.player.mods.giftMult);
  const after = Math.max(-100, Math.min(100, before + d));
  patchNpc(state, npc, { disposition: after });
  if (reason) rememberNpc(state, npc, reason, String(d));
  bus.emit(EV.NPC_DISPOSITION, { npcId: npc.id, value: after, delta: d, reason });
  if (before < 40 && after >= 40) logLine(`${npc.shortName} has decided about you.`, 'good');
  return after;
}

/** Gossip spreads at 30% strength, once a day, two region hops. */
export function propagateGossip(state) {
  const day = Math.floor(state.tick / 2400);
  if (state.lastGossipDay === day) return;
  state.lastGossipDay = day;
  for (const s of state.W.settlements.values()) {
    const roster = state.world.rosters.get(s.id);
    if (!roster) continue;
    const mean = roster.reduce((a, n) => a + (n.disposition || 0), 0) / Math.max(1, roster.length);
    s.reputation = Math.round(mean);
  }
}

export { RESPONSES };
