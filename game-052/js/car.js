// Your car. It lives in road coordinates (s along, u across) and is driven
// by intent rather than by steering: pick a speed, pick a lane, pull over.
// Lane changes wait (blinker ticking) until the lane is clear, so nothing
// can ever hit anything.

import * as THREE from 'three';
import {
    LANES, MAX_KMH, START_KMH, ACCEL, DECEL, BRAKE, LANE_CHANGE_SPEED, BAY_U, STOP_LEN, STOP_PROMPT_RANGE,
} from './config.js';
import { buildModel } from './models.js';
import { clamp, lerp, smooth } from './rng.js';
import { LAYER_NO_REFLECT } from './city.js';

export class Car {
    constructor(scene, road, M, events) {
        this.road = road;
        this.events = events;
        this.s = 40;
        this.u = LANES[1];
        this.v = START_KMH / 3.6;
        this.cruise = START_KMH / 3.6;
        this.lane = 1;
        this.targetLane = 1;
        this.blinker = 0;
        this.mode = 'drive';            // drive | toBay | parked | fromBay
        this.wantStop = null;
        this.stop = null;
        this.odo = 0;
        this.input = { up: false, down: false, brake: false };
        this.yawOff = 0;
        this.pitch = 0;
        this.roll = 0;
        this._prevV = this.v;
        this._uVel = 0;
        this.fr = {};

        const model = buildModel('coupe', [0.15, 0.15, 0.2], [1, 0.18, 0.62]);
        this.model = model;
        this.mesh = new THREE.Mesh(model.geometry, M.flat);
        this.mesh.rotation.order = 'YXZ';
        scene.add(this.mesh);

        // underglow
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({
            color: 0xff2fa8, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
            map: M.glowTex,
        }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.06;
        this.mesh.add(glow);
        this.underglow = glow;

        // headlight beams, visible in the rain
        this.beams = [];
        for (const l of model.head) {
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 3.4, 26, 16, 1, true), M.beam(0xfff1d6, 0.16));
            b.geometry.translate(0, -13, 0);
            b.geometry.rotateX(-Math.PI / 2 + 0.06);
            b.position.set(l[0], l[1], l[2]);
            b.layers.set(LAYER_NO_REFLECT);
            this.mesh.add(b);
            this.beams.push(b);
        }
        // glow points for our own lights (drawn by main into the shared points)
        this.lightPts = new THREE.Points(new THREE.BufferGeometry(), M.points);
        const pos = [], col = [], size = [], blink = [];
        const add = (p, c, s, rate = 0, phase = 0, duty = 1) => { pos.push(...p); col.push(...c); size.push(s); blink.push(rate, phase, duty); };
        for (const l of model.head) add(l, [1, 0.95, 0.85], 0.9);
        for (const l of model.tail) add(l, [1, 0.08, 0.1], 0.6);
        // blinkers: left pair then right pair, switched on by colour
        this._blinkStart = pos.length / 3;
        for (const sx of [-1, 1]) {
            add([sx * 0.9, 0.62, 2.3], [0, 0, 0], 0.6, 1.25, 0, 0.5);
            add([sx * 0.9, 0.7, -2.3], [0, 0, 0], 0.6, 1.25, 0, 0.5);
        }
        const g = this.lightPts.geometry;
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
        g.setAttribute('blink', new THREE.Float32BufferAttribute(blink, 3));
        this.lightPts.frustumCulled = false;
        this.lightPts.renderOrder = 3;
        this.mesh.add(this.lightPts);
        this._shownBlinker = null;
    }

    get kmh() { return this.v * 3.6; }

    /** Which of our two lanes the car body overlaps (for traffic following). */
    occupies(lane) {
        if (this.mode === 'parked' || this.mode === 'toBay' && this.u > 7.4) return false;
        return Math.abs(this.u - LANES[lane]) < 2.6;
    }

    setCruise(kmh) { this.cruise = clamp(kmh, 0, MAX_KMH) / 3.6; }

    requestLane(dir) {
        if (this.mode !== 'drive') return false;
        if (this.wantStop && dir < 0) this.cancelStop();
        const t = clamp(this.lane + dir, 0, 1);
        if (t === this.lane && this.targetLane === this.lane) return false;
        this.targetLane = t;
        this.blinker = t === this.lane ? 0 : dir;
        return true;
    }

    /** Next stop that can still be reached by pulling over, or null. */
    reachableStop() {
        const st = this.road.nextStop(this.s + 28);
        if (!st || st.s - this.s > STOP_PROMPT_RANGE) return null;
        return st;
    }

    requestStop() {
        if (this.mode !== 'drive') return null;
        const st = this.reachableStop();
        if (!st) return null;
        this.wantStop = st;
        this.targetLane = 1;
        this.blinker = 1;
        this.events.emit('stopRequested', st);
        return st;
    }

    cancelStop() {
        this.wantStop = null;
        if (this.targetLane === this.lane) this.blinker = 0;
    }

    resume() {
        if (this.mode !== 'parked') return false;
        this.mode = 'fromBay';
        this.blinker = -1;
        this._leaveFrom = null;
        return true;
    }

    update(dt, traffic) {
        const road = this.road;
        let target = this.cruise;
        if (this.input.up) this.setCruise(this.cruise * 3.6 + 28 * dt);
        if (this.input.down) this.setCruise(this.cruise * 3.6 - 34 * dt);
        target = this.cruise;
        const prevU = this.u;

        if (this.mode === 'drive') {
            // lane change, once the gap is there
            if (this.targetLane !== this.lane) {
                const moving = Math.abs(this.u - LANES[this.lane]) > 0.05;
                if (moving || traffic.laneClearFor(this.targetLane, this.s, this.v)) {
                    const goal = LANES[this.targetLane];
                    this.u += Math.sign(goal - this.u) * Math.min(Math.abs(goal - this.u), LANE_CHANGE_SPEED * dt * (0.6 + Math.min(this.v, 20) / 25));
                    if (Math.abs(this.u - goal) < 0.01) {
                        this.u = goal;
                        this.lane = this.targetLane;
                        this.blinker = this.wantStop ? 1 : 0;
                    }
                }
            }
            if (this.wantStop) {
                const st = this.wantStop;
                if (this.s > st.s - 26) {
                    if (this.lane === 1 && this.targetLane === 1) {
                        this.mode = 'toBay';
                        this._bayFrom = this.s;
                        this._bayTo = st.s + STOP_LEN * 0.55;
                        this.stop = st;
                    } else {
                        this.wantStop = null;
                        this.blinker = 0;
                        this.events.emit('stopMissed', st);
                    }
                }
            }
            // adaptive cruise behind whoever is ahead in the lanes we occupy
            let gap = Infinity;
            for (const lane of [0, 1]) if (this.occupies(lane) || lane === this.targetLane) gap = Math.min(gap, traffic.gapAhead(lane, this.s));
            const safe = 7 + this.v * 1.25;
            if (gap < safe) target = Math.min(target, Math.max(0, (gap - 4) / 1.25));
        } else if (this.mode === 'toBay') {
            const p = clamp((this.s - this._bayFrom) / (this._bayTo - this._bayFrom), 0, 1);
            this.u = lerp(LANES[1], BAY_U, smooth(p * 1.25));
            const left = Math.max(0, this._bayTo - this.s);
            target = Math.min(target, Math.max(0.6, Math.sqrt(2 * 2.4 * left)), 14);
            if (left < 0.25) {
                this.mode = 'parked';
                this.v = 0;
                this.blinker = 0;
                this.wantStop = null;
                this.events.emit('parked', this.stop);
            }
        } else if (this.mode === 'parked') {
            target = 0;
        } else if (this.mode === 'fromBay') {
            if (this._leaveFrom === null) {
                target = 0;
                if (traffic.laneClearFor(1, this.s, 0) && traffic.laneClear(1, this.s, 40, 14)) this._leaveFrom = this.s;
            }
            if (this._leaveFrom !== null) {
                const p = clamp((this.s - this._leaveFrom) / 30, 0, 1);
                this.u = lerp(BAY_U, LANES[1], smooth(p));
                target = Math.max(target, 6);
                if (p >= 1) {
                    this.mode = 'drive';
                    this.lane = this.targetLane = 1;
                    this.blinker = 0;
                    this.events.emit('departed', this.stop);
                    this.stop = null;
                }
            }
        }

        if (this.input.brake && this.mode !== 'toBay') target = 0;
        const rate = target > this.v ? ACCEL : (this.input.brake ? BRAKE : DECEL);
        this.v += Math.sign(target - this.v) * Math.min(Math.abs(target - this.v), rate * dt);
        if (this.mode === 'parked') this.v = 0;
        this.s += this.v * dt;
        this.odo += this.v * dt;

        // body attitude: yaw into lane changes, pitch with acceleration
        this._uVel = dt > 0 ? (this.u - prevU) / dt : 0;
        const yaw = this.v > 0.5 ? -Math.atan2(this._uVel, this.v) : 0;
        this.yawOff += (yaw - this.yawOff) * Math.min(1, dt * 6);
        const accel = dt > 0 ? (this.v - this._prevV) / dt : 0;
        this._prevV = this.v;
        this.pitch += (clamp(-accel * 0.006, -0.03, 0.03) - this.pitch) * Math.min(1, dt * 4);
        this.roll += (clamp(this._uVel * 0.02, -0.03, 0.03) - this.roll) * Math.min(1, dt * 4);
        this._place();
        this._lights();
    }

    _place() {
        const f = this.road.frame(this.s, this.fr);
        const y = this.road.elevation(this.s);
        const slope = (this.road.elevation(this.s + 2) - this.road.elevation(this.s - 2)) / 4;
        this.mesh.position.set(f.x + f.rx * this.u, y, f.z + f.rz * this.u);
        this.mesh.rotation.y = f.h + this.yawOff;
        this.mesh.rotation.x = -Math.atan(slope) + this.pitch;
        this.mesh.rotation.z = this.roll;
        this.heading = f.h + this.yawOff;
        this.pos = this.mesh.position;
    }

    _lights() {
        const want = this.blinker;
        if (want === this._shownBlinker) return;
        this._shownBlinker = want;
        const col = this.lightPts.geometry.attributes.color;
        const i0 = this._blinkStart;
        // local +x is the car's left (the road's right is -x in model space)
        for (let k = 0; k < 4; k++) {
            const left = k >= 2;
            const on = (want < 0 && left) || (want > 0 && !left);
            col.setXYZ(i0 + k, on ? 1 : 0, on ? 0.55 : 0, on ? 0.05 : 0);
        }
        col.needsUpdate = true;
    }

    /** World-space position of a point in front of / beside the car. */
    worldAt(along, u, h, out = new THREE.Vector3()) {
        const f = this.road.frame(this.s + along, {});
        return out.set(f.x + f.rx * (this.u + u), this.road.elevation(this.s + along) + h, f.z + f.rz * (this.u + u));
    }
}
