// GIANT'S VAULT: the three.js view. Reads G every frame and answers its events; never changes G.
// Sim (x, y) maps to world (x, 0, y). The camera looks down from the south at about 52°, so sim "up" (−y) is screen up.

import * as THREE from 'three';
import { AREAS } from '../sim/data/world.js';
import { buildLevel } from './level.js';
import { Actors } from './actors.js';
import { Fx } from './fx.js';
import { Overlay } from './overlay.js';

const TEX = {};
export function texture(name, repeat = true) {
    if (TEX[name]) return TEX[name];
    const t = new THREE.TextureLoader().load(`art/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return (TEX[name] = t);
}

export class View {
    constructor(canvas, overlayCanvas, opts = {}) {
        this.canvas = canvas;
        this.low = !!opts.low;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x101018, 18, 42);
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 120);
        this.hemi = new THREE.HemisphereLight(0x9a8ab0, 0x201418, 1.1);
        this.sun = new THREE.DirectionalLight(0xffe0c0, 1.4);
        this.sun.position.set(-8, 20, -6);
        this.lamp = new THREE.PointLight(0xffc890, 40, 16, 1.6);     // the light the warden carries
        this.scene.add(this.hemi, this.sun, this.sun.target, this.lamp);
        this.actors = new Actors(this);
        this.fx = new Fx(this);
        this.overlay = new Overlay(this, overlayCanvas);
        this.levelUid = null;
        this.level = null;
        this.camPos = new THREE.Vector3();
        this.zoom = 1;
        this.shake = 0;
        this.ray = new THREE.Raycaster();
        this.info = { tris: 0, models: this.actors.modelState };
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        // portrait phones see the same width of world as a landscape screen sees height
        this.dist = 17 * Math.max(1, 0.75 / this.camera.aspect);
        this.camera.far = this.dist * 4;
        this.camera.updateProjectionMatrix();
        this.overlay.resize(w, h);
    }

    /** Rebuild the level when the area changes. */
    ensureLevel(G) {
        if (this.levelUid === G.area.uid) return;
        this.levelUid = G.area.uid;
        if (this.level) { this.scene.remove(this.level.group); this.level.dispose(); }
        this.level = buildLevel(G, this);
        this.scene.add(this.level.group);
        const def = AREAS[G.area.id];
        this.scene.fog.color.setHex(def.fog);
        this.renderer.setClearColor(def.sky);
        this.hemi.color.setHex(def.ambient);
        this.sun.color.setHex(def.light);
        this.sun.intensity = G.area.kind === 'town' ? 1.6 : 1.1;
        this.lamp.color.setHex(def.light);
        this.actors.resetArea(G);
        this.fx.resetArea();
        // jump the camera there
        this.camPos.set(G.player.x, 0, G.player.y);
    }

    /** Client px → sim point on the ground (or null). */
    pick(clientX, clientY, height = 0) {
        const r = this.canvas.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
        this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
        const o = this.ray.ray.origin, d = this.ray.ray.direction;
        if (Math.abs(d.y) < 1e-6) return null;
        const t = (height - o.y) / d.y;
        if (t < 0) return null;
        return { x: o.x + d.x * t, y: o.z + d.z * t };
    }

    /** The monster under the mouse (checks the ground point and a point at chest height). */
    pickMonster(G, clientX, clientY) {
        const pts = [this.pick(clientX, clientY, 0), this.pick(clientX, clientY, 1.0)].filter(Boolean);
        let best = null, bd = Infinity;
        for (const m of G.mons) {
            if (m.life <= 0) continue;
            for (const p of pts) {
                const d = Math.hypot(m.x - p.x, m.y - p.y) - m.radius;
                if (d < 0.5 && d < bd) { bd = d; best = m; }
            }
        }
        return best;
    }

    /** Sim point (and height) → client px. */
    screenOf(x, y, h = 0) {
        const v = new THREE.Vector3(x, h, y).project(this.camera);
        return { x: (v.x + 1) * 0.5 * this.w, y: (1 - v.y) * 0.5 * this.h, behind: v.z > 1 };
    }

    onEvents(G, events) {
        for (const e of events) {
            if ((e.type === 'hit' && e.crit) || e.type === 'leap') this.shake = Math.max(this.shake, 0.12);
            if (e.type === 'nova' && e.r > 4) this.shake = Math.max(this.shake, 0.3);
            if (e.type === 'zone' && (e.kind === 'quake' || e.kind === 'thunderstrike')) this.shake = Math.max(this.shake, 0.25);
            if (e.type === 'hurt') this.shake = Math.max(this.shake, Math.min(0.3, e.amt / G.player.stats.maxLife));
        }
        this.actors.onEvents(G, events);
        this.fx.onEvents(G, events);
        this.overlay.onEvents(G, events);
    }

    frame(G, dt, time, ui = {}) {
        this.resize();
        if (!G?.area) { this.renderer.render(this.scene, this.camera); return; }
        this.ensureLevel(G);
        const P = G.player;
        // camera: eased follow, a touch of lead in the direction of movement, shake on big hits
        const k = 1 - Math.exp(-dt * 6);
        this.camPos.x += (P.x - this.camPos.x) * k;
        this.camPos.z += (P.y - this.camPos.z) * k;
        this.shake = Math.max(0, this.shake - dt * 1.5);
        const sx = (Math.sin(time * 61) * this.shake) * 0.5, sz = (Math.cos(time * 53) * this.shake) * 0.5;
        const d = this.dist * this.zoom;
        this.camera.position.set(this.camPos.x + sx, d * 0.79, this.camPos.z + d * 0.62 + sz);
        this.camera.lookAt(this.camPos.x + sx, 0.8, this.camPos.z + sz);
        this.scene.fog.near = d * 1.05; this.scene.fog.far = d * 2.3;
        this.lamp.position.set(P.x, 3.2, P.y + 0.6);
        this.sun.position.set(this.camPos.x - 8, 20, this.camPos.z - 6);
        this.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
        this.level?.update?.(G, dt, time);
        this.actors.frame(G, dt, time);
        this.fx.frame(G, dt, time);
        this.renderer.render(this.scene, this.camera);
        this.info.tris = this.renderer.info.render.triangles;
        this.overlay.frame(G, dt, time, ui);
    }
}
