// The view: reads G every frame and turns sim events into effects. Never changes G.
//
// The camera rides above the player's shoulder in the player's own frame (up = the rock's normal
// under them, screen-up = the sim's transported heading f), so the commander stays in the middle
// of the screen and the asteroid turns underneath. On the title screen it pulls back and circles
// the whole rock against the gas giant while the bot plays.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Stage } from './stage.js';
import { makeSky, SUN_DIR, PLANET_DIR, PLANET_COLOR } from './sky.js';
import { makeGround, makeWalls, bakeRegolith } from './asteroid.js';
import { makeMaterials, orient, makePlayer, makeDrone, makeSeeker, makeShard, makeTurret, makePylon, makeGate, makeBoss, makePickup } from './models.js';
import { Fx } from './fx.js';
import { PHASE } from '../config.js';

const MAKERS = { drone: makeDrone, seeker: makeSeeker, shard: makeShard };
const v3 = (a, s = 1) => new THREE.Vector3(a[0] * s, a[1] * s, a[2] * s);
const ease = (k) => k * k * (3 - 2 * k);

export class View {
    constructor(canvas, { quality = 2 } = {}) {
        this.canvas = canvas;
        this.quality = quality;
        this.stage = new Stage(canvas, quality);
        const scene = this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);

        const pm = new THREE.PMREMGenerator(this.stage.gl);
        this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
        this.M = makeMaterials(this.env);

        // hard sunlight, a warm fill from the gas giant, almost no ambient: space has black shadows
        this.sun = new THREE.DirectionalLight(0xfff3e2, 2.5);
        this.sun.castShadow = true;
        const sc = this.sun.shadow.camera;
        sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 90;
        this.sun.shadow.mapSize.set(quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024);
        this.sun.shadow.bias = -0.0006;
        this.sun.shadow.normalBias = 0.04;
        scene.add(this.sun, this.sun.target);
        this.fill = new THREE.DirectionalLight(PLANET_COLOR, 0.55);
        scene.add(this.fill, this.fill.target);
        scene.add(new THREE.AmbientLight(0x3a4458, 0.12));
        // the commander's lamp is drawn in the ground shader (uLamp), not as a PointLight: a real
        // point light in every lit material cost five times the frame time under SwiftShader
        this.lampPos = new THREE.Vector3();

        this.sky = makeSky(quality);
        scene.add(this.sky);
        this.player = makePlayer(this.M);
        scene.add(this.player.root);
        this.bubble = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.5, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.player.root.add(this.bubble);
        this.bubble.position.y = 0.75;
        this.fx = new Fx(scene);

        this.world = null;
        this.level = null;
        this.enemies = new Map();
        this.pickups = new Map();
        this.groundU = { uR: { value: 10 }, uStart: { value: new THREE.Vector3(0, 1, 0) }, uExit: { value: new THREE.Vector3(0, -1, 0) }, uExitOpen: { value: 0 }, uTime: { value: 0 }, uLamp: { value: new THREE.Vector3() }, uLampOn: { value: 0 } };
        this.camPos = new THREE.Vector3(0, 40, 0);
        this.camUp = new THREE.Vector3(0, 0, -1);
        this.camLook = new THREE.Vector3();
        this.snap = true;
        this.shake = 0;
        this.walkPhase = 0;
        this.gateOpen = 0;
        this.warpT = 0;
        this.afterWarp = 0;
        this.raycaster = new THREE.Raycaster();

