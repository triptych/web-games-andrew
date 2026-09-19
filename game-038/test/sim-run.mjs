// A whole game, played headlessly: the real state, quests, encounters,
// battles, breeding and act gates. If this reaches an ending, the systems
// are actually wired to each other and not just to their own tests.
import { bus } from '../js/core/bus.js';
import { state, newGame, addDragon, addItem, partyDragons, livingParty, restParty, dragonById, setAct, wardenRank } from '../js/game/state.js';
import { wireQuests, checkQuests, currentMainQuest, activeEntries, questFor, progressOf, acceptQuest, availableSideQuests } from '../js/game/quests.js';
import * as adv from '../js/game/adventure.js';
import { makeDragon, maxHp, statsOf } from '../js/gen/dragon.js';
import { breed } from '../js/game/breeding.js';
import { rngFrom } from '../js/core/rand.js';
import { SIDE } from '../js/game/battle.js';
import { elementMultiplier } from '../js/data/elements.js';
import { neighbours, NODES } from '../js/data/world.js';
import { MAIN_CHAIN } from '../js/data/quests.js';
import { BOSSES } from '../js/data/bosses.js';
import { MOVES } from '../js/data/moves.js';
import { applyItem } from '../js/game/effects.js';
import { wireScenes, nextScene, finishScene, endingAvailability, chooseEnding } from '../js/game/scenes.js';

const log = [];
const breedFails = {};
const breedLog = [];
let culledBred = 0;
bus.on('quest:completed', ({ quest }) => log.push(`  quest done: ${quest.title}`));
bus.on('act:changed', a => log.push(`  --- ACT ${a} ---`));
bus.on('dragon:captured', d => log.push(`  bound: ${d.name} (${d.lineageId})`));
bus.on('egg:hatched', d => log.push(`  hatched: ${d.name} gen${d.generation}`));

function fight(encounter, { tryBind = false, verbose = false } = {}) {
  const res = adv.startBattle(encounter, { wild: !encounter.boss });
  if (!res.ok) return { ok: false, why: res.why };
  const b = res.battle;
  let guard = 0;
  while (b.state === 'input' && guard++ < 70) {
    for (const a of b.living(SIDE.ALLY)) {
      const opts = b.availableMoves(a).filter(o => o.usable && o.move.kind !== 'support');
      const foes = b.living(SIDE.ENEMY);
      let best = null, bestV = -1, bestFoe = foes[0];
      for (const o of opts) for (const f of foes) {
        const v = (o.move.power || 0) * (o.move.element ? elementMultiplier(o.move.element, f.elements) : 1);
        if (v > bestV) { bestV = v; best = o; bestFoe = f; }
      }
      if (best) b.setCommand(a.id, { type: best.move.mp ? 'skill' : 'strike', moveId: best.move.id, targetId: bestFoe.id });
      else b.setCommand(a.id, { type: 'guard' });
    }
    if (b.surge >= 100) {
      const a = b.living(SIDE.ALLY)[0];
      if (a) b.setCommand(a.id, { type: 'surge', targetId: (b.living(SIDE.ENEMY)[0] || {}).id });
    }
    // warden: heal, cleanse, or bind
    const hurt = b.living(SIDE.ALLY).find(a => a.hp < maxHp(a) * 0.35);
    const salve = ['full_salve', 'wardens_salve', 'greater_salve', 'ember_salve'].find(i => state.inventory[i]);
    const foe = b.living(SIDE.ENEMY)[0];
    if (hurt && salve) { b.setWardenCommand({ type: 'item', itemId: salve, targetId: hurt.id }); state.inventory[salve]--; }
    else if (foe && foe.ashbound && state.inventory.clearwater && !b.cleansedIds.has(foe.id)) {
      b.setWardenCommand({ type: 'item', itemId: 'clearwater', targetId: foe.id }); state.inventory.clearwater--;
    } else if (tryBind && foe && foe.hp < maxHp(foe) * 0.3) {
      const cord = ['soulglass', 'sigil_snare', 'bind_chain', 'rune_cord'].find(i => state.inventory[i]);
      if (cord) { b.setWardenCommand({ type: 'bind', targetId: foe.id, itemId: cord }); state.inventory[cord]--; }
    }
    b.resolveRound();
  }
  const report = adv.finishBattle();
  if (!report.won) { adv.handleDefeat(); }
  return { ok: true, report, state: b.state };
}

