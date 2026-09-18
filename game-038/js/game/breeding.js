// ============================================================
// game/breeding.js - the Broodwell (GDD 9)
// An egg is a complete genome plus a countdown; hatching only wraps it in
// a dragon. Doing it this way means the egg's shell can be drawn from the
// child's real colours, and a save never holds a half-built animal.
// ============================================================
import { makeDragon, canBreed, movesAtLevel, statsOf, fullHeal } from '../gen/dragon.js';
import { lineage, LINEAGES, ELDER_LINEAGES } from '../data/lineages.js';
import { fusionOf, ELEMENT_IDS } from '../data/elements.js';
import { BREED, ESSENCE_CAP, TEMPERAMENT_IDS, STATS } from '../data/constants.js';
import { dragonName } from '../data/names.js';
import { traitValue, hasTrait } from '../gen/dragon.js';
import { clamp, uid } from '../core/util.js';
import { TRAITS, ROLLABLE_TRAITS } from '../data/traits.js';

const VISUAL_GENES = ['body', 'wings', 'horns', 'tail', 'crest', 'pattern'];
const GENE_POOLS = {
  body: ['serpent', 'drake', 'wyvern', 'quad', 'amphithere'],
  wings: ['membrane', 'feathered', 'finned', 'twin', 'vestigial'],
  horns: ['crown', 'swept', 'spiral', 'antler', 'none'],
  tail: ['spade', 'fan', 'spikes', 'whip', 'club'],
  crest: ['none', 'frill', 'mane', 'sail', 'plates'],
  pattern: ['plain', 'banded', 'spotted', 'mottled', 'gradient', 'veined'],
};

/**
 * Pair two dragons. `modifiers` are consumed breeding items:
 * { forceLineage, mutate, perfectEssence, forceThrowback, warmth }
 */
export function breed(a, b, rng, modifiers = {}) {
  const check = canBreed(a, b);
  if (!check.ok) return { ok: false, why: check.why };

  // The kindler is "A" for inheritance, so the rules read the same way round
  // however the player filled the two slots.
  const [pa, pb] = a.broodRole === 'kindler' ? [a, b] : [b, a];
  const mutateChance = (1 - BREED.geneParentChance * 2) * (modifiers.mutate || 1);
  const notes = [];

  // --- visual genes ----------------------------------------------------
  const genes = {};
  for (const key of VISUAL_GENES) {
    const roll = rng.next();
    if (roll < BREED.geneParentChance) genes[key] = pa.genes[key];
    else if (roll < BREED.geneParentChance * 2) genes[key] = pb.genes[key];
    else { genes[key] = rng.pick(GENE_POOLS[key]); notes.push(`${key}: something neither parent had`); }
  }
  // Colour drifts around the parents' mean rather than jumping, so a family
  // stays recognisable down the generations.
  const meanHue = circularMean(pa.genes.hue, pb.genes.hue);
  genes.hue = rng.chance(mutateChance) ? rng.int(0, 359) : (meanHue + rng.int(-18, 18) + 360) % 360;
  genes.hue2 = rng.chance(0.5) ? pa.genes.hue2 : pb.genes.hue2;
  genes.sat = clamp((pa.genes.sat + pb.genes.sat) / 2 + rng.float(-0.08, 0.08), 0.2, 0.95);
  genes.light = clamp((pa.genes.light + pb.genes.light) / 2 + rng.float(-0.06, 0.06), 0.3, 0.7);
  genes.eye = rng.chance(0.5) ? pa.genes.eye : pb.genes.eye;
  genes.size = clamp((pa.genes.size + pb.genes.size) / 2 + rng.float(-0.1, 0.1), 0.78, 1.28);

  // --- lineage ---------------------------------------------------------
  let lineageId = modifiers.forceLineage
    ? (modifiers.forceLineage === 'b' ? pb.lineageId : pa.lineageId)
    : (rng.chance(BREED.lineageFromA) ? pa.lineageId : pb.lineageId);

  // Throwback: an elder line surfacing out of two ordinary animals. This is
  // the rare good thing the breeding loop exists to make possible.
  const near = elderNeighbour(pa.lineageId) || elderNeighbour(pb.lineageId);
  let throwback = false;
  if (near && (modifiers.forceThrowback || rng.chance(BREED.throwbackChance))) {
    lineageId = near; throwback = true;
    notes.push(`a throwback: the ${LINEAGES[near].name} line comes back up`);
  }
  const lin = lineage(lineageId);

  // --- elements --------------------------------------------------------
  const primary = rng.chance(BREED.primaryFromA) ? pa.elements[0] : pb.elements[0];
  let secondary = null;
  const fusion = fusionOf(pa.elements[0], pb.elements[0]);
  if (fusion && fusion !== primary && rng.chance(BREED.fusionChance)) {
    secondary = fusion;
    notes.push(`the two lines make something new: ${fusion}`);
  } else if (rng.chance(BREED.secondaryInherit)) {
    const pool = [pa.elements[1], pb.elements[1], pa.elements[0], pb.elements[0]].filter(e => e && e !== primary);
    if (pool.length) secondary = rng.pick(pool);
  }

  // --- essence ---------------------------------------------------------
  const essence = {};
  const best = modifiers.perfectEssence ? STATS.slice() : rng.sample(STATS, BREED.maxEssenceStats);
  for (const s of STATS) {
    if (best.includes(s)) essence[s] = Math.max(pa.essence[s] || 0, pb.essence[s] || 0);
    else {
      const avg = ((pa.essence[s] || 0) + (pb.essence[s] || 0)) / 2;
      essence[s] = clamp(Math.round(avg + rng.int(-BREED.essenceDrift, BREED.essenceDrift)), 0, ESSENCE_CAP);
    }
  }

  // --- moves: lineage basics plus up to two egg moves -------------------
  const base = movesAtLevel(lineageId, 1);
  const inheritable = [...new Set([...pa.moves, ...pb.moves])]
    .filter(m => !base.includes(m) && lin.learn.includes(m));
  const eggMoves = rng.sample(inheritable, BREED.eggMoves);
  if (eggMoves.length) notes.push(`carries ${eggMoves.length} move${eggMoves.length > 1 ? 's' : ''} from its parents`);

  // --- traits ----------------------------------------------------------
  const traits = [];
  const parentTraits = [...(pa.traits || []), ...(pb.traits || [])].filter(t => t !== 'hollowed');
  traits.push(rng.chance(0.7) && parentTraits.length ? rng.pick(parentTraits) : lin.trait);

  const generation = Math.max(pa.generation || 0, pb.generation || 0) + 1;

  // --- incubation ------------------------------------------------------
  let battles = BREED.incubateBattles;
  const speed = Math.min(traitValue(pa, 'incubateMult'), traitValue(pb, 'incubateMult'));
  battles = Math.max(BREED.incubateMin, Math.round(battles * speed) - (modifiers.warmth || 0));

  const egg = {
    id: uid('egg'),
    lineageId, elements: [primary, secondary], genes, essence, traits,
    moves: [...base, ...eggMoves],
    temperament: rng.pick(TEMPERAMENT_IDS),
    broodRole: rng.chance(0.5) ? 'kindler' : 'clutcher',
    generation,
    parents: [pa.name, pb.name],
    parentIds: [pa.id, pb.id],
    battlesLeft: battles,
    totalBattles: battles,
    throwback,
    notes,
    laidAt: Date.now(),
  };
  return { ok: true, egg };
}

