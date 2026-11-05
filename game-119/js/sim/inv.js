// The wagon's cargo bed: a grid inventory (items occupy rectangles and can be rotated), with stacking,
// weight, auto-sort, favourites and junk marks, plus the guild stash (a plain list). Pure.

import { itemDef, catOf } from './data/items.js';

export const normLv = (t, lv) => (itemDef(t, 1)?.gear ? (lv | 0) : 0);

/** Footprint of an instance, with its rotation. */
export function fp(it) {
    const d = itemDef(it.t, it.lv);
    return it.r ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
function gridOf(inv, ignore = 0) {
    const g = new Int32Array(inv.w * inv.h);
    for (const it of inv.items) {
        if (it.id === ignore) continue;
        const f = fp(it);
        for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) g[(it.y + j) * inv.w + it.x + i] = it.id;
    }
    return g;
}
function fitsIn(inv, g, w, h, x, y) {
    if (x < 0 || y < 0 || x + w > inv.w || y + h > inv.h) return false;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[(y + j) * inv.w + x + i]) return false;
    return true;
}
function mark(inv, g, w, h, x, y, id) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[(y + j) * inv.w + x + i] = id;
}
function spotIn(inv, g, d) {
    for (let y = 0; y < inv.h; y++) {
        for (let x = 0; x < inv.w; x++) {
            if (fitsIn(inv, g, d.w, d.h, x, y)) return { x, y, r: 0 };
            if (d.w !== d.h && fitsIn(inv, g, d.h, d.w, x, y)) return { x, y, r: 1 };
        }
    }
    return null;
}
export function canPlaceAt(inv, id, x, y, r) {
    const it = inv.items.find((i) => i.id === id);
    if (!it) return false;
    const d = itemDef(it.t, it.lv);
    const w = r ? d.h : d.w, h = r ? d.w : d.h;
    return fitsIn(inv, gridOf(inv, id), w, h, x, y);
}
/** Which instance sits in a cell (0 if empty). */
export function cellAt(inv, x, y) {
    const g = gridOf(inv);
    return g[y * inv.w + x] || 0;
}

export function weightOf(G) {
    let w = 0;
    for (const it of G.inv.items) w += itemDef(it.t, it.lv).wt * it.n;
    return w;
}
export function usedCells(G) {
    let n = 0;
    for (const it of G.inv.items) { const f = fp(it); n += f.w * f.h; }
    return n;
}

/** How many units of (t, lv) would fit right now: partial stacks first, then free spots. */
export function room(G, t, lv = 0, want = 1e9) {
    lv = normLv(t, lv);
    const d = itemDef(t, lv);
    const inv = G.inv;
    let r = 0;
    for (const it of inv.items) if (it.t === t && it.lv === lv) r += d.stack - it.n;
    if (r >= want) return r;
    const g = gridOf(inv);
    for (let k = 0; k < 400 && r < want; k++) {
        const s = spotIn(inv, g, d);
        if (!s) break;
        mark(inv, g, s.r ? d.h : d.w, s.r ? d.w : d.h, s.x, s.y, -1);
        r += d.stack;
    }
    return r;
}

/** Add units to the wagon; returns how many actually fit. */
export function addItems(G, t, lv, n, extra = null) {
    lv = normLv(t, lv);
    const d = itemDef(t, lv);
    const inv = G.inv;
    let left = n;
    if (!extra) {
        for (const it of inv.items) {
            if (left <= 0) break;
            if (it.t === t && it.lv === lv && it.n < d.stack) {
                const take = Math.min(d.stack - it.n, left);
                it.n += take; left -= take;
            }
        }
    }
    const g = gridOf(inv);
    while (left > 0) {
        const s = spotIn(inv, g, d);
        if (!s) break;
        const take = Math.min(d.stack, left);
        const it = { id: G.nextId++, t, lv, n: take, x: s.x, y: s.y, r: s.r, fav: false, junk: false, ...(extra || {}) };
        inv.items.push(it);
        mark(inv, g, s.r ? d.h : d.w, s.r ? d.w : d.h, s.x, s.y, it.id);
        left -= take;
    }
    return n - left;
}

