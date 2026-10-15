// Small shared rules: what a tile is right now, what you can walk on, and your stats.
// Used by the game, the battle, the planner and the bot alike, so they never disagree.

import { TILES, T } from './data/tiles.js';
import { ITEMS } from './data/items.js';
import { LEVEL_CAP } from '../config.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The tile at index i of map M, after anything you opened. */
export function tileAt(G, M, i) {
    const t = M.t[i];
    if (G && G.opened[M.id]?.[i]) return TILES[t].after ?? t;
    return t;
}

export const hasBook = (G, id) => G.books.includes(id);

/** Can the player stand on tile i? `books` defaults to the ones you hold. */
export function passable(G, M, i, books = null) {
    if (i < 0 || i >= M.t.length) return false;
    const t = tileAt(G, M, i);
    const d = TILES[t];
    if (t === T.clutter) return clutterGone(G, M, i);
    if (d.lock && d.mode === 'pass') return books ? books.includes(d.lock) : hasBook(G, d.lock);
    return !d.solid;
}

/** Loose pages in the unrestored library: each heap goes when enough grimoires are home. */
export function clutterNeed(M, i) { return 1 + (M.v[i] % 11); }
export function clutterGone(G, M, i) { return !!G && G.placed.length >= clutterNeed(M, i); }

export function canFoeWalk(G, M, i, swim) {
    if (i < 0 || i >= M.t.length) return false;
    const t = tileAt(G, M, i);
    const d = TILES[t];
    if (swim) return !!d.swim;
    if (t === T.door || d.lock) return false;
    if (t === T.clutter) return clutterGone(G, M, i);
    return !d.solid;
}

// ------------------------------------------------------------------ stats
export const xpFor = (lvl) => Math.round(10 * Math.pow(lvl, 1.7));

const gearVal = (G, slot, key) => (G.gear[slot] ? ITEMS[G.gear[slot]][key] || 0 : 0);
export const hasCharm = (G, id) => G.gear.charm === id;

export function maxHp(G) {
    return 34 + 6 * G.lvl + gearVal(G, 'knit', 'hp') + 5 * (G.ups.patch || 0) + (hasCharm(G, 'locket') ? 30 : 0);
}
export function maxInk(G) { return 8 + 2 * G.lvl + 4 * (G.ups.inkwell || 0); }
export function focus(G) { return 6 + Math.round(2.5 * G.lvl) + gearVal(G, 'mark', 'focus'); }
export function poise(G) { return 1 + G.lvl + gearVal(G, 'knit', 'poise'); }
export function wickPower(G) { return 3 + 2 * G.placed.length + Math.floor(G.lvl / 2); }

export function gainXp(G, n) {
    G.xp += n;
    let ups = 0;
    while (G.lvl < LEVEL_CAP && G.xp >= xpFor(G.lvl)) {
        G.xp -= xpFor(G.lvl);
        G.lvl++;
        ups++;
    }
    if (G.lvl >= LEVEL_CAP) G.xp = 0;
    if (ups) {
        G.hp = maxHp(G);
        G.ink = maxInk(G);
        G.events.push({ type: 'levelUp', lvl: G.lvl });
    }
    return ups;
}

export function addItem(G, id, n = 1) {
    const it = ITEMS[id];
    if (!it) throw new Error('no item ' + id);
    if (it.kind === 'up') {
        G.ups[id] = (G.ups[id] || 0) + n;
        if (id === 'patch') G.hp = Math.min(maxHp(G), G.hp + 5 * n);
        if (id === 'inkwell') G.ink = Math.min(maxInk(G), G.ink + 4 * n);
        return;
    }
    G.bag[id] = (G.bag[id] || 0) + n;
}
export function takeItem(G, id, n = 1) {
    if ((G.bag[id] || 0) < n) return false;
    G.bag[id] -= n;
    if (G.bag[id] <= 0) delete G.bag[id];
    return true;
}
export const count = (G, id) => G.bag[id] || 0;
export const owns = (G, id) => count(G, id) > 0 || Object.values(G.gear).includes(id);
