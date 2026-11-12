// HOLLOWDEEP — equipment, consumables and quest items. Pure data.
//
// Equipment is built from kinds × tiers: tier t is sold once the party has reached stratum t (floor 5t+1), and is
// what chests and monsters on that stratum drop. Every piece can also come up "+1" to "+3" from deep chests.
// icon: [sheet, cell] in art/icons/<sheet>.webp (4x4 atlases of 48 px; dev/art/prompts.mjs lists the cells).

export const TIERS = ['Rusty', 'Iron', 'Steel', 'Silver', 'Mithril', 'Runed', 'Starmetal', 'Hollowsteel'];
export const TIER_PRICE = [1, 2.6, 6, 13, 26, 48, 85, 140];

// per-tier base values: atk for weapons, def for armour; slot decides where it goes
export const KINDS = {
    sword: { slot: 'weapon', noun: 'Sword', atk: 6, icon: ['gear', 0], price: 40 },
    axe: { slot: 'weapon', noun: 'Axe', atk: 7.5, spd: -1, icon: ['gear', 1], price: 45 },
    dagger: { slot: 'weapon', noun: 'Dagger', atk: 4.5, spd: 1, crit: 0.06, icon: ['gear', 2], price: 34 },
    mace: { slot: 'weapon', noun: 'Mace', atk: 5.5, mag: 1, icon: ['gear', 3], price: 40 },
    staff: { slot: 'weapon', noun: 'Staff', atk: 2, mag: 4.5, mp: 2, icon: ['gear', 4], price: 42 },
    bow: { slot: 'weapon', noun: 'Bow', atk: 5.5, ranged: true, icon: ['gear', 5], price: 44 },
    heavy: { slot: 'armor', noun: 'Plate', def: 6, spd: -1, icon: ['gear', 6], price: 60 },
    light: { slot: 'armor', noun: 'Leathers', def: 4, icon: ['gear', 7], price: 40 },
    robe: { slot: 'armor', noun: 'Robe', def: 2, res: 3, mp: 2, icon: ['gear', 8], price: 38 },
    shield: { slot: 'shield', noun: 'Shield', def: 3, icon: ['gear', 9], price: 36 },
};
export const KIND_IDS = Object.keys(KINDS);

// accessories: fixed items, sold from the tier listed
export const ACCESSORIES = {
    vigor_ring: { name: 'Ring of Vigor', tier: 0, hp: 15, icon: ['gear', 10], price: 120, desc: '+15 max HP' },
    ward_amulet: { name: 'Warding Amulet', tier: 1, res: 5, icon: ['gear', 11], price: 260, desc: '+5 resistance' },
    swift_boots: { name: 'Quickstep Charm', tier: 1, spd: 4, icon: ['gear', 10], price: 300, desc: '+4 speed' },
    sage_ring: { name: 'Sage\'s Ring', tier: 2, mag: 6, mp: 8, icon: ['gear', 10], price: 640, desc: '+6 magic, +8 MP' },
    lucky_coin: { name: 'Lucky Coin', tier: 2, luk: 10, icon: ['misc', 4], price: 560, desc: '+10 luck: crits, gold, dodging' },
    war_band: { name: 'War Band', tier: 3, atk: 8, icon: ['gear', 10], price: 1300, desc: '+8 attack' },
    guard_amulet: { name: 'Bulwark Amulet', tier: 4, def: 10, res: 6, icon: ['gear', 11], price: 2600, desc: '+10 defence, +6 resistance' },
    lantern_heart: { name: 'Lantern Heart', tier: 5, hp: 60, mp: 20, icon: ['gear', 11], price: 5200, desc: '+60 HP, +20 MP' },
    star_crown: { name: 'Star Circlet', tier: 6, mag: 18, res: 12, icon: ['gear', 11], price: 9800, desc: '+18 magic, +12 resistance' },
};

