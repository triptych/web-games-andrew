// Settings, high scores and unlocks in localStorage. Every access is guarded:
// with site data blocked the game still plays, it just forgets.

const KEY = 'chromechalice.v1';

const SEED_TABLE = [
    ['ROB', 50000, 6], ['SQR', 40000, 5], ['NEO', 30000, 4], ['VHS', 25000, 4], ['ZAP', 20000, 3],
    ['DRG', 15000, 3], ['BYT', 10000, 2], ['SUN', 7500, 2], ['GRD', 5000, 1], ['CHR', 2500, 1],
];

export function defaults() {
    return {
        settings: { sound: true, music: true, amb: true, volume: 0.8, crt: true, view: 'auto', shake: true, quality: 'auto', skill: 'novice', mode: 'arcade' },
        reached: 0,
        cassettes: [],
        cleared: false,
        hiscores: SEED_TABLE.map(([name, score, realm]) => ({ name, score, realm, mode: 'arcade' })),
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
            d.reached = Math.max(0, Math.min(5, +s.reached || 0));
            d.cleared = !!s.cleared;
            if (Array.isArray(s.cassettes)) d.cassettes = s.cassettes.filter((x) => typeof x === 'string').slice(0, 12);
            if (Array.isArray(s.hiscores) && s.hiscores.length) {
                d.hiscores = s.hiscores.slice(0, 10).map((e) => ({ name: String(e.name || '???').slice(0, 3), score: Math.max(0, +e.score || 0), realm: Math.max(1, Math.min(6, +e.realm || 1)), mode: e.mode === 'remix' ? 'remix' : 'arcade' }));
            }
        }
    } catch { /* blocked or corrupt: defaults */ }
    return d;
}

export function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* blocked */ }
}

/** Where a score would land in the table (0–9), or -1. */
export function rank(data, score) {
    if (score <= 0) return -1;
    const i = data.hiscores.findIndex((h) => score > h.score);
    if (i >= 0) return i;
    return data.hiscores.length < 10 ? data.hiscores.length : -1;
}

export function record(data, entry) {
    const i = rank(data, entry.score);
    if (i < 0) return -1;
    data.hiscores.splice(i, 0, entry);
    data.hiscores.length = Math.min(10, data.hiscores.length);
    return i;
}
