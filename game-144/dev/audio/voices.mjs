/**
 * voices.mjs — the ElevenLabs voice takes for NEBULA REQUIEM, built from the story script (js/sim/data/story.js).
 *
 *   node game-144/dev/audio/voices.mjs            # prints { who: { voice, text, ids } } as JSON
 *   node game-144/dev/audio/voices.mjs ids sora   # the voice ids of one take, in order (process.py splits by these)
 *
 * One eleven_v4 take per character holds all of their lines separated by [long pause]; process.py cuts the take at
 * its longest silences and names each clip after the line's `vo` id.
 */
import { allLines } from '../../js/sim/data/story.js';

export const CAST = {
    sora: { voice: 'W3C2vBPukr5b5jvoXhPK', name: 'Kira X - Video Game, Bold & Cinematic', tag: '[determined]' },
    kaito: { voice: 'OwEAPhTFInN6VSRT9QXm', name: 'Jordan - Warm & Gritty', tag: '[quietly, somber]' },
    lyra: { voice: 's2uzisFuqsY1HHe8wLTA', name: 'K', tag: '[calm, softly]' },
    mei: { voice: 'jTAlT4VvvXlYNDrxqpNQ', name: 'Andrea - British female character voice', tag: '[composed, over a radio]' },
    seraphine: { voice: 'Qbw4VpyUrHEG7NigKzty', name: 'Kristen - Cold Evil Queen Villain', tag: '[serene, menacing]' },
    voss: { voice: 'erjfZbWOeOlXoejyglLN', name: 'Lord Alistair - British Aristocrat', tag: '[cold, contemptuous]' },
    hikari: { voice: 'Wu9A8zlwvFHoEpuX7MGo', name: 'Libby-Animated', tag: '[gently, sad]' },
    system: { voice: 'h5EerLZbdVHFXe9rEGjM', name: 'Georgia K', tag: '[flat, calm, like a ship computer]' },
};

// Lines that want something other than the character's usual delivery.
const DELIVERY = {
    'launch-launch-sora': '[shouting, excited]', 'boss1-sora-0': '[shouting]', 'boss3-sora-1': '[shouting]', 'boss4-sora-1': '[shocked, angry]',
    'boss6-sora-1': '[desperate, shouting]', 'sora-hikari-1': '[crying, shouting]', 'sora-end-1': '[tearful, happy]',
    'boss4-kaito-1': '[cold fury]', 'kaito-voss-1': '[quietly]', 'kaito-end-2': '[a small laugh]',
    'launch-launch-lyra': '[uncertain]', 'lyra-end-2': '[warmly, a hint of a smile]', 'boss6-lyra-1': '[firmly]',
    'stage6-0': '[emotional]', 'gameover-0': '[urgent, panicked]', 'stage3-0': '[urgent]', 'sora-end-2': '[warmly]',
    'heart-1': '[whispering]', 'boss4-voss-0': '[sneering]',
};

export function takes() {
    const by = {};
    for (const l of allLines()) {
        const c = CAST[l.who];
        if (!c) throw new Error('no voice for ' + l.who);
        (by[l.who] ||= { voice: c.voice, name: c.name, lines: [] }).lines.push(l);
    }
    const out = {};
    for (const [who, t] of Object.entries(by)) {
        out[who] = {
            voice: t.voice, name: t.name, ids: t.lines.map((l) => l.vo),
            text: t.lines.map((l) => `${DELIVERY[l.vo] || CAST[who].tag} ${l.text}`).join(' [long pause] '),
        };
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const T = takes();
    if (process.argv[2] === 'ids') console.log(T[process.argv[3]].ids.join('\n'));
    else console.log(JSON.stringify(T, null, 1));
}
