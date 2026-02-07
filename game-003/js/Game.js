// Game.js - Main game logic and state management

import { Map } from './Map.js';
import { Player } from './Player.js';
import { Monster } from './Monster.js';
import { Renderer } from './Renderer.js';
import { MessageLog } from './MessageLog.js';
import { Input } from './Input.js';
import { createRandomItem, ItemType, Item } from './Item.js';
import { FOV } from './FOV.js';
import { createFireball, createArrow } from './Projectile.js';

export class Game {
    constructor(canvas, messageElement, loadFromSave = false) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.messageLog = new MessageLog(messageElement);
        this.input = new Input(this);

        this.map = null;
        this.player = null;
        this.monsters = [];
        this.items = [];
        this.projectiles = [];
        this.fov = null;
        this.turnCount = 0;
        this.depth = 1;
        this.levels = {}; // Store level states by depth
        this.gameState = 'playing'; // 'playing', 'game_over', 'victory'
        this.showInventory = false;
        this.targetMode = null; // null, 'spell', 'ranged'
        this.targetX = 0;
        this.targetY = 0;

        if (loadFromSave) {
            this.loadGame();
        } else {
            this.init();
        }
    }

    init() {
        // Create map
        this.map = new Map(80, 50);
        const startPos = this.map.generate(this.depth > 1);

        // Create player at starting position (or use stairs up position)
        if (this.map.stairsUp) {
            this.player = new Player(this.map.stairsUp.x, this.map.stairsUp.y);
        } else {
            this.player = new Player(startPos.x, startPos.y);
        }

        // Initialize FOV
        this.fov = new FOV(this.map);
        this.fov.compute(this.player.x, this.player.y, 10);

        // Spawn monsters
        this.spawnMonsters();

        // Spawn items
        this.spawnItems();

        // Welcome message
        if (this.depth === 1) {
            this.messageLog.add('Welcome to the dungeon! Use arrow keys or WASD to move.', '#4CAF50');
            this.messageLog.add('Press Q/E for diagonal movement, Space to wait.', '#4CAF50');
            this.messageLog.add('Attack monsters by moving into them!', '#4CAF50');
            this.messageLog.add('Press G to pick up items, I for inventory, F to cast fireball.', '#4CAF50');
            this.messageLog.add('Use </> to navigate stairs between levels.', '#4CAF50');
        }

        // Initial render
        this.render();
        this.updateUI();
    }

    spawnMonsters() {
        this.monsters = [];
        const baseCount = 5 + Math.floor(Math.random() * 5);
        const monsterCount = baseCount + Math.floor(this.depth / 2); // More monsters on deeper levels
        const monsterTypes = ['rat', 'goblin', 'snake', 'orc'];

        for (let i = 0; i < monsterCount; i++) {
            const pos = this.map.getRandomFloorPosition(true); // Exclude first room
            if (pos) {
                // Choose random monster type (weighted by depth)
                const rand = Math.random() + (this.depth * 0.05);
                let type;
                if (rand < 0.4) type = 'rat';
                else if (rand < 0.7) type = 'goblin';
                else if (rand < 0.9) type = 'snake';
                else type = 'orc';

                this.monsters.push(new Monster(pos.x, pos.y, type));
            }
        }

        this.messageLog.add(`${this.monsters.length} monsters lurk in the shadows!`, '#FF8888');
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
            // Check for stairs
            const tile = this.map.getTile(this.player.x, this.player.y);
            if (tile === '>') {
                this.messageLog.add('You see stairs going down. Press > to descend.', '#FFFF00');
            } else if (tile === '<') {
                this.messageLog.add('You see stairs going up. Press < to ascend.', '#FFFF00');
            }

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

        // Update projectiles
        this.updateProjectiles();

        // Process monster AI turns
        this.processMonsterTurns();

        // Check again if player died from monster attacks
        if (this.player.isDead()) {
            this.gameOver();
            return;
        }

        // Update FOV
        this.fov.compute(this.player.x, this.player.y, 10);

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

    spawnItems() {
        this.items = [];
        const itemCount = 8 + Math.floor(Math.random() * 5); // 8-12 items
        
        for (let i = 0; i < itemCount; i++) {
            const pos = this.map.getRandomFloorPosition(false);
            if (pos) {
                const item = createRandomItem(pos.x, pos.y, this.depth);
                this.items.push(item);
            }
        }
        
        this.messageLog.add(`${this.items.length} items scattered throughout the dungeon!`, '#FFFF88');
    }
    
    getItemAt(x, y) {
        return this.items.find(item => item.x === x && item.y === y);
    }
    
    handlePickup() {
        const item = this.getItemAt(this.player.x, this.player.y);
        if (!item) {
            this.messageLog.add('There is nothing here to pick up.', '#888888');
            return;
        }
        
        if (this.player.addItem(item)) {
            this.messageLog.add(`You picked up ${item.name}.`, '#00FF00');
            // Remove item from map
            const index = this.items.indexOf(item);
            if (index > -1) {
                this.items.splice(index, 1);
            }
            this.processTurn();
        } else {
            this.messageLog.add('Your inventory is full!', '#FF6666');
        }
    }
    
    handleDrop() {
        if (this.player.inventory.length === 0) {
            this.messageLog.add('You have nothing to drop.', '#888888');
            return;
        }
        
        // Drop the first item in inventory (simple implementation)
        const item = this.player.inventory[0];
        if (this.player.removeItem(item)) {
            // Place item on map at player's position
            item.x = this.player.x;
            item.y = this.player.y;
            this.items.push(item);
            this.messageLog.add(`You dropped ${item.name}.`, '#FFAA00');
            this.processTurn();
        }
    }
    
    toggleInventory() {
        this.showInventory = !this.showInventory;
        if (this.showInventory) {
            this.displayInventory();
        } else {
            this.render();
            this.updateUI(); // Ensure status bar reflects current equipment
        }
    }
    
    displayInventory() {
        // This will be rendered in the Renderer
        this.renderer.renderInventory(this.player);
    }
    
    handleInventoryAction(index) {
        if (index < 0 || index >= this.player.inventory.length) {
            return;
        }
        
        const item = this.player.inventory[index];
        
        if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) {
            // Equip/unequip item
            if (this.player.isEquipped(item)) {
                this.player.unequipItem(item);
                this.messageLog.add(`You unequipped ${item.name}.`, '#FFAA00');
            } else {
                this.player.equipItem(item);
                this.messageLog.add(`You equipped ${item.name}.`, '#00FF00');
            }
            this.updateUI();
            this.displayInventory();
        } else if (item.type === ItemType.POTION || item.type === ItemType.FOOD) {
            // Use consumable
            const result = this.player.useItem(item);
            this.messageLog.add(result.message, result.success ? '#00FF00' : '#FF6666');
            
            if (result.success) {
                this.updateUI();
                this.displayInventory();
                this.showInventory = false;
                this.processTurn();
            }
        }
    }

    render() {
        if (this.showInventory) {
            this.renderer.renderInventory(this.player);
        } else {
            this.renderer.render(this.map, this.player, this.monsters, this.items, this.fov, this.projectiles);
        }
    }

    updateUI() {
        // Update status bar
        document.getElementById('player-hp').textContent =
            `HP: ${this.player.hp}/${this.player.maxHp}`;
        document.getElementById('player-mp').textContent =
            `MP: ${this.player.mp}/${this.player.maxMp}`;
        document.getElementById('player-level').textContent =
            `Level: ${this.player.level}`;
        document.getElementById('player-xp').textContent =
            `XP: ${this.player.experience}/${this.player.experienceToLevel}`;
        document.getElementById('dungeon-depth').textContent =
            `Depth: ${this.depth}`;
        document.getElementById('turn-count').textContent =
            `Turn: ${this.turnCount}`;

        // Update equipment display
        const weaponText = this.player.equippedWeapon ?
            this.player.equippedWeapon.name : 'None';
        const armorText = this.player.equippedArmor ?
            this.player.equippedArmor.name : 'None';

        document.getElementById('equipped-weapon').textContent = `Weapon: ${weaponText}`;
        document.getElementById('equipped-armor').textContent = `Armor: ${armorText}`;
        document.getElementById('player-attack').textContent = `ATK: ${this.player.attack}`;
        document.getElementById('player-defense').textContent = `DEF: ${this.player.defense}`;
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            if (!proj.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Move projectile
            proj.move();

            // Check collisions
            const collision = proj.checkCollision(this.map, this.monsters);

            if (collision) {
                if (collision.type === 'monster' && collision.target) {
                    const damage = proj.damage;
                    const actualDamage = collision.target.takeDamage(damage);
                    this.messageLog.add(`Your ${proj.type} hits ${collision.target.name} for ${actualDamage} damage!`, '#FFA500');

                    if (collision.target.isDead) {
                        this.messageLog.add(`You killed the ${collision.target.name}!`, '#FFD700');
                        this.player.gainExperience(collision.target.xp);
                        this.messageLog.add(`You gain ${collision.target.xp} experience.`, '#00FF00');

                        if (this.player.experience === 0) {
                            this.messageLog.add(`*** LEVEL UP! You are now level ${this.player.level}! ***`, '#FFD700');
                        }
                    }
                } else if (collision.type === 'wall') {
                    this.messageLog.add(`Your ${proj.type} hits a wall.`, '#888888');
                }
                this.projectiles.splice(i, 1);
            }
        }
    }

    castFireball() {
        const manaCost = 10;

        if (!this.player.useMana(manaCost)) {
            this.messageLog.add('Not enough mana to cast fireball!', '#FF6666');
            return;
        }

        // Find nearest visible monster
        let nearestMonster = null;
        let nearestDist = Infinity;

        for (const monster of this.monsters) {
            if (monster.isDead) continue;
            if (!this.fov.isVisible(monster.x, monster.y)) continue;

            const dist = Math.abs(monster.x - this.player.x) + Math.abs(monster.y - this.player.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestMonster = monster;
            }
        }

        if (!nearestMonster) {
            this.messageLog.add('No visible targets!', '#FF6666');
            this.player.restoreMana(manaCost); // Refund mana
            return;
        }

        // Create fireball projectile
        const fireball = createFireball(this.player.x, this.player.y, nearestMonster.x, nearestMonster.y);
        this.projectiles.push(fireball);

        this.messageLog.add('You cast a fireball!', '#FF4500');
        this.processTurn();
    }

    shootArrow() {
        // Check if player has a bow or ranged weapon equipped
        if (!this.player.equippedWeapon || this.player.equippedWeapon.name.toLowerCase().indexOf('bow') === -1) {
            this.messageLog.add('You need a bow equipped to shoot arrows!', '#FF6666');
            return;
        }

        // Find nearest visible monster
        let nearestMonster = null;
        let nearestDist = Infinity;

        for (const monster of this.monsters) {
            if (monster.isDead) continue;
            if (!this.fov.isVisible(monster.x, monster.y)) continue;

            const dist = Math.abs(monster.x - this.player.x) + Math.abs(monster.y - this.player.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestMonster = monster;
            }
        }

        if (!nearestMonster) {
            this.messageLog.add('No visible targets!', '#FF6666');
            return;
        }

        // Create arrow projectile
        const arrow = createArrow(this.player.x, this.player.y, nearestMonster.x, nearestMonster.y);
        this.projectiles.push(arrow);

        this.messageLog.add('You shoot an arrow!', '#8B4513');
        this.processTurn();
    }

    descendStairs() {
        const tile = this.map.getTile(this.player.x, this.player.y);
        if (tile !== '>') {
            this.messageLog.add('There are no stairs down here.', '#FF6666');
            return;
        }

        // Save current level state
        this.saveLevelState(this.depth);

        this.depth++;
        this.messageLog.add(`You descend to level ${this.depth}...`, '#FFFF00');

        // Check if this level already exists
        if (this.levels[this.depth]) {
            // Restore existing level
            this.restoreLevelState(this.depth);
            // Place player at up stairs
            this.player.x = this.map.stairsUp.x;
            this.player.y = this.map.stairsUp.y;
        } else {
            // Generate new level
            this.map = new Map(80, 50);
            this.map.generate(true); // Has up stairs

            // Place player at up stairs
            this.player.x = this.map.stairsUp.x;
            this.player.y = this.map.stairsUp.y;

            // Initialize FOV
            this.fov = new FOV(this.map);

            // Spawn new monsters and items
            this.spawnMonsters();
            this.spawnItems();
        }

        this.projectiles = [];

        // Update FOV
        this.fov.compute(this.player.x, this.player.y, 10);

        this.render();
        this.updateUI();
    }

    ascendStairs() {
        const tile = this.map.getTile(this.player.x, this.player.y);
        if (tile !== '<') {
            this.messageLog.add('There are no stairs up here.', '#FF6666');
            return;
        }

        if (this.depth <= 1) {
            this.messageLog.add('You cannot go up from here. Explore deeper!', '#FF6666');
            return;
        }

        // Save current level state
        this.saveLevelState(this.depth);

        this.depth--;
        this.messageLog.add(`You ascend to level ${this.depth}...`, '#FFFF00');

        // Restore previous level (should always exist)
        if (this.levels[this.depth]) {
            this.restoreLevelState(this.depth);
            // Place player at down stairs
            this.player.x = this.map.stairsDown.x;
            this.player.y = this.map.stairsDown.y;
        } else {
            // Fallback: generate level if somehow missing
            this.map = new Map(80, 50);
            this.map.generate(this.depth > 1);
            this.player.x = this.map.stairsDown.x;
            this.player.y = this.map.stairsDown.y;
            this.fov = new FOV(this.map);
            this.spawnMonsters();
            this.spawnItems();
        }

        this.projectiles = [];

        // Update FOV
        this.fov.compute(this.player.x, this.player.y, 10);

        this.render();
        this.updateUI();
    }

    saveLevelState(depth) {
        this.levels[depth] = {
            mapData: this.map.serialize(),
            monsters: this.monsters.map(m => m.serialize()),
            items: this.items.map(i => i.serialize()),
            fovData: this.fov.serialize()
        };
    }

    restoreLevelState(depth) {
        const levelData = this.levels[depth];

        // Restore map
        this.map = new Map(80, 50);
        this.map.deserialize(levelData.mapData);

        // Restore FOV
        this.fov = new FOV(this.map);
        if (levelData.fovData) {
            this.fov.deserialize(levelData.fovData);
        }

        // Restore monsters
        this.monsters = levelData.monsters.map(data => Monster.deserialize(data));

        // Restore items
        this.items = levelData.items.map(data => Item.deserialize(data));
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

    saveGame() {
        try {
            // Save current level state before saving game
            this.saveLevelState(this.depth);

            const saveData = {
                player: this.player.serialize(),
                levels: this.levels, // Save all level states
                turnCount: this.turnCount,
                depth: this.depth,
                gameState: this.gameState,
                timestamp: Date.now()
            };

            localStorage.setItem('roguelike_save', JSON.stringify(saveData));
            this.messageLog.add('Game saved!', '#4CAF50');
            console.log('Game saved successfully');
        } catch (error) {
            console.error('Failed to save game:', error);
            this.messageLog.add('Failed to save game!', '#FF6666');
        }
    }

    loadGame() {
        try {
            const saveData = JSON.parse(localStorage.getItem('roguelike_save'));

            if (!saveData) {
                console.error('No save data found!');
                this.init();
                return;
            }

            // Restore player (pass Item class for inventory deserialization)
            this.player = Player.deserialize(saveData.player, Item);

            // Restore game state
            this.turnCount = saveData.turnCount;
            this.depth = saveData.depth;
            this.gameState = saveData.gameState;
            this.projectiles = [];

            // Restore all levels
            this.levels = saveData.levels || {};

            // Restore current level
            if (this.levels[this.depth]) {
                this.restoreLevelState(this.depth);
            } else {
                // Fallback: generate level if missing
                this.map = new Map(80, 50);
                this.map.generate(this.depth > 1);
                this.fov = new FOV(this.map);
                this.spawnMonsters();
                this.spawnItems();
            }

            // Update FOV for current player position
            this.fov.compute(this.player.x, this.player.y, 10);

            // Welcome back message
            this.messageLog.add('Game loaded successfully!', '#4CAF50');
            this.messageLog.add(`Turn ${this.turnCount} - Depth ${this.depth}`, '#FFFF88');

            // Initial render
            this.render();
            this.updateUI();

            console.log('Game loaded successfully');
        } catch (error) {
            console.error('Failed to load game:', error);
            this.messageLog.add('Failed to load game! Starting new game...', '#FF6666');
            this.init();
        }
    }
}
