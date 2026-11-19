/**
 * simtest.mjs — headless checks of Kaboom Keep's simulation. No browser.
 *
 *   node game-142/dev/simtest.mjs                 # everything (about a minute)
 *   ONLY=purity,physics,rules node game-142/dev/simtest.mjs
 *   SEEDS=3 VERBOSE=1 node game-142/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. physics: stacks and a running-bond wall stand awake; a fast ball can't tunnel through a wall;
 *    a ball grazing a block's corner still hits it (game-142's first sweep froze it in the air).
 * 3. rules: aiming, firing and reloading, picking a ball, every way to bonk, breaking and splitting,
 *    ice, crates going off in a chain, the Boom Ball, Triple Trouble, winning and losing.
 * 4. castles: every castle stands on its own with every block awake, and every flag has a pole.
 * 5. determinism: the same seed and inputs give the same game; a save round trip in the middle of
 *    a collapse plays on identically; an unknown save version is rejected.
 * 6. bot: the perfect bot clears every castle; a sloppy bot clears most; per-step invariants hold;
 *    the balance table is printed and its bands asserted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 2);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const P = await import('../js/sim/physics.js');
const { LEVELS } = await import('../js/sim/levels.js');
const { predict, solveAim, clampAim } = await import('../js/sim/aim.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false, aim: null, ammo: null };
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const evs = (G, type) => G.events.filter((e) => e.type === type);
const chars = (G) => G.W.bodies.filter((b) => b.kind === 'char');
const blocks = (G) => G.W.bodies.filter((b) => b.kind === 'block');
/** an empty game: the castle cleared away, to set up one exact situation */
function bare(level = 0) {
    const G = Gm.newGame(1, level);
    G.W.bodies = G.W.bodies.filter((b) => b.kind === 'rock');
    G.targets = 0; G.stats.total = 0; G.flags = [];
    return G;
}
/** the same, with one sleeping knight far off to the side, so the castle isn't won at once */
function bareWithBystander(level = 0) {
    const G = bare(level);
    const k = addChar(G, 'knight', [-40, 0, 5]);
    k.sl = true;
    return G;
}
const addBlock = (G, mat, p, h = [0.5, 0.25, 0.25]) => P.addBody(G.W, { kind: 'block', mat, shape: 'box', h, p, density: C.MATS[mat].density, fr: C.MATS[mat].fr, re: C.MATS[mat].re, dmg: 0, s0: [...p], knocked: false });
const addChar = (G, role, p) => { G.targets++; return P.addBody(G.W, { kind: 'char', role, name: 'Test', shape: 'box', h: [...C.CHARS[role].h], p: [p[0], p[1] + C.CHARS[role].h[1], p[2]], density: C.CHARS[role].density, fr: 0.8, re: 0.1, dmg: 0, y0: p[1], bonked: false, bT: 0 }); };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|media)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('physics')) {
    section('physics');
    const still = (W, secs) => {
        for (const b of W.bodies) b.sl = false;
        const p0 = W.bodies.map((b) => [...b.p]);
        for (let t = 0; t < secs; t += DT) P.stepWorld(W, DT);
        return Math.max(...W.bodies.map((b, i) => Math.hypot(b.p[0] - p0[i][0], b.p[1] - p0[i][1], b.p[2] - p0[i][2])));
    };
    let W = P.makeWorld();
    for (let i = 0; i < 12; i++) P.addBody(W, { h: [0.5, 0.25, 0.5], p: [0, 0.25 + i * 0.5, 0], density: 2, nosleep: true });
    ok(still(W, 4) < 0.03, 'a column of 12 slabs stands, awake, for 4 s');
    W = P.makeWorld();
    for (let y = 0; y < 12; y++) {
        let x = -4;
        for (const w of y % 2 ? [0.5, 1, 1, 1, 1, 1, 1, 1, 0.5] : [1, 1, 1, 1, 1, 1, 1, 1]) { P.addBody(W, { h: [w / 2 - 0.002, 0.25, 0.25], p: [x + w / 2, 0.25 + y * 0.5, 10], density: 2, fr: 0.7 }); x += w; }
    }
    ok(still(W, 4) < 0.03, 'a running-bond wall 8 × 12 stands, awake, for 4 s');
    ok(W.bodies.every((b) => b.sl), 'and falls asleep');
    // tunnelling: a fast ball meets a one-brick wall
    const n0 = W.bodies.length;
    const ball = P.addBody(W, { shape: 'sphere', r: 0.3, p: [0, 1.5, 0], v: [0, 1, 34], density: 9 });
    let hitWall = false;
    for (let t = 0; t < 1.2; t += DT) { const im = P.stepWorld(W, DT); if (im.some((m) => m.a === ball || m.b === ball)) hitWall = true; }
    ok(hitWall, 'a ball at 34 m/s touches a wall half a metre thick (no tunnelling)');
    ok(W.bodies.slice(0, n0).some((b) => !b.sl), 'and knocks something loose');
    // a grazing ball: aimed so the swept sphere clips a block's corner region
    W = P.makeWorld();
    const box = P.addBody(W, { h: [0.5, 0.5, 0.5], p: [0, 0.5, 10], density: 2, sl: true });
    const g = P.addBody(W, { shape: 'sphere', r: 0.3, p: [0.72, 1.2, 0], v: [0, 0, 30], density: 9 });
    let stuck = 0, last = g.p[2];
    for (let t = 0; t < 1.5; t += DT) { P.stepWorld(W, DT); if (Math.abs(g.p[2] - last) < 1e-6 && Math.hypot(...g.v) > 5) stuck++; last = g.p[2]; }
    ok(stuck < 3, `a ball grazing a block's corner is never frozen in mid-air (stuck ${stuck} steps)`);
    ok(box.p[0] !== 0 || box.p[2] !== 10 || g.p[2] > 11, 'it either clips the block or flies past');
    // determinism of the world itself
    const det = () => { const W = P.makeWorld(); for (let i = 0; i < 6; i++) P.addBody(W, { h: [0.5, 0.25, 0.25], p: [i * 0.3, 0.25 + i * 0.5, 10], density: 2 }); P.addBody(W, { shape: 'sphere', r: 0.3, p: [0, 1, 0], v: [0, 2, 30], density: 9 }); for (let i = 0; i < 200; i++) P.stepWorld(W, DT); return JSON.stringify(W.bodies.map((b) => b.p)); };
    ok(det() === det(), 'the same world steps to the same place');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // aiming
    let G = Gm.newGame(1, 0);
    const a0 = { ...G.aim };
    Gm.step(G, { ...NONE, x: 1 }, DT);
    ok(G.aim.yaw < a0.yaw, 'aim right turns the cannon right (yaw down)');
    Gm.step(G, { ...NONE, aim: { yaw: 5, pitch: -3 } }, DT);
    ok(G.aim.yaw === C.CANNON.yawMax && G.aim.pitch === C.CANNON.pitchMin, 'a direct aim is clamped to the cannon\'s limits');
    // firing and reloading
    G = Gm.newGame(1, 1);
    const shots0 = G.ammo.iron;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.ammo.iron === shots0 - 1 && G.shots === 1 && evs(G, 'fire').length === 1, 'fire spends a ball and emits fire');
    ok(G.W.bodies.some((b) => b.kind === 'ball' && b.live), 'and a live ball is in the air');
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.shots === 1, 'no second shot before the reload');
    run(G, NONE, C.CANNON.reload);
    G.events.length = 0;
    Gm.step(G, { ...NONE, ammo: 'boom' }, DT);
    ok(G.sel === 'boom' && evs(G, 'select').length === 1, 'picking a ball loads it');
    Gm.step(G, { ...NONE, ammo: 'triple' }, DT);
    ok(G.sel === 'boom', 'a ball the castle does not give you cannot be picked');
    // the last of a kind loads the next kind by itself
    G = Gm.newGame(1, 1);
    G.ammo = { iron: 1, boom: 1 }; G.sel = 'iron';
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.sel === 'boom', 'when a kind runs out the next one is loaded');
    // the dotted arc is where the ball really goes
    G = bareWithBystander(0);
    const aim = clampAim({ yaw: 0.1, pitch: 0.3 });
    const f = predict(G, aim, 'iron');
    G.aim = aim; Gm.step(G, { ...NONE, a: true }, DT);
    const ball = G.W.bodies.find((b) => b.kind === 'ball');
    let landed = null;
    for (let t = 0; t < 6 && !landed; t += DT) { Gm.step(G, NONE, DT); if (G.events.some((e) => e.type === 'impact')) landed = [...ball.p]; }
    ok(f.hit && landed && Math.hypot(landed[0] - f.hit[0], landed[2] - f.hit[2]) < 0.6, `the predicted landing spot is where the ball lands (off by ${landed && f.hit ? Math.hypot(landed[0] - f.hit[0], landed[2] - f.hit[2]).toFixed(2) : '?'} m)`);
    // solveAim hits a point
    const sol = solveAim([2, 1, 30], C.AMMO.iron.speed);
    ok(sol.length === 2 && sol[0].pitch < sol[1].pitch, 'solveAim finds a low and a high arc');

    // bonks
    G = bare(0);
    let k = addChar(G, 'knight', [0, 0, 20]);
    k.q = P.quatFromAxisAngle([0, 0, 1], 1.2);
    k.p[1] = 0.3; k.sl = false;
    Gm.step(G, NONE, DT);
    ok(k.bonked && evs(G, 'bonk')[0]?.why === 'tip', 'a knight tipped over is bonked');
    ok(G.score === C.CHARS.knight.score, 'and scores');
    G = bare(0);
    k = addChar(G, 'knight', [0, 0, 20]);
    k.dmg = 99;
    Gm.step(G, NONE, DT);
    ok(k.bonked && evs(G, 'bonk')[0]?.why === 'hit', 'a knight hit hard enough is bonked');
    G = bare(0);
    addBlock(G, 'stone', [0, 1.0, 20], [0.5, 1.0, 0.5]);
    k = addChar(G, 'knight', [6, 4, 20]);
    k.y0 = 4; k.p[1] = 4 + k.h[1]; k.sl = false;
    run(G, NONE, 2);
    ok(k.bonked, 'a knight dropped from 4 m is bonked (by the landing, or the fall)');
    run(G, NONE, C.BONK.poof + 0.5);
    ok(!G.W.bodies.includes(k) && G.events.some((e) => e.type === 'poof'), 'a bonked knight goes poof');

    // breaking
    G = bare(0);
    let b = addBlock(G, 'stone', [0, 0.25, 20]);
    b.dmg = 99;
    Gm.step(G, NONE, DT);
    ok(!G.W.bodies.includes(b) && blocks(G).length === 2 && evs(G, 'break').length === 1, 'a broken stone block splits into two pieces');
    ok(blocks(G).every((x) => x.piece && x.knocked && Math.abs(x.h[0] - 0.247) < 0.01), 'halves along its longest side, already counted as knocked');
    G = bare(0);
    b = addBlock(G, 'ice', [0, 0.25, 20]);
    b.dmg = 99;
    Gm.step(G, NONE, DT);
    ok(blocks(G).length === 0, 'ice shatters to nothing');
    G = bare(0);
    b = addBlock(G, 'stone', [0, 0.06, 20], [0.1, 0.06, 0.1]);
    b.dmg = 99;
    Gm.step(G, NONE, DT);
    ok(blocks(G).length === 0, 'a piece too small to split turns to dust');
    // knocked
    G = bare(0);
    b = addBlock(G, 'wood', [0, 0.25, 20]);
    b.p[0] = 2; b.sl = false;
    Gm.step(G, NONE, DT);
    ok(b.knocked && G.stats.knocked === 1 && G.score === Math.round(C.MATS.wood.score * C.SCORE.knock), 'a block knocked out of place scores half once');
    // crates in a chain
    G = bare(0);
    const c1 = addBlock(G, 'tnt', [0, 0.3, 20], [0.3, 0.3, 0.3]);
    addBlock(G, 'tnt', [1.5, 0.3, 20], [0.3, 0.3, 0.3]);
    addBlock(G, 'tnt', [3.0, 0.3, 20], [0.3, 0.3, 0.3]);
    const near = addBlock(G, 'wood', [0.9, 0.25, 21]);
    c1.dmg = 99;
    let booms = 0;
    for (let t = 0; t < 1.5; t += DT) { Gm.step(G, NONE, DT); booms += evs(G, 'boom').length; G.events.length = 0; }
    ok(booms === 3, `a crate that goes off sets off its neighbours in a chain (${booms} booms)`);
    ok(!G.W.bodies.includes(near) || Math.hypot(near.v[0], near.v[1], near.v[2]) > 0 || near.p[1] > 0.3 || near.knocked, 'and throws what is near');
    // the Boom Ball explodes when it hits
    G = bareWithBystander(0);
    addBlock(G, 'stone', [0, 1, 12], [2, 1, 0.25]);
    G.ammo = { boom: 1 }; G.sel = 'boom';
    G.aim = { yaw: 0, pitch: 0.02 };
    Gm.step(G, { ...NONE, a: true }, DT);
    let boom = null;
    for (let t = 0; t < 2 && !boom; t += DT) { Gm.step(G, NONE, DT); boom = evs(G, 'boom')[0]; G.events.length = 0; }
    ok(boom && boom.src === 'ball' && !G.W.bodies.some((x) => x.kind === 'ball'), 'a Boom Ball explodes on contact and is gone');
    // its trick: go off early
    G = bareWithBystander(0);
    G.ammo = { boom: 1 }; G.sel = 'boom';
    Gm.step(G, { ...NONE, a: true }, DT);
    run(G, NONE, 0.3);
    G.events.length = 0;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(evs(G, 'boom').length === 1 && G.shots === 1, 'tapping during a Boom Ball\'s flight sets it off (and fires nothing)');
    // Triple Trouble splits
    G = bareWithBystander(0);
    G.ammo = { triple: 2 }; G.sel = 'triple';
    Gm.step(G, { ...NONE, a: true }, DT);
    run(G, NONE, 0.3);
    Gm.step(G, { ...NONE, a: true }, DT);
    const balls = G.W.bodies.filter((x) => x.kind === 'ball');
    ok(balls.length === 3 && G.shots === 1 && evs(G, 'split').length === 1, 'tapping during Triple Trouble\'s flight splits it in three');
    const xs = balls.map((x) => x.p[0]).sort((p, q) => p - q);
    ok(xs[2] - xs[0] > 0.3, 'and the three fan out');
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.W.bodies.filter((x) => x.kind === 'ball').length === 3, 'a split ball has no second trick');

    // winning and losing
    G = Gm.newGame(1, 0);
    for (const c of chars(G)) c.dmg = 99;
    Gm.step(G, NONE, DT);
    ok(G.state === 'clearing' && G.events.some((e) => e.type === 'allbonked'), 'the last bonk starts the clearing beat');
    run(G, NONE, C.PLAY.clearDelay + 0.1);
    const over = G.events.find((e) => e.type === 'over');
    ok(G.over && G.won && over?.won, 'then the castle is won');
    ok(over && over.bonus === 4 * C.SCORE.spareBall && G.stars >= 1, 'with a bonus for every ball left, and at least one star');
    G = Gm.newGame(1, 0);
    G.ammo = { iron: 1 }; G.sel = 'iron';
    G.aim = { yaw: 0.6, pitch: 0.1 };            // well wide of the tower
    Gm.step(G, { ...NONE, a: true }, DT);
    run(G, NONE, 20);
    ok(G.over && !G.won && G.events.some((e) => e.type === 'over' && !e.won), 'out of balls with someone standing: the castle is lost');
}

