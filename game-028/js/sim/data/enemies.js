// Foes and the groups they come in. Abilities use the same shape as the party's (see party.js), plus:
//   w     weight when the AI picks freely
//   when  'noBuff' (only if the status isn't on already), 'below:0.5' (HP share), 'deadAlly' (an ally to raise)
//   cd    turns before it may be used again
//   tell  a line the stage shows the turn before (the Lich's Void Eclipse)
// A foe with `acts: 2` takes two turns every round (the bosses).

export const ENEMIES = {
    slime: {
        name: 'Forest Slime', hp: 34, atk: 9, def: 3, spd: 5, xp: 10, gold: 6,
        loot: [{ id: 'slime_core', p: 0.7 }],
        abilities: [
            { id: 'blob', name: 'Blob', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'bash' },
            { id: 'goo', name: 'Sticky Goo', kind: 'phys', power: 0.6, target: 'foe', fx: [{ s: 'slow', p: 0.6, t: 2 }], w: 1, anim: 'goo' },
        ],
    },
    forest_wolf: {
        name: 'Forest Wolf', hp: 44, atk: 12, def: 5, spd: 13, xp: 15, gold: 8,
        loot: [{ id: 'wolf_pelt', p: 0.5 }, { id: 'fang', p: 0.3 }],
        abilities: [
            { id: 'bite', name: 'Bite', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'claw' },
            { id: 'howl', name: 'Howl', kind: 'buff', target: 'self', fx: [{ s: 'atkup', p: 1, t: 3 }], w: 1, when: 'noBuff', anim: 'howl' },
        ],
    },
    bandit: {
        name: 'Thornwood Bandit', hp: 60, atk: 14, def: 8, spd: 10, xp: 22, gold: 18,
        loot: [{ id: 'potion', p: 0.45 }, { id: 'iron_dagger', p: 0.1 }],
        abilities: [
            { id: 'cut', name: 'Cut', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'slash' },
            { id: 'dirty_blade', name: 'Dirty Blade', kind: 'phys', power: 1.1, target: 'foe', fx: [{ s: 'poison', p: 0.5, t: 3 }], w: 1, anim: 'slash' },
        ],
    },
    academy_wisp: {
        name: 'Academy Wisp', hp: 40, atk: 12, def: 4, spd: 14, xp: 14, gold: 10,
        loot: [{ id: 'ether', p: 0.25 }],
        abilities: [
            { id: 'spark', name: 'Spark', kind: 'magic', power: 1.0, target: 'foe', w: 3, anim: 'spark' },
            { id: 'flicker', name: 'Flicker', kind: 'buff', target: 'self', fx: [{ s: 'dodge', p: 1, t: 2 }], w: 1, when: 'noBuff', anim: 'flicker' },
        ],
    },
    lich_shard: {
        name: 'Lich Shard', hp: 78, atk: 16, def: 10, spd: 12, xp: 32, gold: 22,
        loot: [{ id: 'soul_gem', p: 0.5 }],
        abilities: [
            { id: 'frost_ray', name: 'Frost Ray', kind: 'magic', power: 1.0, target: 'foe', w: 3, anim: 'ice' },
            { id: 'soul_rend', name: 'Soul Rend', kind: 'magic', power: 1.3, target: 'foe', mpDrain: 0.5, w: 2, anim: 'drain' },
        ],
    },
    corrupted_knight: {
        name: 'Corrupted Knight', hp: 96, atk: 19, def: 14, spd: 8, xp: 40, gold: 26,
        loot: [{ id: 'potion', p: 0.4 }, { id: 'chain_mail', p: 0.08 }],
        abilities: [
            { id: 'tainted_blade', name: 'Tainted Blade', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'slash' },
            { id: 'dark_smite', name: 'Dark Smite', kind: 'magic', power: 1.3, target: 'foe', fx: [{ s: 'weak', p: 0.4, t: 2 }], w: 1, anim: 'shadow' },
        ],
    },
    golem: {
        name: 'Stone Golem', hp: 240, atk: 27, def: 22, spd: 4, xp: 55, gold: 30,
        loot: [{ id: 'stone_heart', p: 0.6 }],
        abilities: [
            { id: 'crush', name: 'Crush', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'bash' },
            { id: 'ground_slam', name: 'Ground Slam', kind: 'phys', power: 0.7, target: 'foes', w: 1, anim: 'quake' },
        ],
    },
    korvas: {
        name: 'Korvas the Fallen', hp: 620, atk: 43, def: 18, spd: 9, xp: 240, gold: 120, boss: true, acts: 2, art: 'por-korvas',
        loot: [{ id: 'runic_blade', p: 1 }],
        abilities: [
            { id: 'oathbreaker', name: 'Oathbreaker Strike', kind: 'phys', power: 1.1, target: 'foe', w: 3, anim: 'slash' },
            { id: 'corrupt_smite', name: 'Corrupt Smite', kind: 'magic', power: 1.45, target: 'foe', fx: [{ s: 'weak', p: 0.6, t: 2 }], w: 2, anim: 'shadow' },
            { id: 'dark_judgment', name: 'Dark Judgment', kind: 'magic', power: 0.8, target: 'foes', w: 2, cd: 2, anim: 'ritual' },
            { id: 'fallen_oath', name: 'Fallen Oath', kind: 'buff', target: 'self', fx: [{ s: 'atkup', p: 1, t: 3 }], w: 4, when: 'below:0.5', cd: 4, anim: 'howl' },
        ],
    },
    aethermoor_lich: {
        name: 'Vaelthas, the Lich', hp: 1450, atk: 50, def: 22, spd: 13, xp: 0, gold: 0, boss: true, acts: 2, art: 'por-vaelthas',
        loot: [{ id: 'lich_crown', p: 1 }],
        abilities: [
            { id: 'deathbolt', name: 'Deathbolt', kind: 'magic', power: 1.15, target: 'foe', w: 3, anim: 'shadow' },
            { id: 'wail', name: 'Wail of Ages', kind: 'magic', power: 0.7, target: 'foes', fx: [{ s: 'slow', p: 0.35, t: 2 }], w: 2, cd: 2, anim: 'wail' },
            { id: 'reanimate', name: 'Reanimate', kind: 'raise', target: 'deadAlly', w: 6, when: 'deadAlly', cd: 3, anim: 'raise' },
            { id: 'void_eclipse', name: 'Void Eclipse', kind: 'magic', power: 1.35, target: 'foes', w: 9, when: 'below:0.4', cd: 3, tell: 'Vaelthas gathers the void. Brace yourselves!', anim: 'void' },
        ],
    },
};

