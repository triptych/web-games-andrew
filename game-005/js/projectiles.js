// Projectile system

import { events } from './events.js';
import { createProjectilePrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;
let unsubscribeCallbacks = [];

export function initProjectiles(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];

    // Listen for player shoot events
    const playerShootUnsub = events.on('playerShoot', (fromPos, dir, damage) => {
        createProjectilePrefab(k, fromPos, dir, damage, "player");
        sounds.playerShoot();
    });
    unsubscribeCallbacks.push(playerShootUnsub);

    // Listen for enemy shoot events (for future shooter enemies)
    const enemyShootUnsub = events.on('enemyShoot', (fromPos, dir, damage) => {
        createProjectilePrefab(k, fromPos, dir, damage, "enemy");
    });
    unsubscribeCallbacks.push(enemyShootUnsub);
}
