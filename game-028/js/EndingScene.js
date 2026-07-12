/**
 * EndingScene — Victory cutscene after defeating the Lich of Aethermoor.
 * Shows closing narration and credits, then returns to SplashScene.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state } from './state.js';
import { playVictory } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const ENDING_LINES = [
    'The Lich of Aethermoor falls, its crown drained of every echo of power.',
    'The seals that once bound Vaelthas crumble to dust, and for the first',
    'time in centuries, the Aether above the ruins grows still.',
    '',
    'Lyra kneels among the wreckage, the prophecy scroll open in her hands.',
    'She was never meant to destroy the Lich — only to choose whether the',
    'world would forget him, or remember. She chooses to remember.',
    '',
    'Thornhaven rebuilds. The Thornwood breathes easier. And somewhere in',
    'the quiet after, four unlikely companions who found each other in the',
    'dark decide that the road ahead is worth walking together.',
];

export class EndingScene extends Phaser.Scene {
    constructor() { super({ key: 'EndingScene' }); }

    create() {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;

        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x05030c);

        for (let i = 0; i < 60; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT);
            const alpha = Phaser.Math.FloatBetween(0.15, 0.6);
            this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, alpha);
        }

        playVictory();

        this.add.text(CX, 90, 'Echoes of Aethermoor', {
            fontSize: '36px', color: hex(COLORS.gold), fontFamily: 'Georgia, serif', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(CX, 135, 'VICTORY', {
            fontSize: '18px', color: hex(COLORS.accent), fontFamily: 'monospace', letterSpacing: 4,
        }).setOrigin(0.5);

        this.add.text(CX, CY - 30, ENDING_LINES, {
            fontSize: '16px', color: hex(COLORS.text), fontFamily: 'Georgia, serif', fontStyle: 'italic',
            align: 'center', lineSpacing: 8,
        }).setOrigin(0.5);

        this.add.text(CX, GAME_HEIGHT - 130, `Final Level: ${state.level}   |   Gold Earned: ${state.gold}   |   Party: ${state.party.length}`, {
            fontSize: '14px', color: hex(COLORS.muted), fontFamily: 'monospace',
        }).setOrigin(0.5);

        this._prompt = this.add.text(CX, GAME_HEIGHT - 70, 'PRESS ANY KEY TO RETURN TO TITLE', {
            fontSize: '14px', color: hex(COLORS.accent), fontFamily: 'monospace', letterSpacing: 2,
        }).setOrigin(0.5);

        this._blinkTimer = 0;
        this._canExit = false;
        this.time.delayedCall(1500, () => { this._canExit = true; });

        this.input.keyboard.on('keydown', () => this._toTitle());
        this.input.on('pointerdown', () => this._toTitle());
    }

    update(time, delta) {
        this._blinkTimer += delta / 1000;
        const alpha = (Math.sin(this._blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(alpha);
    }

    _toTitle() {
        if (!this._canExit) return;
        state.reset();
        this.scene.start('SplashScene');
    }
}
