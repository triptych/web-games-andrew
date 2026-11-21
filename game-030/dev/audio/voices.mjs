// Writes takes.json: the voice takes that were generated, in order, with the exact words of every clip.
// Every battle shout in js/sim/data/barks.js is one line of its speaker's take, joined by [long pause].
//   node game-030/dev/audio/voices.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BARKS } from '../../js/sim/data/barks.js';
import { voiceKey } from '../../js/voicekey.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEAKER = { wick: 'wick', trina: 'trina', mabel: 'mabel', bigbertha: 'bertha' };
const takes = Object.entries(BARKS).map(([k, lines]) => ({
    speaker: SPEAKER[k],
    lines: Object.values(lines).map((text) => ({ text, key: voiceKey(SPEAKER[k], text) })),
}));
fs.writeFileSync(path.join(HERE, 'takes.json'), JSON.stringify(takes, null, 1));
console.log(takes.map((t) => `${t.speaker}: ${t.lines.length} lines`).join('\n'));
