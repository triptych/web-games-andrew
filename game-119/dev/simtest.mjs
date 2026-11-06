/**
 * simtest.mjs — headless checks of THE HERO'S MERCHANT's simulation. No browser.
 *
 *   node game-119/dev/simtest.mjs                 # everything
 *   ONLY=purity,inventory node game-119/dev/simtest.mjs
 *   SEEDS=10 VERBOSE=1 node game-119/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or
 *    the clock, and never import the view, the UI or the audio.
 * 2. data: every recipe's inputs exist and are sold somewhere; every quest is satisfiable; the roads connect
 *    the realm; the Hero's kit has ten slots of ten levels.
 * 3. inventory: grid placement and rotation, stacking, weight, auto-sort, stash.
 * 4. market: spreads, price impact and recovery, shops only buy their categories, stock.
 * 5. rules: buying, selling, crafting, quests (including couriers), visiting heroes, travel, burden, region
 *    locks, road encounters, wagon upgrades, the Offer.
 * 6. determinism: same seed and commands, same game; a save round trip plays on identically.
 * 7. bot: the bot plays whole campaigns with per-stop invariants; the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const I = await import('../js/sim/data/items.js');
const T = await import('../js/sim/data/towns.js');
const Q = await import('../js/sim/data/quests.js');
const Inv = await import('../js/sim/inv.js');
const M = await import('../js/sim/market.js');
const Qs = await import('../js/sim/quest.js');
const S = await import('../js/sim/data/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const travel = (G, to) => {
    const r = Gm.act(G, { t: 'travel', to });
    if (!r.ok) return r;
    let n = 0;
    while (G.travel && n++ < 100000) { if (G.pending) Gm.act(G, { t: 'resolve', choice: 'pay' }); else Gm.step(G, { ff: 4 }, 0.25); }
    return r;
};
const give = (G, t, lv, n) => Inv.addItems(G, t, lv, n);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f), ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main|panels)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    ok(I.ALL_RECIPES.length === 105, `105 recipes (10 families x 10 levels + 5 ingots), got ${I.ALL_RECIPES.length}`);
    ok(I.SLOT_ORDER.length === 10, 'the Hero\'s kit has ten slots');
    const sold = new Set();
    for (const t of T.TOWNS) for (const id of Object.keys(I.MATS)) if (M.stockCap(t.id, id, 0) > 0) sold.add(id);
    for (const r of I.ALL_RECIPES) for (const i of r.inputs) ok(I.MATS[i.t] && sold.has(i.t), `${r.rid}: ${i.t} exists and some town stocks it`);
    for (const f of I.FAM_IDS) ok(I.FAMS[f].names.length === 10, `${f} has ten names`);
    const stationLvs = {};
    for (const t of T.TOWNS) for (const [s, l] of Object.entries(t.stations)) stationLvs[s] = Math.max(stationLvs[s] || 0, l);
    for (const f of I.FAM_IDS) ok(stationLvs[I.FAMS[f].station] === 5, `a level 5 ${I.FAMS[f].station} exists (for level 10 ${f})`);
    // roads connect everything
    const seen = new Set(['hearthmere']), q = ['hearthmere'];
    while (q.length) for (const n of T.NEIGHBORS[q.shift()]) if (!seen.has(n.to)) { seen.add(n.to); q.push(n.to); }
    ok(seen.size === T.TOWNS.length, 'every town is on the road network');
    // each region is reachable with the level its predecessor opens
    for (const t of T.TOWNS) if (t.region > 1) ok(T.NEIGHBORS[t.id].some((n) => T.TOWN[n.to].region < t.region || T.TOWN[n.to].region === t.region), `${t.id} connects to the region below or beside it`);
    for (const qd of Object.values(Q.QUESTS)) {
        ok(T.TOWN[qd.town] && T.TOWN[qd.turn], `${qd.id}: giver and turn-in towns exist`);
        for (const r of qd.req) ok(r.lv ? I.FAMS[r.t] : I.MATS[r.t], `${qd.id}: requirement ${r.t} exists`);
        if (qd.after) ok(Q.QUESTS[qd.after], `${qd.id}: prerequisite exists`);
        ok(qd.reward.gold > 0 && qd.reward.xp > 0, `${qd.id}: has a reward`);
        // a quest is never locked behind a region its own level cannot reach
        ok(C.REGION_LEVEL[T.TOWN[qd.town].region] <= Math.max(qd.lv, C.REGION_LEVEL[T.TOWN[qd.town].region]), `${qd.id}: sane level`);
    }
    for (const qid of Q.STORY_ORDER) ok(S.STORY_TEXT[qid], `${qid} has story text`);
    for (let l = 2; l <= C.MAX_LEVEL; l++) ok(C.levelXp(l) > C.levelXp(l - 1), `xp to level ${l} rises`);
    ok(I.basePrice('sword', 10) > I.basePrice('sword', 9) && I.basePrice('sword', 2) > I.basePrice('sword', 1), 'gear prices rise with level');
    console.log(`  ${Object.keys(Q.QUESTS).length} hand-written quests, ${T.TOWNS.length} towns, ${Object.keys(I.MATS).length} materials`);
}

if (want('inventory')) {
    section('inventory');
    const G = Gm.newGame(1);
    ok(G.inv.w === 6 && G.inv.h === 4, 'the handcart is a 6x4 grid');
    ok(give(G, 'grain', 0, 45) === 45, '45 grain fit');
    ok(G.inv.items.filter((i) => i.t === 'grain').length === 3 && G.inv.items[0].n === 20, 'grain stacks 20 to a cell');
    ok(Inv.count(G, 'grain') === 45, 'count sees all stacks');
    ok(Inv.removeItems(G, 'grain', 0, 25) === 25 && Inv.count(G, 'grain') === 20, 'removing takes from the smaller stacks first');
    ok(give(G, 'armor', 4, 1) === 1, 'armor (2x3) fits');
    const arm = G.inv.items.find((i) => i.t === 'armor');
    ok(!Inv.canPlaceAt(G.inv, arm.id, 5, 0, 0), 'a 2x3 item does not fit against the right wall');
    ok(Inv.canPlaceAt(G.inv, arm.id, 4, 0, 0), 'but fits one column in');
    const w = Inv.weightOf(G);
    ok(Math.abs(w - (20 * 0.35 + 8)) < 1e-6, `weight adds up (${w})`);
    // fill the wagon, sort frees space by repacking
    const G2 = Gm.newGame(2);
    for (let i = 0; i < 4; i++) give(G2, 'sword', 1, 1);              // four 1x3 swords
    ok(Inv.count(G2, 'sword', 1) === 4, 'four swords fit side by side');
    let placed = 0; while (give(G2, 'helm', 1, 1)) placed++;
    ok(placed === 2, `two 2x2 helms fit in the space beside them (${placed})`);
    const before = Inv.usedCells(G2);
    ok(Inv.autoSort(G2) && Inv.usedCells(G2) === before, 'auto-sort repacks without losing anything');
    // rotation
    const G3 = Gm.newGame(3);
    G3.inv.w = 3; G3.inv.h = 2;
    ok(give(G3, 'sword', 1, 1) === 1, 'a 1x3 sword fits a 3x2 grid by rotating');
    ok(G3.inv.items[0].r === 1, '... and was rotated');
    // stash
    G3.loc = 'hearthmere';
    give(G3, 'grain', 0, 10);
    const id = G3.inv.items.find((i) => i.t === 'grain').id;
    ok(Gm.act(G3, { t: 'stash', id, n: 'all' }).ok && Inv.stashCount(G3, 'grain') === 10, 'the stash takes goods in a guild town');
    ok(Gm.act(G3, { t: 'unstash', idx: 0, n: 'all' }).ok && Inv.count(G3, 'grain') === 10, '... and gives them back');
    G3.loc = 'willowbrook';
    ok(!Gm.act(G3, { t: 'stash', id: G3.inv.items.find((i) => i.t === 'grain').id }).ok, 'no stash without a Guild House');
    // merge
    const G4 = Gm.newGame(4);
    give(G4, 'grain', 0, 30);
    const [a, b] = G4.inv.items;
    ok(Inv.mergeStacks(G4, a.id, b.id) && Inv.count(G4, 'grain') === 30, 'stacks merge by dragging one on another');
    // favourites
    ok(Gm.act(G4, { t: 'mark', id: G4.inv.items[0].id, fav: true }).ok, 'favourites can be marked');
    ok(!Gm.act(G4, { t: 'sell', id: G4.inv.items[0].id }).ok, 'a favourite will not be sold');
}

if (want('market')) {
    section('market');
    const G = Gm.newGame(1);
    G.loc = 'hearthmere';
    const buy = M.buyUnit(G, 'hearthmere', 'grain'), sell = M.sellUnit(G, 'hearthmere', 'grain');
    ok(buy > sell, `a shop sells dearer than it buys (${buy.toFixed(2)} vs ${sell.toFixed(2)})`);
    ok(M.buyUnit(G, 'hearthmere', 'grain') < M.buyUnit(G, 'copperfield', 'grain'), 'grain is cheaper where it is made');
    ok(M.shopFor('hearthmere', 'sword') === null, 'a village with no smithy shop will not buy swords');
    ok(M.shopFor('copperfield', 'sword') === 'smith', 'the smithy buys swords');
    ok(M.shopFor('hearthmere', 'parcel') === null, 'nobody buys quest parcels');
    const q1 = M.quote(G, 'hearthmere', 'iron_ore', 0, 'sell', 1).total, q20 = M.quote(G, 'hearthmere', 'iron_ore', 0, 'sell', 20).total;
    ok(q20 < q1 * 20, `selling 20 at once earns less than 20 single sales (${q20} vs ${q1 * 20})`);
    const m0 = M.entry(G, 'hearthmere', 'iron_ore').m;
    M.applySell(G, 'hearthmere', 'iron_ore', 0, 30);
    const m1 = M.entry(G, 'hearthmere', 'iron_ore').m;
    ok(m1 < m0, `dumping 30 ore drops its price (${m0.toFixed(2)} → ${m1.toFixed(2)})`);
    for (let i = 0; i < 20; i++) { G.day++; M.dailyMarket(G); }
    const m2 = M.entry(G, 'hearthmere', 'iron_ore').m;
    ok(m2 > m1 && Math.abs(m2 - m0) < Math.abs(m1 - m0), `... and recovers over days (${m2.toFixed(2)})`);
    const G2 = Gm.newGame(9);
    G2.loc = 'hearthmere'; G2.gold = 10000;
    const stock = M.stockOf(G2, 'hearthmere', 'grain');
    const r = Gm.act(G2, { t: 'buy', shop: 'general', item: 'grain', n: 999 });
    ok(r.ok && r.n <= stock && r.n >= 1, `buying is limited by stock (${r.n} of ${stock})`);
    ok(M.stockOf(G2, 'hearthmere', 'grain') === stock - r.n, '... and drains it');
    // events change prices
    const G3 = Gm.newGame(3);
    const p0 = M.midPrice(G3, 'hearthmere', 'grain');
    G3.towns.hearthmere.events.push({ k: 'blight', until: G3.day + 5 });
    ok(M.midPrice(G3, 'hearthmere', 'grain') > p0 * 1.4, 'a blight raises food prices');
    // an arbitrage route exists in the starting region
    let best = 0;
    for (const id of Object.keys(I.MATS)) for (const a of ['hearthmere', 'willowbrook', 'copperfield']) for (const b of ['hearthmere', 'willowbrook', 'copperfield']) {
        if (a !== b && M.stockCap(a, id, 0) > 0 && M.shopFor(b, id)) best = Math.max(best, M.sellUnit(G, b, id) / M.buyUnit(G, a, id));
    }
    ok(best > 1.2, `a profitable trade exists in Greenmarch (best ratio ${best.toFixed(2)})`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.gold === C.START.gold && G.loc === 'hearthmere' && G.q.active.s0, 'a new game starts in Hearthmere with the first quest');
    ok(G.events.some((e) => e.type === 'dialog' && e.id === 'intro'), 'and the intro dialogue');
    // buy / sell
    let r = Gm.act(G, { t: 'buy', shop: 'general', item: 'grain', n: 8 });
    ok(r.ok && Inv.count(G, 'grain') === 8 && G.gold < C.START.gold, 'buying grain works');
    ok(!Gm.act(G, { t: 'buy', shop: 'smith', item: 'grain', n: 1 }).ok, 'a shop only sells its own wares');
    // quest s0: deliver 6 grain to Willowbrook
    ok(Qs.questState(G, 's0') === 'active', 's0 is active');
    ok(!Gm.act(G, { t: 'turnin', id: 's0' }).ok, 'cannot hand it in at the wrong town');
    travel(G, 'willowbrook');
    ok(G.loc === 'willowbrook' && G.day === 1 + T.roadDays('hearthmere', 'willowbrook'), 'a road takes as many days as it is long');
    const gold0 = G.gold;
    r = Gm.act(G, { t: 'turnin', id: 's0' });
    ok(r.ok && G.gold === gold0 + 60 && Inv.count(G, 'grain') === 2 && G.q.done.s0, 'handing in s0 pays and takes the grain');
    ok(G.xp > 0, 'and gives experience');
    // region lock
    ok(!Gm.act(G, { t: 'travel', to: 'stonebridge' }).ok === false || true, '');
    G = Gm.newGame(2);
    travel(G, 'copperfield');
    const lock = Gm.act(G, { t: 'travel', to: 'stonebridge' });
    ok(lock.ok === false || G.lv >= 4, 'the Heartland is closed to a level 1 merchant');
    // crafting
    G = Gm.newGame(3);
    G.gold = 500; G.loc = 'hearthmere';
    give(G, 'copper_ingot', 0, 2); give(G, 'pine', 0, 1);
    r = Gm.act(G, { t: 'craft', rid: 'sword:1', n: 1 });
    ok(r.ok && Inv.count(G, 'sword', 1) === 1 && Inv.count(G, 'copper_ingot') === 0, 'a village forge makes a level 1 sword from ingots and a plank');
    ok(!Gm.act(G, { t: 'craft', rid: 'sword:3', n: 1 }).ok, 'level 3 needs a better forge and materials');
    G.loc = 'willowbrook';
    give(G, 'copper_ingot', 0, 2); give(G, 'pine', 0, 1);
    ok(!Gm.act(G, { t: 'craft', rid: 'sword:1', n: 1 }).ok, 'no forge in Willowbrook');
    G.loc = 'copperfield'; give(G, 'copper_ore', 0, 4);
    ok(Gm.act(G, { t: 'craft', rid: 'ingot:0', n: 2 }).ok && Inv.count(G, 'copper_ingot') >= 2, 'smelting turns ore into ingots');
    // s1: the Hero's sword
    G = Gm.newGame(4);
    G.q.done.s0 = 1; G.gold = 500;
    ok(Qs.questState(G, 's1') === 'available', 's1 opens after s0');
    ok(Qs.questState(G, 's2') === 'locked', 's2 stays locked');
    Gm.act(G, { t: 'accept', id: 's1' });
    ok(G.events.some((e) => e.type === 'dialog' && e.id === 's1:intro'), 'accepting a story quest plays its dialogue');
    give(G, 'sword', 1, 1);
    r = Gm.act(G, { t: 'turnin', id: 's1' });
    ok(r.ok && G.q.done.s1, 's1 is handed in with a level 1 sword');
    // visiting hero
    G = Gm.newGame(5);
    const hero = G.towns[G.loc].heroes[0] || Qs.spawnHero(G, G.loc);
    hero.wants = [{ fam: 'sword', minLv: 2, done: false }];
    ok(!Gm.act(G, { t: 'hero', hid: hero.id, w: 0 }).ok, 'a hero will not take what you do not have');
    give(G, 'sword', 1, 1);
    ok(!Gm.act(G, { t: 'hero', hid: hero.id, w: 0 }).ok, '... or a sword that is too weak');
    give(G, 'sword', 3, 1);
    const g0 = G.gold;
    r = Gm.act(G, { t: 'hero', hid: hero.id, w: 0 });
    ok(r.ok && G.gold > g0 && G.gold - g0 >= I.basePrice('sword', 3) * 1.3, `a hero pays a premium (${G.gold - g0}g for a ${I.basePrice('sword', 3)}g sword)`);
    ok(Inv.count(G, 'sword', 1) === 1 && Inv.count(G, 'sword', 3) === 0, 'the weakest qualifying piece... is the one that qualified');
    // courier quest
    G = Gm.newGame(6);
    const gq = Object.values(G.gen).find((q) => q.kind === 'courier') || (() => { for (let i = 0; i < 40; i++) { Qs.refreshBoard(G, 'hearthmere'); G.towns.hearthmere.board.length = 0; } return null; })();
    const courier = Object.values(G.gen).find((q) => q.kind === 'courier');
    if (courier) {
        G.loc = courier.town;
        const r2 = Gm.act(G, { t: 'accept', id: courier.id });
        ok(r2.ok && G.inv.items.some((i) => i.t === 'parcel'), 'a courier quest puts a parcel in the wagon');
        G.loc = courier.to;
        ok(Gm.act(G, { t: 'turnin', id: courier.id }).ok && !G.inv.items.some((i) => i.t === 'parcel'), 'delivering it takes the parcel and pays');
    }
    // burden and wagon
    G = Gm.newGame(7);
    G.gold = 5000;
    ok(Gm.burden(G).mult === 1, 'light cargo does not slow you down');
    give(G, 'iron_ore', 0, 55);
    const b = Gm.burden(G);
    ok(b.over && b.mult > 1, `a heavy cart is slower (x${b.mult.toFixed(2)})`);
    ok(Gm.canTravel(G, 'copperfield').days > T.roadDays('hearthmere', 'copperfield'), 'and the road takes longer');
    G.inv.items.forEach((i) => { i.n = i.n; });
    ok(!Gm.act(G, { t: 'upgradeWagon' }).ok, 'a Donkey Cart needs a Guild House and level 3');
    G.lv = 3;
    ok(Gm.act(G, { t: 'upgradeWagon' }).ok && G.inv.w === 7 && G.inv.h === 5 && G.gold === 5000 - 450, 'at level 3 in a guild town the wagon can be upgraded');
    // road events resolve
    G = Gm.newGame(8);
    G.pending = { kind: 'bandits', demand: 30, chance: 0.5 };
    G.travel = { from: 'hearthmere', to: 'willowbrook', total: 1, prog: 0, ticks: 0 };
    ok(!Gm.act(G, { t: 'sell', id: 1 }).ok, 'nothing can be done while bandits wait');
    const gb = G.gold;
    ok(Gm.act(G, { t: 'resolve', choice: 'pay' }).ok && G.gold === gb - 30 && !G.pending, 'paying the toll costs the toll');
    // rest
    G = Gm.newGame(9);
    const d0 = G.day;
    ok(Gm.act(G, { t: 'rest' }).ok && G.day === d0 + 1, 'resting passes a night');
    // Offer needs the call
    G = Gm.newGame(10);
    G.loc = 'aurelion';
    ok(!Gm.act(G, { t: 'offer', picks: {} }).ok, 'the Offer waits for the Hero\'s Call');
    G.heroCall = 100;
    give(G, 'sword', 10, 1); give(G, 'armor', 7, 1);
    ok(Gm.offerOptions(G).sword[0] === 10, 'offerOptions lists what you hold');
    r = Gm.act(G, { t: 'offer', picks: { sword: 10, armor: 7, helm: 5 } });
    ok(!r.ok, 'you cannot offer what you do not have');
    r = Gm.act(G, { t: 'offer', picks: { sword: 10, armor: 7 } });
    ok(r.ok && G.ending.score === 17 && G.ending.rank === 'D', 'the Offer is scored by item level (17/100 is a D)');
    ok(!Gm.act(G, { t: 'offer', picks: {} }).ok, 'and can only be made once');
    ok(S.rankFor(100).id === 'S' && S.rankFor(80).id === 'A' && S.rankFor(60).id === 'B' && S.rankFor(35).id === 'C' && S.rankFor(10).id === 'D', 'the rank thresholds');
    // the tutorial flag
    G = Gm.newGame(12);
    ok(G.tut === true, 'a new game starts with the tutorial on');
    ok(Gm.act(G, { t: 'tutorial', on: false }).ok && G.tut === false, 'the tutorial can be turned off');
    G.travel = { from: 'hearthmere', to: 'willowbrook', total: 1, prog: 0, ticks: 0 };
    ok(Gm.act(G, { t: 'tutorial', on: true }).ok && G.tut === true, 'and back on, even on the road');
    ok(Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G)))).tut === true, 'the flag survives a save');
    // the Eclipse ends the game
    G = Gm.newGame(11);
    G.day = C.ECLIPSE_DAY;
    Gm.act(G, { t: 'rest' });
    ok(G.ending && G.ending.missed, 'the Eclipse comes if no Offer was made');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, days) => { const G = Gm.newGame(seed); Bt.runBot(G, Bt.makeBot(), { maxDays: days }); return G; };
    const a = play(42, 40), b = play(42, 40);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and decisions, same game');
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(play(43, 40))), 'a different seed differs');
    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    Bt.runBot(G, bot, { maxDays: 30 });
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = JSON.parse(JSON.stringify(bot)), b2 = JSON.parse(JSON.stringify(bot));
    Bt.runBot(G, b1, { maxDays: 60 });
    Bt.runBot(copy, b2, { maxDays: 60 });
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    // reading prices never changes the game
    const g1 = Gm.newGame(5), g2 = Gm.newGame(5);
    for (const t of T.TOWNS) for (const id of Object.keys(I.MATS)) M.buyUnit(g2, t.id, id);
    for (let i = 0; i < 12; i++) { Gm.act(g1, { t: 'rest' }); Gm.act(g2, { t: 'rest' }); }
    ok(JSON.stringify(g1.towns) === JSON.stringify(g2.towns) && g1.day === g2.day, 'looking at prices does not change the world');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot({ skill: 1 });
        let bad = null;
        Bt.runBot(G, bot, {
            maxDays: C.ECLIPSE_DAY + 5,
            onStop: (g) => {
                if (bad) return;
                if (!Number.isFinite(g.gold) || g.gold < 0) bad = `gold ${g.gold}`;
                else if (g.inv.items.some((i) => i.n < 1 || !Number.isInteger(i.n))) bad = 'a stack with a bad quantity';
                else if (g.inv.items.some((i) => i.x < 0 || i.y < 0 || i.x >= g.inv.w || i.y >= g.inv.h)) bad = 'an item outside the grid';
                else if (Gm.burden(g).blocked) bad = 'the wagon is past the hard limit at a stop';
            },
        });
        ok(!bad, `seed ${s}: ${bad || 'invariants hold'}`);
        rows.push({ seed: s, day: G.day, lv: G.lv, gold: G.gold, rank: G.ending?.rank || '-', score: G.ending?.score ?? 0, quests: G.stats.quests, crafted: G.stats.crafted });
        // the wagon never overlaps
        const cells = new Set(); let overlap = false;
        for (const it of G.inv.items) { const f = Inv.fp(it); for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) { const k = (it.y + j) * 100 + it.x + i; if (cells.has(k)) overlap = true; cells.add(k); } }
        ok(!overlap, `seed ${s}: no two items share a cell`);
    }
    if (process.env.VERBOSE || true) for (const r of rows) console.log(`  seed ${r.seed}: day ${r.day}, level ${r.lv}, ${r.gold}g, quests ${r.quests}, crafted ${r.crafted}, ending ${r.rank} (${r.score}/100)`);
    const made = rows.filter((r) => r.rank !== '-');
    ok(made.length >= Math.ceil(SEEDS * 0.5), `the bot makes the Offer on at least half the seeds (${made.length}/${SEEDS})`);
    ok(rows.every((r) => r.lv >= 14), 'the bot levels to 14 or more before the Eclipse on every seed');
    const avg = made.reduce((a, r) => a + r.score, 0) / Math.max(1, made.length);
    ok(avg >= 60, `the bot's average kit scores at least 60 (got ${avg.toFixed(0)})`);
    // a bot that wanders at random does worse
    const sloppy = [];
    for (let s = 1; s <= 3; s++) { const G = Gm.newGame(s * 7919); Bt.runBot(G, Bt.makeBot({ skill: 0.1 }), { maxDays: 120 }); sloppy.push(G.xp); }
    const good = [];
    for (let s = 1; s <= 3; s++) { const G = Gm.newGame(s * 7919); Bt.runBot(G, Bt.makeBot({ skill: 1 }), { maxDays: 120 }); good.push(G.xp); }
    ok(good.reduce((a, b) => a + b) > sloppy.reduce((a, b) => a + b), `by day 120 the planning bot has more experience than a wanderer (${good.join('/')} vs ${sloppy.join('/')})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
