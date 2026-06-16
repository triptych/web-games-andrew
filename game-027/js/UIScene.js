/**
 * UIScene — HUD overlay (game-plan §UI, exploration base layout, Phase 1 subset).
 * Runs in parallel with GameScene. Listens on the EventBus for live updates.
 *
 * Phase 1 panels: top bar (title), SUPPLY (remaining count), SCORE (score +
 * combo/streak), and a jam-risk warning when a held shape is nearly stuck.
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, PANEL_X, PANEL_W, COLORS, SUPPLY_TILES, ELEMENTS } from './config.js';
import { events } from './events.js';
import { state } from './state.js';

function hex(arr)      { return '#' + arr.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const ELEM = {};
for (const e of ELEMENTS) ELEM[e.id] = e;

export class UIScene extends Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._offs = [];

        // Top bar — title and live objective
        this.add.text(24, 18, "⚗  ALCHEMIST'S LATTICE", {
            fontSize: '20px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.gold),
        });
        this._objectiveTxt = this.add.text(GAME_WIDTH - 24, 22, 'OBJECTIVE: —', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(1, 0);
        this._objectiveProgressTxt = this.add.text(GAME_WIDTH - 24, 40, '', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.brass),
        }).setOrigin(1, 0);

        // Right-rail panel frame
        this._panel(PANEL_X - 14, 70, PANEL_W + 28, 470);

        // SUPPLY panel
        this.add.text(PANEL_X, 84, '═══ SUPPLY ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._supplyText = this.add.text(PANEL_X, 110, '', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.text),
        });

        // HARVESTED panel (§5 — elements pulled from deposits this level)
        this.add.text(PANEL_X, 166, '═══ HARVESTED ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        // One line per element (always listed so +0 dims, §UI), built once.
        this._harvestLines = {};
        ELEMENTS.forEach((e, i) => {
            this._harvestLines[e.id] = this.add.text(PANEL_X, 192 + i * 22,
                `${e.glyph} ${e.name.padEnd(7)} +0`, {
                fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            });
        });

        // SCORE panel
        const scoreY = 192 + ELEMENTS.length * 22 + 16;
        this.add.text(PANEL_X, scoreY, '═══ SCORE ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._scoreText = this.add.text(PANEL_X, scoreY + 26, '0', {
            fontSize: '34px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.gold),
        });
        this._comboText = this.add.text(PANEL_X, scoreY + 72, '', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.text),
        });
        this._streakText = this.add.text(PANEL_X, scoreY + 96, '', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });

        // Jam-risk warning (hidden until triggered)
        this._warnText = this.add.text(PANEL_X, scoreY + 130, '', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.danger), wordWrap: { width: PANEL_W },
        });

        // Controls hint
        this.add.text(24, GAME_HEIGHT - 22, 'DRAG onto lattice   •   C — cauldron   •   R — restart   •   Esc — save & title', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });

        // --- Phase 5 overlay panels (refinement / battle) ---
        // These are built lazily when the levelStarted event carries the levelType.
        this._refinePanel = null;
        this._battlePanel = null;

        // --- live bindings ---
        this._displayScore = 0;
        this._setSupply(SUPPLY_TILES);

        this._offs.push(events.on('scoreChanged',  (s) => this._targetScore = s));
        this._offs.push(events.on('supplyChanged', (d) => this._setSupply(d.remaining)));
        this._offs.push(events.on('comboChanged',  (d) => this._setCombo(d.combo)));
        this._offs.push(events.on('streakChanged', (d) => this._setStreak(d.streak)));
        this._offs.push(events.on('shapeNearlyStuck', (d) => this._setWarn(d.legalSpots)));
        this._offs.push(events.on('storesChanged', (d) => this._setHarvested(d.elementId, d.qty)));
        this._offs.push(events.on('tooltipShow', (d) => this._showTooltip(d)));
        this._offs.push(events.on('tooltipHide', ()  => this._hideTooltip()));
        this._offs.push(events.on('levelStarted', (d) => {
            this._setObjective(d.objectiveLabel, null, null);
            this._buildOverlayForType(d.levelType, d.levelDef);
        }));
        this._offs.push(events.on('objectiveProgress', (d) => this._setObjective(null, d.cur, d.target)));
        this._offs.push(events.on('objectiveMet', () => this._setObjectiveMet()));

        // Refinement events.
        this._offs.push(events.on('qualityChanged',          (d) => this._refinePanel && this._refinePanel.onQualityChanged(d)));
        this._offs.push(events.on('recipeConditionsUpdated',  (d) => this._refinePanel && this._refinePanel.onConditionsUpdated(d)));
        this._offs.push(events.on('recipeConditionMet',       (d) => this._refinePanel && this._refinePanel.onConditionMet(d)));

        // Battle events.
        this._offs.push(events.on('battleStateChanged', (d) => this._battlePanel && this._battlePanel.onStateChanged(d)));

        // Tooltip objects — created once, shown/hidden as needed
        this._tooltipBg  = this.add.graphics();
        this._tooltipTxt = this.add.text(0, 0, '', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.text),
            padding: { x: 8, y: 6 }, lineSpacing: 3,
        });
        this._tooltipBg.setVisible(false);
        this._tooltipTxt.setVisible(false);

        this._targetScore   = state.score;
        this._objectiveLabel = '';

        this.events.on('shutdown', () => { this._offs.forEach(off => off()); this._offs = []; });
    }

    _buildOverlayForType(levelType, levelDef) {
        // For non-exploration types, hide the standard supply/harvested panels so
        // the overlay can use that space.
        if (levelType === 'refine' || levelType === 'battle') {
            this._supplyText.setVisible(false);
            Object.values(this._harvestLines).forEach(t => t.setVisible(false));
        }
        if (levelType === 'refine' && levelDef && levelDef.recipe) {
            this._refinePanel = new RefinementHUD(this, levelDef.recipe);
        }
        if (levelType === 'battle') {
            this._battlePanel = new BattleHUD(this);
        }
    }

    update() {
        // Score counts up rather than snapping (§UI motion).
        if (this._displayScore !== this._targetScore) {
            const diff = this._targetScore - this._displayScore;
            const step = Math.max(1, Math.ceil(Math.abs(diff) / 6)) * Math.sign(diff);
            this._displayScore += step;
            if (Math.sign(this._targetScore - this._displayScore) !== Math.sign(diff)) {
                this._displayScore = this._targetScore;
            }
            this._scoreText.setText(String(this._displayScore));
        }
    }

    _panel(x, y, w, h) {
        const g = this.add.graphics();
        g.fillStyle(toHexInt(COLORS.panel), 0.92);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(2, toHexInt(COLORS.panelEdge), 0.8);
        g.strokeRoundedRect(x, y, w, h, 8);
    }

    _setSupply(remaining) {
        const sets = Math.ceil(remaining / 3);
        this._supplyText.setText(`✦  ${remaining} tiles left\n   (${sets} set${sets === 1 ? '' : 's'} remaining)`);
    }

    _setHarvested(elementId, qty) {
        const line = this._harvestLines[elementId];
        if (!line) return;
        const e = ELEM[elementId];
        line.setText(`${e.glyph} ${e.name.padEnd(7)} +${qty}`);
        line.setColor(qty > 0 ? hex(e.color) : hex(COLORS.textDim));
        // brief pop to draw the eye to the new harvest (§UI feedback)
        line.setScale(1.25);
        this.tweens.add({ targets: line, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }

    _setCombo(combo) {
        this._comboText.setText(combo > 0 ? `▲ x${combo} combo` : '');
    }

    _setStreak(streak) {
        this._streakText.setText(streak > 1 ? `streak ×${streak}` : '');
    }

    _setWarn(legalSpots) {
        if (legalSpots <= 0) {
            this._warnText.setText('');
        } else if (legalSpots <= 3) {
            this._warnText.setText(`⚠ a held shape has only ${legalSpots} spot${legalSpots === 1 ? '' : 's'} left!`);
        } else {
            this._warnText.setText('');
        }
    }

    _setObjective(label, cur, target) {
        if (label !== null) {
            this._objectiveLabel = label;
            this._objectiveTxt.setText(`OBJECTIVE: ${label}`);
        }
        if (cur !== null && target !== null) {
            this._objectiveProgressTxt.setText(`${cur} / ${target}`);
        }
    }

    _setObjectiveMet() {
        this._objectiveTxt.setText('OBJECTIVE: ✓ COMPLETE!').setColor(hex(COLORS.success));
        this._objectiveProgressTxt.setText('');
    }

    _showTooltip({ x, y, label, color }) {
        const txt = this._tooltipTxt;
        txt.setText(label);
        txt.setVisible(true);
        const w = txt.width + 4, h = txt.height + 4;
        let tx = x + 16, ty = y + 16;
        if (tx + w > GAME_WIDTH) tx = x - w - 12;
        txt.setPosition(tx, ty);
        const bg = this._tooltipBg;
        bg.clear();
        bg.fillStyle(toHexInt(COLORS.panel), 0.96);
        bg.fillRoundedRect(tx - 4, ty - 4, w, h, 5);
        bg.lineStyle(1.5, toHexInt(color), 0.9);
        bg.strokeRoundedRect(tx - 4, ty - 4, w, h, 5);
        bg.setVisible(true);
    }

    _hideTooltip() {
        this._tooltipBg.setVisible(false);
        this._tooltipTxt.setVisible(false);
    }
}

// ============================================================
// RefinementHUD — right-rail overlay for refine levels (§11b)
// ============================================================
// Swaps the right rail content from supply/harvested panels to a recipe panel:
// conditions list (✓/◻/✗), quality meter, and the potion name.
// Created lazily when levelStarted carries levelType:'refine'.

class RefinementHUD {
    constructor(scene, recipe) {
        this._scene  = scene;
        this._recipe = recipe;
        const px = PANEL_X, pw = PANEL_W;

        // Potion title.
        scene.add.text(px, 84, '🜲 REFINING', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._potionName = scene.add.text(px, 104, recipe.potionId || 'Unknown Potion', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.text),
        });

        // Quality meter label + bar.
        scene.add.text(px, 130, '═══ QUALITY ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._qualityLabel  = scene.add.text(px, 150, 'CRUDE', {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.textDim),
        });
        this._qualityBarBg  = scene.add.graphics();
        this._qualityBarFg  = scene.add.graphics();
        this._drawQualityBar(0, 'crude');

        // Conditions list.
        scene.add.text(px, 190, '═══ RECIPE ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._conditionRows = [];
        const conditions = recipe.conditions || [];
        conditions.forEach((c, i) => {
            const lbl = scene.add.text(px, 212 + i * 22, `◻ ${c.label}`, {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
            });
            this._conditionRows.push(lbl);
        });
        this._conditionsMap = new Map(conditions.map(c => [c.id, { def: c, idx: conditions.indexOf(c) }]));
    }

    onQualityChanged({ grade, value }) {
        this._drawQualityBar(value, grade);
        const gradeLabel = grade.toUpperCase();
        const gradeColors = { crude: COLORS.textDim, fine: COLORS.text, pure: COLORS.gold, masterwork: [255, 200, 80] };
        const col = gradeColors[grade] || COLORS.text;
        this._qualityLabel.setText(gradeLabel).setColor(hex(col));
    }

    onConditionsUpdated({ conditions }) {
        for (const c of conditions) {
            const entry = this._conditionsMap.get(c.id);
            if (!entry) continue;
            const lbl = this._conditionRows[entry.idx];
            if (!lbl) continue;
            if (c.violated) {
                lbl.setText(`✗ ${c.def.label}`).setColor(hex(COLORS.danger));
            } else if (c.satisfied) {
                lbl.setText(`✓ ${c.def.label}`).setColor(hex(COLORS.success));
            } else {
                const prog = (c._progress != null && c.target != null)
                    ? ` (${c._progress}/${c.target})` : '';
                lbl.setText(`◻ ${c.def.label}${prog}`).setColor(hex(COLORS.textDim));
            }
        }
    }

    onConditionMet({ conditionId }) {
        const entry = this._conditionsMap.get(conditionId);
        if (!entry) return;
        const lbl = this._conditionRows[entry.idx];
        if (!lbl) return;
        lbl.setColor(hex(COLORS.success));
        // Brief scale pop.
        this._scene.tweens.add({ targets: lbl, scale: 1.2, duration: 100,
            yoyo: true, ease: 'Back.easeOut' });
    }

    _drawQualityBar(value, grade) {
        const px = PANEL_X, pw = PANEL_W;
        const barY = 168, barH = 10;
        const bg = this._qualityBarBg, fg = this._qualityBarFg;
        bg.clear(); fg.clear();
        bg.fillStyle(toHexInt(COLORS.panel), 1);
        bg.fillRoundedRect(px, barY, pw, barH, 3);
        bg.lineStyle(1, toHexInt(COLORS.panelEdge), 0.6);
        bg.strokeRoundedRect(px, barY, pw, barH, 3);
        const fillW = Math.max(2, Math.round(pw * value / 100));
        const gradeColor = { crude: COLORS.textDim, fine: COLORS.text, pure: COLORS.gold, masterwork: [255, 200, 80] };
        const col = gradeColor[grade] || COLORS.text;
        fg.fillStyle(toHexInt(col), 0.9);
        fg.fillRoundedRect(px, barY, fillW, barH, 3);
    }
}

// ============================================================
// BattleHUD — right-rail overlay for battle levels (§11c)
// ============================================================
// Adds a player HP bar at the top and a threats panel listing enemies with HP
// and a placement-countdown to the next enemy turn.

class BattleHUD {
    constructor(scene) {
        this._scene = scene;
        const px = PANEL_X, pw = PANEL_W;

        // Player HP bar.
        scene.add.text(px, 84, '❤ FOCUS', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.danger),
        });
        this._hpLabel   = scene.add.text(px + 72, 84, '-- / --', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.text),
        });
        this._hpBarBg   = scene.add.graphics();
        this._hpBarFg   = scene.add.graphics();
        this._drawHpBar(1, 1);

        // Threats panel.
        scene.add.text(px, 120, '═══ THREATS ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._threatLines  = [];
        this._turnCountTxt = scene.add.text(px, 142, '', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });

        this._enemyRowsY = 164;
        this._maxEnemyRows = 5;
        for (let i = 0; i < this._maxEnemyRows; i++) {
            const t = scene.add.text(px, this._enemyRowsY + i * 20, '', {
                fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.text),
            });
            this._threatLines.push(t);
        }
    }

    onStateChanged({ enemies, playerHp, playerMaxHp, placementsUntilTurn }) {
        this._drawHpBar(playerHp, playerMaxHp);
        this._hpLabel.setText(`${playerHp} / ${playerMaxHp}`);
        const low = playerHp / playerMaxHp < 0.25;
        this._hpLabel.setColor(low ? hex(COLORS.danger) : hex(COLORS.text));

        this._turnCountTxt.setText(
            `next enemy turn in ${placementsUntilTurn} placement${placementsUntilTurn === 1 ? '' : 's'}`
        );

        const alive = enemies.filter(e => e.hp > 0);
        for (let i = 0; i < this._maxEnemyRows; i++) {
            const e = alive[i];
            if (!e) { this._threatLines[i].setText(''); continue; }
            const bar = '▓'.repeat(Math.ceil(e.hp / e.maxHp * 6)).padEnd(6, '░');
            this._threatLines[i].setText(`👹 ${e.name} ${bar} ${e.hp}hp`);
            const ratio = e.hp / e.maxHp;
            const col = ratio > 0.5 ? COLORS.success : ratio > 0.25 ? COLORS.gold : COLORS.danger;
            this._threatLines[i].setColor(hex(col));
        }
    }

    _drawHpBar(hp, maxHp) {
        const px = PANEL_X, pw = PANEL_W;
        const barY = 100, barH = 10;
        const bg = this._hpBarBg, fg = this._hpBarFg;
        bg.clear(); fg.clear();
        bg.fillStyle(toHexInt(COLORS.panel), 1);
        bg.fillRoundedRect(px, barY, pw, barH, 3);
        bg.lineStyle(1, toHexInt(COLORS.panelEdge), 0.6);
        bg.strokeRoundedRect(px, barY, pw, barH, 3);
        const ratio = maxHp > 0 ? hp / maxHp : 0;
        const fillW = Math.max(2, Math.round(pw * ratio));
        const col = ratio > 0.5 ? COLORS.success : ratio > 0.25 ? COLORS.gold : COLORS.danger;
        fg.fillStyle(toHexInt(col), 0.9);
        fg.fillRoundedRect(px, barY, fillW, barH, 3);
    }
}
