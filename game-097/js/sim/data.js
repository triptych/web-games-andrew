// Hollow Gambit — the tables: elements, movement patterns, units, abilities and chapters.
// Pure data (plus two tiny stat helpers). Numbers live here so the tests and the bot see the same game.

import { BOND, XP } from '../config.js';

// ---------------------------------------------------------------- elements
// Ember burns Thorn, Thorn chokes Tide, Tide douses Ember. Umbra and Lumen answer each other.
export const ELEMENTS = {
    ember: { name: 'Ember', glyph: '🔥', color: 0xff5a2a, css: '#ff7a3a', beats: 'thorn' },
    thorn: { name: 'Thorn', glyph: '🌿', color: 0x6fd05a, css: '#7fe06a', beats: 'tide' },
    tide:  { name: 'Tide',  glyph: '🌊', color: 0x3aa6ff, css: '#4fb4ff', beats: 'ember' },
    umbra: { name: 'Umbra', glyph: '🌘', color: 0xa259ff, css: '#b57cff', beats: 'lumen' },
    lumen: { name: 'Lumen', glyph: '✦', color: 0xffe27a, css: '#ffe27a', beats: 'umbra' },
};

// ---------------------------------------------------------------- movement
// A unit's move is a list of rules. Directions are written for the player's side, which marches
// up the board (dy < 0 is forward); the enemy's dy is flipped.
//   leap   jump to each offset, over anything
//   slide  run along a direction up to r squares, stopped by pieces and terrain
//   ride   leap again and again in the same direction (a nightrider)
//   hop    jump over exactly one piece along a line and land just past it (a grasshopper)
//   cannon capture by jumping over exactly one piece along a line (xiangqi)
//   m      'move' = only onto empty squares, 'cap' = only to capture, otherwise both
//   phase  a slide that passes over walls and chasms (not pieces)
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL8 = [...ORTH, ...DIAG];
const offs = (a, b) => {
    const s = new Map();
    for (const [x, y] of [[a, b], [b, a]]) for (const sx of [1, -1]) for (const sy of [1, -1]) s.set(`${x * sx},${y * sy}`, [x * sx, y * sy]);
    return [...s.values()];
};
const KNIGHT = offs(1, 2), CAMEL = offs(1, 3), ZEBRA = offs(2, 3), ALFIL = offs(2, 2), DABBABA = offs(2, 0);
const L = (d, extra = {}) => ({ k: 'leap', d, ...extra });
const S = (d, r, extra = {}) => ({ k: 'slide', d, r, ...extra });

export const MOVES = {
    pawn:    [L([[0, -1]], { m: 'move' }), L([[-1, -1], [1, -1]], { m: 'cap' }), L([[1, 0], [-1, 0]], { m: 'move' })],
    rook3:   [S(ORTH, 3)],
    rook4:   [S(ORTH, 4)],
    bishop3: [S(DIAG, 3)],
    bishop5: [S(DIAG, 5, { phase: true }), L(ORTH)],
    knight:  [L(KNIGHT)],
    king:    [L(ALL8)],
    wazir:   [L(ORTH), L(DABBABA)],
    alfil:   [L(ALFIL), L(ORTH)],
    rider:   [{ k: 'ride', d: KNIGHT, r: 3 }],
    cannon:  [S(ORTH, 4, { m: 'move' }), { k: 'cannon', d: ORTH, r: 7 }],
    camel:   [L(CAMEL), L(DIAG)],
    hopper:  [{ k: 'hop', d: ALL8, r: 7 }, L(ORTH, { m: 'move' })],
    zebra:   [L(ZEBRA), L(ORTH)],
    queen:   [S(ALL8, 5)],
    champion:[L(ALL8), L(KNIGHT)],
    empress: [S(ORTH, 4), L(KNIGHT)],
    gargoyle:[L(ALFIL), L(ORTH)],
    ghoul:   [L(ALL8)],
    colossus:[S(ORTH, 2)],
    wraith:  [S(DIAG, 3, { phase: true })],
    warden:  [S(ORTH, 4), L(DIAG)],
};

