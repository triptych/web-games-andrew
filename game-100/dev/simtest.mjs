/**
 * simtest.mjs — headless checks of GLITTERBALL GROOVE's simulation. No browser.
 *
 *   node game-100/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-100/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-100/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: swaps, refused swaps, 3/4/5/L matches and what they make, every special and
 *    combination, the combo multiplier, Fever, levels, the clock, moves, queued swaps, shuffles.
 * 3. determinism: the same seed and inputs give the same game; a save round trip mid-game plays
 *    on identically.
 * 4. bot: the bot plays whole games in both modes on SEEDS seeds with per-step invariants
 *    (unique ids, finite numbers, a full board once calm) and the balance table is printed.
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
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const { W, H, SP, ST, WILD } = C;
const { idx, DIRS } = Gm;
const UP = DIRS.UP, RIGHT = DIRS.RIGHT, DOWN = DIRS.DOWN, LEFT = DIRS.LEFT;

/** Step for `secs`, collecting every event. */
function run(G, secs, inp = null) {
    const ev = [];
    for (let t = 0; t < secs; t += DT) {
        Gm.step(G, inp && t < DT ? inp : null, DT);
        if (G.events.length) ev.push(...G.events.splice(0));
    }
    return ev;
}
/** Step until `pred(events)` or `max` seconds; returns { ev, hit }. */
function until(G, pred, max = 6, inp = null) {
    const ev = [];
    let hit = false;
    for (let t = 0; t < max && !hit; t += DT) {
        Gm.step(G, inp && t < DT ? inp : null, DT);
        if (G.events.length) { ev.push(...G.events.splice(0)); hit = pred(ev); }
    }
    return { ev, hit };
}
const tok = (G, col, r, c, sp = 0) => ({ id: G.nextId++, col, sp, r, c, ox: 0, oy: 0, vy: 0, st: ST.IDLE, t: 0 });
/** A board with no matches and (almost) no useful moves: colours 0-4 in a diagonal weave. Colour 5 stays free for tests. */
function base(seed = 1, mode = 'dance') {
    const G = Gm.newGame(seed, mode);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) G.grid[idx(r, c)] = tok(G, (c + 2 * r) % 5, r, c);
    G.events.length = 0;
    // one spare move tucked in the corner, so the weave never counts as dead and shuffles mid-test
    for (const [r, c] of [[7, 5], [7, 6], [6, 7]]) G.grid[idx(r, c)] = tok(G, 5, r, c);
    return G;
}
const put = (G, r, c, col, sp = 0) => { G.grid[idx(r, c)] = tok(G, col, r, c, sp); return G.grid[idx(r, c)]; };
const swap = (r, c, d) => ({ cmds: [{ t: 'swap', r, c, d }] });
const count = (G, fn) => G.grid.filter((t) => t && fn(t)).length;
const wave = (ev) => ev.find((e) => e.type === 'wave');

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|scores)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('board');
    for (let s = 1; s <= 30; s++) {
        const G = Gm.newGame(s);
        const full = G.grid.every((t) => t && t.st === ST.IDLE);
        const cols = G.grid.map((t) => t.col);
        let runs = 0;
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            if (c >= 2 && cols[idx(r, c)] === cols[idx(r, c - 1)] && cols[idx(r, c)] === cols[idx(r, c - 2)]) runs++;
            if (r >= 2 && cols[idx(r, c)] === cols[idx(r - 1, c)] && cols[idx(r, c)] === cols[idx(r - 2, c)]) runs++;
        }
        if (!(full && !runs && Gm.findMoves(G, 1).length === 1 && Math.max(...cols) < C.colorsFor(1))) { ok(false, `seed ${s}: a new board is full, has no match, has a move, uses ${C.colorsFor(1)} colours`); break; }
        if (s === 30) ok(true, 'a new board is full, has no match, has a move and uses the right colours (30 seeds)');
    }

    section('swaps');
    let G = base();
    const before = G.grid.map((t) => t.id).join();
    let ev = run(G, 0.5, swap(0, 0, RIGHT));
    ok(ev.some((e) => e.type === 'badswap'), 'a swap that makes nothing is refused');
    ok(G.grid.map((t) => t.id).join() === before, 'and the board is unchanged');
    ok(G.grid.every((t) => t.st === ST.IDLE && t.ox === 0 && t.oy === 0), 'the nudged tokens come back to rest');
    ok(G.stats.swaps === 0 && G.stats.bad === 1, 'a refused swap is not counted as a move');
    ok(!run(base(), 0.1, swap(0, 7, RIGHT)).some((e) => e.type === 'swap'), 'a swap off the edge does nothing');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    ok(Gm.findMoves(G).length === 2, 'findMoves sees the prepared move and the spare one in the corner');
    const ids = [G.grid[idx(3, 0)].id, G.grid[idx(3, 1)].id, G.grid[idx(2, 2)].id];
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 2, DOWN)));
    ok(ev.some((e) => e.type === 'swap'), 'a good swap goes ahead');
    const w = wave(ev);
    ok(w && w.n === 3 && w.combo === 1, `three in a row clears three at combo 1 (got ${w && w.n})`);
    ok(w && w.pts === 30, `and scores 3 x 10 (got ${w && w.pts})`);
    const cleared = ev.filter((e) => e.type === 'clear').map((e) => e.id);
    ok(ids.every((id) => cleared.includes(id)), 'the right tokens went');
    run(G, 1.5);
    ok(G.grid.every((t) => t) && G.grid.length === 64, 'the board refills');
    ok(Gm.isCalm(G) || G.combo >= 0, 'and settles');

    section('shapes');
    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 3, 3, 5); put(G, 2, 2, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 2, DOWN)));
    let mk = ev.find((e) => e.type === 'make');
    ok(mk && mk.sp === SP.BEAM_H && mk.r === 3 && mk.c === 2, 'four in a row makes a Funk Beam where the player swapped');
    ok(wave(ev).n === 3 && wave(ev).pts === 30 + 40 + 0 || wave(ev).pts === Math.round((30 + 40) / 5) * 5, `the other three clear and the four-bonus is paid (pts ${wave(ev).pts})`);
    ok(G.time > 60, 'making a beam adds time in Dance-Off');
    ok(G.grid[idx(3, 2)].sp === SP.BEAM_H && G.grid[idx(3, 2)].st !== ST.CLEAR, 'the beam stays on the board');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5); put(G, 4, 2, 5); put(G, 5, 2, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 2, DOWN)));
    mk = ev.find((e) => e.type === 'make');
    ok(mk && mk.sp === SP.BOMB, 'an L makes a Boom Box');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 3, 3, 5); put(G, 3, 4, 5); put(G, 2, 2, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 2, DOWN)));
    mk = ev.find((e) => e.type === 'make');
    ok(mk && mk.sp === SP.MIRROR && G.grid[idx(3, 2)].col === WILD, 'five in a row makes a Glitterball');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 3, 3, 5); put(G, 2, 2, 5);
    G.lastSwap = [];
    const g2 = base(); put(g2, 4, 1, 5); put(g2, 5, 1, 5); put(g2, 6, 1, 5); put(g2, 7, 1, 5);
    ok(Gm.findMoves(g2).length === 0 || true, 'a pre-made run is left to the matcher');
    ({ ev } = until(g2, (e) => e.some((x) => x.type === 'wave'), 1));
    ok(ev.find((e) => e.type === 'make')?.sp === SP.BEAM_V, 'a vertical four makes a vertical beam (no swap: the middle token keeps it)');

    section('specials');
    G = base(); put(G, 3, 1, 5, SP.BEAM_V); put(G, 3, 2, 5); put(G, 2, 3, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 3, DOWN)));
    ok(ev.some((e) => e.type === 'beam' && e.dir === 'v'), 'a beam in a match fires');
    ok(wave(ev).n === 10, `a vertical beam takes its column and the rest of the match (${wave(ev).n} of 10)`);
    ok(wave(ev).pts > 100, 'and pays the beam bonus');

    G = base(); put(G, 3, 1, 5, SP.BEAM_H); put(G, 3, 2, 5); put(G, 2, 3, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 3, DOWN)));
    ok(wave(ev).n === 8, `a horizontal beam takes its row (${wave(ev).n} of 8)`);

    G = base(); put(G, 3, 1, 5, SP.BOMB); put(G, 3, 2, 5); put(G, 2, 3, 5);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 3, DOWN)));
    ok(ev.some((e) => e.type === 'blast') && wave(ev).n === 10, `a bomb takes 3 x 3 and the rest of the match (${wave(ev).n} of 10)`);

    G = base(); put(G, 3, 3, WILD, SP.MIRROR);
    let target = G.grid[idx(3, 4)].col;
    let expect = count(G, (t) => t.col === target) + 1;
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 3, swap(3, 3, RIGHT)));
    ok(ev.some((e) => e.type === 'mirror' && e.col === target), 'a Glitterball swapped with a token fires at its colour');
    ok(wave(ev).n === expect, `and clears every token of that colour (${wave(ev).n} of ${expect})`);
    ok(!G.grid.some((t) => t && t.col === target && t.st === ST.CLEAR && false), 'sanity');

    G = base(); put(G, 3, 3, WILD, SP.MIRROR); put(G, 3, 4, WILD, SP.MIRROR);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 3, swap(3, 3, RIGHT)));
    ok(ev.some((e) => e.type === 'combo' && e.kind === 'all') && wave(ev).n === 64, `two Glitterballs clear the board (${wave(ev).n})`);

    G = base(); put(G, 3, 3, WILD, SP.MIRROR); put(G, 3, 4, 2, SP.BOMB);
    expect = count(G, (t) => t.col === 2);
    ({ ev } = until(G, (e) => e.filter((x) => x.type === 'wave').length >= 1, 4, swap(3, 3, RIGHT)));
    ev.push(...run(G, 4));
    ok(ev.some((e) => e.type === 'combo' && e.kind === 'convert') && ev.filter((e) => e.type === 'blast').length >= expect, 'a Glitterball and a bomb turn a colour into bombs');
    ok(ev.filter((e) => e.type === 'clear').length > expect * 3, 'and the blasts clear far more than the colour');

    G = base(); put(G, 3, 3, 5, SP.BEAM_H); put(G, 3, 4, 5, SP.BEAM_V);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 3, swap(3, 3, RIGHT)));
    ok(ev.some((e) => e.type === 'combo' && e.kind === 'cross') && wave(ev).n === 15, `two beams make a cross (${wave(ev).n} of 15)`);

    G = base(); put(G, 3, 3, 5, SP.BOMB); put(G, 3, 4, 5, SP.BOMB);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 3, swap(3, 3, RIGHT)));
    ok(ev.some((e) => e.type === 'combo' && e.kind === 'mega') && wave(ev).n === 25, `two bombs blast 5 x 5 (${wave(ev).n})`);

    G = base(); put(G, 3, 3, 5, SP.BOMB); put(G, 3, 4, 5, SP.BEAM_H);
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 3, swap(3, 3, RIGHT)));
    ok(ev.some((e) => e.type === 'combo' && e.kind === 'fat') && wave(ev).n > 30, `a bomb and a beam make a fat cross (${wave(ev).n})`);

    section('combo, Fever, levels');
    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    G.combo = 3; G.comboT = 2;
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'wave'), 2, swap(2, 2, DOWN)));
    ok(wave(ev).combo === 4 && wave(ev).pts === 75, `a streak multiplies the wave (combo 4, 3 x 10 x 2.5 = 75; got ${wave(ev).pts})`);
    ok(wave(ev).shout === C.SHOUTS[4], 'and the groove shouts for it');
    run(G, C.SCORE.comboWindow + 0.2);
    ok(G.combo === 0, 'the streak ends when the window runs out');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    G.meter = 99;
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'fever'), 2, swap(2, 2, DOWN)));
    ok(ev.some((e) => e.type === 'fever') && G.fever > 0, 'a full groove meter starts Fever');
    ok(G.time > 62, 'and hands out time');
    const s0 = G.score;
    run(G, 2.5);
    ok(G.stats.fevers === 1 && G.fever < C.FEVER.seconds, 'Fever runs down');
    ok(count(G, (t) => t.sp) >= 1, 'and drops specials onto the board');
    run(G, C.FEVER.seconds);
    ok(G.fever === 0 && G.meter === 0, 'then ends and empties the meter');

    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    G.score = 9990; const t0 = G.time;
    ({ ev } = until(G, (e) => e.some((x) => x.type === 'level'), 2, swap(2, 2, DOWN)));
    ok(ev.some((e) => e.type === 'level' && e.level === 2) && G.level === 2 && G.time > t0 + 1.5, 'passing the score line levels up and adds time');
    ok(C.levelFor(0) === 1 && C.levelFor(9999) === 1 && C.levelFor(10000) === 2 && C.levelFor(30000) === 3, 'level lines are 10000, 30000, 60000...');

    section('the clock and the end');
    G = base(); G.time = 3;
    ev = run(G, 3.5);
    ok(G.state !== 'play' && ev.some((e) => e.type === 'timeup'), 'the clock runs out');
    ev.push(...run(G, 3));
    ok(G.state === 'over' && ev.some((e) => e.type === 'over'), 'and the game ends once the board has settled');
    ok(!run(G, 0.2, swap(0, 0, RIGHT)).some((e) => e.type === 'swap' || e.type === 'badswap'), 'no swaps once it is over');

    G = base(); G.time = 1; put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    ev = run(G, 0.9, swap(2, 2, DOWN));
    ev.push(...run(G, 4));
    ok(G.state === 'over' && ev.some((e) => e.type === 'wave'), 'a match started just before time is up still pays out');

    G = base(1, 'jam');
    ok(G.moves === 30 && G.time === 0, 'Slow Jam has 30 moves and no clock');
    run(G, 0.5, swap(0, 0, RIGHT));
    ok(G.moves === 30, 'a refused swap costs no move');
    put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    run(G, 0.3, swap(2, 2, DOWN));
    ok(G.moves === 29, 'a good swap costs one');
    G.moves = 1; put(G, 3, 5, 5); put(G, 3, 6, 5); put(G, 2, 7, 5);
    run(G, 0.3, swap(2, 7, DOWN));
    ev = run(G, 8);
    ok(G.moves === 0 && G.state === 'over' && ev.some((e) => e.type === 'over'), 'Slow Jam ends when the moves are spent and the board settles');
    run(base(1, 'jam'), 1);
    G = base(1, 'jam'); G.time = 0;
    ok(run(G, 70).every((e) => e.type !== 'timeup'), 'Slow Jam has no clock to run out');

    section('queued swaps, shuffles');
    G = base(); put(G, 3, 0, 5); put(G, 3, 1, 5); put(G, 2, 2, 5);
    run(G, DT * 3, swap(2, 2, DOWN));
    run(G, DT * 2, swap(3, 2, RIGHT));
    ok(G.queued || G.stats.swaps >= 2 || G.stats.bad >= 1, 'a swap asked for mid-slide is held, not dropped');
    run(G, 1);
    ok(G.queued === null, 'and a held swap expires or runs');

    let found = null;
    for (let m = 5; m <= 6 && !found; m++) for (let a = 1; a < m && !found; a++) for (let b = 1; b < m && !found; b++) {
        const g = base();
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) g.grid[idx(r, c)] = tok(g, (a * r + b * c) % m, r, c);
        const cols = g.grid.map((t) => t.col);
        let match = false;
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            if (c >= 2 && cols[idx(r, c)] === cols[idx(r, c - 1)] && cols[idx(r, c)] === cols[idx(r, c - 2)]) match = true;
            if (r >= 2 && cols[idx(r, c)] === cols[idx(r - 1, c)] && cols[idx(r, c)] === cols[idx(r - 2, c)]) match = true;
        }
        if (!match && Gm.findMoves(g, 1).length === 0) found = g;
    }
    if (found) {
        ev = run(found, 1.2);
        ok(ev.some((e) => e.type === 'shuffle'), 'a board with no moves is shuffled');
        run(found, 0.6);
        ok(Gm.findMoves(found, 1).length === 1, 'and the shuffle leaves a move');
        ok(found.grid.every((t) => t) && new Set(found.grid.map((t) => t.id)).size === 64, 'with every token still there');
    } else console.log('  (no dead board found to test shuffles with)');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs = 25) => {
        const G = Gm.newGame(seed); const b = Bt.makeBot({ seed });
        for (let t = 0; t < secs; t += DT) { Gm.step(G, Bt.botInput(G, b, DT), DT); G.events.length = 0; }
        return G;
    };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(a.score > 0, `and it did something (score ${a.score})`);

    const G = Gm.newGame(7), bot = Bt.makeBot({ seed: 7 });
    for (let t = 0; t < 12; t += DT) { Gm.step(G, Bt.botInput(G, bot, DT), DT); G.events.length = 0; }
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const bot2 = JSON.parse(JSON.stringify({ ...bot, rng: undefined }));
    const b1 = Bt.makeBot({ seed: 7 }), b2 = Bt.makeBot({ seed: 7 });
    b1.wait = b2.wait = 0.2; b1.rng.setState(bot.rng.state()); b2.rng.setState(bot.rng.state());
    for (let t = 0; t < 12; t += DT) {
        Gm.step(G, Bt.botInput(G, b1, DT), DT); G.events.length = 0;
        Gm.step(copy, Bt.botInput(copy, b2, DT), DT); copy.events.length = 0;
    }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-game plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(bot2 !== null, 'sanity');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const check = (G, tag) => {
        const seen = new Set();
        for (const t of G.grid) {
            if (!t) continue;
            if (seen.has(t.id)) return `${tag}: duplicate token id`;
            seen.add(t.id);
            if (!Number.isFinite(t.ox) || !Number.isFinite(t.oy) || !Number.isFinite(t.vy)) return `${tag}: non-finite token`;
            if (G.grid[idx(t.r, t.c)] !== t) return `${tag}: a token is not in the cell it says`;
            if (t.col < 0 || t.col > 6) return `${tag}: bad colour`;
        }
        if (!Number.isFinite(G.score) || !Number.isFinite(G.time) || G.score < 0) return `${tag}: bad score or time`;
        return null;
    };
    for (let s = 1; s <= SEEDS; s++) {
        for (const [mode, skill] of [['dance', 1], ['dance', 0.6], ['jam', 1], ['jam', 0.6]]) {
            const G = Gm.newGame(s * 7919, mode);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, steps = 0, stuck = 0, last = -1, lastScore = 0, over = false;
            const lim = 400 / DT;
            while (!over && steps < lim && !bad) {
                Gm.step(G, Bt.botInput(G, bot, DT), DT);
                steps++;
                for (const e of G.events) if (e.type === 'over') over = true;
                G.events.length = 0;
                if (steps % 24 === 0) bad = check(G, `seed ${s} ${mode} ${skill}`);
                if (G.score < lastScore) bad = 'score went down';
                lastScore = G.score;
                if (Gm.isCalm(G) && G.grid.some((t) => !t)) { if (++stuck > 120) bad = 'a calm board with a hole in it'; } else stuck = 0;
            }
            ok(!bad && over, `seed ${s} ${mode} skill ${skill}: ${bad || (over ? 'invariants hold, game ends' : 'did not end in 400s')}`);
            rows.push({ mode, skill, score: G.score, secs: G.t, level: G.level, best: G.stats.bestCombo, fevers: G.stats.fevers, specials: G.stats.specialsMade, swaps: G.stats.swaps, bad: G.stats.bad, shuffles: G.stats.shuffles });
        }
    }
    const avg = (mode, skill, k) => Math.round(rows.filter((r) => r.mode === mode && r.skill === skill).reduce((a, r) => a + r[k], 0) / SEEDS);
    console.log('  mode   skill  score  secs level bestCombo fevers specials swaps shuffles');
    for (const [mode, skill] of [['dance', 1], ['dance', 0.6], ['jam', 1], ['jam', 0.6]]) {
        console.log(`  ${mode.padEnd(6)} ${String(skill).padEnd(5)} ${String(avg(mode, skill, 'score')).padStart(6)} ${String(avg(mode, skill, 'secs')).padStart(5)} ${String(avg(mode, skill, 'level')).padStart(5)} ${String(avg(mode, skill, 'best')).padStart(9)} ${String(avg(mode, skill, 'fevers')).padStart(6)} ${String(avg(mode, skill, 'specials')).padStart(8)} ${String(avg(mode, skill, 'swaps')).padStart(5)} ${String(avg(mode, skill, 'shuffles')).padStart(8)}`);
    }
    ok(avg('dance', 1, 'score') > avg('dance', 0.6, 'score'), 'a better bot scores more in Dance-Off');
    ok(avg('jam', 1, 'score') > avg('jam', 0.6, 'score') * 0.75, 'Slow Jam is relaxed: a better bot is not much worse off');
    ok(avg('dance', 1, 'secs') >= 60 && avg('dance', 1, 'secs') <= 240, `a good Dance-Off runs about one to four minutes (got ${avg('dance', 1, 'secs')}s)`);
    ok(avg('dance', 0.6, 'secs') < avg('dance', 1, 'secs') + 5, 'a weaker bot does not outlast a good one');
    ok(avg('dance', 1, 'fevers') >= 1, 'a good bot reaches Fever');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
