/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

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
