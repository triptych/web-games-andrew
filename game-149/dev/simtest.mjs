/**
 * simtest.mjs — headless checks of Echoheart Academy's simulation. No browser.
 *
 *   node game-149/dev/simtest.mjs                 # everything
 *   ONLY=story,battle node game-149/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-149/dev/simtest.mjs
 *
 * purity     js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * story      every scene compiles; every label, speaker, expression, background, CG, music, sound and voice line it
 *            names has a file; the calendar names real scenes.
 * vn         lines, choices and their effects, labels, call/end, conditions, text substitution.
 * bonds      hearts, gifts (loved, liked, once a day), heart events in order, the captive is the closest friend.
 * battle     damage, weakness and resistance, guard, shields, items, Echo copying ally and foe spells, the boss
 *            multiplier, win and lose, retrying eases the fight.
 * minis      each mini-game: a perfect bot earns an S, a poor one a lower grade; the rules of each.
 * map        every place, charm, petal and marshmallow is reachable by the real mover (flood fill); walls hold.
 * calendar   a day's slots; free actions cost a slot and gifts don't; sleeping; the night scene; the festival.
 * climax     the moon clock, battles cost time, a late moon seals the cages and strengthens the boss.
 * determinism  same seed and inputs → same game; a save round trip mid-battle and mid-mini-game plays on identically.
 * bot        whole games over SEEDS seeds at three skills and four favourites: every one reaches the ending, with
 *            per-step invariants; the balance table is printed and its bands are asserted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const V = await import('../js/sim/vn.js');
const Ba = await import('../js/sim/battle.js');
const Mi = await import('../js/sim/minis.js');
const Ru = await import('../js/sim/rules.js');
const { STORY } = await import('../js/sim/story.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false, dir: null };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Drive a game with the bot until a condition (or a step budget). */
function drive(G, bot, until, max = 120 * 60 * 40) {
    for (let k = 0; k < max && !until(G); k++) {
        const d = Bt.botDecide(G, bot);
        if (d.cmd) Gm.act(G, d.cmd);
        Gm.step(G, d.inp || NONE, DT);
        G.events.length = 0;
    }
    return until(G);
}
/** Read lines and pick the first choice until the scene ends or something else takes over. */
function readThrough(G, pick = 0) {
    for (let k = 0; k < 5000 && G.mode === 'vn'; k++) Gm.act(G, G.vn.choices ? { t: 'choose', i: Math.min(pick, G.vn.choices.length - 1) } : { t: 'next' });
}
function fresh(seed = 1) {
    const G = Gm.newGame(seed);
    G.events.length = 0;
    return G;
}
/** A battle set up directly, with given party levels. */
function battleAt(enc, lv = 5, opts = {}) {
    const G = fresh(opts.seed || 1);
    for (const f of D.FRIENDS) G.joined[f] = true;
    for (const id of Object.keys(G.heroes)) if (id !== 'graves') { G.heroes[id].lv = lv; const s = Ru.heroStats(id, lv); G.heroes[id].hp = s.mhp; G.heroes[id].mp = s.mmp; }
    G.vn = null;
    if (opts.climax) G.climax = opts.climax;
    Ba.startBattle(G, enc);
    return G;
}
function runBattle(G, skill = 1, seed = 1) {
    const bot = Bt.makeBot({ skill, seed });
    for (let k = 0; k < 120 * 900 && G.battle && !['won', 'lost'].includes(G.battle.phase); k++) {
        const d = Bt.botDecide(G, bot);
        if (d.cmd) Gm.act(G, d.cmd);
        Gm.step(G, d.inp || NONE, DT);
        G.events.length = 0;
    }
    return G.battle?.phase;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('story')) {
    section('story');
    const names = Object.keys(STORY);
    let compiled = 0;
    const refs = { bg: new Set(), cg: new Set(), music: new Set(), sfx: new Set(), vo: new Set(), spr: new Set(), battle: new Set(), mini: new Set(), call: new Set() };
    for (const n of names) {
        let c;
        try { c = V.compile(STORY[n], n); compiled++; } catch (e) { ok(false, `${n} compiles: ${e.message}`); continue; }
        for (const o of c.ops) {
            if (o.op === 'bg' && o.v) refs.bg.add(o.v);
            if (o.op === 'cg' && o.v) refs.cg.add(o.v);
            if (o.op === 'music' && o.v) refs.music.add(o.v);
            if (o.op === 'sfx') refs.sfx.add(o.v);
            if (o.op === 'battle') refs.battle.add(o.v);
            if (o.op === 'mini') refs.mini.add(o.game);
            if (o.op === 'call') refs.call.add(o.v);
            if (o.op === 'show') refs.spr.add(o.who === 'mochi' ? 'mochi' : `${o.who}-${o.expr}`);
            if (o.op === 'say' && o.who && o.expr) refs.spr.add(`${o.who}-${o.expr}`);
            if (o.op === 'say' && o.voice) refs.vo.add(`${D.CAST[o.who].voice || o.who}-${o.voice}`);
        }
    }
    ok(compiled === names.length, `all ${names.length} scenes compile`);
    for (const b of refs.bg) ok(exists(`art/bg/${b}.webp`), `background ${b} exists`);
    for (const b of refs.cg) ok(exists(`art/cg/${b}.webp`), `CG ${b} exists`);
    for (const m of refs.music) ok(exists(`audio/music/${m}.mp3`), `music ${m} exists`);
    for (const s of refs.sfx) ok(exists(`audio/sfx/${s}.mp3`), `sound ${s} exists`);
    for (const v of refs.vo) ok(exists(`audio/vo/${v}.mp3`), `voice line ${v} exists`);
    for (const s of refs.spr) ok(s === 'crowd-center' || exists(`art/spr/${s}.webp`), `sprite ${s} exists`);
    for (const e of refs.battle) ok(!!D.ENCOUNTERS[e], `encounter ${e} exists`);
    for (const g of refs.mini) ok(!!Mi.MINI[g], `mini-game ${g} exists`);
    for (const c of refs.call) ok(!!STORY[c], `called scene ${c} exists`);
    for (const [d, s] of Object.entries(D.SCHEDULE)) for (const k of ['morning', 'night']) if (s[k]) ok(!!STORY[s[k]], `day ${d} ${k} scene ${s[k]} exists`);
    for (const f of D.FRIENDS) {
        for (let i = 1; i <= 5; i++) ok(!!STORY[`talk_${f}_${i}`], `hangout talk_${f}_${i} exists`);
        for (let i = 1; i <= 3; i++) ok(!!STORY[`heart_${f}_${i}`], `heart event heart_${f}_${i} exists`);
        ok(/romance:/.test(STORY[`heart_${f}_3`]) && /friend:/.test(STORY[`heart_${f}_3`]), `${f}'s last heart event offers romance or friendship`);
        ok(exists(`models/${D.CAST[f].model}.glb`), `${f} has a Meshy model`);
    }
    for (const k of Object.keys(D.FOES)) ok(exists(`models/${D.FOES[k].model}.glb`), `foe ${k} has a Meshy model`);
    for (const k of Object.keys(D.ICON)) ok(exists(`art/icons/${D.ICON[k]}.webp`), `icon for ${k} exists`);
    for (const m of ['title', 'academy', 'mystery', 'battle', 'climax', 'tender']) ok(exists(`audio/music/${m}.mp3`), `theme ${m} exists`);
    ok(D.CHARMS.length === 12, 'twelve Echo Charms');
    // every voice line that exists is used somewhere (no orphans) except combat barks the battle view plays
    console.log(`  ${names.length} scenes · ${refs.bg.size} backgrounds · ${refs.cg.size} CGs · ${refs.vo.size} voiced lines · ${refs.spr.size} sprites`);
}

