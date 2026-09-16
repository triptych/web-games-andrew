// ============================================================
// gen/hollow/layouts.js - the five layout algorithms (GDD §12.5)
// Every one returns { w, h, walls, rooms, edges }.
// PURE.
// ============================================================
import { labelRegions } from '../../core/grid.js';

const WALL = 1, OPEN = 0;

const mk = (w, h) => ({ w, h, walls: new Uint8Array(w * h).fill(WALL), rooms: [], edges: [] });
const carve = (L, x, y) => { if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.walls[y * L.w + x] = OPEN; };
const isOpen = (L, x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && L.walls[y * L.w + x] === OPEN;

function carveRect(L, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) carve(L, xx, yy);
}

function corridor(L, ax, ay, bx, by, elbowFirstX, width = 1) {
  const band = (x, y) => {
    for (let o = 0; o < width; o++) { carve(L, x, y + o); carve(L, x + o, y); }
  };
  if (elbowFirstX) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) band(x, ay);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) band(bx, y);
  } else {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) band(ax, y);
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) band(x, by);
  }
}

const centre = r => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];

// --- (a) rooms and corridors (BSP) ---------------------------------------

export function roomsAndCorridors(rng, w, h) {
  const L = mk(w, h);
  const leaves = [];
  (function split(x, y, ww, hh, depth) {
    const minLeaf = 9;
    if (depth > 5 || (ww < minLeaf * 2 && hh < minLeaf * 2) || (depth > 2 && rng.chance(0.25))) {
      leaves.push({ x, y, w: ww, h: hh });
      return;
    }
    const horizontal = hh > ww ? true : ww > hh ? false : rng.chance(0.5);
    if (horizontal) {
      if (hh < minLeaf * 2) { leaves.push({ x, y, w: ww, h: hh }); return; }
      const cut = rng.int(minLeaf, hh - minLeaf);
      if (Math.min(cut, hh - cut) / Math.max(cut, hh - cut) < 0.42) { leaves.push({ x, y, w: ww, h: hh }); return; }
      split(x, y, ww, cut, depth + 1); split(x, y + cut, ww, hh - cut, depth + 1);
    } else {
      if (ww < minLeaf * 2) { leaves.push({ x, y, w: ww, h: hh }); return; }
      const cut = rng.int(minLeaf, ww - minLeaf);
      if (Math.min(cut, ww - cut) / Math.max(cut, ww - cut) < 0.42) { leaves.push({ x, y, w: ww, h: hh }); return; }
      split(x, y, cut, hh, depth + 1); split(x + cut, y, ww - cut, hh, depth + 1);
    }
  })(1, 1, w - 2, h - 2, 0);

  for (const leaf of leaves) {
    const insetL = rng.int(1, 3), insetT = rng.int(1, 3);
    const rw = Math.max(3, leaf.w - insetL - rng.int(1, 3));
    const rh = Math.max(3, leaf.h - insetT - rng.int(1, 3));
    const rx = leaf.x + insetL, ry = leaf.y + insetT;
    if (rx + rw >= w - 1 || ry + rh >= h - 1) continue;
    carveRect(L, rx, ry, rw, rh);
    L.rooms.push({ id: L.rooms.length, x: rx, y: ry, w: rw, h: rh, kind: 'room' });
  }
  if (L.rooms.length < 2) return cellular(rng, w, h);

  // connect in a tree, then add loops: backtracking without a shortcut is a chore
  for (let i = 1; i < L.rooms.length; i++) {
    const [ax, ay] = centre(L.rooms[i - 1]), [bx, by] = centre(L.rooms[i]);
    corridor(L, ax, ay, bx, by, rng.chance(0.5), rng.chance(0.15) ? 2 : 1);
    L.edges.push({ a: i - 1, b: i, door: null });
  }
  const extra = rng.int(1, 3);
  for (let k = 0; k < extra; k++) {
    const a = rng.int(0, L.rooms.length - 1), b = rng.int(0, L.rooms.length - 1);
    if (a === b) continue;
    const [ax, ay] = centre(L.rooms[a]), [bx, by] = centre(L.rooms[b]);
    corridor(L, ax, ay, bx, by, rng.chance(0.5));
    L.edges.push({ a, b, door: null });
  }
  // a pillar grid in a fifth of rooms
  for (const r of L.rooms) {
    if (r.w < 7 || r.h < 7 || !rng.chance(0.2)) continue;
    for (let y = r.y + 2; y < r.y + r.h - 1; y += 3) for (let x = r.x + 2; x < r.x + r.w - 1; x += 3) {
      L.walls[y * L.w + x] = WALL;
    }
  }
  return L;
}

// --- (b) cellular caves ---------------------------------------------------

