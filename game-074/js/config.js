// CINDERWING — constants. Units are field units: the visible playfield is
// 32 × 18, y is up, origin bottom-left. "Screen x" is 0–32 across the view;
// "world x" is screen x + scroll, used by terrain and anything fixed to it.

export const W = 32;
export const H = 18;
export const SIM_DT = 1 / 120;          // fixed sim step
export const SCROLL = 2.4;              // field units per second

export const PLAYER = {
    r: 0.26,            // bullet hitbox — tiny, as the genre expects
    body: 0.34,         // half-height used against terrain
    len: 0.45,          // half-length used against terrain
    speeds: [7.2, 8.8, 10.4, 12.0, 13.6],   // by wing level 0–4
    focus: 0.55,        // speed multiplier while focus is held
    invuln: 2.6,        // after a respawn
    hurtInvuln: 1.4,    // after a Pilgrim hit or an Aegis block
    fireGap: 0.085,
    seekGap: 0.75,
    chargeTime: 1.15,   // seconds to a full Radiance charge
    chargeMin: 0.3,     // below this a release is just a dart
};

export const HALO = {
    r: 0.72,
    frontX: 1.25,
    backX: -1.2,
    launch: 24,         // u/s when cast
    ret: 20,            // u/s when called home
    freeFront: 22,      // where a cast halo comes to rest
    freeBack: 5,
    contact: 34,        // damage per second to anything it touches
    launchContact: 70,
};

export const DIFFICULTY = {
    pilgrim: {
        name: 'Pilgrim', blurb: 'Three feathers of health per life, respawn where you fall, gentler bullets.',
        lives: 4, health: 3, bullet: 0.78, rate: 0.75, checkpoints: false, revenge: false, score: 0.5, keepPower: true,
    },
    seraph: {
        name: 'Seraph', blurb: 'The arcade rules: one touch and you fall back to the last checkpoint.',
        lives: 3, health: 1, bullet: 1, rate: 1, checkpoints: true, revenge: false, score: 1, keepPower: false,
    },
    archangel: {
        name: 'Archangel', blurb: 'Faster fire, and the damned spit one last ember when they burn.',
        lives: 3, health: 1, bullet: 1.18, rate: 1.25, checkpoints: true, revenge: true, score: 1.6, keepPower: false,
    },
};

export const EXTENDS = [30000, 100000, 200000, 350000, 550000, 800000];
export const MAX_LIVES = 9;

export const ITEM_NAMES = {
    red: 'Seraph Flame',
    blue: 'Lance of Dawn',
    gold: 'Choir of Wings',
    wing: 'Wing',
    echo: 'Echo',
    seeker: 'Seeker Feathers',
    aegis: 'Aegis',
    life: 'Extra Life',
    shard: 'Soul Shard',
};

export const STAGE_COUNT = 7;
