/**
 * voices.mjs — the voiced lines: what each of the five people you can visit says when you drop by.
 *
 *   node game-133/dev/audio/voices.mjs RAW_DIR        # writes RAW_DIR/takes.json and prints one take per speaker
 *   node game-133/dev/audio/voices.mjs RAW_DIR write  # after process.py: writes the clip list into js/voices.js
 *
 * A take is one speaker's lines joined with [long pause]; generate each with ElevenLabs (eleven_v4, one take,
 * the voice in dev/audio/README.md), save it as RAW_DIR/vo-<who>.mp3, then run process.py to split it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAST, ROMANCE } from '../../js/sim/data/cast.js';
import { voiceKey } from '../../js/voices.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [RAW, mode] = process.argv.slice(2);
const TAG = { kael: '[quiet, reserved]', sera: '[dry, amused]', bram: '[warm, laughing]', nyx: '[playful, teasing]', ren: '[gentle, courtly]' };
const takes = {};
for (const who of ROMANCE) {
    // the line as scripted is `who.happy: text`; the key is made from the speaker and the raw text
    takes[who] = CAST[who].talk.map((t) => voiceKey(who, t));
    if (mode !== 'write') console.log(`\n== vo-${who}\n${CAST[who].talk.map((t) => `${TAG[who]} ${t}`).join(' [long pause] ')}`);
}
fs.writeFileSync(path.join(RAW, 'takes.json'), JSON.stringify(takes, null, 1));
if (mode === 'write') {
    const made = JSON.parse(fs.readFileSync(path.join(RAW, 'made.json'), 'utf8')).vo;
    const file = path.join(HERE, '../../js/voices.js');
    const keys = Object.keys(made).sort();
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\/\*VO\*\/[\s\S]*?\/\*VO\*\//, `/*VO*/[${keys.map((k) => `'${k}'`).join(', ')}]/*VO*/`));
    console.log(`${keys.length} voiced lines listed in js/voices.js`);
}
