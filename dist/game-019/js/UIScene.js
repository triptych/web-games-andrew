/**
 * UIScene — HUD overlay, runs in parallel with GameScene.
 * Shows score, lives, level, combo counter, active powerup timers.
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

export class UIScene extends Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        const topY = 10;

        // Score — top-left
        this._scoreLabel = this.add.text(14, topY, `SCORE  ${state.score}`, {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0, 0);

        // Level — top center
        this._levelLabel = this.add.text(GAME_WIDTH / 2, topY, `LEVEL ${state.level}`, {
            fontSize: '16px',
            color: hex(COLORS.accent2),
            fontFamily: 'monospace',
        }).setOrigin(0.5, 0);

        // Lives — top-right
        this._livesLabel = this.add.text(GAME_WIDTH - 14, topY, this._livesStr(), {
            fontSize: '16px',
            color: hex(COLORS.danger),
            fontFamily: 'monospace',
        }).setOrigin(1, 0);

        // Combo label (hidden by default)
        this._comboLabel = this.add.text(GAME_WIDTH / 2, 36, '', {
            fontSize: '14px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setAlpha(0);

        // Powerup status row
        this._powerupLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, '', {
            fontSize: '11px',
            color: hex(COLORS.accent3),
            fontFamily: 'monospace',
        }).setOrigin(0.5, 0);

        // Pause hint
        this.add.text(GAME_WIDTH - 14, GAME_HEIGHT - 10, 'P=Pause  R=Restart  ESC=Menu', {
            fontSize: '10px',
            color: '#303050',
            fontFamily: 'monospace',
        }).setOrigin(1, 1);

        this._comboTimer = 0;

        this._offs = [
            events.on('scoreChanged',  (v) => { this._scoreLabel.setText(`SCORE  ${v}`); }),
            events.on('livesChanged',  (v) => { this._livesLabel.setText(this._livesStr()); }),
            events.on('gameOver',      ()  => { this._showGameOver(); }),
            events.on('levelComplete', ()  => { this._showLevelComplete(); }),
            events.on('powerupCollected', (t) => { this._flashPowerup(t); }),
            events.on('brickDestroyed',   ()  => { this._updateCombo(); }),
        ];
    }

    update(time, delta) {
        const dt = delta / 1000;

        // Combo fade
        if (this._comboTimer > 0) {
            this._comboTimer -= dt;
            this._comboLabel.setAlpha(Math.min(1, this._comboTimer * 3));
        }

        // Powerup timers
        const active = [];
        if (state.activePowerups.widePaddle)  active.push('WIDE');
        if (state.activePowerups.slowBall)    active.push('SLOW');
        if (state.activePowerups.multiball)   active.push('MULTI');
        if (state.activePowerups.laserPaddle) active.push('LASER');
        this._powerupLabel.setText(active.length ? `[ ${active.join('  ') } ]` : '');

        // Level sync
        this._levelLabel.setText(`LEVEL ${state.level}`);
    }

    _livesStr() {
        return 'LIVES  ' + '♥ '.repeat(Math.max(0, state.lives)).trim();
    }

    _updateCombo() {
        const c = state.combo;
        if (c >= 2) {
            this._comboLabel.setText(`x${Math.min(c, 8)} COMBO`);
            this._comboLabel.setAlpha(1);
            this._comboTimer = 1.5;
        }
    }

    _flashPowerup(type) {
        const msgs = { wide: 'WIDE PADDLE!', slow: 'SLOW BALL!', multiball: 'MULTIBALL!', laser: 'LASER!' };
        const flash = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, msgs[type] || type.toUpperCase(), {
            fontSize: '28px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(1);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            y: GAME_HEIGHT / 2 - 100,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => flash.destroy(),
        });
    }

    _showGameOver() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        const overlay = this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0);
        this.tweens.add({ targets: overlay, fillAlpha: 0.65, duration: 400 });

        this.time.delayedCall(300, () => {
            this.add.text(CX, CY - 60, 'GAME OVER', {
                fontSize: '60px',
                color: hex(COLORS.danger),
                fontFamily: 'monospace',
                fontStyle: 'bold',
                stroke: '#ff0000',
                strokeThickness: 2,
            }).setOrigin(0.5).setDepth(300);

            this.add.text(CX, CY + 10, `FINAL SCORE:  ${state.score}`, {
                fontSize: '26px',
                color: hex(COLORS.text),
                fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(300);

            this.add.text(CX, CY + 60, `LEVEL REACHED:  ${state.level}`, {
                fontSize: '18px',
                color: hex(COLORS.accent2),
                fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(300);

            this.add.text(CX, CY + 110, 'R to restart   ESC for menu', {
                fontSize: '14px',
                color: hex(COLORS.accent),
                fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(300);
        });
    }

    _showLevelComplete() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        const msg = this.add.text(CX, CY, 'LEVEL COMPLETE!', {
            fontSize: '48px',
            color: hex(COLORS.success),
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: hex(COLORS.accent2),
            strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0).setDepth(200);

        this.tweens.add({
            targets: msg,
            alpha: 1,
            y: CY - 20,
            duration: 500,
            ease: 'Back.Out',
            yoyo: true,
            hold: 800,
            onComplete: () => msg.destroy(),
        });
    }

    shutdown() {
        this._offs.forEach(off => off());
    }
}
