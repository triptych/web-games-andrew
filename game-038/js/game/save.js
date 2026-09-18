// ============================================================
// game/save.js - persistence (GDD 14)
// Three slots plus an autosave. The save holds what the player did; the
// world, the sprites, the boards and the encounter tables are re-derived.
// ============================================================
import { bus } from '../core/bus.js';
import { state, serialize, deserialize } from './state.js';
import { SAVE_KEY, SAVE_VERSION, TIMING } from '../data/constants.js';
import { throttle } from '../core/util.js';

export const SLOTS = ['auto', 'a', 'b', 'c'];
const keyFor = slot => `${SAVE_KEY}.${slot}`;

let enabled = true;
let failed = false;
// Nothing is worth saving until a game has actually begun. Without this the
// pagehide handler writes an empty save from the title screen, and the next
// visit is offered a game that does not exist.
let live = false;

export const saveIsLive = () => live;
export function markGameLive(v = true) { live = v; }

export function saveTo(slot = 'auto') {
  if (!enabled) return { ok: false, why: 'Saving is off for this session.' };
  if (!live) return { ok: false, why: 'No game in progress.' };
  try {
    const blob = serialize();
    blob.slot = slot;
    localStorage.setItem(keyFor(slot), JSON.stringify(blob));
    bus.emit('save:written', { slot, at: blob.savedAt });
    return { ok: true, at: blob.savedAt };
  } catch (err) {
    // A blocked or full localStorage is survivable - the game still plays -
    // but the player has to be told, or they will assume it is being kept.
    enabled = false;
    failed = true;
    bus.emit('save:failed', { message: String(err && err.message || err) });
    return { ok: false, why: String(err && err.message || err) };
  }
}

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return (data && data.version === SAVE_VERSION) ? data : null;
  } catch { return null; }
}

export function loadFrom(slot = 'auto') {
  const data = readSlot(slot);
  if (!data) return false;
  const ok = deserialize(data);
  if (ok) bus.emit('save:loaded', { slot });
  return ok;
}

export function deleteSlot(slot) {
  try { localStorage.removeItem(keyFor(slot)); bus.emit('save:deleted', { slot }); return true; }
  catch { return false; }
}

/** Slot metadata for the title screen, without loading anything. */
export function slotSummaries() {
  return SLOTS.map(slot => {
    const d = readSlot(slot);
    if (!d) return { slot, empty: true };
    return {
      slot, empty: false,
      warden: d.wardenName, act: d.act, coin: d.coin,
      roster: (d.roster || []).length,
      node: d.node,
      best: (d.roster || []).reduce((n, x) => Math.max(n, x.level || 0), 0),
      savedAt: d.savedAt,
      done: (d.quests && d.quests.done || []).length,
      ending: d.ending || null,
    };
  });
}

export const anySave = () => SLOTS.some(s => readSlot(s));
export const saveFailed = () => failed;
export function setSavingEnabled(v) { enabled = v; }

/** Walking about marks the save dirty; milestones write immediately. */
const throttledSave = throttle(() => saveTo('auto'), TIMING.autosaveMs);

export function wireAutosave() {
  bus.on('game:begun', () => { live = true; });
  bus.on('state:loaded', () => { live = true; });
  for (const ev of ['battle:ended', 'dragon:captured', 'egg:hatched', 'quest:completed',
                    'act:changed', 'dragon:levelled', 'party:rested', 'game:ended']) {
    bus.on(ev, () => saveTo('auto'));
  }
  for (const ev of ['node:changed', 'inventory:changed', 'roster:changed', 'coin:changed']) {
    bus.on(ev, () => throttledSave());
  }
  // pagehide/visibilitychange, never beforeunload: it is unreliable on mobile
  // and never fires when a backgrounded tab is discarded.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveTo('auto'); });
    window.addEventListener('pagehide', () => saveTo('auto'));
  }
}
