/**
 * fx.js — everything that glows, sparks, drifts or flies: GPU-drawn particle pools (one Points
 * draw each), fires on every hearth, brazier and torch, arrows and spell bolts, hit sparks and
 * blood, casting glows and channelled streams, dragon breath, sigil traces and shockwaves, the
 * ember stream from a slain dragon, and rain or snow around the camera.
 */
import * as THREE from 'three';
import { G } from './shaders.js';
import { SPELLS } from '../sim/magic.js';

const ELEM = {
    fire: [[1.0, 0.55, 0.15], [1.0, 0.85, 0.4]], frost: [[0.55, 0.8, 1.0], [0.85, 0.95, 1.0]], shock: [[0.6, 0.7, 1.0], [0.95, 0.95, 1.0]],
    heal: [[1.0, 0.85, 0.4], [0.7, 1.0, 0.6]], magic: [[0.7, 0.5, 1.0], [0.9, 0.8, 1.0]], ward: [[0.6, 0.75, 1.0], [0.8, 0.9, 1.0]], summon: [[0.6, 0.4, 1.0], [0.4, 0.8, 1.0]],
    poison: [[0.5, 0.9, 0.3], [0.7, 1.0, 0.4]], storm: [[0.6, 0.85, 1.0], [1.0, 1.0, 1.0]], ember: [[1.0, 0.6, 0.15], [1.0, 0.95, 0.6]],
};
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ particle pool
class Pool {
    constructor(scene, max, additive, soft = 1) {
        this.max = max; this.n = 0;
        this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
        this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
        this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
        this.grow = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
        this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3); this.a0 = new Float32Array(max);
        const g = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
        this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize);
        g.setDrawRange(0, 0);
        const mat = new THREE.ShaderMaterial({
            uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
            vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
                void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * uScale / max(-mv.z, 0.1), 0.0, 256.0); }`,
            fragmentShader: `varying vec4 vC; uniform float uSoft;
                void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 1.0 + uSoft); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
            transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.mat = mat;
        this.points = new THREE.Points(g, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 3 : 2;
        scene.add(this.points);
    }
    /** Emit one particle. c0 → c1 colour over life, alpha a. */
    emit(x, y, z, vx, vy, vz, life, size, c0, c1 = c0, a = 1, o = {}) {
        let i = this.n;
        if (i >= this.max) { i = (Math.random() * this.max) | 0; } else this.n++;
        const i3 = i * 3;
        this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
        this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
        this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
        this.grow[i] = o.grow ?? 0; this.drag[i] = o.drag ?? 0.5; this.grav[i] = o.grav ?? 0;
        this.c0[i3] = c0[0]; this.c0[i3 + 1] = c0[1]; this.c0[i3 + 2] = c0[2];
        this.c1[i3] = c1[0]; this.c1[i3 + 1] = c1[1]; this.c1[i3 + 2] = c1[2];
        this.a0[i] = a;
    }
    update(dt) {
        let n = this.n;
        for (let i = 0; i < n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                // swap-remove with the last live particle
                n--;
                if (i !== n) this.copy(n, i);
                i--; continue;
            }
            const i3 = i * 3, i4 = i * 4;
            const k = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i3] *= k; this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.grav[i] * dt; this.vel[i3 + 2] *= k;
            this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
            this.size[i] += this.grow[i] * dt;
            const t = 1 - this.life[i] / this.maxLife[i];
            this.col[i4] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
            this.col[i4 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
            this.col[i4 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
            this.col[i4 + 3] = this.a0[i] * Math.min(1, t * 6) * (1 - t);
        }
        this.n = n;
        this.points.geometry.setDrawRange(0, n);
        this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    }
    copy(from, to) {
        for (let k = 0; k < 3; k++) { this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k]; this.c0[to * 3 + k] = this.c0[from * 3 + k]; this.c1[to * 3 + k] = this.c1[from * 3 + k]; }
        for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
        this.size[to] = this.size[from]; this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
        this.grow[to] = this.grow[from]; this.drag[to] = this.drag[from]; this.grav[to] = this.grav[from]; this.a0[to] = this.a0[from];
    }
    clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