        this.stage.setScene(scene, this.camera);
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setQuality(q) {
        if (q === this.quality) return;
        this.quality = q;
        this.stage.setQuality(q);
        this.scene.remove(this.sky);
        this.sky.material.dispose();
        this.sky = makeSky(q);
        this.scene.add(this.sky);
        this.sun.shadow.mapSize.set(q > 1 ? 2048 : 1024, q > 1 ? 2048 : 1024);
        this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
        this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
        this.world = null;            // rebuild the rock with the new detail
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.stage.resize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------------ the level
    buildLevel(G) {
        if (this.level) {
            this.scene.remove(this.level);
            this.level.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        }
        for (const e of this.enemies.values()) this.scene.remove(e.root);
        for (const k of this.pickups.values()) this.scene.remove(k.root);
        this.enemies.clear(); this.pickups.clear();
        this.fx.clear();
        const W = this.world = G.world, R = W.R;
        const L = this.level = new THREE.Group();
        this.groundU.uR.value = R;
        this.groundU.uStart.value.copy(v3(W.cells[W.start].c));
        this.groundU.uExit.value.copy(v3(G.exit.p));
        this.bake?.dispose();
        this.bake = bakeRegolith(this.stage.gl, W, this.quality);
        L.add(makeGround(W, this.quality, this.groundU, this.bake));
        L.add(makeWalls(W, this.quality, this.env));
        this.turrets = new Map();
        for (const t of G.turrets) {
            const m = t.kind === 'pylon' ? makePylon(this.M) : makeTurret(this.M, t.kind);
            orient(m.root, t.p, t.aim, R);
            L.add(m.root);
            this.turrets.set(t.id, m);
        }
        this.gate = makeGate(this.M, this.env);
        orient(this.gate.root, G.exit.p, [0, 0, 1], R);
        L.add(this.gate.root);
        this.gateOpen = G.exit.open ? 1 : 0;
        this.boss = null;
        if (G.boss) {
            this.boss = makeBoss(this.M, this.env);
            orient(this.boss.root, G.boss.p, [1, 0, 0], R);
            L.add(this.boss.root);
            this.bossFall = G.boss.alive ? 0 : 1;
        }
        this.scene.add(L);
        this.snap = true;
    }

    // ------------------------------------------------------------------ events
    at(G, p, h = 0.9) { return v3(p, G.world.R + h); }

    onEvents(G, events, { quiet = false } = {}) {
        const fx = this.fx;
        for (const e of events) {
            if (e.type === 'level') { this.snap = true; continue; }
            if (!this.world || G.world !== this.world) continue;
            const up = e.p ? v3(e.p) : null;
            if (e.type === 'shot') {
                this.muzzle = 1;
            } else if (e.type === 'spark') {
                fx.sparks(this.at(G, e.p), up, 6, e.own ? 0x9fd0ff : 0xff8a40, 4, 0.18, 0.3);
            } else if (e.type === 'ehit') {
                fx.sparks(this.at(G, e.p), up, 5, 0xffffff, 5, 0.2, 0.25);
            } else if (e.type === 'thit' || e.type === 'bhit') {
                fx.sparks(this.at(G, e.p, e.type === 'bhit' ? 3 : 1.2), up, 4, 0xffd9a0, 5, 0.2, 0.25);
                const m = e.type === 'thit' ? this.turrets?.get(e.id) : null;
                if (m) m.hit = 1;
                if (e.type === 'bhit' && this.boss) this.boss.hit = 1;
            } else if (e.type === 'deflect') {
                fx.sparks(this.at(G, e.p, 1.5), up, 4, 0x80c0ff, 4, 0.22, 0.3);
                if (this.boss) this.boss.hit = 1;
            } else if (e.type === 'kill') {
                const p = this.at(G, e.p, 0.9);
                fx.sparks(p, up, 26, e.kind === 'shard' ? 0xff5030 : 0xffc890, 8, 0.35, 0.6);
                fx.glow(p, 0xffb070, 2.6, 0.35);
                fx.ring(this.at(G, e.p, 0), up, 2.4, 0xffa060, 0.5);
                fx.chunks(p, up, 6, e.kind === 'seeker' ? 0.12 : 0.18);
                fx.flashLight(p, 0xffa060, 40, 0.3);
                this.shake = Math.max(this.shake, 0.12);
            } else if (e.type === 'turretDown') {
                const p = this.at(G, e.p, 1.2);
                fx.sparks(p, up, 70, 0xffd0a0, 11, 0.45, 0.9);
                fx.sparks(p, up, 30, 0xff4020, 6, 0.6, 1.2);
                fx.glow(p, 0xfff0d0, 6, 0.5);
                fx.ring(this.at(G, e.p, 0), up, 6.5, 0xffc080, 0.9);
                fx.chunks(p, up, 22, 0.24);
                fx.flashLight(p, 0xffc080, 160, 0.7);
                this.stage.flash(1, 0.9, 0.8, 0.25);
                this.stage.kickAberr(5);
                this.shake = Math.max(this.shake, 0.5);
            } else if (e.type === 'bossDown') {
                const p = this.at(G, e.p, 3);
                for (let i = 0; i < 3; i++) fx.sparks(p, up, 80, i === 1 ? 0xff6030 : 0xfff0d0, 14, 0.7, 1.6);
                fx.glow(p, 0xffffff, 14, 0.9);
                fx.ring(this.at(G, e.p, 0), up, 14, 0xffe0b0, 1.4);
                fx.chunks(p, up, 40, 0.35);
                fx.flashLight(p, 0xffffff, 400, 1.2);
                this.stage.flash(1, 1, 1, 0.7);
                this.stage.kickAberr(10);
                this.shake = 1.2;
            } else if (e.type === 'hurt') {
                this.stage.hurt = 1;
                this.stage.kickAberr(4);
                this.shake = Math.max(this.shake, 0.35);
            } else if (e.type === 'die') {
                const p = this.at(G, e.p, 0.8);
                fx.sparks(p, up, 60, 0xffffff, 9, 0.4, 1.0);
                fx.chunks(p, up, 14, 0.15);
                fx.ring(this.at(G, e.p, 0), up, 5, 0xa0c8ff, 0.8);
                this.stage.flash(1, 1, 1, 0.5);
                this.shake = 0.8;
            } else if (e.type === 'dash') {
                const p = this.at(G, G.player.p, 0.15);
                fx.ring(p, v3(G.player.p), 1.6, 0x8098c0, 0.35);
                fx.sparks(p, v3(G.player.p), 10, 0x8090a8, 3, 0.4, 0.5);
            } else if (e.type === 'pickup') {
                const col = e.kind === 'repair' ? 0xff6060 : e.kind === 'power' ? 0xffc040 : 0xc080ff;
                fx.ring(this.at(G, e.p, 0), up, 2, col, 0.5);
                fx.sparks(this.at(G, e.p, 0.8), up, 16, col, 4, 0.3, 0.5);
            } else if (e.type === 'exitOpen') {
                fx.ring(this.at(G, e.p, 0), up, 9, 0x9cc8ff, 1.4);
                fx.flashLight(this.at(G, e.p, 2), 0x9cc8ff, 120, 1.2);
            } else if (e.type === 'spawn') {
                if (!quiet) fx.glow(this.at(G, e.p, 0.9), 0x6090ff, 1.8, 0.4);
            } else if (e.type === 'alarm') {
                const m = this.turrets?.get(e.id);
                if (m) m.hit = 1.5;
            } else if (e.type === 'shieldDown') {
                if (this.boss) {
                    const p = this.at(G, G.boss.p, 2.6);
                    fx.sparks(p, v3(G.boss.p), 90, 0x9fd8ff, 10, 0.4, 1.2);
                    this.stage.flash(0.7, 0.85, 1, 0.35);
                }
            } else if (e.type === 'warp') {
                this.warpT = 0;
            } else if (e.type === 'tfire' || e.type === 'efire' || e.type === 'bfire') {
                // the muzzle glows a moment
                const m = e.id ? this.turrets?.get(e.id) : null;
                if (m) m.fire = 1;
            }
        }
    }

    // ------------------------------------------------------------------ pointer aim
    /** Screen-relative aim (x right, y down) for a pointer at client coordinates, or null. */
    aimFrom(G, cx, cy) {
        if (!G?.world) return null;
        const r = this.canvas.getBoundingClientRect();
        const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
        const P = G.player, R = G.world.R;
        this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
        const ray = this.raycaster.ray;
        // ray against the sphere at shooting height
        const rr = R + 0.9;
        const o = ray.origin, d = ray.direction;
        const b = o.dot(d), c = o.lengthSq() - rr * rr;
        const disc = b * b - c;
        const p = v3(P.p), f = v3(P.f), right = new THREE.Vector3().crossVectors(f, p);
        let t;
        if (disc > 0 && (t = -b - Math.sqrt(disc)) > 0) {
            const q = o.clone().addScaledVector(d, t).normalize();
            const tan = q.addScaledVector(p, -q.dot(p));
            if (tan.lengthSq() < 1e-8) return null;
            tan.normalize();
            return [tan.dot(right), -tan.dot(f)];
        }
        // pointing off the rock: use the screen vector from the player
        const sp = p.clone().multiplyScalar(R + 0.9).project(this.camera);
        const dx = nx - sp.x, dy = -(ny - sp.y) / this.camera.aspect;
        const l = Math.hypot(dx, dy);
        return l > 1e-4 ? [dx / l, dy / l] : null;
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, mode = 'play') {
        this.resize();
        if (G.world !== this.world) this.buildLevel(G);
        const W = G.world, R = W.R, P = G.player;
        this.groundU.uTime.value = time;

        // ---- the commander
        const pr = this.player;
        const alive = G.phase !== 'dead' && G.phase !== 'over';
        pr.root.visible = alive && G.phase !== 'warp';
        orient(pr.root, P.p, P.f, R);
        // turn the body to the aim, in the root's local frame
        const ax = P.aim[0], ay = P.aim[1], az = P.aim[2];
        const rgt = new THREE.Vector3().crossVectors(v3(P.f), v3(P.p));
        const yaw = Math.atan2(rgt.x * ax + rgt.y * ay + rgt.z * az, P.f[0] * ax + P.f[1] * ay + P.f[2] * az);
        pr.body.rotation.y = -yaw;
        const sp = Math.min(1, P.moving / 6.4);
        this.walkPhase += dt * (4 + 7 * sp) * (sp > 0.05 ? 1 : 0);
        const sw = Math.sin(this.walkPhase) * 0.7 * sp;
        pr.legs[0].rotation.x = sw; pr.legs[1].rotation.x = -sw;
        pr.hips.position.y = 0.55 + Math.abs(Math.cos(this.walkPhase)) * 0.08 * sp + (P.dashT > 0 ? 0.15 : 0);
        pr.hips.rotation.x = P.dashT > 0 ? 0.35 : sp * 0.12;
        this.muzzle = Math.max(0, (this.muzzle || 0) - dt * 14);
        pr.muzzle.scale.setScalar(1 + this.muzzle * 2.5);
        this.bubble.material.opacity = P.inv > 0 ? 0.18 + 0.1 * Math.sin(time * 6) : P.dashT > 0 ? 0.25 : 0;
        const pw = v3(P.p, R);
        this.lampPos.copy(pw).addScaledVector(v3(P.p), 3.0);
        this.groundU.uLampOn.value = mode === 'title' || !pr.root.visible ? 0 : 1;

        // ---- lights follow the player so the shadow map covers what's on screen
        const focus = mode === 'title' ? new THREE.Vector3() : pw;
        this.sun.target.position.copy(focus);
        this.sun.position.copy(focus).addScaledVector(SUN_DIR, 45);
        this.fill.target.position.copy(focus);
        this.fill.position.copy(focus).addScaledVector(PLANET_DIR, 45);
        const sc = this.sun.shadow.camera;
        const ext = mode === 'title' ? R * 1.3 : 18;
        if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }

        // ---- beacons
        for (const t of G.turrets) {
            const m = this.turrets.get(t.id);
            if (!m) continue;
            if (!t.alive) {
                if (m.wreck.visible === false) { for (const a of m.alive) a.visible = false; m.wreck.visible = true; }
                continue;
            }
            orient(m.root, t.p, t.aim, R);
            m.hit = Math.max(0, (m.hit || 0) - dt * 5);
            m.fire = Math.max(0, (m.fire || 0) - dt * 6);
            const glow = 1 + (t.sees ? 0.6 : 0) + m.fire * 1.5 + m.hit * 0.8;
            m.iris.scale.setScalar(0.9 + 0.15 * glow);
            if (m.hpMat) m.hpMat.uniforms.uFrac.value = t.hp / t.maxHp;
            if (m.halo) { m.halo.rotation.x = time * 1.3; m.halo.rotation.y = time * 0.7; m.halo.scale.setScalar(0.6 + 0.4 * (t.hp / t.maxHp)); }
            m.head.position.x = m.hit > 0 ? (Math.random() - 0.5) * 0.05 * m.hit : 0;
        }

        // ---- enemies (pooled by sim id)
        const seen = new Set();
        for (const e of G.enemies) {
            seen.add(e.id);
            let m = this.enemies.get(e.id);
            if (!m) { m = MAKERS[e.kind](this.M); this.scene.add(m.root); this.enemies.set(e.id, m); }
            const vl = Math.hypot(e.vel[0], e.vel[1], e.vel[2]);
            const fwd = e.kind === 'shard' || vl < 0.2 ? [P.p[0] - e.p[0], P.p[1] - e.p[1], P.p[2] - e.p[2]] : e.vel;
            orient(m.root, e.p, fwd, R);
            m.pod.position.y = (e.kind === 'shard' ? 1.4 : e.kind === 'seeker' ? 0.7 : 0.95) + Math.sin(time * 2.4 + e.id) * 0.12;
            if (e.kind === 'shard') m.pod.rotation.y = time * 0.8 + e.id;
            if (e.kind === 'drone') m.pod.rotation.z = Math.sin(time * 1.7 + e.id) * 0.15;
            if (m.spin) m.spin.rotation.z = time * 6;
        }
        for (const [id, m] of this.enemies) if (!seen.has(id)) { this.scene.remove(m.root); this.enemies.delete(id); }

        // ---- pickups
        seen.clear();
        for (const k of G.pickups) {
            seen.add(k.id);
            let m = this.pickups.get(k.id);
            if (!m) { m = makePickup(this.M, k.kind); this.scene.add(m.root); this.pickups.set(k.id, m); orient(m.root, k.p, [0, 0, 1], R); }
            m.spin.rotation.y = time * 2;
            m.spin.position.y = 0.75 + Math.sin(time * 3 + k.id) * 0.12;
            m.root.visible = k.life > 3 || Math.sin(time * 10) > -0.3;
        }
        for (const [id, m] of this.pickups) if (!seen.has(id)) { this.scene.remove(m.root); this.pickups.delete(id); }

        // ---- the gate
        const g = this.gate;
        this.gateOpen += ((G.exit.open ? 1 : 0) - this.gateOpen) * Math.min(1, dt * 1.2);
        const go = ease(Math.min(1, this.gateOpen));
        g.lift.position.y = -4.7 + 4.7 * go;
        g.mat.userData.uniforms.uGlow.value = go;
        g.mat.userData.uniforms.uTime.value = time;
        g.beamMat.uniforms.uA.value = go * 0.9;
        g.beamMat.uniforms.uTime.value = time;
        g.beam.visible = go > 0.01;
        this.groundU.uExitOpen.value = go;

        // ---- the boss
        if (this.boss && G.boss) {
            const b = this.boss, B = G.boss;
            b.hit = Math.max(0, (b.hit || 0) - dt * 4);
            if (!B.alive) this.bossFall = Math.min(1, (this.bossFall || 0) + dt * 0.8);
            b.root.visible = this.bossFall < 1;
            b.float.position.y = 3.2 + Math.sin(time * 0.9) * 0.25 - this.bossFall * 6;
            b.float.rotation.y = B.ang * 0.5;
            b.orbit.rotation.y = -B.ang;
            b.shieldMat.uniforms.uA.value += ((B.shield ? 1 : 0) - b.shieldMat.uniforms.uA.value) * Math.min(1, dt * 3);
            b.shieldMat.uniforms.uTime.value = time;
            b.shieldMat.uniforms.uHit.value = b.hit;
            b.shield.visible = b.shieldMat.uniforms.uA.value > 0.01;
            b.mat.userData.uniforms.uGlow.value = B.shield ? 0.15 : 0.5 + (1 - B.hp / B.maxHp) * 0.8 + b.hit * 0.5;
            b.mat.userData.uniforms.uTime.value = time;
            for (const s of b.seams) s.scale.y = B.shield ? 0.5 : 1 + b.hit * 2;
        }

        // ---- bolts and effects
        this.fx.bolts(G, R);
        this.fx.update(dt, this.camera, R);

        // ---- camera
        this.updateCamera(G, dt, time, mode);
        this.camera.updateMatrixWorld();
        this.groundU.uLamp.value.copy(this.lampPos).applyMatrix4(this.camera.matrixWorldInverse);

        // ---- the star gate
        const st = this.stage;
        if (G.phase === 'warp') {
            this.warpT += dt;
            const k = this.warpT;
            st.gate = Math.min(1, k / 0.7);
            st.gateT = k * (1 + k * 0.35);
            st.bars = Math.min(1, k / 0.5);
            st.fade = 1;
            if (G.phaseT < 0.45) st.flash(1, 1, 1, 1 - G.phaseT / 0.45);
            this.afterWarp = 1;
        } else {
            if (this.afterWarp > 0) { this.afterWarp = Math.max(0, this.afterWarp - dt / 1.1); st.gateT += dt * 2; }
            st.gate = ease(this.afterWarp);
            st.bars = Math.max(st.bars - dt * 0.8, G.phase === 'intro' && mode === 'play' ? Math.min(1, G.phaseT / (PHASE.intro * 0.5)) : 0);
        }
        st.hurt = Math.max(0, st.hurt - dt * 1.6, mode === 'play' && G.phase === 'play' && P.hp < 30 ? 0.35 + 0.15 * Math.sin(time * 3) : 0);
        const u = this.sky.material.uniforms;
        u.uPx.value = (this.camera.fov * Math.PI / 180) / Math.max(1, this.h);
        u.uTime.value = time;
        this.sky.position.copy(this.camera.position);
        st.render(dt, time);
    }

