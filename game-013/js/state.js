import { events } from './events.js';
import { STARTING_GOLD, SLOT_COUNT, SEEDS, POTS, SOILS, SEASONS, DECORATIONS } from './config.js';

// --- Achievement definitions ---
const ACHIEVEMENT_DEFS = [
    { id: 'first_harvest',    name: 'First Bloom',        desc: 'Harvest your first flower.',          check: (s) => s._totalHarvested >= 1 },
    { id: 'ten_harvests',     name: 'Green Thumb',        desc: 'Harvest 10 flowers.',                 check: (s) => s._totalHarvested >= 10 },
    { id: 'fifty_harvests',   name: 'Master Gardener',    desc: 'Harvest 50 flowers.',                 check: (s) => s._totalHarvested >= 50 },
    { id: 'earn_100',         name: 'Pocket Change',      desc: 'Earn 100g total.',                    check: (s) => s._totalEarned >= 100 },
    { id: 'earn_500',         name: 'Flower Fortune',     desc: 'Earn 500g total.',                    check: (s) => s._totalEarned >= 500 },
    { id: 'earn_2000',        name: 'Blooming Rich',      desc: 'Earn 2000g total.',                   check: (s) => s._totalEarned >= 2000 },
    { id: 'orchid',           name: 'Exotic Taste',       desc: 'Grow an Orchid.',                     check: (s) => s._grownSeeds.has('orchid') },
    { id: 'moonflower',       name: 'Night Gardener',     desc: 'Grow a Moonflower.',                  check: (s) => s._grownSeeds.has('moonflower') },
    { id: 'all_upgrades',     name: 'Full Bloom',         desc: 'Upgrade all 5 slots to Golden Urn + Mystic Loam.', check: (s) => s._slots.every(sl => sl.potKey === 'golden' && sl.soilKey === 'mystic') },
    { id: 'all_decos',        name: 'Garden Paradise',    desc: 'Buy all decorations.',                check: (s) => Object.keys(DECORATIONS).every(k => s._decorations[k]) },
    { id: 'survive_winter',   name: 'Cold Fingers',       desc: 'Advance through a full Winter season.', check: (s) => s._seasonsCompleted.has('Winter') },
    { id: 'day_20',           name: 'Dedicated Gardener', desc: 'Reach Day 20.',                       check: (s) => s._day >= 20 },
];

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

        // Season tracking
        this._seasonIndex   = 0;   // index into SEASONS
        this._dayInSeason   = 1;
        this._seasonsCompleted = new Set();

        // Decorations: key → true/false (owned)
        this._decorations = {};
        for (const key of Object.keys(DECORATIONS)) {
            this._decorations[key] = false;
        }

        // Achievements
        this._achievements  = new Set();  // ids of unlocked achievements
        this._grownSeeds    = new Set();  // seed keys ever successfully harvested

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
        this._dayInSeason++;
        const season = SEASONS[this._seasonIndex];
        if (this._dayInSeason > season.durationDays) {
            this._seasonsCompleted.add(season.name);
            this._seasonIndex = (this._seasonIndex + 1) % SEASONS.length;
            this._dayInSeason = 1;
            events.emit('seasonChanged', this._seasonIndex);
            this._checkAchievements();
        }
        events.emit('dayAdvanced', this._day);
    }

    // --- Season ---
    get season() { return SEASONS[this._seasonIndex]; }
    get seasonIndex() { return this._seasonIndex; }
    get dayInSeason() { return this._dayInSeason; }
    /** Effective grow speed multiplier for the current season */
    get seasonSpeedMod() { return SEASONS[this._seasonIndex].speedMod; }

    // --- Decorations ---
    get decorations() { return this._decorations; }
    buyDecoration(key) {
        if (this._decorations[key]) return false;   // already owned
        const deco = DECORATIONS[key];
        if (!this.spendGold(deco.cost)) return false;
        this._decorations[key] = true;
        events.emit('decorationBought', key);
        this._checkAchievements();
        return true;
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
        const season   = SEASONS[this._seasonIndex];
        // Decoration yield bonus (sum all owned)
        const decoBonus = Object.entries(this._decorations)
            .filter(([, owned]) => owned)
            .reduce((sum, [key]) => sum + DECORATIONS[key].yieldBonus, 0);
        const baseValue = Math.round(seed.sellValue * season.priceMod);
        const earned    = baseValue + pot.yieldBonus + soil.yieldBonus + decoBonus;
        slot.seedKey      = null;
        slot.growProgress = 0;
        slot.stage        = 0;
        this._grownSeeds.add(seedKey);
        this.addGold(earned);
        this._totalHarvested++;
        this._totalEarned += earned;
        events.emit('flowerHarvested', slotIndex, seedKey, earned);
        this._checkAchievements();
        return earned;
    }

    upgradePot(slotIndex, potKey) {
        this._slots[slotIndex].potKey = potKey;
        events.emit('potUpgraded', slotIndex, potKey);
        this._checkAchievements();
    }

    upgradeSoil(slotIndex, soilKey) {
        this._slots[slotIndex].soilKey = soilKey;
        events.emit('soilUpgraded', slotIndex, soilKey);
        this._checkAchievements();
    }

    // --- Flags ---
    get isPaused()  { return this._isPaused; }
    set isPaused(v) { this._isPaused = v; }

    // --- Stats ---
    get totalHarvested() { return this._totalHarvested; }
    get totalEarned()    { return this._totalEarned; }

    // --- Achievements ---
    get achievements() { return this._achievements; }

    _checkAchievements() {
        for (const def of ACHIEVEMENT_DEFS) {
            if (!this._achievements.has(def.id) && def.check(this)) {
                this._achievements.add(def.id);
                events.emit('achievementUnlocked', def.id, def.name, def.desc);
            }
        }
    }

    getAchievementDefs() { return ACHIEVEMENT_DEFS; }

    // --- Persistence ---
    save() {
        const data = {
            gold:          this._gold,
            day:           this._day,
            dayInSeason:   this._dayInSeason,
            seasonIndex:   this._seasonIndex,
            seasonsCompleted: [...this._seasonsCompleted],
            slots:         this._slots.map(s => ({
                seedKey: s.seedKey, growProgress: s.growProgress,
                potKey: s.potKey, soilKey: s.soilKey, stage: s.stage,
            })),
            seedBag:       { ...this._seedBag },
            decorations:   { ...this._decorations },
            achievements:  [...this._achievements],
            grownSeeds:    [...this._grownSeeds],
            totalHarvested: this._totalHarvested,
            totalEarned:    this._totalEarned,
        };
        localStorage.setItem('petalPurse_save', JSON.stringify(data));
    }

    load() {
        const raw = localStorage.getItem('petalPurse_save');
        if (!raw) return false;
        try {
            const d = JSON.parse(raw);
            this._gold           = Math.max(0, Math.round(d.gold ?? STARTING_GOLD));
            this._day            = d.day            ?? 1;
            this._dayInSeason    = d.dayInSeason    ?? 1;
            this._seasonIndex    = d.seasonIndex    ?? 0;
            this._seasonsCompleted = new Set(d.seasonsCompleted ?? []);
            if (d.slots) {
                d.slots.forEach((s, i) => {
                    if (this._slots[i]) Object.assign(this._slots[i], s);
                });
            }
            if (d.seedBag) Object.assign(this._seedBag, d.seedBag);
            if (d.decorations) Object.assign(this._decorations, d.decorations);
            this._achievements   = new Set(d.achievements ?? []);
            this._grownSeeds     = new Set(d.grownSeeds   ?? []);
            this._totalHarvested = d.totalHarvested ?? 0;
            this._totalEarned    = d.totalEarned    ?? 0;
            events.emit('goldChanged', this._gold);
            return true;
        } catch (_) {
            return false;
        }
    }

    deleteSave() {
        localStorage.removeItem('petalPurse_save');
    }
}

export const state = new GameState();
