// LAST COLONIST — tuning and constants. Shared by the sim, the view and the tests.
// World units are tiles: 1 unit = 1 tile = 16 sprite pixels. y grows upwards.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'last-colonist.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const LEVEL_H = 16;                // every level is 16 tiles tall
export const ACTIVATE_AHEAD = 17;         // spawn markers wake up this far ahead of the player
export const ACTIVATE_BEHIND = 7;
export const DESPAWN_BEHIND = 24;

export const PLAYER = {
    w: 0.7, h: 1.7, hCrouch: 1.05,
    speed: 7.5,
    gravity: 48,
    jump: 19.5,                           // apex ≈ 3.96 tiles above the take-off
    jumpCut: 0.45,                        // releasing jump early multiplies the rise by this
    maxFall: 26,
    coyote: 0.09,
    hp: 5,
    lives: 3,
    iframes: 1.4,
    flares: 3,
    maxFlares: 5,
    respawnT: 1.3,
};

/** Player weapons. rate = seconds between shots while the trigger is held. */
export const WEAPONS = {
    blaster: { name: 'Blaster', rate: 0.13, speed: 24, dmg: 1, life: 0.62 },
    spread: { name: 'Spread', rate: 0.24, speed: 20, dmg: 1, life: 0.5, n: 5, fan: 0.17 },
    laser: { name: 'Lance', rate: 0.3, speed: 38, dmg: 3, life: 0.5, pierce: true },
    rocket: { name: 'Rocket', rate: 0.46, speed: 14, dmg: 3, life: 1.3, splash: 2.3, splashDmg: 3 },
};
export const WEAPON_KINDS = ['spread', 'laser', 'rocket'];

export const FLARE = { vx: 9, vy: 10, gravity: 30, fuse: 1.25, radius: 3.4, dmg: 9 };

/** Enemy types. w/h is the hitbox; score is per kill. */
export const ENEMIES = {
    skitter: { w: 0.9, h: 0.7, hp: 2, score: 100, speed: 3.2, chase: 5.4 },
    wisp: { w: 0.8, h: 0.8, hp: 2, score: 150, speed: 3.2 },
    spitter: { w: 1.0, h: 1.2, hp: 4, score: 200, rate: 2.5 },
    turret: { w: 1.0, h: 1.0, hp: 6, score: 250, rate: 1.9 },
    brute: { w: 1.3, h: 2.2, hp: 16, score: 600, speed: 2.1 },
    nest: { w: 1.6, h: 1.3, hp: 10, score: 500, rate: 3.4 },
    hiveling: { w: 0.55, h: 0.6, hp: 1, score: 50, speed: 6.4 },
    missile: { w: 0.5, h: 0.5, hp: 1, score: 50 },
};

export const BOSSES = {
    brood: { name: 'THE BROOD MOTHER', hp: 130, w: 4.0, h: 2.8, score: 10000 },
    warden: { name: 'WARDEN-9', hp: 200, w: 3.0, h: 2.4, score: 15000 },
    gravemaw: { name: 'GRAVEMAW', hp: 190, w: 2.4, h: 7.5, score: 20000 },
    queen: { name: 'THE HIVE QUEEN', hp: 220, w: 5.0, h: 9.0, score: 50000 },
};

export const SCORE = { pod: 1000, clear: 2000, perfectPods: 3000, noDeath: 2500, extraLifeEvery: 30000 };
export const POD_HP = 3;
export const ARENA_W = 24;