function pathTo(target) {
  const prev = { [state.node]: null };
  const q = [state.node];
  while (q.length) {
    const cur = q.shift();
    if (cur === target) break;
    for (const n of neighbours(cur)) {
      if (prev[n] !== undefined) continue;
      if ((NODES[n].act || 1) > state.act) continue;
      prev[n] = cur; q.push(n);
    }
  }
  if (prev[target] === undefined) return null;
  const path = []; let cur = target;
  while (cur && cur !== state.node) { path.unshift(cur); cur = prev[cur]; }
  return path;
}

function goTo(target) {
  const path = pathTo(target);
  if (!path) return false;
  for (const step of path) {
    const r = adv.travelTo(step);
    if (!r.ok) return false;
  }
  return true;
}

// ------------------------------------------------------------------ run --
newGame('playthrough-1', 'Andrew');
wireQuests();
wireScenes();
// Stand in for the UI: drain the scene queue as it fills.
bus.on('scene:queued', () => { let e; while ((e = nextScene())) finishScene(e); });
const rng = rngFrom('playthrough-1', 'start');
const starter = makeDragon(rng, { lineageId: 'emberwyrm', level: 5, bond: 20 });
addDragon(starter, { toParty: true });
for (const [id, n] of Object.entries({ ember_salve: 5, rune_cord: 5, clearwater: 2, ley_tonic: 3 })) addItem(id, n);
checkQuests();

let battles = 0, guard = 0;
const maxBattles = 2500;

