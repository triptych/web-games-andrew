// The view: owns the scene, reads G every frame and answers its events. Never changes G.
// Sim coordinates are world metres: x east, z south, y up; yaw 0 looks toward -z.

import * as THREE from 'three';
import { CELL, PLAYER } from '../config.js';
import { LEVELS } from '../sim/data.js';
import { Stage } from './stage.js';
import { SU } from './shaderlib.js';
import { buildLevel } from './levelmesh.js';
import { buildSky } from './sky.js';
import { buildModel, animate, animateDeath } from './models.js';
import { buildGun } from './guns.js';
import { ViewModel } from './viewmodel.js';
import { FX, BLOOD, ELEM_RGB } from './fx.js';

const THEMES = {
    city: { fog: [0.07, 0.018, 0.09], density: 0.0075, ambient: [0.035, 0.028, 0.06], sky: 0.14 },
    mall: { fog: [0.035, 0.022, 0.04], density: 0.013, ambient: [0.05, 0.042, 0.055], sky: 0 },
    sewer: { fog: [0.012, 0.03, 0.014], density: 0.028, ambient: [0.018, 0.03, 0.018], sky: 0 },
    ship: { fog: [0.025, 0.01, 0.05], density: 0.018, ambient: [0.035, 0.018, 0.06], sky: 0 },
    core: { fog: [0.05, 0.006, 0.025], density: 0.016, ambient: [0.05, 0.012, 0.035], sky: 0 },
};
const KEY_HEX = [0xffffff, 0xff2a1a, 0x2a7bff, 0xffc020];
const RARITY_HEX = [0xe8e8f0, 0x5dff7a, 0x4fb4ff, 0xc86bff, 0xffc531];

export class View {
    constructor(canvas) {
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.vm = new ViewModel(this.stage.envMap);
        this.stage.addViewModel(this.vm);
        this.hemi = new THREE.HemisphereLight(0x8a7aff, 0x201020, 0.35);
        this.scene.add(this.hemi);
        this.scene.fog = new THREE.FogExp2(0x120a1e, 0.012);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.L = null;
        this.fx = new FX(this.scene, (x, z) => this.floorAt(x, z));
        this.models = new Map();
        this.corpses = [];
        this.items = new Map();
        this.barrelObjs = new Map();
        this.pending = [];
        this.shake = 0;
        this.hurtK = 0; this.flash = new THREE.Vector3(); this.aberr = 0;
        this.roll = 0;
        this.deathK = 0;
        this.beam = null;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        if (this.stage.resize()) {
            // gl_PointSize is in framebuffer pixels: a world size × this ÷ distance
            this.fx.setScale(this.stage.h * this.stage.pr * 0.5 / Math.tan(this.camera.fov * Math.PI / 360));
        }
    }
    setQuality(q) { this.stage.setQuality(q); this.resize(); }
    setFov(f) { this.camera.fov = f; this.camera.updateProjectionMatrix(); this.stage.w = 0; this.resize(); }

    floorAt(x, z) {
        const L = this.L;
        if (!L) return 0;
        const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
        if (cx < 0 || cz < 0 || cx >= L.W || cz >= L.H) return 0;
        const i = cz * L.W + cx;
        return L.solid[i] ? (L.outdoor ? L.top[i] : 99) : L.floor[i];
    }

    // ================================================================ level
    setLevel(G) {
        const L = G.L;
        if (this.level) { this.root.remove(this.level.group); this.level.dispose(); }
        if (this.sky) this.root.remove(this.sky.group);
        for (const m of this.models.values()) this.root.remove(m.root);
        for (const c of this.corpses) this.root.remove(c.m.root);
        for (const o of this.items.values()) this.root.remove(o);
        for (const o of this.barrelObjs.values()) this.root.remove(o);
        if (this.beam) { this.root.remove(this.beam); this.beam = null; }
        this.models.clear(); this.corpses.length = 0; this.items.clear(); this.barrelObjs.clear();
        this.fx.clear();
        this.L = L;
        this.levelKey = `${G.seed}:${G.level}:${G.diffIndex}`;
        const spec = LEVELS[G.level];
        this.level = buildLevel(L, spec.liquid);
        this.root.add(this.level.group);
        this.sky = buildSky(L);
        this.root.add(this.sky.group);
        const th = THEMES[L.theme];
        SU.uFogColor.value.setRGB(...th.fog);
        SU.uFogDensity.value = th.density;
        SU.uAmbient.value.setRGB(...th.ambient);
        SU.uSkyLight.value = th.sky;
        this.scene.fog.color.setRGB(...th.fog);
        this.scene.fog.density = th.density;
        this.stage.renderer.setClearColor(new THREE.Color(...th.fog));
        this.hemi.intensity = L.outdoor ? 0.45 : 0.3;
    }

