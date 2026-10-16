/**
 * simtest.mjs — headless checks of WYRMZONE's simulation. No browser.
 *
 *   node game-083/dev/simtest.mjs            # everything
 *   ONLY=purity,ground node game-083/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-083/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. world: the plain's obstacles are the same from every query, and the start is clear.
 * 3. ground: walking, turning, obstacles, fireballs and their limit, kills and the quota, every
 *    enemy's attack, grace after a hit, dying, the boss, and the ascent into Act II.
 * 4. flight: the cursor (keys and stick), fire converging on it, griffons, firebolts shot down,
 *    tower crystals, catwalk crashes, the ward stone missed and hit, the ending, continue and a
 *    second cycle.
 * 5. determinism: the same seed and inputs give the same game; a save round trip mid-game
 *    plays on identically, on foot and on the wing.
 * 6. bot: the bot plays whole games on SEEDS seeds at two skills with per-step invariants, and
 *    the balance table is printed.
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
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const W = await import('../js/sim/world.js');
const U = await import('../js/sim/util.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false, abs: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const types = (G) => G.events.map((e) => e.type);
/** A game on stage `id`, past its intro, with an empty field and no events. */
function at(id, seed = 1) {
    const G = Gm.newGame(seed, { stage: D.STAGE_INDEX[id] });
    run(G, NONE, D.BEATS.intro + 0.05);
    G.enemies = G.enemies.filter((e) => e.kind === 'dragonbane' || ['tower', 'spire', 'turret', 'wardstone'].includes(e.kind));
    G.foes.length = 0;
    G.events.length = 0;
    return G;
}
/** Put a fresh enemy of `kind` at distance d dead ahead of the walking dragon. */
function place(G, kind, d) {
    const p = G.player;
    const e = { id: 999 + G.enemies.length, kind, x: p.x + Math.sin(p.h) * d, z: p.z - Math.cos(p.h) * d, y: D.ENEMY[kind].fly || 0, h: p.h + Math.PI, ta: p.h + Math.PI, hp: D.ENEMY[kind].hp, maxHp: D.ENEMY[kind].hp, t: 0, cd: 99, hurtT: 0, speed: 0, mode: 'aim', modeT: 9, side: 1, ph: 0, tp: 99, summonT: 99, wander: 0, wanderT: 9, life: 99 };
    G.enemies.push(e);
    return e;
}
/** Move the dragon somewhere with no obstacle near it. */
function clearSpot(G) {
    const p = G.player;
    p.x = 0; p.z = 0; p.h = 0;
}

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

if (want('world')) {
    section('world');
    const seed = 4242;
    const a = W.obstaclesNear(seed, 100, -60, 80).map((o) => `${o.kind}@${o.x.toFixed(2)},${o.z.toFixed(2)}`).sort();
    const b = W.obstaclesNear(seed, 130, -40, 120).map((o) => `${o.kind}@${o.x.toFixed(2)},${o.z.toFixed(2)}`);
    ok(a.length > 5, `the plain has obstacles (${a.length} near one spot)`);
    ok(a.every((k) => b.includes(k)), 'the same obstacles come back from an overlapping query');
    let clear = true;
    for (let s = 1; s < 60; s++) if (W.obstacleAt(s * 977, 0, 0, C.GROUND.radius + 1)) clear = false;
    ok(clear, 'the dragon never starts inside an obstacle');
    const body = { x: 0, z: 0 };
    const o = W.obstaclesNear(seed, 0, 0, 80)[0];
    Object.assign(body, { x: o.x + 0.1, z: o.z });
    W.pushOut(seed, body, 1);
    ok(Math.hypot(body.x - o.x, body.z - o.z) >= o.r + 1 - 1e-6, 'pushOut moves a body clear of an obstacle');
}

