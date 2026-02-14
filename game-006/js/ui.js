/**
 * UI System
 * Handles HUD overlay using kaplay rendering
 */

import { state } from './state.js';

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
            text: `Dir: ${Math.floor(player.angle)}°`,
            pos: k.vec2(10, 50),
            size: 14,
            color: k.rgb(0, 255, 0),
            font: 'monospace',
        });

        // Controls hint (bottom center)
        k.drawText({
            text: 'Click to lock mouse | WASD: Move | A/D: Strafe | Arrows: Look | Shift: Sprint',
            pos: k.vec2(k.width() / 2, k.height() - 20),
            size: 12,
            color: k.rgb(136, 136, 136),
            font: 'monospace',
            anchor: 'center',
        });
    });

    console.log('UI system initialized');
}
