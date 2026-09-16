// ============================================================
// world/chunks.js - streaming, eviction, delta application (GDD §8.5, §28.3)
// Because generation is pure, eviction is free: re-derive, re-apply deltas.
// ============================================================
import { toChunk, chunkKey, tileIndex, inWorld } from '../core/coords.js';
import { CHUNK, STREAM_RADIUS, EVICT_RADIUS, CHUNKS_X, CHUNKS_Y } from '../data/constants.js';
import { generateChunk } from '../gen/chunk.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';

export const LAYER = Object.freeze({ GROUND: 0, OBJECT: 1, DECOR: 2, FLAGS: 3 });

/** Fetch a live chunk, generating and applying deltas if needed. */
export function getChunk(state, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= CHUNKS_X || cy >= CHUNKS_Y) return null;
  const key = chunkKey(cx, cy);
  let c = state.world.chunks.get(key);
  if (c) return c;
  c = generateChunk(state.W, cx, cy);
  applyDeltas(state, c);
  state.world.chunks.set(key, c);
  bus.emit(EV.WORLD_CHUNKLOADED, { cx, cy });
  return c;
}

/** The chunk containing a tile, or null outside the world. */
export function chunkAt(state, tx, ty) {
  if (!inWorld(tx, ty)) return null;
  return getChunk(state, toChunk(tx), toChunk(ty));
}

/** Replay this chunk's recorded mutations over freshly derived terrain. */
export function applyDeltas(state, c) {
  const key = chunkKey(c.cx, c.cy);
  const tiles = state.deltas.tiles[key];
  if (tiles) {
    for (const [index, layer, value] of tiles) {
      const arr = layerArray(c, layer);
      if (arr) arr[index] = value;
    }
  }
  const snap = state.deltas.snapshots && state.deltas.snapshots[key];
  if (snap) {
    c.ground.set(snap.ground); c.object.set(snap.object);
    c.decor.set(snap.decor); c.flags.set(snap.flags);
  }
  // Props carry their own semantic state.
  for (const [, prop] of c.props) {
    const d = state.deltas.props[prop.id];
    if (d) Object.assign(prop, d);
  }
  for (const [i, prop] of [...c.props]) {
    if (state.deltas.removed.includes(prop.id)) { c.props.delete(i); c.object[i] = 0; }
  }
  // Things the player left behind.
  for (const p of state.deltas.placed) {
    if (toChunk(p.x) !== c.cx || toChunk(p.y) !== c.cy) continue;
    const i = tileIndex(p.x & 31, p.y & 31);
    const arr = layerArray(c, p.layer);
    if (arr) arr[i] = p.value;
    if (p.prop) c.props.set(i, { ...p.prop });
  }
}

function layerArray(c, layer) {
  return layer === LAYER.GROUND ? c.ground : layer === LAYER.OBJECT ? c.object
    : layer === LAYER.DECOR ? c.decor : layer === LAYER.FLAGS ? c.flags : null;
}

/**
 * Record a permanent tile edit. Semantic deltas are preferred; this is for
 * terrain the generator cannot express - chopped trees, dug holes, burned reeds.
 */
export function recordTileDelta(state, tx, ty, layer, value) {
  const key = chunkKey(toChunk(tx), toChunk(ty));
  const i = tileIndex(tx & 31, ty & 31);
  let list = state.deltas.tiles[key];
  if (!list) { list = []; state.deltas.tiles[key] = list; }
  // last write for a (index, layer) wins; keep the list from growing forever
  for (let k = list.length - 1; k >= 0; k--) {
    if (list[k][0] === i && list[k][1] === layer) { list.splice(k, 1); break; }
  }
  list.push([i, layer, value]);
  if (list.length > 400) snapshotChunk(state, key);
}

/** Cap (GDD §28.3.4): a heavily edited chunk snapshots instead of listing. */
function snapshotChunk(state, key) {
  const c = state.world.chunks.get(key);
  if (!c) return;
  state.deltas.snapshots = state.deltas.snapshots || {};
  state.deltas.snapshots[key] = {
    ground: Array.from(c.ground), object: Array.from(c.object),
    decor: Array.from(c.decor), flags: Array.from(c.flags),
  };
  delete state.deltas.tiles[key];
}

/** Record a semantic prop mutation: opened, emptied, unlocked, destroyed. */
export function recordPropDelta(state, propRecord, patch) {
  const cur = state.deltas.props[propRecord.id] || {};
  state.deltas.props[propRecord.id] = { ...cur, ...patch };
  Object.assign(propRecord, patch);
}

/** Generate the active set around the player and evict what is far away. */
export function streamAround(state, tx, ty) {
  const pcx = toChunk(tx), pcy = toChunk(ty);
  for (let dy = -STREAM_RADIUS; dy <= STREAM_RADIUS; dy++) {
    for (let dx = -STREAM_RADIUS; dx <= STREAM_RADIUS; dx++) getChunk(state, pcx + dx, pcy + dy);
  }
  for (const key of [...state.world.chunks.keys()]) {
    const cx = key & 63, cy = key >> 6;
    if (Math.abs(cx - pcx) > EVICT_RADIUS || Math.abs(cy - pcy) > EVICT_RADIUS) {
      state.world.chunks.delete(key);
    }
  }
}

/** Pre-warm the ring just outside the active set, when the browser is idle. */
export function prewarm(state, tx, ty) {
  const pcx = toChunk(tx), pcy = toChunk(ty);
  const r = STREAM_RADIUS + 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
    getChunk(state, pcx + dx, pcy + dy);
  }
}
