// The balance table: whole games by the bot at three skills over SEEDS seeds.
//   node game-143/dev/balance.mjs            SEEDS=6
import { newGame, step } from '../js/sim/game.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { STEP } from '../js/config.js';
const SEEDS = +(process.env.SEEDS || 5);
export function playWhole(seed, skill, maxMin = 150) {
    const G = newGame(seed), bot = makeBot({ skill, seed });
    const waves = [];
    let cur = null;
    while (G.t < maxMin * 60 && !(G.phase >= 4 && G.epi.waves >= 1)) {
        step(G, botInput(G, bot, STEP), STEP);
        for (const e of G.events) {
            if (e.type === 'invasion') cur = { wave: e.wave ?? 'E', day: G.day, ready: e.readyAll };
            if (e.type === 'battleOver' && cur) { cur.result = e.result; cur.wall = Math.round(100 * G.battle.wall.hp / G.battle.wall.max); cur.hits = G.battle.wallHits; waves.push(cur); cur = null; }
        }
        G.events.length = 0;
    }
    return { G, waves, ended: G.ended, min: G.t / 60 };
}
if (import.meta.url === `file://${process.argv[1]}`) {
    for (const skill of [1, 0.6, 0.3]) {
        for (let s = 1; s <= SEEDS; s++) {
            const { G, waves, ended, min } = playWhole(s * 7919, skill);
            console.log(`skill ${skill} seed ${s}: ${ended ? 'ENDED' : 'not ended'} in ${min.toFixed(0)} min, day ${G.day} | ` +
                waves.map((w) => `w${w.wave}:${w.result.slice(0,2)}${w.wall}%h${w.hits}${w.ready ? "*" : ""}`).join(' '));
        }
    }
}
