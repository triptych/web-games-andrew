/**
 * ui.js — HUD and in-game UI.
 * Styled after 80's CRT dungeon-crawler status bars: a chunky monospace
 * readout in the top-left (SCORE / LEVEL / HEALTH), retro and blocky.
 * Call initUI(k) once per scene.
 *
 * HUD objects use k.fixed() so camera shake moves the dungeon, not the HUD.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, HUD_FONT_SIZE, FINAL_FLOOR } from './config.js';
import { playGameOver } from './sounds.js';
import { isTouchDevice } from './touch.js';

let k;
let statusLabel, healthBarFill, livesLabel, floorLabel, pausedLayer = null;

const HEALTH_BAR_W = 160;
const HEALTH_BAR_H = 14;

export function initUI(kaplay) {
    k = kaplay;
    pausedLayer = null;
    _buildHUD();
    _subscribeEvents();
}

/** Show or hide the PAUSED overlay to match state.isPaused. */
export function showPaused(on) {
    if (on && !pausedLayer) {
        pausedLayer = k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0, 0, 0), k.opacity(0.55), k.fixed(), k.z(300)]);
        pausedLayer.add([
            k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10),
            k.text('PAUSED', { size: 48, font: 'monospace' }),
            k.color(...COLORS.accent),
            k.anchor('center'),
        ]);
        pausedLayer.add([
            k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40),
            k.text(isTouchDevice() ? 'Tap the pause button to resume' : 'Press P to resume', { size: 16, font: 'monospace' }),
            k.color(...COLORS.text),
            k.anchor('center'),
        ]);
    } else if (!on && pausedLayer) {
        k.destroy(pausedLayer);
        pausedLayer = null;
    }
}

function _hud(comps) {
    return k.add([...comps, k.fixed(), k.z(100)]);
}

function _buildHUD() {
    // Retro status readout — top-left, mimics "S30T86 - 11" style CRT text.
    // Starts right of the "← Games" link.
    statusLabel = _hud([
        k.pos(96, 10),
        k.text(_statusText(), { size: HUD_FONT_SIZE, font: 'monospace' }),
        k.color(...COLORS.text),
    ]);

    _hud([
        k.pos(96, 40),
        k.rect(HEALTH_BAR_W, HEALTH_BAR_H),
        k.color(30, 10, 10),
        k.outline(2, k.rgb(...COLORS.wallDark)),
    ]);
    healthBarFill = k.add([
        k.pos(98, 42),
        k.rect(HEALTH_BAR_W - 4, HEALTH_BAR_H - 4),
        k.color(...COLORS.danger),
        k.fixed(),
        k.z(101),
    ]);

    // Floor and foes — top-centre
    floorLabel = _hud([
        k.pos(GAME_WIDTH / 2, 10),
        k.text(_floorText(), { size: HUD_FONT_SIZE, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('top'),
    ]);

    // Lives — top-right, left of the touch pause button
    livesLabel = _hud([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`LIVES ${state.lives}`, { size: HUD_FONT_SIZE, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('topright'),
    ]);

    _updateHealthBar();
}

function _statusText() {
    const s = String(state.score).padStart(2, '0');
    const t = String(state.level).padStart(2, '0');
    return `S${s}L${t} - ${state.health}`;
}

function _floorText() {
    const floor = `FLOOR ${state.level}/${FINAL_FLOOR}`;
    if (state.foesLeft > 0) return `${floor}   FOES ${state.foesLeft}`;
    return state.level >= FINAL_FLOOR ? `${floor}   CLAIM THE CROWN` : `${floor}   STAIRS OPEN`;
}

function _updateHealthBar() {
    const pct = state.maxHealth > 0 ? state.health / state.maxHealth : 0;
    healthBarFill.width = Math.max(0, (HEALTH_BAR_W - 4) * pct);
}

/** A big floor-title card that fades out. */
function _banner(text, sub, color) {
    const card = k.add([k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40), k.opacity(1), k.fixed(), k.z(150), 'banner', { t: 0 }]);
    const title = card.add([k.text(text, { size: 44, font: 'monospace' }), k.color(...color), k.anchor('center'), k.opacity(1)]);
    const subtitle = sub ? card.add([k.pos(0, 44), k.text(sub, { size: 16, font: 'monospace' }), k.color(...COLORS.text), k.anchor('center'), k.opacity(1)]) : null;
    card.onUpdate(() => {
        card.t += k.dt();
        const a = card.t < 1.2 ? 1 : Math.max(0, 1 - (card.t - 1.2) / 0.6);
        title.opacity = a;
        if (subtitle) subtitle.opacity = a;
        if (a <= 0) k.destroy(card);
    });
}

function _subscribeEvents() {
    const refreshStatus = () => { statusLabel.text = _statusText(); };
    const refreshFloor = () => { floorLabel.text = _floorText(); };
    const offs = [
        events.on('scoreChanged', refreshStatus),
        events.on('levelChanged', () => { refreshStatus(); refreshFloor(); }),
        events.on('healthChanged', () => { refreshStatus(); _updateHealthBar(); }),
        events.on('livesChanged', (v) => { livesLabel.text = `LIVES ${v}`; }),
        events.on('foesChanged', refreshFloor),
        events.on('floorEntered', (floor) => {
            refreshFloor();
            const final = floor >= FINAL_FLOOR;
            _banner(`FLOOR ${floor}`, final ? 'The Hollow Crown lies here' : floor === 1 ? 'Slay every foe to open the stairs' : null, final ? COLORS.gold : COLORS.accent);
        }),
        events.on('stairsOpened', (final) => {
            refreshFloor();
            _banner(final ? 'THE CROWN AWAKENS' : 'THE STAIRS ARE OPEN', null, COLORS.stairsOpen);
        }),
        events.on('potionDrunk', (n) => _banner(`+${n} HP`, null, COLORS.potion)),
        events.on('gameOver', () => {
            playGameOver();
            _showEnd(false);
        }),
        events.on('gameWon', () => _showEnd(true)),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

function _showEnd(won) {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;
    const best = state.best;
    k.destroyAll('banner');

    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0, 0, 0), k.opacity(won ? 0.7 : 0.6), k.fixed(), k.z(200)]);

    k.add([
        k.pos(CX, CY - 70),
        k.text(won ? 'THE HOLLOW CROWN IS YOURS' : 'YOU HAVE FALLEN', { size: won ? 40 : 48, font: 'monospace' }),
        k.color(...(won ? COLORS.gold : COLORS.danger)),
        k.anchor('center'),
        k.fixed(),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY),
        k.text(won ? `You cleared all ${FINAL_FLOOR} floors of Ironhollow.  Score: ${state.score}`
                   : `Final Score: ${state.score}  |  Reached Floor ${state.level}`, { size: 20, font: 'monospace' }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.fixed(),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 36),
        k.text(`Best: floor ${best.floor}, ${best.score} points${best.won ? ', crown claimed' : ''}`, { size: 14, font: 'monospace' }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.fixed(),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 80),
        k.text(isTouchDevice() ? 'Tap to play again' : 'Press R or click to play again  (ESC for menu)', { size: 14, font: 'monospace' }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.fixed(),
        k.z(201),
    ]);
}