const R = Math.random;
const rs = (s) => (R() - 0.5) * 2 * s;

// ------------------------------------------------------------------ the effects layer
export class FxView {
    constructor(scene, world, actorsView, renderer) {
        this.scene = scene; this.w = world; this.av = actorsView; this.r = renderer;
        this.add = new Pool(scene, 5000, true, 1.2);
        this.alpha = new Pool(scene, 2500, false, 0.6);
        this.precip = new Pool(scene, 3000, false, 0.2);
        this.t = 0;
        // arrows: one instanced mesh for flying and stuck arrows
        const ag = new THREE.BoxGeometry(0.02, 0.02, 0.8);
        const fl = new THREE.BoxGeometry(0.08, 0.002, 0.14); fl.translate(0, 0, 0.32);
        const merged = mergeGeos([ag, fl]);
        this.arrowMesh = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 }), 80);
        this.arrowMesh.count = 0; this.arrowMesh.frustumCulled = false;
        scene.add(this.arrowMesh);
        this.stuck = [];   // { pos, dir, t }
        // shock rings for sigils and explosions
        this.rings = [];
        this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
        // fire point lights (nearest fires) and flash lights (explosions)
        this.fireLights = [];
        for (let i = 0; i < 4; i++) { const L = new THREE.PointLight(0xff9a40, 0, 14, 1.6); L.visible = false; scene.add(L); this.fireLights.push(L); }
        this.flash = new THREE.PointLight(0xffaa55, 0, 30, 1.4); scene.add(this.flash);
        this.flashT = 0;
        this.streams = [];  // ember streams { from, t }
        this.ripple = 0; this.rippleUV = new THREE.Vector2(0.5, 0.5);
        this.slow = 0; this.ember = 0;
        this.quality = 1;
        this.fires = null;
    }

    setQuality(q, tier) { this.quality = [1.2, 1, 0.6, 0.35][tier] ?? 1; }

    /** Fire sources near the camera: settlement lights outdoors, flagged lights indoors. */
    fireSources() {
        const w = this.w;
        if (w.cellId !== 'ext') return (w.space.lights || []).filter((l) => l.fire !== false).map((l) => ({ x: l.x, y: l.y - 0.3, z: l.z, k: l.len ? Math.min(3, l.len / 2) : 0.7, hearth: !!l.len }));
        if (!this.extFires) this.extFires = w.settlements.lights.map((l) => ({ x: l.x, y: l.y, z: l.z, k: l.kind === 'bigfire' ? 2 : l.kind === 'campfire' ? 1.2 : l.kind === 'forge' ? 1 : 0.5, kind: l.kind }));
        return this.extFires;
    }

    onEvent(e) {
        const w = this.w, p = w.player;
        switch (e.type) {
            case 'hit': {
                const t = e.target, P = e.pos || { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z };
                if (e.blocked) { for (let i = 0; i < 14; i++) this.add.emit(P.x, P.y, P.z, rs(4), R() * 3, rs(4), 0.3 + R() * 0.3, 0.06, [1, 0.8, 0.4], [1, 0.4, 0.1], 1, { grav: 9, drag: 1 }); break; }
                const flesh = !(t.rig === 'humanoid' && (t.body === 'skeleton' || t.body === 'golem' || t.body === 'sentinel')) && t.body !== 'clockwork';
                const n = Math.min(24, 6 + (e.dmg || 5) * 0.8) * this.quality;
                const ttt = this.hitElem(e);
                if (ttt === 'fire') for (let i = 0; i < n; i++) this.add.emit(P.x + rs(0.3), P.y + rs(0.4), P.z + rs(0.3), rs(1.5), 1 + R() * 2, rs(1.5), 0.4 + R() * 0.4, 0.25, ELEM.fire[1], ELEM.fire[0], 0.9, { grow: 0.4 });
                else if (ttt === 'frost') for (let i = 0; i < n; i++) this.alpha.emit(P.x + rs(0.3), P.y + rs(0.4), P.z + rs(0.3), rs(1.2), R(), rs(1.2), 0.6 + R() * 0.5, 0.25, [0.85, 0.95, 1], [0.7, 0.85, 1], 0.6, { grow: 0.6 });
                else if (ttt === 'shock') for (let i = 0; i < n; i++) this.add.emit(P.x, P.y, P.z, rs(6), rs(6), rs(6), 0.15 + R() * 0.15, 0.08, [0.9, 0.95, 1], [0.5, 0.6, 1], 1, { drag: 2 });
                else if (flesh) for (let i = 0; i < n; i++) this.alpha.emit(P.x + rs(0.15), P.y + rs(0.25), P.z + rs(0.15), rs(2.2), R() * 2.5, rs(2.2), 0.5 + R() * 0.4, 0.07 + R() * 0.06, [0.45, 0.02, 0.02], [0.25, 0.0, 0.0], 0.9, { grav: 9, drag: 0.6 });
                else for (let i = 0; i < n; i++) this.alpha.emit(P.x + rs(0.2), P.y + rs(0.3), P.z + rs(0.2), rs(2), R() * 2, rs(2), 0.5, 0.08, [0.8, 0.78, 0.7], [0.6, 0.58, 0.5], 0.8, { grav: 8 });
                break;
            }
            case 'explode': {
                const P = e.pos, c = ELEM[e.elem] || ELEM.fire;
                const n = 90 * this.quality;
                for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, b = R() * Math.PI - Math.PI / 2, s = 3 + R() * 6 * (e.radius || 4) / 4; this.add.emit(P.x, P.y + 0.5, P.z, Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s * 0.8, Math.sin(a) * Math.cos(b) * s, 0.5 + R() * 0.5, 0.5, c[1], c[0], 1, { drag: 2.5, grow: 0.8 }); }
                for (let i = 0; i < n * 0.4; i++) this.alpha.emit(P.x + rs(1), P.y + 0.5, P.z + rs(1), rs(1.5), 1 + R() * 2, rs(1.5), 1.5 + R(), 0.8, [0.2, 0.18, 0.16], [0.35, 0.33, 0.3], 0.5, { grow: 1.5, drag: 0.8 });
                this.ring(P, e.radius || 4, c[0], 0.5);
                this.flashAt(P, new THREE.Color(...c[0]), 40, 0.45);
                break;
            }
            case 'projectileHit': {
                if (e.kind === 'arrow' && !e.target) {
                    const v = e.vel, l = Math.hypot(v.x, v.y, v.z) || 1;
                    this.stuck.push({ pos: { ...e.pos }, dir: { x: v.x / l, y: v.y / l, z: v.z / l }, t: 40, cell: w.cellId });
                    if (this.stuck.length > 40) this.stuck.shift();
                    for (let i = 0; i < 6; i++) this.alpha.emit(e.pos.x, e.pos.y, e.pos.z, rs(1), R() * 1.5, rs(1), 0.4, 0.06, [0.6, 0.55, 0.45], [0.5, 0.45, 0.4], 0.8, { grav: 6 });
                } else if (e.kind !== 'arrow') {
                    const c = ELEM[e.elem] || ELEM.magic;
                    for (let i = 0; i < 26 * this.quality; i++) this.add.emit(e.pos.x, e.pos.y, e.pos.z, rs(4), rs(4), rs(4), 0.3 + R() * 0.3, 0.2, c[1], c[0], 1, { drag: 3 });
                }
                break;
            }
            case 'sigilStart': this.sigilGlow = { actor: e.actor, t: 0 }; break;
            case 'sigil': this.sigilBurst(e); break;
            case 'ember': this.streams.push({ from: { ...e.pos }, t: 0, dur: 4.5 }); break;
            case 'summon': case 'unsummon': {
                const a = e.actor; const c = ELEM.summon;
                for (let i = 0; i < 60 * this.quality; i++) { const ang = R() * 6.28, r = R() * 0.8; this.add.emit(a.pos.x + Math.cos(ang) * r, a.pos.y + R() * 2, a.pos.z + Math.sin(ang) * r, 0, 1 + R(), 0, 0.8 + R() * 0.5, 0.15, c[0], c[1], 1); }
                break;
            }
            case 'trap': {
                if (e.kind === 'steam') for (let i = 0; i < 40; i++) this.alpha.emit(e.x + rs(0.4), e.y + 0.1, e.z + rs(0.4), rs(0.6), 3 + R() * 3, rs(0.6), 1 + R() * 0.5, 0.4, [0.9, 0.9, 0.9], [0.7, 0.7, 0.72], 0.5, { grow: 1.6, drag: 1 });
                else for (let i = 0; i < 16; i++) this.add.emit(e.x, e.y + 0.8, e.z, rs(5), R() * 2, rs(5), 0.2, 0.05, [1, 0.8, 0.4], [1, 0.4, 0.1], 1, { grav: 8 });
                break;
            }
            case 'dragonDeath': this.burning = e.actor; this.burnT = 0; break;
            case 'cellChanged': this.add.clear(); this.alpha.clear(); this.precip.clear(); this.extFires = null; break;
            case 'jump': case 'fall': break;
        }
    }

    /** The element a hit carried. */
    hitElem(e) { return e.dmgType || null; }

    ring(P, radius, col, dur = 0.6) {
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.position.set(P.x, P.y + 0.3, P.z);
        this.scene.add(m);
        this.rings.push({ m, t: 0, dur, r: radius });
    }
    flashAt(P, col, power, dur) { this.flash.position.set(P.x, P.y + 1, P.z); this.flash.color.copy(col); this.flash.intensity = power * 20; this.flashT = dur; this.flashDur = dur; }

    sigilBurst(e) {
        const a = e.actor, d = e.dir || { x: 0, y: 0, z: -1 }, P = e.pos || a.pos;
        const k = e.rings || 1, q = this.quality;
        const fan = (cols, speed, n, spread, size, alpha = false) => {
            for (let i = 0; i < n * q; i++) {
                const s = speed * (0.6 + R() * 0.6);
                const vx = d.x * s + rs(spread) * s, vy = d.y * s + rs(spread * 0.5) * s, vz = d.z * s + rs(spread) * s;
                (alpha ? this.alpha : this.add).emit(P.x + d.x * 0.8, P.y - 0.2, P.z + d.z * 0.8, vx, vy, vz, 0.6 + R() * 0.5, size, cols[1], cols[0], alpha ? 0.5 : 1, { drag: 1.5, grow: size * 2 });
            }
        };
        switch (e.sigil) {
            case 'gale': fan([[0.75, 0.8, 0.85], [0.95, 0.97, 1]], 10 + k * 5, 60 + k * 30, 0.45, 0.35, true); this.ring({ x: P.x + d.x * 2, y: P.y - 1.4, z: P.z + d.z * 2 }, 4 + k * 3, [0.7, 0.85, 1], 0.5); break;
            case 'embers': fan(ELEM.fire, 9 + k * 3, 90 + k * 40, 0.35, 0.45); break;
            case 'rime': fan([[0.6, 0.85, 1], [0.95, 1, 1]], 8 + k * 3, 80 + k * 40, 0.35, 0.4, true); break;
            case 'stride': for (let i = 0; i < 40 * q; i++) this.alpha.emit(a.pos.x + rs(0.5), a.pos.y + R() * 1.6, a.pos.z + rs(0.5), -d.x * 3, 0.3, -d.z * 3, 0.6, 0.3, [0.85, 0.9, 1], [0.7, 0.75, 0.8], 0.4, { grow: 1 }); break;
            case 'stillness': this.ring({ x: a.pos.x, y: a.pos.y, z: a.pos.z }, 12 + k * 6, [0.5, 0.7, 1], 1.2); break;
            case 'veil': for (let i = 0; i < 60 * q; i++) this.add.emit(a.pos.x + rs(0.6), a.pos.y + R() * 1.8, a.pos.z + rs(0.6), 0, 0.4, 0, 1 + R(), 0.2, [0.5, 0.6, 1], [0.3, 0.4, 0.8], 0.8); break;
            case 'earthbind': for (const t of this.w.actors) if (t.rig === 'dragon' && t.grounded > 0) this.lightningBetween(P, { x: t.pos.x, y: t.pos.y + 3, z: t.pos.z }); break;
        }
        this.ripple = 1;
        this.rippleCenter = { x: P.x + d.x * 2, y: P.y, z: P.z + d.z * 2 };
        if (a === this.w.player) this.av && (this.shake = 0.5 + k * 0.2);
        this.flashAt(P, new THREE.Color(0.7, 0.85, 1), 10 + k * 8, 0.25);
    }

    lightningBetween(A, B) {
        const n = 24;
        let px = A.x, py = A.y, pz = A.z;
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            const x = A.x + (B.x - A.x) * t + (i < n ? rs(1.2) : 0), y = A.y + (B.y - A.y) * t + (i < n ? rs(1.2) : 0), z = A.z + (B.z - A.z) * t + (i < n ? rs(1.2) : 0);
            for (let s = 0; s < 4; s++) { const u = s / 4; this.add.emit(px + (x - px) * u, py + (y - py) * u, pz + (z - pz) * u, 0, 0, 0, 0.35, 0.25, [0.9, 0.95, 1], [0.5, 0.6, 1], 1, { drag: 0 }); }
            px = x; py = y; pz = z;
        }
    }

    update(dt, camera) {
        const w = this.w, p = w.player, q = this.quality;
        this.t += dt;
        const cam = camera.position;
        // ---- fires
        const fires = this.fireSources();
        const near = [];
        for (const f of fires) {
            const d2 = (f.x - cam.x) ** 2 + (f.z - cam.z) ** 2;
            if (d2 > 70 * 70) continue;
            near.push({ f, d2 });
            const rate = (f.k * 26 + 4) * q * dt * (d2 < 900 ? 1 : 0.4);
            for (let n = rate + R(); n >= 1; n--) {
                const sx = f.hearth ? rs(f.k * 0.8) : rs(0.12 * f.k + 0.05), sz = rs(0.12 * f.k + 0.05);
                this.add.emit(f.x + sx, f.y + 0.05, f.z + sz, rs(0.15), 0.9 + R() * 0.9 * Math.sqrt(f.k), rs(0.15), 0.35 + R() * 0.45, 0.22 * Math.sqrt(f.k) + 0.08, [1.0, 0.7, 0.25], [0.9, 0.18, 0.04], 0.9, { grow: -0.25, drag: 0.4 });
            }
            if (R() < f.k * 2 * dt * q) this.add.emit(f.x + rs(0.2), f.y + 0.2, f.z + rs(0.2), rs(0.4), 1.8 + R() * 1.6, rs(0.4), 1.2 + R(), 0.03, [1, 0.7, 0.3], [1, 0.3, 0.05], 1, { drag: 0.3 });
            if (R() < f.k * 3 * dt * q && w.cellId === 'ext') this.alpha.emit(f.x + rs(0.2), f.y + 0.6 * f.k, f.z + rs(0.2), rs(0.2), 0.8 + R() * 0.5, rs(0.2), 3 + R() * 2, 0.4 * f.k, [0.25, 0.23, 0.22], [0.4, 0.4, 0.42], 0.25, { grow: 0.9, drag: 0.2 });
        }
        // fire lights outdoors at night (interiors have their own)
        near.sort((a, b) => a.d2 - b.d2);
        const night = G.uNight.value;
        this.fireLights.forEach((L, i) => {
            const n = near[i];
            if (!n || w.cellId !== 'ext' || night < 0.15) { L.visible = false; return; }
            L.visible = true; L.position.set(n.f.x, n.f.y + 0.8, n.f.z);
            L.intensity = (6 + n.f.k * 10) * night * (0.85 + 0.15 * Math.sin(this.t * 11 + i * 2));
        });
        // ---- held torches
        for (const a of w.actors) {
            if (a.dead || a.equip?.left?.id !== 'torch' || a.cell !== w.cellId) continue;
            if (Math.hypot(a.pos.x - cam.x, a.pos.z - cam.z) > 50) continue;
            const hp = this.av.bonePos(a, 'handL', _v);
            const tx = hp.x, ty = hp.y + 0.45, tz = hp.z;
            for (let n = 14 * q * dt + R(); n >= 1; n--) this.add.emit(tx + rs(0.04), ty, tz + rs(0.04), rs(0.1), 0.8 + R() * 0.6, rs(0.1), 0.3 + R() * 0.25, 0.12, [1, 0.75, 0.3], [0.9, 0.2, 0.05], 0.9, { grow: -0.2 });
        }
        // ---- casting: glowing hands and channelled streams
        for (const a of w.actors) {
            if (a.dead || a.cell !== w.cellId) continue;
            const act = a.act;
            if (act?.kind === 'cast' && act.spell) {
                const sp = SPELLS[act.spell]; if (!sp) continue;
                const c = ELEM[sp.elem] || (sp.kind === 'heal' ? ELEM.heal : sp.kind === 'ward' ? ELEM.ward : sp.kind === 'summon' || sp.kind === 'bound' ? ELEM.summon : ELEM.magic);
                const hands = act.hand === 'both' ? ['handR', 'handL'] : [act.hand === 'left' ? 'handL' : 'handR'];
                for (const h of hands) {
                    const hp = a === p && !p.third ? this.vmHand?.(h) || this.av.bonePos(a, h, _v) : this.av.bonePos(a, h, _v);
                    for (let n = 30 * q * dt + R(); n >= 1; n--) this.add.emit(hp.x + rs(0.06), hp.y + rs(0.06), hp.z + rs(0.06), rs(0.3), 0.3 + R() * 0.3, rs(0.3), 0.25 + R() * 0.2, 0.09, c[1], c[0], 1);
                    if (act.conc && (sp.kind === 'conc')) {
                        const d = a.kind === 'player' ? aim(p) : { x: -Math.sin(a.yaw), y: 0, z: -Math.cos(a.yaw) };
                        const elemA = sp.elem === 'frost';
                        for (let n = 70 * q * dt + R(); n >= 1; n--) {
                            const s = 9 + R() * 5;
                            (elemA ? this.alpha : this.add).emit(hp.x + d.x * 0.3, hp.y + d.y * 0.3, hp.z + d.z * 0.3, d.x * s + rs(1.4), d.y * s + rs(1.2), d.z * s + rs(1.4), 0.45 + R() * 0.2, 0.12, c[1], c[0], elemA ? 0.5 : 0.9, { drag: 2.2, grow: 1.1 });
                        }
                    }
                }
            } else if (act?.kind === 'sigil' && act.charging !== undefined) {
                // the traced ring: sparks follow the drawing hand
                const hp = a === p && !p.third && this.vmHand ? this.vmHand('handR') : this.av.bonePos(a, 'handR', _v);
                for (let n = 50 * q * dt + R(); n >= 1; n--) this.add.emit(hp.x + rs(0.03), hp.y + rs(0.03), hp.z + rs(0.03), 0, 0, 0, 0.45 + (act.rings || 1) * 0.1, 0.07, [0.85, 0.95, 1], [0.35, 0.55, 1], 1, { drag: 0 });
            }
            // dragon breath
            if (a.rig === 'dragon' && a.breath > 0 && a.breathDir) {
                const hp = this.av.bonePos(a, 'snout', _v);
                const d = a.breathDir, frost = a.tpl?.includes('frost');
                const c = frost ? [[0.7, 0.9, 1], [0.95, 1, 1]] : ELEM.fire;
                for (let n = 220 * q * dt + R(); n >= 1; n--) {
                    const s = 22 + R() * 10;
                    (frost ? this.alpha : this.add).emit(hp.x, hp.y, hp.z, d.x * s + rs(3), d.y * s + rs(3), d.z * s + rs(3), 0.9 + R() * 0.4, 0.5, c[1], c[0], frost ? 0.55 : 0.9, { drag: 1.4, grow: 3.5 });
                }
            }
            // burning (on fire effect)
            if (a.effects?.some((e) => e.id === 'burning')) for (let n = 20 * q * dt + R(); n >= 1; n--) this.add.emit(a.pos.x + rs(0.3), a.pos.y + R() * a.h, a.pos.z + rs(0.3), 0, 1.2, 0, 0.4, 0.18, [1, 0.7, 0.25], [0.9, 0.2, 0.05], 0.9);
        }
        // a slain dragon smoulders and burns away
        if (this.burning && !this.burning.removed) {
            this.burnT += dt;
            const a = this.burning;
            if (this.burnT < 12) for (let n = 120 * q * dt + R(); n >= 1; n--) this.add.emit(a.pos.x + rs(3), a.pos.y + R() * 2.5, a.pos.z + rs(5), rs(0.5), 1.5 + R() * 2, rs(0.5), 1 + R(), 0.2 + R() * 0.3, [1, 0.6, 0.15], [0.6, 0.1, 0.02], 0.9, { drag: 0.5 });
            else this.burning = null;
        }
        // ---- the ember stream from a slain dragon into the player
        for (const s of this.streams) {
            s.t += dt;
            const k = Math.min(1, s.t / s.dur);
            const to = { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z };
            for (let n = 160 * q * dt * (1 - k * 0.5); n >= 1; n--) {
                const u = R();
                const x = s.from.x + (to.x - s.from.x) * u + Math.sin(u * 9 + this.t * 3) * 2 * (1 - u), y = s.from.y + 2 + (to.y - s.from.y - 2) * u + Math.sin(u * Math.PI) * 6, z = s.from.z + (to.z - s.from.z) * u + Math.cos(u * 7 + this.t * 2) * 2 * (1 - u);
                this.add.emit(x, y, z, (to.x - x) * 0.8, (to.y - y) * 0.8, (to.z - z) * 0.8, 0.5, 0.25, ELEM.ember[1], ELEM.ember[0], 1, { drag: 0 });
            }
            this.ember = Math.max(this.ember, Math.sin(k * Math.PI));
        }
        this.streams = this.streams.filter((s) => s.t < s.dur);
        this.ember = Math.max(0, this.ember - dt * 0.4);
        // ---- precipitation
        const ws = w.weather.state();
        if (w.cellId === 'ext' && (ws.rain > 0.05 || ws.snow > 0.05)) {
            const snow = ws.snow > ws.rain;
            const amt = (snow ? ws.snow : ws.rain) * 900 * q * dt;
            for (let n = amt + R(); n >= 1; n--) {
                const x = cam.x + rs(30), z = cam.z + rs(30), y = cam.y + 12 + R() * 6;
                if (snow) this.precip.emit(x, y, z, G.uWind.value.x * 1.5 + rs(0.4), -1.2 - R() * 0.6, G.uWind.value.y * 1.5 + rs(0.4), 7, 0.05 + R() * 0.03, [1, 1, 1], [0.95, 0.97, 1], 0.85, { drag: 0 });
                else this.precip.emit(x, y, z, G.uWind.value.x * 2, -14 - R() * 4, G.uWind.value.y * 2, 1.3, 0.025, [0.7, 0.75, 0.82], [0.7, 0.75, 0.82], 0.55, { drag: 0 });
            }
        }
        // ---- arrows in flight and stuck
        let n = 0;
        for (const pr of w.projectiles) {
            if (pr.kind === 'arrow') { if (n < 80) this.setArrow(n++, pr.pos, pr.vel); continue; }
            const c = ELEM[pr.elem] || ELEM.magic;
            this.add.emit(pr.pos.x, pr.pos.y, pr.pos.z, 0, 0, 0, 0.06, pr.kind === 'ball' ? 0.9 : 0.55, c[1], c[1], 1, { drag: 0 });
            for (let k = 0; k < 4 * q; k++) this.add.emit(pr.pos.x + rs(0.1), pr.pos.y + rs(0.1), pr.pos.z + rs(0.1), rs(0.6), rs(0.6), rs(0.6), 0.3 + R() * 0.2, 0.18, c[1], c[0], 0.9, { grow: -0.3 });
        }
        for (const s of this.stuck) { s.t -= dt; if (s.cell === w.cellId && n < 80 && s.t > 0) this.setArrow(n++, s.pos, s.dir, true); }
        this.stuck = this.stuck.filter((s) => s.t > 0);
        this.arrowMesh.count = n;
        this.arrowMesh.instanceMatrix.needsUpdate = true;
        // runes on the ground
        for (const r of w.runes) if (R() < dt * 30 * q) { const a = R() * 6.28; const c = ELEM[r.elem] || ELEM.fire; this.add.emit(r.x + Math.cos(a) * 1.2, r.y + 0.05, r.z + Math.sin(a) * 1.2, 0, 0.3, 0, 0.6, 0.12, c[1], c[0], 1); }
        // ---- rings, flash, screen effects
        for (const rg of this.rings) { rg.t += dt; const k = rg.t / rg.dur; rg.m.scale.setScalar(Math.max(0.01, rg.r * k)); rg.m.material.opacity = 0.8 * (1 - k); }
        for (const rg of this.rings.filter((x) => x.t >= x.dur)) { this.scene.remove(rg.m); rg.m.material.dispose(); }
        this.rings = this.rings.filter((x) => x.t < x.dur);
        if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity *= Math.max(0, 1 - dt / Math.max(0.05, this.flashDur) * 2); if (this.flashT <= 0) this.flash.intensity = 0; }
        this.ripple = Math.max(0, this.ripple - dt * 1.6);
        if (this.r?.fx) {
            const fx = this.r.fx;
            if (this.ripple > 0 && this.rippleCenter) {
                _v.set(this.rippleCenter.x, this.rippleCenter.y, this.rippleCenter.z).project(camera);
                fx.uRipple.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5, 1 - this.ripple, this.ripple);
            } else fx.uRipple.value.w = 0;
            fx.uSlow.value = w.slowTime > 0 ? Math.min(1, w.slowTime) : Math.max(0, fx.uSlow.value - dt * 2);
            fx.uEmber.value = this.ember;
        }
        this.add.update(dt); this.alpha.update(dt); this.precip.update(dt);
        const sc = (this.r?.gl?.domElement?.height || 720) * 0.6;
        this.add.mat.uniforms.uScale.value = this.alpha.mat.uniforms.uScale.value = this.precip.mat.uniforms.uScale.value = sc;
    }

    setArrow(i, pos, dir, stuck = false) {
        _v.set(dir.x, dir.y, dir.z).normalize();
        _q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _v);
        const back = stuck ? 0.3 : 0;
        _m.compose(new THREE.Vector3(pos.x - _v.x * back, pos.y - _v.y * back, pos.z - _v.z * back), _q, new THREE.Vector3(1, 1, 1));
        this.arrowMesh.setMatrixAt(i, _m);
    }
}

function aim(p) { const cp = Math.cos(p.camPitch); return { x: -Math.sin(p.camYaw) * cp, y: Math.sin(p.camPitch), z: -Math.cos(p.camYaw) * cp }; }

function mergeGeos(geos) {
    const out = new THREE.BufferGeometry();
    const pos = [], nrm = [], idx = [];
    let base = 0;
    for (const g of geos) {
        const gg = g.index ? g : g;
        const p = gg.attributes.position, n = gg.attributes.normal;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); }
        const ix = gg.index ? Array.from(gg.index.array) : [...Array(p.count).keys()];
        for (const i of ix) idx.push(i + base);
        base += p.count;
    }
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setIndex(idx);
    return out;
}
