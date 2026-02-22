import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, STARTING_GOLD, PARTY_DEFS, CLASS_ABILITIES, XP_TABLE, LEVEL_UP_GROWTH } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._gold       = STARTING_GOLD;
        this._lives      = STARTING_LIVES;  // party wipe counter
        this._isGameOver = false;
        this._isPaused   = false;

        // Battle state
        this.inBattle       = false;
        this.encounterIndex = 0;
        this.currentActorIndex = 0;
        this.turnOrder      = [];   // sorted combatants for this battle
        this.enemies        = [];   // active enemy combatant objects
        this.actionQueue    = [];   // pending animated actions

        // Inventory (item id → count)
        this.inventory = {
            potion:   3,
            ether:    1,
            antidote: 2,
        };

        // Party — built fresh, preserving across battles via _party
        this._party = this._buildParty();
    }

    // -------------------------------------------------------
    // Party
    // -------------------------------------------------------

    _buildParty() {
        return ['warrior', 'mage', 'healer', 'rogue'].map(classId => {
            const def = PARTY_DEFS[classId];
            return {
                classId,
                name:     def.name,
                level:    1,
                xp:       0,
                xpToNext: XP_TABLE[0],
                hp:       def.hp,
                maxHp:    def.hp,
                mp:       def.mp,
                maxMp:    def.mp,
                atk:      def.atk,
                def:      def.def,
                mag:      def.mag,
                spd:      def.spd,
                color:    def.color,
                abilities:CLASS_ABILITIES[classId].slice(),
                statusEffects: [],   // [{ type, turnsLeft }]
                buffs:    {},        // { atkUp: turnsLeft, defUp: ... }
                isKO:     false,
            };
        });
    }

    get party()    { return this._party; }
    get aliveParty() { return this._party.filter(m => !m.isKO); }

    // -------------------------------------------------------
    // Score
    // -------------------------------------------------------
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }
    addScore(n) { this.score += n; }

    // -------------------------------------------------------
    // Gold
    // -------------------------------------------------------
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('goldChanged', this._gold);
    }
    spend(n) { this.gold -= n; }
    earn(n)  { this.gold += n; }

    // -------------------------------------------------------
    // Lives (party wipe counter)
    // -------------------------------------------------------
    get lives() { return this._lives; }
    set lives(val) {
        this._lives = Math.max(0, val);
        events.emit('livesChanged', this._lives);
        if (this._lives <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }
    loseLife() { this.lives -= 1; }

    // -------------------------------------------------------
    // Flags
    // -------------------------------------------------------
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }

    // -------------------------------------------------------
    // XP & level-up
    // -------------------------------------------------------
    awardXP(total) {
        const share = Math.floor(total / this.aliveParty.length);
        for (const member of this.aliveParty) {
            member.xp += share;
            while (member.level < XP_TABLE.length && member.xp >= member.xpToNext) {
                member.xp -= member.xpToNext;
                member.level++;
                member.xpToNext = XP_TABLE[Math.min(member.level - 1, XP_TABLE.length - 1)];
                const gains = this._applyLevelUp(member);
                events.emit('levelUp', member, member.level, gains);
            }
        }
        this.score += total;  // XP also contributes to score
    }

    _applyLevelUp(member) {
        const growth = LEVEL_UP_GROWTH[member.classId];
        const gains = {};
        for (const [stat, [min, max]] of Object.entries(growth)) {
            const gain = min + Math.floor(Math.random() * (max - min + 1));
            gains[stat] = gain;
            if (stat === 'hp') {
                member.maxHp += gain;
                member.hp    += gain;  // full heal on level-up
            } else if (stat === 'mp') {
                member.maxMp += gain;
                member.mp    += gain;
            } else {
                member[stat] += gain;
            }
        }
        return gains;
    }
}

export const state = new GameState();
