// First-person walking: keyboard, mouse-drag look, a floating touch joystick
// plus drag-to-look on phones, tap/click-to-walk, and auto-walks that follow
// the paths through the hub. Collides with columns, statues, trees and the sea.

import * as THREE from 'three';
import { clamp, damp, angleDiff, TAU } from './util.js';
import { PLAZA_R, projectOnPath, samplePath } from './layout.js';

const EYE = 1.65;
const WALK = 4.2, RUN = 8.5;
const RADIUS = 0.32;

export class Controls {
    constructor(world, camera, dom) {
        this.world = world;
        this.camera = camera;
        this.dom = dom;
        const sp = world.layout.spawn;
        this.pos = new THREE.Vector3(sp.x, 0, sp.z);
        this.yaw = sp.yaw;
        this.pitch = -0.02;
        this.eyeY = world.walkHeight(sp.x, sp.z) + EYE;
        this.keys = new Set();
        this.vel = new THREE.Vector2();
        this.route = null;
        this.bob = 0;
        this.moving = 0;
        this.joy = null;      // { id, x0, y0, dx, dy }
        this.look = null;     // { id, x, y, moved }
        this.enabled = false;
        this.onTap = null;    // (clientX, clientY, pointerType) => void
        this.onHoverMove = null;
        this.stepDist = 0;
        this.onStep = null;
        this.sensitivity = 0.0032;
        this._bind();
    }

    get speed() {
        return this.vel.length();
    }

