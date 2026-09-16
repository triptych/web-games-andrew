/**
 * inventory.js — the player's pack: the actual item records they are carrying,
 * as opposed to the bare counts state.js keeps for the HUD.
 *
 * Why this exists alongside state's carried counters: the counters answer "how
 * many books do I owe the library", which is all the HUD needs. They cannot
 * answer "what did I find", "where did I find it", or "what does this thing
 * say" — and those are the questions that make picking something up feel like
 * finding something rather than incrementing a score. So the pack stores the
 * full record per item (id, kind, name, the region it came from, a flavour
 * line, discovery order) and the counts stay as the derived view.
 *
 * There is deliberately no carry limit. The island is large and the round trip
 * home is already long enough to be a real decision; adding a cap would mostly
 * mean walking the same ground twice. Deposits still empty the pack, so it
 * reads as "everything I have found since I was last home".
 *
 * Ownership: entries live here from pickup until deposit. collections.js takes
 * them at the door (takeAll) and turns them into shelf geometry, so nothing is
 * ever in both places.
 */

import { events } from '../events.js';

/**
 * Per-item flavour text, keyed by the generated name from items.js. Written out
 * rather than templated: these are the only words in the game that are *about*
 * the island, and a template ("a worn book from the forest") reads as filler
 * the second time you see it. Anything unlisted falls back to a kind-generic
 * line, so adding names to items.js can never produce a blank entry.
 */
const ITEM_LORE = {
    // Books
    'Tidewrack Almanac': 'Tide tables for a harbour that silted up two centuries ago. Someone kept correcting them anyway, in a smaller and smaller hand.',
    "The Keeper's Log": 'Weather, lamp oil, and the same four words on forty pages: no ships again today.',
    'Cairn & Compass': 'A walking guide to the island. Half the landmarks it describes are no longer standing.',
    'Leaves of the Grove': 'Pressed leaves, each labelled with a date and a mood rather than a species.',
    'A History of Silt': 'Drier than its subject. The last chapter is an apology to the reader.',
    'Lighthouse Watches': 'Rotas, signatures, and a long argument in the margins about whose turn it was.',
    'Names for the Dead': 'Every grave on the island, copied out before the lettering wore away. It was finished just in time.',
    'The Garden Ledger': 'Seeds in, harvest out, and a note that the roses were planted for no useful reason at all.',
    'Cave Songs': 'Melodies transcribed from dripping water. The notation is inventive and completely unplayable.',
    'Charts of a Small Sea': 'Beautifully drawn, wildly inaccurate. The island is the right shape and in the wrong place.',
    'The Last Harvest': 'An account of the year the island emptied out. It does not say where anyone went.',
    'Notes on Migration': 'Bird arrivals and departures, kept for thirty years by someone who never left.',
    // Artifacts
    'Corroded Sextant': 'The mirrors are gone and the arc is green with salt, but the scale still turns sweetly.',
    'Bone Needle': 'Polished smooth by use. Sail canvas, most likely — the eye is worn oval by heavy thread.',
    'Shattered Sundial': 'Three pieces of one hour. The gnomon is missing, so it is permanently noon.',
    'Tide-worn Coin': 'The face is rubbed featureless. Whatever it was worth, it is worth keeping now.',
    'Carved Antler': 'A row of notches, evenly spaced, then a gap, then one more. A count of something that stopped.',
    'Fogged Lens': 'Ground thick enough to be from the lighthouse itself. Holds a smear of daylight in it.',
    'Iron Ring': 'Too large for a finger, too small for a mooring. Nobody has ever agreed on what it held.',
    'Sea-glass Idol': 'Tumbled soft by the shallows until only the suggestion of a figure is left.',
    'Fragment of a Bell': 'Struck with a knuckle it still gives a true note, a long way off from any key.',
    'Clay Tally Stone': 'Fired hard, marked in fives. Somebody was owed a great deal of something.',
};

const KIND_FALLBACK = {
    book: 'Water-stained and softened at the corners, but the binding holds.',
    artifact: 'Old, deliberate work. Whoever made it expected it to outlast them.',
};

export function loreFor(name, kind) {
    return ITEM_LORE[name] || KIND_FALLBACK[kind] || '';
}

export class Inventory {
    constructor() {
        this.entries = [];   // carried now, in pickup order
        this.log = [];       // every item ever picked up, for the journal
        this._nextOrder = 1;
    }

    get count() { return this.entries.length; }
    countOf(kind) { return this.entries.filter(e => e.kind === kind).length; }

    /** Everything currently carried, newest first — the order the panel reads best in. */
    list() { return this.entries.slice().reverse(); }

    /**
     * Take an item into the pack. `region` is where it was found, resolved by the
     * caller (items.js knows the player's position at pickup time; the pack does
     * not have access to the region map).
     */
    add({ id, kind, name, region }) {
        if (this.entries.some(e => e.id === id)) return null;
        const entry = {
            id, kind, name,
            region: region || '',
            lore: loreFor(name, kind),
            order: this._nextOrder++,
        };
        this.entries.push(entry);
        this.log.push({ id, kind, name, region: entry.region, order: entry.order });
        events.emit('inventoryChanged', { count: this.entries.length });
        return entry;
    }

    /**
     * Hand over everything of `kind` (or all of it, if kind is omitted) and clear
     * it from the pack. Used by the deposit sites, which need the records to build
     * the shelf display and to name what was just returned.
     */
    takeAll(kind) {
        const taken = kind ? this.entries.filter(e => e.kind === kind) : this.entries.slice();
        if (taken.length === 0) return taken;
        const takenIds = new Set(taken.map(e => e.id));
        this.entries = this.entries.filter(e => !takenIds.has(e.id));
        events.emit('inventoryChanged', { count: this.entries.length });
        return taken;
    }

    clear() {
        this.entries = [];
        this.log = [];
        this._nextOrder = 1;
    }

    // ---------- persistence ----------
    // Only fields that cannot be re-derived are stored. `lore` is looked up from
    // the name on load, so editing the text above does not invalidate old saves.

    serialize() {
        const trim = (e) => ({ id: e.id, kind: e.kind, name: e.name, region: e.region, order: e.order });
        return {
            entries: this.entries.map(trim),
            log: this.log.map(trim),
            nextOrder: this._nextOrder,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.entries = (data.entries || []).map(e => ({ ...e, lore: loreFor(e.name, e.kind) }));
        this.log = (data.log || []).slice();
        // Guard against a truncated save: fall back to one past the highest order
        // actually present, so a new pickup can never collide with an old one.
        this._nextOrder = data.nextOrder
            || (this.log.reduce((m, e) => Math.max(m, e.order || 0), 0) + 1);
        events.emit('inventoryChanged', { count: this.entries.length });
    }
}

export const inventory = new Inventory();
