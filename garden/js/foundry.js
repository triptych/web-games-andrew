// The Robot Foundry, down the lift at the far end of the Works: a vast hall
// where three assembly lines build robots, head first. Follow the main line from
// the head shop through the body shop, the arm line and the leg line to the
// test rig and the paint booth; at the end each finished unit is set on its
// feet, wakes, stands up, looks about, and sets off for the way out in the far
// wall. The three lines' units cross the apron and file on to one walkway over
// the lava pit, where a quartermaster hands each a laser rifle. None of them
// gets there: just short of the exit a stretch of the walkway rusted through
// and broke away long ago, and nobody mended it. (foundry-line.js builds and
// moves the robots,
// foundry-hall.js is the building, foundry-fx.js the sparks, arcs and lava,
// foundry-audio.js the sound.) Its own scene, drawn by the garden's composer
// and walked with the garden's controls; built on the first visit.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Lines, LINES, SHOPS, shopAt, slotZ, Z0, PITCH, LAST, CYCLE, MOVE, DWELL, LEDGE_Z, LAVA_Y, SERIAL0, T_SLUMP, T_BOOT, T_STAND, T_LOOK, T_TURN, T_FALL, STATIONS, STRIP_END, SARGE } from './foundry-line.js';
import { Hall, WALK, CATWALK, DECK, APRON, LIFT, X0, X1, Z_FAR, CEIL } from './foundry-hall.js';
import { Particles, Arcs } from './foundry-fx.js';
import { FoundryAudio } from './foundry-audio.js';
import { FoundryPA } from './foundry-pa.js';
import { clamp, lerp, smoothstep, store } from './util.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const EYE = 1.65;
const RIDE_TOP = 35, RIDE_DOWN = 10, RIDE_UP = 3.2;

const TIER = {
    high: { sparks: 3000, mist: 900 },
    medium: { sparks: 2000, mist: 600 },
    low: { sparks: 1200, mist: 360 },
};

/** The places you pass, for the banner and the HUD. */
export const PLACES = [
    { id: 'lift', name: 'The Robot Foundry', hud: 'The lift', sub: 'Down the lift from the Works · three lines that never stop', accent: '#ffb45a' },
    ...SHOPS,
    { id: 'apron', name: 'The Apron', sub: 'Where the three lines meet and file on to the one walkway', accent: '#ffd06a' },
    { id: 'pit', name: 'The Way Out', sub: 'Over the lava to the exit · a rifle each from the quartermaster · mind the gap', accent: '#ff6a2a' },
];
const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/** What a station is doing to the unit hanging there, for the hover card. */
const DOING = [
    'having its cranium hung on the hook', 'being given a face', 'being given its eyes', 'having its ears fitted', 'having its antenna screwed in', 'having its head scanned',
    'being given a chest and a neck', 'being given a pelvis', 'having its core put in', 'having its chest plates welded on', 'being given a backpack', 'being bolted together',
    'being given shoulders', 'being given upper arms', 'being given elbows and forearms', 'being given hands', 'having its hands tested', 'trying out its new arms',
    'being given hips and thighs', 'being given knees', 'being given shins', 'being given feet', 'having its leg armour fitted', 'having its legs torqued up',
    'being shocked awake for a moment, as a test', 'being painted', 'being set down on its own feet',
];

