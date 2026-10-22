// The view: reads G every frame and answers its events. It owns the field scene (terrain, props, people, sky, lights), the
// battle scene, the camera work and the post stack, and decides which of them is on screen. It never writes G.

import * as THREE from 'three';
import { LEVEL_H, OVER_W } from '../config.js';
import { LOCS, ZONE_KEYS } from '../sim/world/locations.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { ITEMS } from '../sim/data/items.js';
import { STATUS_INFO } from '../sim/data/classes.js';
import { dungeonTheme } from '../sim/world/dungeon.js';
import { buildAtlas, TEX } from './texatlas.js';
import { Stage } from './stage.js';
import { Sky } from './sky.js';
import { SpriteLib, registerEnemies, glowTexture, iconTexture } from './sprites.js';
import { Actors, groundY, Billboard } from './actors.js';
import { Fx, SHAPE } from './fx.js';
import { buildMap, WATER_Y } from './mapmesh.js';
import { BattleView } from './battle3d.js';
import { Geo, G as UG } from './geo.js';
import * as P from './props.js';
import { hash3 } from '../rng.js';
import { getMap } from '../sim/world/maps.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const KINDS = {
    over: { dist: 19, pitch: 40, fov: 28, range: 0.2, blur: 3.0, bloom: 0.36 },
    town: { dist: 17, pitch: 40, fov: 28, range: 0.19, blur: 3.0, bloom: 0.4 },
    dungeon: { dist: 14, pitch: 44, fov: 29, range: 0.18, blur: 2.6, bloom: 0.5 },
};

