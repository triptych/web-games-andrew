/**
 * UIScene — HUD overlay for The River.
 * Runs in parallel with GameScene.
 * Listens to EventBus for state changes and updates labels.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        // Companions count — top-right
        this._companionLabel = this.add.text(GAME_WIDTH - 12, 10, 'Companions: 0', {
            fontSize: '14px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(1, 0);

        // Ingredients count — top-right second line
        this._ingredientLabel = this.add.text(GAME_WIDTH - 12, 30, 'Ingredients: 0', {
            fontSize: '14px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
        }).setOrigin(1, 0);

        // Latest companion joined — top-left
        this._lastCompanionLabel = this.add.text(12, 10, '', {
            fontSize: '13px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0, 0);

        // Subscribe to state events
        this._offs = [
            events.on('companionInvited', (c) => {
                this._companionLabel.setText(`Companions: ${state.companionCount}`);
                this._lastCompanionLabel.setText(`Joined: ${c.emoji} ${c.name}`);
                // Clear the "joined" label after 4 seconds
                this.time.delayedCall(4000, () => this._lastCompanionLabel.setText(''));
            }),
            events.on('ingredientCollected', () => {
                this._ingredientLabel.setText(`Ingredients: ${state.ingredientCount}`);
            }),
            events.on('riverAdvanced', () => {
                this._companionLabel.setText(`Companions: ${state.companionCount}`);
            }),
            events.on('gameOver', () => this._showGameOver()),
        ];
    }

    _showGameOver() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);

        this.add.text(CX, CY - 40, 'GAME OVER', {
            fontSize: '56px',
            color: hex(COLORS.danger),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 30, `Score: ${state.score}`, {
            fontSize: '24px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 80, 'Press R to restart  |  ESC for menu', {
            fontSize: '14px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    shutdown() {
        this._offs.forEach(off => off());
    }
}
