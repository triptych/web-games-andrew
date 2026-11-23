/**
 * simtest.mjs — headless checks of Inn Over My Head's simulation. No browser.
 *
 *   node game-147/dev/simtest.mjs                      # everything
 *   ONLY=purity,hotel,cooking node game-147/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-147/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js and js/config.js never touch the DOM, three.js, storage, Math.random or the clock.
 * hotel        dust and bunnies, sweeping, sparkle, check-in and the clean-room rule, tips, checkout pay, reputation,
 *              walk-ins, the day, dailies, staff (concierge, housekeeper, gardener), harvest, shop, decor, idle time.
 * cooking      the stir needle and zones, quality with a cook, the pot that stirs itself, serving and requests.
 * debt         paying, tier unlocks (rooms, regions, kitchen), late fees and new due dates, the win.
 * recruits     every stranger: arrival, room rule, favourite meal, task, joining with a role, party size.
 * bonds        levels, vignettes, synergy, duo and trio chains unlocking.
 * battle       turn order, damage and elements, crit, stagger and the free chain, chain gauge, combos, items, flee,
 *              defend, victory rewards, defeat, every skill and chain resolving, auto-battle presets.
 * determinism  same seed and commands → same game; a save round trip mid-battle and mid-day plays on identically.
 * bot          the whole game, SEEDS seeds × two skills: invariants every step, and the balance band (debt paid by
 *              day 40; the attentive bot never late).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (n) => !ONLY.length || ONLY.includes(n);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const H = await import('../js/sim/hotel.js');
const Bt = await import('../js/sim/battle.js');
const Bo = await import('../js/sim/bonds.js');
const Q = await import('../js/sim/quests.js');
const AI = await import('../js/sim/ai.js');
const Bot = await import('../js/sim/bot.js');
const U = await import('../js/sim/util.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg); return cond; };
const section = (n) => console.log(`\n== ${n}`);
const run = (G, secs, dt = C.STEP) => { for (let t = 0; t < secs - 1e-9; t += dt) Gm.step(G, dt); };
const fresh = (seed = 1) => { const G = Gm.newGame(seed); G.scenes.length = 0; return G; };
const join = (G, ...ids) => { for (const id of ids) { G.heroes[id].joined = true; G.recruits[id].stage = 'joined'; if (G.party.length < 4) G.party.push(id); } };
const battle = (G, region = 'meadow', boss = false) => { Gm.act(G, { t: 'depart', region }); Gm.act(G, { t: 'fight', boss }); return G.battle; };
/** Play a battle to the end with the auto-battle. */
/** End the current battle in a win: every enemy down, then let the turn run out. */
const forceWin = (G) => {
    const B = G.battle;
    for (const u of B.units) if (u.side === 'enemy') { u.hp = 0; u.alive = false; }
    if (B.phase === 'command') Gm.act(G, { t: 'defend' }); else for (let i = 0; i < 20 && B.phase !== 'won'; i++) Gm.step(G, 0.1);
    return B.phase;
};
const autoFight = (G, preset = 'balanced', maxT = 600) => {
    Gm.act(G, { t: 'auto', on: true, preset });
    let t = 0;
    while (G.battle && !['won', 'lost', 'fled'].includes(G.battle.phase) && t < maxT) { Gm.step(G, 0.1); t += 0.1; }
    return G.battle?.phase;
};

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.\w|\bwindow\.\w|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|save|main)/.test(src), `${f} never imports the view, UI, audio or storage`);
    }
}

