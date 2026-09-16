// ============================================================
// gen/hollow/floor.js - the floor pipeline (GDD §12.4)
// layout -> mission -> embed -> carve -> populate -> validate.
// PURE: identical for the same (hollowId, depth, descent).
// ============================================================
import { deriveRNG, hashStr } from '../../core/rand.js';
import { clamp } from '../../core/util.js';
import { DOMAINS, FLOOR_SIZE } from '../../data/constants.js';
import { T, F } from '../../data/tiles.js';
import { O } from '../../data/objects.js';
import { THEMES, PROBLEMS } from '../../data/themes.js';
import { HOLLOW_OBSERVATIONS } from '../../data/text.js';
import { ALGORITHMS, OPEN, WALL } from './layouts.js';
import { generateMission } from './mission.js';
import { embed } from './embed.js';
import { populate } from './populate.js';
import { validateFloor } from './validate.js';
import { floodFill } from '../../core/grid.js';

const MAX_ATTEMPTS = 6;

/** @pure One floor of one descent. */
export function generateFloor(W, hollow, depth, descent, quiet = 0) {
  let last = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const floor = buildFloor(W, hollow, depth, descent, quiet, attempt, false);
    const v = validateFloor(floor, floor.report);
    floor.validation = { ...v, attempt };
    last = floor;
    if (v.ok) return floor;
  }
  // Fall back to the simplest algorithm with the smallest mission graph.
  const floor = buildFloor(W, hollow, depth, descent, quiet, MAX_ATTEMPTS, true);
  floor.validation = { ...validateFloor(floor, floor.report), attempt: MAX_ATTEMPTS, fallback: true };
  return floor;
}

