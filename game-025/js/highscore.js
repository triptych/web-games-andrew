/**
 * highscore.js — Persist the best score across runs via localStorage.
 *
 * Tiny wrapper so callers don't sprinkle localStorage access everywhere and so
 * a blocked/unavailable storage (private mode, file://) degrades to "no high
 * score" instead of throwing.
 */

const KEY = 'cryptCrawler.highScore';

/** The stored high score (0 if none / storage unavailable). */
export function getHighScore() {
    try {
        return Number(localStorage.getItem(KEY)) || 0;
    } catch {
        return 0;
    }
}

/**
 * Record `score` if it beats the stored best. Returns true if a NEW high score
 * was set (so the UI can celebrate it).
 */
export function submitScore(score) {
    try {
        if (score > getHighScore()) {
            localStorage.setItem(KEY, String(score));
            return true;
        }
    } catch {
        /* storage unavailable — silently skip persistence */
    }
    return false;
}
