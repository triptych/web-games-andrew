// ============================================================
// gen/longthread.js - the world-level plot (GDD §14.5)
// Fixed skeleton, generated contents, derived at world creation so the world
// is consistent from the first minute.
// ============================================================
import { deriveRNG } from '../core/rand.js';
import { DOMAINS } from '../data/constants.js';
import { LEDGER_TEXTS } from '../data/text.js';
import { bossName } from './name.js';

export const LONG_STATES = Object.freeze(['notice', 'ledger', 'wrong_year', 'walk', 'the_one', 'choice', 'done']);

/**
 * @pure Pick the forgotten settlement, the deepest Hollow, and the person at
 * the bottom of it. All of it exists from the first minute; the player just
 * has not been told yet.
 */
export function generateLongThread(W) {
  const rng = deriveRNG(W.master, DOMAINS.LONGTHREAD, W.attempt || 0);
  const regions = [...W.regions.values()];
  const hollows = [...W.hollows.values()];
  if (!hollows.length) return null;

  // The forgotten settlement: a ruin in a drowned or high-Quiet region.
  const candidates = regions.filter(r => r.kind === 'drowned' || r.quietBase > 0.35);
  const forgottenRegion = candidates.length ? rng.pick(candidates) : rng.pick(regions);

  // The deepest Hollow, always in the highest-tier region, and visible from the
  // start - the player will have walked past it.
  const deepest = hollows.slice().sort((a, b) =>
    (b.tier * 10 + b.depth) - (a.tier * 10 + a.depth) || (a.id < b.id ? -1 : 1))[0];
  deepest.depth = Math.max(deepest.depth, rng.int(8, 10));
  deepest.isLongThread = true;
  deepest.boss = {
    archetype: 'the_one_who_stayed',
    name: bossName(rng, forgottenRegion.culture, false),
    level: deepest.tier * 2 + deepest.depth + 5,
    arena: 'pillared',
  };
  deepest.prize = { kind: 'ending', value: 'choice' };

  const keeperRegion = W.regions.get(W.startRegionId);

  return {
    state: 'notice', fragmentsFound: [], factsKnown: [],
    forgottenRegionId: forgottenRegion.id,
    forgottenName: forgottenRegion.name,
    forgottenWhy: rng.pick([
      'to keep a sickness from crossing the water',
      'to stop a thing following them home',
      'because a war was walking up the valley and would have taken the children',
      'because one harvest failed and the next one would have too',
    ]),
    hollowId: deepest.id, hollowName: deepest.name,
    bossName: deepest.boss.name,
    keeperRegionId: keeperRegion ? keeperRegion.id : regions[0].id,
    fragments: LEDGER_TEXTS.map((text, i) => ({ i, text, found: false })),
    facts: [
      'The lantern rounds were a job, with a rota and a wage.',
      `${forgottenRegion.name} is on the old road-lists and on no map since.`,
      'Somebody bought a great deal of oil, for eleven years, and then none.',
      'The Quiet did not arrive. It was asked for.',
    ],
    endings: {
      remember: 'The Quiet lifts. The forgotten place comes back as ruins, with graves, and names on them. Some people would rather it had not.',
      let_be: 'The Quiet stops where it is. The erased stay erased. The country is lighter, and smaller, and nobody has to grieve.',
    },
    chosen: null,
  };
}