function buildFloor(W, hollow, depth, descent, quiet, attempt, fallback) {
  const rng = deriveRNG(W.master, DOMAINS.HOLLOW_FLOOR, hashStr(hollow.id), depth, descent, attempt);
  const theme = THEMES[hollow.theme] || THEMES.barrow;
  const effectiveDepth = hollow.lit ? Math.max(2, hollow.depth - 1) : hollow.depth;
  const isBossFloor = depth >= effectiveDepth;

  const size = FLOOR_SIZE(hollow.tier, depth);
  const w = clamp(size + rng.int(-4, 4), 40, 96);
  const h = clamp(size + rng.int(-4, 4), 40, 96);

  // A. layout
  const algoKey = fallback ? 'rooms' : rng.weightedKey(theme.layouts);
  const L = (ALGORITHMS[algoKey] || ALGORITHMS.rooms)(rng, w, h);

  // B-C. mission
  const mission = fallback
    ? { nodes: [{ id: 'm0', kind: 'entry' }, { id: 'm1', kind: 'combat' }, { id: 'm2', kind: 'treasure' }, { id: 'm3', kind: 'exit' }], hub: null }
    : generateMission(rng, depth, isBossFloor);

  // pick the entry room: the one nearest the top-left open space reads as "in"
  if (!L.rooms.length) L.rooms.push({ id: 0, x: 2, y: 2, w: 5, h: 5, kind: 'room' });
  const entryRoom = L.rooms.reduce((a, b) => (a.x + a.y <= b.x + b.y ? a : b));

  // D. embed
  const emb = embed(rng, L, mission, entryRoom.id);

  // A boss needs somewhere to be fought. If the largest room is not big
  // enough, enlarge it to 9x9 rather than re-rolling the whole floor.
  if (isBossFloor) enlargeArena(L, mission, w, h);

  // E. carve into tile layers
  const ground = new Uint8Array(w * h);
  const object = new Uint8Array(w * h);
  const decor = new Uint8Array(w * h);
  const flags = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (L.walls[i] === WALL) { ground[i] = theme.wall; }
    else { ground[i] = theme.floor; }
  }

  const floor = {
    hollowId: hollow.id, depth, descent, theme: hollow.theme, tier: hollow.tier,
    w, h, ground, object, decor, flags, props: new Map(),
    rooms: L.rooms, edges: L.edges, noCycleRequired: !!L.noCycleRequired,
    missionNodes: mission.nodes, assignments: emb.assignments,
    roomById: new Map(L.rooms.map(r => [r.id, r])),
    isBossFloor, algorithm: algoKey, locks: new Map(), themeFloor: theme.floor,
    openCount: 0, lit: false, problem: null, lore: rng.pick(theme.lore),
    observation: rng.pick(HOLLOW_OBSERVATIONS),
    entities: [], floorItems: new Map(), lanternLit: false, keysHeld: new Set(),
  };

  floor.openAt = (x, y) => x >= 0 && y >= 0 && x < w && y < h &&
    !isSolidTile(floor, x, y);
  floor.lockAt = (x, y) => floor.locks.get(y * w + x) || null;
  floor.randomOpen = (r) => {
    for (let k = 0; k < 200; k++) {
      const x = r.int(1, w - 2), y = r.int(1, h - 2);
      if (floor.openAt(x, y)) return [x, y];
    }
    return null;
  };

  for (let i = 0; i < w * h; i++) if (L.walls[i] === OPEN) floor.openCount++;

  // F. stairs
  const entryNode = mission.nodes.find(n => n.kind === 'entry');
  const exitNode = mission.nodes.find(n => n.kind === 'exit');
  const entryCentre = roomCentre(entryRoom);
  floor.upStair = { x: entryCentre[0], y: entryCentre[1] };
  object[floor.upStair.y * w + floor.upStair.x] = depth === 1 ? O.stair_up : O.stair_up;
  floor.props.set(floor.upStair.y * w + floor.upStair.x, {
    id: `${hollow.id}:d${depth}:up`, kind: 'stair_up', name: depth === 1 ? 'the way out' : 'steps up',
  });

  const exitRoom = exitNode && exitNode.roomId != null ? floor.roomById.get(exitNode.roomId) : null;
  const dc = roomCentre(exitRoom || L.rooms[L.rooms.length - 1]);
  if (!isBossFloor || depth < effectiveDepth) {
    floor.downStair = { x: dc[0], y: dc[1] };
    if (floor.downStair.x === floor.upStair.x && floor.downStair.y === floor.upStair.y) {
      floor.downStair = { x: clamp(dc[0] + 2, 1, w - 2), y: dc[1] };
    }
    object[floor.downStair.y * w + floor.downStair.x] = O.stair_down;
    floor.props.set(floor.downStair.y * w + floor.downStair.x, {
      id: `${hollow.id}:d${depth}:down`, kind: 'stair_down', name: 'steps down',
    });
  } else {
    floor.downStair = { ...floor.upStair };
  }

  // locks and their doors
  placeLocksAndKeys(rng, floor, mission, emb);

  // A floor where the stairs do not join is a soft-lock, so rather than
  // re-rolling and hoping, carve the corridor that was missing (F1, F3).
  ensureConnected(floor, mission);

  // the one legible situation this floor poses
  floor.problem = pickProblem(rng, theme, depth);
  applyProblem(rng, floor, theme);

  // lighting: a Hollow with `lanterns` always has one, always reachable
  if (hollow.litCondition === 'lanterns') placeStandingLantern(rng, floor, emb);

  // decorate
  decorate(rng, floor, theme);

  // G-H. population
  floor.report = populate(W, hollow, depth, descent, floor, quiet);
  for (const c of floor.report.containers) {
    const i = c.y * w + c.x;
    if (!floor.openAt(c.x, c.y)) continue;
    object[i] = c.node === 'secret' ? O.chest : O.crate;
    floor.props.set(i, {
      id: `${hollow.id}:d${depth}:r${descent}:c${i}`, kind: 'container',
      name: c.node === 'secret' ? 'a chest, hidden' : 'a crate', contents: c.contents, opened: false,
    });
  }
  for (const it of floor.report.items) {
    const i = it.y * w + it.x;
    if (!floor.openAt(it.x, it.y) || !it.item) continue;
    const list = floor.floorItems.get(i) || [];
    list.push(it.item);
    floor.floorItems.set(i, list);
  }

  // the identity prize sits after the boss, regardless of layout
  if (isBossFloor && !hollow.prizeTaken) placePrize(rng, floor, hollow, emb);

  floor.openCount = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (floor.openAt(x, y)) floor.openCount++;

  // traps and secret walls
  placeTraps(rng, floor, depth);

  return floor;
}

