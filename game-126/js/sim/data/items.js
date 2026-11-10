// EMBERSPIRE — gear, consumables, materials and the unique items. Pure data.
//
// Icons: each entry names an atlas (art/icons/<sheet>.webp, 4x4 cells of 48 px) and a cell index 0..15.

// ---------------------------------------------------------------- gear types
// w: how the item's power splits into stats. Weapons by class weapon type; armour by weight; accessories by kind.
export const GEAR = {
    sword: { kind: 'weapon', name: 'Longsword', icon: ['gear', 0], w: { atk: 1.0, mag: 0.15 } },
    axe: { kind: 'weapon', name: 'Battleaxe', icon: ['gear', 1], w: { atk: 1.15 } },
    daggers: { kind: 'weapon', name: 'Twin Daggers', icon: ['gear', 2], w: { atk: 0.9, crit: 6 } },
    bow: { kind: 'weapon', name: 'Longbow', icon: ['gear', 3], w: { atk: 1.0, spd: 0.05 } },
    staff: { kind: 'weapon', name: 'Staff', icon: ['gear', 4], w: { atk: 0.35, mag: 1.0 } },
    tome: { kind: 'weapon', name: 'Grimoire', icon: ['gear', 5], w: { mag: 1.15 } },
    lute: { kind: 'weapon', name: 'Lute', icon: ['gear', 6], w: { atk: 0.5, mag: 0.85 } },
    flask: { kind: 'weapon', name: 'Bomb Satchel', icon: ['gear', 7], w: { atk: 0.55, mag: 0.95 } },
    scythe: { kind: 'weapon', name: 'Scythe', icon: ['gear', 8], w: { atk: 0.7, mag: 0.95 } },
    heavy: { kind: 'armor', name: 'Plate', icon: ['gear', 10], w: { def: 1.2, res: 0.6, hp: 1.2 } },
    light: { kind: 'armor', name: 'Jerkin', icon: ['gear', 11], w: { def: 0.85, res: 0.8, hp: 0.9, spd: 0.04 } },
    robe: { kind: 'armor', name: 'Robe', icon: ['gear', 12], w: { def: 0.5, res: 1.25, hp: 0.75, mp: 1 } },
    ring: { kind: 'acc', name: 'Ring', icon: ['gear', 13], w: { atk: 0.45, mag: 0.45 } },
    amulet: { kind: 'acc', name: 'Amulet', icon: ['gear', 14], w: { res: 0.6, hp: 0.8, mp: 0.6 } },
    charm: { kind: 'acc', name: 'Charm', icon: ['gear', 15], w: { spd: 0.06, crit: 4, def: 0.3 } },
};
export const WEAPON_TYPES = ['sword', 'axe', 'daggers', 'bow', 'staff', 'tome', 'lute', 'flask', 'scythe'];
export const ARMOR_TYPES = ['heavy', 'light', 'robe'];
export const ACC_TYPES = ['ring', 'amulet', 'charm'];

// a material name for each band of ten item levels; past 100 the Ascendant line counts up
export const MATERIALS = ['Bronze', 'Iron', 'Steel', 'Mythril', 'Adamant', 'Runic', 'Starmetal', 'Dragonbone', 'Celestial', 'Emberforged'];
export function materialName(lvl) {
    const i = Math.floor((Math.max(1, lvl) - 1) / 10);
    return i < MATERIALS.length ? MATERIALS[i] : `Ascendant ${i - MATERIALS.length + 1}`;
}

export const RARITY = [
    { id: 'common', name: 'Common', mult: 1.0, color: '#c9c3b6', affixes: 0 },
    { id: 'fine', name: 'Fine', mult: 1.15, color: '#6fdc6a', affixes: 0 },
    { id: 'rare', name: 'Rare', mult: 1.32, color: '#5ab0ff', affixes: 1 },
    { id: 'epic', name: 'Epic', mult: 1.55, color: '#c27bff', affixes: 2 },
    { id: 'legendary', name: 'Legendary', mult: 1.85, color: '#ffa53a', affixes: 0 },
];

// affix lines rolled onto rare and epic gear: percentage boosts to a stat
export const AFFIXES = [
    { id: 'hp', name: 'of Vigour', stat: 'hp', pct: 10 },
    { id: 'atk', name: 'of Might', stat: 'atk', pct: 8 },
    { id: 'mag', name: 'of Sorcery', stat: 'mag', pct: 8 },
    { id: 'def', name: 'of the Bulwark', stat: 'def', pct: 10 },
    { id: 'res', name: 'of Warding', stat: 'res', pct: 10 },
    { id: 'spd', name: 'of Haste', stat: 'spd', pct: 6 },
    { id: 'crit', name: 'of Precision', stat: 'crit', pct: 5 },
    { id: 'mp', name: 'of Insight', stat: 'mp', pct: 12 },
];

export const MAX_PLUS = 10;
export const MAX_PLUS_UNIQUE = 15;

