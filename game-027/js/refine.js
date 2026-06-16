/**
 * refine.js — Refinement level overlay (game-plan §11b, Phase 5).
 *
 * A refinement level turns the lattice into a brewing surface: the goal is to
 * satisfy a recipe's conditions through how you clear lines. Three condition types:
 *   'ember_rows'    — clear N rows that contain ≥ M ember-type cells
 *   'combo'         — achieve a single placement that clears ≥ N lines (×N combo)
 *   'forbidden'     — do NOT clear any line that contains forbidden tile type(s)
 *
 * Quality grade climbs from CRUDE → FINE → PURE → MASTERWORK based on:
 *   - all conditions met        → at least CRUDE (base)
 *   - combos × clearing efficiency
 *
 * Enhancement ingredients (optional, spent from stores before the level starts)
 * can raise the quality ceiling or ease conditions. They are declared in the
 * level def's `enhancements` array: { ingredientId, effect }
 *   effect: 'quality_boost'  — raises final quality by 1 grade
 *           'combo_ease'     — required combo conditions reduced by 1
 *           'allow_one_forbidden' — one forbidden-line infraction forgiven
 *
 * RefinementManager is created by GameScene alongside LevelManager (for refine
 * levels). It hooks into the EventBus and exposes:
 *   qualityGrade        — 'crude' | 'fine' | 'pure' | 'masterwork'
 *   conditionsAll       — true when all required conditions are met
 *   afterPlacement()    — call after each placement (win/fail check)
 *   dispose()
 *
 * Events emitted:
 *   recipeConditionMet  { conditionId }
 *   qualityChanged      { grade, value }   (value 0–100)
 *   potionBrewed        { potionId, grade }
 */

import { events } from './events.js';
import { state }  from './state.js';

export const QUALITY_GRADES = ['crude', 'fine', 'pure', 'masterwork'];

export class RefinementManager {
    /**
     * @param {object} levelDef  — level definition with `recipe` field
     * @param {object} grid      — Grid instance
     */
    constructor(levelDef, grid) {
        this.def   = levelDef;
        this.grid  = grid;
        this._met  = false;
        this._offs = [];

        const recipe = levelDef.recipe || {};
        this._potionId   = recipe.potionId   || 'unknown-potion';
        this._conditions = (recipe.conditions || []).map(c => ({ ...c, satisfied: false }));
        this._qualityValue = 0;   // 0–100
        this._forbiddenInfractions = 0;
        this._forbiddenForgiven    = 0;   // from enhancements
        this._qualityBoostGrades   = 0;   // from enhancements
        this._totalCombos          = 0;
        this._totalLineClearings   = 0;

        // Apply active enhancements (player already committed to spending them).
        for (const enh of (levelDef.activeEnhancements || [])) {
            if (enh.effect === 'quality_boost')        this._qualityBoostGrades += 1;
            if (enh.effect === 'allow_one_forbidden')   this._forbiddenForgiven += 1;
            if (enh.effect === 'combo_ease') {
                for (const c of this._conditions) {
                    if (c.type === 'combo') c.target = Math.max(1, c.target - 1);
                }
            }
        }

        // crucible cells: optional highlighted cells in the recipe for visual only.
        this._crucibleCells = recipe.crucibleCells || [];

        this._offs.push(events.on('linesCleared', (d) => this._onLinesCleared(d)));

        // Emit initial state so the HUD can draw.
        this._emitQuality();
        this._emitConditions();
    }

    // --- Public API -----------------------------------------------------------

    get isMet()          { return this._met; }
    get qualityGrade()   { return this._gradeFromValue(this._qualityValue); }
    get conditions()     { return this._conditions; }
    get crucibleCells()  { return this._crucibleCells; }
    get conditionsAll()  { return this._conditions.every(c => c.satisfied); }

    afterPlacement() {
        if (this._met) return;
        if (this.conditionsAll) {
            this._met = true;
            const finalGrade = this._finalGrade();
            events.emit('potionBrewed', { potionId: this._potionId, grade: finalGrade });
        }
    }

    dispose() {
        this._offs.forEach(off => off());
        this._offs = [];
    }

    // --- Event handling -------------------------------------------------------

