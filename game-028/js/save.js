/**
 * save.js — Save/load game state via localStorage.
 */

import { state } from './state.js';

const SAVE_KEY = 'echoes_of_aethermoor_save';

export function hasSave() {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
        return false; // storage blocked: play without saving
    }
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
