/**
 * simtest.mjs — headless checks of The First Dragon Prince's simulation. No browser.
 *
 *   node game-127/dev/simtest.mjs
 *   ONLY=purity,data,rules,scenes,determinism,routes,skill,bad SEEDS=4 VERBOSE=1 node game-127/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js, js/config.js never touch the DOM, storage, Math.random or the clock.
 * data         every script lints (labels, directives, speakers); every background, CG and vignette named is in
 *              the asset manifest and on disk; gifts name real items; quests, regions and places are well formed.
 * rules        stat gains and softcaps, stress (rebellion, illness), the planner's validation, gifts, quests,
 *              heart thresholds, keepsakes, the stipend, festival, Starfall, ending choice.
 * scenes       every scene is walked down every branch of every choice, and always ends.
 * determinism  same seed and commands, same game; a save round trip in the middle of a scene plays on identically.
 * routes       a bot per career plays the whole eight years on SEEDS seeds and reaches its own ending.
 * skill        a careless bot (skill 0.3) still finishes, and lands on a spread of endings, not the top ones.
 * bad          neglect and cruelty lead to the bad endings; every ending's scene builds with every partner.
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
const Bt = await import('../js/sim/bot.js');
const R = await import('../js/sim/rules.js');
const Sc = await import('../js/sim/scene.js');
const Scenes = await import('../js/sim/scenes.js');
const { CAST, FRIENDS, portrait } = await import('../js/sim/data/cast.js');
const { ACTIVITIES, ACT } = await import('../js/sim/data/activities.js');
const { ITEMS, ITEM } = await import('../js/sim/data/items.js');
const { QUESTS } = await import('../js/sim/data/quests.js');
const { REGIONS, APPROACH } = await import('../js/sim/data/adventures.js');
const { STORY } = await import('../js/sim/data/story.js');
const { HEART_SCENES, STARFALL } = await import('../js/sim/data/hearts.js');
const { ENDINGS, EPILOGUES } = await import('../js/sim/data/endings.js');
const { CONTESTS } = await import('../js/sim/data/events.js');
const { PLACES } = await import('../js/sim/data/places.js');
const { BGS, CGS, FOES } = await import('../js/assets.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const castIds = new Set(Object.keys(CAST));

/** Play the current scene to its end, taking option `pick(opts)` at each choice. */
function finishScene(G, pick = (o) => o[0].i) {
    let n = 0;
    while (G.scene && n++ < 5000) {
        const c = G.scene.cur;
        if (c?.choice) Gm.act(G, { t: 'choose', i: pick(c.choice) });
        else Gm.act(G, { t: 'advance' });
    }
    return n < 5000;
}
/** A game moved to the Free Day of a given age and month by a lazy player. */
function gameAt(seed, age, month) {
    const G = Gm.newGame(seed);
    let n = 0;
    while (!(G.age === age && G.month === month && G.phase === 'free' && !G.scene) && n++ < 50000) {
        if (G.scene) { finishScene(G); continue; }
        if (G.phase === 'free') Gm.act(G, { t: 'endFree' });
        else if (G.phase === 'plan') Gm.act(G, { t: 'plan', slots: ['rest', 'library', 'rest'] });
        else if (G.phase === 'run') Gm.act(G, { t: 'next' });
        else if (G.phase === 'festival') Gm.act(G, { t: 'contest', id: null });
        else if (G.phase === 'starfall') Gm.act(G, { t: 'starfall', who: null });
    }
    G.events.length = 0;
    return G;
}

// ====================================================================== purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.[a-z]|\bwindow\.[a-z]|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|new Image/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(ui|audio|input|save|main|view|assets)/.test(src), `${f} never imports the UI, audio, input, storage or view`);
        ok(!/^\s*(let|var)\s+\w+/m.test(src.replace(/^\s{4,}.*$/gm, '')), `${f} keeps no module-level mutable state`);
    }
    console.log(`  ${files.length} files checked`);
}