/** Is this lineage one step from an elder line? Elders beget elders too. */
function elderNeighbour(lineageId) {
  if (ELDER_LINEAGES.includes(lineageId)) return lineageId;
  const lin = lineage(lineageId);
  const match = ELDER_LINEAGES.find(id => LINEAGES[id].elements[0] === lin.elements[0]);
  return match || null;
}

function circularMean(a, b) {
  const diff = ((b - a + 540) % 360) - 180;
  return Math.round((a + diff / 2 + 360) % 360);
}

/** Turn a ready egg into a level-1 dragon. */
export function hatch(egg, rng) {
  const d = makeDragon(rng, {
    lineageId: egg.lineageId,
    level: 1,
    element: egg.elements[0],
    secondary: egg.elements[1],
    essence: egg.essence,
    temperament: egg.temperament,
    traits: egg.traits,
    moves: egg.moves,
    generation: egg.generation,
    parents: egg.parents,
    broodRole: egg.broodRole,
    bond: 25,
    ashbound: false,
  });
  // The egg's genes are the child's genes; makeDragon rolled its own, so
  // overwrite them and let the sprite follow from what was actually inherited.
  d.genes = { ...egg.genes };
  d.name = egg.name || dragonName(rng, egg.elements[0]);
  fullHeal(d);
  return d;
}

/** A readable prediction for the pairing screen: no numbers the game hides. */
export function breedingPreview(a, b) {
  const check = canBreed(a, b);
  if (!check.ok) return { ok: false, why: check.why };
  const [pa, pb] = a.broodRole === 'kindler' ? [a, b] : [b, a];
  const fusion = fusionOf(pa.elements[0], pb.elements[0]);
  const near = elderNeighbour(pa.lineageId) || elderNeighbour(pb.lineageId);
  return {
    ok: true,
    lineages: [{ id: pa.lineageId, chance: BREED.lineageFromA }, { id: pb.lineageId, chance: 1 - BREED.lineageFromA }],
    primary: [{ el: pa.elements[0], chance: BREED.primaryFromA }, { el: pb.elements[0], chance: 1 - BREED.primaryFromA }],
    fusion: fusion || null,
    throwback: near && !ELDER_LINEAGES.includes(pa.lineageId) && !ELDER_LINEAGES.includes(pb.lineageId) ? near : null,
    generation: Math.max(pa.generation || 0, pb.generation || 0) + 1,
    incubation: Math.max(BREED.incubateMin, Math.round(BREED.incubateBattles * Math.min(traitValue(pa, 'incubateMult'), traitValue(pb, 'incubateMult')))),
  };
}
