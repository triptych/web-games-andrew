/**
 * Enemy System Module
 * Handles enemy AI, behaviors, and rendering using Kaplay drawing API
 */

import { state } from './state.js';
import { getTile } from './map.js';
import { degToRad, normalizeAngle, clamp } from './utils.js';

let k = null;

// AI States
const AIState = {
    PATROL: 'patrol',
    ALERT: 'alert',
    CHASE: 'chase',
    ATTACK: 'attack',
    DEAD: 'dead'
};

/**
 * Enemy type definitions
 * Based on Phase 3 specifications
 */
export const EnemyTypes = {
    GUARD: {
        id: 'guard',
        name: 'Guard',
        hp: 50,
        damage: [5, 10],
        speed: 2,
        range: 8,
        fireRate: 1, // shots per second
        color: [100, 150, 100], // Green uniform
        size: 0.4,
        fovAngle: 60,
        fovDistance: 10,
    },
    OFFICER: {
        id: 'officer',
        name: 'Officer',
        hp: 75,
        damage: [10, 15],
        speed: 3,
        range: 10,
        fireRate: 1.5,
        color: [100, 100, 200], // Blue uniform
        size: 0.4,
        fovAngle: 70,
        fovDistance: 12,
    },
    SS_TROOPER: {
        id: 'ss_trooper',
        name: 'SS Trooper',
        hp: 100,
        damage: [15, 25],
        speed: 4,
        range: 12,
        fireRate: 2,
        color: [80, 80, 80], // Dark gray uniform
        size: 0.4,
        fovAngle: 80,
        fovDistance: 14,
    },
    DOG: {
        id: 'dog',
        name: 'Dog',
        hp: 30,
        damage: [15, 20],
        speed: 5,
        range: 0.5, // Melee only
        fireRate: 2, // Bite rate
        color: [139, 69, 19], // Brown
        size: 0.3,
        fovAngle: 120,
        fovDistance: 12,
    },
    BOSS: {
        id: 'boss',
        name: 'Boss',
        hp: 500,
        damage: [25, 50],
        speed: 2,
        range: 15,
        fireRate: 2.5,
        color: [200, 50, 50], // Red armor
        size: 0.6,
        fovAngle: 90,
        fovDistance: 16,
    }
};

/**
 * Enemy class
 */
class Enemy {
    constructor(type, x, y, angle = 0) {
        this.type = EnemyTypes[type] || EnemyTypes.GUARD;
        this.x = x;
        this.y = y;
        this.angle = angle; // Facing direction in degrees

        // Stats
        this.hp = this.type.hp;
        this.maxHp = this.type.hp;
        this.alive = true;

        // AI State
        this.state = AIState.PATROL;
        this.stateTime = 0;
        this.target = null; // Reference to player
        this.lastKnownPlayerPos = null;
        this.alertTimer = 0;

        // Patrol
        this.patrolPoints = [];
        this.currentPatrolIndex = 0;
        this.patrolWaitTime = 0;

        // Combat
        this.lastFireTime = 0;
        this.shootCooldown = 1000 / this.type.fireRate;

        // Animation
        this.animFrame = 0;
        this.animTime = 0;
        this.deathAnimTime = 0;

        // Movement
        this.moveX = 0;
        this.moveY = 0;
    }

    /**
     * Check if player is in field of view
     */
    canSeePlayer(player) {
        if (!player) return false;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Too far
        if (distance > this.type.fovDistance) return false;

        // Calculate angle to player
        const angleToPlayer = Math.atan2(dy, dx) * (180 / Math.PI);
        const angleDiff = Math.abs(normalizeAngle(angleToPlayer - this.angle));

        // Check if within FOV cone
        const halfFov = this.type.fovAngle / 2;
        if (angleDiff > halfFov && angleDiff < 360 - halfFov) {
            return false;
        }

        // Check line of sight (no walls between)
        if (!this.hasLineOfSight(player.x, player.y)) {
            return false;
        }

        return true;
    }