// ====================================================================== data
if (want('data')) {
    section('data');
    const scripts = [];
    for (const s of STORY) scripts.push([s.id, s.lines]);
    for (const f in HEART_SCENES) for (const s of HEART_SCENES[f]) scripts.push([s.id, s.lines]);
    for (const f in STARFALL) { scripts.push([`starfall:${f}:young`, STARFALL[f].young]); scripts.push([`starfall:${f}:grown`, STARFALL[f].grown]); }
    for (const E of ENDINGS) for (const p of [null, ...FRIENDS]) scripts.push([`ending:${E.id}:${p}`, Scenes.sceneDef('ending', { ending: E.id, partner: p }).lines]);
    for (let a = 11; a <= 17; a++) scripts.push([`birthday:${a}`, Scenes.sceneDef('birthday', { age: a }).lines]);
    for (const f of [10, 40, 70]) scripts.push([`audience:${f}`, Scenes.sceneDef('audience', { fav: f }).lines]);
    for (const Cn of CONTESTS) for (const won of [true, false]) scripts.push([`festival:${Cn.id}:${won}`, Scenes.sceneDef('festival', { contest: Cn.id, won, rank: won ? 1 : 3, rivals: Cn.rivals }).lines]);
    let lints = 0;
    const bgUsed = new Set(), cgUsed = new Set();
    for (const [id, lines] of scripts) {
        const errs = Sc.lintScript(lines, castIds);
        ok(!errs.length, `${id} lints${errs.length ? ': ' + errs.slice(0, 3).join('; ') : ''}`);
        lints++;
        for (const l of lines) {
            if (typeof l !== 'string') continue;
            if (l.startsWith('@bg ')) bgUsed.add(l.slice(4));
            if (l.startsWith('@cg ') && l.length > 4 && !l.includes('{')) cgUsed.add(l.slice(4));
        }
    }
    for (const f of FRIENDS) cgUsed.add(EPILOGUES[f].king);
    for (const b of bgUsed) ok(BGS.includes(b), `background ${b} is in the manifest`);
    for (const c of cgUsed) ok(CGS.includes(c), `CG ${c} is in the manifest`);
    for (const c of CGS) ok(cgUsed.has(c), `manifest CG ${c} is used by some scene`);
    for (const A of ACTIVITIES) {
        if (A.bg) ok(BGS.includes(A.bg), `${A.id}'s background ${A.bg} exists`);
        if (A.kind !== 'adventure' && A.kind !== 'quest') ok(!!A.art, `${A.id} has a vignette description`);
    }
    for (const Rg of REGIONS) {
        ok(BGS.includes(Rg.bg), `region ${Rg.id}'s background exists`);
        ok(Rg.steps.length >= 4, `region ${Rg.id} has enough encounters to draw three`);
        for (const st of [...Rg.steps, Rg.boss]) ok(st.opts.every((o) => APPROACH[o]), `${Rg.id}: every approach is known`);
    }
    for (const P of PLACES) ok(BGS.includes(P.bg), `place ${P.id}'s background exists`);
    ok(FOES.length === REGIONS.reduce((a, Rg) => a + Rg.steps.length + 1, 0) && REGIONS.every((Rg) => FOES.includes(`${Rg.id}-boss`) && Rg.steps.every((_, i) => FOES.includes(`${Rg.id}-${i}`))),
        `every expedition danger and master has a creature (${FOES.length})`);
    for (const f of FRIENDS) {
        for (const k of ['loves', 'likes', 'hates']) for (const i of CAST[f][k]) ok(ITEM[i]?.kind === 'gift', `${f} ${k} ${i}, a real gift`);
        ok(HEART_SCENES[f].length === 4, `${f} has four heart events`);
        ok(STARFALL[f]?.young && STARFALL[f]?.grown, `${f} has both Starfall scenes`);
    }
    for (const q of QUESTS) ok(Object.keys(q.check).every((k) => k in C.START_STATS), `quest ${q.id} checks real stats`);
    // files on disk (once the art has been exported)
    const onDisk = (p) => fs.existsSync(path.join(ROOT, p));
    const missing = [
        ...BGS.map((b) => `art/bg/${b}.webp`), ...CGS.map((c) => `art/cg/${c}.webp`),
        ...ACTIVITIES.filter((a) => a.art).map((a) => `art/act/${a.id}.webp`),
        ...['child', 'teen', 'adult'].flatMap((a) => ['neutral', 'happy', 'sad', 'angry'].map((e) => `art/por/cael-${a}-${e}.webp`)),
        ...FRIENDS.flatMap((f) => [`art/por/${f}-child.webp`, `art/por/${f}-adult.webp`, `art/por/${f}-adult-happy.webp`]),
        ...Object.keys(CAST).filter((k) => !CAST[k].friend && !['cael', 'you', 'n'].includes(k)).map((k) => `art/por/${k}.webp`),
        ...REGIONS.flatMap((Rg) => [...Rg.steps.map((_, i) => `art/foe/${Rg.id}-${i}.webp`), `art/foe/${Rg.id}-boss.webp`]),
        'art/title.webp',
    ].filter((p) => !onDisk(p));
    ok(!missing.length, `every art file is on disk${missing.length ? ` (missing ${missing.length}: ${missing.slice(0, 6).join(', ')}...)` : ''}`);
    ok(portrait('cael', 'happy', 15) === 'cael-teen-happy' && portrait('isolde', 'happy', 12) === 'isolde-child', 'portrait names follow age and expression');
    console.log(`  ${lints} scripts linted, ${bgUsed.size} backgrounds and ${cgUsed.size} CGs referenced`);
}

