// ============================================================
// game/battle.js - the turn engine (GDD 6)
// Headless and deterministic given an RNG: no DOM, no timers, no audio.
// The UI calls resolveRound() and plays back the returned event list, so
// animation can never change what happened.
// ============================================================
import { RNG } from '../core/rand.js';
import { elementMultiplier, matchupLabel } from '../data/elements.js';
import { MOVES, move, surgeFor } from '../data/moves.js';
import { STATUSES, status as statusDef, bindStatusBonus } from '../data/statuses.js';
import { item } from '../data/items.js';
import { TRAITS } from '../data/traits.js';
import { statsOf, maxHp, traitValue, hasTrait, cleanse, clampPools } from '../gen/dragon.js';
import { DAMAGE, BIND, BOND, ECONOMY, XP, ENCOUNTER } from '../data/constants.js';
import { lineage } from '../data/lineages.js';
import { DROP_TABLE } from '../data/items.js';
import { clamp } from '../core/util.js';
import { applyItem } from './effects.js';

export const SIDE = { ALLY: 'ally', ENEMY: 'enemy' };

/** Nothing in this game should take sixty rounds; past that it is a stalemate. */
export const ROUND_LIMIT = 60;

/** Combat-only fields live on the dragon while a battle is running. */
function enterBattle(d, side) {
  d.side = side;
  d.statuses = [];
  d.buffs = {};
  d.guarding = false;
  d.endured = false;
  d.fainted = d.hp <= 0;
  d.participated = false;
  return d;
}

export function leaveBattle(d) {
  delete d.side; delete d.statuses; delete d.buffs;
  delete d.guarding; delete d.endured; delete d.participated;
  d.meal = null;
  return d;
}

export class Battle {
  /**
   * @param opts { allies, enemies, rng, wardenRank, bindBonus, context }
   * `allies` and `enemies` are live dragon objects; the battle mutates them.
   */
  constructor(opts) {
    this.allies = opts.allies.map(d => enterBattle(d, SIDE.ALLY));
    this.enemies = opts.enemies.map(d => enterBattle(d, SIDE.ENEMY));
    this.rng = opts.rng || new RNG(1, 2, 3, 4);
    this.wardenRank = opts.wardenRank || 0;
    this.context = opts.context || {};
    this.round = 0;
    this.surge = 0;                 // 0-100, shared party meter
    this.commands = new Map();      // dragonId -> command
    this.wardenCommand = null;      // one Warden action per round (item / bind)
    this.state = 'input';
    this.log = [];
    this.events = [];
    this.forceFlee = false;
    this.bindBoost = 1;
    this.cleansedIds = new Set();
    this.captured = null;
    this.bossPhase = 0;
    this.rewards = null;
  }

  // ------------------------------------------------------------- helpers --
  get combatants() { return [...this.allies, ...this.enemies]; }
  living(side) { return (side === SIDE.ALLY ? this.allies : this.enemies).filter(c => !c.fainted); }
  byId(id) { return this.combatants.find(c => c.id === id) || null; }
  get wild() { return !!this.context.wild; }

  event(e) { this.events.push(e); return e; }
  say(text, kind = 'log') { this.event({ type: 'log', kind, text }); this.log.push(text); }

  /** A stat after gear, meal, statuses, buffs and traits. */
  effStat(c, stat) {
    let v = statsOf(c)[stat];
    for (const s of c.statuses || []) {
      const def = STATUSES[s.id];
      if (def && def.mods && def.mods[stat]) v *= def.mods[stat];
    }
    const buff = c.buffs && c.buffs[stat];
    if (buff && buff.turns > 0) v *= buff.mult;
    return Math.max(1, Math.round(v));
  }

  hasStatus(c, id) { return (c.statuses || []).some(s => s.id === id); }

  applyStatus(c, id, turns, chance = 1, source = null) {
    const def = STATUSES[id];
    if (!def || c.fainted) return false;
    // Traits and relics can refuse a status outright, or halve the odds.
    for (const t of (c.traits || [])) {
      if (TRAITS[t] && TRAITS[t].resist && TRAITS[t].resist.includes(id)) {
        if (chance >= 1) this.say(`${c.name} shrugs it off.`);
        return false;
      }
    }
    const resist = traitValue(c, 'statusResist');
    if (def.bad && this.rng.next() > chance * resist) return false;

    let t = turns || def.turns;
    for (const tr of (c.traits || [])) if (TRAITS[tr] && TRAITS[tr].statusShorten) t = Math.max(1, t - TRAITS[tr].statusShorten);

    const existing = (c.statuses || []).find(s => s.id === id);
    if (existing) existing.turns = Math.max(existing.turns, t);
    else c.statuses.push({ id, turns: t, ramp: 0 });
    this.event({ type: 'status', target: c.id, status: id, name: def.name, bad: def.bad });
    this.say(`${c.name} ${def.onset || 'is ' + def.name.toLowerCase()}.`, def.bad ? 'bad' : 'good');
    return true;
  }

