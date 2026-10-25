// Cartridges and settings in localStorage. Every access is guarded: with storage blocked the
// console still works, it just can't remember anything between visits.
//
// The store is { v, cur, carts: [ { id, cart } ] }. `cur` is the cart in the console: an id, or
// 'starter' for the built-in Dragon's Hoard, which is read-only (copy it to change it).

import { SAVE_KEY, LIMITS } from './config.js';
import { sanitizeCart, starterCart, newCart } from './sim/cart.js';

const CARTS_KEY = SAVE_KEY + '.carts';
const SETTINGS_KEY = SAVE_KEY + '.settings';
const reduced = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto', calm: reduced() };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function emptyStore() { return { v: 1, cur: 'starter', carts: [] }; }

export function loadStore() {
    const raw = read(CARTS_KEY);
    const store = emptyStore();
    if (!raw || raw.v !== 1 || !Array.isArray(raw.carts)) return store;
    for (const e of raw.carts.slice(0, LIMITS.carts)) {
        try {
            if (typeof e.id !== 'string' || !/^c[0-9a-z]{1,12}$/.test(e.id)) continue;
            store.carts.push({ id: e.id, cart: sanitizeCart(e.cart) });
        } catch (err) { console.warn('[save] skipped an unreadable cart', err.message); }
    }
    store.cur = raw.cur === 'starter' || store.carts.some((c) => c.id === raw.cur) ? raw.cur : 'starter';
    return store;
}

export function saveStore(store) { return write(CARTS_KEY, store); }
export function clearStore() { try { localStorage.removeItem(CARTS_KEY); } catch { /* blocked */ } }

// ------------------------------------------------------------------ store operations (pure on the store object)

let counter = 0;
const freshId = (store) => {
    for (;;) {
        const id = 'c' + (Date.now() % 1e9).toString(36) + (counter++).toString(36);
        if (!store.carts.some((c) => c.id === id)) return id;
    }
};

export function getCart(store, id = store.cur) {
    if (id === 'starter') return starterCart();
    return store.carts.find((c) => c.id === id)?.cart || null;
}

export function addCart(store, cart) {
    if (store.carts.length >= LIMITS.carts) return null;
    const id = freshId(store);
    store.carts.push({ id, cart });
    return id;
}

export function newBlank(store, name = 'My Cart') { return addCart(store, newCart(name)); }

export function copyCart(store, id) {
    const src = getCart(store, id);
    if (!src) return null;
    const copy = sanitizeCart(JSON.parse(JSON.stringify(src)));
    copy.name = (id === 'starter' ? src.name : src.name.slice(0, 11) + ' copy').slice(0, LIMITS.name);
    return addCart(store, copy);
}

export function deleteCart(store, id) {
    store.carts = store.carts.filter((c) => c.id !== id);
    if (store.cur === id) store.cur = 'starter';
}

/** The cart to edit: the current one, or a fresh copy if it is the read-only starter. */
export function editableCurrent(store) {
    if (store.cur === 'starter') {
        const id = copyCart(store, 'starter');
        if (id) store.cur = id;
    }
    return getCart(store, store.cur);
}
