/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { getShips } from './fleet.js';
import {
    playHit, playShipSunk,
    playLevelComplete, playPuzzleFailed, playGameOver,
} from './sounds.js';

let k;
let scoreLabel, livesLabel, shotsLabel, levelLabel;

// Tally panel — one entry per placed ship instance
// Each entry: { nameLabel, statusLabel, segmentObjs: [] }
let _tallyRows = [];

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _subscribeEvents();
}

/**
 * Show the level-complete tally overlay.
 * Awards shot-remaining bonus to score, displays breakdown, then calls onContinue.
 * @param {function} onContinue  called when player clicks "NEXT LEVEL" or presses any key
 */
export function showLevelTally(onContinue) {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Award shots-remaining bonus before rendering
    const shotsBonus = state.shotsLeft * 5;
    if (shotsBonus > 0) state.addScore(shotsBonus);

    // Dim overlay
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.72),
        k.z(200),
        'tallyOverlay',
    ]);

    // Panel background
    const PW = 520;
    const PH = 300;
    k.add([
        k.pos(CX - PW / 2, CY - PH / 2),
        k.rect(PW, PH, { radius: 10 }),
        k.color(10, 20, 50),
        k.outline(2, k.rgb(...COLORS.success)),
        k.z(201),
        'tallyOverlay',
    ]);

    k.add([
        k.pos(CX, CY - PH / 2 + 28),
        k.text('ARMADA ELIMINATED!', { size: 30 }),
        k.color(...COLORS.success),
        k.anchor('center'),
        k.z(202),
        'tallyOverlay',
    ]);

    // Score rows
    const rows = [
        { label: 'Missiles remaining bonus', value: `+${shotsBonus}` },
        { label: 'Total score',           value: `${state.score}` },
    ];
    rows.forEach(({ label, value }, i) => {
        const y = CY - 30 + i * 42;
        k.add([
            k.pos(CX - PW / 2 + 36, y),
            k.text(label, { size: 16 }),
            k.color(...COLORS.text),
            k.anchor('left'),
            k.z(202),
            'tallyOverlay',
        ]);
        k.add([
            k.pos(CX + PW / 2 - 36, y),
            k.text(value, { size: 16 }),
            k.color(...COLORS.gold),
            k.anchor('right'),
            k.z(202),
            'tallyOverlay',
        ]);
    });

    // NEXT LEVEL button
    const BTN_W = 260;
    const BTN_H = 44;
    const btnBg = k.add([
        k.pos(CX - BTN_W / 2, CY + PH / 2 - BTN_H - 24),
        k.rect(BTN_W, BTN_H, { radius: 6 }),
        k.color(20, 60, 120),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.opacity(1),
        k.z(202),
        k.area(),
        'tallyOverlay',
    ]);
    k.add([
        k.pos(CX, CY + PH / 2 - BTN_H / 2 - 24),
        k.text('NEXT LEVEL', { size: 18 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(203),
        'tallyOverlay',
    ]);

    btnBg.onHover(() => { btnBg.color = k.rgb(30, 90, 180); });
    btnBg.onHoverEnd(() => { btnBg.color = k.rgb(20, 60, 120); });

    let gone = false;
    function go() {
        if (gone) return;
        gone = true;
        k.destroyAll('tallyOverlay');
        document.removeEventListener('keydown', onKey);
        onContinue();
    }

    btnBg.onClick(go);

    function onKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        go();
    }
    document.addEventListener('keydown', onKey);
}

