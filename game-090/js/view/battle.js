// The battle view: the arena, the units, a camera that cuts to whoever is acting, and the
// director that plays the sim's b_* events in order. Each event animates something and returns
// how long to wait. The 3D scene shows what the events have said so far, never the final state.

import * as THREE from 'three';
import { FX } from './fx.js';
import { TEX, dotTexture } from './tex.js';
import { TOON, toonMat, K, merge, part, glow } from './toon.js';
import { buildCast } from './humans.js';
import { buildDaemon, hexify } from './daemons3d.js';
import { ZONES } from '../sim/data/zones.js';
import { DAEMONS } from '../sim/data/daemons.js';
import { EL } from '../config.js';

const ease = (k) => k * k * (3 - 2 * k);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class BattleView {
    constructor(quality = 2) {
        this.quality = quality;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1.6, 0.3, 120);
        this.fx = new FX(this.scene);
        this.units = new Map();
        this.tweens = [];
        this.arena = null;
        this.t = 0;
        this.cam = { pos: V3(-10, 5, 9), look: V3(1, 1.2, 0), pp: V3(-10, 5, 9), pl: V3(1, 1.2, 0), speed: 4 };
        this.actorRing = null;
        this.flash = null;
        this.stage = null;
        this.look = 0;
        this.onPop = null;          // (id, text, kind) → DOM numbers, set by the UI
        this.speed = 1;
        this.zoneKey = '';
        this.targetRings = [];
        this.shakeAmt = 0;
        this.orbitT = 0;
        this.orbit = false;
    }

    // ------------------------------------------------------------ the arena
    buildArena(zoneId) {
        const key = zoneId || 'none';
        if (key === this.zoneKey && this.arena) return;
        this.zoneKey = key;
        if (this.arena) { this.scene.remove(this.arena); this.arena.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
        const Z = ZONES[zoneId] || ZONES.rift;
        const g = new THREE.Group();
        const accent = new THREE.Color(Z.accent);
        // the floor: a disc of hex-circuit with a glowing rim
        const tex = TEX.hex('#16222a', Z.accent, 21); tex.repeat.set(6, 6);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(13, 48), toonMat({ map: tex, color: 0xffffff }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
        g.add(floor);
        const rim = glow(new THREE.TorusGeometry(12.8, 0.07, 6, 80), Z.accent, { p: [0, 0.05, 0] }); rim.rotation.x = Math.PI / 2; g.add(rim);
        const rim2 = glow(new THREE.TorusGeometry(7.0, 0.04, 6, 64), Z.accent, { p: [0, 0.04, 0], opacity: 0.6 }); rim2.rotation.x = Math.PI / 2; g.add(rim2);
        // ruins and trees round the edge
        const geo = merge([K.box(1.2, 4, 1.2, { c: '#2a3040', g: '#3a4658', p: [0, 2, 0] }), K.box(1.6, 0.4, 1.6, { c: '#4a5668', p: [0, 4.1, 0] })]);
        const ring = new THREE.InstancedMesh(geo, toonMat({ vertexColors: true }), 22);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2, r = 16 + (i % 3) * 3.2, s = 0.7 + ((i * 37) % 10) / 12;
            m4.compose(V3(Math.cos(a) * r, -0.3, Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a + i), V3(s, s * (0.7 + (i % 4) * 0.35), s));
            ring.setMatrixAt(i, m4);
        }
        g.add(ring);
        const bush = new THREE.InstancedMesh(merge([K.sph(1.2, { c: '#2a6a3a', g: '#5ab04a', p: [0, 0.6, 0] }), K.sph(0.9, { c: '#3a8a3a', p: [0.8, 0.4, 0.3] })]), toonMat({ vertexColors: true }), 26);
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2 + 0.1, r = 14.5 + (i % 4) * 1.5;
            m4.compose(V3(Math.cos(a) * r, 0, Math.sin(a) * r), new THREE.Quaternion(), V3(1 + (i % 3) * 0.3, 1 + (i % 2) * 0.4, 1));
            bush.setMatrixAt(i, m4);
        }
        g.add(bush);
        // sky dome
        const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 10), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color(Z.sky[0]).multiplyScalar(1.4) }, uBot: { value: new THREE.Color(Z.sky[1]).multiplyScalar(1.1) } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 uTop; uniform vec3 uBot; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.8, vP.y); gl_FragColor = vec4(mix(uBot, uTop, k), 1.0); }',
        }));
        g.add(sky);
        // a big hex-rift moon behind the foes
        const moon = glow(new THREE.CircleGeometry(9, 6), Z.accent, { opacity: 0.18, p: [40, 22, -30] }); moon.lookAt(0, 5, 0); g.add(moon);
        // lights
        g.add(new THREE.HemisphereLight(Z.light, '#0c1018', 1.2));
        const keyL = new THREE.DirectionalLight('#fff4e0', 2.0); keyL.position.set(-6, 14, 8); keyL.castShadow = this.quality > 0;
        keyL.shadow.mapSize.set(1024, 1024); const sc = keyL.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.far = 40;
        keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.04;
        g.add(keyL);
        const rimA = new THREE.PointLight('#7affd0', 18, 22, 1.6); rimA.position.set(-9, 3, -4); g.add(rimA);
        const rimB = new THREE.PointLight('#d24bff', 18, 22, 1.6); rimB.position.set(9, 3, 4); g.add(rimB);
        // motes
        const n = 120, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 34; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 34; }
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: dotTexture(), color: Z.accent, size: 0.2, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        g.add(this.motes);
        this.scene.add(g);
        this.arena = g;
        this.scene.fog = new THREE.Fog(Z.fog, 26, 70);
        this.scene.background = new THREE.Color(Z.fog);
        this.accent = Z.accent;
    }

    // ------------------------------------------------------------ units
    clearUnits() {
        for (const v of this.units.values()) this.scene.remove(v.root);
        this.units.clear();
        this.tweens.length = 0;
        this.fx.clear();
        for (const r of this.targetRings) this.scene.remove(r);
        this.targetRings = [];
    }

    makeModel(u) {
        if (u.agent) return buildCast('agent', { look: this.look });
        const m = buildDaemon(u.sp);
        if (u.side === 'e') hexify(m);
        return m;
    }

    slotPos(u, i, n) {
        const sp = (u.side === 'p' ? 2.7 : 3.0) * (n > 4 ? 0.85 : 1);
        const z = (i - (n - 1) / 2) * sp;
        const x = u.side === 'p' ? -4.2 + Math.abs(z) * 0.1 : 4.4 - Math.abs(z) * 0.12;
        return V3(x, 0, z);
    }

    addUnit(u, i, n) {
        const model = this.makeModel(u);
        const root = new THREE.Group();
        root.add(model.root);
        const home = this.slotPos(u, i, n);
        root.position.copy(home);
        root.rotation.y = u.side === 'p' ? Math.PI / 2 : -Math.PI / 2;
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), new THREE.MeshBasicMaterial({ map: dotTexture(), color: '#000', transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);
        this.scene.add(root);
        const flashU = { value: 0 };
        const v = { id: u.id, side: u.side, sp: u.sp, agent: u.agent, model, root, home, pos: home.clone(), h: model.h || 1.9, pose: { move: 0 }, down: 0, hurt: 0, dead: 0, alive: u.alive !== false, flashU, glitch: 0, scale: 1, scaleT: 1, boss: u.boss };
        this.units.set(u.id, v);
        this.tuneMaterials(v);
        return v;
    }

    /** Give each toon material in a unit its own flash uniform so a hit can whiten just that unit. */
    tuneMaterials(v) {
        v.model.root.traverse((o) => {
            if (!o.isMesh || !o.material || !o.material.isMeshToonMaterial || o.userData.outline) return;
            const m = toonMat({ vertexColors: o.material.vertexColors, color: o.material.color.getHex(), map: o.material.map, flash: v.flashU, glitch: v.flashG || (v.flashG = { value: v.side === 'e' ? 0.25 : 0 }) });
            o.material = m;
        });
    }

    start(e) {
        this.buildArena(e.zone);
        this.clearUnits();
        const party = e.units.filter((u) => u.side === 'p'), foes = e.units.filter((u) => u.side === 'e');
        party.forEach((u, i) => this.addUnit(u, i, party.length));
        foes.forEach((u, i) => this.addUnit(u, i, foes.length));
        for (const u of e.units) { const v = this.units.get(u.id); if (u.down) v.down = 0.85; if (!u.alive) { v.alive = false; v.dead = 1; v.root.visible = false; } }
        this.overview(true);
        this.cam.speed = 99;
    }

    // ------------------------------------------------------------ camera
    overview(snap = false) {
        const asp = this.camera.aspect;
        const f = (asp < 1 ? 1.6 : asp < 1.4 ? 1.3 : 1.0) * 0.84;
        this.cam.pos.set(-8.6 * f, 4.1 * f, 7.4 * f);
        this.cam.look.set(asp < 1 ? 0.5 : -1.0, asp < 1 ? 0.2 : 1.1, 0);
        this.orbit = false;
        if (snap) { this.cam.pp.copy(this.cam.pos); this.cam.pl.copy(this.cam.look); }
        this.cam.speed = 3.5;
    }
    closeUp(v, side = 1, dist = 4.2, h = 1.6) {
        const p = v.root.position;
        const dir = v.side === 'p' ? 1 : -1;
        this.cam.pos.set(p.x - dir * dist * 0.35 + side * 0, p.y + h, p.z + dist * (side || 1));
        this.cam.look.set(p.x + dir * 0.5, p.y + v.h * 0.55, p.z);
        this.cam.speed = 7;
    }
    twoShot(a, b) {
        const mid = a.root.position.clone().add(b.root.position).multiplyScalar(0.5);
        const asp = this.camera.aspect;
        const span = a.root.position.distanceTo(b.root.position);
        const d = Math.max(7, span * 1.0) * (asp < 1 ? 1.5 : 1);
        this.cam.pos.set(mid.x - 2, 2.8 + d * 0.12, mid.z + d * 0.85);
        this.cam.look.set(mid.x, 1.2, mid.z);
        this.cam.speed = 5;
    }

    // ------------------------------------------------------------ the director
    after(delay, fn) { this.tweens.push({ t: -delay / this.speed, dur: 0.0001, fn: null, done: fn }); }
    tween(dur, fn, done) { this.tweens.push({ t: 0, dur: dur / this.speed, fn, done }); }

    posOf(v) { return v.root.position; }

    /** Play one event. Returns seconds to wait (at the current speed). */
    play(e, G, speed = 1) {
        this.speed = speed;
        const U = (id) => this.units.get(id);
        switch (e.type) {
            case 'b_start': this.start(e); return 0.9;
            case 'b_phase': this.overview(); this.setActor(-1); return 0.35;
            case 'b_ready': { const v = U(e.actor); this.setActor(e.actor); this.overview(); return 0.05; }
            case 'b_act': return this.actStart(e, U);
            case 'b_hit': return this.hit(e, U);
            case 'b_heal': { const v = U(e.id); if (!v) return 0; v.hpShown = e.hp; this.fx.heal(v.root.position.clone()); this.onPop?.(e.id, `+${e.amt}`, 'heal'); return 0.4; }
            case 'b_mp': return 0.3;
            case 'b_cost': return 0;
            case 'b_miss': { const v = U(e.id); if (v) this.onPop?.(e.id, 'MISS', 'miss'); return 0.2; }
            case 'b_down': { const v = U(e.id); if (v) this.tween(0.25, (k) => { v.down = ease(k) * 0.9; }); return 0.3; }
            case 'b_stand': { const v = U(e.id); if (v) { const d0 = v.down; this.tween(0.3, (k) => { v.down = d0 * (1 - ease(k)); }); } return 0.15; }
            case 'b_dead': return this.dead(e, U);
            case 'b_revive': { const v = U(e.id); if (v) { v.alive = true; v.dead = 0; v.root.visible = true; v.root.scale.setScalar(0.01); v.down = 0; this.tween(0.5, (k) => v.root.scale.setScalar(Math.max(0.01, ease(k)))); this.fx.heal(v.root.position.clone()); this.fx.pillar(v.root.position.clone(), '#fffbd0', 6, 0.7, 0.8); } return 0.7; }
            case 'b_buff': { const v = U(e.id); if (v && e.stage !== 0) this.fx.buff(v.root.position.clone(), e.stage > 0, e.stage > 0 ? '#ffd86a' : '#6a8aff'); this.onPop?.(e.id, e.stage === 0 ? 'FADES' : (e.stage > 0 ? '▲' : '▼'), e.stage > 0 ? 'buff' : e.stage < 0 ? 'debuff' : 'miss'); return e.stage === 0 ? 0 : 0.35; }
            case 'b_ail': { const v = U(e.id); if (v) { this.fx.burst(v.root.position.clone().add(V3(0, v.h, 0)), '#c06aff', 14, 2, 0.6, 0.25); this.onPop?.(e.id, e.k.toUpperCase(), 'ail'); } return 0.35; }
            case 'b_guard': { const v = U(e.id); if (v) { v.guard = true; this.fx.ring(v.root.position.clone().setY(0.1), '#8fd8ff', 0.3, 1.8, 0.5); this.fx.ring(v.root.position.clone().add(V3(0, 1, 0)), '#8fd8ff', 0.2, 1.4, 0.4, false); } return 0.35; }
            case 'b_charge': { const v = U(e.id); if (v) { this.fx.burst(v.root.position.clone().add(V3(0, 1, 0)), e.k === 'phys' ? '#ffa24a' : '#7ac0ff', 20, 2.5, 0.6, 0.25); this.fx.pillar(v.root.position.clone(), e.k === 'phys' ? '#ffa24a' : '#7ac0ff', 3, 0.5, 0.6); } return 0.5; }
            case 'b_scan': { const v = U(e.id); if (v) { this.fx.ring(v.root.position.clone().add(V3(0, 1, 0)), '#7affd0', 0.2, 2.4, 0.6, false); } return 0.5; }
            case 'b_skip': { const v = U(e.id); if (v) this.onPop?.(e.id, 'LAGGED', 'ail'); return 0.45; }
            case 'b_dot': { const v = U(e.id); if (v) { this.onPop?.(e.id, `-${e.dmg}`, 'rot'); v.flashU.value = 0.5; this.tween(0.25, (k) => { v.flashU.value = 0.5 * (1 - k); }); } return 0.35; }
            case 'b_ailend': return 0;
            case 'b_endure': { const v = U(e.id); if (v) this.onPop?.(e.id, 'ENDURE!', 'buff'); return 0.4; }
            case 'b_rage': { const v = U(e.id); if (v) { this.closeUp(v, 1, 5, 2); this.fx.ring(v.root.position.clone().setY(0.1), '#ff3a4a', 0.3, 5, 0.8); this.fx.pillar(v.root.position.clone(), '#ff3a4a', 8, 0.8, 1.4); this.stage?.doFlash('#ff2a4a', 0.5); this.stage?.doShake(0.8); } return 1.1; }
            case 'b_msg': return 0.6;
            case 'b_swap': { const old = U(e.id); const fresh = e.unit; if (old) { this.scene.remove(old.root); this.units.delete(e.id); } const party = [...this.units.values()].filter((x) => x.side === 'p'); const idx = Math.max(0, [...this.units.values()].filter((x) => x.side === 'p' && x.id < e.id).length); const v = this.addUnit(fresh, idx, party.length + 1); v.root.position.copy(old ? old.home : v.home); v.home.copy(v.root.position); this.fx.ring(v.root.position.clone().setY(0.1), '#7affd0', 2, 0.3, 0.5); this.fx.pillar(v.root.position.clone(), '#7affd0', 5, 0.6, 0.7); v.root.scale.setScalar(0.01); this.tween(0.4, (k) => v.root.scale.setScalar(Math.max(0.01, ease(k)))); return 0.7; }
            case 'b_join': { const foes = [...this.units.values()].filter((x) => x.side === 'e').length; const v = this.addUnit(e.unit, foes, foes + 1); v.root.scale.setScalar(0.01); this.tween(0.6, (k) => v.root.scale.setScalar(Math.max(0.01, ease(k)))); this.fx.pillar(v.root.position.clone(), '#d24bff', 8, 0.8, 1.2); this.stage?.doFlash('#d24bff', 0.4); this.relayoutFoes(); return 1.0; }
            case 'b_wave': { this.stage?.doShake(0.6); return 0.8; }
            case 'b_allout': return this.allOut(e, U);
            case 'b_neg': return this.neg(e, U);
            case 'b_recoded': return this.recoded(e, U);
            case 'b_flee': { const v = U(e.id); if (v) { this.tween(0.5, (k) => { v.root.position.x = v.home.x + ease(k) * 8; v.root.scale.setScalar(Math.max(0.01, 1 - k * 0.8)); }, () => { v.root.visible = false; }); } return 0.6; }
            case 'b_end': return this.finish(e, U);
            case 'b_icons': return 0;
            default: return 0;
        }
    }

    relayoutFoes() {
        const foes = [...this.units.values()].filter((x) => x.side === 'e' && x.alive);
        foes.forEach((v, i) => { const p = this.slotPos({ side: 'e' }, i, foes.length); v.home.copy(p); this.tween(0.5, (k) => v.root.position.lerp(p, ease(k) * 0.3 + 0.0)); });
    }

    setActor(id) {
        if (!this.actorRing) {
            this.actorRing = glow(new THREE.TorusGeometry(1.0, 0.05, 6, 36), '#ffffff', { opacity: 0.9 });
            this.actorRing.rotation.x = Math.PI / 2;
            this.scene.add(this.actorRing);
        }
        this.actorId = id;
        this.actorRing.visible = id >= 0 && this.units.has(id);
    }

    markTargets(ids, color = '#ff4a6a') {
        while (this.targetRings.length < ids.length) {
            const r = glow(new THREE.TorusGeometry(1.1, 0.045, 6, 32), color, { opacity: 0.9 }); r.rotation.x = Math.PI / 2;
            this.scene.add(r); this.targetRings.push(r);
        }
        this.targetRings.forEach((r, i) => {
            const v = ids[i] != null ? this.units.get(ids[i]) : null;
            r.visible = !!v;
            if (v) { r.position.set(v.root.position.x, 0.08, v.root.position.z); r.material.color.set(color); r.userData.v = v; }
        });
    }

    // ------------------------------------------------------------ the actions
    actStart(e, U) {
        const a = U(e.actor);
        if (!a) return 0.2;
        const targets = e.targets.map(U).filter(Boolean);
        const first = targets[0];
        this.setActor(-1);
        const el = e.el;
        const melee = e.kind === 'atk' && el === 'strike';
        const gun = e.kind === 'atk' && el === 'gun';
        const spell = !melee && !gun;
        if (first && first !== a) this.twoShot(a, first); else this.closeUp(a, 1, 5, 2);
        this.stage?.zoomOn?.(0);
        const col = el ? EL[el]?.color || '#ffffff' : '#9dffb0';
        if (melee && first) {
            const dir = a.side === 'p' ? 1 : -1;
            const from = a.home.clone();
            const to = first.home.clone().add(V3(-dir * 1.6, 0, 0));
            const multi = targets.length > 1;
            this.tween(0.18, (k) => { a.root.position.lerpVectors(from, multi ? from.clone().lerp(to, 0.5) : to, ease(k)); a.pose.move = 1; });
            this.tween(0.4, (k) => { a.pose.atk = k; }, () => { a.pose.atk = 0; a.pose.move = 0; });
            this.after(0.7, () => this.tween(0.25, (k) => a.root.position.lerpVectors(a.root.position, a.home, ease(k) * 0.9), () => a.root.position.copy(a.home)));
            return 0.3;
        }
        if (gun) {
            this.tween(0.35, (k) => { a.pose.atk = Math.min(1, k * 2) * 0.55; }, () => { a.pose.atk = 0; });
            const o = a.root.position.clone().add(V3(a.side === 'p' ? 0.8 : -0.8, 1.3, 0));
            this.fx.burst(o, '#fff0a0', 8, 3, 0.2, 0.2);
            this.fx.light(o, '#fff0a0', 12, 0.15);
            return 0.22;
        }
        // spells and support: a rune circle at the caster's feet in the element's colour, a rising glow
        const base = a.root.position.clone().setY(0.08);
        this.fx.ring(base, col, 2.0, 0.4, 0.55);
        this.fx.ring(base, col, 0.4, 1.7, 0.5);
        for (let i = 0; i < 16; i++) { const ang = i / 16 * 6.283; this.fx.spawn(base.x + Math.cos(ang) * 1.2, 0.1, base.z + Math.sin(ang) * 1.2, 0, 2.2 + Math.random(), 0, col, 0.22, 0.7); }
        this.fx.light(a.root.position.clone().add(V3(0, 1.4, 0)), col, 16, 0.6);
        this.tween(0.6, (k) => { a.pose.cast = Math.sin(k * Math.PI); }, () => { a.pose.cast = 0; });
        if (e.skill && (e.name || '').length) this.stage?.setZoom?.(0);
        return e.kind === 'atk' ? 0.5 : 0.45;
    }

    hit(e, U) {
        const t = U(e.id), a = U(e.actor);
        if (!t) return 0.2;
        const pos = t.root.position.clone();
        const res = e.res;
        const label = { weak: 'WEAK!', crit: 'CRITICAL!', resist: 'RESIST', null: 'NULL', repel: 'REPEL', drain: 'DRAIN', miss: 'MISS' }[res];
        if (res === 'miss' || res === 'null') {
            this.tween(0.2, (k) => { t.root.position.x = t.home.x + Math.sin(k * Math.PI) * (t.side === 'e' ? 0.6 : -0.6); }, () => { t.root.position.copy(t.home); });
            this.onPop?.(e.id, label, res === 'null' ? 'null' : 'miss');
            this.fx.ring(pos.clone().add(V3(0, 1, 0)), '#cfe8ff', 0.2, 1.2, 0.3, false);
            return 0.3;
        }
        if (res === 'drain') { this.fx.heal(pos); this.onPop?.(e.id, `+${e.dmg}`, 'heal'); this.onPop?.(e.id, label, 'null'); return 0.45; }
        if (res === 'repel') {
            this.fx.ring(pos.clone().add(V3(0, 1, 0)), '#cfe8ff', 0.3, 2.2, 0.4, false);
            this.fx.burst(pos.clone().add(V3(0, 1, 0)), '#ffffff', 16, 4, 0.4, 0.22);
            this.onPop?.(e.id, label, 'null');
            return 0.35;
        }
        this.fx.hit(res === 'allout' ? 'root' : e.el, pos, a ? a.root.position : null, res === 'weak' || res === 'crit' || res === 'allout');
        t.flashU.value = 1;
        this.tween(0.22, (k) => { t.flashU.value = 1 - k; });
        const dir = t.side === 'e' ? 1 : -1;
        this.tween(0.28, (k) => { t.root.position.x = t.home.x + dir * Math.sin(k * Math.PI) * 0.7 * (res === 'weak' ? 1.6 : 1); t.pose.hurt = Math.sin(k * Math.PI); }, () => { if (t.alive) t.root.position.copy(t.home); t.pose.hurt = 0; });
        const big = res === 'weak' || res === 'crit' || res === 'allout';
        this.stage?.doShake(big ? 0.7 : 0.25);
        if (big) { this.stage?.doFlash(EL[e.el]?.color || '#ffffff', res === 'allout' ? 0.25 : 0.4); }
        this.onPop?.(e.id, `${e.dmg}`, res === 'weak' ? 'weak' : res === 'crit' ? 'crit' : res === 'resist' ? 'resist' : res === 'allout' ? 'weak' : 'dmg');
        if (label && res !== 'allout' && res !== 'normal') this.onPop?.(e.id, label, res === 'resist' ? 'resist' : 'weak');
        return big ? 0.55 : 0.36;
    }

    dead(e, U) {
        const v = U(e.id);
        if (!v) return 0;
        v.alive = false;
        const p = v.root.position.clone();
        this.fx.death(p, v.side === 'e' ? '#d24bff' : '#ff6a6a');
        this.stage?.doShake(0.5);
        this.tween(0.6, (k) => { v.dead = k; v.root.scale.setScalar(Math.max(0.01, 1 - k * 0.6)); v.root.position.y = -k * 0.4; v.pose.down = 1; }, () => { if (v.side === 'e') v.root.visible = false; else { v.root.scale.setScalar(1); v.root.position.copy(v.home); v.down = 1.0; } });
        return 0.55;
    }

    allOut(e, U) {
        const ids = e.ids.map(U).filter(Boolean);
        const foes = [...this.units.values()].filter((x) => x.side === 'e' && x.alive);
        const centre = foes.reduce((s, f) => s.add(f.root.position), V3()).multiplyScalar(1 / Math.max(1, foes.length));
        this.cam.pos.set(centre.x - 5, 6.5, centre.z + 8); this.cam.look.set(centre.x, 1, centre.z); this.cam.speed = 5;
        this.orbit = true; this.orbitT = 0; this.orbitC = centre.clone();
        this.stage?.doFlash('#ffffff', 0.8);
        ids.forEach((v, i) => {
            const to = centre.clone().add(V3((i - ids.length / 2) * 1.2 - 1.2, 0, (i % 2 ? 1 : -1) * 1.2));
            this.tween(0.25 + i * 0.05, (k) => { v.root.position.lerpVectors(v.home, to, ease(k)); v.pose.move = 1; }, () => { v.pose.move = 0; });
            this.after(0.5 + i * 0.12, () => { this.tween(0.3, (k) => { v.pose.atk = k; }, () => { v.pose.atk = 0; }); this.fx.slash(centre.clone().add(V3(0, 1.2, 0)), i % 2 ? '#ff7ae0' : '#7affd0', 2.6, 0.35, i * 1.3); });
        });
        this.after(1.7, () => { for (const v of ids) this.tween(0.3, (k) => v.root.position.lerpVectors(v.root.position, v.home, ease(k)), () => v.root.position.copy(v.home)); this.orbit = false; });
        return 1.35;
    }

    neg(e, U) {
        const v = U(e.neg.tid);
        if (v) {
            const ag = [...this.units.values()].find((x) => x.agent);
            if (e.neg.ended) {
                this.overview();
            } else {
                // a slow push in on the daemon's face
                const p = v.root.position;
                this.cam.pos.set(p.x - 3.8, v.h * 0.62 + 0.5, p.z + 2.8); this.cam.look.set(p.x, v.h * 0.55, p.z); this.cam.speed = 3.5;
                this.fx.ring(p.clone().add(V3(0, v.h * 0.55, 0)), '#7affd0', 0.3, 1.8, 0.7, false);
                if (e.neg.last > 0) this.fx.burst(p.clone().add(V3(0, v.h * 0.7, 0)), '#9dffb0', 10, 2, 0.5, 0.2);
                else if (e.neg.last < 0) { this.fx.burst(p.clone().add(V3(0, v.h * 0.7, 0)), '#ff4a6a', 10, 2, 0.5, 0.2); this.stage?.doShake(0.25); }
            }
        }
        return 0.2;
    }

    recoded(e, U) {
        const v = U(e.id);
        if (!v) return 0;
        v.alive = false;
        const p = v.root.position.clone();
        this.cam.pos.set(p.x - 4, 2.6, p.z + 5); this.cam.look.set(p.x, v.h * 0.5, p.z); this.cam.speed = 6;
        v.model.root.traverse((o) => { if (o.userData.hexshell) o.visible = false; });
        if (v.flashG) v.flashG.value = 0;
        this.fx.recode(p);
        this.stage?.doFlash('#9dffb0', 0.5);
        this.tween(1.1, (k) => { v.flashU.value = Math.sin(k * Math.PI) * 0.9; v.root.position.y = ease(k) * 1.2; v.root.scale.setScalar(Math.max(0.01, 1 - ease(k))); }, () => { v.root.visible = false; });
        return 1.3;
    }

    finish(e, U) {
        if (e.result === 'win') {
            const party = [...this.units.values()].filter((v) => v.side === 'p' && v.alive);
            this.cam.pos.set(-4, 2.4, 6.5); this.cam.look.set(-4, 1.4, 0); this.cam.speed = 3;
            party.forEach((v, i) => this.tween(1.2, (k) => { v.root.position.y = Math.abs(Math.sin(k * Math.PI * 2 + i)) * 0.35; v.pose.cast = Math.sin(k * Math.PI); }, () => { v.root.position.y = 0; v.pose.cast = 0; }));
            this.fx.burst(V3(-4, 3, 0), '#fffbd0', 40, 6, 1.4, 0.3, { grav: 1.5 });
            this.stage?.doFlash('#fffbd0', 0.3);
            return 1.0;
        }
        if (e.result === 'lose') { this.stage?.doFlash('#000000', 0.9); return 0.8; }
        return 0.2;
    }

    // ------------------------------------------------------------ frame
    update(dt, t, w, h) {
        this.t = t;
        TOON.uTime.value = t;
        dt *= 1;
        // tweens
        for (const tw of this.tweens) {
            tw.t += dt;
            if (tw.t < 0) continue;
            const k = Math.min(1, tw.t / tw.dur);
            tw.fn?.(k);
            if (k >= 1) { tw.fin = true; tw.done?.(); }
        }
        this.tweens = this.tweens.filter((x) => !x.fin);
        // units
        for (const v of this.units.values()) {
            if (!v.root.visible) continue;
            const p = v.pose;
            const down = Math.max(v.down, p.down || 0);
            v.model.pose({ move: p.move || 0, run: !!p.move, atk: p.atk || 0, cast: p.cast || 0, hurt: p.hurt || 0, down: v.alive ? down : Math.max(down, 0.98), guard: !!v.guard, talk: false }, t + v.id * 0.7);
            v.model.root.position.y = 0;
            if (v.flashU.value > 0 && v.flashU.value < 0.001) v.flashU.value = 0;
        }
        if (this.actorRing && this.actorRing.visible) {
            const v = this.units.get(this.actorId);
            if (v) { this.actorRing.position.set(v.root.position.x, 0.1, v.root.position.z); this.actorRing.scale.setScalar(1 + Math.sin(t * 5) * 0.06); this.actorRing.material.color.set(v.side === 'p' ? '#7affd0' : '#ff4ad8'); }
        }
        for (const r of this.targetRings) if (r.visible) r.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
        // camera
        if (this.orbit) { this.orbitT += dt; const a = this.orbitT * 2.2; const c = this.orbitC; this.cam.pos.set(c.x + Math.cos(a) * 8 - 2, 4.5 + Math.sin(a * 0.7) * 1.5, c.z + Math.sin(a) * 8); this.cam.look.set(c.x, 1.2, c.z); }
        const k = Math.min(1, dt * this.cam.speed);
        this.cam.pp.lerp(this.cam.pos, k); this.cam.pl.lerp(this.cam.look, k);
        const sh = (this.stage ? this.stage.shake : 0) * 0.35;
        this.camera.position.set(this.cam.pp.x + (Math.random() - 0.5) * sh, this.cam.pp.y + (Math.random() - 0.5) * sh, this.cam.pp.z + (Math.random() - 0.5) * sh);
        this.camera.lookAt(this.cam.pl);
        if (this.motes) { const a = this.motes.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (0.3 + (i % 5) * 0.08); if (y > 9) y = 0; a.setY(i, y); } a.needsUpdate = true; }
        this.fx.update(dt, this.camera);
    }

    /** Screen position (px) of a unit's head, or of its feet. */
    project(id, w, h, up = 1.0) {
        const v = this.units.get(id);
        if (!v) return null;
        const p = v.root.position.clone();
        p.y += (v.h || 1.8) * up;
        const q = p.project(this.camera);
        return { x: (q.x * 0.5 + 0.5) * w, y: (-q.y * 0.5 + 0.5) * h, visible: v.root.visible && q.z < 1 };
    }
}
