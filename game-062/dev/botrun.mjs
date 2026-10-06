// Plays holes with the search bot and prints strokes against par.
//   node game-062/dev/botrun.mjs [ids...] [--noise N] [--seeds N] [--tier T]
import { HOLES } from '../js/sim/holes.js';
import { buildCourse } from '../js/sim/course.js';
import { World } from '../js/sim/world.js';
import { playHole } from '../js/sim/bot.js';
import { tierProfile } from '../js/sim/rpg.js';
import { Rng } from '../js/rng.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return +v; };
const noise = opt('--noise', 0), seeds = opt('--seeds', 1), tierArg = opt('--tier', -1);
const ids = args;
let tot = 0, totPar = 0;
for (const h of HOLES) {
    if (ids.length && !ids.includes(h.id)) continue;
    const c = buildCourse(h);
    const res = [];
    const t0 = performance.now();
    for (let sd = 0; sd < seeds; sd++) {
        const w = new World(c, { profile: tierProfile(tierArg >= 0 ? tierArg : h.realm), seed: 1000 + sd });
        const r = playHole(w, { noise, rng: new Rng(77 + sd * 13) });
        res.push(r);
        if (seeds > 1 && (r.phase !== 'done' || process.env.VERBOSE)) console.log(`   seed ${sd}: ${r.strokes} ${r.phase} ${r.log.map((l) => l.club[0] + l.power + (l.acc ? '~' + l.acc : '') + '@' + l.yaw).join(' ')}`);
        if (seeds === 1) console.log(`${h.id} ${h.name.padEnd(18)} par ${h.par} → ${r.strokes} ${r.phase.padEnd(6)} ${((performance.now() - t0) / 1000).toFixed(1)}s  ${r.log.map((l) => l.club[0] + l.power + (l.acc ? '~' + l.acc : '')).join(' ')}${w.s.boss ? '  boss hp ' + w.s.boss.hp : ''}`);
    }
    const avg = res.reduce((a, r) => a + r.strokes, 0) / res.length;
    const fails = res.filter((r) => r.phase !== 'done').length;
    tot += avg; totPar += h.par;
    if (seeds > 1) console.log(`${h.id} ${h.name.padEnd(18)} par ${h.par} avg ${avg.toFixed(2)} [${res.map((r) => r.strokes + (r.phase === 'done' ? '' : '✗')).join(',')}] fails ${fails} ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(`total ${tot.toFixed(1)} vs par ${totPar}`);
