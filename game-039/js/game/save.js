/**
 * Save slots. Three named slots plus an autosave written between waves.
 *
 * A save captures the complete live board, including the run seed, so loading
 * restores not just progress but the exact generated palette, playfield and
 * sprites — the run looks identical, not merely equivalent.
 */

const PREFIX = 'wakeform.slot.';
const AUTO_KEY = 'wakeform.autosave';
const HISCORE_KEY = 'wakeform.hiscore';
const VERSION = 1;

export const SLOT_COUNT = 3;

function keyFor(slot) {
    return slot === 'auto' ? AUTO_KEY : PREFIX + slot;
}

/** Read a slot without throwing on corrupt or absent data. */
export function readSlot(slot) {
    try {
        const raw = localStorage.getItem(keyFor(slot));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== VERSION) return null;
        return data;
    } catch (err) {
        return null;
    }
}

export function writeSlot(slot, payload) {
    try {
        const data = { v: VERSION, savedAt: Date.now(), ...payload };
        localStorage.setItem(keyFor(slot), JSON.stringify(data));
        return true;
    } catch (err) {
        // Quota or private-mode failure: the game keeps running, saving does not.
        return false;
    }
}

export function clearSlot(slot) {
    try {
        localStorage.removeItem(keyFor(slot));
        return true;
    } catch (err) {
        return false;
    }
}

/** Summary line for the slot list, without deserialising the whole board. */
export function describeSlot(slot) {
    const d = readSlot(slot);
    if (!d) return null;
    return {
        wave: d.run?.wave ?? 1,
        score: d.score?.score ?? 0,
        containment: d.run?.containment ?? 0,
        seed: d.seed ?? '?',
        savedAt: d.savedAt
    };
}

export function allSlots() {
    const out = [];
    for (let i = 1; i <= SLOT_COUNT; i++) out.push({ slot: i, info: describeSlot(i) });
    return out;
}

export function hasAutosave() {
    return !!readSlot('auto');
}

// --- high score persists independently of slots ---
export function getHiscore() {
    try {
        return parseInt(localStorage.getItem(HISCORE_KEY) || '0', 10) || 0;
    } catch (err) {
        return 0;
    }
}

export function setHiscore(v) {
    try {
        if (v > getHiscore()) localStorage.setItem(HISCORE_KEY, String(v));
    } catch (err) {
        /* ignore */
    }
}
