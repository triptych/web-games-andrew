/**
 * Renderer Module
 * Handles all rendering operations
 */

import {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    WALL_HEIGHT_MULTIPLIER,
    WALL_COLORS,
    SHADING_ENABLED,
    MIN_BRIGHTNESS,
    MAX_BRIGHTNESS,
    MAX_RAY_DISTANCE,
    WEAPON_SCREEN_X,
    WEAPON_SCREEN_Y,
    WEAPON_SPRITE_SIZE,
    DAMAGE_FLASH_DURATION,
    DAMAGE_FLASH_COLOR,
} from './config.js';
import { clamp, lerp } from './utils.js';
import { castRays } from './raycaster.js';
import { getCurrentWeapon, getWeaponState } from './weapons.js';
import { state } from './state.js';

let ctx;
let raycastCanvas;
let initialized = false;

/**
 * Initialize renderer - create separate canvas for raycasting
 */
export function initRenderer(k) {
    // Create a separate canvas for raycasting rendering
    raycastCanvas = document.createElement('canvas');
    raycastCanvas.width = SCREEN_WIDTH;
    raycastCanvas.height = SCREEN_HEIGHT;
    raycastCanvas.id = 'raycastCanvas';

    // Style it to overlay behind kaplay's canvas
    raycastCanvas.style.position = 'absolute';
    raycastCanvas.style.top = '0';
    raycastCanvas.style.left = '0';
    raycastCanvas.style.width = '100%';
    raycastCanvas.style.height = '100%';
    raycastCanvas.style.zIndex = '0';
    raycastCanvas.style.imageRendering = 'pixelated';
    raycastCanvas.style.imageRendering = 'crisp-edges';

    // Get the kaplay canvas to position ours with it
    const kaplayCanvas = document.querySelector('canvas');
    if (kaplayCanvas && kaplayCanvas.parentElement) {
        // Create a container wrapper
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = SCREEN_WIDTH + 'px';
        container.style.height = SCREEN_HEIGHT + 'px';
        container.style.border = '2px solid #333';

        // Move kaplay canvas into container
        const parent = kaplayCanvas.parentElement;
        parent.insertBefore(container, kaplayCanvas);
        container.appendChild(kaplayCanvas);

        // Add our canvas to the container
        container.appendChild(raycastCanvas);

        // Style kaplay canvas - make it transparent
        kaplayCanvas.style.position = 'absolute';
        kaplayCanvas.style.top = '0';
        kaplayCanvas.style.left = '0';
        kaplayCanvas.style.width = '100%';
        kaplayCanvas.style.height = '100%';
        kaplayCanvas.style.zIndex = '1';
        kaplayCanvas.style.pointerEvents = 'auto';
        kaplayCanvas.style.border = 'none';
        kaplayCanvas.style.background = 'transparent';
    } else {
        // Fallback - just add to body
        document.body.appendChild(raycastCanvas);
    }

    ctx = raycastCanvas.getContext('2d');
    initialized = true;

    console.log('Raycasting renderer initialized with separate canvas:', {
        width: raycastCanvas.width,
        height: raycastCanvas.height,
    });
}

/**
 * Clear the screen
 */
export function clear() {
    // Draw ceiling (top half)
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

    // Draw floor (bottom half)
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
}

/**
 * Main render function - renders complete frame
 */
export function render(player) {
    if (!ctx || !initialized || !player) {
        return;
    }

    // Clear entire canvas to black to prevent artifacts
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Apply camera shake
    ctx.save();
    if (state.camera && state.camera.shake > 0) {
        const shakeX = (Math.random() - 0.5) * state.camera.shake;
        const shakeY = (Math.random() - 0.5) * state.camera.shake;
        ctx.translate(shakeX, shakeY);
    }

    // Draw ceiling and floor WITH shake applied
    clear();

    // Cast rays from player position
    const rays = castRays(player);

    // Render walls
    renderWalls(rays);

    // Render projectiles (rockets)
    if (state.projectiles) {
        renderProjectiles(player, rays);
    }

    // Render bullet impacts on walls
    if (state.impacts) {
        renderImpacts();
    }

    ctx.restore();

    // Render HUD elements (not affected by shake)
    renderWeapon();
    renderDamageFlash();
}

/**
 * Render all walls from ray data
 */
export function renderWalls(rays) {
    for (const ray of rays) {
        renderWallSlice(ray);
    }
}

/**
 * Render a single vertical wall slice
 */
function renderWallSlice(ray) {
    const { column, distance, wallType, side } = ray;

    // Calculate wall height based on distance
    const lineHeight = Math.floor(WALL_HEIGHT_MULTIPLIER / distance);

    // Calculate top and bottom of wall slice
    const drawStart = Math.floor((SCREEN_HEIGHT - lineHeight) / 2);
    const drawEnd = Math.floor((SCREEN_HEIGHT + lineHeight) / 2);

    // Get base wall color
    const baseColor = WALL_COLORS[wallType] || [100, 100, 100];

    // Apply distance shading
    let brightness = 1.0;
    if (SHADING_ENABLED) {
        // Linear falloff based on distance
        brightness = 1.0 - (distance / MAX_RAY_DISTANCE);
        brightness = clamp(brightness, MIN_BRIGHTNESS, MAX_BRIGHTNESS);

        // Make horizontal walls (y-side) slightly darker for depth perception
        if (side === 1) {
            brightness *= 0.7;
        }
    }

    // Apply brightness to color
    const r = Math.floor(baseColor[0] * brightness);
    const g = Math.floor(baseColor[1] * brightness);
    const b = Math.floor(baseColor[2] * brightness);

    // Draw the wall slice
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(column, drawStart, 1, drawEnd - drawStart);
}

