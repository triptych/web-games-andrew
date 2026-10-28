// Fishing off the pier. Click the rod in its holder on the rail (or press C
// at the end of the pier) and you cast a float out to sea. Wait for it to dip,
// strike (click, tap or Space), then reel: hold to lift the green band and
// keep the fish inside it until the line is in. A landed fish is held up for
// a moment with a card about it, then the rod goes back on the rail.

import * as THREE from 'three';
import { SPECIES, pickSpecies, rollCatch, makeFish } from './fish.js';
import { swellAt } from './boat.js';
import { samplePath, PAVILION_PLAZA } from './layout.js';
import { EYE } from './controls.js';
import { clamp, damp, lerp, smoothstep, angleDiff, store, esc } from './util.js';

const PITCH = -0.2;     // looking a little down at the float
const CAST_T = 1.15;    // the cast, from the back swing to the float landing
const SHOW_T = 9;       // how long a landed fish is held up before the rod goes back
const LINE_N = 24;
const STEP = 1 / 60;    // the reel's fixed time step
const TIP = 2.72;       // rod length, butt to tip

const $ = (id) => document.getElementById(id);
const touch = () => matchMedia('(pointer: coarse)').matches;

/** A rod one TIP long up +y from its butt, the reel and guides on its -z side. bends: two joints that curve the top half. */
function makeRod() {
    const g = new THREE.Group();
    g.name = 'fishing-rod';
    const cork = new THREE.MeshStandardMaterial({ color: 0xb48a5c, roughness: 0.9 });
    const blank = new THREE.MeshStandardMaterial({ color: 0x23352c, roughness: 0.35, metalness: 0.4 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.3, metalness: 1 });
    const add = (parent, geo, mat, y) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.y = y;
        m.castShadow = true;
        parent.add(m);
        return m;
    };
    add(g, new THREE.CylinderGeometry(0.021, 0.026, 0.44, 10), cork, 0.22);
    add(g, new THREE.CylinderGeometry(0.019, 0.02, 0.1, 10), metal, 0.49);
    const reel = add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.035, 14).rotateZ(Math.PI / 2), metal, 0.48);
    reel.position.z = -0.07;
    add(g, new THREE.BoxGeometry(0.012, 0.06, 0.02), metal, 0.48).position.z = -0.035;
    const knob = add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateZ(Math.PI / 2), cork, 0.5);
    knob.position.set(0.04, 0.5, -0.1);
    add(g, new THREE.CylinderGeometry(0.011, 0.017, 1.0, 8), blank, 1.04);
    const mid = new THREE.Group();
    mid.position.y = 1.54;
    g.add(mid);
    add(mid, new THREE.CylinderGeometry(0.008, 0.011, 0.6, 6), blank, 0.3);
    const top = new THREE.Group();
    top.position.y = 0.6;
    mid.add(top);
    add(top, new THREE.CylinderGeometry(0.004, 0.008, TIP - 2.14, 6), blank, (TIP - 2.14) / 2);
    for (const y of [0.85, 1.3]) add(g, new THREE.TorusGeometry(0.014, 0.003, 4, 10), metal, y).position.z = -0.018;
    add(mid, new THREE.TorusGeometry(0.01, 0.0028, 4, 8), metal, 0.3).position.z = -0.013;
    add(top, new THREE.TorusGeometry(0.008, 0.0025, 4, 8), metal, 0.2).position.z = -0.011;
    const tip = new THREE.Object3D();
    tip.position.y = TIP - 2.14;
    top.add(tip);
    // a generous invisible target, so it is easy to click from the deck
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, TIP, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = TIP / 2;
    g.add(hit);
    return { group: g, bends: [mid, top], tip, hit };
}

function makeFloat() {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xe0352a, emissive: 0xe0352a, emissiveIntensity: 0.35, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), red);
    stick.position.y = 0.16;
    g.add(top, bottom, stick);
    return g;
}

export class Fishing {
    // for the tests
    static SPECIES = SPECIES;
    static pickSpecies = pickSpecies;

