/**
 * simtest.mjs — headless checks of Sugarplum Drop's simulation. No browser.
 *
 *   node game-078/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-078/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-078/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: aiming and its limits, dropping and the cooldown, a press kept near the end of the
 *    cooldown, which treats are dropped, falling and resting, merging (same kind only, at the
 *    midpoint, scored), cascades into a second merge, chains, two Jingle Bells, the line.
 * 3. physics: a pile of dropped treats comes to rest without overlapping or leaving the jar;
 *    rolling treats turn the right way.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-game
 *    plays on identically; unknown and malformed saves are rejected.
 * 5. bot: the bot plays whole games on SEEDS seeds at two skills, with per-step invariants
 *    (finite numbers, inside the walls, no deep overlap), and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
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
const NONE = { dx: 0, aim: null, drop: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs - 1e-9; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const { JAR, ITEMS } = C;
/** An empty game with nothing pending, for setting up a scene by hand. */
const blank = (seed = 1) => { const G = Gm.newGame(seed); return G; };
const speed = (G) => G.bodies.reduce((m, b) => Math.max(m, Math.hypot(b.vx, b.vy)), 0);
/** The deepest overlap between two treats, leaving out fresh merges, which swell into place. */
const maxOverlap = (G, relative = false) => {
    let m = 0;
    const B = G.bodies;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        if (B[i].age < 0.25 || B[j].age < 0.25) continue;
        const ri = Gm.bodyRadius(B[i]), rj = Gm.bodyRadius(B[j]);
        const o = (ri + rj - Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y)) / (relative ? Math.min(ri, rj) : 1);
        if (o > m) m = o;
    }
    return m;
};

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

