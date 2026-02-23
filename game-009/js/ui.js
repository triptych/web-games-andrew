/**
 * ui.js — HUD, battle status panel, and overlay screens.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, BATTLE } from './config.js';
import { playLevelUp } from './sounds.js';

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

        // HP bar fill — color based on initial HP fraction
        const _initHpFrac = member.hp / member.maxHp;
        const _initHpColor = _initHpFrac > 0.5 ? COLORS.success : _initHpFrac > 0.25 ? COLORS.accent : COLORS.danger;
        const hpBar = k.add([
            k.pos(colX + 120, rowY),
            k.rect(Math.round(160 * _initHpFrac), 10),
            k.color(..._initHpColor),
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

        // XP bar background
        k.add([
            k.pos(colX + 120, rowY + 26),
            k.rect(290, 7),
            k.color(30, 15, 50),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // XP bar fill
        const xpBar = k.add([
            k.pos(colX + 120, rowY + 26),
            k.rect(Math.round(290 * (member.xp / member.xpToNext)), 7),
            k.color(...COLORS.xp),
            k.anchor('topleft'),
            k.z(93),
        ]);

        // XP text
        const xpLabel = k.add([
            k.pos(colX + 120, rowY + 35),
            k.text(`XP ${member.xp}/${member.xpToNext}`, { size: 10 }),
            k.color(...COLORS.xp),
            k.anchor('topleft'),
            k.z(92),
        ]);

        // Status / buff icon area
        const statusLabel = k.add([
            k.pos(colX + 420, rowY),
            k.text('', { size: 11 }),
            k.color(...COLORS.danger),
            k.anchor('topleft'),
            k.z(92),
        ]);
        const buffLabel = k.add([
            k.pos(colX + 500, rowY),
            k.text('', { size: 11 }),
            k.color(...COLORS.success),
            k.anchor('topleft'),
            k.z(92),
        ]);

        _statusRows.push({ nameLabel, hpBar, hpLabel, mpBar, mpLabel, xpBar, xpLabel, statusLabel, buffLabel, member });
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

        const xpFrac = m.xpToNext > 0 ? Math.min(1, m.xp / m.xpToNext) : 1;
        row.xpBar.width  = Math.round(290 * xpFrac);
        row.xpLabel.text = `XP ${m.xp}/${m.xpToNext}`;

        // HP bar color shifts green → yellow → red
        if (hpFrac > 0.5) {
            row.hpBar.color = k.rgb(...COLORS.success);
        } else if (hpFrac > 0.25) {
            row.hpBar.color = k.rgb(...COLORS.accent);
        } else {
            row.hpBar.color = k.rgb(...COLORS.danger);
        }

        // Status text (debuffs / KO)
        if (m.isKO) {
            row.statusLabel.text  = 'KO';
            row.statusLabel.color = k.rgb(...COLORS.danger);
        } else if (m.statusEffects.find(s => s.type === 'poison')) {
            row.statusLabel.text  = 'PSN';
            row.statusLabel.color = k.rgb(160, 60, 200);
        } else {
            row.statusLabel.text = '';
        }

        // Buff text (active buffs)
        const buffs = m.buffs ?? {};
        const buffParts = [];
        if (buffs.atkUp)  buffParts.push('ATK+');
        if (buffs.defUp)  buffParts.push('DEF+');
        if (buffs.accDown) buffParts.push('ACC-');
        row.buffLabel.text = buffParts.join(' ');
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
// Level-up overlay
// -------------------------------------------------------

// Queue of pending level-up cards to show sequentially
let _levelUpQueue = [];
let _levelUpShowing = false;

export function showLevelUpCard(member, newLevel, gains) {
    _levelUpQueue.push({ member, newLevel, gains });
    if (!_levelUpShowing) _showNextLevelUp();
}

function _showNextLevelUp() {
    if (_levelUpQueue.length === 0) { _levelUpShowing = false; return; }
    _levelUpShowing = true;

    const { member, newLevel, gains } = _levelUpQueue.shift();
    playLevelUp();

    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;
    const W  = 380;
    const H  = 220;

    const tag = 'levelUpOverlay';

    // Dark-tinted card
    k.add([k.pos(CX - W / 2, CY - H / 2), k.rect(W, H), k.color(...COLORS.panel), k.opacity(0.95), k.anchor('topleft'), k.z(210), tag]);
    k.add([k.pos(CX - W / 2, CY - H / 2), k.rect(W, H), k.outline(2, k.rgb(...COLORS.xp)), k.color(...COLORS.panel), k.anchor('topleft'), k.z(211), tag]);

    // Header
    k.add([k.pos(CX, CY - H / 2 + 18), k.text('LEVEL UP!', { size: 22 }), k.color(...COLORS.xp), k.anchor('top'), k.z(212), tag]);
    k.add([k.pos(CX, CY - H / 2 + 48), k.text(`${member.name}  Lv ${newLevel - 1} -> Lv ${newLevel}`, { size: 15 }), k.color(...member.color), k.anchor('top'), k.z(212), tag]);

    // Stat gains
    const statNames = { hp: 'HP', mp: 'MP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD' };
    const gainLines = Object.entries(gains)
        .filter(([, v]) => v > 0)
        .map(([stat, v]) => `${statNames[stat] ?? stat}  +${v}`)
        .join('   ');

    k.add([k.pos(CX, CY - H / 2 + 76), k.text(gainLines, { size: 13 }), k.color(...COLORS.success), k.anchor('top'), k.z(212), tag]);

    // Prompt
    k.add([k.pos(CX, CY + H / 2 - 16), k.text('Press SPACE or ENTER', { size: 11 }), k.color(...COLORS.accent), k.anchor('bot'), k.z(212), tag]);

    // Dismiss on space or enter — one-shot handlers
    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        h1.cancel(); h2.cancel();
        k.destroyAll(tag);
        refreshStatus();     // update level shown in status panel
        k.wait(0.1, _showNextLevelUp);
    };
    const h1 = k.onKeyPress('space', dismiss);
    const h2 = k.onKeyPress('enter', dismiss);

    // Also auto-dismiss after 4 s so the game never gets stuck
    k.wait(4, () => { if (!dismissed) dismiss(); });
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
        events.on('levelUp',      (member, newLevel, gains) => showLevelUpCard(member, newLevel, gains)),
    ];
    k.onSceneLeave(() => offs.forEach(off => off()));
}
