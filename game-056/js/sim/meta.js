/**
 * meta.js — the persistent layer above a run: the Ember tree, rekindling,
 * the save file's shape and the Treasury's offline earnings.
 *
 * Pure: no three.js, no DOM, no Math.random. (main.js does the localStorage I/O.)
 */

import {
    EMBER_TREE, EMBER_ORDER, emberRankCost, embersFor, REKINDLE_MIN_WAVE, treasuryIncome,
} from '../config.js';

export const SAVE_KEY = 'keepfire.save.v1';

export function newMeta() {
    const tree = {};
    for (const k of EMBER_ORDER) tree[k] = 0;
    return {
        embers: 0, tree, best: 0, rekindles: 0, kills: 0, bossKills: 0, won: false,
        seen: {},
        settings: { sound: true, music: true, quality: 'auto', speed: 1, autoStart: false, hints: true },
        hintsSeen: {},
    };
}

/** Merge a loaded save onto defaults so new fields always exist. */
export function normalizeSave(data) {
    const meta = newMeta();
    if (!data || typeof data !== 'object') return { meta, run: null, savedAt: 0 };
    const m = data.meta ?? {};
    Object.assign(meta, m);
    meta.tree = { ...newMeta().tree, ...(m.tree ?? {}) };
    meta.settings = { ...newMeta().settings, ...(m.settings ?? {}) };
    meta.seen = { ...(m.seen ?? {}) };
    meta.hintsSeen = { ...(m.hintsSeen ?? {}) };
    return { meta, run: data.run ?? null, savedAt: data.savedAt ?? 0 };
}

export function canBuyRank(meta, key) {
    const def = EMBER_TREE[key];
    const r = meta.tree[key] ?? 0;
    if (r >= def.max) return false;
    return meta.embers >= emberRankCost(key, r);
}

export function buyRank(meta, key) {
    if (!canBuyRank(meta, key)) return false;
    const r = meta.tree[key] ?? 0;
    meta.embers -= emberRankCost(key, r);
    meta.tree[key] = r + 1;
    return true;
}

export const canRekindle = (run) => !!run && run.best >= REKINDLE_MIN_WAVE;
export const rekindleGain = (run) => (canRekindle(run) ? embersFor(run.best) : 0);

export function rekindle(meta, run) {
    const g = rekindleGain(run);
    if (!g) return 0;
    meta.embers += g;
    meta.rekindles++;
    return g;
}

/** Gold the Treasury earned while the game was closed (a quarter rate, two hours at most). */
export function offlineGold(run, elapsedSec) {
    if (!run || !run.castle || !run.castle.treasury) return 0;
    const t = Math.min(7200, Math.max(0, elapsedSec));
    if (t < 60) return 0;
    return Math.floor(treasuryIncome(run.castle.treasury) * (1 + 0.06 * run.wave) * t * 0.25);
}
