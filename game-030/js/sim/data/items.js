// Items. kind: use (consumable), weapon, armor, loot (sells), key (story; never sold).
// `who` lists the heroes who can equip a weapon or armour. `buy` 0 means no shop stocks it.

const ALL = ['wick', 'trina', 'mabel'];

export const ITEMS = {
    tea: { name: 'Chamomile Tea', kind: 'use', fx: { heal: 40 }, target: 'ally', buy: 14, sell: 5, desc: 'Restores 40 HP to one friend. Warm and steadying.' },
    scone: { name: 'Currant Scone', kind: 'use', fx: { heal: 90 }, target: 'ally', buy: 30, sell: 12, desc: 'Restores 90 HP to one friend. Baked by Mabel, still warm.' },
    oilcan: { name: 'Lantern Oil', kind: 'use', fx: { mp: 25 }, target: 'ally', buy: 24, sell: 9, desc: 'Restores 25 SP to one friend. Keeps the gadgets humming.' },
    tonic: { name: 'Mint Tonic', kind: 'use', fx: { cure: true }, target: 'ally', buy: 18, sell: 7, desc: 'Cures rust, stun and weakness on one friend.' },
    smoke: { name: 'Smoke Pellet', kind: 'use', fx: { flee: true }, target: 'self', buy: 20, sell: 8, desc: 'In battle: the whole party slips away. Not from a boss.' },
    wakeup: { name: 'Wake-Up Brew', kind: 'use', fx: { revive: 0.4 }, target: 'fallen', buy: 70, sell: 28, desc: 'Gets a fallen friend back on their feet with 40% HP.' },

    wrench: { name: 'Trusty Wrench', kind: 'weapon', stats: { atk: 4 }, who: ['wick', 'trina'], buy: 40, sell: 16, desc: '+4 ATK. Good for bolts and bandits alike. Wick or Trina.' },
    spanner: { name: 'Heavy Spanner', kind: 'weapon', stats: { atk: 7, spd: -1 }, who: ['wick', 'trina'], buy: 75, sell: 30, desc: '+7 ATK, -1 SPD. Wick or Trina.' },
    sparkrod: { name: 'Spark Rod', kind: 'weapon', stats: { atk: 9, mp: 8 }, who: ['wick', 'trina'], buy: 0, sell: 45, desc: '+9 ATK, +8 max SP. Crackles menacingly. Wick or Trina.' },
    rollingpin: { name: 'Oak Rolling Pin', kind: 'weapon', stats: { atk: 4 }, who: ['mabel'], buy: 32, sell: 13, desc: '+4 ATK. Mabel only.' },
    skillet: { name: 'Cast-Iron Skillet', kind: 'weapon', stats: { atk: 9, spd: -1 }, who: ['mabel'], buy: 85, sell: 34, desc: '+9 ATK, -1 SPD. Mabel only.' },

    apron: { name: 'Leather Apron', kind: 'armor', stats: { def: 3 }, who: ALL, buy: 36, sell: 14, desc: '+3 DEF. Anyone.' },
    brassvest: { name: 'Brass Plate Vest', kind: 'armor', stats: { def: 8, spd: -1 }, who: ['wick', 'mabel'], buy: 95, sell: 38, desc: '+8 DEF, -1 SPD. Wick or Mabel.' },
    goggles: { name: 'Copper Goggles', kind: 'armor', stats: { def: 3, mp: 10, spd: 1 }, who: ['trina', 'wick'], buy: 70, sell: 28, desc: '+3 DEF, +10 max SP, +1 SPD. Wick or Trina.' },
    charm: { name: 'Tinker Charm', kind: 'armor', stats: { def: 4, hp: 14, spd: 2 }, who: ALL, buy: 0, sell: 50, desc: '+4 DEF, +14 max HP, +2 SPD. A lucky trinket that warms in your pocket.' },

    cog: { name: 'Brass Cog', kind: 'loot', sell: 8, desc: 'A well-machined little gear. Trina hoards these.' },
    spring: { name: 'Coiled Spring', kind: 'loot', sell: 12, desc: 'Boing. Full of stored intent.' },
    scrap: { name: 'Scrap Metal', kind: 'loot', sell: 4, desc: 'Bent, rusted, and honestly kind of useless. Trina wants five.' },
    kettle: { name: 'Copper Kettle', kind: 'key', sell: 0, desc: 'Mabel\'s kettle, dented but whole.' },
    lairkey: { name: 'Lair Pass', kind: 'key', sell: 0, desc: 'A brass token from the Mayor that opens the iron door at the end of the Gully.' },
    goldgear: { name: 'Golden Gear', kind: 'key', sell: 0, desc: 'The Mayor\'s heirloom. Do not sell this. Seriously.' },
};

export const ITEM_ORDER = Object.keys(ITEMS);

export const SHOPS = {
    bertram: { name: 'Bertram\'s Odds & Ends', keeper: 'bertram',
        stock: ['tea', 'scone', 'oilcan', 'tonic', 'smoke', 'wakeup', 'wrench', 'spanner', 'rollingpin', 'skillet', 'apron', 'brassvest', 'goggles'] },
};
