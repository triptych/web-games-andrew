/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'  — Title screen, waits for any key or click
 *   'game'    — Main gameplay scene (battle loop)
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI }    from './ui.js';
import { initAudio, playMenuSelect } from './sounds.js';
import { initBattle, startNextEncounter } from './battle.js';
import { initBattleRenderer }  from './battleRenderer.js';
import { initCommandMenu }     from './commandMenu.js';

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
        k.text('CHRONICLES OF THE EMBER CROWN', { size: 40 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Subtitle / tagline
    k.add([
        k.pos(CX, CY - 70),
        k.text('A Turn-Based RPG', { size: 18 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(1),
    ]);

    // Party preview blurb
    k.add([
        k.pos(CX, CY - 10),
        k.text('Lead a party of four heroes across a dark land.\nBattle monsters, gain XP, and face the Lich King.', { size: 14 }),
        k.color(140, 130, 180),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    // NOTE: k.opacity(1) MUST be included for prompt.opacity to work.
    const prompt = k.add([
        k.pos(CX, CY + 80),
        k.text('PRESS ANY KEY OR CLICK TO BEGIN', { size: 16 }),
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
        k.pos(CX, CY + 140),
        k.text('Arrow Keys / WASD: navigate   Space / Enter: confirm   ESC: back / menu', { size: 11 }),
        k.color(80, 70, 120),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 2', { size: 10 }),
        k.color(50, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click
    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        playMenuSelect();
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

    // Core UI (top bar, status panel)
    initUI(k);

    // Battle systems
    initBattleRenderer(k);
    initBattle(k);
    initCommandMenu(k);

    // Listen for game-won event
    const offWon = events.on('gameWon', () => {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;
        k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0, 0, 0), k.opacity(0.75), k.z(200)]);
        k.add([k.pos(CX, CY - 60), k.text('YOU WIN!', { size: 56 }), k.color(...COLORS.accent), k.anchor('center'), k.z(201)]);
        k.add([k.pos(CX, CY), k.text('The Lich King has fallen.', { size: 22 }), k.color(...COLORS.text), k.anchor('center'), k.z(201)]);
        k.add([k.pos(CX, CY + 50), k.text(`Final Score: ${state.score}`, { size: 20 }), k.color(...COLORS.xp), k.anchor('center'), k.z(201)]);
        k.add([k.pos(CX, CY + 100), k.text('Press R to play again  |  ESC for menu', { size: 14 }), k.color(...COLORS.accent), k.anchor('center'), k.z(201)]);
    });

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
        offWon();
        events.clearAll();
    });

    // Kick off the first encounter
    k.wait(0.3, () => startNextEncounter());
});

// ============================================================
// Start
// ============================================================

k.go('splash');
