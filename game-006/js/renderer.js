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

    // Render items (pickups) - before enemies for proper depth sorting
    if (state.items && state.items.length > 0) {
        renderItems(player, rays);
    }

    // Render enemies (Phase 3)
    if (state.enemies && state.enemies.length > 0) {
        renderEnemies(player, rays);
    }

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
 * Render items as billboard sprites (pickups)
 */
function renderItems(player, rays) {
    if (!state.items || state.items.length === 0) return;

    // Create array of items with distance for sorting
    const itemsWithDist = state.items.map(item => {
        const dx = item.x - player.x;
        const dy = item.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return { item, distance, dx, dy };
    });

    // Sort by distance (far to near) for proper depth rendering
    itemsWithDist.sort((a, b) => b.distance - a.distance);

    // Render each item
    for (const { item, distance, dx, dy } of itemsWithDist) {
        // Skip if too far
        if (distance > MAX_RAY_DISTANCE) continue;

        // Transform item position to camera space
        const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        const transformX = invDet * (player.dirY * dx - player.dirX * dy);
        const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

        // Skip if behind camera
        if (transformY <= 0.1) continue;

        // Calculate screen position
        const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

        // Calculate sprite dimensions based on distance
        const spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY * item.size));
        const spriteWidth = spriteHeight; // Square sprite

        // Calculate vertical offset for bobbing animation
        const bobPhase = item.timeAlive * item.bobSpeed + item.bobOffset;
        const bobHeight = item.baseHeight + Math.sin(bobPhase) * item.bobHeight;
        const verticalOffset = Math.floor((bobHeight - 0.5) * spriteHeight);

        // Calculate draw bounds
        const drawStartY = Math.floor((SCREEN_HEIGHT - spriteHeight) / 2 + verticalOffset);
        const drawStartX = Math.floor(screenX - spriteWidth / 2);
        const drawEndX = Math.floor(screenX + spriteWidth / 2);

        // Check if on screen
        if (drawEndX < 0 || drawStartX >= SCREEN_WIDTH) continue;

        // Clamp to screen bounds
        const startX = Math.max(0, drawStartX);
        const endX = Math.min(SCREEN_WIDTH, drawEndX);

        // Check depth buffer - skip if behind walls
        let visibleColumns = 0;
        for (let x = startX; x < endX; x++) {
            if (x >= 0 && x < rays.length && transformY < rays[x].distance) {
                visibleColumns++;
            }
        }

        if (visibleColumns === 0) continue;

        // Draw item sprite
        const radius = spriteWidth * 0.4;
        const color = item.color;

        // Draw main sphere
        for (let x = startX; x < endX; x++) {
            if (x >= 0 && x < rays.length && transformY < rays[x].distance) {
                const relX = (x - screenX) / radius;
                if (Math.abs(relX) <= 1) {
                    const sliceHeight = spriteHeight * 0.8 * Math.sqrt(1 - relX * relX);
                    const sliceY = drawStartY + (spriteHeight - sliceHeight) / 2;

                    k.drawRect({
                        pos: k.vec2(x, sliceY),
                        width: 1,
                        height: sliceHeight,
                        color: k.rgb(color[0], color[1], color[2]),
                    });
                }
            }
        }

        // Draw highlight
        const glintX = Math.floor(screenX);
        if (glintX >= 0 && glintX < rays.length && transformY < rays[glintX].distance) {
            k.drawCircle({
                pos: k.vec2(screenX - radius * 0.2, drawStartY + spriteHeight * 0.3),
                radius: radius * 0.25,
                color: k.rgb(
                    Math.min(255, color[0] + 100),
                    Math.min(255, color[1] + 100),
                    Math.min(255, color[2] + 100)
                ),
                opacity: 0.7,
            });
        }
    }
}

/**
 * Render enemies as billboard sprites (Phase 3)
 */
