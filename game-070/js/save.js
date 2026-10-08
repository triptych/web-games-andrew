// High scores and settings in localStorage. Every access is guarded: with site data
// blocked the game still plays, it just can't remember anything.

const KEY = 'phosphor-patrol.v1';

const DEFAULT_TABLE = [
    ['EJD', 60000, '14'], ['LUM', 45000, '11'], ['SNT', 35000, '9'], ['VEC', 25000, '7'], ['ZAP', 20000, '6'],
    ['RAY', 15000, '5'], ['BOB', 10000, '4'], ['KID', 7500, '3'], ['MOM', 5000, '2'], ['DAD', 2500, '1'],
].map(([name, score, wave]) => ({ name, score, wave }));

function defaults() {
    return { hiscores: DEFAULT_TABLE.map((e) => ({ ...e })), settings: { sound: true, music: true, crt: true, difficulty: 'arcade' }, maxWave: 0 };
}

export function load() {
    const d = defaults();
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return d;
        const s = JSON.parse(raw);
        if (Array.isArray(s.hiscores) && s.hiscores.length) d.hiscores = s.hiscores.slice(0, 10).map((e) => ({ name: String(e.name || '???').slice(0, 3), score: +e.score || 0, wave: String(e.wave || '1').slice(0, 4) }));
        if (s.settings) Object.assign(d.settings, s.settings);
        d.maxWave = Math.max(0, Math.min(14, +s.maxWave || 0));
    } catch { /* blocked or corrupt: defaults */ }
    return d;
}

export function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* blocked */ }
}

/** Index the score would take in the table, or -1. */
export function rankOf(table, score) {
    if (score <= 0) return -1;
    for (let i = 0; i < 10; i++) if (!table[i] || score > table[i].score) return i;
    return -1;
}
