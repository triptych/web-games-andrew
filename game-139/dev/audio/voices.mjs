// voices.mjs — the voice takes for ElevenLabs (eleven_v4), built from the game's own lines so the
// recordings match the text. One take per character, lines separated by [long pause]; process.py
// cuts them apart. Writes dev/audio/voices.json and prints each take.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIVALS } from '../../js/sim/data/rivals.js';
import { NARRATOR } from '../../js/sim/data/inn.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// voice ids from creative_list_voices (characters_animation, plus an older-British-female search)
export const CAST = {
    brannoc: ['N2lVS1w4EtoT3dr4eOWO', 'Callum - Husky Trickster', '[amused]'],
    quell: ['dmWfLQZJq7wNPv9WmtiM', 'Emma - Wry, Gritty Hero', '[dry, quiet]'],
    flint: ['wiy1Gg8ir59Wz8fJAOFD', 'Chad', '[weary, deadpan]'],
    marrow: ['b8JMPeNuVrqqWExQc8e9', 'Ayla - Bubbly, Cute & Expressive', '[excited]'],
    corvina: ['aAsWcN5jdLdiYG7Hq0YL', 'Harriet - Mature British Actress', '[haughty]'],
    moss: ['3VkFsBHdRPqWKsitgYhJ', 'Azgar the Cursed', '[softly, shy]'],
    rook: ['SOYHLrjzK2X1ezoPC6cr', 'Harry - Fierce Warrior', '[frustrated]'],
    oriel: ['jTAlT4VvvXlYNDrxqpNQ', 'Andrea - British female character voice', '[mysterious]'],
    varr: ['EMYWJ6jws25NB7xJgDxG', 'Dusty Garner', '[firm]'],
    choir: ['6qtlupOXBYtv2nYY2VgL', 'Grav - Deep, Dark & Sinister', '[whispering]'],
    vesper: ['3bMMFnv44fDwVPsFtKwZ', 'Elowen - Elf', '[earnest]'],
    mott: ['S9V0fuqWOqX0i8Kb8ctu', 'Alden - Tired Old Man', '[fussy]'],
    tally: ['3iiStphdvgUy5uqHXWlG', 'ross', '[prim]'],
    garr: ['lpJ712UnnFDmLdkFINx5', 'Angus - Calm & Measured', '[booming]'],
    thorn: ['kkPJzQOWz2Oz9cUaEaQd', 'Beatrice - Mature Female Storyteller', '[coldly calm]'],
};
const takes = {};
for (const [id, [voice, name, tag]] of Object.entries(CAST)) {
    const L = RIVALS[id].lines;
    const keys = id === 'thorn' ? ['arrive', 'cleared'] : ['arrive', 'accept'];
    takes[id] = { voice, name, lines: keys.map((k) => `${id}-${k}`), text: keys.map((k) => `${tag} ${L[k]}`).join(' [long pause] ') };
}
takes.narrator = {
    voice: 'LvmvHEBEmMJBJw9UuhwO', name: 'Eldrin - Wise Epic Fantasy Narration Storyteller',
    lines: Object.keys(NARRATOR).map((k) => `narrator-${k}`),
    text: Object.values(NARRATOR).map((t) => `[dry, wry] ${t}`).join(' [long pause] '),
};
fs.writeFileSync(path.join(HERE, 'voices.json'), JSON.stringify(takes, null, 1));
let n = 0;
for (const [id, t] of Object.entries(takes)) { n += t.text.length; console.log(`${id}|${t.voice}|${t.text}`); }
console.log('chars', n);
