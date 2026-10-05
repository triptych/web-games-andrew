// Phoneme-driven name generation. Each species gets a "language" (sets of onsets,
// vowels and codas plus habits), so its own names sound related to one another.

import { RNG } from '../rng.js';

const ONSETS = ['b', 'd', 'g', 'k', 'kr', 'kh', 'l', 'm', 'n', 'p', 'r', 's', 'sh', 't', 'th', 'v', 'z', 'zh', 'x', 'q', 'vr', 'tl', 'dr', 'gr', 'h', 'y', 'ch', 'ss', 'f', 'j', 'xh', 'mn', 'ts'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'aa', 'ae', 'ai', 'ou', 'ee', 'oo', 'y', 'ia', 'eo', 'ua', 'ö', 'ä'];
const CODAS = ['', '', '', 'n', 'r', 'l', 's', 'th', 'k', 'x', 'm', 'sh', 'q', 'rn', 'nd', 'z', 'ss', 'v'];

export function makeLanguage(rng) {
    const pickN = (arr, n) => rng.shuffle(arr.slice()).slice(0, n);
    return {
        onsets: pickN(ONSETS, rng.int(6, 11)),
        vowels: pickN(VOWELS, rng.int(3, 6)),
        codas: pickN(CODAS, rng.int(3, 6)),
        minSyl: rng.int(1, 2),
        maxSyl: rng.int(2, 3),
        apostrophe: rng.chance(0.3) ? rng.range(0.15, 0.4) : 0,
        hyphen: rng.chance(0.15) ? 0.3 : 0,
        vowelStart: rng.range(0, 0.35),
    };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function word(lang, rng, minSyl = lang.minSyl, maxSyl = lang.maxSyl) {
    const n = rng.int(minSyl, maxSyl);
    let s = '';
    for (let i = 0; i < n; i++) {
        if (!(i === 0 && rng.chance(lang.vowelStart))) s += rng.pick(lang.onsets);
        s += rng.pick(lang.vowels);
        if (i === n - 1 || rng.chance(0.3)) s += rng.pick(lang.codas);
        if (i < n - 1 && lang.apostrophe && rng.chance(lang.apostrophe)) s += "'";
        else if (i < n - 1 && lang.hyphen && rng.chance(lang.hyphen)) s += '-';
    }
    s = s.replace(/(.)\1\1+/g, '$1$1').replace(/^'+|'+$/g, '');
    if (s.length < 3) s += rng.pick(lang.vowels) + rng.pick(lang.codas.filter(Boolean).concat(['n']));
    return cap(s.slice(0, 12));
}

export function name(lang, rng) { return word(lang, rng); }

// A neutral language for frontier systems.
export const FRONTIER_LANG = makeLanguage(new RNG(424242));

const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Sigma', 'Tau', 'Omega'];
const CATALOG = ['HD', 'GJ', 'KX', 'LHS', 'TOI', 'WR', 'Ross', 'Wolf', 'Lacaille', 'Gliese'];
export function catalogName(rng) {
    return rng.chance(0.5) ? `${rng.pick(CATALOG)} ${rng.int(100, 9999)}` : `${rng.pick(GREEK)} ${word(FRONTIER_LANG, rng, 2, 2)}`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n) => ROMAN[n - 1] || String(n);

const PIRATE_FIRST = ['Grix', 'Mara', 'Vok', 'Sela', 'Dren', 'Hask', 'Nyx', 'Torv', 'Kell', 'Ziva', 'Bram', 'Rook', 'Juno', 'Skarn', 'Oda', 'Vex'];
const PIRATE_EPITHET = ['the Ashen', 'Two-Moons', 'the Gutter Saint', 'Ironjaw', 'the Quiet', 'Red Comet', 'the Collector', 'Blackwake', 'the Debt', 'Halfburn', 'the Smiling', 'Coldfire', 'the Unpaid', 'Slagheart'];
export function pirateName(rng) { return `${rng.pick(PIRATE_FIRST)} ${rng.pick(PIRATE_EPITHET)}`; }

const STATION_SUFFIX = { outpost: ['Outpost', 'Post', 'Waystation', 'Camp'], hub: ['Exchange', 'Bazaar', 'Market', 'Hub'], shipyard: ['Yards', 'Drydock', 'Foundry'], refinery: ['Refinery', 'Works', 'Smelter'], embassy: ['Embassy', 'Spire', 'Concord Hall'], den: ['Den', 'Hole', 'Roost'] };
export function stationName(lang, rng, kind) { return `${word(lang, rng, 1, 2)} ${rng.pick(STATION_SUFFIX[kind] || STATION_SUFFIX.outpost)}`; }
