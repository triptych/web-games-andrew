// ============================================================
// game/combat.js - damage, crits, situational multipliers (GDD §17)
// No misses, except the three signposted cases. Randomness lives in damage
// variance, never in whiff-frustration.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DIRS8, dirIndex } from '../core/coords.js';
import { dist8 } from '../core/util.js';
import {
  CRIT_MULT, DMG_VARIANCE, UNAWARE_MULT, UNAWARE_KNIFE_MULT, BEHIND_MULT, FLANK_MULT,
  MORALE_FLEE_HP,
} from '../data/constants.js';
import { HIT_VERBS, DEATH_LINES, conjugate } from '../data/text.js';
import { MONSTERS } from '../data/monsters.js';
import { itemStats } from '../gen/item.js';
import { State, logLine, difficultyMods } from './state.js';
import { addStatus, statusSum, statusFlag, hasStatus } from './status.js';
import { isDeep, isLiquid, objectAt, moveCost } from '../world/access.js';
import { O } from '../data/objects.js';

/** The attack shape of the player's current weapon. */
export function weaponOf(actor) {
  if (!actor.isPlayer) {
    return {
      damage: actor.atk, energy: 100, dmgType: actor.dmgType || 'blunt',
      pattern: 'single', range: 1, mods: {}, key: actor.archetype,
    };
  }
  const it = actor.equipment.hand;
  if (!it) return { damage: 1, energy: 100, dmgType: 'blunt', pattern: 'single', range: 1, mods: {}, key: 'fists' };
  const st = itemStats(it);
  return { ...st, key: it.base, item: it };
}

/** Which tiles an attack from (ax,ay) toward (tx,ty) actually strikes. */
export function attackTargets(state, attacker, tx, ty) {
  const w = weaponOf(attacker);
  const primary = actorAt(state, tx, ty);
  const out = [];
  if (primary) out.push({ actor: primary, mult: 1 });

  if (w.pattern === 'cleave' && primary) {
    const di = dirIndex(Math.sign(tx - attacker.x), Math.sign(ty - attacker.y));
    for (const off of [-1, 1]) {
      const d = DIRS8[(di + off + 8) % 8];
      const a = actorAt(state, attacker.x + d[0], attacker.y + d[1]);
      if (a && a !== primary) out.push({ actor: a, mult: 0.6 });
    }
  } else if (w.pattern === 'sweep') {
    for (const d of DIRS8) {
      const a = actorAt(state, attacker.x + d[0], attacker.y + d[1]);
      if (a && !out.some(o => o.actor === a)) out.push({ actor: a, mult: 0.7 });
    }
  }
  return out;
}

export function actorAt(state, x, y) {
  if (state.player && state.player.x === x && state.player.y === y) return state.player;
  return state.entities.find(e => e.hp > 0 && e.x === x && e.y === y) || null;
}

/** Can `attacker` reach (tx,ty) with its current weapon? */
export function inWeaponRange(attacker, tx, ty) {
  const w = weaponOf(attacker);
  const d = dist8(attacker.x, attacker.y, tx, ty);
  if (w.pattern === 'reach') return d <= 2;
  if (w.pattern === 'ranged') return d <= (w.range || 6);
  return d <= 1;
}

