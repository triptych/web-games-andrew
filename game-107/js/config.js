// Kaiju Roll — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'kaiju-roll.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const FLOOR_H = 1.15;              // world units per building floor
export const DECK_H = 0.5;                // a bridge deck floor is low

export const BALL = {
    accel: 30,                // steering push (u/s²)
    maxSpeed: 13,             // top speed at the starting size; grows a little with the ball
    minSpeed: 3.8,            // a kaiju ball never stops rolling, like a breakout ball
    restitution: 0.84,        // bounce off a building
    wallRest: 0.92,           // bounce off the sea wall
    hp: 100,
    invuln: 0.85,             // seconds of grace after a hit
    gravity: 30,
    jump: 12.4,               // pounce take-off speed
    pounceCd: 1.05,
    maxR: 5.2,
    impactMin: 2.5,           // a bump softer than this does no real damage
};

export const LIVES = 3;
export const ABSORB = 0.9;    // a thing is swallowed when its size is at most this × the ball's radius
export const COMBO_TIME = 2.2;
export const PERK_COUNT = 3;
