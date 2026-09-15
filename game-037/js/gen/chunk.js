// ============================================================
// gen/chunk.js - realizing one 32x32 chunk (GDD §9.12-9.14)
// PURE. Stamp order is fixed; each stamp derives its own stream, so a chunk
// is identical whether it is the first generated or the ten-thousandth.
// ============================================================
import { deriveRNG, hashInts, domainId } from '../core/rand.js';
import { fbm2D } from '../core/noise.js';
import { tileIndex, inWorld } from '../core/coords.js';
import { propId } from '../core/ids.js';
import {
  DOMAINS, CHUNK, WORLD_W, NOISE_SALTS as S, SEA, SHORE, QUIET_VISIBLE,
} from '../data/constants.js';
import { T, F, tileDef } from '../data/tiles.js';
import { O } from '../data/objects.js';
import { BIOMES } from '../data/biomes.js';
import { CULTURES } from '../data/cultures.js';
import { elevationAt, biomeAt, riverAt, regionAt } from './fields.js';
import { quietAt } from './regions.js';

const ROOF_STYLES = { thatch: 'thatch', reed: 'reed_roof', slate: 'slate', tar: 'tar', turf: 'turf', tile: 'tile_roof' };

/** @pure Build a chunk's four layers plus its addressable props. */
export function generateChunk(W, cx, cy) {
  const rng = deriveRNG(W.master, DOMAINS.TERRAIN, cx, cy);
  const ground = new Uint8Array(1024);
  const object = new Uint8Array(1024);
  const decor = new Uint8Array(1024);
  const flags = new Uint8Array(1024);
  const props = new Map();
  const roofs = [];

  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
      const i = tileIndex(lx, ly);
      const e = elevationAt(W, tx, ty);
      const biome = biomeAt(W, tx, ty);
      const B = BIOMES[biome] || BIOMES.meadow;

      // 1. ground
      if (e < SEA) ground[i] = T.deep_water;
      else if (riverAt(W, tx, ty) >= 0.3) ground[i] = T.shallow_water;
      else ground[i] = parseInt(rng.weightedKey(B.ground), 10);

      // 2. objects - modulated by a second field so woods clump
      const clump = fbm2D(W.master, S.vegetation, tx / 26, ty / 26, { octaves: 3 });
      const density = B.objectDensity * (0.35 + clump * 1.3);
      if (!tileDef(ground[i]).liquid && Object.keys(B.objects).length && rng.chance(density)) {
        object[i] = parseInt(rng.weightedKey(B.objects), 10);
      }

      // 3. decor
      if (!object[i] && Object.keys(B.decor).length && rng.chance(B.decorDensity)) {
        decor[i] = decorId(rng.weightedKey(B.decor));
      }

      // 4. flags
      if (quietAt(W, W.regions, tx, ty) > QUIET_VISIBLE) flags[i] |= F.QUIET;
      // Cliffs read as terrain, not carpet: a steep drop becomes a face.
      if (e > 0.80 && elevationAt(W, tx, ty + 1) < e - 0.055) { ground[i] = T.cliff_face; object[i] = 0; decor[i] = 0; }
    }
  }

  stampRoads(W, cx, cy, ground, object, flags);
  stampRivers(W, cx, cy, ground, object);
  stampSettlements(W, cx, cy, ground, object, decor, flags, props, roofs);
  stampHollowMouths(W, cx, cy, object, props);
  stampProps(W, cx, cy, ground, object, decor, props);
  stampSecrets(W, cx, cy, object, flags, props);

  return { cx, cy, ground, object, decor, flags, props, roofs };
}

// --- decor keys are interned to ids so the layer stays a Uint8Array --------
const DECOR_KEYS = ['none', 'flower', 'grass_tuft', 'moss', 'mushroom', 'fern', 'heather_flower', 'lichen',
  'wrack', 'shell', 'reed', 'rubble', 'tracks', 'tracks_old', 'blood', 'windfall', 'thorn',
  'dust_devil', 'sheep_bone', 'lantern_fly', 'crop', 'remembered'];
export const DECOR_ID = {};
DECOR_KEYS.forEach((k, i) => { DECOR_ID[k] = i; });
export const decorKey = id => DECOR_KEYS[id] || 'none';
const decorId = k => DECOR_ID[k] ?? 0;

