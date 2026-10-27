// Procedural monsters: 20 families × adjective variants × a level that follows the floor and the party.
// Bosses are a family blown up with a name and two or three special moves. Pure.

import { clamp } from './core.js';
import { bossName } from './names.js';

// hp/atk/def/agi/xp/gold are multipliers on the level curve. pal: EGA colours (base, shade, light).
export const FAMILIES = [
    { id: 'rat', name: 'Cave Rat', minD: 1, grp: [2, 5], hp: 0.7, atk: 0.8, def: 0.5, agi: 1.3, xp: 0.7, gold: 0.5, verbs: ['gnaws', 'bites'], pal: [6, 8, 14], weak: [], res: [], kind: 'beast' },
    { id: 'bat', name: 'Bat', minD: 1, grp: [2, 4], hp: 0.6, atk: 0.85, def: 0.5, agi: 1.7, xp: 0.8, gold: 0.4, verbs: ['swoops at', 'bites'], pal: [5, 0, 13], weak: ['shock'], res: [], kind: 'beast', sp: ['drain'] },
    { id: 'slime', name: 'Slime', minD: 1, grp: [2, 4], hp: 1.3, atk: 0.7, def: 1.0, agi: 0.5, xp: 0.8, gold: 0.5, verbs: ['oozes over', 'engulfs'], pal: [10, 2, 15], weak: ['fire'], res: ['phys'], kind: 'ooze' },
    { id: 'goblin', name: 'Goblin', minD: 2, grp: [2, 5], hp: 0.9, atk: 1.0, def: 0.8, agi: 1.1, xp: 1.0, gold: 1.5, verbs: ['stabs', 'slashes'], pal: [2, 6, 10], weak: [], res: [], kind: 'humanoid', sp: ['steal'] },
    { id: 'skeleton', name: 'Skeleton', minD: 2, grp: [2, 4], hp: 0.9, atk: 1.1, def: 0.9, agi: 0.9, xp: 1.1, gold: 0.8, verbs: ['slashes', 'rattles at'], pal: [7, 8, 15], weak: ['holy', 'fire'], res: ['dark', 'ice'], kind: 'undead' },
    { id: 'spider', name: 'Spider', minD: 3, grp: [1, 3], hp: 0.9, atk: 1.0, def: 0.7, agi: 1.2, xp: 1.2, gold: 0.7, verbs: ['bites', 'lunges at'], pal: [8, 0, 12], weak: ['fire'], res: [], kind: 'beast', st: 'poison', stc: 0.4, sp: ['web'] },
    { id: 'wolf', name: 'Wolf', minD: 3, grp: [2, 4], hp: 1.0, atk: 1.15, def: 0.8, agi: 1.35, xp: 1.2, gold: 0.5, verbs: ['mauls', 'snaps at'], pal: [7, 8, 15], weak: ['fire'], res: [], kind: 'beast', sp: ['howl'] },
    { id: 'mushroom', name: 'Myconid', minD: 3, grp: [2, 4], hp: 1.2, atk: 0.8, def: 0.9, agi: 0.6, xp: 1.1, gold: 0.9, verbs: ['spores', 'slaps'], pal: [4, 12, 15], weak: ['fire'], res: ['dark'], kind: 'fungus', st: 'sleep', stc: 0.3, sp: ['spore'] },
    { id: 'zombie', name: 'Zombie', minD: 4, grp: [2, 4], hp: 1.5, atk: 1.0, def: 0.8, agi: 0.4, xp: 1.2, gold: 0.7, verbs: ['claws', 'gnaws'], pal: [2, 0, 10], weak: ['holy', 'fire'], res: ['dark', 'ice'], kind: 'undead' },
    { id: 'snake', name: 'Serpent', minD: 4, grp: [1, 3], hp: 0.9, atk: 1.05, def: 0.7, agi: 1.2, xp: 1.2, gold: 0.7, verbs: ['strikes', 'coils around'], pal: [10, 2, 14], weak: ['ice'], res: [], kind: 'beast', st: 'poison', stc: 0.5 },
    { id: 'imp', name: 'Imp', minD: 5, grp: [2, 4], hp: 0.8, atk: 1.1, def: 0.7, agi: 1.25, xp: 1.4, gold: 1.4, verbs: ['claws', 'jabs'], pal: [4, 5, 12], weak: ['holy', 'ice'], res: ['fire', 'dark'], kind: 'demon', sp: ['firebolt'] },
    { id: 'ghost', name: 'Ghost', minD: 5, grp: [1, 3], hp: 0.8, atk: 1.0, def: 0.5, agi: 1.0, xp: 1.5, gold: 1.0, verbs: ['chills', 'wails at'], pal: [11, 3, 15], weak: ['holy', 'fire'], res: ['phys', 'dark', 'ice'], kind: 'undead', st: 'curse', stc: 0.25, sp: ['wail'] },
    { id: 'crab', name: 'Rock Crab', minD: 6, grp: [1, 3], hp: 1.2, atk: 1.0, def: 1.7, agi: 0.6, xp: 1.4, gold: 1.0, verbs: ['pinches', 'clamps'], pal: [12, 4, 14], weak: ['shock', 'ice'], res: ['phys'], kind: 'beast' },
    { id: 'eye', name: 'Gaze Orb', minD: 6, grp: [1, 3], hp: 0.9, atk: 0.9, def: 0.6, agi: 0.9, xp: 1.6, gold: 1.2, verbs: ['stares at', 'zaps'], pal: [5, 13, 15], weak: ['shock', 'phys'], res: ['dark'], kind: 'aberration', sp: ['gaze', 'firebolt'] },
    { id: 'golem', name: 'Golem', minD: 7, grp: [1, 2], hp: 1.9, atk: 1.2, def: 1.5, agi: 0.4, xp: 1.8, gold: 1.4, verbs: ['smashes', 'crushes'], pal: [7, 8, 15], weak: ['shock'], res: ['phys', 'fire', 'dark'], kind: 'construct', sp: ['guard'] },
    { id: 'wraith', name: 'Wraith', minD: 8, grp: [1, 3], hp: 1.0, atk: 1.25, def: 0.7, agi: 1.1, xp: 1.9, gold: 1.4, verbs: ['rends', 'drains'], pal: [1, 0, 9], weak: ['holy'], res: ['phys', 'dark', 'ice'], kind: 'undead', st: 'curse', stc: 0.3, sp: ['drain'] },
    { id: 'mimic', name: 'Mimic', minD: 8, grp: [1, 1], hp: 1.8, atk: 1.4, def: 1.0, agi: 0.7, xp: 2.5, gold: 4.0, verbs: ['chomps', 'bites'], pal: [6, 14, 4], weak: ['fire'], res: [], kind: 'aberration' },
    { id: 'drake', name: 'Drakeling', minD: 10, grp: [1, 2], hp: 1.6, atk: 1.35, def: 1.2, agi: 0.9, xp: 2.4, gold: 2.2, verbs: ['bites', 'rakes'], pal: [4, 12, 14], weak: ['ice'], res: ['fire'], kind: 'dragon', sp: ['breath'] },
    { id: 'knight', name: 'Hollow Knight', minD: 12, grp: [1, 3], hp: 1.4, atk: 1.4, def: 1.6, agi: 0.8, xp: 2.6, gold: 2.0, verbs: ['cleaves', 'thrusts at'], pal: [8, 0, 11], weak: ['holy', 'shock'], res: ['dark'], kind: 'undead', sp: ['guard'] },
    { id: 'demon', name: 'Pit Fiend', minD: 15, grp: [1, 2], hp: 1.8, atk: 1.5, def: 1.2, agi: 1.0, xp: 3.2, gold: 3.0, verbs: ['gores', 'burns'], pal: [4, 5, 12], weak: ['holy', 'ice'], res: ['fire', 'dark'], kind: 'demon', sp: ['firebolt', 'breath'] },
    { id: 'centipede', name: 'Giant Centipede', minD: 4, grp: [1, 3], hp: 0.9, atk: 1.0, def: 0.8, agi: 1.2, xp: 1.2, gold: 0.6, verbs: ['bites', 'lashes'], pal: [6, 4, 14], weak: ['fire'], res: [], kind: 'beast', st: 'poison', stc: 0.45 },
    { id: 'scarecrow', name: 'Scarecrow', minD: 5, grp: [1, 3], hp: 1.1, atk: 1.0, def: 0.7, agi: 0.8, xp: 1.3, gold: 0.8, verbs: ['flails at', 'rakes'], pal: [6, 14, 12], weak: ['fire'], res: ['dark'], kind: 'construct', sp: ['gaze'] },
    { id: 'wisp', name: 'Will-o-Wisp', minD: 6, grp: [2, 4], hp: 0.6, atk: 1.0, def: 0.4, agi: 1.5, xp: 1.4, gold: 1.0, verbs: ['sears', 'zaps'], pal: [11, 3, 15], weak: ['ice'], res: ['shock', 'fire'], kind: 'elemental', sp: ['firebolt'] },
    { id: 'harpy', name: 'Harpy', minD: 7, grp: [1, 3], hp: 0.9, atk: 1.1, def: 0.6, agi: 1.6, xp: 1.5, gold: 1.3, verbs: ['rakes', 'dives at'], pal: [5, 13, 14], weak: ['shock'], res: [], kind: 'beast', st: 'sleep', stc: 0.25, sp: ['wail'] },
    { id: 'mummy', name: 'Mummy', minD: 8, grp: [1, 3], hp: 1.4, atk: 1.1, def: 1.0, agi: 0.5, xp: 1.7, gold: 1.6, verbs: ['strikes', 'chokes'], pal: [7, 6, 15], weak: ['fire', 'holy'], res: ['dark', 'ice'], kind: 'undead', st: 'curse', stc: 0.35 },
    { id: 'treant', name: 'Treant', minD: 9, grp: [1, 2], hp: 2.0, atk: 1.1, def: 1.3, agi: 0.4, xp: 1.9, gold: 1.0, verbs: ['batters', 'whips'], pal: [2, 6, 10], weak: ['fire'], res: ['shock', 'ice'], kind: 'plant', sp: ['spore', 'quake'] },
    { id: 'gargoyle', name: 'Gargoyle', minD: 9, grp: [1, 3], hp: 1.3, atk: 1.2, def: 1.6, agi: 0.8, xp: 2.0, gold: 1.5, verbs: ['claws', 'dives at'], pal: [8, 0, 7], weak: ['shock'], res: ['phys', 'fire'], kind: 'construct', sp: ['guard'] },
    { id: 'minotaur', name: 'Minotaur', minD: 11, grp: [1, 2], hp: 1.9, atk: 1.6, def: 1.1, agi: 0.8, xp: 2.4, gold: 2.0, verbs: ['gores', 'hacks'], pal: [6, 4, 14], weak: ['ice'], res: [], kind: 'humanoid', sp: ['quake', 'howl'] },
    { id: 'naga', name: 'Naga', minD: 13, grp: [1, 2], hp: 1.4, atk: 1.3, def: 1.0, agi: 1.1, xp: 2.5, gold: 2.2, verbs: ['strikes', 'constricts'], pal: [3, 2, 11], weak: ['shock'], res: ['ice'], kind: 'beast', st: 'poison', stc: 0.5, sp: ['gaze'] },
    { id: 'vampire', name: 'Vampire', minD: 14, grp: [1, 2], hp: 1.5, atk: 1.4, def: 1.1, agi: 1.3, xp: 3.0, gold: 3.0, verbs: ['bites', 'rends'], pal: [4, 0, 15], weak: ['holy', 'fire'], res: ['dark'], kind: 'undead', st: 'curse', stc: 0.3, sp: ['drain', 'wail'] },
    { id: 'hydra', name: 'Hydra', minD: 16, grp: [1, 1], hp: 3.0, atk: 1.5, def: 1.2, agi: 0.7, xp: 3.4, gold: 2.8, verbs: ['snaps at', 'bites'], pal: [2, 10, 14], weak: ['fire'], res: [], kind: 'dragon', st: 'poison', stc: 0.4, sp: ['breath', 'quake'] },
    { id: 'elemental', name: 'Elemental', minD: 18, grp: [1, 2], hp: 1.8, atk: 1.6, def: 1.2, agi: 1.0, xp: 3.6, gold: 2.5, verbs: ['smashes', 'scorches'], pal: [12, 14, 15], weak: ['ice'], res: ['fire'], kind: 'elemental', sp: ['breath', 'firebolt'] },
    { id: 'lich', name: 'Lich', minD: 20, grp: [1, 2], hp: 1.6, atk: 1.8, def: 1.1, agi: 1.0, xp: 4.2, gold: 4.0, verbs: ['blasts', 'withers'], pal: [5, 0, 11], weak: ['holy'], res: ['dark', 'ice', 'phys'], kind: 'undead', st: 'curse', stc: 0.4, sp: ['firebolt', 'drain', 'wail'] },
    { id: 'behemoth', name: 'Behemoth', minD: 24, grp: [1, 1], hp: 3.5, atk: 2.0, def: 1.6, agi: 0.6, xp: 5.0, gold: 4.0, verbs: ['tramples', 'gores'], pal: [8, 6, 14], weak: ['ice'], res: [], kind: 'beast', sp: ['quake', 'howl'] },
];
export const FAM_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

