/**
 * car.js — arcade off-road car physics on a Track.
 *
 * The car is a point with a heading, a horizontal velocity, a height and a vertical speed. Steering
 * sets a yaw rate (capped by how much cornering force the tyres have at this speed); the velocity is
 * left behind in world space as the body turns, and the tyres bleed off the sideways part of it at a
 * rate set by grip. Low grip (dirt, mud, ice, or the drift button) means the sideways part lingers:
 * that is the drift. Sliding scrubs speed and charges nitro.
 *
 * Vertically the car follows the ground while the ground's curve allows it; when the ground falls
 * away faster than gravity can pull the car down (the lip of a jump, a crest at speed) it takes off.
 *
 * Controls: { throttle 0..1, brake 0..1, steer -1..1 (+ = right), drift bool, nitro bool }.
 */

import { G, CAR_RADIUS } from '../config.js';
import { SURF } from './surfaces.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const NO_INPUT = Object.freeze({ throttle: 0, brake: 0, steer: 0, drift: false, nitro: false });

export class Car {
    constructor(spec, id = 0) {
        this.id = id;
        this.spec = spec;
        this.x = 0; this.y = 0; this.z = 0;
        this.h = 0;                 // heading
        this.vx = 0; this.vz = 0; this.vy = 0;
        this.w = 0;                 // yaw rate
        this.air = false; this.airT = 0;
        this.loc = { i: 0, f: 0, d: 0, tx: 0, tz: 1 };
        this.nitro = spec.nitroCap * 0.4;
        this.boosting = false;
        this.speed = 0; this.vLong = 0; this.vLat = 0; this.slip = 0;
        this.surface = 'dirt';
        this.ghost = 0;             // seconds of no car contact after a reset
        this.steerVis = 0;          // smoothed steer for the front wheels
        this.throttle = 0; this.brake = 0; this.drifting = false;
        this.stuckT = 0;
        this.launch = 0;            // perfect-start boost timer
        this.draft = 0;             // 0..1: tucked into another car's slipstream
        this.events = [];           // sim → view/audio, drained by the race
    }

    /** Put the car on the track at sample i, lateral d, facing along the track. */
    place(track, i, d, speed = 0) {
        const p = track.pointAt(i, 0, d);
        this.x = p.x; this.z = p.z; this.y = p.y;
        this.h = track.head[i];
        this.vx = Math.sin(this.h) * speed; this.vz = Math.cos(this.h) * speed;
        this.vy = 0; this.w = 0; this.air = false; this.airT = 0;
        track.locate(this.x, this.z, i, this.loc);
    }

