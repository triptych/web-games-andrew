/**
 * geography.js — the authored shape of the Frostmarch.
 *
 * Coordinates are metres: x east, z south (north = −z), y up, sea level 0.
 * The terrain generator (terrain.js) turns these features into a height field; the
 * settlement generator lays out towns on the pads defined here.
 */

export const WORLD = {
    SIZE: 3072,
    HALF: 1536,
    N: 1025,          // height samples per side
    CELL: 3,          // metres between samples
    SEED: 0x5eed71,   // the world is authored: one fixed seed
    BORDER: 1490,     // the player cannot walk past |x|,|z| > BORDER
};

// ------------------------------------------------------------------ regions
// Region tints feed the terrain shader; weather and encounters key off the id.
export const REGIONS = {
    coast:     { name: 'Hrimsea Coast',        c: [0, -1350],    grass: [0.52, 0.55, 0.50], soil: [0.30, 0.30, 0.31], snow: 0.75, forest: 0.02, trees: ['dead'],                  weather: { clear: 2, cloudy: 3, snow: 4, fog: 2, blizzard: 1 } },
    wastes:    { name: 'the Whitewastes',      c: [-900, -950],  grass: [0.56, 0.56, 0.47], soil: [0.36, 0.35, 0.33], snow: 0.70, forest: 0.10, trees: ['dead', 'fir'],           weather: { clear: 2, cloudy: 2, snow: 4, blizzard: 2 } },
    greyspine: { name: 'the Greyspine',        c: [-1150, 0],    grass: [0.40, 0.42, 0.24], soil: [0.38, 0.36, 0.33], snow: 0.15, forest: 0.32, trees: ['pine', 'fir'],           weather: { clear: 4, cloudy: 3, rain: 1, snow: 1 } },
    plains:    { name: 'Brightwater Plains',   c: [0, -250],     grass: [0.63, 0.56, 0.29], soil: [0.43, 0.37, 0.27], snow: 0.00, forest: 0.07, trees: ['pine', 'shrub'],         weather: { clear: 6, cloudy: 3, rain: 2 } },
    pinewood:  { name: 'the Southern Pinewoods', c: [-250, 1000], grass: [0.27, 0.40, 0.16], soil: [0.26, 0.21, 0.15], snow: 0.00, forest: 0.82, trees: ['pine', 'fir', 'pine'],  weather: { clear: 4, cloudy: 3, rain: 2, fog: 2 } },
    hrimgard:  { name: 'Mount Hrimgard',       c: [180, 640],    grass: [0.36, 0.42, 0.22], soil: [0.34, 0.32, 0.30], snow: 0.25, forest: 0.45, trees: ['fir', 'pine'],           weather: { clear: 3, cloudy: 3, snow: 3, fog: 1 } },
    ember:     { name: 'the Emberfields',      c: [1050, -100],  grass: [0.55, 0.50, 0.26], soil: [0.23, 0.22, 0.21], snow: 0.00, forest: 0.16, trees: ['birch', 'dead'],         weather: { clear: 5, cloudy: 3, fog: 2 } },
    mirefen:   { name: 'Mirefen',              c: [1000, 1000],  grass: [0.64, 0.36, 0.15], soil: [0.33, 0.22, 0.15], snow: 0.00, forest: 0.62, trees: ['autumn', 'autumn', 'pine'], weather: { clear: 5, cloudy: 3, rain: 2, fog: 2 } },
    icefields: { name: 'the Northeast Icefields', c: [1150, -1000], grass: [0.55, 0.57, 0.55], soil: [0.40, 0.40, 0.42], snow: 0.90, forest: 0.03, trees: ['dead'],             weather: { cloudy: 2, snow: 4, blizzard: 3 } },
    southwood: { name: 'the Kelvik Woods',     c: [600, 1100],   grass: [0.32, 0.43, 0.18], soil: [0.28, 0.22, 0.16], snow: 0.00, forest: 0.70, trees: ['pine', 'birch', 'fir'],  weather: { clear: 4, cloudy: 3, rain: 2 } },
};
export const REGION_IDS = Object.keys(REGIONS);

