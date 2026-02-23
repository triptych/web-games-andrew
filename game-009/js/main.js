/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash'  — Title screen, waits for any key or click
 *   'intro'   — Lore slides shown once after splash; click/key advances, ESC skips
 *   'game'    — Main gameplay scene (battle loop)
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI }    from './ui.js';
import { initAudio, playMenuSelect, playMenuMove } from './sounds.js';
import { initBattle, startNextEncounter } from './battle.js';
import { initBattleRenderer }  from './battleRenderer.js';
import { initCommandMenu, isCommandMenuInSubPhase } from './commandMenu.js';
import { initOverworld }       from './overworld.js';
import { initMapPanel }        from './mapPanel.js';

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

// Load hero sprite images
k.loadSprite('warrior', 'img/warrior_1.png');
k.loadSprite('mage',    'img/wizard_1.png');
k.loadSprite('healer',  'img/healer_1.png');
k.loadSprite('rogue',   'img/rogue_1.png');

// Load enemy sprite images
k.loadSprite('goblin',    'img/goblin_1.png');
k.loadSprite('skeleton',  'img/skeleton_1.png');
k.loadSprite('orc',       'img/orc_1.png');
k.loadSprite('darkElf',   'img/dark_elf_1.png');
k.loadSprite('golem',     'img/stone_golem_1.png');
k.loadSprite('dragon',    'img/dragon_boss_1.png');
k.loadSprite('lichKing',  'img/lich_king_1.png');

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
        k.text('Phase 5', { size: 10 }),
        k.color(50, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click
    let started = false;

    function goToIntro() {
        if (started) return;
        started = true;
        initAudio();
        playMenuSelect();
        document.removeEventListener('keydown', onAnyKey);
        k.go('intro');
    }

    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToIntro();
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(goToIntro);
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: intro  — lore slides
// ============================================================

const INTRO_SLIDES = [
    {
        heading: 'A Land in Darkness',
        body:
            'The Ember Crown — ancient relic of the First Kings —\n' +
            'has been shattered into seven shards by forces unknown.\n\n' +
            'Without its binding light, shadow creatures stir\n' +
            'in the forests, ruins, and mountain passes.',
    },
    {
        heading: 'The Call to Arms',
        body:
            'Four unlikely heroes answer the summons:\n\n' +
            'A seasoned Warrior, a wandering Mage,\n' +
            'a gentle Healer, and a cunning Rogue.\n\n' +
            'Together they march into the dark.',
    },
    {
        heading: 'The Enemy',
        body:
            'Goblins and skeletons are merely the outriders.\n' +
            'The Dragon hoards two shards in its mountain lair.\n\n' +
            'And at the Throne of Ash, the Lich King awaits —\n' +
            'he who shattered the Crown.',
    },
    {
        heading: 'Your Quest',
        body:
            'Fight through twelve encounters.\n' +
            'Spend your gold wisely. Protect your party.\n\n' +
            'Defeat the Lich King and restore the Ember Crown.',
    },
];

k.scene('intro', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    let slideIndex = 0;
    let transitioning = false;

    // Background
    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(...COLORS.bg), k.z(0)]);

    // Decorative top/bottom bars
    k.add([k.pos(0, 0),                  k.rect(GAME_WIDTH, 4), k.color(...COLORS.accent), k.z(1)]);
    k.add([k.pos(0, GAME_HEIGHT - 4),    k.rect(GAME_WIDTH, 4), k.color(...COLORS.accent), k.z(1)]);

    // Slide number indicator dots — fixed position
    const dotEntities = INTRO_SLIDES.map((_, i) => {
        const dotX = CX + (i - (INTRO_SLIDES.length - 1) / 2) * 20;
        const dot = k.add([
            k.pos(dotX, GAME_HEIGHT - 30),
            k.circle(4),
            k.color(i === 0 ? 220 : 60, i === 0 ? 200 : 60, i === 0 ? 80 : 80),
            k.anchor('center'),
            k.z(2),
        ]);
        return dot;
    });

    // Slide content entities — destroyed/recreated on advance
    let headingEnt, bodyEnt, promptEnt, fadeOverlay;
    let blinkTimer = 0;

    function buildSlide(idx) {
        const slide = INTRO_SLIDES[idx];

        headingEnt = k.add([
            k.pos(CX, CY - 160),
            k.text(slide.heading, { size: 28 }),
            k.color(...COLORS.accent),
            k.anchor('center'),
            k.opacity(1),
            k.z(2),
        ]);

        bodyEnt = k.add([
            k.pos(CX, CY - 40),
            k.text(slide.body, { size: 16 }),
            k.color(...COLORS.text),
            k.anchor('center'),
            k.opacity(1),
            k.z(2),
        ]);

        const isLast = idx === INTRO_SLIDES.length - 1;
        const promptStr = isLast ? 'Click or press any key to begin your quest' : 'Click or press any key to continue';
        promptEnt = k.add([
            k.pos(CX, CY + 220),
            k.text(promptStr, { size: 12 }),
            k.color(100, 90, 150),
            k.anchor('center'),
            k.opacity(1),
            k.z(2),
        ]);

        blinkTimer = 0;
        promptEnt.onUpdate(() => {
            blinkTimer += k.dt();
            promptEnt.opacity = (Math.sin(blinkTimer * Math.PI * 1.2) + 1) / 2 * 0.5 + 0.5;
        });

        // Update dot colours
        dotEntities.forEach((dot, i) => {
            dot.color = k.rgb(i === idx ? 220 : 60, i === idx ? 200 : 60, i === idx ? 80 : 80);
        });
    }

    function destroySlide() {
        if (headingEnt) { headingEnt.destroy(); headingEnt = null; }
        if (bodyEnt)    { bodyEnt.destroy();    bodyEnt    = null; }
        if (promptEnt)  { promptEnt.destroy();  promptEnt  = null; }
    }

    function advance() {
        if (transitioning) return;
        transitioning = true;

        // Fade out
        fadeOverlay = k.add([
            k.pos(0, 0),
            k.rect(GAME_WIDTH, GAME_HEIGHT),
            k.color(0, 0, 0),
            k.opacity(0),
            k.z(10),
        ]);

        let t = 0;
        const fadeOut = fadeOverlay.onUpdate(() => {
            t += k.dt();
            fadeOverlay.opacity = Math.min(1, t / 0.35);
            if (t >= 0.35) {
                fadeOut.cancel();
                destroySlide();

                slideIndex++;
                if (slideIndex >= INTRO_SLIDES.length) {
                    // Done — go to game
                    removeListeners();
                    k.go('game');
                    return;
                }

                buildSlide(slideIndex);
                playMenuMove();

                // Fade back in
                let t2 = 0;
                const fadeIn = fadeOverlay.onUpdate(() => {
                    t2 += k.dt();
                    fadeOverlay.opacity = Math.max(0, 1 - t2 / 0.35);
                    if (t2 >= 0.35) {
                        fadeIn.cancel();
                        fadeOverlay.destroy();
                        fadeOverlay = null;
                        transitioning = false;
                    }
                });
            }
        });
    }

    function skip() {
        removeListeners();
        k.go('game');
    }

    // Input handlers
    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.key === 'Escape') { skip(); return; }
        advance();
    }

    function removeListeners() {
        document.removeEventListener('keydown', onAnyKey);
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(advance);
    k.onSceneLeave(removeListeners);

    // ESC hint
    k.add([
        k.pos(GAME_WIDTH - 12, GAME_HEIGHT - 12),
        k.text('ESC to skip', { size: 10 }),
        k.color(60, 55, 90),
        k.anchor('botright'),
        k.z(2),
    ]);

    // Build first slide
    buildSlide(0);
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', (opts = {}) => {
    if (opts.load) {
        state.load();   // restore from localStorage
    } else if (!opts.keepState) {
        state.reset();
    }

    // Core UI (top bar, status panel)
    initUI(k);

    // Battle systems
    initBattleRenderer(k);
    initBattle(k);
    initCommandMenu(k);
    initOverworld(k);
    initMapPanel(k);

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

    // ESC opens/closes pause menu (no longer jumps straight to splash)
    k.onKeyPress('escape', () => {
        if (_escMenuOpen) {
            _closeEscMenu();
        } else if (!isCommandMenuInSubPhase()) {
            _openEscMenu();
        }
    });

    k.onSceneLeave(() => {
        offWon();
        events.clearAll();
    });

    // Kick off the first encounter
    k.wait(0.3, () => startNextEncounter());

    // --------------------------------------------------------
    // Escape / Pause menu
    // --------------------------------------------------------

    let _escMenuOpen    = false;
    let _escEntities    = [];
    let _escCursor      = 0;
    let _escKeyHandlers = [];

    const ESC_ITEMS = [
        { label: 'Resume',  action: () => _closeEscMenu() },
        { label: 'Save',    action: () => _escSave() },
        { label: 'Load',    action: () => _escLoad() },
        { label: 'Restart', action: () => _escRestart() },
        { label: 'Quit to Title', action: () => _escQuit() },
    ];

    function _openEscMenu() {
        if (_escMenuOpen) return;
        _escMenuOpen = true;
        state.isPaused = true;
        _escCursor = 0;
        _buildEscMenu();
        _registerEscKeys();
    }

    function _closeEscMenu() {
        if (!_escMenuOpen) return;
        _escMenuOpen = false;
        state.isPaused = false;
        _escEntities.forEach(e => e.destroy());
        _escEntities = [];
        _escKeyHandlers.forEach(h => h.cancel());
        _escKeyHandlers = [];
    }

    function _buildEscMenu() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;
        const W  = 320;
        const H  = 44 + ESC_ITEMS.length * 42;

        // Dark overlay
        _escEntities.push(k.add([
            k.pos(0, 0),
            k.rect(GAME_WIDTH, GAME_HEIGHT),
            k.color(0, 0, 0),
            k.opacity(0.6),
            k.z(300),
        ]));

        // Panel background
        _escEntities.push(k.add([
            k.pos(CX - W / 2, CY - H / 2),
            k.rect(W, H),
            k.color(...COLORS.panel),
            k.z(301),
        ]));
        _escEntities.push(k.add([
            k.pos(CX - W / 2, CY - H / 2),
            k.rect(W, H),
            k.outline(2, k.rgb(...COLORS.accent)),
            k.color(...COLORS.panel),
            k.z(302),
        ]));

        // Header
        _escEntities.push(k.add([
            k.pos(CX, CY - H / 2 + 16),
            k.text('PAUSED', { size: 18 }),
            k.color(...COLORS.accent),
            k.anchor('top'),
            k.z(303),
        ]));

        // Menu rows — stored so we can refresh cursor highlight
        _buildEscRows(CX, CY, H);
    }

    // Row label entities stored for cursor updates
    let _escRowLabels = [];

    function _buildEscRows(CX, CY, H) {
        _escRowLabels = [];
        ESC_ITEMS.forEach((item, i) => {
            const rowY = CY - H / 2 + 50 + i * 42;

            // Cursor highlight
            const highlight = k.add([
                k.pos(CX - 120, rowY - 4),
                k.rect(240, 32),
                k.color(...COLORS.accent),
                k.opacity(i === _escCursor ? 0.2 : 0),
                k.z(303),
            ]);

            const label = k.add([
                k.pos(CX, rowY + 8),
                k.text(item.label, { size: 16 }),
                k.color(i === _escCursor ? 255 : 180, i === _escCursor ? 230 : 170, i === _escCursor ? 100 : 120),
                k.anchor('center'),
                k.z(304),
            ]);

            _escEntities.push(highlight, label);
            _escRowLabels.push({ label, highlight });
        });
    }

    function _refreshEscCursor() {
        _escRowLabels.forEach(({ label, highlight }, i) => {
            const active = i === _escCursor;
            highlight.opacity = active ? 0.2 : 0;
            label.color = k.rgb(active ? 255 : 180, active ? 230 : 170, active ? 100 : 120);
        });
    }

    function _registerEscKeys() {
        _escKeyHandlers.push(
            k.onKeyPress('arrowup', () => {
                _escCursor = (_escCursor - 1 + ESC_ITEMS.length) % ESC_ITEMS.length;
                playMenuMove();
                _refreshEscCursor();
            }),
            k.onKeyPress('arrowdown', () => {
                _escCursor = (_escCursor + 1) % ESC_ITEMS.length;
                playMenuMove();
                _refreshEscCursor();
            }),
            k.onKeyPress('w', () => {
                _escCursor = (_escCursor - 1 + ESC_ITEMS.length) % ESC_ITEMS.length;
                playMenuMove();
                _refreshEscCursor();
            }),
            k.onKeyPress('s', () => {
                _escCursor = (_escCursor + 1) % ESC_ITEMS.length;
                playMenuMove();
                _refreshEscCursor();
            }),
            k.onKeyPress('space',  () => { playMenuSelect(); ESC_ITEMS[_escCursor].action(); }),
            k.onKeyPress('enter',  () => { playMenuSelect(); ESC_ITEMS[_escCursor].action(); }),
        );
    }

    // ---- Actions ----

    function _escSave() {
        state.save();
        // Flash the Save row label briefly as confirmation
        const row = _escRowLabels[1];
        if (row) {
            const orig = row.label.text;
            row.label.text  = 'Saved!';
            row.label.color = k.rgb(...COLORS.success);
            k.wait(1.2, () => {
                if (row.label && !row.label.is('destroyed')) {
                    row.label.text  = orig;
                    row.label.color = k.rgb(255, 230, 100);
                }
            });
        }
    }

    function _escLoad() {
        const ok = state.load();
        if (!ok) {
            // Flash row with "No save found"
            const row = _escRowLabels[2];
            if (row) {
                const orig = row.label.text;
                row.label.text  = 'No save found!';
                row.label.color = k.rgb(...COLORS.danger);
                k.wait(1.5, () => {
                    if (row.label && !row.label.is('destroyed')) {
                        row.label.text  = orig;
                        row.label.color = k.rgb(180, 170, 120);
                    }
                });
            }
            return;
        }
        // Reload the game scene keeping the newly loaded state
        _closeEscMenu();
        events.clearAll();
        k.go('game', { keepState: true });
    }

    function _escRestart() {
        _closeEscMenu();
        events.clearAll();
        k.go('game');
    }

    function _escQuit() {
        _closeEscMenu();
        events.clearAll();
        k.go('splash');
    }
});

// ============================================================
// Start
// ============================================================

k.go('splash');
