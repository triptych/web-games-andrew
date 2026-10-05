// Alien species: language, looks, temperament, tastes. All from the galaxy seed.

import { RNG, sub } from '../rng.js';
import { GOODS } from '../config.js';
import { makeLanguage, word } from './names.js';

export const BODY_PLANS = ['insectoid', 'cephalopod', 'reptilian', 'avian', 'crystalline', 'fungoid', 'mammalian', 'amphibian'];
export const STYLES = ['ring', 'spindle', 'spiky', 'pods', 'lattice'];

export const TEMPERAMENTS = {
    mercantile: { name: 'Mercantile', gov: ['Combine', 'Exchange', 'Syndicate', 'Guildery'], standing: 1.2, spread: 1.0,
        missions: { deliver: 3, procure: 3, mining: 2, survey: 1, salvage: 1, bounty: 1, clear: 0.5, chart: 0.5, envoy: 0.5 },
        greet: ['Credits are the only honest language, Wright. Speak it well.', 'Welcome, welcome! Everything is for sale, including advice.', 'Our ledgers have room for one more friend.', 'Trade makes kin of strangers. What have you brought?'] },
    scholarly: { name: 'Scholarly', gov: ['Collegium', 'Archive', 'Lyceum', 'Conclave'], standing: 1.0, spread: 0.9,
        missions: { deliver: 1, procure: 1.5, mining: 1, survey: 3, salvage: 2, bounty: 0.5, clear: 0.5, chart: 3, envoy: 1 },
        greet: ['Ah, a field researcher. Have you catalogued anything new?', 'The Archive welcomes data, and those who bring it.', 'Every star is a question. Do you carry answers?', 'Please mind the specimens on your way in.'] },
    martial: { name: 'Martial', gov: ['Dominion', 'Legion', 'Hegemony', 'Warband'], standing: 0.8, spread: 1.1,
        missions: { deliver: 1, procure: 1.5, mining: 1, survey: 0.5, salvage: 1, bounty: 3, clear: 3, chart: 0.5, envoy: 0.5 },
        greet: ['State your business, outsider. Briefly.', 'Strength is respected here. Show us yours.', 'Our guns are watching you, Wright. Be useful.', 'The Reavers bleed us. Help us bleed them back.'] },
    mystic: { name: 'Mystic', gov: ['Choir', 'Communion', 'Veil', 'Reverie'], standing: 1.0, spread: 1.0,
        missions: { deliver: 2, procure: 1, mining: 1, survey: 1.5, salvage: 1, bounty: 0.5, clear: 0.5, chart: 2, envoy: 2 },
        greet: ['The Signal sang of your coming, little ship.', 'You walk in starlight. Walk softly.', 'All roads curve toward the Heart. Even yours.', 'We dreamed your hull. It was smaller in the dream.'] },
    hive: { name: 'Hive', gov: ['Brood', 'Hive', 'Swarm-Mind', 'Nest'], standing: 0.7, spread: 1.2,
        missions: { deliver: 2, procure: 3, mining: 3, survey: 0.5, salvage: 1, bounty: 1, clear: 1, chart: 0.5, envoy: 0.5 },
        greet: ['WE NOTE YOUR ARRIVAL. WE REQUIRE MATERIALS.', 'ONE-MIND. YOU ARE ONE-MIND. CURIOUS.', 'THE NEST GROWS. YOU MAY ASSIST IT GROWING.', 'TRANSACT. THEN DEPART.'] },
    nomadic: { name: 'Nomadic', gov: ['Flotilla', 'Caravan', 'Drift', 'Wanderfleet'], standing: 1.3, spread: 1.1,
        missions: { deliver: 3, procure: 1.5, mining: 1, survey: 1.5, salvage: 2, bounty: 1, clear: 1, chart: 2, envoy: 1 },
        greet: ['Another drifter! Share a cup before you sell us anything.', 'We were never here long. Neither are you. Let us trade quickly.', 'The road is long. Fuel, friend?', 'Every port is home if the prices are kind.'] },
};

