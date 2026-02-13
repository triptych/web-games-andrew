// Main entry point - Kaplay initialization and game setup

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { initAudioContext } from './sounds.js';
import { initPlayer } from './player.js';
import { initEnemies } from './enemies.js';
import { initProjectiles } from './projectiles.js';
import { initWaves } from './waves.js';
import { initUI } from './ui.js';
import { events } from './events.js';
import { state } from './state.js';

// Initialize Kaplay
const k = kaplay({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: [10, 10, 15],
    scale: 1,
    pixelDensity: window.devicePixelRatio || 1,
    crisp: true,
});

// Make kaplay globally accessible for debugging
window.k = k;

// Create splash screen
function createSplashScreen() {
    const splash = document.createElement('div');
    splash.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: linear-gradient(135deg, #1a1c24 0%, #2d3142 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: 'Arial', sans-serif;
    `;

    const title = document.createElement('h1');
    title.textContent = 'BULLET HEAVEN';
    title.style.cssText = `
        color: #ffffff;
        font-size: 4rem;
        margin-bottom: 1rem;
        text-shadow: 0 0 30px rgba(100, 200, 255, 0.8);
        letter-spacing: 0.2em;
    `;
    splash.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Survive the endless waves';
    subtitle.style.cssText = `
        color: #aaaaaa;
        font-size: 1.2rem;
        margin-bottom: 3rem;
        letter-spacing: 0.1em;
    `;
    splash.appendChild(subtitle);

    const startBtn = document.createElement('button');
    startBtn.textContent = 'START GAME';
    startBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 1rem 3rem;
        font-size: 1.5rem;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        letter-spacing: 0.1em;
    `;

    startBtn.onmouseenter = () => {
        startBtn.style.transform = 'scale(1.05)';
        startBtn.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.6)';
    };

    startBtn.onmouseleave = () => {
        startBtn.style.transform = 'scale(1)';
        startBtn.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.4)';
    };

    startBtn.onclick = () => {
        initAudioContext();
        splash.style.transition = 'opacity 0.5s';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.remove();
            startGame();
        }, 500);
    };

    splash.appendChild(startBtn);

    const controls = document.createElement('div');
    controls.style.cssText = `
        margin-top: 3rem;
        color: #888888;
        font-size: 0.9rem;
        text-align: center;
        line-height: 1.6;
    `;
    controls.innerHTML = `
        <div>WASD or Arrow Keys to Move</div>
        <div>Auto-shoot at nearest enemy</div>
        <div>Collect XP to level up</div>
    `;
    splash.appendChild(controls);

    document.body.appendChild(splash);
}

// Start the game
function startGame() {
    k.scene("game", () => {
        // Reset state for new game
        state.reset();

        // Initialize all systems (pass kaplay instance)
        initPlayer(k);
        initEnemies(k);
        initProjectiles(k);
        initWaves(k);
        initUI(k);

        // Start spawning enemies
        events.emit('gameStarted');
    });

    k.go("game");
}

// Initialize splash screen
createSplashScreen();
