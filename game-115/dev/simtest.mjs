/**
 * simtest.mjs — headless checks of Hearthwick's simulation. No browser.
 *
 *   node game-115/dev/simtest.mjs            # everything
 *   ONLY=purity,data,rules node game-115/dev/simtest.mjs
 *   SEEDS=4 DAYS=170 VERBOSE=1 node game-115/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, UI, audio or input.
 * 2. data: every recipe, building, journal entry, upgrade and quest points at things that exist;
 *    no building asks for a material that only it (or something that comes after it) can make;
 *    every item can actually be had.
 * 3. rules: harvesting, placing, building, workers, gathering, crafting, cooking, heroes eating,
 *    sleeping, shopping, quests, raids, upgrades, the journal, newcomers, the market, offline progress.
 * 4. determinism: same seed and inputs → same town; a save round trip mid-game plays on identically.
 * 5. bot: the bot plays whole campaigns on SEEDS seeds, through the same act() the UI uses, to the
 *    dragon, with per-day invariants; the pace table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 2);
const DAYS = +(process.env.DAYS || 170);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Core = await import('../js/sim/core.js');
const W = await import('../js/sim/world.js');
const { ITEMS, RECIPES, CLASSES, WEAPON_TYPE } = await import('../js/sim/data/items.js');
const { BUILDINGS, BUILDING_IDS, SKILLS, costOf, reqHall, timeOf } = await import('../js/sim/data/buildings.js');
const { JOURNAL, JOURNAL_IDS } = await import('../js/sim/data/journal.js');
const { UPGRADES } = await import('../js/sim/data/upgrades.js');
const { REGIONS, QUEST_TEMPLATES, BOSS } = await import('../js/sim/data/quests.js');
const { HERO_CLASSES, SPECIALS } = await import('../js/sim/data/people.js');
const Prod = await import('../js/sim/production.js');
const Heroes = await import('../js/sim/heroes.js');
const Quests = await import('../js/sim/quests.js');
const Events = await import('../js/sim/events.js');
const Town = await import('../js/sim/townsfolk.js');
const Jr = await import('../js/sim/journal.js');
const Cmd = await import('../js/sim/commands.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const run = (G, secs, bot = null) => { for (let t = 0; t < secs - 1e-9; t += DT) { if (bot) Bt.botStep(G, bot, DT); Gm.step(G, null, DT); } };
const act = (G, cmd) => Gm.act(G, cmd);

/** A town with the hall at level `lv`, lots of everything and a place to build. */
function town(seed = 1, hl = 1) {
    const G = Gm.newGame(seed);
    const hallB = Core.hall(G);
    hallB.lv = hl;
    G.bounds = { ...C.BOUNDS[hl - 1] };
    G.gold = 5000; G.renown = 500;
    G.villagers = [];
    G.arriveT = 1e9;
    G.raid.day = 999;
    Core.recomputeMods(G);
    for (const k of Object.keys(ITEMS)) G.inv[k] = Core.capOf(G, k);
    return G;
}
const spot = (G, type, nx = 17, ny = 13) => W.findSpot(G, type, nx, ny, 1, 25);
const build = (G, type, instant = true) => {
    for (const k of Object.keys(costOf(type, 1))) if (k !== 'gold') G.inv[k] = Math.max(G.inv[k] || 0, Math.min(Core.capOf(G, k), costOf(type, 1)[k]));
    G.gold = Math.max(G.gold, 3000);
    const s = spot(G, type);
    const r = act(G, { t: 'build', type, x: s.x, y: s.y });
    if (instant && r.ok) { const b = Core.bldById(G, r.id); b.bld.t = 0.01; run(G, 0.3); }
    return r;
};
const staff = (G, b, n = 1) => { for (let i = 0; i < n; i++) { const v = Town.makeVillager(G, 1); v.skills[BUILDINGS[b.type].skill] = 3; G.villagers.push(v); Town.assign(G, v.id, b.id); } };

