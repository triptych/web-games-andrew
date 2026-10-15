// VENDETTA OVERDRIVE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.2';
export const SAVE_KEY = 'vendetta-overdrive.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const CELL = 3;                    // metres per grid cell
export const SKY = 60;                    // ceiling height of an open-air cell
export const STEP_UP = 0.6;               // tallest ledge a walker climbs without jumping

export const PLAYER = {
    radius: 0.4, height: 1.8, eye: 1.6,
    speed: 9, accelGround: 70, accelAir: 20, friction: 12,
    jump: 6.6, gravity: 20,
    jetThrust: 30, jetBurn: 35, jetRegen: 25, fuelMax: 100,
    hp: 100, hpMax: 100, hpOver: 200, armorMax: 100, armorAbsorb: 0.6,
    lookMaxPitch: 1.45,
    slots: 4,
};

export const AMMO_MAX = { bullet: 300, shell: 60, rocket: 30, cell: 300 };
export const AMMO_START = { bullet: 80, shell: 12, rocket: 0, cell: 40 };

export const KICK = { damage: 40, range: 2.3, cone: 0.75, cooldown: 0.55, knock: 11 };
export const BOMB = { max: 5, speed: 14, fuse: 2.2, damage: 110, radius: 5 };
export const FURY = { max: 100, kill: 4, gib: 3, combo: 2, duration: 8, enemyScale: 0.35, damage: 1.5, heal: 5 };
export const COMBO = { window: 2.5 };
export const LIQUID_DPS = 12;
export const QUIP_COOLDOWN = 7;

export const DIFFICULTY = [
    { id: 'easy', name: 'Babysitter', dmg: 0.55, count: 0.75 },
    { id: 'normal', name: 'Tough Cookie', dmg: 1, count: 1 },
    { id: 'hard', name: 'Total Carnage', dmg: 1.45, count: 1.25 },
];

export const RARITY = [
    { name: 'Common', color: '#e8e8f0' },
    { name: 'Rad', color: '#5dff7a' },
    { name: 'Gnarly', color: '#4fb4ff' },
    { name: 'Tubular', color: '#c86bff' },
    { name: 'Legendary', color: '#ffc531' },
];

export const ELEMENT_COLOR = { fire: '#ff7a1a', shock: '#7fe8ff', cryo: '#bfe9ff', acid: '#9cff2e' };
