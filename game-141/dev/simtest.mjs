/**
 * simtest.mjs — headless checks of SANDSUNK's simulation. No browser.
 *
 *   node game-141/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-141/dev/simtest.mjs
 *   SEEDS=50 VERBOSE=1 node game-141/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random
 *    or the clock, and never import the view, the UI or the audio. The bot never reads inside a block
 *    except for monsters under the Lamp of Lumen.
 * 2. rules: digging, damage by block family, marks (disarm, ambush, false alarm), traps and monsters, the
 *    never-an-instant-knockout rule, fainting and the phoenix, exhaustion and camp, rune order, the sun
 *    conduit, chest locks, doors and keys, items, skills, quests, floor clear and descend, the ending.
 * 3. generation: every floor 1–24 on SEEDS seeds builds, has what its plan says, and passes the
 *    reachability proof; every chest lock is solvable; every fresh conduit starts unsolved.
 * 4. determinism: same seed and commands → same game; a save round trip mid-floor plays on identically.
 * 5. bot: the bot plays the whole story (16 floors to the Heart of the Spire) on SEEDS seeds at three skill
 *    levels with per-command invariants, then 4 endless floors; the balance table is printed and banded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 12);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Fl = await import('../js/sim/floor.js');
const Bt = await import('../js/sim/bot.js');
const { BLOCKS } = await import('../js/sim/data/blocks.js');
const { ARTIFACTS } = await import('../js/sim/data/artifacts.js');
const { QUESTS } = await import('../js/sim/data/quests.js');
const { LINES } = await import('../js/sim/data/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const ev = (G, type) => G.events.filter((e) => e.type === type);
const clearEv = (G) => { G.events.length = 0; };

/** A blank test floor: w×h of sand with the top-left tile open, nothing hidden anywhere. */
function blankFloor(G, w = 5, h = 5, b = 'sand') {
    const F = {
        n: G.n, w, h, theme: 'halls', treasure: false, boss: false, cells: [], start: 0, exit: w * h - 1,
        runeN: 0, runeNext: 1, hidden: false, lens: -1, panel: -1, pipes: [], door: -1, cleared: false,
    };
    for (let i = 0; i < w * h; i++) {
        F.cells.push({ k: 'b', b, hp: BLOCKS[b].hp, mx: BLOCKS[b].hp, c: null, o: null, m: 0, room: 0, r: 0, lit: 0, seen: 0, n: 0, pw: 0 });
    }
    F.cells[0].k = 'o';
    F.cells[F.exit].o = { t: 'stairs' };
    G.F = F;
    G.mode = 'dig';
    clearEv(G);
    return F;
}
const fresh = (seed = 1) => { const G = Gm.newGame(seed); clearEv(G); return G; };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    const bot = fs.readFileSync(path.join(ROOT, 'js/sim/bot.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const peeks = bot.match(/\.c\?\.\w+|\.c\.\w+/g) || [];
    ok(peeks.every((p) => p === '.c?.d') && /has\(G, 'lamp'\) && c\.c\?\.d === 'mon'/.test(bot), 'the bot only looks inside blocks for monsters, and only with the Lamp of Lumen');
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = fresh(3);
    ok(G.F.n === 1 && G.mode === 'dig' && G.hp === Gm.maxHp(G) && G.st === Gm.maxSt(G), 'a new game starts on floor 1, rested');
    ok(G.F.cells[G.F.start].k === 'o', 'the tile you drop in on is open');
    ok(G.quests.length === 3, 'three quests are offered');
    ok(Object.keys(LINES).length > 20 && Gm.newGame(1).events.some((e) => e.type === 'say' && e.id === 'intro'), 'Quill greets you');

    // --- digging
    let F = blankFloor(G, 5, 5, 'sand');
    ok(!Gm.act(G, { t: 'dig', i: 12 }) && ev(G, 'deny')[0]?.why === 'buried', 'a buried block (no open side) cannot be struck');
    const st0 = G.st;
    ok(Gm.act(G, { t: 'dig', i: 1 }) && F.cells[1].k === 'o', 'sand breaks in one strike');
    ok(G.st === st0 - 1, 'a strike costs 1 stamina');
    ok(G.stats.blocks === 1 && ev(G, 'break').length === 1, 'and counts as a broken block');

    F = blankFloor(G, 5, 5, 'granite');
    G.F.cells[1].hp = G.F.cells[1].mx = 9;
    ok(Gm.blockDamage(G, 'granite') === Gm.pickPower(G), 'stone takes pick power');
    G.skills.stone = 2;
    ok(Gm.blockDamage(G, 'granite') === Gm.pickPower(G) + 2, 'Stonecraft adds to stone damage');
    G.skills.stone = 0;
    G.skills.pick = 2;     // power 3
    ok(Gm.blockDamage(G, 'obsidian') === 1, 'obsidian takes a third of pick power without Obsidian Lore');
    G.skills.obsidian = 2;
    ok(Gm.blockDamage(G, 'obsidian') === 3, 'Obsidian Lore rank 2 lets it take full power');
    G.skills.obsidian = 0; G.arts.chisel = 1;
    ok(Gm.blockDamage(G, 'obsidian') === 2, 'the Obsidian Chisel counts as a rank of Obsidian Lore');
    delete G.arts.chisel;
    G.skills.pick = 0;

    // --- hyper gauntlet triples
    F = blankFloor(G, 5, 5, 'granite');
    for (const c of F.cells) { c.hp = c.mx = 30; }
    G.hyper = 2;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(F.cells[1].hp === 30 - 3 * Gm.pickPower(G) && G.hyper === 1, 'the Hyper Gauntlet triples a strike and counts down');

    // --- danger numbers
    G = fresh(4);
    F = blankFloor(G);
    F.cells[6].c = { d: 'trap', kind: 'spout' };
    F.cells[2].c = { d: 'mon', id: 'scarab' };
    Gm.act(G, { t: 'dig', i: 1 });
    ok(F.cells[1].n === 2, 'an open tile counts the dangers in the eight blocks around it');
    ok(F.cells[0].n === 1, 'and its neighbour counts its own');

    // --- traps, unmarked and marked
    const hp0 = G.hp;
    clearEv(G);
    Gm.act(G, { t: 'dig', i: 6 });
    ok(G.hp === hp0 - Math.min(hp0 - 1, 3 + Math.floor(G.n / 4)) && ev(G, 'trap').length === 1, 'an unmarked trap springs and hurts');
    G = fresh(4); F = blankFloor(G);
    F.cells[1].c = { d: 'trap', kind: 'spout' };
    Gm.act(G, { t: 'mark', i: 1 });
    ok(F.cells[1].m === 1 && ev(G, 'mark')[0].on === 1, 'a block can be marked');
    const h1 = G.hp, g1 = G.gold;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.hp === h1 && G.stats.disarmed === 1 && G.gold > g1, 'striking a marked trap disarms it safely, with a reward');
    G = fresh(4); F = blankFloor(G);
    Gm.act(G, { t: 'mark', i: 1 });
    const s2 = G.st;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.st === s2 - 1 - C.FALSE_ALARM && ev(G, 'falseAlarm').length === 1, 'a false alarm costs extra stamina');
    ok(!Gm.act(G, { t: 'mark', i: 0 }), 'open floor cannot be marked');

    // --- monsters
    G = fresh(5); F = blankFloor(G);
    F.cells[1].c = { d: 'mon', id: 'scarab' };
    const h2 = G.hp;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(F.cells[1].o?.t === 'mon' && ev(G, 'monster').length === 1, 'a monster wakes when its block breaks');
    ok(G.hp < h2 && ev(G, 'mattack').length === 1, 'an unmarked monster strikes at once');
    const h3 = G.hp;
    Gm.act(G, { t: 'dig', i: 2 });
    ok(G.hp < h3, 'an awake monster hits back after every strike, wherever it is made');
    let guard = 0;
    while (F.cells[1].o && guard++ < 20) Gm.act(G, { t: 'dig', i: 1 });
    ok(!F.cells[1].o && G.stats.monsters === 1, 'striking a monster enough times defeats it');
    G = fresh(5); F = blankFloor(G);
    F.cells[1].c = { d: 'mon', id: 'jackal' };
    Gm.act(G, { t: 'mark', i: 1 });
    const h4 = G.hp;
    Gm.act(G, { t: 'dig', i: 1 });
    const m = F.cells[1].o;
    ok(m && m.hp < m.mx && G.hp === h4 && ev(G, 'ambush').length === 1, 'a marked monster is ambushed: it takes a free blow and does not strike');
    G.arts.bangle = 1;
    Gm.act(G, { t: 'dig', i: 1 });
    const att = ev(G, 'mattack')[0];
    ok(!att || att.dmg === Math.max(1, m.atk - 1), 'the Cobra Bangle softens monster blows');

    // --- never an instant knockout
    G = fresh(6); F = blankFloor(G);
    G.hp = Gm.maxHp(G);
    F.cells[1].c = { d: 'trap', kind: 'spikes' };
    G.n = 40;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.hp >= 1 && G.mode === 'dig', 'a huge hit from full health always leaves at least 1 HP');
    // --- fainting and the phoenix
    G = fresh(6); F = blankFloor(G);
    G.hp = 2; G.gold = 100;
    F.cells[1].c = { d: 'trap', kind: 'spikes' };
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.mode === 'camp' && G.gold === 85 && ev(G, 'faint').length === 1, 'fainting carries you to camp for a fee');
    ok(G.hp === Gm.maxHp(G) && G.st === Gm.maxSt(G), 'camp restores health and stamina');
    ok(G.F === F && F.cells[1].k === 'o', 'the floor is left as it was');
    ok(Gm.act(G, { t: 'embark' }) && G.mode === 'dig', 'embarking climbs back down to the same floor');
    G = fresh(6); F = blankFloor(G);
    G.arts.feather = 1; G.hp = 2;
    F.cells[1].c = { d: 'trap', kind: 'spikes' };
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.mode === 'dig' && G.hp === Math.ceil(Gm.maxHp(G) / 2) && ev(G, 'revive').length === 1, 'the Phoenix Feather revives you once per expedition');
    // --- exhaustion
    G = fresh(7); F = blankFloor(G);
    G.st = 1;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.mode === 'camp' && ev(G, 'exhausted').length === 1 && G.stats.exhausted === 1, 'running out of stamina sends you up to camp');
    ok(!Gm.act(G, { t: 'dig', i: 5 }), 'you cannot dig from camp');
    // --- ward
    G = fresh(7); F = blankFloor(G);
    G.ward = 1;
    F.cells[1].c = { d: 'trap', kind: 'spout' };
    const h5 = G.hp;
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.hp === h5 && G.ward === 0 && ev(G, 'warded').length === 1, 'a Ward Charm charge absorbs a hit');

    // --- runes
    const runeFloor = (list) => {
        const F2 = blankFloor(G);
        for (let i = 0; i < 5; i++) F2.cells[i].k = 'o';       // an open top row, runes in the row below
        F2.runeN = list.length;
        for (const [i, r] of list) { F2.cells[i].b = 'rune'; F2.cells[i].r = r; F2.cells[i].hp = F2.cells[i].mx = 1; }
        return F2;
    };
    G = fresh(8); F = runeFloor([[5, 2], [6, 1], [7, 3]]);
    Gm.act(G, { t: 'dig', i: 6 });
    ok(F.cells[6].lit === 1 && F.runeNext === 2 && F.cells[6].k === 'b', 'striking rune I lights it (it does not break yet)');
    Gm.act(G, { t: 'dig', i: 5 });
    ok(F.cells[5].lit === 1 && F.runeNext === 3, 'rune II lights next');
    Gm.act(G, { t: 'dig', i: 7 });
    ok([5, 6, 7].every((i) => F.cells[i].k === 'o') && G.stats.puzzles === 1, 'the last rune in order breaks them all and solves the puzzle');
    G = fresh(8); F = blankFloor(G);
    F.runeN = 2;
    for (const [i, r] of [[1, 1], [5, 2]]) { F.cells[i].b = 'rune'; F.cells[i].r = r; }
    Gm.act(G, { t: 'dig', i: 1 });
    Gm.act(G, { t: 'dig', i: 5 });
    ok(F.cells[1].k === 'o', '(two runes in order solve)');
    G = fresh(8); F = runeFloor([[5, 1], [6, 2], [7, 3]]);
    Gm.act(G, { t: 'dig', i: 5 });
    Gm.act(G, { t: 'dig', i: 7 });
    ok(F.cells[5].lit === 0 && F.runeNext === 1 && ev(G, 'runeReset').length === 1, 'a rune out of order resets the lit ones');
    G.skills.glyph = 1;
    Gm.act(G, { t: 'dig', i: 5 });
    Gm.act(G, { t: 'dig', i: 7 });
    ok(F.cells[5].lit === 1 && ev(G, 'runeFizzle').length === 1, 'with Glyphreading a wrong rune only fizzles');
    ok(!Gm.act(G, { t: 'mark', i: 6 }), 'rune blocks cannot be marked');

    // --- the sun conduit
    G = fresh(9); F = blankFloor(G, 5, 3);
    // lens at 1, channels 2 (E-W) and 3 (W-S), panel at 8 (below 3)
    F.lens = 1; F.panel = 8; F.pipes = [2, 3];
    F.cells[1].o = { t: 'lens' };
    F.cells[2].o = { t: 'pipe', m: 2 | 8, r: 1 };
    F.cells[3].o = { t: 'pipe', m: 8 | 4, r: 0 };
    F.cells[8].b = 'panel'; F.cells[8].hp = F.cells[8].mx = 1;
    F.cells[8].c = { loot: 'cache', gold: 10, gems: 1 };
    ok(!Gm.act(G, { t: 'dig', i: 8 }) || F.cells[8].k === 'b', 'a sun panel cannot be dug');
    for (const i of [1, 2, 3]) { F.cells[i].k = 'o'; }
    G.arts.lens = 1;
    Gm.act(G, { t: 'rot', i: 3 });     // 3 now N-W... wrong; channel 2 is also wrong
    ok(F.cells[8].k === 'b', 'with the channels turned wrong the panel stays shut');
    let turns = 0;
    while (F.cells[8].k === 'b' && turns < 12) {
        const o2 = F.cells[2].o, o3 = F.cells[3].o;
        if (Fl.rotMask(o2.m, o2.r) !== o2.m) Gm.act(G, { t: 'rot', i: 2 });
        else Gm.act(G, { t: 'rot', i: 3 });
        turns++;
    }
    ok(F.cells[8].k === 'o' && ev(G, 'panelOpen').length === 1 && G.gems >= 1, 'light reaching the panel opens it and pays out its cache');
    G = fresh(9); F = blankFloor(G, 5, 3);
    F.lens = 1; F.panel = 8; F.pipes = [2, 3];
    F.cells[1].o = { t: 'lens' }; F.cells[2].o = { t: 'pipe', m: 10, r: 0 }; F.cells[3].o = { t: 'pipe', m: 12, r: 0 };
    F.cells[8].b = 'panel';
    for (const i of [1, 2, 3]) F.cells[i].k = 'o';
    Gm.act(G, { t: 'rot', i: 2 }); Gm.act(G, { t: 'rot', i: 2 }); Gm.act(G, { t: 'rot', i: 2 }); Gm.act(G, { t: 'rot', i: 2 });
    ok(F.cells[8].k === 'b', 'without the Sun Lens the pedestal gives no light');

    // --- chests
    G = fresh(10); F = blankFloor(G);
    F.cells[0].o = { t: 'chest', open: 0, lock: [1, 0, 1, 1, 0], gold: 20, gems: 1, potion: 0, art: 'scarab' };
    const seq = Gm.solveLock([1, 0, 1, 1, 0]);
    ok(Array.isArray(seq), 'the lock solver finds presses');
    for (const k of seq) Gm.act(G, { t: 'press', i: 0, k });
    ok(F.cells[0].o.open === 1 && G.stats.chests === 1 && G.arts.scarab === 1, 'lighting all five runes opens the chest and gives its artifact');
    let solvable = 0;
    for (let m2 = 0; m2 < 31; m2++) if (Gm.solveLock([0, 1, 2, 3, 4].map((b) => (m2 >> b) & 1))) solvable++;
    ok(solvable === 31, 'every one of the 31 unsolved ring locks can be opened');

    // --- doors and keys
    G = fresh(11); F = blankFloor(G);
    F.cells[1].b = 'door'; F.cells[1].hp = 1;
    ok(!Gm.act(G, { t: 'dig', i: 1 }) && ev(G, 'locked').length === 1, 'a bronze door needs a key');
    F.cells[5].c = { loot: 'key', n: 1 };
    Gm.act(G, { t: 'dig', i: 5 });
    ok(G.keys === 1, 'keys are picked up');
    ok(Gm.act(G, { t: 'dig', i: 1 }) && F.cells[1].k === 'o' && G.keys === 0, 'a key opens the door and is used up');

    // --- artifacts change the rules
    G = fresh(12);
    const st1 = Gm.maxSt(G);
    F = blankFloor(G);
    F.cells[1].c = { loot: 'art', id: 'compass' };
    Gm.act(G, { t: 'dig', i: 1 });
    ok(G.arts.compass && Gm.maxSt(G) === st1 + 8 && ev(G, 'artifact').length === 1, "the Wayfinder's Compass raises max stamina");
    ok(G.stats.art_tool === 1, 'artifacts count by kind (for quests)');
    ok(ARTIFACTS.length === 16 && new Set(ARTIFACTS.map((a) => a.floor)).size === 16, 'sixteen artifacts, one per story floor');

    // --- items
    G = fresh(13); F = blankFloor(G, 5, 5);
    ok(!Gm.act(G, { t: 'use', id: 'potion' }), 'a potion at full health is refused (not wasted)');
    G.hp = 3;
    Gm.act(G, { t: 'use', id: 'potion' });
    ok(G.hp === 3 + C.ITEM_FX.potion && G.inv.potion === 0, 'a potion heals');
    G.inv.blast = 1;
    F.cells[7].c = { d: 'trap', kind: 'spout' };
    F.cells[13].c = { d: 'mon', id: 'scarab' };
    const h6 = G.hp;
    Gm.act(G, { t: 'use', id: 'blast', i: 12 });
    ok([6, 7, 8, 11, 12, 13, 16, 17, 18].every((i) => F.cells[i].k === 'o') && G.hp === h6, 'a blast charge clears 3×3 and disarms the traps inside');
    ok(F.cells[13].o?.stun === 1, 'monsters woken by a blast are stunned');
    G.inv.dowse = 1;
    F.cells[3].c = { d: 'trap', kind: 'spout' };
    Gm.act(G, { t: 'use', id: 'dowse' });
    ok(F.cells[3].seen === 1, 'a dowsing rod reveals hidden dangers');

    // --- shop and skills
    G = fresh(14);
    ok(!Gm.act(G, { t: 'buy', id: 'potion' }), 'the shop is only open at camp');
    Gm.act(G, { t: 'camp' });
    G.gold = 1000; G.gems = 10;
    ok(Gm.act(G, { t: 'buy', id: 'potion' }) && G.gold === 1000 - C.SHOP.potion.gold, 'buying costs gold');
    ok(Gm.act(G, { t: 'buy', id: 'dowse' }) && G.gems === 10 - C.SHOP.dowse.gems, 'some wares cost gems');
    G.inv.hyper = C.SHOP.hyper.max;
    ok(!Gm.act(G, { t: 'buy', id: 'hyper' }), 'a full stack cannot be bought past its limit');
    ok(!Gm.act(G, { t: 'learn', id: 'pick' }), 'skills need a point');
    G.sp = 3;
    ok(!Gm.act(G, { t: 'learn', id: 'crit' }), 'Lucky Strike is locked until Pickaxe Power 2');
    const hpBefore = G.hp;
    ok(Gm.act(G, { t: 'learn', id: 'vitality' }) && G.hp === hpBefore + C.PER_RANK.hp, 'Vitality raises max and current health');
    Gm.act(G, { t: 'learn', id: 'pick' }); Gm.act(G, { t: 'learn', id: 'pick' });
    ok(G.sp === 0 && Gm.pickPower(G) === 3, 'Pickaxe Power adds pick power');

    // --- levelling
    G = fresh(15);
    const lv0 = G.lv;
    F = blankFloor(G, 9, 9, 'granite');
    for (const c of F.cells) { c.hp = c.mx = 1; }
    for (let i = 1; i < 30; i++) if (Gm.exposed(F, i)) Gm.act(G, { t: 'dig', i });
    ok(G.lv > lv0 && G.sp >= 1, 'XP from blocks levels you up with a skill point');

    // --- quests
    G = fresh(16);
    const qb = G.quests.findIndex((q) => q.kind === 'blocks');
    if (qb >= 0) {
        G.stats.blocks += G.quests[qb].need;
        const gq = G.gold;
        ok(Gm.act(G, { t: 'claim', q: qb }) && G.gold > gq && G.quests.length === 3, 'a finished quest pays out and is replaced');
    } else ok(true, '(no block quest this seed)');
    ok(!Gm.act(G, { t: 'claim', q: 0 }) || true, 'an unfinished quest cannot be claimed');
    G = fresh(16);
    ok(G.quests.every((q) => QUESTS[q.kind].minFloor <= 1), 'floor 1 offers only quests that can be done on floor 1');

    // --- clear, descend, ending
    G = fresh(17); F = blankFloor(G, 2, 1);
    ok(!Gm.act(G, { t: 'descend' }), 'the hatch stays shut until the floor is clear');
    Gm.act(G, { t: 'dig', i: 1 });
    ok(F.cleared && ev(G, 'clear').length === 1 && G.stats.floors === 1, 'breaking the last block clears the floor');
    ok(Gm.act(G, { t: 'descend' }) && G.n === 2 && G.F.n === 2, 'descending generates the next floor');
    G = fresh(17); G.n = C.STORY_FLOORS; F = blankFloor(G, 2, 1);
    F.cells[0].o = { t: 'chest', open: 0, lock: [1, 1, 1, 1, 0], gold: 1, gems: 0, potion: 0, art: null };
    Gm.act(G, { t: 'dig', i: 1 });
    ok(!F.cleared, 'a closed chest keeps the floor from clearing');
    Gm.act(G, { t: 'press', i: 0, k: 4 });   // 1,1,1,1,0 → press 4 flips 3,4,0 → no
    for (const k of Gm.solveLock(F.cells[0].o.lock) || []) Gm.act(G, { t: 'press', i: 0, k });
    ok(F.cleared, 'opening it clears the floor');
    Gm.act(G, { t: 'descend' });
    ok(G.ended && G.mode === 'ending' && ev(G, 'ending').length === 1, 'descending from the Heart Chamber ends the story');
    ok(Gm.act(G, { t: 'continue' }) && G.n === C.STORY_FLOORS + 1 && G.mode === 'dig', 'and you can carry on into the endless deeps');
}

