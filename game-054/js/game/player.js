/**
 * player.js — the Warden: movement, health, armour, ammo, keys, powerups.
 *
 * Movement is DOOM-fast with a little modern weight: acceleration towards
 * the wished velocity, friction on the ground, light air control, a jump,
 * smooth stair stepping (the camera eases up steps instead of popping), a
 * landing dip and view bob. Collision and ground come from world.js.
 */
import { PLAYER, AMMO, STEP, GRAVITY, CELL } from '../config.js';
import { input } from '../input.js';
import { sfx } from '../audio.js';

export class Player {
    constructor() {
        this.r = PLAYER.radius;
        this.h = PLAYER.height;
        this.reset();
    }

    reset() {
        this.health = 100;
        this.armor = 0;
        this.armorClass = 0;      // fraction absorbed: 0.33 vest, 0.5 plate
        this.ammo = { bullets: 50, shells: 0, rockets: 0, cells: 0 };
        this.maxAmmo = Object.fromEntries(Object.entries(AMMO).map(([k, v]) => [k, v.max]));
        this.backpack = false;
        this.weapons = new Set(['blade', 'pistol']);
        this.keys = new Set();
        this.powers = { berserk: 0, overdrive: 0, haste: 0, invuln: 0, cloak: 0, suit: 0 };
        this.berserkFist = false;
        this.alive = true;
        this.spawn(0, 0, 0, 0);
    }

    /** What carries over between levels (and what a restart restores). */
    loadout() {
        return {
            health: this.health, armor: this.armor, armorClass: this.armorClass,
            ammo: { ...this.ammo }, backpack: this.backpack, weapons: [...this.weapons],
        };
    }
    applyLoadout(l) {
        this.health = Math.max(100, Math.min(200, l.health));
        this.armor = l.armor; this.armorClass = l.armorClass;
        this.ammo = { ...l.ammo };
        this.backpack = l.backpack;
        this.maxAmmo = Object.fromEntries(Object.entries(AMMO).map(([k, v]) => [k, v.max * (l.backpack ? 2 : 1)]));
        this.weapons = new Set(l.weapons);
        this.keys = new Set();
        this.powers = { berserk: 0, overdrive: 0, haste: 0, invuln: 0, cloak: 0, suit: 0 };
        this.alive = true;
    }

    spawn(x, z, floorY, yaw) {
        this.x = x; this.z = z; this.y = floorY;
        this.vx = 0; this.vz = 0; this.vy = 0;
        this.yaw = yaw; this.pitch = 0;
        this.grounded = true;
        this.eyeOffset = 0;   // smoothing for stair steps
        this.landDip = 0;
        this.bob = 0;
        this.kickPitch = 0;
        this.roll = 0;
        this.stepDist = 0;
        this.hurtT = 0;
        this.liquidT = 0;
        this.bumpT = 0;
        this.bumpCell = -1;
        this.deathT = 0;
    }

    get eyeY() { return this.y + 1.58 + this.eyeOffset - this.landDip * 0.25; }
    eyePos() { return [this.x, this.eyeY, this.z]; }
    forward() { return [Math.sin(this.yaw), 0, -Math.cos(this.yaw)]; }
    right() { return [Math.cos(this.yaw), 0, Math.sin(this.yaw)]; }
    /** world-space muzzle for effects: a little right, down and forward of the eye */
    muzzlePos() {
        const f = this.forward(), r = this.right();
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        return [this.x + f[0] * 0.7 * cp + r[0] * 0.2, this.eyeY - 0.18 + sp * 0.7, this.z + f[2] * 0.7 * cp + r[2] * 0.2];
    }
    kick(a) { this.kickPitch += a; }

    update(dt, world, look) {
        // look
        this.yaw += look.x;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - look.y));
        this.kickPitch *= Math.max(0, 1 - dt * 10);

        if (!this.alive) {
            this.deathT += dt;
            this.eyeOffset += (-1.25 - this.eyeOffset) * Math.min(1, dt * 3);
            this.roll += (0.5 - this.roll) * Math.min(1, dt * 2);
            this.vx *= 0.9; this.vz *= 0.9;
            return;
        }

        // wished velocity
        const haste = this.powers.haste > 0 ? 1.45 : 1;
        const speed = (input.run ? 10.4 : 7.0) * haste;
        const f = this.forward(), r = this.right();
        const wx = (f[0] * input.move.y + r[0] * input.move.x) * speed;
        const wz = (f[2] * input.move.y + r[2] * input.move.x) * speed;
        const k = this.grounded ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 2.5);
        this.vx += (wx - this.vx) * k;
        this.vz += (wz - this.vz) * k;
        this.roll += ((-input.move.x * 0.022) - this.roll) * Math.min(1, dt * 8);

        // jump
        if (input.pressed.has('jump') && this.grounded) {
            this.vy = 7.4; this.grounded = false;
            sfx.jump();
        }

        if (Math.abs(this.vx) < 1e-4) this.vx = 0;
        if (Math.abs(this.vz) < 1e-4) this.vz = 0;
        // horizontal move with collision
        const prevY = this.y;
        const res = world.move(this, this.vx * dt, this.vz * dt, STEP, false);
        if (res.hitX) this.vx *= 0.2;
        if (res.hitZ) this.vz *= 0.2;
        this.bumped = res.bumped;

        // vertical
        const ground = world.groundUnder(this.x, this.z, this.r);
        const ceil = world.ceilOver(this.x, this.z, this.r);
        if (this.grounded && ground < this.y - 0.01 && ground > this.y - STEP - 0.05 && this.vy <= 0) {
            // walking down stairs: stick to the ground
            this.eyeOffset += this.y - ground;
            this.y = ground;
        } else if (ground > this.y && ground - this.y <= STEP + 0.01) {
            // step up: snap the body, ease the eye
            this.eyeOffset -= ground - this.y;
            this.y = ground; this.vy = Math.max(0, this.vy);
            this.grounded = true;
        } else {
            this.vy -= GRAVITY * dt;
            this.y += this.vy * dt;
            if (this.y + this.h > ceil && this.vy > 0) { this.y = ceil - this.h; this.vy = 0; }
            if (this.y <= ground) {
                if (!this.grounded && this.vy < -6) { this.landDip = Math.min(1, -this.vy / 14); sfx.land(this.vy < -11); }
                this.y = ground; this.vy = 0; this.grounded = true;
            } else this.grounded = false;
        }
        this.eyeOffset *= Math.max(0, 1 - dt * 12);
        this.landDip = Math.max(0, this.landDip - dt * 3);

        // footsteps
        const sp = Math.hypot(this.vx, this.vz);
        if (this.grounded && sp > 1) {
            this.stepDist += sp * dt;
            if (this.stepDist > (input.run ? 2.6 : 2.0)) { this.stepDist = 0; sfx.step(world.L.kind[world.cellAt(this.x, this.z)] !== 4 && this.metalFloor); }
        }
        void prevY;
    }

    get vel() { return Math.hypot(this.vx, this.vz); }
    cell(world) { return world.cellAt(this.x, this.z); }
}
export { CELL };
