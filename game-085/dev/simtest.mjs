/**
 * simtest.mjs — headless checks of WanderQuest's simulation. No browser.
 *
 *   node game-085/dev/simtest.mjs            # everything
 *   ONLY=purity,book node game-085/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-085/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a canvas, storage, Math.random or the
 *    clock, and never import the view, the UI, the audio, the input or the saves.
 * 2. world: the road network, region gates, every town reachable once every Waystone is lit, no planned hop
 *    onto a closed road, quests only ever point at towns the caravan can reach.
 * 3. rules: travel, rations and hunger, camping and recovery, the inn, trade and price pressure, quests of
 *    every kind, the three crafting carts, gear and its level limit, upgrades, hiring, wanderers, the morning
 *    post and its streak, Rally, courses and turning back, Wardens and the Night Roads.
 * 3b. book: the scrapbook keeps every person, monster, item, good, material, town, road and letter, and stays
 *    bounded; older saves get one.
 * 4. determinism: same seed, same game; time away (advance) is exactly the same as playing it out; a save
 *    round trip plays on identically; an unknown save version is rejected.
 * 5. bot: the bot plays the whole realm on SEEDS seeds at two skills with invariants checked every game
 *    hour, and prints the hour each Waystone was lit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const W = await import('../js/sim/world.js');
const E = await import('../js/sim/economy.js');
const Pt = await import('../js/sim/party.js');
const Bt = await import('../js/sim/battle.js');
const Q = await import('../js/sim/quests.js');
const Bot = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const ser = (G) => JSON.stringify(Gm.serialize(G));
/** Put the caravan on a road out of `from` towards `to`. */
const putOnRoad = (G, from, to, done = 0) => {
    const r = D.roadBetween(from, to);
    G.at = null; G.road = { id: r.id, from, to, miles: W.miles(r), done }; G.leg = { fights: 0, won: 0, gold: 0, kills: 0 };
};
const noFights = (G) => { G.fightIn = 1e9; G.eventIn = 1e9; };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|getContext|Math\.random|localStorage|performance\.now|Date\.now|new Date|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('world')) {
    section('world');
    const G = Gm.newGame(1);
    ok(D.TOWNS.every((t) => D.ROADS.some((r) => r.a === t.id || r.b === t.id)), 'every town has a road');
    ok(D.ROADS.every((r) => D.TOWN[r.a] && D.TOWN[r.b]), 'every road joins two real towns');
    ok(D.ROADS.every((r) => r.gate === null || Math.max(D.TOWN[r.a].region, D.TOWN[r.b].region) === r.gate + 1), 'a gated road leads into the region its Waystone opens');
    ok(D.ROADS.every((r) => r.gate !== null || D.TOWN[r.a].region === D.TOWN[r.b].region), 'an ungated road stays inside one region');
    ok(D.REGIONS.every((R) => D.TOWN[R.warden.town].capital && D.TOWN[R.warden.town].region === R.id), 'every Warden guards a capital in its own region');
    let { dist } = W.dijkstra(G, 'hearthford');
    ok(Object.keys(dist).every((t) => D.TOWN[t].region === 0), 'at the start only Meadowmere is reachable');
    ok(D.TOWNS.filter((t) => t.region === 0).every((t) => dist[t.id] !== undefined), 'all of Meadowmere is reachable at the start');
    for (let r = 0; r < 6; r++) {
        G.lit[r] = true;
        ({ dist } = W.dijkstra(G, 'hearthford'));
        const top = Math.min(5, r + 1);
        ok(D.TOWNS.filter((t) => t.region <= top).every((t) => dist[t.id] !== undefined), `with ${r + 1} Waystone${r ? 's' : ''} lit, regions up to ${top} are reachable`);
        ok(Object.keys(dist).every((t) => D.TOWN[t].region <= top), `and nothing beyond`);
    }
    // the planner never picks a closed road, and quests never point somewhere unreachable
    let bad = 0, qbad = 0, plans = 0;
    for (let s = 1; s <= 30; s++) {
        const g = Gm.newGame(s * 31);
        g.lit = [s % 2 === 0, s % 4 === 0, false, false, false, false];
        for (const t of D.TOWNS) {
            if (!W.regionOpen(g, t.region)) continue;
            g.at = t.id;
            for (const route of ['quests', 'trade', 'explore']) {
                g.orders.route = route;
                const next = W.planNext(g);
                plans++;
                if (next) { const r = D.roadBetween(t.id, next); if (!r || !W.isOpen(g, r)) bad++; }
            }
            Q.stockTown(g, t.id);
            const reach = W.dijkstra(g, t.id).dist;
            for (const q of g.board) {
                if (q.town && reach[q.town] === undefined) qbad++;
                if (q.region !== undefined && !W.regionOpen(g, q.region)) qbad++;
                if (q.good && !W.regionOpen(g, D.GOOD[q.good].region)) qbad++;
            }
        }
    }
    ok(bad === 0, `${plans} plans over 30 seeds never take a closed road`);
    ok(qbad === 0, 'no notice-board quest points at a town, region or good that is still locked');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // travel
    let G = Gm.newGame(2);
    putOnRoad(G, 'hearthford', 'millbrook');
    noFights(G);
    const sp = W.speed(G);
    Gm.advance(G, 10);
    ok(Math.abs(G.road.done - sp * 10) < 1e-6, 'the caravan moves at speed() miles a tick');
    G.up.wheels = 5;
    ok(Math.abs(W.speed(G) / sp - 1.3) < 1e-9, 'Wheels 5 is +30% speed');
    G.up.wheels = 0;
    G.buffs.rally = G.t + 5;
    ok(Math.abs(W.speed(G) / sp - C.TRAVEL.rally.mult) < 1e-9, 'Rally hurries the oxen');
    G.buffs.rally = 0;
    const rations = G.rations;
    Gm.advance(G, 240);
    ok(G.rations === rations - Math.floor(240 * C.FOOD.perMember * G.party.length + 1e-9), 'each traveller eats a ration every two minutes on the road');
    G.rations = 0;
    ok(Math.abs(W.speed(G) / sp - C.TRAVEL.hungry) < 1e-9, 'a hungry caravan crawls');
    // arrival and the inn
    G = Gm.newGame(3);
    putOnRoad(G, 'hearthford', 'millbrook');
    noFights(G);
    G.party[0].hp = 5;
    G.gold = 100;
    for (let i = 0; i < 5000 && !G.at; i++) Gm.tick(G);
    ok(G.at === 'millbrook', 'the caravan arrives at the end of the road');
    ok(G.party.every((m) => m.hp === Pt.maxHp(m)), 'the inn heals everyone');
    ok(G.towns.millbrook.visits === 1, 'the visit is counted');
    ok(G.board.length === C.QUESTS.board || G.quests.length > 0, 'the notice board is stocked');
    ok(G.tavern.length === 2, 'the tavern has two travellers looking for a road');
    ok(G.log.some((e) => e.k === 'road' && e.s.includes('Millbrook')), 'the journal records the leg');
    // camping
    G = Gm.newGame(4);
    putOnRoad(G, 'hearthford', 'millbrook');
    noFights(G);
    for (const m of G.party) m.hp = Pt.maxHp(m) * 0.2;
    Gm.tick(G);
    ok(G.camp, 'below the camp threshold the caravan makes camp');
    const at = G.road.done;
    Gm.advance(G, 30);
    ok(G.road.done === at, 'it does not move while camped');
    for (let i = 0; i < 2000 && G.camp; i++) Gm.tick(G);
    ok(!G.camp && Pt.partyHealth(G) >= C.TRAVEL.campUntil, 'it breaks camp once the party has recovered');
    // a downed traveller sits out fights until rested
    G.party[1].hp = 0; G.party[1].down = true;
    const foes = [Bt.makeFoe('wolf', 1)];
    const res = Bt.resolveBattle(G, foes, G.rng);
    ok(!res.hits.some((h) => (h.a === 'p' && h.ai === 1) || (h.d === 'p' && h.di === 1)), 'a downed traveller neither fights nor is hit');
    // trade and price pressure
    G = Gm.newGame(5);
    G.gold = 1000;
    const p0 = E.buyPrice(G, 'hearthford', 'grain');
    ok(p0 < D.GOOD.grain.base, 'a town sells what it makes below the base price');
    ok(E.sellPrice(G, 'thistlecross', 'spice') > D.GOOD.spice.base * 0.92, 'a town pays well for what it wants');
    E.buy(G, 'grain', 10);
    ok(G.cargo.grain.n === 10, 'buying fills the hold');
    ok(E.buyPrice(G, 'hearthford', 'grain') > p0, 'buying pushes the price up');
    G.t += 4000;
    ok(E.buyPrice(G, 'hearthford', 'grain') <= p0 + 1, 'and the pressure fades with time');
    const s0 = E.sellPrice(G, 'hearthford', 'grain');
    const got = E.sell(G, 'grain', 10);
    ok(got > 0 && !G.cargo.grain, 'selling empties the hold for gold');
    ok(E.sellPrice(G, 'hearthford', 'grain') < s0, 'selling pushes the price down');
    G.gold = 100000;
    E.buy(G, 'wool', 999);
    ok(E.cargoUsed(G) === E.cargoCap(G), 'the hold has a limit');
    // quests
    G = Gm.newGame(6);
    const rng = (await import('../js/rng.js')).makeRng(9);
    const cq = Q.makeQuest(G, rng, 'hearthford', 'courier');
    G.quests = [cq];
    const gold = G.gold;
    Q.onArrive(G, cq.town);
    ok(cq.done && G.gold > gold && G.quests.length === 0, 'a courier quest pays on arrival');
    const dq = Q.makeQuest(G, rng, 'hearthford', 'deliver');
    G.quests = [dq];
    G.cargo = { [dq.good]: { n: dq.n - 1, cost: 0 } };
    Q.onArrive(G, dq.town);
    ok(!dq.done, 'a delivery waits until the whole order is carried');
    G.cargo[dq.good].n = dq.n;
    Q.onArrive(G, dq.town);
    ok(dq.done && !G.cargo[dq.good], 'and takes the goods when it is');
    ok(E.reserved(G, 'grain') === 0, 'finished deliveries reserve nothing');
    const bq = Q.makeQuest(G, rng, 'hearthford', 'bounty');
    G.quests = [bq];
    Q.onKill(G, bq.fam, bq.n - 1);
    ok(!bq.done && bq.have === bq.n - 1, 'a bounty counts kills');
    Q.onKill(G, bq.fam, 5);
    ok(bq.done, 'and pays when it is complete');
    // crafting
    G = Gm.newGame(7);
    const cook = Pt.makeMember(G, 'cook', 1, G.rng); G.party.push(cook);
    const smith = Pt.makeMember(G, 'smith', 1, G.rng); G.party.push(smith);
    const alch = Pt.makeMember(G, 'alchemist', 1, G.rng); G.party.push(alch);
    G.rations = 0; G.mats.meat = 1; G.mats.ore = 2; G.mats.hide = 1; G.mats.herb = 2;
    G.orders.route = 'hold';
    const items = G.stats.items;
    Gm.advance(G, 400);
    ok(G.rations === 3 + cook.cart && G.mats.meat === 0, 'the cook turns meat into rations');
    ok(G.stats.items === items + 1 && G.mats.ore === 0, 'the smith forges gear from ore and hide');
    ok(G.potions === 1 && G.mats.herb === 0, 'the alchemist brews a potion from herbs');
    // gear and its level limit
    G = Gm.newGame(8);
    const big = Pt.makeItem(G, G.rng, 20, { slot: 'weapon' });
    G.orders.autoSell = false;
    Pt.gainItem(G, big, 'test');
    ok(G.pack.includes(big) && !G.party.some((m) => m.gear.weapon === big), 'gear too far above a traveller\'s level stays in the pack');
    G.party[0].level = 18;
    ok(Pt.equip(G, big.id, G.party[0].id) && G.party[0].gear.weapon === big, 'and can be worn once they reach it');
    const atk = Pt.memberStats(G.party[0]).atk;
    ok(atk === Math.round((Pt.baseStats(G.party[0]).atk + big.stats.atk) * 10) / 10, 'worn gear adds its stats');
    // upgrades, hiring, wanderers
    G = Gm.newGame(9);
    G.gold = 10000;
    ok(Gm.command(G, { type: 'upgrade', key: 'hold' }).ok && E.cargoCap(G) === 30, 'Deeper Hold adds 10 to the hold');
    ok(Gm.command(G, { type: 'upgrade', key: 'lantern' }).ok && Gm.offlineCap(G) === 10 * 3600, 'the Great Lantern adds two hours away');
    const before = G.party.length;
    ok(!Gm.command(G, { type: 'hire', idx: 0 }).ok && G.party.length === before, 'a full caravan cannot hire');
    G.level = 3;
    ok(Gm.command(G, { type: 'hire', idx: 0 }).ok && G.party.length === before + 1, 'a level-3 caravan has room for a third traveller');
    const tr = G.party[G.party.length - 1];
    G.mats = { hide: 99, meat: 99, ore: 99, timber: 99, herb: 99, crystal: 99 };
    G.level = 2;
    ok(!Gm.command(G, { type: 'cartUp', id: tr.id }).ok && tr.cart === 1, 'carts can\'t outgrow the caravan');
    G.level = 6;
    ok(Gm.command(G, { type: 'cartUp', id: tr.id }).ok && tr.cart === 2, 'a cart upgrades with gold and materials');
    ok(Gm.command(G, { type: 'dismiss', id: tr.id }).ok && !G.party.includes(tr), 'a traveller can be let go');
    ok(!Gm.command(G, { type: 'dismiss', id: G.party[0].id }).ok, 'but never the captain');
    G.offers.push({ m: Pt.makeMember(G, 'scout', 1, G.rng), until: G.t + 100 });
    Gm.advance(G, 101);
    ok(G.offers.length === 0, 'a wanderer does not wait forever');
    // the morning post
    G = Gm.newGame(10);
    Gm.checkIn(G, 100);
    ok(G.daily.day === 100 && !G.daily.claimed && G.daily.contracts.length === 3, 'a new day brings the post and three contracts');
    const g1 = G.gold;
    ok(Gm.command(G, { type: 'claimPost' }).ok && G.gold > g1, 'the post holds gold');
    ok(!Gm.command(G, { type: 'claimPost' }).ok, 'once a day');
    Gm.checkIn(G, 100);
    ok(G.daily.claimed, 'checking in again the same day changes nothing');
    Gm.checkIn(G, 101);
    ok(G.daily.streak === 2, 'the next day continues the streak');
    Gm.checkIn(G, 105);
    ok(G.daily.streak === 1, 'a missed day restarts it');
    // naming the wagon
    G = Gm.newGame(30, { wagon: '  The   Bramble\u0007 Rose ' });
    ok(G.wagon === 'The Bramble Rose', 'a typed name is trimmed, single-spaced and stripped of control characters');
    ok(G.log.some((e) => e.s.includes('The Bramble Rose rolls out of Hearthford')), 'and the journal opens with it');
    ok(Gm.newGame(31).wagon === D.DEFAULT_WAGON && Gm.newGame(31, { wagon: '   ' }).wagon === D.DEFAULT_WAGON, 'no name gives the default');
    ok(D.cleanName('x'.repeat(60)).length === 24, 'a name is at most 24 characters');
    ok(Gm.command(G, { type: 'nameWagon', name: 'Old Faithful' }).ok && G.wagon === 'Old Faithful' && G.log.at(-1).s.includes('Old Faithful'), 'the wagon can be renamed');
    ok(Gm.deserialize(JSON.parse(ser(G))).wagon === 'Old Faithful', 'the name is saved');
    const unnamed = Gm.serialize(G); delete unnamed.wagon;
    ok(Gm.deserialize(unnamed).wagon === D.DEFAULT_WAGON, 'an older save without a name gets the default');
    ok(D.WAGON_NAMES.every((n) => D.cleanName(n) === n), 'every suggested name survives cleaning');
    // Rally, courses and turning back
    G = Gm.newGame(11);
    putOnRoad(G, 'hearthford', 'millbrook', 10);
    noFights(G);
    ok(Gm.command(G, { type: 'rally' }).ok, 'Rally works on the road');
    ok(!Gm.command(G, { type: 'rally' }).ok, 'and then has to cool down');
    ok(Gm.command(G, { type: 'course', town: 'hearthford' }).ok && G.road.to === 'hearthford' && Math.abs(G.road.done - (G.road.miles - 10)) < 1e-9, 'a course back the way you came turns the caravan round');
    ok(!Gm.command(G, { type: 'course', town: 'sunspire' }).ok, 'no course into a region still dark');
    G.at = 'hearthford'; G.road = null;
    ok(Gm.command(G, { type: 'course', town: 'thistlecross' }).ok, 'a course across the region is accepted');
    Gm.advance(G, 2);
    ok(G.road && W.nextHop(G, 'hearthford', 'thistlecross') === G.road.to, 'and the caravan sets out along the shortest way');
    // Wardens
    G = Gm.newGame(12);
    G.at = 'thistlecross';
    ok(Gm.wardenHere(G) === 0, 'the Thornback waits at Thistlecross');
    ok(Bt.predictOdds(G, Bt.wardenFoes(G, 0)) < 0.2, 'a level-1 caravan has no chance');
    G.at = 'hearthford';
    ok(Gm.wardenHere(G) === null && !Gm.command(G, { type: 'challenge' }).ok, 'no Warden in an ordinary town');
    G.at = 'thistlecross';
    for (const m of G.party) m.level = 14;
    G.party.push(Pt.makeMember(G, 'healer', 14, G.rng), Pt.makeMember(G, 'smith', 14, G.rng));
    for (const m of G.party) m.hp = Pt.maxHp(m);
    const odds = Gm.refreshOdds(G);
    ok(odds > 0.8, `a level-14 party of four is the favourite (${Math.round(odds * 100)}%)`);
    const snapG = Gm.serialize(G);
    Bt.predictOdds(G, Bt.wardenFoes(G, 0));
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(snapG), 'predicting the odds changes nothing');
    let won = false;
    for (let i = 0; i < 5 && !won; i++) {
        for (const m of G.party) { m.hp = Pt.maxHp(m); m.down = false; }
        won = Gm.command(G, { type: 'challenge' }).won;
    }
    ok(won && G.lit[0] && G.letters.some((l) => l.title.includes('Thistlecross')), 'beating the Thornback lights the Waystone and brings a letter');
    ok(W.dijkstra(G, 'thistlecross').dist.sandhollow !== undefined, 'and opens the road to the Amber Wastes');
    ok(Gm.wardenHere(G) === null, 'a lit Waystone has no Warden');
    // the ending and the Night Roads
    G.lit = [true, true, true, true, true, true]; G.ended = true; G.at = 'starhaven';
    ok(Gm.wardenHere(G) === 5, 'after the ending the Hollow King can be fought again');
    ok(Bt.wardenFoes(G, 5, true)[0].level === 54, 'one Night darker');
}