// ------------------------------------------------------------------ mountains & hills
// kind: 'cone' (peak, concave profile), 'ridge' (line a→b), 'bump' (smooth hill), 'dip' (depression)
export const FEATURES = [
    { kind: 'cone', x: 180, z: 640, r: 600, h: 830, p: 1.45, rough: 0.16, name: 'Mount Hrimgard' },
    { kind: 'cone', x: 85, z: 520, r: 190, h: 120, p: 1.6, rough: 0.2 },     // Highcairn shoulder
    { kind: 'cone', x: -600, z: 720, r: 260, h: 330, p: 1.7, rough: 0.18, name: 'Coldmarrow Peak' },
    { kind: 'cone', x: 1300, z: -1080, r: 420, h: 560, p: 1.8, rough: 0.16, name: 'Vahlokar Peak' },
    { kind: 'cone', x: 900, z: 1350, r: 260, h: 260, p: 1.6, rough: 0.2 },
    { kind: 'cone', x: 560, z: -820, r: 230, h: 170, p: 1.5, rough: 0.25 },
    { kind: 'cone', x: -420, z: -620, r: 210, h: 140, p: 1.5, rough: 0.25 },
    { kind: 'cone', x: 760, z: 380, r: 260, h: 150, p: 1.5, rough: 0.25 },
    { kind: 'ridge', ax: -1350, az: -1050, bx: -1120, bz: -350, r: 260, h: 380, rough: 0.3 },
    { kind: 'ridge', ax: -1120, az: -350, bx: -1250, bz: 500, r: 230, h: 440, rough: 0.3 },
    { kind: 'ridge', ax: -1250, az: 500, bx: -950, bz: 1250, r: 260, h: 360, rough: 0.3 },
    { kind: 'ridge', ax: 1380, az: -500, bx: 1420, bz: 900, r: 200, h: 300, rough: 0.3 },
    { kind: 'bump', x: 40, z: -150, r: 170, h: 34 },                           // Brightwater hill
    { kind: 'bump', x: -380, z: -60, r: 70, h: 16 },                           // Greywatch rise
    { kind: 'bump', x: 150, z: -1240, r: 140, h: 22 },                         // Hrimvik headland
    { kind: 'dip', x: 1130, z: 1120, r: 300, h: 26 },                          // Lake Mirrow basin
    { kind: 'dip', x: -500, z: 1160, r: 200, h: 18 },                          // Lake Ilinalta basin
];

// Coast: the land ends north of this z (with noise); the sea floor drops to −30.
export const COAST = { z: -1250, amp: 70 };

// ------------------------------------------------------------------ water
export const LAKES = [
    { id: 'mirrow', name: 'Lake Mirrow', x: 1130, z: 1120, r: 175 },
    { id: 'ilinalta', name: 'Lake Ilinalta', x: -500, z: 1165, r: 120 },
    { id: 'tarn', name: 'Hrimgard Tarn', x: 420, z: 470, r: 46 },
];

// The Brightrun flows from Lake Ilinalta north through Pinebrook and past Brightwater to the sea.
export const RIVERS = [
    {
        id: 'brightrun', name: 'the Brightrun', width: 9, from: 'ilinalta',
        pts: [[-420, 1140], [-300, 1050], [-175, 975], [-120, 870], [-150, 720], [-200, 560], [-215, 400],
              [-175, 220], [-135, 40], [-150, -160], [-205, -330], [-170, -560], [-100, -800], [-50, -1020],
              [-30, -1180], [-20, -1400]],
    },
];