// --- stamps ---------------------------------------------------------------

function stampRoads(W, cx, cy, ground, object, flags) {
  if (!W.roads) return;
  for (let ly = 0; ly < CHUNK; ly++) for (let lx = 0; lx < CHUNK; lx++) {
    const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
    if (!W.roads.tileSet.has(ty * WORLD_W + tx)) continue;
    const i = tileIndex(lx, ly);
    if (tileDef(ground[i]).liquid) continue;
    ground[i] = nearTown(W, tx, ty) ? T.road_stone : T.road_dirt;
    object[i] = 0;
    flags[i] |= F.ROAD | F.NO_SPAWN;
  }
}

function nearTown(W, tx, ty) {
  for (const s of W.settlements.values()) {
    if (s.size !== 'town') continue;
    if (Math.abs(s.x - tx) < 30 && Math.abs(s.y - ty) < 30) return true;
  }
  return false;
}

function stampRivers(W, cx, cy, ground, object) {
  const rng = deriveRNG(W.master, DOMAINS.RIVERS, cx, cy, 991);
  for (let ly = 0; ly < CHUNK; ly++) for (let lx = 0; lx < CHUNK; lx++) {
    const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
    const w = W.rivers ? W.rivers.widthAt(tx, ty) : 0;
    if (!w) continue;
    const i = tileIndex(lx, ly);
    ground[i] = w >= 3 ? T.deep_water : T.shallow_water;
    if (object[i]) object[i] = 0;
    // a road crossing gets a bridge if the water is wide, else it is a ford
    if (W.roads && W.roads.tileSet.has(ty * WORLD_W + tx)) {
      if (w >= 2) { object[i] = O.bridge; }
      else { ground[i] = T.shallow_water; }
    } else if (w === 1 && rng.chance(0.02)) {
      ground[i] = T.shallow_water;
    }
  }
}

function stampSettlements(W, cx, cy, ground, object, decor, flags, props, roofs) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK, x1 = x0 + CHUNK, y1 = y0 + CHUNK;
  for (const s of W.settlements.values()) {
    if (s.x < x0 - 70 || s.x > x1 + 70 || s.y < y0 - 70 || s.y > y1 + 70) continue;
    const layout = W.layoutOf(s.id);
    if (!layout) continue;
    const b = layout.bounds;
    if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue;
    stampOneSettlement(W, layout, s, cx, cy, ground, object, decor, flags, props, roofs);
  }
}

function put(cx, cy, tx, ty, arr, value) {
  const lx = tx - cx * CHUNK, ly = ty - cy * CHUNK;
  if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) return false;
  arr[tileIndex(lx, ly)] = value;
  return true;
}
const local = (cx, cy, tx, ty) => {
  const lx = tx - cx * CHUNK, ly = ty - cy * CHUNK;
  return (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) ? -1 : tileIndex(lx, ly);
};