  addSurge(n) {
    this.surge = clamp(this.surge + n, 0, 100);
    this.event({ type: 'surge', value: this.surge });
  }

  // ---------------------------------------------------------- turn order --
  /** Priority first, then effective speed, with a small deterministic jitter. */
  turnOrder() {
    const alive = this.combatants.filter(c => !c.fainted);
    return alive.map(c => {
      const cmd = c.side === SIDE.ALLY ? this.commands.get(c.id) : c.aiCommand;
      const mv = cmd && cmd.moveId ? move(cmd.moveId) : null;
      const priority = (cmd && cmd.type === 'guard') ? 2 : (mv && mv.priority) || 0;
      return { c, key: priority * 10000 + this.effStat(c, 'spd') * 10 + this.rng.int(0, 9) };
    }).sort((a, b) => b.key - a.key).map(x => x.c);
  }

  /** What the UI shows in the queue strip before commands are locked in. */
  previewOrder() {
    return this.combatants.filter(c => !c.fainted)
      .map(c => ({ c, key: this.effStat(c, 'spd') }))
      .sort((a, b) => b.key - a.key).map(x => x.c);
  }

  // ------------------------------------------------------------- commands --
  setCommand(dragonId, cmd) {
    const c = this.byId(dragonId);
    if (!c || c.side !== SIDE.ALLY || c.fainted) return false;
    this.commands.set(dragonId, cmd);
    return true;
  }
  clearCommands() { this.commands.clear(); this.wardenCommand = null; }
  get commandsReady() {
    return this.living(SIDE.ALLY).every(c => this.commands.has(c.id));
  }

  /** Moves this dragon may pick right now, with the reason when it may not. */
  availableMoves(c) {
    const muzzled = this.hasStatus(c, 'muzzle');
    return (c.moves || []).map(id => {
      const m = move(id);
      const cost = this.mpCost(c, m);
      let why = null;
      if (m.mp > 0 && muzzled) why = 'Muzzled';
      else if (cost > c.mp) why = 'Not enough ley';
      return { move: m, cost, usable: !why, why };
    });
  }

  mpCost(c, m) {
    if (!m.mp) return 0;
    let cost = m.mp;
    for (const t of (c.traits || [])) {
      const tr = TRAITS[t];
      if (!tr) continue;
      if (tr.mpDiscount && m.element && tr.mpDiscount[m.element]) cost -= tr.mpDiscount[m.element];
      if (tr.mpDiscountAll) cost = Math.ceil(cost * tr.mpDiscountAll);
    }
    return Math.max(1, cost);
  }

  // ---------------------------------------------------------------- round --
  /** Resolve one full round. Returns the event list for playback. */
  resolveRound() {
    if (this.state !== 'input') return [];
    this.events = [];
    this.state = 'resolving';
    this.round++;
    this.event({ type: 'round', round: this.round });

    for (const e of this.enemies) if (!e.fainted) e.aiCommand = this.chooseAI(e);

    // The Warden acts before the brood: bindings and items are reactions.
    if (this.wardenCommand) this.runWardenCommand(this.wardenCommand);

    if (this.state === 'resolving') {
      for (const c of this.turnOrder()) {
        if (this.state !== 'resolving') break;
        if (c.fainted) continue;
        this.takeTurn(c);
      }
    }

    if (this.state === 'resolving') {
      this.endOfRound();
      this.checkEnd();
    }
    // A fight neither side can finish is a bug, not a feature: end it rather
    // than let the UI spin forever waiting for a victor.
    if (this.state === 'resolving' && this.round >= ROUND_LIMIT) {
      this.say('Neither of you can keep this up. You break off, spent.');
      this.state = 'fled';
      this.event({ type: 'fled', stalemate: true });
      this.finish();
    }
    if (this.state === 'resolving') this.state = 'input';
    this.clearCommands();
    return this.events;
  }

