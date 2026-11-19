/**
 * simtest.mjs — headless checks of Kaboom Keep's simulation. No browser.
 *
 *   node game-142/dev/simtest.mjs
 *   ONLY=purity,rules node game-142/dev/simtest.mjs
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
    G = Gm.newGame(4);
    run(G, NONE, C.ROUND.seconds + 1);
    ok(G.over && G.events.some((e) => e.type === 'over'), 'the round ends on time');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), 20); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
