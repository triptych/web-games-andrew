// The view: reads G every frame and answers its events; never changes G.
// World mode renders the current map in first person; scan mode renders the Lumen Lens.

import * as THREE from 'three';
import { CELL, EYE } from '../config.js';
import { Stage } from './stage.js';
import { buildLevel, THEMES } from './level.js';
import { buildModel, setModelQuality } from './models.js';
import { ScanView } from './board.js';
import { Bursts } from './fx.js';
import { timeUniform } from './shaders.js';
import { mapEnts } from '../sim/world.js';
import { patientById } from '../sim/game.js';
import { MAPS } from '../sim/data/maps.js';

// the Lens is for reading motes: a little bloom on what is really bright, nothing that washes the grid out
const SCAN_GRADE = { tint: [0.95, 1.0, 1.06], lift: [0, 0.005, 0.02], sat: 1.0, vignette: 0.5, grain: 0.025, exposure: 0.95, bloom: 0.32, threshold: 0.9 };

export class View {
    constructor(canvas, quality = 1) {
        setModelQuality(quality);
        this.stage = new Stage(canvas, quality);
        this.camera = this.stage.camera;
        this.scene = new THREE.Scene();
        this.scan = new ScanView(this.stage);
        this.stage.onResize = () => this.scan.fit();
        this.models = new Map();           // ent key → { g, id, mood, happyT, yaw }
        this.bursts = new Bursts(500);
        this.ring = this.makeRing();
        this.beacon = this.makeBeacon();
        this.mapId = null;
        this.fade = 1;
        this.happy = new Map();            // patient id → time left being happy
        this.portraits = new Map();
        this.bob = 0;
        this.mode = 'world';
    }

    get canvas() { return this.stage.canvas; }

