/**
 * simtest.mjs — plays every stage headlessly with the bot, in Node (no browser).
 *
 *   node game-060/dev/simtest.mjs
 *
 * Fails on an exception, a NaN anywhere in the moving parts, or a stage the bot
 * can't finish within the time budget (continues are used as a player would).
 * Env: DIFF=cadet|arcade (default arcade), STAGES=0,3,7, LOOPS=2, SEEDS=2, GOD=1, VERBOSE=1.
 */
import { World, newSession } from '../js/sim/world.js';
import { Bot } from '../js/sim/bot.js';
import { STAGES } from '../js/sim/levels.js';
import { SIM_DT } from '../js/config.js';

const DIFF = process.env.DIFF || 'arcade';
const LOOPS = +(process.env.LOOPS || 2);
const SEEDS = +(process.env.SEEDS || 2);
const ONLY = process.env.STAGES ? process.env.STAGES.split(',').map(Number) : null;
const GOD = !!process.env.GOD;
const BUDGET = 60 * 8;   // sim seconds per stage

const fails = [];
const finite = (v) => Number.isFinite(v);

function check(w) {
    const bad = [];
    if (!finite(w.paddle.x)) bad.push('paddle.x');
    for (const b of w.balls) if (!finite(b.x) || !finite(b.y) || !finite(b.vx) || !finite(b.vy)) bad.push('ball');
    for (const b of w.bullets) if (!finite(b.x) || !finite(b.y)) bad.push('bullet');
    for (const s of w.slots) if (s.alive && (!finite(s.x) || !finite(s.y))) bad.push('slot ' + s.kind);
    for (const e of w.free) if (e.alive && (!finite(e.x) || !finite(e.y))) bad.push('free ' + e.kind);
    for (const b of w.balls) if (!b.stuck && !b.captured && (b.y > 330 || b.x < -5 || b.x > 245)) bad.push(`ball out of field ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    if (!finite(w.session.score)) bad.push('score');
    return bad;
}

function playStage(stage, loop, seed) {
    const S = newSession(DIFF, stage);
    S.loop = loop;
    const w = new World(S, { seed, god: GOD });
    const bot = new Bot(1);
    let t = 0, deaths = 0, conts = 0, evCount = 0;
    const kinds = new Set();
    while (t < BUDGET) {
        w.step(SIM_DT, bot.decide(w, SIM_DT));
        for (const e of w.events) { kinds.add(e.type); if (e.type === 'playerDie') deaths++; }
        evCount += w.events.length;
        w.events.length = 0;
        t += SIM_DT;
        if (Math.round(t / SIM_DT) % 60 === 0) {
            const bad = check(w);
            if (bad.length) return { ok: false, why: `NaN/invalid at t=${t.toFixed(1)}: ${[...new Set(bad)].join(', ')}`, t };
        }
        if (w.state === 'gameover') { conts++; w.continueGame(); }
        if (w.state === 'done') return { ok: true, t: w.stageTime, deaths, conts, score: S.score, kinds, evCount, total: t };
    }
    const alive = w.aliveInvaders();
    return { ok: false, why: `not cleared in ${BUDGET}s (state ${w.state}, ${alive} invaders left${w.boss ? `, boss core ${w.boss.coreHp}/${w.boss.coreMax}` : ''})`, t };
}

const t0 = Date.now();
for (let loop = 0; loop < LOOPS; loop++) {
    for (let i = 0; i < STAGES.length; i++) {
        if (ONLY && !ONLY.includes(i)) continue;
        for (let s = 0; s < SEEDS; s++) {
            const seed = 1000 + i * 31 + s * 7 + loop * 101;
            let r;
            try { r = playStage(i, loop, seed); }
            catch (e) { r = { ok: false, why: 'exception: ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ') }; }
            const st = STAGES[i];
            const name = `L${loop + 1} ${st.label.padEnd(4)} ${st.type.padEnd(9)} seed ${seed}`;
            if (r.ok) console.log(`  ok   ${name}  ${r.t.toFixed(0).padStart(4)}s  deaths ${String(r.deaths).padStart(2)}  continues ${r.conts}  score ${r.score}`);
            else { console.log(`  FAIL ${name}  ${r.why}`); fails.push(`${name}: ${r.why}`); }
        }
    }
}
console.log(`\n${fails.length ? 'FAILED' : 'PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fails.length) { for (const f of fails) console.log(' - ' + f); process.exit(1); }
