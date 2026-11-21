// Foes and the groups they come in. Abilities use the same shape as the party's (see party.js), plus:
//   w       weight when the AI picks freely
//   when    'noBuff' (only if the status isn't on already), 'below:0.5' (HP share), 'alone' (no friends left)
//   cd      turns before it may be used again
//   tell    a line the stage shows the turn before (Bertha's Gear Slam): the ability fires on the foe's next turn
//   steal   share of the party's gold taken by a hit (the thief keeps it until it falls)
//   summon  ['cogsprite', …] foes that join the fight
// `aim` says who a foe goes for: 'weakest' (the lowest HP), 'random', or nothing (a taunt, then a mix of both).
// A foe with `acts: 2` takes two turns every round.
//
// Every kind of foe plays differently: Cog Sprites swarm, Rust Crabs hide in their shells and pinch,
// Lane Bandits pick your pockets (kill one to get the gold back), Gear-Wolves howl and go for the weak,
// and Big Bertha winds up a slam, calls her cogs when hurt and loses her temper at the end.

export const ENEMIES = {
    cogsprite: {
        name: 'Cog Sprite', hp: 26, atk: 8, def: 1, spd: 12, xp: 8, gold: 6, aim: 'random',
        loot: [{ id: 'cog', p: 0.5 }, { id: 'scrap', p: 0.45 }],
        abilities: [
            { id: 'buzz', name: 'Buzz', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'claw' },
            { id: 'skitter', name: 'Skitter', kind: 'buff', target: 'self', fx: [{ s: 'dodge', p: 1, t: 2 }], w: 1, when: 'noBuff', anim: 'flicker' },
        ],
    },
    rustcrab: {
        name: 'Rust Crab', hp: 46, atk: 11, def: 6, spd: 6, xp: 14, gold: 12,
        loot: [{ id: 'scrap', p: 0.65 }, { id: 'spring', p: 0.3 }],
        abilities: [
            { id: 'snip', name: 'Snip', kind: 'phys', power: 0.9, target: 'foe', w: 2, anim: 'claw' },
            { id: 'shell_up', name: 'Shell Up', kind: 'buff', target: 'self', fx: [{ s: 'guard', p: 1, t: 2 }], w: 3, when: 'noBuff', cd: 3, anim: 'shield' },
            { id: 'pinch', name: 'Rusty Pinch', kind: 'phys', power: 1.45, target: 'foe', fx: [{ s: 'rust', p: 0.7, t: 3 }], w: 3, anim: 'claw' },
        ],
    },
    bandit: {
        name: 'Lane Bandit', hp: 58, atk: 13, def: 5, spd: 11, xp: 22, gold: 18, aim: 'weakest',
        loot: [{ id: 'scrap', p: 0.45 }, { id: 'tea', p: 0.3 }],
        abilities: [
            { id: 'jab', name: 'Jab', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'slash' },
            { id: 'pickpocket', name: 'Pickpocket', kind: 'phys', power: 0.6, target: 'foe', steal: 0.12, w: 2, cd: 3, anim: 'claw' },
        ],
    },
    gearwolf: {
        name: 'Gear-Wolf', hp: 74, atk: 16, def: 6, spd: 14, xp: 30, gold: 20, aim: 'weakest',
        loot: [{ id: 'spring', p: 0.5 }, { id: 'cog', p: 0.5 }],
        abilities: [
            { id: 'bite', name: 'Gnash', kind: 'phys', power: 1.0, target: 'foe', w: 3, anim: 'claw' },
            { id: 'howl', name: 'Clockwork Howl', kind: 'buff', target: 'party', fx: [{ s: 'atkup', p: 1, t: 3 }], w: 2, when: 'noBuff', cd: 4, anim: 'howl' },
            { id: 'pounce', name: 'Pounce', kind: 'phys', power: 1.5, target: 'foe', w: 2, cd: 2, anim: 'claw' },
        ],
    },
    bigbertha: {
        name: 'Big Bertha', hp: 640, atk: 33, def: 10, spd: 8, xp: 140, gold: 220, boss: true,
        loot: [],
        abilities: [
            { id: 'hammer', name: 'Hammer Fist', kind: 'phys', power: 1.0, target: 'foe', w: 4, anim: 'bash' },
            { id: 'steam', name: 'Steam Blast', kind: 'magic', power: 0.9, target: 'foes', w: 2, cd: 2, anim: 'steam' },
            { id: 'gear_slam', name: 'Gear Slam', kind: 'phys', power: 1.9, target: 'foes', tell: 'Big Bertha winds up her grinding arm... a huge slam is coming!', w: 3, cd: 3, anim: 'quake' },
            { id: 'shed_cogs', name: 'Shed Cogs', kind: 'summon', summon: ['cogsprite', 'cogsprite'], when: 'below:0.5', w: 6, cd: 5, anim: 'gears' },
            { id: 'temper', name: 'Lose Temper', kind: 'buff', target: 'self', fx: [{ s: 'atkup', p: 1, t: 4 }], when: 'below:0.3', w: 8, cd: 6, anim: 'howl' },
        ],
    },
};

/** What a random encounter can bring: group id → the foes. */
export const GROUPS = {
    cogs2: ['cogsprite', 'cogsprite'],
    cogs3: ['cogsprite', 'cogsprite', 'cogsprite'],
    crab: ['rustcrab'],
    crab_cog: ['rustcrab', 'cogsprite'],
    crabs: ['rustcrab', 'rustcrab'],
    bandit: ['bandit'],
    bandit_cog: ['bandit', 'cogsprite'],
    bandits: ['bandit', 'bandit'],
    wolf: ['gearwolf'],
    wolf_crab: ['gearwolf', 'rustcrab'],
    wolves: ['gearwolf', 'gearwolf'],
    wolf_bandit: ['gearwolf', 'bandit'],
    kettle_crab: ['rustcrab', 'cogsprite', 'cogsprite'],
    bertha: ['bigbertha'],
};
