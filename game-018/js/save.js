/**
 * save.js — localStorage save/load for game state.
 *
 * Saves: player stats, resources, buildings, inventory, weapons, quests, potions.
 * Does NOT save: world entities (monsters, pickups) — these regenerate on load.
 *
 * Exports:
 *   saveGame()   — write state to localStorage
 *   loadGame()   — restore state from localStorage (returns true if data existed)
 *   hasSave()    — true if save data exists
 *   deleteSave() — wipe save data
 */

import { state }  from './state.js';
import { events } from './events.js';
import { BUILDING_DEFS } from './config.js';

const SAVE_KEY = 'votwb_save_v1';
const AUTOSAVE_INTERVAL = 30; // seconds

export function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame() {
    const data = {
        version: 1,
        ts: Date.now(),
        hp:     state.hp,
        maxHp:  state.maxHp,
        atk:    state.atk,
        xp:     state.xp,
        xpNext: state.xpNext,
        level:  state.level,
        gold:   state.gold,
        resources: {
            wood:  state.getResource('wood'),
            stone: state.getResource('stone'),
            iron:  state.getResource('iron'),
            herbs: state.getResource('herbs'),
        },
        buildings: {},
        equippedWeapon: state.equippedWeapon,
        inventory: [...state._inventory],
        potions:   state.potions,
        activeQuests:    [...state._activeQuests],
        completedQuests: [...state._completedQuests],
        questProgress:   { ...state._questProgress },
    };

    for (const b of BUILDING_DEFS) {
        data.buildings[b.id] = state.getBuildingLevel(b.id);
    }

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Save failed:', e);
    }
}

export function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.warn('Save data corrupt, ignoring.');
        return false;
    }

    if (!data || data.version !== 1) return false;

    // Restore player stats directly (bypass setters to avoid XP loop)
    state._hp      = data.hp      ?? state._hp;
    state._maxHp   = data.maxHp   ?? state._maxHp;
    state._atk     = data.atk     ?? state._atk;
    state._xp      = data.xp      ?? 0;
    state._xpNext  = data.xpNext  ?? state._xpNext;
    state._level   = data.level   ?? 1;
    state._gold    = data.gold    ?? 0;

    // Resources
    if (data.resources) {
        for (const [k, v] of Object.entries(data.resources)) {
            if (k in state._resources) state._resources[k] = v;
        }
    }

    // Buildings
    if (data.buildings) {
        for (const [id, lvl] of Object.entries(data.buildings)) {
            state._buildings[id] = lvl;
        }
    }

    // Weapons
    if (data.inventory)       state._inventory       = data.inventory;
    if (data.equippedWeapon)  state._equippedWeapon  = data.equippedWeapon;

    // Potions
    if (data.potions != null) {
        state._potions = data.potions;
        state.updateMaxPotions();
    }

    // Quests
    if (data.activeQuests)    state._activeQuests    = new Set(data.activeQuests);
    if (data.completedQuests) state._completedQuests = new Set(data.completedQuests);
    if (data.questProgress)   state._questProgress   = { ...data.questProgress };

    // Re-emit all state events so UI syncs up
    events.emit('playerHpChanged',   state.hp,   state.maxHp);
    events.emit('playerXpChanged',   state.xp,   state.xpNext);
    events.emit('playerLevelUp',     state.level);
    events.emit('playerGoldChanged', state.gold);
    events.emit('potionsChanged',    state.potions, state.maxPotions);
    for (const res of ['wood','stone','iron','herbs']) {
        events.emit('resourceChanged', res, state.getResource(res));
    }
    events.emit('weaponChanged', state.equippedWeapon);
    events.emit('inventoryChanged');

    return true;
}

export function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

// Auto-save wiring
export function initSave() {
    let autoTimer = 0;

    // Expose autosave tick to the game loop via events
    events.on('gameTick', (dt) => {
        autoTimer += dt;
        if (autoTimer >= AUTOSAVE_INTERVAL) {
            autoTimer = 0;
            saveGame();
        }
    });

    // Save on page hide/unload
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveGame();
    });
    window.addEventListener('beforeunload', () => saveGame());
}
