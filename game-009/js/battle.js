/**
 * battle.js — Turn management, action resolution, damage formula.
 *
 * Flow:
 *   initBattle(k)           — call once in 'game' scene setup
 *   events.emit('battleStart', enemies[]) — kicks off a battle
 *
 * Internal state machine:
 *   'idle'      → waiting for battleStart
 *   'player'    → waiting for commandMenu to emit 'actionChosen'
 *   'enemy'     → enemy AI turn in progress
 *   'resolving' → damage/effect animation playing
 *   'victory'   → all enemies dead, waiting for player to continue
 *   'defeat'    → whole party KO'd
 */

import { events }   from './events.js';
import { state }    from './state.js';
import { ABILITY_DEFS, ENEMY_DEFS, ENCOUNTERS, SHOP_ITEMS } from './config.js';
import { refreshStatus, showVictoryScreen } from './ui.js';
import {
    playPhysicalHit, playMagicCast, playFireSpell, playIceSpell,
    playEnemyAttack, playEnemyMagic, playDamageHit, playPartyKO,
    playEnemyDeath, playVictoryFanfare, playBattleStart, playItemUse,
    playHeal,
} from './sounds.js';

// ----------------------------------------------------------------
// Module-level refs
// ----------------------------------------------------------------

let _k = null;
let _phase = 'idle';   // current battle phase

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

export function initBattle(kaplay) {
    _k = kaplay;
    _phase = 'idle';

    const off1 = events.on('battleStart',  _onBattleStart);
    const off2 = events.on('actionChosen', _onActionChosen);
    const off3 = events.on('battleEnd',    _onBattleEnd);

    _k.onSceneLeave(() => { off1(); off2(); off3(); });
}

// ----------------------------------------------------------------
// Battle end (flee)
// ----------------------------------------------------------------

function _onBattleEnd(result) {
    if (result !== 'flee') return;
    _phase = 'idle';
    state.inBattle = false;
    // Brief pause then advance to next encounter (no XP/gold for fleeing)
    _k.wait(0.6, _advanceEncounter);
}

// ----------------------------------------------------------------
// Battle start
// ----------------------------------------------------------------

function _onBattleStart(enemyDefs) {
    if (_phase !== 'idle') return;

    playBattleStart();

    // Build enemy combatant objects
    state.enemies = enemyDefs.map((def, i) => ({
        ...def,
        id:      `enemy_${i}`,
        maxHp:   def.hp,
        isKO:    false,
        statusEffects: [],
        buffs:   {},
        isEnemy: true,
        slotIndex: i,
    }));

    // Sort turn order: party + enemies by SPD descending
    state.turnOrder = _buildTurnOrder();
    state.currentActorIndex = 0;
    state.inBattle = true;

    // Emit after state.enemies is fully built so the renderer can draw them
    events.emit('battleReady', state.enemies);

    events.emit('showMessage', 'Battle begins!');

    _k.wait(0.8, _nextTurn);
}

function _buildTurnOrder() {
    const party   = state.party.filter(m => !m.isKO);
    const enemies = state.enemies.filter(e => !e.isKO);
    return [...party, ...enemies].sort((a, b) => b.spd - a.spd);
}

// ----------------------------------------------------------------
// Turn loop
// ----------------------------------------------------------------

function _nextTurn() {
    // Skip any dead combatants (may have died during prior turn)
    while (
        state.currentActorIndex < state.turnOrder.length &&
        state.turnOrder[state.currentActorIndex].isKO
    ) {
        state.currentActorIndex++;
    }

    // All combatants have acted → new round
    if (state.currentActorIndex >= state.turnOrder.length) {
        _tickStatusEffects();
        state.turnOrder = _buildTurnOrder();
        state.currentActorIndex = 0;
    }

    // Re-check for dead combatants after rebuilding order
    while (
        state.currentActorIndex < state.turnOrder.length &&
        state.turnOrder[state.currentActorIndex].isKO
    ) {
        state.currentActorIndex++;
    }

    if (state.currentActorIndex >= state.turnOrder.length) {
        // Shouldn't happen but guard anyway
        _k.wait(0.3, _nextTurn);
        return;
    }

    const actor = state.turnOrder[state.currentActorIndex];

    if (actor.isEnemy) {
        _phase = 'enemy';
        _k.wait(0.6, () => _doEnemyTurn(actor));
    } else {
        _phase = 'player';
        events.emit('turnStart', actor);
    }
}

