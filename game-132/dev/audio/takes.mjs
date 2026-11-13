// takes.mjs [who] — the ElevenLabs speech takes for GIANT'S VAULT, built from the game's own text.
// One take per speaker, every line separated by [long pause]; process.py cuts a take at its longest pauses and names
// the pieces in this order. `node game-132/dev/audio/takes.mjs narrator` prints one take;
// `takes.mjs narrator intro,act3` prints a take of just those lines, to re-record them (save it as
// take-narrator.intro+act3.mp3 and process.py replaces only those clips).
import { CARDS } from '../../js/sim/data/world.js';
import { BOSSES } from '../../js/sim/data/monsters.js';

export const TAKES = {
    narrator: Object.keys(CARDS).map((id) => ({ id: `vo-card-${id}`, text: `${CARDS[id].title}. ${CARDS[id].text}` })),
    ...Object.fromEntries(Object.entries(BOSSES).map(([b, B]) => [b, [
        ...B.taunt.map((t, i) => ({ id: `vo-${b}-${i}`, text: t })),
        { id: `vo-${b}-death`, text: B.death },
    ]])),
};
const DELIVERY = { narrator: '[slow, grave, epic]', skyllith: '[hissing, monstrous]', morwen: '[cold, regal, amused]', kolossar: '[booming, ancient, furious]' };
/** The lines of a take: all of a speaker's, or only those whose id ends in one of `only` (e.g. ['intro', 'act3']). */
export const takeLines = (who, only = null) => TAKES[who].filter((l) => !only || only.includes(l.id.split('-').pop()));
export const takeText = (who, only = null) => `${DELIVERY[who]} ` + takeLines(who, only).map((l) => l.text).join(' [long pause] ');

if (import.meta.url === `file://${process.argv[1]}`) {
    const who = process.argv[2];
    if (who === '--json') { console.log(JSON.stringify(Object.fromEntries(Object.entries(TAKES).map(([w, l]) => [w, l.map((x) => x.id)])))); process.exit(0); }
    const only = process.argv[3] ? process.argv[3].split(',') : null;
    for (const w of who ? [who] : Object.keys(TAKES)) console.log(`== ${w} (${takeLines(w, only).length} lines)\n${takeText(w, only)}\n`);
}
