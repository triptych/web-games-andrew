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

    if (_isFireMode && revealed === 'hit') {
        bg.color   = _k.rgb(...COLORS.shipHit);
        mark.opacity = 0;
    } else if (_isFireMode && revealed === 'miss') {
        bg.color   = _k.rgb(30, 60, 110);
        mark.opacity = 1;
        mark.text  = '~';
        mark.color = _k.rgb(60, 100, 180);
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
    ];

    _k.onSceneLeave(() => offs.forEach(off => off()));
}
