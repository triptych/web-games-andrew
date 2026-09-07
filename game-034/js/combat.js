import { events } from './events.js';

/**
 * combat.js — turn-based auto-battle resolution.
 *
 * A CombatEngine is created per room-fight. Each call to tick() resolves ONE
 * combatant's action (turn order by speed, re-sorted each tick since dead
 * combatants drop out). This keeps every visible "beat" to a single attack,
 * which is what the log/animations key off.
 */

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function rollDamage(attacker, defender) {
    const isCrit = Math.random() < attacker.critChance;
    const variance = 0.85 + Math.random() * 0.3; // +/-15%
    let raw = attacker.atk * variance - defender.def * 0.5;
    raw = Math.max(1, raw);
    if (isCrit) raw *= 1.8;
    return { amount: Math.round(raw), isCrit };
}

export class CombatEngine {
    constructor(party, monsters) {
        this.party = party;
        this.monsters = monsters;
        this.turnOrder = [];
        this.turnIdx = 0;
        this.finished = false;
        this.result = null; // 'victory' | 'defeat'
        this._rebuildTurnOrder();
    }

    _livingParty() { return this.party.filter(h => h.alive); }
    _livingMonsters() { return this.monsters.filter(m => m.alive); }

    _rebuildTurnOrder() {
        const all = [...this._livingParty(), ...this._livingMonsters()];
        all.sort((a, b) => b.spd - a.spd + (Math.random() - 0.5) * 3);
        this.turnOrder = all;
        this.turnIdx = 0;
    }

    /** Resolve one combatant's action. Returns true if combat ended this tick. */
    tick() {
        if (this.finished) return true;

        if (this._livingParty().length === 0) {
            this.finished = true;
            this.result = 'defeat';
            return true;
        }
        if (this._livingMonsters().length === 0) {
            this.finished = true;
            this.result = 'victory';
            return true;
        }

        if (this.turnIdx >= this.turnOrder.length) this._rebuildTurnOrder();
        let actor = this.turnOrder[this.turnIdx++];
        // Skip dead actors queued before their death this round.
        while (actor && !actor.alive) {
            if (this.turnIdx >= this.turnOrder.length) { this._rebuildTurnOrder(); actor = this.turnOrder[this.turnIdx++]; }
            else actor = this.turnOrder[this.turnIdx++];
            if (!actor) break;
        }
        if (!actor) return false;

        if (actor.side === 'hero' && actor.healPerTurn) {
            this._resolveHeal(actor);
        } else if (actor.side === 'hero') {
            this._resolveAttack(actor, this._pickTarget(this._livingMonsters()));
        } else {
            this._resolveAttack(actor, this._pickTarget(this._livingParty()));
        }

        if (this._livingParty().length === 0) {
            this.finished = true;
            this.result = 'defeat';
            return true;
        }
        if (this._livingMonsters().length === 0) {
            this.finished = true;
            this.result = 'victory';
            return true;
        }
        return false;
    }

    _pickTarget(pool) {
        // Bias toward lowest-HP target (a little "focus fire" flavor) with randomness.
        if (Math.random() < 0.5) {
            return pool.reduce((lowest, c) => (c.hp < lowest.hp ? c : lowest), pool[0]);
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _resolveAttack(attacker, target) {
        if (!target) return;
        const { amount, isCrit } = rollDamage(attacker, target);
        target.hp = clamp(target.hp - amount, 0, target.maxHp);
        target.anim.hitFlash = 1;
        attacker.anim.attackPulse = 1;

        events.emit(attacker.side === 'hero' ? 'monsterDamaged' : 'heroDamaged', target.id, amount, isCrit);
        events.emit('combatLog', {
            text: `${attacker.name} hits ${target.name} for ${amount}${isCrit ? ' CRIT!' : ''}`,
            kind: isCrit ? 'crit' : 'normal',
        });

        if (target.hp <= 0) {
            target.alive = false;
            if (target.side === 'monster') {
                events.emit('monsterDied', target.id);
                events.emit('combatLog', { text: `${target.name} is defeated!`, kind: 'death' });
            } else {
                events.emit('heroDied', target.id);
                events.emit('combatLog', { text: `${target.name} has fallen!`, kind: 'death' });
            }
        }
    }

    _resolveHeal(healer) {
        const living = this._livingParty();
        const target = living.reduce((lowest, c) => (c.hp / c.maxHp < lowest.hp / lowest.maxHp ? c : lowest), living[0]);
        if (target.hp >= target.maxHp) return; // nothing to heal — skip quietly (still consumes the turn)
        const amount = Math.round(healer.healPerTurn * (0.85 + Math.random() * 0.3));
        target.hp = clamp(target.hp + amount, 0, target.maxHp);
        target.anim.healFlash = 1;
        events.emit('combatLog', { text: `${healer.name} heals ${target.name} for ${amount}`, kind: 'heal' });
    }
}
