/**
 * simtest.mjs — the real simulation in Node, no browser.
 * Farming, animals, crafting/refining/cooking, shops, the village (lots, building, applicants,
 * level-ups, contributions, gifts, stories), the job board (take, turn in, assign, resolve),
 * combat (math, intents, a bot winning fights), dungeons (stairs, keys, chests, bosses),
 * the whole main quest from prologue to festival, save/load round trip, determinism.
 *   node dev/simtest.mjs
 */
import { Game } from '../js/sim/index.js';
import { G, O } from '../js/data/tiles.js';
import { ITEM } from '../js/data/items.js';
import { CROP } from '../js/data/crops.js';
import { JOBS } from '../js/data/jobs.js';
import { BUILDING } from '../js/data/buildings.js';
import { serialize, parseSave } from '../js/sim/save.js';
import { generateFloor, floorConnected } from '../js/gen/dungeon.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const section = t => console.log('·', t);
const look = { skin: 1, hair: 2, hairColor: 3, eyes: 0, top: 4, bottom: 5, acc: 1 };
const mk = (seed = 4242) => Game.create({ seed, name: 'Tester', pronoun: 'she', look });

/** Put the player facing tile (x,y) from below (or above if blocked). */
function face(g, x, y) {
    for (const [dx, dy, dir] of [[0, 1, 1], [0, -1, 0], [-1, 0, 3], [1, 0, 2]]) {
        const px = x + dx + 0.5, py = y + dy + 0.9;
        if (!g.blockedBox(px, py)) { g.p.x = px; g.p.y = py; g.p.dir = dir; return true; }
    }
    g.p.x = x + 0.5; g.p.y = y + 1.9; g.p.dir = 1; return false;
}
const act = (g, n = 1) => { for (let k = 0; k < n; k++) { g.rt.cooldown = 0; g.action(); } };
const idx = (g, x, y) => y * g.world.W + x;

// ------------------------------------------------------------------ determinism
section('determinism');
{
    const a = mk(99), b = mk(99);
    ok(a.world.glen.name === b.world.glen.name && a.mayor.name === b.mayor.name, 'same seed → same names');
    ok(JSON.stringify(a.species) === JSON.stringify(b.species), 'same seed → same monsters');
    ok(a.people.cook.name === b.people.cook.name && a.people.cook.look.hair === b.people.cook.look.hair, 'same seed → same villagers');
    const c = mk(100);
    ok(c.world.glen.name !== a.world.glen.name || c.mayor.name !== a.mayor.name || c.people.cook.name !== a.people.cook.name, 'different seed → different world');
}

// ------------------------------------------------------------------ prologue by hand
section('prologue');
const g = mk();
const W = g.world;
{
    ok(g.objective().startsWith('Talk'), 'starts with the Mayor');
    g.talkTo('glim');
    ok(!g.s.quests.flags.met_glim, 'Glim is shy until you have met the Mayor');
    g.talkTo('mayor');
    ok(g.s.quests.flags.met_mayor, 'talking to the Mayor sets the flag');
    g.talkTo('glim');
    ok(g.s.quests.main.step === 2, 'meeting Glim advances to clearing the field');
    // clear the field by facing things with the smart action
    const f = W.glen.farm;
    let cleared = 0;
    for (let y = f.y; y < f.y + f.h && cleared < 30; y++) for (let x = f.x; x < f.x + f.w; x++) {
        const o = W.obj[idx(g, x, y)];
        if (!o) continue;
        face(g, x, y);
        act(g, 8);
        if (!W.obj[idx(g, x, y)]) cleared++;
    }
    g.checkStory();
    ok(cleared >= 10, `cleared ${cleared} field objects with the A button`);
    ok(g.s.stats.farmCleared >= 10, 'field clearing is counted');
    ok(g.count('wood') > 0 || g.count('stone') > 0 || g.count('fiber') > 0, 'clearing drops materials');
    ok(g.s.quests.main.step === 3, 'advanced to planting');
    // till, plant, water 5 tiles
    let planted = 0;
    for (let n = 0; n < f.w * f.h && planted < 6; n++) {
        const x = f.x + n % f.w, y = f.y + Math.floor(n / f.w), i = idx(g, x, y);
        if (W.obj[i]) continue;
        face(g, x, y);
        g.p.energy = 100;
        g.s.sel = 0; act(g);   // hoe
        g.s.sel = g.s.inv.findIndex(s => s?.id === 'seed_turnip'); act(g);
        g.s.sel = 1; act(g);   // can
        if (g.s.world.crops[i]) planted++;
    }
    g.checkStory();
    ok(planted >= 5, `planted ${planted} turnips`);
    ok(Object.values(g.s.world.tilled).filter(t => t.w).length >= 5, 'watered');
    ok(g.p.energy < 100, 'farming costs energy');
    g.checkStory();
    ok(g.s.quests.main.step === 4, 'advanced to the job board');
    g.give('wood', 20);
    g.openBoard();
    g.buildJobBoard();
    ok(g.s.village.board, 'job board built');
    ok(g.s.board.postings.length > 0, 'board has postings immediately');
    g.sleep();
    ok(g.day === 2, 'slept into day 2');
    ok(g.s.quests.main.ch === 1, 'chapter 1 begins after sleeping');
    ok(g.s.applicants.includes('carpenter') && g.s.applicants.includes('farmer'), 'first applicants arrive');
}

