/**
 * heroes.js — the three Cardbound classes, their starting decks, and the
 * procedural name and look each run rolls for them.
 */

import { makeRng } from './rng.js';
import { playCard, jokerCard, arcanaCard } from './cards.js';
import { hslToHex } from './monsters.js';

export const HEROES = {
    knight: {
        name: 'The Blade-Oath', blurb: 'A sworn knight of a fallen order. Hits hard, stands firm.',
        hp: 75, relic: 'oathbrand', bias: ['S', 'D'], weapon: 'sword', gold: 99,
        // 20 cards; no rank appears more than three times
        deck: [['S', 2], ['S', 3], ['S', 5], ['S', 7], ['S', 8], ['S', 9], ['D', 3], ['D', 4], ['D', 6], ['D', 7], ['D', 8],
            ['C', 2], ['C', 4], ['C', 6], ['C', 7], ['H', 2], ['H', 4], ['H', 5], ['H', 8], ['S', 6]],
        extra: [],
    },
    witch: {
        name: 'The Hearth-Witch', blurb: 'A hedge-witch who cooks with fire. Every heal is also a blow.',
        hp: 65, relic: 'kettle', bias: ['H', 'C'], weapon: 'staff', gold: 99,
        deck: [['H', 2], ['H', 3], ['H', 5], ['H', 7], ['H', 8], ['H', 9], ['C', 3], ['C', 4], ['C', 6], ['C', 7], ['C', 8],
            ['S', 2], ['S', 4], ['S', 6], ['D', 3], ['D', 5], ['D', 7], ['D', 8], ['S', 5]],
        extra: [['arcana', 'hex']],
    },
    rogue: {
        name: 'The Coin-Rogue', blurb: 'A card-sharp with quick hands and a loaded die. Lives by luck.',
        hp: 62, relic: 'loadedDie', bias: ['D', 'S'], weapon: 'daggers', gold: 140,
        deck: [['D', 2], ['D', 4], ['D', 5], ['D', 7], ['D', 9], ['S', 3], ['S', 4], ['S', 6], ['S', 8], ['C', 2], ['C', 5],
            ['C', 6], ['C', 8], ['H', 3], ['H', 4], ['H', 7], ['H', 9], ['D', 6], ['S', 7]],
        extra: [['joker']],
    },
};
export const HERO_KEYS = Object.keys(HEROES);

const NAME_A = ['Ash', 'Bren', 'Cael', 'Dara', 'Esk', 'Fael', 'Gwen', 'Hal', 'Isen', 'Jun', 'Kess', 'Lio', 'Mira', 'Nox', 'Oren', 'Pim', 'Rhys', 'Sabe', 'Tove', 'Vel', 'Wren', 'Yael'];
const NAME_B = ['a', 'ric', 'wyn', 'len', 'mir', 'ane', 'is', 'ow', 'eth', 'ra', 'on', 'elle', 'ard', 'ith'];
const EPITHET = ['of the Last Deal', 'Ember-Hand', 'the Unfolded', 'Ashwalker', 'the Ninth Cardbound', 'Crowntaker', 'of the Grey River', 'the Patient', 'Heartseeker', 'the Stubborn'];

export function heroIdentity(seed, cls) {
    const rng = makeRng(seed ^ 0x51f);
    const name = rng.pick(NAME_A) + (rng.chance(0.5) ? rng.pick(NAME_B) : '');
    const hue = rng.next();
    const look = {
        cls,
        cloak: hslToHex(hue, rng.range(0.35, 0.7), rng.range(0.22, 0.38)),
        trim: hslToHex(hue + rng.range(0.35, 0.65), rng.range(0.5, 0.8), rng.range(0.5, 0.65)),
        skin: hslToHex(rng.range(0.03, 0.1), rng.range(0.25, 0.5), rng.range(0.3, 0.75)),
        metal: rng.pick([0xc8ccd8, 0xd8b060, 0x9aa0b0, 0xb87850]),
        glow: hslToHex(hue + 0.5, 0.9, 0.6),
        hood: cls === 'witch' ? 'hat' : cls === 'knight' ? (rng.chance(0.6) ? 'helm' : 'hood') : 'hood',
        cape: rng.chance(0.7),
        seed: Math.floor(rng.next() * 1e9),
    };
    return { name, epithet: rng.pick(EPITHET), look };
}

export function starterDeck(cls, nextUid) {
    const h = HEROES[cls];
    const deck = h.deck.map(([s, r]) => playCard(nextUid(), r, s));
    for (const x of h.extra) {
        if (x[0] === 'arcana') deck.push(arcanaCard(nextUid(), x[1]));
        if (x[0] === 'joker') deck.push(jokerCard(nextUid()));
    }
    return deck;
}
