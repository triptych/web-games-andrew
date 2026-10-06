// Tries one club at a grid of powers and aims from the tee (or a given ball position) and prints where
// each shot finishes and how the bot would score it. For tuning holes.
//   node game-062/dev/probe.mjs <hole> <club> [yaw ...] [--from x,z]
import { HOLE_BY_ID } from '../js/sim/holes.js';
import { buildCourse } from '../js/sim/course.js';
import { World } from '../js/sim/world.js';
import { tierProfile } from '../js/sim/rpg.js';
import { scoreEnd } from '../js/sim/bot.js';

const args = process.argv.slice(2);
const fromI = args.indexOf('--from');
let from = null;
if (fromI >= 0) { from = args[fromI + 1].split(',').map(Number); args.splice(fromI, 2); }
const [id, club, ...yaws] = args;
const h = HOLE_BY_ID[id];
const c = buildCourse(h);
const w = new World(c, { profile: tierProfile(h.realm) });
if (from) { const B = w.s.ball; B.x = from[0]; B.z = from[1]; B.y = c.heightAt(B.x, B.z) + 0.2; B.surf = c.surfAt(B.x, B.z); }
const ys = yaws.length ? yaws.map(Number) : [w.defaultAim()];
for (const p of [0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1]) {
    const row = [];
    for (const y of ys) {
        const x = w.clone();
        x.setAim(y);
        x.shoot({ club, power: p, acc: 0, perfect: true });
        let t = 0;
        const t0 = performance.now();
        while (x.s.phase === 'flight' && t < 50) { x.step(1 / 240); t += 1 / 240; }
        const B = x.s.ball;
        row.push(`${y.toFixed(2)}:${x.s.phase[0]} (${B.x.toFixed(0)},${B.z.toFixed(0)}) s${B.surf} sc=${scoreEnd(w, x).toFixed(0)} ${t.toFixed(1)}s/${(performance.now() - t0).toFixed(0)}ms`);
    }
    console.log(p.toFixed(1), row.join(' | '));
}