// ----------------------------------------------------------------
// Player action (received from commandMenu)
// ----------------------------------------------------------------

function _onActionChosen(actor, action) {
    if (_phase !== 'player') return;
    _phase = 'resolving';

    _resolveAction(actor, action, () => {
        if (_checkVictory()) return;
        if (_checkDefeat())  return;
        state.currentActorIndex++;
        _k.wait(0.4, _nextTurn);
    });
}

// ----------------------------------------------------------------
// Enemy AI turn
// ----------------------------------------------------------------

function _doEnemyTurn(enemy) {
    const targets = state.aliveParty;
    if (targets.length === 0) { _checkDefeat(); return; }

    const action = _enemyChooseAction(enemy, targets);
    if (action.type === 'attack') {
        events.emit('showMessage', `${enemy.name} attacks!`);
    }

    _resolveAction(enemy, action, () => {
        if (_checkDefeat())  return;
        if (_checkVictory()) return;
        state.currentActorIndex++;
        _k.wait(0.4, _nextTurn);
    });
}

function _enemyChooseAction(enemy, aliveParty) {
    const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];

    // Dark Elf: 40% chance to poison a random party member
    if (enemy.name === 'Dark Elf' && Math.random() < 0.40) {
        const victim = aliveParty[Math.floor(Math.random() * aliveParty.length)];
        if (!victim.statusEffects.find(s => s.type === 'poison')) {
            events.emit('showMessage', 'Dark Elf weaves a curse!');
            playEnemyMagic();
            victim.statusEffects.push({ type: 'poison', turnsLeft: 4 });
            events.emit('statusApplied', victim, 'poison');
            refreshStatus();
        }
        // Still make a physical attack this turn
        return { type: 'attack', targets: [target] };
    }

    // Dragon: 35% chance to use fire breath (hits all party, magical fire damage)
    if (enemy.name === 'Dragon' && Math.random() < 0.35) {
        events.emit('showMessage', 'Dragon unleashes fire breath!');
        playFireSpell();
        aliveParty.forEach(t => {
            const dmg = _magDmg(enemy, t, 1.6, 'fire');
            _applyDamage(t, dmg);
            events.emit('animateAction', { type: 'magic', actorId: enemy.id, targetId: t.classId, value: dmg });
        });
        // Return a no-op so _resolveAction doesn't double-attack; we handled it inline
        return { type: '_done' };
    }

    // Lich King: 30% chance to cast a curse (poison all party + magic damage)
    if (enemy.name === 'Lich King' && Math.random() < 0.30) {
        events.emit('showMessage', 'Lich King casts Death Curse!');
        playEnemyMagic();
        aliveParty.forEach(t => {
            if (!t.statusEffects.find(s => s.type === 'poison')) {
                t.statusEffects.push({ type: 'poison', turnsLeft: 5 });
                events.emit('statusApplied', t, 'poison');
            }
            const dmg = _magDmg(enemy, t, 1.0);
            _applyDamage(t, dmg);
            events.emit('animateAction', { type: 'magic', actorId: enemy.id, targetId: t.classId, value: dmg });
        });
        refreshStatus();
        return { type: '_done' };
    }

    // Stone Golem: always attacks the highest-ATK party member (focus threat)
    if (enemy.name === 'Stone Golem') {
        const focusTarget = aliveParty.reduce((a, b) => (a.atk > b.atk ? a : b));
        return { type: 'attack', targets: [focusTarget] };
    }

    // Default: attack a random alive party member
    return { type: 'attack', targets: [target] };
}

// ----------------------------------------------------------------
// Damage formula
// ----------------------------------------------------------------

