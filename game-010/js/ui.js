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

// Help overlay state
let _helpObjs = [];
let _helpOpen = false;

export function isHelpOpen() { return _helpOpen; }

export function showHelpDialog() {
    if (_helpOpen) return;
    _helpOpen = true;
    state.isPaused = true;

    const W  = 700;
    const H  = 520;
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;
    const OX = CX - W / 2;  // top-left x
    const OY = CY - H / 2;  // top-left y
    const Z  = 200;

    // Backdrop
    _helpObjs.push(k.add([
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.6),
        k.z(Z),
    ]));

    // Panel
    _helpObjs.push(k.add([
        k.rect(W, H, { radius: 10 }),
        k.pos(CX, CY),
        k.anchor('center'),
        k.color(18, 20, 35),
        k.outline(2, k.rgb(100, 140, 220)),
        k.opacity(0.97),
        k.z(Z + 1),
    ]));

    // Title
    _helpObjs.push(k.add([
        k.pos(CX, OY + 18),
        k.text('HOW TO PLAY', { size: 18 }),
        k.color(...COLORS.accent),
        k.anchor('top'),
        k.z(Z + 2),
    ]));

    // Close hint
    _helpObjs.push(k.add([
        k.pos(CX, OY + H - 14),
        k.text('Press H or Esc to close', { size: 11 }),
        k.color(80, 80, 130),
        k.anchor('bot'),
        k.z(Z + 2),
    ]));

    // ---- Content: two columns ----
    // Left column: tile descriptions
    // Right column: terrain, controls, tips

    const COL1_X = OX + 20;
    const COL2_X = OX + W / 2 + 10;
    let y1 = OY + 50;
    let y2 = OY + 50;
    const LINE = 16;

    function addHeader(x, label, yRef) {
        _helpObjs.push(k.add([
            k.pos(x, yRef),
            k.text(label, { size: 13 }),
            k.color(...COLORS.accent),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        return yRef + LINE + 4;
    }

    function addLine(x, line, yRef, col) {
        col = col || COLORS.text;
        _helpObjs.push(k.add([
            k.pos(x, yRef),
            k.text(line, { size: 11 }),
            k.color(...col),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        return yRef + LINE;
    }

    // -- Left column: Buildings --
    y1 = addHeader(COL1_X, 'BUILDINGS', y1);

    const TILE_HELP = [
        { key: 'road',       desc: 'Connects the town. Required by all',  desc2: 'commercial and civic buildings.'      },
        { key: 'house',      desc: 'Adds population when next to a road.', desc2: 'Bonus +5 score if adjacent to park.' },
        { key: 'apartment',  desc: 'Dense housing; also adds population',  desc2: 'when road-connected.'                },
        { key: 'park',       desc: 'Boosts town happiness (+10% each).',   desc2: 'Happiness raises shop income.'       },
        { key: 'shop',       desc: 'Earns passive gold every 5 s.',        desc2: 'Needs an adjacent road.'             },
        { key: 'office',     desc: 'Higher earner than a shop.',           desc2: 'Needs an adjacent road.'             },
        { key: 'bank',       desc: 'Strong income source.',                desc2: 'Needs an adjacent road.'             },
        { key: 'government', desc: 'Highest score value. Earns income.',   desc2: 'Needs an adjacent road.'             },
        { key: 'clear',      desc: 'Removes a tile. Refunds 50% of its',   desc2: 'original cost.'                      },
    ];

    for (let i = 0; i < TILE_HELP.length; i++) {
        const { key, desc, desc2 } = TILE_HELP[i];
        const def = BUILDINGS[key];
        const costStr = def.cost > 0 ? `${def.cost}g` : 'free';
        const scoreStr = def.scoreValue > 0 ? `+${def.scoreValue}pts` : '';

        // Colour swatch
        _helpObjs.push(k.add([
            k.rect(9, 9),
            k.pos(COL1_X, y1 + 2),
            k.color(...def.color),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));

        // Label + cost
        _helpObjs.push(k.add([
            k.pos(COL1_X + 14, y1),
            k.text(`${def.label}  ${costStr}  ${scoreStr}`, { size: 11 }),
            k.color(220, 220, 240),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        y1 += 13;

        // Two description lines
        _helpObjs.push(k.add([
            k.pos(COL1_X + 14, y1),
            k.text(desc, { size: 10 }),
            k.color(140, 140, 170),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        y1 += 12;
        _helpObjs.push(k.add([
            k.pos(COL1_X + 14, y1),
            k.text(desc2, { size: 10 }),
            k.color(120, 120, 150),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        y1 += 15;
    }

    // -- Right column: Terrain, Tips, Controls --
    y2 = addHeader(COL2_X, 'TERRAIN', y2);
    const TERRAIN_HELP = [
        { swatch: [45, 70, 35],  label: 'Field      — common, open land'        },
        { swatch: [40, 80, 40],  label: 'Grassland  — lush, common land'        },
        { swatch: [65, 60, 55],  label: 'Mountain   — rocky terrain'            },
        { swatch: [30, 50, 90],  label: 'Lake       — water, rare'              },
    ];
    for (const t of TERRAIN_HELP) {
        _helpObjs.push(k.add([
            k.rect(9, 9),
            k.pos(COL2_X, y2 + 2),
            k.color(...t.swatch),
            k.anchor('topleft'),
            k.z(Z + 2),
        ]));
        y2 = addLine(COL2_X + 14, t.label, y2);
    }

    y2 += 10;
    y2 = addHeader(COL2_X, 'CONTROLS', y2);
    const CTRL_HELP = [
        '1-9        — select building tool',
        'Click/drag — place buildings',
        'Right-click — clear a tile',
        'Ctrl+Z     — undo last action',
        'Ctrl+S     — save town',
        'Ctrl+L     — load saved town',
        'R          — restart town',
        'P          — pause / unpause',
        'M          — toggle music',
        'H          — this help screen',
        'Esc        — main menu',
    ];
    for (const line of CTRL_HELP) {
        y2 = addLine(COL2_X, line, y2);
    }

    y2 += 10;
    y2 = addHeader(COL2_X, 'TIPS', y2);
    const TIPS = [
        'Place roads before shops/offices.',
        'Parks near houses give score bonus.',
        'More parks = happier town = more income.',
    ];
    for (const tip of TIPS) {
        y2 = addLine(COL2_X, '- ' + tip, y2, [120, 200, 140]);
    }
}

export function hideHelpDialog() {
    _helpObjs.forEach(o => { try { k.destroy(o); } catch (_) {} });
    _helpObjs = [];
    _helpOpen = false;
    state.isPaused = false;
}

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
        k.text('1-9: Select  Ctrl+Z: Undo  Ctrl+S: Save  Ctrl+L: Load  M: Music  H: Help  P: Pause  ESC: Menu', { size: 11 }),
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

    const BTN_H    = 34;  // button height
    const BTN_STEP = 38;  // step between buttons (includes gap)
    let btnY = 78;
    let btnIndex = 1;
    for (const [key, def] of Object.entries(BUILDINGS)) {
        const BY  = btnY;
        const BK  = key;
        const NUM = btnIndex;

        const isSelected = () => state.selectedTool === BK;

        // Button background — will be tinted by selection
        const bg = k.add([
            k.pos(PX + 8, BY),
            k.rect(PANEL_WIDTH - 16, BTN_H),
            k.color(...(isSelected() ? COLORS.accent : [40, 40, 60])),
            k.anchor('topleft'),
            k.z(101),
            k.area(),
        ]);

        // Key shortcut badge
        k.add([
            k.pos(PX + 14, BY + BTN_H / 2),
            k.text(String(NUM), { size: 10 }),
            k.color(120, 120, 160),
            k.anchor('left'),
            k.z(102),
        ]);

        // Colour swatch (left side, after key number)
        k.add([
            k.pos(PX + 26, BY + BTN_H / 2),
            k.rect(8, 8),
            k.color(...def.color),
            k.anchor('left'),
            k.z(102),
        ]);

        const labelEnt = k.add([
            k.pos(PX + 38, BY + BTN_H / 2),
            k.text(def.label, { size: 12 }),
            k.color(...COLORS.text),
            k.anchor('left'),
            k.z(102),
        ]);

        const costText = key === 'clear'
            ? `${Math.round(CLEAR_REFUND_RATE * 100)}%`
            : def.cost > 0 ? `${def.cost}g` : 'free';
        const costEnt = k.add([
            k.pos(PX + PANEL_WIDTH - 12, BY + BTN_H / 2),
            k.text(costText, { size: 11 }),
            k.color(...COLORS.gold),
            k.anchor('right'),
            k.z(102),
        ]);

        bg.onClick(() => {
            state.selectedTool = BK;
        });

        toolButtons[key] = { bg, labelEnt, costEnt };
        btnY += BTN_STEP;
        btnIndex++;
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
