// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x, 0, y): x is east, sim y (south) is world +z.

import * as THREE from 'three';
import { WORLD, VEH } from '../config.js';
import { BUILDINGS } from '../sim/data/city.js';
import { current, target } from '../sim/game.js';
import { buildingUp } from '../sim/world.js';
import { Town } from './town.js';
import { Vehicles } from './vehicles.js';
import { Fx } from './fx.js';
import { modelState } from './models.js';

const SKY = 0x8fd3ff;

export class View {
    constructor(canvas, { low = false } = {}) {
        this.canvas = canvas;
        this.low = low;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(SKY);
        this.renderer.shadowMap.enabled = !low;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(SKY, 90, 260);
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);

        this.scene.add(new THREE.HemisphereLight(0xdff1ff, 0x6fa85a, 1.25));
        this.sun = new THREE.DirectionalLight(0xfff4dc, 2.1);
        this.sun.castShadow = !low;
        this.sun.shadow.mapSize.set(2048, 2048);
        const sc = this.sun.shadow.camera;
        sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 160;
        this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
        this.scene.add(this.sun, this.sun.target);

        this.town = new Town(this.scene, { shadows: !low });
        this.vehicles = new Vehicles(this.scene);
        this.fx = new Fx(this.scene);

        // the arrow that floats over the truck and points at the next thing to do
        this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
        this.arrow.geometry.rotateX(Math.PI / 2);
        this.scene.add(this.arrow);

