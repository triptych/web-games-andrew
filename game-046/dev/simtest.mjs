/**
 * simtest.mjs — plays Quiverspire headlessly with the bot and checks the
 * simulation never breaks. No browser, no three.js: js/sim/ is pure JS.
 *
 *   node game-046/dev/simtest.mjs                 # every chapter, a few seeds
 *   SEEDS=10 node game-046/dev/simtest.mjs        # more seeds
 *   BALANCE=1 node game-046/dev/simtest.mjs       # also print a clear-rate table by talent level
 *
 * Every tick:
 *   - no NaN / Infinity on the player, enemies, arrows or bullets
 *   - the player stays inside the room and never stands in rock or a pit
 *   - ground enemies never stand inside rock or a pit (except mid-leap)
 * Per run:
 *   - the run ends (clear or death) inside a time cap; no room lasts forever
 *   - every choice offered has 1–3 valid options
 * Plus: js/sim/ purity (no three, no DOM, no Math.random) and determinism
 * (the same seed replays to the same final state).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, stepWorld, runRewards } from '../js/sim/world.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { cellAt, colOf, rowOf, walkable } from '../js/sim/grid.js';
import { TICK, CHAPTERS, ABILITIES, TALENTS } from '../js/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS = Number(process.env.SEEDS ?? 3);
const FRAME = 1 / 60;

let failures = 0;
const fail = (msg) => { failures++; if (failures < 40) console.log('  FAIL', msg); };

// --- 1. Purity of js/sim/ ---
const simDir = join(HERE, '..', 'js', 'sim');
for (const f of readdirSync(simDir)) {
    const code = readFileSync(join(simDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
}

const finite = (...v) => v.every(Number.isFinite);

function checkTick(w, tag) {
    const p = w.player;
    if (!finite(p.x, p.y, p.hp)) { fail(`${tag}: player NaN`); return false; }
    if (Math.abs(p.x) > 5.5 || p.y < 0 || p.y > w.grid.rows + 3) { fail(`${tag}: player out of room (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`); return false; }
    if (!walkable(cellAt(w.grid, colOf(p.x), rowOf(p.y)))) { fail(`${tag}: player inside a blocked tile at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`); return false; }
    for (const e of w.enemies) {
        if (!finite(e.x, e.y, e.hp)) { fail(`${tag}: enemy ${e.type} NaN`); return false; }
        if (Math.abs(e.x) > 5.6 || e.y < -0.1 || e.y > w.grid.rows + 0.1) { fail(`${tag}: ${e.type} out of room (${e.x.toFixed(2)}, ${e.y.toFixed(2)})`); return false; }
        if (!e.fly && e.z < 0.05 && e.state !== 'leap' && !walkable(cellAt(w.grid, colOf(e.x), rowOf(e.y)))) {
            fail(`${tag}: ${e.type}${e.boss ? '/' + e.bossId : ''} inside a blocked tile at (${e.x.toFixed(2)}, ${e.y.toFixed(2)}) state=${e.state}`); return false;
        }
    }
    for (const s of w.arrows) if (!finite(s.x, s.y)) { fail(`${tag}: arrow NaN`); return false; }
    for (const b of w.bullets) if (!finite(b.x, b.y)) { fail(`${tag}: bullet NaN`); return false; }
    if (w.choice && (w.choice.options.length < 1 || w.choice.options.length > 3)) { fail(`${tag}: choice with ${w.choice.options.length} options`); return false; }
    if (w.choice) for (const o of w.choice.options) if (!(o in ABILITIES)) { fail(`${tag}: unknown option ${o}`); return false; }
    return true;
}

/** Play one run to the end. Returns the world. */
export function playRun({ seed, chapter, endless = false, talents = {}, maxMinutes = 40, check = true }) {
    const w = createRun({ seed, chapter, endless, talents });
    const bot = makeBot();
    let acc = 0, frames = 0, roomStart = 0, lastStage = w.stageNum;
    const tag = () => `seed ${seed} ch${chapter} stage ${w.stageNum}`;
    while (!w.result && frames < maxMinutes * 3600) {
        const input = botInput(bot, w, FRAME);
        acc += FRAME;
        while (acc >= TICK) {
            stepWorld(w, input, TICK);
            acc -= TICK;
            if (check && !checkTick(w, tag())) return w;
            if (w.phase === 'choice') break;
        }
        w.fxQueue.length = 0;
        frames++;
        if (w.stageNum !== lastStage) { lastStage = w.stageNum; roomStart = w.time; }
        if (w.time - roomStart > 240) { fail(`${tag()}: stuck in one room for 4 minutes (phase ${w.phase}, ${w.enemies.length} enemies)`); return w; }
        if (endless && w.stageNum > 400) break;
    }
    if (!w.result && !endless) fail(`${tag()}: run hit the time cap`);
    return w;
}