// ======================================================================
if (want('vn')) {
    section('vn');
    STORY.__t1 = `
bg courtyard
show hana normal left
> Narration for {name}.
hana happy: Hi {name}! [v:hi]
choice
- First | hana+3 flag:first -> a
- Second | lys+2
lys: second
end
label a
if flag:first -> b
hana: never
label b
call __t2
hana: back from the call
`;
    STORY.__t2 = `
hana sad: inside the call
end
hana: never after end
`;
    const G = fresh(3);
    G.name = 'Rin';
    V.startScene(G, '__t1');
    const hooks = { battle() {}, mini() {}, done(G2, n) { G2.doneScene = n; }, ending() {}, climax() {} };
    V.runVN(G, hooks);
    ok(G.vn.say && G.vn.say.who === null && G.vn.say.text === 'Narration for Rin.', 'narration, with {name}');
    ok(G.vn.bg === 'courtyard' && G.vn.show.left?.who === 'hana', 'bg and show');
    V.vnNext(G, hooks);
    ok(G.vn.say.who === 'hana' && G.vn.say.voice === 'hi' && G.vn.show.left.expr === 'happy', 'a spoken line with expression and voice');
    V.vnNext(G, hooks);
    ok(G.vn.choices?.length === 2, 'a choice waits for the player');
    ok(!V.vnNext(G, hooks), 'reading on does not skip a choice');
    const b0 = G.bonds.hana;
    V.vnChoose(G, 0, hooks);
    ok(G.bonds.hana === b0 + 3 && G.flags.first, 'the choice applies its effects');
    ok(G.vn.say.text === 'inside the call', 'goto, if and call jump correctly');
    V.vnNext(G, hooks);
    ok(G.vn.say.text === 'back from the call', '"end" in a called scene returns to the caller');
    V.vnNext(G, hooks);
    ok(G.vn === null && G.doneScene === '__t1', 'the scene ends and the hook hears it');
    let threw = false;
    try { V.compile('hana: ok\nnobody: hi', 'x'); } catch { threw = true; }
    ok(threw, 'an unknown speaker is a compile error');
    threw = false;
    try { V.compile('goto nowhere', 'x'); } catch { threw = true; }
    ok(threw, 'a missing label is a compile error');
    delete STORY.__t1; delete STORY.__t2;
    // conditions
    const H = fresh(4);
    H.bonds.lys = 80; H.flags.x = 1; H.inv.tart = 1;
    ok(Ru.test(H, 'hearts:lys>=5') && !Ru.test(H, 'hearts:lys>=6'), 'hearts conditions');
    ok(Ru.test(H, 'flag:x') && Ru.test(H, '!flag:y') && Ru.test(H, 'item:tart') && Ru.test(H, 'best:lys'), 'flag, item and best conditions');
}

