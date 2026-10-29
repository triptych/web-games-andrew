// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x, 0, y); the camera hangs south of the monster and looks north.

import * as THREE from 'three';
import { toon, overlay } from './toon.js';
import { THINGS, FOES, POWERS } from '../sim/data.js';
import { ABSORB } from '../config.js';
import { THEMES } from './themes.js';
import * as M from './models.js';
import { World } from './world.js';
import { Puffs, Chips, Rings, Popups } from './fx.js';
import { Cel } from './toon.js';

const THING_KINDS = Object.keys(THINGS);
const POWER_COL = { fire: 0xff7a1a, magnet: 0xd04bff, shield: 0x4de1ff, meal: 0xffd23f, heart: 0xff4d8d };
const DUST = 0xe2d9cc;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** One InstancedMesh for every thing of a kind. */
class Pool {
    constructor(scene, geom, cap, mat = M.kitMaterial(true)) {
        this.mesh = new THREE.InstancedMesh(geom, mat, cap);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.cap = cap;
        this.n = 0;
        this.o = new THREE.Object3D();
        this.c = new THREE.Color();
        scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    push(x, y, z, ry, s, color = 0xffffff, rz = 0) {
        if (this.n >= this.cap) return;
        const o = this.o;
        o.position.set(x, y, z);
        o.rotation.set(0, ry, rz);
        o.scale.setScalar(s);
        o.updateMatrix();
        this.mesh.setMatrixAt(this.n, o.matrix);
        this.mesh.setColorAt(this.n, this.c.set(color));
        this.n++;
    }
    end() {
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}

function skyTexture(top, bottom) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
    gr.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function discTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 3, 500);   // a far near-plane keeps the thin ground layers from z-fighting
        this.cel = new Cel(this.renderer, this.camera);
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
        this.sun = new THREE.DirectionalLight(0xffffff, 2);
        this.sun.position.set(-14, 26, 12);
        this.scene.add(this.hemi, this.sun, this.sun.target);
        this.fog = new THREE.Fog(0xffffff, 40, 120);
        this.scene.fog = this.fog;

        this.world = null;
        this.G = null; this.level = -1;
        this.fx = {
            puffs: new Puffs(this.scene), chips: new Chips(this.scene), rings: new Rings(this.scene),
            pops: new Popups(document.getElementById('popups')),
        };
        this.shake = 0; this.squash = 0;
        this.scoreAcc = 0; this.scoreT = 0; this.scoreAt = [0, 0];
        this.cam = { x: 0, z: 0, d: 30, ready: false };
        this.mood = 0;
        this.time = 0;
        this._v = new THREE.Vector3();
        this.roll = new THREE.Quaternion();
        this.lastBX = null; this.lastBY = null;

