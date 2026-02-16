/**
 * Weapons System
 * Handles weapon mechanics, firing, ammo management
 */

import { state } from './state.js';
import { playSound } from './sounds.js';

// Weapon definitions
export const WEAPONS = {
    PISTOL: {
        id: 'pistol',
        name: 'Pistol',
        damage: { min: 15, max: 25 },
        fireRate: 3, // shots per second
        range: 8,
        ammoType: 'infinite',
        clipSize: null,
        maxAmmo: null,
        spread: 0, // No spread
        projectileCount: 1,
        projectile: false, // Hitscan
        fireDelay: 1000 / 3, // ms between shots
    },
    MACHINE_GUN: {
        id: 'machinegun',
        name: 'Machine Gun',
        damage: { min: 10, max: 15 },
        fireRate: 8, // shots per second
        range: 10,
        ammoType: 'bullets',
        clipSize: 50,
        maxAmmo: 200,
        spread: 0.05, // Slight spread
        projectileCount: 1,
        projectile: false, // Hitscan
        fireDelay: 1000 / 8,
    },
    SHOTGUN: {
        id: 'shotgun',
        name: 'Shotgun',
        damage: { min: 40, max: 60 }, // Per pellet at close range
        fireRate: 1 / 1.5, // 1 shot per 1.5 seconds
        range: 6,
        ammoType: 'shells',
        clipSize: 8,
        maxAmmo: 32,
        spread: 0.2, // Wide spread
        projectileCount: 5, // 5 pellets
        projectile: false, // Hitscan
        fireDelay: 1500,
        falloff: 0.5, // Damage falloff multiplier
    },
    ROCKET_LAUNCHER: {
        id: 'rocket',
        name: 'Rocket Launcher',
        damage: { min: 80, max: 100 },
        fireRate: 1 / 2.5, // 1 shot per 2.5 seconds
        range: 15,
        ammoType: 'rockets',
        clipSize: 1,
        maxAmmo: 20,
        spread: 0,
        projectileCount: 1,
        projectile: true, // Projectile weapon
        fireDelay: 2500,
        splashRadius: 2,
        splashDamage: 0.5, // 50% damage in splash
    },
};

// Map weapon IDs to WEAPONS keys
const WEAPON_ID_MAP = {
    'pistol': 'PISTOL',
    'machinegun': 'MACHINE_GUN',
    'shotgun': 'SHOTGUN',
    'rocket': 'ROCKET_LAUNCHER',
};

/**
 * Get weapon definition by ID
 */
function getWeaponByID(weaponId) {
    const key = WEAPON_ID_MAP[weaponId.toLowerCase()];
    return key ? WEAPONS[key] : null;
}

// Weapon state
const weaponState = {
    currentWeapon: 'pistol',
    unlockedWeapons: ['pistol'],
    ammo: {
        bullets: 50,
        shells: 0,
        rockets: 0,
    },
    lastFireTime: 0,
    firing: false,
    muzzleFlash: false,
    muzzleFlashTime: 0,
};

/**
 * Initialize weapon system
 */
export function initWeapons(k) {
    // Store weapon state in global state
    state.weapons = weaponState;

    console.log('Weapon system initialized:', weaponState);
}

/**
 * Switch to a weapon by ID
 */
export function switchWeapon(weaponId) {
    const weapon = getWeaponByID(weaponId);
    if (!weapon) {
        console.error('Invalid weapon ID:', weaponId);
        return false;
    }

    const id = weaponId.toLowerCase();
    if (!weaponState.unlockedWeapons.includes(id)) {
        console.log('Weapon not unlocked:', weaponId);
        return false;
    }

    weaponState.currentWeapon = id;
    console.log('Switched to:', weapon.name);
    playSound('weaponSwitch');

    return true;
}

/**
 * Switch to next weapon in inventory
 */
export function nextWeapon() {
    const weapons = weaponState.unlockedWeapons;
    const currentIndex = weapons.indexOf(weaponState.currentWeapon);
    const nextIndex = (currentIndex + 1) % weapons.length;
    switchWeapon(weapons[nextIndex]);
}

/**
 * Switch to previous weapon in inventory
 */
export function previousWeapon() {
    const weapons = weaponState.unlockedWeapons;
    const currentIndex = weapons.indexOf(weaponState.currentWeapon);
    const prevIndex = (currentIndex - 1 + weapons.length) % weapons.length;
    switchWeapon(weapons[prevIndex]);
}

/**
 * Unlock a weapon (pickup)
 */
export function unlockWeapon(weaponId) {
    const weapon = getWeaponByID(weaponId);
    if (!weapon) {
        console.error('Invalid weapon ID:', weaponId);
        return false;
    }

    const id = weaponId.toLowerCase();
    if (!weaponState.unlockedWeapons.includes(id)) {
        weaponState.unlockedWeapons.push(id);
        console.log('Unlocked weapon:', weapon.name);
        playSound('weaponPickup');
        return true;
    }
    return false;
}

/**
 * Add ammo for a specific type
 */
export function addAmmo(ammoType, amount) {
    if (!weaponState.ammo.hasOwnProperty(ammoType)) {
        console.error('Invalid ammo type:', ammoType);
        return false;
    }

    weaponState.ammo[ammoType] += amount;
    console.log(`Added ${amount} ${ammoType}. Total: ${weaponState.ammo[ammoType]}`);
    playSound('ammoPickup');
    return true;
}

/**
 * Check if weapon can fire
 */
function canFire() {
    const now = Date.now();
    const weapon = getWeaponByID(weaponState.currentWeapon);

    if (!weapon) return false;

    // Check fire rate cooldown
    if (now - weaponState.lastFireTime < weapon.fireDelay) {
        return false;
    }

    // Check ammo
    if (weapon.ammoType !== 'infinite') {
        const ammoAvailable = weaponState.ammo[weapon.ammoType];
        if (ammoAvailable <= 0) {
            // Play empty click sound
            playSound('emptyClick');
            return false;
        }
    }

    return true;
}

