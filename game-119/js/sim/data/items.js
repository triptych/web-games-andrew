// Every item in the game. Materials are hand-listed; gear (ten families x ten levels) is generated.
// Pure data: no DOM, no randomness.

export const GRADES = 5;
export const gradeOf = (lv) => Math.ceil(lv / 2);

// id, name, category, price, unit weight, stack size, colour (for icons)
const MAT_ROWS = [
    ['copper_ore', 'Copper Ore', 'ore', 4, 2.0, 12, '#c9783f'],
    ['iron_ore', 'Iron Ore', 'ore', 7, 2.2, 12, '#8d7468'],
    ['coal', 'Coal', 'ore', 5, 1.6, 12, '#3a3a44'],
    ['mithril_ore', 'Mithril Ore', 'ore', 40, 2.2, 10, '#78c3d9'],
    ['starmetal_ore', 'Starmetal Ore', 'ore', 160, 2.4, 8, '#b69cf0'],
    ['copper_ingot', 'Copper Ingot', 'ingot', 10, 2.5, 10, '#d88a4a'],
    ['iron_ingot', 'Iron Ingot', 'ingot', 18, 2.6, 10, '#a9b0ba'],
    ['steel_ingot', 'Steel Ingot', 'ingot', 40, 2.6, 10, '#c9d3e0'],
    ['mithril_ingot', 'Mithril Ingot', 'ingot', 110, 2.6, 8, '#8fe0f0'],
    ['starmetal_ingot', 'Starmetal Ingot', 'ingot', 400, 2.6, 8, '#cdb8ff'],
    ['linen', 'Linen Cloth', 'cloth', 6, 0.6, 12, '#e8dcc0'],
    ['leather', 'Soft Leather', 'cloth', 12, 0.8, 12, '#a8683a'],
    ['hardhide', 'Stout Hide', 'cloth', 35, 1.0, 12, '#7a4a30'],
    ['drakeskin', 'Drakeskin', 'cloth', 120, 1.0, 10, '#b8422e'],
    ['phoenixsilk', 'Phoenix Silk', 'cloth', 420, 0.5, 10, '#ffb04a'],
    ['pine', 'Pine Plank', 'wood', 5, 2.4, 8, '#d9b070'],
    ['oak', 'Oak Beam', 'wood', 9, 2.8, 8, '#a97c46'],
    ['ironwood', 'Ironwood', 'wood', 32, 3.0, 8, '#6a4a3a'],
    ['elderwood', 'Elderwood', 'wood', 100, 2.6, 8, '#c9b8e8'],
    ['heartwood', 'Heartwood', 'wood', 360, 2.6, 8, '#e8a85a'],
    ['quartz', 'Rose Quartz', 'gem', 15, 0.2, 10, '#f3c1d0'],
    ['garnet', 'Garnet', 'gem', 35, 0.2, 10, '#c43a4a'],
    ['sapphire', 'Sapphire', 'gem', 90, 0.2, 10, '#3f6fd8'],
    ['moonstone', 'Moonstone', 'gem', 250, 0.2, 10, '#cfe6ff'],
    ['dawnstone', 'Dawnstone', 'gem', 900, 0.2, 10, '#ffd36a'],
    ['greenleaf', 'Greenleaf', 'herb', 5, 0.15, 20, '#68b84a'],
    ['moonpetal', 'Moonpetal', 'herb', 10, 0.15, 20, '#b8a8f0'],
    ['fireroot', 'Fireroot', 'herb', 28, 0.15, 20, '#e8643a'],
    ['frostbloom', 'Frostbloom', 'herb', 80, 0.15, 20, '#9fd8f0'],
    ['sunbloom', 'Sunbloom', 'herb', 300, 0.15, 20, '#ffc83a'],
    ['grain', 'Grain', 'food', 3, 0.35, 20, '#e8c66a'],
    ['jerky', 'Smoked Jerky', 'food', 8, 0.35, 20, '#9a5a3a'],
    ['honey', 'Wild Honey', 'food', 18, 0.4, 20, '#f2b02a'],
    ['spice', 'Desert Spice', 'food', 60, 0.2, 20, '#d8562a'],
    ['sunfruit', 'Sunfruit', 'food', 220, 0.3, 20, '#ff8a3a'],
    ['salt', 'Sea Salt', 'misc', 4, 0.5, 20, '#f2f2f2'],
    ['wine', 'Hearthland Wine', 'trade', 28, 1.2, 6, '#8a2a4a'],
    ['furs', 'Winter Furs', 'trade', 45, 1.4, 6, '#b89a7a'],
    ['pearls', 'Sea Pearls', 'trade', 95, 0.2, 10, '#f4efe6'],
    ['amber', 'Amber', 'trade', 75, 0.4, 10, '#e8a020'],
    ['perfume', 'Rose Perfume', 'trade', 120, 0.3, 8, '#f08ab8'],
    ['glassware', 'Glassware', 'trade', 35, 1.4, 6, '#a8e0e0'],
];
export const MATS = {};
for (const [id, name, cat, price, wt, stack, color] of MAT_ROWS) MATS[id] = { id, name, cat, price, wt, stack, w: 1, h: 1, color };

