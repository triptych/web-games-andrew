// Wave spawning logic and difficulty scaling

import { events } from './events.js';
import { state } from './state.js';
import { WAVE_CONFIG, ENEMY_DEFS } from './config.js';

let k;
let spawnTimer = 0;
let currentSpawnInterval = WAVE_CONFIG.initialSpawnInterval;

export function initWaves(kaplay) {
    k = kaplay;

    // Start spawning when game starts
    events.on('gameStarted', () => {
        spawnTimer = 0;
        currentSpawnInterval = WAVE_CONFIG.initialSpawnInterval;
    });

    // Main spawn loop
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;

        spawnTimer += k.dt();

        if (spawnTimer >= currentSpawnInterval) {
            spawnRandomEnemy();
            spawnTimer = 0;

            // Gradually decrease spawn interval (increase difficulty)
            currentSpawnInterval = Math.max(
                WAVE_CONFIG.minSpawnInterval,
                currentSpawnInterval - WAVE_CONFIG.spawnIntervalDecrease
            );
        }
    });
}

function spawnRandomEnemy() {
    // Choose random enemy type
    const types = Object.keys(ENEMY_DEFS);
    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn at random edge position
    const pos = getRandomEdgePosition();

    events.emit('spawnEnemy', type, pos);
}

function getRandomEdgePosition() {
    const edge = Math.floor(Math.random() * 4);
    const padding = 20;

    switch (edge) {
        case 0: // Top
            return k.vec2(
                Math.random() * k.width(),
                -padding
            );
        case 1: // Right
            return k.vec2(
                k.width() + padding,
                Math.random() * k.height()
            );
        case 2: // Bottom
            return k.vec2(
                Math.random() * k.width(),
                k.height() + padding
            );
        case 3: // Left
            return k.vec2(
                -padding,
                Math.random() * k.height()
            );
    }
}
