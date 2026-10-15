// The kingdom of Vellumvale: a 9 × 7 grid of zones, the passages between them, and what is in
// each one. js/sim/worldgen.js turns this into tiles.
//
// Each zone is ZW × ZH tiles with a one-tile border of its biome's wall. A connection opens a gap
// in the shared border (four tiles wide unless `span` says otherwise, or the whole edge when
// `open`), and a `lock` fills the gap with that grimoire's obstacle. Town zones are drawn by hand
// below; the rest are grown from their biome around the features listed.

export const BIOMES = {
    village: { ground: 'grass', path: 'cobble', wall: 'hedge', scatter: [], music: 'village', town: true },
    farm:    { ground: 'grass', path: 'path', wall: 'hedge', scatter: [['tree', 0.025], ['bush', 0.03], ['rock', 0.006]], fields: true, foes: 'farm', music: 'fields' },
    meadow:  { ground: 'grass', path: 'path', wall: 'bush', scatter: [['tree', 0.035], ['bush', 0.035], ['rock', 0.008]], flowers: 0.22, ponds: 1, foes: 'meadow', music: 'fields' },
    wood:    { ground: 'grass', path: null, wall: 'tree', scatter: [['tree', 0.26], ['bush', 0.05], ['mushroom', 0.012], ['stump', 0.01]], foes: 'wood', music: 'wood' },
    hill:    { ground: 'grass', path: 'path', wall: 'rock', scatter: [['rock', 0.045], ['bush', 0.04], ['tree', 0.03]], flowers: 0.08, foes: 'hill', music: 'fields' },
    castle:  { ground: 'grass', path: 'cobble', wall: 'stonewall', scatter: [], music: 'castle', town: true },
    moor:    { ground: 'moor', path: null, wall: 'rock', scatter: [['deadtree', 0.05], ['rock', 0.06], ['bush', 0.025]], ponds: 1, foes: 'moor', music: 'moor' },
    abbeyg:  { ground: 'moor', path: 'tile', wall: 'stonewall', scatter: [['deadtree', 0.05], ['rock', 0.03]], foes: 'abbeyg', music: 'moor' },
    thorn:   { ground: 'moss', path: null, wall: 'tree', scatter: [['tree', 0.16], ['bush', 0.1], ['thorn', 0.04]], foes: 'thorn', music: 'wood' },
    quarry:  { ground: 'stone', path: 'path', wall: 'cliff', scatter: [['rock', 0.09], ['boulderx', 0.0]], foes: 'quarry', music: 'moor' },
    peak:    { ground: 'snow', path: null, wall: 'cliff', scatter: [['snowpine', 0.12], ['rock', 0.04]], ponds: 1, foes: 'peak', music: 'peak' },
    coast:   { ground: 'sand', path: 'path', wall: 'rock', scatter: [['palm', 0.035], ['rock', 0.03]], foes: 'coast', music: 'coast' },
    lake:    { ground: 'water', path: null, wall: 'reef', scatter: [], foes: 'lake', music: 'lake', lake: true },
    willow:  { ground: 'grass', path: 'path', wall: 'bush', scatter: [['tree', 0.07], ['bush', 0.04], ['mushroom', 0.01]], flowers: 0.12, foes: 'willow', music: 'fields' },
    mouse:   { ground: 'grass', path: 'path', wall: 'hedge', scatter: [], music: 'mouse', town: true },
    green:   { ground: 'grass', path: 'path', wall: 'hedge', scatter: [['hedge', 0.05], ['bush', 0.05]], flowers: 0.25, foes: 'willow', music: 'fields' },
    sky:     { ground: 'grass', path: 'stone', wall: 'pit', scatter: [['rock', 0.05], ['bush', 0.03], ['pit', 0.025]], flowers: 0.2, foes: 'sky', music: 'sky' },
};

// tier: how lively the foes are (see enemies.js statsFor)
// feats: generated zones only (towns are drawn in TOWNS)
const Z = (c, r, id, name, biome, tier, o = {}) => ({ c, r, id, name, biome, tier, feats: [], ...o });

