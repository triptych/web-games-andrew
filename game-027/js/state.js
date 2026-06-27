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

// Generate a pseudo-random integer seed from current time + noise.
function _makeSeed() {
    return (Date.now() ^ (Math.random() * 0x7fffffff | 0)) >>> 0;
}

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
        this._runLevelIndex = 0;  // which level in LEVELS the player is on (legacy linear)
        // Phase 6: dialog story flags and seen-script registry
        this._dialogFlags  = new Map();
        this._seenScripts  = new Set();
        // Phase 7: run-map state
        this._runSeed    = _makeSeed();
        this._runChapter = 1;
        this._runMap     = null; // { mapData, currentNodeId, visitedIds, committedPath }
        // Phase 8: owned consumable item counts (item id → count)
        this._items = new Map();
        // Phase 9: unlocked skill-tree passives
        this._unlockedSkills = new Set();
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

    // --- Owned consumable items (§8) --------------------------------------

    /** How many of itemId the player owns. */
    itemCount(itemId) { return this._items.get(itemId) || 0; }

    /** Add qty of itemId to inventory; emits itemCountChanged. */
    giveItem(itemId, qty = 1) {
        const next = (this._items.get(itemId) || 0) + qty;
        this._items.set(itemId, next);
        events.emit('itemCountChanged', { itemId, count: next });
    }

    /** Use one of itemId (count → 0 min). Returns false if not owned. */
    depleteItem(itemId) {
        const cur = this._items.get(itemId) || 0;
        if (cur <= 0) return false;
        const next = cur - 1;
        this._items.set(itemId, next);
        events.emit('itemCountChanged', { itemId, count: next });
        return true;
    }

    /** Full item inventory snapshot { itemId: count }. */
    get items() { return Object.fromEntries(this._items); }

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
        if (amount <= 0) return;
        this._xp += amount;
        events.emit('xpChanged', { xp: this._xp });
    }

    /** Spend XP for a skill unlock. Returns false if insufficient. */
    spendXP(amount) {
        if (this._xp < amount) return false;
        this._xp -= amount;
        events.emit('xpChanged', { xp: this._xp });
        return true;
    }

    // --- Skill tree (§10) --------------------------------------------------

    isSkillUnlocked(skillId) { return this._unlockedSkills.has(skillId); }

    /** Mark a skill as unlocked (called by skilltree.unlock after spending XP). */
    unlockSkill(skillId) {
        this._unlockedSkills.add(skillId);
        this.save();
    }

    get unlockedSkills() { return new Set(this._unlockedSkills); }

    /**
     * Award XP for in-level actions (§10).
     * combo: lines cleared in one placement (0 = no clear)
     * type: 'clear' | 'harvest' | 'node' | 'boss'
     */
    awardXP(type, combo = 0) {
        let base = 0;
        switch (type) {
            // 3 base + 2 per extra line cleared (combo=1 → 3, combo=2 → 5, combo=3 → 7)
            case 'clear':   base = 3 + Math.max(0, combo - 1) * 2; break;
            case 'harvest': base = 12;  break;   // harvesting a deposit feels meaningful
            case 'node':    base = 25;  break;   // node completion bonus
            case 'boss':    base = 80;  break;   // boss is a big milestone
        }
        // Surge passive: +6 bonus XP on any combo (2+ lines cleared in one placement)
        if (type === 'clear' && combo >= 2 && this._unlockedSkills.has('surge')) {
            base += 6;
        }
        if (base > 0) this.addXP(base);
    }

    // --- Run progression (level index — legacy linear fallback) -------------

    get runLevelIndex() { return this._runLevelIndex; }

    advanceLevel() {
        this._runLevelIndex += 1;
        this.save();
    }

    // --- Run-map state (Phase 7) -------------------------------------------

    get runSeed()    { return this._runSeed; }
    get runChapter() { return this._runChapter; }
    get runMap()     { return this._runMap; }

    /**
     * Call once when a new run map is generated.
     * Sets up the tracking object; currentNodeId=null means we haven't entered
     * any node yet — MapScene treats this as "show entry node as forward choice".
     */
    initRunMap(mapData) {
        this._runMap = {
            mapData,
            currentNodeId:  null,
            visitedIds:     new Set(),
            committedPath:  [],
        };
        this.save();
    }

    /**
     * Player commits to a node (clicks it on the map).
     * Marks the prior currentNodeId as visited and sets the new one.
     */
    commitNode(nodeId) {
        if (!this._runMap) return;
        if (this._runMap.currentNodeId) {
            this._runMap.visitedIds.add(this._runMap.currentNodeId);
        }
        this._runMap.currentNodeId = nodeId;
        this._runMap.committedPath.push(nodeId);
        this.save();
    }

    /**
     * Called when a non-puzzle node (shop/cache) resolves without going to
     * GameScene — marks it complete and clears currentNodeId so the map shows
     * forward choices again.
     */
    resolveNode(nodeId) {
        if (!this._runMap) return;
        this._runMap.visitedIds.add(nodeId);
        this._runMap.currentNodeId = nodeId;
        this.save();
    }

    /**
     * Called by GameScene on win — marks the node done, advances rewards.
     * If it's the boss node, upgrades the cauldron and advances the chapter.
     * @param {string} nodeId
     * @param {object} rewards — { currency, xp }
     * @param {boolean} isBoss
     */
    resolveGameNode(nodeId, rewards = {}, isBoss = false) {
        if (!this._runMap) return;
        this._runMap.visitedIds.add(nodeId);
        this._runMap.currentNodeId = nodeId;
        if (rewards.currency) this.addCurrency(rewards.currency);
        if (rewards.xp)       this.addXP(rewards.xp);
        if (isBoss) {
            this.upgradeCauldron();
            this._runChapter += 1;
            // Queue the chapter intro dialog for the next MapScene visit.
            const introId = `ch${this._runChapter}-intro`;
            this._dialogFlags.set('pendingIntro', introId);
            // Clear the map so the next MapScene visit regenerates it.
            this._runMap = null;
            this._runSeed = _makeSeed();
        }
        this._runLevelIndex += 1;
        this.save();
    }

    /** True when the boss node has been visited (chapter complete). */
    isChapterComplete() {
        if (!this._runMap) return false;
        const { mapData, visitedIds } = this._runMap;
        return visitedIds.has(mapData.bossNodeId);
    }

    // --- Save / Load (localStorage, §9 save scope) ------------------------

    save() {
        try {
            const mapSnapshot = this._runMap ? {
                mapData:       this._runMap.mapData,
                currentNodeId: this._runMap.currentNodeId,
                visitedIds:    [...this._runMap.visitedIds],
                committedPath: this._runMap.committedPath,
            } : null;

            const data = {
                stores:         Object.fromEntries(this._stores),
                unlockedTypes:  [...this._unlockedTypes],
                cauldronTier:   this._cauldronTier,
                currency:       this._currency,
                xp:             this._xp,
                runLevelIndex:  this._runLevelIndex,
                dialogFlags:    Object.fromEntries(this._dialogFlags),
                seenScripts:    [...this._seenScripts],
                // Phase 7
                runSeed:        this._runSeed,
                runChapter:     this._runChapter,
                runMap:         mapSnapshot,
                // Phase 8
                items:          Object.fromEntries(this._items),
                // Phase 9
                unlockedSkills: [...this._unlockedSkills],
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
            // Phase 7
            this._runSeed    = data.runSeed    || _makeSeed();
            this._runChapter = data.runChapter || 1;
            this._items          = new Map(Object.entries(data.items || {}));
            this._unlockedSkills = new Set(data.unlockedSkills || []);
            if (data.runMap) {
                this._runMap = {
                    mapData:       data.runMap.mapData,
                    currentNodeId: data.runMap.currentNodeId || null,
                    visitedIds:    new Set(data.runMap.visitedIds || []),
                    committedPath: data.runMap.committedPath || [],
                };
            } else {
                this._runMap = null;
            }
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
