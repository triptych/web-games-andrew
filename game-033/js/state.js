import { events } from './events.js';
import {
    STARTING_STATS, STARTING_INVENTORY, STARTING_DAY, SAVE_KEY, xpToNextLevel,
    ITEM_DEFS, BREW_RECIPES, recipeIsKnown,
} from './config.js';

const EQUIP_SLOTS = ['trinket', 'charm'];

/**
 * Global game state.
 * Setters auto-emit events so UI/VN renderer stays in sync.
 * Call state.reset() to start a fresh game.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._stats = { ...STARTING_STATS };
        this._inventory = STARTING_INVENTORY.map(i => ({ ...i }));
        this._equipped = {}; // slot -> itemId ("trinket" from Phase 1, "charm" added in Phase 3)
        this._flags = {};    // storyFlagName -> value
        this._affinity = {}; // npcId -> number
        this._currentNodeId = 'start';
        this._visitedNodes = new Set();
        this._day = STARTING_DAY;   // Phase 6: the season advances when you rest
        this._quests = {};          // questId -> 'active' | 'done'
        this._lore = [];            // ordered list of collected lore ids
    }

    // --- Stats ---
    get stats() { return this._stats; }

    get effectiveStats() {
        // Base stats + bonuses/penalties from equipped items (one item per
        // slot; Phase 3 adds a second "charm" slot alongside "trinket", and
        // some charm items trade a bonus in one stat for a penalty in another).
        const eff = { ...this._stats };
        for (const itemId of Object.values(this._equipped)) {
            const def = ITEM_DEFS[itemId];
            if (!def) continue;
            if (def.bonus) {
                for (const [k, v] of Object.entries(def.bonus)) {
                    eff[k] = (eff[k] || 0) + v;
                }
            }
            if (def.penalty) {
                for (const [k, v] of Object.entries(def.penalty)) {
                    eff[k] = (eff[k] || 0) - v;
                }
            }
        }
        return eff;
    }

    addXp(amount) {
        this._stats.xp += amount;
        events.emit('xpChanged', this._stats.xp);
        let leveledUp = false;
        while (this._stats.xp >= xpToNextLevel(this._stats.level)) {
            this._stats.xp -= xpToNextLevel(this._stats.level);
            this._stats.level += 1;
            this._stats.statPoints += 1;
            this._stats.maxHp += 4;
            this._stats.hp = this._stats.maxHp;
            leveledUp = true;
        }
        if (leveledUp) {
            events.emit('levelUp', this._stats.level);
        }
    }

    spendStatPoint(statName) {
        if (this._stats.statPoints <= 0) return false;
        if (!['strength', 'wit', 'charm'].includes(statName)) return false;
        this._stats[statName] += 1;
        this._stats.statPoints -= 1;
        events.emit('statsChanged', this._stats);
        return true;
    }

    // --- Coin (Phase 6) ---
    get coin() { return this._stats.coin || 0; }

    addCoin(amount) {
        this._stats.coin = Math.max(0, (this._stats.coin || 0) + amount);
        events.emit('coinChanged', this._stats.coin);
        return this._stats.coin;
    }

    spendCoin(amount) {
        if ((this._stats.coin || 0) < amount) return false;
        this.addCoin(-amount);
        return true;
    }

    // --- Days (Phase 6) ---
    get day() { return this._day; }

    advanceDay(count = 1) {
        this._day += count;
        events.emit('dayChanged', this._day);
        return this._day;
    }

    /** A night's sleep at the shop: full HP, and the season moves on. */
    rest() {
        this.advanceDay(1);
        this.setHp(this._stats.maxHp);
    }

    setHp(val) {
        this._stats.hp = Math.max(0, Math.min(this._stats.maxHp, val));
        events.emit('hpChanged', this._stats.hp, this._stats.maxHp);
    }

    // --- Inventory ---
    get inventory() { return this._inventory; }

    addItem(itemId, count = 1) {
        const existing = this._inventory.find(i => i.id === itemId);
        if (existing) existing.count += count;
        else this._inventory.push({ id: itemId, count });
        events.emit('inventoryChanged', this._inventory);
    }

    removeItem(itemId, count = 1) {
        const existing = this._inventory.find(i => i.id === itemId);
        if (!existing) return false;
        existing.count -= count;
        if (existing.count <= 0) {
            this._inventory = this._inventory.filter(i => i.id !== itemId);
        }
        events.emit('inventoryChanged', this._inventory);
        return true;
    }

    hasItem(itemId, count = 1) {
        const existing = this._inventory.find(i => i.id === itemId);
        return !!existing && existing.count >= count;
    }

    equip(slot, itemId) {
        this._equipped[slot] = itemId;
        events.emit('equipmentChanged', this._equipped);
    }

    unequip(slot) {
        delete this._equipped[slot];
        events.emit('equipmentChanged', this._equipped);
    }

    get equipped() { return this._equipped; }
    get equipSlots() { return EQUIP_SLOTS; }

    // --- Brewing ---
    // Consumes the recipe's required material items and grants the result
    // item. Returns true on success, false if materials are insufficient.
    /** Phase 6: some recipes have to be taught before they can be brewed. */
    knowsRecipe(recipeId) {
        return recipeIsKnown(recipeId, name => this.getFlag(name));
    }

    brew(recipeId) {
        const recipe = BREW_RECIPES[recipeId];
        if (!recipe) return false;
        if (!this.knowsRecipe(recipeId)) return false;
        for (const req of recipe.requires) {
            if (!this.hasItem(req.item, req.count)) return false;
        }
        for (const req of recipe.requires) {
            this.removeItem(req.item, req.count);
        }
        this.addItem(recipe.result.item, recipe.result.count);
        events.emit('itemBrewed', recipeId, recipe.result.item);
        return true;
    }

    canBrew(recipeId) {
        const recipe = BREW_RECIPES[recipeId];
        if (!recipe) return false;
        if (!this.knowsRecipe(recipeId)) return false;
        return recipe.requires.every(req => this.hasItem(req.item, req.count));
    }

    // --- Quests (Phase 6) ---
    // The story graph still gates everything on flags and items; quests are a
    // player-facing tracker so a long season stays legible between sessions.
    get quests() { return this._quests; }

    startQuest(id) {
        if (this._quests[id]) return false; // already active or already done
        this._quests[id] = 'active';
        events.emit('questChanged', id, 'active');
        return true;
    }

    completeQuest(id) {
        if (this._quests[id] === 'done') return false;
        this._quests[id] = 'done';
        events.emit('questChanged', id, 'done');
        return true;
    }

    questState(id) { return this._quests[id] || null; }
    questIsActive(id) { return this._quests[id] === 'active'; }
    questIsDone(id) { return this._quests[id] === 'done'; }
    get activeQuestCount() {
        return Object.values(this._quests).filter(v => v === 'active').length;
    }

    // --- Lore (Phase 6) ---
    get lore() { return this._lore; }

    addLore(id) {
        if (this._lore.includes(id)) return false;
        this._lore.push(id);
        events.emit('loreAdded', id);
        return true;
    }

    hasLore(id) { return this._lore.includes(id); }

    // --- Story flags ---
    getFlag(name) { return this._flags[name]; }
    setFlag(name, value = true) {
        this._flags[name] = value;
        events.emit('flagChanged', name, value);
    }

    // --- Affinity ---
    getAffinity(npcId) { return this._affinity[npcId] || 0; }
    addAffinity(npcId, amount) {
        this._affinity[npcId] = (this._affinity[npcId] || 0) + amount;
        events.emit('affinityChanged', npcId, this._affinity[npcId]);
    }

    // --- Story position ---
    get currentNodeId() { return this._currentNodeId; }
    set currentNodeId(id) {
        this._currentNodeId = id;
        this._visitedNodes.add(id);
        events.emit('nodeChanged', id);
    }
    hasVisited(id) { return this._visitedNodes.has(id); }

    // --- Save / Load ---
    save() {
        const payload = {
            stats: this._stats,
            inventory: this._inventory,
            equipped: this._equipped,
            flags: this._flags,
            affinity: this._affinity,
            currentNodeId: this._currentNodeId,
            visitedNodes: [...this._visitedNodes],
            day: this._day,
            quests: this._quests,
            lore: this._lore,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        events.emit('gameSaved');
    }

    hasSave() {
        return !!localStorage.getItem(SAVE_KEY);
    }

    load() {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        try {
            const payload = JSON.parse(raw);
            this._stats = payload.stats;
            this._inventory = payload.inventory;
            this._equipped = payload.equipped || {};
            this._flags = payload.flags || {};
            this._affinity = payload.affinity || {};
            this._currentNodeId = payload.currentNodeId || 'start';
            this._visitedNodes = new Set(payload.visitedNodes || []);
            this._day = payload.day || STARTING_DAY;
            this._quests = payload.quests || {};
            this._lore = payload.lore || [];
            events.emit('gameLoaded');
            return true;
        } catch (e) {
            console.error('Failed to load save:', e);
            return false;
        }
    }
}

export const state = new GameState();
