/**
 * simtest.mjs — headless checks of Doom & Doilies' simulation. No browser.
 *
 *   node game-110/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-110/dev/simtest.mjs
 *   HOURS=12 VERBOSE=1 node game-110/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js, js/config.js, js/fmt.js and js/news.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: crafting and flow, minion prices, upgrades, dread and its tiers, cackling, visitors (all four), abilities,
 *    décor, henchmen and schemes, heirlooms, mastery, trophies, relocation and perks.
 * 2b. match3: Skull Swap boards, swaps, specials, cobwebs, goals, stars, a balance table by level, and the grave's
 *    unlock, rewards, saves and relocation.
 * 3. layout: minion slots never stand inside furniture (the real castle is checked in browsertest.mjs).
 * 3b. away: time away is the same rules at the offline rate, capped; a day simulates quickly.
 * 4. determinism: the same seed and commands give the same game; a save round trip mid-game plays on identically;
 *    an unknown save version is rejected; an old save missing new fields still loads.
 * 5. bot: three players (attentive, casual, idle) play HOURS hours each with per-step invariants, and the balance
 *    table is printed: when each milestone came and when each relocation happened.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const HOURS = +(process.env.HOURS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const F = await import('../js/fmt.js');
const N = await import('../js/news.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const run = (G, secs, dt = DT) => { for (let t = 0; t < secs - 1e-9; t += dt) Gm.step(G, dt); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const h = (s) => (s / 3600).toFixed(2) + 'h';
/** A game with some money, so the rules can be poked. */
const rich = (seed = 1, charm = 1e9, gold = 1e5) => { const G = Gm.newGame(seed); G.charm = charm; G.charmRun = charm; G.charmAll = charm; G.gold = gold; return G; };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', 'js/fmt.js', 'js/news.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('rules: crafting, minions, upgrades');
    let G = Gm.newGame(1);
    Gm.act(G, { t: 'craft' });
    ok(G.charm === 1 && G.stats.clicks === 1, 'a craft makes 1 charm at the start');
    ok(G.mastery.cook === 1, 'and counts toward the room’s mastery');
    for (let i = 0; i < 20; i++) { Gm.act(G, { t: 'craft' }); Gm.step(G, 0.1); }
    ok(G.flow >= 60, `quick crafting builds flow (${G.flow.toFixed(0)})`);
    const before = G.charm; Gm.act(G, { t: 'craft' });
    ok(G.charm - before > 1.5, 'and flow makes each craft worth more');
    run(G, 5);
    ok(G.flow === 0, 'flow fades once crafting stops');

    G = rich();
    const c1 = Gm.minionCost(G, 'imp');
    ok(c1 === 15, 'the first imp costs 15');
    ok(Gm.act(G, { t: 'buy', id: 'imp', n: 1 }) && G.owned.imp === 1, 'buying one');
    ok(Gm.minionCost(G, 'imp') === Math.ceil(15 * C.COST_GROWTH), 'the next costs 15% more');
    ok(near(Gm.minionCost(G, 'imp', 10), Math.ceil(15 * C.COST_GROWTH * (C.COST_GROWTH ** 10 - 1) / (C.COST_GROWTH - 1)), 1e-9), 'ten at once cost the geometric sum');
    const nmax = Gm.maxAffordable(G, 'imp');
    ok(Gm.minionCost(G, 'imp', nmax) <= G.charm && Gm.minionCost(G, 'imp', nmax + 1) > G.charm, `“Max” buys exactly as many as you can afford (${nmax})`);
    G = Gm.newGame(2);
    ok(!Gm.act(G, { t: 'buy', id: 'imp', n: 1 }), 'no charm, no imp');
    ok(!Gm.act(G, { t: 'buy', id: 'lich', n: 1 }), 'a minion you haven’t discovered can’t be bought');
    ok(Gm.minionVisible(G, D.MINIONS[0]) && !Gm.minionVisible(G, D.MINIONS[2]), 'the first minion is on offer from the start; the third is not');

    G = rich(3);
    Gm.act(G, { t: 'buy', id: 'imp', n: 10 });
    const r0 = Gm.rates(G);
    ok(near(r0.cpsBy.imp, 10 * 0.1 * r0.global * r0.hobbyMul.cook), 'ten imps make ten times one imp');
    ok(Gm.upgradesOnOffer(G).some((u) => u.id === 'imp0'), 'owning an imp puts its first upgrade on offer');
    Gm.act(G, { t: 'upgrade', id: 'imp0' });
    ok(near(Gm.rates(G).cpsBy.imp, r0.cpsBy.imp * 2), 'Tiny Toques double imps');
    ok(!Gm.act(G, { t: 'upgrade', id: 'imp0' }), 'an upgrade is bought once');
    ok(!Gm.act(G, { t: 'upgrade', id: 'lich7' }), 'an upgrade not on offer can’t be bought');
    const cl0 = Gm.rates(G).click;
    Gm.act(G, { t: 'upgrade', id: 'click0' });
    ok(near(Gm.rates(G).click, cl0 * 2), 'Velvet Oven Mitts double crafting');
    Gm.act(G, { t: 'buy', id: 'spider', n: 15 }); Gm.act(G, { t: 'buy', id: 'imp', n: 5 });
    const spA = Gm.rates(G).cpsBy.imp;
    ok(Gm.act(G, { t: 'upgrade', id: 'syn_imp_spider' }), 'a synergy unlocks at 15 of each');
    ok(near(Gm.rates(G).cpsBy.imp, spA * (1 + 0.01 * 15)), 'imps +1% per spider');
    const offerAll = Gm.upgradesOnOffer(rich(4, 1e30)).length;
    ok(offerAll > 10, `the misc upgrades appear with charm made (${offerAll} on offer)`);
    ok(D.UPGRADES.length === new Set(D.UPGRADES.map((u) => u.id)).size, `upgrade ids are unique (${D.UPGRADES.length})`);
    G = rich(5, 1e40);
    G.owned = Object.fromEntries(D.MINIONS.map((m) => [m.id, 300]));
    let bought = 0;
    for (let guard = 0; guard < 400 && Gm.act(G, { t: 'upgradeAll' }); guard++) bought++;
    ok(Object.keys(G.upg).length === D.UPGRADES.length, `every upgrade can be reached and bought (${Object.keys(G.upg).length}/${D.UPGRADES.length})`);

    section('rules: rooms');
    G = rich(30, 1e9);
    ok(Gm.roomOpen(G, 'cook') && !Gm.roomOpen(G, 'sew') && !Gm.roomOpen(G, 'deco') && !Gm.roomOpen(G, 'party'), 'only the Kitchen is open at first');
    ok(!Gm.act(G, { t: 'room', id: 'sew' }) && G.room === 'cook', 'a locked room can’t be entered');
    Gm.act(G, { t: 'buy', id: 'spider', n: 1 });
    ok(Gm.roomOpen(G, 'sew') && Gm.act(G, { t: 'room', id: 'sew' }) && G.room === 'sew', 'hiring a Spider Seamstress opens the Sewing Loft');
    const m0 = G.mastery.party; Gm.act(G, { t: 'room', id: 'party' }); Gm.act(G, { t: 'craft' });
    ok(G.mastery.party === m0, 'no mastery in a room you can’t enter');
    const oldSave = Gm.serialize(Gm.newGame(31)); oldSave.room = 'party';
    ok(Gm.deserialize(oldSave).room === 'cook', 'a save made in a room that is now locked comes back to the Kitchen');
    G = rich(32, 1e13); Gm.act(G, { t: 'buy', id: 'spider', n: 1 }); Gm.act(G, { t: 'room', id: 'sew' }); G.charmAll = 9e12; Gm.act(G, { t: 'relocate' });
    ok(G.room === 'cook' && !Gm.roomOpen(G, 'sew'), 'a new lair starts in the Kitchen with the other rooms locked again');

    section('rules: dread');
    G = Gm.newGame(6);
    ok(G.dread === C.DREAD.start, 'dread starts at 50');
    run(G, 10);
    ok(G.dread < C.DREAD.start && G.dread > C.DREAD.start - 3, `dread fades on its own (${G.dread.toFixed(1)})`);
    G.owned.imp = 200;
    const d0 = G.dread; run(G, 10);
    ok(d0 - G.dread > 10 * C.DREAD.decay * 1.5, 'and faster in a cosier castle');
    G.dread = 30;
    ok(Gm.act(G, { t: 'cackle' }) && near(G.dread, 30 + C.DREAD.cackle), 'a cackle raises dread');
    ok(!Gm.act(G, { t: 'cackle' }), 'and must cool down');
    run(G, C.DREAD.cackleCd + 0.1);
    ok(Gm.act(G, { t: 'cackle' }), 'before the next one');
    G.dread = 99; Gm.step(G, 5.1); Gm.act(G, { t: 'cackle' });
    ok(G.dread === 100, 'dread tops out at 100');
    const tiers = [[10, 'suspected', 0.8], [30, 'unsettling', 1], [60, 'feared', 1.15], [90, 'dreaded', 1.3]];
    G = rich(7); Gm.act(G, { t: 'buy', id: 'imp', n: 10 });
    const base = (() => { G.dread = 30; return Gm.rates(G).cps; })();
    for (const [d, id, mul] of tiers) { G.dread = d; const R = Gm.rates(G); ok(R.tier.id === id && near(R.cps, base * mul), `${d} dread is ${id}, ×${mul} charm`); }
    G.dread = 60; ok(Gm.rates(G).tribute > 0, 'Feared overlords collect tribute');
    G.dread = 30; ok(Gm.rates(G).tribute === 0, 'Unsettling ones don’t');
    G.dread = 25; G.owned.imp = 0; const ev0 = G.events.length; run(G, 40);
    ok(G.events.slice(ev0).some((e) => e.type === 'tier' && e.to === 'suspected'), 'falling below 20 announces Suspected');
    G = Gm.newGame(8); G.perks.repute = 1; G.dread = 11; G._mods = null; run(G, 60);
    ok(G.dread >= 10, 'An Old Reputation keeps dread at 10 or more');

    section('rules: visitors');
    const visit = (kind, seed = 9) => {
        const G = rich(seed, 1e6);
        Gm.act(G, { t: 'buy', id: 'imp', n: 20 });
        G.dread = 35; G.perks.repute = 0;
        G.visitors.push({ vid: 99, kind, t: 10, life: 10, side: 1 });
        return G;
    };
    G = visit('kitten'); let c0 = Gm.rates(G).cps; Gm.act(G, { t: 'visitor', vid: 99 });
    ok(near(Gm.rates(G).cps, c0 * 7) && G.stats.visitors === 1, 'a kitten brings a Cuddle Frenzy: ×7');
    run(G, 59); ok(Gm.hasBuff(G, 'cuddle'), 'that lasts a minute'); run(G, 2); ok(!Gm.hasBuff(G, 'cuddle') && G.events.some((e) => e.type === 'buffEnd' && e.id === 'cuddle'), 'and then ends');
    G = visit('critic'); c0 = G.charm; Gm.act(G, { t: 'visitor', vid: 99 });
    ok(G.charm > c0, 'a critic brings a lump of charm');
    G = visit('bard'); c0 = Gm.rates(G).click; Gm.act(G, { t: 'visitor', vid: 99 });
    ok(near(Gm.rates(G).click, c0 * 13), 'a bard brings an Encore: crafting ×13');
    G = visit('hero'); G.dread = 40; let g0 = G.gold; Gm.act(G, { t: 'visitor', vid: 99 });
    ok(G.dread === 58 && G.gold > g0 && G.stats.heroes === 1, 'a hero scared off: +18 dread and gold');
    G = visit('hero'); G.dread = 40; Gm.act(G, { t: 'cackle' });
    ok(!G.visitors.length && G.stats.heroes === 1, 'a cackle frightens off a hero too');
    G = visit('hero'); G.dread = 40; run(G, 11);
    ok(!G.visitors.length && G.dread < 40 - 14 && G.stats.heroMiss === 1, 'a hero left alone gossips: −15 dread');
    ok(!Gm.act(G, { t: 'visitor', vid: 12345 }), 'a visitor who has gone can’t be greeted');
    G = Gm.newGame(10); const kinds = {};
    for (let i = 0; i < 300; i++) { G.nextVisit = 0; G.visitors.length = 0; Gm.step(G, DT); for (const v of G.visitors) kinds[v.kind] = (kinds[v.kind] || 0) + 1; }
    ok(D.VISITORS.every((v) => kinds[v.id] > 20), `every kind of visitor turns up (${JSON.stringify(kinds)})`);
    G = Gm.newGame(11); G.dread = 5; const k2 = {};
    for (let i = 0; i < 300; i++) { G.nextVisit = 0; G.visitors.length = 0; G.dread = 5; Gm.step(G, DT); for (const v of G.visitors) k2[v.kind] = (k2[v.kind] || 0) + 1; }
    ok(k2.hero > (kinds.hero || 0) * 1.8, `Suspected overlords get more heroes (${k2.hero} vs ${kinds.hero})`);

    section('rules: abilities');
    G = rich(12); Gm.act(G, { t: 'buy', id: 'imp', n: 10 });
    ok(!Gm.act(G, { t: 'ability', id: 'taste' }), 'Taste Test is locked at first');
    Gm.act(G, { t: 'upgrade', id: 'ab0' }); c0 = Gm.rates(G).click;
    ok(Gm.act(G, { t: 'ability', id: 'taste' }) && near(Gm.rates(G).click, c0 * 10), 'The Tasting Spoon unlocks it: crafting ×10');
    ok(!Gm.act(G, { t: 'ability', id: 'taste' }), 'and it cools down');
    G.charmRun = 1e30; Gm.act(G, { t: 'upgrade', id: 'ab1' }); G.dread = 20;
    ok(Gm.act(G, { t: 'ability', id: 'storm' }) && G.dread === 100, 'Thunderstorm: maximum dread');
    run(G, 30); ok(G.dread === 100, 'held for the length of the storm');
    run(G, 20); ok(G.dread < 100, 'then it fades again');
    Gm.act(G, { t: 'upgrade', id: 'ab2' }); G.dread = 70; c0 = Gm.rates(G).cps;
    ok(Gm.act(G, { t: 'ability', id: 'soiree' }) && near(G.dread, 50) && near(Gm.rates(G).cps, c0 * 3), 'Grand Soirée: ×3 charm and −20 dread');

    section('rules: décor, henchmen, schemes, heirlooms');
    G = rich(13, 1e6, 0);
    ok(!Gm.act(G, { t: 'decor', id: 'banners' }), 'décor needs gold');
    G.gold = 1e5; c0 = Gm.rates(G).cps; Gm.act(G, { t: 'buy', id: 'imp', n: 10 }); c0 = Gm.rates(G).cps;
    ok(Gm.act(G, { t: 'decor', id: 'banners' }) && near(Gm.rates(G).cps, c0 * 1.05), 'Gloom Banners: +5% charm');
    ok(!Gm.act(G, { t: 'decor', id: 'banners' }), 'each piece is bought once');
    ok(Gm.act(G, { t: 'decor', id: 'oven' }) && Gm.rates(G).hobbyMul.cook > 1.29, 'the oven warms the kitchen');
    ok(!Gm.act(G, { t: 'scheme', i: 0 }) || D.SCHEME_BY[G.board[0].id].need === 0, 'no henchmen, no schemes');
    const hc = Gm.henchCost(G); Gm.act(G, { t: 'hench' });
    ok(G.hench === 1 && Gm.henchCost(G) > hc, 'henchmen cost more each time');
    for (let i = 0; i < 20; i++) Gm.act(G, { t: 'hench' });
    ok(G.hench === C.HENCH.max, `the payroll stops at ${C.HENCH.max}`);
    ok(G.board.length === C.BOARD_SLOTS && G.board.every(Boolean), 'the board always has three schemes');
    const card = G.board[0], s = D.SCHEME_BY[card.id];
    const free0 = Gm.henchFree(G);
    ok(Gm.act(G, { t: 'scheme', i: 0 }) && Gm.henchFree(G) === free0 - s.need, 'starting a scheme sends its henchmen');
    ok(G.board[0] && G.board[0].id !== card.id, 'and a new one takes its place');
    const done0 = G.stats.schemes, ch0 = G.charm, go0 = G.gold;
    run(G, s.dur + 1, 0.5);
    ok(G.stats.schemes === done0 + 1 && Gm.henchFree(G) === free0, 'it finishes on its own and the henchmen come home');
    ok((s.charm ? G.charm > ch0 : true) && (s.gold ? G.gold > go0 : true), 'with its rewards');
    G = rich(14, 1e6, 1e6); for (let i = 0; i < 10; i++) Gm.act(G, { t: 'hench' });
    for (let i = 0; i < 4000 && Object.keys(G.heirlooms).length < D.HEIRLOOMS.length; i++) {
        for (let j = 0; j < 3; j++) Gm.act(G, { t: 'scheme', i: j });
        run(G, 120, 1);
    }
    ok(Object.keys(G.heirlooms).length === D.HEIRLOOMS.length, `every heirloom can be found (${Object.keys(G.heirlooms).length})`);
    const S1 = D.SCHEMES.filter((x) => x.kind === 'secret');
    ok(S1.every((x) => x.heir > 0) && D.SCHEMES.filter((x) => x.kind === 'evil').every((x) => !x.heir), 'only secret commissions find heirlooms');

    section('rules: mastery, trophies, relocation, perks');
    ok(Gm.masteryLevel(99) === 0 && Gm.masteryLevel(100) === 1 && Gm.masteryLevel(500) === 2, 'mastery levels at 100, 500, 2,500 …');
    G = rich(15); Gm.act(G, { t: 'buy', id: 'imp', n: 10 }); c0 = Gm.rates(G).cps;
    G.mastery.cook = 1e6;
    ok(near(Gm.rates(G).cps, c0 * (1 + Gm.masteryLevel(1e6) * C.MASTERY.bonus)), 'mastery raises a room’s charm');
    G = Gm.newGame(16); G.charmAll = 1e3; run(G, 1);
    ok(G.ach.charm0 === 1 && G.events.some((e) => e.type === 'ach' && e.id === 'charm0'), 'trophies unlock and announce themselves');
    G.owned.imp = 10; const cA = Gm.rates(G).cps; G.ach.fake = 1; ok(near(Gm.rates(G).cps, cA * (1 + 2 * C.ACH_BONUS) / (1 + C.ACH_BONUS)), 'each trophy is +1% charm'); delete G.ach.fake;
    ok(D.ACHIEVEMENTS.length >= 70 && new Set(D.ACHIEVEMENTS.map((a) => a.id)).size === D.ACHIEVEMENTS.length, `${D.ACHIEVEMENTS.length} trophies with unique ids`);

    G = rich(17, 1e6);
    ok(!Gm.act(G, { t: 'relocate' }), 'no relocating before the first point of legend');
    G = rich(18, 9e12, 500); Gm.act(G, { t: 'buy', id: 'imp', n: 50 }); Gm.act(G, { t: 'decor', id: 'banners' }); G.ach.charm0 = 1; G.heirlooms.pin = 1; G.upg.imp0 = 1;
    const gain = Gm.legendGain(G);
    ok(gain === 2, `9e12 charm is worth 2 legend (${gain})`);
    ok(Gm.act(G, { t: 'relocate' }), 'relocate');
    ok(G.legend.total === 2 && G.runs === 1 && G.lair === 1, 'legend kept, now in the Cinder Caldera');
    ok(G.charm === 0 && G.owned.imp === 0 && !G.upg.imp0 && !G.decor.banners && G.gold === 0 && G.hench === 0, 'charm, minions, upgrades, décor, gold and henchmen left behind');
    ok(G.ach.charm0 && G.heirlooms.pin && G.charmAll >= 9e12, 'trophies, heirlooms and lifetime charm come along');
    ok(Gm.legendGain(G) === 0, 'the same charm can’t be cashed in twice');
    G.owned.imp = 10; c0 = Gm.rates(G).cps;
    ok(near(Gm.rates(G).hobbyMul.cook, 1.5 * 1.1), 'the Caldera’s kitchen (and the rolling pin) are hotter');
    ok(Gm.act(G, { t: 'perk', id: 'headstart' }) && G.legend.spent === 1, 'a perk costs legend points');
    ok(!Gm.act(G, { t: 'perk', id: 'eternal' }), 'and you need enough');
    ok(near(Gm.rates(G).cps, c0), 'spending legend doesn’t lower its +2% bonus');
    G.charmAll = 64e12; Gm.act(G, { t: 'relocate' });
    ok(G.owned.imp === 10 && G.owned.cauldron === 2, 'Head Start: a new lair begins with imps and cauldrons');
    ok(D.PERKS.length === new Set(D.PERKS.map((p) => p.id)).size, 'perk ids are unique');

    section('rules: the gossip ticker and formatting');
    G = rich(19); ok(typeof N.headline(G, 0.5) === 'string', 'there is always a headline');
    G.dread = 5; ok([0, 0.2, 0.4, 0.6, 0.8, 0.99].some((r) => /nice|apron|cupcake/i.test(N.headline(G, r))), 'a Suspected overlord makes the news');
    ok(F.fmt(1234) === '1,234' && F.fmt(12345) === '12.3K' && F.fmt(1.5e9) === '1.50B' && F.fmt(2.5) === '2.5', 'numbers read nicely');
    ok(F.fmtTime(59) === '59s' && F.fmtTime(3700) === '1h 1m', 'times read nicely');
}

