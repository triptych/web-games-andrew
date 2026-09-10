/**
 * player.js — first-person movement, ground collision, gravity/jump, and
 * footstep sound cadence.
 *
 * Collision is against the heightmap, with one exception: the cave tunnel is
 * the only place in the world with real overhead geometry, so while the player
 * is inside it they walk on the tunnel floor instead of the terrain surface
 * above them (see _groundHeight).
 */

import { clamp } from '../engine/math.js';
import { PLAYER_EYE_HEIGHT, PLAYER_SPEED, PLAYER_SPRINT_MULT, GRAVITY, JUMP_SPEED, WADE_FLOOR } from '../config.js';
import { playFootstep } from '../sounds.js';

export class Player {
    constructor(camera, world, startPos) {
        this.camera = camera;
        this.world = world;
        this.heightmap = world.heightmap;
        this.camera.pos = [startPos[0], this.heightmap.heightAt(startPos[0], startPos[2]) + PLAYER_EYE_HEIGHT, startPos[2]];
        this.velY = 0;
        this.grounded = true;
        this.keys = new Set();
        this._footstepDist = 0;

        this._onKeyDown = (e) => this.keys.add(e.code);
        this._onKeyUp = (e) => this.keys.delete(e.code);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    _inCave(pos) {
        return this.world.isInsideCave ? this.world.isInsideCave(pos) : false;
    }

    /**
     * Height of the surface the player stands on at (x,z), given their current
     * elevation. Normally that's the terrain, but the cave tunnel passes *under*
     * the hillside — so once the player is within the tube, the floor beneath
     * them is the tunnel's, not the terrain's, or they'd be shoved back up
     * through the roof and could never get inside.
     */
    _groundHeight(x, z, currentY) {
        const caveFloor = this.world.caveFloorAt
            ? this.world.caveFloorAt(x, z, currentY)
            : null;
        if (caveFloor !== null && caveFloor !== undefined) return caveFloor;
        return this.heightmap.heightAt(x, z);
    }

    update(dt) {
        const cam = this.camera;
        const fwd = cam.forwardXZ();
        const right = cam.rightXZ();

        let mx = 0, mz = 0;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) { mx += fwd[0]; mz += fwd[2]; }
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) { mx -= fwd[0]; mz -= fwd[2]; }
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { mx += right[0]; mz += right[2]; }
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) { mx -= right[0]; mz -= right[2]; }

        const len = Math.hypot(mx, mz);
        const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        const speed = PLAYER_SPEED * (sprinting ? PLAYER_SPRINT_MULT : 1);

        const prevX = cam.pos[0], prevZ = cam.pos[2];
        let moved = 0;
        if (len > 0.001) {
            mx /= len; mz /= len;
            const dx = mx * speed * dt, dz = mz * speed * dt;
            cam.pos[0] += dx;
            cam.pos[2] += dz;
            moved = Math.hypot(dx, dz);
        }

        const feetY = cam.pos[1] - PLAYER_EYE_HEIGHT;

        // Wading limit: the player may walk into the shallows but never past
        // WADE_FLOOR below sea level. Without this the camera drops under the ocean
        // surface, and since water is only a surface (there's no underwater pass)
        // the view turns into empty background — so treat it as a wall, not a nudge.
        // The cave floor legitimately runs below sea level, so it's exempt.
        const insideCaveNow = this._inCave(cam.pos);
        if (!insideCaveNow && this.heightmap.heightAt(cam.pos[0], cam.pos[2]) < WADE_FLOOR) {
            cam.pos[0] = prevX;
            cam.pos[2] = prevZ;
            moved = 0;
        }

        // Resolve the standing surface only after the position is final, so a
        // reverted step doesn't get its height from the rejected location.
        const inCave = this._inCave(cam.pos);
        const groundY = this._groundHeight(cam.pos[0], cam.pos[2], feetY);
        // Stand on the shallow seabed, but never let the eye sink below the surface.
        const feetTarget = inCave ? groundY : Math.max(groundY, WADE_FLOOR);

        if (this.keys.has('Space') && this.grounded) {
            this.velY = JUMP_SPEED;
            this.grounded = false;
        }

        this.velY -= GRAVITY * dt;
        let newFeetY = feetY + this.velY * dt;
        if (newFeetY <= feetTarget) {
            newFeetY = feetTarget;
            this.velY = 0;
            this.grounded = true;
        }
        cam.pos[1] = newFeetY + PLAYER_EYE_HEIGHT;

        // Footstep cadence based on distance traveled while grounded.
        if (this.grounded && moved > 0) {
            this._footstepDist += moved;
            if (this._footstepDist > 2.2) {
                this._footstepDist = 0;
                playFootstep();
            }
        }
    }
}
