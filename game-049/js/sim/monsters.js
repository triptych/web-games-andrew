/**
 * monsters.js — species (7 per world), behaviour archetypes, elite affixes,
 * generated names and depth scaling. Plain data + pure constructors.
 *
 * Species keys: n name · a archetype · b body plan (the view builds it) ·
 * c/c2 main/accent colour · g glow colour · hp dmg acc eva arm spd xp ·
 * sz size · r range · bolt projectile look · hit {st, ch, n} status on hit ·
 * imm immunities · fly · sum summoned species · grp pack size · w world.
 */

export const ARCH = {
    brute:      { hp: 16, dmg: [3, 6], acc: 0, eva: 0, arm: 1, spd: 85, xp: 8 },
    skirmisher: { hp: 7, dmg: [2, 4], acc: 5, eva: 12, arm: 0, spd: 140, xp: 6 },
    pack:       { hp: 6, dmg: [1, 3], acc: 0, eva: 6, arm: 0, spd: 110, xp: 3, grp: [3, 5] },
    archer:     { hp: 8, dmg: [2, 4], acc: 4, eva: 4, arm: 0, spd: 100, xp: 7, r: 5, bolt: 'arrow' },
    caster:     { hp: 8, dmg: [2, 5], acc: 6, eva: 4, arm: 0, spd: 100, xp: 9, r: 5, bolt: 'arcane' },
    bomber:     { hp: 5, dmg: [5, 9], acc: 0, eva: 4, arm: 0, spd: 115, xp: 5 },
    tank:       { hp: 24, dmg: [2, 5], acc: 0, eva: 0, arm: 4, spd: 70, xp: 10 },
    summoner:   { hp: 12, dmg: [1, 3], acc: 2, eva: 4, arm: 0, spd: 90, xp: 12, r: 4, bolt: 'arcane' },
    ambusher:   { hp: 14, dmg: [3, 6], acc: 6, eva: 2, arm: 1, spd: 100, xp: 9 },
    charger:    { hp: 14, dmg: [3, 7], acc: 3, eva: 2, arm: 1, spd: 100, xp: 9 },
    healer:     { hp: 10, dmg: [1, 3], acc: 0, eva: 6, arm: 0, spd: 95, xp: 9, r: 4 },
    nest:       { hp: 30, dmg: [0, 0], acc: 0, eva: 0, arm: 2, spd: 100, xp: 15 },
    ally:       { hp: 20, dmg: [3, 6], acc: 8, eva: 6, arm: 1, spd: 100, xp: 0 },
};

const S = {};
const sp = (w, id, n, a, b, c, c2, o = {}) => { S[id] = { id, w, n, a, b, c, c2, ...ARCH[a], ...o }; };

