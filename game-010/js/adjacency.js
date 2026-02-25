/**
 * adjacency.js — Adjacency rule engine for Tiny Town.
 *
 * Rules (Phase 2):
 *   - House adjacent to ≥1 park  → +5 bonus score per house (tracked per tile)
 *   - Shop placement requires ≥1 adjacent road tile
 *
 * Exports:
 *   hasAdjacentRoad(col, row)   → bool   used in main.js before spending gold
 *   recalcBonuses()             → void   recomputes all house-park bonuses in state
 *   HOUSE_PARK_BONUS            → number  bonus per qualifying house
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GRID_COLS, GRID_ROWS } from './config.js';

export const HOUSE_PARK_BONUS = 5;

// ---- Neighbour helpers ----

/** Returns the 4 orthogonal neighbour positions (bounds-clamped). */
function neighbours(col, row) {
    return [
        { col: col - 1, row },
        { col: col + 1, row },
        { col, row: row - 1 },
        { col, row: row + 1 },
    ].filter(({ col: c, row: r }) =>
        c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS
    );
}

/**
 * Returns true if the given cell has at least one orthogonal road neighbour.
 * Uses the live grid in state (call BEFORE placing the new tile).
 */
export function hasAdjacentRoad(col, row) {
    return neighbours(col, row).some(({ col: c, row: r }) => state.getTile(c, r) === 'road');
}

/**
 * Returns true if the given house tile is adjacent to at least one park.
 */
function houseNearPark(col, row) {
    return neighbours(col, row).some(({ col: c, row: r }) => state.getTile(c, r) === 'park');
}

/**
 * Recompute all house-park adjacency bonuses across the entire grid.
 * Updates state.adjacencyBonuses and emits 'adjacencyChanged' with a Set of
 * changed keys so main.js can redraw only affected tiles.
 */
export function recalcBonuses() {
    const prev = state.adjacencyBonuses;       // Map<"col,row", bonus>
    const next = new Map();

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const type = state.getTile(col, row);
            if ((type === 'house' || type === 'apartment') && houseNearPark(col, row)) {
                next.set(`${col},${row}`, HOUSE_PARK_BONUS);
            }
        }
    }

    // Determine which tiles changed (gained or lost bonus)
    const changed = new Set();
    for (const [key] of next) {
        if (!prev.has(key)) changed.add(key);
    }
    for (const [key] of prev) {
        if (!next.has(key)) changed.add(key);
    }

    // Compute score delta
    const oldTotal = [...prev.values()].reduce((a, b) => a + b, 0);
    const newTotal = [...next.values()].reduce((a, b) => a + b, 0);
    const delta = newTotal - oldTotal;

    state.adjacencyBonuses = next;

    if (delta !== 0) {
        // Adjust score by the net change in bonuses
        state.addScore(delta);
    }

    if (changed.size > 0) {
        events.emit('adjacencyChanged', changed);
    }
}
