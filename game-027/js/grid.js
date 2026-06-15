/**
 * grid.js — Lattice data model + line-clear + stuck detection.
 * (game-plan §1 / §3 / §grid.js). Pure data; rendering lives in GameScene.
 *
 * Cell value:
 *   null            — empty
 *   { tileType }    — filled, tinted by its tile type id (§UI)
 *
 * Phase 1 has no "buried"/deposit state (Phase 2).
 */

import { GRID_W, GRID_H } from './config.js';
import { getShape } from './pieces.js';

export class Grid {
    constructor(w = GRID_W, h = GRID_H) {
        this.w = w;
        this.h = h;
        this.cells = Array.from({ length: h }, () => new Array(w).fill(null));
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    isEmpty(x, y) {
        return this.inBounds(x, y) && this.cells[y][x] === null;
    }

    /**
     * Can `shape` be placed with its origin at (ox, oy)?
     * All cells must land in-bounds on empty lattice cells.
     */
    canPlace(shape, ox, oy) {
        for (const c of shape.cells) {
            if (!this.isEmpty(ox + c.x, oy + c.y)) return false;
        }
        return true;
    }

    /**
     * Place `shape` at (ox, oy), tinted by tileType. Returns the list of
     * absolute cells filled. Caller is responsible for having validated.
     */
    place(shape, ox, oy, tileType) {
        const filled = [];
        for (const c of shape.cells) {
            const x = ox + c.x, y = oy + c.y;
            this.cells[y][x] = { tileType };
            filled.push({ x, y });
        }
        return filled;
    }

    /**
     * Detect & remove any fully-filled rows and columns (simultaneously, §3).
     * Returns { rows, cols, cells } where `cells` is the de-duplicated set of
     * cleared cell coordinates. Combo = rows.length + cols.length.
     */
    clearLines() {
        const rows = [];
        const cols = [];

        for (let y = 0; y < this.h; y++) {
            if (this.cells[y].every(c => c !== null)) rows.push(y);
        }
        for (let x = 0; x < this.w; x++) {
            let full = true;
            for (let y = 0; y < this.h; y++) {
                if (this.cells[y][x] === null) { full = false; break; }
            }
            if (full) cols.push(x);
        }

        // Collect the cells to clear (de-duped, since a row/col can overlap).
        const key = (x, y) => y * this.w + x;
        const set = new Map();
        for (const y of rows) for (let x = 0; x < this.w; x++) set.set(key(x, y), { x, y });
        for (const x of cols) for (let y = 0; y < this.h; y++) set.set(key(x, y), { x, y });

        const cells = [...set.values()];
        for (const { x, y } of cells) this.cells[y][x] = null;

        return { rows, cols, cells };
    }

    /**
     * Does `shape` have ANY legal placement anywhere? (jam check, §Failure 1)
     */
    hasAnyPlacement(shape) {
        for (let oy = 0; oy <= this.h - shape.h; oy++) {
            for (let ox = 0; ox <= this.w - shape.w; ox++) {
                if (this.canPlace(shape, ox, oy)) return true;
            }
        }
        return false;
    }

    /**
     * Count legal placements for `shape` (used for the near-stuck HUD warning,
     * §Failure 1 "flag a held shape with very few legal spots").
     */
    countPlacements(shape) {
        let n = 0;
        for (let oy = 0; oy <= this.h - shape.h; oy++) {
            for (let ox = 0; ox <= this.w - shape.w; ox++) {
                if (this.canPlace(shape, ox, oy)) n++;
            }
        }
        return n;
    }

    /**
     * Given the shape ids still in hand, can at least one be placed somewhere?
     */
    anyHeldFits(shapeIds) {
        return shapeIds.some(id => id && this.hasAnyPlacement(getShape(id)));
    }
}
