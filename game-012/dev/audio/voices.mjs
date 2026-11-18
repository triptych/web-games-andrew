// voices.mjs — the voice takes for ElevenLabs (eleven_v4), built from the game's own lines (js/sim/data/lines.js)
// so the recordings match the subtitles. One take per speaker (the Oracle's in two halves, to keep each call short),
// lines separated by [long pause]; process.py cuts them apart. Writes dev/audio/voices.json and prints each take.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORACLE, WORLD } from '../../js/sim/data/lines.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// voice ids from creative_list_voices
export const CAST = {
    oracle: ['jTAlT4VvvXlYNDrxqpNQ', 'Andrea - British female character voice', '[mysterious, warm]'],
    world: ['d3qrd1ge6zWDvUxIeXiH', 'Final Boss - Evil All Powerful Villain', '[cold, vast, menacing]'],
};
const take = (who, ids, src) => ({
    voice: CAST[who][0], name: CAST[who][1], lines: ids,
    text: ids.map((id) => `${CAST[who][2]} ${src[id]}`).join(' [long pause] '),
});
const oids = Object.keys(ORACLE);
const half = Math.ceil(oids.length / 2);
export const TAKES = {
    'oracle-a': take('oracle', oids.slice(0, half), ORACLE),
    'oracle-b': take('oracle', oids.slice(half), ORACLE),
    world: take('world', Object.keys(WORLD), WORLD),
};
fs.writeFileSync(path.join(HERE, 'voices.json'), JSON.stringify(TAKES, null, 1));
let n = 0;
for (const [id, t] of Object.entries(TAKES)) { n += t.text.length; console.log(`${id}|${t.voice}|${t.lines.length} lines|${t.text.length} chars`); }
console.log('chars', n);
