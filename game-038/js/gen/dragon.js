// ============================================================
// gen/dragon.js - the genome (GDD 4)
// A dragon is plain data: it serialises as itself, and everything visible
// about it (sprite, stats, name) is derived from the genome, never stored
// twice. No DOM, no canvas, no globals - this module is headless-testable.
// ============================================================
import { RNG, hashStr } from '../core/rand.js';
import { LINEAGES, lineage } from '../data/lineages.js';
import { ELEMENT_IDS } from '../data/elements.js';
import { MOVES, move } from '../data/moves.js';
import { TRAITS, ROLLABLE_TRAITS } from '../data/traits.js';
import { dragonName } from '../data/names.js';
import { CURVE, STATS, STAGES, ESSENCE_CAP, MOVE_SLOTS, TEMPERAMENTS, TEMPERAMENT_IDS, XP, BOND_MAX, stageMult } from '../data/constants.js';
import { clamp } from '../core/util.js';

export const BODY_PLANS = ['serpent', 'drake', 'wyvern', 'quad', 'amphithere'];
export const WING_TYPES = ['membrane', 'feathered', 'finned', 'twin', 'vestigial'];
export const HORN_TYPES = ['crown', 'swept', 'spiral', 'antler', 'none'];
export const TAIL_TYPES = ['spade', 'fan', 'spikes', 'whip', 'club'];
export const CREST_TYPES = ['none', 'frill', 'mane', 'sail', 'plates'];
export const PATTERNS = ['plain', 'banded', 'spotted', 'mottled', 'gradient', 'veined'];

const GENE_POOLS = {
  body: BODY_PLANS, wings: WING_TYPES, horns: HORN_TYPES,
  tail: TAIL_TYPES, crest: CREST_TYPES, pattern: PATTERNS,
};

let serial = 0;

/** Pick a gene, biased toward what the lineage usually looks like. */
function rollGene(rng, key, bias) {
  const pool = GENE_POOLS[key];
  const biased = bias && bias[key];
  if (biased && rng.chance(0.78)) return rng.pick(biased);
  return rng.pick(pool);
}

function rollColours(rng, lin) {
  const hueRange = (lin.geneBias && lin.geneBias.hue) || [0, 360];
  let hue = rng.int(hueRange[0], hueRange[1]) % 360;
  if (rng.chance(0.12)) hue = rng.int(0, 359);          // an off-colour animal
  const hue2 = rng.chance(0.55) ? (hue + rng.int(20, 70) * rng.sign() + 360) % 360
                                : (hue + rng.int(140, 200)) % 360;
  return {
    hue, hue2,
    sat: Math.round(rng.float(0.35, 0.85) * 100) / 100,
    light: Math.round(rng.float(0.38, 0.62) * 100) / 100,
    eye: rng.int(0, 359),
  };
}

/** Essence: the 0-15 "individual" layer. Wilds roll low, bred stock inherits. */
function rollEssence(rng, quality = 0) {
  const e = {};
  for (const s of STATS) e[s] = clamp(rng.dice(2, 0, 7) + quality, 0, ESSENCE_CAP);
  return e;
}

/** Moves a lineage knows by a given level: one unlocked every four levels. */
export function movesAtLevel(lineageId, level) {
  const list = lineage(lineageId).learn;
  const count = clamp(1 + Math.floor(level / 4), 1, list.length);
  return list.slice(0, count);
}

/** The move learned exactly on reaching `level`, if any. */
export function moveLearnedAt(lineageId, level) {
  const before = movesAtLevel(lineageId, level - 1);
  const after = movesAtLevel(lineageId, level);
  return after.length > before.length ? after[after.length - 1] : null;
}

export function stageFor(level, bond, generation) {
  for (const s of STAGES) {
    if (level >= s.level && bond >= s.bond && generation >= s.generation) return s.id;
  }
  return 'hatchling';
}

