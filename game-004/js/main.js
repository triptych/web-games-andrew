import kaplay from '../lib/kaplay/kaplay.mjs';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { initMap } from './map.js';
import { initTowers } from './towers.js';
import { initEnemies } from './enemies.js';
import { initWaves } from './waves.js';
import { initUI } from './ui.js';

function startGame() {
    const k = kaplay({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        background: [30, 35, 42],
        letterbox: true,
        stretch: true,
        crisp: true,
    });

    // Initialize all systems (order matters)
    initMap(k);
    initEnemies(k);
    initTowers(k);
    initWaves(k);
    initUI(k);

    // Restart key
    k.onKeyPress("r", () => {
        location.reload();
    });
}

startGame();
