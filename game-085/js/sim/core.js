// Small helpers every sim module shares: events for the view, the journal, clamping.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** An event for the view, the sound and the HUD. Silent while the sim catches up on time away. */
export function emit(G, e) {
    if (!G.quiet) G.events.push(e);
}

/**
 * A line in the journal. k is its kind (it picks the icon), hi marks a highlight: highlights are what the
 * "while you were away" chronicle lists.
 */
export function log(G, k, s, hi = false) {
    G.log.push({ t: G.t, k, s, hi });
    if (G.log.length > 400) G.log.splice(0, G.log.length - 400);
}

export function fmtGold(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return String(n);
}

export function plural(n, one, many = one + 's') { return `${n} ${n === 1 ? one : many}`; }
