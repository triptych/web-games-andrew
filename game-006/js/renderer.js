/**
 * Renderer Module
 * Handles all rendering operations using Kaplay's drawing API
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
import { getCurrentWeapon } from './weapons.js';
import { state } from './state.js';
import { getWallSlice, areTexturesLoaded } from './textures.js';

let k;
let initialized = false;

/**
 * Initialize renderer with Kaplay instance
 */
export function initRenderer(kaplay) {
    k = kaplay;
    initialized = true;

    console.log('Kaplay-based renderer initialized');
}

/**
 * Main render function - renders complete frame using Kaplay's drawing API
 */
export function render(player) {
    if (!k || !initialized || !player) {
        return;
    }

    // Apply camera shake
    if (state.camera && state.camera.shake > 0) {
        const shakeX = (Math.random() - 0.5) * state.camera.shake;
        const shakeY = (Math.random() - 0.5) * state.camera.shake;
        k.pushTransform();
        k.pushTranslate(k.vec2(shakeX, shakeY));
    }

    // Draw ceiling (top half)
    k.drawRect({
        pos: k.vec2(0, 0),
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT / 2,
        color: k.rgb(42, 42, 74),
    });

    // Draw floor (bottom half)
    k.drawRect({
        pos: k.vec2(0, SCREEN_HEIGHT / 2),
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT / 2,
        color: k.rgb(26, 26, 42),
    });

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
        renderImpacts(player, rays);
    }

    if (state.camera && state.camera.shake > 0) {
        k.popTransform();
    }

    // Render HUD elements (not affected by shake)
    renderWeapon();
    renderDamageFlash();
}

/**
 * Render all walls from ray data
 */
export function renderWalls(rays) {
    const texturesReady = areTexturesLoaded();

    for (const ray of rays) {
        renderWallSlice(ray, texturesReady);
    }
}

/**
 * Render a single vertical wall slice
 */
function renderWallSlice(ray, texturesReady) {
    const { column, distance, wallType, side, hitX, hitY } = ray;

    // Calculate wall height based on distance
    const lineHeight = Math.floor(WALL_HEIGHT_MULTIPLIER / distance);

    // Calculate top and bottom of wall slice
    const drawStart = Math.floor((SCREEN_HEIGHT - lineHeight) / 2);
    const drawEnd = Math.floor((SCREEN_HEIGHT + lineHeight) / 2);

    // Calculate texture coordinate
    // Determine which wall face was hit and get UV coordinate
    let u;
    if (Math.abs(ray.normalX) > Math.abs(ray.normalY)) {
        // Hit vertical wall (x-side)
        u = hitY;
    } else {
        // Hit horizontal wall (y-side)
        u = hitX;
    }
    u = u - Math.floor(u); // Get fractional part

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

    // Draw textured wall if textures are loaded, otherwise solid color
    if (texturesReady) {
        const wallSlice = getWallSlice(wallType, u);

        if (wallSlice) {
            // Draw textured wall slice using Kaplay's drawUVQuad
            k.drawUVQuad({
                width: 1,
                height: lineHeight,
                pos: k.vec2(column, drawStart),
                tex: wallSlice.tex,
                quad: wallSlice.slice,
                color: k.BLACK.lerp(k.WHITE, brightness),
            });
        } else {
            // Fallback to solid color
            drawSolidWallSlice(column, drawStart, drawEnd, wallType, brightness);
        }
    } else {
        // Textures not loaded yet, use solid colors
        drawSolidWallSlice(column, drawStart, drawEnd, wallType, brightness);
    }
}

/**
 * Draw a solid colored wall slice (fallback when textures aren't ready)
 */
function drawSolidWallSlice(column, drawStart, drawEnd, wallType, brightness) {
    // Get base wall color
    const baseColor = WALL_COLORS[wallType] || [100, 100, 100];

    // Apply brightness to color
    const r = Math.floor(baseColor[0] * brightness);
    const g = Math.floor(baseColor[1] * brightness);
    const b = Math.floor(baseColor[2] * brightness);

    // Draw the wall slice
    k.drawRect({
        pos: k.vec2(column, drawStart),
        width: 1,
        height: drawEnd - drawStart,
        color: k.rgb(r, g, b),
    });
}

/**
 * Render weapon sprite at bottom of screen
 */
