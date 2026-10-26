// The party's shared bag: stacking, capacity, buying/selling bookkeeping. Pure.

import { INV_CAP } from '../config.js';
import { uid, say } from './core.js';
import { recItem } from './journal.js';
import { priceOf } from './items.js';

export const stackable = (it) => it.sig != null;

/** Put an item in the bag. src: found | bought | reward. A full bag sells the item on the spot. */
export function give(G, it, src = 'found') {
    const n = it.n || 1;
    recItem(G, it, src === 'bought' ? 'bought' : 'found', n);
    if (stackable(it)) {
        const same = G.inv.find((x) => x.sig === it.sig);
        if (same) { same.n += n; return true; }
    }
    if (G.inv.length >= INV_CAP) {
        const gold = Math.max(1, Math.round(priceOf(it) * 0.3)) * n;
        G.gold += gold;
        say(G, `Bag full! ${it.name} sold for ${gold}g.`, 14);
        return false;
    }
    it.id = uid(G);
    G.inv.push(it);
    return true;
}
export const findItem = (G, id) => G.inv.find((x) => x.id === id) || null;
/** Remove n of an item; returns the removed item (n = how many), or null. */
export function take(G, id, n = 1) {
    const i = G.inv.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const it = G.inv[i];
    if (stackable(it) && it.n > n) { it.n -= n; return { ...it, n }; }
    G.inv.splice(i, 1);
    return it;
}
export const countOf = (G, pred) => G.inv.reduce((a, x) => a + (pred(x) ? x.n || 1 : 0), 0);
