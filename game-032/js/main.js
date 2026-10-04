/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main gameplay scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, showPaused } from './ui.js';
import { initAudio, playUiClick, toggleSound } from './sounds.js';
import { initDungeon, updateDungeon, debug } from './dungeon.js';
import { initTouch, setTouchEnabled, isTouchDevice } from './touch.js';

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
        k.pos(CX, CY - 120),
        k.text('IRONHOLLOW DEPTHS', { size: 56, font: 'monospace' }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.pos(CX, CY - 60),
        k.text('An 8-bit Dungeon Crawler', { size: 18, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, CY + 40),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16, font: 'monospace' }),
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
        k.text(isTouchDevice()
            ? 'MOVE: drag on the left   ATTACK: the sword button'
            : 'MOVE: Arrows / WASD   ATTACK: Space   PAUSE: P   SOUND: M', { size: 13, font: 'monospace' }),
        k.color(120, 160, 140),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.pos(CX, CY + 130),
        k.text('Clear ten floors and claim the Hollow Crown', { size: 13, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    const best = state.best;
    if (best.floor > 0) {
        k.add([
            k.pos(CX, CY + 170),
            k.text(`BEST: FLOOR ${best.floor}  ${best.score} PTS${best.won ? '  CROWN CLAIMED' : ''}`, { size: 13, font: 'monospace' }),
            k.color(...COLORS.accent),
            k.anchor('center'),
            k.z(1),
        ]);
    }

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('v1.2', { size: 10 }),
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

let inGame = false;

function setPaused(on) {
    if (!inGame || state.isOver || state.isPaused === on) return;
    state.isPaused = on;
    showPaused(on);
}

initTouch(() => setPaused(!state.isPaused));

// Pause when the tab is hidden, so a run isn't lost while you're away
document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true);
});

k.scene('game', () => {
    state.reset();

    initUI(k);
    initDungeon(k);
    setTouchEnabled(true);
    inGame = true;

    k.onUpdate(() => {
        updateDungeon(k.dt());
    });

    const restart = () => {
        events.clearAll();
        k.go('game');
    };

    // Run over: hide the touch controls so a tap anywhere restarts
    const offEnd = [
        events.on('gameOver', () => setTouchEnabled(false)),
        events.on('gameWon',  () => setTouchEnabled(false)),
    ];
    k.onClick(() => { if (state.isOver) restart(); });

    // Key bindings
    k.onKeyPress('r', restart);
    k.onKeyPress('p', () => setPaused(!state.isPaused));
    k.onKeyPress('m', () => toggleSound());

    k.onKeyPress('escape', () => {
        events.clearAll();
        // ?debug=1 exposes hooks for dev/browsertest.mjs
if (new URLSearchParams(location.search).has('debug')) {
    window.__ih = { k, state, dungeon: debug, start: () => k.go('game') };
}

k.go('splash');
    });

    k.onSceneLeave(() => {
        inGame = false;
        offEnd.forEach(off => off());
        setTouchEnabled(false);
        events.clearAll();
        k.destroyAll('dungeon');
    });
});

// ============================================================
// Start
// ============================================================

// ?debug=1 exposes hooks for dev/browsertest.mjs
if (new URLSearchParams(location.search).has('debug')) {
    window.__ih = { k, state, dungeon: debug, start: () => k.go('game') };
}

k.go('splash');
