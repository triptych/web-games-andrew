// PERIHELION — tuning and constants. Shared by the sim, the view and the tests.
// Distances are world units on the asteroid's surface; the asteroid's radius comes from the level.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'perihelion.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const LIVES = 3;
export const PLAYER = { r: 0.45, speed: 6.4, hp: 100, iframes: 0.7, pickR: 1.15, respawnInv: 2.5 };
export const DASH = { t: 0.2, mult: 3.0, cd: 0.85 };
export const BUL = { speed: 30, life: 0.72, cd: 0.11, r: 0.15, dmg: 1 };
export const EBUL = { speed: 10.5, perLevel: 0.45, life: 2.6, r: 0.22, dmg: 14 };
export const WALL = { half: 0.32, height: 1.5 };
export const TURRET = {
    r: 0.85, hp: 40, hpPerLevel: 6, range: 14, turn: 2.6,
    cd: { gun: 0.8, burst: 1.4, ring: 2.0 },
    pylonHp: 70, alarm: 2,       // drones a beacon launches when it first sees you
};
export const ENEMY = {
    drone:  { r: 0.55, hp: 3, speed: 4.0, dmg: 16, score: 100 },
    seeker: { r: 0.4,  hp: 2, speed: 5.8, dmg: 10,  score: 60 },
    shard:  { r: 0.7,  hp: 10, speed: 2.4, dmg: 18, score: 250, cd: 2.0 },
};
export const ENEMY_SIGHT = 12;            // how far an enemy can see the player down a corridor
export const ENEMY_TRACK = 10;            // cells of maze distance from which they hunt by the flow field
export const BOSS = { r: 1.7, hp: 260, range: 24, contact: 15 };
export const PICKUP = { r: 0.5, life: 14, drop: 0.16, repair: 25, crystal: 500 };
export const SCORE = { turret: 1000, pylon: 1500, boss: 10000, clear: 2000, timeBonus: 10, par: 150, hpBonus: 10 };
export const PHASE = { intro: 2.5, dead: 2.2, warp: 4.2 };
export const EXIT = { r: 1.3 };
