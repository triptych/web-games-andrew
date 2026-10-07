/**
 * ai.js — computer drivers. Each one aims at a point a speed-dependent distance down its racing line,
 * plans its speed from the curvature ahead (how fast can I take that bend, and can I brake for it
 * from here), squeezes past slower cars, and fires nitro on straights.
 *
 * Skill (0..1) sets how close to the limit it brakes, how tidy its line is and how cleverly it uses
 * nitro. The same driver, given the player's car, is the test bot in dev/simtest.mjs.
 */

import { Rng } from '../rng.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Driver {
    constructor(car, opts = {}, seed = 1) {
        this.car = car;
        this.skill = opts.skill ?? 0.8;
        this.lane = opts.lane ?? 0;            // preferred offset from the racing line (-1..1)
        this.nitroHappy = opts.nitroHappy ?? 0.6;
        this.rng = new Rng(seed);
        this.phase = this.rng.next() * 100;
        this.avoid = 0;
        this.passT = 0;
        this.passSide = 0;
        this.ctl = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false };
    }

    controls(track, cars, t) {
        const car = this.car, sp = car.spec, ctl = this.ctl;
        const N = track.N, ds = track.ds;
        const i = car.loc.i;
        const v = car.speed;
        const sk = this.skill;

        // ---------------------------------------------------------- lane: racing line + traffic
        // Blocked by a car just ahead: pick the side with more room and commit to the pass for a
        // couple of seconds, aiming alongside them rather than up their bumper.
        let blocker = null, bd = Infinity;
        for (const o of cars) {
            if (o === car || o.out || o.ghost > 0) continue;
            const ahead = track.delta(i, o.loc.i) * ds;
            if (ahead < -1 || ahead > 14) continue;
            if (Math.abs(o.loc.d - car.loc.d) > 2.8) continue;
            if (ahead < bd) { bd = ahead; blocker = o; }
        }
        if (this.passT > 0) this.passT -= 1 / 120;
        if (blocker && v > blocker.speed - 2.5 && (this.passT <= 0 || !this.passSide)) {
            const roomL = blocker.loc.d + track.hw, roomR = track.hw - blocker.loc.d;
            this.passSide = roomR > roomL ? 1 : -1;
            this.passT = 2.2;
        }
        let want = 0;
        if (this.passT > 0 && this.passSide) {
            const ref = blocker ? blocker.loc.d : car.loc.d;
            want = ref + this.passSide * 3.4 - track.line[(i + 6) % N];
        } else this.passSide = 0;
        this.avoid += (clamp(want, -track.hw, track.hw) - this.avoid) * 0.06;
        const wobble = Math.sin(t * 0.37 + this.phase) * (1 - sk) * 2.2;

        // ---------------------------------------------------------- steering
        const look = 6 + v * 0.42;
        const iT = (i + Math.max(2, Math.round(look / ds))) % N;
        let lat = track.line[iT] * (0.55 + 0.45 * sk) + this.lane * track.hw * 0.3 + this.avoid + wobble;
        lat = clamp(lat, -track.hw + 1.2, track.hw - 1.2);
        const p = track.pointAt(iT, 0, lat);
        const desired = Math.atan2(p.x - car.x, p.z - car.z);
        const err = wrapA(desired - car.h);
        // A positive error means the target is to the left; right steering is positive.
        ctl.steer = clamp(-err * 2.6 + car.w * 0.12, -1, 1);

        // ---------------------------------------------------------- speed plan
        const skF = 0.78 + 0.2 * sk;
        const dec = sp.brake * 0.75;
        const top = sp.top * (car.power || 1);
        let vT = top * 1.2;
        const reach = Math.min(N >> 1, Math.ceil((v * v / (2 * dec) + 30) / ds));
        for (let j = 1; j <= reach; j++) {
            const ij = (i + j) % N;
            const k = Math.abs(track.kap[ij]);
            if (k < 0.004) continue;
            // The grip where the car will be: ice and mud patches included, tyres helping.
            const g = track.gripLine[ij];
            const gEff = g + (1 - g) * sp.looseGrip * 2.2;
            const vmax = Math.sqrt(sp.turnGrip * Math.min(1.05, gEff) * skF / k);
            const allowed = Math.sqrt(vmax * vmax + 2 * dec * Math.min(1, gEff + 0.2) * j * ds);
            if (allowed < vT) vT = allowed;
        }
        // Ease off when the nose is badly out of line (after a spin or a shove).
        if (Math.abs(err) > 0.7) vT = Math.min(vT, 12);
        if (v < vT - 0.6) { ctl.throttle = 1; ctl.brake = 0; }
        else if (v < vT + 1.5) { ctl.throttle = 0.35; ctl.brake = 0; }
        else { ctl.throttle = 0; ctl.brake = clamp((v - vT) / 5, 0.3, 1); }

        // Pointing the wrong way: back up and turn.
        const fwd = Math.sin(car.h) * car.loc.tx + Math.cos(car.h) * car.loc.tz;
        if (fwd < -0.2 && v < 6) { ctl.throttle = 1; ctl.brake = 0; }

        // ---------------------------------------------------------- nitro and drift
        const straight = vT > v + 6 && Math.abs(err) < 0.12;
        ctl.nitro = car.nitro > 0.6 && straight && v > 12 && (this.rng.next() < this.nitroHappy * (0.4 + sk) || car.boosting || (this.passT > 0 && car.nitro > 1));
        ctl.drift = false;
        return ctl;
    }
}
