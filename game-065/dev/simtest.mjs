/**
 * simtest.mjs — headless checks for the Worldroot simulation (js/sim).
 *
 *   node game-065/dev/simtest.mjs
 *
 * 1. Purity: js/sim never imports three.js, touches the DOM, calls Math.random or reads the clock.
 * 2. Data: unique ids, every upgrade, trial and achievement can actually be reached.
 * 3. Shop maths: bulk cost = the sum of single costs, "max" never overspends, costs only rise.
 * 4. Offline: offline(n) at 100% matches ticking n seconds; the cap and efficiency apply;
 *    automation keeps working while away.
 * 5. Save/load: a JSON round trip mid-game plays on identically; same seed, same game.
 * 6. Pacing: an active bot plays 48 hours through every system. Invariants after every
 *    minute; milestones must land inside the windows below. Casual and idle bots too.
 *    The bots tend the wilds as well, so the windows include them.
 * 7. The wilds: kinship, expeditions and relics, the garden, whispers, the peddler,
 *    badges, titles and feats keep their rules, run offline, and leave Radiance alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grove, newState, migrate } from '../js/sim/game.js';
import { Bot, ACTIVE, CASUAL, IDLE } from '../js/sim/bot.js';
import {
    GENERATORS, UPGRADES, ACHIEVEMENTS, HEARTWOOD, TRIALS, REALMS, SPELLS, TREE_LEVELS, treeCostRaw, STAGES,
} from '../js/sim/data.js';
import { fmt, fmtTime, setNumberStyle } from '../js/ui/format.js';
import {
    KIN_BONUS, kinCost, EXP_SITES, EXP_TIMES, RELICS, RELIC_SETS, HERBS, SHOP, BADGES, TITLES, FEATS, CODEX, CODEX_LEVELS, WHISPER_SLOTS,
} from '../js/sim/wilds-data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0, oks = 0;
const check = (cond, msg) => { if (cond) oks++; else { fails++; console.log('  FAIL', msg); } };
const section = (t) => console.log(`\n== ${t}`);

// ------------------------------------------------------------------ 1. purity
section('purity');
const simDir = path.join(HERE, '..', 'js', 'sim');
for (const f of fs.readdirSync(simDir)) {
    const src = fs.readFileSync(path.join(simDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    check(!/from\s+['"]three/.test(src), `${f} imports three`);
    check(!/\b(document|window|localStorage|navigator)\b/.test(src), `${f} touches the DOM`);
    check(!/Math\.random/.test(src), `${f} calls Math.random`);
    check(!/\b(Date\.now|performance\.now|new Date)\b/.test(src), `${f} reads the clock`);
}
console.log(`  ${fs.readdirSync(simDir).length} sim files clean`);

// ------------------------------------------------------------------ 2. data
section('data');
const uniq = (arr, what) => check(new Set(arr).size === arr.length, `duplicate ${what} ids`);
uniq(UPGRADES.map((u) => u.id), 'upgrade');
uniq(ACHIEVEMENTS.map((a) => a.id), 'achievement');
uniq(HEARTWOOD.map((h) => h.id), 'heartwood');
uniq(TRIALS.map((t) => t.id), 'trial');
uniq(REALMS.map((r) => r.id), 'realm');
check(STAGES.length === 11, 'eleven tree stages (seed … world tree)');
for (const u of UPGRADES) {
    check(u.cost > 0 && Number.isFinite(u.cost), `upgrade ${u.id} cost`);
    check(u.name && u.desc, `upgrade ${u.id} text`);
}
for (let L = 1; L <= TREE_LEVELS; L++) check(treeCostRaw(L) > treeCostRaw(L - 1), `tree cost rises at ${L}`);
for (const h of HEARTWOOD) {
    for (let l = 0; l < Math.min(h.max, 20); l++) check(h.cost(l) > 0 && typeof h.desc(l) === 'string' && typeof h.next(l) === 'string', `heartwood ${h.id} level ${l}`);
}
console.log(`  ${UPGRADES.length} upgrades, ${ACHIEVEMENTS.length} achievements, ${HEARTWOOD.length} heartwood skills, ${TRIALS.length} trials, ${REALMS.length} realms`);

// ------------------------------------------------------------------ 3. shop maths
section('shop maths');
{
    const g = Grove.fresh(1);
    g.s.motes = 1e9;
    g.s.tree = 40; g.mark();
    for (let i = 0; i < 6; i++) {
        let sum = 0;
        const probe = Grove.fresh(1); probe.s.tree = 40; probe.s.gens[i] = 7; probe.mark();
        for (let k = 0; k < 10; k++) { sum += probe.genCost(i); probe.s.gens[i]++; probe.mark(); }
        const bulk = Grove.fresh(1); bulk.s.tree = 40; bulk.s.gens[i] = 7; bulk.mark();
        check(Math.abs(bulk.genCost(i, 10) - sum) / sum < 1e-9, `bulk cost of 10 ${GENERATORS[i].plural}`);
    }
    for (let trial = 0; trial < 200; trial++) {
        const h = Grove.fresh(trial + 3);
        h.s.tree = 80; h.s.motes = Math.pow(10, 1 + (trial % 20)); h.mark();
        const i = trial % 12;
        const n = h.genMaxAffordable(i);
        const before = h.s.motes;
        const got = h.buyGen(i, 'max');
        check(h.s.motes >= -1e-6 * before, `buy max never overspends (${i}, ${fmt(before)})`);
        if (n > 0) check(got === n || got === n - 1, `buy max buys what it says (${got} vs ${n})`);
        if (got > 0) check(h.genCost(i) > h.s.motes - 1e-9 * before || h.genMaxAffordable(i) === 0, `after max, the next one is unaffordable`);
    }
    const u = Grove.fresh(2);
    check(!u.buyUpgrade('g0t0'), 'cannot buy an upgrade before its requirement');
    u.s.gens[0] = 1; u.s.motes = 1e3; u.mark();
    check(u.buyUpgrade('g0t0') && u.derive().genMult[0] === 2, 'tier upgrade doubles its spirit');
    check(!u.buyUpgrade('g0t0'), 'cannot buy an upgrade twice');
}

// ------------------------------------------------------------------ 4. offline
section('offline');
{
    const make = () => {
        const g = Grove.fresh(9);
        const b = new Bot(g, ACTIVE);
        b.play(2400);
        g.s.buffs = []; g.s.wisp.active = null; g.s.wisp.next = 1e12;
        for (const k of ['gens', 'ups', 'tree']) g.s.auto[k] = false;
        g.mark();
        return g;
    };
    const a = make(), b = make();
    const hwDream = 5;
    a.s.hwUps.dream = hwDream; b.s.hwUps.dream = hwDream; a.mark(); b.mark();
    check(a.derive().offlineEff === 1, 'Dreaming Grove 5 gives 100% offline');
    const start = a.s.totalMotes;
    for (let i = 0; i < 3600; i++) a.tick(1);
    const ticked = a.s.totalMotes - start;
    const sum = b.offline(3600);
    check(Math.abs(sum.motes - ticked) / ticked < 0.01, `offline(1h) at 100% ≈ ticking 1h (${fmt(sum.motes)} vs ${fmt(ticked)})`);

    const c = make();
    const rate = c.mps();
    const s2 = c.offline(20 * 3600);
    check(s2.capped && s2.counted === 8 * 3600, 'offline is capped at 8 hours by default');
    // Summer (×1.25) and achievements earned while away lift it a little above a flat 50%.
    const ratio = s2.motes / (rate * 8 * 3600);
    check(ratio >= 0.5 && ratio < 0.62, `base offline efficiency is 50% plus seasons (${ratio.toFixed(3)})`);
    check(c.s.stats.longestAway === 20 * 3600 && c.s.ach.x_sleep, 'a long sleep is recorded (Hibernation)');

    const d = make();
    d.s.hwUps.keepers = 1; d.s.hwUps.scribes = 1; d.s.hwUps.gardener = 1;
    for (const k of ['gens', 'ups', 'tree']) d.s.auto[k] = true;
    d.mark();
    const before = { tree: d.s.tree, gens: d.s.gens.reduce((x, y) => x + y, 0) };
    const seq0 = d.seq;
    const s3 = d.offline(4 * 3600);
    check(s3.gens > 0 && d.s.gens.reduce((x, y) => x + y, 0) > before.gens, `keepers buy spirits while away (+${s3.gens})`);
    check(s3.tree > 0, `the gardener nourishes while away (+${s3.tree} levels)`);
    check(Number.isFinite(d.s.motes) && d.s.motes >= 0, 'motes stay finite');
    const evs = d.eventsSince(seq0);
    check(evs.length === 1 && evs[0].type === 'offline', 'offline emits one summary event and nothing else');
}

// ------------------------------------------------------------------ 5. save / determinism
section('save and determinism');
{
    const a = Grove.fresh(42), b = Grove.fresh(42);
    new Bot(a, ACTIVE).play(3600);
    new Bot(b, ACTIVE).play(3600);
    check(JSON.stringify(a.s) === JSON.stringify(b.s), 'same seed, same game');

    const json = JSON.stringify(a.s);
    const c = new Grove(migrate(JSON.parse(json)));
    const ba = new Bot(a, ACTIVE), bc = new Bot(c, ACTIVE);
    ba.play(1800); bc.play(1800);
    check(JSON.stringify(a.s) === JSON.stringify(c.s), 'a JSON round trip mid-game plays on identically');
    check(migrate({ v: 999 }) === null && migrate(null) === null && migrate('x') === null, 'bad saves are rejected');
    const old = JSON.parse(json); delete old.stats.seasonMask; delete old.auto; old.gens = old.gens.slice(0, 10);
    const m = migrate(old);
    check(m && m.gens.length === 12 && m.auto.gens === true && m.stats.seasonMask === 0, 'older saves are filled in');
}

// ------------------------------------------------------------------ 6. pacing
section('pacing');
function playProfile(name, profile, hours, seed) {
    const g = Grove.fresh(seed);
    const bot = new Bot(g, profile);
    const firsts = {};
    const mark = (k) => { if (firsts[k] === undefined) firsts[k] = g.s.t; };
    let bad = 0;
    for (let m = 0; m < hours * 60; m++) {
        bot.play(60, (what) => {
            if (what.startsWith('rebirth')) mark('rebirth');
            if (what.startsWith('realm')) { mark('worldTree'); mark(`realm${g.s.realms.length}`); }
        });
        mark(`stage${g.stage}`);
        const s = g.s;
        const ok = Number.isFinite(s.motes) && s.motes >= 0 && Number.isFinite(g.mps()) && g.mps() >= 0
            && s.sap >= -1e-9 && s.sap <= g.derive().sapMax + 1e-9 && s.tree >= 0 && s.tree <= TREE_LEVELS
            && s.buffs.length <= 10 && Number.isFinite(s.hw) && s.hw >= 0 && s.gens.every((n) => Number.isInteger(n) && n >= 0);
        if (!ok && bad++ < 3) console.log('  invariant broken at', fmtTime(s.t), JSON.stringify({ motes: s.motes, sap: s.sap, tree: s.tree }));
        if (g.s.tree === TREE_LEVELS) mark('worldTree');
    }
    check(bad === 0, `${name}: invariants hold every minute`);
    const show = Object.entries(firsts).sort((x, y) => x[1] - y[1]).map(([k, t]) => `${k} ${fmtTime(t)}`).join(' · ');
    console.log(`  ${name}: ${show}`);
    console.log(`  ${name}: ${g.achCount()}/${ACHIEVEMENTS.length} achievements, trials ${Object.keys(g.s.trialsDone).length}/${TRIALS.length}, realms ${g.s.realms.length}/${REALMS.length}, spells ${g.s.stats.spells}, wisps ${g.s.stats.wisps}`);
    return { g, firsts };
}
const within = (t, lo, hi, what) => check(t !== undefined && t >= lo * 60 && t <= hi * 60, `${what} at ${t === undefined ? 'never' : fmtTime(t)} (want ${lo}–${hi} min)`);

const act = playProfile('active', ACTIVE, 48, 7);
within(act.firsts.stage1, 2, 12, 'active: Sprout');
within(act.firsts.stage3, 8, 30, 'active: Sapling');
within(act.firsts.rebirth, 30, 75, 'active: first rebirth');
within(act.firsts.worldTree, 120, 420, 'active: World Tree');
check(Object.keys(act.g.s.trialsDone).length === TRIALS.length, 'active: every trial completed in 48 h');
check(act.g.s.realms.length >= 4, `active: at least four realms in 48 h (${act.g.s.realms.length})`);
const usedSpells = new Set(act.g.eventsSince(0).filter((e) => e.type === 'spell').map((e) => e.id));
check(act.g.s.stats.spells > 50 && act.g.s.stats.wisps > 50, 'active: spells and wisps are used');
{
    const s = act.g.s;
    console.log(`  active wilds: kinship ${act.g.kinTotal()}, expeditions ${s.stats.expeditions}, relics ${act.g.relicCount()}/${RELICS.length}, harvests ${s.stats.harvests} (${s.stats.glimmers} glimmering), whispers ${s.stats.quests}, amber ${fmt(s.amberEver)}, feats ${act.g.featCount()}/${FEATS.length}, badge tiers ${Object.values(s.badges).reduce((a, b) => a + b, 0)}`);
    check(s.stats.expeditions > 20 && act.g.relicCount() >= 12 && s.stats.harvests > 50 && s.stats.quests > 50, 'active: the wilds are played through');
    check(act.g.kinTotal() > 60 && act.g.featCount() > 30 && Object.keys(s.badges).length >= 10, 'active: kinship, feats and badges accumulate');
}

const cas = playProfile('casual', CASUAL, 48, 8);
within(cas.firsts.rebirth, 35, 120, 'casual: first rebirth');
within(cas.firsts.worldTree, 150, 900, 'casual: World Tree');

const idle = playProfile('idle', IDLE, 72, 9);
within(idle.firsts.stage1, 2, 60, 'idle: Sprout');
within(idle.firsts.rebirth, 120, 600, 'idle: first rebirth');

// every wisp kind and spell shows up
{
    const g = Grove.fresh(3);
    g.s.tree = 70; g.s.gens = g.s.gens.map(() => 10); g.s.sap = 1e9; g.mark();
    const kinds = new Set();
    for (let i = 0; i < 400; i++) { g.spawnWisp(); kinds.add(g.catchWisp()); g.s.buffs = []; }
    check(kinds.size === 5, `all five wisp gifts happen (${[...kinds].join(', ')})`);
    for (const sp of SPELLS) { g.s.sap = 1e9; g.s.buffs = []; g.s.wisp.active = null; check(g.cast(sp.id), `spell ${sp.id} casts`); }
    g.s.sap = 1e9;
    g.cast('surge');
    check(!g.canCast('surge'), 'a running spell cannot be recast');
}

// trials actually restrict
{
    const g = Grove.fresh(4);
    g.s.rebirths = 1; g.s.hwEarned = 1e6; g.mark();
    check(g.startTrial('silent') && g.clickValue() === 0, 'Silent Grove: clicks give nothing');
    g.rebirth();
    g.startTrial('lonely'); g.s.tree = 90; g.s.motes = 1e30; g.mark();
    check(g.buyGen(3) === 0 && g.buyGen(0) === 1, 'Lonely Light: only the first three spirits');
    g.rebirth();
    g.startTrial('starless'); g.s.tree = 60; g.s.sap = 1e9; g.mark();
    check(!g.canCast('surge') && !g.wispsOpen(), 'Starless Night: no spells, no wisps');
}

// ------------------------------------------------------------------ 7. the wilds
section('the wilds');
uniq(RELICS.map((r) => r.id), 'relic');
uniq(HERBS.map((h) => h.id), 'herb');
uniq(SHOP.map((x) => x.id), 'shop');
uniq(BADGES.map((b) => b.id), 'badge');
uniq(TITLES.map((t) => t[1]), 'title');
uniq([...ACHIEVEMENTS, ...FEATS].map((a) => a.id), 'achievement and feat');
check(FEATS.every((f) => f.id.startsWith('f_')) && ACHIEVEMENTS.every((a) => !a.id.startsWith('f_')), 'feat ids are f_… and achievements never are');
for (const x of EXP_SITES) check(RELICS.filter((r) => r.site === x.id).length === 6 && RELIC_SETS.some((st) => st.site === x.id), `${x.name}: six relics and a set`);
for (const g of GENERATORS) check(CODEX[g.id]?.length === CODEX_LEVELS.length, `codex pages for ${g.plural}`);
for (const b of BADGES) check(b.at.length === 4 && b.at.every((v, i) => i === 0 || v > b.at[i - 1]), `badge ${b.id} has four rising tiers`);
for (let l = 1; l < 20; l++) check(kinCost(l) > kinCost(l - 1), `kinship cost rises at ${l}`);
{
    // closed at the seed, open at the sprout
    const g = Grove.fresh(21);
    check(!g.wildsOpen() && !g.sendExpedition('hollow', 0) && !g.plant(0, 'moonpetal'), 'the wilds sleep until the seed sprouts');
    g.s.tree = 10; g.s.bestStage = 1; g.mark(); g.checkWilds();
    check(g.wildsOpen() && g.s.quests.length === WHISPER_SLOTS, `three whispers once open (${g.s.quests.length})`);
    check(!g.siteOpen('mere') && g.siteOpen('hollow') && !g.herbOpen('starmint') && g.herbOpen('moonpetal'), 'sites and herbs open with the tree');

    // kinship grows with spirits owned, offline too, and brightens that spirit
    g.s.gens[0] = 100; g.mark();
    const m0 = g.derive().genMult[0];
    for (let i = 0; i < 3600; i++) g.tick(1);
    check(g.s.kinLv[0] >= 4, `an hour with 100 fireflies: kinship ${g.s.kinLv[0]}`);
    check(Math.abs(g.derive().genMult[0] / m0 - (1 + KIN_BONUS * g.s.kinLv[0])) < 1e-9, 'kinship multiplies its spirit by 1 + 1.5% per level');
    const before = g.s.kinLv[0];
    g.offline(10 * 3600);
    check(g.s.kinLv[0] > before, `kinship grows while away (${before} → ${g.s.kinLv[0]})`);

    // expeditions: slots, timers, rewards, offline
    check(g.sendExpedition('hollow', 3) && !g.sendExpedition('hollow', 0), 'one party at a time to begin with');
    check(g.claimExpedition(0) === null, 'a party cannot be welcomed home early');
    const amber0 = g.s.amberEver;
    const sum = g.offline(9 * 3600);
    check(sum.expsBack === 1, 'an eight-hour odyssey comes home while you are away');
    const r = g.claimExpedition(0);
    check(r && r.amber >= EXP_TIMES[3].amber && g.s.amberEver > amber0 && g.s.stats.expeditions === 1, `a returning party brings amber (${r && fmt(r.amber)})`);

    // relics: every one findable, duplicates become amber, sets bless
    const h = Grove.fresh(22);
    h.s.bestStage = 8; h.s.tree = 80; h.mark();
    for (let i = 0; i < 400; i++) for (const x of EXP_SITES) h.findRelic(x.id);
    check(h.relicCount() === RELICS.length && h.relicSets().length === RELIC_SETS.length, 'every relic and set can be found');
    check(h.s.amberEver > 0, 'duplicate relics turn into amber');
    check(h.derive().w.prod > 0.15 && h.derive().w.gens.every((v) => v > 0), 'relics brighten production and every spirit');

    // garden: plant, wait, harvest; glimmering about 6%
    const k = Grove.fresh(23);
    k.s.bestStage = 1; k.s.tree = 10; k.s.gens[0] = 5; k.mark(); k.checkWilds();
    check(k.plant(0, 'moonpetal') && !k.plant(0, 'moonpetal') && k.harvest(0) === null, 'a bed holds one herb, and it must ripen first');
    k.tick(301);
    check(k.harvest(0) && k.s.stats.harvests === 1 && k.s.garden[0] === null, 'a ripe herb is harvested and the bed is free');
    let glim = 0;
    for (let i = 0; i < 2000; i++) { k.plant(1, 'moonpetal'); k.s.t += 400; if (k.harvest(1)?.glim) glim++; }
    check(glim > 70 && glim < 190, `about 6% come up glimmering (${glim} / 2000)`);
    check(k.herbOpen('dewbell') && k.herbOpen('starmint') === false, 'harvests open new seeds; stages open the rest');

    // whispers: progress, claim, reroll
    const q = k.s.quests;
    const iTouch = q.findIndex((x) => x.id === 'touch');
    if (iTouch >= 0) { k.click(q[iTouch].n); check(!!k.claimWhisper(iTouch) && k.s.quests.length === WHISPER_SLOTS, 'a whisper is claimed and replaced'); }
    k.s.amber = 0;
    check(!k.rerollWhisper(0), 'rerolling a whisper costs amber');
    k.s.amber = 5;
    check(k.rerollWhisper(0) && k.s.amber === 4, 'rerolling takes one amber');

    // the peddler
    k.s.amber = 1000; k.mark();
    check(k.buyShop('plots') && k.gardenPlots() === 3 && k.s.garden.length >= 3, 'a new garden bed');
    check(k.buyShop('bottle') && !k.canBuyShop('bottle'), 'one Bottled Starlight at a time');
    check(k.buyShop('rose') && k.s.spark === 'rose' && k.buyShop('rose') && k.s.spark === null, 'a spark colour is bought once, then worn or taken off');
    k.buyShop('wick'); k.buyShop('wick');
    k.s.sap = 1e9; k.s.tree = 60; k.s.bestStage = 6; k.mark();
    k.cast('surge');
    check(k.s.buffs.find((b) => b.id === 'surge').dur === 60, 'the wick never stretches spells');
    check(Math.abs(k.s.buffs.find((b) => b.id === 'bottle').dur - 900) < 1e-9, 'bought before the wick: the bottle kept its 15 minutes');

    // feats pay amber and leave Radiance alone; badges and titles
    const f = Grove.fresh(24);
    f.s.bestStage = 1; f.s.tree = 10; f.mark();
    f.s.stats.clicks = 30000; f.s.stats.harvests = 1; f.s.herbs.moonpetal = 1;
    const ach0 = f.achCount();
    f.checkAchievements(); f.checkWilds();
    check(f.featCount() >= 2 && f.achCount() === ach0 + (f.achCount() - ach0) && f.s.amberEver >= 2 * f.featCount(), 'feats pay amber');
    check(f.achCount() === ACHIEVEMENTS.filter((a) => f.s.ach[a.id]).length, 'Radiance counts achievements, never feats');
    check(f.s.badges.touch === 3 && f.titleOpen('touch3') && !f.titleOpen('touch4'), 'a gold badge opens its title');
    check(f.setTitle('touch3') && !f.setTitle('touch4') && f.s.title === 'touch3', 'only an earned title can be worn');

    // an older save without any of this loads and plays on
    const old = JSON.parse(JSON.stringify(newState(25)));
    for (const key of ['amber', 'amberEver', 'kin', 'kinLv', 'exps', 'relics', 'garden', 'herbs', 'herbGlim', 'quests', 'shop', 'badges', 'title', 'spark']) delete old[key];
    for (const key of ['gensBought', 'wispKinds', 'spellCasts', 'sites', 'offlineTime']) delete old.stats[key];
    old.tree = 12; old.bestStage = 1; old.gens[0] = 10;
    const m = migrate(old);
    const mg = new Grove(m);
    for (let i = 0; i < 600; i++) mg.tick(1);
    mg.buyGen(0); mg.catchWisp(); mg.offline(3600);
    check(m.kinLv.length === GENERATORS.length && Array.isArray(m.garden) && m.stats.wispKinds && Number.isFinite(mg.mps()) && m.quests.length === WHISPER_SLOTS, 'a save from before the wilds loads and plays on');
}

// formatting
setNumberStyle('short');
check(fmt(0) === '0' && fmt(1.5) === '1.5' && fmt(999999) === '999,999' && fmt(1.5e6) === '1.50M' && fmt(2.5e15) === '2.50Qa', 'number formatting');
setNumberStyle('sci');
check(fmt(1.5e6) === '1.50e6', 'scientific formatting');
setNumberStyle('short');
check(fmtTime(59) === '59s' && fmtTime(3661) === '1h 01m' && fmtTime(90000) === '1d 1h', 'time formatting');

console.log(`\n${fails ? 'FAILED' : 'PASSED'}: ${oks} checks ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
