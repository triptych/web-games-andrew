/**
 * simtest.mjs — headless checks of UFOops!'s simulation. No browser.
 *
 *   node game-134/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-134/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-134/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: flying, the beam, the hold, banking and docking, the report card, getting hurt and crashing,
 *    dropping specimens (bonks, booms, the boss), every enemy's attack, jets, pickups, glitches,
 *    upgrades, retries, the ending and continues.
 * 3. data: every episode's tables name real things, and every episode is long enough to finish.
 * 4. determinism: same seed and inputs → same game; a save round trip mid-episode plays on identically.
 * 5. bot: whole games at three skill levels on SEEDS seeds with per-step invariants, the balance
 *    table, and the bands it must stay inside.
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
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const W = await import('../js/sim/world.js');
const A = await import('../js/sim/actors.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, beam: false, a: false, drop: false, cmd: null };
const inp = (o) => ({ ...NONE, ...o });
const run = (G, i, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof i === 'function' ? i(G) : i, DT); };
const has = (G, type) => G.events.some((e) => e.type === type);
/** A quiet episode in play: no walkers, no enemies, no pickups or jets coming. */
function quiet(seed = 1, lvl = 0) {
    const G = Gm.newGame(seed, lvl);
    Gm.step(G, inp({ a: true }), DT);
    G.specs = []; G.enemies = []; G.shots = []; G.jets = []; G.pickups = [];
    G.pickT = 1e9; G.jetT = 1e9; G.specT = 1e9;
    G.ufo.defects = 0; G.up.tape = 0;
    G.events.length = 0;
    return G;
}
function calm(G) {          // keep glitches out of a rule test without touching the rng stream elsewhere
    const r = G.rng;
    const f = () => 0.9999;
    Object.assign(f, r);
    G.rng = f;
    return G;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|getContext/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // ---- starting
    let G = Gm.newGame(1);
    ok(G.phase === 'brief', 'a new game opens on the episode title card');
    ok(G.specs.length === D.LEVELS[0].pop, 'the field is stocked with walkers');
    ok(G.enemies.length === D.LEVELS[0].enemies.reduce((a, [, n]) => a + n, 0), 'and the episode\'s enemies');
    run(G, NONE, 1);
    ok(G.phase === 'brief' && G.lt === 0, 'the card waits; the clock does not run');
    Gm.step(G, inp({ a: true }), DT);
    ok(G.phase === 'play' && has(G, 'go'), 'pressing the action starts the episode');

    // ---- flying
    G = calm(quiet());
    let x0 = G.ufo.x;
    run(G, inp({ x: 1 }), 1);
    ok(G.ufo.x - x0 > C.UFO.speed * 0.75, `flies right at about UFO.speed (${(G.ufo.x - x0).toFixed(2)} in 1 s)`);
    run(G, inp({ x: 1, y: 1 }), 0.4);
    ok(Math.hypot(G.ufo.vx, G.ufo.vy) <= C.UFO.speed + 1e-6, 'diagonals are no faster');
    run(G, inp({ x: 1, y: 1 }), 20);
    ok(G.ufo.x <= G.W - 1.4 + 1e-9 && G.ufo.y <= C.FLOOR + 1e-9, 'stops at the edge of the level and above the ground');
    run(G, inp({ x: -1, y: -1 }), 20);
    ok(G.ufo.x >= 1.4 - 1e-9 && G.ufo.y >= C.CEIL - 1e-9, 'and below the ceiling');

    // ---- the beam
    G = calm(quiet());
    G.ufo.x = 30; G.ufo.y = 10;
    let cow = W.spawnSpecimen(G, 'cow', 30);
    run(G, inp({ beam: true }), 0.1);
    ok(G.ufo.beam && cow.state === 'lift' && cow.y < C.GROUND, 'the beam lifts a cow standing under the saucer');
    run(G, inp({ beam: true }), 3);
    ok(G.ufo.hold.includes('cow') && !G.specs.includes(cow), 'and it ends up in the hold');
    ok(G.events.some((e) => e.type === 'catch' && e.kind === 'cow'), 'with a catch event');
    let pig = W.spawnSpecimen(G, 'pig', 36);
    run(G, inp({ beam: true }), 1);
    ok(pig.state === 'walk' || pig.state !== 'lift', 'a pig outside the cone is not lifted');
    let lifted = W.spawnSpecimen(G, 'sheep', 30);
    run(G, inp({ beam: true }), 0.3);
    const yMid = lifted.y;
    run(G, NONE, 0.05);
    ok(lifted.state === 'fall', 'letting go of the beam drops what it was lifting');
    run(G, NONE, 2);
    ok(lifted.y === C.GROUND && lifted.state !== 'fall' && yMid < C.GROUND, 'and it lands on the ground');
    ok(A.beamHalf(G, 15) > A.beamHalf(G, 11), 'the cone widens towards the ground');

    // ---- the hold
    G = calm(quiet());
    G.ufo.x = 30; G.ufo.y = 10;
    G.ufo.hold = ['cow', 'cow', 'cow', 'cow'];
    const sh = W.spawnSpecimen(G, 'chicken', 30);
    run(G, inp({ beam: true }), 2);
    ok(G.specs.includes(sh) && G.ufo.hold.length === Gm.holdCap(G), 'a full hold catches nothing more');
    ok(has(G, 'full') && sh.state === 'lift' && sh.y < 12, 'the extra one hangs under the saucer');
    G = calm(quiet());
    G.ufo.x = 10; G.ufo.y = 10;
    x0 = G.ufo.x;
    G.ufo.hold = ['cow', 'cow', 'cow', 'cow'];
    run(G, inp({ x: 1 }), 1);
    ok(G.ufo.x - x0 < C.UFO.speed * (1 - 4 * C.UFO.holdSlow) + 0.2, 'a full hold makes the saucer slower');

    // ---- energy
    G = calm(quiet());
    G.ufo.y = 10;
    run(G, inp({ beam: true }), 100 / C.BEAM.drain + 0.1);
    ok(G.ufo.lock && !G.ufo.beam && has(G, 'overheat'), 'holding the beam too long overheats it');
    run(G, inp({ beam: true }), 0.5);
    ok(!G.ufo.beam, 'an overheated beam will not come on');
    run(G, NONE, C.BEAM.relock / C.BEAM.recharge + 0.1);
    run(G, inp({ beam: true }), 0.05);
    ok(G.ufo.beam, `it comes back once the energy is at ${C.BEAM.relock}`);

    // ---- banking and docking
    G = calm(quiet());
    G.ufo.hold = ['cow', 'pig', 'chicken'];
    G.ufo.x = Gm.intakeX(G); G.ufo.y = 3;
    let s0 = G.score;
    Gm.step(G, NONE, DT);
    ok(G.ufo.hold.length === 0 && G.stats.bankedN === 3, 'flying under the Mother Ship banks the hold');
    ok(G.score - s0 === 100 + 80 + 50, 'for the specimens\' value');
    ok(!G.quotaMet && G.phase === 'play', 'three of five is not the quota, and nothing docks');
    run(G, NONE, 3);
    ok(G.phase === 'play', 'hovering there without the quota does not end the episode');
    G.ufo.hold = ['sheep', 'cow'];
    Gm.step(G, NONE, DT);
    ok(G.quotaMet && has(G, 'quota'), 'the quota is met when enough are banked');
    run(G, NONE, C.MOTHER.dockTime + 0.1);
    ok(G.phase === 'report' && G.report.success, 'holding still under Mother docks and ends the episode');
    ok(G.report.grade !== 'F' && G.report.orderMet, 'the report card grades it and the cow order is filled');
    ok(G.offers.length === 3 && new Set(G.offers).size === 3, 'three different upgrades are offered');
    const capBefore = Gm.holdCap(G);
    Gm.step(G, inp({ cmd: { t: 'upgrade', id: 'nonsense' } }), DT);
    ok(G.phase === 'report', 'an upgrade that was not offered is refused');
    G.offers = ['hold', 'hull', 'beam'];
    Gm.step(G, inp({ cmd: { t: 'upgrade', id: 'hold' } }), DT);
    ok(Gm.holdCap(G) === capBefore + 1 && G.level === 1 && G.phase === 'brief', 'choosing Roomier Hold adds a slot and the next episode starts');

    // ---- grades
    G = calm(quiet());
    G.stats.bankedN = 5; G.stats.banked = { cow: 1, pig: 1, chicken: 2, sheep: 1 }; G.stats.hits = 0;
    ok(Gm.gradeFor(G, true) === 'A+' || Gm.gradeFor(G, true) === 'A', 'no hits, four kinds and the order: an A');
    G.stats.hits = 5; G.stats.banked = { chicken: 5 };
    ok(['C', 'D'].includes(Gm.gradeFor(G, true)), 'five hits and only chickens: a C or a D');
    ok(Gm.gradeFor(G, false) === 'F', 'missing the quota is an F');

    // ---- time running out
    G = calm(quiet());
    const lives0 = G.lives;
    G.timeLeft = 0.5;
    run(G, NONE, 1);
    ok(G.phase === 'report' && !G.report.success && G.report.grade === 'F', 'the clock running out without the quota is an F');
    ok(G.lives === lives0 - 1, 'and costs a saucer');
    Gm.step(G, inp({ cmd: { t: 'next' } }), DT);
    ok(G.phase === 'brief' && G.level === 0, 'and the episode is played again');
    G = calm(quiet());
    G.timeLeft = 0.2; G.ufo.hold = ['cow', 'cow', 'cow', 'cow']; G.stats.bankedN = 1;
    run(G, NONE, 0.5);
    ok(G.phase === 'report' && G.report.success, 'at the buzzer Mother hauls up what you carry, and it counts');

    // ---- getting hurt
    G = calm(quiet());
    G.ufo.hold = ['cow', 'pig'];
    const hull0 = G.ufo.hull;
    ok(A.hurt(G, 'test'), 'a hit lands');
    ok(G.ufo.hull === hull0 - 1 && G.ufo.inv > 0, 'it costs a hull pip and makes you blink');
    ok(G.ufo.hold.length === 1 && G.specs.some((s) => s.kind === 'pig' && s.state === 'fall'), 'and knocks the last specimen loose');
    ok(G.ufo.defects === 1, 'and adds a defect');
    ok(!A.hurt(G, 'test'), 'no second hit while blinking');
    G.ufo.inv = 0; G.ufo.fx.shield = 3;
    ok(!A.hurt(G, 'test'), 'a force field blocks hits');

    // ---- crashing
    G = calm(quiet());
    G.ufo.hold = ['cow'];
    G.ufo.hull = 1;
    A.hurt(G, 'test');
    ok(G.ufo.dead > 0 && has(G, 'crash') && G.lives === C.UFO.lives - 1, 'the last pip crashes the saucer and costs a life');
    ok(G.specs.some((s) => s.kind === 'cow'), 'the hold spills out');
    run(G, NONE, C.UFO.respawn + 0.1);
    ok(G.ufo.dead <= 0 && G.ufo.hull === Gm.hullMax(G) && has(G, 'respawn'), 'a spare saucer arrives with full hull');
    G.lives = 1; G.ufo.inv = 0; G.ufo.hull = 1;
    A.hurt(G, 'test');
    run(G, NONE, C.UFO.respawn + 0.1);
    ok(G.phase === 'over' && has(G, 'over'), 'crashing the last saucer is game over');
    Gm.step(G, inp({ cmd: { t: 'continue' } }), DT);
    ok(G.phase === 'brief' && G.lives === C.UFO.lives && G.level === 0, 'Continue replays the episode with fresh saucers');

    // ---- dropping
    G = calm(quiet(1, 4));
    G.ufo.x = 30; G.ufo.y = 8; G.ufo.hold = ['cow', 'cow'];
    const tank = W.spawnEnemy(G, 'tank', 30); tank.cd = 99;
    Gm.step(G, inp({ drop: true }), DT);
    ok(G.ufo.hold.length === 1 && has(G, 'drop'), 'the drop button lets the last specimen go');
    Gm.step(G, inp({ drop: true }), DT);
    ok(G.ufo.hold.length === 1, 'not twice in a row (a short cooldown)');
    run(G, NONE, 1.2);
    ok(!G.enemies.includes(tank) && has(G, 'boom'), 'a cow dropped on a tank wrecks it');
    ok(G.specs.some((s) => s.kind === 'cow'), 'and the cow is fine');
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 8; G.ufo.hold = ['pig'];
    const gun = W.spawnEnemy(G, 'gunner', 30); gun.cd = 99;
    Gm.step(G, inp({ drop: true }), DT);
    run(G, NONE, 1.2);
    const dazed = G.specs.find((s) => s.wake === 'gunner');
    ok(!G.enemies.includes(gun) && dazed && dazed.state === 'dazed', 'a pig dropped on a shotgun farmer knocks him silly');
    run(G, NONE, C.DROP.bonkStun + 1);
    ok(!G.specs.includes(dazed) && G.enemies.some((e) => e.kind === 'gunner') && has(G, 'wake'), 'left alone, he gets back up');
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 10;
    W.spawnSpecimen(G, 'agent', 30, { state: 'dazed', daze: 5, wake: 'agent' });
    run(G, inp({ beam: true }), 3);
    ok(G.ufo.hold.includes('agent'), 'a bonked agent can be beamed up');
    ok(G.respawns.some((r) => r.kind === 'agent'), 'and HQ sends another one');

    // ---- agents and tinfoil
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 10;
    let ag = W.spawnEnemy(G, 'agent', 30); ag.cd = 99;
    run(G, inp({ beam: true }), 1);
    ok(G.enemies.includes(ag) && has(G, 'deflect'), 'the beam bounces off an agent');
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 10;
    let tf = W.spawnEnemy(G, 'tinfoil', 30); tf.cd = 99;
    const h1 = G.ufo.hull;
    run(G, inp({ beam: true }), C.BEAM.backfire + 0.05);
    ok(G.ufo.hull === h1 - 1 && has(G, 'backfire'), 'beaming a tinfoil hat backfires and zaps you');
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 10;
    tf = W.spawnEnemy(G, 'tinfoil', 31); tf.cd = 0;
    run(G, NONE, D.ENEMIES.tinfoil.windup + 0.1);
    ok(G.ufo.fx.dazzle > 0 && has(G, 'flash'), 'his camera flash dazzles you');
    x0 = G.ufo.x;
    run(G, inp({ x: 1 }), 0.5);
    ok(G.ufo.x < x0, 'and while dazzled, right goes left');

    // ---- shots
    G = calm(quiet(1, 2));
    G.ufo.x = 30; G.ufo.y = 12;
    ag = W.spawnEnemy(G, 'agent', 33); ag.cd = 0;
    run(G, NONE, 2);
    ok(has(G, 'netted') && G.ufo.fx.net > 0, 'an agent\'s net catches the saucer');
    run(G, inp({ beam: true }), 0.1);
    ok(!G.ufo.beam, 'and jams the beam');
    G = calm(quiet());
    G.ufo.x = 30; G.ufo.y = 12;
    const gn = W.spawnEnemy(G, 'gunner', 32); gn.cd = 0;
    const hb = G.ufo.hull;
    run(G, NONE, 1.5);
    ok(has(G, 'windup') && has(G, 'shot') && G.ufo.hull === hb - 1, 'a shotgun farmer winds up, fires and hits a saucer that sits still');
    G = calm(quiet());
    G.ufo.x = 30; G.ufo.y = C.CEIL;
    const gf = W.spawnEnemy(G, 'gunner', 30); gf.cd = 0;
    run(G, NONE, 2);
    ok(!has(G, 'windup'), 'but cannot reach a saucer high in the sky');
    G = calm(quiet(1, 5));
    G.ufo.x = 30; G.ufo.y = 10;
    const lz = W.spawnEnemy(G, 'laser', 40); lz.cd = 0;
    run(G, NONE, D.ENEMIES.laser.windup * 0.5);
    ok(lz.wind > 0 && Math.abs(lz.aimX - 30) < 0.01, 'a laser battery marks the column you are in');
    const hl = G.ufo.hull;
    run(G, NONE, D.ENEMIES.laser.windup);
    ok(G.ufo.hull === hl - 1 && has(G, 'laser'), 'and fires down it');
    G = calm(quiet(1, 5));
    G.ufo.x = 30; G.ufo.y = 10;
    const lz2 = W.spawnEnemy(G, 'laser', 40); lz2.cd = 0;
    run(G, NONE, 0.2);
    const hl2 = G.ufo.hull;
    run(G, inp({ x: 1 }), D.ENEMIES.laser.windup + 0.5);
    ok(G.ufo.hull === hl2, 'moving out of the marked column dodges it');

    // ---- jets
    G = calm(quiet(1, 5));
    G.ufo.x = 40; G.ufo.y = 10;
    G.jetT = 0.01;
    Gm.step(G, NONE, DT); Gm.step(G, NONE, DT);
    ok(G.jets.length === 1 && has(G, 'jetwarn'), 'a jet is announced before it arrives');
    const hj = G.ufo.hull;
    G.jets[0].y = 10;
    run(G, NONE, 3);
    ok(G.ufo.hull === hj - 1, 'and hits a saucer that stays in its lane');
    G = calm(quiet(1, 5));
    G.ufo.x = 40; G.ufo.y = 10;
    G.jetT = 0.01;
    Gm.step(G, NONE, DT); Gm.step(G, NONE, DT);
    G.jets[0].y = 10;
    const hj2 = G.ufo.hull;
    run(G, inp({ y: -1 }), 3);
    ok(G.ufo.hull === hj2, 'climbing out of the lane dodges it');

    // ---- pickups
    for (const kind of Object.keys(D.PICKUPS)) {
        G = calm(quiet());
        G.ufo.hull = 1; G.ufo.defects = 3;
        const t0 = G.timeLeft, sc = G.score;
        G.pickups.push({ id: 999, kind, x: G.ufo.x, y: G.ufo.y, life: 5 });
        Gm.step(G, NONE, DT);
        const u = G.ufo;
        const effect = { wrench: u.hull === 2, tape: u.defects === 0, turbo: u.fx.turbo > 0, mega: u.fx.mega > 0, shield: u.fx.shield > 0, clock: G.timeLeft > t0 + 10, star: G.score === sc + C.FX.star }[kind];
        ok(!G.pickups.length && has(G, 'pickup') && effect, `the ${D.PICKUPS[kind].name} pickup works`);
    }
    G = calm(quiet());
    G.ufo.x = 30; G.ufo.y = 10; G.ufo.fx.mega = 5;
    const wideMega = A.beamHalf(G, 15);
    G.ufo.fx.mega = 0;
    ok(wideMega > A.beamHalf(G, 15) * 1.4, 'Mega Beam widens the cone');
    G = calm(quiet());
    G.pickT = 0.01;
    run(G, NONE, 0.1);
    ok(G.pickups.length === 1, 'pickups turn up during an episode');
    run(G, NONE, C.PICKUP_LIFE + 1);
    ok(G.pickups.length <= 1 && !G.pickups.some((p) => p.id === 1), 'and fade if nobody takes them');

    // ---- glitches
    G = quiet();
    G.ufo.defects = 3;
    let glitches = 0;
    for (let t = 0; t < 30; t += DT) { Gm.step(G, NONE, DT); glitches += G.events.filter((e) => e.type === 'glitch').length; G.events.length = 0; G.ufo.inv = 9; }
    ok(glitches >= 3, `a saucer with three defects glitches (${glitches} in 30 s)`);
    G = quiet();
    let g0 = 0;
    for (let t = 0; t < 30; t += DT) { Gm.step(G, NONE, DT); g0 += G.events.filter((e) => e.type === 'glitch').length; G.events.length = 0; }
    ok(g0 < glitches, `a healthy one glitches less (${g0})`);
    G = calm(quiet());
    G.ufo.glitch = { kind: 'honk', t: 0.5 };
    Gm.step(G, inp({ beam: true }), DT);
    ok(!G.ufo.beam, 'a honk glitch cuts the beam');

    // ---- walkers
    G = calm(quiet(1, 1));
    G.ufo.x = 30; G.ufo.y = 10;
    const fm = W.spawnSpecimen(G, 'farmer', 33);
    run(G, inp({ beam: true }), 0.5);
    ok(fm.x > 33.5 && fm.dir === 1, 'a farmer runs from the beam');
    G = calm(quiet(1, 0));
    G.specT = 0.01;
    run(G, NONE, 20);
    ok(G.specs.length === D.LEVELS[0].pop, 'the field refills with walkers');

    // ---- the boss
    G = calm(quiet(1, 7));
    const boss = W.spawnEnemy(G, 'boss', 30);
    boss.cd = 999;
    ok(!Gm.canDock(G), 'the finale has no quota: you cannot dock while the boss stands');
    for (let i = 0; i < D.ENEMIES.boss.hp; i++) {
        G.ufo.x = boss.x; G.ufo.y = 5; G.ufo.hold = ['cow']; G.ufo.dropCd = 0; boss.inv = 0;
        Gm.step(G, inp({ drop: true }), DT);
        run(G, NONE, 1.5);
    }
    ok(G.bossDown && has(G, 'bossdown') && !G.enemies.includes(boss), `${D.ENEMIES.boss.hp} cows on the Buzzkill 9000 and it is done`);
    ok(Gm.canDock(G), 'then Mother wants you home');
    G.ufo.x = Gm.intakeX(G); G.ufo.y = 3;
    run(G, NONE, C.MOTHER.dockTime + 0.2);
    ok(G.phase === 'report' && G.report.success && G.report.last && G.offers.length === 0, 'docking ends the finale with no upgrades to pick');
    Gm.step(G, inp({ cmd: { t: 'next' } }), DT);
    ok(G.phase === 'won' && has(G, 'won'), 'and the game is won');

    // ---- upgrades
    G = Gm.newGame(3);
    const sp = (up) => { const g = calm(quiet()); Object.assign(g.up, up); const xx = g.ufo.x; run(g, inp({ x: 1 }), 0.5); return g.ufo.x - xx; };
    ok(sp({ speed: 2 }) > sp({}) * 1.1, 'Turbo Thrusters fly faster');
    G = calm(quiet());
    G.report = { success: true, last: false }; G.phase = 'report'; G.offers = ['warranty'];
    const lv = G.lives;
    Gm.step(G, inp({ cmd: { t: 'upgrade', id: 'warranty' } }), DT);
    ok(G.lives === lv + 1, 'Extended Warranty adds a spare saucer');
    G = calm(quiet());
    for (const k of Object.keys(D.UPGRADES)) G.up[k] = D.UPGRADES[k].max;
    G.stats.bankedN = 99; G.ufo.x = Gm.intakeX(G); G.ufo.y = 3;
    run(G, NONE, C.MOTHER.dockTime + 0.2);
    ok(G.phase === 'report' && G.offers.length === 0, 'with every upgrade maxed, none are offered');
    Gm.step(G, inp({ cmd: { t: 'next' } }), DT);
    ok(G.phase === 'brief' && G.level === 1, 'and Next moves on');
}

