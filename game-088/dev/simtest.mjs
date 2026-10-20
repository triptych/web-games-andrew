/**
 * simtest.mjs — headless checks of Curio Cove's simulation. No browser.
 *
 *   node game-088/dev/simtest.mjs            # everything
 *   ONLY=purity,board node game-088/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-088/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. board: matching, every special and its combos, dirt and fossils, boulders, crust, relics,
 *    gravity past blockers, refusing a swap that makes nothing, the shuffle, out of moves.
 * 3. fuzz: thousands of random moves over every level with the board checked after each.
 * 4. levels: all 60 story levels and 40 Night Digs build, start with a move, and have goals
 *    the board can satisfy; the rewards cover every find and every bone.
 * 5. museum: chapter gating, tasks and their costs, staff and perks, the till, decorations,
 *    the stars of a replay, buying moves.
 * 6. determinism: the same seed and inputs give the same game; a save round trip mid-dig plays
 *    on identically; an unknown save version is rejected.
 * 7. story: bots at two skills play the whole story to the finale; prints the balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Bd = await import('../js/sim/board.js');
const Lv = await import('../js/sim/levels.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const D = await import('../js/sim/data.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);

/** A board from a picture: digits are colours, other letters as in makeBoard. */
function board(pic, extra = {}) {
    const rows = pic.trim().split('\n').map((s) => s.trim());
    const spec = { rows: rows.map((r) => r.replace(/[0-5]/g, 'o')), colors: [0, 1, 2, 3, 4, 5], moves: 20, goals: [{ kind: 'color', c: 0, n: 999 }], ...extra };
    const B = Bd.makeBoard(spec, 99);
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (/[0-5]/.test(ch)) B.cells[r * B.C + c].t.c = +ch; }));
    B.colors = [3, 4, 5];       // refills never match the test colours 0-2 by accident... mostly
    B.ev.length = 0;
    return B;
}
const tile = (B, r, c) => B.cells[r * B.C + c].t;
const evs = (B, type) => B.ev.filter((e) => e.type === type);

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