    step(track, ctl, dt) {
        const sp = this.spec, L = this.loc;
        if (this.ghost > 0) this.ghost -= dt;

        // ---------------------------------------------------------- where are we
        track.locate(this.x, this.z, L.i, L);
        const sName = track.surfaceAt(L.i, L.d);
        const S = SURF[sName] || SURF.dirt;
        this.surface = sName;
        // Better tyres claw back part of what a loose surface takes away.
        const grip = S.grip + (1 - S.grip) * sp.looseGrip * S.loose * 2.2;
        const rough = S.rough * (1 - sp.absorb);

        // Small hops don't lose the road: within the suspension's travel the tyres still bite.
        const gNow = track.heightAt(L.i, L.f, L.d);
        const grounded = !this.air || this.y - gNow < (sp.travel ?? 0.14);
        this.contact = grounded;

        // ---------------------------------------------------------- yaw
        const fx0 = Math.sin(this.h), fz0 = Math.cos(this.h);
        const vLong0 = this.vx * fx0 + this.vz * fz0;
        const spd = Math.hypot(this.vx, this.vz);
        this.drifting = !!ctl.drift && spd > 6 && grounded;
        const aMax = sp.turnGrip * Math.min(1.05, grip) * (this.drifting ? 1.32 : 1);
        const wMax = Math.min(sp.steerRate, aMax / Math.max(spd, 3));
        const speedF = clamp(Math.abs(vLong0) / 5, 0, 1);
        const dir = vLong0 < -0.5 ? -1 : 1;
        let wT = -ctl.steer * wMax * speedF * dir * (this.drifting ? 1.3 : 1);
        if (!grounded) wT = -ctl.steer * 0.6;   // a little air control
        const resp = grounded ? sp.steerResp : 2;
        this.w += (wT - this.w) * Math.min(1, dt * resp);
        this.h += this.w * dt;
        this.steerVis += (ctl.steer - this.steerVis) * Math.min(1, dt * 12);

        // ---------------------------------------------------------- along / across
        const fx = Math.sin(this.h), fz = Math.cos(this.h);
        const rx = -fz, rz = fx;
        let vLong = this.vx * fx + this.vz * fz;
        let vLat = this.vx * rx + this.vz * rz;

        // Nitro.
        const wantBoost = !!ctl.nitro && this.nitro > 0.02 && grounded;
        this.boosting = wantBoost;
        if (this.boosting) this.nitro = Math.max(0, this.nitro - dt);
        if (this.launch > 0) this.launch -= dt;
        const boost = this.boosting || this.launch > 0;

        if (grounded) {
            const pw = (this.power || 1) * (1 + 0.07 * (this.draft || 0));
            const top = sp.top * (boost ? sp.boostTop : 1) * pw;
            let a = 0;
            const thr = clamp(ctl.throttle, 0, 1);
            if (thr > 0) {
                const r = Math.max(0, vLong) / top;
                a += sp.accel * pw * thr * Math.max(0, 1 - Math.pow(r, 2.4));
                if (r > 1) a -= (r - 1) * 12;   // a boost wearing off eases back down
            }
            if (wantBoost || this.launch > 0) a += sp.boostAccel * (vLong < top ? 1 : 0.2);
            if (ctl.brake > 0) {
                if (vLong > 0.8) a -= sp.brake * ctl.brake;
                else if (vLong > -9) a -= sp.accel * 0.55 * ctl.brake;
            }
            // Rolling drag, surface bog, roughness, air drag.
            a -= vLong * (0.05 * (1 - 0.6 * (this.draft || 0)) + S.drag + rough * 0.35);
            // Gravity along the slope.
            const slope = track.slopeAt(L.i) * (fx * L.tx + fz * L.tz);
            a -= G * 0.55 * slope;
            vLong += a * dt;
            if (thr === 0 && !(ctl.brake > 0) && Math.abs(vLong) < 0.3) vLong = 0;

            // Lateral grip: the drift is whatever survives this.
            const k = sp.latGrip * grip * (this.drifting ? 0.3 : 1);
            vLat *= Math.exp(-k * dt);
        } else {
            vLong *= 1 - 0.02 * dt;
        }

        this.vx = fx * vLong + rx * vLat;
        this.vz = fz * vLong + rz * vLat;
        this.vLong = vLong; this.vLat = vLat;
        this.speed = Math.hypot(this.vx, this.vz);
        this.slip = Math.abs(vLat) / Math.max(4, this.speed);

        // Sliding fills the nitro tank.
        if (grounded && this.speed > 10 && this.slip > 0.12)
            this.nitro = Math.min(sp.nitroCap, this.nitro + sp.driftCharge * dt * Math.min(1, this.slip * 2.5));

        // ---------------------------------------------------------- move
        this.x += this.vx * dt;
        this.z += this.vz * dt;
        track.locate(this.x, this.z, L.i, L);

        // Barrier.
        const lim = track.wall - CAR_RADIUS * 0.7;
        if (Math.abs(L.d) > lim) {
            const s = Math.sign(L.d);
            const nx = -L.tz * s, nz = L.tx * s;           // outward normal
            const push = Math.abs(L.d) - lim;
            this.x -= nx * push; this.z -= nz * push;
            const vn = this.vx * nx + this.vz * nz;
            if (vn > 0) {
                this.vx -= nx * vn * 1.25; this.vz -= nz * vn * 1.25;
                const keep = 1 - (1 - sp.wallKeep) * Math.min(1, vn / 9);
                this.vx *= keep; this.vz *= keep;
                // Turn the nose back along the barrier so the car doesn't stay wedged.
                const sg = this.vx * L.tx + this.vz * L.tz >= 0 ? 1 : -1;
                const th = Math.atan2(L.tx * sg, L.tz * sg);
                const dh = Math.atan2(Math.sin(th - this.h), Math.cos(th - this.h));
                this.h += dh * Math.min(1, vn * 0.04);
                if (vn > 2.5) this.events.push({ type: 'wall', car: this.id, v: vn, x: this.x, y: this.y + 0.6, z: this.z });
            }
            track.locate(this.x, this.z, L.i, L);
        }

        // ---------------------------------------------------------- vertical
        const ground = track.heightAt(L.i, L.f, L.d);
        this.groundY = ground;
        if (this.air) {
            this.airT += dt;
            this.vy -= G * dt;
            this.y += this.vy * dt;
            if (this.y <= ground) {
                // Landing: compare the fall with the ground's own slope under the car.
                const gSlope = track.slopeAt(L.i) * (this.vx * L.tx + this.vz * L.tz);
                const impact = gSlope - this.vy;
                this.y = ground;
                this.air = false;
                const airT = this.airT;
                this.airT = 0;
                let loss = 0;
                if (impact > 7) loss = Math.min(0.3, (impact - 7) * 0.025) * (1 - sp.absorb * 0.85);
                this.vx *= 1 - loss; this.vz *= 1 - loss;
                this.vy = gSlope;
                this.justLanded = impact;
                const clean = airT > 0.45 && impact < 9;
                if (clean) this.nitro = Math.min(sp.nitroCap, this.nitro + Math.min(0.9, airT * 0.45));
                if (airT > 0.12) this.events.push({ type: 'land', car: this.id, impact, airT, clean, x: this.x, y: this.y, z: this.z });
            }
        } else {
            const ballistic = this.y + this.vy * dt - 0.5 * G * dt * dt;
            const hold = 0.012;
            if (ballistic > ground + hold && this.speed > 8) {
                this.air = true;
                this.airT = 0;
                this.y = ballistic;
                this.vy -= G * dt;
                this.events.push({ type: 'takeoff', car: this.id });
            } else {
                this.vy = (ground - this.y) / dt;
                // Clamp so a step in the ground can't fire the car into orbit.
                this.vy = clamp(this.vy, -30, 30);
                this.y = ground;
            }
        }
        this.throttle = ctl.throttle; this.brake = ctl.brake;
    }

