/**
 * SplashScene — Title screen with high-score table.
 * Waits for any key or pointer click, then starts GameScene + UIScene.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';
import { loadHighScores } from './storage.js';

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
        this.add.text(CX - 200, CY - 160, 'DUNGEON', {
            fontSize: '80px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX - 200, CY - 80, 'BLOBBER', {
            fontSize: '80px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(CX - 200, CY, 'A 3D First-Person Dungeon Crawler', {
            fontSize: '16px',
            color: '#a0a0c8',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Blinking prompt
        this._prompt = this.add.text(CX - 200, CY + 60, 'PRESS ANY KEY OR CLICK TO BEGIN', {
            fontSize: '15px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Controls hint
        const controls = [
            'W/Up — Forward    S/Down — Backward',
            'A/Left — Turn L   D/Right — Turn R',
            'Space — Attack    I — Inventory',
            'M — Toggle Map    Escape — Menu',
        ];
        controls.forEach((line, i) => {
            this.add.text(CX - 200, CY + 120 + i * 20, line, {
                fontSize: '12px',
                color: '#606080',
                fontFamily: 'monospace',
            }).setOrigin(0.5);
        });

        // High score panel (right side)
        this._buildHighScorePanel(CX + 220, CY - 160);

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 3', {
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

    _buildHighScorePanel(cx, topY) {
        const scores = loadHighScores();

        this.add.text(cx, topY, 'HIGH SCORES', {
            fontSize: '18px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        const gfx = this.add.graphics();
        gfx.lineStyle(1, 0x4060a0, 0.5);
        gfx.lineBetween(cx - 170, topY + 26, cx + 170, topY + 26);

        if (scores.length === 0) {
            this.add.text(cx, topY + 50, 'No scores yet.\nPlay to get on the board!', {
                fontSize: '13px',
                color: '#404060',
                fontFamily: 'monospace',
                align: 'center',
            }).setOrigin(0.5, 0);
            return;
        }

        for (let i = 0; i < Math.min(scores.length, 10); i++) {
            const entry = scores[i];
            const y     = topY + 38 + i * 26;
            const rank  = i === 0 ? hex(COLORS.gold) : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#606080';

            this.add.text(cx - 160, y, `#${i + 1}`, {
                fontSize: '13px', color: rank, fontFamily: 'monospace',
            });

            this.add.text(cx, y, String(entry.score).padStart(7, ' '), {
                fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
            }).setOrigin(0.5, 0);

            this.add.text(cx + 155, y, entry.date, {
                fontSize: '11px', color: '#404060', fontFamily: 'monospace',
            }).setOrigin(1, 0);
        }
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
