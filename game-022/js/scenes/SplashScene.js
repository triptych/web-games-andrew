import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { STORY_INTRO } from '../data/lore.js';
import { initAudio, playUiClick } from '../systems/SoundManager.js';
import { GameState } from '../systems/GameState.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.SPLASH }); }

    create() {
        const CX = GAME_WIDTH / 2, CY = GAME_HEIGHT / 2;

        // Background gradient (simulated with two rects)
        this.add.rectangle(CX, CY * 0.5, GAME_WIDTH, CY, 0x050510);
        this.add.rectangle(CX, CY * 1.5, GAME_WIDTH, CY, 0x0A0820);

        // Title
        this.add.text(CX, 80, 'DEPTHS', {
            fontSize: '52px', color: hex(COLORS.accent), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(CX, 136, 'UNKNOWN', {
            fontSize: '52px', color: '#FF8800', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);

        // Decorative drill icon (simple graphic)
        const g = this.add.graphics();
        g.fillStyle(0x445566, 1); g.fillRect(CX - 10, 195, 20, 30);
        g.fillStyle(0xFF8800, 1); g.fillTriangle(CX - 8, 225, CX + 8, 225, CX, 238);
        g.fillStyle(0x88CCFF, 1); g.fillRect(CX - 6, 198, 12, 8);

        // Story intro lines
        let y = 260;
        for (const line of STORY_INTRO) {
            this.add.text(CX, y, line, {
                fontSize: '11px', color: line.startsWith('AXIOM') ? hex(COLORS.accent) : '#9999BB',
                fontFamily: 'monospace',
            }).setOrigin(0.5);
            y += 16;
        }

        // New game / continue buttons
        const hasProgress = GameState.stats.totalRuns > 0;

        if (hasProgress) {
            const continueBtn = this.add.text(CX, CY + 160, '[ CONTINUE ]', {
                fontSize: '18px', color: hex(COLORS.success), fontFamily: 'monospace',
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerover',  () => continueBtn.setColor('#FFFFFF'));
            continueBtn.on('pointerout',   () => continueBtn.setColor(hex(COLORS.success)));
            continueBtn.on('pointerdown',  () => this._start(false));

            this.add.text(CX, CY + 195, `Deepest: ${GameState.stats.maxDepth}m  |  Credits: ${GameState.credits}`, {
                fontSize: '10px', color: '#667788', fontFamily: 'monospace',
            }).setOrigin(0.5);
        }

        const newBtn = this.add.text(CX, CY + (hasProgress ? 228 : 180), hasProgress ? '[ NEW GAME ]' : '[ BEGIN MISSION ]', {
            fontSize: hasProgress ? '14px' : '20px',
            color: hasProgress ? '#556677' : hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        newBtn.on('pointerover',  () => newBtn.setColor('#FFFFFF'));
        newBtn.on('pointerout',   () => newBtn.setColor(hasProgress ? '#556677' : hex(COLORS.accent)));
        newBtn.on('pointerdown',  () => this._start(true));

        // Controls hint
        this.add.text(CX, GAME_HEIGHT - 40, 'WASD / Arrows to move & drill  |  Up = Winch', {
            fontSize: '10px', color: '#445566', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.add.text(CX, GAME_HEIGHT - 24, 'Space = use item  |  P / Esc = pause', {
            fontSize: '10px', color: '#445566', fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Version
        this.add.text(GAME_WIDTH - 8, GAME_HEIGHT - 8, 'v1.0', {
            fontSize: '9px', color: '#333344', fontFamily: 'monospace',
        }).setOrigin(1, 1);

        // Keyboard shortcut
        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            if (!hasProgress) this._start(true);
        });

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 145, 'PRESS ANY KEY', {
            fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5).setVisible(!hasProgress);
        this._blinkT = 0;
        this._started = false;
    }

    update(_, delta) {
        this._blinkT += delta / 1000;
        if (this._prompt && this._prompt.visible) {
            this._prompt.setAlpha((Math.sin(this._blinkT * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3);
        }
    }

    _start(newGame) {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        if (newGame) GameState.resetForNewGame();
        this.scene.start(SCENE.GAME);
        this.scene.launch(SCENE.UI);
    }
}
