// Monster.js - Monster/Enemy class with AI

export class Monster {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Set monster stats based on type
        this.setStatsFromType(type);
        
        this.hp = this.maxHp;
        this.isDead = false;
    }

    setStatsFromType(type) {
        const monsterTypes = {
            'rat': {
                char: 'r',
                color: '#8B4513',
                name: 'rat',
                maxHp: 5,
                attack: 2,
                defense: 0,
                xp: 5
            },
            'goblin': {
                char: 'g',
                color: '#00FF00',
                name: 'goblin',
                maxHp: 15,
                attack: 4,
                defense: 1,
                xp: 10
            },
            'orc': {
                char: 'o',
                color: '#FF6666',
                name: 'orc',
                maxHp: 25,
                attack: 6,
                defense: 2,
                xp: 20
            },
            'troll': {
                char: 'T',
                color: '#00AA00',
                name: 'troll',
                maxHp: 40,
                attack: 10,
                defense: 3,
                xp: 35
            },
            'snake': {
                char: 's',
                color: '#FFFF00',
                name: 'snake',
                maxHp: 8,
                attack: 3,
                defense: 0,
                xp: 7
            }
        };

        const stats = monsterTypes[type] || monsterTypes['rat'];
        this.char = stats.char;
        this.color = stats.color;
        this.name = stats.name;
        this.maxHp = stats.maxHp;
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.xp = stats.xp;
    }

    takeDamage(amount) {
        const damage = Math.max(1, amount - this.defense);
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
        return damage;
    }

    // Basic AI: Chase player if in range
    getNextMove(playerX, playerY, map) {
        // Calculate distance to player
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only chase if player is within 10 tiles
        if (distance > 10) {
            return { dx: 0, dy: 0 };
        }

        // Move towards player
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Move horizontally
            moveX = dx > 0 ? 1 : -1;
        } else {
            // Move vertically
            moveY = dy > 0 ? 1 : -1;
        }

        // Check if the move is valid
        const newX = this.x + moveX;
        const newY = this.y + moveY;

        if (map.isWalkable(newX, newY)) {
            return { dx: moveX, dy: moveY };
        }

        // Try alternative moves if direct path is blocked
        if (moveX !== 0 && map.isWalkable(this.x + moveX, this.y)) {
            return { dx: moveX, dy: 0 };
        }
        if (moveY !== 0 && map.isWalkable(this.x, this.y + moveY)) {
            return { dx: 0, dy: moveY };
        }

        // Can't move
        return { dx: 0, dy: 0 };
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }
}
