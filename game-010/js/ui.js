/**
 * ui.js — HUD and build panel for Tiny Town.
 * Call initUI(k) once per game scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, BUILDINGS, PANEL_WIDTH, CLEAR_REFUND_RATE } from './config.js';

let k;
let scoreLabel, goldLabel, bonusLabel, popLabel, happinessLabel;
let incomeToast = null;
let incomeToastTimer = 0;
// toolButtons[key] = { bg, labelEnt, costEnt }
const toolButtons = {};

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _buildPanel();
    _subscribeEvents();
}

function _buildHUD() {
    // Dark top bar
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, 42),
        k.color(20, 20, 35),
        k.z(100),
    ]);

    scoreLabel = k.add([
        k.pos(12, 4),
        k.text(`Score: ${state.score}`, { size: 14 }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(101),
    ]);

    goldLabel = k.add([
        k.pos(200, 4),
        k.text(`Gold: ${state.gold}`, { size: 14 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(101),
    ]);

    bonusLabel = k.add([
        k.pos(380, 4),
        k.text('', { size: 13 }),
        k.color(255, 240, 80),
        k.anchor('topleft'),
        k.z(101),
    ]);

    popLabel = k.add([
        k.pos(12, 24),
        k.text('Pop: 0', { size: 12 }),
        k.color(180, 220, 255),
        k.anchor('topleft'),
        k.z(101),
    ]);

    happinessLabel = k.add([
        k.pos(110, 24),
        k.text('Happiness: 0%', { size: 12 }),
        k.color(100, 220, 140),
        k.anchor('topleft'),
        k.z(101),
    ]);

    k.add([
        k.pos(GAME_WIDTH / 2, 8),
        k.text('Tiny Town', { size: 16 }),
        k.color(...COLORS.accent),
        k.anchor('top'),
        k.z(101),
    ]);

    k.add([
        k.pos(GAME_WIDTH - 12, 8),
        k.text('Ctrl+Z: Undo  Ctrl+S: Save  Ctrl+L: Load  M: Music  P: Pause  ESC: Menu', { size: 11 }),
        k.color(80, 80, 120),
        k.anchor('topright'),
        k.z(101),
    ]);
}

function _buildPanel() {
    const PX = GAME_WIDTH - PANEL_WIDTH;

    // Panel background
    k.add([
        k.pos(PX, 42),
        k.rect(PANEL_WIDTH, GAME_HEIGHT - 42),
        k.color(18, 18, 30),
        k.z(100),
    ]);

    k.add([
        k.pos(PX + PANEL_WIDTH / 2, 58),
        k.text('BUILD', { size: 13 }),
        k.color(...COLORS.accent),
        k.anchor('top'),
        k.z(101),
    ]);

    let btnY = 82;
    for (const [key, def] of Object.entries(BUILDINGS)) {
        const BY = btnY;
        const BK = key;

        const isSelected = () => state.selectedTool === BK;

        // Button background — will be tinted by selection
        const bg = k.add([
            k.pos(PX + 10, BY),
            k.rect(PANEL_WIDTH - 20, 38),
            k.color(...(isSelected() ? COLORS.accent : [40, 40, 60])),
            k.anchor('topleft'),
            k.z(101),
            k.area(),
        ]);

        const labelEnt = k.add([
            k.pos(PX + 20, BY + 8),
            k.text(def.label, { size: 13 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(102),
        ]);

        const costText = key === 'clear'
            ? `${Math.round(CLEAR_REFUND_RATE * 100)}% back`
            : def.cost > 0 ? `${def.cost}g` : 'free';
        const costEnt = k.add([
            k.pos(PX + PANEL_WIDTH - 20, BY + 8),
            k.text(costText, { size: 11 }),
            k.color(...COLORS.gold),
            k.anchor('topright'),
            k.z(102),
        ]);

        // Colour swatch
        k.add([
            k.pos(PX + PANEL_WIDTH - 22, BY + 20),
            k.rect(12, 12),
            k.color(...def.color),
            k.anchor('topright'),
            k.z(102),
        ]);

        bg.onClick(() => {
            state.selectedTool = BK;
        });

        toolButtons[key] = { bg, labelEnt, costEnt };
        btnY += 46;
    }

    // Instructions at bottom of panel
    k.add([
        k.pos(PX + PANEL_WIDTH / 2, GAME_HEIGHT - 14),
        k.text('Click grid to place', { size: 10 }),
        k.color(60, 60, 100),
        k.anchor('bot'),
        k.z(101),
    ]);
}

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', (v) => {
            scoreLabel.text = `Score: ${v}`;
        }),
        events.on('goldChanged', (v) => {
            goldLabel.text = `Gold: ${v}`;
            _updateAffordability(v);
        }),
        events.on('selectedToolChanged', (tool) => {
            _updateAffordability(state.gold);
        }),
        events.on('adjacencyChanged', () => {
            const total = [...state.adjacencyBonuses.values()].reduce((a, b) => a + b, 0);
            bonusLabel.text = total > 0 ? `Bonus: +${total}` : '';
        }),
        events.on('populationChanged', (pop) => {
            popLabel.text = `Pop: ${pop}`;
        }),
        events.on('happinessChanged', (h) => {
            const pct = Math.round(h * 100);
            happinessLabel.text = `Happy: ${pct}%`;
        }),
        events.on('incomeTick', (earned) => {
            _showIncomeToast(earned);
        }),
        events.on('toastMessage', (msg) => {
            _showToast(msg, COLORS.accent);
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

function _updateAffordability(gold) {
    const selected = state.selectedTool;
    for (const [key, { bg, labelEnt, costEnt }] of Object.entries(toolButtons)) {
        const def        = BUILDINGS[key];
        const isSelected = key === selected;
        const canAfford  = def.cost === 0 || gold >= def.cost;

        if (isSelected) {
            bg.color        = k.Color.fromArray(COLORS.accent);
            labelEnt.color  = k.Color.fromArray(COLORS.text);
            costEnt.color   = k.Color.fromArray(COLORS.gold);
        } else if (canAfford) {
            bg.color        = k.Color.fromArray([40, 40, 60]);
            labelEnt.color  = k.Color.fromArray(COLORS.text);
            costEnt.color   = k.Color.fromArray(COLORS.gold);
        } else {
            // Can't afford — dim the button
            bg.color        = k.Color.fromArray([25, 25, 35]);
            labelEnt.color  = k.Color.fromArray([90, 90, 100]);
            costEnt.color   = k.Color.fromArray([140, 100, 40]);
        }
    }
}

function _showIncomeToast(amount) {
    _showToast(`+${amount}g`, COLORS.gold);
}

function _showToast(text, color) {
    if (incomeToast) {
        incomeToast.destroy();
        incomeToast = null;
    }
    incomeToastTimer = 0;
    incomeToast = k.add([
        k.pos(200, 24),
        k.text(text, { size: 12 }),
        k.color(...color),
        k.anchor('topleft'),
        k.opacity(1),
        k.z(110),
    ]);

    incomeToast.onUpdate(() => {
        incomeToastTimer += k.dt();
        if (incomeToastTimer > 1.5) {
            incomeToast.opacity = Math.max(0, 1 - (incomeToastTimer - 1.5) / 0.5);
        }
        if (incomeToastTimer > 2.0) {
            incomeToast.destroy();
            incomeToast = null;
        }
    });
}