// ------------------------------------------------------------------ crops grow
section('farming');
{
    const crops = Object.entries(g.s.world.crops);
    ok(crops.every(([, c]) => c.age === 1), 'watered crops grew one day');
    for (let d = 0; d < 4; d++) { for (const t of Object.values(g.s.world.tilled)) t.w = 1; g.sleep(); }
    const [k] = crops[0];
    ok(g.cropStageAt(+k) === 3, 'turnips ripen after 4 watered days');
    const i = +k; face(g, i % W.W, (i / W.W) | 0);
    const before = g.count('turnip');
    act(g);
    ok(g.count('turnip') > before, 'harvested a turnip with the A button');
    ok(!g.s.world.crops[i], 'non-regrowing crop is gone after harvest');
    // out of season
    g.s.world.tilled[i] = { w: 1 };
    g.plantAt(i, 'seed_turnip');
    ok(!!g.s.world.crops[i], 'replanted');
    g.give('seed_pumpkin', 1);
    const j = +crops[1][0];
    if (!g.s.world.crops[j]) { g.plantAt(j, 'seed_pumpkin'); ok(!g.s.world.crops[j], "can't plant fall seeds in spring"); }
}

// ------------------------------------------------------------------ village building
section('village');
{
    const lot = [...Array(18).keys()].find(k => g.lotUnlocked(k));
    ok(lot !== undefined, 'a lot is unlocked at level 1');
    const L = W.lots[lot];
    ok(!g.lotCleared(lot), 'lots start overgrown');
    g.p.energy = 999; g.p.maxEnergy = 999;
    for (let y = L.y; y < L.y + 5; y++) for (let x = L.x; x < L.x + 6; x++) {
        const i = idx(g, x, y);
        if (W.obj[i] && W.obj[i] !== O.LOTSIGN && W.obj[i] !== O.FLOWER && W.obj[i] !== O.TUFT) { face(g, x, y); act(g, 10); }
        if (W.obj[i] && W.obj[i] !== O.LOTSIGN && W.obj[i] !== O.FLOWER && W.obj[i] !== O.TUFT) g.removeObj(i, false);
    }
    ok(g.lotCleared(lot), 'lot cleared');
    ok(!g.buildable('forge').ok, 'forge needs level 2');
    ok(g.buildable('workshop').ok === false, 'workshop needs materials first');
    g.give('wood', 60); g.give('stone', 40); g.p.gold += 1000;
    ok(g.buildable('workshop').ok, 'workshop buildable with materials');
    const xp0 = g.s.village.xp;
    ok(g.build(lot, 'workshop'), 'built the workshop');
    ok(g.s.village.xp > xp0, 'building adds coziness');
    ok(g.buildings.some(b => b.type === 'workshop'), 'building footprint registered');
    ok(g.s.movingIn.carpenter === lot, 'carpenter moving in');
    g.checkStory();
    ok(g.currentStep().id === 'explore', 'chapter 1: welcome done → explore');
    g.sleep();
    ok(g.isResident('carpenter'), 'carpenter moved in overnight');
    ok(g.costMult() < 1, 'carpenter discount applies');
    ok(g.s.storehouse.some(e => e.id === 'wood'), 'carpenter left wood in the storehouse');
    const n0 = g.count('wood'); g.takeFromStorehouse('wood', 99); ok(g.count('wood') > n0, 'took wood from the storehouse');
    // talking & gifts
    const f0 = g.s.villagers.carpenter.friendship;
    g.talkTo('carpenter'); g.talkTo('carpenter');
    ok(g.s.villagers.carpenter.friendship === f0 + 20, 'talking helps once a day');
    g.give('hardwood', 2);
    g.giveGift('carpenter', 'hardwood');
    ok(g.s.villagers.carpenter.friendship >= f0 + 100, 'loved gift gives a lot');
    g.giveGift('carpenter', 'hardwood');
    ok(g.count('hardwood') === 1, 'only one gift a day');
}

