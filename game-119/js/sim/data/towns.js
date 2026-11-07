// The realm of Aurelia: thirteen towns in five regions, joined by roads.
// produces = cheap here (the town makes it), wants = dear here (the town runs short of it).

export const REGIONS = [
    null,
    { id: 1, name: 'Greenmarch', blurb: 'Soft hills, farms and river hamlets. Everyone starts here.' },
    { id: 2, name: 'The Heartland', blurb: 'Crossroads, orchards and the great trade fairs.' },
    { id: 3, name: 'Sunreach & Emberlands', blurb: 'Dwarven forges, elven groves and desert bazaars.' },
    { id: 4, name: 'Frostmark', blurb: 'Snowbound holds and the ruins where dragons slept.' },
    { id: 5, name: 'The Crownlands', blurb: 'Aurelion, the white city, and the star-scarred north.' },
];

export const SHOP_DEFS = {
    general: { name: 'General Store', cats: ['ore', 'cloth', 'wood', 'herb', 'food', 'misc'], buyMul: 0.95, icon: 'basket' },
    smith: { name: 'Smithy & Armory', cats: ['ore', 'ingot', 'sword', 'armor', 'helm', 'shield'], buyMul: 1.0, icon: 'anvil' },
    apothecary: { name: 'Apothecary', cats: ['herb', 'potion', 'elixir'], buyMul: 1.0, icon: 'flask' },
    outfitter: { name: 'Outfitter', cats: ['cloth', 'boots', 'kit', 'rations', 'food'], buyMul: 1.0, icon: 'pack' },
    jeweler: { name: 'Jeweler', cats: ['gem', 'amulet'], buyMul: 1.0, icon: 'gem' },
    exchange: { name: 'Trade Exchange', cats: ['trade'], buyMul: 1.0, icon: 'coins' },
};

