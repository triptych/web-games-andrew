// Game.js - Main game logic and state management

import { Map } from './Map.js';
import { Player } from './Player.js';
import { Monster } from './Monster.js';
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
        this.monsters = [];
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
        
        // Spawn monsters
        this.spawnMonsters();
        
        // Welcome message
        this.messageLog.add('Welcome to the dungeon! Use arrow keys or WASD to move.', '#4CAF50');
        this.messageLog.add('Press Q/E for diagonal movement, Space to wait.', '#4CAF50');
        this.messageLog.add('Attack monsters by moving into them!', '#4CAF50');
        
        // Initial render
        this.render();
        this.updateUI();
    }

    spawnMonsters() {
        this.monsters = [];
        const monsterCount = 5 + Math.floor(Math.random() * 5); // 5-10 monsters
        const monsterTypes = ['rat', 'goblin', 'snake', 'orc'];
        
        for (let i = 0; i < monsterCount; i++) {
            const pos = this.map.getRandomFloorPosition(true); // Exclude first room
            if (pos) {
                // Choose random monster type (weighted towards easier monsters early)
                const rand = Math.random();
                let type;
                if (rand < 0.4) type = 'rat';
                else if (rand < 0.7) type = 'goblin';
                else if (rand < 0.9) type = 'snake';
                else type = 'orc';
                
                this.monsters.push(new Monster(pos.x, pos.y, type));
            }
        }
        
        this.messageLog.add(`${this.monsters.length} monsters spawn in the dungeon!`, '#FF8888');
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

        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check for monster at target position
        const monster = this.getMonsterAt(newX, newY);
        if (monster) {
            this.playerAttack(monster);
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

    getMonsterAt(x, y) {
        return this.monsters.find(m => !m.isDead && m.x === x && m.y === y);
    }

    playerAttack(monster) {
        const damage = this.player.getAttackDamage();
        const actualDamage = monster.takeDamage(damage);
        
        this.messageLog.add(`You hit the ${monster.name} for ${actualDamage} damage!`, '#FFA500');
        
        if (monster.isDead) {
            this.messageLog.add(`You killed the ${monster.name}!`, '#FFD700');
            this.player.gainExperience(monster.xp);
            this.messageLog.add(`You gain ${monster.xp} experience.`, '#00FF00');
            
            // Check if player leveled up
            if (this.player.experience === 0) { // Just leveled up (xp resets to 0)
                this.messageLog.add(`*** LEVEL UP! You are now level ${this.player.level}! ***`, '#FFD700');
                this.messageLog.add(`HP: ${this.player.maxHp}, ATK: ${this.player.attack}, DEF: ${this.player.defense}`, '#FFD700');
            }
        } else {
            this.messageLog.add(`The ${monster.name} has ${monster.hp}/${monster.maxHp} HP remaining.`, '#FFAAAA');
        }
    }

    monsterAttack(monster) {
        const damage = Math.max(1, monster.attack + Math.floor(Math.random() * 3) - 1);
        const actualDamage = this.player.takeDamage(damage);
        
        this.messageLog.add(`The ${monster.name} hits you for ${actualDamage} damage!`, '#FF6666');
        this.messageLog.add(`You have ${this.player.hp}/${this.player.maxHp} HP remaining.`, '#FF9999');
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
        
        // Process monster AI turns
        this.processMonsterTurns();
        
        // Check again if player died from monster attacks
        if (this.player.isDead()) {
            this.gameOver();
            return;
        }
        
        // Render and update UI
        this.render();
        this.updateUI();
    }

    processMonsterTurns() {
        for (const monster of this.monsters) {
            if (monster.isDead) continue;
            
            // Get AI move
            const move = monster.getNextMove(this.player.x, this.player.y, this.map);
            
            if (move.dx === 0 && move.dy === 0) {
                continue; // Monster doesn't move
            }
            
            const newX = monster.x + move.dx;
            const newY = monster.y + move.dy;
            
            // Check if moving into player (attack)
            if (newX === this.player.x && newY === this.player.y) {
                this.monsterAttack(monster);
            } else {
                // Check if another monster is already there
                const blockingMonster = this.getMonsterAt(newX, newY);
                if (!blockingMonster) {
                    monster.move(move.dx, move.dy);
                }
            }
        }
    }

    render() {
        this.renderer.render(this.map, this.player, this.monsters);
    }

    updateUI() {
        // Update status bar
        document.getElementById('player-hp').textContent = 
            `HP: ${this.player.hp}/${this.player.maxHp}`;
        document.getElementById('player-level').textContent = 
            `Level: ${this.player.level}`;
        document.getElementById('player-xp').textContent = 
            `XP: ${this.player.experience}/${this.player.experienceToLevel}`;
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
