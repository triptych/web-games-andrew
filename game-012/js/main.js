/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'    — Title screen, waits for any key or click
 *   'collection'— Browse owned cards and set party
 *   'gacha'     — Pull new cards from the tarot banner
 *   'battle'    — Auto-battler combat scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { CARD_DEFS } from './cards.js';
// TODO: import game-specific modules as you build each phase
// import { initGacha }      from './gacha.js';
// import { initCollection } from './collection.js';
// import { initBattle }     from './battle.js';

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
// Asset loading — all 78 tarot card sprites
// ============================================================

const CARD_IMG_BASE = '../res/tarot/cards/';

for (const card of CARD_DEFS) {
    k.loadSprite(card.img, `${CARD_IMG_BASE}${card.img}.jpg`);
}

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Decorative subtitle
    k.add([
        k.pos(CX, CY - 140),
        k.text('TAROT AUTO BATTLER', { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 80),
        k.text('ARCANA PULL', { size: 72 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Flavour line
    k.add([
        k.pos(CX, CY - 10),
        k.text('Collect the Major Arcana. Build your party. Conquer fate.', { size: 14 }),
        k.color(...COLORS.silver),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, CY + 60),
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
        k.pos(CX, CY + 120),
        k.text('(G) Gacha Pull   (C) Collection   (B) Battle', { size: 13 }),
        k.color(80, 60, 140),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 1', { size: 10 }),
        k.color(50, 40, 80),
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
// SCENE: game  (hub / main menu between runs)
// ============================================================

k.scene('game', () => {
    state.reset();

    initUI(k);

    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Hub background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bgPanel),
        k.z(0),
    ]);

    k.add([
        k.pos(CX, 60),
        k.text('ARCANA PULL', { size: 40 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Placeholder menu options
    const menuItems = [
        { label: '(G) Gacha — Pull Cards', scene: 'gacha' },
        { label: '(C) Collection — View Party', scene: 'collection' },
        { label: '(B) Battle — Start Wave', scene: 'battle' },
    ];

    menuItems.forEach((item, i) => {
        k.add([
            k.pos(CX, CY - 40 + i * 60),
            k.text(item.label, { size: 22 }),
            k.color(...COLORS.accent),
            k.anchor('center'),
            k.z(1),
        ]);
    });

    k.add([
        k.pos(CX, GAME_HEIGHT - 30),
        k.text('TODO: implement gacha, collection, and battle scenes', { size: 11 }),
        k.color(60, 50, 100),
        k.anchor('center'),
        k.z(1),
    ]);

    // Key bindings
    k.onKeyPress('r', () => {
        events.clearAll();
        k.go('game');
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
// SCENE STUBS — fill in during Phase 2+
// ============================================================

k.scene('gacha', () => {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY),
        k.text('GACHA SCENE — coming soon\n\n(ESC) back', { size: 24 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress('escape', () => k.go('game'));
    k.onSceneLeave(() => events.clearAll());
});

k.scene('collection', () => {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY),
        k.text('COLLECTION SCENE — coming soon\n\n(ESC) back', { size: 24 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress('escape', () => k.go('game'));
    k.onSceneLeave(() => events.clearAll());
});

k.scene('battle', () => {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(CX, CY),
        k.text('BATTLE SCENE — coming soon\n\n(ESC) back', { size: 24 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress('escape', () => k.go('game'));
    k.onSceneLeave(() => events.clearAll());
});

// ============================================================
// Start
// ============================================================

k.go('splash');