export const TOWNS = [
    { id: 'hearthmere', name: 'Hearthmere', region: 1, x: 14, z: 54, biome: 'meadow', guild: true,
      blurb: 'A sleepy farming village. Your grandmother ran her handcart out of the barn behind the bakery.',
      shops: ['general', 'outfitter'], stations: { smithy: 1, tailor: 1, provisioner: 1 },
      produces: ['grain', 'linen', 'pine', 'greenleaf', 'salt'], wants: ['copper_ingot', 'jerky', 'quartz', 'iron_ore', 'wine'],
      npcs: [['Pim', 'baker'], ['Old Garrick', 'smith'], ['Tilly', 'farmhand']] },
    { id: 'willowbrook', name: 'Willowbrook', region: 1, x: 29, z: 61, biome: 'river',
      blurb: 'Cottages on stilts along a lazy river; herb gardens on every sill.',
      shops: ['general', 'apothecary'], stations: { alchemist: 1, provisioner: 1 },
      produces: ['greenleaf', 'linen', 'honey', 'grain', 'quartz'], wants: ['copper_ore', 'wine', 'pine', 'jerky', 'salt'],
      npcs: [['Wren', 'herbalist'], ['Dobbin', 'ferryman'], ['Marigold', 'weaver']] },
    { id: 'copperfield', name: 'Copperfield', region: 1, x: 29, z: 41, biome: 'hills',
      blurb: 'A mining village in the foothills, forever smelling of smoke and warm bread.',
      shops: ['general', 'smith'], stations: { smithy: 2 },
      produces: ['copper_ore', 'coal', 'pine', 'iron_ore', 'copper_ingot'], wants: ['grain', 'linen', 'greenleaf', 'jerky', 'wine'],
      npcs: [['Brann', 'foreman'], ['Hettie', 'cook'], ['Little Joss', 'ore boy']] },
    { id: 'stonebridge', name: 'Stonebridge', region: 2, x: 47, z: 49, biome: 'hub', guild: true,
      blurb: 'The great crossroads town. Every road in the realm passes under its three arched bridges.',
      shops: ['general', 'smith', 'apothecary', 'outfitter', 'jeweler', 'exchange'], stations: { smithy: 3, tailor: 3, alchemist: 2, jeweler: 2, provisioner: 3 },
      produces: ['iron_ingot', 'wine', 'glassware', 'oak', 'leather'], wants: ['furs', 'perfume', 'pearls', 'honey', 'moonpetal'],
      npcs: [['Guildmistress Orla', 'guildmistress'], ['Fenwick', 'wainwright'], ['Dame Vesper', 'noble']] },
    { id: 'oakhollow', name: 'Oakhollow', region: 2, x: 44, z: 29, biome: 'forest',
      blurb: 'A town built around one enormous oak, with rope bridges between the branches.',
      shops: ['general', 'outfitter', 'apothecary'], stations: { tailor: 3, provisioner: 2 },
      produces: ['oak', 'leather', 'jerky', 'moonpetal', 'honey'], wants: ['iron_ingot', 'wine', 'glassware', 'copper_ingot', 'garnet'],
      npcs: [['Ranger Alder', 'ranger'], ['Bessie', 'tanner'], ['Thistle', 'beekeeper']] },
    { id: 'saltmarsh', name: 'Saltmarsh Quay', region: 2, x: 61, z: 61, biome: 'port', guild: true,
      blurb: 'A busy harbour of tarred planks, gulls and honest thieves.',
      shops: ['general', 'jeweler', 'exchange'], stations: { jeweler: 2, provisioner: 2 },
      produces: ['salt', 'pearls', 'garnet', 'wine', 'jerky'], wants: ['oak', 'leather', 'iron_ore', 'grain', 'furs'],
      npcs: [['Captain Marlow', 'sea captain'], ['Nettie', 'fishwife'], ['Quill', 'harbour clerk']] },
    { id: 'emberforge', name: 'Emberforge', region: 3, x: 69, z: 43, biome: 'forge', guild: true,
      blurb: 'A dwarven city carved into a volcano. The anvils never stop ringing.',
      shops: ['general', 'smith', 'exchange'], stations: { smithy: 5 },
      produces: ['iron_ore', 'coal', 'iron_ingot', 'steel_ingot', 'garnet'], wants: ['honey', 'wine', 'pearls', 'sapphire', 'jerky'],
      npcs: [['Thorgrim Ironbeard', 'master smith'], ['Dagna', 'apprentice'], ['Bofur', 'miner']] },
    { id: 'sunspire', name: 'Sunspire', region: 3, x: 87, z: 58, biome: 'desert', guild: true,
      blurb: 'A golden bazaar-city under towers of sun-baked glass, smelling of spice and rose water.',
      shops: ['general', 'jeweler', 'apothecary', 'outfitter', 'exchange'], stations: { jeweler: 5, alchemist: 3, provisioner: 5 },
      produces: ['spice', 'sapphire', 'perfume', 'glassware', 'fireroot'], wants: ['iron_ingot', 'furs', 'hardhide', 'wine', 'honey'],
      npcs: [['Sultana Amira', 'merchant queen'], ['Zahid', 'spice seller'], ['Layla', 'glassblower']] },
    { id: 'mistwood', name: 'Mistwood', region: 3, x: 62, z: 23, biome: 'elven',
      blurb: 'An elven grove wrapped in silver mist. Lanterns hang from trees older than the kingdom.',
      shops: ['general', 'apothecary', 'outfitter', 'jeweler'], stations: { alchemist: 5, tailor: 4, jeweler: 3 },
      produces: ['elderwood', 'moonpetal', 'moonstone', 'amber', 'ironwood'], wants: ['spice', 'steel_ingot', 'glassware', 'perfume', 'hardhide'],
      npcs: [['Elowen', 'herb-sage'], ['Faelar', 'bowyer'], ['Sylwen', 'lantern keeper']] },
    { id: 'frostpeak', name: 'Frostpeak Hold', region: 4, x: 36, z: 11, biome: 'snow', guild: true,
      blurb: 'A fortress of black stone and blue ice. The jarl feeds every traveller and trusts none of them.',
      shops: ['general', 'smith', 'outfitter', 'apothecary'], stations: { smithy: 4, tailor: 5, provisioner: 3 },
      produces: ['mithril_ore', 'furs', 'frostbloom', 'hardhide', 'jerky'], wants: ['wine', 'honey', 'spice', 'grain', 'perfume'],
      npcs: [['Jarl Hrolf', 'jarl'], ['Sigrid', 'shield-maiden'], ['Old Bjorn', 'trapper']] },
    { id: 'dragonwatch', name: 'Dragonwatch', region: 4, x: 87, z: 33, biome: 'ash',
      blurb: 'Ruined watchtowers on a scorched plateau, where a dragon-hunters\' guild trades in scales and legends.',
      shops: ['general', 'smith', 'exchange'], stations: { smithy: 4, alchemist: 4 },
      produces: ['drakeskin', 'fireroot', 'mithril_ingot', 'amber', 'coal'], wants: ['honey', 'wine', 'pearls', 'furs', 'jerky'],
      npcs: [['Captain Rhea', 'dragon hunter'], ['Scorch', 'scale-seller'], ['Mother Ashby', 'innkeeper']] },
    { id: 'aurelion', name: 'Aurelion', region: 5, x: 62, z: 8, biome: 'royal', guild: true,
      blurb: 'The white city of the Crownlands: marble, banners, and the Hero\'s own camp outside the gates.',
      shops: ['general', 'smith', 'apothecary', 'outfitter', 'jeweler', 'exchange'], stations: { smithy: 5, tailor: 5, alchemist: 5, jeweler: 5, provisioner: 5 },
      produces: ['heartwood', 'sunbloom', 'sunfruit', 'perfume', 'steel_ingot'], wants: ['mithril_ingot', 'furs', 'pearls', 'honey', 'drakeskin'],
      npcs: [['Seneschal Idris', 'royal steward'], ['Lady Corvane', 'noble'], ['Pip', 'page']] },
    { id: 'starfall', name: 'Starfall Spire', region: 5, x: 87, z: 12, biome: 'star',
      blurb: 'A crater of glassy rock where a star fell long ago. Strange metals still glitter in the walls.',
      shops: ['general', 'smith', 'jeweler'], stations: { smithy: 5 },
      produces: ['starmetal_ore', 'phoenixsilk', 'dawnstone', 'moonstone', 'starmetal_ingot'], wants: ['grain', 'jerky', 'honey', 'wine', 'steel_ingot'],
      npcs: [['Astra', 'star-seer'], ['Old Tam', 'prospector'], ['Cinder', 'phoenix keeper']] },
];
export const TOWN = Object.fromEntries(TOWNS.map((t) => [t.id, t]));

