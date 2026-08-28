import { events } from './events.js';
import { STARTING_STATS, STARTING_INVENTORY, SAVE_KEY, xpToNextLevel, ITEM_DEFS } from './config.js';

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
        this._equipped = {}; // slot -> itemId (single "trinket" slot for Phase 1/3)
        this._flags = {};    // storyFlagName -> value
        this._affinity = {}; // npcId -> number
        this._currentNodeId = 'start';
        this._visitedNodes = new Set();
    }

    // --- Stats ---
    get stats() { return this._stats; }

    get effectiveStats() {
        // Base stats + bonuses from equipped items
        const eff = { ...this._stats };
        for (const itemId of Object.values(this._equipped)) {
            const def = ITEM_DEFS[itemId];
            if (def && def.bonus) {
                for (const [k, v] of Object.entries(def.bonus)) {
                    eff[k] = (eff[k] || 0) + v;
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
            events.emit('gameLoaded');
            return true;
        } catch (e) {
            console.error('Failed to load save:', e);
            return false;
        }
    }
}

export const state = new GameState();
