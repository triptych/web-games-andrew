// takes.mjs — the voice script, built from the game's data: one take per character holding all of their lines,
// separated by [long pause], so each character is one ElevenLabs generation (eleven_v4). process.py splits the takes.
// `node game-135/dev/audio/takes.mjs` prints { giver: { voice, text, lines: [clip names in order] } }.
import { JOBS, GIVERS, SPEECH, CALLS } from '../../js/sim/data/jobs.js';

const TAG = { mayor: '[warmly]', dot: '[excited]', finch: '[gently]', gus: '[chuckles]', rosa: '[confident]', pip: '[excited]' };
export const TAKES = {};
const add = (giver, clip, text) => {
    const t = (TAKES[giver] ||= { voice: GIVERS[giver].voice, lines: [], parts: [] });
    t.lines.push(clip); t.parts.push(text);
};
add(SPEECH.intro.giver, 'intro', SPEECH.intro.text);
for (const j of JOBS) { add(j.giver, `${j.id}-brief`, j.brief); add(j.giver, `${j.id}-done`, j.done); }
add(SPEECH.finale.giver, 'finale', SPEECH.finale.text);
for (const [veh, call] of Object.entries(CALLS)) add('rosa', `call-${veh}`, call);
for (const [g, t] of Object.entries(TAKES)) { t.text = t.parts.map((p) => `${TAG[g]} ${p}`).join(' [long pause] '); delete t.parts; }

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(TAKES, null, 1));
