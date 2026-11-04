// Every building: footprint, what unlocks it, how it grows, and what each level does.
// A building of type T unlocks at Hall level T.unlock, and level L of it needs Hall level
// unlock + L - 1, so the Hall's ladder is also everyone else's.

export const SKILLS = {
    lumber: { name: 'Woodcraft', icon: '🪓' }, mining: { name: 'Mining', icon: '⛏️' }, farming: { name: 'Farming', icon: '🌾' },
    fishing: { name: 'Fishing', icon: '🎣' }, foraging: { name: 'Foraging', icon: '🍄' }, husbandry: { name: 'Husbandry', icon: '🐝' },
    carpentry: { name: 'Carpentry', icon: '🪚' }, smithing: { name: 'Smithing', icon: '🔨' }, tailoring: { name: 'Tailoring', icon: '🧵' },
    cooking: { name: 'Cooking', icon: '🍳' }, alchemy: { name: 'Alchemy', icon: '⚗️' }, hospitality: { name: 'Hospitality', icon: '🛎️' },
    scholar: { name: 'Scholarship', icon: '📖' },
};

const RATE = [1, 1.3, 1.7, 2.2, 2.8, 3.5];

// Cost of a level by the Hall level it needs (H), before the type's own scale.
const BASE_COST = {
    1: { wood: 16, stone: 5 },
    2: { wood: 34, stone: 14, gold: 25 },
    3: { plank: 14, stone: 28, gold: 70 },
    4: { plank: 30, stone: 55, ingot: 5, cloth: 4, gold: 160 },
    5: { plank: 55, stone: 90, ingot: 12, cloth: 10, steel: 4, lore: 6, gold: 380 },
    6: { plank: 90, stone: 140, ingot: 20, cloth: 18, steel: 10, gem: 4, lore: 15, gold: 900 },
};
const BASE_TIME = [0, 10, 25, 48, 85, 130, 190];

export const BUILDINGS = {};
const def = (id, o) => {
    const d = { id, kind: 'gather', w: 2, h: 2, unlock: 1, maxLv: 3, S: 1, wm: 1, sm: 1, T: 1, cozy: 0, workers: [0, 0, 0, 0, 0, 0], skill: null, ...o };
    d.maxLv = Math.min(d.maxLv, 7 - d.unlock);
    d.names = Array.isArray(d.name) ? d.name : null;
    d.title = d.names ? d.names[0] : d.name;
    BUILDINGS[id] = d;
};

// ---------------------------------------------------------------- the heart
def('hall', {
    name: ['Hearth Hut', 'Cozy Cottage', 'Timber Lodge', 'Stone Manor', 'Town Hall', 'Grand Hearthhall'], icon: '🛖', kind: 'core', w: 3, h: 3, maxLv: 6, cozy: 2,
    desc: 'Your home, and the heart of the town. Each level opens new buildings, more land and more hands to build with.',
    house: [2, 3, 4, 5, 6, 8], builders: [1, 1, 2, 2, 3, 3], renown: [0, 5, 18, 38, 70, 115],
    costs: [null, { wood: 25, stone: 12 }, { wood: 70, stone: 40, gold: 80 }, { plank: 40, stone: 100, gold: 300 },
        { plank: 80, stone: 160, ingot: 20, cloth: 15, gold: 600 }, { plank: 120, stone: 240, steel: 15, ingot: 30, cloth: 30, gem: 10, lore: 20, gold: 2000 }],
    times: [0, 20, 45, 90, 150, 240],
});

// ---------------------------------------------------------------- homes and storage
def('house', {
    name: ['Wattle Hut', 'Cottage', 'Townhouse', 'Villa'], icon: '🏡', kind: 'home', unlock: 2, maxLv: 4, S: 1.1, cozy: 1,
    desc: 'A home for your townsfolk. Better homes hold more people.', house: [2, 3, 4, 6],
});
def('storehouse', {
    name: ['Storage Shed', 'Barn', 'Warehouse', 'Granary Hall'], icon: '🏚️', kind: 'storage', unlock: 1, maxLv: 4, S: 0.9,
    desc: 'Raises how much of every good the town can hold.', cap: [90, 220, 480, 950],
});

