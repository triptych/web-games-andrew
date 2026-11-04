// Plush Pier, the Lighthouse Arcade's claw machine. A glass case full of plush,
// one toy for each of some of the garden's games (see arcade-toys.js), a gantry
// with a three-pronged claw, and a chute in the front corner. Click the machine
// to step up to it: steer the claw with WASD, the arrow keys or the pad, drop it
// with Space or the button, and if it holds on all the way back to the chute the
// toy drops out of the prize door and goes on your shelf. Won toys are kept in
// the log, and the machine is topped up with one you haven't won yet.

import * as THREE from 'three';
import { makeToy, tagAtlas } from './arcade-toys.js';
import { neonTexture } from './arcade-screens.js';
import { GENRES } from './genres.js';
import { store, esc, clamp, lerp, damp, hashString, TAU } from './util.js';

// the machine, in metres (local: the front faces +z)
const W = 1.22, D = 1.0, BASE_H = 0.82, CASE_TOP = 2.0;
const FLOOR = BASE_H + 0.02;                     // the floor the toys lie on
const IX = 0.53, IZ = 0.42;                      // half-size of the play area inside the glass
const CHUTE = { x0: -IX, x1: -0.25, z0: 0.14, z1: IZ, cx: -0.39, cz: 0.28 };
const RAIL_Y = 1.93;
const HUB_UP = 1.8;
const SPEED = 0.34;
const TURN = 25;                                 // seconds to line up a drop
const CLAW_S = 1.45;                             // the claw is drawn a size up, to read well from the glass

const PRAISE = [
    (t) => `Stuffed with stardust and stitched with care, this one came all the way from ${t}.`,
    (t) => `Small enough to carry, soft enough to hug, and very proud to be from ${t}.`,
    (t) => `It has played ${t} more times than you have. Ask it for tips.`,
    (t) => `Squeeze it and you might hear the music from ${t}. Or not. It is a plush.`,
    (t) => `A limited run from ${t}, hand-sewn by the lighthouse keeper on stormy nights.`,
    (t) => `Ready for adventure, naps, and sitting on a shelf looking like ${t}.`,
];

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

/** The kick panel: candy stripes, stars and the promise. */
function panelCanvas() {
    const c = canvas(512, 512);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#ff6ac0');
    g.addColorStop(1, '#a02a80');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    x.globalAlpha = 0.18;
    x.fillStyle = '#ffffff';
    for (let i = -512; i < 512; i += 64) {
        x.beginPath();
        x.moveTo(i, 512);
        x.lineTo(i + 32, 512);
        x.lineTo(i + 544, 0);
        x.lineTo(i + 512, 0);
        x.fill();
    }
    x.globalAlpha = 1;
    x.fillStyle = '#fff6a0';
    x.textAlign = 'center';
    x.font = '700 64px "Press Start 2P", monospace';
    x.shadowColor = '#300020';
    x.shadowBlur = 0;
    x.shadowOffsetY = 6;
    x.fillText('WIN', 300, 150);
    x.font = '700 40px "Press Start 2P", monospace';
    x.fillText('A TOY', 300, 220);
    x.font = '700 22px "Press Start 2P", monospace';
    x.fillStyle = '#ffffff';
    x.fillText('FREE PLAY', 300, 300);
    x.shadowOffsetY = 0;
    for (let k = 0; k < 9; k++) {
        x.fillStyle = ['#ffe94a', '#5fe8ff', '#ffffff'][k % 3];
        const sx = 60 + ((k * 197) % 420), sy = 360 + ((k * 89) % 120);
        x.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 7 : 16;
            x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
        }
        x.fill();
    }
    return c;
}

export class ClawMachine {
    /** @param {object} env { plan, scene, audio, camera, games, showCard, hint } */
    constructor(env) {
        this.env = env;
        this.spot = env.plan.claw;
        this.camera = env.camera;
        this.games = env.games;
        this.won = new Set(store.get('clawWon', []));
        this.state = 'idle';
        this.active = false;
        this.t = 0;
        this.time = 0;
        this.misses = 0;
        this.claw = { x: CHUTE.cx, z: CHUTE.cz, y: HUB_UP, open: 0.2 };
        this.held = null;
        this.toys = [];
        this.falling = [];
        this.group = new THREE.Group();
        this.group.position.set(this.spot.x, 0, this.spot.z);
        this.group.rotation.y = this.spot.rot;
        env.scene.add(this.group);
        this.group.updateMatrixWorld(true);
        this.atlas = tagAtlas(this.games);
        this._cabinet();
        this._gantry();
        this._fill();
        this._dom();
    }

