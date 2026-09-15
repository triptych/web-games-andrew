// ============================================================
// core/bus.js - the one EventBus (GDD §24)
// Payloads are plain data. Past tense means it happened.
// ============================================================
import { DEV } from './util.js';

export class EventBus {
  constructor() { this.h = new Map(); this.depth = 0; this.queue = []; }

  on(type, fn) {
    let list = this.h.get(type);
    if (!list) { list = []; this.h.set(type, list); }
    list.push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const a = this.h.get(type);
    if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  }

  once(type, fn) {
    const un = this.on(type, (...a) => { un(); fn(...a); });
    return un;
  }

  /** Synchronous dispatch, re-entrancy safe: nested emits are queued and drained. */
  emit(type, payload) {
    this.queue.push([type, payload]);
    if (this.depth > 0) return;
    this.depth = 1;
    try {
      while (this.queue.length) {
        const [t, p] = this.queue.shift();
        const list = this.h.get(t);
        if (!list) continue;
        const snapshot = list.slice();
        for (let i = 0; i < snapshot.length; i++) {
          try { snapshot[i](p); }
          catch (e) {
            console.error(`[bus] handler for ${t} threw`, e);
            if (DEV) throw e;
          }
        }
      }
    } finally { this.depth = 0; this.queue.length = 0; }
  }

  clear() { this.h.clear(); this.queue.length = 0; this.depth = 0; }
}

export const bus = new EventBus();
