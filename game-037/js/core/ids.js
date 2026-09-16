// ============================================================
// core/ids.js - stable IDs (GDD §7.3)
// An ID must be derivable from world geometry alone, never from a counter.
// ============================================================

export const regionId = (rx, ry) => `R:${rx},${ry}`;
export const chunkId = (cx, cy) => `C:${cx},${cy}`;
export const settlementId = (rx, ry, k) => `S:${rx},${ry}:${k}`;
export const hollowId = (rx, ry, k) => `H:${rx},${ry}:${k}`;
export const npcId = (settleId, k) => `N:${settleId}:${k}`;
export const buildingId = (settleId, k) => `B:${settleId}:${k}`;
export const propId = (cx, cy, k) => `P:${cx},${cy}:${k}`;
export const questId = (npc, k) => `Q:${npc}:${k}`;
export const threadId = (rgn) => `T:${rgn}`;
export const itemUid = (originId, k) => `I:${originId}:${k}`;

/** Parse "R:2,3" style coordinates back out of an id. */
export function idCoords(id) {
  const m = /:(-?\d+),(-?\d+)/.exec(id);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0];
}

/** The settlement an npc id belongs to. */
export const npcSettlement = id => id.slice(2, id.lastIndexOf(':'));
