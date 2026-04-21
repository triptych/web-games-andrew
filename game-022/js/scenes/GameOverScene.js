import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { GameState } from '../systems/GameState.js';
import { playUiClick } from '../systems/SoundManager.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class GameOverScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.GAMEOVER }); }

    create() {
        const CX = GAME_WIDTH / 2, CY = GAME_HEIGHT / 2;

        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92);

        this.add.text(CX, CY - 160, 'MACHINE DESTROYED', {
            fontSize: '26px', color: hex(COLORS.danger), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(CX, CY - 120, 'All cargo lost.', {
            fontSize: '14px', color: '#AA5555', fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Stats
        const stats = GameState.stats;
        const lines = [
            `Deepest reached:  ${stats.maxDepth}m`,
            `Total credits earned:  ${stats.totalCreditsEarned}`,
            `Current credits:  ${GameState.credits}`,
            `Total deaths:  ${stats.totalDeaths}`,
        ];
        lines.forEach((line, i) => {
            this.add.text(CX, CY - 60 + i * 28, line, {
                fontSize: '13px', color: hex(COLORS.text), fontFamily: 'monospace',
            }).setOrigin(0.5);
        });

        // Rebuild cost
        const rebuildCost = Math.floor(GameState.derived.hullMax * 0.5);
        const canAfford = GameState.credits >= rebuildCost;
        this.add.text(CX, CY + 70, `Rebuild cost: ${rebuildCost} credits`, {
            fontSize: '13px', color: canAfford ? hex(COLORS.warn) : hex(COLORS.danger),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        if (!canAfford) {
            this.add.text(CX, CY + 95, '(Insufficient credits — new game required)', {
                fontSize: '10px', color: '#AA4444', fontFamily: 'monospace',
            }).setOrigin(0.5);
        }

        // Buttons
        if (canAfford) {
            const rebuildBtn = this.add.text(CX, CY + 135, '[ REBUILD & CONTINUE ]', {
                fontSize: '16px', color: hex(COLORS.success), fontFamily: 'monospace',
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            rebuildBtn.on('pointerover',  () => rebuildBtn.setColor('#FFFFFF'));
            rebuildBtn.on('pointerout',   () => rebuildBtn.setColor(hex(COLORS.success)));
            rebuildBtn.on('pointerdown',  () => {
                playUiClick();
                GameState.spendCredits(rebuildCost);
                GameState.hull.current = GameState.derived.hullMax;
                GameState.fuel.current = GameState.derived.fuelMax;
                GameState.playerRow = 0;
                GameState.save();
                this.scene.stop(SCENE.GAMEOVER);
                this.scene.start(SCENE.GAME);
                this.scene.launch(SCENE.UI);
            });
        }

        const newGameBtn = this.add.text(CX, CY + 175, '[ NEW GAME ]', {
            fontSize: '14px', color: '#667788', fontFamily: 'monospace',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        newGameBtn.on('pointerover',  () => newGameBtn.setColor('#FFFFFF'));
        newGameBtn.on('pointerout',   () => newGameBtn.setColor('#667788'));
        newGameBtn.on('pointerdown',  () => {
            playUiClick();
            GameState.resetForNewGame();
            this.scene.stop(SCENE.GAMEOVER);
            this.scene.start(SCENE.PRELOAD);
        });

        const menuBtn = this.add.text(CX, CY + 205, '[ MAIN MENU ]', {
            fontSize: '14px', color: '#445566', fontFamily: 'monospace',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        menuBtn.on('pointerover',  () => menuBtn.setColor('#FFFFFF'));
        menuBtn.on('pointerout',   () => menuBtn.setColor('#445566'));
        menuBtn.on('pointerdown',  () => {
            playUiClick();
            this.scene.stop(SCENE.GAMEOVER);
            this.scene.start(SCENE.SPLASH);
        });
    }
}