// ====================================================================== rules
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.scene?.id === 'prologue', 'a new game opens on the prologue');
    ok(!Gm.act(G, { t: 'endFree' }), 'nothing but advance or choose works during a scene');
    finishScene(G);
    ok(!G.scene && G.phase === 'free' && G.ap === C.FREE_AP, 'after the prologue comes the Free Day with its actions');

    ok(R.gainFor(10, 2) > R.gainFor(80, 2) && R.gainFor(99, 2) >= 2 * C.MIN_GAIN - 1e-9, 'gains shrink as a stat grows, never below the floor');
    const v0 = G.stats.int;
    R.bump(G, 'int', 500, { trained: true });
    ok(G.stats.int === C.STAT_MAX, 'stats cap at 100');
    G.stats.int = v0;

    // the planner
    ok(Gm.act(G, { t: 'endFree' }) && G.phase === 'plan', 'ending the Free Day opens the planner');
    ok(!Gm.act(G, { t: 'plan', slots: ['library', 'rest'] }), 'a plan needs exactly three periods');
    ok(!Gm.act(G, { t: 'plan', slots: ['shadow', 'rest', 'rest'] }), 'locked lessons (Shadow Arts) are refused');
    ok(!Gm.act(G, { t: 'plan', slots: ['holiday', 'rest', 'rest'] }), 'a summer holiday is refused in Hatchmoon');
    ok(!Gm.act(G, { t: 'plan', slots: ['tavern', 'rest', 'rest'] }), 'jobs too old for a ten-year-old are refused');
    const g0 = G.gold;
    ok(Gm.act(G, { t: 'plan', slots: ['arcane', 'farm', 'rest'] }) && G.phase === 'run', 'a valid plan starts the month');
    const m0 = G.stats.mag;
    Gm.act(G, { t: 'next' });
    ok(G.results[0].id === 'arcane' && G.stats.mag > m0, 'a lesson raises its stat');
    ok(G.gold <= g0 - ACT.arcane.cost + 1, 'and costs its fee');
    const gb = G.gold;
    Gm.act(G, { t: 'next' });
    ok(G.gold > gb, 'a job pays');
    const s0 = G.stats.sts;
    Gm.act(G, { t: 'next' });
    ok(G.stats.sts <= Math.max(0, s0 - 10), 'rest removes Stress');
    ok(G.month === 2 && G.scene?.id === 'meet_rowan', 'the month rolls over and the next story scene plays');

    // stress: rebellion and illness
    G = gameAt(2, 10, 6);
    Gm.act(G, { t: 'endFree' });
    G.stats.sts = 99;
    Gm.act(G, { t: 'plan', slots: ['arcane', 'arcane', 'arcane'] });
    let rebels = 0;
    for (let i = 0; i < 3; i++) { Gm.act(G, { t: 'next' }); }
    rebels = G.results.filter((r) => r.outcome === 'rebel').length;
    ok(rebels >= 1, `at 99 Stress he skips lessons (${rebels} of 3)`);
    G = gameAt(3, 10, 6);
    Gm.act(G, { t: 'endFree' });
    G.stats.sts = 96;
    Gm.act(G, { t: 'plan', slots: ['rest', 'farm', 'farm'] });
    Gm.act(G, { t: 'next' }); G.stats.sts = 99;
    G.rng.setState(12345);
    let sick = false;
    for (let i = 0; i < 2 && G.phase === 'run'; i++) { Gm.act(G, { t: 'next' }); if (G.sick || G.results.some((r) => r.sickNext)) sick = true; }
    ok(sick || G.results.some((r) => r.outcome === 'rebel'), 'at 100 Stress he falls ill (or refuses to work)');

    // gifts and hearts
    G = gameAt(4, 11, 2);
    ok(G.flags.met_rowan && G.flags.met_isolde, 'the friends have been met by age eleven');
    G.gold = 1000;
    ok(Gm.act(G, { t: 'buy', item: 'whetstone' }) && G.inv.whetstone === 1, 'buying puts a gift in the bag');
    const a0 = G.aff.rowan;
    G.aff.rowan = 0;
    ok(Gm.act(G, { t: 'visit', who: 'rowan', gift: 'whetstone' }), 'visiting with a gift works');
    finishScene(G);
    ok(G.aff.rowan >= 10 && Gm.giftTaste('rowan', 'whetstone') === 'loves', `a loved gift is worth a lot (${G.aff.rowan.toFixed(1)})`);
    ok(!Gm.act(G, { t: 'visit', who: 'rowan' }), 'one visit per friend per Free Day');
    ok(Gm.giftTaste('rowan', 'perfume') === 'hates', 'tastes are read from the cast');
    G.aff.isolde = 30;
    const hd = G.hearts.isolde;
    Gm.act(G, { t: 'visit', who: 'isolde' });
    ok(G.scene?.id === 'isolde_h1' && G.hearts.isolde === hd + 1, 'enough affection opens the next heart event');
    finishScene(G);
    ok(G.ap === 1 && Gm.act(G, { t: 'talk', topic: 'praise' }), 'the third action is a talk with the prince');
    finishScene(G);
    ok(G.ap === 0 && !Gm.act(G, { t: 'do', place: 'temple', action: 'pray' }), 'then the Free Day runs out of actions');
    void a0;

    // quests
    G = gameAt(5, 12, 5);
    const q = G.board[0];
    ok(G.board.length === 3, 'the board has three postings');
    ok(Gm.act(G, { t: 'accept', quest: q }) && G.quests.includes(q), 'accepting a posting adds it to the planner');
    Gm.act(G, { t: 'endFree' });
    ok(Gm.canDo(G, 'quest:' + q) && Gm.act(G, { t: 'plan', slots: ['quest:' + q, 'rest', 'rest'] }), 'an accepted quest can be scheduled');
    Gm.act(G, { t: 'next' });
    ok(G.results[0].quest === q && !G.quests.includes(q), 'running it resolves and removes it');

    // keepsakes
    G = gameAt(6, 11, 3);
    G.gold = 2000;
    Gm.act(G, { t: 'buy', item: 'k_staff' });
    ok(G.keep.k_staff && !Gm.act(G, { t: 'buy', item: 'k_staff' }), 'a keepsake is bought once');

    // expeditions
    G = gameAt(7, 12, 5);
    Gm.act(G, { t: 'endFree' });
    ok(!Gm.act(G, { t: 'plan', slots: ['adv:peaks', 'rest', 'rest'] }), 'the Peaks need wings');
    ok(Gm.act(G, { t: 'plan', slots: ['adv:whisperwood', 'rest', 'rest'] }), 'the Whisperwood is open at twelve');
    Gm.act(G, { t: 'next' });
    ok(G.phase === 'adventure' && Gm.advStep(G), 'an expedition opens its first encounter');
    let k = 0;
    const faced = [];
    while (G.phase === 'adventure' && k++ < 10) { faced.push(Gm.advFoe(G)); const st = Gm.advStep(G); Gm.act(G, { t: 'approach', a: st.opts[0] }); }
    ok(G.phase === 'run' && G.results[0].id === 'adv:whisperwood' && G.results[0].log.length === 4, 'four encounters, the last the region\'s master');
    ok(faced.length === 4 && faced[3] === 'whisperwood-boss' && new Set(faced).size === 4 && faced.every((f) => FOES.includes(f)), `each encounter names its creature (${faced.join(', ')})`);
    ok(G.results[0].log.every((e, i) => e.foe === faced[i]), 'and the encounter log records which one was faced');
    ok(G.count.adventure === 1, 'the expedition is counted');

    // festival and Starfall
    G = gameAt(8, 12, 9);
    Gm.act(G, { t: 'endFree' });
    Gm.act(G, { t: 'plan', slots: ['rest', 'rest', 'rest'] });
    for (let i = 0; i < 3; i++) Gm.act(G, { t: 'next' });
    ok(G.phase === 'festival', 'the Harvest Festival comes at the end of Harvestmoon');
    ok(!Gm.act(G, { t: 'contest', id: 'nope' }), 'unknown contests are refused');
    Gm.act(G, { t: 'contest', id: 'arts' });
    ok(G.scene?.id === 'festival', 'a contest plays its scene');
    finishScene(G);
    ok(G.month === 10 && G.phase === 'free', 'and the month moves on');
    G = gameAt(9, 13, 12);
    Gm.act(G, { t: 'endFree' });
    Gm.act(G, { t: 'plan', slots: ['rest', 'rest', 'rest'] });
    for (let i = 0; i < 3; i++) Gm.act(G, { t: 'next' });
    ok(G.phase === 'starfall', 'Starfall Night comes at the end of the year');
    G.aff.theo = 25;
    ok(Gm.act(G, { t: 'starfall', who: 'theo' }) && G.scene?.id === 'starfall', 'he spends it with a friend');
    finishScene(G);
    ok(G.age === 14 && G.month === 1, 'and a new year begins');

    // endings
    G = Gm.newGame(10);
    ok(R.chooseEnding(G) === 'quiet', 'an untrained prince has a quiet ending');
    Object.assign(G.stats, { mag: 80, int: 70 });
    ok(R.chooseEnding(G) === 'archmage', 'a mage becomes the Archmage');
    Object.assign(G.stats, { fav: 90, grc: 70, elo: 70, cha: 70, mor: 70, fame: 70, drc: 40 });
    ok(R.chooseEnding(G) !== 'king', 'no King without a betrothed');
    G.partner = 'isolde'; G.aff.isolde = 90;
    ok(R.chooseEnding(G) === 'king', 'with one, he is crowned');
    G.stats.drc = 90;
    ok(R.chooseEnding(G) !== 'king', 'a prince more dragon than man cannot be crowned');
    Object.assign(G.stats, { bond: 5, sts: 80 });
    ok(R.chooseEnding(G) === 'runaway', 'a neglected, exhausted prince runs away');
}

