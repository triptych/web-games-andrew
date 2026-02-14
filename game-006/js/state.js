/**
 * Global game state management
 */

import { PLAYER_START_HEALTH, PLAYER_MAX_HEALTH } from './config.js';

export const state = {
    // Player reference
    player: null,

    // Player health
    health: PLAYER_START_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,

    // Weapon system
    weapons: null, // Set by weapons.js

    // Combat effects
    damageFlash: false,
    damageFlashTime: 0,
    camera: {
        shake: 0,
        shakeX: 0,
        shakeY: 0,
    },

    // Projectiles (rockets, etc.)
    projectiles: [],

    // Visual effects
    impacts: [], // Bullet impacts on walls
    explosions: [], // Explosion effects

    // Map reference
    map: null,

    // Game stats
    fps: 60,
    timeAlive: 0,
    enemiesKilled: 0,
    shotsFired: 0,
    shotsHit: 0,

    // Gameplay state
    isPaused: false,
    isGameOver: false,

    // Reset state for new game
    reset() {
        this.timeAlive = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.fps = 60;
        this.health = PLAYER_START_HEALTH;
        this.enemiesKilled = 0;
        this.shotsFired = 0;
        this.shotsHit = 0;
        this.damageFlash = false;
        this.damageFlashTime = 0;
        this.camera.shake = 0;
        this.camera.shakeX = 0;
        this.camera.shakeY = 0;
        this.projectiles = [];
        this.impacts = [];
        this.explosions = [];
    }
};