    makeRing() {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.2, 0.6), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 3;
        return m;
    }

    makeBeacon() {
        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: timeUniform, uNear: { value: 1 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform float uTime; uniform float uNear; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.5) * (0.12 + 0.06 * sin(uTime * 3.0 + vUv.y * 8.0)) * uNear; gl_FragColor = vec4(vec3(1.0, 0.85, 0.45) * a, 1.0); }',
            transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 9, 12, 1, true), mat);
        m.renderOrder = 5;
        return m;
    }

    loadMap(mapId) {
        this.mapId = mapId;
        this.scene = new THREE.Scene();
        this.level = buildLevel(mapId, this.stage.quality);
        this.scene.add(this.level.root);
        this.scene.fog = this.level.fog;
        this.scene.background = this.level.bg;
        this.scene.environment = this.stage.envRoom;
        this.scene.environmentIntensity = this.level.themeId === 'clinic' ? 0.4 : 0.25;
        this.scene.add(this.bursts.points, this.ring, this.beacon);
        this.models.clear();
        this.stage.setGrade(this.level.theme.grade);
        this.fade = 1;
    }

    setQuality(q) {
        setModelQuality(q);
        this.stage.setQuality(q);
        if (this.mapId) this.loadMap(this.mapId);
    }

    /** Keep the monsters and the cast in step with the sim's entity list. */
    syncModels(G) {
        const want = new Set();
        for (const e of mapEnts(G)) {
            if (e.kind !== 'patient' && e.kind !== 'npc') continue;
            const key = `${e.kind}:${e.id}`;
            want.add(key);
            let m = this.models.get(key);
            const species = e.kind === 'npc' ? e.id : patientById(G, e.id)?.species;
            if (!m) {
                const p = e.kind === 'patient' ? patientById(G, e.id) : null;
                const g = buildModel(species, p?.name ?? e.id);
                this.scene.add(g);
                m = { g, id: e.id, kind: e.kind, yaw: 0 };
                this.models.set(key, m);
            }
            const tx = (e.x + 0.5) * CELL, tz = (e.y + 0.5) * CELL;
            const ty = e.onTable ? 0.9 : 0;
            if (m.cell !== `${e.x},${e.y}`) {
                if (m.cell) this.bursts.emit(new THREE.Vector3(tx, 1, tz), new THREE.Color(0.8, 1.4, 2.0), { n: 24, speed: 1.5, up: 1, life: 0.8 });
                m.g.position.set(tx, ty, tz);
                m.cell = `${e.x},${e.y}`;
            }
            m.healed = e.kind === 'patient' && patientById(G, e.id)?.state === 'healed';
            m.boss = !!e.boss;
        }
        for (const [k, m] of this.models) if (!want.has(k)) { this.scene.remove(m.g); this.models.delete(k); }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'scanStart': {
                    if (!G.scan) break;
                    const p = patientById(G, e.id);
                    this.scan.open(G.scan.S, p.species, p.name);
                    this.fade = 1;
                    this.stage.setGrade(SCAN_GRADE);
                    this.mode = 'scan';
                    break;
                }
                case 'scanEvents': if (G.scan) this.scan.sync(G.scan.S, e.list); break;
                case 'scanEnd':
                    this.scan.close();
                    this.mode = 'world';
                    this.fade = 1;
                    if (this.level) this.stage.setGrade(this.level.theme.grade);
                    if (e.won) {
                        this.happy.set(e.id, 6);
                        const m = this.models.get(`patient:${e.id}`);
                        if (m) this.bursts.emit(m.g.position.clone().setY(m.g.userData.height * 0.6), new THREE.Color(1.6, 1.4, 0.6), { n: 60, speed: 2.4, up: 1.4, life: 1.4, size: 0.08 });
                    }
                    break;
                case 'trap': case 'chest': case 'relic': {
                    const c = e.type === 'trap' ? new THREE.Color(1.6, 1.3, 0.5) : new THREE.Color(1.8, 1.5, 0.6);
                    if (e.x != null) this.bursts.emit(new THREE.Vector3((e.x + 0.5) * CELL, 1, (e.y + 0.5) * CELL), c, { n: 40, speed: 2, up: 1.2, life: 1 });
                    break;
                }
                case 'gate': this.fade = 0.4; break;
                case 'travel': this.fade = 1; break;
                default: break;
            }
        }
    }

    /** Render a portrait of a model to a data URL (dialogue). Cached. */
    portrait(id, name = '') {
        const key = `${id}|${name}`;
        if (this.portraits.has(key)) return this.portraits.get(key);
        const S = 256;
        const r = this.stage.renderer;
        const scene = new THREE.Scene();
        scene.environment = this.stage.envRoom;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.2));
        const key2 = new THREE.DirectionalLight(0xffffff, 1.5); key2.position.set(2, 3, 4); scene.add(key2);
        const rim = new THREE.DirectionalLight(0x9ad0ff, 1.2); rim.position.set(-3, 2, -2); scene.add(rim);
        const g = buildModel(id, name);
        g.userData.anim?.(1, 'idle');
        scene.add(g);
        g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g);
        const h = g.userData.height;
        // small folk: the whole body; tall folk: head and shoulders
        const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
        let focusY, span;
        if (h <= 1.35) { focusY = (box.min.y + box.max.y) / 2; span = Math.max(box.max.y - box.min.y, box.max.x - box.min.x) * 0.62; }
        else { span = Math.min(h * 0.32, 1.1) * (id === 'dragon' ? 2.2 : 1); focusY = Math.min(box.max.y, h * 1.02) - span * 0.75; }
        cam.position.set(span * 0.5, focusY + span * 0.2, Math.max(box.max.z, 0.3) + span * 3.4);
        cam.lookAt(0, focusY, 0);
        const rt = new THREE.WebGLRenderTarget(S, S, { samples: 0 });
        const prev = r.getRenderTarget();
        const prevTM = r.toneMapping;
        r.setRenderTarget(rt);
        r.setClearColor(0x000000, 0);
        r.clear();
        r.render(scene, cam);
        const px = new Uint8Array(S * S * 4);
        r.readRenderTargetPixels(rt, 0, 0, S, S, px);
        r.setRenderTarget(prev);
        r.setClearColor(0x05060c, 1);
        r.toneMapping = prevTM;
        rt.dispose();
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(S, S);
        // flip vertically and convert linear → sRGB-ish for the DOM
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const si = ((S - 1 - y) * S + x) * 4, di = (y * S + x) * 4;
            for (let k = 0; k < 3; k++) img.data[di + k] = Math.min(255, Math.pow(px[si + k] / 255, 1 / 2.2) * 255);
            img.data[di + 3] = px[si + 3];
        }
        ctx.putImageData(img, 0, 0);
        const url = c.toDataURL();
        this.portraits.set(key, url);
        return url;
    }

    frame(G, dt, time, ui = {}) {
        this.stage.resize();
        timeUniform.value = time;
        this.fade = Math.max(0, this.fade - dt * 2.2);
        this.stage.grade.uniforms.uFade.value = this.fade * this.fade;
        if (G.scan && this.mode === 'scan') {
            const S = G.scan.S;
            const heal = S.goals.length ? S.goals.reduce((a, g) => a + Math.min(1, g.have / g.n), 0) / S.goals.length : 0;
            this.scan.frame(dt, time, heal);
            this.stage.grade.uniforms.uAberr.value = this.scan.flash * 0.6;
            this.stage.grade.uniforms.uFlash.value.setScalar(this.scan.flash * 0.25);
            this.stage.render(this.scan.scene, this.scan.camera, time);
            return;
        }
        this.stage.grade.uniforms.uAberr.value = 0;
        this.stage.grade.uniforms.uFlash.value.setScalar(0);
        if (G.map !== this.mapId) this.loadMap(G.map);
        this.syncModels(G);
        const P = G.player;
        // camera: head bob from distance walked
        const walk = P.walk || 0;
        this.bob += ((ui.moving ? 1 : 0) - this.bob) * Math.min(1, dt * 6);
        const bobY = Math.sin(walk * 3.4) * 0.045 * this.bob;
        const bobX = Math.cos(walk * 1.7) * 0.03 * this.bob;
        this.camera.position.set(P.x + Math.cos(P.yaw) * bobX, EYE + bobY, P.z + Math.sin(P.yaw) * bobX);
        this.camera.rotation.set(P.pitch, -P.yaw, 0);
        // monsters turn to look at you
        for (const m of this.models.values()) {
            const dx = this.camera.position.x - m.g.position.x, dz = this.camera.position.z - m.g.position.z;
            const want = Math.atan2(dx, dz);
            let d = want - m.yaw;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const near = dx * dx + dz * dz < 64;
            if (near || m.kind === 'npc') m.yaw += d * Math.min(1, dt * (m.boss ? 1 : 3));
            m.g.rotation.y = m.yaw;
            const h = this.happy.get(m.id) ?? 0;
            if (h > 0) this.happy.set(m.id, h - dt);
            const mood = m.kind === 'npc' ? 'idle' : !m.healed ? 'hurt' : h > 0 ? 'happy' : 'idle';
            m.g.userData.anim?.(time, mood);
        }
        // prop states
        const states = new Map();
        const tableBusy = G.patients.some((p) => p.where === 'clinic' && p.state === 'table');
        for (const e of mapEnts(G)) {
            const o = this.level.ents.get(e.key);
            if (o) states.set(o, { open: e.open, disarmed: e.disarmed, ready: tableBusy, points: G.points > 0 });
        }
        for (const [key, o] of this.level.ents) {
            if (!states.has(o)) {
                const [x, y] = key.split(',').map(Number);
                const ch = MAPS[G.map].grid[y][x];
                if (ch === 'L') states.set(o, { ready: tableBusy });
                if (ch === 'g') states.set(o, { points: G.points > 0 });
                if (ch === 'e') o.visible = false;
            }
        }
        this.level.update(time, states);
        // the "use" ring under what you are facing, and the objective's beacon
        const f = ui.facing;
        this.ring.visible = !!f;
        if (f) { this.ring.position.set((f.x + 0.5) * CELL, 0.05, (f.y + 0.5) * CELL); this.ring.material.opacity = 0.45 + Math.sin(time * 5) * 0.2; this.ring.rotation.z = time * 0.6; }
        const o = ui.objective;
        this.beacon.visible = !!(o && o.x != null && !(f && f.key === o.key));
        if (this.beacon.visible) {
            this.beacon.position.set((o.x + 0.5) * CELL, 4.5, (o.y + 0.5) * CELL);
            const dd = Math.hypot(this.beacon.position.x - P.x, this.beacon.position.z - P.z);
            this.beacon.material.uniforms.uNear.value = Math.min(1, Math.max(0, (dd - 4) / 8));
        }
        this.bursts.update(dt);
        this.stage.render(this.scene, this.camera, time);
    }
}

export { THEMES };
