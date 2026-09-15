// ============================================================
// gen/quest.js - the quest grammar and its validation gate (GDD §14.2-14.6)
// A quest is never emitted unless every beat's target resolves.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { questId } from '../core/ids.js';
import { DOMAINS } from '../data/constants.js';
import { BASE_ITEMS } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';

const REWARD_BANDS = [[15, 40], [30, 70], [60, 120], [100, 200], [160, 320], [240, 480], [300, 600]];

const beat = (kind, target, hint, extra = {}) => ({ kind, target, hint, count: 1, optional: false, done: false, ...extra });

/**
 * @pure Turn a need into a quest. Returns null if the validation gate rejects it.
 * `ctx` is the same world context the need was built from.
 */
export function buildQuest(W, need, npc, ctx) {
  const id = questId(npc.id, need.epoch + ':' + need.kind);
  const rng = deriveRNG(W.master, DOMAINS.QUEST_BUILD, hashStr(id));
  const tier = ctx.tier || 0;

  const q = {
    id, scale: 'errand', giver: npc.id, needId: need.id,
    title: '', summary: '', beats: [], current: 0, state: 'offered',
    rewards: [], failConditions: [], tags: [ctx.regionBiome, npc.trade, 'tier' + tier],
    where: need.where, placeName: need.placeName,
  };

  const objName = itemName(need.object);
  const place = need.placeName || 'somewhere';

  switch (need.kind) {
    case 'retrieve': {
      const guard = rng.chance(0.45);
      q.title = `${npc.shortName}'s ${objName}`;
      q.summary = `${cap(objName)}, lost in ${place}. ${need.reason}`;
      q.beats.push(beat('goto', { hollow: need.where.hollow, depth: need.where.depth }, `Down into ${place}.`));
      if (guard) q.beats.push(beat('kill', { monster: pickGuard(rng, tier), where: need.where.hollow }, 'Something is on it.'));
      q.beats.push(beat('get', { item: need.object.item }, `${cap(objName)} is on that floor.`));
      q.beats.push(beat('give', { npc: npc.id }, `Back to ${npc.shortName}.`));
      break;
    }
    case 'deliver': {
      const other = ctx.roster.find(o => o.id === need.recipient);
      if (!other) return null;
      q.title = `${objName} for ${other.shortName}`;
      q.summary = `Take ${objName} to ${other.shortName}, in ${ctx.settlementName}. ${need.reason}`;
      q.beats.push(beat('get', { item: need.object.item, from: npc.id }, `${npc.shortName} hands it over.`));
      q.beats.push(beat('give', { npc: other.id }, `${other.shortName} is expecting it.`));
      if (rng.chance(0.30)) q.beats.push(beat('talk', { npc: npc.id }, 'Tell them it is done.'));
      break;
    }
    case 'clear': {
      const mk = need.object.monster;
      if (!MONSTERS[mk]) return null;
      q.title = `The ${MONSTERS[mk].name} in ${place}`;
      q.summary = `${cap(MONSTERS[mk].name)} in ${place}, and too many of them. ${need.reason}`;
      q.beats.push(beat('goto', { hollow: need.where.hollow, depth: 1 }, `Into ${place}.`));
      q.beats.push(beat('kill', { monster: mk, where: need.where.hollow }, `${need.count} of them.`, { count: need.count }));
      q.beats.push(beat('talk', { npc: npc.id }, `Tell ${npc.shortName}.`));
      break;
    }
    case 'supply': {
      q.title = `${cap(objName)} for ${npc.shortName}`;
      q.summary = `${need.count} ${objName}, for ${npc.shortName} in ${ctx.settlementName}. ${need.reason}`;
      q.beats.push(beat('get', { item: need.object.item }, `Forage or buy ${objName}.`, { count: need.count }));
      q.beats.push(beat('give', { npc: npc.id }, `${npc.shortName} will take them.`));
      break;
    }
    case 'learn': {
      const holder = ctx.roster.find(o => o.id === need.object.fact);
      if (!holder) return null;
      q.title = `What ${holder.shortName} knows`;
      q.summary = `${npc.shortName} wants to know what ${holder.shortName} is not saying. ${need.reason}`;
      q.beats.push(beat('talk', { npc: holder.id }, `${holder.shortName}, in ${ctx.settlementName}.`));
      q.beats.push(beat('talk', { npc: npc.id }, `Take it back to ${npc.shortName}.`));
      break;
    }
    case 'mend': {
      q.title = `The ${need.object.propKind}`;
      q.summary = `${cap(need.object.propKind)} in ${ctx.settlementName} wants mending. ${need.reason}`;
      q.beats.push(beat('get', { item: need.material }, `${need.count} ${itemName({ item: need.material })}.`, { count: need.count }));
      q.beats.push(beat('use', { prop: need.object.prop }, `Mend the ${need.object.propKind}.`));
      q.beats.push(beat('talk', { npc: npc.id }, `Tell ${npc.shortName}.`));
      break;
    }
    case 'find_person': {
      const who = ctx.roster.find(o => o.id === need.object.npc);
      if (!who) return null;
      q.title = `Where ${who.shortName} went`;
      q.summary = `${who.shortName} has not come back from ${place}. ${need.reason}`;
      q.beats.push(beat('goto', { hollow: need.where.hollow, depth: 1 }, `Into ${place}.`));
      q.beats.push(beat('talk', { npc: who.id }, `Find ${who.shortName}.`));
      q.beats.push(beat('escort', { npc: who.id, settlement: npc.settlementId }, `Walk them home.`));
      break;
    }
    case 'witness': {
      q.title = `Stand at the ${ctx.plazaName || 'hearth'}`;
      q.summary = `${npc.shortName} asks you to be at the hearth in ${ctx.settlementName}. ${need.reason}`;
      q.beats.push(beat('goto', { tile: ctx.plaza }, `The plaza in ${ctx.settlementName}.`));
      q.beats.push(beat('survive', { turns: need.duration || 20 }, 'Stay a while.', { count: need.duration || 20 }));
      q.beats.push(beat('talk', { npc: npc.id }, `Afterward, ${npc.shortName}.`));
      break;
    }
    case 'settle': {
      const [aId, bId] = need.object.dispute;
      const a = ctx.roster.find(o => o.id === aId), b = ctx.roster.find(o => o.id === bId);
      if (!a || !b) return null;
      q.title = `${a.shortName} and ${b.shortName}`;
      q.summary = `${a.shortName} and ${b.shortName} are not speaking. ${need.reason}`;
      q.beats.push(beat('talk', { npc: a.id }, `${a.shortName}'s side of it.`));
      q.beats.push(beat('talk', { npc: b.id }, `${b.shortName}'s side of it.`));
      q.beats.push(beat('choose', { options: [a.id, b.id, 'neither'] }, 'Decide, and say so.'));
      q.beats.push(beat('talk', { npc: npc.id }, `Tell ${npc.shortName} how it went.`));
      break;
    }
    case 'escort': {
      const who = ctx.roster.find(o => o.id === need.object.npc);
      if (!who) return null;
      q.title = `Walk ${who.shortName} to ${place}`;
      q.summary = `${who.shortName} will not go to ${place} alone. ${need.reason}`;
      q.beats.push(beat('talk', { npc: who.id }, `${who.shortName} is ready when you are.`));
      q.beats.push(beat('escort', { npc: who.id, settlement: need.where.settlement }, `${place}.`));
      q.beats.push(beat('talk', { npc: npc.id }, `Tell ${npc.shortName}.`));
      break;
    }
    default: return null;
  }

  // rewards
  const band = REWARD_BANDS[Math.min(REWARD_BANDS.length - 1, tier)];
  const coin = Math.round(rng.int(band[0], band[1]) * (0.7 + need.urgency * 0.6));
  q.rewards = [{ kind: 'coin', value: coin }, { kind: 'disposition', value: Math.round(15 * need.urgency) }];
  if (rng.chance(0.35)) q.rewards.push({ kind: 'item', ilvl: tier * 2 + 2 });
  if (rng.chance(0.25)) q.rewards.push({ kind: 'item', key: rng.pick(['oil_flask', 'bandage', 'pottage']) });
  q.rewards.push({ kind: 'xp', value: 20 + tier * 25 + q.beats.length * 6 });

  return validateQuest(q, ctx) ? q : null;
}

