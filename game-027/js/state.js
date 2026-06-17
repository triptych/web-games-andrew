import { events } from './events.js';
import { TILE_TYPE_DEFS, ELEMENTS } from './config.js';

const SAVE_KEY = 'alchemist-lattice-v1';

/**
 * GameState singleton (game-plan §state.js).
 *
 * Phase 1: puzzle-loop state (score/combo/streak).
 * Phase 2: per-level harvested elements.
 * Phase 3: persistent stores (element counts across levels), unlocked tile
 *          types, and cauldron tier. resetLevel() resets only the per-level
 *          state; the persistent layer survives across levels.
 *
 * Setters auto-emit so the HUD stays in sync.
 */

// Element lookup for tier checks.
const ELEM_MAP = new Map(ELEMENTS.map(e => [e.id, e]));

class GameState {
    constructor() {
        this._initPersistent();
        this.resetLevel();
    }

    // --- Persistent state (survives across levels) --------------------------

    /** Call once at new-run start. Resets stores, unlocks, cauldron tier, currency, XP. */
    _initPersistent() {
        // element id → count in stores
        this._stores = new Map();
        // Set of tile-type ids that are currently unlocked
        this._unlockedTypes = new Set(
            TILE_TYPE_DEFS.filter(t => t.startUnlocked).map(t => t.id)
        );
        this._cauldronTier = 1;   // §6 — gates which elements the cauldron can process
        this._currency     = 0;   // §8 — grams earned from node clears, spent in shop
        this._xp           = 0;   // §10 — XP earned, spent in skill tree
        this._runLevelIndex = 0;  // which level in LEVELS the player is on
        // Phase 6: dialog story flags and seen-script registry
        this._dialogFlags  = new Map();
        this._seenScripts  = new Set();
    }

    // --- Per-level reset ----------------------------------------------------

    /** Call at the start of each level. Resets puzzle loop + per-level harvest. */
    resetLevel() {
        this._score    = 0;
        this._combo    = 0;
        this._streak   = 0;
        this._maxCombo = 0;
        this._failed   = false;
        // Per-level harvest tally (shown in the Harvested HUD panel).
        this._harvested = new Map();
    }

    /** Alias used by GameScene (was called reset() in Phase 1). */
    reset() { this.resetLevel(); }

    // --- Score (§3) ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    // --- Combo (within one placement) & streak (across placements) (§3) ---
    get combo()  { return this._combo; }
    get streak() { return this._streak; }
    get maxCombo() { return this._maxCombo; }

    /**
     * Apply the result of a placement to combo/streak.
     * @param {number} linesThisPlacement — rows+cols cleared by this placement.
     */
    applyPlacement(linesThisPlacement) {
        this._combo = linesThisPlacement;
        if (linesThisPlacement > this._maxCombo) this._maxCombo = linesThisPlacement;
        if (linesThisPlacement > 0) {
            this._streak += 1;
        } else {
            this._streak = 0;   // a no-clear placement breaks the streak
        }
        events.emit('comboChanged',  { combo: this._combo });
        events.emit('streakChanged', { streak: this._streak });
    }

    // --- Per-level harvested tally (§5) ------------------------------------
    /** Add `qty` of an element to this level's harvest tally; emits storesChanged. */
    addElement(elementId, qty = 1) {
        const cur = this._harvested.get(elementId) || 0;
        const next = cur + qty;
        this._harvested.set(elementId, next);
        // Also add to persistent stores (banked immediately on harvest, §5).
        this._addToStores(elementId, qty);
        events.emit('storesChanged', { elementId, qty: this.storeCount(elementId) });
    }

    /** Per-level harvest snapshot { elementId: count } (for result screen). */
    get harvested() { return Object.fromEntries(this._harvested); }

    // --- Persistent element stores (§4/§6) ---------------------------------

    _addToStores(elementId, qty) {
        this._stores.set(elementId, (this._stores.get(elementId) || 0) + qty);
    }

    /** How many of elementId are in stores. */
    storeCount(elementId) { return this._stores.get(elementId) || 0; }

    /** Spend elements from stores for a cauldron unlock (§4). Returns false if not affordable. */
    spendElements(recipe) {
        // Check affordability first.
        for (const [id, cost] of Object.entries(recipe)) {
            if (this.storeCount(id) < cost) return false;
        }
        for (const [id, cost] of Object.entries(recipe)) {
            this._stores.set(id, this.storeCount(id) - cost);
            events.emit('storesChanged', { elementId: id, qty: this.storeCount(id) });
        }
        return true;
    }

    /** Full stores snapshot { elementId: count } (for cauldron screen). */
    get stores() { return Object.fromEntries(this._stores); }

    // --- Unlocked tile types (§4) ------------------------------------------

