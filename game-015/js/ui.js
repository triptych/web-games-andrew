/**
 * ui.js — All HUD, stat bars, action buttons, and overlays for Tamagoji.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    STAT_BAR_START_Y, ACTION_BAR_Y, ACTION_BTN_SIZE,
    FOOD_TYPES, INTERACTION_TYPES, PET_SPECIES,
} from './config.js';

let k;

// Persistent label/entity references for live updates
let _goldLabel;
let _moodLabel;
let _stageLabel;
let _statBars = {};    // { hunger, happy, energy, health } → { bg, fill, label }
let _petLabel;
let _reactionLabel;
let _actionButtons = [];
let _menuOverlay   = null;

const STAT_DEFS = [
    { key: 'hunger', emoji: '🍔', colorKey: 'hunger' },
    { key: 'happy',  emoji: '😊', colorKey: 'happy'  },
    { key: 'energy', emoji: '⚡', colorKey: 'energy' },
    { key: 'health', emoji: '❤️', colorKey: 'health' },
];

const BAR_W      = GAME_WIDTH - 80;
const BAR_H      = 16;
const BAR_LEFT_X = 40;
const BAR_SPACING = 36;

export function initUI(kaplay) {
    k = kaplay;
    _buildBackground();
    _buildPetDisplay();
    _buildStatBars();
    _buildActionBar();
    _buildTopHUD();
    _subscribeEvents();
}

// ---- Background ----

function _buildBackground() {
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Top gradient band
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, 80),
        k.color(...COLORS.bgCard),
        k.z(1),
    ]);

    // Bottom card
    k.add([
        k.pos(0, 410),
        k.rect(GAME_WIDTH, GAME_HEIGHT - 410),
        k.color(...COLORS.bgCard),
        k.z(1),
    ]);

    // Separator line
    k.add([
        k.pos(0, 410),
        k.rect(GAME_WIDTH, 2),
        k.color(...COLORS.accent),
        k.z(2),
    ]);
}

// ---- Top HUD ----

function _buildTopHUD() {
    // Title
    k.add([
        k.pos(GAME_WIDTH / 2, 22),
        k.text('TAMAGOJI', { size: 22 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(10),
    ]);

    // Gold
    _goldLabel = k.add([
        k.pos(GAME_WIDTH - 16, 16),
        k.text(`🪙 ${state.gold}`, { size: 14 }),
        k.color(...COLORS.gold),
        k.anchor('topright'),
        k.z(10),
    ]);

    // Stage label
    _stageLabel = k.add([
        k.pos(16, 16),
        k.text(_stageText(), { size: 12 }),
        k.color(...COLORS.textDim),
        k.anchor('topleft'),
        k.z(10),
    ]);

    // Mood label
    _moodLabel = k.add([
        k.pos(GAME_WIDTH / 2, 52),
        k.text(_moodText(), { size: 14 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(10),
    ]);
}

function _stageText() {
    const s = state.stage;
    const map = { none: '', egg: 'EGG', baby: 'BABY', child: 'CHILD', teen: 'TEEN', adult: 'ADULT' };
    return `${state.petName}  ·  ${map[s] || s.toUpperCase()}`;
}

function _moodText() {
    const moodMap = {
        happy:   '😄 Happy!',
        content: '😊 Content',
        sad:     '😢 Sad...',
        hungry:  '😩 Hungry!',
        tired:   '😴 Tired...',
        sick:    '🤒 Sick!',
    };
    return moodMap[state.mood] || '😊 Content';
}

// ---- Pet display ----

function _buildPetDisplay() {
    // Pet area background circle
    k.add([
        k.pos(GAME_WIDTH / 2, 240),
        k.circle(130),
        k.color(...COLORS.bgCard),
        k.anchor('center'),
        k.z(2),
    ]);

    // Pet emoji label (very large)
    _petLabel = k.add([
        k.pos(GAME_WIDTH / 2, 240),
        k.text(state.petEmoji, { size: 96 }),
        k.anchor('center'),
        k.z(5),
    ]);

    // Reaction floating emoji
    _reactionLabel = k.add([
        k.pos(GAME_WIDTH / 2 + 80, 185),
        k.text('', { size: 36 }),
        k.anchor('center'),
        k.opacity(1),
        k.z(6),
    ]);

    // Idle bounce animation
    let t = 0;
    _petLabel.onUpdate(() => {
        t += k.dt();
        _petLabel.pos = k.vec2(GAME_WIDTH / 2, 240 + Math.sin(t * 2) * 6);
        _petLabel.text = state.petEmoji;

        // Reaction bubble
        if (state.reactionEmoji) {
            _reactionLabel.text    = state.reactionEmoji;
            _reactionLabel.opacity = Math.min(1, state.reactionTimer);
        } else {
            _reactionLabel.text    = '';
            _reactionLabel.opacity = 0;
        }
    });
}

// ---- Stat bars ----

function _buildStatBars() {
    const stats = state.getStats();

    STAT_DEFS.forEach((def, i) => {
        const y = STAT_BAR_START_Y + i * BAR_SPACING;
        const barColor = COLORS.bar[def.colorKey];

        // Emoji icon
        k.add([
            k.pos(BAR_LEFT_X - 24, y + BAR_H / 2),
            k.text(def.emoji, { size: 16 }),
            k.anchor('left'),
            k.z(10),
        ]);

        // Bar background
        const bg = k.add([
            k.pos(BAR_LEFT_X, y),
            k.rect(BAR_W, BAR_H),
            k.color(40, 35, 60),
            k.anchor('topleft'),
            k.z(10),
        ]);

        // Bar fill
        const fill = k.add([
            k.pos(BAR_LEFT_X, y),
            k.rect(BAR_W * (stats[def.key] / 100), BAR_H),
            k.color(...barColor),
            k.anchor('topleft'),
            k.z(11),
        ]);

        // Value label
        const label = k.add([
            k.pos(BAR_LEFT_X + BAR_W + 6, y + BAR_H / 2),
            k.text(`${Math.round(stats[def.key])}`, { size: 11 }),
            k.color(...COLORS.textDim),
            k.anchor('left'),
            k.z(12),
        ]);

        _statBars[def.key] = { bg, fill, label, barColor };
    });
}

function _refreshStatBars() {
    const stats = state.getStats();
    STAT_DEFS.forEach(def => {
        const bar = _statBars[def.key];
        if (!bar) return;
        const pct = Math.max(0, Math.min(1, stats[def.key] / 100));
        bar.fill.pos = k.vec2(BAR_LEFT_X, bar.fill.pos.y);
        // Rebuild width by destroying and recreating is complex — use scale instead
        bar.fill.width = Math.max(2, BAR_W * pct);
        bar.label.text = `${Math.round(stats[def.key])}`;

        // Color shift when low
        if (pct < 0.25) {
            bar.fill.color = k.rgb(...COLORS.danger);
        } else if (pct < 0.5) {
            bar.fill.color = k.rgb(...COLORS.warning);
        } else {
            bar.fill.color = k.rgb(...bar.barColor);
        }
    });
}

// ---- Action bar ----

const ACTION_DEFS = [
    { id: 'feed',     emoji: '🍔', label: 'Feed'   },
    { id: 'interact', emoji: '🎮', label: 'Play'   },
    { id: 'eggs',     emoji: '🥚', label: 'Eggs'   },
    { id: 'shop',     emoji: '🛒', label: 'Shop'   },
    { id: 'config',   emoji: '⚙️', label: 'Config' },
];

function _buildActionBar() {
    const count  = ACTION_DEFS.length;
    const totalW = count * (ACTION_BTN_SIZE + 12) - 12;
    const startX = (GAME_WIDTH - totalW) / 2;

    ACTION_DEFS.forEach((def, i) => {
        const cx = startX + i * (ACTION_BTN_SIZE + 12) + ACTION_BTN_SIZE / 2;
        const cy = ACTION_BAR_Y;

        // Button bg
        const btn = k.add([
            k.pos(cx, cy),
            k.circle(ACTION_BTN_SIZE / 2),
            k.color(...COLORS.bgCard),
            k.anchor('center'),
            k.outline(2, k.rgb(...COLORS.accent)),
            k.z(20),
            k.area(),
            'action-btn',
        ]);

        // Button emoji
        const icon = k.add([
            k.pos(cx, cy - 8),
            k.text(def.emoji, { size: 28 }),
            k.anchor('center'),
            k.z(21),
        ]);

        // Button label
        k.add([
            k.pos(cx, cy + 22),
            k.text(def.label, { size: 10 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(21),
        ]);

        btn.onClick(() => {
            _onActionButton(def.id);
        });

        _actionButtons.push({ btn, icon, def });
    });
}

function _onActionButton(id) {
    if (state.uiMode === id) {
        state.uiMode = 'main';
    } else {
        state.uiMode = id;
    }
}

// ---- Menu overlay (feed / interact / eggs / shop) ----

function _clearMenuOverlay() {
    if (_menuOverlay) {
        k.destroyAll('menu-overlay');
        _menuOverlay = null;
    }
}

function _showFeedMenu() {
    _clearMenuOverlay();
    _menuOverlay = true;

    const menuY = 540;
    const items = FOOD_TYPES;
    const cols  = 4;
    const cellW = GAME_WIDTH / cols;

    items.forEach((food, i) => {
        const col = i % cols;
        const cx  = cellW * col + cellW / 2;
        const cy  = menuY;

        const btn = k.add([
            k.pos(cx, cy),
            k.circle(28),
            k.color(...COLORS.bg),
            k.anchor('center'),
            k.outline(2, k.rgb(...COLORS.accentAlt)),
            k.area(),
            k.z(30),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy),
            k.text(food.emoji, { size: 24 }),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy + 32),
            k.text(food.name, { size: 9 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        btn.onClick(() => {
            state.feed(food);
            state.uiMode = 'main';
        });
    });
}

function _showInteractMenu() {
    _clearMenuOverlay();
    _menuOverlay = true;

    const menuY = 540;
    const items = INTERACTION_TYPES;
    const cols  = 4;
    const cellW = GAME_WIDTH / cols;

    items.forEach((action, i) => {
        const col = i % cols;
        const cx  = cellW * col + cellW / 2;
        const cy  = menuY;

        const btn = k.add([
            k.pos(cx, cy),
            k.circle(28),
            k.color(...COLORS.bg),
            k.anchor('center'),
            k.outline(2, k.rgb(...COLORS.success)),
            k.area(),
            k.z(30),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy),
            k.text(action.emoji, { size: 24 }),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy + 32),
            k.text(action.name, { size: 9 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        btn.onClick(() => {
            state.interact(action);
            state.uiMode = 'main';
        });
    });
}

function _showEggsMenu() {
    _clearMenuOverlay();
    _menuOverlay = true;

    const menuY = 530;
    const eggs  = state.eggs;

    if (eggs.length === 0) {
        k.add([
            k.pos(GAME_WIDTH / 2, menuY),
            k.text('No eggs in reserve.\nBuy one from the Shop!', { size: 13 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);
        return;
    }

    eggs.forEach((egg, i) => {
        const cx = 60 + i * 90;
        const cy = menuY;

        const species = PET_SPECIES[egg.speciesIdx];

        const btn = k.add([
            k.pos(cx, cy),
            k.circle(30),
            k.color(...COLORS.bg),
            k.anchor('center'),
            k.outline(2, k.rgb(...COLORS.gold)),
            k.area(),
            k.z(30),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy),
            k.text(species.egg, { size: 28 }),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy + 36),
            k.text(species.name, { size: 9 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        btn.onClick(() => {
            // Hatch this egg as the active pet
            const idx = state.eggs.indexOf(egg);
            if (idx >= 0) state.eggs.splice(idx, 1);
            state.startNewEgg(egg.speciesIdx);
            state.uiMode = 'main';
        });
    });
}

function _showShopMenu() {
    _clearMenuOverlay();
    _menuOverlay = true;

    const menuY  = 510;
    const EGG_COST = 30;

    k.add([
        k.pos(GAME_WIDTH / 2, menuY - 30),
        k.text('Egg Shop', { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(31),
        'menu-overlay',
    ]);

    PET_SPECIES.forEach((species, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx  = 80 + col * 130;
        const cy  = menuY + row * 90;

        const btn = k.add([
            k.pos(cx, cy),
            k.circle(32),
            k.color(...COLORS.bg),
            k.anchor('center'),
            k.outline(2, k.rgb(...species.color)),
            k.area(),
            k.z(30),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy),
            k.text(species.egg, { size: 26 }),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy + 38),
            k.text(species.name, { size: 9 }),
            k.color(...COLORS.textDim),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        k.add([
            k.pos(cx, cy + 50),
            k.text(`🪙${EGG_COST}`, { size: 10 }),
            k.color(...COLORS.gold),
            k.anchor('center'),
            k.z(31),
            'menu-overlay',
        ]);

        btn.onClick(() => {
            if (state.gold < EGG_COST) return;
            state.addGold(-EGG_COST);
            state.addEgg(i);
            state.uiMode = 'main';
        });
    });
}

function _showConfigMenu() {
    _clearMenuOverlay();
    _menuOverlay = true;

    const menuY = 490;
    const CX    = GAME_WIDTH / 2;

    // Panel background
    k.add([
        k.pos(0, menuY - 30),
        k.rect(GAME_WIDTH, GAME_HEIGHT - (menuY - 30)),
        k.color(...COLORS.bgCard),
        k.anchor('topleft'),
        k.z(29),
        'menu-overlay',
    ]);

    k.add([
        k.pos(CX, menuY - 10),
        k.text('⚙️ Config', { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(31),
        'menu-overlay',
    ]);

    // Auto-save notice
    k.add([
        k.pos(CX, menuY + 30),
        k.text('Auto-save: every 10 seconds', { size: 11 }),
        k.color(...COLORS.textDim),
        k.anchor('center'),
        k.z(31),
        'menu-overlay',
    ]);

    // Reset button
    const resetBtn = k.add([
        k.pos(CX, menuY + 90),
        k.rect(220, 44),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.area(),
        k.z(30),
        'menu-overlay',
    ]);

    k.add([
        k.pos(CX, menuY + 90),
        k.text('Reset Pet', { size: 15 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(31),
        'menu-overlay',
    ]);

    // Confirmation state
    let confirmed = false;
    const confirmLabel = k.add([
        k.pos(CX, menuY + 130),
        k.text('', { size: 10 }),
        k.color(...COLORS.warning),
        k.anchor('center'),
        k.z(31),
        'menu-overlay',
    ]);

    resetBtn.onClick(() => {
        if (!confirmed) {
            confirmed = true;
            confirmLabel.text = 'Tap again to confirm reset';
        } else {
            events.emit('resetRequested');
        }
    });
}

// ---- Game over overlay ----

export function showGameOver() {
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
        k.pos(CX, CY - 80),
        k.text('💔', { size: 80 }),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 20),
        k.text(`${state.petName} has passed away...`, { size: 18 }),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 60),
        k.text('Tap or press R to get a new egg', { size: 13 }),
        k.color(...COLORS.textDim),
        k.anchor('center'),
        k.z(201),
    ]);
}

// ---- Hatch overlay ----

export function showHatchAnimation(species) {
    const CX = GAME_WIDTH / 2;

    const banner = k.add([
        k.pos(CX, 200),
        k.text(`A ${species.name} hatched!`, { size: 22 }),
        k.color(...species.color),
        k.anchor('center'),
        k.opacity(1),
        k.z(50),
    ]);

    let t = 0;
    banner.onUpdate(() => {
        t += k.dt();
        banner.opacity = Math.max(0, 1 - (t - 1.5) / 1);
        if (t > 2.5) k.destroy(banner);
    });
}

// ---- Events ----

function _subscribeEvents() {
    const offs = [
        events.on('petStatsChanged', () => _refreshStatBars()),
        events.on('goldChanged', (v) => { _goldLabel.text = `🪙 ${v}`; }),
        events.on('moodChanged', () => { _moodLabel.text = _moodText(); }),
        events.on('petStageChanged', () => { _stageLabel.text = _stageText(); }),
        events.on('uiModeChanged', (mode) => {
            _clearMenuOverlay();
            if (mode === 'feed')     _showFeedMenu();
            if (mode === 'interact') _showInteractMenu();
            if (mode === 'eggs')     _showEggsMenu();
            if (mode === 'shop')     _showShopMenu();
            if (mode === 'config')   _showConfigMenu();
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}
