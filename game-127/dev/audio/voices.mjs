// Collect every voiceable line from the story data, group by speaker, and write the scripts for the ElevenLabs takes.
//   node game-127/dev/audio/voices.mjs OUT_DIR
// Writes OUT_DIR/takes.json: [{ id, who, keys:[...], text }] where text is the lines joined by [long pause], each with
// an emotion tag from its portrait expression. dev/audio/process.py splits each take back into one clip per key.
import fs from 'node:fs';
import path from 'node:path';
const G = new URL('../../js/', import.meta.url);
const { STORY, COMING_OF_AGE } = await import(new URL('sim/data/story.js', G));
const { HEART_SCENES, STARFALL } = await import(new URL('sim/data/hearts.js', G));
const { ENDINGS, EPILOGUES, WEDDING, SOLO_EPILOGUE, FAREWELL } = await import(new URL('sim/data/endings.js', G));
const { parseLine } = await import(new URL('sim/scene.js', G));
const { voiceKey, voiceable } = await import(new URL('voicekey.js', G));

const MAX_CHARS = 2000, MAX_LINES = 30;
const TAG = { happy: '[happy]', sad: '[sad]', angry: '[angry]', smug: '[mischievously]', shy: '[softly]', surprised: '[surprised]' };

export function allLines() {
    const src = [
        ...STORY.flatMap((s) => s.lines), ...COMING_OF_AGE.lines,
        ...Object.values(HEART_SCENES).flat().flatMap((s) => s.lines),
        ...Object.values(STARFALL).flatMap((s) => [...s.young, ...s.grown]),
        ...ENDINGS.flatMap((e) => e.lines), ...Object.values(EPILOGUES).flatMap((e) => e.lines),
        ...WEDDING, ...SOLO_EPILOGUE, ...FAREWELL,
    ];
    const seen = new Map();
    for (const l of src) {
        const L = parseLine(l);
        if (L.kind !== 'say' || !voiceable(L.who, L.text)) continue;
        const key = voiceKey(L.who, L.text);
        if (!seen.has(key)) seen.set(key, { key, who: L.who, expr: L.expr, text: L.text });
    }
    return [...seen.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const out = process.argv[2];
    if (!out) { console.error('usage: voices.mjs OUT_DIR'); process.exit(1); }
    const by = {};
    for (const L of allLines()) (by[L.who] ||= []).push(L);
    const takes = [];
    for (const who of Object.keys(by)) {
        // split a speaker's lines into k takes of roughly even length
        const lines = by[who], total = lines.reduce((a, L) => a + L.text.length, 0);
        const k = Math.max(Math.ceil(total / MAX_CHARS), Math.ceil(lines.length / MAX_LINES));
        const target = total / k;
        let cur = [], n = 0, part = 1;
        const flush = () => {
            if (!cur.length) return;
            const text = cur.map((L) => (TAG[L.expr] ? TAG[L.expr] + ' ' : '') + L.text).join('\n[long pause]\n');
            takes.push({ id: `${who}-${part++}`, who, keys: cur.map((L) => L.key), text });
            cur = []; n = 0;
        };
        for (const L of lines) {
            if (cur.length && part < k && (n + L.text.length / 2 > target || cur.length >= MAX_LINES)) flush();
            cur.push(L); n += L.text.length;
        }
        flush();
    }
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'takes.json'), JSON.stringify(takes, null, 1));
    for (const t of takes) console.log(t.id, t.keys.length, t.text.length);
    console.log(takes.length, 'takes,', takes.reduce((a, t) => a + t.keys.length, 0), 'lines,', takes.reduce((a, t) => a + t.text.length, 0), 'chars');
}
