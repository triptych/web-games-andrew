/**
 * SplashScene — Title screen for The River.
 *
 * Shows:
 *   - Game title and tagline
 *   - A flavor "dispatch" from the Dark Tower (randomly chosen each run)
 *   - Blinking start prompt
 *
 * Starts GameScene + UIScene on any key / click.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';
import { state } from './state.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

// Flavor dispatches from the Dark Tower — shown on the title screen each run.
// These hint at what the lord might value at dinner without being too explicit.
const TOWER_DISPATCHES = [
    "Dispatch from the Dark Tower: 'This year's feast shall celebrate the old ways of the hearth.'",
    "Dispatch from the Dark Tower: 'The lord requests music to fill the great hall's silence.'",
    "Dispatch from the Dark Tower: 'Stories of distant lands are worth more than gold at our table.'",
    "Dispatch from the Dark Tower: 'The tower's halls are bare — decoration would be most welcome.'",
    "Dispatch from the Dark Tower: 'Only the rarest of spices will impress our lord's refined palate.'",
    "Dispatch from the Dark Tower: 'A feast of river-fresh ingredients is the lord's fondest wish.'",
    "Dispatch from the Dark Tower: 'Wisdom and wit shall seat the finest guests this season.'",
    "Dispatch from the Dark Tower: 'A show of strength at the table? The lord does enjoy a spectacle.'",
];

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Background gradient suggestion (simple rect)
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x08121c);

        // Decorative river strip at bottom
        this.add.rectangle(CX, GAME_HEIGHT - 60, GAME_WIDTH, 120, 0x285a88, 0.5);

        // Title
        this.add.text(CX, CY - 140, 'THE RIVER', {
            fontSize: '72px',
            color: hex(COLORS.accent),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);

        // Tagline
        this.add.text(CX, CY - 60, 'A last adventure on the water', {
            fontSize: '20px',
            color: hex(COLORS.dusk),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);

        // Daily dispatch from the Dark Tower (random each load)
        const dispatch = TOWER_DISPATCHES[Math.floor(Math.random() * TOWER_DISPATCHES.length)];
        this.add.text(CX, CY + 20, dispatch, {
            fontSize: '14px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
            wordWrap: { width: 700 },
            align: 'center',
        }).setOrigin(0.5);

        // Controls hint
        this.add.text(CX, CY + 100, 'CLICK or ARROW KEYS to choose  •  SPACE to confirm  •  ESC for menu', {
            fontSize: '12px',
            color: '#506050',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Persistent high-score display
        const hi = state.getHighScore();
        const log = state.getScoreLog();
        if (hi > 0) {
            this.add.text(CX, CY + 130, `Best feast score: ${hi}`, {
                fontSize: '13px',
                color: hex(COLORS.gold),
                fontFamily: 'monospace',
            }).setOrigin(0.5);

            if (log.length > 0) {
                const recent = log.slice(0, 3).map(e => `${e.score} — ${e.outcomeLabel}`).join('  |  ');
                this.add.text(CX, CY + 150, recent, {
                    fontSize: '10px',
                    color: '#505060',
                    fontFamily: 'monospace',
                }).setOrigin(0.5);
            }
        }

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 178, 'PRESS ANY KEY OR CLICK TO BEGIN YOUR JOURNEY', {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 3', {
            fontSize: '10px',
            color: '#323250',
            fontFamily: 'monospace',
        }).setOrigin(1, 1);

        // Input
        this._started    = false;
        this._blinkTimer = 0;

        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            this._goToGame();
        });
        this.input.on('pointerdown', () => this._goToGame());
    }

    update(_time, delta) {
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