    // ------------------------------------------------------------ building

    _cabinet() {
        const g = this.group;
        const pink = new THREE.MeshStandardMaterial({ color: 0xff5fb0, roughness: 0.3, metalness: 0.1 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8f4, roughness: 0.15, metalness: 1 });
        this.chrome = chrome;
        const box = (w, h, d, x, y, z, m) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(x, y, z);
            g.add(mesh);
            return mesh;
        };
        // the base, its painted front, and the prize door with its flap
        box(W, BASE_H, D, 0, BASE_H / 2, 0, pink);
        const pt = new THREE.CanvasTexture(panelCanvas());
        pt.colorSpace = THREE.SRGBColorSpace;
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.5, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.2 }));
        panel.position.set(0.2, 0.42, D / 2 + 0.002);
        g.add(panel);
        box(0.36, 0.34, 0.03, CHUTE.cx, 0.3, D / 2 - 0.005, new THREE.MeshStandardMaterial({ color: 0x14081a, roughness: 0.8 }));
        for (const [w, h, x, y] of [[0.4, 0.03, CHUTE.cx, 0.485], [0.4, 0.03, CHUTE.cx, 0.115], [0.03, 0.4, CHUTE.cx - 0.19, 0.3], [0.03, 0.4, CHUTE.cx + 0.19, 0.3]]) box(w, h, 0.04, x, y, D / 2 + 0.005, chrome);
        // the prize bin behind a clear flap: a won toy waits here
        this.flap = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.32), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }));
        this.flap.geometry.translate(0, -0.16, 0);
        this.flap.position.set(CHUTE.cx, 0.46, D / 2 + 0.03);
        this.flap.renderOrder = 2;
        g.add(this.flap);
        const binLight = new THREE.PointLight(0xffd0f0, 0, 0.8, 2);
        binLight.position.set(CHUTE.cx, 0.35, D / 2 - 0.1);
        g.add(binLight);
        this.binLight = binLight;
        // the joystick and the drop button on a little ledge
        box(0.5, 0.04, 0.16, 0.2, BASE_H - 0.02, D / 2 + 0.06, pink);
        const stick = new THREE.Group();
        stick.position.set(0.08, BASE_H, D / 2 + 0.07);
        g.add(stick);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), chrome);
        shaft.position.y = 0.045;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe94a, roughness: 0.3 }));
        knob.position.y = 0.095;
        stick.add(shaft, knob);
        this.stick = stick;
        this.dropBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0x30d0ff, emissive: 0x30d0ff, emissiveIntensity: 0.5, roughness: 0.3 }));
        this.dropBtn.position.set(0.32, BASE_H + 0.015, D / 2 + 0.07);
        g.add(this.dropBtn);
        // the glass case: chrome posts, glass on four sides, a mirror at the back
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, CASE_TOP - BASE_H, 0.04, sx * (W / 2 - 0.02), (BASE_H + CASE_TOP) / 2, sz * (D / 2 - 0.02), chrome);
        // soft glass: a sharp clearcoat caught the case light as a glare
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.25, clearcoat: 0.15, clearcoatRoughness: 0.5, depthWrite: false });
        const h = CASE_TOP - BASE_H;
        for (const [w, x, z, ry] of [[W - 0.04, 0, D / 2 - 0.02, 0], [D - 0.04, -W / 2 + 0.02, 0, Math.PI / 2], [D - 0.04, W / 2 - 0.02, 0, -Math.PI / 2]]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h - 0.02), glass);
            m.position.set(x, (BASE_H + CASE_TOP) / 2, z);
            m.rotation.y = ry;
            m.renderOrder = 2;
            g.add(m);
        }
        const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, h), new THREE.MeshStandardMaterial({ color: 0x3a1a5a, roughness: 0.85, metalness: 0.05, emissive: 0x2a0a40, emissiveIntensity: 0.35 }));
        back.position.set(0, (BASE_H + CASE_TOP) / 2, -D / 2 + 0.02);
        g.add(back);
        // the floor of the case, and the chute's clear walls
        box(W - 0.06, 0.02, D - 0.06, 0, BASE_H + 0.01, 0, new THREE.MeshStandardMaterial({ color: 0x5a2a7a, roughness: 0.9 }));
        const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });
        const cw = CHUTE.x1 - CHUTE.x0, cd = CHUTE.z1 - CHUTE.z0;
        for (const [w, x, z, ry] of [[cd, CHUTE.x1, (CHUTE.z0 + CHUTE.z1) / 2, Math.PI / 2], [cw, (CHUTE.x0 + CHUTE.x1) / 2, CHUTE.z0, 0]]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), acrylic);
            m.position.set(x, FLOOR + 0.09, z);
            m.rotation.y = ry;
            m.renderOrder = 3;
            g.add(m);
        }
        box(cw, 0.022, cd, (CHUTE.x0 + CHUTE.x1) / 2, BASE_H + 0.012, (CHUTE.z0 + CHUTE.z1) / 2, new THREE.MeshBasicMaterial({ color: 0x050208 }));
        // the top: a lit header, the sign and a row of chasing bulbs
        box(W + 0.02, 0.06, D + 0.02, 0, CASE_TOP + 0.03, 0, chrome);
        box(W, 0.36, D * 0.6, 0, CASE_TOP + 0.24, 0.2 - D * 0.2, pink);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, (W - 0.06) / 4), new THREE.MeshBasicMaterial({ map: neonTexture('PLUSH PIER', '#5fe8ff', { sub: 'A TOY FROM EVERY GAME', subColor: '#ffe94a' }), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
        sign.position.set(0, CASE_TOP + 0.24, D / 2 + 0.005);
        g.add(sign);
        const bulbs = [];
        for (let k = 0; k < 12; k++) bulbs.push([-W / 2 + 0.05 + (k / 11) * (W - 0.1), CASE_TOP + 0.425]);
        for (let k = 0; k < 12; k++) bulbs.push([-W / 2 + 0.05 + (k / 11) * (W - 0.1), CASE_TOP + 0.075]);
        this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length);
        const m = new THREE.Matrix4();
        bulbs.forEach(([x, y], i) => {
            this.bulbs.setMatrixAt(i, m.makeTranslation(x, y, D / 2 + 0.02));
            this.bulbs.setColorAt(i, new THREE.Color(0xffffff));
        });
        g.add(this.bulbs);
        // light inside the case
        const l = new THREE.PointLight(0xfff0ff, 1.1, 1.8, 1.6);
        l.position.set(0, CASE_TOP - 0.35, -0.2);
        g.add(l);
        // a box over the whole machine, for the pointer
        const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, CASE_TOP + 0.5, D + 0.2), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.y = (CASE_TOP + 0.5) / 2;
        hit.userData.kind = 'claw';
        g.add(hit);
        this.pickables = [hit];
    }

    _gantry() {
        const g = this.group, chrome = this.chrome;
        for (const sz of [-1, 1]) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.025, 0.025), chrome);
            r.position.set(0, RAIL_Y, sz * IZ);
            g.add(r);
        }
        this.bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, IZ * 2), chrome);
        g.add(this.bridge);
        this.carriage = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.09), new THREE.MeshStandardMaterial({ color: 0x30d0ff, roughness: 0.3, metalness: 0.4 }));
        g.add(this.carriage);
        this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.6 }));
        g.add(this.cable);
        // the claw: a hub and three hooked prongs on pivots
        const hub = new THREE.Group();
        hub.scale.setScalar(CLAW_S);
        g.add(hub);
        this.hub = hub;
        // gold, so it stands out against the pastel plush
        const gold = new THREE.MeshStandardMaterial({ color: 0xffd36a, roughness: 0.25, metalness: 1, emissive: 0x402a00, emissiveIntensity: 0.6 });
        hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.05, 16), gold));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 8, 0, TAU, 0, Math.PI / 2), gold);
        dome.position.y = 0.025;
        hub.add(dome);
        this.prongs = [];
        for (let i = 0; i < 3; i++) {
            const arm = new THREE.Group();
            arm.rotation.y = (i / 3) * TAU;
            hub.add(arm);
            const pivot = new THREE.Group();
            pivot.position.set(0, -0.02, 0.028);
            arm.add(pivot);
            const a = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.075, 0.008), gold);
            a.position.set(0, -0.037, 0.0);
            pivot.add(a);
            const tipG = new THREE.Group();
            tipG.position.set(0, -0.074, 0);
            tipG.rotation.x = 0.75;
            pivot.add(tipG);
            const tip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 0.008), gold);
            tip.position.set(0, -0.02, 0);
            tipG.add(tip);
            this.prongs.push(pivot);
        }
        // a soft spot of light under the claw, to judge the drop by
        const c = canvas(64, 64);
        const x = c.getContext('2d');
        const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.25)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr;
        x.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        this.spotMark = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, color: 0x7ff6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        this.spotMark.renderOrder = 4;
        g.add(this.spotMark);
        this._placeClaw();
    }

    // ------------------------------------------------------------ the toys

    /** The resting places in the case, in two layers, clear of the chute. */
    _slots() {
        const s = [];
        for (const x of [-0.43, -0.215, 0, 0.215, 0.43]) for (const z of [-0.33, -0.11, 0.11, 0.33]) if (!(x < -0.2 && z > 0.05)) s.push({ x, z, layer: 0 });
        for (const x of [-0.32, -0.11, 0.11, 0.32]) for (const z of [-0.22, 0, 0.22]) if (!(x < -0.15 && z > -0.05)) s.push({ x, z, layer: 1 });
        return s;
    }

    _pickGame(avoid) {
        const pool = this.games.filter((g) => !avoid.has(g.id));
        const fresh = pool.filter((g) => !this.won.has(g.id));
        const from = fresh.length && Math.random() < 0.8 ? fresh : pool.length ? pool : this.games;
        return from[Math.floor(Math.random() * from.length)];
    }

    _fill() {
        this.slots = this._slots();
        const used = new Set();
        for (const slot of this.slots) {
            const game = this._pickGame(used);
            used.add(game.id);
            this._place(this._toy(game), slot, false);
        }
    }

    _toy(game) {
        const i = this.games.indexOf(game);
        const toy = makeToy(game, i < 0 ? 0 : i, this.atlas);
        toy.scale.setScalar(0.92 + (hashString(game.id) % 100) / 100 * 0.16);
        this.group.add(toy);
        return toy;
    }

    _place(toy, slot, drop) {
        const u = toy.userData;
        u.slot = slot;
        slot.toy = toy;
        const x = slot.x + (Math.random() - 0.5) * 0.04, z = slot.z + (Math.random() - 0.5) * 0.04;
        u.rest = FLOOR + (slot.layer ? 0.085 : 0);
        toy.position.set(x, drop ? CASE_TOP - 0.25 : u.rest, z);
        toy.rotation.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.3);
        u.vy = 0;
        if (drop) this.falling.push(toy);
        if (!this.toys.includes(toy)) this.toys.push(toy);
    }

    /** The highest top of any toy under (x, z) within `r`, or the floor. */
    _topAt(x, z, r = 0.08, skip = null) {
        let top = FLOOR;
        for (const t of this.toys) {
            if (t === skip || t === this.held) continue;
            if (Math.hypot(t.position.x - x, t.position.z - z) < r + t.userData.r * 0.4) top = Math.max(top, t.position.y + t.userData.h * t.scale.y * 0.9);
        }
        return top;
    }

    // ------------------------------------------------------------ playing

    _dom() {
        const $ = (id) => document.getElementById(id);
        this.hud = $('claw-hud');
        this.timeEl = $('claw-time');
        this.sayEl = $('claw-say');
        this.cardEl = $('claw-card');
        this.holds = { left: false, right: false, up: false, down: false };
        this.keys = new Set();
        if (!this.hud) return;
        this.hud.querySelectorAll('[data-claw]').forEach((el) => {
            const key = el.dataset.claw;
            // keep the finger on the button for as long as it is down, and don't let a long
            // press open the phone's context menu (which cancels the pointer and lets go)
            const on = (e) => {
                e.preventDefault();
                el.setPointerCapture?.(e.pointerId);
                this.holds[key] = true;
            };
            const off = () => (this.holds[key] = false);
            el.addEventListener('pointerdown', on);
            for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, off);
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        });
        $('claw-go')?.addEventListener('click', () => this.drop());
        $('claw-quit')?.addEventListener('click', () => this.onQuit?.());
        $('claw-again')?.addEventListener('click', () => this._collect());
        $('claw-see')?.addEventListener('click', () => {
            const g = this.prize?.userData.game;
            this._collect();
            this.onQuit?.();
            if (g) this.env.showCard?.(g);
        });
        addEventListener('keydown', (e) => {
            if (!this.active || e.target.closest?.('input, textarea')) return;
            const k = e.key.toLowerCase();
            if (k === 'escape') {
                if (this.cardOpen) return this._collect();
                return this.onQuit?.();
            }
            if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
                e.preventDefault();
                this.keys.add(k);
            }
            if ((k === ' ' || k === 'enter') && !e.repeat) {
                if (e.target.closest?.('button')) return;
                e.preventDefault();
                if (this.cardOpen) this._collect();
                else this.drop();
            }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        addEventListener('blur', () => this.keys.clear());
    }

    get cardOpen() {
        return !!this.cardEl && !this.cardEl.hidden;
    }

    /** Step up to the machine. */
    start(controls) {
        if (this.active) return;
        this.active = true;
        this.controls = controls;
        this.camPos = this.camera.position.clone();
        this.camLook = this.toWorld(0, 1.2, 0);
        if (this.hud) this.hud.hidden = false;
        this.env.audio?.coin();
        this._turn();
    }

    stop() {
        if (!this.active) return;
        this.active = false;
        this.keys.clear();
        for (const k in this.holds) this.holds[k] = false;
        if (this.hud) this.hud.hidden = true;
        if (this.cardOpen) this._collect(true);
        // whatever the claw holds goes back in the pile
        if (this.held) this._letGo();
        if (this.state !== 'idle') this.state = 'home';
        this.env.audio?.gantry(0);
    }

    _turn() {
        this.state = 'play';
        this.left = TURN;
        this._say('');
    }

    /** Drop the claw where it is. */
    drop() {
        if (!this.active || this.state !== 'play') return;
        this.state = 'drop';
        this.slipped = false;
        this.claw.open = 1;
        // the claw stops on the first plush in its way, or the floor
        this.dropTo = Math.max(this._topAt(this.claw.x, this.claw.z) + 0.085 * CLAW_S, FLOOR + 0.1 * CLAW_S);
        this.env.audio?.claw('drop');
        this.env.audio?.gantry(0);
        this._say('');
    }

    _grab() {
        const c = this.claw;
        let best = null, bd = Infinity;
        for (const t of this.toys) {
            if (this.falling.includes(t)) continue;
            const d = Math.hypot(t.position.x - c.x, t.position.z - c.z);
            const top = t.position.y + t.userData.h * t.scale.y;
            if (d < 0.14 && top > c.y - 0.15 * CLAW_S && d < bd) (bd = d), (best = t);
        }
        if (!best) return null;
        let p = bd < 0.04 ? 0.85 : bd < 0.075 ? 0.6 : bd < 0.11 ? 0.3 : 0.12;
        // a toy with another on top of it is hard to pull free
        const pinned = this.toys.some((o) => o !== best && o.position.y > best.position.y + 0.04 && Math.hypot(o.position.x - best.position.x, o.position.z - best.position.z) < 0.13);
        if (pinned) p *= 0.5;
        // the machine is kind to those who keep trying
        if (this.misses >= 4) p = Math.max(p, 0.9);
        if (Math.random() > p) return null;
        return { toy: best, grip: bd < 0.075 && !pinned ? 0.9 : 0.6 };
    }

    _letGo() {
        const t = this.held;
        this.held = null;
        if (!t) return;
        t.userData.vy = 0;
        this.falling.push(t);
    }

    /** Where a falling toy at (x, z) comes to rest; null if it went down the chute. */
    _landing(t) {
        const p = t.position;
        if (p.x < CHUTE.x1 - 0.02 && p.z > CHUTE.z0 + 0.02) return null;
        p.x = clamp(p.x, -IX + 0.06, IX - 0.06);
        p.z = clamp(p.z, -IZ + 0.06, IZ - 0.06);
        if (p.x < CHUTE.x1 + 0.06 && p.z > CHUTE.z0 - 0.06) {
            // on the chute's rim: nudge it back into the case
            p.x = Math.max(p.x, CHUTE.x1 + 0.07);
        }
        const under = this.toys.some((o) => o !== t && !this.falling.includes(o) && o !== this.held && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 0.12);
        return FLOOR + (under ? 0.085 : 0);
    }

    _win(t) {
        // out of the case, into the prize bin
        const i = this.toys.indexOf(t);
        if (i >= 0) this.toys.splice(i, 1);
        if (t.userData.slot) t.userData.slot.toy = null;
        this.prize = t;
        this.misses = 0;
        t.position.set(CHUTE.cx, 0.2, D / 2 - 0.12);
        t.rotation.set(0, 0, 0);
        this.state = 'won';
        this.t = 0;
        const game = t.userData.game;
        const isNew = !this.won.has(game.id);
        this.won.add(game.id);
        store.set('clawWon', [...this.won]);
        this.env.audio?.claw('win');
        this._say('YOU WIN!', 'win');
        setTimeout(() => this.active && this.state === 'won' && this._card(t, isNew), 900);
    }

    _card(t, isNew) {
        if (!this.cardEl) return;
        const $ = (id) => document.getElementById(id);
        const game = t.userData.game;
        const genre = GENRES.find((g) => g.id === game.genre) ?? GENRES[0];
        this.cardEl.style.setProperty('--accent', genre.accent);
        $('claw-kicker').textContent = isNew ? 'New for your shelf' : 'You won another';
        $('claw-name').textContent = `${t.userData.name} plush`;
        $('claw-from').textContent = `from ${game.title}`;
        $('claw-stats').innerHTML = [`<span>${esc(game.icon || '')} ${esc(genre.short)}</span>`, isNew ? '<span class="fc-best">First of its kind</span>' : ''].join('');
        $('claw-fact').textContent = PRAISE[hashString(game.id) % PRAISE.length](game.title);
        $('claw-log').textContent = `${this.won.size} of ${this.games.length} plush won`;
        this.cardEl.hidden = false;
    }

    /** Take the prize from the bin, top up the case, and go again. */
    _collect(quiet = false) {
        if (this.cardEl) this.cardEl.hidden = true;
        if (!this.prize) return;
        const slot = this.prize.userData.slot;
        this.group.remove(this.prize);
        this.prize = null;
        // a fresh toy drops into the gap
        const inCase = new Set(this.toys.map((t) => t.userData.game.id));
        const free = slot && !slot.toy ? slot : this.slots.find((s) => !s.toy);
        if (free) this._place(this._toy(this._pickGame(inCase)), free, true);
        if (!quiet && this.active) this._turn();
    }

    _say(text, kind = '') {
        if (!this.sayEl) return;
        this.sayEl.textContent = text;
        this.sayEl.className = 'claw-say' + (kind ? ' ' + kind : '');
    }

    toWorld(x, y, z) {
        return new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld);
    }

    _placeClaw() {
        const c = this.claw;
        this.bridge.position.set(c.x, RAIL_Y - 0.025, 0);
        this.carriage.position.set(c.x, RAIL_Y - 0.05, c.z);
        this.hub.position.set(c.x, c.y, c.z);
        this.cable.position.set(c.x, RAIL_Y - 0.07, c.z);
        this.cable.scale.y = Math.max(0.01, RAIL_Y - 0.07 - c.y - 0.03 * CLAW_S);
        const open = lerp(0.12, -0.55, c.open);
        for (const p of this.prongs) p.rotation.x = open;
        const top = this._topAt(c.x, c.z, 0.03);
        this.spotMark.position.set(c.x, top + 0.004, c.z);
    }

    // ------------------------------------------------------------ every frame

    update(dt, t) {
        this.time = t;
        this.t += dt;
        dt = Math.min(dt, 0.1);
        const c = this.claw;
        const st = this.state;
        let moving = 0;
        if (st === 'play') {
            const k = this.keys, h = this.holds;
            const mx = (k.has('a') || k.has('arrowleft') || h.left ? -1 : 0) + (k.has('d') || k.has('arrowright') || h.right ? 1 : 0);
            const mz = (k.has('w') || k.has('arrowup') || h.up ? -1 : 0) + (k.has('s') || k.has('arrowdown') || h.down ? 1 : 0);
            c.x = clamp(c.x + mx * SPEED * dt, -IX + 0.05, IX - 0.05);
            c.z = clamp(c.z + mz * SPEED * dt, -IZ + 0.05, IZ - 0.05);
            moving = mx || mz ? 1 : 0;
            this.stick.rotation.set(mz * 0.35, 0, -mx * 0.35);
            c.open = damp(c.open, 0.35, 6, dt);
            this.left -= dt;
            if (this.timeEl) this.timeEl.textContent = String(Math.max(0, Math.ceil(this.left)));
            if (this.left <= 0) this.drop();
        } else this.stick.rotation.set(0, 0, 0);
        if (st === 'drop') {
            c.y -= dt * 0.5;
            if (c.y <= this.dropTo) {
                c.y = this.dropTo;
                this.state = 'grab';
                this.t = 0;
                this.env.audio?.claw('grab');
            }
        } else if (st === 'grab') {
            c.open = damp(c.open, 0, 9, dt);
            if (this.t > 0.55) {
                const g = this._grab();
                if (g) {
                    this.held = g.toy;
                    this.grip = g.grip;
                    const i = this.falling.indexOf(g.toy);
                    if (i >= 0) this.falling.splice(i, 1);
                    if (g.toy.userData.slot) g.toy.userData.slot.toy = null;
                    g.toy.userData.slot = null;
                    this.holdOff = { y: c.y - g.toy.position.y, rx: g.toy.rotation.x, rz: g.toy.rotation.z };
                } else {
                    this.misses++;
                }
                this.slipAt = this.held && Math.random() > this.grip ? 0.2 + Math.random() * 0.8 : -1;
                this.state = 'rise';
                this.t = 0;
                this.env.audio?.claw('up');
            }
        } else if (st === 'rise') {
            c.y = Math.min(HUB_UP, c.y + dt * 0.42);
            if (c.y >= HUB_UP) {
                this.state = 'carry';
                this.t = 0;
                this.carryFrom = { x: c.x, z: c.z };
                this.carryLen = Math.max(0.05, Math.hypot(c.x - CHUTE.cx, c.z - CHUTE.cz));
            }
        } else if (st === 'carry' || st === 'home') {
            const dx = CHUTE.cx - c.x, dz = CHUTE.cz - c.z, d = Math.hypot(dx, dz);
            const step = SPEED * 1.1 * dt;
            if (st === 'home' && c.y < HUB_UP) c.y = Math.min(HUB_UP, c.y + dt * 0.5);
            if (d > step) {
                c.x += (dx / d) * step;
                c.z += (dz / d) * step;
                moving = 1;
            } else {
                c.x = CHUTE.cx;
                c.z = CHUTE.cz;
                if (st === 'home') {
                    if (c.y >= HUB_UP) this.state = 'idle';
                } else {
                    this.state = 'release';
                    this.t = 0;
                }
            }
            // a weak grip lets go somewhere along the way
            if (st === 'carry' && this.held && this.slipAt >= 0 && 1 - d / this.carryLen > this.slipAt) {
                this._letGo();
                this.slipped = true;
                this.env.audio?.claw('clunk');
                this._say(this.misses >= 3 ? 'SO CLOSE!' : 'OOPS!', 'miss');
                this.misses++;
            }
        } else if (st === 'release') {
            c.open = damp(c.open, 0.8, 8, dt);
            if (this.t > 0.15 && this.held) {
                this._letGo();
                this.env.audio?.claw('clunk');
            }
            if (this.t > 0.9 && this.state === 'release' && !this.falling.length) {
                if (!this.slipped) {
                    this.env.audio?.claw('miss');
                    this._say('TRY AGAIN!', 'miss');
                }
                if (this.active) this._turn();
                else this.state = 'idle';
            }
        } else if (st === 'idle') {
            c.open = damp(c.open, 0.2, 3, dt);
        }
        // the held toy hangs from the claw, swinging a little
        if (this.held) {
            const h = this.held;
            h.position.set(c.x, c.y - this.holdOff.y, c.z);
            h.rotation.x = this.holdOff.rx + Math.sin(t * 5) * 0.06 * (moving ? 1.5 : 0.6);
            h.rotation.z = this.holdOff.rz + Math.cos(t * 4.3) * 0.05;
        }
        // toys in the air fall, bounce once, and settle (or go down the chute)
        for (let i = this.falling.length - 1; i >= 0; i--) {
            const f = this.falling[i], u = f.userData;
            u.vy -= 9.8 * dt;
            f.position.y += u.vy * dt;
            const rest = this._landing(f);
            if (rest === null) {
                if (f.position.y < FLOOR - 0.25) {
                    this.falling.splice(i, 1);
                    this._win(f);
                }
                continue;
            }
            if (f.position.y <= rest) {
                f.position.y = rest;
                if (u.vy < -1.2) {
                    u.vy *= -0.25;
                    this.env.audio?.claw('thump');
                } else {
                    u.vy = 0;
                    u.rest = rest;
                    this.falling.splice(i, 1);
                    // it lies where it fell, in the nearest free slot's place in the list
                    if (!u.slot) {
                        const s = this.slots.filter((s) => !s.toy).sort((a, b) => Math.hypot(a.x - f.position.x, a.z - f.position.z) - Math.hypot(b.x - f.position.x, b.z - f.position.z))[0];
                        if (s) {
                            s.toy = f;
                            u.slot = s;
                        }
                    }
                }
            }
        }
        this._placeClaw();
        this.env.audio?.gantry(this.active ? moving : 0);
        // bulbs: a slow chase, a race while the claw works, flashing on a win
        const busy = st !== 'idle' && st !== 'play';
        const col = new THREE.Color();
        for (let i = 0; i < 24; i++) {
            let on;
            if (this.state === 'won') on = Math.floor(t * 8) % 2 === 0;
            else on = Math.floor(t * (busy ? 12 : 4) + i) % 4 === 0;
            col.set(on ? [0xffe94a, 0x5fe8ff, 0xff6ad5][i % 3] : 0x30203a);
            if (on) col.multiplyScalar(1.05);
            this.bulbs.setColorAt(i, col);
        }
        this.bulbs.instanceColor.needsUpdate = true;
        this.dropBtn.material.emissiveIntensity = st === 'play' ? 0.6 + 0.6 * (0.5 + 0.5 * Math.sin(t * 6)) : 0.3;
        this.binLight.intensity = this.prize ? 1.5 + Math.sin(t * 6) * 0.5 : 0;
        if (this.prize) this.flap.rotation.x = Math.min(0.5, this.t * 1.5) * (this.state === 'won' ? 1 : 0);
        else this.flap.rotation.x = damp(this.flap.rotation.x, 0, 6, dt);
        // the view: in front of the glass, looking down into the case
        if (this.active) {
            const narrow = innerWidth / innerHeight < 1;
            const camTo = this.toWorld(0, narrow ? 2.1 : 1.86, narrow ? 2.2 : 1.32);
            const lookTo = this.toWorld(0, narrow ? 1.12 : 1.1, -0.06);
            this.camPos.lerp(camTo, 1 - Math.exp(-dt * 4));
            this.camLook.lerp(lookTo, 1 - Math.exp(-dt * 5));
            this.camera.position.copy(this.camPos);
            this.camera.lookAt(this.camLook);
        }
    }

    /** A note for the pointer. */
    info() {
        return { icon: '🧸', kicker: 'Lighthouse Arcade', title: 'Plush Pier', desc: `A claw machine with a plush toy from every game in the garden. ${this.won.size} of ${this.games.length} won so far.`, cta: 'Click to play →', accent: '#ff6ac0' };
    }
}
