/**
 * quests.js — the objective layer: what the player is being asked to do next.
 *
 * The island generates differently every seed, so the quests are hand-written
 * against things that are *guaranteed* to exist (regions.js always seeds one
 * library, museum, cave, lighthouse, cemetery, garden and ruins) rather than
 * generated from the seed. A templated objective would occasionally ask for
 * something a given island cannot provide, or ask for something the player has
 * already done by accident, and either one reads as a bug.
 *
 * Two tracks:
 *   - the main chain, strictly ordered, one active step at a time: it teaches
 *     the loop (find something, find the library, return it) and then points at
 *     the two collections;
 *   - side quests, all live at once, keyed to visiting the landmark regions and
 *     to charting the map. These are the "go and look at the island" objectives,
 *     and they exist because the collections alone will not necessarily take you
 *     to the lighthouse or down into the cave.
 *
 * Progress is entirely event-driven — nothing here polls the world. Each quest
 * declares which events can advance it and a `test` that reads current state,
 * so adding a quest never means touching the game loop.
 */

import { events } from '../events.js';
import { state } from '../state.js';
import { inventory } from './inventory.js';
import { BOOK_COUNT, ARTIFACT_COUNT } from '../config.js';

// Map exploration fraction required by the surveyor side quest. Deliberately
// well short of 1: the last few percent of a fog-of-war grid is spent hunting
// single unrevealed cells in open water, which is tedious rather than
// exploratory.
const SURVEY_TARGET = 0.55;

/**
 * The definitions. Each entry:
 *   id     — stable key, used by saves; never reuse or renumber these.
 *   title  — imperative, short enough for the HUD's one-line objective slot.
 *   detail — one sentence of why, shown in the journal panel.
 *   track  — 'main' (ordered) or 'side' (all active at once).
 *   on     — event names that could plausibly change this quest's status.
 *   test   — pure predicate over game state; true once complete.
 *   progress — optional [have, need] for a counter in the journal.
 */
function questDefs(deps) {
    const { mapState } = deps;
    const visited = (type) => mapState.regions.some(r => r.type === type && r.discovered);

    return [
        // ---- main chain ----
        {
            id: 'find-first-item', track: 'main',
            title: 'Find something worth keeping',
            detail: 'Books and artifacts are scattered across the island. Walk into one to pick it up.',
            on: ['itemCollected'],
            test: () => inventory.log.length > 0,
        },
        {
            id: 'find-library', track: 'main',
            title: 'Find the Library',
            detail: 'Somewhere on the island is a library with empty shelves. Open the overmap with M once you have seen enough ground to guess where.',
            on: ['mapExplored', 'regionEntered'],
            test: () => visited('library') || state.booksShelved > 0,
        },
        {
            id: 'shelve-first-book', track: 'main',
            title: 'Shelve your first book',
            detail: 'Carry a book inside the library. Anything you are carrying is shelved automatically when you step in.',
            on: ['progressChanged'],
            test: () => state.booksShelved > 0,
        },
        {
            id: 'display-first-artifact', track: 'main',
            title: 'Display your first artifact',
            detail: 'The museum works the same way: bring an artifact in and it goes on a pedestal.',
            on: ['progressChanged'],
            test: () => state.artifactsDisplayed > 0,
        },
        {
            id: 'fill-library', track: 'main',
            title: 'Fill the library shelves',
            detail: 'Every book on the island belongs here.',
            on: ['progressChanged'],
            test: () => state.booksShelved >= BOOK_COUNT,
            progress: () => [state.booksShelved, BOOK_COUNT],
        },
        {
            id: 'fill-museum', track: 'main',
            title: 'Fill the museum pedestals',
            detail: 'Every artifact on the island belongs here.',
            on: ['progressChanged'],
            test: () => state.artifactsDisplayed >= ARTIFACT_COUNT,
            progress: () => [state.artifactsDisplayed, ARTIFACT_COUNT],
        },

        // ---- side quests ----
        {
            id: 'see-lighthouse', track: 'side',
            title: 'Stand at the lighthouse',
            detail: 'It is the tallest thing on the island and visible from most of it. Walk to its foot.',
            on: ['mapExplored'],
            test: () => visited('lighthouse'),
        },
        {
            id: 'enter-cave', track: 'side',
            title: 'Go into the sea cave',
            detail: 'The tunnel runs under the hillside. It is dark, and something in there glitters.',
            on: ['mapExplored'],
            test: () => visited('cave'),
        },
        {
            id: 'visit-cemetery', track: 'side',
            title: 'Walk the cemetery',
            detail: 'Someone copied out every name here before the stones wore smooth.',
            on: ['mapExplored'],
            test: () => visited('cemetery'),
        },
        {
            id: 'visit-garden', track: 'side',
            title: 'Find the walled garden',
            detail: 'Planted, by the ledger, for no useful reason at all.',
            on: ['mapExplored'],
            test: () => visited('garden'),
        },
        {
            id: 'visit-ruins', track: 'side',
            title: 'Search the ancient ruins',
            detail: 'Older than the lighthouse, the library, and whatever emptied the island.',
            on: ['mapExplored'],
            test: () => visited('ruins'),
        },
        {
            id: 'survey-island', track: 'side',
            title: 'Chart the island',
            detail: `Reveal ${Math.round(SURVEY_TARGET * 100)}% of the overmap on foot.`,
            on: ['mapExplored'],
            test: () => mapState.exploredFraction >= SURVEY_TARGET,
            progress: () => [
                Math.round(mapState.exploredFraction * 100),
                Math.round(SURVEY_TARGET * 100),
            ],
        },
        {
            id: 'spot-everything', track: 'side',
            title: 'Spot every collectible',
            detail: 'Get close enough to pin all 18 finds on the overmap, whether or not you have carried them home.',
            on: ['mapExplored', 'itemCollected'],
            test: () => mapState.spottedCount >= mapState.items.size,
            progress: () => [mapState.spottedCount, mapState.items.size],
        },
    ];
}

