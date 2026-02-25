/**
 * population.js — Population, happiness, and passive income for Tiny Town.
 *
 * Phase 3 rules:
 *   Population:  each house that has at least one adjacent road tile counts as
 *                a connected (occupied) house → +1 population.
 *   Happiness:   each park on the grid adds HAPPINESS_PER_PARK (10%) happiness,
 *                capped at 100%.
 *   Income tick: every INCOME_TICK_SECONDS seconds the player earns
 *                (shopCount × INCOME_PER_SHOP) × incomeMult gold, where
 *                incomeMult = lerp(HAPPINESS_INCOME_MULT_MIN, 1.0, happiness).
 *
 * Exports:
 *   recalcPopulation()   — recomputes population + happiness, updates state
 *   startIncomeTick(k)   — registers a repeating Kaplay timer for passive income
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GRID_COLS, GRID_ROWS,
    INCOME_TICK_SECONDS,
    INCOME_PER_SHOP,
    HAPPINESS_PER_PARK,
    HAPPINESS_INCOME_MULT_MIN,
} from './config.js';

// ---- Neighbour helper (orthogonal, in-bounds) ----
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

function hasAdjacentRoad(col, row) {
    return neighbours(col, row).some(({ col: c, row: r }) => state.getTile(c, r) === 'road');
}

/**
 * Scans the grid and updates state.population and state.happiness.
 * Emits 'populationChanged' and 'happinessChanged' via state setters.
 */
export function recalcPopulation() {
    let pop      = 0;
    let parkCount = 0;
    let shopCount = 0;

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const type = state.getTile(col, row);
            // houses and apartments contribute population when road-connected
            if ((type === 'house' || type === 'apartment') && hasAdjacentRoad(col, row)) pop++;
            if (type === 'park') parkCount++;
            // commercial/civic buildings generate income
            if (type === 'shop' || type === 'office' || type === 'bank' || type === 'government') shopCount++;
        }
    }

    state.population = pop;
    state.happiness  = Math.min(1, parkCount * HAPPINESS_PER_PARK);

    // Cache shop count so the income tick can use it without a full re-scan
    _shopCount = shopCount;
}

// Internal cache updated by recalcPopulation
let _shopCount = 0;

/**
 * Registers a recurring Kaplay timer for passive income.
 * k   — the Kaplay instance (from main.js scene).
 * Returns the cancel function.
 */
export function startIncomeTick(k) {
    function tick() {
        if (state.isPaused || _shopCount === 0) return;

        const mult    = HAPPINESS_INCOME_MULT_MIN + (1 - HAPPINESS_INCOME_MULT_MIN) * state.happiness;
        const earned  = Math.floor(_shopCount * INCOME_PER_SHOP * mult);
        if (earned > 0) {
            state.addGold(earned);
            events.emit('incomeTick', earned);
        }
    }

    // Use a recursive k.wait so it respects scene teardown automatically
    let cancelled = false;
    function schedule() {
        if (cancelled) return;
        k.wait(INCOME_TICK_SECONDS, () => {
            tick();
            schedule();
        });
    }
    schedule();

    return () => { cancelled = true; };
}