function pickGuard(rng, tier) {
  const pool = Object.keys(MONSTERS).filter(m => MONSTERS[m].hostile && MONSTERS[m].family !== 'warden' && MONSTERS[m].tier <= tier + 1);
  return pool.length ? rng.pick(pool) : 'rat_swarm';
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function itemName(object) {
  if (!object) return 'something';
  if (object.item) return (BASE_ITEMS[object.item] && BASE_ITEMS[object.item].name) || object.item;
  if (object.monster) return (MONSTERS[object.monster] && MONSTERS[object.monster].name) || object.monster;
  return 'something';
}

/** The validation gate Q1-Q7 (GDD §14.6). Failures discard, never fake. */
export function validateQuest(q, ctx) {
  if (!q.beats.length) return false;                                          // Q1
  for (const b of q.beats) {
    const t = b.target;
    if (!t) return false;
    if (t.npc) {
      const n = ctx.roster.find(o => o.id === t.npc);
      if (!n || n.state !== 'alive') return false;                            // Q2
    }
    if (t.item && !BASE_ITEMS[t.item]) return false;
    if (t.monster && !MONSTERS[t.monster]) return false;
    if (t.hollow && !ctx.hollows.some(h => h.id === t.hollow)) return false;
  }
  if (q.summary.length > 140) q.summary = q.summary.slice(0, 137) + '...';     // Q6
  if (q.title.length > 40) q.title = q.title.slice(0, 40);
  if (!q.rewards.length) return false;                                        // Q7
  return true;
}
