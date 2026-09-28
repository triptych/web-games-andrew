// ============================================================
// Inventory helpers over a slot array [{id,n}|null].
// Keys may be item ids or 'tag:<tag>'.
// ============================================================

import { ITEM, hasTag } from '../data/items.js';

export const STACK = 99;
const matches = (id, key) => (key.startsWith('tag:') ? hasTag(id, key.slice(4)) : id === key);
const stackable = id => { const it = ITEM[id]; return it && !['tool', 'weapon', 'armor', 'charm'].includes(it.cat) && !(it.key && id !== 'heart_shard' && id !== 'dungeon_key'); };

export function countIn(slots, key, size = slots.length) {
    let n = 0;
    for (let i = 0; i < size; i++) { const s = slots[i]; if (s && matches(s.id, key)) n += s.n; }
    return n;
}

/** Add to slots; returns how many didn't fit. */
export function addTo(slots, id, n = 1, size = slots.length) {
    if (!ITEM[id]) return n;
    const max = stackable(id) ? STACK : 1;
    for (let i = 0; i < size && n > 0; i++) {
        const s = slots[i];
        if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < size && n > 0; i++) {
        if (!slots[i]) { const k = Math.min(n, max); slots[i] = { id, n: k }; n -= k; }
    }
    return n;
}

/** Remove n matching key, cheapest first for tags. Returns array of removed [{id,n}] or null if not enough. */
export function removeFrom(slots, key, n = 1, size = slots.length) {
    if (countIn(slots, key, size) < n) return null;
    const idxs = [];
    for (let i = 0; i < size; i++) if (slots[i] && matches(slots[i].id, key)) idxs.push(i);
    if (key.startsWith('tag:')) idxs.sort((a, b) => (ITEM[slots[a].id].sell - ITEM[slots[b].id].sell));
    const out = [];
    for (const i of idxs) {
        if (n <= 0) break;
        const s = slots[i];
        const k = Math.min(n, s.n);
        s.n -= k; n -= k; out.push({ id: s.id, n: k });
        if (s.n <= 0) slots[i] = null;
    }
    return out;
}

/**
 * Can a list of ingredients [[key,n]...] be satisfied without double-counting?
 * Specific ids are allocated before tags. Returns the concrete plan [{id,n}] or null.
 */
export function planIngredients(slots, ing, size = slots.length) {
    const avail = new Map();
    for (let i = 0; i < size; i++) { const s = slots[i]; if (s) avail.set(s.id, (avail.get(s.id) ?? 0) + s.n); }
    const plan = [];
    const order = ing.slice().sort((a, b) => (a[0].startsWith('tag:') ? 1 : 0) - (b[0].startsWith('tag:') ? 1 : 0));
    for (const [key, need] of order) {
        let left = need;
        const cands = [...avail.keys()].filter(id => avail.get(id) > 0 && matches(id, key));
        cands.sort((a, b) => ITEM[a].sell - ITEM[b].sell);
        for (const id of cands) {
            if (left <= 0) break;
            const k = Math.min(left, avail.get(id));
            avail.set(id, avail.get(id) - k); left -= k; plan.push({ id, n: k });
        }
        if (left > 0) return null;
    }
    return plan;
}

export function consumePlan(slots, plan, size = slots.length) {
    for (const { id, n } of plan) removeFrom(slots, id, n, size);
}

export function freeSlots(slots, size = slots.length) { let n = 0; for (let i = 0; i < size; i++) if (!slots[i]) n++; return n; }

/** A flat list store (storehouse): [{id,n}] with no slot limit. */
export function listAdd(list, id, n) { const e = list.find(e => e.id === id); if (e) e.n += n; else list.push({ id, n }); }
export function listTake(list, id, n) { const e = list.find(e => e.id === id); if (!e) return 0; const k = Math.min(n, e.n); e.n -= k; if (e.n <= 0) list.splice(list.indexOf(e), 1); return k; }