// ======================================================================
if (want('castles')) {
    section('castles');
    for (let i = 0; i < LEVELS.length; i++) {
        const L = LEVELS[i];
        const G = Gm.newGame(1, i);
        ok(G.targets > 0, `${L.id}: has people to bonk (${G.targets})`);
        ok(G.flags.every((f) => f.body), `${L.id}: every flag stands on a block`);
        ok(Object.keys(L.ammo).every((k) => C.AMMO[k]) && L.stars && L.stars[0] < L.stars[1], `${L.id}: ammo and star thresholds are sane`);
        Gm.wakeAll(G);
        const p0 = new Map(G.W.bodies.map((b) => [b.id, [...b.p]]));
        run(G, NONE, 4);
        let maxd = 0;
        for (const b of G.W.bodies) { const q = p0.get(b.id); if (q) maxd = Math.max(maxd, Math.hypot(b.p[0] - q[0], b.p[1] - q[1], b.p[2] - q[2])); }
        ok(maxd < 0.06 && G.bonked === 0 && G.stats.broken === 0, `${L.id}: stands on its own with every block awake (moved ${maxd.toFixed(3)} m, ${G.W.bodies.length} bodies)`);
    }
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, level, secs) => { const G = Gm.newGame(seed, level); const b = Bt.makeBot({ skill: 0.7 }); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 2, 8), b = play(42, 2, 8);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    // a save round trip in the middle of a collapse
    const G = Gm.newGame(7, 1);
    G.ammo.boom = 1; G.sel = 'boom'; G.aim = { yaw: 0, pitch: 0.2 };
    Gm.step(G, { ...NONE, a: true }, DT);
    run(G, NONE, 1.3);
    const moving = G.W.bodies.filter((x) => !x.sl && !x.st).length;
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    run(G, NONE, 4);
    run(copy, NONE, 4);
    ok(moving > 20, `the save was taken mid-collapse (${moving} bodies moving)`);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(JSON.stringify(Gm.serialize(G)).length < 400000, 'a save stays small');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    const t0 = Date.now();
    const skills = [1, 0.5];
    for (let i = 0; i < LEVELS.length; i++) {
        for (const skill of skills) {
            for (let s = 1; s <= (skill === 1 ? 1 : SEEDS); s++) {
                const G = Gm.newGame(s * 7919, i);
                const bot = Bt.makeBot({ skill });
                let bad = null;
                while (!G.over && G.t < 150) {
                    Gm.step(G, Bt.botInput(G, bot), DT);
                    G.events.length = 0;
                    for (const b of G.W.bodies) if (!b.p.every(Number.isFinite) || !b.q.every(Number.isFinite)) { bad = `non-finite ${b.kind}`; break; }
                    if (G.W.bodies.length > C.BREAK.maxBodies + 40) bad = `too many bodies (${G.W.bodies.length})`;
                    if (bad) break;
                }
                ok(!bad, `${LEVELS[i].id} skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
                ok(G.over, `${LEVELS[i].id} skill ${skill} seed ${s}: the castle ends`);
                rows.push({ level: i, skill, won: G.won, score: G.score, stars: G.stars, shots: G.shots });
            }
        }
    }
    const perfect = rows.filter((r) => r.skill === 1);
    const sloppy = rows.filter((r) => r.skill !== 1);
    ok(perfect.every((r) => r.won), `the perfect bot clears every castle (${perfect.filter((r) => r.won).length}/${perfect.length})`);
    ok(perfect.filter((r) => r.stars >= 2).length >= 10, `and earns two stars or more on at least 10 (${perfect.filter((r) => r.stars >= 2).length})`);
    ok(sloppy.filter((r) => r.won).length >= sloppy.length * 0.7, `a sloppy bot (skill 0.5) clears most (${sloppy.filter((r) => r.won).length}/${sloppy.length})`);
    console.log('\n  castle         perfect: score ★ shots   skill 0.5: wins avg-score');
    for (let i = 0; i < LEVELS.length; i++) {
        const p = perfect.find((r) => r.level === i);
        const s = sloppy.filter((r) => r.level === i);
        const avg = s.filter((r) => r.won).length ? Math.round(s.filter((r) => r.won).reduce((a, r) => a + r.score, 0) / s.filter((r) => r.won).length) : 0;
        console.log(`  ${LEVELS[i].id.padEnd(14)} ${String(p.score).padStart(6)} ${p.stars} ${String(p.shots).padStart(3)}         ${s.filter((r) => r.won).length}/${s.length}  ${avg}`);
    }
    console.log(`  ${rows.length} castles played in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