/**
 * Flood from the up-stair ignoring locks, and dig a straight corridor to any
 * mission room or stair the fill did not reach.
 */
function ensureConnected(floor, mission) {
  const targets = [];
  if (floor.downStair) targets.push([floor.downStair.x, floor.downStair.y]);
  for (const n of mission.nodes) if (n.centre) targets.push(n.centre);

  for (let pass = 0; pass < 6; pass++) {
    const reached = floodFill(floor.upStair.x, floor.upStair.y,
      (x, y) => floor.openAt(x, y), { limit: 20000 });
    const missing = targets.filter(([x, y]) => !reached.has(x * 4096 + y));
    if (!missing.length) return;
    const [tx, ty] = missing[0];
    // nearest reached tile, then an L-corridor to it
    let bx = floor.upStair.x, by = floor.upStair.y, bd = Infinity;
    for (const k of reached) {
      const x = Math.floor(k / 4096), y = k % 4096;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    digCorridor(floor, bx, by, tx, ty);
  }
}

function digCorridor(floor, ax, ay, bx, by) {
  const open = (x, y) => {
    if (x < 1 || y < 1 || x >= floor.w - 1 || y >= floor.h - 1) return;
    const i = y * floor.w + x;
    if (isSolidTile(floor, x, y)) { floor.ground[i] = floor.themeFloor; floor.object[i] = 0; }
  };
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) { open(x, ay); open(x, ay + 1); }
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) { open(bx, y); open(bx + 1, y); }
}

function isSolidTile(floor, x, y) {
  const i = y * floor.w + x;
  const g = floor.ground[i];
  if (g === 0) return true;
  const solidGround = g === T.wall_stone || g === T.wall_cave || g === T.wall_timber ||
    g === T.root_wall || g === T.cliff_face || g === T.wall_cracked;
  if (solidGround) return true;
  const o = floor.object[i];
  return o === O.door_locked || o === O.door_warded || o === O.door_sealed ||
    o === O.pillar || o === O.cracked_wall || o === O.quiet_veil;
}

const roomCentre = r => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];

/**
 * Carve the boss room out to at least 9x9 around its centre, and punch a
 * second entrance so the fight always has an out (F7).
 */
function enlargeArena(L, mission, w, h) {
  const boss = mission.nodes.find(n => n.kind === 'boss');
  // If the mission never got a boss room, enlarge the biggest room anyway:
  // a boss floor without an arena is the one thing F7 will not forgive.
  let room = boss && boss.roomId != null ? L.rooms.find(r => r.id === boss.roomId) : null;
  if (!room) room = L.rooms.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b), L.rooms[0]);
  if (!room) return;
  if (boss) { boss.roomId = room.id; boss.centre = [Math.floor(room.x + room.w / 2), Math.floor(room.y + room.h / 2)]; }
  const want = 9;
  const cx = Math.floor(room.x + room.w / 2), cy = Math.floor(room.y + room.h / 2);
  const nw = Math.max(room.w, want), nh = Math.max(room.h, want);
  const x0 = Math.max(1, Math.min(w - nw - 1, cx - (nw >> 1)));
  const y0 = Math.max(1, Math.min(h - nh - 1, cy - (nh >> 1)));
  for (let y = y0; y < y0 + nh; y++) for (let x = x0; x < x0 + nw; x++) {
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) L.walls[y * w + x] = OPEN;
  }
  room.x = x0; room.y = y0; room.w = nw; room.h = nh; room.kind = 'arena';
  // a second way in: a short corridor out of the opposite wall
  for (let d = 1; d <= 4; d++) {
    const ex = Math.min(w - 2, x0 + nw - 1 + d), ey = y0 + (nh >> 1);
    if (ex > 0 && ey > 0 && ex < w - 1 && ey < h - 1) L.walls[ey * w + ex] = OPEN;
    const bx = Math.max(1, x0 - d), by = y0 + (nh >> 1);
    if (bx > 0 && by > 0 && bx < w - 1 && by < h - 1) L.walls[by * w + bx] = OPEN;
  }
}