  takeTurn(c) {
    c.guarding = false;
    if (this.hasStatus(c, 'stun')) {
      this.say(`${c.name} cannot move.`);
      this.event({ type: 'skipped', actor: c.id });
      return;
    }
    if (this.hasStatus(c, 'fear') && this.rng.chance(STATUSES.fear.flinch)) {
      this.say(`${c.name} will not come forward.`);
      this.event({ type: 'skipped', actor: c.id });
      return;
    }
    const cmd = c.side === SIDE.ALLY ? this.commands.get(c.id) : c.aiCommand;
    if (!cmd) return;
    c.participated = true;

    switch (cmd.type) {
      case 'guard': return this.doGuard(c);
      case 'surge': return this.doSurge(c, cmd);
      case 'flee': return this.doFlee(c);
      case 'skill':
      case 'strike': return this.doMove(c, cmd);
      default: return this.doMove(c, { ...cmd, type: 'strike', moveId: cmd.moveId || c.moves[0] });
    }
  }

  doGuard(c) {
    c.guarding = true;
    this.say(`${c.name} braces.`);
    this.event({ type: 'guard', actor: c.id });
    const s = statsOf(c);
    c.mp = Math.min(s.mp, c.mp + Math.ceil(s.mp * 0.08));
    const heal = traitValue(c, 'guardHeal', (a, b) => a + b, 0);
    if (heal > 0) {
      c.hp = Math.min(s.hp, c.hp + Math.round(s.hp * heal));
      this.event({ type: 'heal', target: c.id, amount: Math.round(s.hp * heal) });
    }
    if (c.side === SIDE.ALLY) this.addSurge(DAMAGE.surgeGuard);
  }

  doFlee(c) {
    if (this.context.boss) { this.say('There is nowhere to go.'); return; }
    const partySpd = this.living(SIDE.ALLY).reduce((n, a) => n + this.effStat(a, 'spd'), 0) / Math.max(1, this.living(SIDE.ALLY).length);
    const foeSpd = this.living(SIDE.ENEMY).reduce((n, a) => n + this.effStat(a, 'spd'), 0) / Math.max(1, this.living(SIDE.ENEMY).length);
    let chance = ENCOUNTER.fleeBase + (partySpd - foeSpd) / (partySpd + foeSpd) * 0.4;
    chance += traitValue(c, 'fleeBonus', (a, b) => a + b, 0);
    if (this.rng.chance(clamp(chance, 0.15, 0.95))) {
      this.say('You break off and go.');
      this.state = 'fled';
      this.event({ type: 'fled' });
    } else {
      this.say(`${c.name} tries to break away, and does not.`);
    }
  }

  doSurge(c, cmd) {
    if (this.surge < 100) { this.say('The surge is not ready.'); return; }
    const s = surgeFor(c.lineageId, c.stage);
    this.surge = 0;
    this.event({ type: 'surgeCast', actor: c.id, name: s.name, element: s.element });
    this.say(`${c.name}: ${s.name}!`, 'surge');
    const targets = s.target === 'all' ? this.living(this.other(c.side)) : [this.pickTarget(c, cmd.targetId)].filter(Boolean);
    for (const t of targets) this.strike(c, t, { ...s, kind: 'magic', acc: 100, power: s.power }, { surge: true });
    if (s.healPctMax) for (const a of this.living(c.side)) {
      const heal = Math.round(maxHp(a) * s.healPctMax);
      a.hp = Math.min(maxHp(a), a.hp + heal);
      this.event({ type: 'heal', target: a.id, amount: heal });
    }
    if (s.status) for (const t of targets) this.applyStatus(t, s.status.id, s.status.turns, s.status.chance);
  }

  other(side) { return side === SIDE.ALLY ? SIDE.ENEMY : SIDE.ALLY; }

  pickTarget(actor, wantedId) {
    const foes = this.living(this.other(actor.side));
    if (!foes.length) return null;
    const wanted = foes.find(f => f.id === wantedId);
    return wanted || foes[Math.floor(this.rng.next() * foes.length)];
  }

