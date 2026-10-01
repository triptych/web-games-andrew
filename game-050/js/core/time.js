/** time.js — a swappable clock so the sim can be tested without waiting. */

let nowFn = () => Date.now();
export const now = () => nowFn();
export function setNow(fn) { nowFn = fn; }

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Local calendar day, e.g. "2026-10-01". Dailies reset at local midnight. */
export function dayKey(t = now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-based week index since the epoch (local). */
export function weekKey(t = now()) {
    const d = new Date(t);
    const local = t - d.getTimezoneOffset() * MIN;
    return Math.floor((local / DAY + 3) / 7);
}

export function msToNextDay(t = now()) {
    const d = new Date(t);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    return next - t;
}
