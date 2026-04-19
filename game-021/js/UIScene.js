/**
 * UIScene — HUD overlay, runs in parallel with GameScene.
 *
 * Displays:
 *   - Player HP bar and stats (top-left of viewport)
 *   - Floor number
 *   - Combat overlay (when in combat)
 *   - Message log (bottom of viewport)
 *   - Game-over and victory screens
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, VIEW_WIDTH, VIEW_HEIGHT, MAP_PANEL_X, MAP_PANEL_WIDTH } from './config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const HUD_BG   = 'rgba(0,0,0,0.55)';
const LOG_LINES = 5;

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._buildHUD();
        this._buildCombatPanel();
        this._buildLog();
        this._subscribeEvents();
        this._refresh();
    }

    // -------------------------------------------------------
    // HUD (left panel header bar)
    // -------------------------------------------------------

    _buildHUD() {
        // Background strip
        this._hudBg = this.add.rectangle(0, 0, VIEW_WIDTH, 54, 0x000000, 0.6)
            .setOrigin(0, 0);

        // HP label
        this._hpLabel = this.add.text(10, 8, '', {
            fontSize: '14px', color: hex(COLORS.success), fontFamily: 'monospace',
        });

        // HP bar background
        this._hpBarBg = this.add.rectangle(10, 28, 200, 12, 0x202020).setOrigin(0, 0);
        this._hpBar   = this.add.rectangle(10, 28, 200, 12, 0x40dc60).setOrigin(0, 0);

        // Stats
        this._statsLabel = this.add.text(220, 8, '', {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
        });

        // Status effects row
        this._statusLabel = this.add.text(220, 28, '', {
            fontSize: '11px', color: '#40ff40', fontFamily: 'monospace',
        });

        // Floor
        this._floorLabel = this.add.text(VIEW_WIDTH - 10, 8, '', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(1, 0);

        // Gold
        this._goldLabel = this.add.text(VIEW_WIDTH - 10, 28, '', {
            fontSize: '13px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(1, 0);
    }

    _buildCombatPanel() {
        // Shown only when in combat
        this._combatPanel = this.add.container(10, 60).setVisible(false);

        const bg = this.add.rectangle(0, 0, 360, 80, 0x1a0010, 0.9).setOrigin(0, 0);
        this._combatTitle = this.add.text(8, 6, '', {
            fontSize: '14px', color: hex(COLORS.danger), fontFamily: 'monospace',
        });
        this._combatHpBar = this.add.rectangle(8, 28, 200, 10, 0xdc4040).setOrigin(0, 0);
        this._combatHpBg  = this.add.rectangle(8, 28, 200, 10, 0x202020).setOrigin(0, 0);
        this._combatStats = this.add.text(8, 44, '', {
            fontSize: '12px', color: '#c8a0a0', fontFamily: 'monospace',
        });
        this._combatHint = this.add.text(8, 60, 'Space — Attack', {
            fontSize: '11px', color: '#806060', fontFamily: 'monospace',
        });

        // Draw HP bar on top of bg
        this._combatPanel.add([bg, this._combatHpBg, this._combatHpBar,
                               this._combatTitle, this._combatStats, this._combatHint]);
    }

    _buildLog() {
        // Message log strip at bottom of 3D view
        const logY = VIEW_HEIGHT - LOG_LINES * 18 - 8;
        this._logBg = this.add.rectangle(0, logY - 4, VIEW_WIDTH, LOG_LINES * 18 + 12, 0x000000, 0.5)
            .setOrigin(0, 0);

        this._logLabels = [];
        for (let i = 0; i < LOG_LINES; i++) {
            this._logLabels.push(this.add.text(8, logY + i * 18, '', {
                fontSize: '12px',
                color: i === 0 ? hex(COLORS.text) : '#606080',
                fontFamily: 'monospace',
            }));
        }
    }

    // -------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------

    _subscribeEvents() {
        this._offs = [
            events.on('playerMoved',  ()  => this._refresh()),
            events.on('floorChanged', ()  => this._refresh()),
            events.on('combatStart',  ({enemy}) => this._showCombat(enemy)),
            events.on('combatEnd',    ()  => this._hideCombat()),
            events.on('enemyDied',    ()  => this._hideCombat()),
            events.on('playerAttacked', () => this._refreshCombat()),
            events.on('enemyAttacked',  () => { this._refresh(); if (state.inCombat) this._refreshCombat(); }),
            events.on('logMessage',   (t) => this._updateLog()),
            events.on('gameOver',     ()  => this._showGameOver()),
            events.on('gameWon',      ()  => this._showVictory()),
            events.on('itemPickedUp', ()  => this._refresh()),
        ];
    }

    // -------------------------------------------------------
    // Refresh helpers
    // -------------------------------------------------------

    _refresh() {
        // HP bar
        const hpPct = Math.max(0, state.playerHp / state.playerMaxHp);
        this._hpLabel.setText(`HP  ${state.playerHp} / ${state.playerMaxHp}`);
        this._hpBar.width = Math.floor(200 * hpPct);
        // colour shift red when low
        const barColor = hpPct > 0.5 ? 0x40dc60 : hpPct > 0.25 ? 0xdcdc40 : 0xdc4040;
        this._hpBar.setFillStyle(barColor);

        // Stats
        this._statsLabel.setText(
            `LV ${state._playerLevel}  ATK ${state._playerAtk}  DEF ${state._playerDef}  XP ${state._playerXp}/${state._xpToNext}`
        );

        // Floor + gold
        this._floorLabel.setText(`Floor ${state.floor}`);
        this._goldLabel.setText(`Gold ${state.gold}`);

        // Status effects
        const effects = [];
        if (state.poisonTurns > 0) effects.push(`POISON(${state.poisonTurns})`);
        if (state.stunTurns   > 0) effects.push(`STUN(${state.stunTurns})`);
        this._statusLabel.setText(effects.join('  '));

        this._updateLog();
    }

    _updateLog() {
        for (let i = 0; i < LOG_LINES; i++) {
            this._logLabels[i].setText(state.log[i] || '');
        }
    }

    // -------------------------------------------------------
    // Combat panel
    // -------------------------------------------------------

    _showCombat(enemy) {
        this._currentEnemy = enemy;
        this._combatPanel.setVisible(true);
        this._refreshCombat();
    }

    _refreshCombat() {
        const e = this._currentEnemy;
        if (!e) return;
        this._combatTitle.setText(`Fighting: ${e.type}`);
        const hpPct = Math.max(0, e.hp / e.maxHp);
        this._combatHpBar.width = Math.floor(200 * hpPct);
        this._combatStats.setText(`HP ${e.hp}/${e.maxHp}  ATK ${e.atk}`);
    }

    _hideCombat() {
        this._combatPanel.setVisible(false);
        this._currentEnemy = null;
    }

    // -------------------------------------------------------
    // Game-over / victory
    // -------------------------------------------------------

    _showGameOver() {
        const CX = VIEW_WIDTH / 2;
        const CY = VIEW_HEIGHT / 2;

        this.add.rectangle(CX, CY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.75).setOrigin(0.5);

        this.add.text(CX, CY - 60, 'YOU DIED', {
            fontSize: '64px', color: hex(COLORS.danger),
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX, CY + 10, `Floor ${state.floor}  |  Score ${state.score}`, {
            fontSize: '22px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 60, 'Press R to restart  |  Escape for menu', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    _showVictory() {
        const CX = VIEW_WIDTH / 2;
        const CY = VIEW_HEIGHT / 2;

        this.add.rectangle(CX, CY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.75).setOrigin(0.5);

        this.add.text(CX, CY - 60, 'VICTORY!', {
            fontSize: '64px', color: hex(COLORS.gold),
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX, CY + 10, `All ${state.floor} floors conquered!  Score ${state.score}`, {
            fontSize: '20px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 60, 'Press R to play again', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    shutdown() {
        if (this._offs) this._offs.forEach(off => off());
    }
}
