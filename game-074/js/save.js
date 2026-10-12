// Settings, unlocked stages and high scores in localStorage. Every access is
// guarded: with site data blocked the game still plays, it just forgets.

const KEY = 'cinderwing.v1';

export function defaults() {
    return {
        settings: { sound: true, music: true, volume: 0.8, quality: 'auto', shake: true, autofire: 'touch', difficulty: 'seraph' },
        reached: 0,          // furthest stage index reached (0–6), unlocks Stage Select
        cleared: false,      // has finished the game at least once
        best: { pilgrim: 0, seraph: 0, archangel: 0 },
        hiscores: [],        // [{ score, diff, stage, date }]
    };
}

export function load() {
    const d = defaults();
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return d;
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
            if (s.settings) Object.assign(d.settings, s.settings);
            d.reached = Math.max(0, Math.min(6, +s.reached || 0));
            d.cleared = !!s.cleared;
            if (s.best) for (const k of Object.keys(d.best)) d.best[k] = Math.max(0, +s.best[k] || 0);
            if (Array.isArray(s.hiscores)) d.hiscores = s.hiscores.slice(0, 10).map((e) => ({ score: +e.score || 0, diff: String(e.diff || 'seraph'), stage: +e.stage || 1, date: String(e.date || '') }));
        }
    } catch { /* blocked or corrupt: defaults */ }
    return d;
}

export function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* blocked */ }
}

/** Record a finished run. Returns the table index it took, or -1. */
export function record(data, score, diff, stage) {
    if (score <= 0) return -1;
    data.best[diff] = Math.max(data.best[diff] || 0, score);
    const e = { score, diff, stage, date: new Date().toISOString().slice(0, 10) };
    let i = data.hiscores.findIndex((h) => score > h.score);
    if (i < 0) i = data.hiscores.length;
    if (i >= 10) return -1;
    data.hiscores.splice(i, 0, e);
    data.hiscores.length = Math.min(10, data.hiscores.length);
    return i;
}