if (want('rules')) {
    section('rules');
    let G = blank(1);
    ok(G.bodies.length === 0 && G.score === 0 && !G.over, 'a new game starts with an empty jar');
    ok(G.dropper.tier < 5 && G.next < 5, 'the first treats are small ones');

    // aiming
    const x0 = G.dropper.x;
    run(G, { dx: 1, aim: null, drop: false }, 0.25);
    ok(Math.abs(G.dropper.x - (x0 + C.DROP.speed * 0.25)) < 0.05, 'dx moves the dropper at DROP.speed');
    run(G, { dx: 1, aim: null, drop: false }, 3);
    ok(Math.abs(G.dropper.x - (JAR.w - ITEMS[G.dropper.tier].r)) < 1e-9, 'the dropper stops a treat\'s radius from the wall');
    Gm.step(G, { dx: 0, aim: 2.5, drop: false }, DT);
    ok(G.dropper.x === 2.5, 'aim puts the dropper where the pointer is');
    Gm.step(G, { dx: 0, aim: -40, drop: false }, DT);
    ok(G.dropper.x === ITEMS[G.dropper.tier].r, 'an aim outside the jar is clamped');

    // dropping
    G = blank(2);
    const t0 = G.dropper.tier, n0 = G.next;
    Gm.step(G, { dx: 0, aim: 5, drop: true }, DT);
    ok(G.bodies.length === 1 && G.bodies[0].tier === t0 && G.bodies[0].x === 5, 'a drop puts the held treat in the jar');
    ok(G.dropper.tier === n0 && G.next < 5, 'the next treat moves up, and a new one is rolled');
    ok(G.events.some((e) => e.type === 'drop'), 'and emits a drop event');
    Gm.step(G, { dx: 0, aim: 5, drop: true }, DT);
    ok(G.bodies.length === 1 && !G.dropper.pending, 'a press early in the cooldown does nothing');
    run(G, NONE, C.DROP.cooldown - C.DROP.buffer + 0.02);
    Gm.step(G, { dx: 0, aim: 5, drop: true }, DT);
    ok(G.bodies.length === 1 && G.dropper.pending, 'a press near the end of the cooldown is kept');
    run(G, NONE, C.DROP.buffer);
    ok(G.bodies.length === 2, 'and drops as soon as the cooldown is over');

    // which treats are dropped
    G = blank(3);
    const counts = new Array(ITEMS.length).fill(0);
    for (let i = 0; i < 2000; i++) { counts[G.next]++; G.next = G.rng.weighted(C.DROP.weights); }
    ok(counts.slice(5).every((c) => c === 0) && counts.slice(0, 5).every((c) => c > 0), `only the first five treats are dropped, all of them (${counts.slice(0, 5).join(' ')})`);

    // falling and resting
    G = blank(4);
    Gm.addBody(G, 3, 5, 3);
    run(G, NONE, 3);
    const b = G.bodies[0];
    ok(Math.abs(b.y - (JAR.h - ITEMS[3].r)) < 0.02 && speed(G) < 0.05, `a treat falls and rests on the floor (y ${b.y.toFixed(3)})`);

    // merging
    G = blank(5);
    Gm.addBody(G, 2, 4, JAR.h - ITEMS[2].r);
    Gm.addBody(G, 2, 4 + ITEMS[2].r * 2 + 0.01, JAR.h - ITEMS[2].r);
    Gm.step(G, NONE, DT);
    ok(G.bodies.length === 1 && G.bodies[0].tier === 3, 'two touching lollipops merge into a truffle');
    ok(Math.abs(G.bodies[0].x - (4 + ITEMS[2].r + 0.005)) < 0.05, 'at their midpoint');
    ok(G.score === ITEMS[3].pts && G.events.some((e) => e.type === 'merge' && e.tier === 3), 'scoring the truffle\'s points, with a merge event');
    ok(G.topTier === 3, 'the biggest treat made is remembered');

    G = blank(6);
    Gm.addBody(G, 2, 4, JAR.h - ITEMS[2].r);
    Gm.addBody(G, 3, 4 + ITEMS[2].r + ITEMS[3].r + 0.001, JAR.h - ITEMS[3].r);
    run(G, NONE, 1);
    ok(G.bodies.length === 2 && G.score === 0, 'different treats never merge');

    // a cascade: two gumdrops on the floor make a lollipop under the lollipop resting on them
    G = blank(7);
    const y1 = JAR.h - ITEMS[1].r;
    Gm.addBody(G, 1, 3, y1);
    Gm.addBody(G, 1, 3 + ITEMS[1].r * 2, y1);
    const reach = ITEMS[1].r + ITEMS[2].r;
    Gm.addBody(G, 2, 3 + ITEMS[1].r, y1 - Math.sqrt(reach * reach - ITEMS[1].r * ITEMS[1].r));
    run(G, NONE, 1);
    const kinds = G.bodies.map((q) => q.tier);
    ok(kinds.length === 1 && kinds[0] === 3, `a merge is checked again: gumdrops → lollipop → truffle (left ${kinds})`);
    ok(G.chain >= 2 && G.score > ITEMS[2].pts + ITEMS[3].pts - 1, `merges close together make a chain worth extra (chain ${G.chain}, score ${G.score})`);

    // two Jingle Bells
    G = blank(8);
    const rb = ITEMS[10].r;
    Gm.addBody(G, 10, rb, JAR.h - rb);
    Gm.addBody(G, 10, rb * 3 + 0.01, JAR.h - rb);
    Gm.step(G, NONE, DT);
    ok(G.bodies.length === 0 && G.score === C.MIRACLE_PTS && G.miracles === 1, 'two Jingle Bells are a Christmas Miracle: both vanish for the bonus');
    ok(G.events.some((e) => e.type === 'miracle'), 'with a miracle event');

    // the line
    G = blank(9);
    Gm.addBody(G, 4, 5, JAR.h - ITEMS[4].r);
    run(G, NONE, 5);
    ok(!G.over && G.danger === 0, 'a treat below the line is safe');
    G = blank(10);
    // a treat held resting above the line (the test puts it back every step)
    const held = Gm.addBody(G, 4, 5, 1.5);
    held.age = 5;
    let warned = false, overAt = null;
    for (let t = 0; t < 12 && !G.over; t += DT) {
        held.y = 1.5; held.vx = held.vy = 0;
        Gm.step(G, NONE, DT);
        if (G.events.some((e) => e.type === 'warn')) warned = true;
        G.events.length = 0;
        if (G.over) overAt = t;
    }
    ok(warned && G.over, `a jar full past the line warns, then ends the game (after ${overAt?.toFixed(2)} s)`);
    ok(overAt === null || overAt >= C.DANGER.limit - DT * 2, 'but only after DANGER.limit seconds');
    G = blank(11);
    Gm.step(G, { dx: 0, aim: 5, drop: true }, DT);
    let maxDanger = 0;
    for (let t = 0; t < 2; t += DT) { Gm.step(G, NONE, DT); maxDanger = Math.max(maxDanger, G.danger); }
    ok(maxDanger === 0, 'a treat falling past the line doesn\'t count');
    const stepped = Gm.newGame(12);
    stepped.over = true;
    const before = JSON.stringify(Gm.serialize(stepped));
    Gm.step(stepped, { dx: 1, aim: null, drop: true }, DT);
    ok(JSON.stringify(Gm.serialize(stepped)) === before, 'nothing moves once the game is over');
}

