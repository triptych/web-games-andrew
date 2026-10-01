/** bus.js — a tiny pub/sub used between sim actions and the UI. */

const subs = new Map();
export function on(type, fn) {
    if (!subs.has(type)) subs.set(type, new Set());
    subs.get(type).add(fn);
    return () => subs.get(type).delete(fn);
}
export function emit(type, data) {
    const s = subs.get(type);
    if (s) for (const fn of [...s]) fn(data);
    const any = subs.get('*');
    if (any) for (const fn of [...any]) fn(type, data);
}
