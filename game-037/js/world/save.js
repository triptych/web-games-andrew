// ============================================================
// world/save.js - persistence (GDD §28)
// IndexedDB for the save, a localStorage mirror of the header so the title
// screen can say "Continue - Ashmoor, day 14" without opening a database.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { WORLD_GEN_VERSION, SAVE_VERSION, DEV_ALLOW_SAVE_BREAK } from '../data/constants.js';
import { RNG } from '../core/rand.js';
import { State } from '../game/state.js';

const DB_NAME = 'lanternwake', DB_VER = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

/** The saved projection of State. Everything else is re-derived. */
export function serialize(state, slot = 'auto') {
  const p = state.player;
  const regions = {};
  for (const r of state.W.regions.values()) {
    regions[r.id] = { quiet: r.quiet, quietUpdatedTick: r.quietUpdatedTick, quietFloor: r.quietFloor, threadState: r.threadState };
  }
  const hollows = {};
  for (const h of state.W.hollows.values()) {
    if (!h.descent && !h.lit && !h.prizeTaken && !h.discovered) continue;
    hollows[h.id] = { descent: h.descent, lit: h.lit, prizeTaken: h.prizeTaken, discovered: h.discovered, deepest: h.deepest || 0, seenDepth: h.seenDepth || 0 };
  }
  const npcs = {};
  for (const [id, st] of state.world.npcState) npcs[id] = st;
  const quests = {};
  for (const [id, q] of state.quests) {
    quests[id] = { state: q.state, current: q.current, beats: q.beats.map(b => ({ done: b.done, killed: b.killed || 0, progress: b.progress || 0 })) };
  }
  const threads = {};
  for (const [id, t] of state.W.threads) threads[id] = { state: t.state, current: t.current, chosen: t.chosen, beats: t.beats.map(b => b.done) };

  return {
    v: SAVE_VERSION, genVersion: WORLD_GEN_VERSION, slot,
    seed: state.master.string, attempt: state.W.attempt || 0,
    difficulty: state.difficulty,
    tick: state.tick, energyCarry: state.energyCarry, playtimeMs: state.playtimeMs, wakeCount: state.wakeCount,
    mode: state.mode === 'hollow' ? 'overworld' : state.mode,     // never save mid-Hollow geometry
    player: {
      x: p.x, y: p.y, hp: p.hp, vigor: p.vigor, shards: p.shards, level: p.level, xp: p.xp,
      attrs: p.attrs, attrPoints: p.attrPoints, knacks: p.knacks, caps: [...p.caps],
      toolCharges: p.toolCharges, equipment: p.equipment, inventory: p.inventory,
      coin: p.coin, lanternOil: p.lanternOil, lanternLit: p.lanternLit, greenFlame: p.greenFlame,
      nutrition: p.nutrition, statuses: p.statuses, wakePoint: p.wakePoint, facing: p.facing,
    },
    stash: state.stash,
    rng: { combat: state.rngStreams.combat.save() },
    knowledge: {
      identified: [...state.knowledge.identified], places: [...state.knowledge.places],
      facts: [...state.knowledge.facts], tonics: [...state.knowledge.tonics], trinkets: [...state.knowledge.trinkets],
    },
    regions, hollows, npcs, quests, threads,
    longThread: state.longThread,
    deltas: state.deltas,
    ledger: state.ledger,
    stats: state.stats,
    marks: state.marks,
    flags: [...state.flags],
    settings: state.settings,
  };
}

