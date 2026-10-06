// Plays the final hole with the perfect-strike bot and prints the boss state after every shot.
import { HOLE_BY_ID } from '../js/sim/holes.js';
import { buildCourse } from '../js/sim/course.js';
import { World } from '../js/sim/world.js';
import { playHole } from '../js/sim/bot.js';
import { tierProfile } from '../js/sim/rpg.js';
const id = process.argv[2] ?? '5-4';
const h = HOLE_BY_ID[id];
const w = new World(buildCourse(h), { profile: tierProfile(h.realm), seed: 1 });
const r = playHole(w, { onShot: (w, shot) => { const b = w.s.boss; const B = w.s.ball; console.log(`#${w.s.strokes} ${shot.club} p${shot.power.toFixed(2)} spell ${shot.spell} → ball (${B.x.toFixed(1)},${B.y.toFixed(1)},${B.z.toFixed(1)}) surf ${B.surf} phase ${w.s.phase} | boss phase ${b.phase} hp ${b.hp} heads ${b.heads} at ${b.at} sealed ${w.s.sealed} score ${shot.score.toFixed(0)}`); } });
console.log(r.strokes, r.phase);
