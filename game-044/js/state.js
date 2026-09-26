/**
 * state.js — everything that makes one playthrough different from another.
 *
 * The whole state is plain JSON: inventory, flags, the scene and Rowan's
 * position, which points have been earned, and the Chronicle (the story the
 * Book of Tales writes about you as you play). Saving is JSON.stringify, and a
 * death simply restores a snapshot taken before the fatal action.
 */

import { events } from './events.js';

const SAVE_KEY = 'game-044-save';
const AUTO_KEY = 'game-044-autosave';
const ENDINGS_KEY = 'game-044-endings';
const PREFS_KEY = 'game-044-prefs';

/** Every point in the game, keyed so each can only be earned once. */
export const SCORE = {
    mabBook: 5, cake: 2, rope: 2, poker: 2,
    pellEnding: 5, wellKey: 10, pellButton: 5,
    troll: 10, moonbells: 3, quill: 10,
    wennaStory: 5, bone: 2, draught: 8, drowsyBone: 5,
    riddles: 15, hound: 10,
    ladder: 5, mabBottle: 8, pourBottle: 15, silverKey: 5,
    towerDoor: 5, diary: 5, musicBox: 10, readTale: 3,
};
export const ENDING_SCORE = { keeper: 45, gift: 30, loom: 15 };
export const MAX_SCORE = Object.values(SCORE).reduce((a, b) => a + b, 0) + Math.max(...Object.values(ENDING_SCORE));

export const ENDINGS = {
    keeper: { title: "The Keeper's Daughter", hint: 'Some endings have to be written by the one who began them.' },
    gift: { title: 'The Gift of Rowan', hint: 'A story is the only thing you can give away and still have.' },
    loom: { title: 'The Broken Loom', hint: 'Not every knot needs untying. Some just need an iron poker.' },
};

class GameState {
    constructor() { this.reset(); }

    reset() {
        this.scene = 'cottage';
        this.pos = null;          // [x, y, facing] — null means "use the scene's entry point"
        this.from = null;
        this.inv = [];
        this.flags = {};
        this.earned = {};
        this.score = 0;
        this.chronicle = [];
        this.visited = {};
        this.deaths = 0;
    }

    // --- inventory -------------------------------------------------------
    has(id) { return this.inv.includes(id); }
    give(id) {
        if (!this.has(id)) this.inv.push(id);
        events.emit('inventory');
    }
    take(id) {
        this.inv = this.inv.filter(i => i !== id);
        events.emit('inventory');
    }

    // --- flags -------------------------------------------------------------
    flag(k) { return !!this.flags[k]; }
    set(k, v = true) { this.flags[k] = v; events.emit('flags'); }

    // --- score -------------------------------------------------------------
    /** Returns the points actually awarded (0 if already earned). */
    award(key, pts = SCORE[key] ?? ENDING_SCORE[key] ?? 0) {
        if (this.earned[key]) return 0;
        this.earned[key] = true;
        this.score += pts;
        events.emit('score', this.score, pts);
        return pts;
    }

    // --- chronicle ----------------------------------------------------------
    chron(id, text) {
        if (this.chronicle.some(c => c.id === id)) return false;
        this.chronicle.push({ id, text });
        events.emit('chronicle');
        return true;
    }

    // --- persistence ---------------------------------------------------------
    toJSON() {
        return {
            v: 1, t: Date.now(), scene: this.scene, pos: this.pos, inv: this.inv, flags: this.flags,
            earned: this.earned, score: this.score, chronicle: this.chronicle,
            visited: this.visited, deaths: this.deaths,
        };
    }

    load(o) {
        this.reset();
        Object.assign(this, JSON.parse(JSON.stringify(o)));
        events.emit('inventory');
        events.emit('score', this.score, 0);
        events.emit('chronicle');
    }

    snapshot() { return JSON.stringify(this.toJSON()); }
    restore(snap) { this.load(JSON.parse(snap)); }

    save(auto = false) { return store(auto ? AUTO_KEY : SAVE_KEY, JSON.stringify(this.toJSON())); }
}

export const state = new GameState();

// --- storage helpers: every access guarded, the game must run without it ---

function store(key, val) {
    try { localStorage.setItem(key, val); return true; } catch { return false; }
}
function fetchKey(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

export function readSave(auto = false) {
    const raw = fetchKey(auto ? AUTO_KEY : SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

/** The most recent of the manual save and the autosave. */
export function latestSave() {
    const a = readSave(false), b = readSave(true);
    if (!a || !b) return a || b;
    return (a.t || 0) > (b.t || 0) ? a : b;
}

export function endingsFound() {
    try { return JSON.parse(fetchKey(ENDINGS_KEY) || '[]'); } catch { return []; }
}

export function recordEnding(id) {
    const found = endingsFound();
    if (!found.includes(id)) found.push(id);
    store(ENDINGS_KEY, JSON.stringify(found));
    return found;
}

export function prefs() {
    try { return { sound: true, textSpeed: 2, ...JSON.parse(fetchKey(PREFS_KEY) || '{}') }; } catch { return { sound: true, textSpeed: 2 }; }
}
export function savePrefs(p) { store(PREFS_KEY, JSON.stringify(p)); }
