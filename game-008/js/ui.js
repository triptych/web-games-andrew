/**
 * ui.js — HUD rendering.
 *
 * Layout: The 960×720 grid sits centered in 1280×720, leaving 160px side margins.
 *
 *   Left margin (x 0–159):
 *     Lives display (❤ hearts)
 *     Wave label + number
 *     Smart Bomb count
 *
 *   Right margin (x 1120–1279):
 *     Score display
 *     Gold display
 *
 * All HUD objects are tagged 'hud' so they can be destroyed on scene leave.
 */

import {
    GAME_WIDTH, GAME_HEIGHT,
    GRID_OFFSET_X,           // 160
    COLORS,
    WAVE_DEFS,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';

const HUD_TAG = 'hud';

// Column centres for left / right margin panels
const LEFT_CX  = GRID_OFFSET_X / 2;          // 80
const RIGHT_CX = GAME_WIDTH - GRID_OFFSET_X / 2; // 1200

// We keep references to text objects so we can update them.
let _k;
let _livesText, _waveText, _waveTitle, _scoreText, _goldText, _bombText;
let _lastLives = -1, _lastScore = -1, _lastGold = -1, _lastWave = -1, _lastBombs = -1;

// ============================================================
// Public init
// ============================================================

/**
 * Set up HUD entities and event subscriptions.
 * @param {object} k  Kaplay context
 */
export function initUI(k) {
    _k = k;
    _createHUD(k);
    _listenEvents();
    _startUpdateLoop(k);
}

// ============================================================
// HUD creation
// ============================================================

function _createHUD(k) {
    // --- Left margin panel background ---
    k.add([
        k.pos(0, 0),
        k.rect(GRID_OFFSET_X, GAME_HEIGHT),
        k.color(...COLORS.hudBg),
        k.z(50),
        HUD_TAG,
    ]);

    // --- Right margin panel background ---
    k.add([
        k.pos(GAME_WIDTH - GRID_OFFSET_X, 0),
        k.rect(GRID_OFFSET_X, GAME_HEIGHT),
        k.color(...COLORS.hudBg),
        k.z(50),
        HUD_TAG,
    ]);

    // Subtle separator lines
    k.add([
        k.pos(GRID_OFFSET_X - 1, 0),
        k.rect(1, GAME_HEIGHT),
        k.color(40, 40, 70),
        k.z(51),
        HUD_TAG,
    ]);
    k.add([
        k.pos(GAME_WIDTH - GRID_OFFSET_X, 0),
        k.rect(1, GAME_HEIGHT),
        k.color(40, 40, 70),
        k.z(51),
        HUD_TAG,
    ]);

    // ---- LEFT: LIVES ----
    k.add([
        k.pos(LEFT_CX, 30),
        k.text('LIVES', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _livesText = k.add([
        k.pos(LEFT_CX, 52),
        k.text(_livesString(state.lives), { size: 14 }),
        k.color(...COLORS.livesColor),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _lastLives = state.lives;

    // ---- LEFT: WAVE ----
    k.add([
        k.pos(LEFT_CX, 105),
        k.text('WAVE', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _waveText = k.add([
        k.pos(LEFT_CX, 127),
        k.text(_waveString(state.wave), { size: 22 }),
        k.color(...COLORS.waveColor),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _waveTitle = k.add([
        k.pos(LEFT_CX, 150),
        k.text('', { size: 9 }),
        k.color(150, 150, 190),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _lastWave = state.wave;

    // ---- LEFT: SMART BOMBS ----
    k.add([
        k.pos(LEFT_CX, 210),
        k.text('BOMBS', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _bombText = k.add([
        k.pos(LEFT_CX, 232),
        k.text(_bombString(state.smartBombs), { size: 14 }),
        k.color(100, 200, 255),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _lastBombs = state.smartBombs;

    // ---- LEFT: Controls hint ----
    // Kaplay treats [...] as style tags — use parentheses instead
    _addLeftHint(k, 'WASD/Arrows', 'Move', 580);
    _addLeftHint(k, 'Auto-fire', 'Shoot', 605);
    _addLeftHint(k, '(Space)', 'Smart Bomb', 630);
    _addLeftHint(k, '(R)', 'Restart', 660);
    _addLeftHint(k, '(P)', 'Pause', 685);

    // ---- RIGHT: SCORE ----
    k.add([
        k.pos(RIGHT_CX, 30),
        k.text('SCORE', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _scoreText = k.add([
        k.pos(RIGHT_CX, 55),
        k.text(String(state.score), { size: 18 }),
        k.color(...COLORS.scoreColor),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _lastScore = state.score;

    // ---- RIGHT: GOLD ----
    k.add([
        k.pos(RIGHT_CX, 105),
        k.text('GOLD', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _goldText = k.add([
        k.pos(RIGHT_CX, 130),
        k.text(_goldString(state.gold), { size: 16 }),
        k.color(...COLORS.goldColor),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    _lastGold = state.gold;

    // ---- RIGHT: Tower shop hint ----
    k.add([
        k.pos(RIGHT_CX, 200),
        k.text('TOWERS', { size: 11 }),
        k.color(...COLORS.hudText),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
    k.add([
        k.pos(RIGHT_CX, 218),
        k.text('Click to buy', { size: 9 }),
        k.color(80, 80, 120),
        k.anchor('center'),
        k.z(52),
        HUD_TAG,
    ]);
}

function _addLeftHint(k, key, label, y) {
    k.add([
        k.pos(8, y),
        k.text(key, { size: 9 }),
        k.color(100, 100, 150),
        k.anchor('left'),
        k.z(52),
        HUD_TAG,
    ]);
    k.add([
        k.pos(GRID_OFFSET_X - 8, y),
        k.text(label, { size: 9 }),
        k.color(80, 80, 120),
        k.anchor('right'),
        k.z(52),
        HUD_TAG,
    ]);
}

// ============================================================
// Update loop — sync text objects with state
// ============================================================

function _startUpdateLoop(k) {
    k.onUpdate(() => {
        if (state.lives !== _lastLives) {
            _lastLives = state.lives;
            if (_livesText && _livesText.exists()) {
                _livesText.text = _livesString(state.lives);
            }
        }

        if (state.wave !== _lastWave) {
            _lastWave = state.wave;
            if (_waveText  && _waveText.exists())  _waveText.text  = _waveString(state.wave);
            if (_waveTitle && _waveTitle.exists()) _waveTitle.text = _waveTitleString(state.wave);
        }

        if (state.score !== _lastScore) {
            _lastScore = state.score;
            if (_scoreText && _scoreText.exists()) _scoreText.text = String(state.score);
        }

        if (state.gold !== _lastGold) {
            _lastGold = state.gold;
            if (_goldText && _goldText.exists()) _goldText.text = _goldString(state.gold);
        }

        if (state.smartBombs !== _lastBombs) {
            _lastBombs = state.smartBombs;
            if (_bombText && _bombText.exists()) _bombText.text = _bombString(state.smartBombs);
        }
    });
}

// ============================================================
// Event listeners
// ============================================================

function _listenEvents() {
    events.on('gameOver', () => _showOverlay('GAME OVER', [255, 60, 60]));
    events.on('gameWon',  () => _showOverlay('YOU WIN!',  [60, 255, 120]));

    events.on('waveStarted', (waveNum) => {
        _showWaveBanner(waveNum);
    });

    events.on('waveComplete', (waveNum, goldEarned) => {
        _showGoldPopup(goldEarned);
    });
}

// ============================================================
// Overlays & banners
// ============================================================

function _showOverlay(title, titleColor) {
    const k = _k;
    // Dim background
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.65),
        k.z(100),
        'overlay',
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50),
        k.text(title, { size: 72 }),
        k.color(...titleColor),
        k.anchor('center'),
        k.z(101),
        'overlay',
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20),
        k.text(`Score: ${state.score}   Wave: ${state.wave}`, { size: 22 }),
        k.color(220, 220, 240),
        k.anchor('center'),
        k.z(101),
        'overlay',
    ]);
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60),
        k.text('Press (R) to restart', { size: 16 }),
        k.color(150, 150, 180),
        k.anchor('center'),
        k.z(101),
        'overlay',
    ]);
}

export function showWaveBanner(waveNum) {
    _showWaveBanner(waveNum);
}

// ============================================================
// 3-2-1 countdown (shown at wave start while game is paused)
// ============================================================

/**
 * Display a 3 → 2 → 1 countdown in the centre of the screen.
 * Each digit is shown for 1 second then fades out.
 * Calls onTick(n) each time a digit appears (for sound), and onDone() when finished.
 * @param {object}   k
 * @param {function} onTick   called with n=3,2,1 then n=0 on "GO"
 * @param {function} onDone   called after the final fade
 */
export function showCountdown(k, onTick, onDone) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const STEPS = [3, 2, 1, 0]; // 0 = "GO"

    let stepIdx = 0;

    function showStep() {
        if (stepIdx >= STEPS.length) { onDone(); return; }

        const n     = STEPS[stepIdx++];
        const label = n > 0 ? String(n) : 'GO';
        const color = n > 0 ? [255, 220, 60] : [60, 255, 120];

        onTick(n);

        const ent = k.add([
            k.pos(cx, cy),
            k.text(label, { size: 96 }),
            k.color(...color),
            k.anchor('center'),
            k.opacity(1),
            k.z(95),
            'countdown',
        ]);

        // Hold 0.55s then fade out over 0.3s, then show next digit
        const HOLD     = n > 0 ? 0.55 : 0.45;
        const FADE_OUT = 0.3;
        let timer = 0;

        ent.onUpdate(() => {
            if (!ent.exists()) return;
            timer += k.dt();
            if (timer < HOLD) {
                // slight scale-down pulse: start big, settle to 1
                const scale = 1 + Math.max(0, 0.25 - timer * 0.6);
                ent.pos = k.vec2(cx, cy - scale * 20 + 20); // subtle drop
                ent.opacity = 1;
            } else if (timer < HOLD + FADE_OUT) {
                ent.opacity = 1 - (timer - HOLD) / FADE_OUT;
            } else {
                ent.destroy();
                showStep();
            }
        });
    }

    showStep();
}

function _showWaveBanner(waveNum) {
    const k = _k;
    const def = WAVE_DEFS[waveNum - 1];
    if (!def) return;

    const title    = def.title || `Wave ${waveNum}`;
    const isBoss   = def.isBoss;
    const bgColor  = isBoss ? [100, 20, 120] : [20, 40, 80];
    const txtColor = isBoss ? [255, 180, 0]  : [180, 220, 255];

    const banner = k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2),
        k.rect(500, 64, { radius: 8 }),
        k.color(...bgColor),
        k.outline(2, k.rgb(isBoss ? 200 : 60, isBoss ? 60 : 100, isBoss ? 220 : 180)),
        k.anchor('center'),
        k.opacity(0),
        k.z(90),
        'waveBanner',
    ]);

    const label = k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2),
        k.text(title, { size: isBoss ? 28 : 24 }),
        k.color(...txtColor),
        k.anchor('center'),
        k.opacity(0),
        k.z(91),
        'waveBanner',
    ]);

    // Timer-based fade: in 0.3s → hold 2s → out 0.4s
    const FADE_IN  = 0.3;
    const HOLD     = 2.0;
    const FADE_OUT = 0.4;
    const TOTAL    = FADE_IN + HOLD + FADE_OUT;
    let timer = 0;

    banner.onUpdate(() => {
        timer += k.dt();
        let opacity;
        if (timer < FADE_IN) {
            opacity = timer / FADE_IN;
        } else if (timer < FADE_IN + HOLD) {
            opacity = 1;
        } else if (timer < TOTAL) {
            opacity = 1 - (timer - FADE_IN - HOLD) / FADE_OUT;
        } else {
            k.destroyAll('waveBanner');
            return;
        }
        if (banner.exists()) banner.opacity = opacity;
        if (label.exists())  label.opacity  = opacity;
    });
}

// ============================================================
// Gold earned popup (shown on wave complete)
// ============================================================

function _showGoldPopup(goldEarned) {
    if (!_k) return;
    const k = _k;

    const popup = k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50),
        k.text(`+${goldEarned}g`, { size: 22 }),
        k.color(...COLORS.goldColor),
        k.anchor('center'),
        k.opacity(0),
        k.z(92),
        'goldPopup',
    ]);

    const FADE_IN  = 0.2;
    const HOLD     = 1.2;
    const FADE_OUT = 0.5;
    const TOTAL    = FADE_IN + HOLD + FADE_OUT;
    let timer = 0;

    popup.onUpdate(() => {
        timer += k.dt();
        // Float upward
        if (popup.exists()) popup.pos = k.vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50 - timer * 40);

        let opacity;
        if (timer < FADE_IN) {
            opacity = timer / FADE_IN;
        } else if (timer < FADE_IN + HOLD) {
            opacity = 1;
        } else if (timer < TOTAL) {
            opacity = 1 - (timer - FADE_IN - HOLD) / FADE_OUT;
        } else {
            if (popup.exists()) popup.destroy();
            return;
        }
        if (popup.exists()) popup.opacity = opacity;
    });
}

// ============================================================
// String helpers
// ============================================================

function _livesString(lives) {
    // \u2665 = ♥  (confirmed working in Kaplay)
    return '\u2665 '.repeat(Math.max(0, lives)).trim() || '---';
}

function _waveString(wave) {
    return `${wave} / ${WAVE_DEFS.length}`;
}

function _waveTitleString(wave) {
    const def = WAVE_DEFS[wave - 1];
    return def ? def.title : '';
}

function _goldString(gold) {
    return `$ ${gold}`;
}

function _bombString(bombs) {
    // \u25CF = ● (filled circle, used as bomb icon)
    return '\u25CF '.repeat(Math.max(0, bombs)).trim() || '---';
}