/**
 * Build a dragon. Everything is derived from `rng`, so the same stream
 * always produces the same animal - which is what makes encounters, eggs
 * and the Broodex reproducible across a reload.
 */
export function makeDragon(rng, opts = {}) {
  const lineageId = opts.lineageId || rng.pick(Object.keys(LINEAGES));
  const lin = lineage(lineageId);
  const level = clamp(opts.level ?? 5, 1, XP.maxLevel);
  const ashbound = opts.ashbound ?? (lin.feral === true);

  // Elements: the lineage primary, plus a secondary most of the time.
  const primary = opts.element || lin.elements[0];
  let secondary = null;
  if (opts.secondary !== undefined) secondary = opts.secondary;
  else if (rng.chance(0.45)) {
    const alts = (lin.altSecondary || []).filter(Boolean);
    secondary = alts.length ? rng.pick(alts) : rng.pick(ELEMENT_IDS.filter(e => e !== primary));
  }
  if (secondary === primary) secondary = null;

  const genes = {
    body: rollGene(rng, 'body', lin.geneBias),
    wings: rollGene(rng, 'wings', lin.geneBias),
    horns: rollGene(rng, 'horns', lin.geneBias),
    tail: rollGene(rng, 'tail', lin.geneBias),
    crest: rollGene(rng, 'crest', lin.geneBias),
    pattern: rollGene(rng, 'pattern', lin.geneBias),
    size: Math.round(rng.float(0.82, 1.22) * 100) / 100,
    ...rollColours(rng, lin),
  };

  const temperament = ashbound ? 'hollow' : (opts.temperament || rng.pick(TEMPERAMENT_IDS));
  const generation = opts.generation ?? 0;
  const bond = opts.bond ?? (opts.wild ? 0 : 10);
  const essence = opts.essence || rollEssence(rng, opts.essenceQuality ?? 0);

  const traits = opts.traits ? [...opts.traits] : [];
  if (!traits.length) {
    traits.push(ashbound ? 'hollowed' : lin.trait);
    if (level >= 28 && rng.chance(0.8)) {
      const extra = rng.pick(ROLLABLE_TRAITS.filter(t => !traits.includes(t)));
      if (extra) traits.push(extra);
    }
  }

  const d = {
    id: opts.id || `d${(++serial).toString(36)}${Math.floor(rng.next() * 1e9).toString(36)}`,
    name: opts.name || dragonName(rng, ashbound ? 'gloam' : primary),
    trueName: null,
    lineageId,
    elements: [primary, secondary],
    genes,
    essence,
    temperament,
    traits,
    level,
    xp: 0,
    bond: clamp(bond, 0, BOND_MAX),
    generation,
    parents: opts.parents || null,
    ashbound,
    broodRole: opts.broodRole || (ashbound ? 'neuter' : rng.chance(0.5) ? 'kindler' : 'clutcher'),
    moves: opts.moves ? [...opts.moves] : movesAtLevel(lineageId, level),
    equip: { harness: null, relic: null },
    stage: 'hatchling',
    hp: 0, mp: 0,
    fainted: false,
    caughtAt: opts.caughtAt || null,
    boss: opts.boss || false,
    meal: null,
  };

  if (ashbound) {
    // Under the grey it is still something. Cleansing reveals this name.
    d.trueName = dragonName(rng, primary);
  }
  d.stage = stageFor(d.level, d.bond, d.generation);
  trimMoves(d);
  const s = statsOf(d);
  d.hp = s.hp; d.mp = s.mp;
  return d;
}

/** Keep the move list inside the slot count for the current stage. */
export function trimMoves(d) {
  if (d.boss) return d;              // authored fights keep every move given
  const slots = MOVE_SLOTS[d.stage] ?? 4;
  if (d.moves.length > slots) d.moves = d.moves.slice(0, slots);
  return d;
}

