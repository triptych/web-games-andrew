// ============================================================
// Every tuning number lives here. Units: pixels and seconds.
// One tile is 16px. The simulation runs at a fixed 60Hz.
// ============================================================

export const TILE = 16;
export const STEP = 1 / 60;

// ------------------------------------------------------------ Pip
export const PHYS = {
    w: 10, h: 14,
    run: 120,            // top speed
    starRun: 150,        // with a Rainbow Star
    accGround: 900,
    decGround: 1200,
    accAir: 620,
    jumpV: 317,          // rises ~70px (4.4 tiles) with jump held
    gravUp: 720,         // while rising with jump held
    grav: 1500,          // otherwise
    maxFall: 330,
    djV: 268,            // double jump adds ~50px
    wallSlide: 60,
    wallJumpVX: 130,
    wallJumpVY: 290,
    wallLock: 0.14,      // steering locked after a wall kick
    coyote: 0.1,
    buffer: 0.1,
    poundHang: 0.12,
    poundV: 420,
    stompBounce: 220,
    stompBounceHeld: 310,
    springV: 470,        // ~8.5 tiles; the lift holds for 0.3s even without jump held
    hurtKnockX: 90, hurtKnockY: 180,
    invuln: 1.4,
};

// Gadgets, in the order the bosses hand them back.
export const GADGETS = ['boots', 'frost', 'mitts', 'rocket'];
export const GADGET_INFO = {
    boots: { name: 'SPRING BOOTS', lines: ['PRESS JUMP IN MID-AIR', 'TO JUMP AGAIN!'], icon: 'i_boots' },
    frost: { name: 'FROST RAY', lines: ['FREEZE FOES INTO ICE BLOCKS', 'AND BUBBLE BLOCKS SOLID.', 'SWAP WEAPONS WITH C / SWAP'], icon: 'i_frost' },
    mitts: { name: 'STICKY MITTS', lines: ['SLIDE DOWN WALLS AND', 'JUMP OFF THEM TO CLIMB!'], icon: 'i_mitts' },
    rocket: { name: 'ROCKET POPPER', lines: ['BIG SLOW BOOMS.', 'BLASTS RED ROCK AWAY!'], icon: 'i_rocket' },
    spread: { name: 'SPREAD SHOT', lines: ['THREE POPS AT ONCE!', 'SWAP WEAPONS WITH C / SWAP'], icon: 'i_spread' },
    heart: { name: 'HEART CONTAINER', lines: ['+1 MAX HEART!'], icon: 'i_heart' },
    chip: { name: 'POWER CHIP', lines: ['ALL WEAPONS HIT HARDER!'], icon: 'i_chip' },
};

/** Gadgets a world's levels are allowed to assume you own. */
export function baselineFor(world) {
    return new Set(GADGETS.slice(0, Math.max(0, world - 1)));
}

// ------------------------------------------------------------ weapons
export const WEAPONS = {
    pea:    { name: 'PEA',    rate: 6,   dmg: 1, speed: 260, life: 0.55, icon: 'i_pea' },
    spread: { name: 'SPREAD', rate: 4,   dmg: 1, speed: 240, life: 0.32, icon: 'i_spread' },
    frost:  { name: 'FROST',  rate: 3,   dmg: 1, speed: 220, life: 0.6,  icon: 'i_frost' },
    rocket: { name: 'ROCKET', rate: 1.6, dmg: 4, speed: 90,  life: 1.4,  icon: 'i_rocket', accel: 420, splash: 24 },
};
export const WEAPON_ORDER = ['pea', 'spread', 'frost', 'rocket'];
export const FREEZE_TIME = 5;
export const BUBBLE_FREEZE = 8;

// ------------------------------------------------------------ power-ups
export const POWER = {
    star: 8,
    pepper: 12,
};

