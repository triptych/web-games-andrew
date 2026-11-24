/**
 * simtest.mjs — headless checks of Glimmerglade's simulation. No browser.
 *
 *   node game-148/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-148/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-148/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock, and never
 *    import the view, the UI or the audio.
 * 2. rules: pouring (runs, capacity, colour match), blooming, mist, brambles, acorn cups, undo stopping at a bloom,
 *    the sprout, hints, restart, stuck, winning and stars.
 * 3. levels: all 50 levels build, are deterministic, use the colours and twists their chapter promises, and the
 *    solver's own line replays to a win through act() — the same commands a player sends.
 * 4. determinism + saves: a save round trip mid-level plays on identically; an unknown version is rejected.
 * 5. bot: the perfect bot wins every level at or under par; a casual bot (random-ish pours, undo, hints, sprout,
 *    restarts) finishes every level too, and the balance table is printed.
 * 6. free play: SEEDS daily/dream puzzles build and are won.
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
const R = await import('../js/sim/rules.js');
const L = await import('../js/sim/levels.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const T = (s, extra = {}) => ({ s, cap: C.CAP, kind: 'bloom', lock: 0, done: false, ...extra });
/** A game around a hand-built board. */
const board = (tubes, extra = {}) => ({ ...Gm.newGame('level', 0), start: JSON.parse(JSON.stringify(tubes)), tubes, par: 10, ...extra, events: [] });

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
    section('rules');
    // a run moves together, limited by space
    let G = board([T('abbb'), T('b'), T('')]);
    ok(Gm.act(G, { t: 'pour', from: 0, to: 1 }), 'pour onto a matching colour');
    ok(G.tubes[1].s === 'bbbb' && G.tubes[0].s === 'a', 'the whole top run moves (3 wisps)');
    ok(G.tubes[1].done && G.blooms === 1, 'four of a colour blooms');
    ok(G.events.some((e) => e.type === 'bloom' && e.colour === 1), 'and emits a bloom event with the colour');
    ok(!Gm.act(G, { t: 'pour', from: 1, to: 2 }), 'a bloomed blossom is sealed');

    G = board([T('aabb'), T('bb'), T('a')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    ok(G.tubes[1].s === 'bbbb', 'two of the run fit');
    G = board([T('abbb'), T('aab'), T('')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    ok(G.tubes[1].s === 'aabb' && G.tubes[0].s === 'abb', 'only as many as there is room for');

    G = board([T('ab'), T('a'), T('')]);
    ok(!Gm.act(G, { t: 'pour', from: 0, to: 1 }) && G.events.at(-1).why === 'colour', 'no pouring onto a different colour');
    ok(!Gm.act(G, { t: 'pour', from: 2, to: 0 }) && G.events.at(-1).why === 'empty', 'nothing to pour from an empty blossom');
    G = board([T('abab'), T('b'), T('aaab')]);
    ok(!Gm.act(G, { t: 'pour', from: 1, to: 0 }), 'no pouring into a full blossom');
    ok(Gm.act(G, { t: 'pour', from: 0, to: 1 }), 'an empty-topped pour works');

    // mist
    G = board([T('ABb'), T(''), T('')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    ok(G.tubes[0].s === 'Ab', 'the wisp under the poured one is revealed');
    ok(G.events.some((e) => e.type === 'reveal'), 'with a reveal event');
    G = board([T('aAab'), T(''), T('')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    Gm.act(G, { t: 'pour', from: 0, to: 2 });
    ok(G.tubes[2].s === 'a' && G.tubes[0].s === 'aa', 'a run stops at a hidden wisp even of the same colour');
    ok(R.topRun('aAa') === 1 && R.topRun('Aaa') === 2, 'topRun counts visible wisps only');

    // brambles
    G = board([T('aaab'), T('b'), T('a', { lock: 1 }), T('bb')]);
    ok(!Gm.act(G, { t: 'pour', from: 2, to: 0 }) && G.events.at(-1).why === 'locked', 'a bramble blossom can\'t be poured from');
    ok(!Gm.act(G, { t: 'pour', from: 1, to: 2 }), 'or into');
    Gm.act(G, { t: 'pour', from: 0, to: 3 });
    Gm.act(G, { t: 'pour', from: 1, to: 3 });
    ok(G.blooms === 1 && G.events.some((e) => e.type === 'unlock' && e.tube === 2), 'a bloom loosens a one-petal bramble');
    ok(Gm.act(G, { t: 'pour', from: 2, to: 0 }) && G.tubes[0].done, 'then it opens');

    // acorn cups
    G = board([T('abab'), T('', { cap: C.CUP_CAP, kind: 'cup' }), T('aa')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    ok(G.tubes[1].s === 'b', 'a cup holds wisps');
    G = board([T('aa', { cap: C.CUP_CAP, kind: 'cup' }), T('aa', { cap: C.CUP_CAP, kind: 'cup' }), T('')]);
    ok(!Gm.act(G, { t: 'pour', from: 0, to: 1 }), 'a cup holds at most two');
    Gm.act(G, { t: 'pour', from: 0, to: 2 }); Gm.act(G, { t: 'pour', from: 1, to: 2 });
    ok(G.tubes[2].done, 'four from cups bloom in a blossom');
    const cupFull = [{ s: 'aaaa', cap: C.CAP, kind: 'cup', lock: 0, done: false }];
    ok(R.pour([T('a'), { s: 'aaa', cap: C.CAP, kind: 'cup', lock: 0, done: false }], 0, 0, 1)?.bloomed === false && cupFull, 'a cup never blooms');

    // undo
    G = board([T('abab'), T(''), T('')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    Gm.act(G, { t: 'pour', from: 0, to: 2 });
    ok(Gm.act(G, { t: 'undo' }) && G.tubes[0].s === 'aba' && G.moves === 1, 'undo takes back one pour and its move');
    Gm.act(G, { t: 'undo' });
    ok(G.tubes[0].s === 'abab' && G.moves === 0, 'and the one before');
    ok(!Gm.act(G, { t: 'undo' }), 'nothing left to undo');
    G = board([T('abbb'), T('b'), T('a'), T('')]);
    Gm.act(G, { t: 'pour', from: 0, to: 1 });
    ok(!Gm.act(G, { t: 'undo' }), 'a bloom is forever: undo stops there');

    // sprout
    G = board([T('abab'), T('baba')]);
    ok(Gm.act(G, { t: 'sprout' }) && G.tubes.length === 3 && G.tubes[2].s === '', 'a sprout grows an empty blossom');
    ok(!Gm.act(G, { t: 'sprout' }), 'once per level');

    // hint
    G = Gm.newGame('level', 4);
    const h0 = G.hints;
    ok(Gm.act(G, { t: 'hint' }), 'a hint is given');
    const he = G.events.find((e) => e.type === 'hint');
    ok(he && R.canPour(G.tubes, G.blooms, he.from, he.to), 'the hinted pour is legal');
    ok(G.hints === h0 - 1, 'and costs a firefly');
    G.hints = 0;
    ok(!Gm.act(G, { t: 'hint' }), 'no fireflies, no hint');
    G = board([T('ab'), T('ba')]);
    G.hints = 3;
    Gm.act(G, { t: 'hint' });
    ok(G.events.some((e) => e.type === 'hint' && e.from === -1) && G.hints === 3, 'a lost position says so and costs nothing');

    // stuck
    G = board([T('aab'), T('bbab'), T('a')]);
    Gm.act(G, { t: 'pour', from: 2, to: 0 });
    ok(!G.events.some((e) => e.type === 'stuck'), 'not stuck while a move remains');
    G = board([T('ab'), T('abab'), T('aab')]);
    Gm.act(G, { t: 'pour', from: 0, to: 2 });
    ok(G.events.some((e) => e.type === 'stuck'), 'no legal pours left is a stuck event');

    // restart
    G = Gm.newGame('level', 3);
    const start = JSON.stringify(G.tubes);
    const m = R.legalMoves(G.tubes, G.blooms)[0];
    Gm.act(G, { t: 'pour', from: m[0], to: m[1] });
    Gm.act(G, { t: 'restart' });
    ok(JSON.stringify(G.tubes) === start && G.moves === 0, 'restart puts the level back');

    // win + stars
    G = board([T('aaab'), T('bbba'), T('')], { par: 4 });
    Gm.act(G, { t: 'pour', from: 0, to: 2 }); Gm.act(G, { t: 'pour', from: 1, to: 0 }); Gm.act(G, { t: 'pour', from: 2, to: 1 });
    ok(G.won && G.events.some((e) => e.type === 'win'), 'clearing every blossom wins');
    ok(G.stars === 3, 'at or under par is three stars');
    ok(!Gm.act(G, { t: 'undo' }), 'nothing happens after a win');
    const S = (moves, par, sprout = false) => Gm.starsFor({ moves, par, sprout });
    ok(S(10, 10) === 3 && S(15, 10) === 2 && S(16, 10) === 2 && S(17, 10) === 1, 'stars: par → 3, up to ⌈1.35·par⌉+2 → 2, else 1');
    ok(S(5, 10, true) === 2, 'a sprout caps the stars at two');
}

if (want('levels')) {
    section('levels');
    const used = new Set();
    let total = 0;
    for (let n = 0; n < C.TOTAL_LEVELS; n++) {
        const G = Gm.newGame('level', n);
        const again = Gm.newGame('level', n);
        ok(JSON.stringify(G.tubes) === JSON.stringify(again.tubes), `level ${n + 1} is deterministic`);
        const letters = G.tubes.map((t) => t.s.toLowerCase()).join('');
        const counts = {};
        for (const ch of letters) counts[ch] = (counts[ch] || 0) + 1;
        ok(Object.keys(counts).length === G.colours && Object.values(counts).every((c) => c === C.CAP), `level ${n + 1}: ${G.colours} colours, four of each`);
        ok(G.tubes.every((t) => !t.s.length || !R.isHidden(t.s[t.s.length - 1])), `level ${n + 1}: every top wisp is visible`);
        ok(!G.tubes.some((t) => t.s.length === C.CAP && t.s === t.s[0].repeat(C.CAP)), `level ${n + 1}: nothing starts bloomed`);
        const sp = L.levelSpec(n);
        const hidden = G.tubes.some((t) => [...t.s].some(R.isHidden));
        const locked = G.tubes.some((t) => t.lock > 0);
        const cups = G.tubes.some((t) => t.kind === 'cup');
        ok(hidden === sp.mist > 0, `level ${n + 1}: mist ${sp.mist ? 'present' : 'absent'} as its chapter says`);
        ok(locked === sp.locks.length > 0 && cups === sp.cups > 0, `level ${n + 1}: brambles and cups as its chapter says`);
        if (sp.ch === 0) ok(!hidden && !locked && !cups, `level ${n + 1}: the meadow is plain sorting`);
        // replay the proof through act()
        const P = L.buildPuzzle(sp);
        for (const [f, t] of P.solution) Gm.act(G, { t: 'pour', from: f, to: t });
        ok(G.won && G.moves === G.par, `level ${n + 1}: the proof line wins in par (${G.par}) through act()`);
        for (let c = 0; c < G.colours; c++) used.add(c);
        total += G.par;
    }
    ok(used.size === C.WISPS.length, 'all nine wisps appear somewhere');
    const firsts = [];
    for (let n = 0; n < C.TOTAL_LEVELS; n++) if (!n || L.levelSpec(n).colours > L.levelSpec(n - 1).colours) firsts.push(n);
    ok(L.levelSpec(0).colours === 3 && L.levelSpec(C.TOTAL_LEVELS - 1).colours === 9, 'the campaign runs from 3 colours to 9');
    console.log(`  ${C.TOTAL_LEVELS} levels · average par ${(total / C.TOTAL_LEVELS).toFixed(1)}`);
}

if (want('determinism')) {
    section('determinism + saves');
    const G = Gm.newGame('level', 27);
    const b1 = Bt.makeBot({ skill: 'casual', seed: 5 });
    for (let i = 0; i < 6; i++) Gm.act(G, Bt.botCommand(G, b1));
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(JSON.stringify(Gm.serialize(copy)) === JSON.stringify(Gm.serialize(G)), 'a save round trip is exact');
    const p1 = Bt.makeBot({ skill: 'casual', seed: 9 }), p2 = Bt.makeBot({ skill: 'casual', seed: 9 });
    for (let i = 0; i < 60 && !G.won; i++) { Gm.act(G, Bt.botCommand(G, p1)); Gm.act(copy, Bt.botCommand(copy, p2)); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'and plays on identically');
    ok(copy.hist.length === G.hist.length, 'undo history survives a save');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1 }); } catch { threw = true; }
    ok(threw, 'a save without tubes is rejected');
}

function playOut(G, bot, limit = 3000) {
    let cmds = 0;
    while (!G.won && cmds < limit) {
        let cmd = Bt.botCommand(G, bot);
        G.events.length = 0;
        Gm.act(G, cmd);
        if (cmd.t === 'hint') { const f = Bt.followHint(G); G.events.length = 0; if (f) Gm.act(G, f); }
        cmds++;
        if (G.tubes.some((t) => t.s.length > t.cap)) return { bad: 'overfull blossom', cmds };
    }
    return { cmds };
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let n = 0; n < C.TOTAL_LEVELS; n++) {
        const G = Gm.newGame('level', n);
        const r = playOut(G, Bt.makeBot({ skill: 'perfect' }));
        ok(G.won && G.moves <= G.par && G.stars === 3, `perfect bot: level ${n + 1} in ${G.moves}/${G.par}`);
        const cas = [];
        for (let s = 1; s <= 3; s++) {
            const H = Gm.newGame('level', n);
            const rr = playOut(H, Bt.makeBot({ skill: 'casual', seed: s * 31 + n }));
            ok(H.won && !rr.bad, `casual bot ${s}: level ${n + 1} ${rr.bad || (H.won ? 'won' : 'not won')}`);
            cas.push({ moves: H.moves, stars: H.stars, hints: 3 - H.hints, sprout: H.sprout });
        }
        rows.push({ n: n + 1, par: G.par, perfect: G.moves, casual: Math.round(cas.reduce((a, c) => a + c.moves, 0) / cas.length), stars: (cas.reduce((a, c) => a + c.stars, 0) / cas.length).toFixed(1), hints: (cas.reduce((a, c) => a + c.hints, 0) / cas.length).toFixed(1), r: r.cmds });
    }
    if (process.env.VERBOSE || process.env.TABLE) console.table(rows);
    const avg = (k) => (rows.reduce((a, r) => a + +r[k], 0) / rows.length).toFixed(1);
    const byCh = [0, 1, 2, 3, 4].map((c) => (rows.slice(c * 10, c * 10 + 10).reduce((a, r) => a + +r.stars, 0) / 10).toFixed(2));
    console.log(`  casual bot: average ${avg('casual')} moves for par ${avg('par')}, ${avg('stars')} stars, ${avg('hints')} hints · stars by chapter ${byCh.join(' ')}`);
    ok(+byCh[0] >= +byCh[4], 'the meadow is no harder than the canopy for a casual player');
}

if (want('free')) {
    section('free play');
    for (let s = 1; s <= SEEDS; s++) {
        const seed = s * 2654435761 >>> 0;
        const G = Gm.newGame(s % 2 ? 'daily' : 'dream', seed);
        const r = playOut(G, Bt.makeBot({ skill: 'perfect' }));
        ok(G.won && !r.bad, `${G.kind} ${seed}: ${G.colours} colours, won in ${G.moves}`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
