// ============================================================
// world/entities.js - who is actually on the map right now
// NPCs are records until their chunk is live; monsters spawn per chunk-epoch.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { toChunk, chunkKey } from '../core/coords.js';
import { dist8 } from '../core/util.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DOMAINS, SPAWN_CAP_PER_CHUNK, SPAWN_MIN_DIST, CHUNK, NPC_MEMORY_CAP } from '../data/constants.js';
import { F } from '../data/tiles.js';
import { BIOMES } from '../data/biomes.js';
import { MONSTERS } from '../data/monsters.js';
import { generateMonster } from '../gen/monster.js';
import { generateRoster, scheduleSlot } from '../gen/npc.js';
import { biomeAt, regionAt } from '../gen/fields.js';
import { moveCost, flagsAt, isSolid } from './access.js';

/** The living roster of a settlement, with saved mutable bits applied. */
export function rosterOf(state, settleId) {
  let roster = state.world.rosters.get(settleId);
  if (roster) return roster;
  const settle = state.W.settlements.get(settleId);
  if (!settle) return [];
  const layout = state.W.layoutOf(settleId);
  roster = generateRoster(state.W, settle, layout);
  for (const n of roster) {
    const saved = state.world.npcState.get(n.id);
    if (saved) Object.assign(n, saved);
  }
  state.world.rosters.set(settleId, roster);
  return roster;
}

/** Record a mutable change against an NPC so it survives a reload. */
export function patchNpc(state, npc, patch) {
  Object.assign(npc, patch);
  const cur = state.world.npcState.get(npc.id) || {};
  state.world.npcState.set(npc.id, {
    ...cur,
    disposition: npc.disposition, state: npc.state, metPlayer: npc.metPlayer,
    memory: npc.memory, questIds: npc.questIds, gifted: npc.gifted,
    lastVisitDay: npc.lastVisitDay, needsEpoch: npc.needsEpoch, needs: npc.needs,
  });
}

export function rememberNpc(state, npc, kind, detail) {
  npc.memory = npc.memory || [];
  npc.memory.push({ tick: state.tick, kind, detail });
  if (npc.memory.length > NPC_MEMORY_CAP) npc.memory.shift();
  patchNpc(state, npc, {});
}

/** Where an NPC is at this tick, from their schedule and their buildings. */
export function whereIs(state, npc, tick) {
  const layout = state.W.layoutOf(npc.settlementId);
  if (!layout) return null;
  const slot = scheduleSlot(npc, tick);
  const home = layout.buildings.find(b => b.id === npc.home);
  const work = layout.buildings.find(b => b.id === npc.workplace) || home;
  const weather = state.weather && state.weather.kind;
  const indoors = weather === 'rain' || weather === 'snow';

  let target = home;
  if (slot.place === 'work' && !indoors) target = work;
  else if (slot.place === 'work') target = work;
  else if (slot.place === 'plaza' && !indoors) return { x: layout.plaza.x + 2, y: layout.plaza.y + 2, inside: null };
  else if (slot.place === 'inn') target = layout.buildings.find(b => b.fn === 'inn') || home;
  else if (slot.place === 'field') {
    const f = layout.fields[0];
    if (f && !indoors) return { x: f.x + 1, y: f.y + 1, inside: null };
    target = home;
  } else if (slot.place === 'road' && !indoors) {
    const st = layout.streets[0];
    if (st && st.tiles.length) { const t = st.tiles[Math.floor(st.tiles.length / 2)]; return { x: t[0], y: t[1], inside: null }; }
    target = home;
  }
  if (!target) return { x: layout.plaza.x + 1, y: layout.plaza.y + 1, inside: null };
  return { x: target.x + 1 + (npc.index % Math.max(1, target.w - 2)), y: target.y + 1 + (npc.index % Math.max(1, target.h - 2)), inside: target.id, asleep: slot.asleep };
}

/** Put every NPC whose settlement is nearby onto the map as an actor. */
export function refreshNpcActors(state) {
  const p = state.player;
  state.entities = state.entities.filter(e => !e.isNpc);
  for (const s of state.W.settlements.values()) {
    if (Math.abs(s.x - p.x) > 80 || Math.abs(s.y - p.y) > 80) continue;
    for (const npc of rosterOf(state, s.id)) {
      if (npc.state !== 'alive') continue;
      const at = whereIs(state, npc, state.tick);
      if (!at) continue;
      if (dist8(at.x, at.y, p.x, p.y) > 40) continue;
      state.entities.push({
        id: npc.id, isNpc: true, npc, name: npc.shortName,
        x: at.x, y: at.y, hp: 10, maxHp: 10, energy: 0, speed: 100,
        initiative: 5000 + npc.index, hostile: false, asleep: !!at.asleep,
        awareness: 'aware', behavior: 'none', statuses: [], facing: 4,
        look: npc.look,
      });
    }
  }
}

