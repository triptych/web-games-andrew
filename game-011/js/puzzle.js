/**
 * puzzle.js — Nonogram clue generation and satisfaction checking.
 *
 * A nonogram clue for a line is the ordered list of run-lengths of consecutive
 * filled cells.  e.g. [0,1,1,0,1,1,1,0,0,0] → [2, 3]
 *
 * Public API:
 *   computeClues(grid)
 *     Accepts a 10×10 boolean/truthy grid (truthy = filled).
 *     Returns { rowClues: string[][], colClues: string[][] }
 *     where each entry is an array of run-length numbers for that line.
 *     Empty lines return [0].
 *
 *   initPuzzle()
 *     Reads state.enemyGrid, computes clues, inits state.playerGrid,
 *     and stores the clues internally for later satisfaction checks.
 *     Returns { rowClues, colClues }.
 *
 *   checkLineSatisfied(lineType, index)
 *     lineType: 'row' | 'col'
 *     index:    0-based line index
 *     Compares the player's current marks in state.playerGrid against
 *     the solution clue.
 *     Returns true if the line's player marks exactly match the clue.
 *
 *   isPuzzleSolved()
 *     Returns true if every row and column is satisfied simultaneously.
 *     (This is stronger than each line individually being satisfied —
 *     it also catches degenerate "all filled" solutions.)
 *
 *   setCell(row, col, value)
 *     value: 'filled' | 'empty' | null
 *     Updates state.playerGrid and emits cellFilled / cellCleared.
 *     Checks if the puzzle is now solved and emits puzzleSolved.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GRID_COLS, GRID_ROWS } from './config.js';

let _rowClues = null;
let _colClues = null;

// ----------------------------------------------------------------
// Public
// ----------------------------------------------------------------

/**
 * Compute nonogram clues from a 10×10 grid (any truthy value = filled).
 * Returns { rowClues, colClues } — each is an array of run-length arrays.
 * Empty lines return [0].
 */
export function computeClues(grid) {
    const rowClues = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        rowClues.push(_runLengths(grid[r]));
    }

    const colClues = [];
    for (let c = 0; c < GRID_COLS; c++) {
        const col = grid.map(row => row[c]);
        colClues.push(_runLengths(col));
    }

    return { rowClues, colClues };
}

/**
 * Initialise the puzzle from the current state.enemyGrid.
 * Must be called after initFleet().
 * @returns {{ rowClues: number[][], colClues: number[][] }}
 */
export function initPuzzle() {
    const { rowClues, colClues } = computeClues(state.enemyGrid);
    _rowClues = rowClues;
    _colClues = colClues;

    // Init blank player grid
    state.playerGrid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

    return { rowClues, colClues };
}

/**
 * Get the stored clues (must call initPuzzle first).
 */
export function getClues() {
    return { rowClues: _rowClues, colClues: _colClues };
}

/**
 * Set a cell in the player grid and check clue satisfaction / puzzle solved.
 * @param {number} row
 * @param {number} col
 * @param {'filled'|'empty'|null} value
 */
export function setCell(row, col, value) {
    if (!state.playerGrid) return;

    const prev = state.playerGrid[row][col];
    state.playerGrid[row][col] = value;

    if (value === 'filled' && prev !== 'filled') {
        events.emit('cellFilled', row, col);
    } else if ((value === 'empty' || value === null) && prev === 'filled') {
        events.emit('cellCleared', row, col);
    } else if (value !== prev) {
        // covers null→'empty', 'empty'→null, etc. — grid still needs to redraw
        events.emit('cellMarked', row, col);
    }

    if (isPuzzleSolved()) {
        events.emit('puzzleSolved');
    }
}

/**
 * Check whether a single row or column in the player grid satisfies its clue.
 * Only 'filled' cells count — 'empty' and null are treated as unfilled.
 */
export function checkLineSatisfied(lineType, index) {
    if (!state.playerGrid || !_rowClues) return false;

    let line;
    if (lineType === 'row') {
        line = state.playerGrid[index].map(v => v === 'filled');
    } else {
        line = state.playerGrid.map(row => row[index] === 'filled');
    }

    const playerRuns = _runLengths(line);
    const solutionRuns = lineType === 'row' ? _rowClues[index] : _colClues[index];

    return _arraysEqual(playerRuns, solutionRuns);
}

/**
 * Returns true when every row AND every column is satisfied AND the player
 * grid exactly matches the enemy grid (no extra filled cells).
 */
export function isPuzzleSolved() {
    if (!state.playerGrid || !state.enemyGrid) return false;

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const playerFilled  = state.playerGrid[r][c] === 'filled';
            const solutionFilled = state.enemyGrid[r][c] !== null;
            if (playerFilled !== solutionFilled) return false;
        }
    }
    return true;
}

// ----------------------------------------------------------------
// Internals
// ----------------------------------------------------------------

/**
 * Compute run-lengths for a 1-D boolean/truthy array.
 * Returns [0] for an all-empty line.
 */
function _runLengths(line) {
    const runs = [];
    let count  = 0;

    for (const cell of line) {
        if (cell) {
            count++;
        } else if (count > 0) {
            runs.push(count);
            count = 0;
        }
    }
    if (count > 0) runs.push(count);
    return runs.length > 0 ? runs : [0];
}

function _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
