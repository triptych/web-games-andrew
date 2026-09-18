// ============================================================
// game/effects.js - the one interpreter for item effects (GDD 10)
// An item behaves identically in battle, in the field menu and in a shop
// preview because all three call this. Returns a list of log lines plus
// a summary the caller can act on.
// ============================================================
import { item } from '../data/items.js';
import { STATUSES } from '../data/statuses.js';
import { statsOf, clampPools, addBond, cleanse, checkStage } from '../gen/dragon.js';
import { ESSENCE_CAP } from '../data/constants.js';
import { clamp } from '../core/util.js';

/**
 * Apply an item to a target dragon (or to a battle, for field-wide effects).
 * @param itemId  id from data/items.js
 * @param target  dragon, or null for battle-scoped effects
 * @param ctx     { battle, rng, party, inBattle }
 * @returns { ok, why?, lines: [], consumed: bool, ... }
 */
export function applyItem(itemId, target, ctx = {}) {
  const def = item(itemId);
  if (!def) return { ok: false, why: 'Nothing happens.', lines: [], consumed: false };
  const e = def.effect || {};
  const lines = [];
  let did = false;

  const heal = (d, amount) => {
    const max = statsOf(d).hp;
    const before = d.hp;
    d.hp = clamp(d.hp + Math.round(amount), 0, max);
    if (d.hp > before) { lines.push(`${d.name} recovers ${d.hp - before} health.`); did = true; }
    return d.hp - before;
  };

  const targets = () => {
    if (e.target === 'allies') return (ctx.party || []).filter(d => d && !d.fainted);
    return target ? [target] : [];
  };

  // --- revival has to come first: a fainted dragon refuses everything else
  if (e.revive) {
    if (!target) return { ok: false, why: 'Choose a dragon.', lines, consumed: false };
    if (!target.fainted && target.hp > 0) return { ok: false, why: `${target.name} is already awake.`, lines, consumed: false };
    target.fainted = false;
    target.hp = Math.max(1, Math.round(statsOf(target).hp * e.revive));
    lines.push(`${target.name} stirs, and gets up.`);
    return { ok: true, lines, consumed: true, revived: true };
  }
  for (const d of targets()) if (d.fainted && !e.revive) {
    return { ok: false, why: `${d.name} is out cold. It needs a Phoenix Cinder.`, lines, consumed: false };
  }

  if (e.heal) for (const d of targets()) heal(d, e.heal);
  if (e.healPctMax) for (const d of targets()) heal(d, statsOf(d).hp * e.healPctMax);

  if (e.mp || e.mpPctMax) for (const d of targets()) {
    const max = statsOf(d).mp;
    const before = d.mp;
    d.mp = clamp(d.mp + Math.round(e.mp || max * e.mpPctMax), 0, max);
    if (d.mp > before) { lines.push(`${d.name} recovers ${d.mp - before} ley.`); did = true; }
  }

  if (e.cure || e.cureAll) for (const d of targets()) {
    const list = d.statuses || [];
    const before = list.length;
    d.statuses = list.filter(s => e.cureAll ? !STATUSES[s.id]?.bad : !e.cure.includes(s.id));
    if (d.statuses.length < before) {
      lines.push(`${d.name} is clear of ${e.cureAll ? 'everything' : e.cure.map(c => STATUSES[c]?.name || c).join(' and ')}.`);
      did = true;
    }
  }

  if (e.cleanse && target) {
    if (target.ashbound) {
      const oldName = target.name;
      cleanse(target, ctx.rng);
      lines.push(`The grey runs off ${oldName} like water. It remembers itself: ${target.name}.`);
      did = true;
      if (ctx.battle) ctx.battle.cleansedIds.add(target.id);
    } else if (!did) {
      lines.push('Nothing is clouding this one.');
    }
  }

  if (e.bond && target) {
    const gain = addBond(target, e.bond * (target.ashbound && e.ashbondBonus ? e.ashbondBonus : 1));
    lines.push(gain > 0 ? `${target.name} takes it from your hand. (+${gain} bond)` : `${target.name} is as close to you as it can get.`);
    did = true;
  }

  if (e.meal && target) {
    target.meal = { ...e.meal };
    lines.push(`${target.name} will fight better on a full stomach.`);
    did = true;
  }

  if (e.essence && target) {
    const stat = e.essence;
    if ((target.essence[stat] || 0) >= ESSENCE_CAP) {
      return { ok: false, why: `${target.name} cannot take any more of that.`, lines, consumed: false };
    }
    target.essence[stat] = clamp((target.essence[stat] || 0) + 1, 0, ESSENCE_CAP);
    clampPools(target);
    lines.push(`${target.name} grows into it. (essence ${stat.toUpperCase()} ${target.essence[stat]}/${ESSENCE_CAP})`);
    did = true;
  }

  // --- battle-scoped -----------------------------------------------------
  if (e.damage && ctx.battle && target) {
    const dealt = ctx.battle.itemDamage(target, e.damage, e.element, e.status, e.target === 'enemies');
    lines.push(...dealt);
    did = true;
  }
  if (e.flee && ctx.battle) { ctx.battle.forceFlee = true; lines.push('Smoke fills the hollow. You go.'); did = true; }
  if (e.surge && ctx.battle) { ctx.battle.addSurge(e.surge); lines.push('The air tightens. The brood feels it.'); did = true; }
  if (e.bindBoost && ctx.battle) { ctx.battle.bindBoost = Math.max(ctx.battle.bindBoost, e.bindBoost); lines.push('The powder settles on its scales. It will not slip so easily.'); did = true; }
  if (e.partyStatus && ctx.battle) {
    for (const c of ctx.battle.allies.filter(a => !a.fainted)) {
      ctx.battle.applyStatus(c, e.partyStatus.id, e.partyStatus.turns, 1);
    }
    lines.push('Your dragons answer the whistle.');
    did = true;
  }

  if (!did && !lines.length) return { ok: false, why: 'It would do nothing right now.', lines, consumed: false };
  for (const d of targets()) { clampPools(d); checkStage(d); }
  return { ok: true, lines, consumed: true };
}

/** Would this item do anything for this dragon? Used to grey out menu rows. */
export function itemUsable(itemId, target, ctx = {}) {
  const def = item(itemId);
  if (!def) return false;
  const e = def.effect || {};
  if (def.kind === 'key' || def.kind === 'material') return false;
  if (def.kind === 'relic') return !ctx.inBattle;
  if (def.kind === 'binding') return !!ctx.inBattle;
  if (e.flee || e.surge || e.bindBoost || e.partyStatus) return !!ctx.inBattle;
  if (e.damage) return !!ctx.inBattle;
  if (!target) return true;
  if (e.revive) return !!target.fainted;
  if (target.fainted) return false;
  const s = statsOf(target);
  if (e.heal || e.healPctMax) return target.hp < s.hp;
  if (e.mp || e.mpPctMax) return target.mp < s.mp;
  if (e.cure) return (target.statuses || []).some(st => e.cure.includes(st.id));
  if (e.cureAll) return (target.statuses || []).some(st => STATUSES[st.id]?.bad);
  if (e.cleanse) return !!target.ashbound;
  if (e.essence) return (target.essence[e.essence] || 0) < ESSENCE_CAP;
  return true;
}
