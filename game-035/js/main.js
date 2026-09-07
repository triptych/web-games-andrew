/**
 * main.js — Phaser 4 game entry point.
 *
 * Scenes:
 *   SplashScene — Title / start screen with animated tunnel preview
 *   GameScene   — Main gameplay
 *   UIScene     — HUD overlay (runs in parallel with GameScene)
 *
 * Library: ../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js (ESM build)
 *
 * The canvas is fully responsive (Scale.RESIZE) rather than a fixed-aspect
 * letterboxed box — on a tall portrait phone the tunnel simply becomes a
 * tall tunnel instead of leaving big black bars top/bottom. Every module
 * that needs the canvas size reads viewport.js (updated on every resize)
 * instead of a fixed config constant.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';

import { SplashScene } from './SplashScene.js';
import { GameScene }   from './GameScene.js';
import { UIScene }     from './UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { setViewportSize } from './viewport.js';

const config = {
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.bg,
    scale: {
        mode:       Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER, // RESIZE fills the parent — no letterbox to center
        width:  '100%',
        height: '100%',
    },
    scene: [SplashScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

game.scale.on(Phaser.Scale.Events.RESIZE, (gameSize) => {
    setViewportSize(gameSize.width, gameSize.height);
});

// Prime the viewport with the actual initial size (RESIZE fires once on boot,
// but set it immediately too so the very first frame is already correct).
setViewportSize(window.innerWidth, window.innerHeight);
