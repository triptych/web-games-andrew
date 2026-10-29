// The rooms of the Observatory tower, floor by floor, and the centrepieces of
// its five rotundas. Each room is a box (built by tower.js from the size,
// wallpaper and floor given here) and a `build(ctx)` that furnishes it and
// returns { update(dt, t) } for whatever moves. See tower.js for the ctx helpers.

import { buildPrism, buildClocks, buildCabinet } from './rooms-hours.js';
import { buildAlchemy, buildAviary, buildGrotto } from './rooms-wonders.js';
import { buildMaps, buildPortraits } from './rooms-archive.js';
import { buildLibrary } from './tower-library.js';
import { buildOrrery, buildHarp, buildTeaParty } from './rooms-loft.js';
import { buildConstellations, buildComet, buildAurora } from './rooms-dome.js';
import { buildAstrolabe, buildGlassTree, buildBookSwirl, buildPlasma } from './centerpieces.js';
import { buildTelescope } from './telescope.js';

export const ROOM_DEFS = {
    // ---------------------------------------------------------- the Hall of Hours
    prism: {
        title: 'The Prism Conservatory', sub: 'Turn the prism, wake the glass flowers', emoji: '\u{1F308}', accent: '#ffe08a',
        W: 10, D: 9, ceil: 6, wall: ['stars', 0xcfe8de, '#7fc8b0', '#ffffff'], floor: ['checker', 0xf2efe6, 0x5fb8a8, 0.35], ceilColor: 0xe8f4f0, lightColor: 0xfff6e8,
        build: buildPrism,
    },
    clocks: {
        title: 'The Hall of Disagreeing Clocks', sub: 'No two of them agree, until they do', emoji: '\u{1F570}️', accent: '#ffb86a',
        W: 10, D: 8, ceil: 5.5, wall: ['stripes', 0x5a1a2a, '#7a2a3a', '#d9b46a'], floor: 'wood', ceilColor: 0x2a1018, lightColor: 0xffc890,
        build: buildClocks,
    },
    cabinet: {
        title: 'The Cabinet of Curiosities', sub: 'Please do touch the exhibits', emoji: '\u{1F9ED}', accent: '#9fe0c0',
        W: 10, D: 8, ceil: 5.2, wall: ['damask', 0x173a2e, '#3a7a5e', '#d9b46a'], floor: ['parquet', 0x2a1a10, 0x7a4a2a, 0.5], ceilColor: 0x10241c, lightColor: 0xffe0b0,
        build: buildCabinet,
    },
    // ---------------------------------------------------------- the Gallery of Small Wonders
    alchemy: {
        title: 'The Alchemist’s Kitchen', sub: 'Three ingredients make a brew', emoji: '⚗️', accent: '#c58aff',
        W: 10, D: 9, ceil: 5.5, wall: ['scales', 0x3a2a4a, '#6a4a8a', '#c58aff'], floor: ['flag', 0x2a2420, 0x6a5a4a, 0.8], ceilColor: 0x1a1220, lightColor: 0xffb070,
        build: buildAlchemy,
    },
    aviary: {
        title: 'The Origami Aviary', sub: 'Paper cranes, folded and flocking', emoji: '\u{1F54A}️', accent: '#8fd8ff',
        W: 11, D: 10, ceil: 7, wall: ['clouds', 0x9ccbe8, '#ffffff', '#ffffff'], floor: ['herringbone', 0xd8c8a8, 0xc8a878, 0.6], ceilColor: 0xbfe0f4, lightColor: 0xfff4e0,
        build: buildAviary,
    },
    grotto: {
        title: 'The Glowshroom Grotto', sub: 'Every mushroom sings its own note', emoji: '\u{1F344}', accent: '#7affd8',
        W: 10, D: 10, ceil: 5.2, wall: ['plain', 0x1a3a3a, '#2a5a5a', '#2a5a5a'], floor: 'cave', ceilColor: 0x0c1a1a, lightColor: 0x6affd8, noTrim: true,
        build: buildGrotto,
    },
    // ---------------------------------------------------------- the Archive
    maps: {
        title: 'The Cartographer’s Table', sub: 'Maps of places that do not exist yet', emoji: '\u{1F5FA}️', accent: '#f0d090',
        W: 10, D: 8, ceil: 5.2, wall: ['grid', 0xe8d8b0, '#9a7a4a', '#7a4a2a'], floor: ['parquet', 0x2a1a10, 0x8a5a32, 0.5], ceilColor: 0x3a2a1a, lightColor: 0xffd8a0,
        build: buildMaps,
    },
    library: {
        title: 'The Infinite Library', sub: 'The stacks go on. And on.', emoji: '\u{1F4DA}', accent: '#ffcf8a',
        W: 10, D: 9, ceil: 6, wall: ['damask', 0x3a1a14, '#6a3020', '#d9b46a'], floor: ['herringbone', 0x2a1408, 0x6a3a1a, 0.6], ceilColor: 0x1a0c08, lightColor: 0xffc070, backOpen: true,
        build: buildLibrary,
    },
    portraits: {
        title: 'The Gallery of Watchful Portraits', sub: 'They have been expecting you', emoji: '\u{1F5BC}️', accent: '#ff9ac0',
        W: 10, D: 8, ceil: 5.5, wall: ['damask', 0x1a3a4a, '#2a5a6a', '#d9b46a'], floor: ['parquet', 0x2a1a10, 0x6a4020, 0.5], ceilColor: 0x10202a, lightColor: 0xffe0c0,
        build: buildPortraits,
    },
    // ---------------------------------------------------------- the Clockwork Loft
    orrery: {
        title: 'The Grand Orrery', sub: 'Wind the crank and the planets race', emoji: '\u{1FA90}', accent: '#ffd06a',
        W: 11, D: 11, ceil: 7, wall: ['stars', 0x101830, '#d9b46a', '#ffe0a0'], floor: ['checker', 0x101010, 0x8a6a2a, 0.3], ceilColor: 0x0a0e20, lightColor: 0xffd8a0,
        build: buildOrrery,
    },
    harp: {
        title: 'The Harp of Light', sub: 'Walk through the beams to play', emoji: '\u{1F3B6}', accent: '#ff8af0',
        W: 10, D: 9, ceil: 6, wall: ['dots', 0x140c24, '#3a2a6a', '#ff8af0'], floor: ['checker', 0x0a0814, 0x1c1830, 0.15], ceilColor: 0x08060f, lightColor: 0x8a6aff,
        build: buildHarp,
    },
    teaparty: {
        title: 'The Automaton Tea Party', sub: 'Always time for one more cup', emoji: '\u{1FAD6}', accent: '#ffb0c8',
        W: 10, D: 9, ceil: 5.2, wall: ['stripes', 0xf6d8e0, '#bfe8d8', '#e8a0b8'], floor: ['checker', 0xf8f0e8, 0x2a2a3a, 0.4], ceilColor: 0xf0e0e8, lightColor: 0xfff0e0,
        build: buildTeaParty,
    },
    // ---------------------------------------------------------- the Star Dome
    constellations: {
        title: 'The Constellation Chamber', sub: 'Touch the sky and name what you find', emoji: '✨', accent: '#a8c8ff',
        W: 10, D: 10, ceil: 7, wall: ['stars', 0x080a1c, '#2a3060', '#6a7ab0'], floor: ['flag', 0x0a0c18, 0x1a2040, 0.4], ceilColor: 0x02030a, lightColor: 0x6a7aff, noCeil: true, wallH: 3.4,
        build: buildConstellations,
    },
    comet: {
        title: 'The Comet Kennel', sub: 'Home of Pip, a very good comet', emoji: '☄️', accent: '#8affea',
        W: 10, D: 9, ceil: 6, wall: ['dots', 0x2a1a4a, '#c8b8ff', '#8affea'], floor: ['herringbone', 0x1a1030, 0x3a2a5a, 0.6], ceilColor: 0x140c28, lightColor: 0xc8b8ff,
        build: buildComet,
    },
    aurora: {
        title: 'The Aurora Chamber', sub: 'Play the organ, paint the sky', emoji: '\u{1F30C}', accent: '#6affb0',
        W: 10, D: 10, ceil: 7, wall: ['plain', 0x0c1824, '#1a2a3a', '#1a2a3a'], floor: ['flag', 0xdde8f0, 0xb8c8d8, 0.3], ceilColor: 0x02040a, lightColor: 0x8ad8ff, noCeil: true,
        build: buildAurora,
    },
};

export const CENTERPIECES = {
    astrolabe: buildAstrolabe,
    glasstree: buildGlassTree,
    bookswirl: buildBookSwirl,
    plasma: buildPlasma,
    telescope: buildTelescope,
};
