/**
 * ui.js — HUD and build panel for Tiny Town.
 * Call initUI(k) once per game scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, BUILDINGS, PANEL_WIDTH } from './config.js';

let k;
let scoreLabel, goldLabel, bonusLabel;
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
        k.pos(12, 8),
        k.text(`Score: ${state.score}`, { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(101),
    ]);

    goldLabel = k.add([
        k.pos(200, 8),
        k.text(`Gold: ${state.gold}`, { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(101),
    ]);

    bonusLabel = k.add([
        k.pos(380, 8),
        k.text('', { size: 14 }),
        k.color(255, 240, 80),
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
        k.text('P: Pause  ESC: Menu', { size: 11 }),
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

        k.add([
            k.pos(PX + 20, BY + 8),
            k.text(def.label, { size: 13 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(102),
        ]);

        const costText = def.cost > 0 ? `${def.cost}g` : 'free';
        k.add([
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

        toolButtons[key] = bg;
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
        }),
        events.on('selectedToolChanged', (tool) => {
            for (const [key, bg] of Object.entries(toolButtons)) {
                bg.color = k.Color.fromArray(key === tool ? COLORS.accent : [40, 40, 60]);
            }
        }),
        events.on('adjacencyChanged', () => {
            const total = [...state.adjacencyBonuses.values()].reduce((a, b) => a + b, 0);
            bonusLabel.text = total > 0 ? `Bonus: +${total}` : '';
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}