function _physDmg(attacker, target, power) {
    const atk = attacker.atk * (attacker.buffs && attacker.buffs.atkUp ? 1.5 : 1);
    const def = target.def  * (target.buffs  && target.buffs.defUp  ? 1.4 : 1);
    const raw = Math.max(1, atk * power - def * 0.5);
    const variance = 0.85 + Math.random() * 0.3;
    return Math.max(1, Math.round(raw * variance));
}

function _magDmg(attacker, target, power, elem) {
    const magRes = target.mag ?? 0;
    let raw = Math.max(1, attacker.mag * power - magRes * 0.3);
    // Elemental weakness: fire vs ice and vice versa
    if (elem && target.weakness === elem) raw *= 1.5;
    const variance = 0.85 + Math.random() * 0.3;
    return Math.max(1, Math.round(raw * variance));
}

// Returns true if attack misses due to accDown debuff on attacker
function _doesMiss(attacker) {
    return !!(attacker.buffs && attacker.buffs.accDown && Math.random() < 0.30);
}

function _healAmt(caster, power) {
    const raw = Math.max(1, caster.mag * power);
    const variance = 0.9 + Math.random() * 0.2;
    return Math.max(1, Math.round(raw * variance));
}

// ----------------------------------------------------------------
// Action resolution
// ----------------------------------------------------------------

function _resolveAction(actor, action, done) {
    if (action.type === 'attack') {
        _doAttack(actor, action.targets, done);
    } else if (action.type === 'ability') {
        _doAbility(actor, action.abilityId, action.targets, done);
    } else if (action.type === 'defend') {
        _doDefend(actor, done);
    } else if (action.type === 'item') {
        _doItem(action.itemId, action.targets, done);
    } else if (action.type === '_done') {
        // Enemy inline action already resolved; just wait briefly then continue
        _k.wait(0.6, done);
    } else {
        done();
    }
}

function _doAttack(attacker, targets, done) {
    const target = targets[0];

    // accDown: 30% miss chance
    if (_doesMiss(attacker)) {
        events.emit('showMessage', `${attacker.name} attacks... but misses!`);
        _k.wait(0.5, done);
        return;
    }

    const dmg = _physDmg(attacker, target, 1.0);

    if (!attacker.isEnemy) {
        events.emit('showMessage', `${attacker.name} attacks! ${dmg} damage.`);
        playPhysicalHit();
    } else {
        playEnemyAttack();
    }

    _applyDamage(target, dmg);

    events.emit('animateAction', {
        type:    'hit',
        actorId: attacker.id ?? attacker.classId,
        targetId: target.id ?? target.classId,
        value:   dmg,
    });

    _k.wait(0.5, done);
}

