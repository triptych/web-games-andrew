/**
 * GameScene — main gameplay: tunnel, ship, entities, collisions, scoring.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state } from './state.js';
import { events } from './events.js';
import { BULLET_SPEED } from './config.js';
import { TunnelRenderer } from './TunnelRenderer.js';
import { Ship } from './Ship.js';
import { InputController } from './input.js';
import { Spawner } from './Spawner.js';
import { Bullet, isNear } from './entities.js';
import { angleDiff } from './tunnel.js';
import {
    playEnemyHit, playEnemyDie, playCoinPickup, playMushroomRipen,
    playShieldGain, playShieldLoss, playStarGet, playBonusRoundStart,
} from './sounds.js';

// Angular hit-tolerance for BULLETS: widens slightly near the camera (z small)
// since sprites are bigger there — forgiving up close, precise at range.
function angleTolerance(z) {
    return 0.10 + (1 - Math.min(1, z)) * 0.12;
}

// Ship<->entity collision uses a much tighter angular window than bullets —
// this represents "same lane as the ship", not "somewhere nearby". Without
// this the ship would take damage from enemies a lane or two away.
const SHIP_HIT_ANGLE_TOL = 0.28;   // ~half a lane width at RING_SEGMENTS=16
// Must be wider than one frame's worth of z-travel at MAX_FORWARD_SPEED
// (~0.053 z/frame at 30fps), or fast-moving coins/mushrooms can step clean
// over this window between two update() calls and never register a hit.
const SHIP_HIT_Z_TOL = 0.09;

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        this.tunnel = new TunnelRenderer(this);
        this.ship = new Ship(this);
        this.input_ = new InputController(this);
        this.spawner = new Spawner((entity, kind) => this._registerEntity(entity, kind));

        this.entGfx = this.add.graphics();
        this.entGfx.setDepth(40);

        this.bullets = [];
        this.enemies = [];
        this.mushrooms = [];
        this.coins = [];

        this._offFire = events.on('shipFire', (angle) => {
            this.bullets.push(new Bullet(angle, BULLET_SPEED));
        });

        this._keys = this.input.keyboard.addKeys({
            restart: Phaser.Input.Keyboard.KeyCodes.R,
            escape:  Phaser.Input.Keyboard.KeyCodes.ESC,
        });

        this._offGameOver = events.on('gameOver', () => {
            playShieldLoss();
        });
        this._offBonusStart = events.on('bonusRoundStart', () => {
            playBonusRoundStart();
        });

        this.events.on('shutdown', () => this._cleanup());
    }

    _registerEntity(entity, kind) {
        if (kind === 'enemy') this.enemies.push(entity);
        else if (kind === 'mushroom') this.mushrooms.push(entity);
        else if (kind === 'coin') this.coins.push(entity);
    }

    update(time, delta) {
        const dt = Math.min(delta / 1000, 0.05);

        if (Phaser.Input.Keyboard.JustDown(this._keys.restart)) {
            events.clearAll();
            this.scene.restart();
            this.scene.get('UIScene')?.scene.restart();
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this._keys.escape)) {
            events.clearAll();
            this.input_.destroy();
            this.scene.stop('UIScene');
            this.scene.start('SplashScene');
            return;
        }

        if (state.isGameOver) {
            // freeze gameplay, still render the tunnel gently for atmosphere
            this.tunnel.update(dt * 0.3, 0.35);
            return;
        }

        this.input_.update();
        this.ship.moveInput(this.input_.steer, dt, this.input_.usingTouch);
        this.ship.update(dt, this.input_.firing);

        state.decaySpeed(dt);
        const speed = state.forwardSpeed;

        this.tunnel.update(dt, speed);
        this.spawner.update(dt, speed);

        this._updateBullets(dt);
        this._updateEnemies(dt, speed);
        this._updateMushrooms(dt);
        this._updateCoins(dt);

        this._handleCollisions();
        this._drawEntities();
    }

    _updateBullets(dt) {
        for (const b of this.bullets) b.update(dt);
        this.bullets = this.bullets.filter(b => !b.dead);
    }

    _updateEnemies(dt, speed) {
        const shipAngle = this.ship.angle;
        for (const e of this.enemies) {
            e.update(dt);
            if (e.reachedCamera) {
                // Only costs a shield if the enemy was actually in the ship's
                // lane when it reached the camera plane — otherwise it just
                // rushes past harmlessly (you dodged it).
                const inShipLane = Math.abs(angleDiff(shipAngle, e.angle)) < SHIP_HIT_ANGLE_TOL;
                if (inShipLane) {
                    if (this.ship.hit()) {
                        state.loseShield();
                    }
                    state.resetMultiplier();
                }
            }
        }
        this.enemies = this.enemies.filter(e => !e.dead);
    }

    _updateMushrooms(dt) {
        for (const m of this.mushrooms) {
            m.update(dt);
            if (m.dead && !m.collected) {
                // expired without being collected — no penalty
            }
        }
        this.mushrooms = this.mushrooms.filter(m => !m.dead);
    }

    _updateCoins(dt) {
        for (const c of this.coins) c.update(dt);
        this.coins = this.coins.filter(c => !c.dead);
    }

    _handleCollisions() {
        // Bullets vs enemies
        for (const b of this.bullets) {
            if (b.dead) continue;
            for (const e of this.enemies) {
                if (e.dead) continue;
                if (isNear(b.angle, b.z, e.angle, e.z, angleTolerance(e.z), 0.09)) {
                    b.dead = true;
                    const killed = e.hit();
                    if (killed) {
                        state.addScore(e.def.score);
                        state.bumpMultiplier(1);
                        state.onKill();
                        playEnemyDie();
                    } else {
                        playEnemyHit();
                    }
                    break;
                }
            }
        }

        // Bullets vs mushrooms (ripen them)
        for (const b of this.bullets) {
            if (b.dead) continue;
            for (const m of this.mushrooms) {
                if (m.dead || m.ripe) continue;
                if (isNear(b.angle, b.z, m.angle, m.z, angleTolerance(m.z), 0.09)) {
                    b.dead = true;
                    if (m.hit()) playMushroomRipen();
                    break;
                }
            }
        }

        // Bullets vs coins (boost value)
        for (const b of this.bullets) {
            if (b.dead) continue;
            for (const c of this.coins) {
                if (c.dead) continue;
                if (isNear(b.angle, b.z, c.angle, c.z, angleTolerance(c.z), 0.09)) {
                    b.dead = true;
                    c.boost();
                    break;
                }
            }
        }

        // Note: ship-vs-enemy collision is handled in _updateEnemies (when an
        // enemy reaches the camera plane in the ship's lane) — not here.
        const shipAngle = this.ship.angle;

        // Ship vs mushrooms (fly through to collect)
        for (const m of this.mushrooms) {
            if (m.dead || m.collected) continue;
            if (isNear(shipAngle, 0, m.angle, m.z, SHIP_HIT_ANGLE_TOL, SHIP_HIT_Z_TOL)) {
                const result = m.collect();
                if (result === 'shield') {
                    state.gainShield(1);
                    playShieldGain();
                } else if (result === 'star') {
                    state.addStar();
                    playStarGet();
                }
            }
        }

        // Ship vs coins (collect)
        for (const c of this.coins) {
            if (c.dead) continue;
            if (isNear(shipAngle, 0, c.angle, c.z, SHIP_HIT_ANGLE_TOL, SHIP_HIT_Z_TOL)) {
                const value = c.collect();
                state.addScore(value);
                playCoinPickup(1 + Math.min(1, value / 200));
            }
        }
    }

    _drawEntities() {
        const g = this.entGfx;
        g.clear();
        // draw far-to-near for correct overlap
        const all = [...this.enemies, ...this.mushrooms, ...this.coins]
            .sort((a, b) => b.z - a.z);
        for (const ent of all) ent.draw(g);
        for (const b of this.bullets) b.draw(g);
    }

    _cleanup() {
        if (this._offFire) this._offFire();
        if (this._offGameOver) this._offGameOver();
        if (this._offBonusStart) this._offBonusStart();
        if (this.input_) this.input_.destroy();
    }
}
