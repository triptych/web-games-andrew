// Collect every voiceable line from the story data, group them by speaker, and write the scripts for the ElevenLabs
// takes (adapted from game-127).
//   node game-140/dev/audio/voices.mjs OUT_DIR
// Writes OUT_DIR/takes.json: [{ id, who, keys:[...], text }]. The text is the lines joined by [long pause], each with
// a delivery tag from its portrait expression. dev/audio/process.py splits each take back into one clip per key.
import fs from 'node:fs';
import path from 'node:path';
const G = new URL('../../js/', import.meta.url);
const { SCENES } = await import(new URL('sim/data/story.js', G));
const { TALKS, CAMP_INTRO } = await import(new URL('sim/data/camps.js', G));
const { parseLine } = await import(new URL('sim/scene.js', G));
const { voiceKey, voiceable } = await import(new URL('voicekey.js', G));

const MAX_CHARS = 2400, MAX_LINES = 32;
// The narrator is recorded only for the great moments: the prologue, the seven colour-returns and the epilogue.
export const NARRATED = ['prologue', 'rose-bloom', 'forge-bloom', 'tide-bloom', 'wood-bloom', 'sun-bloom', 'star-bloom', 'dream-bloom', 'epilogue'];
const TAG = { happy: '[warmly]', sad: '[sadly]', soft: '[softly]' };

export function allLines() {
    const src = [...Object.entries(SCENES).flatMap(([id, ls]) => ls.map((l) => [id, l])),
        ...Object.values(TALKS).flat(2).map((l) => ['talk', l]), ...Object.values(CAMP_INTRO).flat().map((l) => ['camp', l])];
    const seen = new Map();
    for (const [scene, l] of src) {
        const L = parseLine(l);
        if (L.kind !== 'say' || !voiceable(L.who, L.text)) continue;
        if (L.who === 'n' && !NARRATED.includes(scene)) continue;
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
        const lines = by[who], total = lines.reduce((a, L) => a + L.text.length, 0);
        const k = Math.max(Math.ceil(total / MAX_CHARS), Math.ceil(lines.length / MAX_LINES));
        const target = total / k;
        let cur = [], n = 0, part = 1;
        const flush = () => {
            if (!cur.length) return;
            const text = cur.map((L) => (TAG[L.expr] && !(L.expr === 'soft' && L.text.includes('!')) ? TAG[L.expr] + ' ' : '') + L.text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")).join('\n[long pause]\n');
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
