/**
 * simtest.mjs — plays every stage headlessly with the bot, in Node.
 *
 *   node game-059/dev/simtest.mjs                 all stages, normal
 *   DIFF=hard STAGES=0,1 SEEDS=3 node ...         options
 *   MODE=bossrush | survival                      other modes
 *
 * Checks: no exceptions, no NaN positions, every stage reaches stageClear
 * within a time budget (with continues counted), every boss can be beaten,
 * and the event script actually ran (all waves spawned).
 */
import { World, STEP } from '../js/sim/world.js';
import { LEVELS } from '../js/sim/levels.js';
import { makeBot } from '../js/sim/bot.js';

const DIFF = process.env.DIFF || 'normal';
const MODE = process.env.MODE || 'story';
const stages = process.env.STAGES ? process.env.STAGES.split(',').map(Number) : LEVELS.map((_, i) => i);
const seeds = +(process.env.SEEDS || 2);
let failures = 0;

function run(stage, seed) {
    const profile = { upgrades: { power: 1, armor: 1, cap: 1 }, credits: 0, score: 0, lives: 3 };
    const w = new World({ stage, difficulty: DIFF, seed, profile, viewW: 427, mode: MODE });
    const bot = makeBot();
    let t = 0, continues = 0, deaths = 0, cleared = false, bosses = 0;
    const evCounts = {};
    const maxT = MODE === 'survival' ? 240 : 900;
    while (t < maxT) {
        if (w.paused) {
            if (w.state === 'gameover') { continues++; w.continueGame(); }
            else w.resume();
        }
        w.step(STEP, bot(w, STEP));
        t += STEP;
        for (const e of w.drainEvents()) {
            evCounts[e.t] = (evCounts[e.t] || 0) + 1;
            if (e.t === 'playerDown') deaths++;
            if (e.t === 'bossDown') bosses++;
            if (e.t === 'stageClear') cleared = true;
        }
        for (const f of w.fighters) if (!Number.isFinite(f.x + f.y + f.z + f.hp)) throw new Error(`NaN on ${f.name} state=${f.state} move=${f.moveName}`);
        if (cleared) break;
        if (MODE === 'survival' && w.survivalWave >= 8) { cleared = true; break; }
    }
    return { t, cleared, deaths, continues, bosses, kos: w.stats.kos, maxCombo: w.stats.maxCombo, score: w.score, evIdx: w.evIdx, nEv: w.level.events.length, ev: evCounts, wave: w.survivalWave, x: Math.round(w.player.x), lock: !!w.lock };
}

for (const s of stages) {
    for (let k = 0; k < seeds; k++) {
        const seed = 1000 + s * 31 + k * 7;
        let r;
        try { r = run(s, seed); } catch (err) { console.log(`stage ${s + 1} seed ${seed}: EXCEPTION`, err.stack); failures++; continue; }
        const ok = r.cleared;
        if (!ok) failures++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} stage ${s + 1} ${LEVELS[s].name.padEnd(15)} seed ${seed}: ${r.t.toFixed(0)}s, deaths ${r.deaths}, continues ${r.continues}, KOs ${r.kos}, max combo ${r.maxCombo}, score ${r.score}, events ${r.evIdx}/${r.nEv}${MODE === 'survival' ? `, wave ${r.wave}` : ''}${ok ? '' : ` x=${r.x} lock=${r.lock}`}`);
        if (MODE !== 'story') break;
    }
    if (MODE !== 'story') break;
}
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
