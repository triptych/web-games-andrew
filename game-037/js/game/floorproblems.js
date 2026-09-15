// ============================================================
// game/floorproblems.js - the situation a Hollow floor poses (GDD §12.7)
// Rising water, collapsing ground, and the long wait that is resting.
// ============================================================
import { DIRS8 } from '../core/coords.js';
import { dist8 } from '../core/util.js';
import { T } from '../data/tiles.js';
import { logLine } from './state.js';
import { startOfTurn, spendPlayerEnergy } from './scheduler.js';
import { hasStatus } from './status.js';

export function tickFloorProblem(state) {
  const floor = state.hollow && state.hollow.floor;
  if (!floor || !floor.problem) return;
  if (floor.problem.key === 'rising_water' && floor.waterRiseEvery > 0) {
    if (state.tick % floor.waterRiseEvery === 0) {
      floor.waterLevel = (floor.waterLevel || 0) + 1;
      floodOnce(state, floor);
      logLine('The water is higher than it was.', 'warn');
    }
  }
  if (floor.problem.key === 'collapse' && floor.collapsing) {
    // handled on step
  }
}

export function floodOnce(state, floor) {
  const rng = state.rngStreams.cosmetic;
  for (let k = 0; k < 60; k++) {
    const x = rng.int(1, floor.w - 2), y = rng.int(1, floor.h - 2);
    const i = y * floor.w + x;
    if (!floor.openAt(x, y)) continue;
    let adjacentWater = false;
    for (const [dx, dy] of DIRS8) {
      const j = (y + dy) * floor.w + (x + dx);
      if (floor.ground[j] === T.water_hollow) { adjacentWater = true; break; }
    }
    if (adjacentWater) floor.ground[i] = T.water_hollow;
  }
}

export function collapseBehind(state, x, y) {
  const floor = state.hollow.floor;
  const rng = state.rngStreams.cosmetic;
  for (const [dx, dy] of DIRS8) {
    if (!rng.chance(0.12)) continue;
    const cx = x - dx * 2, cy = y - dy * 2;
    if (!floor.openAt(cx, cy)) continue;
    floor.ground[cy * floor.w + cx] = floor.ground[0] || T.wall_stone;
  }
}

export function doRestUntil(state) {
  const p = state.player;
  let turns = 0;
  while (turns < 200) {
    if (p.hp >= p.maxHp) break;
    if (state.entities.some(e => !e.isNpc && e.hp > 0 && e.hostile !== false && dist8(e.x, e.y, p.x, p.y) <= (p.lightRadius || 6))) break;
    if (p.lanternLit && p.lanternOil <= 1) break;
    if (hasStatus(p, 'hungry') || hasStatus(p, 'starving')) break;
    turns++;
    startOfTurn(state, p);
    spendPlayerEnergy(state, 100);
  }
  logLine(turns ? `You wait. ${turns} turns.` : 'No time to rest.', 'plain');
  return 0;
}
