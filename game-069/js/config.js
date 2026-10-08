// ============================================================
// DIRT CROWN — configuration shared by the simulation and the view
// ============================================================

export const SAVE_KEY = 'dirt-crown.v1';
export const VERSION = '1.0.1';

// Fixed simulation step. Physics, AI and lap timing all run at this rate whatever the screen does.
export const DT = 1 / 120;
export const G = 22;              // gravity (m/s²) — a touch heavier than Earth so jumps land briskly

// Track sampling: the centreline is resampled every DS metres.
export const DS = 2;

// Car body, for car-to-car contact.
export const CAR_RADIUS = 1.35;

// Countdown before the lights go green (seconds).
export const COUNTDOWN = 3.2;
