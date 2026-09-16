/**
 * save.js — persistence to localStorage.
 *
 * The world is a pure function of its seed, so a save does not have to store
 * any terrain, vegetation, structures or item placement: re-running the
 * generator with the same seed reproduces all of it exactly. What must be
 * stored is everything the *player* did — where they are standing, what they
 * have picked up, what they have returned, which quests are done, and which
 * cells of the fog-of-war map they have revealed.
 *
 * The fog grid is the only bulky piece. It is a ~94x94 Uint8Array of 0/1, which
 * as JSON is around 18KB of "0,1,1,0" — enough to be wasteful in a 5MB quota
 * shared with every other game on the origin. Run-length encoding it takes a
 * typical explored map to a few hundred bytes, because revealed area is
 * strongly contiguous by construction (it is a disc swept along a walk).
 *
 * Per-cell map *colours* are deliberately not stored: they are a deterministic
 * sample of the heightmap and region map, so they are re-derived on load from
 * the same seed. Storing them would quadruple the save for no information.
 *
 * Schema changes: bump SAVE_VERSION and a mismatched save is discarded rather
 * than half-loaded. Silently reviving an old save into changed code is how you
 * get a player stuck inside a wall that did not exist when they saved.
 */

import { state } from '../state.js';
import { inventory } from './inventory.js';
import { events } from '../events.js';
import { CELL_SEEN, CELL_UNKNOWN } from './mapstate.js';
import { SEED_STORAGE_KEY } from '../config.js';

const SAVE_KEY = 'island-walker-save-v1';
const SAVE_VERSION = 1;

// Minimum gap between autosaves triggered by walking. Pickups, deposits and
// quest completions save immediately regardless — those are the moments a
// player would be annoyed to lose — so this only paces the "still walking"
// case, where writing every frame would serialize the map grid 60 times a
// second for no benefit.
const AUTOSAVE_INTERVAL = 20; // seconds

/**
 * RLE as a flat array of run lengths, starting from CELL_UNKNOWN and
 * alternating. A leading 0-length run handles a grid whose very first cell is
 * already revealed, so the decoder never needs to know the starting value.
 */
function encodeCells(cells) {
    const runs = [];
    let current = CELL_UNKNOWN;
    let run = 0;
    for (let i = 0; i < cells.length; i++) {
        const v = cells[i] === CELL_SEEN ? CELL_SEEN : CELL_UNKNOWN;
        if (v === current) {
            run++;
        } else {
            runs.push(run);
            current = v;
            run = 1;
        }
    }
    runs.push(run);
    return runs;
}

function decodeCells(runs, length) {
    const cells = new Uint8Array(length);
    let value = CELL_UNKNOWN;
    let i = 0;
    for (const run of runs) {
        if (value === CELL_SEEN) {
            const end = Math.min(i + run, length);
            cells.fill(CELL_SEEN, i, end);
        }
        i += run;
        value = value === CELL_SEEN ? CELL_UNKNOWN : CELL_SEEN;
        if (i >= length) break;
    }
    return cells;
}

export class SaveManager {
    /**
     * @param ctx { seedString, camera, world, itemManager, collections,
     *              mapState, quests } — everything with persistent player state.
     *        `seedString` is the raw seed as stored in sessionStorage, not the
     *        hashed integer: reloading has to reproduce the same string so the
     *        same island is generated.
     */
    constructor(ctx) {
        this.ctx = ctx;
        this._sinceAutosave = 0;
        this._dirty = false;
        this._enabled = true;
    }

    /**
     * Save on the events that represent real progress, plus mark the save dirty
     * so the timed autosave covers plain walking (which moves the player and
     * reveals map cells but fires no milestone event).
     */
    start() {
        const immediate = ['itemCollected', 'progressChanged', 'questCompleted', 'gameComplete'];
        for (const ev of immediate) events.on(ev, () => this.save());
        events.on('mapExplored', () => { this._dirty = true; });
    }

    /** Called from the frame loop; handles the time-based autosave only. */
    update(dt) {
        if (!this._dirty) return;
        this._sinceAutosave += dt;
        if (this._sinceAutosave >= AUTOSAVE_INTERVAL) this.save();
    }

