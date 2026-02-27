/**
 * grid.js — Nonogram grid rendering and cell interaction.
 *
 * Call initGrid(k) once per game scene.
 * The grid renders row/col clues and a 10×10 interactive cell area.
 * Left-click fills a cell; right-click marks it empty (X); clicking a
 * filled or marked cell clears it back to null.
 *
 * Clue labels automatically turn green when their line is satisfied.
 *
 * Public API:
 *   initGrid(k)    — build all Kaplay entities for the grid
 *   refreshGrid()  — redraw all cells (e.g. after state change)
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GRID_COLS, GRID_ROWS, CELL_SIZE, CLUE_MARGIN, COLORS,
    GAME_WIDTH, GAME_HEIGHT,
} from './config.js';
import { setCell, checkLineSatisfied, getClues } from './puzzle.js';
import { getShipCells } from './fleet.js';

// ----------------------------------------------------------------
// Layout
// ----------------------------------------------------------------

// Grid origin: the top-left corner of cell (0,0)
// We centre the whole puzzle area (clues + cells) horizontally.
const PUZZLE_W = CLUE_MARGIN + GRID_COLS * CELL_SIZE;   // 80 + 420 = 500
const PUZZLE_H = CLUE_MARGIN + GRID_ROWS * CELL_SIZE;   // 80 + 420 = 500

const GRID_ORIGIN_X = Math.floor((GAME_WIDTH  - PUZZLE_W) / 2) + CLUE_MARGIN;
const GRID_ORIGIN_Y = Math.floor((GAME_HEIGHT - PUZZLE_H) / 2) + CLUE_MARGIN;

// ----------------------------------------------------------------
// Module state
// ----------------------------------------------------------------

let _k          = null;
let _cellObjs   = [];   // [row][col] -> { bg, mark }
let _rowClueObjs = [];  // [row] -> array of Kaplay text entities
let _colClueObjs = [];  // [col] -> array of Kaplay text entities
let _isFireMode = false;

// ----------------------------------------------------------------
// Public
// ----------------------------------------------------------------

export function initGrid(kaplay) {
    _k = kaplay;
    _cellObjs    = [];
    _rowClueObjs = [];
    _colClueObjs = [];
    _isFireMode  = false;

    const { rowClues, colClues } = getClues();

    _buildCells();
    _buildRowClues(rowClues);
    _buildColClues(colClues);
    _subscribeEvents();
}

/**
 * Returns the pixel center of cell (row, col) — used by main.js for
 * coordinate-to-cell hit testing on click.
 */
export function cellCenter(row, col) {
    return {
        x: GRID_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
        y: GRID_ORIGIN_Y + row * CELL_SIZE + CELL_SIZE / 2,
    };
}

/**
 * Returns the grid (row, col) that contains pixel (px, py),
 * or null if outside the grid.
 */
export function pixelToCell(px, py) {
    const col = Math.floor((px - GRID_ORIGIN_X) / CELL_SIZE);
    const row = Math.floor((py - GRID_ORIGIN_Y) / CELL_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { row, col };
}

/**
 * Redraw every cell to match the current state.playerGrid.
 * Also refreshes all clue highlight states.
 */
export function refreshGrid() {
    if (!state.playerGrid) return;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            _refreshCell(r, c);
        }
    }
    _refreshAllClues();
}

/**
 * Switch between SOLVE and FIRE mode visuals.
 */
export function setFireMode(isFireMode) {
    _isFireMode = isFireMode;
    refreshGrid();
}

// ----------------------------------------------------------------
// Build entities
// ----------------------------------------------------------------

