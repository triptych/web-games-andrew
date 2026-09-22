// ============================================================
// STARCADET — Configuration
// Every tunable number in the game lives here. No magic numbers
// in sim/ or view/ modules; import from this file instead.
// ============================================================

// --- Playfield (world units, XY plane; y+ is "up the screen") ---
export const ARENA = {
    w: 20,          // total width
    h: 28,          // total height
    get left()   { return -this.w / 2; },
    get right()  { return  this.w / 2; },
    get bottom() { return -this.h / 2; },
    get top()    { return  this.h / 2; },
    margin: 1.2,    // how far outside the arena things live before culling
};

// --- Fixed timestep ---
export const TICK = 1 / 120;
export const MAX_FRAME_DT = 0.1;      // never simulate more than 100ms of catch-up per frame

// --- Player ---
export const PLAYER = {
    speed: 11,
    focusSpeed: 4.4,
    odSpeedMult: 1.25,
    hitbox: 0.17,
    shipRadius: 0.8,          // visual/body-collision radius
    startX: 0,
    startY: -9,
    startLives: 3,
    maxLives: 6,
    startFlares: 2,
    maxFlares: 4,
    respawnDelay: 1.1,
    respawnInvuln: 2.6,
    flareInvuln: 1.6,
    deathBombWindow: 0.2,     // grace period where a flare still saves you
    grazeRadius: 0.75,
    grazeScore: 30,
    grazeOD: 0.9,             // OD meter units per graze (meter is 100)
    odDuration: 6.0,
    odFireMult: 2.0,
    hookRadius: 1.2,          // pod auto-latch distance
    magnetRadius: 2.6,        // pickup magnet distance
    bounds: { pad: 0.9 },     // how close the ship can get to the arena edge
};

// --- Flare (bomb) ---
export const FLARE = {
    radius: 9,
    damage: 200,
    bulletScore: 12,          // score per bullet converted
    fieldDuration: 3.0,       // only with Kel's Wing Ability
    fieldDps: 60,
    fieldRadius: 5,
};

// --- Weapons: [type][powerLevel-1] -> array of muzzle specs ---
// Each muzzle: { dx, dy, ang (deg from straight up), speed, dmg, r, kind, pierce, homing }
function m(dx, ang, speed, dmg, opts = {}) {
    return { dx, dy: 0.6, ang, speed, dmg, r: opts.r ?? 0.22, kind: opts.kind ?? 'dart',
             pierce: opts.pierce ?? 0, homing: opts.homing ?? 0, ...opts };
}

