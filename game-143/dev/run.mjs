// Quick whole-game bot run: node game-143/dev/run.mjs [seed] [skill] [maxMinutes]
import { newGame, step } from '../js/sim/game.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { STEP } from '../js/config.js';
const [seed = 1, skill = 1, maxMin = 90] = process.argv.slice(2).map(Number);
const G = newGame(seed), bot = makeBot({ skill, seed });
const log = [];
while (G.t < maxMin * 60 && !(G.phase >= 4 && G.epi.waves >= 2)) {
    step(G, botInput(G, bot, STEP), STEP);
    for (const e of G.events) {
        if (e.type === 'invasion') log.push(`d${G.day} t${(G.t / 60).toFixed(1)}m INVASION w${e.wave ?? 'epi'} ready=${e.readyAll} wall${G.wall.lvl} towers bake${G.bake.pct.toFixed(0)} gold${G.res.gold | 0} pop${G.pop | 0} hope${G.hope | 0}`);
        if (e.type === 'battleEnd') log.push(`   -> ${e.result} calmed ${e.calmed} gold+${e.gold}  (wall hp left ${(G.wall.hp / G.wall.max * 100) | 0}%)`);
        if (e.type === 'questDone') log.push(`   quest ${e.id} d${G.day}`);
    }
    G.events.length = 0;
}
console.log(log.join('\n'));
console.log('END', { t: (G.t / 60).toFixed(1), phase: G.phase, day: G.day, res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, v | 0])), pop: G.pop | 0, hope: G.hope | 0, bake: G.bake.pct | 0, ings: G.bake.ings, plots: G.plots.map((p) => p.b ? p.b.kind + p.b.lvl : '-').join(' '), hall: G.hall.lvl, wall: G.wall.lvl, advs: Object.entries(G.advs).filter(([, a]) => a.hired).map(([k, a]) => k + a.lvl).join(' '), active: G.quests.active });