    constructor({ world, scene, camera, controls, ui, audio, bursts, canvas }) {
        this.world = world;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.ui = ui;
        this.audio = audio;
        this.bursts = bursts;
        this.pier = world.pier;
        this.state = 'idle';
        this.t = 0;
        this.time = 0;
        this.holding = false;
        this.struck = false;
        this.view = { yaw: 0, pitch: PITCH };
        this.log = store.get('fishLog', {});
        this.arrivalHint = false;
        this.showFor = SHOW_T;

        const p = this.pier;
        this.eye = new THREE.Vector3(p.stand.x, p.y + EYE, p.stand.z);
        const rod = makeRod();
        this.rod = rod.group;
        this.rodTip = rod.tip;
        this.rodBends = rod.bends;
        this.rodHit = rod.hit;
        scene.add(this.rod);
        // the rod's place in its holder (the same transform as the tube in pier.js)
        const r = p.rest, rw = p.toW(r.lx, r.lz);
        this.restPos = new THREE.Vector3(rw.x, r.y - 0.05, rw.z);
        this.restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.tilt, Math.atan2(p.dx, p.dz), r.roll, 'YXZ'));
        this.float = makeFloat();
        scene.add(this.float);
        this.floatPos = new THREE.Vector3();
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
        this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.75 }));
        this.line.frustumCulled = false;
        scene.add(this.line);
        this.ripples = [];
        const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
        for (let i = 0; i < 6; i++) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), rippleMat.clone());
            m.visible = false;
            scene.add(m);
            this.ripples.push({ mesh: m, age: 1, life: 1, size: 1 });
        }
        this.light = new THREE.PointLight(0xfff1d8, 0, 5, 2);
        scene.add(this.light);
        this.fish = null;
        this._tmp = new THREE.Vector3();
        this._tmp2 = new THREE.Vector3();
        this._q = new THREE.Quaternion();
        this._e = new THREE.Euler();
        this._placeRod(0);
        this._bind(canvas);
    }

    get active() {
        return this.state !== 'idle';
    }

    /** Objects that start fishing when clicked. */
    get pickables() {
        return this.state === 'idle' ? [this.rodHit] : [];
    }

    /** On the pier, or on the trail down to it. */
    onPier(x, z) {
        const p = this.pier;
        const s0 = p.trail.pts[0];
        const ux = p.bx - s0.x, uz = p.bz - s0.z, l2 = ux * ux + uz * uz;
        const t = ((x - s0.x) * ux + (z - s0.z) * uz) / l2;
        if (t < 0 || t > 1.02) return false;
        return Math.abs((x - s0.x) * uz - (z - s0.z) * ux) / Math.sqrt(l2) < p.platHalf + 0.6;
    }

    /** Close enough to the end of the pier to pick up the rod. */
    near(x, z, r = 4.5) {
        return Math.hypot(x - this.pier.stand.x, z - this.pier.stand.z) < r;
    }

    /** A walk from wherever the player is to the fishing spot, round the pavilion and down the trail. */
    route() {
        const p = this.pier, c = this.controls, pos = c.pos;
        const end = { x: p.stand.x, z: p.stand.z };
        if (this.onPier(pos.x, pos.z)) return [end];
        const sp = p.spoke, pv = sp.pavilion;
        let pts = [];
        let from = pos;
        if (Math.hypot(pos.x - pv.x, pos.z - pv.z) > PAVILION_PLAZA + 1.5) {
            const e = samplePath(sp.pts, sp.length - PAVILION_PLAZA - 0.5);
            pts = c.plan(e.x, e.z);
            from = e;
        }
        // round the pavilion on its plaza, clear of the columns and the benches
        const R = 5.9;
        const a0 = Math.atan2(from.x - pv.x, from.z - pv.z), a1 = Math.atan2(p.dx, p.dz);
        const d = angleDiff(a0, a1);
        const n = Math.max(1, Math.ceil(Math.abs(d) / 0.35));
        for (let i = 0; i <= n; i++) {
            const a = a0 + (d * i) / n;
            pts.push({ x: pv.x + Math.sin(a) * R, z: pv.z + Math.cos(a) * R });
        }
        const tr = p.trail.pts;
        for (let i = 0; i < tr.length; i += 4) pts.push({ x: tr[i].x, z: tr[i].z });
        pts.push({ x: p.ax, z: p.az }, end);
        return pts;
    }

    // ------------------------------------------------------------ input

    _bind(canvas) {
        const down = (e) => {
            if (!this.active || this.ui.blocking) return;
            if (e.type === 'pointerdown' && e.button !== 0 && e.pointerType === 'mouse') return;
            this.holding = true;
            this._press();
        };
        const up = () => (this.holding = false);
        canvas.addEventListener('pointerdown', down);
        addEventListener('pointerup', up);
        addEventListener('pointercancel', up);
        addEventListener('blur', up);
        addEventListener('keydown', (e) => {
            if (!this.active || e.target.closest?.('input, textarea')) return;
            if (e.key === 'Escape') {
                if (!this.ui.blocking && !this.ui.cardGame) this.stop();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (e.repeat || this.ui.blocking) return;
                this.holding = true;
                this._press();
            }
        });
        addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.key === 'Enter') this.holding = false;
        });
        $('fish-quit').addEventListener('click', () => this.stop());
        $('fish-done').addEventListener('click', () => this.state === 'show' && this.reset());
    }

    /** A click, tap or Space: strike when the float dips, dismiss a landed fish. */
    _press() {
        if (this.state === 'bite') this.struck = true;
        else if (this.state === 'wait' && this.t > 0.6) this.ui.hint('Nothing yet · wait for the float to dip', 2500);
        else if (this.state === 'show' && this.t > 1.2) this.reset();
    }

    // ------------------------------------------------------------ flow

    /** Pick up the rod and cast. The player must already be at the end of the pier. */
    start() {
        if (this.active) return;
        const c = this.controls, p = this.pier;
        c.enabled = false;
        c.route = null;
        c.keys.clear();
        c.vel.set(0, 0);
        c.teleport(p.stand.x, p.stand.z, c.yaw);
        this.view.yaw = c.yaw;
        this.view.pitch = c.pitch;
        this.eye.set(p.stand.x, p.y + EYE, p.stand.z);
        this.camera.position.copy(this.eye);
        this.handK = 0;
        this.ui.closeAll();
        this.ui.tooltip(null);
        $('fishing-hud').hidden = false;
        this.audio.click();
        this._cast();
    }

    _cast() {
        const p = this.pier;
        const out = 7.5 + Math.random() * 3.5, side = (Math.random() - 0.5) * 3.5;
        this.target = new THREE.Vector3(p.stand.x + p.dx * out + p.rx * side, 0, p.stand.z + p.dz * out + p.rz * side);
        this.castFrom = null;
        this.state = 'cast';
        this.t = 0;
        this.audio.cast();
    }

    _wait(first) {
        this.state = 'wait';
        this.t = 0;
        this.waitFor = 2.5 + Math.random() * 5;
        this.nextNibble = 0.8 + Math.random() * 2;
        this.dip = 0;
        if (first) this.ui.hint(`Wait for the float to dip, then strike: ${touch() ? 'tap the screen' : 'click or press Space'}`, 6000);
    }

    _bite() {
        this.species = pickSpecies(this.world.sky?.state.night ?? 0);
        this.state = 'bite';
        this.t = 0;
        this.struck = false;
        this.window = lerp(1.2, 0.75, this.species.pull);
        $('fish-alert').hidden = false;
        this.audio.splash(0.25);
        this._ripple(this.floatPos, 1.4, 0.9);
    }

    _hook() {
        $('fish-alert').hidden = true;
        this.state = 'reel';
        this.t = 0;
        const sp = this.species;
        // all in 0..1 up the meter
        this.meter = {
            zone: 0.1, vel: 0,
            size: lerp(0.36, 0.26, sp.pull),
            fish: 0.3, fishV: 0, goal: 0.5, next: 0.6,
            progress: 0.35,
        };
        $('fish-meter').hidden = false;
        $('fm-zone').style.height = `${this.meter.size * 100}%`;
        this.castDist = Math.hypot(this.floatPos.x - this.pier.stand.x, this.floatPos.z - this.pier.stand.z);
        this.swim = { x: this.floatPos.x, z: this.floatPos.z, a: Math.random() * 6.28 };
        this.audio.splash(0.6);
        this._ripple(this.floatPos, 1.8, 1.0);
        this.ui.hint(`${touch() ? 'Hold your finger down' : 'Hold the mouse button or Space'} to lift the green band · keep the fish inside it`, 5000);
    }

    _lost(text) {
        $('fish-meter').hidden = true;
        $('fish-alert').hidden = true;
        this.ui.hint(text, 3500);
        this.floatPos.y = 0;
        this._wait(false);
    }

    _land() {
        $('fish-meter').hidden = true;
        const c = rollCatch(this.species);
        this.catch = c;
        const sp = c.species;
        const prev = this.log[sp.id];
        const isNew = !prev;
        this.log[sp.id] = { n: (prev?.n || 0) + 1, best: Math.max(prev?.best || 0, c.cm) };
        store.set('fishLog', this.log);
        this.fish = makeFish(sp, c.cm);
        this.fish.traverse((o) => (o.castShadow = true));
        this.scene.add(this.fish);
        this.fishFrom = this.floatPos.clone();
        this.state = 'show';
        this.t = 0;
        this.audio.splash(0.9);
        this._ripple(this.floatPos, 2.2, 1.2);
        this.audio.caught(isNew || sp.legend);
        this._card(c, isNew, prev);
    }

    _card(c, isNew, prev) {
        const sp = c.species;
        const card = $('fish-card');
        card.style.setProperty('--accent', sp.glow || sp.colors.back);
        $('fish-kicker').textContent = isNew ? 'New to your log' : 'You caught';
        $('fish-name').textContent = sp.name;
        $('fish-latin').textContent = sp.latin;
        $('fish-latin').classList.toggle('legend', !!sp.legend);
        const kg = c.kg < 1 ? `${Math.round(c.kg * 1000)} g` : `${c.kg.toFixed(2)} kg`;
        $('fish-stats').innerHTML = [
            `<span class="fc-rarity r-${sp.rarity.toLowerCase()}">${esc(sp.rarity)}</span>`,
            `<span>${c.cm} cm</span>`,
            `<span>${kg}</span>`,
            prev && c.cm > prev.best ? '<span class="fc-best">Your biggest yet</span>' : '',
        ].join('');
        $('fish-fact').textContent = sp.fact;
        $('fish-habitat').textContent = sp.habitat;
        const kinds = Object.keys(this.log).length;
        const n = this.log[sp.id].n;
        $('fish-log').textContent = `${n === 1 ? 'Your first' : `Number ${n}`} · ${kinds} of ${SPECIES.length} kinds caught`;
        card.hidden = false;
    }

    /** Let the fish go, put the rod back on the rail, and hand the walking back. */
    reset() {
        if (!this.active) return;
        if (this.fish) {
            if (this.state === 'show') {
                this.audio.splash(0.5);
                this._ripple(this.floatPos, 1.5, 1.0);
            }
            this.scene.remove(this.fish);
            this.fish.traverse((o) => {
                o.geometry?.dispose();
                if (o.material) {
                    o.material.map?.dispose();
                    o.material.dispose();
                }
            });
            this.fish = null;
        }
        const landed = this.state === 'show';
        this.state = 'idle';
        this.holding = false;
        this.light.intensity = 0;
        for (const id of ['fishing-hud', 'fish-card', 'fish-meter', 'fish-alert']) $(id).hidden = true;
        const c = this.controls;
        c.yaw = ((this.view.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        c.pitch = this.view.pitch;
        c.enabled = true;
        this._placeRod(this.time);
        if (landed) this.ui.hint(`The rod is back on the rail · ${touch() ? 'tap' : 'click'} it to cast again`, 5000);
    }

    /** Put the rod away whatever is happening (Esc, the button, or leaving by the map or library). */
    stop() {
        if (!this.active) return;
        const quiet = this.state !== 'show';
        this.reset();
        if (quiet) this.audio.click();
    }

    // ------------------------------------------------------------ per frame

    _ripple(at, size, life) {
        const r = this.ripples.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
        r.mesh.position.set(at.x, 0.02, at.z);
        r.age = 0;
        r.life = life;
        r.size = size;
        r.mesh.visible = true;
    }

    _surface(x, z, t) {
        const d = this.world.island.heightAt(x, z);
        const amp = lerp(0.25, 1, smoothstep(0, 0.3, clamp(-d / 12, 0, 1)));
        return swellAt(x, z, t, amp);
    }

    /** The rod in its holder, with the float hanging from the tip. */
    _placeRod(t) {
        this.rod.position.copy(this.restPos);
        this.rod.quaternion.copy(this.restQ);
        for (const b of this.rodBends) b.rotation.x = 0;
        this.float.visible = true;
        this.rod.updateMatrixWorld(true);
        const tip = this.rodTip.getWorldPosition(this._tmp);
        this.floatPos.set(tip.x + Math.sin(t * 1.3) * 0.02, tip.y - 0.45, tip.z + Math.cos(t * 1.1) * 0.02);
        this.float.position.copy(this.floatPos);
        this.float.rotation.set(0, 0, 0);
        this._line(tip, this.floatPos.clone().setY(this.floatPos.y + 0.27), 0);
    }

    /** The rod in your hands: held out over the rail, `swing` tipping it back for a cast. */
    _holdRod(swing, bend, k) {
        const cam = this.camera;
        // nearer the middle on a narrow portrait screen, so the rod stays in view
        const side = lerp(0.1, 0.34, clamp((cam.aspect - 0.5) / 0.8, 0, 1));
        const hand = this._tmp2.set(side, -0.5, -0.5).applyQuaternion(cam.quaternion).add(cam.position);
        this._e.set(-1.0 + swing, -0.06, -0.2, 'XYZ');
        this._q.setFromEuler(this._e).premultiply(cam.quaternion);
        // ease out of the holder and into the hands
        this.rod.position.copy(this.restPos).lerp(hand, k);
        this.rod.quaternion.copy(this.restQ).slerp(this._q, k);
        this.rodBends[0].rotation.x = -bend * 0.4;
        this.rodBends[1].rotation.x = -bend * 0.6;
        this.rod.updateMatrixWorld(true);
    }

    /** The line from the rod tip to `to`, sagging by `sag`. */
    _line(tip, to, sag) {
        const a = this.line.geometry.attributes.position;
        for (let i = 0; i < LINE_N; i++) {
            const u = i / (LINE_N - 1);
            const x = lerp(tip.x, to.x, u), z = lerp(tip.z, to.z, u);
            const y = lerp(tip.y, to.y, u) - sag * 4 * u * (1 - u);
            a.setXYZ(i, x, y, z);
        }
        a.needsUpdate = true;
    }

    /** One step of the fight on the line: returns whether the fish is inside the band. */
    _reelStep(dt) {
        const m = this.meter, sp = this.species;
        // the band: lifted while you hold, sinking when you let go, bouncing off the ends
        m.vel = clamp(m.vel + (this.holding ? 1.8 : -1.6) * dt, -0.9, 0.9);
        m.zone += m.vel * dt;
        if (m.zone < 0) { m.zone = 0; m.vel *= -0.3; }
        if (m.zone > 1 - m.size) { m.zone = 1 - m.size; m.vel *= -0.3; }
        // the fish darts between spots, more often and faster the harder it pulls
        m.next -= dt;
        if (m.next <= 0) {
            m.goal = Math.random();
            m.next = lerp(1.8, 0.8, sp.pull) * (0.6 + Math.random() * 0.8);
        }
        m.fishV = damp(m.fishV, (m.goal - m.fish) * lerp(1.3, 2.8, sp.pull), 4, dt);
        m.fish = clamp(m.fish + m.fishV * dt, 0, 1);
        const inside = m.fish >= m.zone - 0.02 && m.fish <= m.zone + m.size + 0.02;
        m.progress += (inside ? 0.18 : -lerp(0.09, 0.16, sp.pull)) * dt;
        return inside;
    }

    /**
     * @param free  the player is walking about the garden (not in the boat, a room or a menu)
     */
    update(dt, t, free) {
        this.time = t;
        for (const r of this.ripples) {
            if (!r.mesh.visible) continue;
            r.age += dt;
            const k = r.age / r.life;
            if (k >= 1) {
                r.mesh.visible = false;
                continue;
            }
            r.mesh.scale.setScalar(lerp(0.15, r.size, Math.sqrt(k)));
            r.mesh.material.opacity = (1 - k) * 0.55;
        }
        if (this.state === 'idle') {
            this._placeRod(t);
            const pos = this.controls.pos;
            if (free && !this.arrivalHint && this.near(pos.x, pos.z, 6)) {
                this.arrivalHint = true;
                this.ui.hint(`A rod rests on the rail at the end of the pier · ${touch() ? 'tap it' : 'click it, or press C,'} to put out a line and fish`, 8000);
            } else if (this.arrivalHint && !this.near(pos.x, pos.z, 26)) this.arrivalHint = false;
            return;
        }
        const paused = this.ui.blocking;
        if (!paused) this.t += dt;
        const p = this.pier;
        // the camera: settle to face out to sea, breathing a little
        this.view.yaw += angleDiff(this.view.yaw, p.stand.yaw) * (1 - Math.exp(-dt * 3));
        this.view.pitch = damp(this.view.pitch, this.state === 'show' ? -0.04 : PITCH, 3, dt);
        const cam = this.camera;
        cam.position.set(this.eye.x, this.eye.y + Math.sin(t * 0.8) * 0.01, this.eye.z);
        cam.rotation.set(this.view.pitch + Math.sin(t * 0.6) * 0.006, this.view.yaw + Math.sin(t * 0.37) * 0.008, 0, 'YXZ');
        cam.updateMatrixWorld();
        this.handK = Math.min(1, this.handK + dt * 2.2);
        const hk = smoothstep(0, 1, this.handK);

        const fp = this.floatPos;
        const surf = (x, z) => this._surface(x, z, t);
        if (this.state === 'cast') {
            const k = clamp(this.t / CAST_T, 0, 1);
            // back over the shoulder, then a flick forward
            const swing = k < 0.35 ? smoothstep(0, 0.35, k) * 0.9 : 0.9 * (1 - smoothstep(0.35, 0.55, k)) - 0.15 * Math.sin(Math.PI * smoothstep(0.35, 1, k));
            this._holdRod(swing, 0.1, hk);
            const tip = this.rodTip.getWorldPosition(this._tmp);
            if (k < 0.45) {
                fp.set(tip.x, tip.y - 0.45, tip.z);
            } else {
                this.castFrom ??= tip.clone();
                const u = smoothstep(0.45, 1, k);
                const y0 = surf(this.target.x, this.target.z);
                fp.lerpVectors(this.castFrom, this.target, u);
                fp.y = lerp(this.castFrom.y, y0, u) + Math.sin(Math.PI * u) * 3.2;
            }
            this.float.position.copy(fp);
            this._line(tip, fp, k < 0.45 ? 0 : 0.6 * smoothstep(0.45, 1, k));
            if (k >= 1) {
                this.audio.splash(0.3);
                this._ripple(fp, 1.1, 1.1);
                this._wait(true);
            }
            return;
        }
        if (this.state === 'wait' || this.state === 'bite') {
            this._holdRod(0, this.state === 'bite' ? 0.35 : 0.05, hk);
            const tip = this.rodTip.getWorldPosition(this._tmp);
            const y0 = surf(fp.x, fp.z);
            if (this.state === 'wait' && !paused) {
                if (this.t > this.nextNibble) {
                    // a fish mouthing the bait: a little dip and a ring
                    this.dip = 0.12;
                    this.nextNibble = this.t + 0.9 + Math.random() * 2.2;
                    this._ripple(fp, 0.5, 0.7);
                }
                if (this.t > this.waitFor) this._bite();
            }
            this.dip = damp(this.dip, 0, 6, dt);
            const under = this.state === 'bite' ? 0.28 + Math.sin(this.t * 30) * 0.05 : this.dip;
            fp.y = damp(fp.y, y0 - under, this.state === 'bite' ? 18 : 10, dt);
            this.float.position.copy(fp);
            this.float.rotation.set(Math.sin(t * 1.7) * 0.15, 0, Math.cos(t * 1.3) * 0.15);
            this._line(tip, fp.clone().setY(fp.y + 0.27), 0.35);
            if (this.state === 'bite') {
                if (this.struck) this._hook();
                else if (this.t > this.window) {
                    $('fish-alert').hidden = true;
                    this._lost('Too slow · it took the bait and swam off. The float is back up.');
                }
            }
            return;
        }
        if (this.state === 'reel') {
            const m = this.meter, sp = this.species;
            if (!paused) {
                // in small fixed steps, so a slow frame plays the same as a fast one
                let inside = false;
                for (let left = dt; left > 1e-6; left -= STEP) inside = this._reelStep(Math.min(left, STEP));
                if (this.holding) {
                    this.tick = (this.tick || 0) - dt;
                    if (this.tick <= 0) {
                        this.audio.reel();
                        this.tick = 0.09;
                    }
                }
                $('fm-zone').style.bottom = `${m.zone * 100}%`;
                $('fm-zone').classList.toggle('on', inside);
                $('fm-fish').style.bottom = `calc(${m.fish.toFixed(4)} * (100% - 28px))`;
                $('fm-fill').style.height = `${clamp(m.progress, 0, 1) * 100}%`;
            }
            // the fish under water, swimming about and drawn in as the line comes in
            const w = this.swim;
            w.a += dt * (1 + sp.pull * 2) * (m.fishV > 0 ? 1 : -1);
            const dist = lerp(this.castDist, 2.2, clamp(m.progress, 0, 1));
            const sx = p.stand.x + p.dx * dist + p.rx * Math.sin(w.a) * 1.6, sz = p.stand.z + p.dz * dist + p.rz * Math.sin(w.a) * 1.6;
            fp.set(damp(fp.x, sx, 3, dt), damp(fp.y, surf(sx, sz) - 0.35, 4, dt), damp(fp.z, sz, 3, dt));
            this.float.position.copy(fp);
            if (Math.random() < dt * 3) this._ripple(fp, 0.7, 0.6);
            this._holdRod(0.12 + Math.abs(m.fishV) * 0.05, 0.35 + Math.abs(m.fishV) * 0.15 + (this.holding ? 0.12 : 0), hk);
            const tip = this.rodTip.getWorldPosition(this._tmp);
            this._line(tip, fp, 0.02);
            if (m.progress >= 1) this._land();
            else if (m.progress <= 0) this._lost('The line went slack · it got away. The float is back up.');
            return;
        }
        if (this.state === 'show') {
            // the fish comes up out of the water and hangs in front of you, flapping
            this._holdRod(-0.15, 0.5, hk);
            const k = smoothstep(0, 1.1, this.t);
            const size = this.catch.cm / 100;
            const D = 0.75 + size * 0.95;
            const show = this._tmp2.set(-0.05, 0.12 * D, -D).applyQuaternion(cam.quaternion).add(cam.position);
            const f = this.fish;
            f.position.lerpVectors(this.fishFrom, show, k);
            f.position.y += Math.sin(Math.PI * k) * 0.8;
            const wiggle = Math.max(0.15, 1 - this.t / 3);
            this._e.set(Math.sin(t * 2.1) * 0.08, Math.sin(t * 1.2) * 0.55, 0.35 + Math.sin(t * 9) * 0.1 * wiggle, 'XYZ');
            f.quaternion.copy(cam.quaternion).multiply(this._q.setFromEuler(this._e));
            f.userData.tail.rotation.y = Math.sin(t * 16) * 0.55 * wiggle;
            // the line runs to its mouth
            const mouth = this._tmp.set(0.5, 0, 0).applyQuaternion(f.quaternion).multiplyScalar(size).add(f.position);
            const tip = this.rodTip.getWorldPosition(new THREE.Vector3());
            this._line(tip, mouth, 0.02);
            this.float.visible = false;
            this.light.position.copy(cam.position).add(this._tmp.set(0.4, 0.6, 0.3).applyQuaternion(cam.quaternion));
            this.light.intensity = damp(this.light.intensity, 3, 3, dt);
            if (k >= 1 && !this.sparkled) {
                this.sparkled = true;
                if (this.catch.species.legend || this.log[this.catch.species.id].n === 1) {
                    for (let i = 0; i < 24; i++) this.bursts.emit(f.position.x, f.position.y, f.position.z, { vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, color: this.catch.species.glow || '#fff2c4', size: 0.08, life: 1.6 });
                }
            }
            if (k < 1) this.sparkled = false;
            $('fish-timer').style.width = `${(1 - clamp(this.t / this.showFor, 0, 1)) * 100}%`;
            if (this.t > this.showFor) this.reset();
        }
    }
}