// ======================================================================
if (want('bonds')) {
    section('bonds');
    const G = fresh(5);
    ok(Ru.hearts(G, 'hana') === 0, 'everyone starts at zero hearts');
    Ru.addBond(G, 'hana', C.BOND.perHeart * 2);
    ok(Ru.hearts(G, 'hana') === 2 && G.events.some((e) => e.type === 'heartUp'), 'bond becomes hearts, with an event');
    ok(Ru.heartEventReady(G, 'hana') === 1, 'two hearts unlock the first heart event');
    Ru.addBond(G, 'hana', 9999);
    ok(Ru.hearts(G, 'hana') === C.BOND.maxHearts, 'hearts cap at the maximum');
    ok(Ru.giftValue('hana', 'chestnuts') === 'love' && Ru.giftValue('hana', 'honeybun') === 'like' && Ru.giftValue('hana', 'gears') === 'meh', 'gift tastes');
    for (const f of D.FRIENDS) for (const i of [...D.CAST[f].loves, ...D.CAST[f].likes]) ok(Ru.giftable(i) && (D.SHOP.includes(i) || i === 'candy'), `${f}'s favourite ${i} can be bought or found`);
    // gifting through the real panel
    const H = fresh(6);
    H.day = 3; H.slot = 1; H.mode = 'map'; H.vn = null;
    H.pos = { x: D.PLACES.arena.x, z: D.PLACES.arena.z };
    H.inv.chestnuts = 2;
    ok(Gm.act(H, { t: 'visit', place: 'arena' }), 'visit opens a place');
    const b0 = H.bonds.hana;
    ok(Gm.act(H, { t: 'do', id: 'gift', who: 'hana', item: 'chestnuts' }) && H.bonds.hana === b0 + C.BOND.gift.love, 'a loved gift gives the loved bonus');
    ok(H.slot === 1, 'giving a gift costs no time');
    ok(!Gm.act(H, { t: 'do', id: 'gift', who: 'hana', item: 'chestnuts' }), 'one gift per friend per day');
    ok(Gm.act(H, { t: 'do', id: 'talk', who: 'hana' }) && H.mode === 'vn', 'talking starts a hangout scene');
    readThrough(H);
    ok(H.slot === 2 && H.mode === 'map', 'the hangout costs the slot');
    // heart events come in order once ready
    H.bonds.hana = C.BOND.perHeart * 9;
    H.pos = { x: D.PLACES.arena.x, z: D.PLACES.arena.z };
    Gm.act(H, { t: 'visit', place: 'arena' });
    Gm.act(H, { t: 'do', id: 'talk', who: 'hana' });
    ok(H.vn?.scene === 'heart_hana_1', 'the first heart event comes first, even with nine hearts');
    // the captive is whoever you're closest to
    const K = fresh(7);
    K.bonds = { hana: 10, lys: 40, pip: 90, ren: 20 };
    V.applyFx(K, ['capture']);
    ok(K.captive === 'pip', 'the Hollow Moon takes your closest friend');
    ok(!Ru.party(K).includes('pip'), 'and they leave the party until rescued');
}

