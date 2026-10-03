/**
 * bestiary.js — monster archetypes as pure data (no three.js). The level
 * generator reads costs and flags from here; monsters.js reads everything.
 *
 * An archetype is a body plan + a behaviour. Each run rolls a *species* per
 * archetype (see species.js): its own name, colours, proportions, horns,
 * eyes, voice and small stat variations.
 *
 * attack kinds:
 *   hitscan   — instant bullets with spread (husk)
 *   proj      — one or more projectiles (proj: type, count, spread)
 *   melee     — bite/claw within reach
 *   charge    — fly/run at the player and slam (wisp, hound lunge)
 *   homing    — homing missiles (revenant)
 *   flame     — line-of-sight pillar of fire on the target (hierophant)
 */
export const ARCHETYPES = {
    husk: {
        cls: 'Thrall', plan: 'biped', hp: 30, speed: 3.4, radius: 0.4, height: 1.8, cost: 1, painChance: 0.8,
        sight: 28, reaction: [0.6, 1.1], score: 100,
        attacks: [{ kind: 'hitscan', range: 26, dmg: [4, 9], shots: 3, spread: 4.5, cooldown: [1.4, 2.2], windup: 0.35 }],
        melee: null, blood: 0xaa1010,
    },
    imp: {
        cls: 'Cinderling', plan: 'hunch', hp: 60, speed: 4.4, radius: 0.42, height: 1.75, cost: 2, painChance: 0.7,
        sight: 30, reaction: [0.4, 0.9], score: 200,
        attacks: [{ kind: 'proj', proj: 'fireball', range: 32, count: 1, spread: 0, speed: 17, dmg: [10, 18], cooldown: [1.3, 2.1], windup: 0.45 }],
        melee: { dmg: [6, 14], reach: 1.6, cooldown: 0.9 }, blood: 0xb31a0a,
    },
    hound: {
        cls: 'Maw Hound', plan: 'quad', hp: 150, speed: 8.2, radius: 0.62, height: 1.35, cost: 3, painChance: 0.6,
        sight: 26, reaction: [0.2, 0.5], score: 300,
        attacks: [{ kind: 'lunge', range: 7, dmg: [14, 24], cooldown: [1.4, 2.0], windup: 0.3 }],
        melee: { dmg: [12, 22], reach: 1.9, cooldown: 0.8 }, blood: 0xa80f2a,
    },
    wisp: {
        cls: 'Wailing Skull', plan: 'skull', hp: 50, speed: 5.0, radius: 0.36, height: 0.7, cost: 1.5, fly: true, painChance: 1,
        sight: 28, reaction: [0.3, 0.7], score: 150, hover: 1.6,
        attacks: [{ kind: 'charge', range: 18, dmg: [8, 16], speed: 19, cooldown: [2.0, 3.0], windup: 0.5 }],
        melee: null, blood: 0xffaa33,
    },
    gazer: {
        cls: 'Gazer', plan: 'orb', hp: 260, speed: 3.0, radius: 0.85, height: 1.7, cost: 5, fly: true, painChance: 0.45,
        sight: 34, reaction: [0.5, 1.0], score: 500, hover: 2.4,
        attacks: [{ kind: 'proj', proj: 'orb', range: 36, count: 1, spread: 0, speed: 13, dmg: [18, 30], cooldown: [1.6, 2.6], windup: 0.6 }],
        melee: { dmg: [10, 22], reach: 2.0, cooldown: 1.0 }, blood: 0x3050ff,
    },
    skitter: {
        cls: 'Skitterer', plan: 'spider', hp: 170, speed: 5.8, radius: 0.62, height: 1.1, cost: 4, painChance: 0.5,
        sight: 32, reaction: [0.3, 0.6], score: 450,
        attacks: [{ kind: 'proj', proj: 'spit', range: 30, count: 5, burst: 0.09, spread: 3, speed: 24, dmg: [5, 9], cooldown: [1.8, 2.6], windup: 0.35 }],
        melee: null, blood: 0x6aff2a,
    },
    brute: {
        cls: 'Brute', plan: 'biped', hp: 520, speed: 3.8, radius: 0.78, height: 2.7, cost: 8, painChance: 0.3,
        sight: 34, reaction: [0.5, 0.9], score: 1000,
        attacks: [
            { kind: 'proj', proj: 'bolt', range: 34, count: 3, spread: 9, speed: 18, dmg: [16, 26], cooldown: [1.8, 2.6], windup: 0.6 },
            { kind: 'slam', range: 3.6, dmg: [20, 35], radius: 4.0, cooldown: [2.2, 3.0], windup: 0.55 },
        ],
        melee: { dmg: [18, 30], reach: 2.3, cooldown: 1.2 }, blood: 0x2aa83a,
    },
    revenant: {
        cls: 'Revenant', plan: 'skeleton', hp: 320, speed: 5.4, radius: 0.46, height: 2.45, cost: 7, painChance: 0.45,
        sight: 36, reaction: [0.3, 0.7], score: 900,
        attacks: [{ kind: 'homing', proj: 'missile', range: 36, count: 2, spread: 14, speed: 12, dmg: [14, 24], cooldown: [2.2, 3.2], windup: 0.5 }],
        melee: { dmg: [14, 28], reach: 1.9, cooldown: 0.9 }, blood: 0xd8d0b0,
    },
    hierophant: {
        cls: 'Hierophant', plan: 'robed', hp: 650, speed: 6.2, radius: 0.5, height: 2.4, cost: 12, painChance: 0.15,
        sight: 40, reaction: [0.4, 0.8], score: 2000, raises: true,
        attacks: [{ kind: 'flame', range: 30, dmg: [30, 45], radius: 3.2, cooldown: [3.5, 5.0], windup: 1.4 }],
        melee: null, blood: 0xffcf6a,
    },
    juggernaut: {
        cls: 'Juggernaut', plan: 'biped', hp: 2400, speed: 3.6, radius: 0.95, height: 3.7, cost: 30, painChance: 0.08,
        sight: 44, reaction: [0.5, 1.0], score: 5000, heavy: true,
        attacks: [{ kind: 'proj', proj: 'rocket', range: 44, count: 1, spread: 2, speed: 22, dmg: [30, 50], splash: 70, radius: 3.6, cooldown: [0.6, 1.0], volley: 3, volleyGap: 0.32, windup: 0.4 }],
        melee: null, blood: 0x8a1010,
    },

    // ---------------- Guardians ----------------
    overseer: {
        cls: 'Guardian', plan: 'mech', hp: 3400, speed: 3.8, radius: 1.1, height: 3.9, cost: 0, painChance: 0.0,
        sight: 60, reaction: [0.2, 0.4], score: 20000, boss: true, heavy: true, title: 'OVERSEER KELL',
        attacks: [
            { kind: 'hitscan', range: 40, dmg: [5, 8], shots: 14, burst: 0.07, spread: 3.5, cooldown: [2.0, 2.8], windup: 0.6 },
            { kind: 'proj', proj: 'rocket', range: 50, count: 1, spread: 4, speed: 20, dmg: [25, 40], splash: 60, radius: 3.4, volley: 4, volleyGap: 0.28, cooldown: [2.6, 3.4], windup: 0.5 },
        ],
        melee: null, blood: 0xff9a3a,
    },
    mother: {
        cls: 'Guardian', plan: 'mother', hp: 5200, speed: 2.2, radius: 1.5, height: 4.2, cost: 0, painChance: 0.0,
        sight: 60, reaction: [0.2, 0.4], score: 40000, boss: true, heavy: true, title: 'THE FURNACE MOTHER',
        attacks: [
            { kind: 'proj', proj: 'fireball', range: 50, count: 9, spread: 70, speed: 15, dmg: [12, 18], cooldown: [2.0, 2.8], windup: 0.7 },
            { kind: 'birth', range: 60, cooldown: [6.0, 8.0], windup: 1.0, spawn: ['imp', 'wisp', 'imp'] },
            { kind: 'wave', range: 18, dmg: [20, 30], cooldown: [4.0, 5.0], windup: 0.9 },
        ],
        melee: null, blood: 0xff6a1a,
    },
    archon: {
        cls: 'Archon', plan: 'archon', hp: 9000, speed: 2.6, radius: 1.8, height: 5.5, cost: 0, fly: true, painChance: 0.0,
        sight: 80, reaction: [0.2, 0.4], score: 100000, boss: true, heavy: true, hover: 3.2, title: 'THE ARCHON',
        attacks: [
            { kind: 'proj', proj: 'orb', range: 60, count: 16, spread: 360, speed: 11, dmg: [14, 20], cooldown: [2.2, 3.0], windup: 0.6, ring: true },
            { kind: 'homing', proj: 'missile', range: 60, count: 4, spread: 40, speed: 11, dmg: [12, 20], cooldown: [3.0, 3.8], windup: 0.6 },
            { kind: 'beam', range: 60, dmg: [40, 55], cooldown: [6.0, 7.0], windup: 1.2, time: 2.8 },
            { kind: 'birth', range: 60, cooldown: [9.0, 11.0], windup: 1.0, spawn: ['wisp', 'imp', 'gazer'] },
        ],
        melee: null, blood: 0xeeeeff,
    },
    pylon: {
        cls: 'Pylon', plan: 'crystal', hp: 520, speed: 0, radius: 0.6, height: 3.0, cost: 0, painChance: 0, static: true,
        sight: 0, reaction: [1, 1], score: 2500, attacks: [], melee: null, blood: 0xc0a0ff,
    },
};

