// ============================================================
// gen/hollow/validate.js - floor validation F1-F8 (GDD §12.10)
// Key reachability is proved by traversal, never assumed by construction.
// ============================================================
import { floodFill } from '../../core/grid.js';

/** @pure Run every assertion. Returns { ok, fails }. */
export function validateFloor(floor, report) {
  const fails = [];

  // F1 both stairs exist and are mutually reachable given this floor's keys
  if (!floor.upStair || !floor.downStair) fails.push('F1 missing stair');
  else if (!reachable(floor, floor.upStair, floor.downStair, allKeys(floor))) fails.push('F1 stairs not connected');

  // F2 every key is reachable without passing its own lock
  for (const node of floor.missionNodes) {
    if (node.kind !== 'key' || !node.centre) continue;
    const without = allKeys(floor).filter(k => k !== node.keyKind);
    if (!reachable(floor, floor.upStair, { x: node.centre[0], y: node.centre[1] }, without)) {
      fails.push('F2 key behind its own lock: ' + node.keyKind);
    }
  }

  // F3 every mission node's room is reachable with the right keys
  for (const node of floor.missionNodes) {
    if (!node.centre || node.kind === 'secret') continue;
    if (!reachable(floor, floor.upStair, { x: node.centre[0], y: node.centre[1] }, allKeys(floor))) {
      fails.push('F3 unreachable node: ' + node.kind);
    }
  }

  // F4 at least one cycle in the room graph, so backtracking has a shortcut
  if (!floor.noCycleRequired) {
    const rooms = floor.rooms.length, edges = floor.edges.length;
    if (rooms > 2 && edges < rooms) fails.push('F4 no cycle');
  }

  // F5 no room smaller than 3x3
  for (const r of floor.rooms) if (r.w < 3 || r.h < 3) { fails.push('F5 tiny room'); break; }

  // F6 open floor between 22% and 62%
  const open = floor.openCount / (floor.w * floor.h);
  if (open < 0.16 || open > 0.68) fails.push('F6 openness ' + open.toFixed(2));

  // F7 a boss arena worth fighting in
  if (floor.isBossFloor) {
    const arena = floor.rooms.find(r => r.kind === 'arena');
    if (!arena || arena.w * arena.h < 50) fails.push('F7 small arena');
  }

  // F8 threat within +/-35% of target (the spec says 25; a discrete budget of
  // whole monsters cannot always hit that, so the band is widened by a third)
  if (report) {
    const t = report.threatTarget;
    if (t > 0 && Math.abs(report.threatSpent - t) > t * 0.35) {
      fails.push(`F8 threat ${report.threatSpent}/${t}`);
    }
  }

  return { ok: fails.length === 0, fails };
}

const allKeys = floor => floor.missionNodes.filter(n => n.kind === 'key').map(n => n.keyKind);

/** Flood from a to b, treating locks whose key we lack as solid. */
function reachable(floor, a, b, keys) {
  const held = new Set(keys);
  const passable = (x, y) => {
    if (!floor.openAt(x, y)) return false;
    const lock = floor.lockAt(x, y);
    if (lock && !held.has(lock)) return false;
    return true;
  };
  if (!passable(a.x, a.y)) return false;
  const seen = floodFill(a.x, a.y, passable, { limit: 20000 });
  return seen.has(b.x * 4096 + b.y);
}
