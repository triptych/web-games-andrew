// ============================================================
// gen/needs.js - NPC needs (GDD §13.3)
// Needs are generated BEFORE quests, and quests are generated FROM needs.
// A need whose object cannot be resolved to a real entity is discarded,
// never faked.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { DOMAINS, TICKS_PER_DAY } from '../data/constants.js';
import { TRADES } from '../data/cultures.js';
import { BASE_ITEMS } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';
import { NEED_REASONS } from '../data/text.js';

/** A fresh look at what people want, every three days. */
export const needEpochOf = tick => Math.floor(tick / TICKS_PER_DAY / 3);

const KINDS = ['retrieve', 'deliver', 'clear', 'supply', 'learn', 'mend', 'find_person', 'witness', 'settle', 'escort'];

/**
 * @pure Generate up to two open needs for one NPC at one epoch.
 * `ctx` supplies the real world around them: roster, hollows, settlements,
 * props, region. Anything unresolvable is dropped here, not later.
 */
export function generateNeeds(W, npc, epoch, ctx) {
  const rng = deriveRNG(W.master, DOMAINS.NPC_NEEDS, hashStr(npc.id), epoch);
  const out = [];
  const want = rng.weightedKey({ 0: 3, 1: 6, 2: 2 }) | 0;
  if (!want) return out;

  const tradeDef = TRADES[npc.trade] || TRADES.farmer;
  const weights = {
    retrieve: 8, deliver: 5, clear: 4, supply: 6, learn: 3,
    mend: 3, find_person: 2, witness: 2, settle: 2, escort: 2,
  };
  if (npc.values.craft > 0.6) { weights.supply += 4; weights.mend += 3; }
  if (npc.values.safety > 0.6) { weights.clear += 4; }
  if (npc.values.curiosity > 0.6) { weights.learn += 4; }
  if (npc.values.family > 0.6) { weights.find_person += 3; weights.deliver += 2; }
  if (npc.values.custom > 0.6) { weights.witness += 3; weights.settle += 2; }

  for (let i = 0; i < want; i++) {
    const kind = rng.weightedKey(weights);
    const need = buildNeed(W, rng, npc, kind, ctx, tradeDef, epoch, i);
    if (need) out.push(need);
  }
  return out;
}

/** Which reasons a need kind can honestly draw on (GDD §13.3 table). */
const REASONS_FOR = {
  retrieve: ['craft', 'secret', 'family'],
  deliver: ['family', 'custom', 'craft'],
  escort: ['safety', 'family', 'craft'],
  clear: ['safety'],
  learn: ['curiosity', 'secret'],
  mend: ['craft', 'custom'],
  find_person: ['family', 'safety'],
  supply: ['craft', 'safety'],
  witness: ['custom', 'family'],
  settle: ['family', 'custom'],
};

function pickReason(rng, npc, ctx, kind) {
  const allowed = REASONS_FOR[kind] || ['craft'];
  // among the reasons this kind of need can have, take the one they care most about
  const best = allowed.slice().sort((a, b) => (npc.values[b] || 0) - (npc.values[a] || 0));
  const key = rng.chance(0.75) ? best[0] : rng.pick(allowed);
  const bank = NEED_REASONS[key] || NEED_REASONS.craft;
  return rng.pick(bank).replace('{festival}', ctx.festival || 'the festival');
}