    // ================================================================ items
    itemObject(pk) {
        const g = new THREE.Group();
        const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.4, metalness: o.m ?? 0.2, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1 });
        const glow = (c, k = 2.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
        const add = (geo, mat, p = [0, 0, 0], r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); g.add(m); return m; };
        let spin = true, h = 0.5;
        switch (pk.kind) {
            case 'cola': {
                add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 20), std(0xd01020, { m: 0.8, r: 0.25 }), [0, 0.16, 0]);
                add(new THREE.CylinderGeometry(0.101, 0.101, 0.08, 20), std(0xf0f0f0, { m: 0.5 }), [0, 0.18, 0]);
                add(new THREE.CylinderGeometry(0.085, 0.1, 0.03, 20), std(0xc0c4cc, { m: 1, r: 0.2 }), [0, 0.335, 0]);
                add(new THREE.TorusGeometry(0.11, 0.012, 6, 20).rotateX(Math.PI / 2), glow(0xff3050, 2), [0, 0.02, 0]);
                break;
            }
            case 'burger': {
                add(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc07a30, { r: 0.6 }), [0, 0.22, 0]);
                add(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 18), std(0x4a2410, { r: 0.8 }), [0, 0.17, 0]);
                add(new THREE.BoxGeometry(0.34, 0.015, 0.34), std(0xffc020, { r: 0.4 }), [0, 0.2, 0], [0, 0.4, 0]);
                add(new THREE.CylinderGeometry(0.22, 0.2, 0.02, 18), std(0x40c040), [0, 0.135, 0]);
                add(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 18), std(0xc07a30, { r: 0.6 }), [0, 0.09, 0]);
                break;
            }
            case 'vest': {
                add(new THREE.BoxGeometry(0.42, 0.5, 0.16), std(0x2a3a5a, { r: 0.6 }), [0, 0.3, 0]);
                add(new THREE.BoxGeometry(0.3, 0.12, 0.17), std(0x1a2236), [0, 0.42, 0]);
                add(new THREE.BoxGeometry(0.44, 0.04, 0.17), glow(0x40a0ff, 2), [0, 0.15, 0]);
                break;
            }
            case 'bullet': case 'shell': case 'cell': case 'rocket': {
                const col = { bullet: 0xc8a040, shell: 0xd02020, cell: 0x30d0ff, rocket: 0x60a030 }[pk.kind];
                add(new THREE.BoxGeometry(0.4, 0.24, 0.26), std(0x3a3d30, { m: 0.6 }), [0, 0.12, 0]);
                add(new THREE.BoxGeometry(0.405, 0.06, 0.265), glow(col, 1.8), [0, 0.16, 0]);
                if (pk.kind === 'cell') add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), glow(col, 2.5), [0, 0.3, 0]);
                if (pk.kind === 'rocket') add(new THREE.ConeGeometry(0.05, 0.16, 10), std(0xd02020), [0, 0.32, 0]);
                if (pk.kind === 'shell') for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), std(0xd02020, { r: 0.3 }), [-0.06 + k * 0.06, 0.29, 0]);
                if (pk.kind === 'bullet') for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), std(0xd8b048, { m: 0.9, r: 0.2 }), [-0.09 + k * 0.06, 0.28, 0]);
                break;
            }
            case 'bomb': {
                add(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), std(0x6a6a70, { m: 0.8 }), [0, 0.15, 0], [0, 0, Math.PI / 2]);
                add(new THREE.SphereGeometry(0.025, 8, 6), glow(0xff2020, 4), [0, 0.22, 0]);
                break;
            }
            case 'key': {
                add(new THREE.BoxGeometry(0.3, 0.2, 0.02), std(KEY_HEX[pk.key], { m: 0.4, r: 0.3, e: KEY_HEX[pk.key], ei: 0.6 }), [0, 0.6, 0]);
                add(new THREE.BoxGeometry(0.22, 0.04, 0.025), std(0x111111), [0, 0.64, 0]);
                add(new THREE.TorusGeometry(0.5, 0.02, 6, 32).rotateX(Math.PI / 2), glow(KEY_HEX[pk.key], 2.5), [0, 0.05, 0]);
                h = 0.8;
                break;
            }
            case 'tape': {
                add(new THREE.BoxGeometry(0.36, 0.2, 0.05), std(0x101012, { r: 0.4 }), [0, 0.5, 0]);
                add(new THREE.BoxGeometry(0.26, 0.09, 0.052), std(0xf0e8d8, { r: 0.7 }), [0, 0.53, 0]);
                add(new THREE.BoxGeometry(0.24, 0.02, 0.053), glow(0xff3fa4, 2.5), [0, 0.55, 0]);
                for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.054, 12).rotateX(Math.PI / 2), std(0x2a2a2a), [0.07 * s, 0.48, 0]);
                add(new THREE.TorusGeometry(0.45, 0.02, 6, 32).rotateX(Math.PI / 2), glow(0xff3fa4, 2.5), [0, 0.05, 0]);
                h = 0.7;
                break;
            }
            case 'gun': {
                const model = buildGun(pk.gun);
                model.root.position.y = 0.55;
                model.root.scale.setScalar(1.3);
                g.add(model.root);
                g.userData.gun = model;
                // the loot beam, in the rarity's colour
                const rc = new THREE.Color(RARITY_HEX[pk.gun.rarity]);
                const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 6, 12, 1, true), new THREE.ShaderMaterial({
                    uniforms: { uC: { value: new THREE.Vector3(rc.r, rc.g, rc.b) }, uTime: SU.uTime },
                    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
                    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
                    fragmentShader: 'uniform vec3 uC; uniform float uTime; varying vec2 vUv; void main(){ float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.0) * (0.7 + 0.3 * sin(uTime * 4.0 + vUv.y * 10.0)); gl_FragColor = vec4(uC * a * 1.6, a); }',
                }));
                beam.position.y = 3;
                if (pk.gun.rarity >= 1) g.add(beam);
                add(new THREE.RingGeometry(0.45, 0.55, 32).rotateX(-Math.PI / 2), glow(RARITY_HEX[pk.gun.rarity], 1.8), [0, 0.03, 0]);
                h = 0.6;
                break;
            }
        }
        g.userData.spin = spin;
        g.userData.h = h;
        g.position.set(pk.x, pk.y, pk.z);
        g.userData.phase = Math.random() * 6;
        return g;
    }

    barrelObject(b) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 20), new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.45, metalness: 0.5 }));
        body.position.y = 0.55;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.18, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd020, emissive: 0x403000, roughness: 0.5 }));
        band.position.y = 0.6;
        const top = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 0.3), toneMapped: false }));
        top.position.y = 1.105;
        for (const y of [0.15, 0.95]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.025, 6, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a1010, metalness: 0.8, roughness: 0.3 })); r.position.y = y; g.add(r); }
        g.add(body, band, top);
        g.position.set(b.x, b.y, b.z);
        return g;
    }

    syncItems(G, t) {
        const seen = new Set();
        for (const pk of G.pickups) {
            seen.add(pk.id);
            let o = this.items.get(pk.id);
            // a swapped gun keeps its pickup id but changes gun: rebuild
            if (o && pk.kind === 'gun' && o.userData.gunRef !== pk.gun) { this.root.remove(o); o = null; }
            if (!o) {
                o = this.itemObject(pk);
                o.userData.gunRef = pk.gun;
                this.items.set(pk.id, o);
                this.root.add(o);
            }
            o.position.set(pk.x, pk.y + Math.sin(t * 2.2 + o.userData.phase) * 0.06 + 0.05, pk.z);
            if (o.userData.spin) o.rotation.y = t * 1.4 + o.userData.phase;
            o.visible = (pk.x - this.camera.position.x) ** 2 + (pk.z - this.camera.position.z) ** 2 < 90 * 90;
        }
        for (const [id, o] of this.items) if (!seen.has(id)) { this.root.remove(o); this.items.delete(id); }
        for (const b of G.barrels) {
            let o = this.barrelObjs.get(b.id);
            if (!o && !b.dead) { o = this.barrelObject(b); this.barrelObjs.set(b.id, o); this.root.add(o); }
            if (o && b.dead) { this.root.remove(o); this.barrelObjs.delete(b.id); continue; }
            if (o && b.lit) { o.position.x = b.x + (Math.random() - 0.5) * 0.06; this.fx.burst('fire', b.x, b.y + 1.1, b.z, 1, { speed: 1 }); }
        }
    }

    // ================================================================ enemies
    syncEnemies(G, dt, t) {
        const seen = new Set();
        const cam = this.camera.position;
        for (const e of G.enemies) {
            seen.add(e.id);
            let m = this.models.get(e.id);
            if (!m) { m = buildModel(e.type); this.models.set(e.id, m); this.root.add(m.root); }
            const far = (e.x - cam.x) ** 2 + (e.z - cam.z) ** 2 > 85 * 85;
            m.root.visible = !far;
            if (!far) animate(m, e, dt, t);
        }
        for (const [id, m] of this.models) if (!seen.has(id)) {
            // removed without a kill event we saw (a level change): just drop it
            this.root.remove(m.root);
            this.models.delete(id);
        }
        for (let k = this.corpses.length - 1; k >= 0; k--) {
            const c = this.corpses[k];
            c.age += dt;
            const u = c.age / c.life;
            if (u >= 1) { this.root.remove(c.m.root); this.corpses.splice(k, 1); continue; }
            animateDeath(c.m, u);
        }
        // Rourke's beam and the pylons' tethers
        const r = G.enemies.find((e) => e.boss === 'rourke');
        if (r && r.beamOn) {
            if (!this.beam) {
                this.beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 40).translate(0, 0, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
                this.root.add(this.beam);
            }
            const floor = this.floorAt(r.cx, r.cz);
            this.beam.position.set(r.cx, floor + 0.6, r.cz);
            this.beam.rotation.y = r.beamA;
            this.beam.scale.set(1 + Math.sin(t * 40) * 0.2, 1 + Math.sin(t * 37) * 0.2, 1);
            this.fx.light(r.cx + Math.sin(r.beamA) * 6, floor + 1, r.cz + Math.cos(r.beamA) * 6, [3, 0.3, 1.2], 10, 0.03, 1);
        } else if (this.beam) { this.root.remove(this.beam); this.beam = null; }
        if (r && r.invuln && Math.random() < dt * 8) {
            for (const p of G.enemies.filter((e) => e.pylon)) this.fx.line([[p.x, p.y + 2.2, p.z], [r.x, r.y + 2, r.z]], [1.6, 0.6, 3], 0.05, 0.08, 0.6);
        }
    }

    // ================================================================ events
    onEvents(G, events) {
        const p = G.player;
        for (const e of events) {
            switch (e.type) {
                case 'fire': {
                    this.vm.onFire(e.arch);
                    const ex = p.x + Math.sin(p.yaw) * 0.8, ez = p.z - Math.cos(p.yaw) * 0.8;
                    const col = e.element ? ELEM_RGB[e.element] : new THREE.Color(1, 0.7, 0.35);
                    this.fx.light(ex, p.y + 1.5, ez, [col.r * 3, col.g * 3, col.b * 3], 9, 0.06, 1);
                    if (e.arch === 'shotgun' || e.arch === 'rocket') this.shake = Math.max(this.shake, 0.12);
                    break;
                }
                case 'tracer': {
                    const col = e.element ? ELEM_RGB[e.element] : new THREE.Color(1, 0.8, 0.4);
                    // start the tracer at the gun, not the eye
                    const sx = e.x0 + Math.cos(p.yaw) * 0.18 + Math.sin(p.yaw) * 0.5, sz = e.z0 + Math.sin(p.yaw) * 0.18 - Math.cos(p.yaw) * 0.5;
                    if (Math.random() < (e.arch === 'shotgun' ? 0.35 : 0.8)) this.fx.line([[sx, e.y0 - 0.2, sz], [e.x1, e.y1, e.z1]], [col.r * 2, col.g * 2, col.b * 2], 0.012, 0.05);
                    if (e.hit === 'wall') {
                        this.fx.burst('sparks', e.x1, e.y1, e.z1, 4, { speed: 2, nx: e.nx, ny: e.ny, nz: e.nz });
                        this.fx.burst('mist', e.x1, e.y1, e.z1, 1, { rgb: [0.2, 0.19, 0.2], speed: 1 });
                    }
                    break;
                }
                case 'beam': {
                    const col = e.element ? ELEM_RGB[e.element] : new THREE.Color(0.5, 0.9, 1);
                    const pts = e.pts.map((q, k) => k === 0 ? [q[0] + Math.cos(p.yaw) * 0.18 + Math.sin(p.yaw) * 0.6, q[1] - 0.2, q[2] + Math.sin(p.yaw) * 0.18 - Math.cos(p.yaw) * 0.6] : q);
                    this.fx.line(pts, [col.r * 2.5, col.g * 2.5, col.b * 3], 0.025, 0.06, 0.22);
                    const last = pts[pts.length - 1];
                    this.fx.light(last[0], last[1], last[2], [col.r * 2, col.g * 2, col.b * 2.5], 7, 0.06);
                    if (e.end !== 'none') this.fx.burst('glow', last[0], last[1], last[2], 3, { rgb: [col.r, col.g, col.b], speed: 3 });
                    break;
                }
                case 'arc': this.fx.line(e.pts, [1.2, 2.2, 3], 0.02, 0.12, 0.35); break;
                case 'hit': {
                    const m = this.models.get(e.id);
                    if (m) m.U.uHit.value = 1;
                    const type = G.enemies.find((q) => q.id === e.id)?.type || 'trooper';
                    const rgb = BLOOD[type] || [0.6, 0.05, 0.05];
                    if (type === 'drone' || type === 'pylon') this.fx.burst('sparks', e.x, e.y, e.z, 8, { speed: 3 });
                    else this.fx.burst('blood', e.x, e.y, e.z, Math.min(18, 3 + e.dmg / 4), { rgb, speed: 3 });
                    if (e.element) this.fx.burst(e.element === 'cryo' ? 'frost' : 'glow', e.x, e.y, e.z, 5, { rgb: ELEM_RGB[e.element].toArray(), speed: 2 });
                    if (e.kick) this.shake = Math.max(this.shake, 0.15);
                    break;
                }
                case 'kill': this.onKill(G, e); break;
                case 'explode': this.fx.explosion(e.x, e.y, e.z, e.r, e.element, e.big); this.shake = Math.max(this.shake, e.big ? 0.4 : 0.2); this.aberr = Math.max(this.aberr, e.big ? 0.7 : 0.35); break;
                case 'impact': {
                    if (e.kind === 'bomb') break;
                    const col = e.element ? ELEM_RGB[e.element].toArray() : e.kind === 'bolt' ? [0.3, 1, 0.7] : e.kind === 'laser' ? [1, 0.15, 0.1] : e.kind === 'psi' ? [0.8, 0.3, 1] : e.kind === 'orb' ? [1, 0.3, 0.8] : e.kind === 'spit' ? [0.6, 1, 0.1] : [1, 0.8, 0.5];
                    this.fx.burst('glow', e.x, e.y, e.z, 8, { rgb: col, speed: 3 });
                    if (e.kind === 'disc') this.fx.burst('sparks', e.x, e.y, e.z, 10, { speed: 3, nx: e.nx, ny: e.ny, nz: e.nz });
                    this.fx.light(e.x, e.y, e.z, [col[0] * 2, col[1] * 2, col[2] * 2], 5, 0.1);
                    break;
                }
                case 'hurt': this.hurtK = Math.min(1, this.hurtK + 0.25 + e.dmg / 40); this.shake = Math.max(this.shake, Math.min(0.35, e.dmg / 40)); this.aberr = Math.max(this.aberr, 0.4); this.roll = (Math.random() - 0.5) * 0.04; break;
                case 'kick': this.vm.onKick(); if (e.hits) this.shake = Math.max(this.shake, 0.2); break;
                case 'reload': this.vm.onReload(e.t); break;
                case 'land': this.vm.onLand(e.v); this.shake = Math.max(this.shake, Math.min(0.3, e.v / 50)); break;
                case 'teleport': {
                    this.fx.burst('spawn', e.x0, e.y0, e.z0, 24); this.fx.burst('spawn', e.x1, e.y1, e.z1, 24);
                    this.fx.light(e.x1, e.y1 + 1, e.z1, [1.5, 0.6, 3], 8, 0.4);
                    const m = this.models.get(e.id);
                    if (m) m.U.uHit.value = 1.5;
                    break;
                }
                case 'spawn': this.fx.burst('spawn', e.x, e.y, e.z, 30); this.fx.light(e.x, e.y + 1.2, e.z, [0.8, 1.6, 3], 8, 0.5, 1.5); break;
                case 'freeze': { const q = G.enemies.find((x) => x.id === e.id); if (q) this.fx.burst('frost', q.x, q.y + q.h * 0.5, q.z, 20, { speed: 3 }); break; }
                case 'pickup': { this.fx.burst('glow', p.x + Math.sin(p.yaw), p.y + 1, p.z - Math.cos(p.yaw), 10, { rgb: [1, 0.9, 0.5], speed: 2 }); this.flash.set(0.08, 0.07, 0.03); break; }
                case 'shockwave': this.fx.light(e.x, e.y + 0.5, e.z, [3, 1.2, 0.3], 14, 0.4); this.shake = Math.max(this.shake, 0.35); this.fx.burst('smoke', e.x, e.y, e.z, 20, { speed: 6 }); break;
                case 'supply': this.fx.line([[e.x, e.y, e.z], [e.x, e.y + 30, e.z]], [0.4, 2, 0.8], 0.15, 0.6); this.fx.burst('spawn', e.x, e.y, e.z, 20); break;
                case 'slam': this.fx.burst('smoke', e.x, e.y + 1, e.z, 12, { speed: 3 }); this.shake = Math.max(this.shake, 0.2); break;
                case 'eshot': this.fx.light(e.x, e.y, e.z, e.kind === 'laser' ? [3, 0.3, 0.2] : e.kind === 'psi' ? [1.5, 0.5, 3] : [0.5, 3, 1.5], 6, 0.08); break;
                case 'bossDead': {
                    const b = this.lastBoss;
                    if (b) for (let k = 0; k < 8; k++) this.pending.push({ t: k * 0.22, fn: () => this.fx.explosion(b.x + (Math.random() - 0.5) * 4, b.y + 1 + Math.random() * 3, b.z + (Math.random() - 0.5) * 4, 5, null, true) });
                    this.flash.set(0.6, 0.5, 0.4);
                    break;
                }
                case 'overdrive': if (e.on) { this.flash.set(0.5, 0.1, 0.4); this.aberr = 1; } break;
                case 'death': this.shake = 0.6; break;
            }
        }
    }

    onKill(G, e) {
        const m = this.models.get(e.id);
        const rgb = BLOOD[e.etype] || [0.6, 0.05, 0.05];
        if (e.boss) this.lastBoss = { x: e.x, y: e.y, z: e.z };
        if (m) this.models.delete(e.id);
        const f = this.floorAt(e.x, e.z);
        if (e.shatter) {
            if (m) this.root.remove(m.root);
            this.fx.shatter(e.x, e.y, e.z, 22);
            return;
        }
        if (e.gib && m) {
            this.root.remove(m.root);
            const n = Math.round(10 + e.h * 6);
            if (e.etype === 'drone') { this.fx.explosion(e.x, e.y + 0.4, e.z, 2.5, null, false); this.fx.burst('sparks', e.x, e.y + 0.4, e.z, 30, { speed: 6 }); }
            else {
                this.fx.gib(e.x, e.y + e.h * 0.4, e.z, (e.dx || 0) * 6, (e.dz || 0) * 6, rgb, n);
                this.fx.burst('blood', e.x, e.y + e.h * 0.5, e.z, 40, { rgb, speed: 6 });
                this.fx.burst('mist', e.x, e.y + e.h * 0.5, e.z, 8, { rgb: rgb.map((c) => c * 0.6), speed: 2 });
                this.fx.decal(e.x, f, e.z, 2 + e.h * 0.5, rgb.map((c) => c * 0.55));
            }
            this.shake = Math.max(this.shake, 0.15);
            return;
        }
        if (m) {
            this.corpses.push({ m, age: 0, life: e.boss ? 3 : 1.6 });
            if (e.etype === 'drone') { this.fx.explosion(e.x, e.y + 0.4, e.z, 2.2, null, false); }
            else this.fx.decal(e.x, f, e.z, 1 + e.h * 0.4, rgb.map((c) => c * 0.55));
            this.fx.burst('blood', e.x, e.y + e.h * 0.5, e.z, 16, { rgb, speed: 3 });
        }
    }

    // ================================================================ per frame
    frame(G, dt, time, o = {}) {
        this.resize();
        SU.uTime.value = time;
        if (!this.L || this.levelKey !== `${G.seed}:${G.level}:${G.diffIndex}` || this.L !== G.L) this.setLevel(G);
        const p = G.player;
        // pending timed effects
        for (let k = this.pending.length - 1; k >= 0; k--) { this.pending[k].t -= dt; if (this.pending[k].t <= 0) { this.pending[k].fn(); this.pending.splice(k, 1); } }
        // camera
        this.shake = Math.max(this.shake, this.fx.shake);
        this.fx.shake = 0;
        const sh = this.shake * this.shake;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        this.deathK = p.dead ? Math.min(1, this.deathK + dt * 1.5) : 0;
        const eye = p.y + PLAYER.eye - this.deathK * 1.3;
        this.camera.position.set(p.x + (Math.random() - 0.5) * sh * 0.4, eye + (Math.random() - 0.5) * sh * 0.4, p.z + (Math.random() - 0.5) * sh * 0.4);
        this.roll *= Math.max(0, 1 - dt * 4);
        this.camera.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.05, -p.yaw, this.roll + this.deathK * 0.6 + (Math.random() - 0.5) * sh * 0.04);
        // level pieces
        this.sky?.update(time);
        if (this.sky) this.sky.group.children[0] && this.sky.group.children[0].position.copy(this.camera.position);
        const lv = this.level;
        lv.doors.list.forEach((d) => {
            const k = G.doorOpen[d.door.id] ?? 0;
            d.mat.emissiveIntensity = G.doorLock[d.door.id] ? 0.9 + Math.sin(time * 10) * 0.5 : (p.keys & (1 << d.door.key)) ? 0.6 : 0.15;
            for (const m of d.meshes) m.position.y = m.userData.base + (m.userData.sink ? -k : k) * (m.userData.h - 0.1);
        });
        for (const f of lv.signs.flicker) {
            const on = Math.sin(time * 13 + f.seed) + Math.sin(time * 3.1 + f.seed * 2) > -1.2;
            f.mat.color.copy(f.base).multiplyScalar(on ? 1 : 0.15);
        }
        const exitOn = G.exitOpen && G.ambush !== 'active' && G.L.boss !== 'rourke';
        lv.exit.visible = exitOn;
        if (exitOn) { lv.exit.userData.ring.rotation.z = time; lv.exit.userData.sign.rotation.y = time * 0.8; }
        this.syncItems(G, time);
        this.syncEnemies(G, dt, time);
        this.fx.syncProjectiles(G, dt, time);
        this.fx.syncWaves(G);
        const extra = [];
        if (exitOn) extra.push([lv.exit.position.x, lv.exit.position.y + 1.5, lv.exit.position.z, 0.4, 2.2, 0.8, 8]);
        if (p.jet) extra.push([p.x, p.y + 0.3, p.z, 2.4, 1.2, 0.4, 5]);
        this.fx.update(dt, this.camera.position, extra);
        // the gun in your hands
        const gun = p.weapons[p.cur];
        this.vm.setGun(gun);
        const light = this.level.lightmap.userData.sample(p.x, p.z);
        this.vm.update(p, dt, o.lookDX || 0, o.lookDY || 0, light, p.spin || 0);
        this.vm.rig.visible = !p.dead;
        // post
        const V = this.stage.vhs.uniforms;
        this.hurtK = Math.max(0, this.hurtK - dt * 1.8);
        this.aberr = Math.max(0, this.aberr - dt * 2.5);
        this.flash.multiplyScalar(Math.max(0, 1 - dt * 6));
        V.uTime.value = time;
        V.uDamage.value = this.hurtK;
        V.uAberr.value = this.aberr;
        V.uOver.value += ((p.overdrive > 0 ? 1 : 0) - V.uOver.value) * Math.min(1, dt * 4);
        V.uLow.value = p.hp < 30 && !p.dead ? (1 - p.hp / 30) * (0.7 + 0.3 * Math.sin(time * 6)) : 0;
        V.uFlash.value.copy(this.flash);
        V.uDead.value = this.deathK;
        V.uScan.value = o.scan ?? 0.6;
        this.stage.render();
    }
}
