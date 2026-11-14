// What the console remembers. Favorites live under the Garden's own key
// (`garden.starred`, an array of game ids in the order they were starred), so
// a game starred on the island shows up here and the other way round.
// Recently played and the settings are the console's own.
//
// localStorage can throw (private windows, blocked site data). Everything
// still works then, it just lasts until the page is closed.

export const FAV_KEY = 'garden.starred';
const RECENT_KEY = 'console.recent';
const SETTINGS_KEY = 'console.settings';

export const DEFAULTS = Object.freeze({
    sound: true,
    haptics: true,
    shell: 'mint',
    glow: 'mint',
    newTab: false,
});

function canStore() {
    try {
        const k = 'console.__probe';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
    } catch {
        return false;
    }
}

function read(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
    } catch {
        return fallback;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage unavailable: keep it in memory */
    }
}

export class Store {
    constructor(games) {
        this.ids = new Set(games.map((g) => g.id));
        this.persist = canStore();
        this.favs = [];
        this.recent = [];
        this.reload();
        const saved = read(SETTINGS_KEY, {});
        this.settings = { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
    }

    /** Re-read from storage (another tab, or the Garden, may have changed it). */
    reload() {
        if (!this.persist) return;
        const f = read(FAV_KEY, []);
        this.favs = Array.isArray(f) ? f.filter((id) => this.ids.has(id)) : [];
        const r = read(RECENT_KEY, []);
        this.recent = Array.isArray(r) ? r.filter((x) => x && this.ids.has(x.id) && Number.isFinite(x.t)) : [];
    }

    isFav(id) {
        return this.favs.includes(id);
    }

    /** Star or unstar; returns the new state. */
    toggleFav(id) {
        // Start from what is stored now, so a star added in the Garden in
        // another tab is not lost, and ids this console doesn't know are kept.
        let list = this.persist ? read(FAV_KEY, []) : [...this.favs];
        if (!Array.isArray(list)) list = [];
        const on = !list.includes(id);
        list = on ? [...list, id] : list.filter((x) => x !== id);
        write(FAV_KEY, list);
        this.favs = list.filter((x) => this.ids.has(x));
        return on;
    }

    played(id) {
        this.recent = [{ id, t: Date.now() }, ...this.recent.filter((r) => r.id !== id)].slice(0, 40);
        write(RECENT_KEY, this.recent);
    }

    clearRecent() {
        this.recent = [];
        write(RECENT_KEY, this.recent);
    }

    set(key, value) {
        this.settings[key] = value;
        write(SETTINGS_KEY, this.settings);
    }
}
