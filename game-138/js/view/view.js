// The three.js view. Two cameras over the same level meshes:
//   build: an orbiting diorama camera over the selected level (levels slide past each other as the depth slider moves)
//   walk:  first person, from G (x, z, yaw, pitch), under the ceiling, by lantern light
// Reads G and the dungeon; never changes them. Turns sim events into hearts, sparkles and splashes.

import * as THREE from 'three';
import { MICRO as M, WALL_H, LEVEL_GAP, WALK } from '../config.js';
import { buildLevel } from './levelmesh.js';
import { LOOKS, clock, glowTexture, setPom, allThemeMaterials } from './materials.js';
import { proto, loadModels } from './models.js';
import { ELEMENTS } from '../sim/data/elements.js';

const POOL = 10;                 // point lights, made once: a changing light count recompiles every material (game-136)
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x1a1410, 400, 900);
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 900);
        this.mode = 'build';
        this.levels = [];            // built levels: { L, group, ceiling, lights, flames, splashes, feats }
        this.cur = 0;                // the level shown
        this.trans = null;           // { from, to, t }
        this.orbit = { theta: 0.55, phi: 0.92, r: 80, target: new THREE.Vector3(), goal: { theta: 0.55, phi: 0.92, r: 80, target: new THREE.Vector3() } };
        this.fx = [];                // short-lived sprites: hearts, coins, poofs
        this.inset = { left: 0, bottom: 0 };   // screen covered by the workbench: the picture centres in the rest
        this.flash = 0;

        // ---- lights: a warm sky, a soft key for the diorama, a pool of point lights and the explorer's lantern
        this.hemi = new THREE.HemisphereLight(0xffe2c0, 0x3a2a20, 1.1);
        this.key = new THREE.DirectionalLight(0xfff0dc, 1.6);
        this.key.position.set(-40, 80, 30);
        this.scene.add(this.hemi, this.key, this.key.target);
        this.pool = [];
        for (let i = 0; i < POOL; i++) {
            const l = new THREE.PointLight(0xffaa66, 0, 10, 1.6);
            this.scene.add(l);
            this.pool.push(l);
        }
        this.lantern = new THREE.PointLight(0xffc98a, 0, 12, 1.4);
        this.scene.add(this.lantern);

        // ---- the backdrop: a warm dusk gradient behind the diorama
        const bg = document.createElement('canvas');
        bg.width = 2; bg.height = 256;
        const g = bg.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#2b1d2e'); gr.addColorStop(0.55, '#4a2f2c'); gr.addColorStop(1, '#6b4632');
        g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
        this.bgTex = new THREE.CanvasTexture(bg);
        this.bgTex.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = this.bgTex;

        // ---- floating motes over the diorama (fireflies), and the flame and sparkle sprites
        this.glow = glowTexture();
        this.motes = this.makeMotes();
        this.scene.add(this.motes);
        this.flameGroup = new THREE.Group();
        this.scene.add(this.flameGroup);

        // ---- the cursor: a glowing column over the pointed cell, and the pins overlay
        this.cursor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.25, depthWrite: false }));
        this.cursor.visible = false;
        this.cursor.renderOrder = 5;
        this.cursorEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 }));
        this.cursor.add(this.cursorEdge);
        this.scene.add(this.cursor);
        this.pinMesh = null;
        this.markers = new THREE.Group();
        this.scene.add(this.markers);

        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.tmpM = new THREE.Matrix4();
        this.tmpQ = new THREE.Quaternion();
        this.tmpV = new THREE.Vector3();
        this.tmpS = new THREE.Vector3();

        loadModels(() => this.rebuildFeatures());
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.applyInset();
        if (this.d) this.frameLevel(true);
    }

    /** Shift the projection so the scene's centre sits in the middle of the uncovered part of the screen. */
    setInset(left, bottom) {
        if (left === this.inset.left && bottom === this.inset.bottom) return;
        this.inset = { left, bottom };
        this.applyInset();
    }
    applyInset() {
        const { left, bottom } = this.mode === 'walk' ? { left: 0, bottom: 0 } : this.inset;
        if (left || bottom) this.camera.setViewOffset(this.w + left, this.h + bottom, 0, bottom, this.w, this.h);
        else this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
    }

    makeMotes() {
        const n = 90, pos = new Float32Array(n * 3);
        this.moteSeed = Float32Array.from({ length: n * 3 }, (_, i) => ((i * 9301 + 49297) % 233280) / 233280);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glow, color: 0xffd98a, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.frustumCulled = false;
        return m;
    }

    // ------------------------------------------------------------------ the dungeon
    /** A new dungeon (or a changed one): rebuild every level's meshes. keepView keeps the camera where it is. */
    setDungeon(d, params, cur = 0, keepView = false) {
        for (const lv of this.levels) { this.scene.remove(lv.group); disposeGroup(lv.group); }
        this.d = d;
        this.params = params;
        this.levels = d.levels.map((L) => {
            const b = buildLevel(L);
            b.L = L;
            b.group.visible = false;
            this.scene.add(b.group);
            this.addFeatures(b);
            return b;
        });
        this.cur = Math.min(cur, this.levels.length - 1);
        this.trans = null;
        this.levels[this.cur].group.visible = true;
        this.levels[this.cur].group.position.y = 0;
        this.buildFlames();
        this.buildMarkers();
        this.setPins(params);
        this.applyLook();
        this.frameLevel(!keepView);
    }

    rebuildFeatures() {
        for (const lv of this.levels) {
            if (lv.feats) { lv.group.remove(lv.feats); lv.feats.traverse((o) => o.isInstancedMesh && o.dispose()); }
            this.addFeatures(lv);
        }
    }

    /** One InstancedMesh per kind of element on a level; monsters keep a list for their idle animation. */
    addFeatures(lv) {
        const byKind = {};
        for (const f of lv.L.features) if (ELEMENTS[f.kind]) (byKind[f.kind] ||= []).push(f);
        const feats = new THREE.Group();
        feats.name = 'features';
        lv.anim = [];
        lv.inst = {};
        for (const [kind, list] of Object.entries(byKind)) {
            const p = proto(kind);
            const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
            im.name = kind;
            list.forEach((f, i) => {
                const base = { x: (f.mx + 0.5) * M, z: (f.my + 0.5) * M, rot: f.rot, s: p.fit, y: -p.minY * p.fit };
                this.setInstance(im, i, base, 1, 0);
                if (ELEMENTS[kind].cat === 'monsters') lv.anim.push({ im, i, base, f, phase: (f.mx * 13 + f.my * 7) % 10, hop: 0 });
            });
            im.instanceMatrix.needsUpdate = true;
            im.computeBoundingSphere();
            feats.add(im);
            lv.inst[kind] = { im, list };
        }
        lv.feats = feats;
        lv.group.add(feats);
    }

    setInstance(im, i, b, sy, lift) {
        this.tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, b.rot);
        this.tmpS.set(b.s * (2 - sy) ** 0.5, b.s * sy, b.s * (2 - sy) ** 0.5);
        this.tmpV.set(b.x, b.y + lift, b.z);
        this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
        im.setMatrixAt(i, this.tmpM);
    }

    /** Flames over every fire on the shown level (sprites), rebuilt when the level changes. */
    buildFlames() {
        for (const c of [...this.flameGroup.children]) { this.flameGroup.remove(c); c.material.dispose(); }
        const lv = this.levels[this.cur];
        if (!lv) return;
        this.flames = [];
        for (const f of lv.flames) {
            for (let k = 0; k < 2; k++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: k ? 0xffe28a : 0xff7a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
                s.position.set(f.x, f.y + k * 0.08, f.z);
                s.userData = { base: f, k, seed: Math.random() * 10 };
                this.flameGroup.add(s);
                this.flames.push(s);
            }
        }
    }

    /** Lantern signs bobbing over the stairs in the builder. */
    buildMarkers() {
        for (const c of [...this.markers.children]) { this.markers.remove(c); c.material.map?.dispose(); c.material.dispose(); }
        const L = this.levels[this.cur]?.L;
        if (!L) return;
        const mk = (s, label, col) => {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const g = c.getContext('2d');
            g.fillStyle = col; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
            g.lineWidth = 8; g.strokeStyle = '#fff6e5'; g.stroke();
            g.fillStyle = '#fff6e5'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(label, 64, 70);
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
            sp.scale.setScalar(0.05);
            sp.position.set((s.mx + 0.5) * M, WALL_H + 2.4, (s.my + 0.5) * M);
            sp.renderOrder = 10;
            sp.userData.y = sp.position.y;
            this.markers.add(sp);
        };
        mk(L.up, '▲', L.k === 0 ? '#5c9a5c' : '#c9822e');
        if (L.down) mk(L.down, '▼', '#8a5cc9');
    }

    /** Painted cells, tinted by brush, so the player sees what they pinned. */
    setPins(params) {
        if (this.pinMesh) { this.scene.remove(this.pinMesh); this.pinMesh.geometry.dispose(); this.pinMesh = null; }
        const pins = params.pins.filter((p) => p.l === this.cur);
        if (!pins.length) return;
        const COL = { chamber: 0xffd27a, tunnel: 0xc9a27a, water: 0x6ad8ff, well: 0xb0b0ff, rock: 0xa08070 };
        const pos = [], col = [];
        const c = new THREE.Color();
        for (const p of pins) {
            const x0 = p.x * 3 * M + 0.3, z0 = p.y * 3 * M + 0.3, x1 = (p.x + 1) * 3 * M - 0.3, z1 = (p.y + 1) * 3 * M - 0.3, y = WALL_H + 0.06;
            pos.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0);
            c.set(COL[p.b]);
            for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.pinMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false }));
        this.pinMesh.renderOrder = 4;
        this.pinMesh.visible = this.mode === 'build';
        this.scene.add(this.pinMesh);
    }

    // ------------------------------------------------------------------ levels and modes
    /** Show level k in the builder: the old level slides up and away, the new one rises into place. */
    showLevel(k, animate = true) {
        if (k === this.cur || !this.levels[k]) return;
        const from = this.cur;
        this.cur = k;
        if (this.trans) { this.levels[this.trans.from].group.visible = false; }
        this.levels[k].group.visible = true;
        this.trans = animate && this.mode === 'build' ? { from, to: k, t: 0, dir: k > from ? 1 : -1 } : null;
        if (!this.trans) { this.levels[from].group.visible = false; this.levels[k].group.position.y = 0; }
        this.buildFlames();
        this.buildMarkers();
        this.setPins(this.params);
        this.applyLook();
    }

    applyLook() {
        const lv = this.levels[this.cur];
        if (!lv) return;
        const look = LOOKS[lv.L.theme];
        this.look = look;
        this.motes.material.color.set(lv.L.theme === 'grotto' ? 0xd0a0ff : lv.L.theme === 'frost' ? 0xd8f0ff : 0xffd98a);
        if (this.mode === 'walk') {
            this.scene.fog.color.set(look.fog);
            this.scene.background = new THREE.Color(look.fog);
        }
    }

    setMode(mode) {
        this.mode = mode;
        const walk = mode === 'walk';
        for (const lv of this.levels) {
            lv.ceiling.visible = walk;
            lv.group.position.y = 0;
            lv.group.visible = lv === this.levels[this.cur];
        }
        this.trans = null;
        this.markers.visible = !walk;
        this.motes.visible = !walk;
        if (this.pinMesh) this.pinMesh.visible = !walk;
        this.cursor.visible = false;
        this.key.intensity = walk ? 0 : 1.6;
        this.hemi.intensity = walk ? 0.32 : 1.1;
        this.lantern.intensity = walk ? 14 : 0;
        this.camera.fov = walk ? 70 : 42;
        this.camera.near = walk ? 0.05 : 0.5;
        this.applyInset();
        if (walk) {
            this.scene.fog.near = 3; this.scene.fog.far = 30;
            this.applyLook();
        } else {
            this.scene.fog.near = 400; this.scene.fog.far = 900;
            this.scene.fog.color.set(0x1a1410);
            this.scene.background = this.bgTex;
        }
    }

    // ------------------------------------------------------------------ the builder camera
    /** Fit the level in view (snap: jump there; otherwise ease). */
    frameLevel(snap = false) {
        if (!this.d) return;
        const L = this.levels[this.cur]?.L;
        // fit the part of the level that is dungeon, not the solid rock around it
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        if (L) for (let y = 0; y < L.mh; y++) for (let x = 0; x < L.mw; x++) {
            if (L.grid[y][x] === '#') continue;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); z0 = Math.min(z0, y); z1 = Math.max(z1, y + 1);
        }
        if (!isFinite(x0)) { x0 = 0; z0 = 0; x1 = this.d.mw; z1 = this.d.mh; }
        const W = (x1 - x0) * M + 6, H = (z1 - z0) * M + 6;
        const o = this.orbit.goal;
        o.target.set((x0 + x1) / 2 * M, 0, (z0 + z1) / 2 * M);
        const aspect = Math.max(0.5, (this.w - this.inset.left) / Math.max(1, this.h - this.inset.bottom));
        // the footprint seen from the camera's tilt: depth foreshortens by cos(phi)
        const fit = Math.max(W / aspect, H * Math.cos(o.phi) + WALL_H) * 1.0 + 4;
        o.r = Math.max(24, fit / Math.tan((this.camera.fov * Math.PI) / 360) * 0.55);
        if (snap) { Object.assign(this.orbit, { theta: o.theta, phi: o.phi, r: o.r }); this.orbit.target.copy(o.target); }
        this.maxR = Math.max(this.d.mw, this.d.mh) * M * 2.2;
    }
    rotate(dx, dy) {
        const o = this.orbit.goal;
        o.theta -= dx * 0.006;
        o.phi = Math.max(0.18, Math.min(1.35, o.phi - dy * 0.005));
    }
    zoom(f) {
        const o = this.orbit.goal;
        o.r = Math.max(12, Math.min(this.maxR || 300, o.r * f));
    }
    pan(dx, dy) {
        const o = this.orbit.goal;
        const k = o.r * 0.0016;
        const s = Math.sin(o.theta), c = Math.cos(o.theta);
        o.target.x += (-c * dx - s * dy) * k;
        o.target.z += (s * dx - c * dy) * k;
        if (this.d) {
            o.target.x = Math.max(0, Math.min(this.d.mw * M, o.target.x));
            o.target.z = Math.max(0, Math.min(this.d.mh * M, o.target.z));
        }
    }

    // ------------------------------------------------------------------ picking
    /** The micro cell under a screen point on the shown level, or null. */
    pick(clientX, clientY) {
        const lv = this.levels[this.cur];
        if (!lv || this.mode !== 'build') return null;
        const r = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const targets = lv.group.children.filter((m) => m.isMesh && ['floor', 'cap', 'wall', 'under', 'trim'].includes(m.name));
        const hit = this.raycaster.intersectObjects(targets, false)[0];
        if (!hit) return null;
        // nudge into the surface so a wall hit counts as the rock behind it
        const p = hit.point.clone().addScaledVector(hit.face.normal, -0.05);
        const mx = Math.floor(p.x / M), my = Math.floor(p.z / M);
        if (mx < 0 || my < 0 || mx >= lv.L.mw || my >= lv.L.mh) return null;
        return { mx, my, cx: Math.floor(mx / 3), cy: Math.floor(my / 3) };
    }

    /** Show the cursor over a micro cell ('micro') or a whole WFC cell ('cell'); null hides it. */
    setCursor(c, kind = 'cell', ok = true) {
        if (!c || this.mode !== 'build') { this.cursor.visible = false; return; }
        const size = kind === 'cell' ? 3 * M : M;
        const x = kind === 'cell' ? c.cx * 3 * M : c.mx * M, z = kind === 'cell' ? c.cy * 3 * M : c.my * M;
        this.cursor.visible = true;
        this.cursor.position.set(x + size / 2, WALL_H / 2 + 0.1, z + size / 2);
        this.cursor.scale.set(size - 0.1, WALL_H + 0.3, size - 0.1);
        this.cursor.material.color.set(ok ? 0xffd27a : 0xff7a6a);
        this.cursorEdge.material.color.set(ok ? 0xffe9b0 : 0xffb0a0);
    }

    // ------------------------------------------------------------------ effects
    burst(x, y, z, kind) {
        const n = kind === 'heart' ? 6 : kind === 'coin' ? 10 : 8;
        for (let i = 0; i < n; i++) {
            const tex = kind === 'heart' ? heartTexture() : this.glow;
            const col = kind === 'heart' ? 0xff8fa8 : kind === 'coin' ? 0xffd860 : kind === 'splash' ? 0xbfeaff : 0xfff2c8;
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: kind === 'heart' ? THREE.NormalBlending : THREE.AdditiveBlending }));
            const a = (i / n) * Math.PI * 2;
            s.position.set(x, y, z);
            s.userData = { vx: Math.cos(a) * (0.6 + (i % 3) * 0.3), vy: 1.6 + (i % 4) * 0.4, vz: Math.sin(a) * (0.6 + (i % 2) * 0.4), life: 1.2, max: 1.2, size: kind === 'heart' ? 0.45 : 0.3 };
            this.scene.add(s);
            this.fx.push(s);
        }
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'befriend') {
                this.burst(e.x, 1.6, e.z, 'heart');
                const lv = this.levels[G.lv];
                const a = lv?.anim.find((m) => m.f.id === e.id);
                if (a) a.hop = 1;
            } else if (e.type === 'loot') this.burst(e.x, 1, e.z, 'coin');
            else if (e.type === 'splash') this.burst(e.x, 0, e.z, 'splash');
            else if (e.type === 'stairs' || e.type === 'exit') { this.showLevel(G.lv, false); this.flash = 1; }
        }
    }

    // ------------------------------------------------------------------ lights
    updateLights(fx, fz, time) {
        const lv = this.levels[this.cur];
        const list = lv ? lv.lights : [];
        const near = list.map((l) => ({ l, d: (l.x - fx) ** 2 + (l.z - fz) ** 2 })).sort((a, b) => a.d - b.d);
        const walk = this.mode === 'walk';
        for (let i = 0; i < POOL; i++) {
            const p = this.pool[i], n = near[i];
            if (!n) { p.intensity = 0; continue; }
            const l = n.l;
            p.position.set(l.x, l.y, l.z);
            p.color.set(l.color);
            p.distance = l.range * (walk ? 1.5 : 1.8);
            const fl = 1 + Math.sin(time * 9 + l.x * 3) * 0.08 * l.fire + Math.sin(time * 23 + l.z) * 0.05 * l.fire;
            p.intensity = (walk ? 14 : 22) * fl * (l.kind === 'torch' ? 1 : 0.8);
        }
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time, tour = null) {
        this.resize();
        clock.value = time;
        const walk = this.mode === 'walk';
        const lv = this.levels[this.cur];

        // level transition in the builder
        if (this.trans) {
            const t = this.trans;
            t.t = Math.min(1, t.t + dt / 0.55);
            const e = easeOut(t.t);
            this.levels[t.to].group.position.y = -t.dir * LEVEL_GAP * 2 * (1 - e);
            this.levels[t.from].group.position.y = t.dir * LEVEL_GAP * 3 * e;
            if (t.t >= 1) { this.levels[t.from].group.visible = false; this.levels[t.from].group.position.y = 0; this.trans = null; }
        }

        let fx, fz;
        if (walk) {
            const bob = Math.sin(G.dist * 3.4) * 0.04;
            this.camera.position.set(G.x, WALK.eye + bob, G.z);
            this.camera.rotation.set(G.pitch, -G.yaw, 0, 'YXZ');
            this.lantern.position.set(G.x + Math.sin(G.yaw) * 0.3, WALK.eye - 0.1, G.z - Math.cos(G.yaw) * 0.3);
            this.lantern.intensity = 14 * (1 + Math.sin(time * 7) * 0.04);
            fx = G.x; fz = G.z;
        } else {
            const o = this.orbit, g = o.goal, k = 1 - Math.exp(-dt * 8);
            o.theta += (g.theta - o.theta) * k; o.phi += (g.phi - o.phi) * k; o.r += (g.r - o.r) * k;
            o.target.lerp(g.target, k);
            if (tour) o.goal.theta += dt * 0.08;
            this.camera.position.set(
                o.target.x + o.r * Math.sin(o.phi) * Math.sin(o.theta),
                o.target.y + o.r * Math.cos(o.phi),
                o.target.z + o.r * Math.sin(o.phi) * Math.cos(o.theta));
            this.camera.lookAt(o.target);
            this.camera.far = o.r * 4 + 100;
            this.camera.updateProjectionMatrix();
            fx = o.target.x; fz = o.target.z;
            // motes drift over the level
            if (this.d) {
                const W = this.d.mw * M, H = this.d.mh * M, pos = this.motes.geometry.attributes.position, s = this.moteSeed;
                for (let i = 0; i < pos.count; i++) {
                    pos.setXYZ(i, s[i * 3] * W + Math.sin(time * 0.3 + i) * 2, WALL_H + 0.5 + s[i * 3 + 1] * 6 + Math.sin(time * 0.7 + i * 1.3) * 0.6, s[i * 3 + 2] * H + Math.cos(time * 0.25 + i) * 2);
                }
                pos.needsUpdate = true;
            }
            for (const m of this.markers.children) m.position.y = m.userData.y + Math.sin(time * 2) * 0.25;
        }
        this.updateLights(fx, fz, time);

        // monsters breathe and bob; a befriended one hops
        if (lv) {
            for (const a of lv.anim) {
                a.hop = Math.max(0, a.hop - dt * 1.4);
                const breathe = 1 + Math.sin(time * 2.2 + a.phase) * (a.f.kind === 'slime' ? 0.06 : 0.025);
                const hop = Math.sin(a.hop * Math.PI * 3) * a.hop * 0.6;
                this.setInstance(a.im, a.i, a.base, breathe, Math.abs(hop));
                a.im.instanceMatrix.needsUpdate = true;
            }
        }
        // flames flicker
        for (const s of this.flames || []) {
            const u = s.userData, f = u.base;
            const k = 1 + Math.sin(time * 13 + u.seed) * 0.12 + Math.sin(time * 29 + u.seed * 3) * 0.08;
            s.scale.setScalar(f.s * (u.k ? 0.55 : 1) * k * 1.4);
            s.position.y = f.y + (u.k ? 0.12 : 0.05) * k + (lv ? lv.group.position.y : 0);
        }
        // short-lived effects
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const s = this.fx[i], u = s.userData;
            u.life -= dt;
            if (u.life <= 0) { this.scene.remove(s); s.material.dispose(); this.fx.splice(i, 1); continue; }
            u.vy -= dt * 2.2;
            s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
            s.scale.setScalar(u.size * (0.6 + 0.4 * u.life / u.max));
            s.material.opacity = Math.min(1, u.life * 2);
        }
        this.renderer.render(this.scene, this.camera);
    }

    setParallax(on) { setPom(allThemeMaterials(), on); }
}

let heartTex = null;
function heartTexture() {
    if (heartTex) return heartTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(32, 54);
    g.bezierCurveTo(4, 36, 6, 10, 22, 10);
    g.bezierCurveTo(29, 10, 32, 16, 32, 18);
    g.bezierCurveTo(32, 16, 35, 10, 42, 10);
    g.bezierCurveTo(58, 10, 60, 36, 32, 54);
    g.fill();
    heartTex = new THREE.CanvasTexture(c);
    heartTex.colorSpace = THREE.SRGBColorSpace;
    return heartTex;
}

function disposeGroup(g) {
    g.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        else if (o.geometry) o.geometry.dispose();
        // theme materials, model materials and shared textures are cached and kept; per-level shader materials go
        if (o.material && o.material.isShaderMaterial) o.material.dispose();
    });
}
