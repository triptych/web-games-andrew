// ============================================================
// core/bus.js - the one event bus.
// UI listens, systems emit. Systems never reach into the DOM.
// ============================================================
const listeners = new Map();

export const bus = {
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => bus.off(name, fn);
  },
  once(name, fn) {
    const off = bus.on(name, (...a) => { off(); fn(...a); });
    return off;
  },
  off(name, fn) {
    const set = listeners.get(name);
    if (set) set.delete(fn);
  },
  emit(name, payload) {
    const set = listeners.get(name);
    if (!set) return;
    // Copy: a handler may unsubscribe (or subscribe) during dispatch.
    for (const fn of [...set]) {
      try { fn(payload); }
      catch (err) { console.error(`[bus] ${name}`, err); }
    }
  },
  clear() { listeners.clear(); },
};
