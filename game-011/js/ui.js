/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

let k;
let scoreLabel, livesLabel, shotsLabel, levelLabel;

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

    // Lives — top-right
    livesLabel = k.add([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`LIVES  ${state.lives}`, { size: 16 }),
        k.color(...COLORS.danger),
        k.anchor('topright'),
        k.z(100),
    ]);

    // Shots remaining — bottom-left
    shotsLabel = k.add([
        k.pos(12, GAME_HEIGHT - 10),
        k.text(`SHOTS  ${state.shotsLeft}`, { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('botleft'),
        k.z(100),
    ]);

    // Level — bottom-right
    levelLabel = k.add([
        k.pos(GAME_WIDTH - 12, GAME_HEIGHT - 10),
        k.text(`LEVEL  ${state.level}`, { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('botright'),
        k.z(100),
    ]);
}

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', (v) => {
            scoreLabel.text = `SCORE  ${v}`;
        }),
        events.on('livesChanged', (v) => {
            livesLabel.text = `LIVES  ${v}`;
        }),
        events.on('shotsChanged', (v) => {
            shotsLabel.text = `SHOTS  ${v}`;
        }),
        events.on('shipSunk', (name) => {
            _showBanner(`${name} DESTROYED!`, COLORS.shipSunk, 1.8);
        }),
        events.on('levelComplete', () => {
            _showBanner('FLEET ELIMINATED!', COLORS.success, 2.5);
        }),
        events.on('puzzleFailed', () => {
            _showBanner('OUT OF SHOTS!', COLORS.danger, 2.0);
        }),
        events.on('gameOver', () => {
            _showGameOver();
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

/**
 * Temporary floating banner (auto-destructs after `duration` seconds).
 */
function _showBanner(msg, color, duration = 2.0) {
    const CX = GAME_WIDTH / 2;
    const banner = k.add([
        k.pos(CX, 60),
        k.text(msg, { size: 28 }),
        k.color(...color),
        k.anchor('center'),
        k.opacity(1),
        k.z(150),
    ]);

    let t = 0;
    const off = banner.onUpdate(() => {
        t += k.dt();
        if (t > duration - 0.4) {
            banner.opacity = Math.max(0, 1 - (t - (duration - 0.4)) / 0.4);
        }
        if (t >= duration) {
            off();
            k.destroy(banner);
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
        k.opacity(0.65),
        k.z(200),
    ]);

    k.add([
        k.pos(CX, CY - 60),
        k.text('MISSION FAILED', { size: 56 }),
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
        k.text('Press R to retry  |  ESC for menu', { size: 14 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(201),
    ]);
}