    _bind() {
        const d = this.dom;
        addEventListener('keydown', (e) => {
            if (!this.enabled || e.target.closest?.('input, textarea, [contenteditable]')) return;
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
                this.keys.add(k);
                this.route = null;
                if (k.startsWith('arrow')) e.preventDefault();
            }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        addEventListener('blur', () => this.keys.clear());

        d.addEventListener('contextmenu', (e) => e.preventDefault());
        d.addEventListener('pointerdown', (e) => {
            if (!this.enabled) return;
            d.setPointerCapture?.(e.pointerId);
            const touch = e.pointerType === 'touch';
            const rect = d.getBoundingClientRect();
            const leftZone = e.clientX - rect.left < rect.width * 0.4 && e.clientY - rect.top > rect.height * 0.35;
            if (touch && leftZone && !this.joy) {
                this.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: performance.now(), far: 0 };
                this.route = null;
                this.world.ui?.showJoystick(e.clientX, e.clientY, 0, 0);
                return;
            }
            if (!this.look) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, t0: performance.now(), type: e.pointerType, button: e.button };
        });
        d.addEventListener('pointermove', (e) => {
            if (this.joy && e.pointerId === this.joy.id) {
                const max = 55;
                let dx = e.clientX - this.joy.x0, dy = e.clientY - this.joy.y0;
                const l = Math.hypot(dx, dy);
                this.joy.far = Math.max(this.joy.far, l);
                if (l > max) {
                    dx *= max / l;
                    dy *= max / l;
                }
                this.joy.dx = dx / max;
                this.joy.dy = dy / max;
                this.world.ui?.showJoystick(this.joy.x0, this.joy.y0, dx, dy);
                return;
            }
            if (this.look && e.pointerId === this.look.id) {
                const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y;
                if (Math.hypot(e.clientX - this.look.sx, e.clientY - this.look.sy) > 7) this.look.moved = true;
                if (this.look.moved) {
                    const s = this.sensitivity * (this.look.type === 'touch' ? 1.25 : 1);
                    this.yaw -= dx * s;
                    this.pitch = clamp(this.pitch - dy * s, -1.25, 1.2);
                    if (this.route && this.look.type !== 'touch') this.route.freeLook = true;
                }
                this.look.x = e.clientX;
                this.look.y = e.clientY;
                return;
            }
            if (e.pointerType === 'mouse') this.onHoverMove?.(e.clientX, e.clientY);
        });
        const end = (e) => {
            if (this.joy && e.pointerId === this.joy.id) {
                const j = this.joy;
                this.joy = null;
                this.world.ui?.hideJoystick();
                // a quick touch in the joystick corner is still a tap
                if (e.type === 'pointerup' && j.far < 9 && performance.now() - j.t0 < 800) this.onTap?.(e.clientX, e.clientY, 'touch');
                return;
            }
            if (this.look && e.pointerId === this.look.id) {
                const l = this.look;
                this.look = null;
                if (e.type === 'pointerup' && !l.moved && performance.now() - l.t0 < 1200 && l.button === 0) this.onTap?.(e.clientX, e.clientY, l.type);
            }
        };
        d.addEventListener('pointerup', end);
        d.addEventListener('pointercancel', end);
        d.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') this.onHoverMove?.(-1, -1);
        });
    }

    /** Walk somewhere. Targets: {x,z} (straight), or a planned route of points. */
    walkTo(points, face) {
        this.route = { points, i: 0, face, stuck: 0, lastD: Infinity };
    }

    teleport(x, z, yaw) {
        this.pos.set(x, 0, z);
        this.yaw = yaw;
        this.pitch = -0.05;
        this.eyeY = this.world.walkHeight(x, z) + EYE;
        this.route = null;
    }

    /** Route from the player to (x,z) along the path network. */
    plan(tx, tz) {
        const { layout } = this.world;
        const lines = [...layout.spokes.map((s) => s.pts), layout.dock.pts];
        const attach = (x, z) => {
            if (Math.hypot(x, z) < PLAZA_R - 0.5) return { hub: true };
            let best = null;
            lines.forEach((pts, li) => {
                const p = projectOnPath(pts, x, z);
                if (!best || p.d < best.d) best = { ...p, li };
            });
            return best;
        };
        const from = attach(this.pos.x, this.pos.z), to = attach(tx, tz);
        const pts = [];
        const along = (li, s0, s1) => {
            const step = 2.5 * Math.sign(s1 - s0 || 1);
            for (let s = s0; step > 0 ? s < s1 : s > s1; s += step) {
                const p = samplePath(lines[li], s);
                pts.push({ x: p.x, z: p.z });
            }
            const p = samplePath(lines[li], s1);
            pts.push({ x: p.x, z: p.z });
        };
        const hubArc = (a0, a1) => {
            const d = angleDiff(a0, a1);
            const n = Math.max(2, Math.ceil(Math.abs(d) / 0.35));
            for (let i = 0; i <= n; i++) {
                const a = a0 + (d * i) / n;
                pts.push({ x: Math.sin(a) * 7.4, z: Math.cos(a) * 7.4 });
            }
        };
        const angleOf = (li) => Math.atan2(lines[li][3].x, lines[li][3].z);
        if (!from.hub && from.d > 2.5) pts.push({ x: from.x, z: from.z });
        if (!from.hub && !to.hub && from.li === to.li) {
            along(from.li, from.s, to.s);
        } else {
            let a0;
            if (from.hub) a0 = Math.atan2(this.pos.x, this.pos.z);
            else {
                along(from.li, from.s, 0);
                a0 = angleOf(from.li);
            }
            const a1 = to.hub ? Math.atan2(tx, tz) : angleOf(to.li);
            hubArc(a0, a1);
            if (!to.hub) along(to.li, 0, to.s);
        }
        pts.push({ x: tx, z: tz });
        return pts;
    }

    /** Where to stand to look at a statue, and which way to face. */
    standFor(statue) {
        const dx = statue.x - statue.pathX, dz = statue.z - statue.pathZ;
        const l = Math.hypot(dx, dz) || 1;
        const x = statue.pathX + (dx / l) * 0.6, z = statue.pathZ + (dz / l) * 0.6;
        return { x, z, yaw: Math.atan2(-(statue.x - x), -(statue.z - z)) };
    }

    update(dt) {
        if (!this.enabled) return;
        const k = this.keys;
        let fx = 0, fz = 0, turn = 0;
        if (k.has('w') || k.has('arrowup')) fz += 1;
        if (k.has('s') || k.has('arrowdown')) fz -= 1;
        if (k.has('a')) fx -= 1;
        if (k.has('d')) fx += 1;
        if (k.has('arrowleft') || k.has('q')) turn += 1;
        if (k.has('arrowright') || k.has('e')) turn -= 1;
        this.yaw += turn * dt * 1.9;
        let run = k.has('shift');
        if (this.joy) {
            fx += this.joy.dx;
            fz -= this.joy.dy;
            run = run || Math.hypot(this.joy.dx, this.joy.dy) > 0.92;
            // gentle auto-turn when steering mostly sideways
            this.yaw -= this.joy.dx * Math.abs(this.joy.dx) * dt * 1.2;
        }

        let wantX = 0, wantZ = 0;
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        // camera looks along -z when yaw = 0
        const fwdX = -sin, fwdZ = -cos, rightX = cos, rightZ = -sin;
        const mag = Math.min(1, Math.hypot(fx, fz));
        if (mag > 0.05) {
            const l = Math.hypot(fx, fz);
            const speed = (run ? RUN : WALK) * mag;
            wantX = ((fwdX * fz + rightX * fx) / l) * speed;
            wantZ = ((fwdZ * fz + rightZ * fx) / l) * speed;
            this.route = null;
        } else if (this.route) {
            const r = this.route;
            let tgt = r.points[r.i];
            let d = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z);
            // pass a waypoint once within reach of this frame's step
            const reach = Math.max(1.2, (r.run ? RUN : WALK) * dt * 1.5);
            while (d < reach && r.i < r.points.length - 1) {
                r.i++;
                tgt = r.points[r.i];
                d = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z);
            }
            const last = r.i === r.points.length - 1;
            if (last && d < 0.25) {
                this.route = null;
                if (r.face !== undefined) this.faceYaw = r.face;
                this.world.onArrive?.(r);
            } else {
                // never step past the final point, whatever the frame time
                const speed = Math.min(r.run ? RUN : WALK * 1.15, last ? Math.max(1.2, d * 2.5) : 99, last ? d / Math.max(dt, 1e-3) : 99);
                wantX = ((tgt.x - this.pos.x) / d) * speed;
                wantZ = ((tgt.z - this.pos.z) / d) * speed;
                if (!r.freeLook) {
                    const want = Math.atan2(-wantX, -wantZ);
                    this.yaw += angleDiff(this.yaw, want) * (1 - Math.exp(-dt * 4));
                    this.pitch = damp(this.pitch, -0.04, 3, dt);
                }
                r.stuck = this.speed < 0.4 ? r.stuck + dt : 0;
                if (r.stuck > 1.2) this.route = null;
            }
        }
        if (this.faceYaw !== undefined) {
            this.yaw += angleDiff(this.yaw, this.faceYaw) * (1 - Math.exp(-dt * 4));
            this.pitch = damp(this.pitch, 0.05, 3, dt);
            if (Math.abs(angleDiff(this.yaw, this.faceYaw)) < 0.01 || mag > 0.05) this.faceYaw = undefined;
        }
        this.yaw = ((this.yaw % TAU) + TAU) % TAU;

        // accelerate smoothly
        const accel = mag > 0.05 || this.route ? 10 : 12;
        this.vel.x = damp(this.vel.x, wantX, accel, dt);
        this.vel.y = damp(this.vel.y, wantZ, accel, dt);
        this._move(this.vel.x * dt, this.vel.y * dt);

        const ground = this.world.walkHeight(this.pos.x, this.pos.z);
        this.pos.y = ground;
        const sp = this.speed;
        this.moving = damp(this.moving, sp > 0.3 ? 1 : 0, 6, dt);
        this.bob += sp * dt * 1.9;
        this.stepDist += sp * dt;
        if (this.stepDist > (sp > 6 ? 1.6 : 1.25)) {
            this.stepDist = 0;
            this.onStep?.(ground, sp);
        }
        this.eyeY = damp(this.eyeY, ground + EYE, ground + EYE > this.eyeY ? 14 : 9, dt);
        const bobY = Math.sin(this.bob * 2) * 0.035 * this.moving;
        this.camera.position.set(this.pos.x, this.eyeY + bobY, this.pos.z);
        this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * this.moving, 'YXZ');
    }

    _blocked(x, z, fromGround) {
        const w = this.world;
        const g = w.walkHeight(x, z);
        if (!w.onDeck(x, z) && w.island.heightAt(x, z) < 0.35) return true;
        if (g - fromGround > 1.0) return true;
        return false;
    }

    _move(dx, dz) {
        const w = this.world;
        const g0 = w.walkHeight(this.pos.x, this.pos.z);
        // sub-step long moves so we can't tunnel through thin things
        const steps = Math.ceil(Math.hypot(dx, dz) / 0.25) || 1;
        for (let s = 0; s < steps; s++) {
            let nx = this.pos.x + dx / steps, nz = this.pos.z + dz / steps;
            // push out of circles
            for (const c of w.collidersNear(nx, nz)) {
                const ox = nx - c.x, oz = nz - c.z;
                const d = Math.hypot(ox, oz);
                const min = c.r + RADIUS;
                if (d < min && d > 1e-5) {
                    nx = c.x + (ox / d) * min;
                    nz = c.z + (oz / d) * min;
                }
            }
            if (!this._blocked(nx, nz, g0)) {
                this.pos.x = nx;
                this.pos.z = nz;
            } else if (!this._blocked(nx, this.pos.z, g0)) this.pos.x = nx;
            else if (!this._blocked(this.pos.x, nz, g0)) this.pos.z = nz;
        }
    }
}

export { EYE };
