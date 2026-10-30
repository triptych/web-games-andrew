// STARBLAZER '86 — tuning and constants. Shared by the sim, the view and the tests.
// Distances are in buffer pixels (the screen is a 224×288 pixel buffer), speeds in px/s.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'starblazer-86.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const FIELD = { w: 224, h: 288 };

export const PLAYER = {
    speed: 118, speedStep: 16, maxSpeedLevel: 3,
    r: 2.6,                                // what enemy bullets must touch
    bodyR: 4.5,                            // what enemy bodies must touch
    pickR: 8,
    lives: 3, maxLives: 7, bombs: 2, maxBombs: 5,
    startY: FIELD.h - 38, minY: 34, margin: 8,
    respawn: 1.4, invuln: 2.6, startInv: 1.8,
    fireGap: [0, 0.15, 0.14, 0.13, 0.125, 0.12],   // by weapon level (index 1..5)
    maxWeapon: 5,
    bulletSpeed: 310,
};

export const BOMB = { speed: 420, dur: 0.85, dmg: 30, bossDmg: 45, inv: 1.7 };

export const SCORE = {
    firstLife: 20000, lifeEvery: 60000,
    chainWindow: 1.5, chainPer: 6, chainMax: 5,
    medals: [100, 200, 300, 400, 500, 600, 800, 1000],
    bonusPerfect: 10000, perfectPerWave: 500,
};

export const WAVE = { intro: 2.2, bossIntro: 3.4, clear: 2.8, bossEvery: 5, bonusAt: 4 };

export const ENEMY = {
    bulletSpeed: 68, maxBullets: 90,
    fireScale: 0.075,                      // more fire per wave of difficulty
    speedScale: 0.02, speedCap: 0.85,
};