if (want('board')) {
    section('board');
    // a plain three
    let B = board(`
        34534
        00102
        43543
        35435`);
    ok(Bd.trySwap(B, 1, 2, 2, 2) === false, 'a swap that matches nothing is refused');
    ok(B.moves === 20 && evs(B, 'swap')[0]?.ok === false, 'and costs no move');
    B.ev.length = 0;
    ok(Bd.trySwap(B, 1, 2, 1, 3), 'swapping the 1 out makes three amphorae');
    ok(B.moves === 19, 'a real swap spends a move');
    ok(evs(B, 'clear').filter((e) => e.by === 'match').length === 3, 'three finds cleared');
    ok(B.goals[0].got === 3, 'and counted toward the amphora goal');
    ok(evs(B, 'fall').length >= 1 && !Bd.checkBoard(B), 'the gap refills and the board is whole');

    // four in a row → trowel
    B = board(`
        345345
        003043
        450435
        354354`);
    ok(Bd.trySwap(B, 1, 2, 2, 2), 'swap completes four in a row');
    const cr = evs(B, 'create')[0];
    ok(cr && cr.tile.s === 'h' && cr.tile.c === 0, 'four in a row makes a row trowel of that colour');
    ok(cr && cr.r === 1 && cr.c === 2, 'born where the swapped find landed');

    // L shape → pickaxe
    B = board(`
        03453
        04534
        30045
        05353`);
    ok(Bd.trySwap(B, 2, 0, 3, 0), 'swap completes an L');
    ok(evs(B, 'create').some((e) => e.tile.s === 'bomb'), 'an L makes a pickaxe');

    // five → sunstone
    B = board(`
        34534
        00100
        43043
        35435`);
    ok(Bd.trySwap(B, 1, 2, 2, 2), 'swap completes five in a row');
    ok(evs(B, 'create').some((e) => e.tile.k === 'sun'), 'five in a row makes a sunstone');

    // square → scarab
    B = board(`
        34534
        40053
        50345
        34034`);
    ok(Bd.trySwap(B, 1, 1, 2, 2) === false, 'a diagonal is not a swap');
    ok(Bd.trySwap(B, 2, 2, 3, 2), 'swap completes a 2×2 square');
    ok(evs(B, 'create').some((e) => e.tile.s === 'scarab'), 'a square hatches a scarab');

    // a trowel going off clears its row
    B = board(`
        345345
        0H3453
        433545
        354354`);
    tile(B, 1, 1).c = 0;
    tile(B, 1, 2).c = 4; tile(B, 2, 2).c = 0;
    ok(Bd.trySwap(B, 1, 2, 2, 2), 'matching the trowel');
    const f1 = evs(B, 'fire').find((e) => e.s === 'h');
    ok(f1 && f1.cells.length === 6, 'the trowel sweeps the whole row');

    // sunstone with a find clears that colour
    B = board(`
        34534
        3S134
        43143
        31435`);
    const n1 = B.cells.filter((c) => c.t && c.t.k === 'gem' && c.t.c === 1).length;
    ok(Bd.trySwap(B, 1, 1, 1, 2), 'a sunstone swaps with anything');
    ok(evs(B, 'fire').some((e) => e.s === 'sun' && e.color === 1 && e.cells.length === n1), 'and clears every find of that kind');

    // combos
    const comboBoard = (a, b) => {
        return board(`
            345345
            453453
            34${a}${b}45
            453453
            345345`);
    };
    for (const [a, b, shape] of [['H', 'V', 'cross'], ['B', 'B', 'bigbomb'], ['H', 'B', 'wide'], ['S', 'S', 'nova']]) {
        const X = comboBoard(a, b);
        ok(Bd.trySwap(X, 2, 2, 2, 3), `${a}+${b} swap is a move`);
        ok(evs(X, 'fire').some((e) => e.s === shape), `${a}+${b} makes a ${shape}`);
        ok(!Bd.checkBoard(X), `${a}+${b} leaves a whole board`);
    }
    {
        const X = comboBoard('Q', 'Q');
        Bd.trySwap(X, 2, 2, 2, 3);
        ok(evs(X, 'fly').length >= 3, 'two scarabs send out a flock of three');
        const Y = comboBoard('S', 'H');
        tile(Y, 2, 3).c = 3;
        Bd.trySwap(Y, 2, 2, 2, 3);
        ok(evs(Y, 'convert').length >= 2, 'sunstone + trowel turns a whole colour into trowels');
    }

    // dirt, fossils, boulders, crust
    B = board(`
        34534
        00102
        43543
        35435`);
    B.cells[1 * 5 + 0].soil = 1; B.cells[1 * 5 + 1].soil = 2; B.cells[1 * 5 + 1].fossil = true;
    B.goals = [{ kind: 'soil', n: 2, got: 0 }, { kind: 'fossil', n: 1, got: 0 }];
    Bd.trySwap(B, 1, 2, 1, 3);
    ok(B.cells[5].soil === 0 && B.cells[6].soil === 1, 'a match digs one layer of dirt under each find');
    ok(B.goals[0].got === 1 && B.goals[1].got === 0, 'only fully dug squares count; the fossil stays hidden');
    B = board(`
        3r534
        00102
        43543
        35435`);
    ok(B.cells[1].rock === 1 && !B.cells[1].t, 'a boulder fills its cell');
    Bd.trySwap(B, 1, 2, 1, 3);
    ok(B.cells[1].rock === 0, 'a match beside a boulder cracks it');
    B = board(`
        34534
        0x102
        43543
        35435`);
    tile(B, 1, 1).c = 0;
    ok(Bd.trySwap(B, 1, 1, 0, 1) === false, 'a crusted find cannot be moved');
    Bd.trySwap(B, 1, 2, 1, 3);
    ok(tile(B, 1, 1)?.crust === 0, 'matching it breaks the crust and the find stays');

    // relics
    B = Bd.makeBoard({ rows: ['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo'], colors: [0, 1, 2, 3], moves: 50, goals: [{ kind: 'relic', n: 1 }], relics: { total: 1, max: 1 } }, 5);
    ok(B.cells.some((c) => c.t?.k === 'relic'), 'a relic level starts with a relic on the board');
    const bot = Bt.makeBot({ skill: 1, seed: 3 });
    Bt.playBoard(B, bot, 60);
    ok(B.state === 'won' && B.relic.out === 1, 'bringing the relic to the floor lifts it out and wins');

    // gravity past a boulder
    B = board(`
        34534
        3r534
        34543
        35435`);
    B.cells[1].rock = 3;
    for (let k = 0; k < 20 && B.state === 'play'; k++) {
        const m = Bd.findMoves(B)[0];
        if (!m) break;
        Bd.trySwap(B, ...m[0], ...m[1]);
        ok(!Bd.checkBoard(B), `move ${k}: no gap left under the boulder`);
    }

    // out of moves, more moves
    B = board(`
        34534
        00102
        43543
        35435`, { moves: 1 });
    Bd.trySwap(B, 1, 2, 1, 3);
    ok(B.state === 'lost' && evs(B, 'outofmoves').length === 1, 'the last move ends the dig when goals are open');
    ok(Bd.addMoves(B, 5) && B.state === 'play' && B.moves === 5, 'five more moves carry on');

    // hammer, shuffle
    B = board(`
        34534
        3r534
        43543
        35435`);
    ok(Bd.useHammer(B, 1, 1) && B.cells[6].rock === 0, 'the hammer breaks a boulder');
    const before = B.cells.map((c) => c.t?.id).join();
    Bd.shuffle(B);
    ok(B.cells.map((c) => c.t?.id).join() !== before && !Bd.findGroups(B).length && Bd.findMoves(B, 1).length, 'a shuffle moves finds, leaves no match and a move');

    // winning: treasure rush
    B = board(`
        34534
        00102
        43543
        35435`, { moves: 6, goals: [{ kind: 'color', c: 0, n: 3 }] });
    Bd.trySwap(B, 1, 2, 1, 3);
    ok(B.state === 'won' && evs(B, 'rushstart').length === 1 && B.moves === 0, 'a win turns the moves left into a treasure rush');
}

