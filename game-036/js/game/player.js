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
    /**
     * True if (x,z) lies inside a building's wall band — i.e. the player is trying
     * to walk through a wall rather than through the doorway.
     *
     * The test is a shell, not a solid: points well inside the building are fine
     * (that's the interior) and points outside are fine; only the ring occupied by
     * the walls blocks. The doorway is an explicit hole in that ring on the +Z
     * face, matching the gap structures.js leaves in the front wall.
     *
     * `fromX/fromZ` is the pre-move position, used to keep a player who is somehow
     * already embedded in a wall from being frozen there permanently.
     */
    _blockedByWall(x, z, fromX, fromZ) {
        const interiors = this.world.chunks && this.world.chunks.buildingInteriors;
        if (!interiors) return false;

        for (const type in interiors) {
            const b = interiors[type];
            const [bx, , bz] = b.pos;
            const t = b.footprint.wallT;
            const lx = x - bx, lz = z - bz;
            const hw = b.w / 2, hd = b.d / 2;

            // Outside the outer shell entirely?
            if (lx < -hw || lx > hw || lz < -hd || lz > hd) continue;
            // Inside the inner void (the room itself)? Then we're not in a wall.
            const inner = 0.001; // guard against exactly-on-the-face float cases
            if (lx > -hw + t + inner && lx < hw - t - inner &&
                lz > -hd + t + inner && lz < hd - t - inner) continue;
            // In the wall band — unless this is the doorway gap on the +Z face.
            if (lz > hd - t - inner && Math.abs(lx) < b.footprint.doorW / 2) continue;

            // Already embedded in this wall before moving? Let them move freely so
            // a bad spawn or a geometry change can't trap the player.
            const fLx = fromX - bx, fLz = fromZ - bz;
            const wasInWall =
                fLx >= -hw && fLx <= hw && fLz >= -hd && fLz <= hd &&
                !(fLx > -hw + t + inner && fLx < hw - t - inner &&
                  fLz > -hd + t + inner && fLz < hd - t - inner) &&
                !(fLz > hd - t - inner && Math.abs(fLx) < b.footprint.doorW / 2);
            if (wasInWall) continue;

            return true;
        }
        return false;
    }

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

        // Building walls are solid. Without this the player walks through the shell
        // and ends up inside geometry that isn't being drawn as an interior yet —
        // which is what made the library look like it had vanished. Axis-separated
        // so sliding along a wall still works instead of stopping dead.
        if (this._blockedByWall(cam.pos[0], cam.pos[2], prevX, prevZ)) {
            if (!this._blockedByWall(prevX, cam.pos[2], prevX, prevZ)) {
                cam.pos[0] = prevX;                 // slide along Z
            } else if (!this._blockedByWall(cam.pos[0], prevZ, prevX, prevZ)) {
                cam.pos[2] = prevZ;                 // slide along X
            } else {
                cam.pos[0] = prevX;
                cam.pos[2] = prevZ;
                moved = 0;
            }
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
