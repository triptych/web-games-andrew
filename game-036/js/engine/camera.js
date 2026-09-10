/**
 * camera.js — first-person camera state + Pointer Lock mouse-look.
 * Movement/collision is handled by game/player.js; this module only
 * owns the camera pose and raw look input.
 */

import { clamp } from './math.js';

export class FirstPersonCamera {
    constructor(canvas) {
        this.canvas = canvas;
        this.pos = [0, 1.7, 0];
        this.yaw = 0;     // radians, 0 = looking toward -Z... actually +Z per forward calc
        this.pitch = 0;   // radians, clamped to avoid flipping
        this.sensitivity = 0.0022;
        this.locked = false;

        this._onMouseMove = this._onMouseMove.bind(this);
        this._onLockChange = this._onLockChange.bind(this);
        document.addEventListener('pointerlockchange', this._onLockChange);
    }

    requestLock() {
        if (document.pointerLockElement !== this.canvas) {
            this.canvas.requestPointerLock();
        }
    }

    exitLock() {
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    _onLockChange() {
        this.locked = document.pointerLockElement === this.canvas;
        if (this.locked) {
            document.addEventListener('mousemove', this._onMouseMove);
        } else {
            document.removeEventListener('mousemove', this._onMouseMove);
        }
    }

    _onMouseMove(e) {
        this.yaw += e.movementX * this.sensitivity;
        this.pitch -= e.movementY * this.sensitivity;
        this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    }

    /** Forward direction on the XZ plane (for movement, ignores pitch). */
    forwardXZ() {
        return [Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
    }

    /** Right direction on the XZ plane. */
    rightXZ() {
        return [Math.cos(this.yaw), 0, Math.sin(this.yaw)];
    }

    destroy() {
        document.removeEventListener('pointerlockchange', this._onLockChange);
        document.removeEventListener('mousemove', this._onMouseMove);
    }
}