// ---------------------------------------------------------------- gatherers
def('woodshed', {
    name: ['Woodshed', 'Lumber Camp', 'Lumber Mill', 'Timber Works'], icon: '🪓', w: 3, h: 2, unlock: 1, maxLv: 4, skill: 'lumber', S: 1, wm: 1.2, sm: 0.5, near: 'tree',
    desc: 'Villagers fell trees and haul wood. Trees nearby make them faster.', workers: [1, 2, 3, 4], out: [{ item: 'wood', every: 10 }],
});
def('quarry', {
    name: ['Stone Yard', 'Quarry', 'Deep Quarry', 'Stonecutters'], icon: '⛏️', w: 3, h: 2, unlock: 1, maxLv: 4, skill: 'mining', S: 1, wm: 0.8, sm: 1.2, near: 'rock',
    desc: 'Cuts stone from the hillside. Boulders nearby make them faster.', workers: [1, 2, 3, 4], out: [{ item: 'stone', every: 11 }],
});
def('farm', {
    name: ['Wheat Plot', 'Farm', 'Big Farm', 'Grand Farm'], icon: '🌾', w: 4, h: 3, unlock: 2, maxLv: 4, skill: 'farming', S: 1.1, cozy: 1,
    desc: 'Grows wheat for bread, ale and porridge, and flax for cloth. Slow in winter.', workers: [2, 3, 4, 5], out: [{ item: 'wheat', every: 10 }, { item: 'fiber', every: 18 }],
});
def('orchard', {
    name: ['Berry Patch', 'Orchard', 'Grand Orchard'], icon: '🍎', w: 3, h: 3, unlock: 3, maxLv: 3, skill: 'foraging', S: 1.1, cozy: 2,
    desc: 'Berries and apples for pies, cider and quick meals.', workers: [1, 2, 3], out: [{ item: 'berry', every: 12 }, { item: 'apple', every: 18 }],
});
def('dock', {
    name: ['Fishing Dock', 'Fishing Pier', 'Harbor'], icon: '🎣', w: 2, h: 3, unlock: 3, maxLv: 3, skill: 'fishing', S: 1, wm: 1.4, sm: 0.4, needsWater: true,
    desc: 'Must touch the river. Fish for stews.', workers: [1, 2, 3], out: [{ item: 'fish', every: 9 }],
});
def('herbgarden', {
    name: ['Herb Garden', 'Greenhouse', 'Apothecary Garden'], icon: '🌿', unlock: 3, maxLv: 3, skill: 'foraging', S: 0.9, cozy: 2,
    desc: 'Herbs for stews and potions, and mushrooms once it grows.', workers: [1, 2, 2], out: [{ item: 'herb', every: 10 }, { item: 'mushroom', every: 24, minLv: 2 }],
});
def('henhouse', {
    name: ['Hen House', 'Chicken Coop', 'Poultry Yard'], icon: '🐔', unlock: 4, maxLv: 3, skill: 'husbandry', S: 1,
    desc: 'Fresh eggs.', workers: [1, 2, 2], out: [{ item: 'egg', every: 14 }],
});
def('apiary', {
    name: ['Bee Hives', 'Apiary', 'Honey House'], icon: '🐝', unlock: 4, maxLv: 3, skill: 'husbandry', S: 1.1, cozy: 2,
    desc: 'Honey for cakes, mead and potions.', workers: [1, 2, 2], out: [{ item: 'honey', every: 24 }],
});
def('mine', {
    name: ['Mine Shaft', 'Deep Mine', 'Gem Mine'], icon: '⛏️', w: 3, h: 3, unlock: 4, maxLv: 3, skill: 'mining', S: 1.4, sm: 1.3,
    desc: 'Iron ore and coal, and gems from deep down.', workers: [2, 3, 4],
    out: [{ item: 'ore', every: 11 }, { item: 'coal', every: 15 }, { item: 'gem', every: 150, minLv: 3 }],
});
def('library', {
    name: ['Library', 'Grand Library'], icon: '📚', w: 3, h: 2, unlock: 5, maxLv: 2, skill: 'scholar', S: 1.4, cozy: 3,
    desc: 'Scholars write down Lore, which pays for the grandest upgrades.', workers: [1, 2], out: [{ item: 'lore', every: 22 }],
});

