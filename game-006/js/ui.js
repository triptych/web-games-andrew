/**
 * UI System
 * Handles HUD overlay using kaplay rendering
 */

import { state } from './state.js';
import { getCurrentWeapon, getWeaponState } from './weapons.js';

/**
 * Initialize UI system
 */
export function initUI(k) {
    // HUD overlay - drawn on top of raycasting view
    k.onDraw(() => {
        if (state.isGameOver) return;

        const player = state.player;
        if (!player) return;

        // Stats background
        k.drawRect({
            pos: k.vec2(5, 5),
            width: 180,
            height: 70,
            color: k.rgb(0, 0, 0),
            opacity: 0.7,
            radius: 4,
        });

        // FPS counter
        k.drawText({
            text: `FPS: ${Math.round(state.fps)}`,
            pos: k.vec2(10, 10),
            size: 14,
            color: k.rgb(0, 255, 0),
            font: 'monospace',
        });

        // Position
        k.drawText({
            text: `Pos: ${player.x.toFixed(2)}, ${player.y.toFixed(2)}`,
            pos: k.vec2(10, 30),
            size: 14,
            color: k.rgb(0, 255, 0),
            font: 'monospace',
        });

        // Direction
        k.drawText({
            text: `Dir: ${Math.floor(player.playerAngle)}°`,
            pos: k.vec2(10, 50),
            size: 14,
            color: k.rgb(0, 255, 0),
            font: 'monospace',
        });

        // Bottom HUD - Health, Ammo, Weapon
        renderBottomHUD(k);

        // Controls hint (bottom left)
        k.drawText({
            text: 'WASD: Move | Mouse: Look/Shoot | 1-4: Weapons | Shift: Sprint | ESC: Pause',
            pos: k.vec2(10, k.height() - 10),
            size: 10,
            color: k.rgb(136, 136, 136),
            font: 'monospace',
        });
    });

    console.log('UI system initialized');
}

/**
 * Render bottom HUD with health, ammo, and weapon info
 */
function renderBottomHUD(k) {
    const hudHeight = 50;
    const hudY = k.height() - hudHeight - 10; // At bottom, below weapon sprite

    // HUD Background
    k.drawRect({
        pos: k.vec2(0, hudY),
        width: k.width(),
        height: hudHeight,
        color: k.rgb(20, 20, 20),
        opacity: 0.8,
    });

    // Health bar (left side)
    const healthBarWidth = 200;
    const healthBarHeight = 20;
    const healthBarX = 20;
    const healthBarY = hudY + 15;

    // Health bar background
    k.drawRect({
        pos: k.vec2(healthBarX, healthBarY),
        width: healthBarWidth,
        height: healthBarHeight,
        color: k.rgb(50, 50, 50),
        outline: {
            color: k.rgb(255, 255, 255),
            width: 2,
        },
    });

    // Health bar fill
    const healthPercent = state.health / state.maxHealth;
    const healthColor = healthPercent > 0.5
        ? k.rgb(0, 255, 0)
        : healthPercent > 0.25
        ? k.rgb(255, 255, 0)
        : k.rgb(255, 0, 0);

    k.drawRect({
        pos: k.vec2(healthBarX, healthBarY),
        width: healthBarWidth * healthPercent,
        height: healthBarHeight,
        color: healthColor,
    });

    // Health text
    k.drawText({
        text: `HP: ${Math.floor(state.health)}/${state.maxHealth}`,
        pos: k.vec2(healthBarX + healthBarWidth / 2, healthBarY + healthBarHeight / 2),
        size: 14,
        color: k.rgb(255, 255, 255),
        font: 'monospace',
        anchor: 'center',
    });

    // Weapon and Ammo info (center-right)
    const weapon = getCurrentWeapon();
    const weaponState = getWeaponState();

    if (weapon && weaponState) {
        const infoX = k.width() - 250;
        const infoY = hudY + 15;

        // Current weapon name
        k.drawText({
            text: weapon.name.toUpperCase(),
            pos: k.vec2(infoX, infoY),
            size: 16,
            color: k.rgb(255, 200, 0),
            font: 'monospace',
        });

        // Ammo display
        let ammoText = '';
        if (weapon.ammoType === 'infinite') {
            ammoText = 'AMMO: ∞';
        } else {
            const currentAmmo = weaponState.ammo[weapon.ammoType] || 0;
            const maxAmmo = weapon.maxAmmo;
            ammoText = `AMMO: ${currentAmmo}/${maxAmmo}`;
        }

        k.drawText({
            text: ammoText,
            pos: k.vec2(infoX, infoY + 20),
            size: 14,
            color: k.rgb(200, 200, 200),
            font: 'monospace',
        });
    }

    // Stats (top right corner)
    const statsX = k.width() - 200;
    const statsY = 10;

    k.drawRect({
        pos: k.vec2(statsX, statsY),
        width: 190,
        height: 90,
        color: k.rgb(0, 0, 0),
        opacity: 0.7,
        radius: 4,
    });

    k.drawText({
        text: `Kills: ${state.enemiesKilled}`,
        pos: k.vec2(statsX + 10, statsY + 10),
        size: 12,
        color: k.rgb(255, 100, 100),
        font: 'monospace',
    });

    k.drawText({
        text: `Shots: ${state.shotsFired}`,
        pos: k.vec2(statsX + 10, statsY + 30),
        size: 12,
        color: k.rgb(200, 200, 200),
        font: 'monospace',
    });

    const accuracy = state.shotsFired > 0
        ? ((state.shotsHit / state.shotsFired) * 100).toFixed(1)
        : 0;

    k.drawText({
        text: `Accuracy: ${accuracy}%`,
        pos: k.vec2(statsX + 10, statsY + 50),
        size: 12,
        color: k.rgb(100, 200, 255),
        font: 'monospace',
    });

    k.drawText({
        text: `Time: ${Math.floor(state.timeAlive)}s`,
        pos: k.vec2(statsX + 10, statsY + 70),
        size: 12,
        color: k.rgb(200, 200, 100),
        font: 'monospace',
    });
}