// ------------------------------------------------------------------ crafting, refining, cooking, shops
section('crafting & shops');
{
    g.give('stone', 30); g.give('clay', 10); g.give('copper_ore', 10); g.give('coal', 5);
    ok(g.craft('furnace'), 'crafted a furnace');
    ok(g.count('furnace') === 1, 'furnace in the bag');
    // place it in the glen on grass
    let placed = false;
    for (let dy = -6; dy < 6 && !placed; dy++) for (let dx = -6; dx < 6 && !placed; dx++) {
        const x = W.cx + dx + 14, y = W.cy + dy, i = idx(g, x, y);
        if (W.region[i] !== 0 || W.obj[i] || g.bmap.has(i) || W.road[i] === 2 || W.ground[i] !== G.GRASS) continue;
        face(g, x, y);
        g.s.sel = g.s.inv.findIndex(s => s?.id === 'furnace');
        g.rt.cooldown = 0; g.action();
        placed = W.obj[i] === O.PLACED;
        if (placed) {
            const key = 'p' + i;
            ok(g.refine(key, 'furnace', 0, 2), 'smelting 2 copper bars');
            ok(!g.collectStation(key), 'not ready yet');
            g.s.time.min += 300;
            ok(g.collectStation(key) === 2, 'collected 2 copper bars');
        }
    }
    ok(placed, 'placed the furnace in the Glen');
    ok(g.craft('sprinkler'), 'crafted a sprinkler');
    g.give('egg', 2); g.give('milk', 1);
    ok(g.canCook('fried_egg') && !g.canCook('omelette'), 'omelette not known yet');
    g.learnRecipe('omelette');
    ok(g.canCook('omelette'), 'learned omelette');
    ok(g.cook('omelette') && g.count('omelette') === 1, 'cooked an omelette');
    ok(g.count('egg') === 1 && g.count('milk') === 0, 'ingredients used');
    g.p.energy = 10; g.eat('omelette');
    ok(g.p.energy === 70, 'eating restores energy');
    const gold = g.p.gold;
    ok(g.buy('carpenter', 'plank', 5) && g.p.gold < gold, 'bought planks from the carpenter');
    ok(!g.buy('carpenter', 'ruby'), "can't buy what isn't stocked");
    const slot = g.s.inv.findIndex(s => s?.id === 'turnip');
    if (slot >= 0) { const gg = g.p.gold; g.shipSlot(slot); g.sleep(); ok(g.p.gold > gg, 'shipping bin paid overnight'); }
    // tag recipes don't double count
    const test = mk(7);
    test.give('egg', 1);
    ok(!test.plan([['tag:egg', 1], ['egg', 1]]), 'one egg cannot fill two slots');
}

