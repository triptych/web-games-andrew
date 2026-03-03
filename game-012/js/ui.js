/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 * Call initNavBar(k, currentScene) once per non-splash scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { playUiClick } from './sounds.js';

let k;
let scoreLabel, gemsLabel, waveLabel;

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _subscribeEvents();
}

function _buildHUD() {
    // Score — top-left
    scoreLabel = k.add([
        k.pos(12, 10),
        k.text(`SCORE  ${state.score}`, { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(100),
    ]);

    // Gems — top-center
    gemsLabel = k.add([
        k.pos(GAME_WIDTH / 2, 10),
        k.text(`GEMS  ${state.gems}`, { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('top'),
        k.z(100),
    ]);

    // Wave — top-right
    waveLabel = k.add([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`WAVE  ${state.wave}`, { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('topright'),
        k.z(100),
    ]);
}

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', (v) => {
            scoreLabel.text = `SCORE  ${v}`;
        }),
        events.on('gemsChanged', (v) => {
            gemsLabel.text = `GEMS  ${v}`;
        }),
        events.on('gameOver', () => {
            _showGameOver();
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

// ============================================================
// Universal nav bar — shown on every scene after splash
// ============================================================

const NAV_BUTTONS = [
    { label: '(H) Hub',        key: 'h',  scene: 'game'       },
    { label: '(G) Gacha',      key: 'g',  scene: 'gacha'      },
    { label: '(C) Collection', key: 'c',  scene: 'collection' },
    { label: '(B) Battle',     key: 'b',  scene: 'battle'     },
    { label: '(X) Reading',    key: 'x',  scene: 'reading'    },
];

const NAV_H        = 40;
const NAV_Y        = GAME_HEIGHT - NAV_H;
const NAV_BTN_W    = GAME_WIDTH / NAV_BUTTONS.length;

/**
 * Draw a persistent nav bar at the bottom of the screen.
 * @param {object} kaplay - the Kaplay instance
 * @param {string} activeScene - name of the current scene (its button is highlighted)
 */
export function initNavBar(kaplay, activeScene) {
    const kk = kaplay;

    // Background strip
    kk.add([
        kk.pos(0, NAV_Y),
        kk.rect(GAME_WIDTH, NAV_H),
        kk.color(10, 6, 24),
        kk.outline(1, kk.rgb(50, 35, 90)),
        kk.z(150),
    ]);

    NAV_BUTTONS.forEach((btn, i) => {
        const bx = NAV_BTN_W * i + NAV_BTN_W / 2;
        const by = NAV_Y + NAV_H / 2;

        const isActive = btn.scene === activeScene;
        const baseColor  = isActive ? [60, 35, 120] : [18, 10, 40];
        const labelColor = isActive ? COLORS.gold    : COLORS.silver;
        const outlineCol = isActive ? kk.rgb(...COLORS.accent) : kk.rgb(40, 28, 70);

        const bg = kk.add([
            kk.pos(bx, by),
            kk.rect(NAV_BTN_W - 4, NAV_H - 6, { radius: 4 }),
            kk.color(...baseColor),
            kk.outline(1, outlineCol),
            kk.anchor('center'),
            kk.area(),
            kk.z(151),
        ]);

        kk.add([
            kk.pos(bx, by),
            kk.text(btn.label, { size: 13 }),
            kk.color(...labelColor),
            kk.anchor('center'),
            kk.z(152),
        ]);

        if (!isActive) {
            bg.onHover(()    => { bg.color = kk.rgb(35, 22, 75); });
            bg.onHoverEnd(() => { bg.color = kk.rgb(...baseColor); });
            bg.onClick(() => {
                playUiClick();
                events.clearAll();
                kk.go(btn.scene);
            });
            kk.onKeyPress(btn.key, () => {
                playUiClick();
                events.clearAll();
                kk.go(btn.scene);
            });
        }
    });
}

function _showGameOver() {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.75),
        k.z(200),
    ]);

    k.add([
        k.pos(CX, CY - 60),
        k.text('GAME OVER', { size: 56 }),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 10),
        k.text(`Final Score: ${state.score}`, { size: 24 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 60),
        k.text(`Gems Collected: ${state.gems}`, { size: 18 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 110),
        k.text('Press R to restart  |  ESC for menu', { size: 14 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(201),
    ]);
}