function renderWeapon() {
    const weapon = getCurrentWeapon();
    // const weaponState = getWeaponState(); // Not needed - shooting disabled

    if (!weapon) return;

    // Weapon colors for visualization
    const weaponColors = {
        pistol: k.rgb(170, 170, 170),
        machinegun: k.rgb(102, 102, 102),
        shotgun: k.rgb(150, 75, 0),
        rocket: k.rgb(85, 85, 85),
    };

    const color = weaponColors[weapon.id] || k.rgb(136, 136, 136);

    // Draw simple weapon representation (rectangle for now)
    const weaponWidth = WEAPON_SPRITE_SIZE;
    const weaponHeight = WEAPON_SPRITE_SIZE * 0.6;
    const weaponX = WEAPON_SCREEN_X - weaponWidth / 2;
    const weaponY = WEAPON_SCREEN_Y;

    // Muzzle flash effect disabled
    // if (weaponState.muzzleFlash) {
    //     // Bright flash at muzzle
    //     k.drawCircle({
    //         pos: k.vec2(WEAPON_SCREEN_X, weaponY - 10),
    //         radius: 20,
    //         color: k.rgb(255, 200, 100),
    //     });
    // }

    // Draw weapon body
    k.drawRect({
        pos: k.vec2(weaponX, weaponY),
        width: weaponWidth,
        height: weaponHeight,
        color: color,
    });

    // Draw weapon barrel
    k.drawRect({
        pos: k.vec2(
            weaponX + weaponWidth * 0.4,
            weaponY - weaponHeight * 0.3
        ),
        width: weaponWidth * 0.2,
        height: weaponHeight * 0.5,
        color: k.rgb(34, 34, 34),
    });

    // Draw weapon name
    k.drawText({
        text: weapon.name,
        pos: k.vec2(WEAPON_SCREEN_X, SCREEN_HEIGHT - 10),
        size: 12,
        anchor: "center",
        color: k.WHITE,
    });
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
            k.drawRect({
                pos: k.vec2(0, 0),
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                color: k.rgba(
                    DAMAGE_FLASH_COLOR[0],
                    DAMAGE_FLASH_COLOR[1],
                    DAMAGE_FLASH_COLOR[2],
                    alpha
                ),
            });
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
                k.drawRect({
                    pos: k.vec2(screenX - size / 2, SCREEN_HEIGHT / 2 - size / 2),
                    width: size,
                    height: size / 2,
                    color: k.rgb(255, 102, 0),
                });

                // Rocket trail
                k.drawRect({
                    pos: k.vec2(screenX - size / 2 - size, SCREEN_HEIGHT / 2 - size / 4),
                    width: size,
                    height: size / 4,
                    color: k.rgba(255, 100, 0, 0.5),
                });
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
            k.drawCircle({
                pos: k.vec2(screenX, SCREEN_HEIGHT / 2),
                radius: currentSize,
                color: k.rgba(255, 150, 0, alpha),
            });

            k.drawCircle({
                pos: k.vec2(screenX, SCREEN_HEIGHT / 2),
                radius: currentSize * 0.5,
                color: k.rgba(255, 255, 100, alpha * 0.5),
            });
        }
    }
}

/**
 * Render bullet impact effects on walls
 */
function renderImpacts(player, rays) {
    const now = Date.now();

    for (let i = state.impacts.length - 1; i >= 0; i--) {
        const impact = state.impacts[i];
        const elapsed = now - impact.time;

        if (elapsed > impact.duration) {
            state.impacts.splice(i, 1);
            continue;
        }

        // Calculate impact position relative to player
        const dx = impact.x - player.x;
        const dy = impact.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Skip if too far
        if (distance > MAX_RAY_DISTANCE) continue;

        // Transform to camera space
        const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        const transformX = invDet * (player.dirY * dx - player.dirX * dy);
        const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

        // Check if behind camera
        if (transformY <= 0.1) continue;

        // Calculate screen position
        const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
        const screenY = SCREEN_HEIGHT / 2; // Center vertically on wall

        // Calculate size based on distance
        const size = Math.max(2, Math.floor(20 / transformY));

        // Check if within screen bounds
        if (screenX < 0 || screenX >= SCREEN_WIDTH) continue;

        // Check depth (only draw if at approximately the wall distance)
        const rayIndex = clamp(Math.floor(screenX), 0, rays.length - 1);
        if (rays[rayIndex] && Math.abs(transformY - rays[rayIndex].distance) < 0.3) {
            // Fade out over duration
            const alpha = 1 - (elapsed / impact.duration);

            // Draw bullet impact as a small spark/hole
            k.drawCircle({
                pos: k.vec2(screenX, screenY),
                radius: size,
                color: k.rgba(255, 200, 100, alpha * 0.8),
            });

            // Add darker center (bullet hole)
            k.drawCircle({
                pos: k.vec2(screenX, screenY),
                radius: size * 0.4,
                color: k.rgba(50, 50, 50, alpha),
            });

            // Add spark effect for first few frames
            if (elapsed < impact.duration * 0.3) {
                const sparkAlpha = alpha * (1 - elapsed / (impact.duration * 0.3));
                for (let j = 0; j < 4; j++) {
                    const angle = (Math.PI * 2 * j) / 4 + elapsed * 0.1;
                    const sparkLength = size * 1.5;
                    k.drawLine({
                        p1: k.vec2(screenX, screenY),
                        p2: k.vec2(
                            screenX + Math.cos(angle) * sparkLength,
                            screenY + Math.sin(angle) * sparkLength
                        ),
                        width: 1,
                        color: k.rgba(255, 255, 150, sparkAlpha),
                    });
                }
            }
        }
    }
}
