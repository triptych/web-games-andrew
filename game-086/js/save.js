/** save.js — guarded localStorage. A browser that blocks storage still plays; it just can't save. */
import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './progress.js';

export function loadGame(artById) {
    try {
        const text = localStorage.getItem(SAVE_KEY);
        return text ? deserialize(text, artById) : null;
    } catch {
        return null;
    }
}

export function saveGame(state) {
    try {
        localStorage.setItem(SAVE_KEY, serialize(state));
        return true;
    } catch {
        return false;
    }
}

export function eraseGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to erase */ }
}
