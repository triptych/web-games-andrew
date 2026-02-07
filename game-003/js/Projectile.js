// Projectile.js - Projectiles for ranged attacks and magic

export class Projectile {
    constructor(x, y, dx, dy, damage, char, color, type = 'projectile', range = 10) {
        this.x = x;
        this.y = y;
        this.dx = dx; // Direction x
        this.dy = dy; // Direction y
        this.damage = damage;
        this.char = char;
        this.color = color;
        this.type = type; // 'arrow', 'fireball', 'magic_missile'
        this.range = range;
        this.distanceTraveled = 0;
        this.active = true;
    }

    move() {
        if (!this.active) return false;

        this.x += this.dx;
        this.y += this.dy;
        this.distanceTraveled++;

        if (this.distanceTraveled >= this.range) {
            this.active = false;
            return false;
        }

        return true;
    }

    checkCollision(map, monsters, player = null) {
        // Check wall collision
        if (!map.isWalkable(this.x, this.y)) {
            this.active = false;
            return { type: 'wall', target: null };
        }

        // Check monster collision
        for (const monster of monsters) {
            if (!monster.isDead && monster.x === this.x && monster.y === this.y) {
                this.active = false;
                return { type: 'monster', target: monster };
            }
        }

        // Check player collision (for monster projectiles)
        if (player && player.x === this.x && player.y === this.y) {
            this.active = false;
            return { type: 'player', target: player };
        }

        return null;
    }
}

export function createFireball(x, y, targetX, targetY) {
    // Calculate direction
    const dx = Math.sign(targetX - x);
    const dy = Math.sign(targetY - y);

    return new Projectile(x, y, dx, dy, 15, '*', '#FF4500', 'fireball', 8);
}

export function createArrow(x, y, targetX, targetY) {
    // Calculate direction
    const dx = Math.sign(targetX - x);
    const dy = Math.sign(targetY - y);

    // Determine arrow char based on direction
    let char = '-';
    if (dx === 0 && dy !== 0) char = '|';
    else if (dx !== 0 && dy !== 0) char = '/';

    return new Projectile(x, y, dx, dy, 8, char, '#8B4513', 'arrow', 12);
}

export function createMagicMissile(x, y, targetX, targetY) {
    // Calculate direction
    const dx = Math.sign(targetX - x);
    const dy = Math.sign(targetY - y);

    return new Projectile(x, y, dx, dy, 10, '•', '#00FFFF', 'magic_missile', 10);
}