    /**
     * Simple line-of-sight check using raycasting
     */
    hasLineOfSight(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Step along line
        const steps = Math.floor(distance * 2);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const checkX = this.x + dx * t;
            const checkY = this.y + dy * t;

            // Check if this point is in a wall
            const tile = getTile(checkX, checkY);
            if (tile !== 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Update AI behavior
     */
    update(dt, player) {
        if (!this.alive) {
            this.updateDeath(dt);
            return;
        }

        this.stateTime += dt;
        this.target = player;

        // Update animation
        this.animTime += dt;
        if (this.animTime > 0.2) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTime = 0;
        }

        // State machine
        switch (this.state) {
            case AIState.PATROL:
                this.updatePatrol(dt, player);
                break;
            case AIState.ALERT:
                this.updateAlert(dt, player);
                break;
            case AIState.CHASE:
                this.updateChase(dt, player);
                break;
            case AIState.ATTACK:
                this.updateAttack(dt, player);
                break;
        }
    }

    /**
     * Patrol state - walk between waypoints
     */
    updatePatrol(dt, player) {
        // Check for player
        if (this.canSeePlayer(player)) {
            this.enterAlertState(player);
            return;
        }

        // Simple patrol: rotate slowly
        this.angle += 30 * dt;
        this.angle = normalizeAngle(this.angle);
    }

    /**
     * Alert state - investigate
     */
    updateAlert(dt, player) {
        this.alertTimer += dt;

        // Check for player
        if (this.canSeePlayer(player)) {
            this.enterChaseState(player);
            return;
        }

        // Look around
        this.angle += 60 * dt;
        this.angle = normalizeAngle(this.angle);

        // Return to patrol after timeout
        if (this.alertTimer > 5) {
            this.enterPatrolState();
        }
    }

    /**
     * Chase state - pursue player
     */
    updateChase(dt, player) {
        if (!player) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Face player
        this.angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Check if in attack range
        if (distance <= this.type.range && this.hasLineOfSight(player.x, player.y)) {
            this.enterAttackState(player);
            return;
        }

        // Move toward player (simple direct movement)
        const moveSpeed = this.type.speed * dt;
        const dirX = dx / distance;
        const dirY = dy / distance;

        const newX = this.x + dirX * moveSpeed;
        const newY = this.y + dirY * moveSpeed;

        // Simple collision check
        if (getTile(newX, this.y) === 0) {
            this.x = newX;
        }
        if (getTile(this.x, newY) === 0) {
            this.y = newY;
        }

        // Lost sight of player
        if (!this.canSeePlayer(player)) {
            this.lastKnownPlayerPos = { x: player.x, y: player.y };
            this.enterAlertState(player);
        }
    }

    /**
     * Attack state - shoot at player
     */
    updateAttack(dt, player) {
        if (!player) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Face player
        this.angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Too far - chase
        if (distance > this.type.range) {
            this.enterChaseState(player);
            return;
        }

        // No line of sight - chase
        if (!this.hasLineOfSight(player.x, player.y)) {
            this.enterChaseState(player);
            return;
        }

        // Shoot at player
        const now = Date.now();
        if (now - this.lastFireTime > this.shootCooldown) {
            this.shootAtPlayer(player);
            this.lastFireTime = now;
        }

        // Strafe occasionally (move perpendicular to player)
        if (Math.random() < 0.1) {
            const moveSpeed = this.type.speed * dt * 0.5;
            const perpAngle = this.angle + (Math.random() < 0.5 ? 90 : -90);
            const perpRad = degToRad(perpAngle);

            const newX = this.x + Math.cos(perpRad) * moveSpeed;
            const newY = this.y + Math.sin(perpRad) * moveSpeed;

            if (getTile(newX, this.y) === 0) {
                this.x = newX;
            }
            if (getTile(this.x, newY) === 0) {
                this.y = newY;
            }
        }
    }

    /**
     * Update death animation
     */
    updateDeath(dt) {
        this.deathAnimTime += dt;
        // Body stays on ground after death
    }

    /**
     * Shoot at player
     */
    shootAtPlayer(player) {
        if (!player) return;

        // Calculate accuracy (distance-based)
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Accuracy decreases with distance
        const baseAccuracy = 0.8;
        const accuracy = baseAccuracy * Math.max(0.3, 1 - distance / this.type.range);

        // Hit or miss based on accuracy
        if (Math.random() < accuracy) {
            // Calculate damage
            const damage = Math.floor(
                this.type.damage[0] +
                Math.random() * (this.type.damage[1] - this.type.damage[0])
            );

            // Apply damage to player
            state.health = Math.max(0, state.health - damage);

            // Trigger damage flash
            state.damageFlash = true;
            state.damageFlashTime = Date.now();

            console.log(`${this.type.name} hit player for ${damage} damage! (${state.health} HP remaining)`);
            console.log(`DEBUG: Player position after damage: (${state.player.x.toFixed(2)}, ${state.player.y.toFixed(2)})`);

            // Game over check
            if (state.health <= 0) {
                state.isGameOver = true;
                console.log('Game Over!');
            }
        }

        // Visual feedback: muzzle flash (handled in renderer)
        this.lastShotTime = Date.now();
    }

    /**
     * Take damage
     */
    takeDamage(damage) {
        if (!this.alive) {
            console.log(`❌ ${this.type.name} is already dead!`);
            return;
        }

        const oldHp = this.hp;
        this.hp -= damage;
        const newHp = this.hp;

        console.log(`⚔️ ${this.type.name} took ${damage.toFixed(1)} damage! HP: ${oldHp.toFixed(1)} → ${Math.max(0, newHp).toFixed(1)}/${this.maxHp} ${newHp <= 0 ? '💀 KILLED!' : ''}`);

        if (this.hp <= 0) {
            this.die();
        } else {
            // Enter alert/chase state when hit
            if (this.state === AIState.PATROL) {
                this.enterAlertState(this.target);
            }
        }
    }

    /**
     * Die
     */
    die() {
        this.alive = false;
        this.hp = 0;
        this.state = AIState.DEAD;
        this.deathAnimTime = 0;
        state.enemiesKilled++;
        console.log(`${this.type.name} killed! Total kills: ${state.enemiesKilled}`);
    }

    /**
     * State transitions
     */
    enterPatrolState() {
        if (this.state !== AIState.PATROL) {
            console.log(`${this.type.name} → PATROL`);
        }
        this.state = AIState.PATROL;
        this.stateTime = 0;
        this.alertTimer = 0;
    }

    enterAlertState(player) {
        if (this.state !== AIState.ALERT) {
            console.log(`${this.type.name} → ALERT (Player detected!)`);
        }
        this.state = AIState.ALERT;
        this.stateTime = 0;
        this.alertTimer = 0;
        this.lastKnownPlayerPos = player ? { x: player.x, y: player.y } : null;
    }

    enterChaseState(player) {
        if (this.state !== AIState.CHASE) {
            console.log(`${this.type.name} → CHASE (Pursuing player!)`);
        }
        this.state = AIState.CHASE;
        this.stateTime = 0;
    }

    enterAttackState(player) {
        if (this.state !== AIState.ATTACK) {
            console.log(`${this.type.name} → ATTACK (In range!)`);
        }
        this.state = AIState.ATTACK;
        this.stateTime = 0;
    }
}

/**
 * Initialize enemy system
 */
export function initEnemies(kaplay) {
    k = kaplay;

    // Initialize empty enemy array
    state.enemies = [];

    console.log('Enemy system initialized');
}

/**
 * Spawn enemy at position
 */
export function spawnEnemy(type, x, y, angle = 0) {
    const enemy = new Enemy(type, x, y, angle);
    state.enemies.push(enemy);
    console.log(`✓ Spawned ${enemy.type.name} at (${x.toFixed(1)}, ${y.toFixed(1)}) - HP: ${enemy.hp}, Speed: ${enemy.type.speed}`);
    return enemy;
}

/**
 * Spawn multiple enemies from config
 */
export function spawnEnemiesFromConfig(enemyConfig) {
    if (!enemyConfig || !Array.isArray(enemyConfig)) return;

    for (const config of enemyConfig) {
        spawnEnemy(config.type, config.x, config.y, config.angle || 0);
    }
}

/**
 * Clear all enemies (for floor transitions)
 */
export function clearEnemies() {
    state.enemies = [];
    console.log('All enemies cleared');
}

/**
 * Get count of living enemies
 */
export function getAliveEnemyCount() {
    if (!state.enemies) return 0;
    return state.enemies.filter(e => e.alive).length;
}

/**
 * Update all enemies
 */
export function updateEnemies(dt, player) {
    if (!state.enemies) return;

    // Update each enemy
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];

