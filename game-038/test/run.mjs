// ============================================================
// test/run.mjs - the headless test suite (GDD 17)
// Pure logic only: genome determinism, the damage and capture curves, the
// XP curve, breeding inheritance, quest predicates and the save round-trip.
// Run with:  node test/run.mjs
// ============================================================
import { rngFrom, RNG, hashStr } from '../js/core/rand.js';
import { makeDragon, statsOf, maxHp, gainXp, checkStage, geneKey, describe, canBreed, cleanse, addBond } from '../js/gen/dragon.js';
import { buildDragonSprite, buildEggSprite, palettteFor } from '../js/gen/sprite.js';
import { BODY_IDX, IDX } from '../js/gen/pixels.js';
import { Battle, SIDE } from '../js/game/battle.js';
import { breed, hatch } from '../js/game/breeding.js';
import { rollEncounter, makeBoss, buildRoost } from '../js/gen/encounters.js';
import { generateBoard } from '../js/gen/questgen.js';
import { elementMultiplier, CHART, ELEMENT_IDS } from '../js/data/elements.js';
import { MOVES, MOVE_IDS, SURGES } from '../js/data/moves.js';
import { ITEMS, ITEM_IDS, RECIPES, DROP_TABLE } from '../js/data/items.js';
import { LINEAGES, LINEAGE_IDS, ELDER_LINEAGES } from '../js/data/lineages.js';
import { STATUSES, STATUS_IDS } from '../js/data/statuses.js';
import { NODES, NODE_IDS, neighbours } from '../js/data/world.js';
import { MAIN_CHAIN, SIDE_QUESTS } from '../js/data/quests.js';
import { SCENES } from '../js/data/story.js';
import { BOSSES, BOSS_IDS } from '../js/data/bosses.js';
import { VIGNETTES } from '../js/data/events.js';
import { XP, BOND_MAX, PARTY_SIZE } from '../js/data/constants.js';
import { applyItem } from '../js/game/effects.js';

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push('  ok   ' + name); }
  catch (e) { fail++; results.push('  FAIL ' + name + '\n         ' + e.message); }
}
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (v, msg = 'expected truthy') => { if (!v) throw new Error(msg); };
const near = (a, b, tol, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} ${a} not within ${tol} of ${b}`); };

// --------------------------------------------------------------- data ----
t('every lineage move, signature and surge exists', () => {
  for (const id of LINEAGE_IDS) {
    const lin = LINEAGES[id];
    for (const m of lin.learn) ok(MOVES[m], `${id} learns unknown move ${m}`);
    ok(MOVES[lin.signature], `${id} signature ${lin.signature} missing`);
    ok(SURGES[id], `${id} has no surge`);
  }
});

t('the element chart is its own mirror', () => {
  for (const a of ELEMENT_IDS) for (const d of ELEMENT_IDS) {
    if (a === d) continue;
    if (CHART[a][d] === 2) eq(CHART[d][a], 0.5, `${d} vs ${a}`);
  }
  eq(elementMultiplier('storm', ['tide', 'gale']), 4, 'double weakness');
  eq(elementMultiplier('ember', ['tide']), 0.5, 'resisted');
  eq(elementMultiplier(null, ['tide']), 1, 'element-less move');
});

t('every bad status has a cure item, and every move status exists', () => {
  const cured = new Set(ITEM_IDS.flatMap(id => ITEMS[id].effect?.cure || []));
  for (const s of STATUS_IDS) if (STATUSES[s].bad) ok(cured.has(s), `${s} has no cure item`);
  for (const id of MOVE_IDS) {
    const m = MOVES[id];
    if (m.status) ok(STATUSES[m.status.id], `${id} inflicts unknown status`);
  }
});

t('forge recipes, drops and quest rewards all name real items', () => {
  for (const r of RECIPES) {
    ok(ITEMS[r.out], `recipe makes unknown ${r.out}`);
    for (const p of Object.keys(r.parts)) ok(ITEMS[p], `recipe needs unknown ${p}`);
  }
  for (const list of Object.values(DROP_TABLE)) for (const d of list) ok(ITEMS[d], `drop ${d}`);
  for (const q of [...MAIN_CHAIN, ...SIDE_QUESTS]) {
    for (const i of q.reward?.items || []) ok(ITEMS[i], `${q.id} pays unknown ${i}`);
    if (q.goal.kind === 'reach') ok(NODES[q.goal.node], `${q.id} sends you to nowhere`);
    if (q.goal.kind === 'boss') ok(BOSSES[q.goal.bossId], `${q.id} names no boss`);
    if (q.scene) ok(SCENES[q.scene], `${q.id} scene missing`);
    if (q.after) ok(SCENES[q.after], `${q.id} after-scene missing`);
  }
  for (const v of VIGNETTES) for (const c of v.choices) {
    for (const i of Object.keys(c.effects?.items || {})) ok(ITEMS[i], `${v.id} gives unknown ${i}`);
    for (const i of Object.keys(c.effects?.take || {})) ok(ITEMS[i], `${v.id} takes unknown ${i}`);
  }
});

t('the map is fully connected and every act is reachable in order', () => {
  const seen = new Set(['broodwell']);
  const queue = ['broodwell'];
  while (queue.length) for (const n of neighbours(queue.pop())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  eq(seen.size, NODE_IDS.length, 'unreachable nodes');
  // Walking with act gating must also reach every act boss.
  for (let act = 1; act <= 5; act++) {
    const reach = new Set(['broodwell']);
    const q = ['broodwell'];
    while (q.length) for (const n of neighbours(q.pop())) {
      if (reach.has(n) || (NODES[n].act || 1) > act) continue;
      reach.add(n); q.push(n);
    }
    const boss = NODE_IDS.find(id => NODES[id].boss && (NODES[id].act || 1) === act);
    if (boss) ok(reach.has(boss), `act ${act} boss at ${boss} unreachable`);
  }
});

// -------------------------------------------------------------- genome ----
t('the same seed makes the same dragon, a different seed does not', () => {
  const a = makeDragon(rngFrom('s1', 'd'), { lineageId: 'skyward', level: 20 });
  const b = makeDragon(rngFrom('s1', 'd'), { lineageId: 'skyward', level: 20 });
  const c = makeDragon(rngFrom('s2', 'd'), { lineageId: 'skyward', level: 20 });
  eq(geneKey(a), geneKey(b), 'same seed diverged');
  ok(geneKey(a) !== geneKey(c), 'different seeds matched');
  eq(JSON.stringify(statsOf(a)), JSON.stringify(statsOf(b)), 'stats diverged');
});

t('a sprite is a pure function of the genes', () => {
  const d = makeDragon(rngFrom('art', 'd'), { lineageId: 'stonefather', level: 30 });
  const one = buildDragonSprite(d, false), two = buildDragonSprite(d, false);
  eq(one.data.join(''), two.data.join(''), 'sprite is not deterministic');
  ok(one.count() > 150, 'sprite is nearly empty: ' + one.count());
  const bounds = one.bounds();
  ok(bounds.w > 12 && bounds.h > 12, 'sprite is tiny');
  const flap = buildDragonSprite(d, true);
  ok(flap.data.join('') !== one.data.join(''), 'the two frames are identical');
  ok(palettteFor(d).length === 14, 'palette is the wrong shape');
});

t('scales do not crawl between animation frames', () => {
  // Reported from play: "sometimes the dragon animations have evenly spaced
  // vertical bars as visual artifacts". The pattern pass was seeded with the
  // frame mixed in, so a banded dragon re-rolled its stripe spacing AND offset
  // twice a second. Scales belong to the animal, not to the frame.
  const PATTERNS = ['plain', 'banded', 'spotted', 'mottled', 'gradient', 'veined'];
  const SHAPES = [['membrane', 'quad'], ['feathered', 'drake'], ['twin', 'wyvern'],
                  ['finned', 'serpent'], ['vestigial', 'amphithere']];

  // How much of the shared body surface changes between the two frames. The
  // wing is excluded by construction (a pixel must be body scale in BOTH
  // frames to count), so what is left is the pattern moving, plus a little
  // noise from the one-pixel bob re-rasterising curves.
  const drift = (pattern, wings, body) => {
    const d = makeDragon(rngFrom(`drift|${pattern}|${wings}|${body}`, 'x'), { lineageId: 'ridgeback', level: 20 });
    Object.assign(d.genes, { pattern, wings, body, size: 1 });
    const a = buildDragonSprite(d, false), b = buildDragonSprite(d, true);
    let differ = 0, counted = 0;
    for (let y = 0; y < 31; y++) for (let x = 0; x < 32; x++) {
      const va = a.get(x, y + 1), vb = b.get(x, y);        // undo the 1px bob
      if (!BODY_IDX.has(va) || !BODY_IDX.has(vb)) continue;
      counted++;
      if (va !== vb) differ++;
    }
    return counted ? differ / counted : 0;
  };

  // 'plain' has no pattern pass at all, so it is the floor: whatever it shows
  // is the bob and the shading around the moving wing, and no patterned
  // dragon should move much more than that.
  for (const [wings, body] of SHAPES) {
    const floor = drift('plain', wings, body);
    for (const pattern of PATTERNS) {
      const d = drift(pattern, wings, body);
      ok(d <= floor + 0.06,
        `${pattern}/${wings}/${body} scales move ${(d * 100).toFixed(0)}% between frames ` +
        `against a ${(floor * 100).toFixed(0)}% floor - the pattern is being re-rolled per frame`);
    }
  }

  // And the reported symptom itself: a banded dragon's stripes must land on
  // exactly the same columns in both frames.
  const striped = makeDragon(rngFrom('stripes', 'x'), { lineageId: 'ridgeback', level: 20 });
  Object.assign(striped.genes, { pattern: 'banded', wings: 'vestigial', body: 'quad', size: 1 });
  const columns = (buf) => {
    const out = [];
    for (let x = 0; x < 32; x++) {
      let n = 0;
      for (let y = 0; y < 32; y++) if (buf.get(x, y) === IDX.DARK) n++;
      if (n > 3) out.push(x);
    }
    return out.join(',');
  };
  eq(columns(buildDragonSprite(striped, true)), columns(buildDragonSprite(striped, false)),
     'the bands sit on different columns in the two frames');
});

t('every body plan, wing, horn, tail and crest draws something', () => {
  const combos = [
    ['serpent', 'finned', 'spiral', 'whip', 'frill'],
    ['drake', 'membrane', 'crown', 'spade', 'plates'],
    ['wyvern', 'twin', 'swept', 'spikes', 'sail'],
    ['quad', 'vestigial', 'antler', 'club', 'mane'],
    ['amphithere', 'feathered', 'none', 'fan', 'none'],
  ];
  for (const [body, wings, horns, tail, crest] of combos) {
    const d = makeDragon(rngFrom('combo' + body, 'd'), { lineageId: 'cinderling', level: 20 });
    Object.assign(d.genes, { body, wings, horns, tail, crest });
    const buf = buildDragonSprite(d, false);
    ok(buf.count() > 120, `${body}/${wings} drew only ${buf.count()} pixels`);
  }
});

t('stats rise with level, stage and generation', () => {
  const base = makeDragon(rngFrom('curve', 'd'), { lineageId: 'emberwyrm', level: 1, essence: { hp: 8, mp: 8, atk: 8, mag: 8, def: 8, res: 8, spd: 8 } });
  const l1 = statsOf(base).atk;
  base.level = 40; checkStage(base);
  ok(statsOf(base).atk > l1 * 2, 'level 40 is not much stronger than level 1');
  const plain = statsOf(base).hp;
  base.generation = 5;
  ok(statsOf(base).hp > plain, 'generation bonus does nothing');
});

t('the XP curve stays near four fights a level', () => {
  for (const level of [5, 20, 40, 55]) {
    const perFight = 2 * XP.fromKill(level, 64) / 3;       // two foes, three sharing
    const fights = XP.toNext(level) / perFight;
    ok(fights > 1.5 && fights < 8, `level ${level} takes ${fights.toFixed(1)} fights`);
  }
});

t('growth stages gate on level, bond and generation', () => {
  const d = makeDragon(rngFrom('stage', 'd'), { lineageId: 'saltdrake', level: 1, bond: 0 });
  eq(d.stage, 'hatchling');
  d.level = 12; checkStage(d); eq(d.stage, 'drake', 'level 12 should be a drake');
  d.level = 30; checkStage(d); eq(d.stage, 'drake', 'wyrm needs bond');
  addBond(d, 60); eq(d.stage, 'wyrm', 'bond 40 + level 28 should be a wyrm');
  d.level = 50; addBond(d, 40); checkStage(d);
  eq(d.stage, 'wyrm', 'elder needs a generation');
  d.generation = 2; checkStage(d); eq(d.stage, 'elder', 'should be elder now');
});

t('levelling and promotion both hand over the health they add', () => {
  const d = makeDragon(rngFrom('spurt', 'd'), { lineageId: 'ridgeback', level: 11, bond: 0 });
  d.hp = maxHp(d);
  gainXp(d, XP.toNext(11) + 1, rngFrom('spurt', 'x'));
  eq(d.level, 12, 'should have levelled');
  eq(d.stage, 'drake', 'should have been promoted');
  eq(d.hp, maxHp(d), 'a dragon that just grew should be at full health');

  // And a level gained while hurt keeps the wound, but not as a bigger one.
  const e = makeDragon(rngFrom('spurt2', 'd'), { lineageId: 'saltdrake', level: 20, bond: 0 });
  const missing = 40;
  e.hp = maxHp(e) - missing;
  gainXp(e, XP.toNext(20) + 1, rngFrom('spurt2', 'x'));
  eq(maxHp(e) - e.hp, missing, 'the wound changed size on levelling');
});

// -------------------------------------------------------------- battle ----
t('damage responds to element, defence and bond', () => {
  const rng = rngFrom('dmg', 'b');
  const atk = makeDragon(rng, { lineageId: 'emberwyrm', level: 30, bond: 0 });
  const weak = makeDragon(rng, { lineageId: 'verdantcoil', level: 30 });   // ember > verdant
  const strong = makeDragon(rng, { lineageId: 'saltdrake', level: 30 });   // tide < ember
  const b = new Battle({ allies: [atk], enemies: [weak, strong], rng, context: { wild: true } });
  const m = MOVES.scorch;
  const vsWeak = b.computeDamage(atk, weak, m, { noCrit: true }).amount;
  const vsStrong = b.computeDamage(atk, strong, m, { noCrit: true }).amount;
  ok(vsWeak > vsStrong * 2, `element matters: ${vsWeak} vs ${vsStrong}`);
  atk.bond = 100;
  const bonded = b.computeDamage(atk, weak, m, { noCrit: true }).amount;
  ok(bonded > vsWeak, 'bond should add damage');
});

t('a fight always terminates and reports one outcome', () => {
  for (let i = 0; i < 60; i++) {
    const rng = rngFrom('term' + i, 'b');
    const allies = [0, 1, 2].map(() => makeDragon(rng, { lineageId: rng.pick(LINEAGE_IDS), level: rng.int(5, 50) }));
    const foes = [0, 1].map(() => makeDragon(rng, { lineageId: rng.pick(LINEAGE_IDS), level: rng.int(5, 50) }));
    const b = new Battle({ allies, enemies: foes, rng, context: { wild: true } });
    let guard = 0;
    while (b.state === 'input' && guard++ < 80) {
      for (const a of b.living(SIDE.ALLY)) {
        const o = b.availableMoves(a).filter(x => x.usable)[0];
        b.setCommand(a.id, { type: 'strike', moveId: o.move.id, targetId: (b.living(SIDE.ENEMY)[0] || {}).id });
      }
      b.resolveRound();
    }
    ok(['won', 'lost', 'fled', 'captured'].includes(b.state), `battle ${i} ended in ${b.state}`);
    ok(b.rewards, `battle ${i} produced no rewards`);
  }
});

t('binding odds rise as a dragon is worn down', () => {
  const rng = rngFrom('bind', 'b');
  const ally = makeDragon(rng, { lineageId: 'emberwyrm', level: 25 });
  const wild = makeDragon(rng, { lineageId: 'cinderling', level: 22, wild: true, ashbound: false });
  const b = new Battle({ allies: [ally], enemies: [wild], rng, wardenRank: 2, context: { wild: true } });
  wild.hp = maxHp(wild);
  const full = b.bindChance(wild, 'rune_cord');
  wild.hp = Math.round(maxHp(wild) * 0.15);
  const hurt = b.bindChance(wild, 'rune_cord');
  const better = b.bindChance(wild, 'soulglass');
  ok(hurt > full * 3, `hurt ${hurt.toFixed(2)} vs healthy ${full.toFixed(2)}`);
  ok(better > hurt, 'a better binding should be better');
  b.applyStatus(wild, 'chill', 3, 1);
  ok(b.bindChance(wild, 'rune_cord') > hurt, 'a status should help');
  b.applyStatus(wild, 'ashen', 3, 1);
  eq(b.bindChance(wild, 'rune_cord'), 0, 'ashen must block binding');
});

t('a boss cannot be bound except with an Elder Snare, and never when scripted not to', () => {
  const rng = rngFrom('bossbind', 'b');
  const ally = makeDragon(rng, { lineageId: 'skyward', level: 45 });
  const boss = makeBoss('ythrax', rng);
  const b = new Battle({ allies: [ally], enemies: [boss], rng, context: { wild: true } });
  boss.hp = 1;
  eq(b.bindChance(boss, 'soulglass'), 0, 'an ordinary binding should not hold a boss');
  ok(b.bindChance(boss, 'elder_snare') > 0, 'the Elder Snare should');
});

t('every boss builds, keeps its whole moveset and out-scales its level', () => {
  for (const id of BOSS_IDS) {
    const boss = makeBoss(id, rngFrom('b', id));
    ok(boss, `${id} did not build`);
    eq(boss.moves.length, BOSSES[id].moves.length, `${id} lost moves`);
    const plain = makeDragon(rngFrom('plain', id), { lineageId: BOSSES[id].lineageId, level: BOSSES[id].level });
    ok(maxHp(boss) > maxHp(plain) * 1.5, `${id} is not a boss-sized pool`);
    eq(boss.hp, maxHp(boss), `${id} does not start at full health`);
  }
});

t('a status wears off, and a cure removes it', () => {
  const rng = rngFrom('status', 'b');
  // Not an Emberwyrm (Forgeheart is immune to Burn) and not a Saltdrake
  // (Salt Memory shortens everything by a turn) - both by design.
  const a = makeDragon(rng, { lineageId: 'ridgeback', level: 20 });
  const foe = makeDragon(rng, { lineageId: 'boglurk', level: 20 });
  const b = new Battle({ allies: [a], enemies: [foe], rng, context: { wild: true } });
  b.applyStatus(a, 'burn', 3, 1);
  eq(a.statuses.length, 1, 'burn did not land');
  eq(a.statuses[0].turns, 3, 'wrong duration');
  b.endOfRound();
  eq(a.statuses[0].turns, 2, 'a status should tick down');
  const res = applyItem('ashwash', a, { battle: b });
  ok(res.ok, res.why);
  eq(a.statuses.length, 0, 'ashwash should clear a burn');
});

// ------------------------------------------------------------ breeding ----
t('breeding inherits, mutates and adds a generation', () => {
  const rng = rngFrom('breed', 'x');
  const mum = makeDragon(rng, { lineageId: 'emberwyrm', level: 25, bond: 60, broodRole: 'kindler' });
  const dad = makeDragon(rng, { lineageId: 'tidechorus', level: 25, bond: 60, broodRole: 'clutcher' });
  ok(canBreed(mum, dad).ok, canBreed(mum, dad).why);
  let fromEither = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const res = breed(mum, dad, rngFrom('egg' + i, 'b'));
    ok(res.ok, res.why);
    eq(res.egg.generation, 1, 'generation should be parent + 1');
    total++;
    if (['body', 'wings', 'horns', 'tail'].every(k => [mum.genes[k], dad.genes[k]].includes(res.egg.genes[k]))) fromEither++;
  }
  ok(fromEither / total > 0.4, `only ${(fromEither / total * 100).toFixed(0)}% of eggs were plainly parental`);
  ok(fromEither / total < 0.98, 'mutation never happens');
});

t('a hatchling wears the egg it came out of', () => {
  const rng = rngFrom('hatch', 'x');
  const mum = makeDragon(rng, { lineageId: 'stonefather', level: 20, bond: 50, broodRole: 'kindler' });
  const dad = makeDragon(rng, { lineageId: 'glimmerwing', level: 20, bond: 50, broodRole: 'clutcher' });
  const egg = breed(mum, dad, rngFrom('e', 'x')).egg;
  const kid = hatch(egg, rngFrom('h', 'x'));
  eq(JSON.stringify(kid.genes), JSON.stringify(egg.genes), 'the hatchling does not match its egg');
  eq(kid.lineageId, egg.lineageId);
  eq(kid.level, 1);
  eq(kid.hp, maxHp(kid), 'a hatchling should be at full health');
  ok(kid.moves.length > 0, 'a hatchling knows nothing');
});

t('breeding refuses what it should', () => {
  const rng = rngFrom('refuse', 'x');
  const low = makeDragon(rng, { lineageId: 'cinderling', level: 5, bond: 60, broodRole: 'kindler' });
  const fine = makeDragon(rng, { lineageId: 'cinderling', level: 20, bond: 60, broodRole: 'clutcher' });
  const same = makeDragon(rng, { lineageId: 'cinderling', level: 20, bond: 60, broodRole: 'clutcher' });
  const cold = makeDragon(rng, { lineageId: 'cinderling', level: 20, bond: 5, broodRole: 'kindler' });
  ok(!canBreed(low, fine).ok, 'level was not checked');
  ok(!canBreed(fine, same).ok, 'brood role was not checked');
  ok(!canBreed(cold, fine).ok, 'bond was not checked');
  ok(!canBreed(fine, fine).ok, 'a dragon bred with itself');
});

t('cleansing gives an ashbound dragon back its name, colour and future', () => {
  const rng = rngFrom('cleanse', 'x');
  const d = makeDragon(rng, { lineageId: 'ashbound', level: 20, ashbound: true });
  eq(d.broodRole, 'neuter');
  const greyName = d.name;
  const sat = d.genes.sat;
  ok(cleanse(d, rng), 'cleanse refused');
  ok(d.name !== greyName, 'it kept its grey name');
  ok(d.genes.sat > sat, 'it stayed grey');
  ok(d.broodRole !== 'neuter', 'it still cannot brood');
  ok(d.wasAshbound, 'the history is lost');
  ok(!d.traits.includes('hollowed'), 'still hollowed');
});

// ----------------------------------------------------------- generation ---
t('encounters stay inside the level cap and name real lineages', () => {
  for (const node of NODE_IDS.filter(id => NODES[id].kind === 'wild' || NODES[id].kind === 'roost')) {
    const enc = rollEncounter(node, 30, rngFrom('enc' + node, 'r'), rngFrom('w', 'tables' + node), 3);
    ok(enc.enemies.length >= 1 && enc.enemies.length <= 3, `${node} rolled ${enc.enemies.length} enemies`);
    for (const e of enc.enemies) {
      ok(LINEAGES[e.lineageId], `${node} rolled unknown lineage`);
      ok(e.level >= 1 && e.level <= XP.maxLevel, `${node} rolled level ${e.level}`);
      eq(e.hp, maxHp(e), 'wild dragons should start whole');
    }
  }
});

t('board quests are deterministic and only ask for what the region has', () => {
  for (const node of ['hollowbridge', 'saltley', 'cindermarch', 'windward']) {
    for (let act = 1; act <= 5; act++) {
      const a = generateBoard(node, act, act * 10, rngFrom('w', `board:${node}:${act}`));
      const b = generateBoard(node, act, act * 10, rngFrom('w', `board:${node}:${act}`));
      eq(JSON.stringify(a), JSON.stringify(b), `${node} act ${act} board is not stable`);
      for (const q of a) {
        ok(q.title && q.detail && q.goal, `${node} produced an incomplete quest`);
        ok(q.reward.coin > 0, 'a board quest pays nothing');
        for (const i of q.reward.items) ok(ITEMS[i], `board quest pays unknown ${i}`);
        if (q.goal.kind === 'item') for (const k of Object.keys(q.goal.items)) ok(ITEMS[k], `asks for unknown ${k}`);
      }
    }
  }
});

t('a roost run ends in something, and a boss roost ends in its boss', () => {
  for (const id of NODE_IDS.filter(n => NODES[n].kind === 'roost' || NODES[n].kind === 'spire')) {
    const run = buildRoost(id, 20, rngFrom('r', id), rngFrom('w', 'tables' + id), 2);
    ok(run.rooms.length >= 3, `${id} has ${run.rooms.length} rooms`);
    const last = run.rooms[run.rooms.length - 1];
    if (NODES[id].boss) eq(last.kind, 'boss', `${id} does not end in its boss`);
    else ok(['battle', 'treasure'].includes(last.kind));
  }
});

// --------------------------------------------------------------- quests ---
// Node has no localStorage and a browser will not let you replace it, so
// only stub it where it is actually missing. This file has to run in both.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
}

const { state, newGame, addDragon, addItem, serialize, deserialize, wardenRank } = await import('../js/game/state.js');
const quests = await import('../js/game/quests.js');
const { bus } = await import('../js/core/bus.js');

t('the main chain advances from the events the game actually emits', () => {
  newGame('quest-test', 'Tester');
  quests.wireQuests();
  quests.checkQuests();
  eq(state.quests.active[0].id, 'm01', 'the first step should be offered at once');

  const rng = rngFrom('q', 'd');
  addDragon(makeDragon(rng, { lineageId: 'cinderling', level: 5 }), { toParty: true });
  quests.checkQuests();
  eq(state.quests.mainStep, 1, 'owning a dragon should finish step one');

  for (let i = 0; i < 2; i++) bus.emit('battle:defeated', makeDragon(rng, { lineageId: 'boglurk', level: 4 }));
  quests.checkQuests();
  eq(state.quests.mainStep, 2, 'two defeats should finish step two');

  bus.emit('dragon:captured', makeDragon(rng, { lineageId: 'boglurk', level: 4, wild: true }));
  eq(state.quests.mainStep, 3, 'a capture should finish step three');

  const grey = makeDragon(rng, { lineageId: 'ashbound', level: 6, ashbound: true });
  bus.emit('dragon:cleansed', grey);
  eq(state.quests.mainStep, 4, 'a cleansing should finish step four');
});

t('counting goals measure from acceptance, not from the start of the game', () => {
  newGame('baseline-test');
  quests.checkQuests();
  const rng = rngFrom('b', 'd');
  for (let i = 0; i < 5; i++) bus.emit('battle:defeated', makeDragon(rng, { lineageId: 'boglurk', level: 4, element: 'verdant' }));
  quests.acceptQuest({ id: 'x1', kind: 'board', title: 'x', detail: 'x', goal: { kind: 'defeat', count: 2 }, reward: {} });
  const entry = state.quests.active.find(e => e.id === 'x1');
  ok(entry, 'quest not accepted');
  eq(quests.progressOf(entry).have, 0, 'past kills should not count');
  bus.emit('battle:defeated', makeDragon(rng, { lineageId: 'boglurk', level: 4 }));
  quests.checkQuests();
  eq(quests.progressOf(entry).have, 1, 'a fresh kill should count');
});

t('a quest goal never throws, whatever shape it is', () => {
  for (const q of [...MAIN_CHAIN, ...SIDE_QUESTS]) {
    const res = quests.evaluateGoal(q.goal, { baseline: {} });
    ok(typeof res.done === 'boolean', `${q.id} produced no verdict`);
    ok(res.need >= 1, `${q.id} needs nothing`);
  }
  ok(quests.evaluateGoal({ kind: 'nonsense' }, {}).done === false, 'an unknown goal should not complete');
});

// ----------------------------------------------------------------- save ---
t('a save round-trips through JSON without losing anything', () => {
  newGame('save-test', 'Andrew');
  const rng = rngFrom('s', 'd');
  const a = makeDragon(rng, { lineageId: 'emberwyrm', level: 24, bond: 55, broodRole: 'kindler' });
  const b = makeDragon(rng, { lineageId: 'tidechorus', level: 24, bond: 55, broodRole: 'clutcher' });
  addDragon(a, { toParty: true });
  addDragon(b, { toParty: true });
  addItem('greater_salve', 4);
  addItem('soulglass', 1);
  state.eggs.push(breed(a, b, rngFrom('e', 's')).egg);
  state.act = 3;
  const before = JSON.parse(JSON.stringify(serialize()));
  const beforeStats = JSON.stringify(statsOf(a));
  const beforeSprite = buildDragonSprite(a, false).data.join('');

  newGame('something-else');
  eq(state.roster.length, 0);
  ok(deserialize(before), 'the save would not load');
  eq(state.roster.length, 2);
  eq(state.act, 3);
  eq(state.eggs.length, 1);
  eq(state.inventory.greater_salve, 4);
  const after = state.roster.find(d => d.id === a.id);
  eq(JSON.stringify(statsOf(after)), beforeStats, 'stats changed across a save');
  eq(buildDragonSprite(after, false).data.join(''), beforeSprite, 'the dragon looks different after loading');
});

t('a save from another version is refused rather than half-loaded', () => {
  newGame('version-test');
  const blob = JSON.parse(JSON.stringify(serialize()));
  blob.version = -1;
  ok(!deserialize(blob), 'a stale save was accepted');
});

// --------------------------------------------------------------- report ---
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== 'undefined' && process.exit && typeof window === 'undefined') process.exit(fail ? 1 : 0);
export const summary = { pass, fail, results };
