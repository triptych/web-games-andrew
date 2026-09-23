/**
 * perf.mjs — how much CPU the simulation costs per rendered frame.
 *
 * The renderer's cost is a GPU question this sandbox cannot answer (software GL
 * only), but the simulation is plain JavaScript and costs the same work on a
 * phone as on a desktop, just at a lower clock. So: measure the sim at its
 * heaviest — the Chorus Heart with hundreds of live bullets — and check it
 * leaves the frame budget mostly free.
 *
 *   node dev/perf.mjs
 */

import { createWorld, stepWorld } from '../js/sim/world.js';
import { newRun, addCadet } from '../js/core/state.js';
import { CADETS } from '../js/sim/story.js';
import { TICK } from '../js/core/config.js';
import { makeBot } from './bots.mjs';

const FRAME = 1 / 60;                 // one rendered frame = 2 sim ticks
const SUBSTEPS = Math.round(FRAME / TICK);
const bot = makeBot('pilot');
let failures = 0;

function measure(level, { atBoss = true, difficulty = 'ace', seconds = 45 } = {}) {
    const run = newRun(difficulty, level);
    for (const c of CADETS.filter((c) => c.level < level)) addCadet(run, c);
    const world = createWorld({ level, run, seed: `perf${level}` });
    if (atBoss) {
        const cue = world.level.cues.find((c) => c.kind === 'boss');
        world.t = cue.t - 0.05;
        world.cueIndex = world.level.cues.indexOf(cue);
    }
    world.player.lives = 999;
    world.player.power = 5;

    const samples = [];
    let peakBullets = 0, peakEntities = 0;
    const frames = Math.round(seconds / FRAME);
    for (let f = 0; f < frames; f++) {
        world.player.invuln = Math.max(world.player.invuln, 0.2);   // keep the fight going
        const input = bot(world);
        const t0 = performance.now();
        for (let i = 0; i < SUBSTEPS; i++) stepWorld(world, input, TICK);
        samples.push(performance.now() - t0);
        world.fxQueue.length = 0;
        if (world.boss) world.boss.hp = Math.max(world.boss.maxHp * 0.08, world.boss.hp);
        peakBullets = Math.max(peakBullets, world.eBullets.length + world.pBullets.length);
        peakEntities = Math.max(peakEntities, world.enemies.length + world.pods.length + world.pickups.length);
    }
    samples.sort((a, b) => a - b);
    return {
        level,
        avg: samples.reduce((s, v) => s + v, 0) / samples.length,
        p95: samples[Math.floor(samples.length * 0.95)],
        max: samples[samples.length - 1],
        peakBullets, peakEntities,
    };
}

console.log('\nSTARCADET simulation cost per rendered frame (2 x 1/120s ticks), ACE difficulty');
console.log('A 60fps frame is 16.7ms in total, and the renderer needs most of it.\n');
console.log('LV  AVG ms  P95 ms  MAX ms   PEAK BULLETS  PEAK ENTITIES');
console.log('-'.repeat(60));

for (const level of [1, 3, 4, 6]) {
    const r = measure(level);
    console.log(`${String(r.level).padEnd(3)} ${r.avg.toFixed(3).padStart(6)}  ${r.p95.toFixed(3).padStart(6)}  ` +
                `${r.max.toFixed(3).padStart(6)}   ${String(r.peakBullets).padStart(12)}  ${String(r.peakEntities).padStart(13)}`);
    // A phone's single-core JS is roughly 3-4x slower than this machine, so
    // anything under ~1.5ms here leaves a phone comfortably inside its budget.
    if (r.p95 > 1.5) {
        console.log(`    ! level ${level} p95 of ${r.p95.toFixed(2)}ms is above the 1.5ms budget`);
        failures++;
    }
}

console.log('-'.repeat(60));
console.log(failures === 0
    ? '\nSimulation fits the frame budget with room for a phone GPU.\n'
    : `\n${failures} level(s) over budget.\n`);
process.exit(failures ? 1 : 0);