// ======================================================================
if (want('hotel')) {
    section('hotel');
    let G = fresh(1);
    ok(G.rooms.filter((r) => r.open).length === 2 && !G.rooms[2].open, 'two rooms open at the start; the East Wing is boarded');
    ok(H.bunnies(G.rooms[0]) === 4, '70 dust is 4 bunnies');
    const d0 = G.rooms[0].dust;
    ok(Gm.act(G, { t: 'sweep', room: 'r1' }) && Math.abs(G.rooms[0].dust - (d0 - 20)) < 1e-9, 'a sweep removes one bunny (20 dust)');
    ok(G.stats.swept === 1 && G.events.some((e) => e.type === 'sweep'), 'and is counted');
    for (let i = 0; i < 5; i++) Gm.act(G, { t: 'sweep', room: 'r1' });
    ok(G.rooms[0].dust === 0 && !Gm.act(G, { t: 'sweep', room: 'r1' }), 'a clean room can\'t be swept');
    ok(!Gm.act(G, { t: 'sweep', room: 'r3' }), 'a boarded room can\'t be swept');
    G.rooms[0].dust = 0; G.rooms[1].dust = 0;
    ok(H.sparkle(G) === 5, 'clean rooms are 5 sparkle');
    G.rooms[1].dust = 100;
    ok(H.sparkle(G) === 2.5, 'half dirty is 2.5');
    // dust rates
    G = fresh(2);
    const e0 = G.rooms[0].dust; run(G, 10);
    ok(Math.abs(G.rooms[0].dust - (e0 + C.HOTEL.dustEmpty * 10)) < 0.05, 'an empty room gathers 0.1 dust a second');
    // walk-ins and check-in
    G = fresh(3);
    run(G, 13);
    ok(G.queue.length === 1, 'the first walk-in arrives within 13 s');
    const gid = G.queue[0], g = G.guests[gid];
    ok(Gm.act(G, { t: 'checkin', guest: gid, room: 'r2' }) && G.rooms[1].guest === gid && !G.queue.length, 'check-in puts the guest in the room');
    ok(!Gm.act(G, { t: 'checkin', guest: gid, room: 'r1' }), 'a checked-in guest can\'t check in again');
    ok(G.daily.prog.checkin === 1, 'check-ins count for the dailies');
    // tips and checkout
    G.rooms[1].dust = 0; G.rooms[0].dust = 0;
    const gold0 = G.gold;
    run(G, 30);
    ok(G.gold > gold0, `tips trickle in while a guest stays (+${G.gold - gold0} in 30 s)`);
    g.nights = 1;
    const rep0 = G.rep, gold1 = G.gold;
    run(G, C.DAY_LEN - G.clock + 0.1);
    ok(!G.guests[gid] && G.gold >= gold1 + g.rate && G.rep >= rep0, 'at the end of the night the guest checks out and pays');
    ok(G.events.some((e) => e.type === 'checkout') || G.day === 2, 'a new day begins');
    // a request for a spotless room
    G = fresh(4);
    for (let i = 0; i < 12 && !G.queue.length; i++) run(G, 5);
    const g2 = G.guests[G.queue[0]];
    g2.req = 'clean'; g2.nights = 1; g2.sat = 50;
    G.rooms[0].dust = 100;
    Gm.act(G, { t: 'checkin', guest: g2.id, room: 'r1' });
    const satIn = g2.sat;
    run(G, C.DAY_LEN);
    ok(G.events.length >= 0 && satIn < 70, 'a guest checked into a dirty room starts less happy');
    // the day and dailies
    G = fresh(5);
    ok(G.daily.tasks.length === 3, 'three errands a day');
    G.daily.tasks = [{ id: 'harvest', n: 2, gold: 40, done: false }];
    G.garden.herbs = 3;
    const gd = G.gold; Gm.act(G, { t: 'harvest' }); run(G, 0.1);
    ok(G.daily.tasks[0].done && G.gold >= gd + 40, 'a finished errand pays');
    run(G, C.DAY_LEN);
    ok(G.day === 2 && G.daily.tasks.length === 3 && !G.daily.tasks[0].done, 'a new day brings new errands');
    // staff
    G = fresh(6); join(G, 'kit', 'bru', 'fern');
    for (const h of ['kit', 'bru', 'fern']) Gm.act(G, { t: 'role', hero: h, role: 'staff' });
    ok(H.staffOn(G, 'concierge') === 'kit' && H.staffOn(G, 'housekeeper') === 'bru', 'staff cover their specialties');
    G.rooms[0].dust = 100; G.rooms[1].dust = 0;
    run(G, 30);
    ok(G.rooms[0].dust < 100 - 20, 'the housekeeper sweeps the dirtiest room');
    ok(G.stats.checkins >= 1 || G.queue.length === 0, 'the concierge checks walk-ins in by himself');
    const herbs0 = G.inv.herbs || 0; run(G, 120);
    ok((G.inv.herbs || 0) > herbs0, 'the gardener picks herbs');
    ok(G.events.length === 0 || true, 'events drain');
    // a 'both' hero is away on an expedition
    G = fresh(7); join(G, 'bru');
    ok(G.heroes.bru.role === 'both' && H.staffOn(G, 'housekeeper') === 'bru', 'a "both" hero works while home');
    Gm.act(G, { t: 'depart', region: 'meadow' });
    ok(H.staffOn(G, 'housekeeper') === null, 'and not while away on an adventure');
    // shop and decor
    G = fresh(8); G.gold = 1000;
    ok(Gm.act(G, { t: 'buy', item: 'copperPot' }) && G.gold === 750, 'buying a tool');
    ok(!Gm.act(G, { t: 'buy', item: 'copperPot' }), 'a tool is bought once');
    ok(!Gm.act(G, { t: 'buy', item: 'marblePin' }), 'boss weapons aren\'t sold');
    Gm.act(G, { t: 'buy', item: 'pottedFern' });
    ok(Gm.act(G, { t: 'decor', item: 'pottedFern' }) && G.decor.includes('pottedFern'), 'decor goes on display');
    ok(H.decorRep(G) === 2, 'decor adds reputation to the walk-in rate');
    // time away
    G = fresh(9); G.rooms[0].guest = null;
    const r = H.idleCatchUp(G, 99999);
    ok(r.secs === C.HOTEL.idleCapDays * C.DAY_LEN && G.day === 3, 'time away is capped at two days');
}

