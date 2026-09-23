/**
 * balance.mjs — plays every level with three scripted bots and prints the
 * numbers the GDD's difficulty claims are based on.
 *
 *   node dev/balance.mjs           # all levels, pilot difficulty
 *   node dev/balance.mjs ace       # a different difficulty
 */

import { createWorld, stepWorld, levelSummary } from '../js/sim/world.js';
import { newRun, addCadet } from '../js/core/state.js';
import { CADETS } from '../js/sim/story.js';
import { TICK } from '../js/core/config.js';
import { LEVELS } from '../js/sim/levels.js';
import { makeBot } from './bots.mjs';

const difficulty = process.argv[2] ?? 'pilot';
const STYLES = ['scared', 'pilot', 'greedy'];

function play(level, style, seed) {
    const run = newRun(difficulty, level);
    for (const c of CADETS.filter((c) => c.level < level)) addCadet(run, c);
    run.power = Math.min(5, 1 + Math.floor(level / 1.5));
    const world = createWorld({ level, run, seed: `bal:${seed}` });
    world.player.power = run.power;
    world.player.lives = 99;                    // measure hits taken, not game-overs
    const bot = makeBot(style);
    let t = 0, peak = 0, bulletSum = 0, frames = 0;
    while (t < 420 && world.phase !== 'done' && world.phase !== 'failed') {
        stepWorld(world, bot(world), TICK);
        world.fxQueue.length = 0;
        peak = Math.max(peak, world.eBullets.length);
        bulletSum += world.eBullets.length;
        frames++;
        t += TICK;
    }
    const s = levelSummary(world);
    return {
        style, level, time: t,
        deaths: world.stats.deaths,
        rescued: s.rescued, budget: s.budget, lost: s.lost,
        score: s.score, rank: s.rank, kills: s.kills,
        graze: world.player.graze,
        peak, avg: bulletSum / Math.max(1, frames),
        cleared: world.phase === 'done',
    };
}

console.log(`\nSTARCADET balance — difficulty: ${difficulty}\n`);
console.log('LV  BOT      CLEAR  TIME   DEATHS  PODS      LOST  PEAK  AVG   GRAZE  RANK');
console.log('-'.repeat(78));

const totals = {};
for (const lv of LEVELS) {
    for (const style of STYLES) {
        const r = play(lv.id, style, `${lv.id}:${style}`);
        totals[style] ??= { deaths: 0, rescued: 0, budget: 0, lost: 0 };
        totals[style].deaths += r.deaths;
        totals[style].rescued += r.rescued;
        totals[style].budget += r.budget;
        totals[style].lost += r.lost;
        console.log(
            `${String(r.level).padEnd(3)} ${style.padEnd(8)} ${(r.cleared ? 'yes' : 'NO ').padEnd(6)} ` +
            `${r.time.toFixed(0).padStart(4)}s  ${String(r.deaths).padStart(5)}   ` +
            `${String(r.rescued).padStart(2)}/${String(r.budget).padEnd(5)} ${String(r.lost).padStart(4)}  ` +
            `${String(r.peak).padStart(4)}  ${r.avg.toFixed(0).padStart(4)}  ${String(r.graze).padStart(5)}  ${r.rank}`,
        );
    }
    console.log('-'.repeat(78));
}

console.log('\nCampaign totals per bot:');
for (const [style, tt] of Object.entries(totals)) {
    console.log(`  ${style.padEnd(8)} deaths ${String(tt.deaths).padStart(3)}  ` +
                `pods ${tt.rescued}/${tt.budget} (${((tt.rescued / tt.budget) * 100).toFixed(0)}%)  lost ${tt.lost}`);
}
console.log('\nA healthy curve: "pilot" clears every level with few deaths and most pods;');
console.log('"greedy" saves more pods but dies far more; "scared" survives but leaves cadets behind.\n');
