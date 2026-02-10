import kaplay from '../lib/kaplay/kaplay.mjs';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { initMap } from './map.js';
import { initTowers } from './towers.js';
import { initEnemies } from './enemies.js';
import { initWaves } from './waves.js';
import { initUI } from './ui.js';
import { initAudioContext, sounds } from './sounds.js';

function createSplashScreen() {
    // Create splash screen container
    const splash = document.createElement('div');
    splash.id = 'splash-screen';
    splash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1c24 0%, #2d3142 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Title
    const title = document.createElement('h1');
    title.textContent = 'Tower Defense';
    title.style.cssText = `
        color: #ffffff;
        font-size: 4rem;
        margin-bottom: 2rem;
        text-shadow: 0 0 20px rgba(100, 200, 255, 0.5);
        letter-spacing: 0.1em;
    `;
    splash.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Defend your base from waves of enemies';
    subtitle.style.cssText = `
        color: #b0b0b0;
        font-size: 1.2rem;
        margin-bottom: 3rem;
    `;
    splash.appendChild(subtitle);

    // Start button
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Game';
    startButton.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 1rem 3rem;
        font-size: 1.5rem;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        font-weight: bold;
        letter-spacing: 0.05em;
    `;

    // Button hover effect
    startButton.onmouseenter = () => {
        startButton.style.transform = 'translateY(-2px)';
        startButton.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.6)';
    };

    startButton.onmouseleave = () => {
        startButton.style.transform = 'translateY(0)';
        startButton.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.4)';
    };

    // Button click handler
    startButton.onclick = () => {
        // Initialize audio context (requires user interaction)
        initAudioContext();
        sounds.uiClick();

        // Fade out splash screen
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity = '0';

        setTimeout(() => {
            splash.remove();
            startGame();
        }, 500);
    };

    splash.appendChild(startButton);

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
        margin-top: 3rem;
        color: #808080;
        font-size: 0.9rem;
        text-align: center;
        max-width: 500px;
    `;
    instructions.innerHTML = `
        <p style="margin-bottom: 0.5rem;">Click to place towers and defend your base</p>
        <p>Press R to restart the game</p>
    `;
    splash.appendChild(instructions);

    document.body.appendChild(splash);
}

function startGame() {
    const k = kaplay({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        background: [30, 35, 42],
        letterbox: true,
        crisp: true,
        pixelDensity: Math.min(window.devicePixelRatio, 2),
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

// Show splash screen on load
createSplashScreen();
