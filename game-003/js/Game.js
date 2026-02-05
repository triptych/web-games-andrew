// Game.js - Main game logic and state management

import { Map } from './Map.js';
import { Player } from './Player.js';
import { Renderer } from './Renderer.js';
import { MessageLog } from './MessageLog.js';
import { Input } from './Input.js';

export class Game {
    constructor(canvas, messageElement) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.messageLog = new MessageLog(messageElement);
        this.input = new Input(this);
        
        this.map = null;
        this.player = null;
        this.turnCount = 0;
        this.depth = 1;
        this.gameState = 'playing'; // 'playing', 'game_over', 'victory'
        
        this.init();
    }

    init() {
        // Create map
        this.map = new Map(80, 50);
        const startPos = this.map.generate();
        
        // Create player at starting position
        this.player = new Player(startPos.x, startPos.y);
        
        // Welcome message
        this.messageLog.add('Welcome to the dungeon! Use arrow keys or WASD to move.', '#4CAF50');
        this.messageLog.add('Press Q/E for diagonal movement, Space to wait.', '#4CAF50');
        
        // Initial render
        this.render();
        this.updateUI();
    }

    handlePlayerMove(dx, dy) {
        if (this.gameState !== 'playing') {
            return;
        }

        // Handle wait/rest
        if (dx === 0 && dy === 0) {
            this.messageLog.add('You wait and rest...', '#888888');
            this.processTurn();
            return;
        }

        // Try to move player
        const moved = this.player.move(dx, dy, this.map);
        
        if (moved) {
            this.messageLog.add(`You move ${this.getDirectionText(dx, dy)}.`, '#CCCCCC');
            this.processTurn();
        } else {
            this.messageLog.add('You bump into a wall!', '#FF6666');
        }
    }

    getDirectionText(dx, dy) {
        if (dx === 0 && dy === -1) return 'north';
        if (dx === 0 && dy === 1) return 'south';
        if (dx === -1 && dy === 0) return 'west';
        if (dx === 1 && dy === 0) return 'east';
        if (dx === -1 && dy === -1) return 'northwest';
        if (dx === 1 && dy === -1) return 'northeast';
        if (dx === -1 && dy === 1) return 'southwest';
        if (dx === 1 && dy === 1) return 'southeast';
        return '';
    }

    processTurn() {
        this.turnCount++;
        
        // Check if player is dead
        if (this.player.isDead()) {
            this.gameOver();
            return;
        }
        
        // Future: AI turn processing would go here
        
        // Render and update UI
        this.render();
        this.updateUI();
    }

    render() {
        this.renderer.render(this.map, this.player);
    }

    updateUI() {
        // Update status bar
        document.getElementById('player-hp').textContent = 
            `HP: ${this.player.hp}/${this.player.maxHp}`;
        document.getElementById('player-level').textContent = 
            `Level: ${this.player.level}`;
        document.getElementById('dungeon-depth').textContent = 
            `Depth: ${this.depth}`;
        document.getElementById('turn-count').textContent = 
            `Turn: ${this.turnCount}`;
    }

    gameOver() {
        this.gameState = 'game_over';
        this.messageLog.add('=== GAME OVER ===', '#FF0000');
        this.messageLog.add('You have died!', '#FF0000');
        this.messageLog.add('Refresh the page to play again.', '#FFFF00');
    }

    newGame() {
        this.turnCount = 0;
        this.depth = 1;
        this.gameState = 'playing';
        this.messageLog.clear();
        this.init();
    }
}