// ------------------------------------------------------------------ locations
// kind → map icon. flat: radius flattened for building. face: door/entrance facing (radians, 0 = −z/north).
// dungeon: { theme, boss, sigil: id } (a sigil stone in the last chamber) → an interior generated on entry.
export const LOCATIONS = [
    // --- settlements
    { id: 'hollowmere', name: 'Hollowmere Keep', kind: 'fort', x: -250, z: 1255, flat: 70, start: true, region: 'pinewood',
      desc: 'An old border keep of the southern crown. Its stones still smoke.' },
    { id: 'pinebrook', name: 'Pinebrook', kind: 'village', x: -165, z: 935, flat: 85, region: 'pinewood', hold: 'brightwater',
      desc: 'A sawmill village on the Brightrun.' },
    { id: 'brightwater', name: 'Brightwater', kind: 'city', x: 40, z: -120, flat: 0, region: 'plains', hold: 'brightwater',
      desc: 'The trading heart of the Frostmarch, crowned by Wyrmguard Hall.',
      pads: [{ x: 40, z: -95, r: 118, f: 40 }, { x: 40, z: -178, r: 42, f: 26, rel: 11 }] },
    { id: 'hrimvik', name: 'Hrimvik', kind: 'city', x: 150, z: -1215, flat: 95, region: 'coast', hold: 'hrimvik',
      desc: 'A frozen port on the sea cliffs, under the Frostspire.' },
    { id: 'stonecleft', name: 'Stonecleft', kind: 'city', x: -1000, z: -60, flat: 110, lvl: 108, region: 'greyspine', hold: 'stonecleft',
      desc: 'A city of carved stone at the feet of the Greyspine.' },
    { id: 'mirefen', name: 'Mirefen', kind: 'city', x: 935, z: 1010, flat: 100, region: 'mirefen', hold: 'mirefen',
      desc: 'A timber town on Lake Mirrow, all red leaves and secrets.' },
    { id: 'kelvik', name: 'Kelvik', kind: 'village', x: 600, z: 860, flat: 60, region: 'southwood', hold: 'mirefen',
      desc: 'A hamlet at the foot of the Pilgrim\'s Stair.' },
    // --- main quest
    { id: 'undercroft', name: 'Hollowmere Undercroft', kind: 'cave', x: -180, z: 1135, flat: 10, face: Math.PI, region: 'pinewood',
      dungeon: { theme: 'cave', boss: 'cavebear', small: true }, desc: 'The tunnels under the keep.' },
    { id: 'coldmarrow', name: 'Coldmarrow Barrow', kind: 'barrow', x: -578, z: 660, flat: 26, face: 0, region: 'pinewood',
      dungeon: { theme: 'barrow', boss: 'wight_captain', sigil: 'gale', dial: 'star', levels: 2 }, desc: 'An ancient tomb high on Coldmarrow Peak.' },
    { id: 'greywatch', name: 'Greywatch Tower', kind: 'tower', x: -380, z: -60, flat: 22, region: 'plains',
      desc: 'An old beacon tower west of Brightwater.' },
    { id: 'highcairn', name: 'Highcairn', kind: 'temple', x: 70, z: 470, flat: 34, region: 'hrimgard',
      desc: 'The Skywatch observatory, high on Mount Hrimgard.' },
    { id: 'summit', name: 'Hrimgard Summit', kind: 'landmark', x: 180, z: 640, flat: 18, region: 'hrimgard',
      desc: 'The roof of the world, where the Binders chained a wyrm.' },
    { id: 'grimhallow', name: 'Grimhallow Crypt', kind: 'barrow', x: -820, z: -770, flat: 24, face: Math.PI / 2, region: 'wastes',
      dungeon: { theme: 'barrow', boss: 'wight_dreadlord', sigil: 'earthbind', gates: true, levels: 2 }, desc: 'A drowned crypt in the Whitewastes.' },
    { id: 'kalrstead', name: 'Kalrstead Mound', kind: 'mound', x: 480, z: 290, flat: 22, region: 'plains',
      desc: 'An ancient dragon burial mound.' },
    { id: 'deepforge', name: 'Deepforge Hold', kind: 'ruin', x: -1090, z: 40, flat: 22, face: Math.PI / 2, region: 'greyspine',
      dungeon: { theme: 'deepforge', boss: 'steam_colossus', levels: 3 }, desc: 'A machine-city of the vanished deep folk.' },
    { id: 'vahlokar', name: 'Vahlokar Temple', kind: 'temple', x: 1190, z: -960, flat: 40, face: Math.PI, region: 'icefields', hidden: true,
      dungeon: { theme: 'temple', boss: 'hierophant', sigil: 'gale', levels: 2 }, desc: 'The Ember Cult\'s temple in the ice.' },
    // --- dungeons
    { id: 'howlstone', name: 'Howlstone Cave', kind: 'cave', x: -700, z: -450, flat: 12, face: 0, region: 'greyspine', dungeon: { theme: 'cave', boss: 'necromancer' } },
    { id: 'bramblemaw', name: 'Bramblemaw Den', kind: 'cave', x: 300, z: 150, flat: 12, face: Math.PI / 2, region: 'plains', dungeon: { theme: 'cave', boss: 'alpha_wolf' } },
    { id: 'frostvein', name: 'Frostvein Lair', kind: 'barrow', x: -950, z: -650, flat: 18, face: Math.PI, region: 'wastes', dungeon: { theme: 'barrow', boss: 'wight_scourge', sigil: 'rime' } },
    { id: 'cinderdeep', name: 'Cinderdeep Mine', kind: 'mine', x: -40, z: 1060, flat: 14, face: Math.PI, region: 'pinewood', dungeon: { theme: 'mine', boss: 'bandit_chief' } },
    { id: 'stillwater', name: 'Stillwater Diggings', kind: 'mine', x: 250, z: -500, flat: 20, face: 0, region: 'plains', dungeon: { theme: 'mine', boss: 'bandit_chief' } },
    { id: 'saltreave', name: 'Fort Saltreave', kind: 'fort', x: -650, z: 200, flat: 45, face: 0, region: 'greyspine', dungeon: { theme: 'fort', boss: 'bandit_chief' } },
    { id: 'rimeholt', name: 'Rimeholt Barrow', kind: 'barrow', x: 650, z: -800, flat: 18, face: Math.PI, region: 'icefields', dungeon: { theme: 'barrow', boss: 'wight_warden', sigil: 'stride' } },
    { id: 'murkhollow', name: 'Murkhollow Cavern', kind: 'cave', x: 850, z: 460, flat: 14, face: -Math.PI / 2, region: 'ember', dungeon: { theme: 'cave', boss: 'gloomkin_shaman', gloom: true } },
    { id: 'twintolls', name: 'The Twin Tolls', kind: 'tower', x: 560, z: -300, flat: 30, region: 'ember', camp: 'bandits' },
    { id: 'ashmourn', name: 'Ashmourn Barrow', kind: 'barrow', x: 700, z: 1050, flat: 16, face: 0, region: 'southwood', dungeon: { theme: 'barrow', boss: 'necromancer', sigil: 'embers' } },
    { id: 'oakenrest', name: 'Oakenrest Barrow', kind: 'barrow', x: -850, z: 450, flat: 16, face: Math.PI / 2, region: 'greyspine', dungeon: { theme: 'barrow', boss: 'wight_warden', sigil: 'stillness' } },
    { id: 'cleftwater', name: 'Cleftwater Gorge', kind: 'cave', x: 900, z: -450, flat: 14, face: Math.PI, region: 'ember', dungeon: { theme: 'cave', boss: 'frost_troll', sigil: 'veil' } },
    // --- landmarks & camps
    { id: 'totems', name: 'The Three Totems', kind: 'totem', x: -270, z: 1020, flat: 14, region: 'pinewood', totems: ['bear', 'owl', 'fox'] },
    { id: 'elktotem', name: 'The Elk Totem', kind: 'totem', x: -450, z: -900, flat: 8, region: 'wastes', totems: ['elk'] },
    { id: 'raventotem', name: 'The Raven Totem', kind: 'totem', x: 850, z: 800, flat: 8, region: 'southwood', totems: ['raven'] },
    { id: 'oxtotem', name: 'The Ox Totem', kind: 'totem', x: -520, z: -300, flat: 8, region: 'plains', totems: ['ox'] },
    { id: 'gianthearth', name: "Giant's Hearth", kind: 'giant', x: 430, z: -60, flat: 26, region: 'plains', camp: 'giant' },
    { id: 'hotsprings', name: 'Emberfield Springs', kind: 'landmark', x: 1150, z: 160, flat: 20, region: 'ember', camp: 'giant2' },
    { id: 'wreck', name: 'Wreck of the Winter Gull', kind: 'landmark', x: -520, z: -1128, flat: 10, region: 'coast' },
    { id: 'shrine_e', name: 'Windward Spire', kind: 'shrine', x: 1000, z: -620, flat: 10, region: 'ember', sigil: 'stillness' },
    { id: 'shrine_w', name: 'Morn\'s Cairn', kind: 'shrine', x: -760, z: 1050, flat: 10, region: 'pinewood', sigil: 'stride' },
    { id: 'banditcamp', name: 'Thornwatch Camp', kind: 'camp', x: 380, z: 1180, flat: 18, region: 'southwood', camp: 'bandits' },
];
export const LOC = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

