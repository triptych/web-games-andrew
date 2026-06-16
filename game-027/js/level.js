/**
 * level.js — Level orchestration: objective tracking, win/fail, node rewards.
 * Game-plan Phase 4 (§Phase 4, §Failure 2, §event catalog).
 *
 * LevelManager wraps a level definition (from config.LEVELS) and hooks into
 * the EventBus to watch placements, line clears, and deposits. It emits:
 *   objectiveProgress { kind, cur, target }  — on every update
 *   objectiveMet      { levelId }            — when the win condition is satisfied
 *   objectiveInfeasible { kind, reason }     — Failure 2: clearly unwinnable
 *   levelFailed       { reason:'infeasible'} — after a brief delay post-infeasible
 *
 * GameScene creates one LevelManager in create(), passes it to _commitPlacement,
 * and calls manager.dispose() in shutdown().
 */

import { events } from './events.js';
import { state  } from './state.js';
import { LEVELS  } from './config.js';

export class LevelManager {
    /**
     * @param {object} levelDef — one entry from config.LEVELS
     * @param {object} grid     — Grid instance (for deposit-reachability checks)
     * @param {object} deposits — Deposits instance
     * @param {object} supply   — Supply instance (for supply-exhaustion checks)
     */
    constructor(levelDef, grid, deposits, supply) {
        this.def      = levelDef;
        this.grid     = grid;
        this.deposits = deposits;
        this.supply   = supply;
        this._met     = false;
        this._failed  = false;
        this._offs    = [];

        // Objective-specific live counters.
        this._linesCleared = 0;
        this._scoreHigh    = 0;

        // Subscribe to events that feed objective progress.
        this._offs.push(events.on('linesCleared', (d) => this._onLinesCleared(d)));
        this._offs.push(events.on('scoreChanged',  (s) => this._onScoreChanged(s)));
        this._offs.push(events.on('depositHarvested', (d) => this._onDepositHarvested(d)));

        // Emit initial progress so the HUD shows the objective from the start.
        this._emitProgress();
    }

    // --- Public API ---------------------------------------------------------

    get isMet()    { return this._met; }
    get isFailed() { return this._failed; }

    /**
     * Called after each placement (and after line clears are applied).
     * Checks win + Failure 2 (infeasibility).
     */
    afterPlacement() {
        if (this._met || this._failed) return;
        this._checkWin();
        if (!this._met) this._checkInfeasible();
    }

    /** Cleanup — call in GameScene.shutdown(). */
    dispose() {
        this._offs.forEach(off => off());
        this._offs = [];
    }

    // --- Internal event handlers -------------------------------------------

    _onLinesCleared({ rows, cols }) {
        this._linesCleared += (rows.length + cols.length);
        this._emitProgress();
    }

    _onScoreChanged(score) {
        this._scoreHigh = score;
        this._emitProgress();
    }

    _onDepositHarvested() {
        // Deposit state lives in this.deposits; just re-emit progress.
        this._emitProgress();
    }

    // --- Win check ----------------------------------------------------------

    _checkWin() {
        const obj = this.def.objective;
        if (!obj) return;

        let won = false;
        switch (obj.kind) {
            case 'lines':
                won = this._linesCleared >= obj.target;
                break;
            case 'score':
                won = state.score >= obj.target;
                break;
            case 'harvest': {
                const allHarvested = (obj.depositIds || []).every(id =>
                    this.deposits.isHarvested(id)
                );
                won = allHarvested;
                break;
            }
        }

        if (won) {
            this._met = true;
            events.emit('objectiveMet', { levelId: this.def.id });
        }
    }

    // --- Failure 2: infeasibility check (conservative / cheap, §Failure 2) -

    _checkInfeasible() {
        if (this._failed) return;
        const obj = this.def.objective;
        if (!obj) return;

        const supplyLeft = this.supply.remaining;
        let infeasible = false;
        let reason = '';

        switch (obj.kind) {
            case 'score': {
                // Best-case upper bound: every remaining tile placed + max line clears.
                // If even a perfect run can't reach the target, we're done.
                const cellsLeft = supplyLeft * 3; // avg ~2.5 but use 3 for generosity
                const bestCaseScore = state.score + cellsLeft * 10 * 4; // 4× combo ceiling
                if (supplyLeft === 0 && state.score < obj.target) {
                    infeasible = true;
                    reason = 'score target unreachable — supply exhausted';
                } else if (bestCaseScore < obj.target) {
                    infeasible = true;
                    reason = 'score target unreachable even with a perfect run';
                }
                break;
            }
            case 'lines': {
                const linesLeft = obj.target - this._linesCleared;
                // Each line needs at least 9 placed cells; remaining supply gives an
                // upper bound on how many cells we can still place.
                const cellsLeft = supplyLeft * 4; // generous upper bound
                const bestCaseLines = Math.floor(cellsLeft / 3); // very rough
                if (supplyLeft === 0 && linesLeft > 0) {
                    infeasible = true;
                    reason = 'cannot clear enough lines — supply exhausted';
                } else if (bestCaseLines < linesLeft && supplyLeft < 3) {
                    infeasible = true;
                    reason = 'not enough tiles left to clear the required lines';
                }
                break;
            }
            case 'harvest': {
                // Infeasible if any required deposit can no longer be harvested
                // (all its cells are permanently inaccessible — conservative: only
                // flag when supply is gone and the deposit is still covered).
                if (supplyLeft === 0) {
                    const impossible = (obj.depositIds || []).some(id =>
                        !this.deposits.isHarvested(id)
                    );
                    if (impossible) {
                        infeasible = true;
                        reason = 'required deposit unreachable — supply exhausted';
                    }
                }
                break;
            }
        }

        if (infeasible && !this._failed) {
            this._failed = true;
            events.emit('objectiveInfeasible', { kind: obj.kind, reason });
            // Brief delay so the player sees the last placement before the screen cuts.
            setTimeout(() => {
                events.emit('levelFailed', { reason: 'infeasible' });
            }, 800);
        }
    }

    // --- Progress telemetry -------------------------------------------------

    _emitProgress() {
        const obj = this.def.objective;
        if (!obj) return;

        let cur = 0, target = obj.target || 0;
        switch (obj.kind) {
            case 'lines':
                cur = this._linesCleared; target = obj.target; break;
            case 'score':
                cur = state.score; target = obj.target; break;
            case 'harvest': {
                const ids = obj.depositIds || [];
                cur    = ids.filter(id => this.deposits.isHarvested(id)).length;
                target = ids.length;
                break;
            }
        }
        events.emit('objectiveProgress', { kind: obj.kind, cur, target });
    }
}

// --- Convenience: find a level def by index (the current run progression) ---

/** Return the level def for 0-based run index, wrapping at the end. */
export function getLevelDef(index) {
    return LEVELS[index % LEVELS.length];
}

/** Human-readable objective label for the top bar. */
export function objectiveLabel(obj) {
    if (!obj) return 'Play on';
    switch (obj.kind) {
        case 'lines':   return `Clear ${obj.target} lines`;
        case 'score':   return `Reach ${obj.target} pts`;
        case 'harvest': return `Harvest ${obj.depositIds.length} deposit${obj.depositIds.length === 1 ? '' : 's'}`;
        default:        return 'Play on';
    }
}
