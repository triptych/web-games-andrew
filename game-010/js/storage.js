/**
 * storage.js — Save / load Tiny Town to localStorage.
 *
 * Format (JSON under key 'tinyTown_save'):
 *   { grid: string[][], gold: number, score: number }
 *
 * Exports:
 *   saveGame(state)   — serialises and writes to localStorage
 *   loadGame(state)   — reads and restores; returns true on success
 */

import { GRID_COLS, GRID_ROWS } from './config.js';
import { getTerrainGrid, setTerrainGrid } from './terrain.js';

const SAVE_KEY = 'tinyTown_save';

/**
 * Serialises the current grid, gold, and score to localStorage.
 */
export function saveGame(state) {
    const grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < GRID_COLS; c++) {
            row.push(state.getTile(c, r) || null);
        }
        grid.push(row);
    }
    const data = { grid, gold: state.gold, score: state.score, terrain: getTerrainGrid() };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Loads a saved game into state.
 * Returns true if a valid save was found and applied, false otherwise.
 */
export function loadGame(state) {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.grid)) return false;

        // Restore grid
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const val = data.grid[r]?.[c] ?? null;
                state.setTile(c, r, val);
            }
        }

        state.gold  = typeof data.gold  === 'number' ? data.gold  : state.gold;
        state.score = typeof data.score === 'number' ? data.score : state.score;

        // Restore terrain if present (older saves without terrain are left as-is)
        if (Array.isArray(data.terrain)) {
            setTerrainGrid(data.terrain);
        }

        return true;
    } catch (e) {
        return false;
    }
}

/** Returns true if a save exists in localStorage. */
export function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}
