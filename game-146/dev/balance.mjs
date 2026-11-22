/**
 * balance.mjs — measures every level with the perfect bot and writes js/sim/data/par.js (the shots for 3 stars).
 *
 *   node game-146/dev/balance.mjs            # SEEDS=6 by default
 *
 * Par is the perfect bot's median shot count × 1.35, plus 2: a strong human who reads the board well can make it,
 * a careless one gets two stars. The simtest checks the table is current (same length, every entry positive).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { LEVELS } = await import('../js/sim/data/levels.js');
const { STEP } = await import('../js/config.js');
const SEEDS = +(process.env.SEEDS || 6);

const par = [];
for (const def of LEVELS) {
    const shots = [];
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame({ level: def.id, seed: s * 977 });
        const b = Bt.makeBot({ skill: 1, seed: s });
        for (let n = 0; !G.over && n < 120 * 900; n++) { Gm.step(G, Bt.botInput(G, b), STEP); G.events.length = 0; }
        shots.push(G.result === 'won' ? G.shots : 99);
    }
    shots.sort((a, b) => a - b);
    const med = shots[Math.floor(shots.length / 2)];
    par.push(Math.round(med * 1.35) + 2);
    console.log(`L${def.id} ${def.name}: perfect bot ${shots.join(' ')} -> par ${par[par.length - 1]}`);
}
const out = `// Shots for three stars on each level, measured by dev/balance.mjs (perfect bot median × 1.35 + 2). Generated: do not edit.\nexport const PAR = ${JSON.stringify(par)};\n`;
fs.writeFileSync(path.join(HERE, '../js/sim/data/par.js'), out);
console.log('wrote js/sim/data/par.js');
