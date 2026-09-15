// ============================================================
// game/ai.js - behaviour state machines (GDD §15.10)
// Small machines, not behaviour trees: cheaper, and debuggable.
// Deliberately only moderately hazard-aware, so the player stays cleverer.
// ============================================================
import { DIRS8, dirIndex } from '../core/coords.js';
import { dist8 } from '../core/util.js';
import { hasLOS } from '../core/grid.js';
import { astar } from '../core/grid.js';
import { isOpaque, moveCost, isDeep } from '../world/access.js';
import { actorAt, inWeaponRange, resolveAttack } from './combat.js';
import { logLine } from './state.js';
import { hasStatus } from './status.js';
import { MONSTERS } from '../data/monsters.js';

/** Decide one action for one monster. Returns { kind, ... }. */
export function decide(state, m) {
  const p = state.player;
  if (!p || p.hp <= 0) return { kind: 'wait' };

  updateAwareness(state, m, p);

  if (m.fleeing) return flee(state, m, p);
  if (m.asleep) return { kind: 'wait' };

  // telegraphed ability: the windup resolves this turn
  if (m.windup) {
    const w = m.windup;
    m.windup = null;
    return { kind: 'ability', ability: w.ability, x: w.x, y: w.y };
  }

  switch (m.behavior) {
    case 'sentry': return sentry(state, m, p);
    case 'ambusher': return ambusher(state, m, p);
    case 'charger': return charger(state, m, p);
    case 'caster': return caster(state, m, p);
    case 'pack': return pack(state, m, p);
    case 'swarm': return swarm(state, m, p);
    case 'erratic': return erratic(state, m, p);
    case 'warden': return warden(state, m, p);
    case 'follower': return follower(state, m, p);
    default: return wanderer(state, m, p);
  }
}

/** unaware -> suspicious -> aware, driven by sight and hearing. */
function updateAwareness(state, m, p) {
  if (m.awareness === 'aware') {
    if (m.lastSeenTick !== undefined && state.tick - m.lastSeenTick > 10 && !canSee(state, m, p)) {
      m.awareness = 'suspicious';
    }
    return;
  }
  if (canSee(state, m, p)) {
    m.awareness = 'aware';
    m.asleep = false;
    m.lastSeenTick = state.tick;
    m.lastKnown = { x: p.x, y: p.y };
    return;
  }
  if (canHear(state, m, p)) {
    m.awareness = m.awareness === 'suspicious' ? 'aware' : 'suspicious';
    m.lastKnown = { x: p.x, y: p.y };
  }
}

export function canSee(state, m, p) {
  let sight = m.sight || 6;
  if (m.asleep) sight = Math.max(1, sight - 4);
  // A lit lantern is visible from further away. The whole stealth layer.
  sight += Math.max(0, (p.lightRadius || 0) - 2);
  if (state.mode !== 'hollow' && isNightish(state)) sight = Math.round(sight * 0.6);
  if (p.sneaking) sight -= 3;
  sight -= Math.round((p.stealth || 0) / 3);
  if (dist8(m.x, m.y, p.x, p.y) > Math.max(1, sight)) return false;
  return hasLOS(m.x, m.y, p.x, p.y, (x, y) => isOpaque(state, x, y));
}

function isNightish(state) {
  const h = Math.floor((state.tick % 2400) / 120);
  return h >= 20 || h < 4;
}

function canHear(state, m, p) {
  let hearing = m.hearing || 8;
  if (p.sneaking) hearing -= 3;
  if (p.attackedThisTurn) hearing += 3;
  if (p.heavyStep) hearing += 2;
  return dist8(m.x, m.y, p.x, p.y) <= Math.max(1, hearing);
}

// --- behaviours -----------------------------------------------------------

function wanderer(state, m, p) {
  if (m.awareness === 'aware') {
    if (state.tick - (m.lastSeenTick || 0) > 10) { m.awareness = 'suspicious'; }
    else return approachOrAttack(state, m, p);
  }
  if (m.awareness === 'suspicious' && m.lastKnown) return stepToward(state, m, m.lastKnown.x, m.lastKnown.y);
  return randomStep(state, m);
}