// ====================================================================== scenes
if (want('scenes')) {
    section('scenes');
    // walk every branch: depth-first over choice sequences, each from a fresh copy of a mid-game state
    const base = gameAt(11, 14, 3);
    base.flags.wings = true;
    const ids = [...STORY.map((s) => [s.id, {}]), ...Object.values(HEART_SCENES).flat().map((s) => [s.id, {}]),
        ...ENDINGS.flatMap((E) => [null, 'isolde', 'lumi'].map((p) => ['ending', { ending: E.id, partner: p }]))];
    let paths = 0, lines = 0;
    for (const [id, args] of ids) {
        const stack = [[]];
        let ended = 0, bad = null;
        while (stack.length && paths < 200000) {
            const prefix = stack.pop();
            const G = Gm.deserialize(Gm.serialize(base));
            G.queue = [];
            Gm.queueScene(G, id, args);
            Gm.act(G, { t: 'advance' });            // nothing is playing: no-op; the queue starts on the next command below
            // start it directly
            G.scene = null;
            const def = Scenes.sceneDef(id, args);
            Sc.beginScene(G, { id, args, title: def.title, kind: def.kind }, def.lines);
            let depth = 0, n = 0;
            try {
                while (G.scene?.cur && n++ < 3000) {
                    const c = G.scene.cur;
                    if (c.choice) {
                        if (depth < prefix.length) { Sc.choose(G, def.lines, prefix[depth]) || (G.scene.cur = null); depth++; continue; }
                        for (const o of c.choice.slice(1)) stack.push([...prefix, o.i]);
                        Sc.choose(G, def.lines, c.choice[0].i) || (G.scene.cur = null);
                        prefix.push(c.choice[0].i); depth++;
                    } else { lines++; if (!Sc.advance(G, def.lines)) G.scene.cur = null; }
                }
                if (n >= 3000) bad = 'did not end';
            } catch (err) { bad = err.message; }
            paths++; ended++;
            if (bad) break;
        }
        ok(!bad, `${id}${args.ending ? ':' + args.ending + ':' + args.partner : ''}: ${ended} path(s) all end${bad ? ' — ' + bad : ''}`);
    }
    console.log(`  ${paths} paths, ${lines} lines read`);
}