if (want('layout')) {
    section('layout (where minions stand)');
    const Ly = await import('../js/view/layout.js');
    const dims = { RW: 12, RD: 8, RH: 7, T: 0.5 };
    // the kitchen counter that a gingerbread golem used to stand inside (v1.0.1)
    const counter = { x0: 2.0, x1: 5.8, y0: 0, y1: 3.3, z0: -3.75, z1: -2.55 };
    const hearth = { x0: -6.0, x1: -2.4, y0: 0, y1: 3.5, z0: -4.1, z1: -2.7 };
    const slots = Ly.makeSlots(0, [counter, hearth], dims);
    for (const m of D.MINIONS.filter((x) => x.hobby === 'cook')) {
        const list = slots[m.id];
        ok(list.length === Ly.SLOTS_PER_KIND, `${m.name}: ${list.length} slots in a furnished kitchen`);
        ok(list.every((sl) => ![counter, hearth].some((o) => Ly.hit(Ly.spriteBox(m.id, sl.x, sl.y, sl.z), o))), `${m.name}s never stand inside the counter or the hearth`);
        ok(list.every((sl) => { const b = Ly.spriteBox(m.id, sl.x, sl.y, sl.z); return b.x0 > -dims.RW / 2 - 0.2 && b.x1 < dims.RW / 2 + 0.2 && sl.z > -dims.RD / 2 && sl.z < dims.RD / 2; }), `${m.name}s stay inside the room`);
    }
    for (let i = 0; i < D.HOBBIES.length; i++) {
        const sl = Ly.makeSlots(i, [], dims);
        ok(D.MINIONS.filter((m) => m.hobby === D.HOBBIES[i].id).every((m) => sl[m.id].length >= Ly.SLOTS_PER_KIND - 1), `an empty ${D.HOBBIES[i].room} has room for every kind`);
    }
    const a = Ly.makeSlots(2, [counter], dims), b = Ly.makeSlots(2, [counter], dims);
    ok(JSON.stringify(a) === JSON.stringify(b), 'the same room gives the same slots every time');
    console.log('  (the browser test checks the real castle: every minion against every piece of furniture, décor and window)');
}

