// Game configuration and constants

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_CONFIG = {
    startingHp: 100,
    startingSpeed: 200,
    fireRate: 0.5, // seconds between shots
    baseDamage: 10,
    pickupRadius: 50,
};

export const ENEMY_DEFS = {
    charger: {
        hp: 50,
        speed: 80,
        damage: 10,
        size: 12,
        xpValue: 5,
        color: [255, 100, 80],
        outlineColor: [200, 50, 30],
        behavior: 'chase',
    },
    fast: {
        hp: 30,
        speed: 150,
        damage: 5,
        size: 10,
        xpValue: 8,
        color: [255, 200, 80],
        outlineColor: [200, 150, 30],
        behavior: 'chase',
    },
    tank: {
        hp: 200,
        speed: 40,
        damage: 25,
        size: 20,
        xpValue: 20,
        color: [150, 150, 150],
        outlineColor: [80, 80, 80],
        behavior: 'chase',
    },
};

export const WAVE_CONFIG = {
    initialSpawnInterval: 2.0, // seconds between spawns
    minSpawnInterval: 0.5,
    spawnIntervalDecrease: 0.05, // per wave
    enemiesPerWave: 5,
    waveInterval: 30, // seconds
};

export const XP_CONFIG = {
    baseXpToLevel: 10,
    xpScaling: 1.5, // multiplier per level
    gemAttractionRadius: 100,
    gemAttractionSpeed: 300,
};

export const HEALTH_PICKUP_CONFIG = {
    healAmount: 25,
    dropChance: 0.15, // 15% chance to drop from enemies
    attractionRadius: 80,
    attractionSpeed: 250,
};