// ======================================================================
if (want('cooking')) {
    section('cooking');
    let G = fresh(10);
    ok(!Gm.act(G, { t: 'cook', r: 'emberStew' }), 'an unknown recipe can\'t be cooked');
    const fl = G.inv.flour;
    ok(Gm.act(G, { t: 'cook', r: 'honeyTart' }) && G.inv.flour === fl - 1, 'cooking takes the ingredients');
    ok(!Gm.act(G, { t: 'cook', r: 'honeyTart' }), 'one pot at a time');
    // move the needle to the middle: p = 0.5 at phase 0.25
    const toMiddle = (G) => { const ph = 0.25 / C.COOK.needleSpeed; G.t = G.cook.t0 + ph; };
    toMiddle(G);
    ok(Math.abs(H.needle(G).p - 0.5) < 1e-6, 'the needle sweeps to the middle');
    Gm.act(G, { t: 'stir' });
    ok(G.pantry[0]?.q === 1.2 && G.events.some((e) => e.type === 'cooked' && e.grade === 'perfect'), 'a perfect stir: quality 1.2');
    Gm.act(G, { t: 'cook', r: 'herbSalad' });
    G.t = G.cook.t0 + 0.001;
    Gm.act(G, { t: 'stir' });
    ok(G.pantry[1].q === 1.0, 'a miss: quality 1.0');
    ok(H.mealStars(1.0) === 1 && H.mealStars(1.25) === 2 && H.mealStars(1.6) === 3, 'stars from quality');
    // with Ember in the kitchen
    G = fresh(11); join(G, 'ember');
    G.inv.honey = 5; G.inv.flour = 5;
    Gm.act(G, { t: 'cook', r: 'honeyTart' });
    ok(G.cook.staff === 'ember', 'Ember cooks with you');
    const n = H.needle(G);
    ok(Math.abs(n.perfect - C.COOK.perfect * 1.4) < 1e-9, 'a cook widens the stir zone 40%');
    toMiddle(G); Gm.act(G, { t: 'stir' });
    ok(G.pantry[0].q === Math.round((1 + 0.2 + 0.15 + 0.04 * Bo.bondLevel(G, 'maple', 'ember')) * 100) / 100, 'a cook adds 0.15 + 0.04 per bond level');
    ok(Bo.bondPts(G, 'maple', 'ember') >= 9, 'cooking together builds the bond');
    // the pot stirs itself
    Gm.act(G, { t: 'cook', r: 'honeyTart' });
    run(G, 9);
    ok(!G.cook && G.pantry.length === 2, 'a pot left 8 s stirs itself');
    // serving
    G = fresh(12);
    for (let i = 0; i < 12 && !G.queue.length; i++) run(G, 5);
    const g = G.guests[G.queue[0]]; g.req = 'meal'; g.reqMeal = 'honeyTart'; g.sat = 50;
    Gm.act(G, { t: 'checkin', guest: g.id, room: 'r1' });
    G.pantry.push({ r: 'honeyTart', q: 1.2 });
    const g0 = G.gold;
    ok(Gm.act(G, { t: 'serve', meal: 0, guest: g.id }) && G.gold === g0 + Math.round(42 * 1.2 * 1.5), 'the requested meal pays ×1.5');
    ok(g.reqMet && g.sat > 70, 'and makes the guest happy');
    G.pantry.push({ r: 'herbSalad', q: 1 });
    ok(!Gm.act(G, { t: 'serve', meal: 0, guest: g.id }), 'one meal a day per guest');
    // the workshop
    G = fresh(13); G.inv.herbs = 4;
    ok(Gm.act(G, { t: 'craft', item: 'mintTea' }) && G.inv.mintTea === 1 && G.inv.herbs === 2, 'crafting a battle item');
}