export function cellular(rng, w, h) {
  const L = mk(w, h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    L.walls[y * w + x] = rng.chance(0.45) ? WALL : OPEN;
  }
  for (let it = 0; it < 4; it++) {
    const next = L.walls.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (L.walls[(y + dy) * w + (x + dx)] === WALL) n++;
      }
      let far = 0;
      if (it < 2) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy, xx = x + dx;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || L.walls[yy * w + xx] === WALL) far++;
        }
      }
      next[y * w + x] = (n >= 5 || (it < 2 && far <= 2)) ? WALL : OPEN;
    }
    L.walls.set(next);
  }

  // keep the largest lobe, then tunnel to any other lobe worth having
  const { labels, sizes } = labelRegions(w, h, (x, y) => L.walls[y * w + x] === OPEN);
  if (!sizes.length) return roomsAndCorridors(rng, w, h);
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
  const mainCells = [], lobes = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = labels[y * w + x];
    if (l < 0) continue;
    if (l === main) mainCells.push([x, y]);
    else if (sizes[l] >= 40) { if (!lobes.has(l)) lobes.set(l, []); lobes.get(l).push([x, y]); }
    else L.walls[y * w + x] = WALL;
  }
  for (const cells of lobes.values()) {
    const [lx, ly] = cells[Math.floor(cells.length / 2)];
    let best = mainCells[0], bd = Infinity;
    for (const [mx, my] of mainCells) {
      const d = (mx - lx) ** 2 + (my - ly) ** 2;
      if (d < bd) { bd = d; best = [mx, my]; }
    }
    corridor(L, lx, ly, best[0], best[1], rng.chance(0.5));
  }
  // remove single-tile pillars
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (L.walls[y * w + x] !== WALL) continue;
    let open = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (L.walls[(y + dy) * w + (x + dx)] === OPEN) open++;
    if (open === 4) L.walls[y * w + x] = OPEN;
  }

  roomsFromBlobs(rng, L, 'cave');
  return L;
}

// --- (c) ring / spiral ----------------------------------------------------