// ======================================================================
if (want('data')) {
    section('data');
    D.LEVELS.forEach((L, i) => {
        ok(Object.keys(L.spec).every((k) => D.SPECIMENS[k]), `episode ${i + 1}: every walker exists`);
        ok(L.enemies.every(([k]) => D.ENEMIES[k]), `episode ${i + 1}: every enemy exists`);
        ok(!L.order || D.SPECIMENS[L.order], `episode ${i + 1}: Mother's order is a real specimen`);
        ok(!L.order || L.spec[L.order] || L.enemies.some(([k]) => D.ENEMIES[k].bank === L.order), `episode ${i + 1}: and it can turn up`);
        ok(L.time >= L.quota * 6, `episode ${i + 1}: ${L.time} s is enough for ${L.quota} specimens`);
        ok(L.brief.length > 20 && L.title, `episode ${i + 1}: has a title and a briefing`);
    });
    ok(D.LEVELS[D.LEVELS.length - 1].boss, 'the last episode is the boss');
    for (const g of C.GRADES) ok(D.LINES.grade[g]?.length, `Mother has something to say about a ${g}`);
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 60), b = play(42, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(play(43, 20))) !== JSON.stringify(Gm.serialize(play(42, 20))), 'a different seed, a different game');

    for (const secs of [10, 45]) {
        const G = Gm.newGame(7);
        const bot = Bt.makeBot({ seed: 7 });
        run(G, (g) => Bt.botInput(g, bot), secs);
        G.events.length = 0;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
        run(G, (g) => Bt.botInput(g, b1), 20);
        run(copy, (g) => Bt.botInput(g, b2), 20);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip after ${secs} s plays on identically`);
    }
    let threw = 0;
    for (const bad of [{ v: 999 }, null, { v: 1 }, { v: 1, specs: [], ufo: {}, level: 99 }]) { try { Gm.deserialize(bad); } catch { threw++; } }
    ok(threw === 4, 'unknown or damaged saves are rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.6, 0.3]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, steps = 0;
            const grades = [];
            let fs = 0;
            while (G.phase !== 'over' && G.phase !== 'won' && steps < 120 * 60 * 30) {
                Gm.step(G, Bt.botInput(G, bot, DT), DT);
                for (const e of G.events) if (e.type === 'report') { if (e.success) grades.push(e.grade); else fs++; }
                G.events.length = 0;
                steps++;
                const u = G.ufo;
                if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.energy)) bad = 'non-finite saucer';
                else if (G.phase === 'play' && u.dead <= 0 && (u.x < 0 || u.x > G.W || u.y < C.CEIL - 1e-6 || u.y > C.FLOOR + 1e-6)) bad = 'saucer outside the level';
                else if (u.hold.length > Gm.holdCap(G)) bad = 'hold over capacity';
                else if (u.hull > Gm.hullMax(G)) bad = 'hull over max';
                else if (G.specs.some((sp) => !Number.isFinite(sp.x) || !Number.isFinite(sp.y) || sp.y > C.GROUND + 1e-6)) bad = 'a walker below the ground';
                else if (G.specs.length > 40 || G.enemies.length > 20 || G.shots.length > 80) bad = 'something piling up';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ skill, seed: s, won: G.phase === 'won', reached: G.level + 1, score: G.score, lives: G.lives, fails: fs, grades: grades.join(''), min: Math.round(steps / 120 / 60 * 10) / 10 });
        }
    }
    const by = (k) => rows.filter((r) => r.skill === k);
    const winRate = (k) => by(k).filter((r) => r.won).length / SEEDS;
    const avg = (k, f) => Math.round(by(k).reduce((a, r) => a + r[f], 0) / SEEDS * 10) / 10;
    console.log('  skill | won   | avg episode reached | avg score | avg F | minutes');
    for (const k of [1, 0.6, 0.3]) console.log(`  ${String(k).padEnd(5)} | ${(winRate(k) * 100).toFixed(0).padStart(3)}%  | ${String(avg(k, 'reached')).padStart(19)} | ${String(avg(k, 'score')).padStart(9)} | ${String(avg(k, 'fails')).padStart(5)} | ${avg(k, 'min')}`);
    if (process.env.VERBOSE) console.table(rows);
    ok(winRate(1) >= 0.75, `the perfect bot finishes the game on most seeds (${winRate(1) * 100}%)`);
    ok(winRate(0.3) < winRate(1), 'a weak bot wins less often than the perfect one');
    ok(avg(0.3, 'reached') >= 3, `a weak bot still gets a few episodes in (${avg(0.3, 'reached')})`);
    ok(by(1).every((r) => r.min < 15), 'a whole game takes under a quarter of an hour');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
