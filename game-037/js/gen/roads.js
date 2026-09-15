// ============================================================
// gen/roads.js - the road graph (GDD §9.9)
// "The road is safe, the woods are not", made legible without a tutorial.
// PURE.
// ============================================================
import { astar } from '../core/grid.js';
import { elevationAt, slopeAt, riverAt, biomeAt } from './fields.js';
import { SHORE, WORLD_W, WORLD_H } from '../data/constants.js';

const LATTICE = 4;   // roads are pathed on a coarse lattice, then smoothed

/** @pure Cost of routing a road through a coarse lattice node. */
function roadCost(W, x, y) {
  const e = elevationAt(W, x, y);
  if (e > 0.88) return null;
  let c = 1 + slopeAt(W, x, y) * 24;
  const r = riverAt(W, x, y);
  if (e < SHORE) c += 40;
  else if (r > 0.5) c += 12;              // a crossing, bridged later
  const b = biomeAt(W, x, y);
  if (b === 'fen') c += 6;
  if (b === 'deepwood') c += 3;
  if (b === 'cloudforest') c += 4;
  return Math.round(c * 10);
}

/** Chaikin smoothing - two iterations turns a lattice path into a lane. */
function chaikin(points, iterations = 2) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 3) break;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** @pure Rasterize a smoothed polyline into a set of tiles. */
function rasterize(points) {
  const tiles = [];
  const seen = new Set();
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(ax + (bx - ax) * s / n);
      const y = Math.round(ay + (by - ay) * s / n);
      const k = y * WORLD_W + x;
      if (seen.has(k)) continue;
      seen.add(k);
      tiles.push([x, y]);
    }
  }
  return tiles;
}

/**
 * @pure Build the road network: nearest-3 edges, unioned with an MST so the
 * graph is always connected, then A* each edge on a 4-tile lattice.
 */
export function generateRoads(W, settlements) {
  if (settlements.length < 2) return { edges: [], tileSet: new Set(), bridges: [] };

  const edges = new Map();
  const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;

  // nearest three
  for (let i = 0; i < settlements.length; i++) {
    const near = settlements
      .map((s, j) => ({ j, d: Math.hypot(s.x - settlements[i].x, s.y - settlements[i].y) }))
      .filter(o => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const o of near) {
      if (o.d > 420) continue;
      edges.set(key(i, o.j), { a: i, b: o.j, d: o.d });
    }
  }

  // minimum spanning tree, so the graph is connected regardless
  const inTree = new Set([0]);
  while (inTree.size < settlements.length) {
    let best = null, bestD = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < settlements.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(settlements[i].x - settlements[j].x, settlements[i].y - settlements[j].y);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.set(key(best[0], best[1]), { a: best[0], b: best[1], d: bestD });
  }

  const tileSet = new Set();
  const bridges = [];
  const polylines = [];

  for (const e of edges.values()) {
    const A = settlements[e.a], B = settlements[e.b];
    const path = astar(
      Math.round(A.x / LATTICE), Math.round(A.y / LATTICE),
      Math.round(B.x / LATTICE), Math.round(B.y / LATTICE),
      {
        cost: (lx, ly) => {
          const x = lx * LATTICE, y = ly * LATTICE;
          if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return null;
          return roadCost(W, x, y);
        },
        maxNodes: 9000,
      },
    );
    if (!path) continue;
    const pts = [[A.x, A.y], ...path.map(([lx, ly]) => [lx * LATTICE, ly * LATTICE]), [B.x, B.y]];
    const smooth = chaikin(pts, 2);
    const tiles = rasterize(smooth);
    for (const [x, y] of tiles) {
      tileSet.add(y * WORLD_W + x);
      if (riverAt(W, x, y) > 0.3 || elevationAt(W, x, y) < SHORE) bridges.push([x, y]);
    }
    polylines.push({ a: A.id, b: B.id, tiles });
  }

  return { edges: polylines, tileSet, bridges };
}

/** @pure Is this tile a road? */
export const isRoad = (roads, x, y) => roads && roads.tileSet.has(y * WORLD_W + x);