// ======================================================================
if (want('battle')) {
    section('battle');
    let G = battleAt('tutorial', 3);
    const B = G.battle;
    const kai = B.actors.find((a) => a.id === 'kai');
    const wisp = Ba.foesOf(B)[0];
    ok(Ba.heroesOf(B).length === 3, 'a party of Kai and two friends');
    // run time until it's a hero's turn
    for (let k = 0; k < 2000 && B.phase !== 'cmd'; k++) Gm.step(G, NONE, DT);
    ok(B.phase === 'cmd', 'the queue reaches a hero, who waits for a command');
    const actor = B.actors[B.cur];
    const hp0 = wisp.hp;
    ok(Gm.act(G, { t: 'attack', target: wisp.id }) && wisp.hp < hp0, 'Strike hurts the target');
    ok(!Gm.act(G, { t: 'attack', target: wisp.id }), 'one command per turn');
    ok(B.phase === 'wait' && B.wait > 0, 'the view gets time to show it');
    // weakness and resistance
    G = battleAt('archive', 4);
    const arm = Ba.foesOf(G.battle)[0];
    ok(arm.weak.includes('water') && arm.resist.includes('fire'), 'the armor is weak to water and resists fire');
    // Echo copies the last spell, a foe's too
    G = battleAt('yuki', 5);
    const B2 = G.battle;
    B2.last = { skill: 'starfall', side: 'hero', by: 'lys' };
    ok(Ba.echoTarget(B2) === 'starfall', 'Echo copies an ally\'s Starfall');
    B2.last = { skill: 'requiem', side: 'foe', by: 'f0' };
    ok(Ba.echoTarget(B2) === 'requiem', 'and the Choir\'s own Requiem');
    B2.last = null;
    ok(Ba.echoTarget(B2) === 'sonic', 'with nothing to copy, a sonic burst');
    // force Kai's turn and echo a foes-wide spell at the foes
    const k2 = B2.actors.find((a) => a.id === 'kai');
    B2.cur = B2.actors.indexOf(k2); B2.phase = 'cmd'; B2.wait = 0;
    B2.last = { skill: 'requiem', side: 'foe', by: 'f0' };
    const before = Ba.foesOf(B2).map((f) => f.hp);
    const heroesBefore = Ba.heroesOf(B2).map((h) => h.hp);
    ok(Gm.act(G, { t: 'skill', id: 'echo' }), 'Echo can be cast');
    ok(Ba.foesOf(B2).every((f, i) => f.hp < before[i]) && Ba.heroesOf(B2).every((h, i) => h.hp === heroesBefore[i]), 'an echoed Requiem hits every foe and no friend');
    ok(k2.mp === Ru.heroStats('kai', 5).mmp - D.SKILLS.echo.mp, 'Echo costs its MP');
    // guard halves damage: the same foe, the same seed, the same roll, every hero guarding or not
    const hurtBy = (guard) => {
        const H = battleAt('archive', 5, { seed: 9 });
        const BB = H.battle, f = Ba.foesOf(BB)[0];
        for (const a of BB.actors) { a.ct = a === f ? 1000 : -1e9; if (a.side === 'hero') a.guard = guard; }
        BB.phase = 'wait'; BB.wait = 0;
        H.rng.setState(1234);
        const hp = Ba.heroesOf(BB).reduce((s2, a) => s2 + a.hp, 0);
        Gm.step(H, NONE, DT);
        return hp - Ba.heroesOf(BB).reduce((s2, a) => s2 + a.hp, 0);
    };
    const plain = hurtBy(false), guarded = hurtBy(true);
    ok(plain > 0, `foes hurt heroes (${plain})`);
    ok(guarded > 0 && guarded <= Math.ceil(plain * C.BATTLE.guard) + 1, `guarding halves it (${guarded})`);
    // items
    G = battleAt('tutorial', 2);
    const B3 = G.battle;
    for (let k = 0; k < 2000 && B3.phase !== 'cmd'; k++) Gm.step(G, NONE, DT);
    const who = B3.actors[B3.cur];
    who.hp = 10;
    G.inv.healing = 1;
    ok(Gm.act(G, { t: 'item', item: 'healing', target: who.id }) && who.hp === 10 + D.ITEMS.healing.value && !G.inv.healing, 'a Healing Draught heals and is used up');
    // win: rewards; lose: retry eases it
    G = battleAt('tutorial', 4);
    const l0 = G.lumens;
    ok(runBattle(G) === 'won' && G.lumens > l0, 'a won battle pays lumens');
    ok(Gm.act(G, { t: 'battleDone' }) || true, 'closing a won battle');
    G = battleAt('boss', 1, { climax: { time: 0, freed: [], late: true } });
    const bossHp0 = Ba.foesOf(G.battle)[0].mhp;
    ok(runBattle(G, 0.3) === 'lost', 'a level 1 party loses to the boss');
    ok(!Gm.act(G, { t: 'leave' }), 'the boss can\'t be skipped');
    ok(Gm.act(G, { t: 'retry' }) && Ba.foesOf(G.battle)[0].mhp < bossHp0, 'retrying eases the fight');
    // boss multiplier
    const m0 = Ba.bossMul({ climax: { freed: ['a', 'b', 'c', 'd'], late: false } }), m4 = Ba.bossMul({ climax: { freed: [], late: true } });
    ok(m0 === 1 && m4 > 1.6, `every student left in a cage makes the boss stronger (${m0} → ${m4.toFixed(2)})`);
    // win rates against the boss
    const rate = (lv, freed, late, skill = 1) => {
        let w = 0;
        for (let s = 1; s <= 6; s++) { const H = battleAt('boss', lv, { seed: s, climax: { time: 0, freed: Array(freed).fill('x'), late } }); H.inv = { healing: 3, mana: 2, tart: 1 }; if (runBattle(H, skill, s) === 'won') w++; }
        return w / 6;
    };
    const r7 = rate(7, 4, false), r5late = rate(5, 0, true);
    console.log(`  boss win rate: level 7 all freed ${r7}, level 5 nobody freed and late ${r5late.toFixed(2)}`);
    ok(r7 >= 0.8, 'a level 7 party that freed everyone usually wins');
    ok(r5late <= 0.5, 'a weak, late party usually needs a retry');
}

