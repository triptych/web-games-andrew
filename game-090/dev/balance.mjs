/**
 * balance.mjs — how hard are the guardians? A ready party (the Agent and three daemons of the
 * level, gear and items a player at that chapter would have) fights each guardian at three
 * levels, 48 times each, with the bot.
 *
 *   node game-090/dev/balance.mjs                  # SKILL=1 N=48
 *   SKILL=0.6 N=24 ONLY=meridian node game-090/dev/balance.mjs
 *   TRACE=meridian node game-090/dev/balance.mjs   # one fight, round by round
 */
import { setup, fightBoss } from './lab.mjs';

const skill = +(process.env.SKILL || 1);
const N = +(process.env.N || 48);
const only = process.env.ONLY;
const list = [['switchman', 7, 0], ['motherbloom', 13, 1], ['aurelia', 20, 2], ['leviathan', 27, 3], ['windbreaker', 33, 4], ['pruner', 38, 5], ['meridian', 42, 5]];
if (process.env.TRACE) {
    const [id, lv, ch] = list.find((x) => x[0] === process.env.TRACE);
    const G = setup(1, lv, ch);
    const r = fightBoss(G, id, skill, (B) => console.log('round', B.round, 'wave', B.wave, B.units.map((u) => `${u.name}${u.side}${u.alive ? '' : 'x'}:${u.hp}/${u.maxhp}${u.down ? 'v' : ''}`).join(' ')));
    console.log(r.win ? 'won' : 'lost');
} else {
    console.log(`guardian win rate (skill ${skill}, ${N} fights each): level −3, level 0, level +3`);
    for (const [id, blv, ch] of list) {
        if (only && only !== id) continue;
        const row = [];
        for (const off of [-3, 0, 3]) {
            let w = 0, r = 0;
            for (let s = 1; s <= N; s++) { const x = fightBoss(setup(s, blv + off, ch), id, skill); if (x.win) w++; r += x.round; }
            row.push(`L${blv + off}: ${String(Math.round((w / N) * 100)).padStart(3)}% in ${(r / N).toFixed(1)} rounds`);
        }
        console.log(id.padEnd(12), row.join('   '));
    }
}
