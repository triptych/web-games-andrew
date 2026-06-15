/**
 * main.js — Phaser 4 entry point for Alchemist's Lattice.
 *
 * Engine note (repo convention, see project memory): scene files import Phaser
 * DIRECTLY from the ESM build — never via window.Phaser (ES imports are hoisted,
 * so window.Phaser would be undefined when scene modules evaluate). index.html
 * loads only <script type="module" src="js/main.js">.
 *
 * Scenes:
 *   SplashScene — title / start
 *   GameScene   — core block-placement puzzle (the lattice)
 *   UIScene     — HUD overlay, runs in parallel with GameScene
 *   ResultScene — win / jammed result screen
 *
 * Phase 1 only — core puzzle loop (no alchemy/deposits/cauldron yet).
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SplashScene } from './SplashScene.js';
import { GameScene }   from './GameScene.js';
import { UIScene }     from './UIScene.js';
import { ResultScene } from './ResultScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const config = {
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: toHexInt(COLORS.bg),
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [SplashScene, GameScene, UIScene, ResultScene],
};

new Phaser.Game(config);