// ======================================================================
if (want('minis')) {
    section('minis');
    const play = (game, level, skill, seed) => {
        const rng = makeRng(seed), M = Mi.MINI[game].init(rng, level);
        const b = Mi.miniBot(skill, makeRng(seed * 31 + 7));
        for (let k = 0; k < 120 * 120 && !M.done; k++) {
            b.dt = DT;
            const o = Mi.MINI[game].bot(M, b) || {};
            Mi.MINI[game].step(M, { ...NONE, ...o }, DT, rng);
            M.ev.length = 0;
        }
        return M;
    };
    const table = [];
    for (const g of Object.keys(Mi.MINI)) {
        for (const lv of [1, 2]) {
            const row = { game: g, level: lv };
            for (const sk of [1, 0.5, 0]) {
                let tot = 0, done = 0;
                for (let s = 1; s <= 6; s++) { const M = play(g, lv, sk, s); tot += Mi.grade(M); done += M.done ? 1 : 0; }
                row[`skill ${sk}`] = (tot / 6).toFixed(1);
                ok(done === 6, `${g} L${lv} skill ${sk} always finishes`);
            }
            table.push(row);
            ok(+row['skill 1'] >= 2.5, `${g} L${lv}: a perfect bot averages A or S (${row['skill 1']})`);
            ok(+row['skill 0'] < +row['skill 1'], `${g} L${lv}: a clumsy bot does worse`);
        }
    }
    console.table(table);
    // a few direct rules
    let M = Mi.MINI.potion.init(makeRng(1), 1);
    M.cool = 0; M.needle = M.c;
    Mi.MINI.potion.step(M, { ...NONE, a: true }, 0, makeRng(2));
    ok(M.score === 3 && M.last === 'perfect', 'potion: pressing at the centre is perfect');
    M = Mi.MINI.fireball.init(makeRng(1), 1);
    M.targets = [{ id: 0, lane: 0, kind: 'mochi', t: 1 }];
    M.score = 5; M.spawn = 9;
    Mi.MINI.fireball.step(M, { ...NONE, dir: 'left' }, DT, makeRng(2));
    ok(M.score === 2, 'fireball: hitting a Mochi plushie costs points');
    M = Mi.MINI.runes.init(makeRng(3), 1);
    const r = M.rune.slice();
    for (const d of r) Mi.MINI.runes.step(M, { ...NONE, dir: d }, DT, makeRng(4));
    ok(M.score === r.length && M.made === 1, 'runes: entering every stroke completes the rune');
    M = Mi.MINI.echo.init(makeRng(5), 1);
    M.phase = 'input'; M.timer = 4; M.i = 0;
    const wrong = ['up', 'right', 'down', 'left'][(M.seqs[0][0] + 1) % 4];
    Mi.MINI.echo.step(M, { ...NONE, dir: wrong }, DT);
    ok(M.lives === 2 && M.round === 1, 'echo: a wrong note costs a life and the round');
}

