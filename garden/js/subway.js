// The underground railway behind the train ticket on the hut's desk.
//
// Hearthside station: a vaulted tiled hall with a busker, a stair up to the hut
// and a second track where express trains thunder through. When the train
// pulls in and you step aboard, it carries you down a very long tunnel (five
// minutes, by default) past ghost stations, a cavern viaduct and other trains,
// to Prism Halt, where a glowing passage opens into the Spectrum Rotunda: a
// round room around a pool of swirling light. Get back on the train and it
// brings you home.
//
// The train never moves in the world. While it rides, the line is carried past
// it (see tunnel.js), which keeps the walking controls simple: you are always
// in the same world frame as the carriage.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import {
    TRAIN, SEATS, PLATFORM, LEFT_X, subwayMaterials, buildHall, buildTrain, drawClock, routeCanvas, signCanvas, person,
} from './subway-parts.js';
import { Tunnel, PassingTrain, SEG } from './tunnel.js';
import { Rotunda, ROT } from './rotunda.js';
import { SubwayAudio } from './subway-audio.js';
import { smoothstep, damp, clamp, rng } from './util.js';

/** Seconds from doors-closed to doors-open at the far end. ?ride=SECONDS overrides it. */
const RIDE_OUT = 300;
const RETURN = 150;
const CRUISE = 26;          // m/s, outbound; the return is the same road, quicker
const RAMP_UP = 0.085, RAMP_DOWN = 0.11;
const STAIR = { x0: -9.3, x1: -17.3, rise: 3.6, z: -30, half: 1.4 };

const DOOR_ZS = [];
for (let c = 0; c < TRAIN.cars; c++) for (const d of [-4.35, 4.35]) DOOR_ZS.push((c - (TRAIN.cars - 1) / 2) * TRAIN.carLen + d);

/** Normalised speed profile and its running integral, so position follows time exactly. */
const PROFILE = (() => {
    const v = (u) => smoothstep(0, RAMP_UP, u) * (1 - smoothstep(1 - RAMP_DOWN, 1, u));
    const N = 1200, cum = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + (v((i - 0.5) / N) / N);
    const total = cum[N];
    return {
        v, total,
        s: (u) => {
            const x = clamp(u, 0, 1) * N, i = Math.min(N - 1, Math.floor(x));
            return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / total;
        },
    };
})();

export class Subway {
    /** @param {object} env { renderer, ui, mats, audio, quality } */
    constructor(env) {
        this.env = env;
        this.ui = env.ui;
        this.audioEngine = env.audio;
        const params = new URLSearchParams(location.search);
        this.rideOut = params.has('ride') ? Math.max(8, Number(params.get('ride'))) : RIDE_OUT;
        this.rideBack = params.has('ride') ? Math.max(8, Number(params.get('ride')) / 2) : RETURN;
        // the line is as long as five minutes of the profile at cruise, to a whole number of segments
        this.D = Math.round((CRUISE * RIDE_OUT * PROFILE.total) / SEG) * SEG;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05040a);
        this.scene.fog = new THREE.FogExp2(0x07060d, 0.0075);
        this.mats = subwayMaterials(env.mats);
        const mats = this.mats;
        this.envGroup = new THREE.Group();
        this.scene.add(this.envGroup);

        // the two stations and the way out of the first
        this.hallA = buildHall('hearthside', mats, 'HEARTHSIDE');
        this.hallB = buildHall('prism', mats, 'PRISM HALT');
        this.hallB.group.position.z = this.D;
        this.envGroup.add(this.hallA.group, this.hallB.group);
        this._stair();
        this._busker();
        this.rotunda = new Rotunda(mats);
        this.rotunda.group.position.z = this.D;
        this.envGroup.add(this.rotunda.group);
        this._portalGlow();

        this.tunnel = new Tunnel(this.D, mats, [3, 3]);
        this.envGroup.add(this.tunnel.group);
        this.scene.add(this.tunnel.cavern);

        // the train
        this.train = buildTrain(mats);
        this.scene.add(this.train.group);
        for (const l of this.train.doorLeaves) l.mesh.position.x += l.side * 0.04;
        this.passTrains = [new PassingTrain(mats), new PassingTrain(mats)];
        for (const p of this.passTrains) this.scene.add(p.group);

        // lights: a soft base, the pooled hall lights, and the colour rig for the rotunda
        this.scene.add(new THREE.HemisphereLight(0x9a90c8, 0x241c2c, 0.5));
        this.scene.add(new THREE.AmbientLight(0x40384c, 0.55));
        this.rig = Array.from({ length: 4 }, () => {
            const l = new THREE.PointLight(0xffefd8, 0, 17, 1.5);
            l.userData = { target: null, want: 0 };
            this.scene.add(l);
            return l;
        });
        this.baseCarLight = this.train.lights.map((l) => l.intensity);