// DPS targets (volleys/sec x damage/volley), tuned in dev/balance.mjs:
//   vulcan  60 -> 130 dps   reliable forward damage, the yardstick
//   spread  50 -> 135 dps   but only ~1-2 bullets land on a single target
//   lance   56 -> 150 dps   single-target and pierces, the boss-killer
//   seeker  50 -> 120 dps   every shot lands; lowest ceiling, zero aiming
export const WEAPONS = {
    vulcan: {
        name: 'VULCAN', letter: 'V', color: 0x7ef2ff, cooldown: 0.1,
        focusSqueeze: 0.45,
        levels: [
            [ m(-0.32, 0, 26, 3), m(0.32, 0, 26, 3) ],
            [ m(-0.42, 0, 26, 2.5), m(0, 0, 26, 2.5), m(0.42, 0, 26, 2.5) ],
            [ m(-0.5, 0, 27, 2.4), m(-0.18, 0, 27, 2.4), m(0.18, 0, 27, 2.4), m(0.5, 0, 27, 2.4) ],
            [ m(-0.5, 0, 28, 2.4), m(-0.18, 0, 28, 2.4), m(0.18, 0, 28, 2.4), m(0.5, 0, 28, 2.4),
              m(-0.72, -11, 24, 1), m(0.72, 11, 24, 1) ],
            [ m(-0.5, 0, 30, 2.75), m(-0.18, 0, 30, 2.75), m(0.18, 0, 30, 2.75), m(0.5, 0, 30, 2.75),
              m(-0.72, -13, 26, 1), m(0.72, 13, 26, 1) ],
        ],
    },
    spread: {
        name: 'SPREAD', letter: 'S', color: 0x8effc0, cooldown: 0.135,
        focusSqueeze: 0.4,
        levels: [
            [ m(0, -14, 21, 2.2), m(0, 0, 21, 2.2), m(0, 14, 21, 2.2) ],
            [ m(0, -20, 21, 2.2), m(0, -7, 21, 2.2), m(0, 7, 21, 2.2), m(0, 20, 21, 2.2) ],
            [ m(0, -24, 22, 2.4), m(0, -12, 22, 2.4), m(0, 0, 22, 2.4), m(0, 12, 22, 2.4), m(0, 24, 22, 2.4) ],
            [ m(0, -30, 22, 2.5), m(0, -18, 22, 2.5), m(0, -6, 22, 2.5), m(0, 6, 22, 2.5),
              m(0, 18, 22, 2.5), m(0, 30, 22, 2.5) ],
            [ m(0, -36, 23, 2.6), m(0, -24, 23, 2.6), m(0, -12, 23, 2.6), m(0, 0, 23, 2.6),
              m(0, 12, 23, 2.6), m(0, 24, 23, 2.6), m(0, 36, 23, 2.6) ],
        ],
    },
    lance: {
        name: 'LANCE', letter: 'L', color: 0xa0b4ff, cooldown: 0.16,
        focusSqueeze: 0.3,
        levels: [
            [ m(0, 0, 34, 9, { r: 0.3, kind: 'lance', pierce: 3 }) ],
            [ m(-0.3, 0, 34, 5.5, { r: 0.28, kind: 'lance', pierce: 3 }),
              m(0.3, 0, 34, 5.5, { r: 0.28, kind: 'lance', pierce: 3 }) ],
            [ m(-0.36, 0, 35, 7, { r: 0.3, kind: 'lance', pierce: 4 }),
              m(0.36, 0, 35, 7, { r: 0.3, kind: 'lance', pierce: 4 }) ],
            [ m(-0.42, 0, 36, 6, { r: 0.32, kind: 'lance', pierce: 5 }), m(0, 0, 36, 8, { r: 0.36, kind: 'lance', pierce: 6 }),
              m(0.42, 0, 36, 6, { r: 0.32, kind: 'lance', pierce: 5 }) ],
            [ m(-0.42, 0, 38, 7, { r: 0.34, kind: 'lance', pierce: 6 }), m(0, 0, 38, 10, { r: 0.4, kind: 'lance', pierce: 8 }),
              m(0.42, 0, 38, 7, { r: 0.34, kind: 'lance', pierce: 6 }) ],
        ],
    },
    seeker: {
        name: 'SEEKER', letter: 'K', color: 0xffa8f0, cooldown: 0.2,
        focusSqueeze: 0.8,
        levels: [
            [ m(-0.4, -22, 13, 5, { kind: 'seeker', homing: 3.4, r: 0.26 }),
              m(0.4, 22, 13, 5, { kind: 'seeker', homing: 3.4, r: 0.26 }) ],
            [ m(-0.4, -22, 13, 4.4, { kind: 'seeker', homing: 3.8, r: 0.26 }), m(0, 0, 15, 4.4, { kind: 'seeker', homing: 3.8, r: 0.26 }),
              m(0.4, 22, 13, 4.4, { kind: 'seeker', homing: 3.8, r: 0.26 }) ],
            [ m(-0.45, -26, 14, 4.2, { kind: 'seeker', homing: 4.2, r: 0.27 }), m(-0.15, -8, 15, 4.2, { kind: 'seeker', homing: 4.2, r: 0.27 }),
              m(0.15, 8, 15, 4.2, { kind: 'seeker', homing: 4.2, r: 0.27 }), m(0.45, 26, 14, 4.2, { kind: 'seeker', homing: 4.2, r: 0.27 }) ],
            [ m(-0.45, -30, 15, 4.2, { kind: 'seeker', homing: 4.6, r: 0.28 }), m(-0.15, -10, 16, 4.2, { kind: 'seeker', homing: 4.6, r: 0.28 }),
              m(0.15, 10, 16, 4.2, { kind: 'seeker', homing: 4.6, r: 0.28 }), m(0.45, 30, 15, 4.2, { kind: 'seeker', homing: 4.6, r: 0.28 }),
              m(0, 0, 17, 4.2, { kind: 'seeker', homing: 4.6, r: 0.28 }) ],
            [ m(-0.5, -34, 16, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }), m(-0.3, -18, 16, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }),
              m(-0.1, -6, 17, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }), m(0.1, 6, 17, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }),
              m(0.3, 18, 16, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }), m(0.5, 34, 16, 4, { kind: 'seeker', homing: 5.2, r: 0.3 }) ],
        ],
    },
};

