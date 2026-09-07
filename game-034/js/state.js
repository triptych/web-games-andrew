import { events } from './events.js';
import { UPGRADES, RECRUIT_ORDER, upgradeCost } from './config.js';

const SAVE_KEY = 'idle-delve-save-v1';

/**
 * Global game state — persisted to localStorage.
 * Setters auto-emit events so UI/render stay in sync.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._gold = 0;
        this._lifetimeGold = 0;
        this._deepestFloor = 1;

        // upgrade levels
        this.upgrades = {};
        for (const id of Object.keys(UPGRADES)) this.upgrades[id] = 0;

        this._lastSeenAt = Date.now();
        this._muted = false;
    }

    // --- Gold ---
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, Math.floor(val));
        events.emit('goldChanged', this._gold);
    }
    addGold(n) {
        this._lifetimeGold += n;
        this.gold = this._gold + n;
    }
    spendGold(n) {
        if (n > this._gold) return false;
        this.gold = this._gold - n;
        return true;
    }

    get deepestFloor() { return this._deepestFloor; }
    set deepestFloor(v) {
        this._deepestFloor = v;
        events.emit('deepestFloorChanged', v);
    }

    // --- Upgrades ---
    getUpgradeLevel(id) { return this.upgrades[id] || 0; }

    getUpgradeCost(id) {
        return upgradeCost(id, this.getUpgradeLevel(id));
    }

    canBuyUpgrade(id) {
        const u = UPGRADES[id];
        const lvl = this.getUpgradeLevel(id);
        if (lvl >= u.maxLevel) return false;
        return this._gold >= this.getUpgradeCost(id);
    }

    buyUpgrade(id) {
        if (!this.canBuyUpgrade(id)) return false;
        const cost = this.getUpgradeCost(id);
        this.spendGold(cost);
        this.upgrades[id] = this.getUpgradeLevel(id) + 1;
        events.emit('upgradePurchased', id, this.upgrades[id]);
        return true;
    }

    // --- Derived: party multipliers from upgrades ---
    get atkMul() { return 1 + this.getUpgradeLevel('atk') * UPGRADES.atk.effectPerLevel; }
    get defMul() { return 1 + this.getUpgradeLevel('def') * UPGRADES.def.effectPerLevel; }
    get hpMul()  { return 1 + this.getUpgradeLevel('hp')  * UPGRADES.hp.effectPerLevel; }
    get goldMul(){ return 1 + this.getUpgradeLevel('goldfind') * UPGRADES.goldfind.effectPerLevel; }

    get startingFloor() {
        return 1 + this.getUpgradeLevel('startFloor') * 2;
    }

    get reviveCharges() {
        return this.getUpgradeLevel('revive');
    }

    get recruitedClasses() {
        const n = this.getUpgradeLevel('recruit') + 1; // always have the first hero
        return RECRUIT_ORDER.slice(0, n);
    }

    // --- Mute ---
    get muted() { return this._muted; }
    set muted(v) { this._muted = v; events.emit('mutedChanged', v); }

    // --- Persistence ---
    save() {
        this._lastSeenAt = Date.now();
        const payload = {
            gold: this._gold,
            lifetimeGold: this._lifetimeGold,
            deepestFloor: this._deepestFloor,
            upgrades: this.upgrades,
            lastSeenAt: this._lastSeenAt,
            muted: this._muted,
        };
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        } catch (e) { /* storage unavailable — ignore */ }
    }

    /** Returns elapsed ms since last save (for offline catch-up), or 0 if no save existed. */
    load() {
        let raw;
        try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return 0; }
        if (!raw) return 0;
        let data;
        try { data = JSON.parse(raw); } catch (e) { return 0; }

        this._gold = data.gold ?? 0;
        this._lifetimeGold = data.lifetimeGold ?? 0;
        this._deepestFloor = data.deepestFloor ?? 1;
        this.upgrades = { ...this.upgrades, ...(data.upgrades || {}) };
        this._muted = data.muted ?? false;

        const elapsed = Date.now() - (data.lastSeenAt ?? Date.now());
        return Math.max(0, elapsed);
    }
}

export const state = new GameState();
