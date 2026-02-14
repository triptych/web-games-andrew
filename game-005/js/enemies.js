// Enemy system - spawning, AI, and behaviors

import { events } from './events.js';
import { state } from './state.js';
import { createEnemyPrefab, createXPGemPrefab, createHealthPickupPrefab } from './prefabs.js';
import { sounds } from './sounds.js';
import { HEALTH_PICKUP_CONFIG } from './config.js';

let k;
let unsubscribeCallbacks = [];

export function initEnemies(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];

    // Listen for spawn requests
    const spawnEnemyUnsub = events.on('spawnEnemy', (type, pos, waveNumber = null, isWaveEnemy = true) => {
        spawnEnemy(type, pos, waveNumber, isWaveEnemy);
    });
    unsubscribeCallbacks.push(spawnEnemyUnsub);

    // Listen for damage events
    const enemyDamagedUnsub = events.on('enemyDamaged', (enemy, damage) => {
        if (!enemy.exists()) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            killEnemy(enemy);
        } else {
            sounds.enemyHit();
        }
    });
    unsubscribeCallbacks.push(enemyDamagedUnsub);
}

function spawnEnemy(type, pos, waveNumber = null, isWaveEnemy = true) {
    const enemy = createEnemyPrefab(k, type, pos, waveNumber, isWaveEnemy);
    if (enemy) {
        const waveTag = isWaveEnemy ? `wave_${waveNumber}` : 'bonus';
        console.log(`[Enemy] Created ${type} (${waveTag}) at (${Math.floor(pos.x)}, ${Math.floor(pos.y)})`);
        events.emit('enemySpawned', enemy);
    } else {
        console.error(`[Enemy] Failed to create ${type}!`);
    }
    return enemy;
}

function killEnemy(enemy) {
    console.log(`[Enemy] Killing ${enemy.enemyType} at (${Math.floor(enemy.pos.x)}, ${Math.floor(enemy.pos.y)})`);
    sounds.enemyDeath();

    // Drop XP
    createXPGemPrefab(k, enemy.pos, enemy.xpValue);

    // Chance to drop health pickup
    if (Math.random() < HEALTH_PICKUP_CONFIG.dropChance) {
        createHealthPickupPrefab(k, enemy.pos);
    }

    // Update kill count
    state.kills++;

    // Destroy enemy
    k.destroy(enemy);

    events.emit('enemyKilled', enemy);
}