if (want('physics')) {
    section('physics');
    // a heap of mixed treats, dropped fast, then left alone
    const G = blank(21);
    const order = [0, 4, 2, 1, 3, 4, 0, 2, 3, 1, 4, 2, 0, 3, 1, 2, 4, 3, 0, 1];
    order.forEach((tier, i) => {
        const r = ITEMS[tier].r;
        Gm.addBody(G, tier, r + ((i * 3.7) % (JAR.w - 2 * r)), -i * 1.2);
    });
    G.bodies.forEach((q) => { q.age = 2; });
    // keep them from merging so we test the heap, not the rules
    G.bodies.forEach((q, i) => { q.tier = [0, 4, 2, 1, 3][i % 5]; });
    let worst = 0;
    for (let t = 0; t < 8; t += DT) {
        Gm.step(G, NONE, DT);
        G.events.length = 0;
        if (t > 3) worst = Math.max(worst, maxOverlap(G));
    }
    ok(speed(G) < 0.08, `the heap comes to rest (fastest ${speed(G).toFixed(3)} u/s)`);
    ok(worst < 0.06, `treats in a resting heap barely overlap (worst ${worst.toFixed(3)})`);
    ok(G.bodies.every((q) => q.x >= q.r - 1e-6 && q.x <= JAR.w - q.r + 1e-6 && q.y <= JAR.h - q.r + 1e-6), 'everything is inside the jar');
    const spins = G.bodies.reduce((m, q) => Math.max(m, Math.abs(q.w)), 0);
    ok(spins < 0.1, `and nothing keeps spinning (fastest ${spins.toFixed(3)} rad/s)`);

    // a treat thrown along the floor rolls clockwise (screen y is down) as it goes right
    const R = blank(22);
    const b = Gm.addBody(R, 2, 2, JAR.h - ITEMS[2].r);
    b.vx = 5;
    run(R, NONE, 0.3);
    ok(b.w > 0 && Math.abs(b.vx - b.w * b.r) < 0.3, `rolling right turns it clockwise, without sliding (vx ${b.vx.toFixed(2)}, ωr ${(b.w * b.r).toFixed(2)})`);
    // a big merge swelling into a tight heap doesn't fire anything out of the jar
    const S = blank(23);
    for (let i = 0; i < 6; i++) Gm.addBody(S, 0, 0.4 + i * 0.7, JAR.h - 0.35);
    Gm.addBody(S, 8, 3, JAR.h - 3);
    Gm.addBody(S, 8, 3 + ITEMS[8].r * 2 + 0.01, JAR.h - 3);
    let fastest = 0;
    for (let t = 0; t < 2; t += DT) { Gm.step(S, NONE, DT); fastest = Math.max(fastest, speed(S)); }
    ok(fastest < C.PHYS.maxSpeed && S.bodies.every((q) => q.y > -2), `a merge swelling into its neighbours shoves them gently (fastest ${fastest.toFixed(1)} u/s)`);
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), 30); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(a.drops > 30, `the bot is really playing (${a.drops} drops)`);

    const G = Gm.newGame(7);
    const bot = Bt.makeBot({ seed: 1 });
    run(G, (g) => Bt.botInput(g, bot), 20);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    run(G, (g) => Bt.botInput(g, b1), 20);
    run(copy, (g) => Bt.botInput(g, b2), 20);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ ...Gm.serialize(G), bodies: [{ tier: 40, x: 1, y: 1 }] }); } catch { threw = true; }
    ok(threw, 'a save with a treat that doesn\'t exist is rejected');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const CAP = 2500;
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.5]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, worst = 0, steps = 0, deep = 0, samples = 0;
            while (!G.over && G.drops < CAP) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                steps++;
                for (const b of G.bodies) {
                    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.a)) { bad = 'non-finite body'; break; }
                    if (b.x < b.r - 1e-6 || b.x > JAR.w - b.r + 1e-6 || b.y > JAR.h - b.r + 1e-6) { bad = 'outside the jar'; break; }
                }
                if (steps % 30 === 0 && G.danger === 0) {
                    const o = maxOverlap(G, true);
                    worst = Math.max(worst, o);
                    samples++;
                    if (o > 0.25) deep++;
                }
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            // overlap as a share of the smaller treat's radius, sampled while the jar isn't overflowing:
            // a peppermint squeezed through a shifting pile can dip in for a moment, never stay there
            ok(worst < 1.2 && deep <= samples * 0.02, `seed ${s} skill ${skill}: treats don't sink into each other (worst ${Math.round(worst * 100)}% of a radius, over 25% in ${deep}/${samples} samples)`);
            rows.push({ seed: s, skill, score: G.score, drops: G.drops, top: G.topTier, miracles: G.miracles, ended: G.over, mins: G.t / 60 });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const avg = (k, f) => of(k).reduce((a, r) => a + r[f], 0) / of(k).length;
    console.log('  skill  score   drops  top treat (avg)          ended  minutes');
    for (const k of [1, 0.5]) {
        console.log(`  ${String(k).padEnd(5)}  ${String(Math.round(avg(k, 'score'))).padEnd(6)}  ${String(Math.round(avg(k, 'drops'))).padEnd(5)}  ${avg(k, 'top').toFixed(1)} (${ITEMS[Math.round(avg(k, 'top'))].name})`.padEnd(51) + `${of(k).filter((r) => r.ended).length}/${of(k).length}    ${avg(k, 'mins').toFixed(1)}`);
    }
    ok(avg(1, 'score') > avg(0.5, 'score') * 1.3, 'a careful bot scores well above a careless one');
    ok(avg(1, 'top') >= 8, `the careful bot makes at least Snow Globes on average (${avg(1, 'top').toFixed(1)})`);
    ok(avg(0.5, 'top') >= 6, `even the careless bot reaches Ornaments: the game is gentle (${avg(0.5, 'top').toFixed(1)})`);
    ok(of(0.5).every((r) => r.ended), 'the careless bot always fills the jar in the end');
    ok(rows.every((r) => r.ended || r.drops >= CAP), 'every game ends or plays on to the cap');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
