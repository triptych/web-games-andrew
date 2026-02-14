// Reusable entity factory functions - Advanced Prefab System

import { PLAYER_CONFIG, PLAYER_CLASSES, ENEMY_DEFS, XP_CONFIG, HEALTH_PICKUP_CONFIG } from './config.js';
import { events } from './events.js';
import { state } from './state.js';
import { sounds } from './sounds.js';

// ============== BEHAVIOR COMPONENTS ==============

// Behavior component for orbiting movement
function addOrbitBehavior(entity, k, def) {
    entity.orbitAngle = Math.random() * Math.PI * 2;
    entity.orbitDistance = def.orbitDistance || 150;
    entity.orbitSpeed = def.orbitSpeed || 2;

    // Add a separate update callback (doesn't replace the base one)
    entity.onUpdate(() => {
        const player = k.get("player")[0];
        if (!player || !player.exists()) return;

        // Update orbit angle
        entity.orbitAngle += entity.orbitSpeed * k.dt();

        // Calculate target position
        const targetX = player.pos.x + Math.cos(entity.orbitAngle) * entity.orbitDistance;
        const targetY = player.pos.y + Math.sin(entity.orbitAngle) * entity.orbitDistance;
        const target = k.vec2(targetX, targetY);

        // Move toward orbit position
        const dir = target.sub(entity.pos).unit();
        entity.pos = entity.pos.add(dir.scale(entity.speed * k.dt()));
    });
}

// Behavior component for shooter enemies
function addShooterBehavior(entity, k, def) {
    entity.shootTimer = 0;
    entity.shootCooldown = def.shootCooldown || 2.0;
    entity.shootRange = def.shootRange || 250;

    // Add a separate update callback (doesn't replace the base one)
    entity.onUpdate(() => {
        const player = k.get("player")[0];
        if (!player || !player.exists()) return;

        const dist = entity.pos.dist(player.pos);

        // Move to shooting range
        if (dist > entity.shootRange) {
            const dir = player.pos.sub(entity.pos).unit();
            entity.pos = entity.pos.add(dir.scale(entity.speed * k.dt()));
        } else if (dist < entity.shootRange - 50) {
            // Back away if too close
            const dir = entity.pos.sub(player.pos).unit();
            entity.pos = entity.pos.add(dir.scale(entity.speed * 0.5 * k.dt()));
        }

        // Shoot at player
        entity.shootTimer += k.dt();
        if (entity.shootTimer >= entity.shootCooldown && dist <= entity.shootRange) {
            const dir = player.pos.sub(entity.pos).unit();
            events.emit('enemyShoot', entity.pos, dir, entity.damage);
            entity.shootTimer = 0;
        }
    });
}

// Behavior component for teleporting enemies
function addTeleportBehavior(entity, k, def) {
    entity.teleportTimer = 0;
    entity.teleportCooldown = def.teleportCooldown || 3.0;
    entity.teleportRange = def.teleportRange || 200;
    entity.isTeleporting = false;

    // Add a separate update callback (doesn't replace the base one)
    entity.onUpdate(() => {
        const player = k.get("player")[0];
        if (!player || !player.exists()) return;

        entity.teleportTimer += k.dt();

        if (entity.teleportTimer >= entity.teleportCooldown && !entity.isTeleporting) {
            // Teleport near player
            const angle = Math.random() * Math.PI * 2;
            const distance = entity.teleportRange * (0.5 + Math.random() * 0.5);
            const newX = player.pos.x + Math.cos(angle) * distance;
            const newY = player.pos.y + Math.sin(angle) * distance;

            // Clamp to screen bounds
            entity.pos.x = Math.max(30, Math.min(k.width() - 30, newX));
            entity.pos.y = Math.max(30, Math.min(k.height() - 30, newY));

            entity.teleportTimer = 0;
            entity.isTeleporting = true;

            // Visual effect
            entity.opacity = 0.3;
            setTimeout(() => {
                if (entity.exists()) {
                    entity.opacity = 1;
                    entity.isTeleporting = false;
                }
            }, 200);
        }
    });
}

