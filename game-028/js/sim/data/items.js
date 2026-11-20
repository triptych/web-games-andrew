// Items. kind: use (consumable), weapon, armor, loot (sells), key (story; never sold).
// `who` lists the heroes who can equip a weapon or armour. `buy` 0 means no shop stocks it.

export const ITEMS = {
    potion: { name: 'Healing Potion', kind: 'use', fx: { heal: 60 }, target: 'ally', buy: 40, sell: 15, desc: 'Restores 60 HP to one ally.' },
    hi_potion: { name: 'Hi-Potion', kind: 'use', fx: { heal: 160 }, target: 'ally', buy: 110, sell: 45, desc: 'Restores 160 HP to one ally.' },
    ether: { name: 'Ether', kind: 'use', fx: { mp: 30 }, target: 'ally', buy: 70, sell: 25, desc: 'Restores 30 MP to one ally.' },
    antidote: { name: 'Antidote', kind: 'use', fx: { cure: true }, target: 'ally', buy: 25, sell: 10, desc: 'Cures poison, slow and weakness on one ally.' },
    phoenix_down: { name: 'Phoenix Feather', kind: 'use', fx: { revive: 0.3 }, target: 'fallen', buy: 180, sell: 70, desc: 'Revives a fallen ally with 30% HP.' },

    iron_dagger: { name: 'Iron Dagger', kind: 'weapon', stats: { atk: 4 }, who: ['lyra', 'orin', 'sera', 'thane'], buy: 60, sell: 25, desc: '+4 ATK. Anyone can use it.' },
    mage_staff: { name: 'Apprentice\'s Staff', kind: 'weapon', stats: { atk: 7, mp: 12 }, who: ['lyra', 'thane'], buy: 120, sell: 45, desc: '+7 ATK, +12 max MP. Lyra or Thane.' },
    longbow: { name: 'Thornwood Longbow', kind: 'weapon', stats: { atk: 9, spd: 2 }, who: ['sera'], buy: 150, sell: 60, desc: '+9 ATK, +2 SPD. Sera only.' },
    steel_sword: { name: 'Steel Longsword', kind: 'weapon', stats: { atk: 9 }, who: ['orin'], buy: 140, sell: 55, desc: '+9 ATK. Orin only.' },
    runic_blade: { name: 'Runic Blade', kind: 'weapon', stats: { atk: 15, spd: -1 }, who: ['orin', 'sera'], buy: 0, sell: 120, desc: '+15 ATK, -1 SPD. Korvas\'s old sword. Orin or Sera.' },
    warlock_tome: { name: 'Emberbound Tome', kind: 'weapon', stats: { atk: 13, mp: 20 }, who: ['thane', 'lyra'], buy: 0, sell: 110, desc: '+13 ATK, +20 max MP. Thane or Lyra.' },

    leather_vest: { name: 'Leather Vest', kind: 'armor', stats: { def: 4 }, who: ['lyra', 'orin', 'sera', 'thane'], buy: 55, sell: 20, desc: '+4 DEF. Anyone.' },
    chain_mail: { name: 'Chain Mail', kind: 'armor', stats: { def: 10, spd: -1 }, who: ['orin', 'sera'], buy: 180, sell: 70, desc: '+10 DEF, -1 SPD. Orin or Sera.' },
    mage_robe: { name: 'Starweave Robe', kind: 'armor', stats: { def: 6, mp: 20 }, who: ['lyra', 'thane'], buy: 160, sell: 60, desc: '+6 DEF, +20 max MP. Lyra or Thane.' },

    slime_core: { name: 'Slime Core', kind: 'loot', sell: 6, desc: 'A gelatinous core. Farmer Holt wants three.' },
    wolf_pelt: { name: 'Wolf Pelt', kind: 'loot', sell: 14, desc: 'Thick fur. Sells well.' },
    fang: { name: 'Sharp Fang', kind: 'loot', sell: 9, desc: 'A wolf fang. Sells.' },
    stone_heart: { name: 'Stone Heart', kind: 'loot', sell: 45, desc: 'The core of a golem. Scholars pay well.' },
    soul_gem: { name: 'Soul Gem', kind: 'key', sell: 0, desc: 'Crystallised lich energy, dropped by Lich Shards. Cleanses corruption, and breaks seals.' },
    elder_scroll: { name: 'Elder Scroll', kind: 'key', sell: 0, desc: 'The prophecy Lyra fled the Academy with. It names her.' },
    lich_crown: { name: 'Crown of Aethermoor', kind: 'key', sell: 0, desc: 'The Lich\'s crown, its power spent.' },
};

export const ITEM_ORDER = Object.keys(ITEMS);

export const SHOPS = {
    forge: { name: 'Marta\'s Forge', keeper: 'marta', stock: ['iron_dagger', 'steel_sword', 'mage_staff', 'longbow', 'leather_vest', 'chain_mail', 'mage_robe'] },
    inn: { name: 'Ember Hearth Supplies', keeper: 'aldric', stock: ['potion', 'ether', 'antidote'] },
    borin: { name: 'Borin\'s Wares', keeper: 'borin', stock: ['potion', 'hi_potion', 'ether', 'antidote', 'phoenix_down'] },
    aneth: { name: 'Aneth\'s Satchel', keeper: 'aneth', stock: ['hi_potion', 'ether', 'phoenix_down'] },
};
