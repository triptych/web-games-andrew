/**
 * monsters.js — procedural species, encounters and the ten Wardens.
 *
 * A *species* is a genome rolled from (run seed, world, slot): an archetype
 * (body plan), a role (move-set), a generated name, and visual parameters the
 * view turns into a 3D model. An *enemy* is a species scaled to a world and
 * floor. Wardens are hand-scripted (phases, signature moves) but their bodies
 * are built by the same generator.
 *
 * Move types (executed in combat.js):
 *   attack{dmg} multi{dmg,hits} ward{n} guard{n} buff{might} debuff{st,n}
 *   attackDebuff{dmg,st,n} drain{dmg,heal} healAlly{n} charge{} summon{key,n}
 *   seal{cells,turns} ash{n} steal{} scramble{rows} frost{cells} flood{} void{}
 *   mirage{n} tax{gold,dmg} enrage{might}
 */

import { makeRng, hashSeed, hashStr } from './rng.js';
import { WORLD_DEFS, hpScale, dmgScale } from './worlds.js';

// ------------------------------------------------------------------ colour helpers (pure)

export function hexToHsl(hex) {
    const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    return [h, s, l];
}
export function hslToHex(h, s, l) {
    h = ((h % 1) + 1) % 1;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const f = (n) => {
        const k = (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
function vary(rng, hex, dh, ds, dl) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + rng.range(-dh, dh), s + rng.range(-ds, ds), l + rng.range(-dl, dl));
}

// ------------------------------------------------------------------ archetypes & roles

export const ARCH_NOUN = {
    blob: ['Ooze', 'Slick', 'Mire', 'Gloop'],
    beast: ['Stalker', 'Hound', 'Prowler', 'Ravager'],
    knight: ['Revenant', 'Sentinel', 'Hollow Knight', 'Oathless'],
    flyer: ['Harrier', 'Shrike', 'Gloomwing', 'Kite'],
    bloom: ['Blossom', 'Creeper', 'Mandrake', 'Bloom'],
    wraith: ['Wraith', 'Shade', 'Wisp', 'Haunt'],
    serpent: ['Serpent', 'Eel', 'Wyrm', 'Coil'],
    eye: ['Watcher', 'Gazer', 'Oculus', 'Seer'],
    golem: ['Golem', 'Colossus', 'Monolith', 'Hulk'],
    construct: ['Automaton', 'Engine', 'Clockwork', 'Idol'],
    jester: ['Jester', 'Mummer', 'Marionette', 'Fool'],
};

const ELITE_TITLES = ['the Unbroken', 'the Hungering', 'the Crowned', 'Doom-Singer', 'the Elder', 'the Ravenous', 'the Pale', 'the Undying', 'Oathbreaker', 'the Many-Eyed'];

/** Roles: base HP (at world 0) and move lists. `wt` = random weight. */
const ROLES = {
    brute: { hp: 40, weight: 1, pattern: 'cycle', moves: [
        { t: 'attack', dmg: 9, name: 'Maul' },
        { t: 'charge', name: 'Gathers itself' },
        { t: 'attack', dmg: 16, name: 'Crushing Blow' },
        { t: 'ward', n: 6, name: 'Hunker' },
    ], seq: [0, 1, 2, 3, 0, 1, 2] },
    guard: { hp: 46, weight: 1, pattern: 'random', moves: [
        { t: 'ward', n: 10, name: 'Brace', wt: 2 },
        { t: 'guard', n: 6, name: 'Shield Wall', wt: 1 },
        { t: 'attack', dmg: 7, name: 'Bash', wt: 3 },
        { t: 'attackDebuff', dmg: 5, st: 'weak', n: 1, name: 'Staggering Blow', wt: 2 },
    ] },
    hexer: { hp: 30, weight: 1, pattern: 'random', moves: [
        { t: 'debuff', st: 'weak', n: 2, name: 'Wither', wt: 2 },
        { t: 'debuff', st: 'exposed', n: 2, name: 'Mark', wt: 2 },
        { t: 'attack', dmg: 6, name: 'Hex Bolt', wt: 3 },
        { t: 'seal', cells: 1, turns: 2, name: 'Seal', wt: 2 },
        { t: 'ash', n: 2, name: 'Ashen Curse', wt: 1 },
    ] },
    swarm: { hp: 15, weight: 0.5, pattern: 'random', moves: [
        { t: 'attack', dmg: 4, name: 'Nip', wt: 3 },
        { t: 'multi', dmg: 2, hits: 2, name: 'Frenzy', wt: 2 },
        { t: 'buff', might: 1, name: 'Chitter', wt: 1 },
    ] },
    caster: { hp: 32, weight: 1, pattern: 'random', moves: [
        { t: 'attack', dmg: 8, name: 'Bolt', wt: 3 },
        { t: 'debuff', st: 'burn', n: 4, name: 'Immolate', wt: 2 },
        { t: 'buff', might: 2, name: 'Empower', wt: 1 },
        { t: 'ward', n: 6, name: 'Veil', wt: 1 },
    ] },
    trickster: { hp: 32, weight: 1, pattern: 'random', moves: [
        { t: 'steal', name: 'Pilfer', wt: 2 },
        { t: 'scramble', rows: 1, name: 'Shuffle', wt: 2 },
        { t: 'frost', cells: 2, name: 'Rime Touch', wt: 1 },
        { t: 'attack', dmg: 7, name: 'Cheap Shot', wt: 3 },
    ] },
    leech: { hp: 36, weight: 1, pattern: 'random', moves: [
        { t: 'drain', dmg: 6, heal: 5, name: 'Drain', wt: 3 },
        { t: 'healAlly', n: 9, name: 'Mend Kin', wt: 1 },
        { t: 'attack', dmg: 9, name: 'Bite', wt: 2 },
    ] },
};
const NORMAL_ROLES = ['brute', 'guard', 'hexer', 'swarm', 'caster', 'trickster', 'leech'];

const ELITE_PASSIVES = {
    thorns: { name: 'Thorned', text: 'Blades that strike it are struck back for 3.' },
    regen: { name: 'Regenerating', text: 'Heals 6% of its max HP each turn.' },
    enrage: { name: 'Enraged', text: 'Gains 1 Might every turn.' },
    armored: { name: 'Armoured', text: 'Gains Ward every turn.' },
};

// ------------------------------------------------------------------ naming

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function speciesName(rng, wd, arch) {
    const a = rng.pick(wd.pre), b = rng.pick(wd.post);
    return `${cap(a)}${b} ${rng.pick(ARCH_NOUN[arch])}`;
}

// ------------------------------------------------------------------ genome

function makeLook(rng, wd, arch, { scale = 1, boss = false, elite = false } = {}) {
    const base = vary(rng, rng.pick(wd.hills.concat(wd.ground)), 0.08, 0.2, 0.08);
    const [h, s, l] = hexToHsl(base);
    return {
        arch,
        seed: Math.floor(rng.next() * 1e9),
        scale,
        body: hslToHex(h, Math.min(0.8, s + 0.1), Math.max(0.16, Math.min(0.5, l + 0.1))),
        belly: hslToHex(h + 0.05, s * 0.8, Math.min(0.7, l + 0.25)),
        accent: vary(rng, wd.accent, 0.06, 0.1, 0.08),
        glow: vary(rng, wd.accent, 0.1, 0.05, 0.05),
        eyes: arch === 'eye' ? 1 : rng.int(1, 4) + (boss ? 1 : 0),
        horns: rng.int(0, 2) + (elite ? 1 : 0) + (boss ? 1 : 0),
        spikes: rng.int(0, 3) + (elite ? 2 : 0),
        wings: arch === 'flyer' || (boss && rng.chance(0.4)) || rng.chance(0.08),
        tendrils: rng.int(0, 3),
        crown: boss || (elite && rng.chance(0.6)),
        shards: rng.int(0, 2) + (boss ? 3 : 0),
        lumpy: rng.range(0.1, 0.35),
        squash: rng.range(0.8, 1.2),
    };
}

/** The normal species (6) and elite species (2) of world w in this run. */
export function worldBestiary(runSeed, w) {
    const wd = WORLD_DEFS[w];
    const out = { normals: [], elites: [] };
    const roles = [...NORMAL_ROLES];
    const rng = makeRng(hashSeed(runSeed, w, 101));
    rng.shuffle(roles);
    for (let i = 0; i < 6; i++) {
        const srng = makeRng(hashSeed(runSeed, w, i, 7));
        const arch = wd.arch[(i + rng.int(0, 5)) % wd.arch.length];
        const role = roles[i % roles.length];
        out.normals.push({
            key: `w${w}n${i}`, name: speciesName(srng, wd, arch), arch, role, tier: 'normal',
            look: makeLook(srng, wd, arch, { scale: role === 'swarm' ? 0.72 : srng.range(0.92, 1.1) }),
        });
    }
    for (let i = 0; i < 2; i++) {
        const srng = makeRng(hashSeed(runSeed, w, i, 13));
        const arch = srng.pick(wd.arch);
        const role = srng.pick(['brute', 'guard', 'caster', 'hexer', 'leech', 'trickster']);
        const passive = srng.pick(Object.keys(ELITE_PASSIVES));
        out.elites.push({
            key: `w${w}e${i}`, name: speciesName(srng, wd, arch), title: srng.pick(ELITE_TITLES), arch, role, tier: 'elite', passive,
            look: makeLook(srng, wd, arch, { scale: 1.3, elite: true }),
        });
    }
    return out;
}

// ------------------------------------------------------------------ Wardens

const m = (t, props) => ({ t, ...props });

/** Hand-authored Warden scripts. hp is at world-0 scale (hpScale applies). */
export const BOSSES = {
    baron: {
        name: 'The Scarecrow Baron', title: 'Jack of Ash', arch: 'knight', hp: 115,
        minion: { name: 'Cinder Crow', arch: 'flyer', hp: 11, moves: [m('attack', { dmg: 3, name: 'Peck' }), m('multi', { dmg: 2, hits: 2, name: 'Flurry' })] },
        phases: [
            { at: 1, name: 'The Harvest', seq: [0, 1, 2, 3, 1, 2], moves: [
                m('summon', { n: 2, name: 'Call the Crows' }),
                m('attack', { dmg: 11, name: 'Scythe' }),
                m('steal', { dmg: 5, name: 'Harvest' }),
                m('attackDebuff', { dmg: 6, st: 'burn', n: 3, name: 'Burning Straw' }),
            ] },
            { at: 0.5, name: 'The Baron Burns', enter: { might: 2, ward: 10 }, seq: [0, 1, 2, 3], moves: [
                m('multi', { dmg: 6, hits: 2, name: 'Twin Scythes' }),
                m('seal', { cells: 2, turns: 2, name: 'Field of Cinders' }),
                m('attack', { dmg: 15, name: 'Reaping' }),
                m('summon', { n: 1, name: 'Call the Crows' }),
            ] },
        ],
    },
    abbess: {
        name: 'The Tidebound Abbess', title: 'Keeper of Vespers', arch: 'wraith', hp: 120,
        minion: { name: 'Drowned Chorister', arch: 'wraith', hp: 13, moves: [m('attack', { dmg: 4, name: 'Dirge' }), m('guard', { n: 4, name: 'Chant' })] },
        phases: [
            { at: 1, name: 'Vespers', seq: [0, 1, 2, 3], moves: [
                m('summon', { n: 2, name: 'Raise the Choir' }),
                m('attackDebuff', { dmg: 13, st: 'weak', n: 1, name: 'Undertow' }),
                m('flood', { name: 'Rising Tide' }),
                m('multi', { dmg: 6, hits: 2, name: 'Breakers' }),
            ] },
            { at: 0.45, name: 'The Last Hymn', enter: { ward: 15 }, seq: [0, 1, 2], moves: [
                m('multi', { dmg: 6, hits: 3, name: 'Breakers' }),
                m('flood', { name: 'Rising Tide' }),
                m('drain', { dmg: 9, heal: 10, name: 'Drowning Kiss' }),
            ] },
        ],
    },
    briar: {
        name: 'The Briar Queen', title: 'Warden of the Hedge', arch: 'bloom', hp: 130, thorns: 3,
        phases: [
            { at: 1, name: 'The Hedge', seq: [0, 1, 2, 3], moves: [
                m('seal', { cells: 3, turns: 2, name: 'Bramble Wall' }),
                m('multi', { dmg: 4, hits: 3, name: 'Thorn Lash' }),
                m('buff', { might: 2, heal: 12, name: 'Rose of Blood' }),
                m('attack', { dmg: 13, name: 'Crown of Thorns' }),
            ] },
            { at: 0.4, name: 'Wild Bloom', enter: { might: 1 }, seq: [0, 1, 2], moves: [
                m('multi', { dmg: 4, hits: 4, name: 'Bramble Storm' }),
                m('seal', { cells: 4, turns: 1, name: 'Overgrowth' }),
                m('attackDebuff', { dmg: 10, st: 'exposed', n: 2, name: 'Piercing Thorn' }),
            ] },
        ],
    },
    sultan: {
        name: 'The Mirage Sultan', title: 'A Thousand Reflections', arch: 'jester', hp: 130,
        minion: { name: 'Mirage', arch: 'wraith', hp: 10, moves: [m('attack', { dmg: 6, name: 'False Blade' })] },
        phases: [
            { at: 1, name: 'Shimmer', seq: [0, 1, 2, 3], moves: [
                m('summon', { n: 2, name: 'Mirror Image' }),
                m('mirage', { n: 4, name: 'Mirage' }),
                m('multi', { dmg: 5, hits: 3, name: 'Scimitar Dance' }),
                m('frost', { cells: 3, dmg: 6, name: 'Glass Storm' }),
            ] },
            { at: 0.5, name: 'The True Sultan', enter: { ward: 12, might: 1 }, seq: [0, 1, 2, 3], moves: [
                m('mirage', { n: 6, name: 'Grand Illusion' }),
                m('attack', { dmg: 16, name: 'Sun-Scimitar' }),
                m('summon', { n: 2, name: 'Mirror Image' }),
                m('multi', { dmg: 6, hits: 3, name: 'Scimitar Dance' }),
            ] },
        ],
    },
    colossus: {
        name: 'The Rime Colossus', title: 'The Mountain That Stood', arch: 'golem', hp: 170, armored: 8,
        phases: [
            { at: 1, name: 'The Long Winter', seq: [0, 1, 2, 3, 4], moves: [
                m('attackDebuff', { dmg: 11, st: 'exposed', n: 1, name: 'Stomp' }),
                m('frost', { cells: 4, name: 'Hoarfrost' }),
                m('charge', { name: 'Raises the Glacier' }),
                m('attack', { dmg: 26, name: 'Avalanche' }),
                m('ward', { n: 18, name: 'Frozen Heart' }),
            ] },
            { at: 0.35, name: 'Thaw', enter: { might: 3 }, seq: [0, 1, 2], moves: [
                m('attack', { dmg: 14, name: 'Shatterfist' }),
                m('charge', { name: 'Raises the Glacier' }),
                m('attack', { dmg: 28, name: 'Avalanche' }),
            ] },
        ],
    },
    mammon: {
        name: 'Mammon, the Coin-Eater', title: 'Who Bought the Warmth', arch: 'construct', hp: 175,
        phases: [
            { at: 1, name: 'The Hoard', seq: [0, 1, 2, 3], moves: [
                m('tax', { gold: 15, dmg: 15, name: 'Tithe' }),
                m('ward', { n: 12, name: 'Gilded Skin' }),
                m('multi', { dmg: 5, hits: 5, name: 'Coin Storm' }),
                m('steal', { heal: 10, dmg: 8, name: 'Devour' }),
            ] },
            { at: 0.5, name: 'Insatiable', enter: { might: 2 }, seq: [0, 1, 2, 3], moves: [
                m('steal', { heal: 14, name: 'Devour' }),
                m('multi', { dmg: 4, hits: 5, name: 'Coin Storm' }),
                m('tax', { gold: 20, dmg: 12, name: 'Usury' }),
                m('ash', { n: 3, name: 'Leaden Coins' }),
            ] },
        ],
    },
    roc: {
        name: 'The Storm Roc', title: 'Who Saw the Throne', arch: 'flyer', hp: 170,
        phases: [
            { at: 1, name: 'Squall', seq: [0, 1, 2, 3], moves: [
                m('scramble', { rows: 2, name: 'Gale' }),
                m('multi', { dmg: 7, hits: 3, name: 'Talons' }),
                m('charge', { name: 'Thunderhead' }),
                m('attackDebuff', { dmg: 22, st: 'exposed', n: 1, name: 'Lightning' }),
            ] },
            { at: 0.5, name: 'Eye of the Storm', enter: { might: 3, ward: 15 }, seq: [0, 1, 2], moves: [
                m('multi', { dmg: 5, hits: 4, name: 'Hurricane' }),
                m('scramble', { rows: 3, name: 'Gale' }),
                m('attack', { dmg: 20, name: 'Stormbreak' }),
            ] },
        ],
    },
    harlequin: {
        name: 'The Harlequin', title: 'The Dealer\'s Fool', arch: 'jester', hp: 155,
        minion: { name: 'Mime', arch: 'jester', hp: 26, moves: [m('attack', { dmg: 7, name: 'Silent Slap' }), m('mirage', { n: 2, name: 'Pantomime' })] },
        phases: [
            { at: 1, name: 'Opening Act', seq: [0, 1, 2, 3, 4], moves: [
                m('ash', { n: 3, name: 'Card Trick' }),
                m('multi', { dmg: 4, hits: 4, name: 'Juggle' }),
                m('debuff', { st: 'weak', n: 2, also: 'exposed', name: 'Laugh' }),
                m('summon', { n: 1, name: 'Mirror Act' }),
                m('attack', { dmg: 18, name: 'Punchline' }),
            ] },
            { at: 0.5, name: 'The Grand Finale', enter: { might: 2, ward: 20 }, seq: [0, 1, 2, 3], moves: [
                m('scramble', { rows: 5, name: 'Fifty-Two Pickup' }),
                m('multi', { dmg: 5, hits: 4, name: 'Knife Throw' }),
                m('mirage', { n: 6, name: 'Sleight of Hand' }),
                m('attack', { dmg: 22, name: 'Punchline' }),
            ] },
        ],
    },
    leviathan: {
        name: 'The Leviathan of Nothing', title: 'Where the Cards Go', arch: 'serpent', hp: 175,
        phases: [
            { at: 1, name: 'The Deep', seq: [0, 1, 2, 3, 4], moves: [
                m('void', { name: 'Void Maw' }),
                m('multi', { dmg: 7, hits: 3, name: 'Tentacles' }),
                m('ash', { n: 2, seal: 2, name: 'Tide of Nothing' }),
                m('charge', { name: 'Surfacing' }),
                m('attack', { dmg: 30, name: 'Crushing Deep' }),
            ] },
            { at: 0.4, name: 'Unmaking', enter: { might: 3 }, seq: [0, 1, 2, 3], moves: [
                m('void', { name: 'Void Maw' }),
                m('drain', { dmg: 14, heal: 20, name: 'Consume' }),
                m('multi', { dmg: 8, hits: 3, name: 'Tentacles' }),
                m('frost', { cells: 5, name: 'Starless Cold' }),
            ] },
        ],
    },
    king: {
        name: 'The Hollow King', title: 'Who Would Not Finish', arch: 'knight', hp: 155,
        minion: { name: 'Hollow Guard', arch: 'knight', hp: 30, moves: [m('attack', { dmg: 8, name: 'Halberd' }), m('guard', { n: 8, name: 'Kneel' })] },
        phases: [
            { at: 1, name: 'The Hollow King', seq: [0, 1, 2, 3], moves: [
                m('attack', { dmg: 14, name: 'Sceptre' }),
                m('seal', { cells: 3, turns: 2, name: 'Royal Decree' }),
                m('summon', { n: 2, name: 'Call the Guard' }),
                m('attackDebuff', { dmg: 10, st: 'weak', n: 2, name: 'Ashen Word' }),
            ] },
            { at: 0.66, name: 'The Stolen Ace', enter: { ward: 30, clear: true }, seq: [0, 1, 2, 3, 4], moves: [
                m('flood', { name: 'Tide of Ash' }),
                m('multi', { dmg: 7, hits: 3, name: 'The Ace Burns' }),
                m('steal', { heal: 15, name: 'What Is Owed' }),
                m('void', { name: 'Erasure' }),
                m('attack', { dmg: 24, name: 'Heartfire' }),
            ] },
            { at: 0.3, name: 'The Last Hand', enter: { might: 3, clear: true }, seq: [0, 1, 2, 3], moves: [
                m('enrage', { might: 2, name: 'Desperation' }),
                m('multi', { dmg: 6, hits: 5, name: 'Fifty-Two Blades' }),
                m('mirage', { n: 8, name: 'Reshuffle the World' }),
                m('attack', { dmg: 26, name: 'The Final Deal' }),
            ] },
        ],
    },
};

/** Each Warden's signature colours (body, accent, glow). */
const BOSS_COLORS = {
    baron: [0x8a6a2a, 0x3a2a18, 0xff8a20], abbess: [0x2a5a60, 0xd8e8e0, 0x60ffe0], briar: [0x2a4a1a, 0x8a1030, 0xff5080],
    sultan: [0xe8d8b0, 0x2080c0, 0xffd060], colossus: [0x9ab8d8, 0xe0f4ff, 0x80d0ff], mammon: [0xc89020, 0x6a3a08, 0xffe060],
    roc: [0x3a4a6a, 0xd8e0f0, 0xa0c0ff], harlequin: [0x2a1a3a, 0xe02060, 0x40ffe0], leviathan: [0x1a1030, 0x6040a0, 0xb080ff],
    king: [0x3a3632, 0xc8a050, 0xff3040],
};

export function bossSpecies(key, w) {
    const b = BOSSES[key];
    const rng = makeRng(hashSeed(hashStr(key), 99));
    const wd = WORLD_DEFS[w];
    const look = makeLook(rng, wd, b.arch, { scale: 1.75, boss: true });
    const col = BOSS_COLORS[key];
    if (col) { look.body = col[0]; look.belly = col[1]; look.accent = col[1]; look.glow = col[2]; }
    look.bossKey = key;
    if (key === 'baron' || key === 'king' || key === 'abbess') look.wings = false;
    if (key === 'baron') look.crown = false;
    return { key: 'boss_' + key, bossKey: key, name: b.name, title: b.title, arch: b.arch, tier: 'boss', look };
}

function minionSpecies(bossKey, w) {
    const b = BOSSES[bossKey];
    const rng = makeRng(hashSeed(hashStr(bossKey), 7));
    const wd = WORLD_DEFS[w];
    return {
        key: 'min_' + bossKey, name: b.minion.name, arch: b.minion.arch, tier: 'minion', minionOf: bossKey,
        look: makeLook(rng, wd, b.minion.arch, { scale: 0.7 }),
    };
}

// ------------------------------------------------------------------ scaling to enemies

const ROLE_DMG = 0.75;

function scaleMove(mv, w, floor, k = ROLE_DMG) {
    const ds = dmgScale(w) * (1 + 0.02 * floor) * k;
    const out = { ...mv };
    if (out.dmg) out.dmg = Math.max(1, Math.round(out.dmg * ds));
    if (out.n && (out.t === 'ward' || out.t === 'guard' || out.t === 'healAlly')) out.n = Math.round(out.n * dmgScale(w) * (1 + 0.02 * floor));
    if (out.t === 'debuff' && out.st === 'burn') out.n = Math.round(out.n * (1 + 0.25 * w));
    if (out.heal) out.heal = Math.round(out.heal * Math.pow(hpScale(w), 0.85));
    if (out.gold) out.gold = Math.round(out.gold * (1 + 0.15 * w));
    return out;
}

let _eid = 0;
function baseEnemy(sp, hp, moves, extra = {}) {
    return {
        eid: ++_eid, key: sp.key, name: sp.name, title: sp.title ?? null, tier: sp.tier, arch: sp.arch,
        look: sp.look, hp, maxHp: hp, ward: 0, alive: true,
        st: { might: 0, weak: 0, exposed: 0, burn: 0, regen: 0 },
        moves, seq: null, seqI: 0, pattern: 'random', hist: [], intent: null, charged: false,
        passive: null, thorns: 0, armored: 0, phase: 0, minion: false, ...extra,
    };
}

export function makeEnemy(sp, w, floor, rng) {
    if (sp.tier === 'boss') return makeBoss(sp, w);
    if (sp.tier === 'minion') {
        const b = BOSSES[sp.minionOf];
        const hp = Math.round(b.minion.hp * hpScale(w));
        return baseEnemy(sp, hp, b.minion.moves.map((mv) => scaleMove(mv, w, 0, 0.85)), { minion: true });
    }
    const role = ROLES[sp.role];
    const hpBase = role.hp * 0.9 * (sp.tier === 'elite' ? 2.4 : 1);
    const hp = Math.round(hpBase * hpScale(w) * (1 + 0.035 * floor) * rng.range(0.92, 1.08));
    let moves = role.moves.map((mv) => scaleMove(mv, w, floor));
    if (sp.tier === 'elite') moves = moves.map((mv) => (mv.dmg ? { ...mv, dmg: Math.round(mv.dmg * 1.3) } : mv));
    const e = baseEnemy(sp, hp, moves, { pattern: role.pattern, seq: role.seq ?? null, passive: sp.passive ?? null });
    if (role.seq) e.seqI = rng.int(0, role.seq.length - 1);
    if (e.passive === 'thorns') e.thorns = Math.round(3 * (1 + 0.3 * w));
    if (e.passive === 'armored') e.armored = Math.round(6 * dmgScale(w));
    return e;
}

function makeBoss(sp, w) {
    const b = BOSSES[sp.bossKey];
    const hp = Math.round(b.hp * hpScale(w));
    const phases = b.phases.map((ph) => ({ ...ph, moves: ph.moves.map((mv) => scaleMove(mv, w, 0, 0.75)) }));
    const e = baseEnemy(sp, hp, phases[0].moves, { pattern: 'cycle', seq: phases[0].seq, phases, boss: true, bossKey: sp.bossKey });
    if (b.thorns) e.thorns = Math.round(b.thorns * (1 + 0.3 * w));
    if (b.armored) e.armored = Math.round(b.armored * dmgScale(w));
    e.minionSpecies = b.minion ? minionSpecies(sp.bossKey, w) : null;
    return e;
}

// ------------------------------------------------------------------ encounters

/** Species list for a node. kind: battle | elite | boss. */
export function encounterFor(runSeed, w, floor, kind, nodeSeed) {
    const best = worldBestiary(runSeed, w);
    const rng = makeRng(hashSeed(runSeed, w, floor, nodeSeed, 31));
    if (kind === 'boss') return [bossSpecies(WORLD_DEFS[w].boss, w)];
    if (kind === 'elite') {
        const e = rng.pick(best.elites);
        const list = [e];
        if (floor >= 7 && rng.chance(0.5)) list.push(best.normals.find((s) => s.role === 'swarm') ?? rng.pick(best.normals));
        return list;
    }
    // normal battles: a budget of "weight" that grows with the floor
    const budget = floor <= 2 ? 1 : floor <= 5 ? rng.pick([1.5, 2]) : rng.pick([2, 2, 2.5]);
    const list = [];
    let spent = 0;
    let guard = 0;
    while (spent < budget - 0.01 && list.length < 4 && guard++ < 20) {
        const sp = rng.pick(best.normals);
        const wgt = ROLES[sp.role].weight;
        if (spent + wgt > budget + 0.01) continue;
        list.push(sp);
        spent += wgt;
    }
    if (!list.length) list.push(best.normals[0]);
    return list;
}

export function passiveInfo(key) { return ELITE_PASSIVES[key] ?? null; }