if (want('match3')) {
    section('Skull Swap (the cemetery match-three)');
    const M = await import('../js/sim/match3.js');
    const { makeRng } = await import('../js/rng.js');
    const at = (x, y) => y * M.W + x;
    // a fresh board: full, no matches, at least one move, deterministic
    for (let s = 0; s < 30; s++) {
        const B = M.newBoard(1 + (s % 12), s * 101);
        if (!ok(B.cells.every((k) => k >= 0 && k < B.kinds) && !M.findGroups(B).length && M.hasMove(B), `board ${s}: full, no matches, a move exists`)) break;
    }
    ok(JSON.stringify(M.newBoard(5, 42)) === JSON.stringify(M.newBoard(5, 42)), 'the same level and seed deal the same board');
    const web = M.newBoard(3, 9);
    ok(M.levelSpec(3).type === 'webs' && web.webs.filter(Boolean).length === web.spec.webs && web.websLeft === web.spec.webs, 'a cobweb level spreads its cobwebs');
    // a hand-made board: no runs anywhere ((x + 2y) mod 5), with a four and a five set up on row 3
    const crafted = (five) => {
        const B = M.newBoard(1, 1);
        for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) { B.cells[at(x, y)] = (x + 2 * y) % 5; B.sp[at(x, y)] = 0; }
        for (const x of [0, 1, 3]) B.cells[at(x, 3)] = 0;
        if (!five) B.cells[at(4, 3)] = 2;
        return B;
    };
    let B = crafted(false);
    ok(!M.findGroups(B).length, 'the hand-made board starts with no match');
    const before = JSON.stringify(B);
    let r = M.trySwap(B, at(0, 0), at(2, 0));
    ok(!r.ok && JSON.stringify(B) === before, 'a swap between cells that aren’t neighbours is refused');
    r = M.trySwap(B, at(5, 0), at(6, 0));
    ok(!r.ok && r.steps[0].t === 'bad' && JSON.stringify(B) === before && B.movesLeft === B.moves, 'a swap that makes no match swaps back and costs no move');
    r = M.trySwap(B, at(2, 3), at(2, 4));
    ok(r.ok && B.movesLeft === B.moves - 1, 'a swap that makes a match costs a move');
    ok(r.steps[1].t === 'clear' && r.steps[1].makes.length === 1 && r.steps[1].makes[0].sp === M.SP.row && r.steps[1].makes[0].i === at(2, 3), 'four in a row make a line-clearer where the swap was');
    ok(B.cells.every((k) => k >= 0) && !M.findGroups(B).length, 'after the cascade the board is full and still');
    B = crafted(true);
    r = M.trySwap(B, at(2, 3), at(2, 4));
    ok(r.steps[1].makes[0]?.sp === M.SP.bomb, 'five in a row make a jack-o’-lantern');
    // set the special off: a row-clearer in a match clears its whole row
    B = crafted(false); B.sp[at(0, 3)] = M.SP.row;
    r = M.trySwap(B, at(2, 3), at(2, 4));
    const first = r.steps[1];
    ok(first.fired.some((f) => f.i === at(0, 3)) && [0, 1, 2, 3, 4, 5, 6].every((x) => first.cells.includes(at(x, 3)) || first.makes.some((m) => m.i === at(x, 3))), 'a line-clearer caught in a match clears its row');
    B = crafted(false); B.sp[at(1, 3)] = M.SP.bomb;
    r = M.trySwap(B, at(2, 3), at(2, 4));
    ok([[0, 2], [1, 2], [2, 2], [0, 4], [1, 4]].every(([x, y]) => r.steps[1].cells.includes(at(x, y))), 'a jack-o’-lantern clears the 3×3 around it');
    B = crafted(false); B.spec = { type: 'webs', kinds: 5, moves: 20, webs: 1 }; B.webs[at(1, 3)] = 1; B.websLeft = 1;
    r = M.trySwap(B, at(2, 3), at(2, 4));
    ok(B.websLeft === 0 && B.won && B.over && r.steps[1].webs.includes(at(1, 3)), 'a match on a cobweb clears it, and clearing the last one wins');
    ok(B.stars === 3, 'winning with most moves left is three stars');
    B = crafted(false); B.spec = { type: 'score', kinds: 5, moves: 1, target: 1e9 }; B.moves = B.movesLeft = 1;
    M.trySwap(B, at(2, 3), at(2, 4));
    ok(B.over && !B.won, 'running out of moves short of the goal loses');
    ok(!M.trySwap(B, at(0, 0), at(1, 0)).ok, 'a finished board takes no more swaps');
    for (let L = 1; L <= 80; L++) { const s = M.levelSpec(L); if (!ok(s.moves >= 12 && (s.target > 0 || s.webs > 0 || Object.values(s.need || {}).every((n) => n > 0)), `level ${L} asks for something possible`)) break; }
    // the balance table: the bot that doesn't plan ahead, 16 boards a level
    const row = [];
    let early = 0;
    for (let L = 1; L <= 30; L++) {
        let wins = 0;
        for (let s = 0; s < 16; s++) {
            const b = M.newBoard(L, 500 + s * 31), rr = makeRng(s + 1);
            for (let g = 0; g < 100 && !b.over; g++) { const m = M.botMove(b, 1, rr); if (!m || !M.trySwap(b, m[0], m[1]).ok) break; }
            if (b.won) wins++;
        }
        row.push(wins / 16);
        if (L <= 10) early += wins / 16 / 10;
    }
    console.log('  win rate by level (bot, no look-ahead): ' + row.map((w, i) => `${i + 1}:${Math.round(w * 100)}`).join(' '));
    ok(early >= 0.8, `levels 1–10 are winnable (${Math.round(early * 100)}% for the bot)`);
    ok(row.every((w) => w >= 0.1), 'no level up to 30 is a wall (every one won at least 10% of the time)');

    section('Skull Swap in the castle');
    let G = rich(40, 1e9, 0);
    ok(!Gm.act(G, { t: 'm3start' }), 'the grave is closed at first');
    Gm.act(G, { t: 'buy', id: 'imp', n: 24 }); Gm.step(G, 1);
    ok(!G.yard.open.skull, '24 minions are not enough');
    Gm.act(G, { t: 'buy', id: 'imp', n: 1 }); G.events.length = 0; Gm.step(G, 1);
    ok(G.yard.open.skull && G.events.some((e) => e.type === 'graveOpen' && e.id === 'skull'), 'the 25th minion opens Skull Swap, and says so');
    ok(Gm.act(G, { t: 'm3start' }) && G.yard.m3.board && G.yard.m3.board.level === 1, 'the first level is dealt');
    const b1 = JSON.stringify(G.yard.m3.board); Gm.act(G, { t: 'm3start' });
    ok(JSON.stringify(G.yard.m3.board) === b1, 'coming back carries on with the same board');
    const c0 = G.charm, g0 = G.gold, rr = makeRng(3);
    for (let i = 0; i < 100 && !G.yard.m3.board.over; i++) { const m = M.botMove(G.yard.m3.board, 1, rr); Gm.act(G, { t: 'm3swap', a: m[0], b: m[1] }); }
    const end = G.events.find((e) => e.type === 'm3end');
    ok(end && end.won && G.yard.m3.level === 2 && G.yard.m3.best === 1, 'winning level 1 moves on to level 2');
    ok(G.charm > c0 && G.gold > g0 && end.charm > 0 && end.gold > 0, `and pays charm and gold (${F.fmt(end.charm)} charm, ${end.gold} gold)`);
    Gm.step(G, 1);
    ok(G.ach.m3_0 === 1, 'with a trophy');
    ok(Gm.act(G, { t: 'm3start' }) && G.yard.m3.board.level === 2 && !G.yard.m3.board.over, 'the next start deals level 2');
    // a save in the middle of a level plays on the same
    const mv = M.botMove(G.yard.m3.board, 1, makeRng(1)); Gm.act(G, { t: 'm3swap', a: mv[0], b: mv[1] });
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const m2 = M.botMove(G.yard.m3.board, 1, makeRng(2));
    Gm.act(G, { t: 'm3swap', a: m2[0], b: m2[1] }); Gm.act(copy, { t: 'm3swap', a: m2[0], b: m2[1] });
    ok(JSON.stringify(G.yard) === JSON.stringify(copy.yard), 'a save mid-level plays on identically');
    G.charmAll = 9e12; Gm.act(G, { t: 'relocate' });
    ok(G.yard.open.skull && G.yard.m3.level === 2, 'relocating keeps the cemetery and your Skull Swap level');
    const oldSave = Gm.serialize(Gm.newGame(41)); delete oldSave.yard;
    ok(Gm.deserialize(oldSave).yard.m3.level === 1, 'a save from before the cemetery loads');
    ok(D.GRAVES.filter((g) => !g.soon).length === 1 && D.GRAVES.length === 5, 'five graves, one with a game so far');
}

