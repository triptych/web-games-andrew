/**
 * main.js — Phaser 4 entry point for "Depths Unknown".
 *
 * Architecture:
 *   BootScene    → loads nothing, advances to PreloadScene
 *   PreloadScene → generates world procedurally, stores in registry
 *   SplashScene  → title / story intro / new game | continue
 *   GameScene    → core gameplay loop
 *   UIScene      → HUD overlay (parallel to GameScene)
 *   BaseScene    → sell / upgrade / shop (pauses GameScene)
 *   GameOverScene → hull destroyed screen
 *
 * Phaser import note: use named exports only — no default export exists.
 * All scene files import Phaser directly (NOT via window.Phaser).
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { setUpgradeData } from './systems/GameState.js';
import { UPGRADES } from './data/upgrades.js';

import { BootScene }     from './scenes/BootScene.js';
import { PreloadScene }  from './scenes/PreloadScene.js';
import { SplashScene }   from './scenes/SplashScene.js';
import { GameScene }     from './scenes/GameScene.js';
import { UIScene }       from './scenes/UIScene.js';
import { BaseScene }     from './scenes/BaseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

// Wire upgrade data into GameState (avoids circular imports)
setUpgradeData({ UPGRADES });

function rgb(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

const config = {
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: rgb(COLORS.bg),
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
        BootScene,
        PreloadScene,
        SplashScene,
        GameScene,
        UIScene,
        BaseScene,
        GameOverScene,
    ],
};

new Phaser.Game(config);
