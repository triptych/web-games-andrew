// The model viewer: a hero's full Meshy model on a little wooden turntable, in the game's toon shading, opened by
// tapping a portrait in the Team panel. Drag to turn it (and tilt the view), scroll or pinch to zoom, double-click or
// double-tap to reset; it turns slowly by itself until touched. Buttons play the hero's animation clips.
// It has its own small renderer and only runs while its dialog is open.

import * as THREE from 'three';
import { Actor, RIGGED, texMat } from './assets.js';

const LOOPS = new Set(['idle', 'battleIdle', 'walk', 'run']);
const H = 1.6;                       // model height in the viewer
const FOV = 30;

export class ModelViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = null;
        this.running = false;
        this.actor = null;
        this.pointers = new Map();
    }

    init() {
        if (this.renderer) return;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.12;
        r.setClearColor(0x000000, 0);
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        const s = this.scene = new THREE.Scene();
        s.add(new THREE.HemisphereLight(0xd8ecff, 0xc9a27e, 1.5));
        const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
        sun.position.set(-2.5, 5, 4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 2.4, bottom: -0.4, near: 0.5, far: 14 });
        sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
        s.add(sun);
        const rim = new THREE.DirectionalLight(0xffe2f0, 0.8);
        rim.position.set(3, 3, -3);
        s.add(rim);
        // the turntable: a honey-wood disc with a walnut rim
        this.table = new THREE.Group();
        s.add(this.table);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.14, 48), [texMat('wood-walnut', 0xb08868), texMat('wood-honey'), texMat('wood-walnut')]);
        disc.position.y = -0.07; disc.receiveShadow = true;
        this.table.add(disc);
        this.cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
        this.reset();
        this.bind();
    }

    reset() {
        this.yaw = 0.45; this.pitch = 0.2;
        this.dist = this.home = (H * 0.62) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        this.idleT = 0;
    }

    bind() {
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture?.(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            this.idleT = -2;
            const now = performance.now();
            if (this.pointers.size === 1) { if (now - (this.lastDown || 0) < 320) this.reset(); this.lastDown = now; }
        });
        c.addEventListener('pointermove', (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                const d0 = Math.hypot(a.x - b.x, a.y - b.y);
                p.x = e.clientX; p.y = e.clientY;
                const d1 = Math.hypot(a.x - b.x, a.y - b.y);
                if (d0 > 0) this.zoom(d0 / d1);
                return;
            }
            this.yaw += (e.clientX - p.x) * 0.012;
            this.pitch = Math.max(-0.15, Math.min(1.1, this.pitch + (e.clientY - p.y) * 0.008));
            p.x = e.clientX; p.y = e.clientY;
            this.idleT = -2;
        });
        const up = (e) => this.pointers.delete(e.pointerId);
        c.addEventListener('pointerup', up);
        c.addEventListener('pointercancel', up);
        c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015))); this.idleT = -2; }, { passive: false });
        c.addEventListener('dblclick', (e) => { e.preventDefault(); this.reset(); });
    }

    zoom(f) { this.dist = Math.max(this.home * 0.35, Math.min(this.home * 1.8, this.dist * f)); }

    /** Show a hero (or any model with an Actor); resolves to the clip names it can play. */
    async open(key) {
        this.init();
        if (this.actor) this.table.remove(this.actor.root);
        this.actor = new Actor(key, { height: H });
        this.actor.setBase('idle');
        this.table.add(this.actor.root);
        this.key = key;
        this.reset();
        this.start();
        await this.actor.ready;
        return (RIGGED[key] || []).filter((c) => this.actor.has ? this.actor.has(c) : true);
    }

    play(clip) {
        if (!this.actor) return;
        if (LOOPS.has(clip)) this.actor.setBase(clip);
        else this.actor.play(clip);
        this.idleT = Math.min(this.idleT, 0);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.last = performance.now();
        const tick = (t) => {
            if (!this.running) return;
            const dt = Math.min(0.05, (t - this.last) / 1000);
            this.last = t;
            this.frame(dt);
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    close() { this.running = false; }

    frame(dt) {
        const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
        if (!w || !h) return;
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        if (c.width !== Math.round(w * pr) || c.height !== Math.round(h * pr)) { this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false); }
        this.cam.aspect = w / h;
        // a portrait-shaped stage needs a little more distance to fit the model across
        const fit = this.cam.aspect < 0.75 ? 0.75 / this.cam.aspect : 1;
        this.idleT += dt;
        if (this.idleT > 2.5) this.yaw += dt * 0.45;
        this.table.rotation.y = this.yaw;
        const d = this.dist * fit, ty = H * 0.5;
        this.cam.position.set(0, ty + Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
        this.cam.lookAt(0, ty - 0.05, 0);
        this.cam.updateProjectionMatrix();
        this.actor?.update(dt);
        this.renderer.render(this.scene, this.cam);
    }
}
