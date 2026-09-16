// ============================================================
// gen/hollow/identity.js - a Hollow's permanent half (GDD §12.1-12.3)
// The identity never changes for a seed. The body regenerates every descent.
// PURE.
// ============================================================
import { deriveRNG, hashStr } from '../../core/rand.js';
import { hollowId } from '../../core/ids.js';
import { clamp } from '../../core/util.js';
import { DOMAINS, REGION_CELL, WORLD_W, WORLD_H, SHORE, HILL } from '../../data/constants.js';
import { THEMES, THEME_KEYS } from '../../data/themes.js';
import { MONSTERS } from '../../data/monsters.js';
import { elevationAt, slopeAt, regionAt, biomeAt, riverAt } from '../fields.js';
import { expandHollow, bossName } from '../name.js';

/** The six Key Capabilities (GDD §18.2). */
export const CAPABILITIES = Object.freeze(['ember_jar', 'grapple_vine', 'bell', 'spade', 'green_flame', 'boat_whistle']);

export const CAPABILITY_INFO = Object.freeze({
  ember_jar: { name: 'Ember-jar', gate: 'cracked walls and sealed doors', icon: '◆' },
  grapple_vine: { name: 'Grapple-vine', gate: 'wide water and high ledges', icon: '⌇' },
  bell: { name: 'Bell', gate: 'warded doors', icon: 'Ω' },
  spade: { name: 'Spade', gate: 'buried caches and soft ground', icon: '⚒' },
  green_flame: { name: 'Green Flame', gate: 'Quiet veils', icon: '✳' },
  boat_whistle: { name: 'Boat-whistle', gate: 'deep water and islets', icon: '⚓' },
});

/** @pure Score a Hollow-mouth site: hillsides, rock, near-but-not-too-near. */
function scoreMouth(W, x, y, settlements) {
  const e = elevationAt(W, x, y);
  if (e < SHORE + 0.02 || e > 0.92) return -Infinity;
  if (riverAt(W, x, y) > 0.3) return -Infinity;
  let s = slopeAt(W, x, y) * 60;                      // hillsides
  const b = biomeAt(W, x, y);
  if (b === 'crag' || b === 'peak' || b === 'upland') s += 2.5;
  if (b === 'deepwood' || b === 'cloudforest') s += 1.5;
  if (b === 'fen') s += 1.0;
  let near = Infinity;
  for (const st of settlements) near = Math.min(near, Math.hypot(st.x - x, st.y - y));
  if (near >= 25 && near <= 120) s += 3.0;
  else if (near < 25) s -= 4.0;
  else if (near > 240) s -= 1.5;
  return s;
}

/**
 * @pure Place a region's Hollow mouths and derive each one's identity.
 * `prizePlan` is assigned later by the gate solver; every Hollow starts with
 * a provisional prize so the world is consistent from the first minute.
 */
export function generateHollows(W, region, settlements, usedNames, placeNames) {
  const rng = deriveRNG(W.master, DOMAINS.HOLLOW_SITE, region.rx, region.ry, W.attempt || 0);
  const count = region.kind === 'settled' ? rng.int(1, 3) : region.kind === 'drowned' ? rng.int(0, 1) : rng.int(1, 2);
  if (count === 0) return [];

  // candidate lattice inside the region
  const x0 = region.rx * REGION_CELL, y0 = region.ry * REGION_CELL;
  const step = Math.floor(REGION_CELL / 14);
  const cands = [];
  for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++) {
    const x = clamp(x0 + i * step + rng.int(-3, 3), 3, WORLD_W - 4);
    const y = clamp(y0 + j * step + rng.int(-3, 3), 3, WORLD_H - 4);
    if (regionAt(W, x, y) !== region.id) continue;
    cands.push([x, y]);
  }
  if (!cands.length) return [];

  const chosen = [];
  for (let k = 0; k < count; k++) {
    let best = null, bestScore = -Infinity;
    for (const [x, y] of cands) {
      let sc = scoreMouth(W, x, y, settlements);
      for (const c of chosen) if (Math.hypot(c.mouth.x - x, c.mouth.y - y) < 60) sc -= 10;
      sc += rng.float(0, 0.6);
      if (sc > bestScore) { bestScore = sc; best = [x, y]; }
    }
    if (!best || bestScore <= -Infinity) break;
    chosen.push(makeIdentity(W, region, k, { x: best[0], y: best[1] }, usedNames, placeNames));
  }
  return chosen;
}

/** @pure The identity record (GDD §12.2). */
function makeIdentity(W, region, k, mouth, usedNames, placeNames) {
  const id = hollowId(region.rx, region.ry, k);
  const rng = deriveRNG(W.master, DOMAINS.HOLLOW_IDENTITY, region.rx, region.ry, k);

  // theme, biased by the region's dominant biome
  const bias = { ...Object.fromEntries(THEME_KEYS.map(t => [t, 3])) };
  const b = region.dominantBiome;
  if (b === 'fen') { bias.flooded_mill += 6; bias.saltworks += 3; }
  if (b === 'deepwood' || b === 'wood' || b === 'cloudforest') { bias.hollow_root += 6; bias.beast_warren += 4; }
  if (b === 'crag' || b === 'peak' || b === 'upland' || b === 'snowfield') { bias.stonewake_vault += 6; bias.starwell += 4; bias.barrow += 3; }
  if (b === 'shore') { bias.saltworks += 5; bias.sunken_chapel += 3; }
  if (b === 'orchardland') { bias.orchard_under += 6; bias.quiet_house += 3; }
  if (b === 'meadow' || b === 'heath') { bias.barrow += 4; bias.quiet_house += 3; }
  const theme = rng.weightedKey(bias);
  const T = THEMES[theme];

  const depth = clamp(2 + Math.floor(region.tier / 2) + rng.int(0, 2), 2, 10);
  const wardenKey = T.warden;
  const warden = MONSTERS[wardenKey];

  const litCondition = (theme === 'quiet_house' || theme === 'sunken_chapel') && rng.chance(0.35)
    ? 'silence'
    : rng.chance(0.30) ? 'lanterns' : 'boss';

  const name = expandHollow(rng, usedNames, placeNames);
  usedNames.add(name.toLowerCase());

  const lore = rng.sample(T.lore.slice(), Math.min(3, T.lore.length));

  return {
    id, regionId: region.id, rx: region.rx, ry: region.ry, k,
    mouth, name, theme, depth, tier: region.tier,
    boss: {
      archetype: wardenKey,
      name: bossName(rng, region.culture, rng.chance(0.25)),
      level: region.tier * 2 + depth + 3,
      arena: rng.pick(['pillared', 'flooded', 'plain', 'sconced']),
    },
    prize: { kind: 'gear', value: null },        // set by the gate solver
    litCondition, lore,
    entrancePrompt: rng.pick([
      'Cold air comes up the stair, smelling of wet stone.',
      'The steps are worn in the middle. People came here often, once.',
      'Something down there is not making a sound, on purpose.',
      'A draught, which means a way out, which means a way in.',
      'The name-plate is still legible. Barely.',
    ]),
    wardenName: warden ? warden.name : 'warden',
    // saved, mutable:
    descent: 0, lit: false, prizeTaken: false, discovered: false, deepest: 0,
  };
}