export const ROAD_PAIRS = [
    ['hearthmere', 'willowbrook'], ['hearthmere', 'copperfield'], ['willowbrook', 'copperfield'], ['copperfield', 'stonebridge'], ['willowbrook', 'stonebridge'],
    ['stonebridge', 'oakhollow'], ['stonebridge', 'saltmarsh'], ['stonebridge', 'emberforge'], ['oakhollow', 'mistwood'], ['oakhollow', 'frostpeak'],
    ['saltmarsh', 'emberforge'], ['saltmarsh', 'sunspire'], ['emberforge', 'sunspire'], ['emberforge', 'mistwood'], ['emberforge', 'dragonwatch'],
    ['mistwood', 'frostpeak'], ['mistwood', 'aurelion'], ['frostpeak', 'aurelion'], ['dragonwatch', 'sunspire'], ['dragonwatch', 'starfall'], ['aurelion', 'starfall'],
];
export const ROADS = ROAD_PAIRS.map(([a, b]) => {
    const A = TOWN[a], B = TOWN[b];
    const d = Math.hypot(A.x - B.x, A.z - B.z);
    return { a, b, dist: d, days: Math.max(1, Math.round(d / 10)) };
});
export const NEIGHBORS = {};
for (const t of TOWNS) NEIGHBORS[t.id] = [];
for (const r of ROADS) { NEIGHBORS[r.a].push({ to: r.b, days: r.days }); NEIGHBORS[r.b].push({ to: r.a, days: r.days }); }
export const roadDays = (a, b) => NEIGHBORS[a].find((n) => n.to === b)?.days ?? 0;

export const MERCHANT_TITLES = ['Peddler', 'Peddler', 'Hawker', 'Hawker', 'Trader', 'Trader', 'Merchant', 'Merchant', 'Master Merchant', 'Master Merchant', 'Caravan Master', 'Caravan Master', 'Guild Factor', 'Guild Factor', 'Guildmaster', 'Guildmaster', 'Merchant Prince', 'Merchant Prince', 'Merchant Lord', 'Merchant Legend', 'Merchant Legend'];

// Visiting heroes: class -> the gear families they shop for
export const HERO_CLASSES = {
    knight: { name: 'Knight', fams: ['sword', 'armor', 'shield', 'helm'], color: '#c9d3e0' },
    ranger: { name: 'Ranger', fams: ['boots', 'rations', 'kit', 'sword'], color: '#6aa84a' },
    mage: { name: 'Mage', fams: ['amulet', 'elixir', 'potion', 'helm'], color: '#9a6ad8' },
    cleric: { name: 'Cleric', fams: ['potion', 'amulet', 'rations', 'shield'], color: '#f0d870' },
    rogue: { name: 'Rogue', fams: ['boots', 'kit', 'elixir', 'sword'], color: '#7a7a90' },
};
export const HERO_NAMES = ['Aldwin', 'Brenna', 'Cedric', 'Dara', 'Edric', 'Fiora', 'Gareth', 'Hild', 'Ivor', 'Jora', 'Kestrel', 'Lysa', 'Merrick', 'Nessa', 'Orin', 'Petra', 'Quinn', 'Rowan', 'Sable', 'Torin', 'Ulla', 'Vance', 'Wynn', 'Yara', 'Zeph'];
export const HERO_TITLES = ['the Bold', 'of the Vale', 'Stormborn', 'the Wanderer', 'Ironhand', 'the Swift', 'Dawnseeker', 'the Brave', 'Oathkeeper', 'Wolfsbane'];
