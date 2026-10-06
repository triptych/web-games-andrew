// One save slot plus settings in localStorage. Every access is guarded: with storage blocked the game
// plays normally and simply doesn't remember anything.

const KEY = 'teeandsorcery.v1';
export const DEFAULT_SETTINGS = { music: 0.7, sfx: 0.85, quality: -1, gentle: false, shake: true, tips: true };

export function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { profile: null, settings: { ...DEFAULT_SETTINGS } };
        const d = JSON.parse(raw);
        return { profile: d.profile ?? null, settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) } };
    } catch (e) {
        console.warn('Tee & Sorcery: storage unavailable, progress will not be saved.', e?.name ?? '');
        return { profile: null, settings: { ...DEFAULT_SETTINGS } };
    }
}

export function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify({ profile: data.profile, settings: data.settings, at: Date.now() })); return true; } catch { return false; }
}

export function wipe() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
