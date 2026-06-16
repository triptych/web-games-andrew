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
        this._offs.push(events.on('levelStarted', (d) => this._setObjective(d.objectiveLabel, null, null)));
        this._offs.push(events.on('objectiveProgress', (d) => this._setObjective(null, d.cur, d.target)));
        this._offs.push(events.on('objectiveMet', () => this._setObjectiveMet()));

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
