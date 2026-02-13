// Reusable entity factory functions

import { PLAYER_CONFIG, ENEMY_DEFS, XP_CONFIG, HEALTH_PICKUP_CONFIG } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { sounds } from './sounds.js';

export function createPlayerPrefab(k, pos) {
    // Shadow
    const shadow = k.add([
        k.pos(pos.x + 2, pos.y + 2),
        k.circle(12),
        k.color(0, 0, 0),
        k.opacity(0.3),
        k.anchor("center"),
        k.z(9),
        "playerShadow",
    ]);

    // Player entity
    const player = k.add([
        k.pos(pos),
        k.circle(12),
        k.color(100, 200, 255),
        k.outline(3, k.rgb(200, 230, 255)),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "player",
    ]);

    // Custom properties
    player.shadow = shadow;
    player.hp = PLAYER_CONFIG.startingHp;
    player.maxHp = PLAYER_CONFIG.startingHp;
    player.speed = PLAYER_CONFIG.startingSpeed;
    player.level = 1;
    player.xp = 0;
    player.xpToNext = 10;
    player.fireRate = PLAYER_CONFIG.fireRate;
    player.damage = PLAYER_CONFIG.baseDamage;
    player.pickupRadius = PLAYER_CONFIG.pickupRadius;
    player.invincible = false;
    player.invincibleTimer = 0;

    // Hitbox indicator (small core)
    player.add([
        k.circle(3),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.opacity(0.8),
    ]);

    // Update logic
    player.onUpdate(() => {
        // Sync shadow position
        shadow.pos = k.vec2(player.pos.x + 2, player.pos.y + 2);

        // Invincibility frames
        if (player.invincible) {
            player.invincibleTimer -= k.dt();
            player.opacity = Math.sin(k.time() * 30) * 0.5 + 0.5;
            if (player.invincibleTimer <= 0) {
                player.invincible = false;
                player.opacity = 1;
            }
        }
    });

    // Collision handling
    player.onCollide("enemy", (enemy) => {
        if (!player.invincible) {
            events.emit('playerDamaged', enemy.damage);
        }
    });

    // Collision with XP gems
    player.onCollide("xpGem", (gem) => {
        collectXP(player, gem);
    });

    // Collision with health pickups
    player.onCollide("healthPickup", (pickup) => {
        collectHealth(player, pickup);
    });

    // Destroy shadow when player is destroyed
    player.onDestroy(() => {
        k.destroy(shadow);
    });

    return player;
}

function collectXP(player, gem) {
    player.xp += gem.value;
    events.emit('xpGained', gem.value);
    gem.destroy();

    // Check for level up
    if (player.xp >= player.xpToNext) {
        player.level++;
        player.xp -= player.xpToNext;
        player.xpToNext = Math.floor(player.xpToNext * 1.5);
        events.emit('playerLevelUp', player.level);
    }
}

function collectHealth(player, pickup) {
    const healAmount = Math.min(pickup.healAmount, player.maxHp - player.hp);
    if (healAmount > 0) {
        player.hp += healAmount;
        sounds.healthCollect();
        events.emit('healthGained', healAmount);
        pickup.destroy();
    }
}

export function createEnemyPrefab(k, type, pos) {
    const def = ENEMY_DEFS[type];
    if (!def) {
        console.error(`Unknown enemy type: ${type}`);
        return null;
    }

    const shadow = k.add([
        k.pos(pos.x + 1, pos.y + 2),
        k.circle(def.size * 0.9),
        k.color(0, 0, 0),
        k.opacity(0.25),
        k.anchor("center"),
        k.z(9),
        "enemyShadow",
    ]);

    const enemy = k.add([
        k.pos(pos),
        k.circle(def.size),
        k.color(def.color),
        k.outline(2, def.outlineColor),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "enemy",
    ]);

    enemy.shadow = shadow;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.speed = def.speed;
    enemy.damage = def.damage;
    enemy.xpValue = def.xpValue;
    enemy.enemyType = type;

    // HP bar
    const hpBarBg = enemy.add([
        k.rect(def.size * 2, 3),
        k.pos(-def.size, -def.size - 8),
        k.color(50, 50, 50),
        k.z(11),
    ]);

    const hpBar = enemy.add([
        k.rect(def.size * 2, 3),
        k.pos(-def.size, -def.size - 8),
        k.color(255, 50, 50),
        k.z(12),
    ]);

    enemy.hpBar = hpBar;
    enemy.hpBarBg = hpBarBg;

    enemy.onUpdate(() => {
        shadow.pos = k.vec2(enemy.pos.x + 1, enemy.pos.y + 2);

        // Update HP bar
        const hpPercent = enemy.hp / enemy.maxHp;
        hpBar.width = def.size * 2 * hpPercent;

        // Move toward player
        const player = k.get("player")[0];
        if (player && player.exists()) {
            const dir = player.pos.sub(enemy.pos).unit();
            enemy.pos = enemy.pos.add(dir.scale(enemy.speed * k.dt()));

            // Manual collision detection with player
            const dist = enemy.pos.dist(player.pos);
            if (dist < def.size + 12) { // Enemy size + player size
                if (!player.invincible) {
                    events.emit('playerDamaged', enemy.damage);
                    player.invincible = true;
                    player.invincibleTimer = 1.0;
                }
            }
        }
    });

    // Destroy shadow when enemy is destroyed
    enemy.onDestroy(() => {
        k.destroy(shadow);
    });

    return enemy;
}

