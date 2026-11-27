// The 3D view: the Solitaire, the mothership and its barrier, the escort drones, missiles, enemy fire,
// explosions and the Lance itself. Reads G every frame and answers sim events. Never changes G.
//
// World layout: the Solitaire sits at the origin with its nose down -Z; the mothership looms ahead at z ≈ -100;
// escorts fly in from the mothership toward z ≈ -16 and hover there to shoot.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { Craft, cloneCraft } from './models.js';
import { BOSSES } from '../sim/data.js';
import { ELEMENTS, BEAM, MISSILE } from '../config.js';

export const EL_COLOR = { power: 0xff4a5a, speed: 0xffd84a, thermal: 0xff8a2a, cryo: 0x5fe8ff, volt: 0xb070ff, shield: 0x5dff9a };
const SHIP_NOSE = new THREE.Vector3(0, 0.1, -2.6);
const BOSS_POS = new THREE.Vector3(0, 16, -110);
// how each Meshy model has to turn: the Solitaire's nose down -Z (toward the enemy), the drone's lens and every
// mothership's bow toward +Z (toward the player). Checked by eye in dev/models.html.
export const YAW = { solitaire: -Math.PI / 2, drone: Math.PI / 2, picket: Math.PI / 2, ember: Math.PI / 2, glacier: Math.PI / 2, storm: Math.PI / 2, prism: Math.PI / 2, throne: 0 };

