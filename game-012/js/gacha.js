/**
 * gacha.js — Pull logic, pity counter, duplicate/star-up handling,
 *             and localStorage persistence for the card collection.
 *
 * Public API:
 *   initGacha()            — load saved collection from localStorage
 *   pullSingle()           — pull 1 card, returns cardInstance
 *   pullTen()              — pull 10 cards, returns cardInstance[]
 *   saveCollection()       — persist collection + pity to localStorage
 *   loadCollection()       — restore from localStorage
 *   getStarUpCost(card)    — how many dupes needed for next star level
 *   fuseCard(baseUid, dupUids) — apply star-up fusion
 */

import { CARD_DEFS } from './cards.js';
import { state }     from './state.js';
import {
    RARITY,
    SINGLE_PULL_COST,
    PITY_THRESHOLD,
} from './config.js';

// --------------- Constants ---------------

const STORAGE_KEY = 'arcana-pull-save';

// Rarity weights used for weighted random selection
const RARITY_POOL = Object.entries(RARITY).map(([key, def]) => ({
    rarity: key,
    weight: def.pullWeight,
}));
const TOTAL_WEIGHT = RARITY_POOL.reduce((s, r) => s + r.weight, 0);

// Pre-index CARD_DEFS by rarity for fast lookup
const CARDS_BY_RARITY = {};
for (const r of Object.keys(RARITY)) {
    CARDS_BY_RARITY[r] = CARD_DEFS.filter(c => c.rarity === r);
}

// Star-up dupe cost per target star level (1→2 needs 1 dupe, etc.)
const STAR_DUPE_COSTS = [0, 1, 2, 3, 4, 5]; // index = target star level

// --------------- Weighted random rarity ---------------

function _rollRarity(forceLegendary = false) {
    if (forceLegendary) return 'LEGENDARY';
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const { rarity, weight } of RARITY_POOL) {
        roll -= weight;
        if (roll <= 0) return rarity;
    }
    return 'COMMON';
}

// --------------- Pick a card from a rarity tier ---------------

function _pickCard(rarity) {
    const pool = CARDS_BY_RARITY[rarity];
    if (!pool || pool.length === 0) return _pickCard('COMMON');
    return pool[Math.floor(Math.random() * pool.length)];
}

// --------------- Duplicate check ---------------

function _isDuplicate(cardDef) {
    return state.collection.some(c => c.id === cardDef.id);
}

// --------------- Build a card instance ---------------

function _makeInstance(cardDef) {
    return {
        ...cardDef,
        uid:      Date.now() + Math.random(),
        stars:    1,
        isNew:    !_isDuplicate(cardDef),    // true if first copy ever pulled
        isDupe:   _isDuplicate(cardDef),
    };
}

// --------------- Core pull logic ---------------

function _executePull() {
    // Pity: force Legendary if threshold reached
    const forceLeg = state.isPityReady;
    const rarity   = _rollRarity(forceLeg);
    const cardDef  = _pickCard(rarity);
    const instance = _makeInstance(cardDef);

    // Update pity counter
    if (rarity === 'LEGENDARY') {
        state.resetPity();
    } else {
        state.incrementPull();
    }

    // Add to collection
    state.addCard(instance);
    saveCollection();

    return instance;
}

// --------------- Public API ---------------

export function pullSingle() {
    if (state.gems < SINGLE_PULL_COST) return null;
    state.spendGems(SINGLE_PULL_COST);
    return [_executePull()];
}

export function pullTen() {
    const TEN_COST = SINGLE_PULL_COST * 10 - 100; // 500 gems discount (as in config)
    if (state.gems < TEN_COST) return null;
    state.spendGems(TEN_COST);

    const results = [];
    // Guarantee at least one Rare+ in 10-pull
    let hasRarePlus = false;
    for (let i = 0; i < 10; i++) {
        const forceLeg = state.isPityReady;
        let rarity     = _rollRarity(forceLeg);
        // On last card of 10, force at minimum Rare if none yet
        if (i === 9 && !hasRarePlus) {
            if (rarity === 'COMMON' || rarity === 'UNCOMMON') rarity = 'RARE';
        }
        if (rarity === 'RARE' || rarity === 'LEGENDARY') hasRarePlus = true;

        const cardDef  = _pickCard(rarity);
        const instance = _makeInstance(cardDef);

        if (rarity === 'LEGENDARY') {
            state.resetPity();
        } else {
            state.incrementPull();
        }

        state.addCard(instance);
        results.push(instance);
    }
    saveCollection();
    return results;
}

// --------------- Star-up / Fusion ---------------

/** Returns how many dupe uids are needed for the next star level. */
export function getStarUpCost(cardInstance) {
    const target = cardInstance.stars + 1;
    if (target > 5) return Infinity;
    return STAR_DUPE_COSTS[target];
}

/**
 * Fuse duplicate cards into baseUid to raise its star level.
 * dupUids: array of uid strings to consume.
 * Returns true on success, false on failure.
 */
export function fuseCard(baseUid, dupUids) {
    const base = state.collection.find(c => c.uid === baseUid);
    if (!base || base.stars >= 5) return false;

    const needed = getStarUpCost(base);
    if (dupUids.length < needed) return false;

    // Remove consumed dupes from collection
    const consume = dupUids.slice(0, needed);
    const newCollection = state.collection.filter(c => !consume.includes(c.uid));

    // Apply star bonus (+10% stats per star)
    base.stars += 1;
    const bonus = 1 + (base.stars - 1) * 0.10;
    base.hp  = Math.round(base.hp  * bonus);
    base.atk = Math.round(base.atk * bonus);
    base.def = Math.round(base.def * bonus);

    state.setParty(state.party); // re-emit so UI refreshes
    // Directly replace the collection array — state.collection is a reference
    state.collection.length = 0;
    for (const c of newCollection) state.collection.push(c);

    saveCollection();
    return true;
}

// --------------- Persistence ---------------

export function saveCollection() {
    try {
        const save = {
            collection: state.collection,
            party:      state.party.map(c => c.uid),
            gems:       state.gems,
            pullCount:  state.pullCount,
            wave:       state.wave,
            score:      state.score,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (e) {
        console.warn('arcana-pull: save failed', e);
    }
}

export function loadCollection() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const save = JSON.parse(raw);

        // Restore collection
        if (Array.isArray(save.collection)) {
            save.collection.forEach(c => {
                // Push directly to bypass re-emit spam
                state.collection.push(c);
            });
        }

        // Restore gems / pity / wave / score
        if (typeof save.gems      === 'number') state._gems      = save.gems;
        if (typeof save.pullCount === 'number') state._pullCount = save.pullCount;
        if (typeof save.wave      === 'number') state._wave      = save.wave;
        if (typeof save.score     === 'number') state._score     = save.score;

        // Restore party by uid references
        if (Array.isArray(save.party) && save.party.length > 0) {
            const partyCards = save.party
                .map(uid => state.collection.find(c => c.uid === uid))
                .filter(Boolean);
            if (partyCards.length > 0) state.setParty(partyCards);
        }

        return true;
    } catch (e) {
        console.warn('arcana-pull: load failed', e);
        return false;
    }
}

export function clearSave() {
    localStorage.removeItem(STORAGE_KEY);
}

let _loaded = false;

export function initGacha() {
    if (_loaded) return;
    _loaded = true;
    loadCollection();
}