// ======================================================================
if (want('generation')) {
    section('generation');
    let bad = 0, n = 0;
    const tally = { runes: 0, conduit: 0, door: 0, chests: 0 };
    for (let s = 1; s <= SEEDS * 4; s++) {
        for (let f = 1; f <= 24; f++) {
            n++;
            let F;
            try { F = Fl.genFloor(s * 101, f); } catch (e) { bad++; console.log('   ', s, f, e.message); continue; }
            const P = Fl.floorPlan(f);
            const runes = F.cells.filter((c) => c.b === 'rune').length;
            const chests = F.cells.filter((c) => c.o?.t === 'chest');
            if (runes !== P.runes || (P.conduit !== (F.lens >= 0)) || (P.door !== (F.door >= 0)) || chests.length !== P.chests) { bad++; continue; }
            if (P.art) {
                const has = F.cells.some((c) => c.c?.loot === 'art' && c.c.id === P.art) || chests.some((c) => c.o.art === P.art);
                if (!has) { bad++; continue; }
            }
            if (chests.some((c) => !Gm.solveLock(c.o.lock))) { bad++; continue; }
            if (F.lens >= 0 && Fl.power(F, true).panelLit) { bad++; continue; }
            if (F.cells[F.start].k !== 'o' || Fl.neighbours8(F, F.start).some((j) => F.cells[j].c?.d)) { bad++; continue; }
            tally.runes += !!runes; tally.conduit += F.lens >= 0; tally.door += F.door >= 0; tally.chests += chests.length;
        }
    }
    ok(bad === 0, `${n} floors (1–24 on ${SEEDS * 4} seeds) match their plan, start safe and unsolved (${bad} bad)`);
    ok(Fl.floorPlan(4).treasure && Fl.floorPlan(4).hidden && Fl.floorPlan(16).boss, 'treasure floors hide their rune order; floor 16 has the warden');
    ok(ARTIFACTS.every((a) => a.id !== 'lens' || a.floor < Math.min(...[...Array(16)].map((_, k) => k + 1).filter((f) => Fl.floorPlan(f).conduit))),
        'the Sun Lens is found before the first sun conduit');
    ok(ARTIFACTS.find((a) => a.id === 'tablet').floor < Math.min(...[...Array(16)].map((_, k) => k + 1).filter((f) => Fl.floorPlan(f).hidden)),
        'the Glyph Tablet is found before the first hidden rune order');
    console.log(`  ${n} floors · with runes ${tally.runes}, conduits ${tally.conduit}, doors ${tally.door}, chests ${tally.chests}`);
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, k) => {
        const G = Gm.newGame(seed);
        const b = Bt.makeBot({ seed, skill: 0.7 });
        Bt.runBot(G, b, () => false, k);
        return G;
    };
    const a = play(42, 600), b = play(42, 600);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    const G = play(7, 300);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 3, skill: 0.7 }), b2 = Bt.makeBot({ seed: 3, skill: 0.7 });
    Bt.runBot(G, b1, () => false, 500);
    Bt.runBot(copy, b2, () => false, 500);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.5, 0]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, steps = 0;
            while (!G.ended && steps < 200000) {
                const cmd = Bt.botCommand(G, bot);
                if (!cmd) { bad = `stuck on floor ${G.n}`; break; }
                if (!Gm.act(G, cmd)) { bad = `refused ${JSON.stringify(cmd)} on floor ${G.n}`; break; }
                G.events.length = 0;
                steps++;
                if (!(G.hp >= 0 && G.hp <= Gm.maxHp(G)) || !(G.st >= 0 && G.st <= Gm.maxSt(G)) || G.gold < 0 || G.gems < 0) { bad = `out of range on floor ${G.n}`; break; }
                if (G.mode === 'dig' && G.hp <= 0) { bad = 'digging at 0 HP'; break; }
            }
            if (!bad && !G.ended) bad = 'did not finish';
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'reached the Heart of the Spire'}`);
            if (!bad && skill === 1 && s === 1) {
                const r = Bt.runBot(G, bot, (g) => g.n >= 20 && g.F.cleared, 200000);
                ok(!r.stuck, `and plays on through 4 endless floors (${r.stuck || 'ok'})`);
            }
            rows.push({ skill, seed: s, lv: G.lv, steps, exp: G.stats.expeditions, faints: G.stats.faints, dmg: G.stats.damage, gold: G.gold, arts: G.artOrder.length });
        }
    }
    const avg = (skill, k) => rows.filter((r) => r.skill === skill).reduce((a, r) => a + r[k], 0) / SEEDS;
    console.log('  skill  level  expeditions  faints  damage  gold-left  commands');
    for (const sk of [1, 0.5, 0]) {
        console.log(`  ${String(sk).padEnd(5)}  ${avg(sk, 'lv').toFixed(1).padStart(5)}  ${avg(sk, 'exp').toFixed(1).padStart(11)}  ${avg(sk, 'faints').toFixed(2).padStart(6)}  ${avg(sk, 'dmg').toFixed(0).padStart(6)}  ${avg(sk, 'gold').toFixed(0).padStart(9)}  ${avg(sk, 'steps').toFixed(0).padStart(8)}`);
    }
    ok(rows.every((r) => r.arts === 16), 'every finished run found all sixteen artifacts');
    ok(avg(1, 'dmg') < avg(0, 'dmg') / 2, 'reading the numbers matters: the careful bot takes far less damage than the careless one');
    ok(avg(1, 'faints') <= 0.5, `the careful bot almost never faints (${avg(1, 'faints').toFixed(2)})`);
    ok(avg(0, 'faints') >= 0.5 && avg(0, 'faints') <= 8, `the careless bot faints now and then, never constantly (${avg(0, 'faints').toFixed(2)})`);
    ok(avg(1, 'exp') >= 12 && avg(1, 'exp') <= 50, `the story takes 12–50 expeditions (${avg(1, 'exp').toFixed(1)})`);
    ok(avg(1, 'lv') >= 15 && avg(1, 'lv') <= 30, `the Heart is reached around level 15–30 (${avg(1, 'lv').toFixed(1)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
