/**
 * entities.js — Bullet, Enemy, Mushroom, Coin.
 *
 * All entities live in (angle, z) space (see tunnel.js) and are drawn with
 * a shared Graphics object per type for performance (no per-entity sprite
 * texture needed — everything is vector-drawn, matching the Ship/Tunnel style).
 */

import { COLORS, MUSHROOM_HITS_TO_RIPEN, KILL_Z } from './config.js';
import { toScreen, depthScale, angleDiff } from './tunnel.js';

let _idCounter = 1;
function nextId() { return _idCounter++; }

// --- Bullet ---
// Travels from the ship (z=0) toward the vanishing point (z increasing).
export class Bullet {
    constructor(angle, speed) {
        this.id = nextId();
        this.angle = angle;
        this.z = 0.02;
        this.speed = speed;
        this.dead = false;
        this.life = 0;
    }
    update(dt) {
        this.z += this.speed * dt;
        this.life += dt;
        if (this.z >= 1) this.dead = true;
    }
    draw(g) {
        const pos = toScreen(this.angle, this.z);
        const scale = depthScale(this.z);
        g.fillStyle(COLORS.bullet, 1);
        g.fillCircle(pos.x, pos.y, Math.max(2, 5 * scale));
        g.lineStyle(1, 0xffffff, 0.6);
        g.strokeCircle(pos.x, pos.y, Math.max(2, 5 * scale));
    }
}

// --- Enemy (the "insects") ---
// Spawns far away (z near 1) and rushes toward the camera (z decreasing).
const ENEMY_TYPES = {
    drone:  { hp: 1, speedMul: 1.0,  score: 100, radius: 14, color: COLORS.enemy },
    zigzag: { hp: 1, speedMul: 1.15, score: 150, radius: 12, color: COLORS.magenta, wiggle: 2.2 },
    tank:   { hp: 3, speedMul: 0.75, score: 300, radius: 20, color: COLORS.purple },
};

export class Enemy {
    constructor(angle, z, type, speed) {
        this.id = nextId();
        this.angle = angle;
        this.baseAngle = angle;
        this.z = z;
        this.type = type;
        this.def = ENEMY_TYPES[type] || ENEMY_TYPES.drone;
        this.hp = this.def.hp;
        this.speed = speed * this.def.speedMul;
        this.dead = false;
        this.reachedCamera = false;
        this.t = 0;
        this.hitFlash = 0;
    }

    update(dt) {
        this.t += dt;
        this.z -= this.speed * dt;
        if (this.def.wiggle) {
            this.angle = this.baseAngle + Math.sin(this.t * this.def.wiggle) * 0.35;
        }
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.z <= KILL_Z) {
            this.reachedCamera = true;
            this.dead = true;
        }
    }

    hit() {
        this.hp -= 1;
        this.hitFlash = 0.08;
        if (this.hp <= 0) {
            this.dead = true;
            return true; // killed
        }
        return false;
    }

    draw(g) {
        const pos = toScreen(this.angle, Math.max(0, this.z));
        const scale = depthScale(Math.max(0, this.z));
        const r = this.def.radius * scale;
        const color = this.hitFlash > 0 ? 0xffffff : this.def.color;

        g.fillStyle(color, 1);
        // simple insect-like shape: diamond body + wing lines
        g.fillTriangle(pos.x, pos.y - r, pos.x - r, pos.y, pos.x, pos.y + r * 0.4);
        g.fillTriangle(pos.x, pos.y - r, pos.x + r, pos.y, pos.x, pos.y + r * 0.4);

        g.lineStyle(Math.max(1, 2 * scale), 0xffffff, 0.5);
        g.strokeCircle(pos.x, pos.y, r * 0.9);

        if (this.def.hp > 1) {
            // tank pip indicator
            g.fillStyle(0xffffff, 0.8);
            for (let i = 0; i < this.hp; i++) {
                g.fillCircle(pos.x - r * 0.6 + i * r * 0.6, pos.y - r * 1.3, Math.max(1.5, 2 * scale));
            }
        }
    }
}

