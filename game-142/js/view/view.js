// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
//
// Camera: third person behind the cannon while aiming; it chases a fired ball, watches where it
// landed for a moment, then comes back. At the end of a castle it circles the wreckage.

import * as THREE from 'three';
import { CANNON, AMMO, CHARS } from '../config.js';
import { REGIONS } from '../sim/levels.js';
import { predict, aimDir } from '../sim/aim.js';
import { makeRng } from '../rng.js';
import { Blocks } from './blocks.js';
import { FX, MAT_COLORS } from './fx.js';
import { makeCannon, makePip, makeCharacter, makeBallMaterials, makeFlag, waveFlag, makeTrees } from './models.js';

const SKY_TOP = { meadow: 0x2f7fd8, frost: 0x8fc4ee, sunset: 0x9c8ad6, marsh: 0x1b2150 };
const GROUND_TEX = { meadow: 'grass', frost: 'snow', sunset: 'autumn', marsh: 'marsh' };
// light per region: [hemisphere sky, hemisphere ground, hemisphere intensity, sun colour, sun intensity, exposure]
const LIGHT = {
    meadow: [0xdff0ff, 0x6a7a4a, 1.1, 0xfff1d6, 2.6, 1.05],
    frost: [0xdff0ff, 0x8090a0, 1.15, 0xf4f8ff, 2.5, 1.0],
    sunset: [0xffe0c0, 0x7a6a4a, 1.1, 0xffd2a0, 2.5, 1.05],
    marsh: [0x8fa6ff, 0x2a3a3a, 0.9, 0xbcd0ff, 1.5, 1.15],      // moonlight: explosions glow
};
const hashStr = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export class View {
    constructor(canvas, { lowPower = false } = {}) {
        this.canvas = canvas;
        this.lowPower = lowPower;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0xcfe8ff, 70, 230);
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
        this.camera.position.set(0, 5, -7);

        this.textures = this.loadTextures();
        this.buildWorld();
        this.blocks = new Blocks(this.scene, this.textures);
        this.fx = new FX(this.scene, this.camera, document.getElementById('pops'));
        this.ballMats = makeBallMaterials();
        this.ballGeo = new THREE.SphereGeometry(1, 20, 14);

        this.chars = new Map();   // body id → model
        this.balls = new Map();   // body id → mesh
        this.flags = [];
        this.mode = 'title';      // title | play | end
        this.cam = { pos: new THREE.Vector3(0, 6, -8), look: new THREE.Vector3(0, 3, 30), watch: null, watchT: 0, follow: 0, orbit: 0 };
        this.followShots = true;
        this.timeScale = 1;
        this.slowT = 0;
        this.trailT = 0;
        this.aimKey = '';
        this.recoil = 0;
        this.region = null;
        this.levelShown = -1;

        // aim arc: dots and a landing marker
        this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.9 }), 90);
        this.dots.frustumCulled = false;
        this.dots.count = 0;
        this.scene.add(this.dots);
        this.marker = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
        ring.renderOrder = 5;
        this.marker.add(ring);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false, depthTest: false }));
        arrow.rotation.x = Math.PI;
        arrow.renderOrder = 5;
        this.marker.add(arrow);
        this.marker.userData = { ring, arrow };
        this.marker.visible = false;
        this.scene.add(this.marker);

        this.tm = new THREE.Matrix4(); this.tv = new THREE.Vector3(); this.tq = new THREE.Quaternion(); this.ts = new THREE.Vector3();

        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    loadTextures() {
        const L = new THREE.TextureLoader();
        const tex = {};
        const load = (key, file, { repeat = false, color = true } = {}) => {
            const t = L.load(`art/${file}.webp`);
            if (color) t.colorSpace = THREE.SRGBColorSpace;
            if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 4;
            tex[key] = t;
            return t;
        };
        for (const k of ['stone', 'wood', 'roof', 'ice', 'brick', 'tnt', 'grass', 'snow', 'autumn', 'marsh']) load(k, `tex-${k}`, { repeat: true });
        // a pale copy of the roof tiles for the cone roofs, so they can be tinted per tower
        tex.roofCone = load('roofCone', 'tex-roof', { repeat: true });
        tex.roofCone.repeat.set(3, 2);
        for (const r of ['meadow', 'frost', 'sunset', 'marsh']) {
            const t = load(`sky-${r}`, `sky-${r}`);
            t.wrapS = THREE.MirroredRepeatWrapping;   // the painted edges don't quite meet: mirror them
            t.repeat.set(2, 1);
        }
        return tex;
    }

    buildWorld() {
        const S = this.scene;
        this.hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a7a4a, 1.1);
        S.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
        sun.position.set(-20, 34, 6);
        sun.target.position.set(0, 0, 28);
        sun.castShadow = true;
        const sm = this.lowPower ? 1024 : 2048;
        sun.shadow.mapSize.set(sm, sm);
        Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 2, far: 110 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        S.add(sun, sun.target);

        // the sky: a painted panorama wrapped twice round a big cylinder, its horizon at eye height
        const R = 300, H = R * Math.PI / 2.36;
        const sky = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, toneMapped: false }));
        sky.position.y = H / 2 - H * 0.43 + 2;
        sky.rotation.y = Math.PI / 2;   // the mirrored seams of the panorama go off to the sides, not ahead
        sky.renderOrder = -1;
        this.sky = sky;
        S.add(sky);

        // the ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.ground = ground;
        S.add(ground);

        this.cannon = makeCannon();
        S.add(this.cannon);
        this.pip = makePip();
        this.pip.position.set(-1.25, 1.35 + 0.36, 0.35);
        this.pip.rotation.y = Math.PI - 0.5;
        S.add(this.pip);
        this.trees = null;
    }

    setRegion(region, level) {
        if (this.region === region && this.levelShown === level) return;
        this.region = region;
        this.levelShown = level;
        const R = REGIONS[region];
        this.sky.material.map = this.textures[`sky-${region}`];
        this.sky.material.needsUpdate = true;
        this.scene.background = new THREE.Color(SKY_TOP[region]);
        this.scene.fog.color.setHex(R.fog);
        const gt = this.textures[GROUND_TEX[region]];
        gt.repeat.set(90, 90);
        this.ground.material.map = gt;
        this.ground.material.color.setHex(region === 'marsh' ? 0x6f8f7c : 0xffffff);   // the marsh grass tiles too bright and too blue
        this.ground.material.needsUpdate = true;
        const Lt = LIGHT[region] || LIGHT.meadow;
        this.hemi.color.setHex(Lt[0]); this.hemi.groundColor.setHex(Lt[1]); this.hemi.intensity = Lt[2];
        this.sun.color.setHex(Lt[3]); this.sun.intensity = Lt[4];
        this.renderer.toneMappingExposure = Lt[5];
        if (this.trees) { this.scene.remove(this.trees); this.trees.traverse((m) => m.geometry?.dispose?.()); }
        const rng = makeRng(1234 + hashStr(level));
        this.trees = makeTrees(rng, region, (x, z) => (Math.abs(x) < 16 && z > 14 && z < 50) || (Math.abs(x) < 9 && z < 24) || z < -6);
        this.trees.traverse((m) => { if (m.isMesh) m.castShadow = true; });
        this.scene.add(this.trees);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        // keep about 70° across on wide screens; a tall phone gets a taller view instead of a narrower one
        const hf = 58 * Math.PI / 180;
        this.camera.fov = Math.max(36, Math.min(64, 2 * Math.atan(Math.tan(hf / 2) / this.camera.aspect) * 180 / Math.PI));
        this.camera.updateProjectionMatrix();
    }

    /** A new castle (or a loaded save): drop the old models. */
    reset(G) {
        for (const m of this.chars.values()) this.scene.remove(m);
        for (const m of this.balls.values()) this.scene.remove(m);
        for (const f of this.flags) this.scene.remove(f.obj);
        this.chars.clear(); this.balls.clear(); this.flags = [];
        for (const f of G.flags) { const obj = makeFlag(f.color); this.scene.add(obj); this.flags.push({ ...f, obj }); }
        this.setRegion(G.spec.region, G.spec.id);
        this.cam.watch = null; this.cam.follow = 0;
        this.aimKey = '';
        this.slowT = 0; this.timeScale = 1;
    }

    onEvents(G, events) {
        const brk = { n: 0, score: 0, p: [0, 0, 0] };
        for (const e of events) {
            if (e.type === 'fire') {
                this.recoil = 1;
                const d = e.d;
                for (let i = 0; i < 7; i++) this.fx.puff([e.p[0] + d[0] * 0.3, e.p[1] + d[1] * 0.3, e.p[2] + d[2] * 0.3], 0xffffff, 0.55, 0.6, 1.1, [d[0] * 3 + (Math.random() - 0.5), d[1] * 3 + 0.5, d[2] * 3]);
                this.fx.flash.position.set(e.p[0], e.p[1], e.p[2]); this.fx.flash.intensity = 40; this.fx.flashT = 0.12;
                this.fx.addShake(0.12);
                if (this.followShots) { this.cam.follow = e.id; this.cam.watch = null; }
            } else if (e.type === 'impact') {
                const col = MAT_COLORS[e.mat] ? MAT_COLORS[e.mat][0] : 0xb09a7a;
                for (let i = 0; i < 4; i++) this.fx.puff(e.p, e.mat === 'ground' ? 0xc8b48a : 0xf3eadb, 0.5, 0.7, 0.9);
                if (e.mat === 'ground') for (let i = 0; i < 6; i++) this.fx.chip(e.p, col, 3, 0.1, 3);
                this.fx.addShake(Math.min(0.25, e.speed / 120));
                this.cam.watch = new THREE.Vector3(e.p[0], e.p[1], e.p[2]);
                this.cam.watchT = 2.2;
            } else if (e.type === 'hit') {
                if (e.speed > 5 && Math.random() < 0.6) this.fx.puff(e.p, 0xf3eadb, 0.35, 0.5, 0.7);
            } else if (e.type === 'break') {
                const big = e.h[0] * e.h[1] * e.h[2] * 8;
                this.fx.burst(e.p, e.mat, Math.min(16, 5 + Math.round(big * 20)), 4 + Math.min(4, Math.hypot(...e.v) * 0.3));
                // one popup for all the blocks broken this frame, at their middle
                brk.n++; brk.score += e.score; brk.p[0] += e.p[0]; brk.p[1] += e.p[1]; brk.p[2] += e.p[2];
            } else if (e.type === 'boom') {
                this.fx.boom(e.p, e.radius, e.src !== 'tnt');
                this.slow(0.32, 0.4);
            } else if (e.type === 'bonk') {
                this.fx.pop([e.p[0], e.p[1] + 0.8, e.p[2]], 'BONK!', 'bonk');
                this.fx.pop([e.p[0], e.p[1] + 0.3, e.p[2]], `+${e.score}`, 'score');
                for (let i = 0; i < 8; i++) { const d = this.fx.chip(e.p, 0xffe14d, 3, 0.08, 3); d.glow = 1; }
                if (e.left === 0) this.slow(0.3, 1.0);
            } else if (e.type === 'poof') {
                for (let i = 0; i < 10; i++) this.fx.puff(e.p, 0xffffff, 0.5, 1.4, 1.0);
                for (let i = 0; i < 6; i++) { const d = this.fx.chip(e.p, 0xc9f0ff, 2, 0.07, 2.5); d.glow = 1; }
            } else if (e.type === 'split') {
                for (let i = 0; i < 6; i++) this.fx.puff(e.p, 0xdfe6ff, 0.4, 0.3, 0.6);
            }
        }
        if (brk.n) this.fx.pop(brk.p.map((x) => x / brk.n), `+${brk.score}`, brk.n > 3 ? 'score' : 'small');
    }

    slow(scale, secs) {
        if (this.fx.reduced) return;
        this.timeScale = scale;
        this.slowT = secs;
    }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, time, opts = {}) {
        this.resize();
        if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.timeScale = 1; }
        this.setRegion(G.spec.region, G.spec.id);
        this.blocks.update(G);
        this.syncChars(G, dt, time);
        this.syncBalls(G, dt);
        this.syncFlags(G, time);
        this.syncCannon(G, dt);
        this.updateAim(G, opts.aiming && this.mode === 'play' && !this.cam.follow && !(this.cam.watch && this.cam.watchT > 0));
        this.updateCamera(G, dt, time);
        this.fx.update(dt, this.w, this.h);
        this.renderer.render(this.scene, this.camera);
    }

    syncChars(G, dt, time) {
        const seen = new Set();
        const danger = G.W.bodies.some((b) => b.kind === 'ball' && b.live && b.p[2] > 12);
        for (const b of G.W.bodies) {
            if (b.kind !== 'char') continue;
            seen.add(b.id);
            let m = this.chars.get(b.id);
            if (!m) { m = makeCharacter(b.role, b.h, b.name); this.scene.add(m); this.chars.set(b.id, m); }
            m.position.set(b.p[0], b.p[1], b.p[2]);
            m.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]);
            const u = m.userData, inner = u.inner;
            const ph = b.id * 1.7;
            if (b.bonked) {
                inner.userData.xs.visible = true;
                for (const e of inner.userData.eyes) e.visible = false;
                u.stars.visible = true;
                u.stars.rotation.y = time * 6;
                u.stars.children.forEach((s, i) => s.position.set(Math.cos(s.userData.a) * 0.22, Math.sin(time * 8 + i) * 0.03, Math.sin(s.userData.a) * 0.22));
                const k = Math.max(0, 1 - Math.max(0, b.bT - 1.0) * 3);
                inner.scale.setScalar(0.001 + k);
            } else {
                // idle bob; panic while a ball is on its way
                const bob = danger ? Math.abs(Math.sin(time * 14 + ph)) * 0.06 : Math.sin(time * 2 + ph) * 0.015;
                inner.position.y = -b.h[1] + bob;
                if (u.arm) u.arm.rotation.z = danger ? Math.sin(time * 18 + ph) * 0.9 : -0.4 + Math.sin(time * 1.5 + ph) * 0.1;
            }
        }
        for (const [id, m] of this.chars) if (!seen.has(id)) { this.scene.remove(m); this.chars.delete(id); }
    }

    syncBalls(G, dt) {
        const seen = new Set();
        this.trailT -= dt;
        const trail = this.trailT <= 0;
        if (trail) this.trailT = 0.035;
        for (const b of G.W.bodies) {
            if (b.kind !== 'ball') continue;
            seen.add(b.id);
            let m = this.balls.get(b.id);
            if (!m) {
                m = new THREE.Mesh(this.ballGeo, this.ballMats[b.ammo]);
                m.castShadow = true;
                m.scale.setScalar(b.r);
                this.scene.add(m);
                this.balls.set(b.id, m);
            }
            m.position.set(b.p[0], b.p[1], b.p[2]);
            m.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]);
            if (b.live && trail) this.fx.puff(b.p, b.ammo === 'boom' ? 0xffb36a : 0xffffff, b.r * 0.45, 0.15, 0.35, [0, 0.2, 0]);
        }
        for (const [id, m] of this.balls) if (!seen.has(id)) { this.scene.remove(m); this.balls.delete(id); }
        this.ballMats.boom.emissiveIntensity = 0.6 + Math.sin(performance.now() / 70) * 0.5;
    }

    syncFlags(G, time) {
        const byId = new Map(G.W.bodies.map((b) => [b.id, b]));
        for (const f of this.flags) {
            const b = byId.get(f.body);
            if (!b) { if (f.obj.position.y > 0.05) f.obj.position.y -= 0.15; continue; }
            this.tq.set(b.q[0], b.q[1], b.q[2], b.q[3]);
            this.tv.set(f.off[0], f.off[1], f.off[2]).applyQuaternion(this.tq);
            f.obj.position.set(b.p[0] + this.tv.x, b.p[1] + this.tv.y - 0.6, b.p[2] + this.tv.z);
            f.obj.quaternion.copy(this.tq);
            waveFlag(f.obj, time + f.body);
        }
    }

    syncCannon(G, dt) {
        const u = this.cannon.userData;
        u.yaw.rotation.y = G.aim.yaw;
        u.pitch.rotation.x = -G.aim.pitch;
        this.recoil = Math.max(0, this.recoil - dt * 3);
        u.recoil.position.z = -Math.sin(this.recoil * Math.PI) * 0.35 * this.recoil;
    }

    updateAim(G, show) {
        if (!show || G.state !== 'aim' || !G.sel) { this.dots.count = 0; this.marker.visible = false; return; }
        const awake = G.W.bodies.reduce((n, b) => n + (b.sl ? 0 : 1), 0);
        const key = `${G.aim.yaw.toFixed(4)}|${G.aim.pitch.toFixed(4)}|${G.sel}|${G.W.bodies.length}|${awake > 3 ? Math.floor(G.t * 4) : 0}`;
        if (key !== this.aimKey) {
            this.aimKey = key;
            const f = predict(G, G.aim, G.sel, 7, 4);
            this.pred = f;
        }
        const f = this.pred;
        const n = Math.min(90, f.pts.length);
        const t = performance.now() / 1000;
        for (let i = 0; i < n; i++) {
            const p = f.pts[i];
            const s = 1 - i / (n + 10) * 0.5;
            const bob = (Math.sin(i * 0.6 - t * 8) * 0.5 + 0.5) * 0.4 + 0.8;
            this.tm.compose(this.tv.set(p[0], p[1], p[2]), this.tq.identity(), this.ts.set(s * bob, s * bob, s * bob));
            this.dots.setMatrixAt(i, this.tm);
        }
        this.dots.count = n;
        this.dots.instanceMatrix.needsUpdate = true;
        if (f.hit) {
            this.marker.visible = true;
            this.marker.position.set(f.hit[0], f.hit[1] + 0.02, f.hit[2]);
            const k = AMMO[G.sel].r * 2.2;
            this.marker.userData.ring.scale.setScalar(k);
            this.marker.userData.ring.lookAt(this.camera.position);
            this.marker.userData.arrow.position.y = 0.9 + Math.sin(t * 6) * 0.15;
        } else this.marker.visible = false;
    }

    updateCamera(G, dt, time) {
        const c = this.cam;
        const P = new THREE.Vector3(), L = new THREE.Vector3();
        let k = 1 - Math.exp(-dt * 4.5);
        const castle = new THREE.Vector3(0, 3, 31);
        if (this.mode === 'title') {
            const a = time * 0.12;
            P.set(Math.sin(a) * 26, 9, castle.z - Math.cos(a) * 26);
            L.copy(castle);
            k = 1 - Math.exp(-dt * 1.5);
        } else if (this.mode === 'end') {
            c.orbit += dt * 0.18;
            P.set(Math.sin(c.orbit * 0.6 - 0.5) * 26, 11, castle.z - Math.cos(c.orbit * 0.6 - 0.5) * 26);
            L.copy(castle);
            k = 1 - Math.exp(-dt * 1.5);
        } else {
            const ball = c.follow ? G.W.bodies.find((b) => b.id === c.follow && b.kind === 'ball') : null;
            if (ball && ball.live) {
                const v = new THREE.Vector3(ball.v[0], ball.v[1] * 0.3, ball.v[2]).normalize();
                P.set(ball.p[0] - v.x * 7, ball.p[1] + 2.4, ball.p[2] - v.z * 7);
                L.set(ball.p[0] + v.x * 6, ball.p[1] + v.y * 2, ball.p[2] + v.z * 6);
                k = 1 - Math.exp(-dt * 7);
            } else {
                if (c.follow && (!ball || !ball.live)) c.follow = 0;
                if (c.watch && c.watchT > 0 && this.followShots) {
                    c.watchT -= dt;
                    P.set(c.watch.x * 0.6 - 4, Math.max(5, c.watch.y + 4.5), c.watch.z - 17);
                    L.copy(c.watch);
                    k = 1 - Math.exp(-dt * 3);
                } else {
                    const d = aimDir({ yaw: G.aim.yaw, pitch: 0 });
                    const piv = CANNON.pivot;
                    // over the shoulder: behind, above and a little to the right of the cannon
                    P.set(piv[0] - d[0] * 6.4 - d[2] * 1.3, piv[1] + 2.0, piv[2] - d[2] * 6.4 + d[0] * 1.3);
                    L.set(piv[0] + d[0] * 26 - d[2] * 0.8, 3.0 + G.aim.pitch * 6, piv[2] + d[2] * 26 + d[0] * 0.8);
                }
            }
        }
        c.pos.lerp(P, k);
        c.look.lerp(L, k);
        this.camera.position.copy(c.pos);
        if (this.fx.shake > 0) {
            const s = this.fx.shake * this.fx.shake * 0.35;
            this.camera.position.x += Math.sin(time * 61) * s;
            this.camera.position.y += Math.sin(time * 47 + 1) * s;
        }
        this.camera.lookAt(c.look);
    }

    /** Stop watching the last impact (the player started aiming again). */
    backToCannon() { this.cam.watch = null; this.cam.watchT = 0; }
}