if (want('ground')) {
    section('ground');
    let G = at('march1');
    clearSpot(G);
    ok(G.mode === 'ground' && G.phase === 'play', 'a new game starts on foot, in play after the intro');
    run(G, { x: 0, y: -1, a: false }, 0.5);
    ok(Math.abs(G.player.z - -C.GROUND.speed * 0.5) < 0.2 || G.events.some((e) => e.type === 'bump'), 'walks forward (−z at heading 0) at GROUND.speed');
    G = at('march1'); clearSpot(G);
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(Math.abs(G.player.h - C.GROUND.turn * 0.5) < 0.02, 'turns right at GROUND.turn');
    ok(U.bearing(0, 0, 0, 5, -5) > 0 && U.bearing(0, 0, 0, -5, -5) < 0, 'bearing: + is to the right');

    // obstacles block
    G = at('march1');
    const ob = W.obstaclesNear(G.seed, 0, 0, 80)[0];
    G.player.x = ob.x; G.player.z = ob.z + ob.r + 4; G.player.h = 0;
    run(G, { x: 0, y: -1, a: false }, 2);
    ok(Math.hypot(G.player.x - ob.x, G.player.z - ob.z) >= ob.r + C.GROUND.radius - 0.05, 'standing stones block the dragon');

    // fireballs: two at once
    G = at('march1'); clearSpot(G);
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(G.shots.length === 1 && types(G).includes('fire'), 'fire breathes a fireball');
    for (let i = 0; i < 200; i++) Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(G.shots.length <= C.GROUND.maxShots, `no more than ${C.GROUND.maxShots} fireballs in the air`);

    // a kill counts toward the quota and scores
    G = at('march1'); clearSpot(G);
    const fm = place(G, 'footman', 20);
    if (W.obstacleAt(G.seed, fm.x, fm.z, 2)) { fm.x = 0; fm.z = -10; }
    G.events.length = 0;
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    run(G, NONE, 0.6);
    ok(G.stageKills === 1 && G.score >= D.ENEMY.footman.score, 'a fireball kills a footman and counts it');
    ok(G.events.some((e) => e.type === 'kill' && e.kind === 'footman'), 'and emits a kill event');

    // trolls take three hits
    G = at('march1'); clearSpot(G);
    const tr = place(G, 'troll', 9);
    tr.z = -9; tr.x = 0;
    for (let i = 0; i < 3; i++) { G.player.cd = 0; Gm.step(G, { x: 0, y: 0, a: true }, DT); run(G, NONE, 0.2); tr.x = 0; tr.z = -9; tr.cd = 9; }
    ok(tr.dead && G.events.filter((e) => e.type === 'hit').length >= 2, 'a troll takes three fireballs');

    // each attack hurts, and grace follows
    const attacks = [['ballista', 'bolt'], ['footman', 'spear'], ['wizard', 'orb'], ['juggernaut', 'bolt']];
    for (const [kind, foe] of attacks) {
        G = at('march1'); clearSpot(G);
        const e = place(G, kind, 26);
        e.x = 0; e.z = -26; e.h = 0 + Math.PI; e.cd = 0; e.mode = 'aim'; e.modeT = 99;
        run(G, NONE, 4);
        ok(G.events.some((v) => v.type === 'enemyFire' && v.foe === foe), `a ${kind} fires a ${foe}`);
        ok(G.events.some((v) => v.type === 'hurt' && v.by === foe), `the ${foe} hurts a dragon that stands still`);
    }
    G = at('march1'); clearSpot(G);
    const ln = place(G, 'lancer', 40);
    run(G, NONE, 6);
    ok(G.events.some((v) => v.type === 'hurt' && v.by === 'lancer') && ln.dead, 'a lancer charges home, hurts, and is spent');
    G = at('march1'); clearSpot(G);
    place(G, 'troll', 12).cd = 0;
    run(G, NONE, 5);
    ok(G.events.some((v) => v.type === 'hurt' && v.by === 'troll'), 'a troll smashes a dragon in reach');

    G = at('march1'); clearSpot(G);
    const s0 = G.scales;
    G.foes.push({ id: 1, kind: 'bolt', x: 0, y: 1.4, z: -3, vx: 0, vy: 0, vz: 30, life: 2, r: 0.6 });
    G.foes.push({ id: 2, kind: 'bolt', x: 0, y: 1.4, z: -4, vx: 0, vy: 0, vz: 30, life: 2, r: 0.6 });
    run(G, NONE, 0.3);
    ok(G.scales === s0 - 1, 'grace after a hit: two bolts at once cost one scale');

    // wizards' orbs can be shot down
    G = at('march1'); clearSpot(G);
    G.foes.push({ id: 3, kind: 'orb', x: 0, y: 1.4, z: -12, vx: 0, vy: 0, vz: 1, life: 9, r: 0.9 });
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    run(G, NONE, 0.8);
    ok(G.events.some((e) => e.type === 'foeShot' && e.kind === 'orb'), 'a fireball knocks an orb out of the air');

    // the quota ends the march
    G = at('march1'); clearSpot(G);
    G.stageKills = D.STAGES[0].quota;
    run(G, NONE, 0.1);
    ok(G.phase === 'clear' && G.events.some((e) => e.type === 'clear'), 'meeting the quota clears the march');
    run(G, NONE, D.BEATS.clear + 0.1);
    ok(G.stageIdx === 1 && G.phase === 'intro', 'and the next march begins');

    // death
    G = at('march2'); clearSpot(G);
    G.scales = 1;
    G.foes.push({ id: 4, kind: 'bolt', x: 0, y: 1.4, z: -3, vx: 0, vy: 0, vz: 30, life: 2, r: 0.6 });
    run(G, NONE, 0.2);
    ok(G.phase === 'dead' && G.events.some((e) => e.type === 'dead'), 'the last scale lost: the dragon falls');
    run(G, NONE, D.BEATS.dead + 0.2);
    ok(G.over && !G.won, 'then the game is over');
    const before = G.stageScore;
    ok(Gm.continueGame(G) && !G.over && G.scales === C.SCALES && G.score === before && G.stageIdx === 1 && G.continues === 1, 'continue: the same march, full scales, its starting score');

    // the boss
    G = Gm.newGame(5, { stage: D.STAGE_INDEX.boss });
    const boss = G.enemies.find((e) => e.kind === 'dragonbane');
    ok(boss && boss.hp === D.ENEMY.dragonbane.hp, 'the Dragonbane waits at the end of the King\'s Road');
    run(G, NONE, D.BEATS.intro + 6);
    ok(G.events.some((e) => e.type === 'enemyFire' && e.kind === 'dragonbane'), 'it fires volleys');
    G.scales = C.SCALES;
    run(G, NONE, 12);
    ok(G.events.some((e) => e.type === 'spawn' && e.add), 'and summons footmen');
    G.over = false; G.phase = 'play'; G.scales = C.SCALES; G.player.inv = 0;
    for (const e of G.enemies) if (e.kind === 'dragonbane') e.hp = 1;
    const bb = G.enemies.find((e) => e.kind === 'dragonbane');
    G.shots.push({ x: bb.x, y: 1.2, z: bb.z + 0.1, vx: 0, vz: 0, life: 1 });
    run(G, NONE, 0.05);
    ok(G.phase === 'clear' && !G.enemies.some((e) => e.add), 'breaking it clears the stage; its footmen flee');
    run(G, NONE, D.BEATS.clear + 0.05);
    ok(G.phase === 'ascend' && G.events.some((e) => e.type === 'ascend'), 'then the dragon\'s wings return');
    run(G, NONE, D.BEATS.ascend + 0.05);
    ok(G.mode === 'flight' && D.STAGES[G.stageIdx].id === 'sky', 'and Act II begins in the open sky');
}

