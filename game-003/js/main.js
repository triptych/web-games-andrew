// main.js - Entry point for the roguelike game

import { Game } from './Game.js';

let game = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Setup splash screen buttons
    const btnNewGame = document.getElementById('btn-new-game');
    const btnLoadGame = document.getElementById('btn-load-game');
    const btnQuit = document.getElementById('btn-quit');

    // Check if saved game exists
    if (hasSavedGame()) {
        btnLoadGame.disabled = false;
    }

    // New Game button
    btnNewGame.addEventListener('click', () => {
        startNewGame();
    });

    // Load Game button
    btnLoadGame.addEventListener('click', () => {
        loadGame();
    });

    // Quit button
    btnQuit.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit?')) {
            window.close();
            // If window.close() doesn't work (modern browsers prevent it),
            // show a message
            setTimeout(() => {
                alert('Please close this tab manually to quit.');
            }, 100);
        }
    });
});

function startNewGame() {
    const canvas = document.getElementById('game-canvas');
    const messageElement = document.getElementById('messages');

    if (!canvas || !messageElement) {
        console.error('Required DOM elements not found!');
        return;
    }

    // Hide splash screen and show game
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    // Initialize the game
    game = new Game(canvas, messageElement);

    // Make game accessible for debugging
    window.game = game;

    console.log('Roguelike game initialized!');
    console.log('Use arrow keys or WASD to move');
    console.log('Press Q/E/Z/C for diagonal movement');
    console.log('Press Space to wait/rest');
}

function loadGame() {
    const canvas = document.getElementById('game-canvas');
    const messageElement = document.getElementById('messages');

    if (!canvas || !messageElement) {
        console.error('Required DOM elements not found!');
        return;
    }

    // Hide splash screen and show game
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    // Initialize the game and load saved state
    game = new Game(canvas, messageElement, true);

    // Make game accessible for debugging
    window.game = game;

    console.log('Game loaded from save!');
}

function hasSavedGame() {
    return localStorage.getItem('roguelike_save') !== null;
}

// Auto-save every 30 seconds if game is running
setInterval(() => {
    if (game && game.gameState === 'playing') {
        game.saveGame();
    }
}, 30000);