// Behavior component for swarm enemies (erratic movement)
function addSwarmBehavior(entity, k, def) {
    entity.swarmOffset = k.vec2((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80);
    entity.swarmTimer = 0;

    // Add a separate update callback (doesn't replace the base one)
    entity.onUpdate(() => {
        const player = k.get("player")[0];
        if (!player || !player.exists()) return;

        // If enemy is too far from player, move directly toward them (prevent wandering off)
        const distToPlayer = entity.pos.dist(player.pos);
        if (distToPlayer > 300) {
            const dir = player.pos.sub(entity.pos).unit();
            entity.pos = entity.pos.add(dir.scale(entity.speed * k.dt()));
            return;
        }

        // Change direction periodically
        entity.swarmTimer += k.dt();
        if (entity.swarmTimer >= 1.0) {
            entity.swarmOffset = k.vec2((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80);
            entity.swarmTimer = 0;
        }

        // Move with erratic offset
        const target = player.pos.add(entity.swarmOffset);
        const dir = target.sub(entity.pos).unit();
        entity.pos = entity.pos.add(dir.scale(entity.speed * k.dt()));
    });
}

// ============== PLAYER PREFAB ==============

export function createPlayerPrefab(k, pos, playerClass = 'ranger') {
    const classDef = PLAYER_CLASSES[playerClass] || PLAYER_CLASSES.ranger;

    // Shadow
    const shadow = k.add([
        k.pos(pos.x + 3, pos.y + 3),
        k.circle(14),
        k.color(0, 0, 0),
        k.opacity(0.4),
        k.anchor("center"),
        k.z(9),
        "playerShadow",
    ]);

    // Player entity - more detailed character-like design
    const player = k.add([
        k.pos(pos),
        k.circle(14),
        k.color(classDef.color),
        k.outline(4, k.rgb(classDef.outlineColor)),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "player",
    ]);

    // Add visual details for character (inner core)
    player.add([
        k.circle(8),
        k.color(classDef.outlineColor),
        k.anchor("center"),
        k.opacity(0.7),
    ]);

    // Add directional indicator
    const dirIndicator = player.add([
        k.rect(3, 10),
        k.pos(0, -8),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.opacity(0.9),
    ]);

    // Custom properties - RPG style
    player.shadow = shadow;
    player.playerClass = playerClass;
    player.className = classDef.name;
    player.hp = classDef.hp;
    player.maxHp = classDef.hp;
    player.speed = classDef.speed;
    player.level = 1;
    player.xp = 0;
    player.xpToNext = 10;
    player.fireRate = classDef.fireRate;
    player.damage = classDef.damage;
    player.pickupRadius = PLAYER_CONFIG.pickupRadius;
    player.invincible = false;
    player.invincibleTimer = 0;

    // RPG Stats
    player.stats = { ...classDef.stats };

    // Hitbox indicator (small core)
    player.add([
        k.circle(4),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.opacity(0.8),
    ]);

    // Update logic
    player.onUpdate(() => {
        // Sync shadow position
        shadow.pos = k.vec2(player.pos.x + 3, player.pos.y + 3);

        // Invincibility frames
        if (player.invincible) {
            player.invincibleTimer -= k.dt();
            player.opacity = Math.sin(k.time() * 30) * 0.5 + 0.5;
            if (player.invincibleTimer <= 0) {
                player.invincible = false;
                player.opacity = 1;
            }
        }

        // Rotate direction indicator based on movement or nearest enemy
        const enemies = k.get("enemy");
        if (enemies.length > 0) {
            const nearest = enemies[0];
            const angle = Math.atan2(nearest.pos.y - player.pos.y, nearest.pos.x - player.pos.x);
            dirIndicator.angle = (angle * 180 / Math.PI) + 90;
        }
    });

    // Note: Collision detection is handled manually in each entity's onUpdate
    // for better reliability (enemy, XP gems, health pickups all check collision themselves)

    // Destroy shadow when player is destroyed
    player.onDestroy(() => {
        k.destroy(shadow);
    });

    return player;
}

function collectXP(player, gem) {
    sounds.xpCollect();
    events.emit('xpGained', gem.value);
    gem.destroy();

    // Note: Level up logic is now handled by upgrades.js module
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

// ============== ENEMY PREFAB ==============

export function createEnemyPrefab(k, type, pos, waveNumber = null, isWaveEnemy = true) {
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

    const tags = ["enemy"];
    // Tag wave enemies with their wave number for tracking
    if (isWaveEnemy && waveNumber !== null) {
        tags.push(`wave_${waveNumber}`);
    }

    const enemy = k.add([
        k.pos(pos),
        k.circle(def.size),
        k.color(def.color),
        k.outline(2, def.outlineColor),
        k.anchor("center"),
        k.area(),
        k.z(10),
        ...tags,
    ]);

    // Add visual details based on type
    if (type === 'teleporter') {
        // Add glowing core
        enemy.add([
            k.circle(def.size * 0.5),
            k.color(200, 255, 255),
            k.anchor("center"),
            k.opacity(0.8),
        ]);
    } else if (type === 'shooter') {
        // Add barrel indicator
        enemy.add([
            k.rect(3, 8),
            k.pos(0, -def.size),
            k.anchor("center"),
            k.color(255, 255, 255),
            k.opacity(0.7),
        ]);
    } else if (type === 'splitter') {
        // Add segmented look
        enemy.add([
            k.circle(def.size * 0.6),
            k.color(def.outlineColor),
            k.anchor("center"),
            k.opacity(0.5),
        ]);
    } else if (type === 'circler') {
        // Add orbital rings
        enemy.add([
            k.circle(def.size * 1.3),
            k.outline(1),
            k.color(0, 0, 0, 0),
            k.anchor("center"),
        ]);
    } else if (type === 'swarm') {
        // Add bright pulsing core for visibility
        const core = enemy.add([
            k.circle(def.size * 0.7),
            k.color(255, 255, 255),
            k.anchor("center"),
            k.opacity(0.9),
        ]);
        // Pulsing animation
        enemy.onUpdate(() => {
            if (core && core.exists()) {
                core.opacity = 0.6 + Math.sin(k.time() * 10) * 0.4;
            }
        });
    }

    enemy.shadow = shadow;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.speed = def.speed;
    enemy.damage = def.damage;
    enemy.xpValue = def.xpValue;
    enemy.enemyType = type;
    enemy.enemyDef = def;
    enemy.waveNumber = waveNumber;
    enemy.isWaveEnemy = isWaveEnemy;

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

    // Base update function
    enemy.onUpdate(() => {
        shadow.pos = k.vec2(enemy.pos.x + 1, enemy.pos.y + 2);

        // Update HP bar
        const hpPercent = enemy.hp / enemy.maxHp;
        hpBar.width = def.size * 2 * hpPercent;

        // Destroy enemies that wander too far off-screen (prevents orphaned enemies)
        const maxDistance = 500; // Maximum distance from screen bounds
        if (enemy.pos.x < -maxDistance || enemy.pos.x > k.width() + maxDistance ||
            enemy.pos.y < -maxDistance || enemy.pos.y > k.height() + maxDistance) {
            console.warn(`[Enemy] ${type} wandered too far off-screen at (${Math.floor(enemy.pos.x)}, ${Math.floor(enemy.pos.y)}), destroying...`);
            // Set HP to 0 to trigger proper death handling
            enemy.hp = 0;
            events.emit('enemyDamaged', enemy, 0);
            return;
        }

        const player = k.get("player")[0];
        if (player && player.exists()) {
            // Manual collision detection with player (for ALL enemy types)
            const dist = enemy.pos.dist(player.pos);
            if (dist < def.size + 14) { // Enemy size + player size
                if (!player.invincible) {
                    events.emit('playerDamaged', enemy.damage);
                    player.invincible = true;
                    player.invincibleTimer = 1.0;
                }
            }

            // Default chase behavior (only for chase type enemies)
            if (def.behavior === 'chase') {
                const dir = player.pos.sub(enemy.pos).unit();
                enemy.pos = enemy.pos.add(dir.scale(enemy.speed * k.dt()));
            }
        }
    });

    // Apply behavior components based on enemy type
    switch (def.behavior) {
        case 'orbit':
            addOrbitBehavior(enemy, k, def);
            break;
        case 'shoot':
            addShooterBehavior(enemy, k, def);
            break;
        case 'teleport':
            addTeleportBehavior(enemy, k, def);
            break;
        case 'swarm':
            addSwarmBehavior(enemy, k, def);
            break;
    }

    // Destroy shadow when enemy is destroyed
    enemy.onDestroy(() => {
        k.destroy(shadow);

        // Handle splitter behavior on death - spawn bonus enemies (not counted in wave)
        if (def.splitCount && def.splitType) {
            for (let i = 0; i < def.splitCount; i++) {
                const angle = (Math.PI * 2 / def.splitCount) * i;
                const offset = k.vec2(Math.cos(angle) * 30, Math.sin(angle) * 30);
                setTimeout(() => {
                    // Mark as bonus enemy (not part of wave tracking)
                    events.emit('spawnEnemy', def.splitType, enemy.pos.add(offset), null, false);
                }, i * 100);
            }
        }
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
        if (player && player.exists()) {
            gem.attractRadius = XP_CONFIG.gemAttractionRadius * state.playerStats.pickupRadius;

            if (gem.pos.dist(player.pos) < gem.attractRadius) {
                const dir = player.pos.sub(gem.pos).unit();
                gem.pos = gem.pos.add(dir.scale(gem.attractSpeed * k.dt()));
            }

            // Manual collision detection (more reliable than onCollide)
            const dist = gem.pos.dist(player.pos);
            if (dist < 20) { // Player radius + gem radius
                collectXP(player, gem);
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
        if (player && player.exists()) {
            pickup.attractRadius = HEALTH_PICKUP_CONFIG.attractionRadius * state.playerStats.pickupRadius;

            if (pickup.pos.dist(player.pos) < pickup.attractRadius) {
                const dir = player.pos.sub(pickup.pos).unit();
                pickup.pos = pickup.pos.add(dir.scale(pickup.attractSpeed * k.dt()));
            }

            // Manual collision detection (more reliable than onCollide)
            const dist = pickup.pos.dist(player.pos);
            if (dist < 20) { // Player radius + pickup radius
                collectHealth(player, pickup);
            }
        }
    });

    return pickup;
}