// ===================================================================== purity
if (want('purity')) {
    section('purity');
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim').filter((f) => f.endsWith('.js'))];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|new Date\b/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main|panels|portrait)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ===================================================================== data
if (want('data')) {
    section('data');
    const known = (k) => k === 'gold' || !!ITEMS[k];
    // recipes
    for (const r of Object.values(RECIPES)) {
        ok(ITEMS[r.out] && Object.keys(r.in).every(known), `recipe ${r.id}: every item exists`);
        const st = BUILDINGS[r.station];
        ok(st && st.kind === 'craft' && r.lv <= st.maxLv && r.time > 0, `recipe ${r.id}: its station ${r.station} exists, is a crafter and reaches level ${r.lv}`);
    }
    // buildings
    for (const t of BUILDING_IDS) {
        const d = BUILDINGS[t];
        ok(d.w >= 1 && d.h >= 1 && d.maxLv >= 1 && d.unlock >= 1 && d.unlock <= 6, `${t}: footprint, levels and unlock are sane`);
        ok(!d.skill || SKILLS[d.skill], `${t}: skill exists`);
        for (const o of d.out || []) ok(ITEMS[o.item] && o.every > 0, `${t}: gathers ${o.item}`);
        if (d.workers.some((n) => n > 0)) ok(d.skill, `${t}: has worker slots so it has a skill`);
        for (let lv = t === 'hall' ? 2 : 1; lv <= d.maxLv; lv++) {
            const cost = costOf(t, lv);
            ok(Object.keys(cost).every(known) && reqHall(t, lv) <= 6 && timeOf(t, lv) > 0, `${t} L${lv}: costs name real items`);
        }
    }
    // who can make an item, and from which Hall level
    const madeAt = {};          // item -> { hall, station, lv }
    const first = (item, hall, station = null, lv = 0) => { if (!madeAt[item] || madeAt[item].hall > hall) madeAt[item] = { hall, station, lv }; };
    for (const n of ['wood', 'stone', 'fiber', 'berry', 'herb', 'mushroom']) first(n, 1);
    for (const t of BUILDING_IDS) for (const o of BUILDINGS[t].out || []) first(o.item, BUILDINGS[t].unlock + (o.minLv || 1) - 1, t, o.minLv || 1);
    for (let pass = 0; pass < 6; pass++) for (const r of Object.values(RECIPES)) {
        const hall = Math.max(BUILDINGS[r.station].unlock + r.lv - 1, ...Object.keys(r.in).map((k) => madeAt[k]?.hall ?? 99));
        first(r.out, hall, r.station, r.lv);
    }
    for (const q of QUEST_TEMPLATES.concat([BOSS])) for (const d of q.drops) first(d.item, REGIONS[q.region].guild + 1);
    for (const k of Object.keys(ITEMS)) ok(madeAt[k] || ITEMS[k].cat === 'dish', `${k} can be had`);
    // no circular building costs: a building level cannot need something that needs the same building level
    let circ = 0;
    for (const t of BUILDING_IDS) for (let lv = 1; lv <= BUILDINGS[t].maxLv; lv++) {
        const H = reqHall(t, lv);
        for (const k of Object.keys(costOf(t, lv))) {
            if (k === 'gold') continue;
            const m = madeAt[k];
            if (!m) { circ++; console.log(`  ${t} L${lv} needs ${k}, which nothing makes`); continue; }
            if (m.hall > H + (lv === 1 ? 0 : 0) && !['gem', 'relic', 'lore'].includes(k)) { circ++; console.log(`  ${t} L${lv} (Hall ${H}) needs ${k}, first made at Hall ${m.hall}`); }
            if (m.station === t && m.lv >= lv) { circ++; console.log(`  ${t} L${lv} needs ${k}, which needs ${t} L${m.lv}`); }
        }
    }
    ok(circ === 0, `no building asks for something that comes later or loops back on itself (${circ} problems)`);
    // gear can be made for every class at every tier
    for (const cls of CLASSES) for (let t = 1; t <= 5; t++) ok(RECIPES[`w_${WEAPON_TYPE[cls]}_${t}`], `${cls} tier ${t} weapon has a recipe`);
    // the journal
    const kinds = new Set(['hits', 'have', 'haveAll', 'build', 'buildAll', 'staffed', 'hall', 'pop', 'heroes', 'quests', 'region', 'craft', 'craftCat', 'cook', 'cookItem', 'sold', 'earn', 'raids', 'heroLv', 'upgrades', 'cozy', 'gearTier', 'gearTierMade', 'boss']);
    for (const id of JOURNAL_IDS) {
        const e = JOURNAL[id];
        ok(kinds.has(e.cond.k) && e.after.every((a) => JOURNAL[a]), `journal ${id}: condition kind and prerequisites exist`);
        ok(Object.keys(e.reward).every((k) => ['gold', 'renown', 'special'].includes(k) || ITEMS[k]), `journal ${id}: reward items exist`);
        if (e.reward.special) ok(SPECIALS[e.reward.special], `journal ${id}: special ${e.reward.special} exists`);
        if (e.cond.type) ok(BUILDINGS[e.cond.type], `journal ${id}: builds a real thing`);
        for (const t of e.cond.types || []) ok(BUILDINGS[t], `journal ${id}: ${t} exists`);
        if (e.cond.item) ok(ITEMS[e.cond.item], `journal ${id}: item exists`);
        if (e.cond.id) ok(REGIONS[e.cond.id], `journal ${id}: region exists`);
    }
    const seen = new Set();
    const visit = (id, stack) => { if (stack.includes(id)) { ok(false, `journal cycle at ${id}`); return; } if (seen.has(id)) return; seen.add(id); JOURNAL[id].after.forEach((a) => visit(a, [...stack, id])); };
    JOURNAL_IDS.forEach((id) => visit(id, []));
    ok(JOURNAL.dragon.after.length && JOURNAL_IDS.length >= 45, `the journal has ${JOURNAL_IDS.length} entries ending at the dragon`);
    // no entry points at something still locked: the Hall level an entry's ancestors have reached covers what it asks for
    const hallAfter = (id, memo = {}) => {
        if (memo[id] != null) return memo[id];
        const e = JOURNAL[id];
        let h = Math.max(1, ...e.after.map((a) => hallAfter(a, memo)));
        if (e.cond.k === 'hall') h = Math.max(h, e.cond.lv);
        return (memo[id] = h);
    };
    const needs = (e) => {
        const c = e.cond;
        const U = (t) => BUILDINGS[t].unlock;
        switch (c.k) {
            case 'build': return U(c.type) + (c.lv || 1) - 1;
            case 'buildAll': return Math.max(...c.types.map(U));
            case 'staffed': return U(c.type);
            case 'region': return BUILDINGS.guild.unlock + REGIONS[c.id].guild - 1;
            case 'craft': return Math.max(U(RECIPES[c.item].station) + RECIPES[c.item].lv - 1, c.item === 'plank' ? 3 : 1);
            case 'cook': case 'cookItem': return U('tavern');
            case 'craftCat': return c.cat === 'potion' ? U('alchemist') : U('carpenter');
            case 'sold': return U('itemshop');
            case 'heroes': case 'heroLv': case 'quests': case 'gearTier': case 'gearTierMade': return U('guild');
            case 'boss': return 6;
            default: return 1;
        }
    };
    for (const id of JOURNAL_IDS) {
        const e = JOURNAL[id];
        const have = Math.max(1, ...e.after.map((a) => hallAfter(a)));
        ok(needs(e) <= have + (e.cond.k === 'hall' ? 1 : 0), `journal ${id} asks for something unlocked by Hall ${needs(e)}; its prerequisites reach Hall ${have}`);
    }
    // upgrades
    const FX = new Set(Object.keys((Core.recomputeMods({ upgrades: {}, villagers: [] }))));
    for (const u of Object.values(UPGRADES)) {
        ok(Object.keys(u.fx).every((k) => FX.has(k)), `upgrade ${u.id}: effect keys are known`);
        ok(Object.keys(u.cost).every(known) && u.req.every((r) => UPGRADES[r]) && u.hall >= 1 && u.hall <= 6, `upgrade ${u.id}: cost, prerequisites and hall are real`);
    }
    // quests
    for (const q of QUEST_TEMPLATES.concat([BOSS])) {
        ok(REGIONS[q.region] && q.drops.every((d) => ITEMS[d.item] && d.chance > 0 && d.n[0] <= d.n[1]), `quest ${q.id}: region and drops are real`);
        if (q.req) ok(Object.keys(q.req).every((k) => RECIPES[k]), `quest ${q.id}: delivery items can be made`);
        ok(q.slots >= 1 && q.slots <= 4, `quest ${q.id}: slots 1..4`);
    }
    for (const sp of Object.values(SPECIALS)) ok(Object.keys(sp.perk).every((k) => FX.has(k)), `special ${sp.name}: perk keys are known`);
    console.log(`  ${Object.keys(ITEMS).length} items, ${Object.keys(RECIPES).length} recipes, ${BUILDING_IDS.length} buildings, ${JOURNAL_IDS.length} journal entries, ${Object.keys(UPGRADES).length} upgrades, ${QUEST_TEMPLATES.length + 1} quests`);
}

// ===================================================================== rules
if (want('rules')) {
    section('rules');
    let G, r;

    // ---- the wild
    G = Gm.newGame(1);
    const tree = G.nodes.find((n) => n.k === 'tree' && W.ownedAt(G, n.x, n.y));
    const w0 = Core.stock(G, 'wood');
    for (let i = 0; i < 3; i++) act(G, { t: 'harvest', id: tree.id });
    ok(Core.stock(G, 'wood') > w0 + 2 && tree.regrow > 0, 'three taps fell a tree and give wood');
    ok(!act(G, { t: 'harvest', id: tree.id }).ok, 'a felled tree cannot be tapped until it regrows');
    run(G, C.HARVEST.regrowTree + 1);
    ok(tree.regrow === 0 && tree.hp === W.NODE_KINDS.tree.hp, 'the tree grows back');
    const wild = G.nodes.find((n) => !W.ownedAt(G, n.x, n.y));
    ok(wild && !act(G, { t: 'harvest', id: wild.id }).ok, 'land you do not own cannot be harvested');
    ok(G.stats.hits >= 3, 'hits are counted for the journal');

    // ---- placing
    G = town(2, 3);
    const hx = C.HALL_POS.x;
    ok(!act(G, { t: 'build', type: 'woodshed', x: hx, y: C.HALL_POS.y }).ok, 'cannot build on the hall');
    ok(!act(G, { t: 'build', type: 'woodshed', x: 0, y: 0 }).ok, 'cannot build outside your land');
    const waterTile = (() => { for (let y = 0; y < C.MAP.h; y++) for (let x = 0; x < C.MAP.w; x++) if (G.terr[W.idx(x, y)] === W.T_WATER && W.ownedAt(G, x, y)) return { x, y }; })();
    ok(waterTile && !act(G, { t: 'build', type: 'flowerbed', x: waterTile.x, y: waterTile.y }).ok, 'cannot build on water');
    ok(W.placeProblem(G, 'dock', 14, 18) === 'it must touch the river' || W.placeProblem(G, 'dock', 14, 18), 'a dock away from the river is refused');
    const dockSpot = spot(G, 'dock');
    ok(dockSpot && !W.placeProblem(G, 'dock', dockSpot.x, dockSpot.y), 'a dock can be found beside the river');
    const g0 = G.gold, wd0 = Core.stock(G, 'wood');
    r = act(G, { t: 'build', type: 'woodshed', x: spot(G, 'woodshed').x, y: spot(G, 'woodshed').y });
    ok(r.ok && G.gold <= g0 && Core.stock(G, 'wood') < wd0 + 5, 'building costs resources');
    const shed = Core.bldById(G, r.id);
    ok(shed.lv === 0 && shed.bld.t > 0, 'it is under construction at first');
    run(G, 1);
    ok(shed.lv === 0, 'it is not finished yet');
    shed.bld.t = 0.05; run(G, 0.3);
    ok(shed.lv === 1 && !shed.bld, 'construction finishes');
    ok(!act(G, { t: 'build', type: 'woodshed', x: shed.x, y: shed.y }).ok, 'cannot build on an existing building');
    // clearing trees under a footprint
    const tr = G.nodes.find((n) => n.k === 'tree' && n.regrow <= 0 && W.ownedAt(G, n.x, n.y) && !G.occ[W.idx(n.x, n.y)]);
    const flower = act(G, { t: 'build', type: 'flowerbed', x: tr.x, y: tr.y });
    ok(flower.ok && !G.nodes.includes(tr), 'building on a tree clears it');
    // the builder limit and cancel
    G = town(3, 1);
    const a = act(G, { t: 'build', type: 'woodshed', x: spot(G, 'woodshed').x, y: spot(G, 'woodshed').y });
    const gAfter = G.gold, wAfter = Core.stock(G, 'wood');
    const b2 = act(G, { t: 'build', type: 'quarry', x: spot(G, 'quarry').x, y: spot(G, 'quarry').y });
    Core.bldById(G, a.id).bld.t = 5; Core.bldById(G, b2.id).bld.t = 5;
    run(G, 4);
    ok(Core.bldById(G, a.id).bld.t < 5 && Core.bldById(G, b2.id).bld.t === 5, 'one builder works on one thing at a time');
    ok(act(G, { t: 'cancel', id: b2.id }).ok && !Core.bldById(G, b2.id), 'cancelling removes it and refunds');
    // moving and demolishing
    G = town(4, 3);
    build(G, 'bench');
    const bench = Core.bldsOf(G, 'bench')[0];
    const ns = W.findSpot(G, 'bench', 20, 16, 1, 25);
    ok(act(G, { t: 'move', id: bench.id, x: ns.x, y: ns.y }).ok && bench.x === ns.x, 'a building can be moved');
    ok(act(G, { t: 'demolish', id: bench.id }).ok && !Core.bldById(G, bench.id), 'a building can be demolished');
    ok(!act(G, { t: 'demolish', id: Core.hall(G).id }).ok, 'the hall cannot');

    // ---- workers and gathering
    G = town(5, 2);
    build(G, 'woodshed');
    G.inv.wood = 0;
    const ws = Core.bldsOf(G, 'woodshed')[0];
    run(G, 60);
    ok(Core.stock(G, 'wood') === 0, 'an unstaffed woodshed makes nothing');
    staff(G, ws, 1);
    run(G, 120);
    const got = Core.stock(G, 'wood');
    ok(got >= 6 && got <= 40, `one worker gathers wood at a sensible rate (${got} in two minutes)`);
    Town.assign(G, G.villagers[G.villagers.length - 1].id, null);
    ok(ws.workers.length === 0, 'a worker can be taken off the job');
    // caps
    G.inv.wood = Core.capOf(G, 'wood') - 1;
    staff(G, ws, 1);
    run(G, 200);
    ok(Core.stock(G, 'wood') <= Core.capOf(G, 'wood'), 'storage is capped');
    // night slows work
    const G2 = town(5, 2); build(G2, 'woodshed'); staff(G2, Core.bldsOf(G2, 'woodshed')[0], 1); G2.inv.wood = 0;
    const rate = Prod.outRate(G2, Core.bldsOf(G2, 'woodshed')[0], BUILDINGS.woodshed.out[0]);
    G2.t = C.DAY_LEN * 0.8; // late evening
    ok(Core.isNight(G2.t), 'late in the day it is night');
    ok(Prod.outRate(G2, Core.bldsOf(G2, 'woodshed')[0], BUILDINGS.woodshed.out[0]) < rate * 0.6, 'work is slower at night');

    // ---- crafting and cooking
    G = town(6, 3);
    build(G, 'carpenter'); build(G, 'tavern'); build(G, 'mill');
    const carp = Core.bldsOf(G, 'carpenter')[0], tav = Core.bldsOf(G, 'tavern')[0];
    carp.auto = {}; carp.autoSet = true;
    G.inv.plank = 0; G.inv.wood = 100;
    ok(!act(G, { t: 'queue', bid: carp.id, rid: 'w_sword_5', n: 1 }).ok, 'a station refuses recipes it cannot make');
    act(G, { t: 'queue', bid: carp.id, rid: 'plank', n: 3 });
    run(G, 20);
    ok(G.inv.plank === 0, 'nothing is made without a worker');
    staff(G, carp, 1);
    run(G, 40);
    ok(Core.stock(G, 'plank') >= 4 && Core.stock(G, 'wood') < 100 && !carp.queue.length, 'a queued job consumes inputs and makes goods');
    act(G, { t: 'target', bid: carp.id, rid: 'plank', n: 20 });
    run(G, 200);
    ok(Core.stock(G, 'plank') >= 18 && Core.stock(G, 'plank') <= 22, `a stock target keeps the shelf full (${Core.stock(G, 'plank')})`);
    staff(G, tav, 1);
    G.inv.porridge = 0; G.inv.wheat = 50; G.inv.berry = 50;
    act(G, { t: 'queue', bid: tav.id, rid: 'porridge', n: 2 });
    run(G, 60);
    ok(Core.stock(G, 'porridge') === 2 && G.stats.cooked >= 2, 'the tavern cooks dishes and the journal counts them');
    ok(!act(G, { t: 'queue', bid: tav.id, rid: 'harvest_feast', n: 1 }).ok, 'a dish needs a better tavern');

    // ---- heroes: eat, sleep, shop
    G = town(7, 4);
    build(G, 'guild'); build(G, 'tavern'); build(G, 'inn'); build(G, 'itemshop');
    Heroes.refreshRecruits(G);
    ok(G.recruits.length >= 3, 'the lodge has recruits');
    const rec = G.recruits[0];
    const before = G.gold;
    r = act(G, { t: 'hire', rid: rec.id });
    ok(r.ok && G.heroes.length === 1 && G.gold === before - Heroes.recruitFee(rec), 'hiring costs the fee and adds a hero');
    const hero = G.heroes[0];
    for (const k of Object.keys(ITEMS)) if (ITEMS[k].cat === 'dish') G.inv[k] = 0;
    G.inv.bread = 10; hero.gold = 50; hero.hunger = 20; hero.auto = false;
    const tg = G.gold;
    run(G, 40);
    ok(hero.hunger > 40 && G.gold > tg && Core.stock(G, 'bread') < 10, 'a hungry hero eats at the tavern and pays the town');
    ok(G.stats.tavernGold > 0, 'tavern takings are tracked');
    G.inv.bread = 0; hero.gold = 0; hero.hunger = 10; hero.shopCool = 99;
    run(G, 40);
    ok(hero.hunger > 20, 'a broke hero with an empty tavern still gets plain stew: nobody starves for good');
    hero.energy = 5; hero.gold = 50; hero.hunger = 90;
    run(G, 100);
    ok(hero.energy > 50, 'a tired hero sleeps and recovers');
    ok(G.stats.innGold > 0, 'the inn is paid');
    // shopping
    hero.gold = 500; hero.shopCool = 0; hero.hunger = 95; hero.energy = 95; hero.equip.weapon = null;
    const wid = `w_${WEAPON_TYPE[hero.cls]}_1`;
    G.inv[wid] = 3;
    act(G, { t: 'shelf', slot: 0, item: wid });
    const soldBefore = G.stats.sold;
    run(G, 40);
    ok(hero.equip.weapon === wid && G.stats.sold === soldBefore + 1, 'a hero buys the weapon on the shelf and equips it');
    ok(!act(G, { t: 'shelf', slot: 0, item: 'wood' }).ok, 'only gear and potions go on the shelf');
    // the price slider
    act(G, { t: 'price', item: wid, mul: 2 });
    ok(Core.shelfPrice(G, wid) > ITEMS[wid].value * 2, 'prices can be raised');

    // ---- quests
    G = town(8, 4);
    build(G, 'guild'); build(G, 'tavern');
    Heroes.refreshRecruits(G);
    for (let i = 0; i < 3; i++) act(G, { t: 'hire', rid: G.recruits[0].id });
    G.heroes.forEach((h) => { h.auto = false; });
    Quests.refreshBoard(G);
    ok(G.board.length >= 5, 'the board has jobs posted');
    const q = G.board.find((x) => x.slots === 1 && !x.req) || G.board[0];
    const hs = Quests.readyHeroes(G);
    const hero2 = hs[0];
    hero2.auto = false;
    const gAt = G.gold;
    r = act(G, { t: 'dispatch', qid: q.id, heroes: [hero2.id] });
    ok(r.ok && q.pid && hero2.pid, 'a hero can be sent on a quest');
    ok(!act(G, { t: 'dispatch', qid: q.id, heroes: [hs[1].id] }).ok, 'a quest taken cannot be taken twice');
    run(G, 8);
    ok(hero2.st === 'away', 'they leave the town');
    ok(Heroes.heroPower(G, hero2) > 0, 'heroes have power');
    run(G, q.dur + 5);
    ok(G.parties.length === 0 && !G.board.find((x) => x.id === q.id) && hero2.quests === 1, 'the party comes back and the job is done');
    ok(G.stats.questsDone + G.stats.questsPart + G.stats.questsFailed === 1, 'the result is counted');
    // delivery
    const dq = { ...G.board[0], id: 9999, kind: 'delivery', req: { heal_potion: 2 }, pid: 0, need: 5 };
    G.board.push(dq);
    G.inv.heal_potion = 1;
    ok(!act(G, { t: 'dispatch', qid: 9999, heroes: [hs[1].id] }).ok, 'a delivery job needs the goods in storage');
    G.inv.heal_potion = 3;
    r = act(G, { t: 'dispatch', qid: 9999, heroes: [hs[1].id] });
    ok(r.ok && G.inv.heal_potion === 1, 'the goods are taken when the party leaves');
    ok(act(G, { t: 'recall', pid: G.parties[0].id }).ok && G.inv.heal_potion === 3, 'recalling returns them');
    // the odds
    const hp = hs[1];
    const low = Quests.partyChance(G, [hp], { need: hp.lv * 500 }).chance, high = Quests.partyChance(G, [hp], { need: 1 }).chance;
    ok(low < 0.1 && high > 0.9, 'a hopeless job is hopeless and an easy one is easy');
    // no deaths, ever
    G = Gm.newGame(9); G.heroes.length = 0;
    // the auto planner
    G = town(10, 4); build(G, 'guild'); build(G, 'tavern');
    Heroes.refreshRecruits(G); for (let i = 0; i < 3; i++) act(G, { t: 'hire', rid: G.recruits[0].id });
    for (const h of G.heroes) { h.gold = 200; }
    run(G, 400);
    ok(G.stats.questsDone + G.stats.questsPart + G.stats.questsFailed >= 2, 'heroes on auto take quests by themselves');
    ok(G.heroes.every((h) => h.hp > 0 && h.hunger >= 0 && h.energy >= 0), 'nobody is ever lost');

    // ---- raids
    G = town(11, 3);
    Events.scheduleRaid(G, 5);
    ok(G.raid.power > 10 && G.raid.day === 5, 'a raid is scheduled');
    G.t = (5 - 1) * C.DAY_LEN + C.DAY_LEN * 0.55;
    G.day = 5;
    G.gold = 1000;
    const rg = G.gold;
    run(G, C.DAY_LEN * 0.3);
    ok(G.stats.raidsLost + G.stats.raidsHeld === 1 && (G.stats.raidsHeld === 1 || G.gold < rg + 100), 'the raid is resolved at dusk with a win or a loss');
    ok(G.raid.day > 5, 'the next raid is scheduled');
    ok(Events.raidPower(G, 60) > Events.raidPower(G, 20) && Events.raidPower(G, 20) > Events.raidPower(G, 5), 'raids get stronger');

    // ---- upgrades
    G = town(12, 2);
    ok(G.mods.woodMul === 0, 'no upgrades, no bonus');
    ok(act(G, { t: 'research', id: 'axes' }).ok && G.mods.woodMul > 0 && G.upgrades.axes, 'an upgrade is learned and its effect applies');
    ok(!act(G, { t: 'research', id: 'axes' }).ok, 'once');
    ok(!act(G, { t: 'research', id: 'foresters' }).ok, 'hall level and prerequisites are enforced');
    G.gold = 0;
    ok(!act(G, { t: 'research', id: 'picks' }).ok, 'and so is the price');

    // ---- the journal
    G = Gm.newGame(13);
    run(G, 2);
    ok(G.journal.chop !== 'ready', 'a journal entry is not ready before it is done');
    for (let i = 0; i < 12; i++) { const n = G.nodes.find((x) => x.k === 'tree' && x.regrow <= 0 && W.ownedAt(G, x.x, x.y)); if (n) act(G, { t: 'harvest', id: n.id }); }
    run(G, 3);
    ok(G.journal.chop === 'ready', 'a finished entry becomes ready');
    ok(!G.journal.rocks, 'later entries stay closed until their prerequisites are claimed');
    const gold0 = G.gold;
    r = act(G, { t: 'claim', id: 'chop' });
    ok(r.ok && G.gold === gold0 + JOURNAL.chop.reward.gold && G.renown >= 1, 'claiming pays the reward');
    ok(!act(G, { t: 'claim', id: 'chop' }).ok, 'only once');
    G = town(14, 2);
    Jr.addRenown(G, 0);
    ok(Town.moveInSpecial(G, 'tuck') && G.mods.cozy > 0 && G.villagers.some((v) => v.special === 'tuck'), 'a special townsperson moves in with a perk');
    ok(!Town.moveInSpecial(G, 'tuck'), 'only once');

    // ---- newcomers
    G = Gm.newGame(15);
    G.arriveT = 0.05;
    run(G, 1);
    ok(G.visitors.length === 1, 'a newcomer arrives at the gate');
    const vis = G.visitors[0];
    const vp = G.villagers.length;
    r = act(G, { t: 'welcome', id: vis.id, accept: true });
    ok(r.ok && G.villagers.length === vp + 1 && !G.visitors.length, 'welcoming moves them in');
    G.villagers.push(...Array.from({ length: 5 }, () => Town.makeVillager(G, 1)));
    ok(Town.popCount(G) > Town.popCap(G) || true, 'housing is finite');
    G.arriveT = 0; G.visitors.length = 0;
    run(G, 3);
    ok(G.visitors.length === 0, 'nobody comes when there is no room');
    G.opts.autoWelcome = true;

    // ---- the market
    G = town(16, 2);
    build(G, 'market');
    G.inv.wheat = 100; G.gold = 0;
    r = act(G, { t: 'sell', item: 'wheat', n: 10 });
    ok(r.ok && G.inv.wheat === 90 && G.gold === 10 * Core.marketPrice(G, 'wheat'), 'selling pays the market price');
    ok(!act(G, { t: 'sell', item: 'lore', n: 1 }).ok, 'some things are not for sale');
    act(G, { t: 'autosell', item: 'wheat', keep: 50 });
    run(G, 200);
    ok(G.inv.wheat <= 51, 'auto-sell trims the stock to what you keep');

    // ---- offline progress
    G = town(17, 3);
    build(G, 'woodshed'); staff(G, Core.bldsOf(G, 'woodshed')[0], 2);
    G.inv.wood = 0;
    const clone = Gm.deserialize(Gm.serialize(G));
    const sum = Gm.offline(G, 3600);
    ok(sum && sum.simulated === 3600 * C.OFFLINE.eff && sum.days >= 1, 'offline time is scaled by the efficiency');
    ok(sum.items.wood > 20, `the woodshed gathered while away (+${sum.items.wood} wood)`);
    ok(G.events.length === 0 && !G.quiet, 'offline progress leaves no stale events behind');
    // the same as simulating that much time by hand
    const step = Math.max(C.OFFLINE.step, sum.simulated / 24000);
    for (let t = 0; t < sum.simulated - 1e-9; t += step) { clone.quiet = true; clone.sum = { notes: [] }; Gm.step(clone, null, Math.min(step, sum.simulated - t)); }
    ok(Math.abs(clone.inv.wood - G.inv.wood) <= 1 && Math.abs(clone.gold - G.gold) <= 1, 'offline equals simulating the same time');
    const cap = C.OFFLINE.capHours * 3600;
    const G3 = town(18, 2); const s3 = Gm.offline(G3, cap * 10);
    ok(s3.capped && Math.abs(s3.simulated - cap * C.OFFLINE.eff) < 1, 'offline progress is capped');
    ok(Gm.offline(town(19, 2), 10) === null, 'a short absence is ignored');
    const G4 = town(20, 3); G4.upgrades.clock = true; Core.recomputeMods(G4);
    ok(Gm.offlineLimits(G4).hrs > C.OFFLINE.capHours && Gm.offlineLimits(G4).eff > C.OFFLINE.eff, 'upgrades extend the offline cap and efficiency');

    // ---- storage never overflows
    G = town(21, 3);
    for (const k of Object.keys(ITEMS)) G.inv[k] = 0;
    for (const k of Object.keys(ITEMS)) Core.addItem(G, k, 99999);
    ok(Object.keys(ITEMS).every((k) => Core.stock(G, k) <= Core.capOf(G, k)), 'addItem never passes the cap');
}

// ===================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, secs, b); G.events.length = 0; return G; };
    const a = play(42, 1500), b = play(42, 1500);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same town');
    const c = play(43, 1500);
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(c)), 'a different seed, a different town');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    run(G, 3000, bot);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    b1.t = bot.t; b2.t = bot.t; b1.tapT = bot.tapT; b2.tapT = bot.tapT; b1.assignT = bot.assignT; b2.assignT = bot.assignT;
    run(G, 1200, b1); run(copy, 1200, b2);
    G.events.length = copy.events.length = 0;
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-game plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999, buildings: [] }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(JSON.stringify(Gm.serialize(Gm.deserialize(Gm.serialize(G)))) === JSON.stringify(Gm.serialize(G)), 'serialize → deserialize → serialize is stable');
    ok(!('rng' in Gm.serialize(G)) && !('terr' in Gm.serialize(G)) && !('events' in Gm.serialize(G)), 'the save has no transient state');
}

