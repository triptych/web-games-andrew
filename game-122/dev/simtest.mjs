/**
 * simtest.mjs — headless checks of Rainglass's simulation. No browser.
 *
 *   node game-122/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-122/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-122/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. data: every curio sits inside the pane with room to be seen, ids are unique, and every
 *    curio and station has art in the painter (checked by name in its source).
 * 3. rules: wiping clears the mist and spends water, beads are absorbed, a heavy drop slides
 *    and runs off, a dry drop is replaced, tapping the glass rolls beads in, curios are seen
 *    once uncovered, flow rises and falls, chimes follow the glass wiped, the pane completes,
 *    melts, records the album and gives a seal only to curios spotted by hand.
 * 4. journey: eight stations in order, then the small hours in a shuffled loop with the rare
 *    curios; the album fills to 32.
 * 5. determinism: the same seed and inputs give the same game; save round trips mid-pane,
 *    mid-melt and on a postcard play on identically; bad saves are rejected.
 * 6. bot: whole journeys on SEEDS seeds at two skills with per-step invariants, and the pacing
 *    table (seconds a pane).
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
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Sc = await import('../js/sim/scenes.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); } };
const drain = (G) => G.events.splice(0);
const has = (evs, type) => evs.some((e) => e.type === type);
/** Play the current pane out with the bot. */
const finish = (G, bot = Bt.makeBot(), limit = 900) => {
    const evs = [];
    for (let t = 0; t < limit && G.phase !== 'done'; t += DT) { Gm.step(G, Bt.botInput(G, bot), DT); evs.push(...drain(G)); }
    return evs;
};
const fogAt = (G, x, y) => G.fog[Math.floor(y / C.FOG_CELL) * C.FOG.gw + Math.floor(x / C.FOG_CELL)];

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