    /**
     * The seed string of the stored save, without needing an instance.
     *
     * Boot needs this before it can build anything — the world has to be
     * generated from the *saved* seed for the save to be loadable at all — and
     * at that point there is no SaveManager yet, because constructing one
     * requires the world. Hence the static read.
     */
    static storedSeedString() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || data.version !== SAVE_VERSION) return null;
            return data.seedString || null;
        } catch {
            return null;
        }
    }

    hasSave() {
        return !!this._read();
    }

    /** The stored save's seed string, or null — used to decide whether to resume. */
    savedSeedString() {
        const data = this._read();
        return data ? data.seedString : null;
    }

    _read() {
        let raw;
        try {
            raw = localStorage.getItem(SAVE_KEY);
        } catch {
            return null; // private browsing / storage disabled
        }
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            if (!data || data.version !== SAVE_VERSION) return null;
            return data;
        } catch {
            return null;
        }
    }

    serialize() {
        const { seedString, camera, collections, mapState, quests } = this.ctx;
        return {
            version: SAVE_VERSION,
            savedAt: Date.now(),
            seedString,
            player: {
                pos: [camera.pos[0], camera.pos[1], camera.pos[2]],
                yaw: camera.yaw,
                pitch: camera.pitch,
            },
            progress: {
                collectedIds: [...state.collectedIds],
                booksShelved: state.booksShelved,
                artifactsDisplayed: state.artifactsDisplayed,
                region: state.currentRegion,
            },
            inventory: inventory.serialize(),
            quests: quests.serialize(),
            // Only the count is stored per site: the display geometry is rebuilt
            // deterministically from slot index (see collections.rebuildDisplays),
            // so persisting meshes or positions would be storing derived data.
            collections: {
                shelvedBooks: collections.shelvedBooks.length,
                displayedArtifacts: collections.displayedArtifacts.length,
            },
            map: {
                size: mapState.size,
                cells: encodeCells(mapState.cells),
                spotted: [...mapState.items.values()].filter(e => e.spotted).map(e => e.id),
                regions: mapState.regions.map(r => (r.discovered ? 1 : 0)),
            },
        };
    }

    save() {
        if (!this._enabled) return false;
        this._dirty = false;
        this._sinceAutosave = 0;
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
            events.emit('gameSaved', { at: Date.now() });
            return true;
        } catch (err) {
            // Quota exceeded or storage blocked. Not fatal — the game is still
            // perfectly playable unsaved — but the player should know, or they
            // will assume their walk is being kept when it is not.
            this._enabled = false;
            events.emit('saveFailed', { message: String(err && err.message || err) });
            return false;
        }
    }

    /**
     * Apply a stored save to live state. Must run after the world and all the
     * player-facing systems exist, and before the first frame, so the loaded
     * position is what the first render sees.
     *
     * Returns false (leaving everything at its fresh-start values) if there is
     * no usable save, or if the save is for a different island than the one
     * currently generated — restoring a position and a fog map onto different
     * terrain would put the player inside a hill with a map of somewhere else.
     */
    load() {
        const data = this._read();
        if (!data) return false;
        const { seedString, camera, collections, mapState, quests, itemManager } = this.ctx;
        if (data.seedString !== seedString) return false;

        // --- player ---
        if (data.player && Array.isArray(data.player.pos)) {
            camera.pos = data.player.pos.slice();
            if (typeof data.player.yaw === 'number') camera.yaw = data.player.yaw;
            if (typeof data.player.pitch === 'number') camera.pitch = data.player.pitch;
        }

        // --- collections + counters ---
        // Restored through state's own loader rather than by poking its private
        // fields, so the derived carried counts and the completion check stay
        // consistent with however state.js computes them.
        const inv = data.inventory || {};
        inventory.deserialize(inv);
        state.restore({
            collectedIds: data.progress ? data.progress.collectedIds : [],
            booksShelved: data.progress ? data.progress.booksShelved : 0,
            artifactsDisplayed: data.progress ? data.progress.artifactsDisplayed : 0,
            carriedBooks: inventory.countOf('book'),
            carriedArtifacts: inventory.countOf('artifact'),
        });

        // Items already picked up must not be standing in the world again.
        for (const item of itemManager.all) {
            if (state.collectedIds.has(item.id)) item.collected = true;
        }

        collections.rebuildDisplays(
            data.collections ? data.collections.shelvedBooks : 0,
            data.collections ? data.collections.displayedArtifacts : 0,
            camera.pos,
        );

        // --- map ---
        const m = data.map;
        if (m && m.size === mapState.size && Array.isArray(m.cells)) {
            mapState.restoreCells(decodeCells(m.cells, mapState.size * mapState.size));
            if (Array.isArray(m.spotted)) {
                for (const id of m.spotted) {
                    const entry = mapState.items.get(id);
                    if (entry) entry.spotted = true;
                }
            }
            for (const entry of mapState.items.values()) {
                if (state.collectedIds.has(entry.id)) {
                    entry.spotted = true;
                    entry.collected = true;
                }
            }
            if (Array.isArray(m.regions)) {
                m.regions.forEach((flag, i) => {
                    if (flag && mapState.regions[i]) mapState.regions[i].discovered = true;
                });
            }
        }

        // --- quests ---
        // Restore first, then let start() re-test: a quest whose definition
        // changed since the save can still complete on its own terms.
        quests.deserialize(data.quests);

        events.emit('gameLoaded', { savedAt: data.savedAt });
        return true;
    }

    clear() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch {
            /* storage unavailable — nothing to clear */
        }
        this._enabled = true;
    }

    /**
     * Load a save mid-session by reloading the page into it.
     *
     * Restoring a save without a reload would mean regenerating the world, the
     * item placement, the chunk cache and the map grid from the stored seed —
     * which is precisely what boot already does. Writing a second construction
     * path that only ever runs from this one button is how you end up with a
     * "Load" that quietly diverges from a page load. So: put the saved seed
     * where boot will find it, and let boot do its job.
     */
    reloadIntoSave() {
        const data = this._read();
        if (!data) return false;
        try {
            sessionStorage.setItem(SEED_STORAGE_KEY, data.seedString);
        } catch {
            return false;
        }
        // Strip ?seed= if present: it takes precedence over sessionStorage during
        // seed resolution, so leaving it on would reload a different island than
        // the one being loaded.
        const url = new URL(location.href);
        url.searchParams.delete('seed');
        location.replace(url.toString());
        return true;
    }

    /** Discard the save and reload onto a freshly generated island. */
    startNewIsland() {
        this.clear();
        this._enabled = false; // no autosave can fire between here and the reload
        try {
            sessionStorage.removeItem(SEED_STORAGE_KEY);
        } catch {
            /* storage unavailable — a reload will pick a fresh seed anyway */
        }
        const url = new URL(location.href);
        url.searchParams.delete('seed');
        location.replace(url.toString());
    }

    /** Human-readable age of the stored save, for the resume prompt. */
    savedAgeText() {
        const data = this._read();
        if (!data || !data.savedAt) return '';
        const mins = Math.floor((Date.now() - data.savedAt) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
}
