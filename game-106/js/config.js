// INTRUDER ALERT '84 — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'intruder-alert-84.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The room. World units; the view draws PX pixels per unit into a low-res buffer and scales it up.
export const FIELD = { w: 32, h: 18 };
export const PX = 16;                     // buffer pixels per world unit → a 512×288 "16-bit" screen
export const MAZE = { cols: 5, rows: 3, thick: 0.45, door: 3.2 };

export const ROUND = { seconds: 300 };    // survive five sectors to escape
export const SECTOR = { seconds: 60, grinnerAt: 38 };

export const PLAYER = {
    speed: 7.2, radius: 0.55, hp: 100,
    iframes: 0.7,                         // after a hit
    dash: 0.22, dashMul: 2.6, dashCool: 1.2,
    magnet: 2.2,                          // chip pull radius
};

export const WALL = { touch: 12, knock: 9, robotTouch: 15 };

export const LASER = { dmg: 10, cool: 0.42, speed: 26, ttl: 0.9, range: 14, spread: 0.16 };
export const ORBIT = { radius: 2.0, spin: 3.4, dmg: 6, hitCool: 0.35, size: 0.42 };
export const PULSE = { cool: 3.2, radius: 3.2, dmg: 14, knock: 6 };

/** Robots. hp, speed (units/s), contact damage, radius, chip value, score, first sector seen. */
export const ROBOTS = {
    drone:  { hp: 10, speed: 2.4, dmg: 8,  r: 0.48, xp: 1, score: 50,  from: 1 },
    hunter: { hp: 20, speed: 3.6, dmg: 10, r: 0.5,  xp: 2, score: 100, from: 2 },
    gunner: { hp: 26, speed: 1.9, dmg: 8,  r: 0.52, xp: 3, score: 150, from: 2, keep: 6, fire: 2.4 },
    brute:  { hp: 110, speed: 1.5, dmg: 20, r: 0.95, xp: 8, score: 400, from: 3 },
};
export const SPAWN = {
    every: 0.75,                          // seconds between bursts at the start…
    min: 0.2,                             // …shrinking to this
    burst: 3,                             // robots per burst, +1 each sector
    cap: 160,                             // most robots alive at once
    hpGrow: 0.35,                         // robot HP ×(1 + hpGrow) per sector
};
export const BOLT = { speed: 7, ttl: 3, dmg: 6, r: 0.18 };
export const GRINNER = { speed: 3.4, accel: 0.07, max: 6.2, dmg: 20, r: 0.7, recoil: 1.2, aim: 7, knock: 0.22 };   // speed grows per second it lives; it backs off after a bite

export const XP = { base: 5, grow: 1.32 };        // chips to the next level: base × grow^(level-1)
export const CHIP = { r: 0.25, speed: 14, crowd: 120, merge: 2.5 };   // past `crowd` chips, a drop joins one within `merge`

/** Upgrades offered on level up. max = most times it can be taken. */
export const UPGRADES = {
    rate:   { name: 'RAPID FIRE',   desc: 'Laser fires 18% faster', max: 6 },
    split:  { name: 'SPLIT BEAM',   desc: '+1 laser in the spread', max: 4 },
    pierce: { name: 'PIERCER',      desc: 'Lasers pass through +1 robot', max: 3 },
    power:  { name: 'OVERCHARGE',   desc: '+30% laser damage', max: 5 },
    orbit:  { name: 'NEON DISC',    desc: '+1 disc orbits you', max: 4 },
    pulse:  { name: 'SHOCK PULSE',  desc: 'A shockwave every few seconds', max: 4 },
    speed:  { name: 'TURBO BOOTS',  desc: '+10% move speed', max: 3 },
    magnet: { name: 'CHIP MAGNET',  desc: '+60% pickup range', max: 3 },
    armor:  { name: 'ARMOR PLATE',  desc: '+25 max HP and heal 25', max: 4 },
    repair: { name: 'REPAIR KIT',   desc: 'Heal 40 HP', max: 99 },
};