function _buildCells() {
    const PAD = 2; // gap between cells in px

    for (let r = 0; r < GRID_ROWS; r++) {
        _cellObjs[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            const x = GRID_ORIGIN_X + c * CELL_SIZE;
            const y = GRID_ORIGIN_Y + r * CELL_SIZE;
            const w = CELL_SIZE - PAD;
            const h = CELL_SIZE - PAD;

            // Background rect (shows cell state by color)
            const bg = _k.add([
                _k.pos(x + PAD / 2, y + PAD / 2),
                _k.rect(w, h),
                _k.color(...COLORS.cellEmpty),
                _k.opacity(1),
                _k.z(10),
                'gridCell',
            ]);

            // "X" mark label (visible only when cell is 'empty')
            const mark = _k.add([
                _k.pos(x + CELL_SIZE / 2, y + CELL_SIZE / 2),
                _k.text('X', { size: 16 }),
                _k.color(180, 60, 60),
                _k.anchor('center'),
                _k.opacity(0),
                _k.z(11),
                'gridCell',
            ]);

            _cellObjs[r][c] = { bg, mark };
        }
    }
}

function _buildRowClues(rowClues) {
    for (let r = 0; r < GRID_ROWS; r++) {
        const clue    = rowClues[r];          // e.g. [3, 1]
        const yCenter = GRID_ORIGIN_Y + r * CELL_SIZE + CELL_SIZE / 2;

        // Right-align the clue numbers inside the left margin
        // We render them as a single space-separated string for simplicity.
        const label = _k.add([
            _k.pos(GRID_ORIGIN_X - 6, yCenter),
            _k.text(clue.join('  '), { size: 14 }),
            _k.color(...COLORS.text),
            _k.anchor('right'),
            _k.z(12),
            'clueLabel',
        ]);
        _rowClueObjs[r] = label;
    }
}

function _buildColClues(colClues) {
    for (let c = 0; c < GRID_COLS; c++) {
        const clue    = colClues[c];
        const xCenter = GRID_ORIGIN_X + c * CELL_SIZE + CELL_SIZE / 2;

        // Render each number on its own line, stacked upward from the top of the cell area
        // For simplicity, join with newline and anchor bottom.
        const label = _k.add([
            _k.pos(xCenter, GRID_ORIGIN_Y - 6),
            _k.text(clue.join('\n'), { size: 14 }),
            _k.color(...COLORS.text),
            _k.anchor('bot'),
            _k.z(12),
            'clueLabel',
        ]);
        _colClueObjs[c] = label;
    }
}

// ----------------------------------------------------------------
// Refresh helpers
// ----------------------------------------------------------------

function _refreshCell(r, c) {
    const { bg, mark } = _cellObjs[r][c];
    const cellVal = state.playerGrid[r][c];
    const revealed = state.revealed ? state.revealed[r][c] : null;

    if (revealed === 'sunk') {
        bg.color     = _k.rgb(...COLORS.shipSunk);
        mark.opacity = 0;
    } else if (revealed === 'hit') {
        bg.color   = _k.rgb(...COLORS.shipHit);
        mark.opacity = 0;
    } else if (revealed === 'miss') {
        bg.color   = _k.rgb(20, 35, 75);
        mark.opacity = 1;
        mark.text  = '*';
        mark.color = _k.rgb(80, 120, 200);
    } else if (cellVal === 'filled') {
        bg.color   = _k.rgb(...COLORS.cellFill);
        mark.opacity = 0;
    } else if (cellVal === 'empty') {
        bg.color   = _k.rgb(...COLORS.cellEmpty);
        mark.opacity = 0.8;
        mark.text  = 'X';
        mark.color = _k.rgb(180, 60, 60);
    } else {
        bg.color   = _k.rgb(...COLORS.cellEmpty);
        mark.opacity = 0;
    }
}

function _refreshClue(lineType, index) {
    const satisfied = checkLineSatisfied(lineType, index);
    const color = satisfied ? _k.rgb(...COLORS.success) : _k.rgb(...COLORS.text);
    if (lineType === 'row') {
        _rowClueObjs[index].color = color;
    } else {
        _colClueObjs[index].color = color;
    }
}