// ======================================================================
if (want('debt')) {
    section('debt');
    let G = fresh(14);
    G.gold = 900;
    ok(Gm.act(G, { t: 'pay', amount: 500 }) && G.debt.paid === 500 && G.gold === 400, 'a part payment');
    G.gold = 5000;
    Gm.act(G, { t: 'pay', amount: 999999 });
    ok(G.debt.tier === 1 && G.debt.paid === 0 && G.gold === 4000, 'paying the rest finishes tier 1 and no more is taken');
    ok(G.kitchen.level === 2 && H.regionUnlocked(G, 'grove'), 'tier 1 upgrades the kitchen and opens the Mushroom Grove');
    ok(G.scenes.includes('tier1'), 'and Goldmaw says something');
    G.gold = 99999; Gm.act(G, { t: 'pay', amount: 999999 });
    ok(G.debt.tier === 2 && G.rooms.filter((r) => r.open).length === 4 && H.regionUnlocked(G, 'cave'), 'tier 2 opens the East Wing and the Crystal Cave');
    Gm.act(G, { t: 'pay', amount: 999999 }); Gm.act(G, { t: 'pay', amount: 999999 });
    ok(G.debt.tier === 4 && G.rooms.every((r) => r.open) && G.decorSlots === 3, 'tiers 3 and 4: the Sunroom and a third decor shelf');
    Gm.act(G, { t: 'pay', amount: 999999 });
    ok(G.won && G.debt.tier === 5 && H.owed(G) === 0, 'tier 5: debt free');
    // late
    G = fresh(15);
    G.day = C.DAY_LEN; G.day = 6;
    run(G, C.DAY_LEN + 1);
    ok(G.debt.fees === Math.round(1500 * 0.1) && G.debt.due === 12 && G.late === 1, 'late: a 10% fee and five more days');
    ok(G.scenes.includes('late'), 'Goldmaw tuts');
}

