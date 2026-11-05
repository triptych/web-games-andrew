// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim cell (col, row) maps to world (x, 0, z) centred on the board; the camera looks down at it from the south.
//
//   - items live in a Map of id -> entry and glide to their cell; the sim decides where things are
//   - merges, serves and composts turn the removed items into "ghosts" that fly to where they went
//   - the camera is fitted to a safe rectangle, the part of the screen the HUD panels leave free
//   - a drag is visual only: the controller asks the view for the cell under it and sends the command

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, GEN } from '../config.js';
import { colOf, rowOf, canMerge, isOpen } from '../sim/game.js';
import { getModel, mat, leafGeo, PAL } from './models.js';
import { Fx } from './fx.js';
import { hash3 } from '../rng.js';

const N = COLS * ROWS;
const TOP = 0.19;                                   // y of the top of a cell
export const cellX = (i) => colOf(i) - (COLS - 1) / 2;
export const cellZ = (i) => rowOf(i) - (ROWS - 1) / 2;
const outBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const COVERED = new THREE.Color(0x8f6d4d);

const PIP_ON = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffa000, emissiveIntensity: 0.9, roughness: 0.4 });
const PIP_OFF = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
const PIP_GEO = new THREE.SphereGeometry(0.05, 12, 10);

function woodTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#7b4a27';
    g.fillRect(0, 0, 512, 512);
    for (let p = 0; p < 4; p++) {                              // four planks
        g.fillStyle = `hsl(${24 + p * 2}, ${48 - p * 3}%, ${27 + (p % 2) * 3}%)`;
        g.fillRect(p * 128, 0, 128, 512);
        for (let i = 0; i < 46; i++) {                           // grain
            const x = p * 128 + hash3(p, i, 1) * 128, w = 1 + hash3(p, i, 2) * 2.5;
            g.fillStyle = `rgba(${hash3(p, i, 3) > 0.5 ? '40,20,8' : '190,130,70'},${0.05 + hash3(p, i, 4) * 0.12})`;
            g.beginPath();
            g.moveTo(x, 0);
            g.bezierCurveTo(x + 14 * (hash3(p, i, 5) - 0.5), 170, x + 14 * (hash3(p, i, 6) - 0.5), 340, x + 8 * (hash3(p, i, 7) - 0.5), 512);
            g.lineTo(x + w, 512);
            g.bezierCurveTo(x + w + 6, 340, x + w + 6, 170, x + w, 0);
            g.fill();
        }
        g.fillStyle = 'rgba(25,10,2,0.55)';
        g.fillRect(p * 128, 0, 3, 512);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
function plaidTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff4de';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(226,112,38,0.30)';
    g.fillRect(0, 0, 64, 128);
    g.fillRect(0, 0, 128, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x2b170b);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x2b170b, 20, 60);
        this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

        this.items = new Map();           // id -> entry
        this.ghosts = [];
        this.timers = [];
        this.drag = null;
        this.marks = { cursor: -1, selected: -1, hover: -1, targets: [], hint: [] };
        this.cellOpen = new Float32Array(N);
        this.openKnown = false;
        this.shake = 0;
        this.calm = false;
        this.instant = true;
        this.rect = null;
        this.dragOffsetZ = -0.15;
        this.iconCache = new Map();
        this.time = 0;
        this.w = this.h = 0;

        this.buildWorld();
        this.fx = new Fx(this.scene);
        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    // ------------------------------------------------------------------ the room, the table, the board

    buildWorld() {
        const S = this.scene;
        S.add(new THREE.HemisphereLight(0xfff0d9, 0x6b4a30, 1.15));
        const sun = this.sun = new THREE.DirectionalLight(0xffe3b8, 2.5);
        sun.position.set(-4.5, 10, 6);
        sun.castShadow = true;
        // phones get a lighter shadow map: the board is small on screen, and the GPU is smaller too
        const small = window.matchMedia?.('(pointer: coarse)').matches;
        sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
        Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5.6, bottom: -5.6, near: 2, far: 30 });
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.025;
        sun.shadow.radius = 3;
        S.add(sun, sun.target);
        const fill = new THREE.DirectionalLight(0xffc890, 0.55);
        fill.position.set(6, 5, -3);
        S.add(fill);

        // the big wooden table under everything
        const wood = woodTexture();
        wood.repeat.set(9, 9);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75 }));
        top.rotation.x = -Math.PI / 2;
        top.position.y = -0.2;
        top.receiveShadow = true;
        S.add(top);

        // the board: a wooden frame, a gingham cloth, and a plate for each cell
        const frame = new THREE.Mesh(new RoundedBoxGeometry(COLS + 0.75, 0.34, ROWS + 0.75, 4, 0.14), new THREE.MeshStandardMaterial({ color: 0x8a5128, roughness: 0.55 }));
        frame.position.y = -0.07;
        frame.castShadow = frame.receiveShadow = true;
        S.add(frame);
        const plaid = plaidTexture();
        plaid.repeat.set((COLS + 0.35) / 0.9, (ROWS + 0.35) / 0.9);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 0.35, ROWS + 0.35), new THREE.MeshStandardMaterial({ map: plaid, roughness: 0.95 }));
        cloth.rotation.x = -Math.PI / 2;
        cloth.position.y = 0.101;
        cloth.receiveShadow = true;
        S.add(cloth);

        this.cells = new THREE.InstancedMesh(new RoundedBoxGeometry(0.94, 0.1, 0.94, 3, 0.045), new THREE.MeshStandardMaterial({ roughness: 0.65 }), N);
        this.cells.receiveShadow = true;
        this.cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        S.add(this.cells);

        // a little padlock on every cell that is still covered
        const lockMat = new THREE.MeshStandardMaterial({ color: 0xf5b82e, metalness: 0.6, roughness: 0.35 });
        const loopGeo = new THREE.TorusGeometry(0.085, 0.026, 8, 18, Math.PI);
        loopGeo.rotateX(-Math.PI / 2);                  // lie flat, arching up the screen
        this.lockBody = new THREE.InstancedMesh(new RoundedBoxGeometry(0.34, 0.09, 0.26, 2, 0.035), lockMat, N);
        this.lockLoop = new THREE.InstancedMesh(loopGeo, lockMat, N);
        for (const m of [this.lockBody, this.lockLoop]) { m.castShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S.add(m); }

        // table-top litter: leaves that fell on the table around the board
        const litter = new THREE.InstancedMesh(leafGeo(0.4, 0.2, 0.02), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), 26);
        const pal = [0xe9772b, 0xc92f3c, 0xf2c230, 0xb8541d, 0x6d9c2e];
        for (let i = 0; i < 26; i++) {
            const side = i % 4, a = hash3(i, 9) * 1.0;
            const x = side < 2 ? (side ? 1 : -1) * (COLS / 2 + 0.7 + a * 3.2) : (hash3(i, 3) - 0.5) * (COLS + 4);
            const z = side < 2 ? (hash3(i, 5) - 0.5) * (ROWS + 4) : (side === 2 ? -1 : 1) * (ROWS / 2 + 0.7 + a * 2.5);
            dummy.position.set(x, -0.17, z);
            dummy.rotation.set(0, hash3(i, 7) * 6.28, 0);
            dummy.scale.setScalar(0.9 + hash3(i, 8) * 0.8);
            dummy.updateMatrix();
            litter.setMatrixAt(i, dummy.matrix);
            litter.setColorAt(i, tmpColor.set(pal[i % 5]));
        }
        litter.receiveShadow = true;
        S.add(litter);

        // set dressing along the far edge of the table: candles, a row of gourds
        const dressing = new THREE.Group();
        this.flames = [];
        for (const x of [-2.7, 2.7]) {
            const c = new THREE.Group();
            const add = (m, y) => { m.position.y = y; m.castShadow = m.receiveShadow = true; c.add(m); return m; };
            add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 24), mat(PAL.gold, { metal: 0.7, rough: 0.3 })), -0.15);
            add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 20), mat(0xfff0d0, { rough: 0.5 })), 0.25);
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }));
            f.scale.set(1, 1.7, 1);
            f.position.y = 0.72;
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
            glow.position.y = 0.72;
            c.add(f, glow);
            this.flames.push(f, glow);
            c.position.set(x, 0.0, -ROWS / 2 - 1.5);
            dressing.add(c);
        }
        [[-1.1, 0.34], [0.0, 0.46], [1.15, 0.3], [0.55, 0.2], [-0.55, 0.2]].forEach(([x, r], i) => {
            const g = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), mat(i % 2 ? PAL.orangeDk : PAL.orange, { rough: 0.5 }));
            g.scale.set(1, 0.78, 1);
            g.position.set(x, -0.2 + r * 0.78, -ROWS / 2 - 1.6 + (i > 2 ? 0.7 : 0));
            g.castShadow = g.receiveShadow = true;
            const st = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.18, r * 0.5, 10), mat(PAL.greenDk));
            st.position.y = r * 0.8;
            g.add(st);
            dressing.add(g);
        });
        S.add(dressing);

        // highlight rings (cursor, selection, merge targets, hints)
        const rg = new THREE.RingGeometry(0.4, 0.49, 40);
        rg.rotateX(-Math.PI / 2);
        this.mrings = [];
        for (let i = 0; i < 18; i++) {
            const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
            m.visible = false;
            m.renderOrder = 4;
            S.add(m);
            this.mrings.push(m);
        }
    }

    // ------------------------------------------------------------------ size and camera

    resize(force) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px, never 100vh
        this.fit();
    }

    /** The part of the screen the board may use, in CSS px: whatever the HUD panels leave free. */
    setSafeRect(r) {
        this.rect = r;
        this.fit();
    }

    fit() {
        const { w, h } = this;
        if (!w) return;
        const r = this.rect || { l: 0, t: 0, r: w, b: h };
        const rw = Math.max(80, r.r - r.l - 6), rh = Math.max(80, r.b - r.t - 6);
        const cam = this.camera;
        const landscape = w > h * 1.15;
        const el = (landscape ? 56 : 61) * Math.PI / 180;
        const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
        const target = new THREE.Vector3(0, 0.25, 0.1);
        const pts = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.2, 1.0]) pts.push(new THREE.Vector3(sx * (COLS + 0.75) / 2, y, sz * (ROWS + 0.75) / 2));
        cam.aspect = w / h;
        cam.clearViewOffset();
        const extents = (d) => {
            cam.position.copy(target).addScaledVector(dir, d);
            cam.lookAt(target);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (const p of pts) {
                const v = p.clone().project(cam);
                const px = (v.x + 1) / 2 * w, py = (1 - v.y) / 2 * h;
                x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
            }
            return { x0, x1, y0, y1 };
        };
        let lo = 3, hi = 70;
        for (let i = 0; i < 26; i++) {
            const d = (lo + hi) / 2, e = extents(d);
            if (e.x1 - e.x0 <= rw && e.y1 - e.y0 <= rh) hi = d; else lo = d;
        }
        const e = extents(hi);
        const dx = (r.l + r.r) / 2 - (e.x0 + e.x1) / 2, dy = (r.t + r.b) / 2 - (e.y0 + e.y1) / 2;
        cam.setViewOffset(w, h, -dx, -dy, w, h);
        this.camBase = cam.position.clone();
        this.camDist = hi;
        // fog and the far plane follow the fitted distance: a portrait phone backs the camera off,
        // and fixed fog would hide the board
        cam.far = hi * 5;
        cam.updateProjectionMatrix();
        this.scene.fog.near = hi * 1.5;
        this.scene.fog.far = hi * 3.2;
    }

    setCalm(on) { this.calm = on; this.fx.calm = on; }

    // ------------------------------------------------------------------ picking

    _ray(cx, cy) {
        const rc = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        return ray;
    }
    /** Where a screen point meets the horizontal plane at height y. */
    pointToWorld(cx, cy, y = TOP) {
        const out = new THREE.Vector3();
        return this._ray(cx, cy).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out) ? out : null;
    }
    _cellOfWorld(x, z) {
        const c = Math.floor(x + COLS / 2), r = Math.floor(z + ROWS / 2);
        return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1;
    }
    /** The board cell under a screen point, or -1. */
    cellAt(cx, cy) {
        const p = this.pointToWorld(cx, cy, TOP);
        return p ? this._cellOfWorld(p.x, p.z) : -1;
    }
    /** Screen position (CSS px) of a cell, `y` above its floor. */
    cellToClient(i, y = 0.45) {
        const rc = this.canvas.getBoundingClientRect();
        const v = new THREE.Vector3(cellX(i), y, cellZ(i)).project(this.camera);
        return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height };
    }

    // ------------------------------------------------------------------ dragging (visual only)

    beginDrag(G, cell, cx, cy, touch) {
        const e = [...this.items.values()].find((q) => q.cell === cell);
        if (!e) return false;
        this.dragOffsetZ = touch ? -0.75 : -0.15;
        this.drag = { entry: e, cell, wx: cellX(cell), wz: cellZ(cell) };
        const me = G.cells[cell];
        this.marks.targets = me && me.k === 'item' ? G.cells.map((o, i) => (i !== cell && canMerge(me, o) ? i : -1)).filter((i) => i >= 0) : [];
        this.moveDrag(cx, cy);
        return true;
    }
    moveDrag(cx, cy) {
        if (!this.drag) return;
        const p = this.pointToWorld(cx, cy, TOP + 0.4);
        if (p) { this.drag.wx = p.x; this.drag.wz = p.z + this.dragOffsetZ; }
    }
    /** The cell the dragged item hovers over (where it would drop). */
    dragCell() { return this.drag ? this._cellOfWorld(this.drag.wx, this.drag.wz) : -1; }
    endDrag() { this.drag = null; this.marks.targets = []; }
    setMarks(m) { Object.assign(this.marks, m); }

    // ------------------------------------------------------------------ item entries

    _make(it, x, z) {
        const holder = new THREE.Group();
        const model = getModel(it.c, it.k === 'gen' ? 'gen' : it.t);
        holder.add(model);
        const e = { id: it.id, k: it.k, c: it.c, t: it.t, holder, model, x, z, cell: -1, tx: x, tz: z, pop: 1, delay: 0, hop: null, lift: 0, squash: 0, shake: 0, ph: hash3(it.id, 3) * 6.28, it, pips: null, aura: null };
        if (it.k === 'gen') {
            const pg = new THREE.Group();
            e.pips = [];
            for (let i = 0; i < GEN.max; i++) {
                const a = (i / (GEN.max - 1) - 0.5) * 2.0;
                const m = new THREE.Mesh(PIP_GEO, PIP_OFF);
                m.position.set(Math.sin(a) * 0.58, 0.1, Math.cos(a) * 0.5 + 0.05);
                pg.add(m);
                e.pips.push(m);
            }
            holder.add(pg);
        } else if (it.t >= 6) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02;
            holder.add(ring);
            e.aura = ring;
        }
        holder.position.set(x, TOP, z);
        this.scene.add(holder);
        return e;
    }
    _drop(e) {
        this.scene.remove(e.holder);
    }
    _findCell(G, id) {
        for (let i = 0; i < G.cells.length; i++) if (G.cells[i] && G.cells[i].id === id) return i;
        return -1;
    }

    /** Throw the current picture away and rebuild it from G with no animation (a new game, a load). */
    reset(G) {
        for (const e of this.items.values()) this._drop(e);
        for (const g of this.ghosts) this._drop(g);
        this.items.clear();
        this.ghosts.length = 0;
        this.timers.length = 0;
        this.drag = null;
        this.instant = true;
        this.openKnown = false;
        this.sync(G, 0);
        this.instant = false;
    }

    sync(G, dt) {
        const seen = new Set();
        for (let i = 0; i < N; i++) {
            const it = G.cells[i];
            if (!it) continue;
            seen.add(it.id);
            let e = this.items.get(it.id);
            if (!e) {
                e = this._make(it, cellX(i), cellZ(i));
                if (!this.instant) { e.pop = 0; e.delay = 0; }
                this.items.set(it.id, e);
            }
            e.it = it; e.cell = i; e.tx = cellX(i); e.tz = cellZ(i);
        }
        for (const [id, e] of this.items) if (!seen.has(id)) { this._drop(e); this.items.delete(id); if (this.drag && this.drag.entry === e) this.drag = null; }
        void dt;
    }

    // ------------------------------------------------------------------ events

    /** `hooks.cardPoint(slot)` gives the screen position of a guest's card, for items flying to be served. */
    onEvents(G, events, hooks = {}) {
        for (const ev of events) {
            switch (ev.type) {
                case 'spawn': {
                    const it = G.cells[ev.cell];
                    if (!it || it.id !== ev.id) break;
                    const e = this._make(it, cellX(ev.from), cellZ(ev.from));
                    e.cell = ev.cell; e.tx = cellX(ev.cell); e.tz = cellZ(ev.cell);
                    e.pop = 0;
                    e.hop = { t: 0, dur: 0.38, sx: cellX(ev.from), sz: cellZ(ev.from) };
                    this.items.set(it.id, e);
                    const g = [...this.items.values()].find((q) => q.k === 'gen' && q.cell === ev.from);
                    if (g) g.squash = 1;
                    this.fx.burst(cellX(ev.from), TOP + 0.5, cellZ(ev.from), { n: 4, power: 1.4, size: 0.7, sparks: 4 });
                    break;
                }
                case 'basket': {
                    const it = G.cells[ev.cell];
                    if (!it) break;
                    const e = this._make(it, cellX(ev.cell), cellZ(ev.cell));
                    e.cell = ev.cell; e.pop = 0; e.delay = 0.05;
                    e.hop = { t: 0, dur: 0.5, sx: cellX(ev.cell), sz: cellZ(ev.cell) - 3.5 };
                    this.items.set(it.id, e);
                    this.fx.burst(cellX(ev.cell), TOP + 0.5, cellZ(ev.cell), { n: 16, power: 2.5 });
                    break;
                }
                case 'merge': {
                    const tx = cellX(ev.cell), tz = cellZ(ev.cell);
                    for (const id of ev.ids) {
                        const e = this.items.get(id);
                        if (!e) continue;
                        this.items.delete(id);
                        if (this.drag && this.drag.entry === e) this.drag = null;
                        this.ghosts.push({ e, type: 'merge', t: 0, dur: 0.13, fx: e.holder.position.x, fy: e.holder.position.y, fz: e.holder.position.z, tx, tz });
                    }
                    const it = G.cells[ev.cell];
                    if (it && it.id === ev.id) {
                        const e = this._make(it, tx, tz);
                        e.cell = ev.cell; e.pop = 0; e.delay = 0.1;
                        this.items.set(it.id, e);
                    }
                    this.timers.push({ t: 0.1, fn: () => {
                        const big = ev.t >= 5;
                        this.fx.burst(tx, TOP + 0.45, tz, { n: 8 + ev.t * 4, power: 2 + ev.t * 0.35, size: 1 + ev.t * 0.08, sparks: 4 + ev.t * 2 });
                        this.fx.ring(tx, TOP + 0.03, tz, ev.t >= 6 ? 0xffe27a : 0xffffff, 1.2 + ev.t * 0.25, 0.5);
                        if (big) this.fx.ring(tx, TOP + 0.05, tz, 0xffb52e, 2.2 + ev.t * 0.2, 0.75);
                        if (!this.calm) this.shake = Math.max(this.shake, ev.t >= 5 ? 0.5 : 0.1 + ev.t * 0.03);
                    } });
                    break;
                }
                case 'compost': {
                    const e = [...this.items.values()].find((q) => q.cell === ev.cell && q.c === ev.c && q.t === ev.t);
                    if (e) {
                        this.items.delete(e.id);
                        if (this.drag && this.drag.entry === e) this.drag = null;
                        this.ghosts.push({ e, type: 'compost', t: 0, dur: 0.4, fx: e.holder.position.x, fy: e.holder.position.y, fz: e.holder.position.z });
                    }
                    this.fx.burst(cellX(ev.cell), TOP + 0.3, cellZ(ev.cell), { n: 8, power: 1.3, colors: [0x6a3f22, 0x4a2c18, 0x6d9c2e], sparks: 0 });
                    break;
                }
                case 'serve': {
                    const cp = hooks.cardPoint ? hooks.cardPoint(ev.slot) : null;
                    const target = cp ? this.pointToWorld(cp.x, cp.y, 2.2) : null;
                    ev.taken.forEach((tk, k) => {
                        const e = [...this.items.values()].find((q) => q.cell === tk.cell && q.c === tk.c && q.t === tk.t);
                        if (!e) return;
                        this.items.delete(e.id);
                        if (this.drag && this.drag.entry === e) this.drag = null;
                        this.ghosts.push({ e, type: 'serve', t: -k * 0.07, dur: 0.6, fx: e.holder.position.x, fy: e.holder.position.y, fz: e.holder.position.z, tx: target ? target.x : cellX(tk.cell), ty: target ? target.y : 3, tz: target ? target.z : cellZ(tk.cell) - 3 });
                        this.fx.burst(cellX(tk.cell), TOP + 0.4, cellZ(tk.cell), { n: 6, power: 1.8, sparks: 6 });
                    });
                    break;
                }
                case 'move': case 'swap': {
                    const cell = ev.to;
                    this.fx.ring(cellX(cell), TOP + 0.03, cellZ(cell), 0xfff1c0, 0.7, 0.3);
                    break;
                }
                case 'denied': {
                    if (ev.cell !== undefined) { const g = [...this.items.values()].find((q) => q.cell === ev.cell); if (g) g.shake = 1; }
                    break;
                }
                case 'goal': this.fx.rain(0, 0, 6, 26); break;
                case 'chapter': this.fx.rain(0, 0, 7, 70); break;
                case 'win':
                    this.fx.rain(0, 0, 8, 220);
                    this.timers.push({ t: 0.6, fn: () => this.fx.rain(0, 0, 8, 200) }, { t: 1.2, fn: () => this.fx.rain(0, 0, 8, 160) });
                    break;
                case 'upgrade': this.shake = this.calm ? 0 : 0.35; this.fx.rain(0, 0, 6, 50); break;
                default: break;
            }
        }
    }

    get busy() { return this.ghosts.length > 0 || this.timers.length > 0; }

    // ------------------------------------------------------------------ the frame

    frame(G, dt, time) {
        this.time = time;
        this.resize();
        this.sync(G, dt);

        for (let k = this.timers.length - 1; k >= 0; k--) {
            const tm = this.timers[k];
            tm.t -= dt;
            if (tm.t <= 0) { this.timers.splice(k, 1); tm.fn(); }
        }

        // the covers come off cells as a table grows
        const kOpen = 1 - Math.exp(-dt * 5);
        const fresh = [];
        for (let i = 0; i < N; i++) {
            const target = isOpen(G, i) ? 1 : 0;
            if (!this.openKnown) this.cellOpen[i] = target;
            else {
                const before = this.cellOpen[i];
                this.cellOpen[i] += (target - before) * kOpen;
                if (before < 0.5 && this.cellOpen[i] >= 0.5 && target === 1) fresh.push(i);
            }
            const o = this.cellOpen[i];
            const sy = 0.35 + 0.65 * o;
            dummy.position.set(cellX(i), 0.1 + 0.05 * sy, cellZ(i));
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, sy, 1);
            dummy.updateMatrix();
            this.cells.setMatrixAt(i, dummy.matrix);
            const light = (colOf(i) + rowOf(i)) & 1;
            tmpColor.set(light ? 0xfff3da : 0xf7e1b8).lerp(COVERED, 1 - o);
            this.cells.setColorAt(i, tmpColor);
            const lk = Math.max(0, 1 - o * 1.6);
            dummy.position.set(cellX(i), 0.15 + 0.1 * sy + 0.03, cellZ(i) + 0.1);
            dummy.scale.setScalar(Math.max(0.0001, lk));
            dummy.updateMatrix();
            this.lockBody.setMatrixAt(i, dummy.matrix);
            dummy.position.set(cellX(i), 0.15 + 0.1 * sy + 0.05, cellZ(i) - 0.03);
            dummy.updateMatrix();
            this.lockLoop.setMatrixAt(i, dummy.matrix);
        }
        this.openKnown = true;
        for (const m of [this.cells, this.lockBody, this.lockLoop]) m.instanceMatrix.needsUpdate = true;
        this.cells.instanceColor.needsUpdate = true;
        for (const i of fresh) {
            this.fx.burst(cellX(i), TOP + 0.2, cellZ(i), { n: 6, power: 1.8 });
            this.fx.ring(cellX(i), TOP + 0.03, cellZ(i), 0xffe27a, 1.0, 0.5);
        }

        // items
        const kGlide = 1 - Math.exp(-dt * 16), kDrag = 1 - Math.exp(-dt * 30);
        for (const e of this.items.values()) {
            const dragged = this.drag && this.drag.entry === e;
            const selected = this.marks.selected === e.cell && !dragged;
            let tx = e.tx, tz = e.tz;
            if (dragged) { tx = this.drag.wx; tz = this.drag.wz; }
            const k = dragged ? kDrag : kGlide;
            e.x += (tx - e.x) * k;
            e.z += (tz - e.z) * k;
            let arc = 0;
            if (e.hop) {
                e.hop.t += dt / e.hop.dur;
                const p = Math.min(1, e.hop.t);
                e.x = e.hop.sx + (e.tx - e.hop.sx) * outCubic(p);
                e.z = e.hop.sz + (e.tz - e.hop.sz) * outCubic(p);
                arc = Math.sin(p * Math.PI) * 0.65;
                if (p >= 1) e.hop = null;
            }
            let s = 1;
            if (e.delay > 0) { e.delay -= dt; s = 0.0001; } else if (e.pop < 1) { e.pop = Math.min(1, e.pop + dt / 0.38); s = Math.max(0.0001, outBack(e.pop)); }
            e.lift += ((dragged ? 0.55 : selected ? 0.22 : 0) - e.lift) * (1 - Math.exp(-dt * 14));
            const bob = this.calm || dragged ? 0 : Math.sin(time * 2.1 + e.ph) * 0.014;
            let sy = 1;
            if (e.squash > 0) { e.squash = Math.max(0, e.squash - dt * 3.5); sy = 1 - Math.sin(e.squash * Math.PI) * 0.16; }
            const sc = s * (dragged ? 1.14 : 1);
            e.holder.position.set(e.x, TOP + e.lift + bob + arc, e.z);
            e.holder.scale.set(sc / Math.sqrt(sy), sc * sy, sc / Math.sqrt(sy));
            e.holder.rotation.z = selected && !this.calm ? Math.sin(time * 9) * 0.07 : dragged ? (tx - e.x) * -0.4 : 0;
            if (e.shake > 0) { e.shake = Math.max(0, e.shake - dt * 2.5); e.holder.position.x += Math.sin(time * 70) * 0.05 * e.shake; }
            if (e.aura) { e.aura.rotation.z += dt * 0.8; e.aura.material.opacity = 0.35 + 0.25 * Math.sin(time * 3 + e.ph); }
            if (e.pips && e.it) {
                const ch = e.it.ch, part = ch < GEN.max ? e.it.tm / GEN.regen : 0;
                e.pips.forEach((m, i) => {
                    const on = i < ch;
                    m.material = on ? PIP_ON : PIP_OFF;
                    m.scale.setScalar(on ? 1 : i === ch ? 0.45 + part * 0.5 : 0.45);
                });
            }
        }

        // ghosts: the two halves of a merge, a served dish flying to its guest, a composted scrap
        for (let g = this.ghosts.length - 1; g >= 0; g--) {
            const gh = this.ghosts[g];
            gh.t += dt / gh.dur;
            if (gh.t < 0) continue;
            const p = Math.min(1, gh.t), h = gh.e.holder;
            if (gh.type === 'merge') {
                const q = outCubic(p);
                h.position.set(gh.fx + (gh.tx - gh.fx) * q, gh.fy + (TOP + 0.1 - gh.fy) * q, gh.fz + (gh.tz - gh.fz) * q);
                h.scale.setScalar(1 - 0.5 * p);
            } else if (gh.type === 'serve') {
                const q = p * p * (3 - 2 * p);
                h.position.set(gh.fx + (gh.tx - gh.fx) * q, gh.fy + (gh.ty - gh.fy) * q + Math.sin(p * Math.PI) * 0.9, gh.fz + (gh.tz - gh.fz) * q);
                h.scale.setScalar(Math.max(0.05, 1 - 0.8 * q));
                h.rotation.y += dt * 9;
            } else {
                h.position.y = gh.fy + Math.sin(p * Math.PI) * 0.3;
                h.scale.setScalar(Math.max(0.0001, 1 - p));
                h.rotation.y += dt * 12;
            }
            if (p >= 1) { this._drop(gh.e); this.ghosts.splice(g, 1); }
        }

        this.updateMarks(G, time);
        this.flames.forEach((f, i) => { const k = 1 + Math.sin(time * (9 + i) + i * 2) * 0.08; f.scale.y = (i % 2 ? 1 : 1.7) * k; });
        this.fx.update(dt, time);

        // camera shake, then draw
        this.shake = Math.max(0, this.shake - dt * 2.2);
        const cam = this.camera;
        cam.position.copy(this.camBase);
        if (this.shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(this.shake * 0.16));
        this.renderer.render(this.scene, cam);
    }

    updateMarks(G, time) {
        const m = this.marks, rings = this.mrings;
        let n = 0;
        const put = (cell, color, op, size = 1, pulse = 0) => {
            if (cell < 0 || n >= rings.length) return;
            const r = rings[n++];
            r.visible = true;
            r.position.set(cellX(cell), TOP + 0.025, cellZ(cell));
            r.material.color.set(color);
            r.material.opacity = op * (1 - pulse + pulse * (0.55 + 0.45 * Math.sin(time * 6)));
            r.scale.setScalar(size * (1 + pulse * 0.06 * Math.sin(time * 6)));
        };
        const dc = this.dragCell();
        for (const t of m.targets) put(t, 0x7ce05a, 0.95, 1.02, 1);
        for (const h of m.hint) put(h, 0xffd24a, 0.95, 1.05, 1);
        if (dc >= 0 && isOpen(G, dc)) put(dc, m.targets.includes(dc) ? 0xb6ff8f : 0xffffff, 1, 1.08);
        if (m.selected >= 0) put(m.selected, 0xffffff, 1, 1.06, 1);
        if (m.cursor >= 0) put(m.cursor, 0xffb52e, 1, 1.1, 1);
        else if (m.hover >= 0 && !this.drag) put(m.hover, 0xfff1c0, 0.7, 1.0);
        for (; n < rings.length; n++) { rings[n].visible = false; }
    }

    // ------------------------------------------------------------------ icons

    /** A small picture of an item, drawn with the same models as the board. Cached. Returns a data URL. */
    icon(c, t, size = 96) {
        const key = `${c}:${t}:${size}`;
        let url = this.iconCache.get(key);
        if (url) return url;
        const S = size * 2;
        if (!this.iconRT) {
            this.iconRT = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
            this.iconRT.texture.colorSpace = THREE.SRGBColorSpace;
            this.iconScene = new THREE.Scene();
            this.iconScene.add(new THREE.HemisphereLight(0xfff0d9, 0x7b5a40, 1.5));
            const d = new THREE.DirectionalLight(0xffe8c0, 2.4);
            d.position.set(-2, 5, 4);
            this.iconScene.add(d);
            this.iconCam = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
        }
        if (this.iconRT.width !== S) this.iconRT.setSize(S, S);
        const model = getModel(c, t);
        this.iconScene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() * 0.5;
        const dist = rad / Math.sin((26 * Math.PI) / 360) * 1.02;
        this.iconCam.position.copy(ctr).addScaledVector(new THREE.Vector3(0, 0.72, 1).normalize(), dist);
        this.iconCam.lookAt(ctr);
        const r = this.renderer;
        const prevTarget = r.getRenderTarget(), prevColor = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
        r.setRenderTarget(this.iconRT);
        r.setClearColor(0x000000, 0);
        r.clear();
        r.render(this.iconScene, this.iconCam);
        const buf = new Uint8Array(S * S * 4);
        r.readRenderTargetPixels(this.iconRT, 0, 0, S, S, buf);
        r.setRenderTarget(prevTarget);
        r.setClearColor(prevColor, prevAlpha);
        this.iconScene.remove(model);
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d');
        const img = g.createImageData(S, S);
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const si = ((S - 1 - y) * S + x) * 4, di = (y * S + x) * 4, a = buf[si + 3];
                const k = a > 0 ? 255 / a : 0;                       // the target holds premultiplied colour
                img.data[di] = Math.min(255, buf[si] * k);
                img.data[di + 1] = Math.min(255, buf[si + 1] * k);
                img.data[di + 2] = Math.min(255, buf[si + 2] * k);
                img.data[di + 3] = a;
            }
        }
        g.putImageData(img, 0, 0);
        url = cv.toDataURL('image/png');
        this.iconCache.set(key, url);
        return url;
    }
}

export { mat };
