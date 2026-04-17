/**
 * SplashScene — Title screen.
 * Waits for any key or pointer click, then starts GameScene + UIScene.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Dark background
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14);

        // Decorative border
        const gfx = this.add.graphics();
        gfx.lineStyle(2, 0x3264c8, 1);
        gfx.strokeRect(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40);
        gfx.lineStyle(1, 0x1e3c78, 1);
        gfx.strokeRect(28, 28, GAME_WIDTH - 56, GAME_HEIGHT - 56);

        // Title
        this.add.text(CX, CY - 160, 'DUNGEON', {
            fontSize: '80px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX, CY - 80, 'BLOBBER', {
            fontSize: '80px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX, CY, 'A 3D First-Person Dungeon Crawler', {
            fontSize: '18px',
            color: '#a0a0c8',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 70, 'PRESS ANY KEY OR CLICK TO BEGIN', {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Controls hint
        const controls = [
            'W / Up Arrow — Move Forward   S / Down Arrow — Move Backward',
            'A / Left Arrow — Turn Left    D / Right Arrow — Turn Right',
            'Space — Attack   I — Inventory   M — Toggle Map   Escape — Menu',
        ];
        controls.forEach((line, i) => {
            this.add.text(CX, CY + 150 + i * 22, line, {
                fontSize: '13px',
                color: '#606080',
                fontFamily: 'monospace',
            }).setOrigin(0.5);
        });

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 1', {
            fontSize: '10px',
            color: '#323250',
            fontFamily: 'monospace',
        }).setOrigin(1, 1);

        // Input
        this._started = false;
        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            this._goToGame();
        });
        this.input.on('pointerdown', () => this._goToGame());

        this._blinkTimer = 0;
    }

    update(time, delta) {
        this._blinkTimer += delta / 1000;
        const alpha = (Math.sin(this._blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(alpha);
    }

    _goToGame() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        this.scene.start('GameScene');
        this.scene.start('UIScene');
        this.scene.stop('SplashScene');
    }
}