/** Temperament nudges two growth rates by 10%. */
function growthOf(d) {
  const lin = lineage(d.lineageId);
  const g = { ...lin.growth };
  const t = TEMPERAMENTS[d.temperament];
  if (t) {
    if (g[t.up] !== undefined) g[t.up] *= 1.10;
    if (g[t.down] !== undefined) g[t.down] *= 0.90;
  }
  return g;
}

/** A pool stat (HP/Ley) and a plain stat grow on different curves. */
function poolStat(base, growth, essence, level, sizeW, stageW, genBonus, isMp) {
  const scale = isMp ? CURVE.mpScale : CURVE.hpScale;
  const ess = isMp ? CURVE.mpEssence : CURVE.hpEssence;
  const v = (base * scale + essence * ess)
          * (1 + growth * (level - 1) / CURVE.poolDivisor)
          * sizeW * stageW * genBonus;
  return Math.max(1, Math.floor(v));
}

function plainStat(base, growth, essence, level, sizeW, stageW, genBonus) {
  const v = (base + essence * CURVE.statEssence)
          * (1 + growth * (level - 1) / CURVE.statDivisor)
          * sizeW * stageW * genBonus;
  return Math.max(1, Math.floor(v));
}

/**
 * Full derived stats, including equipment, meals and the generation bonus.
 * Never cached on the dragon: bond, stage and gear all move underneath it.
 */
export function statsOf(d) {
  const lin = lineage(d.lineageId);
  const growth = growthOf(d);
  const stageW = stageMult(d.stage);
  const genBonus = 1 + Math.min(d.generation * CURVE.generationBonus, CURVE.generationCap);
  // Size trades health for speed, so a big dragon is not simply a better one.
  const sizeW = { hp: d.genes.size, mp: 1, atk: 0.85 + d.genes.size * 0.15, mag: 1,
                  def: 0.9 + d.genes.size * 0.1, res: 1, spd: 1.9 - d.genes.size };

  const out = {};
  for (const s of STATS) {
    const fn = (s === 'hp' || s === 'mp') ? poolStat : plainStat;
    out[s] = fn(lin.base[s], growth[s], d.essence[s] ?? 0, d.level, sizeW[s] ?? 1,
                s === 'mp' ? 1 : stageW, genBonus, s === 'mp');
  }

  // Equipment and the last meal are multiplicative on top.
  for (const slot of ['harness', 'relic']) {
    const gear = d.equip && d.equip[slot];
    if (!gear || !gear.mods) continue;
    for (const [stat, mult] of Object.entries(gear.mods)) {
      if (out[stat] !== undefined) out[stat] = Math.floor(out[stat] * mult);
    }
  }
  if (d.meal) {
    for (const [stat, mult] of Object.entries(d.meal)) {
      if (out[stat] !== undefined) out[stat] = Math.floor(out[stat] * mult);
    }
  }
  for (const tid of d.traits || []) {
    const t = TRAITS[tid];
    if (t && t.statMod) for (const [stat, mult] of Object.entries(t.statMod)) {
      if (out[stat] !== undefined) out[stat] = Math.floor(out[stat] * mult);
    }
  }
  // Bosses carry a deeper pool than their level implies. Folding it in here
  // means every health bar, heal and percentage in the game agrees about it.
  if (d.hpMult) out.hp = Math.round(out.hp * d.hpMult);
  return out;
}

export const maxHp = d => statsOf(d).hp;
export const maxMp = d => statsOf(d).mp;

/** Restore pools; used after a level, a stage change, an equip or a rest. */
export function refill(d, ratio = 1) {
  const s = statsOf(d);
  d.hp = Math.min(Math.max(d.hp, Math.round(s.hp * ratio)), s.hp);
  d.mp = Math.min(Math.max(d.mp, Math.round(s.mp * ratio)), s.mp);
  d.fainted = d.hp <= 0;
  return d;
}

