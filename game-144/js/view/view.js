// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x - 16, 9 - y, 0); see stage.js.

import * as THREE from 'three';
import { Stage, wx, wy } from './stage.js';
import { Sky } from './sky.js';
import { FX, BULLET_COLS } from './fx.js';
import { playerShip, optionDrone, enemyModel, bossModel, capsule, glow, hullTexture } from './models.js';
import { PILOT_BY_ID } from '../sim/data/pilots.js';
import { STAGES } from '../sim/data/world.js';
import { POWERUPS } from '../sim/data/powerups.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { optionPositions } from '../sim/player.js';
import { WEAPON, SCROLL } from '../config.js';
import { loadMeshy, dressShip, dressEnemy, dressBoss } from './meshy.js';

const SHIELD_VS = 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const SHIELD_FS = `uniform vec3 uCol; uniform float uA, uT; varying vec3 vN; varying vec3 vV;
    void main(){ float f = clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0); f = f * f * f; float hex = 0.5 + 0.5 * sin(vN.x * 30.0 + uT * 3.0) * sin(vN.y * 30.0 - uT * 2.0);
        float a = clamp(f * 1.6 + hex * 0.08, 0.0, 1.0) * uA; gl_FragColor = vec4(uCol * a * 2.0, a); }`;

export class View {
    constructor(canvas, { quality = 'high' } = {}) {
        this.stage = new Stage(canvas, { quality });
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.sky = new Sky(this.stage);
        this.fx = new FX(this.stage);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.enemies = new Map();
        this.items = new Map();
        this.boss = null;
        this.capital = null;
        this.timers = [];
        this.pilot = null;
        this.warp = 0;
        this.shown = true;
        this.calm = false;
        this.tmpV = new THREE.Vector3();

        // the hitbox dot and the focus ring
        this.hitDot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), glow(0xffffff, 3));
        this.hitDot.renderOrder = 9;
        this.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 2), transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.root.add(this.hitDot, this.focusRing);
        // the shield bubble
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 18), new THREE.ShaderMaterial({ vertexShader: SHIELD_VS, fragmentShader: SHIELD_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uCol: { value: new THREE.Color(0.3, 0.8, 1.0) }, uA: { value: 0 }, uT: { value: 0 } } }));
        this.root.add(this.shield);
        // halo blades
        this.blades = [];
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 16), glow(0xfff0a0, 3));
            b.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow(0xffffff, 3)));
            b.visible = false;
            this.root.add(b);
            this.blades.push(b);
        }
        // the Halberd Lance burst beam
        this.halberd = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 1.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        this.halberd.visible = false;
        this.root.add(this.halberd);
        // capital-ship hull: one instanced unit box per hull block
        const t = hullTexture();
        this.hullMats = {
            frigate: new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffa060, emissiveIntensity: 1.1, roughness: 0.45, metalness: 0.75 }),
            mothership: new THREE.MeshStandardMaterial({ color: 0x5a3a36, roughness: 0.65, metalness: 0.35, emissive: 0x501008, emissiveIntensity: 0.6, map: t.map }),
        };
        this.options = [];
        // Meshy models load in the background; anything built before they arrive keeps its procedural model
        this.meshyReady = false;
        loadMeshy().then((n) => { this.meshyReady = n > 0; this.meshyLoaded = n; this.pilot = null; this.reset(); });
    }

    setQuality(calm) { this.calm = calm; this.stage.calm = calm; }

    // ------------------------------------------------------------------ syncing
    ensurePilot(G) {
        if (this.pilot === G.pilot) return;
        if (this.ship) this.root.remove(this.ship);
        this.pilot = G.pilot;
        this.pl = PILOT_BY_ID[G.pilot];
        this.ship = dressShip(playerShip(G.pilot), 'ship-' + G.pilot);
        this.root.add(this.ship);
        for (const o of this.options) this.root.remove(o);
        this.options = [0, 1, 2, 3].map(() => { const o = optionDrone(this.pl.color); o.visible = false; this.root.add(o); return o; });
        this.focusRing.material.color.set(this.pl.color).multiplyScalar(1.6);
        this.shield.material.uniforms.uCol.value.set(0x40d0ff);
    }

    stageId(G) { return G.mode === 'endless' ? 'endless' : STAGES[G.stage]?.id || 'saturn'; }

    syncEnemies(G, time, dt) {
        const seen = new Set();
        const bossKey = G.boss && !G.boss.dead ? G.boss.key : null;
        for (const e of G.enemies) {
            seen.add(e.id);
            let o = this.enemies.get(e.id);
            if (!o) {
                let model = ENEMIES[e.type].model;
                if (G.boss && e.parent === G.boss.id) {
                    if (bossKey === 'mother' && e.type === 'turret') model = 'tentacleEye';
                    if (bossKey === 'heart' && e.type === 'bigturret') model = 'haloRing';
                    if (bossKey === 'wyrm' && e.type === 'segment') model = 'crystalSegment';
                }
                o = dressEnemy(enemyModel(model, BULLET_COLS[e.c % 6].getHex()), model);
                if (ENEMIES[e.type].big || e.type === 'engine') o.scale.setScalar(e.scale || 1);
                const hit = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.05, 10, 8), glow(0xffffff, 1.2));
                hit.material = hit.material.clone(); hit.material.transparent = true; hit.material.opacity = 0.0; hit.material.blending = THREE.AdditiveBlending; hit.material.depthWrite = false;
                o.add(hit);
                o.userData.hit = hit;
                o.userData.born = time;
                this.root.add(o);
                this.enemies.set(e.id, o);
            }
            o.position.set(wx(e.x), wy(e.y), 0);
            const P = o.userData.parts;
            const age = time - o.userData.born;
            o.scale.setScalar((e.scale || 1) * Math.min(1, age * 4));
            // facing and motion
            if (ENEMIES[e.type].move === 'mounted') {
                const a = Math.atan2(-(G.player.y - e.y), G.player.x - e.x);
                if (o.userData.barrel) o.userData.barrel.rotation.z = a - Math.PI;
            } else {
                o.rotation.z = Math.atan2(-e.vy, -e.vx || -0.001) * 0.35 * (e.type === 'dart' || e.type === 'kamikaze' ? 2 : 1);
                if (e.type === 'kamikaze') o.rotation.z = Math.atan2(-e.vy, e.vx) + Math.PI;
                o.rotation.x = Math.sin(time * 2 + e.id) * 0.25;
            }
            for (const s of P.spin) s.rotation.z += dt * 2.5;
            for (const f of P.flames) f.scale.set(0.8 + Math.random() * 0.4, 1, 1);
            const h = o.userData.hit;
            h.material.opacity = e.flash > 0 ? 0.55 : Math.max(0, h.material.opacity - dt * 6);
        }
        for (const [id, o] of this.enemies) if (!seen.has(id)) { this.root.remove(o); this.enemies.delete(id); }
    }

    syncBoss(G, time, dt) {
        const B = G.boss;
        if (!B || (B.dead && G.bossClear <= 0)) {
            if (this.boss) { this.root.remove(this.boss.obj); this.boss = null; }
            this.stage.lean = 0;
            return;
        }
        if (!this.boss || this.boss.id !== B.id || this.boss.key !== B.key) {
            if (this.boss) this.root.remove(this.boss.obj);
            const obj = dressBoss(bossModel(B.key), B.key);
            this.root.add(obj);
            this.boss = { id: B.id, key: B.key, obj };
        }
        const obj = this.boss.obj, P = obj.userData.parts;
        obj.visible = !B.dead || Math.random() < 0.6;
        obj.position.set(wx(B.x), wy(B.y), B.dead ? -2 : 0);
        if (B.dead) { obj.rotation.z += dt * 0.15; obj.position.y -= (4 - G.bossClear) * 0.6; }
        this.stage.lean = B.dead ? 0 : 1;
        if (P.core && P.core.material && P.core.material.emissiveIntensity != null) P.core.material.emissiveIntensity = B.vuln ? 2.2 + Math.sin(time * 9) * 0.8 + (B.flash > 0 ? 3 : 0) : 0.4;
        for (const gl of P.glows) gl.scale.setScalar(0.8 + Math.sin(time * 6 + gl.position.x) * 0.25);
        for (const s of P.spin) s.rotation.x += dt * 0.8;
        if (P.eye) { const a = Math.atan2(-(G.player.y - B.y), G.player.x - B.x); P.eye.rotation.y = -Math.PI / 2 - (a - Math.PI) * 0.25; P.eye.rotation.x = Math.sin(a) * 0.3; }
        const X = P.extra;
        if (X.lidTop) { const open = B.vuln ? 1 : 0; X.o = (X.o ?? 0) + (open - (X.o ?? 0)) * Math.min(1, dt * 8); X.lidTop.rotation.z = Math.PI / 2 + X.o * 1.2; X.lidBot.rotation.z = -Math.PI / 2 - X.o * 1.2; X.lidTop.rotation.y = Math.PI / 2; X.lidBot.rotation.y = Math.PI / 2; }
        if (X.jaw) X.jaw.rotation.z = Math.PI / 2 + 0.2 + Math.abs(Math.sin(time * 3)) * 0.35;
        if (X.wings) X.wings.forEach((w, i) => { w.rotation.y = Math.sin(time * 1.5 + i) * 0.25; });
        if (X.blade) X.blade.visible = G.enemies.some((e) => e.parent === B.id && e.part === 'sword' && !e.dead);
        if (X.tentacles) {
            const tips = G.enemies.filter((e) => e.parent === B.id && !e.dead);
            X.tentacles.forEach((t, i) => {
                const tip = tips[i];
                t.visible = !!tip;
                if (!tip) return;
                const dx = tip.x - B.x, dy = -(tip.y - B.y);
                const L = Math.hypot(dx, dy);
                t.position.set(dx / 2, dy / 2, -0.2);
                t.scale.set(1, L, 1);
                t.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
            });
        }
    }

    syncCapital(G) {
        const C = G.capital;
        if (!C) { if (this.capital) { this.root.remove(this.capital.mesh); this.capital = null; } return; }
        if (!this.capital || this.capital.id !== C.id) {
            if (this.capital) this.root.remove(this.capital.mesh);
            const mat = this.hullMats[C.kind] || this.hullMats.frigate;
            const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, C.blocks.length);
            mesh.frustumCulled = false;
            this.root.add(mesh);
            this.capital = { id: C.id, mesh };
        }
        const tmp = this._t || (this._t = new THREE.Object3D());
        const depth = C.kind === 'mothership' ? 9 : 5;
        C.blocks.forEach((b, i) => {
            const x = C.x + b.x;
            tmp.position.set(wx(x + b.w / 2), wy(C.y + b.y + b.h / 2), C.kind === 'mothership' ? -2.5 : 0);
            tmp.scale.set(b.w + (C.kind === 'mothership' ? 0.05 : 0), b.h, depth);
            tmp.rotation.set(C.broken ? (x * 0.01) : 0, 0, C.broken ? Math.sin(x) * 0.05 : 0);
            tmp.updateMatrix();
            this.capital.mesh.setMatrixAt(i, tmp.matrix);
        });
        this.capital.mesh.instanceMatrix.needsUpdate = true;
    }

    syncItems(G, time) {
        const seen = new Set();
        for (const it of G.items) {
            if (it.kind === 'gem') continue;
            seen.add(it.id);
            let o = this.items.get(it.id);
            if (!o) { o = capsule(it.kind, POWERUPS[it.kind]?.color ?? 0xffffff); this.root.add(o); this.items.set(it.id, o); }
            o.position.set(wx(it.x), wy(it.y), 0.6);
            o.userData.shell.rotation.set(time * 1.3, time * 2, 0);
            o.scale.setScalar(1 + Math.sin(time * 6 + it.id) * 0.08);
        }
        for (const [id, o] of this.items) if (!seen.has(id)) { this.root.remove(o); this.items.delete(id); }
    }

    syncPlayer(G, time, dt) {
        this.ensurePilot(G);
        const p = G.player;
        const ship = this.ship;
        const dead = p.dead > 0 || G.phase === 'over';
        const blink = p.inv > 0 && p.dead <= 0 && Math.floor(time * 18) % 2 === 0;
        ship.visible = !dead && !blink && G.phase !== 'talk';
        ship.position.set(wx(p.x), wy(p.y), 0.2);
        // bank into vertical motion, lean with horizontal
        ship.rotation.x += (-(p.vy / 11) * 0.9 - ship.rotation.x) * Math.min(1, dt * 10);
        ship.rotation.z += ((-p.vy / 11) * 0.25 - ship.rotation.z) * Math.min(1, dt * 10);
        const thrust = 1 + Math.max(0, p.vx) * 0.06 + (p.overdriveT > 0 ? 0.5 : 0);
        for (const f of ship.userData.parts.flames) f.scale.set(thrust * (0.85 + Math.random() * 0.3), 1, 1);
        if (ship.visible && Math.random() < 0.35) this.fx.trail(p.x - 0.9, p.y, this.pl.color, 1, 0.1, 7);
        // hitbox and focus ring
        this.hitDot.visible = this.focusRing.visible = ship.visible && p.focus;
        this.hitDot.position.set(wx(p.x), wy(p.y), 1.2);
        this.focusRing.position.copy(this.hitDot.position);
        this.focusRing.rotation.z = time * 2;
        // options
        const ops = optionPositions(G);
        this.options.forEach((o, i) => {
            const t = ops[i];
            o.visible = !!t && !dead;
            if (!t) return;
            const tx = wx(t.x), ty = wy(t.y);
            o.position.x += (tx - o.position.x) * Math.min(1, dt * 12);
            o.position.y += (ty - o.position.y) * Math.min(1, dt * 12);
            o.position.z = 0.2;
            o.rotation.set(time * 3, time * 2, 0);
            o.userData.ring.rotation.set(time * 4, 0, 0);
            if (G.syn.wings) o.scale.setScalar(1.3);
            else o.scale.setScalar(1);
        });
        // shield
        const sh = p.shield > 0 && !dead;
        this.shield.visible = sh;
        if (sh) {
            this.shield.position.copy(ship.position);
            this.shield.material.uniforms.uA.value = 0.45 + p.shield * 0.1 + (p.inv > 0 ? Math.sin(time * 40) * 0.3 : 0);
            this.shield.material.uniforms.uT.value = time;
            this.shield.scale.setScalar(1 + Math.sin(time * 4) * 0.04);
        }
        // halo blades
        const n = dead ? 0 : p.halo * 2, R = WEAPON.haloRadius * (G.syn.sunwheel ? 1.45 : 1);
        this.blades.forEach((b, i) => {
            b.visible = i < n;
            if (!b.visible) return;
            const a = p.haloA + (i / n) * Math.PI * 2;
            b.position.set(wx(p.x + Math.cos(a) * R), wy(p.y + Math.sin(a) * R), 0.3);
            b.rotation.set(time * 6, time * 4, 0);
            b.scale.setScalar(G.syn.sunwheel ? 1.4 : 1);
        });
        // Halberd Lance
        const hal = p.burstT > 0 && p.pilot === 'kaito' && !dead;
        this.halberd.visible = hal;
        if (hal) {
            const w = 4.8 * (0.9 + Math.sin(time * 50) * 0.1);
            this.halberd.scale.set(40, w, 1);
            this.halberd.position.set(wx(p.x) + 20.6, wy(p.y), 0.4);
            if (Math.random() < 0.8) this.fx.burst(p.x + 2 + Math.random() * 28, p.y + (Math.random() - 0.5) * 4, 0xff6060, 1, 6, 0.3, 0.8);
        }
        if (p.overdriveT > 0 && ship.visible && Math.random() < 0.5) this.fx.burst(p.x, p.y, 0xff4ad2, 1, 3, 0.4, 0.7);
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const S = this.stage, F = this.fx;
        let sparks = 0;
        for (const e of events) {
            switch (e.type) {
                case 'stage': case 'theme':
                    this.sky.setStage(G.mode === 'endless' ? 'endless' : e.id, G.mode === 'endless' ? STAGES[G.stage]?.id || 'saturn' : e.id);
                    this.warp = 1.6;
                    break;
                case 'kill': {
                    const big = e.big || e.r > 1;
                    F.explosion(e.x, e.y, big ? 1.6 + e.r * 0.5 : 0.55, big ? 0xff8a3a : BULLET_COLS[(G.stageColor || 0) % 6].getHex());
                    if (big) { S.kick(0.35, 0.12); S.light(e.x, e.y, 0xffa060, 40, 0.4); S.shockwave(e.x, e.y, 0.6); }
                    break;
                }
                case 'boom': F.explosion(e.x, e.y, 0.5, 0xffa040); break;
                case 'spark': if (sparks++ < 3) F.burst(e.x, e.y, 0xffe0a0, 2, 5, 0.2, 0.3); break;
                case 'graze': F.burst(e.x, e.y, 0xffffff, 3, 6, 0.25, 0.25); break;
                case 'bomb':
                    S.kick(1.0, 0.9, e.big ? 0xff60e0 : 0xffffff); S.shockwave(e.x, e.y, 1.6);
                    F.ring(e.x, e.y, 40, e.big ? 0xff40d0 : 0x9fd8ff, 1.2); F.ring(e.x, e.y, 24, 0xffffff, 0.8);
                    for (let i = 0; i < 6; i++) this.later(i * 0.12, () => F.explosion(e.x + 3 + i * 4, e.y + Math.sin(i * 2) * 5, 1.2, 0x9fd8ff));
                    S.light(e.x, e.y, 0xbfe8ff, 120, 1.0);
                    break;
                case 'warp': {
                    const n = 24;
                    for (let i = 0; i <= n; i++) { const t = i / n; F.burst(e.x0 + (e.x1 - e.x0) * t, e.y0 + (e.y1 - e.y0) * t, e.aegis ? 0x60e0ff : 0xc090ff, 2, 3, 0.4, 0.6); }
                    F.ring(e.x1, e.y1, 5, 0xd0a0ff, 0.35); S.kick(0.2, 0.25, 0xc0a0ff); this.warp = Math.max(this.warp, 0.25);
                    break;
                }
                case 'burst':
                    S.kick(0.6, 0.6, this.pl?.color ?? 0xffffff); F.ring(G.player.x, G.player.y, 20, this.pl?.color ?? 0xffffff, 0.8); S.shockwave(G.player.x, G.player.y, 1.2);
                    break;
                case 'die':
                    F.explosion(e.x, e.y, 2.4, this.pl?.color ?? 0x60c0ff); F.explosion(e.x, e.y, 1.2, 0xffffff);
                    S.kick(1.2, 0.8, 0xff4040); S.shockwave(e.x, e.y, 1.4); S.light(e.x, e.y, 0xff6040, 90, 0.8);
                    break;
                case 'shieldHit': F.ring(e.x, e.y, 7, 0x40d0ff, 0.45); F.burst(e.x, e.y, 0x80e0ff, 24, 9, 0.5, 0.5); S.kick(0.4, 0.3, 0x40c0ff); break;
                case 'powerup': F.ring(G.player.x, G.player.y, 3.5, POWERUPS[e.kind]?.color ?? 0xffffff, 0.35); F.burst(G.player.x, G.player.y, POWERUPS[e.kind]?.color ?? 0xffffff, 14, 6, 0.4, 0.4); break;
                case 'synergy': F.ring(G.player.x, G.player.y, 12, 0xffd860, 0.7); S.kick(0.3, 0.35, 0xffd860); break;
                case 'engineDown': F.explosion(e.x, e.y, 2.5, 0xff6030); S.kick(0.7, 0.3); S.shockwave(e.x, e.y, 0.9); break;
                case 'capitalBreak': {
                    S.kick(1.2, 0.6);
                    for (let i = 0; i < 16; i++) this.later(i * 0.14, () => F.explosion(Math.max(2, Math.min(30, e.x + (i / 16) * e.len)), 6 + ((i * 7) % 7), 2.2, 0xff7a30));
                    break;
                }
                case 'boss': this.stage.lean = 1; break;
                case 'phase': if (G.boss) { F.explosion(G.boss.coreW.x, G.boss.coreW.y, 2.5, 0xffffff); S.kick(0.8, 0.5); S.shockwave(G.boss.coreW.x, G.boss.coreW.y, 1.2); } break;
                case 'bossDie':
                    S.kick(1.4, 1.0);
                    for (let i = 0; i < 22; i++) this.later(i * 0.13, () => { F.explosion(e.x + (Math.random() - 0.5) * 9, e.y + (Math.random() - 0.5) * 7, 1.5 + Math.random() * 2, i % 3 ? 0xff8a3a : 0xffffff); this.stage.kick(0.25, 0.08); });
                    this.later(2.9, () => { F.explosion(e.x, e.y, 6, 0xffffff); this.stage.kick(1.4, 1.0); this.stage.shockwave(e.x, e.y, 2.2); F.ring(e.x, e.y, 50, 0xffe0a0, 1.4); });
                    break;
                case 'hatch': F.burst(e.x, e.y, 0x60ff90, 10, 4, 0.4, 0.5); break;
                case 'extend': F.ring(G.player.x, G.player.y, 6, 0x7dff6a, 0.5); break;
                case 'respawn': F.ring(G.player.x, G.player.y, 5, this.pl?.color ?? 0xffffff, 0.5); break;
                default: break;
            }
        }
    }

    later(t, fn) { this.timers.push({ t, fn }); }

    /** A new run (or the attract demo restarting): sim ids start again at 1, so drop every model keyed by id. */
    reset() {
        for (const o of this.enemies.values()) this.root.remove(o);
        for (const o of this.items.values()) this.root.remove(o);
        this.enemies.clear(); this.items.clear();
        if (this.boss) { this.root.remove(this.boss.obj); this.boss = null; }
        if (this.capital) { this.root.remove(this.capital.mesh); this.capital = null; }
        this.timers.length = 0;
    }

    frame(G, dt, time) {
        if (this.game !== G) { this.game = G; this.reset(); }
        if (!this.sky.id) this.sky.setStage(this.stageId(G), G.mode === 'endless' ? STAGES[G.stage]?.id || 'saturn' : this.stageId(G));
        for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
        this.warp = Math.max(0, this.warp - dt * 0.8);
        const talking = G.phase === 'talk';
        this.syncPlayer(G, time, dt);
        this.syncEnemies(G, time, dt);
        this.syncBoss(G, time, dt);
        this.syncCapital(G);
        this.syncItems(G, time);
        this.fx.frame(G, dt, time, this.pl?.color ?? 0xffffff);
        const speed = talking ? 0.3 : (G.boss ? 0.6 : 1) * (SCROLL / 4.2);
        this.sky.update(dt, time, speed, this.warp);
        const u = this.stage.final.uniforms;
        u.uDesat.value += ((G.player.chronoT > 0 ? 0.45 : G.player.dead > 0 ? 0.5 : 0) - u.uDesat.value) * Math.min(1, dt * 4);
        this.stage.update(dt, time, G.player.x, G.player.y);
        this.stage.render();
    }

    /** For the browser test: is a sim point on the screen? */
    onScreen(x, y) { const s = this.stage.toScreen(x, y); return s.x >= 0 && s.y >= 0 && s.x <= this.stage.w && s.y <= this.stage.h; }
}