if (want('fuzz')) {
    section('fuzz');
    let moves = 0, bad = null, specials = 0;
    for (let n = 1; n <= 72 && !bad; n += 1) {
        const spec = Lv.levelSpec(n);
        const B = Bd.makeBoard({ ...spec, moves: 60 }, n * 31337);
        let rs = n;
        const r = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
        for (let k = 0; k < 60 && B.state === 'play'; k++) {
            const mv = Bd.findMoves(B);
            if (!mv.length) { bad = `level ${n}: no move left after ${k}`; break; }
            const m = mv[Math.floor(r() * mv.length)];
            if (!Bd.trySwap(B, ...m[0], ...m[1])) { bad = `level ${n}: a listed move was refused`; break; }
            specials += B.ev.filter((e) => e.type === 'create').length;
            if (k % 5 === 0 && Bd.useHammer(B, Math.floor(r() * B.R), Math.floor(r() * B.C))) moves++;
            B.ev.length = 0;
            const e = Bd.checkBoard(B);
            if (e) { bad = `level ${n} move ${k}: ${e}`; break; }
            for (const g of B.goals) if (g.got > g.n || g.got < 0) bad = `level ${n}: goal count out of range`;
            moves++;
        }
    }
    ok(!bad, bad || `${moves} random moves on 72 levels, board whole after every one`);
    console.log(`  ${moves} moves, ${specials} specials made`);
}