/** Resolve one attack. Returns total damage dealt. */
export function resolveAttack(state, attacker, tx, ty, opts = {}) {
  const rng = state.rngStreams.combat;
  const w = weaponOf(attacker);
  const targets = opts.targets || attackTargets(state, attacker, tx, ty);
  if (!targets.length) return 0;

  let total = 0;
  for (const { actor: target, mult } of targets) {
    if (!target || target.hp <= 0) continue;

    // --- the only three ways an attack misses ---
    if (statusFlag(attacker, 'missChance') && rng.chance(0.5)) {
      logLine(`${nameOf(attacker)} swings at nothing.`, 'plain');
      continue;
    }
    if (target.flickering && rng.chance(0.4)) {
      logLine(`${nameOf(target)} is not quite there. The blow goes through.`, 'plain');
      continue;
    }

    const base = w.damage + (w.mods.dmg || 0);
    const attr = attacker.isPlayer
      ? Math.floor((w.pattern === 'ranged' ? attacker.attrs.hand : attacker.attrs.body) * 0.7)
      : 0;
    let raw = base + attr;
    if (attacker.isPlayer && hasStatus(attacker, 'starving')) raw -= 2;

    let situational = mult;
    if (target.awareness === 'unaware' || target.asleep) {
      situational *= (w.key === 'knife' ? UNAWARE_KNIFE_MULT : UNAWARE_MULT) + (attacker.mods ? (attacker.mods.unaware || 0) : 0);
    }
    if (!target.isPlayer && target.facing !== undefined) {
      const back = dirIndex(Math.sign(attacker.x - target.x), Math.sign(attacker.y - target.y));
      if (back >= 0 && Math.abs(back - target.facing) >= 3) situational *= BEHIND_MULT;
    }
    if (flanked(state, target, attacker)) situational *= FLANK_MULT;
    if (isDeep(state, target.x, target.y) && w.dmgType === 'blunt') situational *= 1.2;
    if (isDeep(state, attacker.x, attacker.y)) situational *= 0.75;
    if (attacker.movedThisTurn && (w.pattern === 'reach' || w.pattern === 'ranged')) situational *= 0.85;
    if (objectAt(state, attacker.x, attacker.y) === O.rubble_pile) situational *= 1.1;
    if (hasStatus(attacker, 'heartened')) situational *= 1.1;
    if (!attacker.isPlayer) situational *= difficultyMods().monsterDmg;

    const variance = raw * rng.float(DMG_VARIANCE[0], DMG_VARIANCE[1]);
    const crit = rng.chance(attacker.isPlayer ? attacker.critChance : 0.05);
    const preMit = variance * (crit ? CRIT_MULT : 1) * situational;

    const armour = armourOfTarget(target);
    const evasionFlat = (target.evasion || 0) * 0.5;
    const mitigated = Math.max(1, preMit - (armour + evasionFlat));
    let dmgType = w.dmgType;
    if (w.mods.fire) dmgType = 'fire';
    const resist = resistMultiplier(dmgType, target, attacker);
    const final = Math.round(mitigated * resist);

    total += applyDamage(state, target, final, dmgType, attacker, crit, resist);

    // affix riders
    if (w.mods.fire && final > 0 && rng.chance(0.3)) addStatus(target, 'burning', 4);
    if (attacker.mods && attacker.mods.onHitStatus) addStatus(target, attacker.mods.onHitStatus, 8);
    if (!attacker.isPlayer && attacker.mods && attacker.mods.onHitStatus) addStatus(target, attacker.mods.onHitStatus, 8);
    if (w.mods.healOnKill && target.hp <= 0 && attacker.isPlayer) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + w.mods.healOnKill);
    }
    if (w.pattern === 'knockback' && target.hp > 0) knockback(state, attacker, target, 1);
  }

  // wear on the weapon
  if (attacker.isPlayer && w.item && w.item.condition > 0) {
    const slow = 1 + (attacker.mods.slowDecay || 0);
    if (rng.chance(0.08 / slow)) {
      w.item.condition = Math.max(0, w.item.condition - 1);
      if (w.item.condition === 0) {
        logLine(`Your ${w.item.name} gives up.`, 'bad');
        bus.emit(EV.ITEM_BROKE, { uid: w.item.uid });
      }
    }
  }
  return total;
}

function armourOfTarget(t) {
  const base = t.isPlayer ? (t.armour || 0) : (t.def || 0);
  return base + statusSum(t, 'armour');
}

function flanked(state, target, attacker) {
  const dx = Math.sign(attacker.x - target.x), dy = Math.sign(attacker.y - target.y);
  const opp = actorAt(state, target.x - dx, target.y - dy);
  return !!(opp && opp !== attacker && opp.hp > 0 && (opp.isPlayer === attacker.isPlayer));
}

export function resistMultiplier(type, target, attacker) {
  let m = 1;
  const A = target.isPlayer ? null : MONSTERS[target.archetype];
  if (A) {
    if (A.resist && A.resist[type] !== undefined) m *= A.resist[type];
    if (A.weak && A.weak[type] !== undefined) m *= A.weak[type];
  }
  if (type === 'name') {
    if (target.isPlayer) {
      m *= (1 - (target.mods.resistName || 0));
      if (hasStatus(target, 'warded')) m *= 0.5;
    }
  }
  // materials and affixes that care who they are hitting
  if (attacker && attacker.isPlayer) {
    const w = weaponOf(attacker);
    if (w.mods.vs && target.family === w.mods.vs) m *= w.mods.mult || 1.25;
  }
  return m;
}

