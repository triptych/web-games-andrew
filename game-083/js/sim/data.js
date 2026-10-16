// Tables: the kingdom's forces and the road home. Pure data.

/**
 * Enemy kinds. r: hit radius (u), hp, score, quota: counts toward a march's kill quota,
 * fly: hovers off the ground (y), act: 'ground' | 'flight'.
 */
export const ENEMY = {
    // ---- Act I: the march (Battlezone's tanks, super tanks, missiles and saucer)
    footman: { act: 'ground', hp: 1, r: 1.0, score: 100, quota: true, name: 'FOOTMAN' },
    ballista: { act: 'ground', hp: 1, r: 1.8, score: 1000, quota: true, name: 'BALLISTA' },
    lancer: { act: 'ground', hp: 1, r: 1.4, score: 2000, quota: true, name: 'LANCER' },
    wizard: { act: 'ground', hp: 1, r: 1.1, score: 1500, quota: true, fly: 1.7, name: 'WIZARD' },
    troll: { act: 'ground', hp: 3, r: 1.7, score: 1200, quota: true, name: 'TROLL' },
    juggernaut: { act: 'ground', hp: 2, r: 2.4, score: 3000, quota: true, name: 'WAR WAGON' },
    wisp: { act: 'ground', hp: 1, r: 1.3, score: 5000, quota: false, fly: 3.6, name: 'WILL-O-WISP' },
    dragonbane: { act: 'ground', hp: 18, r: 4.6, score: 20000, quota: false, name: 'THE DRAGONBANE' },
    // ---- Act II: the flight (Star Wars' TIE fighters, towers, trench turrets and exhaust port)
    griffon: { act: 'flight', hp: 1, r: 2.4, score: 1000, quota: true, name: 'GRIFFON KNIGHT' },
    tower: { act: 'flight', hp: 1, r: 2.1, score: 500, name: 'MAGE TOWER' },
    spire: { act: 'flight', hp: 3, r: 2.6, score: 1500, name: 'GREAT SPIRE' },
    turret: { act: 'flight', hp: 1, r: 1.7, score: 250, name: 'WALL BALLISTA' },
    wardstone: { act: 'flight', hp: 1, r: 2.4, score: 25000, name: 'WARD STONE' },
};

/** Enemy projectiles. shootable: a fireball can knock it out of the air. */
export const FOE = {
    spear: { r: 0.5, speed: 17, life: 3.5, shootable: false, score: 0 },
    bolt: { r: 0.6, speed: 30, life: 4, shootable: false, score: 0 },
    orb: { r: 0.9, speed: 11, life: 7, shootable: true, homing: 1.4, score: 150 },
    firebolt: { r: 1.3, speed: 40, life: 7, shootable: true, homing: 0.5, score: 50 },
};

/**
 * The road home. Ground marches end when the quota of kills is met; the boss ends when it falls;
 * flight stages end on a quota (sky) or at the end of the track.
 * mix: spawn weights. maxAlive: enemies on the field at once (counting ones only).
 */
export const STAGES = [
    {
        id: 'march1', mode: 'ground', name: 'THE BORDER MARCHES',
        line: 'THE KING\'S PATROLS HUNT THE WINGLESS',
        quota: 7, maxAlive: 2, mix: { footman: 5, ballista: 3 },
    },
    {
        id: 'march2', mode: 'ground', name: 'THE BURNING FIELDS',
        line: 'KNIGHTS RIDE OUT TO MEET YOU',
        quota: 9, maxAlive: 3, mix: { footman: 3, ballista: 3, lancer: 3, wizard: 1 },
    },
    {
        id: 'march3', mode: 'ground', name: 'THE WIZARDS\' MOOR',
        line: 'THE ORDER OF THE IRON WARD CASTS ITS NETS',
        quota: 11, maxAlive: 3, mix: { footman: 2, ballista: 3, lancer: 2, wizard: 3, troll: 2 },
    },
    {
        id: 'march4', mode: 'ground', name: 'THE KING\'S ROAD',
        line: 'THE WAR ENGINES ROLL',
        quota: 12, maxAlive: 4, mix: { footman: 2, ballista: 3, lancer: 2, wizard: 2, troll: 2, juggernaut: 2 },
    },
    {
        id: 'boss', mode: 'ground', name: 'THE DRAGONBANE',
        line: 'THE ENGINE THAT BOUND YOUR WINGS',
        boss: 'dragonbane',
    },
    {
        id: 'sky', mode: 'flight', track: 'sky', name: 'THE OPEN SKY',
        line: 'THE GRIFFON KNIGHTS RISE TO MEET YOU',
        quota: 20, maxAlive: 5,
    },
    {
        id: 'ramparts', mode: 'flight', track: 'ramparts', name: 'THE RAMPARTS',
        line: 'BURN THE MAGE TOWERS',
        length: 1800,
    },
    {
        id: 'gorge', mode: 'flight', track: 'gorge', name: 'THE GORGE OF CHAINS',
        line: 'SHATTER THE WARD STONE AT ITS END',
        length: 2000,
    },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/** Seconds of each between-stage beat. */
export const BEATS = { intro: 2.6, clear: 2.6, ascend: 6.5, dead: 2.4 };
