/**
 * fauna.js — simple procedural animals: birds (circle overhead) and
 * ground critters (rabbit/deer-ish low-poly blobs that wander via a
 * basic steering behavior). Meshes are tiny (cheap to render many).
 */

import { makeMesh, mergeMesh, buildBox, buildBlob, buildCone } from '../engine/mesh.js';

export function buildBird(rng) {
    const color = [40, 40, 46];
    const m = makeMesh();
    mergeMesh(m, buildBlob(0.18, 0, color, 0.1, rng), 0, 0, 0);
    mergeMesh(m, buildBox(0.6, 0.04, 0.16, color), 0, 0, 0);
    return m;
}

export function buildGroundCritter(rng) {
    const bodyColor = [150 + rng() * 40, 120 + rng() * 30, 90 + rng() * 20];
    const m = makeMesh();
    mergeMesh(m, buildBlob(0.32, 0, bodyColor, 0.15, rng), 0, 0.3, 0);
    mergeMesh(m, buildBlob(0.18, 0, bodyColor, 0.15, rng), 0, 0.42, 0.32);
    // ears
    mergeMesh(m, buildCone(0.05, 0.22, 5, bodyColor), -0.08, 0.62, 0.32);
    mergeMesh(m, buildCone(0.05, 0.22, 5, bodyColor), 0.08, 0.62, 0.32);
    return m;
}

/**
 * Bird flight controller: circles at a fixed radius/height around a center point.
 */
export class Bird {
    constructor(mesh, center, radius, height, speed, phase) {
        this.mesh = mesh;
        this.center = center;
        this.radius = radius;
        this.height = height;
        this.speed = speed;
        this.t = phase;
    }
    update(dt) {
        this.t += dt * this.speed;
    }
    get pos() {
        return [
            this.center[0] + Math.cos(this.t) * this.radius,
            this.height + Math.sin(this.t * 2.3) * 0.6,
            this.center[2] + Math.sin(this.t) * this.radius,
        ];
    }
    get rotY() { return -this.t + Math.PI / 2; }
}

/**
 * Ground critter wander controller: picks a random point within a leash
 * radius of home, walks there, pauses, repeats. Stays grounded via heightmap.
 */
export class Critter {
    constructor(mesh, home, leash, heightmap, rng) {
        this.mesh = mesh;
        this.home = home;
        this.leash = leash;
        this.heightmap = heightmap;
        this.rng = rng;
        this.pos = [home[0], 0, home[2]];
        this.target = this._pickTarget();
        this.pauseT = 0;
        this.speed = 0.7 + rng() * 0.6;
        this.rotY = 0;
    }
    _pickTarget() {
        const a = this.rng() * Math.PI * 2;
        const d = this.rng() * this.leash;
        return [this.home[0] + Math.cos(a) * d, 0, this.home[2] + Math.sin(a) * d];
    }
    update(dt) {
        if (this.pauseT > 0) {
            this.pauseT -= dt;
        } else {
            const dx = this.target[0] - this.pos[0];
            const dz = this.target[2] - this.pos[2];
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < 0.3) {
                this.target = this._pickTarget();
                this.pauseT = 1 + this.rng() * 2;
            } else {
                this.pos[0] += (dx / d) * this.speed * dt;
                this.pos[2] += (dz / d) * this.speed * dt;
                this.rotY = Math.atan2(dx, dz);
            }
        }
        this.pos[1] = this.heightmap.heightAt(this.pos[0], this.pos[2]);
    }
}
