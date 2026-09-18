// ============================================================
// gen/questgen.js - board quests (GDD 11)
// Generated per town per act from the world seed, so the same board shows
// the same three jobs across a reload. A generated quest is only offered if
// the world can actually satisfy it - the check happens here, not later.
// ============================================================
import { LINEAGES, LINEAGE_IDS } from '../data/lineages.js';
import { ELEMENTS, ELEMENT_IDS, elementName } from '../data/elements.js';
import { NODES, REGIONS, nodesInRegion, FORAGE, levelBand } from '../data/world.js';
import { ITEMS, byKind } from '../data/items.js';
import { championName, personName } from '../data/names.js';
import { ECONOMY } from '../data/constants.js';
import { encounterTable } from './encounters.js';
import { titleCase } from '../core/util.js';

const HUNT_TITLES = ['Thinning the {place}', 'Too Many by Half', 'A Problem in the {place}', 'Work at the {place}'];
const BIND_TITLES = ['Wanted, Alive', 'A Keeper for the {place}', 'One of Ours, Back'];
const FORAGE_TITLES = ['Gathering', 'Short of Supply', 'The Market Wants'];

/**
 * Three jobs for one town in one act. `seedRng` must be derived from the
 * world seed plus the node and act, so the board is stable.
 */
export function generateBoard(nodeId, act, partyLevel, seedRng) {
  const town = NODES[nodeId];
  if (!town) return [];
  const regionId = town.region;
  const localNodes = nodesInRegion(regionId).filter(id => NODES[id].kind === 'wild' || NODES[id].kind === 'roost');
  const out = [];
  const kinds = seedRng.shuffle(['hunt', 'bind', 'forage', 'hunt', 'champion']).slice(0, 3);

  for (let i = 0; i < kinds.length; i++) {
    const q = buildQuest(kinds[i], { nodeId, regionId, act, partyLevel, localNodes, seedRng, index: i });
    if (q) out.push(q);
  }
  return out;
}

function buildQuest(kind, ctx) {
  const { nodeId, regionId, act, partyLevel, localNodes, seedRng, index } = ctx;
  const where = localNodes.length ? seedRng.pick(localNodes) : nodeId;
  const place = NODES[where].name;
  const reward = Math.round(ECONOMY.boardRewardBase * act * seedRng.float(0.85, 1.35));
  const id = `b_${nodeId}_${act}_${index}`;
  const giver = personName(seedRng);

  // Only ask for what this region's own encounter table can provide. The
  // table carries one visitor from outside; hunting six of a lineage that
  // turns up once in twenty encounters is a grind, not a quest, so the
  // count-based goals draw from the region's declared elements only.
  const table = encounterTable(where, seedRng);
  const tableElements = new Set(table.map(l => LINEAGES[l].elements[0]));
  const elementsHere = (REGIONS[regionId].elements || []).filter(e => tableElements.has(e));
  if (!elementsHere.length) elementsHere.push(...tableElements);

  if (kind === 'hunt') {
    const element = seedRng.pick(elementsHere);
    const count = seedRng.int(3, 6);
    return {
      id, kind: 'board', type: 'hunt', node: nodeId, act, giver,
      title: seedRng.pick(HUNT_TITLES).replace('{place}', place.replace(/^The /, '')),
      detail: `${giver} wants ${count} ${elementName(element)}-blooded dragons cleared out of ${place}.`,
      goal: { kind: 'defeat', count, element },
      reward: { coin: reward, items: rollRewardItems(act, seedRng) },
      done: `“That's the count. Good work, Warden.”`,
    };
  }

  if (kind === 'bind') {
    const common = table.filter(l => !LINEAGES[l].feral && LINEAGES[l].rarity <= 3);
    const lineageId = seedRng.pick(common.length ? common : table);
    return {
      id, kind: 'board', type: 'bind', node: nodeId, act, giver,
      title: seedRng.pick(BIND_TITLES).replace('{place}', place.replace(/^The /, '')),
      detail: `${giver} will pay for a live ${LINEAGES[lineageId].name} out of ${place} — bound, not killed.`,
      goal: { kind: 'capture', count: 1, lineage: lineageId },
      reward: { coin: Math.round(reward * 1.4), items: rollRewardItems(act, seedRng, 'binding') },
      done: `“Alive, and in one piece. That's the hard way and you did it.”`,
    };
  }

  if (kind === 'forage') {
    const pool = (FORAGE[regionId] || FORAGE.vale).filter(i => ITEMS[i] && ITEMS[i].kind === 'material');
    const wanted = pool.length ? seedRng.pick(pool) : 'scale_shard';
    const count = seedRng.int(3, 6);
    return {
      id, kind: 'board', type: 'forage', node: nodeId, act, giver,
      title: seedRng.pick(FORAGE_TITLES),
      detail: `${giver} needs ${count} × ${ITEMS[wanted].name}. They are turning up around ${place}.`,
      goal: { kind: 'item', items: { [wanted]: count } },
      consumes: true,
      reward: { coin: Math.round(reward * 0.8), items: rollRewardItems(act, seedRng) },
      done: `“That'll do nicely. Same again next month, if you're passing.”`,
    };
  }

  if (kind === 'champion') {
    const lineageId = seedRng.pick(table);
    const element = LINEAGES[lineageId].elements[0];
    const name = championName(seedRng, element);
    const band = levelBand(where);
    return {
      id, kind: 'board', type: 'champion', node: nodeId, act, giver,
      title: `The One They Call ${name.split(' ')[0]}`,
      detail: `${name}, ${article(LINEAGES[lineageId].name)} out of ${place}, has been driving everything else off. ${giver} wants it gone.`,
      goal: { kind: 'champion', championId: id, count: 1 },
      champion: { name, lineageId, level: Math.max(band[1], Math.round(partyLevel + 2)), node: where },
      reward: { coin: Math.round(reward * 1.8), items: rollRewardItems(act, seedRng, 'relic') },
      done: `“Heard it went down hard. Coin's yours.”`,
    };
  }
  return null;
}

/** "a Ridgeback" / "an Ashbound" - generated text has to read as English. */
const article = name => (/^[AEIOU]/i.test(name) ? 'an ' : 'a ') + name;

function rollRewardItems(act, rng, prefer = null) {
  const pools = {
    1: ['ember_salve', 'ley_tonic', 'rune_cord', 'hearth_bread', 'ashwash'],
    2: ['greater_salve', 'bind_chain', 'salt_cod', 'frostroot', 'warmth_stone'],
    3: ['greater_salve', 'sigil_snare', 'clearwater', 'deep_ley', 'ember_root'],
    4: ['wardens_salve', 'soulglass', 'panacea', 'windfeather', 'memory_stone'],
    5: ['full_salve', 'hearth_ember', 'line_draught', 'prism_dust', 'brood_ledger'],
  };
  const pool = pools[Math.min(5, act)] || pools[1];
  const items = [rng.pick(pool)];
  if (prefer) {
    const extra = byKind(prefer).filter(id => ITEMS[id].rarity <= act + 1);
    if (extra.length) items.push(rng.pick(extra));
  }
  if (rng.chance(0.4)) items.push(rng.pick(pool));
  return items;
}
