// Run an all-bot race on each track and print lap times, resets and wall hits.
// node game-069/dev/racecheck.mjs [trackIds] [rating]
import { Track } from '../js/sim/track.js';
import { TRACKS, trackDef } from '../js/sim/tracks.js';
import { Race } from '../js/sim/race.js';
import { specFromLevels, levelsForRating } from '../js/sim/parts.js';
import { DT } from '../js/config.js';
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const R = Number(process.argv[3] || 400);
for (const id of Object.keys(TRACKS)) {
    if (only && !only.includes(id)) continue;
    const t = new Track(trackDef(id));
    const entrants = [];
    for (let k = 0; k < 6; k++) entrants.push({ name: 'B' + k, spec: specFromLevels(levelsForRating(R + (k - 2) * 20)), ai: { skill: 0.7 + k * 0.05, lane: (k % 3 - 1) * 0.5 } });
    const race = new Race({ track: t, type: 'race', laps: 2, entrants, seed: 3 });
    let resets = 0, walls = 0, airs = 0, maxAir = 0, steps = 0;
    while (race.phase !== 'done' && race.t < 400) {
        race.step(DT);
        steps++;
        for (const e of race.events) { if (e.type === 'reset') resets++; if (e.type === 'wall') walls++; if (e.type === 'land') { airs++; maxAir = Math.max(maxAir, e.airT); } }
        if (race.cars.every((c) => c.finished)) break;
        for (const c of race.cars) if (!Number.isFinite(c.x + c.y + c.z + c.vx)) { console.log('NaN!', id); process.exit(1); }
    }
    const fin = race.cars.map((c) => c.finished ? c.finishT.toFixed(1) : 'DNF@' + (c.dist / t.L).toFixed(2));
    const vmax = Math.max(...race.cars.map((c) => c.best));
    console.log(`${id.padEnd(13)} lapBest=${Math.min(...race.cars.map((c) => c.best)).toFixed(1)} [${fin.join(' ')}] resets=${resets} walls=${walls} airs=${airs} maxAir=${maxAir.toFixed(2)} t=${race.t.toFixed(0)}`);
}