// --- 2. Every chapter, a few seeds, strong talents so the bot sees late rooms ---
const maxed = Object.fromEntries(Object.keys(TALENTS).map((k) => [k, 10]));
const t0 = performance.now();
let simTime = 0;
for (let ch = 1; ch <= CHAPTERS.length; ch++) {
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        const w = playRun({ seed: s * 7919 + ch, chapter: ch, talents: maxed });
        simTime += w.time;
        rows.push(`${w.result === 'clear' ? 'CLEAR' : 'died '} @${w.chapter}-${w.stage + 1} lvl${w.player.level} kills=${w.stats.kills} coins=${runRewards(w)} t=${w.time.toFixed(0)}s`);
    }
    console.log(`chapter ${String(ch).padStart(2)} ${CHAPTERS[ch - 1].name.padEnd(17)} | ${rows.join(' | ')}`);
}

// --- 3. Determinism ---
{
    const a = playRun({ seed: 4242, chapter: 3, talents: { power: 3 } });
    const b = playRun({ seed: 4242, chapter: 3, talents: { power: 3 } });
    const sig = (w) => `${w.result}:${w.stageNum}:${w.stats.kills}:${w.stats.dmgDealt}:${w.player.hp}:${w.time.toFixed(4)}`;
    if (sig(a) !== sig(b)) fail(`non-deterministic: ${sig(a)} vs ${sig(b)}`);
    else console.log('determinism: ok', sig(a));
}

// --- 4. Endless mode runs and gets harder ---
{
    const w = playRun({ seed: 99, chapter: 1, endless: true, talents: maxed, maxMinutes: 90 });
    simTime += w.time;
    console.log(`endless: reached stage ${w.stageNum} (cycle ${w.cycle}, chapter look ${w.chapter}), ${w.result ?? 'still alive'}`);
    if (w.stageNum < 12) fail('endless bot did not get past the first floor');
}

// --- 5. Optional balance table ---
if (process.env.BALANCE) {
    const N = Number(process.env.N ?? 8);
    console.log('\nclear rate by talent level (bot, N=' + N + ')');
    for (const lv of [0, 3, 6, 10]) {
        const tal = Object.fromEntries(Object.keys(TALENTS).map((k) => [k, lv]));
        const cells = [];
        for (let ch = 1; ch <= CHAPTERS.length; ch++) {
            let clears = 0, stages = 0;
            for (let s = 0; s < N; s++) {
                const w = playRun({ seed: 1000 + s * 31 + ch, chapter: ch, talents: tal, check: false });
                if (w.result === 'clear') clears++;
                stages += w.stage + 1;
            }
            cells.push(`${String(Math.round(100 * clears / N)).padStart(3)}% (${(stages / N).toFixed(1)})`);
        }
        console.log(`talents ${String(lv).padStart(2)}: ${cells.join(' ')}`);
    }
}

const ms = performance.now() - t0;
console.log(`\nsimulated ${(simTime / 60).toFixed(1)} min in ${(ms / 1000).toFixed(1)} s`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