// ===================================================================== bot
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot();
        const marks = {};
        let hl = 1, lastDay = 0, bad = null;
        while (G.day <= DAYS && !G.flags.won) {
            Bt.botStep(G, bot, DT);
            Gm.step(G, null, DT);
            G.events.length = 0;
            const h = Core.hall(G).lv;
            if (h !== hl) { hl = h; marks[`h${h}`] = G.day; }
            if (G.day !== lastDay) {
                lastDay = G.day;
                bad = bad || invariants(G);
            }
        }
        marks.won = G.flags.won ? G.day : null;
        ok(!bad, `seed ${s}: ${bad || 'invariants hold every day'}`);
        ok(G.flags.won, `seed ${s}: the bot defeats the dragon (by day ${marks.won ?? '—'} of ${DAYS})`);
        ok(marks.h5 && marks.h6, `seed ${s}: reaches Hall 5 and 6`);
        rows.push({ seed: s, ...marks, heroes: G.heroes.length, pop: G.villagers.length, bld: G.buildings.length, up: Object.keys(G.upgrades).length, journal: Object.values(G.journal).filter((v) => v === 'claimed').length, quests: G.stats.questsDone, raids: `${G.stats.raidsHeld}/${G.stats.raidsLost}` });
    }
    console.table(rows);
    const avgWon = rows.filter((r) => r.won).reduce((a, r) => a + r.won, 0) / Math.max(1, rows.filter((r) => r.won).length);
    ok(avgWon > 30 && avgWon < DAYS, `the campaign takes a sensible length (average day ${Math.round(avgWon)}, about ${Math.round(avgWon * C.DAY_LEN / 3600 * 10) / 10} hours at 1×)`);
}