        this.camYaw = null;
        this.focus = new THREE.Vector3();
        this.shakeT = 0;
        this.info = { models: modelState, tris: 0 };
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
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.camera.aspect = w / h;
        this.camera.fov = w < h ? 62 : 50;    // a portrait phone sees more of the road ahead
        this.camera.updateProjectionMatrix();
    }

    /** Screen position (CSS px) of a point on the ground, for the tests. */
    screenOf(x, y, h = 0) {
        const v = new THREE.Vector3(x, h, y).project(this.camera);
        return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, front: v.z < 1 };
    }

    onEvents(G, events) {
        const fx = this.fx, p = G.p, fwd = (d) => [p.x + Math.cos(p.a) * d, p.y + Math.sin(p.a) * d];
        for (const e of events) {
            if (e.type === 'switch') { this.vehicles.switched(); fx.burst('puff', p.x, 1.5, p.y, 14); }
            else if (e.type === 'loaded') fx.burst('dust', p.x, 2.5, p.y, 12);
            else if (e.type === 'dumped') { const [x, z] = fwd(-3); fx.burst('dust', x, 0.6, z, 18); fx.burst('bits', x, 0.6, z, 6, 0x6b5a48); }
            else if (e.type === 'rolled') fx.burst('dust', e.x, 0.3, e.y, 3);
            else if (e.type === 'cleared') { fx.burst('dust', e.x, 0.8, e.y, 14); fx.burst('bits', e.x, 0.8, e.y, 8, 0x8d8f94); }
            else if (e.type === 'scoop') fx.burst('dust', e.x, 0.5, e.y, 5);
            else if (e.type === 'digTick') { fx.burst('bits', e.x, 0.4, e.y, 6, 0x6b4a2e); fx.burst('dust', e.x, 0.4, e.y, 3); }
            else if (e.type === 'pourTick') { const [x, z] = fwd(-2.6); fx.burst('wet', (x + e.x) / 2, 1.6, (z + e.y) / 2, 8); }
            else if (e.type === 'dug' || e.type === 'poured') fx.burst('confetti', e.x, 0.5, e.y, 10);
            else if (e.type === 'placed') { fx.burst('confetti', e.x, 2, e.y, 14); this.shakeT = 0.15; }
            else if (e.type === 'smash') { fx.burst('bits', e.x, 4, e.y, 26); fx.burst('dust', e.x, 3, e.y, 14); this.town.shake(e.building || 'cannery'); this.shakeT = 0.35; }
            else if (e.type === 'collapse') { for (let i = 0; i < 5; i++) { fx.burst('dust', e.x + (i - 2) * 3, 2, e.y + (i % 2) * 4 - 2, 16); fx.burst('bits', e.x + (i - 2) * 3, 3, e.y, 14); } this.shakeT = 0.9; }
            else if (e.type === 'bump') { fx.burst('puff', e.x, 1, e.y, 5); this.shakeT = Math.max(this.shakeT, 0.15); }
            else if (e.type === 'jobDone') for (let i = 0; i < 4; i++) fx.burst('confetti', p.x + (i - 1.5) * 3, 3, p.y, 26);
            else if (e.type === 'allDone') for (let i = 0; i < 6; i++) fx.burst('confetti', 48 + (i - 2.5) * 4, 4, 40, 40);
        }
    }

    /** opts.orbit: the title screen's slow turn around the town instead of the chase camera. */
    frame(G, dt, time, { orbit = false } = {}) {
        this.resize();
        const p = G.p, c = current(G);
        const tg = target(G);
        const lift = c && c.st.kind === 'lift' && G.veh === 'crane' ? c.st : null;
        this.town.frame(G, dt, time, orbit ? null : tg);
        this.vehicles.frame(G, dt, time, { lift });
        this.fx.frame(dt);

        // the arrow
        this.arrow.visible = !orbit && !!tg && Math.hypot(tg.x - p.x, tg.y - p.y) > Math.max(4, tg.r);
        if (this.arrow.visible) {
            const a = Math.atan2(tg.y - p.y, tg.x - p.x);
            this.arrow.position.set(p.x + Math.cos(a) * 3.2, 4.6 + Math.sin(time * 4) * 0.2, p.y + Math.sin(a) * 3.2);
            this.arrow.rotation.y = Math.PI / 2 - a;
            this.arrow.material.color.setHex(G.veh === tg.veh ? 0xffd23f : 0xff7a59);
        }

        const cam = this.camera;
        if (orbit) {
            const a = time * 0.06;
            cam.position.set(WORLD.w * 0.42 + Math.cos(a) * 58, 34, WORLD.h / 2 + Math.sin(a) * 58);
            cam.lookAt(WORLD.w * 0.42, 0, WORLD.h / 2);
            this.focus.set(WORLD.w * 0.42, 0, WORLD.h / 2);
        } else {
            // a chase camera: behind and above, easing round as the truck turns
            if (this.camYaw == null) this.camYaw = p.a;
            let d = p.a - this.camYaw;
            while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
            this.camYaw += d * Math.min(1, dt * 3.2);
            const portrait = this.w < this.h, back = portrait ? 17 : 14.5;
            let high = portrait ? 12.5 : 9;
            const cx = p.x - Math.cos(this.camYaw) * back, cz = p.y - Math.sin(this.camYaw) * back;
            // never film from inside a building: climb over it
            for (const b of BUILDINGS) if (cx > b.x - 1.5 && cx < b.x + b.w + 1.5 && cz > b.y - 1.5 && cz < b.y + b.h + 1.5 && buildingUp(G, b)) high = Math.max(high, b.tall + 9);
            this.camHigh = this.camHigh == null ? high : this.camHigh + (high - this.camHigh) * Math.min(1, dt * 4);
            cam.position.set(cx, this.camHigh, cz);
            if (this.shakeT > 0 && !this.fx.calm) { this.shakeT -= dt; cam.position.x += (Math.random() - 0.5) * 0.5 * this.shakeT; cam.position.y += (Math.random() - 0.5) * 0.5 * this.shakeT; }
            this.focus.set(p.x + Math.cos(this.camYaw) * 4, 1.5, p.y + Math.sin(this.camYaw) * 4);
            cam.lookAt(this.focus);
        }
        // the sun's shadow box follows what is being looked at
        this.sun.position.set(this.focus.x + 30, 60, this.focus.z + 22);
        this.sun.target.position.copy(this.focus);
        this.renderer.render(this.scene, cam);
        this.info.tris = this.renderer.info.render.triangles;
    }
}