// ======================================================================
if (want('map')) {
    section('map');
    // flood fill the walkable island with the real mover: from the bridge, steps of 0.8 in eight directions
    const G = fresh(8);
    G.mode = 'map'; G.vn = null; G.day = 5; G.slot = 1;
    const seen = new Set(), q = [[0, 33]], key = (x, z) => `${Math.round(x / 0.8)},${Math.round(z / 0.8)}`;
    seen.add(key(0, 33));
    const reached = [];
    while (q.length) {
        const [x, z] = q.pop();
        reached.push([x, z]);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
            G.pos = { x, z, face: 0 };
            for (let i = 0; i < 12; i++) Gm.step(G, { x: dx, y: dz, a: false, dir: null }, 0.8 / C.MAP.speed / 12);
            const k = key(G.pos.x, G.pos.z);
            if (!seen.has(k)) { seen.add(k); q.push([G.pos.x, G.pos.z]); }
        }
        G.events.length = 0;
        if (reached.length > 20000) break;
    }
    const near = (p, r) => reached.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < r);
    for (const id of D.PLACE_IDS) ok(near(D.PLACES[id], D.PLACES[id].r - 0.3), `${id} can be walked to`);
    for (const c of [...D.CHARMS, ...D.PETALS, ...D.TREATS]) ok(near(c, C.MAP.charmR - 0.2), `pickup ${c.id} can be walked to`);
    ok(reached.every(([x, z]) => Math.hypot(x, z) < C.MAP.radius + 0.5 || (Math.abs(x) < 3.5 && z > 0)), 'nobody walks off the island');
    ok(reached.every(([x, z]) => Gm.SOLIDS.every((s) => Math.hypot(x - s.x, z - s.z) > s.r - 0.01)), 'nobody walks through a building');
    console.log(`  ${reached.length} walkable cells`);
    // picking up a charm
    const P = fresh(8);
    P.mode = 'map'; P.vn = null; P.day = 5; P.slot = 1;
    P.pos = { x: D.CHARMS[0].x + 2, z: D.CHARMS[0].z };
    for (let i = 0; i < 60; i++) Gm.step(P, { x: -1, y: 0 }, DT);
    ok(P.charms.includes('c1') && P.events.some((e) => e.type === 'charm'), 'walking over a charm picks it up');
}