  doMove(c, cmd) {
    const m = move(cmd.moveId || c.moves[0]);
    const cost = this.mpCost(c, m);
    if (m.mp > 0 && (c.mp < cost || this.hasStatus(c, 'muzzle'))) {
      this.say(`${c.name} cannot manage that, and claws instead.`);
      return this.doMove(c, { moveId: c.moves.find(id => !move(id).mp) || 'strike_claw', targetId: cmd.targetId });
    }
    c.mp = Math.max(0, c.mp - cost);
    this.event({ type: 'cast', actor: c.id, move: m.id, name: m.name, element: m.element, kind: m.kind });

    if (m.kind === 'support') return this.doSupport(c, m, cmd);

    const targets = m.target === 'all'
      ? this.living(this.other(c.side))
      : [this.pickTarget(c, cmd.targetId)].filter(Boolean);
    if (!targets.length) { this.say('There is nothing left to hit.'); return; }
    this.say(`${c.name} uses ${m.name}.`);
    for (const t of targets) this.strike(c, t, m);
  }

  doSupport(c, m, cmd) {
    this.say(`${c.name} uses ${m.name}.`);
    let targets;
    if (m.target === 'allies') targets = this.living(c.side);
    else if (m.target === 'ally') {
      const wanted = this.living(c.side).find(a => a.id === cmd.targetId);
      targets = [wanted || this.weakest(this.living(c.side))];
    } else if (m.target === 'one') targets = [this.pickTarget(c, cmd.targetId)].filter(Boolean);
    else targets = [c];

    for (const t of targets) {
      if (!t) continue;
      if (m.healPctMax) {
        const amount = Math.round(maxHp(t) * m.healPctMax * (1 + this.effStat(c, 'mag') / 200));
        t.hp = Math.min(maxHp(t), t.hp + amount);
        this.event({ type: 'heal', target: t.id, amount });
        this.say(`${t.name} recovers ${amount} health.`, 'good');
      }
      if (m.cureAll) {
        t.statuses = (t.statuses || []).filter(s => !STATUSES[s.id]?.bad);
        this.say(`${t.name} is clear.`, 'good');
      }
      if (m.cleanse && t.ashbound) {
        const old = t.name;
        cleanse(t, this.rng);
        this.cleansedIds.add(t.id);
        this.say(`${old} hears its own name. The grey falls off it: ${t.name}.`, 'surge');
        this.event({ type: 'cleansed', target: t.id, name: t.name });
      }
      if (m.buff) {
        t.buffs[m.buff.stat] = { mult: m.buff.amount, turns: m.buff.turns };
        this.event({ type: 'buff', target: t.id, stat: m.buff.stat });
        this.say(`${t.name}'s ${m.buff.stat.toUpperCase()} rises.`, 'good');
      }
      if (m.status) {
        const hit = m.acc >= 100 || this.rng.chance(this.accuracy(c, t, m));
        if (hit) this.applyStatus(t, m.status.id, m.status.turns, m.status.chance);
        else this.say(`It washes over ${t.name} and does nothing.`);
      }
    }
  }

  weakest(list) {
    return list.slice().sort((a, b) => (a.hp / maxHp(a)) - (b.hp / maxHp(b)))[0] || null;
  }

  accuracy(attacker, target, m) {
    const base = (m.acc ?? 95) / 100;
    const evade = traitValue(target, 'evade', (a, b) => a + b, 0);
    const spdRatio = this.effStat(attacker, 'spd') / Math.max(1, this.effStat(target, 'spd'));
    return clamp(base * (0.92 + 0.08 * clamp(spdRatio, 0.5, 2)) - evade, 0.35, 0.99);
  }