export const WEAPON_IDS = ['vulcan', 'spread', 'lance', 'seeker'];
export const MAX_POWER = 5;

// --- Escape pods ---
export const POD = {
    radius: 0.62,
    hp: 3,
    driftSpeed: 2.2,
    score: 500,
    powerChance: 0.12,
    burnTime: 12,             // levels flagged `burn` only
    minCadets: 1,
    maxCadets: 4,
};

// --- Pickups ---
export const PICKUP = {
    radius: 0.5,
    fallSpeed: 3.2,
    magnetSpeed: 15,
    life: 12,
    scoreGem: 250,
};

// --- Difficulty ---
export const DIFFICULTY = {
    cadet: { id: 'cadet', name: 'CADET',  bulletSpeed: 0.82, density: -1, enemyHp: 0.85, lives: 5, scoreMult: 0.8 },
    pilot: { id: 'pilot', name: 'PILOT',  bulletSpeed: 1.0,  density: 0,  enemyHp: 1.0,  lives: 3, scoreMult: 1.0 },
    ace:   { id: 'ace',   name: 'ACE',    bulletSpeed: 1.18, density: 1,  enemyHp: 1.15, lives: 2, scoreMult: 1.35 },
};
export const DIFFICULTY_IDS = ['cadet', 'pilot', 'ace'];

// --- Scoring ---
export const SCORE = {
    podRescue: POD.score,
    cadet: 150,
    noLossBonus: 5000,
    flareUnused: 1200,
    lifeRemaining: 3000,
    ranks: [
        { rank: 'S', ratio: 0.97 },
        { rank: 'A', ratio: 0.88 },
        { rank: 'B', ratio: 0.72 },
        { rank: 'C', ratio: 0.5 },
        { rank: 'D', ratio: 0 },
    ],
};

// --- Bullet visual kinds (the view has one InstancedMesh per kind) ---
export const BULLET_KINDS = ['orb', 'dart', 'petal', 'shard', 'lance', 'mine', 'wave', 'seeker', 'spark'];

// --- Palette. Rule from the GDD: enemy fire is warm, player fire is cool. ---
export const COLORS = {
    bg: 0x05060f,
    player: 0x7ef2ff,
    playerAlt: 0x8effc0,
    hull: 0xc8d4ff,
    enemyBullet: 0xffb347,
    enemyBulletHot: 0xff4d6d,
    enemyBulletWhite: 0xfff2d0,
    pod: 0x7dffd4,
    podHurt: 0xff6b6b,
    powerItem: 0xffd166,
    flareItem: 0xff8bd0,
    lifeItem: 0x9dff70,
    gem: 0xc9a7ff,
    warn: 0xff3860,
    text: '#dcdcf0',
};

// --- Camera ---
export const CAM = {
    fov: 52,
    near: 0.1,
    far: 400,
    pos: [0, -12.5, 28],
    lookAt: [0, 1.2, 0],
    tilt: 0.28,               // radians the camera is pitched over the field
    lean: 0.6,                // how far the camera drifts with the player
    shakeDecay: 6.5,
};

// --- View tuning ---
export const VIEW = {
    bloomStrength: 0.85,
    bloomRadius: 0.5,
    bloomThreshold: 0.82,
    maxBulletsPerKind: 2200,
    // Small and dim on purpose: stars must never be mistaken for bullets.
    starLayers: [
        { count: 260, z: -40, speed: 1.4, size: 0.16, color: 0x243256 },
        { count: 170, z: -26, speed: 3.0, size: 0.22, color: 0x3e538f },
        { count: 90,  z: -14, speed: 6.0, size: 0.3,  color: 0x6f86c8 },
    ],
    hitStop: 0.06,
};

export const SAVE_KEY = 'starcadet.save.v1';
