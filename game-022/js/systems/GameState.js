/**
 * GameState — singleton persisted to localStorage between runs.
 * Call GameState.load() on boot, GameState.save() after changes.
 */

import {
    START_CREDITS, START_HULL_MAX, START_FUEL_MAX, START_CARGO_SLOTS,
    START_DRILL_POWER, START_LIGHT_RADIUS, START_SPEED_TILES_PER_SEC,
    START_WINCH_TILES_PER_SEC,
} from '../config.js';

const SAVE_KEY = 'depths_unknown_save';

const DEFAULT_STATE = {
    credits: START_CREDITS,
    hull:    { current: START_HULL_MAX,  max: START_HULL_MAX  },
    fuel:    { current: START_FUEL_MAX,  max: START_FUEL_MAX  },
    cargo:   { slots: [], maxSlots: START_CARGO_SLOTS },
    upgrades: {
        hull:   0,
        drill:  0,
        tank:   0,
        engine: 0,
        cargo:  0,
        lights: 0,
        special: [],   // array of special upgrade IDs owned
    },
    consumables: {
        repair_kit:   0,
        tnt:          0,
        recall_flare: 0,
        lucky_charm:  0,
    },
    // Derived from upgrades (recalculated on apply)
    derived: {
        hullMax:      START_HULL_MAX,
        fuelMax:      START_FUEL_MAX,
        cargoSlots:   START_CARGO_SLOTS,
        drillPower:   START_DRILL_POWER,
        lightRadius:  START_LIGHT_RADIUS,
        speedMult:    1.0,
        winchMult:    1.0,
        diagonal:     false,
        aoe:          false,
        instant:      false,
        orePing:      false,
        seeThrough:   false,
        oreScanner:   false,
        depthRadar:   false,
        pressureShield: false,
        teleporter:   false,
        teleporterCharged: false,
        autoDrill:    false,
        oreMagnet:    false,
        naniteRepair: false,
        voidAnchor:   false,
        luckyCharmActive: false,
    },
    stats: {
        maxDepth:       0,
        totalOresSold:  0,
        totalCreditsEarned: 0,
        totalRuns:      0,
        totalDeaths:    0,
        singingVeinFound: false,
        loreUnlocked:   [],
    },
    // Runtime (not persisted across browser reload, but carried between runs in a session)
    worldSeed:   Math.floor(Math.random() * 999999),
    playerCol:   60,
    playerRow:   0,
    exploredTiles: null,   // set to new Uint8Array after world gen
};

// Deep clone utility
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

