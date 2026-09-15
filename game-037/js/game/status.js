// ============================================================
// game/status.js - conditions (GDD §19)
// All statuses are visible, counted down, and nothing outlasts a full sleep.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { State, logLine } from './state.js';

export const STATUSES = Object.freeze({
  bleeding: { name: 'bleeding', icon: '•', dmg: 2, speed: -10, turns: 6, bad: true },
  burning: { name: 'burning', icon: '▲', dmg: 4, turns: 4, bad: true },
  chilled: { name: 'chilled', icon: '❄', energy: -30, turns: 10, bad: true },
  poisoned: { name: 'poisoned', icon: '☠', dmg: 1, noRegen: true, turns: 20, bad: true },
  dazed: { name: 'dazed', icon: '∅', noTools: true, turns: 3, bad: true },
  blinded: { name: 'blinded', icon: '●', fov: 1, missChance: 0.5, turns: 4, bad: true },
  slowed: { name: 'slowed', icon: '▼', speed: -40, turns: 8, bad: true },
  hasted: { name: 'hasted', icon: '▶', speed: 50, turns: 8, bad: false },
  warded: { name: 'warded', icon: '◇', nameResist: 0.5, turns: 20, bad: false },
  steadied: { name: 'steadied', icon: '■', armour: 2, noKnockback: true, turns: 15, bad: false },
  unnamed: { name: 'unnamed', icon: '—', hideLabels: true, turns: 40, bad: true },
  heartened: { name: 'heartened', icon: '♥', regen: 6, dmgMult: 1.1, turns: 60, bad: false },
  hungry: { name: 'hungry', icon: '○', noRegen: true, body: -1, turns: 9999, bad: true },
  starving: { name: 'starving', icon: '●', body: -2, speed: -20, slowDmg: 20, turns: 9999, bad: true },
  encumbered: { name: 'encumbered', icon: '▣', moveEnergy: 40, evasionZero: true, turns: 9999, bad: true },
  wakesick: { name: 'wake-sick', icon: '☁', vigorLoss: 1, turns: 9999, bad: true },
});

export function addStatus(actor, key, turns, magnitude = 1, source = null) {
  const def = STATUSES[key];
  if (!def) return;
  const existing = actor.statuses.find(s => s.key === key);
  const t = turns ?? def.turns;
  if (existing) { existing.turns = Math.max(existing.turns, t); return; }
  actor.statuses.push({ key, turns: t, magnitude, source });
  bus.emit(EV.ACTOR_STATUS, { id: actor.id, key, turns: t, added: true });
  if (actor.isPlayer && def.bad) logLine(statusLine(key, true), 'bad');
  else if (actor.isPlayer) logLine(statusLine(key, true), 'good');
}

export function removeStatus(actor, key) {
  const i = actor.statuses.findIndex(s => s.key === key);
  if (i < 0) return false;
  actor.statuses.splice(i, 1);
  bus.emit(EV.ACTOR_STATUS, { id: actor.id, key, turns: 0, added: false });
  if (actor.isPlayer) logLine(statusLine(key, false), 'plain');
  return true;
}

export const hasStatus = (actor, key) => actor.statuses.some(s => s.key === key);

/** Sum a numeric field across an actor's statuses. */
export function statusSum(actor, field) {
  let n = 0;
  for (const s of actor.statuses) {
    const def = STATUSES[s.key];
    if (def && typeof def[field] === 'number') n += def[field];
  }
  return n;
}

export function statusFlag(actor, field) {
  return actor.statuses.some(s => STATUSES[s.key] && STATUSES[s.key][field]);
}

/** Tick at the start of the affected actor's turn. Returns damage taken. */
export function tickStatuses(actor, damageFn) {
  let dmg = 0;
  const shorten = 1 + (actor.mods ? (actor.mods.statusShorten || 0) : 0);
  for (let i = actor.statuses.length - 1; i >= 0; i--) {
    const s = actor.statuses[i];
    const def = STATUSES[s.key];
    if (!def) { actor.statuses.splice(i, 1); continue; }
    if (def.dmg) dmg += def.dmg;
    if (def.slowDmg && State.tick % def.slowDmg === 0) dmg += 1;
    if (def.regen && State.tick % def.regen === 0 && actor.hp < actor.maxHp) actor.hp++;
    if (s.turns < 9000) {
      s.turns -= shorten;
      if (s.turns <= 0) {
        actor.statuses.splice(i, 1);
        bus.emit(EV.ACTOR_STATUS, { id: actor.id, key: s.key, turns: 0, added: false });
        if (actor.isPlayer) logLine(statusLine(s.key, false), 'plain');
      }
    }
  }
  if (dmg > 0 && damageFn) damageFn(actor, dmg);
  return dmg;
}

/** Cure a list of statuses, returning how many actually lifted. */
export function cure(actor, keys) {
  let n = 0;
  for (const k of keys || []) if (removeStatus(actor, k)) n++;
  return n;
}

function statusLine(key, added) {
  const lines = {
    bleeding: ['You are bleeding.', 'The bleeding stops.'],
    burning: ['You are alight.', 'The fire is out.'],
    chilled: ['The cold gets into you.', 'You are warm again.'],
    poisoned: ['Something is wrong with your blood.', 'Your blood settles.'],
    dazed: ['Your hands will not do what you tell them.', 'Your hands come back.'],
    blinded: ['You cannot see.', 'Your sight comes back.'],
    slowed: ['Everything takes longer.', 'You move properly again.'],
    hasted: ['You are quick.', 'The quickness goes.'],
    warded: ['Your name sits firmly where it is.', 'The ward fades.'],
    steadied: ['You are hard to move.', 'You loosen up.'],
    unnamed: ['You cannot hold on to what things are called.', 'The names come back.'],
    heartened: ['You feel looked after.', 'That good feeling wears off.'],
    hungry: ['You are hungry.', 'You are not hungry any more.'],
    starving: ['You are starving.', 'You are only hungry now.'],
    encumbered: ['You are carrying too much.', 'That is better.'],
    wakesick: ['You are not all the way back yet.', 'You are yourself again.'],
  };
  const pair = lines[key] || [key, key + ' ends'];
  return added ? pair[0] : pair[1];
}
