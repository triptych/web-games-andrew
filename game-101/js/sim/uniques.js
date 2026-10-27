// Unique artifacts: hand-made epic items with a name, a story and an effect no generated item has.
// Each exists once per game (G.uniques records what has been found). Their numbers scale with the item
// level of the floor they drop on, like everything else. Pure.

import { genWeapon, genArmor, genCharm, priceOf } from './items.js';

/** fx keys: lifesteal, vorpal, thorns, regen, mpregen, xp, gold, resist (fractions); first, revive (flags). */
export const UNIQUES = [
    { id: 'emberfang', name: 'Emberfang', t: 'w', base: 'sword', elem: 'fire', minD: 5, fx: { lifesteal: 0.08 }, lore: 'Forged for a king who burned his own city to keep it from the dark. The blade is still warm.' },
    { id: 'widowmaker', name: 'Widowmaker', t: 'w', base: 'bow', minD: 6, fx: { vorpal: 0.04 }, crit: 0.08, lore: 'Every arrow it looses is a letter somebody never receives.' },
    { id: 'gravesong', name: 'Gravesong', t: 'w', base: 'staff', elem: 'dark', minD: 7, fx: { mpregen: 0.07 }, lore: 'Hum with it, and the dead hum back.' },
    { id: 'stormcaller', name: 'Stormcaller', t: 'w', base: 'axe', elem: 'shock', minD: 8, fx: { thorns: 0.25 }, lore: 'It has never been dry. It has never been quiet.' },
    { id: 'quietknife', name: 'The Quiet Knife', t: 'w', base: 'dagger', minD: 9, fx: { vorpal: 0.06, first: true }, lore: 'You will not hear it. Neither will they.' },
    { id: 'sunspear', name: 'Sunspear', t: 'w', base: 'spear', elem: 'holy', minD: 11, fx: { lifesteal: 0.06 }, lore: 'Carried out of the first dungeon by someone who did not come back for it.' },
    { id: 'mercy', name: 'Mace of Mercy', t: 'w', base: 'mace', elem: 'holy', minD: 12, fx: { mpregen: 0.06, regen: 0.02 }, lore: 'Heavy, kind, and only ever used once per head.' },
    { id: 'whisper', name: 'Whisper Whip', t: 'w', base: 'whip', minD: 13, fx: { first: true, vorpal: 0.03 }, lore: 'The crack arrives before the swing.' },
    { id: 'cinders', name: 'Wand of Cinders', t: 'w', base: 'wand', elem: 'fire', minD: 14, fx: { mpregen: 0.09 }, lore: 'Burnt down to a stub, and it still lights every candle in the room.' },
    { id: 'crownash', name: 'Crown of Ash', t: 'a', base: 'circlet', slot: 'head', minD: 10, fx: { xp: 0.15 }, lore: 'Worn by thirty kings; the dust of each is in the band.' },
    { id: 'mothmantle', name: 'Mantle of Moths', t: 'a', base: 'robe', minD: 9, fx: { resist: 0.18, mpregen: 0.04 }, lore: 'It is mostly holes, and the holes are mostly stars.' },
    { id: 'oathplate', name: 'Oathplate', t: 'a', base: 'plate', minD: 15, fx: { thorns: 0.25, regen: 0.03 }, lore: 'Every dent is a promise somebody kept.' },
    { id: 'lastmile', name: 'Boots of the Last Mile', t: 'a', base: 'boots', minD: 8, fx: { first: true, regen: 0.04 }, lore: 'They always know which way is up.' },
    { id: 'greed', name: 'Gauntlets of Greed', t: 'a', base: 'gauntlets', minD: 7, fx: { gold: 0.3 }, lore: 'They close on anything that glitters. It is hard to get them to let go.' },
    { id: 'aegis', name: 'Aegis of Dawn', t: 'a', base: 'tower', slot: 'shield', minD: 16, fx: { resist: 0.22, revive: true }, lore: 'Polished by an ocean of sunrises.' },
    { id: 'secondchances', name: 'Ring of Second Chances', t: 'c', base: 'ring', minD: 6, fx: { revive: true }, lore: 'Engraved inside: "Try again."' },
    { id: 'lanterncharm', name: 'Lantern Charm', t: 'c', base: 'charm', minD: 4, fx: { xp: 0.1, regen: 0.02 }, lore: 'A flame the size of a grain of rice that has never gone out.' },
    { id: 'deepamulet', name: 'Amulet of the Deep', t: 'c', base: 'amulet', minD: 18, fx: { gold: 0.2, xp: 0.12 }, lore: 'It gets heavier the further down you carry it, and you are glad.' },
];
export const UNIQUE_BY_ID = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

const FX_TEXT = {
    lifesteal: (v) => `Lifesteal ${Math.round(v * 100)}%`, vorpal: (v) => `Vorpal ${Math.round(v * 100)}% (instant kill)`, thorns: (v) => `Thorns ${Math.round(v * 100)}%`,
    regen: (v) => `Regen ${Math.round(v * 100)}% HP/round`, mpregen: (v) => `Focus ${Math.round(v * 100)}% MP/round`, xp: (v) => `+${Math.round(v * 100)}% XP`,
    gold: (v) => `+${Math.round(v * 100)}% gold`, resist: (v) => `Resist all elements ${Math.round(v * 100)}%`, first: () => 'Strikes first', revive: () => 'Once a battle, rises from a killing blow',
};
export const fxText = (fx) => Object.keys(fx || {}).filter((k) => FX_TEXT[k]).map((k) => FX_TEXT[k](fx[k]));

/** Build the artifact at an item level. */
export function genUnique(rng, id, ilvl) {
    const u = UNIQUE_BY_ID[id];
    const o = { base: u.base, rar: 4, noCurse: true, ...(u.slot ? { slot: u.slot } : {}) };
    const it = u.t === 'w' ? genWeapon(rng, ilvl, o) : u.t === 'a' ? genArmor(rng, ilvl, o) : genCharm(rng, ilvl, o);
    for (const k of Object.keys(it.st)) if (['atk', 'mag', 'def', 'mdef'].includes(k)) it.st[k] = Math.round(it.st[k] * 1.25);
    if (u.crit) it.st.crit = (it.st.crit || 0) + u.crit;
    if (u.elem) it.elem = u.elem;
    it.name = u.name; it.key = `u:${id}`; it.unique = id; it.fx = { ...u.fx }; it.lore = u.lore; it.rar = 4; it.known = true; it.cursed = false;
    it.ilvl = ilvl;
    it.price = Math.round(priceOf(it) * 3);
    return it;
}

/** An artifact this game has not found yet and the depth allows, or null. */
export function pickUnique(G, rng, depth) {
    const left = UNIQUES.filter((u) => u.minD <= depth + 1 && !G.uniques[u.id]);
    return left.length ? rng.pick(left) : null;
}
/** Roll an artifact drop: guardians usually have one, vaults and deep chests rarely. */
export function rollUnique(G, rng, depth, chance) {
    if (rng() >= chance) return null;
    const u = pickUnique(G, rng, depth);
    if (!u) return null;
    G.uniques[u.id] = true;
    return genUnique(rng, u.id, Math.max(1, depth + 1));
}
