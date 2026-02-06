// Player.js - Player character class

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 100;
        this.maxHp = 100;
        this.level = 1;
        this.experience = 0;
        this.experienceToLevel = 100;
        this.attack = 10;
        this.defense = 2;
        this.char = '@';
        this.color = '#FFFF00'; // Yellow
    }

    move(dx, dy, map) {
        const newX = this.x + dx;
        const newY = this.y + dy;

        if (map.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            return true;
        }
        return false;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    takeDamage(amount) {
        const damage = Math.max(1, amount - this.defense);
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;
        return damage;
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
    }

    isDead() {
        return this.hp <= 0;
    }

    gainExperience(amount) {
        this.experience += amount;
        
        // Check for level up
        if (this.experience >= this.experienceToLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.experience = 0;
        this.experienceToLevel = Math.floor(this.experienceToLevel * 1.5);
        
        // Increase stats
        this.maxHp += 10;
        this.hp = this.maxHp; // Full heal on level up
        this.attack += 2;
        this.defense += 1;
        
        return true; // Signal that level up occurred
    }

    getAttackDamage() {
        // Base attack with some randomness
        const variance = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(1, this.attack + variance);
    }
}
