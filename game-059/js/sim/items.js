/**
 * items.js — pickups, breakable props, projectile shapes and difficulty.
 */

export const ITEMS = {
    noodles: { kind: 'food', hp: 30, score: 200, name: 'NOODLE BOWL' },
    bento: { kind: 'food', hp: 60, score: 400, name: 'BENTO BOX' },
    medkit: { kind: 'food', hp: 999, score: 800, name: 'MED-KIT' },
    cell: { kind: 'energy', energy: 50, score: 200, name: 'POWER CELL' },
    chip: { kind: 'cred', cred: 50, score: 100, name: 'CRED CHIP' },
    stack: { kind: 'cred', cred: 150, score: 300, name: 'CRED STACK' },
    shard: { kind: 'cred', cred: 400, score: 800, name: 'DATA SHARD' },
    core: { kind: 'life', score: 2000, name: 'SUIT CORE' },
    pipe: { kind: 'weapon', name: 'STEEL PIPE' },
    katana: { kind: 'weapon', name: 'MONO-KATANA' },
    baton: { kind: 'weapon', name: 'SHOCK BATON' },
    knives: { kind: 'weapon', name: 'THROWING KNIVES' },
};

// What a random drop rolls into: [type, weight]
export const DROP_TABLE = [
    ['chip', 32], ['noodles', 26], ['cell', 16], ['stack', 10], ['bento', 8], ['pipe', 3], ['knives', 3], ['baton', 2],
];

export const PROPS = {
    can: { hp: 1, w: 9, h: 26, name: 'trash can' },
    crate: { hp: 2, w: 13, h: 26, name: 'crate' },
    barrel: { hp: 1, w: 10, h: 30, explosive: true, name: 'ion barrel' },
    vend: { hp: 5, w: 18, h: 58, drops: 2, name: 'vending machine' },
    cart: { hp: 3, w: 18, h: 34, drops: 2, name: 'food cart' },
    jar: { hp: 3, w: 14, h: 52, name: 'specimen jar' },
    terminal: { hp: 2, w: 12, h: 40, name: 'terminal' },
    lantern: { hp: 1, w: 8, h: 34, name: 'lantern stand' },
};

/** Collision half-sizes for projectiles: x half-width, y half-height, z tolerance. */
export const PROJ = {
    knife: { w: 8, h: 4, z: 8 },
    shuriken: { w: 6, h: 5, z: 8 },
    bullet: { w: 6, h: 3, z: 7 },
    laser: { w: 9, h: 3, z: 7 },
    pulse: { w: 12, h: 12, z: 13 },
    pulseR: { w: 12, h: 12, z: 13 },
    acid: { w: 6, h: 6, z: 10 },
    wave: { w: 10, h: 16, z: 12, ground: true },
    swordwave: { w: 10, h: 40, z: 12, ground: true },
    flame: { w: 9, h: 9, z: 12 },
    orb: { w: 9, h: 9, z: 10 },
    weapon: { w: 10, h: 10, z: 10 },
};

export const DIFFICULTY = {
    easy: { key: 'easy', name: 'Story', dmgTaken: 0.6, enemyHp: 0.85, aggr: 0.75, tokens: 1, lives: 5, continues: 99, rank: 0 },
    normal: { key: 'normal', name: 'Arcade', dmgTaken: 1, enemyHp: 1, aggr: 1, tokens: 2, lives: 3, continues: 3, rank: 1 },
    hard: { key: 'hard', name: 'Mania', dmgTaken: 1.35, enemyHp: 1.2, aggr: 1.3, tokens: 3, lives: 3, continues: 1, rank: 2 },
};