function placeLocksAndKeys(rng, floor, mission, emb) {
  const { w } = floor;
  for (const node of mission.nodes) {
    if (node.kind === 'lock' || node.roomId == null) continue;
  }
  for (const node of mission.nodes) {
    if (node.roomId == null) continue;
    const room = floor.roomById.get(node.roomId);
    if (!room) continue;
    const [cx, cy] = roomCentre(room);
    node.centre = [cx, cy];
    if (node.kind === 'lock') {
      // Put the door on the room's edge, on the side facing the entry.
      const door = doorTile(floor, room, emb);
      if (door) {
        const i = door.y * w + door.x;
        floor.object[i] = O.door_locked;
        floor.locks.set(i, node.keyKind);
        floor.props.set(i, {
          id: `lock:${node.id}`, kind: 'door', door: 'locked', keyKind: node.keyKind,
          name: `a door, locked`, locked: true,
        });
      }
    } else if (node.kind === 'key') {
      const i = cy * w + cx;
      floor.props.set(i, {
        id: `key:${node.id}`, kind: 'floor_key', keyKind: node.keyKind,
        name: node.keyKind, taken: false,
      });
      floor.object[i] = O.rubble_pile;
    } else if (node.kind === 'puzzle') {
      const i = cy * w + cx;
      floor.object[i] = rng.chance(0.5) ? O.crank : O.sluice;
      floor.props.set(i, { id: `puzzle:${node.id}`, kind: 'puzzle', name: 'a mechanism', used: false });
    } else if (node.kind === 'secret') {
      const i = cy * w + cx;
      floor.flags[i] |= F.SECRET;
    }
  }
}

/** A tile on the room's boundary that is open on both sides. */
function doorTile(floor, room, emb) {
  const { w, h } = floor;
  const candidates = [];
  for (let x = room.x; x < room.x + room.w; x++) {
    candidates.push([x, room.y - 1], [x, room.y + room.h]);
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    candidates.push([room.x - 1, y], [room.x + room.w, y]);
  }
  for (const [x, y] of candidates) {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (!floor.openAt(x, y)) continue;
    return { x, y };
  }
  return null;
}

function pickProblem(rng, theme, depth) {
  const table = {};
  for (const [k, wgt] of Object.entries(theme.problems)) {
    const P = PROBLEMS[k];
    if (!P || depth < P.minDepth) continue;
    table[k] = wgt;
  }
  if (!Object.keys(table).length) return PROBLEMS.lantern_line;
  return PROBLEMS[rng.weightedKey(table)];
}

function applyProblem(rng, floor, theme) {
  const p = floor.problem;
  if (!p) return;
  const { w } = floor;
  if (p.key === 'lantern_line') {
    floor.sconces = [];
    for (let k = 0; k < 4; k++) {
      const t = floor.randomOpen(rng);
      if (!t) continue;
      const i = t[1] * w + t[0];
      floor.object[i] = O.sconce;
      floor.props.set(i, { id: `sconce:${k}`, kind: 'sconce', name: 'a sconce', lit: false });
      floor.sconces.push(i);
    }
  } else if (p.key === 'rising_water') {
    floor.waterLevel = 0;
    floor.waterRiseEvery = 40;
  } else if (p.key === 'hungry_dark') {
    floor.lightPenalty = 0.5;
  } else if (p.key === 'quiet_naming') {
    floor.nameplates = [];
    for (let k = 0; k < 3; k++) {
      const t = floor.randomOpen(rng);
      if (!t) continue;
      const i = t[1] * w + t[0];
      floor.object[i] = O.nameplate;
      floor.props.set(i, { id: `plate:${k}`, kind: 'nameplate', name: 'a name-plate', named: false });
      floor.nameplates.push(i);
    }
  } else if (p.key === 'guest') {
    const t = floor.randomOpen(rng);
    if (t) floor.guest = { x: t[0], y: t[1] };
  } else if (p.key === 'weight_doors') {
    floor.weightLimit = 18;
  } else if (p.key === 'collapse') {
    floor.collapsing = false;
  }
}

