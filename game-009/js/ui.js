/**
 * ui.js — HUD, battle status panel, and overlay screens.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, BATTLE } from './config.js';

let k;

// Persistent HUD labels (top bar)
let _goldLabel, _scoreLabel;

// Battle status panel labels (bottom right, one row per party member)
let _statusRows = [];

// Message log (bottom of battle panel)
let _messageLabel;

export function initUI(kaplay) {
    k = kaplay;
    _buildTopBar();
    _buildStatusPanel();
    _subscribeEvents();
}

// -------------------------------------------------------
// Top bar
// -------------------------------------------------------

function _buildTopBar() {
    // Background strip
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, 36),
        k.color(...COLORS.panel),
        k.z(90),
    ]);

    _scoreLabel = k.add([
        k.pos(12, 6),
        k.text(`SCORE  ${state.score}`, { size: 14 }),
        k.color(...COLORS.accent),
        k.anchor('topleft'),
        k.z(91),
    ]);

    _goldLabel = k.add([
        k.pos(GAME_WIDTH - 12, 6),
        k.text(`GOLD  ${state.gold}`, { size: 14 }),
        k.color(...COLORS.accent),
        k.anchor('topright'),
        k.z(91),
    ]);
}

// -------------------------------------------------------
// Battle status panel (bottom-right)
// -------------------------------------------------------

function _buildStatusPanel() {
    const { STATUS_X, STATUS_Y, STATUS_W, STATUS_H } = BATTLE;

    // Background
    k.add([
        k.pos(STATUS_X, STATUS_Y),
        k.rect(STATUS_W, STATUS_H),
        k.color(...COLORS.panel),
        k.z(90),
    ]);
    // Border outline — use a very dark fill so opacity stays 1 but outline is visible
    k.add([
        k.pos(STATUS_X, STATUS_Y),
        k.rect(STATUS_W, STATUS_H),
        k.outline(2, k.rgb(...COLORS.panelBorder)),
        k.color(...COLORS.panel),
        k.z(91),
    ]);

    _statusRows = [];

    state.party.forEach((member, i) => {
        const rowY = STATUS_Y + 14 + i * 50;
        const colX = STATUS_X + 12;

        // Name + level
        const nameLabel = k.add([
            k.pos(colX, rowY),
            k.text(`${member.name} Lv${member.level}`, { size: 13 }),
            k.color(...member.color),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // HP bar background
        k.add([
            k.pos(colX + 120, rowY),
            k.rect(160, 10),
            k.color(40, 10, 10),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // HP bar fill
        const hpBar = k.add([
            k.pos(colX + 120, rowY),
            k.rect(160, 10),
            k.color(...COLORS.danger),
            k.anchor('topleft'),
            k.z(93),
        ]);

        // HP text
        const hpLabel = k.add([
            k.pos(colX + 120, rowY + 12),
            k.text(`HP ${member.hp}/${member.maxHp}`, { size: 11 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // MP bar background
        k.add([
            k.pos(colX + 300, rowY),
            k.rect(100, 10),
            k.color(10, 20, 50),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // MP bar fill
        const mpBar = k.add([
            k.pos(colX + 300, rowY),
            k.rect(100, 10),
            k.color(...COLORS.mana),
            k.anchor('topleft'),
            k.z(93),
        ]);

        // MP text
        const mpLabel = k.add([
            k.pos(colX + 300, rowY + 12),
            k.text(`MP ${member.mp}/${member.maxMp}`, { size: 11 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // Status icon (KO / Poison etc.)
        const statusLabel = k.add([
            k.pos(colX + 420, rowY),
            k.text('', { size: 11 }),
            k.color(...COLORS.danger),
            k.anchor('topleft'),
            k.z(92),
        ]);

        _statusRows.push({ nameLabel, hpBar, hpLabel, mpBar, mpLabel, statusLabel, member });
    });
}

// -------------------------------------------------------
// Public refresh (call after any HP/MP change)
// -------------------------------------------------------

export function refreshStatus() {
    for (const row of _statusRows) {
        const m = row.member;
        const hpFrac = Math.max(0, m.hp / m.maxHp);
        const mpFrac = Math.max(0, m.mp / m.maxMp);

        row.hpBar.width  = Math.round(160 * hpFrac);
        row.hpLabel.text = `HP ${Math.max(0, m.hp)}/${m.maxHp}`;
        row.mpBar.width  = Math.round(100 * mpFrac);
        row.mpLabel.text = `MP ${Math.max(0, m.mp)}/${m.maxMp}`;
        row.nameLabel.text = `${m.name} Lv${m.level}`;

        // HP bar color shifts green → yellow → red
        if (hpFrac > 0.5) {
            row.hpBar.color = k.rgb(...COLORS.success);
        } else if (hpFrac > 0.25) {
            row.hpBar.color = k.rgb(...COLORS.accent);
        } else {
            row.hpBar.color = k.rgb(...COLORS.danger);
        }

        // Status text
        if (m.isKO) {
            row.statusLabel.text = 'KO';
        } else if (m.statusEffects.find(s => s.type === 'poison')) {
            row.statusLabel.text = 'PSN';
        } else {
            row.statusLabel.text = '';
        }
    }
}

// -------------------------------------------------------
// Battle message log
// -------------------------------------------------------

export function initMessageLog() {
    const { PANEL_X, PANEL_Y, PANEL_W, PANEL_H } = BATTLE;
    const logY = PANEL_Y + PANEL_H - 28;

    _messageLabel = k.add([
        k.pos(PANEL_X + 10, logY),
        k.text('', { size: 13 }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(102),
    ]);
}

export function showMessage(text, color) {
    if (!_messageLabel) return;
    _messageLabel.text  = text;
    _messageLabel.color = color ? k.rgb(...color) : k.rgb(...COLORS.text);
}

// -------------------------------------------------------
// Overlays
// -------------------------------------------------------

export function showVictoryScreen(xpGained, goldGained) {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    // All tagged 'victoryOverlay' so battle.js can clean them up via k.destroyAll
    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0, 0, 0), k.opacity(0.65), k.z(200), 'victoryOverlay']);
    k.add([k.pos(CX, CY - 60), k.text('VICTORY!', { size: 52 }), k.color(...COLORS.accent), k.anchor('center'), k.z(201), 'victoryOverlay']);
    k.add([k.pos(CX, CY + 10), k.text(`XP: +${xpGained}   Gold: +${goldGained}`, { size: 22 }), k.color(...COLORS.text), k.anchor('center'), k.z(201), 'victoryOverlay']);
    k.add([k.pos(CX, CY + 60), k.text('Press SPACE or ENTER to continue', { size: 14 }), k.color(...COLORS.accent), k.anchor('center'), k.z(201), 'victoryOverlay']);
}

export function showGameOver() {
    const CX = GAME_WIDTH / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(0, 0, 0), k.opacity(0.65), k.z(200)]);
    k.add([k.pos(CX, CY - 40), k.text('GAME OVER', { size: 56 }), k.color(...COLORS.danger), k.anchor('center'), k.z(201)]);
    k.add([k.pos(CX, CY + 30), k.text(`Final Score: ${state.score}`, { size: 24 }), k.color(...COLORS.text), k.anchor('center'), k.z(201)]);
    k.add([k.pos(CX, CY + 80), k.text('Press R to restart  |  ESC for menu', { size: 14 }), k.color(...COLORS.accent), k.anchor('center'), k.z(201)]);
}

// -------------------------------------------------------
// Event subscriptions
// -------------------------------------------------------

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', (v) => { _scoreLabel.text = `SCORE  ${v}`; }),
        events.on('goldChanged',  (v) => { _goldLabel.text  = `GOLD  ${v}`; }),
        events.on('gameOver',     ()  => showGameOver()),
        events.on('showMessage',  (text, color) => showMessage(text, color)),
    ];
    k.onSceneLeave(() => offs.forEach(off => off()));
}
