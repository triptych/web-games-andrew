/**
 * pace.mjs — the balance table. A bot plays Worldroot headlessly and prints when
 * each tree stage, rebirth, trial and realm happens.
 *
 *   node game-065/dev/pace.mjs                 # active player, 8 hours
 *   PROFILE=casual HOURS=24 node game-065/dev/pace.mjs
 *   PROFILE=idle node game-065/dev/pace.mjs    # never clicks, shops every 5 minutes
 */
import { Grove } from '../js/sim/game.js';
import { Bot, ACTIVE, CASUAL, IDLE } from '../js/sim/bot.js';
import { STAGES } from '../js/sim/data.js';
import { fmt, fmtTime } from '../js/ui/format.js';

const profile = { active: ACTIVE, casual: CASUAL, idle: IDLE }[process.env.PROFILE || 'active'];
const hours = Number(process.env.HOURS || 8);
const g = Grove.fresh(Number(process.env.SEED || 7));
const bot = new Bot(g, profile);
let lastStage = -1;
let run = 1;
const t0 = Date.now();

function line(msg) {
    const s = g.s;
    console.log(`${fmtTime(s.t).padStart(9)}  run ${String(run).padStart(2)}  ${msg.padEnd(34)} mps ${fmt(g.mps()).padStart(9)}  tree ${String(s.tree).padStart(3)}  hw ${fmt(s.hwEarned).padStart(7)}  realms ${s.realms.length}`);
}

for (let m = 0; m < hours * 60; m++) {
    bot.play(60, (what) => { line(what); run++; lastStage = -1; });
    const st = g.stage;
    if (st > lastStage) {
        for (let k = Math.max(lastStage + 1, 0); k <= st; k++) if (k > 0 || run === 1) line(`stage ${k} ${STAGES[k].name}`);
        lastStage = st;
    }
}
line('end');
console.log(`achievements ${g.achCount()}, upgrades ${Object.keys(g.s.ups).length}, gens ${g.s.gens.join(' ')}, sim ${(Date.now() - t0) / 1000}s`);
