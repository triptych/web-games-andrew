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