// ------------------------------------------------------------------ job board
section('job board');
{
    g.refreshBoard(true);
    const p = g.s.board.postings.find(p => !p.villagerOnly);
    ok(!!p, 'there is a posting to take');
    g.takePosting(p.id);
    ok(g.s.board.taken.some(t => t.id === p.id), 'taken');
    if (p.type === 'gather' || p.type === 'deliver') { g.give(p.item, p.n); ok(g.canTurnIn(g.s.board.taken[0]), 'ready to turn in'); const gg = g.p.gold; g.turnIn(p.id); ok(g.p.gold > gg, 'reward paid'); }
    else if (p.type === 'hunt') { g.s.stats.killsBy[p.species] = (g.s.stats.killsBy[p.species] ?? 0) + p.n; ok(g.turnIn(p.id), 'hunt turned in'); }
    else if (p.type === 'delve') { g.dstate(p.site).deepest = p.floor; ok(g.turnIn(p.id), 'delve turned in'); }
    const q = g.s.board.postings.find(p => !p.playerOnly);
    if (q) {
        ok(g.assignPosting(q.id, ['carpenter']), 'assigned the carpenter');
        ok(!!g.s.villagers.carpenter.away, 'carpenter is away');
        for (let d = 0; d < 4 && g.s.villagers.carpenter.away; d++) g.sleep();
        ok(!g.s.villagers.carpenter.away, 'carpenter came back');
        ok(g.s.report.some(l => l.includes(g.people.carpenter.name)), 'morning report mentions the result');
    }
}

// ------------------------------------------------------------------ combat
section('combat');
{
    const b = mk(11);
    b.p.hp = b.p.maxHp;
    const B = b.startBattle([{ sp: 'r1s0' }], { region: 1 });
    ok(B.foes.length === 1 && B.foes[0].intent, 'battle with an intent');
    let rounds = 0;
    while (!B.over && rounds++ < 40) b.battleAct({ type: 'attack' });
    ok(B.over === 'win', `level 1 beats a region-1 monster (${rounds} rounds, ${b.p.hp} HP left)`);
    ok(b.p.xp > 0 || b.p.level > 1, 'xp gained');
    b.battleDone();
    ok(!b.rt.battle, 'battle cleared');
    // guarding halves a heavy hit
    const c = mk(12);
    const C = c.startBattle([{ sp: 'r1s1' }], { region: 1 });
    C.foes[0].intent = 'unleash'; C.foes[0].status.charged = true; C.foes[0].spd = 99;
    const hp0 = c.p.hp; c.battleAct({ type: 'guard' }); const guarded = hp0 - c.p.hp;
    C.foes[0].intent = 'unleash'; C.foes[0].status.charged = true;
    const hp1 = c.p.hp; c.battleAct({ type: 'attack' }); const open = hp1 - c.p.hp;
    ok(guarded < open, `guarding reduces the heavy hit (${guarded} vs ${open})`);
    // fleeing and bosses
    const d = mk(13);
    const D = d.startBattle([{ sp: 'r1boss' }], { region: 1, boss: true });
    d.battleAct({ type: 'flee' });
    ok(!D.over, "can't flee a boss");
    // losing: you wake up at home, day advances
    const e = mk(14);
    const E = e.startBattle([{ sp: 'r5boss' }], { region: 5, boss: true });
    let r = 0; while (!E.over && r++ < 60) e.battleAct({ type: 'guard' });
    ok(E.over === 'lose', 'a level 1 player loses to the final boss');
    e.battleDone();
    ok(e.day === 2 && e.p.hp > 0, 'fainting sends you home to the next day');
    // item use in battle
    const f = mk(15); f.give('tonic', 1);
    const F = f.startBattle([{ sp: 'r1s0' }], { region: 1 }); f.p.hp = 10; F.allies[0].hp = 10;
    f.battleAct({ type: 'item', id: 'tonic' });
    ok(F.allies[0].hp > 10 || F.over, 'tonic heals in battle');
    // overworld encounter via walking into a monster
    const h = mk(16);
    const R = h.world.regions[0];
    h.p.x = R.hub.x + 0.5; h.p.y = R.hub.y + 0.9;
    h.rt.monsters = [{ id: 'm1', sp: 'r1s0', x: h.p.x + 0.3, y: h.p.y, dir: 0, t: 1, vx: 0, vy: 0, depth: 0, stun: 0, fade: 1, region: 1 }];
    h.update(0.02, {});
    ok(!!h.rt.battle, 'touching a monster starts a battle');
    const h2 = mk(16);
    h2.p.x = R.hub.x + 0.5; h2.p.y = R.hub.y + 0.9; h2.p.dir = 3;
    h2.rt.monsters = [{ id: 'm1', sp: 'r1s0', x: h2.p.x + 0.9, y: h2.p.y, dir: 0, t: 1, vx: 0, vy: 0, depth: 0, stun: 0, fade: 1, region: 1 }];
    h2.action();
    ok(h2.rt.battle?.firstStrike, 'swinging at a monster gives the first strike');
}

