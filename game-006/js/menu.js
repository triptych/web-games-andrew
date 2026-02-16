/**
 * Menu System
 * Handles splash screen and main menu
 */

import { SCREEN_WIDTH, SCREEN_HEIGHT } from './config.js';

/**
 * Initialize menu scene with Kaplay
 */
export function initMenuScene(k) {
    k.scene("menu", () => {
        // Dark background
        k.add([
            k.rect(SCREEN_WIDTH, SCREEN_HEIGHT),
            k.color(15, 15, 25),
            k.pos(0, 0),
            k.z(-10),
        ]);

        // Title
        k.add([
            k.text("WOLFENSTEIN 3D", {
                size: 48,
                font: 'monospace',
            }),
            k.pos(SCREEN_WIDTH / 2, 60),
            k.anchor('center'),
            k.color(255, 200, 100),
        ]);

        // Subtitle
        k.add([
            k.text("Raycasting FPS", {
                size: 20,
                font: 'monospace',
            }),
            k.pos(SCREEN_WIDTH / 2, 110),
            k.anchor('center'),
            k.color(200, 200, 200),
        ]);

        // Help section title
        k.add([
            k.text("CONTROLS", {
                size: 24,
                font: 'monospace',
            }),
            k.pos(SCREEN_WIDTH / 2, 160),
            k.anchor('center'),
            k.color(100, 200, 255),
        ]);

        // Controls list - Movement
        const controlsY = 200;
        const lineHeight = 20;

        k.add([
            k.text("MOVEMENT:", { size: 14, font: 'monospace' }),
            k.pos(50, controlsY),
            k.color(255, 255, 100),
        ]);

        k.add([
            k.text("W / Up Arrow - Move Forward", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("S / Down Arrow - Move Backward", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight * 2),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("A - Strafe Left", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight * 3),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("D - Strafe Right", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight * 4),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("Left/Right Arrow - Turn", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight * 5),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("Shift - Sprint", { size: 12, font: 'monospace' }),
            k.pos(70, controlsY + lineHeight * 6),
            k.color(200, 200, 200),
        ]);

        // Controls - Combat
        k.add([
            k.text("COMBAT:", { size: 14, font: 'monospace' }),
            k.pos(350, controlsY),
            k.color(255, 100, 100),
        ]);

        k.add([
            k.text("Mouse Click - Shoot", { size: 12, font: 'monospace' }),
            k.pos(370, controlsY + lineHeight),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("Mouse Move - Look Around", { size: 12, font: 'monospace' }),
            k.pos(370, controlsY + lineHeight * 2),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("1-4 Keys - Switch Weapons", { size: 12, font: 'monospace' }),
            k.pos(370, controlsY + lineHeight * 3),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("Mouse Wheel - Cycle Weapons", { size: 12, font: 'monospace' }),
            k.pos(370, controlsY + lineHeight * 4),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("ESC - Pause Game", { size: 12, font: 'monospace' }),
            k.pos(370, controlsY + lineHeight * 5),
            k.color(200, 200, 200),
        ]);

        // Weapons info
        k.add([
            k.text("WEAPONS:", { size: 14, font: 'monospace' }),
            k.pos(50, 340),
            k.color(255, 200, 100),
        ]);

        k.add([
            k.text("1 - Pistol (Infinite Ammo)", { size: 11, font: 'monospace' }),
            k.pos(70, 360),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("2 - Machine Gun (Uses Bullets)", { size: 11, font: 'monospace' }),
            k.pos(70, 375),
            k.color(200, 200, 200),
        ]);

        k.add([
            k.text("3 - Shotgun (Uses Shells) - Collect shells to use!", { size: 11, font: 'monospace' }),
            k.pos(70, 390),
            k.color(255, 150, 150),
        ]);

        k.add([
            k.text("4 - Rocket Launcher (Uses Rockets) - Collect rockets to use!", { size: 11, font: 'monospace' }),
            k.pos(70, 405),
            k.color(255, 150, 150),
        ]);

        // Pickups info
        k.add([
            k.text("PICKUPS:", { size: 14, font: 'monospace' }),
            k.pos(350, 340),
            k.color(100, 255, 100),
        ]);

        k.add([
            k.text("Green Items - Health", { size: 11, font: 'monospace' }),
            k.pos(370, 360),
            k.color(100, 255, 100),
        ]);

        k.add([
            k.text("Orange Items - Bullets", { size: 11, font: 'monospace' }),
            k.pos(370, 375),
            k.color(255, 200, 100),
        ]);

        k.add([
            k.text("Red Items - Shells", { size: 11, font: 'monospace' }),
            k.pos(370, 390),
            k.color(255, 100, 100),
        ]);

        k.add([
            k.text("Yellow Items - Rockets", { size: 11, font: 'monospace' }),
            k.pos(370, 405),
            k.color(255, 255, 100),
        ]);

        // Start prompt - pulsing effect
        const startPrompt = k.add([
            k.text("CLICK ANYWHERE TO START", {
                size: 24,
                font: 'monospace',
            }),
            k.pos(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40),
            k.anchor('center'),
            k.color(255, 255, 255),
            k.opacity(1),
        ]);

        // Pulsing animation for start prompt
        let pulseDirection = -1;
        startPrompt.onUpdate(() => {
            const newOpacity = startPrompt.opacity + pulseDirection * 0.02;
            if (newOpacity <= 0.3) {
                pulseDirection = 1;
            } else if (newOpacity >= 1.0) {
                pulseDirection = -1;
            }
            startPrompt.opacity = newOpacity;
        });

        // Start game on any click (only in menu scene)
        k.onClick(() => {
            if (k.getSceneName() === "menu") {
                console.log('Starting game from menu...');
                k.go("game");
            }
        });

        // Start game on any key press (only in menu scene)
        k.onKeyPress(() => {
            if (k.getSceneName() === "menu") {
                console.log('Starting game from menu...');
                k.go("game");
            }
        });

        console.log('Menu scene initialized');
    });
}