// ====================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, months) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ route: 'king', seed }); let n = 0; while (!G.over && G.turn < months && n++ < 20000) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; } return G; };
    const a = play(42, 30), b = play(42, 30);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    // a round trip mid-scene: stop the instant a scene is open, save, and play both copies on
    const G = Gm.newGame(7);
    const bot = Bt.makeBot({ route: 'warrior', seed: 7 });
    let n = 0;
    while (n++ < 20000 && !(G.turn > 20 && G.scene && G.scene.pc > 2)) { Gm.act(G, Bt.botCommand(G, bot)); G.events.length = 0; }
    ok(!!G.scene, `stopped inside a scene (${G.scene?.id})`);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ route: 'warrior', seed: 99 }), b2 = Bt.makeBot({ route: 'warrior', seed: 99 });
    for (let i = 0; i < 4000 && !G.over; i++) { Gm.act(G, Bt.botCommand(G, b1)); Gm.act(copy, Bt.botCommand(copy, b2)); G.events.length = 0; copy.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip in the middle of a scene plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected');
}

// ====================================================================== routes
if (want('routes')) {
    section(`routes (${SEEDS} seeds each)`);
    const table = [];
    for (const route of Object.keys(Bt.ROUTES)) {
        const tally = {};
        let hits = 0, bad = null;
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919 + 13);
            const bot = Bt.makeBot({ route, seed: s });
            try {
                let n = 0;
                while (!G.over && n++ < 60000) {
                    if (!Gm.act(G, Bt.botCommand(G, bot))) throw new Error(`refused in ${G.phase}`);
                    G.events.length = 0;
                    for (const k in G.stats) if (!Number.isFinite(G.stats[k]) || G.stats[k] < 0 || G.stats[k] > 100) throw new Error(`${k} = ${G.stats[k]}`);
                    if (!Number.isFinite(G.gold) || G.gold < 0) throw new Error('gold ' + G.gold);
                }
                if (!G.over) throw new Error('never finished');
            } catch (err) { bad = err.message; break; }
            tally[G.ending.id] = (tally[G.ending.id] || 0) + 1;
            if (G.ending.id === Bt.ROUTES[route].ending) hits++;
        }
        ok(!bad, `${route}: invariants hold for eight years${bad ? ' — ' + bad : ''}`);
        const need = route === 'diplomat' ? Math.ceil(SEEDS / 3) : Math.ceil(SEEDS * 2 / 3);
        ok(hits >= need, `${route}: reaches its ending on ${hits}/${SEEDS} seeds ${JSON.stringify(tally)}`);
        table.push({ route, hits: `${hits}/${SEEDS}`, endings: JSON.stringify(tally) });
    }
    console.table(table);
}

