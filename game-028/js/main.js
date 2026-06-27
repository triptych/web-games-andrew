/**
 * main.js — Phaser 4 game entry point.
 *
 * Scenes (loaded in order):
 *   SplashScene   — Title / start screen
 *   MapScene      — Overworld / dungeon exploration
 *   BattleScene   — Turn-based combat
 *   DialogScene   — NPC dialogue overlay (runs over MapScene)
 *   MenuScene     — Inventory / quest / party menu overlay
 *   UIScene       — HUD overlay (runs in parallel with MapScene/BattleScene)
 *
 * Library: ../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js (ESM build)
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';

import { SplashScene }  from './SplashScene.js';
import { MapScene }     from './MapScene.js';
import { BattleScene }  from './BattleScene.js';
import { DialogScene }  from './DialogScene.js';
import { MenuScene }    from './MenuScene.js';
import { UIScene }      from './UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

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
    scene: [SplashScene, MapScene, BattleScene, DialogScene, MenuScene, UIScene],
};

new Phaser.Game(config);
