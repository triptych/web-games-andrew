// Projectile system

import { events } from './events.js';
import { createProjectilePrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;

export function initProjectiles(kaplay) {
    k = kaplay;

    // Listen for player shoot events
    events.on('playerShoot', (fromPos, dir, damage) => {
        createProjectilePrefab(k, fromPos, dir, damage, "player");
        sounds.playerShoot();
    });

    // Listen for enemy shoot events (for future shooter enemies)
    events.on('enemyShoot', (fromPos, dir, damage) => {
        createProjectilePrefab(k, fromPos, dir, damage, "enemy");
    });
}
