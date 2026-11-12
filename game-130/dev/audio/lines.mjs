/**
 * lines.mjs — the voice takes sent to ElevenLabs, built from js/sim/data/story.js.
 *
 *   node game-130/dev/audio/lines.mjs            # prints [{ take, who, voice, ids, text }]
 *
 * Every character's lines go out in takes of up to MAX_LINES lines, joined by "[long pause]"; process.py cuts each
 * take back into one clip per line at its longest pauses, in the same order (takes.json records it).
 */
import { LINES } from '../../js/sim/data/story.js';

export const VOICES = {
    orby: { id: 'MEJe6hPrI48Kt2lFuVe3', name: 'Yumi' },
    ada: { id: 'nyQ6Ftl3gFwx4EgtQvN1', name: 'Dolly - Southern Hospitality' },
    zorp: { id: 'mgZYFBDKPJGhiZEAcf4X', name: 'Chuck - Goblin' },
    gloobella: { id: 'jTAlT4VvvXlYNDrxqpNQ', name: 'Andrea - British female character voice' },
    snorkel: { id: 'JS8l7lQwh35gDnA8DTXd', name: 'HorHey' },
    quasar: { id: 'Nagtyt9MktF8AWSgjotJ', name: 'Devry' },
    blipblop: { id: 'rBkiq5ZQ43ogwd6i4uIQ', name: 'Peanut - Tiny & Peppy' },
    wisp: { id: 'Vnqlgu3fdiFwisAye1qH', name: 'Mimi - Cute & Quirky' },
    mama: { id: 'KhpuFRhu6kfNvpalcYtz', name: 'Ivy' },
};
const MAX_LINES = 10;
const MAX_CHARS = 1100;

export function takes() {
    const by = {};
    for (const [id, l] of Object.entries(LINES)) (by[l.who] ||= []).push(id);
    const out = [];
    for (const [who, ids] of Object.entries(by)) {
        let cur = [], len = 0, n = 1;
        const flush = () => { if (cur.length) out.push({ take: `${who}-${n++}`, who, voice: VOICES[who].id, ids: cur, text: cur.map((i) => LINES[i].text).join(' [long pause] ') }); cur = []; len = 0; };
        for (const id of ids) {
            const t = LINES[id].text.length;
            if (cur.length >= MAX_LINES || len + t > MAX_CHARS) flush();
            cur.push(id); len += t + 14;
        }
        flush();
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(takes(), null, 1));