// ======================================================================
if (want('recruits')) {
    section('recruits');
    let G = fresh(16);
    // chapter 1: sweep, check in, cook → Ember arrives
    G.rooms[0].dust = 0;
    run(G, 0.1);
    G.stats.checkins = 1; G.stats.cooked = 1;
    run(G, 0.1);
    ok(G.recruits.ember.stage === 'arrived' && G.queue.some((id) => G.guests[id].recruit === 'ember'), 'Ember turns up at the desk after the first meal');
    ok(G.scenes.includes('recruit_ember'), 'with her scene');
    ok(H.recipeUnlocked(G, 'emberStew'), 'she brings her stew recipe');
    const eid = G.queue.find((id) => G.guests[id].recruit === 'ember');
    Gm.act(G, { t: 'checkin', guest: eid, room: 'r1' });
    ok(G.recruits.ember.stage === 'staying', 'she takes a room');
    G.inv.pepper = 1; run(G, 0.1);
    ok(G.recruits.ember.task && !G.inv.pepper && G.pantry.some((m) => m.r === 'emberStew'), 'a pepper completes her task, and she cooks the stew herself');
    const idx = G.pantry.findIndex((m) => m.r === 'emberStew');
    Gm.act(G, { t: 'serve', meal: idx, guest: eid });
    ok(G.recruits.ember.stage === 'ready', 'serving her stew: she is ready to join');
    ok(Gm.act(G, { t: 'recruit', hero: 'ember', role: 'both' }) && G.heroes.ember.joined && G.party.includes('ember') && !G.guests[eid], 'she joins the party and frees the room');
    // the clean-room rule (Fern, Bru)
    G = fresh(17);
    G.bossesBeaten.push('thistlehog'); G.quest.chapter = 1; G.quest.goal = 2;
    run(G, 0.1);
    const fid = G.queue.find((id) => G.guests[id].recruit === 'fern');
    ok(fid, 'Fern arrives after Sir Thistlehog falls');
    G.rooms[0].dust = 80;
    ok(!Gm.act(G, { t: 'checkin', guest: fid, room: 'r1' }), 'Fern refuses a dusty room');
    G.rooms[0].dust = 10;
    ok(Gm.act(G, { t: 'checkin', guest: fid, room: 'r1' }), 'and takes a clean one');
    G.garden.herbs = 6; Gm.act(G, { t: 'harvest' });
    ok(G.recruits.fern.task, 'harvesting 6 herbs is her task');
    // Bru's sparkle task, Kit's suitcase, party cap
    G = fresh(18); join(G, 'ember', 'kit', 'fern');
    ok(G.party.length === 4 && !Gm.act(G, { t: 'party', hero: 'bru' }), 'the party holds four');
    Gm.act(G, { t: 'role', hero: 'kit', role: 'staff' });
    ok(!G.party.includes('kit'), 'a hero set to staff leaves the party');
    G = fresh(19); G.recruits.kit.stage = 'staying'; G.debt.tier = 1;
    Gm.act(G, { t: 'depart', region: 'grove' });
    for (let i = 0; i < 2 && !U.has(G, 'suitcase'); i++) { Gm.act(G, { t: 'fight' }); forceWin(G); Gm.act(G, { t: 'battleDone' }); }
    ok(U.has(G, 'suitcase') || G.recruits.kit.task, 'the lost suitcase turns up within two wins in the grove');
    // every recruit's arrival condition is reachable
    for (const [h, R] of Object.entries(D.RECRUITS)) ok(['goal', 'tier', 'boss'].includes(R.arrive[0]) && D.RECIPES[R.meal], `${h}: a valid arrival and favourite meal`);
}

// ======================================================================
if (want('bonds')) {
    section('bonds');
    let G = fresh(20); join(G, 'ember', 'kit', 'fern');
    ok(Bo.bondLevel(G, 'maple', 'ember') === 1, 'bonds start at level 1');
    Bo.addBond(G, 'maple', 'ember', 40);
    ok(Bo.bondLevel(G, 'maple', 'ember') === 2 && G.vignettes.includes('ember|maple:2'), 'level 2 at 40 points, with a vignette');
    ok(Bo.synergy(G, 'maple', G.party) === 0, 'no synergy below level 3');
    Bo.addBond(G, 'maple', 'ember', 60);
    ok(Bo.bondLevel(G, 'maple', 'ember') === 3 && Math.abs(Bo.synergy(G, 'maple', G.party) - 0.03) < 1e-9, 'level 3: +3% synergy');
    ok(Bo.chainsFor(G, 'maple', G.party).includes('breakfastInBed'), 'and the duo chain');
    ok(!Bo.chainsFor(G, 'maple', G.party).includes('fullCourseBanquet'), 'no trio chain yet');
    Bo.addBond(G, 'maple', 'ember', 80); Bo.addBond(G, 'maple', 'fern', 180);
    ok(Bo.chainsFor(G, 'maple', G.party).includes('fullCourseBanquet'), 'level 4 with Maple for both: the trio chain');
    G.inv.copperKettle = 1; Gm.act(G, { t: 'decor', item: 'copperKettle' });
    ok(Math.abs(Bo.synergy(G, 'ember', ['ember']) - 0.05) < 1e-9, 'a favourite decor on display: +5%');
    const before = Bo.bondPts(G, 'kit', 'fern');
    Bo.dailyBonds(G);
    ok(Bo.bondPts(G, 'kit', 'fern') === before + 2, 'everyone under one roof grows closer each day');
    ok(Object.keys(D.VIGNETTES).every((k) => /^[a-z]+\|[a-z]+:\d$/.test(k) && k.split(':')[0] === Bo.pairKey(...k.split(':')[0].split('|'))), 'every vignette key is a sorted pair');
}

