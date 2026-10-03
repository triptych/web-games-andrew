/**
 * campaign.js — level progression for the campaign and for Endless Descent.
 */
import { LEVELS, DESCENT_WORDS } from './story.js';
import { makeRng, subSeed } from './rng.js';

/** Weapons the generator may assume you own by the start of campaign level i. */
export function arsenalFor(i) {
    const out = ['blade', 'pistol'];
    for (let k = 0; k < i && k < LEVELS.length; k++) if (LEVELS[k].weapon) out.push(LEVELS[k].weapon);
    return out;
}

const DESCENT_UNLOCK = [
    ['husk', 'imp'], ['hound', 'wisp'], ['gazer'], ['skitter'], ['brute'], ['revenant'], ['hierophant'], ['juggernaut'],
];
const DESCENT_WEAPONS = ['shotgun', 'chaingun', 'rocket', 'ssg', 'plasma', 'rail', 'bfg'];

/** Endless Descent: floor n (1-based). Every fifth floor has a guardian. */
export function descentSpec(n, seed) {
    const rng = makeRng(subSeed(seed, 'descent', n));
    const themes = ['station', 'foundry', 'hell'];
    const theme = n % 10 === 0 ? 'throne' : themes[Math.floor((n - 1) / 3) % 3];
    const roster = [];
    for (let k = 0; k < Math.min(DESCENT_UNLOCK.length, 1 + Math.ceil(n * 0.8)); k++) roster.push(...DESCENT_UNLOCK[k]);
    // later floors drop the weakest fodder now and then
    if (n > 8 && rng.chance(0.5)) roster.splice(roster.indexOf('husk'), 1);
    const boss = n % 5 === 0 ? (n % 10 === 0 ? 'archon' : (n / 5) % 2 === 1 ? 'overseer' : 'mother') : null;
    const arena = boss === 'archon';
    return {
        id: `D${n}`,
        name: `${rng.pick(DESCENT_WORDS.a)} ${rng.pick(DESCENT_WORDS.b)}`,
        theme,
        size: arena ? 40 : Math.min(72, 44 + n * 2),
        rooms: arena ? 5 : Math.min(19, 8 + Math.floor(n * 0.8)),
        keys: arena ? 0 : Math.min(3, 1 + Math.floor((n - 1) / 3)),
        par: 120 + n * 25,
        roster,
        weapon: DESCENT_WEAPONS[n - 1] ?? null,
        boss,
        arena,
        logs: [],
        intro: boss ? 'A guardian waits below. The exit stays sealed until it falls.' : 'Find the keys. Find the way down. Keep going.',
        vesper: null,
    };
}

export function descentArsenal(n) {
    return ['blade', 'pistol', ...DESCENT_WEAPONS.slice(0, Math.max(0, n - 1))];
}