function _doAbility(actor, abilityId, targets, done) {
    const abil = ABILITY_DEFS[abilityId];
    if (!abil) { done(); return; }

    // Spend MP
    actor.mp = Math.max(0, actor.mp - abil.mp);

    if (abil.type === 'physical') {
        // Steal: deal light damage and take some gold
        if (abil.steal) {
            const target = targets[0];
            if (_doesMiss(actor)) {
                events.emit('showMessage', `${actor.name} tries to steal... but fails!`);
                _k.wait(0.5, done);
                return;
            }
            const dmg = _physDmg(actor, target, abil.power);
            const stolen = target.gold ? Math.min(target.gold, Math.floor(target.gold * 0.3) + 1) : 0;
            if (stolen > 0) target.gold -= stolen;
            state.earn(stolen);
            events.emit('showMessage', `${actor.name} steals! ${dmg} dmg${stolen ? `, ${stolen} gold` : ''}.`);
            playPhysicalHit();
            _applyDamage(target, dmg);
            events.emit('animateAction', { type: 'hit', actorId: actor.classId, targetId: target.id ?? target.classId, value: dmg });
            _k.wait(0.5, done);
            return;
        }

        const hits = abil.hits ?? 1;
        let delay = 0;
        for (let h = 0; h < hits; h++) {
            const d = delay;
            _k.wait(d, () => {
                targets.forEach(t => {
                    if (_doesMiss(actor)) {
                        events.emit('showMessage', `${actor.name} uses ${abil.name}... miss!`);
                        return;
                    }
                    const dmg = _physDmg(actor, t, abil.power);
                    events.emit('showMessage', `${actor.name} uses ${abil.name}! ${dmg} damage.`);
                    playPhysicalHit();
                    _applyDamage(t, dmg);
                    events.emit('animateAction', { type: 'hit', actorId: actor.classId, targetId: t.id ?? t.classId, value: dmg });
                });
            });
            delay += 0.3;
        }
        _k.wait(delay + 0.2, done);

    } else if (abil.type === 'magical') {
        if (abil.elem === 'fire') playFireSpell();
        else if (abil.elem === 'ice') playIceSpell();
        else playMagicCast();

        targets.forEach(t => {
            const dmg = _magDmg(actor, t, abil.power, abil.elem);
            events.emit('showMessage', `${actor.name} casts ${abil.name}! ${dmg} damage.`);
            _applyDamage(t, dmg);
            events.emit('animateAction', { type: 'magic', actorId: actor.classId, targetId: t.id ?? t.classId, value: dmg });
        });
        _k.wait(0.7, done);

    } else if (abil.type === 'heal') {
        playHeal();
        targets.forEach(t => {
            const amt = _healAmt(actor, abil.power);
            t.hp = Math.min(t.maxHp, t.hp + amt);
            events.emit('showMessage', `${actor.name} uses ${abil.name}! ${t.name} recovers ${amt} HP.`);
        });
        refreshStatus();
        _k.wait(0.6, done);

    } else if (abil.type === 'status') {
        const effect = abil.effect;
        targets.forEach(t => {
            if (!t.buffs) t.buffs = {};
            t.buffs[effect] = 3;
            events.emit('statusApplied', t, effect);
            events.emit('showMessage', `${actor.name} uses ${abil.name}!`);
        });
        _k.wait(0.5, done);

    } else {
        done();
    }
}

function _doDefend(actor, done) {
    if (!actor.buffs) actor.buffs = {};
    actor.buffs.defending = 1;
    events.emit('showMessage', `${actor.name} defends!`);
    _k.wait(0.4, done);
}

function _doItem(itemId, targets, done) {
    const item = SHOP_ITEMS[itemId];
    if (!item) { done(); return; }

    // Consume from inventory
    if (!state.inventory[itemId] || state.inventory[itemId] <= 0) { done(); return; }
    state.inventory[itemId]--;

    playItemUse();

    if (item.effect === 'healHp') {
        targets.forEach(t => {
            const before = t.hp;
            t.hp = Math.min(t.maxHp, t.hp + item.amount);
            const gained = t.hp - before;
            events.emit('showMessage', `Used ${item.name}! ${t.name} recovers ${gained} HP.`);
        });
        refreshStatus();

    } else if (item.effect === 'healMp') {
        targets.forEach(t => {
            const before = t.mp;
            t.mp = Math.min(t.maxMp, t.mp + item.amount);
            const gained = t.mp - before;
            events.emit('showMessage', `Used ${item.name}! ${t.name} recovers ${gained} MP.`);
        });
        refreshStatus();

    } else if (item.effect === 'revive') {
        targets.forEach(t => {
            if (!t.isKO) return;
            t.isKO = false;
            t.hp   = Math.max(1, Math.floor(t.maxHp * (item.amount / 100)));
            events.emit('showMessage', `Used ${item.name}! ${t.name} is revived!`);
            // Rebuild turn order to include revived member
            state.turnOrder = _buildTurnOrder();
        });
        refreshStatus();

    } else if (item.effect === 'cureStatus') {
        targets.forEach(t => {
            t.statusEffects = t.statusEffects.filter(s => s.type !== item.status);
            events.emit('showMessage', `Used ${item.name}! ${t.name}'s ${item.status} is cured.`);
        });
        refreshStatus();
    }

    _k.wait(0.6, done);
}

// ----------------------------------------------------------------
// Damage application
// ----------------------------------------------------------------