function _refreshAllClues() {
    for (let r = 0; r < GRID_ROWS; r++) _refreshClue('row', r);
    for (let c = 0; c < GRID_COLS; c++) _refreshClue('col', c);
}

// ----------------------------------------------------------------
// Event subscriptions
// ----------------------------------------------------------------

function _subscribeEvents() {
    const _onCell = (r, c) => { _refreshCell(r, c); _refreshClue('row', r); _refreshClue('col', c); };
    const offs = [
        events.on('cellFilled',  _onCell),
        events.on('cellCleared', _onCell),
        events.on('cellMarked',  _onCell),
        events.on('shipHit', (_fleetIdx, row, col) => {
            const { x, y } = cellCenter(row, col);
            _spawnHitFire(x, y);
        }),
        events.on('shipSunk', (fleetIdx) => {
            const cells = getShipCells(fleetIdx);
            for (const { row, col } of cells) {
                state.revealed[row][col] = 'sunk';
                _refreshCell(row, col);
            }
            // Big explosion centred on the ship's midpoint
            const midIdx = Math.floor(cells.length / 2);
            const { x: mx, y: my } = cellCenter(cells[midIdx].row, cells[midIdx].col);
            _spawnShipExplosion(mx, my, cells);
        }),
    ];

    _k.onSceneLeave(() => offs.forEach(off => off()));
}

// ----------------------------------------------------------------
// Hit fire animation
// ----------------------------------------------------------------

/**
 * Persistent flickering flame + smoke on a hit ship cell.
 * Mirrors the game-008 spawnBurnEffect pattern.
 * @param {number} cx  pixel centre x
 * @param {number} cy  pixel centre y
 */
function _spawnHitFire(cx, cy) {
    let flameTimer = 0;
    let smokeTimer = 0;
    const FLAME_INTERVAL = 0.10;
    const SMOKE_INTERVAL = 0.30;

    _k.add([
        _k.pos(cx, cy),
        _k.z(20),
        _k.opacity(0),   // invisible controller; opacity component required
        'hitFire',
        {
            update() {
                flameTimer += _k.dt();
                smokeTimer += _k.dt();
                if (flameTimer >= FLAME_INTERVAL) {
                    flameTimer -= FLAME_INTERVAL;
                    _spawnFlameParticle(cx, cy);
                }
                if (smokeTimer >= SMOKE_INTERVAL) {
                    smokeTimer -= SMOKE_INTERVAL;
                    _spawnSmokeParticle(cx, cy);
                }
            },
        },
    ]);
}

function _spawnFlameParticle(cx, cy) {
    const palette = [
        [255, 60,  10],
        [255, 110, 20],
        [255, 160, 30],
        [255, 200, 50],
        [255, 240, 80],
    ];
    const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];

    const size = 3 + Math.random() * 5;          // 3–8 px — slightly smaller than game-008
    const ox   = (Math.random() - 0.5) * 16;     // horizontal spread ±8 px
    const oy   = 3 + Math.random() * 4;          // start slightly below centre
    const vx   = (Math.random() - 0.5) * 20;
    const vy   = -(24 + Math.random() * 32);     // upward 24–56 px/s
    const life = 0.28 + Math.random() * 0.24;

    let bx = cx + ox;
    let by = cy + oy;
    let t  = 0;

    const ent = _k.add([
        _k.pos(bx, by),
        _k.circle(size),
        _k.color(r, g, b),
        _k.opacity(0.85),
        _k.anchor('center'),
        _k.z(21),
        'hitFire',
    ]);

    ent.onUpdate(() => {
        t  += _k.dt();
        bx += vx * _k.dt();
        by += vy * _k.dt();
        if (ent.exists()) {
            ent.pos     = _k.vec2(bx, by);
            ent.opacity = 0.85 * Math.max(0, 1 - t / life);
        }
        if (t >= life && ent.exists()) ent.destroy();
    });
}

