/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main gameplay scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 *
 * Game: Nonogram Fleet
 * Concept: Solve nonogram puzzles to reveal the hidden positions of
 *          enemy spaceships, then fire torpedoes to sink the fleet.
 *          Limited shots per puzzle create tension — every cell counts.
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { initFleet } from './fleet.js';
import { initPuzzle, getClues } from './puzzle.js';

// ============================================================
// KAPLAY API GOTCHAS (read before adding entities)
// ============================================================
//
// 1. POSITION — entity.pos is a getter/setter, NOT a plain field.
//    Mutating the returned Vec2 has NO visual effect:
//      BAD:  entity.pos.x = 100;          // silently broken
//      GOOD: entity.pos = k.vec2(100, y); // correct
//
// 2. OPACITY — setting entity.opacity only works if k.opacity()
//    was declared in the k.add([...]) component list at creation:
//      BAD:  k.add([k.pos(x,y), k.rect(w,h)])  → entity.opacity = 0.5; // ignored
//      GOOD: k.add([k.pos(x,y), k.rect(w,h), k.opacity(1)]) → entity.opacity = 0.5; // works
//
// 3. TEXT — square brackets in k.text() strings are parsed as style tags.
//    Use parentheses instead:
//      BAD:  k.text('[Space] to fire')    // "Styled text error: unclosed tags"
//      GOOD: k.text('(Space) to fire')
//
// 4. COLOR — k.rgba() does not exist. Use k.color(r,g,b,a) or k.color(r,g,b).
//    For outline/fill params use k.rgb(r,g,b).
//
// ============================================================
// Kaplay init
// ============================================================

const k = kaplay({
    width:        GAME_WIDTH,
    height:       GAME_HEIGHT,
    background:   COLORS.bg,
    letterbox:    true,
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio, 2),
});

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 130),
        k.text('NONOGRAM FLEET', { size: 64 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Subtitle
    k.add([
        k.pos(CX, CY - 65),
        k.text('Solve the grid. Sink the fleet.', { size: 18 }),
        k.color(100, 140, 200),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    // NOTE: k.opacity(1) MUST be included — setting entity.opacity only works
    // if the opacity component was declared at creation time.
    const prompt = k.add([
        k.pos(CX, CY + 30),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
    });

    // Controls hint
    k.add([
        k.pos(CX, CY + 100),
        k.text('Left Click — fill cell    Right Click — mark empty', { size: 12 }),
        k.color(70, 90, 140),
        k.anchor('center'),
        k.z(1),
    ]);
    k.add([
        k.pos(CX, CY + 120),
        k.text('(Space) — fire torpedo    R — restart    ESC — menu', { size: 12 }),
        k.color(70, 90, 140),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 1', { size: 10 }),
        k.color(40, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click
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
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    state.reset();

    initUI(k);

    // Generate hidden enemy fleet and nonogram clues
    initFleet();
    const { rowClues, colClues } = initPuzzle();

    // Debug readout — shows clues in console; visible in Phase 1 as a status line.
    // Phase 2 will replace this with the rendered nonogram grid.
    console.log('[Nonogram Fleet] Fleet placed. Row clues:', rowClues);
    console.log('[Nonogram Fleet] Column clues:', colClues);

    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY - 20),
        k.text('Phase 1 Complete', { size: 28 }),
        k.color(...COLORS.success),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.pos(CX, CY + 30),
        k.text('Fleet placed — clues ready — see console', { size: 16 }),
        k.color(100, 120, 180),
        k.anchor('center'),
        k.z(1),
    ]);

    // Key bindings
    k.onKeyPress('r', () => {
        events.clearAll();
        k.go('game');
    });

    k.onKeyPress('p', () => {
        state.isPaused = !state.isPaused;
    });

    k.onKeyPress('escape', () => {
        events.clearAll();
        k.go('splash');
    });

    k.onSceneLeave(() => {
        events.clearAll();
    });
});

// ============================================================
// Start
// ============================================================

k.go('splash');