while (guard++ < 4000) {
  const main = currentMainQuest();
  if (!main) break;
  const entry = activeEntries().find(e => e.id === main.id);
  const prog = entry ? progressOf(entry) : { done: false };

  // Keep the party healthy and stocked.
  if (livingParty().length < 2 || partyDragons().some(d => d.hp < maxHp(d) * 0.4)) {
    if (state.node !== 'broodwell' && NODES[state.node].services?.includes('rest')) adv.rest();
    else { goTo('broodwell'); adv.rest(); }
  }
  if (state.coin > 400) {
    const stock = adv.shopStock(state.node);
    for (const s of stock) if (['ember_salve','greater_salve','wardens_salve','rune_cord','bind_chain','sigil_snare','clearwater'].includes(s.id) && state.coin > 600) adv.buy(s.id, 2);
  }

  // Party building: hatch anything ready, and pair up when we can.
  for (const egg of [...state.eggs]) if (egg.battlesLeft === 0) adv.hatchEgg(egg.id);
  if (state.eggs.length === 0 && state.roster.length >= 2 && state.roster.length < 20) {
    // Breed the best stock available: generation compounds, so the parents
    // that matter are the ones you already bred.
    const eligible = r => r.level >= 10 && r.bond >= 30 && r.stage !== 'egg';
    const rank = (a, b) => (b.generation || 0) - (a.generation || 0) || b.level - a.level;
    const kindler = state.roster.filter(d => d.broodRole === 'kindler' && eligible(d)).sort(rank)[0];
    const clutcher = state.roster.filter(d => d.broodRole === 'clutcher' && eligible(d)).sort(rank)[0];
    // Feed whichever role is short, the way a player would.
    for (const role of ['kindler', 'clutcher']) {
      if (state.roster.some(d => d.broodRole === role && eligible(d))) continue;
      const best = state.roster.filter(d => d.broodRole === role && d.level >= 10).sort((a, b) => b.bond - a.bond)[0];
      const food = ['gilded_haunch', 'ash_pear', 'salt_cod', 'char_root', 'sunmelon', 'hearth_bread'].find(i => state.inventory[i]);
      if (best && food) { applyItem(food, best, {}); state.inventory[food]--; if (!state.inventory[food]) delete state.inventory[food]; }
      else if (best && state.coin > 400) { const stock = adv.shopStock(state.node).find(x => x.def.kind === 'food'); if (stock) adv.buy(stock.id, 3); }
    }
    if (kindler && clutcher) {
      const r = adv.layEgg(kindler.id, clutcher.id);
      if (!r.ok) breedFails[r.why] = (breedFails[r.why] || 0) + 1;
      else breedLog.push(`gen${kindler.generation || 0}+gen${clutcher.generation || 0} -> gen${r.egg.generation}`);
    } else breedFails['no eligible pair'] = (breedFails['no eligible pair'] || 0) + 1;
  }
  // A real player culls the Broodwell rather than letting it jam full.
  if (state.roster.length > 18) {
    const spare = state.roster.filter(d => !state.party.includes(d.id) && !(d.generation > 0))
      .sort((a, b) => a.level - b.level).slice(0, Math.max(0, state.roster.length - 16));
    for (const d of spare) {
      const i = state.roster.indexOf(d);
      if (i >= 0) { if ((d.generation || 0) > 0) culledBred++; state.roster.splice(i, 1); }
    }
  }
  // Fill the party from the roster, keeping a bred dragon in it so it grows.
  // Raise the young stock: a bred hatchling is only worth anything once it
  // has been carried to Drake, so it goes in the party ahead of a veteran.
  const bredSpare = state.roster.filter(d => (d.generation || 0) > 0 && !state.party.includes(d.id) && !d.fainted)
    .sort((a, b) => a.level - b.level || (b.generation || 0) - (a.generation || 0))[0];
  const youngBred = partyDragons().filter(d => (d.generation || 0) > 0 && d.level < 14).length;
  if (bredSpare && state.party.length >= 3 && youngBred < 2) state.party.pop();
  if (bredSpare && state.party.length < 3) state.party.push(bredSpare.id);
  while (state.party.length < 3) {
    const next = state.roster.find(d => !state.party.includes(d.id) && !d.fainted);
    if (!next) break;
    state.party.push(next.id);
  }

  const goal = main.goal;
  if (goal.kind === 'reach') { if (!goTo(goal.node)) break; checkQuests(); continue; }
  if (goal.kind === 'boss') {
    const bossNode = Object.values(NODES).find(n => n.boss === goal.bossId);
    if (state.node !== bossNode.id && !goTo(bossNode.id)) break;
    // level up a bit first if badly under
    const bossLevel = { cinderfang: 11, morvaleth: 22, kessa: 33, ythrax: 42, vaelorax: 52 }[goal.bossId];
    if (adv.partyLevel() < bossLevel - 2) { grind(6); continue; }
    pickPartyFor(goal.bossId);
    const r = adv.startBossBattle(goal.bossId);
    if (!r.ok) break;
    const b = r.battle;
    let g2 = 0;
    while (b.state === 'input' && g2++ < 70) {
      for (const a of b.living(SIDE.ALLY)) {
        const opts = b.availableMoves(a).filter(o => o.usable && o.move.kind !== 'support');
        const foe = b.living(SIDE.ENEMY)[0];
        const scored = opts.map(o => ({ o, v: (o.move.power || 0) * (o.move.element ? elementMultiplier(o.move.element, foe.elements) : 1) }));
        const pick = scored.sort((x, y) => y.v - x.v)[0];
        if (pick) b.setCommand(a.id, { type: pick.o.move.mp ? 'skill' : 'strike', moveId: pick.o.move.id, targetId: foe.id });
        else b.setCommand(a.id, { type: 'guard' });
      }
      if (b.surge >= 100) { const a = b.living(SIDE.ALLY)[0]; if (a) b.setCommand(a.id, { type: 'surge', targetId: b.living(SIDE.ENEMY)[0]?.id }); }
      const hurt = b.living(SIDE.ALLY).find(a => a.hp < maxHp(a) * 0.4);
      const salve = ['full_salve','wardens_salve','greater_salve','ember_salve'].find(i => state.inventory[i]);
      if (hurt && salve) { b.setWardenCommand({ type: 'item', itemId: salve, targetId: hurt.id }); state.inventory[salve]--; }
      b.resolveRound();
    }
    const rep = adv.finishBattle();
    battles++;
    if (!rep.won) { adv.handleDefeat(); grind(8); }
    checkQuests();
    continue;
  }
  // everything else: go fight things
  grind(4);
  if (battles > maxBattles) { log.push('  !! battle budget exhausted'); break; }
}

