// Builds the voice takes: every spoken line of js/sim/data/story.js and every bark of barks.js, grouped by
// speaker, one take per speaker (Eleven v4 on fal, elevenlabs/tts/eleven-v4, with character timestamps).
// Lines are joined by "[long pause]" and led by a delivery tag from the line's mood. process.py cuts each take at
// the timestamps into audio/vo/<voiceKey>.mp3.   node game-028/dev/audio/voices.mjs [out.json]
import fs from 'node:fs';
import { TREES } from '../../js/sim/data/story.js';
import { BARKS } from '../../js/sim/data/barks.js';
import { CAST } from '../../js/sim/data/cast.js';
import { voiceKey } from '../../js/voicekey.js';

const TAG = { sad: '[sadly]', fierce: '[determined]', angry: '[angrily]', happy: '[warmly]', smile: '[playfully]', worried: '[worried]' };
const lines = {};
const add = (who, text, mood, bark) => {
    const key = voiceKey(who, text);
    (lines[who] ||= new Map()).set(key, { key, text: text.trim(), mood, bark });
};
for (const tree of Object.values(TREES)) for (const n of Object.values(tree.nodes)) if (n.text) add(n.who, n.text, n.mood);
for (const [who, b] of Object.entries(BARKS)) for (const t of Object.values(b)) add(who, t, null, true);

const takes = [];
for (const [who, m] of Object.entries(lines)) {
    let text = '';
    const parts = [];
    for (const l of m.values()) {
        if (text) text += ' [long pause] ';
        const tag = l.bark ? '[shouting] ' : who === 'n' ? '' : TAG[l.mood] ? TAG[l.mood] + ' ' : '';
        text += tag;
        parts.push({ key: l.key, start: text.length, end: text.length + l.text.length, text: l.text });
        text += l.text;
    }
    if (text.length > 4900) throw new Error(who + ' take too long: ' + text.length);
    takes.push({ who, voice: CAST[who].voice, text, parts });
}
const out = process.argv[2] || new URL('./takes.json', import.meta.url).pathname;
fs.writeFileSync(out, JSON.stringify(takes, null, 1));
console.log(takes.map((t) => `${t.who} ${t.voice} ${t.parts.length} lines ${t.text.length} chars`).join('\n'));