export class QuestLog {
    /**
     * @param deps { mapState } — the only external state the predicates need
     *                            beyond the `state` and `inventory` singletons.
     */
    constructor(deps) {
        this.defs = questDefs(deps);
        this.byId = new Map(this.defs.map(d => [d.id, d]));
        this.completed = new Set();
        this._mainOrder = this.defs.filter(d => d.track === 'main').map(d => d.id);
        this._unsubs = [];
    }

    /**
     * Subscribe to every event any quest cares about. One listener per distinct
     * event name re-tests only the quests that named it, so a per-frame event
     * like mapExplored does not walk the whole list of predicates.
     */
    start() {
        const byEvent = new Map();
        for (const def of this.defs) {
            for (const ev of def.on) {
                if (!byEvent.has(ev)) byEvent.set(ev, []);
                byEvent.get(ev).push(def);
            }
        }
        for (const [ev, defs] of byEvent) {
            this._unsubs.push(events.on(ev, () => this._evaluate(defs)));
        }
        // Catch anything already satisfied — relevant on load, and for the rare
        // case of a quest whose condition was met by the spawn reveal.
        this._evaluate(this.defs, true);
    }

    stop() {
        for (const off of this._unsubs) off();
        this._unsubs = [];
    }

    /**
     * The one main-chain step the player is working on: the first incomplete one
     * in declaration order. Null once the chain is finished.
     */
    get activeMain() {
        for (const id of this._mainOrder) {
            if (!this.completed.has(id)) return this.byId.get(id);
        }
        return null;
    }

    /**
     * Main-chain steps are hidden until reached, so the chain does not spoil
     * itself; side quests are all visible from the start, since they are the
     * "places to go" list and that is the point of having it.
     */
    visibleQuests() {
        const active = this.activeMain;
        const out = [];
        for (const id of this._mainOrder) {
            if (this.completed.has(id)) out.push({ def: this.byId.get(id), done: true });
            else if (active && id === active.id) out.push({ def: active, done: false });
        }
        for (const def of this.defs) {
            if (def.track === 'side') out.push({ def, done: this.completed.has(def.id) });
        }
        return out;
    }

    get completedCount() { return this.completed.size; }
    get totalCount() { return this.defs.length; }

    progressFor(def) {
        return def.progress ? def.progress() : null;
    }

    /**
     * Re-test `defs` and fire `questCompleted` for newly-finished ones.
     *
     * Main-chain steps are gated on being the active step: a player who happens
     * to satisfy step 4 before step 3 (walking into the museum first, say) should
     * still be shown step 3 rather than having the chain silently skip ahead.
     * The loop repeats while anything changed, so a step that was already
     * satisfied when it became active completes immediately instead of waiting
     * for the next event.
     *
     * `silent` suppresses the notification but not the completion — used when
     * replaying a loaded save, where every already-done quest would otherwise
     * announce itself at once.
     */
    _evaluate(defs, silent = false) {
        let changed = true;
        while (changed) {
            changed = false;
            // The active main step is always re-tested, even when it did not
            // subscribe to the event that got us here.
            //
            // Without this the chain can deadlock. Each listener only passes the
            // quests that named its event, and the main track is gated on being
            // the active step — so a step whose condition was satisfied by an
            // event it does not listen for is never looked at again, and because
            // it is the blocker, no later step can complete to trigger a cascade.
            // Concretely: find-library listens for mapExplored/regionEntered, but
            // shelving a book satisfies it via progressChanged, and the chain
            // would sit on "Find the Library" with the books already on the shelf.
            const active = this.activeMain;
            const pass = (active && !defs.includes(active)) ? [active, ...defs] : defs;
            for (const def of pass) {
                if (this.completed.has(def.id)) continue;
                if (def.track === 'main' && (!active || active.id !== def.id)) continue;
                let ok = false;
                try {
                    ok = !!def.test();
                } catch {
                    // A predicate that throws (e.g. world data not built yet on an
                    // early frame) must not take the frame loop down with it; it will
                    // be re-tested on the next event regardless.
                    ok = false;
                }
                if (!ok) continue;
                this.completed.add(def.id);
                changed = true;
                if (!silent) {
                    events.emit('questCompleted', { id: def.id, title: def.title, track: def.track });
                }
                events.emit('questsChanged');
            }
            // Only the ordered track can cascade; a side quest completing cannot
            // unlock another one.
            if (changed) defs = this.defs;
        }
    }

    // ---------- persistence ----------

    serialize() {
        return { completed: [...this.completed] };
    }

    deserialize(data) {
        this.completed = new Set(
            // Drop ids that no longer exist, so removing a quest cannot corrupt a save.
            (data && data.completed ? data.completed : []).filter(id => this.byId.has(id)),
        );
        events.emit('questsChanged');
    }

    reset() {
        this.completed.clear();
        events.emit('questsChanged');
    }
}
