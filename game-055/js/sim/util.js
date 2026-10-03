export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * Step a script generator. `h.gen` yields seconds to wait; waits accumulate
 * so a rhythm of `yield 0.1` stays exact at any step size.
 */
export function runGen(h, dt) {
    if (!h.gen) return;
    h.wait -= dt;
    let guard = 0;
    while (h.wait <= 0 && h.gen && guard++ < 64) {
        const r = h.gen.next();
        if (r.done) { h.gen = null; break; }
        h.wait += r.value || 0;
    }
    if (h.wait < -0.25) h.wait = -0.25;
}
