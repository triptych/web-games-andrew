// Small shared helpers for the sim modules: the log, experience and levels, counting items across the wagon and stash.

import { LOG_MAX, levelXp, MAX_LEVEL, REGION_LEVEL } from '../config.js';
import { TOWN } from './data/towns.js';
import { count, removeItems, stashCount, stashRemove } from './inv.js';

export function log(G, text, kind = 'info') {
    G.log.push({ day: G.day, text, kind });
    if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
}
export const emit = (G, e) => G.events.push(e);

export function levelFor(xp) {
    let lv = 1;
    while (lv < MAX_LEVEL && xp >= levelXp(lv + 1)) lv++;
    return lv;
}
export function gainXp(G, n) {
    n = Math.round(n);
    if (n <= 0) return;
    G.xp += n;
    G.stats.xp += n;
    const lv = levelFor(G.xp);
    while (G.lv < lv) {
        G.lv++;
        emit(G, { type: 'levelup', lv: G.lv });
        log(G, `Merchant level ${G.lv}!`, 'good');
        for (let r = 1; r <= 5; r++) if (REGION_LEVEL[r] === G.lv) emit(G, { type: 'region', region: r });
    }
}
export const levelProgress = (G) => {
    if (G.lv >= MAX_LEVEL) return 1;
    const a = levelXp(G.lv), b = levelXp(G.lv + 1);
    return (G.xp - a) / (b - a);
};
export const inGuildTown = (G) => !!TOWN[G.loc].guild;

/** Units of an item you can lay hands on here: the wagon, plus the guild stash when you are in a guild town. */
export function have(G, t, lv = 0, minMode = false) {
    return count(G, t, lv, minMode) + (inGuildTown(G) ? stashCount(G, t, lv, minMode) : 0);
}
export function takeAny(G, t, lv, n, minMode = false) {
    let left = n;
    left -= removeItems(G, t, lv, left, minMode);
    if (left > 0 && inGuildTown(G)) left -= stashRemove(G, t, lv, left, minMode);
    return n - left;
}
export function repUp(G, townId, n = 1) {
    G.towns[townId].rep = Math.max(0, G.towns[townId].rep + n);
}