/** Projectile visual + physics table. */
export const PROJECTILES = {
    fireball:   { color: 0xff7a22, core: 0xffe2a0, size: 0.32, light: 0xff6a1a, gravity: 0, trail: 'fire' },
    orb:        { color: 0xff3a6a, core: 0xffd0e0, size: 0.42, light: 0xff2a5a, gravity: 0, trail: 'spark' },
    spit:       { color: 0x8aff3a, core: 0xeaffc0, size: 0.18, light: 0x66ff22, gravity: 0, trail: null },
    bolt:       { color: 0x3aff6a, core: 0xd0ffe0, size: 0.38, light: 0x22ff55, gravity: 0, trail: 'spark' },
    missile:    { color: 0xffaa55, core: 0xffffff, size: 0.22, light: 0xff8833, gravity: 0, trail: 'smoke', homing: 2.2 },
    rocket:     { color: 0xffaa44, core: 0xffffff, size: 0.2, light: 0xff8822, gravity: 0, trail: 'smoke' },
    plasma:     { color: 0x3ac8ff, core: 0xe8faff, size: 0.2, light: 0x2aa8ff, gravity: 0, trail: null },
    singularity:{ color: 0x9a6aff, core: 0x000000, size: 0.75, light: 0x8a4aff, gravity: 0, trail: 'void' },
};

export const ELITE_MODS = [
    { id: 'burning',  name: 'Burning',  tint: [1.6, 0.7, 0.3], hp: 1.4, dmg: 1.2, speed: 1.0, desc: 'leaves fire, explodes on death' },
    { id: 'armored',  name: 'Ironhide', tint: [0.7, 0.8, 1.0], hp: 2.2, dmg: 1.0, speed: 0.9, desc: 'takes half splash damage' },
    { id: 'swift',    name: 'Swift',    tint: [0.6, 1.4, 1.5], hp: 1.2, dmg: 1.0, speed: 1.45, desc: 'fast' },
    { id: 'vampiric', name: 'Vampiric', tint: [1.4, 0.3, 0.6], hp: 1.5, dmg: 1.15, speed: 1.05, desc: 'heals when it hurts you' },
    { id: 'splitting',name: 'Brood',    tint: [1.2, 1.3, 0.4], hp: 1.3, dmg: 1.0, speed: 1.0, desc: 'bursts into skulls on death' },
];
