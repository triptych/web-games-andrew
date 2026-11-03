// The fox spirit at home in the Springwood. In the garden it only comes by now
// and then and bolts when you get close; here it is waiting by the door when
// you arrive, and it comes along with you, trotting a little behind and to one
// side, sitting to watch when you stop and galloping to catch up when you run.
// When one of the wood's special places is near and you haven't found it yet,
// it pricks up its ears and leads you there, stopping to look back and wait
// whenever you fall behind. Click it and it sits for a fuss.
// The model and its gait are Worldroot's (game-065), as in the garden.

import * as THREE from 'three';
import { makeFox, animateFox } from '../../game-065/js/view/fox.js';
import { glowSprite } from './textures.js';
import { groundY, featureIn, CELL } from './forest-land.js';
import { clamp, angleDiff } from './util.js';

const SCALE = 1.15;
const CLEAR = 0.38;          // room it needs round a trunk or a stone
const NOTICE = 55;           // m: a special place this near is worth showing you
const WAIT_FAR = 8;          // m: leading, it stops to wait when you are this far behind
const WAIT_NEAR = 5;         // ...and goes on once you are this close again
const LOST = 32;             // m: further than this and it slips round and finds you again

export class ForestFox {
    /** @param {object} env { forest (Forest), audio, ui } */
    constructor(env) {
        this.env = env;
        this.forest = env.forest;
        this.fox = makeFox({ glow: glowSprite() });
        this.fox.scale.setScalar(SCALE);
        this.fox.visible = false;
        this.forest.scene.add(this.fox);
        this.heading = 0;
        this.phase = 0;
        this.state = 'away';
        this.coll = { key: null, ver: -1, list: [] };
        this.cool = new Map();        // places it has stopped trying to show you, until a time
        this.clock = 0;
        this.side = 1;
        this.hit = new THREE.Sphere(new THREE.Vector3(), 0.55);
    }

    // ------------------------------------------------------------ in and out

    /** Waiting at the door: a few steps in front of where you come out, a little to one side, looking at you. */
    enter(spawn) {
        const fx = -Math.sin(spawn.yaw), fz = -Math.cos(spawn.yaw);
        const x = spawn.x + fx * 3.2 - fz * 0.7, z = spawn.z + fz * 3.2 + fx * 0.7;
        this._place(x, z);
        this.heading = Math.atan2(-(spawn.z - z), spawn.x - x);
        this.fox.rotation.y = this.heading;
        this.fox.visible = true;
        this.state = 'greet';
        this.timer = 2.2;
        this.lead = null;
        this.stuck = 0;
        this.best = Infinity;
        this.nextYip = 0;
        this.nextLook = 1;
    }

    leave() {
        this.fox.visible = false;
        this.state = 'away';
        this.lead = null;
    }

    // ------------------------------------------------------------ moving about

    _place(x, z) {
        this.fox.position.set(x, Math.max(groundY(x, z), 0), z);
    }

