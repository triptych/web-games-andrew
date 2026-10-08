// A fox spirit from Worldroot (game-065) who, on about one visit in five,
// trots out of the undergrowth some way ahead of you, stops to look, then
// thinks better of it and bolts. One fox, once per visit; on the other visits
// nothing is built at all.
//
// ?fox=1 always sends it (and soon); ?fox=0 never does.

import * as THREE from 'three';
import { makeFox, animateFox } from '../../game-065/js/view/fox.js';
import { glowSprite } from './textures.js';

export const FOX_CHANCE = 0.2;

const TROT = 2.4;          // m/s coming in
const RUN = 7.5;           // m/s running away
const SCALE = 1.15;        // Worldroot's fox is ~0.6 m to the ear tips; a touch bigger reads better here
const STARTLE = 3.2;       // m: walk this close and it runs
const CLEAR = 0.45;        // m of room it needs around trunks, columns and statues

export class FoxVisitor {
    /**
     * @param {object} opts  chance (0..1), force ('1' | '0' | null), rand (() => 0..1)
     */
    constructor(scene, world, controls, camera, opts = {}) {
        const rand = opts.rand || Math.random;
        this.world = world;
        this.controls = controls;
        this.camera = camera;
        this.rand = rand;
        this.state = 'none';
        const forced = opts.force === '1' ? true : opts.force === '0' ? false : null;
        this.coming = forced ?? rand() < (opts.chance ?? FOX_CHANCE);
        if (!this.coming) return;
        // wait a while after the visitor starts walking, so it feels like a chance meeting
        this.wait = forced ? 2 : 15 + rand() * 45;
        this.tries = 0;
        this.state = 'waiting';
        this.fox = makeFox({ glow: glowSprite() });
        this.fox.scale.setScalar(SCALE);
        this.fox.visible = false;
        this.fox.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        scene.add(this.fox);
        this.heading = 0;
        this.clock = 0;
        this.path = null;
    }

    /** Is (x, z) somewhere a fox could stand: dry land, not inside a trunk, column or statue? */
    _open(x, z) {
        const w = this.world;
        if (w.island.heightAt(x, z) < 0.25) return false;
        for (const c of w.collidersNear(x, z)) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + CLEAR) ** 2) return false;
        return true;
    }

    _clearLine(a, b) {
        const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(d / 0.8));
        for (let i = 0; i <= n; i++) if (!this._open(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false;
        return true;
    }

    /** Where it comes from (off to one side, ahead), where it stops to look, and where it runs to. */
    _plan() {
        const p = this.controls.pos;
        const f = this.camera.getWorldDirection(new THREE.Vector3()).setY(0);
        if (f.lengthSq() < 1e-6) return null;
        f.normalize();
        const side = new THREE.Vector3(-f.z, 0, f.x);
        for (let k = 0; k < 14; k++) {
            const s = this.rand() < 0.5 ? -1 : 1;
            const stopAng = (this.rand() - 0.5) * 0.7, stopDist = 5 + this.rand() * 2.5;
            const fw = f.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, stopAng);
            const stop = { x: p.x + fw.x * stopDist, z: p.z + fw.z * stopDist };
            const from = { x: stop.x + side.x * s * 11 + f.x * 5, z: stop.z + side.z * s * 11 + f.z * 5 };
            // away from the visitor, veering off to the side it didn't come from
            const away = new THREE.Vector3(stop.x - p.x, 0, stop.z - p.z).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -s * (0.5 + this.rand() * 0.5));
            const to = { x: stop.x + away.x * 30, z: stop.z + away.z * 30 };
            const mid = { x: stop.x + away.x * 14, z: stop.z + away.z * 14 };
            if (this._clearLine(from, stop) && this._clearLine(stop, mid) && this._open(to.x, to.z)) return { from, stop, to };
        }
        return null;
    }

    _place(x, z) {
        this.fox.position.set(x, this.world.walkHeight(x, z), z);
    }

    /** Turn toward (x, z) and step `speed * dt` along; returns the distance left. */
    _step(x, z, speed, dt) {
        const fp = this.fox.position;
        const dx = x - fp.x, dz = z - fp.z, d = Math.hypot(dx, dz);
        if (d < 1e-4) return 0;
        // the model faces +x: rotation.y = atan2(-dz, dx) points it along (dx, dz)
        const want = Math.atan2(-dz, dx);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 8);
        this.fox.rotation.y = this.heading;
        const s = Math.min(d, speed * dt);
        this._place(fp.x + dx / d * s, fp.z + dz / d * s);
        return d - s;
    }

    /** Called every frame. `paused` holds the wait while a card or the library is open. */
    update(dt, t, enabled, paused) {
        if (this.state === 'none' || this.state === 'gone') return;
        const p = this.controls.pos;
        if (this.state === 'waiting') {
            if (!enabled || paused) return;
            this.wait -= dt;
            if (this.wait > 0) return;
            this.path = this._plan();
            if (!this.path) {
                // nowhere open nearby (on a narrow dock, among the columns): look again a little later
                this.wait = 6;
                if (++this.tries > 60) this.state = 'gone';      // about six minutes of looking
                return;
            }
            const { from, stop } = this.path;
            this.heading = Math.atan2(-(stop.z - from.z), stop.x - from.x);
            this.fox.rotation.y = this.heading;
            this._place(from.x, from.z);
            this.fox.visible = true;
            this.state = 'coming';
            this.clock = 0;
        }
        this.clock += dt;
        const fp = this.fox.position;
        const near = Math.hypot(p.x - fp.x, p.z - fp.z);
        if (this.state === 'coming') {
            const left = this._step(this.path.stop.x, this.path.stop.z, TROT, dt);
            animateFox(this.fox, t, dt, true, 0);
            if (near < STARTLE) this._flee();
            else if (left < 0.05) { this.state = 'looking'; this.clock = 0; this.look = 1.4 + this.rand() * 1.6; }
        } else if (this.state === 'looking') {
            // head turns to the visitor, within what a neck can do
            let rel = Math.atan2(-(p.z - fp.z), p.x - fp.x) - this.heading;
            rel = Math.atan2(Math.sin(rel), Math.cos(rel));
            animateFox(this.fox, t, dt, false, THREE.MathUtils.clamp(rel, -1.2, 1.2));
            if (near < STARTLE || this.clock > this.look) this._flee();
        } else if (this.state === 'fleeing') {
            this._step(this.path.to.x, this.path.to.z, RUN, dt);
            animateFox(this.fox, t * 1.9, dt, true, 0);      // a quicker stride: a gallop, not a trot
            if (Math.hypot(p.x - fp.x, p.z - fp.z) > 28 || this.clock > 7) {
                this.fox.visible = false;
                this.state = 'gone';
            }
        }
    }

    _flee() {
        this.state = 'fleeing';
        this.clock = 0;
        // run straight away from wherever the visitor is now
        const p = this.controls.pos, fp = this.fox.position;
        const away = new THREE.Vector3(fp.x - p.x, 0, fp.z - p.z);
        if (away.lengthSq() > 1e-4) {
            away.normalize();
            const to = { x: fp.x + away.x * 30, z: fp.z + away.z * 30 };
            if (this._clearLine(fp, { x: fp.x + away.x * 12, z: fp.z + away.z * 12 })) this.path.to = to;
        }
    }
}