// 1 — Rootcellars
sp(1, 'rat', 'Cellar Rat', 'pack', 'quad', 0x6b5544, 0xd0a090, { sz: 0.45, hp: 5 });
sp(1, 'beetle', 'Root Beetle', 'tank', 'bug', 0x3a2a1a, 0x8a6a3a, { sz: 0.6, hp: 14 });
sp(1, 'grub', 'Pale Grub', 'brute', 'serpent', 0xd8c8a0, 0x8a7050, { sz: 0.6, hp: 12, spd: 70 });
sp(1, 'kobold', 'Kobold Slinger', 'archer', 'biped', 0x8a5a3a, 0x5a3a20, { sz: 0.6, bolt: 'stone', hp: 7 });
sp(1, 'slime', 'Cellar Slime', 'brute', 'blob', 0x6aa040, 0xb0e070, { sz: 0.6, hp: 13, hit: { st: 'poison', ch: 0.25, n: 3 } });
sp(1, 'moth', 'Dust Moth', 'skirmisher', 'bat', 0xa09070, 0xe0d0a0, { sz: 0.45, fly: true, hp: 5 });
sp(1, 'burrower', 'Burrow Mole', 'ambusher', 'quad', 0x4a3a30, 0xe0a0a0, { sz: 0.6, hp: 12 });
// 2 — Grotto
sp(2, 'puffball', 'Puffball', 'bomber', 'blob', 0xc8b070, 0x8aff6a, { sz: 0.55, blast: 'poison', g: 0x8aff6a });
sp(2, 'mushman', 'Capped Brute', 'brute', 'shroom', 0xb04030, 0xf0e0c0, { sz: 0.8 });
sp(2, 'toad', 'Grotto Toad', 'charger', 'quad', 0x4a7a3a, 0xe0c040, { sz: 0.6, dmg: [2, 5], hp: 12, hit: { st: 'poison', ch: 0.25, n: 3 } });
sp(2, 'glowmoth', 'Glowmoth', 'skirmisher', 'bat', 0x3a8a8a, 0x8affe0, { sz: 0.45, fly: true, g: 0x6affd0 });
sp(2, 'leech', 'Pool Leech', 'pack', 'serpent', 0x3a2a3a, 0xa04060, { sz: 0.45, hit: { st: 'bleed', ch: 0.3, n: 3 }, swim: true });
sp(2, 'sporeling', 'Sporeling', 'caster', 'shroom', 0x8a6aaa, 0xd0ff9a, { sz: 0.5, bolt: 'spore', hit: { st: 'poison', ch: 0.6, n: 4 }, g: 0xb0ff80 });
sp(2, 'myconid', 'Myconid Tender', 'healer', 'shroom', 0x5a8aaa, 0xf0f0d0, { sz: 0.65, g: 0x80c0ff });
// 3 — Library
sp(3, 'tome', 'Biting Tome', 'skirmisher', 'book', 0x6a2a2a, 0xe8d8b0, { sz: 0.45, fly: true });
sp(3, 'inkwraith', 'Ink Wraith', 'caster', 'wraith', 0x101830, 0x3a5aff, { sz: 0.7, bolt: 'ink', hit: { st: 'weak', ch: 0.5, n: 4 }, fly: true, g: 0x3a5aff });
sp(3, 'scholar', 'Drowned Scholar', 'summoner', 'biped', 0x4a6a6a, 0x9ab0a0, { sz: 0.7, sum: 'tome' });
sp(3, 'eel', 'Archive Eel', 'ambusher', 'serpent', 0x1a3a4a, 0x6ad0ff, { sz: 0.7, g: 0x6ad0ff, hit: { st: 'stun', ch: 0.15, n: 1 } });
sp(3, 'papergolem', 'Paper Golem', 'tank', 'construct', 0xe0d8c0, 0x6a5a40, { sz: 0.85, weakFire: true });
sp(3, 'quillimp', 'Quill Imp', 'archer', 'imp', 0x2a2a3a, 0xc0c0e0, { sz: 0.5, bolt: 'quill' });
sp(3, 'librarian', 'Silent Librarian', 'healer', 'wraith', 0x3a3a5a, 0xffe0a0, { sz: 0.7, fly: true, g: 0xffe0a0 });
// 4 — Forge
sp(4, 'imp', 'Cinder Imp', 'skirmisher', 'imp', 0xc03a1a, 0xffb040, { sz: 0.5, hit: { st: 'burn', ch: 0.3, n: 3 }, imm: ['burn'], g: 0xff6a20 });
sp(4, 'magmaslug', 'Magma Slug', 'brute', 'serpent', 0x3a1a10, 0xff6010, { sz: 0.7, hit: { st: 'burn', ch: 0.5, n: 3 }, imm: ['burn'], g: 0xff5010 });
sp(4, 'forgegolem', 'Forge Golem', 'tank', 'construct', 0x4a4a50, 0xff8a30, { sz: 0.95, imm: ['burn', 'poison', 'bleed'], g: 0xff7a20 });
sp(4, 'salamander', 'Salamander', 'caster', 'serpent', 0xd04a1a, 0xffd040, { sz: 0.6, bolt: 'fire', hit: { st: 'burn', ch: 0.7, n: 3 }, imm: ['burn'] });
sp(4, 'cinderbat', 'Cinder Bat', 'pack', 'bat', 0x2a1a1a, 0xff7030, { sz: 0.4, fly: true, imm: ['burn'] });
sp(4, 'smith', 'Hollow Smith', 'charger', 'biped', 0x5a4a40, 0xc08040, { sz: 0.8, arm: 3 });
sp(4, 'firehound', 'Ember Hound', 'pack', 'quad', 0x3a2a24, 0xff9030, { sz: 0.55, hit: { st: 'burn', ch: 0.25, n: 2 }, imm: ['burn'], grp: [2, 4] });
// 5 — Hollows
sp(5, 'crystalspider', 'Crystal Spider', 'skirmisher', 'spider', 0x8a6aca, 0xe0d0ff, { sz: 0.55, hit: { st: 'bleed', ch: 0.3, n: 3 } });
sp(5, 'shardling', 'Shardling', 'pack', 'crystal', 0xb090ff, 0xffffff, { sz: 0.4, g: 0xc0a0ff });
sp(5, 'prismwisp', 'Prism Wisp', 'caster', 'wisp', 0xffffff, 0xd0a0ff, { sz: 0.45, bolt: 'prism', fly: true, g: 0xe0c0ff });
sp(5, 'geodecrab', 'Geode Crab', 'tank', 'bug', 0x5a5060, 0xff70d0, { sz: 0.75, arm: 6 });
sp(5, 'glassbat', 'Glass Bat', 'pack', 'bat', 0xa0c0e0, 0xffffff, { sz: 0.4, fly: true });
sp(5, 'facet', 'Unstable Facet', 'bomber', 'crystal', 0xff80c0, 0xffffff, { sz: 0.5, blast: 'arcane', g: 0xff80d0 });
sp(5, 'lumenmite', 'Lumen Mite', 'healer', 'bug', 0x6a5a8a, 0xfff0a0, { sz: 0.45, g: 0xfff0a0 });
// 6 — Ossuary
sp(6, 'skeleton', 'Restless Bones', 'pack', 'skeleton', 0xe8e0c8, 0x6a6050, { sz: 0.7, grp: [2, 4], imm: ['poison', 'bleed'] });
sp(6, 'ghoul', 'Ghoul', 'skirmisher', 'biped', 0x6a7a5a, 0xc0d0a0, { sz: 0.7, hit: { st: 'bleed', ch: 0.35, n: 3 } });
sp(6, 'banshee', 'Banshee', 'caster', 'wraith', 0xc0d0e0, 0xffffff, { sz: 0.7, bolt: 'wail', hit: { st: 'stun', ch: 0.35, n: 1 }, fly: true, g: 0xd0e0ff });
sp(6, 'bonearcher', 'Bone Archer', 'archer', 'skeleton', 0xd8d0b0, 0x8a3a3a, { sz: 0.7, imm: ['poison', 'bleed'] });
sp(6, 'necromancer', 'Necromancer', 'summoner', 'biped', 0x2a2a30, 0x8aff8a, { sz: 0.75, sum: 'skeleton', g: 0x6aff6a });
sp(6, 'cryptbat', 'Crypt Bat', 'pack', 'bat', 0x2a2228, 0xa03040, { sz: 0.4, fly: true, hit: { st: 'bleed', ch: 0.2, n: 2 } });
sp(6, 'bonehulk', 'Bone Hulk', 'brute', 'skeleton', 0xc8c0a0, 0x4a4030, { sz: 1.0, hp: 22, imm: ['poison', 'bleed'] });
// 7 — Clockwork
sp(7, 'clocksoldier', 'Clockwork Soldier', 'brute', 'construct', 0xb08a40, 0x5a4a30, { sz: 0.8, arm: 3, imm: ['poison', 'bleed'] });
sp(7, 'drone', 'Buzz Drone', 'skirmisher', 'drone', 0xc0a050, 0x6ad0ff, { sz: 0.4, fly: true, imm: ['poison', 'bleed'], g: 0x6ad0ff });
sp(7, 'sentry', 'Steam Sentry', 'archer', 'turret', 0x8a7040, 0xff5040, { sz: 0.7, bolt: 'bolt', still: true, arm: 3, r: 6, imm: ['poison', 'bleed'] });
sp(7, 'gearhound', 'Gearhound', 'pack', 'quad', 0x9a7a40, 0x3a3020, { sz: 0.55, imm: ['poison', 'bleed'], grp: [2, 4] });
sp(7, 'tinker', 'Tinker Gnome', 'healer', 'biped', 0x6a4a3a, 0x40c0ff, { sz: 0.5 });
sp(7, 'steamgolem', 'Steam Golem', 'tank', 'construct', 0x5a5048, 0xd0d0d0, { sz: 1.0, arm: 5, imm: ['poison', 'bleed'] });
sp(7, 'springjack', 'Springjack', 'charger', 'construct', 0xc09040, 0xff4040, { sz: 0.6, spd: 110, imm: ['poison', 'bleed'] });
// 8 — Abyss
sp(8, 'icewraith', 'Ice Wraith', 'caster', 'wraith', 0xa0d0ff, 0xffffff, { sz: 0.7, bolt: 'frost', hit: { st: 'frozen', ch: 0.25, n: 1 }, fly: true, imm: ['frozen'], g: 0xa0e0ff });
sp(8, 'frosttroll', 'Frost Troll', 'brute', 'biped', 0x6a8aa0, 0xd0f0ff, { sz: 1.0, hp: 20, regen: 0.04, imm: ['frozen'] });
sp(8, 'snowwolf', 'Snow Wolf', 'pack', 'quad', 0xd8e0e8, 0x6a7a8a, { sz: 0.6, grp: [2, 4], imm: ['frozen'] });
sp(8, 'iceelemental', 'Ice Elemental', 'tank', 'crystal', 0x9ad0f0, 0xffffff, { sz: 0.9, arm: 5, imm: ['frozen', 'poison', 'bleed'], g: 0x9ae0ff });
sp(8, 'rimebat', 'Rime Bat', 'skirmisher', 'bat', 0x6a8ab0, 0xd0f0ff, { sz: 0.45, fly: true, hit: { st: 'frozen', ch: 0.12, n: 1 } });
sp(8, 'yeti', 'Abyss Yeti', 'charger', 'biped', 0xe0e8f0, 0x4a5a7a, { sz: 1.0, hp: 18, imm: ['frozen'] });
sp(8, 'frostmage', 'Rime Courtier', 'summoner', 'biped', 0x4a6aaa, 0xd0f0ff, { sz: 0.7, sum: 'snowwolf', bolt: 'frost', g: 0xa0d8ff });
// 9 — Vault
sp(9, 'voidstalker', 'Void Stalker', 'skirmisher', 'quad', 0x1a1030, 0xa070ff, { sz: 0.6, phase: true, g: 0x9a6aff });
sp(9, 'starjelly', 'Star Jelly', 'healer', 'jelly', 0x6a8aff, 0xffd0ff, { sz: 0.6, fly: true, g: 0xb0b0ff });
sp(9, 'sentinel', 'Astral Sentinel', 'tank', 'construct', 0x2a2a4a, 0xc0d0ff, { sz: 1.0, arm: 6, imm: ['poison', 'bleed'], g: 0xa0b0ff });
sp(9, 'gazer', 'Gazer', 'caster', 'eye', 0x6a3a6a, 0xff4a8a, { sz: 0.6, bolt: 'beam', fly: true, hit: { st: 'mark', ch: 0.5, n: 4 }, g: 0xff4a8a });
sp(9, 'riftimp', 'Rift Imp', 'bomber', 'imp', 0x4a2a8a, 0xd0a0ff, { sz: 0.45, blast: 'void', g: 0xc080ff });
sp(9, 'nebula', 'Nebula Weaver', 'summoner', 'jelly', 0x3a2a6a, 0xff9ad0, { sz: 0.75, fly: true, sum: 'riftimp', g: 0xff9ad0 });
sp(9, 'starseer', 'Starseer', 'archer', 'biped', 0x2a2a5a, 0xffe08a, { sz: 0.7, bolt: 'star', r: 6 });
// 10 — Heart of Night
sp(10, 'shade', 'Shade', 'skirmisher', 'wraith', 0x0a0810, 0x6a5a8a, { sz: 0.7, fly: true, phase: true, hit: { st: 'weak', ch: 0.3, n: 3 } });
sp(10, 'hushknight', 'Hush Knight', 'tank', 'biped', 0x1a1820, 0xa080ff, { sz: 0.95, arm: 7, g: 0x8a6aff });
sp(10, 'nightmare', 'Nightmare', 'charger', 'quad', 0x0a0a10, 0xff3a6a, { sz: 0.9, spd: 115, g: 0xff3a6a });
sp(10, 'hollowed', 'The Hollowed', 'pack', 'biped', 0x2a2830, 0xffd0a0, { sz: 0.7, grp: [3, 4] });
sp(10, 'duskweaver', 'Duskweaver', 'caster', 'spider', 0x1a1020, 0xc070ff, { sz: 0.7, bolt: 'shadow', hit: { st: 'root', ch: 0.4, n: 2 }, g: 0xb060ff });
sp(10, 'gloom', 'Gloom', 'bomber', 'blob', 0x0a0a14, 0x8a6aff, { sz: 0.55, blast: 'void' });
sp(10, 'lampeater', 'Lampeater', 'brute', 'quad', 0x20181c, 0xffe0a0, { sz: 1.0, hp: 20, oilDrain: 6, g: 0xffd080 });