if (want('away')) {
    section('away');
    const mk = () => { const G = rich(20, 1e8, 0); Gm.act(G, { t: 'buy', id: 'imp', n: 30 }); Gm.act(G, { t: 'buy', id: 'cauldron', n: 20 }); G.dread = 35; G.events.length = 0; return G; };
    let G = mk();
    const R = Gm.rates(G), c0 = G.charm;
    Gm.act(G, { t: 'idle', sec: 600 });
    const e = G.events.find((x) => x.type === 'away');
    ok(e && e.counted === 600, 'ten minutes away count in full');
    ok(Math.abs(G.charm - c0 - R.cps * 600 * C.OFFLINE.rate) < R.cps * 600 * C.OFFLINE.rate * 0.2, `at the offline rate (${F.fmt(G.charm - c0)} vs ~${F.fmt(R.cps * 600 * 0.5)})`);
    ok(!G.events.some((x) => x.type === 'visitor'), 'nobody visits while you’re away');
    G = mk(); Gm.act(G, { t: 'idle', sec: 3 * 86400 });
    ok(G.events.find((x) => x.type === 'away').counted === C.OFFLINE.cap, `three days away count as ${C.OFFLINE.cap / 3600} hours`);
    G = mk(); G.charmRun = 1e30; Gm.act(G, { t: 'upgrade', id: 'off0' }); Gm.act(G, { t: 'upgrade', id: 'off1' });
    ok(Gm.mods(G).offRate === 0.75 && Gm.mods(G).offCap === 16 * 3600, 'upgrades raise the rate and the cap');
    G = mk(); for (let i = 0; i < 3; i++) { G.gold = 1e4; Gm.act(G, { t: 'hench' }); } Gm.act(G, { t: 'scheme', i: 0 });
    const sc = G.stats.schemes; Gm.act(G, { t: 'idle', sec: 3600 });
    ok(G.stats.schemes > sc, 'schemes finish while you’re away');
    const t0 = Date.now(); G = mk(); Gm.act(G, { t: 'idle', sec: 86400 }); const ms = Date.now() - t0;
    ok(ms < 1000, `a day away simulates in ${ms} ms`);
    ok(!Gm.act(G, { t: 'idle', sec: 0 }) && !Gm.act(G, { t: 'idle', sec: NaN }), 'no time, nothing happens');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => {
        const G = Gm.newGame(seed), b = Bt.makeBot({ cps: 5 });
        for (let t = 0; t < secs; t += DT) { for (const c of Bt.botCommands(G, b, DT)) Gm.act(G, c); for (const c of Bt.botShop(G, b)) Gm.act(G, c); Gm.step(G, DT); G.events.length = 0; }
        return G;
    };
    const a = play(42, 300), b = play(42, 300);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    const G = play(7, 400);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ cps: 5 }), b2 = Bt.makeBot({ cps: 5 });
    for (const [g, bot] of [[G, b1], [copy, b2]]) for (let t = 0; t < 300; t += DT) { for (const c of Bt.botCommands(g, bot, DT)) Gm.act(g, c); for (const c of Bt.botShop(g, bot)) Gm.act(g, c); Gm.step(g, DT); g.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const old = Gm.serialize(Gm.newGame(3));
    delete old.stats.bought; delete old.cd; delete old.mastery; old.board = [{ id: 'gone' }];
    const back = Gm.deserialize(old);
    ok(back.stats.bought === 0 && back.cd.cackle === 0 && back.mastery.cook === 0 && back.board.every((c) => c && D.SCHEME_BY[c.id]) && back.board.length === 3, 'an older save missing fields loads with defaults');
}