export const LINE = {
    ingot: ['copper_ingot', 'iron_ingot', 'steel_ingot', 'mithril_ingot', 'starmetal_ingot'],
    cloth: ['linen', 'leather', 'hardhide', 'drakeskin', 'phoenixsilk'],
    wood: ['pine', 'oak', 'ironwood', 'elderwood', 'heartwood'],
    gem: ['quartz', 'garnet', 'sapphire', 'moonstone', 'dawnstone'],
    herb: ['greenleaf', 'moonpetal', 'fireroot', 'frostbloom', 'sunbloom'],
    food: ['grain', 'jerky', 'honey', 'spice', 'sunfruit'],
};

// Gear families: each is one slot of the Hero's Ultimate Kit.
export const FAMS = {
    sword: { name: 'Sword', slot: 'Weapon', station: 'smithy', w: 1, h: 3, wt: 3, stack: 1, names: ['Bronze Shortsword', 'Honed Bronze Blade', 'Iron Sword', 'Fine Iron Falchion', 'Steel Longsword', 'Tempered Steel Blade', 'Mithril Brand', 'Moonlit Mithril Blade', 'Starforged Sword', 'Dawnbringer'] },
    armor: { name: 'Armor', slot: 'Armor', station: 'smithy', w: 2, h: 3, wt: 8, stack: 1, names: ['Studded Jerkin', 'Reinforced Jerkin', 'Chainmail Shirt', 'Fine Chain Hauberk', 'Steel Cuirass', "Knight's Plate", 'Mithril Mail', 'Moonweave Hauberk', 'Starforged Plate', 'Aegis of Dawn'] },
    helm: { name: 'Helm', slot: 'Helm', station: 'smithy', w: 2, h: 2, wt: 3, stack: 1, names: ['Copper Cap', 'Fine Copper Helm', 'Iron Helm', 'Visored Iron Helm', 'Steel Greathelm', 'Plumed Greathelm', 'Mithril Helm', 'Moonlit Helm', 'Starforged Helm', 'Crown of Dawn'] },
    shield: { name: 'Shield', slot: 'Shield', station: 'smithy', w: 2, h: 2, wt: 5, stack: 1, names: ['Pine Buckler', 'Banded Buckler', 'Oak Round Shield', 'Iron-bound Shield', 'Ironwood Heater', 'Steel Heater Shield', 'Elderwood Kite Shield', 'Mithril Bulwark', 'Starforged Bulwark', 'Dawnwall'] },
    boots: { name: 'Boots', slot: 'Boots', station: 'tailor', w: 2, h: 1, wt: 2, stack: 1, names: ['Linen Wraps', 'Padded Boots', 'Leather Boots', 'Studded Boots', 'Stout Hide Boots', 'Fine Hide Boots', 'Drakeskin Boots', 'Windstride Boots', 'Phoenix Silk Boots', 'Sunstrider Boots'] },
    amulet: { name: 'Amulet', slot: 'Amulet', station: 'jeweler', w: 1, h: 1, wt: 0.3, stack: 1, names: ['Quartz Charm', 'Polished Quartz Pendant', 'Garnet Pendant', 'Fine Garnet Amulet', 'Sapphire Amulet', 'Starry Sapphire Amulet', 'Moonstone Amulet', "Moon's Tear Amulet", 'Dawnstone Amulet', 'Heart of Dawn'] },
    potion: { name: 'Potion', slot: 'Healing', station: 'alchemist', w: 1, h: 1, wt: 0.4, stack: 5, names: ['Minor Healing Draught', 'Healing Draught', 'Moonpetal Potion', 'Greater Moonpetal Potion', 'Fireheart Potion', 'Greater Fireheart Potion', "Winter's Balm", "Greater Winter's Balm", 'Sunbloom Draught', 'Draught of Life'] },
    elixir: { name: 'Elixir', slot: 'Elixir', station: 'alchemist', w: 1, h: 1, wt: 0.4, stack: 5, names: ['Vigor Tonic', 'Strong Vigor Tonic', 'Moonlit Elixir', 'Potent Moonlit Elixir', 'Emberblood Elixir', 'Potent Emberblood Elixir', 'Frostward Elixir', 'Greater Frostward Elixir', 'Sunbloom Elixir', 'Elixir of the Dawn'] },
    rations: { name: 'Rations', slot: 'Supplies', station: 'provisioner', w: 1, h: 1, wt: 0.8, stack: 4, names: ['Trail Rations', 'Hearty Rations', 'Jerky Pack', "Hunter's Pack", 'Honeycake Pack', 'Honey Feast', 'Spiced Journeybread', 'Spice Hamper', 'Sunfruit Provisions', 'Ambrosia Hamper'] },
    kit: { name: 'Camp Kit', slot: 'Camp Kit', station: 'tailor', w: 2, h: 2, wt: 4, stack: 1, names: ['Bedroll Bundle', "Camper's Kit", "Ranger's Pack", "Scout's Pack", 'Pathfinder Kit', 'Expedition Kit', 'Drakehide Camp Set', "Master Pathfinder's Kit", 'Phoenix Camp Set', "Hero's Expedition Pack"] },
};
export const FAM_IDS = Object.keys(FAMS);
export const SLOT_ORDER = ['sword', 'armor', 'helm', 'shield', 'boots', 'amulet', 'potion', 'elixir', 'rations', 'kit'];