        // state
        this.state = 'idle';
        this.at = 'A';
        this.dir = 1;
        this.zt = 0;            // the train's position along the line
        this.tRide = 0;
        this.rideTime = this.rideOut;
        this.doorAmt = 0;
        this.time = 0;
        this.shake = 0;
        this.jolt = 0;
        this.stateT = 0;
        this.boardedFor = 0;
        this.passIdx = 0;
        this.nextExpress = 25;
        this.flicker = 0;
        this.displayT = 0;
        this.zoneKey = '';
        this.firedHints = new Set();
        this.speed = 0;
        this.v01 = 0;
        this.passAudio = { gain: 0, pan: 0 };
        this.grids = {};
        this.grids.A = this._grid([...this.hallA.colliders, ...this.stairColliders]);
        this.grids.B = this._grid([...this.hallB.colliders, ...this.rotunda.colliders]);
        this.grids.none = this._grid([]);

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: (x, z) => self.floorY(x, z),
            onDeck: () => false,
            collidersNear: (x, z) => self.gridNow().get(self._key(x, z)) || [],
            onArrive: null,
        };
        this.spawn = { x: -5.4, z: -12, yaw: -Math.PI / 2 };
        this.exit = { x: STAIR.x1 - 1.0, z: STAIR.z };
        this.canExit = true;
        this.sound = null;
    }

    // ------------------------------------------------------------ building

    _grid(list) {
        const grid = new Map();
        for (const c of list) {
            for (let i = Math.floor((c.x - c.r) / 4); i <= Math.floor((c.x + c.r) / 4); i++) {
                for (let j = Math.floor((c.z - c.r) / 4); j <= Math.floor((c.z + c.r) / 4); j++) {
                    const k = i * 7919 + j;
                    if (!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(c);
                }
            }
        }
        return grid;
    }

    _key(x, z) {
        return Math.floor(x / 4) * 7919 + Math.floor(z / 4);
    }

    gridNow() {
        if (this.state === 'ride' || this.state === 'closing') return this.grids.none;
        return this.grids[this.at];
    }

    /** The stair from the platform up to a wooden door, which leads back to the hut. */
    _stair() {
        const m = this.mats, b = new Batch(), g = new THREE.Group();
        const { x0, x1, rise, z, half } = STAIR;
        const run = x0 - x1, n = 22, sw = run / n;
        for (let i = 0; i < n; i++) {
            const top = ((i + 1) / n) * rise;
            b.add('granite', new THREE.BoxGeometry(sw + 0.01, top + 1, half * 2), xf(x0 - (i + 0.5) * sw, (top - 1) / 2, z));
        }
        // landing, walls, sloped ceiling, handrail
        b.add('granite', new THREE.BoxGeometry(2.6, rise + 1, half * 2), xf(x1 - 1.3, (rise - 1) / 2, z));
        const wallH = rise + 5;
        for (const s of [-1, 1]) {
            b.add('granite', new THREE.BoxGeometry(run + 3.4, wallH, 0.3), xf((x0 + x1) / 2 - 1.3 + 0.2, wallH / 2 - 1, z + s * (half + 0.15)));
            b.add('steel', new THREE.CylinderGeometry(0.03, 0.03, Math.hypot(run, rise), 8).rotateZ(Math.PI / 2), xf((x0 + x1) / 2, rise / 2 + 0.95, z + s * (half - 0.12), 0, 1, 1, 1, 0, -Math.atan2(rise, run)));
        }
        const slope = Math.atan2(rise, run);
        b.add('concrete', new THREE.BoxGeometry(run / Math.cos(slope) + 0.6, 0.3, half * 2 + 0.6), xf((x0 + x1) / 2, rise / 2 + 2.9, z, 0, 1, 1, 1, 0, -slope));
        b.add('concrete', new THREE.BoxGeometry(3.4, 0.3, half * 2 + 0.6), xf(x1 - 1.3, rise + 2.9, z));
        b.add('granite', new THREE.BoxGeometry(0.4, wallH, half * 2 + 0.6), xf(x1 - 2.7, wallH / 2 - 1, z));
        // lamps along the stair
        for (let i = 0; i < 4; i++) {
            const lx = x0 - 0.8 - i * 2.1, ly = ((x0 - lx) / run) * rise + 2.45;
            b.add('emitAmber', new THREE.BoxGeometry(0.5, 0.08, 0.5), xf(lx, ly, z));
        }
        g.add(b.build(m, { castShadow: false, receiveShadow: false }));
        // the wooden door at the top, with a lantern and a sign
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 1.4), m.darkWood);
        door.position.set(x1 - 2.5, rise + 1.15, z);
        door.userData.kind = 'exit';
        g.add(door);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 1.7), m.wood);
        frame.position.set(x1 - 2.45, rise + 1.25, z);
        g.add(frame);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m.brass);
        knob.position.set(x1 - 2.38, rise + 1.1, z + 0.5);
        g.add(knob);
        const sc = signCanvas('The Hut', '↑ way out · mind the step', { bg: '#3a2a1a', fg: '#fff2d6', accent: '#c9a7ff', w: 1024, h: 256 });
        const tex = new THREE.CanvasTexture(sc);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        sign.position.set(x1 - 2.37, rise + 2.75, z);
        sign.rotation.y = Math.PI / 2;
        g.add(sign);
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), m.emitAmber);
        lantern.position.set(x1 - 2.2, rise + 2.35, z - 0.95);
        g.add(lantern);
        this.exitDoor = door;
        // a sign by the opening on the platform
        const outer = new THREE.CanvasTexture(signCanvas('WAY OUT', 'to the hut ↑', { bg: '#1c3a2a', fg: '#eafff0', accent: '#8ff0b0', w: 768, h: 256 }));
        outer.colorSpace = THREE.SRGBColorSpace;
        const os = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: outer, toneMapped: false }));
        os.position.set(LEFT_X + 0.05, 3.1, z);
        os.rotation.y = Math.PI / 2;
        g.add(os);
        this.stairLamps = [];
        for (let i = 0; i < 2; i++) this.stairLamps.push({ x: x0 - 3 - i * 4.5, y: ((i * 4.5 + 3) / run) * rise + 2.2, z });
        this.hallA.lamps.push(...this.stairLamps);
        this.stairColliders = [];
        this.hallA.group.add(g);
    }

    /** A busker by the benches, with a violin and an open case at their feet. */
    _busker() {
        const r = rng('busker');
        const p = person(this.mats, r, 3, false);
        p.position.set(-6.4, 0, 21);
        p.rotation.y = Math.PI / 2 + 0.3;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.14), this.mats.darkWood);
        body.position.set(0.12, 1.35, 0.18);
        body.rotation.z = 0.2;
        p.add(body);
        const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5).rotateZ(Math.PI / 2), this.mats.brass);
        bow.position.set(0.05, 1.3, 0.3);
        bow.rotation.y = 0.5;
        p.add(bow);
        this.busker = p;
        this.hallA.group.add(p);
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.8), this.mats.black);
        c.position.set(-5.7, 0.04, 21.1);
        const coins = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10), this.mats.brass);
        coins.position.set(-5.7, 0.09, 21.1);
        this.hallA.group.add(c, coins);
        this.buskerPos = { x: -6.4, z: 21 };
        this.hallA.colliders.push({ x: -6.4, z: 21, r: 0.4 });
    }

    /** The passage from Prism Halt: a violet-to-cyan frame that pulses, set into the back wall. */
    _portalGlow() {
        const g = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9a6bff, emissiveIntensity: 2.8 });
        this.portalMat = m;
        for (const s of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.1, 0.3), m);
            post.position.set(LEFT_X + 0.1, 2.0, s * 2.7);
            g.add(post);
        }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 5.7), m);
        lintel.position.set(LEFT_X + 0.1, 4.0, 0);
        g.add(lintel);
        const sc = signCanvas('THE SPECTRUM ROTUNDA', 'this way · light and water', { bg: '#14194a', fg: '#fff6df', accent: '#7ff3ff', w: 1024, h: 256 });
        const tex = new THREE.CanvasTexture(sc);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        sign.position.set(LEFT_X + 0.3, 4.55, 0);
        sign.rotation.y = Math.PI / 2;
        g.add(sign);
        g.position.z = this.D;
        this.envGroup.add(g);
    }

    // ------------------------------------------------------------ world queries

    inTrainAisle(x, z) {
        return Math.abs(x) <= 1.38 && Math.abs(z) <= TRAIN.len / 2 - 0.9;
    }

    nearDoor(z) {
        return DOOR_ZS.some((d) => Math.abs(z - d) < 0.62);
    }

    get docked() {
        return this.state === 'docked' || this.state === 'opening' || this.state === 'boarding' || this.state === 'closing-warn';
    }

    walkable(x, z) {
        const s = this.state;
        if (this.inTrainAisle(x, z) && s !== 'waiting' && s !== 'arriving') return true;
        if (s === 'ride' || s === 'closing') return false;
        const platformOk = x >= PLATFORM.x0 + 0.3 && x <= PLATFORM.x1 - 0.02 && Math.abs(z) < PLATFORM.z - 1;
        const doorOk = this.doorAmt > 0.55 && x > PLATFORM.x1 - 0.02 && x < -1.36 && this.nearDoor(z) && this.docked;
        if (doorOk) return true;
        if (platformOk) return true;
        if (this.at === 'A') {
            // the stair: a doorway in the back wall and a flight of steps
            if (x < -8.8 && x > STAIR.x1 - 1.9 && Math.abs(z - STAIR.z) < STAIR.half - 0.35) return true;
        } else if (this.rotunda.walkable(x, z)) return true;
        return false;
    }

    floorY(x, z) {
        if (this.inTrainAisle(x, z) && Math.abs(x) > 0.9) {
            const lz = ((z + TRAIN.len / 2) % TRAIN.carLen) - TRAIN.carLen / 2;
            if (SEATS.some(([a, b]) => lz >= a && lz <= b)) return -0.42;
        }
        if (this.at === 'A' && x < STAIR.x0 && x > STAIR.x1 - 2 && Math.abs(z - STAIR.z) < 2) {
            return clamp(((STAIR.x0 - x) / (STAIR.x0 - STAIR.x1)) * STAIR.rise, 0, STAIR.rise);
        }
        return 0;
    }

    stepSurface(pos) {
        if (this.inTrainAisle(pos.x, pos.z)) return 'metal';
        if (this.at === 'A' && pos.x < STAIR.x0) return 'wood';
        return 'stone';
    }

    // ------------------------------------------------------------ interaction

    /** Rays against the exit door and the pool; returns the nearest of those or the floor. */
    pick(ray, ndcRay) {
        const targets = [this.exitDoor];
        if (this.at === 'B') targets.push(this.rotunda.poolHit);
        const hit = ray.intersectObjects(targets, false)[0];
        if (hit && hit.distance < 60) {
            if (hit.object.userData.kind === 'pool') return { type: 'pool', point: hit.point, t: hit.distance };
            return { type: 'door', t: hit.distance };
        }
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y >= -1e-4) return null;
        const t = -o.y / d.y;
        const point = o.clone().addScaledVector(d, t);
        if (this.walkable(point.x, point.z)) return { type: 'ground', point, t };
        return null;
    }

    /** A touch on the water. */
    touchPool(point) {
        const rz = point.z;
        this.rotunda.ripple(point.x, rz, this.time, 1.2);
        const frac = (Math.atan2(point.z, point.x - ROT.cx) / (Math.PI * 2) + 1) % 1;
        this.sound?.poolTone(frac);
    }

    // ------------------------------------------------------------ session

    /** Called as the player steps out of the hut's world and onto the platform. */
    enter(camera) {
        this.state = 'waiting';
        this.at = 'A';
        this.dir = 1;
        this.zt = 0;
        this.tRide = 0;
        this.stateT = 0;
        this.doorAmt = 0;
        this.passIdx = 0;
        this.firedHints.clear();
        this.nextExpress = 28;
        this.train.group.position.z = -170;
        this.train.group.visible = false;
        for (const p of this.passTrains) {
            p.active = false;
            p.group.visible = false;
        }
        this.envGroup.position.z = 0;
        if (!this.sound && this.audioEngine.ctx) this.sound = new SubwayAudio(this.audioEngine);
        this.sound?.start();
        this.sound?.arrive();
        this._duck(true);
        this.ui.zone('Hearthside Station', 'The Violet Line · a train is due', '#b79bff');
        this.zoneKey = 'A';
        setTimeout(() => this.ui.hint('Wait on the platform · listen for the train', 7000), 1500);
        this.camera = camera;
    }

    leave() {
        this.sound?.stop();
        this._duck(false);
        this.state = 'idle';
        this.mats.emitWhite.emissiveIntensity = 2.4;
    }

    _duck(on) {
        const e = this.audioEngine;
        if (!e.ctx || !e.music) return;
        e.music.gain.setTargetAtTime(e.musicVol * (on ? 0.12 : 1), e.ctx.currentTime, 0.6);
    }

    // ------------------------------------------------------------ the loop

    _text() {
        const t = this.rideTime;
        const left = Math.max(0, Math.ceil(t - this.tRide));
        const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
        return { next: this.dir > 0 ? 'PRISM HALT' : 'HEARTHSIDE', clock: `${mm}:${ss}` };
    }

    _refreshDisplays() {
        const { next, clock } = this._text();
        const here = this.at === 'A' ? 'HEARTHSIDE' : 'PRISM HALT';
        const other = this.at === 'A' ? 'PRISM HALT' : 'HEARTHSIDE';
        let hall, car;
        switch (this.state) {
            case 'waiting': {
                const s = Math.max(0, Math.ceil(8 - this.stateT));
                hall = ['VIOLET LINE', `TRAIN IN ${s}s`];
                car = ['', ''];
                break;
            }
            case 'arriving': hall = ['VIOLET LINE', 'ARRIVING...']; car = ['', '']; break;
            case 'docked': case 'boarding': hall = [`FOR ${other}`, 'NOW BOARDING']; car = [`FOR ${other}`, 'STEP ABOARD']; break;
            case 'closing-warn': case 'closing': hall = [`FOR ${other}`, 'DOORS CLOSING']; car = ['STAND CLEAR', 'DOORS CLOSING']; break;
            case 'ride': hall = [`NEXT ${next}`, clock]; car = [`NEXT: ${next}`, `ARRIVING IN ${clock}`]; break;
            default: hall = [here, 'VIOLET LINE']; car = [here, 'DOORS OPEN'];
        }
        if (this.state === 'opening') car = [here, 'DOORS OPEN'];
        for (const l of this.hallA.boards) l.set(this.at === 'A' ? hall : [`HEARTHSIDE`, '5 MIN OUT']);
        for (const l of this.hallB.boards) l.set(this.at === 'B' ? hall : [`PRISM HALT`, 'LIGHT AND WATER']);
        for (const l of this.train.led) l.set(car);
        for (const h of [this.hallA, this.hallB]) for (const c of h.clocks) drawClock(c, new Date());
        // route strips: the train's dot creeps along the line
        const prog = this.state === 'ride' ? (this.dir > 0 ? this.zt / this.D : 1 - this.zt / this.D) : this.at === 'A' ? 0 : 1;
        const rc = routeCanvas(prog, ['HEARTHSIDE', 'PRISM HALT']);
        for (const r of this.train.led.route ?? []) {
            r.canvas.getContext('2d').drawImage(rc, 0, 0, r.canvas.width, r.canvas.height);
            r.tex.needsUpdate = true;
        }
    }

    _rideSpeed() {
        const u = clamp(this.tRide / this.rideTime, 0, 1);
        this.v01 = PROFILE.v(u);
        return (this.D * this.v01) / (PROFILE.total * this.rideTime);
    }

    _startRide() {
        this.state = 'ride';
        this.tRide = 0;
        this.rideTime = this.dir > 0 ? this.rideOut : this.rideBack;
        this.passIdx = 0;
        this.ui.zone('The Violet Line', this.dir > 0 ? 'Hearthside → Prism Halt' : 'Prism Halt → Hearthside', '#b79bff');
        this.zoneKey = 'ride';
        this.zoneBanner = true;
        this.ui.hint(this.dir > 0 ? 'The ride is long. Sit, stand, wander the carriages, watch the windows.' : 'Home again, the quick way.', 9000);
        this.nextPassU = [0.07, 0.16, 0.28, 0.4, 0.57, 0.72, 0.84];
    }

    _spawnPass(speed, length, lightBoost = 1) {
        const p = this.passTrains.find((x) => !x.active);
        if (!p) return;
        p.active = true;
        p.age = 0;
        p.dir = this.state === 'ride' ? this.dir : 1;
        p.speed = speed;
        p.len = length;
        p.boost = lightBoost;
        p.group.position.set(4.5, 0, p.dir * length);
        p.group.rotation.y = p.dir > 0 ? Math.PI : 0;
        p.group.visible = true;
        if (this.state !== 'ride') this.sound?.chime();
    }

    update(dt, t, camera, controls) {
        dt = Math.min(dt, 0.1);
        this.time += dt;
        this.camera = camera;
        this.stateT += dt;
        const px = controls.pos.x, pz = controls.pos.z;
        const inTrain = this.inTrainAisle(px, pz);
        let v = 0;       // m/s along the line

        switch (this.state) {
            case 'waiting':
                if (this.stateT > 8) {
                    this.state = 'arriving';
                    this.stateT = 0;
                    this.train.group.visible = true;
                    this.sound?.chime();
                    this.ui.hint('The train is coming in · stand back from the yellow line', 6000);
                }
                break;
            case 'arriving': {
                const k = clamp(this.stateT / 10, 0, 1);
                const ease = 1 - Math.pow(1 - k, 2.4);
                this.train.group.position.z = -170 * (1 - ease);
                v = 22 * Math.pow(1 - k, 1.4);
                if (k > 0.4 && !this.braked) {
                    this.braked = true;
                    this.sound?.brake(0.8);
                }
                if (k >= 1) {
                    this.train.group.position.z = 0;
                    this.braked = false;
                    this.state = 'opening';
                    this.stateT = 0;
                    this.sound?.doors(true);
                }
                break;
            }
            case 'opening':
                this.doorAmt = clamp(this.stateT / 1.4, 0, 1);
                if (this.stateT >= 1.4) {
                    this.state = 'docked';
                    this.stateT = 0;
                    this.boardedFor = 0;
                    this.mats.emitWhite.emissiveIntensity = 2.4;
                    const name = this.at === 'A' ? 'Hearthside' : 'Prism Halt';
                    this.ui.hint(this.at === 'A' ? `Doors open · step aboard to ride to Prism Halt (about ${this.rideOut >= 90 ? Math.round(this.rideOut / 60) + ' minutes' : this.rideOut + ' seconds'})` : 'Prism Halt · a glowing passage leads off the platform. The train waits to take you home.', 9000);
                    void name;
                }
                break;
            case 'docked':
                this.boardedFor = inTrain && px > -1.2 ? this.boardedFor + dt : 0;
                // trains in the other direction, now and then
                this.nextExpress -= dt;
                if (this.nextExpress <= 0) {
                    this.nextExpress = 70 + Math.random() * 40;
                    this._spawnPass(42, 320);
                    if (this.passTrains.some((p) => p.active)) this.ui.hint('Stand back · an express is passing through', 4000);
                }
                if (this.boardedFor > 2.2) {
                    this.state = 'closing-warn';
                    this.stateT = 0;
                    this.sound?.beeps(5);
                    this.sound?.chime(true);
                    this.ui.hint('Doors closing · please stand clear', 3500);
                }
                break;
            case 'closing-warn':
                if (!inTrain || px < -1.25) {
                    // they stepped back out: hold the doors
                    this.state = 'docked';
                    this.boardedFor = 0;
                } else if (this.stateT > 2.6) {
                    this.state = 'closing';
                    this.stateT = 0;
                    this.sound?.doors(false);
                }
                break;
            case 'closing':
                this.doorAmt = 1 - clamp(this.stateT / 1.5, 0, 1);
                if (this.stateT >= 1.8) {
                    this.doorAmt = 0;
                    this.dir = this.at === 'A' ? 1 : -1;
                    this._startRide();
                    this.stateT = 0;
                }
                break;
            case 'ride': {
                this.tRide += Math.min(dt, 0.25);
                const u = clamp(this.tRide / this.rideTime, 0, 1);
                v = this._rideSpeed();
                const s = this.D * PROFILE.s(u);
                this.zt = this.dir > 0 ? s : this.D - s;
                if (this.__hold != null) this.zt = this.__hold;   // dev hook: pin the train at a point on the line
                // events along the way
                while (this.nextPassU.length && u >= this.nextPassU[0]) {
                    this.nextPassU.shift();
                    this._spawnPass(36, 300);
                }
                const f = this.zt / this.D;
                if (this.dir > 0) this._rideHints(f, u);
                if (u > 0.9 && !this.firedHints.has('approach')) {
                    this.firedHints.add('approach');
                    this.sound?.chime();
                    this.ui.hint(this.dir > 0 ? 'Approaching Prism Halt' : 'Approaching Hearthside', 5000);
                }
                if (u > 0.86 && !this.firedHints.has('brake')) {
                    this.firedHints.add('brake');
                    this.sound?.brake(1);
                }
                if (u >= 1) {
                    this.zt = this.dir > 0 ? this.D : 0;
                    this.at = this.dir > 0 ? 'B' : 'A';
                    this.state = 'opening';
                    this.stateT = 0;
                    this.firedHints.clear();
                    this.nextExpress = 30;
                    this.sound?.doors(true);
                    this.ui.zone(this.at === 'B' ? 'Prism Halt' : 'Hearthside Station', 'The Violet Line', this.at === 'B' ? '#7ff3ff' : '#b79bff');
                    this.zoneKey = this.at;
                    v = 0;
                }
                break;
            }
            default:
        }
        this.speed = v;
        this.envGroup.position.z = -this.zt;
        const rideNorm = this.state === 'ride' ? this.v01 : clamp(v / 22, 0, 1);
        this.tunnel.update(this.zt, this.time, v, camera);

        // the passing trains
        let passGain = 0, passPan = 0;
        for (const p of this.passTrains) {
            if (!p.active) continue;
            p.age += dt;
            const z = p.dir * p.len - p.dir * p.speed * p.age;
            p.group.position.z = z;
            const d = Math.abs(z - pz);
            const near = 1 - smoothstep(10, 140, d);
            p.light.intensity = (30 + 20 * Math.sin(z * 2.9)) * (1 - smoothstep(10, 55, d)) * p.boost;
            passGain = Math.max(passGain, near * (this.state === 'ride' ? 0.9 : 0.7));
            passPan = clamp((4.5 - px) * 0.15 + (z - pz > 0 ? 0 : 0), -1, 1);
            if (Math.abs(z) > p.len + 60 || p.age > (2 * p.len + 80) / p.speed) {
                p.active = false;
                p.group.visible = false;
                p.light.intensity = 0;
            } else if (d < 60) this.shake = Math.max(this.shake, 0.6 * (1 - d / 60));
        }

        // doors
        for (const l of this.train.doorLeaves) {
            const amt = l.side < 0 ? this.doorAmt : 0;
            l.mesh.position.z = l.home + l.dir * 0.64 * amt;
        }

        // lights flicker deep in the line
        const f = this.zt / this.D;
        let carLight = 1;
        if (this.state === 'ride') {
            if (this.dir > 0 && f > 0.5 && !this.firedHints.has('blackout')) {
                this.firedHints.add('blackout');
                this.flicker = 3.2;
                this.sound?.burst?.(this.sound.ctx.currentTime, 0.4, 120, 1, 0.5);
            }
            if (this.flicker > 0) {
                this.flicker -= dt;
                const s = this.flicker;
                carLight = s > 1.2 ? (Math.sin(this.time * 41) > -0.1 ? 0.7 : 0.05) * (Math.sin(this.time * 7) > 0 ? 1 : 0.2) : s > 0.4 ? 0.04 : smoothstep(0, 0.4, 0.4 - s);
            }
            this.mats.emitWhite.emissiveIntensity = 2.4 * carLight;
        }
        this.train.lights.forEach((l, i) => {
            l.intensity = this.baseCarLight[i] * carLight * (this.state === 'ride' || this.docked ? 1 : 0.9);
        });

        // pooled hall lights and the rotunda's colour rig
        this._rig(dt, px, pz);
        const cols = this.rotunda.update(dt, this.time, px, pz);
        void cols;

        // displays once a second
        this.displayT -= dt;
        if (this.displayT <= 0) {
            this.displayT = 0.5;
            this._refreshDisplays();
        }
        // people sway with the train, the portal breathes
        for (const p of this.train.people) {
            const b = p.userData.body;
            if (b) b.scale.y = 1 + Math.sin(this.time * 1.4 + p.position.z) * 0.012;
            p.position.x += Math.sin(this.time * 9 + p.position.z) * 0.00004 * v;
        }
        this.portalMat.emissive.setHSL(0.72 - 0.15 * (0.5 + 0.5 * Math.sin(this.time * 0.8)), 0.9, 0.6);
        this.busker.userData.body.rotation.z = Math.sin(this.time * 2.1) * 0.05;

        // camera: the rattle of the carriage, plus a jolt on every rail joint
        if (this.state === 'ride' || this.state === 'arriving') {
            const sp = clamp(v / 24, 0, 1.3);
            this.shake = damp(this.shake, 0, 3, dt);
            const amp = 0.0018 * sp + this.shake * 0.01;
            camera.position.x += Math.sin(this.time * 31) * amp + Math.sin(this.time * 12.7) * amp * 0.6;
            camera.position.y += Math.sin(this.time * 47) * amp * 0.9;
            camera.rotation.z += Math.sin(this.time * 0.9) * 0.0035 * sp + Math.sin(this.time * 2.3) * 0.0018 * sp;
        } else this.shake = damp(this.shake, 0, 3, dt);

        // zones and sound
        this._zones(px, pz);
        const dBusker = Math.hypot(this.buskerPos.x - px, this.buskerPos.z - pz);
        const fwdX = -Math.sin(controls.yaw), fwdZ = -Math.cos(controls.yaw);
        void fwdX; void fwdZ;
        const rx = Math.cos(controls.yaw), rz = -Math.sin(controls.yaw);
        const bx = (this.buskerPos.x - px) / (dBusker || 1), bz = (this.buskerPos.z - pz) / (dBusker || 1);
        const atA = this.at === 'A' && this.state !== 'ride' && this.state !== 'closing';
        const inRot = this.at === 'B' && this.state !== 'ride' && this.rotunda.inside(px, pz);
        const rotLevel = this.at === 'B' && this.state !== 'ride' ? clamp(1 - (Math.hypot(px - ROT.cx, pz) - 8) / 40, 0, 1) : 0;
        this.sound?.update(dt, {
            speed: rideNorm,
            v,
            inTrain,
            hall: this.state === 'ride' ? 0 : inRot ? 0.1 : 1,
            rot: rotLevel,
            finale: this.state === 'ride' && this.dir > 0 ? smoothstep(0.62, 1, this.zt / this.D) : 0,
            deep: this.zt / this.D,
            buskerGain: atA ? (0.75 / (1 + dBusker * 0.16)) * (inTrain && this.state !== 'docked' ? 0.3 : 1) : 0,
            buskerPan: clamp(bx * rx + bz * rz, -1, 1),
            pass: passGain,
            passPan,
        });
    }

    _rideHints(f, u) {
        const once = (key, text, ms = 7000) => {
            if (this.firedHints.has(key)) return;
            this.firedHints.add(key);
            this.ui.hint(text, ms);
        };
        if (u > 0.012) once('lights', 'Lights flick past in the dark. The seats are free.', 5000);
        if (f > 0.115 && f < 0.14) once('moonwell', 'A dead platform slips by: Moonwell', 4500);
        if (f > 0.455) once('cavern', 'The walls fall away · look out of the window', 9000);
        if (f > 0.56) once('deep', 'The rock is humming', 5000);
        if (f > 0.75) once('colour', 'Colour is seeping into the tunnel', 6000);
    }

    _zones(px, pz) {
        let key, name, sub, accent;
        if (this.state === 'ride' || (this.inTrainAisle(px, pz) && this.docked)) {
            key = 'train';
            name = 'The Violet Line';
            sub = '';
            accent = '#b79bff';
        } else if (this.at === 'B' && this.rotunda.inside(px, pz)) {
            key = 'rot';
            name = 'The Spectrum Rotunda';
            sub = 'A pool of swirling colour · touch the air above it';
            accent = '#7ff3ff';
        } else if (this.at === 'B' && px < -9.2) {
            key = 'corridor';
            name = 'The Passage';
            sub = '';
            accent = '#9a6bff';
        } else if (this.at === 'A' && px < -9.2) {
            key = 'stair';
            name = 'The Stair';
            sub = 'Up to the hut';
            accent = '#d9b46a';
        } else {
            key = this.at;
            name = this.at === 'A' ? 'Hearthside Station' : 'Prism Halt';
            sub = 'The Violet Line';
            accent = this.at === 'A' ? '#b79bff' : '#7ff3ff';
        }
        if (key !== this.zoneKey) {
            this.zoneKey = key;
            if (key === 'train' && this.state === 'ride') document.getElementById('hud-zone').textContent = name;
            else this.ui.zone(name, sub, accent);
        }
    }

    /** Keeps four real lights on the nearest lamps (or circling the pool), fading one out before it moves. */
    _rig(dt, px, pz) {
        const rot = this.at === 'B' && this.state !== 'ride' && px < -9;
        if (rot) {
            const cols = this.rotunda.lightColors;
            this.rig.forEach((L, i) => {
                const a = this.time * 0.25 + i * 1.5708;
                L.position.set(ROT.cx + Math.cos(a) * 6.5, 3.4, Math.sin(a) * 6.5);
                L.color.copy(cols[i]);
                L.distance = 40;
                L.intensity = damp(L.intensity, 24, 3, dt);
                L.userData.lamp = null;
            });
            return;
        }
        const spots = [];
        for (const [hall, hallZ, color] of [[this.hallA, 0, 0xfff0dc], [this.hallB, this.D, 0xe6d8ff]]) {
            for (const l of hall.lamps) {
                const z = l.z + hallZ - this.zt;
                const d = (l.x - px) ** 2 + (z - pz) ** 2;
                if (d < 38 * 38) spots.push({ lamp: l, x: l.x, y: l.y, z, color, d });
            }
        }
        spots.sort((a, b) => a.d - b.d);
        const wanted = spots.slice(0, 4);
        const used = new Set();
        for (const L of this.rig) {
            const hit = wanted.find((s) => s.lamp === L.userData.lamp);
            if (hit) {
                used.add(hit);
                L.position.set(hit.x, hit.y, hit.z);
                L.userData.fade = 1;
            } else L.userData.fade = 0;
        }
        const free = wanted.filter((s) => !used.has(s));
        for (const L of this.rig) {
            if (!L.userData.fade && L.intensity < 0.4 && free.length) {
                const s = free.shift();
                L.userData.lamp = s.lamp;
                L.position.set(s.x, s.y, s.z);
                L.color.set(s.color);
                L.userData.fade = 1;
            }
            L.distance = 17;
            L.intensity = damp(L.intensity, L.userData.fade ? 13 * (this.state === 'ride' ? 0.7 : 1) : 0, 4, dt);
        }
    }
}