// ------------------------------------------------------------------ roads
// 'line' roads follow waypoints with heights smoothed from the terrain; 'spiral' roads wind round a
// peak at a fixed grade, their radius chosen per step so the path stays on the mountainside.
export const ROADS = [
    { id: 'r_hollow_pine', w: 4.5, pts: [[-250, 1210], [-240, 1130], [-205, 1030], [-170, 965]] },
    { id: 'r_pine_bright', w: 5, pts: [[-150, 905], [-205, 820], [-262, 680], [-262, 520], [-225, 330], [-120, 160], [-30, 50], [40, -22]] },
    { id: 'r_bright_hrim', w: 5, pts: [[40, -230], [90, -330], [95, -520], [140, -760], [160, -960], [155, -1150]] },
    { id: 'r_bright_stone', w: 5, pts: [[-75, -95], [-200, -70], [-360, -25], [-560, -40], [-760, -70], [-910, -60]] },
    { id: 'r_bright_ember', w: 5, pts: [[150, -100], [330, -150], [480, -260], [640, -320], [840, -260], [1010, -150]] },
    { id: 'r_ember_mire', w: 4.5, pts: [[1010, -150], [1100, 80], [1120, 330], [1050, 600], [960, 840], [935, 925]] },
    { id: 'r_pine_kelvik', w: 4.5, pts: [[-110, 950], [10, 1080], [200, 1150], [400, 1085], [520, 960], [575, 880]] },
    { id: 'r_kelvik_mire', w: 4.5, pts: [[640, 880], [760, 920], [850, 970], [870, 1000]] },
    { id: 'r_hrim_coast', w: 4, pts: [[100, -1180], [-150, -1150], [-380, -1170], [-495, -1125]] },
    { id: 'r_stone_north', w: 4, pts: [[-1000, -150], [-930, -400], [-850, -650], [-820, -735]] },
    { id: 'steps', w: 3.5, spiral: { cx: 180, cz: 640, from: [585, 830], to: [92, 485], turns: 1.05, dir: -1 }, name: 'The Thousand Steps' },
    { id: 'summitpath', w: 3, spiral: { cx: 180, cz: 640, from: [48, 498], to: [168, 628], turns: 1.8, dir: -1 } },
    { id: 'bleakpath', w: 3.2, spiral: { cx: -600, cz: 720, from: [-250, 880], to: [-556, 668], turns: 0.8, dir: -1 } },
];

