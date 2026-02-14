// Wave spawning logic and difficulty scaling

import { events } from './events.js';
import { state } from './state.js';
import { WAVE_CONFIG, ENEMY_DEFS } from './config.js';

let k;
let spawnTimer = 0;
let currentSpawnInterval = 0.8; // Faster spawning (was 2.0)
let enemiesSpawnedThisWave = 0;
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
    currentSpawnInterval = 0.8;
    enemiesSpawnedThisWave = 0;
    enemiesPerWave = WAVE_CONFIG.enemiesPerWave;
    state.currentWave = 1;
    isWaveActive = false;

    // Start spawning when game starts
    const gameStartedUnsub = events.on('gameStarted', () => {
        spawnTimer = 0;
        currentSpawnInterval = 0.8;
        enemiesSpawnedThisWave = 0;
        enemiesPerWave = WAVE_CONFIG.enemiesPerWave;
        state.currentWave = 1;
        isWaveActive = true;
    });
    unsubscribeCallbacks.push(gameStartedUnsub);

    // Track enemy kills for wave progress - check after each kill
    const enemyKilledUnsub = events.on('enemyKilled', (enemy) => {
        if (!isWaveActive) return;

        // Check wave completion after a brief delay to ensure destroy() has processed
        setTimeout(() => {
            checkWaveCompletion();
        }, 50);
    });
    unsubscribeCallbacks.push(enemyKilledUnsub);

    // Main spawn loop
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver || !isWaveActive) return;

        // Only spawn if we haven't reached the wave limit
        if (enemiesSpawnedThisWave < enemiesPerWave) {
            spawnTimer += k.dt();

            if (spawnTimer >= currentSpawnInterval) {
                const type = spawnRandomEnemy();
                enemiesSpawnedThisWave++;
                console.log(`[Wave ${state.currentWave}] Spawned ${type} (${enemiesSpawnedThisWave}/${enemiesPerWave})`);
                spawnTimer = 0;

                // Check completion if this was the last spawn
                if (enemiesSpawnedThisWave >= enemiesPerWave) {
                    setTimeout(() => checkWaveCompletion(), 100);
                }
            }
        }
    });
}

function checkWaveCompletion() {
    // Count enemies with current wave tag
    const waveTag = `wave_${state.currentWave}`;
    const waveEnemies = k.get(waveTag);
    const totalEnemies = k.get('enemy').length;

    // Check for off-screen enemies and kill them
    const screenMargin = 100; // Enemies must be within 100 pixels of screen
    let killedOffscreen = 0;

    waveEnemies.forEach(enemy => {
        if (!enemy.exists()) return;

        const isOffScreen =
            enemy.pos.x < -screenMargin ||
            enemy.pos.x > k.width() + screenMargin ||
            enemy.pos.y < -screenMargin ||
            enemy.pos.y > k.height() + screenMargin;

        if (isOffScreen) {
            console.log(`[Wave ${state.currentWave}] Killing off-screen ${enemy.enemyType} at (${Math.floor(enemy.pos.x)}, ${Math.floor(enemy.pos.y)})`);
            events.emit('enemyDamaged', enemy, 9999); // Kill instantly
            killedOffscreen++;
        }
    });

    const remainingWaveEnemies = k.get(waveTag).length;
    console.log(`[Wave ${state.currentWave}] Check: ${enemiesSpawnedThisWave}/${enemiesPerWave} spawned, ${remainingWaveEnemies} wave enemies alive, ${totalEnemies} total enemies${killedOffscreen > 0 ? `, killed ${killedOffscreen} off-screen` : ''}`);

    // Wave is complete when: all enemies spawned AND all wave-tagged enemies are dead
    if (enemiesSpawnedThisWave >= enemiesPerWave && remainingWaveEnemies === 0) {
        console.log(`[Wave ${state.currentWave}] Wave complete!`);
        completeWave();
    }
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
        currentSpawnInterval - 0.05
    );

    console.log(`[Wave ${state.currentWave}] Starting wave ${state.currentWave} with ${enemiesPerWave} enemies, spawn interval: ${currentSpawnInterval.toFixed(2)}s`);

    // Reset wave counters and start next wave after a brief delay
    setTimeout(() => {
        enemiesSpawnedThisWave = 0;
        isWaveActive = true;
    }, 1500); // 1.5 second break between waves
}

function spawnRandomEnemy() {
    // Get available enemy types based on current wave
    const availableTypes = getAvailableEnemyTypes();

    // Weighted random selection
    const weights = {
        charger: 10,
        fast: 8,
        tank: 4,
        circler: 6,
        shooter: 5,
        teleporter: 3,
        splitter: 2,
        swarm: 12,
    };

    // Calculate total weight for available types
    let totalWeight = 0;
    const availableWeights = {};
    availableTypes.forEach(type => {
        const weight = weights[type] || 5;
        availableWeights[type] = weight;
        totalWeight += weight;
    });

    // Pick random enemy based on weights
    let random = Math.random() * totalWeight;
    let type = availableTypes[0];

    for (const enemyType of availableTypes) {
        random -= availableWeights[enemyType];
        if (random <= 0) {
            type = enemyType;
            break;
        }
    }

    // Spawn at random edge position
    const pos = getRandomEdgePosition();

    // Emit spawn event with wave number and mark as wave enemy
    events.emit('spawnEnemy', type, pos, state.currentWave, true);
    return type; // Return the type for logging
}

function getAvailableEnemyTypes() {
    const wave = state.currentWave;
    const types = ['charger', 'fast', 'swarm']; // Always available

    // Unlock more types as waves progress
    if (wave >= 2) types.push('tank');
    if (wave >= 3) types.push('circler');
    if (wave >= 4) types.push('shooter');
    if (wave >= 6) types.push('teleporter');
    if (wave >= 8) types.push('splitter');

    return types;
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