// ---------------------------------------------------------------- abilities
// cd = rounds of rest after use. The rules are in abilities.js.
export const ABILITIES = {
    heal:    { name: 'Sanctuary Prayer', icon: '✚', cd: 3, kind: 'ally',  desc: 'Heal an ally within 3 squares for 45% of their health (at least 8).' },
    smite:   { name: 'Soul Arrow',       icon: '➶', cd: 2, kind: 'enemy', desc: 'A bolt along a line of up to 4 squares. Hits the first piece, never countered.' },
    ward:    { name: 'Aegis Sigil',      icon: '⛨', cd: 3, kind: 'ally',  desc: 'An ally within 2 squares gains +5 defence for 2 rounds.' },
    rally:   { name: 'War Hymn',         icon: '♪', cd: 4, kind: 'self',  desc: 'You and allies within 2 squares gain +4 attack for 2 rounds.' },
    blink:   { name: 'Shadowstep',       icon: '☾', cd: 3, kind: 'tile',  desc: 'Vanish and reappear on any empty square within 3.' },
    hook:    { name: 'Chain Hook',       icon: '⚓', cd: 3, kind: 'enemy', desc: 'Hook the first enemy on a line of up to 4 squares and drag it next to you. 3 damage.' },
    shove:   { name: 'Gravebreaker',     icon: '✊', cd: 2, kind: 'enemy', desc: 'Shove an adjacent enemy 2 squares away. Walls hurt, chasms are fatal.' },
    swap:    { name: 'Mirror Step',      icon: '⇄', cd: 2, kind: 'ally',  desc: 'Trade places with an ally on a line of up to 5 squares.' },
    hex:     { name: 'Withering Hex',    icon: '☠', cd: 3, kind: 'enemy', desc: 'An enemy within 3 squares loses 4 defence and 3 speed for 3 rounds.' },
    flame:   { name: 'Hellfire',         icon: '♨', cd: 4, kind: 'tile',  desc: 'Burn a 3×3 area centred within 3 squares. Only enemies are hurt.' },
    encore:  { name: 'Dance of Dusk',    icon: '❖', cd: 5, kind: 'ally',  desc: 'An ally within 3 squares who has already acted may act again.' },
    drain:   { name: 'Crimson Kiss',     icon: '♥', cd: 3, kind: 'enemy', desc: 'Bite an adjacent enemy through half its defence and heal what you take.' },
    bulwark: { name: 'Iron Vigil',       icon: '▣', cd: 3, kind: 'self',  desc: 'Gain +6 defence for 2 rounds and recover 6 health.' },
};

// ---------------------------------------------------------------- units
// stats are level 1; growth is the percent chance a stat rises at each level (hp rises by 2).
// star 3-5 are in the summoning pool; star 0 are the dead.
const st = (hp, atk, def, spd, skl) => ({ hp, atk, def, spd, skl });
const gr = (hp, atk, def, spd, skl) => ({ hp, atk, def, spd, skl });