function stampOneSettlement(W, L, s, cx, cy, ground, object, decor, flags, props, roofs) {
  const rng = deriveRNG(W.master, DOMAINS.SETTLE_INTERIOR, s.x, s.y);
  const culture = CULTURES[s.culture] || CULTURES.hedgewright;

  // streets
  for (const st of L.streets) {
    for (const [tx, ty] of st.tiles) {
      const i = local(cx, cy, tx, ty);
      if (i < 0) continue;
      if (tileDef(ground[i]).liquid) continue;
      ground[i] = s.size === 'town' ? T.road_stone : T.road_dirt;
      object[i] = 0; decor[i] = 0;
      flags[i] |= F.ROAD | F.NO_SPAWN;
    }
  }

  // plaza and hearth
  for (let ty = L.plaza.y; ty < L.plaza.y + L.plaza.h; ty++) {
    for (let tx = L.plaza.x; tx < L.plaza.x + L.plaza.w; tx++) {
      const i = local(cx, cy, tx, ty);
      if (i < 0) continue;
      ground[i] = s.size === 'hamlet' ? T.road_dirt : T.floor_flag;
      object[i] = 0; decor[i] = 0;
      flags[i] |= F.NO_SPAWN;
    }
  }
  const hi = local(cx, cy, L.hearth.x, L.hearth.y);
  if (hi >= 0) {
    ground[hi] = T.hearth_stone;
    object[hi] = O.hearth;
    props.set(hi, { id: `${s.id}:hearth`, kind: 'hearth', settlement: s.id, name: `the hearth at ${s.name}` });
  }
  // the culture's signature prop stands in the plaza
  const px = L.plaza.x + 1, py = L.plaza.y + 1;
  const pi = local(cx, cy, px, py);
  if (pi >= 0 && !object[pi]) {
    object[pi] = culture.plazaProp;
    props.set(pi, { id: `${s.id}:signature`, kind: 'signature', settlement: s.id, name: `the ${s.culture} custom of ${s.name}` });
  }

  // buildings: walls, door, windows, floor, interior
  for (const b of L.buildings) {
    for (let ty = b.y; ty < b.y + b.h; ty++) {
      for (let tx = b.x; tx < b.x + b.w; tx++) {
        const i = local(cx, cy, tx, ty);
        if (i < 0) continue;
        const edge = tx === b.x || ty === b.y || tx === b.x + b.w - 1 || ty === b.y + b.h - 1;
        ground[i] = b.floor;
        decor[i] = 0;
        flags[i] |= F.NO_SPAWN;
        object[i] = edge ? b.wallObj : 0;
      }
    }
    // door
    const di = local(cx, cy, b.door.x, b.door.y);
    if (di >= 0) {
      object[di] = O.door;
      props.set(di, { id: `${b.id}:door`, kind: 'door', building: b.id, settlement: s.id, name: `the door of ${s.name}`, fn: b.fn });
    }
    // windows on two walls
    for (const [wx, wy] of [[b.x + 1, b.y], [b.x + b.w - 2, b.y + b.h - 1]]) {
      const wi = local(cx, cy, wx, wy);
      if (wi >= 0 && object[wi] === b.wallObj) object[wi] = O.window;
    }
    stampInterior(W, rng, b, s, cx, cy, ground, object, decor, props);
    roofs.push({ x: b.x, y: b.y, w: b.w, h: b.h, style: ROOF_STYLES[b.roof] || 'thatch', id: b.id });
  }

  // yards
  for (const b of L.buildings) {
    const yrng = deriveRNG(W.master, DOMAINS.SETTLE_INTERIOR, b.x, b.y, 7);
    for (let k = 0; k < yrng.int(1, 3); k++) {
      const tx = b.x + yrng.int(-2, b.w + 1), ty = b.y + yrng.int(-2, b.h + 1);
      const i = local(cx, cy, tx, ty);
      if (i < 0 || object[i] || tileDef(ground[i]).liquid) continue;
      if (flags[i] & F.ROAD) continue;
      const prop = yrng.weightedKey({
        [O.wash_line]: 4, [O.wood_stack]: 4, [O.kitchen_garden]: 5,
        [culture.signature]: 5, [O.goat_pen]: 2, [O.barrel]: 2,
      });
      object[i] = parseInt(prop, 10);
      if (parseInt(prop, 10) === O.barrel) {
        props.set(i, { id: `${b.id}:yard${k}`, kind: 'container', settlement: s.id, name: 'a barrel', tier: 0 });
      }
    }
  }

  // fields
  for (const f of L.fields) {
    for (let ty = f.y; ty < f.y + f.h; ty++) for (let tx = f.x; tx < f.x + f.w; tx++) {
      const i = local(cx, cy, tx, ty);
      if (i < 0 || (flags[i] & F.ROAD)) continue;
      if (tileDef(ground[i]).liquid || object[i]) continue;
      ground[i] = T.tilled;
      decor[i] = DECOR_ID.crop;
      flags[i] |= F.NO_SPAWN;
    }
  }

  // edge wall, with gaps at the street exits
  if (L.wallKind !== 'none') {
    const b = L.bounds;
    const obj = L.wallKind === 'hedge' ? O.none : L.wallKind === 'stone' ? O.wall_stone : O.wall_timber;
    for (let tx = b.x0; tx <= b.x1; tx++) {
      for (const ty of [b.y0, b.y1]) edgeTile(cx, cy, tx, ty, ground, object, flags, L, obj);
    }
    for (let ty = b.y0; ty <= b.y1; ty++) {
      for (const tx of [b.x0, b.x1]) edgeTile(cx, cy, tx, ty, ground, object, flags, L, obj);
    }
  }
}

