/**
 * simtest.mjs — plays every wave headlessly with the bot, in Node (no browser).
 *
 *   node game-069/dev/simtest.mjs
 *
 * Fails on an exception, a NaN anywhere in the moving parts, something outside
 * the field, or a wave the bot can't finish within the time budget (continues
 * are used as a player would). Also checks the rules the design depends on:
 * colonists are abducted, rescued and lost; the planet can die and is rebuilt
 * after a boss; meteors split; hives burst; squadrons dive; bosses phase.
 * Env: DIFF=cadet|arcade (default arcade), WAVES=0,4,9, LOOPS=2, SEEDS=2, GOD=1, VERBOSE=1.
 */
import { World, newSession } from '../js/sim/world.js';
import { Bot } from '../js/sim/bot.js';
import { WAVES } from '../js/sim/waves.js';
import { spawnMeteor } from '../js/sim/enemies.js';
import { SIM_DT, WORLD_W, FIELD } from '../js/config.js';

const DIFF = process.env.DIFF || 'arcade';
const LOOPS = +(process.env.LOOPS || 2);
const SEEDS = +(process.env.SEEDS || 2);
const ONLY = process.env.WAVES ? process.env.WAVES.split(',').map(Number) : null;
const GOD = !!process.env.GOD;
const VERBOSE = !!process.env.VERBOSE;
const BUDGET = 60 * 7;   // sim seconds per wave

const fails = [];
const finite = (v) => Number.isFinite(v);
const seen = new Set();

function check(w) {
    const bad = [];
    const s = w.ship;
    if (!finite(s.x) || !finite(s.y) || !finite(s.vx)) bad.push('ship');
    if (s.x < 0 || s.x >= WORLD_W) bad.push(`ship x ${s.x}`);
    if (s.y < FIELD.floor - 0.01 || s.y > FIELD.top) bad.push(`ship y ${s.y}`);
    for (const e of w.enemies) {
        if (!finite(e.x) || !finite(e.y)) bad.push('enemy ' + e.kind);
        else if (e.x < 0 || e.x >= WORLD_W) bad.push(`enemy ${e.kind} x ${e.x}`);
        else if (e.y < -20 || e.y > 320) bad.push(`enemy ${e.kind} y ${e.y.toFixed(1)}`);
    }
    for (const b of w.shots) if (!finite(b.x) || !finite(b.y)) bad.push('shot');
    for (const c of w.colonists) if (!finite(c.x) || !finite(c.y)) bad.push('colonist');
    if (!finite(w.session.score)) bad.push('score');
    if (w.session.colonists !== (w.planetAlive ? w.colonists.length : 0) && w.planetAlive) bad.push(`colonist count ${w.session.colonists} vs ${w.colonists.length}`);
    return bad;
}

function playWave(wave, loop, seed, S = null) {
    S = S || newSession(DIFF, wave);
    S.wave = wave; S.loop = loop;
    const w = new World(S, { seed, god: GOD });
    const bot = new Bot(1);
    let t = 0, deaths = 0, conts = 0;
    while (t < BUDGET) {
        w.step(SIM_DT, bot.decide(w, SIM_DT));
        for (const e of w.events) { seen.add(e.type); if (e.type === 'playerDie') deaths++; if (e.type === 'bossPhase') seen.add('phase:' + w.def.boss); }
        w.events.length = 0;
        t += SIM_DT;
        if (Math.round(t / SIM_DT) % 30 === 0) {
            const bad = check(w);
            if (bad.length) return { ok: false, why: `invalid at t=${t.toFixed(1)}: ${[...new Set(bad)].slice(0, 6).join(', ')}` };
        }
        if (w.state === 'gameover') { conts++; w.continueGame(); }
        if (w.state === 'done') return { ok: true, t, deaths, conts, score: S.score, col: S.colonists, planet: S.planetAlive, stats: w.stats, S };
    }
    return { ok: false, why: `not cleared in ${BUDGET}s (state ${w.state}, ${w.enemiesLeft()} left${w.boss ? `, boss ${w.boss.hp}/${w.boss.hpMax}` : ''})` };
}

const t0 = Date.now();
for (let loop = 0; loop < LOOPS; loop++) {
    for (let i = 0; i < WAVES.length; i++) {
        if (ONLY && !ONLY.includes(i)) continue;
        for (let s = 0; s < SEEDS; s++) {
            const seed = 1000 + i * 31 + s * 7 + loop * 101;
            let r;
            try { r = playWave(i, loop, seed); }
            catch (e) { r = { ok: false, why: 'exception: ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ') }; }
            const name = `L${loop + 1} W${String(i + 1).padStart(2)} ${WAVES[i].name.padEnd(14)} seed ${seed}`;
            if (r.ok) console.log(`  ok   ${name}  ${r.t.toFixed(0).padStart(4)}s  deaths ${String(r.deaths).padStart(2)}  cont ${r.conts}  score ${String(r.score).padStart(6)}  colonists ${r.col}${r.planet ? '' : ' (planet lost)'}  rescued ${r.stats.rescued}`);
            else { console.log(`  FAIL ${name}  ${r.why}`); fails.push(`${name}: ${r.why}`); }
        }
    }
}