function sentry(state, m, p) {
  if (m.awareness !== 'aware') return { kind: 'wait' };
  if (inWeaponRange(m, p.x, p.y)) return { kind: 'attack', x: p.x, y: p.y };
  if (m.ability && m.ability.range >= dist8(m.x, m.y, p.x, p.y)) return telegraph(state, m, p);
  if (m.homeRoom && dist8(m.x, m.y, m.homeRoom.x, m.homeRoom.y) > 6) return stepToward(state, m, m.homeRoom.x, m.homeRoom.y);
  return approachOrAttack(state, m, p);
}

function ambusher(state, m, p) {
  const d = dist8(m.x, m.y, p.x, p.y);
  if (d <= 1) return { kind: 'attack', x: p.x, y: p.y };
  if (m.ability && d <= m.ability.range && m.awareness === 'aware') return telegraph(state, m, p);
  if (m.awareness === 'aware' && d <= 4) return stepToward(state, m, p.x, p.y);
  return { kind: 'wait' };                       // waits in cover, which is the point
}

function charger(state, m, p) {
  if (m.awareness !== 'aware') return wanderer(state, m, p);
  const d = dist8(m.x, m.y, p.x, p.y);
  if (d <= 1) return { kind: 'attack', x: p.x, y: p.y };
  if (m.ability && d <= m.ability.range && !m.abilityCooldown) return telegraph(state, m, p);
  // closes in straight lines; overshoots if the player steps aside
  const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
  if (moveCost(state, m.x + dx, m.y + dy, m) !== null && !actorAt(state, m.x + dx, m.y + dy)) {
    return { kind: 'move', dx, dy };
  }
  return stepToward(state, m, p.x, p.y);
}

function caster(state, m, p) {
  if (m.awareness !== 'aware') return wanderer(state, m, p);
  const d = dist8(m.x, m.y, p.x, p.y);
  if (d <= 1) {
    const away = { dx: Math.sign(m.x - p.x), dy: Math.sign(m.y - p.y) };
    if (moveCost(state, m.x + away.dx, m.y + away.dy, m) !== null) return { kind: 'move', ...away };
    return { kind: 'attack', x: p.x, y: p.y };
  }
  if (m.ability && !m.abilityCooldown && d <= m.ability.range) return telegraph(state, m, p);
  if (d > 6) return stepToward(state, m, p.x, p.y);
  return { kind: 'wait' };
}

function pack(state, m, p) {
  // shares alert state with allies within 8
  if (m.awareness === 'aware') {
    for (const e of state.entities) {
      if (e === m || e.hp <= 0 || e.archetype !== m.archetype) continue;
      if (dist8(e.x, e.y, m.x, m.y) <= 8) { e.awareness = 'aware'; e.lastKnown = { x: p.x, y: p.y }; e.asleep = false; }
    }
  } else return wanderer(state, m, p);

  if (dist8(m.x, m.y, p.x, p.y) <= 1) return { kind: 'attack', x: p.x, y: p.y };
  // flank: prefer a tile adjacent to the player that no ally holds
  let best = null, bestScore = -Infinity;
  for (const [dx, dy] of DIRS8) {
    const tx = p.x + dx, ty = p.y + dy;
    if (moveCost(state, tx, ty, m) === null || actorAt(state, tx, ty)) continue;
    const d = dist8(m.x, m.y, tx, ty);
    const score = -d * 2 + (allyAdjacent(state, m, tx, ty) ? -3 : 2);
    if (score > bestScore) { bestScore = score; best = [tx, ty]; }
  }
  if (best) return stepToward(state, m, best[0], best[1]);
  return stepToward(state, m, p.x, p.y);
}

function allyAdjacent(state, m, x, y) {
  return state.entities.some(e => e !== m && e.hp > 0 && !e.isPlayer && dist8(e.x, e.y, x, y) === 0);
}

function swarm(state, m, p) {
  if (m.awareness !== 'aware') return wanderer(state, m, p);
  if (dist8(m.x, m.y, p.x, p.y) <= 1) return { kind: 'attack', x: p.x, y: p.y };
  return stepToward(state, m, p.x, p.y, true);
}

function erratic(state, m, p) {
  const rng = state.rngStreams.combat;
  if (rng.chance(0.4)) return randomStep(state, m);
  if (dist8(m.x, m.y, p.x, p.y) <= 1) return { kind: 'attack', x: p.x, y: p.y };
  return stepToward(state, m, p.x, p.y, true);
}

