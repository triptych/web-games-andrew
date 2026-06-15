/**
 * supply.js — Per-level finite tile supply (game-plan §2/§4 + §supply.js).
 *
 * Phase 1 placeholder: a flat, seed-deterministic pool (real sizing/rarity mix
 * from §4 "Supply defaults" lands with the cauldron in Phase 3). Responsibilities:
 *   - hold the remaining tile pool (each entry = a {shapeId, tileType})
 *   - deal SETS OF 3 (TRAY_SIZE); the player must place all 3 before redealing
 *   - deal-fairness ordering: prefer a set with ≥1 placeable shape when the
 *     remaining pool allows (§Failure 1 deal-fairness rule)
 *   - emit setDealt / supplyChanged
 *
 * `hand` is the current up-to-3 shapes the player holds; a placed slot becomes
 * null until the whole hand empties, then the next set is dealt.
 */

import { TRAY_SIZE, SUPPLY_TILES, TILE_TYPES } from './config.js';
import { SHAPE_IDS, SMALL_IDS, MONO_ID, getShape } from './pieces.js';
import { events } from './events.js';

// --- Tiny seeded RNG (mulberry32) for deterministic, retryable deals ---
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Supply {
    /**
     * @param {number} seed  — level seed; same seed re-deals the identical sequence.
     * @param {number} total — number of tiles in the pool (rounded up to a whole
     *                         number of sets so the last hand is never partial, §4).
     */
    constructor(seed = 1, total = SUPPLY_TILES) {
        this.rng = mulberry32(seed);
        const sets = Math.ceil(total / TRAY_SIZE);
        this.pool = this._seedPool(sets * TRAY_SIZE);
        this.hand = new Array(TRAY_SIZE).fill(null); // {shapeId, tileType} | null
    }

    get remaining() {
        return this.pool.length + this.hand.filter(Boolean).length;
    }

    _pick(arr) {
        return arr[Math.floor(this.rng() * arr.length)];
    }

    /**
     * Build a flat pool. Phase 1 mix (light version of §4 floors): guarantee a
     * decent fraction of small "filler" tiles so the opening is always playable,
     * including ≥1 monomino; the rest is a uniform roll over all shapes.
     */
    _seedPool(n) {
        const pool = [];
        const smallCount = Math.max(1, Math.floor(n * 0.4)); // SMALL_TILE_FLOOR ≈ 0.4

        // ≥1 monomino (MIN_MONOMINOES = 1)
        pool.push(this._makeTile(MONO_ID));
        for (let i = 1; i < smallCount; i++) pool.push(this._makeTile(this._pick(SMALL_IDS)));
        for (let i = smallCount; i < n; i++)  pool.push(this._makeTile(this._pick(SHAPE_IDS)));

        // Fisher–Yates shuffle with the seeded rng.
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool;
    }

    _makeTile(shapeId) {
        const tt = this._pick(TILE_TYPES).id;
        return { shapeId, tileType: tt };
    }

    /** Shape ids currently held (nulls filtered out). */
    heldShapeIds() {
        return this.hand.filter(Boolean).map(t => t.shapeId);
    }

    handEmpty() {
        return this.hand.every(s => s === null);
    }

    /** Remove the tile in `slot` (after a successful placement). */
    consumeSlot(slot) {
        this.hand[slot] = null;
        events.emit('supplyChanged', { remaining: this.remaining });
    }

    /**
     * Deal a fresh set of TRAY_SIZE from the pool. Applies deal-fairness: if the
     * pool still has alternatives, prefer a draw whose first slot is placeable on
     * the given grid, so a deal-time jam only fires on a genuinely full board.
     * @param {Grid} grid — current lattice (for the fairness check); may be omitted.
     * @returns {boolean} true if any tiles were dealt.
     */
    deal(grid) {
        if (this.pool.length === 0) return false;

        const count = Math.min(TRAY_SIZE, this.pool.length);
        let chosen = this.pool.splice(0, count);

        // Deal-fairness: if none of the chosen shapes fits and the pool has more
        // options, try to swap in a placeable shape from the remaining pool.
        if (grid && this.pool.length > 0) {
            const fits = (t) => grid.hasAnyPlacement(getShape(t.shapeId));
            if (!chosen.some(fits)) {
                const idx = this.pool.findIndex(fits);
                if (idx >= 0) {
                    // swap the placeable tile into the hand, return a dud to the pool
                    const placeable = this.pool.splice(idx, 1)[0];
                    this.pool.push(chosen[0]);
                    chosen[0] = placeable;
                }
            }
        }

        this.hand = new Array(TRAY_SIZE).fill(null);
        chosen.forEach((tile, i) => { this.hand[i] = tile; });

        events.emit('setDealt', {
            shapes: this.hand.map((t, slot) => t ? { slot, shapeId: t.shapeId, tileType: t.tileType } : null)
                             .filter(Boolean),
        });
        events.emit('supplyChanged', { remaining: this.remaining });
        return true;
    }
}