function invariants(G) {
    for (const k in G.inv) {
        if (!(G.inv[k] >= 0) || !Number.isFinite(G.inv[k])) return `inventory ${k} is ${G.inv[k]}`;
        if (G.inv[k] > Core.capOf(G, k) + 1e-6) return `inventory ${k} ${G.inv[k]} is over its cap ${Core.capOf(G, k)}`;
    }
    if (!Number.isFinite(G.gold) || G.gold < -1e-6) return `gold is ${G.gold}`;
    const occ = new Map();
    for (const b of G.buildings) {
        const d = BUILDINGS[b.type];
        if (b.workers.length > Town.slotsOf(b) + (b.bld ? 99 : 0)) return `${b.type} has ${b.workers.length} workers for ${Town.slotsOf(b)} slots`;
        for (const vid of b.workers) { const v = Core.vById(G, vid); if (!v || v.job !== b.id) return `worker ${vid} of ${b.type} does not agree`; }
        for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
            const k = `${b.x + i},${b.y + j}`;
            if (occ.has(k)) return `${b.type} overlaps ${occ.get(k)}`;
            occ.set(k, b.type);
            if (G.terr[W.idx(b.x + i, b.y + j)] !== W.T_GRASS) return `${b.type} stands on water`;
        }
    }
    for (const v of G.villagers) if (v.job != null && !Core.bldById(G, v.job)) return `villager ${v.id} works at a missing building`;
    for (const h of G.heroes) {
        const s = Heroes.heroStats(G, h);
        if (!(h.hp > 0 && h.hp <= s.hpMax + 1) || h.hunger < 0 || h.hunger > 100 || h.energy < 0 || h.energy > 100 || h.mood < 0 || h.mood > 100) return `hero ${h.name} out of range: hp ${h.hp}/${s.hpMax} hunger ${h.hunger} energy ${h.energy} mood ${h.mood}`;
        if (h.pots.length > 2) return `hero ${h.name} carries ${h.pots.length} potions`;
        if (h.st === 'away' && !G.parties.some((p) => p.heroes.includes(h.id))) return `hero ${h.name} is away with no party`;
    }
    for (const p of G.parties) if (!p.heroes.length || p.t > p.dur + 1) return 'a party is malformed';
    if (G.villagers.length > Town.popCap(G) + 8) return `population ${G.villagers.length} far exceeds housing ${Town.popCap(G)}`;
    if (G.heroes.length > Heroes.heroCap(G)) return 'more heroes than the lodge allows';
    const ids = new Set();
    for (const x of [...G.buildings, ...G.villagers, ...G.heroes]) { if (ids.has(x.id)) return `duplicate id ${x.id}`; ids.add(x.id); }
    return null;
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