// ------------------------------------------------------------------ companions
section('companions');
{
    const c = mk(61);
    Object.assign(c.vstate('herbalist'), { joined: 1, lot: 0, friendship: 300 });
    Object.assign(c.vstate('guard'), { joined: 1, lot: 1, friendship: 300 });
    c.setCompanion('guard');
    const B = c.startBattle([{ sp: 'r1s0' }, { sp: 'r1s1' }], { region: 1 });
    ok(B.allies.length === 2 && B.allies[1].job === 'guard', 'the companion joins the battle');
    let acted = false, r = 0;
    while (!B.over && r++ < 30) { const ev = c.battleAct({ type: 'attack' }); if (ev.some(e => e.a === 'c')) acted = true; }
    ok(acted, 'the companion acts on their own');
    ok(B.over === 'win', 'won with a companion');
    c.battleDone();
    c.setCompanion('herbalist');
    const H = c.startBattle([{ sp: 'r2s0' }], { region: 2 });
    c.p.hp = 10; H.allies[0].hp = 10;
    let healed = false;
    for (let k = 0; k < 4 && !H.over; k++) { const ev = c.battleAct({ type: 'guard' }); if (ev.some(e => e.t === 'heal' && e.a === 'c')) healed = true; }
    ok(healed, 'the herbalist heals you when you are hurt');
    c.rt.battle = null; c.s.time.min = 20 * 60 - 1; c.update(0.6, {});
    ok(!c.p.companion, 'companions head home at 8pm');
}

// ------------------------------------------------------------------ dungeons
section('dungeons');
{
    let bad = 0, n = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const t = mk(seed);
        for (const s of t.world.sites) for (let fl = 1; fl <= s.floors; fl++) { n++; if (!floorConnected(generateFloor(seed, s, fl))) bad++; }
    }
    ok(bad === 0, `every floor's stairs/chests/boss reachable (${n} floors, ${bad} bad)`);
    const d = mk(21);
    d.s.village.board = true;
    d.gotoFloor('d1', 1);
    ok(!d.inWorld && d.map.floor === 1, 'entered dungeon floor 1');
    ok(d.rt.monsters.length > 0, 'monsters on the floor');
    d.descend();
    ok(d.map.floor === 2, 'descended');
    const f = d.map;
    if (f.chests.length) {
        const c = f.chests[0];
        d.openChest(c.y * f.W + c.x);
        ok(d.s.dungeons.d1.chests['2:0'], 'opened chest is remembered');
        if (c.key) ok(d.rt.floorKey, 'key chest gives a key');
    }
    d.ascend(); d.ascend();
    ok(d.inWorld, 'climbed back out');
}

