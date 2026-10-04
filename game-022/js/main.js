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
 *   EndingScene  → mission complete (Singing Vein brought home); over a paused BaseScene
 *
 * Phaser import note: use named exports only — no default export exists.
 * All scene files import Phaser directly (NOT via window.Phaser).
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { setUpgradeData, GameState } from './systems/GameState.js';
import { UPGRADES } from './data/upgrades.js';

import { BootScene }     from './scenes/BootScene.js';
import { PreloadScene }  from './scenes/PreloadScene.js';
import { SplashScene }   from './scenes/SplashScene.js';
import { GameScene }     from './scenes/GameScene.js';
import { UIScene }       from './scenes/UIScene.js';
import { BaseScene }     from './scenes/BaseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { EndingScene }   from './scenes/EndingScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, SCENE } from './config.js';

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
        EndingScene,
    ],
};

const game = new Phaser.Game(config);

// ?debug=1 exposes hooks for dev/browsertest.mjs
if (new URLSearchParams(location.search).has('debug')) {
    window.__du = { game, GameState, SCENE };
}