/** Apply damage, emit the events, and handle death. */
export function applyDamage(state, target, amount, type, source, crit = false, resist = 1) {
  if (amount <= 0) return 0;
  if (type === 'name') amount = Math.round(amount);            // ignores armour by design
  target.hp -= amount;
  bus.emit(EV.ACTOR_DAMAGED, { id: target.id, amount, type, crit, sourceId: source ? source.id : null, x: target.x, y: target.y });

  const base = amount >= 12 ? pick(HIT_VERBS.heavy) : amount >= 5 ? pick(HIT_VERBS.solid) : pick(HIT_VERBS.light);
  if (source && source.isPlayer) {
    logLine(`You ${conjugate(base, true)} ${nameOf(target)}${crit ? ', hard' : ''}. ${amount}.`, 'hit');
    // A resistance the player cannot see is a resistance they cannot play around.
    if (resist <= 0.6) logLine(`${cap(type)} does not do much to that. Try something else.`, 'warn');
    else if (resist >= 1.4) logLine(`That is what it does not like.`, 'good');
  } else if (target.isPlayer) {
    logLine(`${cap(nameOf(source))} ${conjugate(base, false)} you. ${amount}.`, 'bad');
  }

  if (target.awareness === 'unaware' || target.asleep) {
    target.asleep = false;
    target.awareness = 'aware';
    bus.emit(EV.ACTOR_AWARENESS, { id: target.id, state: 'aware' });
  }

  if (target.hp <= 0) die(state, target, source);
  else if (!target.isPlayer) checkMorale(state, target);
  return amount;
}

function die(state, target, source) {
  if (target.isPlayer) return;                                  // the Wake handles this
  target.hp = 0;
  const A = MONSTERS[target.archetype];
  const line = A ? pick(DEATH_LINES[target.family] || DEATH_LINES.beast) : 'stops.';
  logLine(`${cap(nameOf(target))} ${line}`, 'good');
  bus.emit(EV.ACTOR_DIED, { id: target.id, killerId: source ? source.id : null, x: target.x, y: target.y, archetype: target.archetype });
}

/** Morale: fleeing must be readable, or it looks like a bug. */
function checkMorale(state, m) {
  if (m.behavior === 'erratic' || m.behavior === 'warden' || m.fleeing) return;
  const rng = state.rngStreams.combat;
  const packLost = m.packId ? state.entities.filter(e => e.packId === m.packId && e.hp <= 0).length : 0;
  const packSize = m.packId ? state.entities.filter(e => e.packId === m.packId).length : 1;
  const half = packSize > 1 && packLost >= packSize / 2;
  if (m.hp / m.maxHp < MORALE_FLEE_HP && (half || rng.chance(0.5))) {
    m.fleeing = true;
    m.state = 'flee';
    logLine(`${cap(nameOf(m))} turns away.`, 'plain');
  }
}

/** Shove and knockback share one resolution. */
export function knockback(state, source, target, tiles) {
  if (statusFlag(target, 'noKnockback')) return false;
  const dx = Math.sign(target.x - source.x), dy = Math.sign(target.y - source.y);
  let moved = false;
  for (let i = 0; i < tiles; i++) {
    const nx = target.x + dx, ny = target.y + dy;
    if (actorAt(state, nx, ny)) break;
    if (moveCost(state, nx, ny, target) === null) break;
    target.x = nx; target.y = ny;
    moved = true;
  }
  if (moved) {
    if (isLiquid(state, target.x, target.y) && isDeep(state, target.x, target.y)) {
      logLine(`${cap(nameOf(target))} goes into the water.`, 'plain');
    }
    bus.emit(EV.ACTOR_MOVED, { id: target.id, from: { x: target.x - dx, y: target.y - dy }, to: { x: target.x, y: target.y } });
  }
  return moved;
}

export const nameOf = a => a ? (a.isPlayer ? 'you' : a.name) : 'something';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = arr => arr[Math.floor(State.rngStreams.cosmetic.next() * arr.length)];