    /** Back on the racing surface after a crash or getting stuck. */
    reset(track) {
        const i = track.wrap(this.loc.i - 2);
        this.place(track, i, Math.max(-track.hw + 1.5, Math.min(track.hw - 1.5, track.line[i])), 6);
        this.ghost = 2.2;
        this.events.push({ type: 'reset', car: this.id });
    }
}

/** Push overlapping cars apart, trading momentum by mass. */
export function collideCars(cars) {
    const R2 = CAR_RADIUS * 2;
    for (let a = 0; a < cars.length; a++) {
        const A = cars[a];
        if (A.ghost > 0 || A.out) continue;
        for (let b = a + 1; b < cars.length; b++) {
            const B = cars[b];
            if (B.ghost > 0 || B.out) continue;
            if (Math.abs(A.y - B.y) > 2) continue;
            const dx = B.x - A.x, dz = B.z - A.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= R2 * R2 || d2 < 1e-6) continue;
            const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
            const ma = A.spec.mass, mb = B.spec.mass, mt = ma + mb;
            const pen = R2 - d;
            A.x -= nx * pen * (mb / mt); A.z -= nz * pen * (mb / mt);
            B.x += nx * pen * (ma / mt); B.z += nz * pen * (ma / mt);
            const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
            if (rv < 0) {
                const j = (-(1 + 0.35) * rv) / (1 / ma + 1 / mb);
                A.vx -= (j / ma) * nx; A.vz -= (j / ma) * nz;
                B.vx += (j / mb) * nx; B.vz += (j / mb) * nz;
                // A shove spins the lighter car a little.
                const side = (nx * Math.cos(A.h) - nz * Math.sin(A.h));
                A.w += side * (-rv) * 0.05 * (mb / mt);
                B.w -= side * (-rv) * 0.05 * (ma / mt);
                if (-rv > 2) {
                    const ev = { type: 'bump', car: A.id, other: B.id, v: -rv, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 + 0.6, z: (A.z + B.z) / 2 };
                    A.events.push(ev);
                }
            }
        }
    }
}
