/**
 * BattleScene — Turn-based combat overlay.
 *
 * Battle flow:
 *   1. Build combatant list (party + enemies) sorted by SPD
 *   2. Each turn: pick action for current combatant (player choice or AI)
 *   3. Apply effects, check win/lose
 *   4. Emit 'battleEnd' with result, resume callerScene
 *
 * Party HP/MP are tracked on clone objects; persisted back on battle end.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { PARTY_DEFS, ENEMY_DEFS } from './characters.js';
import { rollLoot, getItem, ITEM_DEFS } from './items.js';
import {
    playSwordSwing, playMagicCast, playHeal, playHit,
    playDeath, playVictory, playGameOver, playUiClick,
} from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

// Battle state (local, not in global state)
let _combatants = [];   // { ...def, currentHp, currentMp, isEnemy, statusEffects[] }
let _turnIdx    = 0;
let _phase      = 'select';  // 'select' | 'ability' | 'target' | 'item' | 'execute' | 'end'
let _selectedAbilityIdx = 0;
let _selectedTargetIdx  = 0;
let _itemTargetIdx      = 0;
let _callerScene = 'MapScene';

export class BattleScene extends Phaser.Scene {
    constructor() { super({ key: 'BattleScene' }); }

    init(data) {
        this._enemyIds    = data.enemyIds || ['slime'];
        this._isFinalBoss = !!data.isFinalBoss;
        _callerScene      = data.callerScene || 'MapScene';
    }

    create() {
        this._buildCombatants();
        this._buildUI();
        this._sortBySpeed();
        _turnIdx = 0;
        _phase   = 'select';

        this._beginTurn();
    }

    _buildCombatants() {
        _combatants = [];

        // Party — use persisted HP/MP and level-scaled stats from state
        for (const id of state.party) {
            const def = PARTY_DEFS[id];
            if (!def) continue;
            _combatants.push({
                ...def,
                maxHp: state.getMaxHp(id),
                maxMp: state.getMaxMp(id),
                atk:   state.getScaledStat(id, 'atk'),
                def:   state.getScaledStat(id, 'def'),
                spd:   state.getScaledStat(id, 'spd'),
                currentHp: Math.min(state.getHp(id), state.getMaxHp(id)),
                currentMp: Math.min(state.getMp(id), state.getMaxMp(id)),
                isEnemy: false,
                statusEffects: [],
            });
        }

        // Enemies
        for (const id of this._enemyIds) {
            const def = ENEMY_DEFS[id];
            if (!def) continue;
            _combatants.push({
                ...def,
                currentHp: def.maxHp,
                currentMp: 0,
                isEnemy: true,
                statusEffects: [],
            });
        }
    }

    _persistPartyHp() {
        for (const c of _combatants.filter(c => !c.isEnemy)) {
            state.setHp(c.id, c.currentHp);
            state.setMp(c.id, c.currentMp);
        }
    }

    _sortBySpeed() {
        _combatants.sort((a, b) => b.spd - a.spd);
    }

    _buildUI() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Dim overlay
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(0);

        // Background panel
        this.add.rectangle(CX, CY, GAME_WIDTH - 40, GAME_HEIGHT - 40, 0x120820, 0.95)
            .setStrokeStyle(2, 0x6040a0).setDepth(1);

        this._uiContainer = this.add.container(0, 0).setDepth(10);
        this._refresh();
    }

    _refresh() {
        this._uiContainer.removeAll(true);

        this._drawCombatantPortraits();
        this._drawActionMenu();
        this._drawBattleLog();
    }

    _drawCombatantPortraits() {
        const enemies = _combatants.filter(c => c.isEnemy);
        const party   = _combatants.filter(c => !c.isEnemy);

        // Enemies — top half
        enemies.forEach((e, i) => {
            const x = 200 + i * 280;
            const y = 150;
            const alive = e.currentHp > 0;

            this._uiContainer.add(this.add.text(x, y - 60, e.portrait, { fontSize: '52px' })
                .setOrigin(0.5).setAlpha(alive ? 1 : 0.3));
            this._uiContainer.add(this.add.text(x, y - 10, e.name, {
                fontSize: '14px', color: '#ff8080', fontFamily: 'monospace',
            }).setOrigin(0.5).setAlpha(alive ? 1 : 0.3));

            // Status effect icons
            const eStatIcons = (e.statusEffects || []).map(s => s.type === 'poison' ? '☠' : s.type === 'stun' ? '💫' : '').join('');
            if (eStatIcons) {
                this._uiContainer.add(this.add.text(x + 40, y - 60, eStatIcons, { fontSize: '14px' }).setOrigin(0, 0.5));
            }

            // HP bar
            this._drawBar(x - 60, y + 10, 120, 10, e.currentHp, e.maxHp, 0xff4040, 0x200000);

            // Enemy is "selected target" highlight
            if (_phase === 'target' && !e.isEnemy === false) {
                const enemyIdx = enemies.indexOf(e);
                if (enemyIdx === _selectedTargetIdx) {
                    this._uiContainer.add(this.add.rectangle(x, y - 20, 150, 130, 0xffffff, 0.08)
                        .setStrokeStyle(2, 0xffff00));
                }
            }
        });

        // Party — bottom half
        const panelY = GAME_HEIGHT - 220;
        party.forEach((p, i) => {
            const x = 160 + i * 280;
            const y = panelY + 20;
            const alive = p.currentHp > 0;

            this._uiContainer.add(this.add.text(x - 60, y, p.portrait, { fontSize: '32px' })
                .setAlpha(alive ? 1 : 0.3));
            this._uiContainer.add(this.add.text(x - 20, y - 6, p.name, {
                fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
            }).setAlpha(alive ? 1 : 0.3));

            // Highlight current actor
            const combIdx = _combatants.findIndex(c => c.id === p.id);
            if (combIdx === _turnIdx) {
                this._uiContainer.add(this.add.rectangle(x + 40, y + 10, 220, 80, 0xffffff, 0.05)
                    .setStrokeStyle(2, 0xa07cff));
            }

            // Status effect icons
            const pStatIcons = (p.statusEffects || []).map(s => s.type === 'poison' ? '☠' : s.type === 'stun' ? '💫' : '').join('');
            if (pStatIcons) {
                this._uiContainer.add(this.add.text(x - 20, y + 44, pStatIcons, {
                    fontSize: '13px', fontFamily: 'monospace',
                }));
            }

            // HP / MP bars
            this._drawBar(x - 20, y + 20, 160, 8, p.currentHp, p.maxHp, 0x40cc40, 0x102010);
            this._uiContainer.add(this.add.text(x - 20, y + 14, 'HP', {
                fontSize: '10px', color: '#80ff80', fontFamily: 'monospace',
            }));
            this._drawBar(x - 20, y + 36, 160, 8, p.currentMp, p.maxMp, 0x4080ff, 0x101030);
            this._uiContainer.add(this.add.text(x - 20, y + 30, 'MP', {
                fontSize: '10px', color: '#8080ff', fontFamily: 'monospace',
            }));
        });
    }

    _drawBar(x, y, w, h, val, max, fillColor, bgColor) {
        const ratio = Math.max(0, val / max);
        this._uiContainer.add(this.add.rectangle(x + w/2, y, w, h, bgColor).setOrigin(0.5));
        if (ratio > 0) {
            this._uiContainer.add(this.add.rectangle(x + (w * ratio)/2, y, w * ratio, h, fillColor).setOrigin(0.5));
        }
    }

    _drawActionMenu() {
        if (_phase !== 'select' && _phase !== 'ability' && _phase !== 'target' && _phase !== 'item') return;

        const actor = _combatants[_turnIdx];
        if (!actor || actor.isEnemy) return;

        const menuX = 20;
        const menuY = GAME_HEIGHT - 190;

        // Panel: top-left origin at (menuX, menuY), 260 wide, 180 tall
        this._uiContainer.add(this.add.rectangle(menuX + 130, menuY + 90, 260, 180, 0x0a0518, 0.95)
            .setStrokeStyle(1, 0x6040a0));

        // Header label sits inside the panel
        this._uiContainer.add(this.add.text(menuX + 12, menuY + 8, `${actor.name}'s turn`, {
            fontSize: '13px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }));

        if (_phase === 'select') {
            const options = ['Attack', 'Abilities', 'Item', 'Flee'];
            options.forEach((opt, i) => {
                const y   = menuY + 34 + i * 34;
                const sel = i === _selectedAbilityIdx;
                this._uiContainer.add(this.add.text(menuX + 24, y, (sel ? '> ' : '  ') + opt, {
                    fontSize: '16px',
                    color: sel ? hex(COLORS.gold) : hex(COLORS.text),
                    fontFamily: 'monospace',
                }));
            });

        } else if (_phase === 'ability') {
            actor.abilities.forEach((ab, i) => {
                const y   = menuY + 34 + i * 34;
                const sel = i === _selectedAbilityIdx;
                const mpStr = ab.mpCost > 0 ? ` (${ab.mpCost}MP)` : '';
                const canUse = actor.currentMp >= ab.mpCost;
                this._uiContainer.add(this.add.text(menuX + 24, y,
                    (sel ? '> ' : '  ') + ab.name + mpStr, {
                        fontSize: '15px',
                        color: sel ? hex(COLORS.gold) : canUse ? hex(COLORS.text) : '#666666',
                        fontFamily: 'monospace',
                    }));
            });

        } else if (_phase === 'target') {
            const enemies = _combatants.filter(c => c.isEnemy && c.currentHp > 0);
            enemies.forEach((e, i) => {
                const y   = menuY + 34 + i * 34;
                const sel = i === _selectedTargetIdx;
                this._uiContainer.add(this.add.text(menuX + 24, y,
                    (sel ? '> ' : '  ') + e.name, {
                        fontSize: '15px',
                        color: sel ? hex(COLORS.gold) : hex(COLORS.text),
                        fontFamily: 'monospace',
                    }));
            });

        } else if (_phase === 'item') {
            const usable = state.inventory.filter(i => getItem(i.id)?.usable);
            if (usable.length === 0) {
                this._uiContainer.add(this.add.text(menuX + 24, menuY + 40, '  No usable items.', {
                    fontSize: '14px', color: '#666666', fontFamily: 'monospace',
                }));
            } else {
                usable.slice(0, 4).forEach((entry, i) => {
                    const def = getItem(entry.id);
                    const y   = menuY + 34 + i * 34;
                    const sel = i === _itemTargetIdx;
                    this._uiContainer.add(this.add.text(menuX + 24, y,
                        (sel ? '> ' : '  ') + def.name + ` x${entry.qty}`, {
                            fontSize: '14px',
                            color: sel ? hex(COLORS.gold) : hex(COLORS.text),
                            fontFamily: 'monospace',
                        }));
                });
            }
        }
    }

    _drawBattleLog() {
        if (!this._log) return;
        const logY = GAME_HEIGHT - 130;
        this._uiContainer.add(this.add.rectangle(GAME_WIDTH / 2, logY + 40, GAME_WIDTH - 300, 90, 0x0a0518, 0.9)
            .setStrokeStyle(1, 0x403060));
        this._uiContainer.add(this.add.text(300, logY + 8, this._log, {
            fontSize: '14px', color: hex(COLORS.text), fontFamily: 'monospace',
            wordWrap: { width: GAME_WIDTH - 340 },
            lineSpacing: 4,
        }));
    }

    _beginTurn() {
        // Skip dead combatants
        while (_turnIdx < _combatants.length && _combatants[_turnIdx].currentHp <= 0) {
            _turnIdx = (_turnIdx + 1) % _combatants.length;
        }

        const actor = _combatants[_turnIdx];
        if (!actor) return;

        // Process status effects
        let skipTurn = false;
        let statusMessage = null;
        actor.statusEffects = (actor.statusEffects || []).map(se => {
            if (se.type === 'poison') {
                const dmg = Math.max(1, Math.floor(actor.maxHp * 0.06));
                actor.currentHp = Math.max(0, actor.currentHp - dmg);
                statusMessage = `${actor.name} takes ${dmg} poison damage!`;
                playHit();
                return { ...se, turns: se.turns - 1 };
            }
            if (se.type === 'stun') {
                skipTurn = true;
                statusMessage = `${actor.name} is stunned and cannot act!`;
                return { ...se, turns: se.turns - 1 };
            }
            return { ...se, turns: se.turns - 1 };
        }).filter(se => se.turns > 0);

        this._log = statusMessage || `${actor.name}'s turn.`;
        this._refresh();
        if (skipTurn) {
            this.time.delayedCall(800, () => this._nextTurn());
            return;
        }

        if (actor.isEnemy) {
            // AI takes action after short delay
            this.time.delayedCall(800, () => this._enemyAction(actor));
        } else {
            _phase = 'select';
            _selectedAbilityIdx = 0;
            this._setupBattleInput();
            this._refresh();
        }
    }

    _setupBattleInput() {
        this.input.keyboard.off('keydown');
        this.input.keyboard.on('keydown', (e) => this._onKey(e.key));
    }

    _onKey(key) {
        const actor   = _combatants[_turnIdx];
        const enemies = _combatants.filter(c => c.isEnemy && c.currentHp > 0);
        const usableItems = state.inventory.filter(i => getItem(i.id)?.usable);

        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            if (_phase === 'target') _selectedTargetIdx = Math.max(0, _selectedTargetIdx - 1);
            else if (_phase === 'item') _itemTargetIdx = Math.max(0, _itemTargetIdx - 1);
            else _selectedAbilityIdx = Math.max(0, _selectedAbilityIdx - 1);
            playUiClick();
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            if (_phase === 'select')  _selectedAbilityIdx = Math.min(3, _selectedAbilityIdx + 1);
            if (_phase === 'ability') _selectedAbilityIdx = Math.min(actor.abilities.length - 1, _selectedAbilityIdx + 1);
            if (_phase === 'target')  _selectedTargetIdx  = Math.min(enemies.length - 1, _selectedTargetIdx + 1);
            if (_phase === 'item')    _itemTargetIdx      = Math.min(Math.max(0, usableItems.length - 1), _itemTargetIdx + 1);
            playUiClick();
        } else if (key === 'Enter' || key === ' ') {
            this._confirm(actor, enemies);
        } else if (key === 'Escape') {
            if (_phase !== 'select') { _phase = 'select'; _selectedAbilityIdx = 0; }
        }
        this._refresh();
    }

    _confirm(actor, enemies) {
        if (_phase === 'select') {
            if (_selectedAbilityIdx === 0) {
                // Basic attack — directly to target
                _phase = 'target';
                _selectedTargetIdx = 0;
                this._selectedAbility = actor.abilities[0];
            } else if (_selectedAbilityIdx === 1) {
                _phase = 'ability';
                _selectedAbilityIdx = 0;
            } else if (_selectedAbilityIdx === 2) {
                _phase = 'item';
                _itemTargetIdx = 0;
            } else if (_selectedAbilityIdx === 3) {
                // Flee
                if (Math.random() < 0.5) {
                    this._endBattle(false, true);
                } else {
                    this._log = `${actor.name} couldn't escape!`;
                    this._nextTurn();
                }
            }
        } else if (_phase === 'ability') {
            const ab = actor.abilities[_selectedAbilityIdx];
            if (actor.currentMp < ab.mpCost) {
                this._log = 'Not enough MP!';
                return;
            }
            this._selectedAbility = ab;
            if (ab.target === 'self' || ab.target === 'all' || ab.type === 'heal') {
                this._executePlayerAction(actor, ab, null);
                return;
            }
            _phase = 'target';
            _selectedTargetIdx = 0;
        } else if (_phase === 'target') {
            const ab  = this._selectedAbility;
            const tgt = enemies[_selectedTargetIdx];
            this._executePlayerAction(actor, ab, tgt);

        } else if (_phase === 'item') {
            const usable = state.inventory.filter(i => getItem(i.id)?.usable);
            const entry  = usable[_itemTargetIdx];
            if (!entry) return;
            this._useItemInBattle(actor, entry);
        }
    }

    _useItemInBattle(actor, entry) {
        const def = getItem(entry.id);
        if (!def) return;
        _phase = 'execute';
        this.input.keyboard.off('keydown');

        const party = _combatants.filter(c => !c.isEnemy && c.currentHp > 0);
        const fallen = _combatants.filter(c => !c.isEnemy && c.currentHp <= 0);

        if (def.effect.heal) {
            const tgt = party.sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
            if (!tgt) { this._log = 'No injured allies.'; _phase = 'select'; this._setupBattleInput(); this._refresh(); return; }
            const amt = def.effect.heal;
            tgt.currentHp = Math.min(tgt.maxHp, tgt.currentHp + amt);
            playHeal();
            this._log = `${actor.name} used ${def.name}! ${tgt.name} recovered ${amt} HP.`;
        } else if (def.effect.mpRestore) {
            const tgt = party.sort((a, b) => (a.currentMp / a.maxMp) - (b.currentMp / b.maxMp))[0];
            if (!tgt) { this._log = 'No allies need MP.'; _phase = 'select'; this._setupBattleInput(); this._refresh(); return; }
            const amt = def.effect.mpRestore;
            tgt.currentMp = Math.min(tgt.maxMp, tgt.currentMp + amt);
            playHeal();
            this._log = `${actor.name} used ${def.name}! ${tgt.name} recovered ${amt} MP.`;
        } else if (def.effect.revive) {
            const tgt = fallen[0];
            if (!tgt) { this._log = 'No fallen allies.'; _phase = 'select'; this._setupBattleInput(); this._refresh(); return; }
            tgt.currentHp = 1;
            playHeal();
            this._log = `${actor.name} used ${def.name}! ${tgt.name} is revived!`;
        } else {
            this._log = `Used ${def.name}.`;
        }

        state.removeItem(entry.id, 1);
        this._refresh();
        this.time.delayedCall(900, () => this._nextTurn());
    }

    _executePlayerAction(actor, ability, target) {
        _phase = 'execute';
        this.input.keyboard.off('keydown');

        actor.currentMp = Math.max(0, actor.currentMp - ability.mpCost);

        if (ability.type === 'heal') {
            // Heal first ally with lowest HP ratio
            const healTarget = _combatants.filter(c => !c.isEnemy && c.currentHp > 0)
                .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
            const healAmt = ability.heal || 40;
            healTarget.currentHp = Math.min(healTarget.maxHp, healTarget.currentHp + healAmt);
            playHeal();
            this._log = `${actor.name} uses ${ability.name}! ${healTarget.name} recovers ${healAmt} HP.`;

        } else if (ability.target === 'all' && ability.type !== 'support') {
            playMagicCast();
            const dmgArr = [];
            for (const enemy of _combatants.filter(c => c.isEnemy && c.currentHp > 0)) {
                const dmg = this._calcDamage(actor, enemy, ability);
                enemy.currentHp = Math.max(0, enemy.currentHp - dmg);
                dmgArr.push(`${enemy.name}: ${dmg}`);
            }
            this._log = `${actor.name} uses ${ability.name}! ${dmgArr.join(', ')}`;

        } else if (target) {
            if (ability.type === 'magic') playMagicCast(); else playSwordSwing();
            const dmg = this._calcDamage(actor, target, ability);
            target.currentHp = Math.max(0, target.currentHp - dmg);
            playHit();
            this._log = `${actor.name} uses ${ability.name} on ${target.name} for ${dmg} damage!`;

            // Apply status effects
            if (ability.effect === 'poison' && Math.random() < 0.6) {
                target.statusEffects = target.statusEffects || [];
                if (!target.statusEffects.find(s => s.type === 'poison')) {
                    target.statusEffects.push({ type: 'poison', turns: 3 });
                    this._log += ' Poisoned!';
                }
            } else if (ability.effect === 'stun' && Math.random() < 0.4) {
                target.statusEffects = target.statusEffects || [];
                if (!target.statusEffects.find(s => s.type === 'stun')) {
                    target.statusEffects.push({ type: 'stun', turns: 1 });
                    this._log += ' Stunned!';
                }
            } else if (ability.effect === 'lifesteal' && dmg > 0) {
                const heal = Math.floor(dmg / 2);
                actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
                this._log += ` ${actor.name} healed ${heal} HP.`;
            }
        }

        this._refresh();
        this.time.delayedCall(900, () => this._nextTurn());
    }

    _enemyAction(enemy) {
        const abilities = enemy.abilities || [{ id: 'attack', name: 'Attack', mpCost: 0, damage: 1.0, type: 'physical', target: 'single' }];
        const ability   = abilities[Math.floor(Math.random() * abilities.length)];
        const targets   = _combatants.filter(c => !c.isEnemy && c.currentHp > 0);
        if (!targets.length) { this._endBattle(false); return; }

        const target = targets[Math.floor(Math.random() * targets.length)];

        if (ability.type === 'magic') playMagicCast(); else playSwordSwing();
        const dmg = this._calcDamage(enemy, target, ability);
        target.currentHp = Math.max(0, target.currentHp - dmg);
        playHit();

        this._log = `${enemy.name} uses ${ability.name} on ${target.name} for ${dmg} damage!`;

        if (ability.effect === 'poison' && Math.random() < 0.5) {
            target.statusEffects = target.statusEffects || [];
            if (!target.statusEffects.find(s => s.type === 'poison')) {
                target.statusEffects.push({ type: 'poison', turns: 3 });
                this._log += ' Poisoned!';
            }
        } else if (ability.effect === 'stun' && Math.random() < 0.3) {
            target.statusEffects = target.statusEffects || [];
            if (!target.statusEffects.find(s => s.type === 'stun')) {
                target.statusEffects.push({ type: 'stun', turns: 1 });
                this._log += ' Stunned!';
            }
        } else if (ability.effect === 'mp_drain' && dmg > 0) {
            const mpDrain = Math.min(target.currentMp, Math.floor(dmg / 2));
            target.currentMp = Math.max(0, target.currentMp - mpDrain);
            if (mpDrain > 0) this._log += ` -${mpDrain} MP!`;
        }

        this._refresh();

        this.time.delayedCall(800, () => this._nextTurn());
    }

    _calcDamage(attacker, defender, ability) {
        const base = Math.max(1, (attacker.atk * (ability.damage || 1.0)) - (ability.type === 'magic' ? 0 : defender.def / 2));
        const variance = 0.85 + Math.random() * 0.3;
        return Math.round(base * variance);
    }

    _nextTurn() {
        // Check win/lose
        const allEnemiesDead = _combatants.filter(c => c.isEnemy).every(c => c.currentHp <= 0);
        const allPartyDead   = _combatants.filter(c => !c.isEnemy).every(c => c.currentHp <= 0);

        if (allEnemiesDead) { this._endBattle(true);  return; }
        if (allPartyDead)   { this._endBattle(false); return; }

        if (!_combatants.length) return;
        _turnIdx = (_turnIdx + 1) % _combatants.length;
        // Skip dead combatants
        let guard = 0;
        while (_combatants[_turnIdx] && _combatants[_turnIdx].currentHp <= 0) {
            _turnIdx = (_turnIdx + 1) % _combatants.length;
            if (++guard > _combatants.length) return;
        }
        this._beginTurn();
    }

    _endBattle(won, fled = false) {
        _phase = 'end';
        this.input.keyboard.off('keydown');
        this._persistPartyHp();

        let result;
        if (won) {
            playVictory();
            const xpGained   = _combatants.filter(c => c.isEnemy).reduce((s, e) => s + (e.xpReward || 0), 0);
            const goldGained = _combatants.filter(c => c.isEnemy).reduce((s, e) => s + (e.goldReward || 0), 0);
            const loot = [];
            for (const e of _combatants.filter(c => c.isEnemy)) {
                loot.push(...rollLoot(e.loot || []));
            }
            state.addXP(xpGained);
            state.addGold(goldGained);
            for (const id of loot) state.addItem({ id, qty: 1 });
            if (this._isFinalBoss) state.completeQuest('echoes_end');
            this._log = `Victory! +${xpGained} XP, +${goldGained} gold.`;
            result = { won: true, fled: false, xpGained, goldGained, loot, isFinalBoss: this._isFinalBoss };
        } else if (fled) {
            this._log = 'Fled from battle.';
            result = { won: false, fled: true };
        } else {
            playGameOver();
            this._log = 'The party has been defeated...';
            result = { won: false, fled: false };
        }

        this._refresh();

        this.time.delayedCall(1500, () => {
            events.emit('battleEnd', result);
            state.isPaused = false;
            this.scene.stop('BattleScene');
            this.scene.resume(_callerScene);
        });
    }

    shutdown() {
        this.input.keyboard.off('keydown');
    }
}