export function ringSpiral(rng, w, h) {
  const L = mk(w, h);
  const cx = w >> 1, cy = h >> 1;
  const chamber = Math.max(4, Math.min(w, h) >> 3);
  carveRect(L, cx - chamber, cy - chamber, chamber * 2, chamber * 2);
  L.rooms.push({ id: 0, x: cx - chamber, y: cy - chamber, w: chamber * 2, h: chamber * 2, kind: 'chamber' });

  const rings = rng.int(2, 3);
  const maxR = Math.min(cx, cy) - 3;
  for (let r = 1; r <= rings; r++) {
    const rad = Math.round(chamber + (maxR - chamber) * (r / rings));
    const blocked = rng.float(0, Math.PI * 2);
    for (let a = 0; a < 360; a += 2) {
      const ang = a * Math.PI / 180;
      if (Math.abs(((ang - blocked + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.25) continue;
      const x = Math.round(cx + Math.cos(ang) * rad), y = Math.round(cy + Math.sin(ang) * rad * 0.85);
      carve(L, x, y); carve(L, x + 1, y); carve(L, x, y + 1);
    }
    // radial spokes
    const spokes = rng.int(2, 4);
    for (let sIdx = 0; sIdx < spokes; sIdx++) {
      const ang = rng.float(0, Math.PI * 2);
      for (let d = chamber; d <= rad + 1; d++) {
        const x = Math.round(cx + Math.cos(ang) * d), y = Math.round(cy + Math.sin(ang) * d * 0.85);
        carve(L, x, y); carve(L, x + 1, y);
      }
      const ex = Math.round(cx + Math.cos(ang) * rad), ey = Math.round(cy + Math.sin(ang) * rad * 0.85);
      const rw = rng.int(4, 6), rh = rng.int(4, 6);
      carveRect(L, ex - (rw >> 1), ey - (rh >> 1), rw, rh);
      L.rooms.push({ id: L.rooms.length, x: ex - (rw >> 1), y: ey - (rh >> 1), w: rw, h: rh, kind: 'room' });
    }
  }
  linkRoomsByProximity(L);
  return L;
}

// --- (d) grid vault -------------------------------------------------------

export function gridVault(rng, w, h) {
  const L = mk(w, h);
  const cols = rng.int(3, 5), rows = rng.int(3, 5);
  const cw = Math.floor((w - 2) / cols), ch = Math.floor((h - 2) / rows);
  if (cw < 5 || ch < 5) return roomsAndCorridors(rng, w, h);
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    cells.push({ i, j, x: 1 + i * cw, y: 1 + j * ch, w: cw - 1, h: ch - 1, merged: false });
  }
  // merge some into 2x1 halls; symmetric about the vertical axis
  for (const c of cells) {
    if (c.merged || c.i >= cols - 1 || !rng.chance(0.25)) continue;
    const right = cells.find(o => o.i === c.i + 1 && o.j === c.j);
    if (!right || right.merged) continue;
    c.w = cw * 2 - 1; c.kind = 'hall'; right.merged = true;
  }
  for (const c of cells) {
    if (c.merged) continue;
    carveRect(L, c.x, c.y, c.w, c.h);
    L.rooms.push({ id: L.rooms.length, x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind || 'room', gi: c.i, gj: c.j });
  }
  // doors between orthogonal neighbours
  for (const a of L.rooms) {
    for (const b of L.rooms) {
      if (a.id >= b.id) continue;
      const adjX = Math.abs((a.x + a.w) - b.x) <= 2 || Math.abs((b.x + b.w) - a.x) <= 2;
      const adjY = Math.abs((a.y + a.h) - b.y) <= 2 || Math.abs((b.y + b.h) - a.y) <= 2;
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (adjX && overlapY > 1) {
        const y = Math.max(a.y, b.y) + Math.floor(overlapY / 2);
        const x = a.x < b.x ? b.x - 1 : a.x - 1;
        carve(L, x, y); carve(L, x + 1, y); carve(L, x - 1, y);
        L.edges.push({ a: a.id, b: b.id, door: { x, y } });
      } else if (adjY && overlapX > 1) {
        const x = Math.max(a.x, b.x) + Math.floor(overlapX / 2);
        const y = a.y < b.y ? b.y - 1 : a.y - 1;
        carve(L, x, y); carve(L, x, y + 1); carve(L, x, y - 1);
        L.edges.push({ a: a.id, b: b.id, door: { x, y } });
      }
    }
  }
  return L;
}

// --- (e) warren -----------------------------------------------------------

export function warren(rng, w, h) {
  const L = mk(w, h);
  let x = rng.int(4, w - 5), y = rng.int(4, h - 5);
  let dx = rng.chance(0.5) ? 1 : -1, dy = 0;
  const trunk = [];
  for (let i = 0; i < w * h / 8; i++) {
    carve(L, x, y); carve(L, x, y + 1);
    trunk.push([x, y]);
    if (rng.chance(0.25)) {
      if (dy === 0) { dy = rng.chance(0.5) ? 1 : -1; dx = 0; }
      else { dx = rng.chance(0.5) ? 1 : -1; dy = 0; }
    }
    x = Math.max(2, Math.min(w - 3, x + dx));
    y = Math.max(2, Math.min(h - 3, y + dy));
  }
  const chambers = rng.int(6, 12);
  for (let k = 0; k < chambers; k++) {
    const [tx, ty] = rng.pick(trunk);
    const rw = rng.int(3, 6), rh = rng.int(3, 5);
    const ox = Math.max(1, Math.min(w - rw - 2, tx + rng.int(-5, 5)));
    const oy = Math.max(1, Math.min(h - rh - 2, ty + rng.int(-5, 5)));
    carveRect(L, ox, oy, rw, rh);
    corridor(L, tx, ty, ox + (rw >> 1), oy + (rh >> 1), rng.chance(0.5));
    L.rooms.push({ id: L.rooms.length, x: ox, y: oy, w: rw, h: rh, kind: 'chamber' });
  }
  if (!L.rooms.length) return roomsAndCorridors(rng, w, h);
  linkRoomsByProximity(L);
  L.noCycleRequired = true;
  return L;
}

// --- shared helpers -------------------------------------------------------

/** Find room-ish blobs in an already-carved cave so mission nodes have homes. */
function roomsFromBlobs(rng, L, kind) {
  const { w, h } = L;
  const taken = new Uint8Array(w * h);
  for (let tries = 0; tries < 400 && L.rooms.length < 14; tries++) {
    const x = rng.int(2, w - 6), y = rng.int(2, h - 6);
    const rw = rng.int(3, 6), rh = rng.int(3, 5);
    let ok = true;
    for (let yy = y; yy < y + rh && ok; yy++) for (let xx = x; xx < x + rw; xx++) {
      if (!isOpen(L, xx, yy) || taken[yy * w + xx]) { ok = false; break; }
    }
    if (!ok) continue;
    for (let yy = y - 1; yy <= y + rh; yy++) for (let xx = x - 1; xx <= x + rw; xx++) {
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) taken[yy * w + xx] = 1;
    }
    L.rooms.push({ id: L.rooms.length, x, y, w: rw, h: rh, kind });
  }
  linkRoomsByProximity(L);
}

/** Every room joins its two nearest neighbours - caves have no door list. */
function linkRoomsByProximity(L) {
  const seen = new Set();
  for (const a of L.rooms) {
    const near = L.rooms.filter(b => b.id !== a.id)
      .map(b => ({ b, d: (centre(a)[0] - centre(b)[0]) ** 2 + (centre(a)[1] - centre(b)[1]) ** 2 }))
      .sort((p, q) => p.d - q.d).slice(0, 2);
    for (const { b } of near) {
      const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      L.edges.push({ a: a.id, b: b.id, door: null });
    }
  }
}

export const ALGORITHMS = { rooms: roomsAndCorridors, cave: cellular, ring: ringSpiral, grid: gridVault, warren };
export { WALL, OPEN, isOpen, carve, carveRect, corridor, centre };