function _applyDamage(target, dmg) {
    // Check defend buff
    if (target.buffs && target.buffs.defending) {
        dmg = Math.max(1, Math.floor(dmg / 2));
    }

    playDamageHit();
    target.hp = Math.max(0, target.hp - dmg);

    if (!target.isEnemy) {
        refreshStatus();
    } else {
        events.emit('animateAction', { type: 'enemyHit', targetId: target.id, value: dmg });
    }

    if (target.hp <= 0 && !target.isKO) {
        _killCombatant(target);
    }
}

function _killCombatant(target) {
    target.isKO = true;
    target.hp   = 0;

    if (target.isEnemy) {
        playEnemyDeath();
        events.emit('combatantDied', target);
        events.emit('showMessage', `${target.name} is defeated!`);
        // Award gold immediately
        state.earn(target.gold);
    } else {
        playPartyKO();
        target.isKO = true;
        events.emit('combatantDied', target);
        events.emit('partyMemberDied', target);
        events.emit('showMessage', `${target.name} is KO!`);
        refreshStatus();
    }
}

// ----------------------------------------------------------------
// Status effect tick (end of round)
// ----------------------------------------------------------------

function _tickStatusEffects() {
    const all = [...state.party, ...state.enemies];
    for (const c of all) {
        if (c.isKO) continue;
        const poison = c.statusEffects.find(s => s.type === 'poison');
        if (poison) {
            const dmg = Math.max(1, Math.floor(c.maxHp * 0.05));
            _applyDamage(c, dmg);
            events.emit('showMessage', `${c.name} suffers poison! ${dmg} damage.`);
            poison.turnsLeft--;
            if (poison.turnsLeft <= 0) {
                c.statusEffects = c.statusEffects.filter(s => s.type !== 'poison');
            }
        }
        // Tick buff durations
        if (c.buffs) {
            for (const [buff, turns] of Object.entries(c.buffs)) {
                if (buff === 'defending') {
                    delete c.buffs[buff];
                } else {
                    c.buffs[buff] = turns - 1;
                    if (c.buffs[buff] <= 0) delete c.buffs[buff];
                }
            }
        }
    }
}

// ----------------------------------------------------------------
// Victory / Defeat
// ----------------------------------------------------------------

function _checkVictory() {
    const alive = state.enemies.filter(e => !e.isKO);
    if (alive.length > 0) return false;

    _phase = 'victory';
    state.inBattle = false;

    // Total XP from this encounter
    const totalXP = state.enemies.reduce((sum, e) => sum + e.xp, 0);
    state.awardXP(totalXP);

    playVictoryFanfare();

    _k.wait(0.6, () => {
        showVictoryScreen(totalXP, state.enemies.reduce((s, e) => s + e.gold, 0));
        // Use Kaplay key handlers so they receive events from the canvas
        let _continued = false;
        const _advance = () => {
            if (_continued) return;
            _continued = true;
            h1.cancel();
            h2.cancel();
            _advanceEncounter();
        };
        const h1 = _k.onKeyPress('space', _advance);
        const h2 = _k.onKeyPress('enter', _advance);
    });

    return true;
}

function _checkDefeat() {
    const alive = state.aliveParty;
    if (alive.length > 0) return false;

    _phase = 'defeat';
    state.inBattle = false;
    state.loseLife();
    return true;
}

// ----------------------------------------------------------------
// Encounter sequencing
// ----------------------------------------------------------------

export function startNextEncounter() {
    const enc = ENCOUNTERS[state.encounterIndex];
    if (!enc) {
        // All encounters cleared → game won
        events.emit('gameWon');
        return;
    }

    const enemyDefs = enc.enemies.map(type => ({ ...ENEMY_DEFS[type] }));
    events.emit('battleStart', enemyDefs);
}

function _advanceEncounter() {
    state.encounterIndex++;

    // Destroy victory overlay before anything else
    _k.destroyAll('victoryOverlay');

    // Check for game win
    if (state.encounterIndex >= ENCOUNTERS.length) {
        events.emit('gameWon');
        return;
    }

    // Reset phase so _onBattleStart's guard passes
    _phase = 'idle';

    // TODO Phase 4: show shop every 2–3 encounters
    startNextEncounter();
}
