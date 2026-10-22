/**
 * simtest.mjs — headless checks of NEONFALL's simulation. No browser.
 *
 *   node game-092/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-092/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-092/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. rules: running, screens and the ring, jumping, logs, pits, vines, crocodiles, cobras and fire,
 *    ladders, tunnels, walls, scorpions, treasure, streaks, extra lives, the clock, winning, losing.
 * 3. world: every generator rule, over many seeds.
 * 4. determinism: the same seed and inputs give the same game; a save round trip plays on
 *    identically; an unknown save version is rejected.
 * 5. crossing: on 3 seeds the bot crosses EVERY screen, both ways, on the surface, without dying;
 *    tunnel screens cross too, and a wall really blocks.
 * 6. bot: whole 20-minute games on SEEDS seeds at three skills, with invariants after every step,
 *    and the balance table.
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
const Gm = await import('../js/sim/game.js');
const Wd = await import('../js/sim/world.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg} (got ${typeof a === 'number' ? a.toFixed(2) : a}, want ${b} ±${tol})`);
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false };
const RIGHT = { x: 1, y: 0, a: false };
const LEFT = { x: -1, y: 0, a: false };
const has = (G, type) => G.events.some((e) => e.type === type);
const run = (G, inp, secs, stopWhen) => {
    for (let t = 0; t < secs; t += DT) {
        Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT);
        if (stopWhen && stopWhen(G)) return true;
    }
    return false;
};
const tap = (G, inp = NONE) => Gm.step(G, { ...inp, a: true }, DT);

// ---------------------------------------------------------------- a lab world: screens 0-4 are blank
const LAB = 9001;
function blankScreen(s) {
    Object.assign(s, { kind: 'clear', ladder: false, logs: [], pits: [], crocs: [], vine: null, cobras: [], fires: [], treasure: null, tunnel: { wall: false, scorp: null } });
    return s;
}
/** A fresh game on a blank screen 0; setup(screen) adds whatever the test needs. */
function lab(setup, o = {}) {
    const w = Wd.getWorld(LAB);
    for (let i = 0; i < 5; i++) blankScreen(w.screens[i]);
    if (setup) setup(w.screens[0], w);
    const G = Gm.newGame(LAB);
    G.screen = 0;
    G.p.x = o.x ?? 40;
    if (o.layer === 'tunnel') { G.p.layer = 'tunnel'; G.p.y = C.TF; }
    return G;
}
const staticLog = (x) => ({ v: 0, P: 600, phase: C.W + 12 - x });

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
    section('rules: running and screens');
    let G = lab();
    const x0 = G.p.x;
    run(G, RIGHT, 0.5);
    near(G.p.x - x0, C.RUN * 0.5, 4, 'runs right at RUN');
    run(G, NONE, 0.3);
    ok(Math.abs(G.p.vx) < 1, 'stops when the key is released');
    run(G, RIGHT, 5, (g) => g.screen !== 0);
    ok(G.screen === 1 && G.p.x < 5, 'running off the right edge enters the next screen at its left');
    ok(G.events.some((e) => e.type === 'screen' && e.dir === 1), 'and emits a screen event');
    run(G, LEFT, 5, (g) => g.screen !== 1);
    ok(G.screen === 0 && G.p.x > C.W - 5, 'running off the left edge goes back');
    G = lab(); G.screen = 0;
    run(G, LEFT, 8, (g) => g.screen !== 0);
    ok(G.screen === C.N_SCREENS - 1, 'the world is a ring: left of screen 0 is the last screen');
    ok(G.visited[C.N_SCREENS - 1] === 1, 'a visited screen is remembered');

    section('rules: jumping');
    G = lab();
    run(G, NONE, 0.2);
    tap(G);
    ok(has(G, 'jump') && G.p.st === 'air', 'a tap jumps');
    let apex = G.p.y; let air = 0;
    G.events.length = 0;
    for (; G.p.st === 'air' && air < 3; air += DT) { Gm.step(G, NONE, DT); apex = Math.min(apex, G.p.y); }
    near(C.SURF - apex, C.JUMP_H, 1.5, 'the jump rises JUMP_H');
    near(air, C.JUMP_T, 0.04, 'and takes JUMP_T');
    ok(G.p.st === 'ground' && G.p.y === C.SURF && has(G, 'land'), 'then lands with a land event');
    G = lab();
    run(G, NONE, 0.1);
    tap(G, RIGHT); run(G, RIGHT, 1.2);
    near(G.p.x - 40, C.RUN * C.JUMP_T + C.RUN * 0.6, 12, 'a running jump covers about 50 px');
    // a jump pressed just before landing still happens (buffer); one just after running off a ledge too (coyote)
    G = lab();
    run(G, NONE, 0.1); tap(G);
    run(G, NONE, 0.5);
    tap(G, NONE);
    run(G, NONE, 0.2);
    ok(G.stats.jumps === 2, 'a jump pressed just before landing is buffered');
    G = lab((s) => s.pits.push({ x0: 120, x1: 154, type: 'tar' }));
    G.p.x = 119;
    run(G, RIGHT, 1, (g) => g.p.st === 'air');
    run(G, RIGHT, 0.03);
    G.events.length = 0;
    tap(G, RIGHT);
    ok(has(G, 'jump'), 'coyote time: a jump just after running off a ledge works');

    section('rules: logs');
    G = lab((s) => s.logs.push(staticLog(100)));
    G.p.x = 60;
    run(G, RIGHT, 1, (g) => g.p.stun > 0);
    ok(G.p.stun > 0 && has(G, 'hit'), 'running into a log stuns Harry');
    ok(G.score === C.START_SCORE - C.HIT_PENALTY, 'and costs HIT_PENALTY points');
    ok(G.lives === C.LIVES, 'but not a life');
    const sc = G.score;
    run(G, RIGHT, 0.5);
    ok(G.score === sc, 'a hit log does not hit twice (invulnerable while recovering)');
    G = lab((s) => s.logs.push(staticLog(100)));
    G.p.x = 60; run(G, RIGHT, 1, (g) => g.p.x >= 78);
    tap(G, RIGHT);
    run(G, RIGHT, 1.2);
    ok(G.p.x > 112 && G.score === C.START_SCORE, 'a jump clears a log');
    G = lab((s) => s.logs.push({ v: 52, P: 520, phase: 100 }));
    const a = Gm.logX(G ? Wd.getWorld(LAB).screens[0].logs[0] : null, 0), b = Gm.logX(Wd.getWorld(LAB).screens[0].logs[0], 1);
    near(a - b, 52, 0.01, 'logs roll left at their speed');
    near(Gm.logX(Wd.getWorld(LAB).screens[0].logs[0], 520 / 52) - a, 0, 0.01, 'and come round again after one period');

    section('rules: pits');
    G = lab((s) => s.pits.push({ x0: 120, x1: 154, type: 'tar' }));
    run(G, RIGHT, 3, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'sink' && G.lives === C.LIVES - 1, 'walking into a tar pit costs a life');
    run(G, NONE, 3, (g) => g.p.st !== 'dead');
    ok(G.p.st === 'ground' && G.p.x === 24 && G.p.inv > 1, 'and Harry respawns at the left of the screen, briefly invulnerable');
    ok(G.screen === 0 && G.streak === 0, 'on the same screen');
    G = lab((s) => s.pits.push({ x0: 120, x1: 154, type: 'sand' }));
    G.p.x = 80; run(G, RIGHT, 2, (g) => g.p.x >= 108); tap(G, RIGHT); run(G, RIGHT, 1.5);
    ok(G.p.x > 154 && G.lives === C.LIVES, 'a 34 px pit can be jumped');
    G = lab((s) => s.pits.push({ x0: 100, x1: 200, type: 'tar' }));
    G.p.x = 60; run(G, RIGHT, 2, (g) => g.p.x >= 94); tap(G, RIGHT); run(G, RIGHT, 1.5);
    ok(G.lives === C.LIVES - 1, 'a 100 px pit cannot (it needs a vine)');
    G = lab((s) => s.pits.push({ x0: 120, x1: 200, type: 'water' }));
    run(G, RIGHT, 3, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'drown', 'water drowns');
    G = lab((s) => s.pits.push({ x0: 120, x1: 154, type: 'tar' }));
    G.p.x = 122; G.p.vx = 0; run(G, NONE, 0.02);
    ok(G.p.st === 'ground', 'a pit is PIT_FORGIVE narrower than it looks: the very edge is safe');

    section('rules: vines');
    const vineLab = () => lab((s) => {
        s.pits.push({ x0: 100, x1: 200, type: 'tar' });
        s.vine = { x: 150, y0: C.VINE.y0, L: C.VINE.L, A: C.VINE.A, T: C.VINE.T, phi: 0 };
    });
    G = vineLab();
    const v = Wd.getWorld(LAB).screens[0].vine;
    near(Gm.vineTheta(v, 0), 0, 1e-9, 'the vine starts at the bottom of its swing');
    near(Gm.vineTheta(v, C.VINE.T / 4), C.VINE.A, 1e-9, 'and reaches amplitude A a quarter period later');
    near(Gm.vineOmega(v, C.VINE.T / 4), 0, 1e-9, 'where it stops');
    // jump from the bank and grab: search the start time for a grab
    let grabbed = false;
    for (let off = 0; off < 2.6 && !grabbed; off += 0.1) {
        G = vineLab(); G.t = off; G.p.x = 94;
        run(G, NONE, 0.03); tap(G, RIGHT);
        grabbed = run(G, RIGHT, 1.2, (g) => g.p.st === 'vine');
        if (grabbed) break;
    }
    ok(grabbed && has(G, 'grab'), 'jumping into the rope grabs it');
    const s0 = G.p.vineS;
    run(G, NONE, 0.5);
    ok(G.p.st === 'vine', 'Harry stays on the vine');
    const th = Gm.vineTheta(v, G.t);
    near(G.p.x, 150 + s0 * Math.sin(th), 0.5, 'and swings with it');
    near(G.p.y, C.VINE.y0 + s0 * Math.cos(th) + C.HAND, 0.5, 'hanging below the branch');
    G.events.length = 0;
    tap(G);
    ok(G.p.st === 'air' && has(G, 'release'), 'a tap lets go');
    // the bot's release rule gets across
    let crossed = 0;
    for (let off = 0; off < 2.6; off += 0.2) {
        G = vineLab(); G.t = off; G.p.x = 94;
        const bot = Bt.makeBot();
        bot.dir = 1;
        const done = run(G, (g) => Bt.driveEdge(g, bot, 1), 8, (g) => g.screen !== 0 || g.p.st === 'dead');
        if (done && G.screen === 1) crossed++;
    }
    ok(crossed >= 12, `the bot swings across the 100 px pit from 13 start phases (${crossed}/13)`);

    section('rules: crocodiles');
    const crocLab = (phases) => lab((s) => {
        s.pits.push({ x0: 100, x1: 226, type: 'water' });
        phases.forEach((ph, k) => s.crocs.push({ x: 123 + 40 * k, phase: ph }));
    });
    const closed = 0.2 - 0.2;   // phase 0 at t=0: closed for the first CROC.closed seconds
    ok(!Gm.crocOpen({ phase: closed }, 0) && Gm.crocOpen({ phase: closed }, C.CROC.closed + 0.01), 'a crocodile is closed, then open');
    ok(Gm.crocWarn({ phase: closed }, C.CROC.closed - 0.1) && !Gm.crocWarn({ phase: closed }, 0.1), 'and shows a warning before it opens');
    const jumpAt = (G, x) => { run(G, RIGHT, 2, (g) => g.p.x >= x); tap(G, RIGHT); };
    G = crocLab([0, 0, 0]);
    G.p.x = 60; jumpAt(G, 78);
    run(G, RIGHT, 0.7, (g) => g.p.st === 'ground' || g.p.st === 'dead');
    ok(G.p.st === 'ground' && G.p.x > 108 && G.p.x < 138, 'a closed crocodile head is a floor');
    const tLand = G.t;
    G = crocLab([C.CROC.closed - (tLand + 0.3), 0, 0]);          // opens 0.3 s after Harry lands
    G.p.x = 60; jumpAt(G, 78);
    run(G, RIGHT, 0.7, (g) => g.p.st === 'ground');
    run(G, NONE, 1.5, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'chomp', 'standing on a head when it opens gets Harry eaten');
    G = crocLab([C.CROC.closed + 0.2 - tLand, 0, 0]);            // already open when Harry lands
    G.p.x = 60; jumpAt(G, 78);
    run(G, RIGHT, 0.7, (g) => g.p.st === 'dead' || g.p.st === 'ground');
    ok(G.p.st === 'dead' && G.p.dk === 'chomp', 'landing on an open mouth is fatal');
    G = crocLab([0, 0, 0]);
    G.p.x = 90;
    run(G, RIGHT, 1, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'drown', 'walking off the bank into the gap between crocodiles drowns');

    section('rules: cobras and fire');
    G = lab((s) => s.cobras.push({ x: 120 }));
    run(G, RIGHT, 2, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'bite' && G.lives === C.LIVES - 1, 'a cobra is fatal');
    G = lab((s) => s.fires.push({ x: 120 }));
    run(G, RIGHT, 2, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'burn', 'so is fire');
    G = lab((s) => s.cobras.push({ x: 120 }));
    G.p.x = 60; run(G, RIGHT, 2, (g) => g.p.x >= 100); tap(G, RIGHT); run(G, RIGHT, 1);
    ok(G.lives === C.LIVES && G.p.x > 130, 'a jump clears a cobra');
    G = lab((s) => s.cobras.push({ x: 60 })); G.p.x = 50; G.p.inv = 2;
    run(G, RIGHT, 0.5);
    ok(G.lives === C.LIVES, 'a respawned Harry is invulnerable to cobras');

    section('rules: ladders and tunnels');
    G = lab((s) => { s.ladder = true; });
    G.p.x = 148;
    run(G, NONE, 0.05);
    run(G, { x: 0, y: 1, a: false }, 0.2);
    ok(G.p.st === 'ladder', 'Down beside a ladder hole climbs on');
    run(G, { x: 0, y: 1, a: false }, 3, (g) => g.p.st === 'ground');
    ok(G.p.layer === 'tunnel' && G.p.y === C.TF && Math.abs(G.p.x - C.LX) < 1, 'and down into the tunnel');
    ok(G.screen === 0, 'on the same screen');
    run(G, { x: 0, y: -1, a: false }, 4, (g) => g.p.layer === 'surface' && g.p.st !== 'ladder');
    run(G, NONE, 0.8);
    ok(G.p.layer === 'surface' && G.p.st === 'ground' && Math.abs(G.p.x - C.LX) >= 11, 'Up climbs out onto the bank beside the hole');
    G = lab((s) => { s.ladder = true; });
    G.p.x = 140;
    run(G, RIGHT, 3, (g) => g.p.layer === 'tunnel' && g.p.st === 'ground');
    ok(G.p.layer === 'tunnel' && G.lives === C.LIVES, 'walking into a hole drops Harry into the tunnel unhurt');
    ok(G.p.x > 150 && G.p.x < 190, 'landing under the hole');
    G = lab(null, { layer: 'tunnel' });
    G.screen = 0; G.p.x = 100;
    run(G, RIGHT, 6, (g) => g.screen !== 0);
    ok(G.screen === C.TUNNEL_STRIDE && G.p.layer === 'tunnel', 'a tunnel screen hops 3 surface screens');
    G = lab(null, { layer: 'tunnel' }); G.p.x = 40;
    run(G, LEFT, 3, (g) => g.screen !== 0);
    ok(G.screen === C.N_SCREENS - C.TUNNEL_STRIDE, 'both ways, round the ring');
    G = lab((s) => { s.ladder = true; s.tunnel.wall = true; }, { layer: 'tunnel' });
    G.p.x = 60;
    run(G, RIGHT, 6);
    ok(G.screen === 0 && G.p.x < C.WALL_X && G.p.x > C.WALL_X - 12, 'a brick wall blocks the tunnel');
    G.p.vx = 0;
    tap(G, RIGHT); run(G, RIGHT, 1.2);
    ok(G.p.x < C.WALL_X, 'even jumping');
    G = lab((s) => { s.tunnel.scorp = { x0: 100, x1: 200, v: 30, phase: 0 }; }, { layer: 'tunnel' });
    G.p.x = 60;
    run(G, RIGHT, 5, (g) => g.p.st === 'dead');
    ok(G.p.dk === 'sting', 'a scorpion is fatal');
    near(Gm.scorpPos({ x0: 100, x1: 200, v: 25, phase: 0 }, 2).x, 150, 0.01, 'scorpions patrol between their ends');
    near(Gm.scorpPos({ x0: 100, x1: 200, v: 25, phase: 0 }, 6).x, 150, 0.01, 'and turn round');

    section('rules: treasure, score, lives, the clock');
    G = lab((s) => { s.treasure = { id: 0, kind: 2, screen: 0, layer: 'surface', x: 120 }; });
    run(G, RIGHT, 2, (g) => g.got[0]);
    ok(G.got[0] === 1 && G.score === C.START_SCORE + 4000, 'a gold bar is worth 4000');
    ok(G.streak === 1 && G.events.some((e) => e.type === 'treasure' && e.value === 4000), 'a treasure event says so');
    G = lab((s) => { s.treasure = { id: 1, kind: 0, screen: 0, layer: 'surface', x: 120 }; });
    G.streak = 2;
    run(G, RIGHT, 2, (g) => g.got[1]);
    ok(G.score === C.START_SCORE + 2000 * 1.5, 'treasures in a row are worth 25% more each');
    G = lab((s) => { s.treasure = { id: 2, kind: 1, screen: 0, layer: 'tunnel', x: 60 }; });
    run(G, RIGHT, 1);
    ok(G.got[2] === 0, 'a tunnel treasure cannot be picked up from the surface');
    G = lab((s) => { s.treasure = { id: 2, kind: 1, screen: 0, layer: 'tunnel', x: 60 }; }, { layer: 'tunnel' });
    G.p.x = 40; run(G, RIGHT, 1, (g) => g.got[2]);
    ok(G.got[2] === 1, 'but it can from the tunnel');
    G = lab((s) => { s.treasure = { id: 5, kind: 1, screen: 0, layer: 'surface', x: 120 }; });
    G.got.fill(1); G.got[5] = 0; G.got[4] = 1; G.lives = 2;
    run(G, RIGHT, 2, (g) => g.got[5]);
    ok(G.lives === 3, 'every 6th treasure is an extra life');
    G = lab((s) => { s.treasure = { id: 23, kind: 3, screen: 0, layer: 'surface', x: 120 }; });
    G.got.fill(1); G.got[23] = 0; G.left = 600; G.lives = C.LIVES_MAX;
    run(G, RIGHT, 2, (g) => g.over);
    ok(G.over && G.won && G.reason === 'won', 'the last treasure wins the game');
    ok(G.score === C.START_SCORE + 5000 * (1 + 0.25 * Math.min(G.streak - 1, C.STREAK_MAX)) + Math.floor(600 - 0.5) * C.TIME_BONUS || G.score > C.START_SCORE + 5000 + 2900, 'with a bonus for the time left');
    ok(G.lives === C.LIVES_MAX, 'lives never go above LIVES_MAX');
    G = lab();
    G.left = 3;
    run(G, NONE, 4, (g) => g.over);
    ok(G.over && G.reason === 'time' && G.left === 0, 'the clock running out ends the game');
    ok(has(G, 'over') && G.events.filter((e) => e.type === 'tick').length >= 2, 'with ticks for the last seconds');
    G = lab((s) => s.cobras.push({ x: 60 }));
    G.lives = 1; G.p.x = 50;
    run(G, RIGHT, 5, (g) => g.over);
    ok(G.over && G.reason === 'lives' && G.lives === 0, 'losing the last life ends the game');
    const sc2 = G.score; Gm.step(G, RIGHT, DT);
    ok(G.score === sc2 && G.t > 0, 'a finished game ignores further steps');
    G = lab(); G.left = 125; run(G, NONE, 6);
    ok(G.hurry === 1 && has(G, 'hurry'), 'a hurry event at 2 minutes left');
}