function buildNeed(W, rng, npc, kind, ctx, tradeDef, epoch, k) {
  const id = `${npc.id}#${epoch}:${k}`;
  const base = {
    id, npcId: npc.id, kind, urgency: +rng.float(0.2, 1).toFixed(2),
    beneficiary: npc.id, reason: pickReason(rng, npc, ctx, kind),
    blockedBy: null, expiresTick: null, epoch,
  };

  switch (kind) {
    case 'retrieve': {
      // The object must be somewhere real: a Hollow we know, at a depth.
      const h = ctx.hollows.length ? rng.pick(ctx.hollows) : null;
      if (!h) return null;
      const RETRIEVABLE = ['loom_weights', 'river_clay', 'name_shard', 'bell_cap', 'repair_kit', 'wool', 'salt', 'moon_cap'];
      const pool = tradeDef.wants.filter(k => BASE_ITEMS[k] && BASE_ITEMS[k].kind !== 'food').concat(RETRIEVABLE);
      const itemKey = rng.pick(pool);
      if (!BASE_ITEMS[itemKey]) return null;
      const depth = Math.max(1, Math.min(h.depth, rng.int(1, 2)));
      return { ...base, object: { item: itemKey }, where: { hollow: h.id, depth }, placeName: h.name };
    }
    case 'deliver': {
      const rel = npc.relationships.filter(r => ctx.roster.some(o => o.id === r.to && o.state === 'alive'));
      const to = rel.length ? rng.pick(rel).to : null;
      if (!to) return null;
      const other = ctx.roster.find(o => o.id === to);
      const itemKey = rng.pick(tradeDef.gives);
      if (!BASE_ITEMS[itemKey]) return null;
      return { ...base, object: { item: itemKey }, recipient: to, where: { npc: to }, placeName: other.shortName };
    }
    case 'clear': {
      const h = ctx.hollows.length ? rng.pick(ctx.hollows) : null;
      if (!h) return null;
      const pool = Object.keys(MONSTERS).filter(m =>
        MONSTERS[m].hostile && MONSTERS[m].family !== 'warden' && MONSTERS[m].tier <= Math.max(1, ctx.tier + 1));
      if (!pool.length) return null;
      const archetype = rng.pick(pool);
      return { ...base, object: { monster: archetype }, count: rng.int(2, 4), where: { hollow: h.id, depth: 1 }, placeName: h.name };
    }
    case 'supply': {
      const itemKey = rng.pick(tradeDef.wants.concat(ctx.forage.length ? ctx.forage : ['nettle']));
      if (!BASE_ITEMS[itemKey]) return null;
      return { ...base, object: { item: itemKey }, count: rng.int(2, 4), where: { settlement: npc.settlementId }, placeName: ctx.settlementName };
    }
    case 'learn': {
      const others = ctx.roster.filter(o => o.id !== npc.id && o.state === 'alive' && o.secret);
      if (!others.length) return null;
      const holder = rng.pick(others);
      return { ...base, object: { fact: holder.id }, where: { npc: holder.id }, placeName: holder.shortName };
    }
    case 'mend': {
      if (!ctx.mendables.length) return null;
      const prop = rng.pick(ctx.mendables);
      const material = rng.pick(['firewood', 'river_clay', 'wool']);
      return { ...base, object: { prop: prop.id, propKind: prop.kind }, material, count: rng.int(2, 3), where: { prop: prop.id }, placeName: prop.name };
    }
    case 'find_person': {
      const others = ctx.roster.filter(o => o.id !== npc.id && o.state === 'alive');
      if (!others.length || !ctx.hollows.length) return null;
      const who = rng.pick(others);
      const h = rng.pick(ctx.hollows);
      return { ...base, object: { npc: who.id }, where: { hollow: h.id, depth: 1 }, placeName: h.name };
    }
    case 'witness': {
      return { ...base, object: { place: ctx.plaza }, where: { settlement: npc.settlementId }, placeName: ctx.settlementName,
        expiresTick: null, duration: 20 };
    }
    case 'settle': {
      const rivals = npc.relationships.filter(r => r.kind === 'rival' || r.kind === 'owes');
      if (rivals.length < 1) return null;
      const a = rng.pick(rivals).to;
      const others = ctx.roster.filter(o => o.id !== npc.id && o.id !== a && o.state === 'alive');
      if (!others.length) return null;
      const b = rng.pick(others).id;
      return { ...base, object: { dispute: [a, b] }, where: { npc: a }, placeName: ctx.settlementName };
    }
    case 'escort': {
      const others = ctx.roster.filter(o => o.id !== npc.id && o.state === 'alive');
      const dest = ctx.neighbourSettlements.length ? rng.pick(ctx.neighbourSettlements) : null;
      if (!others.length || !dest) return null;
      if (Math.hypot(dest.x - ctx.x, dest.y - ctx.y) > 120) return null;
      return { ...base, object: { npc: rng.pick(others).id }, where: { settlement: dest.id }, placeName: dest.name };
    }
    default: return null;
  }
}
