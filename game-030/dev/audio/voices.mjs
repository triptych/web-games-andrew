// Writes takes.json: every voice take, in order, with the exact words of every clip, and prints the prompt to give
// ElevenLabs for each. A take is one speaker's lines joined by [long pause], each led by a delivery tag; process.py cuts
// it at its N-1 longest pauses. Two kinds: the battle shouts (js/sim/data/barks.js, file take-<speaker>.mp3) and every
// line of dialogue (js/sim/data/story.js, in chunks of eight, file dlg-<speaker>-<n>.mp3).
//   node game-030/dev/audio/voices.mjs [--prompts]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BARKS } from '../../js/sim/data/barks.js';
import { TREES } from '../../js/sim/data/story.js';
import { voiceKey } from '../../js/voicekey.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEAKER = { wick: 'wick', trina: 'trina', mabel: 'mabel', bigbertha: 'bertha' };
const TAG = { wick: '[friendly]', trina: '[cheerful]', mabel: '[warmly]', pilcrow: '[anxiously]', bertram: '[grumpily]', bertha: '[booming]' };
const takes = Object.entries(BARKS).map(([k, lines]) => ({
    speaker: SPEAKER[k], file: `take-${SPEAKER[k]}.mp3`,
    lines: Object.values(lines).map((text) => ({ text, key: voiceKey(SPEAKER[k], text) })),
}));
const by = {};
for (const t of Object.values(TREES)) for (const n of Object.values(t.nodes)) {
    if (!n.who || n.who === 'n' || !n.text) continue;
    const list = (by[n.who] ??= []);
    if (!list.some((l) => l.text === n.text)) list.push({ text: n.text, tag: n.mood === 'excited' ? '[excited]' : TAG[n.who] });
}
for (const [who, lines] of Object.entries(by)) {
    for (let i = 0, k = 1; i < lines.length; i += 8, k++) {
        const chunk = lines.slice(i, i + 8);
        takes.push({ speaker: who, file: `dlg-${who}-${k}.mp3`, lines: chunk.map((l) => ({ text: l.text, key: voiceKey(who, l.text), tag: l.tag })) });
    }
}
fs.writeFileSync(path.join(HERE, 'takes.json'), JSON.stringify(takes, null, 1));
for (const t of takes) {
    const prompt = t.lines.map((l) => `${l.tag || ''} ${l.text}`.trim()).join(' [long pause] ');
    console.log(`${t.file}: ${t.lines.length} lines, ${prompt.length} chars`);
    if (process.argv.includes('--prompts')) console.log('  ' + prompt + '\n');
}
