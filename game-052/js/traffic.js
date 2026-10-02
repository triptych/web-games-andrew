// Other traffic: cars on the road (ours and oncoming) and spinners in the sky.
//
// Nothing can crash. Cars follow whatever is ahead in their lane (including
// you) with a simple adaptive-cruise rule, never change lanes, and fade in
// and out beyond the fog. Every light is a glow point in one shared buffer,
// so the whole city's traffic lights draw in a single call and show up in the
// wet-road reflection.

import * as THREE from 'three';
import { LANES, ONCOMING } from './config.js';
import { buildModel, BODY_COLORS } from './models.js';
import { mulberry32 } from './rng.js';
import { LAYER_NO_REFLECT } from './city.js';

const MAX_CARS = 40;
const MAX_SPINNERS = 16;
const MAX_POINTS = MAX_CARS * 4 + MAX_SPINNERS * 6;

const HEAD = [1, 0.92, 0.75], TAIL = [1, 0.07, 0.05];

export class Traffic {
    constructor(scene, road, M, seed) {
        this.scene = scene;
        this.road = road;
        this.M = M;
        this.rand = mulberry32(seed ^ 0x7aff1c);
        this.cars = [];
        this.spinners = [];
        this.policeTimer = 40 + this.rand() * 40;
        this.fr = {};
        this.events = [];

        const g = new THREE.BufferGeometry();
        this.pPos = new Float32Array(MAX_POINTS * 3);
        this.pCol = new Float32Array(MAX_POINTS * 3);
        this.pSize = new Float32Array(MAX_POINTS);
        this.pBlink = new Float32Array(MAX_POINTS * 3);
        g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('blink', new THREE.BufferAttribute(this.pBlink, 3).setUsage(THREE.DynamicDrawUsage));
        this.points = new THREE.Points(g, M.points);
        this.points.frustumCulled = false;
        this.points.renderOrder = 3;
        scene.add(this.points);

        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 7, 1, 24, 1, true), M.beam(0xcfe6ff, 0.5));
        this.beam.layers.set(LAYER_NO_REFLECT);
        this.beam.visible = false;
        this.beam.frustumCulled = false;
        scene.add(this.beam);
        this._v = new THREE.Vector3();
        this._q = new THREE.Quaternion();
        this._up = new THREE.Vector3(0, 1, 0);
    }

    r(a, b) { return a + (b - a) * this.rand(); }

    // ---------------------------------------------------------------
    laneU(lane) { return lane < 2 ? LANES[lane] : ONCOMING[lane - 2]; }

    /** Bumper gap from a 5 m car at s to the nearest car ahead in `lane` (our direction). */
    gapAhead(lane, s) {
        let best = Infinity;
        for (const c of this.cars) {
            if (c.lane === lane && c.s > s) best = Math.min(best, c.s - s - (5 + c.len) / 2);
        }
        return best;
    }

    /**
     * Is there room for a car at s doing speed v to move into `lane`? The gap
     * needed grows with how fast anyone behind is closing, or how fast we'd
     * close on anyone ahead.
     */
    laneClearFor(lane, s, v) {
        for (const c of this.cars) {
            if (c.lane !== lane) continue;
            const d = c.s - s, half = (5 + c.len) / 2;
            if (d >= 0 && d < half + 6 + Math.max(0, v - c.v) * 2.5) return false;
            if (d < 0 && -d < half + 8 + Math.max(0, c.v - v) * 3.2) return false;
        }
        return true;
    }

    laneClear(lane, s, behind, ahead) {
        for (const c of this.cars) if (c.lane === lane && c.s > s - behind && c.s < s + ahead) return false;
        return true;
    }

    /** Bumper-to-bumper gap to the next car along this car's direction of travel. */
    _leaderGap(c) {
        let best = Infinity, lead = null;
        for (const o of this.cars) {
            if (o === c || o.lane !== c.lane) continue;
            const d = (o.s - c.s) * c.dir;
            if (d > 0 && d < best) { best = d; lead = o; }
        }
        // centres are mid-car; allow for half of each car's length
        return lead ? best - (c.len + lead.len) / 2 : Infinity;
    }

    // ---------------------------------------------------------------
    _spawnCar(player, lane, s, v) {
        const R = this.rand;
        const roll = R();
        const kind = roll < 0.55 ? 'sedan' : roll < 0.72 ? 'taxi' : roll < 0.9 ? 'van' : 'truck';
        const model = buildModel(kind, BODY_COLORS[Math.floor(R() * BODY_COLORS.length)]);
        const mesh = new THREE.Mesh(model.geometry, this.M.flat);
        mesh.rotation.order = 'YXZ';
        this.scene.add(mesh);
        this.cars.push({ lane, s, v, vT: v, model, mesh, dir: lane < 2 ? 1 : -1, len: kind === 'truck' ? 9.5 : 5 });
    }

    update(dt, player, camPos, time) {
        const R = this.rand, road = this.road;
        const ps = player.s;

        // --- spawn ---
        let same = 0, onc = 0;
        for (const c of this.cars) (c.dir > 0 ? same++ : onc++);
        if (same < 9 && this.cars.length < MAX_CARS && R() < 0.08) {
            const lane = R() < 0.5 ? 0 : 1;
            const ahead = R() < 0.72;
            const s = ahead ? ps + this.r(280, 620) : ps - this.r(140, 210);
            const v = (ahead ? this.r(42, 78) : Math.max(player.v * 3.6 + this.r(12, 30), 50)) / 3.6;
            if (this.laneClear(lane, s, 30, 30) && !(player.occupies(lane) && Math.abs(s - ps) < 40)) this._spawnCar(player, lane, s, v);
        }
        if (onc < 10 && this.cars.length < MAX_CARS && R() < 0.1) {
            const lane = R() < 0.5 ? 2 : 3;
            const s = ps + this.r(420, 700);
            if (this.laneClear(lane, s, 30, 30)) this._spawnCar(player, lane, s, this.r(45, 80) / 3.6);
        }

        // --- move ---
        const fr = this.fr;
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const c = this.cars[i];
            // follow whoever is ahead in this lane (you included, on our side)
            let gap = this._leaderGap(c);
            if (c.dir > 0 && player.occupies(c.lane) && ps > c.s) gap = Math.min(gap, ps - c.s - (5 + c.len) / 2);
            const safe = 6 + c.v * 1.3;
            let target = c.vT;
            if (gap < safe) target = Math.min(target, Math.max(0, (gap - 4) / 1.3));
            const a = target > c.v ? 2.5 : 8;
            c.v += Math.sign(target - c.v) * Math.min(Math.abs(target - c.v), a * dt);
            c.s += c.v * dt * c.dir;
            if (c.dir > 0 ? (c.s < ps - 260 || c.s > ps + 900) : c.s < ps - 140) { this._remove(i); continue; }
            road.frame(c.s, fr);
            const u = this.laneU(c.lane);
            const y = road.elevation(c.s);
            const slope = (road.elevation(c.s + 2) - road.elevation(c.s - 2)) / 4;
            c.mesh.position.set(fr.x + fr.rx * u, y, fr.z + fr.rz * u);
            c.mesh.rotation.y = c.dir > 0 ? fr.h : fr.h + Math.PI;
            c.mesh.rotation.x = -Math.atan(slope) * c.dir;
        }

        this._updateSpinners(dt, player, camPos, time);
        this._writeLights();
    }

    _remove(i) {
        const c = this.cars[i];
        this.scene.remove(c.mesh);
        this.cars.splice(i, 1);
    }

    // ---------------------------------------------------------------
    _updateSpinners(dt, player, camPos, time) {
        const R = this.rand;
        while (this.spinners.length < 12) this.spinners.push(this._newSpinner(camPos, player, false));

        this.policeTimer -= dt;
        if (this.policeTimer <= 0 && !this.spinners.some((s) => s.police)) {
            this.spinners.push(this._newSpinner(camPos, player, true));
            this.policeTimer = this.r(70, 140);
        }

        let beamOwner = null;
        for (let i = this.spinners.length - 1; i >= 0; i--) {
            const sp = this.spinners[i];
            sp.t += dt;
            if (sp.police) {
                // drift along the road a little slower than you, sweeping a
                // searchlight across the lanes, then climb away
                sp.s += sp.vs * dt;
                const f = this.road.frame(sp.s, this.fr);
                const roadY = this.road.elevation(sp.s);
                const behind = player.s - sp.s;
                if (behind > 120) sp.climb += dt * 12;
                const y = roadY + 32 + sp.climb + Math.sin(sp.t * 0.7) * 1.5;
                const u = Math.sin(sp.t * 0.31) * 4;
                sp.pos.set(f.x + f.rx * u, y, f.z + f.rz * u);
                sp.mesh.rotation.y = f.h + Math.sin(sp.t * 0.4) * 0.3;
                sp.mesh.rotation.z = Math.sin(sp.t * 0.5) * 0.05;
                if (sp.climb < 30) {
                    const sweepU = Math.sin(sp.t * 0.9) * 9, sweepS = sp.s + 8 + Math.sin(sp.t * 0.37) * 10;
                    const tf = this.road.frame(sweepS, {});
                    sp.target = [tf.x + tf.rx * sweepU, this.road.elevation(sweepS), tf.z + tf.rz * sweepU];
                    beamOwner = sp;
                }
                if (sp.climb > 120) { this.scene.remove(sp.mesh); this.spinners.splice(i, 1); continue; }
                if (!sp.announced && sp.s - player.s < 260) { sp.announced = true; this.events.push('police'); }
            } else {
                sp.pos.addScaledVector(sp.vel, dt);
                const dx = sp.pos.x - camPos.x, dz = sp.pos.z - camPos.z;
                if (dx * dx + dz * dz > 950 * 950) { this.scene.remove(sp.mesh); this.spinners.splice(i, 1); continue; }
                const d2 = dx * dx + (sp.pos.y - camPos.y) ** 2 + dz * dz;
                if (!sp.whooshed && d2 < 60 * 60) { sp.whooshed = true; this.events.push('flyby'); }
                sp.mesh.rotation.z = Math.sin(sp.t * 0.8 + sp.phase) * 0.08;
            }
            sp.mesh.position.copy(sp.pos);
        }

        if (beamOwner) {
            const a = beamOwner.pos, b = beamOwner.target;
            const dir = this._v.set(a.x - b[0], a.y - b[1], a.z - b[2]);
            const len = dir.length();
            dir.normalize();
            this.beam.visible = true;
            this.beam.position.set((a.x + b[0]) / 2, (a.y + b[1]) / 2, (a.z + b[2]) / 2);
            this.beam.quaternion.copy(this._q.setFromUnitVectors(this._up, dir));
            this.beam.scale.set(1, len, 1);
        } else this.beam.visible = false;
    }

    _newSpinner(camPos, player, police) {
        const R = this.rand;
        const model = buildModel(police ? 'police' : 'spinner', BODY_COLORS[Math.floor(R() * BODY_COLORS.length)].map((v) => v * 0.9));
        const mesh = new THREE.Mesh(model.geometry, this.M.flat);
        mesh.rotation.order = 'YXZ';
        this.scene.add(mesh);
        const sp = { model, mesh, police, t: 0, phase: R() * 6, pos: new THREE.Vector3(), vel: new THREE.Vector3(), climb: 0 };
        if (police) {
            sp.s = player.s + this.r(380, 520);
            sp.vs = Math.max(4, player.v * 0.55);
            sp.pos.set(0, -999, 0);
            return sp;
        }
        if (R() < 0.35) {
            // cruising a lane in the sky above the road
            const s = player.s + this.r(-100, 600);
            const f = this.road.frame(s, {});
            const u = this.r(-40, 40);
            sp.pos.set(f.x + f.rx * u, this.road.elevation(s) + this.r(28, 70), f.z + f.rz * u);
            const dir = R() < 0.5 ? 1 : -1;
            const spd = this.r(25, 45);
            sp.vel.set(f.tx * dir * spd, 0, f.tz * dir * spd);
        } else {
            const ang = R() * Math.PI * 2, dist = this.r(350, 800);
            sp.pos.set(camPos.x + Math.cos(ang) * dist, this.r(30, 150), camPos.z + Math.sin(ang) * dist);
            const tx = camPos.x + this.r(-220, 220), tz = camPos.z + this.r(-220, 220);
            sp.vel.set(tx - sp.pos.x, 0, tz - sp.pos.z).normalize().multiplyScalar(this.r(22, 48));
        }
        mesh.rotation.y = Math.atan2(sp.vel.x, sp.vel.z);
        sp.pos.y = Math.max(sp.pos.y, 28);
        return sp;
    }

    // ---------------------------------------------------------------
    _writeLights() {
        let n = 0;
        const P = this.pPos, C = this.pCol, S = this.pSize, B = this.pBlink;
        const put = (x, y, z, c, size, rate = 0, phase = 0, duty = 1) => {
            if (n >= MAX_POINTS) return;
            P[n * 3] = x; P[n * 3 + 1] = y; P[n * 3 + 2] = z;
            C[n * 3] = c[0]; C[n * 3 + 1] = c[1]; C[n * 3 + 2] = c[2];
            S[n] = size;
            B[n * 3] = rate; B[n * 3 + 1] = phase; B[n * 3 + 2] = duty;
            n++;
        };
        const xf = (obj, l) => {
            const h = obj.rotation.y, ch = Math.cos(h), sh = Math.sin(h);
            const p = obj.position;
            return [p.x + l[0] * ch + l[2] * sh, p.y + l[1], p.z - l[0] * sh + l[2] * ch];
        };
        for (const c of this.cars) {
            const m = c.model;
            const oncoming = c.dir < 0;
            for (const l of m.head) { const w = xf(c.mesh, l); put(w[0], w[1], w[2], HEAD, oncoming ? 1.15 : 0.7); }
            const braking = c.dir > 0 && c.v < c.vT - 1.5;
            for (const l of m.tail) { const w = xf(c.mesh, l); put(w[0], w[1], w[2], TAIL, braking ? 0.85 : 0.5); }
        }
        for (const sp of this.spinners) {
            const m = sp.model;
            let w = xf(sp.mesh, m.nose); put(w[0], w[1], w[2], [1, 0.95, 0.9], 1.3);
            w = xf(sp.mesh, m.tail); put(w[0], w[1], w[2], [1, 0.1, 0.1], 1.1, 1.1, sp.phase, 0.3);
            for (const l of m.pods) { w = xf(sp.mesh, l); put(w[0], w[1], w[2], sp.police ? [0.6, 0.7, 1] : [0.2, 0.9, 1], 0.8); }
            if (sp.police) {
                w = xf(sp.mesh, [m.bar[0] - 0.3, m.bar[1], m.bar[2]]); put(w[0], w[1], w[2], [1, 0.1, 0.15], 2.2, 2.2, 0, 0.5);
                w = xf(sp.mesh, [m.bar[0] + 0.3, m.bar[1], m.bar[2]]); put(w[0], w[1], w[2], [0.15, 0.35, 1], 2.2, 2.2, 0.5, 0.5);
            }
        }
        const g = this.points.geometry;
        g.setDrawRange(0, n);
        for (const k of ['position', 'color', 'size', 'blink']) g.attributes[k].needsUpdate = true;
    }

    takeEvents() { const e = this.events; this.events = []; return e; }
}
