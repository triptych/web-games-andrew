/**
 * simtest.mjs — headless checks of Gemheart Saga's simulation. No browser.
 *
 *   node game-128/dev/simtest.mjs
 *   ONLY=purity,board,battle,village,story,media,determinism,bot node game-128/dev/simtest.mjs
 *   SEEDS=3 VERBOSE=1 node game-128/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock.
 * board        swaps, bounces, matches, specials (line, bomb, prism), gravity and refill, stone, chains, doom.
 * battle       gems become damage/mana/healing, the foe's timer and abilities, skills, items, winning, losing, revives.
 * village      idle production and its cap, the daily gift and streak, the festival, building, the market, the armory,
 *              requests.
 * story        four tales of ten chapters, different for each hero, every fight and speaker known, the ending.
 * media        every sprite, portrait, icon atlas and voice clip the game names exists on disk.
 * determinism  same seed and bot, same game; a save round trip mid-battle plays on identically; unknown saves rejected.
 * bot          the bot finishes every tale at skill 1 and 0.6 on SEEDS seeds; the balance table and its bands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 2);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bd = await import('../js/sim/board.js');
const Bt = await import('../js/sim/battle.js');
const V = await import('../js/sim/village.js');
const Bot = await import('../js/sim/bot.js');
const St = await import('../js/sim/stats.js');
const { HEROES, HERO, NODE } = await import('../js/sim/data/heroes.js');
const { REGIONS, FOE, NEMESES } = await import('../js/sim/data/world.js');
const { TALES, OPENING, ENDINGS } = await import('../js/sim/data/story.js');
const { NPCS, BUILDINGS, REQUESTS } = await import('../js/sim/data/village.js');
const { EQUIP, CONSUMABLES } = await import('../js/sim/data/items.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const { GEM, SPECIAL } = C;

// ---------------------------------------------------------------- helpers
/** Lay out kinds on a fresh board: rows of 8 characters, digits are gem kinds, S stone, D doom, P prism. */
function layout(B, rows) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const ch = rows[r][c];
        const t = B.cells[Bd.idx(c, r)];
        t.k = ch === 'S' ? GEM.STONE : ch === 'D' ? GEM.DOOM : ch === 'P' ? Bd.PRISM : +ch;
        t.sp = ch === 'P' ? SPECIAL.PRISM : 0;
        t.y = r; t.vy = 0; t.st = 'idle'; t.sw = null; t.lock = 0; t.doom = ch === 'D' ? C.BATTLE.doomSecs : 0;
    }
    B.lastSwap = null; B.out.length = 0; B.chain = 0;
}
// a board with no matches anywhere: a 3-colour pattern that never lines up three (kinds 1, 3, 5 and 2, 4)
const QUIET = ['13513513', '24242424', '35135135', '42424242', '51351351', '24242424', '13513513', '42424242'];
const settle = (B, rng, ev, secs = 3) => { for (let t = 0; t < secs; t += DT) Bd.stepBoard(B, DT, rng, ev); };
function battleGame(seed = 3, hero = 'kael', foe = 'slime', lv = 1) {
    const G = Gm.newGame(seed, hero);
    for (let i = 0; i < 20 && G.mode === 'scene'; i++) Gm.act(G, { t: 'next' });
    G.quest = { kind: 'patrol', region: 'greenmarch', lv, fights: [foe], i: 0, hp: null };
    Bt.startBattle(G, foe, lv);
    G.mode = 'battle';
    G.battle.phase = 'fight';
    return G;
}
const home = (seed, hero) => { const G = Gm.newGame(seed, hero); for (let i = 0; i < 20 && G.mode === 'scene'; i++) Gm.act(G, { t: 'next' }); return G; };
const evs = (G, type) => G.events.filter((e) => e.type === type);

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|assets)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    const bot = fs.readFileSync(path.join(ROOT, 'js/sim/bot.js'), 'utf8');
    ok(!/G\.rng/.test(bot), 'the bot rolls its own dice, never the game rng');
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('board')) {
    section('board');
    const rng = makeRng(9);
    let B = Bd.newBoard(rng);
    const ev = [];
    ok(B.cells.every((t) => t), 'a new board is full');
    ok(Bd.findMoves(B).length > 0, 'a new board has a move');
    let anyMatch = false;
    for (let i = 0; i < 64; i++) if (B.cells[i].k < C.KINDS) { /* noop */ }
    settle(B, rng, ev, 0.5);
    anyMatch = ev.some((e) => e.type === 'match');
    ok(!anyMatch, 'a new board starts with no match on it');

    // a bounce
    layout(B, QUIET);
    ok(Bd.findMoves(B).length === 0, 'the quiet layout has no moves (test fixture)');
    const k0 = B.cells[0].k, k1 = B.cells[1].k;
    ok(Bd.trySwap(B, 0, 1, ev) === 'bad', 'a swap that makes no match is refused…');
    ok(B.cells[0].k === k0 && B.cells[1].k === k1, '…and the gems stay where they were');
    ok(Bd.trySwap(B, 0, 9, ev) === 'no', 'diagonal swaps are not allowed');

    // a plain match of three: row 0 = 0 0 1 0 … swap (2,0) with (3,0)
    layout(B, ['00102424', ...QUIET.slice(1)]);
    B.cells[Bd.idx(3, 0)].k = 0; B.cells[Bd.idx(2, 0)].k = 1;    // 0 0 1 0
    ok(Bd.trySwap(B, Bd.idx(2, 0), Bd.idx(3, 0), ev) === 'ok', 'a swap that lines up three is accepted');
    settle(B, rng, ev, 0.3);
    const o = B.out.find((x) => x.k === 0);
    ok(o && o.n === 3 && !o.blast, 'three swords are matched and reported');
    settle(B, rng, ev, 3);
    ok(Bd.isStable(B) && B.cells.every((t) => t), 'gravity and refill leave a full, still board');

    // four in a row makes a line gem; five makes a prism; an L makes a bomb
    const mk = (rows, a, b, label, sp) => {
        layout(B, rows);
        B.out.length = 0;
        ev.length = 0;
        ok(Bd.trySwap(B, a, b, ev) === 'ok', `${label}: the swap is accepted`);
        settle(B, rng, ev, 0.35);
        ok(ev.some((e) => e.type === 'special' && e.sp === sp), `${label} makes the right special gem`);
    };
    mk(['22124242', ...QUIET.slice(1)], Bd.idx(2, 0), Bd.idx(2, 1), 'four in a row', SPECIAL.LINE_H);
    mk(['22122424', ...QUIET.slice(1)], Bd.idx(2, 0), Bd.idx(2, 1), 'five in a row', SPECIAL.PRISM);
    mk(['23513513', '24242424', '52235135', '22424242', ...QUIET.slice(4)], Bd.idx(0, 2), Bd.idx(0, 3), 'an L', SPECIAL.BOMB);

    // a line gem goes off when matched and clears its whole row
    layout(B, QUIET);
    const r4 = 4;
    for (let c = 0; c < 3; c++) B.cells[Bd.idx(c, r4)].k = 0;
    B.cells[Bd.idx(1, r4)].sp = SPECIAL.LINE_H;
    B.out.length = 0; ev.length = 0;
    settle(B, rng, ev, 0.1);
    ok(ev.some((e) => e.type === 'blast' && e.sp === SPECIAL.LINE_H), 'a matched line gem blasts');
    const blasted = B.out.filter((x) => x.blast).reduce((a, x) => a + x.n, 0);
    ok(blasted === 5, `and the rest of its row counts as collected (${blasted} of 5)`);

    // a prism swapped with a gem clears that whole colour
    layout(B, QUIET);
    B.cells[Bd.idx(0, 0)].k = Bd.PRISM; B.cells[Bd.idx(0, 0)].sp = SPECIAL.PRISM;
    const target = B.cells[Bd.idx(1, 0)].k;
    const count = B.cells.filter((t) => t.k === target).length;
    B.out.length = 0; ev.length = 0;
    ok(Bd.trySwap(B, 0, 1, ev) === 'ok', 'a prism can always be swapped');
    settle(B, rng, ev, 0.3);
    ok(ev.some((e) => e.type === 'prism'), 'the prism fires');
    ok(B.out.filter((x) => x.k === target).reduce((a, x) => a + x.n, 0) === count, `every gem of that colour is collected (${count})`);

    // stone breaks next to a match; stone and doom can't be swapped; a chained gem can't be swapped
    layout(B, QUIET);
    for (let c = 0; c < 3; c++) B.cells[Bd.idx(c, 6)].k = 2;
    B.cells[Bd.idx(1, 7)].k = GEM.STONE;
    ev.length = 0;
    settle(B, rng, ev, 0.1);
    ok(ev.some((e) => e.type === 'stoneBreak'), 'a match next to a stone breaks it');
    layout(B, QUIET);
    B.cells[0].k = GEM.STONE;
    ok(Bd.trySwap(B, 0, 1, ev) === 'no', 'stone can\'t be swapped');
    layout(B, QUIET);
    B.cells[0].lock = 1;
    ok(Bd.trySwap(B, 0, 1, ev) === 'no', 'a chained gem can\'t be swapped');

    // cascades count as a chain
    B = Bd.newBoard(makeRng(4));
    let maxChain = 0;
    const r2 = makeRng(4);
    for (let n = 0; n < 200; n++) {
        settle(B, r2, ev, 1.2);
        const m = Bd.findMoves(B);
        if (!m.length) break;
        Bd.trySwap(B, m[0].a, m[0].b, ev);
        for (const x of B.out) maxChain = Math.max(maxChain, x.chain);
        B.out.length = 0;
    }
    ok(maxChain >= 3, `200 moves make cascades (longest chain ${maxChain})`);
    ok(B.cells.every((t) => t), 'and the board is still full');
}