    _onLinesCleared({ rows, cols, cells, combo }) {
        const lines = rows.length + cols.length;
        if (lines === 0) return;
        this._totalLineClearings += 1;

        // Check combo condition.
        if (combo >= 2) {
            this._totalCombos += 1;
            for (const c of this._conditions) {
                if (c.type === 'combo' && !c.satisfied && combo >= c.target) {
                    c.satisfied = true;
                    events.emit('recipeConditionMet', { conditionId: c.id });
                }
            }
        }

        // Gather tile types for cleared cells.
        const clearedTypes = cells.map(({ x, y }) => {
            const cell = this.grid.cells[y] && this.grid.cells[y][x];
            return cell ? cell.tileType : null;
        });

        // Check ingredient-row conditions (e.g. "clear 3 rows containing ember").
        for (const c of this._conditions) {
            if (c.type === 'ingredient_rows' && !c.satisfied) {
                // Count rows cleared where ≥ 1 cell is the required type.
                let matchingRows = 0;
                for (const rowIdx of rows) {
                    const rowTypes = cells.filter(cell => cell.y === rowIdx).map(cell => {
                        const gc = this.grid.cells[cell.y] && this.grid.cells[cell.y][cell.x];
                        return gc ? gc.tileType : null;
                    });
                    if (rowTypes.some(t => t === c.ingredient)) matchingRows++;
                }
                if (!c._progress) c._progress = 0;
                c._progress += matchingRows;
                if (c._progress >= c.target) {
                    c.satisfied = true;
                    events.emit('recipeConditionMet', { conditionId: c.id });
                }
                this._emitConditions();
            }
        }

        // Check forbidden conditions: fail if any cleared line contains forbidden type.
        for (const c of this._conditions) {
            if (c.type === 'forbidden' && !c.satisfied) {
                const allCleared = cells.map(({ x, y }) => {
                    const gc = this.grid.cells[y] && this.grid.cells[y][x];
                    return gc ? gc.tileType : null;
                });
                if (allCleared.some(t => t === c.ingredient)) {
                    // Infraction! Check if forgiven by enhancement.
                    if (this._forbiddenInfractions < this._forbiddenForgiven) {
                        this._forbiddenInfractions++;
                        // Don't fail; but note — forbidden condition cannot be "satisfied"
                        // (it's a constraint, not a goal; satisfied = "constraint still holds").
                    } else {
                        c.satisfied = false;
                        c.violated  = true;
                        this._emitConditions();
                    }
                } else {
                    // Still clean.
                    c.satisfied = true;
                    events.emit('recipeConditionMet', { conditionId: c.id });
                    this._emitConditions();
                }
            }
        }

        // Update quality value based on combos and line-clearing efficiency.
        this._updateQuality(lines, combo);
    }

    _updateQuality(lines, combo) {
        // Quality climbs with combos and clearing placements.
        const comboBonus    = combo >= 3 ? 18 : combo >= 2 ? 10 : 3;
        const efficiencyAdd = lines >= 2 ? 6 : 3;
        this._qualityValue  = Math.min(100, this._qualityValue + comboBonus + efficiencyAdd);
        this._emitQuality();
    }

    _finalGrade() {
        let gradeIdx = QUALITY_GRADES.indexOf(this._gradeFromValue(this._qualityValue));

        // Boost from enhancements.
        gradeIdx = Math.min(QUALITY_GRADES.length - 1, gradeIdx + this._qualityBoostGrades);

        // Penalise violated forbidden conditions.
        const violated = this._conditions.filter(c => c.type === 'forbidden' && c.violated).length;
        gradeIdx = Math.max(0, gradeIdx - violated);

        return QUALITY_GRADES[gradeIdx];
    }

    _gradeFromValue(v) {
        if (v >= 85) return 'masterwork';
        if (v >= 60) return 'pure';
        if (v >= 35) return 'fine';
        return 'crude';
    }

    _emitQuality() {
        events.emit('qualityChanged', { grade: this._gradeFromValue(this._qualityValue), value: this._qualityValue });
    }

    _emitConditions() {
        events.emit('recipeConditionsUpdated', { conditions: this._conditions });
    }
}