export function pickEnemyType(difficultyT) {
    const roll = Math.random();
    if (difficultyT > 0.35 && roll < 0.15) return 'tank';
    if (difficultyT > 0.15 && roll < 0.45) return 'zigzag';
    return 'drone';
}

// --- Mushroom (N2O's shield/star pickup) ---
// Must be shot MUSHROOM_HITS_TO_RIPEN times to "ripen" (turn red) — flying
// through a ripe mushroom grants a shield. An unripened mushroom that's
// simply flown past/through grants a bonus star instead.
export class Mushroom {
    constructor(angle, z, speed) {
        this.id = nextId();
        this.angle = angle;
        this.z = z;
        this.speed = speed * 0.65;
        this.hitsTaken = 0;
        this.ripe = false;
        this.collected = false;
        this.dead = false;
        this.pulseT = 0;
    }
    update(dt) {
        this.z -= this.speed * dt;
        this.pulseT += dt;
        if (this.z <= KILL_Z) this.dead = true;
    }
    hit() {
        if (this.ripe || this.collected) return false;
        this.hitsTaken++;
        if (this.hitsTaken >= MUSHROOM_HITS_TO_RIPEN) {
            this.ripe = true;
            return true; // just ripened
        }
        return false;
    }
    collect() {
        if (this.collected) return null;
        this.collected = true;
        this.dead = true;
        return this.ripe ? 'shield' : 'star';
    }
    draw(g) {
        const pos = toScreen(this.angle, Math.max(0, this.z));
        const scale = depthScale(Math.max(0, this.z));
        const r = 13 * scale * (1 + Math.sin(this.pulseT * 4) * 0.06);
        const color = this.ripe ? COLORS.mushroomRipe : COLORS.mushroom;

        // cap
        g.fillStyle(color, 1);
        g.fillEllipse(pos.x, pos.y - r * 0.2, r * 1.8, r * 1.1);
        // stem
        g.fillStyle(0xf0e0ff, 1);
        g.fillRect(pos.x - r * 0.3, pos.y - r * 0.1, r * 0.6, r * 0.9);
        // spots when ripe
        if (this.ripe) {
            g.fillStyle(0xffffff, 0.9);
            g.fillCircle(pos.x - r * 0.6, pos.y - r * 0.3, Math.max(1, r * 0.18));
            g.fillCircle(pos.x + r * 0.5, pos.y - r * 0.5, Math.max(1, r * 0.15));
        }
        g.lineStyle(Math.max(1, scale), 0xffffff, 0.4);
        g.strokeEllipse(pos.x, pos.y - r * 0.2, r * 1.8, r * 1.1);
    }
}

// --- Coin ---
// Simple pickup for score + multiplier; shooting it (before collection)
// increases its value, mirroring N2O's "shoot the coin to raise its worth".
export class Coin {
    constructor(angle, z, speed, baseValue = 50) {
        this.id = nextId();
        this.angle = angle;
        this.z = z;
        this.speed = speed * 0.8;
        this.value = baseValue;
        this.dead = false;
        this.spinT = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.z -= this.speed * dt;
        this.spinT += dt * 6;
        if (this.z <= KILL_Z) this.dead = true;
    }
    boost() {
        this.value += 25;
    }
    collect() {
        this.dead = true;
        return this.value;
    }
    draw(g) {
        const pos = toScreen(this.angle, Math.max(0, this.z));
        const scale = depthScale(Math.max(0, this.z));
        const squash = Math.abs(Math.cos(this.spinT));
        const r = 10 * scale;

        g.fillStyle(COLORS.coin, 1);
        g.fillEllipse(pos.x, pos.y, r * Math.max(0.15, squash), r);
        g.lineStyle(Math.max(1, scale), 0xffffff, 0.7);
        g.strokeEllipse(pos.x, pos.y, r * Math.max(0.15, squash), r);
    }
}

// --- shared collision helper ---
// "Close enough" test in angle + z space, used for ship<->entity and
// bullet<->entity hit checks. Angular threshold widens with proximity to
// the camera (things are bigger/closer together visually near z=0).
export function isNear(angleA, zA, angleB, zB, angleThresh, zThresh) {
    return Math.abs(angleDiff(angleA, angleB)) < angleThresh && Math.abs(zA - zB) < zThresh;
}
