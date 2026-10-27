/**
 * simtest.mjs — headless checks of STARSLING's simulation. No browser.
 *
 *   node game-102/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-102/dev/simtest.mjs
 *   SEEDS=8 VERBOSE=1 node game-102/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. physics: every sector's stack sits still even when woken; boxes and circles collide, stack,
 *    slide and roll; sleeping and waking.
 * 3. rules: aiming and firing, each asteroid's special, damage by material, chain explosions, the
 *    void, winning, losing, stars.
 * 4. determinism: the same seed and inputs give the same game; a save round trip in mid-flight
 *    plays on identically (the warm-start cache is part of the state).
 * 5. bot: a perfect bot (plays each shot out on a copy of the game first) must clear every sector;
 *    a mortal bot plays SEEDS rounds of each, with per-step invariants. The balance table prints.
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
const Ph = await import('../js/sim/physics.js');
const { LEVELS } = await import('../js/sim/levels.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = {};
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const runUntil = (G, pred, secs = 30, inp = NONE) => { for (let t = 0; t < secs && !G.over; t += DT) { if (pred(G)) return true; Gm.step(G, inp, DT); } return pred(G); };
const fire = (G, angle, power) => Gm.step(G, { aim: { angle, power }, fire: true }, DT);
const types = (G) => G.events.map((e) => e.type);
const wakeAll = (G) => { for (const b of G.bodies) if (b.invMass > 0) b.asleep = false; };
/** An empty sector: just the two islands. */
const put = (G, spec) => { const b = Ph.makeBody({ id: G.nextId++, ...spec }); G.bodies.push(b); return b; };
const bare = (level = 0) => {
    const G = Gm.newGame(1, level);
    G.bodies = G.bodies.filter((b) => b.invMass === 0);
    // a robot far from the action keeps the sector from counting as cleared
    put(G, { kind: 'box', mat: 'robot', x: 1, y: 3 + C.ROBOT.h / 2, hx: C.ROBOT.w / 2, hy: C.ROBOT.h / 2, density: C.MATS.robot.density,
        hp: C.MATS.robot.hp, maxHp: C.MATS.robot.hp, value: C.MATS.robot.value, asleep: true });
    G.robots = 1;
    return G;
};
const box = (G, mat, x, y, w, h, extra = {}) => {
    const m = C.MATS[mat];
    return put(G, { kind: 'box', mat, x, y, hx: w / 2, hy: h / 2, density: m.density, fric: m.fric, rest: m.rest, hp: m.hp, maxHp: m.hp, value: m.value, asleep: false, ...extra });
};
const rock = (G, ammo, x, y, vx, vy, extra = {}) => {
    const d = C.AMMO[ammo];
    return put(G, { kind: 'circle', mat: 'ast', tag: 'proj', ammo, r: d.r, density: d.density, punch: d.punch, fric: 0.5, rest: 0.25, x, y, vx, vy, asleep: false, ...extra });
};
const TOP = C.ISLANDS[1].top;

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

