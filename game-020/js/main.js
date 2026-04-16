/**
 * main.js — Phaser 4 game entry point for The River.
 *
 * Scenes (loaded in order):
 *   SplashScene  — Title / start screen with daily news flavor
 *   GameScene    — Main river journey (encounters, choices)
 *   UIScene      — HUD overlay (runs in parallel with GameScene)
 *   DinnerScene  — Final dinner evaluation at the dark tower
 *
 * Library: ../../lib/phaser/phaser.js (global `Phaser`, UMD build)
 *
 * NOTE: index.html loads phaser.js as a plain <script> tag (not a module).
 * Serve this folder via a local HTTP server — file:// will fail with CORS errors.
 * Use: npx serve . or VS Code Live Server from game-020/
 */

import { SplashScene } from './SplashScene.js';
import { GameScene }   from './GameScene.js';
import { UIScene }     from './UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

// Helper: convert [r,g,b] array to Phaser hex integer 0xRRGGBB
function rgb(arr) {
    return (arr[0] << 16) | (arr[1] << 8) | arr[2];
}

const config = {
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: rgb(COLORS.bg),
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [SplashScene, GameScene, UIScene],
};

new Phaser.Game(config);