// ------------------------------------------------------------ scoring
export const SCORE = {
    coin: 50, shot: 100, brick: 50, shard: 1000, boss: 10000, powerup: 1000,
    stomp: [100, 200, 400, 800, 1000],   // then 1UP
    timeBonus: 10,
};
export const COINS_PER_LIFE = 100;
export const START_LIVES = 5;
export const START_HEARTS = 3;
export const MAX_HEARTS = 8;
export const LEVEL_TIME = 300;

// ------------------------------------------------------------ worlds
export const WORLDS = [
    {
        id: 1, name: 'SPRINKLE MEADOWS', theme: 'meadow', boss: 'chompo', gadget: 'boots',
        enemies: [['bug', 5], ['snail', 3], ['bee', 2], ['frog', 2], ['chomper', 2]],
        mood: { root: 60, mode: 'major', bpm: 138, feel: 'bounce' },
    },
    {
        id: 2, name: 'FIZZY DUNES', theme: 'dunes', boss: 'sandsnake', gadget: 'frost',
        enemies: [['bug', 3], ['prickle', 3], ['cactus', 2], ['frog', 2], ['shroom', 2], ['bee', 2]],
        mood: { root: 62, mode: 'phrygianDom', bpm: 128, feel: 'swing' },
    },
    {
        id: 3, name: 'GLIMMER GROTTO', theme: 'grotto', boss: 'glimmerjaw', gadget: 'mitts',
        enemies: [['bat', 3], ['glint', 3], ['snail', 2], ['prickle', 2], ['chomper', 1], ['shroom', 2]],
        mood: { root: 57, mode: 'dorian', bpm: 112, feel: 'straight' },
    },
    {
        id: 4, name: 'COTTON SKIES', theme: 'skies', boss: 'nimbus', gadget: 'rocket',
        enemies: [['bee', 4], ['drizzle', 2], ['frog', 2], ['prickle', 2], ['snail', 2]],
        mood: { root: 65, mode: 'lydian', bpm: 144, feel: 'bounce' },
    },
    {
        id: 5, name: 'GRUMBLE KEEP', theme: 'keep', boss: 'grumblewort', gadget: null,
        enemies: [['prickle', 3], ['shroom', 2], ['snail', 2], ['bug', 2], ['bat', 2]],
        mood: { root: 55, mode: 'minor', bpm: 150, feel: 'drive' },
    },
];
export const LEVELS_PER_WORLD = 5;   // 4 levels + castle
export const SHARDS_PER_LEVEL = 3;
export const KEEP_SHARDS = 36;

/** Permanent items hidden in vaults. `gate` is the pocket type that guards it. */
export const VAULTS = [
    { item: 'spread', world: 1, level: 3, gate: 'basement' },
    { item: 'heart',  world: 1, level: 2, gate: 'high' },
    { item: 'chip',   world: 1, level: 4, gate: 'red' },
    { item: 'heart',  world: 2, level: 2, gate: 'bubble' },
    { item: 'chip',   world: 2, level: 4, gate: 'shaft' },
    { item: 'heart',  world: 3, level: 3, gate: 'shaft' },
    { item: 'chip',   world: 3, level: 1, gate: 'red' },
    { item: 'heart',  world: 4, level: 2, gate: 'red' },
];

export const LEVEL_NAMES = {
    meadow: ['HOPSCOTCH HILL', 'PIPE DREAM PASS', 'BUMBLE BRIDGE', 'SPRINKLE SPRINGS', "CHOMPO'S CASTLE"],
    dunes: ['SODA SANDS', 'PRICKLY PATH', 'PYRAMID PARTY', 'FIZZLE FLATS', "SANDSNAKE'S TOMB"],
    grotto: ['GLOW WORM WAY', 'CRYSTAL CRUNCH', 'ECHO ALLEY', 'GLITTER GULCH', "GLIMMERJAW'S DEN"],
    skies: ['FLUFF FIELDS', 'SPRING SUMMIT', 'DRIZZLE DRIFT', 'RAINBOW RUN', "NIMBUS NEST"],
    keep: ['LAVA LOBBY', 'FIREBAR FOYER', 'CRUSHER CORRIDOR', 'THRONE STAIRS', 'THE GRUMBLE THRONE'],
};