// ======================================================================
if (want('book')) {
    section('scrapbook');
    const Bk = await import('../js/sim/book.js');
    let G = Gm.newGame(21);
    ok(Object.values(G.book.people).map((p) => p.name).join(',') === 'You,Old Tam', 'the scrapbook starts with you and Old Tam');
    ok(G.book.places.hearthford, 'and Hearthford');
    // every person the caravan meets is kept, with what became of them
    G.level = 3; G.gold = 10000;
    const hire = G.tavern[0].m;
    Gm.command(G, { type: 'hire', idx: 0 });
    ok(G.book.people[hire.id]?.status === 'riding', 'a hired traveller is kept as riding with you');
    Gm.command(G, { type: 'dismiss', id: hire.id });
    ok(G.book.people[hire.id].status === 'parted', 'and as parted when they leave');
    putOnRoad(G, 'hearthford', 'millbrook');
    let guard = 0;
    while (!G.offers.length && guard++ < 200) { G.eventIn = 0.0001; G.fightIn = 1e9; Gm.tick(G); }
    const w = G.offers[0]?.m;
    ok(w && G.book.people[w.id]?.status === 'asked', 'a wanderer who asks to join is kept');
    Gm.command(G, { type: 'declineOffer', id: w.id });
    ok(G.book.people[w.id].status === 'passed', 'and still kept when sent on their way');
    // monsters: seen and defeated
    G = Gm.newGame(22);
    putOnRoad(G, 'hearthford', 'millbrook');
    noFights(G);
    G.fightIn = 0.0001;
    Gm.tick(G);
    const fams = Object.keys(G.book.monsters);
    ok(fams.length >= 1 && fams.every((f) => D.REGIONS[0].monsters.includes(f)), 'a fight puts its monsters in the scrapbook');
    const rec = G.book.monsters[fams[0]];
    ok(rec.seen >= 1 && rec.kills <= rec.seen && rec.top >= 1, 'with how many were seen, defeated and how strong');
    // a long run: everything recorded is real and consistent
    G = Gm.newGame(23);
    Bot.botPlay(G, Bot.makeBot(), 12 * 3600, Gm.advance, Gm.checkIn);
    const b = G.book;
    const kills = Object.values(b.monsters).reduce((a, m) => a + m.kills, 0);
    ok(kills === G.stats.kills - Object.values(b.wardens).reduce((a, w) => a + w.wins * 3, 0), `defeated counts add up to the kills (${kills})`);
    ok(Object.keys(b.places).every((t) => G.towns[t].visits > 0) && Object.keys(G.towns).filter((t) => G.towns[t].visits > 0).every((t) => b.places[t]), 'every visited town is in the scrapbook and nothing else');
    ok(b.legs.length === Math.min(1000, G.stats.arrivals), `one road per arrival (${b.legs.length})`);
    ok(b.legs.every((l, i) => i === 0 || D.roadBetween(l.from, l.to)) && b.legs.every((l) => l.mi > 0), 'every road in the travel log is a real road');
    for (let i = 1; i < b.legs.length; i++) if (b.legs[i].from !== b.legs[i - 1].to) { ok(false, 'the travel log is continuous'); break; }
    ok(Object.values(b.items).reduce((a, x) => a + x.n, 0) <= G.stats.items && Object.keys(b.items).length > 0, 'gear found is kept by name');
    const goodsBought = Object.values(b.goods).reduce((a, x) => a + x.bought, 0);
    ok(goodsBought > 0, `goods bought are kept (${goodsBought})`);
    ok(Object.values(b.mats).reduce((a, n) => a + n, 0) > 0, 'materials gathered are kept');
    ok(G.party.every((m) => b.people[m.id]?.status === 'riding'), 'everyone in the caravan is in the scrapbook as riding');
    ok(b.letters.length >= 1, 'read letters are filed');
    // bounded
    const many = Gm.newGame(24);
    for (let i = 0; i < 1200; i++) Bk.noteLeg(many, 'hearthford', 'millbrook', 50, null);
    for (let i = 0; i < 700; i++) Bk.noteItem(many, { name: 'Thing ' + i, slot: 'charm', rarity: i === 3 ? 4 : 0, ilvl: 1 }, 'test');
    ok(many.book.legs.length === 1000 && Object.keys(many.book.items).length === 500, 'the travel log and the gear list are bounded');
    ok(many.book.items['Thing 3'], 'and the rare pieces are the ones kept');
    // saves from before the scrapbook get one
    const old = Gm.serialize(G); delete old.book;
    const back = Gm.deserialize(old);
    ok(back.book && G.party.every((m) => back.book.people[m.id]) && Object.keys(back.book.places).length > 0, 'an older save gets a scrapbook built from what it knows');
    ok(ser(Gm.deserialize(JSON.parse(ser(G)))) === ser(G), 'the scrapbook survives a save round trip');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bot.makeBot(); Bot.botPlay(G, b, 3 * 3600, Gm.advance, Gm.checkIn); return G; };
    ok(ser(play(42)) === ser(play(42)), 'same seed and decisions, same game after three hours');
    // time away is the same as living through it
    const a = Gm.newGame(7), b = Gm.newGame(7);
    for (let i = 0; i < 1800 * 120; i++) Gm.step(a, { a: false }, C.STEP);
    Gm.advance(b, 1800);
    a.events.length = 0;
    ok(a.t === b.t && ser(a) === ser(b), 'half an hour of play equals half an hour away');
    const G = Gm.newGame(13);
    const bot = Bot.makeBot();
    Bot.botPlay(G, bot, 7200, Gm.advance, Gm.checkIn);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    Gm.advance(G, 3600); Gm.advance(copy, 3600);
    ok(ser(G) === ser(copy), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const t0 = Date.now();
    const H = Gm.newGame(14);
    Gm.advance(H, 24 * 3600);
    const ms = Date.now() - t0;
    ok(ms < 4000, `a full day away is simulated in ${ms} ms`);
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.5]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bot.makeBot({ skill });
            const lit = [];
            let bad = null;
            const limit = skill >= 1 ? 220 : 400;
            let h = 0;
            for (; h < limit && !G.ended && !bad; h++) {
                Bot.botPlay(G, bot, 3600, Gm.advance, Gm.checkIn);
                G.lit.forEach((v, i) => { if (v && lit[i] === undefined) lit[i] = h + 1; });
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = `gold ${G.gold}`;
                else if (G.rations < 0) bad = 'negative rations';
                else if (G.party.some((m) => !(m.hp >= 0) || m.hp > Pt.maxHp(m) + 1e-6)) bad = 'health out of range';
                else if (G.road && (G.road.done < 0 || G.road.done > G.road.miles + 1)) bad = 'off the end of the road';
                else if (G.road && !W.isOpen(G, D.ROADS[G.road.id])) bad = 'on a closed road';
                else if (E.cargoUsed(G) > E.cargoCap(G)) bad = 'hold overfull';
                else if (G.party.length > Pt.partySlots(G.level)) bad = 'too many travellers';
                else if (Object.values(G.mats).some((n) => n < 0)) bad = 'negative materials';
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold every hour'}`);
            ok(G.ended, `seed ${s} skill ${skill}: lights every Waystone within ${limit} game hours`);
            if (skill >= 1) ok((lit[0] || 99) >= 1, `seed ${s}: the first Waystone takes at least an hour (${lit[0]}h)`);
            rows.push({ s, skill, lit, h, level: G.level, won: G.stats.won, battles: G.stats.battles, gold: Math.round(G.stats.goldEarned) });
        }
    }
    console.log('  seed skill  hours each Waystone was lit        level  fights won   gold earned');
    for (const r of rows) console.log(`  ${String(r.s).padStart(4)} ${String(r.skill).padStart(5)}  ${r.lit.map((x) => String(x ?? '–').padStart(4)).join('')}${' '.repeat(Math.max(0, 30 - r.lit.length * 4))}  ${String(r.level).padStart(5)}  ${String(r.won).padStart(5)}/${String(r.battles).padEnd(5)}  ${r.gold}`);
    const med = (k) => { const v = rows.filter((r) => r.skill === k).map((r) => r.lit[5] ?? 999).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    ok(med(1) <= med(0.5), `the attentive bot finishes no later than the casual one (median ${med(1)}h vs ${med(0.5)}h)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