        // Remove dead enemies after animation
        if (!enemy.alive && enemy.deathAnimTime > 3) {
            state.enemies.splice(i, 1);
            continue;
        }

        enemy.update(dt, player);
    }
}

/**
 * Check if ray hits an enemy (for weapon hit detection)
 */
export function checkEnemyHit(rayDirX, rayDirY, playerX, playerY, maxDistance) {
    if (!state.enemies || state.enemies.length === 0) {
        return null;
    }

    let closestHit = null;
    let closestDist = maxDistance;

    for (const enemy of state.enemies) {
        if (!enemy.alive) continue;

        // Vector from player to enemy
        const dx = enemy.x - playerX;
        const dy = enemy.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) continue;

        // Normalize direction to enemy
        const dirX = dx / distance;
        const dirY = dy / distance;

        // Dot product (1 = perfect aim, 0 = perpendicular, -1 = behind)
        const dot = dirX * rayDirX + dirY * rayDirY;

        // Generous hit detection - enemy needs to be roughly in front
        if (dot > 0.7) {
            // Calculate perpendicular distance from ray to enemy center
            const perpDist = Math.abs(dirX * rayDirY - dirY * rayDirX) * distance;

            // Check if ray passes close enough to enemy
            if (perpDist < 0.8) { // Generous hit radius
                if (distance < closestDist) {
                    closestHit = enemy;
                    closestDist = distance;
                }
            }
        }
    }

    return closestHit;
}

/**
 * Get all enemies (for rendering)
 */
export function getEnemies() {
    return state.enemies || [];
}