  /** The damage formula (GDD 6.2), and the only place it is written down. */
  computeDamage(attacker, target, m, opts = {}) {
    const physical = m.kind !== 'magic';
    const atk = this.effStat(attacker, physical ? 'atk' : 'mag');
    const defStat = this.effStat(target, physical ? 'def' : 'res');
    const power = m.power || 40;
    let base = (atk * 2 + attacker.level) * (power / 100) * (1 - defStat / (defStat + DAMAGE.defConstant));

    const elem = m.element ? elementMultiplier(m.element, target.elements) : 1;
    let mult = elem;

    // Same-element bonus, the RPG staple: a fire dragon's fire hits harder.
    if (m.element && attacker.elements.includes(m.element)) mult *= DAMAGE.stab;
    // Bond: a dragon that trusts you fights harder for you.
    mult *= 1 + (attacker.bond || 0) / DAMAGE.bondDivisor;
    // Relic element boosts and the "healthy" trait band.
    const boost = traitValue(attacker, 'elementBoost');
    if (typeof boost === 'object' && m.element && boost[m.element]) mult *= boost[m.element];
    for (const slot of ['harness', 'relic']) {
      const g = attacker.equip && attacker.equip[slot];
      if (g && g.elementBoost && m.element && g.elementBoost[m.element]) mult *= g.elementBoost[m.element];
    }
    if (hasTrait(attacker, 'brightscale') && attacker.hp > maxHp(attacker) / 2) mult *= 1.10;
    // Target-side reductions.
    for (const t of (target.traits || [])) {
      const tr = TRAITS[t];
      if (tr && tr.elementResist && m.element && tr.elementResist[m.element]) mult *= tr.elementResist[m.element];
    }
    for (const slot of ['harness', 'relic']) {
      const g = target.equip && target.equip[slot];
      if (g && g.elementResist && m.element && g.elementResist[m.element]) mult *= g.elementResist[m.element];
    }
    if (this.hasStatus(target, 'soak') && m.element === 'storm') mult *= STATUSES.soak.vuln.storm;
    if (this.hasStatus(target, 'barrier')) mult *= STATUSES.barrier.damageTaken;
    if (target.guarding) mult *= DAMAGE.guardMult;

    // Crit.
    let critChance = DAMAGE.critChance + this.effStat(attacker, 'spd') / DAMAGE.critSpdDivisor + (m.critBonus || 0);
    const traitCrit = traitValue(attacker, 'critBonus', (a, b) => a + (typeof b === 'object' ? (b.all || (m.element && b[m.element]) || 0) : b), 0) - 1;
    critChance += Math.max(0, traitCrit);
    if (hasTrait(target, 'thickscale') && physical) critChance *= TRAITS.thickscale.critResist;
    const crit = !opts.noCrit && this.rng.chance(clamp(critChance, 0, 0.6));
    if (crit) mult *= DAMAGE.critMult * traitValue(attacker, 'critMult');

    const variance = this.rng.float(DAMAGE.variance[0], DAMAGE.variance[1]);
    const amount = Math.max(1, Math.round(base * mult * variance));
    return { amount, crit, elem, absorbed: false };
  }

  /** One attack landing (or not) on one target. */
  strike(attacker, target, m, opts = {}) {
    if (target.fainted) return;
    if (!opts.surge && !this.rng.chance(this.accuracy(attacker, target, m))) {
      this.say(`${m.name} misses ${target.name}.`);
      this.event({ type: 'miss', actor: attacker.id, target: target.id });
      return;
    }

    // Forgeheart-style absorption: the element that should hurt, heals.
    const absorbs = (target.traits || []).some(t => TRAITS[t] && TRAITS[t].absorb === m.element);
    if (absorbs && m.element) {
      const heal = Math.round(maxHp(target) * 0.05);
      target.hp = Math.min(maxHp(target), target.hp + heal);
      this.say(`${target.name} drinks the ${m.element} in. (+${heal})`, 'good');
      this.event({ type: 'heal', target: target.id, amount: heal });
      return;
    }

    const { amount, crit, elem } = this.computeDamage(attacker, target, m, opts);
    this.damage(attacker, target, amount, { crit, elem, move: m });

    if (m.drain) {
      const heal = Math.round(amount * m.drain);
      attacker.hp = Math.min(maxHp(attacker), attacker.hp + heal);
      this.event({ type: 'heal', target: attacker.id, amount: heal });
      this.say(`${attacker.name} takes ${heal} back.`, 'good');
    }
    if (m.recoil) {
      const hurt = Math.round(amount * m.recoil);
      this.damage(attacker, attacker, hurt, { self: true });
      this.say(`${attacker.name} is scorched by its own fire.`);
    }
    if (m.mpBurn) {
      target.mp = Math.max(0, target.mp - m.mpBurn);
      this.event({ type: 'mp', target: target.id, amount: -m.mpBurn });
    }
    if (m.status && !target.fainted) this.applyStatus(target, m.status.id, m.status.turns, m.status.chance);
  }

  /** Apply raw damage, handle Bedrock, and emit everything the UI needs. */
  damage(attacker, target, amount, meta = {}) {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);

    if (target.hp === 0 && hasTrait(target, 'bedrock') && !target.endured) {
      target.endured = true;
      target.hp = 1;
      this.say(`${target.name} refuses to go down.`, 'good');
    }