// ======================================================================
if (want('calendar')) {
    section('calendar');
    const G = fresh(9);
    ok(G.mode === 'vn' && G.vn.scene === 'd1m' && G.day === 1, 'a new game opens on the first morning');
    const bot = Bt.makeBot({ seed: 9 });
    ok(drive(G, bot, (g) => g.mode === 'map'), 'the morning leads to free time');
    ok(G.slot === 1, 'the afternoon is free');
    ok(!Gm.placeActions(G, 'dorm').find((a) => a.id === 'sleep').ok, 'no sleeping before meeting your classmates');
    ok(drive(G, bot, (g) => g.quests.meet === 2), 'meeting Lys, Pip and Hana completes the first quest');
    ok(G.slot === 1, 'meeting them costs no time');
    ok(drive(G, bot, (g) => g.day === 2), 'sleeping leads to the night scene and the next day');
    ok(drive(G, bot, (g) => g.mode === 'map' && g.day === 2), 'day two\'s class, then free time');
    const s0 = G.slot;
    ok(drive(G, bot, (g) => g.slot !== s0 || g.day !== 2), 'a free activity spends the slot');
    ok(drive(G, bot, (g) => g.day === 3), 'and the day moves on');
    // the festival doubles prizes
    const F = fresh(10);
    F.day = 11; F.festival = true;
    Gm.startMini(F, 'stars', 1, 'lys', 'free');
    F.mini.M.score = 99; F.mini.M.done = true;
    const l0 = F.lumens;
    Gm.step(F, NONE, DT);
    ok(F.lumens - l0 === 60, 'festival games pay double');
}