export const STATIONS = {
    smithy: { name: 'Forge', icon: 'anvil' },
    tailor: { name: 'Tailor & Tannery', icon: 'needle' },
    alchemist: { name: 'Alchemist', icon: 'flask' },
    jeweler: { name: 'Jeweler', icon: 'gem' },
    provisioner: { name: 'Provisioner', icon: 'pot' },
};

export const GEAR_MARKUP = 1.5;

/** The recipe for a gear item, or null. Level 1-10: grade = ceil(lv/2); even levels are the "fine" version. */
export function gearRecipe(fam, lv) {
    const F = FAMS[fam];
    if (!F || lv < 1 || lv > 10) return null;
    const g = gradeOf(lv) - 1, fine = lv % 2 === 0;
    const I = LINE.ingot[g], C = LINE.cloth[g], W = LINE.wood[g], G = LINE.gem[g], H = LINE.herb[g], Fd = LINE.food[g];
    let inputs;
    switch (fam) {
        case 'sword': inputs = [[I, 2], [W, 1]]; break;
        case 'armor': inputs = [[I, 4], [C, 2]]; break;
        case 'helm': inputs = [[I, 2], [C, 1]]; break;
        case 'shield': inputs = [[I, 2], [W, 3]]; break;
        case 'boots': inputs = [[C, 3], [LINE.ingot[g], g >= 2 ? 1 : 0]]; break;
        case 'amulet': inputs = [[G, 2], [I, 1]]; break;
        case 'potion': inputs = [[H, 3]]; break;
        case 'elixir': inputs = [[H, 2], [LINE.food[Math.min(4, g + 0)], 1]]; break;
        case 'rations': inputs = [[Fd, 3], ['salt', 1]]; break;
        case 'kit': inputs = [[C, 2], [W, 2], [I, 1]]; break;
    }
    if (fine) inputs.push(fam === 'amulet' ? [H, 1] : [LINE.gem[Math.max(0, g - 2)], 1]);
    inputs = inputs.filter(([, n]) => n > 0).map(([t, n]) => ({ t, n }));
    return { rid: `${fam}:${lv}`, fam, lv, station: F.station, stationLv: gradeOf(lv), needLv: 1 + 3 * (gradeOf(lv) - 1), inputs };
}

