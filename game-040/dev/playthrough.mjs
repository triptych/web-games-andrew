/**
 * playthrough.mjs — a full six-level campaign in Node, start to ending, run the
 * same way main.js runs it: one world per level, the run's ship state and
 * headcount carried across, cadets and their Wing Abilities awarded on clear.
 *
 *   node dev/playthrough.mjs [difficulty] [botStyle]
 */

import { createWorld, stepWorld, levelSummary } from '../js/sim/world.js';
import { newRun, addCadet } from '../js/core/state.js';
import { cadetForLevel, endingFor, TOTAL_CADETS } from '../js/sim/story.js';
import { LEVEL_COUNT } from '../js/sim/levels.js';
import { PLAYER, TICK, DIFFICULTY } from '../js/core/config.js';
import { makeBot } from './bots.mjs';

const difficulty = process.argv[2] ?? 'pilot';
const style = process.argv[3] ?? 'greedy';
const bot = makeBot(style);

const run = newRun(difficulty, 1);
console.log(`\nSTARCADET full playthrough — ${DIFFICULTY[difficulty].name}, "${style}" pilot\n`);
console.log('LV  NAME               TIME   PODS     CADETS  DEATHS  RANK  WING GAINED');
console.log('-'.repeat(76));

let totalTime = 0;
let failed = false;

for (let level = 1; level <= LEVEL_COUNT; level++) {
    run.level = level;
    const world = createWorld({ level, run, seed: `play:${difficulty}` });
    world.player.weapon = run.weapon;
    world.player.power = run.power;
    world.player.lives = run.lives;
    world.player.flares = Math.max(run.flares, PLAYER.startFlares);

    let t = 0;
    while (t < 480 && world.phase !== 'done' && world.phase !== 'failed') {
        stepWorld(world, bot(world), TICK);
        world.fxQueue.length = 0;
        t += TICK;
        // a continue, the way a player would spend one
        if (world.phase === 'failed' && run.continues > 0) {
            run.continues--;
            world.player.lives = DIFFICULTY[difficulty].lives;
            world.player.alive = true;
            world.player.respawnTimer = 0;
            world.player.invuln = 2;
            world.phase = world.boss ? 'boss' : 'wave';
        }
    }
    totalTime += t;

    const s = levelSummary(world);
    run.score += s.score;
    run.rescued += s.cadets;
    run.lost += s.cadetsLost;
    run.weapon = world.player.weapon;
    run.power = world.player.power;
    run.lives = world.player.lives;
    run.flares = world.player.flares;

    const cadet = cadetForLevel(level);
    if (cadet && world.phase === 'done') addCadet(run, cadet);

    console.log(
        `${String(level).padEnd(3)} ${world.level.name.padEnd(18)} ${t.toFixed(0).padStart(4)}s  ` +
        `${String(s.rescued).padStart(2)}/${String(s.budget).padEnd(4)} ${String(s.cadets).padStart(6)}  ` +
        `${String(s.deaths).padStart(6)}  ${s.rank.padEnd(4)}  ${world.phase === 'done' && cadet ? cadet.abilityName : '—'}`);

    if (world.phase !== 'done') { failed = true; console.log(`     ! level ${level} did not clear (${world.phase})`); break; }
}

console.log('-'.repeat(76));
const ending = endingFor(run.rescued);
console.log(`\nRESULT: ${failed ? 'RUN FAILED' : `ENDING — ${ending.title}`}`);
console.log(`  cadets home     ${run.rescued} / ${TOTAL_CADETS}`);
console.log(`  cadets lost     ${run.lost}`);
console.log(`  final score     ${run.score.toLocaleString('en-US')}`);
console.log(`  wing            ${run.cadets.join(', ') || 'nobody'}`);
console.log(`  continues used  ${3 - run.continues}`);
console.log(`  total time      ${(totalTime / 60).toFixed(1)} minutes of play\n`);

process.exit(failed ? 1 : 0);
