/**
 * SplashScene — title screen with an animated tunnel preview behind the title.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';
import { TunnelRenderer } from './TunnelRenderer.js';
import { viewport } from './viewport.js';

function hex(intColor) { return '#' + intColor.toString(16).padStart(6, '0'); }

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = viewport.width / 2;
        const CY = viewport.height / 2;

        this.tunnel = new TunnelRenderer(this);
        this._demoSpeed = 0.5;

        this.add.text(CX, CY - 180, 'N2 OVERDRIVE', {
            fontSize: '58px', color: hex(COLORS.accent), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        this.add.text(CX, CY - 130, 'a tube-shooter tribute', {
            fontSize: '14px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(10).setAlpha(0.7);

        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        this._prompt = this.add.text(CX, CY + 40, isTouch ? 'TAP TO START' : 'PRESS ANY KEY OR CLICK TO START', {
            fontSize: '18px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(10);

        const controlsText = isTouch
            ? 'LEFT / RIGHT TO STEER — AUTO-FIRE WHILE STEERING — TAP FIRE BUTTON'
            : 'ARROWS OR A/D TO STEER — SPACE TO FIRE — SHOOT MUSHROOMS TO RIPEN THEM FOR SHIELDS';
        this.add.text(CX, CY + 90, controlsText, {
            fontSize: '11px', color: hex(COLORS.text), fontFamily: 'monospace', align: 'center',
            wordWrap: { width: Math.min(640, viewport.width - 40) },
        }).setOrigin(0.5).setDepth(10).setAlpha(0.55);

        this.add.text(viewport.width - 10, viewport.height - 10, 'v1.0', {
            fontSize: '10px', color: hex(0x323250), fontFamily: 'monospace',
        }).setOrigin(1, 1).setDepth(10);

        this._started = false;
        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            this._goToGame();
        });
        this.input.on('pointerdown', () => this._goToGame());

        this._blinkTimer = 0;
    }

    update(time, delta) {
        const dt = delta / 1000;
        this._demoSpeed = Math.min(1.1, this._demoSpeed + dt * 0.02);
        this.tunnel.update(dt, this._demoSpeed);

        this._blinkTimer += dt;
        const alpha = (Math.sin(this._blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(alpha);
    }

    _goToGame() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
        this.scene.stop('SplashScene');
    }
}
