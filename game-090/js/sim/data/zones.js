// The places a Warden can be sent. A zone is a stack of generated floors (the same layout every
// visit; the Hexes and chests are rolled fresh) ending in a boss. `theme` drives both the floor
// generator (rooms, corridors, voids) and the view (palette, props, light).

export const ZONES = {
    underpass: {
        id: 'underpass', name: 'Brightwater Underpass', short: 'Underpass', floors: 3, theme: 'tunnel', lv: [1, 7], boss: 'switchman', bosses: { 2: 'switchman' }, chapter: 0,
        blurb: 'A flooded metro line under the old city. The Hex signal is strongest at the end of the line.',
        pool: [['mossling', 4], ['rustbot', 4], ['scrapfox', 4], ['glowgnat', 3], ['hollowtech', 3], ['thistlehare', 2], ['gearling', 2], ['pipeserpent', 1]],
        size: [26, 22], rooms: [5, 7], chests: 2, foes: [5, 7],
        sky: ['#0a1a1c', '#1a3a38'], fog: '#0c2426', light: '#a8ffe0', accent: '#7affd0',
    },
    galleria: {
        id: 'galleria', name: 'Verdancy Galleria', short: 'Galleria', floors: 3, theme: 'hall', lv: [6, 13], boss: 'motherbloom', bosses: { 2: 'motherbloom' }, chapter: 1,
        blurb: 'A shopping arcade the forest took back. Something in the atrium is growing very fast.',
        pool: [['pollenpuff', 4], ['fernling', 3], ['thistlehare', 3], ['cinderwolf', 3], ['hollowtech', 2], ['courier', 3], ['staticwisp', 2], ['brickgolem', 2], ['embershade', 2]],
        size: [30, 24], rooms: [6, 8], chests: 3, foes: [6, 8],
        sky: ['#1a3a22', '#4a8a4a'], fog: '#1c3a24', light: '#fff2b0', accent: '#a4ff7a',
    },
    orchard: {
        id: 'orchard', name: 'The Server Orchard', short: 'Orchard', floors: 3, theme: 'racks', lv: [12, 20], boss: 'aurelia', bosses: { 2: 'aurelia' }, chapter: 2,
        blurb: 'A data centre where fruit trees grow between the racks. The judge of the Orchard weighs every leaf.',
        pool: [['relayspider', 4], ['cablewyrm', 3], ['cachephantom', 3], ['cherub', 3], ['mossgolem', 3], ['courier', 2], ['fernling', 2], ['gearling', 2], ['boar', 2]],
        size: [32, 26], rooms: [7, 9], chests: 3, foes: [7, 9],
        sky: ['#101a30', '#2a3a6a'], fog: '#0e1a34', light: '#9ad8ff', accent: '#5af0ff',
    },
    cathedral: {
        id: 'cathedral', name: 'Compile Cathedral', short: 'Cathedral', floors: 3, theme: 'nave', lv: [19, 27], boss: 'leviathan', bosses: { 2: 'leviathan' }, chapter: 3,
        blurb: 'Meridian\'s university of magic, half underwater. Its card catalogue has grown teeth.',
        pool: [['shellpriest', 4], ['scribe', 3], ['echo', 3], ['rimewyrm', 2], ['pylon', 3], ['gargoyle', 3], ['emberdrake', 2], ['dewdrop', 2], ['turret', 2]],
        size: [32, 28], rooms: [6, 8], chests: 3, foes: [7, 9],
        sky: ['#14102a', '#3a2a6a'], fog: '#16102e', light: '#c8b0ff', accent: '#b08aff',
    },
    skyrail: {
        id: 'skyrail', name: 'The Skyrail', short: 'Skyrail', floors: 3, theme: 'rail', lv: [26, 34], boss: 'windbreaker', bosses: { 2: 'windbreaker' }, chapter: 4,
        blurb: 'An elevated rail loop in the clouds, strung between wind turbines that never stopped turning.',
        pool: [['stormstag', 3], ['stormcoil', 3], ['mantis', 3], ['lament', 3], ['reactortitan', 2], ['corruptedwarden', 3], ['thornwight', 2], ['turret', 2], ['veilwalker', 2]],
        size: [34, 28], rooms: [7, 9], chests: 3, foes: [8, 10],
        sky: ['#2a4a7a', '#9ad0ff'], fog: '#5a86b0', light: '#ffffff', accent: '#bff0ff',
    },
    spire: {
        id: 'spire', name: 'Meridian Spire', short: 'Spire', floors: 4, theme: 'spire', lv: [33, 42], boss: 'meridian', bosses: { 2: 'pruner', 3: 'meridian' }, chapter: 5,
        blurb: 'The heart of the old network. White floors, magenta light, and a door that opens for you.',
        pool: [['banshee', 3], ['sentinel', 3], ['wardenmk9', 3], ['hexedmarshal', 3], ['veilwalker', 3], ['principality', 2], ['sabertooth', 2], ['matron', 2], ['thornwight', 1]],
        size: [34, 30], rooms: [8, 10], chests: 4, foes: [9, 11],
        sky: ['#1a0a28', '#6a1a6a'], fog: '#1c0a2c', light: '#ffd0f8', accent: '#ff4ad8',
    },
    rift: {
        id: 'rift', name: 'Hex Rift', short: 'Rift', floors: 3, theme: 'rift', lv: [1, 60], boss: null, chapter: 6, repeat: true,
        blurb: 'A tear in the lattice where the Hex pours through. Depth and danger scale with your level.',
        pool: [], size: [28, 24], rooms: [6, 8], chests: 3, foes: [6, 8],
        sky: ['#1a0a1a', '#4a1a4a'], fog: '#180a1c', light: '#ffc8f0', accent: '#ff7ae0',
    },
};
/** The boss waiting on a floor of a zone, or null. */
export function bossAt(zoneId, idx) {
    const Z = ZONES[zoneId];
    return (Z.bosses && Z.bosses[idx]) || null;
}
export const STORY_ZONES = ['underpass', 'galleria', 'orchard', 'cathedral', 'skyrail', 'spire'];

/** Rift pools are drawn from every wild daemon near the Agent's level. */
export const RIFT_WINDOW = 7;
