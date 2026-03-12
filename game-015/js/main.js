/**
 * main.js — Kaplay init and scene definitions for Tamagoji.
 *
 * Scenes:
 *   'splash' — Title / species select screen
 *   'game'   — Main pet raising scene
 *
 * KAPLAY API GOTCHAS:
 *   1. entity.pos is a getter/setter — NEVER mutate .x/.y directly.
 *      Use: entity.pos = k.vec2(x, y)
 *   2. entity.opacity only works if k.opacity(1) was in the component list at creation.
 *   3. k.text() — square brackets are style tags. Use parentheses instead.
 *   4. k.rgba() does NOT exist. Use k.color(r,g,b) or k.color(r,g,b,a).
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS, PET_SPECIES } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, showGameOver, showHatchAnimation } from './ui.js';
import {
    initAudio, playUiClick, playHatch, playStageUp,
    playSad, playDeath, playHappy, playFeed, playEggGet,
    playSleep, playBath,
} from './sounds.js';

// ============================================================
// Kaplay init — portrait mobile-friendly canvas
// ============================================================

const k = kaplay({
    width:        GAME_WIDTH,
    height:       GAME_HEIGHT,
    background:   COLORS.bg,
    letterbox:    true,
    crisp:        false,
    pixelDensity: Math.min(window.devicePixelRatio, 2),
    font:         'pixel',
});

k.loadFont('pixel', 'pixel-game/Pixel%20Game.otf');

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

    // Title
    k.add([
        k.pos(CX, 100),
        k.text('TAMAGOJI', { size: 54 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.pos(CX, 155),
        k.text('Raise your emoji pet', { size: 15 }),
        k.color(...COLORS.textDim),
        k.anchor('center'),
        k.z(1),
    ]);

    // Egg display row
    const eggY = 320;
    let selectedIdx = 0;

    const eggLabels = PET_SPECIES.map((species, i) => {
        const spacing = GAME_WIDTH / PET_SPECIES.length;
        const cx = spacing * i + spacing / 2;

        const circle = k.add([
            k.pos(cx, eggY),
            k.circle(44),
            k.color(...COLORS.bgCard),
            k.anchor('center'),
            k.outline(2, i === 0 ? k.rgb(...COLORS.accent) : k.rgb(60, 55, 80)),
            k.area(),
            k.z(3),
        ]);

        const icon = k.add([
            k.pos(cx, eggY),
            k.text(species.egg, { size: 36, font: 'monospace' }),
            k.anchor('center'),
            k.z(4),
        ]);

        k.add([
            k.pos(cx, eggY + 46),
            k.text(species.name, { size: 14 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(4),
        ]);

        circle.onClick(() => {
            selectedIdx = i;
            eggLabels.forEach((el, j) => {
                el.outline.color = j === selectedIdx
                    ? k.rgb(...COLORS.accent)
                    : k.rgb(60, 55, 80);
            });
            selectedNameLabel.text = `${species.name} selected`;
            playUiClick();
        });

        return circle;
    });

    const selectedNameLabel = k.add([
        k.pos(CX, eggY + 80),
        k.text(`${PET_SPECIES[0].name} selected`, { size: 13 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(4),
    ]);

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, 460),
        k.text('TAP TO HATCH YOUR EGG', { size: 16 }),
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

    // Preview of adult form
    k.add([
        k.pos(CX, 560),
        k.text('Grow from egg to adult through 4 life stages!', { size: 11 }),
        k.color(80, 75, 110),
        k.anchor('center'),
        k.z(1),
    ]);

    // Show stage progression emojis
    let stagePreviewTimer = 0;
    let stagePreviewIdx   = 0;
    const stageLabels = ['egg','baby','child','teen','adult'];
    const previewRow = k.add([
        k.pos(CX, 610),
        k.text('', { size: 22 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(1),
    ]);

    function _updatePreview() {
        const sp = PET_SPECIES[selectedIdx];
        const emojis = [sp.egg, sp.baby, sp.child, sp.teen, sp.adult];
        previewRow.text = emojis.join('  →  ');
    }
    _updatePreview();

    previewRow.onUpdate(() => {
        _updatePreview();
    });

    // Version
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 1', { size: 10 }),
        k.color(50, 45, 70),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start
    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        playUiClick();
        state.startNewEgg(selectedIdx);
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
    initUI(k);

    // Emit current state so UI reflects loaded/resumed values
    events.emit('petStatsChanged', state.getStats());
    events.emit('petStageChanged', state.stage);
    events.emit('goldChanged', state.gold);
    events.emit('moodChanged', state.mood);

    // ---- Sound wiring ----
    const offs = [
        events.on('petHatched',    (species) => { playHatch(); showHatchAnimation(species); }),
        events.on('petStageChanged', (stage)  => { if (stage !== 'egg') playStageUp(); }),
        events.on('feedStart',      ()        => { playFeed(); }),
        events.on('interactStart',  (id)      => {
            if (id === 'sleep')  playSleep();
            else if (id === 'bath') playBath();
            else                 playHappy();
        }),
        events.on('moodChanged',   (mood)     => {
            if (mood === 'sad' || mood === 'hungry') playSad();
        }),
        events.on('petDied',       ()         => { playDeath(); showGameOver(); state.clearSave(); }),
        events.on('newEggReady',   ()         => { playEggGet(); }),
        events.on('resetRequested', ()        => {
            state.clearSave();
            state.reset();
            k.go('splash');
        }),
    ];

    // ---- Passive gold earning + auto-save ----
    let goldTimer = 0;
    let saveTimer = 0;
    k.onUpdate(() => {
        if (state.isGameOver) return;

        // Tick pet stats
        state.tick(k.dt());

        // Earn gold over time
        goldTimer += k.dt();
        if (goldTimer >= 30) {
            goldTimer = 0;
            state.addGold(10);
        }

        // Auto-save every 10 seconds
        saveTimer += k.dt();
        if (saveTimer >= 10) {
            saveTimer = 0;
            state.save();
        }
    });

    // ---- Keyboard shortcuts ----
    k.onKeyPress('r', () => {
        if (state.isGameOver) {
            events.clearAll();
            k.go('splash');
        }
    });

    k.onKeyPress('escape', () => {
        if (state.uiMode !== 'main') {
            state.uiMode = 'main';
        } else {
            events.clearAll();
            k.go('splash');
        }
    });

    // Tap to restart after death
    k.onClick(() => {
        if (state.isGameOver) {
            events.clearAll();
            offs.forEach(off => off());
            k.go('splash');
        }
    });

    k.onSceneLeave(() => {
        offs.forEach(off => off());
        events.clearAll();
    });
});

// ============================================================
// Start — resume save or show splash
// ============================================================

if (state.load() && !state.isGameOver && state.stage !== 'none') {
    k.go('game');
} else {
    k.go('splash');
}