function placeStandingLantern(rng, floor, emb) {
  // never behind this floor's lock: use a room on the shallow side of the tree
  const shallow = emb.order.slice(0, Math.max(1, Math.ceil(emb.order.length / 2)));
  for (const roomId of shallow) {
    const room = floor.roomById.get(roomId);
    if (!room) continue;
    const [cx, cy] = roomCentre(room);
    const i = cy * floor.w + cx;
    if (floor.object[i]) continue;
    floor.object[i] = O.standing_lantern;
    floor.props.set(i, { id: `${floor.hollowId}:d${floor.depth}:lantern`, kind: 'standing_lantern', name: 'a keeper\'s lantern', lit: false });
    floor.standingLantern = i;
    return;
  }
}

function placePrize(rng, floor, hollow, emb) {
  const boss = floor.missionNodes.find(n => n.kind === 'boss');
  let target = null;
  if (boss && boss.roomId != null) {
    const room = floor.roomById.get(boss.roomId);
    // the room after the boss, by tree order
    const after = emb.order.filter(id => id !== boss.roomId).pop();
    target = floor.roomById.get(after) || room;
  }
  if (!target) target = floor.rooms[floor.rooms.length - 1];
  const [cx, cy] = roomCentre(target);
  const i = cy * floor.w + cx;
  floor.object[i] = O.prize_stand;
  floor.props.set(i, {
    id: `${hollow.id}:prize`, kind: 'prize', name: prizeName(hollow.prize),
    prize: hollow.prize, taken: false, hollow: hollow.id,
  });
  floor.prizeIndex = i;
}

function prizeName(prize) {
  if (!prize) return 'something';
  if (prize.kind === 'capability') return 'something on a stand';
  if (prize.kind === 'vigor_shard') return 'a shard, warm to the touch';
  if (prize.kind === 'ending') return 'a ledger, open';
  return 'a stand with gear on it';
}

function placeTraps(rng, floor, depth) {
  const n = rng.int(0, 2 + Math.floor(depth / 2));
  for (let k = 0; k < n; k++) {
    const t = floor.randomOpen(rng);
    if (!t) continue;
    const i = t[1] * floor.w + t[0];
    if (floor.object[i] || floor.props.has(i)) continue;
    floor.object[i] = O.trap_pit;
    floor.props.set(i, { id: `trap:${i}`, kind: 'trap', name: 'a pit', sprung: false, hidden: true, damage: rng.dice(2, 1, 6) });
  }
}

function decorate(rng, floor, theme) {
  const { w, h } = floor;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!floor.openAt(x, y) || floor.object[i]) continue;
    if (rng.chance(0.06)) floor.decor[i] = rng.int(11, 11);          // rubble
    else if (rng.chance(0.02)) floor.object[i] = O.rubble_pile;
  }
  // a little standing water, where the theme wants it
  if (theme.key === 'flooded_mill' || theme.key === 'sunken_chapel' || theme.key === 'saltworks') {
    for (let k = 0; k < 40; k++) {
      const t = floor.randomOpen(rng);
      if (!t) continue;
      const r = rng.int(1, 3);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = t[0] + dx, y = t[1] + dy;
        if (!floor.openAt(x, y)) continue;
        if (dx * dx + dy * dy > r * r) continue;
        const i = y * w + x;
        if (floor.object[i]) continue;
        floor.ground[i] = T.water_hollow;
      }
    }
  }
}