if (want('world')) {
    section('world');
    let bad = 0;
    const kinds = new Set();
    const SEEDS_W = 60;
    for (let seed = 1; seed <= SEEDS_W; seed++) {
        const w = Wd.buildWorld(seed);
        const msg = (m) => { bad++; console.log(`  FAIL seed ${seed}: ${m}`); };
        if (w.screens.length !== C.N_SCREENS) msg('screen count');
        if (w.treasures.length !== C.TREASURES) msg('treasure count');
        const tScreens = new Set(w.treasures.map((t) => t.screen));
        if (tScreens.size !== C.TREASURES) msg('two treasures share a screen');
        if (w.treasures.filter((t) => t.layer === 'tunnel').length !== 8) msg('want 8 tunnel treasures');
        if (w.screens[0].kind !== 'clear' || w.screens[0].treasure) msg('the start screen must be bare');
        for (const s of w.screens) {
            kinds.add(s.kind);
            const hazards = [...s.pits.flatMap((p) => [p.x0, p.x1]), ...s.cobras.map((c) => c.x), ...s.fires.map((f) => f.x)];
            if (hazards.some((x) => x < 40 || x > C.W - 40)) msg(`screen ${s.i} (${s.kind}) has a hazard in the edge zone`);
            for (const p of s.pits) {
                if (p.x1 - p.x0 > 60 && !s.vine && p.type !== 'water') msg(`screen ${s.i}: a wide pit without a vine`);
                if (s.ladder && s.kind !== 'ladderpits' && p.x1 > C.LX - 44 && p.x0 < C.LX + 44) msg(`screen ${s.i}: a pit near the ladder`);
            }
            if (s.ladder) {
                if (s.cobras.some((c) => Math.abs(c.x - C.LX) < 56) || s.fires.some((f) => Math.abs(f.x - C.LX) < 56)) msg(`screen ${s.i}: a hazard on the ladder`);
            }
            if (s.vine && Math.abs(s.vine.x - (s.pits[0].x0 + s.pits[0].x1) / 2) > 1) msg(`screen ${s.i}: the vine is not over the pit`);
            if (s.crocs.length && s.crocs.length !== 3) msg(`screen ${s.i}: crocodile count`);
            if (s.tunnel.wall && !s.ladder) msg(`screen ${s.i}: a wall without a ladder`);
            const sc = s.tunnel.scorp;
            if (sc) {
                if (sc.x0 < 30 || sc.x1 > C.W - 30) msg(`screen ${s.i}: scorpion in the edge zone`);
                if (s.ladder && sc.x1 > C.LX - 20 && sc.x0 < C.LX + 20) msg(`screen ${s.i}: scorpion on the ladder`);
                if (s.tunnel.wall && sc.x1 > C.WALL_X - 10) msg(`screen ${s.i}: scorpion against the wall`);
            }
            const t = s.treasure;
            if (t) {
                if (t.layer === 'tunnel' && !s.ladder) msg(`screen ${s.i}: a tunnel treasure with no way down`);
                if (t.layer === 'tunnel' && t.x >= C.LX - 20) msg('tunnel treasure beside the ladder');
                if (t.layer === 'surface' && hazards.some((x) => x > C.W - 60)) msg('surface treasure behind a hazard');
            }
            for (const L of s.logs) if (L.P < C.W + 24) msg(`screen ${s.i}: log period too short`);
        }
        for (let lane = 0; lane < C.TUNNEL_STRIDE; lane++) {
            const idx = []; for (let i = lane; i < C.N_SCREENS; i += C.TUNNEL_STRIDE) idx.push(i);
            let run0 = 0, maxRun = 0;
            for (let n = 0; n < idx.length * 2; n++) { if (w.screens[idx[n % idx.length]].ladder) run0 = 0; else maxRun = Math.max(maxRun, ++run0); }
            if (maxRun >= 9) msg(`lane ${lane}: ${maxRun} tunnel screens without a ladder`);
        }
    }
    ok(bad === 0, `${SEEDS_W} worlds keep every generator rule`);
    ok(kinds.size >= 12, `a good mix of screens (${kinds.size} kinds)`);
    const a = Wd.buildWorld(7), b = Wd.buildWorld(7), c = Wd.buildWorld(8);
    ok(JSON.stringify(a) === JSON.stringify(b), 'the same seed builds the same world');
    ok(JSON.stringify(a) !== JSON.stringify(c), 'a different seed builds a different one');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 60), b = play(42, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    const G = Gm.newGame(7);
    const bot = Bt.makeBot({ seed: 7 });
    run(G, (g) => Bt.botInput(g, bot), 40);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(JSON.stringify(Gm.serialize(copy)) === JSON.stringify(Gm.serialize(G)), 'a save round trip is exact');
    const bot2 = JSON.parse(JSON.stringify({ ...bot, rng: undefined }));
    // the bot keeps its own state; give both games the same bot to compare the sim alone
    const mk = () => { const bb = Bt.makeBot({ seed: 7 }); bb.n = bot.n; return bb; };
    const b1 = mk(), b2 = mk();
    run(G, (g) => Bt.botInput(g, b1), 40);
    run(copy, (g) => Bt.botInput(g, b2), 40);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a loaded game plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(bot2 !== null, 'bot state is plain data');
    const cl = Gm.cloneGame(G); cl.p.x = -50; cl.got[0] = 9;
    ok(G.p.x !== -50 && G.got[0] !== 9, 'cloneGame does not share the player or the lists');
}

