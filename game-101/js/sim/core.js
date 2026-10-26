// Small helpers every sim module shares: events, the message log line, clamps.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const ev = (G, type, o = {}) => { G.events.push({ type, ...o }); };
/** A line for the message log, in an EGA colour. */
export const say = (G, text, c = 15) => { G.events.push({ type: 'msg', text, c }); };
export const uid = (G) => ++G.uid;
export const avgLvl = (G) => {
    const p = G.party;
    return p.length ? p.reduce((a, m) => a + m.lvl, 0) / p.length : 1;
};
export const roman = (n) => {
    const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
    return s;
};
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));
