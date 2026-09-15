// ============================================================
// game/scheduler.js - the energy scheduler (GDD §16)
// Input-driven: it runs until the player owes an action, then stops.
// Never on a timer.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { ENERGY_CAP, ENERGY_STEP, REGEN_TURNS, HUNGRY_AT, STARVING_AT } from '../data/constants.js';
import { State, logLine } from './state.js';
import { decide } from './ai.js';
import { actorAt, resolveAttack, applyDamage, knockback } from './combat.js';
import { tickStatuses, addStatus, removeStatus, hasStatus, statusSum } from './status.js';
import { moveCost, isDeep } from '../world/access.js';
import { advanceTime } from './time.js';
import { MONSTERS } from '../data/monsters.js';
import { dist8 } from '../core/util.js';
import { recomputePlayer, carriedWeight } from './player.js';
import { regionAt } from '../gen/fields.js';
import { LANTERN_BURN_TURNS, GREEN_FLAME_COST } from '../data/constants.js';

/** Turn order is explicit: energy desc, then initiative, then id. */
function nextActor(state) {
  // NPCs do not take turns: they are placed by their schedule, not scheduled.
  const actors = [state.player, ...state.entities].filter(a => a && a.hp > 0 && !a.isNpc);
  let best = null;
  for (const a of actors) {
    const cheapest = a.isPlayer ? 50 : 100;
    if (a.energy < cheapest) continue;
    if (!best) { best = a; continue; }
    if (a.energy > best.energy) { best = a; continue; }
    if (a.energy === best.energy) {
      if ((a.initiative || 0) < (best.initiative || 0)) best = a;
      else if ((a.initiative || 0) === (best.initiative || 0) && String(a.id) < String(best.id)) best = a;
    }
  }
  return best;
}

function grantEnergy(state) {
  const actors = [state.player, ...state.entities].filter(a => a && a.hp > 0 && !a.isNpc);
  for (const a of actors) {
    a.energy = Math.min(ENERGY_CAP, a.energy + effectiveSpeed(a));
  }
}

export function effectiveSpeed(a) {
  let s = a.speed || 100;
  s += statusSum(a, 'speed');
  return Math.max(30, s);
}

/** Run the world until the player owes an action. Fails loudly, never hangs. */
export function runUntilPlayerInput(state) {
  let guard = 0;
  while (guard++ < 10000) {
    // If the player has gone down, stop: the Wake is what happens next, and
    // the world must not keep taking turns without them.
    if (!state.player || state.player.hp <= 0) return;
    const actor = nextActor(state);
    if (!actor) { grantEnergy(state); continue; }
    if (actor.isPlayer) return;
    const action = decide(state, actor);
    applyMonsterAction(state, actor, action);
  }
  console.error('scheduler runaway');
  state.player.energy = ENERGY_CAP;
}

function applyMonsterAction(state, m, action) {
  startOfTurn(state, m);
  if (m.hp <= 0) return;
  let spent = 100;
  switch (action.kind) {
    case 'move': {
      const nx = m.x + action.dx, ny = m.y + action.dy;
      const c = moveCost(state, nx, ny, m);
      if (c === null || actorAt(state, nx, ny)) { spent = 100; break; }
      const from = { x: m.x, y: m.y };
      m.x = nx; m.y = ny;
      m.facing = action.dy < 0 ? 0 : action.dy > 0 ? 4 : action.dx > 0 ? 2 : 6;
      spent = (action.dx && action.dy ? 140 : 100) + c;
      bus.emit(EV.ACTOR_MOVED, { id: m.id, from, to: { x: nx, y: ny } });
      break;
    }
    case 'attack':
      resolveAttack(state, m, action.x, action.y);
      spent = 100;
      break;
    case 'telegraph':
      spent = 100;
      break;
    case 'ability':
      resolveAbility(state, m, action);
      spent = 100;
      break;
    default:
      spent = 100;
  }
  m.energy -= Math.max(50, spent);
  if (m.abilityCooldown > 0) m.abilityCooldown--;
  bus.emit(EV.ACTION_RESOLVED, { actorId: m.id, kind: action.kind, energy: spent });
}