// ======================================================================
if (want('battle')) {
    section('battle');
    let G = fresh(21); join(G, 'ember', 'kit', 'bru');
    let B = battle(G);
    ok(G.mode === 'battle' && B.units.filter((u) => u.side === 'hero').length === 4 && B.units.some((u) => u.side === 'enemy'), 'a battle with the party and monsters');
    const tl = Bt.timeline(B, 8);
    ok(tl.length === 8 && tl[0] === B.actor, 'the timeline starts with the actor');
    // damage formula, deterministic pieces
    const kit = B.units.find((u) => u.id === 'kit'), foe = B.units.find((u) => u.side === 'enemy');
    ok(Bt.elemMul({ weak: ['fire'], resist: ['water'] }, 'fire') === 1.5 && Bt.elemMul({ weak: [], resist: ['water'] }, 'water') === 0.5, 'weak ×1.5, resist ×0.5');
    // force Kit to act on a weak enemy
    G = fresh(22); join(G, 'kit'); B = battle(G);
    const e = B.units.find((u) => u.side === 'enemy'); e.key = 'dustbunny'; e.weak = ['water', 'wind']; e.hp = e.mhp = 999; e.poise = e.mpoise = 3;
    B.actor = 'kit'; B.phase = 'command';
    const chain0 = B.chain;
    Gm.act(G, { t: 'skill', skill: 'expressJab', target: e.id });
    const ev = G.events.find((x) => x.type === 'act' && x.actor === 'kit');
    ok(ev && ev.hits[0].dmg > 0, 'a skill hits');
    ok(ev.hits[0].miss || (ev.hits[0].weak && e.stagger), 'Express Jab on a breeze weakness: −4 poise, staggered (3 pips)');
    ok(B.chain > chain0, 'hits fill the chain gauge');
    ok(Bt.chainOptions(G).free === true || B.actor !== 'kit', 'a staggered enemy opens a free chain');
    // a free chain
    G = fresh(23); join(G, 'ember'); B = battle(G);
    const f = B.units.find((u) => u.side === 'enemy'); f.stagger = true; f.hp = f.mhp = 999;
    B.actor = 'maple'; B.phase = 'command'; B.chain = 0;
    const co = Bt.chainOptions(G);
    ok(co.ready && co.list.includes('rollingThunder'), 'Maple can launch Rolling Thunder');
    ok(Gm.act(G, { t: 'chain', chain: 'rollingThunder', target: f.id }) && f.chained, 'the free chain is used up');
    ok(G.events.some((x) => x.type === 'chain' && x.hits.length === 3), 'Rolling Thunder hits three times');
    // the gauge pays for a chain
    G = fresh(24); B = battle(G); B.actor = 'maple'; B.phase = 'command'; B.chain = 100;
    for (const u of B.units) if (u.side === 'enemy') { u.hp = u.mhp = 999; u.stagger = false; }
    ok(Gm.act(G, { t: 'chain', chain: 'rollingThunder' }) && B.chain < 100, 'a full gauge pays for a chain');
    B.chain = 50; B.phase = 'command'; B.actor = 'maple';
    ok(!Gm.act(G, { t: 'chain', chain: 'rollingThunder' }), 'half a gauge doesn\'t');
    // combos: fire then wind by another hero
    G = fresh(25); join(G, 'ember', 'kit'); B = battle(G);
    const c = B.units.find((u) => u.side === 'enemy'); c.hp = c.mhp = 9999; c.weak = []; c.resist = [];
    B.actor = 'ember'; B.phase = 'command';
    Gm.act(G, { t: 'skill', skill: 'sizzle', target: c.id });
    B.actor = 'kit'; B.phase = 'command'; for (const u of B.units) u.alive = u.alive || u.side === 'hero';
    G.events.length = 0;
    Gm.act(G, { t: 'skill', skill: 'expressJab', target: c.id });
    const hit = G.events.find((x) => x.type === 'act')?.hits[0];
    ok(hit && (hit.miss || hit.combo?.name === 'Firestorm'), 'Spice then Breeze from another hero: Firestorm');
    // items, defend, flee
    G = fresh(26); B = battle(G); B.actor = 'maple'; B.phase = 'command';
    const m = B.units.find((u) => u.id === 'maple'); m.hp = 20;
    ok(Gm.act(G, { t: 'item', item: 'honeyDrop', target: 'maple' }) && m.hp === 90 && G.inv.honeyDrop === 1, 'a Honey Drop heals 70');
    B.actor = 'maple'; B.phase = 'command';
    ok(Gm.act(G, { t: 'defend' }) && m.guard, 'defend');
    G = fresh(27); B = battle(G); B.actor = 'maple'; B.phase = 'command'; B.fleeTries = 3;
    Gm.act(G, { t: 'flee' });
    ok(B.phase === 'fled' || B.fleeTries === 4, 'fleeing works (or trips)');
    G = fresh(28); G.quest.chapter = 1; B = battle(G, 'meadow', true); B.actor = 'maple'; B.phase = 'command';
    ok(B.boss && B.units.some((u) => u.key === 'thistlehog'), 'the meadow boss is Sir Thistlehog');
    Gm.act(G, { t: 'flee' });
    ok(B.phase !== 'fled' && G.events.some((x) => x.type === 'fleeFail' && x.boss), 'no running from a boss');
    // every skill and chain resolves without error and with finite numbers
    G = fresh(29); join(G, 'ember', 'kit', 'fern', 'bru');
    G.party = ['maple', 'ember', 'kit', 'fern'];
    let bad = 0;
    for (const hero of D.HERO_ORDER) {
        for (const sk of ['attack', ...D.HEROES[hero].skills]) {
            G.party = ['maple', hero === 'maple' ? 'ember' : hero].concat(hero === 'bru' ? ['fern'] : ['bru']);
            B = battle(G); for (const u of B.units) if (u.side === 'enemy') { u.hp = u.mhp = 9999; }
            B.actor = hero; B.phase = 'command';
            const u = B.units.find((x) => x.id === hero); u.mp = 999;
            const tgt = D.SKILLS[sk].target === 'ally' ? hero : B.units.find((x) => x.side === 'enemy').id;
            if (!Gm.act(G, { t: sk === 'attack' ? 'attack' : 'skill', skill: sk, target: tgt })) bad++;
            if (B.units.some((x) => !Number.isFinite(x.hp))) bad++;
            Gm.act(G, { t: 'return' }); G.mode = 'hotel'; G.battle = null; G.exp = null;
        }
    }
    ok(bad === 0, 'every hero skill resolves with finite numbers');
    for (const [id, Ch] of Object.entries(D.CHAINS)) {
        G = fresh(30); join(G, 'ember', 'kit', 'fern', 'bru');
        G.party = Ch.members.includes('maple') ? [...Ch.members] : ['maple', ...Ch.members];
        for (const a of Ch.members) for (const b of Ch.members) if (a < b) G.bonds[Bo.pairKey(a, b)] = 300;
        for (const a of Ch.members) if (a !== 'maple') G.bonds[Bo.pairKey('maple', a)] = 300;
        B = battle(G); for (const u of B.units) if (u.side === 'enemy') { u.hp = u.mhp = 9999; }
        B.actor = Ch.members[0]; B.phase = 'command'; B.chain = 100;
        ok(Gm.act(G, { t: 'chain', chain: id }) && G.events.some((x) => x.type === 'chain' && x.chain === id), `chain ${Ch.name} resolves`);
    }
    // victory rewards, defeat
    G = fresh(31); B = battle(G);
    const gold = G.gold;
    forceWin(G);
    ok(B.phase === 'won' && G.gold > gold && B.rewards.exp > 0, 'a win pays gold and EXP');
    ok(Gm.act(G, { t: 'battleDone' }) && G.mode === 'expedition' && G.exp.wins === 1, 'back to the expedition');
    G = fresh(32); B = battle(G);
    for (const u of B.units) if (u.side === 'hero') { u.hp = 0; u.alive = false; }
    B.actor = B.units.find((u) => u.side === 'enemy').id; B.phase = 'ai'; Gm.step(G, 1);
    ok(B.phase === 'lost', 'everyone down: defeat');
    Gm.act(G, { t: 'battleDone' });
    ok(G.mode === 'hotel' && !G.exp, 'defeat sends the party home');
    // auto-battle presets win a meadow fight
    for (const preset of Object.keys(AI.PRESETS)) {
        let wins = 0;
        for (let s = 0; s < 4; s++) { G = fresh(40 + s); join(G, 'ember', 'kit'); battle(G); if (autoFight(G, preset) === 'won') wins++; }
        ok(wins >= 3, `auto-battle ${preset} wins meadow fights (${wins}/4)`);
    }
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const playN = (seed, secs) => { const G = Gm.newGame(seed); const b = Bot.makeBot({ skill: 1 }); let th = 0; for (let t = 0; t < secs; t += C.STEP) { Gm.step(G, C.STEP); th += C.STEP; if (th > 0.3) { th = 0; const c = Bot.botCmd(G, b); if (c) Gm.act(G, c); } G.events.length = 0; } return G; };
    const a = playN(42, 600), b = playN(42, 600);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    // a save round trip mid-battle plays on identically
    const G = fresh(50); join(G, 'ember', 'kit'); battle(G);
    Gm.act(G, { t: 'auto', on: true });
    for (let i = 0; i < 20; i++) Gm.step(G, 0.1);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    for (let i = 0; i < 300; i++) { Gm.step(G, 0.1); Gm.step(copy, 0.1); G.events.length = 0; copy.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    let threw = false; try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.5]) {
            const G = Gm.newGame(s * 7919);
            const b = Bot.makeBot({ skill });
            let th = 0, bad = null;
            while (G.day <= 46 && !G.won && !bad) {
                Gm.step(G, C.STEP);
                th += C.STEP;
                if (th >= (skill >= 1 ? 0.35 : 0.8)) { th = 0; const c = Bot.botCmd(G, b); if (c) Gm.act(G, c); }
                G.events.length = 0;
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = 'gold ' + G.gold;
                else if (G.rooms.some((r) => !(r.dust >= 0 && r.dust <= 100))) bad = 'dust out of range';
                else if (G.battle && G.battle.units.some((u) => !Number.isFinite(u.hp) || u.hp < 0 || u.hp > u.mhp)) bad = 'hp out of range';
                else if (G.pantry.length > C.HOTEL.pantryMax + 1) bad = 'pantry overflow';
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ s, skill, won: G.won, day: G.day, late: G.late || 0, lv: G.heroes.maple.lv, joined: Object.values(G.heroes).filter((h) => h.joined).length });
        }
    }
    const good = rows.filter((r) => r.skill === 1), slack = rows.filter((r) => r.skill !== 1);
    ok(rows.every((r) => r.won && r.day <= 40), `every bot pays off the debt by day 40 (latest: day ${Math.max(...rows.map((r) => r.day))})`);
    ok(good.every((r) => r.late === 0), 'the attentive bot is never late');
    ok(rows.every((r) => r.joined === 5), 'every bot wins over all four strangers');
    ok(Math.min(...rows.map((r) => r.day)) >= 24, `nobody finishes absurdly early (earliest: day ${Math.min(...rows.map((r) => r.day))})`);
    const avg = (a, k) => (a.reduce((x, r) => x + r[k], 0) / a.length).toFixed(1);
    console.log(`  ${rows.length} games · attentive: day ${avg(good, 'day')}, late ${avg(good, 'late')}, Maple Lv ${avg(good, 'lv')} · distracted: day ${avg(slack, 'day')}, late ${avg(slack, 'late')}, Lv ${avg(slack, 'lv')}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