// ---------------------------------------------------------------- consumables and materials
// use: what the item does. In battle any of them except materials; in town only the healing ones.
export const GOODS = {
    potion: { name: 'Potion', icon: ['goods', 0], price: 30, use: { heal: 0.35, flat: 40 }, tgt: 'ally', desc: 'Restores 35% of one ally\'s health.' },
    hipotion: { name: 'Hi-Potion', icon: ['goods', 1], price: 90, use: { heal: 0.7, flat: 120 }, tgt: 'ally', desc: 'Restores 70% of one ally\'s health.', minFloor: 10 },
    megapotion: { name: 'Mega Potion', icon: ['goods', 2], price: 260, use: { heal: 0.5, flat: 100 }, tgt: 'allies', desc: 'Restores half of everyone\'s health.', minFloor: 25 },
    ether: { name: 'Ether', icon: ['goods', 3], price: 60, use: { mp: 0.35, flat: 15 }, tgt: 'ally', desc: 'Restores 35% of one ally\'s mana.' },
    hiether: { name: 'Hi-Ether', icon: ['goods', 4], price: 160, use: { mp: 0.8, flat: 30 }, tgt: 'ally', desc: 'Restores 80% of one ally\'s mana.', minFloor: 20 },
    elixir: { name: 'Elixir', icon: ['goods', 5], price: 900, use: { heal: 1, mp: 1 }, tgt: 'ally', desc: 'Fully restores one ally.', minFloor: 40 },
    phoenix: { name: 'Phoenix Feather', icon: ['goods', 6], price: 200, use: { revive: 0.5 }, tgt: 'fallen', desc: 'Revives a fallen ally with half health.' },
    antidote: { name: 'Remedy Herb', icon: ['goods', 7], price: 20, use: { cleanse: true }, tgt: 'ally', desc: 'Cures every ailment.' },
    smoke: { name: 'Smoke Bomb', icon: ['goods', 8], price: 50, use: { flee: true }, tgt: 'self', desc: 'Escape any battle except a boss fight.' },
    firebomb: { name: 'Fire Bomb', icon: ['goods', 9], price: 70, use: { dmg: 1, el: 'fire' }, tgt: 'enemies', desc: 'Fire damage to every foe, scaled to the floor.' },
    frostbomb: { name: 'Frost Bomb', icon: ['goods', 10], price: 70, use: { dmg: 1, el: 'ice' }, tgt: 'enemies', desc: 'Ice damage to every foe, scaled to the floor.' },
    strtonic: { name: 'Tonic of Might', icon: ['goods', 11], price: 120, use: { st: 'atkup' }, tgt: 'allies', desc: 'Everyone hits harder for 3 turns.' },
    irontonic: { name: 'Ironskin Tonic', icon: ['goods', 12], price: 120, use: { st: 'defup' }, tgt: 'allies', desc: 'Everyone takes less damage for 3 turns.' },
};
export const MATS = {
    ore: { name: 'Iron Ore', icon: ['goods', 13], desc: 'Hilde turns it into upgrades.' },
    shard: { name: 'Ember Shard', icon: ['goods', 14], desc: 'A sliver of the tower\'s heart. Needed for +5 and above, and for reforging.' },
    core: { name: 'Monster Core', icon: ['goods', 15], desc: 'Dropped by elites and bosses. Zephyrine trades rare gear for them.' },
};

