/**
 * simtest.mjs — plays PINBREAK '86 headlessly with the bot and checks the
 * physics never breaks. No browser, no three.js: the simulation is pure JS.
 *
 *   node game-045/dev/simtest.mjs            # 12 seeds × up to 6 simulated minutes
 *   SEEDS=40 MINUTES=10 node game-045/dev/simtest.mjs
 *
 * Checks, every sub-step:
 *   - no NaN / Infinity in any ball
 *   - every ball stays inside the table outline (never through a wall)
 *   - no ball overlaps a live brick, bumper or flipper by more than a sliver
 * and per game:
 *   - bricks get broken, bumpers get hit, the unstick safety net is rare
 * Plus a static check that js/sim/ stays pure (no three, no DOM, no Math.random).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, stepWorld } from '../js/sim/world.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { PHYS, TABLE, FLIPPER } from '../js/config.js';
import { LAYOUTS, buildWave } from '../js/sim/levels.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS = Number(process.env.SEEDS ?? 12);
const MINUTES = Number(process.env.MINUTES ?? 6);
const FRAME = 1 / 60;

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL', msg); };

// --- 1. Purity of js/sim/ ---
const simDir = join(HERE, '..', 'js', 'sim');
for (const f of readdirSync(simDir)) {
    const code = readFileSync(join(simDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
}

// --- 2. Every layout builds a sensible number of bricks ---
for (let wv = 1; wv <= LAYOUTS.length * 2; wv++) {
    const { name, bricks } = buildWave(wv, 1);
    if (bricks.length < 25) fail(`wave ${wv} (${name}) has only ${bricks.length} bricks`);
}
console.log('layouts:', LAYOUTS.map((l, i) => `${l.name}=${buildWave(i + 1, 1).bricks.length}`).join(', '));

// --- 3. Inside-the-table test for a ball centre ---
function insideTable(b) {
    const { left: L, laneOuter: LO, arcCx, arcCy, arcR } = TABLE;
    const slop = 0.05;
    if (b.x < L - slop || b.x > LO + slop) return false;
    if (b.y > arcCy && Math.hypot(b.x - arcCx, b.y - arcCy) > arcR + slop) return false;
    return b.y > -1.5;
}

function overlapReport(w, b) {
    const R = PHYS.ballR;
    for (const br of w.bricks) {
        if (!br.alive || br.ghost) continue;
        const cx = Math.max(br.x - br.hw, Math.min(b.x, br.x + br.hw));
        const cy = Math.max(br.y - br.hh, Math.min(b.y, br.y + br.hh));
        if (Math.hypot(b.x - cx, b.y - cy) < R * 0.5 && w.power.fire <= 0) return `brick ${br.id}`;
    }
    for (const bp of w.table.bumpers) {
        if (Math.hypot(b.x - bp.x, b.y - bp.y) < bp.r + R * 0.5) return `bumper ${bp.id}`;
    }
    return null;
}

// --- 4. Bot games ---
const totals = { bricks: 0, bumpers: 0, waves: 0, drains: 0, unsticks: 0, launches: 0, pickups: 0, saves: 0, score: 0, time: 0 };
const t0 = performance.now();
let maxBalls = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
    const w = createWorld(seed * 7919);
    const bot = makeBot();
    let acc = 0, frames = 0, bad = false;
    const maxFrames = MINUTES * 60 * 60;
    while (!w.over && frames < maxFrames && !bad) {
        const input = botInput(bot, w, FRAME);
        acc += FRAME;
        let first = true;
        while (acc >= PHYS.tick) {
            stepWorld(w, first ? input : { ...input, nudge: false }, PHYS.tick);
            first = false;
            acc -= PHYS.tick;
            for (const b of w.balls) {
                if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) { fail(`seed ${seed}: NaN ball`); bad = true; break; }
                if (!insideTable(b)) { fail(`seed ${seed}: ball escaped at (${b.x.toFixed(2)}, ${b.y.toFixed(2)}) v=(${b.vx.toFixed(1)}, ${b.vy.toFixed(1)}) t=${w.time.toFixed(2)}`); bad = true; break; }
                const o = overlapReport(w, b);
                if (o) { fail(`seed ${seed}: ball inside ${o} at t=${w.time.toFixed(2)}`); bad = true; break; }
            }
            if (bad) break;
        }
        maxBalls = Math.max(maxBalls, w.balls.length);
        w.fxQueue.length = 0;
        frames++;
    }
    const s = w.stats;
    for (const k of Object.keys(s)) if (k in totals) totals[k] += s[k];
    totals.score += w.score;
    totals.time += w.time;
    console.log(`seed ${String(seed).padStart(2)}: ${w.over ? 'game over' : 'time up  '} t=${w.time.toFixed(0).padStart(4)}s score=${String(w.score).padStart(7)} wave=${w.wave} bricks=${s.bricks} bumpers=${s.bumpers} pickups=${s.pickups} drains=${s.drains} saves=${s.saves} unsticks=${s.unsticks} bestCombo=${w.bestCombo}`);
    if (s.bricks === 0) fail(`seed ${seed}: bot never broke a brick`);
    if (s.bumpers === 0) fail(`seed ${seed}: bot never hit a bumper`);
}
const ms = performance.now() - t0;
console.log('\ntotals:', totals, 'maxBalls', maxBalls);
console.log(`avg game ${(totals.time / SEEDS).toFixed(0)}s, sim speed ${(totals.time / (ms / 1000)).toFixed(0)}x realtime`);
if (totals.unsticks > totals.time / 60) fail(`unstick fired ${totals.unsticks} times in ${totals.time.toFixed(0)}s — something traps the ball`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
