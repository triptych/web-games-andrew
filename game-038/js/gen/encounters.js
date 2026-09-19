// ============================================================
// gen/encounters.js - what you meet, and where (GDD 12)
// Encounters are generated fresh each time (so a region never runs out) but
// the *tables* come from the seed, so a save is consistent about which
// lineages a place has.
// ============================================================
import { makeDragon, statsOf, fullHeal } from './dragon.js';
import { LINEAGES, LINEAGE_IDS, lineage } from '../data/lineages.js';
import { NODES, REGIONS, node as nodeOf, region as regionOf, levelBand, FORAGE } from '../data/world.js';
import { ENCOUNTER, XP } from '../data/constants.js';
import { BOSSES } from '../data/bosses.js';
import { championName } from '../data/names.js';
import { clamp } from '../core/util.js';

/** Which lineages live at a node: region elements first, plus a local oddity. */
export function encounterTable(nodeId, seedRng) {
  const n = nodeOf(nodeId);
  const r = regionOf(n.region);
  const local = LINEAGE_IDS.filter(id => {
    const lin = LINEAGES[id];
    return r.elements.includes(lin.elements[0]) || (lin.altSecondary || []).some(e => r.elements.includes(e));
  });
  const table = local.length ? local.slice() : ['cinderling'];
  // Every place keeps one visitor from outside, so the world is not tidy.
  const outsider = seedRng.pick(LINEAGE_IDS.filter(id => !table.includes(id)));
  if (outsider) table.push(outsider);
  return table;
}

/** Weight rarer lineages down, and feral ones up in the ash-heavy regions. */
function weightsFor(table, regionId) {
  return table.map(id => {
    const lin = LINEAGES[id];
    let w = 12 - lin.rarity * 2;
    if (lin.feral) w *= (regionId === 'cinder' || regionId === 'spire') ? 1.6 : 0.7;
    return Math.max(1, w);
  });
}

/**
 * Roll a wild encounter at a node.
 * `partyLevel` pulls the band toward the player so the world stays relevant.
 */
export function rollEncounter(nodeId, partyLevel, rng, seedRng, act = 1, opts = {}) {
  const n = nodeOf(nodeId);
  const band = levelBand(nodeId);
  const table = encounterTable(nodeId, seedRng);
  const weights = weightsFor(table, n.region);

  // Never send three at a lone hatchling. The world scales to the brood you
  // actually have, not the brood you are supposed to have by now.
  const partySize = Math.max(1, opts.partySize || 3);
  const size = Math.min(Number(rng.weightedKey(ENCOUNTER.groupWeights)), partySize + (partySize >= 3 ? 1 : 0));
  const ashChance = ENCOUNTER.ashboundChance[REGIONS[n.region].act] ?? 0.2;
  const champion = rng.chance(ENCOUNTER.championChance);

  const enemies = [];
  for (let i = 0; i < size; i++) {
    const lineageId = rng.weighted(table, weights);
    const level = clamp(
      Math.round(rng.int(band[0], band[1]) * 0.6 + partyLevel * 0.4),
      1, XP.maxLevel);
    const ashbound = LINEAGES[lineageId].feral || rng.chance(ashChance);
    const d = makeDragon(rng, { lineageId, level, wild: true, ashbound, essenceQuality: act - 1 });
    enemies.push(d);
  }

  if (champion && enemies.length) {
    const c = enemies[0];
    c.level = clamp(c.level + ENCOUNTER.championMult.level, 1, XP.maxLevel);
    c.name = championName(rng, c.elements[0]);
    c.champion = true;
    for (const s of ['hp', 'atk']) c.essence[s] = Math.min(15, (c.essence[s] || 0) + 4);
    c.genes.size = clamp(c.genes.size * 1.12, 0.78, 1.32);
    fullHeal(c);
  }

  for (const e of enemies) fullHeal(e);
  return {
    kind: champion ? 'champion' : 'wild',
    enemies,
    node: nodeId,
    underground: n.kind === 'roost' || n.kind === 'spire',
    intro: introFor(n, enemies, champion),
  };
}

function introFor(n, enemies, champion) {
  if (champion) return `Something bigger than it should be steps out of the ${n.kind === 'roost' ? 'dark' : 'scrub'}.`;
  if (enemies.length === 1) {
    const e = enemies[0];
    return e.ashbound
      ? `A grey thing lifts its head. It does not know what it is looking at.`
      : `A ${lineage(e.lineageId).name.toLowerCase()} comes out of the ${n.kind === 'wild' ? 'long grass' : 'shadow'}, and stops.`;
  }
  return `${enemies.length} of them, and they have seen you.`;
}

/** Build an act boss as a live dragon. */
export function makeBoss(bossId, rng) {
  const def = BOSSES[bossId];
  if (!def) return null;
  const d = makeDragon(rng, {
    lineageId: def.lineageId, level: def.level, element: def.elements[0], secondary: def.elements[1],
    essence: { ...def.essence }, traits: [...def.traits], moves: [...def.moves],
    name: def.name, ashbound: !!def.ashbound, boss: true, bond: 0, wild: true,
  });
  d.genes = { ...d.genes, ...def.genes };
  d.boss = true;
  d.bossId = bossId;
  d.title = def.title;
  d.bindable = def.bindable !== false;
  d.stage = def.level >= 45 ? 'elder' : def.level >= 28 ? 'wyrm' : 'drake';
  d.moves = [...def.moves];          // set after the stage, which sizes the belt
  // Bosses carry a deeper pool than their level implies; that is the fight.
  d.hpMult = def.hpMult || 2;
  fullHeal(d);
  return d;
}

/** A roost is a short run: 3-5 encounters, a chest, and something at the end. */
export function buildRoost(nodeId, partyLevel, rng, seedRng, act, opts = {}) {
  const n = nodeOf(nodeId);
  const depth = n.depth || 3;
  const rooms = [];
  for (let i = 0; i < depth; i++) {
    const last = i === depth - 1;
    if (last && n.boss) {
      rooms.push({ kind: 'boss', bossId: n.boss });
    } else if (last) {
      const enc = rollEncounter(nodeId, partyLevel + 2, rng, seedRng, act, opts);
      enc.enemies.forEach(e => { e.level = Math.min(XP.maxLevel, e.level + 2); fullHeal(e); });
      rooms.push({ kind: 'battle', encounter: enc, elite: true });
    } else if (rng.chance(0.25)) {
      rooms.push({ kind: 'treasure' });
    } else {
      rooms.push({ kind: 'battle', encounter: rollEncounter(nodeId, partyLevel, rng, seedRng, act, opts) });
    }
  }
  return { nodeId, rooms, index: 0, name: n.name };
}

/** Foraging: what the ground at this node gives up. */
export function forage(nodeId, rng, luck = 0) {
  const n = nodeOf(nodeId);
  const table = FORAGE[n.region] || FORAGE.vale;
  const count = rng.chance(0.25 + luck * 0.1) ? 2 : 1;
  const found = [];
  for (let i = 0; i < count; i++) found.push(rng.pick(table));
  return found;
}