export function createProjectilePrefab(k, pos, dir, damage, owner) {
    const isPlayer = owner === "player";

    const projectile = k.add([
        k.pos(pos),
        k.circle(4),
        k.color(isPlayer ? [100, 200, 255] : [255, 100, 50]),
        k.outline(1, k.rgb(255, 255, 255)),
        k.anchor("center"),
        k.area(),
        k.z(5),
        isPlayer ? "playerBullet" : "enemyBullet",
    ]);

    projectile.damage = damage;
    projectile.vel = dir.scale(400);
    projectile.lifetime = 3;
    projectile.owner = owner;

    // Movement and collision checking
    projectile.onUpdate(() => {
        projectile.pos = projectile.pos.add(projectile.vel.scale(k.dt()));
        projectile.lifetime -= k.dt();

        if (projectile.lifetime <= 0 ||
            projectile.pos.x < 0 || projectile.pos.x > k.width() ||
            projectile.pos.y < 0 || projectile.pos.y > k.height()) {
            k.destroy(projectile);
            return;
        }

        // Manual collision detection (more reliable than onCollide)
        if (isPlayer) {
            // Check collision with enemies
            const enemies = k.get("enemy");
            for (const enemy of enemies) {
                if (enemy.exists()) {
                    const dist = projectile.pos.dist(enemy.pos);
                    if (dist < 15) { // Enemy size + projectile size
                        events.emit('enemyDamaged', enemy, projectile.damage);
                        k.destroy(projectile);
                        return;
                    }
                }
            }
        } else {
            // Check collision with player
            const player = k.get("player")[0];
            if (player && player.exists()) {
                const dist = projectile.pos.dist(player.pos);
                if (dist < 15) { // Player size + projectile size
                    if (!player.invincible) {
                        events.emit('playerDamaged', projectile.damage);
                    }
                    k.destroy(projectile);
                    return;
                }
            }
        }
    });

    return projectile;
}

export function createXPGemPrefab(k, pos, value) {
    const gem = k.add([
        k.pos(pos),
        k.circle(6),
        k.color(50, 255, 150),
        k.outline(2, k.rgb(150, 255, 200)),
        k.anchor("center"),
        k.area(),
        k.z(8),
        "xpGem",
    ]);

    gem.value = value;
    gem.attractRadius = XP_CONFIG.gemAttractionRadius * state.playerStats.pickupRadius;
    gem.attractSpeed = XP_CONFIG.gemAttractionSpeed;
    gem.bobOffset = Math.random() * Math.PI * 2;

    gem.onUpdate(() => {
        // Bob animation
        gem.pos.y += Math.sin(k.time() * 5 + gem.bobOffset) * 0.5;

        // Magnetic attraction to player
        const player = k.get("player")[0];
        if (player) {
            gem.attractRadius = XP_CONFIG.gemAttractionRadius * state.playerStats.pickupRadius;

            if (gem.pos.dist(player.pos) < gem.attractRadius) {
                const dir = player.pos.sub(gem.pos).unit();
                gem.pos = gem.pos.add(dir.scale(gem.attractSpeed * k.dt()));
            }
        }
    });

    return gem;
}

export function createHealthPickupPrefab(k, pos) {
    // Heart shape using multiple circles
    const pickup = k.add([
        k.pos(pos),
        k.circle(8),
        k.color(255, 100, 120),
        k.outline(2, k.rgb(255, 150, 170)),
        k.anchor("center"),
        k.area(),
        k.z(8),
        "healthPickup",
    ]);

    // Add a plus sign to indicate health
    pickup.add([
        k.rect(3, 10),
        k.pos(0, 0),
        k.anchor("center"),
        k.color(255, 255, 255),
    ]);
    pickup.add([
        k.rect(10, 3),
        k.pos(0, 0),
        k.anchor("center"),
        k.color(255, 255, 255),
    ]);

    pickup.healAmount = HEALTH_PICKUP_CONFIG.healAmount;
    pickup.attractRadius = HEALTH_PICKUP_CONFIG.attractionRadius * state.playerStats.pickupRadius;
    pickup.attractSpeed = HEALTH_PICKUP_CONFIG.attractionSpeed;
    pickup.bobOffset = Math.random() * Math.PI * 2;

    pickup.onUpdate(() => {
        // Bob animation
        pickup.pos.y += Math.sin(k.time() * 5 + pickup.bobOffset) * 0.5;

        // Pulse effect
        const scale = 1 + Math.sin(k.time() * 3) * 0.1;
        pickup.scale = k.vec2(scale, scale);

        // Magnetic attraction to player
        const player = k.get("player")[0];
        if (player) {
            pickup.attractRadius = HEALTH_PICKUP_CONFIG.attractionRadius * state.playerStats.pickupRadius;

            if (pickup.pos.dist(player.pos) < pickup.attractRadius) {
                const dir = player.pos.sub(pickup.pos).unit();
                pickup.pos = pickup.pos.add(dir.scale(pickup.attractSpeed * k.dt()));
            }
        }
    });

    return pickup;
}