export const ZONES = [
    // ------------------------------------------------------------ row 0
    Z(0, 0, 'abbey', 'Gloaming Abbey', 'abbeyg', 5.6, { feats: [{ k: 'dungeon', id: 'abbey', x: 11, y: 5 }] }),
    Z(1, 0, 'heights', 'Mistmoor Heights', 'moor', 2.4, { feats: [{ k: 'pocket', x: 17, y: 4, lock: 'ghost', item: 'patch', id: 'c_heights' }, { k: 'npc', id: 'cairnwarden', x: 8, y: 9 }] }),
    Z(2, 0, 'cinder', 'Cinder Ridge', 'moor', 2.6, { feats: [{ k: 'dungeon', id: 'kiln', x: 12, y: 5 }] }),
    Z(3, 0, 'frostwest', 'Frostmantle West', 'peak', 4.0, { feats: [{ k: 'pocket', x: 6, y: 5, lock: 'thorn', item: 'inkwell', id: 'c_frostwest' }, { k: 'npc', id: 'snowman', x: 15, y: 9 }] }),
    Z(4, 0, 'summit', 'Rime Summit', 'peak', 4.2, { feats: [{ k: 'dungeon', id: 'rime', x: 10, y: 5 }] }),
    Z(5, 0, 'frosteast', 'Frostmantle East', 'peak', 4.2, { feats: [{ k: 'pocket', x: 16, y: 6, lock: 'boulder', item: 'patch', id: 'c_frosteast' }, { k: 'chest', id: 'c_frosteast2', x: 6, y: 11, item: 'cocoa', n: 2 }] }),
    Z(6, 0, 'skyruins', 'Skyreach Ruins', 'sky', 6.0, { feats: [{ k: 'chest', id: 'c_skyruins', x: 12, y: 7, item: 'patch' }, { k: 'npc', id: 'cloudkid', x: 7, y: 10 }] }),
    Z(7, 0, 'isles', 'Drifting Isles', 'sky', 6.2, { feats: [{ k: 'chest', id: 'c_isles', x: 15, y: 6, item: 'inkwell' }] }),
    Z(8, 0, 'obspeak', 'Observatory Peak', 'sky', 6.4, { feats: [{ k: 'dungeon', id: 'observatory', x: 12, y: 5 }] }),
    // ------------------------------------------------------------ row 1
    Z(0, 1, 'fen', 'Mistmoor Fen', 'moor', 2.4, { feats: [{ k: 'chest', id: 'c_fen', x: 5, y: 4, item: 'bigink' }, { k: 'npc', id: 'bogman', x: 15, y: 10 }] }),
    Z(1, 1, 'nettle', 'Nettle Hollow', 'moor', 2.2, { feats: [{ k: 'building', id: 'witchhut', x: 9, y: 4, w: 5, h: 4, style: 'hut', interior: 'witchhut' }] }),
    Z(2, 1, 'mistedge', 'Mistmoor Edge', 'moor', 2.2, { feats: [{ k: 'pocket', x: 16, y: 10, lock: 'deep', item: 'patch', id: 'c_mistedge' }] }),
    Z(3, 1, 'lodge', 'Frostmantle Lodge', 'peak', 3.8, { feats: [{ k: 'building', id: 'lodge', x: 9, y: 4, w: 6, h: 4, style: 'lodge', interior: 'lodge' }, { k: 'npc', id: 'skier', x: 16, y: 10 }] }),
    Z(4, 1, 'castle', 'Castle Aubade', 'castle', 0, { town: 'castle' }),
    Z(5, 1, 'gardens', 'Royal Gardens', 'castle', 0, { town: 'gardens' }),
    Z(6, 1, 'steps', 'Skyreach Steps', 'sky', 5.6, { feats: [{ k: 'building', id: 'hermit', x: 11, y: 5, w: 4, h: 3, style: 'hut', interior: 'hermithut' }] }),
    Z(7, 1, 'windward', 'Windward Isles', 'sky', 6.0, { feats: [{ k: 'pocket', x: 6, y: 10, lock: 'tiny', item: 'patch', id: 'c_windward' }] }),
    Z(8, 1, 'perch', "Gull's Perch", 'sky', 6.0, { feats: [{ k: 'chest', id: 'c_perch', x: 12, y: 8, item: 'moonsilk' }] }),
    // ------------------------------------------------------------ row 2
    Z(0, 2, 'woodnorth', 'Whisperwood North', 'wood', 1.4, { feats: [{ k: 'pocket', x: 6, y: 6, lock: 'thorn', item: 'patch', id: 'c_woodnorth' }, { k: 'chest', id: 'c_woodnorth2', x: 17, y: 10, item: 'tea', n: 3 }] }),
    Z(1, 2, 'glimmer', 'Glimmer Hollow', 'wood', 1.5, { feats: [{ k: 'dungeon', id: 'glimmer', x: 12, y: 4 }] }),
    Z(2, 2, 'hills', 'Hearthfield Hills', 'hill', 1.3, { feats: [{ k: 'pocket', x: 17, y: 5, lock: 'fog', item: 'inkwell', id: 'c_hills' }, { k: 'npc', id: 'shepherd', x: 8, y: 8 }] }),
    Z(3, 2, 'rise', "Shepherd's Rise", 'hill', 1.4, { feats: [{ k: 'chest', id: 'c_rise', x: 6, y: 5, item: 'biscuit', n: 2 }, { k: 'sign', x: 13, y: 3, text: 'NORTH: Frostmantle Pass. Closed by rockslide. — By order of the Queen' }] }),
    Z(4, 2, 'auntown', 'Aubade', 'castle', 0, { town: 'auntown' }),
    Z(5, 2, 'aunmarket', 'Aubade Market', 'castle', 0, { town: 'aunmarket' }),
    Z(6, 2, 'downs', 'Eastern Downs', 'hill', 1.8, { feats: [{ k: 'sign', x: 10, y: 3, text: 'Skyreach cliffs. Climbing strictly by vine.' }, { k: 'pocket', x: 17, y: 11, lock: 'stream', item: 'patch', id: 'c_downs' }] }),
    Z(7, 2, 'gullwing', 'Gullwing Beach', 'coast', 3.8, { feats: [{ k: 'chest', id: 'c_gullwing', x: 15, y: 6, item: 'jam', n: 2 }, { k: 'npc', id: 'beachcomber', x: 8, y: 10 }] }),
    Z(8, 2, 'point', 'Lighthouse Point', 'coast', 4.0, { sea: 15, feats: [{ k: 'dungeon', id: 'lighthouse', x: 9, y: 4 }] }),
    // ------------------------------------------------------------ row 3
    Z(0, 3, 'oakglade', 'Hollow Oak Glade', 'wood', 1.2, { feats: [{ k: 'dungeon', id: 'hollowoak', x: 11, y: 5 }] }),
    Z(1, 3, 'whisper', 'Whisperwood', 'wood', 1.1, { feats: [{ k: 'npc', id: 'biscuitcat', x: 6, y: 11 }, { k: 'chest', id: 'c_whisper', x: 17, y: 4, item: 'sachet', n: 2 }] }),
    Z(2, 3, 'mill', 'Hearthfield Mill', 'farm', 1.0, { feats: [{ k: 'building', id: 'mill', x: 9, y: 3, w: 5, h: 5, style: 'mill', interior: 'mill' }, { k: 'npc', id: 'scarecrow', x: 17, y: 11 }] }),
    Z(3, 3, 'hearthfield', 'Hearthfield', 'farm', 1.0, { feats: [{ k: 'building', id: 'farm1', x: 4, y: 3, w: 5, h: 4, style: 'cottage', interior: 'farmhouse1' }, { k: 'npc', id: 'farmerjo', x: 15, y: 10 }] }),
    Z(4, 3, 'quillford', 'Quillford', 'village', 0, { town: 'quillford' }),
    Z(5, 3, 'orchard', 'Orchard Lane', 'farm', 1.0, { feats: [{ k: 'npc', id: 'orchardist', x: 14, y: 4 }, { k: 'pocket', x: 5, y: 10, lock: 'boulder', item: 'inkwell', id: 'c_orchard' }] }),
    Z(6, 3, 'fennimore', "Fennimore's Downs", 'hill', 1.6, { feats: [{ k: 'building', id: 'fennicot', x: 10, y: 3, w: 5, h: 4, style: 'cottage', interior: 'fennicot' }] }),
    Z(7, 3, 'saltmere', 'Saltmere', 'coast', 0, { town: 'saltmere' }),
    Z(8, 3, 'docks', 'Saltmere Docks', 'coast', 0, { town: 'docks' }),
    // ------------------------------------------------------------ row 4
    Z(0, 4, 'ranger', "Ranger's Clearing", 'wood', 1.3, { feats: [{ k: 'building', id: 'cabin', x: 9, y: 4, w: 5, h: 4, style: 'cabin', interior: 'cabin' }] }),
    Z(1, 4, 'brook', 'Mossy Brook', 'wood', 1.2, { feats: [{ k: 'pocket', x: 15, y: 10, lock: 'stream', item: 'patch', id: 'c_brook' }, { k: 'pond', x: 7, y: 5, r: 2 }] }),
    Z(2, 4, 'pumpkin', 'Pumpkin Patch', 'farm', 1.0, { feats: [{ k: 'pocket', x: 16, y: 5, lock: 'deep', item: 'inkwell', id: 'c_pumpkin' }, { k: 'npc', id: 'pumpkingran', x: 8, y: 9 }] }),
    Z(3, 4, 'southfield', 'Southfield', 'farm', 1.0, { feats: [{ k: 'building', id: 'farm2', x: 14, y: 3, w: 5, h: 4, style: 'cottage', interior: 'farmhouse2' }, { k: 'chest', id: 'c_southfield', x: 5, y: 11, item: 'tea', n: 2 }] }),
    Z(4, 4, 'square', 'Lantern Square', 'village', 0, { town: 'square' }),
    Z(5, 4, 'lakefarm', 'Lakeside Farm', 'farm', 1.1, { feats: [{ k: 'npc', id: 'fisherboy', x: 17, y: 9 }, { k: 'chest', id: 'c_lakefarm', x: 6, y: 4, item: 'candle', n: 2 }] }),
    Z(6, 4, 'lakenorth', 'Lumen Lake North', 'lake', 4.6, { land: ['W'], feats: [{ k: 'island', x: 15, y: 6, r: 2, chest: { id: 'c_lakenorth', item: 'pearl' } }] }),
    Z(7, 4, 'reeds', 'Reed Isles', 'lake', 4.8, { feats: [{ k: 'island', x: 11, y: 8, r: 3, chest: { id: 'c_reeds', item: 'patch' } }] }),
    Z(8, 4, 'strand', 'Shell Strand', 'coast', 4.0, { sea: 14, feats: [{ k: 'chest', id: 'c_strand', x: 6, y: 5, item: 'biscuit', n: 3 }] }),
    // ------------------------------------------------------------ row 5
    Z(0, 5, 'thornvale', 'Thornvale', 'thorn', 3.0, { feats: [{ k: 'building', id: 'briarcot', x: 9, y: 5, w: 5, h: 4, style: 'cottage', interior: 'briarcot' }] }),
    Z(1, 5, 'briar', 'Briar Hollow', 'thorn', 3.0, { feats: [{ k: 'chest', id: 'c_briar', x: 15, y: 4, item: 'pressed' }, { k: 'pocket', x: 6, y: 10, lock: 'tiny', item: 'inkwell', id: 'c_briar2' }] }),
    Z(2, 5, 'willowwest', 'Willowbank West', 'meadow', 1.2, { edge: { S: 'rapids' }, feats: [{ k: 'pond', x: 7, y: 6, r: 2 }, { k: 'chest', id: 'c_willowwest', x: 16, y: 5, item: 'inkpot', n: 2 }] }),
    Z(3, 5, 'willowbank', 'Willowbank', 'meadow', 1.1, { edge: { S: 'rapids' }, feats: [{ k: 'npc', id: 'picnicker', x: 6, y: 6 }, { k: 'sign', x: 13, y: 12, text: 'SOUTH: Mousehold. The ferry mouse is on holiday. Indefinitely.' }] }),
    Z(4, 5, 'picnic', 'Picnic Meadow', 'meadow', 1.1, { edge: { S: 'rapids' }, feats: [{ k: 'npc', id: 'kitepoet', x: 16, y: 5 }] }),
    Z(5, 5, 'lakemeadow', 'Lakeside Meadow', 'meadow', 1.2, { edge: { S: 'rapids' }, feats: [{ k: 'chest', id: 'c_lakemeadow', x: 9, y: 10, item: 'tea', n: 2 }] }),
    Z(6, 5, 'lake', 'Lumen Lake', 'lake', 4.8, { land: ['W'], feats: [{ k: 'island', x: 16, y: 9, r: 2, chest: { id: 'c_lake', item: 'inkwell' } }] }),
    Z(7, 5, 'archiveisle', 'Archive Isle', 'lake', 5.0, { feats: [{ k: 'island', x: 12, y: 8, r: 4, dungeon: 'archive' }] }),
    Z(8, 5, 'tidepools', 'Tidepools', 'coast', 4.2, { sea: 13, feats: [{ k: 'npc', id: 'tidekid', x: 7, y: 8 }, { k: 'pocket', x: 6, y: 3, lock: 'rune', item: 'patch', id: 'c_tidepools' }] }),
    // ------------------------------------------------------------ row 6
    Z(0, 6, 'quarry', 'Stoneheart Quarry', 'quarry', 3.2, { feats: [{ k: 'dungeon', id: 'quarry', x: 11, y: 4 }] }),
    Z(1, 6, 'brambleend', 'Bramble End', 'thorn', 3.1, { feats: [{ k: 'chest', id: 'c_brambleend', x: 12, y: 8, item: 'patch' }] }),
    Z(2, 6, 'willowsouth', 'Willowbank South', 'willow', 4.6, { edge: { N: 'rapids' }, feats: [{ k: 'chest', id: 'c_willowsouth', x: 8, y: 9, item: 'jam', n: 3 }, { k: 'npc', id: 'heron', x: 15, y: 6 }] }),
    Z(3, 6, 'mousehold', 'Mousehold', 'mouse', 0, { edge: { N: 'rapids' }, town: 'mousehold' }),
    Z(4, 6, 'burrowgdn', 'Burrow Gardens', 'mouse', 0, { edge: { N: 'rapids' }, town: 'burrowgdn' }),
    Z(5, 6, 'glasshouse', 'Glasshouse Grounds', 'green', 5.0, { feats: [{ k: 'dungeon', id: 'greenhouse', x: 12, y: 5 }] }),
    Z(6, 6, 'lakesouth', 'Lumen Lake South', 'lake', 4.8, { feats: [{ k: 'island', x: 9, y: 7, r: 2, chest: { id: 'c_lakesouth', item: 'cocoa', n: 2 } }] }),
    Z(7, 6, 'shallows', 'Misty Shallows', 'lake', 5.0, { feats: [{ k: 'island', x: 13, y: 9, r: 2, chest: { id: 'c_shallows', item: 'patch' } }] }),
    Z(8, 6, 'wreck', 'Wreck Cove', 'coast', 4.4, { sea: 12, feats: [{ k: 'chest', id: 'c_wreck', x: 8, y: 7, item: 'silver' }] }),
];