function edgeTile(cx, cy, tx, ty, ground, object, flags, L, obj) {
  const i = local(cx, cy, tx, ty);
  if (i < 0) return;
  if (flags[i] & F.ROAD) return;                 // gaps at street exits
  if (tileDef(ground[i]).liquid) return;
  if (obj === O.none) { ground[i] = T.hedge; object[i] = 0; }
  else object[i] = obj;
  flags[i] |= F.NO_SPAWN;
}

/** Interiors are in-place: no map transitions, which is a mobile-UX win. */
function stampInterior(W, rng, b, s, cx, cy, ground, object, decor, props) {
  const irng = deriveRNG(W.master, DOMAINS.SETTLE_INTERIOR, b.x, b.y, b.index);
  const inner = [];
  for (let ty = b.y + 1; ty < b.y + b.h - 1; ty++) {
    for (let tx = b.x + 1; tx < b.x + b.w - 1; tx++) inner.push([tx, ty]);
  }
  if (!inner.length) return;
  irng.shuffle(inner);

  const CONTENTS = {
    home: [O.bed, O.hearth, O.table, O.chest, O.stool],
    inn: [O.bed, O.bed, O.table, O.hearth, O.notice_board, O.barrel, O.stash],
    smith: [O.anvil, O.forge, O.whetstone, O.barrel, O.chest],
    herbalist: [O.mortar, O.drying_rack, O.table, O.chest],
    market: [O.market_stall, O.crate, O.crate, O.table],
    craft: [O.loom, O.table, O.chest, O.stool],
    chapel: [O.bell_frame, O.offering_bowl, O.stool, O.stool],
    granary: [O.sack, O.sack, O.crate, O.barrel],
    boathouse: [O.boat, O.crate, O.drying_rack],
  };
  const list = CONTENTS[b.fn] || CONTENTS.home;
  for (let k = 0; k < list.length && k < inner.length; k++) {
    const [tx, ty] = inner[k];
    const i = local(cx, cy, tx, ty);
    if (i < 0) continue;
    const objId = list[k];
    object[i] = objId;
    const meta = propMeta(objId, b, s, k);
    if (meta) props.set(i, meta);
  }
}

function propMeta(objId, b, s, k) {
  const id = `${b.id}:in${k}`;
  if (objId === O.chest || objId === O.crate || objId === O.barrel || objId === O.sack) {
    return { id, kind: 'container', building: b.id, settlement: s.id, name: 'a chest', tier: 0, locked: false };
  }
  if (objId === O.bed) return { id, kind: 'bed', building: b.id, settlement: s.id, name: 'a bed', fn: b.fn };
  if (objId === O.hearth) return { id, kind: 'hearth', building: b.id, settlement: s.id, name: 'a hearth' };
  if (objId === O.notice_board) return { id, kind: 'notice_board', building: b.id, settlement: s.id, name: 'the notice board' };
  if (objId === O.mortar) return { id, kind: 'mortar', building: b.id, settlement: s.id, name: 'the mortar' };
  if (objId === O.anvil || objId === O.whetstone) return { id, kind: 'repair', building: b.id, settlement: s.id, name: 'the anvil' };
  if (objId === O.market_stall) return { id, kind: 'shop', building: b.id, settlement: s.id, name: 'a stall' };
  if (objId === O.bell_frame) return { id, kind: 'bell', building: b.id, settlement: s.id, name: 'the bell' };
  if (objId === O.offering_bowl) return { id, kind: 'shrine', building: b.id, settlement: s.id, name: 'the offering bowl' };
  if (objId === O.loom) return { id, kind: 'loom', building: b.id, settlement: s.id, name: 'a loom', mendable: true };
  if (objId === O.stash) return { id, kind: 'stash', building: b.id, settlement: s.id, name: 'the keepers\' chest' };
  if (objId === O.boat) return { id, kind: 'boat', building: b.id, settlement: s.id, name: 'a boat' };
  return null;
}

function stampHollowMouths(W, cx, cy, object, props) {
  for (const h of W.hollows.values()) {
    const i = local(cx, cy, h.mouth.x, h.mouth.y);
    if (i < 0) continue;
    object[i] = O.hollow_mouth;
    props.set(i, { id: h.id, kind: 'hollow_mouth', hollow: h.id, name: h.name });
  }
}

