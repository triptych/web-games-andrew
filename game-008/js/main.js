/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'  — Title screen, waits for user input
 *   'game'    — Main gameplay loop
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
import { initWaves }      from './waves.js';
import { initEnemies }    from './enemies.js';

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

    // Dark background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(6, 6, 14),
        k.z(0),
    ]);

    // Subtle decorative grid lines
    for (let i = 0; i < 8; i++) {
        k.add([
            k.pos(0, i * (GAME_HEIGHT / 7)),
            k.rect(GAME_WIDTH, 1),
            k.color(20, 20, 40),
            k.z(0),
        ]);
    }

    // Title block
    k.add([
        k.pos(CX, CY - 130),
        k.text('CENTIPEDE', { size: 80 }),
        k.color(255, 70, 70),
        k.anchor('center'),
        k.z(1),
    ]);
    k.add([
        k.pos(CX, CY - 52),
        k.text('TOWER DEFENSE', { size: 38 }),
        k.color(180, 180, 230),
        k.anchor('center'),
        k.z(1),
    ]);

    // Thin separator line under title
    k.add([
        k.pos(CX - 240, CY - 18),
        k.rect(480, 1),
        k.color(60, 60, 100),
        k.z(1),
    ]);

    // How-to-play card
    k.add([
        k.pos(CX, CY + 20),
        k.rect(640, 120, { radius: 8 }),
        k.color(14, 14, 28),
        k.outline(1, k.rgb(40, 40, 80)),
        k.anchor('center'),
        k.z(1),
    ]);
    k.add([
        k.pos(CX, CY - 5),
        k.text(
            'Shoot centipede segments with your ship  \u2022  Place towers on blue slots\n' +
            'Earn gold per kill  \u2022  Upgrade towers between waves\n' +
            'Survive all 20 waves to win!',
            { size: 13 }
        ),
        k.color(140, 140, 180),
        k.anchor('center'),
        k.z(2),
    ]);

    // Controls row
    k.add([
        k.pos(CX, CY + 100),
        k.text('WASD / Arrows: Move     Space: Smart Bomb     P: Pause     R: Restart', { size: 11 }),
        k.color(80, 80, 120),
        k.anchor('center'),
        k.z(2),
    ]);

    // Animated start prompt
    const prompt = k.add([
        k.pos(CX, CY + 140),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 17 }),
        k.color(140, 200, 255),
        k.anchor('center'),
        k.opacity(1),
        k.z(2),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.6) + 1) / 2 * 0.7 + 0.3;
    });

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 12, GAME_HEIGHT - 12),
        k.text('v1.0', { size: 10 }),
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

    // Register centipede update loop (waves.js handles actual spawning)
    initCentipede(k);

    // Spawn the player ship and start its update / input loop
    initPlayer(k);

    // Phase 4: tower placement, auto-fire, upgrade, sell
    initTowers(k);

    // Phase 4: shop DOM panel + between-wave overlay
    initShop(k);

    // Phase 5: special enemies (flea, spider, scorpion) + per-frame update
    initEnemies(k);

    // Phase 5: wave sequencer — starts wave 1 after a short delay
    initWaves(k);

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
