// ============================================================
// gen/hollow/embed.js - putting the mission into the space (GDD §12.8)
// The key must be reachable without passing its own lock. That is proved by
// traversal in validate.js, not assumed here.
// ============================================================
import { centre } from './layouts.js';

/**
 * @pure Assign mission nodes to rooms over the room graph's spanning tree.
 * Returns { assignments: Map<roomId, node>, order: [roomId], tree }.
 */
export function embed(rng, L, mission, entryRoomId) {
  const adj = new Map();
  for (const r of L.rooms) adj.set(r.id, []);
  for (const e of L.edges) {
    if (!adj.has(e.a) || !adj.has(e.b)) continue;
    adj.get(e.a).push(e.b);
    adj.get(e.b).push(e.a);
  }

  // spanning tree from the entry room, breadth-first
  const parent = new Map([[entryRoomId, null]]);
  const order = [entryRoomId];
  const queue = [entryRoomId];
  while (queue.length) {
    const id = queue.shift();
    for (const n of (adj.get(id) || [])) {
      if (parent.has(n)) continue;
      parent.set(n, id);
      order.push(n);
      queue.push(n);
    }
  }
  // rooms the tree missed (disconnected) still get filler
  for (const r of L.rooms) if (!parent.has(r.id)) { parent.set(r.id, null); order.push(r.id); }

  const depthOf = new Map();
  for (const id of order) {
    const p = parent.get(id);
    depthOf.set(id, p === null || p === undefined ? 0 : depthOf.get(p) + 1);
  }

  const roomById = new Map(L.rooms.map(r => [r.id, r]));
  const assignments = new Map();
  const used = new Set();
  const leaves = order.filter(id => !order.some(o => parent.get(o) === id));

  const take = (pred, fallbackList) => {
    const list = fallbackList || order;
    for (const id of list) {
      if (used.has(id)) continue;
      if (pred && !pred(roomById.get(id), id)) continue;
      used.add(id);
      return id;
    }
    for (const id of list) if (!used.has(id)) { used.add(id); return id; }
    return null;
  };

  // entry always owns the room with the up-stair
  used.add(entryRoomId);
  const entryNode = mission.nodes.find(n => n.kind === 'entry');
  if (entryNode) assignments.set(entryRoomId, entryNode);

  const farFirst = order.slice().sort((a, b) => depthOf.get(b) - depthOf.get(a));
  const nearFirst = order.slice().sort((a, b) => depthOf.get(a) - depthOf.get(b));

  for (const n of mission.nodes) {
    if (n.kind === 'entry') continue;
    let roomId = null;
    switch (n.kind) {
      case 'boss':
        roomId = take(r => r && r.w * r.h >= 40, farFirst) || take(null, farFirst);
        if (roomId != null) {
          const r = roomById.get(roomId);
          if (r) { r.kind = 'arena'; }
        }
        break;
      case 'exit':
        roomId = take((r, id) => depthOf.get(id) >= Math.ceil(order.length / 2), farFirst) || take(null, farFirst);
        break;
      case 'key':
        // a key lives shallow: nearer the entry than the lock will be
        roomId = take((r, id) => depthOf.get(id) <= Math.max(1, Math.ceil(order.length / 3)), nearFirst) || take(null, nearFirst);
        break;
      case 'lock':
        roomId = take((r, id) => parent.get(id) !== null && depthOf.get(id) >= 2, order) || take(null, order);
        break;
      case 'secret':
        roomId = take((r, id) => leaves.includes(id), farFirst) || take(null, farFirst);
        break;
      case 'hub':
        roomId = take((r, id) => (adj.get(id) || []).length >= 3, nearFirst) || take(null, nearFirst);
        break;
      default:
        roomId = take(null, order);
    }
    if (roomId === null || roomId === undefined) continue;
    assignments.set(roomId, n);
    n.roomId = roomId;
    n.centre = centre(roomById.get(roomId));
  }

  // whatever is left is filler: empty, decor, or a minor encounter
  for (const id of order) {
    if (assignments.has(id)) continue;
    assignments.set(id, { id: 'f' + id, kind: 'filler', roomId: id });
  }

  return { assignments, order, parent, depthOf, adj, leaves };
}
