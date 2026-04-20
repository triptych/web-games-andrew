/**
 * main.js — Phaser 4 game entry point for The River.
 *
 * Scenes (loaded in order):
 *   SplashScene  — Title / start screen with daily news flavor
 *   GameScene    — Main river journey (encounters, choices)
 *   UIScene      — HUD overlay (runs in parallel with GameScene)
 *   DinnerScene  — Final dinner evaluation at the dark tower
 *
 * Library: ../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js (ESM)
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
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
