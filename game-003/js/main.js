// main.js - Entry point for the roguelike game

import { Game } from './Game.js';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const messageElement = document.getElementById('messages');
    
    if (!canvas || !messageElement) {
        console.error('Required DOM elements not found!');
        return;
    }
    
    // Initialize the game
    const game = new Game(canvas, messageElement);
    
    // Make game accessible for debugging
    window.game = game;
    
    console.log('Roguelike game initialized!');
    console.log('Use arrow keys or WASD to move');
    console.log('Press Q/E/Z/C for diagonal movement');
    console.log('Press Space to wait/rest');
});
