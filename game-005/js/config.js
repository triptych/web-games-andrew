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

// RPG Character Classes
export const PLAYER_CLASSES = {
    warrior: {
        name: "Warrior",
        description: "High HP, slow but powerful attacks",
        hp: 150,
        speed: 180,
        fireRate: 0.7,
        damage: 15,
        color: [220, 80, 80],
        outlineColor: [255, 120, 120],
        stats: { str: 8, dex: 4, int: 3, vit: 9 }
    },
    ranger: {
        name: "Ranger",
        description: "Balanced stats, rapid fire",
        hp: 100,
        speed: 220,
        fireRate: 0.35,
        damage: 10,
        color: [80, 220, 100],
        outlineColor: [120, 255, 140],
        stats: { str: 5, dex: 9, int: 4, vit: 6 }
    },
    mage: {
        name: "Mage",
        description: "Low HP, high damage magic",
        hp: 70,
        speed: 200,
        fireRate: 0.6,
        damage: 18,
        color: [100, 120, 255],
        outlineColor: [140, 160, 255],
        stats: { str: 3, dex: 5, int: 10, vit: 4 }
    }
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
        description: 'Rushes directly at player'
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
        description: 'Quick and nimble'
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
        description: 'Slow but heavily armored'
    },
    circler: {
        hp: 60,
        speed: 100,
        damage: 8,
        size: 11,
        xpValue: 10,
        color: [150, 100, 255],
        outlineColor: [100, 50, 200],
        behavior: 'orbit',
        orbitDistance: 150,
        orbitSpeed: 2,
        description: 'Orbits around the player'
    },
    shooter: {
        hp: 40,
        speed: 60,
        damage: 5,
        size: 13,
        xpValue: 12,
        color: [255, 120, 180],
        outlineColor: [200, 70, 130],
        behavior: 'shoot',
        shootRange: 250,
        shootCooldown: 2.0,
        description: 'Keeps distance and fires projectiles'
    },
    teleporter: {
        hp: 45,
        speed: 0,
        damage: 12,
        size: 10,
        xpValue: 15,
        color: [100, 255, 255],
        outlineColor: [50, 200, 200],
        behavior: 'teleport',
        teleportCooldown: 3.0,
        teleportRange: 200,
        description: 'Blinks around unpredictably'
    },
    splitter: {
        hp: 70,
        speed: 70,
        damage: 10,
        size: 14,
        xpValue: 18,
        color: [180, 255, 100],
        outlineColor: [130, 200, 50],
        behavior: 'chase',
        splitCount: 3,
        splitType: 'fast',
        description: 'Splits into smaller enemies on death'
    },
    swarm: {
        hp: 20,
        speed: 120,
        damage: 3,
        size: 12,  // Increased to 12 for much better visibility
        xpValue: 3,
        color: [255, 100, 255],  // Brighter magenta
        outlineColor: [255, 200, 255],  // Bright pink outline
        behavior: 'swarm',
        description: 'Tiny but dangerous in groups'
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
