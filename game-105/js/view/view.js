// The three.js view. Reads G every frame, builds the bench scene for the current job, answers sim
// events with effects, and turns pointer positions into refs for the sim. Never writes G.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { BENCH, BIN, DISH, FAST, FLOOR_Y, HOVER } from '../config.js';
import { KINDS } from '../sim/kinds.js';
import { blockers, canAct, holePos, liftCheck, parseRef, partPlace, placeCheck, portWorld, slotPlace, snapSlot, stashOpen, wireEndPos, rot } from '../sim/rules.js';
import { refPos } from '../sim/plan.js';
import { buildBin, buildDish, buildShell, makeFastener, makeHoleRing, makePartView, syncPorts, updatePartView } from './models.js';
import { mat, colorMat, Builder, accentMat } from './kit.js';
import { FX } from './fx.js';
import { Room, makeEnvironment } from './room.js';
import { ToolRig } from './tools3d.js';
import { WireView } from './wires.js';
import * as TX from './textures.js';

const PI = Math.PI;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const GRADE = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, aberr: { value: 0 }, grain: { value: 0.02 }, vig: { value: 0.45 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, aberr, grain, vig; varying vec2 vUv;
    void main(){
        vec2 c = vUv - 0.5; float d = dot(c, c);
        vec2 off = c * (0.0012 + aberr) * (0.4 + d * 3.0);
        float r = texture2D(tDiffuse, vUv + off).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - off).b;
        vec3 col = max(vec3(r, g, b), 0.0);
        col = mix(col, col * vec3(1.06, 1.0, 0.93) + vec3(0.0, 0.004, 0.012), 0.45);
        col *= 1.0 - smoothstep(0.22, 0.8, sqrt(d)) * vig;
        float n = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + time, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - 0.5) * grain;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

const POSES = {
    title: { az: 0.55, el: 0.34, dist: 21, t: [0, 2.8, -3] },
    shop: { az: 0.0, el: 0.3, dist: 22, t: [0, 2.6, -2] },
};