// Allies & specials (not in any bestiary).
sp(0, 'captive', 'Wayfarer', 'ally', 'biped', 0x5a6a8a, 0xf0d0a0, { sz: 0.7 });
sp(0, 'nest', 'Nest', 'nest', 'nest', 0x4a3a2a, 0xa06040, { sz: 0.9 });
sp(0, 'mimic', 'Mimic', 'ambusher', 'mimic', 0x7a5a2a, 0xffd060, { sz: 0.75, hp: 18, xp: 14 });

export const SPECIES = S;

// ------------------------------------------------------------------ Elites

export const ELITE_AFFIXES = {
    swift:      { n: 'the Swift', d: 'moves and strikes twice as fast' },
    vampiric:   { n: 'the Bloodthirsty', d: 'heals from the wounds it deals' },
    armored:    { n: 'the Ironhide', d: 'heavily armoured' },
    burning:    { n: 'the Burning', d: 'its blows set you alight' },
    frostbound: { n: 'the Frostbound', d: 'its blows can freeze you solid' },
    thorned:    { n: 'the Thorned', d: 'hurts whoever strikes it' },
    splitting:  { n: 'the Many', d: 'splits in two when slain' },
    regen:      { n: 'the Undying', d: 'regenerates quickly' },
    volatile:   { n: 'the Volatile', d: 'explodes when slain' },
    phasing:    { n: 'the Phantom', d: 'blinks to your side' },
};
const ELITE_KEYS = Object.keys(ELITE_AFFIXES);