export class Foundry {
    /** @param {object} env { renderer, audio (AudioEngine), ui, quality } */
    constructor(env) {
        this.env = env;
        this.cfg = TIER[env.quality?.tier] || TIER.high;
        this.inside = false;
        this.clock = 0;
        const s = (this.scene = new THREE.Scene());
        const fog = new THREE.Color(0x2b2420);
        s.background = fog;
        s.fog = new THREE.FogExp2(fog, 0.0078);
        const pmrem = new THREE.PMREMGenerator(env.renderer);
        s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        s.environmentIntensity = 0.32;
        pmrem.dispose();

        this.lines = new Lines(s);
        this.hall = new Hall(s, this.lines);
        this.sparks = new Particles(s, this.cfg.sparks);
        this.mist = new Particles(s, this.cfg.mist, { soft: true });
        this.arcs = new Arcs(s, 28);
        this._lights();
        this.sound = env.audio ? new FoundryAudio(env.audio) : null;
        this.pa = new FoundryPA({ audio: env.audio, sound: this.sound });
        this.log = store.get('foundryLog', {});
        this._dom();
        this.cam = new V3();
        this.ride = null;
        this.armed = false;

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: () => 0,
            onDeck: () => false,
            // the finished units on their feet: you can't walk through them (they walk through you)
            collidersNear: (x, z) => {
                const out = (self._cols ??= []);
                out.length = 0;
                for (const r of self.lines.robots) if (r.post && r.feetY > -0.5 && Math.abs(r.x - x) < 3 && Math.abs(r.z - z) < 3) out.push({ x: r.x, z: r.z, r: 0.55 });
                return out;
            },
            onArrive: (r) => r?.then?.(),
        };
        // a first frame, so everything is in place before anyone looks
        this.lines.update(0, null);
        this.hall.update(0, 0);
    }

    _lights() {
        const s = this.scene;
        s.add(new THREE.HemisphereLight(0xa4aec0, 0x4a3428, 1.25));
        const sun = new THREE.DirectionalLight(0xfff0dc, 0.9);
        sun.position.set(20, 60, 30);
        s.add(sun, sun.target);
        this.lavaLights = [];
        for (const x of [-30, 25]) {
            const l = new THREE.PointLight(0xff5a18, 320, 75, 1.5);
            l.position.set(x, LAVA_Y + 6, -226);
            s.add(l);
            this.lavaLights.push(l);
        }
        this.edgeLight = new THREE.PointLight(0xff7a30, 30, 36, 1.5);
        this.edgeLight.position.set(4, 7, -207);
        s.add(this.edgeLight);
        this.weldLights = [0, 1].map(() => {
            const l = new THREE.PointLight(0xbfd8ff, 0, 10, 1.8);
            s.add(l);
            return l;
        });
        this.testLight = new THREE.PointLight(0x80a8ff, 0, 16, 1.6);
        this.testLight.position.set(0, 4.5, slotZ(24));
        s.add(this.testLight);
    }

    _dom() {
        this.dom = { root: $('foundry-hud'), where: $('fd-where'), count: $('fd-count'), up: $('fd-up') };
        this.dom.up?.addEventListener('click', () => {
            this.env.audio?.click();
            if (!this.ride) this.onExit?.();
        });
    }

    // ------------------------------------------------------------ in and out

    /** Arrive at the top of the lift shaft, and ride down into the hall. */
    enter(controls, camera) {
        this.controls = controls;
        this.camera = camera;
        controls.world = this.world;
        controls.teleport(LIFT.x, LIFT.z + 0.3, 0);
        controls.pitch = -0.3;
        controls.seated = true;
        this.inside = true;
        this.armed = false;
        this.zone = null;
        this.zoneT = 0;
        this.ride = { dir: 'down', t: 0 };
        this.hall.setGate(0);
        this.hall.setCar(RIDE_TOP);
        if (this.dom.root) this.dom.root.hidden = false;
        document.body.classList.add('in-foundry');
        this.sound?.start();
        this.pa.start();
        this.sound?.liftMotor(1);
        this._found('lift', true);
    }

    /** Back up the lift: the hall keeps its place for next time. */
    leave() {
        if (!this.inside) return;
        this.inside = false;
        this.ride = null;
        if (this.controls) this.controls.seated = false;
        if (this.dom.root) this.dom.root.hidden = true;
        document.body.classList.remove('in-foundry');
        this.sound?.liftMotor(0);
        this.sound?.stop();
        this.pa.stop();
    }

    /** Walked into the car: shut the gate and go up. */
    _goUp() {
        const c = this.controls;
        c.route = null;
        c.keys.clear();
        c.seated = true;
        c.teleport(LIFT.x, LIFT.z + 0.3, Math.PI);
        c.pitch = -0.05;
        this.ride = { dir: 'up', t: 0, called: false };
        this.sound?.gate();
    }

    get busy() {
        return !!this.ride;
    }

    _rideUpdate(dt, camera) {
        const r = this.ride, h = this.hall, c = this.controls;
        r.t += dt;
        if (r.dir === 'down') {
            const q = clamp(r.t / RIDE_DOWN, 0, 1);
            const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
            h.setCar(lerp(RIDE_TOP, 0, e));
            this.sound?.liftMotor(q < 1 ? Math.min(1, Math.sin(Math.PI * q) * 1.6 + 0.3) : 0);
            if (q >= 1) {
                if (!r.dinged) {
                    r.dinged = true;
                    this.sound?.ding();
                    this.sound?.gate();
                }
                const g = clamp((r.t - RIDE_DOWN - 0.3) / 0.9, 0, 1);
                h.setGate(g);
                if (g >= 1) {
                    this.ride = null;
                    c.seated = false;
                    c.teleport(LIFT.x, LIFT.z + 0.3, c.yaw);
                    if (!this.hinted) {
                        this.hinted = true;
                        const touch = matchMedia('(pointer: coarse)').matches;
                        this.env.ui?.hint(`The heads come first: follow the line down the hall to see what they become, and where they try to go · ${touch ? 'tap anything' : 'hover or click anything'} to see what it is · walk back into the lift, or Ride up, to go back`, 12000);
                    }
                }
            }
        } else {
            const g = clamp(r.t / 0.8, 0, 1);
            h.setGate(1 - g);
            const q = clamp((r.t - 0.8) / RIDE_UP, 0, 1);
            h.setCar(q * q * 18);
            this.sound?.liftMotor(q > 0 ? 1 : 0);
            if (q > 0.35 && !r.called) {
                r.called = true;
                this.onExit?.();
            }
        }
        camera.position.set(LIFT.x, h.carY + EYE, LIFT.z + 0.3);
        camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ');
    }

    walkable(x, z) {
        const inMain = x > WALK.x0 && x < WALK.x1 && z > WALK.z0 && z < WALK.z1;
        const inR = (r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
        const inCat = x > CATWALK.x0 && x < CATWALK.x1 && z > CATWALK.z0 - 0.1 && z < CATWALK.z1 + 1;
        if (!inMain && !inCat && !inR(DECK) && !inR(APRON)) return false;
        for (const b of this.hall.blocks) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return false;
        return true;
    }

    // ------------------------------------------------------------ the frame

    update(dt, t, camera, viewportH = innerHeight) {
        this.clock += dt;
        const time = this.clock;
        const cam = this.cam.copy(camera.position);
        if (this.ride) this._rideUpdate(dt, camera);
        cam.copy(camera.position);
        const ev = this.lines.update(time, cam);
        this.hall.update(dt, time);
        this._effects(ev, dt, time, cam);
        this.sparks.update(time, viewportH);
        this.mist.update(time, viewportH);
        // the counter, the desk's screens and the HUD
        const n = this.lines.despatched(time);
        this.hall.drawCounter(n);
        if (this.dom.count && this._shownCount !== n) {
            this._shownCount = n;
            this.dom.count.textContent = n.toLocaleString('en-GB');
        }
        if (Math.hypot(cam.x - 27, cam.z + 166) < 40) this.hall.drawScreens(time, this._info(n));
        if (!this.ride && this.controls?.enabled) {
            this._where(cam);
            this._liftCheck();
        }
        const pitNear = clamp(1 - (cam.z - (LEDGE_Z - 10)) / 60, 0, 1);
        this.sound?.update(pitNear);
        this.pa.update(dt);
        if (this.hall.pressHit) this.sound?.press(this._near(29, -96, 50));
    }

    /** Keep the hall running while it is only on the hut's television. */
    tick(dt) {
        if (this.inside) return;
        this.clock += dt;
        this.cam.set(11, 6.5, 9);
        const ev = this.lines.update(this.clock, this.cam);
        this.hall.update(dt, this.clock);
        this._effects(ev, dt, this.clock, this.cam);
        this.sparks.update(this.clock, 300);
        this.mist.update(this.clock, 300);
    }

    /** For the test harness: run the hall's clock on by `s` seconds. */
    skip(s) {
        this.clock += s;
    }

    _near(x, z, R) {
        const d = Math.hypot(this.cam.x - x, this.cam.z - z);
        return clamp(1 - d / R, 0, 1) ** 1.5;
    }

    /** How near the camera is to a line, anywhere along it. */
    _nearLine(line, R = 60) {
        const z = clamp(this.cam.z, slotZ(LAST), Z0);
        return this._near(line.x, z, R);
    }

    _effects(ev, dt, t, cam) {
        const sp = this.sparks, mi = this.mist;
        const rate = Math.min(dt, 0.05) * 60;
        // welding sparks, and the nearest two torches light their surroundings
        let best = [null, null], bd = [Infinity, Infinity], weldNear = 0;
        for (const w of ev.welds) {
            const d2 = (w.x - cam.x) ** 2 + (w.z - cam.z) ** 2;
            if (d2 < bd[0]) {
                best[1] = best[0];
                bd[1] = bd[0];
                best[0] = w;
                bd[0] = d2;
            } else if (d2 < bd[1]) {
                best[1] = w;
                bd[1] = d2;
            }
            if (d2 > 90 * 90) continue;
            const n = Math.random() < (d2 < 40 * 40 ? 0.9 : 0.35) ? Math.ceil(rate * (d2 < 30 * 30 ? 2 : 1)) : 0;
            for (let i = 0; i < n; i++) {
                const s = 1.5 + Math.random() * 3;
                sp.emit(w.x, w.y, w.z, (w.nx * 0.6 + (Math.random() - 0.5)) * s, (Math.random() * 0.9 + 0.2) * s, (w.nz * 0.6 + (Math.random() - 0.5)) * s, { life: 0.4 + Math.random() * 0.6, size: 0.06 + Math.random() * 0.06, grav: 9.8, drag: 0.6, r: 3.2, g: 2.2 + Math.random() * 0.6, b: 0.9 });
            }
        }
        this.weldLights.forEach((l, i) => {
            const w = best[i];
            if (w && bd[i] < 50 * 50) {
                l.position.set(w.x + w.nx * 0.4, w.y + 0.2, w.z + w.nz * 0.4);
                l.intensity = 2 + Math.random() * 4;
            } else l.intensity = 0;
        });
        if (best[0]) weldNear = clamp(1 - Math.sqrt(bd[0]) / 22, 0, 1);
        this.sound?.weld(weldNear, dt);
        // arcs: the probes on the hands, the coils on the test rig
        const arcs = [];
        let zapLine0 = false;
        for (const a of ev.arcs) {
            const d2 = (a.a.x - cam.x) ** 2 + (a.a.z - cam.z) ** 2;
            if (d2 > 110 * 110 || Math.random() < 0.25) continue;
            arcs.push(a);
            if (a.line.id === 0 && a.big) zapLine0 = true;
            if (Math.random() < 0.3) sp.emit(a.b.x, a.b.y, a.b.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, { life: 0.3, size: 0.08, grav: 6, r: 1.4, g: 2.2, b: 3.6 });
        }
        this.arcs.draw(arcs);
        this.testLight.intensity = zapLine0 ? 6 + Math.random() * 14 : 0;
        if (zapLine0 && Math.random() < dt * 6) this.sound?.zap(this._near(0, slotZ(24), 45));
        // paint mist in the booths
        for (const m of ev.mist) {
            if ((m.x - cam.x) ** 2 + (m.z - cam.z) ** 2 > 90 * 90) continue;
            for (let i = 0; i < Math.ceil(rate * 0.6); i++) {
                const side = Math.random() < 0.5 ? -1 : 1;
                const y = 0.6 + Math.random() * 3.6;
                mi.emit(m.x + side * 2.0, y, m.z + (Math.random() - 0.5) * 1.6, -side * (1.5 + Math.random()), (Math.random() - 0.4) * 0.6, (Math.random() - 0.5) * 0.6, { life: 1.4 + Math.random(), size: 0.5 + Math.random() * 0.5, grav: -0.1, drag: 1.4, r: m.color.r, g: m.color.g, b: m.color.b });
            }
        }
        // steam as a unit is let go
        for (const p of ev.puffs) {
            const near = this._near(p.x, p.z, 70);
            if (near <= 0) continue;
            for (let i = 0; i < 26; i++) mi.emit(p.x + (Math.random() - 0.5) * 0.6, p.y, p.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, { life: 1.6 + Math.random(), size: 0.7 + Math.random() * 0.6, grav: -0.6, drag: 1.6, r: 0.85, g: 0.84, b: 0.82 });
            this.sound?.hiss(near);
        }
        // into the lava
        for (const s of ev.splashes) {
            for (let i = 0; i < 70; i++) {
                const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
                sp.emit(s.x + (Math.random() - 0.5) * 1.5, s.y + 0.2, s.z + (Math.random() - 0.5) * 1.5, Math.cos(a) * v * 0.45, 3 + Math.random() * 9, Math.sin(a) * v * 0.45, { life: 1.2 + Math.random() * 1.4, size: 0.18 + Math.random() * 0.25, grav: 9.8, drag: 0.2, r: 3.4, g: 1.1 + Math.random() * 0.6, b: 0.15 });
            }
            for (let i = 0; i < 24; i++) mi.emit(s.x + (Math.random() - 0.5) * 2, s.y + 0.5, s.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, { life: 3 + Math.random() * 2, size: 1.6 + Math.random() * 1.4, grav: -0.4, drag: 0.8, r: 0.25, g: 0.2, b: 0.18 });
            this.flare = 1;
            const near = clamp(1 - Math.hypot(cam.x - s.x, cam.z - s.z, (cam.y - s.y) * 0.5) / 90, 0, 1);
            this.sound?.splash(near);
            if (s.line.id === 0 && !this.log.burned) {
                this.log.burned = true;
                store.set('foundryLog', this.log);
            }
        }
        for (const f of ev.falls) this.sound?.fall(this._near(f.x, f.z, 70));
        // units burning in the lava throw up flames and smoke until they sink
        for (const r of this.lines.robots) {
            if (!r.post || r.tp < r.line.tHit || (r.x - cam.x) ** 2 + (r.z - cam.z) ** 2 > 140 * 140) continue;
            const k = clamp(1 - (r.tp - r.line.tHit) / 6, 0, 1);
            if (Math.random() < k * rate * 0.9) sp.emit(r.x + (Math.random() - 0.5) * 1.6, LAVA_Y + 0.3, r.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.8, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 0.8, { life: 0.8 + Math.random() * 0.8, size: 0.5 + Math.random() * 0.6, grav: -1.5, drag: 0.6, r: 3.2, g: 1.0 + Math.random() * 0.8, b: 0.12 });
            if (Math.random() < k * rate * 0.25) mi.emit(r.x + (Math.random() - 0.5), LAVA_Y + 1, r.z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.5, 1.5 + Math.random(), (Math.random() - 0.5) * 0.5, { life: 4 + Math.random() * 2, size: 1.5 + Math.random(), grav: -0.3, drag: 0.5, r: 0.14, g: 0.12, b: 0.11 });
        }
        // embers rising off the pit all the time
        for (let i = 0; i < (Math.random() < rate * 0.4 ? 1 : 0); i++) {
            sp.emit(lerp(X0 + 4, X1 - 4, Math.random()), LAVA_Y + 0.5, lerp(Z_FAR + 4, LEDGE_Z - 2, Math.random()), (Math.random() - 0.5) * 0.6, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 0.6, { life: 6 + Math.random() * 6, size: 0.12 + Math.random() * 0.12, grav: -0.15, drag: 0.15, r: 3, g: 0.9, b: 0.15 });
        }
        this.flare = Math.max(0, (this.flare || 0) - dt * 1.2);
        const fl = 1 + this.flare * 0.6 + 0.08 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 5.1);
        for (const l of this.lavaLights) l.intensity = 320 * fl;
        this.edgeLight.intensity = 30 * fl;
        // the lines' own noises
        for (const e of ev.index) this.sound?.index(this._nearLine(e.line) * (e.line.id ? 0.5 : 1));
        for (const e of ev.stops) this.sound?.stop1(this._nearLine(e.line) * (e.line.id ? 0.5 : 1));
        for (const e of ev.servos) this.sound?.servo(e.big ? this._near(e.x, e.z, 30) : this._nearLine(e.line, 30), e.big);
        for (const e of ev.boots) this.sound?.boot(this._near(e.x, e.z, 30));
        for (const e of ev.steps) this.sound?.step(this._near(e.x, e.z, 30));
    }

    _info(n) {
        const line = this.lines.lines[0];
        const units = this.lines.robots.filter((r) => r.line === line).sort((a, b) => b.serial - a.serial).map((r) => ({
            serial: r.serial, post: r.post,
            where: r.post ? 'walking' : `station ${String(r.k + 1).padStart(2, '0')}`,
            state: r.post ? (r.tp > T_TURN + r.line.tWalk ? 'LOST' : 'TO EXIT') : shopAt(r.k)?.name.replace('The ', '').toUpperCase() ?? '',
        }));
        return { units, lines: this.lines.lines.map((l) => l.state), despatched: n, cycle: CYCLE };
    }

    /** Which shop you are beside, for the banner and the HUD. */
    _where(p) {
        let id;
        if (p.z < LEDGE_Z) id = 'pit';
        else if (p.z < STRIP_END) id = 'apron';
        else if (p.z > Z0 + 4) id = 'lift';
        else id = shopAt(clamp(Math.round((Z0 - p.z) / PITCH), 0, LAST))?.id ?? 'lift';
        if (id === this.zoneNext) this.zoneT += 1 / 60;
        else {
            this.zoneNext = id;
            this.zoneT = 0;
        }
        if (id !== this.zone && this.zoneT > 0.6) {
            this.zone = id;
            const pl = PLACE[id];
            this._found(id);
        }
    }

    _found(id, quiet = false) {
        const pl = PLACE[id];
        if (!pl) return;
        if (this.dom.where) this.dom.where.textContent = pl.hud ?? pl.name;
        if (!quiet || !this.log[id]) this.env.ui?.zone(pl.name, pl.sub, pl.accent);
        if (!this.log[id]) {
            this.log[id] = true;
            store.set('foundryLog', this.log);
        }
    }

    /** Walking into the lift car takes you back up. */
    _liftCheck() {
        const p = this.controls.pos;
        const d = Math.hypot(p.x - LIFT.x, p.z - (LIFT.z + 0.3));
        if (d > 2.6) this.armed = true;
        else if (this.armed && d < 0.75) {
            this.armed = false;
            this._goUp();
        }
    }

    // ------------------------------------------------------------ picking

    pick(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        let best = null;
        // robots: a sphere round each
        for (const r of this.lines.robots) {
            const ox = r.x - o.x, oy = r.y - o.y, oz = r.z - o.z;
            const t = ox * d.x + oy * d.y + oz * d.z;
            if (t < 0 || t > 90) continue;
            const q2 = ox * ox + oy * oy + oz * oz - t * t;
            if (q2 < r.r * r.r && (!best || t < best.t)) best = { type: 'robot', robot: r, t };
        }
        // the quartermaster
        const sg = this.lines.sarge;
        if (sg) {
            const ox = sg.x - o.x, oy = sg.y - o.y, oz = sg.z - o.z;
            const t = ox * d.x + oy * d.y + oz * d.z;
            if (t > 0 && t < 90 && ox * ox + oy * oy + oz * oz - t * t < sg.r * sg.r && (!best || t < best.t)) best = { type: 'sarge', t };
        }
        // the lift car
        const car = new THREE.Box3(new V3(LIFT.x - 1.7, this.hall.carY, LIFT.z - 1.7), new V3(LIFT.x + 1.7, this.hall.carY + 3.3, LIFT.z + 1.7));
        const hit = ray.ray.intersectBox(car, new V3());
        if (hit) {
            const t = hit.distanceTo(o);
            if (t < 60 && (!best || t < best.t)) best = { type: 'lift', t };
        }
        // the floor (or the lava, past the ledge)
        if (d.y < -1e-4) {
            const t = -o.y / d.y;
            const pt = o.clone().addScaledVector(d, t);
            if (pt.z < LEDGE_Z && !this.walkable(pt.x, pt.z)) {
                const tl = (LAVA_Y - o.y) / d.y;
                const pl = o.clone().addScaledVector(d, tl);
                if ((!best || tl < best.t) && pl.z > Z_FAR) return { type: 'lava', t: tl, point: pl };
            } else if ((!best || t < best.t) && t < 80 && this.walkable(pt.x, pt.z)) return { type: 'ground', t, point: pt };
        }
        return best;
    }

    /** A click: walk there, look at a robot, take the lift. */
    tap(ray) {
        if (this.ride) return null;
        const h = this.pick(ray);
        if (!h) return null;
        const c = this.controls;
        if (h.type === 'ground') c.walkTo([{ x: h.point.x, z: h.point.z }]);
        else if (h.type === 'lift') {
            this.armed = true;
            c.walkTo([{ x: LIFT.x, z: LIFT.z - 2.6 }, { x: LIFT.x, z: LIFT.z + 0.3 }]);
        } else if (h.type === 'sarge') this.env.ui?.hint(`${SARGE_NOTE.title}: ${SARGE_NOTE.desc}`, 6000);
        else if (h.type === 'robot') {
            const n = this._robotNote(h.robot);
            this.env.ui?.hint(`${n.title}: ${n.desc}`, 5000);
        } else if (h.type === 'lava') this.env.ui?.hint('A stretch of the main gangway rusted through and fell in here, years ago. Nobody has mended it', 5000);
        return h;
    }

    _robotNote(r) {
        const line = `Line ${r.line.id + 1}`;
        const title = `Unit RX-${r.serial}`;
        if (!r.post) {
            const shop = shopAt(r.k);
            return { icon: '\u{1F916}', kicker: `${line} · ${shop?.name ?? ''} · station ${r.k + 1} of ${LAST + 1}`, title, desc: `Hanging from its hook, ${DOING[r.k]}.`, accent: shop?.accent ?? '#ffb45a' };
        }
        const tp = r.tp;
        const desc = tp < T_SLUMP ? 'Let go of its hook, and slumping.' : tp < T_BOOT ? 'Waking up: its eyes are coming on.' : tp < T_STAND ? 'Standing up for the first time.' : tp < T_LOOK ? 'Looking about at the hall it was made in.' : tp < T_TURN ? 'Turning to set off for the way out.' : tp < T_TURN + r.line.tWalk ? (r.rifle ? 'Marching for the exit with its new laser rifle, in perfect working order. Nobody has told it about the gap.' : r.tp < T_TURN + r.line.mergeAt / 1.05 ? 'Crossing the apron to join the walkway to the exit.' : 'Walking out over the pit for the exit. The quartermaster has a rifle for it.') : tp < r.line.tHit ? 'Falling: the walkway broke away here, long ago, just short of the door.' : 'Burning up in the lava, rifle and all. It never saw the gap.';
        return { icon: '\u{1F916}', kicker: `${line} · finished`, title, desc, accent: '#ff9a52' };
    }

    /** The hover card for what the pointer is over, or null. */
    hover(ray) {
        if (this.ride) return null;
        const h = this.pick(ray);
        if (!h) return null;
        if (h.type === 'robot') return this._robotNote(h.robot);
        if (h.type === 'sarge') return SARGE_NOTE;
        if (h.type === 'lift') return { icon: '\u{1F6D7}', kicker: 'The lift', title: 'Up to the Works', desc: 'A brass cage on a lattice shaft that goes up through the roof to the machine hall under the clock tower.', cta: 'Click, or walk in →', accent: '#ffd98a' };
        if (h.type === 'lava') return { icon: '\u{1F30B}', kicker: 'The pit', title: 'Lava', desc: 'Fourteen metres below the gangways. Long ago a stretch of the walkway rusted through and fell in, and every unit heading for the exit walks straight into the gap.', accent: '#ff6a2a' };
        return null;
    }

    stepSurface() {
        const p = this.controls?.pos;
        if (!p) return 'metal';
        if (p.z < LEDGE_Z + 0.2) return 'metal';
        if (Math.abs(p.x - LIFT.x) < 1.7 && Math.abs(p.z - LIFT.z) < 1.7) return 'metal';
        return 'stone';
    }
}

const SARGE_NOTE = { icon: '\u{1F396}\u{FE0F}', kicker: 'Beside the walkway, just short of the exit', title: 'The Quartermaster', desc: 'A big olive-drab unit with a crate of laser rifles, issuing one to every unit that marches past. It has never once looked up from the crate at the walkway ahead.', accent: '#a8c070' };
export { STATIONS, LINES, MOVE, DWELL, SERIAL0, CEIL };
