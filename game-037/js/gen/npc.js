// ============================================================
// gen/npc.js - rosters, identities, households, schedules (GDD §13)
// PURE. NPCs are records until their chunk is live.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { npcId } from '../core/ids.js';
import { DOMAINS, TICKS_PER_DAY, TICKS_PER_HOUR } from '../data/constants.js';
import { CULTURES, TRADES, TRADE_KEYS } from '../data/cultures.js';
import { TICS } from '../data/dialogue.js';
import { personName } from './name.js';

const AGE_BANDS = [['child', 8, 15], ['young', 16, 28], ['middle', 29, 54], ['elder', 55, 82]];
const BUILDS = ['slight', 'square', 'tall', 'round', 'wiry', 'stooped'];
const HAIRS = ['grey-braided', 'black, cropped', 'red and escaping', 'white, thin', 'brown, tied back', 'fair, cut by someone else', 'none to speak of'];
const MARKS = ['a burn scar on the left hand', 'one eye gone milky', 'ink to the elbow', 'a gap where a tooth was',
  'hands that never come clean', 'a limp on the cold days', 'a ring worn thin', 'a voice like a hinge', 'freckles, everywhere'];
const TRAIT_BANK = ['exacting', 'kind to strangers', 'will not speak of the river', 'laughs at the wrong moment',
  'counts things', 'never sits down', 'remembers every name', 'tells the same story', 'up before anyone',
  'slow to trust', 'gives things away', 'proud of the wrong things', 'frightened of the dark and says so',
  'says exactly what they mean', 'keeps a list'];
const FEARS = ['the loom going silent', 'the winter', 'being forgotten', 'the water coming up',
  'their hands giving out', 'being alone in the house', 'the road after dark', 'saying the wrong thing',
  'the Quiet taking the name off the gate'];
const SECRET_KINDS = ['debt', 'grief', 'theft', 'affection', 'lie', 'was-there'];
const SCHEDULES = ['crafter', 'farmer', 'keeper', 'child', 'elder', 'wanderer'];
const REL_KINDS = ['parent', 'child', 'sibling', 'spouse', 'partner', 'friend', 'rival', 'owes', 'teacher', 'apprentice'];

/** @pure How many people live here (GDD §13.1). */
export function rosterSize(rng, size) {
  return size === 'hamlet' ? rng.int(4, 7) : size === 'village' ? rng.int(8, 14) : rng.int(15, 26);
}

/**
 * @pure The whole roster: identities, households, relationships.
 * Services are satisfied first, then trades are drawn from the culture's table.
 */
export function generateRoster(W, settle, layout) {
  const rng = deriveRNG(W.master, DOMAINS.SETTLE_ROSTER, hashStr(settle.id));
  const culture = CULTURES[settle.culture] || CULTURES.hedgewright;
  const count = rosterSize(rng, settle.size);

  // Which trades this settlement must have, from the buildings that exist.
  const required = [];
  for (const b of layout.buildings) {
    if (b.fn === 'inn') required.push('innkeeper');
    else if (b.fn === 'smith') required.push('smith');
    else if (b.fn === 'herbalist') required.push('herbalist');
    else if (b.fn === 'market') required.push(rng.pick(['carter', 'baker', 'cooper', 'potter', 'beekeeper', 'keeper']));
    else if (b.fn === 'chapel') required.push('bellringer');
    else if (b.fn === 'craft') required.push(rng.weightedKey(culture.trades));
    else if (b.fn === 'boathouse') required.push('boatwright');
  }

  const homes = layout.buildings.filter(b => b.fn === 'home');
  const workplaces = new Map();
  for (const b of layout.buildings) {
    const trade = fnToTrade(b.fn);
    if (trade) workplaces.set(trade, b.id);
  }

  const npcs = [];
  const usedShort = new Set(), usedFull = new Set();

  for (let k = 0; k < count; k++) {
    const id = npcId(settle.id, k);
    const irng = deriveRNG(W.master, DOMAINS.NPC_IDENTITY, hashStr(id));
    const trade = k < required.length ? required[k] : irng.weightedKey(culture.trades);

    const bandIdx = irng.weighted([0, 1, 2, 3], [k < required.length ? 0 : 2, 4, 6, 3]);
    const band = AGE_BANDS[bandIdx];
    const age = irng.int(band[1], band[2]);

    const { name, shortName } = personName(irng, settle.culture, trade, usedShort, usedFull);
    usedShort.add(shortName); usedFull.add(name);

    const home = homes.length ? homes[k % homes.length] : layout.buildings[k % Math.max(1, layout.buildings.length)];
    const workplace = workplaces.get(trade) || (home && home.id);

    const tradeDef = TRADES[trade] || TRADES.farmer;
    const values = { craft: 0.3, family: 0.3, safety: 0.3, curiosity: 0.3, custom: 0.3 };
    for (const v of tradeDef.values) values[v] = irng.float(0.6, 0.95);
    for (const key of Object.keys(values)) values[key] = +Math.min(1, values[key] + irng.float(-0.15, 0.3)).toFixed(2);

    npcs.push({
      id, settlementId: settle.id, index: k,
      name, shortName, age, ageBand: band[0], trade,
      home: home ? home.id : null, workplace,
      look: {
        build: irng.pick(BUILDS), hair: irng.pick(HAIRS), mark: irng.pick(MARKS),
        skin: irng.pick(['skin_a', 'skin_b', 'skin_c']),
        hairPalette: irng.pick(['hair_a', 'hair_b', 'hair_c', 'hair_d']),
        coat: irng.pick(['coat_a', 'coat_b', 'coat_c', 'coat_d']),
      },
      traits: irng.sample(TRAIT_BANK.slice(), 3),
      voice: { register: irng.pick(['plain', 'dry', 'soft', 'quick']), tic: irng.pick(TICS), verbosity: irng.int(1, 3) },
      values, fears: irng.pick(FEARS),
      secret: irng.chance(0.35) ? { kind: irng.pick(SECRET_KINDS), target: null, strength: +irng.float(0.3, 0.9).toFixed(2) } : null,
      schedule: scheduleFor(trade, band[0], irng),
      culture: settle.culture,
      relationships: [],
      // mutable, saved:
      disposition: 0, state: 'alive', metPlayer: false, needs: [], memory: [], questIds: [],
      gifted: 0, lastVisitDay: -1,
    });
  }

  buildHouseholds(rng, npcs, homes);
  buildRelationships(rng, npcs);
  // Secrets point at a real person once the roster exists.
  for (const n of npcs) {
    if (!n.secret) continue;
    const others = npcs.filter(o => o.id !== n.id);
    n.secret.target = others.length ? rng.pick(others).id : null;
  }
  return npcs;
}