    _open(x, z) {
        if (groundY(x, z) < 0.4) return false;
        for (const c of this.forest.collidersNearInto(x, z, this.coll)) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + CLEAR) ** 2) return false;
        return true;
    }

    /**
     * Head for (tx, tz) at `speed`, steering round trunks, stones and water.
     * Returns the distance still to go.
     */
    _go(tx, tz, speed, dt) {
        const fp = this.fox.position;
        const dx = tx - fp.x, dz = tz - fp.z, d = Math.hypot(dx, dz);
        if (d < 1e-3) return 0;
        const base = Math.atan2(dz, dx);
        // look a stride ahead; if that is blocked, try a little either side, the way it last turned first
        let ang = null;
        for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0]) {
            const a = base + off * this.side;
            const look = Math.min(1.1, d);
            if (this._open(fp.x + Math.cos(a) * look, fp.z + Math.sin(a) * look)) {
                ang = a;
                if (off !== 0) this.side = Math.sign(off * this.side);
                break;
            }
        }
        if (ang === null) ang = base;
        // the model faces +x: rotation.y = atan2(-dz, dx) points it along (dx, dz)
        const want = -ang;
        this.heading += angleDiff(this.heading, want) * Math.min(1, dt * 7);
        this.fox.rotation.y = this.heading;
        const s = Math.min(d, speed * dt);
        let nx = fp.x + Math.cos(ang) * s, nz = fp.z + Math.sin(ang) * s;
        // never inside a trunk
        for (const c of this.forest.collidersNearInto(nx, nz, this.coll)) {
            const ox = nx - c.x, oz = nz - c.z, od = Math.hypot(ox, oz), min = c.r + 0.2;
            if (od < min && od > 1e-5) {
                nx = c.x + (ox / od) * min;
                nz = c.z + (oz / od) * min;
            }
        }
        if (groundY(nx, nz) >= 0.35) this._place(nx, nz);
        return d - s;
    }

    /** Turn the head toward the walker (within what a neck can do), sitting. */
    _watch(p, dt, t) {
        const fp = this.fox.position;
        const rel = angleDiff(this.heading, Math.atan2(-(p.z - fp.z), p.x - fp.x));
        // if the walker is round behind, turn the whole fox
        if (Math.abs(rel) > 1.3) this.heading += angleDiff(this.heading, Math.atan2(-(p.z - fp.z), p.x - fp.x)) * Math.min(1, dt * 3);
        this.fox.rotation.y = this.heading;
        animateFox(this.fox, t, dt, false, clamp(rel, -1.2, 1.2));
    }

    _trot(t, dt, speed) {
        // the stride quickens with the pace; a gallop past about 6 m/s
        this.phase += dt * clamp(speed / 2.4, 0.8, 2.2);
        animateFox(this.fox, this.phase, dt, true, 0);
    }

    /** Slip round out of sight and come back in near the walker (after a teleport, or when it got stuck). */
    _rejoin(p, fwd) {
        for (let k = 0; k < 12; k++) {
            const a = Math.PI + (Math.random() - 0.5) * 1.6;
            const ca = Math.cos(a), sa = Math.sin(a);
            const dx = fwd.x * ca - fwd.z * sa, dz = fwd.x * sa + fwd.z * ca;
            const r = 4 + Math.random() * 3;
            const x = p.x + dx * r, z = p.z + dz * r;
            if (this._open(x, z)) {
                this._place(x, z);
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------ choosing where to take you

    /** The nearest special place you haven't found, if it is near enough to be worth showing you. */
    _scent(p) {
        const ci = Math.floor(p.x / CELL), cj = Math.floor(p.z / CELL);
        let best = null;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const f = featureIn(ci + di, cj + dj);
            if (!f || f.kind === 'pond') continue;
            const key = `${ci + di},${cj + dj}`;
            if (this.forest.seen.has(key) || (this.cool.get(key) ?? 0) > this.clock) continue;
            const d = Math.hypot(f.x - p.x, f.z - p.z);
            if (d < NOTICE && (!best || d < best.d)) best = { f, key, d };
        }
        if (!best) return null;
        // stop at the edge of the clearing, on the side you are coming from
        const f = best.f;
        const ax = p.x - f.x, az = p.z - f.z, al = Math.hypot(ax, az) || 1;
        let sx = f.x + (ax / al) * f.r * 0.8, sz = f.z + (az / al) * f.r * 0.8;
        if (!this._open(sx, sz)) {
            for (let k = 1; k < 12; k++) {
                const a = Math.atan2(az, ax) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
                const x = f.x + Math.cos(a) * f.r * 0.85, z = f.z + Math.sin(a) * f.r * 0.85;
                if (this._open(x, z)) {
                    sx = x;
                    sz = z;
                    break;
                }
            }
        }
        return { ...best, stand: { x: sx, z: sz } };
    }

    // ------------------------------------------------------------ frame

    update(dt, t, p, fwd, moving) {
        if (this.state === 'away') return;
        this.clock += dt;
        const fp = this.fox.position;
        const dP = Math.hypot(p.x - fp.x, p.z - fp.z);
        this.hit.center.set(fp.x, fp.y + 0.35, fp.z);

        // lost you (a long way behind, or you were moved): come back round to you
        if (dP > LOST && this.state !== 'greet') {
            if (this._rejoin(p, fwd)) {
                this.state = 'follow';
                this.lead = null;
            }
        }

        if (this.state === 'greet') {
            this._watch(p, dt, t);
            this.timer -= dt;
            if (this.timer <= 0 || dP > 6) this.state = 'follow';
            return;
        }

        if (this.state === 'fuss') {
            this._watch(p, dt, t);
            this.timer -= dt;
            if (this.timer <= 0) this.state = 'follow';
            return;
        }

        if (this.state === 'follow') {
            // something worth showing you?
            this.nextLook -= dt;
            if (this.nextLook <= 0) {
                this.nextLook = 1;
                const s = this._scent(p);
                if (s) {
                    this.lead = s;
                    this.state = 'lead';
                    this.waiting = false;
                    this.best = Math.hypot(s.stand.x - fp.x, s.stand.z - fp.z);
                    this.stuck = 0;
                    this.leadStart = this.clock;
                    this.env.audio && this.forest.sound?.yip();
                    this.nextYip = this.clock + 4;
                    this.onLead?.(s.f);
                    return;
                }
            }
            // keep a little behind and to one side
            const sideX = -fwd.z * this.side, sideZ = fwd.x * this.side;
            const tx = p.x - fwd.x * 2.2 + sideX * 1.5, tz = p.z - fwd.z * 2.2 + sideZ * 1.5;
            const dT = Math.hypot(tx - fp.x, tz - fp.z);
            if (dP > 3.6 || (dT > 1.2 && moving)) {
                const speed = clamp((dP - 2) * 1.7, 2.2, 9.5);
                this._go(tx, tz, speed, dt);
                this._trot(t, dt, speed);
            } else this._watch(p, dt, t);
            return;
        }

        if (this.state === 'lead') {
            const L = this.lead;
            // you went off another way: let it go for a while
            if (Math.hypot(L.stand.x - p.x, L.stand.z - p.z) > NOTICE + 35 || this.forest.seen.has(L.key)) {
                if (!this.forest.seen.has(L.key)) this.cool.set(L.key, this.clock + 90);
                this.state = 'follow';
                this.lead = null;
                return;
            }
            if (this.waiting ? dP > WAIT_NEAR : dP > WAIT_FAR) {
                // stop and look back for you, with a yip now and then
                this.waiting = true;
                this._watch(p, dt, t);
                if (this.clock > this.nextYip) {
                    this.nextYip = this.clock + 4 + Math.random() * 2;
                    this.forest.sound?.yip();
                }
                return;
            }
            this.waiting = false;
            const left = this._go(L.stand.x, L.stand.z, 4.6, dt);
            this._trot(t, dt, 4.6);
            if (left < this.best - 0.3) {
                this.best = left;
                this.stuck = 0;
            } else this.stuck += dt;
            if (left < 0.4) {
                this.state = 'present';
                this.timer = 0;
            } else if (this.stuck > 4) {
                // can't find a way through: hop round the obstacle
                const a = Math.atan2(L.stand.z - fp.z, L.stand.x - fp.x) + this.side * 1.2;
                const x = fp.x + Math.cos(a) * 3, z = fp.z + Math.sin(a) * 3;
                if (this._open(x, z)) this._place(x, z);
                this.stuck = 0;
                this.best = Infinity;
            }
            return;
        }

        if (this.state === 'present') {
            // sit at the edge of the clearing, looking from you to it, until you have seen it
            const f = this.lead.f;
            this.timer += dt;
            const look = this.timer % 4 < 2 ? p : f;
            const rel = angleDiff(this.heading, Math.atan2(-(look.z - fp.z), look.x - fp.x));
            if (Math.abs(rel) > 1.3) this.heading += rel * Math.min(1, dt * 3);
            this.fox.rotation.y = this.heading;
            animateFox(this.fox, t, dt, false, clamp(rel, -1.2, 1.2));
            if (this.forest.seen.has(this.lead.key)) {
                this.state = 'fuss';
                this.timer = 2.5;
                this.lead = null;
            } else if (dP > NOTICE + 35) {
                this.cool.set(this.lead.key, this.clock + 90);
                this.state = 'follow';
                this.lead = null;
            }
        }
    }

    /** A ray from a click: does it touch the fox? Returns the distance or Infinity. */
    pick(ray) {
        if (!this.fox.visible) return Infinity;
        const hit = ray.intersectSphere(this.hit, _v);
        return hit ? ray.origin.distanceTo(hit) : Infinity;
    }

    /** Clicked: it sits for a fuss (unless it is in the middle of showing you something). */
    pet() {
        if (this.state === 'lead' || this.state === 'present') return false;
        this.state = 'fuss';
        this.timer = 3;
        return true;
    }
}

const _v = new THREE.Vector3();