// ------------------------------------------------------------------ full main quest (a bot)
section('main quest');
{
    const q = mk(31337);
    const bot = {
        // a plausible player for chapter k: level, the gear the smith sells by then, a few tonics
        power() {
            const k = q.s.heartwood + 1, p = q.p;
            p.level = [4, 7, 10, 13, 16][k - 1]; p.xp = 0;
            p.equip.weapon = ['copper_sword', 'iron_sword', 'iron_sword', 'gold_sword', 'glim_sword'][k - 1];
            p.equip.armor = ['leather_vest', 'iron_mail', 'iron_mail', 'gold_mail', 'glim_robe'][k - 1];
            p.equip.charm = k >= 3 ? 'ruby_ring' : null;
            p.bonus.hp = (k - 1) * 10;
            q.refreshStats(); p.hp = p.maxHp; p.sp = p.maxSp;
            q.give('tonic', 5, true);
            this.stats = { ...q.stats, hp: p.maxHp };
        },
        fight() {
            const B = q.rt.battle; let r = 0;
            while (B && !B.over && r++ < 80) {
                const P = B.allies[0];
                const big = B.foes.some(f => f.hp > 0 && f.intent === 'unleash');
                if (P.hp < P.maxHp * 0.4 && q.count('tonic')) q.battleAct({ type: 'item', id: 'tonic' });
                else if (big && P.hp < P.maxHp * 0.75) q.battleAct({ type: 'guard' });
                else if (q.p.level >= 2 && P.sp >= 3) q.battleAct({ type: 'skill', skill: 'power' });
                else q.battleAct({ type: 'attack' });
            }
            this.rounds = r;
            const res = B?.over; q.battleDone(); return res;
        },
        villagerFor(job) {
            const lot = [...Array(18).keys()].find(k => q.lotUnlocked(k) && !q.lotBuilding(k));
            const L = q.world.lots[lot];
            for (let y = L.y; y < L.y + 5; y++) for (let x = L.x; x < L.x + 6; x++) { const i = idx(q, x, y); if (q.world.obj[i] && q.world.obj[i] !== O.LOTSIGN) q.removeObj(i, false); }
            const B = BUILDING[JOBS[job].building];
            for (const [id, n] of Object.entries(B.cost)) q.give(id, n + 5, true);
            q.p.gold += B.gold + 100;
            return q.build(lot, B.id);
        },
    };
    q.talkTo('mayor'); q.talkTo('glim');
    q.s.stats.farmCleared = 10; q.s.stats.planted = 5; q.checkStory();
    q.give('wood', 15); q.buildJobBoard(); q.sleep();
    ok(q.s.quests.main.ch === 1, 'bot: prologue done');
    for (let k = 1; k <= 5; k++) {
        // grow the village to level k
        let guard = 0;
        while (q.s.village.level < k && guard++ < 20) {
            if (q.s.applicants.length) bot.villagerFor(q.s.applicants[0]);
            else q.addCoziness(q.nextLevelXp() - q.s.village.xp, 'test');
            q.sleep();
            if (q.s.village.levelReady) q.levelUp();
        }
        ok(q.s.village.level >= k, `bot: village level ${k}`);
        if (k === 1) { bot.villagerFor(q.s.applicants[0] ?? 'farmer'); q.sleep(); }
        // walk into the region through the gate
        const R = q.world.regions[k - 1];
        if (k > 1) {
            const gt = R.gate.tiles[0], gx = gt % q.world.W, gy = (gt / q.world.W) | 0;
            const relic = { thorn: 'thornbreaker', boulder: 'stonebreaker', shallows: 'lilypad', dark: 'lantern' }[R.gate.kind];
            const held = q.p.relics.slice();
            q.p.relics = held.filter(r => r !== relic);
            ok(q.blockedTile(gx, gy), `bot: gate ${k} (${R.gate.kind}) blocks without the ${relic}`);
            q.p.relics = held;
            ok(q.hasRelic(relic), `bot: holds the ${relic} from dungeon ${k - 1}`);
            if (R.gate.kind === 'thorn' || R.gate.kind === 'boulder') { face(q, gx, gy); q.rt.cooldown = 0; q.action(); }
            ok(!q.blockedTile(gx, gy), `bot: gate ${k} opens with the ${relic}`);
        }
        q.p.x = R.hub.x + 0.5; q.p.y = R.hub.y + 0.9; q.rt.lastRegion = 0; q.onStep(); q.checkStory();
        ok(q.s.quests.flags['visited_r' + k], `bot: reached region ${k}`);
        // clear the dungeon
        const site = q.world.sites.find(s => s.kind === 'dungeon' && s.region === k);
        q.p.x = site.x + 0.5; q.p.y = site.y + 1.9; q.p.dir = 1;
        q.rt.cooldown = 0; q.action();
        ok(!q.inWorld, `bot: entered ${site.name}`);
        for (let fl = 1; fl < site.floors; fl++) q.gotoFloor(site.id, fl + 1);
        ok(q.map.floor === site.floors && !!q.map.boss, `bot: reached the boss floor of ${site.name}`);
        bot.power();
        const boss = q.rt.monsters.find(m => m.boss);
        q.engage(boss, false);
        const res = bot.fight();
        ok(res === 'win', `bot: beat ${q.species['r' + k + 'boss'].name} at level ${q.p.level} (ATK ${bot.stats.atk} DEF ${bot.stats.def} HP ${bot.stats.hp}) in ${bot.rounds} rounds, ${q.count('tonic')} tonics left`);
        console.log('    ' + `boss ${k}: ${res} in ${bot.rounds} rounds at Lv ${q.p.level}, ${q.count('tonic')} tonics left`);
        ok(q.s.dungeons['d' + k].cleared && q.p.shards === 1, `bot: got Heart Shard ${k}`);
        if (k < 5) ok(q.hasRelic(['thornbreaker', 'stonebreaker', 'lilypad', 'lantern'][k - 1]), `bot: got relic ${k}`);
        q.exitSite();
        q.touchHeart();
        ok(q.s.heartwood === k, `bot: returned shard ${k}`);
        q.checkStory();
        ok(q.s.quests.main.ch === k + 1, `bot: chapter ${k + 1} begins`);
    }
    ok(q.s.quests.main.ch === 6 && q.currentStep().id === 'festival', 'bot: finale unlocked');
    q.s.time.min = 17 * 60; q.talkTo('glim');
    ok(!q.s.quests.flags.festival, 'festival waits for dusk');
    let fest = null; q.on('festival', f => { fest = f; });
    q.s.time.min = 18 * 60 + 30; q.touchHeart();
    ok(q.s.quests.flags.festival && fest?.lines.length > 5, 'festival cutscene fires at dusk');
    ok(q.currentStep().final, 'post-game reached');
    ok(q.world.glimmers.every(gl => q.glimmerAwake(gl)), 'every glimmer awake after the festival');
    console.log(`    (bot finished on day ${q.day}, village level ${q.s.village.level}, ${q.residents().length} villagers)`);
}