const SYL_A = ['Gr', 'Sk', 'Vr', 'Mor', 'Th', 'Kh', 'Dr', 'Zh', 'Bl', 'Sn', 'Gl', 'Ul', 'Rh', 'Ash', 'Wex', 'Nim', 'Or', 'Fen', 'Kol', 'Sar'];
const SYL_B = ['uk', 'ell', 'ax', 'ith', 'og', 'ra', 'ess', 'un', 'ix', 'or', 'ash', 'ek', 'yl', 'ag', 'oth', 'iv', 'ul', 'en'];
const SYL_C = ['', '', 'a', 'o', 'is', 'ar', 'el', 'um', 'ok'];
export function eliteName(rng) {
    return rng.pick(SYL_A) + rng.pick(SYL_B) + rng.pick(SYL_C);
}

// ------------------------------------------------------------------ Scaling

/** Health multiplier at a depth. Quadratic so relic- and perk-stacked heroes still meet resistance late. */
export const hpScale = (L) => 1 + 0.15 * (L - 1) + 0.0009 * (L - 1) * (L - 1);
export const dmgScale = (L) => (1 + 0.135 * (L - 1)) * WORLD_DMG[Math.min(9, Math.floor((L - 1) / 10))];
/** Per-world damage trim, found by bot runs: relics and perks compound faster than a linear curve. */
const WORLD_DMG = [1.05, 1.05, 1.05, 1.0, 1.0, 0.95, 0.92, 0.84, 0.86, 0.8];