const VARIANTS = [
    { n: 'Young', minD: 1, maxD: 8, hp: 0.75, atk: 0.8, def: 0.8, xp: 0.8, w: 3 },
    { n: 'Sickly', minD: 1, maxD: 10, hp: 0.8, atk: 0.9, def: 0.7, xp: 0.8, w: 2 },
    { n: 'Feral', minD: 1, maxD: 99, hp: 1.0, atk: 1.15, def: 0.9, xp: 1.1, w: 3 },
    { n: 'Giant', minD: 2, maxD: 99, hp: 1.5, atk: 1.2, def: 1.0, agi: 0.8, xp: 1.4, w: 3 },
    { n: 'Rotting', minD: 3, maxD: 99, hp: 1.2, atk: 1.0, def: 0.8, st: 'poison', stc: 0.35, xp: 1.2, w: 2 },
    { n: 'Venomous', minD: 3, maxD: 99, hp: 0.95, atk: 1.0, def: 0.9, st: 'poison', stc: 0.55, xp: 1.3, w: 2 },
    { n: 'Frost', minD: 3, maxD: 99, hp: 1.1, atk: 1.0, def: 1.0, elem: 'ice', weak: ['fire'], res: ['ice'], xp: 1.35, w: 2, tint: 11 },
    { n: 'Ember', minD: 3, maxD: 99, hp: 1.0, atk: 1.1, def: 0.9, elem: 'fire', weak: ['ice'], res: ['fire'], xp: 1.35, w: 2, tint: 12 },
    { n: 'Storm', minD: 5, maxD: 99, hp: 1.0, atk: 1.1, def: 0.9, agi: 1.15, elem: 'shock', weak: ['phys'], res: ['shock'], xp: 1.4, w: 2, tint: 14 },
    { n: 'Armored', minD: 5, maxD: 99, hp: 1.1, atk: 1.0, def: 1.5, agi: 0.8, xp: 1.4, w: 2 },
    { n: 'Shadow', minD: 6, maxD: 99, hp: 1.0, atk: 1.15, def: 1.0, agi: 1.2, elem: 'dark', weak: ['holy'], res: ['dark'], xp: 1.5, w: 2, tint: 8 },
    { n: 'Cursed', minD: 7, maxD: 99, hp: 1.1, atk: 1.1, def: 1.0, st: 'curse', stc: 0.3, xp: 1.5, w: 2, tint: 5 },
    { n: 'Elder', minD: 8, maxD: 99, hp: 1.7, atk: 1.3, def: 1.3, xp: 1.9, w: 2 },
    { n: 'Blessed', minD: 8, maxD: 99, hp: 1.2, atk: 1.1, def: 1.1, elem: 'holy', weak: ['dark'], res: ['holy'], xp: 1.5, w: 1, tint: 15 },
    { n: 'Dire', minD: 12, maxD: 99, hp: 2.0, atk: 1.5, def: 1.3, xp: 2.4, w: 3 },
    { n: 'Ancient', minD: 20, maxD: 99, hp: 2.8, atk: 1.7, def: 1.5, xp: 3.2, w: 3 },
    { n: 'Primal', minD: 35, maxD: 99, hp: 3.6, atk: 2.0, def: 1.8, xp: 4.0, w: 3 },
];
export const VARIANT_NAMES = VARIANTS.map((v) => v.n);

