/**
 * Spawner.js — decides when/where to spawn enemies, mushrooms, and coins.
 * Difficulty ramps with survival time (spawn interval shrinks) in addition
 * to the ship's kill-driven speed ramp in state.js.
 */

import {
    ENEMY_BASE_INTERVAL, ENEMY_MIN_INTERVAL, MUSHROOM_INTERVAL, COIN_BURST_INTERVAL,
    DIFFICULTY_RAMP_PER_SEC, SPAWN_Z, RING_SEGMENTS,
} from './config.js';
import { Enemy, Mushroom, Coin, pickEnemyType } from './entities.js';

export class Spawner {
    constructor(onSpawn) {
        this.onSpawn = onSpawn; // (entity, kind) => void
        this.survivalTime = 0;
        this.enemyTimer = 0;
        this.mushroomTimer = MUSHROOM_INTERVAL * 0.5;
        this.coinTimer = 1.0;
    }

    reset() {
        this.survivalTime = 0;
        this.enemyTimer = 0;
        this.mushroomTimer = MUSHROOM_INTERVAL * 0.5;
        this.coinTimer = 1.0;
    }

    _difficultyT() {
        return Math.min(1, this.survivalTime * DIFFICULTY_RAMP_PER_SEC);
    }

    _randomLaneAngle() {
        const lane = Math.floor(Math.random() * RING_SEGMENTS);
        return (lane / RING_SEGMENTS) * Math.PI * 2;
    }

    update(dt, forwardSpeed) {
        this.survivalTime += dt;
        const diffT = this._difficultyT();

        this.enemyTimer -= dt;
        if (this.enemyTimer <= 0) {
            const interval = ENEMY_BASE_INTERVAL - (ENEMY_BASE_INTERVAL - ENEMY_MIN_INTERVAL) * diffT;
            this.enemyTimer = interval * (0.75 + Math.random() * 0.5);
            const type = pickEnemyType(diffT);
            const enemy = new Enemy(this._randomLaneAngle(), SPAWN_Z, type, forwardSpeed);
            this.onSpawn(enemy, 'enemy');

            // occasionally spawn a small pack
            if (diffT > 0.3 && Math.random() < 0.25) {
                const extra = new Enemy(this._randomLaneAngle(), SPAWN_Z + 0.08, pickEnemyType(diffT), forwardSpeed);
                this.onSpawn(extra, 'enemy');
            }
        }

        this.mushroomTimer -= dt;
        if (this.mushroomTimer <= 0) {
            this.mushroomTimer = MUSHROOM_INTERVAL * (0.85 + Math.random() * 0.3);
            const mushroom = new Mushroom(this._randomLaneAngle(), SPAWN_Z, forwardSpeed);
            this.onSpawn(mushroom, 'mushroom');
        }

        this.coinTimer -= dt;
        if (this.coinTimer <= 0) {
            this.coinTimer = COIN_BURST_INTERVAL * (0.8 + Math.random() * 0.4);
            // spawn a short arc/burst of coins across a few adjacent lanes
            const startLane = Math.floor(Math.random() * RING_SEGMENTS);
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const lane = (startLane + i) % RING_SEGMENTS;
                const angle = (lane / RING_SEGMENTS) * Math.PI * 2;
                const coin = new Coin(angle, SPAWN_Z + i * 0.03, forwardSpeed);
                this.onSpawn(coin, 'coin');
            }
        }
    }
}