// Where roads meet, a signpost names the destinations.
export const SIGNPOSTS = [
    { x: -150, z: 900, to: ['brightwater', 'hollowmere', 'kelvik', 'coldmarrow'] },
    { x: 30, z: -10, to: ['pinebrook', 'brightwater'] },
    { x: -80, z: -98, to: ['stonecleft', 'brightwater'] },
    { x: 160, z: -105, to: ['mirefen', 'brightwater'] },
    { x: 1010, z: -135, to: ['mirefen', 'brightwater'] },
    { x: 560, z: 885, to: ['highcairn', 'mirefen', 'pinebrook'] },
    { x: 60, z: -240, to: ['hrimvik', 'brightwater'] },
];

export function regionWeights(x, z, out = {}) {
    // Soft nearest-region weights; the coast band and altitude are handled by the caller.
    let total = 0;
    for (const id of REGION_IDS) {
        const r = REGIONS[id];
        const d = Math.hypot(x - r.c[0], z - r.c[1]);
        const w = 1 / Math.pow(d + 120, 4);
        out[id] = w;
        total += w;
    }
    for (const id of REGION_IDS) out[id] /= total;
    return out;
}

export function regionAt(x, z) {
    let best = 'plains', bd = Infinity;
    for (const id of REGION_IDS) {
        const r = REGIONS[id];
        const d = Math.hypot(x - r.c[0], z - r.c[1]);
        if (d < bd) { bd = d; best = id; }
    }
    if (z < COAST.z + 60) return 'coast';
    return best;
}