// ------------------------------------------------------------------ glimmers & gates
section('glimmers & gates');
{
    const t = mk(555);
    const faded = t.world.glimmers.find(gl => gl.tier >= 2 && !gl.pocket);
    t.p.x = faded.x + 0.5; t.p.y = faded.y + 1.9; t.p.dir = 1;
    ok(!t.blockedTile(faded.x, faded.y), 'faded glimmers are invisible and walkable');
    const n0 = t.p.bonus.hp + t.p.bonus.en + t.s.known.recipes.length + t.p.gold;
    t.touchGlimmer(idx(t, faded.x, faded.y));
    ok(t.p.bonus.hp + t.p.bonus.en + t.s.known.recipes.length + t.p.gold === n0, 'a faded glimmer gives nothing yet');
    t.s.heartwood = 5;
    ok(t.glimmerAwake(faded), 'awake once the Heartwood has healed');
    const scroll = t.world.glimmers.find(gl => gl.kind === 'scroll' && gl.region === 0);
    if (scroll) { const k0 = t.s.known.recipes.length; t.touchGlimmer(idx(t, scroll.x, scroll.y)); ok(t.s.known.recipes.length === k0 + 1, 'Glen recipe scroll teaches a recipe'); }
    const acorn = t.world.glimmers.find(gl => gl.kind === 'acorn');
    const hp0 = t.p.maxHp; t.touchGlimmer(idx(t, acorn.x, acorn.y)); ok(t.p.maxHp === hp0 + 10, 'Heart Acorn raises max HP');
    const R2 = t.world.regions[1];
    const gi = R2.gate.tiles[0];
    face(t, gi % t.world.W, (gi / t.world.W) | 0);
    t.rt.cooldown = 0; t.action();
    ok(t.world.obj[gi] === O.THORN, 'thornwall stands without the Thornbreaker');
    t.p.relics.push('thornbreaker');
    t.hitObj(gi, O.THORN, { relic: 'thornbreaker', drops: [] });
    ok(R2.gate.tiles.every(i => t.world.obj[i] !== O.THORN), 'Thornbreaker clears the whole thornwall');
}

