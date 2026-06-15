/**
 * SplashScene — apothecary title screen (game-plan §Other screens).
 * Waits for any key / click, then starts GameScene + UIScene.
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';

function hex(arr)      { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

export class SplashScene extends Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;

        // Faint lattice motif behind the title.
        this._drawLatticeMotif();

        // Glow behind title
        const glow = this.add.graphics();
        glow.fillStyle(toHexInt(COLORS.gold), 0.07);
        glow.fillEllipse(CX, CY - 70, 760, 200);

        // Title
        this.add.text(CX + 3, CY - 96, "ALCHEMIST'S", {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a120a',
        }).setOrigin(0.5);
        this.add.text(CX, CY - 100, "ALCHEMIST'S", {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.gold), stroke: hex(COLORS.brass), strokeThickness: 2,
        }).setOrigin(0.5);

        this.add.text(CX + 3, CY - 28, 'LATTICE', {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold', color: '#0a1410',
        }).setOrigin(0.5);
        this.add.text(CX, CY - 32, 'LATTICE', {
            fontSize: '68px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(COLORS.parchment), stroke: hex(COLORS.brass), strokeThickness: 2,
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(CX, CY + 28, 'PLACE  •  CLEAR  •  TRANSMUTE', {
            fontSize: '14px', fontFamily: 'monospace', color: hex(COLORS.brass), letterSpacing: 4,
        }).setOrigin(0.5);

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 92, 'PRESS ANY KEY OR CLICK TO BEGIN', {
            fontSize: '16px', fontFamily: 'monospace', color: hex(COLORS.text),
        }).setOrigin(0.5);

        // Controls hint
        this.add.text(CX, CY + 140,
            'DRAG a shape from the tray onto the lattice  •  fill a row or column to clear it', {
            fontSize: '11px', fontFamily: 'monospace', color: hex(COLORS.textDim),
        }).setOrigin(0.5);

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 1', {
            fontSize: '10px', fontFamily: 'monospace', color: '#3a2e20',
        }).setOrigin(1, 1);

        // Input
        this._started = false;
        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            this._begin();
        });
        this.input.on('pointerdown', () => this._begin());

        this._t = 0;
    }

    update(time, delta) {
        this._t += delta / 1000;
        const a = (Math.sin(this._t * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(a);
    }

    _drawLatticeMotif() {
        const g = this.add.graphics();
        const size = 56, cols = Math.ceil(GAME_WIDTH / size), rows = Math.ceil(GAME_HEIGHT / size);
        g.lineStyle(1, toHexInt(COLORS.panelEdge), 0.06);
        for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * size, 0); g.lineTo(i * size, GAME_HEIGHT); g.strokePath(); }
        for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, j * size); g.lineTo(GAME_WIDTH, j * size); g.strokePath(); }
    }

    _begin() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
        this.scene.stop('SplashScene');
    }
}
