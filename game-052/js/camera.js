// Camera rig: chase / hood / low / cinema, plus a framed shot of the stop
// while you're parked. Every view produces a (position, look-at, fov); the
// rig eases toward it, or cuts hard for cinema shots.

import * as THREE from 'three';
import { FOV } from './config.js';
import { clamp } from './rng.js';

export const CAM_MODES = ['chase', 'hood', 'low', 'cinema'];
export const CAM_LABELS = { chase: 'Chase', hood: 'Hood', low: 'Low', cinema: 'Cinema' };

export class CameraRig {
    constructor(camera, road, car, seed = 1) {
        this.camera = camera;
        this.road = road;
        this.car = car;
        this.mode = 'chase';
        this.pos = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.fov = FOV;
        this.shot = null;
        this.shotT = 0;
        this.snap = true;
        this.stopBlend = 0;
        this.rand = (() => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
        this._p = new THREE.Vector3();
        this._l = new THREE.Vector3();
        this._f = {};
    }

    at(s, u, h, out) {
        const f = this.road.frame(s, this._f);
        return out.set(f.x + f.rx * u, this.road.elevation(s) + h, f.z + f.rz * u);
    }

    setMode(m) {
        if (m === this.mode) return;
        this.mode = m;
        this.shot = null;
        this.snap = m === 'cinema';
    }

    cycle() {
        const i = CAM_MODES.indexOf(this.mode);
        this.setMode(CAM_MODES[(i + 1) % CAM_MODES.length]);
        return this.mode;
    }

    _newShot() {
        const r = this.rand, car = this.car;
        const kinds = ['roadside', 'crane', 'side', 'aerial', 'front', 'tele', 'roadside', 'wheel'];
        let kind;
        do kind = kinds[Math.floor(r() * kinds.length)]; while (this.shot && kind === this.shot.kind);
        const shot = { kind, dur: 7 + r() * 6, side: r() < 0.5 ? -1 : 1, a: r(), b: r() };
        if (kind === 'roadside') {
            shot.anchor = new THREE.Vector3();
            shot.s = car.s + 45 + car.v * 2.2;
            this.at(shot.s, shot.side > 0 ? 11 + r() * 2.5 : -(10.5 + r() * 2.5), 0.8 + r() * 2.8, shot.anchor);
            shot.dur = 30;
        }
        if (kind === 'tele') {
            shot.s0 = car.s + 160 + car.v * 3;
            shot.dur = 9 + r() * 4;
        }
        this.shot = shot;
        this.shotT = 0;
        this.snap = true;
    }

    update(dt, time) {
        const car = this.car, p = this._p, l = this._l;
        let fov = FOV, k = 9;
        const parked = car.stop && (car.mode === 'toBay' || car.mode === 'parked' || (car.mode === 'fromBay' && car._leaveFrom === null));
        this.stopBlend = clamp(this.stopBlend + (parked ? dt / 2.2 : -dt / 1.4), 0, 1);

        if (this.mode === 'chase') {
            this.at(car.s - 7.4, car.u * 0.85, 2.55, p);
            this.at(car.s + 9, car.u * 0.9, 0.95, l);
            fov = FOV + clamp(car.kmh / 140, 0, 1) * 9;
            k = 7;
        } else if (this.mode === 'hood') {
            car.worldAt(0.95, 0, 1.02, p);
            car.worldAt(24, 0, 0.75, l);
            p.y += Math.sin(time * 9) * 0.004 * clamp(car.v / 20, 0, 1);
            fov = 72;
            k = 30;
        } else if (this.mode === 'low') {
            car.worldAt(-4.6, -2.3, 0.5, p);
            car.worldAt(5, 0.2, 0.75, l);
            fov = 58;
            k = 10;
        } else {
            if (!this.shot || this.shotT > this.shot.dur) this._newShot();
            this.shotT += dt;
            const sh = this.shot, t = this.shotT;
            k = 6;
            switch (sh.kind) {
            case 'roadside':
                p.copy(sh.anchor);
                car.worldAt(0, 0, 0.8, l);
                fov = 40;
                k = 12;
                if (car.s > sh.s + 30) this.shot.dur = 0;
                break;
            case 'crane':
                car.worldAt(-17 + t * 0.6, -2, 11 + t * 0.25, p);
                car.worldAt(16, 0, 0, l);
                fov = 55;
                break;
            case 'side':
                car.worldAt(1 + Math.sin(t * 0.2) * 2, sh.side < 0 ? -7.5 : 6, 1.1, p);
                car.worldAt(1, 0, 0.8, l);
                fov = 50;
                break;
            case 'aerial':
                this.at(car.s + 28 - t * 0.8, 26 * sh.side, 42, p);
                car.worldAt(0, 0, 0, l);
                fov = 48;
                break;
            case 'front':
                car.worldAt(9.5 - t * 0.15, 0.4 * sh.side, 1.25, p);
                car.worldAt(0, 0, 0.8, l);
                fov = 52;
                break;
            case 'tele':
                this.at(sh.s0, -14 * sh.side, 22, p);
                car.worldAt(0, 0, 0.8, l);
                fov = 24;
                k = 14;
                if (car.s > sh.s0 - 25) this.shot.dur = 0;
                break;
            case 'wheel':
                car.worldAt(1.8, -1.35 * sh.side, 0.45, p);
                car.worldAt(-6, 0, 0.6, l);
                fov = 64;
                k = 40;
                break;
            }
        }

        // the stop's framed shot, eased in over a couple of seconds
        if (this.stopBlend > 0 && car.stop) {
            const st = car.stop, v = st.view;
            const sm = st.s + 17;
            const drift = Math.sin(time * 0.08) * 1.2;
            const sp = this.at(sm + v.cam[0] + drift, v.cam[1], v.cam[2], new THREE.Vector3());
            const sl = this.at(sm + v.look[0], v.look[1], v.look[2], new THREE.Vector3());
            const e = this.stopBlend * this.stopBlend * (3 - 2 * this.stopBlend);
            p.lerp(sp, e);
            l.lerp(sl, e);
            fov = fov + (48 - fov) * e;
            if (this.stopBlend < 1) k = Math.max(k, 12);
        }

        // portrait screens get a wider lens so the street still reads
        const aspect = this.camera.aspect;
        if (aspect < 1.2) fov = Math.min(100, fov * (1 + (1.2 - aspect) * 0.45));

        if (this.snap) {
            this.pos.copy(p); this.look.copy(l); this.fov = fov;
            this.snap = false;
        } else {
            const a = 1 - Math.exp(-k * dt);
            this.pos.lerp(p, a);
            this.look.lerp(l, a);
            this.fov += (fov - this.fov) * (1 - Math.exp(-4 * dt));
        }
        const cam = this.camera;
        cam.position.copy(this.pos);
        cam.lookAt(this.look);
        if (Math.abs(cam.fov - this.fov) > 0.01) {
            cam.fov = this.fov;
            cam.updateProjectionMatrix();
        }
    }
}