// ======================================================================
if (want('battle')) {
    section('battle');
    let G = battleGame();
    const f = G.battle.foe, h = G.battle.hero;
    const hp0 = f.hp;
    G.battle.board.out.push({ k: GEM.SWORD, n: 3, chain: 1, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT);
    ok(f.hp < hp0 && Math.abs((hp0 - f.hp) - Math.round(h.atk * C.BATTLE.swordPerGem * 3 * (1 + h.mods.sword))) <= 1, 'three swords hit for 1.5× attack (with the hero\'s sword bonus)');
    const before = f.hp;
    G.battle.board.out.push({ k: GEM.SWORD, n: 3, chain: 3, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT);
    ok((before - f.hp) > (hp0 - before) * 1.4, 'a third cascade step hits harder');
    // mana and weakness
    G = battleGame(3, 'kael', 'slime');     // the slime is weak to ruby
    const g = G.battle;
    const fhp = g.foe.hp;
    g.board.out.push({ k: GEM.RUBY, n: 3, chain: 1, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT);
    const ruby = fhp - g.foe.hp;
    ok(g.hero.mana.r === 3, 'rubies fill the ruby pool');
    const f2 = g.foe.hp;
    g.board.out.push({ k: GEM.SAPPHIRE, n: 3, chain: 1, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT);
    ok(ruby >= (f2 - g.foe.hp) * 1.8, 'the foe\'s weakness colour chips for double');
    // hearts heal
    g.hero.hp = 50;
    g.board.out.push({ k: GEM.HEART, n: 3, chain: 1, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT);
    ok(g.hero.hp > 50, 'hearts heal');
    // the foe's timer
    G = battleGame(5, 'kael', 'boar');
    const hb = G.battle.hero.hp;
    for (let t = 0; t < G.battle.foe.every + 0.1; t += DT) Gm.step(G, DT);
    ok(evs(G, 'foeAttack').length === 1 && G.battle.hero.hp < hb, 'the foe attacks when its timer runs out');
    ok(G.battle.board.cells.filter((x) => x && x.k === GEM.STONE).length === 3 || evs(G, 'curse').length === 1, 'the boar\'s blow turns gems to stone');
    const quickest = Object.keys(FOE).map((id) => St.foeStats(id, 1)).sort((x, y) => x.every - y.every)[0];
    ok(quickest.every >= 4, `no foe attacks more often than every 4 s (the quickest, ${quickest.name}, every ${quickest.every.toFixed(1)} s)`);
    // skills need mana
    G = battleGame(6, 'kael', 'wolf');
    ok(!Bt.canSkill(G, 'k_sunder'), 'a skill without mana can\'t be used');
    G.battle.hero.mana.r = 12;
    const w0 = G.battle.foe.hp;
    ok(Gm.act(G, { t: 'skill', node: 'k_sunder' }) && G.battle.hero.mana.r === 2, 'Sundering Strike spends 10 ruby');
    ok(w0 - G.battle.foe.hp >= G.battle.hero.atk * 4 * 0.99, 'and hits for at least 4× attack');
    // shields and freezes
    G = battleGame(7, 'sela', 'goblin');
    G.hero.ranks.s_prison = 1;
    G.battle.hero.mana.s = 10; G.battle.hero.mana.e = 10;
    Gm.act(G, { t: 'skill', node: 's_prison' });
    const t0 = G.battle.foe.timer;
    for (let t = 0; t < 2; t += DT) Gm.step(G, DT);
    ok(G.battle.foe.timer === t0 && G.battle.foe.frozen > 0, 'a frozen foe\'s timer stops');
    G = battleGame(8, 'kael', 'goblin');
    G.hero.ranks.k_aegis = 1;
    G.battle.hero.mana.s = 10;
    Gm.act(G, { t: 'skill', node: 'k_aegis' });
    const sh = G.battle.hero.shield, hp1 = G.battle.hero.hp;
    for (let t = 0; t < G.battle.foe.every + 0.05; t += DT) Gm.step(G, DT);
    ok(sh > 0 && G.battle.hero.hp === hp1 && G.battle.hero.shield < sh, 'Aegis absorbs the next blow');
    // items
    G = battleGame(9);
    G.battle.hero.hp = 20;
    ok(Gm.act(G, { t: 'item', id: 'potion' }) && G.battle.hero.hp > 20 && G.bag.potion === 1, 'a potion heals and is used up');
    ok(!Gm.act(G, { t: 'item', id: 'potion' }), 'items have a cooldown');
    // doom gems
    G = battleGame(10, 'kael', 'shaman');
    const B = G.battle.board;
    const s = Bd.convert(B, G.rng, 1, GEM.DOOM)[0];
    B.cells[s].doom = 0.5;
    const hd = G.battle.hero.hp;
    for (let t = 0; t < 0.6; t += DT) Gm.step(G, DT);
    ok(evs(G, 'doomBurst').length === 1 && G.battle.hero.hp < hd && B.cells[s].k === GEM.STONE, 'an uncleared doom gem bursts, hurts and turns to stone');
    // winning pays once; losing; revives
    G = battleGame(11, 'fenn', 'slime');
    const gold0 = G.res.gold, xp0 = G.hero.xp;
    G.battle.foe.hp = 1;
    G.battle.board.out.push({ k: GEM.SWORD, n: 3, chain: 1, blast: false, special: 0, x: 0, y: 0 });
    Gm.step(G, DT); Gm.step(G, DT);
    ok(G.battle.phase === 'won' && G.res.gold > gold0 && (G.hero.xp > xp0 || G.hero.lv > 1), 'a win pays gold and experience');
    const gold1 = G.res.gold;
    Gm.step(G, DT);
    ok(G.res.gold === gold1, 'and pays only once');
    ok(Gm.act(G, { t: 'continue' }) && G.mode === 'village', 'continue after the last fight goes home');
    G = battleGame(12);
    G.bag.feather = 1;
    G.battle.hero.hp = 1;
    G.battle.foe.timer = 0.01;
    Gm.step(G, DT);
    ok(G.battle.phase === 'fight' && G.battle.hero.hp > 1 && G.bag.feather === 0, 'a Phoenix Feather revives the hero');
    G.battle.hero.hp = 1;
    G.battle.foe.timer = 0.01;
    Gm.step(G, DT);
    ok(G.battle.phase === 'lost', 'without one, the hero falls');
    ok(Gm.act(G, { t: 'continue' }) && G.mode === 'village' && !G.quest, 'a loss sends the hero home');
    // level ups give skill points
    G = Gm.newGame(1, 'odo');
    Gm.gainXp(G, C.XP_CURVE(1) + C.XP_CURVE(2));
    ok(G.hero.lv === 3 && G.hero.sp === 2, 'levels give a skill point each');
    ok(!Gm.learnBlock(G, 'o_flame') && Gm.learnBlock(G, 'o_pure'), 'a tier needs the one below it');
    ok(Gm.learnBlock(G, 'k_sunder'), 'another hero\'s skill can\'t be learned');
}

// ======================================================================
if (want('village')) {
    section('village');
    const H = C.HOUR;
    const now0 = Date.UTC(2026, 5, 1, 12);
    let G = Gm.newGame(2, 'kael');
    for (let i = 0; i < 20 && G.mode === 'scene'; i++) Gm.act(G, { t: 'next' });
    ok(G.mode === 'village', 'the opening scene leads to the village');
    Gm.act(G, { t: 'collect', now: now0 });
    const g0 = G.res.gold;
    Gm.act(G, { t: 'collect', now: now0 + 2 * H });
    ok(G.res.gold - g0 === 2 * V.rates(G).gold, 'the inn pays gold every hour');
    const cap = V.capHours(G);
    const g1 = G.res.gold;
    Gm.act(G, { t: 'collect', now: now0 + 2 * H + 100 * H });
    ok(G.res.gold - g1 === cap * V.rates(G).gold, `idle output is capped at ${cap} hours`);
    const g2 = G.res.gold;
    Gm.act(G, { t: 'collect', now: now0 });
    ok(G.res.gold === g2, 'a clock set back pays nothing');
    // daily
    G = home(2, 'kael');
    const day = (n) => `2026-06-${String(n).padStart(2, '0')}`;
    Gm.act(G, { t: 'collect', now: now0 });
    ok(Gm.act(G, { t: 'daily', day: day(1), now: now0 }), 'the daily gift can be claimed');
    ok(!Gm.act(G, { t: 'daily', day: day(1), now: now0 + H }), 'only once a day');
    Gm.act(G, { t: 'daily', day: day(2), now: now0 + 24 * H });
    ok(G.village.daily.streak === 2, 'two days running is a streak of 2');
    Gm.act(G, { t: 'daily', day: day(5), now: now0 + 96 * H });
    ok(G.village.daily.streak === 1, 'missing a day resets the streak');
    ok(V.dayNumber('2026-03-01') - V.dayNumber('2026-02-28') === 1 && V.dayNumber('2025-01-01') - V.dayNumber('2024-12-31') === 1, 'day arithmetic crosses months and years');
    // the festival doubles production
    const G2 = home(2, 'kael');
    Gm.act(G2, { t: 'collect', now: now0 + 96 * H });
    const gb = G2.res.gold;
    G2.village.boostFrom = now0 + 96 * H; G2.village.boostUntil = now0 + 98 * H;
    Gm.act(G2, { t: 'collect', now: now0 + 98 * H });
    ok(G2.res.gold - gb === 4 * V.rates(G2).gold, 'the festival doubles two hours of production');
    // building
    G = Gm.newGame(3, 'kael');
    for (let i = 0; i < 20 && G.mode === 'scene'; i++) Gm.act(G, { t: 'next' });
    G.res = { gold: 5000, wood: 5000, ore: 5000, grain: 5000, crystal: 500 };
    ok(Gm.act(G, { t: 'build', id: 'armory' }) && G.village.lv.armory === 1, 'the Armory can be built');
    ok(!Gm.act(G, { t: 'build', id: 'inn' }) && /Town Hall/.test(V.buildBlock(G, 'inn')), 'nothing outgrows the Town Hall');
    ok(Gm.act(G, { t: 'build', id: 'hall' }) && Gm.act(G, { t: 'build', id: 'inn' }), 'raising the hall lets the inn grow');
    ok(G.res.gold === 5000 - BUILDINGS.find((b) => b.id === 'armory').costs[1].gold - BUILDINGS.find((b) => b.id === 'hall').costs[2].gold - BUILDINGS.find((b) => b.id === 'inn').costs[2].gold, 'building costs exactly its price');
    const hpBefore = St.heroStats(G).hp;
    Gm.act(G, { t: 'build', id: 'farm' });
    ok(St.heroStats(G).hp > hpBefore, 'a bigger farm feeds the hero: more health');
    // market, gear, armory
    ok(!Gm.act(G, { t: 'buy', id: 'longsword' }), 'a level 1 Market has no tier 2 gear');
    Gm.act(G, { t: 'build', id: 'market' });
    ok(Gm.act(G, { t: 'buy', id: 'longsword' }), 'the Market sells tier 2 gear at level 2');
    ok(!Gm.act(G, { t: 'buy', id: 'dawnbreaker' }), 'but not tier 5');
    const ls = G.inv.find((i) => i.id === 'longsword');
    const atk0 = St.heroStats(G).atk;
    Gm.act(G, { t: 'equip', uid: ls.uid });
    ok(St.heroStats(G).atk > atk0, 'a better sword raises attack');
    ok(Gm.act(G, { t: 'upgrade', uid: ls.uid }) && Gm.act(G, { t: 'upgrade', uid: ls.uid }) && ls.plus === 2, 'the Armory upgrades gear');
    ok(!Gm.act(G, { t: 'upgrade', uid: ls.uid }) && /\+2/.test(V.upgradeBlock(G, ls.uid)), 'up to +2 per Armory level');
    ok(!Gm.act(G, { t: 'sell', uid: ls.uid }), 'worn gear can\'t be sold');
    const old = G.inv.find((i) => i.id === 'shortsword');
    const gs = G.res.gold;
    ok(Gm.act(G, { t: 'sell', uid: old.uid }) && G.res.gold > gs, 'spare gear sells');
    // requests
    G.stats.kills.greenmarch = 6;
    ok(Gm.act(G, { t: 'claim', id: 'rq_slimes' }) && !Gm.act(G, { t: 'claim', id: 'rq_slimes' }), 'a finished request pays once');
    ok(!Gm.act(G, { t: 'claim', id: 'rq_peaks' }), 'an unfinished one pays nothing');
}

// ======================================================================
if (want('story')) {
    section('story');
    const speakers = new Set(['narrator', ...HEROES.map((h) => h.id), ...NPCS.map((n) => n.id), ...Object.keys(FOE)]);
    for (const h of HEROES) {
        const t = TALES[h.id];
        ok(t.length === 10, `${h.name}: ten chapters`);
        let badFight = 0, badSpeaker = 0;
        for (const c of t) {
            for (const f of c.fights) if (!FOE[f]) badFight++;
            for (const lines of [c.before, c.after, ...Object.values(c.mid || {})]) for (const [sp] of lines || []) if (!speakers.has(sp)) badSpeaker++;
        }
        ok(!badFight, `${h.name}: every fight is a known foe`);
        ok(!badSpeaker, `${h.name}: every speaker is known`);
        const nem = NEMESES.find((n) => n.hero === h.id).id;
        ok(t.filter((c) => c.fights.includes(nem)).length === 2, `${h.name}: meets their nemesis twice`);
        ok(t[9].fights[t[9].fights.length - 1] === 'sovereign', `${h.name}: ends with the Gloam Sovereign`);
        ok(t.every((c, i) => i === 0 || c.lv >= t[i - 1].lv), `${h.name}: chapters never get easier`);
        ok(ENDINGS[h.id].length >= 2, `${h.name}: has an ending`);
    }
    const firstRegions = new Set(HEROES.map((h) => TALES[h.id].map((c) => c.region).join(',')));
    ok(firstRegions.size === 4, 'every hero walks the Vale in a different order');
    const scenes = new Set(HEROES.flatMap((h) => TALES[h.id].map((c) => JSON.stringify(c.before))));
    ok(scenes.size === 40, `every chapter of every tale has its own scene (${scenes.size} of 40)`);
    // patrols open as the tale reaches a region
    const G = Gm.newGame(5, 'sela');
    for (let i = 0; i < 20 && G.mode === 'scene'; i++) Gm.act(G, { t: 'next' });
    ok(Gm.regionsOpen(G).includes('mirefen') && !Gm.regionsOpen(G).includes('frostfang'), 'Sela starts with the marsh open, not the peaks');
    ok(!Gm.act(G, { t: 'patrol', region: 'frostfang' }), 'a region the tale hasn\'t reached can\'t be patrolled');
    ok(Gm.act(G, { t: 'story' }) && G.mode === 'scene', 'the next chapter opens with its scene');
    let lines = 0;
    while (G.mode === 'scene' && lines < 50) { Gm.act(G, { t: 'next' }); lines++; }
    ok(G.mode === 'battle' && G.battle.foe.id === TALES.sela[0].fights[0], 'then its first fight');
}

// ======================================================================
if (want('media')) {
    section('media');
    const has = (p) => fs.existsSync(path.join(ROOT, p));
    let missing = [];
    for (const id of Object.keys(FOE)) if (!has(`art/mon/${id}.webp`)) missing.push(id);
    for (const h of HEROES) { if (!has(`art/hero/${h.id}.webp`)) missing.push(h.id); if (!has(`art/por/${h.id}.webp`)) missing.push('por ' + h.id); if (!has(`art/skills/${h.id}.webp`)) missing.push('skills ' + h.id); }
    for (const n of NPCS) if (!has(`art/por/${n.id}.webp`)) missing.push(n.id);
    for (const r of REGIONS) if (!has(`art/bg/${r.id}.webp`)) missing.push('bg ' + r.id);
    for (const s of ['gems', 'gear', 'goods', 'misc']) if (!has(`art/icons/${s}.webp`)) missing.push(s);
    for (const f of ['bg/title', 'bg/village', 'buildings']) if (!has(`art/${f}.webp`)) missing.push(f);
    ok(!missing.length, `every picture exists (${missing.join(', ') || 'all'})`);
    const Au = await import('../js/audio.js');
    missing = [];
    for (const n of Au.FILES.music) if (!has(`audio/music-${n}.mp3`)) missing.push('music-' + n);
    for (const n of Au.FILES.sfx) if (!has(`audio/sfx-${n}.mp3`)) missing.push('sfx-' + n);
    for (const n of Au.FILES.voice) if (!has(`audio/vo-${n}.mp3`)) missing.push('vo-' + n);
    ok(!missing.length, `every sound the game names exists (${missing.join(', ') || 'all'})`);
    const used = new Set(Au.VOICE_LINES.values());
    const story = Au.FILES.voice.filter((n) => !/-(cry|win|hurt)$/.test(n) && n !== 'murk');
    const unused = story.filter((n) => !used.has(n));
    ok(!unused.length, `every story voice clip is tied to a line of dialogue (${unused.join(', ') || `${used.size} lines`})`);
    const sizeOf = (d) => fs.readdirSync(path.join(ROOT, d), { recursive: true }).reduce((a, f) => { const p = path.join(ROOT, d, f); return a + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); }, 0);
    const mb = (sizeOf('art') + sizeOf('audio')) / 1e6;
    ok(mb < 12, `media stays small (${mb.toFixed(1)} MB)`);
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed) => {
        const G = Gm.newGame(seed, 'fenn');
        Bot.runCampaign(G, Bot.makeBot({ skill: 0.8, seed }), { maxQuests: 6 });
        return G;
    };
    ok(JSON.stringify(Gm.serialize(play(42))) === JSON.stringify(Gm.serialize(play(42))), 'same seed and bot, same game');
    // mid-battle round trip
    const G = battleGame(13, 'odo', 'troll', 5);
    const b1 = Bot.makeBot({ skill: 1, seed: 3 });
    for (let t = 0; t < 6; t += DT) { const c = Bot.botBattle(G, b1, DT); if (c && c.t !== 'continue') Gm.act(G, c); Gm.step(G, DT); }
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const ba = Bot.makeBot({ skill: 1, seed: 99 }), bb = Bot.makeBot({ skill: 1, seed: 99 });
    for (const [g, b] of [[G, ba], [copy, bb]]) for (let t = 0; t < 8; t += DT) { const c = Bot.botBattle(g, b, DT); if (c && c.t !== 'continue') Gm.act(g, c); Gm.step(g, DT); }
    G.events.length = 0; copy.events.length = 0;
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    let threw = 0;
    try { Gm.deserialize({ v: 999 }); } catch { threw++; }
    try { Gm.deserialize({ v: 1, hero: { id: 'nobody' } }); } catch { threw++; }
    ok(threw === 2, 'unknown saves are rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    // a beginner gets through chapter 1 (v1.1.1: a player lost to the Bandit Captain every time). Skill 0 plays 85% of
    // its moves at random, 2.8 s apart: weaker than someone still learning the board.
    for (const h of HEROES) {
        let won = 0;
        for (let s = 1; s <= 6; s++) {
            const G = Gm.newGame(s * 31, h.id);
            while (G.mode !== 'village') Gm.act(G, { t: G.mode === 'scene' ? 'next' : 'skip' });
            Gm.act(G, { t: 'story' });
            const bot = Bot.makeBot({ skill: 0, seed: s });
            for (let n = 0; n < 60000 && G.mode !== 'village'; n++) {
                if (G.mode === 'scene') { Gm.act(G, { t: 'next' }); continue; }
                const c = Bot.botBattle(G, bot, DT); if (c) Gm.act(G, c);
                if (G.mode === 'battle') Gm.step(G, DT);
                G.events.length = 0;
            }
            if (G.story.ch === 1) won++;
        }
        ok(won >= 5, `a beginner (skill-0 bot) clears ${h.name}'s chapter 1: ${won}/6`);
    }
    const rows = [];
    for (const h of HEROES) {
        for (const skill of [1, 0.6]) {
            for (let s = 1; s <= SEEDS; s++) {
                const G = Gm.newGame(s * 7919 + skill * 100, h.id);
                const rep = Bot.runCampaign(G, Bot.makeBot({ skill, seed: s }));
                const fights = G.stats.battlesWon + G.stats.battlesLost;
                rows.push({ hero: h.id, skill, seed: s, done: rep.done, lv: rep.level, quests: rep.quests, lost: G.stats.battlesLost, secs: rep.battleSecs / fights,
                    hall: G.village.lv.hall, chain: G.stats.chainMax, specials: G.stats.specials });
                ok(rep.done, `${h.name} at skill ${skill}, seed ${s}: the tale is finished (level ${rep.level}, ${rep.quests} quests)`);
            }
        }
    }
    console.log('  hero  skill  lv  quests  lost  s/fight  hall  chain');
    for (const r of rows) console.log(`  ${r.hero.padEnd(5)} ${String(r.skill).padEnd(5)} ${String(r.lv).padStart(3)} ${String(r.quests).padStart(6)} ${String(r.lost).padStart(5)} ${r.secs.toFixed(1).padStart(8)} ${String(r.hall).padStart(5)} ${String(r.chain).padStart(6)}`);
    const avg = (skill, k) => { const x = rows.filter((r) => r.skill === skill); return x.reduce((a, r) => a + r[k], 0) / x.length; };
    ok(avg(1, 'secs') >= 5 && avg(1, 'secs') <= 16, `the perfect bot's fights are short but real (${avg(1, 'secs').toFixed(1)} s)`);
    ok(avg(0.6, 'secs') >= 15 && avg(0.6, 'secs') <= 45, `a human-speed bot's fights last 15–45 s (${avg(0.6, 'secs').toFixed(1)} s)`);
    ok(avg(1, 'lost') <= 1.5, `the perfect bot almost never falls (${avg(1, 'lost').toFixed(1)} a run)`);
    ok(avg(0.6, 'lost') >= avg(1, 'lost'), 'a slower bot falls at least as often');
    ok(avg(0.6, 'lost') <= 12, `but a human-speed bot is not stuck: ${avg(0.6, 'lost').toFixed(1)} falls a tale`);
    for (const h of HEROES) { const x = rows.filter((r) => r.hero === h.id && r.skill === 0.6); ok(x.every((r) => r.lost <= 16), `${h.name} at skill 0.6 falls at most 16 times (${x.map((r) => r.lost).join(', ')})`); }
    ok(avg(1, 'quests') <= 60, `the tale takes a reasonable number of quests (${avg(1, 'quests').toFixed(0)})`);
    ok(rows.every((r) => r.hall >= 2), 'every run grows the village');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