export const UNITS = {
    // -------- 3-star
    maren:    { name: 'Maren Ashwick', title: 'Candle Squire', star: 3, el: 'ember', model: 'pawn', move: 'pawn',
                stats: st(18, 7, 2, 5, 6), growth: gr(70, 55, 30, 45, 50), ability: 'smite', abilityName: 'Cinder Bolt', colors: [0x3b2a2a, 0xff8a3a],
                bio: 'A gravedigger\'s apprentice who carries a stub of candle that has never gone out.' },
    gideon:   { name: 'Brother Gideon', title: 'Penitent Rook', star: 3, el: 'ember', model: 'rook', move: 'rook3',
                stats: st(22, 7, 4, 3, 4), growth: gr(80, 50, 45, 25, 35), ability: 'ward', abilityName: 'Penance Sigil', colors: [0x45403f, 0xd96a2a],
                bio: 'He walks straight lines because he promised never to turn from his sins.' },
    ilse:     { name: 'Sister Ilse', title: 'Lantern Bishop', star: 3, el: 'lumen', model: 'bishop', move: 'bishop3',
                stats: st(17, 5, 2, 5, 6), growth: gr(65, 45, 25, 45, 50), ability: 'heal', colors: [0xcfc8b8, 0xffe27a],
                bio: 'Her lantern shows the way out of any dream. She asks nothing in return but quiet.' },
    corwin:   { name: 'Corwin Vale', title: 'Hollow Knight', star: 3, el: 'umbra', model: 'knight', move: 'knight',
                stats: st(20, 7, 3, 6, 5), growth: gr(75, 50, 35, 45, 40), ability: 'shove', colors: [0x2a2838, 0xa259ff],
                bio: 'The armour is full of nothing, and it still holds the line.' },
    bram:     { name: 'Bram the Gaunt', title: 'Grave King', star: 3, el: 'thorn', model: 'king', move: 'king',
                stats: st(28, 6, 6, 2, 3), growth: gr(90, 40, 55, 20, 30), ability: 'bulwark', colors: [0x2f3a2a, 0x8bd070],
                bio: 'King of a crypt with no subjects. He steps one square at a time and nothing moves him.' },
    tilda:    { name: 'Tilda Quill', title: 'Ratcatcher', star: 3, el: 'tide', model: 'wazir', move: 'wazir',
                stats: st(17, 6, 2, 7, 6), growth: gr(60, 45, 20, 55, 50), ability: 'swap', colors: [0x2a3a48, 0x5fc0ff],
                bio: 'She hops the gutter drains two at a time and has never once been where you looked.' },
    osric:    { name: 'Osric Pale', title: 'Crow Herald', star: 3, el: 'thorn', model: 'alfil', move: 'alfil',
                stats: st(18, 6, 2, 6, 6), growth: gr(65, 45, 25, 50, 45), ability: 'hex', abilityName: 'Carrion Curse', colors: [0x232b22, 0x9be07a],
                bio: 'Announces the dead before they know it. Crows land on his shoulders to listen.' },
    // -------- 4-star
    vesna:    { name: 'Vesna Nightbloom', title: 'Moonlit Rider', star: 4, el: 'umbra', model: 'rider', move: 'rider',
                stats: st(22, 9, 3, 8, 7), growth: gr(70, 55, 30, 55, 50), ability: 'blink', colors: [0x1f1a2e, 0xc79bff],
                bio: 'She rides the same crooked road again and again until it leads somewhere new.' },
    ludo:     { name: 'Ludovic Marrow', title: 'Bone Cannoneer', star: 4, el: 'ember', model: 'cannon', move: 'cannon',
                stats: st(21, 10, 2, 4, 6), growth: gr(65, 60, 25, 35, 45), ability: 'flame', colors: [0x4a3f36, 0xff6a2a],
                bio: 'Fires only over the shoulder of something else. He says it is a matter of manners.' },
    seraphine:{ name: 'Seraphine Vael', title: 'Cathedral Dancer', star: 4, el: 'lumen', model: 'dancer', move: 'camel',
                stats: st(20, 7, 3, 7, 8), growth: gr(65, 45, 30, 50, 55), ability: 'encore', colors: [0xe9e2d0, 0xffd45a],
                bio: 'She leaps three arches in one bound. Whoever she dances for dances again.' },
    hob:      { name: 'Hob the Unlit', title: 'Grave Hopper', star: 4, el: 'thorn', model: 'hopper', move: 'hopper',
                stats: st(23, 9, 4, 6, 6), growth: gr(75, 55, 35, 45, 40), ability: 'hook', colors: [0x2c3324, 0x7ed05a],
                bio: 'Springs clean over whatever is in the way, then drags the owner of it back by the collar.' },
    rue:      { name: 'Rue Thornwick', title: 'Briar Witch', star: 4, el: 'tide', model: 'witch', move: 'zebra',
                stats: st(20, 9, 3, 7, 7), growth: gr(65, 55, 25, 50, 50), ability: 'hex', colors: [0x1c3340, 0x58b8ff],
                bio: 'Takes two steps and then three, a path no trap was ever built for.' },
    // -------- 5-star
    morrigan: { name: 'Lady Morrigan', title: 'Blood Queen', star: 5, el: 'umbra', model: 'queen', move: 'queen',
                stats: st(28, 12, 5, 8, 9), growth: gr(75, 60, 40, 55, 55), ability: 'drain', colors: [0x2b1018, 0xd23a5a],
                bio: 'Queen of a kingdom that was reduced to one table and a very long hall.' },
    aurelian: { name: 'Aurelian Dawn', title: 'Sun-Sworn Champion', star: 5, el: 'lumen', model: 'champion', move: 'champion',
                stats: st(32, 12, 7, 6, 8), growth: gr(85, 55, 50, 40, 45), ability: 'rally', abilityName: 'Hymn of Dawn', colors: [0xd8d0bc, 0xffcc3a],
                bio: 'He strides and he vaults, and the night steps back a pace with every verse.' },
    kharon:   { name: 'Kharon', title: 'Drowned Archbishop', star: 5, el: 'tide', model: 'archbishop', move: 'bishop5',
                stats: st(26, 11, 4, 7, 8), growth: gr(70, 58, 35, 50, 50), ability: 'smite', abilityName: 'Tollbell', colors: [0x16303a, 0x6fe0ff],
                bio: 'Ferries the dead across the flooded nave. Walls and chasms are only suggestions to him.' },
    ysolde:   { name: 'Ysolde of the Deep', title: 'Tidecaller', star: 5, el: 'tide', model: 'empress', move: 'empress',
                stats: st(30, 12, 5, 7, 7), growth: gr(80, 58, 40, 45, 45), ability: 'ward', abilityName: 'Tidal Ward', colors: [0x12293a, 0x3aa6ff],
                bio: 'Part tower, part wave. She charges like a rook and lands like a knight.' },

    // -------- the dead (never summoned)
    thrall:   { name: 'Bone Thrall', title: 'Risen Pawn', star: 0, el: 'umbra', model: 'pawn', move: 'pawn',
                stats: st(13, 5, 1, 3, 3), growth: gr(60, 40, 25, 25, 25), ability: null, colors: [0x6a6558, 0x8a1e1e] },
    ghoul:    { name: 'Grave Ghoul', title: 'Hungry Dead', star: 0, el: 'thorn', model: 'king', move: 'ghoul',
                stats: st(20, 6, 3, 3, 3), growth: gr(70, 40, 35, 25, 25), ability: null, colors: [0x4a5a3a, 0x8a1e1e] },
    hound:    { name: 'Crypt Hound', title: 'Bone Dog', star: 0, el: 'ember', model: 'knight', move: 'knight',
                stats: st(15, 6, 1, 7, 4), growth: gr(60, 45, 20, 50, 35), ability: null, colors: [0x5a4a40, 0xff5a2a] },
    wraith:   { name: 'Wraith', title: 'Faceless', star: 0, el: 'umbra', model: 'wraith', move: 'wraith',
                stats: st(14, 7, 1, 6, 5), growth: gr(55, 50, 15, 45, 40), ability: null, colors: [0x28243a, 0xa259ff] },
    cultist:  { name: 'Ashen Cultist', title: 'Hexer', star: 0, el: 'ember', model: 'bishop', move: 'wazir',
                stats: st(14, 5, 1, 4, 4), growth: gr(60, 40, 20, 30, 35), ability: 'hex', abilityName: 'Ashen Curse', colors: [0x3a2a26, 0xff5a2a] },
    golem:    { name: 'Bone Colossus', title: 'Heap of Saints', star: 0, el: 'thorn', model: 'rook', move: 'colossus',
                stats: st(32, 8, 6, 1, 2), growth: gr(90, 45, 45, 10, 15), ability: null, colors: [0x6c6a5c, 0x6fd05a] },
    gargoyle: { name: 'Gargoyle', title: 'Eave Watcher', star: 0, el: 'tide', model: 'gargoyle', move: 'gargoyle',
                stats: st(22, 8, 5, 3, 3), growth: gr(75, 45, 40, 25, 25), ability: null, colors: [0x4c5560, 0x3aa6ff] },
    drowned:  { name: 'The Drowned', title: 'Waterlogged', star: 0, el: 'tide', model: 'king', move: 'ghoul',
                stats: st(22, 7, 3, 4, 4), growth: gr(70, 45, 30, 30, 30), ability: null, colors: [0x2c4a52, 0x3aa6ff] },
    warden:   { name: 'Crypt Warden', title: 'Keeper of Keys', star: 0, el: 'umbra', model: 'rook', move: 'warden',
                stats: st(40, 9, 6, 3, 4), growth: gr(90, 50, 45, 20, 25), ability: 'bulwark', colors: [0x36303f, 0xa259ff] },
    vesperine:{ name: 'Count Vesperine', title: 'Lord of the Hollow', star: 0, el: 'umbra', model: 'queen', move: 'queen',
                stats: st(54, 12, 6, 8, 8), growth: gr(90, 55, 45, 35, 35), ability: 'drain', colors: [0x1a0a12, 0xc2203a] },
};
for (const [id, u] of Object.entries(UNITS)) u.id = id;

