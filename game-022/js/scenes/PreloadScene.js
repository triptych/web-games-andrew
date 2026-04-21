/**
 * PreloadScene — generates the world and stores it in the Phaser registry.
 * Shows a loading bar while world gen runs.
 */

import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { GameState, setUpgradeData } from '../systems/GameState.js';
import { UPGRADES } from '../data/upgrades.js';
import { generateWorld } from '../systems/WorldGen.js';
import { WORLD_COLS, WORLD_ROWS } from '../config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class PreloadScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.PRELOAD }); }

    create() {
        // Wire up the upgrade data reference needed by GameState
        setUpgradeData({ UPGRADES });

        // Load persistent state
        GameState.load();

        const CX = GAME_WIDTH / 2, CY = GAME_HEIGHT / 2;

        // Background
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000);

        this.add.text(CX, CY - 40, 'DEPTHS UNKNOWN', {
            fontSize: '28px', color: hex(COLORS.accent), fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY, 'Generating world...', {
            fontSize: '14px', color: hex(COLORS.text), fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Progress bar outline
        const barW = 200, barH = 12;
        this.add.rectangle(CX, CY + 30, barW + 4, barH + 4, 0x334466);
        const barFill = this.add.rectangle(CX - barW / 2, CY + 30, 0, barH, 0x64C8FF).setOrigin(0, 0.5);

        // Run world generation in a deferred call so the loading screen renders first
        this.time.delayedCall(50, () => {
            // Generate world
            const world = generateWorld(GameState.worldSeed);

            // Explored tiles array
            const exploredTiles = new Uint8Array(WORLD_COLS * WORLD_ROWS);

            // Store in registry for GameScene
            this.registry.set('world', world);
            this.registry.set('exploredTiles', exploredTiles);

            barFill.width = barW;

            this.time.delayedCall(200, () => {
                this.scene.start(SCENE.SPLASH);
            });
        });
    }
}
