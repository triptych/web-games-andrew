/**
 * save.js — Save/load game state via localStorage.
 */

import { state } from './state.js';

const SAVE_KEY = 'echoes_of_aethermoor_save';

export function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state.serialize()));
        return true;
    } catch (e) {
        return false;
    }
}

export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        state.deserialize(JSON.parse(raw));
        return true;
    } catch (e) {
        return false;
    }
}