/** Field the three dragons whose kit actually hurts this boss. */
function pickPartyFor(bossId) {
  const spec = BOSSES[bossId];
  if (!spec) return;
  const score = d => {
    let best = 0;
    for (const id of d.moves) {
      const m = MOVES[id];
      if (!m || m.kind === 'support') continue;
      const absorbed = (spec.traits || []).includes('forgeheart') && m.element === 'ember';
      const mult = m.element ? elementMultiplier(m.element, spec.elements) : 1;
      best = Math.max(best, absorbed ? -1 : (m.power || 0) * mult);
    }
    return best * (0.6 + d.level / 100);
  };
  const ranked = state.roster.filter(d => !d.fainted && d.stage !== 'egg').sort((a, b) => score(b) - score(a));
  state.party = ranked.slice(0, 3).map(d => d.id);
}

function grind(n) {
  for (let i = 0; i < n; i++) {
    if (battles > maxBattles) return;
    const wildNodes = neighbours(state.node).concat([state.node])
      .filter(id => ['wild', 'roost', 'landmark'].includes(NODES[id].kind) && (NODES[id].act || 1) <= state.act);
    const target = wildNodes[0];
    if (target && target !== state.node) adv.travelTo(target);
    const ev = adv.explore(state.node);
    if (ev.kind === 'battle') { fight(ev.encounter, { tryBind: state.roster.length < 24 }); battles++; }
    else if (ev.kind === 'vignette') adv.resolveVignette(ev.vignette, 0);
    if (partyDragons().some(d => d.hp < maxHp(d) * 0.35)) {
      if (NODES[state.node].services?.includes('rest') || NODES[state.node].home) adv.rest();
      else { const back = neighbours(state.node).find(id => NODES[id].services?.includes('rest')); if (back) { adv.travelTo(back); adv.rest(); } }
    }
    checkQuests();
  }
}

console.log(log.join('\n'));
console.log('\n=== RESULT ===');
console.log('act', state.act, 'main step', state.quests.mainStep, '/', MAIN_CHAIN.length);
console.log('battles', battles, 'roster', state.roster.length, 'bred', state.stats.bred, 'hatched', state.stats.hatched, 'captures', state.stats.captures);
console.log('party', partyDragons().map(d => `${d.name} L${d.level} ${d.stage} ${d.lineageId} gen${d.generation}`).join(' | '));
console.log('coin', state.coin, 'rank', wardenRank().name, 'quests done', state.quests.done.length);
console.log('lineages held', [...new Set(state.roster.map(d => d.lineageId))].join(', '));
console.log('endings available', JSON.stringify(endingAvailability()));
console.log('culled bred', culledBred);
console.log('breed fails', breedFails);
console.log('breed log', breedLog.slice(-8).join(' | '));
console.log('roster gens', state.roster.map(d=>`${d.name} L${d.level} b${d.bond} ${d.broodRole} gen${d.generation||0}`).join(', '));
console.log('counters', JSON.stringify(state.quests.counters.captures));
const stuck = activeEntries().map(e => { const q = questFor(e); return q ? `${q.title}: ${JSON.stringify(progressOf(e))}` : e.id; });
console.log('open quests:', stuck.join(' | '));
if (state.quests.mainStep >= MAIN_CHAIN.length) {
  const r = chooseEnding('unbind');
  console.log('ending chosen:', r, '->', state.ending);
}