// ---------------------------------------------------------------- uniques
// fx: effects the battle reads (see battle.js uniqueFx). from: the boss or mini boss that drops it the first time.
export const UNIQUES = {
    rootheart: { name: 'Rootheart Amulet', type: 'amulet', icon: ['uniques', 0], from: 'colossus', fx: { regen: 0.05 }, desc: 'Regenerate 5% health every turn.' },
    prismfang: { name: 'Prismfang', type: 'daggers', icon: ['uniques', 1], from: 'vitreous_wyrm', fx: { critMul: 0.75, crit: 10 }, desc: '+10% crit; criticals deal +75% more.' },
    codex_mortis: { name: 'Codex Mortis', type: 'tome', icon: ['uniques', 2], from: 'archivist', fx: { elBoost: { dark: 0.35 }, leech: 0.1 }, desc: 'Dark magic +35%; heal 10% of damage dealt.' },
    ignivars_brand: { name: 'Ignivar\'s Brand', type: 'sword', icon: ['uniques', 3], from: 'ignivar', fx: { attackEl: 'fire', onHit: { id: 'burn', ch: 0.35, n: 3 } }, desc: 'Attacks are fire and may burn.' },
    hrimscale: { name: 'Hrimscale Mail', type: 'heavy', icon: ['uniques', 4], from: 'hrimgard', fx: { resist: ['ice'], startSt: 'defup' }, desc: 'Resist ice; begin each battle guarded.' },
    orrery_heart: { name: 'Orrery Heart', type: 'ring', icon: ['uniques', 5], from: 'orrery', fx: { startSt: 'haste' }, desc: 'Begin each battle hasted.' },
    bloomstaff: { name: 'Bloomstaff', type: 'staff', icon: ['uniques', 6], from: 'motherbloom', fx: { healBoost: 0.4 }, desc: 'Healing +40%.' },
    starfall_bow: { name: 'Starfall Bow', type: 'bow', icon: ['uniques', 7], from: 'celestine', fx: { attackEl: 'holy', hits: 2 }, desc: 'Attacks are holy and strike twice.' },
    abyssal_reaper: { name: 'Abyssal Reaper', type: 'scythe', icon: ['uniques', 8], from: 'malgrath', fx: { leech: 0.2, elBoost: { dark: 0.2 } }, desc: 'Heal 20% of damage dealt; dark +20%.' },
    ember_heart: { name: 'Ember Heart', type: 'amulet', icon: ['uniques', 9], from: 'aurelion', fx: { allPct: 20 }, desc: 'Every stat +20%.' },
    lucky_tooth: { name: 'Grubnak\'s Lucky Tooth', type: 'charm', icon: ['uniques', 10], from: 'grubnak', fx: { goldPct: 25 }, desc: 'Gold found +25%.' },
    starry_satchel: { name: 'Bottomless Satchel', type: 'charm', icon: ['uniques', 11], from: 'grand_mimic', fx: { dropPct: 30 }, desc: 'Loot drops +30%.' },
    frostfire_axe: { name: 'Frostfire Axe', type: 'axe', icon: ['uniques', 12], from: 'furnace_ogre', fx: { attackEl: 'ice', onHit: { id: 'slow', ch: 0.3, n: 2 } }, desc: 'Attacks are ice and may slow.' },
    stormstring: { name: 'Stormstring Lute', type: 'lute', icon: ['uniques', 13], from: 'siege_automaton', fx: { elBoost: { bolt: 0.4 }, mpRegen: 0.04 }, desc: 'Lightning +40%; regain 4% mana a turn.' },
    starweave: { name: 'Starweave Robe', type: 'robe', icon: ['uniques', 14], from: 'eclipse_knight', fx: { mpRegen: 0.06, resist: ['dark'] }, desc: 'Regain 6% mana a turn; resist dark.' },
    phoenix_plume: { name: 'Phoenix Plume', type: 'charm', icon: ['uniques', 15], from: 'storm_drake', fx: { autoRevive: 0.5 }, desc: 'Once a battle, rise from defeat with half health.' },
    // the other minis drop these when their table comes up (see loot.js); keepsakes come from bonds
    keepsake_mira: { name: 'Mira\'s Sun Pendant', type: 'amulet', icon: ['misc', 0], keepsake: 'mira', fx: { healBoost: 0.25, allPct: 5 }, desc: 'Healing +25%. Warm, always.' },
    keepsake_brakka: { name: 'Ashfang Tusk Necklace', type: 'amulet', icon: ['misc', 1], keepsake: 'brakka', fx: { statPct: { atk: 15 }, allPct: 5 }, desc: 'Attack +15%. Her mother\'s.' },
    keepsake_sylas: { name: 'Sylas\'s Lucky Coin', type: 'charm', icon: ['misc', 2], keepsake: 'sylas', fx: { goldPct: 20, crit: 5, allPct: 5 }, desc: 'Gold +20%, crit +5%. Both sides are heads.' },
    keepsake_lyra: { name: 'Carved Wooden Fox', type: 'charm', icon: ['misc', 3], keepsake: 'lyra', fx: { statPct: { spd: 15 }, allPct: 5 }, desc: 'Speed +15%. She carved it by the fire.' },
    keepsake_thorne: { name: 'Thorne\'s Spare Spectacles', type: 'charm', icon: ['misc', 4], keepsake: 'thorne', fx: { statPct: { mag: 15 }, allPct: 5 }, desc: 'Magic +15%. One lens is cracked. Of course.' },
    keepsake_pip: { name: 'Pip\'s Silver Flute', type: 'charm', icon: ['misc', 5], keepsake: 'pip', fx: { startSt: 'haste', allPct: 5 }, desc: 'Begin each battle hasted. It plays one song.' },
    keepsake_grimble: { name: 'Grimble\'s Brass Compass', type: 'charm', icon: ['misc', 6], keepsake: 'grimble', fx: { dropPct: 20, allPct: 5 }, desc: 'Loot +20%. It points at treasure, mostly.' },
    keepsake_nyx: { name: 'The Broken Pact Ring', type: 'ring', icon: ['misc', 7], keepsake: 'nyx', fx: { leech: 0.12, allPct: 5 }, desc: 'Heal 12% of damage dealt. It no longer binds anyone.' },
};

// UI icons in the misc atlas
export const UI_ICON = { quest: ['misc', 8], tavern: ['misc', 9], forge: ['misc', 10], temple: ['misc', 11], chest: ['misc', 12], hourglass: ['misc', 13], heart: ['misc', 14], tower: ['misc', 15] };
