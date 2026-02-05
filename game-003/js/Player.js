// Player.js - Player character class

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 100;
        this.maxHp = 100;
        this.level = 1;
        this.experience = 0;
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
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
    }

    isDead() {
        return this.hp <= 0;
    }
}