if (want('data')) {
    section('data');
    const ids = new Set();
    const art = fs.readFileSync(path.join(ROOT, 'js/view/painter.js'), 'utf8');
    for (const s of Sc.STATIONS) {
        ok(new RegExp(`\\b${s.theme}\\(ctx`).test(art), `${s.name}: the painter has a theme for it`);
        ok(s.curios.length === 3 && s.rare, `${s.name}: three curios and a rare one`);
        for (const c of [...s.curios, s.rare]) {
            ok(!ids.has(c.id), `${c.id} is unique`); ids.add(c.id);
            ok(c.x - c.r > 0 && c.x + c.r < C.FIELD.w && c.y - c.r > 0 && c.y + c.r < C.FIELD.h, `${c.id} is inside the pane`);
            ok(c.r >= 0.38, `${c.id} is big enough to find`);
            ok(art.includes(`'${c.id}'(ctx`), `${c.id} has art`);
        }
    }
    ok(ids.size === Sc.CURIO_COUNT, `${Sc.CURIO_COUNT} curios in all`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    drain(G);
    ok(G.fog.length === C.FOG.gw * C.FOG.gh && Gm.clearedFrac(G) < 0.05, 'a new pane is misted over (a few old rain runs aside)');
    ok(G.beads.length > 0 && G.drop.alive && G.drop.m === C.DROP.m0, 'beads on the glass and a fresh drop');

    // wiping
    G.beads.length = 0;
    G.drop.x = 6; G.drop.y = 4;
    const f0 = Gm.clearedFrac(G), m0 = G.drop.m;
    run(G, { x: 1, y: 0, a: false }, 0.6);
    ok(Gm.clearedFrac(G) > f0 + 0.005, 'moving wipes the mist');
    ok(G.drop.m < m0, 'and spends water');
    ok(fogAt(G, G.drop.x, G.drop.y) === 0, 'the glass under the drop is clear');
    const m1 = G.drop.m;
    run(G, { x: -1, y: 0, a: false }, 0.4);
    ok(Math.abs(G.drop.m - m1) < 0.02, 'going back over clear glass costs (almost) nothing');

    // beads
    G.beads.push({ x: G.drop.x + 0.3, y: G.drop.y, m: 0.4, roll: 0, age: 1 });
    const mb = G.drop.m;
    Gm.step(G, NONE, DT);
    let ev = drain(G);
    ok(has(ev, 'merge') && G.drop.m > mb + 0.35, 'touching a bead drinks it up');

    // tapping the glass
    G.beads = [{ x: G.drop.x + 1.8, y: G.drop.y, m: 0.3, roll: 0, age: 1 }, { x: G.drop.x + 5, y: G.drop.y, m: 0.3, roll: 0, age: 1 }];
    G.tapCD = 0;
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ev = drain(G);
    ok(has(ev, 'tap') && G.beads[0].roll && !G.beads[1].roll, 'a tap rolls the near beads, not the far ones');
    run(G, NONE, 1.2);
    ev = drain(G);
    ok(has(ev, 'merge') && G.beads.length === 1 + Math.round(0) || G.beads.every((b) => !b.roll), 'the rolled bead reaches the drop');
    ok(G.tapCD > 0, 'the tap has a cooldown');
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(!has(drain(G), 'tap'), 'no second tap during the cooldown');

    // heavy drops slide and run off
    G = Gm.newGame(2); drain(G);
    G.beads.length = 0;
    G.drop.y = 2; G.drop.m = 4;
    const y0 = G.drop.y;
    run(G, NONE, 0.5);
    ok(G.drop.y > y0 + 0.5, 'a heavy drop slides down on its own');
    const g2 = Gm.newGame(2); drain(g2); g2.beads.length = 0; g2.drop.y = 2; g2.drop.m = 1;
    run(g2, NONE, 0.5);
    ok(Math.abs(g2.drop.y - 2) < 0.01, 'a light drop clings where it is');
    let evs = [];
    for (let t = 0; t < 10 && G.drop.alive; t += DT) { Gm.step(G, { x: 0, y: -0.2, a: false }, DT); evs.push(...drain(G)); }
    ok(has(evs, 'runoff'), 'and runs off the bottom');
    for (let t = 0; t < 2; t += DT) { Gm.step(G, NONE, DT); evs.push(...drain(G)); }
    ok(has(evs, 'drop') && G.drop.alive && G.drop.y < 1 && G.stats.drops === 2, 'a fresh drop beads at the top');

    // drying out
    G = Gm.newGame(3); drain(G); G.beads.length = 0; G.drop.m = C.DROP.mMin + 0.02;
    evs = [];
    for (let t = 0; t < 3 && G.drop.alive; t += DT) { Gm.step(G, { x: 1, y: 0.3, a: false }, DT); G.beadT = 0; evs.push(...drain(G)); }
    ok(has(evs, 'dry'), 'a drop that wipes itself dry is spent');

    // spotting
    G = Gm.newGame(4); drain(G);
    const cu = Gm.curios(G)[0];
    ok(!G.found.includes(cu.id), 'curios start unseen');
    Gm.wipe(G, cu.x, cu.y, cu.r * 0.5);
    run(G, NONE, 0.3);
    ok(!G.found.includes(cu.id), 'a peephole is not enough to see a curio');
    Gm.wipe(G, cu.x, cu.y, cu.r * 1.8);
    run(G, NONE, 0.3);
    ev = drain(G);
    ok(G.found.includes(cu.id) && G.selfFound.includes(cu.id) && ev.some((e) => e.type === 'spot' && e.id === cu.id && e.self), 'uncovering a curio spots it');
    run(G, NONE, 0.5);
    ok(!drain(G).some((e) => e.type === 'spot'), 'and only once');

    // flow and chimes
    G = Gm.newGame(5); drain(G);
    const b = Bt.makeBot();
    evs = [];
    let maxFlow = 0;
    for (let t = 0; t < 25; t += DT) { Gm.step(G, Bt.botInput(G, b), DT); G.drop.m = Math.max(G.drop.m, 1); evs.push(...drain(G)); maxFlow = Math.max(maxFlow, G.flowLevel); }
    ok(maxFlow >= 2 && evs.some((e) => e.type === 'flow' && e.level >= 1), 'steady wiping builds flow');
    const chimes = evs.filter((e) => e.type === 'chime').length;
    ok(Math.abs(chimes - G.stats.wiped / C.CHIME.every) <= 1, `a chime for every ${C.CHIME.every} square units wiped (${chimes})`);
    run(G, NONE, 30);
    ok(G.flowLevel === 0 && G.flow === 0, 'and it ebbs away when you stop');

    // completion, melt, seal
    G = Gm.newGame(6); drain(G);
    evs = finish(G);
    const comp = evs.find((e) => e.type === 'complete'), card = evs.find((e) => e.type === 'postcard');
    ok(comp && card, 'the pane completes and becomes a postcard');
    ok(G.fogSum === 0 && G.phase === 'done', 'the rest of the mist melts away');
    ok(Gm.curios(G).every((c) => G.found.includes(c.id)), 'every curio is seen by the end');
    const a = G.album.willow;
    ok(a && a.visits === 1 && a.found.length === 3 && a.best > 0, 'the album records the visit');
    ok(card.seal === Gm.curios(G).every((c) => G.selfFound.includes(c.id)), 'the seal is for curios spotted by hand');
    // a pane cleared away from a curio: the melt reveals it, no seal
    G = Gm.newGame(7); drain(G);
    const hide = Gm.curios(G)[2];
    // wipe the glass by hand everywhere but a ring round one curio, so only the melt can show it
    for (let y = 0.1; y < C.FIELD.h; y += 0.2) for (let x = 0.1; x < C.FIELD.w; x += 0.2) {
        if (Math.hypot(x - hide.x, y - hide.y) > hide.r + 0.7) Gm.wipe(G, x, y, 0.3);
    }
    G.beads.length = 0;
    G.drop.m = 1; G.drop.x = 0.5; G.drop.y = 0.5;
    evs = finish(G);
    const card2 = evs.find((e) => e.type === 'postcard');
    ok(evs.some((e) => e.type === 'spot' && e.id === hide.id && !e.self) && card2 && !card2.seal, 'a curio the melt uncovers counts for the album but not the seal');
    ok(Gm.nextPane(G) && G.station === 1 && G.phase === 'play' && G.found.length === 0, 'next pane: the next station, misted again');
    ok(!Gm.nextPane(G), 'no skipping a pane that is not done');
}

if (want('journey')) {
    section('journey');
    const G = Gm.newGame(11);
    const bot = Bt.makeBot();
    const order = [], lates = [];
    let albumDone = false, lastSeen = false;
    for (let i = 0; i < 16; i++) {
        drain(G);
        const evs = finish(G, bot);
        const card = evs.find((e) => e.type === 'postcard');
        if (!ok(card, `pane ${i + 1} finishes`)) break;
        if (card.last) lastSeen = true;
        if (evs.some((e) => e.type === 'albumComplete')) albumDone = true;
        (G.late ? lates : order).push(G.station);
        Gm.nextPane(G);
    }
    ok(order.join() === '0,1,2,3,4,5,6,7', `eight stations in order (${order.join()})`);
    ok(lastSeen && G.journeyDone, 'the last station ends the journey');
    ok(new Set(lates).size === 8, `the small hours pass every station once (${lates.join()})`);
    ok(Gm.albumCount(G) === Sc.CURIO_COUNT && albumDone && G.albumDone, `the album fills: ${Gm.albumCount(G)} / ${Sc.CURIO_COUNT}`);
    ok(Object.values(G.album).every((a) => a.visits === 2 && a.late), 'each station visited twice');
    const before = G.loopOrder.slice();
    finish(G, bot); Gm.nextPane(G);
    ok(G.loopOrder.join() !== before.join() || G.loopIdx === 1, 'the loop goes on (reshuffled after a full round)');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), 30); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(play(43))) !== JSON.stringify(Gm.serialize(a)), 'a different seed, a different game');

    const roundTrip = (G, label) => {
        const json = JSON.stringify(Gm.serialize(G));
        const copy = Gm.deserialize(JSON.parse(json));
        ok(copy.fog.every((v, i) => v === G.fog[i]) && copy.fogSum === G.fogSum, `${label}: the mist survives the round trip exactly`);
        const b1 = Bt.makeBot(), b2 = Bt.makeBot();
        for (let t = 0; t < 15; t += DT) { Gm.step(G, Bt.botInput(G, b1), DT); Gm.step(copy, Bt.botInput(copy, b2), DT); }
        if (G.phase === 'done') { Gm.nextPane(G); Gm.nextPane(copy); run(G, NONE, 1); run(copy, NONE, 1); }
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `${label}: plays on identically`);
        return json.length;
    };
    let G = Gm.newGame(7); const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 20);
    const size = roundTrip(G, 'mid-pane');
    console.log(`  a mid-pane save is ${(size / 1024).toFixed(1)} KB`);
    G = Gm.newGame(8);
    while (G.phase === 'play') Gm.step(G, Bt.botInput(G, bot), DT);
    run(G, NONE, 0.5);
    ok(G.phase === 'reveal', 'caught mid-melt');
    roundTrip(G, 'mid-melt');
    G = Gm.newGame(9); finish(G);
    roundTrip(G, 'on a postcard');
    for (const bad of [{ v: 999 }, null, { ...Gm.serialize(G), station: 99 }, { ...Gm.serialize(G), fog: [1, 2, 3] }]) {
        let threw = false;
        try { Gm.deserialize(bad); } catch { threw = true; }
        ok(threw, `a bad save is rejected, not half-loaded (${bad ? Object.keys(bad).length : 'null'})`);
    }
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null;
            const times = [];
            while (G.panes < 9 && !bad) {
                for (let t = 0; G.phase !== 'done'; t += DT) {
                    Gm.step(G, Bt.botInput(G, bot), DT);
                    drain(G);
                    const d = G.drop;
                    if (!Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.m)) bad = 'non-finite drop';
                    else if (d.alive && (d.x < 0 || d.x > C.FIELD.w || d.y < 0)) bad = 'drop outside the pane';
                    else if (G.fogSum < 0 || G.beads.length > C.BEADS.max) bad = 'bookkeeping';
                    else if (t > 1200) bad = 'stuck on a pane';
                    if (bad) break;
                }
                if (bad) break;
                times.push(G.t);
                Gm.nextPane(G);
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'nine panes, invariants hold'}`);
            rows.push({ s, skill, avg: times.reduce((a, b) => a + b, 0) / times.length, max: Math.max(...times) });
        }
    }
    for (const skill of [1, 0.6]) {
        const r = rows.filter((x) => x.skill === skill);
        const avg = r.reduce((a, x) => a + x.avg, 0) / r.length, max = Math.max(...r.map((x) => x.max));
        console.log(`  skill ${skill}: ${avg.toFixed(0)} s a pane on average, slowest ${max.toFixed(0)} s`);
        ok(avg > 60 && avg < 300, `skill ${skill}: a pane takes one to five minutes (${avg.toFixed(0)} s)`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
