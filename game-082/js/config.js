// BUBBLE NEBULA — tuning and constants. Shared by the sim, the view and the tests.
// Units are tiles; the sim's y grows downwards (row 0 is the ceiling, row 25 the floor).

export const VERSION = '1.0.0';
export const SAVE_KEY = 'bubble-nebula.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const W = 32;                      // columns: 0–1 and 30–31 are the side walls
export const H = 26;                      // rows: 0 is the ceiling, 25 the floor
export const LEFT = 2;                    // the playable interior is x ∈ [LEFT, RIGHT]
export const RIGHT = 30;

export const PLAYER = {
    w: 1.5, h: 1.7,
    speed: 6.6,                           // tiles/s; Rocket Boots ×1.3
    jumpV: 23.5,                          // with gravity 58: a 4.76-tile jump, platforms are 4 rows apart
    gravity: 58,
    maxFall: 12.5,
    shotCd: 0.3, rapidCd: 0.17,           // a held button repeats at ×1.5 these
    startX: 3.6, startY: 25,
    inv: 2.6,                             // invulnerable after a respawn
    dieTime: 1.8,
    stun: 0.6,                            // a nova flame stuns, it doesn't kill
};

export const BUBBLE = {
    r: 0.95,
    speed: 19,                            // the blown bubble's dash
    range: 5.2, longRange: 8.4,           // tiles it dashes before it starts to float
    rise: 2.3,                            // floating speed up
    drift: 2.4,                           // and across towards the level's air current
    emptyLife: 13,                        // an empty bubble pops by itself
    specialLife: 18,
    trapTime: 9,                          // a trapped enemy breaks out (angry) after this
    warnTime: 6,                          // and starts to shake here
    chainGap: 0.35,                       // touching bubbles pop together
    spawnGap: 1.15,                       // a bubble blown into the wall floats from there
};

export const ENEMY = {
    blip: { w: 1.5, h: 1.5, speed: 3.0, angry: 5.0 },
    spark: { w: 1.4, h: 1.5, speed: 3.4, angry: 5.4 },
    glooper: { w: 1.6, h: 1.5, speed: 2.7, angry: 4.3 },
    grunt: { w: 1.6, h: 1.7, speed: 2.3, angry: 3.9 },
    moth: { w: 1.6, h: 1.3, speed: 2.3, angry: 3.6 },
    saucer: { w: 1.9, h: 1.1, speed: 2.9, angry: 4.4 },
};
export const ENEMY_NAMES = {
    blip: 'Blip', spark: 'Spark', glooper: 'Glooper', grunt: 'Grunt', moth: 'Comet Moth', saucer: 'Saucer',
};

export const SCORE = {
    pop: 10,                              // an empty bubble
    letter: 100,
    chain: [500, 1000, 2000, 4000, 8000, 16000, 32000],   // the n-th enemy popped in one chain
    zap: [1000, 2000, 4000, 8000, 16000, 32000, 64000],   // the n-th enemy one bolt or flame kills
    bomb: 2000,
    quick: [[15, 5000], [25, 2000]],      // a sector cleared inside 15 s, 25 s
    lives: [20000, 60000],                // then every 100 000
    lifeEvery: 100000,
    heart: 100000,                        // the Nebula Heart
};

export const ITEMS = [
    { id: 'candy', name: 'Star Candy', value: 500 },
    { id: 'cheese', name: 'Moon Cheese', value: 1000 },
    { id: 'cone', name: 'Comet Cone', value: 2000 },
    { id: 'planet', name: 'Ringed Planet', value: 4000 },
    { id: 'gem', name: 'Nebula Gem', value: 8000 },
    { id: 'crown', name: 'Galaxy Crown', value: 16000 },
    { id: 'diamond', name: 'Black Diamond', value: 32000 },
    { id: 'diamond2', name: 'Singularity', value: 64000 },
];

export const POWERS = {
    boots: { name: 'Rocket Boots', text: 'run faster', w: 20 },
    long: { name: 'Long Shot', text: 'bubbles fly further', w: 20 },
    rapid: { name: 'Rapid Blower', text: 'blow faster', w: 20 },
    clock: { name: 'Stasis Clock', text: 'freezes every enemy', w: 14 },
    bomb: { name: 'Supernova', text: 'pops every enemy', w: 6 },
    warp: { name: 'Wormhole', text: 'skips three sectors', w: 3 },
};

export const LETTERS = ['N', 'E', 'B', 'U', 'L', 'A'];

export const TIMING = {
    intro: 1.5,                           // enemies drop in; you can't move yet
    clearMin: 1.6, clearMax: 5,           // after the last enemy: time to grab the loot
    warp: 1.8,                            // the scroll to the next sector
    extend: 3.2,
    hurry: 42,                            // default; each level can set its own
    wraithAfter: 9,                       // after HURRY UP!
    clock: 7,
    flame: 4,
    itemLife: 12,
    powerAt: [8, 14],                     // when a power-up may appear (s into the sector)
};

export const BOSS = { hp: 24, w: 5.2, h: 5.2, speed: 4.0, rage: 6.0, throwEvery: 3.0, orbSpeed: 5.2, zapEvery: 1.2, bubbleR: 3.3 };
