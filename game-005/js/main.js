// Main entry point - Kaplay initialization and game setup

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CLASSES } from './config.js';
import { initAudioContext } from './sounds.js';
import { initPlayer } from './player.js';
import { initEnemies } from './enemies.js';
import { initProjectiles } from './projectiles.js';
import { initUpgrades } from './upgrades.js';
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

// Debug helper
window.debugGame = () => {
    console.log('=== GAME DEBUG INFO ===');
    console.log('Wave:', state.currentWave);
    console.log('Kills:', state.kills);
    console.log('Enemies on screen:', k.get('enemy').length);
    console.log('Enemy types:', k.get('enemy').map(e => e.enemyType));
    console.log('Player HP:', state.player ? `${Math.ceil(state.player.hp)}/${state.player.maxHp}` : 'Dead');
    console.log('Player Class:', state.playerClass);
    console.log('Is Paused:', state.isPaused);
    console.log('Is Game Over:', state.isGameOver);
    console.log('======================');
};

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
            showClassSelection();
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

// Show class selection screen
function showClassSelection() {
    const classScreen = document.createElement('div');
    classScreen.style.cssText = `
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

    const title = document.createElement('h2');
    title.textContent = 'CHOOSE YOUR CLASS';
    title.style.cssText = `
        color: #ffffff;
        font-size: 2.5rem;
        margin-bottom: 3rem;
        text-shadow: 0 0 20px rgba(100, 200, 255, 0.6);
        letter-spacing: 0.15em;
    `;
    classScreen.appendChild(title);

    const classContainer = document.createElement('div');
    classContainer.style.cssText = `
        display: flex;
        gap: 2rem;
        justify-content: center;
        flex-wrap: wrap;
    `;

    // Create class cards
    Object.entries(PLAYER_CLASSES).forEach(([classKey, classDef]) => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgb(${classDef.color.join(',')});
            border-radius: 15px;
            padding: 2rem;
            width: 250px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 5px 20px rgba(${classDef.color.join(',')}, 0.3);
        `;

        const className = document.createElement('h3');
        className.textContent = classDef.name;
        className.style.cssText = `
            color: rgb(${classDef.outlineColor.join(',')});
            font-size: 1.8rem;
            margin-bottom: 1rem;
            text-align: center;
        `;
        card.appendChild(className);

        const classDesc = document.createElement('p');
        classDesc.textContent = classDef.description;
        classDesc.style.cssText = `
            color: #cccccc;
            font-size: 0.9rem;
            margin-bottom: 1.5rem;
            text-align: center;
            line-height: 1.4;
        `;
        card.appendChild(classDesc);

        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = `
            color: #aaaaaa;
            font-size: 0.85rem;
            line-height: 1.6;
        `;
        statsDiv.innerHTML = `
            <div>HP: ${classDef.hp}</div>
            <div>Speed: ${classDef.speed}</div>
            <div>Damage: ${classDef.damage}</div>
            <div>Fire Rate: ${(1/classDef.fireRate).toFixed(1)}/s</div>
            <hr style="margin: 0.8rem 0; border-color: rgba(255,255,255,0.1);">
            <div>STR: ${classDef.stats.str} | DEX: ${classDef.stats.dex}</div>
            <div>INT: ${classDef.stats.int} | VIT: ${classDef.stats.vit}</div>
        `;
        card.appendChild(statsDiv);

        card.onmouseenter = () => {
            card.style.transform = 'scale(1.05) translateY(-5px)';
            card.style.boxShadow = `0 10px 40px rgba(${classDef.color.join(',')}, 0.5)`;
            card.style.borderColor = `rgb(${classDef.outlineColor.join(',')})`;
        };

        card.onmouseleave = () => {
            card.style.transform = 'scale(1) translateY(0)';
            card.style.boxShadow = `0 5px 20px rgba(${classDef.color.join(',')}, 0.3)`;
            card.style.borderColor = `rgb(${classDef.color.join(',')})`;
        };

        card.onclick = () => {
            classScreen.style.transition = 'opacity 0.3s';
            classScreen.style.opacity = '0';
            setTimeout(() => {
                classScreen.remove();
                startGame(classKey);
            }, 300);
        };

        classContainer.appendChild(card);
    });

    classScreen.appendChild(classContainer);
    document.body.appendChild(classScreen);
}

// Start the game with selected class
function startGame(playerClass = 'ranger') {
    k.scene("game", () => {
        // Reset state for new game
        state.reset();

        // Initialize all systems (pass kaplay instance)
        initPlayer(k, playerClass);
        initEnemies(k);
        initProjectiles(k);
        initUpgrades(k);
        initWaves(k);
        initUI(k);

        // Start spawning enemies
        events.emit('gameStarted');
    });

    k.go("game");
}

// Initialize splash screen
createSplashScreen();