// ====================================================================== skill
if (want('skill')) {
    section('skill dial');
    const tally = {};
    const N = Math.max(6, SEEDS * 2);
    for (let s = 1; s <= N; s++) {
        const route = Object.keys(Bt.ROUTES)[s % 15];
        const G = Gm.newGame(s * 31);
        Bt.playThrough(G, Bt.makeBot({ route, skill: 0.3, seed: s }));
        tally[G.ending.id] = (tally[G.ending.id] || 0) + 1;
    }
    const top = ['king', 'archmage', 'crown', 'dragonlord'].reduce((a, k) => a + (tally[k] || 0), 0);
    ok(top <= N / 3, `a careless bot rarely reaches the top endings (${top}/${N}) ${JSON.stringify(tally)}`);
}

// ====================================================================== bad endings
if (want('bad')) {
    section('bad endings');
    // cruelty: scold every month, never rest, stress pinned
    const G = Gm.newGame(77);
    let n = 0;
    while (!G.over && n++ < 60000) {
        if (G.scene) { finishScene(G, (o) => o[o.length - 1].i); continue; }
        if (G.phase === 'free') { if (!G.done.talk) Gm.act(G, { t: 'talk', topic: 'scold' }); else Gm.act(G, { t: 'endFree' }); }
        else if (G.phase === 'plan') Gm.act(G, { t: 'plan', slots: Gm.canDo(G, 'docks') ? ['docks', 'docks', 'farm'] : ['farm', 'farm', 'farm'] });
        else if (G.phase === 'run') Gm.act(G, { t: 'next' });
        else if (G.phase === 'festival') Gm.act(G, { t: 'contest', id: null });
        else if (G.phase === 'starfall') Gm.act(G, { t: 'starfall', who: null });
        G.events.length = 0;
    }
    ok(G.over && ['runaway', 'exile'].includes(G.ending.id), `a cruel guardian loses him (${G.ending.id}; bond ${G.stats.bond}, stress ${G.stats.sts})`);
    // every ending, every partner: the ending scene builds and ends
    for (const E of ENDINGS) {
        const H = Gm.newGame(1);
        H.scene = null; H.queue = [];
        H.ending = { id: E.id, partner: E.bad ? null : 'saffi' };
        Gm.queueScene(H, 'ending', { ending: E.id, partner: H.ending.partner });
        const def = Scenes.sceneDef('ending', { ending: E.id, partner: H.ending.partner });
        Sc.beginScene(H, { id: 'ending', args: {}, title: def.title, kind: 'ending' }, def.lines);
        let k = 0;
        while (H.scene?.cur && k++ < 500) { if (H.scene.cur.choice) Sc.choose(H, def.lines, H.scene.cur.choice[0].i); else if (!Sc.advance(H, def.lines)) break; }
        ok(k < 500 && k > 8, `${E.id}: the ending plays (${k} lines)`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
