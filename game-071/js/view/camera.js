/**
 * camera.js — first-person and third-person camera rigs.
 *
 * First person: eye height with a speed-scaled head bob and a crouch dip. Third person: an
 * over-the-shoulder orbit that pulls in when the ground or a collider is in the way.
 */
import * as THREE from 'three';
import { CAM } from '../config.js';

export class CameraRig {
    constructor(camera) {
        this.camera = camera;
        camera.rotation.order = 'YXZ';
        this.bob = 0;
        this.eyeY = CAM.eye;
        this.dist = CAM.thirdDist;
        this.curDist = CAM.thirdDist;
        this.shake = 0;
        this.roll = 0;
        this.fovKick = 0;
        this.baseFov = CAM.fov;
        this.zoom = 0;            // bow zoom 0..1
        this.override = null;     // cinematic: { pos, look, t }
        this._v = new THREE.Vector3();
        this._t = new THREE.Vector3();
    }

    addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

    update(p, space, dt, opts = {}) {
        const cam = this.camera;
        if (this.override) {
            const o = this.override;
            cam.position.lerp(this._v.set(o.pos.x, o.pos.y, o.pos.z), Math.min(1, dt * (o.speed || 2)));
            cam.lookAt(o.look.x, o.look.y, o.look.z);
            return;
        }
        const crouch = p.sneaking ? 0.55 : 0;
        const swim = p.swim ? 0.25 : 0;
        const targetEye = CAM.eye - crouch * 0.75 - swim;
        this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 8);
        const hs = Math.hypot(p.vel.x, p.vel.z);
        if (p.onGround && hs > 0.3) this.bob += dt * hs * (p.sprinting ? 1.55 : 1.75);
        const bobAmp = p.onGround ? Math.min(1, hs / 5) * (p.sneaking ? 0.5 : 1) : 0;
        const bobY = Math.abs(Math.sin(this.bob * Math.PI)) * 0.045 * bobAmp;
        const bobX = Math.sin(this.bob * Math.PI) * 0.025 * bobAmp;
        this.shake = Math.max(0, this.shake - dt * 2.2);
        const sh = this.shake * this.shake;
        const t = performance.now() * 0.001;
        const shx = (Math.sin(t * 37) + Math.sin(t * 53)) * 0.04 * sh, shy = (Math.sin(t * 41) + Math.cos(t * 59)) * 0.04 * sh;

        const yaw = p.camYaw, pitch = p.camPitch;
        if (!p.third) {
            const sy = Math.sin(yaw), cy = Math.cos(yaw);
            cam.position.set(p.pos.x + cy * bobX, p.pos.y + this.eyeY + bobY, p.pos.z - sy * bobX);
            // keep the eye just ahead of the body so the near plane doesn't see inside it
            cam.position.x += -sy * 0.08; cam.position.z += -cy * 0.08;
            cam.rotation.set(pitch + shy, yaw + shx, this.roll);
        } else {
            this.dist = Math.max(1.6, Math.min(8, this.dist + (opts.wheel || 0) * 0.5));
            const pivot = this._t.set(p.pos.x, p.pos.y + this.eyeY + 0.15, p.pos.z);
            const cp = Math.cos(pitch), spch = Math.sin(pitch);
            const sy = Math.sin(yaw), cy = Math.cos(yaw);
            // back along the view direction, and a little right of the shoulder
            const back = this._v.set(sy * cp, -spch, cy * cp);
            const shoulder = 0.45;
            let want = this.dist;
            // pull in if the ground or a collider blocks the line
            for (let s = 1; s <= 12; s++) {
                const d = want * s / 12;
                const x = pivot.x + back.x * d + cy * shoulder, y = pivot.y + back.y * d + 0.2, z = pivot.z + back.z * d - sy * shoulder;
                const g = space.ground(x, z, y + 1);
                if (y < g + 0.35) { want = Math.max(0.6, d - 0.3); break; }
            }
            if (space.colliders) {
                const ex = pivot.x + back.x * want + cy * shoulder, ez = pivot.z + back.z * want - sy * shoulder, ey = pivot.y + back.y * want;
                const hit = space.colliders.raycast(pivot.x, pivot.y, pivot.z, ex, ey, ez);
                if (hit >= 0) want = Math.max(0.6, want * hit - 0.25);
            }
            this.curDist += (want - this.curDist) * Math.min(1, dt * (want < this.curDist ? 18 : 4));
            const d = this.curDist;
            cam.position.set(pivot.x + back.x * d + cy * shoulder * Math.min(1, d / 2), pivot.y + back.y * d + 0.2, pivot.z + back.z * d - sy * shoulder * Math.min(1, d / 2));
            cam.rotation.set(pitch + shy, yaw + shx, 0);
        }
        // field of view: sprint widens it a touch, a drawn bow narrows it
        this.fovKick += ((p.sprinting ? 6 : 0) - this.fovKick) * Math.min(1, dt * 4);
        const fov = this.baseFov + this.fovKick - this.zoom * 28;
        if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    }
}
