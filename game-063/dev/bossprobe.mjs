// For a boss hole: places the ball at a few distances from the boss's current target and counts how many
// shots in a grid (clubs × yaw × power, perfect strikes) land a hit. A boss nobody can hit shows up as 0.
//   node game-063/dev/bossprobe.mjs <hole> [phase2]
import { HOLE_BY_ID } from '../js/sim/holes.js';
import { buildCourse } from '../js/sim/course.js';
import { World } from '../js/sim/world.js';
import { tierProfile } from '../js/sim/rpg.js';

const [id, ph] = process.argv.slice(2);
const h = HOLE_BY_ID[id];
const c = buildCourse(h);
const w0 = new World(c, { profile: tierProfile(h.realm) });
if (ph === 'phase2' && w0.s.boss.kind === 'bogey') { w0.s.boss.phase = 2; w0.s.boss.hp = 6; w0.s.boss.transformT = 0; }
for (let i = 0; i < 5; i++) w0.step(1 / 60);
const T = w0.target();
console.log(`target (${T.x.toFixed(1)}, ${T.y.toFixed(1)}, ${T.z.toFixed(1)}) ground ${c.heightAt(T.x, T.z).toFixed(1)}`);
for (const d of [6, 10, 16, 24, 34]) {
    const B = w0.s.ball;
    const bx = T.x, bz = T.z - d;
    B.x = bx; B.z = bz; B.y = c.heightAt(bx, bz) + 0.2; B.surf = c.surfAt(bx, bz);
    const yaw0 = Math.atan2(T.x - bx, T.z - bz);
    const row = [];
    for (const club of ['putter', 'wedge', 'iron']) {
        let hits = 0, tries = 0;
        for (let dy = -0.12; dy <= 0.12; dy += 0.03) for (let p = 0.1; p <= 1; p += 0.05) {
            const w = w0.clone();
            w.setAim(yaw0 + dy);
            w.shoot({ club, power: p, acc: 0, perfect: false });
            const hp = w.s.boss.hp;
            let t = 0;
            while (w.s.phase === 'flight' && t < 20) { w.step(1 / 240); t += 1 / 240; }
            tries++;
            if (w.s.boss.hp < hp) hits++;
        }
        row.push(`${club} ${hits}/${tries}`);
    }
    console.log(`d=${d}: ${row.join('  ')}  (surf ${B.surf})`);
}