function resolveAbility(state, m, action) {
  const A = MONSTERS[m.archetype];
  const ab = A && A.ability;
  if (!ab) return;
  const p = state.player;
  const hits = ab.sweep
    ? [p].filter(t => dist8(m.x, m.y, t.x, t.y) <= (ab.range || 1))
    : [p].filter(t => t.x === action.x && t.y === action.y || dist8(t.x, t.y, action.x, action.y) <= 0);
  if (!hits.length) {
    logLine(`${cap(m.name)} misjudges it. You are not there any more.`, 'good');
    return;
  }
  for (const t of hits) {
    const dmg = Math.round(m.atk * 1.3);
    applyDamage(state, t, dmg, m.dmgType || 'blunt', m);
    if (ab.status) addStatus(t, ab.status, 8);
    if (ab.knockback) knockback(state, m, t, ab.knockback);
  }
}

/** Status ticks, regeneration and hunger, once per actor turn. */
export function startOfTurn(state, actor) {
  tickStatuses(actor, (a, dmg) => applyDamage(state, a, dmg, 'blunt', null));
  if (!actor.isPlayer) return;
  const p = actor;

  // hunger is slow and forgiving; it exists to make coming up pleasant
  p.nutrition -= 1;
  const hungerTicks = 2400 * 2 - p.nutrition;
  if (p.nutrition <= 0 && !hasStatus(p, 'starving')) { addStatus(p, 'starving', 9999); removeStatus(p, 'hungry'); }
  else if (p.nutrition < 1200 && p.nutrition > 0 && !hasStatus(p, 'hungry') && !hasStatus(p, 'starving')) addStatus(p, 'hungry', 9999);
  else if (p.nutrition >= 1200) { removeStatus(p, 'hungry'); removeStatus(p, 'starving'); }

  // encumbrance
  const over = carriedWeight(p) > p.carry;
  if (over && !hasStatus(p, 'encumbered')) addStatus(p, 'encumbered', 9999);
  else if (!over && hasStatus(p, 'encumbered')) removeStatus(p, 'encumbered');

  // regeneration, out of combat
  const blocked = p.statuses.some(s => ['hungry', 'starving', 'poisoned'].includes(s.key));
  if (!blocked && p.hp < p.maxHp) {
    const region = regionQuiet(state);
    let every = REGEN_TURNS + (p.mods.regen ? -p.mods.regen * 2 : 0);
    if (p.restingAtHearth) every = Math.max(2, Math.floor(every / (2 * (p.mods.hearthRegen || 1))));
    if (region >= 0.5) every *= 4;
    if (State.tick % Math.max(2, Math.round(every)) === 0) p.hp = Math.min(p.maxHp, p.hp + 1);
  }

  // the lantern burns
  burnLantern(state, p);
}

function regionQuiet(state) {
  if (state.mode === 'hollow') return 0.3;
  const r = state.W.regions.get(regionAt(state.W, state.player.x, state.player.y));
  return r ? r.quiet : 0.2;
}

function burnLantern(state, p) {
  if (!p.lanternLit || p.lanternOil <= 0) return;
  const rate = LANTERN_BURN_TURNS * (p.mods.oilRate ? 1 / p.mods.oilRate : 1);
  const cost = p.greenFlame ? GREEN_FLAME_COST : 1;
  p.oilCarry = (p.oilCarry || 0) + cost / rate;
  while (p.oilCarry >= 1) {
    p.oilCarry -= 1;
    p.lanternOil = Math.max(0, p.lanternOil - 1);
  }
  if (p.lanternOil === 0 && p.lanternLit) {
    p.lanternLit = false;
    p.greenFlame = false;
    recomputePlayer(p);
    logLine('The lantern gutters and goes out.', 'bad');
  } else if (p.lanternOil === 12) {
    logLine('The lantern is getting low.', 'warn');
  }
}

/** Spend the player's energy and let the world catch up. */
export function spendPlayerEnergy(state, energy) {
  const p = state.player;
  // A single action must never hand the scheduler hundreds of world turns to
  // simulate. Long actions (sleep, travel) move the clock themselves.
  const scheduled = Math.min(energy, ENERGY_CAP * 3);
  p.energy -= scheduled;
  advanceTime(energy);
  for (const e of state.entities) if (e.abilityCooldown > 0 && e.hp > 0) { /* ticked in their own turn */ }
  bus.emit(EV.ACTION_RESOLVED, { actorId: 'player', kind: 'player', energy: scheduled });
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
