// The Black Nocturne: a gothic pirate galleon moored at the pirate wharf.
//
// Moored, she rocks on the swell and can be boarded over a gangplank and
// walked from end to end (her decks are floors the walker queries, riding
// her motion). Stand behind the wheel and she casts off, backing out and
// swinging round; then the helm is yours: A/D steer, W/S set the sails.
// Esc, or backing away from the wheel, hands her to the autopilot, which
// brings her home to the berth. The model is in ship-hull/rig/deck.js.

import * as THREE from 'three';
import { TAU, clamp, lerp, damp, smoothstep, angleDiff, store } from './util.js';
import { swellAt } from './boat.js';
import { EYE } from './controls.js';
import { S, Parts, shipMats, V, deckAt } from './ship-kit.js';
import { buildHull, glassMaterial, glassTextures } from './ship-hull.js';
import { buildDeck } from './ship-deck.js';
import { buildRig } from './ship-rig.js';
import { softDot } from './ship-textures.js';

const $ = (id) => document.getElementById(id);
const touch = () => matchMedia('(pointer: coarse)').matches;

const MAX_SPEED = 10.5;
const REVERSE = 3.2;       // casting off: m/s astern
const BACK_OUT = 17;       // metres straight astern before the swing
const SWING = 0.5;         // rad/s while swinging round
const EYE_Y = S.QUARTER + EYE + 0.1;
// the chase view: behind and above her, looking over the bow at the sea ahead (the wheel's own view is full of masts and sails)
const CHASE_D = 34, CHASE_H = 18;
// points round the hull that must stay in deep water
const HULL_PTS = [[0, -12.5], [0, -18.5], [-2.2, -9], [2.2, -9], [-3.7, -3], [3.7, -3], [-3.7, 3], [3.7, 3], [-2.8, 9], [2.8, 9], [0, 13.2]];

const wrap = (a) => ((a % TAU) + TAU) % TAU;
const pointSeg = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};

export class Ship {
    constructor({ world, scene, camera, controls, ui, audio, quality }) {
        this.world = world;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.ui = ui;
        this.audio = audio;
        const wh = (this.wharf = world.wharf);
        const { berth } = wh;
        this.berth = berth;
        this.pos = { x: berth.x, z: berth.z };
        this.yaw = berth.yaw;
        this.mode = 'docked';       // docked | castoff | sail | return
        this.t = 0;                 // time in the mode
        this.speed = 0;
        this.rudder = 0;            // -1 (to port) .. 1 (to starboard); the wheel follows it
        this.sail = 0;              // 0..1
        this.heave = 0; this.pitch = 0; this.roll = 0;
        this.heel = 0;
        this.lookYaw = 0;
        this._lastYaw = 0;
        this.camYaw = this.yaw;
        this.view = store.get('shipView', 'helm') === 'chase' ? 'chase' : 'helm'; // starts at the wheel; C switches (and is remembered)
        this.dwell = 0;
        this.armed = true;
        this.plankK = 1;            // 1 = the gangplank is out
        this.input = { left: false, right: false, up: false, down: false };
        this.backT = 0;
        this.onEvent = null;
        this.warned = 0;
        this._c = Math.cos(this.yaw);
        this._s = Math.sin(this.yaw);
        // the pier's unit vectors: out to sea, and the ship's side
        this.o = { x: wh.dx, z: wh.dz };
        this.q = { x: wh.dz, z: -wh.dx };
        this.ringR = this._ringRadius();
        this.maxR = this.ringR + 200;
        this.obstacles = this._obstacles();

        // ---- the model
        const mats = shipMats(world);
        this.mats = mats;
        const group = (this.group = new THREE.Group());
        group.name = 'black-nocturne';
        const glassTex = glassTextures();
        this.glassMats = [];
        const ctx = (this.ctx = {
            group, col: [], lights: [], anim: [], tex: glassTex, mats,
            sailTex: quality.tier === 'low' ? 128 : quality.tier === 'medium' ? 192 : 256,
            glassMat: (tex) => {
                const m = glassMaterial(tex);
                this.glassMats.push(m);
                return m;
            },
        });
        const P = new Parts();
        buildHull(P, ctx);
        buildDeck(P, ctx, mats);
        buildRig(P, ctx, mats);
        const body = P.build(mats);
        body.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        group.add(body);
        // invisible stand-ins for clicking on her (the real meshes are far too heavy to ray-cast every frame)
        const hit = new THREE.MeshBasicMaterial({ visible: false });
        this.proxy = [[7.6, 4.6, 25, 0, 0.7, 0], [5.2, 5.5, 9, 0, 6.4, 8.2], [5.4, 3.2, 4.4, 0, 5, -10.2], [1.4, 24, 1.4, 0, 13, -1], [1.4, 18, 1.4, 0, 11, -7], [1.4, 16, 1.4, 0, 11, 6.2], [13, 13, 1.6, 0, 17, -1.5], [11, 12, 1.4, 0, 14, -7.5]].map(([w, h, d, x, y, z]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hit);
            m.position.set(x, y, z);
            group.add(m);
            return m;
        });
        this.wheel = ctx.wheel;
        this.rune = ctx.runeRing;
        group.position.set(berth.x, 0, berth.z);
        group.rotation.set(0, berth.yaw, 0, 'YXZ');
        scene.add(group);
        this.anim = ctx.anim;