export const ZONE_AT = {};
for (const z of ZONES) ZONE_AT[z.c + ',' + z.r] = z;

// Passages between neighbouring zones. `open`: no border at all along that edge.
// span: [from, to] in tiles along the edge (default the middle four).
const C = (a, b, o = {}) => ({ a, b, ...o });
export const CONNS = [
    // ---- home: the village and the farms around it
    C([4, 3], [4, 4], { open: true }),
    C([4, 3], [3, 3]), C([4, 3], [5, 3]), C([4, 4], [3, 4]), C([4, 4], [5, 4]), C([4, 4], [4, 5]),
    C([4, 3], [4, 2]),
    C([2, 3], [3, 3]), C([2, 4], [3, 4]), C([2, 3], [2, 4]), C([3, 3], [3, 4], { open: true }), C([5, 3], [5, 4]),
    // ---- Whisperwood
    C([1, 3], [2, 3]), C([1, 4], [2, 4]), C([0, 3], [1, 3]), C([0, 4], [1, 4]), C([0, 2], [1, 2]),
    C([0, 2], [0, 3]), C([1, 2], [1, 3]), C([0, 3], [0, 4]), C([1, 3], [1, 4]),
    // ---- the hills and Aubade
    C([2, 2], [2, 3]), C([3, 2], [3, 3]), C([2, 2], [3, 2]), C([3, 2], [4, 2]),
    C([4, 2], [5, 2], { open: true }), C([4, 1], [4, 2]), C([5, 1], [5, 2]), C([4, 1], [5, 1]),
    C([5, 3], [6, 3]), C([6, 2], [6, 3]), C([5, 2], [6, 2]),
    // ---- Willowbank meadows and the lake shore
    C([2, 5], [3, 5]), C([3, 5], [4, 5], { open: true }), C([4, 5], [5, 5]), C([3, 4], [3, 5]), C([5, 4], [5, 5]),
    C([5, 4], [6, 4]), C([5, 5], [6, 5]),
    // ---- Lumen Lake (water all the way)
    C([6, 4], [7, 4], { open: true }), C([6, 4], [6, 5], { open: true }), C([6, 5], [7, 5], { open: true }),
    C([7, 4], [7, 5], { open: true }), C([6, 5], [6, 6], { open: true }), C([6, 6], [7, 6], { open: true }),
    C([7, 5], [7, 6], { open: true }), C([7, 4], [8, 4], { span: [6, 10] }), C([7, 6], [8, 6], { span: [5, 9] }),
    // ---- fog: Mistmoor (Zephyr's Almanac)
    C([0, 2], [0, 1], { lock: 'fog' }), C([1, 2], [1, 1], { lock: 'fog' }), C([2, 2], [2, 1], { lock: 'fog' }),
    C([0, 1], [1, 1]), C([1, 1], [2, 1]), C([1, 0], [1, 1]), C([2, 0], [2, 1]), C([1, 0], [2, 0]),
    // ---- ghost gates: the Abbey (Echo Codex)
    C([0, 0], [1, 0], { lock: 'ghost' }), C([0, 0], [0, 1], { lock: 'ghost' }),
    // ---- brambles: Thornvale (Hearth Lexicon)
    C([0, 4], [0, 5], { lock: 'thorn' }), C([1, 4], [1, 5], { lock: 'thorn' }), C([2, 5], [1, 5], { lock: 'thorn' }),
    C([0, 5], [1, 5]), C([0, 5], [0, 6]), C([1, 5], [1, 6]), C([0, 6], [1, 6]),
    // ---- boulders: Frostmantle and the coast road (Lithic Grammar)
    C([3, 2], [3, 1], { lock: 'boulder' }), C([4, 1], [4, 0], { lock: 'boulder', span: [19, 22] }),
    C([3, 0], [3, 1]), C([3, 0], [4, 0]), C([4, 0], [5, 0]),
    C([6, 3], [7, 3], { lock: 'boulder' }), C([6, 2], [7, 2], { lock: 'boulder' }),
    C([7, 2], [8, 2]), C([7, 3], [8, 3], { open: true }), C([7, 2], [7, 3]), C([8, 2], [8, 3]),
    C([8, 3], [8, 4]), C([8, 4], [8, 5]), C([8, 5], [8, 6]),
    // ---- the river: Mousehold (Frost Psalter)
    C([2, 5], [2, 6], { lock: 'stream' }), C([3, 5], [3, 6], { lock: 'stream' }), C([4, 5], [4, 6], { lock: 'stream' }),
    C([2, 6], [3, 6]), C([3, 6], [4, 6], { open: true }),
    // ---- a mouse door in the hedge: the Glasshouse (Diminutive Grammar)
    C([4, 6], [5, 6], { lock: 'tiny', span: [7, 8] }),
    // ---- vines up the cliffs: Skyreach (Herbarium Verdant)
    C([6, 2], [6, 1], { lock: 'sprout' }), C([8, 2], [8, 1], { lock: 'sprout', span: [5, 8] }),
    // ---- chasms between the floating isles (Featherfall Folio)
    C([6, 1], [6, 0], { lock: 'chasm' }), C([6, 1], [7, 1], { lock: 'chasm' }), C([7, 1], [7, 0]),
    C([7, 0], [8, 0], { lock: 'chasm' }), C([7, 1], [8, 1], { lock: 'chasm' }), C([8, 1], [8, 0], { lock: 'chasm' }),
    C([6, 0], [7, 0], { lock: 'chasm' }),
];