/** Build a monster actor. Pure data — the view builds its model from `sp`, `seed` and `elite`. Ids come from `run.nextId`. */
export function makeMonster(run, spId, x, y, L, rng, opts = {}) {
    const s = S[spId];
    if (!s) throw new Error('unknown species ' + spId);
    const jit = opts.boss ? 1 : rng.range(0.9, 1.12);
    const m = {
        id: run.nextId++, sp: spId, name: s.n, x, y, lvl: L,
        hp: 1, hpMax: 1,
        dmg: [Math.max(1, Math.round(s.dmg[0] * dmgScale(L))), Math.max(1, Math.round(s.dmg[1] * dmgScale(L)))],
        acc: s.acc + Math.round(L * 0.85), eva: s.eva + Math.round(L * 0.45),
        arm: Math.round(s.arm * (1 + (L - 1) * 0.05)),
        spd: s.spd, energy: rng.int(0, 99), arch: s.a,
        r: s.r || 0, st: {}, awake: false, seen: false, home: { x, y },
        seed: rng.int(0, 1e9), size: (s.sz || 0.6) * (opts.boss ? 1 : rng.range(0.92, 1.1)),
        xp: Math.round(s.xp * (1 + 0.1 * (L - 1))), aff: [], ai: { cd: rng.int(0, 2) },
    };
    m.hpMax = m.hp = Math.max(1, Math.round(s.hp * hpScale(L) * jit));
    if (s.a === 'ambusher') { m.dormant = true; m.disguise = spId === 'mimic' ? 'chest' : 'burrow'; }
    if (s.a === 'nest') { m.still = true; m.spd = 100; }
    if (s.still) m.still = true;
    if (opts.elite) makeElite(m, rng, opts.affixes);
    return m;
}