/** Smelting recipes: ingots from ore. */
const SMELT = [
    { out: 'copper_ingot', inputs: [['copper_ore', 2]], stationLv: 1 },
    { out: 'iron_ingot', inputs: [['iron_ore', 2]], stationLv: 2 },
    { out: 'steel_ingot', inputs: [['iron_ingot', 1], ['coal', 2]], stationLv: 3 },
    { out: 'mithril_ingot', inputs: [['mithril_ore', 2], ['coal', 1]], stationLv: 4 },
    { out: 'starmetal_ingot', inputs: [['starmetal_ore', 2], ['coal', 2]], stationLv: 5 },
];
export function recipeById(rid) {
    if (rid.startsWith('ingot:')) {
        const s = SMELT[+rid.slice(6)];
        if (!s) return null;
        return { rid, fam: 'ingot', out: s.out, outLv: 0, station: 'smithy', stationLv: s.stationLv, needLv: Math.max(1, 3 * (s.stationLv - 1) - 1), inputs: s.inputs.map(([t, n]) => ({ t, n })) };
    }
    const [fam, lv] = rid.split(':');
    const r = gearRecipe(fam, +lv);
    return r && { ...r, out: fam, outLv: +lv };
}
export const ALL_RECIPES = [...SMELT.map((_, i) => `ingot:${i}`), ...FAM_IDS.flatMap((f) => Array.from({ length: 10 }, (_, i) => `${f}:${i + 1}`))].map(recipeById);

const priceMemo = {};
/** Base (mid-market) price of an item. */
export function basePrice(t, lv = 0) {
    const m = MATS[t];
    if (m) return m.price;
    const k = t + ':' + lv;
    if (priceMemo[k]) return priceMemo[k];
    const r = gearRecipe(t, lv);
    if (!r) return 0;
    const cost = r.inputs.reduce((a, i) => a + MATS[i.t].price * i.n, 0);
    return (priceMemo[k] = Math.max(8, Math.round((cost * GEAR_MARKUP) / 5) * 5));
}

/** Everything the rest of the game needs to know about an item type (+ level for gear). */
export function itemDef(t, lv = 0) {
    const m = MATS[t];
    if (m) return m;
    const F = FAMS[t];
    if (!F) return null;
    return { id: t, t, lv, name: F.names[lv - 1] || F.name, cat: t, fam: t, gear: true, wt: F.wt, stack: F.stack, w: F.w, h: F.h, price: basePrice(t, lv), color: null, grade: gradeOf(lv) };
}
export const itemName = (t, lv) => itemDef(t, lv)?.name ?? t;
export const isGear = (t) => !!FAMS[t];
export const catOf = (t) => (MATS[t] ? MATS[t].cat : t);
export const keyOf = (t, lv) => (FAMS[t] ? `${t}:${lv}` : t);
export const parseKey = (k) => { const [t, l] = k.split(':'); return { t, lv: l ? +l : 0 }; };
export const RARITY = ['common', 'common', 'fine', 'fine', 'rare', 'rare', 'epic', 'epic', 'legend', 'mythic'];
export const RARITY_COLOR = { common: '#d8cdb4', fine: '#8ed36a', rare: '#6aa8ff', epic: '#c58aff', legend: '#ffa84a', mythic: '#ffe066' };

// Inventory filter tabs
export const FILTERS = [
    { id: 'all', name: 'All', test: () => true },
    { id: 'raw', name: 'Raw', test: (t) => ['ore', 'cloth', 'wood', 'gem', 'herb', 'food', 'misc'].includes(catOf(t)) },
    { id: 'ingot', name: 'Refined', test: (t) => catOf(t) === 'ingot' },
    { id: 'gear', name: 'Gear', test: (t) => ['sword', 'armor', 'helm', 'shield', 'boots', 'amulet', 'kit'].includes(catOf(t)) },
    { id: 'consum', name: 'Potions & Food', test: (t) => ['potion', 'elixir', 'rations'].includes(catOf(t)) },
    { id: 'trade', name: 'Goods', test: (t) => catOf(t) === 'trade' || t === 'parcel' },
];

// The quest parcel: a courier package that takes a cell until delivered.
MATS.parcel = { id: 'parcel', name: 'Sealed Parcel', cat: 'quest', price: 0, wt: 0.5, stack: 1, w: 1, h: 1, color: '#e8d8a8' };

const ORE_GRADE = { copper_ore: 1, iron_ore: 2, coal: 2, mithril_ore: 4, starmetal_ore: 5, salt: 1 };
/** Tier (1-5) of a material: how deep into the realm you have to go for it. */
export function matGrade(t) {
    if (ORE_GRADE[t]) return ORE_GRADE[t];
    for (const k in LINE) { const i = LINE[k].indexOf(t); if (i >= 0) return i + 1; }
    return 1;
}