// ------------------------------------------------------------------ hand-drawn towns
// 22 × 14 tiles: the zone inside its border. Capital letters are buildings (see BUILDINGS: a
// rectangle of one letter; the door is the middle of its bottom row). Lower case:
//   .  ground   :  path / cobbles   ,  flowers   t tree   b bush   h hedge   x flower box
//   l  lamp     w  well   o statue/fountain   c crate   r barrel   k counter   p palm
//   m  a mouse house (2 × 2, no way in)   ~ water   = pier / bridge   f fence   n bench (crate)

export const TOWNS = {
    quillford: [
        't.AAAAA...::::..BBBBB.',
        '..AAAAA...::::..BBBBB.',
        '..AAAAA...::::..BBBBB.',
        'x.AAAAA,..::::.,BBBBBx',
        '....:.....::::....:...',
        '::::::::::::::::::::::',
        ':::::l::::::::::l:::::',
        '::::::::::w:::::::::::',
        '::::::::::::::::::::::',
        '.CCCCC..t.::::..DDDD..',
        '.CCCCC....::::..DDDD..',
        '.CCCCC.,..::::..DDDD.t',
        '.CCCCC....::::..DDDD..',
        '...:......::::....:...',
    ],
    square: [
        '::::::::::::::::::::::',
        '.x....LLLLLLLLLL....x.',
        '......LLLLLLLLLL......',
        '.t....LLLLLLLLLL....t.',
        '......LLLLLLLLLL......',
        '::....LLLLLLLLLL....::',
        ':::...LLLLLLLLLL...:::',
        '::::::::::::::::::::::',
        ':::::l::::::::::l:::::',
        '.IIIII...::::::..EEEE.',
        '.IIIII...:::::...EEEE.',
        '.IIIII.,.:::o:...EEEE.',
        '.IIIII...:::::...EEEE.',
        '...:.....::::::...:...',
    ],
    castle: [
        't.................::::',
        '...QQQQ...........::::',
        '...QQQQ.KKKKKKKKK.::::',
        '...QQQQ.KKKKKKKKK.::::',
        '...QQQQ.KKKKKKKKK.::::',
        '...QQQQ.KKKKKKKKK.::::',
        '.x...q..KKKKKKKKK.::::',
        '....::::KKKKKKKKK:::::',
        '.l..::::::::::::::::::',
        '....::::::::::::::::::',
        't...::::..o..::::....t',
        '.......::::::::.......',
        '..x....::::::::....x..',
        '.........::::.........',
    ],
    gardens: [
        '......................',
        '.hhhhhh........hhhhhh.',
        '.h,,,,h..x..x..h,,,,h.',
        '.h,,,,h........h,,,,h.',
        '.h,,,,,...o....,,,,,h.',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '.h,,,,,........,,,,,h.',
        '.h,,,,h..x..x..h,,,,h.',
        '.h,,,,h........h,,,,h.',
        '.hhhhhh...::...hhhhhh.',
        '..........::..........',
        '.x.....x..::..x.....x.',
        '.........::::.........',
    ],
    auntown: [
        '..FFFFF..::::..GGGGG..',
        '..FFFFF..::::..GGGGG..',
        '..FFFFF..::::..GGGGG..',
        '.lFFFFF..::::..GGGGGl.',
        '....:....::::....:....',
        '::::::::::::::::::::::',
        '::::::::::o:::::::::::',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '.HHHH....::::...JJJJJ.',
        '.HHHH....::::...JJJJJ.',
        '.HHHH.x..::::...JJJJJ.',
        '.HHHH....::::.x.JJJJJ.',
        '...:.....::::.....:...',
    ],
    aunmarket: [
        '.........::::.........',
        '.MMMMM...::::...NNNN..',
        '.MMMMM...::::...NNNN..',
        '.MMMMM...::::...NNNN..',
        '.MMMMM...::::...NNNN..',
        '...:.....::::.....:..:',
        '::::::::::::::::::::::',
        '::::::cc:::::rr:::::::',
        '::::::::::::::::::::::',
        '..x....r:::::r....x...',
        '.OOOO..........PPPP...',
        '.OOOO....t.....PPPP...',
        '.OOOO..........PPPP...',
        '...:.............:....',
    ],
    saltmere: [
        '.........::::.........',
        '.SSSSS...::::...UUUUU.',
        '.SSSSS...::::...UUUUU.',
        '.SSSSS...::::...UUUUU.',
        '.SSSSS...::::...UUUUU.',
        '...:.....::::.....:...',
        '::::::::::::::::::::::',
        ':::::l::::w:::::l:::::',
        '::::::::::::::::::::::',
        '..p...............p...',
        '.VVVV....rr....YYYYY..',
        '.VVVV..........YYYYY..',
        '.VVVV...c......YYYYY..',
        '...:.............:....',
    ],
    docks: [
        '.........::::..~~~~~~~',
        '....p....::::...~~~~~~',
        '..ZZZZ...::::...~~~~~~',
        '..ZZZZ...::::...~~~~~~',
        '..ZZZZ...::::..=====~~',
        '....:....::::...~~~~~~',
        ':::::::::::::::======~',
        ':::::::::::::...~~~~~~',
        '::::r::::::::...~~~~~~',
        '....c....::::..=====~~',
        '..p......::::...~~~~~~',
        '.........::::...~~~~~~',
        '....p....::::..~~~~~~~',
        '.........::::..~~~~~~~',
    ],
    mousehold: [
        '.........::::.........',
        '.mm..mm..::::..mm..mm.',
        '.mm..mm..::::..mm..mm.',
        '....:....::::....:....',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '::::::,:::::::,:::::::',
        '..mm..::::::::::..mm..',
        '..mm...::::::::...mm..',
        '.......:TTTTTT:.......',
        '.......:TTTTTT:.......',
        '.......:TTTTTT:.......',
        '......................',
    ],
    burrowgdn: [
        '.........::::.........',
        '.,,,,,...::::...,,,,,.',
        '.,mm,,...::::...,,mm,.',
        '.,mm,,...::::...,,mm,.',
        '.,,,,,...::::...,,,,,.',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '::::::::::::::::::::::',
        '......kkk.....,,,,,...',
        '..............,,,,,...',
        '.mm....x..x...,,,,,...',
        '.mm..............t....',
        '......................',
    ],
};

