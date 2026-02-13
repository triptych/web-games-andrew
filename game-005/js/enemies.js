// Enemy system - spawning, AI, and behaviors

import { events } from './events.js';
import { state } from './state.js';
import { createEnemyPrefab, createXPGemPrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;

export function initEnemies(kaplay) {
    k = kaplay;

    // Listen for spawn requests
    events.on('spawnEnemy', (type, pos) => {
        spawnEnemy(type, pos);
    });

    // Listen for damage events
    events.on('enemyDamaged', (enemy, damage) => {
        if (!enemy.exists()) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            killEnemy(enemy);
        } else {
            sounds.enemyHit();
        }
    });
}

function spawnEnemy(type, pos) {
    const enemy = createEnemyPrefab(k, type, pos);
    if (enemy) {
        events.emit('enemySpawned', enemy);
    }
    return enemy;
}

function killEnemy(enemy) {
    sounds.enemyDeath();

    // Drop XP
    createXPGemPrefab(k, enemy.pos, enemy.xpValue);

    // Update kill count
    state.kills++;

    // Destroy enemy
    k.destroy(enemy);

    events.emit('enemyKilled', enemy);
}