if (want('levels')) {
    section('levels');
    const rewards = new Set();
    for (let n = 1; n <= Lv.STORY_LEVELS + 40; n++) {
        const spec = Lv.levelSpec(n);
        const again = Lv.levelSpec(n);
        if (JSON.stringify(spec) !== JSON.stringify(again)) ok(false, `level ${n} is deterministic`);
        const B = Bd.makeBoard(spec, n);
        if (Bd.checkBoard(B) || !Bd.findMoves(B, 1).length || Bd.findGroups(B).length) ok(false, `level ${n} starts whole, still and with a move`);
        for (const g of spec.goals) if (!(g.n > 0)) ok(false, `level ${n}: goal ${g.kind} has a count`);
        const soil = B.cells.filter((c) => c.soil).length, fos = B.cells.filter((c) => c.fossil).length, rock = B.cells.filter((c) => c.rock).length;
        const crust = B.cells.filter((c) => c.t?.crust).length;
        for (const g of spec.goals) {
            if (g.kind === 'soil' && g.n !== soil) ok(false, `level ${n}: soil goal matches the board`);
            if (g.kind === 'fossil' && g.n !== fos) ok(false, `level ${n}: fossil goal matches the board`);
            if (g.kind === 'rock' && g.n !== rock) ok(false, `level ${n}: boulder goal matches the board`);
            if (g.kind === 'crust' && g.n !== crust) ok(false, `level ${n}: crust goal matches the board`);
            if (g.kind === 'color' && !spec.colors.includes(g.c)) ok(false, `level ${n}: colour goal uses a colour on the board`);
        }
        if (n <= Lv.STORY_LEVELS) {
            ok(spec.moves >= 12 && spec.moves <= 45, `level ${n} has ${spec.moves} moves`);
            ok(spec.stars[1] < spec.stars[2], `level ${n} star scores rise`);
            const r = D.rewardFor(n);
            ok(r && D.ITEM[r], `level ${n} rewards a find`);
            rewards.add(r);
        }
    }
    ok(rewards.size === D.ITEMS.length, `the story's levels hand out all ${D.ITEMS.length} finds once each`);
    for (const d of D.DINOS) ok(D.BONE_PARTS.every((p) => rewards.has(`${d.id}-${p}`)), `every ${d.name} bone is a reward`);
    for (const t of D.TASKS) if (t.needs) {
        const last = Math.max(...D.BONE_PARTS.map((p) => D.ITEMS.findIndex((it) => it.id === `${t.needs}-${p}`) + 1));
        ok(last <= (t.ch + 1) * Lv.PER_CHAPTER, `${t.id}: its bones all come from chapter ${t.ch + 1} or earlier (last at level ${last})`);
    }
    for (let ch = 0; ch < 5; ch++) {
        const cost = D.TASKS.filter((t) => t.ch === ch).reduce((a, t) => a + t.cost, 0);
        ok(cost <= Lv.PER_CHAPTER * 2, `chapter ${ch + 1} tasks cost ${cost} ★ (at most two a level)`);
    }
    for (const id of Object.keys(D.SCENES)) if (!['intro', 'finale'].includes(id)) ok(D.TASK[id], `scene ${id} belongs to a task`);
    for (const t of D.TASKS) ok(D.SCENES[t.id], `task ${t.id} has a scene`);
    for (const [id, lines] of Object.entries(D.SCENES)) for (const [who] of lines) if (!D.PEOPLE[who]) ok(false, `scene ${id}: ${who} is someone`);
    console.log(`  ${Lv.STORY_LEVELS + 40} levels built`);
}