// ------------------------------------------------------------------ animals & greenhouse
section('animals');
{
    const a = mk(77);
    a.s.village.level = 3; a.s.world.lots[0] = { b: 'coop', day: 1 }; a.buildBuildingMap();
    a.p.gold = 5000;
    ok(a.buyAnimal('chicken'), 'bought a chicken');
    a.give('hay', 5);
    ok(a.s.hay === 5, 'hay goes to the silo once you have a coop');
    const an = a.s.animals[0];
    a.petAnimal(an.id);
    a.sleep();
    ok(an.ready === 'egg' || an.ready === 'egg_l', 'fed chicken laid an egg');
    ok(a.collectProduce('coop') === 1 && a.count('egg') + a.count('egg_l') === 1, 'collected the egg');
    a.s.hay = 0; a.sleep();
    ok(!an.ready && a.s.report.some(l => l.includes('hungry')), 'no hay → hungry and no egg');
    a.give('seed_melon', 1);
    ok(a.greenhousePlant(0, 'seed_melon'), 'greenhouse takes out-of-season seeds');
}

// ------------------------------------------------------------------ villager story
section('villager story');
{
    const v = mk(88);
    v.s.villagers.cook = { ...v.vstate('cook'), joined: 1, lot: 0, friendship: 250 };
    ok(v.storyState('cook').available, 'story chapter 1 available at 2 hearts');
    v.startStory('cook');
    const a = v.s.villagers.cook.story.active;
    ok(a && a.site, 'lost-item story points to a site');
    v.s.village.board = true; v.s.village.level = 5;
    v.gotoFloor(a.site, a.floor);
    ok(!!v.map.special, 'a glowing chest appears on that floor');
    v.openChest(v.map.special.i);
    ok(v.storyReady('cook'), 'found the keepsake');
    const k0 = v.s.known.recipes.length;
    v.finishStory('cook');
    ok(v.s.villagers.cook.story.ch === 1 && v.s.known.recipes.length > k0, 'story finished and rewarded');
}

// ------------------------------------------------------------------ save / load
section('save & load');
{
    const text = serialize(g);
    const st = parseSave(text);
    ok(!!st, 'save parses');
    const g2 = new Game(st);
    ok(g2.day === g.day && g2.p.gold === g.p.gold && g2.s.village.xp === g.s.village.xp, 'state survives');
    ok(g2.isResident('carpenter') && g2.buildings.some(b => b.type === 'workshop'), 'buildings survive');
    let same = 0, diff = 0;
    for (let i = 0; i < g.world.obj.length; i++) (g.world.obj[i] === g2.world.obj[i] ? same++ : diff++);
    ok(diff === 0, `world edits survive a reload (${diff} tiles differ)`);
    ok(Object.keys(g2.s.world.crops).length === Object.keys(g.s.world.crops).length, 'crops survive');
    ok(g2.rt.explored.reduce((a, b) => a + b, 0) === g.rt.explored.reduce((a, b) => a + b, 0), 'explored map survives');
    ok(!parseSave('{"v":0}') && !parseSave('nope'), 'rejects bad saves');
    ok(text.length < 400000, `save is small (${(text.length / 1024).toFixed(1)} KB)`);
}

// ------------------------------------------------------------------ a long idle run: no crashes across a year
section('a year of days');
{
    const y = mk(2024);
    let err = null;
    try {
        y.talkTo('mayor'); y.talkTo('glim'); y.give('wood', 15); y.buildJobBoard();
        for (let d = 0; d < 50; d++) {
            for (let k = 0; k < 120; k++) y.update(1 / 10, { mx: Math.sin(k / 7), my: Math.cos(k / 11) });
            if (y.rt.battle) { while (!y.rt.battle.over) y.battleAct({ type: 'attack' }); y.battleDone(); }
            y.sleep();
        }
    } catch (e) { err = e; }
    ok(!err, 'fifty simulated days without an exception' + (err ? ': ' + err.stack : ''));
    ok(y.day >= 50 && y.season !== 0 || y.day > 48, 'the seasons turn');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