/** Encounter groups: lists of foes. A map's table picks one by weight. */
export const GROUPS = {
    slimes1: ['slime'], slimes2: ['slime', 'slime'], wolf1: ['forest_wolf'], slime_wolf: ['slime', 'forest_wolf'],
    wolves2: ['forest_wolf', 'forest_wolf'], bandit1: ['bandit'], bandits2: ['bandit', 'bandit'], wolf_bandit: ['forest_wolf', 'bandit'],
    shard1: ['lich_shard'], shard_wolf: ['lich_shard', 'forest_wolf'],
    wisp1: ['academy_wisp'], wisps2: ['academy_wisp', 'academy_wisp'], wisp_slime: ['academy_wisp', 'slime'], wisps3: ['academy_wisp', 'academy_wisp', 'academy_wisp'],
    knight1: ['corrupted_knight'], knights2: ['corrupted_knight', 'corrupted_knight'], knight_wolf: ['corrupted_knight', 'forest_wolf'],
    golem1: ['golem'], shard_bandit: ['lich_shard', 'bandit'], shards2: ['lich_shard', 'lich_shard'], golem_shard: ['golem', 'lich_shard'],
    shard_knight: ['lich_shard', 'corrupted_knight'],
    // fixed fights
    ambush: ['bandit', 'bandit'],
    chapel_guard: ['corrupted_knight', 'corrupted_knight'],
    boss_korvas: ['corrupted_knight', 'korvas'],
    gate_golem: ['golem', 'golem'],
    boss_lich: ['lich_shard', 'aethermoor_lich', 'lich_shard'],
};
