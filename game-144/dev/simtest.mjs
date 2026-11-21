/**
 * simtest.mjs — headless checks of NEBULA REQUIEM's simulation. No browser.
 *
 *   node game-144/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-144/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-144/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: moving, walls, pickups and scoring, the dash, the round ending.
 * 3. determinism: the same seed and inputs give the same game; a save round trip mid-game
 *    plays on identically.
 * 4. bot: the bot plays a whole round on SEEDS seeds with per-step invariants (finite numbers,
 *    nothing outside the field) and the balance table is printed.
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
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const NONE = { x: 0, y: 0, a: false };

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
    let G = Gm.newGame(1);
    ok(G.pickups.length === C.PICKUP.count, 'a new game has every pickup');
    const x0 = G.player.x;
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.1, 'moves right at PLAYER.speed');
    run(G, { x: 1, y: 0, a: false }, 10);
    ok(G.player.x <= C.FIELD.w - C.PLAYER.radius + 1e-9, 'stops at the wall');
    run(G, { x: 1, y: 1, a: false }, 0.2);
    ok(Math.hypot(G.player.vx, G.player.vy) <= C.PLAYER.speed + 1e-6, 'diagonals are no faster');

    G = Gm.newGame(2);
    const c = G.pickups[0];
    G.player.x = c.x; G.player.y = c.y;
    Gm.step(G, NONE, DT);
    ok(G.score === C.PICKUP.score, 'touching a pickup scores');
    ok(G.pickups.length === C.PICKUP.count, 'a new pickup replaces it');
    ok(G.events.some((e) => e.type === 'pickup'), 'and emits a pickup event');

    G = Gm.newGame(3);
    Gm.step(G, { x: 1, y: 0, a: true }, DT);
    ok(G.player.dash > 0 && G.events.some((e) => e.type === 'dash'), 'the action button dashes');

    G = Gm.newGame(4);
    run(G, NONE, C.ROUND.seconds + 1);
    ok(G.over && G.events.some((e) => e.type === 'over'), 'the round ends on time');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), 20); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 10);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1), 10);
    run(copy, (g) => Bt.botInput(g, b2), 10);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill });
            let bad = null;
            while (!G.over) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'non-finite position';
                else if (p.x < 0 || p.y < 0 || p.x > C.FIELD.w || p.y > C.FIELD.h) bad = 'outside the field';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, score: G.score });
        }
    }
    const avg = (k) => Math.round(rows.filter((r) => r.skill === k).reduce((a, r) => a + r.score, 0) / SEEDS);
    ok(avg(1) > avg(0.6), 'a better bot scores more');
    ok(avg(1) >= 200, `the perfect bot scores at least 200 (got ${avg(1)})`);
    console.log(`  ${rows.length} rounds · average score: perfect ${avg(1)}, skill 0.6 ${avg(0.6)}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
