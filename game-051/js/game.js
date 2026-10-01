/**
 * game.js — the live game: holds the save, persists it, runs the clock-driven
 * ticks and tells the UI when something changed.
 */

import { now } from './core/time.js';
import { emit } from './core/bus.js';
import { newState, migrate, SAVE_KEY, log } from './sim/state.js';
import { tickStamina, tickTickets, tickTraining, awaySummary } from './sim/idle.js';
import { tickEnergy } from './sim/mine.js';
import { ensureQuests } from './sim/quests.js';
import { ensureShop } from './sim/shop.js';
import { refreshBoard } from './sim/expeditions.js';
import { ensurePlots } from './sim/farm.js';
import { generateHero } from './sim/heroes.js';
import { addHero } from './sim/state.js';
import { Rng } from './core/rng.js';

export const G = {
    S: null,
    away: null,
    dirty: false,
    lastSave: 0,
};

function storage() {
    try { return window.localStorage; } catch { return null; }
}

export function hasSave() {
    const ls = storage();
    try { return !!(ls && ls.getItem(SAVE_KEY)); } catch { return false; }
}

export function loadGame() {
    const ls = storage();
    let raw = null;
    try { raw = ls && ls.getItem(SAVE_KEY); } catch { raw = null; }
    if (!raw) return false;
    try {
        const S = migrate(JSON.parse(raw));
        if (!S) return false;
        G.S = S;
        G.away = awaySummary(S, S.lastSeen || S.saved);
        daily();
        return true;
    } catch (e) {
        console.warn('save could not be read', e);
        return false;
    }
}

export function newGame() {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
    G.S = newState(seed);
    G.away = null;
    // two loyal retainers so the first battle is never empty-handed
    const r = new Rng(seed ^ 0x51);
    const a = generateHero({ seed: r.seed(), rarity: 3, cls: 'knight', element: 'light', radiant: false });
    const b = generateHero({ seed: r.seed(), rarity: 3, cls: 'ranger', element: 'wind', radiant: false });
    for (const h of [a, b]) { h.isNew = false; addHero(G.S, h); }
    G.S.teams.main = [a.id, b.id];
    daily();
    saveGame(true);
}

export function saveGame(force = false) {
    if (!G.S) return;
    const t = now();
    if (!force && t - G.lastSave < 1500) { G.dirty = true; return; }
    G.S.saved = t;
    G.S.lastSeen = t;
    const ls = storage();
    try { ls && ls.setItem(SAVE_KEY, JSON.stringify(G.S)); } catch (e) { console.warn('save failed', e); }
    G.lastSave = t;
    G.dirty = false;
}

export function wipeSave() {
    const ls = storage();
    try { ls && ls.removeItem(SAVE_KEY); } catch { /* ignore */ }
    G.S = null;
}

export function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(G.S)))); }
export function importSave(str) {
    const S = migrate(JSON.parse(decodeURIComponent(escape(atob(str.trim())))));
    if (!S || !S.heroes) throw new Error('not a Sigilborn save');
    G.S = S;
    saveGame(true);
}

/** Daily/weekly resets and lazily-generated boards. */
export function daily() {
    const S = G.S;
    ensureQuests(S);
    ensureShop(S);
    refreshBoard(S);
    ensurePlots(S);
}

/** Called every second or so by the main loop. */
export function tick() {
    const S = G.S;
    if (!S) return;
    tickStamina(S);
    tickTickets(S);
    tickEnergy(S);
    const ups = tickTraining(S);
    daily();
    S.lastSeen = now();
    if (ups.length) changed('training');
    emit('tick');
    if (G.dirty) saveGame();
}

/** Mark state changed: saves soon and refreshes the HUD. */
export function changed(what = '') {
    G.dirty = true;
    saveGame();
    emit('change', what);
}

export function note(text, kind) { log(G.S, text, kind); }
