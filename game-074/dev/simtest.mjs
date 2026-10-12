/**
 * simtest.mjs — plays CINDERWING's real simulation in Node, no browser.
 *
 *   node game-074/dev/simtest.mjs            # everything
 *   STAGES=0,3 node game-074/dev/simtest.mjs # a subset
 *   QUICK=1 …                                # god-bot pass only
 *
 * Checks: the sim is pure (no three.js, DOM or Math.random); every stage's
 * terrain keeps a flyable gap and every ground enemy spawns on terrain; the
 * script only names real enemy kinds; a god bot finishes every stage and every
 * boss inside a time budget with no NaN anywhere; the dodging bot's deaths per
 * stage on each difficulty (the balance table); and a list of rules (Halo
 * pickup, cast/recall, group drops, checkpoints, Pilgrim health, Radiance).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World, newSession, stockPower } from '../js/sim/world.js';
import { Bot } from '../js/sim/bot.js';
import { STAGES } from '../js/sim/stages.js';
import { KINDS } from '../js/sim/enemies.js';
import { BOSSES } from '../js/sim/bosses.js';
import { SCENES, sceneBefore } from '../js/sim/story.js';
import { MIN_GAP } from '../js/sim/terrain.js';
import { SIM_DT, H } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else if (process.env.VERBOSE) console.log('  ok', m); };
const ONLY = process.env.STAGES ? process.env.STAGES.split(',').map(Number) : STAGES.map((_, i) => i);

// ---------------------------------------------------------------- purity
console.log('purity');
for (const f of fs.readdirSync(path.join(HERE, '../js/sim'))) {
    const code = fs.readFileSync(path.join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    ok(!/from\s+['"]three/.test(code), `${f} does not import three`);
    ok(!/\bdocument\.|\bwindow\.|localStorage/.test(code), `${f} does not touch the DOM`);
    ok(!/Math\.random\(/.test(code), `${f} is deterministic`);
}

// ---------------------------------------------------------------- data
console.log('data');
for (const [i, st] of STAGES.entries()) {
    ok(BOSSES[st.boss], `stage ${i + 1} boss ${st.boss} exists`);
    const S = newSession('seraph', i);
    const w = new World(S, { seed: 1 });
    let minGap = 99;
    for (let x = 0; x < st.len + 260; x += 0.25) {
        const t = w.terrain.at(x);
        minGap = Math.min(minGap, Math.min(H, t.ceil) - Math.max(0, t.floor));
        if (!Number.isFinite(t.floor) || !Number.isFinite(t.ceil)) { ok(false, `stage ${i + 1} terrain finite at ${x}`); break; }
    }
    ok(minGap >= MIN_GAP - 0.01, `stage ${i + 1} gap never below ${MIN_GAP} (min ${minGap.toFixed(2)})`);
    // the boss arena must be roomy
    let arena = 99;
    for (let x = st.len; x < st.len + 200; x += 0.5) { const t = w.terrain.at(x); arena = Math.min(arena, Math.min(H, t.ceil) - Math.max(0, t.floor)); }
    ok(arena > 14.5, `stage ${i + 1} boss arena is open (${arena.toFixed(1)})`);
    for (const ev of st.script) {
        if (ev.t === 'wave' || ev.t === 'one') ok(KINDS[ev.kind], `stage ${i + 1} @${ev.at}: kind ${ev.kind} exists`);
        if ((ev.t === 'one' || ev.t === 'wave') && ['turret', 'pod', 'tentacle', 'gargoyle', 'wheel', 'hound', 'crusher'].includes(ev.kind)) {
            const side = ev.kind === 'crusher' ? 'ceil' : (ev.o.side ?? 'floor');
            const wx = ev.at + (ev.o.x ?? 34);
            let okT = true;
            for (const dx of [-1, 0, 1]) {
                const t = w.terrain.at(wx + dx);
                if (side === 'floor' ? t.floor < -0.3 : t.ceil > H + 0.3) okT = false;
            }
            ok(okT, `stage ${i + 1} @${ev.at}: ${ev.kind} (${side}) sits on terrain`);
        }
        if (ev.t === 'one' && ev.kind === 'carrier') ok(ev.at < st.len - 10, `stage ${i + 1}: carrier at ${ev.at} before boss`);
        if (ev.t === 'say') ok(ev.text.length < 110, `stage ${i + 1} @${ev.at}: comms line short enough`);
    }
    ok(st.script.every((e, k) => k === 0 || e.at >= st.script[k - 1].at), `stage ${i + 1} script sorted`);
    ok(SCENES[sceneBefore(i)], `scene before stage ${i + 1} exists`);
}
ok(SCENES.ending, 'ending scene exists');

// ---------------------------------------------------------------- play helpers
function finite(w) {
    const nums = [w.player.x, w.player.y, w.scroll];
    for (const e of w.enemies) nums.push(e.x, e.y);
    for (const b of w.bullets) nums.push(b.x, b.y);
    for (const s of w.pshots) nums.push(s.x, s.y);
    if (w.boss) for (const p of w.boss.parts) nums.push(p.x, p.y);
    return nums.every(Number.isFinite);
}

function play(stage, diff, { god = false, seed = 7, limit = 520, skill = 1, continues = 8 } = {}) {
    const S = newSession(diff, stage);
    stockPower(S, stage);
    const w = new World(S, { seed, god });
    const bot = new Bot(skill);
    let t = 0, nan = false, cleared = false, conts = 0, bossT = 0, maxBullets = 0;
    while (t < limit) {
        const inp = bot.think(w);
        w.step(inp, SIM_DT);
        t += SIM_DT;
        maxBullets = Math.max(maxBullets, w.bullets.length);
        if (w.boss && w.boss.st === 'fight') bossT += SIM_DT;
        for (const f of w.fxq) {
            if (f.e === 'stageClear') cleared = true;
        }
        w.fxq.length = 0;
        if (Math.floor(t * 4) !== Math.floor((t - SIM_DT) * 4) && !finite(w)) { nan = true; break; }
        if (cleared) break;
        if (w.state === 'over') {
            if (conts >= continues) break;
            conts++;
            w.continueGame();
        }
    }
    return { cleared, t, nan, deaths: w.stats.deaths, conts, bossT, kills: w.stats.killed, spawned: w.stats.spawned, maxBullets, w };
}

// ---------------------------------------------------------------- god bot: every stage can be finished
console.log('god bot');
for (const i of ONLY) {
    const r = play(i, 'seraph', { god: true });
    ok(!r.nan, `stage ${i + 1}: no NaN`);
    ok(r.cleared, `stage ${i + 1}: god bot clears (t ${r.t.toFixed(0)}s, boss ${r.bossT.toFixed(0)}s, kills ${r.kills}/${r.spawned}, peak bullets ${r.maxBullets})`);
    ok(r.bossT < 150, `stage ${i + 1}: boss falls within 150 s of fighting (${r.bossT.toFixed(0)} s)`);
    console.log(`  stage ${i + 1} ${STAGES[i].name.padEnd(24)} clear ${r.cleared ? 'yes' : 'NO '} ${r.t.toFixed(0).padStart(4)}s  boss ${r.bossT.toFixed(0).padStart(3)}s  kills ${r.kills}/${r.spawned}  peak bullets ${r.maxBullets}`);
}

if (!process.env.QUICK) {
    // ------------------------------------------------------------ rules
    console.log('rules');
    {
        const S = newSession('seraph', 0);
        const w = new World(S, { seed: 3 });
        w.pickup('red', { x: 5, y: 5 });
        ok(S.power.halo && S.power.halo.c === 'red' && S.power.halo.lvl === 1, 'first crystal grants the Halo');
        for (let i = 0; i < 200; i++) w.step({}, SIM_DT);
        ok(w.halo && w.halo.st === 'front', `the Halo flies in and attaches in front (${w.halo && w.halo.st})`);
        w.pickup('red', { x: 5, y: 5 });
        ok(S.power.halo.lvl === 2, 'same colour levels it up');
        w.pickup('blue', { x: 5, y: 5 });
        ok(S.power.halo.c === 'blue' && S.power.halo.lvl === 2, 'another colour switches but keeps the level');
        w.step({ halo: true }, SIM_DT);
        ok(w.halo.st === 'launch', 'C casts the Halo');
        for (let i = 0; i < 240; i++) w.step({}, SIM_DT);
        ok(w.halo.st === 'free' && w.halo.x > 20, `a cast Halo comes to rest ahead (${w.halo.x.toFixed(1)})`);
        w.step({ halo: true }, SIM_DT);
        for (let i = 0; i < 240; i++) w.step({}, SIM_DT);
        ok(w.halo.st === 'front' || w.halo.st === 'back', 'C again calls it home');
        // the halo eats bullets
        w.enemies.length = 0; w.bullets.length = 0; w.spawnQ.length = 0;
        if (w.halo.st === 'back') w.attachHalo = () => {};
        const hb = w.fire(w.halo.x + 2, w.halo.y, Math.PI, 6, 'orb');
        let absorbed = false;
        for (let i = 0; i < 80; i++) { w.step({}, SIM_DT); if (w.fxq.some((f) => f.e === 'absorb')) absorbed = true; w.fxq.length = 0; }
        ok(!w.bullets.includes(hb) && absorbed && w.player.alive, 'the Halo absorbs a bullet');
    }
    {
        const S = newSession('seraph', 0);
        const w = new World(S, { seed: 3 });
        w.runEvent({ at: 0, t: 'wave', kind: 'imp', n: 3, o: { y: 9, path: 'straight', drop: 'wing', gap: 0.1, speed: 2 } });
        for (let i = 0; i < 60; i++) w.step({}, SIM_DT);
        for (const e of w.enemies) w.killEnemy(e);
        ok(w.items.some((it) => it.kind === 'wing'), 'destroying a whole squadron drops its item');
    }
    {
        const S = newSession('seraph', 0);
        const w = new World(S, { seed: 3 });
        w.scroll = 200;
        w.player.inv = 0;
        w.kill();
        for (let i = 0; i < 260; i++) w.step({}, SIM_DT);
        ok(w.player.alive && Math.abs(w.scroll - 130) < 5, `Seraph: a death returns you to the checkpoint (${w.scroll.toFixed(0)})`);
        ok(S.lives === 1, 'and costs a life');
    }
    {
        const S = newSession('pilgrim', 0);
        const w = new World(S, { seed: 3 });
        w.player.inv = 0;
        w.hurt();
        ok(w.player.alive && S.health === 2, 'Pilgrim: a hit costs a feather of health, not a life');
        const sc = w.scroll;
        w.player.inv = 0; w.hurt(); w.player.inv = 0; w.hurt();
        for (let i = 0; i < 260; i++) w.step({}, SIM_DT);
        ok(w.player.alive && w.scroll >= sc, 'Pilgrim: after three hits you respawn where you fell');
    }
    {
        const S = newSession('seraph', 0);
        const w = new World(S, { seed: 3 });
        w.spawn('eye', { y: 9, stopX: 20, x: 20 });
        const e = w.enemies[w.enemies.length - 1];
        w.player.y = 9;
        for (let i = 0; i < 150; i++) w.step({ beam: true }, SIM_DT);
        const hp0 = e.hp;
        for (let i = 0; i < 80; i++) w.step({}, SIM_DT);
        ok(hp0 - e.hp > 35 || e.dead, `a full Radiance charge hits hard (${(hp0 - e.hp).toFixed(1)})`);
    }
    {
        const S = newSession('seraph', 6);
        const w = new World(S, { seed: 3, god: true });
        w.scroll = STAGES[6].len - 0.1;
        for (let i = 0; i < 10; i++) w.step({}, SIM_DT);
        ok(w.boss && w.boss.kind === 'malphas', 'the boss arrives at the end of the stage');
    }

    // ------------------------------------------------------------ the balance table
    console.log('balance (dodging bot, deaths per stage; continues used)');
    for (const diff of ['pilgrim', 'seraph', 'archangel']) {
        const row = [];
        for (const i of ONLY) {
            const r = play(i, diff, { seed: 11 + i, limit: 700 });
            ok(!r.nan, `${diff} stage ${i + 1}: no NaN`);
            ok(r.cleared, `${diff} stage ${i + 1}: the bot finishes (deaths ${r.deaths}, continues ${r.conts})`);
            row.push(`${r.cleared ? '' : '✗'}${r.deaths}${r.conts ? `(${r.conts}c)` : ''}`.padStart(7));
        }
        console.log(`  ${diff.padEnd(10)} ${row.join(' ')}`);
    }
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