const byRemoval = (a, b) => (a.fav - b.fav) || (a.n - b.n) || (a.lv - b.lv);
/** Units in the wagon of exactly (t, lv) - or, for gear with minLv, at least that level. */
export function count(G, t, lv = 0, minMode = false) {
    let n = 0;
    for (const it of G.inv.items) if (it.t === t && (minMode ? it.lv >= lv : it.lv === normLv(t, lv))) n += it.n;
    return n;
}
/** Remove n units; with minMode takes the lowest levels first. Returns how many were removed. */
export function removeItems(G, t, lv, n, minMode = false) {
    const list = G.inv.items.filter((it) => it.t === t && (minMode ? it.lv >= lv : it.lv === normLv(t, lv)));
    list.sort((a, b) => a.lv - b.lv || byRemoval(a, b));
    let left = n;
    for (const it of list) {
        if (left <= 0) break;
        const take = Math.min(it.n, left);
        it.n -= take; left -= take;
    }
    G.inv.items = G.inv.items.filter((it) => it.n > 0);
    return n - left;
}
export function itemById(G, id) { return G.inv.items.find((i) => i.id === id) || null; }

export function moveItem(G, id, x, y, r) {
    const it = itemById(G, id);
    if (!it || !canPlaceAt(G.inv, id, x, y, r ? 1 : 0)) return false;
    it.x = x; it.y = y; it.r = r ? 1 : 0;
    return true;
}
/** Merge a stack onto another of the same kind (drag one onto the other). */
export function mergeStacks(G, fromId, toId) {
    const a = itemById(G, fromId), b = itemById(G, toId);
    if (!a || !b || a === b || a.t !== b.t || a.lv !== b.lv) return false;
    const d = itemDef(a.t, a.lv);
    const take = Math.min(d.stack - b.n, a.n);
    if (take <= 0) return false;
    b.n += take; a.n -= take;
    G.inv.items = G.inv.items.filter((it) => it.n > 0);
    return true;
}
/** Consolidate stacks and repack: big things first, grouped by kind. */
export function autoSort(G) {
    const inv = G.inv;
    const merged = new Map();
    for (const it of inv.items) {
        const k = it.t + ':' + it.lv + ':' + (it.fav ? 1 : 0) + ':' + (it.junk ? 1 : 0);
        const d = itemDef(it.t, it.lv);
        const arr = merged.get(k) || [];
        let n = it.n;
        for (const s of arr) { const take = Math.min(d.stack - s.n, n); s.n += take; n -= take; }
        if (n > 0) arr.push({ ...it, n });
        merged.set(k, arr);
    }
    const list = [...merged.values()].flat();
    const rank = (it) => { const d = itemDef(it.t, it.lv); return -(d.w * d.h) * 1000 + String(catOf(it.t)).charCodeAt(0) * 10 - it.lv; };
    list.sort((a, b) => rank(a) - rank(b) || (a.t < b.t ? -1 : 1));
    const out = [];
    const g = new Int32Array(inv.w * inv.h);
    for (const it of list) {
        const d = itemDef(it.t, it.lv);
        const s = spotIn(inv, g, d);
        if (!s) return false;               // cannot happen when the old layout fitted; keep the old one if it does
        const n = { ...it, x: s.x, y: s.y, r: s.r };
        out.push(n);
        mark(inv, g, s.r ? d.h : d.w, s.r ? d.w : d.h, s.x, s.y, n.id);
    }
    inv.items = out;
    return true;
}
export function resizeInv(G, w, h) { G.inv.w = w; G.inv.h = h; }

// ---------------------------------------------------------------- stash (list based)
export function stashCount(G, t, lv = 0, minMode = false) {
    let n = 0;
    for (const s of G.stash.items) if (s.t === t && (minMode ? s.lv >= lv : s.lv === normLv(t, lv))) n += s.n;
    return n;
}
export function stashRoom(G, t, lv = 0) {
    lv = normLv(t, lv);
    const d = itemDef(t, lv);
    let r = 0;
    for (const s of G.stash.items) if (s.t === t && s.lv === lv) r += d.stack - s.n;
    return r + (G.stash.cap - G.stash.items.length) * d.stack;
}
export function stashAdd(G, t, lv, n) {
    lv = normLv(t, lv);
    const d = itemDef(t, lv);
    let left = n;
    for (const s of G.stash.items) {
        if (left <= 0) break;
        if (s.t === t && s.lv === lv && s.n < d.stack) { const k = Math.min(d.stack - s.n, left); s.n += k; left -= k; }
    }
    while (left > 0 && G.stash.items.length < G.stash.cap) {
        const k = Math.min(d.stack, left);
        G.stash.items.push({ t, lv, n: k });
        left -= k;
    }
    return n - left;
}
export function stashRemove(G, t, lv, n, minMode = false) {
    const list = G.stash.items.filter((s) => s.t === t && (minMode ? s.lv >= lv : s.lv === normLv(t, lv))).sort((a, b) => a.lv - b.lv || a.n - b.n);
    let left = n;
    for (const s of list) { if (left <= 0) break; const k = Math.min(s.n, left); s.n -= k; left -= k; }
    G.stash.items = G.stash.items.filter((s) => s.n > 0);
    return n - left;
}
