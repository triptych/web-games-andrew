// A tiny event bus. Editor modules emit what happened ('change', 'edit',
// 'project', 'select-map', …); the meta-game and the views listen.
const handlers = new Map();

export const bus = {
    on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => this.off(name, fn); },
    off(name, fn) { const s = handlers.get(name); if (s) s.delete(fn); },
    emit(name, data) {
        const s = handlers.get(name);
        if (!s) return;
        for (const fn of [...s]) { try { fn(data); } catch (e) { console.error('bus ' + name, e); } }
    },
};
