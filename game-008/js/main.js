/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'  — Title screen, waits for user input
 *   'game'    — Main gameplay loop (Phase 1: grid + HUD)
 *   'gameover'— (stub, handled by UI overlay for now)
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }       from './state.js';
import { events }      from './events.js';
import { initGrid }       from './grid.js';
import { initUI }         from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { initCentipede }  from './centipede.js';
import { initPlayer }     from './player.js';
import { initTowers }     from './towers.js';
import { initShop, destroyShopDOM } from './shop.js';

// ============================================================
// Kaplay initialisation
// ============================================================

const k = kaplay({
    width:        GAME_WIDTH,
    height:       GAME_HEIGHT,
    background:   COLORS.bg,
    letterbox:    true,
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio, 2),
    // No canvas argument — kaplay creates and appends its own canvas.
});

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Dark background rect (fills canvas fully)
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(6, 6, 14),
        k.z(0),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 110),
        k.text('CENTIPEDE', { size: 72 }),
        k.color(255, 80, 80),
        k.anchor('center'),
        k.z(1),
    ]);
    k.add([
        k.pos(CX, CY - 38),
        k.text('TOWER DEFENSE', { size: 36 }),
        k.color(180, 180, 220),
        k.anchor('center'),
        k.z(1),
    ]);

    // Animated prompt (blink)
    const prompt = k.add([
        k.pos(CX, CY + 60),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16 }),
        k.color(140, 200, 255),
        k.anchor('center'),
        k.z(1),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
    });

    // Short summary
    k.add([
        k.pos(CX, CY + 120),
        k.text(
            'Defend against the centipede horde!\n' +
            'Place towers · Shoot segments · Survive 20 waves',
            { size: 13 }
        ),
        k.color(120, 120, 160),
        k.anchor('center'),
        k.z(1),
    ]);

    // Controls quick-ref
    k.add([
        k.pos(CX, CY + 190),
        k.text('WASD/Arrows: Move   Space: Smart Bomb   R: Restart', { size: 11 }),
        k.color(80, 80, 120),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 12, GAME_HEIGHT - 12),
        k.text('Phase 4', { size: 10 }),
        k.color(50, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Transition to game on any key or click
    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        playUiClick();
        document.removeEventListener('keydown', onAnyKey);
        k.go('game');
    }

    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToGame();
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(goToGame);

    // Ensure DOM listener is cleaned up if scene changes for any reason
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    // Reset all state for a fresh game
    state.reset();

    // Build the grid (tiles + tower slot highlights + seed nodes)
    initGrid(k);

    // Build the HUD panels in the side margins
    initUI(k);

    // Spawn the centipede and start its update loop
    initCentipede(k);

    // Spawn the player ship and start its update / input loop
    initPlayer(k);

    // Phase 4: tower placement, auto-fire, upgrade, sell
    initTowers(k);

    // Phase 4: shop DOM panel + between-wave overlay
    initShop(k);

    // --- Key bindings ---

    // Restart
    k.onKeyPress('r', () => {
        events.clearAll();
        k.go('game');
    });

    // Pause toggle
    k.onKeyPress('p', () => {
        state.isPaused = !state.isPaused;
    });

    // ESC → back to splash
    k.onKeyPress('escape', () => {
        events.clearAll();
        k.go('splash');
    });

    // Cleanup on scene leave
    k.onSceneLeave(() => {
        destroyShopDOM();
        events.clearAll();
    });
});

// ============================================================
// Start
// ============================================================

k.go('splash');