export const STAR_POOL = { 3: [], 4: [], 5: [] };
for (const u of Object.values(UNITS)) if (u.star) STAR_POOL[u.star].push(u.id);

// ---------------------------------------------------------------- stats
const GAIN = { hp: 2, atk: 1, def: 1, spd: 1, skl: 1 };
export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'skl'];

/** The gains a unit would have at level lv with average luck. Used for enemies and for new recruits. */
export function expectedGains(key, lv) {
    const g = UNITS[key].growth, out = {};
    for (const k of STAT_KEYS) out[k] = Math.floor(((lv - 1) * g[k]) / 100) * GAIN[k];
    return out;
}
export const gainAmount = (k) => GAIN[k];

/** Final stats from a roster record: base + gains, times the bond bonus. */
export function statsOf(key, gains, bond = 0) {
    const base = UNITS[key].stats, out = {};
    for (const k of STAT_KEYS) out[k] = Math.floor((base[k] + (gains?.[k] || 0)) * (1 + BOND.perDupe * bond));
    return out;
}

export const power = (rec) => {
    const s = statsOf(rec.key, rec.gains, rec.bond);
    return s.hp * 0.5 + s.atk * 3 + s.def * 2 + s.spd * 2 + s.skl;
};

// ---------------------------------------------------------------- chapters
// map rows are y = 0 (the enemy's edge) to the player's edge. . floor  # wall  ~ chasm  + altar
// player: the squares your party starts on, in party order. enemies: u = unit id, lv, boss, recruit.
const E = (u, x, y, lv, extra = {}) => ({ u, x, y, lv, ...extra });

