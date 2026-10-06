// The camera director. Modes:
//   flyover  — a swoop from the green back to the tee along the hole's route (hole intro)
//   aim      — behind the ball along the aim line (lower and closer for putts)
//   flight   — chases the ball, then settles where it stops
//   overhead — the whole hole from above (the "map" view)
//   focus    — frames a point (a boss turn, the cup on a hole-out, a story beat)
// Everything is damped, so switching modes is always a smooth glide.

import * as THREE from 'three';

const _v = new THREE.Vector3();
const damp = (k, dt) => 1 - Math.exp(-k * dt);

export class CameraDirector {
    constructor(camera) {
        this.cam = camera;
        this.mode = 'aim';
        this.pos = new THREE.Vector3(0, 10, -10);
        this.look = new THREE.Vector3();
        this.wantPos = new THREE.Vector3();
        this.wantLook = new THREE.Vector3();
        this.t = 0;
        this.path = null;
        this.orbit = 0;      // player look-around offset (radians)
        this.pitch = 0;
        this.shake = 0;
        this.fovKick = 0;
        this.k = 4;
    }

    snap() { this.pos.copy(this.wantPos); this.look.copy(this.wantLook); }

    flyover(points, onDone) {
        // points: [{x,y,z}] from the cup to the tee
        this.mode = 'flyover';
        this.t = 0;
        const pts = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        this.path = new THREE.CatmullRomCurve3(pts);
        this.pathLen = this.path.getLength();
        this.flyDur = Math.min(7, Math.max(3.5, this.pathLen / 55));
        this.onDone = onDone;
        const p0 = this.path.getPointAt(0);
        this.pos.set(p0.x, p0.y + 30, p0.z + 10);
        this.look.copy(p0);
    }

    setAim(ball, yaw, club, dist) {
        this.mode = 'aim';
        this.ball = ball; this.yaw = yaw; this.club = club; this.dist = dist;
    }
    setFlight(ball) { this.mode = 'flight'; this.ball = ball; this.t = 0; }
    setOverhead(course, ball, target) { this.mode = 'overhead'; this.course = course; this.ball = ball; this.target = target; }
    setFocus(point, from, k = 3) { this.mode = 'focus'; this.focusAt = point.clone ? point.clone() : new THREE.Vector3(point.x, point.y, point.z); this.focusFrom = from.clone ? from.clone() : new THREE.Vector3(from.x, from.y, from.z); this.k = k; }
    setOrbit(cx, cz, r, h, speed = 0.25) { this.mode = 'orbit'; this.orbitC = new THREE.Vector3(cx, 0, cz); this.orbitR = r; this.orbitH = h; this.orbitS = speed; this.t = 0; this.orbitY = 0; }

    update(dt) {
        this.t += dt;
        let k = 4;
        if (this.mode === 'flyover' && this.path) {
            const u = Math.min(1, this.t / this.flyDur);
            const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            const p = this.path.getPointAt(e);
            const ahead = this.path.getPointAt(Math.min(1, e + 0.08));
            const h = 14 + Math.sin(e * Math.PI) * 26;
            this.wantPos.set(p.x, p.y + h, p.z).addScaledVector(_v.copy(p).sub(ahead).setY(0).normalize(), 10);
            this.wantLook.copy(ahead).lerp(this.path.getPointAt(Math.max(0, e - 0.15)), 0.4);
            k = 6;
            if (u >= 1 && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
        } else if (this.mode === 'aim' && this.ball) {
            const B = this.ball;
            const yaw = this.yaw + this.orbit;
            const putt = this.club === 'putter';
            const back = putt ? 5.2 : 8.5, up = putt ? 2.2 + this.pitch * 3 : 3.6 + this.pitch * 5;
            const fx = Math.sin(yaw), fz = Math.cos(yaw);
            const rx = -fz, rz = fx, side = putt ? 0.8 : 1.4;   // a little over the ball's right shoulder, so the golfer stands clear
            this.wantPos.set(B.x - fx * back + rx * side, B.y + up, B.z - fz * back + rz * side);
            const ahead = putt ? Math.min(10, this.dist * 0.6 + 2) : Math.min(60, Math.max(14, this.dist * 0.45));
            this.wantLook.set(B.x + fx * ahead + rx * side * 0.5, B.y + (putt ? 0 : 1.2), B.z + fz * ahead + rz * side * 0.5);
            k = 5;
        } else if (this.mode === 'flight' && this.ball) {
            const B = this.ball;
            const hs = Math.hypot(B.vx, B.vz);
            if (hs > 2) { this.fdx = B.vx / hs; this.fdz = B.vz / hs; }
            const fx = this.fdx ?? 0, fz = this.fdz ?? 1;
            const air = Math.max(0, B.y - (this.groundAt ? this.groundAt(B.x, B.z) : 0));
            const back = 9 + Math.min(10, hs * 0.18);
            this.wantPos.set(B.x - fx * back + fz * 3, B.y + 4 + air * 0.25, B.z - fz * back - fx * 3);
            if (this.groundAt) this.wantPos.y = Math.max(this.wantPos.y, this.groundAt(this.wantPos.x, this.wantPos.z) + 2.5);
            this.wantLook.set(B.x + fx * 4, B.y, B.z + fz * 4);
            k = 3.2;
        } else if (this.mode === 'overhead' && this.course) {
            const c = this.course, B = this.ball, T = this.target;
            const cx = (B.x + T.x) / 2, cz = (B.z + T.z) / 2;
            const span = Math.max(40, Math.hypot(T.x - B.x, T.z - B.z) * 1.15);
            const aspect = this.cam.aspect;
            const h = (span / 2) / Math.tan((this.cam.fov * Math.PI) / 360) / Math.min(1, aspect) + 10;
            const dx = T.x - B.x, dz = T.z - B.z, dl = Math.hypot(dx, dz) || 1;
            this.wantPos.set(cx - (dx / dl) * h * 0.25, (B.y + T.y) / 2 + h, cz - (dz / dl) * h * 0.25);
            this.wantLook.set(cx, (B.y + T.y) / 2, cz);
            k = 4;
        } else if (this.mode === 'focus') {
            this.wantPos.copy(this.focusFrom);
            this.wantLook.copy(this.focusAt);
            k = this.k;
        } else if (this.mode === 'orbit') {
            const a = this.t * this.orbitS;
            this.wantPos.set(this.orbitC.x + Math.sin(a) * this.orbitR, this.orbitC.y + this.orbitH, this.orbitC.z + Math.cos(a) * this.orbitR);
            this.wantLook.set(this.orbitC.x, this.orbitC.y + (this.orbitY ?? 0), this.orbitC.z);
            k = 3;
        }
        const d = damp(k, dt);
        this.pos.lerp(this.wantPos, d);
        this.look.lerp(this.wantLook, Math.min(1, d * 1.4));
        this.cam.position.copy(this.pos);
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt * 2.5);
            const s = this.shake * this.shake * 0.6;
            this.cam.position.x += (Math.random() - 0.5) * s; this.cam.position.y += (Math.random() - 0.5) * s; this.cam.position.z += (Math.random() - 0.5) * s;
        }
        this.cam.lookAt(this.look);
        const fov = this.baseFov + this.fovKick;
        if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
        this.fovKick *= Math.exp(-dt * 3);
    }
}