/** Wilderness props: the things that reward looking at scenery. */
function stampProps(W, cx, cy, ground, object, decor, props) {
  const rng = deriveRNG(W.master, DOMAINS.PROPS, cx, cy);
  const n = rng.int(0, 3);
  const table = {
    [O.cairn]: 14, [O.shrine]: 6, [O.grave]: 7, [O.fallen_log]: 18, [O.berry_bush]: 22,
    [O.beehive]: 5, [O.old_wall]: 12, [O.standing_stone]: 5, [O.abandoned_camp]: 8,
  };
  for (let k = 0; k < n; k++) {
    const lx = rng.int(1, CHUNK - 2), ly = rng.int(1, CHUNK - 2);
    const i = tileIndex(lx, ly);
    if (object[i] || tileDef(ground[i]).liquid || tileDef(ground[i]).indoor) continue;
    const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
    if (elevationAt(W, tx, ty) < SHORE) continue;
    const objId = parseInt(rng.weightedKey(table), 10);
    object[i] = objId;
    const id = propId(cx, cy, k);
    if (objId === O.shrine) props.set(i, { id, kind: 'shrine', name: 'a shrine' });
    else if (objId === O.abandoned_camp || objId === O.fallen_log) props.set(i, { id, kind: 'search', name: objId === O.fallen_log ? 'a fallen log' : 'a cold camp', tier: 0 });
    else if (objId === O.grave) props.set(i, { id, kind: 'grave', name: 'a grave' });
    else if (objId === O.cairn || objId === O.standing_stone) props.set(i, { id, kind: 'stone', name: objId === O.cairn ? 'a cairn' : 'a standing stone' });
    else if (objId === O.berry_bush || objId === O.beehive) props.set(i, { id, kind: 'forage', name: objId === O.berry_bush ? 'a berry bush' : 'a bee-skep' });
  }
}

/** Secrets: curiosity, rewarded, gated on a capability the world can grant. */
function stampSecrets(W, cx, cy, object, flags, props) {
  const rng = deriveRNG(W.master, DOMAINS.SECRETS, cx, cy);
  if (!rng.chance(0.18)) return;
  const kind = rng.weightedKey({
    buried_cache: 30, cracked_wall: 22, across_water: 18, warded_door: 14, quiet_veil: 10, high_ledge: 6,
  });
  const lx = rng.int(2, CHUNK - 3), ly = rng.int(2, CHUNK - 3);
  const i = tileIndex(lx, ly);
  const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
  if (!inWorld(tx, ty) || elevationAt(W, tx, ty) < SHORE) return;

  const objFor = {
    buried_cache: O.buried_cache, cracked_wall: O.cracked_wall, across_water: O.chest,
    warded_door: O.door_warded, quiet_veil: O.quiet_veil, high_ledge: O.ledge_anchor,
  };
  const capFor = {
    buried_cache: 'spade', cracked_wall: 'ember_jar', across_water: 'grapple_vine',
    warded_door: 'bell', quiet_veil: 'green_flame', high_ledge: 'grapple_vine',
  };
  object[i] = objFor[kind];
  flags[i] |= F.SECRET;
  // Exactly the planned number of shard fragments, by a deterministic reservoir.
  const hasShard = hashInts(W.master.words, domainId(DOMAINS.SHARDPICK), cx, cy) % 96 === 0;
  props.set(i, {
    id: propId(cx, cy, 90), kind: 'secret', secretKind: kind, name: secretName(kind),
    needs: capFor[kind], shard: hasShard, opened: false,
    tier: W.regions.get(regionOfChunk(W, cx, cy)) ? W.regions.get(regionOfChunk(W, cx, cy)).tier : 0,
  });
}

function secretName(kind) {
  return {
    buried_cache: 'disturbed earth', cracked_wall: 'a cracked wall', across_water: 'a chest, across the water',
    warded_door: 'a warded door', quiet_veil: 'a veil', high_ledge: 'an anchor stone',
  }[kind] || 'something';
}

function regionOfChunk(W, cx, cy) {
  return regionAt(W, cx * CHUNK + 16, cy * CHUNK + 16);
}