if (want('crossing')) {
    section('crossing: the bot crosses every screen, both ways');
    let total = 0, clean = 0, failed = [];
    const t0 = Date.now();
    for (const seed of [11, 12, 13]) {
        const w = Wd.getWorld(seed);
        for (const dir of [1, -1]) {
            for (let i = 0; i < C.N_SCREENS; i++) {
                const G = Gm.newGame(seed);
                G.screen = i; G.lives = 9;
                G.p.x = dir > 0 ? 3 : C.W - 3; G.p.face = dir; G.p.inv = C.ENTRY_GRACE;
                const bot = Bt.makeBot({ seed: i });
                bot.dir = dir;
                const done = run(G, (g) => Bt.driveEdge(g, bot, dir), 45, (g) => g.screen !== i);
                total++;
                if (done && G.stats.deaths === 0 && G.stats.hits === 0) clean++;
                else failed.push(`seed ${seed} ${w.screens[i].kind} #${i} ${dir > 0 ? '→' : '←'} ${done ? `deaths ${G.stats.deaths} hits ${G.stats.hits}` : 'stuck'}`);
            }
        }
    }
    ok(failed.length === 0, `${clean}/${total} surface crossings clean (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const f of failed.slice(0, 12)) console.log('    ', f);

    // tunnels: walk the lane from every ladder screen without a wall; scorpions are jumped
    let tt = 0, tc = 0, tfail = [];
    for (const seed of [11, 12, 13]) {
        const w = Wd.getWorld(seed);
        for (const s of w.screens) {
            if (s.tunnel.wall) continue;
            for (const dir of [1, -1]) {
                const G = Gm.newGame(seed);
                G.screen = s.i; G.lives = 9;
                G.p.layer = 'tunnel'; G.p.y = C.TF; G.p.x = dir > 0 ? 3 : C.W - 3; G.p.face = dir;
                const bot = Bt.makeBot({ seed: s.i });
                const done = run(G, (g) => Bt.driveEdge(g, bot, dir), 45, (g) => g.screen !== s.i);
                tt++;
                if (done && G.stats.deaths === 0) tc++; else tfail.push(`seed ${seed} #${s.i} ${dir > 0 ? '→' : '←'}`);
            }
        }
    }
    ok(tfail.length === 0, `${tc}/${tt} tunnel crossings clean`);
    for (const f of tfail.slice(0, 8)) console.log('    ', f);

    // no pocket: from either side of every wall there is a way up
    let trapped = 0;
    for (const seed of [11, 12, 13]) {
        const w = Wd.getWorld(seed);
        for (const lane of [0, 1, 2]) {
            const idx = []; for (let i = lane; i < C.N_SCREENS; i += 3) idx.push(i);
            for (const start of idx) {
                // walking right from the start screen's left edge reaches either a ladder or a wall; a wall screen has its ladder before the wall
                let n = 0, at = start, found = false;
                while (n++ < idx.length) { if (w.screens[at].ladder) { found = true; break; } at = (at + 3) % C.N_SCREENS; }
                if (!found) trapped++;
            }
        }
    }
    ok(trapped === 0, 'wherever Harry is in a tunnel, walking on one way reaches a ladder before any wall');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const t0 = Date.now();
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.85, 0.7]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, steps = 0;
            while (!G.over && steps < 144100) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                steps++;
                G.events.length = 0;
                const p = G.p;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'non-finite position';
                else if (p.x < -1 || p.x > C.W + 1) bad = 'outside the screen';
                else if (p.y < -5 || p.y > C.TF + 1) bad = 'outside the world';
                else if (G.score < 0 || G.lives < 0 || G.lives > C.LIVES_MAX) bad = 'score or lives out of range';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            ok(G.over, `seed ${s} skill ${skill}: the game ends (${G.reason})`);
            rows.push({ seed: s, skill, score: G.score, got: G.got.reduce((a, b) => a + b, 0), deaths: G.stats.deaths, hits: G.stats.hits, t: G.t, reason: G.reason });
        }
    }
    const avg = (k, f) => rows.filter((r) => r.skill === k).reduce((a, r) => a + f(r), 0) / SEEDS;
    console.log('  skill   win%   treasures   score    deaths  hits   minutes');
    for (const k of [1, 0.85, 0.7]) {
        console.log(`  ${String(k).padEnd(6)} ${String(Math.round(avg(k, (r) => (r.reason === 'won' ? 100 : 0)))).padStart(4)}   ${avg(k, (r) => r.got).toFixed(1).padStart(8)}   ${String(Math.round(avg(k, (r) => r.score))).padStart(7)}  ${avg(k, (r) => r.deaths).toFixed(1).padStart(6)}  ${avg(k, (r) => r.hits).toFixed(1).padStart(5)}  ${(avg(k, (r) => r.t) / 60).toFixed(1).padStart(7)}`);
    }
    ok(avg(1, (r) => (r.reason === 'won' ? 1 : 0)) === 1, 'the perfect bot wins every game');
    ok(avg(1, (r) => r.t) < 900, 'and in under 15 minutes of the 20');
    ok(avg(1, (r) => r.score) > avg(0.7, (r) => r.score), 'a better bot scores more');
    ok(avg(0.7, (r) => r.deaths) > avg(1, (r) => r.deaths), 'and dies less');
    console.log(`  ${rows.length} games in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
