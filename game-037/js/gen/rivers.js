// ============================================================
// gen/rivers.js - rivers as polylines, stored as a bitfield (GDD §9.3)
// PURE: built once from the master seed, re-derivable at any time.
// ============================================================
import { deriveRNG } from '../core/rand.js';
import { DOMAINS, RIVER_COUNT, WORLD_W, WORLD_H, SEA } from '../data/constants.js';
import { DIRS8 } from '../core/coords.js';

/**
 * A packed river field. 288 KB of Uint8Array holding width, not a Set.
 * `strengthAt` returns width/3 on a river tile plus a bank falloff.
 */
class RiverField {
  constructor() {
    this.width = new Uint8Array(WORLD_W * WORLD_H);
    this.paths = [];
    this.lakes = [];
  }
  widthAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return 0;
    return this.width[ty * WORLD_W + tx];
  }
  strengthAt(tx, ty) {
    const w = this.widthAt(tx, ty);
    if (w > 0) return Math.min(1, w / 3);
    // banks: adjacent to a river reads as damp but is not water
    for (const [dx, dy] of DIRS8) if (this.widthAt(tx + dx, ty + dy) > 0) return 0.12;
    return 0;
  }
  /** Rivers of width >= 3 need the grapple-vine or a boat. */
  isWide(tx, ty) { return this.widthAt(tx, ty) >= 3; }
}

/** @pure Trace every river from high ground to the sea or a lake. */
export function generateRivers(master, elevation, attempt = 0) {
  const field = new RiverField();

  for (let n = 0; n < RIVER_COUNT; n++) {
    const rng = deriveRNG(master, DOMAINS.RIVERS, n, attempt);

    // pick a source: rejection-sample high ground, up to 64 tries
    let tx = 0, ty = 0, found = false;
    for (let tries = 0; tries < 64; tries++) {
      tx = rng.int(64, WORLD_W - 64); ty = rng.int(64, WORLD_H - 64);
      if (elevation(tx, ty) > 0.70) { found = true; break; }
    }
    if (!found) continue;

    const path = [[tx, ty]];
    let overflows = 0;
    const visited = new Set([ty * WORLD_W + tx]);
    let step = 0;
    for (; step < 3000; step++) {
      const here = elevation(tx, ty);
      let bx = -1, by = -1, best = here;
      for (const [dx, dy] of DIRS8) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 1 || ny < 1 || nx >= WORLD_W - 1 || ny >= WORLD_H - 1) continue;
        if (visited.has(ny * WORLD_W + nx)) continue;
        const e = elevation(nx, ny) + rng.float(-0.012, 0.012);
        if (e < best) { best = e; bx = nx; by = ny; }
      }
      if (bx < 0) {
        // Local minimum: carve a lake. A lake with somewhere to go overflows,
        // which is what stops every river ending in a puddle halfway down.
        const r = rng.int(2, 4);
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
          if (xx * xx + yy * yy > r * r) continue;
          const lx = tx + xx, ly = ty + yy;
          if (lx < 0 || ly < 0 || lx >= WORLD_W || ly >= WORLD_H) continue;
          field.width[ly * WORLD_W + lx] = Math.max(field.width[ly * WORLD_W + lx], 2);
          visited.add(ly * WORLD_W + lx);
        }
        field.lakes.push({ x: tx, y: ty, r });
        if (overflows >= 3) break;
        overflows++;
        // step out to the lowest tile on the lake's rim and carry on
        let ox = -1, oy = -1, oe = Infinity;
        const rim = r + 1;
        for (let yy = -rim; yy <= rim; yy++) for (let xx = -rim; xx <= rim; xx++) {
          const lx = tx + xx, ly = ty + yy;
          if (lx < 2 || ly < 2 || lx >= WORLD_W - 2 || ly >= WORLD_H - 2) continue;
          if (visited.has(ly * WORLD_W + lx)) continue;
          const e = elevation(lx, ly);
          if (e < oe) { oe = e; ox = lx; oy = ly; }
        }
        if (ox < 0) break;
        tx = ox; ty = oy;
        visited.add(ty * WORLD_W + tx);
        path.push([tx, ty]);
        if (elevation(tx, ty) < SEA) break;
        continue;
      }
      tx = bx; ty = by;
      visited.add(ty * WORLD_W + tx);
      path.push([tx, ty]);
      if (elevation(tx, ty) < SEA) break;
    }

    // stamp the path with a width that grows downstream
    for (let i = 0; i < path.length; i++) {
      const w = 1 + Math.floor(i / 900);
      const [px, py] = path[i];
      const r = w - 1;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const lx = px + xx, ly = py + yy;
        if (lx < 0 || ly < 0 || lx >= WORLD_W || ly >= WORLD_H) continue;
        const idx = ly * WORLD_W + lx;
        if (field.width[idx] < w) field.width[idx] = w;
      }
    }
    field.paths.push({ n, length: path.length, from: path[0], to: path[path.length - 1] });
  }

  return field;
}

export { RiverField };