function _spawnSmokeParticle(cx, cy) {
    const grey    = 90 + Math.floor(Math.random() * 60);
    const size    = 5 + Math.random() * 7;
    const ox      = (Math.random() - 0.5) * 12;
    const vx      = (Math.random() - 0.5) * 12;
    const vy      = -(16 + Math.random() * 18);
    const life    = 0.50 + Math.random() * 0.35;
    const startOp = 0.28 + Math.random() * 0.14;

    let bx = cx + ox;
    let by = cy - 5;
    let t  = 0;

    const ent = _k.add([
        _k.pos(bx, by),
        _k.circle(size),
        _k.color(grey, grey, grey),
        _k.opacity(startOp),
        _k.anchor('center'),
        _k.z(22),
        'hitFire',
    ]);

    ent.onUpdate(() => {
        t  += _k.dt();
        bx += vx * _k.dt();
        by += vy * _k.dt();
        if (ent.exists()) {
            ent.pos     = _k.vec2(bx, by);
            ent.opacity = startOp * Math.max(0, 1 - t / life);
        }
        if (t >= life && ent.exists()) ent.destroy();
    });
}

// ----------------------------------------------------------------
// Ship destruction explosion
// ----------------------------------------------------------------

/**
 * Big explosion when a ship is fully sunk.
 * Fires a burst of particles from every cell + two expanding shockwave rings
 * from the ship's midpoint.
 */
function _spawnShipExplosion(cx, cy, cells) {
    // Two layered shockwave rings from the midpoint
    _spawnShockwave(cx, cy, [255, 120, 30],  0);
    _spawnShockwave(cx, cy, [255, 200, 80], 0.07);

    // Per-cell burst of particles
    for (const { row, col } of cells) {
        const { x, y } = cellCenter(row, col);
        _spawnExplosionBurst(x, y);
    }
}

/**
 * Expanding shockwave ring that fades out.
 */
function _spawnShockwave(cx, cy, color, delay) {
    const DURATION   = 0.55;
    const MAX_RADIUS = 200;
    let t = -delay;

    const ring = _k.add([
        _k.pos(cx, cy),
        _k.circle(1),
        _k.color(...color),
        _k.opacity(0),
        _k.anchor('center'),
        _k.z(30),
        'explosion',
    ]);

    ring.onUpdate(() => {
        t += _k.dt();
        if (t < 0 || !ring.exists()) return;
        const progress = t / DURATION;
        if (progress >= 1) { ring.destroy(); return; }
        ring.radius  = 1 + MAX_RADIUS * progress;
        ring.opacity = (1 - progress) * 0.55;
    });
}

/**
 * Radial burst of ~14 glowing particles from one cell centre.
 */
function _spawnExplosionBurst(cx, cy) {
    const COUNT = 14;
    const palette = [
        [255, 80,  20],
        [255, 140, 30],
        [255, 200, 50],
        [255, 240, 120],
        [255, 255, 200],
    ];

    for (let i = 0; i < COUNT; i++) {
        const angle   = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const speed   = 80 + Math.random() * 140;
        const vx      = Math.cos(angle) * speed;
        const vy      = Math.sin(angle) * speed;
        const size    = 3 + Math.random() * 5;
        const life    = 0.45 + Math.random() * 0.35;
        const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];

        let bx = cx + (Math.random() - 0.5) * 8;
        let by = cy + (Math.random() - 0.5) * 8;
        let t  = 0;

        const p = _k.add([
            _k.pos(bx, by),
            _k.rect(size, size),
            _k.color(r, g, b),
            _k.opacity(1),
            _k.anchor('center'),
            _k.z(31),
            'explosion',
        ]);

        p.onUpdate(() => {
            t  += _k.dt();
            bx += vx * _k.dt();
            by += vy * _k.dt();
            if (p.exists()) {
                p.pos     = _k.vec2(bx, by);
                p.opacity = Math.max(0, 1 - t / life);
            }
            if (t >= life && p.exists()) p.destroy();
        });
    }
}