        // the gangplank: pulled in when she casts off
        const plank = (this.plank = new THREE.Group());
        const pm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 1), mats.plank);
        const rails = [-1, 1].map((s) => {
            const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), mats.rope);
            r.position.set(s * 0.58, 0.55, 0);
            return r;
        });
        const posts = [];
        plank.add(pm, ...rails);
        for (const e of [-0.5, 0.5]) for (const s of [-1, 1]) {
            const pst = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), mats.iron);
            pst.position.set(s * 0.58, 0.28, e);
            posts.push(pst);
        }
        plank.add(...posts);
        plank.traverse((o) => (o.castShadow = true));
        scene.add(plank);
        this.plankParts = { pm, rails, posts };
        this.plankE = new THREE.Vector3(); this.plankB = new THREE.Vector3();

        // ---- the ship's colliders at her berth, and her decks as floors
        const c = Math.cos(berth.yaw), s = Math.sin(berth.yaw);
        for (const k of ctx.col) world.colliders.push({ x: berth.x + k.x * c + k.z * s, z: berth.z - k.x * s + k.z * c, r: k.r });
        world.dynFloors.push((x, z) => this._floorAt(x, z));
        world.finalize();
        world.nav?.reset();

        // ---- lights that come on at night
        this.lights = [
            Object.assign(new THREE.PointLight(0xffa860, 0, 19, 2), { userData: { at: V(0, S.QUARTER + 2.4, 8.4), k: 34 } }),
            Object.assign(new THREE.PointLight(0x7dffd0, 0, 17, 2), { userData: { at: V(0, S.FORE + 3.0, -9.8), k: 20 } }),
        ];
        for (const l of this.lights) {
            group.add(l);
            l.position.copy(l.userData.at);
        }
        this._night = 0;

        // ---- spray and wake
        this._wake();
        this._bats();
        this._ui();
        this._keys();
        this.update(0, 0, 0);
    }

    /** Distance along a ray to the ship, or null. */
    pick(ray) {
        this.group.updateMatrixWorld(true);
        const h = ray.intersectObjects(this.proxy, false)[0];
        return h ? h.distance : null;
    }

    /** Is (x, z) a place on her decks? */
    onBoard(x, z) {
        return this.mode === 'docked' && Math.hypot(x - this.pos.x, z - this.pos.z) < 15 && this._floorAt(x, z) > -Infinity;
    }

    get busy() { return this.mode !== 'docked'; }
    get sailing() { return this.mode === 'sail'; }
    get away() { return this.mode !== 'docked'; }

    // ------------------------------------------------------------ geometry

    _ringRadius() {
        const { island } = this.world, L = this.world.layout;
        let R = L.islandR + 8;
        for (; R < L.islandR + 90; R += 6) {
            let ok = true;
            for (let i = 0; i < 180 && ok; i++) {
                const a = (i / 180) * TAU;
                if (island.heightAt(Math.sin(a) * R, Math.cos(a) * R) > -2.5) ok = false;
            }
            if (ok) break;
        }
        const wh = this.wharf;
        const tip = wh.toW(0, wh.length + 10);
        return Math.max(R + 6, Math.hypot(tip.x, tip.z) + 18);
    }

    /** Things the water doesn't tell us about: the other docks (capsules: ax, az, bx, bz, radius). */
    _obstacles() {
        const L = this.world.layout, wh = this.wharf;
        const pr = L.pier, d = L.dock;
        const w0 = wh.toW(0, wh.rampEnd - 4);
        return [
            [0, d.start, 0, d.end + 4, 8],
            [pr.ax, pr.az, pr.bx, pr.bz, 5],
            [w0.x, w0.z, wh.bx, wh.bz, 9.5],
        ];
    }

    _blocked(x, z, yaw, ignoreWharf = false) {
        const c = Math.cos(yaw), s = Math.sin(yaw), I = this.world.island;
        for (const [lx, lz] of HULL_PTS) {
            const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
            if (I.heightAt(px, pz) > -1.5) return true;
            for (let i = 0; i < this.obstacles.length; i++) {
                if (ignoreWharf && i === 2) continue;
                const o = this.obstacles[i];
                if (pointSeg(px, pz, o[0], o[1], o[2], o[3]) < o[4]) return true;
            }
        }
        return false;
    }

    /** The planks under (x, z) on the gangplank, else -Infinity. */
    _plankAt(x, z) {
        if (this.plankK < 0.5) return -Infinity;
        const a = this.plankE, b = this.plankB;
        const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
        const t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
        if (t < 0 || t > 1) return -Infinity;
        if (Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(l2) > 0.62) return -Infinity;
        return lerp(a.y, b.y, t);
    }

    /** Height of the ship's decks (or her gangplank) at world (x, z); -Infinity where there are none. */
    _floorAt(x, z) {
        const dx = x - this.pos.x, dz = z - this.pos.z;
        if (dx * dx + dz * dz > 20 * 20) return this.mode === 'docked' ? this._plankAt(x, z) : -Infinity;
        const lx = dx * this._c - dz * this._s, lz = dx * this._s + dz * this._c;
        const h = deckAt(lx, lz);
        if (h === -Infinity) return this.mode === 'docked' ? this._plankAt(x, z) : -Infinity;
        const e = this.group.matrixWorld.elements;
        return e[13] + e[1] * lx + e[5] * h + e[9] * lz;
    }

    /** Ship coordinates of a world point. */
    local(x, z) {
        const dx = x - this.pos.x, dz = z - this.pos.z;
        return { x: dx * this._c - dz * this._s, z: dx * this._s + dz * this._c };
    }

    /** World position of a ship-local point (through her current tilt). */
    toWorld(lx, ly, lz, out = new THREE.Vector3()) {
        return out.set(lx, ly, lz).applyMatrix4(this.group.matrixWorld);
    }

    /** Where the helmsman stands (world x, z and the yaw that faces the bow). */
    get helm() {
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        return { x: this.pos.x + S.HELM_Z * s, z: this.pos.z + S.HELM_Z * c, yaw: this.yaw };
    }

    /** A walk from wherever the player is to the wheel: down the wharf, over the gangplank, up the stairs. */
    route(controls) {
        const wh = this.wharf, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        const w = (lx, lz) => ({ x: this.pos.x + lx * c + lz * s, z: this.pos.z - lx * s + lz * c });
        const onShip = this._floorAt(controls.pos.x, controls.pos.z) > -Infinity && Math.hypot(controls.pos.x - this.pos.x, controls.pos.z - this.pos.z) < 15;
        const pts = [];
        if (!onShip) {
            pts.push(...wh.route(controls, wh.toW(wh.half - 1.2, wh.gangway.lz)));
            pts.push({ x: wh.gangway.x, z: wh.gangway.z });
            pts.push(w(-3.0, 1.0));
        }
        // across the deck to the starboard stairs, up and aft to the wheel
        const here = onShip ? this.local(controls.pos.x, controls.pos.z) : { x: -3.0, z: 1.0 };
        if (here.z < S.QUARTER_Z - 0.2) {
            pts.push(w(-3.0, 1.0));
            pts.push(w(-2.05, 0.3));
            pts.push(w(-2.05, 3.7));
        }
        // up the quarterdeck down the port side of the binnacle and wheel, then in behind it
        pts.push(w(-1.0, 6.0), w(-1.0, 10.1), w(0, S.HELM_Z));
        return pts;
    }

    // -------------------------------------------------------------- update

    update(dt, t, night) {
        this._night = night;
        this.t += dt;
        const mode = this.mode;
        if (mode === 'castoff') this._castoff(dt);
        else if (mode === 'sail') this._sail(dt, t);
        else if (mode === 'return') this._return(dt, t);
        this._float(dt, t);
        this.group.position.set(this.pos.x, this.heave, this.pos.z);
        this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
        this.group.updateMatrixWorld(true);
        this._c = Math.cos(this.yaw);
        this._s = Math.sin(this.yaw);
        this._plankUpdate(dt);
        if (this.wheel) this.wheel.rotation.z = damp(this.wheel.rotation.z, -this.rudder * 2.6, 6, dt);
        const wind = clamp(0.25 + this.speed / MAX_SPEED * 0.75 + (mode === 'sail' ? this.sail * 0.2 : 0), 0, 1);
        for (const f of this.anim) f(t, wind);
        this._glow(dt, t, night);
        if (mode === 'docked') {
            this._helmWatch(dt, t);
            if (this._land) this._landGlide(dt);
        } else this._camera(dt);
        this._effects(dt, t);
        this._batsUpdate(dt, t, night);
        this._hud(dt);
        this._sound(dt);
    }

    /** Ride the swell: the sea's height under the hull's corners gives her heave, pitch and roll. */
    _float(dt, t) {
        const { x, z } = this.pos, I = this.world.island;
        const d = I.heightAt(x, z);
        const amp = lerp(0.25, 1, smoothstep(0, 0.3, clamp(-d / 12, 0, 1)));
        const c = this._c, s = this._s;
        const at = (lx, lz) => swellAt(x + lx * c + lz * s, z - lx * s + lz * c, t, amp);
        const bow = at(0, -9), stern = at(0, 9), port = at(-3.4, 0), star = at(3.4, 0), mid = at(0, 0);
        // she is heavy: she follows the swell but slowly, and only just exaggerates it
        const k = 1 - Math.exp(-dt * 1.5);
        const wantH = (bow + stern + port + star + mid * 2) / 6 + 0.12 + Math.sin(t * 0.7) * 0.03;
        const wantP = Math.atan2(bow - stern, 18) * 1.1 + Math.sin(t * 0.4 + 1) * 0.005;
        const wantR = Math.atan2(star - port, 6.8) * 1.15 + Math.sin(t * 0.33) * 0.008 - this.heel;
        if (dt === 0) {
            this.heave = wantH; this.pitch = wantP; this.roll = wantR;
        } else {
            this.heave = lerp(this.heave, wantH, k);
            this.pitch = lerp(this.pitch, wantP, k);
            this.roll = lerp(this.roll, wantR, k);
        }
    }

    _plankUpdate(dt) {
        const wh = this.wharf;
        const g = this.group;
        const out = this.mode === 'docked' || (this.mode === 'castoff' && this.t < 1.2);
        this.plankK = damp(this.plankK, out ? 1 : 0, 6, dt || 1);
        if (dt === 0) this.plankK = 1;
        const e = this.plankE, b = this.plankB;
        const E = wh.toW(wh.half - 0.55, wh.gangway.lz);
        e.set(E.x, wh.y, E.z);
        this.toWorld(-2.85, S.DECK, 1.0, b);
        const visible = this.plankK > 0.02;
        this.plank.visible = visible;
        if (!visible) return;
        // when pulled in, the plank slides back onto the wharf
        const k = smoothstep(0, 1, this.plankK);
        const bb = V(0, 0, 0).lerpVectors(e.clone().add(V(0, 0.06, 0)), b, k);
        const d = bb.clone().sub(e);
        const len = Math.max(0.3, d.length());
        this.plank.position.copy(e.clone().add(bb).multiplyScalar(0.5)).add(V(0, 0.06, 0));
        this.plank.lookAt(this.plank.position.clone().add(d));
        this.plank.scale.set(1, 1, len);
        void g;
    }

    // --------------------------------------------------------- the helm

    /** Stand behind the wheel for a moment and she casts off. */
    _helmWatch(dt, t) {
        const c = this.controls;
        const hm = this.helm;
        const d = Math.hypot(c.pos.x - hm.x, c.pos.z - hm.z);
        const onDeck = c.enabled && !c.seated && this._floorAt(c.pos.x, c.pos.z) > S.QUARTER - 0.5;
        if (d > 2.2) this.armed = true;
        if (onDeck && this.armed && d < 0.85 && !this.ui.blocking) {
            this.dwell += dt;
            if (this.dwell > 0.5) this.takeHelm();
        } else this.dwell = Math.max(0, this.dwell - dt * 2);
        const near = onDeck && d < 6 ? 1 : 0;
        this.rune.material.opacity = damp(this.rune.material.opacity, (near ? 0.55 : 0.2) * (0.7 + 0.3 * Math.sin(t * 2.4)) * (1 + this._night * 0.6), 4, dt);
        // first steps aboard
        const sh = this._floorAt(c.pos.x, c.pos.z);
        if (c.enabled && sh > -Infinity && sh > this.wharf.y - 0.5 && Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < 14 && !this._aboardHint) {
            this._aboardHint = true;
            this.onEvent?.('aboard');
        } else if (this._aboardHint && Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) > 30) this._aboardHint = false;
    }

    takeHelm() {
        if (this.mode !== 'docked') return;
        const c = this.controls;
        c.keys.clear();
        c.route = null;
        c.vel.set(0, 0);
        c.seated = true;
        c.enabled = true;
        this.lookYaw = 0;
        this.camYaw = this.yaw;
        this._lastYaw = c.yaw;
        this.speed = 0;
        this.sail = 0;
        this.rudder = 0;
        this.backT = 0;
        this.dwell = 0;
        this._castS = 0;
        this.wantHome = false;
        this._castYaw0 = this.yaw;
        this._arc = null;
        this._blend = { pos: this.camera.position.clone(), yaw: c.yaw, pitch: c.pitch, t: 0 };
        this._mode('castoff');
        this.onEvent?.('castoff');
    }

    _mode(m) {
        this.mode = m;
        this.t = 0;
    }

    /** Back out from the berth, then swing round (stern-first) until she faces open sea. */
    _castoff(dt) {
        const o = this.o;
        if (this.t < 1.3) return; // the gangplank comes in
        const t = this.t - 1.3;
        if (!this._arc) {
            // straight astern, accelerating
            const v = Math.min(REVERSE, t * 1.1);
            this._castS += v * dt;
            this.speed = -v;
            this.pos.x = this.berth.x + o.x * this._castS;
            this.pos.z = this.berth.z + o.z * this._castS;
            if (this._castS >= BACK_OUT) this._arc = { t: 0 };
        } else {
            // reversing round an arc, bow swinging away from the wharf
            const a = this._arc;
            a.t += dt;
            const total = Math.PI / SWING;
            const v = REVERSE * (1 - 0.6 * smoothstep(0.6 * total, total, a.t));
            this.yaw += SWING * dt;
            this.pos.x += Math.sin(this.yaw) * v * dt;
            this.pos.z += Math.cos(this.yaw) * v * dt;
            this.speed = -v;
            this.heel = lerp(this.heel, -0.03, 1 - Math.exp(-dt * 2));
            this.rudder = damp(this.rudder, 1, 2, dt);
            if (a.t >= total) {
                this.yaw = this._castYaw0 + Math.PI;
                this._handOver();
            }
        }
    }

    _handOver() {
        this.speed = 0;
        this.sail = 0.35;
        this.rudder = 0;
        this._mode('sail');
        if (this.wantHome) {
            this.wantHome = false;
            this.requestReturn();
            return;
        }
        this.onEvent?.('helm');
    }

    // ------------------------------------------------------------ sailing

    _sail(dt, t) {
        const inp = this.input;
        const steer = (inp.left ? 1 : 0) - (inp.right ? 1 : 0); // + turns to port (the yaw grows)
        this.rudder = damp(this.rudder, -steer, 2.4, dt);
        this.sail = clamp(this.sail + ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * 0.35 * dt, 0, 1);
        const want = MAX_SPEED * Math.pow(this.sail, 0.85);
        this.speed = damp(this.speed, want, 0.55, dt);
        // she answers the helm slowly, and barely at all when stopped
        const rate = -this.rudder * 0.44 * clamp(0.28 + this.speed / 5, 0.28, 1);
        this.heel = damp(this.heel, this.rudder * clamp(this.speed / MAX_SPEED, 0, 1) * 0.04, 1.2, dt);
        const yaw = this.yaw + rate * dt;
        const nx = this.pos.x - Math.sin(yaw) * this.speed * dt, nz = this.pos.z - Math.cos(yaw) * this.speed * dt;
        if (!this._blocked(nx, nz, yaw)) {
            this.pos.x = nx; this.pos.z = nz; this.yaw = yaw;
        } else if (!this._blocked(this.pos.x, this.pos.z, yaw)) {
            // turning in place is allowed, going on is not: she grinds to a halt (the sails can't push her through the shoal)
            this.yaw = yaw;
            this.speed = 0;
            this._shoal(t);
        } else {
            this.speed = 0;
            this._shoal(t);
        }
        // the edge of the sailing water: a bank of mist turns her back
        const r = Math.hypot(this.pos.x, this.pos.z);
        if (r > this.maxR - 25) {
            const toC = Math.atan2(-this.pos.x, -this.pos.z);
            this.yaw += clamp(angleDiff(this.yaw, toC), -0.2, 0.2) * dt * smoothstep(this.maxR - 25, this.maxR, r) * 2;
            if (this.warned < t - 8) {
                this.warned = t;
                this.onEvent?.('mist');
            }
        }
        // backing away from the wheel (S with the sails already furled and way off) brings her home
        if (inp.down && this.sail < 0.02 && this.speed < 1.2) {
            this.backT += dt;
            if (this.backT > 0.7) this.requestReturn();
        } else this.backT = Math.max(0, this.backT - dt);
    }

    _shoal(t) {
        if (this.warned < t - 5) {
            this.warned = t;
            this.onEvent?.('shoal');
        }
    }

    requestReturn() {
        // asked for while still casting off: she comes straight home once she is free of the wharf
        if (this.mode === 'castoff') this.wantHome = true;
        if (this.mode !== 'sail') return;
        this._route();
        this._mode('return');
        this.onEvent?.('return');
    }

    /** A path home: out to the safe ring if need be, round it, then in along the wharf's axis. */
    _route() {
        const wh = this.wharf, o = this.o;
        const berthLx = 7.5;
        const at = (lz, lx = berthLx) => wh.toW(lx, lz);
        const W1 = at(wh.shipC + 80), G = at(wh.shipC + 56), B = { x: this.berth.x, z: this.berth.z };
        const pts = [{ x: this.pos.x, z: this.pos.z }];
        const r0 = Math.hypot(this.pos.x, this.pos.z), a0 = Math.atan2(this.pos.x, this.pos.z);
        const a1 = Math.atan2(W1.x, W1.z), r1 = Math.hypot(W1.x, W1.z);
        const R = Math.max(this.ringR, r1 + 8);
        // already outside the ring and on the wharf's side, or open water all the way to the approach: go straight in
        const direct = (r0 > R - 4 && Math.abs(angleDiff(a0, a1)) < 0.25) || this._lineClear(this.pos, W1);
        if (!direct) {
            if (r0 < R - 6) pts.push({ x: Math.sin(a0) * R, z: Math.cos(a0) * R });
            const da = angleDiff(a0, a1);
            const n = Math.max(1, Math.ceil(Math.abs(da) / 0.12));
            for (let i = 1; i <= n; i++) {
                const a = a0 + (da * i) / n;
                const r = Math.max(R, r0 > R ? lerp(r0, R, Math.min(1, i / 3)) : R);
                pts.push({ x: Math.sin(a) * r, z: Math.cos(a) * r });
            }
        }
        pts.push({ x: W1.x, z: W1.z }, { x: G.x, z: G.z }, B);
        this.path = pts;
        this.pathI = 1;
        void o;
    }

    /** Is the sea open (deep, clear of the other docks) along a straight line from a to b, a ship's width either side? */
    _lineClear(a, b) {
        const I = this.world.island;
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len, nz = dx / len;
        for (let d = 0; d <= len; d += 5) {
            for (const off of [0, -7, 7]) {
                const x = a.x + (dx / len) * d + nx * off, z = a.z + (dz / len) * d + nz * off;
                if (I.heightAt(x, z) > -2.5) return false;
                for (const o of this.obstacles) if (pointSeg(x, z, o[0], o[1], o[2], o[3]) < o[4] + 6) return false;
            }
        }
        return true;
    }

    _return(dt, t) {
        const p = this.path;
        const B = p[p.length - 1];
        // pure pursuit: aim at a point a little way along the path
        let i = this.pathI;
        while (i < p.length - 1 && Math.hypot(p[i].x - this.pos.x, p[i].z - this.pos.z) < 18) i++;
        this.pathI = i;
        const tgt = p[i];
        const want = Math.atan2(-(tgt.x - this.pos.x), -(tgt.z - this.pos.z));
        const toB = Math.hypot(B.x - this.pos.x, B.z - this.pos.z);
        const G = p[p.length - 2];
        const toG = Math.hypot(G.x - this.pos.x, G.z - this.pos.z);
        const nearEnd = i >= p.length - 1;
        const targetV = nearEnd ? clamp(toB * 0.14, 0.7, 4) : i === p.length - 2 ? clamp(toG * 0.2 + 3.6, 3.6, 8) : 8;
        this.speed = damp(this.speed, targetV, 1.1, dt);
        this.sail = clamp(this.speed / MAX_SPEED, 0, 1);
        const err = angleDiff(this.yaw, want);
        const rate = clamp(err * 1.4, -0.5, 0.5);
        this.rudder = damp(this.rudder, -clamp(rate / 0.44, -1, 1), 3, dt);
        this.heel = damp(this.heel, this.rudder * clamp(this.speed / MAX_SPEED, 0, 1) * 0.04, 1.2, dt);
        this.yaw += rate * dt;
        this.pos.x -= Math.sin(this.yaw) * this.speed * dt;
        this.pos.z -= Math.cos(this.yaw) * this.speed * dt;
        if (toB < 2.2 && this.speed < 1.6) {
            // the last stretch: ease onto the berth
            const k = 1 - Math.exp(-dt * 2.2);
            this.pos.x = lerp(this.pos.x, B.x, k);
            this.pos.z = lerp(this.pos.z, B.z, k);
            this.yaw += angleDiff(this.yaw, this.berth.yaw) * k;
            this.speed *= Math.exp(-dt * 1.5);
            if (toB < 0.12) this._arrive();
        }
        void t;
    }

    _arrive() {
        const c = this.controls;
        this.pos.x = this.berth.x; this.pos.z = this.berth.z; this.yaw = this.berth.yaw;
        this.speed = 0; this.sail = 0; this.rudder = 0; this.heel = 0;
        this._c = Math.cos(this.yaw); this._s = Math.sin(this.yaw);
        this._mode('docked');
        this.plankK = 0.01;
        this.group.position.set(this.pos.x, this.heave, this.pos.z);
        this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
        this.group.updateMatrixWorld(true);
        // the camera glides in from wherever it was (the chase view sits 35 m back) to the player's eyes
        this._land = { pos: this.camera.position.clone(), yaw: this.camera.rotation.y, pitch: this.camera.rotation.x, t: 0 };
        // set the player down at the wheel
        c.seated = false;
        const hm = this.helm;
        c.teleport(hm.x, hm.z, this.yaw);
        c.pitch = -0.05;
        c.enabled = true;
        this.armed = false;
        this.dwell = 0;
        this.world.nav?.reset();
        this.onEvent?.('moored');
    }

    // ---------------------------------------------------------- the camera

    /** After mooring: ease the camera from where the ride left it to the walking view the controls just set. */
    _landGlide(dt) {
        const l = this._land, cam = this.camera;
        l.t += dt;
        if (l.t >= 1.3 || this.controls.seated || !this.controls.enabled) {
            this._land = null;
            return;
        }
        const k = smoothstep(0, 1, l.t / 1.3);
        cam.position.lerpVectors(l.pos, cam.position, k);
        cam.rotation.set(lerp(l.pitch, cam.rotation.x, k), l.yaw + angleDiff(l.yaw, cam.rotation.y) * k, cam.rotation.z * k, 'YXZ');
    }

    /** Switch between the chase view and the wheel's own view (C). */
    toggleView() {
        if (this.mode === 'docked') return;
        this.view = this.view === 'chase' ? 'helm' : 'chase';
        store.set('shipView', this.view);
        this.lookYaw = 0;
        this.camYaw = this.yaw;
        const c = this.controls;
        this._lastYaw = this.yaw;
        c.yaw = this.yaw;
        this._blend = { pos: this.camera.position.clone(), yaw: this.camera.rotation.y, pitch: this.camera.rotation.x, t: 0 };
        this.onEvent?.('view');
    }

    _camera(dt) {
        const c = this.controls, cam = this.camera;
        const chase = this.view === 'chase';
        // dragging turns the head at the wheel, or swings the camera round the ship
        const lim = chase ? Math.PI : 2.6;
        this.lookYaw = clamp(angleDiff(0, this.lookYaw + angleDiff(this._lastYaw, c.yaw)), -lim, lim);
        c.yaw = this.yaw + this.lookYaw;
        this._lastYaw = c.yaw;
        this.camYaw += angleDiff(this.camYaw, this.yaw) * (1 - Math.exp(-dt * 2.2));
        const helmEye = this.toWorld(0, EYE_Y, S.HELM_Z, this._eye ??= new THREE.Vector3());
        let eye = helmEye, yaw, pitch, roll;
        if (chase) {
            // the camera follows her heading a little late, keeps level, and rides only a little of her motion
            const ang = this.camYaw + this.lookYaw;
            const H = clamp(CHASE_H - c.pitch * 26, 7, 46);
            eye = this._chase ??= new THREE.Vector3();
            eye.set(this.pos.x + Math.sin(ang) * CHASE_D, H + this.heave * 0.3, this.pos.z + Math.cos(ang) * CHASE_D);
            const tx = this.pos.x - Math.sin(this.yaw) * 10, tz = this.pos.z - Math.cos(this.yaw) * 10;
            const dx = tx - eye.x, dy = 4 - eye.y, dz = tz - eye.z;
            yaw = Math.atan2(-dx, -dz);
            pitch = Math.atan2(dy, Math.hypot(dx, dz));
            roll = this.roll * 0.15;
        } else {
            yaw = this.yaw + this.lookYaw;
            pitch = clamp(c.pitch, -0.9, 0.9) + this.pitch * 0.5;
            roll = this.roll * 0.55;
        }
        let k = 1, from = null;
        if (this._blend) {
            const b = this._blend;
            b.t += dt;
            k = smoothstep(0, 1, b.t / 0.9);
            from = b;
            if (b.t >= 0.9) this._blend = null;
        }
        if (from) {
            cam.position.lerpVectors(from.pos, eye, k);
            cam.rotation.set(lerp(from.pitch, pitch, k), from.yaw + angleDiff(from.yaw, yaw) * k, roll * k, 'YXZ');
        } else {
            cam.position.copy(eye);
            cam.rotation.set(pitch, yaw, roll, 'YXZ');
        }
        // the rest of the garden thinks of the player as standing at the wheel
        const hm = this.helm;
        c.pos.set(hm.x, helmEye.y - EYE, hm.z);
    }

    // ------------------------------------------------------------- effects

    _glow(dt, t, night) {
        const m = this.mats;
        const flick = 0.92 + 0.08 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
        m.lamp.emissiveIntensity = lerp(0.35, 3.4, night) * flick;
        m.ecto.emissiveIntensity = lerp(0.5, 3.4, night) * (0.85 + 0.15 * Math.sin(t * 1.7));
        m.redlamp.emissiveIntensity = lerp(0.4, 2.6, night);
        m.greenlamp.emissiveIntensity = lerp(0.4, 2.6, night);
        for (const g of this.glassMats) g.emissiveIntensity = lerp(0.3, 2.4, night);
        for (const l of this.lights) {
            const on = night * l.userData.k * (0.94 + 0.06 * Math.sin(t * 7 + l.userData.k));
            l.intensity = dt > 0 ? damp(l.intensity, on, 3, dt) : on;
        }
    }

    /** A few bats that circle the masts after dusk, and stay with her at sea. */
    _bats() {
        const mat = new THREE.MeshBasicMaterial({ color: 0x08050c, side: THREE.DoubleSide });
        const wing = new THREE.BufferGeometry();
        wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0.2, -0.05, 0.55, -0.08, 0.32, 0, 0, 0, 0.55, -0.08, 0.32, 0.22, -0.2, 0.3], 3));
        this.bats = Array.from({ length: 8 }, (_, i) => {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4).scale(1, 1, 1.7), mat);
            const wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
            wr.scale.x = -1;
            g.add(body, wl, wr);
            g.visible = false;
            this.scene.add(g);
            return { g, wl, wr, phase: i * 1.7, r: 5 + i * 1.4, h: 13 + (i % 4) * 3.6, sp: (i % 2 ? 1 : -1) * (0.45 + i * 0.05) };
        });
    }

    _batsUpdate(dt, t, night) {
        const vis = smoothstep(0.35, 0.7, night);
        for (const b of this.bats) {
            b.g.visible = vis > 0.02;
            if (!b.g.visible) continue;
            const a = t * b.sp + b.phase;
            const x = this.pos.x + Math.cos(a) * b.r, z = this.pos.z + Math.sin(a) * b.r;
            b.g.position.set(x, this.heave + b.h + Math.sin(t * 1.3 + b.phase) * 1.6, z);
            b.g.rotation.y = Math.atan2(-Math.sin(a) * b.sp, Math.cos(a) * b.sp);
            b.g.scale.setScalar(1.4 * vis);
            const flap = Math.sin(t * 15 + b.phase * 3) * 0.75;
            b.wl.rotation.z = flap;
            b.wr.rotation.z = -flap;
        }
    }

    _wake() {
        const N = 260;
        this.wake = { n: N, i: 0, pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), age: new Float32Array(N).fill(9), col: new Float32Array(N * 3), size: 1 };
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.wake.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.wake.col, 3));
        const mat = new THREE.PointsMaterial({ size: 1.05, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        this.wakePts = new THREE.Points(g, mat);
        this.wakePts.frustumCulled = false;
        this.wakePts.renderOrder = 5; // after the sea, which would otherwise paint over it
        this.scene.add(this.wakePts);
        this._acc = 0;
    }

    _effects(dt, t) {
        const w = this.wake;
        const moving = Math.abs(this.speed);
        // spawn foam at the bow and along both sides, more the faster she goes
        this._acc += dt * moving * 7;
        const c = this._c, s = this._s;
        const loc = (lx, lz) => [this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c];
        while (this._acc > 1 && dt > 0) {
            this._acc -= 1;
            const i = w.i++ % w.n;
            const fwd = this.speed >= 0;
            const side = Math.random() < 0.5 ? -1 : 1;
            const lz = fwd ? -11 + Math.random() * 3.5 : 11 + Math.random() * 2;
            const lx = side * (sideXSafe(lz) + 0.05);
            const [px, pz] = loc(lx, lz);
            w.pos[i * 3] = px;
            w.pos[i * 3 + 1] = swellAt(px, pz, t, 1) + 0.12;
            w.pos[i * 3 + 2] = pz;
            // thrown outward and a little up; the stern's froth just trails
            w.vel[i * 3] = c * side * 1.4 + (Math.random() - 0.5) * 0.6;
            w.vel[i * 3 + 1] = fwd && lz < -9 ? 1.3 + Math.random() * 1.5 : 0.1;
            w.vel[i * 3 + 2] = -s * side * 1.4 + (Math.random() - 0.5) * 0.6;
            w.age[i] = 0;
            w.life[i] = 1.4 + Math.random() * 1.6;
        }
        const light = 0.2 + 0.4 * (1 - this._night * 0.65);
        for (let i = 0; i < w.n; i++) {
            if (w.age[i] >= w.life[i]) {
                w.col[i * 3] = w.col[i * 3 + 1] = w.col[i * 3 + 2] = 0;
                continue;
            }
            w.age[i] += dt;
            const k = w.age[i] / w.life[i];
            w.vel[i * 3 + 1] -= dt * 4.5 * (w.pos[i * 3 + 1] > 0.3 ? 1 : 0);
            w.pos[i * 3] += w.vel[i * 3] * dt;
            w.pos[i * 3 + 1] = Math.max(w.pos[i * 3 + 1] + w.vel[i * 3 + 1] * dt, swellAt(w.pos[i * 3], w.pos[i * 3 + 2], t, 1) + 0.05);
            w.pos[i * 3 + 2] += w.vel[i * 3 + 2] * dt;
            const f = (1 - k) * (1 - k) * light;
            w.col[i * 3] = f; w.col[i * 3 + 1] = f * 1.02; w.col[i * 3 + 2] = f * 1.05;
        }
        this.wakePts.geometry.attributes.position.needsUpdate = true;
        this.wakePts.geometry.attributes.color.needsUpdate = true;
    }

    // -------------------------------------------------------------- input

    _keys() {
        const set = (e, down) => {
            if (this.mode === 'docked') return;
            const k = e.key.toLowerCase();
            const inp = this.input;
            if ((k === 'c' || k === 'v') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (down && !e.repeat) this.toggleView();
                return;
            }
            if (this.mode === 'castoff') return;
            if (k === 'a' || k === 'arrowleft' || k === 'q') inp.left = down;
            else if (k === 'd' || k === 'arrowright' || k === 'e') inp.right = down;
            else if (k === 'w' || k === 'arrowup') inp.up = down;
            else if (k === 's' || k === 'arrowdown') inp.down = down;
            else return;
            if (k.startsWith('arrow')) e.preventDefault();
        };
        addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, textarea')) return;
            if (e.key === 'Escape' && !this.ui.blocking && (this.mode === 'sail' || this.mode === 'castoff')) this.requestReturn();
            else set(e, true);
        });
        addEventListener('keyup', (e) => set(e, false));
        addEventListener('blur', () => Object.assign(this.input, { left: false, right: false, up: false, down: false }));
    }

    _ui() {
        this.hud = $('helm-hud');
        if (!this.hud) return;
        this.speedEl = $('helm-speed');
        this.sailEl = $('helm-sail');
        const hold = (id, key) => {
            const b = $(id);
            if (!b) return;
            const on = (e) => {
                e.preventDefault();
                this.input[key] = true;
            };
            const off = () => (this.input[key] = false);
            b.addEventListener('pointerdown', on);
            for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, off);
        };
        hold('helm-left', 'left');
        hold('helm-right', 'right');
        hold('helm-up', 'up');
        hold('helm-down', 'down');
        $('helm-return')?.addEventListener('click', () => this.requestReturn());
        $('helm-view')?.addEventListener('click', () => this.toggleView());
    }

    _hud(dt) {
        if (!this.hud) return;
        const on = this.mode === 'sail' || this.mode === 'return' || this.mode === 'castoff';
        if (this.hud.hidden === on) this.hud.hidden = !on;
        if (!on) return;
        this.hud.classList.toggle('auto', this.mode !== 'sail');
        const knots = Math.round(Math.abs(this.speed) * 1.94);
        if (this.speedEl) this.speedEl.textContent = `${knots} kn`;
        if (this.sailEl) this.sailEl.style.setProperty('--sail', `${Math.round(this.sail * 100)}%`);
        void dt;
    }

    _sound(dt) {
        const a = this.audio;
        if (!a?.ctx || !a.shipLevel) return;
        // the wind and water follow her speed; only touch the audio graph when it has changed
        const lv = this.mode === 'docked' ? 0 : clamp(Math.abs(this.speed) / MAX_SPEED, 0, 1);
        this._lv ??= 0;
        if (Math.abs(lv - this._lv) > 0.03 || (lv === 0 && this._lv !== 0)) {
            this._lv = lv;
            a.shipLevel(lv);
        }
        this._creak = (this._creak ?? 3) - dt;
        if (this._creak < 0) {
            this._creak = 3 + Math.random() * 6;
            const near = this.mode !== 'docked' || Math.hypot(this.controls.pos.x - this.pos.x, this.controls.pos.z - this.pos.z) < 30;
            if (near) a.shipCreak?.(this.mode === 'docked' ? 0.5 : 0.9);
        }
    }
}

// the hull's half width near the waterline at z, for placing foam
function sideXSafe(lz) {
    const t = clamp((lz + 12.5) / 25, 0, 1);
    return 3.5 * (t < 0.5 ? 0.15 + 0.85 * Math.sin((t / 0.5) * Math.PI / 2) : 1 - 0.2 * smoothstep(0.5, 1, t));
}