if (want('museum')) {
    section('museum');
    const G = Gm.newGame(5, 'Juniper');
    ok(G.name === 'Juniper' && Gm.cleanName('<b>x</b>') === 'bxb' && Gm.cleanName('') === 'Rowan', 'names are cleaned');
    ok(Gm.maxLevel(G) === 1 && Gm.nextLevel(G) === 1, 'a new game plays level 1');
    ok(!Gm.startDig(G, 2), 'level 2 is locked');
    ok(Gm.openTasks(G).length === 3 && Gm.openTasks(G)[0].id === 'door', 'three tasks are open, starting with the door');
    ok(!Gm.doTask(G, 'door'), 'a task needs stars');
    G.stars = 50;
    ok(!Gm.doTask(G, 'roof'), 'a task further down the list is not open yet');
    ok(Gm.doTask(G, 'door') && G.stars === 49, 'the door costs one star');
    ok(Gm.taskBlock(G, 'open-entrance') !== null, 'the chapter finale waits for the rest');
    ok(Gm.coinRate(G) === 0, 'no takings before the ticket booth');
    for (const id of ['sweep', 'hire-moss', 'roof', 'booth']) Gm.doTask(G, id);
    ok(Gm.hasStaff(G, 'moss') && G.boosters.hammer === 3, 'Moss joins and brings two hammers');
    ok(Gm.coinRate(G) > 0, 'the booth opens the till');
    Gm.step(G, null, 3600 * 10);
    ok(G.till === Gm.tillCap(G), 'the till fills to its cap');
    const c0 = G.coins;
    ok(Gm.collectTill(G) && G.coins === c0 + C.TILL.cap && G.till === 0, 'emptying the till pays');
    ok(Gm.maxLevel(G) === 1, 'tasks alone do not unlock levels');
    G.level = 12;
    ok(Gm.maxLevel(G) === 12 && Gm.nextLevel(G) === null, 'chapter 2 waits for chapter 1’s finale');
    for (const id of ['cases', 'sign', 'open-entrance']) Gm.doTask(G, id);
    ok(Gm.currentChapter(G) === 1 && Gm.nextLevel(G) === 13, 'the finale opens chapter 2');
    ok(G.events.some((e) => e.type === 'chapter' && e.ch === 0), 'and says so');
    G.items.push(...D.ITEMS.slice(0, 12).map((i) => i.id));
    ok(Gm.displayed(G).length === 12, 'finds go on show once their hall is open');
    const a0 = Gm.appeal(G);
    ok(a0 === 12 + C.APPEAL.perHall + 5, `appeal counts finds, halls and Moss (${a0})`);
    G.coins = 1000;
    ok(Gm.buyDecor(G, 'bench') && Gm.appeal(G) === a0 + 3 && !Gm.buyDecor(G, 'bench'), 'a decoration adds appeal once');
    ok(Gm.buyBooster(G, 'hammer') && G.boosters.hammer === 4, 'boosters can be bought');
    // a dig
    const H = Gm.newGame(9);
    Gm.startDig(H, 1);
    ok(H.dig && H.dig.B && H.events.some((e) => e.type === 'digstart'), 'a dig starts');
    const bot = Bt.makeBot({ skill: 1, seed: 2 });
    for (let k = 0; k < 60 && !H.dig.result; k++) { const m = Bt.botMove(H.dig.B, bot); Gm.digSwap(H, ...m[0], ...m[1]); }
    const won = H.events.find((e) => e.type === 'digwon');
    ok(won && won.stars >= 1 && H.stars === won.stars && H.level === 1, 'winning level 1 pays its stars');
    ok(won && won.item === D.ITEMS[0].id && Gm.owns(H, won.item), 'and its find');
    ok(H.events.filter((e) => e.type === 'board').length > 0, 'every move hands the view a script');
    Gm.leaveDig(H);
    ok(!H.dig && Gm.nextLevel(H) === 2, 'leaving opens level 2');
    const s0 = H.stars;
    Gm.startDig(H, 1);
    for (let k = 0; k < 60 && !H.dig.result; k++) { const m = Bt.botMove(H.dig.B, bot); Gm.digSwap(H, ...m[0], ...m[1]); }
    ok(H.stars >= s0 + 1 && H.items.length === 1, 'a replay pays at least one star and no second find');
    Gm.leaveDig(H);
    // losing and buying moves
    Gm.startDig(H, 2);
    H.dig.B.moves = 1;
    const m = Bd.findMoves(H.dig.B)[0];
    Gm.digSwap(H, ...m[0], ...m[1]);
    if (H.dig.result && !H.dig.result.won) {
        ok(H.events.some((e) => e.type === 'diglost'), 'running out of moves loses');
        H.coins = 500;
        ok(Gm.buyMoves(H) && H.dig.B.moves === C.BOOSTER_MOVES && H.coins === 440, 'five more moves for 60 coins');
        ok(Gm.extraMovesCost(H) === 120, 'the next five cost more');
    } else ok(true, '(won on the last move)');
    // away
    const A = Gm.newGame(1);
    A.tasks.push('booth', 'cases'); A.items.push('jug', 'lamp');
    Gm.away(A, 3600 * 100);
    ok(A.till > 0 && A.till <= Gm.tillCap(A) && A.events.some((e) => e.type === 'away'), 'time away fills the till, capped');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => {
        const G = Gm.newGame(seed);
        Bt.playGame(G, { skill: 0.7, seed: 4, limit: 6 });
        return G;
    };
    ok(JSON.stringify(Gm.serialize(play(42))) === JSON.stringify(Gm.serialize(play(42))), 'same seed and inputs, same game');
    const G = Gm.newGame(7);
    Gm.startDig(G, 1);
    const b1 = Bt.makeBot({ skill: 0.8, seed: 11 }), b2 = Bt.makeBot({ skill: 0.8, seed: 11 });
    for (let k = 0; k < 4; k++) { const m = Bt.botMove(G.dig.B, b1); Gm.digSwap(G, ...m[0], ...m[1]); Bt.botMove(G.dig.B, b2); }
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    for (let k = 0; k < 6 && !G.dig.result; k++) {
        const m = Bt.botMove(G.dig.B, b1), m2 = Bt.botMove(copy.dig.B, b2);
        Gm.digSwap(G, ...m[0], ...m[1]); Gm.digSwap(copy, ...m2[0], ...m2[1]);
    }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-dig plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('story')) {
    section('story');
    const rows = [];
    for (const skill of [1, 0.5]) {
        for (let s = 1; s <= Math.max(2, Math.round(SEEDS / 3)); s++) {
            const G = Gm.newGame(s * 101);
            const perCh = [0, 0, 0, 0, 0], lossCh = [0, 0, 0, 0, 0];
            const log = Bt.playGame(G, {
                skill, seed: s, limit: 300,
                onDig: (g, n, won) => { const ch = Lv.CHAPTER_OF(n); perCh[ch]++; if (!won) lossCh[ch]++; },
            });
            ok(G.finished, `skill ${skill} seed ${s}: reaches the Grand Reopening (${log.stuck || 'ok'})`);
            ok(G.items.length === D.ITEMS.length && D.DINOS.every((d) => Gm.dinoBuilt(G, d.id)), `skill ${skill} seed ${s}: every find dug up and every dinosaur built`);
            rows.push({ skill, s, digs: log.digs, losses: log.losses, buys: log.moveBuys, perCh, lossCh, coins: G.coins, stars: Object.values(G.best).reduce((a, b) => a + b, 0) });
        }
    }
    console.log('  skill seed  digs  lost  buys  star-rating  coins  digs per chapter (lost)');
    for (const r of rows) console.log(`  ${String(r.skill).padEnd(5)} ${String(r.s).padEnd(5)} ${String(r.digs).padEnd(5)} ${String(r.losses).padEnd(5)} ${String(r.buys).padEnd(5)} ${String(r.stars).padEnd(12)} ${String(r.coins).padEnd(6)} ${r.perCh.map((d, i) => `${d}(${r.lossCh[i]})`).join(' ')}`);
    const avg = (k) => rows.filter((r) => r.skill === k).reduce((a, r) => a + r.losses, 0) / rows.filter((r) => r.skill === k).length;
    ok(avg(1) < avg(0.5), `a better bot loses less (${avg(1).toFixed(1)} vs ${avg(0.5).toFixed(1)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