/** Monsters follow the floor, and lean toward the party: an over-levelled party meets tougher monsters (worth more), an under-levelled one gets a little mercy. */
export const monsterLevel = (rng, depth, avg) => Math.max(1, Math.round(depth + Math.max(-4, avg - depth) * 0.55 + rng.range(-1, 1.2)));

export function genMonster(rng, depth, avg, famId = null, o = {}) {
    const fam = famId ? FAM_BY_ID[famId] : rng.weighted(FAMILIES.filter((f) => f.minD <= depth + 1), (f) => 1 + Math.max(0, 6 - (depth - f.minD)) * 0.2);
    const vs = VARIANTS.filter((v) => depth >= v.minD && depth <= v.maxD);
    const va = o.variantName ? VARIANTS.find((v) => v.n === o.variantName) : o.noVariant ? null : rng() < 0.6 ? rng.weighted(vs, (v) => v.w + (v.minD > 1 && depth - v.minD < 6 ? 2 : 0)) : null;
    const lv = o.lvl || monsterLevel(rng, depth, avg);
    const hp = Math.round((12 + 7 * Math.pow(lv, 1.25)) * fam.hp * (va?.hp || 1));
    const atk = Math.round((8 + 5.2 * lv) * fam.atk * (va?.atk || 1));
    const def = Math.round((2 + 1.15 * lv) * fam.def * (va?.def || 1));
    const weak = [...new Set([...(fam.weak || []), ...(va?.weak || [])])];
    let res = [...new Set([...(fam.res || []), ...(va?.res || [])])].filter((e) => !weak.includes(e));
    if (va?.elem && weak.includes(va.elem)) res = res.filter((e) => e !== va.elem);
    const pal = va?.tint ? [va.tint, fam.pal[1], fam.pal[2]] : fam.pal;
    return {
        fam: fam.id, name: `${va ? va.n + ' ' : ''}${fam.name}`, variant: va?.n || '', lvl: lv, hp, mhp: hp, atk, mag: atk, def, mdef: Math.round(def * 0.8),
        agi: Math.round((5 + 0.6 * lv) * fam.agi * (va?.agi || 1)),
        xp: Math.round((5 + 3.2 * Math.pow(lv, 1.15)) * fam.xp * (va?.xp || 1)),
        gold: Math.round((4 + 2.2 * lv) * fam.gold * rng.range(0.7, 1.3)),
        elem: va?.elem || (fam.kind === 'demon' ? 'fire' : 'phys'), weak, res,
        st: va?.st || fam.st || null, stc: va?.stc || fam.stc || 0, verbs: fam.verbs, sp: fam.sp || [],
        sprite: { fam: fam.id, seed: Math.floor(rng() * 1e6), pal, boss: false }, boss: false, status: {}, buf: {},
    };
}