// consumables. use: what it does (js/sim/game.js useItem)
export const CONSUMABLES = {
    potion: { name: 'Healing Draught', price: 20, heal: 40, tgt: 'ally', icon: ['gear', 12], desc: 'Restores 40 HP.' },
    hipotion: { name: 'Greater Draught', price: 90, heal: 160, tgt: 'ally', tier: 2, icon: ['gear', 12], desc: 'Restores 160 HP.' },
    ether: { name: 'Mana Tonic', price: 60, mp: 20, tgt: 'ally', tier: 1, icon: ['gear', 13], desc: 'Restores 20 MP.' },
    phoenix: { name: 'Phoenix Feather', price: 240, revive: 0.25, tgt: 'dead', tier: 1, icon: ['gear', 14], desc: 'Revives a fallen ally with 25% HP.' },
    antidote: { name: 'Bitterleaf', price: 12, cure: true, tgt: 'ally', icon: ['misc', 0], desc: 'Cures poison, sleep, paralysis, blindness and curses.' },
    thread: { name: 'Ariadne Thread', price: 60, escape: true, tgt: 'none', icon: ['gear', 15], desc: 'Out of battle: return to town at once.' },
    elixir: { name: 'Golden Elixir', price: 1500, heal: 9999, mp: 999, tgt: 'ally', tier: 4, icon: ['misc', 1], desc: 'Restores all HP and MP.' },
    firebomb: { name: 'Fire Flask', price: 45, dmg: 30, el: 'fire', tgt: 'enemies', icon: ['misc', 2], desc: 'Burns every foe (about 30 damage, more deeper).' },
};

// quest items: never sold, never dropped except by their quest
export const QUEST_ITEMS = {
    locket: { name: 'Tarnished Locket', icon: ['misc', 5], desc: 'A silver locket with a faded portrait inside.' },
    moonpetal: { name: 'Moonpetal', icon: ['misc', 6], desc: 'A pale flower that glows like the moon.' },
    star_iron: { name: 'Star Iron', icon: ['misc', 7], desc: 'Ore that fell from the sky, warm to the touch.' },
    old_map: { name: 'Cartographer\'s Map', icon: ['misc', 8], desc: 'A water-stained map of the Drowned Halls.' },
    frost_crystal: { name: 'Heartfrost Crystal', icon: ['misc', 9], desc: 'Never melts, even in a forge.' },
    war_banner: { name: 'Lost Banner', icon: ['misc', 10], desc: 'The banner of a company that never came back.' },
    music_box: { name: 'Brass Music Box', icon: ['misc', 11], desc: 'Still plays three notes of a lullaby.' },
    relic: { name: 'Saint\'s Relic', icon: ['misc', 12], desc: 'A finger bone in a silver reliquary.' },
};

/** The full item definition for an inventory entry { id, plus }. */
export function itemDef(id) {
    if (CONSUMABLES[id]) return { ...CONSUMABLES[id], id, type: 'use' };
    if (ACCESSORIES[id]) return { ...ACCESSORIES[id], id, type: 'gear', slot: 'acc', kind: 'acc' };
    if (QUEST_ITEMS[id]) return { ...QUEST_ITEMS[id], id, type: 'quest' };
    if (id.startsWith('satchel_')) return { name: 'Lost Satchel', icon: ['misc', 8], desc: 'A delver\'s satchel, stuffed with damp notes.', id, type: 'quest' };
    const m = /^([a-z]+)_(\d)$/.exec(id);
    if (m && KINDS[m[1]]) {
        const k = KINDS[m[1]], t = +m[2];
        const sc = 1 + t * 1.15 + t * t * 0.12;           // tier 0 → 1, tier 7 → about 15
        const d = { id, type: 'gear', kind: m[1], slot: k.slot, tier: t, name: `${TIERS[t]} ${k.noun}`, icon: k.icon, price: Math.round(k.price * TIER_PRICE[t]) };
        for (const s of ['atk', 'def', 'mag', 'res', 'mp']) if (k[s]) d[s] = Math.round(k[s] * sc);
        if (k.spd) d.spd = k.spd;
        if (k.crit) d.crit = k.crit;
        if (k.ranged) d.ranged = true;
        return d;
    }
    return null;
}

/** Stats of an owned piece of gear with its +N. */
export function gearStats(entry) {
    const d = itemDef(entry.id);
    if (!d) return {};
    const p = entry.plus || 0;
    const out = { ...d };
    for (const s of ['atk', 'def', 'mag', 'res']) if (d[s]) out[s] = Math.round(d[s] * (1 + 0.15 * p) + p);
    if (p) out.name = `${d.name} +${p}`;
    out.price = Math.round(d.price * (1 + 0.6 * p));
    return out;
}

export const sellPrice = (entry) => Math.max(0, Math.floor((gearStats(entry).price || 0) * 0.4));