/**
 * Calculate damage with falloff based on distance
 */
function calculateDamage(weapon, distance) {
    const { damage, range, falloff } = weapon;
    const baseDamage = damage.min + Math.random() * (damage.max - damage.min);

    // Apply distance falloff if weapon has it (shotgun)
    if (falloff && distance > range * 0.5) {
        const distanceFactor = 1 - ((distance - range * 0.5) / (range * 0.5));
        return baseDamage * Math.max(falloff, distanceFactor);
    }

    return baseDamage;
}

/**
 * Fire current weapon
 */
export function fireWeapon(player, map, castRayFunction) {
    if (!canFire()) {
        return null;
    }

    const weapon = getWeaponByID(weaponState.currentWeapon);
    if (!weapon) return null;

    weaponState.lastFireTime = Date.now();

    // Consume ammo if not infinite
    if (weapon.ammoType !== 'infinite') {
        weaponState.ammo[weapon.ammoType]--;
    }

    // Trigger muzzle flash
    weaponState.muzzleFlash = true;
    weaponState.muzzleFlashTime = Date.now();

    // Play weapon sound
    playSound(`fire_${weapon.id}`);

    // Screen shake for feedback
    if (state.camera) {
        state.camera.shake = weapon.id === 'shotgun' ? 8 : weapon.id === 'rocket' ? 10 : 3;
    }

    const hits = [];

    // Handle projectile weapons (rocket launcher)
    if (weapon.projectile) {
        // Create projectile
        const projectile = {
            x: player.x,
            y: player.y,
            dirX: player.dirX,
            dirY: player.dirY,
            speed: 10, // units per second
            damage: calculateDamage(weapon, 0),
            splashRadius: weapon.splashRadius,
            splashDamage: weapon.splashDamage,
            type: 'rocket',
            weapon: weapon.id,
        };

        // Add to projectiles array (will be managed by game state)
        if (!state.projectiles) {
            state.projectiles = [];
        }
        state.projectiles.push(projectile);

        console.log('Fired projectile:', projectile);
        return { projectile };
    }

    // Handle hitscan weapons
    for (let i = 0; i < weapon.projectileCount; i++) {
        // Calculate spread
        const spreadAngle = (Math.random() - 0.5) * weapon.spread;

        // Create a ray in the direction with spread
        const angle = Math.atan2(player.dirY, player.dirX) + spreadAngle;
        const rayDir = {
            x: Math.cos(angle),
            y: Math.sin(angle),
        };

        // Cast ray to find hit
        const hit = castRayFunction(player, rayDir, weapon.range);

        if (hit && hit.distance <= weapon.range) {
            const damage = calculateDamage(weapon, hit.distance);

            hits.push({
                target: hit.target, // enemy, wall, etc.
                damage: damage,
                distance: hit.distance,
                x: hit.x,
                y: hit.y,
                weapon: weapon.id,
            });

            // Visual feedback at hit location
            if (hit.target === 'wall') {
                // Show bullet impact on wall
                if (state.impacts) {
                    state.impacts.push({
                        x: hit.x,
                        y: hit.y,
                        time: Date.now(),
                        duration: 200, // ms
                    });
                }

                // Play impact sound (occasional, not every pellet for shotgun)
                if (i === 0 || weapon.projectileCount === 1) {
                    playSound('bulletImpact', { volume: 0.7 });
                }
            }
        }
    }

    return { hits, weapon: weapon.id };
}

/**
 * Update weapon system (called each frame)
 */
export function updateWeapons(dt) {
    // Clear muzzle flash after short duration
    if (weaponState.muzzleFlash && Date.now() - weaponState.muzzleFlashTime > 50) {
        weaponState.muzzleFlash = false;
    }

    // Update projectiles if any
    if (state.projectiles) {
        for (let i = state.projectiles.length - 1; i >= 0; i--) {
            const proj = state.projectiles[i];

            // Move projectile
            proj.x += proj.dirX * proj.speed * dt;
            proj.y += proj.dirY * proj.speed * dt;

            // Check collision with walls (simplified)
            const mapX = Math.floor(proj.x);
            const mapY = Math.floor(proj.y);

            if (state.map && state.map[mapY] && state.map[mapY][mapX] > 0) {
                // Hit wall - explode
                handleProjectileExplosion(proj);
                state.projectiles.splice(i, 1);
            }

            // Remove if too far
            const dx = proj.x - state.player.x;
            const dy = proj.y - state.player.y;
            if (Math.sqrt(dx * dx + dy * dy) > 30) {
                state.projectiles.splice(i, 1);
            }
        }
    }

    // Update camera shake
    if (state.camera && state.camera.shake > 0) {
        state.camera.shake *= 0.9; // Decay
        if (state.camera.shake < 0.1) {
            state.camera.shake = 0;
        }
    }
}

/**
 * Handle projectile explosion (splash damage)
 */
function handleProjectileExplosion(projectile) {
    playSound('explosion');

    // Create explosion visual effect
    if (state.explosions) {
        state.explosions.push({
            x: projectile.x,
            y: projectile.y,
            radius: projectile.splashRadius,
            time: Date.now(),
            duration: 500,
        });
    }

    // TODO: In Phase 3, handle splash damage to enemies
    console.log('Projectile exploded at', projectile.x, projectile.y);
}

/**
 * Get current weapon
 */
export function getCurrentWeapon() {
    return getWeaponByID(weaponState.currentWeapon);
}

/**
 * Get weapon state
 */
export function getWeaponState() {
    return weaponState;
}
