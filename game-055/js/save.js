// Profile persistence. Every read and write is guarded: private windows and
// blocked storage just mean progress lasts until the tab closes.

const KEY = 'rotorstorm.v1';

export const DEFAULT_SETTINGS = {
    music: 0.6, sfx: 0.8, shake: 1, reduceFlash: false, quality: 'auto', sens: 1.2,
    autofire: true, hitbox: false, scan: false, fps: false,
};

export function defaultProfile() {
    return {
        salvage: 0, owned: {}, cleared: [], best: {}, survivors: {}, survivorsTotal: {},
        endlessBest: 0, difficulty: 'pilot', nextOp: 0, prologueSeen: false, endingSeen: false,
        settings: { ...DEFAULT_SETTINGS }, playTime: 0, kills: 0,
    };
}

export function loadProfile() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaultProfile();
        const p = JSON.parse(raw);
        const d = defaultProfile();
        return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) } };
    } catch { return defaultProfile(); }
}

export function saveProfile(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}

export function resetProfile() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    return defaultProfile();
}