/**
 * Ambient overworld monsters, per live chunk per 600-tick epoch.
 * Never on roads, never within 12 tiles of the player, capped at 8.
 */
export function spawnAmbient(state) {
  const p = state.player;
  const epoch = Math.floor(state.tick / 600);
  const pcx = toChunk(p.x), pcy = toChunk(p.y);

  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const cx = pcx + dx, cy = pcy + dy;
    const key = chunkKey(cx, cy) + ':' + epoch;
    if (state.world.spawned.has(key)) continue;
    state.world.spawned.set(key, true);

    const rng = deriveRNG(state.master, DOMAINS.SPAWN, cx, cy, epoch);
    const regionId = regionAt(state.W, cx * CHUNK + 16, cy * CHUNK + 16);
    const region = state.W.regions.get(regionId);
    if (!region) continue;
    const biome = biomeAt(state.W, cx * CHUNK + 16, cy * CHUNK + 16);
    const B = BIOMES[biome];
    if (!B || !Object.keys(B.monsters).length) continue;

    const night = isNight(state.tick);
    let density = 0.35 + region.tier * 0.12 + region.quiet * 0.5;
    if (night) density *= 1.4;
    if (region.quiet > 0.2) density *= 1.15;
    const count = Math.min(SPAWN_CAP_PER_CHUNK, Math.floor(rng.float(0, density * 5)));

    for (let k = 0; k < count; k++) {
      const x = cx * CHUNK + rng.int(0, CHUNK - 1), y = cy * CHUNK + rng.int(0, CHUNK - 1);
      if (dist8(x, y, p.x, p.y) < SPAWN_MIN_DIST) continue;
      if (isSolid(state, x, y)) continue;
      const fl = flagsAt(state, x, y);
      if (fl & (F.ROAD | F.NO_SPAWN)) continue;
      const pool = Object.keys(B.monsters).filter(m => {
        const A = MONSTERS[m];
        if (!A) return false;
        if (A.tags.includes('night') && !night) return rng.chance(0.25);
        return true;
      });
      if (!pool.length) continue;
      const archetype = rng.weightedKey(Object.fromEntries(pool.map(m => [m, B.monsters[m]])));
      const m = generateMonster(state.master, archetype, `W:${cx},${cy}:${epoch}:${k}`, {
        tier: Math.max(0, region.tier - 1), depth: 0, quiet: region.quiet,
      });
      if (!m) continue;
      m.x = x; m.y = y;
      m.awareness = 'unaware';
      m.homeChunk = [cx, cy];
      state.entities.push(m);
      bus.emit(EV.ACTOR_SPAWNED, { id: m.id, x, y, archetype });
    }
  }

  // drop monsters that wandered far away, so the list stays small
  state.entities = state.entities.filter(e =>
    e.isNpc || e.hp > 0 && dist8(e.x, e.y, p.x, p.y) < 64);
}

const isNight = tick => { const h = Math.floor((tick % 2400) / 120); return h >= 20 || h < 4; };

/** Ambush: an ambusher may arrive already adjacent, off-road, in bad weather. */
export function maybeAmbush(state) {
  const p = state.player;
  if (state.mode !== 'overworld') return;
  if (flagsAt(state, p.x, p.y) & F.ROAD) return;                 // zero on roads
  const region = state.W.regions.get(regionAt(state.W, p.x, p.y));
  if (!region) return;
  const biome = biomeAt(state.W, p.x, p.y);
  const weather = state.weather && state.weather.kind;
  const base = 0.03 + region.quiet * 0.08;
  const mult = (weather === 'fog' ? 1.5 : 1) * (biome === 'deepwood' ? 1.4 : 1);
  const chance = (base * mult) / 100;
  if (!state.rngStreams.combat.chance(chance)) return;

  const B = BIOMES[biome];
  const pool = Object.keys(B.monsters || {}).filter(k => MONSTERS[k] && MONSTERS[k].behavior === 'ambusher');
  if (!pool.length) return;
  const rng = state.rngStreams.combat;
  const key = rng.pick(pool);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const x = p.x + dx, y = p.y + dy;
    if (isSolid(state, x, y) || moveCost(state, x, y, null) === null) continue;
    const m = generateMonster(state.master, key, `A:${state.tick}:${x},${y}`, {
      tier: region.tier, depth: 0, quiet: region.quiet,
    });
    if (!m) return;
    m.x = x; m.y = y; m.awareness = 'aware';
    state.entities.push(m);
    bus.emit(EV.ACTOR_SPAWNED, { id: m.id, x, y, archetype: key });
    bus.emit(EV.UI_LOG, { text: `${m.name} was already there.`, tone: 'bad' });
    return;
  }
}
