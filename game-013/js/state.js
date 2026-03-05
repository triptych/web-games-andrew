import { events } from './events.js';
import { STARTING_GOLD, SLOT_COUNT, SEEDS, POTS, SOILS } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._gold    = STARTING_GOLD;
        this._day     = 1;
        this._isPaused = false;

        // Each slot: { seedKey, growProgress, potKey, soilKey, stage }
        // growProgress: 0.0 – 1.0; null seedKey means empty slot
        this._slots = Array.from({ length: SLOT_COUNT }, () => ({
            seedKey:      null,
            growProgress: 0,
            potKey:       'clay',
            soilKey:      'basic',
            stage:        0,
        }));

        // Inventory of seeds the player owns (counts)
        this._seedBag = {};
        for (const key of Object.keys(SEEDS)) {
            this._seedBag[key] = 0;
        }

        // Upgrades unlocked (pot / soil keys per slot)
        // Already initialised in _slots above

        // Lifetime stats
        this._totalHarvested = 0;
        this._totalEarned    = 0;
    }

    // --- Gold ---
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, Math.round(val));
        events.emit('goldChanged', this._gold);
    }

    addGold(n)  { this.gold += n; }
    spendGold(n) {
        if (this._gold < n) return false;
        this.gold -= n;
        return true;
    }

    // --- Day ---
    get day() { return this._day; }
    advanceDay() {
        this._day++;
        events.emit('dayAdvanced', this._day);
    }

    // --- Seed bag ---
    get seedBag() { return this._seedBag; }
    addSeed(key, count = 1) {
        this._seedBag[key] = (this._seedBag[key] || 0) + count;
    }
    useSeed(key) {
        if (!this._seedBag[key]) return false;
        this._seedBag[key]--;
        return true;
    }

    // --- Slots ---
    get slots() { return this._slots; }
    getSlot(i)  { return this._slots[i]; }

    plantSeed(slotIndex, seedKey) {
        const slot = this._slots[slotIndex];
        if (slot.seedKey !== null) return false; // already occupied
        slot.seedKey      = seedKey;
        slot.growProgress = 0;
        slot.stage        = 0;
        events.emit('flowerPlanted', slotIndex, seedKey);
        return true;
    }

    harvestSlot(slotIndex) {
        const slot = this._slots[slotIndex];
        if (slot.seedKey === null || slot.growProgress < 1) return false;
        const seedKey  = slot.seedKey;
        const seed     = SEEDS[seedKey];
        const pot      = POTS[slot.potKey];
        const soil     = SOILS[slot.soilKey];
        const earned   = seed.sellValue + pot.yieldBonus + soil.yieldBonus;
        slot.seedKey      = null;
        slot.growProgress = 0;
        slot.stage        = 0;
        this.addGold(earned);
        this._totalHarvested++;
        this._totalEarned += earned;
        events.emit('flowerHarvested', slotIndex, seedKey, earned);
        return earned;
    }

    upgradePot(slotIndex, potKey) {
        this._slots[slotIndex].potKey = potKey;
        events.emit('potUpgraded', slotIndex, potKey);
    }

    upgradeSoil(slotIndex, soilKey) {
        this._slots[slotIndex].soilKey = soilKey;
        events.emit('soilUpgraded', slotIndex, soilKey);
    }

    // --- Flags ---
    get isPaused()  { return this._isPaused; }
    set isPaused(v) { this._isPaused = v; }

    // --- Stats ---
    get totalHarvested() { return this._totalHarvested; }
    get totalEarned()    { return this._totalEarned; }
}

export const state = new GameState();