    const label = meta.elem !== undefined ? matchupLabel(meta.elem) : null;
    this.event({
      type: 'damage', actor: attacker ? attacker.id : null, target: target.id,
      amount: before - target.hp, crit: !!meta.crit, element: meta.move ? meta.move.element : null,
      matchup: label ? label.cls : null, hp: target.hp, maxHp: maxHp(target),
    });
    let line = `${target.name} takes ${before - target.hp}.`;
    if (meta.crit) line += ' A clean hit!';
    if (label) line += ` ${label.text === 'SUNDERED' ? 'Sundered!' : label.text === 'strong' ? 'It bites deep.' : label.text === 'shrugged off' ? 'It barely notices.' : 'It hardly lands.'}`;
    this.say(line, meta.crit ? 'crit' : 'hit');

    // Surge meter moves on damage in both directions.
    const pct = (before - target.hp) / Math.max(1, maxHp(target));
    if (attacker && attacker.side === SIDE.ALLY && target.side === SIDE.ENEMY) {
      this.addSurge(pct * 100 * DAMAGE.surgePerDamage * traitValue(attacker, 'surgeBonus', (a, b) => a + b, 1));
    } else if (target.side === SIDE.ALLY) {
      this.addSurge(pct * 100 * DAMAGE.surgePerTaken);
    }

