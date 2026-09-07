/**
 * Ship.js — the player craft. Confined to the ring at z=0, moving only
 * along the angle axis (left/right around the tube) — matching N2O/Tempest
 * movement constraints exactly. Firing spawns Bullet entities at the ship's
 * current angle, traveling into the screen (increasing z... see Bullet.js).
 */

import { COLORS, SHIP_ANGULAR_SPEED, SHIP_TOUCH_SPEED, SHIP_BOB_AMOUNT, FIRE_COOLDOWN } from './config.js';
import { toScreen, wrapAngle } from './tunnel.js';
import { events } from './events.js';
import { state } from './state.js';
import { playShot } from './sounds.js';

export class Ship {
    constructor(scene) {
        this.scene = scene;
        this.angle = -Math.PI / 2; // start at top of the ring
        this.z = 0;
        this.fireTimer = 0;
        this.invulnTimer = 0;
        this.flashTimer = 0;

        this.gfx = scene.add.graphics();
        this.gfx.setDepth(50);

        this._bobT = 0;
    }

    moveInput(dir, dt, usingTouch = false) {
        // dir: -1, 0, or 1 (or fractional for analog)
        const speed = usingTouch ? SHIP_TOUCH_SPEED : SHIP_ANGULAR_SPEED;
        this.angle = wrapAngle(this.angle + dir * speed * dt);
    }

    update(dt, firing) {
        this._bobT += dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        this.fireTimer -= dt;
        if (firing && this.fireTimer <= 0 && !state.isGameOver) {
            this.fireTimer = FIRE_COOLDOWN;
            events.emit('shipFire', this.angle);
            playShot();
        }

        this._draw();
    }

    hit() {
        if (this.invulnTimer > 0) return false;
        this.invulnTimer = 1.4;
        this.flashTimer = 1.4;
        return true;
    }

    _draw() {
        const g = this.gfx;
        g.clear();

        const bob = Math.sin(this._bobT * 6) * SHIP_BOB_AMOUNT;
        const pos = toScreen(this.angle, Math.max(0, this.z + bob));

        const blinking = this.invulnTimer > 0 && Math.floor(this.flashTimer * 10) % 2 === 0;
        if (blinking) return;

        const forwardAngle = this.angle + Math.PI; // ship nose points toward tunnel center
        const size = 22;

        // Ship is a stylized delta/arrow craft, oriented to face the tunnel center
        const nose = {
            x: pos.x + Math.cos(forwardAngle) * size,
            y: pos.y + Math.sin(forwardAngle) * size,
        };
        const perp = forwardAngle + Math.PI / 2;
        const wingSpan = size * 0.9;
        const tailBack = 0.55;
        const left = {
            x: pos.x - Math.cos(forwardAngle) * size * tailBack + Math.cos(perp) * wingSpan,
            y: pos.y - Math.sin(forwardAngle) * size * tailBack + Math.sin(perp) * wingSpan,
        };
        const right = {
            x: pos.x - Math.cos(forwardAngle) * size * tailBack - Math.cos(perp) * wingSpan,
            y: pos.y - Math.sin(forwardAngle) * size * tailBack - Math.sin(perp) * wingSpan,
        };

        g.fillStyle(COLORS.ship, 1);
        g.fillTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);

        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);

        // engine glow
        const glowPos = {
            x: pos.x - Math.cos(forwardAngle) * size * 0.8,
            y: pos.y - Math.sin(forwardAngle) * size * 0.8,
        };
        g.fillStyle(COLORS.accent, 0.7);
        g.fillCircle(glowPos.x, glowPos.y, 5);

        // shield ring if shields > base... visual flair when recently gained shield
        if (this.invulnTimer > 0) {
            g.lineStyle(2, COLORS.shieldRing, 0.5);
            g.strokeCircle(pos.x, pos.y, size * 1.4);
        }
    }

    get screenPos() {
        return toScreen(this.angle, this.z);
    }
}