export const CHAPTERS = [
    {
        id: 'c1', name: 'The Chapel Yard', slots: 3, victory: 'rout', ambience: 'moon',
        blurb: 'Headstones lean in the fog. Something under the soil has begun to knock.',
        map: ['........', '.#....#.', '........', '...~~...', '........', '.#....#.', '........', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('thrall', 2, 1, 1), E('thrall', 5, 2, 1), E('thrall', 3, 0, 1), E('ghoul', 4, 1, 1)],
        reward: { shards: 200 },
    },
    {
        id: 'c2', name: 'Ossuary Stairs', slots: 4, victory: 'rout', ambience: 'candle',
        blurb: 'A stair of stacked skulls, and a hush that is listening.',
        map: ['..#..#..', '.#....#.', '...##...', '........', '...~~...', '.#....#.', '........', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('thrall', 1, 0, 2), E('thrall', 6, 0, 2), E('hound', 3, 1, 2), E('cultist', 4, 1, 2), E('golem', 5, 2, 2)],
        reward: { shards: 250 },
    },
    {
        id: 'c3', name: 'The Drowned Crypt', slots: 4, victory: 'boss', ambience: 'flood',
        blurb: 'Black water swallows the floor. On a dry altar, a crowned figure waits without moving.',
        map: ['~..++..~', '~......~', '..~..~..', '...##...', '..~..~..', '........', '.#....#.', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('bram', 3, 0, 4, { boss: true, recruit: true }), E('drowned', 1, 2, 3), E('drowned', 6, 2, 3), E('wraith', 2, 1, 3), E('thrall', 5, 1, 3)],
        reward: { shards: 300 },
    },
    {
        id: 'c4', name: 'Gargoyle Terrace', slots: 4, victory: 'rout', ambience: 'wind',
        blurb: 'A rooftop of broken parapets. The statues are not all statues.',
        map: ['........', '.~~..~~.', '........', '#.~..~.#', '........', '.~~..~~.', '........', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('gargoyle', 1, 0, 5), E('gargoyle', 6, 0, 5), E('gargoyle', 3, 2, 5), E('wraith', 4, 1, 5), E('wraith', 6, 2, 5), E('hound', 0, 2, 5)],
        reward: { shards: 300 },
    },
    {
        id: 'c5', name: 'The Bell Tower Nave', slots: 5, victory: 'boss', ambience: 'bell',
        blurb: 'The great bell has not rung for a hundred years. An empty suit of armour sits beneath it, waiting for someone to ask.',
        map: ['..#..#..', '........', '.#.++.#.', '........', '.#....#.', '........', '..#..#..', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('corwin', 4, 1, 8, { boss: true, recruit: true }), E('golem', 2, 3, 7), E('golem', 5, 3, 7), E('cultist', 1, 1, 7), E('cultist', 6, 1, 7), E('wraith', 3, 0, 7), E('hound', 4, 3, 7)],
        reward: { shards: 400 },
    },
    {
        id: 'c6', name: 'The Vesper Throne', slots: 5, victory: 'boss', ambience: 'crimson',
        blurb: 'Count Vesperine rises from a throne of candle-wax and welcomes you to the last supper.',
        map: ['~..++..~', '.~....~.', '..#..#..', '........', '.#.~~.#.', '........', '~......~', '........'],
        player: [[3, 7], [4, 7], [2, 7], [5, 7], [1, 7]],
        enemies: [E('vesperine', 3, 0, 10, { boss: true }), E('warden', 5, 1, 9), E('gargoyle', 2, 1, 9), E('wraith', 2, 3, 9), E('wraith', 6, 3, 9), E('ghoul', 3, 3, 9), E('hound', 4, 2, 9)],
        reward: { shards: 800 },
    },
];