        this.makePools();
        this.makeBall();
        this.disc = discTexture();
        const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
        this.blobs = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: this.disc, color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, fog: false }), 140);
        this.blobs.frustumCulled = false; this.blobs.renderOrder = 2;
        this.scene.add(this.blobs);
        overlay(this.blobs);
        this.marks = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: this.disc, transparent: true, opacity: 0.55, depthWrite: false, fog: false }), 40);
        this.marks.frustumCulled = false; this.marks.renderOrder = 3;
        this.scene.add(this.marks);
        overlay(this.marks);
        this.warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
        this.warn.rotation.x = -Math.PI / 2; this.warn.visible = false; this.warn.renderOrder = 3;
        this.scene.add(this.warn);
        overlay(this.warn);

        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    // ---------------------------------------------------------------- set-up

    makePools() {
        const s = this.scene;
        this.pools = {
            person: new Pool(s, M.personModel(), 320), car: new Pool(s, M.carModel(), 120), bus: new Pool(s, M.busModel(), 60),
            cart: new Pool(s, M.cartModel(), 40), pizza: new Pool(s, M.pizzaModel(), 40),
            tree: new Pool(s, M.treeModel(0xffffff), 260), pine: new Pool(s, M.pineModel(), 200), oak: new Pool(s, M.oakModel(), 80),
            lamp: new Pool(s, M.lampModel(), 120),
        };
        this.tankHull = new Pool(s, M.tankHullModel(), 12);
        this.tankTurret = new Pool(s, M.tankTurretModel(), 12);
        this.heli = new Pool(s, M.heliModel(), 8);
        this.rotor = new Pool(s, M.rotorModel(), 8);
        this.jet = new Pool(s, M.jetModel(), 4);
        this.shell = new Pool(s, M.shellModel(), 40);
        this.missile = new Pool(s, M.missileModel(), 20);
        this.bomb = new Pool(s, M.bombModel(), 24);
        this.rubble = new Pool(s, M.rubbleModel(), 260);
        this.gem = new Pool(s, M.gemModel(), 16);
    }

    makeBall() {
        this.ball = new THREE.Group();                         // follows the monster
        this.kaiju = new THREE.Group();                        // rolls
        const kg = M.buildKaiju();
        this.kaijuMesh = new THREE.Mesh(kg, toon({ vertexColors: true }));
        this.kaiju.add(this.kaijuMesh);
        this.stuckGroup = new THREE.Group();
        this.kaiju.add(this.stuckGroup);
        this.ball.add(this.kaiju);
        this.scene.add(this.ball);
        this.sil = new THREE.Mesh(M.silhouetteGeometry(), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.38, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false }));
        this.sil.renderOrder = 10;
        this.scene.add(this.sil);
        overlay(this.sil);
        // a ring on the ground under the monster: easy to find in the dust, and it turns gold when the pounce is ready
        const rg = new THREE.RingGeometry(0.9, 1, 48);
        rg.rotateX(-Math.PI / 2);
        this.ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        this.ring.renderOrder = 6;
        this.scene.add(this.ring);
        overlay(this.ring);
        this.fire = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6fe9ff, transparent: true, opacity: 0.28, depthWrite: false, fog: false }));
        this.ball.add(this.fire, this.shield);
        this.fire.visible = this.shield.visible = false;
        overlay(this.fire, this.shield);
        this.stuckMeshes = [];
        this.stuckSN = 0;
        this.stuckGeo = new Map();
        this.stuckMat = toon({ vertexColors: true });
        this.stuckSrc = {};
        THING_KINDS.forEach((k, i) => { this.stuckSrc[i] = { person: M.personModel, car: M.carModel, bus: M.busModel, cart: M.cartModel, pizza: M.pizzaModel, tree: () => M.treeModel(0xffffff), pine: M.pineModel, oak: M.oakModel, lamp: M.lampModel }[k]; });
        this.stuckSrc[100] = M.rubbleModel;
    }

    applyTheme(G) {
        const th = THEMES[G.level];
        this.th = th;
        this.scene.background = skyTexture(th.sky[0], th.sky[1]);
        this.scene.fog.color.set(th.fog);
        this.cel.ink.set(th.ink);
        this.hemi.color.set(th.hemiSky); this.hemi.groundColor.set(th.hemiGround); this.hemi.intensity = th.hemiI * 0.82;
        this.sun.color.set(th.sun); this.sun.intensity = th.sunI;
    }

    ensureWorld(G) {
        if (this.G === G && this.level === G.level) return;
        if (this.world) this.world.dispose();
        this.G = G; this.level = G.level;
        this.applyTheme(G);
        this.world = new World(this.scene, G);
        this.cam.ready = false;
        this.stuckSN = 0;
        for (const m of this.stuckMeshes) this.stuckGroup.remove(m);
        this.stuckMeshes = [];
        this.lastBX = null;
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.cel.resize();
    }

    /** Cartoon outlines on or off (off draws the scene in one plain pass). */
    setOutline(on) { this.cel.on = !!on; }

    /** World point → CSS pixels on the canvas. */
    worldToScreen(x, y, z = 0) {
        this._v.set(x, z, y).project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (this._v.x * 0.5 + 0.5) * r.width, y: r.top + (-this._v.y * 0.5 + 0.5) * r.height, behind: this._v.z > 1 };
    }

    // ---------------------------------------------------------------- stuck-on stuff

    stuckMesh(kind, c) {
        const key = kind + ':' + c;
        let geo = this.stuckGeo.get(key);
        if (!geo) {
            geo = this.stuckSrc[kind]();
            const th = this.th, name = THING_KINDS[kind];
            let tint = 0xffffff;
            if (kind === 100) tint = th.walls[c % th.walls.length];
            else if (name === 'tree' || name === 'oak') tint = th.leaf[c % th.leaf.length];
            else if (name === 'pine') tint = th.pine[c % th.pine.length];
            else tint = M.PAINT[c % M.PAINT.length];
            const col = geo.attributes.color, paint = geo.attributes.aPaint, t = new THREE.Color(tint);
            for (let i = 0; i < col.count; i++) if (paint.getX(i) > 0.5) col.setXYZ(i, col.getX(i) * t.r, col.getY(i) * t.g, col.getZ(i) * t.b);
            this.stuckGeo.set(key, geo);
        }
        return new THREE.Mesh(geo, this.stuckMat);
    }

    syncStuck(G) {
        const b = G.ball, list = b.stuck;
        const added = (b.sn || 0) - this.stuckSN;
        this.stuckSN = b.sn || 0;
        if (added < 0 || added > list.length) {        // a new game or a load: start again
            for (const m of this.stuckMeshes) this.stuckGroup.remove(m);
            this.stuckMeshes = [];
        } else if (added > 0 || this.stuckMeshes.length > list.length) {
            const drop = Math.max(0, this.stuckMeshes.length + added - list.length);
            for (let i = 0; i < drop; i++) this.stuckGroup.remove(this.stuckMeshes.shift());
        }
        for (let i = this.stuckMeshes.length; i < list.length; i++) {
            const [kind, dx, dy, dz, size, c] = list[i];
            const m = this.stuckMesh(kind, c);
            m.userData = { dir: new THREE.Vector3(dx, dy, dz), size, kind };
            m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.userData.dir);
            this.stuckGroup.add(m);
            this.stuckMeshes.push(m);
        }
        const r = b.r;
        for (const m of this.stuckMeshes) {
            const u = m.userData;
            const sc = (u.kind === 100 ? u.size * 1.8 : u.size / (THINGS[THING_KINDS[u.kind]]?.size || 1)) / r;
            m.scale.setScalar(sc);
            m.position.copy(u.dir).multiplyScalar(0.93);
        }
    }

    // ---------------------------------------------------------------- events

    onEvents(G, events) {
        if (!this.world) return;
        const fx = this.fx, add = (n) => { this.shake = Math.min(1.2, this.shake + n * (this.shakeScale ?? 1)); };
        const th = this.th;
        for (const e of events) {
            switch (e.type) {
                case 'score': this.scoreAcc += e.n; this.scoreAt = [e.x, e.y]; break;
                case 'eat': {
                    if (e.k === 'rubble') break;
                    fx.puffs.emit(e.x, 0.8, e.y, 3, { color: 0xffffff, size: 0.5 + e.size * 0.5, life: 0.4, speed: 1.2, up: 1, grow: 1.6, alpha: 0.7 });
                    this.squash = Math.min(0.18, this.squash + 0.06);
                    break;
                }
                case 'floors': {
                    const wall = th.walls[e.col % th.walls.length];
                    const n = Math.min(10, e.dropped * 3);
                    fx.puffs.emit(e.x, e.to + 0.5, e.y, n, { color: DUST, spread: e.w * 0.35, spreadY: Math.max(0.5, e.from - e.to), size: 1.5, life: 1.1, speed: 2.2, up: 1.2, grow: 2.0, alpha: 0.5, jitter: true });
                    fx.chips.emit(e.x, e.from, e.y, Math.min(14, e.dropped * 4), wall, 4.5, 0.32);
                    this.world.hit(e.id, 0.35);
                    add(0.12 + e.dropped * 0.05);
                    break;
                }
                case 'collapse': {
                    const wall = th.walls[e.col % th.walls.length];
                    fx.puffs.emit(e.x, 1, e.y, 12, { color: DUST, spread: e.w * 0.45, spreadY: Math.min(e.h, 5), size: 2.2, life: 1.6, speed: 3.2, up: 1.4, grow: 2.4, alpha: 0.55, jitter: true });
                    fx.chips.emit(e.x, Math.min(e.h, 6), e.y, 26, wall, 6, 0.4);
                    fx.rings.emit(e.x, e.y, 3 + e.w * 0.5, 0xffffff, 0.5);
                    this.world.collapse(e.id);
                    add(0.5);
                    break;
                }
                case 'bounce': {
                    if (e.what === 'building') this.world.hit(e.id, Math.min(0.4, e.speed * 0.03));
                    fx.puffs.emit(e.x, 0.6, e.y, 3, { color: DUST, size: 0.8, life: 0.5, speed: 1.6, up: 0.8, grow: 1.5, alpha: 0.6 });
                    this.squash = Math.min(0.22, this.squash + e.speed * 0.012);
                    add(Math.min(0.3, e.speed * 0.012));
                    break;
                }
                case 'pounce': {
                    fx.puffs.emit(e.x, 0.3, e.y, 7, { color: DUST, size: 1.1, life: 0.7, speed: 2.6, up: 0.4, grow: 2, alpha: 0.6 });
                    this.squash = -0.2;
                    break;
                }
                case 'slam': {
                    fx.rings.emit(e.x, e.y, e.R, 0xfff3b0, 0.55);
                    fx.rings.emit(e.x, e.y, e.R * 0.6, 0xffffff, 0.4);
                    for (let i = 0; i < 14; i++) {
                        const a = (i / 14) * TAU;
                        fx.puffs.emit(e.x + Math.cos(a) * 1.2, 0.4, e.y + Math.sin(a) * 1.2, 1, { color: DUST, size: 1.5, life: 0.8, speed: 5, up: 0.3, grow: 2, alpha: 0.7 });
                    }
                    this.squash = 0.3;
                    add(0.7);
                    break;
                }
                case 'boom': {
                    fx.puffs.emit(e.x, 0.8, e.y, 7, { color: 0xffa21a, size: 1.2 + e.R * 0.35, life: 0.6, speed: e.R * 1.2, up: 2, grow: 1.5, alpha: 0.95, jitter: true });
                    fx.puffs.emit(e.x, 1.2, e.y, 5, { color: 0x3a3a40, size: 1.4 + e.R * 0.4, life: 1.4, speed: e.R * 0.8, up: 3, grow: 2.2, alpha: 0.7 });
                    fx.rings.emit(e.x, e.y, e.R, 0xffd27a, 0.35);
                    add(Math.min(0.6, e.R * 0.12));
                    break;
                }
                case 'shot': fx.puffs.emit(e.x, e.k === 'missile' ? 4 : 1, e.y, 3, { color: 0xffe9a8, size: 0.8, life: 0.25, speed: 1, up: 0.2, grow: 1.4, alpha: 0.9 }); break;
                case 'smash': {
                    fx.chips.emit(e.x, e.z ?? 0.6, e.y, 10, e.k === 'tank' || e.k === 'heli' ? 0x6b7280 : 0x7fd16b, 5, 0.3);
                    fx.puffs.emit(e.x, e.z ?? 0.6, e.y, 4, { color: e.k === 'tank' || e.k === 'heli' ? 0x44444c : DUST, size: 1.2, life: 0.9, speed: 2, up: 1.5, grow: 1.8, alpha: 0.8 });
                    add(0.2);
                    break;
                }
                case 'hurt': add(0.7); break;
                case 'die': {
                    fx.puffs.emit(e.x, 1, e.y, 18, { color: 0xffa21a, size: 2, life: 1, speed: 6, up: 3, grow: 2, alpha: 0.95, jitter: true });
                    fx.rings.emit(e.x, e.y, 9, 0xff6b6b, 0.8);
                    add(1);
                    break;
                }
                case 'power': {
                    fx.rings.emit(G.ball.x, G.ball.y, G.ball.r * 3, POWER_COL[e.k], 0.6);
                    fx.puffs.emit(G.ball.x, G.ball.r, G.ball.y, 8, { color: POWER_COL[e.k], size: 0.9, life: 0.8, speed: 3, up: 3, grow: 1, alpha: 0.9 });
                    const p = this.worldToScreen(G.ball.x, G.ball.y, G.ball.r * 2.2);
                    if (!p.behind) fx.pops.add(POWERS[e.k].icon + ' ' + POWERS[e.k].label, p.x, p.y, 'power');
                    break;
                }
                case 'grow': this.squash = 0.25; fx.rings.emit(G.ball.x, G.ball.y, G.ball.r * 2.2, 0x9dffb0, 0.5); break;
                case 'heal': {
                    const p = this.worldToScreen(e.x, e.y, 2);
                    if (!p.behind) fx.pops.add('+' + e.n + ' ♥', p.x, p.y, 'heal');
                    break;
                }
                case 'deflect': fx.puffs.emit(e.x, 1, e.y, 4, { color: 0xffffff, size: 0.7, life: 0.4, speed: 2, up: 1, grow: 1.5, alpha: 0.9 }); break;
                case 'shield': fx.rings.emit(G.ball.x, G.ball.y, G.ball.r * 2, 0x6fe9ff, 0.4); break;
                default: break;
            }
        }
    }

    // ---------------------------------------------------------------- frame

    tintFor(kind, c) {
        const th = this.th;
        if (kind === 'tree' || kind === 'oak') return th.leaf[c % th.leaf.length];
        if (kind === 'pine') return th.pine[c % th.pine.length];
        if (kind === 'lamp') return 0xffffff;
        return M.PAINT[c % M.PAINT.length];
    }

    frame(G, dt, time) {
        this.resize();
        this.ensureWorld(G);
        this.time = time;
        const b = G.ball, L = G.layout;
        dt = Math.min(dt, 0.05);

        // ---- camera: south of the monster, high, looking north; backs off as the monster grows
        const aspect = this.camera.aspect;
        const wide = Math.max(1, Math.pow(1.4 / aspect, 0.75));
        const dist = (13 + b.r * 6.6) * wide;
        if (!this.cam.ready) { this.cam.x = b.x; this.cam.z = b.y; this.cam.d = dist; this.cam.ready = true; }
        const k = 1 - Math.exp(-dt * 4.5);
        this.cam.x += (b.x + b.vx * 0.25 - this.cam.x) * k;
        this.cam.z += (b.y + b.vy * 0.25 - this.cam.z) * k;
        this.cam.d += (dist - this.cam.d) * (1 - Math.exp(-dt * 2));
        const pitch = 1.08;                                   // about 62° down
        const sx = (Math.random() - 0.5) * this.shake * 0.7, sy = (Math.random() - 0.5) * this.shake * 0.5;
        this.shake = Math.max(0, this.shake - dt * 2.8);
        const focusZ = this.cam.z - b.r * 0.4 - 2.5;
        this.camera.position.set(this.cam.x + sx, Math.sin(pitch) * this.cam.d + sy, focusZ + Math.cos(pitch) * this.cam.d);
        this.camera.lookAt(this.cam.x + sx * 0.3, 0.8, focusZ);
        if (this.debugCam) {                                  // dev only: a free camera for the harnesses
            const d = this.debugCam;
            this.camera.position.set(d.x, d.y, d.z);
            this.camera.lookAt(d.lx, d.ly ?? 0, d.lz);
        }
        this.camera.updateMatrixWorld();
        this.fog.near = this.cam.d * 1.5;
        this.fog.far = this.cam.d * 4.2;
        this.world.follow(this.cam.x, focusZ);
        this.sun.position.set(this.cam.x - 14, 26, focusZ + 12);
        this.sun.target.position.set(this.cam.x, 0, focusZ);

        this.world.update(G, dt, time);

        // score text: many small awards in a moment become one number above the monster
        this.scoreT -= dt;
        if (this.scoreAcc > 0 && this.scoreT <= 0) {
            const p = this.worldToScreen(this.scoreAt[0], this.scoreAt[1], 2.5 + b.r);
            if (!p.behind) this.fx.pops.add('+' + this.scoreAcc, p.x, p.y, this.scoreAcc >= 250 ? 'big' : '');
            this.scoreAcc = 0; this.scoreT = 0.35;
        }

        // ---- the monster
        this.ball.position.set(b.x, b.r + b.z, b.y);
        if (this.lastBX !== null) {
            const dx = b.x - this.lastBX, dz = b.y - this.lastBY, d = Math.hypot(dx, dz);
            if (d > 1e-5 && d < 6) {
                const axis = this._v.set(dz, 0, -dx).normalize();
                const q = new THREE.Quaternion().setFromAxisAngle(axis, d / b.r);
                this.roll.premultiply(q);
            }
        }
        this.lastBX = b.x; this.lastBY = b.y;
        this.kaiju.quaternion.copy(this.roll);
        this.kaiju.scale.setScalar(b.r);
        this.squash *= Math.exp(-dt * 8);
        const sq = this.squash;
        this.ball.scale.set(1 + sq, 1 - sq * 0.8, 1 + sq);
        const alive = G.phase !== 'dead' && G.phase !== 'over';
        const blink = b.inv > 0 && G.phase === 'play' && Math.floor(time * 16) % 2 === 0 && b.inv < 2.3;
        this.ball.visible = alive && !blink;
        this.sil.visible = alive;
        this.ring.visible = alive;
        this.ring.position.set(b.x, 0.38, b.y);
        this.ring.scale.setScalar(b.r * (1.18 + (b.cd <= 0 ? Math.sin(time * 8) * 0.04 : 0)));
        this.ring.material.color.set(b.cd <= 0 ? 0xffe066 : 0xffffff);
        this.ring.material.opacity = b.cd <= 0 ? 0.75 : 0.28;
        this.sil.position.copy(this.ball.position);
        this.sil.scale.setScalar(b.r * 1.01);
        this.fire.visible = G.power.fire > 0;
        this.fire.scale.setScalar(b.r * (1.18 + Math.sin(time * 18) * 0.05));
        this.shield.visible = G.power.shield > 0;
        this.shield.scale.setScalar(b.r * (1.35 + Math.sin(time * 6) * 0.03));
        this.syncStuck(G);
        if (G.power.fire > 0 && alive) this.fx.puffs.emit(b.x, b.r + b.z + b.r * 0.6, b.y, 1, { color: 0xff8a1f, size: b.r * 0.9, life: 0.5, speed: 0.8, up: 2.5, grow: 0.6, alpha: 0.8, jitter: true, spread: b.r * 0.5 });
        if (G.power.magnet > 0 && alive && Math.floor(time * 2.5) !== Math.floor((time - dt) * 2.5)) this.fx.rings.emit(b.x, b.y, 6 + b.r * 1.5, 0xd04bff, 0.7);

        // ---- things
        for (const p of Object.values(this.pools)) p.begin();
        for (const t of G.things) {
            const T = THINGS[t.k], pool = this.pools[t.k];
            const bob = t.k === 'person' ? Math.abs(Math.sin(time * 9 + t.id)) * 0.05 : 0;
            pool.push(t.x, 0.14 + bob, t.y, -t.a, t.size / T.size, this.tintFor(t.k, t.c));
        }
        for (const p of Object.values(this.pools)) p.end();

        this.rubble.begin();
        for (const q of G.rubble) this.rubble.push(q.x, q.z + q.s * 0.45, q.y, q.x * 3.1 + q.y, q.s * 1.8, this.th.walls[q.c % this.th.walls.length] || 0x8d8f98);
        this.rubble.end();

        this.tankHull.begin(); this.tankTurret.begin(); this.heli.begin(); this.rotor.begin(); this.jet.begin();
        let bi = 0, mi = 0;
        const tmp = this._tmpO || (this._tmpO = new THREE.Object3D());
        const blob = (x, z, sx, sz, op = 1) => {
            if (bi >= 140) return;
            tmp.position.set(x, 0.31, z); tmp.rotation.set(0, 0, 0); tmp.scale.set(sx * op, 1, sz * op); tmp.updateMatrix();
            this.blobs.setMatrixAt(bi++, tmp.matrix);
        };
        const mark = (x, z, R, col) => {
            if (mi >= 40) return;
            tmp.position.set(x, 0.33, z); tmp.rotation.set(0, 0, 0); tmp.scale.set(R * 2, 1, R * 2); tmp.updateMatrix();
            this.marks.setMatrixAt(mi, tmp.matrix);
            this.marks.setColorAt(mi, this._col || (this._col = new THREE.Color()).set(col));
            mi++;
        };
        let warning = null;
        for (const f of G.foes) {
            if (f.k === 'tank') {
                this.tankHull.push(f.x, 0.14, f.y, -f.a, 0.9, 0x6b7a4a);
                this.tankTurret.push(f.x, 0.14, f.y, -f.ta, 0.9, 0x6b7a4a);
                blob(f.x, f.y, 2.6, 2.2);
            } else if (f.k === 'heli') {
                const z = f.z + Math.sin(time * 3 + f.id) * 0.15;
                this.heli.push(f.x, z, f.y, -f.a, 1, 0x58704a);
                this.rotor.push(f.x, z + 0.55, f.y, time * 28, 1);
                blob(f.x, f.y, 2.6, 2.2, 0.8);
            } else if (f.k === 'jet') {
                this.jet.push(f.x, f.z, f.y, f.dir > 0 ? 0 : Math.PI, 1.4, 0xd7dde8);
                blob(f.x + 1, f.y, 4, 3.4, 0.9);
                if (f.state === 'warn') warning = f;
            }
        }
        this.tankHull.end(); this.tankTurret.end(); this.heli.end(); this.rotor.end(); this.jet.end();
        if (warning) {
            this.warn.visible = true;
            this.warn.scale.set(L.W + 20, 3.4, 1);
            this.warn.position.set(L.W / 2, 0.36, warning.y);
            this.warn.material.opacity = 0.22 + 0.16 * Math.sin(time * 18);
        } else this.warn.visible = false;

        this.shell.begin(); this.missile.begin(); this.bomb.begin();
        for (const s of G.shots) {
            if (s.k === 'missile') {
                const age = 4.2 - s.life;
                this.missile.push(s.x, Math.max(1.0, 4.2 - age * 3), s.y, -Math.atan2(s.vy, s.vx), 1);
                if (Math.random() < 0.7) this.fx.puffs.emit(s.x, Math.max(1.0, 4.2 - age * 3), s.y, 1, { color: 0xdddddd, size: 0.4, life: 0.6, speed: 0.2, up: 0.2, grow: 2, alpha: 0.6 });
            } else {
                const pr = 1 - s.life / 3;
                this.shell.push(s.x, 0.8 + 2.2 * Math.sin(Math.PI * clamp(pr, 0, 1)), s.y, 0, 1);
                blob(s.x, s.y, 0.7, 0.7);
            }
        }
        for (const m of G.bombs) {
            const k2 = clamp(m.fuse / 0.85, 0, 1);
            this.bomb.push(m.x, 0.5 + 8.5 * k2 * k2, m.y, 0, 1);
            mark(m.x, m.y, m.R, 0xff3b3b);
        }
        this.shell.end(); this.missile.end(); this.bomb.end();

        this.gem.begin();
        for (const p of G.pickups) {
            const blinkP = p.life < 4 && Math.floor(time * 8) % 2 === 0;
            if (!blinkP || this.reduced) this.gem.push(p.x, 1.3 + Math.sin(time * 3 + p.x) * 0.2, p.y, time * 2, 1, POWER_COL[p.k]);
            mark(p.x, p.y, 1.2 + Math.sin(time * 5) * 0.1, POWER_COL[p.k]);
        }
        this.gem.end();
        // the monster's own shadow shrinks as it jumps
        blob(b.x, b.y, b.r * 2.6 * (1 - Math.min(0.5, b.z * 0.08)), b.r * 2.6 * (1 - Math.min(0.5, b.z * 0.08)));
        this.blobs.count = bi; this.blobs.instanceMatrix.needsUpdate = true;
        this.marks.count = mi; this.marks.instanceMatrix.needsUpdate = true;
        if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true;

        const camQ = this.camera.quaternion;
        this.fx.puffs.update(dt, camQ);
        this.fx.chips.update(dt);
        this.fx.rings.update(dt);
        this.cel.render(this.scene);
    }
}

export { ABSORB, FOES };