export function fullHeal(d) {
  const s = statsOf(d);
  d.hp = s.hp; d.mp = s.mp; d.fainted = false;
  return d;
}

/** Clamp pools after anything that could have shrunk them. */
export function clampPools(d) {
  const s = statsOf(d);
  d.hp = clamp(d.hp, 0, s.hp);
  d.mp = clamp(d.mp, 0, s.mp);
  d.fainted = d.hp <= 0;
  return d;
}

/**
 * Award experience. Returns a report of everything that changed, so the UI
 * can narrate it in order instead of guessing.
 */
export function gainXp(d, amount, rng) {
  const report = { dragon: d, xp: amount, levels: [], moves: [], stage: null };
  if (d.level >= XP.maxLevel) return report;
  const before = statsOf(d);
  d.xp += Math.max(0, Math.round(amount));
  let guard = 0;
  while (d.level < XP.maxLevel && d.xp >= XP.toNext(d.level) && guard++ < 100) {
    d.xp -= XP.toNext(d.level);
    d.level++;
    report.levels.push(d.level);
    const learned = moveLearnedAt(d.lineageId, d.level);
    if (learned) {
      if (d.moves.length < (MOVE_SLOTS[d.stage] ?? 4)) { d.moves.push(learned); report.moves.push(learned); }
      else report.moves.push(learned);   // offered as a swap by the UI
    }
  }
  if (d.level >= XP.maxLevel) d.xp = 0;
  // Growing gives you the health it adds: a level-up should never leave a
  // dragon looking more hurt than it was a moment ago.
  const after = statsOf(d);
  if (report.levels.length) {
    d.hp += Math.max(0, after.hp - before.hp);
    d.mp += Math.max(0, after.mp - before.mp);
  }
  const newStage = checkStage(d);
  if (newStage) report.stage = newStage;
  clampPools(d);
  return report;
}

/** Promote if the thresholds are met. Returns the new stage id, or null. */
export function checkStage(d) {
  const want = stageFor(d.level, d.bond, d.generation);
  if (want === d.stage) return null;
  const order = ['hatchling', 'drake', 'wyrm', 'elder'];
  if (order.indexOf(want) <= order.indexOf(d.stage)) return null;   // never demote
  const beforeMax = statsOf(d).hp;
  d.stage = want;
  const afterMax = statsOf(d).hp;
  d.hp += Math.max(0, afterMax - beforeMax);       // a growth spurt is not damage
  // Growing opens slots; fill them with anything the lineage already knew.
  const slots = MOVE_SLOTS[d.stage] ?? 4;
  for (const m of movesAtLevel(d.lineageId, d.level)) {
    if (d.moves.length >= slots) break;
    if (!d.moves.includes(m)) d.moves.push(m);
  }
  clampPools(d);
  return want;
}

export function addBond(d, amount) {
  const t = TEMPERAMENTS[d.temperament];
  const scale = amount > 0 ? (t ? t.bond : 1) : 1;
  const before = d.bond;
  d.bond = clamp(Math.round(d.bond + amount * scale), 0, BOND_MAX);
  checkStage(d);
  return d.bond - before;
}

/** Cleansing an ashbound dragon: it gets its colour, its name and a temper. */
export function cleanse(d, rng) {
  if (!d.ashbound) return false;
  d.ashbound = false;
  // Remember that it was grey: "bring three of them back" has to still be
  // true of a dragon you cleansed before binding, which is the whole method.
  d.wasAshbound = true;
  if (d.trueName) { d.name = d.trueName; d.trueName = null; }
  d.temperament = rng ? rng.pick(TEMPERAMENT_IDS) : 'wary';
  d.traits = d.traits.filter(t => t !== 'hollowed');
  if (!d.traits.length) {
    // The Ashbound lineage's own signature IS 'hollowed', so falling back to
    // it would re-grey the dragon you just brought back.
    const lineageTrait = lineage(d.lineageId).trait;
    d.traits.push(lineageTrait === 'hollowed'
      ? (rng ? rng.pick(ROLLABLE_TRAITS) : 'brightscale')
      : lineageTrait);
  }
  // It has a brood role again. Cleansing gives a dragon back its future,
  // not just its colour.
  if (d.broodRole === 'neuter') d.broodRole = (rng ? rng.chance(0.5) : true) ? 'kindler' : 'clutcher';
  d.genes.sat = Math.min(0.9, d.genes.sat + 0.25);
  return true;
}

