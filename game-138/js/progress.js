// A tiny tally of slow work in flight (textures being painted, models loading, shaders compiling), so the loading
// screen and the "painting…" chip can say what is happening and how far along it is.

const work = {};             // kind → { total, done }
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(work); };

export function addWork(kind, n = 1) {
    const w = (work[kind] ||= { total: 0, done: 0 });
    w.total += n;
    emit();
}
export function doneWork(kind, n = 1) {
    const w = (work[kind] ||= { total: 0, done: 0 });
    w.done = Math.min(w.total, w.done + n);
    emit();
}
/** Work of a kind still to do (all kinds when none given). */
export function pending(kind) {
    if (kind) { const w = work[kind]; return w ? w.total - w.done : 0; }
    return Object.values(work).reduce((a, w) => a + w.total - w.done, 0);
}
export function onProgress(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const progressState = work;
