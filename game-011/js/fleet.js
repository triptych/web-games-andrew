/**
 * fleet.js — Ship placement on the hidden 10×10 enemy grid.
 *
 * Public API:
 *   initFleet(levelConfig)
 *     Generates a random fleet layout according to levelConfig.ships,
 *     stores results in state.enemyGrid and state.revealed,
 *     sets state.shipsRemaining, and returns the placed ships array.
 *
 *   fireAt(row, col)
 *     Fires a torpedo at the given cell.
 *     Consumes a shot, updates state.revealed, and emits:
 *       shipHit(row, col, shipName)   — or —
 *       (miss is handled by the caller reading state.revealed)
 *     Returns 'hit' | 'miss' | 'already_fired'.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GRID_COLS, GRID_ROWS, FLEET } from './config.js';

// Currently placed ships: [{ name, size, cells: [{row,col}], hits: Set }]
let _ships = [];

// ----------------------------------------------------------------
// Public
// ----------------------------------------------------------------

/**
 * @param {object} [levelConfig]  Optional override; defaults to full FLEET.
 *   levelConfig.ships — array of { name, size } describing which ships to place.
 *   levelConfig.seed  — numeric seed for deterministic placement (optional).
 */
export function initFleet(levelConfig) {
    const shipDefs = _buildShipList(levelConfig);

    const grid   = _emptyGrid();   // null | shipName per cell
    const placed = [];

    for (const def of shipDefs) {
        const cells = _placeShip(grid, def.size, def.name);
        placed.push({ name: def.name, size: def.size, cells, hits: new Set() });
    }

    // Persist in state
    state.enemyGrid      = grid;
    state.revealed       = _emptyGrid();  // null initially; 'hit'|'miss' after shot
    state.shipsRemaining = placed.length;

    _ships = placed;
    return placed;
}

/**
 * Fire at (row, col).
 * @returns {'hit'|'miss'|'already_fired'}
 */
export function fireAt(row, col) {
    if (state.revealed[row][col] !== null) return 'already_fired';

    const shipName = state.enemyGrid[row][col];

    if (shipName) {
        // Hits are free — don't consume a shot
        state.revealed[row][col] = 'hit';
        events.emit('shipHit', row, col, shipName);

        // Track hit on the ship object
        const ship = _ships.find(s => s.name === shipName);
        if (ship) {
            ship.hits.add(`${row},${col}`);
            if (ship.hits.size === ship.cells.length) {
                state.sinkShip(shipName);   // emits shipSunk + possibly levelComplete
            }
        }
        return 'hit';
    } else {
        // Misses cost a shot
        state.useShot();
        state.revealed[row][col] = 'miss';
        return 'miss';
    }
}

/**
 * Returns a copy of the current placed-ships array (safe to iterate for rendering).
 */
export function getShips() {
    return _ships.slice();
}

// ----------------------------------------------------------------
// Internals
// ----------------------------------------------------------------

function _emptyGrid() {
    return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
}

/**
 * Build an ordered list of { name, size } to place.
 * Uses FLEET config (each entry has count) unless levelConfig overrides.
 */
function _buildShipList(levelConfig) {
    if (levelConfig && levelConfig.ships) return levelConfig.ships;

    const list = [];
    for (const entry of FLEET) {
        for (let i = 0; i < entry.count; i++) {
            list.push({ name: entry.name, size: entry.size });
        }
    }
    return list;
}

/**
 * Attempt to place a ship of `size` randomly on `grid`.
 * Enforces no-overlap and no-adjacency rules.
 * Mutates grid with shipName in occupied cells.
 * @returns {Array<{row,col}>} the placed cells
 */
function _placeShip(grid, size, shipName) {
    const MAX_ATTEMPTS = 2000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const horizontal = Math.random() < 0.5;
        const maxRow = horizontal ? GRID_ROWS - 1           : GRID_ROWS - size;
        const maxCol = horizontal ? GRID_COLS - size        : GRID_COLS - 1;

        const startRow = Math.floor(Math.random() * (maxRow + 1));
        const startCol = Math.floor(Math.random() * (maxCol + 1));

        const cells = [];
        for (let i = 0; i < size; i++) {
            cells.push({
                row: startRow + (horizontal ? 0 : i),
                col: startCol + (horizontal ? i : 0),
            });
        }

        if (_canPlace(grid, cells)) {
            for (const { row, col } of cells) {
                grid[row][col] = shipName;
            }
            return cells;
        }
    }

    // Fallback: try exhaustive scan (guarantees a result if any slot exists)
    for (let startRow = 0; startRow < GRID_ROWS; startRow++) {
        for (let startCol = 0; startCol < GRID_COLS; startCol++) {
            for (const horizontal of [true, false]) {
                const cells = [];
                for (let i = 0; i < size; i++) {
                    cells.push({
                        row: startRow + (horizontal ? 0 : i),
                        col: startCol + (horizontal ? i : 0),
                    });
                }
                if (cells.every(c => c.row < GRID_ROWS && c.col < GRID_COLS) &&
                    _canPlace(grid, cells)) {
                    for (const { row, col } of cells) grid[row][col] = shipName;
                    return cells;
                }
            }
        }
    }

    throw new Error(`fleet.js: could not place ${shipName} (size ${size}) — grid too full`);
}

/**
 * Returns true if all cells are empty AND no adjacent occupied cell exists.
 */
function _canPlace(grid, cells) {
    const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));

    for (const { row, col } of cells) {
        if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return false;
        if (grid[row][col] !== null) return false;

        // Check all 8 neighbours for adjacency conflicts
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
                // Ignore cells that are part of this very ship
                if (cellSet.has(`${nr},${nc}`)) continue;
                if (grid[nr][nc] !== null) return false;
            }
        }
    }
    return true;
}