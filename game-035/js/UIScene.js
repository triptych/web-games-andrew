/**
 * UIScene — HUD overlay, runs in parallel with GameScene.
 * Score, multiplier, shields, speed meter, bonus-star meter, game-over panel.
 * Reads live viewport.js dimensions and repositions on resize so the HUD
 * stays pinned to the actual screen edges on any device.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { events } from './events.js';
import { state } from './state.js';
import { COLORS, HUD_MARGIN, STARS_FOR_BONUS_ROUND, MAX_FORWARD_SPEED, BASE_FORWARD_SPEED } from './config.js';
import { viewport } from './viewport.js';

function hex(intColor) {
    return '#' + intColor.toString(16).padStart(6, '0');
}

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._offs = [];

        // Score — top-left
        this.scoreLabel = this.add.text(HUD_MARGIN, HUD_MARGIN, `SCORE ${state.score}`, {
            fontSize: '22px', color: hex(COLORS.text), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0).setDepth(200);

        this.multLabel = this.add.text(HUD_MARGIN, HUD_MARGIN + 28, `x${state.multiplier}`, {
            fontSize: '16px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(0, 0).setDepth(200);

        // Shields — top-right, drawn as pips
        this.shieldLabel = this.add.text(0, HUD_MARGIN, '', {
            fontSize: '20px', color: hex(COLORS.shieldRing), fontFamily: 'monospace', align: 'right',
        }).setOrigin(1, 0).setDepth(200);

        // Stars meter — below shields
        this.starsLabel = this.add.text(0, HUD_MARGIN + 28, '', {
            fontSize: '16px', color: hex(COLORS.gold), fontFamily: 'monospace', align: 'right',
        }).setOrigin(1, 0).setDepth(200);

        // Speed meter bar — bottom center-ish, subtle
        this.speedBarBg = this.add.rectangle(0, 0, 200, 8, 0x222233).setDepth(200);
        this.speedBarFg = this.add.rectangle(0, 0, 4, 8, COLORS.accent).setOrigin(0, 0.5).setDepth(201);
        this.speedLabel = this.add.text(0, 0, 'SPEED', {
            fontSize: '11px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(200);

        this._layoutHud();
        this._renderShields();
        this._renderStars();

        this._offs.push(
            events.on('scoreChanged', (v) => this.scoreLabel.setText(`SCORE ${v}`)),
            events.on('multiplierChanged', (v) => this.multLabel.setText(`x${v}`)),
            events.on('shieldsChanged', () => this._renderShields()),
            events.on('starsChanged', () => this._renderStars()),
            events.on('speedChanged', (v) => this._renderSpeed(v)),
            events.on('gameOver', () => this._showGameOver()),
            events.on('bonusRoundStart', () => this._showBonusBanner('BONUS ROUND!')),
            events.on('bonusRoundEnd', (bonus) => this._showBonusBanner(`+${bonus} BONUS!`)),
        );

        this._onResize = () => this._layoutHud();
        this.scale.on('resize', this._onResize);

        this.events.on('shutdown', () => {
            this._offs.forEach(off => off());
            this.scale.off('resize', this._onResize);
        });
    }

    _layoutHud() {
        const w = viewport.width;
        const h = viewport.height;
        this.shieldLabel.setPosition(w - HUD_MARGIN, HUD_MARGIN);
        this.starsLabel.setPosition(w - HUD_MARGIN, HUD_MARGIN + 28);
        this.speedBarBg.setPosition(w / 2, h - 18);
        this.speedBarFg.setPosition(w / 2 - 100, h - 18);
        this.speedLabel.setPosition(w / 2, h - 34);
    }

    _renderShields() {
        this.shieldLabel.setText('◆'.repeat(state.shields) + '◇'.repeat(Math.max(0, 3 - state.shields)));
    }

    _renderStars() {
        this.starsLabel.setText('★'.repeat(state.stars) + '☆'.repeat(STARS_FOR_BONUS_ROUND - state.stars));
    }

    _renderSpeed(v) {
        const t = Phaser.Math.Clamp((v - BASE_FORWARD_SPEED) / (MAX_FORWARD_SPEED - BASE_FORWARD_SPEED), 0, 1);
        this.speedBarFg.width = 4 + 196 * t;
    }

    _showBonusBanner(text) {
        const banner = this.add.text(viewport.width / 2, viewport.height / 2 - 160, text, {
            fontSize: '28px', color: hex(COLORS.gold), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(210).setAlpha(0);

        this.tweens.add({
            targets: banner, alpha: 1, y: banner.y - 20, duration: 300, yoyo: true, hold: 900,
            onComplete: () => banner.destroy(),
        });
    }

    _showGameOver() {
        const CX = viewport.width / 2;
        const CY = viewport.height / 2;

        this.add.rectangle(CX, CY, viewport.width, viewport.height, 0x000000, 0.65).setDepth(220);

        this.add.text(CX, CY - 60, 'SHIELDS DOWN', {
            fontSize: '46px', color: hex(COLORS.danger), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(221);

        this.add.text(CX, CY, `FINAL SCORE  ${state.score}`, {
            fontSize: '22px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(221);

        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.add.text(CX, CY + 50, isTouch ? 'TAP TO RESTART' : 'PRESS R TO RESTART  |  ESC FOR MENU', {
            fontSize: '15px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(221);

        if (isTouch) {
            const zone = this.add.zone(CX, CY, viewport.width, viewport.height).setInteractive().setDepth(222);
            zone.once('pointerdown', () => {
                events.clearAll();
                this.scene.get('GameScene').scene.restart();
                this.scene.restart();
            });
        }
    }
}
