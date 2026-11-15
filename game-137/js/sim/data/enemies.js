// The Cubeborn: voxel monsters from the Lattice. Every one bursts into voxels when it dies.
// drops: how many voxels, and the weights of each colour.

export const ENEMIES = {
    mite: {
        name: 'Mite', hp: 12, speed: 4.3, r: 0.38, touch: 6, drops: 3,
        mix: { red: 7, gold: 1, blue: 1, green: 0.3 }, color: 0xff4f7a,
    },
    brute: {
        name: 'Brute', hp: 70, speed: 2.3, r: 0.85, touch: 15, drops: 10, chew: 3,
        mix: { red: 5, gold: 3, blue: 1.5, green: 1 }, color: 0x7a5cff,
    },
    spitter: {
        name: 'Spitter', hp: 26, speed: 2.9, r: 0.5, touch: 5, drops: 5, keep: 6.5,
        shot: { rate: 0.5, dmg: 9, speed: 8, life: 2.6 },
        mix: { red: 5, gold: 2, blue: 2, green: 0.5 }, color: 0x2bd6a0,
    },
    boomer: {
        name: 'Boomer', hp: 18, speed: 3.7, r: 0.5, touch: 0, drops: 6, boom: { radius: 2.1, dmg: 20, fuse: 0.45, terrain: 6 },
        mix: { red: 5, gold: 2, blue: 1, green: 0.4 }, color: 0xffa62b,
    },
};

/** Boss kaiju. One AI, three bodies: each has its own attacks and numbers. */
export const BOSSES = {
    behemoth: {
        name: 'Prism Behemoth', hp: 1500, r: 1.9, speed: 2.0, touch: 22, drops: 70,
        attacks: ['ring', 'charge', 'summon'], gap: 2.6, color: 0x7de8ff,
        mix: { red: 5, gold: 4, blue: 1, green: 1 },
    },
    centipede: {
        name: 'Rust Centipede', hp: 2600, r: 2.0, speed: 2.4, touch: 24, drops: 90,
        attacks: ['charge', 'ring', 'stomp', 'summon'], gap: 2.2, color: 0xff7a3d,
        mix: { red: 5, gold: 4, blue: 1, green: 1 },
    },
    queen: {
        name: 'Lattice Queen', hp: 4200, r: 2.3, speed: 2.2, touch: 28, drops: 140,
        attacks: ['ring', 'summon', 'charge', 'stomp', 'spiral'], gap: 1.9, color: 0xff3df0,
        mix: { red: 5, gold: 5, blue: 1, green: 1.5 },
    },
};

export const BOSS_ATTACK = {
    ring: { shots: 18, dmg: 10, speed: 7.5, life: 3.2, wind: 0.6 },
    spiral: { shots: 30, dmg: 9, speed: 7, life: 3.5, wind: 0.5, over: 1.5 },
    charge: { speed: 3.2, time: 1.1, wind: 0.8 },
    stomp: { radius: 4.2, dmg: 22, wind: 1.0, terrain: 8 },
    summon: { count: 6, kind: 'mite', wind: 0.6 },
};

export const HIVE = { hp: 520, spawnEvery: 3.2, spawnNear: 4, drops: 40, mix: { red: 4, gold: 6, blue: 1, green: 1 } };

/** Terrain materials. hp is per layer; voxels is how many fly out when a layer breaks. */
export const MATS = {
    stone: { hp: 22, voxels: 3, gold: 0.08, color: 0x8b8fa8 },
    crystal: { hp: 16, voxels: 3, gold: 0.25, color: 0x7de8ff },
    rust: { hp: 28, voxels: 3, gold: 0.12, color: 0xc0623a },
    neon: { hp: 34, voxels: 4, gold: 0.15, color: 0x5a4fd8 },
};
