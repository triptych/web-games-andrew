// Wave spawning logic and difficulty scaling

import { events } from './events.js';
import { state } from './state.js';
import { WAVE_CONFIG, ENEMY_DEFS } from './config.js';

let k;
let spawnTimer = 0;
let currentSpawnInterval = WAVE_CONFIG.initialSpawnInterval;
let enemiesSpawnedThisWave = 0;
let enemiesKilledThisWave = 0;
let enemiesPerWave = WAVE_CONFIG.enemiesPerWave;
let isWaveActive = false;
let unsubscribeCallbacks = [];

export function initWaves(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];

    // Reset all wave state
    spawnTimer = 0;
    currentSpawnInterval = WAVE_CONFIG.initialSpawnInterval;
    enemiesSpawnedThisWave = 0;
    enemiesKilledThisWave = 0;
    enemiesPerWave = WAVE_CONFIG.enemiesPerWave;
    state.currentWave = 1;
    isWaveActive = false;

    // Start spawning when game starts
    const gameStartedUnsub = events.on('gameStarted', () => {
        spawnTimer = 0;
        currentSpawnInterval = WAVE_CONFIG.initialSpawnInterval;
        enemiesSpawnedThisWave = 0;
        enemiesKilledThisWave = 0;
        enemiesPerWave = WAVE_CONFIG.enemiesPerWave;
        state.currentWave = 1;
        isWaveActive = true;
    });
    unsubscribeCallbacks.push(gameStartedUnsub);

    // Track enemy kills for wave progress
    const enemyKilledUnsub = events.on('enemyKilled', () => {
        if (isWaveActive) {
            enemiesKilledThisWave++;

            // Check if wave is complete
            if (enemiesKilledThisWave >= enemiesPerWave &&
                enemiesSpawnedThisWave >= enemiesPerWave) {
                completeWave();
            }
        }
    });
    unsubscribeCallbacks.push(enemyKilledUnsub);

    // Main spawn loop
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver || !isWaveActive) return;

        // Only spawn if we haven't reached the wave limit
        if (enemiesSpawnedThisWave < enemiesPerWave) {
            spawnTimer += k.dt();

            if (spawnTimer >= currentSpawnInterval) {
                spawnRandomEnemy();
                enemiesSpawnedThisWave++;
                spawnTimer = 0;
            }
        }
    });
}

function completeWave() {
    isWaveActive = false;

    // Advance to next wave
    state.currentWave++;
    events.emit('waveChanged', state.currentWave);

    // Increase difficulty
    enemiesPerWave = Math.floor(enemiesPerWave * 1.3);
    currentSpawnInterval = Math.max(
        WAVE_CONFIG.minSpawnInterval,
        currentSpawnInterval - WAVE_CONFIG.spawnIntervalDecrease
    );

    // Reset wave counters and start next wave after a brief delay
    setTimeout(() => {
        enemiesSpawnedThisWave = 0;
        enemiesKilledThisWave = 0;
        isWaveActive = true;
    }, 2000); // 2 second break between waves
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
