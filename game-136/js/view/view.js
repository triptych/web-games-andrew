// The three.js view. Reads G and answers its events; never writes G.
//
// Build mode: an orthographic isometric camera fitted to the room between the HUD and the shelf,
// zoomable. Photo mode: the same room through an orbiting orthographic or "toy lens" perspective
// camera, with the time of day, a filter and a tilt-shift blur; capture() renders a photo at any
// size into a 2D canvas.

import * as THREE from 'three';
import { KINDS } from '../sim/data/catalog.js';
import { LEVEL } from '../sim/data/levels.js';
import { footprint } from '../sim/room.js';
import { buildModel, ghostOf, GLOWING, ROW, ROW0, WALL_H } from './models.js';
import { buildShell, paneMat, T } from './shell.js';
import { clay, setClayDetail } from './clay.js';
import { Post } from './post.js';

const LIGHTS = 6;   // a fixed pool: changing the number of lights recompiles every material

export const TIMES = {
    morning: { name: 'Morning', sky: [0xcfe3f5, 0xf7e9d4], hemi: [0xe8f0ff, 0x8a7a6a, 1.0], sun: [0xfff0d8, 2.8], sunDir: [-0.6, 1, 0.9], fill: 0.35, lamp: 0.6, glow: 0.35, pane: 0xcfeaff },
    day: { name: 'Day', sky: [0xbfdcf2, 0xf4eadb], hemi: [0xf6f6ff, 0x8a7a6a, 1.15], sun: [0xfff8ee, 3.2], sunDir: [-0.3, 1.2, 0.7], fill: 0.45, lamp: 0.4, glow: 0.25, pane: 0xd8f0ff },
    golden: { name: 'Golden hour', sky: [0xf6c48e, 0xf9e2c4], hemi: [0xffe0b8, 0x7a5a4a, 0.95], sun: [0xffb066, 2.3], sunDir: [-1, 0.55, 0.5], fill: 0.25, lamp: 1.8, glow: 0.9, pane: 0xffc890 },
    night: { name: 'Night', sky: [0x1d2340, 0x3a3358], hemi: [0x6a7ac0, 0x302838, 0.38], sun: [0x8fa0ff, 0.35], sunDir: [-0.4, 1, 0.6], fill: 0.08, lamp: 5.5, glow: 2.4, pane: 0x23305e },
};

