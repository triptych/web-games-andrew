// The places. Each map is a grid of ground characters built from a few paint operations, plus props
// (painted objects that block their footprint), people, exits and events. dev/simtest.mjs proves every
// exit, person and event can be walked to from where the player arrives.
//
// Ground:  .  grass   ,  meadow   :  cobbles   =  dirt path   p  planks   m  gully mud   i  iron plate
// Solid:   ~  water   #  rock / iron wall   T  tree (the map's kind)   V  void
//
// A prop: { k (art id), x, y, w, h, solid (default true), door (column of its bottom row that is walkable),
//           counter (people behind it can be talked to across it), cond (only while a condition holds) }
// An exit: { x, y, to, tx, ty, cond, msg }        a person: { who, x, y, talk (tree id), cond }
// An event: { id, x, y, type, cond, ... }  types: scene (a dialogue tree), chest, fight

import { makeRng, next } from '../../rng.js';

const SOLID = new Set(['~', '#', 'T', 'V']);
export const isSolidGround = (c) => SOLID.has(c);

/** Paint a grid: ops are [op, ...args]. rect x y w h ch · set x y ch · border ch · scatter seed density ch from · clear x y w h ch */
function build(w, h, fill, ops) {
    const g = Array.from({ length: h }, () => Array(w).fill(fill));
    for (const [op, ...a] of ops) {
        if (op === 'rect') { const [x, y, rw, rh, ch] = a; for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (g[j]?.[i] !== undefined) g[j][i] = ch; }
        else if (op === 'set') g[a[1]][a[0]] = a[2];
        else if (op === 'border') { for (let i = 0; i < w; i++) { g[0][i] = a[0]; g[h - 1][i] = a[0]; } for (let j = 0; j < h; j++) { g[j][0] = a[0]; g[j][w - 1] = a[0]; } }
        else if (op === 'scatter') {
            const [seed, density, ch, from] = a;
            const r = makeRng(seed);
            for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) if (g[j][i] === from && next(r) < density) g[j][i] = ch;
        }
        else if (op === 'clear') { const [x, y, rw, rh, ch] = a; for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (g[j]?.[i] === 'T') g[j][i] = ch; }
    }
    return g.map((row) => row.join(''));
}