export class View {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        const q = opts.quality ?? 2;
        this.quality = q;
        this.stage = new Stage(canvas, q);
        this.lib = new SpriteLib(); registerEnemies(ENEMIES);
        this.atlas = buildAtlas();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.3, 260);
        this.sky = new Sky(this.scene, q);
        this.lantern = new THREE.PointLight(0xffe2b0, 0, 10, 1.5); this.scene.add(this.lantern);
        this.actors = new Actors(this.scene, this.lib);
        this.fx = new Fx(this.scene); this.fx.camera = this.camera;
        this.fx.shake = (a) => this.stage.kick(a); this.fx.flash = (r, g, b, a) => this.stage.flash(r, g, b, a);
        this.glowTex = glowTexture();
        this.map = null; this.mapRec = null; this.halos = null; this.dyn = new Map(); this.locks = new Map();
        this.yaw = 0; this.yawGoal = 0; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.lookAt = null;
        this.camInit = false; this.zoom = 1; this.shakeT = 0;
        this.mode = 'field'; this.fade = 1; this.fadeGoal = 1; this.fadeSpeed = 3; this.trans = null; this.pendingBattle = null;
        this.marks = {}; this.markT = 0;
        this.time = 0; this.reduced = false; this.speed = 1;
        this.hooks = {};   // popup, banner, sfx... set by main
        this.battle = null;
        this.atlasCanvas = () => this.atlas.image;
        this.markerTex = iconTexture('chest');
        this.stage.setScene(this.scene, this.camera);
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize); window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth)), h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.stage.resize(w, h, true);
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
        if (this.battle) { this.battle.camera.aspect = w / h; this.battle.camera.updateProjectionMatrix(); }
    }

    ensureBattle() {
        if (this.battle) return this.battle;
        const h = this.hooks, self = this;
        this.battle = new BattleView({
            stage: this.stage, lib: this.lib, fx: this.fx, atlas: this.atlas, atlasCanvas: this.atlasCanvas, canvas: this.canvas, quality: this.quality, markerTex: this.markerTex,
            popup: (x, y, t, c) => h.popup?.(x, y, t, c), banner: (t, c) => h.banner?.(t, c), banner2: (t, c) => h.banner2?.(t, c), sfx: (n, e) => h.sfx?.(n, e), turn: (e) => h.turn?.(e),
            revealed: (id, ty) => h.revealed?.(id, ty), ended: (e) => h.ended?.(e), victory: () => h.victory?.(), choosing: () => h.choosing?.(),
            itemName: (id) => ITEMS[id]?.name, statusName: (n) => STATUS_INFO[n]?.name,
            endFx: () => {},
        });
        this.battle.camera.aspect = this.w / this.h; this.battle.camera.updateProjectionMatrix();
        return this.battle;
    }

    // ------------------------------------------------------------------ events from the sim
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'map': this.loadMap(G, e); break;
                case 'fade': this.fadeGoal = e.dir === 'in' ? 1 : 0; this.fadeSpeed = 1 / Math.max(0.12, e.t || 0.4); if (e.dir === 'in' && e.t > 0.9) this.fade = 0; break;
                case 'shake': this.stage.kick(e.n || 0.6); break;
                case 'flash': this.stage.flash(1, 1, 1, 0.8); break;
                case 'snap': this.camInit = false; break;
                case 'look': this.lookAt = e.target || null; break;
                case 'encounter': this.trans = { t: 0, dur: 0.85, kind: 'in' }; break;
                case 'alert': break;
                case 'crack': { const d = this.dyn.get('crack:' + e.id); if (d) { this.fx.scene = this.scene; this.fx.play('quake', new THREE.Vector3(d.x, 1, d.z), [new THREE.Vector3(d.x, 1, d.z)]); d.mesh.visible = false; } break; }
                case 'chest': { const d = this.dyn.get('chest:' + e.id); if (d) this.rebuildChest(d, true); break; }
                case 'b_start': this.startBattle(G, e); break;
                case 'battle_over': this.endBattle(G); break;
                case 'rest': this.stage.flash(1, 0.95, 0.8, 0.9); break;
                case 'save_point': this.stage.flash(0.7, 0.95, 1, 0.5); break;
                default:
                    if (e.type.startsWith('b_') && this.battle?.active) this.battle.push(e);
            }
        }
    }

    startBattle(G, ev) {
        const b = this.ensureBattle();
        b.begin(ev, G, G);
        b.speed = this.speed;
        this.mode = 'battle';
        this.stage.use(b.scene, b.camera);
        // the swirl that took the field comes undone on the battle scene
        this.trans = { t: 0, dur: 0.7, kind: 'out' };
        this.stage.swirl = 1; this.stage.pix = 1;
        this.fade = 1; this.fadeGoal = 1;
        this.hooks.battleStart?.(ev);
    }

    endBattle(G) {
        if (!this.battle?.active) return;
        this.trans = { t: 0, dur: 0.5, kind: 'return' };
        this.pendingReturn = true;
    }

    // ------------------------------------------------------------------ maps
    loadMap(G, e) {
        if (this.mapRec) { this.scene.remove(this.mapRec.group); this.mapRec.dispose(); this.mapRec = null; }
        for (const d of this.dyn.values()) { this.scene.remove(d.mesh); }
        this.dyn.clear();
        for (const l of this.locks.values()) this.scene.remove(l.group);
        this.locks.clear();
        if (this.halos) { this.scene.remove(this.halos.points); this.halos.points.geometry.dispose(); this.halos = null; }
        this.actors.clear();
        const map = getMap(G, G.map);
        this.map = map;
        this.mapRec = buildMap(map, this.atlas);
        this.scene.add(this.mapRec.group);
        for (const l of this.mapRec.lights) l.gy = groundY(map, l.x, l.y);
        this.buildHalos(this.mapRec.lights);
        this.buildDyn(map);
        if (map.kind === 'over') this.buildLocks(map);
        this.camInit = false;
        this.kind = KINDS[map.kind];
        this.fx.clear();
        this.stage.fade = this.fade = 0; this.fadeGoal = 1; this.fadeSpeed = 2.4;
        this.yaw = this.yawGoal = e.first && map.kind !== 'over' ? 0 : this.yawGoal;
        this.hooks.area?.(map, e);
    }

    buildHalos(lights) {
        const n = lights.length; if (!n) return;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), on = new Float32Array(n);
        lights.forEach((l, i) => { pos[i * 3] = l.x; pos[i * 3 + 1] = l.gy + l.z; pos[i * 3 + 2] = l.y; const c = new THREE.Color(l.color); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; size[i] = Math.min(2.4, 0.9 + l.intensity * 0.25); });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 400 }, uTime: { value: 0 } },
            vertexShader: `attribute vec3 aCol; attribute float aSize; attribute float aOn; varying vec3 vC; varying float vA; uniform float uScale;
void main(){ vC = aCol; vA = aOn; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = length(p); float g = exp(-d * d * 4.0) * (1.0 - smoothstep(0.7, 1.0, d)); gl_FragColor = vec4(vC * g * vA * 1.4, 1.0); }`,
        });
        const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 12;
        this.scene.add(points);
        this.halos = { points, on, lights };
    }

    chestMesh(d, open) {
        const g = new Geo(), em = new Geo();
        P.chest(g, em, d.prop, d.gy, open);
        const grp = new THREE.Group();
        const m = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ map: this.atlas, vertexColors: true, roughness: 1, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; grp.add(m);
        const e = em.build(); if (e) grp.add(new THREE.Mesh(e, new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, toneMapped: false })));
        return grp;
    }
    rebuildChest(d, open) { this.scene.remove(d.mesh); d.mesh = this.chestMesh(d, open); this.scene.add(d.mesh); d.open = open; if (open) this.fx.sparks(new THREE.Vector3(d.x, d.gy + 0.6, d.z), 0xffe08a, 16, 4, 0.2, 0.7); }

    buildDyn(map) {
        for (const p of map.dyn || this.mapRec.dyn) {
            const gy = (map.hgt[p.y * map.w + p.x] || 0) * LEVEL_H, x = p.x + 0.5, z = p.y + 0.5;
            if (p.type === 'chest') { const d = { prop: p, x, z, gy, open: !!p.open }; d.mesh = this.chestMesh(d, d.open); this.scene.add(d.mesh); this.dyn.set('chest:' + p.id, d); d.kind = 'chest'; }
            else if (p.type === 'save') {
                const grp = new THREE.Group(); grp.position.set(x, gy, z);
                const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 1.6), toneMapped: false })); oct.scale.set(0.8, 1.3, 0.8); oct.position.y = 1.3; grp.add(oct);
                const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a7090, roughness: 0.9 })); base.position.y = 0.2; base.castShadow = true; grp.add(base);
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.2, 1.5), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.3; grp.add(ring);
                this.scene.add(grp); this.dyn.set('save:' + p.id, { mesh: grp, oct, ring, x, z, gy, kind: 'save' });
            } else if (p.type === 'spark') {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(2, 1.7, 0.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(1.0, 1.0, 1); s.position.set(x, gy + 0.6, z);
                this.scene.add(s); this.dyn.set('spark:' + p.quest, { mesh: s, prop: p, x, z, gy, kind: 'spark' });
            } else if (p.type === 'portal') {
                const w = p.w || 2;
                const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float v = sin(vUv.y * 8.0 - uTime * 2.0) * 0.5 + 0.5; float e = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * (1.0 - vUv.y); gl_FragColor = vec4(vec3(0.5, 0.8, 1.3) * e * (0.15 + v * 0.25), 1.0); }` }));
                m.position.set(p.x + w / 2, gy + 0.9, p.y + 0.3); this.scene.add(m);
                this.dyn.set('portal:' + p.x, { mesh: m, kind: 'portal', x, z, gy });
            } else if (p.type === 'crack') {
                const g = new Geo(); g.box(0.96, 1.4, 0.06, { x: 0, y: 0, z: 0, tile: TEX.crack, color: 0xffffff, rep: 1, noTop: true });
                const m = new THREE.Mesh(g.build(), new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, transparent: true, alphaTest: 0.1 }));
                m.position.set(x, gy + 0.2, z + 0.53); m.visible = !p.broken; this.scene.add(m);
                this.dyn.set('crack:' + p.id, { mesh: m, x, z, gy, kind: 'crack' });
            }
        }
        // chests opened earlier in the game are already open (maps.js marks them)
    }

    buildLocks(map) {
        map.locks.forEach((lk, i) => {
            if (!lk.tiles?.length) return;
            const grp = new THREE.Group();
            let cx = 0, cz = 0; for (const t of lk.tiles) { cx += (t % map.w) + 0.5; cz += Math.floor(t / map.w) + 0.5; }
            cx /= lk.tiles.length; cz /= lk.tiles.length;
            const gy = (map.hgt[Math.floor(cz) * map.w + Math.floor(cx)] || 1) * LEVEL_H;
            if (lk.kind === 'sandstorm') {
                for (let k = 0; k < 5; k++) {
                    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.5), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uK: { value: k } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uTime, uK; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){ vec2 p = vUv * vec2(3.0, 4.0) + vec2(uTime * (0.6 + uK * 0.25), -uTime * 0.2 + uK); float v = n(p) * 0.6 + n(p * 2.3) * 0.4; float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.6, vUv.y); gl_FragColor = vec4(vec3(0.86, 0.68, 0.4) * (0.7 + v * 0.5), smoothstep(0.25, 0.8, v) * 0.85 * edge); }` }));
                    m.position.set(cx + (k - 2) * 0.1, gy + 2.2, cz + (k % 2 ? 0.5 : -0.5)); m.userData.sand = true; grp.add(m);
                }
            } else {
                const g = new Geo(), em = new Geo();
                for (const t of lk.tiles) { const x = t % map.w, y = Math.floor(t / map.w); const hh = 2.4 + hash3(x, y, 3) * 2; g.add(UG.box, { x: x + 0.5, y: gy + hh / 2, z: y + 0.5, sx: 1, sy: hh, sz: 1, color: 0xb8eaff, tile: TEX.ice, jitter: 0.1 }); g.add(UG.cone6, { x: x + 0.5, y: gy + hh + 0.4, z: y + 0.5, sx: 0.55, sy: 0.9, sz: 0.55, color: 0xd8f6ff, tile: TEX.ice }); if (hash3(x, y, 5) > 0.6) em.add(UG.oct, { x: x + 0.5, y: gy + 1.2, z: y + 0.5, sx: 0.1, sy: 0.3, sz: 0.1, color: 0x9fe8ff, tile: TEX.glass }); }
                const m = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ map: this.atlas, vertexColors: true, roughness: 0.4, metalness: 0.1, emissive: 0x1a3a5a })); m.castShadow = true; grp.add(m);
                const e = em.build(); if (e) grp.add(new THREE.Mesh(e, new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, toneMapped: false })));
            }
            this.scene.add(grp);
            this.locks.set(lk.flag, { group: grp, t: 1, lk });
        });
    }

    // ------------------------------------------------------------------ the frame
    rotate(dir) { this.yawGoal += dir * Math.PI / 4; }

    frame(G, dt, time) {
        this.resize();
        this.time = time;
        const stage = this.stage;
        // fades
        this.fade += Math.sign(this.fadeGoal - this.fade) * Math.min(Math.abs(this.fadeGoal - this.fade), dt * this.fadeSpeed);
        stage.fade = this.fade;
        // transitions between scenes
        if (this.trans) {
            const tr = this.trans; tr.t += dt; const k = Math.min(1, tr.t / tr.dur);
            if (tr.kind === 'in') { stage.swirl = k; stage.pix = Math.max(0, (k - 0.35) / 0.65); if (k > 0.8) stage.fade = 1 - (k - 0.8) / 0.2 * 0.0; if (k >= 1) { /* hold until the battle starts */ } }
            else if (tr.kind === 'out') { stage.swirl = 1 - k; stage.pix = 1 - k; if (k >= 1) { this.trans = null; stage.swirl = 0; stage.pix = 0; } }
            else if (tr.kind === 'return') { stage.pix = k; stage.swirl = k * 0.6; if (k >= 1) { this.finishReturn(G); } }
            else if (tr.kind === 'returnOut') { stage.swirl = 0.6 * (1 - k); stage.pix = 1 - k; if (k >= 1) { this.trans = null; stage.swirl = 0; stage.pix = 0; } }
        }
        if (this.mode === 'battle' && this.battle?.active) {
            this.battle.update(dt, time);
            const bb = this.battle;
            const lowHp = G.battle ? G.battle.units.filter((u) => u.side === 'party' && u.hp > 0 && u.hp / u.mhp < 0.25).length : 0;
            stage.pulse = lowHp ? 0.5 + Math.sin(time * 5) * 0.25 : 0;
            stage.render(dt, time, { warm: bb.sky.grade?.warm ?? 0, dusk: bb.mood ? 0 : bb.sky.grade?.dusk ?? 0, focus: 0.52, range: 0.3, blur: 2.6, bloom: 0.55, vig: 0.85, exposure: 1.1 });
            return;
        }
        stage.pulse = 0;
        if (!this.mapRec) { stage.render(dt, time, {}); return; }
        this.fieldFrame(G, dt, time);
    }

    finishReturn(G) {
        this.battle.end();
        this.mode = 'field';
        this.stage.use(this.scene, this.camera);
        this.fx.scene = this.scene; this.fx.camera = this.camera;
        this.scene.add(this.fx.parts.mesh); for (const l of this.fx.lights) this.scene.add(l);
        this.fx.shake = (a) => this.stage.kick(a); this.fx.flash = (r, g, b, a) => this.stage.flash(r, g, b, a);
        this.trans = { t: 0, dur: 0.45, kind: 'returnOut' };
        this.stage.pix = 1;
        this.hooks.battleEnd?.();
    }

    fieldFrame(G, dt, time) {
        const map = this.map, kind = this.kind || KINDS.town, cam = this.camera, stage = this.stage;
        // camera
        this.yaw += (this.yawGoal - this.yaw) * (1 - Math.exp(-dt * 7));
        const aspect = this.w / this.h;
        const portrait = aspect < 1 ? 1 / Math.pow(aspect, 0.55) : 1;
        const dist = kind.dist * portrait * this.zoom;
        const gy = groundY(map, G.px, G.py);
        const tx = this.lookAt ? this.lookAt.x : G.px, tz = this.lookAt ? this.lookAt.y : G.py;
        const tgt = new THREE.Vector3(tx, gy + 0.7 + (this.lookAt ? 0.4 : 0), tz);
        if (!this.camInit) { this.look.copy(tgt); this.camInit = true; }
        this.look.lerp(tgt, 1 - Math.exp(-dt * (this.lookAt ? 3 : 7)));
        const pitch = kind.pitch * Math.PI / 180;
        const sh = stage.shake, sx = (Math.random() - 0.5) * sh * sh * 0.4, sz = (Math.random() - 0.5) * sh * sh * 0.4;
        cam.position.set(this.look.x + Math.sin(this.yaw) * Math.cos(pitch) * dist + sx, this.look.y + Math.sin(pitch) * dist, this.look.z + Math.cos(this.yaw) * Math.cos(pitch) * dist + sz);
        cam.fov = kind.fov * (this.lookAt ? 0.82 : 1); cam.updateProjectionMatrix();
        cam.lookAt(this.look); Billboard.cam = cam;
        // sky and lights
        const th = map.kind === 'dungeon' ? dungeonTheme(map.id) : null;
        const st = { clock: G.clock, light: G.story.light, px: this.look.x, py: this.look.y, pz: this.look.z, time };
        if (th) st.fixed = dungeonMood(th);
        this.sky.update(dt, st);
        const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
        this.mapRec.update({ time, px: G.px, pz: G.py, fwdX, fwdZ, sunMul: this.sky.sunMul, skyTint: this.sky.tint, glow: this.sky.glow });
        const nightF = th ? 1 : this.sky.night;
        if (th) { this.lantern.visible = true; this.lantern.position.set(G.px, gy + 2.1, G.py + 0.6); this.lantern.intensity = 4.2 + Math.sin(time * 9) * 0.25; this.lantern.color.set(0xffe2b0); } else this.lantern.visible = false;
        this.sky.assignLights(this.mapRec.lights, this.look.x, this.look.y, this.look.z, time, nightF, !!th);
        if (this.halos) {
            const L = this.halos.lights, on = this.halos.on;
            for (let i = 0; i < L.length; i++) { const l = L[i]; const base = l.night ? sstep(0.15, 0.7, nightF) * 0.9 : 1; const fl = l.flicker ? 0.85 + 0.15 * Math.sin(time * 11 + l.x * 3) : 1; on[i] = base * fl * (l.kind === 'window' ? 0.5 : 1) * (1 - sstep(24, 34, Math.hypot(l.x - G.px, l.y - G.py))); }
            this.halos.points.geometry.attributes.aOn.needsUpdate = true;
            this.halos.points.material.uniforms.uScale.value = this.h * 0.95;
        }
        // people
        this.markT -= dt;
        if (this.markT <= 0) { this.markT = 0.4; this.marks = this.hooks.marks?.(G, map) || {}; }
        this.actors.sync(G, map, { yaw: this.yaw, time, marks: this.marks });
        // dynamic props
        for (const d of this.dyn.values()) {
            if (d.kind === 'save') { d.oct.rotation.y = time * 1.2; d.oct.position.y = 1.3 + Math.sin(time * 2) * 0.1; d.ring.rotation.z = time; }
            else if (d.kind === 'spark') { d.mesh.position.y = d.gy + 0.6 + Math.sin(time * 3) * 0.1; d.mesh.visible = !d.prop.taken; d.mesh.scale.setScalar(0.9 + Math.sin(time * 6) * 0.12); }
            else if (d.kind === 'portal') d.mesh.material.uniforms.uTime.value = time;
            else if (d.kind === 'chest' && !d.open && Math.random() < dt * 1.2) this.fx.parts.add({ x: d.x + (Math.random() - 0.5) * 0.5, y: d.gy + 0.6, z: d.z + (Math.random() - 0.5) * 0.3, vy: 0.6, life: 0.8, size: 0.12, size1: 0, r: 1, g: 0.85, b: 0.4, shape: SHAPE.spark, fade: 'out' });
        }
        // barriers over the passes
        for (const [flag, l] of this.locks) {
            const open = !!G.flags[flag];
            l.t += (open ? -1 : 1) * dt * 0.8; l.t = Math.max(0, Math.min(1, l.t));
            l.group.visible = l.t > 0.01;
            l.group.scale.y = Math.max(0.001, l.t);
            for (const c of l.group.children) if (c.userData.sand) { c.material.uniforms.uTime.value = time; c.lookAt(cam.position.x, c.position.y, cam.position.z); }
            if (!open && Math.random() < dt * 14) { const t = l.lk.tiles[Math.floor(Math.random() * l.lk.tiles.length)]; const x = (t % map.w) + Math.random(), z = Math.floor(t / map.w) + Math.random(); this.fx.parts.add({ x, y: 0.5 + Math.random() * 3.5, z, vx: l.lk.kind === 'sandstorm' ? 5 : 0, vy: l.lk.kind === 'sandstorm' ? 0 : 0.5, life: 1.0, size: l.lk.kind === 'sandstorm' ? 0.9 : 0.14, size1: l.lk.kind === 'sandstorm' ? 1.6 : 0.1, r: l.lk.kind === 'sandstorm' ? 0.85 : 0.7, g: l.lk.kind === 'sandstorm' ? 0.65 : 0.95, b: l.lk.kind === 'sandstorm' ? 0.4 : 1, a: l.lk.kind === 'sandstorm' ? 0.4 : 1, shape: l.lk.kind === 'sandstorm' ? SHAPE.smoke : SHAPE.spark, fade: 'inout' }); }
        }
        this.ambient(G, dt, time, map);
        this.fx.update(dt, time);
        const dayWarm = this.sky.grade?.warm ?? 0;
        stage.render(dt, time, { warm: dayWarm, dusk: th ? 0 : this.sky.grade?.dusk ?? 0, focus: 0.5, range: kind.range, blur: kind.blur, bloom: kind.bloom + (nightF > 0.5 ? 0.25 : 0), vig: 0.8, exposure: th ? 1.15 : 1.05 });
    }

    ambient(G, dt, time, map) {
        if (Math.random() > dt * 10) return;
        const r = (a, b) => a + Math.random() * (b - a);
        const px = this.look.x + r(-12, 12), pz = this.look.z + r(-9, 5), py = this.look.y;
        if (map.kind === 'dungeon') { const th = dungeonTheme(map.id); const c = new THREE.Color(th.light); this.fx.parts.add({ x: px, y: py + r(0, 3), z: pz, vy: r(0.1, 0.4), vx: r(-0.2, 0.2), life: 4, size: 0.07, size1: 0.07, r: c.r, g: c.g, b: c.b, shape: SHAPE.orb, fade: 'inout', a: 0.7 }); return; }
        const night = this.sky.night;
        if (map.kind === 'over') {
            const zi = map.zone[Math.max(0, Math.min(map.h - 1, Math.floor(G.py))) * map.w + Math.max(0, Math.min(map.w - 1, Math.floor(G.px)))], zk = ZONE_KEYS[zi];
            if (zk === 'snow') { for (let i = 0; i < 3; i++) this.fx.parts.add({ x: this.look.x + r(-14, 14), y: py + 9, z: this.look.z + r(-10, 4), vy: -2, vx: -0.8, life: 5, size: 0.09, size1: 0.09, r: 1, g: 1, b: 1, shape: SHAPE.dot, fade: 'inout' }); return; }
            if (zk === 'ash' || zk === 'volcano') { this.fx.parts.add({ x: px, y: py + 0.3, z: pz, vy: r(1, 2.2), vx: 0.4, life: 4, size: 0.1, size1: 0, r: 1, g: 0.45, b: 0.1, shape: SHAPE.orb, fade: 'inout' }); return; }
            if (zk === 'desert') { this.fx.parts.add({ x: this.look.x - 14, y: py + r(0.2, 1.4), z: pz, vx: 7, life: 3, size: 0.7, size1: 1.3, r: 0.85, g: 0.72, b: 0.5, a: 0.1, shape: SHAPE.smoke, fade: 'inout' }); return; }
        }
        if (night > 0.5) this.fx.parts.add({ x: px, y: py + r(0.3, 2), z: pz, vy: r(-0.1, 0.2), vx: r(-0.3, 0.3), life: 5, size: 0.09, size1: 0.09, r: 0.9, g: 1, b: 0.4, shape: SHAPE.orb, fade: 'inout' });
        else this.fx.parts.add({ x: px, y: py + r(2, 5), z: pz, vx: r(0.4, 1), vy: -0.3, life: 6, size: 0.12, size1: 0.08, r: 0.7, g: 1, b: 0.45, shape: SHAPE.leaf, spin: r(-3, 3), fade: 'inout', a: 0.7 });
    }
}

function dungeonMood(th) {
    const wood = th.wall === 'hedge';
    return {
        top: th.fog, hor: th.fog, fog: th.fog, ambient: th.ambient, ambientI: wood ? 1.15 : 1.3, ground: 0x2a2434, sun: wood ? 0.9 : 0, sunColor: 0xcfe8c0, sunDir: [0.4, 0.9, 0.5], shadow: wood,
        fogNear: 14, fogFar: 46, stars: 0, cloud: 0, glow: 1.7, night: 1, sunMul: 0.6, tint: th.light, warm: 0,
    };
}