function fnToTrade(fn) {
  return { inn: 'innkeeper', smith: 'smith', herbalist: 'herbalist', chapel: 'bellringer', boathouse: 'boatwright' }[fn] || null;
}

function scheduleFor(trade, band, rng) {
  if (band === 'child') return 'child';
  if (band === 'elder') return rng.chance(0.6) ? 'elder' : 'crafter';
  if (trade === 'innkeeper') return 'keeper';
  if (trade === 'farmer' || trade === 'shepherd' || trade === 'fisher') return 'farmer';
  if (trade === 'carter' || trade === 'keeper') return 'wanderer';
  return 'crafter';
}

/** Group people into 1-4 person households that share a home. */
function buildHouseholds(rng, npcs, homes) {
  if (!homes.length) return;
  let hi = 0;
  let i = 0;
  while (i < npcs.length) {
    const size = rng.weightedKey({ 1: 3, 2: 4, 3: 2, 4: 1 }) | 0;
    const home = homes[hi % homes.length];
    const group = npcs.slice(i, i + size);
    for (const n of group) { n.home = home.id; n.household = hi; }
    home.residents = group.map(n => n.id);
    // households are fully connected
    for (let a = 0; a < group.length; a++) for (let b = a + 1; b < group.length; b++) {
      const kind = pairKind(group[a], group[b], rng);
      group[a].relationships.push({ to: group[b].id, kind, warmth: +rng.float(0.2, 1).toFixed(2) });
      group[b].relationships.push({ to: group[a].id, kind: mirrorKind(kind), warmth: +rng.float(0.2, 1).toFixed(2) });
    }
    i += size; hi++;
  }
}

function pairKind(a, b, rng) {
  const ageGap = Math.abs(a.age - b.age);
  if (a.ageBand === 'child' && b.ageBand !== 'child') return 'child';
  if (b.ageBand === 'child' && a.ageBand !== 'child') return 'parent';
  if (ageGap < 8) return rng.chance(0.55) ? 'spouse' : 'sibling';
  return ageGap > 22 ? 'parent' : 'sibling';
}

function mirrorKind(k) {
  return { parent: 'child', child: 'parent', teacher: 'apprentice', apprentice: 'teacher' }[k] || k;
}

/** Everybody gets 1-4 edges; rivals and debts seed Threads later. */
function buildRelationships(rng, npcs) {
  for (const n of npcs) {
    const target = rng.int(1, 4);
    let guard = 0;
    while (n.relationships.length < target && guard++ < 12) {
      const o = rng.pick(npcs);
      if (o.id === n.id) continue;
      if (n.relationships.some(r => r.to === o.id)) continue;
      const kind = rng.weightedKey({ friend: 5, rival: 2, owes: 2, teacher: 1, apprentice: 1 });
      const warmth = kind === 'rival' ? +rng.float(-1, -0.2).toFixed(2)
        : kind === 'owes' ? +rng.float(-0.4, 0.4).toFixed(2)
          : +rng.float(0.2, 1).toFixed(2);
      n.relationships.push({ to: o.id, kind, warmth });
      o.relationships.push({ to: n.id, kind: mirrorKind(kind), warmth });
    }
  }
}

// ---------------------------------------------------------------------------
// Schedules (GDD §13.4)
// ---------------------------------------------------------------------------

const SCHEDULE_TABLE = {
  //        0-5 sleep   6-8 home   9-12 work  13-14 plaza  15-18 work  19-21 home/inn  22-23 sleep
  crafter: ['home', 'home', 'work', 'plaza', 'work', 'inn', 'home'],
  farmer: ['home', 'field', 'field', 'plaza', 'field', 'home', 'home'],
  keeper: ['home', 'work', 'work', 'work', 'work', 'work', 'home'],
  child: ['home', 'home', 'plaza', 'plaza', 'plaza', 'home', 'home'],
  elder: ['home', 'home', 'plaza', 'plaza', 'home', 'inn', 'home'],
  wanderer: ['home', 'plaza', 'road', 'road', 'plaza', 'inn', 'home'],
};
const BLOCK_HOURS = [0, 6, 9, 13, 15, 19, 22];

/** @pure Which place an NPC should be at a given tick. */
export function scheduleSlot(npc, tick) {
  const hour = Math.floor((tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
  const table = SCHEDULE_TABLE[npc.schedule] || SCHEDULE_TABLE.crafter;
  let idx = 0;
  for (let i = 0; i < BLOCK_HOURS.length; i++) if (hour >= BLOCK_HOURS[i]) idx = i;
  return { place: table[idx], hour, asleep: hour < 6 || hour >= 22 };
}