function renderEnemies(player, rays) {
    if (!state.enemies || state.enemies.length === 0) return;

    // Create array of enemies with distance for sorting
    const enemiesWithDist = state.enemies.map(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return {
            enemy: enemy,
            distance: distance,
            dx: dx,
            dy: dy
        };
    });

    // Sort by distance (far to near) for proper depth rendering
    enemiesWithDist.sort((a, b) => b.distance - a.distance);

    // Render each enemy
    for (const enemyData of enemiesWithDist) {
        const enemy = enemyData.enemy;
        const dx = enemyData.dx;
        const dy = enemyData.dy;
        const distance = enemyData.distance;

        // Skip if too far
        if (distance > MAX_RAY_DISTANCE) continue;

        // Transform enemy position to camera space
        const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        const transformX = invDet * (player.dirY * dx - player.dirX * dy);
        const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

        // Check if behind camera
        if (transformY <= 0.1) continue;

        // Calculate screen position
        const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

        // Calculate sprite dimensions based on distance
        const spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY));
        const spriteWidth = Math.abs(Math.floor(SCREEN_HEIGHT / transformY / 2));

        // Calculate draw bounds
        const drawStartY = Math.floor((SCREEN_HEIGHT - spriteHeight) / 2);
        const drawStartX = Math.floor(screenX - spriteWidth / 2);
        const drawEndX = Math.floor(screenX + spriteWidth / 2);

        // Check if on screen
        if (drawEndX < 0 || drawStartX >= SCREEN_WIDTH) continue;

        // Clamp to screen bounds
        const startX = Math.max(0, drawStartX);
        const endX = Math.min(SCREEN_WIDTH, drawEndX);

        // Check depth buffer - only draw columns not behind walls
        let visibleColumns = 0;
        for (let x = startX; x < endX; x++) {
            if (x >= 0 && x < rays.length && transformY < rays[x].distance) {
                visibleColumns++;
            }
        }

        // Skip if completely behind walls
        if (visibleColumns === 0) continue;

        // Draw enemy sprite using Kaplay drawing API
        if (enemy.alive) {
            // Draw living enemy
            drawEnemySprite(enemy, screenX, drawStartY, spriteWidth, spriteHeight, transformY, rays);
        } else {
            // Draw dead enemy (corpse on ground)
            drawDeadEnemy(enemy, screenX, spriteWidth, spriteHeight);
        }
    }
}

/**
 * Draw a living enemy sprite
 */
