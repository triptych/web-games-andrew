/**
 * deposits.js — Buried deposits, cover layers, reveal/harvest (game-plan §5,
 * exploration §11a). Pure data; rendering + flourish live in GameScene/UIScene.
 *
 * A deposit is a connected region of cells of one element, each cell hidden
 * under one or more cover layers. Mechanics (§5):
 *   - Buried cells are NORMAL lattice cells for placement (placeable-over).
 *   - A cover layer strips only when that cell is part of a CLEARING line
 *     (it was filled and its whole row or column completed). One clear strips
 *     ONE layer, per-cell — not per whole deposit.
 *   - When EVERY cell of a deposit is fully uncovered (0 layers), the deposit
 *     HARVESTS: its element + qty bank to stores.
 *
 * The Grid stores blocks; this layer is a parallel per-cell cover map keyed by
 * "x,y" so it never interferes with placement/clear logic in grid.js.
 */

import { events } from './events.js';
import { DEPOSITS } from './config.js';

const key = (x, y) => `${x},${y}`;

export class Deposits {
    /**
     * @param {Array} defs — deposit definitions (see config.DEPOSITS shape).
     */
    constructor(defs = DEPOSITS) {
        // id -> { id, element, qty, cells:[{x,y}], harvested }
        this.byId = new Map();
        // "x,y" -> { depositId, layers }   (only buried cells appear here)
        this.coverAt = new Map();
        // "x,y" -> depositId  (which deposit owns a cell)
        this.ownerAt = new Map();

        for (const def of defs) {
            const dep = {
                id: def.id,
                element: def.element,
                qty: def.qty ?? 1,
                cells: def.cells.map(c => ({ x: c.x, y: c.y })),
                harvested: false,
            };
            this.byId.set(dep.id, dep);
            for (const c of dep.cells) {
                this.coverAt.set(key(c.x, c.y), { depositId: dep.id, layers: def.layers ?? 1 });
                this.ownerAt.set(key(c.x, c.y), dep.id);
            }
        }
    }

    /** All deposits (for rendering / objective tracking). */
    all() { return [...this.byId.values()]; }

    /** Cover layers still on a cell (0 if not buried / fully uncovered). */
    coverLayers(x, y) {
        const c = this.coverAt.get(key(x, y));
        return c ? c.layers : 0;
    }

    /** Is this cell part of a not-yet-harvested deposit (buried or revealed)? */
    isDepositCell(x, y) { return this.ownerAt.has(key(x, y)); }

    /** The deposit owning a cell, or null. */
    depositAt(x, y) {
        const id = this.ownerAt.get(key(x, y));
        return id ? this.byId.get(id) : null;
    }

    /** How many of `dep`'s cells are still covered. */
    _coveredCount(dep) {
        let n = 0;
        for (const c of dep.cells) if (this.coverLayers(c.x, c.y) > 0) n++;
        return n;
    }

    /**
     * Process the cells cleared by a placement (§5). For each cleared cell that
     * still has a cover, strip ONE layer; if a deposit becomes fully uncovered,
     * harvest it. Emits `coverStripped` per stripped cell and `depositHarvested`
     * per harvested deposit.
     *
     * @param {Array<{x:number,y:number}>} clearedCells — from grid.clearLines().
     * @returns {{ stripped:Array, harvested:Array }}
     */
    onLinesCleared(clearedCells) {
        const stripped = [];
        const harvested = [];
        const touchedDeposits = new Set();

        for (const { x, y } of clearedCells) {
            const cover = this.coverAt.get(key(x, y));
            if (!cover || cover.layers <= 0) continue;
            cover.layers -= 1;
            const dep = this.byId.get(cover.depositId);
            touchedDeposits.add(dep.id);
            stripped.push({ depositId: dep.id, cell: { x, y }, layersLeft: cover.layers });
            events.emit('coverStripped', { depositId: dep.id, cell: { x, y }, layersLeft: cover.layers });
            if (cover.layers === 0) this.coverAt.delete(key(x, y));
        }

        // Harvest any touched deposit now fully uncovered.
        for (const id of touchedDeposits) {
            const dep = this.byId.get(id);
            if (dep.harvested) continue;
            if (this._coveredCount(dep) === 0) {
                dep.harvested = true;
                harvested.push({ depositId: dep.id, elementId: dep.element, qty: dep.qty });
                events.emit('depositHarvested', { depositId: dep.id, elementId: dep.element, qty: dep.qty });
            }
        }

        return { stripped, harvested };
    }

    /** Whether a deposit has been fully harvested (for objective tracking). */
    isHarvested(depositId) {
        const dep = this.byId.get(depositId);
        return dep ? dep.harvested : false;
    }

    /** Is a deposit one clear away from harvest? (Vein-Sense / "shiver" hint, §5/§10) */
    isNearlyHarvested(dep) {
        return !dep.harvested && this._coveredCount(dep) === 1
            && dep.cells.filter(c => this.coverLayers(c.x, c.y) > 0)
                   .every(c => this.coverLayers(c.x, c.y) === 1);
    }

    /**
     * Strip one cover layer from a specific cell without a line-clear.
     * Used by the Reveal Salts consumable (§8).
     * Emits coverStripped; if the deposit is now fully revealed, emits depositHarvested.
     * @returns {boolean} true if a layer was stripped.
     */
    stripCoverAt(x, y) {
        const cover = this.coverAt.get(key(x, y));
        if (!cover || cover.layers <= 0) return false;
        cover.layers -= 1;
        const dep = this.byId.get(cover.depositId);
        events.emit('coverStripped', { depositId: dep.id, cell: { x, y }, layersLeft: cover.layers });
        if (cover.layers === 0) this.coverAt.delete(key(x, y));
        if (!dep.harvested && this._coveredCount(dep) === 0) {
            dep.harvested = true;
            events.emit('depositHarvested', { depositId: dep.id, elementId: dep.element, qty: dep.qty });
        }
        return true;
    }
}