function gradient(top, bottom) {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + new THREE.Color(top).getHexString());
    gr.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const sig = (it) => `${it.kind}|${it.size}|${it.variant}|${it.motif}|${it.colors}|${it.lump}`;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.NeutralToneMapping;
        r.toneMappingExposure = 1.0;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x887766, 1.3);
        this.sun = new THREE.DirectionalLight(0xffffff, 2.3);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.02;
        this.sun.shadow.radius = 4;
        this.fill = new THREE.DirectionalLight(0xfff0e0, 0.4);
        this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);
        this.pool = [];
        for (let i = 0; i < LIGHTS; i++) {
            const p = new THREE.PointLight(0xffc98a, 0, 4.5, 1.6);
            this.pool.push(p); this.scene.add(p);
        }

        this.shell = null;
        this.items = new THREE.Group();
        this.scene.add(this.items);
        this.objs = new Map();        // id → { obj, sig, anim, base }
        this.overlay = new THREE.Group();
        this.scene.add(this.overlay);

        // placement helpers
        this.hiMat = new THREE.MeshBasicMaterial({ color: 0x6fd38a, transparent: true, opacity: 0.45, depthWrite: false });
        this.hiBad = new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.45, depthWrite: false });
        this.cells = [];
        this.ghost = null; this.ghostSig = '';
        this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffcc4d }));
        this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
        this.overlay.add(this.ring);
        this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
        this.cursor.rotation.x = -Math.PI / 2; this.cursor.visible = false;
        this.overlay.add(this.cursor);
        this.grid = null;

        // cameras
        this.cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
        this.persp = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
        this.yaw = Math.PI / 4; this.pitch = 0.62; this.zoom = 1; this.pan = new THREE.Vector2();
        this.insets = { top: 70, bottom: 120 };
        this.photoInsets = { top: 60, bottom: 160 };
        this.photo = null;            // { yaw, pitch, zoom, lens, panY } while in photo mode
        this.post = null;
        this.time = 'day';
        this.flick = 0;

        this.ray = new THREE.Raycaster();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.setTime('day');
    }

    // ------------------------------------------------------------------ sizing and the camera
    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.post?.setSize(w, h);
        this.fit();
    }

    setInsets(top, bottom) {
        const k = this.photo ? 'photoInsets' : 'insets';
        if (top === this[k].top && bottom === this[k].bottom) return;
        this[k] = { top, bottom };
        this.fit();
    }

    /** Aim a camera at the room from yaw/pitch, and size it so the whole diorama fits w × h px with the given insets. */
    aim(cam, { yaw, pitch, zoom = 1, w = this.w, h = this.h, top = 0, bottom = 0, panX = 0, panY = 0 }) {
        if (!this.G) return;
        const W = this.G.w, D = this.G.d;
        const centre = new THREE.Vector3((W - T) / 2, WALL_H * 0.3, (D - T) / 2);
        const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        const dist = Math.max(W, D) * 3 + 12;
        cam.position.copy(centre).addScaledVector(dir, dist);
        cam.up.set(0, 1, 0);
        cam.lookAt(centre);
        cam.updateMatrixWorld();
        // the room's corners in camera space
        const pts = [];
        for (const x of [-T - 0.3, W + 0.3]) for (const z of [-T - 0.3, D + 0.3]) for (const y of [-0.75, WALL_H + 0.1]) pts.push(new THREE.Vector3(x, y, z));
        const inv = cam.matrixWorldInverse;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of pts) { p.applyMatrix4(inv); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        const usableH = Math.max(80, h - top - bottom);
        const cw = (x1 - x0) * 1.02, chh = (y1 - y0) * 1.02;
        // world units per pixel: big enough for both directions
        const upp = Math.max(cw / w, chh / usableH) / zoom;
        const viewW = w * upp, viewH = h * upp;
        const cx = (x0 + x1) / 2 + panX, cy = (y0 + y1) / 2 + panY;
        // shift so the room centres in the band between the insets
        const shift = ((top - bottom) / 2) * upp;
        if (cam.isOrthographicCamera) {
            cam.left = cx - viewW / 2; cam.right = cx + viewW / 2;
            cam.top = cy + viewH / 2 + shift; cam.bottom = cy - viewH / 2 + shift;
            cam.near = 0.1; cam.far = dist * 2 + 40;
        } else {
            cam.aspect = w / h;
            const fov = (cam.fov * Math.PI) / 180;
            const need = Math.max(viewH, viewW / cam.aspect) * 0.95;
            const pd = need / 2 / Math.tan(fov / 2);
            cam.position.copy(centre).addScaledVector(dir, pd);
            cam.lookAt(centre);
            cam.near = 0.1; cam.far = pd * 3;
        }
        cam.updateProjectionMatrix();
    }

    fit() {
        if (!this.G) return;
        if (this.photo) {
            const p = this.photo;
            const cam = p.lens === 'toy' ? this.persp : this.cam;
            this.aim(cam, { yaw: p.yaw, pitch: p.pitch, zoom: p.zoom, top: this.photoInsets.top, bottom: this.photoInsets.bottom, panY: p.panY });
            this.post?.setCamera(cam);
        } else this.aim(this.cam, { yaw: this.yaw, pitch: this.pitch, zoom: this.zoom, top: this.insets.top, bottom: this.insets.bottom, panX: this.pan.x, panY: this.pan.y });
    }

    zoomBy(f) {
        if (this.photo) this.photo.zoom = Math.max(0.6, Math.min(3, this.photo.zoom * f));
        else this.zoom = Math.max(0.7, Math.min(3, this.zoom * f));
        if (!this.photo && this.zoom <= 1.01) this.pan.set(0, 0);
        this.fit();
    }
    panBy(dxPx, dyPx) {
        const cam = this.cam;
        const upp = (cam.right - cam.left) / this.w;
        const lim = Math.max(this.G.w, this.G.d) * 0.6 * (this.zoom - 1);
        this.pan.x = Math.max(-lim, Math.min(lim, this.pan.x - dxPx * upp));
        this.pan.y = Math.max(-lim, Math.min(lim, this.pan.y + dyPx * upp));
        this.fit();
    }
    resetCamera() { this.zoom = 1; this.pan.set(0, 0); this.fit(); }

    // ------------------------------------------------------------------ time of day
    setTime(id) {
        const t = TIMES[id] || TIMES.day;
        this.time = id;
        this.scene.background = gradient(t.sky[0], t.sky[1]);
        this.hemi.color.setHex(t.hemi[0]); this.hemi.groundColor.setHex(t.hemi[1]); this.hemi.intensity = t.hemi[2];
        this.sun.color.setHex(t.sun[0]); this.sun.intensity = t.sun[1];
        this.sunDir = new THREE.Vector3(...t.sunDir).normalize();
        this.fill.intensity = t.fill;
        this.lampK = t.lamp;
        for (const m of GLOWING) m.emissiveIntensity = t.glow;
        this.glowK = t.glow;
        paneMat.color.setHex(t.pane); paneMat.emissive.setHex(t.pane);
        this.placeSun();
    }
    placeSun() {
        if (!this.G) return;
        const c = new THREE.Vector3(this.G.w / 2, 0, this.G.d / 2);
        const R = Math.max(this.G.w, this.G.d) + 4;
        // the sun shines in from the front and over the window wall
        this.sun.position.copy(c).addScaledVector(new THREE.Vector3(this.sunDir.x * -1 + 0.6, this.sunDir.y, this.sunDir.z), R);
        this.sun.target.position.copy(c);
        const sc = this.sun.shadow.camera;
        sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 0.1; sc.far = R * 3;
        sc.updateProjectionMatrix();
        this.fill.position.copy(c).add(new THREE.Vector3(R, R * 0.6, R * 0.2));
    }

    // ------------------------------------------------------------------ the room and its things
    setRoom(G) {
        this.G = G;
        if (this.shell) { this.scene.remove(this.shell); }
        for (const o of this.objs.values()) this.items.remove(o.obj);
        this.objs.clear();
        const L = LEVEL[G.level];
        this.shell = buildShell(G, L.look);
        this.scene.add(this.shell);
        if (this.grid) this.overlay.remove(this.grid);
        const pts = [];
        for (let x = 0; x <= G.w; x++) pts.push(x, 0.004, 0, x, 0.004, G.d);
        for (let z = 0; z <= G.d; z++) pts.push(0, 0.004, z, G.w, 0.004, z);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
        this.grid.visible = false;
        this.overlay.add(this.grid);
        this.zoom = 1; this.pan.set(0, 0);
        this.placeSun();
        this.fit();
        this.sync(G);
    }

    /** Where a placed thing stands in the world. */
    pose(it, obj) {
        const at = it.at, K = KINDS[it.kind];
        obj.rotation.set(0, 0, 0);
        if (at.layer === 'wall') {
            const [w, h] = K.fp[it.size];
            const y = ROW0 + (at.v + h / 2) * ROW;
            if (at.wall === 'L') obj.position.set(at.u + w / 2, y, 0.005);
            else { obj.position.set(0.005, y, at.u + w / 2); obj.rotation.y = Math.PI / 2; }
            return;
        }
        if (at.layer === 'top') {
            const host = this.G.items.find((i) => i.id === at.on);
            const hy = host ? KINDS[host.kind].h[host.size] + 0.035 : 0;
            obj.position.set(at.x + 0.5, hy, at.y + 0.5);
            obj.rotation.y = at.rot * Math.PI / 2;
            return;
        }
        const [fw, fd] = footprint(it, at.rot);
        obj.position.set(at.x + fw / 2, at.layer === 'rug' ? 0.002 : 0, at.y + fd / 2);
        obj.rotation.y = at.rot * Math.PI / 2;
    }

    sync(G) {
        this.G = G;
        const live = new Set();
        for (const it of G.items) {
            if (!it.at || (this.hidden === it.id)) continue;
            live.add(it.id);
            let o = this.objs.get(it.id);
            const s = sig(it);
            if (o && o.sig !== s) { this.items.remove(o.obj); o = null; }
            if (!o) {
                const obj = buildModel(it);
                obj.traverse((m) => { m.userData.itemId = it.id; });
                this.items.add(obj);
                o = { obj, sig: s, anim: null };
                this.objs.set(it.id, o);
            }
            this.pose(it, o.obj);
        }
        for (const [id, o] of this.objs) if (!live.has(id)) { this.items.remove(o.obj); this.objs.delete(id); }
    }

    /** Hide a placed thing while it is being moved (its ghost stands in). */
    hide(id) { this.hidden = id; if (this.G) this.sync(this.G); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'level') { this.setRoom(G); continue; }
            if (e.type === 'place' || e.type === 'rotate' || e.type === 'undo' || e.type === 'stow' || e.type === 'clear') this.sync(G);
            const o = this.objs.get(e.id);
            if (o && (e.type === 'place' || e.type === 'rotate')) o.anim = { kind: e.type, t: 0 };
        }
    }

    // ------------------------------------------------------------------ placing
    /** Show where a thing would go: a ghost model and green or red cells. spec null hides it. */
    setGhost(it, spec, at, ok) {
        for (const c of this.cells) this.overlay.remove(c);
        this.cells = [];
        if (!it || !spec) { if (this.ghost) this.overlay.remove(this.ghost); this.ghost = null; this.ghostSig = ''; this.grid.visible = false; return; }
        this.grid.visible = KINDS[it.kind].layer !== 'wall';
        const s = sig(it);
        if (s !== this.ghostSig) {
            if (this.ghost) this.overlay.remove(this.ghost);
            this.ghost = ghostOf(buildModel(it));
            this.ghostSig = s;
            this.overlay.add(this.ghost);
        }
        const K = KINDS[it.kind];
        const show = at || (K.layer === 'wall' ? { layer: 'wall', wall: spec.wall, u: spec.u, v: spec.v } : { layer: K.layer === 'rug' ? 'rug' : 'floor', x: spec.x, y: spec.y, rot: spec.rot | 0 });
        this.pose({ ...it, at: show }, this.ghost);
        if (show.layer === 'top' || (!at && K.layer === 'small')) this.ghost.position.y += 0.06;
        this.ghost.position.y += 0.04;
        const mat = ok ? this.hiMat : this.hiBad;
        if (show.layer === 'wall') {
            const [w, h] = K.fp[it.size];
            for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
                const c = new THREE.Mesh(new THREE.PlaneGeometry(0.94, ROW * 0.94), mat);
                const u = show.u + i + 0.5, y = ROW0 + (show.v + j + 0.5) * ROW;
                if (show.wall === 'L') c.position.set(u, y, 0.01); else { c.position.set(0.01, y, u); c.rotation.y = Math.PI / 2; }
                this.cells.push(c); this.overlay.add(c);
            }
        } else {
            const [fw, fd] = show.layer === 'top' ? [1, 1] : footprint(it, show.rot);
            for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) {
                const c = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), mat);
                c.rotation.x = -Math.PI / 2;
                c.position.set(show.x + i + 0.5, 0.01, show.y + j + 0.5);
                this.cells.push(c); this.overlay.add(c);
            }
        }
    }

    setSelected(id) { this.selected = id; }
    setCursor(x, y) {
        if (x == null) { this.cursor.visible = false; return; }
        this.cursor.visible = true;
        this.cursor.position.set(x + 0.5, 0.012, y + 0.5);
    }

    /** What is under a screen point: a placed thing, a floor tile and a wall cell (each may be null). */
    pick(clientX, clientY) {
        if (!this.G) return {};
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        const cam = this.photo && this.photo.lens === 'toy' ? this.persp : this.cam;
        this.ray.setFromCamera(ndc, cam);
        const out = {};
        const hits = this.ray.intersectObjects(this.items.children, true);
        if (hits.length) {
            const h = hits[0];
            out.item = h.object.userData.itemId;
            out.itemPoint = { x: h.point.x, y: h.point.y, z: h.point.z };
        }
        const p = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) out.floor = { px: p.x, pz: p.z, x: Math.floor(p.x), y: Math.floor(p.z), inside: p.x >= 0 && p.z >= 0 && p.x < this.G.w && p.z < this.G.d };
        // walls: the nearer of the two planes, within the wall's extent
        let best = null;
        for (const [wall, plane] of [['L', new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)], ['R', new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)]]) {
            if (!this.ray.ray.intersectPlane(plane, p)) continue;
            const along = wall === 'L' ? p.x : p.z, len = wall === 'L' ? this.G.w : this.G.d;
            if (along < 0 || along > len || p.y < 0 || p.y > WALL_H) continue;
            const d = this.ray.ray.origin.distanceTo(p);
            if (!best || d < best.d) best = { wall, along, y: p.y, d };
        }
        if (best) out.wall = { wall: best.wall, pu: best.along, pv: (best.y - ROW0) / ROW };
        return out;
    }

    // ------------------------------------------------------------------ photo mode
    enterPhoto() {
        if (!this.post) { this.post = new Post(this.renderer, this.scene, this.cam); this.post.setSize(this.w, this.h); }
        this.photo = { yaw: this.yaw, pitch: this.pitch, zoom: 1, lens: 'iso', panY: 0 };
        this.setSelected(null); this.setGhost(null); this.setCursor(null);
        this.fit();
    }
    exitPhoto() { this.photo = null; this.post?.setTilt(0); this.post?.setFilter('natural'); this.setTime('day'); this.fit(); }
    orbit(dyaw, dpitch) {
        if (!this.photo) return;
        const p = this.photo;
        p.yaw = Math.max(Math.PI / 4 - 0.75, Math.min(Math.PI / 4 + 0.75, p.yaw + dyaw));
        p.pitch = Math.max(0.12, Math.min(1.25, p.pitch + dpitch));
        this.fit();
    }
    setLens(lens) { if (this.photo) { this.photo.lens = lens; this.fit(); } }
    resetPhoto() { if (this.photo) { Object.assign(this.photo, { yaw: this.yaw, pitch: this.pitch, zoom: 1, panY: 0 }); this.fit(); } }

    /** The miniature blur's sharp band follows the room's middle, wherever it sits on screen. */
    focusTilt(cam) {
        if (!this.post?.tiltH.enabled || !this.G) return;
        const v = new THREE.Vector3(this.G.w / 2, 0.5, this.G.d / 2).project(cam);
        const f = Math.max(0.15, Math.min(0.85, (v.y + 1) / 2));
        this.post.tiltH.uniforms.uFocus.value = this.post.tiltV.uniforms.uFocus.value = f;
    }

    /** Render one photo at w × h into a new 2D canvas (with the photo-mode filter, lens and blur). */
    capture(w, h) {
        const r = this.renderer;
        const pr = r.getPixelRatio();
        const p = this.photo || { yaw: this.yaw, pitch: this.pitch, zoom: 1, lens: 'iso', panY: 0 };
        if (!this.post) { this.post = new Post(r, this.scene, this.cam); }
        const cam = p.lens === 'toy' ? this.persp : this.cam;
        this.overlay.visible = false;
        r.setPixelRatio(1);
        r.setSize(w, h, false);
        this.post.setSize(w, h);
        // the photo frames the room the way the screen does, at the photo's own aspect
        this.aim(cam, { yaw: p.yaw, pitch: p.pitch, zoom: p.zoom * 1.05, w, h, top: 0, bottom: 0, panY: p.panY });
        this.post.setCamera(cam);
        this.focusTilt(cam);
        this.post.draw(this.clock || 0);
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        out.getContext('2d').drawImage(r.domElement, 0, 0, w, h);   // same task as the render: no preserveDrawingBuffer needed
        r.setPixelRatio(pr);
        r.setSize(this.w, this.h, false);
        r.domElement.style.width = this.w + 'px'; r.domElement.style.height = this.h + 'px';
        this.post.setSize(this.w, this.h);
        this.overlay.visible = true;
        this.fit();
        return out;
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        this.clock = time;
        // squash and stretch: a thing lands like soft clay
        for (const o of this.objs.values()) {
            if (!o.anim) { o.obj.scale.set(1, 1, 1); continue; }
            o.anim.t += dt;
            const t = o.anim.t;
            const k = Math.exp(-7 * t) * Math.cos(t * 22);
            if (o.anim.kind === 'place') o.obj.scale.set(1 + 0.22 * k, 1 - 0.3 * k, 1 + 0.22 * k);
            else o.obj.scale.set(1 + 0.08 * k, 1 - 0.08 * k, 1 + 0.08 * k);
            if (t > 0.9) { o.anim = null; o.obj.scale.set(1, 1, 1); }
        }
        // the ghost bobs; the selection ring breathes
        if (this.ghost) this.ghost.position.y += Math.sin(time * 5) * 0.0025;
        const sel = this.selected != null ? this.objs.get(this.selected) : null;
        const selIt = sel && G.items.find((i) => i.id === this.selected);
        this.ring.visible = !!(sel && selIt?.at);
        if (this.ring.visible) {
            const at = selIt.at;
            if (at.layer === 'wall') {
                this.ring.visible = false;
                sel.obj.scale.setScalar(1 + Math.sin(time * 6) * 0.03);
            } else {
                const [fw, fd] = at.layer === 'top' ? [1, 1] : footprint(selIt, at.rot);
                this.ring.position.set(sel.obj.position.x, (at.layer === 'top' ? sel.obj.position.y : 0) + 0.03, sel.obj.position.z);
                this.ring.scale.set(fw * 1.05 + Math.sin(time * 5) * 0.04, fd * 1.05 + Math.sin(time * 5) * 0.04, 1);
            }
        }
        // lamps and fires borrow a light from the pool; flames flicker (gently: no flashing)
        const lights = [];
        for (const o of this.objs.values()) {
            const L = o.obj.userData.light;
            if (L) lights.push({ o, L });
            const fl = o.obj.userData.flames;
            if (fl) fl.forEach((f, i) => { f.scale.y = (f.userData.sy ??= f.scale.y) * (1 + Math.sin(time * 9 + i * 2.1) * 0.08 + Math.sin(time * 13.7 + i) * 0.05); });
        }
        lights.sort((a, b) => (b.L.fire ? 1 : 0) - (a.L.fire ? 1 : 0));
        const v = new THREE.Vector3();
        this.pool.forEach((p, i) => {
            const l = lights[i];
            if (!l) { p.intensity = 0; return; }
            v.set(l.L.x, l.L.y, l.L.z);
            l.o.obj.localToWorld(v);
            p.position.copy(v);
            p.color.setHex(l.L.color);
            p.intensity = this.lampK * (l.L.fire ? 1.3 + Math.sin(time * 7.3) * 0.08 + Math.sin(time * 11.1) * 0.05 : 1);
        });
        if (this.photo && this.post) { this.focusTilt(this.photo.lens === 'toy' ? this.persp : this.cam); this.post.draw(time); }
        else this.renderer.render(this.scene, this.cam);
    }

    /** Clay detail for slow devices (the settings' "Simple clay" switch). */
    setDetail(on) { setClayDetail(on ? 1 : 0.35, on ? 1 : 0.6); this.renderer.shadowMap.enabled = on; }
}

export { clay };