// Buildings in the hand-drawn towns, by town and letter. interior: the map you walk into.
export const BUILDINGS = {
    quillford: {
        A: { id: 'pips', name: "Pip's Provisions", style: 'shop', interior: 'pips' },
        B: { id: 'mabels', name: "Mabel's Woollens", style: 'shop', interior: 'mabels' },
        C: { id: 'bakery', name: "Bramwell's Bakery", style: 'bakery', interior: 'bakery' },
        D: { id: 'hattie', name: "Hattie's Cottage", style: 'cottage', interior: 'hattie' },
    },
    square: {
        L: { id: 'library', name: 'The Lantern Library', style: 'library', interior: 'library' },
        I: { id: 'sleepyowl', name: 'The Sleepy Owl', style: 'inn', interior: 'sleepyowl' },
        E: { id: 'mayor', name: "Mayor Thistlewood's", style: 'cottage', interior: 'mayor' },
    },
    castle: {
        K: { id: 'castle', name: 'Castle Aubade', style: 'castle', interior: 'throne' },
        Q: { id: 'keep', name: 'The Old Keep', style: 'tower', dungeon: 'keep' },
    },
    gardens: {},
    auntown: {
        F: { id: 'stationers', name: 'Royal Stationers', style: 'shop', interior: 'stationers' },
        G: { id: 'curio', name: 'The Curio Cabinet', style: 'shop', interior: 'curio' },
        H: { id: 'bardhouse', name: "Lark's House", style: 'cottage', interior: 'bardhouse' },
        J: { id: 'gildedquill', name: 'The Gilded Quill', style: 'inn', interior: 'gildedquill' },
    },
    aunmarket: {
        M: { id: 'market', name: 'Aubade Market', style: 'shop', interior: 'market' },
        N: { id: 'percival', name: "Sir Percival's", style: 'cottage', interior: 'percival' },
        O: { id: 'tailor2', name: "The Weaver's", style: 'cottage', interior: 'weaver' },
        P: { id: 'scholar', name: 'The Scholar\'s House', style: 'cottage', interior: 'scholar' },
    },
    saltmere: {
        S: { id: 'fishshop', name: 'Fish & Sundries', style: 'shop', interior: 'fishshop' },
        U: { id: 'driftwood', name: 'Driftwood Curios', style: 'shop', interior: 'driftwood' },
        V: { id: 'netmaker', name: "The Netmaker's", style: 'cottage', interior: 'netmaker' },
        Y: { id: 'barnacle', name: 'The Barnacle', style: 'inn', interior: 'barnacle' },
    },
    docks: {
        Z: { id: 'fisherhut', name: "Old Brine's Hut", style: 'hut', interior: 'fisherhut' },
    },
    mousehold: {
        T: { id: 'burrow', name: 'The Great Burrow', style: 'burrow', dungeon: 'burrow' },
    },
    burrowgdn: {},
};