    updateCamera(G, dt, time, mode) {
        const P = G.player, R = G.world.R, cam = this.camera;
        const p = v3(P.p), f = v3(P.f);
        let pos, look, up;
        if (mode === 'title') {
            // pull back and circle the whole rock, the gas giant behind it
            const a = 0.45 + Math.sin(time * 0.05) * 0.25;
            const dir = PLANET_DIR.clone().negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            dir.y += 0.25;
            pos = dir.normalize().multiplyScalar(R * 3.4 + 4);
            look = PLANET_DIR.clone().multiplyScalar(R * 0.9).add(new THREE.Vector3(0, -R * 0.35, 0));
            up = new THREE.Vector3(0, 1, 0);
        } else {
            const tan = Math.tan((cam.fov * Math.PI) / 360);
            const D = Math.min(26, Math.max(12, 5.6 / (cam.aspect * tan)));
            const tilt = 0.55;
            look = p.clone().multiplyScalar(R);
            pos = look.clone().addScaledVector(p, D * Math.cos(tilt)).addScaledVector(f, -D * Math.sin(tilt));
            up = f;
        }
        const k = this.snap ? 1 : 1 - Math.exp(-dt * (mode === 'title' ? 2 : 14));
        if (this.camPos.distanceTo(pos) > 30) this.snap = true;
        this.camPos.lerp(pos, this.snap ? 1 : k);
        this.camUp.lerp(up, this.snap ? 1 : k).normalize();
        this.camLook.lerp(look, this.snap ? 1 : k);
        this.snap = false;
        cam.position.copy(this.camPos);
        this.shake = Math.max(0, this.shake - dt * 2.5);
        if (this.shake > 0) cam.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.shake * 0.6));
        cam.up.copy(this.camUp);
        cam.lookAt(this.camLook);
    }
}