export class View {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.q = opts.quality || 'med';
        this.shift = 0; this.w = 0; this.h = 0;
        this.reduced = !!opts.reduced;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q !== 'low', powerPreference: 'high-performance' });
        const r = this.renderer;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.35;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.setClearColor(0x07070d);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0a14, 0.006);
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
        this.scene.environment = makeEnvironment(r);
        this.scene.environmentIntensity = 1.2;

        // lights: a hemisphere for the room, the work lamp with real shadows
        this.scene.add(new THREE.HemisphereLight(0x7a90d8, 0x3a2a44, 1.1));
        this.lamp = new THREE.SpotLight(0xffe6c0, 900, 60, 0.95, 0.7, 1.6);
        this.lamp.position.set(1.3, 11, -3.5);
        this.lamp.target.position.set(0, 0, 0.4);
        this.lamp.castShadow = true;
        this.lamp.shadow.mapSize.set(this.q === 'high' ? 2048 : 1024, this.q === 'high' ? 2048 : 1024);
        this.lamp.shadow.bias = -0.0004; this.lamp.shadow.normalBias = 0.02; this.lamp.shadow.radius = 4;
        this.scene.add(this.lamp, this.lamp.target);
        this.fill = new THREE.DirectionalLight(0x9ab4ff, 1.1); this.fill.position.set(-8, 10, 12); this.scene.add(this.fill);

        this.room = new Room(this.scene);
        this.fx = new FX(this.scene);
        this.toolRig = new ToolRig(this.scene);
        this.job = new THREE.Group(); this.scene.add(this.job);

        // composer
        this.composer = null;
        if (this.q !== 'low') this.makeComposer();

        // camera rig
        this.mode = 'shop';
        this.rig = { az: 0, el: 0.3, dist: 22, tx: 0, ty: 2.6, tz: -2 };
        this.goal = { ...this.rig };
        this.fit = 18; this.zoom = 1; this.panX = 0; this.panZ = 0;
        this.safe = { top: 52, bottom: 70 };      // screen px the HUD takes: the bench is framed in what is left
        this.shake = 0; this.aberr = 0;

        // job content
        this.jobId = null; this.dev = null;
        this.parts = new Map(); this.fast = new Map(); this.wires = new Map(); this.stash = new Map();
        this.flights = [];
        this.shell = null;
        this.hover = null; this.hoverOutline = null; this.ring = this.makeRing();
        this.ghost = null; this.ghostId = null;
        this.power = { lit: -1, on: false, t0: 0, fail: null };
        this.ray = new THREE.Raycaster();
        this.lastPick = { ref: null, bx: 0, bz: 0, ax: 0, az: 0, point: null, inside: false };
        this.mouse = new THREE.Vector2();
        this.t = 0; this.looks = 0;
        this.tipTouch = false;

        this.dishG = buildDish(); this.dishG.position.set(DISH.x, 0, DISH.z); this.scene.add(this.dishG);
        this.binG = buildBin(); this.binG.position.set(BIN.x, 0, BIN.z); this.scene.add(this.binG);
        this.dishG.visible = this.binG.visible = false;
        this.resize(true);
        const on = () => this.resize();
        window.addEventListener('resize', on);
        window.visualViewport?.addEventListener('resize', on);
    }

    makeComposer() {
        const r = this.renderer;
        this.composer = new EffectComposer(r);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 1.0);
        this.composer.addPass(this.bloom);
        this.grade = new ShaderPass(GRADE);
        this.composer.addPass(this.grade);
        this.composer.addPass(new OutputPass());
    }

    setQuality(q) {
        if (q === this.q) return;
        this.q = q;
        if (q === 'low') { this.composer = null; }
        else if (!this.composer) this.makeComposer();
        const s = q === 'high' ? 2048 : 1024;
        this.lamp.shadow.mapSize.set(s, s); this.lamp.shadow.map?.dispose(); this.lamp.shadow.map = null;
        this.w = 0; this.resize(true);
    }
    setReduced(b) { this.reduced = !!b; }

    resize(force) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const pr = Math.min(window.devicePixelRatio || 1, this.q === 'high' ? 2 : this.q === 'low' ? 1 : 1.5);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        if (this.composer) {
            this.composer.setPixelRatio(pr);
            this.composer.setSize(w, h);
            this.bloom.resolution.set(Math.round(w * pr / 2), Math.round(h * pr / 2));
        }
        this.camera.aspect = w / h;
        if (this.shift) this.camera.setViewOffset(w, h, 0, this.shift, w, h);
        this.camera.updateProjectionMatrix();
        this.refit();
    }

    /** How far back the camera must sit to see the whole bench at this aspect. */
    refit() {
        const dev = this.dev;
        const tv = Math.tan((this.camera.fov * PI) / 360), th = tv * this.camera.aspect;
        const needW = Math.max(dev ? dev.W / 2 + 3.4 : 8, 8.4);
        const needD = dev ? dev.D / 2 + 4.2 : 7;
        const frac = Math.max(0.45, (this.h - this.safe.top - this.safe.bottom) / this.h);
        this.fit = Math.max(needW / th, (needD * 0.8 + 1.6) / (tv * frac)) * 1.0 + 1;
        this.poseCache = null;
    }

    /** Tell the camera how much of the screen the HUD covers, so nothing on the bench hides behind it. */
    setSafe(top, bottom) {
        if (Math.abs(top - this.safe.top) < 2 && Math.abs(bottom - this.safe.bottom) < 2) return;
        this.safe = { top, bottom };
        this.refit();
    }

    // ------------------------------------------------------------------ camera
    orbit(dx, dy) {
        if (this.mode !== 'bench') return;
        this.goal.az -= dx * 0.0065; this.goal.el = Math.max(0.22, Math.min(1.5, this.goal.el + dy * 0.005));
    }
    zoomBy(delta) {
        if (this.mode !== 'bench') return;
        this.zoom = Math.max(0.32, Math.min(1.5, this.zoom * Math.exp(delta * 0.0012)));
    }
    pan(dx, dy) {
        if (this.mode !== 'bench') return;
        const k = 0.012 * this.zoom * this.fit / 18;
        const c = Math.cos(this.goal.az), s = Math.sin(this.goal.az);
        this.panX = Math.max(-6, Math.min(6, this.panX - (dx * c + dy * s * 0.5) * k));
        this.panZ = Math.max(-5, Math.min(5, this.panZ - (dy * c - dx * s) * k));
    }
    resetCamera() { this.goal.az = 0; this.goal.el = 1.12; this.zoom = 1; this.panX = 0; this.panZ = 0; }

    setMode(mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        if (mode === 'bench') { this.goal.az = 0; this.goal.el = 1.12; this.zoom = 1; this.panX = 0; this.panZ = 0; }
        else { const p = POSES[mode]; this.goal.az = p.az; this.goal.el = p.el; this.goal.dist = p.dist; this.goal.tx = p.t[0]; this.goal.ty = p.t[1]; this.goal.tz = p.t[2]; }
    }

    updateCamera(dt, t) {
        const bench = this.mode === 'bench';
        const g = this.goal;
        const k = 1 - Math.exp(-dt * (bench ? 5 : 2.6));
        const target = bench ? { dist: this.fit * this.zoom, tx: this.panX, ty: 0.3, tz: 0.7 + this.panZ } : { dist: g.dist, tx: g.tx, ty: g.ty, tz: g.tz };
        const r = this.rig;
        r.az += (g.az - r.az) * k; r.el += (g.el - r.el) * k;
        r.dist += (target.dist - r.dist) * k; r.tx += (target.tx - r.tx) * k; r.ty += (target.ty - r.ty) * k; r.tz += (target.tz - r.tz) * k;
        let az = r.az, el = r.el;
        if (this.mode === 'title') { az += Math.sin(t * 0.18) * 0.12; el += Math.sin(t * 0.13) * 0.02; }
        else if (!bench && !this.reduced) { az += Math.sin(t * 0.2) * 0.02; }
        const d = r.dist;
        let x = r.tx + d * Math.sin(az) * Math.cos(el), y = r.ty + d * Math.sin(el), z = r.tz + d * Math.cos(az) * Math.cos(el);
        if (this.shake > 0.001 && !this.reduced) { x += (Math.random() - 0.5) * this.shake; y += (Math.random() - 0.5) * this.shake; z += (Math.random() - 0.5) * this.shake; }
        this.shake *= Math.exp(-dt * 9);
        this.camera.position.set(x, Math.max(0.7, y), z);
        this.camera.lookAt(r.tx, r.ty, r.tz);
        // slide the picture into the free band between the HUD's top and bottom edges
        const shift = bench ? Math.round((this.safe.bottom - this.safe.top) / 2) : 0;
        if (shift !== this.shift) {
            this.shift = shift;
            if (shift) this.camera.setViewOffset(this.w, this.h, 0, shift, this.w, this.h); else this.camera.clearViewOffset();
        }
    }

    // ------------------------------------------------------------------ loading a job
    clearJob() {
        for (const o of [...this.job.children]) { this.job.remove(o); }
        this.parts.clear(); this.fast.clear(); this.wires.clear(); this.stash.clear();
        this.flights = []; this.shell = null; this.ghost = null; this.ghostId = null; this.hover = null;
        this.dev = null; this.jobId = null;
        this.dishG.visible = this.binG.visible = false;
        this.power = { lit: -1, on: false, t0: 0, fail: null };
    }

    loadJob(G) {
        this.clearJob();
        const J = G.job, dev = J.dev;
        this.dev = dev; this.jobId = J.id;
        this.shell = buildShell(dev);
        this.job.add(this.shell);
        for (const sid of dev.slotOrder) {
            const slot = dev.slots[sid];
            for (const hole of slot.holes) {
                const g = new THREE.Group();
                const fz = makeFastener(hole.type, hole.rust > 0);
                const ring = makeHoleRing();
                const dish = makeFastener(hole.type, hole.rust > 0);
                dish.scale.setScalar(0.9);
                g.add(fz);
                const setRef = (o) => o.traverse((m) => { if (m.isMesh) m.userData.ref = `hole:${hole.id}`; });
                setRef(fz); setRef(ring);
                this.job.add(g, ring, dish);
                this.fast.set(hole.id, { g, fz, ring, dish, slot, hole, rustMat: hole.rust > 0, flyUntil: 0, spinAcc: 0 });
            }
        }
        for (const id of dev.wireOrder) {
            const wv = new WireView(dev.wires[id]);
            this.wires.set(id, wv); this.job.add(wv.group);
        }
        for (const st of dev.stash) this.makeStash(st);
        this.dishG.visible = this.binG.visible = true;
        this.refit();
        this.zoom = 1;
        // pre-build part views so the first frame is complete
        for (const id of Object.keys(dev.parts)) this.ensurePart(dev.parts[id]);
    }

    makeStash(st) {
        const g = new THREE.Group();
        const b = new Builder();
        if (st.clue === 'tag') {
            b.cylc(mat('brass'), 0.55, 0.55, 0.06, 18, 0, 0.05, 0); b.cylc(mat('rubber'), 0.18, 0.18, 0.08, 12, 0, 0.06, 0);
            b.add(flat(0.9, 0.28), TX.labelTex('L-9', { w: 96, h: 40, size: 28, fg: '#2b1c00', bg: '#c79a43' }) && new THREE.MeshBasicMaterial({ map: TX.labelTex('L-9', { w: 96, h: 40, size: 28, fg: '#2b1c00', bg: '#c79a43' }) }), 0, 0.1, 0);
        } else if (st.clue === 'crystal') {
            b.add(new THREE.OctahedronGeometry(0.4), colorMat(0x35e0ff, { emissive: 0x35e0ff, emissiveIntensity: 1.2, roughness: 0.1, transparent: true, opacity: 0.85 }), 0, 0.45, 0, 0, 0.4, 0, 0.8, 1.4, 0.8);
            b.box(colorMat(0xb9a98a, { roughness: 0.9 }), 1.0, 0.1, 0.8, 0, 0.05, 0);
        } else {
            b.box(colorMat(0xb9a98a, { roughness: 0.9 }), 0.9, 0.18, 0.7, 0, 0.12, 0, 0, 0.3, 0);
            b.add(new THREE.BoxGeometry(0.5, 0.06, 0.3), colorMat(0x1a1c22, { metalness: 0.5, roughness: 0.4 }), 0.1, 0.25, 0, 0, 0.3, 0);
        }
        g.add(b.build());
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.y = 0.3; glow.userData.noPick = true; g.add(glow);
        g.position.set(st.x, FLOOR_Y, st.z);
        g.traverse((o) => { if (o.isMesh && !o.userData.noPick) o.userData.ref = `stash:${st.id}`; });
        this.job.add(g);
        this.stash.set(st.id, { g, glow, st });
    }

    ensurePart(part) {
        let pv = this.parts.get(part.id);
        const key = JSON.stringify([part.cond.burnt, part.cond.cracked]);
        if (pv && pv.cond !== key) { this.job.remove(pv.group); pv = null; this.parts.delete(part.id); }
        if (!pv) {
            pv = makePartView(part, this.dev);
            pv.vis = V3(); pv.visInit = false; pv.prev = V3(); pv.vel = V3(); pv.pop = 0; pv.lastLoc = part.loc;
            this.job.add(pv.group);
            this.parts.set(part.id, pv);
        }
        return pv;
    }

    // ------------------------------------------------------------------ picking
    ndc(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        return r;
    }

    /** Turn a pointer position into a ref and bench coordinates. `G` supplies the tool and held thing. */
    pick(clientX, clientY, G, touch = false) {
        const out = { ref: null, bx: this.lastPick.bx, bz: this.lastPick.bz, ax: this.lastPick.ax, az: this.lastPick.az, point: null, inside: true };
        if (!this.dev || this.mode !== 'bench') { this.lastPick = out; return out; }
        const r = this.ndc(clientX, clientY);
        out.inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        this.ray.setFromCamera(this.mouse, this.camera);
        const hit = new THREE.Vector3();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (this.ray.ray.intersectPlane(plane, hit)) { out.bx = hit.x; out.bz = hit.z; }
        plane.constant = -HOVER;
        if (this.ray.ray.intersectPlane(plane, hit)) { out.ax = hit.x; out.az = hit.z; }

        const J = G.job, dev = this.dev;
        const ignore = new Set();
        if (J.held) {
            if (J.held.k === 'part') {
                ignore.add(`part:${J.held.id}`);
                for (const s of Object.values(dev.slots)) if (s.parentPart === J.held.id && s.occ) ignore.add(`part:${s.occ}`);
            } else ignore.add(`plug:${J.held.w}.${J.held.e}`);
        }
        const hits = this.ray.intersectObject(this.job, true);
        let first = null;
        for (const h of hits) {
            const o = h.object;
            if (o.userData.noPick || !o.visible) continue;
            let vis = true;
            for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
            if (!vis) continue;
            const ref = o.userData.ref || null;
            if (ref && ignore.has(ref)) continue;
            first = { ref, dist: h.distance, point: h.point };
            break;
        }
        const smallKinds = ['hole', 'plug', 'joint', 'cut', 'stash'];
        const kindOf = (ref) => (ref ? ref.slice(0, ref.indexOf(':')) : null);
        let ref = first ? first.ref : null;
        out.point = first ? first.point : null;
        // small things: be generous about where the finger landed
        if (!(ref && smallKinds.includes(kindOf(ref))) && !J.held) {
            const cand = this.nearestSmall(clientX, clientY, G, touch, first ? first.dist : 1e9);
            if (cand) { ref = cand.ref; out.point = cand.point; }
        }
        out.ref = ref;
        out.px = out.point ? out.point.x : out.bx; out.pz = out.point ? out.point.z : out.bz;
        this.lastPick = out;
        return out;
    }

    nearestSmall(cx, cy, G, touch, d0) {
        const rad = touch ? 30 : 17;
        const rect = this.canvas.getBoundingClientRect();
        const dev = this.dev;
        const tool = G.tool;
        let best = null, bd = rad * rad;
        const v = V3();
        const consider = (ref, pos) => {
            if (!G.manual ? false : !canAct(dev, tool, ref)) return;
            v.set(pos[0], pos[1], pos[2]).project(this.camera);
            const sx = rect.left + ((v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - v.y) / 2) * rect.height;
            const d = (sx - cx) ** 2 + (sy - cy) ** 2;
            if (d >= bd) return;
            const dist = this.camera.position.distanceTo(V3(pos[0], pos[1], pos[2]));
            if (dist > d0 + 0.6) return;                // something nearer hides it
            bd = d; best = { ref, point: V3(pos[0], pos[1], pos[2]) };
        };
        for (const [id, f] of this.fast) {
            if (!f.slot.occ || !f.g.parent) continue;
            if (f.hole.prog <= 0.001 && !f.ring.visible) continue;
            consider(`hole:${id}`, refPos(dev, `hole:${id}`));
        }
        for (const [id, wv] of this.wires) {
            const w = dev.wires[id];
            for (let e = 0; e < 2; e++) consider(`plug:${id}.${e}`, wireEndPos(dev, w, e));
            if (w.cut && !w.cut.done) consider(`cut:${id}`, refPos(dev, `cut:${id}`));
        }
        for (const [pid, pv] of this.parts) {
            const part = dev.parts[pid];
            (part.cond.joints || []).forEach((j, i) => { if (!j.done) consider(`joint:${pid}.${i}`, refPos(dev, `joint:${pid}.${i}`)); });
        }
        for (const [sid, s] of this.stash) if (!s.st.taken) consider(`stash:${sid}`, [s.st.x, 0.5, s.st.z]);
        return best;
    }

    /** Screen position (CSS px, relative to the page) of a ref, or null. For tests and hints. */
    project(ref) {
        if (!this.dev) return null;
        const p = refPos(this.dev, ref);
        const v = V3(p[0], p[1], p[2]).project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
    }

    // ------------------------------------------------------------------ outlines, rings, ghosts
    makeRing() {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.95, toneMapped: false, depthTest: false }));
        m.rotation.x = PI / 2; m.visible = false; m.renderOrder = 18; m.userData.noPick = true;
        this.scene.add(m);
        return m;
    }

    setHover(G, ref) {
        const J = G.job;
        this.hover = ref;
        const dev = this.dev;
        // drop the previous outline
        if (this.hoverOutline) { this.hoverOutline.parent && this.hoverOutline.parent.remove(this.hoverOutline); this.hoverOutline = null; }
        this.ring.visible = false;
        if (!ref || !dev || (J && (J.held || J.test))) return;
        const r = parseRef(ref);
        if (r.k === 'part') {
            const pv = this.parts.get(r.id);
            if (!pv) return;
            const part = dev.parts[r.id];
            const ok = part.loc !== 'slot' || liftCheck(dev, part).ok;
            const hull = new THREE.Group();
            const hm = new THREE.MeshBasicMaterial({ color: ok ? 0x6ee7ff : 0xffa63d, side: THREE.BackSide, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
            pv.group.children.forEach((c) => {
                if (!c.isMesh || c.userData.noPick) return;
                const m = new THREE.Mesh(c.geometry, hm);
                m.scale.set(1.045, 1.12, 1.045); m.position.y = -0.01; m.userData.noPick = true; m.userData.sharedGeo = true;
                hull.add(m);
            });
            pv.group.add(hull); this.hoverOutline = hull;
        } else {
            const p = refPos(dev, ref);
            this.ring.position.set(p[0], p[1] + 0.05, p[2]);
            const s = r.k === 'plug' ? 1.1 : r.k === 'hole' ? 0.8 : 0.9;
            this.ring.scale.setScalar(s);
            this.ring.material.color.setHex(0x6ee7ff);
            this.ring.visible = true;
        }
    }

    updateGhost(G, t) {
        const J = G.job, dev = this.dev;
        const h = J && J.held && J.held.k === 'part' ? dev.parts[J.held.id] : null;
        if (!h) { if (this.ghost) { this.ghost.visible = false; } this.ghostSlot = null; return; }
        const slot = dev.slotOrder.map((i) => dev.slots[i]).find((s) => !s.occ && s.spec === h.spec && (!s.parentPart || dev.parts[s.parentPart]));
        if (!slot) { if (this.ghost) this.ghost.visible = false; return; }
        if (this.ghostId !== h.id) {
            if (this.ghost) this.job.remove(this.ghost);
            const pv = this.parts.get(h.id);
            this.ghost = pv.group.clone(true);
            const gm = new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false });
            this.ghost.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; o.userData.noPick = true; o.userData.sharedGeo = true; } if (o.isSprite) o.visible = false; });
            this.ghostMat = gm;
            this.job.add(this.ghost);
            this.ghostId = h.id;
        }
        const pl = slotPlace(dev, slot);
        this.ghost.position.set(pl.x, pl.y, pl.z); this.ghost.rotation.set(0, pl.yaw, 0);
        this.ghost.visible = true;
        const near = snapSlot(dev, h) === slot;
        const blocked = !placeCheck(dev, h, slot).ok;
        this.ghostMat.color.setHex(blocked ? 0xffa63d : 0x6ee7ff);
        this.ghostMat.opacity = near ? 0.45 + Math.sin(t * 9) * 0.1 : 0.14;
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const dev = this.dev;
        for (const e of events) {
            if (e.type === 'job' && G.job && this.jobId !== G.job.id) this.loadJob(G);
            if (e.type === 'line' && e.w === 'spanner') this.room.talk = 0.9;
            if (!dev || !G.job) continue;
            const at = (ref) => { try { return refPos(dev, ref); } catch { return [0, 0.5, 0]; } };
            switch (e.type) {
                case 'turn': { const p = at(e.ref); this.fx.chips(p[0], p[1], p[2]); break; }
                case 'screw_out': {
                    const f = this.fast.get(e.ref.slice(5));
                    const from = holePos(dev, f.slot, f.hole);
                    const to = this.dishPos(f.hole.id);
                    this.flights.push({ f, t: 0, dur: 0.45, from, to });
                    f.flyUntil = this.t + 0.5;
                    this.fx.chips(from[0], from[1], from[2]);
                    break;
                }
                case 'screw_in': { const p = at(e.ref); this.fx.glints(p[0], p[1], p[2], 3, 0xdfe8ff); break; }
                case 'lift': { const p = at(e.ref); this.fx.smoke(p[0], 0.6, p[2], 2, 0xb0aaa0, 0.4); break; }
                case 'seat': { const pv = this.parts.get(e.ref.slice(5)); if (pv) pv.pop = 1; const p = at(e.ref); this.fx.glints(p[0], p[1] + 0.3, p[2], 8, 0x9ae8ff); this.shake = Math.max(this.shake, 0.05); break; }
                case 'drop': { const p = at(e.ref); this.fx.smoke(p[0], 0.1, p[2], 1, 0xb0aaa0, 0.3); break; }
                case 'scrap': { const pv = this.parts.get(e.ref.slice(5)); const p = pv ? pv.vis : V3(BIN.x, 1, BIN.z); this.fx.sparks(BIN.x, 1.2, BIN.z, 10, 0xff9a40); if (e.bad) this.fx.smoke(BIN.x, 1.5, BIN.z, 3, 0x333333, 0.6); void p; break; }
                case 'plug': { const w = dev.wires[e.wire]; const p = wireEndPos(dev, w, e.end); this.fx.sparks(p[0], p[1], p[2], 8, 0x6ee7ff, 2); break; }
                case 'unplug': { const w = dev.wires[e.wire]; const p = wireEndPos(dev, w, e.end); this.fx.sparks(p[0], p[1], p[2], 3, 0xffd060, 1.4); break; }
                case 'bonk': { this.shake = Math.max(this.shake, 0.12); this.aberr = 0.012; break; }
                case 'slip': { const p = at(e.ref); this.fx.sparks(p[0], p[1], p[2], 6, 0xffffff, 2.2); this.shake = Math.max(this.shake, 0.06); break; }
                case 'solder': { const p = at(e.ref); this.fx.solder(p[0], p[1], p[2]); break; }
                case 'burn': { const p = at(e.ref); this.fx.sparks(p[0], p[1], p[2], 24, 0xff6a2a, 4); this.fx.smoke(p[0], p[1], p[2], 6, 0x666666); this.shake = 0.18; this.aberr = 0.02; break; }
                case 'fixed': { const p = at(e.ref); this.fx.glints(p[0], p[1] + 0.2, p[2], 18, e.what === 'oil' ? 0xffd060 : 0x8cffd0); this.fx.sparks(p[0], p[1], p[2], 6, 0xffffff, 2); break; }
                case 'scrub': { const p = at(e.ref); this.fx.foam(p[0], p[1], p[2]); break; }
                case 'drip': { const p = this.lastPick.point || V3(...at(e.ref)); this.fx.drip(p.x, p.y + 0.9, p.z); break; }
                case 'probe_ok': { const p = at(e.ref); this.fx.glints(p[0], p[1] + 0.5, p[2], 8, 0x46e08a); break; }
                case 'probe_bad': { const p = at(e.ref); this.fx.glints(p[0], p[1] + 0.5, p[2], 8, 0xff4d5e); this.fx.sparks(p[0], p[1] + 0.3, p[2], 5, 0xff4d5e, 1.5); break; }
                case 'spare': { const p = at(e.ref); this.fx.glints(p[0], p[1] + 0.5, p[2], 14, 0xb0e8ff); break; }
                case 'stash': { const st = dev.stash.find((s) => s.id === e.id); if (st) this.fx.glints(st.x, 1, st.z, 24, 0xffd060); break; }
                case 'test_start': this.power = { lit: 0, on: false, t0: this.t, fail: null, ok: e.ok }; break;
                case 'flow': this.power.lit = e.n; this.power.on = true; break;
                case 'test_pass': this.power = { lit: 9999, on: true, t0: this.t, fail: null, ok: true, showUntil: this.t + 5.5 }; this.fx.confetti(0, 2, 0.5, 70); this.shake = 0.1; break;
                case 'test_fail': {
                    this.power.fail = e.ref; this.power.showUntil = this.t + 1.6; this.aberr = 0.03; this.shake = 0.25;
                    const ref = e.ref;
                    if (ref.startsWith('slot:')) { const s = dev.slots[ref.slice(5)]; const pl = slotPlace(dev, s); this.fx.sparks(pl.x, 1.2, pl.z, 40, 0xff7a30, 5); this.fx.smoke(pl.x, 1, pl.z, 10, 0x555555); }
                    else { const p = refPos(dev, 'wire:' + ref.slice(5)); this.fx.sparks(p[0], p[1], p[2], 40, 0xff7a30, 5); this.fx.smoke(p[0], p[1], p[2], 8, 0x555555); }
                    break;
                }
                default: break;
            }
        }
    }

    dishPos(id) {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        const a = (h % 628) / 100, r = ((h >> 8) % 100) / 100 * (DISH.r - 0.5);
        return [DISH.x + Math.cos(a) * r, 0.12, DISH.z + Math.sin(a) * r];
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time, hud = {}) {
        this.t = time;
        this.resize();
        const phase = G.phase;
        const benchLike = (phase === 'bench' || phase === 'result' || phase === 'freeover') && G.job;
        if (benchLike && G.job.id !== this.jobId) this.loadJob(G);
        if (!benchLike && this.dev) this.clearJob();
        this.setMode(benchLike ? 'bench' : phase === 'title' ? 'title' : 'shop');
        this.updateCamera(dt, time);
        this.aberr *= Math.exp(-dt * 5);

        if (this.dev) this.sync(G, dt, time);
        else { this.toolRig.root.visible = false; this.ring.visible = false; }

        this.room.setUpgrades(G.story ? G.story.upgrades || {} : {});
        this.room.update(dt, time, { lookX: Math.sin(this.rig.az), camY: this.camera.position.y });
        this.fx.update(dt, this.h);
        // ambient: steam from the mug, dust in the lamp
        if (this.mode !== 'title' && Math.sin(time * 4.7) > 0.5) this.fx.steam(-10.4, 1.6, -5.4);
        if (Math.sin(time * 7.1) > 0.8) this.fx.glow.emit({ x: 1.3 + (Math.random() - 0.5) * 6, y: 1 + Math.random() * 6, z: 1 + (Math.random() - 0.5) * 6, vx: 0.05, vy: 0.04, vz: 0.03, life: 4, s0: 0.12, s1: 0.12, a: 0.25, color: 0xffeccc });

        this.lamp.intensity = 900 * (0.97 + Math.sin(time * 13) * 0.01);
        if (this.composer) {
            this.grade.uniforms.time.value = time % 100;
            this.grade.uniforms.aberr.value = this.reduced ? 0 : this.aberr;
            this.grade.uniforms.grain.value = this.reduced ? 0 : 0.02;
            this.bloom.strength = this.power.on ? 0.85 : 0.5;
            this.composer.render(dt);
        } else this.renderer.render(this.scene, this.camera);
    }

    sync(G, dt, t) {
        const dev = this.dev, J = G.job;
        if (!J) return;
        // parts
        const held = J.held && J.held.k === 'part' ? J.held.id : null;
        const powerOn = this.power.on && (this.power.showUntil === undefined || t < this.power.showUntil);
        if (this.power.showUntil !== undefined && t >= this.power.showUntil && this.power.on && !J.test) { this.power.on = false; this.power.lit = -1; }
        const litSlots = new Set();
        if (powerOn) dev.flow.forEach((f, i) => { if (f.t === 'slot' && i < this.power.lit) litSlots.add(f.id); });
        for (const part of Object.values(dev.parts)) {
            const pv = this.ensurePart(part);
            if (part.loc === 'scrap') { pv.group.visible = false; continue; }
            pv.group.visible = true;
            const pl = partPlace(dev, part);
            if (!pv.visInit) { pv.vis.set(pl.x, pl.y, pl.z); pv.visInit = true; pv.prev.copy(pv.vis); }
            // installed parts sit exactly; carried and loose parts glide, with a fall when dropped
            const k = 1 - Math.exp(-dt * (part.loc === 'held' ? 40 : 22));
            if (part.loc === 'slot' && !part.slotChild) pv.vis.set(pl.x, pl.y, pl.z);
            else { pv.vis.x += (pl.x - pv.vis.x) * k; pv.vis.z += (pl.z - pv.vis.z) * k; pv.vis.y += (pl.y - pv.vis.y) * (part.loc === 'held' ? k : 1 - Math.exp(-dt * 16)); }
            pv.vel.subVectors(pv.vis, pv.prev).multiplyScalar(1 / Math.max(dt, 1e-3)); pv.prev.copy(pv.vis);
            pv.pop = Math.max(0, pv.pop - dt * 6);
            const popY = Math.sin(pv.pop * PI) * 0.14;
            pv.group.position.set(pv.vis.x, pv.vis.y + popY, pv.vis.z);
            const tiltX = part.loc === 'held' ? Math.max(-0.4, Math.min(0.4, pv.vel.z * 0.025)) : 0;
            const tiltZ = part.loc === 'held' ? Math.max(-0.4, Math.min(0.4, -pv.vel.x * 0.025)) : 0;
            pv.group.rotation.set(tiltX, pl.yaw, tiltZ, 'YXZ');
            syncPorts(pv, part);
            const slotId = part.loc === 'slot' ? part.slot : part.home;
            const powered = powerOn && (this.power.ok && this.power.lit > 5000 ? part.loc === 'slot' : litSlots.has(slotId) && part.loc === 'slot');
            updatePartView(pv, part, t, { powered, dt });
        }
        // fasteners
        const dishT = new THREE.Vector3();
        for (const [id, f] of this.fast) {
            const { slot, hole } = f;
            const occ = slot.occ ? dev.parts[slot.occ] : null;
            const inPlace = !!occ && occ.loc === 'slot';
            const pos = inPlace ? holePos(dev, slot, hole) : null;
            f.g.visible = inPlace && hole.prog > 0.001;
            f.ring.visible = inPlace && hole.prog <= 0.001;
            if (pos) {
                const lift = (1 - hole.prog) * 0.6;
                f.g.position.set(pos[0], pos[1] + lift, pos[2]);
                f.g.rotation.y = hole.prog * (FAST[hole.type].turns || 0) * PI * 2 * 1.0;
                if (hole.type === 'clip') { f.g.rotation.y = slotPlace(dev, slot).yaw; f.g.position.y = pos[1] + lift * 0.4; }
                f.ring.position.set(pos[0], pos[1] + 0.01, pos[2]);
            }
            // out of the hole means in the dish
            const flying = t < f.flyUntil;
            const inDish = hole.prog <= 0.001 && !flying && inPlaceOrParked(slot, dev);
            f.dish.visible = hole.prog <= 0.001 && !flying;
            if (f.dish.visible) { const d = this.dishPos(id); f.dish.position.set(d[0], d[1], d[2]); f.dish.rotation.set(PI / 2, (d[0] * 7) % 6, 0); }
            void inDish; void dishT;
        }
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const fl = this.flights[i];
            fl.t += dt;
            if (!fl.mesh) { fl.mesh = makeFastener(fl.f.hole.type, fl.f.rustMat); this.job.add(fl.mesh); }
            const k = Math.min(1, fl.t / fl.dur), e = 1 - (1 - k) * (1 - k);
            fl.mesh.position.set(fl.from[0] + (fl.to[0] - fl.from[0]) * e, fl.from[1] + (fl.to[1] - fl.from[1]) * e + Math.sin(k * PI) * 2.4, fl.from[2] + (fl.to[2] - fl.from[2]) * e);
            fl.mesh.rotation.set(k * 9, k * 12, 0);
            if (k >= 1) { this.job.remove(fl.mesh); this.flights.splice(i, 1); }
        }
        // wires
        for (const [id, wv] of this.wires) {
            const w = dev.wires[id];
            const a = wireEndPos(dev, w, 0), b = wireEndPos(dev, w, 1);
            const idx = dev.flow.findIndex((f) => f.t === 'wire' && f.id === id);
            wv.lit = powerOn && (this.power.lit > 5000 || idx < this.power.lit) && !w.ends.some((e) => !e.at) && !(w.cut && !w.cut.done) ? 1 : 0;
            // a cable under a cover plate is out of sight: hide it unless an end is out in the open
            const covered = w.ends.every((e) => e.at && blockers(dev, dev.slots[e.port.split('.')[0]]).length > 0);
            wv.group.visible = !covered;
            wv.update(w, a, b, !w.ends[0].at, !w.ends[1].at, t, {});
        }
        // stash
        for (const [id, s] of this.stash) {
            s.g.visible = !s.st.taken;
            const open = stashOpen(dev, s.st);
            s.glow.material.opacity = open ? 0.3 + Math.sin(t * 5) * 0.15 : 0;
            s.g.rotation.y = Math.sin(t * 0.8) * 0.1;
            // under a part it is not drawn at all, so the shell is not seen through
            const slot = dev.slots[s.st.slot];
            if (slot.occ) s.g.visible = false;
        }
        this.updateGhost(G, t);
        // tool at the pointer
        this.updateTool(G, dt, t);
    }

    updateTool(G, dt, t) {
        const J = G.job;
        const lp = this.lastPick;
        const show = lp.inside && !J.held && !J.test && G.phase === 'bench' && this.ptrActive;
        this.toolRig.set(G.tool);
        let tgt = lp.point ? lp.point.clone() : V3(lp.bx, 0.05, lp.bz);
        const turning = !!(J.use && J.use.k === 'turn' && !J.use.idle);
        const working = !!(G.ptr.down && J.use);
        let heat = 0;
        if (J.use && J.use.k === 'solder' && J.use.ref) {
            const r = parseRef(J.use.ref);
            const tg = r.k === 'joint' ? this.dev.parts[r.id.split('.')[0]].cond.joints[+r.id.split('.')[1]] : this.dev.wires[r.id].cut;
            if (tg) heat = tg.heat;
        }
        if (J.use && J.use.k === 'turn' && J.use.ref) {
            const p = refPos(this.dev, J.use.ref); tgt = V3(p[0], p[1] + 0.12, p[2]);
        }
        this.toolRig.update(dt, t, tgt, show, { az: this.rig.az, turning, dir: J.use && J.use.dir ? -J.use.dir : 1, working, heat });
        if (J.use && J.use.k === 'solder' && working && heat > 0.5) this.fx.solder(tgt.x, tgt.y, tgt.z);
    }
}

function flat(w, d) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-PI / 2); return g; }
function inPlaceOrParked() { return true; }
