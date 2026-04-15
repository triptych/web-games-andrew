/**
 * SplashScene — Synthwave title screen with animated grid and scanlines.
 * Waits for any key or pointer click, then starts GameScene + UIScene.
 */

import { Scene, Math as PhaserMath } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

export class SplashScene extends Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // --- Synthwave perspective grid background ---
        this._drawGrid();

        // Scanline overlay
        this._drawScanlines();

        // Glow behind title
        const glow = this.add.graphics();
        glow.fillStyle(toHexInt(COLORS.accent), 0.08);
        glow.fillEllipse(CX, CY - 90, 700, 200);

        // Title shadow
        this.add.text(CX + 4, CY - 96, 'SYNTHWAVE', {
            fontSize: '72px',
            color: '#330022',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(CX + 4, CY - 28, 'BREAKOUT', {
            fontSize: '72px',
            color: '#001133',
            fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // Title text
        this.add.text(CX, CY - 100, 'SYNTHWAVE', {
            fontSize: '72px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: hex(COLORS.accent3),
            strokeThickness: 3,
        }).setOrigin(0.5);
        this.add.text(CX, CY - 32, 'BREAKOUT', {
            fontSize: '72px',
            color: hex(COLORS.accent2),
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: hex(COLORS.accent3),
            strokeThickness: 3,
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(CX, CY + 30, 'NEON  •  FAST  •  EXPLOSIVE', {
            fontSize: '14px',
            color: hex(COLORS.accent3),
            fontFamily: 'monospace',
            letterSpacing: 4,
        }).setOrigin(0.5);

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 90, 'PRESS ANY KEY OR CLICK TO START', {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Controls hint
        this.add.text(CX, CY + 140, 'MOUSE / LEFT-RIGHT ARROWS to move paddle   •   P to pause   •   M to mute', {
            fontSize: '11px',
            color: '#606080',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 1', {
            fontSize: '10px',
            color: '#282840',
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

        // Floating brick preview particles
        this._spawnDecoBricks();
    }

    update(time, delta) {
        this._blinkTimer += delta / 1000;
        const alpha = (Math.sin(this._blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(alpha);
    }

    _drawGrid() {
        const g = this.add.graphics();
        const horizon = GAME_HEIGHT * 0.72;
        const lineColor = toHexInt(COLORS.grid);

        // Horizontal lines (perspective foreshortening)
        const hLines = 12;
        for (let i = 0; i <= hLines; i++) {
            const t = i / hLines;
            const curve = Math.pow(t, 2.2);
            const y = horizon + (GAME_HEIGHT - horizon) * curve;
            const alpha = 0.15 + 0.35 * t;
            g.lineStyle(1, lineColor, alpha);
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(GAME_WIDTH, y);
            g.strokePath();
        }

        // Vertical lines converging to vanishing point
        const vLines = 20;
        const vx = GAME_WIDTH / 2;
        for (let i = 0; i <= vLines; i++) {
            const t = i / vLines;
            const bottomX = t * GAME_WIDTH;
            const alpha = 0.08 + 0.2 * Math.abs(t - 0.5) * 2;
            g.lineStyle(1, lineColor, alpha);
            g.beginPath();
            g.moveTo(vx + (bottomX - vx) * 0.01, horizon);
            g.lineTo(bottomX, GAME_HEIGHT);
            g.strokePath();
        }

        // Sun / horizon glow strip
        const sunGrad = this.add.graphics();
        sunGrad.fillStyle(toHexInt(COLORS.accent), 0.18);
        sunGrad.fillRect(0, horizon - 2, GAME_WIDTH, 4);
        sunGrad.fillStyle(toHexInt(COLORS.accent3), 0.1);
        sunGrad.fillRect(0, horizon - 8, GAME_WIDTH, 6);
        sunGrad.fillStyle(toHexInt(COLORS.accent2), 0.06);
        sunGrad.fillRect(0, horizon - 18, GAME_WIDTH, 10);

        // Dark upper area gradient feel
        const sky = this.add.graphics();
        sky.fillStyle(0x000000, 0.55);
        sky.fillRect(0, 0, GAME_WIDTH, horizon);
    }

    _drawScanlines() {
        const g = this.add.graphics();
        g.lineStyle(1, 0x000000, 0.12);
        for (let y = 0; y < GAME_HEIGHT; y += 3) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(GAME_WIDTH, y);
            g.strokePath();
        }
    }

    _spawnDecoBricks() {
        const brickColors = [
            toHexInt(COLORS.accent),
            toHexInt(COLORS.accent2),
            toHexInt(COLORS.accent3),
            toHexInt(COLORS.gold),
        ];
        this._decoBricks = [];
        for (let i = 0; i < 8; i++) {
            const x = PhaserMath.Between(80, GAME_WIDTH - 80);
            const y = PhaserMath.Between(-60, -10);
            const col = brickColors[i % brickColors.length];
            const g = this.add.graphics();
            g.fillStyle(col, 0.7);
            g.fillRoundedRect(-34, -10, 68, 20, 3);
            g.lineStyle(1, 0xffffff, 0.3);
            g.strokeRoundedRect(-34, -10, 68, 20, 3);
            g.x = x;
            g.y = y;
            this._decoBricks.push({
                obj: g,
                vy: PhaserMath.FloatBetween(30, 80),
                vx: PhaserMath.FloatBetween(-20, 20),
            });
        }
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