class GameStateClass {
    constructor() {
        this._state = deepClone(DEFAULT_STATE);
    }

    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge into default to handle missing keys from older saves
                this._state = Object.assign(deepClone(DEFAULT_STATE), parsed);
                // Always recalculate derived on load
                this.recalculateDerived();
            }
        } catch (_e) {
            // Corrupted save — start fresh
            this._state = deepClone(DEFAULT_STATE);
        }
    }

    save() {
        try {
            const toSave = { ...this._state, exploredTiles: null }; // don't persist huge array
            localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
        } catch (_e) { /* quota exceeded or private mode */ }
    }

    resetForNewGame() {
        this._state = deepClone(DEFAULT_STATE);
        this._state.worldSeed = Math.floor(Math.random() * 999999);
        this.save();
    }

    get(key) { return this._state[key]; }

    // Convenience getters
    get credits()   { return this._state.credits; }
    get hull()      { return this._state.hull; }
    get fuel()      { return this._state.fuel; }
    get cargo()     { return this._state.cargo; }
    get upgrades()  { return this._state.upgrades; }
    get consumables() { return this._state.consumables; }
    get derived()   { return this._state.derived; }
    get stats()     { return this._state.stats; }
    get worldSeed() { return this._state.worldSeed; }
    get playerCol() { return this._state.playerCol; }
    get playerRow() { return this._state.playerRow; }

    set playerCol(v) { this._state.playerCol = v; }
    set playerRow(v) { this._state.playerRow = v; }

    spendCredits(amount) {
        if (this._state.credits < amount) return false;
        this._state.credits -= amount;
        return true;
    }

    earnCredits(amount) {
        const bonus = this._state.derived.luckyCharmActive ? 1.2 : 1.0;
        this._state.credits += Math.floor(amount * bonus);
        this._state.stats.totalCreditsEarned += Math.floor(amount * bonus);
    }

    // Refuel (returns actual amount added)
    refuel(amount) {
        const max = this._state.derived.fuelMax;
        const before = this._state.fuel.current;
        this._state.fuel.current = Math.min(max, before + amount);
        return this._state.fuel.current - before;
    }

    // Repair hull (returns actual HP restored)
    repairHull(amount) {
        const max = this._state.derived.hullMax;
        const before = this._state.hull.current;
        this._state.hull.current = Math.min(max, before + amount);
        return this._state.hull.current - before;
    }

    // --- Cargo management ---
    addToCargoHold(blockId, oreDef) {
        const cargo = this._state.cargo;
        if (oreDef.isFill) return false;

        // Find existing stack
        const existing = cargo.slots.find(s => s.blockId === blockId && s.qty < oreDef.stackSize);
        if (existing) {
            existing.qty++;
            return true;
        }
        // New slot
        if (cargo.slots.length >= this._state.derived.cargoSlots) return false;
        cargo.slots.push({ blockId, qty: 1, value: oreDef.value, name: oreDef.name, color: oreDef.color });
        return true;
    }

    sellAllCargo() {
        let total = 0;
        for (const slot of this._state.cargo.slots) {
            total += slot.value * slot.qty;
        }
        this._state.cargo.slots = [];
        this.earnCredits(total);
        this._state.stats.totalOresSold += 1;
        return total;
    }

    getCargoUsed() { return this._state.cargo.slots.reduce((s, sl) => s + sl.qty, 0); }
    getCargoMax()  { return this._state.derived.cargoSlots; }
    isCargoFull()  {
        const cargo = this._state.cargo;
        if (cargo.slots.length >= this._state.derived.cargoSlots) return true;
        return false;
    }

    // --- Apply upgrade ---
    applyUpgrade(category, level) {
        if (category === 'special') {
            if (!this._state.upgrades.special.includes(level)) {
                this._state.upgrades.special.push(level);
            }
        } else {
            this._state.upgrades[category] = level;
        }
        this.recalculateDerived();
    }

    recalculateDerived() {
        const u = this._state.upgrades;
        const d = this._state.derived;
        const { UPGRADES } = _upgradeData;

        // Tiered upgrades
        function applyTier(cat) {
            const level = u[cat];
            if (level > 0) {
                return UPGRADES[cat][level - 1].effect;
            }
            return {};
        }

        const hullFx    = applyTier('hull');
        const drillFx   = applyTier('drill');
        const tankFx    = applyTier('tank');
        const engineFx  = applyTier('engine');
        const cargoFx   = applyTier('cargo');
        const lightsFx  = applyTier('lights');

        d.hullMax    = hullFx.hullMax    || START_HULL_MAX;
        d.fuelMax    = tankFx.fuelMax    || START_FUEL_MAX;
        d.cargoSlots = cargoFx.cargoSlots || START_CARGO_SLOTS;
        d.drillPower = drillFx.drillPower || START_DRILL_POWER;
        d.lightRadius = lightsFx.lightRadius || START_LIGHT_RADIUS;
        d.speedMult  = engineFx.speedMult || 1.0;
        d.winchMult  = engineFx.winchMult || 1.0;
        d.diagonal   = !!drillFx.diagonal;
        d.aoe        = !!drillFx.aoe;
        d.instant    = !!drillFx.instant;
        d.orePing    = !!lightsFx.orePing;
        d.seeThrough = !!lightsFx.seeThrough;

        // Specials
        const sp = u.special;
        d.oreScanner   = sp.includes('scanner');
        d.depthRadar   = sp.includes('radar');
        d.pressureShield = sp.includes('shield');
        d.teleporter   = sp.includes('teleport');
        d.autoDrill    = sp.includes('autodrill');
        d.oreMagnet    = sp.includes('magnet');
        d.naniteRepair = sp.includes('nanites');
        d.voidAnchor   = sp.includes('voidanchor');

        // Cap hull/fuel to new max
        this._state.hull.max = d.hullMax;
        this._state.fuel.max = d.fuelMax;
        if (this._state.hull.current > d.hullMax) this._state.hull.current = d.hullMax;
        if (this._state.fuel.current > d.fuelMax) this._state.fuel.current = d.fuelMax;
    }

    trackDepth(depthMeters) {
        if (depthMeters > this._state.stats.maxDepth) {
            this._state.stats.maxDepth = depthMeters;
        }
    }

    hasUnlockedLore(depth) {
        return this._state.stats.loreUnlocked.includes(depth);
    }
    unlockLore(depth) {
        if (!this.hasUnlockedLore(depth)) {
            this._state.stats.loreUnlocked.push(depth);
        }
    }
}

// Lazy import to avoid circular — set by main.js after import
let _upgradeData = null;
export function setUpgradeData(ud) { _upgradeData = ud; }

export const GameState = new GameStateClass();