// ---------------------------------------------------------------- crafters
def('carpenter', {
    name: ['Carpenter', 'Joinery', 'Master Workshop'], icon: '🪚', kind: 'craft', w: 3, h: 2, unlock: 3, maxLv: 3, skill: 'carpentry', S: 1.1,
    desc: 'Saws planks and builds bows, staves and wooden gear.', workers: [1, 2, 3],
});
def('mill', {
    name: ['Windmill', 'Big Windmill', 'Flour Works'], icon: '🌬️', kind: 'craft', unlock: 3, maxLv: 3, skill: 'farming', S: 1, cozy: 1,
    desc: 'Grinds wheat into flour.', workers: [1, 1, 2],
});
def('loom', {
    name: ['Weaver', 'Tailor Shop', 'Fine Tailors'], icon: '🧶', kind: 'craft', unlock: 4, maxLv: 3, skill: 'tailoring', S: 1,
    desc: 'Spins fiber into cloth and sews tunics and jerkins.', workers: [1, 2, 2],
});
def('smithy', {
    name: ['Smithy', 'Forge', 'Master Forge'], icon: '⚒️', kind: 'craft', w: 3, h: 2, unlock: 4, maxLv: 3, skill: 'smithing', S: 1.4, noSteel: true,
    desc: 'Smelts ingots and steel and forges swords, maces, daggers and armor.', workers: [1, 2, 2],
});
def('alchemist', {
    name: ["Alchemist's Hut", 'Apothecary', 'Arcane Laboratory'], icon: '⚗️', kind: 'craft', unlock: 4, maxLv: 3, skill: 'alchemy', S: 1.3, cozy: 2,
    desc: 'Brews potions and enchants charms.', workers: [1, 2, 2],
});
def('tavern', {
    name: ['The Mossy Mug', 'The Mossy Mug II', 'The Golden Mug', 'The Great Hearth Inn'], icon: '🍺', kind: 'craft', w: 3, h: 3, unlock: 2, maxLv: 4, skill: 'cooking', S: 1.2, cozy: 4,
    desc: 'Cook dishes and pour drinks. Heroes eat and drink here, and pay you for it.', workers: [1, 2, 2, 3], seats: [3, 5, 8, 12],
});

// ---------------------------------------------------------------- services
def('guild', {
    name: ["Adventurers' Lodge", "Adventurers' Guild", 'Guild Hall', 'Grand Guild', 'Heroes\' Hall'], icon: '⚔️', kind: 'service', w: 3, h: 3, unlock: 2, maxLv: 5, S: 1.2, cozy: 2,
    desc: 'Recruit heroes, post quests and set the party out. Higher levels host more heroes and finer recruits.',
    heroes: [3, 5, 8, 12, 16], board: [5, 6, 7, 8, 9], heroLv: [8, 13, 18, 24, 30],
});
def('inn', {
    name: ['Wayside Inn', 'Cozy Inn', 'Grand Inn', 'Royal Inn'], icon: '🛏️', kind: 'service', w: 3, h: 3, unlock: 3, maxLv: 4, skill: 'hospitality', S: 1.2, cozy: 3,
    desc: 'Heroes sleep here to win back their energy. They pay for the bed.', workers: [1, 1, 2, 2], beds: [4, 7, 11, 16],
});
def('itemshop', {
    name: ['Item Shop', 'General Store', 'Outfitters', 'Emporium'], icon: '🛒', kind: 'service', unlock: 3, maxLv: 4, skill: 'hospitality', S: 1.1, cozy: 1,
    desc: 'Put your crafted gear, potions and meals on the shelves. Heroes spend their gold here.', workers: [1, 1, 2, 2], shelves: [3, 5, 7, 9],
});
def('market', {
    name: ['Market Stall', 'Market Square', 'Trading Post'], icon: '⚖️', kind: 'service', unlock: 2, maxLv: 3, skill: 'hospitality', S: 0.9, cozy: 2,
    desc: 'Sells what you do not need. Set how much to keep and the rest is sold for gold while you are away.', workers: [1, 1, 2], sell: [0.5, 1, 2],
});
def('healer', {
    name: ['Healing Garden', 'Chapel of Mercy', 'Sanctuary'], icon: '⛪', kind: 'service', unlock: 3, maxLv: 3, skill: 'hospitality', S: 1, cozy: 4,
    desc: 'Hurt heroes recover much faster here.', workers: [1, 1, 2], heal: [0.03, 0.05, 0.08],
});
def('watchtower', {
    name: ['Lookout', 'Watchtower', 'Guard Keep'], icon: '🗼', kind: 'defense', unlock: 4, maxLv: 3, S: 1.1,
    desc: 'Adds to the town\'s defense when raiders come.', defense: [18, 36, 62],
});
def('stables', {
    name: ['Stables', 'Grand Stables'], icon: '🐴', kind: 'service', w: 3, h: 2, unlock: 5, maxLv: 2, skill: 'husbandry', S: 1.3, cozy: 1,
    desc: 'Horses carry heroes faster: quests take less time.', workers: [1, 1], questTime: [0.12, 0.22],
});

