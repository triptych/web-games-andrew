// ============================================================
// gen/hollow/populate.js - threat and loot budgets (GDD §12.12, §15.7-15.8)
// PURE. Never spawn within 5 tiles of the up-stair; never soft-lock the
// player in the dark and hungry.
// ============================================================
import { deriveRNG, hashStr } from '../../core/rand.js';
import { DOMAINS, THREAT_TARGET, LOOT_VALUE } from '../../data/constants.js';
import { MONSTERS } from '../../data/monsters.js';
import { THEMES } from '../../data/themes.js';
import { generateMonster } from '../monster.js';
import { generateItem, makeSimpleItem } from '../item.js';

/**
 * @pure Fill a floor with monsters and loot.
 * `floor` supplies rooms, assignments, openTiles and the up-stair.
 */
export function populate(W, hollow, depth, descent, floor, quiet) {
  const rng = deriveRNG(W.master, DOMAINS.HOLLOW_POP, hashStr(hollow.id), depth, descent);
  const theme = THEMES[hollow.theme] || THEMES.barrow;
  const tier = hollow.tier;

  const monsters = [];
  const items = [];       // { x, y, item }
  const containers = [];  // { x, y, contents }

  const free = (x, y) => floor.openAt(x, y) &&
    !(Math.abs(x - floor.upStair.x) <= 5 && Math.abs(y - floor.upStair.y) <= 5) &&
    !monsters.some(m => m.x === x && m.y === y);

  // ---- threat budget ----
  const target = THREAT_TARGET(tier, depth);
  const pool = Object.keys(theme.monsters).filter(k => MONSTERS[k]);
  const weights = theme.monsters;

  const combatRooms = [], fillerRooms = [];
  for (const [roomId, node] of floor.assignments) {
    const room = floor.roomById.get(roomId);
    if (!room) continue;
    if (node.kind === 'combat' || node.kind === 'boss') combatRooms.push({ room, node });
    else if (node.kind === 'filler' || node.kind === 'hub') fillerRooms.push({ room, node });
  }

  let spent = 0;

  /** Try to place one monster in a room. Returns its threat, or 0. */
  const spawnOne = (room, sleeping) => {
    if (!pool.length) return 0;
    const key = rng.weightedKey(Object.fromEntries(pool.map(k => [k, weights[k]])));
    const A = MONSTERS[key];
    if (!A) return 0;
    for (let tries = 0; tries < 12; tries++) {
      const x = rng.int(room.x, room.x + room.w - 1), y = rng.int(room.y, room.y + room.h - 1);
      if (!free(x, y)) continue;
      const m = generateMonster(W.master, key, `${hollow.id}:d${depth}:r${descent}:m${monsters.length}`, {
        tier, depth, quiet, eliteChance: W.eliteBonus || 0,
      });
      if (!m) return 0;
      m.x = x; m.y = y;
      m.asleep = sleeping;
      m.awareness = sleeping ? 'asleep' : 'unaware';
      m.homeRoom = { x: room.x + (room.w >> 1), y: room.y + (room.h >> 1) };
      monsters.push(m);
      return A.threat;
    }
    return 0;
  };

  // The boss owns its arena and takes its threat off the top.
  if (floor.isBossFloor) {
    const arena = combatRooms.find(c => c.node.kind === 'boss');
    if (arena) {
      const boss = generateMonster(W.master, hollow.boss.archetype, `${hollow.id}:boss:r${descent}`, {
        tier, depth: depth + 3, quiet: 0,
      });
      if (boss) {
        boss.x = Math.floor(arena.room.x + arena.room.w / 2);
        boss.y = Math.floor(arena.room.y + arena.room.h / 2);
        boss.isBoss = true;
        boss.name = hollow.boss.name;
        boss.phase = 1;
        boss.awareness = 'unaware';
        monsters.push(boss);
        spent += Math.round(boss.threat * 0.6);   // a boss is not a crowd
      }
    }
  }

  // The rest of the budget is spent round-robin over rooms, so a floor always
  // lands within a monster of its target instead of over- or under-filling.
  const sleepingFloor = floor.problem && floor.problem.key === 'sleeping_pack';
  const fightRooms = combatRooms.filter(c => c.node.kind !== 'boss');
  const phases = [
    { rooms: fightRooms.length ? fightRooms : fillerRooms, upTo: target * 0.60, sleeping: sleepingFloor },
    { rooms: fillerRooms.length ? fillerRooms : fightRooms, upTo: target * 0.85, sleeping: sleepingFloor && rng.chance(0.5) },
  ];
  for (const phase of phases) {
    if (!phase.rooms.length) continue;
    let guard = 0, i = 0;
    while (spent < phase.upTo && guard++ < 200) {
      const got = spawnOne(phase.rooms[i % phase.rooms.length].room, phase.sleeping);
      i++;
      if (!got) { if (guard > phase.rooms.length * 4) break; continue; }
      spent += got;
    }
  }

  // corridor wanderers take whatever is left
  let guard = 0;
  while (spent < target && guard++ < 120 && pool.length) {
    const key = rng.weightedKey(Object.fromEntries(pool.map(k => [k, weights[k]])));
    const A = MONSTERS[key];
    if (!A || spent + A.threat > target + A.threat * 0.5) break;
    const t = floor.randomOpen(rng);
    if (!t || !free(t[0], t[1])) continue;
    const m = generateMonster(W.master, key, `${hollow.id}:d${depth}:r${descent}:w${monsters.length}`, { tier, depth, quiet });
    if (!m) break;
    m.x = t[0]; m.y = t[1];
    m.awareness = 'unaware';
    monsters.push(m);
    spent += A.threat;
  }

  // ---- loot budget ----
  const value = LOOT_VALUE(tier, depth);
  const ilvl = tier * 2 + depth + rng.int(0, 2);

  const treasureNodes = [...floor.assignments].filter(([, n]) => n.kind === 'treasure' || n.kind === 'secret');
  for (const [roomId, node] of treasureNodes) {
    const room = floor.roomById.get(roomId);
    if (!room) continue;
    const x = Math.floor(room.x + room.w / 2), y = Math.floor(room.y + room.h / 2);
    const contents = [];
    const rolls = node.kind === 'secret' ? 2 : 1;
    for (let i = 0; i < rolls; i++) {
      contents.push(generateItem(W.master, `${hollow.id}:d${depth}:r${descent}:t${roomId}`, i, {
        ilvl: ilvl + (node.kind === 'secret' ? 3 : 0),
        category: rng.weightedKey({ weapon: 4, body: 3, head: 2, offhand: 2, trinket: 2, tonic: 3 }),
      }));
    }
    contents.push({ coin: Math.round(value * 0.45 / Math.max(1, treasureNodes.length)) });
    if (node.prize && !hollow.prizeTaken) contents.prize = true;
    containers.push({ x, y, contents, node: node.kind });
  }

  // fillers get a container now and then
  for (const f of fillerRooms) {
    const n = rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const x = rng.int(f.room.x, f.room.x + f.room.w - 1), y = rng.int(f.room.y, f.room.y + f.room.h - 1);
      if (!floor.openAt(x, y)) continue;
      containers.push({
        x, y, node: 'filler',
        contents: [
          rng.chance(0.4) ? generateItem(W.master, `${hollow.id}:d${depth}:r${descent}:f${f.room.id}`, i, {
            ilvl, category: rng.weightedKey({ weapon: 3, body: 2, head: 2, tonic: 3, trinket: 1 }),
          }) : makeSimpleItem(rng.weightedKey({ bandage: 3, bread: 3, oil_flask: 2, nettle: 2, arrow: 2 }), rng.int(1, 3)),
          { coin: rng.int(2, 12) + tier * 4 },
        ],
      });
    }
  }

  // floor scatter
  const scatter = rng.int(2, 5);
  for (let i = 0; i < scatter; i++) {
    const t = floor.randomOpen(rng);
    if (!t) continue;
    items.push({
      x: t[0], y: t[1],
      item: makeSimpleItem(rng.weightedKey({ stone: 3, nettle: 3, bell_cap: 2, river_clay: 2, arrow: 2, berries: 2 }), rng.int(1, 3)),
    });
  }

  // Guaranteed: one oil flask and one food, every floor, always.
  for (const key of ['oil_flask', 'bread']) {
    const t = floor.randomOpen(rng);
    if (t) items.push({ x: t[0], y: t[1], item: makeSimpleItem(key, 1) });
  }

  return { monsters, items, containers, threatSpent: spent, threatTarget: target, lootValue: value };
}
