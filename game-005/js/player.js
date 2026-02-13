// Player system - movement and controls

import { events } from './events.js';
import { state } from './state.js';
import { createPlayerPrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;
let player;
let shootTimer = 0;
let unsubscribeCallbacks = [];

export function initPlayer(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];

    // Reset shoot timer
    shootTimer = 0;

    // Create player at center
    player = createPlayerPrefab(k, k.vec2(k.width() / 2, k.height() / 2));
    state.player = player;

    // Listen for damage events
    const playerDamagedUnsub = events.on('playerDamaged', (damage) => {
        if (!player.exists()) return;
        if (!player.invincible) {
            player.hp -= damage;
            player.invincible = true;
            player.invincibleTimer = 1.0;
            sounds.playerHurt();

            if (player.hp <= 0) {
                player.hp = 0;
                events.emit('playerDied');
            }
        }
    });
    unsubscribeCallbacks.push(playerDamagedUnsub);

    // Movement and shooting
    k.onUpdate(() => {
        if (!player.exists() || state.isPaused || state.isGameOver) return;

        // Apply stat multipliers
        const speed = player.speed * state.playerStats.moveSpeed;
        const movement = k.vec2(0, 0);

        // 8-directional movement (WASD or Arrow keys)
        if (k.isKeyDown("left") || k.isKeyDown("a")) movement.x -= 1;
        if (k.isKeyDown("right") || k.isKeyDown("d")) movement.x += 1;
        if (k.isKeyDown("up") || k.isKeyDown("w")) movement.y -= 1;
        if (k.isKeyDown("down") || k.isKeyDown("s")) movement.y += 1;

        if (movement.len() > 0) {
            player.pos = player.pos.add(
                movement.unit().scale(speed * k.dt())
            );
        }

        // Keep player in bounds
        player.pos.x = Math.max(20, Math.min(k.width() - 20, player.pos.x));
        player.pos.y = Math.max(20, Math.min(k.height() - 20, player.pos.y));

        // Auto-shooting
        const fireRate = player.fireRate * state.playerStats.fireRate;
        shootTimer += k.dt();
        if (shootTimer >= fireRate) {
            const nearestEnemy = findNearestEnemy();
            if (nearestEnemy) {
                const dir = nearestEnemy.pos.sub(player.pos).unit();
                events.emit('playerShoot', player.pos, dir, player.damage * state.playerStats.damage);
                shootTimer = 0;
            }
        }

        // Update time alive
        state.timeAlive += k.dt();
    });
}

function findNearestEnemy() {
    const enemies = k.get("enemy");
    if (enemies.length === 0) return null;

    let nearest = enemies[0];
    let minDist = player.pos.dist(nearest.pos);

    for (const enemy of enemies) {
        const dist = player.pos.dist(enemy.pos);
        if (dist < minDist) {
            minDist = dist;
            nearest = enemy;
        }
    }

    return nearest;
}
