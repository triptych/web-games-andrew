// The board: forty spaces round Emberwyld Isle, four corners and four regions of nine.
// Pure data plus a couple of lookups the sim, the bot and the view all share.

import { REGIONS, TOWNS, DUNGEONS } from './data.js';

export const SPACE_INFO = {
    start: { name: 'Hearthstone', icon: '🏠', desc: 'Pass to collect gold. Land here for a feast: more gold and a full heal.' },
    shrine: { name: 'Crossroads Shrine', icon: '⛩️', desc: 'Rest: full heal and a blessing for your next battle.' },
    fountain: { name: 'Fountain of Fortune', icon: '⛲', desc: 'Every tax and lost coin ends up here. Land to take the lot.' },
    portal: { name: 'Wyrm Portal', icon: '🌀', desc: 'Step through to any space on the island.' },
    battle: { name: 'Encounter', icon: '⚔️', desc: 'Monsters! A turn-based battle.' },
    deed: { name: 'Deed', icon: '🏡', desc: 'A property to buy. Rivals pay you a toll when they land.' },
    town: { name: 'Town', icon: '🏘️', desc: 'Shop, inn, tavern and forge. You may stop here as you pass.' },
    dungeon: { name: 'Dungeon', icon: '🏰', desc: 'Three battles and a boss, for great loot.' },
    treasure: { name: 'Treasure', icon: '🎁', desc: 'A chest. Probably not a mimic.' },
    fate: { name: 'Fate', icon: '🃏', desc: 'Draw a Fate card.' },
};

const D = (id, name, price, emoji) => ({ type: 'deed', deed: id, name, price, emoji });
const SIDES = {
    meadow: [
        { type: 'battle' }, D('orchard', 'Sunny Orchard', 110, '🍎'), { type: 'fate' }, { type: 'battle' },
        { type: 'town', town: 'brookhollow' }, { type: 'battle' }, D('windmill', 'Old Windmill', 130, '🌾'),
        { type: 'treasure' }, { type: 'dungeon', dungeon: 'warren' },
    ],
    woods: [
        { type: 'battle' }, D('grove', 'Glowcap Grove', 170, '🍄'), { type: 'treasure' }, { type: 'battle' },
        { type: 'dungeon', dungeon: 'crypt' }, { type: 'fate' }, { type: 'town', town: 'fernwick' },
        { type: 'battle' }, D('treehouse', 'Elven Treehouse', 190, '🌳'),
    ],
    coast: [
        { type: 'battle' }, D('docks', 'Pearl Docks', 230, '⚓'), { type: 'fate' }, { type: 'battle' },
        { type: 'town', town: 'saltbreeze' }, { type: 'treasure' }, { type: 'battle' },
        D('lighthouse', 'Gull Lighthouse', 250, '🗼'), { type: 'dungeon', dungeon: 'grotto' },
    ],
    frost: [
        { type: 'battle' }, D('mine', 'Crystal Mine', 290, '💎'), { type: 'treasure' }, { type: 'battle' },
        { type: 'dungeon', dungeon: 'caverns' }, { type: 'battle' }, { type: 'town', town: 'hammerhold' },
        { type: 'fate' }, D('springs', 'Hot Spring Lodge', 320, '♨️'),
    ],
};

export const SPACES = [];
SPACES.push({ type: 'start', region: null });
REGIONS.forEach((r, ri) => {
    for (const s of SIDES[r.id]) SPACES.push({ ...s, region: r.id });
    if (ri < 3) SPACES.push({ type: ['shrine', 'fountain', 'portal'][ri], region: null });
});
SPACES.forEach((s, i) => {
    s.i = i;
    if (!s.name) {
        if (s.type === 'town') s.name = TOWNS[s.town].name;
        else if (s.type === 'dungeon') s.name = DUNGEONS[s.dungeon].name;
        else s.name = SPACE_INFO[s.type].name;
    }
    s.icon = s.type === 'deed' ? s.emoji : SPACE_INFO[s.type].icon;
});

export const DEEDS = SPACES.filter((s) => s.type === 'deed');
export const deedSpace = (deedId) => DEEDS.find((s) => s.deed === deedId);
export const regionDeeds = (region) => DEEDS.filter((s) => s.region === region);
export const regionOf = (i) => SPACES[i].region || (i === 0 ? 'meadow' : SPACES[(i + 1) % SPACES.length].region);
export const townSpaces = () => SPACES.filter((s) => s.type === 'town');

/** Steps forward from a to b round the ring (0 when equal). */
export const ahead = (a, b) => (b - a + SPACES.length) % SPACES.length;

/** The next space of a type strictly ahead of i. */
export function nextOfType(i, type) {
    for (let k = 1; k <= SPACES.length; k++) {
        const j = (i + k) % SPACES.length;
        if (SPACES[j].type === type) return j;
    }
    return i;
}