function follower(state, m, p) {
  const d = dist8(m.x, m.y, p.x, p.y);
  if (m.waiting) return { kind: 'wait' };
  if (d > 2) return stepToward(state, m, p.x, p.y);
  return { kind: 'wait' };
}

/** Boss logic: two phases, telegraphs, and always an out. */
function warden(state, m, p) {
  if (m.hp <= m.maxHp * 0.5 && m.phase === 1) {
    m.phase = 2;
    m.atk = Math.round(m.atk * 1.15);
    m.speed += 10;
    logLine(`${m.name} changes. Whatever it was holding back, it is not holding back now.`, 'bad');
    return { kind: 'wait' };
  }
  const d = dist8(m.x, m.y, p.x, p.y);
  // never follows past its arena
  if (m.arena && !inArena(m.arena, p.x, p.y) && !inArena(m.arena, m.x, m.y)) {
    return stepToward(state, m, m.arena.x + (m.arena.w >> 1), m.arena.y + (m.arena.h >> 1));
  }
  if (m.ability && !m.abilityCooldown && d <= m.ability.range) return telegraph(state, m, p);
  if (d <= 1) return { kind: 'attack', x: p.x, y: p.y };
  return stepToward(state, m, p.x, p.y);
}

const inArena = (a, x, y) => x >= a.x - 1 && y >= a.y - 1 && x < a.x + a.w + 1 && y < a.y + a.h + 1;

function flee(state, m, p) {
  const dx = Math.sign(m.x - p.x), dy = Math.sign(m.y - p.y);
  for (const [ox, oy] of [[dx, dy], [dx, 0], [0, dy]]) {
    if (!ox && !oy) continue;
    if (moveCost(state, m.x + ox, m.y + oy, m) !== null && !actorAt(state, m.x + ox, m.y + oy)) {
      return { kind: 'move', dx: ox, dy: oy };
    }
  }
  return { kind: 'attack', x: p.x, y: p.y };
}

/** Announce, then land it next turn. A player who reads the board is safe. */
function telegraph(state, m, p) {
  const A = MONSTERS[m.archetype];
  const tell = (A && A.tells && A.tells.windup) || 'draws back';
  m.windup = { ability: m.ability.key, x: p.x, y: p.y };
  m.abilityCooldown = m.ability.cooldown;
  logLine(`${cap(m.name)} ${tell}.`, 'warn');
  return { kind: 'telegraph', x: p.x, y: p.y, ability: m.ability.key };
}

function approachOrAttack(state, m, p) {
  if (inWeaponRange(m, p.x, p.y)) return { kind: 'attack', x: p.x, y: p.y };
  if (m.ability && !m.abilityCooldown && dist8(m.x, m.y, p.x, p.y) <= m.ability.range) return telegraph(state, m, p);
  return stepToward(state, m, p.x, p.y);
}

/** Path if we can afford to; otherwise take the greedy step. */
function stepToward(state, m, tx, ty, greedy = false) {
  if (!greedy) {
    const path = astar(m.x, m.y, tx, ty, {
      cost: (x, y) => {
        const c = moveCost(state, x, y, m);
        if (c === null) return null;
        if (isDeep(state, x, y)) return null;
        const other = actorAt(state, x, y);
        if (other && !other.isPlayer) return null;
        return 100 + c;
      },
      maxNodes: 220,
    });
    if (path && path.length) {
      const [nx, ny] = path[0];
      return { kind: 'move', dx: Math.sign(nx - m.x), dy: Math.sign(ny - m.y) };
    }
  }
  const dx = Math.sign(tx - m.x), dy = Math.sign(ty - m.y);
  const tries = [[dx, dy], [dx, 0], [0, dy]];
  for (const [ox, oy] of tries) {
    if (!ox && !oy) continue;
    if (moveCost(state, m.x + ox, m.y + oy, m) === null) continue;
    const other = actorAt(state, m.x + ox, m.y + oy);
    if (other && !other.isPlayer) continue;
    return { kind: 'move', dx: ox, dy: oy };
  }
  return { kind: 'wait' };
}

function randomStep(state, m) {
  const rng = state.rngStreams.combat;
  const d = DIRS8[rng.int(0, 7)];
  if (moveCost(state, m.x + d[0], m.y + d[1], m) === null) return { kind: 'wait' };
  if (actorAt(state, m.x + d[0], m.y + d[1])) return { kind: 'wait' };
  return { kind: 'move', dx: d[0], dy: d[1] };
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
