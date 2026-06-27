/**
 * items.js — Consumable inventory model + use-effect logic (game-plan §8).
 *
 * Consumables are one-off tools the player buys at shop nodes and uses during
 * a level from the in-level item bar. Effects are applied to the grid, deposits,
 * supply, or state as appropriate.
 *
 * Public API:
 *   ItemManager.get(itemId)          — ITEM_DEFS entry
 *   ItemManager.ownedCount(itemId)   — how many the player owns
 *   ItemManager.canUse(itemId)       — owned > 0 (and game context allows it)
 *   ItemManager.use(itemId, target)  — deplete count + apply effect, emit itemUsed
 *   ItemManager.give(itemId, qty)    — add to owned count (shop purchase path)
 *   ITEM_DEFS                        — exported array of item definitions
 */

import { state }  from './state.js';
import { events } from './events.js';

// ── Item definitions (§8 consumable list) ────────────────────────────────────
// Each item's `effect` key routes to the apply logic in ItemManager.use().
// `targetType` describes what the player must click after selecting the item:
//   'cell'   — click a lattice cell  (Dissolvent, Reveal Salts)
//   'shape'  — click a tray shape   (Transmute Vial)
//   'none'   — no targeting needed  (Catalyst)
export const ITEM_DEFS = [
    {
        id: 'dissolvent',
        name: 'Dissolvent',
        glyph: '🧪',
        price: 35,        // affordable early; clears one cell out of a jam
        targetType: 'cell',
        effect: 'dissolve_cell',
        description: 'Clear one filled cell from the lattice.',
        flavor: '"Eats one block clean away."',
    },
    {
        id: 'catalyst',
        name: 'Catalyst',
        glyph: '♺',
        price: 50,        // moderate; saves you from a bad hand
        targetType: 'none',
        effect: 're_deal',
        description: 'Discard the current tray set and deal a fresh one.',
        flavor: '"Re-deal the current set."',
    },
    {
        id: 'transmute',
        name: 'Transmute Vial',
        glyph: '⟐',
        price: 70,        // strong effect — change an ingredient type in hand
        targetType: 'shape',
        effect: 'transmute_shape',
        description: 'Convert a held tray shape to a random other unlocked tile type.',
        flavor: '"Convert a held shape\'s type."',
    },
    {
        id: 'reveal-salts',
        name: 'Reveal Salts',
        glyph: '✶',
        price: 45,        // situationally very useful for deposit quests
        targetType: 'cell',
        effect: 'strip_cover',
        description: 'Strip one cover layer from a chosen deposit cell without a line-clear.',
        flavor: '"Strip one deposit cover."',
    },
];

const ITEM_MAP = new Map(ITEM_DEFS.map(d => [d.id, d]));

// ── ItemManager ───────────────────────────────────────────────────────────────
// Holds runtime references to the game systems it needs to apply effects.
// Call init() at the start of each level.

export class ItemManager {
    constructor() {
        // game-system references set by init()
        this._grid     = null;
        this._deposits = null;
        this._supply   = null;

        // Which item is currently "selected" (waiting for a target click).
        this._selected = null; // itemId | null
    }

    /**
     * Called at the start of each GameScene to wire up the systems.
     * @param {Grid}     grid
     * @param {Deposits} deposits
     * @param {Supply}   supply
     */
    init(grid, deposits, supply) {
        this._grid     = grid;
        this._deposits = deposits;
        this._supply   = supply;
        this._selected = null;
    }

    /** Look up an item definition by id. */
    get(itemId) { return ITEM_MAP.get(itemId) || null; }

    /** How many of itemId the player currently owns. */
    ownedCount(itemId) { return state.itemCount(itemId); }

    /** Returns true if the item is owned and usable right now. */
    canUse(itemId) { return state.itemCount(itemId) > 0; }

    // ── Selection (two-step: select then target) ─────────────────────────────

    /** Select an item for use. Returns false if not owned / unknown. */
    select(itemId) {
        if (!this.canUse(itemId)) return false;
        this._selected = itemId;
        events.emit('itemSelected', { itemId });
        return true;
    }

    /** Cancel any pending selection. */
    cancel() {
        if (!this._selected) return;
        this._selected = null;
        events.emit('itemDeselected', {});
    }

    get selectedItem() { return this._selected; }

    /**
     * Apply the currently selected item to a target, or use a no-target item
     * directly.  `target` shape depends on the item's targetType:
     *   'none'  — call with target = null
     *   'cell'  — { x, y } lattice cell
     *   'shape' — { slot } tray slot index (0–2)
     *
     * Returns true on success, false if the action was rejected.
     */
    use(itemId, target = null) {
        if (!itemId) return false;
        const def = ITEM_MAP.get(itemId);
        if (!def) return false;
        if (!this.canUse(itemId)) return false;

        const ok = this._applyEffect(def, target);
        if (!ok) return false;

        state.depleteItem(itemId);
        this._selected = null;
        events.emit('itemUsed', { itemId });
        return true;
    }

    /**
     * Add `qty` of an item to the player's inventory (shop purchase path).
     */
    give(itemId, qty = 1) {
        if (!ITEM_MAP.has(itemId)) return;
        state.giveItem(itemId, qty);
    }

    // ── Effect implementations ───────────────────────────────────────────────

    _applyEffect(def, target) {
        switch (def.effect) {

            // Remove one filled cell from the grid.
            case 'dissolve_cell': {
                if (!target || !this._grid) return false;
                const { x, y } = target;
                if (!this._grid.isFilled(x, y)) return false;
                this._grid.clearCell(x, y);
                events.emit('cellDissolved', { x, y });
                return true;
            }

            // Re-deal the current tray set from the supply.
            case 're_deal': {
                if (!this._supply) return false;
                this._supply.redeal();
                return true;
            }

            // Transmute one tray shape to a different unlocked tile type.
            case 'transmute_shape': {
                if (!this._supply || target == null) return false;
                const { slot } = target;
                if (slot == null) return false;
                const unlocked = [...state.unlockedTypes];
                if (unlocked.length < 2) return false;
                const result = this._supply.transmuteSlot(slot, unlocked);
                if (!result) return false;
                events.emit('shapTransmuted', { slot });
                return true;
            }

            // Strip one cover layer from a deposit cell without a line-clear.
            case 'strip_cover': {
                if (!target || !this._deposits) return false;
                const { x, y } = target;
                const stripped = this._deposits.stripCoverAt(x, y);
                if (!stripped) return false;
                return true;
            }

            default:
                return false;
        }
    }
}

// Singleton used by GameScene / UIScene.
export const itemManager = new ItemManager();