// ---------------------------------------------------------------- decorations (one level, just cozy)
const deco = (id, name, icon, unlock, w, h, cozy, cost, desc) => {
    def(id, { name, icon, kind: 'deco', unlock, w, h, maxLv: 1, cozy, desc, costs: [cost], times: [4], noMaxClamp: true });
    BUILDINGS[id].maxLv = 1;
};
deco('flowerbed', 'Flower Bed', '🌷', 1, 1, 1, 2, { gold: 6 }, 'A little colour. Makes the town cozier.');
deco('lantern', 'Lantern Post', '🏮', 2, 1, 1, 3, { wood: 3, gold: 10 }, 'Glows warm at dusk.');
deco('bench', 'Bench', '🪑', 2, 1, 1, 3, { wood: 8, gold: 6 }, 'Somewhere to sit and chat.');
deco('well', 'Village Well', '⛲', 2, 1, 1, 4, { stone: 14, wood: 6 }, 'Everyone meets at the well.');
deco('fountain', 'Fountain', '⛲', 5, 2, 2, 10, { stone: 60, plank: 10, gold: 120 }, 'A burbling fountain in the square.');
deco('statue', 'Hero Statue', '🗿', 6, 2, 2, 16, { stone: 120, steel: 4, gem: 3, gold: 600 }, 'A statue of the town\'s first hero.');

export const BUILDING_IDS = Object.keys(BUILDINGS);

// ---------------------------------------------------------------- derived numbers
export function reqHall(type, lv) { return Math.min(6, BUILDINGS[type].unlock + lv - 1); }

export function costOf(type, lv) {
    const d = BUILDINGS[type];
    if (d.costs) return { ...(d.costs[lv - 1] || {}) };
    const H = reqHall(type, lv);
    // A building's first level is priced from the tier below it, so it never asks for a material
    // that only it (or its neighbours of the same tier) can make.
    const first = lv === 1 && H > 1;
    const table = BASE_COST[first ? H - 1 : H];
    const out = {};
    for (const [k, v] of Object.entries(table)) {
        let m = d.S * (first ? 1.7 : 1);
        if (k === 'wood' || k === 'plank') m *= d.wm;
        else if (k === 'stone') m *= d.sm;
        else if (k !== 'gold') m *= 0.8 + 0.2 * d.S;
        const n = Math.round(v * m);
        if (n <= 0) continue;
        // the Smithy cannot ask for the steel that only it can make
        if (k === 'steel' && d.noSteel) out.ingot = (out.ingot || 0) + n * 3; else out[k] = (out[k] || 0) + n;
    }
    return out;
}
export function timeOf(type, lv) {
    const d = BUILDINGS[type];
    if (d.times) return d.times[lv - 1] ?? 10;
    return Math.round(BASE_TIME[reqHall(type, lv)] * d.T * (0.8 + 0.2 * d.S));
}
/** A per-level stat array of a building, or a fallback. */
export function stat(type, lv, key, fallback = 0) {
    const a = BUILDINGS[type]?.[key];
    if (Array.isArray(a)) return a[Math.min(a.length, Math.max(1, lv)) - 1] ?? fallback;
    return a ?? fallback;
}
export function rateOf(lv) { return RATE[Math.min(RATE.length, Math.max(1, lv)) - 1]; }
export function nameOf(type, lv) {
    const d = BUILDINGS[type];
    return d.names ? d.names[Math.min(d.names.length, Math.max(1, lv)) - 1] : d.name;
}