    get unlockedTypes() { return new Set(this._unlockedTypes); }

    isUnlocked(tileTypeId) { return this._unlockedTypes.has(tileTypeId); }

    /** Unlock a tile type (after spending its recipe). Emits tileTypeUnlocked. */
    unlockTileType(tileTypeId, recipe = {}) {
        if (this._unlockedTypes.has(tileTypeId)) return false;
        this._unlockedTypes.add(tileTypeId);
        events.emit('tileTypeUnlocked', { tileTypeId, elementCost: recipe });
        return true;
    }

    // --- Cauldron tier (§6) ------------------------------------------------

    get cauldronTier() { return this._cauldronTier; }

    /** Which element tiers the current cauldron can process. */
    get processableTiers() {
        const tiers = ['common'];
        if (this._cauldronTier >= 2) tiers.push('uncommon');
        if (this._cauldronTier >= 3) tiers.push('rare');
        if (this._cauldronTier >= 4) tiers.push('exotic');
        return tiers;
    }

    /** Whether a recipe is affordable and the cauldron can unlock the type. */
    canUnlock(tileTypeDef) {
        if (this._unlockedTypes.has(tileTypeDef.id)) return false;
        const processable = new Set(this.processableTiers);
        // Check each element in the recipe is of a processable tier.
        for (const elementId of Object.keys(tileTypeDef.recipe)) {
            const elem = ELEM_MAP.get(elementId);
            if (!elem || !processable.has(elem.tier)) return false;
        }
        // Check affordable.
        for (const [id, cost] of Object.entries(tileTypeDef.recipe)) {
            if (this.storeCount(id) < cost) return false;
        }
        return true;
    }

    /** Upgrade cauldron tier (earned on boss clear, §6). */
    upgradeCauldron() {
        this._cauldronTier = Math.min(4, this._cauldronTier + 1);
        events.emit('cauldronUpgraded', { newTier: this._cauldronTier });
    }

    // --- Currency & XP (§8/§10) -------------------------------------------

    get currency() { return this._currency; }

    addCurrency(amount) {
        this._currency = Math.max(0, this._currency + amount);
        events.emit('currencyChanged', this._currency);
    }

    spendCurrency(amount) {
        if (this._currency < amount) return false;
        this._currency -= amount;
        events.emit('currencyChanged', this._currency);
        return true;
    }

    get xp() { return this._xp; }

    addXP(amount) {
        this._xp += amount;
        events.emit('xpChanged', { xp: this._xp });
    }

    // --- Run progression (level index) ------------------------------------

    get runLevelIndex() { return this._runLevelIndex; }

    advanceLevel() {
        this._runLevelIndex += 1;
        this.save();
    }

    // --- Save / Load (localStorage, §9 save scope) ------------------------

    save() {
        try {
            const data = {
                stores:         Object.fromEntries(this._stores),
                unlockedTypes:  [...this._unlockedTypes],
                cauldronTier:   this._cauldronTier,
                currency:       this._currency,
                xp:             this._xp,
                runLevelIndex:  this._runLevelIndex,
                dialogFlags:    Object.fromEntries(this._dialogFlags),
                seenScripts:    [...this._seenScripts],
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (_) { /* quota or private mode — silently ignore */ }
    }

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            this._stores = new Map(Object.entries(data.stores || {}));
            this._unlockedTypes = new Set([
                ...TILE_TYPE_DEFS.filter(t => t.startUnlocked).map(t => t.id),
                ...(data.unlockedTypes || []),
            ]);
            this._cauldronTier  = data.cauldronTier  || 1;
            this._currency      = data.currency      || 0;
            this._xp            = data.xp            || 0;
            this._runLevelIndex = data.runLevelIndex || 0;
            this._dialogFlags   = new Map(Object.entries(data.dialogFlags || {}));
            this._seenScripts   = new Set(data.seenScripts || []);
            return true;
        } catch (_) { return false; }
    }

    clearSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
        this._initPersistent();
    }

    hasSave() {
        try { return localStorage.getItem(SAVE_KEY) !== null; } catch (_) { return false; }
    }

    // --- Flags ---
    get failed() { return this._failed; }
    set failed(v) { this._failed = v; }

    // --- Dialog flags & seen-scripts (§Phase 6) ----------------------------

    /** Persistent story flags set by dialog scripts (e.g. choice branches). */
    setDialogFlag(key, value) {
        this._dialogFlags.set(key, value);
    }
    getDialogFlag(key) { return this._dialogFlags.get(key); }

    /** Mark a script as having been seen (prevents re-firing intros on retry). */
    markScriptSeen(scriptId) {
        this._seenScripts.add(scriptId);
    }
    hasSeenScript(scriptId) { return this._seenScripts.has(scriptId); }
}

export const state = new GameState();