/**
 * Render weapon sprite at bottom of screen
 */
function renderWeapon() {
    const weapon = getCurrentWeapon();
    const weaponState = getWeaponState();

    if (!weapon) return;

    // Weapon colors for visualization
    const weaponColors = {
        pistol: '#aaa',
        machinegun: '#666',
        shotgun: '#964B00',
        rocket: '#555',
    };

    const color = weaponColors[weapon.id] || '#888';

    // Draw simple weapon representation (rectangle for now)
    const weaponWidth = WEAPON_SPRITE_SIZE;
    const weaponHeight = WEAPON_SPRITE_SIZE * 0.6;
    const weaponX = WEAPON_SCREEN_X - weaponWidth / 2;
    const weaponY = WEAPON_SCREEN_Y;

    // Muzzle flash effect
    if (weaponState.muzzleFlash) {
        // Bright flash at muzzle
        ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.beginPath();
        ctx.arc(WEAPON_SCREEN_X, weaponY - 10, 20, 0, Math.PI * 2);
        ctx.fill();

        // Add some rays
        ctx.strokeStyle = 'rgba(255, 255, 150, 0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            ctx.beginPath();
            ctx.moveTo(WEAPON_SCREEN_X, weaponY - 10);
            ctx.lineTo(
                WEAPON_SCREEN_X + Math.cos(angle) * 30,
                weaponY - 10 + Math.sin(angle) * 30
            );
            ctx.stroke();
        }
    }

    // Draw weapon body
    ctx.fillStyle = color;
    ctx.fillRect(weaponX, weaponY, weaponWidth, weaponHeight);

    // Draw weapon barrel
    ctx.fillStyle = '#222';
    ctx.fillRect(
        weaponX + weaponWidth * 0.4,
        weaponY - weaponHeight * 0.3,
        weaponWidth * 0.2,
        weaponHeight * 0.5
    );

    // Draw weapon name
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(weapon.name, WEAPON_SCREEN_X, SCREEN_HEIGHT - 10);
}

/**
 * Render damage flash when player is hit
 */
function renderDamageFlash() {
    if (state.damageFlash) {
        const elapsed = Date.now() - state.damageFlashTime;

        if (elapsed < DAMAGE_FLASH_DURATION) {
            // Fade out over duration
            const alpha = (1 - elapsed / DAMAGE_FLASH_DURATION) * DAMAGE_FLASH_COLOR[3];
            ctx.fillStyle = `rgba(${DAMAGE_FLASH_COLOR[0]}, ${DAMAGE_FLASH_COLOR[1]}, ${DAMAGE_FLASH_COLOR[2]}, ${alpha})`;
            ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        } else {
            state.damageFlash = false;
        }
    }
}

/**
 * Render projectiles (rockets) in 3D space
 */
function renderProjectiles(player, rays) {
    const now = Date.now();

    for (const proj of state.projectiles) {
        // Calculate projectile position relative to player
        const dx = proj.x - player.x;
        const dy = proj.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Transform to camera space
        const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        const transformX = invDet * (player.dirY * dx - player.dirX * dy);
        const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

        // Check if behind camera
        if (transformY <= 0.1) continue;

        // Calculate screen position
        const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

        // Calculate size based on distance
        const size = Math.abs(Math.floor(SCREEN_HEIGHT / transformY / 4));

        // Check depth (only draw if not behind wall)
        const rayIndex = Math.floor(screenX);
        if (rayIndex >= 0 && rayIndex < rays.length && transformY < rays[rayIndex].distance) {
            // Draw projectile
            if (proj.type === 'rocket') {
                // Orange/yellow rocket
                ctx.fillStyle = '#ff6600';
                ctx.fillRect(screenX - size / 2, SCREEN_HEIGHT / 2 - size / 2, size, size / 2);

                // Rocket trail
                ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
                ctx.fillRect(screenX - size / 2 - size, SCREEN_HEIGHT / 2 - size / 4, size, size / 4);
            }
        }
    }

    // Render explosions
    if (state.explosions) {
        for (let i = state.explosions.length - 1; i >= 0; i--) {
            const exp = state.explosions[i];
            const elapsed = now - exp.time;

            if (elapsed > exp.duration) {
                state.explosions.splice(i, 1);
                continue;
            }

            // Calculate explosion position relative to player
            const dx = exp.x - player.x;
            const dy = exp.y - player.y;

            // Transform to camera space
            const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
            const transformX = invDet * (player.dirY * dx - player.dirX * dy);
            const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

            if (transformY <= 0.1) continue;

            const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
            const size = Math.abs(Math.floor(SCREEN_HEIGHT / transformY)) * 2;

            // Animate explosion (expand and fade)
            const progress = elapsed / exp.duration;
            const alpha = 1 - progress;
            const currentSize = size * (0.5 + progress * 0.5);

            // Draw explosion
            ctx.fillStyle = `rgba(255, 150, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(screenX, SCREEN_HEIGHT / 2, currentSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(screenX, SCREEN_HEIGHT / 2, currentSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Render bullet impact effects on walls
 */
function renderImpacts() {
    const now = Date.now();

    for (let i = state.impacts.length - 1; i >= 0; i--) {
        const impact = state.impacts[i];
        const elapsed = now - impact.time;

        if (elapsed > impact.duration) {
            state.impacts.splice(i, 1);
            continue;
        }

        // Impact effects are rendered in 2D map space
        // For now, we'll skip rendering them in 3D
        // In a full implementation, we'd project them to screen space
    }
}

/**
 * Get the canvas context (for other modules if needed)
 */
export function getContext() {
    return ctx;
}