function drawEnemySprite(enemy, screenX, screenY, width, height, depth, rays) {
    const color = enemy.type.color;

    // Draw body (rectangle)
    const bodyHeight = height * 0.7;
    const bodyWidth = width * 0.6;
    const bodyX = screenX - bodyWidth / 2;
    const bodyY = screenY + height * 0.3;

    // Only draw columns that aren't behind walls
    for (let x = Math.floor(bodyX); x < Math.ceil(bodyX + bodyWidth); x++) {
        if (x >= 0 && x < rays.length && depth < rays[x].distance) {
            k.drawRect({
                pos: k.vec2(x, bodyY),
                width: 1,
                height: bodyHeight,
                color: k.rgb(color[0], color[1], color[2]),
            });
        }
    }

    // Draw head (circle)
    const headRadius = width * 0.2;
    const headY = screenY + height * 0.15;

    // Check if head center is visible
    const headX = Math.floor(screenX);
    if (headX >= 0 && headX < rays.length && depth < rays[headX].distance) {
        k.drawCircle({
            pos: k.vec2(screenX, headY),
            radius: headRadius,
            color: k.rgb(
                Math.min(255, color[0] + 30),
                Math.min(255, color[1] + 30),
                Math.min(255, color[2] + 30)
            ),
        });
    }

    // Draw weapon/arms (small rectangles on sides)
    const armWidth = width * 0.15;
    const armHeight = height * 0.3;
    const armY = bodyY + bodyHeight * 0.2;

    // Left arm
    const leftArmX = Math.floor(bodyX - armWidth);
    if (leftArmX >= 0 && leftArmX < rays.length && depth < rays[leftArmX].distance) {
        k.drawRect({
            pos: k.vec2(leftArmX, armY),
            width: armWidth,
            height: armHeight,
            color: k.rgb(
                Math.max(0, color[0] - 20),
                Math.max(0, color[1] - 20),
                Math.max(0, color[2] - 20)
            ),
        });
    }

    // Right arm
    const rightArmX = Math.floor(bodyX + bodyWidth);
    if (rightArmX >= 0 && rightArmX < rays.length && depth < rays[rightArmX].distance) {
        k.drawRect({
            pos: k.vec2(rightArmX, armY),
            width: armWidth,
            height: armHeight,
            color: k.rgb(
                Math.max(0, color[0] - 20),
                Math.max(0, color[1] - 20),
                Math.max(0, color[2] - 20)
            ),
        });
    }

    // Draw muzzle flash if just shot
    if (enemy.lastShotTime && Date.now() - enemy.lastShotTime < 50) {
        k.drawCircle({
            pos: k.vec2(screenX, bodyY + bodyHeight / 2),
            radius: headRadius * 1.5,
            color: k.rgb(255, 200, 100),
        });
    }

    // Draw health bar above enemy
    if (enemy.hp < enemy.maxHp) {
        const barWidth = width * 0.8;
        const barHeight = 4;
        const barX = screenX - barWidth / 2;
        const barY = screenY - 10;

        // Background (red)
        k.drawRect({
            pos: k.vec2(barX, barY),
            width: barWidth,
            height: barHeight,
            color: k.rgb(100, 0, 0),
        });

        // Foreground (green) - health remaining
        const healthPercent = enemy.hp / enemy.maxHp;
        k.drawRect({
            pos: k.vec2(barX, barY),
            width: barWidth * healthPercent,
            height: barHeight,
            color: k.rgb(0, 200, 0),
        });
    }
}

/**
 * Draw a dead enemy (corpse)
 */
function drawDeadEnemy(enemy, screenX, width, height) {
    const color = enemy.type.color;

    // Draw as a flat oval on the ground
    const corpseWidth = width * 0.8;
    const corpseHeight = height * 0.2;
    const corpseY = SCREEN_HEIGHT / 2 + height * 0.3;

    k.drawEllipse({
        pos: k.vec2(screenX, corpseY),
        radiusX: corpseWidth / 2,
        radiusY: corpseHeight / 2,
        color: k.rgb(
            Math.max(0, color[0] - 50),
            Math.max(0, color[1] - 50),
            Math.max(0, color[2] - 50)
        ),
    });
}

/**
 * Render weapon sprite at bottom of screen
 */
function renderWeapon() {
    const weapon = getCurrentWeapon();
    const weaponState = state.weapons;

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

    // Muzzle flash effect
    if (weaponState && weaponState.muzzleFlash) {
        // Bright flash at muzzle
        k.drawCircle({
            pos: k.vec2(WEAPON_SCREEN_X, weaponY - 10),
            radius: 20,
            color: k.rgb(255, 200, 100),
        });
    }

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
                color: [
                    DAMAGE_FLASH_COLOR[0],
                    DAMAGE_FLASH_COLOR[1],
                    DAMAGE_FLASH_COLOR[2],
                    alpha
                ],
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
                    color: [255, 100, 0, 0.5],
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
                color: [255, 150, 0, alpha],
            });

            k.drawCircle({
                pos: k.vec2(screenX, SCREEN_HEIGHT / 2),
                radius: currentSize * 0.5,
                color: [255, 255, 100, alpha * 0.5],
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
                color: [255, 200, 100, alpha * 0.8],
            });

            // Add darker center (bullet hole)
            k.drawCircle({
                pos: k.vec2(screenX, screenY),
                radius: size * 0.4,
                color: [50, 50, 50, alpha],
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
                        color: [255, 255, 150, sparkAlpha],
                    });
                }
            }
        }
    }
}
