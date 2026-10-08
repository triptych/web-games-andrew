// Probe one event: race a bot (skill, rating) through it and print the order every few seconds.
// node game-069/dev/probe.mjs dome-4 [rating=1000] [skill=0.82] [seeds=3]
import { Track } from '../js/sim/track.js';
import { trackDef } from '../js/sim/tracks.js';
import { Race } from '../js/sim/race.js';
import { EVENTS, buildField, newProfile } from '../js/sim/career.js';
import { levelsForRating } from '../js/sim/parts.js';
import { DT } from '../js/config.js';
const [id = 'dome-4', R = '1000', SK = '0.82', SEEDS = '3'] = process.argv.slice(2);
const ev = EVENTS[id];
const p = newProfile('Bot');
p.levels = levelsForRating(+R);
let wins = 0;
for (let s = 0; s < +SEEDS; s++) {
    const field = buildField(ev, p);
    field[0].ai = { skill: +SK, lane: 0, nitroHappy: 0.7 };
    const t = new Track(trackDef(ev.track, !!ev.reverse));
    const r = new Race({ track: t, type: ev.type, laps: ev.laps, entrants: field, seed: 100 + s, rubber: !ev.boss && ev.type !== 'duel' });
    let next = 0, line = [];
    while (!r.playerDone && r.t < 600) {
        r.step(DT);
        if (r.t >= next) { next += 10; line.push(`${r.t.toFixed(0)}s:` + r.order.map((c) => c.id).join('')); }
    }
    const res = r.results;
    if (res.pos === 1) wins++;
    console.log(`seed ${s}: pos ${res.pos} | ${line.join(' ')} | ${res.order.map((o) => `${o.k}:${o.time.toFixed(1)}`).join(' ')}`);
}
console.log(`${wins}/${SEEDS} wins; field: ${buildField(ev, p).map((e, k) => `${k}=${e.name}(${Math.round(e.spec.top * 3.6)}km/h,sk${e.ai ? e.ai.skill.toFixed(2) : '-'})`).join(' ')}`);
