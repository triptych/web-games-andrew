// prints the voice takes (one per character) for the ElevenLabs flow; moved to dev/audio/ later
import { VOICES } from '../../js/voices.js';
const TAG = {
    narrator: '[slow, solemn storytelling]', marta: '[warm]', odo: '[cheerful]', varga: '[gruff]', elowen: '[gentle]', pell: '[upbeat]', ansel: '[weary]',
    ossuary_knight: '[menacing, slow]', mother_mycelia: '[whispers]', brine_leviathan: '[deep, slow, menacing]', forgefather: '[angry]',
    winter_lich: '[cold, menacing]', elder_briar: '[deep, slow]', orrery_engine: '[robotic, flat]', hollow_king: '[menacing, slow]', reaper: '[whispers]',
};
const HERO = ['[shouting]', '[satisfied]', '[pained, weak]', '[confident]'];
for (const [id, v] of Object.entries(VOICES)) {
    const tags = TAG[id];
    const text = v.lines.map((l, i) => `${tags || HERO[i]} ${l}`).join(' [long pause] ');
    console.log(JSON.stringify({ id, voice: v.voice, text }));
}