const PALETTES = [
    ['#5fa86a', '#2f5a3a', '#ffe36b', '#d9f27a'], ['#c46a4a', '#6a2f22', '#7af7ff', '#ffb36b'],
    ['#6a7ad8', '#2a2f6a', '#ffef9a', '#b0c0ff'], ['#d8b45a', '#6a5422', '#ff4a6a', '#fff2b0'],
    ['#9a5ad8', '#3a1f5a', '#7affb2', '#e6b8ff'], ['#4ab8b8', '#1f4a54', '#ff7ad1', '#a8fff0'],
    ['#d86a9a', '#5a2240', '#9aff6a', '#ffc2e0'], ['#8a9aa8', '#2f3a46', '#ffb547', '#e2ecf6'],
    ['#e08a3a', '#5a2f12', '#5ef0ff', '#ffd9a8'], ['#7ab84a', '#2f4a1a', '#ff5470', '#d9ffa8'],
    ['#b8c8e8', '#4a5a7a', '#ff6bd6', '#ffffff'], ['#a84a4a', '#3a1414', '#ffe36b', '#ff9f8a'],
];

export function generateSpecies(seedHash, count) {
    const rng = new RNG(sub(seedHash, 'species'));
    const bodies = rng.shuffle(BODY_PLANS.slice());
    const temps = Object.keys(TEMPERAMENTS);
    const palettes = rng.shuffle(PALETTES.slice());
    const out = [];
    const usedNames = new Set();
    for (let i = 0; i < count; i++) {
        const r = new RNG(sub(seedHash, 'species', i));
        const lang = makeLanguage(r);
        let n = word(lang, r, 2, 3);
        while (usedNames.has(n)) n = word(lang, r, 2, 3);
        usedNames.add(n);
        // Make sure each temperament appears at least once before repeats (with 8 species and 6 temperaments).
        const temperament = i < temps.length ? temps[(i + (seedHash % temps.length)) % temps.length] : r.pick(temps);
        const T = TEMPERAMENTS[temperament];
        const goods = r.shuffle(GOODS.slice());
        const pal = palettes[i % palettes.length];
        const style = r.pick(STYLES);
        const sp = {
            id: i,
            name: n,
            gov: `${n} ${r.pick(T.gov)}`,
            lang,
            body: bodies[i % bodies.length],
            temperament,
            hostile: false,
            palette: { skin: pal[0], dark: pal[1], eye: pal[2], accent: pal[3] },
            face: {
                eyes: r.pick([1, 2, 2, 2, 3, 4, 6]),
                eyeSize: r.range(0.7, 1.4),
                mouth: r.pick(['beak', 'mandibles', 'slit', 'tentacles', 'grin', 'tube', 'none']),
                crest: r.pick(['none', 'horns', 'antennae', 'fins', 'frills', 'spikes', 'crown', 'tendrils']),
                marking: r.pick(['none', 'spots', 'stripes', 'chevrons', 'freckles', 'glow']),
                headShape: r.range(0.75, 1.3),
                jaw: r.range(0.7, 1.3),
                seed: r.int(1, 1e9),
            },
            craves: goods.slice(0, 3),
            makes: goods.slice(3, 6),
            taboo: r.chance(0.6) ? r.pick(['arms', 'stims']) : goods[6],
            style,
            ship: { a: pal[0], b: pal[1], c: pal[3], seed: r.int(1, 1e9) },
            greet: T.greet,
            voice: r.range(0.6, 1.6), // comm burble pitch
        };
        // Never crave and make the same, and never crave its own taboo.
        sp.craves = sp.craves.filter((g) => g !== sp.taboo);
        sp.makes = sp.makes.filter((g) => g !== sp.taboo);
        out.push(sp);
    }
    // One species is the hostile Swarm: martial + hive-ish behaviour; it lives far from home.
    const hostileIdx = rng.int(0, count - 1);
    out[hostileIdx].hostile = true;
    out[hostileIdx].temperament = 'martial';
    out[hostileIdx].gov = `${out[hostileIdx].name} Swarm`;
    out[hostileIdx].greet = ['YOUR KIND IS TOLERATED. BARELY.', 'LEAVE OUR STARS, SOFT ONE.', 'WE HAVE COUNTED YOUR SHIELDS. THEY ARE FEW.'];
    return out;
}

export function speciesGreeting(sp, rng) { return rng.pick(sp.greet); }