export function makeElite(m, rng, affixes) {
    const n = affixes ? affixes.length : (rng.chance(0.35) ? 2 : 1);
    const pool = rng.shuffle(ELITE_KEYS.slice());
    m.aff = affixes || pool.slice(0, n);
    m.elite = true;
    m.hpMax = m.hp = Math.round(m.hpMax * 2.3);
    m.dmg = [Math.round(m.dmg[0] * 1.3), Math.round(m.dmg[1] * 1.3)];
    m.acc += 4; m.xp *= 3;
    m.size *= 1.18;
    m.ename = eliteName(rng);
    m.name = `${m.ename} ${ELITE_AFFIXES[m.aff[0]].n}`;
    if (m.aff.includes('swift')) m.spd = Math.min(220, Math.round(m.spd * 1.8));
    if (m.aff.includes('armored')) m.arm += 3 + Math.round(m.lvl * 0.35);
    return m;
}

/** Which species may spawn on a floor: a world's bestiary unlocks over its first few floors. */
export function spawnTable(world, floorInWorld, bestiary) {
    const unlocked = Math.min(bestiary.length, 3 + Math.floor((floorInWorld + 1) / 2));
    const tbl = {};
    bestiary.slice(0, unlocked).forEach((id, i) => {
        const a = S[id].a;
        tbl[id] = a === 'pack' ? 6 : a === 'summoner' || a === 'healer' ? 2.5 : a === 'bomber' ? 3 : a === 'ambusher' ? 2 : 5 - i * 0.2;
    });
    return tbl;
}