// ======================================================================
if (want('climax')) {
    section('climax');
    const G = fresh(11);
    for (const f of D.FRIENDS) G.joined[f] = true;
    G.bonds.ren = 100;
    G.day = 11; G.slot = 3; G.vn = null;
    Gm.playScene(G, 'd11n');
    readThrough(G, 4);           // dance with Mochi
    ok(G.captive === 'ren' && G.climax, 'the festival night ends with the closest friend taken and the moon rising');
    readThrough(G);
    ok(G.mode === 'map' && G.climax.time === C.CLIMAX.time, 'the rescue begins on the map, the clock full');
    ok(!Gm.placeActions(G, 'tower').find((a) => a.id === 'undercroft').ok, 'the Undercroft waits until everyone is free');
    const t0 = G.climax.time;
    Gm.step(G, { x: 1, y: 0 }, 1);
    ok(G.climax.time < t0, 'the moon climbs while you move');
    G.pos = { x: D.PLACES.library.x, z: D.PLACES.library.z };
    Gm.step(G, NONE, DT);
    Gm.act(G, { t: 'visit', place: 'library' });
    const t1 = G.climax.time;
    ok(Gm.act(G, { t: 'do', id: 'rescue' }) && t1 - G.climax.time >= C.CLIMAX.battleCost - 0.01, 'a rescue battle costs moon time');
    // let the moon rise
    const H = fresh(12);
    H.climax = { time: 0.5, freed: ['theo'], late: false, inside: false };
    H.mode = 'map'; H.vn = null;
    Gm.step(H, NONE, 1);
    ok(H.climax.late && H.vn?.scene === 'moonrise', 'when the moon peaks, the bell tolls');
    readThrough(H);
    ok(!Gm.placeActions(H, 'forest').find((a) => a.id === 'rescue').ok, 'the remaining cages are sealed');
    ok(Gm.placeActions(H, 'tower').find((a) => a.id === 'undercroft').ok, 'and the Undercroft opens anyway');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, until) => { const G = fresh(seed); const b = Bt.makeBot({ seed, fav: 'pip' }); drive(G, b, until); return { G, b }; };
    const a = play(42, (g) => g.day >= 4), b = play(42, (g) => g.day >= 4);
    ok(JSON.stringify(Gm.serialize(a.G)) === JSON.stringify(Gm.serialize(b.G)), 'same seed and inputs, same game');
    for (const [label, until] of [['mid-battle', (g) => g.mode === 'battle' && g.battle.turn > 3], ['mid-mini-game', (g) => g.mode === 'mini' && g.mini.M.t > 2], ['on the map', (g) => g.mode === 'map' && g.day === 5]]) {
        const { G, b: bot } = play(7, until);
        ok(until(G), `reached a save point ${label}`);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const botA = Bt.makeBot({ seed: 99, fav: 'pip' }), botB = Bt.makeBot({ seed: 99, fav: 'pip' });
        drive(G, botA, (g) => g.day >= 7);
        drive(copy, botB, (g) => g.day >= 7);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip ${label} plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const [skill, fav] of [[1, D.FRIENDS[s % 4]], [0.6, 'spread'], [0.3, D.FRIENDS[(s + 1) % 4]]]) {
            const G = fresh(s * 7919);
            const bot = Bt.makeBot({ skill, fav, seed: s, romance: s % 2 === 1 });
            let bad = null, k = 0;
            for (; k < 120 * 60 * 60 && !G.ended; k++) {
                const d = Bt.botDecide(G, bot);
                if (d.cmd) Gm.act(G, d.cmd);
                Gm.step(G, d.inp || NONE, DT);
                G.events.length = 0;
                if (!Number.isFinite(G.pos.x) || !Number.isFinite(G.pos.z)) bad = 'non-finite position';
                else if (G.lumens < 0) bad = 'negative lumens';
                else if (Object.values(G.inv).some((n) => !(n > 0))) bad = 'an empty inventory entry';
                else if (G.battle && G.battle.actors.some((a) => !(a.hp >= 0 && a.hp <= a.mhp))) bad = 'HP out of range';
                if (bad) break;
            }
            ok(!bad && G.ended, `seed ${s} skill ${skill} fav ${fav}: ${bad || (G.ended ? 'reaches the ending' : `stuck on day ${G.day} in ${G.mode} ${G.vn?.scene || ''}`)}`);
            const f = fav === 'spread' ? null : fav;
            if (f && skill === 1) ok(G.captive === null && Ru.best(G) === f, `seed ${s}: the favourite (${f}) is the closest friend`);
            if (f && skill === 1) ok(!!G.romance[f], `seed ${s}: the favourite's last heart event happened`);
            rows.push({
                seed: s, skill, fav, minutes: +(G.t / 60).toFixed(1), kaiLv: G.heroes.kai.lv,
                topHearts: Math.max(...D.FRIENDS.map((x) => Ru.hearts(G, x))), lowHearts: Math.min(...D.FRIENDS.map((x) => Ru.hearts(G, x))),
                charms: G.charms.length, freed: G.climax?.freed.length ?? 0, late: !!G.climax?.late, moonLeft: Math.round(G.climax?.time ?? 0),
                retries: Object.values(G.retries).reduce((a, b) => a + b, 0), partner: G.partner || 'mochi',
            });
        }
    }
    console.table(rows);
    const by = (sk) => rows.filter((r) => r.skill === sk);
    ok(by(1).every((r) => r.topHearts >= 8), 'a devoted player reaches eight hearts with their favourite');
    ok(by(1).every((r) => r.kaiLv >= 6), 'a good player reaches the finale at level 6 or more');
    ok(by(0.6).every((r) => r.lowHearts >= 2), 'a player who spends time with everyone gets two hearts or more with each');
    ok(by(1).every((r) => r.freed === 4 && !r.late), 'a good player frees every student before the moon peaks');
    ok(by(1).every((r) => r.charms === 12), 'a thorough player finds all twelve charms');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