if (want('flight')) {
    section('flight');
    let G = at('sky');
    const T = C.TRACKS.sky;
    ok(G.mode === 'flight' && G.fl.dist > 0, 'flying: the dragon moves forward on its own');
    run(G, { x: 1, y: 0, a: false, abs: false }, 0.3);
    ok(Math.abs(G.player.ax - C.FLIGHT.keyRate * 0.3) < 0.03, 'keys push the cursor');
    run(G, { x: -0.5, y: -1, a: false, abs: true }, 1.2);
    ok(Math.abs(G.player.ax + 0.5) < 0.02 && Math.abs(G.player.ay - 1) < 0.02, 'a stick places the cursor (y up is up)');
    run(G, { x: -0.5, y: -1, a: false, abs: true }, 3);
    ok(Math.abs(G.player.px - -0.5 * T.latX) < 0.5 && Math.abs(G.player.py - (T.base + T.latY)) < 0.5, 'the body follows the cursor');

    // fire converges on the cursor: a shot passes through the aim point
    G = at('sky');
    G.player.ax = 0.6; G.player.ay = -0.4;
    Gm.step(G, { x: 0, y: 0, a: true, abs: false }, DT);
    const s = G.shots[0];
    const aim = (await import('../js/sim/flight.js')).aimPoint(G, 70);
    const rel = (q) => ({ x: q.x, y: q.y, z: q.z - G.fl.dist });
    const sr = rel(s), ar = rel(aim);
    const vrx = s.vx, vry = s.vy, vrz = s.vz - C.FLIGHT.speed;
    const k = (ar.z - sr.z) / vrz;
    ok(Math.hypot(sr.x + vrx * k - ar.x, sr.y + vry * k - ar.y) < 0.25, 'fire converges on the cursor');

    // a griffon in the line of fire dies
    G = at('sky');
    G.player.ax = 0; G.player.ay = 0;
    G.enemies.push({ id: 900, kind: 'griffon', x: G.player.px, y: G.player.py, z: G.fl.dist + 80, vx: 0, vy: 0, vz: 0, t: 0, cd: 99, hp: 1, maxHp: 1, hurtT: 0, mode: 'hold', cx: G.player.px, cy: G.player.py, hd: 80, A: 0, B: 0, C: 0, w1: 0, w2: 0, w3: 0, holdT: 99, ph: 0, side: 1 });
    Gm.step(G, { x: 0, y: 0, a: true, abs: true }, DT);
    run(G, { x: 0, y: 0, a: false, abs: true }, 0.6);
    ok(G.events.some((e) => e.type === 'kill' && e.kind === 'griffon') && G.stageKills === 1, 'fire brings down a griffon knight');

    // firebolts hurt, and can be shot down
    G = at('sky');
    G.foes.push({ id: 5, kind: 'firebolt', x: G.player.px, y: G.player.py, z: G.fl.dist + 30, vx: 0, vy: 0, vz: 0, life: 5, r: 1.3 });
    run(G, { x: 0, y: 0, a: false, abs: true }, 1.2);
    ok(G.events.some((e) => e.type === 'hurt' && e.by === 'firebolt'), 'a firebolt hurts the dragon');
    G = at('sky');
    G.foes.push({ id: 6, kind: 'firebolt', x: G.player.px, y: G.player.py, z: G.fl.dist + 90, vx: 0, vy: 0, vz: C.FLIGHT.speed - 10, life: 5, r: 1.3 });
    Gm.step(G, { x: 0, y: 0, a: true, abs: true }, DT);
    run(G, { x: 0, y: 0, a: false, abs: true }, 0.5);
    ok(G.events.some((e) => e.type === 'foeShot' && e.kind === 'firebolt'), 'fire knocks a firebolt out of the air');

    G = at('sky');
    G.stageKills = D.STAGES[D.STAGE_INDEX.sky].quota;
    run(G, NONE, 0.05);
    ok(G.phase === 'clear', 'the sky is won at its quota');

    // ramparts: crystals and the end of the track
    G = at('ramparts');
    ok(G.fl.towers > 10 && G.enemies.filter((e) => e.kind === 'tower' || e.kind === 'spire').length === G.fl.towers, `the ramparts stand ${G.fl.towers} towers`);
    const tw = G.enemies.find((e) => e.kind === 'tower');
    G.shots.push({ x: tw.x, y: tw.y, z: tw.z - 1, vx: 0, vy: 0, vz: 100, life: 1 });
    Gm.step(G, NONE, DT);
    ok(tw.dead && G.fl.towersDown === 1, 'a fireball on a tower\'s crystal burns the tower');
    const shaft = G.enemies.find((e) => e.kind === 'tower' && !e.dead);
    G.shots.push({ x: shaft.x, y: 2, z: shaft.z - 1.5, vx: 0, vy: 0, vz: 100, life: 1 });
    Gm.step(G, NONE, DT);
    ok(!shaft.dead && G.shots.length === 0, 'fire on the shaft is wasted');
    G.player.inv = 0;
    G.player.px = shaft.x; G.player.py = 2;
    G.fl.dist = shaft.z - 1;
    Gm.step(G, { x: shaft.x / C.TRACKS.ramparts.latX, y: 1, a: false, abs: true }, DT);
    ok(G.events.some((e) => e.type === 'crash' && e.kind === 'tower'), 'flying into a tower crashes');
    G.fl.dist = G.fl.len;
    run(G, NONE, 0.05);
    ok(G.phase === 'clear', 'the ramparts end at the end of the track');

    // gorge: chains, the ward stone
    G = at('gorge');
    const w = G.fl.walks[0];
    ok(G.fl.walks.length >= 5 && G.enemies.some((e) => e.kind === 'wardstone'), 'the gorge has chains, wall ballistae and a ward stone');
    G.player.inv = 0;
    G.fl.dist = w.z - 2;
    G.player.py = w.y; G.player.ay = (w.y - C.TRACKS.gorge.base) / C.TRACKS.gorge.latY;
    run(G, { x: 0, y: -G.player.ay, a: false, abs: true }, 0.2);
    ok(G.events.some((e) => e.type === 'crash' && e.kind === 'catwalk'), 'flying into the chains crashes');
    const safe = w.y < 7 ? w.y + 6 : w.y - 6;
    const G2 = at('gorge');
    G2.player.inv = 0;
    G2.fl.dist = w.z - 2;
    G2.player.py = safe; G2.player.ay = (safe - C.TRACKS.gorge.base) / C.TRACKS.gorge.latY;
    run(G2, { x: 0, y: -G2.player.ay, a: false, abs: true }, 0.2);
    ok(!G2.events.some((e) => e.type === 'crash'), 'flying over or under them is safe');
    ok(Math.abs(safe - C.TRACKS.gorge.base) <= C.TRACKS.gorge.latY, 'every chain can be passed within the dragon\'s reach');

    G = at('gorge');
    G.fl.dist = G.fl.len - 6;
    G.player.inv = 0;
    const sc = G.scales;
    run(G, NONE, 0.1);
    ok(G.events.some((e) => e.type === 'missed') && G.fl.dist < G.fl.len - 400 && G.scales === sc - 1, 'missing the ward stone costs a scale and the end of the gorge');

    G = at('gorge');
    G.fl.dist = G.fl.len - 120;
    G.player.ax = 0; G.player.ay = (10 - C.TRACKS.gorge.base) / C.TRACKS.gorge.latY;
    G.player.py = 10; G.player.px = 0;
    for (let i = 0; i < 30 && G.phase === 'play'; i++) Gm.step(G, { x: 0, y: -G.player.ay, a: true, abs: true }, DT);
    run(G, { x: 0, y: -G.player.ay, a: false, abs: true }, 0.5);
    ok(G.events.some((e) => e.type === 'gate') && G.phase === 'clear', 'a fireball on the ward stone breaks the gate');
    G.scales = 3;
    run(G, NONE, D.BEATS.clear + 0.1);
    ok(G.over && G.won && G.events.some((e) => e.type === 'victory'), 'and the dragon flies home: the game is won');
    const sc2 = G.score;
    ok(Gm.nextCycle(G) && G.loop === 1 && G.stageIdx === 0 && G.mode === 'ground' && G.score === sc2, 'a second cycle starts on foot, keeping the score');
    ok(!Gm.continueGame(G), 'continue does nothing while the game runs');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, stage, secs) => { const G = Gm.newGame(seed, { stage }); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    for (const stage of [0, D.STAGE_INDEX.sky, D.STAGE_INDEX.gorge]) {
        const a = play(42, stage, 15), b = play(42, stage, 15);
        ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), `same seed and inputs, same game (stage ${D.STAGES[stage].id})`);
        const G = Gm.newGame(7, { stage });
        const bot = Bt.makeBot();
        run(G, (g) => Bt.botInput(g, bot), 10);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 3 }), b2 = Bt.makeBot({ seed: 3 });
        run(G, (g) => Bt.botInput(g, b1), 10);
        run(copy, (g) => Bt.botInput(g, b2), 10);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip plays on identically (stage ${D.STAGES[stage].id})`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.6]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null;
            const reached = new Set();
            while (!G.over && G.t < 1500) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                reached.add(G.stageIdx);
                const p = G.player;
                const nums = [p.x, p.z, p.h, p.px, p.py, p.ax, p.ay, G.score];
                if (!nums.every(Number.isFinite)) bad = 'non-finite state';
                else if (G.scales < 0 || G.scales > C.SCALES) bad = 'scales out of range';
                else if (Math.abs(p.ax) > 1 + 1e-9 || Math.abs(p.ay) > 1 + 1e-9) bad = 'cursor out of range';
                else if (G.mode === 'ground' && W.obstacleAt(G.seed, p.x, p.z, C.GROUND.radius - 0.05)) bad = 'inside an obstacle';
                else if (G.enemies.length > 70 || G.foes.length > 80) bad = `runaway spawning (${G.enemies.length} enemies, ${G.foes.length} missiles)`;
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, won: G.won, stage: D.STAGES[G.stageIdx].id, reached: reached.size, score: G.score, hits: G.hits, t: G.t });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const wins = (k) => of(k).filter((r) => r.won).length;
    const avg = (k, f) => Math.round(of(k).reduce((a, r) => a + r[f], 0) / of(k).length);
    console.log('  skill  wins  avg score  avg hits  avg time  where the losers fell');
    for (const k of [1, 0.6]) {
        const fell = of(k).filter((r) => !r.won).map((r) => r.stage).join(' ') || '-';
        console.log(`  ${String(k).padEnd(5)}  ${wins(k)}/${SEEDS}   ${String(avg(k, 'score')).padStart(8)}  ${String(avg(k, 'hits')).padStart(8)}  ${String(avg(k, 't')).padStart(7)}s  ${fell}`);
    }
    ok(wins(1) >= Math.ceil(SEEDS * 0.6), `the perfect bot gets home on most seeds (${wins(1)}/${SEEDS})`);
    ok(avg(1, 'score') > avg(0.6, 'score'), 'a better bot scores more');
    ok(avg(1, 'hits') < avg(0.6, 'hits'), 'and takes fewer hits');
    ok(of(1).every((r) => r.won || r.reached >= 4), 'even a perfect bot\'s losses come late, not on the first march');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
