/**
 * ResultScene — level result screen (game-plan §Other screens: Node failed /
 * Node complete). Phase 1 handles 'jammed' (failure) and 'complete'
 * (out of pieces → ran the supply dry).
 */

import { Scene } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { playUiClick } from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const MESSAGES = {
    jammed:   { title: 'THE LATTICE IS JAMMED', color: COLORS.danger },
    complete: { title: 'THE SUPPLY IS SPENT',   color: COLORS.success },
};

export class ResultScene extends Scene {
    constructor() { super({ key: 'ResultScene' }); }

    create(data) {
        const CX = GAME_WIDTH / 2;
        const CY = GAME_HEIGHT / 2;
        const info = MESSAGES[data.reason] || MESSAGES.jammed;

        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT,
            (COLORS.bg[0] << 16) | (COLORS.bg[1] << 8) | COLORS.bg[2], 0.85);

        this.add.text(CX, CY - 120, info.title, {
            fontSize: '40px', fontFamily: 'monospace', fontStyle: 'bold',
            color: hex(info.color),
        }).setOrigin(0.5);

        this.add.text(CX, CY - 40, `SCORE  ${data.score}`, {
            fontSize: '28px', fontFamily: 'monospace', color: hex(COLORS.gold),
        }).setOrigin(0.5);

        this.add.text(CX, CY + 4, `BEST COMBO  ×${data.maxCombo}`, {
            fontSize: '16px', fontFamily: 'monospace', color: hex(COLORS.text),
        }).setOrigin(0.5);

        const prompt = this.add.text(CX, CY + 90, 'CLICK or PRESS ANY KEY to retry', {
            fontSize: '16px', fontFamily: 'monospace', color: hex(COLORS.parchment),
        }).setOrigin(0.5);

        this._t = 0;
        this._prompt = prompt;

        const retry = () => {
            playUiClick();
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
            this.scene.stop('ResultScene');
        };
        this.input.keyboard.on('keydown', retry);
        this.input.on('pointerdown', retry);
    }

    update(time, delta) {
        this._t += delta / 1000;
        this._prompt.setAlpha((Math.sin(this._t * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3);
    }
}