/** A stable key for the sprite cache and the Broodex. */
export function geneKey(d) {
  const g = d.genes;
  return [d.lineageId, d.stage, d.ashbound ? 'ash' : 'lit', g.body, g.wings, g.horns, g.tail,
          g.crest, g.pattern, g.hue, g.hue2, g.sat, g.light, g.eye, g.size,
          d.elements[0], d.elements[1] || '-'].join('|');
}

export const spriteSeed = d => hashStr(geneKey(d));

/** Gene ids are keys; prose needs words. */
const TAIL_WORD = { spade: 'spade-tipped', fan: 'fanned', spikes: 'spiked', whip: 'whip-thin', club: 'clubbed' };
const CREST_WORD = { none: null, frill: 'a frill down its neck', mane: 'a coarse mane',
                     sail: 'a sail along its spine', plates: 'plates down its back' };
const BODY_WORD = { serpent: 'serpent', drake: 'drake', wyvern: 'wyvern', quad: 'four-legged drake', amphithere: 'winged serpent' };

/** Compact description used in the roster and the Broodex. */
export function describe(d) {
  const g = d.genes;
  const size = g.size < 0.92 ? 'small' : g.size > 1.12 ? 'large' : 'middling';
  const wings = g.wings === 'vestigial' ? 'barely-there wings' : `${g.wings} wings`;
  const horns = g.horns === 'none' ? 'no horns to speak of' : `${g.horns} horns`;
  const tail = `a ${TAIL_WORD[g.tail] || g.tail} tail`;
  const crest = CREST_WORD[g.crest];
  return `A ${size} ${BODY_WORD[g.body] || g.body} with ${wings}, ${horns}, ${tail} and ${g.pattern} scales`
       + (crest ? `, and ${crest}.` : '.');
}

/** Can these two produce an egg? Returns a reason when they cannot. */
export function canBreed(a, b) {
  if (!a || !b || a.id === b.id) return { ok: false, why: 'Pick two different dragons.' };
  if (a.stage === 'egg' || b.stage === 'egg') return { ok: false, why: 'An egg cannot be a parent.' };
  if (a.broodRole === 'neuter' || b.broodRole === 'neuter')
    return { ok: false, why: 'An ashbound dragon will not brood until it is cleansed.' };
  if (a.broodRole === b.broodRole) return { ok: false, why: 'A pair needs one kindler and one clutcher.' };
  if (a.level < 10 || b.level < 10) return { ok: false, why: 'Both parents must be level 10 or better.' };
  if (a.bond < 30 || b.bond < 30) return { ok: false, why: 'Both parents need a bond of 30 or better.' };
  return { ok: true };
}

export const moveList = d => d.moves.map(id => move(id)).filter(Boolean);
export const knowsMove = (d, id) => d.moves.includes(id);
export const traitList = d => (d.traits || []).map(id => TRAITS[id]).filter(Boolean);
export const hasTrait = (d, id) => (d.traits || []).includes(id);

/** Collect a trait hook across a dragon's traits and gear. */
export function traitValue(d, key, combine = (a, b) => a * b, initial = 1) {
  let v = initial;
  for (const t of traitList(d)) if (t[key] !== undefined) v = combine(v, t[key]);
  for (const slot of ['harness', 'relic']) {
    const g = d.equip && d.equip[slot];
    if (g && g[key] !== undefined) v = combine(v, g[key]);
  }
  return v;
}
