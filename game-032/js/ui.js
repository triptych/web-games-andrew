/**
 * ui.js — HUD and in-game UI.
 * Styled after 80's CRT dungeon-crawler status bars: a chunky monospace
 * readout in the top-left (SCORE / LEVEL / HEALTH), retro and blocky.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, HUD_FONT_SIZE } from './config.js';

let k;
let statusLabel, healthBarFill, healthBarBg, livesLabel;

const HEALTH_BAR_W = 160;
const HEALTH_BAR_H = 14;

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _subscribeEvents();
}

function _buildHUD() {
    // Retro status readout — top-left, mimics "S30T86 - 11" style CRT text
    statusLabel = k.add([
        k.pos(12, 10),
        k.text(_statusText(), { size: HUD_FONT_SIZE, font: 'monospace' }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(100),
    ]);

    // Health bar — below status text
    healthBarBg = k.add([
        k.pos(12, 40),
        k.rect(HEALTH_BAR_W, HEALTH_BAR_H),
        k.color(30, 10, 10),
        k.outline(2, k.rgb(...COLORS.wallDark)),
        k.anchor('topleft'),
        k.z(100),
    ]);

    healthBarFill = k.add([
        k.pos(14, 42),
        k.rect(HEALTH_BAR_W - 4, HEALTH_BAR_H - 4),
        k.color(...COLORS.danger),
        k.anchor('topleft'),
        k.z(101),
    ]);

    // Lives — top-right
    livesLabel = k.add([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`LIVES ${state.lives}`, { size: HUD_FONT_SIZE, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('topright'),
        k.z(100),
    ]);

    _updateHealthBar();
}

function _statusText() {
    // Mimics the CRT-style "S<score>T<level> - <health>" readout
    const s = String(state.score).padStart(2, '0');
    const t = String(state.level).padStart(2, '0');
    return `S${s}L${t} - ${state.health}`;
}

function _updateHealthBar() {
    const pct = state.maxHealth > 0 ? state.health / state.maxHealth : 0;
    healthBarFill.width = Math.max(0, (HEALTH_BAR_W - 4) * pct);
}

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', () => { statusLabel.text = _statusText(); }),
        events.on('levelChanged', () => { statusLabel.text = _statusText(); }),
        events.on('healthChanged', () => {
            statusLabel.text = _statusText();
            _updateHealthBar();
        }),
        events.on('livesChanged', (v) => {
            livesLabel.text = `LIVES ${v}`;
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

    // Dim overlay
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.6),
        k.z(200),
    ]);

    k.add([
        k.pos(CX, CY - 40),
        k.text('YOU HAVE FALLEN', { size: 48, font: 'monospace' }),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 30),
        k.text(`Final Score: ${state.score}  |  Reached Floor ${state.level}`, { size: 20, font: 'monospace' }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 80),
        k.text('Press R to restart  (ESC for menu)', { size: 14, font: 'monospace' }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(201),
    ]);
}
