// A tiny event emitter. The simulation emits; the UI listens.
export class Emitter {
    constructor() { this.h = new Map(); }
    on(ev, fn) {
        if (!this.h.has(ev)) this.h.set(ev, new Set());
        this.h.get(ev).add(fn);
        return () => this.h.get(ev)?.delete(fn);
    }
    emit(ev, data) {
        const s = this.h.get(ev);
        if (s) for (const fn of [...s]) fn(data);
        const any = this.h.get('*');
        if (any) for (const fn of [...any]) fn(ev, data);
    }
}
