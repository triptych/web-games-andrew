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

import { TRAY_SIZE, SUPPLY_TILES, TILE_TYPES, TILE_TYPE_DEFS, TIER_WEIGHTS, SMALL_TILE_FLOOR } from './config.js';
import { SMALL_IDS, MONO_ID, getShape } from './pieces.js';
import { events } from './events.js';
import { state } from './state.js';

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
     * Build a flat pool using §4 Supply defaults (Phase 3+).
     *
     * - Shape ids drawn from UNLOCKED tile types, weighted by rarity tier
     *   (TIER_WEIGHTS: common 60 / uncommon 25 / rare 12 / exotic 3).
     * - SMALL_TILE_FLOOR: ≥40% of tiles are 1–2 cell shapes (mono/domino).
     * - MIN_MONOMINOES = 1: at least one monomino guaranteed.
     * - Tile element-type (color/glyph) is a random unlocked TILE_TYPE.
     */
    _seedPool(n) {
        // Build weighted id lists for shape selection.
        const byRarity = { common: [], uncommon: [], rare: [], exotic: [] };
        for (const def of TILE_TYPE_DEFS) {
            if (!state.isUnlocked(def.id)) continue;
            const r = def.rarity || 'common';
            if (byRarity[r]) byRarity[r].push(def.id);
        }
        // Fallback: if nothing unlocked, use mono.
        if (!Object.values(byRarity).some(arr => arr.length > 0)) {
            byRarity.common = [MONO_ID];
        }

        // Small tiles = shapes with ≤2 cells that are unlocked.
        const smallIds = SMALL_IDS.filter(id => state.isUnlocked(id));
        if (smallIds.length === 0) smallIds.push(MONO_ID);

        const smallCount = Math.max(1, Math.floor(n * SMALL_TILE_FLOOR));
        const pool = [];

        // ≥1 monomino
        pool.push(this._makeTile(MONO_ID));

        // Small filler tiles
        for (let i = 1; i < smallCount; i++) {
            pool.push(this._makeTile(this._pick(smallIds)));
        }

        // Remaining tiles — tier-weighted random from unlocked shapes.
        const totalWeight = Object.entries(TIER_WEIGHTS)
            .filter(([r]) => byRarity[r] && byRarity[r].length > 0)
            .reduce((s, [, w]) => s + w, 0);

        for (let i = smallCount; i < n; i++) {
            pool.push(this._makeTile(this._pickWeighted(byRarity, totalWeight)));
        }

        // Fisher–Yates shuffle.
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool;
    }

    /** Pick a random tile type id using TIER_WEIGHTS across unlocked shapes. */
    _pickWeighted(byRarity, totalWeight) {
        let r = this.rng() * totalWeight;
        for (const [tier, weight] of Object.entries(TIER_WEIGHTS)) {
            const ids = byRarity[tier];
            if (!ids || ids.length === 0) continue;
            r -= weight;
            if (r <= 0) return this._pick(ids);
        }
        // Fallback
        const all = Object.values(byRarity).flat();
        return this._pick(all.length ? all : [MONO_ID]);
    }

    _makeTile(shapeId) {
        // Use a matching TILE_TYPE by element id if the shape id matches, else random.
        const tileType = this._pick(TILE_TYPES).id;
        return { shapeId, tileType };
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

    /**
     * Re-deal the current hand from the pool (Catalyst consumable, §8).
     * The existing hand tiles are discarded (not returned to the pool — they're
     * spent). Then deal a fresh set. If the pool is empty, does nothing.
     * @param {Grid} grid — for deal-fairness; may be omitted.
     */
    redeal(grid) {
        // Discard any remaining held tiles (slots not yet placed).
        this.hand = new Array(TRAY_SIZE).fill(null);
        this.deal(grid);
    }

    /**
     * Return all held (non-null) shapes back to the pool and clear the hand.
     * Used by the Reclaim passive (§10): the hand tiles are not consumed, just
     * returned to the top of the pool so they can be re-dealt.
     */
    returnToPool(shapeId) {
        // Find and remove matching hand slot.
        for (let i = 0; i < this.hand.length; i++) {
            if (this.hand[i] && this.hand[i].shapeId === shapeId) {
                this.pool.unshift(this.hand[i]); // return to front of pool
                this.hand[i] = null;
                return;
            }
        }
    }

    /**
     * Transmute the tile in `slot` to a different tile type chosen from `unlockedIds`.
     * Used by the Transmute Vial consumable (§8).
     * @param {number}   slot       — 0–2
     * @param {string[]} unlockedIds — array of unlocked tile-type ids
     * @returns {boolean} true if the slot was transmuted.
     */
    transmuteSlot(slot, unlockedIds) {
        const tile = this.hand[slot];
        if (!tile) return false;
        // Pick a different type.
        const others = unlockedIds.filter(id => id !== tile.tileType);
        if (others.length === 0) return false;
        tile.tileType = others[Math.floor(this.rng() * others.length)];
        // Re-emit setDealt so the HUD redraws the tray.
        events.emit('setDealt', {
            shapes: this.hand.map((t, i) => t ? { slot: i, shapeId: t.shapeId, tileType: t.tileType } : null)
                             .filter(Boolean),
        });
        return true;
    }
}