// People in the towns, by zone id: [npc id, x, y] in zone tiles (1..22, 1..14 like the art).
export const TOWN_NPCS = {
    quillford: [['mayorpost', 12, 6], ['kid_tam', 7, 8], ['catbiscuit_home', 9, 9], ['oldben', 14, 10], ['hen_lady', 6, 14]],
    square: [['mayor', 10, 9], ['gardener_poppy', 3, 2], ['busker', 18, 8]],
    castle: [['guard_left', 11, 10], ['guard_right', 14, 10], ['herald', 6, 10]],
    gardens: [['royalgardener', 8, 5], ['princess_wren', 15, 8]],
    auntown: [['townscholar', 7, 7], ['flowerseller', 15, 8], ['nightwatch', 6, 9]],
    aunmarket: [['marketkid', 12, 9], ['juggler', 6, 8], ['cartographer', 18, 10]],
    saltmere: [['harbourmaster', 12, 6], ['fishwife', 5, 10], ['sailor', 17, 10]],
    docks: [['oldbrine', 8, 8], ['fisher2', 14, 10]],
    mousehold: [['mousemayor', 11, 7], ['mousekid', 5, 5], ['mouseguard', 11, 14]],
    burrowgdn: [['thimble', 8, 11], ['mousepoet', 16, 3], ['mousegran', 4, 9]],
};