function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();
const glowMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/** The mothership's barrier: a fresnel bubble with hexagon lines, tinted by the element it resists most. */
function barrierMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x88aaff) }, uTime: { value: 0 }, uHit: { value: 0 }, uAlpha: { value: 0.5 } },
        vertexShader: `
            varying vec3 vN; varying vec3 vV; varying vec3 vP;
            void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `
            uniform vec3 uColor; uniform float uTime, uHit, uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vP;
            float hex(vec2 p){ p = abs(fract(p * vec2(1.0, 0.577) + vec2(0.0, 0.5)) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
            void main(){
                float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
                f = f * f;
                vec3 d = normalize(vP);
                vec2 uv = vec2(atan(d.z, d.x) * 3.0, d.y * 6.0 + uTime * 0.15);
                float line = smoothstep(0.12, 0.0, hex(uv));
                float a = (f * f * 0.9 + line * f * 0.35 + uHit * (0.15 + line * 0.6)) * uAlpha;
                gl_FragColor = vec4(uColor * (0.6 + uHit * 1.5), clamp(a, 0.0, 1.0));
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

/** The Lance: a long beam with braided bands in the colours of its charge. */
function beamMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }, uA: { value: new THREE.Color(1, 0.5, 0.2) }, uB: { value: new THREE.Color(0.4, 0.9, 1) },
            uC: { value: new THREE.Color(0.7, 0.4, 1) }, uOn: { value: 0 },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
            uniform float uTime, uOn; uniform vec3 uA, uB, uC; varying vec2 vUv;
            void main(){
                float a = vUv.x * 6.2832;
                float s = vUv.y * 40.0 - uTime * 30.0;
                float w1 = 0.5 + 0.5 * sin(a * 3.0 + s);
                float w2 = 0.5 + 0.5 * sin(a * 3.0 + s + 2.094);
                float w3 = 0.5 + 0.5 * sin(a * 3.0 + s + 4.189);
                vec3 c = uA * w1 + uB * w2 + uC * w3;
                c = c / max(0.6, w1 + w2 + w3) * 1.5 + vec3(0.12);
                float core = smoothstep(0.35, 0.0, abs(fract(vUv.x * 2.0) - 0.5));
                c += vec3(1.0) * core * 0.6;
                gl_FragColor = vec4(min(c, vec3(3.0)) * uOn, uOn);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
}

export class View {
    constructor(canvas) {
        this.stage = new Stage(canvas);
        const sc = this.stage.scene;
        this.scene = sc;

        this.ship = new Craft('solitaire', { size: 5, yaw: YAW.solitaire, outline: 0.006 });
        sc.add(this.ship.root);
        this.engine = new THREE.Sprite(glowMat(0x6fd8ff, 0.9));
        this.engine.scale.setScalar(2.2);
        this.engine.position.set(0, 0, 2.6);
        this.ship.root.add(this.engine);
        this.lanceGlow = new THREE.Sprite(glowMat(0xffffff, 0));
        this.lanceGlow.position.copy(SHIP_NOSE);
        this.ship.root.add(this.lanceGlow);
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), barrierMaterial());
        this.shield.material.uniforms.uColor.value.set(EL_COLOR.shield);
        this.shield.material.uniforms.uAlpha.value = 0;
        this.ship.root.add(this.shield);

        this.drone = new Craft('drone', { size: 4, yaw: YAW.drone, outline: 0.01, emissive: 0x3a2266 });
        this.drones = new Map();          // sim id → { obj, aim }
        this.missiles = new Map();        // sim id → { spr, from, target, t }
        this.bolts = [];                  // enemy shots in flight
        this.fx = [];                     // bursts and rings
        this.level = -1;
        this.boss = null;
        this.bossGroup = new THREE.Group();
        this.bossGroup.position.copy(BOSS_POS);
        sc.add(this.bossGroup);
        this.barrier = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), barrierMaterial());
        this.bossGroup.add(this.barrier);
        this.barrierHit = 0;
        this.barrierGone = 0;

        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).rotateX(Math.PI / 2), beamMaterial());
        this.beam.visible = false;
        this.beam.frustumCulled = false;
        sc.add(this.beam);
        this.beamCore = new THREE.Sprite(glowMat(0xffffff, 0));
        sc.add(this.beamCore);
        this.beamT = -1;
        this.dodge = 0;                   // how far the mothership slipped aside from a slow shot
        this.dodgeT = 0;
        this.dying = 0;                   // the mothership coming apart
        this.warp = 1;
        this.tmp = new THREE.Vector3();
        this.setLevel(0);
    }

    setRegion(r) { this.stage.setRegion(r); }

    setLevel(lv) {
        if (lv === this.level) return;
        this.level = lv;
        const b = BOSSES[lv];
        if (this.boss) this.bossGroup.remove(this.boss.root);
        this.boss = new Craft(b.id, { size: 70, yaw: YAW[b.id] ?? -Math.PI / 2, kind: 'boss', hue: b.hue, outline: 0.0025 });
        this.boss.holder.rotation.y = 0.85;      // three-quarters on, so its length shows
        this.bossGroup.add(this.boss.root);
        this.barrier.scale.setScalar(44);
        this.barrier.material.uniforms.uColor.value.set(b.hue);
        this.resetBoss();
    }

    resetBoss() {
        this.dying = 0;
        this.barrierGone = 0;
        this.dodge = 0;
        this.boss.root.visible = true;
        this.boss.root.scale.setScalar(1);
        this.boss.root.rotation.set(0, 0, 0);
        this.beamT = -1;
        this.beam.visible = false;
    }

    // ------------------------------------------------------------------ fx
    burst(pos, color, size = 4, life = 0.6) {
        const s = new THREE.Sprite(glowMat(color, 1));
        s.position.copy(pos);
        s.scale.setScalar(size * 0.3);
        this.scene.add(s);
        this.fx.push({ s, t: 0, life, size });
    }
    ring(pos, color, size = 6) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.copy(pos);
        m.lookAt(this.stage.camera.position);
        this.scene.add(m);
        this.fx.push({ s: m, t: 0, life: 0.5, size, ring: true });
    }

    dronePos(d, time, out = new THREE.Vector3()) {
        const z = THREE.MathUtils.lerp(-80, -18, d.a);
        const bob = d.st === 'in' ? 0 : Math.sin(time * 1.7 + d.id) * 0.6;
        return out.set(d.lane * 12 + Math.sin(time * 0.9 + d.id * 2) * (d.st === 'in' ? 0 : 1.2), 3 + d.alt * 6 + bob, z);
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events, time) {
        const m = G.m;
        for (const e of events) {
            switch (e.type) {
                case 'brief': this.setLevel(e.level); this.resetBoss(); break;
                case 'hangar': if (G.unlocked < BOSSES.length) this.setLevel(Math.min(G.unlocked, BOSSES.length - 1)); this.resetBoss(); break;
                case 'missile': {
                    const spr = new THREE.Sprite(glowMat(0xfff3a0, 1));
                    spr.scale.setScalar(1.1);
                    const from = new THREE.Vector3((Math.random() - 0.5) * 3, 0.6, -1);
                    this.missiles.set(e.id, { spr, from, target: e.target, t: 0, side: Math.random() < 0.5 ? -1 : 1 });
                    this.scene.add(spr);
                    break;
                }
                case 'boom': {
                    const d = this.drones.get(e.id);
                    if (d) this.burst(d.obj.position, 0xffd27a, e.dead ? 7 : 3, e.dead ? 0.7 : 0.3);
                    break;
                }
                case 'droneDown': {
                    const d = this.drones.get(e.id);
                    if (d) { this.burst(d.obj.position, 0xff7a3a, 10, 0.9); this.ring(d.obj.position, 0xffc06a, 8); this.scene.remove(d.obj); this.drones.delete(e.id); }
                    break;
                }
                case 'shot': {
                    const d = this.drones.get(e.id);
                    if (!d) break;
                    const spr = new THREE.Sprite(glowMat(0xff3a6a, 1));
                    spr.scale.setScalar(1.6);
                    spr.position.copy(d.obj.position);
                    this.scene.add(spr);
                    this.bolts.push({ spr, from: d.obj.position.clone(), t: 0 });
                    break;
                }
                case 'hit':
                    if (e.absorbed > 0) this.shieldFlash = 1;
                    if (e.rest > 0) { this.stage.shake = Math.min(1, this.stage.shake + 0.5); this.burst(new THREE.Vector3(0, 0.5, 0), 0xff5a3a, 5, 0.5); }
                    break;
                case 'downed': this.stage.flash = 0.6; this.stage.shake = 1; break;
                case 'shift': this.barrierHit = 1; this.updateBarrierColor(G); break;
                case 'route': this.burst(SHIP_NOSE.clone(), EL_COLOR[e.stat], 6, 0.6); break;
                case 'exposed': this.barrierHit = 1; break;
                case 'round': this.clearActors(); break;
                case 'roundEnd': this.clearActors(true); break;
                case 'fire': this.fire(G); break;
                case 'stage': this.onStage(e); break;
                case 'destroyed': this.dying = 0.0001; this.stage.flash = 1; this.stage.film.uniforms.uFlashColor.value.set(1, 1, 1); break;
                case 'survived': this.beamT = Math.max(this.beamT, BEAM.verdict); break;
            }
        }
        void m; void time;
    }

    clearActors(explode = false) {
        for (const d of this.drones.values()) { if (explode) this.burst(d.obj.position, 0xff9a4a, 6, 0.6); this.scene.remove(d.obj); }
        this.drones.clear();
        for (const ms of this.missiles.values()) this.scene.remove(ms.spr);
        this.missiles.clear();
        for (const b of this.bolts) this.scene.remove(b.spr);
        this.bolts = [];
    }

    updateBarrierColor(G) {
        const m = G.m;
        if (!m) return;
        const top = ELEMENTS.reduce((a, e) => (m.resist[e] > m.resist[a] ? e : a), ELEMENTS[0]);
        const c = m.resist[top] > 0.05 ? EL_COLOR[top] : BOSSES[m.level].hue;
        this.barrier.material.uniforms.uColor.value.set(c);
    }

    fire(G) {
        this.clearActors(true);
        const c = G.m.charge;
        const tot = ELEMENTS.reduce((s, e) => s + c[e], 0) || 1;
        const u = this.beam.material.uniforms;
        const mix = (e) => new THREE.Color(EL_COLOR[e]).lerp(new THREE.Color(1, 1, 1), 0.2 * (1 - c[e] / tot));
        u.uA.value.copy(mix('thermal')); u.uB.value.copy(mix('cryo')); u.uC.value.copy(mix('volt'));
        this.beamT = 0;
        this.dodge = 0;
        this.dodgeTarget = 0;
        this.shot = G.m.shot;
    }

    onStage(e) {
        if (e.key === 'speed') {
            // a slow beam: the mothership slips aside and the Lance only grazes it
            this.dodgeTarget = e.ratio >= 1 ? 0 : (1 - Math.max(0, e.ratio)) * 26;
            this.burst(BOSS_POS.clone(), 0xffffff, 18, 0.5);
        } else if (e.key === 'barrier') {
            this.barrierHit = 1.5;
            if (e.ratio >= 1) { this.barrierGone = 0.0001; this.ring(BOSS_POS.clone(), 0xffffff, 80); this.stage.flash = 0.35; }
        } else if (e.key === 'armor') {
            for (let i = 0; i < (e.ratio >= 1 ? 8 : 3); i++) {
                this.burst(BOSS_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 14, 12)), 0xffb04a, 14, 0.8);
            }
            this.stage.shake = 0.7;
        }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, mode) {
        const m = G.m;
        const phase = m ? m.phase : 'hangar';
        // the ship
        const sr = this.ship.root;
        sr.position.set(Math.sin(time * 0.8) * 0.35, Math.sin(time * 1.3) * 0.25 - 0.4, 0);
        sr.rotation.z = Math.sin(time * 0.8) * 0.06;
        this.engine.material.opacity = 0.7 + Math.sin(time * 30) * 0.15;
        // the deflector shows its charge as a faint bubble, and flashes when it blocks
        this.shieldFlash = Math.max(0, (this.shieldFlash || 0) - dt * 2.5);
        const sh = m ? m.shield / 60 : 0;
        this.shield.material.uniforms.uAlpha.value = Math.min(1, sh * 0.35 + this.shieldFlash);
        this.shield.material.uniforms.uHit.value = this.shieldFlash;
        this.shield.material.uniforms.uTime.value = time;

        // the lance tip glows with the charge
        if (m) {
            const total = Object.values(m.charge).reduce((s, v) => s + v, 0);
            const req = BOSSES[m.level].req;
            const k = Math.min(1.6, total / (req.speed + req.barrier + req.armor));
            this.lanceGlow.material.opacity = phase === 'beam' ? 0 : 0.25 + k * 0.6;
            this.lanceGlow.scale.setScalar(0.6 + k * 2.2 + Math.sin(time * 12) * 0.1);
        } else this.lanceGlow.material.opacity = 0;

        // the mothership drifts
        const bg = this.bossGroup;
        this.dodge += ((this.dodgeTarget || 0) - this.dodge) * Math.min(1, dt * 5);
        bg.position.set(BOSS_POS.x + Math.sin(time * 0.21) * 2 + this.dodge, BOSS_POS.y + Math.sin(time * 0.33) * 1.2, BOSS_POS.z);
        this.boss.root.rotation.y = Math.sin(time * 0.17) * 0.08;
        this.boss.root.rotation.z = Math.sin(time * 0.23) * 0.03;
        // its barrier
        this.barrierHit = Math.max(0, this.barrierHit - dt * 1.5);
        const bu = this.barrier.material.uniforms;
        bu.uTime.value = time;
        bu.uHit.value = this.barrierHit;
        if (this.barrierGone > 0) {
            this.barrierGone += dt;
            this.barrier.scale.setScalar(44 * (1 + this.barrierGone * 0.35));
            bu.uAlpha.value = Math.max(0, 0.6 - this.barrierGone * 1.6);
        } else {
            this.barrier.scale.setScalar(44);
            bu.uAlpha.value = phase === 'hangar' ? 0.3 : 0.5;
        }
        if (m && phase !== 'beam' && phase !== 'result') this.updateBarrierColor(G);

        // the mothership dies
        if (this.dying > 0) {
            this.dying += dt;
            if (Math.random() < dt * 14) {
                this.burst(bg.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 20 + 8)), Math.random() < 0.5 ? 0xffd07a : 0xff6a3a, 16 + Math.random() * 14, 0.9);
            }
            this.boss.root.rotation.z = this.dying * 0.08;
            if (this.dying > 1.6) {
                const k = Math.max(0, 1 - (this.dying - 1.6) / 0.6);
                this.boss.root.scale.setScalar(Math.max(0.001, k));
                if (k <= 0 && this.boss.root.visible) {
                    this.boss.root.visible = false;
                    this.ring(bg.position.clone(), 0xffffff, 140);
                    this.burst(bg.position.clone(), 0xffffff, 120, 1.4);
                    this.stage.flash = 0.9;
                }
            }
        }
        if (phase === 'hangar' || phase === 'brief') {
            if (this.dying > 0 && phase === 'brief') this.resetBoss();
        }

        // drones follow the sim
        if (m && phase === 'round') {
            const seen = new Set();
            for (const d of m.drones) {
                seen.add(d.id);
                let v = this.drones.get(d.id);
                if (!v) {
                    const obj = cloneCraft(this.drone);
                    // gunmetal vanishes against space: a hot engine glow and a rim of light mark every escort
                    const eng = new THREE.Sprite(glowMat(0xff4fd8, 0.9));
                    eng.scale.setScalar(2.6);
                    eng.position.set(0, 0, 2.2);        // the sensor on its nose, which faces the Solitaire
                    obj.add(eng);
                    const halo = new THREE.Sprite(glowMat(0x9f7aff, 0.35));
                    halo.scale.setScalar(7);
                    obj.add(halo);
                    const aim = new THREE.Sprite(glowMat(0xff2a5a, 0));
                    aim.position.set(0, 0, 2.4);
                    obj.add(aim);
                    v = { obj, aim, stand: !this.drone.model };
                    this.drones.set(d.id, v);
                    this.scene.add(obj);
                }
                if (v.stand && this.drone.model) {
                    // the model finished loading after this escort launched: swap the stand-in out
                    v.obj.remove(v.obj.children[0]);
                    v.obj.add(this.drone.model.clone(true));
                    v.stand = false;
                }
                this.dronePos(d, time, v.obj.position);
                v.obj.lookAt(this.tmp.set(sr.position.x, sr.position.y, sr.position.z + 4));
                v.obj.rotateZ(time * (d.st === 'in' ? 4 : 0.6) + d.id);
                const aiming = d.st === 'aim';
                v.aim.material.opacity = aiming ? 0.6 + 0.4 * Math.sin(time * 30) : 0;
                v.aim.scale.setScalar(aiming ? 1.5 + (1 - d.t) * 2.5 : 0.1);
            }
            for (const [id, v] of this.drones) if (!seen.has(id)) { this.scene.remove(v.obj); this.drones.delete(id); }
        } else if (this.drones.size) this.clearActors();

        // missiles: a curling arc from the ship to the escort they were fired at
        for (const [id, ms] of this.missiles) {
            ms.t += dt;
            const k = Math.min(1, ms.t / MISSILE.flight);
            const tgt = this.drones.get(ms.target);
            const end = tgt ? tgt.obj.position : this.tmp.set(ms.from.x, ms.from.y + 3, -30);
            const mid = new THREE.Vector3((ms.from.x + end.x) / 2 + ms.side * 8, (ms.from.y + end.y) / 2 + 5, (ms.from.z + end.z) / 2);
            const a = ms.from.clone().lerp(mid, k), b = mid.clone().lerp(end, k);
            ms.spr.position.copy(a.lerp(b, k));
            if (k >= 1) { this.scene.remove(ms.spr); this.missiles.delete(id); }
        }
        // enemy bolts
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            b.t += dt / 0.25;
            b.spr.position.copy(b.from).lerp(sr.position, Math.min(1, b.t));
            if (b.t >= 1) { this.scene.remove(b.spr); this.bolts.splice(i, 1); }
        }

        // the Lance
        if (this.beamT >= 0 && m) {
            // the shot keeps time with the sim (fast-forwarded tests, a skip), then fades on its own
            this.beamT = phase === 'beam' ? m.t : this.beamT + dt;
            const t = this.beamT;
            const nose = SHIP_NOSE.clone().add(sr.position);
            if (t < 1.3) {
                // charging: the tip swells, the camera tightens
                this.lanceGlow.material.opacity = 1;
                this.lanceGlow.scale.setScalar(1 + t * 2.4);
                this.beam.visible = false;
            } else if (t < BEAM.verdict + 0.4) {
                const target = bg.position.clone().add(new THREE.Vector3(-this.dodge * 0.7, 0, 18));
                const dir = target.clone().sub(nose);
                const len = dir.length() * Math.min(1, (t - 1.3) * 3);
                const width = 0.45 + Math.min(2, (this.shot?.min ?? 1)) * 0.6 + Math.sin(time * 40) * 0.08;
                this.beam.visible = true;
                this.beam.position.copy(nose).addScaledVector(dir.normalize(), len / 2);
                this.beam.lookAt(target);
                this.beam.scale.set(width, width, len);
                this.beam.material.uniforms.uOn.value = Math.min(1, (t - 1.3) * 4);
                this.beam.material.uniforms.uTime.value = time;
                this.beamCore.position.copy(nose);
                this.beamCore.material.opacity = 1;
                this.beamCore.scale.setScalar(3.2 + Math.sin(time * 30) * 0.5);
                this.stage.shake = Math.max(this.stage.shake, 0.25);
                if (t === this.beamT && Math.random() < dt * 20) this.burst(target, 0xffffff, 10, 0.3);
            } else {
                const k = Math.max(0, 1 - (t - BEAM.verdict - 0.4) * 2);
                this.beam.material.uniforms.uOn.value = k;
                this.beamCore.material.opacity = k;
                if (k <= 0) { this.beam.visible = false; this.beamT = -1; }
            }
        } else {
            this.beam.visible = false;
            this.beamCore.material.opacity = 0;
        }

        // fx
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.t += dt;
            const k = f.t / f.life;
            if (f.ring) { f.s.scale.setScalar(f.size * (0.2 + k)); f.s.material.opacity = 1 - k; }
            else { f.s.scale.setScalar(f.size * (0.3 + k * 0.9)); f.s.material.opacity = 1 - k * k; }
            if (k >= 1) { this.scene.remove(f.s); f.s.material.dispose(); if (f.ring) f.s.geometry.dispose(); this.fx.splice(i, 1); }
        }

        // the camera pulls in for the shot
        const cb = this.stage.camBase;
        const shooting = phase === 'beam';
        const tx = shooting ? 14 : 0, ty = shooting ? 5 : 4.2, tz = shooting ? 14 : 12;
        const k = Math.min(1, dt * 2);
        cb.x += (tx - cb.x) * k; cb.y += (ty - cb.y) * k; cb.z += (tz - cb.z) * k;
        const cl = this.stage.camLook, lx = shooting ? -4 : 0, ly = shooting ? 9 : 7.5, lz = shooting ? -60 : -40;
        cl.x += (lx - cl.x) * k; cl.y += (ly - cl.y) * k; cl.z += (lz - cl.z) * k;
        this.warp = mode === 'title' ? 2.2 : phase === 'round' ? 1.4 : phase === 'beam' ? 0.4 : 1;
        this.stage.frame(dt, time, { warp: this.warp });
    }
}