export const MAPS = {
    lane: {
        name: 'Coppergate Lane', bg: 'lane', music: 'lane', ground: '.', tree: 'tree_oak',
        grid: build(26, 18, '.', [
            ['border', 'T'],
            ['rect', 1, 6, 24, 1, '='], ['rect', 12, 1, 2, 16, '='], ['rect', 10, 7, 6, 5, ':'],
            ['rect', 8, 7, 1, 7, '='], ['rect', 5, 13, 4, 1, '='], ['rect', 19, 7, 1, 6, '='], ['rect', 19, 12, 4, 1, '='],
            ['rect', 12, 17, 2, 1, '='],
            ['set', 1, 1, 'T'], ['set', 24, 1, 'T'], ['set', 1, 15, 'T'], ['set', 24, 15, 'T'], ['set', 2, 16, 'T'], ['set', 23, 16, 'T'],
        ]),
        props: [
            { k: 'workshop', x: 2, y: 2, w: 5, h: 4, door: 3 },
            { k: 'bakery', x: 20, y: 2, w: 5, h: 4, door: 2 },
            { k: 'hall', x: 2, y: 9, w: 6, h: 4, door: 3 },
            { k: 'stall', x: 20, y: 9, w: 5, h: 3 },
            { k: 'well', x: 11, y: 9, w: 1, h: 1 },
            { k: 'lamp', x: 10, y: 7, w: 1, h: 1 }, { k: 'lamp', x: 15, y: 7, w: 1, h: 1 }, { k: 'lamp', x: 15, y: 11, w: 1, h: 1 },
            { k: 'barrel', x: 7, y: 2, w: 1, h: 1 }, { k: 'crates', x: 19, y: 2, w: 1, h: 1 },
            { k: 'crates', x: 18, y: 10, w: 1, h: 1 }, { k: 'barrel', x: 18, y: 11, w: 1, h: 1 },
            { k: 'signpost', x: 11, y: 15, w: 1, h: 1 },
            { k: 'scrap_heap', x: 8, y: 3, w: 1, h: 1 },
            { k: 'flowers', x: 9, y: 2, w: 1, h: 1, solid: false }, { k: 'flowers', x: 16, y: 3, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 8, y: 15, w: 1, h: 1, solid: false }, { k: 'flowers', x: 16, y: 14, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 17, y: 8, w: 1, h: 1, solid: false }, { k: 'bush', x: 17, y: 14, w: 1, h: 1 }, { k: 'bush', x: 9, y: 14, w: 1, h: 1 },
            { k: 'bush', x: 15, y: 2, w: 1, h: 1 }, { k: 'stump', x: 4, y: 15, w: 1, h: 1 }, { k: 'stump', x: 21, y: 14, w: 1, h: 1 },
        ],
        people: [
            { who: 'trina', x: 4, y: 6, talk: 'trina', cond: '!party:trina' },
            { who: 'mabel', x: 22, y: 6, talk: 'mabel', cond: '!party:mabel' },
            { who: 'pilcrow', x: 5, y: 13, talk: 'pilcrow' },
            { who: 'bertram', x: 22, y: 12, talk: 'bertram' },
        ],
        exits: [
            { x: 12, y: 17, to: 'wilds', tx: 12, ty: 1 },
            { x: 13, y: 17, to: 'wilds', tx: 13, ty: 1 },
        ],
        events: [],
    },

    wilds: {
        name: 'Whistling Wilds', bg: 'wilds', music: 'wilds', ground: ',', tree: 'tree_pine',
        encounters: { rate: 0.14, table: {
            1: { cogs2: 4, cogs3: 2, crab: 3, crab_cog: 3, bandit: 1 },
            2: { cogs2: 3, cogs3: 2, crab: 3, crab_cog: 3, crabs: 1, bandit: 2, bandit_cog: 1 },
        } },
        grid: build(28, 22, ',', [
            ['scatter', 41, 0.16, 'T', ','],
            ['border', 'T'],
            ['rect', 12, 0, 2, 22, '='], ['rect', 12, 9, 12, 1, '='], ['rect', 4, 16, 10, 1, '='],
            ['rect', 4, 8, 5, 4, '~'], ['rect', 22, 13, 4, 4, '~'],
            ['clear', 11, 1, 4, 20, ','], ['clear', 12, 8, 12, 5, ','], ['clear', 3, 15, 11, 3, ','], ['clear', 3, 7, 7, 6, ','],
            ['clear', 20, 3, 6, 5, ','], ['clear', 18, 12, 8, 7, ','],
            ['rect', 22, 4, 1, 5, '='], ['rect', 22, 3, 3, 1, '='],
        ]),
        props: [
            { k: 'signpost', x: 14, y: 2, w: 1, h: 1 },
            { k: 'rock', x: 10, y: 6, w: 1, h: 1 }, { k: 'rock', x: 16, y: 13, w: 1, h: 1 }, { k: 'rock', x: 9, y: 17, w: 1, h: 1 },
            { k: 'mushrooms', x: 7, y: 5, w: 1, h: 1, solid: false }, { k: 'mushrooms', x: 18, y: 6, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 15, y: 5, w: 1, h: 1, solid: false }, { k: 'flowers', x: 6, y: 13, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 20, y: 11, w: 1, h: 1, solid: false }, { k: 'fern', x: 10, y: 12, w: 1, h: 1, solid: false },
            { k: 'fern', x: 17, y: 16, w: 1, h: 1, solid: false }, { k: 'stump', x: 15, y: 18, w: 1, h: 1 }, { k: 'bush', x: 11, y: 14, w: 1, h: 1 },
            { k: 'scrap_heap', x: 20, y: 17, w: 1, h: 1 },
        ],
        people: [],
        exits: [
            { x: 12, y: 0, to: 'lane', tx: 12, ty: 16 }, { x: 13, y: 0, to: 'lane', tx: 13, ty: 16 },
            { x: 12, y: 21, to: 'gully', tx: 12, ty: 1 }, { x: 13, y: 21, to: 'gully', tx: 13, ty: 1 },
        ],
        events: [
            { id: 'wl_hello', type: 'scene', x: 12, y: 2, tree: 'wilds_hello', once: true },
            { id: 'wl_chest', type: 'chest', x: 24, y: 3, items: { oilcan: 2, tea: 1 }, gold: 25 },
            { id: 'wl_bandits', type: 'fight', x: 19, y: 15, group: 'bandits', who: 'bandit', tree: 'bandit_ambush' },
            { id: 'wl_chest2', type: 'chest', x: 5, y: 17, items: { spring: 1, cog: 2 } },
        ],
    },

    gully: {
        name: 'Gutter Gully', bg: 'gully', music: 'gully', ground: 'm', tree: 'tree_dead',
        encounters: { rate: 0.16, table: {
            1: { wolf: 3, wolf_crab: 2, wolves: 1, crab: 2, bandit: 1, wolf_bandit: 1 },
            2: { wolf: 3, wolf_crab: 2, wolves: 2, crabs: 1, bandit_cog: 1, wolf_bandit: 2 },
        } },
        grid: build(28, 22, 'm', [
            ['scatter', 53, 0.1, 'T', 'm'],
            ['border', 'T'],
            ['rect', 12, 0, 2, 18, '='], ['rect', 6, 12, 8, 1, '='], ['rect', 12, 17, 14, 1, '='], ['rect', 14, 6, 8, 1, '='],
            ['rect', 4, 5, 6, 1, '~'], ['rect', 6, 6, 2, 5, '~'], ['rect', 17, 18, 5, 3, '~'],
            ['clear', 11, 1, 4, 17, 'm'], ['clear', 5, 11, 9, 3, 'm'], ['clear', 14, 3, 12, 6, 'm'], ['clear', 11, 14, 16, 4, 'm'],
            ['rect', 2, 12, 4, 5, '#'], ['rect', 3, 13, 2, 3, 'm'], ['set', 5, 14, 'm'],
            ['rect', 23, 13, 5, 4, '#'], ['set', 25, 16, 'm'],
        ]),
        props: [
            { k: 'lair_gate', x: 24, y: 14, w: 3, h: 3, door: 1 },
            { k: 'pipes', x: 8, y: 2, w: 2, h: 1 }, { k: 'pipes', x: 17, y: 8, w: 2, h: 1 },
            { k: 'gear_big', x: 20, y: 4, w: 1, h: 1 }, { k: 'gear_big', x: 9, y: 17, w: 1, h: 1 },
            { k: 'scrap_heap', x: 16, y: 3, w: 1, h: 1 }, { k: 'scrap_heap', x: 15, y: 15, w: 1, h: 1 }, { k: 'scrap_heap', x: 7, y: 14, w: 1, h: 1 },
            { k: 'barrel', x: 22, y: 9, w: 1, h: 1 }, { k: 'crates', x: 21, y: 9, w: 1, h: 1 },
            { k: 'rock', x: 10, y: 8, w: 1, h: 1 }, { k: 'rock', x: 19, y: 14, w: 1, h: 1 }, { k: 'mushrooms', x: 14, y: 6, w: 1, h: 1, solid: false },
            { k: 'signpost', x: 14, y: 11, w: 1, h: 1 },
        ],
        people: [],
        exits: [
            { x: 12, y: 0, to: 'wilds', tx: 12, ty: 20 }, { x: 13, y: 0, to: 'wilds', tx: 13, ty: 20 },
            { x: 25, y: 16, to: 'lair', tx: 8, ty: 10, cond: 'has:lairkey', msg: 'The iron door is locked tight. The Mayor might have a key for it.' },
        ],
        events: [
            { id: 'gl_hello', type: 'scene', x: 12, y: 2, tree: 'gully_hello', once: true },
            { id: 'gl_crab', type: 'fight', x: 5, y: 14, group: 'kettle_crab', who: 'rustcrab', tree: 'kettle_crab' },
            { id: 'gl_kettle', type: 'chest', x: 3, y: 14, items: { kettle: 1 }, art: 'kettle', tree: 'kettle_found' },
            { id: 'gl_chest', type: 'chest', x: 22, y: 6, items: { scone: 2, tonic: 1 }, gold: 30 },
        ],
    },

    lair: {
        name: 'Bertha\'s Lair', bg: 'lair', music: 'gully', ground: 'i', interior: true,
        grid: build(17, 13, 'i', [
            ['border', '#'], ['rect', 8, 12, 1, 1, 'i'],
        ]),
        props: [
            { k: 'pipes', x: 2, y: 1, w: 2, h: 1 }, { k: 'pipes', x: 13, y: 1, w: 2, h: 1 },
            { k: 'gear_big', x: 1, y: 4, w: 1, h: 1 }, { k: 'gear_big', x: 15, y: 4, w: 1, h: 1 },
            { k: 'scrap_heap', x: 3, y: 8, w: 1, h: 1 }, { k: 'scrap_heap', x: 13, y: 8, w: 1, h: 1 },
            { k: 'crates', x: 2, y: 6, w: 1, h: 1 }, { k: 'barrel', x: 14, y: 6, w: 1, h: 1 },
        ],
        people: [],
        exits: [{ x: 8, y: 12, to: 'gully', tx: 25, ty: 18 }],
        events: [
            { id: 'lr_bertha', type: 'fight', x: 8, y: 3, group: 'bertha', who: 'bigbertha', boss: true, tree: 'bertha_meet', win: 'bertha_win', final: true },
        ],
    },
};