// a whole loop in a row, carrying the session: colonists persist, the planet is rebuilt after bosses
if (!ONLY) {
    const S = newSession(DIFF, 0);
    let ok = true, rebuilt = false;
    for (let i = 0; i < WAVES.length && ok; i++) {
        const before = S.colonists;
        const r = playWave(i, 0, 7000 + i, S);
        if (!r.ok) { ok = false; fails.push(`run W${i + 1}: ${r.why}`); console.log(`  FAIL run W${i + 1} ${r.why}`); break; }
        if (i % 5 === 0 && i > 0 && S.colonists >= before) rebuilt = true;
        if (VERBOSE) console.log(`  run W${i + 1} score ${S.score} colonists ${S.colonists} lives ${S.lives} bombs ${S.bombs}`);
    }
    if (ok) console.log(`  ok   a full loop in one session: score ${S.score}, ${S.continues} continues, colonists ${S.colonists}`);
    if (ok && !rebuilt && S.colonists < 10) console.log('  note: rebuild not observed (no colonists were lost before a rebuild)');
}

// ------------------------------------------------------------------ rules
function rule(name, fn) {
    try { const why = fn(); if (why) { fails.push(`rule ${name}: ${why}`); console.log(`  FAIL rule ${name}: ${why}`); } else console.log(`  ok   rule ${name}`); }
    catch (e) { fails.push(`rule ${name}: ${e.message}`); console.log(`  FAIL rule ${name}: ${e.stack}`); }
}
const run = (w, secs, inp = {}) => { for (let t = 0; t < secs; t += SIM_DT) w.step(SIM_DT, inp); };
rule('losing every colonist destroys the planet and turns snatchers into ravagers', () => {
    const S = newSession('arcade', 1);
    const w = new World(S, { seed: 3, god: true });
    run(w, 4);
    for (const c of [...w.colonists]) w.killColonist(c, 'test');
    if (w.planetAlive || S.planetAlive) return 'planet still alive';
    run(w, 1);
    if (w.enemies.some((e) => e.kind === 'snatcher' && e.warp <= 0)) return 'a snatcher survived the planet';
    if (!w.events.some((e) => e.type === 'planetDie')) return 'no planetDie event';
    const S2 = { ...S, wave: 2 };
    const w2 = new World(S2, { seed: 4 });
    if (w2.planetAlive || w2.colonists.length) return 'planet came back before a boss';
    const S3 = { ...S, wave: 5 };
    const w3 = new World(S3, { seed: 5 });
    if (!w3.planetAlive || w3.colonists.length !== 10) return 'planet not rebuilt after the boss';
    return null;
});
rule('a colonist dropped high dies, dropped low lands, caught scores 500 and set down scores 500', () => {
    const S = newSession('arcade', 0);
    const w = new World(S, { seed: 9, god: true });
    run(w, 2);
    const [a, b, c] = w.colonists;
    a.state = 'grabbed'; a.y = 200; w.dropColonist(a);
    b.state = 'grabbed'; b.y = 60; w.dropColonist(b);
    run(w, 5);
    if (a.state !== 'dead' && w.colonists.includes(a)) return 'high fall survived';
    if (b.state !== 'walk') return `low fall: ${b.state}`;
    const s = w.ship;
    s.x = c.x; s.y = 140; c.state = 'grabbed'; c.x = s.x; c.y = 150; w.dropColonist(c);
    const before = S.score;
    run(w, 0.6);
    if (c.state !== 'carried') return `not caught: ${c.state} y ${c.y.toFixed(1)}`;
    if (S.score - before < 500) return 'no catch score';
    run(w, 3, { ay: -1 });
    if (c.state !== 'walk') return `not set down: ${c.state}`;
    if (S.score - before < 1000) return 'no set-down score';
    return null;
});
rule('meteors split big → medium → small and score 20 / 50 / 100', () => {
    const S = newSession('arcade', 3);
    const w = new World(S, { seed: 11, god: true });
    run(w, 2.5);
    const m = spawnMeteor(w, 3, w.ship.x + 100, 150, 0, -10);
    const before = S.score;
    w.kill(m, 'laser');
    const kids = w.enemies.filter((e) => e.alive && e.kind === 'meteor' && e.size === 2);
    if (kids.length !== 2) return `big split into ${kids.length}`;
    w.kill(kids[0], 'laser');
    const sm = w.enemies.filter((e) => e.alive && e.kind === 'meteor' && e.size === 1);
    if (sm.length !== 2) return `medium split into ${sm.length}`;
    w.kill(sm[0], 'laser');
    if (S.score - before !== 170) return `scored ${S.score - before}, want 170`;
    return null;
});
rule('smart bomb clears the screen and costs a bomb', () => {
    const S = newSession('arcade', 1);
    const w = new World(S, { seed: 21, god: true });
    run(w, 8);
    const s = w.ship;
    for (let i = 0; i < 5; i++) w.enemies.push({ id: 900 + i, kind: 'snatcher', x: s.x + 40 + i * 10, y: 120, r: 8, hp: 1, alive: true, warp: 0, t: 0, vx: 0, vy: 0, fireT: 9 });
    const bombs = S.bombs;
    w.step(SIM_DT, { bomb: true });
    run(w, 0.3);
    if (S.bombs !== bombs - 1) return 'bomb not spent';
    if (w.enemies.some((e) => e.alive && e.id >= 900 && e.id < 905)) return 'enemies survived';
    return null;
});

const want = ['abduct', 'catch', 'explode', 'hiveBurst', 'dive', 'bossDie', 'phase:harvester', 'phase:leviathan', 'phase:overseer', 'bomb', 'waveClear', 'mine', 'tractor', 'beamFire'];
for (const k of want) if (!ONLY && !seen.has(k)) { fails.push(`never saw event ${k}`); console.log(`  FAIL never saw event ${k}`); }

console.log(`\n${fails.length ? 'FAILED' : 'PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fails.length) { for (const f of fails) console.log(' - ' + f); process.exit(1); }