/** Put a save back into a freshly created world. */
export function deserialize(state, save) {
  const p = state.player;
  Object.assign(p, {
    x: save.player.x, y: save.player.y, hp: save.player.hp, vigor: save.player.vigor,
    shards: save.player.shards, level: save.player.level, xp: save.player.xp,
    attrs: save.player.attrs, attrPoints: save.player.attrPoints || 0,
    knacks: save.player.knacks || [], toolCharges: save.player.toolCharges || {},
    equipment: save.player.equipment, inventory: save.player.inventory,
    coin: save.player.coin, lanternOil: save.player.lanternOil, lanternLit: save.player.lanternLit,
    greenFlame: save.player.greenFlame, nutrition: save.player.nutrition,
    statuses: save.player.statuses || [], wakePoint: save.player.wakePoint, facing: save.player.facing || 4,
  });
  p.caps = new Set(save.player.caps || []);

  state.tick = save.tick; state.energyCarry = save.energyCarry || 0;
  state.playtimeMs = save.playtimeMs || 0; state.wakeCount = save.wakeCount || 0;
  state.difficulty = save.difficulty || 'keeper';
  state.stash = save.stash || [];
  state.ledger = save.ledger || [];
  state.stats = save.stats || state.stats;
  state.marks = save.marks || [];
  state.flags = new Set(save.flags || []);
  state.settings = { ...state.settings, ...(save.settings || {}) };
  state.deltas = save.deltas || state.deltas;
  state.deltas.snapshots = state.deltas.snapshots || {};
  state.longThread = save.longThread || state.longThread;

  state.knowledge = {
    identified: new Set(save.knowledge.identified), places: new Set(save.knowledge.places),
    facts: new Set(save.knowledge.facts), tonics: new Set(save.knowledge.tonics || []),
    trinkets: new Set(save.knowledge.trinkets || []),
  };

  for (const [id, r] of Object.entries(save.regions || {})) {
    const region = state.W.regions.get(id);
    if (region) Object.assign(region, r);
  }
  for (const [id, h] of Object.entries(save.hollows || {})) {
    const hollow = state.W.hollows.get(id);
    if (hollow) Object.assign(hollow, h);
  }
  for (const [id, n] of Object.entries(save.npcs || {})) state.world.npcState.set(id, n);
  for (const [id, t] of Object.entries(save.threads || {})) {
    const th = state.W.threads.get(id);
    if (!th) continue;
    th.state = t.state; th.current = t.current; th.chosen = t.chosen;
    (t.beats || []).forEach((done, i) => { if (th.beats[i]) th.beats[i].done = done; });
  }
  state.savedQuests = save.quests || {};
  if (save.rng && save.rng.combat) state.rngStreams.combat = RNG.restore(save.rng.combat);
  state.mode = 'overworld';
  return state;
}

/** Quests are re-derived from needs, then their saved progress is replayed. */
export function restoreQuestProgress(state) {
  const saved = state.savedQuests;
  if (!saved) return;
  for (const [id, s] of Object.entries(saved)) {
    const q = state.quests.get(id);
    if (!q) continue;
    q.state = s.state; q.current = s.current;
    (s.beats || []).forEach((b, i) => {
      if (!q.beats[i]) return;
      q.beats[i].done = b.done; q.beats[i].killed = b.killed; q.beats[i].progress = b.progress;
    });
  }
}

// --- storage --------------------------------------------------------------

export async function writeSave(state, slot = 'auto') {
  const t0 = performance.now();
  const save = serialize(state, slot);
  try {
    const db = await openDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(save);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } else {
      localStorage.setItem('lw.save.' + slot, JSON.stringify(save));
    }
    writeHeader(slot, save, state);
    bus.emit(EV.SAVE_WRITTEN, { slot, bytes: 0, ms: Math.round(performance.now() - t0) });
    return true;
  } catch (e) {
    bus.emit(EV.SAVE_ERROR, { message: String(e && e.message || e) });
    return false;
  }
}

function writeHeader(slot, save, state) {
  try {
    const settle = state.W.settlements.get(state.W.startSettlementId);
    localStorage.setItem('lw.header.' + slot, JSON.stringify({
      seed: save.seed, tick: save.tick, genVersion: save.genVersion,
      place: settle ? settle.name : '', day: Math.floor(save.tick / 2400),
      level: save.player.level, difficulty: save.difficulty, at: Date.now(),
    }));
  } catch { /* storage may be blocked; the save still went to IDB */ }
}

export function readHeader(slot = 'auto') {
  try {
    const raw = localStorage.getItem('lw.header.' + slot);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function readSave(slot = 'auto') {
  try {
    const db = await openDB();
    if (db) {
      return await new Promise(resolve => {
        const tx = db.transaction('saves', 'readonly');
        const req = tx.objectStore('saves').get(slot);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
    const raw = localStorage.getItem('lw.save.' + slot);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function deleteSave(slot = 'auto') {
  try {
    const db = await openDB();
    if (db) {
      await new Promise(resolve => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').delete(slot);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
    localStorage.removeItem('lw.save.' + slot);
    localStorage.removeItem('lw.header.' + slot);
  } catch { /* nothing to do */ }
}

/** A save from an older generator must never silently make a different world. */
export function checkVersion(save) {
  if (!save) return 'none';
  if (save.genVersion === WORLD_GEN_VERSION) return 'ok';
  return DEV_ALLOW_SAVE_BREAK ? 'break' : 'migrate';
}

// Autosave, debounced to once per 1200 ms, never blocking input.
let pending = null, lastWrite = 0;
export function requestSave(state, slot = 'auto', force = false) {
  const now = Date.now();
  if (!force && now - lastWrite < 1200) {
    if (pending) return;
    pending = setTimeout(() => { pending = null; requestSave(state, slot, true); }, 1200);
    return;
  }
  lastWrite = now;
  if (pending) { clearTimeout(pending); pending = null; }
  writeSave(state, slot);
}
