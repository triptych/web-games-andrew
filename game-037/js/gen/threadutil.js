// ============================================================
// gen/threadutil.js - the roster a Thread casts from
// Split out so thread.js and world.js do not import each other.
// ============================================================
import { generateRoster } from './npc.js';
import { generateLayout } from './settlement.js';

const cache = new Map();

/** @pure Every living person in a region, across its settlements. */
export function layoutForThread(W, region) {
  const key = W.master.string + '|' + (W.attempt || 0) + '|' + region.id;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (const sid of region.settlements) {
    const s = W.settlements.get(sid);
    if (!s) continue;
    let layout = W.layouts.get(sid);
    if (!layout) { layout = generateLayout(W, s); W.layouts.set(sid, layout); }
    out.push(...generateRoster(W, s, layout));
  }
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

export function clearThreadCache() { cache.clear(); }
