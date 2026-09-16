// ============================================================
// world/access.js - one tile interface over two very different maps
// The overworld is chunked and persistent; a Hollow floor is a flat array
// that will not exist tomorrow. Everything above this line reads both the same.
// ============================================================
import { toChunk, tileIndex, inWorld } from '../core/coords.js';
import { T, F, tileDef } from '../data/tiles.js';
import { O, objDef } from '../data/objects.js';
import { chunkAt, recordTileDelta, LAYER } from './chunks.js';

const inHollow = state => state.mode === 'hollow' && state.hollow && state.hollow.floor;

// --- reads ---------------------------------------------------------------

export function groundAt(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return T.void;
    return f.ground[y * f.w + x];
  }
  const c = chunkAt(state, x, y);
  return c ? c.ground[tileIndex(x & 31, y & 31)] : T.void;
}

export function objectAt(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return O.none;
    return f.object[y * f.w + x];
  }
  const c = chunkAt(state, x, y);
  return c ? c.object[tileIndex(x & 31, y & 31)] : O.none;
}

export function decorAt(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return 0;
    return f.decor[y * f.w + x];
  }
  const c = chunkAt(state, x, y);
  return c ? c.decor[tileIndex(x & 31, y & 31)] : 0;
}

export function flagsAt(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return 0;
    return f.flags[y * f.w + x];
  }
  const c = chunkAt(state, x, y);
  return c ? c.flags[tileIndex(x & 31, y & 31)] : 0;
}

export function propAt(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return null;
    return f.props.get(y * f.w + x) || null;
  }
  const c = chunkAt(state, x, y);
  return c ? (c.props.get(tileIndex(x & 31, y & 31)) || null) : null;
}

export function inBounds(state, x, y) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    return x >= 0 && y >= 0 && x < f.w && y < f.h;
  }
  return inWorld(x, y);
}

// --- derived queries -----------------------------------------------------

export function isSolid(state, x, y) {
  if (!inBounds(state, x, y)) return true;
  if (tileDef(groundAt(state, x, y)).solid) return true;
  return objDef(objectAt(state, x, y)).solid;
}

export function isOpaque(state, x, y) {
  if (!inBounds(state, x, y)) return true;
  if (tileDef(groundAt(state, x, y)).opaque) return true;
  return objDef(objectAt(state, x, y)).opaque;
}

/** Additive energy surcharge for entering a tile, or null if you cannot. */
export function moveCost(state, x, y, actor) {
  if (!inBounds(state, x, y)) return null;
  const g = tileDef(groundAt(state, x, y));
  const o = objDef(objectAt(state, x, y));
  if (g.solid || o.solid) return null;
  if (g.deep && !(actor && actor.caps && actor.caps.has('boat_whistle'))) return null;
  let c = g.cost + o.cost;
  if (actor && actor.mods) {
    if (g.liquid && actor.mods.wetMove) c -= actor.mods.wetMove;
    if (c > 0 && actor.mods.roughDiscount) c = Math.max(0, c - actor.mods.roughDiscount);
  }
  return c;
}

export const isLiquid = (state, x, y) => tileDef(groundAt(state, x, y)).liquid;
export const isDeep = (state, x, y) => tileDef(groundAt(state, x, y)).deep;

// --- writes --------------------------------------------------------------

export function setGround(state, x, y, value, permanent = true) {
  if (inHollow(state)) { const f = state.hollow.floor; if (inBounds(state, x, y)) f.ground[y * f.w + x] = value; return; }
  const c = chunkAt(state, x, y);
  if (!c) return;
  c.ground[tileIndex(x & 31, y & 31)] = value;
  if (permanent) recordTileDelta(state, x, y, LAYER.GROUND, value);
}

export function setObject(state, x, y, value, permanent = true) {
  if (inHollow(state)) { const f = state.hollow.floor; if (inBounds(state, x, y)) f.object[y * f.w + x] = value; return; }
  const c = chunkAt(state, x, y);
  if (!c) return;
  c.object[tileIndex(x & 31, y & 31)] = value;
  if (permanent) recordTileDelta(state, x, y, LAYER.OBJECT, value);
}

export function setDecor(state, x, y, value, permanent = false) {
  if (inHollow(state)) { const f = state.hollow.floor; if (inBounds(state, x, y)) f.decor[y * f.w + x] = value; return; }
  const c = chunkAt(state, x, y);
  if (!c) return;
  c.decor[tileIndex(x & 31, y & 31)] = value;
  if (permanent) recordTileDelta(state, x, y, LAYER.DECOR, value);
}

export function setFlag(state, x, y, bit, on = true) {
  if (inHollow(state)) {
    const f = state.hollow.floor;
    if (!inBounds(state, x, y)) return;
    const i = y * f.w + x;
    f.flags[i] = on ? (f.flags[i] | bit) : (f.flags[i] & ~bit);
    return;
  }
  const c = chunkAt(state, x, y);
  if (!c) return;
  const i = tileIndex(x & 31, y & 31);
  c.flags[i] = on ? (c.flags[i] | bit) : (c.flags[i] & ~bit);
}

export function setProp(state, x, y, prop) {
  if (inHollow(state)) { const f = state.hollow.floor; f.props.set(y * f.w + x, prop); return; }
  const c = chunkAt(state, x, y);
  if (!c) return;
  c.props.set(tileIndex(x & 31, y & 31), prop);
}

export function deleteProp(state, x, y) {
  if (inHollow(state)) { const f = state.hollow.floor; f.props.delete(y * f.w + x); return; }
  const c = chunkAt(state, x, y);
  if (c) c.props.delete(tileIndex(x & 31, y & 31));
}

export { F, T, O, tileDef, objDef };
