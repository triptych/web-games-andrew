// NEBULA REQUIEM — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.2.1';
export const SAVE_KEY = 'nebula-requiem.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The playfield in world units: x right (the ship flies right), y down. 16:9; the view fits it to any screen.
export const FIELD = { w: 32, h: 18 };

export const PLAYER = {
    body: 0.45,          // radius for pickups and walls
    graze: 1.05,         // bullets passing inside this (but outside the hitbox) charge Burst
    startX: 5, startY: 9,
    lives: 3, bombs: 3,
    respawnInv: 3.0,     // invulnerable after a respawn (s)
    bombTime: 2.6, bombDps: 34, bombInv: 3.2,
    deathBombs: 3,       // bombs refilled to at least this after a death
    maxBombs: 6,
};

export const WEAPON = {
    maxPower: 6, maxOptions: 4, maxRockets: 4, maxShield: 5, maxWarp: 3, maxHalo: 2,
    rocketEvery: 0.62, rocketDmg: 3, rocketSplash: 1.3, rocketSpeed: 20,
    optionEvery: 0.14,
    warpDist: 7, warpInv: 0.5, warpDmg: 22, warpRecharge: 6, warpClear: 1.3,
    haloRadius: 1.7, haloDps: 9, haloBlade: 0.42,
    shieldInv: 1.6, shieldClear: 3.2,
    overdrive: 10, chrono: 8, magnet: 20, chronoSlow: 0.45,
};

export const BURST = { max: 100, graze: 1.2, kill: 0.5, bigKill: 4, gem: 0.15 };

export const SCORE = {
    chainWindow: 1.6,        // a kill within this keeps the chain going
    gem: 50,                 // a cancelled-bullet star; × chain tier
    graze: 20,
    extends: [500000, 1500000, 3000000, 6000000, 10000000],
};

// Difficulty: bullet speed, fire rate, enemy toughness. Rank adds up to +25% speed/rate as a run goes on.
export const DIFFS = [
    { id: 'casual', name: 'CASUAL', speed: 0.8, rate: 0.65, hp: 0.85, lives: 5, desc: 'Fewer, slower bullets. Five lives.' },
    { id: 'normal', name: 'NORMAL', speed: 1.0, rate: 1.0, hp: 1.0, lives: 3, desc: 'The intended bullet heaven.' },
    { id: 'hell', name: 'REQUIEM', speed: 1.18, rate: 1.4, hp: 1.15, lives: 3, desc: 'Dense, fast, merciless.' },
];
export const RANK = { perMinute: 0.035, max: 0.25 };

export const LIMITS = { bullets: 1400, shots: 500, enemies: 140, items: 260, events: 400 };

export const SCROLL = 4.2;                // background/world scroll speed (units/s), for terrain and capital ships
export const BOSS_HP = 2.4;            // every boss phase's HP in bosses.js is multiplied by this
// ...and by the stage's factor: the player is far stronger by stage 6 than stage 1 (balance table in game-plan.md)
export const STAGE_BOSS_HP = { bellwether: 0.62, wyrm: 0.6, organ: 0.95, titan: 1.3, mother: 1.4, heart: 1.65 };
