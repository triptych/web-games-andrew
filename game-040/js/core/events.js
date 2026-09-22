/**
 * events.js — tiny synchronous pub/sub. Shared by sim, view, ui and audio so
 * the simulation can announce things ("pod rescued", "boss phase") without
 * importing anything that touches the DOM or three.js.
 */

const handlers = new Map();

export const events = {
    on(name, fn) {
        if (!handlers.has(name)) handlers.set(name, new Set());
        handlers.get(name).add(fn);
        return () => events.off(name, fn);
    },
    off(name, fn) {
        handlers.get(name)?.delete(fn);
    },
    once(name, fn) {
        const un = events.on(name, (...a) => { un(); fn(...a); });
        return un;
    },
    emit(name, payload) {
        const set = handlers.get(name);
        if (!set) return;
        for (const fn of [...set]) {
            try { fn(payload); }
            catch (err) { console.error(`[events] handler for "${name}" threw`, err); }
        }
    },
    clear() { handlers.clear(); },
};

export default events;