    if (target.hp <= 0) this.faint(target);
  }

  faint(c) {
    c.fainted = true;
    c.statuses = [];
    c.buffs = {};
    this.event({ type: 'faint', target: c.id, side: c.side });
    this.say(c.side === SIDE.ALLY ? `${c.name} goes down.` : `${c.name} drops.`, c.side === SIDE.ALLY ? 'bad' : 'good');
  }

  /** Damage from a thrown item; returns log lines for the effects module. */
  itemDamage(target, power, element, statusSpec, allEnemies) {
    const lines = [];
    const targets = allEnemies ? this.living(SIDE.ENEMY) : [target];
    for (const t of targets) {
      if (!t || t.fainted) continue;
      const elem = element ? elementMultiplier(element, t.elements) : 1;
      const amount = Math.max(1, Math.round(power * elem * this.rng.float(0.9, 1.1)));
      this.damage(null, t, amount, { elem, move: { element } });
      lines.push(`${t.name} takes ${amount}.`);
      if (statusSpec && !t.fainted) this.applyStatus(t, statusSpec.id, statusSpec.turns, statusSpec.chance);
    }
    return lines;
  }

  // ------------------------------------------------------------- warden --
  setWardenCommand(cmd) { this.wardenCommand = cmd; }

  /**
   * The Warden's one action per round. Items resolve here rather than in the
   * UI, so a headless simulation plays exactly the same battle a person does.
   * The caller is responsible for removing the item from the inventory when
   * `consumed` comes back true.
   */
  runWardenCommand(cmd) {
    if (cmd.type === 'bind') return this.attemptBind(cmd.targetId, cmd.itemId);
    if (cmd.type !== 'item') return null;
    const target = this.byId(cmd.targetId);
    const res = applyItem(cmd.itemId, target, {
      battle: this, rng: this.rng, party: this.allies, inBattle: true,
    });
    this.event({ type: 'wardenItem', itemId: cmd.itemId, targetId: cmd.targetId, ok: res.ok });
    for (const line of res.lines) this.say(line, 'good');
    if (!res.ok && res.why) this.say(res.why);
    this.checkEnd();
    return res;
  }

  /** Binding odds (GDD 7). Returned as data so the UI can show the estimate. */
  bindChance(target, bindingId) {
    const def = item(bindingId);
    if (!def || !def.effect || !def.effect.bind) return 0;
    if (!this.wild) return 0;
    if (target.boss && !def.effect.elder) return 0;
    const hpTerm = Math.pow(1 - target.hp / maxHp(target), BIND.hpExponent);
    const statusTerm = bindStatusBonus(target.statuses);
    if (statusTerm === 0) return 0;                       // Ashen blocks it
    const levelTerm = clamp(1 + (this.avgPartyLevel() - target.level) * BIND.levelSpread / 10, 0.5, 1.6);
    const rarity = BIND.rarityFactor[lineage(target.lineageId).rarity] ?? 1;
    const ash = target.ashbound ? BIND.ashboundPenalty : 1;
    const night = (def.effect.nightMult && this.context.underground) ? def.effect.nightMult : 1;
    const rank = 1 + this.wardenRank * BIND.rankBonus;
    const gear = this.living(SIDE.ALLY).reduce((m, a) => Math.max(m, traitValue(a, 'bindBonus')), 1);
    const raw = def.effect.bind * 0.42 * (0.12 + hpTerm) * statusTerm * levelTerm * rarity * ash * night * rank * this.bindBoost * gear;
    return clamp(raw, BIND.floor, BIND.ceiling);
  }

  avgPartyLevel() {
    const list = this.allies;
    return list.length ? list.reduce((n, a) => n + a.level, 0) / list.length : 1;
  }

  attemptBind(targetId, bindingId) {
    const target = this.byId(targetId) || this.living(SIDE.ENEMY)[0];
    if (!target || target.fainted) { this.say('There is nothing there to bind.'); return false; }
    if (!this.wild) { this.say('This one is not yours to take.'); return false; }
    const chance = this.bindChance(target, bindingId);
    this.event({ type: 'bindThrow', target: target.id, itemId: bindingId, chance });
    this.say(`You throw the ${item(bindingId).name.toLowerCase()}.`);
    if (chance <= 0) {
      this.say(this.hasStatus(target, 'ashen')
        ? `${target.name} is too far into the ash to hold.`
        : 'It will not hold this one.');
      return false;
    }
    if (this.rng.chance(chance)) {
      this.captured = target;
      target.fainted = true;
      target.statuses = [];
      this.event({ type: 'bound', target: target.id, name: target.name });
      this.say(`${target.name} stops fighting. It is yours to keep, and to feed.`, 'surge');
      this.checkEnd();
      return true;
    }
    this.say(`${target.name} tears free.`, 'bad');
    this.event({ type: 'bindFail', target: target.id });
    return false;
  }

  // ---------------------------------------------------------- end of round --
  endOfRound() {
    for (const c of this.combatants) {
      if (c.fainted) continue;
      // status ticks
      for (const s of [...(c.statuses || [])]) {
        const def = STATUSES[s.id];
        if (!def) continue;
        if (def.tick) {
          if (def.tick.dmgPctMax) {
            const amount = Math.max(1, Math.round(maxHp(c) * (def.tick.dmgPctMax + (s.ramp || 0))));
            this.damage(null, c, amount, {});
            this.say(`${c.name} suffers from ${def.name.toLowerCase()}. (${amount})`);
            if (def.tick.ramp) s.ramp = (s.ramp || 0) + def.tick.ramp;
          }
          if (def.tick.healPctMax && !c.fainted) {
            const amount = Math.round(maxHp(c) * def.tick.healPctMax);
            c.hp = Math.min(maxHp(c), c.hp + amount);
            this.event({ type: 'heal', target: c.id, amount });
          }
        }
        if (def.mpDrain) c.mp = Math.max(0, c.mp - def.mpDrain);
        s.turns--;
        if (s.turns <= 0) {
          c.statuses = c.statuses.filter(x => x !== s);
          this.event({ type: 'statusEnd', target: c.id, status: s.id });
        }
      }
      // trait regeneration
      if (!c.fainted) {
        const regen = traitValue(c, 'regenPct', (a, b) => a + b, 0);
        if (regen > 0) {
          const amount = Math.round(maxHp(c) * regen);
          c.hp = Math.min(maxHp(c), c.hp + amount);
          this.event({ type: 'heal', target: c.id, amount });
        }
        const mpRegen = traitValue(c, 'mpRegen', (a, b) => a + b, 0);
        if (mpRegen > 0) c.mp = Math.min(statsOf(c).mp, c.mp + mpRegen);
      }
      // buff timers
      for (const [stat, buff] of Object.entries(c.buffs || {})) {
        buff.turns--;
        if (buff.turns <= 0) delete c.buffs[stat];
      }
    }
    if (this.forceFlee) { this.state = 'fled'; this.event({ type: 'fled' }); }
  }

  checkEnd() {
    if (this.captured) { this.state = 'captured'; this.finish(); return; }
    if (!this.living(SIDE.ENEMY).length) { this.state = 'won'; this.finish(); return; }
    if (!this.living(SIDE.ALLY).length) { this.state = 'lost'; this.finish(); return; }
  }

  /** Rewards are computed once, here, so the UI cannot double-count them. */
  finish() {
    if (this.rewards) return this.rewards;
    const won = this.state === 'won' || this.state === 'captured';
    const defeated = this.enemies.filter(e => e.fainted && e !== this.captured);
    let xp = 0, coin = 0;
    const drops = [];
    if (won) {
      for (const e of defeated) {
        xp += XP.fromKill(e.level, 40 + lineage(e.lineageId).rarity * 12) * (e.boss ? 4 : 1);
        coin += Math.round(e.level * ECONOMY.coinPerLevel * (e.boss ? ECONOMY.bossCoinMult : 1) * this.rng.float(0.85, 1.15));
        const table = DROP_TABLE[lineage(e.lineageId).rarity] || DROP_TABLE[1];
        if (this.rng.chance(e.boss ? 1 : 0.55)) drops.push(this.rng.pick(table));
        if (e.boss) drops.push(this.rng.pick(DROP_TABLE[4]));
      }
      for (const a of this.allies) if (hasTrait(a, 'scavenger') && !a.fainted) drops.push(this.rng.pick(DROP_TABLE[2]));
    }
    this.rewards = {
      won, state: this.state, xp, coin, drops,
      captured: this.captured || null,
      participants: this.allies.filter(a => a.participated),
      rounds: this.round,
    };
    this.event({ type: 'end', state: this.state, rewards: this.rewards });
    return this.rewards;
  }

  // ------------------------------------------------------------------ AI --
  /**
   * Enemy decisions: weighted, condition-gated, and legible. Bosses run a
   * phase script with a telegraphed wind-up, so a big hit is answerable.
   */
  chooseAI(e) {
    const foes = this.living(SIDE.ALLY);
    if (!foes.length) return { type: 'guard' };

    // Boss phases: a wind-up turn, then the signature, on HP thresholds.
    if (e.boss) {
      const hpPct = e.hp / maxHp(e);
      const phase = hpPct < 0.3 ? 2 : hpPct < 0.65 ? 1 : 0;
      if (phase > this.bossPhase) {
        this.bossPhase = phase;
        e.windup = true;
        const big = (e.moves || []).map(move).find(m => m.boss && m.windup);
        if (big) {
          this.say(big.windup, 'boss');
          this.event({ type: 'windup', actor: e.id, move: big.id });
          return { type: 'guard' };
        }
      }
      if (e.windup) {
        e.windup = false;
        const big = (e.moves || []).map(move).find(m => m.boss);
        if (big) return { type: 'skill', moveId: big.id, targetId: this.weakest(foes).id };
      }
    }

    const usable = (e.moves || []).map(move).filter(m => this.mpCost(e, m) <= e.mp && !(m.mp > 0 && this.hasStatus(e, 'muzzle')));
    if (!usable.length) return { type: 'strike', moveId: e.moves[0] || 'strike_claw', targetId: this.pickAITarget(e, foes).id };

    const scored = usable.map(m => {
      let w = 10;
      if (m.kind === 'support') {
        const hurt = this.living(SIDE.ENEMY).some(a => a.hp < maxHp(a) * 0.45);
        // Healing at full health is what turns a boss into a wall, so it is
        // only ever worth considering once somebody is actually hurt.
        w = m.healPctMax ? (hurt ? 40 : 3) : m.buff ? 14 : 12;
        if (m.status && m.status.id && this.hasStatus(foes[0], m.status.id)) w = 3;
      } else {
        // Favour what the party is actually weak to.
        const best = Math.max(...foes.map(f => m.element ? elementMultiplier(m.element, f.elements) : 1));
        w = 10 * best + (m.power || 40) / 8;
        if (m.target === 'all' && foes.length > 1) w *= 1.3;
        if (this.round < 2 && (m.power || 0) > 90) w *= 0.5;    // save the big one
      }
      return { m, w: Math.max(1, w) };
    });

    const chosen = this.rng.weighted(scored.map(s => s.m), scored.map(s => s.w));
    const target = chosen.kind === 'support' && (chosen.healPctMax || chosen.buff)
      ? (this.weakest(this.living(SIDE.ENEMY)) || e)
      : this.pickAITarget(e, foes);
    return { type: chosen.mp > 0 ? 'skill' : 'strike', moveId: chosen.id, targetId: target.id };
  }

  /** Enemies favour a target they can actually hurt, then the weakest one. */
  pickAITarget(e, foes) {
    const scored = foes.map(f => {
      const best = Math.max(...(e.moves || ['strike_claw']).map(id => {
        const m = move(id);
        return m.element ? elementMultiplier(m.element, f.elements) : 1;
      }));
      const frailty = 1 - f.hp / maxHp(f);
      return { f, w: best * 2 + frailty * 1.5 + this.rng.float(0, 0.8) };
    });
    return scored.sort((a, b) => b.w - a.w)[0].f;
  }
}
