/**
 * SplashScene — Title screen with story intro.
 * Waits for any key or pointer click, then starts MapScene + UIScene.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Dark background gradient effect via rectangle layers
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x080512);

        // Decorative star particles (simple dots)
        for (let i = 0; i < 80; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.8);
            this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, alpha);
        }

        // Subtitle
        this.add.text(CX, CY - 170, 'A Fantasy Visual Novel RPG', {
            fontSize: '18px',
            color: hex(COLORS.muted),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);

        // Main title
        this.add.text(CX, CY - 120, 'Echoes of Aethermoor', {
            fontSize: '64px',
            color: hex(COLORS.accent),
            fontFamily: 'Georgia, serif',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);

        // Decorative rule
        this.add.rectangle(CX, CY - 65, 600, 2, 0x6040a0, 0.6);

        // Lore blurb
        this.add.text(CX, CY + 0, [
            'The seals on the Aethermoor ruins grow weak.',
            'An ancient evil stirs in the dark.',
            'And a young mage holds the key to everything —',
            'if she can survive long enough to use it.',
        ], {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            align: 'center',
            lineSpacing: 8,
        }).setOrigin(0.5);

        // Blinking start prompt
        this._prompt = this.add.text(CX, CY + 130, 'PRESS ANY KEY OR CLICK TO BEGIN', {
            fontSize: '16px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
            letterSpacing: 2,
        }).setOrigin(0.5);

        // Controls hint
        this.add.text(CX, CY + 175, 'Arrow Keys: Move   Space/Enter: Confirm   M: Menu   Esc: Back', {
            fontSize: '12px',
            color: hex(COLORS.muted),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

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
        this.scene.start('MapScene');
        this.scene.launch('UIScene');
        this.scene.stop('SplashScene');
    }
}
