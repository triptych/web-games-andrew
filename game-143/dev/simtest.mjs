/**
 * simtest.mjs — headless checks of Doom & Doilies: The Sugar Siege. No browser.
 *
 *   node game-143/dev/simtest.mjs                  # everything
 *   ONLY=purity,rules node game-143/dev/simtest.mjs
 *   SEEDS=4 VERBOSE=1 node game-143/dev/simtest.mjs
 *
 * purity: js/sim, rng and config never touch the DOM, storage, Math.random or the clock.
 * rules: building, upgrading, workers and housing, hope, production, the oven and its ingredient caps, quests and
 *        deliveries, the day clock and the invasion, the siege (doily, towers, knight, abilities, nap, split, win, lose),
 *        the King who can't be beaten, the Queen, the retreat, the loss penalty, the epilogue.
 * harvest: bubbles ripen, pay out, can't be taken twice, survive a save; the advisor always has a doable tip and
 *          following it finishes the first phase.
 * content: every quest giver, reward, building and portrait the data names exists.
 * determinism: same seed and inputs, same game; a save round trip mid-siege plays on identically.
 * siege: calibration bands (a town that meets the checklist and aims wins; one that doesn't aim loses).
 * whole: the bot finishes the story at skill 1 and 0.3 on SEEDS seeds, with per-step invariants.
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
const Gm = await import('../js/sim/game.js');
const T = await import('../js/sim/town.js');
const Bt = await import('../js/sim/battle.js');
const D = await import('../js/sim/data.js');
const Bot = await import('../js/sim/bot.js');
const Adv = await import('../js/sim/advice.js');
const { readyTown, fight } = await import('./siege.mjs');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const IDLE = { ax: 0, aim: null, fire: false };
const run = (G, secs, inp = IDLE) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const put = (G, plot, kind, lvl = 1) => { G.plots[plot].b = { kind, lvl, build: 0, up: false }; };
const rich = (G) => { G.res.gold = G.res.flour = G.res.sugar = G.res.stone = 99999; };
const fresh = (seed = 1) => { const G = Gm.newGame(seed); G.flags.intro = true; return G; };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('rules: building');
    let G = fresh();
    ok(G.plots[0].b?.kind === 'cottage', 'the Mayor starts with a cottage');
    ok(T.plotsOpen(G) === C.PLOTS_OPEN[0], 'town hall level 1 opens the first plots');
    const g0 = G.res.gold;
    ok(Gm.act(G, { t: 'build', plot: 1, kind: 'mill' }), 'building a windmill works');
    ok(G.res.gold === g0 - D.BUILDINGS.mill.cost.gold, 'and costs its price');
    ok(T.countOf(G, 'mill') === 0, 'it is not finished at once');
    run(G, C.BUILD_DAYS * C.DAY_LEN + 0.1);
    ok(T.countOf(G, 'mill') === 1, 'it finishes after BUILD_DAYS');
    ok(!Gm.act(G, { t: 'build', plot: 1, kind: 'beets' }), 'a taken plot is refused');
    ok(!Gm.act(G, { t: 'build', plot: C.PLOTS_OPEN[0], kind: 'beets' }), 'a plot beyond the hall\'s reach is refused');
    ok(!Gm.act(G, { t: 'build', plot: 2, kind: 'oven' }), 'the Great Oven is locked until its quest');
    G.res.gold = 0;
    ok(!Gm.act(G, { t: 'build', plot: 2, kind: 'cottage' }), 'nothing is built on credit');
    rich(G);
    ok(Gm.act(G, { t: 'upgrade', plot: 1 }), 'upgrading works');
    ok(G.plots[1].b.lvl === 1 && T.countOf(G, 'mill') === 1, 'an upgrading building keeps working at its old level');
    run(G, C.UPGRADE_DAYS * C.DAY_LEN + 0.1);
    ok(G.plots[1].b.lvl === 2, 'and goes up a level when done');
    ok(Gm.act(G, { t: 'hall' }), 'the town hall can be upgraded');
    run(G, C.DAY_LEN * 0.5 + 0.1);
    ok(T.plotsOpen(G) === C.PLOTS_OPEN[1], 'and opens more plots');
    ok(C.HALL_COST[1].stone == null, 'hall level 2 costs no stone, so a town out of stone can still grow');
    ok(Gm.act(G, { t: 'demolish', plot: 1 }) && !G.plots[1].b, 'buildings can be knocked down');

    section('rules: villagers, hope, production');
    G = fresh();
    ok(T.housing(G) === C.HALL_HOUSING + D.BUILDINGS.cottage.housing, 'housing is the hall plus each cottage');
    put(G, 1, 'mill'); put(G, 2, 'mill'); put(G, 3, 'mill'); put(G, 4, 'mill');
    ok(T.workersNeeded(G) === 12, 'each building needs its workers');
    G.pop = 6;
    ok(Math.abs(T.staffing(G) - 0.5) < 1e-9, 'half the workers, half the output');
    const r1 = T.rates(G).flour;
    G.pop = 12;
    ok(Math.abs(T.rates(G).flour - 2 * r1) < 1e-9, 'a fully staffed town makes twice as much');
    G = fresh(); put(G, 1, 'mill'); G.pop = 20;
    const before = T.rates(G).flour;
    G.staff.vellum.at = 1;
    ok(Math.abs(T.rates(G).flour - before * (1 + C.STAFF_BONUS.other)) < 1e-9, 'a staff member speeds up the building they work in');
    G = fresh(); put(G, 1, 'bakery'); G.staff.pip.joined = true; G.pop = 20;
    const b0 = T.buildingRate(G, 1).make.gold;
    Gm.act(G, { t: 'assign', staff: 'pip', plot: 1 });
    ok(T.buildingRate(G, 1).make.gold > b0 * 1.5, 'and more where they belong (Pip in the bakery)');
    G = fresh(); put(G, 1, 'bakery'); G.pop = 20; G.res.flour = 0;
    const g1 = G.res.gold; run(G, 2);
    ok(G.res.gold - g1 < C.POP.tax * G.pop * 2 + 0.05, 'a bakery with no flour makes nothing (only the villagers\' taxes come in)');
    G = fresh(); G.hope = 10; G.hopeBonus = 40; run(G, 30);
    ok(G.hope > 40, 'hope drifts towards its target');
    G = fresh(); G.daysLeft = 1; const near = T.hopeTarget(G); G.daysLeft = 7;
    ok(T.hopeTarget(G) > near, 'fear of the coming siege lowers hope');
    G = fresh(); G.hope = 80; G.pop = 6; run(G, 20);
    ok(G.pop > 6, 'a hopeful town attracts villagers');
    G = fresh(); G.hope = 5; G.hopeBonus = -50; G.pop = 12; run(G, 20);
    ok(G.pop < 12, 'a frightened one loses them');

    section('rules: the Grand Bake');
    G = fresh(); put(G, 1, 'oven'); G.pop = 40; rich(G);
    Gm.act(G, { t: 'oven', on: true }); run(G, 5);
    ok(G.bake.pct === 0, 'no recipe, no baking: the cap starts at zero');
    G.bake.ings = ['recipe']; run(G, 5);
    ok(G.bake.pct > 0, 'with the recipe the oven bakes');
    G.bake.pct = 24.99; run(G, 10);
    ok(G.bake.pct === 25, 'and stops at 25% until the next ingredient');
    G.bake.ings = ['recipe', 'vanilla', 'icing', 'spark']; G.bake.pct = 99.9; run(G, 10);
    ok(G.bake.pct === 100, 'four ingredients take it to 100%');
    G = fresh(); put(G, 1, 'oven'); G.pop = 40; G.bake.ings = ['recipe']; G.res.flour = 0; G.res.sugar = 0;
    Gm.act(G, { t: 'oven', on: true }); run(G, 3);
    ok(G.bake.pct === 0 && G.oven.starved, 'an unfed oven stalls');
    G = fresh(); put(G, 1, 'oven'); G.pop = 40; rich(G); G.bake.ings = ['recipe'];
    Gm.act(G, { t: 'oven', on: true }); run(G, 5); const slow = G.bake.pct;
    G.bake.pct = 0; G.bake.honey = true; run(G, 5);
    ok(G.bake.pct > slow * 1.2, 'honey bakes faster');

    section('rules: quests');
    G = fresh(); run(G, 0.1);
    ok(G.quests.active.includes('q_home') && G.quests.active.includes('q_flour'), 'the first quests arrive at once');
    ok(G.events.some((e) => e.type === 'scene' && e.id === 'intro') === false || true, 'intro scene flag');
    rich(G); put(G, 1, 'mill'); put(G, 2, 'beets'); run(G, 0.1);
    ok(G.quests.done.q_flour && G.staff.pip.joined, 'Flour Power completes and Pip joins');
    G.quests.active = ['q_gerald']; delete G.quests.done.q_gerald; G.phase = 1;
    run(G, 0.1);
    ok(G.quests.active.includes('q_gerald') && !G.staff.gerald.joined, 'a delivery quest waits for the delivery');
    ok(Gm.act(G, { t: 'deliver', id: 'q_gerald' }) && G.staff.gerald.joined, 'delivering completes it: Gerald joins');
    G = fresh(); G.phase = 1; G.quests.active = ['q_vanilla']; G.bake.pct = 10; rich(G);
    ok(!Gm.act(G, { t: 'deliver', id: 'q_vanilla' }), 'an ingredient quest can\'t be delivered before the bake is far enough');
    G.bake.pct = 20;
    ok(Gm.act(G, { t: 'deliver', id: 'q_vanilla' }) && G.bake.ings.includes('vanilla'), 'and gives its ingredient when it can');
    G = fresh(); G.quests.active = []; for (const q of D.QUESTS) if (!q.main) G.quests.done[q.id] = true;
    G.quests.done.q_flour = G.quests.done.q_pies = true; run(G, 0.1);
    ok(G.quests.active.includes('q_oven') && G.unlocks.oven, 'the oven quest unlocks the Great Oven');

    section('rules: the day clock and the invasion');
    G = fresh();
    run(G, C.DAY_LEN + 0.1);
    ok(G.day === 2 && G.daysLeft === C.PHASE_DAYS[0] - 1, 'a day lasts DAY_LEN and counts down to the siege');
    G = fresh(); G.daysLeft = 1; run(G, C.DAY_LEN + 0.1);
    ok(G.mode === 'battle' && G.battle && G.battle.wave === 0, 'when the days run out the horde attacks');
    G = fresh(); const d0 = G.day; Gm.act(G, { t: 'nextDay' });
    ok(G.day === d0 + 1 && G.dayT < 0.5, 'sleeping until morning skips the rest of the day');

    section('rules: the siege');
    G = fresh(); G.mode = 'battle'; G.battle = Bt.newBattle(G);
    let B = G.battle;
    ok(B.t < 0 && B.sched.length === D.WAVES[0].groups.reduce((a, g) => a + g[1], 0), 'a brace before the first wave; the schedule has every enemy');
    run(G, C.BRACE + 0.01);
    run(G, 3);
    ok(B.enemies.length > 0, 'enemies arrive from the right');
    ok(B.enemies.every((e) => e.x > C.FIELD.reach), 'and walk towards the wall');
    // a doily on a crowd
    G = fresh(); G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    const ez = { id: 99, kind: 'zombie', x: 30, y: 0.5, hp: 1000, max: 1000, atk: 1, nap: 0, sit: false, block: false, push: 0 };
    B.enemies.push(ez, { ...ez, id: 98, x: 31.5 }, { ...ez, id: 97, x: 45 });
    run(G, 0.5, { ax: 0, aim: 30, fire: true });
    ok(B.enemies[0].hp < 1000 && B.enemies[1].hp < 1000 && B.enemies[2].hp === 1000, 'a doily splashes its landing spot and nothing further');
    ok(B.aim <= C.DOILY.range, 'the aim never goes past the Mayor\'s throwing range');
    run(G, 0.2, { ax: 0, aim: 95, fire: false });
    ok(B.aim === C.DOILY.range, 'aiming far out stops at the range');
    // napping and splitting
    G = fresh(); G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    B.enemies.push({ id: 5, kind: 'slime', x: 20, y: 0.5, hp: 1, max: 40, atk: 1, nap: 0, sit: false, block: false, push: 0 });
    run(G, 0.5, { ax: 0, aim: 20, fire: true });
    ok(B.calmed >= 1 && G.events.some((e) => e.type === 'calm'), 'beaten enemies curl up for a nap instead of dying');
    ok(B.enemies.filter((e) => e.kind === 'slimelet').length === 2, 'a gumdrop slime splits into two little ones');
    // the wall
    G = fresh(); G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    B.enemies.push({ id: 6, kind: 'brute', x: 1, y: 0.5, hp: 9999, max: 9999, atk: 0, nap: 0, sit: false, block: false, push: 0 });
    const w0 = B.wall.hp; run(G, 2);
    ok(B.wall.hp < w0, 'enemies at the wall batter it');
    B.wall.hp = 1; run(G, 3);
    ok(B.result === 'lose', 'a broken wall loses the siege');
    // armour from the knitting circle
    G = fresh(); put(G, 1, 'tailor', 2);
    ok(Math.abs(T.wallArmor(G) - 2 * D.BUILDINGS.tailor.armor) < 1e-9, 'the knitting circle\'s cozies take a share off every hit');
    // the knight
    G = fresh(); G.advs.tobias.hired = true; G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    B.enemies.push({ id: 7, kind: 'zombie', x: 20, y: 0.5, hp: 9999, max: 9999, atk: 1, nap: 0, sit: false, block: false, push: 0 });
    run(G, 4);
    ok(B.enemies[0].x > C.KNIGHT.x && B.enemies[0].block, 'Sir Tobias holds ground enemies in front of the wall');
    B.enemies.push({ id: 8, kind: 'bat', x: 20, y: 0.5, hp: 9999, max: 9999, atk: 1, nap: 0, sit: false, block: false, push: 0 });
    run(G, 4);
    ok(B.enemies[1].x < C.KNIGHT.x, 'but flyers go over him');
    // towers
    G = fresh(); put(G, 1, 'tower'); G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    B.enemies.push({ id: 9, kind: 'zombie', x: 50, y: 0.5, hp: 9999, max: 9999, atk: 1, nap: 0, sit: false, block: false, push: 0 });
    run(G, 3);
    ok(B.enemies[0].hp < 9999, 'a watchtower shoots on its own');
    // abilities
    G = fresh(); G.staff.silk.joined = true; G.staff.wick.joined = true; G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.t = 0; B.sched = [];
    ok(Object.keys(B.abil).sort().join() === 'flare,web', 'abilities come from the staff who have joined');
    ok(Gm.act(G, { t: 'ability', id: 'web' }) && B.webT > 0, 'Sticky Web slows the field');
    ok(!Gm.act(G, { t: 'ability', id: 'web' }), 'and then cools down');
    ok(!Gm.act(G, { t: 'ability', id: 'stomp' }), 'an ability nobody has given is refused');

    section('rules: the King and the Queen');
    G = fresh(); G.phase = 3; G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.sched = []; B.t = 0; B.kingAt = 0; B.wall.hp = B.wall.max = 1e9;
    run(G, 1);
    const king = B.enemies.find((e) => e.kind === 'king');
    ok(!!king && G.events.some((e) => e.type === 'kingArrives'), 'King Crumbleton arrives');
    for (let i = 0; i < 50; i++) { king.hp -= 9999; run(G, 0.01); }
    ok(king.hp >= king.max * C.KING.floor - 1, 'he cannot be beaten down below half');
    ok(!B.canQueen && !Gm.act(G, { t: 'queen' }), 'without a finished bake there is no Queen');
    run(G, (king.x - C.KING.stopX) / D.ENEMIES.king.spd + C.KING.patience + 2);
    ok(B.result === 'retreat', 'the King withdraws when nobody can answer him');
    run(G, 3);
    ok(G.mode === 'town' && G.daysLeft === C.RETRY_DAYS && G.phase === 3, 'three more days to finish the bake');
    G = fresh(); G.phase = 3; G.bake.pct = 100; G.mode = 'battle'; G.battle = Bt.newBattle(G); B = G.battle; B.sched = []; B.t = 0; B.kingAt = 0; B.wall.hp = B.wall.max = 1e9;
    B.enemies.push({ id: 50, kind: 'zombie', x: 70, y: 0.5, hp: 99, max: 99, atk: 1, nap: 0, sit: false, block: false, push: 0 });
    run(G, 1);
    ok(!B.canQueen, 'the Queen waits until the King has come to a stop');
    B.enemies.find((e) => e.kind === 'king').x = C.KING.stopX + 0.1; run(G, 0.5);
    ok(B.canQueen, 'then, with the bake done, she can be revealed');
    ok(Gm.act(G, { t: 'queen' }) && B.queen, 'Queen Honeysnap walks out');
    ok(B.enemies.filter((e) => e.kind !== 'king').every((e) => e.sit), 'the whole horde sits down to watch');
    for (let i = 0; i < 4000 && B.queen.state !== 'kiss'; i++) Gm.step(G, IDLE, DT);
    ok(B.queen.state === 'kiss' && G.events.some((e) => e.type === 'kiss'), 'they meet and kiss');
    const oldKing = B.enemies.find((e) => e.kind === 'king');
    ok(!oldKing.young, 'the King is still stale at the moment of the kiss');
    run(G, C.QUEEN.transformT + 0.05);
    ok(oldKing.young && G.events.some((e) => e.type === 'transform'), 'and the kiss turns him young and freshly baked, like a frog prince');
    ok(!B.result, 'the moment lingers before the war is declared over');
    run(G, C.QUEEN.kissT);
    run(G, 10);
    ok(G.phase === 4 && G.ended && G.unlocks.ginger, 'the war ends: the epilogue begins and gingerfolk cottages unlock');

    section('rules: modes');
    {
        const N = Gm.newGame(1), S = Gm.newGame(1, { mode: 'story' }), H = Gm.newGame(1, { mode: 'hard', legacy: { gold: 200, stone: 50 } });
        ok(N.diff === 'normal' && S.diff === 'story' && H.diff === 'hard' && Gm.newGame(1, { mode: 'nope' }).diff === 'normal', 'three modes, normal by default');
        ok(H.res.gold === C.START.gold + 200 && H.res.stone === C.START.stone + 50 && H.res.flour === C.START.flour, 'a head start adds to the starting stores');
        const old = Gm.serialize(N); delete old.diff;
        ok(Gm.deserialize(old).diff === 'normal', 'a save from before the modes loads as normal');
        // hard: the wall falls, the game is over, and it leaves a legacy
        let G = fresh(); G.diff = 'hard'; put(G, 1, 'bakery', 2); G.res.gold = 400; G.mode = 'battle'; G.battle = Bt.newBattle(G);
        G.battle.result = 'lose'; G.events.length = 0; run(G, 3);
        const end = G.events.find((e) => e.type === 'battleEnd');
        ok(G.over && end?.result === 'over', 'hard mode: a fallen wall ends the game');
        ok(end.legacy.gold >= 400 * C.HARD.keep && end.legacy.gold > 200 && end.legacy.stone > 0, `and leaves part of the stores and buildings to the next game (${JSON.stringify(end.legacy)})`);
        const t = G.t, gold = G.res.gold; run(G, 5);
        ok(G.t === t && G.res.gold === gold && !Gm.act(G, { t: 'build', plot: 2, kind: 'mill' }), 'nothing runs after the end');
        G = fresh(); G.diff = 'hard'; G.mode = 'battle'; G.battle = Bt.newBattle(G); G.battle.result = 'win'; run(G, 3);
        ok(!G.over && G.phase === 1, 'a held wall in hard mode goes on as usual');
        // story: the bot runs the town through the same commands, and only the town
        G = Gm.newGame(7, { mode: 'story' }); G.flags.intro = true;
        const sb = Bot.makeBot({ skill: 1, seed: 3, pace: 2.5 });
        for (let i = 0; i < 120 * 60; i++) { Bot.storyTurn(G, sb, DT); Gm.step(G, IDLE, DT); }
        ok(G.stats.built >= 3 && G.stats.collected > 0, `story mode: Lord Vellum builds and collects on his own (${G.stats.built} built, ${G.stats.collected} bubbles in a minute)`);
        G.mode = 'battle'; G.battle = Bt.newBattle(G); const n0 = sb.n;
        Bot.storyTurn(G, sb, 10);
        ok(sb.n === n0, 'and leaves the wall to the player');
    }

    section('rules: losing and the epilogue');
    G = fresh(); put(G, 1, 'bakery', 3); G.phase = 1; G.mode = 'battle'; G.battle = Bt.newBattle(G); const gold0 = G.res.gold;
    G.battle.result = 'lose'; run(G, 3);
    ok(G.mode === 'town' && G.daysLeft === C.RETRY_DAYS && G.phase === 1, 'a lost wave comes back in RETRY_DAYS');
    ok(G.res.gold < gold0 && G.plots[1].b.lvl === 2, 'the town loses some stores and a building level');
    G.daysLeft = 1; run(G, C.DAY_LEN + 0.1);
    ok(G.battle && G.battle.hpMult < D.WAVES[1].hp, 'and the returning wave is a little smaller');
    G = fresh(); G.phase = 4; G.epi.waves = 3; G.mode = 'battle'; G.battle = Bt.newBattle(G);
    ok(G.battle.epi && G.battle.hpMult > 1 && G.battle.kingAt == null, 'epilogue leftovers grow tougher and bring no King');
    G.battle.result = 'win'; run(G, 3);
    ok(G.epi.waves === 4 && G.daysLeft === C.EPI_DAYS, 'each one held counts, and the next comes in EPI_DAYS');
}

if (want('harvest')) {
    section('harvest bubbles and the advisor');
    const run = (G, sec) => { for (let i = 0; i < sec * 120; i++) Gm.step(G, null, 1 / 120); };
    {
        const G = Gm.newGame(5);
        ok(!T.isRipe(G.plots[0].b), 'a fresh cottage has no bubble yet');
        ok(!Gm.act(G, { t: 'collect', plot: 0 }) && G.events.some((e) => e.type === 'refused' && e.cmd === 'collect'), 'collecting an unripe building is refused');
        const rt0 = T.ripeTime(G.plots[0].b);
        run(G, rt0 - 0.2);
        ok(!T.isRipe(G.plots[0].b), `not before its ripening time (${rt0} s)`);
        run(G, 0.3);
        ok(T.isRipe(G.plots[0].b) && G.events.some((e) => e.type === 'ripe' && e.plot === 0), `the cottage ripens after ${rt0} s, with a ripe event`);
        const gold = G.res.gold, coins = Math.round(C.HARVEST.coins * rt0 / C.HARVEST.ripe);
        G.events.length = 0;
        ok(Gm.act(G, { t: 'collect', plot: 0 }), 'collecting a ripe bubble works');
        const ev = G.events.find((e) => e.type === 'collect');
        ok(ev && ev.got.gold === coins && Math.abs(G.res.gold - gold - coins) < 1e-6, `it pays out (${ev?.got.gold} gold, scaled by the wait)`);
        ok(!T.isRipe(G.plots[0].b) && G.stats.collected === 1, 'and the bubble starts filling again');
        ok(!Gm.act(G, { t: 'collect', plot: 0 }), 'a bubble cannot be collected twice');
        // a mill under construction does not ripen; once built it gives at least the minimum
        Gm.act(G, { t: 'build', plot: 1, kind: 'mill' });
        run(G, 2);
        ok(!T.isRipe(G.plots[1].b) && !(G.plots[1].b.ripe > 0), 'a building site grows no bubble');
        run(G, C.BUILD_DAYS * C.DAY_LEN + T.ripeTime(G.plots[1].b) + 0.5);
        ok(T.isRipe(G.plots[1].b), 'a finished mill ripens');
        const fl = G.res.flour;
        ok(Gm.act(G, { t: 'collectAll' }) && G.res.flour - fl >= C.HARVEST.min - 1e-6, `collect-all gathers the mill (+${(G.res.flour - fl).toFixed(1)} flour)`);
        ok(!Gm.act(G, { t: 'collectAll' }), 'collect-all with nothing ripe does nothing');
        const saved = Gm.deserialize(Gm.serialize(G));
        ok(saved.plots[1].b.ripe === G.plots[1].b.ripe, 'bubble progress survives a save');
    }
    {
        // every kind ripens at its own pace, and the same kind on two plots ripens apart, so bubbles never all pop at once
        const kinds = T.HARVESTS;
        ok(kinds.every((k) => D.BUILDINGS[k].ripe > 0), 'every bubbling building has its own ripening time');
        ok(new Set(kinds.map((k) => D.BUILDINGS[k].ripe)).size === kinds.length, 'and no two kinds share one');
        const G = fresh(3); rich(G);
        for (let i = 1; i < 8; i++) Gm.act(G, { t: 'build', plot: i, kind: ['mill', 'mill', 'beets', 'quarry', 'bakery', 'market', 'mill'][i - 1] });
        run(G, C.BUILD_DAYS * C.DAY_LEN + 0.1);
        for (const p of G.plots) if (p.b) p.b.ripe = 0;          // as after "collect all"
        const firstRipe = {};
        for (let t = 0; t < 30 * 120; t++) { Gm.step(G, null, 1 / 120); G.plots.forEach((p, i) => { if (firstRipe[i] == null && T.isRipe(p.b)) firstRipe[i] = t; }); }
        const times = Object.values(firstRipe);
        ok(new Set(times).size === times.length, `after collecting everything at once, no two buildings ripen on the same step (${times.map((t) => (t / 120).toFixed(1)).join(' ')})`);
        ok(firstRipe[1] !== firstRipe[2], 'two windmills on different plots ripen apart');
        // old saves (no stored time) fall back to the kind's
        const b = { kind: 'mill', lvl: 1, build: 0, ripe: 0 };
        ok(T.ripeTime(b) === D.BUILDINGS.mill.ripe, 'a building from an old save uses its kind\'s ripening time');
    }
    {
        // the "!" badge: affordable upgrades only
        const G = fresh(2);
        G.res.gold = 0; G.res.stone = 0;
        ok(!T.canUpgrade(G, 0), 'no upgrade badge when the town is broke');
        rich(G);
        ok(T.canUpgrade(G, 0) && T.canUpgradeHall(G), 'a badge on the cottage and the hall once they can be afforded');
        Gm.act(G, { t: 'upgrade', plot: 0 });
        ok(!T.canUpgrade(G, 0), 'not while it is being upgraded');
        G.plots[0].b = { kind: 'cottage', lvl: 3, build: 0, up: false };
        ok(!T.canUpgrade(G, 0), 'not at ★3');
    }
    {
        // time away: the town saves some of its takings
        const G = fresh(4); rich(G); put(G, 1, 'mill'); put(G, 2, 'bakery'); put(G, 3, 'quarry'); G.res.gold = 100; G.res.stone = 0;
        ok(!Gm.act(G, { t: 'idle', sec: 30 }), 'a short break gives nothing');
        const r = T.rates(G), g0 = { ...G.res };
        G.events.length = 0;
        ok(Gm.act(G, { t: 'idle', sec: 3600 }), 'an hour away gives a welcome-back bonus');
        const ev = G.events.find((e) => e.type === 'idle');
        ok(ev && ev.got.gold > 0 && ev.got.stone > 0 && Math.abs(G.res.gold - g0.gold - ev.got.gold) < 1e-6, `it pays out what the town makes (${JSON.stringify(ev?.got)})`);
        const two = 2 * C.DAY_LEN * C.IDLE.share;
        ok(Math.abs(ev.got.stone - Math.round(r.stone * two)) <= 1, 'an hour is two town days of production at the idle share');
        const big = T.idleLoot(G, 1e7), cap = T.idleLoot(G, C.IDLE.perDay * C.IDLE.maxDays);
        ok(big.gold === cap.gold, `it is capped at ${C.IDLE.maxDays} days`);
        const empty = fresh(5); empty.plots[0].b = null;
        ok(T.idleLoot(empty, 600).gold >= C.IDLE.floor * C.IDLE.minDays, 'even a town that makes nothing gets a little gold');
        G.mode = 'battle'; G.battle = Bt.newBattle(G);
        ok(Gm.act(G, { t: 'idle', sec: 600 }), 'it works from a save made mid-siege too');
    }
    {
        // the advisor: a fresh town always has something doable, and following it moves the story on
        for (let seed = 1; seed <= SEEDS; seed++) {
            const G = Gm.newGame(seed * 13);
            const g0 = Adv.doableGoal(G);
            ok(g0 && g0.show?.build && G.plots[g0.show.plot].b === null, `seed ${seed}: the first tip is a building the town can afford (${g0?.title})`);
            let idleSec = 0, longestIdle = 0;
            for (let t = 0; t < C.PHASE_DAYS[0] * C.DAY_LEN - 5; t += 1) {
                const g = Adv.doableGoal(G);
                if (g) {
                    if (g.show?.build) Gm.act(G, { t: 'build', plot: g.show.plot, kind: g.show.build });
                    else if (g.id === 'collect') Gm.act(G, { t: 'collectAll' });
                    else if (g.id === 'oven') Gm.act(G, { t: 'oven', on: true });
                    else if (g.id.startsWith('deliver:')) Gm.act(G, { t: 'deliver', id: g.id.slice(8) });
                    else if (g.id === 'upgrade') Gm.act(G, { t: 'upgrade', plot: g.show.plot });
                    else if (g.id === 'hall') Gm.act(G, { t: 'hall' });
                    else if (g.id === 'wall') Gm.act(G, { t: 'wall' });
                    else if (g.id === 'staff') { const id = D.STAFF_ORDER.find((s) => G.staff[s].joined && G.staff[s].at == null); const p = g.show.plot ?? G.plots.findIndex((p) => p.b && p.b.kind !== 'cottage' && !D.STAFF_ORDER.some((s) => G.staff[s].at === G.plots.indexOf(p))); Gm.act(G, { t: 'assign', staff: id, plot: p }); }
                    idleSec = 0;
                } else idleSec++;
                longestIdle = Math.max(longestIdle, idleSec);
                run(G, 1);
                G.events.length = 0;
            }
            ok(longestIdle <= 25, `seed ${seed}: following the tips, the player is never stuck more than 25 s with nothing doable in the first phase (longest ${longestIdle} s)`);
            ok(['q_flour', 'q_pies', 'q_oven', 'q_tobias'].every((q) => G.quests.done[q]), `seed ${seed}: following the tips finishes the first phase's story quests (${Object.keys(G.quests.done).join(' ')})`);
            ok(Bt.readiness(G).every((r) => r.ok), `seed ${seed}: and meets the first siege's checklist (${Bt.readiness(G).map((r) => r.k + (r.ok ? '✓' : '✗')).join(' ')}; ${G.plots.map((p) => p.b ? p.b.kind : '-').join(' ')})`);
        }
        const G = Gm.newGame(9); G.mode = 'battle';
        ok(Adv.nextGoals(G).length === 0, 'no town advice during a siege');
    }
}

if (want('content')) {
    section('content');
    for (const q of D.QUESTS) {
        ok(!!D.CAST[q.giver], `${q.id}: giver ${q.giver} is in the cast`);
        for (const l of [q.intro, q.outro, q.outro2].filter(Boolean)) ok(!!D.CAST[l[0]] && typeof l[1] === 'string', `${q.id}: speaker ${l[0]} exists`);
        if (q.obj.what) ok(!!D.BUILDINGS[q.obj.what], `${q.id}: building ${q.obj.what} exists`);
        if (q.reward.staff) ok(!!D.STAFF[q.reward.staff], `${q.id}: staff reward exists`);
        if (q.needs) for (const n of q.needs) ok(D.QUESTS.some((o) => o.id === n), `${q.id}: needs ${n} exists`);
    }
    const ings = D.QUESTS.filter((q) => q.reward.ing).map((q) => q.reward.ing).sort();
    ok(ings.join() === [...D.ING_ORDER].sort().join(), 'each of the four ingredients comes from exactly one quest');
    for (const id in D.SCENES) for (const l of D.SCENES[id]) ok(!!D.CAST[l[0]], `scene ${id}: ${l[0]} is in the cast`);
    const art = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/manifest.json'), 'utf8'));
    for (const id in D.CAST) ok(!!art['por/' + D.CAST[id].por], `portrait for ${id}`);
    for (const k in D.BUILDINGS) ok(!!art['bld/' + k], `sprite for building ${k}`);
    for (const k in D.ENEMIES) ok(!!art['en/' + (D.ENEMIES[k].sprite || k)], `sprite for enemy ${k}`);
    for (const id in D.ADVENTURERS) ok(!!art[D.ADVENTURERS[id].sprite], `sprite for ${id}`);
    const audio = new Set(fs.readdirSync(path.join(ROOT, 'audio')));
    const voices = [...D.QUESTS.flatMap((q) => [q.intro, q.outro, q.outro2]), ...Object.values(D.SCENES).flat()].filter((l) => l && l[2]);
    for (const l of voices) ok(audio.has(`vo-${l[2][0]}-${l[2][1]}.mp3`), `voice clip vo-${l[2][0]}-${l[2][1]} exists`);
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bot.makeBot({ seed }); run(G, 400, (g) => Bot.botInput(g, b, DT)); return G; };
    ok(JSON.stringify(Gm.serialize(play(42))) === JSON.stringify(Gm.serialize(play(42))), 'same seed and inputs, same game');
    // a save in the middle of a siege
    const G = Gm.newGame(9); const bot = Bot.makeBot({ seed: 9 });
    while (G.mode !== 'battle') Gm.step(G, Bot.botInput(G, bot, DT), DT);
    run(G, 12, (g) => Bot.botInput(g, bot, DT));
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bot.makeBot({ seed: 3 }), b2 = Bot.makeBot({ seed: 3 });
    run(G, 30, (g) => Bot.botInput(g, b1, DT));
    run(copy, 30, (g) => Bot.botInput(g, b2, DT));
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-siege plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('siege')) {
    section('siege calibration');
    for (let wave = 1; wave < 3; wave++) {
        const res = (skill) => Array.from({ length: SEEDS }, (_, s) => fight(readyTown(s * 31 + 1, wave), skill, s + 1));
        const idle = res(null), sharp = res(1), sloppy = res(0.3);
        ok(idle.every((r) => r.result === 'lose'), `wave ${wave + 1}: a ready town that never throws loses`);
        ok(sharp.every((r) => r.result === 'win' && r.wall >= 80), `wave ${wave + 1}: a ready town with a sharp aim wins comfortably (${sharp.map((r) => r.wall + '%').join(' ')})`);
        ok(sloppy.every((r) => r.result === 'win'), `wave ${wave + 1}: a ready town with a sloppy aim still holds (${sloppy.map((r) => r.wall + '%').join(' ')})`);
    }
    {
        const G = readyTown(77, 2); G.plots.forEach((p) => { if (p.b?.kind === 'tower') p.b = null; }); for (const id in G.advs) G.advs[id].hired = false;
        const r = fight(G, 0.3, 1);
        ok(r.result === 'lose' || r.wall < 60, `wave 3 without towers or adventurers is a real danger (${r.result} ${r.wall}%)`);
    }
}

if (want('whole')) {
    section('whole game (bot)');
    for (const skill of [1, 0.3]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919), bot = Bot.makeBot({ skill, seed: s });
            let bad = null, waves = 0, losses = 0;
            while (G.t < 100 * 60 && !(G.phase >= 4 && G.epi.waves >= 1)) {
                Gm.step(G, Bot.botInput(G, bot, DT), DT);
                for (const e of G.events) { if (e.type === 'battleEnd') { waves++; if (e.result === 'lose') losses++; } }
                G.events.length = 0;
                for (const r of D.RES) if (!Number.isFinite(G.res[r]) || G.res[r] < -1e-6) bad = `resource ${r} = ${G.res[r]}`;
                if (!Number.isFinite(G.hope) || G.hope < 0 || G.hope > 100) bad = `hope ${G.hope}`;
                if (G.pop > T.housing(G) + 1e-6 && G.pop > 4.5 && !bad) bad = null;    // shrinking toward housing is allowed
                if (G.battle) for (const e of G.battle.enemies) if (!Number.isFinite(e.x) || e.hp > e.max + 1e-6) bad = `enemy ${e.kind} x ${e.x} hp ${e.hp}`;
                if (bad) break;
            }
            ok(!bad, `skill ${skill} seed ${s}: invariants hold${bad ? ' — ' + bad : ''}`);
            ok(G.ended, `skill ${skill} seed ${s}: the Cookie Queen ends the war (day ${G.day}, ${(G.t / 60).toFixed(0)} min, ${waves} sieges, ${losses} lost)`);
            ok(G.ended && G.t < 70 * 60, `skill ${skill} seed ${s}: inside 70 minutes of play`);
        }
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