/** A random-encounter group for this floor. */
export function genEncounter(rng, depth, avg, partySize = 4, o = {}) {
    const out = [];
    const total = clamp(Math.round(rng.range(2, 3 + partySize * 0.8) + depth * 0.05), 1, 6);
    const lvBoost = o.lvlBoost || 0;
    const groups = rng() < 0.35 ? 2 : 1;
    let left = total;
    for (let g = 0; g < groups && left > 0; g++) {
        const first = genMonster(rng, depth, avg, null, lvBoost ? { lvl: monsterLevel(rng, depth, avg) + lvBoost } : {});
        const fam = FAM_BY_ID[first.fam];
        const n = clamp(rng.int(fam.grp[0], fam.grp[1]), 1, left);
        out.push(first);
        for (let i = 1; i < n; i++) {
            out.push(genMonster(rng, depth, avg, first.fam, { lvl: Math.max(1, first.lvl + rng.int(-1, 1)), noVariant: !first.variant, variantName: first.variant || null }));
        }
        left -= n;
    }
    return out;
}

const BOSS_SP = {
    beast: ['howl', 'drain'], undead: ['wail', 'drain'], demon: ['firebolt', 'breath'], dragon: ['breath', 'howl'], construct: ['guard', 'quake'],
    ooze: ['spore', 'quake'], humanoid: ['steal', 'howl'], fungus: ['spore', 'wail'], aberration: ['gaze', 'firebolt'], plant: ['spore', 'quake'], elemental: ['breath', 'firebolt'],
};
/** o.fam / o.name pin a story guardian; otherwise the family and name are random. */
export function genBoss(rng, depth, avg, partySize = 4, o = {}) {
    const fams = FAMILIES.filter((f) => f.minD <= depth && f.id !== 'mimic');
    const fam = o.fam ? FAM_BY_ID[o.fam] : rng.pick(fams.slice(-Math.max(4, Math.ceil(fams.length * 0.5))));
    const lv = Math.max(2, Math.round(depth + 2 + clamp(avg - depth, -3, 6) * 0.2));
    const base = genMonster(rng, depth, avg, fam.id, { lvl: lv, noVariant: true });
    const sc = 5.5 + partySize * 0.7;
    const sps = [...new Set([...(BOSS_SP[fam.kind] || ['howl']), ...base.sp, 'quake'])].slice(0, 3);
    return {
        ...base, name: o.name || bossName(rng), famName: fam.name, boss: true, hp: Math.round(base.hp * sc), mhp: Math.round(base.hp * sc),
        atk: Math.round(base.atk * 1.3), mag: Math.round(base.atk * 1.3), def: Math.round(base.def * 1.15), mdef: Math.round(base.def * 1.0),
        xp: Math.round(base.xp * 9), gold: Math.round(base.gold * 12), sp: sps, st: base.st || (rng() < 0.4 ? 'poison' : null), stc: 0.35,
        sprite: { ...base.sprite, boss: true },
    };
}
