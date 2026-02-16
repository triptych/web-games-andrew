/**
 * Game Configuration
 * Constants and settings for the raycasting engine
 */

// Screen dimensions
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 400;

// Raycasting settings
export const FOV = 60; // Field of view in degrees
export const NUM_RAYS = SCREEN_WIDTH; // One ray per screen column
export const MAX_RAY_DISTANCE = 20; // Maximum ray distance

// Player settings
export const PLAYER_START_X = 2.5;
export const PLAYER_START_Y = 2.5;
export const PLAYER_START_ANGLE = 0; // Facing right (0 degrees)
export const PLAYER_SIZE = 0.3; // Collision radius

export const PLAYER_MOVE_SPEED = 3; // Units per second
export const PLAYER_SPRINT_SPEED = 5; // Units per second when sprinting
export const PLAYER_ROTATION_SPEED = 120; // Degrees per second
export const MOUSE_SENSITIVITY = 0.2; // Mouse rotation sensitivity

// Map settings
export const TILE_SIZE = 1; // Each grid cell is 1x1 units
export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 16;

// Rendering settings
export const WALL_HEIGHT_MULTIPLIER = SCREEN_HEIGHT; // Scale factor for wall height
export const SHADING_ENABLED = true;
export const MIN_BRIGHTNESS = 0.2; // Minimum brightness for distant walls
export const MAX_BRIGHTNESS = 1.0; // Maximum brightness for close walls

// Wall colors (RGB)
export const WALL_COLORS = {
    0: null, // Empty space
    1: [100, 100, 100], // Gray stone
    2: [150, 75, 75],   // Red brick
    3: [100, 75, 50],   // Brown wood
    4: [150, 150, 180], // Silver metal
};

// Combat settings
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_START_HEALTH = 100;

// Weapon display settings
export const WEAPON_SCREEN_X = SCREEN_WIDTH / 2;
export const WEAPON_SCREEN_Y = SCREEN_HEIGHT - 60;
export const WEAPON_SPRITE_SIZE = 80;

// Combat feedback
export const MUZZLE_FLASH_DURATION = 50; // milliseconds
export const SCREEN_SHAKE_DECAY = 0.9;
export const DAMAGE_FLASH_DURATION = 200; // milliseconds
export const DAMAGE_FLASH_COLOR = [255, 0, 0, 0.3]; // Red with alpha

// Test map (16x16)
export const TEST_MAP = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 2, 2, 2, 0, 0, 0, 0, 3, 3, 3, 0, 0, 1],
    [1, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 3, 0, 0, 1],
    [1, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 3, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1],
    [1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1],
    [1, 0, 0, 3, 0, 0, 0, 2, 2, 2, 0, 0, 2, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Enemy spawn configuration for test map
export const TEST_ENEMIES = [
    // Guards in corners
    { type: 'GUARD', x: 5.5, y: 5.5, angle: 180 },
    { type: 'GUARD', x: 10.5, y: 5.5, angle: 270 },

    // Officer in center area
    { type: 'OFFICER', x: 8.5, y: 8.5, angle: 90 },

    // Dogs for fast encounters
    { type: 'DOG', x: 12.5, y: 12.5, angle: 225 },
    { type: 'DOG', x: 4.5, y: 12.5, angle: 315 },

    // SS Trooper as harder enemy
    { type: 'SS_TROOPER', x: 13.5, y: 2.5, angle: 180 },
];
