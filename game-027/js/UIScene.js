/**
 * UIScene — HUD overlay (game-plan §UI, exploration base layout, Phase 1 subset).
 * Runs in parallel with GameScene. Listens on the EventBus for live updates.
 *
 * Phase 1 panels: top bar (title), SUPPLY (remaining count), SCORE (score +
 * combo/streak), and a jam-risk warning when a held shape is nearly stuck.
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, PANEL_X, PANEL_W, COLORS, SUPPLY_TILES } from './config.js';
import { events } from './events.js';
import { state } from './state.js';

function hex(arr)      { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

export class UIScene extends Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._offs = [];

        // Top bar
        this.add.text(24, 18, "⚗  ALCHEMIST'S LATTICE", {
            fontSize: '20px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.gold),
        });
        this.add.text(GAME_WIDTH - 24, 22, 'CLEAR ROWS & COLUMNS', {
            fontSize: '12px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(1, 0);

        // Right-rail panel frame
        this._panel(PANEL_X - 14, 70, PANEL_W + 28, 330);

        // SUPPLY panel
        this.add.text(PANEL_X, 84, '═══ SUPPLY ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._supplyText = this.add.text(PANEL_X, 110, '', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.text),
        });

        // SCORE panel
        this.add.text(PANEL_X, 168, '═══ SCORE ═══', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.brass),
        });
        this._scoreText = this.add.text(PANEL_X, 194, '0', {
            fontSize: '34px', fontFamily: 'monospace', fontStyle: 'bold', color: hex(COLORS.gold),
        });
        this._comboText = this.add.text(PANEL_X, 240, '', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.text),
        });
        this._streakText = this.add.text(PANEL_X, 264, '', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        });

        // Jam-risk warning (hidden until triggered)
        this._warnText = this.add.text(PANEL_X, 320, '', {
            fontSize: '13px', fontFamily: 'monospace', color: hex(COLORS.danger), wordWrap: { width: PANEL_W },
        });

        // Controls hint
        this.add.text(24, GAME_HEIGHT - 22, 'DRAG a shape onto the lattice   •   R to restart', {
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

        this._targetScore = state.score;

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
}
