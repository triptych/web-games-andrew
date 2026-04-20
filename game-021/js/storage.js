/**
 * storage.js — localStorage persistence for high scores.
 */

import { HIGH_SCORE_KEY, HIGH_SCORE_COUNT } from './config.js';

/**
 * Load the high score list (sorted descending by score).
 * @returns {Array<{score: number, date: string}>}
 */
export function loadHighScores() {
    try {
        const raw = localStorage.getItem(HIGH_SCORE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Save a new score into the high score table.
 * Keeps only the top HIGH_SCORE_COUNT entries.
 * @param {number} score
 */
export function saveHighScore(score) {
    if (!score || score <= 0) return;
    const list = loadHighScores();
    const entry = { score, date: new Date().toLocaleDateString() };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, HIGH_SCORE_COUNT);
    try {
        localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(trimmed));
    } catch { /* ignore quota errors */ }
}

/**
 * Clear all high scores.
 */
export function clearHighScores() {
    try { localStorage.removeItem(HIGH_SCORE_KEY); } catch { /* ignore */ }
}
