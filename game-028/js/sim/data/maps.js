// The places. Each map is a grid of ground characters built from a few paint operations, plus props
// (painted objects that block their footprint), people, exits and events. dev/simtest.mjs proves every
// exit, person and event can be walked to from where the player arrives.
//
// Ground:  .  grass     ,  forest floor   :  cobbles   =  dirt path   p  planks   r  ruins floor
// Solid:   ~  water     #  stone wall     T  tree (the map's kind)     V  void
//
// A prop: { k (art id), x, y, w, h, solid (default true), door (column of its bottom row that is walkable),
//           counter (people behind it can be talked to across it), cond (only while a condition holds) }
// An exit: { x, y, to, tx, ty, cond, msg }        a person: { who, x, y, talk (tree id), cond }
// An event: { id, x, y, type, cond, ... }  types: scene (a dialogue tree), chest, anchor, fight, seal

import { makeRng, next } from '../../rng.js';

const SOLID = new Set(['~', '#', 'T', 'V']);
export const isSolidGround = (c) => SOLID.has(c);

/** Paint a grid: ops are [op, ...args]. rect x y w h ch · set x y ch · border ch · scatter seed density ch keepOut */
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
    thornhaven: {
        name: 'Thornhaven', bg: 'thornhaven', music: 'village', ground: '.', tree: 'tree_oak',
        grid: build(20, 15, '.', [
            ['border', 'T'],
            ['rect', 1, 5, 18, 1, '='], ['rect', 8, 6, 5, 4, ':'], ['rect', 10, 10, 1, 5, '='], ['rect', 3, 6, 1, 4, '='],
            ['rect', 16, 6, 1, 2, '='], ['rect', 6, 11, 3, 2, '~'],
            ['set', 1, 1, 'T'], ['set', 18, 13, 'T'], ['set', 1, 13, 'T'],
        ]),
        props: [
            { k: 'elder_house', x: 1, y: 1, w: 4, h: 3 },
            { k: 'inn_house', x: 14, y: 1, w: 5, h: 4, door: 2 },
            { k: 'forge_house', x: 1, y: 8, w: 4, h: 3, door: 2 },
            { k: 'farmhouse', x: 14, y: 8, w: 5, h: 3 },
            { k: 'crates', x: 12, y: 3, w: 1, h: 1 }, { k: 'barrel', x: 13, y: 3, w: 1, h: 1 },
            { k: 'flowers', x: 6, y: 2, w: 1, h: 1, solid: false }, { k: 'flowers', x: 11, y: 1, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 5, y: 9, w: 1, h: 1, solid: false }, { k: 'bush', x: 9, y: 12, w: 1, h: 1 },
            { k: 'crates', x: 6, y: 7, w: 1, h: 1, cond: 'ch>=2' },
            { k: 'flowers', x: 12, y: 12, w: 1, h: 1, solid: false }, { k: 'stump', x: 15, y: 12, w: 1, h: 1 },
        ],
        people: [
            { who: 'varec', x: 3, y: 4, talk: 'varec' },
            { who: 'holt', x: 13, y: 10, talk: 'holt' },
            { who: 'orin', x: 11, y: 7, talk: 'orin', cond: 'ch>=2&!party:orin' },
            { who: 'borin', x: 7, y: 7, talk: 'borin_shop', cond: 'f:borin_found' },
        ],
        exits: [
            { x: 10, y: 14, to: 'thornwood', tx: 11, ty: 1 },
            { x: 16, y: 4, to: 'inn', tx: 4, ty: 5 },
            { x: 3, y: 10, to: 'forge', tx: 4, ty: 5 },
        ],
        events: [],
    },

    inn: {
        name: 'Ember Hearth Inn', bg: 'inn', music: 'village', ground: 'p', interior: true,
        grid: build(9, 7, 'p', [['border', '#'], ['set', 4, 6, 'p']]),
        props: [
            { k: 'hearth', x: 1, y: 1, w: 2, h: 1 }, { k: 'barrel', x: 7, y: 1, w: 1, h: 1 },
            { k: 'counter', x: 3, y: 2, w: 3, h: 1, counter: true },
            { k: 'table', x: 6, y: 4, w: 2, h: 1 }, { k: 'table', x: 1, y: 4, w: 2, h: 1 },
        ],
        people: [{ who: 'aldric', x: 4, y: 1, talk: 'aldric' }],
        exits: [{ x: 4, y: 6, to: 'thornhaven', tx: 16, ty: 5 }],
        events: [],
    },

    forge: {
        name: 'Marta\'s Forge', bg: 'forge', music: 'village', ground: 'p', interior: true,
        grid: build(9, 7, 'p', [['border', '#'], ['set', 4, 6, 'p']]),
        props: [
            { k: 'furnace', x: 1, y: 1, w: 2, h: 1 }, { k: 'weapon_rack', x: 6, y: 1, w: 2, h: 1 },
            { k: 'anvil', x: 3, y: 2, w: 1, h: 1, counter: true }, { k: 'barrel', x: 7, y: 4, w: 1, h: 1 }, { k: 'crates', x: 1, y: 4, w: 1, h: 1 },
        ],
        people: [{ who: 'marta', x: 3, y: 1, talk: 'marta' }],
        exits: [{ x: 4, y: 6, to: 'thornhaven', tx: 3, ty: 11 }],
        events: [],
    },

    thornwood: {
        name: 'The Thornwood', bg: 'thornwood', music: 'forest', ground: ',', tree: 'tree_pine',
        grid: build(24, 20, ',', [
            ['scatter', 28, 0.2, 'T', ','],
            ['border', 'T'],
            ['rect', 11, 0, 1, 20, '='], ['rect', 1, 6, 11, 1, '='], ['rect', 11, 10, 13, 1, '='], ['rect', 11, 15, 6, 1, '='],
            ['clear', 10, 1, 3, 18, ','], ['clear', 1, 5, 11, 3, ','], ['clear', 11, 9, 12, 3, ','], ['clear', 11, 14, 6, 3, ','],
            // the bandit camp: a clearing walled by trees, one way in from the west
            ['rect', 16, 12, 7, 1, 'T'], ['rect', 16, 18, 7, 1, 'T'], ['rect', 22, 12, 1, 7, 'T'], ['rect', 16, 12, 1, 7, 'T'],
            ['rect', 17, 13, 5, 5, ','], ['set', 16, 15, '='], ['rect', 17, 15, 3, 1, '='],
            ['rect', 2, 15, 3, 3, ','], ['rect', 4, 14, 1, 1, ','], ['rect', 5, 13, 6, 1, ','],
            ['set', 0, 6, '='], ['set', 23, 10, '='],
        ]),
        props: [
            { k: 'crates', x: 20, y: 13, w: 1, h: 1 }, { k: 'barrel', x: 21, y: 13, w: 1, h: 1 },
            { k: 'mushrooms', x: 13, y: 4, w: 1, h: 1, solid: false }, { k: 'mushrooms', x: 7, y: 9, w: 1, h: 1, solid: false },
            { k: 'tree_dead', x: 13, y: 12, w: 1, h: 1 }, { k: 'rock', x: 9, y: 16, w: 1, h: 1 }, { k: 'stump', x: 14, y: 7, w: 1, h: 1 },
        ],
        people: [
            { who: 'borin', x: 20, y: 16, talk: 'borin', cond: '!f:borin_found' },
            { who: 'sera', x: 5, y: 7, talk: 'sera', cond: 'ch>=2&!party:sera' },
        ],
        exits: [
            { x: 11, y: 0, to: 'thornhaven', tx: 10, ty: 13 },
            { x: 0, y: 6, to: 'academy', tx: 7, ty: 12 },
            { x: 23, y: 10, to: 'grove', tx: 1, ty: 7, cond: 'ch>=2', msg: 'Thorns thick with violet corruption choke the eastern path. (Opens in Chapter 2.)' },
            { x: 11, y: 19, to: 'ruins', tx: 11, ty: 1, cond: 'ch>=3', msg: 'A cold wind blows up the southern path from the Aethermoor ruins. You are not ready for what waits there yet. (Opens in Chapter 3.)' },
        ],
        events: [
            { id: 'tw_scorch', x: 11, y: 12, type: 'scene', tree: 'lore_scorch', once: true },
            { id: 'tw_ambush', x: 16, y: 15, type: 'fight', group: 'ambush', cond: 'q:the_missing_merchant&!f:borin_found', once: true, tree: 'ambush', who: 'bandit' },
            { id: 'tw_chest', x: 3, y: 16, type: 'chest', items: { potion: 2, antidote: 1 }, once: true },
        ],
        encounters: { rate: 0.08, table: {
            1: { slimes1: 3, slimes2: 2, wolf1: 2, slime_wolf: 1 },
            2: { slimes2: 1, wolf1: 1, wolves2: 2, bandit1: 2, wolf_bandit: 1, shard1: 3, shard_wolf: 1 },
            3: { slimes2: 1, wolves2: 1, bandits2: 2, shard1: 2, shard_wolf: 2 },
        } },
    },

    academy: {
        name: 'Academy Ruins', bg: 'academy', music: 'ruins', ground: 'r',
        grid: build(16, 14, 'r', [
            ['border', 'V'], ['rect', 0, 0, 16, 1, 'V'],
            ['rect', 2, 2, 4, 1, '#'], ['rect', 10, 2, 4, 1, '#'], ['rect', 2, 3, 1, 3, '#'], ['rect', 13, 3, 1, 3, '#'],
            ['rect', 5, 8, 6, 1, '#'], ['set', 7, 8, 'r'], ['set', 8, 8, 'r'],
            ['rect', 1, 10, 3, 1, '#'], ['rect', 12, 10, 3, 1, '#'],
            ['set', 7, 13, 'r'],
        ]),
        props: [
            { k: 'lectern', x: 7, y: 2, w: 1, h: 1 },
            { k: 'pillar', x: 4, y: 5, w: 1, h: 1 }, { k: 'pillar', x: 11, y: 5, w: 1, h: 1 },
            { k: 'bookshelf', x: 6, y: 1, w: 1, h: 1 }, { k: 'bookshelf', x: 9, y: 1, w: 1, h: 1 },
            { k: 'statue', x: 2, y: 7, w: 1, h: 1 }, { k: 'rubble', x: 13, y: 7, w: 1, h: 1 }, { k: 'brazier', x: 4, y: 11, w: 1, h: 1 }, { k: 'brazier', x: 11, y: 11, w: 1, h: 1 },
        ],
        people: [],
        exits: [{ x: 7, y: 13, to: 'thornwood', tx: 1, ty: 6 }],
        events: [
            { id: 'ac_enter', x: 7, y: 11, type: 'scene', tree: 'academy_enter', once: true },
            { id: 'ac_lectern', x: 7, y: 3, type: 'scene', tree: 'academy_lectern', cond: 'q:lyras_past', once: true },
            { id: 'ac_scroll', x: 3, y: 3, type: 'chest', items: { elder_scroll: 1 }, tree: 'academy_scroll', once: true },
            { id: 'ac_tome', x: 14, y: 3, type: 'chest', items: { warlock_tome: 1 }, once: true },
            { id: 'ac_chest', x: 1, y: 11, type: 'chest', items: { ether: 1, potion: 1 }, once: true },
        ],
        encounters: { rate: 0.08, table: { 1: { wisp1: 3, wisps2: 2, wisp_slime: 2 }, 2: { wisps2: 2, wisps3: 2, wisp_slime: 1 } } },
    },

    grove: {
        name: 'World Tree Grove', bg: 'grove', music: 'grove', ground: '.', tree: 'tree_glow',
        grid: build(17, 15, '.', [
            ['scatter', 7, 0.1, 'T', '.'],
            ['border', 'T'],
            ['rect', 1, 7, 15, 1, '='], ['rect', 8, 7, 1, 8, '='], ['clear', 1, 6, 15, 3, '.'], ['clear', 7, 8, 3, 6, '.'],
            ['clear', 2, 3, 3, 3, '.'], ['clear', 12, 3, 3, 3, '.'], ['clear', 6, 4, 5, 2, '.'], ['clear', 3, 10, 11, 3, '.'],
            ['set', 0, 7, '='], ['set', 8, 14, '='],
        ]),
        props: [
            { k: 'world_tree', x: 6, y: 1, w: 5, h: 3 },
            { k: 'flowers', x: 5, y: 9, w: 1, h: 1, solid: false }, { k: 'flowers', x: 11, y: 9, w: 1, h: 1, solid: false },
            { k: 'flowers', x: 7, y: 5, w: 1, h: 1, solid: false }, { k: 'flowers', x: 9, y: 5, w: 1, h: 1, solid: false },
            { k: 'anchor', x: 3, y: 4, w: 1, h: 1, solid: false, cond: '!f:anchor_1' },
            { k: 'anchor', x: 13, y: 4, w: 1, h: 1, solid: false, cond: '!f:anchor_2' },
            { k: 'anchor', x: 12, y: 11, w: 1, h: 1, solid: false, cond: '!f:anchor_3' },
            { k: 'tree_glow', x: 3, y: 4, w: 1, h: 1, solid: false, cond: 'f:anchor_1', small: true },
            { k: 'tree_glow', x: 13, y: 4, w: 1, h: 1, solid: false, cond: 'f:anchor_2', small: true },
            { k: 'tree_glow', x: 12, y: 11, w: 1, h: 1, solid: false, cond: 'f:anchor_3', small: true },
        ],
        people: [{ who: 'sylvara', x: 8, y: 4, talk: 'sylvara' }],
        exits: [
            { x: 0, y: 7, to: 'thornwood', tx: 22, ty: 10 },
            { x: 8, y: 14, to: 'chapel', tx: 6, ty: 12, cond: 'q:broken_oath|qd:broken_oath', msg: 'Roots thick with corruption bar the southern path. Sylvara may know a way.' },
        ],
        events: [
            { id: 'gr_enter', x: 2, y: 7, type: 'scene', tree: 'grove_enter', once: true },
            { id: 'gr_a1', x: 3, y: 4, type: 'anchor', flag: 'anchor_1' },
            { id: 'gr_a2', x: 13, y: 4, type: 'anchor', flag: 'anchor_2' },
            { id: 'gr_a3', x: 12, y: 11, type: 'anchor', flag: 'anchor_3' },
            { id: 'gr_chest', x: 3, y: 12, type: 'chest', items: { ether: 1, hi_potion: 1 }, once: true },
        ],
        encounters: { rate: 0.07, table: { 2: { wolf1: 2, wolves2: 2, shard1: 1 }, 3: { wolves2: 2, shard_wolf: 2 } } },
    },

    chapel: {
        name: 'The Shattered Chapel', bg: 'chapel', music: 'ruins', ground: 'r',
        grid: build(13, 14, 'r', [
            ['border', '#'], ['set', 6, 13, 'r'],
            ['rect', 2, 6, 3, 1, '#'], ['rect', 8, 6, 3, 1, '#'],
        ]),
        props: [
            { k: 'altar', x: 6, y: 1, w: 1, h: 1 }, { k: 'brazier', x: 4, y: 1, w: 1, h: 1 }, { k: 'brazier', x: 8, y: 1, w: 1, h: 1 },
            { k: 'pillar', x: 2, y: 3, w: 1, h: 1 }, { k: 'pillar', x: 10, y: 3, w: 1, h: 1 },
            { k: 'pillar', x: 2, y: 9, w: 1, h: 1 }, { k: 'pillar', x: 10, y: 9, w: 1, h: 1 },
            { k: 'statue', x: 1, y: 11, w: 1, h: 1 }, { k: 'rubble', x: 11, y: 11, w: 1, h: 1 },
        ],
        people: [],
        exits: [{ x: 6, y: 13, to: 'grove', tx: 8, ty: 13 }],
        events: [
            { id: 'ch_enter', x: 6, y: 11, type: 'scene', tree: 'chapel_enter', once: true },
            { id: 'ch_guard', x: 6, y: 7, type: 'fight', group: 'chapel_guard', once: true, who: 'corrupted_knight' },
            { id: 'ch_korvas', x: 6, y: 3, type: 'fight', group: 'boss_korvas', once: true, tree: 'korvas_before', win: 'korvas_after', who: 'korvas', boss: true },
            { id: 'ch_chest', x: 11, y: 2, type: 'chest', items: { hi_potion: 1, phoenix_down: 1 }, once: true },
        ],
        encounters: { rate: 0.08, table: { 2: { knight1: 3, knight_wolf: 2, knights2: 1 } } },
    },

    ruins: {
        name: 'Aethermoor Ruins', bg: 'ruins', music: 'ruins', ground: 'r',
        grid: build(22, 20, 'r', [
            ['border', 'V'],
            ['rect', 3, 3, 5, 1, '#'], ['rect', 3, 4, 1, 3, '#'], ['rect', 14, 3, 5, 1, '#'], ['rect', 18, 4, 1, 3, '#'],
            ['rect', 3, 13, 1, 3, '#'], ['rect', 3, 15, 5, 1, '#'], ['rect', 18, 13, 1, 3, '#'], ['rect', 14, 15, 5, 1, '#'],
            ['rect', 9, 16, 1, 3, '#'], ['rect', 13, 16, 1, 3, '#'],
            ['set', 11, 0, 'r'], ['set', 11, 19, 'r'],
        ]),
        props: [
            { k: 'seal_gate', x: 10, y: 17, w: 3, h: 2, solid: false },
            { k: 'crystal', x: 6, y: 9, w: 1, h: 1 }, { k: 'crystal', x: 16, y: 10, w: 1, h: 1 }, { k: 'crystal', x: 2, y: 17, w: 1, h: 1 },
            { k: 'pillar', x: 8, y: 6, w: 1, h: 1 }, { k: 'pillar', x: 14, y: 6, w: 1, h: 1 }, { k: 'pillar', x: 8, y: 12, w: 1, h: 1 }, { k: 'pillar', x: 14, y: 12, w: 1, h: 1 },
            { k: 'rubble', x: 19, y: 8, w: 1, h: 1 }, { k: 'statue', x: 2, y: 8, w: 1, h: 1 }, { k: 'brazier', x: 10, y: 8, w: 1, h: 1 }, { k: 'brazier', x: 12, y: 8, w: 1, h: 1 },
        ],
        people: [
            { who: 'aneth', x: 11, y: 9, talk: 'aneth' },
            { who: 'thane', x: 5, y: 11, talk: 'thane', cond: '!party:thane' },
        ],
        exits: [
            { x: 11, y: 0, to: 'thornwood', tx: 11, ty: 18 },
            { x: 11, y: 19, to: 'sanctum', tx: 6, ty: 14, cond: 'f:seal_broken', msg: 'The great seal holds, humming with cyan light. Scholar Aneth will know how to break it.' },
        ],
        events: [
            { id: 'ru_enter', x: 11, y: 2, type: 'scene', tree: 'ruins_enter', once: true },
            { id: 'ru_gate', x: 11, y: 16, type: 'fight', group: 'gate_golem', cond: 'f:seal_broken', once: true, tree: 'gate_golems', who: 'golem' },
            { id: 'ru_chest', x: 5, y: 5, type: 'chest', items: { phoenix_down: 1 }, gold: 120, once: true },
            { id: 'ru_chest2', x: 16, y: 14, type: 'chest', items: { hi_potion: 2 }, once: true },
        ],
        encounters: { rate: 0.09, table: { 3: { shard1: 2, shard_bandit: 2, shards2: 1, golem1: 2, golem_shard: 1, shard_knight: 1 }, 4: { shards2: 2, golem_shard: 2, shard_knight: 2 } } },
    },

    sanctum: {
        name: 'Aethermoor Sanctum', bg: 'sanctum', music: 'sanctum', ground: 'r',
        grid: build(13, 16, 'r', [
            ['border', 'V'], ['rect', 1, 1, 2, 2, 'V'], ['rect', 10, 1, 2, 2, 'V'], ['rect', 1, 13, 2, 2, 'V'], ['rect', 10, 13, 2, 2, 'V'],
            ['set', 6, 15, 'r'],
        ]),
        props: [
            { k: 'brazier', x: 4, y: 2, w: 1, h: 1 }, { k: 'brazier', x: 8, y: 2, w: 1, h: 1 },
            { k: 'pillar', x: 3, y: 5, w: 1, h: 1 }, { k: 'pillar', x: 9, y: 5, w: 1, h: 1 }, { k: 'pillar', x: 3, y: 9, w: 1, h: 1 }, { k: 'pillar', x: 9, y: 9, w: 1, h: 1 },
            { k: 'crystal', x: 1, y: 7, w: 1, h: 1 }, { k: 'crystal', x: 11, y: 7, w: 1, h: 1 }, { k: 'brazier', x: 4, y: 12, w: 1, h: 1 }, { k: 'brazier', x: 8, y: 12, w: 1, h: 1 },
        ],
        people: [],
        exits: [{ x: 6, y: 15, to: 'ruins', tx: 11, ty: 18 }],
        events: [
            { id: 'sa_enter', x: 6, y: 12, type: 'scene', tree: 'sanctum_enter', once: true },
            { id: 'sa_lich', x: 6, y: 3, type: 'fight', group: 'boss_lich', once: true, tree: 'lich_before', win: 'lich_after', who: 'vaelthas', boss: true, final: true },
        ],
        encounters: { rate: 0.1, table: { 4: { shards2: 2, golem_shard: 2, shard_knight: 2 } } },
    },
};

export const MAP_IDS = Object.keys(MAPS);