/** Call after initFleet() so getShips() returns the placed fleet. */
export function initTally() {
    _buildTallyPanel();
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

    // Missiles remaining — bottom-left
    shotsLabel = k.add([
        k.pos(12, GAME_HEIGHT - 10),
        k.text(`MISSILES  ${state.shotsLeft}`, { size: 16 }),
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
            shotsLabel.text  = `MISSILES  ${v}`;
            shotsLabel.color = v <= 5 ? k.rgb(...COLORS.danger) : k.rgb(...COLORS.accent);
        }),
        events.on('shipHit', (fleetIdx, _row, _col, _name) => {
            playHit();
            _updateTallyRow(fleetIdx, false);
        }),
        events.on('shipSunk', (fleetIdx, name) => {
            playShipSunk();
            _updateTallyRow(fleetIdx, true);
            _showBanner(`${name} DESTROYED!`, COLORS.shipSunk, 1.8);
        }),
        events.on('levelComplete', () => {
            playLevelComplete();
            _showBanner('FLEET ELIMINATED!', COLORS.success, 2.5);
        }),
        events.on('puzzleFailed', () => {
            playPuzzleFailed();
            _showBanner('MISSILES DEPLETED!', COLORS.danger, 2.0);
        }),
        events.on('gameOver', () => {
            playGameOver();
            _showGameOver();
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

// ----------------------------------------------------------------
// Ship tally panel (right side)
// ----------------------------------------------------------------

const TALLY_X      = 960;   // left edge of panel
const TALLY_Y_TOP  = 80;    // first row top
const TALLY_ROW_H  = 52;    // vertical spacing per ship

function _buildTallyPanel() {
    // Header
    k.add([
        k.pos(TALLY_X, TALLY_Y_TOP - 28),
        k.text('ENEMY ARMADA', { size: 13 }),
        k.color(100, 140, 200),
        k.anchor('topleft'),
        k.z(100),
    ]);

    // One row per placed ship instance — keyed by index to handle duplicate names
    const ships = getShips();
    _tallyRows = ships.map((ship, i) => {
        const y = TALLY_Y_TOP + i * TALLY_ROW_H;

        // Ship name
        const nameLabel = k.add([
            k.pos(TALLY_X, y),
            k.text(ship.name, { size: 14 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(100),
        ]);

        // Segment pip row (filled squares representing ship cells)
        const segmentObjs = [];
        const PIP = 14;
        const GAP = 3;
        for (let s = 0; s < ship.size; s++) {
            const pip = k.add([
                k.pos(TALLY_X + s * (PIP + GAP), y + 20),
                k.rect(PIP, PIP),
                k.color(60, 140, 220),
                k.opacity(1),
                k.z(100),
            ]);
            segmentObjs.push(pip);
        }

        // Status label
        const statusLabel = k.add([
            k.pos(TALLY_X + ship.size * (PIP + GAP) + 8, y + 20),
            k.text('CLOAKED', { size: 11 }),
            k.color(80, 100, 140),
            k.anchor('topleft'),
            k.z(100),
        ]);

        return { nameLabel, statusLabel, segmentObjs };
    });
}

function _updateTallyRow(fleetIdx, sunk = false) {
    const row  = _tallyRows[fleetIdx];
    const ship = getShips()[fleetIdx];
    if (!row || !ship) return;

    const status   = state.shipStatus[fleetIdx];
    const hitCount = status ? status.hits.size : 0;

    if (sunk) {
        row.segmentObjs.forEach(pip => { pip.color = k.rgb(...COLORS.shipSunk); });
        row.nameLabel.color   = k.rgb(...COLORS.shipSunk);
        row.statusLabel.text  = 'DESTROYED';
        row.statusLabel.color = k.rgb(...COLORS.shipSunk);
    } else {
        row.segmentObjs.forEach((pip, idx) => {
            pip.color = idx < hitCount ? k.rgb(...COLORS.shipHit) : k.rgb(60, 140, 220);
        });
        row.nameLabel.color   = k.rgb(...COLORS.shipHit);
        row.statusLabel.text  = `HIT  ${hitCount}/${ship.size}`;
        row.statusLabel.color = k.rgb(...COLORS.shipHit);
    }
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
    const ctrl = banner.onUpdate(() => {
        t += k.dt();
        if (t > duration - 0.4) {
            banner.opacity = Math.max(0, 1 - (t - (duration - 0.4)) / 0.4);
        }
        if (t >= duration) {
            ctrl.cancel();
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
