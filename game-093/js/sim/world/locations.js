// The authored places of the world: where they stand on the overmap, what they're called and which chapter they belong to.

export const LOCS = {
    emberfield: { id: 'emberfield', kind: 'town', name: 'Emberfield', x: 22, y: 48, tier: 0, zone: 'grass', theme: 'village', blurb: 'A quiet forge-village at the world\'s western edge.' },
    woods: { id: 'woods', kind: 'dungeon', name: 'Whispering Woods', x: 20, y: 32, zone: 'woods', theme: 'woods', rooms: 9, size: [44, 40], rec: 4, blurb: 'An old forest where the trees listen.' },
    silverbrook: { id: 'silverbrook', kind: 'town', name: 'Silverbrook', x: 46, y: 42, tier: 1, zone: 'plains', theme: 'river', blurb: 'A market town on the Silver River, home of the Dawn Order\'s chapel.' },
    mines: { id: 'mines', kind: 'dungeon', name: 'Greymoor Mines', x: 62, y: 30, zone: 'mines', theme: 'mines', rooms: 11, size: [50, 44], rec: 9, blurb: 'Dwarven galleries, silent for three weeks.' },
    portazura: { id: 'portazura', kind: 'town', name: 'Port Azura', x: 72, y: 46, tier: 2, zone: 'coast', theme: 'harbor', blurb: 'A harbor city of smugglers, sailors and sea-glass lamps.' },
    temple: { id: 'temple', kind: 'dungeon', name: 'Sunken Temple', x: 86, y: 51, zone: 'temple', theme: 'temple', rooms: 11, size: [50, 44], rec: 14, blurb: 'A drowned shrine of the Tide-Mother, risen with the new moon.' },
    dunehaven: { id: 'dunehaven', kind: 'town', name: 'Dunehaven', x: 48, y: 65, tier: 3, zone: 'desert', theme: 'oasis', blurb: 'An oasis city of scholars and caravans.' },
    pyramid: { id: 'pyramid', kind: 'dungeon', name: 'Pyramid of Ra\'Khet', x: 30, y: 66, zone: 'pyramid', theme: 'pyramid', rooms: 12, size: [52, 46], rec: 20, blurb: 'A sun-king\'s tomb, buried until the sandstorms parted.' },
    hoarhold: { id: 'hoarhold', kind: 'town', name: 'Hoarhold', x: 78, y: 12, tier: 4, zone: 'snow', theme: 'snow', blurb: 'A fortress town of fur, iron and long winters.' },
    glacier: { id: 'glacier', kind: 'dungeon', name: 'Glacier Citadel', x: 90, y: 8, zone: 'glacier', theme: 'glacier', rooms: 12, size: [52, 46], rec: 26, blurb: 'A palace carved in a glacier by a forgotten winter queen.' },
    spire: { id: 'spire', kind: 'dungeon', name: 'Obsidian Spire', x: 46, y: 8, zone: 'spire', theme: 'spire', rooms: 14, size: [56, 50], rec: 34, blurb: 'The tower of the Hollow King, grown from the ash in a single night.' },
    maw: { id: 'maw', kind: 'dungeon', name: 'Cinder Maw', x: 10, y: 10, zone: 'maw', theme: 'maw', rooms: 12, size: [52, 46], rec: 44, optional: true, blurb: 'A dead volcano with something very alive inside it.' },
};
export const TOWNS = Object.values(LOCS).filter((l) => l.kind === 'town').map((l) => l.id);
export const DUNGEONS = Object.values(LOCS).filter((l) => l.kind === 'dungeon').map((l) => l.id);

/** Roads of the overmap, as pairs of places. */
export const ROADS = [
    ['emberfield', 'woods'], ['emberfield', 'silverbrook'], ['silverbrook', 'mines'], ['silverbrook', 'portazura'], ['portazura', 'temple'],
    ['silverbrook', 'dunehaven'], ['dunehaven', 'pyramid'], ['mines', 'hoarhold'], ['hoarhold', 'glacier'], ['hoarhold', 'spire'], ['spire', 'maw'],
];
/** Mountain ridges that cut the continent in two; the road passes through one gap, closed by a story flag until it opens. */
export const RIDGES = [
    { id: 'sand', y0: 55, y1: 59, passX: 47, flag: 'open_sand', kind: 'sandstorm', label: 'A roaring sandstorm walls off the southern desert.' },
    { id: 'ice', y0: 19, y1: 23, passX: 68, flag: 'open_ice', kind: 'icewall', label: 'A wall of ancient ice blocks the northern pass.' },
];
export const ZONE_KEYS = ['grass', 'forest', 'plains', 'mountain', 'coast', 'desert', 'snow', 'ash', 'volcano'];