if (want('physics')) {
    section('physics');
    for (let L = 0; L < LEVELS.length; L++) {
        const G = Gm.newGame(1, L);
        ok(G.robots === LEVELS[L].build().robots.length && G.robots > 0, `sector ${L + 1} has its robots`);
        wakeAll(G);
        const p0 = G.bodies.map((b) => [b.x, b.y, b.a]);
        run(G, NONE, 8);
        let worst = 0;
        G.bodies.forEach((b, i) => { worst = Math.max(worst, Math.hypot(b.x - p0[i][0], b.y - p0[i][1]), Math.abs(b.a - p0[i][2])); });
        ok(worst < 0.1, `sector ${L + 1} stands still when woken (worst drift ${worst.toFixed(3)})`);
        ok(G.score === 0 && !types(G).includes('break') && !types(G).includes('robot'), `sector ${L + 1}: nothing breaks under its own weight`);
        ok(G.bodies.filter((b) => b.invMass > 0).every((b) => b.asleep), `sector ${L + 1}: everything falls asleep`);
    }

    let G = bare();
    const blk = box(G, 'crate', 30, TOP + 6, 1.6, 1.6);
    run(G, NONE, 2);
    ok(Math.abs(blk.y - (TOP + 0.8)) < 0.03, `a box falls onto the dock and rests on it (y ${blk.y.toFixed(3)})`);
    ok(blk.asleep, 'and falls asleep');

    G = bare();
    const ball = rock(G, 'rock', 30, TOP + 3, 0, 0, { tag: 'debris' });
    run(G, NONE, 2);
    ok(Math.abs(ball.y - (TOP + 0.55)) < 0.05, 'a circle comes to rest on the ground');
    G = bare();
    const roller = rock(G, 'rock', 26, TOP + 0.56, 6, 0, { tag: 'debris' });
    run(G, NONE, 1.5);
    ok(roller.x > 29 && Math.abs(roller.w) > 3, `a circle with friction rolls (x ${roller.x.toFixed(1)}, spin ${roller.w.toFixed(1)})`);

    G = bare();
    const low = box(G, 'crate', 30, TOP + 0.8, 1.6, 1.6, { asleep: true });
    const high = box(G, 'crate', 30, TOP + 2.4, 1.6, 1.6, { asleep: true });
    run(G, NONE, 3);
    ok(Math.abs(high.y - low.y - 1.6) < 0.05 && Math.abs(high.x - 30) < 0.05, 'stacked crates stay stacked');
    const tilt = box(G, 'hull', 40, TOP + 0.3, 6, 0.6, { a: 0.3 });
    run(G, NONE, 3);
    ok(Math.abs(Math.sin(tilt.a)) < 0.02, 'a tilted plank slides flat and settles');

    G = bare();
    const sleeper = box(G, 'crate', 30, TOP + 0.8, 1.6, 1.6, { asleep: true });
    run(G, NONE, 1);
    ok(sleeper.asleep && sleeper.vx === 0, 'a sleeping body stays asleep');
    rock(G, 'rock', 24.5, TOP + 1, 20, 0);
    run(G, NONE, 0.3);
    ok(!sleeper.asleep || Math.abs(sleeper.x - 30) > 0.01, 'and wakes when something fast hits it');
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1, 0);
    ok(G.state === 'ready' && G.ammo.length === LEVELS[0].ammo.length, 'a sector starts ready with all its ammo');

    // aiming
    const a0 = G.aim.angle;
    run(G, { adjA: 1 }, 0.5);
    ok(G.aim.angle > a0 + 0.4, 'holding up raises the aim');
    run(G, { adjA: 1 }, 10);
    ok(G.aim.angle <= C.SLING.maxAngle + 1e-9, 'and stops at the limit');
    run(G, { adjP: -1 }, 10);
    ok(G.aim.power >= C.SLING.minPower - 1e-9, 'power stops at the minimum');
    Gm.step(G, { aim: { angle: 0.8, power: 0.5 } }, DT);
    ok(G.aim.angle === 0.8 && G.aim.power === 0.5, 'a pointer pull sets angle and power');
    ok(G.state === 'ready' && G.shots === 0, 'aiming alone does not fire');

    // firing
    G = Gm.newGame(1, 0);
    Gm.step(G, { aim: { angle: 0.5, power: 0.1 }, fire: true }, DT);
    ok(G.state === 'ready' && G.shots === 0, 'a feeble pull does not fire');
    fire(G, 0.6, 0.8);
    const proj = G.bodies.find((b) => b.tag === 'proj');
    ok(G.state === 'flight' && proj && G.shots === 1 && G.ammo.length === LEVELS[0].ammo.length - 1, 'firing launches one asteroid and uses one');
    const sp = Math.hypot(proj.vx, proj.vy);
    ok(Math.abs(sp - 0.8 * C.SLING.vmax) < 0.5 && Math.abs(Math.atan2(proj.vy, proj.vx) - 0.6) < 0.01, 'at the angle and power aimed');
    ok(types(G).includes('launch'), 'and a launch event');
    Gm.step(G, { aim: { angle: 1, power: 1 }, fire: true }, DT);
    ok(G.shots === 1, 'no second shot while one is in flight');

    // free flight agrees with predict()
    G = bare();
    G.ammo = ['rock']; G.robots = 1;
    fire(G, 0.9, 0.7);
    const pr = Gm.predict(G, 0.9, 0.7, 1.2, 0.12);
    run(G, NONE, 1.2 - DT);
    const sim = G.bodies.find((b) => b.tag === 'proj');
    const end = pr[pr.length - 1];
    ok(sim && Math.hypot(sim.x - end.x, sim.y - end.y) < 0.4, `predict() matches the simulated arc (off by ${sim ? Math.hypot(sim.x - end.x, sim.y - end.y).toFixed(3) : '?'})`);
    const flat = Gm.predict(Gm.newGame(1, 0), 0.5, 0.8, 1.5, 0.1), bent = Gm.predict(Gm.newGame(1, 3), 0.5, 0.8, 1.5, 0.1);
    ok(Math.hypot(flat[10].x - bent[10].x, flat[10].y - bent[10].y) > 0.3, 'a black hole bends the path');

    // specials
    const special = (ammo) => {
        const g = bare(); g.ammo = [ammo, 'rock']; g.robots = 1;
        fire(g, 0.7, 0.6); run(g, NONE, 0.3);
        return g;
    };
    G = special('rock');
    let b = G.bodies.find((o) => o.tag === 'proj'); let v0 = Math.hypot(b.vx, b.vy);
    Gm.step(G, { act: true }, DT);
    ok(Math.hypot(b.vx, b.vy) > v0 + 6 && types(G).includes('boost'), 'rock: a tap burns the thrusters');
    Gm.step(G, { act: true }, DT);
    ok(G.events.filter((e) => e.type === 'boost').length === 1, 'and only once');
    G = special('iron');
    b = G.bodies.find((o) => o.tag === 'proj');
    Gm.step(G, { act: true }, DT);
    ok(b.vy < -20 && types(G).includes('slam'), 'iron: a tap dives');
    G = special('ice');
    Gm.step(G, { act: true }, DT);
    ok(G.bodies.filter((o) => o.tag === 'shard').length === 3 && !G.bodies.some((o) => o.tag === 'proj'), 'ice: a tap splits it in three');
    G = special('bomb');
    Gm.step(G, { act: true }, DT);
    ok(types(G).includes('boom') && !G.bodies.some((o) => o.tag === 'proj'), 'nova: a tap detonates it');
    G = bare(); G.ammo = ['bomb', 'rock']; G.robots = 1;
    box(G, 'hull', 30, TOP + 1, 1, 2);
    fire(G, 0.55, 0.7);
    ok(runUntil(G, (g) => g.events.some((e) => e.type === 'boom'), 8), 'nova: goes off by itself a moment after it lands');

    // damage
    G = bare();
    const pane = box(G, 'glass', 30, TOP + 1, 0.4, 2);
    rock(G, 'rock', 26, TOP + 1, 22, 0);
    run(G, NONE, 0.5);
    ok(!G.bodies.includes(pane) && types(G).includes('break') && G.score >= C.MATS.glass.value, 'a rock shatters a glass pane and scores it');
    const hit = (ammo) => {
        const g = bare(); const c = box(g, 'crate', 30, TOP + 0.8, 1.6, 1.6, { asleep: true });
        rock(g, ammo, 26, TOP + 0.8, 22, 0);
        run(g, NONE, 0.25);
        return c.hp;
    };
    ok(hit('iron') < hit('rock'), 'iron hurts more than rock');
    G = bare();
    const hullBlock = box(G, 'hull', 30, TOP + 0.5, 1, 1, { asleep: true });
    rock(G, 'rock', 26, TOP + 0.5, 6, 0);
    run(G, NONE, 1);
    ok(G.bodies.includes(hullBlock) && hullBlock.hp === hullBlock.maxHp, 'a gentle bump damages nothing');
    G = bare();
    const bot1 = put(G, { kind: 'box', mat: 'robot', x: 30, y: TOP + 7, hx: 0.45, hy: 0.55, density: C.MATS.robot.density, hp: C.MATS.robot.hp, maxHp: C.MATS.robot.hp, value: 500, asleep: false });
    G.robots = 1;
    run(G, NONE, 1.2);
    ok(!G.bodies.includes(bot1) && types(G).includes('robot') && G.score >= 500, 'a robot dropped from a height is scrapped');

    // chain explosions
    G = bare();
    const fuel = box(G, 'fuel', 30, TOP + 0.8, 1.6, 1.6, { asleep: true });
    const near = box(G, 'glass', 31.8, TOP + 0.5, 0.4, 1, { asleep: true });
    const far = box(G, 'glass', 38, TOP + 0.5, 0.4, 1, { asleep: true });
    rock(G, 'iron', 25, TOP + 0.8, 28, 0);
    run(G, NONE, 0.6);
    ok(!G.bodies.includes(fuel) && types(G).includes('boom'), 'a fuel cell explodes when it breaks');
    ok(!G.bodies.includes(near) && G.bodies.includes(far), 'and takes out what is near, not what is far');

    // the void
    G = bare();
    const stray = box(G, 'crate', 18, 0, 1.6, 1.6);
    run(G, NONE, 3);
    ok(!G.bodies.includes(stray) && types(G).includes('fall') && G.score >= C.MATS.crate.value, 'a crate that falls into the void is gone, and counted');
    G = bare(); G.ammo = ['rock', 'rock']; G.robots = 1;
    fire(G, 0.1, 0.3);
    ok(runUntil(G, (g) => g.state === 'ready', 12), 'a shot into the void ends and the next is ready');

    // winning and losing
    G = Gm.newGame(1, 0);
    for (const r of G.bodies.filter((o) => o.mat === 'robot')) { r.x = 18; r.y = -8.5; r.asleep = false; }
    runUntil(G, (g) => g.over, 8);
    ok(G.over && G.won && G.stars >= 1, 'with every robot gone the sector is won');
    ok(G.score >= LEVELS[0].ammo.length * C.SCORE.spare, 'spare asteroids are banked');
    ok(types(G).includes('clear') && types(G).includes('over'), 'with clear and over events');
    const before = G.score; run(G, NONE, 1);
    ok(G.score === before, 'and the game is frozen afterwards');
    G = Gm.newGame(1, 0);
    G.ammo = ['rock']; fire(G, 0.1, 0.3);
    ok(runUntil(G, (g) => g.over, 20) && !G.won && G.state === 'lost', 'out of asteroids with robots left is a loss');

    // sleeping a bomb: a long settle never hangs
    G = Gm.newGame(1, 5);
    G.ammo = ['iron']; fire(G, 0.55, 0.75);
    ok(runUntil(G, (g) => g.over, 30), 'every shot ends: the round always finishes');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed, 1); const b = Bt.makeBot({ skill: 0.6, seed: 3 }); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 12), b = play(42, 12);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(a.shots > 0, 'and the bot really fired');

    const G = Gm.newGame(7, 2);
    const bot = Bt.makeBot({ skill: 0.6, seed: 5 });
    run(G, (g) => Bt.botInput(g, bot), 2.5);
    ok(G.state === 'flight' || G.state === 'settle', `saved in mid-action (${G.state})`);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ skill: 0.6, seed: 5 }), b2 = Bt.makeBot({ skill: 0.6, seed: 5 });
    b1.plan = bot.plan; b2.plan = bot.plan;
    b1.rng.setState(bot.rng.state()); b2.rng.setState(bot.rng.state());
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
    const t0 = Date.now();
    for (let L = 0; L < LEVELS.length; L++) {
        const results = [];
        for (const skill of [1, 0.6]) {
            const n = skill === 1 ? 1 : SEEDS;
            for (let s = 1; s <= n; s++) {
                const G = Gm.newGame(s * 7919, L);
                const bot = Bt.makeBot({ skill, seed: s });
                let bad = null, steps = 0;
                while (!G.over && steps < 120 * 150) {
                    Gm.step(G, Bt.botInput(G, bot), DT);
                    G.events.length = 0;
                    steps++;
                    for (const b of G.bodies) {
                        if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.a)) bad = 'non-finite body';
                        else if (b.x < C.KILL.xMin - 1 || b.x > C.KILL.xMax + 1 || b.y < C.KILL.yMin - 3) bad = 'a body outside the world';
                    }
                    if (bad) break;
                }
                ok(!bad, `sector ${L + 1} skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
                ok(G.over, `sector ${L + 1} skill ${skill} seed ${s}: the round ends`);
                results.push({ skill, won: G.won, stars: G.stars, score: G.score, shots: G.shots });
            }
        }
        const perfect = results.find((r) => r.skill === 1);
        ok(perfect.won, `sector ${L + 1}: the perfect bot clears it (${perfect.stars}★, ${perfect.shots} shots)`);
        const mortal = results.filter((r) => r.skill !== 1);
        rows.push({ level: L + 1, name: LEVELS[L].name, ammo: LEVELS[L].ammo.length, perfect, wins: mortal.filter((r) => r.won).length, n: mortal.length, stars: mortal.reduce((a, r) => a + r.stars, 0) / mortal.length });
    }
    console.log('  sector                 ammo  perfect (stars/shots/score)   mortal wins   mortal avg stars');
    for (const r of rows) console.log(`  ${String(r.level).padStart(2)} ${r.name.padEnd(18)} ${String(r.ammo).padStart(3)}   ${r.perfect.stars}★ ${r.perfect.shots} shots ${String(r.perfect.score).padStart(5)}           ${r.wins}/${r.n}           ${r.stars.toFixed(2)}`);
    const mortalWins = rows.reduce((a, r) => a + r.wins, 0), mortalN = rows.reduce((a, r) => a + r.n, 0);
    ok(mortalWins > 0 && mortalWins < mortalN, `a mortal bot wins some sectors and loses some (${mortalWins}/${mortalN})`);
    console.log(`  bot section took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