if (want('bot')) {
    section(`bot (${HOURS} h each)`);
    const players = [
        ['attentive', { cps: 6, every: 1, react: 2 }],
        ['casual', { cps: 2, every: 30, react: 6 }],
        ['idle', { cps: 0.3, every: 600, visitors: false }],
    ];
    const rows = [];
    for (const [label, opt] of players) {
        const G = Gm.newGame(9001), bot = Bt.makeBot(opt), dt = 0.2;
        const marks = [1e3, 1e6, 1e9, 1e12, 1e15], hit = {}, moves = [];
        let bad = null, minDread = 100, suspectT = 0;
        const t0 = Date.now();
        for (let t = 0; t < HOURS * 3600 && !bad; t += dt) {
            for (const c of Bt.botCommands(G, bot, dt)) Gm.act(G, c);
            for (const c of Bt.botShop(G, bot)) if (Gm.act(G, c) && c.t === 'relocate') moves.push(h(G.t));
            Gm.step(G, dt);
            G.events.length = 0;
            if (!Number.isFinite(G.charm) || !Number.isFinite(G.gold) || !Number.isFinite(G.dread)) bad = 'a non-finite number';
            else if (G.charm < -1e-6 * Math.max(1, G.charmRun) || G.gold < -1e-9) bad = `negative money (${G.charm}, ${G.gold})`;
            else if (G.dread < 0 || G.dread > 100) bad = `dread out of range (${G.dread})`;
            else if (G.hench > C.HENCH.max || Gm.henchFree(G) < 0) bad = 'more henchmen out than hired';
            minDread = Math.min(minDread, G.dread);
            if (G.dread < 20) suspectT += dt;
            for (const m of marks) if (!hit[m] && G.charmAll >= m) hit[m] = G.t;
        }
        ok(!bad, `${label}: ${bad || 'invariants hold'}`);
        const owned = D.MINIONS.filter((m) => G.owned[m.id] > 0).length;
        rows.push({ label, hit, moves, legend: G.legend.total, ach: Object.keys(G.ach).length, heir: Object.keys(G.heirlooms).length, decor: Object.keys(G.decor).length, owned, suspect: suspectT / (HOURS * 36), ms: Date.now() - t0 });
    }
    console.log('\n  player      1K      1M      1B      1T      1Qa    relocations (legend)         trophies heirlooms décor  suspected');
    for (const r of rows) {
        console.log(`  ${r.label.padEnd(10)} ${[1e3, 1e6, 1e9, 1e12, 1e15].map((m) => (r.hit[m] !== undefined ? h(r.hit[m]) : '—').padStart(7)).join(' ')}   ${(r.moves.slice(0, 4).join(', ') || '—').padEnd(26)} ★${String(r.legend).padEnd(4)} ${String(r.ach).padStart(4)}  ${String(r.heir).padStart(6)} ${String(r.decor).padStart(6)}  ${r.suspect.toFixed(0).padStart(5)}%  (${r.ms} ms)`);
    }
    const [A, Cs, I] = rows;
    ok(A.hit[1e12] && A.hit[1e12] > 3600 && A.hit[1e12] < 3 * 3600, `an attentive player can first relocate after 1–3 hours (${A.hit[1e12] ? h(A.hit[1e12]) : 'never'})`);
    ok(Cs.hit[1e12] && Cs.hit[1e12] < 4 * 3600, `so can a casual one, within 4 (${Cs.hit[1e12] ? h(Cs.hit[1e12]) : 'never'})`);
    ok(I.hit[1e6] && I.hit[1e6] < 3 * 3600, `a player who checks in every ten minutes still gets going (1M at ${I.hit[1e6] ? h(I.hit[1e6]) : 'never'})`);
    ok(A.hit[1e6] < Cs.hit[1e6] && Cs.hit[1e6] < I.hit[1e6], 'paying attention pays');
    ok(HOURS < 8 || A.moves.length >= 2, `relocating is worth doing more than once (${A.moves.length} relocations)`);
    ok(A.suspect < 10, `the attentive bot keeps up appearances (${A.suspect.toFixed(1)}% of the time Suspected)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
